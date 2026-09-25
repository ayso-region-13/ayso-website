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
