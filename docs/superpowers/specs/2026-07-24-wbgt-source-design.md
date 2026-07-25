# WBGT source change: read WeatherFlow's value instead of deriving our own

**Date:** 2026-07-24
**Status:** Approved, ready for planning
**Affects:** `workers/weather-api/`, `site/src/resources/weather.md`

> **Status note (2026-07-24, after implementation):** the Problem and Measured
> impact sections below are the durable record — the root cause and the 20-sample
> dataset that proves it. The Design sections that follow were **not** built as
> written. They proposed a plausibility guard, a last-good/staleness fallback, a
> Slack rejection notifier and a two-phase shadow rollout, all to hedge against
> trusting WeatherFlow's undocumented WBGT formula. That was overengineered: the
> Worker already trusts this same station for temperature, humidity, wind, solar,
> wet-bulb and rain accumulation, so singling out one derived field for
> validation was inconsistent. What shipped instead is the minimal change — read
> `wet_bulb_globe_temperature`, delete the local formula, and throw if the field
> is absent so KV keeps the last-good payload. The accompanying implementation
> plan was deleted for the same reason. Read the Design sections as a record of a
> rejected approach, not as documentation of the code.

## Problem

`computeWbgt()` in `workers/weather-api/src/index.js` derives Wet Bulb Globe
Temperature from the Tempest station's temperature, humidity, wind and solar
readings. Its globe-temperature term is degenerate.

`approxGlobeTemp(T, S, W)` computes `delta = 0.194 * S / W^0.58` and then clamps
it to 25 °C. That clamp binds above roughly 86 W/m² at calm wind and 330 W/m² at
5 m/s, which covers essentially every daylight hour. The consequence is that the
globe term contributes a constant +25 °C whenever the sun is up, so measured
solar radiation and wind speed have **no effect** on the published WBGT:

```
WBGT at T=34.3 °C / RH=45 %:
  solar  600   wind 0.5/2/5/10 m/s -> 91.0 / 91.0 / 91.0 / 91.0 °F
  solar  854   wind 0.5/2/5/10 m/s -> 91.0 / 91.0 / 91.0 / 91.0 °F
  solar 1000   wind 0.5/2/5/10 m/s -> 91.0 / 91.0 / 91.0 / 91.0 °F
```

It reduces algebraically to `0.7*Tw + 0.3*T + 5 °C`, the shade formula plus a
flat +9 °F offset.

### Measured impact

WeatherFlow returns its own `wet_bulb_globe_temperature` for the same station.
15 samples were collected from station 33318 every ~5 minutes across a
falling-solar afternoon and evening, 2026-07-24T22:21Z to 2026-07-25T00:16Z,
using `docs/superpowers/specs/2026-07-24-wbgt-sample.mjs`. Raw data (including
the unrounded values and the `globeCapped` flag per sample) is in
`docs/superpowers/specs/2026-07-24-wbgt-samples.jsonl`.

| obs time (UTC) | solar W/m² | wind mph | air °F | WeatherFlow WBGT | our WBGT | delta | levels |
|---|---|---|---|---|---|---|---|
| 22:21 | 784 | 1.3 | 93.6 | 88.9 | 90.9 | +2.0 | L4 vs L5 |
| 22:26 | 766 | 1.6 | 93.4 | 88.0 | 90.7 | +2.7 | L4 vs L5 |
| 22:31 | 754 | 2.7 | 93.2 | 86.2 | 90.8 | +4.6 | L3 vs L5 |
| 22:36 | 742 | 2.0 | 93.0 | 86.4 | 90.1 | +3.8 | L3 vs L5 |
| 22:41 | 729 | 1.3 | 93.6 | 88.0 | 90.6 | +2.6 | L4 vs L5 |
| 22:47 | 715 | 1.3 | 93.0 | 88.0 | 90.6 | +2.7 | L4 vs L5 |
| 22:52 | 662 | 0.9 | 92.8 | 88.2 | 90.2 | +2.1 | L4 vs L5 |
| 22:57 | 675 | 2.5 | 93.6 | 85.6 | 90.6 | +5.0 | L3 vs L5 |
| 23:02 | 637 | 2.0 | 93.4 | 85.8 | 90.4 | +4.6 | L3 vs L5 |
| 23:07 | 648 | 2.7 | 93.2 | 85.1 | 90.5 | +5.4 | L3 vs L5 |
| 23:12 | 599 | 1.8 | 92.8 | 85.5 | 90.2 | +4.8 | L3 vs L5 |
| 23:47 | 506 | 0.2 | 91.2 | 85.5 | 89.3 | +3.8 | L3 vs L4 |
| 00:06 | 445 | 1.3 | 92.3 | 84.6 | 89.7 | +5.2 | L2 vs L5¹ |
| 00:11 | 463 | 0.9 | 92.3 | 85.5 | 89.7 | +4.3 | L3 vs L5¹ |
| 00:16 | 452 | 0.7 | 91.9 | 84.9 | 89.4 | +4.5 | L3 vs L4 |

