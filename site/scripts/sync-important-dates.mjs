#!/usr/bin/env node
// Syncs the home-page Important Dates widget from Region 13's public Google
// Calendar. Events whose description carries #website become entries in
// site/src/_data/importantDates.json. Run hourly by
// .github/workflows/sync-important-dates.yml; safe to run locally, but point
// IMPORTANT_DATES_PATH at a scratch file unless you mean to rewrite the data.
//
// The `enabled` switch is a hand edit to the data file (the CMS editor was
// retired), so it is read back from the existing file and never changed here. Spec:
// docs/superpowers/specs/2026-10-23-calendar-important-dates-design.md
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseFeed } from "./lib/calendar-feed.mjs";
import { pacificToday, toEntries, diffEntries, serialize } from "./lib/important-dates.mjs";

const FEED_URL = "https://calendar.google.com/calendar/ical/g60lvbvlhbucts84e1ft40mlpk%40group.calendar.google.com/public/basic.ics";
// The calendar's id, for event links: the feed URL's encoded path segment.
const CALENDAR_ID = decodeURIComponent(new URL(FEED_URL).pathname.split("/")[3]);
const DEFAULT_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/_data/importantDates.json");

export async function fetchFeed({ url, fetchImpl = fetch }) {
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`calendar feed returned ${res.status}`);
  return res.text();
}

// A missing or unparseable file is treated as a first run: widget on, no
// previous entries.
function readExisting(existingJson) {
  try {
    const parsed = JSON.parse(existingJson);
    return {
      enabled: parsed.enabled !== false,
      dates: Array.isArray(parsed.dates) ? parsed.dates : [],
    };
  } catch {
    return { enabled: true, dates: [] };
  }
}

export function syncImportantDates({ icsText, existingJson, now = new Date() }) {
  const today = pacificToday(now);
  const { enabled, dates: previous } = readExisting(existingJson);
  const entries = toEntries(parseFeed(icsText, { from: today }), today, { calendarId: CALENDAR_ID });
  const output = serialize(enabled, entries);
  return { output, changed: output !== existingJson, summary: diffEntries(previous, entries, today) };
}

async function readIfPresent(file) {
  try {
    return await fs.readFile(file, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") return undefined;
    throw err;
  }
}

async function main() {
  const file = process.env.IMPORTANT_DATES_PATH || DEFAULT_PATH;
  const url = process.env.IMPORTANT_DATES_FEED_URL || FEED_URL;
  // Fetch and parse before touching disk, so any failure leaves the data
  // file exactly as it was.
  const icsText = await fetchFeed({ url });
  const { output, changed, summary } = syncImportantDates({
    icsText, existingJson: await readIfPresent(file),
  });
  if (changed) await fs.writeFile(file, output);
  console.log(`important dates: ${changed ? "updated" : "unchanged"}; +${summary.added.length} -${summary.removed.length}`);
  if (process.env.IMPORTANT_DATES_SYNC_SUMMARY) {
    await fs.writeFile(process.env.IMPORTANT_DATES_SYNC_SUMMARY, JSON.stringify(summary));
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(`important dates sync failed: ${err.message}`);
    process.exit(1);
  });
}
