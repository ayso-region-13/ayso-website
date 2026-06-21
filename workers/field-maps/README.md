# field-maps Worker — AYSO Region 13

A Cloudflare Worker that serves the **field-map editor** (a single-page app) at
`https://fields.ayso13.org`, gated by **Cloudflare Access**. Board members draw
field layouts over Mapbox satellite imagery; the Worker commits the rendered PNG
plus a re-editable annotation JSON to the **`staging`** branch. The site's
`page.njk` then renders the map on the field page automatically.

```
Board member ─(CF Access OTP)─▶ fields.ayso13.org (this Worker)
  Mapbox GL editor (draw)            ├─ GET  /api/config        mapbox token + repo/branch
        │                            ├─ GET  /api/fields        field list (from repo frontmatter)
        ▼                            ├─ GET  /api/map/:slug      saved annotation (re-edit)
  Static Images base + 2D-canvas     └─ POST /api/map/:slug      commit PNG + JSON → staging
  composite → PNG ────────────────────────────────▶ GitHub Git Data API (atomic 2-file commit)
                                                            │  CF Pages rebuilds staging
                                                            ▼  /ayso promote → production
                          site/src/_data/fieldmaps/<slug>.json + images/fields/<slug>-<variant>.png
```

## How a map flows to the live site
1. Editor saves → one commit on `staging` with the PNG and `_data/fieldmaps/<slug>.json`.
2. Cloudflare Pages rebuilds `staging.ayso13.org`; `page.njk` renders the map in a
   "Field Maps" block on `/fields/<slug>/` (eleventy-img makes WebP variants).
3. Promote to production as usual (`/ayso promote`) to publish to `www.ayso13.org`.
4. Migration: when a field's new map lands, delete the old hand-made
   `![](/images/fields/…)` markdown from that field's `.md` so it isn't shown twice.

## Editor extras

### Unified PDF export ("📄 PDF")
Builds one printable PDF (cover → Region Overview → per field: an info+map front page, then one full page per layout, ordered wayfinder→game→practice) entirely **client-side with pdf-lib** (CDN, SRI'd) — no Worker memory/size limits. Pulls each committed map image through a same-origin proxy `GET /api/img/:slug/:variant` (streams the PNG from the public repo's raw host on the editor branch — avoids the Contents API 1 MB cap + CORS); downscales to JPEG so the file stays ~10 MB. `/api/fields` returns the field address + facility frontmatter for the info pages. Code in `public/pdf.js`. Every page footered with brand (left) / page URL (center) / page number (right). For internal use (Access-gated).

### Region Overview map ("🗺 Region Overview", `?overview=1`)
The `/fields/` index hero is editor-generated too. Loads slug `overview` on a **streets** base (not satellite) at ~16 km frame, with one draggable `place` pin per field (green=game, red=practice; auto-laid-out from each field's `placeLat`/`placeLon`, with leader lines). Seeded by `scripts/seed-overview.js` (reads field frontmatter + the `/fields/` index table's Practice/Games columns; preserves manual pin nudges on re-run) → `_data/fieldmaps/overview.json`. Save commits `images/fields/overview-map.png`. Site render: `page.njk` shows the overview on `/fields/` once the PNG exists (`_data/overviewMap.js` `.ready` flag), else falls back to the legacy `map-overview-v2.jpg`. Re-run the seed script + commit whenever fields are added/removed.

## One-time setup

### 1. Mapbox account + URL-restricted public token
- Create a free account at mapbox.com. Free tier covers ~50k Static Images
  requests/month; this tool uses a handful.
- Create a **public** token (`pk.…`) and add a **URL restriction** for
  `https://fields.ayso13.org/*`. This token is used client-side (GL tiles +
  Static Images API); the URL restriction + the Access gate are its protection.
- This repo is **public**, so store it as a **secret**, not a committed var
  (a URL restriction is spoofable by non-browser clients). The editor receives
  it via `GET /api/config` only after Access authenticates the request:
  ```
  wrangler secret put MAPBOX_TOKEN_PUBLIC
  ```

### 2. Cloudflare Access application (Zero Trust)
- Zero Trust → Access → Applications → **Add a self-hosted application**.
  - Application domain: `fields.ayso13.org`
  - Policy: **Allow**, include the board members' emails (or an email-domain rule).
  - Identity: the built-in **One-time PIN** is enough (no IdP needed).
  - Session duration: pick something generous (e.g. 24h) to avoid re-OTP.
