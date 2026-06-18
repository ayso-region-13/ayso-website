// Unit tests for the pure decision logic behind the Slack notifiers.
// These cover the state-machine / dedup / throttle rules without any IO.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  closureTransition,
  diffAlertIds,
  rainForecastDecision,
  closureReasons,
  normalizeAirNow,
  airAdvisory,
  hasUsableAqi,
} from "../src/index.js";

const DAY = 24 * 60 * 60 * 1000;

// AirNow endpoint schemas (real samples) — old latLong/current vs new ziplatlong.
const OLD_ROW = {
  DateObserved: "2026-06-18", HourObserved: 10, LocalTimeZone: "PST",
  ReportingArea: "W San Gabriel Vly", ParameterName: "O3", AQI: 25,
  Category: { Number: 1, Name: "Good" },
};
const NEW_ROWS = [
  { dateObserved: "2026-06-18", hourObserved: "11:00", localTimeZone: "PDT", reportingAreaName: "W San Gabriel Vly", parameterName: "PM2.5", nowcastAQI: 57, aqiCategoryName: "Moderate" },
  { dateObserved: "2026-06-18", hourObserved: "11:00", localTimeZone: "PDT", reportingAreaName: "W San Gabriel Vly", parameterName: "OZONE", nowcastAQI: 24, aqiCategoryName: "Good" },
  { dateObserved: "2026-06-18", hourObserved: "11:00", localTimeZone: "PDT", reportingAreaName: "W San Gabriel Vly", parameterName: "PM10", nowcastAQI: 19, aqiCategoryName: "Good" },
];

test("normalizeAirNow parses the OLD endpoint schema", () => {
  const [r] = normalizeAirNow([OLD_ROW]);
  assert.equal(r.aqi, 25);
  assert.equal(r.parameter, "O3");
  assert.equal(r.categoryName, "Good");
  assert.equal(r.reportingArea, "W San Gabriel Vly");
  assert.equal(r.hour, 10);
  assert.equal(r.tz, "PST");
});

test("normalizeAirNow parses the NEW ziplatlong schema (nowcastAQI, camelCase, OZONE→O3)", () => {
  const rows = normalizeAirNow(NEW_ROWS);
  assert.equal(rows.length, 3);
  const ozone = rows.find((r) => r.parameter === "O3");
  assert.ok(ozone, "OZONE normalized to O3");
  assert.equal(ozone.aqi, 24);
  const pm = rows.find((r) => r.parameter === "PM2.5");
  assert.equal(pm.aqi, 57);
  assert.equal(pm.categoryName, "Moderate");
  assert.equal(pm.hour, 11); // "11:00" → 11
});

test("normalizeAirNow tolerates AQICategoryName (doc casing) + missing AQI rows", () => {
  const rows = normalizeAirNow([
    { parameterName: "PM2.5", nowcastAQI: 80, AQICategoryName: "Moderate", hourObserved: "09:00", dateObserved: "2026-06-18", localTimeZone: "PDT", reportingAreaName: "X" },
    { parameterName: "OZONE", aqiCategoryName: "Good" }, // no AQI → dropped
    null,
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].categoryName, "Moderate");
});

test("airAdvisory picks the highest-AQI pollutant (NEW schema → PM2.5 57)", () => {
  const a = airAdvisory(NEW_ROWS);
  assert.equal(a.aqi, 57);
  assert.equal(a.dominantPollutant, "PM2.5");
  assert.equal(a.category, "Moderate");
  assert.equal(a.observedAt, "2026-06-18 11:00 PDT");
  assert.equal(a.closureRecommended, false); // 57 < 150
  assert.equal(a.source, "AirNow / EPA");
});

test("airAdvisory flags closure when AQI > 150 (NEW schema)", () => {
  const a = airAdvisory([{ parameterName: "PM2.5", nowcastAQI: 175, aqiCategoryName: "Unhealthy", dateObserved: "2026-06-18", hourObserved: "12:00", localTimeZone: "PDT", reportingAreaName: "X" }]);
  assert.equal(a.aqi, 175);
  assert.equal(a.closureRecommended, true);
  assert.match(a.reason, /above the 150 closure threshold/);
});

test("airAdvisory / hasUsableAqi handle null + AQI-less responses", () => {
  assert.equal(airAdvisory(null).aqi, null);
  assert.equal(airAdvisory(null).source, null);
  assert.equal(hasUsableAqi(null), false);
  assert.equal(hasUsableAqi([]), false);
  assert.equal(hasUsableAqi([{ parameterName: "OZONE", aqiCategoryName: "Good" }]), false); // no numeric AQI
  assert.equal(hasUsableAqi(NEW_ROWS), true);
  assert.equal(hasUsableAqi([OLD_ROW]), true);
});

