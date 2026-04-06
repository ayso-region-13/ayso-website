#!/usr/bin/env node
/**
 * migrate-content.js
 * Reads Markdown files from /content/, adds YAML front matter, writes to site/src/
 */

const fs   = require("fs");
const path = require("path");

const CONTENT_DIR = path.join(__dirname, "../../content");
const DEST_DIR    = path.join(__dirname, "../src");

// Map: source path (relative to CONTENT_DIR) → destination info
const FILE_MAP = [
  // ── Home ────────────────────────────────────────────────────────────
  { src: "home.md",
    dest: "index.md",
    layout: "home.njk",
    section: "home" },

  // ── About ────────────────────────────────────────────────────────────
  { src: "about/mission.md",
    dest: "about/index.md",
    layout: "page.njk",
    section: "about",
    permalink: "/about/" },
  { src: "about/history.md",        dest: "about/history.md",       layout: "page.njk", section: "about" },
  { src: "about/leadership.md",     dest: "about/leadership.md",    layout: "page.njk", section: "about" },
  { src: "about/policies.md",       dest: "about/policies.md",      layout: "page.njk", section: "about" },
  { src: "about/fine-print.md",     dest: "about/fine-print.md",    layout: "page.njk", section: "about" },
  { src: "about/inclusion.md",      dest: "about/inclusion.md",     layout: "page.njk", section: "about" },
  { src: "about/hall-of-fame.md",   dest: "about/hall-of-fame.md",  layout: "page.njk", section: "about" },
  { src: "about/neighbors.md",      dest: "about/neighbors.md",     layout: "page.njk", section: "about" },
  { src: "about/sisterhood.md",     dest: "about/sisterhood.md",    layout: "page.njk", section: "about" },
  { src: "about/minutes.md",        dest: "about/board-minutes.md", layout: "page.njk", section: "about" },

  // ── Programs ─────────────────────────────────────────────────────────
  { src: "programs/overview.md",
    dest: "programs/index.md",
    layout: "page.njk",
    section: "programs",
    permalink: "/programs/" },
  { src: "programs/fall-soccer.md",    dest: "programs/fall-soccer.md",    layout: "page.njk", section: "programs", heroImage: "action-02.jpg" },
  { src: "programs/upper-division.md", dest: "programs/upper-division.md", layout: "page.njk", section: "programs", heroImage: "action-03.jpg" },
  { src: "programs/preschool.md",      dest: "programs/preschool.md",      layout: "page.njk", section: "programs", heroImage: "action-04.jpg" },
  { src: "programs/next.md",           dest: "programs/next.md",           layout: "page.njk", section: "programs", heroImage: "action-05.jpg" },
  { src: "programs/winter-stars.md",   dest: "programs/winter-stars.md",   layout: "page.njk", section: "programs", heroImage: "grad-series-01.jpg" },
  { src: "programs/all-stars.md",      dest: "programs/all-stars.md",      layout: "page.njk", section: "programs", heroImage: "all-stars-01.jpg" },
  { src: "programs/grad-series.md",    dest: "programs/grad-series.md",    layout: "page.njk", section: "programs", heroImage: "grad-series-02.jpg" },
  { src: "programs/spring-soccer.md",  dest: "programs/spring-soccer.md",  layout: "page.njk", section: "programs", heroImage: "action-06.jpg" },
  { src: "programs/sunday-soccer.md",  dest: "programs/sunday-soccer.md",  layout: "page.njk", section: "programs", heroImage: "game-01.jpg" },
  { src: "programs/epic.md",           dest: "programs/epic.md",           layout: "page.njk", section: "programs" },
  // Tournaments
  { src: "programs/tournaments/overview.md",
    dest: "programs/tournaments/index.md",
    layout: "page.njk",
    section: "programs",
    permalink: "/programs/tournaments/" },
  { src: "programs/tournaments/thanksgiving.md",  dest: "programs/tournaments/thanksgiving.md",  layout: "page.njk", section: "programs" },
  { src: "programs/tournaments/rose-city-cup.md", dest: "programs/tournaments/rose-city-cup.md", layout: "page.njk", section: "programs" },

  // ── Register ─────────────────────────────────────────────────────────
  { src: "register/overview.md",
    dest: "register/index.md",
    layout: "page.njk",
    section: "register",
    permalink: "/register/" },
  { src: "register/age-chart.md", dest: "register/age-chart.md", layout: "page.njk", section: "register" },
  { src: "register/forms.md",     dest: "register/forms.md",     layout: "page.njk", section: "register" },

  // ── Schedules ────────────────────────────────────────────────────────
  { src: "schedules/overview.md",
    dest: "schedules/index.md",
    layout: "page.njk",
    section: "schedules",
    permalink: "/schedules/" },
  { src: "schedules/games.md",     dest: "schedules/games.md",     layout: "page.njk", section: "schedules" },
  { src: "schedules/standings.md", dest: "schedules/standings.md", layout: "page.njk", section: "schedules" },
  { src: "schedules/calendar.md",  dest: "schedules/calendar.md",  layout: "page.njk", section: "schedules" },

  // ── Parents ──────────────────────────────────────────────────────────
  { src: "parents/getting-started.md",
    dest: "parents/index.md",
    layout: "page.njk",
    section: "parents",
    permalink: "/parents/" },
  { src: "parents/team.md",      dest: "parents/team.md",      layout: "page.njk", section: "parents" },
  { src: "parents/equipment.md", dest: "parents/equipment.md", layout: "page.njk", section: "parents" },
  { src: "parents/pledge.md",    dest: "parents/pledge.md",    layout: "page.njk", section: "parents" },
  { src: "parents/faqs.md",      dest: "parents/faqs.md",      layout: "page.njk", section: "parents" },
  { src: "parents/support.md",   dest: "parents/support.md",   layout: "page.njk", section: "parents" },

  // ── Coaches ──────────────────────────────────────────────────────────
  { src: "coaches/overview.md",
    dest: "coaches/index.md",
    layout: "page.njk",
    section: "coaches",
    permalink: "/coaches/" },
  { src: "coaches/getting-started.md",  dest: "coaches/getting-started.md",  layout: "page.njk", section: "coaches" },
  { src: "coaches/training.md",         dest: "coaches/training.md",         layout: "page.njk", section: "coaches" },
  { src: "coaches/practice.md",         dest: "coaches/practice.md",         layout: "page.njk", section: "coaches" },
  { src: "coaches/game-day.md",         dest: "coaches/game-day.md",         layout: "page.njk", section: "coaches" },
  { src: "coaches/game-cards.md",       dest: "coaches/game-cards.md",       layout: "page.njk", section: "coaches" },
  { src: "coaches/drills.md",           dest: "coaches/drills.md",           layout: "page.njk", section: "coaches" },
  { src: "coaches/pie.md",              dest: "coaches/pie.md",              layout: "page.njk", section: "coaches" },
  { src: "coaches/shootout.md",         dest: "coaches/shootout.md",         layout: "page.njk", section: "coaches" },
  { src: "coaches/tournament-teams.md", dest: "coaches/tournament-teams.md", layout: "page.njk", section: "coaches" },
  { src: "coaches/wca.md",              dest: "coaches/wca.md",              layout: "page.njk", section: "coaches", heroImage: "wca-01.jpg" },
  { src: "coaches/player-ratings.md",   dest: "coaches/player-ratings.md",   layout: "page.njk", section: "coaches" },
  { src: "coaches/faqs.md",             dest: "coaches/faqs.md",             layout: "page.njk", section: "coaches" },

  // ── Referees ─────────────────────────────────────────────────────────
  { src: "referees/overview.md",
    dest: "referees/index.md",
    layout: "page.njk",
    section: "referees",
    permalink: "/referees/" },
  { src: "referees/training.md",   dest: "referees/training.md",   layout: "page.njk", section: "referees" },
  { src: "referees/scheduling.md", dest: "referees/scheduling.md", layout: "page.njk", section: "referees" },
  { src: "referees/laws.md",       dest: "referees/laws.md",       layout: "page.njk", section: "referees" },
  { src: "referees/pro.md",        dest: "referees/pro.md",        layout: "page.njk", section: "referees" },
  { src: "referees/resources.md",  dest: "referees/resources.md",  layout: "page.njk", section: "referees" },
  { src: "referees/upgrades.md",   dest: "referees/upgrades.md",   layout: "page.njk", section: "referees" },
  { src: "referees/faqs.md",       dest: "referees/faqs.md",       layout: "page.njk", section: "referees" },

  // ── Managers ─────────────────────────────────────────────────────────
  { src: "managers/overview.md",
    dest: "managers/index.md",
    layout: "page.njk",
    section: "managers",
    permalink: "/managers/" },
  { src: "managers/training.md", dest: "managers/training.md", layout: "page.njk", section: "managers" },
  { src: "managers/tasks.md",    dest: "managers/tasks.md",    layout: "page.njk", section: "managers" },
  { src: "managers/faqs.md",     dest: "managers/faqs.md",     layout: "page.njk", section: "managers" },

  // ── Volunteers ───────────────────────────────────────────────────────
  { src: "volunteers/overview.md",
    dest: "volunteers/index.md",
    layout: "page.njk",
    section: "volunteers",
    permalink: "/volunteers/" },
  { src: "volunteers/roles.md",      dest: "volunteers/roles.md",      layout: "page.njk", section: "volunteers" },
  { src: "volunteers/classes.md",    dest: "volunteers/classes.md",    layout: "page.njk", section: "volunteers" },
  { src: "volunteers/tent.md",       dest: "volunteers/tent.md",       layout: "page.njk", section: "volunteers" },
  { src: "volunteers/onboarding.md", dest: "volunteers/onboarding.md", layout: "page.njk", section: "volunteers" },
  { src: "volunteers/sponsors.md",   dest: "volunteers/sponsors.md",   layout: "page.njk", section: "volunteers" },
  { src: "volunteers/faqs.md",       dest: "volunteers/faqs.md",       layout: "page.njk", section: "volunteers" },

  // ── Fields ───────────────────────────────────────────────────────────
  { src: "fields/overview.md",
    dest: "fields/index.md",
    layout: "page.njk",
    section: "fields",
    permalink: "/fields/" },
  { src: "fields/goals.md",      dest: "fields/goals.md",      layout: "page.njk", section: "fields" },
  { src: "fields/allendale.md",  dest: "fields/allendale.md",  layout: "page.njk", section: "fields" },
  { src: "fields/area-h.md",     dest: "fields/area-h.md",     layout: "page.njk", section: "fields" },
  { src: "fields/blair.md",      dest: "fields/blair.md",      layout: "page.njk", section: "fields" },
  { src: "fields/brookside.md",  dest: "fields/brookside.md",  layout: "page.njk", section: "fields" },
  { src: "fields/jefferson.md",  dest: "fields/jefferson.md",  layout: "page.njk", section: "fields" },
  { src: "fields/la-salle.md",   dest: "fields/la-salle.md",   layout: "page.njk", section: "fields" },
  { src: "fields/lchs.md",       dest: "fields/lchs.md",       layout: "page.njk", section: "fields" },
  { src: "fields/marshall.md",   dest: "fields/marshall.md",   layout: "page.njk", section: "fields" },
  { src: "fields/mcdonald.md",   dest: "fields/mcdonald.md",   layout: "page.njk", section: "fields" },
  { src: "fields/mckinley.md",   dest: "fields/mckinley.md",   layout: "page.njk", section: "fields" },
  { src: "fields/muir-south.md", dest: "fields/muir-south.md", layout: "page.njk", section: "fields" },
  { src: "fields/muir.md",       dest: "fields/muir.md",       layout: "page.njk", section: "fields" },
  { src: "fields/oak-grove.md",  dest: "fields/oak-grove.md",  layout: "page.njk", section: "fields" },
  { src: "fields/paradise.md",   dest: "fields/paradise.md",   layout: "page.njk", section: "fields" },
  { src: "fields/victory.md",    dest: "fields/victory.md",    layout: "page.njk", section: "fields" },
  { src: "fields/wilson.md",     dest: "fields/wilson.md",     layout: "page.njk", section: "fields" },

  // ── Resources ────────────────────────────────────────────────────────
  { src: "resources/overview.md",
    dest: "resources/index.md",
    layout: "page.njk",
    section: "resources",
    permalink: "/resources/" },
  { src: "resources/documents.md",  dest: "resources/documents.md",  layout: "page.njk", section: "resources" },
  { src: "resources/gallery.md",    dest: "resources/gallery.md",    layout: "page.njk", section: "resources" },
  { src: "resources/newsletter.md", dest: "resources/newsletter.md", layout: "page.njk", section: "resources" },
  { src: "resources/pictures.md",   dest: "resources/pictures.md",   layout: "page.njk", section: "resources" },
  { src: "resources/safety.md",     dest: "resources/safety.md",     layout: "page.njk", section: "resources" },

  // ── Contact ──────────────────────────────────────────────────────────
  { src: "contact/overview.md",
    dest: "contact/index.md",
    layout: "page.njk",
    section: "contact",
    permalink: "/contact/" },
  { src: "contact/feedback.md", dest: "contact/feedback.md", layout: "page.njk", section: "contact" },
];

