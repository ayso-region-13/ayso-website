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
- [x] **Repo made public** + branch ruleset on `main` requires PRs (PROMOTE_TOKEN PAT bypass for the workflow)
- [x] **Slack notifications on promote** — `/ayso promote` and the workflow now post success/failure to `#notify-website-status`
- [x] **Launched** — DNS cut over to www.ayso13.org on 2026-05-01

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
```

Note: Search (`/search/`) only works after a full `npm run build` — not in dev server.

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

## Site-wide Templates / Patterns
- `_includes/schema-org.njk` — emits JSON-LD on every page based on URL/section/frontmatter: SportsOrganization + WebSite (homepage), BreadcrumbList (page.njk inner pages + ask-the-referee), Place (field pages with `placeAddress` frontmatter), FAQPage (`/referees/ask-the-referee/` from `collections.qaAnswers`)
- `_includes/_headers.njk` and `robots.njk` — Cloudflare Pages config; branch-aware via `CF_PAGES_BRANCH` env var to block crawlers on staging
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

---
*Last updated: 2026-05-01 (session 14 — site launched)*
