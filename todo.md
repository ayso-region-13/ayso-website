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
- [ ] **Confirm 2027 program dates** — Once All-Stars 2027 (currently guessed Jan 9 – Mar 13), Winter Stars 2027 (Jan 9 – Feb 27), and Spring Soccer 2026 (Mar 7 – May 30) dates are confirmed, fill in `eventStartDate` / `eventEndDate` frontmatter via Pages CMS to enable SportsEvent schema on those pages. Fall Soccer 2026 already has confirmed dates wired up.
- [ ] **Expand 13 short Q&As + rebalance Offside category** — 13 of 34 Q&As are under 100 words (below citation threshold for AI engines). Goalkeeper has 15 questions; Offside (most-searched topic) has only 5. Coordinate with Steve to expand short answers to 134+ words and add 5–8 more Offside questions covering AYSO age-group modifications. Skipped in 2026-05-02 audit — Steve's call.

### Post-Launch (this week)
- [x] Announce launch internally — completed 2026-05-02
- [x] **Monitor 404s** — Cloudflare zone analytics → Traffic. Free plan blocks the status-code panel in the dashboard, so use `site/scripts/check-404s.sh` (GraphQL Analytics API; ~24h retention). First-day sweep on 2026-05-02 caught and redirected the actionable 404s (apple-touch-icon, /author/brandi/, WP-uploads images/PDFs, /new/* pre-WP paths, /victory-park-with-4u5u-2024-2/). Email Address Obfuscation enabled in zone Scrape Shield.
- [ ] **Verify or create Google Business Profile** — copy/paste sheet at `gbp-setup.md` (gitignored, root). Includes business name, categories, service area, hours options, 720-char description, services list, photo upload list, verification options, and 3 seed Google Posts. Manual action — must be done from business.google.com with verified ownership.
- [x] **Submit sitemap to Google Search Console** — submitted 2026-05-01
- [x] **Retire `new.ayso13.org`** — retired 2026-05-01

### Post-Launch (later)
- [ ] **Set up GA4 API access for Claude** — for in-conversation analytics queries. Service account path was blocked (GA4 Workspace config rejects non-Google-account emails: "This email doesn't match a Google Account"). OAuth path is the fallback: create an OAuth Client (Application type: Desktop app) in GCP project `ayso13-seo`, configure the OAuth consent screen as External + add yourself as test user, download the client_secret JSON, then run `python ~/.claude/plugins/cache/agricidaniel-seo/claude-seo/1.9.6/scripts/google_auth.py --auth --creds /path/to/client_secret.json` and grant scopes in the browser. Save GA4 Property ID (9-digit number from GA4 Admin → Property Settings) for the config file at `~/.config/claude-seo/google-api.json`. CF Web Analytics is doing the day-to-day reporting in the meantime.
- [x] **Add Steve Hawkins bio** to `/referees/ask-the-referee/` — completed 2026-05-02. Cream-box bio card above Q&As (Region 13 Advisor on the Laws of the Game, Michael Walizer Award 2016, link to Hall of Fame). Person schema added to `_includes/schema-org.njk` with `@graph` containing both Person and FAQPage; every Answer node references `"author": { "@id": "https://www.ayso13.org/#steve-hawkins" }`.
- [ ] **Promote `Content-Security-Policy-Report-Only` to enforcing** — currently in Report-Only mode (logs violations without blocking). After a soak window of real traffic, review the report endpoint, fix any legitimate sources missed, then drop the `-Report-Only` suffix in `_headers.njk`.
- [x] **`<img>` `sizes` per-element audit** — completed 2026-05-01. Photo gallery thumbnails (62 images) tightened from default to `(min-width: 1024px) 20vw, (min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw` — browsers now fetch the 600w variant on desktop instead of the 1200w default. Sponsor strip pre-set to `140px`/`100px` for if/when re-enabled. Body content images (prose-width ~768px) kept on the default since it matches their actual render size; further tightening would save < 5%.
- [x] **IndexNow protocol** — implemented 2026-05-01. `.github/workflows/indexnow.yml` POSTs sitemap URLs to api.indexnow.org on every push to main (after a 150s wait for CF Pages deploy). Key file at `/61d4461c23b7dcda89290711860408d3.txt` for ownership verification.
- [ ] **Update or annotate `/about/board-minutes/` archive** — Posted minutes stop at 2022. Active work — user is handling.
- [ ] **Replace XXX placeholders on `/programs/extra/`** — Page is `noindex` so it's hidden from search, but anyone with a direct link sees "Tryouts will take place on XXX at XXX" and "2026 EXTRA™ Registration: $XXX." Fill in the actual values when EXTRA program details are confirmed and remove the `noindex: true` flag from front matter to publish.
- [ ] **Board minutes archive overhaul** — `/about/board-minutes/` currently lists 2014-2022 only (79 PDFs in `site/src/assets/docs/minutes/`); 2023-present is missing. Drive folder: `~/Library/CloudStorage/GoogleDrive-matthew@ayso13.org/Shared drives/Region 13 Operations/Board & Governance/Agenda & Minutes 2025-2026/`. Plan when picking up: (1) decide what counts as "minutes" for public archive — Minutes only is conventional; (2) decide on archive cutoff — recommend keeping 2024-present public, moving 2014-2023 to Drive archive folder; (3) conversion: 4 months (2025-08, 10, 11, 12) exist as `.docx` and convert easily once LibreOffice is installed (`brew install --cask libreoffice` then `soffice --headless --convert-to pdf *.docx`); rest are `.gdoc` pointers requiring either manual File→Download→PDF in Drive web UI OR Drive API OAuth (deferred along with GA4 setup). Naming convention to match existing repo: `ayso13-board-minutes-{YYYY}-{Month}.pdf`.
- [ ] **Expand SportsOrganization `sameAs` array** — currently only links to `https://www.ayso.org`. Add Google Maps Place URL (after GBP claim), AYSO national region directory link if available, Facebook/Instagram URLs if Region 13 has accounts. Each addition strengthens entity disambiguation in Knowledge Graph.

### Recurring / annual
- [ ] **Refresh IFAB edition note** on `/referees/ask-the-referee/` — IFAB publishes Laws of the Game annually in June. Update the italic line under the page intro from "2025/26" to the new edition.
- [ ] **Update SportsEvent dates each season** via Pages CMS — `eventStartDate` and `eventEndDate` on `/programs/fall-soccer/`, plus future Spring Soccer / All-Stars / Winter Stars when dates are added.

---

## Completed ✓

### Session 16 (2026-05-03) — hero LCP overhaul
- [x] **PageSpeed Insights review on prod** — mobile Performance 79, Accessibility 96, Best Practices 100, SEO 100. Lab LCP 5.1 s flagged as the bottleneck; CrUX field data not yet available (CrUX needs ~28 days post-launch).
- [x] **Hero LCP fix + cross-fade rotation** — root cause was the prior pattern (all 5 hero candidates `display:none + loading="lazy"`, JS un-hides one). The LCP image only started fetching after JS ran. Replaced with: first wrapper renders immediately as the LCP element (`loading="eager" fetchpriority="high"`); after the LCP measurement window closes (first user input or 3 s timeout) the rotation script cycles through the remaining wrappers using `img.decode()` + opacity cross-fade. Cycle ends after one full pass with a random "final" image. 700 ms fade + 5 s dwell ≈ 26 s of motion before the page goes static.
- [x] **`_data/heroes.js`** — moved hero list (5 entries with src + alt) into a data file with Fisher-Yates shuffle at module load, so each Eleventy build emits a different first/LCP image. Per-build variety stacks with the per-page-load JS rotation for effectively unique sequences.

### Session 15 (2026-05-02) — first day post-launch
- [x] **Ask the Referee sort fix** — Q&As now sort by explicit-date desc (frontmatter or YYYY-MM-DD filename prefix), then alpha by question for undated. Eleventy auto-assigns a fallback date to every file, which made the previous sort effectively alphabetical for the 9 undated entries.
- [x] **Capitalization redirects** added: `/Register` → `/register/` and `/Team` → `/families/team/` (single hop, no double-redirect through `/team/`).
- [x] **Status page** — added `/status` → `https://status.ayso13.org/` redirect plus a Status link in the footer bottom row alongside Policies / Feedback / InLeague Login.
- [x] **First-day 404 sweep** — pulled top 404s from Cloudflare zone analytics, redirected 14 paths and added `/new/*` splat for pre-WP catch-all. Apple-touch-icon now served at root via passthrough copy. WP-uploads PDFs/images redirected to closest current page. Created `site/scripts/check-404s.sh` (CF GraphQL Analytics API; 24h retention on free plan) for ongoing monitoring. Email Address Obfuscation enabled in CF Scrape Shield.
- [x] **Steve Hawkins bio + Person schema** — cream-box author bio above Q&As, Person entity in JSON-LD `@graph`, every FAQPage Answer node carries `"author": { "@id": "...#steve-hawkins" }`. Single highest-leverage E-E-A-T move on the site.
- [x] **/register/ reorder** — price callout (open + May 31 deadline + Register CTA) now leads the page; Registration Fees section moved to the top; Pay What You Can immediately under the fee table; How to Register and process steps moved below. Comparison-shopping parents now see cost in the first 3 seconds instead of 5 procedural steps.
- [x] **Meta description rewrites** — home, /register/, /about/. Added "no-tryout" + age range + "everyone plays" SERP differentiators. No prices (avoid annual rot).
- [x] **Citable lead paragraph** on `/programs/fall-soccer/` — 50-word self-contained intro answers "what is AYSO Fall Soccer?" before the bullet-list Quick Facts. Optimizes for AI engines pulling first-paragraph summaries.
- [x] **IFAB edition note** on Ask the Referee — italic line under intro: "Answers reflect the IFAB Laws of the Game 2025/26 edition and applicable AYSO age-group modifications." Temporal anchor for AI citation.
- [x] **SportsEvent schema** infrastructure in `_includes/schema-org.njk` — frontmatter-driven (`eventStartDate` + `eventEndDate`, optional `eventName`); only emits when both dates set. Programs collection in `.pages.yml` exposes the fields. Fall Soccer 2026 has confirmed dates wired up; Spring/All-Stars/Winter Stars left empty pending board confirmation.
- [x] **Multi-typed org schema** — `#org` entity now declares both `SportsOrganization` and `NonprofitOrganization` types. Added `nonprofitStatus: Nonprofit501c3`, `taxID: 95-6205398`. Single source of truth for the org entity site-wide.
- [x] **"Become a Referee" CTA** at the bottom of `/referees/ask-the-referee/` — captures the prospective-ref persona that previously had no conversion path on the page. Links to `/referees/training/`.
- [x] **llms.txt expanded** — added `## Identity` (region disambiguation), `## Contact` (parseable NAP + EIN + founded year inline), and `## License` (citation/attribution policy).
- [x] **Ask the Referee title** — hybrid: "Ask the Referee — Youth Soccer Rules Q&A" (preserves brand for nav, adds search keywords for SERP). Nav menu still says just "Ask the Referee" (separate `label` field in navigation.js).
- [x] **GBP setup doc** at `gbp-setup.md` (gitignored, repo root) — copy/paste sheet for claiming/creating Google Business Profile: business name, categories, service area, hours options, 720-char description, services, photo list, verification, 3 seed Google Posts.
- [x] **HSTS header** added in `_headers.njk` — `Strict-Transport-Security: max-age=31536000; includeSubDomains`. One year, covers all subdomains (www, staging, status). Preload intentionally skipped (irreversible).
- [x] **Disable markdown-it (c)/(r)/(tm) auto-replacement** — typographer rule was converting `501(c)(3)` to `501©(3)` on /about/. Site uses ®/™/em-dashes as direct Unicode already, so disabling the rule loses nothing. Smart quotes stay on (separate rule).
- [x] **Cream-callout pseudo-headings → real H2** — three callouts (Steve Hawkins bio, Become a Referee CTA, Fall 2026 registration callout) were styled `<p class="font-semibold">` elements that screen-reader users navigating by headings would skip. Tailwind preflight resets heading sizes to inherit so the visual is identical. WCAG 1.3.1 / 2.4.6.
- [x] **Footer Status link target** — dropped `target="_blank"` so status pages take focus when visited (users hitting /status/ usually want it to be the foreground tab). InLeague Login on the same row keeps target=_blank.
- [x] **fees.json _editorNote** — documents the fee-duplication contract (which pages hardcode the numbers and why) so future editors know to update /register/, /programs/fall-soccer/, and /families/index.md when fees change.
- [x] **check-404s.sh friendlier auth errors** — surfaces a hint pointing at the API tokens page when CF returns auth-shaped errors, instead of dumping raw JSON.

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
