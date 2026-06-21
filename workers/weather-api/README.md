# ayso13-weather-api

Cloudflare Worker that powers the live data on `/resources/weather/`. Polls the Region 13 Tempest WeatherFlow station every 5 minutes, derives Wet Bulb Globe Temperature (WBGT) and the corresponding California CIF heat-policy alert level (1–5), pulls a 7-day forecast from NWS for Pasadena, and serves a single normalized JSON envelope at `https://www.ayso13.org/api/weather`.

## Architecture

- **Cron trigger** (`*/5 * * * *`): refreshes the cached payload regardless of page traffic, then runs the Slack notifiers (below).
- **HTTP route** (`www.ayso13.org/api/weather`): serves the cached payload from KV. Cold-start safety: if KV is empty (first deploy or eviction), the fetch handler refreshes synchronously before responding so the page never sees a 404 / empty response. (The fetch path never sends Slack notifications — only the cron path does — so concurrent page loads can't double-post.)
- **KV namespace** (`WEATHER_KV`): single key `current` holds the latest envelope. A second key caches the resolved NWS forecast URL for the configured lat/lon. The notifiers keep their own state under `notify:closure`, `notify:nwsAlerts`, and `notify:rainForecast`.

## Slack notifications

After each cron refresh, three independent notifiers post to **#notify-weather** via the shared AYSO Slack bot (`chat.postMessage`). Each keeps its own KV state so it posts only on a *change*, never every tick. A Slack failure is logged but can never break the weather feed (notifications run after the cache write, under `Promise.allSettled`).

| Notifier | Fires when | KV state |
|---|---|---|
| Closure threshold | `closureRecommended` transitions false→true (heat WBGT L5, rain >0.25"/48h or >1"/72h, or AQI > 150) and again true→false | `notify:closure` |
| NWS active alerts | a new alert appears at `api.weather.gov/alerts/active?point=LAT,LON`, or a tracked one ends (dedup by alert id) | `notify:nwsAlerts` |
| Rain forecast heads-up | any forecast period in the next ~72h has PoP ≥ `POP_FORECAST_THRESHOLD` (default 60); throttled to once per 24h per period | `notify:rainForecast` |

On first run with no baseline, the NWS-alerts notifier seeds its state silently so a deploy during an active alert doesn't dump pre-existing alerts into the channel. The pure decision logic (`closureTransition`, `diffAlertIds`, `rainForecastDecision`) is unit-tested — run `npm test`.

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
| `FORECAST_LAT` | `34.1478` | Latitude for NWS forecast (Pasadena City Hall) |
| `FORECAST_LON` | `-118.1445` | Longitude for NWS forecast |
| `USER_AGENT` | `(ayso13.org weather page, info@ayso13.org)` | NWS requires a contact email per their API policy |
| `NOTIFY_WEATHER_CHANNEL_ID` | _(placeholder)_ | Slack channel id for #notify-weather (not secret) |
| `POP_FORECAST_THRESHOLD` | `60` | Min forecast PoP % that triggers a rain heads-up |
| `PURPLEAIR_SENSOR_IDS` | _(placeholder)_ | CSV of curated outdoor PurpleAir sensor indices |
| `PURPLEAIR_MIN_CONFIDENCE` | `70` | Min confidence % for PurpleAir readings (EPA correction requires ≥ 70) |
| `PURPLEAIR_STALE_SECONDS` | `3600` | Max age (seconds) before a PurpleAir reading is considered stale |

Plus the `SLACK_BOT_TOKEN` and `PURPLEAIR_READ_KEY` **secrets** (see Slack notifications and PurpleAir). If Region 13 wants the forecast pinned to a specific field's coordinates, edit the lat/lon vars and redeploy.

### PurpleAir (primary AQI)

PurpleAir is the primary AQI source; AirNow serves as a fallback. The Worker fetches one batched `GET /v1/sensors` request per cron tick over the CSV-list of outdoor sensor indices configured in `PURPLEAIR_SENSOR_IDS`, using the `X-API-Key: PURPLEAIR_READ_KEY` header. Readings must meet the `PURPLEAIR_MIN_CONFIDENCE` threshold (EPA-corrected PM2.5 + PM10 composite); if none qualify, the Worker falls back to AirNow. The output envelope's `airQuality` block shows which source was used in the `source` field.

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

## WBGT formula

`computeWbgt` uses the Bernard 1999 simplified outdoor approximation:

- Wet-bulb temp via Stull 2011 closed-form (function of dry-bulb + RH).
- Globe temp via the simplified Bernard formula (function of dry-bulb + solar irradiance + wind speed).
- WBGT = 0.7·Tw + 0.2·Tg + 0.1·T

Variance vs. ISO 7243 reference under typical Pasadena conditions is ~1°F. CIF alert levels span ~5°F so this is well within tolerance.

## Logs

```bash
npx wrangler tail
```

Errors during scheduled refreshes are logged but don't break the cached payload — KV keeps the last-good response until the next successful refresh.
