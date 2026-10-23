# Important Dates from the Google Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An hourly GitHub Actions job rebuilds `site/src/_data/importantDates.json` from `#website`-tagged events on the public Region 13 Google Calendar and publishes it to `staging` and `main`.

**Architecture:** Three small ES modules under `site/scripts/`: a feed parser that expands the iCal feed into per-occurrence records (`lib/calendar-feed.mjs`, the only file that touches `ical.js`), pure rules that turn occurrences into widget entries and decide what Slack hears about (`lib/important-dates.mjs`), and a runner that does the I/O (`sync-important-dates.mjs`). A workflow modeled on `sync-newsletters.yml` runs the runner and pushes. The home widget learns `endDate` and Pacific time.

**Tech Stack:** Node 22, `ical.js` 2.2.1 (new runtime dependency), `node --test`, GitHub Actions, Eleventy 3 / Nunjucks.

**Spec:** `docs/superpowers/specs/2026-10-23-calendar-important-dates-design.md` (read it first; this plan does not repeat its reasoning).

## Global Constraints

- Branch: `calendar-important-dates`. Do not push, merge, or promote; the user does that.
- Feed URL: `https://calendar.google.com/calendar/ical/g60lvbvlhbucts84e1ft40mlpk%40group.calendar.google.com/public/basic.ics`
- Tag: `#website`, case-insensitive, not followed by a word character (`#websites` does not match).
- Every date is computed in `America/Los_Angeles`, formatted `YYYY-MM-DD` (use `Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" })`, as `lib/newsletters.mjs` does).
- Output shape: `{ "enabled": <bool>, "dates": [ { "date", "endDate"?, "name", "link"? } ] }`, `JSON.stringify(obj, null, 2) + "\n"`. Key order within an entry: `date`, `endDate`, `name`, `link`; absent keys are omitted, never `null`.
- Links: `http`/`https` only. `https://www.ayso13.org/...` and `https://ayso13.org/...` become root-relative (`/programs/all-stars/`).
- Slack channel `C0A024YGR9C` (`#notify-website-status`). Untrusted text reaches Slack only via a JSON file and `jq`, never shell interpolation; check `.ok` and annotate, don't fail.
- Pushes use `secrets.PROMOTE_TOKEN`. The workflow file lives on `staging` (schedule fires only from the default branch).
- Copy rules for any prose (Slack text, comments, CLAUDE.md): no exclamation points, em dashes sparingly, Oxford comma.

## Review Focus

1. A Google error or sign-in page returned with HTTP 200 must fail the run, not write an empty list. (Task 1 test `parseFeed rejects non-calendar text`.)
2. A description containing `#websites` or `#website-team` must not count as tagged; `#Website.` at a sentence end must. (Task 2 test `hasTag word boundary`.)
3. A cancelled single occurrence (`STATUS:CANCELLED` override) of a tagged weekly series is skipped and the following week shows. (Task 1 test `cancelled override is dropped`.)
4. A title with `&`, `<b>`, or surrounding whitespace is stored as plain text with `&` intact. (Task 2 test `entry name is plain text`.)
5. A timed event ending exactly at midnight Pacific has no `endDate` (it is a one-day event). (Task 1 test `timed event ending at midnight is single-day`.)

---

### Task 1: Feed parser

**Files:**
- Create: `site/scripts/lib/calendar-feed.mjs`
- Create: `site/scripts/lib/fixtures/calendar-sample.ics`
- Test: `site/scripts/lib/calendar-feed.test.mjs`
- Modify: `site/package.json` (add `"ical.js": "2.2.1"` to `dependencies`; run `npm install` to update the lockfile)

**Interfaces:**
- Produces:
  - `parseFeed(icsText: string, { from: string, horizonDays?: number = 400 }) -> Occurrence[]`
  - `type Occurrence = { uid: string, start: string, lastDay: string, summary: string, description: string }` (dates are Pacific `YYYY-MM-DD`; `lastDay === start` for single-day events)
  - Throws `Error("not an iCalendar feed")` if the text has no `VCALENDAR`, and `Error("feed has no events")` if it has zero `VEVENT`s.

