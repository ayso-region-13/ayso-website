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
- [x] Add FIS Upper and FIS Lower field pages
- [x] Build volunteer training matrix — `/volunteers/training-matrix/`
- [ ] Review and refine site ← **IN PROGRESS at https://new.ayso13.org**
- [ ] Content review edits from Slab ← **IN PROGRESS**
- [x] Create redirect mapping (159 old URLs → `site/src/_redirects`)
- [x] Deploy to Cloudflare Pages ← **LIVE at https://new.ayso13.org**
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
│   │   ├── base.njk      ← HTML shell, sticky header, footer, mobile nav
│   │   ├── page.njk      ← Standard content page (breadcrumb, sidebar, prose)
│   │   ├── home.njk      ← Home page layout (hero, programs grid, etc.)
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

| Color | Hex |
|-------|-----|
| Red (primary) | `#ce0e2d` |
| Green | `#00ae42` |
| Gold (CTA) | `#f1d516` |
| Dark | `#231f20` |

Font: Inter (system fallback)

**Color hierarchy:** Top nav = dark green (`bg-brand-green-dark` / `#007a32`) → Page header = brand green (`bg-brand-green`) with dark text → Content area = white. Gold buttons (`bg-brand-gold text-brand-dark`). Red prose headings (H1–H3 in `.prose`). Green for sidebar strips, hover states, and checkmarks (use `text-green-800` for text on white — `#00ae42` fails WCAG contrast). Never place red and green adjacent.

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

## CMS
Pages CMS is configured for non-technical editors at https://app.pagescms.org.

- Config file: `.pages.yml` in the repo root
- Editors log in at app.pagescms.org — no GitHub account required
- Edits commit directly to `main` and trigger a Cloudflare Pages rebuild
- Layout, section, and permalink fields are hidden from editors
- To add/remove editors: manage via the Pages CMS web interface
- To add a new content field: update `.pages.yml` and commit

## Files
- `CLAUDE.md` — This file
- `todo.md` — Active task list
- `.pages.yml` — Pages CMS configuration
- `links-to-resolve.md` — 36 `[INLEAGUE: ...]` placeholders still needing real URLs (forms, Google Drive links, external services)
- `proposed-site-structure.md` — Original IA proposal with old→new URL mapping
- `website-builder-comparison.md` — Platform research (now superseded by Eleventy decision)
- `/content/` — Source Markdown files (migrated into `site/src/` via migrate-content.js)
- `/site/` — The actual Eleventy site (active development)
- `/logo/` — Logo assets

---
*Last updated: 2026-04-06 (session 4)*
