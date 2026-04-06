#!/usr/bin/env node
/**
 * replace-inleague.js
 * Replaces [INLEAGUE: ...] placeholders with real links where URLs are known.
 * Logs unknowns for manual resolution.
 */

const fs   = require("fs");
const path = require("path");
const SRC  = path.join(__dirname, "../src");

// ── Global search-and-replace (same replacement across all files) ──────────
const GLOBAL = [
  // Registration
  { from: "[INLEAGUE: Registration link - opens in new tab]",
    to:   "[Register on InLeague](https://ayso13.inleague.com/app)" },
  { from: "[INLEAGUE: Registration link]",
    to:   "[Register on InLeague](https://ayso13.inleague.com/app)" },
  { from: "[INLEAGUE: Tournament registration portal]",
    to:   "[Register on InLeague](https://ayso13.inleague.com/app)" },
  // Button CTA
  { from: "[INLEAGUE: Large registration button/CTA]",
    to:   '<a href="https://ayso13.inleague.com/app" class="btn-primary" target="_blank" rel="noopener">Register on InLeague</a>' },

  // Volunteer registration
  { from: "[INLEAGUE: Volunteer registration link]",
    to:   "[Register as a volunteer on InLeague](https://ayso13.inleague.com/app/volunteer)" },

  // eTrainU
  { from: "[INLEAGUE: Link to eTrainU]",
    to:   "[eTrainU](https://ayso13.inleague.com/eTrainu/index/)" },
  { from: "[INLEAGUE: eTrainU link]",
    to:   "[eTrainU](https://ayso13.inleague.com/eTrainu/index/)" },
  { from: "[INLEAGUE: eTrainU]",
    to:   "[eTrainU](https://ayso13.inleague.com/eTrainu/index/)" },
  { from: "[INLEAGUE: Link to AYSOU resources]",
    to:   "[eTrainU (AYSOU)](https://ayso13.inleague.com/eTrainu/index/)" },

  // Referee Scheduler
  { from: "[INLEAGUE: Referee Scheduler link]",
    to:   "[Referee Scheduler](https://ayso13.inleague.com/app/referee-scheduler)" },
  { from: "[INLEAGUE: Referee Scheduler]",
    to:   "[Referee Scheduler](https://ayso13.inleague.com/app/referee-scheduler)" },

  // Game/practice schedule
  { from: "[INLEAGUE: Game schedule link]",
    to:   "[View on InLeague](https://ayso13.inleague.com/app/schedule)" },
  { from: "[INLEAGUE: Link to interactive schedule]",
    to:   "[InLeague schedule](https://ayso13.inleague.com/app/schedule)" },
  { from: "[INLEAGUE: Game Schedule]",
    to:   "[Game Schedule](https://ayso13.inleague.com/app/schedule)" },
  { from: "[INLEAGUE: Practice Schedule]",
    to:   "[Practice Schedule](https://ayso13.inleague.com/app/schedule)" },

  // Standings
  { from: "[INLEAGUE: Current season standings link]",
    to:   "[Current standings on InLeague](https://ayso13.inleague.com/app/schedule)" },
  { from: "[INLEAGUE: Link to standings]",
    to:   "[standings on InLeague](https://ayso13.inleague.com/app/schedule)" },

  // Profile / account
  { from: "[INLEAGUE: account settings]",
    to:   "[your InLeague profile](https://ayso13.inleague.com/app/family-profile)" },
  { from: "[INLEAGUE: team roster]",
    to:   "[InLeague](https://ayso13.inleague.com/app)" },
  { from: "[INLEAGUE: Profile link]",
    to:   "[your InLeague profile](https://ayso13.inleague.com/app/family-profile)" },

  // Field status
  { from: "[INLEAGUE: Link to field status page]",
    to:   "[InLeague](https://ayso13.inleague.com/app)" },

  // Calendar
  { from: "[INLEAGUE: Interactive calendar link]",
    to:   "[InLeague](https://ayso13.inleague.com/app)" },
  { from: "[INLEAGUE: Season calendar link]",
    to:   "[InLeague](https://ayso13.inleague.com/app)" },

  // Resources index
  { from: "[INLEAGUE: Registration]",
    to:   "[Registration](https://ayso13.inleague.com/app)" },
  { from: "[INLEAGUE: InLeague Portal]",
    to:   "[InLeague Portal](https://ayso13.inleague.com/)" },
  { from: "[INLEAGUE: Link to full document library]",
    to:   "[document library](/resources/documents/)" },

  // Laws of the game (external — IFAB publishes these publicly)
  { from: "[INLEAGUE: Link to IFAB Laws of the Game]",
    to:   "[IFAB Laws of the Game](https://www.theifab.com/laws-of-the-game/)" },
];

