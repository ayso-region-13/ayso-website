#!/usr/bin/env node
/**
 * generate-file-dates.js
 *
 * Reads `git log` once to get the last-commit date for every file under src/.
 * Writes the result to src/_data/fileDates.json so Eleventy can use it.
 *
 * Falls back gracefully if git is unavailable (local dev, no repo yet).
 */

const { execSync } = require("child_process");
const fs   = require("fs");
const path = require("path");

const ROOT     = path.join(__dirname, "..");
const OUT_PATH = path.join(ROOT, "src/_data/fileDates.json");

function generateFromGit() {
  // One git log call for the whole src/ tree.
  // Output format:
  //   COMMIT 2026-04-05T10:23:00-07:00
  //   <blank>
  //   src/programs/fall-soccer.md
  //   src/about/index.md
  //   <blank>
  //   COMMIT 2026-03-10T08:00:00-07:00
  //   ...
  const raw = execSync(
    'git log --format="COMMIT %cI" --name-only -- src/',
    { encoding: "utf8", cwd: ROOT }
  ).trim();

  const fileDates = {};
  let currentDate = null;

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("COMMIT ")) {
      currentDate = trimmed.slice(7);
    } else if (trimmed && currentDate) {
      // git emits paths from the repo root (e.g. "site/src/foo.md"); strip the
      // "site/" prefix so keys match `path.relative(site, file)` output that
      // .eleventy.js uses to look up dates.
      const key = trimmed.startsWith("site/") ? trimmed.slice(5) : trimmed;
      // Skip files that no longer exist on disk (renamed/deleted but still in
      // git history — e.g. resources/newsletter.md → resources/newsletters.md).
      const abs = path.join(ROOT, key);
      if (!fs.existsSync(abs)) continue;
      // Record only the first (most-recent) commit date per file
      if (!fileDates[key]) {
        fileDates[key] = currentDate;
      }
    }
  }

  return fileDates;
}

function generateFromMtime() {
  // Walk src/ and record mtime for every .md file
  const fileDates = {};
  function walk(dir) {
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry);
      const rel  = path.relative(ROOT, full).replace(/\\/g, "/");
      if (fs.statSync(full).isDirectory()) {
        walk(full);
      } else if (entry.endsWith(".md")) {
        fileDates[rel] = fs.statSync(full).mtime.toISOString();
      }
    }
  }
  walk(path.join(ROOT, "src"));
  return fileDates;
}

let fileDates;
let source;

try {
  fileDates = generateFromGit();
  source    = "git log";
} catch (_) {
  fileDates = generateFromMtime();
  source    = "mtime (git unavailable)";
}

fs.writeFileSync(OUT_PATH, JSON.stringify(fileDates, null, 2), "utf8");

const count = Object.keys(fileDates).length;
console.log(`[file-dates] ${count} files dated from ${source}`);
