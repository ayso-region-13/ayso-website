import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { fetchFeed, syncImportantDates, calendarIdOf } from "./sync-important-dates.mjs";

const FIXTURE = await fs.readFile(new URL("./lib/fixtures/calendar-sample.ics", import.meta.url), "utf8");
// The fixture has no #website events, so graft two onto it before END:VCALENDAR.
const TAGGED = `BEGIN:VEVENT
UID:tagged-1
DTSTAMP:20261001T000000Z
DTSTART;VALUE=DATE:20261114
DTEND;VALUE=DATE:20261115
SUMMARY:All-Stars tryouts
DESCRIPTION:Details at https://www.ayso13.org/programs/all-stars/ #website
END:VEVENT
BEGIN:VEVENT
UID:tagged-2
DTSTAMP:20261001T000000Z
DTSTART;TZID=America/Los_Angeles:20261205T090000
DTEND;TZID=America/Los_Angeles:20261205T110000
SUMMARY:Winter Stars kickoff
DESCRIPTION:#Website
END:VEVENT
END:VCALENDAR`;
const ICS = FIXTURE.replace(/END:VCALENDAR\s*$/, TAGGED);
const NOW = new Date("2026-10-23T19:00:00Z");

test("fetchFeed throws on HTTP errors", async () => {
  const fetchImpl = async () => ({ ok: false, status: 503, text: async () => "" });
  await assert.rejects(fetchFeed({ url: "https://example.test/x.ics", fetchImpl }), /503/);
});

test("fetchFeed returns the body text", async () => {
  const fetchImpl = async () => ({ ok: true, status: 200, text: async () => "BEGIN:VCALENDAR" });
  assert.equal(await fetchFeed({ url: "https://example.test/x.ics", fetchImpl }), "BEGIN:VCALENDAR");
});

test("syncImportantDates writes the tagged events", () => {
  const { output, changed, summary } = syncImportantDates({ icsText: ICS, existingJson: undefined, now: NOW });
  const parsed = JSON.parse(output);
  // The fixture's moved weekly instance is itself tagged, so it joins our two.
  const names = parsed.dates.map((d) => d.name);
  assert.ok(names.includes("All-Stars tryouts") && names.includes("Winter Stars kickoff"));
  assert.equal(parsed.dates.find((d) => d.name === "All-Stars tryouts").link, "/programs/all-stars/");
  assert.equal(changed, true);
  assert.equal(summary.added.length, names.length);
});

test("syncImportantDates preserves enabled", () => {
  const { output } = syncImportantDates({ icsText: ICS, existingJson: '{"enabled":false,"dates":[]}', now: NOW });
  assert.equal(JSON.parse(output).enabled, false);
});

test("syncImportantDates defaults when the file is missing or corrupt", () => {
  for (const existingJson of [undefined, "{oops"]) {
    const { output } = syncImportantDates({ icsText: ICS, existingJson, now: NOW });
    assert.equal(JSON.parse(output).enabled, true);
  }
});

test("unchanged calendar is not a change", () => {
  const first = syncImportantDates({ icsText: ICS, existingJson: undefined, now: NOW });
  const second = syncImportantDates({ icsText: ICS, existingJson: first.output, now: NOW });
  assert.equal(second.changed, false);
  assert.deepEqual(second.summary, { added: [], removed: [], notify: false });
});

test("feed errors propagate", () => {
  assert.throws(() => syncImportantDates({ icsText: "<html>", existingJson: undefined, now: NOW }), /not an iCalendar feed/);
});

test("calendarIdOf reads the id from a public feed URL", () => {
  assert.equal(
    calendarIdOf("https://calendar.google.com/calendar/ical/abc%40group.calendar.google.com/public/basic.ics"),
    "abc@group.calendar.google.com");
  assert.equal(calendarIdOf("https://example.test/x.ics"), undefined);
});
