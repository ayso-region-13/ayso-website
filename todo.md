# AYSO Region 13 — Post-Launch Backlog
**Live:** https://www.ayso13.org → **Staging:** https://staging.ayso13.org

🚀 **Site launched 2026-05-01** — DNS cutover complete, SSL active, GA recording, schema validated.

---

## Workflow
```
Edit in CMS or GitHub → commits to staging → staging.ayso13.org
  → review → /ayso promote (Slack) → www.ayso13.org
```

⚠️ **Promote sweeps everything currently on staging into main.** Before clicking promote, check `git log origin/main..origin/staging --oneline` to see what's about to ship.

---

## Remaining Tasks

### Content
- [ ] **Each season, update season-specific schedules** — `/programs/next/` (per-division day/time/field once Spond groups are set) and `/programs/preschool/` (exact start date and location before August). Generalized for now to avoid stale 2025 data.
- [ ] **Fill in field facility info** — Pages CMS now exposes `parking`, `restrooms`, `surface`, `lighting`, and `snackBar` fields on every field page. When populated, they render as a "Field Info" callout at the top of the page. Priority pages (most visited on game days): Victory Park, Blair, McKinley, LCHS, Muir, La Salle. Fields coordinator (Jessica Ferree, fields@ayso13.org) and practice fields coordinator (Rolf Mauermann, rolf@ayso13.org) have the operational knowledge.

### Post-Launch (this week)
- [ ] Announce launch internally
- [ ] Monitor 404s for 48 hours — Cloudflare Pages analytics → Error rates
- [ ] **Verify or create Google Business Profile** — search "AYSO Region 13 Altadena" on Google Maps; if listing exists, claim it at business.google.com; if not, create one. Primary category: "Soccer Club" (fallback: "Youth Organization"). Service area: Pasadena, Altadena, La Cañada Flintridge. Highest-leverage local SEO action per /seo audit.
- [x] **Submit sitemap to Google Search Console** — submitted 2026-05-01
- [x] **Retire `new.ayso13.org`** — retired 2026-05-01

### Post-Launch (later)
- [ ] **Set up GA4 API access for Claude** — for in-conversation analytics queries. Service account path was blocked (GA4 Workspace config rejects non-Google-account emails: "This email doesn't match a Google Account"). OAuth path is the fallback: create an OAuth Client (Application type: Desktop app) in GCP project `ayso13-seo`, configure the OAuth consent screen as External + add yourself as test user, download the client_secret JSON, then run `python ~/.claude/plugins/cache/agricidaniel-seo/claude-seo/1.9.6/scripts/google_auth.py --auth --creds /path/to/client_secret.json` and grant scopes in the browser. Save GA4 Property ID (9-digit number from GA4 Admin → Property Settings) for the config file at `~/.config/claude-seo/google-api.json`. CF Web Analytics is doing the day-to-day reporting in the meantime.
- [ ] **Add Steve Hawkins bio** to `/referees/ask-the-referee/` — short attribution block (1-2 sentences) noting his role as Region 13's Advisor on the Laws of the Game and the Michael Walizer Award (Lifetime Service as Referee, 2016 — see `/about/hall-of-fame/`). Strengthens E-E-A-T on the page that's most likely to be cited by AI search tools for AYSO rules questions. Coordinate with Steve on phrasing.
- [ ] **Add Content-Security-Policy header** — Defense-in-depth XSS mitigation. Recommended approach: ship as `Content-Security-Policy-Report-Only` first (logs violations without blocking) for ~1 week, then promote to enforcing. Sources to allow: GTM/GA, fonts.googleapis.com + fonts.gstatic.com (Google Fonts), maps.google.com + www.google.com (Maps embeds), calendar.google.com (calendar embed), scheduler.leaguelobster.com (Spring schedule), typeform.com (feedback + field issues), eepurl.com / EmailOctopus (newsletter), script.google.com (forms upload tool). Inline scripts/styles will need 'unsafe-inline' or hashes/nonces.
- [ ] **Audit `<img>` `sizes` per-element** — Default + high-impact overrides (hero, program tiles, gallery, affiliate logos) shipped before launch. Body-content images, field map images, sponsor strip, and other non-hero use the default `(min-width: 800px) 800px, 100vw`. A full per-image audit would tighten image bandwidth further on field map images and any other images that render at non-standard sizes.
- [ ] **Implement IndexNow protocol** — Free instant URL submission to Bing, Yandex, and Naver. Generate an IndexNow API key, place at `/site/src/<key>.txt` (passthrough copy), and add a Cloudflare Pages deploy hook or GitHub Action that POSTs `{ host, key, urlList }` to `https://api.indexnow.org/` after each main-branch deploy. Useful for field-status changes and announcements that change in near-real-time.
- [ ] **Update or annotate `/about/board-minutes/` archive** — Posted minutes stop at 2022. Either post 2023–present minutes, or add a one-line note explaining why the public archive stops there (e.g. transition to a different records system). Authority signal for AI/E-E-A-T.
- [ ] **Replace XXX placeholders on `/programs/extra/`** — Page is `noindex` so it's hidden from search, but anyone with a direct link sees "Tryouts will take place on XXX at XXX" and "2026 EXTRA™ Registration: $XXX." Fill in the actual values when EXTRA program details are confirmed and remove the `noindex: true` flag from front matter to publish.