¹ CIF level is derived from the unrounded WBGT, before it's rounded to one
decimal for display. A row can display `89.7`°F (the Level 4/5 boundary) and
still carry a Level 5 tag if the unrounded value was fractionally above the
boundary. That's a display-rounding artifact of this table, not an
inconsistency in the underlying data — see the raw `.jsonl` for the unrounded
values.

All 15 samples have `globeCapped: true` in the raw data — the globe delta was
pinned at the clamp across the entire observed solar range, 445 to 784 W/m².
That is the clearest single confirmation that the clamp binds across all
daylight conditions sampled here, not only at peak midday sun.

#### Low-solar addendum (5 further samples, 00:22Z to 00:42Z)

The sampler kept running past the table above and captured the low-solar regime
that the first 15 samples left unvalidated. The dataset in
`2026-07-24-wbgt-samples.jsonl` now holds 20 samples spanning solar 89 to
784 W/m².

| obs time (UTC) | solar W/m² | wind mph | air °F | WeatherFlow WBGT | our WBGT | delta |
|---|---|---|---|---|---|---|
| 00:22 | 177 | 1.8 | 81.1 | 81.1 | 89.2 | +8.1 |
| 00:27 | 89 | 0.9 | 80.4 | 80.4 | 88.9 | +8.5 |
| 00:32 | 180 | 0.4 | 81.0 | 81.0 | 88.4 | +7.4 |
| 00:37 | 342 | 0.4 | 82.6 | 82.6 | 88.2 | +5.7 |
| 00:42 | 171 | 0.2 | 81.1 | 81.1 | 88.6 | +7.5 |

Three things this settles:

1. **The error grows to +8.5 °F as solar falls**, confirming the direction and
   rough magnitude of the earlier algebraic prediction rather than merely being
   consistent with it. As solar fell from 784 to 89 W/m², WeatherFlow's value
   dropped 8.5 °F while ours dropped 2.0 °F, essentially all of that residual
   movement being air-temperature cooling.
2. **The clamp still binds at 89 W/m².** All 20 samples carry
   `globeCapped: true`, matching the calculated threshold of roughly 86 W/m² at
   calm wind. The clamp does not release as light fades; it stays pinned right
   down to near-darkness.
3. **The divergence is worst exactly where the old formula looked safest.** At
   00:27 WeatherFlow reads 80.4 °F (CIF Level 2, "frequent water breaks") while
   ours reads 88.9 °F (Level 4, "strict activity limits"). A late-afternoon or
   overcast session is where the legacy formula most overstates heat risk.

Note these are dusk samples rather than overcast midday. They exercise the same
mechanism, since what matters is low solar with the clamp still binding, which is
precisely what happened. Genuine overcast midday remains unsampled, but item 2
above makes the concern largely moot: the clamp binds regardless.

The gap ranged from +2.0 to +5.4°F and widened as solar fell and wind rose,
consistent with the algebraic prediction above. The divergence repeatedly
reached a full two CIF alert levels (Level 5 vs Level 3) in seven of the
fifteen samples, and briefly reached three levels (Level 5 vs Level 2) in one
further sample at 00:06. Treat the two-level gap as the representative
magnitude; the single three-level row is an outlier, not the story.

Our wet-bulb half is sound across the same 15 samples — the raw data's
`wbOursF` and `wbTheirsF` agree to within roughly a degree throughout (76.84°F
vs 76.1 to 77.0°F on the first sample, for example). The globe term is the
entire defect.

The error direction is conservative, meaning we over-read heat, which is the safer
way to be wrong. But it causes avoidable cancellations, and on a mild overcast day
it could manufacture a heat alert from nothing.

### Root cause of the survival

`computeWbgt`, `approxGlobeTemp` and `stullWetBulb` are not exported and have no
unit tests. Every other decision function in this file (`closureNotifyDecision`,
`shouldRefreshAqi`, `rainForecastDecision`, `diffAlertIds`) is pure, exported at
`src/index.js:1066`, and tested. WBGT was the exception, which is why a formula
that pins its globe term to a constant shipped and survived.

## Rejected alternative: tomorrow.io

Investigated as a replacement provider and ruled out. On the free plan both
fields we would need return `403 The plan is restricted`:

- `solarGHI`, required as a WBGT input
- `wetBulbGlobeTemperature`, which would let tomorrow.io compute WBGT for us

Available fields are temperature, temperatureApparent, humidity, dewPoint, wind
speed/gust/direction, cloudCover, uvIndex, heatIndex, precipitation intensity and
probability. `wetBulbTemperature` is not a valid field name at all (400).

