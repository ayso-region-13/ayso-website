-- ayso13-weather-log — D1 schema for the weather observation log.
--
-- Apply with either:
--   npx wrangler d1 execute ayso13-weather-log --remote --file=schema.sql
--   (needs a token with D1:Edit — the canonical ayso13-worker-deploy has none)
-- or by pasting this into the D1 console in the Cloudflare dashboard.
--
-- One row per reading, written by the Worker's refresh() on each 5-min cron
-- tick. `observed_at` is the STATION's own observation time in unix seconds,
-- not our fetch time, and it is the primary key: a double cron fire or a
-- cold-start refresh inside the same window is then idempotent instead of a
-- duplicate row.

CREATE TABLE IF NOT EXISTS observations (
  observed_at   INTEGER PRIMARY KEY,  -- unix seconds, station observation time
  wbgt_f        REAL,                 -- wet bulb globe temperature, °F
  cif_level     INTEGER,              -- CIF heat-policy level 1-5
  temp_f        REAL,
  feels_like_f  REAL,
  humidity      INTEGER,              -- percent
  wind_mph      REAL,
  solar_wm2     INTEGER,
  aqi           INTEGER,              -- composite AQI, or NULL when unavailable
  rain_48h_in   REAL,                 -- rolling 48h rainfall, inches
  closure       INTEGER NOT NULL DEFAULT 0  -- 1 when closureRecommended was set
);

-- Time-in-level queries scan by level over a date range.
CREATE INDEX IF NOT EXISTS idx_observations_level_time
  ON observations (cif_level, observed_at);
