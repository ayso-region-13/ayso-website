# ayso13-weather-api

Cloudflare Worker that powers the live data on `/resources/weather/`. Polls the Region 13 Tempest WeatherFlow station every 5 minutes, reads Wet Bulb Globe Temperature (WBGT) from the station's own `wet_bulb_globe_temperature` field and derives the corresponding California CIF heat-policy alert level (1–5), pulls a 7-day forecast from NWS for Victory Park, and serves a single normalized JSON envelope at `https://www.ayso13.org/api/weather`. See [WBGT](#wbgt) for why it is read rather than derived.

## Architecture

- **Cron trigger** (`*/5 * * * *`): refreshes the cached payload regardless of page traffic, then runs the Slack notifiers (below).
- **HTTP route** (`www.ayso13.org/api/weather`): serves the cached payload from KV. Cold-start safety: if KV is empty (first deploy or eviction), the fetch handler refreshes synchronously before responding so the page never sees a 404 / empty response. (The fetch path never sends Slack notifications — only the cron path does — so concurrent page loads can't double-post.)
- **KV namespace** (`WEATHER_KV`): single key `current` holds the latest envelope. A second key caches the resolved NWS forecast URL for the configured lat/lon. The notifiers keep their own state under `notify:heatWarn`, `notify:closure`, `notify:nwsAlerts`, and `notify:rainForecast`. The heat notifiers write those keys through `writeNotifyState()`, which skips the put when the serialized state is unchanged. That matters: their state is identical on almost every tick, KV writes are metered, and writing both unconditionally would have cost 576 no-op writes a day.

## Slack notifications

After each cron refresh, five independent notifiers post to **#notify-weather** via the shared AYSO Slack bot (`chat.postMessage`). Each keeps its own KV state so it posts only on a *change*, never every tick. A Slack failure is logged but can never break the weather feed (notifications run after the cache write, under `Promise.allSettled`).

| Notifier | Fires when | KV state |
|---|---|---|
| Level-4 heat advisory | WBGT crosses into CIF Level 4 (`> WBGT_WARN_TRIP_F`, 87.5) and again when it falls back under `WBGT_WARN_CLEAR_F` (86.0). Posts ahead of a closure so coaches get warning before the Level 5 suspension threshold. Same hysteresis + dwell machinery as the closure notice, one tier lower, and deliberately independent of it: the advisory stays latched through Level 5, so an escalation posts the closure notice without re-posting the advisory, and a drop from 5 back to 4 stays quiet. Seeds silently on first run (no state key), so a deploy during a hot afternoon does not announce heat that has been going for hours | `notify:heatWarn` |
| Closure threshold | `closureRecommended` transitions false→true (heat WBGT L5, rain >0.25"/48h or >1"/72h, or AQI > 150) and again true→false. The tripped notice names the driver(s) via `closureReasons(payload, heatActive)` — the heat line is built from the notifier's hysteresis-latched `heatActive` flag and the live WBGT °F value, so a closure that dipped into the 88–89.7°F deadband during the dwell still reads e.g. "Heat: WBGT 89.1°F — outdoor activity should be suspended" instead of a generic bullet | `notify:closure` |
| NWS active alerts **(OFF by default)** | a new alert appears at `api.weather.gov/alerts/active?point=LAT,LON`, or a tracked one ends (dedup by alert id) | `notify:nwsAlerts` |
| Rain forecast heads-up | any forecast period in the next ~72h has PoP ≥ `POP_FORECAST_THRESHOLD` (default 60); throttled to once per 24h per period | `notify:rainForecast` |

The **NWS active-alert notifier is disabled by default** (`NWS_ALERTS_ENABLED="false"` in `wrangler.toml` — it was too noisy in `#notify-weather`); when off, its fetch is skipped entirely. Set `NWS_ALERTS_ENABLED="true"` to resume it. When enabled, on first run with no baseline it seeds its state silently so a deploy during an active alert doesn't dump pre-existing alerts into the channel. The pure decision logic (`closureNotifyDecision`, `heatWarnDecision`, `diffAlertIds`, `rainForecastDecision`) is unit-tested — run `npm test`.

### Closure-notice debounce (Slack only)

The closure notice is debounced by `closureNotifyDecision` (pure, unit-tested). **This affects Slack only — `/resources/weather/` and `/temp` always show the true live level.** Two mechanisms, both needed:

- **Heat hysteresis.** Trips at WBGT `> WBGT_TRIP_F` (89.7, chosen to match `cif.level >= 5`) and clears only at `<= WBGT_CLEAR_F` (88.0). The 88.0–89.7 deadband is why `closureReasons` takes the latched `heatActive` flag rather than the live level.
- **Dwell.** `CLOSURE_DWELL_MINUTES` (15) must elapse before a transition posts, so a WBGT hovering on the boundary cannot flap the channel.

Without both, a reading oscillating around the threshold posts a closure and an all-clear every 5-minute tick.

### Why every card carries a "Reading as of" stamp

A closure card is a frozen snapshot, and it is not even the crossing value: the dwell means it posts up to `CLOSURE_DWELL_MINUTES` after the threshold was crossed, rendered from *that* tick's payload. On a hot morning WBGT can climb several degrees an hour (25 Aug 2026: air temp went 82.9°F at 09:00 to 92.5°F at 11:00), so by the time anyone reads the message the live page shows a different number. It looks like the two disagree; they don't, they are minutes apart.

So `contextLine()` prefixes every card's context row with `Reading as of 2:25 PM PT`, taken from the station's own observation time (`payloadAsOf` → `current.stationTimestamp`, falling back to `fetchedAt`). The segment is dropped rather than half-printed if no usable timestamp exists.

Two lesser contributors to the same confusion, both by design: the feed itself is up to 5 minutes old (5-min cron plus `max-age=300`), and neither `/resources/weather/` nor `/temp` auto-refreshes, so a tab left open freezes at whatever it loaded.

## Observation log (D1)

KV only ever holds "now" (a single `current` key, overwritten every tick), so
until this table existed the site had no history and "how many hours were we in
Level 4 last week" was unanswerable. `logObservation()` writes one row per
reading from `refresh()`.

**It cannot be backfilled.** Tempest exposes `wet_bulb_globe_temperature` only
on the *current* observation. Verified 25 Aug 2026:

- `observations/station/{id}` silently ignores `time_start` / `time_end` /
  `day_offset` / `bucket` and returns the current obs regardless.
- `observations/device/{id}` does honour a time range (1-minute resolution, at
  least 30 days back) but carries raw sensor fields only, no WBGT.
- `stats/station/{id}` has daily aggregates back years, with no WBGT at all.
- `better_forecast` gives current conditions only, rounded to whole °C.
- The Tempest site's own CSV export omits WBGT as well.

Deriving it is the one remaining route, and that is exactly the calculation
removed in July 2026 for reading 2 to 8.5°F too hot (see [WBGT](#wbgt)), so
backfilled levels would not match what the site published. History starts the
day this shipped.

`observed_at` is the station's own observation time in unix seconds and is the
primary key, with `ON CONFLICT DO NOTHING`, so a double cron fire or a
cold-start `fetch()` refresh in the same window is idempotent rather than a
duplicate row. A D1 failure is caught and logged: the log is analytics, the feed
is the product.

Volume is negligible: 288 rows/day, about 105k/year.

### Setup (done 2026-08-25)

Database `ayso13-weather-log`, id `7d5fa6f1-a18b-41af-b626-67947c4f8d48`, region
WNAM, bound as `WEATHER_DB` in `wrangler.toml`. Schema applied remotely from
`schema.sql`.

**D1:Edit was added to the canonical `ayso13-worker-deploy` token** on the same
day to make that possible — before it, every `wrangler d1` call returned
`code: 10000`. Editing a token's permissions does not change its value, so
`.envrc` and the `CLOUDFLARE_API_TOKEN` GitHub secret were untouched. The grant
is account-scoped (D1 has no per-database scoping), so it also covers the
ayso-platform databases in this account; that is the same shape as the token's
existing KV Storage:Edit.

Two things to know when working on this locally:

- **`wrangler dev` binds the LOCAL D1**, which is a separate empty database.
  Apply the schema there too (`--local --file=schema.sql`) or every tick logs
  `observation log write failed: no such table: observations`. The feed keeps
  serving either way, which is the catch in `logObservation()` doing its job.
- **`--remote` is not the default** on any `d1 execute`. Without it you query
  local state, where an empty table reads exactly like a production problem.

### Queries

Time in each CIF level over the past week (one row = 5 minutes):

```sql
SELECT cif_level,
       COUNT(*) * 5 AS minutes,
       ROUND(COUNT(*) * 5 / 60.0, 1) AS hours
FROM observations
WHERE observed_at >= unixepoch('now', '-7 days')
GROUP BY cif_level
ORDER BY cif_level;
```

Level 4 vs Level 5 by day, Pacific:

```sql
SELECT date(observed_at, 'unixepoch', '-7 hours') AS day,
       SUM(CASE WHEN cif_level = 4 THEN 5 ELSE 0 END) AS level4_min,
       SUM(CASE WHEN cif_level = 5 THEN 5 ELSE 0 END) AS level5_min
FROM observations
WHERE observed_at >= unixepoch('now', '-7 days')
GROUP BY day
ORDER BY day;
```

The `-7 hours` is PDT. Use `-8 hours` for PST, or split on the transition if a
range straddles it.

Daily peak WBGT and when it hit:

```sql
SELECT date(observed_at, 'unixepoch', '-7 hours') AS day,
       MAX(wbgt_f) AS peak_wbgt_f,
       time(observed_at, 'unixepoch', '-7 hours') AS at_time
FROM observations
GROUP BY day
ORDER BY day DESC
LIMIT 14;
```

That last one leans on a SQLite-specific rule: with a bare `MAX()` as the only
aggregate, the un-aggregated columns come from the row that produced the
maximum, so `at_time` is when the peak occurred rather than the last reading of
the day. All three queries above were run against `schema.sql` with three days of
synthetic 5-minute data before being written down.

## Caching

Two independent layers, and the first one is invisible from this repo:

- **Cloudflare caching is DISABLED on `https://www.ayso13.org/temp` and `https://www.ayso13.org/resources/weather`**, set 2026-07-25 **in the Cloudflare dashboard, not in this repo**. It will never appear in git or in `site/src/_headers.njk`, so *the absence of a header is not evidence the bypass isn't configured*. Check the dashboard before adding one.
- **The JSON feed has its own cache.** The Worker sends `Cache-Control: public, max-age=300` on `/api/weather` (`CACHE_TTL_SECONDS`, matched to the 5-minute cron), so even a hard-refreshed page can receive a payload up to 5 minutes old. Bypassing that means changing the Worker header — not the page, and not the dashboard.

**Setup:** create the `#notify-weather` channel, invite the AYSO bot, then set `NOTIFY_WEATHER_CHANNEL_ID` in `wrangler.toml [vars]` to the channel id and add the bot token as a secret:

```bash
npx wrangler secret put SLACK_BOT_TOKEN   # same xoxb-... token as the slack-bot Worker
```

## One-time setup

1. **Tempest credentials**
   - Sign in at <https://tempestwx.com>.
   - Settings → Data Authorizations → Create Token. Friendly name: `ayso13-website`. Copy the token.
   - From the Tempest dashboard, find the numeric station ID (visible in the URL of the station page).

2. **Cloudflare Worker setup**
   ```bash
   cd workers/weather-api
   npm install
   npx wrangler login                        # if not already
   npx wrangler kv:namespace create WEATHER_KV
   # Paste the returned id into wrangler.toml under [[kv_namespaces]] id = "..."
   npx wrangler secret put TEMPEST_TOKEN     # paste the token
   npx wrangler secret put TEMPEST_STATION_ID # paste the station id
   npx wrangler secret put AIRNOW_API_KEY    # OPTIONAL — enables the airQuality block
   npx wrangler deploy
   ```

   The `AIRNOW_API_KEY` is optional; without it the Worker still runs and
   the JSON envelope's `airQuality` block reports `null` values rather
   than throwing. To get a key (free, ~5 min): register at
   <https://docs.airnowapi.org/>, verify your email, copy the key from
   "Web Services → My API". Powers the `/resources/weather/` and `/temp`
   pages' AQI displays plus the air-quality closure advisory (AQI > 150).

3. **Verify**
   ```bash
   curl -sS https://www.ayso13.org/api/weather | jq .
   ```
   Expect: a JSON envelope with `current`, `wbgt`, `airQuality`,
   `closureRecommended`, and `forecast` populated.

## Local dev

```bash
npx wrangler dev
# in another shell:
curl -sS http://localhost:8787/api/weather | jq .
```

`wrangler dev` won't fire the cron trigger, but every HTTP request lazily refreshes the cache, so you'll get fresh data on each call.

## Configuration

`wrangler.toml` has these `[vars]` you can override per-environment:

| Var | Default | Purpose |
|---|---|---|
| `FORECAST_LAT` | `34.1594` | Latitude for NWS forecast (Victory Park) |
| `FORECAST_LON` | `-118.0983` | Longitude for NWS forecast |
| `USER_AGENT` | `(ayso13.org weather page, info@ayso13.org)` | NWS requires a contact email per their API policy |
| `NOTIFY_WEATHER_CHANNEL_ID` | _(placeholder)_ | Slack channel id for #notify-weather (not secret) |
| `POP_FORECAST_THRESHOLD` | `60` | Min forecast PoP % that triggers a rain heads-up |
| `WBGT_WARN_TRIP_F` | `87.5` | Level-4 advisory trips strictly above this (top of CIF Level 3) |
| `WBGT_WARN_CLEAR_F` | `86.0` | Level-4 advisory clears at or below this |
| `PURPLEAIR_SENSOR_IDS` | _(placeholder)_ | CSV of curated outdoor PurpleAir sensor indices |
| `PURPLEAIR_MIN_CONFIDENCE` | `70` | Min PurpleAir channel-A/B confidence % to include a sensor (our quality filter) |
| `PURPLEAIR_STALE_SECONDS` | `3600` | Max age (seconds) before a PurpleAir reading is considered stale |
| `AQI_REFRESH_MINUTES` | `15` | How often AQI is re-fetched (independent of the 5-min weather cron) |

Plus the `SLACK_BOT_TOKEN` and `PURPLEAIR_READ_KEY` **secrets** (see Slack notifications and PurpleAir). If Region 13 wants the forecast pinned to a specific field's coordinates, edit the lat/lon vars and redeploy — coordinates are deliberately kept to 4 decimal places (~11m precision) because `api.weather.gov` returns HTTP 301 for finer-precision points. `FORECAST_LAT`/`FORECAST_LON` moved to Victory Park, the primary 6U–12U game location, on 2026-07-24 (previously a different Pasadena point); see the spec linked under [WBGT formula](#wbgt-formula) — the move shipped alongside the WBGT change but is otherwise unrelated to it.

### PurpleAir (primary AQI)

PurpleAir is the primary AQI source; AirNow serves as a fallback. The Worker fetches one batched `GET /v1/sensors` request over the CSV-list of outdoor sensor indices configured in `PURPLEAIR_SENSOR_IDS`, using the `X-API-Key: PURPLEAIR_READ_KEY` header. Readings must meet the `PURPLEAIR_MIN_CONFIDENCE` threshold (median of EPA-corrected PM2.5 across qualifying sensors → 2024 EPA AQI breakpoints); if none qualify, the Worker falls back to AirNow. The output envelope's `airQuality` block shows which source was used in the `source` field (`PurpleAir (EPA-corrected, N sensors)` vs `AirNow / EPA`).

#### AQI refresh throttle (15 min)

AQI is **not** fetched on every 5-min cron tick — that burned ~1824 PurpleAir API points during the build-out. It refreshes once every `AQI_REFRESH_MINUTES` (default 15, ~96 fetches/day vs 288). `refresh()` reads the prior KV `current` payload; the pure, unit-tested `shouldRefreshAqi(prevAqiFetchedAt, now, intervalMin)` (1-min slack for cron jitter) decides whether to re-fetch. On in-between ticks it carries forward `prevPayload.airQuality` and the `aqiFetchedAt` stamp. A failed/null reading (`aqi == null`) is retried every tick so the feed recovers fast. Weather (Tempest/WBGT/rain) stays on the 5-min cron — only the AQI fetch is throttled.

#### AirNow fallback endpoint

`fetchAirNow` hits the `/aq/observation/current/ziplatlong/` service (live 2026-06-17); logs `AirNow served (ziplatlong)`. The old `/aq/observation/latLong/current/` endpoint (retiring 2026-09-30) was **dropped 2026-06-21** — single endpoint now. The ziplatlong schema differs from the retired one (`nowcastAQI` was `AQI`, `aqiCategoryName`/`AQICategoryName` casing varies, `parameterName "OZONE"/"Ozone"` was `ParameterName "O3"`, camelCase `dateObserved`/`localTimeZone`, `hourObserved "11:00"`; returns all pollutants — we pick the highest AQI). `normalizeAirNow()` maps to a canonical row and stays case-/legacy-tolerant by design (defensive cover for the new endpoint's own documented case inconsistencies; unit-tested as a regression guard). `fetchAirNow` accepts a response only if it has a numeric AQI (`hasUsableAqi`), else returns null (card shows "unavailable").

Setup:

```bash
# Create or copy your PurpleAir API read key (free account required; use an outdoor app key).
# Paste it as a secret:
npx wrangler secret put PURPLEAIR_READ_KEY   # e.g., "api_key_here"

# Populate PURPLEAIR_SENSOR_IDS in wrangler.toml with a comma-separated list
# of curated sensor indices near your fields (determined in Task 6).
# Keep PURPLEAIR_MIN_CONFIDENCE and PURPLEAIR_STALE_SECONDS as defaults
# unless EPA thresholds or staleness tolerance change.
```

## Output envelope

```jsonc
{
  "fetchedAt": "2026-05-04T19:35:00Z",
  "current": {
    "tempF": 74.2,
    "feelsLikeF": 72.9,
    "humidity": 52,
    "windMph": 5.1,
    "windGustMph": 9.4,
    "solarWm2": 412,
    "conditions": "Partly cloudy",
    "stationName": "AYSO Region 13",
    "stationTimestamp": "2026-05-04T19:34:42Z"
  },
  "wbgt": {
    "valueF": 78.4,
    "level": 1,
    "levelLabel": "Normal activities"
  },
  "closureRecommended": false,  // true when wbgt.level >= 5
  "forecast": [
    {
      "name": "Today",
      "isDaytime": true,
      "tempF": 78,
      "tempUnit": "F",
      "pop": 10,  // probability of precipitation %, or null
      "shortForecast": "Sunny",
      "detailedForecast": "Sunny, with a high near 78. ...",
      "windSummary": "5 to 10 mph SW",
      "icon": "https://api.weather.gov/icons/..."
    }
  ]
}
```

## WBGT

WBGT is read from the Tempest station's own `wet_bulb_globe_temperature` field, not derived here. The station measures air temperature, humidity, wind and solar radiation and computes WBGT from its own sensors, which is the same source this Worker already trusts for every other reading it serves.

The Worker used to derive WBGT itself (`computeWbgt` → `approxGlobeTemp`, since deleted). That implementation clamped its globe-temperature term to a constant +25°C, and the clamp bound above roughly 86 W/m² of solar at calm wind — in practice every daylight hour. So measured solar and wind had no effect on the published value, and it reduced algebraically to `0.7·Tw + 0.3·T + 5°C`: the shade formula plus a flat +9°F. Sampled live against the station's own figure across 20 observations, ours read +2.0 to +8.5°F too hot, worst as solar fell, repeatedly reporting CIF Level 5 ("outdoor activity suspended") where the station read Level 2 or 3. The wet-bulb half was fine; the globe term was the whole defect. Investigation and raw data: `docs/superpowers/specs/2026-07-24-wbgt-source-design.md`.

If the station omits `wet_bulb_globe_temperature`, `fetchTempest` throws and KV keeps the last-good payload, the same way it already handles a missing observation. That guard matters because `cifLevel(null)` returns Level 1 (null coerces to 0), so publishing a null would announce "normal activities" when the sensor is actually down.

## Deploy

Auto-deploys via CI (`.github/workflows/deploy-workers.yml`) on push to `main` — so weather-api ships when staging is promoted. Single deployment serves both domains via routes (main-only, never staging).

Manual deploy:
```bash
cd workers/weather-api && npm run deploy
```
Use the canonical **`ayso13-worker-deploy`** token (Workers Scripts:Edit + **Workers KV Storage:Edit** + Account Settings:Read + Zone Workers Routes:Edit), in `.envrc` `CLOUDFLARE_API_TOKEN` + the GitHub `CLOUDFLARE_API_TOKEN` secret. A token missing KV:Edit trips `code 10023` (this Worker binds `WEATHER_KV`). Never `wrangler login`.

**Secrets** (set via `wrangler secret put`, not in git): `TEMPEST_TOKEN`, `AIRNOW_API_KEY`, `PURPLEAIR_READ_KEY`, `SLACK_BOT_TOKEN`, `WEATHER_SELFTEST_KEY` (the last also set identically on the slack-bot Worker).

## Self-test

A POST to `/api/weather` with header `X-Selftest-Key: <WEATHER_SELFTEST_KEY>` posts a test card to `#notify-weather` via the real `postSlack` (GET unaffected; wrong key → 403). Exposed to the board as **`/ayso test-weather`** (the slack-bot calls it and reports the result). The board also has **`/ayso weather`** for an ephemeral current-conditions readout.

The self-test card also **previews the exact closure wording**: below the connectivity line it renders the real `closureTrippedCard(closureReasons(livePayload, /*heatActive*/ true))` — the identical function `notifyClosure` uses for a live closure — with heat forced on so the live WBGT value shows even when conditions are calm. It's clearly labeled `:test_tube: Sample closure card (TEST — not a real closure)`. This lets the board verify the closure message renders correctly without waiting for real heat. (Sharing the `closureTrippedCard` renderer means the preview can never drift from the real notice.)

## Logs

```bash
npx wrangler tail
```

Errors during scheduled refreshes are logged but don't break the cached payload — KV keeps the last-good response until the next successful refresh.
