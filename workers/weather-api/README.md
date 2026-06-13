# ayso13-weather-api

Cloudflare Worker that powers the live data on `/resources/weather/`. Polls the Region 13 Tempest WeatherFlow station every 5 minutes, derives Wet Bulb Globe Temperature (WBGT) and the corresponding California CIF heat-policy alert level (1–5), pulls a 7-day forecast from NWS for Pasadena, and serves a single normalized JSON envelope at `https://www.ayso13.org/api/weather`.

## Architecture

- **Cron trigger** (`*/5 * * * *`): refreshes the cached payload regardless of page traffic.
- **HTTP route** (`www.ayso13.org/api/weather`): serves the cached payload from KV. Cold-start safety: if KV is empty (first deploy or eviction), the fetch handler refreshes synchronously before responding so the page never sees a 404 / empty response.
- **KV namespace** (`WEATHER_KV`): single key `current` holds the latest envelope. A second key caches the resolved NWS forecast URL for the configured lat/lon.

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

If Region 13 wants the forecast pinned to a specific field's coordinates, edit those vars and redeploy.

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