Sampled at Victory Park against the Tempest station, the two providers agreed on
temperature within 1.2 °F but differed by 10 points on humidity, which moves wet
bulb by roughly 2 °F. Even on a paid tier, tomorrow.io's WBGT would be modelled
from gridded data rather than a real pyranometer near the fields.

## Decision

Stop deriving WBGT. Read WeatherFlow's `wet_bulb_globe_temperature`, which is
already present in the `observations/station/33318` response the worker fetches
today (`src/index.js:895`). No endpoint change and no extra HTTP call.

Known caveat, accepted: WeatherFlow does not publish their WBGT formula. Their
derived-metrics page documents `wet_bulb_temperature` but omits WBGT. We are
trading a formula we know to be broken for a black box that at least consumes the
same station's measured solar and wind. The plausibility guard below is the
mitigation.

## Design

### Data flow

`fetchTempest()` already receives both fields and discards them. It starts
returning:

- `wbgtVendorC` from `obs[0].wet_bulb_globe_temperature`
- `wetBulbC` from `obs[0].wet_bulb_temperature`

The worker requests `units_temp=c`, so both arrive in Celsius. Double-converting
is the obvious trap and is covered by a test.

The rain fields `fetchTempest` reads (`precip_accum_local_day`,
`precip_accum_local_yesterday`) are present in the same response and unaffected,
so `updateRainState` and rain closures are untouched.

### Two-phase rollout

There is no staging deployment of this worker. Per
`.github/workflows/deploy-workers.yml:6-9`, `weather-api` has one deployment
serving both `www.ayso13.org/api/weather` and `staging.ayso13.org/api/weather`
via routes, and deploys only from `main`. A staging deploy would compare the
deployment against itself. Only the `redirects` worker has real prod/staging
environments. Hence a shadow phase instead.

**Phase 1, inert for WBGT.** The payload gains a `wbgtWeatherFlow` block, resolved
through the new functions below. The existing `wbgt` block keeps its locally
computed value, so `wbgt.valueF`/`.level` and `closureRecommended` behave exactly
as they do today — inert in that specific sense. It is not a fully invisible
deploy, though: `FORECAST_LAT`/`FORECAST_LON` also move to Victory Park in this
phase (see NWS forecast point below), so `payload.forecast` — rendered on
`/resources/weather/` and consumed by `notifyRainForecast` — will read
differently. Observe across varied weather via `/api/weather`, particularly
breezy and overcast conditions where the predicted divergence is largest and
currently unmeasured.

Phase 1 is the only phase that carries both values, and it is what makes the
comparison possible, so the broken formula stays in the tree deliberately for the
duration of the shadow period as the baseline. Phase 2 deletes it.

**Exit criterion for Phase 1.** Move to Phase 2 once the shadow block has been
observed across at least one breezy or overcast daylight period, not merely a
fixed number of days. Calm sunny conditions are where the current formula is least
wrong, so time alone does not establish confidence.

**Phase 2, flip.** `wbgt.valueF` / `.level` / `.levelLabel` come from
WeatherFlow. The `wbgtWeatherFlow` shadow block is removed. `computeWbgt`,
`approxGlobeTemp` and `stullWetBulb` (`src/index.js:942-965`) are deleted. Page
copy is corrected. This lands as a net deletion of unvalidated physics.

### New pure functions

Both module-level and exported at `src/index.js:1066` alongside the existing pure
decision functions, following the file's established pattern of a pure core inside
a thin IO shell.

```
wbgtPlausible(wbgtF, { wetBulbF, airTempF }) -> { ok, reason }
resolveWbgt(fresh, prevPayload, nowMs, cfg) -> { valueF, level, levelLabel, stale, ageMinutes, rejected }
```

`resolveWbgt` owns the null, rejection and staleness rules. Keeping it pure means
those rules are testable without network or KV, which is the specific gap that let
the current bug through.

**Unit boundary.** Both functions operate entirely in Fahrenheit. `fetchTempest`
returns Celsius (the API is queried with `units_temp=c`); `refresh()` converts to
Fahrenheit via the existing `celsiusToFahrenheit` before calling either function.
Nothing downstream of `refresh()` sees Celsius. This is stated explicitly because
double conversion is the most likely defect in this change, and it is what the
Celsius test case guards.

**Both functions are live in Phase 1**, feeding the `wbgtWeatherFlow` shadow
block. The plausibility guard and the Slack rejection notice are therefore active
during the shadow period, which is deliberate: it exercises the real logic and
surfaces vendor-side WBGT problems before the WBGT value itself becomes
user-visible in Phase 2. Phase 2 changes only which block the page reads, not
how the value is resolved.

### Fallback and staleness

When the fresh value is null or fails the plausibility guard, `resolveWbgt`
carries the previous value forward and stamps `wbgtFetchedAt`, mirroring how
`aqiFetchedAt` already works in `refresh()`.