Returns every occurrence whose `lastDay >= from` and whose `start` is no more than `horizonDays` after `from`, across one-off events and expanded series. Untagged events are returned too; filtering is Task 2's job.

- [ ] **Step 1: Write the fixture.** A hand-written `.ics` with one `VTIMEZONE` for `America/Los_Angeles` (copy it from the live feed) and these `VEVENT`s, `from` = `2026-10-23`:
  - `allday-1`: all-day `2026-10-25` (`DTEND;VALUE=DATE:20261026`)
  - `utc-evening`: `DTSTART:20261031T013000Z` (6:30pm PDT Oct 30)
  - `tzid-1`: `DTSTART;TZID=America/Los_Angeles:20261101T090000`
  - `weekly`: Saturdays from `20261003T090000` PT, `RRULE:FREQ=WEEKLY`, `EXDATE` on 2026-10-24, plus a `RECURRENCE-ID` override moving 2026-10-31 to 2026-11-01 with its own `SUMMARY` and `DESCRIPTION`
  - `weekly-cancel`: Sundays from 2026-10-04, with a `STATUS:CANCELLED` override for 2026-10-25
  - `multiday`: all-day `20261205`–`DTEND;VALUE=DATE:20261207`
  - `midnight-end`: `DTSTART;TZID=America/Los_Angeles:20261110T180000`, `DTEND;TZID=America/Los_Angeles:20261111T000000`
  - `past-1`: all-day `2026-10-01`
  - `ongoing`: all-day `20261022`–`20261025` (started before `from`, ends after)

- [ ] **Step 2: Write the failing tests** in `calendar-feed.test.mjs`, one `test()` each:
  - `all-day date is taken as-is`: `allday-1` → `start: "2026-10-25", lastDay: "2026-10-25"`
  - `UTC evening converts to the Pacific day`: `utc-evening` → `start: "2026-10-30"`
  - `EXDATE skips and override moves`: `weekly` starts include `"2026-11-01"` and `"2026-11-07"` and exclude `"2026-10-24"` and `"2026-10-31"`; the 2026-11-01 occurrence carries the override's `summary` and `description`
  - `cancelled override is dropped`: no `weekly-cancel` occurrence starts `2026-10-25`; `2026-11-01` present
  - `all-day DTEND is exclusive`: `multiday` → `start: "2026-12-05", lastDay: "2026-12-06"`
  - `timed event ending at midnight is single-day`: `midnight-end` → `lastDay: "2026-11-10"`
  - `past events are excluded, ongoing ones kept`: no `past-1`; `ongoing` present with `start: "2026-10-22", lastDay: "2026-10-24"`
  - `horizon bounds infinite series`: with `horizonDays: 14`, the latest `weekly` start is ≤ `2026-11-06`
  - `parseFeed rejects non-calendar text`: `"<html>Sign in</html>"` throws `/not an iCalendar feed/`; a `VCALENDAR` with no events throws `/no events/`

- [ ] **Step 3: Run** `cd site && node --test scripts/lib/calendar-feed.test.mjs`. Expected: FAIL, module not found.

- [ ] **Step 4: Implement `parseFeed`.** Use `ICAL.parse` → `ICAL.Component`; register each `vtimezone` with `ICAL.TimezoneService`; group `vevent`s by `UID`, with the master (no `RECURRENCE-ID`) as an `ICAL.Event` and the rest passed to `event.relateException()`. For recurring masters, walk `event.iterator()` and call `event.getOccurrenceDetails(time)`; stop once the start passes the horizon. Skip any occurrence whose item has `STATUS:CANCELLED`. Convert timed values with `toJSDate()` and the Pacific formatter; for `DATE` values use the date fields directly. Last day: for all-day, end minus one day; for timed, the Pacific date of `end - 1 ms`; never earlier than `start`.

- [ ] **Step 5: Run the test again.** Expected: all PASS. Also run `npm test` to make sure nothing else broke.

- [ ] **Step 6: Smoke against the live feed.** `curl -sS "<feed URL>" -o "$TMPDIR/cal.ics"` and `node -e` a call to `parseFeed` with today's Pacific date. Expected: no throw, several hundred occurrences, finishes in under ~5 s.