---

## Completed ✓

### Session 14 (2026-04-30 → 2026-05-01) — LAUNCH NIGHT
- [x] **Site launched** — DNS cut over to www.ayso13.org with active SSL; apex `ayso13.org` redirects 301 to www
- [x] **Repo went public** — `gh repo edit ayso-region-13/ayso-website --visibility public`
- [x] **Branch ruleset on `main`** — requires PRs; `Repository admin` bypasses; promote workflow uses classic PAT (`PROMOTE_TOKEN` repo secret) for the bypass
- [x] **Slack notifications on promote** — workflow posts ✅/❌ to `#notify-website-status` on completion (uses `SLACK_BOT_TOKEN` repo secret)
- [x] **Slack bot icon** at `slack-bot/icon.png` (512×512 logo render); google workspace logo source files at `/logo/`
- [x] **Spring Soccer added** to home tile lineup (replacing Grad Series in lead position) + dedicated tile photo
- [x] **17 interior page hero images refreshed** from brand-team batch; canonical filename pattern `{slug}-interior.jpg`
- [x] **Spring Soccer schedule callout** at top of `/programs/spring-soccer/` with League Lobster links for 10U/12U/14U; cream-box pattern (approved exception to /impeccable side-stripe rule)
- [x] **EXTRA stub page** at `/programs/extra/` — noindex, not linked, awaiting tryout details
- [x] **Per-page noindex mechanism** — frontmatter `noindex: true` emits robots meta + drops `data-pagefind-body`
- [x] **Region 13 Calendar page** at `/about/calendar/` — embeds public Google Calendar; About menu reorganized
- [x] **Leadership directory** rewritten from `Board directory 2026.csv`
- [x] **Field status text** ("All fields open") + announcement bar ("Fall Registration is Now Open") updated
- [x] **/parents polish** — em-dashes → colons, Grad Series row added to programs table, big yellow Register CTA via auto-style transform
- [x] **Fall Soccer fees bumped** $210/$225/$240 → $220/$235/$250
- [x] **Pre-launch /seo audit (22 of 28 items resolved):**
  - Staging crawl block via `CF_PAGES_BRANCH` detection in `_headers.njk` + `robots.njk`
  - Cloudflare Rocket Loader fix on GA (`data-cfasync="false"`)
  - Three different fee schedules reconciled in `_data/fees.json`
  - **JSON-LD schema site-wide** via `_includes/schema-org.njk`: SportsOrganization + WebSite (homepage), BreadcrumbList (inner pages), Place on 22 field pages (added `placeAddress` / `placeLocality` / `placePostalCode` frontmatter), FAQPage on Ask the Referee
  - Sitemap lastmod + `[DATE]` placeholder both fixed (script + key format alignment)
  - `/llms.txt` for AI search via `llms.njk` template
  - Image `sizes` per-element overrides (hero, program tiles, gallery, affiliate logos)
  - HTML age chart (12×17 table) replacing PNG-only on `/register/age-chart/`
  - Hero LCP swap fix — wrappers hidden until JS picks one (no wasted high-priority preload)
  - 8th Children's Right restored on `/about/` from Project Play canonical list, with link
  - 501(c)(3) statement on `/about/` (EIN 95-6205398, AYSO national parent)
  - `/fields/` page renamed "Field Maps"
  - `/contact/` ZIP codes added + tel: links on phone numbers
  - Per-section OG image defaults via `_data/og.js`
  - Distinct alt text on all 8 home hero/gallery photos
  - **InLeague Register button auto-style** transform — `[Register on InLeague](url)` markdown becomes `<a class="btn-primary text-lg px-8 py-4">` at build time. CMS-safe pattern: editors keep plain markdown links
  - **Field Info callout** — frontmatter-driven (parking, restrooms, surface, lighting, snackBar); renders only when populated
  - External link checker tightened — skips preconnect, falls back to GET on HEAD failure
