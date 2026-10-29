import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseFeed } from "./calendar-feed.mjs";

const ICS = readFileSync(new URL("./fixtures/calendar-sample.ics", import.meta.url), "utf8");
const FROM = "2026-10-23";
const all = parseFeed(ICS, { from: FROM });
const byUid = (uid, occ = all) => occ.filter((o) => o.uid === uid);

test("all-day date is taken as-is", () => {
  const [o] = byUid("allday-1");
  assert.equal(o.start, "2026-10-25");
  assert.equal(o.lastDay, "2026-10-25");
});

test("UTC evening converts to the Pacific day", () => {
  assert.equal(byUid("utc-evening")[0].start, "2026-10-30");
});

test("TZID time keeps its Pacific day", () => {
  assert.equal(byUid("tzid-1")[0].start, "2026-11-01");
});

test("EXDATE skips and override moves", () => {
  const weekly = byUid("weekly");
  const starts = weekly.map((o) => o.start);
  assert.ok(starts.includes("2026-11-01"));
  assert.ok(starts.includes("2026-11-07"));
  assert.ok(!starts.includes("2026-10-24"));
  assert.ok(!starts.includes("2026-10-31"));
  const moved = weekly.find((o) => o.start === "2026-11-01");
  assert.equal(moved.summary, "Weekly moved");
  assert.equal(moved.description, "Moved #website");
});

test("cancelled override is dropped", () => {
  const starts = byUid("weekly-cancel").map((o) => o.start);
  assert.ok(!starts.includes("2026-10-25"));
  assert.ok(starts.includes("2026-11-01"));
});

test("all-day DTEND is exclusive", () => {
  const [o] = byUid("multiday");
  assert.equal(o.start, "2026-12-05");
  assert.equal(o.lastDay, "2026-12-06");
});

test("timed event ending at midnight is single-day", () => {
  assert.equal(byUid("midnight-end")[0].lastDay, "2026-11-10");
});

test("past events are excluded, ongoing ones kept", () => {
  assert.equal(byUid("past-1").length, 0);
  const [o] = byUid("ongoing");
  assert.equal(o.start, "2026-10-22");
  assert.equal(o.lastDay, "2026-10-24");
});

test("horizon bounds infinite series", () => {
  const short = parseFeed(ICS, { from: FROM, horizonDays: 14 });
  const starts = byUid("weekly", short).map((o) => o.start).sort();
  assert.ok(starts.length > 0);
  assert.ok(starts.at(-1) <= "2026-11-06");
});

test("parseFeed rejects non-calendar text", () => {
  assert.throws(() => parseFeed("<html>Sign in</html>", { from: FROM }), /not an iCalendar feed/);
  assert.throws(
    () => parseFeed("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n", { from: FROM }),
    /no events/,
  );
});