- [ ] **Step 7: Commit** `site/package.json site/package-lock.json site/scripts/lib/calendar-feed.mjs site/scripts/lib/calendar-feed.test.mjs site/scripts/lib/fixtures/calendar-sample.ics` — `Important dates: parse the Google Calendar feed into occurrences`.

### Task 2: Entry rules

**Files:**
- Create: `site/scripts/lib/important-dates.mjs`
- Test: `site/scripts/lib/important-dates.test.mjs`

**Interfaces:**
- Consumes: `Occurrence` from Task 1.
- Produces:
  - `pacificToday(now?: Date) -> string`
  - `hasTag(description: string) -> boolean`
  - `firstLink(description: string) -> string | undefined`
  - `toEntries(occurrences: Occurrence[], today: string) -> Entry[]` where `Entry = { date, endDate?, name, link? }`
  - `diffEntries(prev: Entry[], next: Entry[], today: string) -> { added: Entry[], removed: Entry[], notify: boolean }`
  - `serialize(enabled: boolean, entries: Entry[]) -> string`

- [ ] **Step 1: Write the failing tests**, one `test()` each:
  - `hasTag word boundary`: true for `"Bring water #website"`, `"#Website."`, `"<p>#WEBSITE</p>"`; false for `"#websites"`, `"#website-team"`, `"website"`, `""`
  - `firstLink takes the first in document order`: `'Sign up <a href="https://a.example/x">here</a> or https://b.example'` → `"https://a.example/x"`; `'see https://b.example then <a href="https://a.example">'` → `"https://b.example"`
  - `firstLink unwraps Google redirects`: `'<a href="https://www.google.com/url?q=https://www.applicantservices.com/x&amp;sa=D&amp;ust=1">'` → `"https://www.applicantservices.com/x"`
  - `firstLink rejects non-http schemes`: `'<a href="javascript:alert(1)">x</a>'` → `undefined`; `'mailto:a@b.org'` → `undefined`
  - `firstLink makes ayso13 links relative`: `"https://www.ayso13.org/programs/all-stars/"` and `"https://ayso13.org/programs/all-stars/"` → `"/programs/all-stars/"`; `"https://staging.ayso13.org/programs/next"` stays absolute
  - `firstLink decodes entities and trims trailing punctuation`: `"https://x.example/a?b=1&amp;c=2."` → `"https://x.example/a?b=1&c=2"`
  - `entry name is plain text`: summary `"  <b>Picture Day</b> & Snacks "` → `name: "Picture Day & Snacks"`
  - `toEntries keeps tagged only, earliest per uid`: two tagged occurrences of one uid → one entry with the earlier date
  - `override tags are per occurrence`: untagged series + one tagged override → that one entry; tagged series whose next occurrence is untagged → the following tagged date
  - `endDate only for multi-day`: `lastDay === start` → no `endDate` key; otherwise `endDate: lastDay`
  - `toEntries drops entries whose last day is before today and sorts by date then name`
  - `diffEntries is quiet for roll-forward and expiry`: prev `[{date:"2026-10-17",name:"Lab"}]`, next `[{date:"2026-10-24",name:"Lab"}]`, today `"2026-10-23"` → `notify: false`; prev entry with `date` before today simply gone → `notify: false`
  - `diffEntries notifies on calendar changes`: new name, renamed entry, changed link, or removal of a future entry → `notify: true` with the entry in `added`/`removed`
  - `serialize is stable`: same input twice → identical string ending in `"\n"`; key order `date,endDate,name,link`

- [ ] **Step 2: Run** `node --test scripts/lib/important-dates.test.mjs`. Expected: FAIL, module not found.

- [ ] **Step 3: Implement** the six functions. Entries compare by the tuple `(date, endDate, name, link)`. In `diffEntries`, a removed entry is explained when its `endDate ?? date` is before `today`; an add/remove pair with the same `name` is a roll-forward when the removed one is explained and the added one is later. `notify` is true when anything unexplained remains.

- [ ] **Step 4: Run** `npm test`. Expected: all PASS.

