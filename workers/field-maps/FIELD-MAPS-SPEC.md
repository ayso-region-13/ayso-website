# Field Maps — Component Spec (for admin-console migration)

> **Purpose of this doc.** `fields.ayso13.org` is a standalone Cloudflare Worker
> that hosts a field-map authoring tool for AYSO Region 13. This spec describes
> everything the component *does* and *depends on*, so it can be re-hosted inside
> the unified region-operations admin console. It is the source-of-truth contract:
> endpoints, auth, the GitHub commit protocol, the persisted data model, and how
> the public site consumes the output.
>
> Source lives in `workers/field-maps/` of `ayso-region-13/ayso-website`.

---

## 1. What the component is

A single-page app (SPA) where a board member draws soccer-field layouts on top of
Mapbox satellite imagery, then saves. On save, the component:

1. renders a flat PNG of the layout (client-side, deterministic 2D-canvas
   composite — never a live map screenshot), and
2. commits **two files in one atomic Git commit** to the website repo's `staging`
   branch: the PNG and a re-editable annotation JSON.

The public website (an Eleventy static site) reads those files at build time and
renders the map on the relevant `/fields/<slug>/` page. Publishing to production
is a separate, existing "promote" step (`staging` → `main`).

The component is **stateless**. It has no database. All persistent state is files
in the GitHub repo. This is the single most important fact for migration: the
"backend" is GitHub, reached with a write-scoped token.

```
Editor (board member)
   │  draws layout, clicks Save
   ▼
Component API  ── POST /api/map/:slug ──▶  GitHub Git Data API
   │                                         (atomic 2-file commit → staging)
   │                                              │
   │                                              ▼
   │                     site/src/images/fields/<slug>-<variant>.png
   │                     site/src/_data/fieldmaps/<slug>.json
   ▼
(later) Eleventy build reads those files → renders map on /fields/<slug>/
(later) "promote" ships staging → production
```

---

## 2. Trust boundary and auth (critical to preserve)

The API endpoints hold a **GitHub write token**. Anything that can call `/api/*`
can commit to the website repo. So auth is not optional decoration — it is the
only thing standing between the internet and repo write access.

Today the boundary is **Cloudflare Access** (Zero Trust, self-hosted app on the
`fields.ayso13.org` hostname), and the Worker **independently re-verifies the
Access JWT on every request** as defense-in-depth:

- The Worker reads the token from the `Cf-Access-Jwt-Assertion` header (or the
  `CF_Authorization` cookie).
- It validates: RSA signature against the team JWKS
  (`https://<team>.cloudflareaccess.com/cdn-cgi/access/certs`, cached 1h),
  `iss == https://<ACCESS_TEAM_DOMAIN>`, `aud` includes the app's `ACCESS_AUD`,
  and `exp`/`nbf`.
- On success it extracts `payload.email`, which is stamped into commit messages
  and the saved JSON (`updatedBy`) for attribution.
- `localhost` / `127.0.0.1` bypass the JWT check (for `wrangler dev` only).
- The `*.workers.dev` route is disabled (`workers_dev = false`) precisely so the
  Access-gated custom domain is the *only* way in.

**Migration guidance.** When this moves into the admin console, the boundary
changes but the invariant must not: *no unauthenticated caller may reach the
GitHub-committing endpoints.* Whatever the console's session/auth model is, the
save/delete endpoints must sit behind it, and the GitHub token must never be
exposed to the browser. Preserve the "verify on every request" posture rather
than trusting an upstream proxy alone. Keep an authenticated user identity
(email or equivalent) available to stamp commits.

---

## 3. HTTP API (the full contract)

Base: same-origin. All responses are JSON with `Cache-Control: no-store` except
the image proxy. `:slug` matches `^[a-z0-9][a-z0-9-]*$`; `variant` matches
`^[a-z0-9-]+$`.

### `GET /api/config`
Returns the config the SPA needs to boot. Only returned after auth passes.
```json
{ "mapboxToken": "pk....", "repo": "ayso-region-13/ayso-website",
  "branch": "staging", "editor": "person@example.org" }
```
- `mapboxToken` — a **URL-restricted public Mapbox token**, delivered here (not
  embedded in HTML) so it is only handed to authenticated users.
- `editor` — authenticated user's email (or `null`).

