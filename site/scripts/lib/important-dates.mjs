// Pure rules for turning calendar occurrences into Important Dates entries.
// No I/O here, so every rule the home-page widget depends on (which events
// count, how they are named and linked, when a change is worth a Slack post)
// is unit-tested in important-dates.test.mjs.

const PACIFIC_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Los_Angeles",
  year: "numeric", month: "2-digit", day: "2-digit",
}); // en-CA formats as YYYY-MM-DD

export function pacificToday(now = new Date()) {
  return PACIFIC_DATE.format(now);
}

// "#website" not followed by a word character, so "#websites" is out.
// A hyphen is not a word character, so "#website-team" is rejected separately.
const TAG = /#website(?![\w-])/i;

export function hasTag(description) {
  return TAG.test(description ?? "");
}

const NAMED_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

// &amp; is decoded in the same pass as the rest, so "&amp;lt;" stays "&lt;".
function decodeEntities(s) {
  return s.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi, (m, dec, hex, name) => {
    if (name) return NAMED_ENTITIES[name.toLowerCase()] ?? m;
    return String.fromCodePoint(Number(dec ?? parseInt(hex, 16)));
  });
}

// An href value, or a bare URL run. The alternation consumes an href's URL, so
// one URL is never counted twice and candidates come out in document order.
const LINK_CANDIDATE = /href\s*=\s*(?:"([^"]*)"|'([^']*)')|(https?:\/\/[^\s<>"']+)/gi;
const TRAILING_PUNCTUATION = /[.,;:!?)\]]+$/;

function normalizeLink(raw) {
  // Keep the text as written: URL.href would add a slash to a bare origin.
  let text = decodeEntities(raw).trim().replace(TRAILING_PUNCTUATION, "");
  let url;
  try { url = new URL(text); } catch { return undefined; }
  // Google wraps outbound links in a redirector; the target is in q.
  if (url.hostname === "www.google.com" && url.pathname === "/url" && url.searchParams.has("q")) {
    text = url.searchParams.get("q");
    try { url = new URL(text); } catch { return undefined; }
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
  if (url.hostname === "www.ayso13.org" || url.hostname === "ayso13.org") {
    return url.pathname + url.search + url.hash;
  }
  return text;
}

// Only the first candidate counts. If it is not a usable link we return
// nothing rather than fall through to a later one, so a javascript: href
// cannot be quietly replaced by something further down.
export function firstLink(description) {
  const m = new RegExp(LINK_CANDIDATE.source, "i").exec(description ?? "");
  if (!m) return undefined;
  return normalizeLink(m[1] ?? m[2] ?? m[3]);
}

function plainText(s) {
  return decodeEntities(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

const byDateThenName = (a, b) =>
  a.date.localeCompare(b.date) || a.name.localeCompare(b.name);

export function toEntries(occurrences, today) {
  const earliest = new Map();
  for (const o of occurrences) {
    if (!hasTag(o.description) || o.lastDay < today) continue;
    const prior = earliest.get(o.uid);
    if (!prior || o.start < prior.start) earliest.set(o.uid, o);
  }
  return [...earliest.values()].map((o) => {
    const entry = { date: o.start };
    if (o.lastDay !== o.start) entry.endDate = o.lastDay;
    entry.name = plainText(o.summary ?? "");
    const link = firstLink(o.description);
    if (link) entry.link = link;
    return entry;
  }).sort(byDateThenName);
}

const tupleKey = (e) => JSON.stringify([e.date, e.endDate ?? null, e.name, e.link ?? null]);

// notify is true when the calendar changed. Two kinds of change are routine and
// stay quiet: an entry that ended before today, and a recurring entry that
// rolled forward to its next occurrence.
export function diffEntries(prev, next, today) {
  const prevKeys = new Set(prev.map(tupleKey));
  const nextKeys = new Set(next.map(tupleKey));
  const added = next.filter((e) => !prevKeys.has(tupleKey(e)));
  const removed = prev.filter((e) => !nextKeys.has(tupleKey(e)));

  const explained = removed.filter((e) => (e.endDate ?? e.date) < today);
  const unexplainedRemovals = removed.length - explained.length;
  const rollable = [...explained];
  const unmatchedAdds = added.filter((a) => {
    const i = rollable.findIndex((r) => r.name === a.name && r.date < a.date);
    if (i === -1) return true;
    rollable.splice(i, 1);
    return false;
  });
  return { added, removed, notify: unexplainedRemovals > 0 || unmatchedAdds.length > 0 };
}

export function serialize(enabled, entries) {
  const dates = entries.map((e) => {
    const out = { date: e.date };
    if (e.endDate !== undefined) out.endDate = e.endDate;
    out.name = e.name;
    if (e.link !== undefined) out.link = e.link;
    return out;
  });
  return JSON.stringify({ enabled, dates }, null, 2) + "\n";
}
