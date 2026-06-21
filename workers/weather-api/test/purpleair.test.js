import { test } from "node:test";
import assert from "node:assert/strict";
import { epaCorrect, pm25ToAqi, aqiCategory } from "../src/index.js";

test("epaCorrect applies the low-range EPA formula + clamps to 0", () => {
  // 0.524*20 - 0.0862*50 + 5.75 = 11.92
  assert.ok(Math.abs(epaCorrect(20, 50) - 11.92) < 0.01);
  // negative result clamps to 0 (very low PA, high RH)
  assert.equal(epaCorrect(0, 100), Math.max(0, -0.0862 * 100 + 5.75));
  assert.equal(epaCorrect(null, 50), null);
  assert.equal(epaCorrect(20, null), null);
});

test("epaCorrect uses the high-range (>=343) piece", () => {
  // 0.46*400 + 3.93e-4*400^2 + 2.97 = 184 + 62.88 + 2.97 = 249.85
  assert.ok(Math.abs(epaCorrect(400, 30) - 249.85) < 0.1);
});

test("pm25ToAqi maps breakpoints (2024 EPA table)", () => {
  assert.equal(pm25ToAqi(0), 0);
  assert.equal(pm25ToAqi(9.0), 50);    // top of Good
  assert.equal(pm25ToAqi(9.1), 51);    // bottom of Moderate
  assert.equal(pm25ToAqi(35.4), 100);
  assert.equal(pm25ToAqi(55.5), 151);  // closure territory
  assert.equal(pm25ToAqi(325.4), 500);
  assert.equal(pm25ToAqi(500), 500);   // capped
  assert.equal(pm25ToAqi(null), null);
});

test("aqiCategory bands", () => {
  assert.equal(aqiCategory(42), "Good");
  assert.equal(aqiCategory(100), "Moderate");
  assert.equal(aqiCategory(150), "Unhealthy for Sensitive Groups");
  assert.equal(aqiCategory(175), "Unhealthy");
  assert.equal(aqiCategory(250), "Very Unhealthy");
  assert.equal(aqiCategory(400), "Hazardous");
});

import { parsePurpleAir, compositePm25 } from "../src/index.js";

const SAMPLE = {
  fields: ["sensor_index", "pm2.5_cf_1", "humidity", "confidence", "last_seen", "name"],
  data: [
    [101, 12.0, 50, 100, 1_000_000, "Rose Bowl"],
    [102, 18.0, 40, 95, 1_000_000, "Central Pas"],
    [103, 9000.0, 50, 20, 1_000_000, "Flaky"],     // low confidence → dropped
    [104, 15.0, 45, 99, 1, "Stale"],               // ancient last_seen → dropped
  ],
};

test("parsePurpleAir maps fields→rows by name (not column order)", () => {
  const rows = parsePurpleAir(SAMPLE);
  assert.equal(rows.length, 4);
  assert.equal(rows[0].sensorIndex, 101);
  assert.equal(rows[0].pmCf1, 12.0);
  assert.equal(rows[0].humidity, 50);
  assert.equal(rows[1].name, "Central Pas");
  assert.deepEqual(parsePurpleAir({}), []);
});

test("compositePm25 filters bad sensors + medians the EPA-corrected values", () => {
  const rows = parsePurpleAir(SAMPLE);
  const opts = { minConfidence: 70, staleSeconds: 3600, nowSec: 1_000_500 };
  const c = compositePm25(rows, opts);
  // only 101 and 102 survive. corrected: 101→0.524*12-0.0862*50+5.75=7.728;
  // 102→0.524*18-0.0862*40+5.75=11.734. median of 2 = mean = 9.731
  assert.equal(c.sensorCount, 2);
  assert.ok(Math.abs(c.pm - 9.731) < 0.01);
  assert.equal(c.freshestSec, 1_000_000);
});

test("compositePm25 returns null when no sensor is valid", () => {
  const opts = { minConfidence: 70, staleSeconds: 3600, nowSec: 9_999_999_999 };
  assert.equal(compositePm25(parsePurpleAir(SAMPLE), opts), null); // all stale
  assert.equal(compositePm25([], opts), null);
});

import { purpleAirAdvisory } from "../src/index.js";

const OPTS = { minConfidence: 70, staleSeconds: 3600, nowSec: 1_000_500, thresholdAqi: 150 };
const rowsGood = [
  { sensorIndex: 1, name: "A", pmCf1: 12, humidity: 50, confidence: 100, lastSeen: 1_000_000 },
  { sensorIndex: 2, name: "B", pmCf1: 18, humidity: 40, confidence: 95, lastSeen: 1_000_200 },
];

test("purpleAirAdvisory builds the airQuality envelope", () => {
  const a = purpleAirAdvisory(rowsGood, OPTS);
  assert.equal(a.dominantPollutant, "PM2.5");
  assert.equal(a.thresholdAqi, 150);
  assert.equal(a.closureRecommended, false);          // ~AQI 41 from pm 9.79
  assert.equal(a.sensorCount, 2);
  assert.match(a.source, /PurpleAir \(EPA-corrected, 2 sensors\)/);
  assert.match(a.observedAt, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2} PT$/); // page parser format
  assert.equal(a.reason, null);
});

test("purpleAirAdvisory flags closure when AQI > 150", () => {
  // pmCf1 ~120, RH 40 → corrected ~63 → AQI ~155 (Unhealthy) > 150
  const rows = [{ sensorIndex: 1, name: "A", pmCf1: 120, humidity: 40, confidence: 100, lastSeen: 1_000_000 }];
  const a = purpleAirAdvisory(rows, OPTS);
  assert.ok(a.aqi > 150);
  assert.equal(a.closureRecommended, true);
  assert.match(a.reason, /above the 150 closure threshold/);
});

test("purpleAirAdvisory returns null when no valid sensors (→ caller falls back)", () => {
  assert.equal(purpleAirAdvisory([], OPTS), null);
});
