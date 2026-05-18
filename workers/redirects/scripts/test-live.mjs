#!/usr/bin/env node
// Test every redirect rule against the live production site.
// Issues a HEAD request, checks for 301, and verifies Location header
// matches the expected destination (origin preserved for internal
// paths). Runs with bounded concurrency.
//
// Usage:
//   node scripts/test-live.mjs                  # default: www.ayso13.org
//   node scripts/test-live.mjs https://staging.ayso13.org

import { EXACT, SPLAT } from "../src/map.js";

const HOST = process.argv[2] || "https://www.ayso13.org";
const CONCURRENCY = 20;

// Build test cases.
const cases = [];

// Exact rules — one case per source path.
for (const [path, rule] of Object.entries(EXACT)) {
  cases.push({ path, expectedDest: rule.d, expectedStatus: rule.s, kind: "exact" });
}

// Splat rules — synthesize a concrete sample path that matches each pattern.
for (const rule of SPLAT) {
  // Convert "^/some/path/(.*)$" to a test path by replacing (.*) with "test".
  const samplePath = rule.re.replace(/^\^/, "").replace(/\$$/, "").replace(/\(\.\*\)/, "splat-test");
  const expectedDest = rule.d.includes("$1") ? rule.d.replace("$1", "splat-test") : rule.d;
  cases.push({ path: samplePath, expectedDest, expectedStatus: rule.s, kind: "splat" });
}

console.log(`Testing ${cases.length} redirect cases against ${HOST} ...`);
console.log(`Concurrency: ${CONCURRENCY}`);

// Bounded-concurrency queue.
const results = [];
let cursor = 0;
let pass = 0;
let fail = 0;

async function worker() {
  while (true) {
    const idx = cursor++;
    if (idx >= cases.length) return;
    const c = cases[idx];
    try {
      const res = await fetch(HOST + c.path, {
        method: "HEAD",
        redirect: "manual",
      });
      const status = res.status;
      const location = res.headers.get("location");

      // Compute expected absolute Location for comparison.
      let expectedLocation;
      if (/^https?:\/\//i.test(c.expectedDest)) {
        expectedLocation = c.expectedDest;
      } else {
        expectedLocation = HOST + c.expectedDest;
      }

      const statusOK = status === c.expectedStatus;
      const locOK = location === expectedLocation;

      if (statusOK && locOK) {
        pass++;
      } else {
        fail++;
        results.push({
          path: c.path,
          kind: c.kind,
          expectedStatus: c.expectedStatus,
          expectedLocation,
          actualStatus: status,
          actualLocation: location,
        });
      }
    } catch (err) {
      fail++;
      results.push({
        path: c.path,
        kind: c.kind,
        error: err.message,
      });
    }
  }
}

const start = Date.now();
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
const elapsed = ((Date.now() - start) / 1000).toFixed(1);

console.log(`\nDone in ${elapsed}s`);
console.log(`  ${pass} passed`);
console.log(`  ${fail} failed`);

if (fail > 0) {
  console.log("\nFailures (first 30):");
  for (const r of results.slice(0, 30)) {
    if (r.error) {
      console.log(`  ${r.path}  [${r.kind}]  ERROR: ${r.error}`);
    } else {
      console.log(`  ${r.path}  [${r.kind}]`);
      console.log(`    expected: ${r.expectedStatus} -> ${r.expectedLocation}`);
      console.log(`    actual:   ${r.actualStatus} -> ${r.actualLocation || "(no location)"}`);
    }
  }
  if (results.length > 30) console.log(`  ... and ${results.length - 30} more`);
  process.exit(1);
}
