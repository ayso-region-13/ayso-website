// AYSO Region 13 field-map editor — Cloudflare Worker.
//
// Serves the map-authoring SPA (public/) at https://fields.ayso13.org behind
// Cloudflare Access, and exposes a small JSON API the editor uses:
//
//   GET  /api/config          → { mapboxToken, repo, branch }  (after auth)
//   GET  /api/fields          → [{ slug, title, lat, lon, hasMap }]  (from repo)
//   GET  /api/map/:slug       → saved annotation JSON for re-editing (or 404)
//   POST /api/map/:slug       → { variant, pngBase64, annotation }; commits the
//                               PNG + annotation JSON to the staging branch in
//                               ONE atomic commit via the GitHub Git Data API.
//
// Every request (including static-asset requests, because run_worker_first is
// on) is gated by verifyAccess(): the Cloudflare Access JWT in the
// Cf-Access-Jwt-Assertion header is validated against the team JWKS (signature,
// issuer, audience, expiry). This is the boundary protecting the GitHub write
// token — see wrangler.toml for why workers_dev is disabled.
//
// Requests to localhost / 127.0.0.1 (i.e. `wrangler dev`) skip the JWT check so
// the editor UI can be iterated on locally. Production (fields.ayso13.org)
// always enforces it.

const FIELDS_DIR = "site/src/fields";
const MAPS_DATA_DIR = "site/src/_data/fieldmaps";
const IMAGES_DIR = "site/src/images/fields";

// CSP for the editor HTML. Mapbox GL needs blob: web workers and loads its
// library/tiles/Static-Images from api.mapbox.com; telemetry posts to
// events.mapbox.com. The public site's CSP (site/src/_headers.njk) is NOT
// reused here — that policy has no Mapbox origins and would break the editor.
const EDITOR_CSP = [
  "default-src 'self'",
  "script-src 'self' https://api.mapbox.com",
  "style-src 'self' 'unsafe-inline' https://api.mapbox.com",
  "worker-src blob:",
  "child-src blob:",
  "connect-src 'self' https://api.mapbox.com https://events.mapbox.com",
  "img-src 'self' data: blob: https://api.mapbox.com",
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
].join("; ");

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ── Auth gate (every request) ──────────────────────────────────────────
    const auth = await verifyAccess(request, env, url);
    if (!auth.ok) {
      return json({ error: auth.msg }, auth.status);
    }

    // ── API routes ────────────────────────────────────────────────────────
    if (url.pathname.startsWith("/api/")) {
      try {
        return await handleApi(request, env, url, auth);
      } catch (err) {
        console.error("API error:", err && err.stack ? err.stack : String(err));
        return json({ error: "Internal error", detail: String(err && err.message || err) }, 500);
      }
    }

    // ── Static editor assets (served once auth passes) ─────────────────────
    const assetRes = await env.ASSETS.fetch(request);
    const res = new Response(assetRes.body, assetRes);
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("text/html")) {
      res.headers.set("Content-Security-Policy", EDITOR_CSP);
    }
    res.headers.set("X-Content-Type-Options", "nosniff");
    res.headers.set("X-Frame-Options", "DENY");
    // NOT "same-origin": that strips the Referer on cross-origin requests to
    // api.mapbox.com, and Mapbox's URL-restricted token validates the Referer
    // (no Referer → 403 on every tile). strict-origin-when-cross-origin sends
    // the bare origin cross-origin, which satisfies the URL restriction.
    res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    return res;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// API dispatch
// ─────────────────────────────────────────────────────────────────────────────

async function handleApi(request, env, url, auth) {
  const { pathname } = url;

  if (pathname === "/api/config" && request.method === "GET") {
    return json({
      mapboxToken: env.MAPBOX_TOKEN_PUBLIC || "",
      repo: env.GITHUB_REPO,
      branch: env.GITHUB_BRANCH,
      editor: auth.email || null,
    });
  }

  if (pathname === "/api/fields" && request.method === "GET") {
    return json(await listFields(env));
  }

  const mapMatch = pathname.match(/^\/api\/map\/([a-z0-9][a-z0-9-]*)$/);
  if (mapMatch) {
    const slug = mapMatch[1];
    if (request.method === "GET") return await getMap(env, slug);
    if (request.method === "POST") return await saveMap(request, env, slug, auth);
    if (request.method === "DELETE") return await deleteVariant(request, env, url, slug, auth);
    return json({ error: "Method not allowed" }, 405);
  }

  return json({ error: "Not found" }, 404);
}

