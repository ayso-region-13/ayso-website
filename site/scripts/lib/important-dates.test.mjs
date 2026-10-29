import { test } from "node:test";
import assert from "node:assert/strict";
import {
  pacificToday, hasTag, firstLink, toEntries, diffEntries, serialize, calendarEventLink,
} from "./important-dates.mjs";

const occ = (o) => ({ uid: "u1", start: "2026-11-01", lastDay: "2026-11-01", summary: "Event", description: "#website", ...o });

test("pacificToday uses the Pacific calendar day, not UTC", () => {
  assert.equal(pacificToday(new Date("2026-10-24T05:30:00Z")), "2026-10-23");
});

test("hasTag word boundary", () => {
  for (const s of ["Bring water #website", "#Website.", "<p>#WEBSITE</p>"]) assert.equal(hasTag(s), true, s);
  for (const s of ["#websites", "#website-team", "website", ""]) assert.equal(hasTag(s), false, s);
});

test("firstLink takes the first in document order", () => {
  assert.equal(firstLink('Sign up <a href="https://a.example/x">here</a> or https://b.example'), "https://a.example/x");
  assert.equal(firstLink('see https://b.example then <a href="https://a.example">'), "https://b.example");
});

test("firstLink unwraps Google redirects", () => {
  assert.equal(
    firstLink('<a href="https://www.google.com/url?q=https://www.applicantservices.com/x&amp;sa=D&amp;ust=1">'),
    "https://www.applicantservices.com/x");
  assert.equal(
    firstLink('<a href="https://www.google.com/url?q=https%3A%2F%2Fx.example%2Fa%3Fb%3D1&amp;sa=D">'),
    "https://x.example/a?b=1");
});

test("firstLink rejects non-http schemes", () => {
  assert.equal(firstLink('<a href="javascript:alert(1)">x</a>'), undefined);
  assert.equal(firstLink("mailto:a@b.org"), undefined);
  assert.equal(firstLink('<a href="javascript:alert(1)">x</a> https://ok.example'), undefined);
});

test("firstLink makes ayso13 links relative", () => {
  assert.equal(firstLink("https://www.ayso13.org/programs/all-stars/"), "/programs/all-stars/");
  assert.equal(firstLink("https://ayso13.org/programs/all-stars/"), "/programs/all-stars/");
  assert.equal(firstLink("https://staging.ayso13.org/programs/next"), "https://staging.ayso13.org/programs/next");
});

test("firstLink keeps a double-slash ayso13 path absolute", () => {
  assert.equal(firstLink("https://www.ayso13.org//evil.example/x"), "https://www.ayso13.org//evil.example/x");
});

test("firstLink decodes entities and trims trailing punctuation", () => {
  assert.equal(firstLink("https://x.example/a?b=1&amp;c=2."), "https://x.example/a?b=1&c=2");
});

test("entry name is plain text", () => {
  const [e] = toEntries([occ({ summary: "  <b>Picture Day</b> & Snacks " })], "2026-10-23");
  assert.equal(e.name, "Picture Day & Snacks");
});

test("toEntries keeps tagged only, earliest per uid", () => {
  const out = toEntries([
    occ({ start: "2026-11-08", lastDay: "2026-11-08" }),
    occ({ start: "2026-11-01", lastDay: "2026-11-01" }),
    occ({ uid: "u2", description: "no tag" }),
  ], "2026-10-23");
  assert.deepEqual(out, [{ date: "2026-11-01", name: "Event" }]);
});

test("override tags are per occurrence", () => {
  const onlyOverride = toEntries([
    occ({ start: "2026-11-01", description: "" }),
    occ({ start: "2026-11-08", lastDay: "2026-11-08", description: "#website" }),
    occ({ start: "2026-11-15", description: "" }),
  ], "2026-10-23");
  assert.deepEqual(onlyOverride.map((e) => e.date), ["2026-11-08"]);
  const nextUntagged = toEntries([
    occ({ start: "2026-11-01", description: "" }),
    occ({ start: "2026-11-08", lastDay: "2026-11-08", description: "#website" }),
  ], "2026-10-23");
  assert.deepEqual(nextUntagged.map((e) => e.date), ["2026-11-08"]);
});

test("endDate only for multi-day", () => {
  const [a, b] = toEntries([
    occ({ uid: "a", start: "2026-11-01", lastDay: "2026-11-01" }),
    occ({ uid: "b", start: "2026-11-02", lastDay: "2026-11-03" }),
  ], "2026-10-23");
  assert.equal("endDate" in a, false);
  assert.equal(b.endDate, "2026-11-03");
});