// ── Per-file Google Maps replacements ────────────────────────────────────
const FIELDS = {
  "fields/victory.md":   "https://maps.google.com/?q=Victory+Park,+Pasadena,+CA",
  "fields/blair.md":     "https://maps.google.com/?q=1301+S+Marengo+Ave,+Pasadena,+CA",
  "fields/muir.md":      "https://maps.google.com/?q=711+W+Woodbury+Rd,+Altadena,+CA",
  "fields/muir-south.md":"https://maps.google.com/?q=John+Muir+High+School,+1905+Lincoln+Ave,+Altadena,+CA",
  "fields/jefferson.md": "https://maps.google.com/?q=1501+E+Villa+St,+Pasadena,+CA+91106",
  "fields/mckinley.md":  "https://maps.google.com/?q=325+S+Oak+Knoll+Ave,+Pasadena,+CA+91101",
  "fields/mcdonald.md":  "https://maps.google.com/?q=1000+E+Mountain+St,+Pasadena,+CA+91104",
  "fields/wilson.md":    "https://maps.google.com/?q=300+S+Madre+St,+Pasadena,+CA+91107",
  "fields/brookside.md": "https://maps.google.com/?q=360+N+Arroyo+Blvd,+Pasadena,+CA+91103",
  "fields/marshall.md":  "https://maps.google.com/?q=990+Allen+Ave,+Pasadena,+CA+91104",
  "fields/paradise.md":  "https://maps.google.com/?q=471+Knight+Way,+La+Canada,+CA+91011",
  "fields/oak-grove.md": "https://maps.google.com/?q=4463+Oak+Grove+Dr,+La+Canada,+CA+91011",
  "fields/lchs.md":      "https://maps.google.com/?q=4463+Oak+Grove+Dr,+La+Canada,+CA+91011",
  "fields/la-salle.md":  "https://maps.google.com/?q=3880+E+Sierra+Madre+Blvd,+Pasadena,+CA+91107",
  "fields/allendale.md": "https://maps.google.com/?q=1130+S+Marengo+Ave,+Pasadena,+CA+91106",
  "fields/area-h.md":    "https://maps.google.com/?q=Rose+Bowl,+Pasadena,+CA",
};

// ── Apply global replacements to all .md files ────────────────────────────
let totalReplaced = 0;

function processFile(relPath) {
  const filePath = path.join(SRC, relPath);
  if (!fs.existsSync(filePath)) return;

  let content = fs.readFileSync(filePath, "utf8");
  let changed  = false;

  for (const { from, to } of GLOBAL) {
    if (content.includes(from)) {
      content = content.split(from).join(to);
      changed = true;
    }
  }

  // Google Maps for field pages
  if (FIELDS[relPath] && content.includes("[INLEAGUE: Google Maps link]")) {
    const mapsUrl = FIELDS[relPath];
    content = content.split("[INLEAGUE: Google Maps link]")
                     .join(`[Get directions](${mapsUrl})`);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, content, "utf8");
    console.log(`  ✓ ${relPath}`);
    totalReplaced++;
  }
}

// Walk all .md files in src/
function walk(dir, base = "") {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory() && !entry.name.startsWith("_")) {
      walk(path.join(dir, entry.name), rel);
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      processFile(rel);
    }
  }
}

walk(SRC);

// ── Report remaining unknowns ─────────────────────────────────────────────
console.log(`\n✓ ${totalReplaced} files updated\n`);
console.log("── Remaining [INLEAGUE: ...] placeholders (need manual URLs) ────────────────");

const { execSync } = require("child_process");
try {
  const result = execSync(
    `grep -rn "\\[INLEAGUE:" "${SRC}" --include="*.md" --include="*.njk"`,
    { encoding: "utf8" }
  );
  const lines = result.trim().split("\n");
  for (const line of lines) {
    const rel = line.replace(SRC + "/", "").replace(SRC.replace(/\//g, path.sep) + path.sep, "");
    console.log("  " + rel);
  }
  console.log(`\n  Total remaining: ${lines.length}`);
} catch {
  console.log("  None remaining.");
}
