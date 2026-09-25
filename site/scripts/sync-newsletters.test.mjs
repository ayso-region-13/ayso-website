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
