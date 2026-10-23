# Important Dates from the Google Calendar — design

Issue: https://github.com/ayso-region-13/ayso-website/issues/27
Branch: `calendar-important-dates` (cut from `staging`)

## Why

Every important date gets entered twice. League admins add events to the public Region 13 Google Calendar, and then one of three website publishers types the same event into `site/src/_data/importantDates.json` through Pages CMS. That file feeds the "Upcoming Dates" column on the home page (`_includes/important-dates.njk`). Hand entry drifts: on 2026-10-23 the NEXT Scrimmages entry linked to a staging URL.

The goal is that managing the calendar manages the website. An admin tags an event, and it appears on www within the hour. Nobody touches Pages CMS for Important Dates again.

## Goals

- Admins control what shows on the home page from Google Calendar alone.
- Changes reach www.ayso13.org within about an hour, without a promote.
- The home page always shows the next five tagged events in date order.

## Non-goals

- No change to how the widget looks.
- No change to `/about/calendar/`, which keeps embedding the full calendar.
- No new place to edit dates. Pages CMS stops editing this file.

## Anti-goals (failure even if it technically works)

- A calendar outage or a malformed feed empties the home page widget.
- A bad link in a calendar event (a `javascript:` URL, or HTML in a title) reaches production. The sync publishes unreviewed, so it must sanitize.
- Hourly runs spam Slack or trigger production rebuilds when nothing changed.
- A recurring weekly event fills several of the five slots.

## Decided (by Matthew)

1. **Tag:** an event is included when its description contains `#website`.
2. **Link:** the first URL in the description. No URL means no link.
3. **Publishing:** commit to both `staging` and `main` with `PROMOTE_TOKEN`, like `sync-newsletters.yml`. No staging review step.
4. **Schedule:** hourly.
5. **Display:** the next five tagged events, chronological. A recurring event counts once, as its next occurrence.

## How it works

A new workflow, `.github/workflows/sync-important-dates.yml`, runs hourly and on `workflow_dispatch`. It follows `sync-newsletters.yml` closely: check out `staging`, run the sync script, commit only if the file changed, push to `staging`, then copy the same file to `main` and push there. The `main` step runs on every successful sync (not only when staging changed), so a failed `main` push heals on the next run. The file must live on `staging`, because `schedule` only fires from the default branch.

`rebuild-production.yml` gets `site/src/_data/importantDates.json` added to its `push.paths` list. That is what deploys www after the `main` push. Like the other paths there, it is inert until promoted to `main` once.

### The feed

The calendar's public iCal feed, already linked on `/about/calendar/`:

`https://calendar.google.com/calendar/ical/g60lvbvlhbucts84e1ft40mlpk%40group.calendar.google.com/public/basic.ics`

No API key. Observed on 2026-10-23 (674 KB, 1,049 events), so the parser has to handle all of these:

- 44 recurring series (`RRULE`), 38 with `EXDATE` exclusions, and 66 single-occurrence overrides (`RECURRENCE-ID`). Recurrence has to be expanded properly; use a maintained iCal library (for example `node-ical` or `ical.js`) rather than hand parsing. Library choice is the builder's.
- 469 all-day events (`DTSTART;VALUE=DATE`), 477 in UTC, the rest `TZID=America/Los_Angeles`. Every date is computed in America/Los_Angeles; a 6pm PT event stored in UTC must not land on the next day.
- Descriptions contain HTML (`<a href="…">`) and Google redirect wrappers (`https://www.google.com/url?q=<real URL>&…`).

### Turning events into entries

For each event whose description contains `#website` (case-insensitive, my call):

- **date:** the start date in Pacific time, `YYYY-MM-DD`. For a recurring series, the next occurrence on or after today (Pacific) that isn't excluded, honoring overrides; an override that moves or cancels an occurrence wins. A multi-day event shows its start date and stays on the widget until its last day is over (decided by Matthew).
- **endDate:** for a multi-day event only, its last day in Pacific time, `YYYY-MM-DD`. For an all-day event, iCal's `DTEND` is exclusive, so the last day is `DTEND` minus one day. Omitted for single-day events.
- **Overrides are judged on their own (my call).** After expanding a series, each occurrence uses its own title, description, and tag: an edited "this event only" occurrence (`RECURRENCE-ID`) carries its own `SUMMARY` and `DESCRIPTION`. So tagging one occurrence of an untagged series shows just that one; untagging one occurrence of a tagged series skips it and the next tagged one shows; an override's own link wins. "Counts once" then means the earliest upcoming tagged occurrence per series `UID`.
- **name:** the event title, trimmed, with any HTML stripped. Stored as plain text.
- **link:** the first URL in the description, in document order, whether it appears as an `href` or as bare text. Unwrap `google.com/url?q=` to the real target. Keep it only if the scheme is `http` or `https`; otherwise omit the link and keep the event. Rewrite `https://www.ayso13.org/...` and `https://ayso13.org/...` to a root-relative path (my call; keeps the link working on staging).

