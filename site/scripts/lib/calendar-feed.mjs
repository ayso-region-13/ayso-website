// Pure parser for the public Google Calendar feed behind the Important Dates
// widget. No I/O: the caller fetches the text, so every rule about which
// occurrences exist (EXDATEs, moved and cancelled instances, exclusive all-day
// ends) is unit-tested in calendar-feed.test.mjs against a fixture.

import ICAL from "ical.js";

const PACIFIC_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Los_Angeles",
  year: "numeric", month: "2-digit", day: "2-digit",
}); // en-CA formats as YYYY-MM-DD

const DAY_MS = 86_400_000;

const pad = (n) => String(n).padStart(2, "0");
const dateKey = (t) => `${t.year}-${pad(t.month)}-${pad(t.day)}`;

function addDays(key, n) {
  return new Date(Date.parse(`${key}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

// DATE values carry no zone, so their fields are the answer; timed values are
// instants and must be read in Pacific, not in the server's zone.
function pacificDay(t) {
  return t.isDate ? dateKey(t) : PACIFIC_DATE.format(t.toJSDate());
}

function lastDayOf(startDay, startTime, endTime) {
  if (!endTime) return startDay;
  // All-day DTEND is exclusive (a one-day event ends the next morning), and a
  // timed event ending exactly at midnight did not run into the new day, so
  // both step back one tick before reading the date.
  const last = endTime.isDate
    ? addDays(dateKey(endTime), -1)
    : PACIFIC_DATE.format(new Date(endTime.toJSDate().getTime() - 1));
  return last < startDay ? startDay : last;
}

function isCancelled(item) {
  return String(item.component.getFirstPropertyValue("status") || "").toUpperCase() === "CANCELLED";
}

function toOccurrence(uid, item, startTime, endTime) {
  if (isCancelled(item)) return null;
  const start = pacificDay(startTime);
  return {
    uid,
    start,
    lastDay: lastDayOf(start, startTime, endTime),
    summary: item.summary || "",
    description: item.description || "",
  };
}

export function parseFeed(icsText, { from, horizonDays = 400 }) {
  if (!/BEGIN:VCALENDAR/i.test(icsText)) throw new Error("not an iCalendar feed");
  let root;
  try {
    root = new ICAL.Component(ICAL.parse(icsText));
  } catch {
    throw new Error("not an iCalendar feed");
  }

  for (const tz of root.getAllSubcomponents("vtimezone")) {
    const zone = new ICAL.Timezone(tz);
    if (!ICAL.TimezoneService.has(zone.tzid)) ICAL.TimezoneService.register(zone);
  }

  const vevents = root.getAllSubcomponents("vevent");
  if (vevents.length === 0) throw new Error("feed has no events");

  // Group by UID: the master (no RECURRENCE-ID) owns the series, the rest are
  // per-instance overrides handed to it.
  const groups = new Map();
  for (const comp of vevents) {
    const uid = comp.getFirstPropertyValue("uid");
    if (!groups.has(uid)) groups.set(uid, { master: null, overrides: [] });
    const g = groups.get(uid);
    if (comp.hasProperty("recurrence-id")) g.overrides.push(comp);
    else g.master = comp;
  }

  const horizon = addDays(from, horizonDays);
  const out = [];
  const keep = (occ) => {
    if (occ && occ.lastDay >= from && occ.start <= horizon) out.push(occ);
  };

  for (const [uid, { master, overrides }] of groups) {
    if (!master) continue;
    const event = new ICAL.Event(master);
    if (!event.isRecurring()) {
      keep(toOccurrence(uid, event, event.startDate, event.endDate));
      continue;
    }
    for (const o of overrides) event.relateException(o);
    const it = event.iterator();
    for (let t = it.next(); t; t = it.next()) {
      // Occurrences arrive in order of the original schedule; a moved override
      // can land elsewhere, but the master start bounds the walk well enough.
      if (pacificDay(t) > horizon) break;
      const d = event.getOccurrenceDetails(t);
      keep(toOccurrence(uid, d.item, d.startDate, d.endDate));
    }
  }
  return out;
}