- [ ] **Step 5: Commit** — `Important dates: rules for tags, links, and entries`.

### Task 3: Runner

**Files:**
- Create: `site/scripts/sync-important-dates.mjs`
- Test: `site/scripts/sync-important-dates.test.mjs`

**Interfaces:**
- Consumes: `parseFeed` (Task 1); `pacificToday`, `toEntries`, `diffEntries`, `serialize` (Task 2).
- Produces:
  - `fetchFeed({ url, fetchImpl = fetch }) -> Promise<string>`: 30 s timeout (`AbortSignal.timeout(30000)`); throws on non-2xx with the status in the message.
  - `syncImportantDates({ icsText, existingJson, now }) -> { output: string, changed: boolean, summary: { added, removed, notify } }`: `existingJson` may be `undefined` or unparseable, in which case `enabled` defaults to `true` and the previous list is `[]`.
  - CLI (`node scripts/sync-important-dates.mjs`) when run directly: env `IMPORTANT_DATES_FEED_URL` (default: the feed URL), `IMPORTANT_DATES_PATH` (default `site/src/_data/importantDates.json` resolved from the script), `IMPORTANT_DATES_SYNC_SUMMARY` (optional path; writes `summary` as JSON). Writes the data file only when `changed`. Exits non-zero on any thrown error, leaving the data file untouched.

- [ ] **Step 1: Write the failing tests:**
  - `fetchFeed throws on HTTP errors`: fake `fetchImpl` returning 503 → rejects matching `/503/`
  - `syncImportantDates preserves enabled`: `existingJson` `{"enabled":false,"dates":[]}` → output has `"enabled": false`
  - `syncImportantDates defaults when the file is missing or corrupt`: `undefined` and `"{oops"` → `"enabled": true`
  - `unchanged calendar is not a change`: run twice, feeding the first output back as `existingJson` → second `changed: false`
  - `feed errors propagate`: `icsText: "<html>"` → throws (so the CLI exits non-zero before writing)
  - Use the Task 1 fixture plus one tagged event and `now = new Date("2026-10-23T19:00:00Z")`.

- [ ] **Step 2: Run** `node --test scripts/sync-important-dates.test.mjs`. Expected: FAIL.

- [ ] **Step 3: Implement.** Follow `sync-newsletters.mjs` for the direct-run guard (`import.meta.url === pathToFileURL(process.argv[1]).href`) and error handling.

- [ ] **Step 4: Run** `npm test`. Expected: all PASS.

- [ ] **Step 5: Live dry run.** `IMPORTANT_DATES_PATH="$TMPDIR/imp.json" IMPORTANT_DATES_SYNC_SUMMARY="$TMPDIR/imp-summary.json" node scripts/sync-important-dates.mjs && cat "$TMPDIR/imp.json" "$TMPDIR/imp-summary.json"`. Expected: exit 0, valid JSON. No events are tagged yet, so `dates` is `[]`. Do not run it against the real data file.

- [ ] **Step 6: Commit** — `Important dates: sync runner`.

### Task 4: Widget understands endDate and Pacific time

**Files:**
- Modify: `site/.eleventy.js:105-119` (the `upcomingEvents` filter)
- Modify: `site/src/_includes/important-dates.njk` (card attributes and the inline script)

**Interfaces:**
- Consumes: the `Entry` shape from Task 2 (`endDate` optional).

- [ ] **Step 1: Change the filter.** Compute today as the Pacific `YYYY-MM-DD` string with the formatter from Global Constraints and keep an entry while `(e.endDate || e.date) >= today` (string comparison). Keep the `n` default, the `date`/`name` guard, and the sort by `date`. Update the comment above it.

- [ ] **Step 2: Change the template.** Add `data-end-date="{{ ev.endDate or ev.date }}"` to each `.date-card`. In the inline script, compute today with `new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())` and hide a card when `dataset.endDate < today`. Confirm `{{ ev.name }}` and `{{ ev.link }}` are autoescaped: put `"name": "<b>x</b>"` in a scratch copy of the data and check the built HTML shows `&lt;b&gt;`. If Eleventy's Nunjucks is not autoescaping, add `| escape` to both.