### `GET /api/fields`
Lists every mappable field, read live from repo frontmatter (so the picker is
always current, independent of the last site build). Response is an array sorted
by title:
```json
[{ "slug": "victory", "title": "Victory Park", "lat": 34.18, "lon": -118.11,
   "locality": "Pasadena", "hasMap": true,
   "address": "...", "postalCode": "...",
   "parking": "...", "restrooms": "...", "surface": "...",
   "lighting": "...", "snackBar": "..." }]
```
- Source: lists `site/src/fields/*.md` (excluding `index.md`, `goals.md`),
  parses each file's YAML frontmatter, and **drops any field without both
  `placeLat` and `placeLon`** (not a mappable location).
- `hasMap` = a `site/src/_data/fieldmaps/<slug>.json` exists.
- The `address`/`parking`/… fields feed the PDF export's info pages.

### `GET /api/map/:slug`
Returns the saved annotation JSON (the doc in §4) for re-editing, or `404` if no
map has been saved for that slug.

### `POST /api/map/:slug`
Saves/updates one **variant** (layout) of a field. Request body:
```json
{ "variant": "game",
  "pngBase64": "iVBORw0KGgo... (data: URL prefix tolerated)",
  "annotation": { "styleVersion": "...", "label": "...", "view": {...},
                  "elements": [...], "alt": "..." } }
```
Validation: `variant` matches the charset; `annotation` must be an object
carrying `elements` (or legacy `features`); `pngBase64` required.

Behavior — **read-merge-write** so a `practice` save never clobbers an existing
`game` layout (all variants of a field live in one JSON doc):
1. Fetch the existing `<slug>.json` (if any), parse it (corrupt → start fresh).
2. Set `doc.variants[variant] = { label, view, elements, png, alt, updatedBy }`.
3. Commit both files atomically (see §5):
   - `site/src/images/fields/<slug>-<variant>.png` (base64)
   - `site/src/_data/fieldmaps/<slug>.json` (pretty-printed UTF-8, trailing `\n`)

Response:
```json
{ "ok": true, "commit": "<sha>", "png": "/images/fields/victory-game.png",
  "json": "site/src/_data/fieldmaps/victory.json", "branch": "staging" }
```

### `DELETE /api/map/:slug?variant=<v>`
Removes one variant: deletes its entry from the doc and deletes its PNG. If it was
the **last** variant, the whole `<slug>.json` is deleted too. Returns
`{ ok, commit, remaining, branch }`. (Deletes use the Contents API, not the tree
`sha:null` path — see §5 note.)

### `GET /api/img/:slug/:variant`
Same-origin proxy that streams a committed PNG from the repo's raw host
(`raw.githubusercontent.com/<repo>/<branch>/site/src/images/fields/<slug>-<variant>.png`),
cached 5 min. Exists so the in-browser PDF builder can read image bytes without a
CORS dance and without the Contents-API 1 MB cap. `404` if the image isn't there.

---

## 4. Persisted data model (`_data/fieldmaps/<slug>.json`)

One file per field. All layouts (variants) of that field share the file:
```jsonc
{
  "field": "victory",
  "styleVersion": "satellite-v9",
  "variants": {
    "game": {
      "label": "Game Day Layout",
      "view": { "center": [lng, lat], "zoom": 18.5, "bearing": 0,
                "frameMeters": 170, "width": 1000, "height": 750, "scale": 2 },
      "elements": [ /* see below */ ],
      "png": "/images/fields/victory-game.png",
      "alt": "victory game field map",
      "updatedBy": "person@example.org"
    },
    "practice": { "...": "same shape" }
  }
}
```

- **`view`** is the exact framing used to render the deterministic export: map
  center, Mapbox zoom, output pixel size, and `scale` (retina factor). Re-render
  fidelity depends on this being preserved verbatim.
- **`variant` keys are semantic** and drive the heading shown on the site
  (`game` → "Game Day Layout", `practice` → "Practice Layout", `wayfinder`, or
  any other → title-cased "<Variant> Layout"). The `complexes` collection shares
  one field's `wayfinder` variant across a group of fields (FIS / Muir HS / Rose
  Bowl / Blair).
- **`png` path convention**: stored site-absolute (`/images/fields/...`); the
  real repo path is `site/src/images/fields/...`.

### `elements[]` — the re-editable layout model

