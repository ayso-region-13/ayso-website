#!/usr/bin/env node
/**
 * check-external-links.js
 * Finds all external URLs in _site/ and checks each with an HTTP HEAD request.
 * Deduplicates URLs so each is only checked once.
 */

const fs    = require("fs");
const path  = require("path");
const https = require("https");
const http  = require("http");

const SITE    = path.join(__dirname, "../_site");
const TIMEOUT = 10000; // 10 seconds per request
const CONCURRENCY = 5; // simultaneous requests

// ── Walk HTML files ───────────────────────────────────────────────────────
function walk(dir) {
  let files = [];
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) files = files.concat(walk(full));
    else if (f.endsWith(".html")) files.push(full);
  }
  return files;
}

function extractExternalLinks(html) {
  const links = new Set();
  const re = /href="(https?:\/\/[^"#\s]+)"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    // Skip common false-positives we control
    if (m[1].startsWith("https://new.ayso13.org")) continue;
    if (m[1].startsWith("https://ayso13.org")) continue;
    links.add(m[1]);
  }
  return links;
}

// Collect all unique external URLs and which page(s) reference them
const urlMap = {}; // url -> [page, ...]

for (const file of walk(SITE)) {
  const html    = fs.readFileSync(file, "utf8");
  const pageUrl = "/" + path.relative(SITE, file).replace(/\\/g, "/").replace("index.html", "");
  for (const url of extractExternalLinks(html)) {
    if (!urlMap[url]) urlMap[url] = [];
    if (!urlMap[url].includes(pageUrl)) urlMap[url].push(pageUrl);
  }
}

const urls = Object.keys(urlMap).sort();
console.log(`Checking ${urls.length} unique external URLs...\n`);

// ── HTTP check ────────────────────────────────────────────────────────────
function checkUrl(url) {
  return new Promise((resolve) => {
    const lib     = url.startsWith("https") ? https : http;
    const timeout = setTimeout(() => {
      resolve({ url, status: "TIMEOUT", ok: false });
    }, TIMEOUT);

    const req = lib.request(url, { method: "HEAD", timeout: TIMEOUT,
      headers: { "User-Agent": "Mozilla/5.0 (link-checker)" } },
      (res) => {
        clearTimeout(timeout);
        const status = res.statusCode;
        // Follow single redirect
        if ((status === 301 || status === 302 || status === 307 || status === 308) && res.headers.location) {
          resolve({ url, status, redirect: res.headers.location, ok: true });
        } else {
          resolve({ url, status, ok: status >= 200 && status < 400 });
        }
      }
    );

    req.on("error", (e) => {
      clearTimeout(timeout);
      resolve({ url, status: `ERROR: ${e.message}`, ok: false });
    });

    req.on("timeout", () => {
      clearTimeout(timeout);
      req.destroy();
      resolve({ url, status: "TIMEOUT", ok: false });
    });

    req.end();
  });
}

// Run with limited concurrency
async function checkAll() {
  const results = [];
  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const batch = urls.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map(checkUrl));
    results.push(...batchResults);
    process.stdout.write(`  ${Math.min(i + CONCURRENCY, urls.length)}/${urls.length} checked\r`);
  }
  process.stdout.write("\n");
  return results;
}

checkAll().then((results) => {
  const broken = results.filter((r) => !r.ok);
  const ok     = results.filter((r) => r.ok);

  console.log(`\n✓  ${ok.length} OK`);

  if (broken.length === 0) {
    console.log("✓  No broken external links found.");
    return;
  }

  console.log(`✗  ${broken.length} broken:\n`);
  for (const r of broken) {
    console.log(`  [${r.status}]  ${r.url}`);
    for (const p of (urlMap[r.url] || []).slice(0, 2))
      console.log(`    ↳ ${p}`);
  }
  process.exit(1);
});
