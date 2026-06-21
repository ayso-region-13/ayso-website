# PurpleAir AQI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Source the `/api/weather` `airQuality` block from a composite of nearby PurpleAir sensors (EPA-corrected, AQI computed locally), with AirNow kept as an automatic fallback.

**Architecture:** Add pure helpers (EPA correction, PM2.5→AQI, parse, composite, advisory) + two thin IO functions (`fetchPurpleAir`, `fetchAirQuality`) to `workers/weather-api/src/index.js`. `refresh()` calls `fetchAirQuality(env)` which tries PurpleAir first and falls back to the existing `fetchAirNow`→`airAdvisory` path. The `airQuality` envelope shape is unchanged, so the weather page, `/temp`, simulate modes, the self-test, and the Slack closure notifier need no changes.

**Tech Stack:** Cloudflare Worker (ES modules), `node --test` (built-in), `wrangler`. No new dependencies.

## Global Constraints

- Closure threshold stays **AQI > 150** (`AQI_CLOSURE_THRESHOLD`, already defined at `src/index.js:423`). Do not change it.
- The `airQuality` envelope MUST keep these exact keys (consumed by the page/temp/notifier): `aqi, category, dominantPollutant, reportingArea, observedAt, thresholdAqi, closureRecommended, reason, source`. `sensorCount` is an ADDITIVE new key.
- `observedAt` MUST be a string matching the page parser `formatAqiObserved` regex `\d{4}-\d{2}-\d{2}\s+(\d{2}):(\d{2})` — i.e. `"YYYY-MM-DD HH:MM PT"` (24-hour).
- EPA correction (Barkjohn 2021), 2-piece: `PA<343 → 0.524·PA − 0.0862·RH + 5.75`; `PA≥343 → 0.46·PA + 3.93e-4·PA² + 2.97`; clamp `≥0`.
- EPA AQI PM2.5 breakpoints — **2024 update** (matches current AirNow): `[0.0–9.0→0–50], [9.1–35.4→51–100], [35.5–55.4→101–150], [55.5–125.4→151–200], [125.5–225.4→201–300], [225.5–325.4→301–500]`, `>325.4 → 500`. Truncate PM2.5 to 0.1 before interpolating.
- Composite = **median** of EPA-corrected per-sensor values.
- Test command (run from `workers/weather-api/`): `npm test` (= `node --test`). Tests live in `test/*.test.js`.
- Secrets/keys are never echoed in commands; set via `wrangler secret put`.

---

### Task 1: AQI math helpers

**Files:**
- Modify: `workers/weather-api/src/index.js` (add functions near the air-quality section, after `AQI_CLOSURE_THRESHOLD` at line 423; add to the `export {…}` at line 774)
- Test: `workers/weather-api/test/purpleair.test.js` (create)

**Interfaces:**
- Produces: `epaCorrect(pmCf1, rh) → number|null`; `pm25ToAqi(pm) → number|null` (integer AQI); `aqiCategory(aqi) → string|null`

- [ ] **Step 1: Write the failing test** — create `workers/weather-api/test/purpleair.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd workers/weather-api && npm test`
Expected: FAIL — `epaCorrect`/`pm25ToAqi`/`aqiCategory` are `undefined` (import error / not a function).

- [ ] **Step 3: Write minimal implementation** — in `src/index.js`, immediately after `const AQI_CLOSURE_THRESHOLD = 150;` (line 423):

