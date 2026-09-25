import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  SOCCER_NEWS_LIST_ID, pacificDate, retentionCutoff, isArchived,
  cleanTitle, slugify, assignSlugs, cleanHtml,
} from "./newsletters.mjs";

const SAMPLE = fs.readFileSync(new URL("./fixtures/newsletter-sample.html", import.meta.url), "utf8");
const LEGACY = fs.readFileSync(new URL("./fixtures/newsletter-legacy.html", import.meta.url), "utf8");

test("pacificDate uses the Pacific calendar day, not UTC", () => {
  assert.equal(pacificDate("2026-01-01T05:30:00+00:00"), "2025-12-31");
  assert.equal(pacificDate("2026-09-16T19:00:00+00:00"), "2026-09-16");
});

test("retentionCutoff: floor holds through 2027, then rolls", () => {
  assert.equal(retentionCutoff(new Date("2026-09-24T12:00:00Z")), "2026-01-01");
  assert.equal(retentionCutoff(new Date("2027-06-01T12:00:00Z")), "2026-01-01");
  assert.equal(retentionCutoff(new Date("2028-01-02T12:00:00Z")), "2027-01-01");
  // 2028-01-01 04:00 UTC is still Dec 31 2027 in Pacific time
  assert.equal(retentionCutoff(new Date("2028-01-01T04:00:00Z")), "2026-01-01");
});

test("isArchived keeps only sent Soccer News campaigns inside the window", () => {
  const base = { status: "sent", to: [SOCCER_NEWS_LIST_ID], sent_at: "2026-09-16T19:00:00+00:00" };
  assert.equal(isArchived(base, "2026-01-01"), true);
  assert.equal(isArchived({ ...base, status: "draft", sent_at: null }, "2026-01-01"), false);
  assert.equal(isArchived({ ...base, to: ["0e8a6c1c-da9f-11ef-a626-c9b982b31e9a"] }, "2026-01-01"), false);
  assert.equal(isArchived({ ...base, sent_at: "2025-12-13T19:00:00+00:00" }, "2026-01-01"), false);
  assert.equal(isArchived({ ...base, sent_at: "2026-01-01T05:30:00+00:00" }, "2026-01-01"), false);
  assert.equal(isArchived({ ...base, to: undefined }, "2026-01-01"), false);
});

test("cleanTitle strips emoji and flags but keeps trademark symbols", () => {
  assert.equal(cleanTitle("⚽ Week 2 News & Info"), "Week 2 News & Info");
  assert.equal(cleanTitle("⚽ 🇺🇸 I BELIEVE THAT WE WILL WIN!"), "I BELIEVE THAT WE WILL WIN!");
  assert.equal(cleanTitle("🌧️⚽ Week 11 Rain Update"), "Week 11 Rain Update");
  assert.equal(cleanTitle("Sunday EXTRA™ Skills ©2026 ®"), "Sunday EXTRA™ Skills ©2026 ®");
  assert.equal(cleanTitle("  ⚽  "), "Newsletter");
  assert.equal(cleanTitle(undefined), "Newsletter");
});

test("slugify is lowercase ascii, never empty, capped at 60 chars", () => {
  assert.equal(slugify("Week 2 News & Info"), "week-2-news-info");
  assert.equal(slugify("It's the Rose City Rollout!"), "its-the-rose-city-rollout");
  assert.equal(slugify("Café Día"), "cafe-dia");
  assert.equal(slugify("Newsletter"), "newsletter");
  assert.equal(slugify("!!!"), "newsletter");
  assert.equal(slugify("Coach’s Corner"), "coachs-corner");
  const long = slugify("a".repeat(40) + " " + "b".repeat(40));
  assert.ok(long.length <= 60 && !long.endsWith("-"));
});

