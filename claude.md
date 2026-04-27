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
- [x] Image optimization pipeline — `@11ty/eleventy-img` auto-converts every `<img>` to `<picture>` with AVIF + WebP + JPEG variants at 600/1200/1920w
- [x] Interior page design alignment — cream surface, maroon sidebar header, two-tone strip below page header
- [x] Accessibility hardening — site-wide WCAG AA contrast pass on prose headings, links, nav, sidebar, field status bars
- [ ] Review and refine site ← **IN PROGRESS at https://staging.ayso13.org**
- [x] Create redirect mapping (159 old URLs → `site/src/_redirects`)
- [x] Deploy to Cloudflare Pages ← **staging.ayso13.org / www.ayso13.org**
- [ ] Launch (cut over ayso13.org)

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
- `[IMAGE: description]` — 3 remaining, need original photos (parents/pledge, parents/support, programs/winter-stars)
- `[DATE]` — auto-replaced at build time with file's last-modified date

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

- `staging` branch exists and is live at **staging.ayso13.org** (Cloudflare Pages branch deployment)
- Pages CMS is configured with `branch: staging` in `.pages.yml` — all CMS edits go to staging
- **Promote to production:** GitHub Actions workflow `promote-to-production.yml` merges `staging` → `main`
  - From GitHub UI: Actions tab → "Promote Staging to Production" → Run workflow → type "promote"
  - From Slack (requires GitHub Slack app): `/github workflow run promote-to-production.yml --repo magoldman/ayso-website`
- `main` branch deploys to **www.ayso13.org** (custom domain in Cloudflare Pages)
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
- `site.json` — phone, email, address, InLeague URL
- `navigation.js` — full nav structure (top nav + section sidebars)
- `fileDates.json` — auto-generated per-file last-modified dates
- `announcements.json` — home page announcement bar (`enabled` boolean + `body` markdown); rendered via `markdownify` filter in `home.njk`
- `fieldstatus.json` — home page field status widget (`enabled` boolean + `status` string + `message` string); color-coded Open/Monitoring/Closed; last-updated timestamp from `git log` at build time (Pacific time)
- `sponsors.js` — sponsor logos, URLs, and tier definitions

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
*Last updated: 2026-04-26 (session 11)*