// ─────────────────────────────────────────────────────────────────────────────

function extractTitle(content) {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : "Untitled";
}

function buildFrontMatter(title, entry) {
  const lines = [
    "---",
    `title: "${title.replace(/"/g, '\\"')}"`,
    `layout: ${entry.layout}`,
    `section: ${entry.section}`,
  ];
  if (entry.permalink)  lines.push(`permalink: "${entry.permalink}"`);
  if (entry.heroImage)  lines.push(`heroImage: "${entry.heroImage}"`);
  lines.push("---");
  return lines.join("\n");
}

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

let created = 0;
let skipped = 0;
let errors  = 0;

for (const entry of FILE_MAP) {
  const srcPath  = path.join(CONTENT_DIR, entry.src);
  const destPath = path.join(DEST_DIR, entry.dest);

  if (!fs.existsSync(srcPath)) {
    console.warn(`⚠  MISSING source: ${entry.src}`);
    skipped++;
    continue;
  }

  const raw   = fs.readFileSync(srcPath, "utf8");
  const title = extractTitle(raw);
  const fm    = buildFrontMatter(title, entry);

  // Remove an existing front matter block if the file somehow already has one
  const body  = raw.replace(/^---[\s\S]*?---\n?/, "").trimStart();

  const output = fm + "\n\n" + body;

  ensureDir(destPath);
  fs.writeFileSync(destPath, output, "utf8");
  console.log(`✓  ${entry.src.padEnd(45)} → ${entry.dest}`);
  created++;
}

console.log(`\nDone: ${created} files created, ${skipped} skipped, ${errors} errors.`);