// ─────────────────────────────────────────────────────────────────────────────
// Field listing — reads frontmatter straight from the repo so the editor's
// field picker is always current (no dependency on a published build).
// ─────────────────────────────────────────────────────────────────────────────

async function listFields(env) {
  const [fieldFiles, mapFiles] = await Promise.all([
    ghListDir(env, FIELDS_DIR),
    ghListDir(env, MAPS_DATA_DIR), // may be empty/absent before the first map ships
  ]);

  const haveMap = new Set(
    mapFiles
      .filter((f) => f.name.endsWith(".json"))
      .map((f) => f.name.replace(/\.json$/, ""))
  );

  const candidates = fieldFiles.filter(
    (f) => f.name.endsWith(".md") && f.name !== "index.md" && f.name !== "goals.md"
  );

  const fields = await Promise.all(
    candidates.map(async (f) => {
      const slug = f.name.replace(/\.md$/, "");
      const raw = await ghGetFileText(env, `${FIELDS_DIR}/${f.name}`);
      const fm = parseFrontmatter(raw);
      const lat = num(fm.placeLat);
      const lon = num(fm.placeLon);
      if (lat === null || lon === null) return null; // not a mappable location
      return {
        slug,
        title: fm.title || slug,
        lat,
        lon,
        locality: fm.placeLocality || "Pasadena",
        hasMap: haveMap.has(slug),
      };
    })
  );

  return fields.filter(Boolean).sort((a, b) => a.title.localeCompare(b.title));
}