Keep entries whose last day (`endDate`, else `date`) is today or later (Pacific), sorted by start date, then title. Drop the rest. Write all upcoming tagged entries, not just five; the widget's existing `upcomingEvents(5)` filter picks the five.

### Output

Same shape the widget reads today, plus an optional `endDate`:

```json
{
  "enabled": true,
  "dates": [
    { "date": "2026-11-01", "name": "All Star Tryouts at Area H", "link": "/programs/all-stars/" },
    { "date": "2026-12-05", "endDate": "2026-12-06", "name": "Winter tournament" }
  ]
}
```

The widget needs two small changes to honor `endDate`: the `upcomingEvents` filter in `site/.eleventy.js` keeps an entry while `endDate || date` is today or later, and the client-side hiding script in `important-dates.njk` checks the same value (for example a `data-end-date` attribute). The card still shows the start date.

`enabled` is read from the existing file and preserved. Write the file with stable formatting so an unchanged calendar produces a byte-identical file and no commit.

### Safety rails

- **Feed failure keeps the last good file.** A non-200, a timeout, a parse error, or a feed with zero events fails the run without touching the file.
- **Zero tagged events is legal.** If the feed is healthy but nothing is tagged, write an empty `dates` list. `home.njk` already hides the column when nothing is upcoming.
- **Don't evict a promote (my call).** `rebuild-production.yml` shares the `deploy-pages-prod` concurrency group with `promote-to-production.yml`, and GitHub keeps only one pending run per group, so a sync push to `main` could cancel a queued `/ayso promote`. Before pushing to `main`, check (via `gh api` with the workflow's token) whether a "Promote Staging to Production" run is queued or in progress; if so, skip the `main` push this hour. The staging push still happens, and the next hourly run catches `main` up.
- **Pacific "today" in the widget filter.** The `upcomingEvents` filter in `site/.eleventy.js` takes "today" from the build machine's clock, which is UTC on CI, so evening builds already treat tomorrow as today. Change it to compute today in America/Los_Angeles, matching the sync. Check the client-side script in `important-dates.njk` for the same assumption.
- **Untrusted text.** Titles and URLs are calendar-controlled. Besides the sanitizing above, confirm the Nunjucks template autoescapes `ev.name` and `ev.link`, and anything sent to Slack goes through a file and `jq`, never shell interpolation (same rule as the newsletter workflow).

### Slack

The file also changes when nobody touched the calendar: a past event drops off, or a series rolls forward to its next date. Those changes still commit and rebuild www (the next occurrence has to appear), but they don't post to Slack (my call). Post to `#notify-website-status` (channel `C0A024YGR9C`) only for changes the date alone doesn't explain, listing entries added and removed. A removal is "explained" when its last day is before today; a roll-forward is a removal plus an addition with the same name at a later date, where the old date is before today. On failure, post only when the previous run of this workflow succeeded, so an hour-long Google outage produces one message, not one per hour (my call). Check `.ok` on Slack's response and annotate rather than fail, as the newsletter workflow does.

### Pages CMS

Remove the `importantDates` entry from `.pages.yml`, so a hand edit can't be silently overwritten an hour later. Turning the widget off becomes a code edit to `enabled` (my call).

### Code layout and tests

- `site/scripts/sync-important-dates.mjs`: the runner (fetch, write, summary JSON for Slack).
- `site/scripts/lib/important-dates.mjs`: pure functions (tag match, link extraction, unwrapping, scheme check, Pacific date math, recurrence-to-next-occurrence, sort).
- Tests with `node --test`, picked up by `cd site && npm test`. Use a trimmed fixture `.ics` covering: an all-day event, a UTC evening event, a TZID event, a weekly series with an `EXDATE` and a moved override, an untagged series with one tagged override, a tagged series with one untagged override, a Google-wrapped link, a `javascript:` link, a bare-text link, two links in one description, a multi-day all-day event (checking the exclusive `DTEND`), an untagged event, and a past event.

## Rollout

1. Before the first real run, admins add `#website` to the events now in `importantDates.json`. The first sync replaces the hand list, so an untagged event disappears.
2. Merge the branch to `staging`, promote once so `main` has the widened `rebuild-production.yml` filter, then run the workflow by hand and check www.
3. Tell admins about the tag; update CLAUDE.md (Site-wide Data Files and the headline state).

## Left to the builder

The iCal library, the exact cron minute, commit message wording, the bot's git identity, and how the Slack message is laid out.