test("toEntries drops entries whose last day is before today and sorts by date then name", () => {
  const out = toEntries([
    occ({ uid: "a", start: "2026-10-20", lastDay: "2026-10-22", summary: "Past" }),
    occ({ uid: "b", start: "2026-10-22", lastDay: "2026-10-23", summary: "Spans today" }),
    occ({ uid: "c", start: "2026-11-02", lastDay: "2026-11-02", summary: "Zed" }),
    occ({ uid: "d", start: "2026-11-02", lastDay: "2026-11-02", summary: "Alpha" }),
  ], "2026-10-23");
  assert.deepEqual(out.map((e) => e.name), ["Spans today", "Alpha", "Zed"]);
});

test("toEntries output does not depend on feed order for tied entries", () => {
  const a = occ({ uid: "a", summary: "Same", description: '#website https://a.example/' });
  const b = occ({ uid: "b", summary: "Same", description: '#website https://b.example/' });
  assert.deepEqual(toEntries([a, b], "2026-10-23"), toEntries([b, a], "2026-10-23"));
});

test("toEntries includes the link when present", () => {
  const [e] = toEntries([occ({ description: '#website <a href="https://x.example/">go</a>' })], "2026-10-23");
  assert.equal(e.link, "https://x.example/");
});

test("diffEntries is quiet for roll-forward and expiry", () => {
  const today = "2026-10-23";
  const roll = diffEntries([{ date: "2026-10-17", name: "Lab" }], [{ date: "2026-10-24", name: "Lab" }], today);
  assert.equal(roll.notify, false);
  const gone = diffEntries([{ date: "2026-10-17", name: "Lab" }], [], today);
  assert.equal(gone.notify, false);
});

test("diffEntries notifies on calendar changes", () => {
  const today = "2026-10-23";
  const base = [{ date: "2026-11-01", name: "Lab", link: "https://a.example" }];
  const added = { date: "2026-11-05", name: "New" };
  let d = diffEntries(base, [...base, added], today);
  assert.equal(d.notify, true);
  assert.deepEqual(d.added, [added]);
  d = diffEntries(base, [{ date: "2026-11-01", name: "Lab 2", link: "https://a.example" }], today);
  assert.equal(d.notify, true);
  d = diffEntries(base, [{ date: "2026-11-01", name: "Lab", link: "https://b.example" }], today);
  assert.equal(d.notify, true);
  assert.equal(d.removed.length, 1);
  d = diffEntries(base, [], today);
  assert.equal(d.notify, true);
  assert.deepEqual(d.removed, base);
});

test("serialize is stable", () => {
  const entries = [{ link: "/x/", name: "N", endDate: "2026-11-02", date: "2026-11-01" }];
  const a = serialize(true, entries);
  assert.equal(a, serialize(true, entries));
  assert.ok(a.endsWith("\n"));
  const e = JSON.parse(a).dates[0];
  assert.deepEqual(Object.keys(e), ["date", "endDate", "name", "link"]);
  assert.equal(JSON.parse(a).enabled, true);
});

const CAL = "cal-1@group.calendar.google.com";
const eidOf = (link) => Buffer.from(new URL(link).searchParams.get("eid"), "base64url").toString();

test("calendarEventLink builds Google's public event URL", () => {
  const link = calendarEventLink("abc123@google.com", CAL);
  assert.match(link, /^https:\/\/www\.google\.com\/calendar\/event\?eid=[\w-]+$/);
  assert.equal(eidOf(link), `abc123 ${CAL}`);
  // A split series keeps its "_R<start>" suffix; that is part of Google's id.
  assert.equal(eidOf(calendarEventLink("_abc_R20260403T021500@google.com", CAL)),
    `_abc_R20260403T021500 ${CAL}`);
});

test("calendarEventLink matches a link Google serves publicly", () => {
  // Opened without a sign-in on 2026-10-29: the Beyond the Ball Coach Workshop.
  assert.equal(
    calendarEventLink("4vgtio1qt7ua9n0hsfpto53dej@google.com", "g60lvbvlhbucts84e1ft40mlpk@group.calendar.google.com"),
    "https://www.google.com/calendar/event?eid=NHZndGlvMXF0N3VhOW4waHNmcHRvNTNkZWogZzYwbHZidmxoYnVjdHM4NGUxZnQ0MG1scGtAZ3JvdXAuY2FsZW5kYXIuZ29vZ2xlLmNvbQ");
});

test("calendarEventLink skips UIDs Google did not issue", () => {
  assert.equal(calendarEventLink("B712E22B-6F14-4AD4", CAL), undefined);
  assert.equal(calendarEventLink("abc@google.com", undefined), undefined);
});

test("toEntries links to the calendar event only when the description has no link", () => {
  const [plain] = toEntries([occ({ uid: "abc@google.com" })], "2026-10-23", { calendarId: CAL });
  assert.equal(eidOf(plain.link), `abc ${CAL}`);
  const [own] = toEntries([occ({ uid: "abc@google.com", description: "#website https://x.example" })],
    "2026-10-23", { calendarId: CAL });
  assert.equal(own.link, "https://x.example");
  const [none] = toEntries([occ({ uid: "abc@google.com" })], "2026-10-23");
  assert.equal(none.link, undefined);
});
