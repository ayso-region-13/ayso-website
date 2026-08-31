import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldIgnoreReport, IGNORED_HOSTS } from "./ignore.js";

const report = (blocked) => ({ "csp-report": { "blocked-uri": blocked } });

test("drops the verified-benign doubleclick beacon", () => {
  // Real URL shape, taken verbatim from the KV store on 2026-08-31.
  assert.equal(shouldIgnoreReport(report(
    "https://stats.g.doubleclick.net/g/collect?v=2&ngs=1&ibt=1&tid=G-9YM9ZDW1J9&cid=1595284274.1756596944&npa=0"
  )), true);
  assert.equal(shouldIgnoreReport(report("https://stats.g.doubleclick.net/")), true);
});

test("keeps everything else, including near-misses on the ignored host", () => {
  for (const u of [
    "https://us.i.posthog.com/i/v0/e/",
    "https://us-assets.i.posthog.com/static/array.js",
    "https://connect.facebook.net/en_US/fbevents.js",  // deliberately NOT ignored
    "https://doubleclick.net/g/collect",               // different host
    "https://evil.com/?x=stats.g.doubleclick.net",     // host is evil.com
    "https://stats.g.doubleclick.net.evil.com/x",      // suffix attack
  ]) {
    assert.equal(shouldIgnoreReport(report(u)), false, u);
  }
});

test("keeps non-URL blocked-uri values", () => {
  for (const v of ["eval", "inline", "data", "self", ""]) {
    assert.equal(shouldIgnoreReport(report(v)), false, JSON.stringify(v));
  }
});

test("keeps anything with an unrecognised shape rather than dropping it", () => {
  for (const v of [null, undefined, {}, "raw string body", { body: { blockedURL: "https://stats.g.doubleclick.net/x" } }]) {
    assert.equal(shouldIgnoreReport(v), false, JSON.stringify(v));
  }
});

test("the ignore list stays deliberately small", () => {
  assert.equal(IGNORED_HOSTS.size, 1);
});
