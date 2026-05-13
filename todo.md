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


### Post-Launch (this week)
- [x] Announce launch internally — completed 2026-05-02
- [x] **Monitor 404s** — Cloudflare zone analytics → Traffic. Free plan blocks the status-code panel in the dashboard, so use `site/scripts/check-404s.sh` (GraphQL Analytics API; ~24h retention). First-day sweep on 2026-05-02 caught and redirected the actionable 404s (apple-touch-icon, /author/brandi/, WP-uploads images/PDFs, /new/* pre-WP paths, /victory-park-with-4u5u-2024-2/). Email Address Obfuscation enabled in zone Scrape Shield.
- [ ] **Verify or create Google Business Profile** — copy/paste sheet at `gbp-setup.md` (gitignored, root). Includes business name, categories, service area, hours options, 720-char description, services list, photo upload list, verification options, and 3 seed Google Posts. Manual action — must be done from business.google.com with verified ownership.
- [x] **Submit sitemap to Google Search Console** — submitted 2026-05-01
- [x] **Retire `new.ayso13.org`** — retired 2026-05-01

### Post-Launch (later)
- [x] **Add Steve Hawkins bio** to `/referees/ask-the-referee/` — completed 2026-05-02. Cream-box bio card above Q&As (Region 13 Advisor on the Laws of the Game, Michael Walizer Award 2016, link to Hall of Fame). Person schema added to `_includes/schema-org.njk` with `@graph` containing both Person and FAQPage; every Answer node references `"author": { "@id": "https://www.ayso13.org/#steve-hawkins" }`.
- [ ] **Promote `Content-Security-Policy-Report-Only` to enforcing** — currently in Report-Only mode (logs violations without blocking). After a soak window of real traffic, review the report endpoint, fix any legitimate sources missed, then drop the `-Report-Only` suffix in `_headers.njk`.
- [x] **`<img>` `sizes` per-element audit** — completed 2026-05-01. Photo gallery thumbnails (62 images) tightened from default to `(min-width: 1024px) 20vw, (min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw` — browsers now fetch the 600w variant on desktop instead of the 1200w default. Sponsor strip pre-set to `140px`/`100px` for if/when re-enabled. Body content images (prose-width ~768px) kept on the default since it matches their actual render size; further tightening would save < 5%.
- [x] **IndexNow protocol** — implemented 2026-05-01. `.github/workflows/indexnow.yml` POSTs sitemap URLs to api.indexnow.org on every push to main (after a 150s wait for CF Pages deploy). Key file at `/61d4461c23b7dcda89290711860408d3.txt` for ownership verification.
- [ ] **Expand SportsOrganization `sameAs` array** — currently only links to `https://www.ayso.org`. Add Google Maps Place URL (after GBP claim), Facebook / Instagram URLs if Region 13 has accounts. Strengthens entity disambiguation in Knowledge Graph.
- [ ] **Auto-notify Slack on weather closure threshold trip** — extend `workers/weather-api/src/index.js` so the Worker posts to Slack (`#notify-website-status` or a dedicated channel) when `closureRecommended` transitions false→true (heat WBGT ≥ 5, rain >0.25"/48h, or rain >1"/72h) and again when it transitions back to false. Track previous state in KV (`closure:lastState`) so the Worker only notifies on transitions, not every 5-min tick. Implementation: add `SLACK_WEBHOOK_URL` (or reuse `SLACK_BOT_TOKEN` + channel id) as a wrangler secret, post message like "Advisory: WBGT is at Level 5 — consider closing fields. Use `/ayso field` to act." with a link to `/resources/weather/`. Closes the manual-checking gap for the board: today they have to remember to look at the weather page to catch automated advisories.
- [ ] **Migrate Pagefind to Component UI** — `/search/` currently uses the Default UI (`<script src="/pagefind/pagefind-ui.js">` + `new PagefindUI({...})` in `site/src/search.njk`). Pagefind ≥1.5.0 ships a newer **Component UI** with a search modal, better accessibility, and web-component-slot customization. Default UI is still supported and not deprecated; CF Pages prints a notice on every build recommending Component UI for new integrations. Migration cost ~30 min + visual QA. Low priority — revisit only if Pagefind announces a deprecation timeline. Docs: https://pagefind.app/docs/search-ui/
- [ ] **Land air-quality work from `aqi-feature` branch** — `/resources/air-quality-policy/` page + AirNow API integration in `workers/weather-api/` are both built and live on the `aqi-feature` local branch (commits `44e5198` + `3f92158`). The deployed Worker is already serving live AirNow data in the `/api/weather` envelope's `airQuality` block (production endpoint returns AQI for the W San Gabriel Vly reporting area). Page UI changes (new "Air Quality (AQI)" stat card on `/resources/weather/`, AQI row on `/temp`, alert banner, `?simulate-aqi=N` preview mode), policy page, navigation/footer/cross-link wiring, `/aqi` + `/air-quality` redirects, and Worker code are held back from staging until ready. Resume: `git switch aqi-feature` and merge to staging.
- [ ] **Slack integration for NWS weather warnings** — separate from our derived closure-threshold notifications. Pick up active alerts directly from NWS (`https://api.weather.gov/alerts/active?point=34.1478,-118.1445`) — heat advisories, severe-weather warnings, air-quality alerts, lightning, etc. Worker polls every 5 min (already running cadence), tracks alert IDs in KV to avoid duplicates, posts new/updated/expired alerts to a dedicated Slack channel (e.g. `#weather-watch`). Format includes the NWS event type, severity, expected duration, and the NWS alert URL. Complements but does not replace the AYSO-derived closure-threshold notify above.
- [ ] **Forecast notice — heads-up Slack post when rain is predicted** — proactive complement to the reactive "rain threshold tripped" notify. Cron job (or piggyback on the existing 5-min weather refresh) inspects the NWS 14-period forecast we already cache; when probability of precipitation exceeds X% (e.g. 60%) for any period in the next 24/48/72 hours, post to a dedicated Slack channel (e.g. `#weather-watch` or similar). Throttle: post at most once per 24 h per forecasted event so the channel doesn't get spammed across cron ticks. Goes alongside (not instead of) the existing closure-threshold-trip todo above.

### Recurring / annual
- [ ] **Refresh IFAB edition note** on `/referees/ask-the-referee/` — IFAB publishes Laws of the Game annually in June. Update the italic line under the page intro from "2025/26" to the new edition.
- [ ] **Update SportsEvent dates each season** via Pages CMS — `eventStartDate` and `eventEndDate` on `/programs/fall-soccer/`, plus future Spring Soccer / All-Stars / Winter Stars when dates are added.

---

## Completed ✓

### Session 23 (2026-05-12) — form audit + Tournament Coordinator role
- [x] **Site-wide forms inventory** — produced CSV at `~/Downloads/ayso13-forms-inventory-2026-05-12.csv` (27 unique form URLs across 6 services: InLeague, Typeform, Google Forms, LeagueLobster, Jotform, Stripe + 1 Google Apps Script + the local `/forms/` wrapper). Columns: Topic, Form name, URL, Service, Pages, Notes. Flagged clarity issues: reimbursement form in 4 pages without a canonical home, withdrawal form in 3, sponsor in 2, `/forms/?go=1` has cryptic flag + no nav entry, duplicate referee-feedback URLs.
- [x] **Form URL canonicalization** — replaced 6 stale `https://ayso13.inleague.com/eTrainu/index/` references across 5 files with the current `https://ayso13.inleague.com/app/eTrainU` path; deduplicated the two Typeform referee-feedback URLs (`/to/DpPtKysI` → `/referee-fb`) so `/contact/feedback/` uses one canonical endpoint.
- [x] **Home title append** — `<title>` now reads "Pasadena Youth Soccer League | Making Friends Through Soccer | AYSO Region 13" (frontmatter set to the first two segments; `base.njk` appends the brand). Superseded an in-flight Pages CMS commit that had baked the brand into the frontmatter itself, which would have rendered "AYSO Region 13" twice.
- [x] **Tournament form launched** — `https://ayso13.typeform.com/tournament-form` (Typeform for coaches applying to attend tournaments outside Region 13) added to `/coaches/tournament-teams/` (Step 1 of Application Process is now a link) and `/programs/tournaments/` (new "Coaches: Apply to Attend a Tournament" sub-section).
- [x] **Tournament Director / Tournament Coordinator split** — two distinct roles documented on `/about/leadership/`: Tournament Director (Patrick Shopbell, `td@ayso13.org`) runs OUR Region 13 tournaments (Thanksgiving + Bill Owen Spring Classic); Tournament Coordinator (Ben Hernandez-Stern, no email yet) helps Region 13 coaches register for tournaments elsewhere. `/coaches/tournament-teams/` Key Contacts table updated: full names from Leadership page, Patrick as RC for approvals (was stale "Terry"), Ron Johnson as Uniforms contact (was stale "Celina, Equipment"), Ben added as Tournament Coordinator. `/programs/tournaments/thanksgiving.md` and `/volunteers/roles.md` retained "Tournament Director" wording (those describe Patrick's job).
- [x] **GSC not-found drilldown sweep (2026-05-11)** — pulled the GSC Coverage drilldown CSV (42 URLs in the "Not found (404)" bucket). 7 were already redirected (`/author/*` and `/become-a-referee-old/*` wildcards caught them; GSC just hadn't recrawled). Added 34 new redirects: 5 board-minute PDFs, 11 Thanksgiving Tournament PDFs, 4 coaching/referee docs, registration flyer, BOSC field map, Sched25_f, LC City Council policy PDF, plus 7 attachment/path redirects (`/index.php`, `/arcadia-city-hall-soccer-field/`, `/schedule/schedule-faq/`, 4 WP image-attachment pages). `/cdn-cgi/l/email-protection` left 404 (Cloudflare email-obfuscation endpoint).
- [x] **EPIC descriptor reframed: "inclusion program" → "adaptive soccer" (2026-05-09)** — every EPIC-program-descriptor reference (home tile sub, llms.txt, `/about/inclusion/` description + Related Pages, `/programs/epic/` meta, `/programs/` index table, `/register/` inclusions list) now reads "adaptive soccer". General DEI/inclusion copy (the standalone `/about/inclusion/` page body, recreational-and-inclusive AYSO descriptions, Inclusive Coaching Reference) untouched.

### Session 22 (2026-05-08) — historical pages + GSC quick-win pass
- [x] **Past Commissioners page** — new `/about/past-commissioners/` with the full 1974–present list (30 commissioners) extracted from WP export, reverse-chronological. Added "Past Commissioners" to the About sidebar.
- [x] **Hall of Fame backfill from WP export** — added Notable Referees annual award (2023–2025), extended Walizer Award back to 1997 (14 winners), extended Bill Carroll Award back to 1996 (15 winners).
- [x] **History page expansion** — added "why 13?" origin (Pasadena/Altadena/La Cañada split from Arcadia Region 2 in 1972, took the only unused number), Edward Lapointe Brookside dedication, split Victory Park lights into 1986/1989/1997, added Muir + Pasadena HS sprinkler rehab, added La Cañada Youth Sports Coalition section.
- [x] **Celebration of Women's Soccer page** — new `/about/celebration-of-womens-soccer/` page rebuilt from the 2022 Wix recap site. 35-photo lightbox gallery using GLightbox. Standard `page.njk` layout (sidebar + breadcrumb), excluded from main nav, reachable via Sisterhood Background section, Related Pages list, and 2022 row in History timeline.
- [x] **GSC quick-win pass** — pulled 28-day GSC + GA4 + CF edge data. Added 4 high-traffic redirects (`/age-chart-2025`, `/ayso-history`, `/4u-playground`, `/b14u-spring-schedule-2026`) for paths still getting hits. Rewrote home page title to "Pasadena Youth Soccer League | AYSO Region 13" (was "AYSO Region 13 — Youth Soccer for the Pasadena Area") to lead with the local query intent. Brookside lead paragraph + meta description now explicitly cite the Rose Bowl Stadium for the "rose bowl park" query (pos 8.6, 73 imp/mo). History page now opens with a bold sentence defining the AYSO acronym for the "what does AYSO stand for" query (pos 7.1, 77 imp/mo).
- [x] **GSC/GA4 docs added to CLAUDE.md** — full command reference under Key Scripts. `oauth_client_path` added to `~/.config/claude-seo/google-api.json` so token auto-refresh works without re-running browser flow. `client_secret_*.json` added to `.gitignore`.
- [x] **Volunteer Open Roles page** — new `/volunteers/open-roles/` listing currently open positions; linked from Volunteers sidebar. Volunteer link added to Families "I'm also a…" section + footer CTA.
- [x] **CF Pages prod build failure fixed** — duplicate `description:` key in `site/src/fields/allendale.md` frontmatter (introduced by a Pages CMS commit that landed directly on `main` despite the `branch: staging` config). Reformatted to match standard CMS layout.
- [x] **Photo gallery a11y + SRI hardening** — `/audit` run flagged the Celebration page's enumeration alt text ("photo N of 35") as a WCAG 1.1.1 issue and the GLightbox CDN scripts as having no SRI. Fixed both: read every one of the 35 photos and wrote descriptive alt text (group lineups, Cobi Jones speaking, Spieker Field small-sided games, exhibition-match action, etc.); same text used as `data-description` so GLightbox shows real captions in the lightbox. Added sha384 SRI integrity hashes to GLightbox CSS + JS on both `/about/celebration-of-womens-soccer/` and `/resources/gallery/`. Deferred the GLightbox script and gated init on `DOMContentLoaded`.
- [x] **EPIC descriptor reframed: "inclusion program" → "adaptive soccer" (2026-05-09)** — every EPIC-program-descriptor reference (home tile sub, llms.txt, `/about/inclusion/` description + related pages, `/programs/epic/` meta, `/programs/` index table, `/register/` inclusions list) now reads "adaptive soccer". General DEI/inclusion copy (the standalone `/about/inclusion/` page body, AYSO recreational-and-inclusive lines, Inclusive Coaching Reference) left untouched.
- [x] **GSC not-found drilldown swept (2026-05-11)** — pulled the GSC Coverage drilldown CSV (42 URLs in the "Not found (404)" bucket). 7 were already redirected (wildcard coverage caught `/author/*` and `/become-a-referee-old/*`; the rest were specific paths already in `_redirects` — GSC just hasn't recrawled). Added 34 new redirects: 5 board-minute PDFs → `/about/board-minutes/`, 11 Thanksgiving Tournament PDFs → `/programs/tournaments/thanksgiving/`, 4 coaching docs → `/coaches/practice/` or `/referees/resources/`, registration flyer → `/register/`, BOSC field map → `/fields/`, Sched25_f → `/schedules/`, LC City Council policy → `/fields/lchs/`, 7 attachment/path redirects (`/index.php`, `/arcadia-city-hall-soccer-field/`, `/schedule/schedule-faq/`, 4 WP image-attachment pages). `/cdn-cgi/l/email-protection` left 404 (CF infrastructure URL, not actionable).

### Session 21 (2026-05-07) — SportsEvent schema fixes + IndexNow recovery
- [x] **Added 5 missing SportsEvent fields** flagged by GSC: `description`, `image`, `performer`, `organizer.url`, and `offers.validFrom`. Updated `_includes/schema-org.njk`. All program pages with `eventStartDate` + `eventEndDate` set now emit a complete SportsEvent block. Frontmatter optionally overrides `offers.validFrom` via `eventOfferValidFrom`. Verified on `/programs/extra/`. GSC will re-validate over the next 1-2 weeks.
- [x] **Preschool location locked to Victory Park** — page Quick Facts + Schedule sections updated to commit; closes the "Each season, update season-specific schedules" todo (NEXT scheduling delegated to NEXT coordinator separately).
- [x] **Recovered PDFs marked authoritative** — todo closed; the recovered Wayback/Drive PDFs are accepted as the current authoritative versions.
- [x] **IndexNow workflow recovered** — was failing on every push to main with HTTP 403 from `https://www.ayso13.org/sitemap.xml`. Cloudflare's Super Bot Fight Mode (newly enabled in CF dashboard) was challenging the GH Actions runner via IP/AS-number reputation at the edge layer, ABOVE WAF custom rules. WAF Skip rule (managed rules + Super BFM + Browser Integrity Check + Security Level) cleared the rule for residential IPs but couldn't bypass the edge filter on Microsoft Azure runner IPs. Workaround: switched `.github/workflows/indexnow.yml` to fetch the sitemap from the deployment's `pages.dev` preview URL (already exported as `deployment_url` by `wait-for-cf-deploy.sh`). Pages-direct origin bypasses customer-zone WAF entirely. Also hardened the script with a 3-attempt retry loop, byte-size sanity check, file-based parsing (no curl-in-pipeline pipefail brittleness), and explicit error logging that prints the first 500 bytes of any failed response. WAF Skip rule still in place as a defense-in-depth allowlist for any third-party tool using `User-Agent: ayso13-indexnow`.
- [x] **4 new feature todos added** — air-quality policy page, AQI integration in weather-api Worker, NWS weather-warning Slack integration, rain-forecast notice (proactive Slack post). All in Post-Launch (later).
- [x] **Field Info populated on all 22 field pages** — ingested CSV with parking, restrooms, surface, lighting, snackBar for every field. Added a `field-info-bottom` transform in `.eleventy.js` that moves the rendered Field Info callout from the top of `<article>` to just above the "Last updated:" line on public pages (CMS preview still shows it inline at the top via the layout). Closes the long-running facility-info todo.
- [x] **Staging Slack notify reformatted** to match production: bold title, code-formatted SHA, context block with workflow-run link.
- [x] **Air-quality policy + AirNow integration built** on `aqi-feature` branch — Worker deployed and serving live AQI data to `/api/weather`; page-side UI + policy page held back on a feature branch awaiting decision to land. See open todo "Land air-quality work from aqi-feature branch" for resume notes.

### Session 20 (2026-05-06) — GA4/GSC API access + 48 redirects from log analysis
- [x] **Google Search Console + GA4 API access** — OAuth client created in GCP project `ayso13-seo`, consent screen configured (External, test user), token saved to `~/.config/claude-seo/oauth-token.json` with `webmasters` + `analytics.readonly` + `indexing` scopes. GA4 Property ID `307558725` written to `~/.config/claude-seo/google-api.json`. APIs enabled: Search Console, Indexing, GA4 Data, PageSpeed Insights, CrUX. Closes the long-standing GA4-API-access todo.
- [x] **Program schedules + SportsEvent schema for 5 programs** — Preschool (Sept 12 → Nov 14, 2026), NEXT (Sept 2026 → July 2027), All-Stars (Jan 1 → Feb 28, 2027), Spring Soccer (Mar 1 → May 31, 2027), Winter Stars (Jan 1 → Feb 28, 2027). Quick Facts text updated to match. All five emit SportsEvent JSON-LD. Closes "Confirm 2027 program dates" todo.
- [x] **48 legacy URL redirects added** from three log sources:
  - 7 from CF Analytics 404s (concussion form, rosebowl image → /fields/area-h/, board minutes, etc.)
  - 30 from GSC 404 export (apply-to-volunteer, vip → /programs/epic/, fieldmap, region13fields-2, fall-soccer no-slash, ParentPledge.pdf → /families/pledge/, weekly schedule PDFs, picture-day order form, Thanksgiving Tournament team list/maps, ref assignments, etc., plus /author/* wildcard)
  - 18 from GA4 404 page-view filter (case variants /Coach, /Referee/, /newsletter; /board, /cal, /all-about-ayso-region-13, /blair-high-school-map, /new, /programs/region13extra, more WP uploads)
- [x] **`/calendar` redirect repointed** to `/about/calendar/` (was hitting the static `/schedules/calendar/` season overview); the schedules page's "View Calendar" section now explains the live region calendar lives on its own page.
- [x] **`/extra` redirect repointed** from `/programs/` to `/programs/extra/` directly (now that the page exists); also added `/weather` → `/resources/weather/` for symmetry.
- [x] **`/heat` redirect repointed** to `/resources/heat-policy/` (was hitting `/resources/safety/`).
- [x] **Rocket Loader disabled in Cloudflare** — was injecting malformed `<script src="">` tags causing ~42 daily 404s for `/%22/cdn-cgi/.../email-decode.min.js%22` and rocket-loader.min.js%22. Modern sites don't benefit from RL's deferred-execution model and it's known to break things. Verified gone from live HTML; the malformed-URL 404s should clear over a few hours as edge caches refresh.
- [x] **`/.well-known/traffic-advice`** — new file `site/src/traffic-advice.njk` opts into Chrome's prefetch proxy with `[{"user_agent":"prefetch-proxy","fraction":1.0}]`. Headers rule sets `Content-Type: application/trafficadvice+json`. Clears ~19 daily 404s; enables better Chrome prefetch behavior.
- [x] **`/referees/ask-the-referee/` description rewrite** — was brand-focused ("Got a rules question? Browse answers from..."); now front-loads the topic terms users actually search for (goalkeeper handling, throw-in restrictions, offside, fouls, build-out lines). Page gets ~90,617 monthly impressions at 0.25% CTR; rewrite targets a 2-3× CTR lift on the long-tail goalkeeper queries it ranks for.

### Session 19 (2026-05-05) — EXTRA launch + infrastructure cleanup
- [x] **EXTRA program launched** — `/programs/extra/` made public (was `noindex`/stub) with tryout dates (5/16, 6/6, 6/13 at Blair High School), program details, costs ($620 total), and SportsEvent schema (start 2026-09-01, end 2027-05-30). Hero image `extra-interior.jpg` and home-tile crop `home/tile_extra.jpg` added.
- [x] **Home page tile grid reordered** — All-Stars tile removed from grid (page itself preserved), EXTRA™ tile added. New order: Spring → Fall → EXTRA™ → Pre-School → Upper Division → EPIC.
- [x] **Footer Programs column** matches the home tile order; EXTRA labeled "EXTRA (10U Select)".
- [x] **Programs top-nav menu alphabetized** — All Programs pinned at top, EXTRA inserted between EPIC and Fall Soccer; Tournaments stay in their own divider section, also alphabetized.
- [x] **/programs/ index** — new "Select Programs" section at the top with EXTRA™ in its own table; description meta updated.
- [x] **EXTRA in `llms.txt`** — bullet added under Programs.
- [x] **/extra redirect** repointed from `/programs/` to `/programs/extra/` directly. /weather → /resources/weather/ added for symmetry.
- [x] **™ on first mention** — "EXTRA™" on home tile, programs index "Select Programs" row, llms.txt, and `/programs/extra/` body lead. Nav menu and footer chrome use plain "EXTRA" (label convention).
- [x] **Tryout-list standardization** — B10U/G10U notation throughout (was mixed B10U/U10G); time rows unbolded so the visual pattern is "bold date / regular times".
- [x] **/calendar redirect repointed** to `/about/calendar/` (was hitting the static season-overview at `/schedules/calendar/`); the schedules page's "View Calendar" section now explains the live region calendar lives on its own page.
- [x] **Staging-deploy Slack notifications** — new `.github/workflows/notify-staging-deploy.yml` watches CF Pages staging builds and posts a one-line success/failure message to `#notify-website-status` (channel `C0A024YGR9C`). Reuses `wait-for-cf-deploy.sh` with `PROJECT=ayso-website-staging`. No-op pushes (where CF didn't register a deployment) skip notification silently.
- [x] **`heroImage` frontmatter normalized** to full `/images/...` paths across 12 pages + `_data/og.js` defaults; `base.njk` no longer prepends `/images/`. Closes the Pages CMS image-preview 404 issue — CMS uploads stored as `/images/foo.jpg` now Just Work.
- [x] **UTC off-by-one in date filter + footer transform fixed** — both formatters now pin to `America/Los_Angeles` via `Intl.DateTimeFormat`. `sitemap.xml <lastmod>` and per-page `<time datetime>` no longer drift forward a day on late-Pacific-evening commits when built on Cloudflare Pages (UTC).
- [x] **todo.md cleanup** — dropped stale EXTRA-XXX-placeholder item; reworded two items to use roles instead of speculating about a specific person's name.

### Session 18 (2026-05-04) — live weather page + heat policy
- [x] **Board minutes 2023+ decision: archive-by-request** — confirmed the existing `/about/board-minutes/` policy (visitors email `rc@ayso13.org` for archive copies) covers 2023, 2024, 2025 minutes too. Not publicly posting individual PDFs going forward. Closes the open todo from session 17.
- [x] **`/resources/weather/`** — live current conditions, WBGT + CIF alert level, 7-day forecast. Server-rendered field-status reference (read from `_data/fieldstatus.json`). Inline JS uses safe DOM construction (no innerHTML) to render forecast cards; same-origin fetch to `/api/weather`.
- [x] **`/resources/heat-policy/`** — standalone CIF reference: alert-level table (5 rows with WBGT thresholds + required actions), "How we make the call," "What you can do," CIF source citation. Linked from `/resources/safety/`, `/resources/weather/`, footer, and Resources sidebar.
- [x] **Cloudflare Worker `ayso13-weather-api`** — at `workers/weather-api/`, mounted on `www.ayso13.org/api/weather`. Cron `*/5 * * * *` polls Tempest station 33318 + NWS forecast for Pasadena City Hall, computes WBGT (Stull wet-bulb + Bernard simplified outdoor approx), caches normalized envelope in KV namespace `WEATHER_KV` (id `3a591305dddf4644903b97201292a989`). `TEMPEST_TOKEN` set as wrangler secret. Live JSON response verified.
- [x] **Closure recommendation is advisory only** — page banner shows when WBGT level ≥ 5; does NOT auto-update `fieldstatus.json`. Board still makes the official close call via the Slack bot.
- [x] **Safety page rewritten** — heat-policy section replaced with links to the new `/resources/heat-policy/` and `/resources/weather/` pages instead of the third-party Zelus app reference.
- [x] **Footer + sidebar nav** — "Safety & Heat Policy" combo link broken into three: Safety / Heat Policy / Weather & Field Status.
- [x] **`/resources/rain-policy/`** — standalone wet-field page covering closure thresholds (>0.25" in 48 h or >1" in 72 h), measurement, rationale (saturated turf injury risk + field damage), and family/coach guidance. Linked from `/resources/weather/`, `/resources/heat-policy/`, `/resources/safety/`, the resources index, and the sidebar.
- [x] **Rain tracking in Worker** — `workers/weather-api/src/index.js` now maintains a 7-day rolling history of daily rainfall in KV (`rain:state`) with a 14-day TTL safety net. Tempest gives today + yesterday in real-time; we archive day-before-yesterday once it ages out. Worker emits 48 h and 72 h totals plus `closureRecommended` + `reason` in the API envelope.
- [x] **Heat-alert banner overhaul** — collapsed bespoke orange/coral palette down to two tiers using the site's validated semantic colors: gold + dark text for Levels 2–3 (Monitoring), red-dark + white text for Levels 4–5 (Closed). Both combos pass WCAG AA. Level 1 is silent (no banner). Banners include practice + game limitations.
- [x] **Field status bar at top of page** — promoted to a layout-level element in `page.njk` rendered between the page header and content area when frontmatter sets `showFieldStatus: true`. Mirrors the home-page widget exactly (same green/gold/red-dark + soccer-ball icons + bold uppercase). `role="status"` for screen readers.
- [x] **Preview mode** — `?simulate=N` (heat 1–5) and `?simulate-rain=48h|72h` query params override the WBGT card and rain banner client-side with synthetic data for visual QA. Composable. Cream-box "Preview mode" banner at the top with switch links and "back to live data" — uses brand-cream + brand-red-dark, inside the validated palette. Simulate detection runs even when the live `/api/weather` fetch fails so local dev (no Worker bound) can iterate on banner styling.
- [x] **Em-dash sweep** on new prose — replaced with commas or colons depending on context (labels use colons, parentheticals use commas).
- [x] **`/heat` redirect** repointed from `/resources/safety/` to `/resources/heat-policy/`; added `/weather` → `/resources/weather/` for symmetry.
- [x] **Goalkeeper Q&A typo fix** — "goalkeepr" → "goalkeeper" plus apostrophe and double-hyphen cleanup on Steve's `2026-05-02-can-a-goalkeeper-score-a-goal.md` Q&A from the latest CMS commit.
- [x] **Code-review pass + fixes** — all 10 items from the superpowers code-reviewer agent applied (a311e51 reverted, 11c8eee landed): banner titles reworded to "Advisory:" so closure language doesn't pre-empt the board's call; `fetchTempest` throws on missing `obs[0]` to prevent rain-history corruption with 1969-12-31 phantom dates; `role="alert"` moved from empty hidden hosts onto the inner box at createElement time (with `aria-live="assertive"` on the host as backup); forecast filtered to `isDaytime` and sliced to 7 cards (heading is "7-day"); CORS tightened from `*` to allow only ayso13.org origins with `Vary: Origin`; simulate regex tightened with `(?:&|$)` anchor; KV-race comment added in `updateRainState`; `levelLabel` documented as fallback-only.
- [x] **Promote workflow Slack notify bash bug** — `it's live` apostrophe inside a bash single-quoted jq filter terminated the bash quote early and parsed `(~2 min)` as a malformed subshell. Reworded to "the deploy is live" (a0621a8). Also confirmed CF_API_TOKEN + CF_ACCOUNT_ID secrets are now set, so the wait-for-CF-deploy step in both promote and indexnow workflows works end-to-end.

### Session 17 (2026-05-03) — PDF recovery, archive structure, content cleanup
- [x] **Lost-WP PDF recovery from Wayback Machine** — Wayback CDX inventory found 155 unique WP-era PDFs. Validated each download by checking for `%%EOF` marker (Wayback's "most recent" snapshot was often a 5 MB junk-padded placeholder; real content came from earlier 2023-06-27 / 2025-05-03 snapshots). Recovered ~95 valid PDFs to `archive/wp-uploads/` (preserving WP path structure, outside `site/` so not deployed). About 50 weren't recoverable (placeholders only or rate-limited).
- [x] **`archive/` directory established at repo root** — outside `site/`, never built or served by Cloudflare Pages, but tracked in git for institutional record. Has `wp-uploads/` (Wayback recoveries), `from-drive/` (originals from Drive), `board-minutes/` (older minutes moved off served path). Documented in `archive/README.md`.
- [x] **10 PDFs promoted to served path** — coach manuals (`6u/8u/10u/12u/intermediate-coach.pdf`), referee guidelines (`10u/12u-referee-guidelines.pdf`, `6u-7u-8u-modifications.pdf`, `penalty-kick-guidelines.pdf` already had a copy), all renamed to clean year-less slugs.
- [x] **5 broken-promise pages fixed** — `/referees/resources/` Document Library now links 4 Region 13 PDFs + IFAB / AYSO national / AYSO Section 1 / Section 1 PDI external sources (not just unlinked bullet text). `/coaches/training/` got a "Coach Manuals" section. `/coaches/index.md`, `/coaches/drills.md`, `/coaches/getting-started.md`, `/coaches/practice.md`, `/coaches/faqs.md` got inline coach-manual links wherever the prose said "your coaching manual." `/referees/laws.md` "PDF download" placeholder replaced with the canonical IFAB site link. `/families/team.md` reworded to drop the false "weekly schedule PDF" claim. `/resources/documents.md` rewrote the unlinked sub-bullets with real links.
- [x] **Inclusive coaching reference on `/coaches/`** — 6 PDFs from Drive's `Instruction/Coach/Team culture/` (Creating Inclusive Sport Environments, Positive Team Environment, Team Climate, Hidden Disabilities, Coach on the Spectrum, Gender Diversity Toolkit). Originals preserved at `archive/from-drive/`.
- [x] **Section 1 PDI link** — added external link to `https://ayso1ref.com/lib1/pdf/2025_Section_1_PDI_Implementation.2025-07-31.pdf` on `/referees/resources/`.
- [x] **Game cards removed entirely** — old 2023 game-card and 6U/8U game-report PDFs deleted from served path AND from archive; `/coaches/game-cards/` now reads "2026 Fall Season Game cards will be available in late Summer." Pages CMS notice that game cards are season-specific and shouldn't be statically hosted.
- [x] **Orientation video / presentation references removed** — `/managers/index.md`, `/managers/training.md`, `/managers/faqs.md`, `/volunteers/classes.md` all had bullets implying orientation materials were viewable. None existed. Reworded to "attend orientation each season" with a link to `/volunteers/classes/`.
- [x] **Board minutes 2014–2022 moved off served path** — 79 PDFs (~80 MB) `git mv`'d from `site/src/assets/docs/minutes/` to `archive/board-minutes/`. `/about/board-minutes/` rewritten to point at `rc@ayso13.org` for archive requests + `/about/calendar/` for upcoming meetings. Wildcard redirect `/assets/docs/minutes/* → /about/board-minutes/` so external bookmarks land somewhere useful instead of 404.
- [x] **PDF rename + redirects** — older served paths (`region13-10u-referee-guidelines-2023.pdf` → `10u-referee-guidelines.pdf`, etc.) had been briefly live; added old → new 301 redirects so any external links from the prior window still resolve.
- [x] **Day-2 404 sweep** — pulled CF zone analytics again, redirected 11 more paths (8U/10U/12U coach PDFs to served files, `cropped-AYSO-R13-Logo`, `logo-gold`, `Region-13-Modifications`, `/maps/region-13-map2/`, `/fields/victory-park/` typo to `/fields/victory/`, malformed `/tel:6263166900`).
- [x] **Build output shrank from 137 MB to 60 MB** — moving older minutes out cut deploy size by ~57%. Future deploys are faster.

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
