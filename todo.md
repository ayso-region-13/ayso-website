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

## ⏰ Dated / deadline tasks

_(None open.)_ The one dated item — dropping the AirNow OLD-endpoint fallback ahead of its 2026-09-30 retirement — was done 2026-06-21.

⚠️ **Not a deadline, but time-bound:** the Rose City RollOut home banner has `endDate: 2026-08-29` in `site/src/_data/homeHero.js`. Nothing rebuilds this site on a schedule, so it will not retire itself — flip `mode` to `"rotation"` and promote.

---

## Remaining Tasks

### Scheduled follow-ups

- [ ] **Confirm the deploy watchdog actually fires for a runner-allocation failure (session 44).** The `workflow_run: completed` trigger is verified for every *simulatable* path (debounce cancel, build failure, success — 12/12 in `.github/scripts/test-classify-silent-run.sh`), but whether GitHub emits `workflow_run: completed` for a run that never acquired a runner can only be proven by the next real occurrence. Next time `#notify-website-status` shows a deploy that just stops, check whether the watchdog posted. If it does not fire, fall back to a scheduled drift check comparing the deployed commit against the tip of `staging`.
- [ ] **Find out why 3 field-map PNGs vanished from `region13-uploads-staging` (session 44).** `cornishon-practice` and `fis-upper-practice` restored 2026-08-06 by copying the prod objects (both real maps); `allendale-game` was deleted instead. Cause still unknown. **Lead:** those three `field_maps` rows carry *millisecond-identical* `updated_at` values across both D1 instances, which looks more like a row-level copy between instances than independent saves — and a copy that moves rows without moving R2 objects produces exactly this symptom. Unconfirmed; don't treat it as the answer. To dig further, use the interactive `wrangler login` session (the `ayso13-worker-deploy` token has neither R2 nor D1 access) and check the staging bucket for a lifecycle rule plus any prod→staging sync path in ayso-platform. Recurrence is now loud (the build fails), not silent.
- [ ] **Platform-side follow-ups from the Allendale fix (session 44)**, all recorded in `~/dev/ayso-platform/docs/handoff-allendale-game-map.md`: the public API advertises `png_ref` without checking the object resolves (a vanished object still kills the website build), and nothing stops the editor saving another variant with `elements_json = "[]"` — which is exactly how the Allendale one appeared. **That doc is uncommitted** in the platform repo (branch `docs/handoff-post-publish-fix`).
- [ ] **Fix Pages CMS "new page" defaults so editors get a working page (session 44).** Creating a page in the CMS produces a file that is broken twice over — seen 2026-08-02 with `site/src/families/2026-08-02-region-13-rollout.md`, since replaced by `site/src/families/rollout.md`:
  1. **Date-prefixed filename → ugly URL.** No `filename` key on any collection in `.pages.yml`, so Pages CMS defaults to `{year}-{month}-{day}-{primary}.md` and the page lands at `/families/2026-08-02-region-13-rollout/`. Fix: add `filename: { template: "{primary}.md", field: create }` to the collections (per https://pagescms.org/docs/configuration/content/filename/ — `field: create` also lets the editor correct the slug at creation time).
  2. **Empty `layout`/`section` → no template.** Both are `hidden: true` in the shared `&page-fields` anchor with no default, so a new entry writes them blank and `page.njk` never applies: no breadcrumb, no sidebar, unstyled. Fix is unconfirmed — the Pages CMS field docs list only `name`/`label`/`type`/`component`/`required`/`pattern`/`hidden`/`readonly`/`description`/`options`, with **no `default` key documented**. Check the GitHub repo (https://github.com/pages-cms/pages-cms) for whether defaults are supported; if not, the fallback is a build-time default in `.eleventy.js` (e.g. a directory data file `site/src/families/families.json` setting `layout`/`section`, which Eleventy applies to every page in the folder and would make the hidden fields unnecessary). The directory-data approach is probably the better fix regardless — it works no matter what the CMS writes.
- [ ] **`AQI_REFRESH_MINUTES` swallows a malformed value (low priority).** `parseInt(env.AQI_REFRESH_MINUTES || "15", 10)` in `refresh()` yields `NaN` for a bad value, and the resulting comparison is always false, so the AQI throttle would silently stop working (refetching every tick, burning PurpleAir points) rather than falling back. Same class of bug in `shouldRefreshAqi`'s caller. Found while fixing WBGT; not touched because it was out of scope. One-line guard: fall back to 15 and `console.error` when the parsed value isn't finite and positive.
- [ ] **Consider a real staging environment for `weather-api` (medium).** The Worker has ONE deployment serving both `www` and `staging` via routes and deploys only from `main` (see the header comment in `.github/workflows/deploy-workers.yml`), so weather changes cannot be tested on staging — a staging deploy would compare the deployment against itself. Verifying the session-41 WBGT change meant `wrangler dev` against live station data plus reading the diff carefully. Doing it properly needs a second worker name, its own KV namespace, duplicated `TEMPEST_TOKEN`/`SLACK_BOT_TOKEN`/`PURPLEAIR_READ_KEY`, a staging route, and branch logic in the workflow — the way the `redirects` Worker already works.
- [ ] **Optional follow-up (low priority): strengthen the Region Locator CTA / find-your-region prominence** — per the re-check, `region_locator_click` volume is negligible (1/28d) on a small denominator (~20 users reach the page). Options: button-style the locator link, surface find-your-region more prominently for geo-detected out-of-area visitors, or accept as low-volume and not worth the effort. Re-run `site/scripts/ga4-outofarea.py` if revisited.

### Recurring / annual

- [ ] **Update SportsEvent dates each season** via Pages CMS — `eventStartDate` and `eventEndDate` on `/programs/fall-soccer/`, plus future Spring Soccer / All-Stars / Winter Stars when dates are added.

### Content gaps

- [ ] **Write a real `/volunteers/clubhouse/` page** if the approval path, lead time, and permitted uses ever get documented (session 45). The Typeform's questions aren't visible without submitting it, so there was nothing to write a procedure page from. The two existing links — a bullet in Coaching Resources on `/coaches/` and the "Using the Clubhouse" section on `/volunteers/`, both currently pointing at the `/clubhouse` slug — would repoint to it.

---

## Completed

Moved to **`todo-archive.md`** (325 items) so this file stays short. Session-by-session narrative lives in `claude-history.md`.
