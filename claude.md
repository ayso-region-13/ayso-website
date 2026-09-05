# AYSO Region 13 Website Rebuild

## Project Overview
ayso13.org, rebuilt from WordPress as a static **Eleventy (11ty) + Tailwind CSS** site on Cloudflare Pages. Live since 2026-05-01; this file describes current state, not the rebuild.

## Current Status

**Live at www.ayso13.org since 2026-05-01.** The original WordPress→Eleventy rebuild is complete (159 old pages migrated/redirected, photo gallery, Pagefind search, volunteer training matrix, board-minutes archive, GA4, brand redesign, accessibility pass). The full build + post-launch changelog (session by session) lives in **`claude-history.md`** — NOT auto-loaded; read it when historical detail matters. Headline state below.

**Headline state:**
- **Hosting**: Cloudflare Pages (prod `www.ayso13.org`, staging `staging.ayso13.org`). CMS commits land on `staging`; `/ayso promote` merges to `main`.
- **Workers (3)**: `weather-api` (Tempest + NWS, WBGT/rain, 5-min cron, KV cache, live PurpleAir AQI composite — AirNow fallback), `redirects` prod + staging envs (652 rules: 643 exact + 9 splat), `csp-report` (30d KV, with a verified-benign ignore list — see the CSP note below), pages-deploy gates in workflows. (`field-maps` retired 2026-07-23 — the editor moved to ayso-platform; see the Fields entry under Files.) **Worker deploys**: `weather-api` / `csp-report` auto-deploy via CI (`deploy-workers.yml`) on push to `main` (single deployment each, serves both domains via routes — so main-only, never staging); `redirects` has its own branch-scoped `deploy-redirects-worker.yml` (real prod/staging envs). **`workers/redirects/src/map.js` is GENERATED — never edit it.** Source of truth is `site/src/_redirects`; `workers/redirects/scripts/generate-map.js` rebuilds the map as the first step of every deploy, so a hand-edit to `map.js` passes local `npm test` (the tests read the same file) and is then silently discarded at deploy time. All use the one canonical **`ayso13-worker-deploy`** token (Workers Scripts + KV Storage + Account Settings + Zone Workers Routes), stored in `.envrc` + the `CLOUDFLARE_API_TOKEN` GitHub secret. **Note**: `src/_redirects` is intentionally NOT passed-through to `_site/` (.eleventy.js line 38) — Worker handles all redirects upstream of Pages; emitting the file triggered the "Maximum number of dynamic rules supported is 100" warning and correlated with the (now-retired) blob-hash-poisoning bug — see `claude-history.md`.
- **Game schedules — external, at `schedule.ayso13.org`** (linked from www 2026-09-04). Served by **ayso-platform** (`~/dev/ayso-platform`, `web/apps/workers/src/public.ts`), the same codebase behind `fields.ayso13.org`. Nothing in this repo builds or deploys it; www just links out. **Always link the bare root.** Every view is `/season/<uuid>/…` and the UUID changes each season, so a deep link rots in September. `/` redirects to the single live season, or shows a picker when several are live. Views: find-a-team search (team name, team code like `B10-04`, or coach name), Complete, By field, By division, By team, plus per-team ICS subscription. **No practice view and no standings view.** Region 13 does not publish practice schedules publicly at all, so that absence is policy rather than a gap: families get practice day/time/field from their coach or from their InLeague dashboard. Standings are not published anywhere yet, and `/schedules/standings/` no longer links out at all: it and `families/team.md` both just say "published after Week 3". Every InLeague standings link is gone from the site, along with the Referee Points and Sportsmanship Points sheets. The site sends `noindex,nofollow`, which is why it is absent from the sitemap and from schema `sameAs`, and why the legacy `/schedule` `/games` `/standings` `/teams` redirects in `src/_redirects` still land on www pages rather than being repointed at the subdomain (those are WordPress-era URLs with inbound links; sending them to a noindex origin would discard that). One source of truth is `site.json` `scheduleUrl`, usable in `.njk` only — CMS-edited markdown bodies must carry the literal URL, since Pages CMS mangles `{{ }}` on round-trip.
- **CMS**: Pages CMS at app.pagescms.org. Edits should land on `staging`. **The branch the CMS opens on = the repo's GitHub default branch** (Pages CMS has no `branch:` config key — the old `branch: staging` line in `.pages.yml` was silently ignored and caused repeated accidental edits to `main`). Fixed 2026-06-08 by setting the **GitHub default branch to `staging`** (`gh repo edit --default-branch staging`), so the CMS now opens on staging by default. Two media buckets — `images` and `docs` (PDFs). Editor uploads PDFs in Documents bucket, types path into rich-text link dialog.
- **Slack** (`#notify-website-status`): staging + promote workflows post success/failure with commit titles. `/ayso` Slack bot for field status, announcements, promote dispatch, `staging` (manual staging rebuild — dispatches `deploy-pages-staging.yml` on `staging`; alias `rebuild-staging`), `weather` (ephemeral current-conditions readout), and `test-weather` (weather-notification connectivity check). The bot's `GITHUB_TOKEN` needs **Actions: write** for the two dispatch commands, not just Contents. **Authorization fails CLOSED** (fixed 2026-08-06): the allowlist is `slack-bot/allowed-users.json` on `main`, and if that lookup fails for any reason other than a 404 the bot refuses the command and says the token has probably expired. It used to return `[]` on any error, which the gate read as allow-all — an expired PAT silently opened `/ayso promote` to the whole workspace. Only an **absent** file grants open access; an explicitly empty list means nobody. **So if `/ayso` starts refusing everyone, check the bot's PAT first** — that is the fail-closed path working, not a code bug.
- **Deploy watchdog** (`.github/workflows/deploy-watchdog.yml`): reports the deploys that report *nothing*. Every notifier lives inside the deploy job, so a run whose job never executes a step tells nobody — not even via `always()`. A `workflow_run: completed` watcher runs on a fresh runner afterward, counts executed steps across the run's jobs (`0` = no notifier could have fired), and classifies via `.github/scripts/classify-silent-run.sh`. **The discriminator needs run-level conclusion AND step count, and run-level differs from job-level**: a runner-allocation failure reports job `cancelled` but run `failure`, while a debounce supersede is `cancelled` at both levels. Staging: `failure`+0 steps → Slack + one auto re-dispatch (loop guard = never retry a run whose event was `workflow_dispatch`, since the retry is one). Promote: `cancelled`+0 steps → Slack only; production is never auto-promoted. Case table: `.github/scripts/test-classify-silent-run.sh` (12 cases, incl. real run IDs). Design → `docs/superpowers/specs/2026-08-06-deploy-watchdog-design.md`. Lives on `staging` because `workflow_run` only fires from the **default branch**.
- **Schema**: multi-typed `SportsOrganization` + `NonprofitOrganization` + WebSite + BreadcrumbList + Place (23 fields, each with `geo.latitude`/`longitude` from `placeLat`/`placeLon` frontmatter) + FAQPage + Person (Steve Hawkins) + SportsEvent (date-gated). EIN 95-6205398 on `#org`. `sameAs` includes AYSO national, the GBP Maps Place URL (cid `9491143221518550898`), Instagram (`@aysoregion13`), and Facebook (`/ayso13`); both social profiles link back to ayso13.org for `rel="me"` verification.
- **Hardened**: WCAG AA contrast, HSTS, CSP enforcing (`'wasm-unsafe-eval'` for Pagefind WASM), CSP report Worker, per-page noindex via frontmatter, per-section OG image defaults, `llms.txt`, IndexNow on every push.
- **Performance**: image pipeline = WebP + original-format only (AVIF intentionally disabled — see note below), hero LCP via eager-load + post-LCP rotation, Pagefind search.
- **Live features**: field pages w/ platform-sourced maps (game/practice/tournament/wayfinder) + Field Info callouts; Rose Bowl / FIS / Muir / Blair grouped as complexes with shared wayfinders. Live weather/heat/rain at `/resources/`. 12 programs incl. EXTRA™. 35-Q&A Ask the Referee. CMS-editable Important Dates widget on home. EmailOctopus newsletter signup. Photo gallery (62 photos, GLightbox SRI'd).
- **Image pipeline note (sticky)**: `@11ty/eleventy-img` formats are `["webp","auto"]` only. AVIF disabled because Cloudflare Pages build cache won't engage for this project ("Skipping build output cache..." despite preset = Eleventy / V3 / toggle on). AVIF encoding is 60%+ of build time. Build dropped ~4:14 → ~1:30 without it. DO NOT re-enable unless CF cache is fixed first.
- **SEO + analytics**: GA4 `G-9YM9ZDW1J9`, GSC `sc-domain:ayso13.org`, GA4 property `307558725`. Per-project Google creds in `.seo-creds/` (gitignored, direnv-symlinked to `~/.config/claude-seo`). Query commands + creds gotchas → **`docs/seo-data-pulls.md`**. The tag is the **`gtag/js`** snippet, not a Tag Manager `gtm.js` container, and there is no GTM container anywhere in this repo — so the Google Ads "update your gtag installation before October 02, 2026" notice (received 2026-08-27) **does not apply**; verified against source and eight live pages, don't re-investigate. **`base.njk` is not the only place the snippet lives**: `temp.njk` has its own `<head>` and carries a second copy, pinned to `page_location: origin + '/temp'` because its permalink is `/temp.html` but its public URL is `/temp`. Edit the GA block in one and you must edit the other.
- **PostHog** (added 2026-08-31, session 51) runs *alongside* GA4, it does not replace it: GA4 still feeds GSC, `SITE-HEALTH.md` and the `scripts/ga4-*.py` pulls. Project `phc_zpnqGM…` on **US cloud**, reached through PostHog's managed reverse proxy at `https://p.ayso13.org`; keys in `site.json` as `posthogKey` / `posthogHost` / `posthogUiHost`. What matters:
  - **Production only.** Gated on a new `isProduction` global in `.eleventy.js` — `CF_PAGES_BRANCH === "main"`, nothing else. This is deliberately **not** `not isStaging`: `isStaging` is false when `CF_PAGES_BRANCH` is unset, so an `isStaging`-based gate would have fired real events from local `npm start`. Staging and localhost send nothing.
  - **One shared include**, `_includes/posthog.njk`, pulled in by both `base.njk` and `temp.njk`, so the two cannot drift the way the gtag blocks can. `/temp` sets `posthogPinnedPath = "/temp"` before including it, which switches the snippet to `capture_pageview: false` plus a manual `$pageview` with `$current_url` pinned — the same problem, and the same fix, as the GA `page_location` pin above.
  - **Pageviews and heatmaps only.** `autocapture: false`, `disable_session_recording: true`, `capture_heatmaps: true`. The heatmap and scrollmap work without autocapture; the per-element **clickmap** does not, and is knowingly given up. `capture_pageleave` stays at its default `true` because the scrollmap needs it.
  - **Reverse proxy since 2026-09-04.** `posthogHost` is `https://p.ayso13.org`, a CNAME to PostHog's managed proxy (`…cf-prod-us-proxy.proxyhog.com`), so the blocklists that match `us.i.posthog.com` no longer drop our traffic. Two non-obvious consequences: the loader derives the assets host by string-replacing `.i.posthog.com` inside `api_host`, which is a **no-op on a proxy domain**, so `array.js` is fetched from `p.ayso13.org` as well (one origin, not two); and `posthogUiHost` (`https://us.posthog.com`) exists only so client-generated links point at the PostHog UI, which the proxy does not serve. Nothing in this repo runs the proxy — it is PostHog-side plus one DNS record, so there is no fourth Worker and no deploy step.
  - CSP: `p.ayso13.org` on both `script-src` and `connect-src`; the `us-assets.i.posthog.com` / `us.i.posthog.com` entries went away with the direct load. PostHog's docs recommend the wildcard `*.posthog.com` since they add domains over time; a single first-party host is used instead because the `csp-report` Worker will make any breakage loud. **If PostHog silently stops reporting, check the CSP report KV before anything else.**
- **Retired gotcha** (moved to `claude-history.md`): CF Pages blob-hash poisoning — MOOT since the 2026-06-18 switch to CI Direct Upload. Read it there if a Pages deploy ever serves `HTTP 500` empty-body on specific URLs.

## Branched / staged for later

- _(none currently)_

## Stack
Eleventy 3.0 + Tailwind CSS 3.4, Nunjucks (`.njk`) templates, built from `site/` to `site/_site/`, hosted on Cloudflare Pages. `npm start` → http://localhost:8080.

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

One directory per section, each with an `index.md`: `about/`, `programs/`, `register/`, `schedules/`, `families/`, `coaches/`, `referees/`, `managers/`, `volunteers/`, `fields/`, `resources/`, `contact/`. Plus root-level `index.md` (home), `search.njk` (Pagefind), `404.njk`, `temp.njk`, and the generated `llms.njk` / `llms-full.njk` / `sitemap.njk` / `robots.njk` / `_headers.njk` / `traffic-advice.njk`.

Per-section page counts are deliberately not tracked here — they drifted badly and `ls site/src/<section>/*.md` is authoritative. Two things that are *not* obvious from the tree:

- **`families/` is the old `parents/`.** Renamed, with 12 redirect rules in `src/_redirects` covering `/parents/*` → `/families/*`. The top nav reads "Families".
- **`referees/qa/*.md` are data fragments, not pages** — 35 stubs embedded into the Ask-the-Referee accordion, with no URLs of their own.

## Navigation Structure
- **Top nav (6 items):** Programs, Register, Schedules, Fields, Families, About
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

The CSP report Worker admin key is exported by `.envrc` as `CSP_ADMIN_KEY` (see `workers/csp-report/`). **Two things about reading CSP reports, both found 2026-08-31:**

- **The admin GET endpoint returns the OLDEST reports, not recent ones.** Keys sort ascending by ISO timestamp and the handler reverses only the page it fetched, so past `MAX_LIST_LIMIT` (1000) you get the oldest 1000. The namespace held 9,899 keys, so it was serving four-week-old data while looking authoritative — it nearly produced a false "no PostHog violations" verdict. Until it paginates on the `list()` cursor (logged in `todo.md`), read recent reports with `npx wrangler kv key list --namespace-id=d6a804159968475db6bcbf7354b45d0f --prefix="$(date -u +%Y-%m-%d)" --remote` from `workers/csp-report/`. **`--remote` is not optional** — a local miss reads exactly like no violations.
- **`stats.g.doubleclick.net` is now dropped before the KV write** (`workers/csp-report/src/ignore.js`, covered by `npm test`). It was ~500 reports/day, all of it burying everything else. It comes from **our own GA4 tag**, not a third party and not extensions: 985 reports all carried `tid=G-9YM9ZDW1J9` across 754 distinct `cid`s. Trigger is `npa=0` (ad personalization); the same URLs carry `ngs=1` and the GA4 Admin API says `GOOGLE_SIGNALS_DISABLED`, so **Google Signals is not the cause** despite older notes saying so. `connect.facebook.net` is deliberately still reported — that one was never actually verified. Dropped reports still appear in `npm run tail`.

## Content Placeholders
- `[DATE]` — auto-replaced at build time with the file's per-file last-modified date from `_data/fileDates.json` (generated from `git log --name-only`; keys are `src/...` paths).
- `[INLEAGUE: ...]` and `[IMAGE: ...]` are **all resolved** — zero remain in content as of 2026-08-12 (the only matches left are a CSS comment for the callout style that renders them). `links-to-resolve.md` is now historical.

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
The global brand/voice rules (no em dashes, no exclamation points, no editorializing or sarcasm, minimal bolding) apply. Project-specific additions:

- **Audience:** parents with limited soccer *and* technology knowledge.
- **Voice:** mixed — "we" on community pages, "Region 13" for official info.
- **Tone:** helpful and inclusive without being preachy or condescending.
- **Avoid** in particular: "Good news:"-style lead-ins, and overly casual sign-offs ("That's it!", "Perfect!").

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
  - **Shares the `deploy-pages-prod` concurrency group with `rebuild-production.yml`** (the fields "Publish Site" button) so a map rebuild can never race a promote into the same Pages project — without it a rebuild could check out pre-merge `main` and upload it *after* a promote finished, reverting production. **⚠️ The cost, accepted deliberately 2026-08-03: GitHub keeps only ONE pending run per group and cancels the older one, so a queued promote can be superseded by a later publish click. A run cancelled before any job starts executes no steps, so nothing reports it — not even an `always()` step. **As of 2026-08-06 the deploy watchdog reports this case** (`cancelled` + zero steps on the promote workflow → Slack), so you no longer have to notice the *absence* of a message; you still re-run `/ayso promote` by hand, because production is deliberately never auto-promoted.** (A dropped *publish* is harmless — the next prod build refetches the maps.) A mistyped confirmation does **not** evict anything: `concurrency` is workflow-level and evaluated before the job's `if:`, so the group is conditional on `confirm == 'promote'` and a non-promoting run gets a throwaway per-run group.
  - ⚠️ **That concurrency change only governs Slack promotes once it is on `main`** (see the `ref: main` note above), and it reaches `main` *by being promoted*. So the first promote after this lands on `staging` still runs the old ungrouped version from `main` and does not serialize against a publish; every promote after that does.
- **Staging crawl block:** `_headers.njk` and `robots.njk` read `CF_PAGES_BRANCH` env var at build time. On the `staging` branch the build emits `Disallow: /` + `X-Robots-Tag: noindex,nofollow`; on `main` the build emits the normal allow-all + sitemap. Local dev (`npm start`) builds in production mode (no env var)
- Do NOT commit directly to `main` for content changes — always go through staging

## CMS
Pages CMS is configured for non-technical editors at https://app.pagescms.org.

- Config file: `.pages.yml` in the repo root
- Editors log in at app.pagescms.org — no GitHub account required
- Edits commit to **`staging`** (the GitHub default branch) and trigger the `deploy-pages-staging.yml` CI deploy — *not* a CF Git rebuild, which is disabled on both projects. Reaching production takes a deliberate `/ayso promote`. See the Staging Environment section for the branch-picker caveat and the `main` ruleset.
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
- `homeHero.js` — **home page hero mode switch.** `mode: "event"` renders a single wide event banner (currently the Rose City RollOut, linking to `/families/rollout/`); `mode: "rotation"` renders the standard 5-photo hero from `heroes.js`. Both code paths live in `home.njk` behind an `if`/`else`, and `heroes.js` is untouched while the banner shows, so **reverting is a one-word edit**. `endDate` closes the gate automatically but is a safety net, not a timer — nothing rebuilds this site on a schedule, so flip `mode` to be sure. The banner runs **full-bleed** capped at the artwork's native 2560px (session 48); the overlay is sized entirely in `vw` with `min()` ceilings resolved at 2560px so it holds its proportion against the artwork and freezes exactly when the artwork does. Overlay-positioning gotchas (clamp floors, percentage padding in shrink-to-fit boxes, and **a plain `width` attribute silently collapsing the srcset to one candidate**) → `claude-history.md` sessions 46 + 48
- `announcements.json` — home page announcement bar (`enabled` boolean + `body` markdown). **Currently `enabled: false`** so it doesn't compete with the event banner directly beneath it. Note an emptied `body` does NOT hide the bar; only `enabled` does; rendered via `markdownify` filter in `home.njk`, so the `body` supports inline links (e.g. `[Register Today for Fall 2026](/register/)` makes the whole bar text a link — styled by the existing `[&_a]:underline`). Sits **above** the hero on the home page.
- `fieldstatus.json` — home page field status widget (`enabled` boolean + `status` string + `message` string); color-coded Open/Monitoring/Closed; last-updated timestamp from `git log` at build time (Pacific time). Sits **below** the hero (swapped with the announcement bar 2026-06-16).
- `sponsors.js` — sponsor logos, URLs, and tier definitions
- `fees.json` — Fall Soccer registration fee schedule (rangeShort + per-tier amounts + sibling discount). Used by `/register/`, `/programs/fall-soccer/`, and `/llms.txt`. Note: `site/src/families/index.md` is hardcoded because Pages CMS round-trips break Nunjucks template syntax in CMS-edited markdown bodies — when fees change, edit both
- `og.js` — Per-section default OG image fallbacks. When a page has no `heroImage` frontmatter, `base.njk` picks the section default; otherwise the global fallback
- `heroes.js` — Home page hero photo set (5 images with src + alt). Fisher-Yates shuffled at module load, so each Eleventy build emits a different first/LCP image. Rendered via `{% for hero in heroes %}` in `home.njk`; first iteration gets `loading="eager" fetchpriority="high"`, rest stay lazy + hidden until the JS rotation script promotes them

## Site-wide Templates / Patterns
- `_includes/schema-org.njk` — emits JSON-LD on every page based on URL/section/frontmatter: multi-typed `SportsOrganization` + `NonprofitOrganization` + WebSite (homepage; `#org` carries `taxID` 95-6205398 and `nonprofitStatus`), BreadcrumbList (inner pages + ask-the-referee), Place (field pages with `placeAddress` frontmatter), FAQPage + Person for Steve Hawkins (`/referees/ask-the-referee/`, in a single `@graph` so each Answer's `author` references the Person `@id`), SportsEvent (programs pages with both `eventStartDate` + `eventEndDate` frontmatter set; gates emission on both fields).
- `src/_headers.njk` and `src/robots.njk` (note: at the root of `src/`, NOT in `_includes/`) — Cloudflare Pages config; branch-aware via `CF_PAGES_BRANCH` env var to block crawlers on staging. Production headers include HSTS (`Strict-Transport-Security: max-age=31536000; includeSubDomains`), CSP-Report-Only, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy.
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
- `docs/weather-data-pulls.md` — pulling WBGT/heat history out of the D1 observation log: CSV export script, query cookbook, the `--remote` trap, and why it can't be backfilled
- `workers/*/README.md` — canonical per-Worker docs (weather-api, redirects, csp-report)
- `todo.md` — **Active** task list only (9 open items, ~7 KB). Completed items live in `todo-archive.md`; neither is auto-loaded.
- `todo-archive.md` — 326 completed backlog items, verbatim, split out of `todo.md` on 2026-08-12. Reference only; `claude-history.md` carries the narrative for the same work.
- `.impeccable.md` — Design context: users, brand personality, principles (used by /impeccable skill)
- `brand-colors.md` — Full color palette with hex, RGB, usage notes, contrast cheat-sheet
- `site-overview.md` — Slab-friendly summary for the team wiki
- `.pages.yml` — Pages CMS configuration
- **Historical, kept for reference only** (all superseded; none needed for current work): `links-to-resolve.md` (the `[INLEAGUE:]` placeholders, now all resolved), `proposed-site-structure.md` (original IA proposal + old→new URL mapping), `website-builder-comparison.md` (pre-Eleventy platform research).
- `/content/` — Source Markdown files (migrated into `site/src/` via migrate-content.js)
- `/site/` — The actual Eleventy site (active development)
- `/logo/` — Logo assets
- `/workers/weather-api/` — powers `/resources/weather/` + `/temp`. Cron (`*/5`) polls Tempest station 33318 + NWS (forecast point = Victory Park), reads WBGT from the station's own `wet_bulb_globe_temperature` field rather than deriving it, tracks rolling rainfall in KV, and serves `/api/weather` on prod + staging routes. AQI = PurpleAir composite primary (throttled to 15 min), AirNow fallback. Slack notifiers post to `#notify-weather` on **CIF Level 4 advisory** (new 2026-08-25), closure, and rain-forecast changes, all debounced by heat hysteresis + a 15-min dwell. `/ayso weather` = readout, `/ayso test-weather` = self-test. **Deploy**: auto via CI on push to `main` (ships on promote); manual `npm run deploy` needs the canonical `ayso13-worker-deploy` token with Workers KV:Edit (else `code 10023`). Secrets not in git: `TEMPEST_TOKEN`, `AIRNOW_API_KEY`, `PURPLEAIR_READ_KEY`, `SLACK_BOT_TOKEN`, `WEATHER_SELFTEST_KEY`.
  - **Every Slack card is stamped `Reading as of H:MM PT`** (added 2026-08-25). The dwell means a card posts 15-20 min after the threshold was crossed (**it is really 20** — `since` is stamped a beat after the cron fires, so the third tick lands ~1.4 s short and a fourth is needed; measured 2026-08-25, timing note in the worker README, unfixed because the behavior is correct and only slower than advertised) and is a frozen snapshot, so on a climbing morning it disagrees with the live page by a few degrees. That is the dwell, not a bug; the stamp is what makes it legible. The pages themselves also never auto-refresh (no `setInterval` in `resources/weather.md` or `temp.njk`), so an open tab freezes.
  - **Observation log (D1, `WEATHER_DB` → `ayso13-weather-log`)** — one row per 5-min reading so time-in-level is answerable; KV only ever holds "now". Live 2026-08-25: db id `7d5fa6f1-a18b-41af-b626-67947c4f8d48`, schema `schema.sql`, time-in-level SQL in the worker README. **D1:Edit was added to the canonical `ayso13-worker-deploy` token** to create it (before that every `d1` call returned `code: 10000`); the token value did not change, so no secret rotation was needed. `wrangler dev` binds the *local* D1, a separate empty database — apply the schema there too or every local tick logs a write failure, and remember `--remote` is never the default on `d1 execute`.
  - **WBGT history cannot be backfilled** (verified 2026-08-25, don't re-investigate): Tempest returns `wet_bulb_globe_temperature` only on the *current* observation. `observations/station` ignores `time_start`/`day_offset`/`bucket`; `observations/device` honours a time range (1-min, 30+ days) but has no WBGT; `stats/station` has none; `better_forecast` is current-only; the site's CSV export omits it. Deriving it is the calculation removed in July for reading 2-8.5°F hot.
  - **Caching gotcha you cannot see from this repo**: CF caching is disabled on `/temp` and `/resources/weather` via the **Cloudflare dashboard**, not `_headers.njk` — the absence of a header is not evidence it isn't configured. The `/api/weather` feed separately sends `max-age=300`, so a hard refresh can still get a 5-min-old payload.
  - **Everything else → `workers/weather-api/README.md`** (architecture, notifier table, debounce thresholds, caching, output envelope, setup, self-test). WBGT investigation → `docs/superpowers/specs/2026-07-24-wbgt-source-design.md`.
- **Field maps — read from the platform at build time** (migrated 2026-07-22/24, session 40; replaced the retired `workers/field-maps/` editor Worker). The map editor now lives in the **ayso-platform** admin console (`~/dev/ayso-platform`), which serves `fields.ayso13.org` and its staging twin `fields-staging.ayso13.org`. This repo no longer stores maps: `site/src/_data/fieldmaps.js` → `_data/lib/fetchFieldMaps.js` fetches `GET /public/fields` (venue index) + `GET /public/fields/<slug>` (detail, plus the `overview` slug which the index omits by design) at build time, cached by `eleventy-fetch` for 1 day so a platform outage serves last-good instead of failing the build. The committed `_data/fieldmaps/*.json` and the 40 `images/fields/*-<variant>.png` exports are **deleted** (the 21 field `.jpg` photos stayed).
  - **Which instance a build reads** — `FIELDS_API_BASE` env var. Staging deploy sets `https://fields-staging.ayso13.org` (so unpromoted map edits are reviewable on staging.ayso13.org); promote sets `https://fields.ayso13.org`. The in-code default is the **prod** instance, so an unset env (local `npm start`, a new workflow) reads published maps.
  - **Images are optimized locally at fetch time**, not by the sitewide `eleventyImageTransformPlugin`: that plugin only rewrites `<img src>`, never `<a href>`, and the map lightbox wraps each map in `<a href>`, so a raw ~4.5 MB cross-origin PNG kept shipping behind the lightbox. `optimizeVariantImage()` pre-generates webp+png at 600/1200/2000w into the shared `_site/img/` + `/img/` namespace and returns both the `<picture>` markup and the largest local PNG for the href. The generated `<img>` carries `eleventy:ignore` (else the sitewide transform re-processes an already-local path and fails the build); a posthtml pass in `.eleventy.js` strips that marker back out.
  - **CI gotcha (sticky)** — GitHub Actions runners are Azure IPs, and Cloudflare bot protection on the ayso13.org zone 403s datacenter requests to the platform's own *public* API. Fix: build-time fetches send `User-Agent: ayso13-fieldmaps-build` and a Cloudflare "Skip" security rule matches that UA. Applied to the JSON fetch **and** the eleventy-img image fetches (via `cacheOptions`). Same class of problem the IndexNow bot had. If a build starts failing with `Bad response … (403): Forbidden`, check that CF rule first.
  - **An *ungenerated* map is a normal state; a *missing* one is not.** The platform types `image_url` as `string | null` and returns null when a variant's `png_ref` is unset — "no map has been generated for this variant". A field may legitimately have a practice map but no game map, and that changes over time. `reshape()` **skips** those variants (fixed 2026-08-06; before that it built `${BASE}null`, 404'd, and killed the build), and every variant in `page.njk` is `{% if %}`-guarded, so absence just renders no section. **Deliberate asymmetry:** a variant that *does* advertise an `image_url` whose R2 object has vanished still fails the build loudly — that's corruption, not an editorial choice. If a field shows a map section it shouldn't (or lacks one it should), the fix is the platform's `field_maps` row, not this repo.
  - **A missing map asset hard-fails the whole site build**, including unrelated CMS edits. A variant advertised by the platform's D1 whose PNG is absent from the R2 `UPLOADS` bucket 404s, and **eleventy-img returns `undefined` rather than throwing**, so `metadata.png` in `optimizeVariantImage` throws `Cannot read properties of undefined` and 11ty dies at the global-data stage. **Diagnose by sweeping both instances** (`/public/fields` → each `/public/fields/<slug>` → HEAD each `image_url`); that pinpoints slug/variant immediately. Note the canonical `ayso13-worker-deploy` token has **neither R2 nor D1 permission** (`code: 10000`), and `wrangler r2 object` / `d1 execute` default to **local** storage where a miss reads exactly like a real absence. Full 2026-08-06 incident (three PNGs missing from `region13-uploads-staging` only, prod complete, root cause never established) → `claude-history.md` session 44.
  - Variant keys still drive page headings (`game`/`practice`/`wayfinder`/`tournament`/other); the `complexes` collection still shares one wayfinder per group (FIS / Muir HS / Rose Bowl / Blair); the **Region Overview** map still renders atop `/fields/` (now from the platform's `overview` slug). The old Worker's Access gate, Mapbox drawing surface, GitHub-commit protocol, and PDF export all moved to the platform — its specs are in `~/dev/ayso-platform/docs/superpowers/`.
  - **Deep-linkable map images**: `/field-images/<slug>-<variant>.png` on the platform is slug-keyed and survives map edits, unlike a content-hashed `/img/` filename. The Jefferson legacy redirects point there for that reason.

---
*Last updated: 2026-09-04 — www now links out to the new `schedule.ayso13.org` game schedule; stale Google Drive and LeagueLobster schedule links removed.*

**The session-by-session changelog lives in `claude-history.md`** — sessions 36-49 plus dated milestones back to 2026-04. It is deliberately NOT auto-loaded; read it when historical detail matters. Load-bearing gotchas are kept inline in the sections above rather than in the changelog, so this file stays a description of current state and not a history of how it got here.

- @SITE-HEALTH.md — latest automated site-health findings (regenerated by totavi-llc/site-healthcheck; do not hand-edit).