```js
// ── PurpleAir AQI (local sensor composite) ─────────────────────────────
// PurpleAir returns raw PM2.5 (no AQI). We apply the US EPA PurpleAir
// correction (Barkjohn 2021) then the EPA AQI breakpoint table (2024).

function epaCorrect(pmCf1, rh) {
  if (typeof pmCf1 !== "number" || Number.isNaN(pmCf1)) return null;
  if (typeof rh !== "number" || Number.isNaN(rh)) return null;
  const corrected = pmCf1 < 343
    ? 0.524 * pmCf1 - 0.0862 * rh + 5.75
    : 0.46 * pmCf1 + 3.93e-4 * pmCf1 * pmCf1 + 2.97;
  return Math.max(0, corrected);
}

// EPA PM2.5 → AQI, 2024 breakpoints (matches current AirNow).
function pm25ToAqi(pm) {
  if (typeof pm !== "number" || Number.isNaN(pm)) return null;
  if (pm < 0) return 0;
  const c = Math.trunc(pm * 10) / 10; // truncate to 0.1 µg/m³ per EPA
  if (c > 325.4) return 500;
  const bp = [
    [0.0, 9.0, 0, 50],
    [9.1, 35.4, 51, 100],
    [35.5, 55.4, 101, 150],
    [55.5, 125.4, 151, 200],
    [125.5, 225.4, 201, 300],
    [225.5, 325.4, 301, 500],
  ];
  for (const [cl, ch, al, ah] of bp) {
    if (c >= cl && c <= ch) {
      return Math.round(((ah - al) / (ch - cl)) * (c - cl) + al);
    }
  }
  return 0;
}

function aqiCategory(aqi) {
  if (aqi == null) return null;
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Unhealthy for Sensitive Groups";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very Unhealthy";
  return "Hazardous";
}
```

Then add the three names to the export at the bottom (line ~774):

```js
export { closureTransition, diffAlertIds, rainForecastDecision, closureReasons, normalizeAirNow, airAdvisory, hasUsableAqi, epaCorrect, pm25ToAqi, aqiCategory };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd workers/weather-api && npm test`
Expected: PASS (all new tests; existing notify tests still pass).

- [ ] **Step 5: Commit**

```bash
git add workers/weather-api/src/index.js workers/weather-api/test/purpleair.test.js
git commit -m "weather-api: add EPA PurpleAir correction + PM2.5→AQI helpers"
```

---

### Task 2: Parse + composite

**Files:**
- Modify: `workers/weather-api/src/index.js` (add after the Task 1 helpers; extend the `export {…}`)
- Test: `workers/weather-api/test/purpleair.test.js` (append)

**Interfaces:**
- Consumes: `epaCorrect` (Task 1)
- Produces: `parsePurpleAir(json) → Array<{sensorIndex, name, pmCf1, humidity, confidence, lastSeen}>`; `compositePm25(rows, {minConfidence, staleSeconds, nowSec}) → {pm, sensorCount, freshestSec} | null`

- [ ] **Step 1: Write the failing test** — append to `test/purpleair.test.js`:

```js
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
  // only 101 and 102 survive. corrected: 101→0.524*12-0.0862*50+5.75=7.748;
  // 102→0.524*18-0.0862*40+5.75=11.834. median of 2 = mean = 9.791
  assert.equal(c.sensorCount, 2);
  assert.ok(Math.abs(c.pm - 9.791) < 0.01);
  assert.equal(c.freshestSec, 1_000_000);
});

test("compositePm25 returns null when no sensor is valid", () => {
  const opts = { minConfidence: 70, staleSeconds: 3600, nowSec: 9_999_999_999 };
  assert.equal(compositePm25(parsePurpleAir(SAMPLE), opts), null); // all stale
  assert.equal(compositePm25([], opts), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd workers/weather-api && npm test`
Expected: FAIL — `parsePurpleAir`/`compositePm25` undefined.

- [ ] **Step 3: Write minimal implementation** — in `src/index.js`, after the Task 1 helpers:

```js
function paNum(v) {
  return typeof v === "number" && !Number.isNaN(v) ? v : null;
}

function parsePurpleAir(json) {
  if (!json || !Array.isArray(json.fields) || !Array.isArray(json.data)) return [];
  const idx = {};
  json.fields.forEach((f, i) => { idx[f] = i; });
  const at = (row, key) => (idx[key] != null ? row[idx[key]] : undefined);
  return json.data.map((row) => ({
    sensorIndex: at(row, "sensor_index"),
    name: at(row, "name") ?? null,
    pmCf1: paNum(at(row, "pm2.5_cf_1")),
    humidity: paNum(at(row, "humidity")),
    confidence: paNum(at(row, "confidence")),
    lastSeen: paNum(at(row, "last_seen")),
  }));
}

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function compositePm25(rows, opts) {
  const { minConfidence, staleSeconds, nowSec } = opts;
  const corrected = [];
  let freshestSec = 0;
  for (const r of rows || []) {
    if (r.pmCf1 == null || r.humidity == null) continue;
    if (r.confidence == null || r.confidence < minConfidence) continue;
    if (r.lastSeen == null || nowSec - r.lastSeen > staleSeconds) continue;
    const c = epaCorrect(r.pmCf1, r.humidity);
    if (c == null) continue;
    corrected.push(c);
    if (r.lastSeen > freshestSec) freshestSec = r.lastSeen;
  }
  if (corrected.length === 0) return null;
  return { pm: median(corrected), sensorCount: corrected.length, freshestSec };
}
```

