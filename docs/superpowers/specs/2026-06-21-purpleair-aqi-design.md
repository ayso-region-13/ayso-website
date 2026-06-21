# Spec — Replace AirNow with PurpleAir for local AQI

**Date:** 2026-06-21
**Component:** `workers/weather-api/` (Cloudflare Worker powering `/resources/weather/`, `/temp`, the AQI closure notifier)
**Status:** design approved, pending spec review

## Context

The weather Worker currently sources Air Quality from **AirNow** (EPA reporting-area feed) via `fetchAirNow()` → `airAdvisory()`, which returns an `airQuality` block in the `/api/weather` envelope. AirNow gives a single regional reading ("W San Gabriel Vly") that can be miles from our fields.

We want **better-quality, hyper-local readings** by compositing several **PurpleAir** sensors near our field clusters (Pasadena / Altadena / La Cañada). PurpleAir publishes raw PM2.5 from a dense low-cost sensor network; readings near our actual playing fields better reflect what kids breathe than a distant reporting area.

Confirmed from PurpleAir docs: the API returns **raw PM2.5, not AQI** ("AQIs and conversions can be locally calculated"), supports **multiple sensors in one call** (`/v1/sensors`, no sensor limit), and grants **1,000,000 points** on signup. So we compute AQI ourselves and batch all sensors into one request per tick.

## Goals

- PurpleAir composite becomes the **primary** AQI source; AQI on `/resources/weather/`, `/temp`, the alert banner, and the closure notifier all reflect it.
- **Keep AirNow as a fallback** so the AQI card never goes blank if all PurpleAir sensors are stale/offline.
- Match official AQI by applying the **US EPA PurpleAir correction** before computing AQI.
- **Credit-frugal:** one batched `/v1/sensors` call per existing 5-min cron, minimal fields, a small curated sensor list.
- **No downstream changes:** keep the existing `airQuality` envelope shape so the page, `/temp`, simulate modes, the `/api/weather` self-test, and the Slack closure notifier work unchanged.

## Non-goals

- No change to the closure threshold (stays **AQI > 150**, per `/resources/air-quality-policy/`).
- No new UI/page (optional copy tweak only — see §9).
- No historical AQI / charts. No bounding-box discovery (curated list only).
- Not removing AirNow (it remains the fallback; its own 2026-09-30 endpoint migration still applies).

## Architecture

A single new source function plus pure helpers in `workers/weather-api/src/index.js`, wired into `refresh()` ahead of the existing AirNow path. The `airQuality` envelope is produced by whichever source wins, in the **same shape** as today.

```
refresh()
  └─ fetchAirQuality(env)                     ← NEW orchestrator
       ├─ try PurpleAir:
       │    fetchPurpleAir(env) → rows
       │    purpleAirAdvisory(rows, env, now) → envelope | null
       │    if envelope usable (numeric aqi) → return it   (source: PurpleAir)
       └─ else AirNow (existing):
            fetchAirNow(env) → airAdvisory()  → envelope   (source: AirNow / EPA)
  (logs: "AQI served by purpleair (N sensors)" | "AQI served by airnow")
```

### Components (each unit independently testable)

| Function | Purpose | Depends on |
|---|---|---|
| `fetchPurpleAir(env)` | one `GET /v1/sensors` call; parse `{fields,data}` → array of `{sensorIndex, name, pm2_5_cf1, humidity, confidence, lastSeen}` | `fetch`, `PURPLEAIR_READ_KEY`, `PURPLEAIR_SENSOR_IDS` |
| `epaCorrect(pmCf1, rh)` | US EPA PurpleAir correction → corrected µg/m³ (pure) | — |
| `pm25ToAqi(pm)` | EPA breakpoint table → integer AQI (pure) | — |
| `aqiCategory(aqi)` | AQI → category name (pure) | — |
| `compositePm25(rows, {minConfidence, staleSeconds, nowSec})` | filter + median of corrected values → `{pm, sensorCount, freshestSec}` or null (pure) | `epaCorrect` |
| `purpleAirAdvisory(rows, env, nowSec)` | compose the `airQuality` envelope from the composite | the above |
| `fetchAirQuality(env)` | source orchestrator (PurpleAir → AirNow fallback) | both source paths |

## Data flow / API call

```
GET https://api.purpleair.com/v1/sensors
      ?fields=pm2.5_cf_1,humidity,confidence,last_seen,name
      &show_only=<PURPLEAIR_SENSOR_IDS>      (CSV of sensor indices)
      &location_type=0                        (outdoor only)
Headers: X-API-Key: <PURPLEAIR_READ_KEY>
```

Response: `{ api_version, time_stamp, fields: ["sensor_index","pm2.5_cf_1","humidity","confidence","last_seen","name"], data: [[...],[...]] }`. Parse by zipping `fields` → each `data` row (do **not** assume column order beyond what `fields` reports).

## The math (frozen so implementation is unambiguous)

**EPA correction** (Barkjohn 2021, the PurpleAir-map "US EPA" conversion), 2-piece for wildfire high range:
- `PA < 343`: `corrected = 0.524 · pm2.5_cf_1 − 0.0862 · humidity + 5.75`
- `PA ≥ 343`: `corrected = 0.46 · pm2.5_cf_1 + 3.93e-4 · pm2.5_cf_1² + 2.97`
- Clamp result to `≥ 0`.

