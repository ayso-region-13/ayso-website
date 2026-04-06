#!/usr/bin/env node
// check-links.js — finds broken internal links in the built _site/ directory

const fs   = require("fs");
const path = require("path");

const SITE = path.join(__dirname, "../_site");

function walk(dir) {
  let files = [];
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) files = files.concat(walk(full));
    else if (f.endsWith(".html")) files.push(full);
  }
  return files;
}

function extractLinks(html) {
  const links = [];
  const re = /(?:href|src)="([^"]+)"/g;
  let m;
  while ((m = re.exec(html)) !== null) links.push(m[1]);
  return links;
}

function resolves(linkPath) {
  const clean = linkPath.split("?")[0].split("#")[0];
  if (!clean || clean === "/") return fs.existsSync(path.join(SITE, "index.html"));
  const abs = path.join(SITE, clean);
  return (
    fs.existsSync(abs) ||
    fs.existsSync(abs + ".html") ||
    fs.existsSync(path.join(abs, "index.html"))
  );
}

// Map: broken link -> list of pages where it appears
const brokenMap = {};

for (const file of walk(SITE)) {
  const html  = fs.readFileSync(file, "utf8");
  const rel   = path.relative(SITE, file).replace(/\\/g, "/");
  const pageUrl = "/" + rel.replace("index.html", "");

  for (const link of extractLinks(html)) {
    if (!link.startsWith("/") || link.startsWith("//")) continue;
    if (!resolves(link)) {
      if (!brokenMap[link]) brokenMap[link] = [];
      if (!brokenMap[link].includes(pageUrl)) brokenMap[link].push(pageUrl);
    }
  }
}

const broken = Object.entries(brokenMap).sort((a, b) => a[0].localeCompare(b[0]));

if (broken.length === 0) {
  console.log("✓  No broken internal links found.");
  process.exit(0);
}

console.log(`✗  ${broken.length} broken internal links:\n`);
for (const [link, pages] of broken) {
  console.log(`  ${link}`);
  for (const p of pages.slice(0, 3)) console.log(`    ↳ ${p}`);
  if (pages.length > 3) console.log(`    ↳ …and ${pages.length - 3} more pages`);
}
process.exit(1);