Extend the export with `parsePurpleAir, compositePm25`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd workers/weather-api && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add workers/weather-api/src/index.js workers/weather-api/test/purpleair.test.js
git commit -m "weather-api: parse PurpleAir /v1/sensors + median composite with quality filters"
```

---

### Task 3: purpleAirAdvisory (envelope)

**Files:**
- Modify: `workers/weather-api/src/index.js` (add after Task 2 helpers; extend export)
- Test: `workers/weather-api/test/purpleair.test.js` (append)

**Interfaces:**
- Consumes: `compositePm25`, `pm25ToAqi`, `aqiCategory` (Tasks 1–2)
- Produces: `purpleAirAdvisory(rows, {minConfidence, staleSeconds, nowSec, thresholdAqi}) → envelope | null`

- [ ] **Step 1: Write the failing test** — append:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd workers/weather-api && npm test`
Expected: FAIL — `purpleAirAdvisory` undefined.

- [ ] **Step 3: Write minimal implementation** — in `src/index.js`, after Task 2 helpers:

```js
// Format a unix-seconds timestamp as Pacific "YYYY-MM-DD HH:MM PT" — the
// shape the weather page's formatAqiObserved() parses.
function formatPacificStamp(epochSec) {
  if (!epochSec) return null;
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Los_Angeles",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(new Date(epochSec * 1000))
      .reduce((o, p) => { o[p.type] = p.value; return o; }, {});
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute} PT`;
  } catch (_) { return null; }
}

function purpleAirAdvisory(rows, opts) {
  const comp = compositePm25(rows, opts);
  if (!comp) return null;
  const aqi = pm25ToAqi(comp.pm);
  if (aqi == null) return null;
  const category = aqiCategory(aqi);
  const closureRecommended = aqi > opts.thresholdAqi;
  return {
    aqi,
    category,
    dominantPollutant: "PM2.5",
    reportingArea: "Region 13 area (PurpleAir)",
    observedAt: formatPacificStamp(comp.freshestSec),
    thresholdAqi: opts.thresholdAqi,
    closureRecommended,
    reason: closureRecommended
      ? `AQI ${aqi} (${category}) — above the ${opts.thresholdAqi} closure threshold`
      : null,
    source: `PurpleAir (EPA-corrected, ${comp.sensorCount} sensor${comp.sensorCount === 1 ? "" : "s"})`,
    sensorCount: comp.sensorCount,
  };
}
```

Extend export with `purpleAirAdvisory`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd workers/weather-api && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add workers/weather-api/src/index.js workers/weather-api/test/purpleair.test.js
git commit -m "weather-api: purpleAirAdvisory builds the airQuality envelope (same shape)"
```

---

### Task 4: Wire PurpleAir into refresh() with AirNow fallback

**Files:**
- Modify: `workers/weather-api/src/index.js` — add `fetchPurpleAir` + `fetchAirQuality` (after `fetchAirNow`, ~line 471); change `refresh()` (lines 102–115)

**Interfaces:**
- Consumes: `parsePurpleAir`, `purpleAirAdvisory` (Tasks 2–3), existing `fetchAirNow`, `airAdvisory`, `AQI_CLOSURE_THRESHOLD`
- Produces: `fetchAirQuality(env) → airQuality envelope` (PurpleAir primary, AirNow fallback)

- [ ] **Step 1: Add the IO functions** — in `src/index.js`, after `fetchAirNow` ends (~line 471):