- [x] Documentation updated: CLAUDE.md (this section), todo.md (this file), several memory entries (cream-box exception, no-auto-push, CMS template-tag mangling)

### Session 13 (2026-04-26)
- [x] INLEAGUE newsletter signup links resolved — Region 13 Referee Newsletter + WhistleStop Newsletter URLs wired up (referees/resources, resources/newsletters)
- [x] Site-wide negative-to-positive tone sweep — 7 markdown files reframed ("Don't yell at referees" → "Speak respectfully to referees", etc.); deliberate keeps documented for safety/policy prohibitions
- [x] Parent Pledge reframed as Kids Zone — page rewritten to follow AYSO National's authoritative 10 guidelines (kids first, fun > winning, respect referees, etc.); no longer framed as a contract parents sign; site-wide reference sweep across 9 files
- [x] PDFs relocated from old WordPress to local `/assets/docs/`:
  - `concussion-sca-forms.pdf` (used in 2 places)
  - `fifa-11plus.pdf` (resources/safety)
  - `penalty-kick-guidelines-2023.pdf` (referees/laws)
- [x] New `/resources/newsletters/` page — replaces old `/resources/newsletter/`; EmailOctopus subscribe widget copied 1:1 from WP; full archive (97 newsletters, 2021–2025) preserved with original third-party URLs intact
- [x] New `/forms/` page — replicates the WP `/forms/?go=1` Google Apps Script iframe upload tool; same iframe overlay behavior, same script URL, same query-string triggers (`?go=1`, `?go=2`, `?key=`, `?ID=`)
- [x] Gallery page palette fix — green header → cream + maroon, two-tone signature strip added, filter buttons updated to new burgundy `#83312d`, AA contrast on Share callout links
- [x] Link checker hardened — `scripts/check-links.js` now auto-runs `npm run build` before checking; pass `--no-build` to skip; eliminates false positives from dev-server transform-on-request URLs
- [x] Redirect map updates — `/news/` → `/resources/newsletters/`, `/resources/newsletter/` → plural URL; `/forms/` no longer redirects (now serves the upload page directly)
- [x] Leadership table fixed — Operations table was rendering only 2 of 3 columns (header declared `Role | Name`, rows had Role/Name/Email); now full 3 columns visible with all email addresses
- [x] Horizontal rules stripped — 536 standalone `---` body separators removed across 77 markdown files
- [x] Prose H2 underline removed — `border-b border-gray-200` on every `.prose h2` was the source of the gray line under "Quick Facts", "How Registration Works", etc.

### Session 12 (2026-04-26)
- [x] Sponsor strip removed from home page (commented out in home.njk for easy re-enable)
- [x] Sponsor logos removed from /volunteers/sponsors/ page; page now leads with "Become a Sponsor" tier cards + how-to-contribute info
- [x] Wide hero strip removed from interior page template (page.njk); body imagery only
- [x] Hero image moved into body markdown for the 2 pages that had hero only (wca, winter-stars)
- [x] Page H1 weight bumped to font-extrabold for stronger headline
- [x] 100 markdown files swept: duplicate `# Title` and description-rephrase intro paragraphs removed; substantive intros (definitions, dates, tips) kept
- [x] /volunteers/roles/ enhanced — combined with authoritative content from old ayso13.org/roles; added 12 missing roles; existing role descriptions enriched; reorganized General Board into 6 subgroups
- [x] Lighter red strip added below maroon quick-action bar (above field status bar)
- [x] "I'm a soccer..." panel given brand-red border-4
- [x] New logo SVG (red/pink design) — squared viewBox, regenerated favicons via rsvg-convert (true transparency)
- [x] Brand palette refresh:
  - brand-red: #ff3c3c → #f74b4b (coral)
  - brand-red-dark: #ce0e2d → #83312d (burgundy; contrast improves: white-on-dark goes 5.83→8.6:1)
  - brand-cream: #ede5d3 → #ede8e2 (cooler off-white)
  - brand-header, brand-dark, brand-green, brand-gold: small palette-matching tweaks