Coordinates are `[lng, lat]` (GeoJSON order). Field-scale geometry uses a local
equirectangular approximation (accurate at tens–hundreds of metres). The pure,
DOM-free, Node-testable geometry lives in `public/geo.js` and should be ported
as-is. Element kinds observed:

| `kind` | Meaning | Key fields |
|---|---|---|
| `field` | A soccer pitch: rotated rectangle. HOME/AWAY sidelines auto-derived (HOME = north, or west if N–S). Pitch markings (halfway, center circle, goals) generated. | `center`, `widthM`, `lengthM`, `rotationDeg`, `name`, `ageGroup` |
| `grid` | A field subdivided into `cols`×`rows` labeled cells (practice). | `center`, `widthM`, `lengthM`, `rotationDeg`, `cols`, `rows`, label `scheme` (`numbers`/`letters`), `startIndex` |
| `fan` | Annular sector (baseball-style outfield split L/C/R). | `center`, `innerRadiusM`, `radiusM`, `startDeg`, `sweepDeg`, `wedges`, `scheme`, `startIndex` |
| `line` | Free polyline. | vertices |
| `text` | A placed word/label. | `center`, text |
| `marker` | Point icon: `goal` / `restroom` / `parking` / `host tent` / `picture-day check-in`. | `center`, `type` |

Each element carries an `id` and may carry `locked`. `geo.js` exports the math:
`rectRing`, `homeAway`, `gridCells`, `fanCells`, `fieldMarkings`, `projector`
(Web-Mercator matching Mapbox Static Images 512px tiles), `zoomForGroundWidth`,
etc. **The export projector must match Mapbox's tiling exactly** or annotations
drift off the satellite base.

---

## 5. GitHub commit protocol

Writes use the **Git Data API** (`ref → blob(s) → tree → commit → advance ref`)
so an arbitrary set of files commits atomically in one commit, with no per-file
SHA bookkeeping and identical handling for create vs update:

1. `GET /repos/:repo/git/ref/heads/:branch` → base commit SHA.
2. `GET /repos/:repo/git/commits/:sha` → base tree SHA.
3. `POST /repos/:repo/git/blobs` for each file (base64 for PNG, utf-8 for JSON).
4. `POST /repos/:repo/git/trees` with `base_tree` + entries (`mode 100644`,
   `type blob`).
5. `POST /repos/:repo/git/commits` with the new tree + base commit as parent.
6. `PATCH /repos/:repo/git/refs/heads/:branch` with `force: false`.

Reads use the Contents API (`GET /repos/:repo/contents/<path>?ref=<branch>`);
directory listing returns `[]` on 404, file fetch returns `null` on 404.