```js
async function fetchPurpleAir(env) {
  const key = env.PURPLEAIR_READ_KEY;
  const ids = env.PURPLEAIR_SENSOR_IDS;
  if (!key || !ids) return null; // not configured → caller falls back to AirNow
  const url =
    "https://api.purpleair.com/v1/sensors" +
    "?fields=pm2.5_cf_1,humidity,confidence,last_seen,name" +
    `&show_only=${encodeURIComponent(ids)}&location_type=0`;
  try {
    const r = await fetch(url, { headers: { "X-API-Key": key } });
    if (!r.ok) { console.error(`PurpleAir HTTP ${r.status}`); return null; }
    return parsePurpleAir(await r.json());
  } catch (err) {
    console.error("PurpleAir fetch failed:", err.message);
    return null;
  }
}

// AQI source orchestrator: PurpleAir composite (primary) → AirNow (fallback).
async function fetchAirQuality(env) {
  const opts = {
    minConfidence: parseInt(env.PURPLEAIR_MIN_CONFIDENCE || "70", 10),
    staleSeconds: parseInt(env.PURPLEAIR_STALE_SECONDS || "3600", 10),
    nowSec: Math.floor(Date.now() / 1000),
    thresholdAqi: AQI_CLOSURE_THRESHOLD,
  };
  const rows = await fetchPurpleAir(env);
  if (rows) {
    const adv = purpleAirAdvisory(rows, opts);
    if (adv) { console.log(`AQI served by purpleair (${adv.sensorCount} sensors)`); return adv; }
    console.error("PurpleAir returned no usable sensors; falling back to AirNow");
  }
  console.log("AQI served by airnow (fallback)");
  return airAdvisory(await fetchAirNow(env));
}
```

- [ ] **Step 2: Rewire `refresh()`** — change the `Promise.all` (line 102–106): replace `fetchAirNow(env),` with `fetchAirQuality(env),` and rename the destructured `airNowObs` → `airQuality`:

```js
  const [tempestObs, nwsForecast, prevRainState, airQuality] = await Promise.all([
    fetchTempest(env),
    fetchNwsForecast(env),
    env.WEATHER_KV.get("rain:state", { type: "json" }),
    fetchAirQuality(env),
  ]);
```

Then DELETE the now-redundant line 115 `const airQuality = airAdvisory(airNowObs);` (the envelope now comes straight from `fetchAirQuality`). The existing `airQuality: airQuality,` and `closureRecommended: … airQuality.closureRecommended` lines in the payload stay as-is.

- [ ] **Step 3: Verify nothing else references `airNowObs`**

Run: `cd workers/weather-api && grep -n airNowObs src/index.js`
Expected: no output (all references removed).

- [ ] **Step 4: Syntax + full test suite**

Run: `cd workers/weather-api && node --check src/index.js && npm test`
Expected: `✓` syntax OK; all tests pass (PurpleAir pure-function tests + existing notify/airnow tests). `fetchAirQuality`/`fetchPurpleAir` are IO wrappers verified live in Task 6.

- [ ] **Step 5: Commit**

```bash
git add workers/weather-api/src/index.js
git commit -m "weather-api: fetchAirQuality — PurpleAir primary, AirNow fallback; wire into refresh()"
```

---

### Task 5: Config + README

**Files:**
- Modify: `workers/weather-api/wrangler.toml` (add `[vars]`)
- Modify: `workers/weather-api/README.md` (document the PurpleAir source + fallback + secret/vars)

**Interfaces:** none (config/docs)

- [ ] **Step 1: Add vars to `wrangler.toml`** — under the existing `[vars]` block:

```toml
# PurpleAir AQI (primary AQI source; AirNow is the fallback). See
# docs/superpowers/specs/2026-06-21-purpleair-aqi-design.md.
# PURPLEAIR_SENSOR_IDS: CSV of curated OUTDOOR sensor indices near our fields.
# PURPLEAIR_READ_KEY is a SECRET — set with `npx wrangler secret put PURPLEAIR_READ_KEY`.
PURPLEAIR_SENSOR_IDS = "REPLACE_WITH_CURATED_SENSOR_IDS"
PURPLEAIR_MIN_CONFIDENCE = "70"
PURPLEAIR_STALE_SECONDS = "3600"
```

- [ ] **Step 2: Document in `README.md`** — add a "PurpleAir (primary AQI)" note: one batched `GET /v1/sensors` per cron over `PURPLEAIR_SENSOR_IDS`, `X-API-Key: PURPLEAIR_READ_KEY`; EPA-corrected median composite → local AQI; falls back to AirNow when no sensor is usable; `source` field shows which served. List the new vars + the `PURPLEAIR_READ_KEY` secret.

