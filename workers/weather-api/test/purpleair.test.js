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