> **Deletion note (do not regress).** Deletes go through the **Contents API**
> (`DELETE /repos/:repo/contents/<path>` with the file's current `sha`), *not*
> the Git-Data tree `sha:null` trick — the latter returned 500s in practice.

**Token**: a GitHub **fine-grained PAT scoped to only `ayso-region-13/ayso-website`
with Contents: Read & Write**. Requests set `Authorization: Bearer`, `Accept:
application/vnd.github+json`, `X-GitHub-Api-Version: 2022-11-28`, and a
`User-Agent`. The branch is **`staging` only, never `main`** — production changes
always go through the separate promote flow.

---

## 6. How the site consumes the output (downstream contract)

The admin console only needs to keep *producing the same two files*; the website
already knows how to render them. For completeness:

- Eleventy namespaces `site/src/_data/fieldmaps/` as the global `fieldmaps`,
  keyed by filename, so `fieldmaps[slug]` is that field's doc.
- `_includes/page.njk` renders a "Field Maps" block on `/fields/<slug>/` from the
  field's own `game`/`practice` variants, plus a shared complex wayfinder.
- The `complexes` collection (`.eleventy.js`) reads the first member's
  `wayfinder` variant to share one wayfinder across a group.
- `/fields/` index hero: rendered from `fieldmaps.overview` (slug `overview`,
  variant `map`) when `overviewMap.ready` (i.e. `overview-map.png` exists),
  else falls back to a legacy static image.
- Migration cleanup step: when a field's first real map lands, the old
  hand-placed `![](/images/fields/…)` markdown is removed from that field's `.md`
  so the map isn't shown twice. (Manual today.)

The **Region Overview** map is a special editor mode (`?overview=1`): a streets
(not satellite) base with one draggable pin per field, seeded by
`scripts/seed-overview.js` from field frontmatter + the `/fields/` index table.
Re-run the seed + commit whenever fields are added/removed.

---

## 7. Config, secrets, and infra dependencies

| Kind | Name | Notes |
|---|---|---|
| var | `ACCESS_TEAM_DOMAIN` | `ayso13.cloudflareaccess.com` (JWT issuer). |
| var | `ACCESS_AUD` | Access application AUD tag. Non-secret; security is signature verification. |
| var | `GITHUB_REPO` | `ayso-region-13/ayso-website`. |
| var | `GITHUB_BRANCH` | `staging`. |
| secret | `MAPBOX_TOKEN_PUBLIC` | Public `pk.…` token, URL-restricted to `fields.ayso13.org/*`. Kept secret (repo is public) and delivered only via `/api/config`. |
| secret | `GITHUB_TOKEN` | Fine-grained PAT, single repo, Contents R/W. |

External dependencies the console inherits:
- **Mapbox** — GL JS + Static Images API (client), telemetry to `events.mapbox.com`.
  The editor CSP allows `api.mapbox.com`, `events.mapbox.com`, `cdn.jsdelivr.net`
  (pdf-lib), and `blob:` workers — Mapbox GL needs blob web workers. Note the
  deliberate `Referrer-Policy: strict-origin-when-cross-origin` so Mapbox's
  URL-restricted token still sees a Referer (`same-origin` would strip it → 403
  on tiles).
- **GitHub API** — the entire persistence layer.
- **Cloudflare Access** — current auth boundary (replaceable by console auth,
  §2).

Front-end assets to port: `public/index.html`, `style.css`, `app.js` (Mapbox GL
authoring + canvas export, ~74 KB), `geo.js` (pure geometry, port unchanged and
keep its Node unit tests), `pdf.js` (client-side pdf-lib PDF export).

---

## 8. Migration checklist (minimum viable port)

1. **Auth** — put the four endpoints behind the console's auth; keep an
   authenticated identity for commit attribution; never expose `GITHUB_TOKEN` to
   the browser. (§2)
2. **Endpoints** — reimplement `GET /api/config`, `GET /api/fields`,
   `GET|POST|DELETE /api/map/:slug`, `GET /api/img/:slug/:variant` with the exact
   request/response shapes in §3.
3. **GitHub protocol** — port the Git-Data atomic commit + Contents-API delete
   exactly, including the deletion note in §5. Keep `staging`-only.
4. **Data model** — do not change `_data/fieldmaps/<slug>.json` shape or the PNG
   path convention; the live site depends on both (§4, §6).
5. **Geometry** — port `geo.js` verbatim (projector must match Mapbox tiling) and
   keep its tests.
6. **Front-end** — port the SPA; preserve the Mapbox CSP + Referrer-Policy
   nuances (§7).
7. **Secrets/vars** — carry `MAPBOX_TOKEN_PUBLIC` + `GITHUB_TOKEN` as secrets and
   the four config vars.
8. **Verify end-to-end**: save a `game` variant → confirm one atomic commit lands
   on `staging` with correct PNG + merged JSON → confirm the site build renders it
   → delete the variant → confirm files removed.

---

## 9. Changing the backend / DB

### 9.1 The one constraint that governs everything: the site reads from disk, at build time

The website is a **static Eleventy build**. It does not call any API to get maps.
It reads them off the filesystem of the repo checkout while building. There are
**four** distinct coupling points, all synchronous and all at build time:

1. **`fieldmaps` global** — Eleventy auto-loads every `site/src/_data/fieldmaps/*.json`
   into a global keyed by filename. `page.njk` reads `fieldmaps[page.fileSlug]`
   (a field's own map) and `fieldmaps.overview.variants.map` (the index hero).
2. **`complexes` collection** (`.eleventy.js`) — at build it does
   `fs.readFileSync("src/_data/fieldmaps/<member>.json")` for each complex member
   to find a shared `wayfinder` variant. Synchronous file read, wrapped in
   try/catch (missing file = no wayfinder).
3. **`overviewMap.ready`** (`_data/overviewMap.js`) — `fs.existsSync(".../images/fields/overview-map.png")`
   gates whether the `/fields/` hero renders the editor overview or the legacy image.
4. **The PNG files themselves** — referenced by their site-absolute `png` path and
   **processed by `eleventy-img` at build** into responsive WebP. The bytes must
   physically exist in `site/src/images/fields/` when `npm run build` runs, or the
   image pipeline fails / the `<img>` 404s.

**Therefore:** whatever the new backend is, the deploy pipeline must **materialize
two things onto the build checkout before Eleventy runs**: (a) one
`_data/fieldmaps/<slug>.json` per field (shape in §4), and (b) the PNG bytes at
`site/src/images/fields/<slug>-<variant>.png`. Get that right and **zero
template/site code changes are needed** — the render layer is agnostic to how the
files got there.

A pure runtime API (site fetches maps in the browser) is **not** a drop-in: it
skips `eleventy-img` (no responsive WebP), breaks the `complexes` build-time read,
and changes the lightbox/markup. Don't go there unless you're willing to rewrite
the render layer.

### 9.2 Options, from least to most invasive

**Option A — Keep git as the datastore (recommended default).**
The console's field-maps module just reimplements the §3 API and the §5 commit
protocol against the same repo/branch. Nothing downstream changes. You inherit:
one atomic commit per save, the promote flow unchanged, full history/rollback for
free, and no new infra. Cost: writes are GitHub API round-trips (fine at this
volume — a handful of saves), and "state" is spread across commits rather than
queryable. This is the lowest-risk port and the right choice unless the console
has a concrete reason to own the data.

**Option B — DB for metadata, repo for artifacts (hybrid).**
Store the editable model (`elements[]`, `view`, labels, `updatedBy`, audit trail)
in the console DB — that's what benefits from querying ("which fields lack a game
map", "show edits by user", soft-delete/versioning). On **save**, still write the
JSON + PNG to the repo (Option-A commit), treating the repo as a materialized
publish target derived from the DB. `GET /api/map/:slug` and `/api/fields` now read
the DB (faster, richer) instead of parsing repo frontmatter. Cost: two sources of
truth to keep consistent; define the DB as authoritative and the repo as a
derived artifact so drift resolves one way.

**Option C — DB is the source of truth; export step in CI (most decoupled).**
The console owns everything in its DB; the repo no longer receives per-save
commits. A **build-time export** (a script in the site's deploy workflow, before
`npm run build`) pulls all field maps from the console API and writes the
`_data/fieldmaps/*.json` + `images/fields/*.png` into the checkout. Options for
wiring: (i) the export commits to `staging` on a schedule / on-publish webhook
(keeps the current git-triggered deploy), or (ii) the deploy workflow calls the
export inline and the generated files are ephemeral (never committed). Cost: a new
sync surface and a new failure mode (build depends on the console API being up);
you lose the "map change = git commit = auto-deploy" trigger and must replace it
with a webhook or scheduled promote. Best only if the console genuinely needs to be
the system of record (e.g. maps edited alongside other DB-backed ops data).

### 9.3 Recommended architecture: DB owns the data, repo is a published projection

This is the chosen direction. The console DB is the **source of truth** for
structured field data and maps. On every change the console **writes derived files
into the repo** so the website picks them up on its next build. The sync is
**one-directional (DB → repo)**, which is what makes "the data lives in two places"
safe: the repo copy is *output*, like a compiled artifact — nobody hand-edits it as
a source of truth, so there is no two-writer conflict.

**Ownership is split within each field, deliberately:**

| Data | Owner (source of truth) | Editor surface | Written to repo as |
|---|---|---|---|
| Field identity: `title`, `placeAddress`, `placeLocality`, `placePostalCode`, `placeLat`, `placeLon`, `description` | **Console DB** | Console UI | field `.md` **frontmatter** (owned keys only) |
| Facility attributes: `parking`, `restrooms`, `surface`, `lighting`, `snackBar` | **Console DB** | Console UI | field `.md` **frontmatter** (owned keys only) |
| **Subfields & practice configuration** (new — see §9.5) | **Console DB** | Console UI | (optional) a data file; drives scheduling regardless |
| Map layouts (`variants{}`: `view`, `elements`, PNG) | **Console DB** | Map editor (this component) | `_data/fieldmaps/<slug>.json` + PNG (unchanged, §4) |
| Prose body: field-config prose, goal-setup steps, contacts, tent info, etc. | **Humans** | Pages CMS (unchanged) | field `.md` **markdown body** (never touched by the console) |
| Site plumbing: `layout`, `section`, `permalink` | Site repo | code | field `.md` frontmatter (never touched by the console) |

The scope is exactly what you asked for: the console owns **address / geo /
attributes** (plus maps and the new structural data). It does **not** own the
prose. `layout`/`section` stay code-owned.

### 9.4 DB schema (mirror the structure; don't flatten it)

- **`fields`** — `slug` (PK), `title`, `lat`, `lon`, `locality`, `address`,
  `postal_code`, `description`, facility attrs
  (`parking`/`restrooms`/`surface`/`lighting`/`snack_bar`), `updated_by`,
  `updated_at`. This is the authoritative copy of the frontmatter fields above.
- **`subfields`** — the schedulable playing areas within a field (see §9.5).
  `id` (PK), `field_slug` (FK), `label` (e.g. "Field 4"), `division`/`age_group`
  (e.g. "12U"), `goal_size`, `surface`, `notes`, `active`, **plus parametric
  geometry** (`center_lng`, `center_lat`, `width_m`, `length_m`, `rotation_deg`)
  since the DB owns geometry and the map is generated from it (§9.5). One row per
  playable subfield.
- **`practice_configs`** / **`practice_slots`** — how a field is subdivided for
  practice. A config = a scheme + its geometry: kind `grid`
  (`center_lng`/`center_lat`, `width_m`, `length_m`, `rotation_deg`, `cols`,
  `rows`, label `scheme`, `start_index`) or kind `fan` (`center`, `inner_radius_m`,
  `radius_m`, `start_deg`, `sweep_deg`, `wedges`, `scheme`), optionally attached to
  a subfield. Each derived cell/wedge is a `practice_slot` (`label`,
  `capacity`/age guidance, `active`). These are the discrete bookable units
  scheduling consumes, and the same parameters `geo.js` uses to render.
- **`field_maps`** — `(field_slug, variant)` composite key; columns `label`,
  `view` (JSON), `elements` (JSON), `alt`, `png_ref`, `updated_by`, `updated_at`.
  One row ≈ one entry in `variants{}`. Keep `view`/`elements` as opaque JSON blobs
  — they feed the editor + the deterministic renderer; normalizing per-drawing-
  element buys nothing and risks projector drift.
  - Store PNG bytes in object storage (R2/S3); `png_ref` points to it.
  - `overview` is just `field_slug = "overview"`, variant `map` — no special case.

### 9.5 Subfields & practice config — the reason for the DB, and how they relate to the map

Today this data exists in two lossy forms only: (a) as **drawing geometry** inside
`field_maps.elements` — a `field` element carries `name` + `ageGroup`, a `grid`
element carries `cols`×`rows` labeled cells, a `fan` element carries L/C/R wedges;
and (b) as **hand-written prose** in the field body (e.g. `victory.md`'s "Field
Configuration" table: Fields 1–8 with divisions and goal sizes). Neither is
queryable, so scheduling can't use it.

**Promote it to first-class DB entities** (`subfields`, `practice_configs`,
`practice_slots` above). Then:

- **Scheduling** reads structured rows — "Victory has subfields F1–F8; F4 is 12U;
  Allendale's practice grid has 6 slots" — with no map parsing.

**Decision (settled): the DB owns subfield geometry, and the map is generated from
it.** The structural map elements (`field` / `grid` / `fan`) are **derived output**
of DB rows, not hand-authored drawings. The DB holds the parametric geometry that
`geo.js` already consumes, so the deterministic renderer is driven straight from
DB rows.

**Store the geometry parametrically on the DB entities** (this is exactly what
`geo.js` takes as input, §4):
- `subfields` (kind `field`): `center` (`lng`/`lat`), `width_m`, `length_m`,
  `rotation_deg`, plus `label`/`division`/`goal_size`.
- `practice_configs` (kind `grid`): `center`, `width_m`, `length_m`,
  `rotation_deg`, `cols`, `rows`, label `scheme`, `start_index`. (kind `fan`:
  `center`, `inner_radius_m`, `radius_m`, `start_deg`, `sweep_deg`, `wedges`,
  `scheme`.) Each derived cell/wedge is a `practice_slot` row.

**Two classes of map element, going forward:**
1. **DB-derived (structural):** `field`, `grid`, `fan`. Generated from DB rows at
   render time; each carries its `subfieldId` / `configId` so the shape ↔ row link
   is explicit and re-derivable. These are *not* authored in the map JSON.
2. **Editor-authored (decorative / wayfinding):** `marker`, `text`, `line`, plus the
   `view` framing. These have no scheduling meaning and stay authored in the map
   editor, persisted on the `field_maps` record.

**The map editor becomes a DB-editing surface, not a repo-editing surface.** Drawing
still happens there (it's the natural way to place a rectangle on satellite), but on
save it **upserts geometry into the DB** rather than freezing it into a repo file.
Concretely, save now:
1. Upserts structural shapes → `subfields` / `practice_configs` / `practice_slots`
   (with parametric geometry + labels/ages), keyed by their stable ids.
2. Persists decorative elements + `view` on the `field_maps` record.
3. **Regenerates** the full repo artifact: compose `elements[]` = (DB structural
   rows rendered via `geo.js`) + (stored decorative elements), render the PNG
   deterministically, and commit the §4-shaped JSON + PNG to `staging` (§5).

This keeps the one-directional rule intact — the DB is the single source, the repo
is generated output — and it means editing a subfield's dimensions or age group in
the console's **data** UI (not the map) will, on the next regeneration, update the
committed map too. Geometry can never drift from the schedulable record because
there is only one copy of it.

> **Regeneration triggers.** Any DB change that affects a field's structural
> geometry, labels, or ages should mark that field's map(s) stale and regenerate +
> recommit the PNG/JSON. Batch these (debounce) so a burst of edits produces one
> commit, mirroring the site's existing 45s CMS-deploy debounce.

> **Repo JSON note.** The site render (§6) uses only `variants[].png` / `alt` /
> `label`, never `elements`. So `elements[]` in the committed JSON is now purely a
> generated snapshot (kept for shape-compatibility and human-readable diffs); the
> editor loads its re-editable state from the **DB**, not from the repo JSON.

**Optional site win (not required now):** once subfields live in the DB, the
console can also emit them to a data file (e.g. extend `_data/fieldmaps/<slug>.json`
or add `_data/fields/<slug>.json`) and the site could render the "Field
Configuration" table from data instead of the hand-typed prose in each `.md`. That
removes a class of stale-content drift, but it's a site-render change — defer until
the DB is the source of truth.

### 9.6 Write-back contract for field frontmatter (surgical, non-destructive)

Because the field `.md` files hold human prose in the body, the console must **not**
overwrite the file. On sync it does a read-merge-write, mirroring how the map
component already merges variants into one JSON:

1. Fetch the current `site/src/fields/<slug>.md` (Contents API).
2. Parse the leading `--- … ---` frontmatter block.
3. **Overwrite only the console-owned keys** (the identity + facility attrs in
   §9.3). Leave every other key (`layout`, `section`, `permalink`, anything future)
   and the **entire markdown body** byte-for-byte untouched.
4. Re-serialize and commit to `staging` via the §5 atomic-commit protocol
   (batch the `.md` + the map JSON/PNG into one commit when they change together).

Use a real YAML serializer for step 3 — do not string-patch. Preserve key order
where practical to keep diffs readable and CMS-friendly.

**Enforce the ownership split in the CMS.** Pages CMS already hides
`layout`/`section`/`permalink` from editors (per the site's `.pages.yml`). Extend
that to **hide the console-owned frontmatter fields** (title, address, geo, facility
attrs) so editors can no longer change them in the CMS — only the prose body and any
non-owned fields remain editable there. This removes the last two-writer path: after
the change, each part of a field file has exactly one editor.

### 9.7 What must not change regardless of option

- The **`_data/fieldmaps/<slug>.json` shape** and the **`/images/fields/<slug>-<variant>.png`
  path convention** (§4) — the render layer is hard-coded to them.
- The **field `.md` frontmatter keys** the site reads (`title`, `placeLat/Lon`,
  facility attrs, `description`) and **`schema-org.njk`'s** dependence on
  `placeLat`/`placeLon` for `Place` geo — the console must keep writing these.
- The **markdown body is human-owned** — the console writes frontmatter only (§9.6).
- **`staging`-only writes**; production via the existing promote flow.
- The **variant vocabulary** (`game`, `practice`, `wayfinder`, + free-form) — it
  drives headings and the complex-wayfinder sharing.
- The **deterministic export** (Static Images base + canvas re-draw via `geo.js`),
  so a re-render from stored `elements` reproduces the committed PNG.
- The **auth boundary in front of any repo-writing / DB-writing endpoint** (§2).
- The **DB → repo sync stays one-directional** — the repo is derived output, never
  a write-back source, so there is no reconciliation problem.

### 9.8 Initial data migration (seed the DB from what already exists)

You do not start from a blank slate or re-draw anything. The structural geometry
already exists in the 24 committed `site/src/_data/fieldmaps/*.json` files
(`elements[]`) and the identity/attrs exist in the 24 `site/src/fields/*.md`
frontmatters. A one-time, idempotent extraction seeds the DB:

**Sources → tables:**
- `site/src/fields/*.md` frontmatter → **`fields`** (`title`, `placeAddress` →
  `address`, `placeLocality` → `locality`, `placePostalCode` → `postal_code`,
  `placeLat`/`placeLon` → `lat`/`lon`, `description`, and
  `parking`/`restrooms`/`surface`/`lighting`/`snackBar` → facility attrs). Slug =
  filename without `.md`. Skip `index.md` and `goals.md` (matches the current
  `/api/fields` filter).
- `_data/fieldmaps/<slug>.json` `elements[]`, by `kind`:
  - `kind: "field"` → **`subfields`** row: map `center`/`widthM`/`lengthM`/
    `rotationDeg` → geometry columns; `name` → `label`; `ageGroup` → `division`.
  - `kind: "grid"` → **`practice_configs`** (grid) + one **`practice_slot`** per
    cell (use `geo.js` `gridCells` + `cellLabel` to reproduce the labels
    deterministically from `cols`/`rows`/`scheme`/`startIndex`).
  - `kind: "fan"` → **`practice_configs`** (fan) + one slot per wedge (`fanCells`
    + `lcrLabel`).
  - `kind: "marker" | "text" | "line"` → **decorative**: keep on the `field_maps`
    record (these are not subfields; they stay editor-authored, §9.5).
  - The `view` object and per-variant `label`/`alt`/`png` → the `field_maps` row.
- `overview.json` → a `field_maps` row for `field_slug = "overview"`; its `place`
  pins are decorative, not subfields.

**Cross-check the extraction against the prose.** Several field bodies already
describe their subfields in a "Field Configuration" table (e.g. `victory.md`:
Fields 1–8 with divisions and goal sizes). Use these to **validate and enrich** the
extracted `subfields` — the prose often has `goal_size` and division detail the map
element's `ageGroup` lacks. This is a manual QA pass, not an automated parse (the
tables are free-form). Flag mismatches (a subfield in the map with no prose row, or
vice-versa) for a human to reconcile.

**Properties of the migration script:**
- **Idempotent** — keyed on `(field_slug, subfield/config id)` so re-running
  upserts rather than duplicates. Give each extracted structural element a stable
  id derived from the source (e.g. reuse the element's existing `id`, or
  `<slug>:<kind>:<n>`), so the map ↔ DB link (§9.5) is populated from day one.
- **Read-only against the repo** — it only reads the committed files; it does not
  write back. First real write-back happens later, through the normal regenerate
  path, so you can diff the regenerated artifact against the current committed one
  to prove the round-trip is lossless before cutting over.
- **Validated before cutover**: for each field, regenerate `elements[]` + PNG from
  the freshly-seeded DB and compare to the committed artifact. Structural elements
  should reproduce (the geometry is the same parameters through the same `geo.js`);
  differences should be only decorative ordering or the generated snapshot. Only
  flip the console to authoritative once the diff is clean.

Run order: seed `fields` first (FK target), then `subfields`, then
`practice_configs`/`practice_slots`, then `field_maps` (decorative + view). Keep the
script in the console repo, not this one; it reads this repo as input.

---

*Derived from `workers/field-maps/` (src/index.js, wrangler.toml, public/geo.js,
README.md) and the site's `page.njk` + `.eleventy.js` (`complexes`), `_data/overviewMap.js`
as of 2026-07-10.*