- [ ] **Step 3: Validate config**

Run: `cd workers/weather-api && npx wrangler deploy --dry-run --outdir /tmp/pa-dry 2>&1 | grep -iE "env.PURPLEAIR|error" | head`
Expected: the three `env.PURPLEAIR_*` vars listed; no errors.

- [ ] **Step 4: Commit**

```bash
git add workers/weather-api/wrangler.toml workers/weather-api/README.md
git commit -m "weather-api: PurpleAir vars + README (read key secret, sensor list, thresholds)"
```

---

### Task 6: Sensor curation, secret, deploy, live verification

**Files:** `workers/weather-api/wrangler.toml` (fill in real sensor IDs)

**Interfaces:** none (operational)

> **Prerequisites (USER):** a PurpleAir account + **read** API key (free, 1M points). The curated sensor list is approved by the user before deploy.

- [ ] **Step 1: Curate sensors.** From the public PurpleAir map (map.purpleair.com), pick ~4–6 **outdoor** sensors with high confidence + recent data near the field clusters: Rose Bowl/Brookside, central Pasadena (e.g. near Victory/Allendale), La Cañada. Record each sensor_index + name + approx location. **Present the list to the user for approval.**

- [ ] **Step 2: Set the real sensor IDs** in `wrangler.toml` `PURPLEAIR_SENSOR_IDS` (CSV of approved indices). Commit:

```bash
git add workers/weather-api/wrangler.toml
git commit -m "weather-api: set curated PurpleAir sensor IDs"
```

- [ ] **Step 3: Set the read-key secret** (USER, or via `!` in session):

```bash
cd workers/weather-api && npx wrangler secret put PURPLEAIR_READ_KEY
```

- [ ] **Step 4: Deploy** (worker deploys via OAuth/CI per CLAUDE.md; serves both domains):

```bash
cd workers/weather-api && npm run deploy
```

- [ ] **Step 5: Live verify** — tail one cron tick and check the feed:

```bash
cd workers/weather-api && npx wrangler tail --format pretty   # watch for: AQI served by purpleair (N sensors)
curl -s https://www.ayso13.org/api/weather | python3 -c "import sys,json;d=json.load(sys.stdin);a=d['airQuality'];print(a['source'], a['aqi'], a['category'], a.get('sensorCount'), a['observedAt'])"
```
Expected: `source` starts with `PurpleAir (EPA-corrected, N sensors)`, a sane AQI vs the PurpleAir map, `observedAt` like `YYYY-MM-DD HH:MM PT`. Sanity-check the value is in the same ballpark as the PurpleAir map for those sensors.

- [ ] **Step 6: Verify fallback** — temporarily set `PURPLEAIR_SENSOR_IDS` to a bogus id, redeploy, confirm `source` becomes `AirNow / EPA` and AQI still populates; then restore the real IDs + redeploy.

- [ ] **Step 7: Commit any final wrangler.toml state** (real IDs restored) and update CLAUDE.md's weather-api entry to note PurpleAir is the primary AQI source (AirNow fallback).

---

## Self-Review

**Spec coverage:** §Architecture→Tasks 1–4; §math→Task 1 (Global Constraints frozen); §filtering→Task 2; §envelope→Task 3; §source priority/fallback→Task 4; §config→Task 5; §sensor curation + credits + rollout→Task 6; §testing→Tasks 1–3 (pure) + Task 6 (live). Downstream-unchanged guarantee: enforced by Task 3 producing the identical envelope keys + Task 4 not touching the payload assembly. Optional §9 copy tweak intentionally deferred (non-goal/optional).

**Placeholder scan:** `REPLACE_WITH_CURATED_SENSOR_IDS` is an intentional config placeholder filled in Task 6 Step 2 (gated on user approval), not a code gap. No TODO/TBD in code steps; all code shown in full.

**Type consistency:** `epaCorrect`, `pm25ToAqi`, `aqiCategory`, `parsePurpleAir`, `compositePm25` (`{pm,sensorCount,freshestSec}`), `purpleAirAdvisory` (envelope incl. `sensorCount`), `fetchPurpleAir`, `fetchAirQuality` — names/shapes consistent across tasks and exports. `airQuality` envelope keys match the existing `airAdvisory` output (verified against `src/index.js`).
