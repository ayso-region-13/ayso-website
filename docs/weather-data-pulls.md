# Weather data pulls — the observation log

How to get WBGT and heat-level history out of the D1 observation log. Referenced from `CLAUDE.md` and from `workers/weather-api/README.md` (which owns the schema and the setup steps; this file owns the recipes).

- **Database:** `ayso13-weather-log` (`7d5fa6f1-a18b-41af-b626-67947c4f8d48`, region WNAM)
- **Binding:** `WEATHER_DB` in `workers/weather-api/wrangler.toml`
- **Schema:** `workers/weather-api/schema.sql`
- **Written by:** `logObservation()` in the Worker's `refresh()`, one row per 5-minute cron tick
- **History starts:** 2026-08-25 14:50 PT. There is nothing before that, and there never will be (see [Why it can't be backfilled](#why-it-cant-be-backfilled))

Every query below needs `CLOUDFLARE_API_TOKEN` with D1 access. Direnv supplies it inside the repo; otherwise `source .envrc` first.

## ⚠️ `--remote` is not the default

`wrangler d1 execute` reads the **local** database unless you pass `--remote`. The local copy is a separate, usually empty file, so a forgotten flag returns zero rows, which reads exactly like a production outage. Every command here includes it. Same trap as `wrangler r2 object` (memory `feedback_wrangler_defaults_to_local`).

## Download a CSV

```bash
cd workers/weather-api
./scripts/export-log.sh 24 > ~/Downloads/wbgt-24h.csv   # last 24 hours
./scripts/export-log.sh 168 > week.csv                  # last 7 days
./scripts/export-log.sh 24 | open -f -a Numbers         # straight into Numbers
```

The argument is hours; it defaults to 24. Row count goes to stderr so it stays out of the CSV. `npm run export-log -- 24` is the same thing.

Sample output:

```
observed_at,pacific_time,wbgt_f,cif_level,temp_f,feels_like_f,humidity,wind_mph,solar_wm2,aqi,rain_48h_in,closure
1787694639,2026-08-25 14:50:39,93.6,5,99.3,107.8,40,0.9,770,53,0,1
1787696739,2026-08-25 15:25:39,92.7,5,101.7,101.7,34,0.9,684,53,0,1
1787697938,2026-08-25 15:45:38,89.4,4,101.3,101.3,32,1.6,628,50,0,0
```

**Volume.** One JSON response holds the whole result, which is fine for a day (288 rows) or a week (2,016). A full-year pull is roughly 105,000 rows — do that in monthly chunks, or use the SQL dump below.

## Whole-table dump

```bash
cd workers/weather-api
npx wrangler d1 export ayso13-weather-log --remote --output=log.sql
```

Built into wrangler, no script involved, but it hands back SQL rather than CSV and always takes everything.

## Query cookbook

Run any of these with:

```bash
cd workers/weather-api
npx wrangler d1 execute ayso13-weather-log --remote --command "<SQL>"
```

**Time in each CIF level.** One row is 5 minutes, so counting rows counts minutes. This is the question the log exists to answer.

```sql
SELECT cif_level,
       COUNT(*) * 5 AS minutes,
       ROUND(COUNT(*) * 5 / 60.0, 1) AS hours
FROM observations
WHERE observed_at >= unixepoch('now', '-7 days')
GROUP BY cif_level
ORDER BY cif_level;
```

**Level 4 versus Level 5, by day.**

```sql
SELECT date(observed_at, 'unixepoch', '-7 hours') AS day,
       SUM(CASE WHEN cif_level = 4 THEN 5 ELSE 0 END) AS level4_min,
       SUM(CASE WHEN cif_level = 5 THEN 5 ELSE 0 END) AS level5_min
FROM observations
WHERE observed_at >= unixepoch('now', '-7 days')
GROUP BY day
ORDER BY day;
```

**Daily peak WBGT, and when it hit.**

```sql
SELECT date(observed_at, 'unixepoch', '-7 hours') AS day,
       MAX(wbgt_f) AS peak_wbgt_f,
       time(observed_at, 'unixepoch', '-7 hours') AS at_time
FROM observations
GROUP BY day
ORDER BY day DESC
LIMIT 14;
```

That one leans on a SQLite rule worth knowing: with a bare `MAX()` as the only aggregate, the un-aggregated columns come from the row that produced the maximum. So `at_time` is when the peak occurred, not the last reading of the day.

**Conditions during a specific window** — for reconstructing a Saturday morning after the fact.

```sql
SELECT datetime(observed_at, 'unixepoch', '-7 hours') AS pt,
       wbgt_f, cif_level, temp_f, humidity, aqi
FROM observations
WHERE observed_at BETWEEN unixepoch('2026-09-12 08:00:00') + 25200
                      AND unixepoch('2026-09-12 12:00:00') + 25200
ORDER BY observed_at;
```

**When did we cross into or out of a level.**

```sql
SELECT datetime(observed_at, 'unixepoch', '-7 hours') AS pt, wbgt_f, cif_level
FROM (SELECT observed_at, wbgt_f, cif_level,
             LAG(cif_level) OVER (ORDER BY observed_at) AS prev
      FROM observations
      WHERE observed_at >= unixepoch('now', '-7 days'))
WHERE prev IS NOT NULL AND cif_level != prev
ORDER BY observed_at;
```

Useful for checking a Slack notice against the data: the advisory and closure notices post up to 15 minutes after the crossing because of the dwell, so the timestamps will not line up exactly, and shouldn't.

## Timezone

`observed_at` is unix seconds, UTC. The `-7 hours` offsets above are **PDT**. Use `-8 hours` for PST, and split the query if a range straddles the change (2026-11-01). SQLite has no timezone database, so there is no way around doing this by hand.

## Why it can't be backfilled

Tempest returns `wet_bulb_globe_temperature` only on the *current* observation. Verified 2026-08-25 across every endpoint:

| Endpoint | WBGT? | History? |
|---|---|---|
| `observations/station/{id}` | yes | no — silently ignores `time_start`, `time_end`, `day_offset`, `bucket` and returns the current obs |
| `observations/device/{id}` | no | yes — 1-minute resolution, 30+ days, raw sensor fields only |
| `stats/station/{id}` | no | yes — daily aggregates back years |
| `better_forecast` | yes, rounded to whole °C | no |
| Tempest site CSV export | no | yes |

Deriving WBGT from the raw fields is the one remaining route, and that is exactly the calculation deleted in session 41 for reading 2 to 8.5°F too hot (`docs/superpowers/specs/2026-07-24-wbgt-source-design.md`). Backfilled levels would not match what the site published, so the log simply starts where it starts.
