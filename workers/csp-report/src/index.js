// AYSO Region 13 CSP violation report collector.
//
// Mounted on www.ayso13.org/api/csp-report (and staging). Endpoints:
//
//   POST /api/csp-report
//     Browsers POST violation reports here (matches the CSP `report-uri`
//     directive in site/src/_headers.njk). Each report is stored in KV
//     under a timestamp-keyed entry with 30-day TTL. Returns 204.
//
//   GET /api/csp-report?admin_key=<secret>&limit=100
//     Admin view of recent reports (newest first), JSON. The secret
//     comes from the ADMIN_KEY wrangler secret. limit defaults to 100,
//     max 1000.
//
// Storage: KV namespace CSP_REPORTS, keyed by ISO timestamp + 8-char
// random id. Reports auto-expire after 30 days so KV doesn't grow
// unbounded. If we need longer retention later, swap to durable
// storage (R2 or D1).
//
// Why this Worker: the production CSP includes a report-uri directive
// pointing here. Without a Worker to collect them, browsers send the
// reports into the void (only visible to the user's devtools). With
// this Worker, we get centralized visibility into what the policy
// would block in production — useful both for the initial enforce
// switch (to catch breakage we missed in the static audit) and for
// future policy tightening (e.g., removing 'unsafe-inline').

const MAX_BODY_BYTES = 32 * 1024;     // reject >32KB reports as junk
const REPORT_TTL_SECS = 60 * 60 * 24 * 30; // 30 days
const DEFAULT_LIST_LIMIT = 100;
const MAX_LIST_LIMIT = 1000;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "POST") {
      return handleReport(request, env);
    }

    if (request.method === "GET") {
      return handleList(url, env);
    }

    return new Response("Method not allowed", { status: 405 });
  },
};

async function handleReport(request, env) {
  // Reject oversized bodies up front — common abuse pattern.
  const lengthHeader = request.headers.get("content-length");
  if (lengthHeader && Number(lengthHeader) > MAX_BODY_BYTES) {
    return new Response(null, { status: 204 }); // silently drop, don't reveal limit
  }

  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) return new Response(null, { status: 204 });

  let parsed = null;
  try {
    parsed = JSON.parse(body);
  } catch (_) {
    // Some browsers POST as text/plain or with weird quoting; keep raw.
  }

  const reportedAt = new Date().toISOString();
  const id = crypto.randomUUID().slice(0, 8);
  const key = `${reportedAt}-${id}`;

  const entry = {
    reportedAt,
    userAgent: request.headers.get("user-agent") || "",
    referer:   request.headers.get("referer") || "",
    contentType: request.headers.get("content-type") || "",
    cfRay:     request.headers.get("cf-ray") || "",
    country:   request.cf?.country || "",
    report: parsed ?? body,
  };

  await env.CSP_REPORTS.put(key, JSON.stringify(entry), {
    expirationTtl: REPORT_TTL_SECS,
  });

  // Log to the Worker output (visible via `wrangler tail`) so we can
  // see incoming reports live during the soak window.
  console.log("CSP violation:", JSON.stringify(entry));

  return new Response(null, { status: 204 });
}

async function handleList(url, env) {
  const adminKey = url.searchParams.get("admin_key");
  if (!env.ADMIN_KEY || adminKey !== env.ADMIN_KEY) {
    return new Response("Forbidden", { status: 403 });
  }

  const requestedLimit = Number(url.searchParams.get("limit")) || DEFAULT_LIST_LIMIT;
  const limit = Math.min(Math.max(requestedLimit, 1), MAX_LIST_LIMIT);

  // KV list keys are sorted ascending; we want newest first.
  const listing = await env.CSP_REPORTS.list({ limit });
  const keys = listing.keys.map(k => k.name).sort().reverse();

  const reports = await Promise.all(
    keys.map(name => env.CSP_REPORTS.get(name, { type: "json" }))
  );

  return new Response(JSON.stringify({
    count: reports.length,
    list_complete: listing.list_complete,
    reports,
  }, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
}
