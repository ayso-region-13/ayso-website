#!/usr/bin/env node
// Seed (or re-seed) the Region Overview map: one labeled pin per field, placed
// at its real placeLat/placeLon, auto-framed to fit every field. Writes the
// re-editable annotation JSON the field-maps editor loads under slug "overview".
//
// This is the "auto layout" — board members open Region Overview in the editor
// to nudge overlapping labels, then Save (which renders + commits the PNG).
//
// Game vs practice classification comes from the /fields/ index table (the
// authoritative Practice|Games columns); coordinates + titles from each field's
// frontmatter. Run from anywhere:  node workers/field-maps/scripts/seed-overview.js
//
// Existing pin positions are PRESERVED on re-seed (so manual nudges survive):
// only new fields are added and removed fields are dropped.

const fs = require("fs");
const path = require("path");
const Geo = require(path.join(__dirname, "..", "public", "geo.js"));

const REPO = path.join(__dirname, "..", "..", "..");
const FIELDS_DIR = path.join(REPO, "site", "src", "fields");
const INDEX_MD = path.join(FIELDS_DIR, "index.md");
const OUT = path.join(REPO, "site", "src", "_data", "fieldmaps", "overview.json");

const OUT_W = 1000, OUT_H = 750, SCALE = 2;
const ASPECT = OUT_H / OUT_W;

function frontmatter(md) {
  const m = md.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!m) return {};
  const fm = {};
  m[1].split("\n").forEach((line) => {
    const mm = line.match(/^\s*([A-Za-z0-9_]+)\s*:\s*(.+?)\s*$/);
    if (mm) fm[mm[1]] = mm[2].replace(/^["']|["']$/g, "");
  });
  return fm;
}

// Parse the index table → slug → { practice, games } from the ✓ columns.
function classify() {
  const md = fs.readFileSync(INDEX_MD, "utf8");
  const map = {};
  md.split("\n").forEach((line) => {
    const m = line.match(/^\|\s*\[[^\]]+\]\(\/fields\/([a-z0-9-]+)\/?\)\s*\|([^|]*)\|([^|]*)\|([^|]*)\|/);
    if (!m) return;
    map[m[1]] = { practice: /✓/.test(m[3]), games: /✓/.test(m[4]) };
  });
  return map;
}

function play(cls) {
  if (!cls) return "practice";
  if (cls.games && cls.practice) return "both";
  return cls.games ? "game" : "practice";
}

// Short pin labels for the overview (the .md titles are too long at region
// scale). Falls back to the field title for any slug not listed here.
const SHORT_LABELS = {
  allendale: "Allendale", "area-h": "Rose Bowl Area H", "blair-lower": "Blair Lower",
  "blair-upper": "Blair Upper", brookside: "Brookside", butler: "Butler MS",
  cornishon: "Cornishon", "fis-lower": "FIS Lower", "fis-upper": "FIS Upper",
  jefferson: "Jefferson", "la-canada-elementary": "LC Elementary", "la-salle": "La Salle HS",
  "lc-lds": "LC LDS", lchs: "La Cañada HS", marshall: "Marshall", mcdonald: "McDonald",
  mckinley: "McKinley", muir: "Muir North", "muir-south": "Muir South",
  "oak-grove": "Oak Grove", paradise: "Paradise Canyon", victory: "Victory Park", wilson: "Wilson MS",
};

const cls = classify();
const fields = fs.readdirSync(FIELDS_DIR)
  .filter((f) => f.endsWith(".md") && f !== "index.md" && f !== "goals.md")
  .map((f) => {
    const slug = f.replace(/\.md$/, "");
    const fm = frontmatter(fs.readFileSync(path.join(FIELDS_DIR, f), "utf8"));
    if (!fm.placeLat || !fm.placeLon) return null;
    return { slug, title: SHORT_LABELS[slug] || fm.title || slug, lat: +fm.placeLat, lon: +fm.placeLon, play: play(cls[slug]) };
  })
  .filter(Boolean);

// Preserve existing nudged positions on re-seed; keyed by field name.
let prior = {};
if (fs.existsSync(OUT)) {
  try {
    const doc = JSON.parse(fs.readFileSync(OUT, "utf8"));
    const els = (doc.variants && doc.variants.map && doc.variants.map.elements) || [];
    els.forEach((e) => { if (e.kind === "place" && e.slug) prior[e.slug] = e.center; });
  } catch (_) {}
}

let seq = 1;
const elements = fields.map((f) => ({
  id: "e" + seq++,
  kind: "place",
  slug: f.slug,
  center: prior[f.slug] || [f.lon, f.lat],
  name: f.title,
  play: f.play,
}));

// Auto-frame: bounding box of all pins + margin.
const lons = elements.map((e) => e.center[0]), lats = elements.map((e) => e.center[1]);
const center = [(Math.min(...lons) + Math.max(...lons)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2];
const ewM = Geo.distanceM([Math.min(...lons), center[1]], [Math.max(...lons), center[1]]);
const nsM = Geo.distanceM([center[0], Math.min(...lats)], [center[0], Math.max(...lats)]);
const frameMeters = Math.round(Math.max(ewM, nsM / ASPECT) * 1.18);
const zoom = Geo.zoomForGroundWidth(center[1], frameMeters, OUT_W);

const doc = {
  field: "overview",
  styleVersion: "streets-v12",
  variants: {
    map: {
      label: "Region Overview",
      png: "/images/fields/overview-map.png",
      alt: "AYSO Region 13 field locations across Pasadena, Altadena, and La Cañada Flintridge",
      view: { center, zoom: +zoom.toFixed(3), bearing: 0, frameMeters, width: OUT_W, height: OUT_H, scale: SCALE },
      elements,
    },
  },
};

fs.writeFileSync(OUT, JSON.stringify(doc, null, 2) + "\n");
console.log(`Wrote ${OUT}`);
console.log(`  ${elements.length} field pins | center ${center.map((n) => n.toFixed(4))} | frameMeters ${frameMeters} | zoom ${zoom.toFixed(2)}`);
const byPlay = elements.reduce((a, e) => ((a[e.play] = (a[e.play] || 0) + 1), a), {});
console.log("  by play:", JSON.stringify(byPlay));
console.log("  preserved positions:", Object.keys(prior).length);