test("closureTransition posts only on edges", () => {
  // false → true = tripped
  let d = closureTransition(false, true, ["Heat"]);
  assert.equal(d.post, true);
  assert.equal(d.kind, "tripped");
  assert.deepEqual(d.reasons, ["Heat"]);

  // true → false = cleared
  d = closureTransition(true, false, []);
  assert.equal(d.post, true);
  assert.equal(d.kind, "cleared");

  // unchanged (both true) = no post
  assert.equal(closureTransition(true, true, ["Heat"]).post, false);

  // unchanged (both false) = no post
  assert.equal(closureTransition(false, false, []).post, false);
});

test("diffAlertIds computes new and ended sets", () => {
  const d = diffAlertIds(["a", "b"], ["b", "c"]);
  assert.deepEqual(d.newIds, ["c"]);
  assert.deepEqual(d.endedIds, ["a"]);

  // empty prev → everything is new
  assert.deepEqual(diffAlertIds([], ["x", "y"]).newIds, ["x", "y"]);
  // everything gone → all ended
  assert.deepEqual(diffAlertIds(["x"], []).endedIds, ["x"]);
  // null-safe
  assert.deepEqual(diffAlertIds(null, null), { newIds: [], endedIds: [] });
  // no change → both empty
  const same = diffAlertIds(["a"], ["a"]);
  assert.deepEqual(same.newIds, []);
  assert.deepEqual(same.endedIds, []);
});

test("rainForecastDecision finds the soonest period over threshold", () => {
  const periods = [
    { name: "This Afternoon", pop: 10, shortForecast: "Sunny" },
    { name: "Tonight", pop: 70, shortForecast: "Rain" },
    { name: "Tomorrow", pop: 90, shortForecast: "Rain" },
  ];
  const d = rainForecastDecision(periods, null, 60, 1_000_000);
  assert.equal(d.post, true);
  assert.equal(d.period.name, "Tonight"); // soonest, not highest
});

test("rainForecastDecision: nothing over threshold → no post", () => {
  const periods = [{ name: "Today", pop: 20 }, { name: "Tonight", pop: 30 }];
  assert.equal(rainForecastDecision(periods, null, 60, 0).post, false);
  // null/empty pops are ignored
  assert.equal(rainForecastDecision([{ name: "x", pop: null }], null, 60, 0).post, false);
});

test("rainForecastDecision throttles same period within 24h", () => {
  const periods = [{ name: "Tonight", pop: 80 }];
  const now = 10 * DAY;

  // Already alerted on "Tonight" 1h ago → suppressed
  const recent = { alertedPeriod: "Tonight", ts: now - 60 * 60 * 1000 };
  assert.equal(rainForecastDecision(periods, recent, 60, now).post, false);

  // Same period but >24h ago → re-post (refresh reminder)
  const stale = { alertedPeriod: "Tonight", ts: now - 2 * DAY };
  assert.equal(rainForecastDecision(periods, stale, 60, now).post, true);

  // Different period within 24h → post (new event)
  const other = { alertedPeriod: "Yesterday", ts: now - 60 * 60 * 1000 };
  assert.equal(rainForecastDecision(periods, other, 60, now).post, true);
});

test("rainForecastDecision only scans the next ~72h (6 periods)", () => {
  // Threshold-crossing period sits beyond the horizon → no post.
  const periods = Array.from({ length: 10 }, (_, i) => ({ name: "p" + i, pop: 0 }));
  periods[8].pop = 90; // 9th period, outside the 6-period window
  assert.equal(rainForecastDecision(periods, null, 60, 0).post, false);
});

test("closureReasons assembles the active reasons", () => {
  const payload = {
    wbgt: { level: 5 },
    rain: { closureRecommended: true, reason: "Heavy rain in past 48 hours (1.2\")" },
    airQuality: { closureRecommended: false, reason: null },
  };
  const reasons = closureReasons(payload);
  assert.equal(reasons.length, 2);
  assert.match(reasons[0], /Heat: WBGT at CIF Level 5/);
  assert.match(reasons[1], /Rain: Heavy rain/);

  // none active → empty
  assert.deepEqual(
    closureReasons({ wbgt: { level: 2 }, rain: { closureRecommended: false }, airQuality: { closureRecommended: false } }),
    []
  );
});