test("assignSlugs dates by Pacific day, dedupes in send order, returns newest first", () => {
  const out = assignSlugs([
    { id: "c", title: "Week 3", sentAt: "2026-09-24T19:00:00+00:00", date: "2026-09-24" },
    { id: "a", title: "Same", sentAt: "2026-09-16T18:00:00+00:00", date: "2026-09-16" },
    { id: "b", title: "Same", sentAt: "2026-09-16T20:00:00+00:00", date: "2026-09-16" },
  ]);
  assert.deepEqual(out.map((e) => [e.id, e.slug]), [
    ["c", "2026-09-24-week-3"],
    ["b", "2026-09-16-same-2"],
    ["a", "2026-09-16-same"],
  ]);
});

test("cleanHtml removes preheader, footer and badge, keeps content", () => {
  const out = cleanHtml(SAMPLE);
  assert.ok(out.includes("WEEK 2 SAMPLE CONTENT"));
  assert.ok(out.includes("VISIBLE OUTSIDE OUTLOOK"));
  assert.ok(!out.includes("You received this email"));
  assert.ok(!out.includes("Powered by EmailOctopus"));
  assert.ok(!/\{\{|\{%/.test(out));
  assert.ok(out.trimEnd().endsWith("</body></html>"));
  // table structure stays balanced
  const opens = (out.match(/<tr\b/g) || []).length;
  const closes = (out.match(/<\/tr>/g) || []).length;
  assert.equal(opens, closes);
});

test("cleanHtml throws on an unfilled personalization tag", () => {
  const html = SAMPLE.replace("WEEK 2 SAMPLE CONTENT", "Hi {{FirstName}}");
  assert.throws(() => cleanHtml(html), /\{\{FirstName\}\}/);
});

test("cleanHtml throws when the footer marker is missing", () => {
  const html = SAMPLE.replace("<!-- Footer -->", "");
  assert.throws(() => cleanHtml(html), /UnsubscribeURL/);
});

test("cleanHtml removes the legacy preheader div", () => {
  const out = cleanHtml(LEGACY);
  assert.ok(!out.includes("{{PreviewText}}"));
  assert.ok(!out.includes("spring-soccer.jpg"));
  assert.ok(out.includes("LEGACY CONTENT"));
});

test("cleanHtml removes the legacy footer and sender line", () => {
  const out = cleanHtml(LEGACY);
  assert.ok(out.includes("LEGACY CONTENT"));
  assert.ok(!/\{\{|\{%/.test(out));
  assert.ok(!out.includes("View in browser"));
  assert.ok(!out.includes("You are receiving"));
  assert.ok(out.trimEnd().endsWith("</body></html>"));
});

test("cleanHtml removes the legacy footer and sender line (sentence wrapped in <p>)", () => {
  const html = LEGACY.replace(
    '<br><p><br></p>You are receiving this message because of your involvement with AYSO Region 13, {{SenderInfoLine}} <p></p>',
    '<p>You are receiving this message because of your involvement with AYSO Region 13, {{SenderInfoLine}} </p>',
  );
  const out = cleanHtml(html);
  assert.ok(out.includes("LEGACY CONTENT"));
  assert.ok(!/\{\{|\{%/.test(out));
  assert.ok(!out.includes("View in browser"));
  assert.ok(!out.includes("You are receiving"));
  assert.ok(out.trimEnd().endsWith("</body></html>"));
});

test('cleanHtml removes the "view in browser" block', () => {
  const WEB_VERSION_BLOCK = '<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" eo-block="text" bgcolor=""> <tbody> <tr> <td class="container" style="padding: 10px 5px;"> <div class="text-block fr-inner" style="line-height: 1.25;"><div style="text-align: center;"><a target="_blank" rel="noopener noreferrer nofollow" href="{{WebVersionURL}}"><span style="font-size: 12px;"><strong>View this email in your browser</strong></span></a></div></div> </td> </tr> </tbody> </table>';
  const html = SAMPLE.replace('<td valign="top">', `<td valign="top">${WEB_VERSION_BLOCK}`);
  const out = cleanHtml(html);
  assert.ok(!/\{\{|\{%/.test(out));
  assert.ok(!out.includes("View this email in your browser"));
  assert.ok(out.includes("WEEK 2 SAMPLE CONTENT"));
  const opens = (out.match(/<table\b/g) || []).length;
  const closes = (out.match(/<\/table>/g) || []).length;
  assert.equal(opens, closes);
});