async function getMap(env, slug) {
  const raw = await ghGetFileText(env, `${MAPS_DATA_DIR}/${slug}.json`);
  if (raw === null) return json({ error: "No saved map" }, 404);
  try {
    return json(JSON.parse(raw));
  } catch (_) {
    return json({ error: "Saved map is not valid JSON" }, 500);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Save — atomic two-file commit (PNG + annotation JSON) via the Git Data API.
// ─────────────────────────────────────────────────────────────────────────────

async function saveMap(request, env, slug, auth) {
  const body = await request.json().catch(() => null);
  if (!body) return json({ error: "Invalid JSON body" }, 400);

  const variant = String(body.variant || "game");
  if (!/^[a-z0-9-]+$/.test(variant)) {
    return json({ error: "Bad variant" }, 400);
  }
  const annotation = body.annotation;
  const pngBase64 = stripDataUrl(body.pngBase64 || "");
  // annotation must carry the re-editable model (elements[]) or legacy features.
  if (!annotation || typeof annotation !== "object" || !(annotation.elements || annotation.features)) {
    return json({ error: "Missing annotation (elements)" }, 400);
  }
  if (!pngBase64) {
    return json({ error: "Missing pngBase64" }, 400);
  }

  const pngPath = `${IMAGES_DIR}/${slug}-${variant}.png`;
  const jsonPath = `${MAPS_DATA_DIR}/${slug}.json`;

  // Merge this variant into the existing per-field doc so a "practice" save
  // doesn't clobber a previously saved "game" layout (both live in one file).
  let doc = { field: slug, styleVersion: "satellite-v9", variants: {} };
  const existingRaw = await ghGetFileText(env, jsonPath);
  if (existingRaw) {
    try {
      const parsed = JSON.parse(existingRaw);
      if (parsed && typeof parsed === "object") {
        doc = parsed;
        doc.field = slug;
        if (!doc.variants || typeof doc.variants !== "object") doc.variants = {};
      }
    } catch (_) {
      /* corrupt existing file — start fresh rather than fail the save */
    }
  }

  doc.styleVersion = annotation.styleVersion || doc.styleVersion || "satellite-v9";
  doc.variants[variant] = {
    label: annotation.label || defaultVariantLabel(variant),
    view: annotation.view || null,
    elements: annotation.elements || [],
    png: "/" + pngPath.replace(/^site\/src\//, ""),
    alt: annotation.alt || `${slug} ${variant} field map`,
    updatedBy: auth.email || null,
  };

  const jsonText = JSON.stringify(doc, null, 2) + "\n";

  const sha = await commitFiles(env, {
    message: `field maps: ${slug} (${variant}) via editor${auth.email ? ` [${auth.email}]` : ""}`,
    files: [
      { path: pngPath, content: pngBase64, encoding: "base64" },
      { path: jsonPath, content: jsonText, encoding: "utf-8" },
    ],
  });

  return json({
    ok: true,
    commit: sha,
    png: doc.variants[variant].png,
    json: jsonPath,
    branch: env.GITHUB_BRANCH,
  });
}

function defaultVariantLabel(variant) {
  const map = { game: "Game Day Layout", practice: "Practice Layout" };
  return map[variant] || (variant.charAt(0).toUpperCase() + variant.slice(1) + " Layout");
}

// Delete one layout (variant): removes it from the doc + deletes its PNG. If it
// was the last layout, the whole doc JSON is removed too.
async function deleteVariant(request, env, url, slug, auth) {
  const variant = url.searchParams.get("variant");
  if (!variant || !/^[a-z0-9-]+$/.test(variant)) return json({ error: "Bad variant" }, 400);

  const jsonPath = `${MAPS_DATA_DIR}/${slug}.json`;
  const raw = await ghGetFileText(env, jsonPath);
  if (!raw) return json({ error: "No saved map" }, 404);
  let doc;
  try { doc = JSON.parse(raw); } catch (_) { return json({ error: "Corrupt map JSON" }, 500); }
  const v = doc.variants && doc.variants[variant];
  if (!v) return json({ error: "No such layout" }, 404);

  const files = [];
  if (v.png) files.push({ path: "site/src" + v.png, delete: true }); // /images/… → site/src/images/…
  delete doc.variants[variant];
  const remaining = Object.keys(doc.variants || {}).length;
  if (remaining === 0) {
    files.push({ path: jsonPath, delete: true });
  } else {
    files.push({ path: jsonPath, content: JSON.stringify(doc, null, 2) + "\n", encoding: "utf-8" });
  }

  const sha = await commitFiles(env, {
    message: `field maps: delete ${slug} (${variant})${auth.email ? ` [${auth.email}]` : ""}`,
    files,
  });
  return json({ ok: true, commit: sha, remaining, branch: env.GITHUB_BRANCH });
}

// Git Data API: ref → blobs → tree → commit → advance ref. One commit, no
// per-file SHA bookkeeping, handles create-or-update identically.
async function commitFiles(env, { message, files }) {
  const repo = env.GITHUB_REPO;
  const branch = env.GITHUB_BRANCH;

  const ref = await gh(env, `/repos/${repo}/git/ref/heads/${branch}`);
  const baseCommitSha = ref.object.sha;

  const baseCommit = await gh(env, `/repos/${repo}/git/commits/${baseCommitSha}`);
  const baseTreeSha = baseCommit.tree.sha;

  // Create blobs for added/updated files; deletions need no blob (sha: null).
  const blobShas = await Promise.all(
    files.map((f) =>
      f.delete
        ? Promise.resolve(null)
        : gh(env, `/repos/${repo}/git/blobs`, {
            method: "POST",
            body: { content: f.content, encoding: f.encoding },
          }).then((b) => b.sha)
    )
  );

  const tree = await gh(env, `/repos/${repo}/git/trees`, {
    method: "POST",
    body: {
      base_tree: baseTreeSha,
      tree: files.map((f, i) => ({
        path: f.path,
        mode: "100644",
        type: "blob",
        sha: f.delete ? null : blobShas[i], // sha:null removes the path
      })),
    },
  });

  const commit = await gh(env, `/repos/${repo}/git/commits`, {
    method: "POST",
    body: { message, tree: tree.sha, parents: [baseCommitSha] },
  });

  await gh(env, `/repos/${repo}/git/refs/heads/${branch}`, {
    method: "PATCH",
    body: { sha: commit.sha, force: false },
  });

  return commit.sha;
}

// ─────────────────────────────────────────────────────────────────────────────
// GitHub helpers
// ─────────────────────────────────────────────────────────────────────────────

async function gh(env, apiPath, opts = {}) {
  const res = await fetch(`https://api.github.com${apiPath}`, {
    method: opts.method || "GET",
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "ayso13-field-maps-worker",
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub ${opts.method || "GET"} ${apiPath} → ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

// List a directory's entries. Returns [] if the path doesn't exist yet.
async function ghListDir(env, dirPath) {
  const res = await fetch(
    `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${dirPath}?ref=${env.GITHUB_BRANCH}`,
    {
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "ayso13-field-maps-worker",
      },
    }
  );
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`GitHub list ${dirPath} → ${res.status}`);
  const arr = await res.json();
  return Array.isArray(arr) ? arr : [];
}

// Fetch a text file's content. Returns null on 404.
async function ghGetFileText(env, filePath) {
  const res = await fetch(
    `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${filePath}?ref=${env.GITHUB_BRANCH}`,
    {
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "ayso13-field-maps-worker",
      },
    }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub get ${filePath} → ${res.status}`);
  const data = await res.json();
  if (data.encoding === "base64") {
    return new TextDecoder().decode(bytesFromBase64(data.content.replace(/\n/g, "")));
  }
  return data.content || "";
}

// ─────────────────────────────────────────────────────────────────────────────
// Cloudflare Access JWT verification
// ─────────────────────────────────────────────────────────────────────────────

let jwksCache = { fetchedAt: 0, keys: null, domain: null };
const JWKS_TTL_MS = 60 * 60 * 1000; // 1 hour

async function verifyAccess(request, env, url) {
  // Local dev bypass: `wrangler dev` serves on localhost with no Access in
  // front. Production traffic never has a localhost host.
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    console.warn("Access check bypassed for local dev host:", url.hostname);
    return { ok: true, email: "dev@localhost" };
  }

  const token =
    request.headers.get("Cf-Access-Jwt-Assertion") ||
    getCookie(request, "CF_Authorization");
  if (!token) return { ok: false, status: 401, msg: "No Access token" };

  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, status: 401, msg: "Malformed token" };

  let header, payload;
  try {
    header = JSON.parse(textFromBase64Url(parts[0]));
    payload = JSON.parse(textFromBase64Url(parts[1]));
  } catch (_) {
    return { ok: false, status: 401, msg: "Unparseable token" };
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp) return { ok: false, status: 401, msg: "Token expired" };
  if (payload.nbf && now < payload.nbf - 60) return { ok: false, status: 401, msg: "Token not yet valid" };

  const expectedIss = `https://${env.ACCESS_TEAM_DOMAIN}`;
  if (payload.iss !== expectedIss) return { ok: false, status: 403, msg: "Bad issuer" };

  const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!env.ACCESS_AUD || !auds.includes(env.ACCESS_AUD)) {
    return { ok: false, status: 403, msg: "Bad audience" };
  }

  const jwks = await getJwks(env);
  const jwk = jwks.find((k) => k.kid === header.kid);
  if (!jwk) return { ok: false, status: 403, msg: "Unknown signing key" };

  let key;
  try {
    key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );
  } catch (_) {
    return { ok: false, status: 500, msg: "Key import failed" };
  }

  const signed = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const sig = bytesFromBase64Url(parts[2]);
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, sig, signed);
  if (!valid) return { ok: false, status: 403, msg: "Bad signature" };

  return { ok: true, email: payload.email || null };
}

async function getJwks(env) {
  const domain = env.ACCESS_TEAM_DOMAIN;
  const fresh =
    jwksCache.keys && jwksCache.domain === domain &&
    Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS;
  if (fresh) return jwksCache.keys;

  const res = await fetch(`https://${domain}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error(`JWKS fetch → ${res.status}`);
  const data = await res.json();
  jwksCache = { fetchedAt: Date.now(), keys: data.keys || [], domain };
  return jwksCache.keys;
}

// ─────────────────────────────────────────────────────────────────────────────
// Small utilities
// ─────────────────────────────────────────────────────────────────────────────

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function getCookie(request, name) {
  const cookie = request.headers.get("Cookie") || "";
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? m[1] : null;
}

function num(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function stripDataUrl(s) {
  return String(s).replace(/^data:image\/png;base64,/, "");
}

// Minimal frontmatter reader: pulls simple `key: value` pairs from the leading
// --- … --- block. Sufficient for title / placeLat / placeLon / placeLocality.
function parseFrontmatter(text) {
  if (!text) return {};
  const m = text.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!m) return {};
  const out = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!kv) continue;
    let val = kv[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[kv[1]] = val;
  }
  return out;
}

// base64 / base64url ↔ bytes / text
function bytesFromBase64(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
function bytesFromBase64Url(b64url) {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(b64url.length / 4) * 4, "=");
  return bytesFromBase64(b64);
}
function textFromBase64Url(b64url) {
  return new TextDecoder().decode(bytesFromBase64Url(b64url));
}