**EPA AQI breakpoints (PM2.5, 2024 update — matches current AirNow).** Truncate PM2.5 to 0.1 µg/m³, then linear-interpolate `AQI = (Ah−Al)/(Ch−Cl)·(C−Cl)+Al`:

| PM2.5 (µg/m³) | AQI | Category |
|---|---|---|
| 0.0–9.0 | 0–50 | Good |
| 9.1–35.4 | 51–100 | Moderate |
| 35.5–55.4 | 101–150 | Unhealthy for Sensitive Groups |
| 55.5–125.4 | 151–200 | Unhealthy |
| 125.5–225.4 | 201–300 | Very Unhealthy |
| 225.5–325.4 | 301–500 | Hazardous |
| > 325.4 | 500 (capped) | Hazardous |

**Composite:** **median** of the per-sensor corrected values across valid sensors (robust to one bad sensor). AQI is computed from the composite PM2.5.

## Quality filtering

Drop a sensor before compositing if any:
- `last_seen` older than `PURPLEAIR_STALE_SECONDS` (default **3600**) relative to now,
- `confidence` < `PURPLEAIR_MIN_CONFIDENCE` (default **70**) — PurpleAir's channel-A/B agreement score,
- `pm2.5_cf_1` or `humidity` missing/non-numeric.

`location_type=0` excludes indoor sensors server-side. If **0 valid sensors remain**, `compositePm25` returns null → `purpleAirAdvisory` returns null → `fetchAirQuality` falls back to AirNow.

## Output envelope (unchanged shape)

`purpleAirAdvisory` returns exactly the keys `airAdvisory` returns, so nothing downstream changes:

```jsonc
{
  "aqi": 42,
  "category": "Good",
  "dominantPollutant": "PM2.5",          // PurpleAir measures PM2.5 only
  "reportingArea": "Region 13 area (PurpleAir)",
  "observedAt": "2026-06-21 14:00 PT",   // freshest contributing sensor, Pacific; matches the page's formatAqiObserved parser
  "thresholdAqi": 150,
  "closureRecommended": false,            // aqi > 150
  "reason": null,                          // or "AQI 175 (Unhealthy) — above the 150 closure threshold"
  "source": "PurpleAir (EPA-corrected, 4 sensors)",
  "sensorCount": 4                         // NEW, additive; optional card subtext
}
```

## Configuration

`wrangler.toml [vars]`:
- `PURPLEAIR_SENSOR_IDS` — CSV of curated outdoor sensor indices (see §sensor curation)
- `PURPLEAIR_MIN_CONFIDENCE` = `"70"`
- `PURPLEAIR_STALE_SECONDS` = `"3600"`

Secret: `PURPLEAIR_READ_KEY` (`wrangler secret put`, on the weather-api worker). `AIRNOW_API_KEY` stays (fallback).

## Sensor curation (one-time, user-approved)

Pick ~4–6 **outdoor** PurpleAir sensors spread across the field clusters — Rose Bowl/Brookside, central Pasadena, La Cañada — from the public PurpleAir map, preferring sensors with high confidence and recent data. List the indices + names + approx location for approval, then set `PURPLEAIR_SENSOR_IDS`. (Selection uses the public map / a one-off query, not recurring credits.)

## Testing

`node --test` in `workers/weather-api/` (existing harness), pure-function coverage:
- `epaCorrect`: low-range + high-range (>343) + clamp-to-0.
- `pm25ToAqi`: each breakpoint boundary (9.0→50, 9.1→51, 35.4→100, 55.5→151, etc.) + cap.
- `aqiCategory`: each band boundary.
- `compositePm25`: median of N; drops stale/low-confidence/missing; returns null when none valid.
- `purpleAirAdvisory`: full envelope from a mocked `/v1/sensors` `{fields,data}` payload incl. closure (>150) and the null/fallback case.
- AirNow fallback path still covered by existing tests.

Live verification (staging worker + `wrangler tail`): confirm `AQI served by purpleair (N sensors)` on a cron tick and that `/api/weather` `airQuality` is populated and sane vs the PurpleAir map; force a fallback (bad sensor IDs) and confirm AirNow takes over.

## Credits

One batched call/tick, 5 fields × ~5 sensors, 288 ticks/day ≈ low thousands of points/day → well within 1M. Real-time fields cost more than averaged, but the volume is tiny. `show_only` (fixed list) avoids bounding-box over-fetch.

## Rollout

Build + test on the `weather-api` worker; deploy to staging-bound worker first (it serves both domains from one deployment, so validate via `/api/weather` + tail), then it's already prod. Prerequisite: PurpleAir account + read key + the curated sensor list. Rollback: PurpleAir failing simply falls back to AirNow; to fully revert, point `fetchAirQuality` back at AirNow-only.

## Open / optional

- §9 copy: mention "local PurpleAir sensor network" on `/resources/air-quality-policy/` and as card subtext ("average of N nearby sensors"). Optional, low priority.
- Field choice is real-time `pm2.5_cf_1`; if the reading is too jumpy tick-to-tick, switch to an averaged field (e.g. `pm2.5_60minute`) later — isolated to `fetchPurpleAir`'s `fields=` + the parse.
