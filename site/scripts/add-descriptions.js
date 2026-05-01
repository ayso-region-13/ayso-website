#!/usr/bin/env node
/**
 * add-descriptions.js
 * Injects a `description` field into the front matter of every content page
 * that is currently missing one.
 */

const fs   = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "../src");

// Map: relative path from src/ → description (150–160 chars ideal)
const DESCRIPTIONS = {
  "index.md":
    "AYSO Region 13 offers youth soccer for players ages 4–19 in Pasadena, Altadena, La Cañada, and surrounding communities. Register today.",

  // ── About ──────────────────────────────────────────────────────────────
  "about/index.md":
    "Learn about AYSO Region 13's mission and six core philosophies: Everyone Plays, Balanced Teams, Open Registration, Positive Coaching, Good Sportsmanship, and Player Development.",
  "about/history.md":
    "AYSO Region 13 has served the Pasadena area since 1969. Learn the history of youth soccer in Pasadena, Altadena, and La Cañada.",
  "about/leadership.md":
    "Meet the volunteer board and leadership team that runs AYSO Region 13 youth soccer in the Pasadena area.",
  "about/policies.md":
    "AYSO Region 13 policies covering player conduct, refund policy, and program guidelines.",
  "about/fine-print.md":
    "Terms, conditions, and fine print for AYSO Region 13 programs and player registration.",
  "about/inclusion.md":
    "AYSO Region 13 is committed to diversity, equity, and inclusion in youth soccer. Learn about our DEI efforts and the EPIC inclusion program.",
  "about/hall-of-fame.md":
    "The AYSO Region 13 Hall of Fame honors volunteers and players who have made outstanding contributions to youth soccer in the Pasadena area.",
  "about/neighbors.md":
    "AYSO regions neighboring Region 13 in the greater Los Angeles area. Find the right region for your community.",
  "about/sisterhood.md":
    "The Sisterhood of Soccer celebrates women's contributions to AYSO Region 13 as coaches, referees, board members, and players.",
  "about/board-minutes.md":
    "AYSO Region 13 board meeting minutes and official records.",

  // ── Programs ──────────────────────────────────────────────────────────
  "programs/index.md":
    "AYSO Region 13 offers youth soccer programs for players ages 4–19 in Pasadena. Fall Soccer, All-Stars, EPIC, Grad Series, Sunday Soccer, and more.",
  "programs/fall-soccer.md":
    "Fall Soccer is Region 13's core recreational program for players ages 6–14. Teams practice weekly and play games on Saturdays, September through mid-November.",
  "programs/upper-division.md":
    "Upper Division soccer for players ages 15–19 (16U and 19U) in the Pasadena area. Schedules designed to avoid conflicts with high school soccer.",
  "programs/preschool.md":
    "Preschool soccer for children ages 3–5 (4U and 5U). A fun, age-appropriate introduction to the game for the youngest players.",
  "programs/next.md":
    "NEXT is an advanced training program for skilled players ages 10–14 who want more challenge alongside their regular Fall Soccer season.",
  "programs/winter-stars.md":
    "Winter Stars is Region 13's winter soccer program for returning Fall Soccer players. Games run December through February.",
  "programs/all-stars.md":
    "All-Stars is Region 13's competitive tournament program. Selected players represent Region 13 at AYSO sectional and national tournaments.",
  "programs/grad-series.md":
    "Grad Series helps 8U players transition to 10U soccer with additional coaching, game experience, and skill development.",
  "programs/spring-soccer.md":
    "Spring Soccer is Region 13's recreational spring program. Open registration for all players ages 6–14.",
  "programs/sunday-soccer.md":
    "Sunday Soccer offers weekly skills training and a goalkeeper academy for Region 13 players. Open to all skill levels.",
  "programs/epic.md":
    "EPIC (Everyone Plays in the Community) pairs players who need field assistance with volunteer buddies for a fully inclusive soccer experience.",
  "programs/tournaments/index.md":
    "AYSO Region 13 hosts the annual Thanksgiving Tournament and Rose City Cup. Learn about upcoming tournaments and how to participate.",
  "programs/tournaments/thanksgiving.md":
    "The Region 13 Thanksgiving Tournament is an annual AYSO soccer tournament held over Thanksgiving weekend in Pasadena.",
  "programs/tournaments/rose-city-cup.md":
    "The Rose City Cup is an annual AYSO soccer tournament hosted by Region 13 in the Pasadena area.",

  // ── Register ──────────────────────────────────────────────────────────
  "register/index.md":
    "Register your child for AYSO Region 13 youth soccer in Pasadena. Player registration opens each season through InLeague.",
  "register/age-chart.md":
    "AYSO Region 13 age divisions and birth date cutoffs. Find which division your child plays in for the current season.",
  "register/forms.md":
    "Volunteer registration requirements for AYSO Region 13 coaches, referees, and team managers.",

  // ── Schedules ─────────────────────────────────────────────────────────
  "schedules/index.md":
    "AYSO Region 13 game schedules, standings, and season calendar. Check InLeague for current game times and field assignments.",
  "schedules/games.md":
    "View AYSO Region 13 game schedules for all divisions. Current schedules are available through InLeague.",
  "schedules/standings.md":
    "AYSO Region 13 division standings for the current season.",
  "schedules/calendar.md":
    "AYSO Region 13 season calendar — key dates for registration, season start, playoffs, tournaments, and special events.",

  // ── Parents ───────────────────────────────────────────────────────────
  "parents/index.md":
    "New to AYSO? Learn how to get started with Region 13 soccer — registration, equipment, game days, and what to expect as a first-time soccer family.",
  "parents/team.md":
    "Information for Region 13 parents about your child's team — rosters, practice schedules, and communicating with your coach and team manager.",
  "parents/equipment.md":
    "What your child needs to play soccer in Region 13: cleats, shin guards, uniform, and ball requirements by age group.",
  "parents/pledge.md":
    "The AYSO Parent Pledge — a commitment to positive sideline behavior and good sportsmanship at all Region 13 games and events.",
  "parents/faqs.md":
    "Frequently asked questions for Region 13 parents — registration, schedules, refunds, uniforms, volunteering, and more.",
  "parents/support.md":
    "How to be a supportive AYSO parent. Tips for positive sideline behavior and helping your child enjoy and develop through soccer.",

  // ── Coaches ───────────────────────────────────────────────────────────
  "coaches/index.md":
    "Volunteer coaching in AYSO Region 13. No soccer experience required — we provide full training and resources for all coaches.",
  "coaches/getting-started.md":
    "How to get started as a coach in AYSO Region 13. Registration, background check, SafeSport training, and coaching certification.",
  "coaches/training.md":
    "AYSO coach training and certification requirements for Region 13. Online courses, in-person clinics, and SafeSport.",
  "coaches/practice.md":
    "Practice planning resources for Region 13 coaches. Session outlines, drills, and tips for coaching all age groups.",
  "coaches/game-day.md":
    "Game day guide for AYSO Region 13 coaches. What to bring, how to set up, and how to run a game for 6U through 14U.",
  "coaches/game-cards.md":
    "How to complete and submit AYSO game cards. Step-by-step instructions for Region 13 coaches.",
  "coaches/drills.md":
    "Soccer drills and skills exercises for AYSO Region 13 coaches. Age-appropriate activities for players 6U through 14U.",
  "coaches/pie.md":
    "The PIE philosophy — Positive, Inspiring, and Enthusiastic coaching. AYSO's approach to youth soccer coaching in Region 13.",
  "coaches/shootout.md":
    "Shootout (penalty kick) rules and procedures for AYSO Region 13 games.",
  "coaches/tournament-teams.md":
    "Guide for Region 13 coaches of All-Stars and tournament teams. Preparation, rules, and logistics for AYSO tournament play.",
  "coaches/wca.md":
    "The Women's Coaching Alliance (WCA) supports and encourages women coaches in AYSO Region 13.",
  "coaches/player-ratings.md":
    "Player rating guidelines for AYSO Region 13 coaches. How to evaluate players for balanced team formation.",
  "coaches/faqs.md":
    "Frequently asked questions for AYSO Region 13 coaches — training requirements, game cards, substitutions, and more.",

  // ── Referees ──────────────────────────────────────────────────────────
  "referees/index.md":
    "Volunteer refereeing in AYSO Region 13. Help make games happen — training, certification, and scheduling support provided.",
  "referees/training.md":
    "AYSO referee training and certification for Region 13. Online courses, in-person clinics, and upgrade pathways for all levels.",
  "referees/scheduling.md":
    "How referee scheduling works in AYSO Region 13. Self-scheduling through the online referee scheduling system.",
  "referees/laws.md":
    "Laws of the Game for AYSO referees in Region 13. AYSO modifications to FIFA rules for youth soccer.",
  "referees/pro.md":
    "The Youth Referee Program (PRO) trains young referees ages 12–18 in AYSO Region 13. Learn to referee while earning community service hours.",
  "referees/resources.md":
    "Resources for AYSO Region 13 referees — documents, forms, training materials, and referee handbook.",
  "referees/upgrades.md":
    "How to upgrade your AYSO referee certification in Region 13. Requirements and pathways for Grade 9, 8, and higher.",
  "referees/faqs.md":
    "Frequently asked questions for AYSO Region 13 referees — scheduling, compensation, uniforms, and game rules.",

  // ── Managers ──────────────────────────────────────────────────────────
  "managers/index.md":
    "Team manager roles and responsibilities in AYSO Region 13. Managers support coaches and keep teams organized throughout the season.",
  "managers/training.md":
    "Required training for AYSO Region 13 team managers — SafeSport, background check, and online certification.",
  "managers/tasks.md":
    "Team manager tasks and checklists for AYSO Region 13. Pre-season, in-season, and post-season responsibilities.",
  "managers/faqs.md":
    "Frequently asked questions for AYSO Region 13 team managers.",

  // ── Volunteers ────────────────────────────────────────────────────────
  "volunteers/index.md":
    "Volunteer with AYSO Region 13. Coaching, refereeing, team managing, and board roles available. No prior experience necessary.",
  "volunteers/roles.md":
    "Volunteer roles available in AYSO Region 13 — coach, referee, team manager, board member, field host, and more.",
  "volunteers/classes.md":
    "Volunteer training classes and clinics for AYSO Region 13. Coach certification, referee training, SafeSport, and LiveScan.",
  "volunteers/tent.md":
    "Field host (tent duty) guide for AYSO Region 13. Responsibilities and procedures for game-day field hosts at Victory Park.",
  "volunteers/onboarding.md":
    "Board member onboarding for AYSO Region 13. Getting started as a new board member — roles, tools, and key contacts.",
  "volunteers/faqs.md":
    "Frequently asked questions for AYSO Region 13 volunteers.",

  // ── Fields ────────────────────────────────────────────────────────────
  "fields/index.md":
    "All AYSO Region 13 soccer field locations in Pasadena, Altadena, and La Cañada. Maps, parking information, and directions.",
  "fields/goals.md":
    "Goal assembly and disassembly instructions for AYSO Region 13 volunteer coaches and field hosts.",
  "fields/victory.md":
    "Victory Park in Pasadena — AYSO Region 13's primary game location for 6U–12U divisions. Address, parking, and field map.",
  "fields/blair.md":
    "Blair High School fields — AYSO Region 13 game location in Pasadena. Address, parking, and directions.",
  "fields/muir.md":
    "Muir High School fields — AYSO Region 13 game location in Pasadena. Address, parking, and directions.",
  "fields/muir-south.md":
    "Muir South practice fields — AYSO Region 13 location in Pasadena. Address, parking, and directions.",
  "fields/jefferson.md":
    "Jefferson Center fields — AYSO Region 13 game location in Pasadena. Address, parking, and directions.",
  "fields/mckinley.md":
    "McKinley School fields — AYSO Region 13 game location in Pasadena. Address, parking, and directions.",
  "fields/mcdonald.md":
    "McDonald Park fields — AYSO Region 13 game location in Pasadena. Address, parking, and directions.",
  "fields/wilson.md":
    "Wilson Middle School fields — AYSO Region 13 game location in Pasadena. Address, parking, and directions.",
  "fields/brookside.md":
    "Brookside Park fields — AYSO Region 13 game location in Pasadena. Address, parking, and directions.",
  "fields/marshall.md":
    "Marshall Fundamental School fields — AYSO Region 13 game location in Pasadena. Address, parking, and directions.",
  "fields/paradise.md":
    "Paradise Canyon School fields — AYSO Region 13 game location in La Cañada. Address, parking, and directions.",
  "fields/oak-grove.md":
    "Oak Grove Park fields — AYSO Region 13 game location in Pasadena. Address, parking, and directions.",
  "fields/lchs.md":
    "La Cañada High School fields — AYSO Region 13 game location in La Cañada. Address, parking, and directions.",
  "fields/la-salle.md":
    "La Salle High School fields — AYSO Region 13 game location in Pasadena. Address, parking, and directions.",
  "fields/allendale.md":
    "Allendale Park fields — AYSO Region 13 game location in Pasadena. Address, parking, and directions.",
  "fields/area-h.md":
    "Area H fields — AYSO Region 13 game and practice location. Address, parking, and directions.",

  // ── Resources ─────────────────────────────────────────────────────────
  "resources/index.md":
    "AYSO Region 13 resources — document library, photo gallery, newsletter archive, and safety policies.",
  "resources/documents.md":
    "AYSO Region 13 document library — forms, handbooks, training materials, and official documents.",
  "resources/gallery.md":
    "AYSO Region 13 photo gallery — game photos, team pictures, and event photos from the Pasadena area.",
  "resources/newsletter.md":
    "AYSO Region 13 newsletter — stay up to date with region news, announcements, and event recaps.",
  "resources/safety.md":
    "AYSO Region 13 safety and heat policy. Guidelines for safe play in hot weather, lightning, and emergency procedures.",
  "resources/pictures.md":
    "AYSO Region 13 photos and images from games, tournaments, and events.",

  // ── Contact ───────────────────────────────────────────────────────────
  "contact/index.md":
    "Contact AYSO Region 13. Phone, email, and mailing address for the Pasadena area youth soccer region.",
  "contact/feedback.md":
    "Send feedback to AYSO Region 13. We welcome questions, suggestions, and comments about our programs and events.",
};

let updated = 0;
let skipped = 0;

for (const [relPath, description] of Object.entries(DESCRIPTIONS)) {
  const filePath = path.join(SRC, relPath);

  if (!fs.existsSync(filePath)) {
    console.log(`  SKIP (not found): ${relPath}`);
    skipped++;
    continue;
  }

  let content = fs.readFileSync(filePath, "utf8");

  // Already has a description field — skip
  if (/^description:/m.test(content)) {
    console.log(`  SKIP (has description): ${relPath}`);
    skipped++;
    continue;
  }

  // Insert description after the first front matter field (after layout: or section: line usually)
  // Strategy: insert before the closing ---
  const parts = content.split(/^---$/m);
  if (parts.length < 3) {
    console.log(`  SKIP (no front matter): ${relPath}`);
    skipped++;
    continue;
  }

  // parts[0] = "" (before first ---)
  // parts[1] = front matter content
  // parts[2+] = page content
  const fm = parts[1].trimEnd();
  const body = parts.slice(2).join("---");

  const newContent = `---\n${fm}\ndescription: "${description}"\n---${body}`;
  fs.writeFileSync(filePath, newContent, "utf8");
  console.log(`  ✓ ${relPath}`);
  updated++;
}

console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}`);
