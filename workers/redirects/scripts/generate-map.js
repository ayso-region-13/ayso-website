#!/usr/bin/env node
// Parse site/src/_redirects and emit src/map.js for the Worker.
//
// Why: Cloudflare Pages silently caps _redirects at ~224 active rules
// per project. We have 570+ rules. The Worker lookup has no cap, so we
// generate a JS map from the same source-of-truth file and ship it in
// the Worker bundle. Editors can keep editing _redirects via CMS or by
// hand; this script keeps the Worker in sync.
//
// Usage:
//   node scripts/generate-map.js
//   (or: npm run build)

const fs = require("fs");
const path = require("path");

const REDIRECTS_FILE = path.join(__dirname, "../../../site/src/_redirects");
const OUTPUT_FILE   = path.join(__dirname, "../src/map.js");

const src = fs.readFileSync(REDIRECTS_FILE, "utf8");
const lines = src.split("\n");

const exact = {};   // { "/path": { d: "/dest", s: 301 } }
const splat = [];   // [{ re: "^/.../...$", d: "/dest", s: 301 }]

let skipped = 0;
let lineNum = 0;

for (const rawLine of lines) {
  lineNum++;
  const line = rawLine.trim();
  if (!line || line.startsWith("#")) continue;

  // Split on whitespace (the file uses variable spacing between fields).
  const parts = line.split(/\s+/);
  if (parts.length < 2) {
    skipped++;
    console.warn(`Line ${lineNum}: skipped (malformed): ${line}`);
    continue;
  }

  const source = parts[0];
  const destination = parts[1];
  const status = parts.length >= 3 ? parseInt(parts[2], 10) || 301 : 301;

  if (source.includes("*")) {
    // Splat pattern (e.g. /author/*  /about/  301).
    // Convert glob to JS regex source string. Splat is captured for
    // potential ${splat} interpolation in destination (preserves CF
    // _redirects semantics).
    const re = "^" + source.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "(.*)") + "$";
    splat.push({ re, d: destination, s: status });
  } else {
    if (exact[source]) {
      console.warn(`Line ${lineNum}: duplicate exact rule for ${source} (keeping first)`);
      continue;
    }
    exact[source] = { d: destination, s: status };
  }
}

const exactCount = Object.keys(exact).length;
const totalCount = exactCount + splat.length;

const banner = `// AUTO-GENERATED from site/src/_redirects.
// Do NOT edit by hand -- run \`npm run build\` in workers/redirects/.
// Last generated: ${new Date().toISOString()}
// ${exactCount} exact rules + ${splat.length} splat rules = ${totalCount} total

`;

const body =
  "export const EXACT = " + JSON.stringify(exact, null, 2) + ";\n\n" +
  "export const SPLAT = " + JSON.stringify(splat, null, 2) + ";\n";

fs.writeFileSync(OUTPUT_FILE, banner + body);

console.log(`✓ Wrote ${OUTPUT_FILE}`);
console.log(`  ${exactCount} exact rules + ${splat.length} splat rules = ${totalCount} total`);
if (skipped) console.log(`  ${skipped} malformed lines skipped`);
