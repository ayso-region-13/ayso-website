# AYSO Region 13 Website Rebuild

## Project Overview
Rebuilding ayso13.org from WordPress to a custom static site built with **Eleventy (11ty) + Tailwind CSS**, published locally and tested before deploying to Cloudflare Pages.

## Current Status

**Live at www.ayso13.org since 2026-05-01.** The original WordPress→Eleventy rebuild is complete (159 old pages migrated/redirected, photo gallery, Pagefind search, volunteer training matrix, board-minutes archive, GA4, brand redesign, accessibility pass). The full build + post-launch changelog (session by session) lives in **`claude-history.md`** — NOT auto-loaded; read it when historical detail matters. Headline state below.

**Headline state:**
- **Hosting**: Cloudflare Pages (prod `www.ayso13.org`, staging `staging.ayso13.org`). CMS commits land on `staging`; `/ayso promote` merges to `main`.
- **Workers (3)**: `weather-api` (Tempest + NWS, WBGT/rain, 5-min cron, KV cache, live PurpleAir AQI composite — AirNow fallback), `redirects` prod + staging envs (642 rules: 633 exact + 9 splat), `csp-report` (30d KV), pages-deploy gates in workflows. (`field-maps` retired 2026-07-23 — the editor moved to ayso-platform; see the Fields entry under Files.) **Worker deploys**: `weather-api` / `csp-report` auto-deploy via CI (`deploy-workers.yml`) on push to `main` (single deployment each, serves both domains via routes — so main-only, never staging); `redirects` has its own branch-scoped `deploy-redirects-worker.yml` (real prod/staging envs). All use the one canonical **`ayso13-worker-deploy`** token (Workers Scripts + KV Storage + Account Settings + Zone Workers Routes), stored in `.envrc` + the `CLOUDFLARE_API_TOKEN` GitHub secret. **Note**: `src/_redirects` is intentionally NOT passed-through to `_site/` (.eleventy.js line 38) — Worker handles all redirects upstream of Pages; emitting the file triggered the "Maximum number of dynamic rules supported is 100" warning and correlated with the (now-retired) blob-hash-poisoning bug — see `claude-history.md`.
- **CMS**: Pages CMS at app.pagescms.org. Edits should land on `staging`. **The branch the CMS opens on = the repo's GitHub default branch** (Pages CMS has no `branch:` config key — the old `branch: staging` line in `.pages.yml` was silently ignored and caused repeated accidental edits to `main`). Fixed 2026-06-08 by setting the **GitHub default branch to `staging`** (`gh repo edit --default-branch staging`), so the CMS now opens on staging by default. Two media buckets — `images` and `docs` (PDFs). Editor uploads PDFs in Documents bucket, types path into rich-text link dialog.
- **Slack** (`#notify-website-status`): staging + promote workflows post success/failure with commit titles. `/ayso` Slack bot for field status, announcements, promote dispatch, `weather` (ephemeral current-conditions readout), and `test-weather` (weather-notification connectivity check).
- **Schema**: multi-typed `SportsOrganization` + `NonprofitOrganization` + WebSite + BreadcrumbList + Place (23 fields, each with `geo.latitude`/`longitude` from `placeLat`/`placeLon` frontmatter) + FAQPage + Person (Steve Hawkins) + SportsEvent (date-gated). EIN 95-6205398 on `#org`. `sameAs` includes AYSO national, the GBP Maps Place URL (cid `9491143221518550898`), Instagram (`@aysoregion13`), and Facebook (`/ayso13`); both social profiles link back to ayso13.org for `rel="me"` verification.
- **Hardened**: WCAG AA contrast, HSTS, CSP enforcing (`'wasm-unsafe-eval'` for Pagefind WASM), CSP report Worker, per-page noindex via frontmatter, per-section OG image defaults, `llms.txt`, IndexNow on every push.
- **Performance**: image pipeline = WebP + original-format only (AVIF intentionally disabled — see note below), hero LCP via eager-load + post-LCP rotation, Pagefind search.
- **Live features**: field pages w/ platform-sourced maps (game/practice/tournament/wayfinder) + Field Info callouts; Rose Bowl / FIS / Muir / Blair grouped as complexes with shared wayfinders. Live weather/heat/rain at `/resources/`. 12 programs incl. EXTRA™. 30-Q&A Ask the Referee. CMS-editable Important Dates widget on home. EmailOctopus newsletter signup. Photo gallery (62 photos, GLightbox SRI'd).
- **Image pipeline note (sticky)**: `@11ty/eleventy-img` formats are `["webp","auto"]` only. AVIF disabled because Cloudflare Pages build cache won't engage for this project ("Skipping build output cache..." despite preset = Eleventy / V3 / toggle on). AVIF encoding is 60%+ of build time. Build dropped ~4:14 → ~1:30 without it. DO NOT re-enable unless CF cache is fixed first.
- **SEO + analytics**: GA4 `G-9YM9ZDW1J9`, GSC `sc-domain:ayso13.org`, GA4 property `307558725`. Per-project Google creds in `.seo-creds/` (gitignored, direnv-symlinked to `~/.config/claude-seo`). Query commands + creds gotchas → **`docs/seo-data-pulls.md`**.
- **Retired gotcha** (moved to `claude-history.md`): CF Pages blob-hash poisoning — MOOT since the 2026-06-18 switch to CI Direct Upload. Read it there if a Pages deploy ever serves `HTTP 500` empty-body on specific URLs.

## Branched / staged for later

- _(none currently)_

## Platform Decision
**Switched from Squarespace to Eleventy (11ty) + Tailwind CSS.**

| | Details |
|---|---|
| Generator | [Eleventy 3.0](https://www.11ty.dev/) |
| CSS | Tailwind CSS 3.4 |
| Templates | Nunjucks (.njk) |
| Hosting | Cloudflare Pages — https://ayso13.pages.dev (staging) |
| Dev server | `npm start` → http://localhost:8080 |
| Build output | `site/_site/` |

## Site Architecture (`/site/`)

```
site/
├── .eleventy.js          ← Eleventy config (filters, transforms, markdown)
├── tailwind.config.js    ← Brand colors, typography
├── package.json          ← Scripts: start, build, migrate, photos, check-links
├── src/
│   ├── _data/
│   │   ├── navigation.js ← Full nav structure (topNav + section sidebars)
│   │   ├── site.json     ← Site metadata (phone, email, address, InLeague URL)
│   │   └── fileDates.json← Auto-generated per-file last-modified dates
│   ├── _includes/
│   │   ├── base.njk           ← HTML shell, light sticky header, footer, mobile nav
│   │   ├── page.njk           ← Standard content page (breadcrumb, sidebar, prose)
│   │   ├── home.njk           ← Home page layout (hero, Let's Play tiles, About + Roles, gallery strip)
│   │   ├── ask-the-referee.njk← Custom layout for /referees/ask-the-referee/ accordion FAQ
│   │   └── sponsors-strip.njk
│   ├── assets/css/
│   │   ├── tailwind.css  ← Input CSS
│   │   └── style.css     ← Compiled output (gitignored, rebuilt on start/build)
│   ├── images/           ← 62 photos (action, game, fall-game, all-stars, wca,
│   │                        grad-series, victory) + logo.svg + sponsor logos
│   │   └── fields/       ← Field location photos (.jpg). Maps are NOT here —
│   │                        they come from the platform at build time
│   └── [content pages]   ← .md files for all sections (see below)
└── scripts/
    ├── migrate-content.js    ← Copies /content/ → site/src/ with front matter
    ├── generate-file-dates.js← Writes fileDates.json for [DATE] placeholder
    ├── process-photos.sh     ← Optimizes photos for web
    ├── check-links.js        ← Internal link checker
    └── check-external-links.js
```

## Content Sections in `site/src/`

| Section | URL | Pages |
|---------|-----|-------|
| Home | `/` | 1 |
| About | `/about/` | 10 |
| Programs | `/programs/` | 12 + 2 tournaments |
| Register | `/register/` | 3 |
| Schedules | `/schedules/` | 4 (link to InLeague) |
| Parents | `/parents/` | 6 |
| Coaches | `/coaches/` | 13 |
| Referees | `/referees/` | 8 |
| Managers | `/managers/` | 4 |
| Volunteers | `/volunteers/` | 8 (includes training matrix) |
| Fields | `/fields/` | 20 locations + index + goals (includes FIS Upper/Lower) |
| Resources | `/resources/` | 5 |
| Search | `/search/` | 1 (Pagefind) |
| Contact | `/contact/` | 2 |

## Navigation Structure
- **Top nav (6 items):** Programs, Register, Schedules, Fields, Parents, About
- **Footer-only sections:** Coaches, Referees, Team Managers, Volunteers, Resources, Contact
- Section sidebars auto-generate from `navigation.js` based on current URL
- Mobile menu with accordion submenus
- "Register Now" CTA button in header and footer

## Brand

Full palette + usage notes are in `brand-colors.md` (palette doc) and `.impeccable.md` (design context).

| Tailwind name | Hex | Role |
|---|---|---|
| `brand-red` | `#f74b4b` | Coral accent — hero "SOCCER", tile underline strips, decorative only (fails AA on white) |
| `brand-red-dark` | `#83312d` | Burgundy — primary text emphasis (headings, links, nav active), tile bodies, hero buttons |
| `brand-maroon` | `#8e2929` | Structural frames — quick-action bar, sidebar header, role panel, link hover |
| `brand-maroon-dark` | `#3a0d12` | Photo gallery strip background |
| `brand-header` | `#230511` | inLeague pill button, very dark accents |
| `brand-cream` | `#ede8e2` | Warm off-white surface — Let's Play section, interior page header, sidebar hover/active |
| `brand-green` | `#a6ce57` | Field status "Open" |
| `brand-gold` | `#f4bd4d` | Announcement bar, field status "Monitoring" |
| `brand-dark` | `#221f1f` | Body text, footer bg |

Font: **Raleway** (300–900) loaded from Google Fonts in `base.njk` head.

**Color hierarchy:** Light/white header → cream + maroon for structural surfaces (quick-action bar, sidebar headers, role panel) → white for content body → dark maroon footer. Red is reserved for emphasis (`brand-red-dark` for text, `brand-red` for accent strips). The two-tone "solid body + offset underline strip" pattern is the visual signature, applied to home buttons, home tiles, and the divider below interior page headers.

## Key Scripts

```bash
cd site/
npm start          # Dev server with live reload at localhost:8080
npm run build      # Production build to _site/ (includes Pagefind indexing)
node scripts/migrate-content.js  # Re-sync /content/ → site/src/
bash scripts/process-photos.sh   # Optimize new photos
node scripts/check-links.js      # Check internal links
./scripts/check-404s.sh          # Pull last-24h 404s from CF GraphQL Analytics (needs CF_ZONE_ID + CF_API_TOKEN in site/.env)
```

**Cloudflare API tokens (consolidated 2026-06-13):** `ayso13-worker-deploy` (Workers Scripts + KV Storage + Account Settings + Zone Workers Routes) deploys all four workers — in `.envrc` `CLOUDFLARE_API_TOKEN` + the GitHub `CLOUDFLARE_API_TOKEN` secret. `ayso13-pages-deploy` (Account · Cloudflare Pages · Edit) = GitHub `CLOUDFLARE_PAGES_DEPLOY_TOKEN`, used by the CI Direct-Upload deploys (staging + promote). `ayso13-pages-deploy-read` (Pages: Read) = GitHub `CLOUDFLARE_PAGES_API_TOKEN` — was the promote status poll; now effectively unused (kept; `wait-for-cf-deploy.sh` is retired). `ayso13-website-healthcheck` (Zone Analytics: Read) backs BOTH the totavi healthcheck and `check-404s.sh` (`site/.env CF_API_TOKEN`) — value lives in `~/dev/site-healthcheck/secrets/ayso.yml`. Don't create per-tool deploy tokens; reuse these.

Note: Search (`/search/`) only works after a full `npm run build` — not in dev server.

### GSC + GA4 data pulls

Full command reference (GSC/GA4 queries), the `.seo-creds/` layout, and the cross-project clobbering defense → **`docs/seo-data-pulls.md`**. The one rule that bites: **before any GA4/GSC query, `cat ~/.config/claude-seo/google-api.json` and verify `ga4_property_id == 307558725`** — other projects on this machine clobber the shared OAuth config and queries then return another site's data silently (memory `feedback_check_seo_creds_first`).

The CSP report Worker admin key is exported by `.envrc` as `CSP_ADMIN_KEY` for the daily-review one-liner (see `workers/csp-report/`).

## Content Placeholders (still in some pages)
- `[INLEAGUE: description]` — 36 remaining, documented in `links-to-resolve.md`
- `[IMAGE: description]` — 0 remaining (all removed/sourced)
- `[DATE]` — auto-replaced at build time with file's per-file last-modified date from `_data/fileDates.json` (script generates from `git log --name-only`, keys are `src/...` paths)

## Key Decisions
1. **Platform:** Eleventy + Tailwind CSS (static, no CMS needed for now)
2. **Hosting:** Cloudflare Pages (build command: `npm run build`, root: `site/`, output: `_site/`)
3. **InLeague:** Link out — no embeds
4. **News/field status:** Announcement banner on homepage pointing to InLeague
5. **Photo gallery:** Dedicated page at `/resources/gallery/`
6. **Documents:** Embedded Google Drive
7. **Historical content:** Delete with comprehensive redirects
8. **Programs:** Separate page per program for direct linking
9. **Fields:** Separate page per field for direct linking

## Content Writing Guidelines
- **Voice:** Mixed — "we" for community pages, "Region 13" for official info
- **Audience:** Parents with limited soccer and technology knowledge
- **Style:** Straightforward and factual. No editorializing, sarcasm, or jokes.
- **Emphasis:** Minimal bolding — only for true warnings or critical info
- **Tone:** Helpful and inclusive without being preachy or condescending

### What to Avoid
- Exclamation points
- "Good news:" or similar editorializing phrases
- Sarcasm or humor
- Excessive bolding or emphasis
- Overly casual language ("That's it!" "Perfect!")

## Staging Environment

**Workflow:** CMS edits → `staging` branch → staging.ayso13.org → promote → `main` → www.ayso13.org

- `staging` branch is live at **staging.ayso13.org** (separate Cloudflare Pages project, `ayso-website-staging`)
- `main` branch deploys to **www.ayso13.org** (production CF Pages project, `ayso-website-prod`)
- **DEPLOYS RUN IN GITHUB ACTIONS (CI Direct Upload), not CF's Git pipeline (changed 2026-06-18).** CF Pages Git-integration auto-deploy is **DISABLED** on BOTH projects — its build pipeline was flaky (deploys stalled/failed in CF's `initialize`/`deploy` stages, causing repeated promote failures + blob-hash poisoning). Now: CI runs `npm run build` then `wrangler pages deploy site/_site --project-name=<proj> --branch=<branch>` (Direct Upload — uploads only changed files, deterministic, 3× retry). Two workflows: **`deploy-pages-staging.yml`** (on push to `staging`, incl. CMS commits; 45s debounce via an interruptible `sleep` + `cancel-in-progress` so a burst of CMS edits coalesces into one deploy; deploys to `ayso-website-staging`) and **`promote-to-production.yml`** (see below). Both set `CF_PAGES_BRANCH` (staging→noindex block, main→allow-all). Deploy needs the **`ayso13-pages-deploy`** token (Account · Cloudflare Pages · Edit) in the `CLOUDFLARE_PAGES_DEPLOY_TOKEN` GitHub secret. `wait-for-cf-deploy.sh` is now unused. If you ever need to revert: re-enable CF auto-deploy in the dashboard + revert the workflow commits.
- Pages CMS edits go to staging because the **GitHub default branch is `staging`** (set 2026-06-08), and Pages CMS *defaults* to the repo default branch. (Pages CMS has no `branch:` config key — do not rely on one in `.pages.yml`.) **Caveat:** the CMS branch picker still *exposes* `main` — editors can switch to it. So the staging-only flow is enforced by the `main` ruleset (below), not by the CMS itself.
- **Branch ruleset on `main`** (`Protect Main`, ruleset id `15738123`) requires PRs + blocks force-push/deletion. **Target must be the literal `refs/heads/main`, NOT `~DEFAULT_BRANCH`** — because the default branch is `staging`, `~DEFAULT_BRANCH` resolves to staging and the ruleset silently protects the wrong branch (this happened: fixed 2026-06-13 by retargeting to `refs/heads/main`). Bypass = Repository admin role (`always`). **Org-owner caveat:** `ayso-region-13` is a GitHub **org**, and both Pages CMS editors (`magoldman`, `pshopbell`) are **org owners** → admin on every repo → they **bypass** this ruleset and *can* commit directly to `main` from the CMS if they switch the branch picker. The ruleset only *enforces* staging-only for **non-owner** writers (none today; `shantirao` is read-only). For the two owners it's process, not enforcement — rely on `/ayso promote`. `magoldman` also bypasses via the workflow's `PROMOTE_TOKEN` PAT.
- **Promote to production:** GitHub Actions workflow `.github/workflows/promote-to-production.yml` merges `staging` → `main`, then **builds in CI and `wrangler pages deploy`s to `ayso-website-prod`** (no debounce — promotes are deliberate), then submits IndexNow from the locally-built sitemap. (No longer waits on a CF Git build.)
  - From Slack: `/ayso promote` (slack-bot dispatches workflow_dispatch with `ref: main` — so the promote logic is read from **main**; if you change the workflow, it must reach `main` to take effect. Bootstrap a workflow change onto main by dispatching `gh workflow run "Promote Staging to Production" --ref staging -f confirm=promote` once.)
  - From GitHub UI: Actions tab → "Promote Staging to Production" → Run workflow → type "promote"
  - Uses `PROMOTE_TOKEN` (classic PAT, repo scope) to push `main` (bypasses the branch ruleset) + `CLOUDFLARE_PAGES_DEPLOY_TOKEN` for the wrangler upload
  - **Promote sweeps everything currently on staging into main** — review staging before clicking promote, or any pending CMS edits will ship too
  - On merged/live/failure, the workflow posts to `#notify-website-status` (uses `SLACK_BOT_TOKEN` repo secret)
  - **IndexNow:** folded into promote (best-effort, from the built sitemap). The standalone `indexnow.yml` is now a manual `workflow_dispatch` fallback only.
- **Staging crawl block:** `_headers.njk` and `robots.njk` read `CF_PAGES_BRANCH` env var at build time. On the `staging` branch the build emits `Disallow: /` + `X-Robots-Tag: noindex,nofollow`; on `main` the build emits the normal allow-all + sitemap. Local dev (`npm start`) builds in production mode (no env var)
- Do NOT commit directly to `main` for content changes — always go through staging

## CMS
Pages CMS is configured for non-technical editors at https://app.pagescms.org.

- Config file: `.pages.yml` in the repo root
- Editors log in at app.pagescms.org — no GitHub account required
- Edits commit directly to `main` and trigger a Cloudflare Pages rebuild
- Layout, section, and permalink fields are hidden from editors
- To add/remove editors: manage via the Pages CMS web interface
- To add a new content field: update `.pages.yml` and commit
- Announcement bar is a site-wide setting at the top of the Pages CMS sidebar — editors can toggle it on/off and edit the text without touching code
- Field status is editable in Pages CMS — `status` is a `type: string` field (Pages CMS `select` with static options is broken; use string + description instead); template uses `| lower` for case-insensitive matching
- Navigation is code-only in `navigation.js` — Pages CMS cannot handle nested list-of-objects structures; do not attempt to add it to `.pages.yml`

## Site-wide Data Files (`site/src/_data/`)
- `site.json` — phone, email, address, InLeague URL, GA4 ID, founded year
- `navigation.js` — full nav structure (top nav + section sidebars)
- `fileDates.json` — auto-generated per-file last-modified dates (keys are `src/...` paths)
- `announcements.json` — home page announcement bar (`enabled` boolean + `body` markdown); rendered via `markdownify` filter in `home.njk`, so the `body` supports inline links (e.g. `[Register Today for Fall 2026](/register/)` makes the whole bar text a link — styled by the existing `[&_a]:underline`). Sits **above** the hero on the home page.
- `fieldstatus.json` — home page field status widget (`enabled` boolean + `status` string + `message` string); color-coded Open/Monitoring/Closed; last-updated timestamp from `git log` at build time (Pacific time). Sits **below** the hero (swapped with the announcement bar 2026-06-16).
- `sponsors.js` — sponsor logos, URLs, and tier definitions
- `fees.json` — Fall Soccer registration fee schedule (rangeShort + per-tier amounts + sibling discount). Used by `/register/`, `/programs/fall-soccer/`, and `/llms.txt`. Note: `/parents/index.md` is hardcoded because Pages CMS round-trips break Nunjucks template syntax in CMS-edited markdown bodies — when fees change, edit both
- `og.js` — Per-section default OG image fallbacks. When a page has no `heroImage` frontmatter, `base.njk` picks the section default; otherwise the global fallback
- `heroes.js` — Home page hero photo set (5 images with src + alt). Fisher-Yates shuffled at module load, so each Eleventy build emits a different first/LCP image. Rendered via `{% for hero in heroes %}` in `home.njk`; first iteration gets `loading="eager" fetchpriority="high"`, rest stay lazy + hidden until the JS rotation script promotes them

## Site-wide Templates / Patterns
- `_includes/schema-org.njk` — emits JSON-LD on every page based on URL/section/frontmatter: multi-typed `SportsOrganization` + `NonprofitOrganization` + WebSite (homepage; `#org` carries `taxID` 95-6205398 and `nonprofitStatus`), BreadcrumbList (inner pages + ask-the-referee), Place (field pages with `placeAddress` frontmatter), FAQPage + Person for Steve Hawkins (`/referees/ask-the-referee/`, in a single `@graph` so each Answer's `author` references the Person `@id`), SportsEvent (programs pages with both `eventStartDate` + `eventEndDate` frontmatter set; gates emission on both fields).
- `_includes/_headers.njk` and `robots.njk` — Cloudflare Pages config; branch-aware via `CF_PAGES_BRANCH` env var to block crawlers on staging. Production headers include HSTS (`Strict-Transport-Security: max-age=31536000; includeSubDomains`), CSP-Report-Only, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy.
- `llms.njk` → `/llms.txt` — AI/LLM crawler summary (curated link index), pulls live values from `site.json` and `fees.json`. `llms-full.njk` → `/llms-full.txt` — build-generated full-text export of every content page (the `llmsContent` grouped collection in `.eleventy.js` + the `plaintext` filter; substantive sections only — skips board-minutes/gallery/search/forms/noindex), plus the 35 Ask-the-Referee Q&As from `qaAnswers`. Regenerates each build, so it never goes stale. **If you add a content section, add its `section` key to the `LABELS`/`ORDER` map in the `llmsContent` collection or its pages won't appear.**
- **InLeague Register button auto-style** — a build-time transform in `.eleventy.js` finds `<a href="https://ayso13.inleague.com/app">Register…</a>` and adds `class="btn-primary text-lg px-8 py-4" target="_blank" rel="noopener"`. Editors keep plain markdown links (CMS-safe); buttons render at build time
- **Field Info callout** — frontmatter fields (`parking`, `restrooms`, `surface`, `lighting`, `snackBar`) on field pages render as a "Field Info" cream callout at the top of the article when populated. Empty by default; CMS exposes the fields for fields-coordinator to fill in
- **Per-page noindex** — frontmatter `noindex: true` emits `<meta name="robots" content="noindex,nofollow">` AND drops the `data-pagefind-body` attribute on the main element so Pagefind site search excludes the page
- **°F/°C toggle** (front-end only, no Worker/API change) — `/resources/weather/`, `/temp`, and `/resources/heat-policy/` carry a "Switch to °C/°F" link that converts every temperature on the page and persists the choice in the shared `localStorage` key **`tempUnit`** (`"F"` default / `"C"`), so the preference follows the visitor across all three pages. The API always sends °F; conversion is display-only. Each page has its own inline script (no shared asset): live readouts route through a `fmtTemp(f)` helper (1-decimal °C); heat-policy wraps its static WBGT thresholds in `<span class="js-degf" data-f="N">` (header unit in `#wbgt-unit`, `data-u` flag = include the unit suffix). **If you add a new temperature to any of these pages, wrap it the same way or it won't convert.**

## Files
- `CLAUDE.md` — This file (current state + active conventions). Feature deep-detail lives in the per-worker READMEs and `docs/`; keep this file lean.
- `claude-history.md` — Detailed session-by-session changelog (offloaded to keep the auto-loaded memory tight). NOT auto-loaded; read when historical detail matters. Also holds the retired CF-Pages blob-hash-poisoning gotcha.
- `docs/seo-data-pulls.md` — GSC/GA4 query commands + `.seo-creds/` layout + clobbering defense
- `docs/weather-preview-urls.md` — weather/AQI simulate-preview URLs
- `workers/*/README.md` — canonical per-Worker docs (weather-api, redirects, csp-report)
- `todo.md` — Active task list
- `.impeccable.md` — Design context: users, brand personality, principles (used by /impeccable skill)
- `brand-colors.md` — Full color palette with hex, RGB, usage notes, contrast cheat-sheet
- `site-overview.md` — Slab-friendly summary for the team wiki
- `.pages.yml` — Pages CMS configuration
- `links-to-resolve.md` — 36 `[INLEAGUE: ...]` placeholders still needing real URLs (forms, Google Drive links, external services)
- `proposed-site-structure.md` — Original IA proposal with old→new URL mapping
- `website-builder-comparison.md` — Platform research (now superseded by Eleventy decision)
- `/content/` — Source Markdown files (migrated into `site/src/` via migrate-content.js)
- `/site/` — The actual Eleventy site (active development)
- `/logo/` — Logo assets
- `/workers/weather-api/` — powers `/resources/weather/` + `/temp`. Cron (`*/5`) polls Tempest station 33318 + NWS (forecast point moved to Victory Park 2026-07-24; forecast content changed, WBGT/closure did not), reads WBGT from the station's own `wet_bulb_globe_temperature` field rather than deriving it locally (the old local formula clamped its globe term to a constant and read up to 8.5°F too hot; deleted 2026-07-24 — see `docs/superpowers/specs/2026-07-24-wbgt-source-design.md`), tracks rolling rainfall in KV, serves `/api/weather` (prod + staging routes). **AQI**: PurpleAir composite is primary (5 curated outdoor sensors, EPA-corrected median PM2.5 → AQI), **throttled to every 15 min** (`AQI_REFRESH_MINUTES`) to conserve API points — carries the last reading forward on in-between ticks; AirNow (`ziplatlong` endpoint) is the fallback. **Slack notifiers** post to `#notify-weather` on closure-threshold + rain-forecast changes (the NWS active-alert notifier is disabled by default — `NWS_ALERTS_ENABLED="false"`, was too noisy). The **closure notice is debounced** (`closureNotifyDecision`, pure/unit-tested, Slack-only — the page shows the true live level): heat hysteresis (trips at WBGT `> WBGT_TRIP_F` 89.7 to match `cif.level>=5`, clears only at `<= WBGT_CLEAR_F` 88.0) + a `CLOSURE_DWELL_MINUTES` (15) dwell so a boundary-hovering WBGT can't flap over/under. **Self-test** = `/ayso test-weather`; **`/ayso weather`** = ephemeral readout. **Deploy**: auto via CI on push to `main` (ships on promote); manual `cd workers/weather-api && npm run deploy` with the canonical **`ayso13-worker-deploy`** token (needs Workers KV:Edit or `code 10023`). Secrets (not in git): `TEMPEST_TOKEN`, `AIRNOW_API_KEY`, `PURPLEAIR_READ_KEY`, `SLACK_BOT_TOKEN`, `WEATHER_SELFTEST_KEY`. **Full detail + setup + output schema → `workers/weather-api/README.md`.** TODO: nothing pending (old AirNow endpoint already dropped 2026-06-21).
- **Field maps — read from the platform at build time** (migrated 2026-07-22/24, session 40; replaced the retired `workers/field-maps/` editor Worker). The map editor now lives in the **ayso-platform** admin console (`~/dev/ayso-platform`), which serves `fields.ayso13.org` and its staging twin `fields-staging.ayso13.org`. This repo no longer stores maps: `site/src/_data/fieldmaps.js` → `_data/lib/fetchFieldMaps.js` fetches `GET /public/fields` (venue index) + `GET /public/fields/<slug>` (detail, plus the `overview` slug which the index omits by design) at build time, cached by `eleventy-fetch` for 1 day so a platform outage serves last-good instead of failing the build. The committed `_data/fieldmaps/*.json` and the 40 `images/fields/*-<variant>.png` exports are **deleted** (the 21 field `.jpg` photos stayed).
  - **Which instance a build reads** — `FIELDS_API_BASE` env var. Staging deploy sets `https://fields-staging.ayso13.org` (so unpromoted map edits are reviewable on staging.ayso13.org); promote sets `https://fields.ayso13.org`. The in-code default is the **prod** instance, so an unset env (local `npm start`, a new workflow) reads published maps.
  - **Images are optimized locally at fetch time**, not by the sitewide `eleventyImageTransformPlugin`: that plugin only rewrites `<img src>`, never `<a href>`, and the map lightbox wraps each map in `<a href>`, so a raw ~4.5 MB cross-origin PNG kept shipping behind the lightbox. `optimizeVariantImage()` pre-generates webp+png at 600/1200/2000w into the shared `_site/img/` + `/img/` namespace and returns both the `<picture>` markup and the largest local PNG for the href. The generated `<img>` carries `eleventy:ignore` (else the sitewide transform re-processes an already-local path and fails the build); a posthtml pass in `.eleventy.js` strips that marker back out.
  - **CI gotcha (sticky)** — GitHub Actions runners are Azure IPs, and Cloudflare bot protection on the ayso13.org zone 403s datacenter requests to the platform's own *public* API. Fix: build-time fetches send `User-Agent: ayso13-fieldmaps-build` and a Cloudflare "Skip" security rule matches that UA. Applied to the JSON fetch **and** the eleventy-img image fetches (via `cacheOptions`). Same class of problem the IndexNow bot had. If a build starts failing with `Bad response … (403): Forbidden`, check that CF rule first.
  - Variant keys still drive page headings (`game`/`practice`/`wayfinder`/`tournament`/other); the `complexes` collection still shares one wayfinder per group (FIS / Muir HS / Rose Bowl / Blair); the **Region Overview** map still renders atop `/fields/` (now from the platform's `overview` slug). The old Worker's Access gate, Mapbox drawing surface, GitHub-commit protocol, and PDF export all moved to the platform — its specs are in `~/dev/ayso-platform/docs/superpowers/`.
  - **Deep-linkable map images**: `/field-images/<slug>-<variant>.png` on the platform is slug-keyed and survives map edits, unlike a content-hashed `/img/` filename. The Jefferson legacy redirects point there for that reason.

---
*Last updated: 2026-07-24 (session 40 — field maps moved to the ayso-platform admin console: this site now fetches them from the platform's public API at build time (`_data/lib/fetchFieldMaps.js`) and optimizes the images locally; the `field-maps` Worker, the committed `_data/fieldmaps/*.json`, and the 40 committed map PNGs are all deleted. Follow-up cleanup on 07-24 removed `field-maps` from `deploy-workers.yml` (it was failing the workflow on main) and completed the Phase 3 cutover so prod builds read `fields.ayso13.org` instead of the staging instance. Session 39 — fixed the closure Slack notice posting a generic "threshold reached" bullet instead of naming heat: `closureReasons` now uses the notifier's hysteresis-latched `heatActive` flag (not the raw live CIF level) and includes the live WBGT °F value, so a closure that dipped into the 88–89.7°F deadband during the dwell still reads e.g. "Heat: WBGT 89.1°F — outdoor activity should be suspended". Session 38 — debounced the weather closure Slack notice (heat hysteresis 89.7→88.0 + 15-min dwell, Slack-only) to stop boundary flapping; out-of-area GA4 re-check; verified recurring CSP FB/DoubleClick blocks aren't ours. Full session-by-session changelog in `claude-history.md`.)*

- @SITE-HEALTH.md — latest automated site-health findings (regenerated by totavi-llc/site-healthcheck; do not hand-edit).