- [ ] **Step 3: Build and inspect.** Temporarily set `importantDates.json` to include a multi-day entry spanning today and an entry dated yesterday; `npm run build`; check `_site/index.html`: the multi-day card is present with the right `data-end-date`, yesterday's is absent. Restore the file (`git checkout -- src/_data/importantDates.json`).

- [ ] **Step 4: Commit** `site/.eleventy.js site/src/_includes/important-dates.njk` — `Important dates widget: honor endDate and Pacific time`.

### Task 5: Workflow, CMS, and docs

**Files:**
- Create: `.github/workflows/sync-important-dates.yml`
- Modify: `.github/workflows/rebuild-production.yml` (`on.push.paths`, and the comment above it)
- Modify: `.pages.yml` (delete the `importantDates` block, lines 57-75)
- Modify: `CLAUDE.md` (Site-wide Data Files entry for `importantDates.json`, a short headline-state bullet, Last updated line)

- [ ] **Step 1: Write the workflow** (`name: Sync Important Dates`), modeled on `sync-newsletters.yml` (keep its header-comment style and both ⚠️ notes):
  - `on: schedule: cron '17 * * * *'` and `workflow_dispatch`.
  - `permissions: contents: read, actions: read`. `concurrency: { group: sync-important-dates, cancel-in-progress: false }`. `timeout-minutes: 10`.
  - Checkout `staging` to `staging/` with `PROMOTE_TOKEN`; setup-node 22; `npm ci --omit=dev` in `staging/site`.
  - Sync step: run the runner with `IMPORTANT_DATES_SYNC_SUMMARY=${{ runner.temp }}/imp.json`; output `changed` from `git status --porcelain -- src/_data/importantDates.json`.
  - Commit and push to `staging` when changed (identity `ayso13-calendar-sync` / `webmaster@ayso13.org`, message `Important dates: sync from Google Calendar (N added, M removed)`, the same rebase-once retry).
  - Promote guard step, `GH_TOKEN: ${{ github.token }}`: `gh run list --repo "$GITHUB_REPOSITORY" --workflow promote-to-production.yml --json status --jq '[.[] | select(.status != "completed")] | length'`; output `promote_active=true` when non-zero, with a `::notice::` saying main was skipped this hour.
  - Checkout `main` to `main/` and copy the file over, commit and push only if it differs; skipped when `promote_active`.
  - Slack published step: only when a push happened and `jq -e .notify` on the summary is true. Lists added and removed entries (name and date), built with `jq` from the summary file like the newsletter step.
  - Slack failure step: `if: failure()`. First `gh run list --workflow sync-important-dates.yml --status completed --limit 1 --json conclusion --jq '.[0].conclusion'`; post only if it is `success` (or empty, for the first ever run). Text: the sync failed, the home page keeps the last good dates, and the most likely causes (Google feed unreachable, or the feed returned something that is not a calendar).

- [ ] **Step 2: Widen rebuild-production.** Add `'site/src/_data/importantDates.json'` to `on.push.paths`, and mention the calendar sync in the comment where the newsletter sync is mentioned.

- [ ] **Step 3: Remove the CMS block** from `.pages.yml`.

- [ ] **Step 4: Lint.** Run `actionlint .github/workflows/sync-important-dates.yml .github/workflows/rebuild-production.yml` from the repo root. Expected: no output. Run `cd site && npm test && npm run build`. Expected: tests pass, build succeeds.

- [ ] **Step 5: Update CLAUDE.md.** The `importantDates.json` entry says it is generated hourly from `#website`-tagged calendar events, written to both branches, never hand-edited, with `endDate` for multi-day events; note the promote guard and the quiet roll-forward. Keep it short; detail belongs in the spec.

- [ ] **Step 6: Commit** — `Important dates: hourly sync workflow, retire the CMS editor`.

## After the plan (for the user, not the implementer)

1. Admins add `#website` to the events now in `importantDates.json` before the first run.
2. Merge to `staging`, promote once so `main` has the new `rebuild-production.yml` paths and widget changes, then run "Sync Important Dates" by hand and check www.
3. Close issue #27.
