# Newsletter Archive Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A daily GitHub Action snapshots Region 13's Soccer News newsletters from the EmailOctopus API into the repo, and the Eleventy site renders one page per newsletter plus a generated archive list at `/resources/newsletters/`.

**Architecture:** `site/scripts/sync-newsletters.mjs` (Node 22, no dependencies) fetches campaigns, filters to the Soccer News list inside the retention window, cleans the email HTML, and writes `site/newsletters/index.json` + one `<slug>.html` per newsletter. A CommonJS global data file splits each email into styles/body at build time; a paginated template renders each one as a standalone page (not `base.njk`, so email CSS can't collide with Tailwind). A scheduled workflow on `staging` commits changes to `staging` and `main`; `rebuild-production.yml` rebuilds www on the `main` push.

**Tech Stack:** Eleventy 3 (Nunjucks, CommonJS config), Node 22 (`fetch`, `node:test`), GitHub Actions, EmailOctopus API v2.

**Spec:** `docs/superpowers/specs/2026-09-24-newsletter-archive-sync-design.md`

## Global Constraints

- Soccer News list ID: `5ee4e68d-7557-11eb-a3d0-06b4694bee2a`. No other list is archived.
- Retention: current and previous calendar year in `America/Los_Angeles`, never earlier than `2026-01-01`.
- All dates (slug, grouping, display, cutoff) are Pacific dates, not UTC.
- No new npm dependencies. Node 22 built-ins only.
- The API key is read from `EMAILOCTOPUS_API_KEY`. Never log it, never write it to disk.
- Any `{{…}}` or `{%…%}` left in cleaned HTML fails the sync; nothing is written.
- Newsletter pages: permalink `/resources/newsletters/<slug>/`, in the sitemap, excluded from `llms-full.txt`, indexed by Pagefind.
- Copy rules (CLAUDE.md): no exclamation points, em dashes sparingly, plain language for parents.
- Contrast: every new text/background pair meets WCAG AA (4.5:1 small text).
- Commit to `staging` only. Do not push. Do not promote.
- Deviation from spec, deliberate: the sync fetches **every** page of `/campaigns` rather than stopping at the cutoff. The API's sort key isn't documented (a draft appears mid-list in real data), the account has about 2 pages, and an early stop could silently drop a newsletter. Task 2 updates the spec line.

## Review Focus

1. A subject that is only emoji, or empty → title falls back to `Newsletter`, slug is still non-empty and unique. (Task 1)
2. `™`, `©`, `®` in a subject (e.g. `EXTRA™`) are kept; they are `Extended_Pictographic` in Unicode and a naive emoji strip deletes them. (Task 1)
3. A send late in the Pacific evening (e.g. `2026-01-01T05:30:00+00:00` is Dec 31 PT) is dated and filtered by its Pacific date. (Task 1)
4. An API failure (401, 429, 500, bad JSON) leaves the snapshot directory untouched. (Task 2)
5. Email body markup inside downlevel-revealed conditional comments (`<!--[if !mso]><!--> … <!--<![endif]-->`) survives the style/body split; only `<head>` conditionals are stripped. (Task 4)

---

### Task 1: Newsletter library (pure functions)

**Files:**
- Create: `site/scripts/lib/newsletters.mjs`
- Create: `site/scripts/lib/fixtures/newsletter-sample.html`
- Test: `site/scripts/lib/newsletters.test.mjs`
- Modify: `site/package.json` (add `test` script)

**Interfaces:**
- Produces (all named exports of `site/scripts/lib/newsletters.mjs`):
  - `SOCCER_NEWS_LIST_ID: string`
  - `RETENTION_FLOOR: "2026-01-01"`
  - `pacificDate(iso: string) → "YYYY-MM-DD"`
  - `retentionCutoff(now?: Date) → "YYYY-MM-DD"`
  - `isArchived(campaign, cutoff: string) → boolean`
  - `cleanTitle(subject: string) → string` (never empty; falls back to `"Newsletter"`)
  - `slugify(title: string) → string` (never empty; falls back to `"newsletter"`)
  - `assignSlugs(entries: {id, title, sentAt, date}[]) → same entries + slug, newest first`
  - `cleanHtml(html: string) → string` (throws `Error` on a leftover merge tag or an unbalanced footer)

- [ ] **Step 1: Create the fixture**

`site/scripts/lib/fixtures/newsletter-sample.html` reproduces the real EmailOctopus structure (head with an mso conditional style, preheader, body content, footer with merge tags):

```html
<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<title></title>
<!--[if mso]>
<style>
* { font-family: sans-serif !important; }
</style>
<![endif]-->
<style>
body { -webkit-font-smoothing: antialiased; }
</style>
<style id="v3-editor-styles">
.text-block { word-wrap: break-word; }
</style>
<!--[if (gte mso 9)|(IE)]><!--><link href="https://fonts.googleapis.com/css2?family=Raleway&amp;display=swap" rel="stylesheet"><!--<![endif]--></head>
<body bgcolor="#e8e9eb" style="color: rgb(0, 0, 0); font-family: Arial, &quot;Helvetica Neue&quot;, Helvetica, sans-serif; font-size: 16px; background-color: #e8e9eb;" eo-background="" class="">
<!-- Preheader text. Visible in inbox preview, not in email body. -->
<div style="display: none; max-height: 0px; overflow: hidden;">
{{PreviewText}}
</div>
<!-- Hack to manage presentation of preheader text. -->
<div style="display: none; max-height: 0px; overflow: hidden;">{% if PreviewText %}&nbsp;&nbsp;{% endif %}</div>
<table role="presentation" class="document" align="center">
<tbody>
<tr>
<td valign="top">
<table role="presentation" width="100%">
<tbody>
<tr><td><div class="text-block"><p>WEEK 2 SAMPLE CONTENT</p></div></td></tr>
<!--[if !mso]><!--><tr><td><p>VISIBLE OUTSIDE OUTLOOK</p></td></tr><!--<![endif]-->
<!-- Footer -->
<tr style="background: none;">
<td class="container" eo-footer="">
<table role="presentation" width="100%"><tbody><tr><td>
<div class="text-block fr-inner"><div>You received this email because you subscribed to our list. You can <a href="{{UnsubscribeURL}}">unsubscribe</a> at any time.&nbsp;<br><br>{{SenderInfo}}</div></div>
</td></tr></tbody></table>
<table role="presentation" width="100%"><tbody><tr><td align="center">
<a href="{{RewardsURL}}" style="display: block;"><img src="https://eogallery1.com/badge.png" alt="Powered by EmailOctopus" width="150"></a>
</td></tr></tbody></table>
</td>
</tr>
</tbody>
</table>
</td>
</tr>
</tbody>
</table>
</body></html>
```

- [ ] **Step 2: Add the test script to `site/package.json`**

In `"scripts"`, after `"check-links"`, add:

```json
"test": "node --test \"scripts/**/*.test.mjs\""
```

(Remember the comma on the preceding line.)

- [ ] **Step 3: Write the failing tests**

`site/scripts/lib/newsletters.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  SOCCER_NEWS_LIST_ID, pacificDate, retentionCutoff, isArchived,
  cleanTitle, slugify, assignSlugs, cleanHtml,
} from "./newsletters.mjs";

const SAMPLE = fs.readFileSync(new URL("./fixtures/newsletter-sample.html", import.meta.url), "utf8");

test("pacificDate uses the Pacific calendar day, not UTC", () => {
  assert.equal(pacificDate("2026-01-01T05:30:00+00:00"), "2025-12-31");
  assert.equal(pacificDate("2026-09-16T19:00:00+00:00"), "2026-09-16");
});

test("retentionCutoff: floor holds through 2027, then rolls", () => {
  assert.equal(retentionCutoff(new Date("2026-09-24T12:00:00Z")), "2026-01-01");
  assert.equal(retentionCutoff(new Date("2027-06-01T12:00:00Z")), "2026-01-01");
  assert.equal(retentionCutoff(new Date("2028-01-02T12:00:00Z")), "2027-01-01");
  // 2028-01-01 04:00 UTC is still Dec 31 2027 in Pacific time
  assert.equal(retentionCutoff(new Date("2028-01-01T04:00:00Z")), "2026-01-01");
});

test("isArchived keeps only sent Soccer News campaigns inside the window", () => {
  const base = { status: "sent", to: [SOCCER_NEWS_LIST_ID], sent_at: "2026-09-16T19:00:00+00:00" };
  assert.equal(isArchived(base, "2026-01-01"), true);
  assert.equal(isArchived({ ...base, status: "draft", sent_at: null }, "2026-01-01"), false);
  assert.equal(isArchived({ ...base, to: ["0e8a6c1c-da9f-11ef-a626-c9b982b31e9a"] }, "2026-01-01"), false);
  assert.equal(isArchived({ ...base, sent_at: "2025-12-13T19:00:00+00:00" }, "2026-01-01"), false);
  assert.equal(isArchived({ ...base, sent_at: "2026-01-01T05:30:00+00:00" }, "2026-01-01"), false);
  assert.equal(isArchived({ ...base, to: undefined }, "2026-01-01"), false);
});

test("cleanTitle strips emoji and flags but keeps trademark symbols", () => {
  assert.equal(cleanTitle("⚽ Week 2 News & Info"), "Week 2 News & Info");
  assert.equal(cleanTitle("⚽ 🇺🇸 I BELIEVE THAT WE WILL WIN!"), "I BELIEVE THAT WE WILL WIN!");
  assert.equal(cleanTitle("🌧️⚽ Week 11 Rain Update"), "Week 11 Rain Update");
  assert.equal(cleanTitle("Sunday EXTRA™ Skills ©2026 ®"), "Sunday EXTRA™ Skills ©2026 ®");
  assert.equal(cleanTitle("  ⚽  "), "Newsletter");
  assert.equal(cleanTitle(undefined), "Newsletter");
});

test("slugify is lowercase ascii, never empty, capped at 60 chars", () => {
  assert.equal(slugify("Week 2 News & Info"), "week-2-news-info");
  assert.equal(slugify("It's the Rose City Rollout!"), "its-the-rose-city-rollout");
  assert.equal(slugify("Café Día"), "cafe-dia");
  assert.equal(slugify("Newsletter"), "newsletter");
  assert.equal(slugify("!!!"), "newsletter");
  const long = slugify("a".repeat(40) + " " + "b".repeat(40));
  assert.ok(long.length <= 60 && !long.endsWith("-"));
});

test("assignSlugs dates by Pacific day, dedupes in send order, returns newest first", () => {
  const out = assignSlugs([
    { id: "c", title: "Week 3", sentAt: "2026-09-24T19:00:00+00:00", date: "2026-09-24" },
    { id: "a", title: "Same", sentAt: "2026-09-16T18:00:00+00:00", date: "2026-09-16" },
    { id: "b", title: "Same", sentAt: "2026-09-16T20:00:00+00:00", date: "2026-09-16" },
  ]);
  assert.deepEqual(out.map((e) => [e.id, e.slug]), [
    ["c", "2026-09-24-week-3"],
    ["b", "2026-09-16-same-2"],
    ["a", "2026-09-16-same"],
  ]);
});

test("cleanHtml removes preheader, footer and badge, keeps content", () => {
  const out = cleanHtml(SAMPLE);
  assert.ok(out.includes("WEEK 2 SAMPLE CONTENT"));
  assert.ok(out.includes("VISIBLE OUTSIDE OUTLOOK"));
  assert.ok(!out.includes("You received this email"));
  assert.ok(!out.includes("Powered by EmailOctopus"));
  assert.ok(!/\{\{|\{%/.test(out));
  assert.ok(out.trimEnd().endsWith("</body></html>"));
  // table structure stays balanced
  const opens = (out.match(/<tr\b/g) || []).length;
  const closes = (out.match(/<\/tr>/g) || []).length;
  assert.equal(opens, closes);
});

test("cleanHtml throws on an unfilled personalization tag", () => {
  const html = SAMPLE.replace("WEEK 2 SAMPLE CONTENT", "Hi {{FirstName}}");
  assert.throws(() => cleanHtml(html), /\{\{FirstName\}\}/);
});

test("cleanHtml throws when the footer marker is missing", () => {
  const html = SAMPLE.replace("<!-- Footer -->", "");
  assert.throws(() => cleanHtml(html), /UnsubscribeURL/);
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd site && npm test`
Expected: FAIL, `Cannot find module …/newsletters.mjs`.

- [ ] **Step 5: Implement `site/scripts/lib/newsletters.mjs`**

```js
// Pure helpers for the newsletter archive sync. No I/O here, so every rule the
// archive depends on (which campaigns count, how they are named, what gets
// stripped) is unit-tested in newsletters.test.mjs.

export const SOCCER_NEWS_LIST_ID = "5ee4e68d-7557-11eb-a3d0-06b4694bee2a";
// Nothing earlier than this is ever archived: the old 2023-2025 hand-pasted
// links were retired when the sync went in, per the original request.
export const RETENTION_FLOOR = "2026-01-01";

const PACIFIC_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Los_Angeles",
  year: "numeric", month: "2-digit", day: "2-digit",
}); // en-CA formats as YYYY-MM-DD

export function pacificDate(iso) {
  return PACIFIC_DATE.format(new Date(iso));
}

// Current + previous Pacific calendar year, never before the floor.
export function retentionCutoff(now = new Date()) {
  const year = Number(PACIFIC_DATE.format(now).slice(0, 4));
  const rolling = `${year - 1}-01-01`;
  return rolling > RETENTION_FLOOR ? rolling : RETENTION_FLOOR;
}

export function isArchived(campaign, cutoff) {
  return campaign.status === "sent"
    && Array.isArray(campaign.to)
    && campaign.to.includes(SOCCER_NEWS_LIST_ID)
    && typeof campaign.sent_at === "string"
    && pacificDate(campaign.sent_at) >= cutoff;
}

// ™ © ® are Extended_Pictographic in Unicode, but they are text here
// ("EXTRA™"), so they are exempt from the emoji strip.
const EMOJI = /(?![©®™])\p{Extended_Pictographic}|\p{Regional_Indicator}|[\u{FE0F}\u{200D}\u{20E3}]/gu;

export function cleanTitle(subject) {
  const title = String(subject ?? "").replace(EMOJI, "").replace(/\s+/g, " ").trim();
  return title || "Newsletter";
}

export function slugify(title) {
  const slug = title
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  return slug || "newsletter";
}

// Suffixes collide-free in send order (oldest keeps the bare slug, so an
// existing URL never changes when a same-day resend appears), newest first out.
export function assignSlugs(entries) {
  const seen = new Map();
  const withSlugs = [...entries]
    .sort((a, b) => a.sentAt.localeCompare(b.sentAt))
    .map((e) => {
      const base = `${e.date}-${slugify(e.title)}`;
      const n = (seen.get(base) || 0) + 1;
      seen.set(base, n);
      return { ...e, slug: n === 1 ? base : `${base}-${n}` };
    });
  return withSlugs.reverse();
}

const PREHEADER = /<!-- Preheader text[\s\S]*?<!-- Hack to manage presentation of preheader text\. -->\s*<div[^>]*>[\s\S]*?<\/div>/;
const FOOTER_MARKER = "<!-- Footer -->";
const LEFTOVER_TAG = /\{\{[\s\S]*?\}\}|\{%[\s\S]*?%\}/;

// Index just past the element that opens at `start`, counting nested tags.
function elementEnd(html, start, tag) {
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, "gi");
  re.lastIndex = start;
  let depth = 0;
  let m;
  while ((m = re.exec(html))) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return re.lastIndex;
  }
  throw new Error(`unbalanced <${tag}> after "${FOOTER_MARKER}"`);
}

// Strips the per-recipient parts of an EmailOctopus email (preheader,
// unsubscribe footer, rewards badge). Fails rather than publishing a literal
// merge tag: a tag that survives here would render as "{{FirstName}}" on www.
export function cleanHtml(html) {
  let out = html.replace(PREHEADER, "");
  const marker = out.indexOf(FOOTER_MARKER);
  if (marker !== -1) {
    const trStart = out.indexOf("<tr", marker);
    if (trStart === -1) throw new Error(`no <tr> after "${FOOTER_MARKER}"`);
    out = out.slice(0, marker) + out.slice(elementEnd(out, trStart, "tr"));
  }
  const leftover = out.match(LEFTOVER_TAG);
  if (leftover) throw new Error(`unfilled merge tag ${leftover[0]}`);
  return out;
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd site && npm test`
Expected: all 9 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add site/scripts/lib/ site/package.json
git commit -m "Newsletter sync: pure helpers for filtering, naming and cleaning"
```

---

### Task 2: Sync CLI and the first snapshot

**Files:**
- Create: `site/scripts/sync-newsletters.mjs`
- Test: `site/scripts/sync-newsletters.test.mjs`
- Create (generated): `site/newsletters/index.json`, `site/newsletters/*.html`
- Modify: `docs/superpowers/specs/2026-09-24-newsletter-archive-sync-design.md` (the "stopping once `sent_at` falls before the retention cutoff" bullet)

**Interfaces:**
- Consumes: everything exported by `site/scripts/lib/newsletters.mjs` (Task 1).
- Produces:
  - `fetchCampaigns({ apiKey, fetchImpl? }) → Promise<campaign[]>`
  - `buildEntries(campaigns, cutoff) → {id, slug, title, sentAt, date, html}[]` newest first
  - `writeSnapshot(dir, entries) → Promise<{ added: string[], removed: string[] }>` (titles)
  - On disk: `site/newsletters/index.json` is a JSON array, newest first, of `{ "id", "slug", "title", "sentAt", "date" }` (`sentAt` = API ISO string, `date` = Pacific `YYYY-MM-DD`), 2-space indent, trailing newline. Each entry has `site/newsletters/<slug>.html`.
  - CLI: `node scripts/sync-newsletters.mjs` (from `site/`). Exit 0 on success, 1 on any error. If `NEWSLETTER_SYNC_SUMMARY` is set, writes `{"added":[…],"removed":[…]}` to that path.

- [ ] **Step 1: Write the failing tests**

`site/scripts/sync-newsletters.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fetchCampaigns, buildEntries, writeSnapshot } from "./sync-newsletters.mjs";
import { SOCCER_NEWS_LIST_ID } from "./lib/newsletters.mjs";

const SAMPLE = await fs.readFile(new URL("./lib/fixtures/newsletter-sample.html", import.meta.url), "utf8");

function jsonResponse(body, status = 200) {
  return { ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) };
}

test("fetchCampaigns follows the starting_after cursor and sends the bearer key", async () => {
  const calls = [];
  const pages = [
    { data: [{ id: "1" }], paging: { next: { starting_after: "CUR/1" } } },
    { data: [{ id: "2" }], paging: { next: null } },
  ];
  const fetchImpl = async (url, opts) => { calls.push([url, opts.headers.Authorization]); return jsonResponse(pages[calls.length - 1]); };
  const out = await fetchCampaigns({ apiKey: "k", fetchImpl });
  assert.deepEqual(out.map((c) => c.id), ["1", "2"]);
  assert.equal(calls[0][0], "https://api.emailoctopus.com/campaigns?limit=100");
  assert.equal(calls[1][0], "https://api.emailoctopus.com/campaigns?limit=100&starting_after=CUR%2F1");
  assert.equal(calls[0][1], "Bearer k");
});

test("fetchCampaigns throws on an HTTP error without leaking the key", async () => {
  const fetchImpl = async () => jsonResponse({ title: "unauthorized" }, 401);
  await assert.rejects(fetchCampaigns({ apiKey: "secret-key", fetchImpl }), (err) => {
    assert.match(err.message, /401/);
    assert.ok(!err.message.includes("secret-key"));
    return true;
  });
});

test("buildEntries filters, cleans and names", () => {
  const campaigns = [
    { id: "a", status: "sent", to: [SOCCER_NEWS_LIST_ID], sent_at: "2026-09-16T19:00:00+00:00", subject: "⚽ Week 2 News & Info", content: { html: SAMPLE } },
    { id: "b", status: "sent", to: ["other-list"], sent_at: "2026-09-16T19:00:00+00:00", subject: "Roster", content: { html: SAMPLE } },
  ];
  const out = buildEntries(campaigns, "2026-01-01");
  assert.equal(out.length, 1);
  assert.equal(out[0].slug, "2026-09-16-week-2-news-info");
  assert.equal(out[0].title, "Week 2 News & Info");
  assert.ok(!out[0].html.includes("{{"));
});

test("buildEntries names the campaign when cleaning fails", () => {
  const bad = SAMPLE.replace("WEEK 2 SAMPLE CONTENT", "{{FirstName}}");
  const campaigns = [{ id: "a", status: "sent", to: [SOCCER_NEWS_LIST_ID], sent_at: "2026-09-16T19:00:00+00:00", subject: "Week 2", content: { html: bad } }];
  assert.throws(() => buildEntries(campaigns, "2026-01-01"), /Week 2.*FirstName/);
});

test("writeSnapshot writes index + html, removes stale files, reports the diff", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "nl-"));
  await fs.writeFile(path.join(dir, "index.json"), JSON.stringify([{ id: "old", slug: "2026-02-07-old", title: "Old one" }]));
  await fs.writeFile(path.join(dir, "2026-02-07-old.html"), "x");
  const summary = await writeSnapshot(dir, [
    { id: "new", slug: "2026-09-16-new", title: "New one", sentAt: "2026-09-16T19:00:00+00:00", date: "2026-09-16", html: "<html></html>" },
  ]);
  assert.deepEqual(summary, { added: ["New one"], removed: ["Old one"] });
  assert.deepEqual((await fs.readdir(dir)).sort(), ["2026-09-16-new.html", "index.json"]);
  const index = await fs.readFile(path.join(dir, "index.json"), "utf8");
  assert.ok(index.endsWith("\n"));
  assert.deepEqual(JSON.parse(index), [{ id: "new", slug: "2026-09-16-new", title: "New one", sentAt: "2026-09-16T19:00:00+00:00", date: "2026-09-16" }]);
});

test("writeSnapshot works on a missing directory", async () => {
  const dir = path.join(await fs.mkdtemp(path.join(os.tmpdir(), "nl-")), "newsletters");
  const summary = await writeSnapshot(dir, []);
  assert.deepEqual(summary, { added: [], removed: [] });
  assert.equal(await fs.readFile(path.join(dir, "index.json"), "utf8"), "[]\n");
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd site && npm test`
Expected: FAIL, `Cannot find module …/sync-newsletters.mjs`.

- [ ] **Step 3: Implement `site/scripts/sync-newsletters.mjs`**

```js
#!/usr/bin/env node
// Snapshots Region 13's Soccer News newsletters from EmailOctopus into
// site/newsletters/ (index.json + one cleaned <slug>.html each). Run daily by
// .github/workflows/sync-newsletters.yml; safe to run locally with
// EMAILOCTOPUS_API_KEY set. The whole set is rewritten every run, so a
// newsletter that ages out of the retention window is deleted here.
//
// Why snapshot instead of linking out: the API does not return the signed
// eomail web-version URL, so the site hosts the emails itself. Spec:
// docs/superpowers/specs/2026-09-24-newsletter-archive-sync-design.md
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  retentionCutoff, isArchived, cleanTitle, pacificDate, assignSlugs, cleanHtml,
} from "./lib/newsletters.mjs";

const API = "https://api.emailoctopus.com";
const MAX_PAGES = 50; // guard against a cursor loop; the account has ~2 pages
const DEFAULT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../newsletters");

// Every page, not "stop at the cutoff": the sort order isn't documented and a
// draft sits mid-list in real data, so an early stop could drop a newsletter.
export async function fetchCampaigns({ apiKey, fetchImpl = fetch }) {
  const campaigns = [];
  let cursor = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = `${API}/campaigns?limit=100${cursor ? `&starting_after=${encodeURIComponent(cursor)}` : ""}`;
    const res = await fetchImpl(url, { headers: { Authorization: `Bearer ${apiKey}` } });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      throw new Error(`EmailOctopus GET /campaigns returned ${res.status}: ${detail}`);
    }
    const body = await res.json();
    campaigns.push(...(body.data ?? []));
    cursor = body.paging?.next?.starting_after ?? null;
    if (!cursor) return campaigns;
  }
  throw new Error(`EmailOctopus pagination exceeded ${MAX_PAGES} pages`);
}

export function buildEntries(campaigns, cutoff) {
  const entries = campaigns.filter((c) => isArchived(c, cutoff)).map((c) => {
    const title = cleanTitle(c.subject);
    let html;
    try {
      html = cleanHtml(c.content?.html ?? "");
    } catch (err) {
      throw new Error(`newsletter "${title}" (${c.id}, sent ${c.sent_at}): ${err.message}`);
    }
    return { id: c.id, title, sentAt: c.sent_at, date: pacificDate(c.sent_at), html };
  });
  return assignSlugs(entries);
}

async function readIndex(dir) {
  try {
    return JSON.parse(await fs.readFile(path.join(dir, "index.json"), "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

export async function writeSnapshot(dir, entries) {
  const previous = await readIndex(dir);
  await fs.mkdir(dir, { recursive: true });

  const keep = new Set(entries.map((e) => `${e.slug}.html`));
  for (const name of await fs.readdir(dir)) {
    if (name.endsWith(".html") && !keep.has(name)) await fs.rm(path.join(dir, name));
  }
  for (const e of entries) await fs.writeFile(path.join(dir, `${e.slug}.html`), e.html);

  const index = entries.map(({ id, slug, title, sentAt, date }) => ({ id, slug, title, sentAt, date }));
  await fs.writeFile(path.join(dir, "index.json"), JSON.stringify(index, null, 2) + "\n");

  const oldIds = new Set(previous.map((e) => e.id));
  const newIds = new Set(index.map((e) => e.id));
  return {
    added: index.filter((e) => !oldIds.has(e.id)).map((e) => e.title),
    removed: previous.filter((e) => !newIds.has(e.id)).map((e) => e.title),
  };
}

async function main() {
  const apiKey = process.env.EMAILOCTOPUS_API_KEY;
  if (!apiKey) throw new Error("EMAILOCTOPUS_API_KEY is not set");
  const cutoff = retentionCutoff();
  // Fetch and clean everything before touching disk, so any failure leaves
  // the last good snapshot exactly as it was.
  const entries = buildEntries(await fetchCampaigns({ apiKey }), cutoff);
  const summary = await writeSnapshot(process.env.NEWSLETTER_DIR || DEFAULT_DIR, entries);
  console.log(`newsletters: ${entries.length} in window (since ${cutoff}); +${summary.added.length} -${summary.removed.length}`);
  if (process.env.NEWSLETTER_SYNC_SUMMARY) {
    await fs.writeFile(process.env.NEWSLETTER_SYNC_SUMMARY, JSON.stringify(summary));
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(`newsletter sync failed: ${err.message}`);
    process.exit(1);
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd site && npm test`
Expected: all Task 1 + Task 2 tests PASS.

- [ ] **Step 5: Run the real sync**

Run: `cd /Users/matthew/dev/ayso-website && source .envrc >/dev/null 2>&1; cd site && node scripts/sync-newsletters.mjs`
Expected: `newsletters: 14 in window (since 2026-01-01); +14 -0` (or more, if something was sent since 2026-09-24). Then:

Run: `ls site/newsletters/ && head -20 site/newsletters/index.json && grep -l '{{\|{%\|You received this email' site/newsletters/*.html`
Expected: 14+ `.html` files plus `index.json`; the grep prints nothing (exit 1).

Run the sync a second time. Expected: `+0 -0` and `git status --short site/newsletters` shows no further change beyond the first run.

- [ ] **Step 6: Update the spec's fetch bullet**

In `docs/superpowers/specs/2026-09-24-newsletter-archive-sync-design.md`, replace
`- Pages through \`GET /campaigns\`, stopping once \`sent_at\` falls before the retention cutoff.`
with
`- Pages through all of \`GET /campaigns\` (about 2 pages). It doesn't stop early at the cutoff: the sort order isn't documented and a draft sits mid-list in real data.`

- [ ] **Step 7: Commit**

```bash
git add site/scripts/sync-newsletters.mjs site/scripts/sync-newsletters.test.mjs site/newsletters docs/superpowers/specs/2026-09-24-newsletter-archive-sync-design.md
git commit -m "Newsletter sync: CLI and first 2026 snapshot"
```

---

### Task 3: Shared GA4 include

The newsletter layout needs the GA4 snippet, which already exists as two hand-kept copies (`base.njk`, `temp.njk`). Pull it into one include before adding a third user. Behavior must not change.

**Files:**
- Create: `site/src/_includes/ga4.njk`
- Modify: `site/src/_includes/base.njk:57-68` (the `{% if site.gaId %}` block)
- Modify: `site/src/temp.njk:32-51` (the `{% if site.gaId %}` block)

**Interfaces:**
- Produces: `{% include "ga4.njk" %}`. Optional context variable `gaPinnedPath` (string, e.g. `"/temp"`): when set, `page_location` is pinned to `origin + gaPinnedPath`.

- [ ] **Step 1: Capture the current output**

Run: `cd site && npm run build >/dev/null && mkdir -p /tmp/ga-before && cp _site/temp.html /tmp/ga-before/temp.html && cp _site/index.html /tmp/ga-before/home.html && cp _site/resources/newsletters/index.html /tmp/ga-before/newsletters.html`

- [ ] **Step 2: Create `site/src/_includes/ga4.njk`**

```njk
{#- GA4 gtag snippet, shared by every template that owns its own <head>
    (base.njk, temp.njk, newsletter.njk). Set `gaPinnedPath` before including
    to pin page_location, for pages whose permalink differs from the public
    URL (temp.njk: /temp.html is served as /temp). -#}
{% if site.gaId %}
<!-- Google Analytics — data-cfasync="false" opts out of Cloudflare Rocket Loader,
     which was rewriting type="text/javascript" and breaking pageview reporting. -->
<script async data-cfasync="false" src="https://www.googletagmanager.com/gtag/js?id={{ site.gaId }}"></script>
<script data-cfasync="false">
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
{%- if gaPinnedPath %}
  // Pinned page_location: without it GA4 reports the permalink and the public
  // URL as separate rows. origin (not a hardcoded site.url) so staging still
  // reports as staging.
  gtag('config', '{{ site.gaId }}', {
    page_location: window.location.origin + '{{ gaPinnedPath }}'
  });
{%- else %}
  gtag('config', '{{ site.gaId }}');
{%- endif %}
</script>
{% endif %}
```

- [ ] **Step 3: Use it in `base.njk`**

Replace the whole block from `{% if site.gaId %}` through its `{% endif %}` (currently lines 57-68, just above `{% include "posthog.njk" %}`) with:

```njk
  {% include "ga4.njk" %}
```

- [ ] **Step 4: Use it in `temp.njk`**

Replace the block from `{% if site.gaId %}` through its `{% endif %}` (currently lines 32-51) with:

```njk
{# /temp.html is served as /temp; pin both analytics tools to the public URL. #}
{% set gaPinnedPath = "/temp" %}
{% include "ga4.njk" %}
```

Then delete the now-redundant comment line `{# Same /temp URL pin the gtag block above applies, for the same reason. #}` above `{% set posthogPinnedPath = "/temp" %}`.

- [ ] **Step 5: Verify the rendered scripts are unchanged**

Run:
```bash
cd site && npm run build >/dev/null
for pair in temp.html:temp.html index.html:home.html resources/newsletters/index.html:newsletters.html; do
  f=${pair%%:*}; b=${pair##*:}
  diff <(grep -A12 'googletagmanager' /tmp/ga-before/$b | grep -E "gtag\(|page_location|googletagmanager") \
       <(grep -A12 'googletagmanager' _site/$f | grep -E "gtag\(|page_location|googletagmanager") && echo "$f same"
done
```
Expected: each file reports `same`; `_site/temp.html` still contains `page_location: window.location.origin + '/temp'`.

- [ ] **Step 6: Commit**

```bash
git add site/src/_includes/ga4.njk site/src/_includes/base.njk site/src/temp.njk
git commit -m "Pull the GA4 snippet into one include shared by base and temp"
```

---

### Task 4: Newsletter pages

**Files:**
- Create: `site/src/_data/newsletters.js`
- Test: `site/scripts/newsletters-data.test.mjs` (NOT under `src/_data/`: Eleventy 3 loads `.mjs` files there as global data)
- Create: `site/src/_includes/newsletter.njk`
- Create: `site/src/newsletter-pages.njk`
- Modify: `site/src/sitemap.njk:9`

**Interfaces:**
- Consumes: `site/newsletters/index.json` + `<slug>.html` (Task 2), `ga4.njk` (Task 3), `posthog.njk` (existing).
- Produces: global data `newsletters`, an array newest first of
  `{ id, slug, title, sentAt, date, year: "2026", shortDate: "Sep 16", displayDate: "September 16, 2026", styles: string, bodyStyle: string, body: string }`.
  `splitEmail(html) → { styles, bodyStyle, body }` is attached as `module.exports.splitEmail`.

- [ ] **Step 1: Write the failing tests**

`site/scripts/newsletters-data.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const loadNewsletters = require("../src/_data/newsletters.js");
const { splitEmail } = loadNewsletters;

const SAMPLE = fs.readFileSync(new URL("./lib/fixtures/newsletter-sample.html", import.meta.url), "utf8");

test("splitEmail keeps head styles but drops Outlook-only conditional styles", () => {
  const { styles } = splitEmail(SAMPLE);
  assert.match(styles, /-webkit-font-smoothing/);
  assert.match(styles, /v3-editor-styles/);
  assert.doesNotMatch(styles, /sans-serif !important/);
});

test("splitEmail keeps body conditional-comment content visible to browsers", () => {
  const { body } = splitEmail(SAMPLE);
  assert.match(body, /WEEK 2 SAMPLE CONTENT/);
  assert.match(body, /VISIBLE OUTSIDE OUTLOOK/);
  assert.doesNotMatch(body, /<\/?body/);
});

test("splitEmail returns the body style attribute as-is (already entity-escaped)", () => {
  assert.match(splitEmail(SAMPLE).bodyStyle, /&quot;Helvetica Neue&quot;/);
});

test("splitEmail throws on a document with no body", () => {
  assert.throws(() => splitEmail("<html><head></head></html>"), /no <body>/);
});

test("loader returns the committed snapshot with display dates", () => {
  const list = loadNewsletters();
  assert.ok(Array.isArray(list));
  if (list.length) {
    const n = list[0];
    assert.match(n.year, /^\d{4}$/);
    assert.match(n.displayDate, /^[A-Z][a-z]+ \d{1,2}, \d{4}$/);
    assert.ok(n.body.length > 0);
  }
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd site && npm test`
Expected: FAIL, `Cannot find module '../src/_data/newsletters.js'`.

- [ ] **Step 3: Implement `site/src/_data/newsletters.js`**

```js
// Global data: the newsletter snapshot written by scripts/sync-newsletters.mjs.
// Each email is split into its <style> blocks and <body> so
// _includes/newsletter.njk can host it in a page of our own. Pagination in
// newsletter-pages.njk turns each entry into /resources/newsletters/<slug>/.
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "../../newsletters");
const TZ = "America/Los_Angeles";
const SHORT = new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short", day: "numeric" });
const LONG = new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "long", day: "numeric", year: "numeric" });

// Outlook conditional comments are stripped from <head> only: there they hold
// mso-only CSS (e.g. `* { font-family: sans-serif !important }`) that would
// apply in every browser once lifted out of the comment. In <body> they are
// left alone, because downlevel-revealed blocks there are real content.
function splitEmail(html) {
  const head = (html.match(/<head[^>]*>([\s\S]*?)<\/head>/i) || [, ""])[1]
    .replace(/<!--\[if[\s\S]*?<!\[endif\]-->/g, "");
  const styles = (head.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || []).join("\n");
  const body = html.match(/<body([^>]*)>([\s\S]*)<\/body>/i);
  if (!body) throw new Error("newsletter HTML has no <body>");
  const bodyStyle = (body[1].match(/\sstyle="([^"]*)"/i) || [, ""])[1];
  return { styles, bodyStyle, body: body[2] };
}

function loadNewsletters() {
  let index;
  try {
    index = JSON.parse(fs.readFileSync(path.join(DIR, "index.json"), "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
  return index.map((entry) => {
    const sent = new Date(entry.sentAt);
    return {
      ...entry,
      year: entry.date.slice(0, 4),
      shortDate: SHORT.format(sent),
      displayDate: LONG.format(sent),
      ...splitEmail(fs.readFileSync(path.join(DIR, `${entry.slug}.html`), "utf8")),
    };
  });
}

module.exports = loadNewsletters;
module.exports.splitEmail = splitEmail;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd site && npm test`
Expected: all tests PASS.

- [ ] **Step 5: Create the layout `site/src/_includes/newsletter.njk`**

Standalone document. It deliberately does not load `/assets/css/style.css`: Tailwind's preflight resets tables and images and would break the email's layout. The bar is styled inline; white on `#8e2929` (brand-maroon) is 8.3:1.

```njk
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  {%- set nlTitle = newsletter.title + " · Region 13 Newsletter" %}
  {%- set nlDescription = "Region 13 Soccer News newsletter sent " + newsletter.displayDate + ": " + newsletter.title + "." %}
  <title>{{ nlTitle }} | {{ site.title }}</title>
  <meta name="description" content="{{ nlDescription }}">
  <meta name="theme-color" content="#ffffff">
  <link rel="canonical" href="{{ site.url }}{{ page.url }}">

  <meta property="og:site_name" content="{{ site.title }}">
  <meta property="og:title" content="{{ nlTitle }}">
  <meta property="og:description" content="{{ nlDescription }}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="{{ site.url }}{{ page.url }}">
  <meta property="og:locale" content="en_US">
  <meta property="og:image" content="{{ site.url }}{{ og.sectionDefaults.resources or og.fallback }}">
  <meta property="og:image:alt" content="AYSO Region 13">
  <meta property="article:published_time" content="{{ newsletter.sentAt }}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{{ nlTitle }}">
  <meta name="twitter:description" content="{{ nlDescription }}">
  <meta name="twitter:image" content="{{ site.url }}{{ og.sectionDefaults.resources or og.fallback }}">

  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="icon" href="/images/logo.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" sizes="180x180" href="/images/apple-touch-icon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Raleway:wght@400;700&display=swap">

  {% include "ga4.njk" %}
  {% include "posthog.njk" %}

  {# The email's own CSS, lifted from its <head> by _data/newsletters.js #}
  {{ newsletter.styles | safe }}
  <style>
    .nl-bar { background: #8e2929; color: #fff; font-family: Raleway, Arial, sans-serif; font-size: 15px; line-height: 1.4; }
    .nl-bar__inner { max-width: 640px; margin: 0 auto; padding: 10px 16px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; }
    .nl-bar a { color: #fff !important; text-decoration: underline; font-weight: 700; }
    .nl-bar__home { display: flex; align-items: center; gap: 8px; text-decoration: none !important; }
    .nl-bar__home img { width: 32px; height: 32px; display: block; background: #fff; border-radius: 50%; }
    .nl-bar__date { flex: 1 1 auto; }
  </style>
</head>
<body style="margin: 0; {{ newsletter.bodyStyle | safe }}">
  <header class="nl-bar">
    <div class="nl-bar__inner">
      <a class="nl-bar__home" href="/"><img src="/images/logo.svg" alt="" width="32" height="32">AYSO Region 13</a>
      <span class="nl-bar__date">Newsletter sent {{ newsletter.displayDate }}</span>
      <a href="/resources/newsletters/">All newsletters</a>
    </div>
  </header>
  <main data-pagefind-body data-pagefind-meta="title:{{ newsletter.title }}">
    {{ newsletter.body | safe }}
  </main>
</body>
</html>
```

- [ ] **Step 6: Create the paginated template `site/src/newsletter-pages.njk`**

It sits at the root of `src/` with no `section`, which keeps these pages out of the `llmsContent` collection (it requires a known `section`).

```njk
---
pagination:
  data: newsletters
  size: 1
  alias: newsletter
permalink: "/resources/newsletters/{{ newsletter.slug }}/"
layout: newsletter.njk
---
```

- [ ] **Step 7: Sitemap `<lastmod>` from the send date**

In `site/src/sitemap.njk`, replace line 9:

```njk
  {%- set lastmod = page.inputPath | lastModDate %}
```

with:

```njk
  {#- Paginated newsletters share one template, so its git date would stamp
      them all alike; use each one's send date instead. #}
  {%- set lastmod = page.data.newsletter.sentAt if page.data.newsletter else (page.inputPath | lastModDate) %}
```

- [ ] **Step 8: Build and inspect**

Run: `cd site && npm run build 2>&1 | tail -5`
Expected: build succeeds; Pagefind reports more pages indexed than before.

Run:
```bash
cd site
ls _site/resources/newsletters/
SLUG=$(node -e 'console.log(require("./newsletters/index.json")[0].slug)')
F=_site/resources/newsletters/$SLUG/index.html
grep -c 'googletagmanager' $F                     # 1
grep -o '<title>[^<]*' $F
grep -c 'data-pagefind-body' $F                    # 1
grep -c '{{\|{%\|You received this email' $F       # 0
grep -c 'sans-serif !important' $F                 # 0
grep "resources/newsletters/$SLUG/" -A1 _site/sitemap.xml
grep -c 'resources/newsletters/2026' _site/llms-full.txt   # 0
```
Expected: one directory per newsletter; counts as commented; the sitemap entry's `<lastmod>` equals that newsletter's `date` in `index.json`.

- [ ] **Step 9: Look at it**

Run `npx @11ty/eleventy --serve` from `site/` (or open `_site` via `npx http-server _site`) and view `/resources/newsletters/<slug>/` at desktop and 375px widths. Check: the maroon bar sits above the email, the email renders as it does in EmailOctopus's web version (centered, grey background, images load), no horizontal scroll at 375px, the unsubscribe footer and badge are gone.

- [ ] **Step 10: Commit**

```bash
git add site/src/_data/newsletters.js site/scripts/newsletters-data.test.mjs site/src/_includes/newsletter.njk site/src/newsletter-pages.njk site/src/sitemap.njk
git commit -m "Render each archived newsletter as its own page"
```

---

### Task 5: Generated archive list on /resources/newsletters/

**Files:**
- Create: `site/src/_includes/newsletter-archive.njk`
- Modify: `site/src/_includes/page.njk:162-167` (content swap)
- Modify: `site/src/llms-full.njk:25,36`
- Modify: `site/src/resources/newsletters.md` (replace the `<div class="newsletter-archive">…</div>` block, lines 24-143)

**Interfaces:**
- Consumes: global `newsletters` (Task 4): `slug`, `title`, `year`, `shortDate`.
- Produces: `[NEWSLETTER ARCHIVE]` on its own line in any `page.njk` markdown renders the list.

- [ ] **Step 1: Create `site/src/_includes/newsletter-archive.njk`**

Newest first, a heading per year. The year test compares with the previous item instead of tracking state, because a `{% set %}` inside a Nunjucks `for` doesn't carry across iterations.

```njk
{%- if newsletters.length %}
<div class="newsletter-archive">
{%- for n in newsletters %}
  {%- if loop.first or n.year != newsletters[loop.index0 - 1].year %}
  {%- if not loop.first %}</ul>{% endif %}
  <h3>{{ n.year }}</h3>
  <ul>
  {%- endif %}
    <li><a href="/resources/newsletters/{{ n.slug }}/">{{ n.title }}</a> <span class="text-gray-600">({{ n.shortDate }})</span></li>
  {%- if loop.last %}</ul>{% endif %}
{%- endfor %}
</div>
{%- else %}
<p>New newsletters will be listed here after they are sent.</p>
{%- endif %}
```

- [ ] **Step 2: Chain the swap in `page.njk`**

Replace lines 162-167:

```njk
        {% if "<p>[SPONSOR TIERS]</p>" in content %}
          {% set sponsorTiersHtml %}{% include "sponsor-tiers.njk" %}{% endset %}
          {{ content | replace("<p>[SPONSOR TIERS]</p>", sponsorTiersHtml) | safe }}
        {% else %}
          {{ content | safe }}
        {% endif %}
```

with:

```njk
        {#- Placeholder paragraphs editors can place in CMS markdown; each is
            swapped for a generated block. #}
        {% set body = content %}
        {% if "<p>[SPONSOR TIERS]</p>" in body %}
          {% set sponsorTiersHtml %}{% include "sponsor-tiers.njk" %}{% endset %}
          {% set body = body | replace("<p>[SPONSOR TIERS]</p>", sponsorTiersHtml) %}
        {% endif %}
        {% if "<p>[NEWSLETTER ARCHIVE]</p>" in body %}
          {% set newsletterArchiveHtml %}{% include "newsletter-archive.njk" %}{% endset %}
          {% set body = body | replace("<p>[NEWSLETTER ARCHIVE]</p>", newsletterArchiveHtml) %}
        {% endif %}
        {{ body | safe }}
```

- [ ] **Step 3: Same swap in `llms-full.njk`**

After line 25 (`{% set sponsorTiersHtml %}…{% endset %}`) add:

```njk
{% set newsletterArchiveHtml %}{% include "newsletter-archive.njk" %}{% endset %}
```

and change line 36 to:

```njk
{{ item.templateContent | replace("<p>[SPONSOR TIERS]</p>", sponsorTiersHtml) | replace("<p>[NEWSLETTER ARCHIVE]</p>", newsletterArchiveHtml) | plaintext | safe }}
```

- [ ] **Step 4: Replace the hand-pasted archive in `newsletters.md`**

Run:
```bash
cd site && python3 - <<'EOF'
import re, pathlib
p = pathlib.Path("src/resources/newsletters.md")
s = p.read_text()
new, n = re.subn(r'<div class="newsletter-archive">.*?\n</div>\n', "[NEWSLETTER ARCHIVE]\n", s, flags=re.S)
assert n == 1, n
p.write_text(new)
EOF
grep -c 'eomail\|eocampaign' src/resources/newsletters.md   # 0
sed -n '/## Newsletter Archive/,/## Contact/p' src/resources/newsletters.md
```
Expected: the section reads `## Newsletter Archive`, a blank line, `[NEWSLETTER ARCHIVE]`, a blank line, `## Contact`.

- [ ] **Step 5: Build and inspect**

Run:
```bash
cd site && npm run build >/dev/null
F=_site/resources/newsletters/index.html
grep -c 'NEWSLETTER ARCHIVE' $F                    # 0
grep -o '<h3[^>]*>20[0-9][0-9]</h3>' $F            # <h3 ...>2026</h3>
grep -c 'href="/resources/newsletters/2026-' $F    # equals the index.json length
grep -c 'eomail' $F                                # 0
grep -c 'NEWSLETTER ARCHIVE' _site/llms-full.txt   # 0
node scripts/check-links.js 2>&1 | tail -3
```
Expected: as commented; the link checker reports no broken internal links. Open `/resources/newsletters/` in the dev server and check the list reads well next to the Subscribe section.

Also confirm the sponsors page didn't regress: `grep -c 'SPONSOR TIERS' _site/volunteers/sponsors/index.html` → `0`.

- [ ] **Step 6: Commit**

```bash
git add site/src/_includes/newsletter-archive.njk site/src/_includes/page.njk site/src/llms-full.njk site/src/resources/newsletters.md
git commit -m "Generate the newsletter archive list and retire the old eomail links"
```

---

### Task 6: Daily sync workflow

**Files:**
- Create: `.github/workflows/sync-newsletters.yml`
- Modify: `.github/workflows/rebuild-production.yml` (the `push.paths` list, currently lines 60-62)

**Interfaces:**
- Consumes: `node scripts/sync-newsletters.mjs` with `EMAILOCTOPUS_API_KEY` and `NEWSLETTER_SYNC_SUMMARY` (Task 2).
- Secrets: `EMAILOCTOPUS_API_KEY` (new, added by Matthew), `PROMOTE_TOKEN`, `SLACK_BOT_TOKEN` (existing). Slack channel `C0A024YGR9C` (`#notify-website-status`, same as `rebuild-production.yml`).

- [ ] **Step 1: Create `.github/workflows/sync-newsletters.yml`**

```yaml
name: Sync Newsletter Archive

# Daily snapshot of the Soccer News newsletters from EmailOctopus into
# site/newsletters/ (scripts/sync-newsletters.mjs). When anything changed it
# commits to BOTH staging and main, like Slack field status: the main push
# fires rebuild-production.yml (narrow paths filter), so a new newsletter
# reaches www without a promote and without dragging other staging work along.
#
# ⚠️ `schedule` only fires from the DEFAULT branch, which is `staging`. This
# file must stay on staging.
#
# ⚠️ Pushes use PROMOTE_TOKEN (a PAT), not GITHUB_TOKEN: a push made with
# GITHUB_TOKEN starts no workflows, so neither the staging deploy nor the prod
# rebuild would run. The PAT also bypasses the `main` ruleset.
#
# Spec: docs/superpowers/specs/2026-09-24-newsletter-archive-sync-design.md

on:
  schedule:
    - cron: '0 13 * * *' # 6am PDT / 5am PST
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: sync-newsletters
  cancel-in-progress: false

jobs:
  sync:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v6
        with:
          ref: staging
          token: ${{ secrets.PROMOTE_TOKEN }}
          path: staging

      - uses: actions/setup-node@v6
        with:
          node-version: '22'

      - name: Sync from EmailOctopus
        id: sync
        working-directory: staging/site
        env:
          EMAILOCTOPUS_API_KEY: ${{ secrets.EMAILOCTOPUS_API_KEY }}
          NEWSLETTER_SYNC_SUMMARY: ${{ runner.temp }}/newsletter-sync.json
        run: |
          node scripts/sync-newsletters.mjs
          if [ -z "$(git status --porcelain -- newsletters)" ]; then
            echo "changed=false" >> "$GITHUB_OUTPUT"
            echo "No newsletter changes."
          else
            echo "changed=true" >> "$GITHUB_OUTPUT"
          fi

      - name: Commit message
        id: msg
        if: steps.sync.outputs.changed == 'true'
        env:
          SUMMARY: ${{ runner.temp }}/newsletter-sync.json
        run: |
          A=$(jq '.added | length' "$SUMMARY"); R=$(jq '.removed | length' "$SUMMARY")
          echo "subject=Newsletters: sync from EmailOctopus ($A added, $R removed)" >> "$GITHUB_OUTPUT"

      - name: Commit and push to staging
        if: steps.sync.outputs.changed == 'true'
        working-directory: staging
        env:
          SUBJECT: ${{ steps.msg.outputs.subject }}
        run: |
          git config user.name "ayso13-newsletter-sync"
          git config user.email "webmaster@ayso13.org"
          git add site/newsletters
          git commit -m "$SUBJECT"
          # A CMS edit can land between checkout and push; rebase once.
          git push origin HEAD:staging || { git pull --rebase origin staging && git push origin HEAD:staging; }

      - uses: actions/checkout@v6
        if: steps.sync.outputs.changed == 'true'
        with:
          ref: main
          token: ${{ secrets.PROMOTE_TOKEN }}
          path: main

      # Copy the exact snapshot rather than re-running the sync, so staging and
      # main can never disagree because a newsletter went out in between calls.
      - name: Commit and push to main
        if: steps.sync.outputs.changed == 'true'
        working-directory: main
        env:
          SUBJECT: ${{ steps.msg.outputs.subject }}
        run: |
          mkdir -p site/newsletters
          rsync -a --delete ../staging/site/newsletters/ site/newsletters/
          git config user.name "ayso13-newsletter-sync"
          git config user.email "webmaster@ayso13.org"
          git add -A site/newsletters
          if git diff --cached --quiet; then echo "main already current"; exit 0; fi
          git commit -m "$SUBJECT"
          git push origin HEAD:main || { git pull --rebase origin main && git push origin HEAD:main; }

      # Subjects are sender-controlled text: they reach Slack only via a file →
      # jq, never interpolated into the shell. Slack answers 200 with ok:false on
      # a bad token, so `.ok` is checked (annotate, don't fail the job).
      - name: Notify Slack — published
        if: success() && steps.sync.outputs.changed == 'true'
        env:
          SLACK_BOT_TOKEN: ${{ secrets.SLACK_BOT_TOKEN }}
          SUMMARY: ${{ runner.temp }}/newsletter-sync.json
          RUN_URL: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
        run: |
          RESP=$(curl -sS -X POST https://slack.com/api/chat.postMessage \
            -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
            -H "Content-Type: application/json; charset=utf-8" \
            --data "$(jq -c --arg run "$RUN_URL" '
              def lines(xs): xs | map("• " + (.[0:150] | gsub("[\r\n]"; " "))) | join("\n");
              {
                channel: "C0A024YGR9C",
                text: "Newsletter archive updated",
                blocks: ([
                  { type: "section", text: { type: "mrkdwn", text: ":newspaper: *Newsletter archive updated.* Committed to staging and main; www rebuilds in ~3 min. <https://www.ayso13.org/resources/newsletters/|View the archive>" } }
                ]
                + (if (.added | length) > 0 then [{ type: "section", text: { type: "mrkdwn", text: ("*Added*\n" + lines(.added)) } }] else [] end)
                + (if (.removed | length) > 0 then [{ type: "section", text: { type: "mrkdwn", text: ("*Removed (older than the retention window)*\n" + lines(.removed)) } }] else [] end)
                + [{ type: "context", elements: [ { type: "mrkdwn", text: "<\($run)|View workflow run>" } ] }])
              }' "$SUMMARY")")
          printf '%s' "$RESP" | jq -e '.ok' >/dev/null \
            || echo "::error::Slack post failed: $(printf '%s' "$RESP" | jq -r '.error // "unparseable response"')"

      - name: Notify Slack — failure
        if: failure()
        env:
          SLACK_BOT_TOKEN: ${{ secrets.SLACK_BOT_TOKEN }}
          RUN_URL: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
        run: |
          RESP=$(curl -sS -X POST https://slack.com/api/chat.postMessage \
            -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
            -H "Content-Type: application/json; charset=utf-8" \
            --data "$(jq -nc --arg run "$RUN_URL" '{
              channel: "C0A024YGR9C",
              text: "Newsletter sync failed",
              blocks: [
                { type: "section", text: { type: "mrkdwn", text: ":x: *Newsletter sync failed.* The archive on www is unchanged. Common causes: an expired EmailOctopus API key (401), or a newsletter with an unfilled merge tag such as {{FirstName}} (the log names it)." } },
                { type: "context", elements: [ { type: "mrkdwn", text: "<\($run)|View workflow run>" } ] }
              ]
            }')")
          printf '%s' "$RESP" | jq -e '.ok' >/dev/null \
            || echo "::error::Slack post failed: $(printf '%s' "$RESP" | jq -r '.error // "unparseable response"')"
```

- [ ] **Step 2: Widen the production rebuild trigger**

In `.github/workflows/rebuild-production.yml`, add one line to `on.push.paths`:

```yaml
    paths:
      - 'site/src/_data/fieldstatus.json'
      - 'site/src/_data/announcements.json'
      - 'site/newsletters/**'
```

and add one sentence to the comment block directly above `push:`: `The newsletter sync (sync-newsletters.yml) writes site/newsletters/ to main the same way.`

- [ ] **Step 3: Validate**

Run:
```bash
cd /Users/matthew/dev/ayso-website
python3 -c "import yaml,sys; [yaml.safe_load(open(f)) for f in sys.argv[1:]]; print('yaml ok')" .github/workflows/sync-newsletters.yml .github/workflows/rebuild-production.yml
(command -v actionlint && actionlint .github/workflows/sync-newsletters.yml .github/workflows/rebuild-production.yml) || npx --yes actionlint-cli .github/workflows/sync-newsletters.yml .github/workflows/rebuild-production.yml || echo "actionlint unavailable: say so in the report"
```
Expected: `yaml ok`; actionlint clean (or its absence reported).

Test the Slack jq program offline:
```bash
echo '{"added":["Week 3 is Silent Saturday"],"removed":[]}' > /tmp/s.json
jq -c --arg run "https://example/run" '<paste the jq program from the "published" step>' /tmp/s.json | jq .
```
Expected: valid JSON with an `Added` section and no `Removed` section.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/sync-newsletters.yml .github/workflows/rebuild-production.yml
git commit -m "Daily newsletter sync workflow; rebuild prod when the snapshot lands on main"
```

---

### Task 7: Docs

**Files:**
- Modify: `CLAUDE.md` (Headline state + Site-wide Data Files + Files sections, footer date line)
- Modify: `claude-history.md` (new session entry at the top)

Invoke the `write-like-a-human` skill before writing prose. Match the existing density; state current behavior plus the gotchas, not the story.

- [ ] **Step 1: CLAUDE.md**

Add a Headline-state bullet **Newsletter archive** covering: daily `sync-newsletters.yml` (06:00 PT) snapshots Soccer News (`5ee4e68d-…`) into `site/newsletters/`; commits to staging + main via `PROMOTE_TOKEN`; `rebuild-production.yml` fires on `site/newsletters/**`; retention = current + previous Pacific year, floor 2026-01-01; why we self-host (API has no signed web-version URL, `s=` required, tested 2026-09-24); a leftover `{{…}}`/`{%…%}` fails the sync on purpose; newsletter pages use their own layout without Tailwind (preflight would break email tables); `[NEWSLETTER ARCHIVE]` placeholder; `ga4.njk` is now the single GA snippet (update the GA4 paragraph that says the snippet lives in two places); secret `EMAILOCTOPUS_API_KEY` in GitHub + `.envrc`; `site/newsletters/` is generated, never hand-edit. Add `site/newsletters/` and `scripts/sync-newsletters.mjs` to the relevant lists. Update the `*Last updated:*` line.

- [ ] **Step 2: claude-history.md**

New top entry dated 2026-09-24: what shipped, the findings (signed URL, Soccer News list, merge tags), the decisions (both-branch publish, retention floor), and the rollout steps still pending.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md claude-history.md
git commit -m "Document the newsletter archive sync"
```

---

## Rollout (Matthew, after the branch is reviewed; not part of any task)

1. Add the GitHub secret: `gh secret set EMAILOCTOPUS_API_KEY` (paste the key from `.envrc`).
2. Push `staging`; check https://staging.ayso13.org/resources/newsletters/ and one newsletter page.
3. `/ayso promote`, so `main` has the templates and the widened `rebuild-production.yml` filter.
4. `gh workflow run "Sync Newsletter Archive" --ref staging`; expect "No newsletter changes" (snapshot already committed) and a green run.
5. After the next newsletter goes out, confirm the Slack "Newsletter archive updated" post and the new page on www.
