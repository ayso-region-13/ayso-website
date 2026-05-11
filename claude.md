# AYSO Region 13 Website Rebuild

## Project Overview
Rebuilding ayso13.org from WordPress to a custom static site built with **Eleventy (11ty) + Tailwind CSS**, published locally and tested before deploying to Cloudflare Pages.

## Current Status
- [x] Crawl existing site via sitemap (159 pages found)
- [x] Analyze current page structure
- [x] Research IA best practices and competitor sites
- [x] Propose new site structure (see `proposed-site-structure.md`)
- [x] Review content of pages marked for deletion
- [x] Get approval on structure & deletion list
- [x] Write content for each page in `.md` files (`/content/`, 97 files)
- [x] Upload content to Slab for team review
- [x] **Choose platform: Eleventy + Tailwind CSS (not Squarespace)**
- [x] Build 11ty site scaffolding (`/site/`)
- [x] Migrate content from `/content/` into `site/src/`
- [x] Build full navigation (top nav + section sidebars + mobile menu)
- [x] Build base layout, page layout, home layout
- [x] Add photos and logo to `site/src/images/`
- [x] Set up scripts: migrate, photo processing, link checking, file dates
- [x] Add site search (Pagefind) — `/search/` page + footer search box
- [x] Build photo gallery — `/resources/gallery/` with GLightbox, 62 photos, category filter
- [x] Download and place field maps from ayso13.org — all field pages updated
- [x] Add FIS Upper, FIS Lower, Butler, Cornishon, LC LDS, Pasadena HS field pages
- [x] Build volunteer training matrix — `/volunteers/training-matrix/`
- [x] Board minutes archive — 79 PDFs self-hosted at `/assets/docs/minutes/`
- [x] Google Maps embeds on all field pages
- [x] Google Analytics (GA4: G-9YM9ZDW1J9)
- [x] Slack bot (`/ayso`) — field status, announcements, promote to production
- [x] Ask the Referee — accordion FAQ, 30 Q&As in 7 categories, Pages CMS collection for Steve
- [x] Home page + brand redesign — light header, two-tone hero/buttons/tile labels, Raleway font, new logo SVG
- [x] Image optimization pipeline — `@11ty/eleventy-img` auto-converts every `<img>` to `<picture>` with **WebP + original-format** variants at 600/1200/auto widths. **AVIF intentionally excluded** — Cloudflare Pages build cache won't engage for this project (logs "Skipping build output cache as it's not supported for your project" despite framework preset = Eleventy, V3 build, cache toggle on). AVIF encoding is 60%+ of image processing time. Without cache, every deploy regenerates from scratch. WebP covers 96%+ of users and gives most of the size win. Build dropped from ~4:14 (with AVIF) to ~1:30 (without). DO NOT add AVIF back unless Cloudflare cache is fixed first.
- [x] Interior page design alignment — cream surface, maroon sidebar header, two-tone strip below page header
- [x] Accessibility hardening — site-wide WCAG AA contrast pass on prose headings, links, nav, sidebar, field status bars
- [x] Kids Zone — replaces Parent Pledge, follows AYSO National's authoritative 10 guidelines
- [x] Newsletter system — `/resources/newsletters/` with EmailOctopus subscribe widget + 97-link archive (2021–2025); old `/news/` URL redirects in
- [x] Form upload tool — `/forms/` page replicates the legacy Google Apps Script upload flow
- [x] PDFs migrated from old WordPress to local `/assets/docs/` — penalty-kick guidelines, FIFA 11+ warmup, concussion/SCA forms
- [x] Review and refine site
- [x] Create redirect mapping (159 old URLs → `site/src/_redirects`)
- [x] Deploy to Cloudflare Pages ← **staging.ayso13.org / www.ayso13.org**
- [x] **Pre-launch /seo audit (22 of 28 items resolved)** — schema markup site-wide (SportsOrganization + WebSite + BreadcrumbList + Place on 22 field pages + FAQPage on Ask the Referee), llms.txt, sitemap lastmod fix, image sizes per-element, hero LCP fix, /contact ZIPs + tel links, 501(c)(3) statement on /about/, Project Play 8 Children's Rights, "Field Maps" page title, distinct alt text, per-section OG image defaults, HTML age chart replacing PNG, /parents big yellow Register button via build-time transform, fees centralized in `_data/fees.json`. Remaining items in `todo.md`.
- [x] **Post-launch /seo audit sweep (2026-05-02)** — Steve Hawkins author bio + Person schema + author refs on every FAQPage Answer node, /register/ section reorder with deadline callout, multi-typed `SportsOrganization` + `NonprofitOrganization` org entity (taxID + nonprofitStatus), SportsEvent schema infrastructure (Fall Soccer 2026 wired up), Become-a-Referee CTA, IFAB edition note, llms.txt expansion (Identity, Contact, License sections), Ask the Referee hybrid title, citable lead paragraph on /programs/fall-soccer/, meta description rewrites (home, /register/, /about/), markdown-it `replacements` rule disabled (was mangling 501(c)(3) → 501©(3)), cream-callout pseudo-headings promoted to real `<h2>`, Footer Status link target, **HSTS header** (`max-age=31536000; includeSubDomains`), 17 commits total promoted to prod.
- [x] **Repo made public** + branch ruleset on `main` requires PRs (PROMOTE_TOKEN PAT bypass for the workflow)
- [x] **Slack notifications on promote** — `/ayso promote` and the workflow now post success/failure to `#notify-website-status`
- [x] **Launched** — DNS cut over to www.ayso13.org on 2026-05-01
- [x] **Live weather + heat + rain policy (2026-05-04)** — `/resources/weather/` shows current conditions from Region 13's Tempest station, computed WBGT + CIF alert level, 48h/72h rainfall totals, and a 7-day NWS Pasadena forecast. `/resources/heat-policy/` documents the 5 CIF alert tiers + required actions; `/resources/rain-policy/` documents the wet-field closure thresholds (>0.25" in 48h or >1" in 72h). Powered by Cloudflare Worker at `workers/weather-api/` (cron every 5 min, KV-cached, mounted on `www.ayso13.org/api/weather` and `staging.ayso13.org/api/weather`). Heat + rain banners are advisory only ("Advisory:" prefix in title); board still makes the official call via Slack bot. Page supports `?simulate=N` (heat 1–5) and `?simulate-rain=48h|72h` for visual QA. Field-status bar at top of page is opt-in via frontmatter `showFieldStatus: true` (handled in `page.njk`).
- [x] **CF Pages deploy gate on promote workflow** — `.github/workflows/promote-to-production.yml` and `.github/workflows/indexnow.yml` now wait for the matching Cloudflare Pages deployment to reach a terminal state via the CF API (replaced earlier `sleep 150` guess). Requires `CF_API_TOKEN` (Pages:Read) + `CF_ACCOUNT_ID` repo secrets. Helper script at `.github/scripts/wait-for-cf-deploy.sh`.
- [x] **EXTRA program launched (2026-05-05)** — `/programs/extra/` public, in sitemap, in main nav (alphabetized), in footer Programs column, and on the home tile grid (replacing the All-Stars tile slot). All-Stars page itself preserved. SportsEvent schema (Sept 2026 → May 2027). EXTRA™ on first mention per page (home tile, programs index, page lead, llms.txt). `extra-interior.jpg` and `home/tile_extra.jpg` added.
- [x] **Staging-deploy Slack notifications (2026-05-05)** — `.github/workflows/notify-staging-deploy.yml` watches CF Pages staging builds and posts a one-line success/failure message to `#notify-website-status`. Reuses the existing `wait-for-cf-deploy.sh` script. Skips notification when CF doesn't register a deployment for the SHA (no-op push filter).
- [x] **`heroImage` paths normalized + UTC date bug fixed (2026-05-05)** — All `heroImage` frontmatter values now use full `/images/foo.jpg` paths (matching body markdown); `base.njk` no longer prepends `/images/`. Fixes Pages CMS image previews. Separately, the `date` filter and `[DATE]` transform in `.eleventy.js` now pin to `America/Los_Angeles` instead of UTC, so sitemap `<lastmod>` and "Last updated" footers don't drift forward a day on late-Pacific-evening commits.
- [x] **Field Info populated on all 22 field pages (2026-05-07)** — `parking`, `restrooms`, `surface`, `lighting`, `snackBar` filled in for every field page; ingest from a CSV → frontmatter pipeline. `field-info-bottom` transform in `.eleventy.js` moves the rendered "Field Info" cream callout from the top of `<article>` to just above the "Last updated:" line on public pages (CMS preview still shows it inline at the top via the layout, so editors see it where they're editing).
- [x] **IndexNow workflow recovery (2026-05-07)** — CF Super Bot Fight Mode was blocking the GitHub Actions runner via edge-level IP/AS-number reputation, above WAF custom rules. Switched the IndexNow sitemap fetch to use the Cloudflare Pages preview URL (already exported as `deployment_url` by `wait-for-cf-deploy.sh`); pages.dev origin bypasses customer-zone WAF. Also hardened the script with retry, byte-size sanity check, and explicit error logging.
- [x] **Historical content backfill (2026-05-08)** — added `/about/past-commissioners/` page (1974–present, 30 commissioners) from WP export. Backfilled Hall of Fame (Notable Referees + 14 more Walizer winners back to 1997 + 15 more Bill Carroll winners back to 1996). History page expanded with the "why 13?" origin, Edward Lapointe Brookside dedication, split Victory Park lighting timeline, La Cañada Youth Sports Coalition. New `/about/celebration-of-womens-soccer/` rebuilt from the 2022 Wix recap site (35-photo GLightbox gallery, excluded from main nav, linked from Sisterhood + History timeline + Related Pages).
- [x] **GSC + GA4 quick-win pass (2026-05-08)** — pulled 28-day GSC + GA4 + CF edge data via `claude-seo` plugin scripts. Added 4 high-impression redirects (`/age-chart-2025`, `/ayso-history`, `/4u-playground`, `/b14u-spring-schedule-2026`). Home page title rewritten to "Pasadena Youth Soccer League | AYSO Region 13" (leads with the local-intent query that ranks for "ayso soccer near me", "pasadena soccer league", etc., currently pos 5–11). Brookside meta description + lead now explicitly cite "Rose Bowl Stadium" (targeting pos 8.6 ranking for "rose bowl park"). History page opens with bold "AYSO stands for the American Youth Soccer Organization" sentence (targeting pos 7.1 for "what does AYSO stand for"). GSC + GA4 instructions added to Key Scripts; `oauth_client_path` added to `~/.config/claude-seo/google-api.json` so token auto-refreshes.
- [x] **Photo gallery a11y + SRI hardening (2026-05-08)** — `/audit` flagged the Celebration page's enumeration alt text ("photo N of 35") as a WCAG 1.1.1 issue. Read each photo and wrote descriptive alt text (group lineups, Cobi Jones segment, Spieker Field small-sided games, exhibition-match action). Added sha384 SRI integrity hashes to GLightbox CDN scripts on both `/about/celebration-of-womens-soccer/` and `/resources/gallery/`; deferred the script and gated init on `DOMContentLoaded`.
- [x] **EPIC descriptor reframed: "inclusion program" → "adaptive soccer" (2026-05-09)** — every EPIC-program-descriptor reference (home tile sub, llms.txt, `/about/inclusion/` description + related-pages, `/programs/epic/` meta, `/programs/` index table, `/register/` inclusions list) now reads "adaptive soccer". General DEI/inclusion copy untouched.
- [x] **GSC not-found drilldown swept (2026-05-11)** — added 34 redirects covering the GSC "Not found (404)" coverage report (board minute PDFs 2016/2017/2019/2021, 11 Thanksgiving Tournament PDFs, 4 coaching docs, registration flyer, BOSC field map, Sched25, LC City Council policy PDF, `/index.php`, `/arcadia-city-hall-soccer-field/`, `/schedule/schedule-faq/`, 4 WP image attachment pages). 7 of the original 42 URLs were already redirected (`/author/*` + `/become-a-referee-old/*` wildcards covering them); GSC is just slow to recrawl those. `/cdn-cgi/l/email-protection` left 404 (CF infrastructure, no source page to redirect from).

## Branched / staged for later

- **`aqi-feature` branch** — air-quality policy page + AirNow API integration in `workers/weather-api/` are built and on the `aqi-feature` local branch, not yet on `staging`. Worker is already deployed and serves live AirNow data in the `airQuality` block of `/api/weather` (Pasadena / W San Gabriel Vly area). Page UI changes (AQI stat card on `/resources/weather/`, AQI row on `/temp`, alert banner, `?simulate-aqi=N` preview, `/resources/air-quality-policy/` page, nav/footer wiring, `/aqi` + `/air-quality` redirects) are held back. `AIRNOW_API_KEY` is set as a wrangler secret. Resume: `git switch aqi-feature` and merge.

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
│   │   └── fields/       ← Field maps downloaded from ayso13.org
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

Note: Search (`/search/`) only works after a full `npm run build` — not in dev server.

### GSC + GA4 data pulls

OAuth is wired up via the `claude-seo` plugin scripts. Token + property ID live at `~/.config/claude-seo/`. Token auto-refreshes when `oauth_client_path` in `~/.config/claude-seo/google-api.json` points at the OAuth client_secret JSON (file lives at repo root `client_secret_*.json`, gitignored).

```bash
SEO=~/.claude/plugins/cache/agricidaniel-seo/claude-seo/1.9.6/scripts

# GSC
python3 $SEO/gsc_query.py sites                                              # list verified properties
python3 $SEO/gsc_query.py sitemaps -p sc-domain:ayso13.org                    # sitemap status + errors
python3 $SEO/gsc_query.py query -p sc-domain:ayso13.org --days 28 \
    --dimensions page --limit 50                                             # top pages last 28d
python3 $SEO/gsc_query.py query -p sc-domain:ayso13.org --days 28 \
    --dimensions query --limit 50                                            # top queries last 28d
python3 $SEO/gsc_query.py query -p sc-domain:ayso13.org --days 28 \
    --dimensions query,page --limit 500 --json                               # full query→page pairs

# GA4 (property 307558725, default in google-api.json)
python3 $SEO/ga4_report.py -r top-pages --days 28 --limit 100                # top organic landing pages
python3 $SEO/ga4_report.py -r organic   --days 28                            # organic traffic overview
python3 $SEO/ga4_report.py -r device    --days 28                            # by device
python3 $SEO/ga4_report.py -r country   --days 28                            # by country

# Auth check / reauth
python3 $SEO/google_auth.py --check                                          # verify all credentials work
python3 $SEO/google_auth.py --auth --creds <path-to-client_secret.json>      # full re-auth (browser flow)
```

Notes:
- GSC search analytics covers Google web search clicks/impressions only — for 404 hits use `check-404s.sh` (Cloudflare edge logs, 24h retention, free plan).
- GA4 records page_views via gtag, including hits to the 404 page itself (it loads gtag) — landing pages with very high bounce that don't exist as routes are likely 404s.
- The 404 page is `_site/404.html`; the gtag tag is included via `base.njk`.
- Note re GA4 numbers: GA4 reports CTR as a percentage value (e.g., `3.66`), not a fraction — don't multiply by 100 when formatting.

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
- Pages CMS is configured with `branch: staging` in `.pages.yml` — all CMS edits go to staging
- **Branch ruleset on `main`** requires PRs; `magoldman` (Repository admin) bypasses via the workflow's `PROMOTE_TOKEN` PAT
- **Promote to production:** GitHub Actions workflow `.github/workflows/promote-to-production.yml` merges `staging` → `main`
  - From Slack: `/ayso promote` (slack-bot dispatches workflow_dispatch)
  - From GitHub UI: Actions tab → "Promote Staging to Production" → Run workflow → type "promote"
  - The workflow uses `PROMOTE_TOKEN` (classic PAT, repo scope) for git push so it can bypass the branch ruleset
  - **Promote sweeps everything currently on staging into main** — review staging before clicking promote, or any pending CMS edits will ship too
  - On success/failure, the workflow posts to `#notify-website-status` (uses `SLACK_BOT_TOKEN` repo secret)
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
- `announcements.json` — home page announcement bar (`enabled` boolean + `body` markdown); rendered via `markdownify` filter in `home.njk`
- `fieldstatus.json` — home page field status widget (`enabled` boolean + `status` string + `message` string); color-coded Open/Monitoring/Closed; last-updated timestamp from `git log` at build time (Pacific time)
- `sponsors.js` — sponsor logos, URLs, and tier definitions
- `fees.json` — Fall Soccer registration fee schedule (rangeShort + per-tier amounts + sibling discount). Used by `/register/`, `/programs/fall-soccer/`, and `/llms.txt`. Note: `/parents/index.md` is hardcoded because Pages CMS round-trips break Nunjucks template syntax in CMS-edited markdown bodies — when fees change, edit both
- `og.js` — Per-section default OG image fallbacks. When a page has no `heroImage` frontmatter, `base.njk` picks the section default; otherwise the global fallback
- `heroes.js` — Home page hero photo set (5 images with src + alt). Fisher-Yates shuffled at module load, so each Eleventy build emits a different first/LCP image. Rendered via `{% for hero in heroes %}` in `home.njk`; first iteration gets `loading="eager" fetchpriority="high"`, rest stay lazy + hidden until the JS rotation script promotes them

## Site-wide Templates / Patterns
- `_includes/schema-org.njk` — emits JSON-LD on every page based on URL/section/frontmatter: multi-typed `SportsOrganization` + `NonprofitOrganization` + WebSite (homepage; `#org` carries `taxID` 95-6205398 and `nonprofitStatus`), BreadcrumbList (inner pages + ask-the-referee), Place (field pages with `placeAddress` frontmatter), FAQPage + Person for Steve Hawkins (`/referees/ask-the-referee/`, in a single `@graph` so each Answer's `author` references the Person `@id`), SportsEvent (programs pages with both `eventStartDate` + `eventEndDate` frontmatter set; gates emission on both fields).
- `_includes/_headers.njk` and `robots.njk` — Cloudflare Pages config; branch-aware via `CF_PAGES_BRANCH` env var to block crawlers on staging. Production headers include HSTS (`Strict-Transport-Security: max-age=31536000; includeSubDomains`), CSP-Report-Only, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy.
- `llms.njk` → `/llms.txt` — AI/LLM crawler summary, pulls live values from `site.json` and `fees.json`
- **InLeague Register button auto-style** — a build-time transform in `.eleventy.js` finds `<a href="https://ayso13.inleague.com/app">Register…</a>` and adds `class="btn-primary text-lg px-8 py-4" target="_blank" rel="noopener"`. Editors keep plain markdown links (CMS-safe); buttons render at build time
- **Field Info callout** — frontmatter fields (`parking`, `restrooms`, `surface`, `lighting`, `snackBar`) on field pages render as a "Field Info" cream callout at the top of the article when populated. Empty by default; CMS exposes the fields for fields-coordinator to fill in
- **Per-page noindex** — frontmatter `noindex: true` emits `<meta name="robots" content="noindex,nofollow">` AND drops the `data-pagefind-body` attribute on the main element so Pagefind site search excludes the page

## Files
- `CLAUDE.md` — This file
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
- `/workers/weather-api/` — Cloudflare Worker that powers `/resources/weather/`. Cron-polls Tempest station 33318 + NWS forecast every 5 min, computes WBGT, tracks rolling rainfall in KV, serves at `www.ayso13.org/api/weather` (also bound on `staging.ayso13.org/api/weather`). Deploy with `cd workers/weather-api && npx wrangler deploy`. `TEMPEST_TOKEN` is a wrangler secret (not in git); station ID, lat/lon, and KV id are in `wrangler.toml`. See `workers/weather-api/README.md` for setup details.

---
*Last updated: 2026-05-11 (session 22 — historical content backfill, Celebration of Women's Soccer page, GSC quick-win pass, gallery a11y + SRI fixes, EPIC descriptor reframe, GSC 404 sweep)*
