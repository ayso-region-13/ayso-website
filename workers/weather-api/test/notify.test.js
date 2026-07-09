// Unit tests for the pure decision logic behind the Slack notifiers.
// These cover the state-machine / dedup / throttle rules without any IO.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  closureNotifyDecision,
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

// Closure notifier: heat hysteresis + dwell debounce.
const CFG = { tripF: 89.7, clearF: 88.0, dwellMs: 15 * 60 * 1000 };
const MIN = 60 * 1000;
const fresh = { posted: false, heatActive: false, candidate: null, since: 0 };

test("closureNotifyDecision: sustained heat trip posts only after the dwell", () => {
  // t=0: crosses Level 5 → candidate starts, no post yet
  let d = closureNotifyDecision(fresh, { wbgtF: 90.0, reasons: ["Heat"] }, 0, CFG);
  assert.equal(d.post, false);
  assert.equal(d.state.candidate, true);
  assert.equal(d.state.heatActive, true);

  // t=10min: still within dwell → no post
  d = closureNotifyDecision(d.state, { wbgtF: 90.1, reasons: ["Heat"] }, 10 * MIN, CFG);
  assert.equal(d.post, false);

  // t=15min: dwell satisfied → tripped
  d = closureNotifyDecision(d.state, { wbgtF: 90.0, reasons: ["Heat"] }, 15 * MIN, CFG);
  assert.equal(d.post, true);
  assert.equal(d.kind, "tripped");
  assert.deepEqual(d.reasons, ["Heat"]);
  assert.equal(d.state.posted, true);
});

test("closureNotifyDecision: hysteresis holds active between clearF and tripF (no flap)", () => {
  // Already posted/active and heat active.
  const active = { posted: true, heatActive: true, candidate: null, since: 0 };
  // 89.0 is below the 89.7 trip but above the 88.0 clear → stays active, no clear candidate.
  const d = closureNotifyDecision(active, { wbgtF: 89.0, reasons: [] }, 100 * MIN, CFG);
  assert.equal(d.post, false);
  assert.equal(d.state.heatActive, true);
  assert.equal(d.state.candidate, null); // desired still true → no pending change
});

test("closureNotifyDecision: transient one-tick spike never posts", () => {
  // t=0: spike to Level 5 → candidate
  let d = closureNotifyDecision(fresh, { wbgtF: 90.0, reasons: ["Heat"] }, 0, CFG);
  assert.equal(d.post, false);
  // t=5min: drops below clearF → heat inactive, desired=false=posted → candidate cleared, no post
  d = closureNotifyDecision(d.state, { wbgtF: 86.0, reasons: [] }, 5 * MIN, CFG);
  assert.equal(d.post, false);
  assert.equal(d.state.candidate, null);
  assert.equal(d.state.posted, false);
});

test("closureNotifyDecision: clear requires dropping to clearF AND holding the dwell", () => {
  const active = { posted: true, heatActive: true, candidate: null, since: 0 };
  // t=0: falls to 87.5 (≤ clearF) → heat inactive, clear candidate starts
  let d = closureNotifyDecision(active, { wbgtF: 87.5, reasons: [] }, 0, CFG);
  assert.equal(d.post, false);
  assert.equal(d.state.candidate, false);
  // t=15min: still low → cleared
  d = closureNotifyDecision(d.state, { wbgtF: 87.0, reasons: [] }, 15 * MIN, CFG);
  assert.equal(d.post, true);
  assert.equal(d.kind, "cleared");
  assert.equal(d.state.posted, false);
});

test("closureNotifyDecision: rain closure trips (no hysteresis) but still respects dwell", () => {
  let d = closureNotifyDecision(fresh, { wbgtF: 70, rain: true, reasons: ["Rain"] }, 0, CFG);
  assert.equal(d.post, false);
  assert.equal(d.state.candidate, true);
  d = closureNotifyDecision(d.state, { wbgtF: 70, rain: true, reasons: ["Rain"] }, 15 * MIN, CFG);
  assert.equal(d.post, true);
  assert.equal(d.kind, "tripped");
});

test("closureNotifyDecision: missing WBGT holds the prior heat state", () => {
  const active = { posted: true, heatActive: true, candidate: null, since: 0 };
  const d = closureNotifyDecision(active, { wbgtF: null, reasons: [] }, 50 * MIN, CFG);
  assert.equal(d.state.heatActive, true); // held, not flipped
  assert.equal(d.post, false);
});

test("closureNotifyDecision: trip boundary matches the site (strictly > 89.7)", () => {
  // Exactly 89.7 is CIF Level 4 on the site → must NOT arm heat.
  let d = closureNotifyDecision(fresh, { wbgtF: 89.7, reasons: [] }, 0, CFG);
  assert.equal(d.state.heatActive, false);
  assert.equal(d.state.candidate, null); // no pending trip
  // 89.8 is Level 5 → arms and (after dwell) trips.
  d = closureNotifyDecision(fresh, { wbgtF: 89.8, reasons: ["Heat"] }, 0, CFG);
  assert.equal(d.state.heatActive, true);
  d = closureNotifyDecision(d.state, { wbgtF: 89.8, reasons: ["Heat"] }, 15 * MIN, CFG);
  assert.equal(d.post, true);
  assert.equal(d.kind, "tripped");
});

test("closureNotifyDecision: migrated rain closure (heatActive seeded false) clears once rain ends", () => {
  // Simulates post-upgrade state: old {active:true} (rain-caused) → posted:true,
  // heatActive:false. Rain has ended; WBGT sits in the 88–89.7 deadband.
  // heatActive must stay false (not latch), so the closure clears after dwell.
  const migrated = { posted: true, heatActive: false, candidate: null, since: 0 };
  let d = closureNotifyDecision(migrated, { wbgtF: 89.0, rain: false, aqi: false, reasons: [] }, 0, CFG);
  assert.equal(d.state.heatActive, false);
  assert.equal(d.state.candidate, false); // clear pending
  d = closureNotifyDecision(d.state, { wbgtF: 89.0, rain: false, reasons: [] }, 15 * MIN, CFG);
  assert.equal(d.post, true);
  assert.equal(d.kind, "cleared");
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
