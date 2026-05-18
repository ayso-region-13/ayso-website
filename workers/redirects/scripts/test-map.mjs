#!/usr/bin/env node
// Smoke test for the generated redirect map. Verifies a handful of
// known rules (user-requested + currently-broken-on-prod) so we catch
// regressions before deploy.
//
// Usage: node scripts/test-map.mjs

import { EXACT, SPLAT } from "../src/map.js";

const cases = [
  // User-requested for Worker rollout
  { path: "/start",                d: "https://ayso13.inleague.com/app/welcome" },
  { path: "/start/",               d: "https://ayso13.inleague.com/app/welcome" },
  { path: "/dashboard",            d: "https://ayso13.inleague.com/app/" },
  { path: "/dashboard/",           d: "https://ayso13.inleague.com/app/" },
  { path: "/register/volunteer",   d: "/volunteers/" },
  { path: "/register/volunteer/",  d: "/volunteers/" },
  { path: "/livescan",             d: "/volunteers/livescan/" },
  { path: "/livescan/",            d: "/volunteers/livescan/" },
  // Currently 404'ing on production (will be fixed by Worker)
  { path: "/heat",                 d: "/resources/heat-policy/" },
  { path: "/heat/",                d: "/resources/heat-policy/" },
  { path: "/victory/",             d: "/fields/victory/" },
  { path: "/Schedule",             d: "/schedules/" },
  { path: "/4u-playground",        d: "/programs/preschool/" },
  { path: "/index.php",            d: "/" },
  { path: "/extra/",               d: "/programs/extra/" },
  // Tier-2 entries that should be fixed by the Worker
  { path: "/Coach",                d: "/coaches/" },
  { path: "/Coach/",               d: "/coaches/" },
  { path: "/board",                d: "/about/leadership/" },
  // 2026-05-18 additions from CF 404 log
  { path: "/contactus",            d: "/contact/" },
  { path: "/wp-content/uploads/NEWS_114.png",  d: "/resources/newsletters/" },
  { path: "/wp-content/uploads/2022/03/January_2016.pdf",  d: "/about/board-minutes/" },
  { path: "/wp-content/uploads/2022/03/20211007-AYSO-Board-Meeting.pdf",  d: "/about/board-minutes/" },
  { path: "/tournament-volunteer-signup/",  d: "/volunteers/" },
  { path: "/login",                d: "https://ayso13.inleague.com/app/welcome" },
];

const splatCases = [
  { path: "/author/anyone",                    d: "/about/" },
  { path: "/maps/region-13-map2/",             d: "/fields/" },
  { path: "/new/foo/bar.html",                 d: "/" },
];

let pass = 0, fail = 0;

function lookup(path) {
  if (EXACT[path]) return EXACT[path].d;
  for (const r of SPLAT) {
    if (new RegExp(r.re).test(path)) return r.d;
  }
  return null;
}

for (const c of [...cases, ...splatCases]) {
  const actual = lookup(c.path);
  if (actual === c.d) {
    pass++;
    console.log(`  PASS  ${c.path} -> ${actual}`);
  } else {
    fail++;
    console.log(`  FAIL  ${c.path}: expected ${c.d}, got ${actual || "(no match)"}`);
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
console.log(`Map has ${Object.keys(EXACT).length} exact + ${SPLAT.length} splat rules`);
if (fail > 0) process.exit(1);