- After creating it, copy two values into `wrangler.toml` `[vars]`:
  - `ACCESS_TEAM_DOMAIN` — your team domain, e.g. `ayso13.cloudflareaccess.com`
  - `ACCESS_AUD` — Application Audience (AUD) tag from the app's Overview.
- The Worker independently verifies the Access JWT (`Cf-Access-Jwt-Assertion`)
  on every request, so Access cannot be bypassed even if the route is reached.

### 3. GitHub token (commit to staging)
- Create a **fine-grained PAT** scoped to **only** `ayso-region-13/ayso-website`
  with **Contents: Read and write** (github.com/settings/tokens?type=beta).
- Store it as a secret (never in git):
  ```
  cd workers/field-maps
  wrangler secret put GITHUB_TOKEN
  ```

### 4. DNS / custom domain
- `wrangler.toml` binds the Worker to the custom domain `fields.ayso13.org`.
  On first `wrangler deploy`, Cloudflare provisions the route + cert. Confirm a
  `fields` CNAME/record exists for the zone (Wrangler creates the custom-domain
  binding automatically; add the DNS record in the dashboard if prompted).
- `workers_dev = false` keeps the `*.workers.dev` URL off so Access can't be
  bypassed through it.

### 5. Auth (token, not OAuth) + deploy
Deploy with a **Cloudflare API token scoped to the AYSO account + ayso13.org
zone**, not `wrangler login`. OAuth login caches an account-wide token in
`~/.wrangler` that other projects on this machine can clobber or that can target
the wrong account; a scoped token physically cannot. This matches how CI deploys
(GitHub Actions `CLOUDFLARE_API_TOKEN`). The repo `.envrc` exports both:
```
export CLOUDFLARE_ACCOUNT_ID="…"   # already present; pins the account
export CLOUDFLARE_API_TOKEN="…"    # AYSO-scoped token; wrangler uses it directly
```
Token permissions: Account · Workers Scripts:Edit, Access Apps&Policies:Edit,
Account Settings:Read; Zone (ayso13.org) · Workers Routes:Edit, DNS:Edit.
```
cd workers/field-maps
npm install
npm run deploy      # runs preflight, then wrangler deploy (token auth)
npm run tail        # live logs while testing
```

## Local development
`npm run dev` serves on `localhost`. The Worker **bypasses the Access JWT check
for localhost** so you can iterate on the editor UI; set a dev Mapbox token in
`wrangler.toml` (or a `.dev.vars`) and a `GITHUB_TOKEN` if you want to test
commits. Production (`fields.ayso13.org`) always enforces Access.

## Editor model (what gets saved)
`_data/fieldmaps/<slug>.json`:
```jsonc
{
  "field": "victory",
  "styleVersion": "satellite-v9",
  "variants": {
    "game":     { "label": "Game Day Layout", "view": {…}, "elements": [...], "png": "/images/fields/victory-game.png", "alt": "…" },
    "practice": { "label": "Practice Layout",  "view": {…}, "elements": [...], "png": "/images/fields/victory-practice.png", "alt": "…" }
  }
}
```
`elements` is the re-editable model:
- **field** — rotated rectangle (center, widthM, lengthM, rotationDeg) + name +
  ageGroup; HOME/AWAY sidelines auto-derived (HOME = north-or-west long side).
- **grid** — a field subdivided into cols×rows labeled cells (practice layouts).
- **line**, **text** (a placed word), **marker** (goal/restroom/parking/host tent/
  picture-day check-in).

Pure geometry (rectangles, grids, projection, home/away) lives in `public/geo.js`
and is unit-tested in Node. Export is deterministic: a Static Images satellite
base + every element re-drawn on a fixed 2D canvas (never a live GL screenshot).

## Files
- `src/index.js` — Worker: Access JWT verify, `/api/*`, atomic Git Data API commit.
- `public/index.html`, `public/style.css` — editor shell.
- `public/geo.js` — pure, Node-testable geometry.
- `public/app.js` — editor (Mapbox GL authoring + canvas export).
- `wrangler.toml` — routes, vars (Access/Mapbox/repo), assets binding. `GITHUB_TOKEN` is a secret.