- [x] Random hero on page load — 5 candidate images at site/src/images/home/region13_home_*.jpg; JS picks one each load; image 1 is no-JS fallback (loading=eager + fetchpriority=high), 2-5 hidden + lazy
- [x] Highlighter-bar text overlay for hero (white-on-red bar + red-on-white bar, semi-transparent)
- [x] OG image fallback set to /images/home/region13_home_5.jpg
- [x] New branded home imagery installed: 6 program tiles (tile_core, tile_preschool, tile_upper, tile_allstars, tile_grad, tile_epic) + 3 gallery photos (gallery_1/2/3)
- [x] Audit pass (19/20 → resolved 3 items): Ask the Referee Related Pages links, sponsor strip hover, tile subtitle weight bumped to large-text qualifying
- [x] Documentation updated: claude.md (palette + last-updated), brand-colors.md (full palette refresh), site-overview.md (Slab-friendly summary)

### Session 11 (2026-04-26)
- [x] Home page redesign — huge SOCCER FOR EVERYONE hero, two-tone alternating buttons, Let's Play tiles with semi-transparent inset labels (alternating dark red / maroon bodies)
- [x] Header redesign — light/white background, dark nav text, inLeague pill button replacing the gold Register CTA
- [x] New logo SVG (recolored) — replaced existing; viewBox made square (`0 -13.7295 264.817 264.817`) so square containers don't distort it
- [x] Brand palette refresh — `brand-red` #ff3c3c (bright accent), `brand-red-dark` #ce0e2d (logo red, primary), added `brand-cream` #ede5d3, `brand-maroon-dark` #3a0d12; `brand-green` to #a7ce57; `brand-gold` to #f5bd4e
- [x] Site-wide font swap: Inter → Raleway (Google Fonts, weights 300–900)
- [x] Image optimization pipeline — `@11ty/eleventy-img` plugin auto-converts every `<img>` to `<picture>` with AVIF + WebP + JPEG variants at 600/1200/1920w
- [x] Interior page redesign — `bg-red-50` → `bg-brand-cream` for page header, `text-red-900` → `text-brand-maroon` for breadcrumb/description, `bg-brand-red` → `bg-brand-maroon` for sidebar header bar, two-tone signature strip below page header
- [x] Site-wide WCAG AA contrast pass — prose H1/H2/H3 + body links to `brand-red-dark`, sidebar hover/active states, desktop nav hover/active, skip-to-main focus, Ask the Referee category headings + TOC links
- [x] Favicon transparency fixed — regenerated via `rsvg-convert` (ImageMagick was rasterizing with opaque white in padded areas)
- [x] `.impeccable.md` design context document — locks in personality, brand principles, locked-in colors/font/logo
- [x] `brand-colors.md` — full palette with hex, RGB, usage notes, contrast cheat-sheet
- [x] `site-overview.md` — Slab-friendly site summary for the team wiki

### Session 10 (2026-04-19)
- [x] Ask the Referee — rebuilt as accordion FAQ with 30 Q&As in 7 categories (ask-the-referee.njk layout)
- [x] Pages CMS qa-answers collection — Steve can add Q&As via form UI (question, category, answer); date auto-set from git commit
- [x] Fixed redirect `/ask-the-referee` → `/referees/ask-the-referee/` (was pointing to `/referees/faqs/`)
- [x] Fixed `TemplateContentUnrenderedTemplateError` — use `layout: false` + `noindex: true` instead of `permalink: false` for Q&A files
- [x] Fix `/ayso promote` merge conflict — workflow now uses `-X theirs` so staging always wins; synced workflow file on both branches
- [x] Promoted staging → production (www.ayso13.org)