Past `WBGT_STALE_MINUTES` (new `[vars]` entry, default `60`) it reports heat as
unavailable and heat drops out of `closureRecommended`. Rain and AQI closures
continue to work independently, so one dead sensor cannot blank the whole feed.

WBGT moves slowly, so serving a value 5 to 30 minutes old is honest. An hours-old
one is not, which is what the expiry enforces.

### Plausibility guard

Provisional bounds, to be validated against the overnight sample set before
implementation:

- absolute: `0 <= WBGT <= 130 °F`
- `WBGT >= wetBulbF - 2` (wet bulb carries 0.7 weight so WBGT sits above it;
  slack allows for nighttime radiative cooling)
- `WBGT <= airTempF + 20` (WBGT can exceed air temp in humid sun; observed today
  running 4.7 to 5.4 °F below air temp)

A rejected reading posts once to `#notify-weather` through the existing
`postSlack`, with KV state under `notify:wbgtRejected` so a persistently broken
sensor does not spam the channel. Same debounce discipline as the three existing
notifiers.

### NWS forecast point

`FORECAST_LAT` / `FORECAST_LON` move from Pasadena City Hall
(`34.1478, -118.1445`) to Victory Park (`34.159389, -118.098292`), the primary
6U-12U game location and roughly 4.4 km east.

The forecast-URL cache key is already `forecast-url:${lat},${lon}`
(`src/index.js:976`), so it re-resolves automatically with no stale-cache risk.
Independent of the WBGT work; ships in Phase 1.

Observations stay on station 33318. WeatherFlow exposes
`wet_bulb_globe_temperature` for station requests only, not lat/lon point
requests, so WBGT is inherently station-bound.

### Tests

New `test/wbgt.test.js`:

- vendor field null, and vendor field absent from the response
- each plausibility bound, above and below
- carry-forward inside the staleness window
- expiry past the window, and heat leaving `closureRecommended` when unavailable
- Celsius input handling, guarding against double conversion
- regression case pinning a real observation: 93.6 °F, 45 %, 1.3 mph,
  784 W/m² produces 88.9 °F and Level 4, so a future refactor cannot silently
  reintroduce a Level 5

### Copy corrections (Phase 2)

`site/src/resources/weather.md:77` currently makes a false public accuracy claim:

> WBGT (Wet Bulb Globe Temperature) is computed from temperature, humidity, wind
> speed, and solar irradiance using the Bernard 1999 simplified outdoor
> approximation. Variance versus the ISO 7243 reference is roughly ±1°F under
> typical Pasadena conditions, well within the ~5°F width of each CIF alert tier.

With the globe term clamped this is not the Bernard approximation, and the ±1 °F
figure is unsupported. Replacement:

> WBGT (Wet Bulb Globe Temperature) combines air temperature, humidity, wind
> speed, and solar radiation into a single heat-stress measure. The value shown
> here is calculated by our Tempest weather station from its own sensor readings.
> Because WBGT varies with shade, surface, and microclimate, a reading from the
> station may differ from conditions at a specific field.

The accuracy claim is dropped rather than restated at a new number, since we
cannot substantiate one against an undocumented vendor formula.

Separately, station 33318 is Region 13's own station but is not sited at a field.
"on-site" is therefore misleading and is removed from `weather.md:11` and the
line 6 meta description. No em dashes, per house style.

## Out of scope

- tomorrow.io, ruled out above.
- A real staging environment for `weather-api` (own worker name, KV namespace,
  duplicated secrets, route, workflow branch logic). Worth doing and would make
  all future weather changes testable, but it is its own project.
- `WBGT_TRIP_F` (89.7) and `WBGT_CLEAR_F` (88.0). These are CIF boundary values
  and stay correct as the measured value changes.
- `/resources/heat-policy/` static thresholds, likewise CIF-defined.
- `/temp`, which renders whatever the API serves and needs no change.
- The `?simulate=N` fixtures in `weather.md`, which inject synthetic values and
  are unaffected.

## Success criteria

1. Phase 1 deploys to `main` with zero change to `wbgt.valueF` or
   `closureRecommended`. The rendered page's forecast section does change,
   since the forecast point also moves to Victory Park in this phase.
2. `wbgtWeatherFlow` appears in `/api/weather` and tracks the station.
3. Phase 2 publishes WeatherFlow's value; `computeWbgt`, `approxGlobeTemp` and
   `stullWetBulb` no longer exist in the codebase.
4. A null or implausible vendor reading carries the last good value forward,
   expires after `WBGT_STALE_MINUTES`, and posts exactly one Slack notice.
5. `npm test` passes in `workers/weather-api/`, including the new suite.
6. No public page states an accuracy figure we cannot substantiate.
