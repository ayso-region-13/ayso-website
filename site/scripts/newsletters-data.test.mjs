import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const loadNewsletters = require("../src/_data/newsletters.js");
const { splitEmail } = loadNewsletters;

const SAMPLE = fs.readFileSync(new URL("./lib/fixtures/newsletter-sample.html", import.meta.url), "utf8");
const LEGACY = fs.readFileSync(new URL("./lib/fixtures/newsletter-legacy.html", import.meta.url), "utf8");

test("splitEmail keeps head styles but drops Outlook-only conditional styles", () => {
  const { styles } = splitEmail(SAMPLE);
  assert.match(styles, /-webkit-font-smoothing/);
  assert.match(styles, /v3-editor-styles/);
  assert.doesNotMatch(styles, /sans-serif !important/);
});

test("splitEmail keeps body conditional-comment content visible to browsers", () => {
  const { body } = splitEmail(SAMPLE);
  assert.match(body, /WEEK 2 SAMPLE CONTENT/);
  assert.match(body, /VISIBLE OUTSIDE OUTLOOK/);
  assert.doesNotMatch(body, /<\/?body/);
});

test("splitEmail returns the body style attribute as-is (already entity-escaped)", () => {
  assert.match(splitEmail(SAMPLE).bodyStyle, /&quot;Helvetica Neue&quot;/);
});

test("splitEmail throws on a document with no body", () => {
  assert.throws(() => splitEmail("<html><head></head></html>"), /no <body>/);
});

test("splitEmail on the legacy fixture returns a non-empty body and empty bodyStyle without throwing", () => {
  const { body, bodyStyle } = splitEmail(LEGACY);
  assert.equal(bodyStyle, "");
  assert.ok(body.length > 0);
});

test("splitEmail tags every <img> in the body with eleventy:ignore (sample fixture)", () => {
  const { body } = splitEmail(SAMPLE);
  const imgCount = (body.match(/<img\b/gi) || []).length;
  const ignoredCount = (body.match(/<img eleventy:ignore/gi) || []).length;
  assert.ok(imgCount > 0, "fixture should contain at least one <img>");
  assert.equal(ignoredCount, imgCount);
});

test("splitEmail tags every <img> in the body with eleventy:ignore (legacy fixture)", () => {
  const { body } = splitEmail(LEGACY);
  const imgCount = (body.match(/<img\b/gi) || []).length;
  const ignoredCount = (body.match(/<img eleventy:ignore/gi) || []).length;
  assert.ok(imgCount > 0, "fixture should contain at least one <img>");
  assert.equal(ignoredCount, imgCount);
});

test("splitEmail flags legacy as false for the modern fixture (has class=\"document\")", () => {
  assert.equal(splitEmail(SAMPLE).legacy, false);
});

test("splitEmail flags legacy as true for the legacy fixture (no class=\"document\" wrapper)", () => {
  assert.equal(splitEmail(LEGACY).legacy, true);
});

test("loader returns the committed snapshot with display dates", () => {
  const list = loadNewsletters();
  assert.ok(Array.isArray(list));
  if (list.length) {
    const n = list[0];
    assert.match(n.year, /^\d{4}$/);
    assert.match(n.displayDate, /^[A-Z][a-z]+ \d{1,2}, \d{4}$/);
    assert.ok(n.body.length > 0);
  }
});