### Session 9 (2026-04-19)
- [x] Fields audit — added 4 missing field pages: Butler, Cornishon, LC LDS, Pasadena HS
- [x] Field pages — Problems & Contact section on all 22 field pages (Rolf text + Typeform link)
- [x] Area H — updated with specific rules (Mon–Thu until dark, Fields 1–4 only, no Fridays)
- [x] Removed Marco's personal number from all field pages
- [x] NODE_VERSION updated to 22 in Cloudflare Pages (done by user)

### Session 8 (2026-04-19)
- [x] Slack bot (`/ayso`) — field status, announcements, and promote (staging → main) all working
- [x] `/ayso promote` — triggers GitHub Actions workflow; posts result to #notify-website-status
- [x] User allowlist — `slack-bot/allowed-users.json` (editable without secrets)
- [x] Google Analytics — GA4 tag (G-9YM9ZDW1J9) in base.njk, conditioned on `site.gaId`
- [x] robots.txt — fixed sitemap URL to `https://www.ayso13.org/sitemap.xml`
- [x] FIS Upper/Lower — address corrected to 4320 Cornishon Ave, La Cañada Flintridge

### Session 7 (2026-04-19)
- [x] Board minutes archive — 79 PDFs self-hosted at `/assets/docs/minutes/`, page updated with all links (2014–2022)
- [x] Google Maps embeds — all 17 field pages (auto-generated from existing address links)
- [x] Resolved 28 of 30 INLEAGUE link placeholders (scraped real URLs from ayso13.org)
- [x] Deleted `/content/` folder — all content lives in `site/src/`

### Session 6 (2026-04-07)
- [x] Site color redesign — dark header (`#230612`), maroon quick action bar (`#8e2929`), updated red/gold
- [x] Announcement bar moved below hero (field status stays at top)
- [x] All 18 field pages standardized — consistent layout, map embeds, sidebar fix, HRs removed
- [x] Pages CMS `branch: staging` cherry-picked to main so CMS targets correct branch
- [x] Slack bot plan documented in `slack-bot/SETUP.md`

### Earlier Sessions
- [x] Crawl existing site (159 pages)
- [x] Propose new IA (~75 pages)
- [x] Write all 97 content pages
- [x] Upload content to Slab for review
- [x] Choose platform (Eleventy + Tailwind CSS)
- [x] Scaffold Eleventy site in `/site/`
- [x] Build base/page/home layouts (Nunjucks)
- [x] Build full navigation (desktop dropdown, mobile accordion, section sidebars)
- [x] Migrate content from `/content/` into `site/src/`
- [x] Add photos (65 images) and logo
- [x] Set up build scripts (migrate, file-dates, photo processing, link checking)
- [x] Tailwind brand colors — red, green, gold
- [x] Verify all internal links — 0 broken
- [x] SEO & OpenGraph — canonical, og tags, unique descriptions on all 95 pages
- [x] sitemap.xml and robots.txt
- [x] Photo gallery — `/resources/gallery/` with GLightbox, 62 photos, category filter
- [x] Site search (Pagefind) — `/search/`, footer search box
- [x] Field maps — all field pages; FIS Upper/Lower pages created
- [x] Set up Pages CMS (`.pages.yml`)
- [x] Announcement bar — editable via CMS, toggle + rich-text
- [x] Field status widget — color-coded Open/Monitoring/Closed, Pacific-time last-updated
- [x] Ask the Referee — standalone page, 30 Q&As
- [x] Volunteer training matrix
- [x] Age chart — updated for Fall 2026 cutoff change
- [x] AYSO philosophies bar + affiliate logos in footer
- [x] Custom 404 page
- [x] Accessibility audit (WCAG 2.1 AA)
- [x] Security audit — no secrets, headers file, GLightbox pinned
- [x] Create redirect map (159 old URLs + 76 WordPress rules)
- [x] Deploy to Cloudflare Pages — live at new.ayso13.org
- [x] staging.ayso13.org custom domain configured
- [x] Promote-to-production GitHub Actions workflow created
