// AYSO Region 13 weather API — Cloudflare Worker.
//
// Two entry points share one refresh() pipeline:
//   - scheduled() runs every 5 min via cron, refreshes the KV cache.
//   - fetch()     responds to /api/weather; serves the cached payload
//                  (refreshing on cold start so the page never sees an
//                  empty cache).
//
// Upstream sources:
//   - Tempest WeatherFlow REST API for current sensor readings (temp,
//     humidity, wind, solar irradiance) from Region 13's station.
//   - NWS api.weather.gov for the 7-day forecast (free, no auth).
//
// Output envelope is documented in plan/imperative-giggling-clock.md.

const KV_KEY = "current";
const CACHE_TTL_SECONDS = 300; // 5 min — matches cron cadence

// CIF heat-policy WBGT thresholds (°F). See /resources/heat-policy/ for
// the policy itself; numbers here drive the level + closureRecommended
// flag the page renders. The `label` field is a fallback string only —
// the weather page owns the canonical alert copy (title, lead, limits)
// in WBGT_BANNERS so the displayed wording can be edited without redeploying
// the Worker.
const CIF_LEVELS = [
  { level: 1, max: 79.7, label: "Normal activities" },
  { level: 2, max: 84.6, label: "Frequent water breaks" },
  { level: 3, max: 87.5, label: "Activity reduced" },
  { level: 4, max: 89.7, label: "Strict activity limits" },
  { level: 5, max: Infinity, label: "Outdoor activity suspended" },
];

const ALLOWED_ORIGINS = new Set([
  "https://www.ayso13.org",
  "https://staging.ayso13.org",
]);

export default {
  async fetch(request, env, ctx) {
    let payload = await env.WEATHER_KV.get(KV_KEY, { type: "json" });
    if (!payload) {
      // Cold start. Build the cache before serving so the first visitor
      // doesn't get a stale-data error from the page.
      try {
        payload = await refresh(env);
      } catch (err) {
        return jsonError(503, `weather data unavailable: ${err.message}`);
      }
    }
    // Page consumes this same-origin via the Worker route on
    // www.ayso13.org and staging.ayso13.org, so CORS isn't strictly
    // needed. Echo the Origin only when it matches one of ours; drop it
    // otherwise. Hygiene in case someone pulls the endpoint from elsewhere.
    const origin = request.headers.get("Origin");
    const headers = {
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}`,
      "Vary": "Origin",
    };
    if (origin && ALLOWED_ORIGINS.has(origin)) {
      headers["Access-Control-Allow-Origin"] = origin;
    }
    return new Response(JSON.stringify(payload), { headers });
  },

  async scheduled(_event, env, _ctx) {
    // Cron fires regardless of traffic. Failures here just leave the
    // last-good payload in KV until the next tick.
    try {
      await refresh(env);
    } catch (err) {
      console.error("scheduled refresh failed:", err.message);
    }
  },
};

async function refresh(env) {
  const [tempestObs, nwsForecast, prevRainState] = await Promise.all([
    fetchTempest(env),
    fetchNwsForecast(env),
    env.WEATHER_KV.get("rain:state", { type: "json" }),
  ]);

  const wbgt = computeWbgt(tempestObs);
  const wbgtF = celsiusToFahrenheit(wbgt);
  const cif = cifLevel(wbgtF);

  const rainState = await updateRainState(env, tempestObs, prevRainState);
  const rain = rainAdvisory(rainState);

  const payload = {
    fetchedAt: new Date().toISOString(),
    current: {
      tempF: round(celsiusToFahrenheit(tempestObs.temperatureC), 1),
      feelsLikeF: round(celsiusToFahrenheit(tempestObs.feelsLikeC), 1),
      humidity: Math.round(tempestObs.humidity),
      windMph: round(metersPerSecondToMph(tempestObs.windMs), 1),
      windGustMph: round(metersPerSecondToMph(tempestObs.windGustMs), 1),
      solarWm2: Math.round(tempestObs.solarWm2),
      conditions: tempestObs.conditions || null,
      stationName: tempestObs.stationName || "AYSO Region 13",
      stationTimestamp: tempestObs.timestampIso,
    },
    wbgt: {
      valueF: round(wbgtF, 1),
      level: cif.level,
      levelLabel: cif.label,
    },
    rain: rain,
    closureRecommended: cif.level >= 5 || rain.closureRecommended,
    forecast: nwsForecast,
  };

  await env.WEATHER_KV.put(KV_KEY, JSON.stringify(payload), {
    expirationTtl: 60 * 60 * 24, // 24 h safety net if the cron stalls
  });
  return payload;
}

// ── Rain tracking ──────────────────────────────────────────────────────
//
// Tempest's current obs gives us today (precip_accum_local_day) and
// yesterday (precip_accum_local_yesterday) but nothing further back. We
// keep a 7-day rolling history of daily totals in KV so we can compute
// 48 h and 72 h sums independently of the cron's lookback.
//
// Each refresh:
//   1. Stamp today's running total (overwrites — Tempest's value is
//      authoritative for the current day).
//   2. If we don't yet have yesterday's archived total, capture it
//      from precip_accum_local_yesterday (which is final once the day
//      rolls over).
//   3. Prune anything older than 7 days.

const RAIN_THRESHOLDS_IN = { last48h: 0.25, last72h: 1.0 };
const MM_TO_INCHES = 0.0393701;

async function updateRainState(env, obs, prev) {
  // KV has no compare-and-swap. Concurrent invocations (cron + cold-start
  // fetch firing within the same window) can both read the same `prev` and
  // race on the put. The writes are mostly idempotent — today's value gets
  // overwritten anyway, and yesterday's capture is also idempotent — so the
  // last-write-wins behavior is safe. Worth knowing if other day-state is
  // ever added here.
  const today = pacificDate(obs.timestampIso || new Date().toISOString());
  const yesterday = addDays(today, -1);

  const dailyTotals = (prev && prev.dailyTotals) ? { ...prev.dailyTotals } : {};

  dailyTotals[today] = round(obs.precipDayMm * MM_TO_INCHES, 3);

  // Capture yesterday's final total if we don't have one yet (e.g. first
  // run after deploy, or the cron didn't tick at end-of-day).
  if (dailyTotals[yesterday] == null && obs.precipYesterdayMm != null) {
    dailyTotals[yesterday] = round(obs.precipYesterdayMm * MM_TO_INCHES, 3);
  }

  // Prune anything older than 7 days so KV doesn't grow unbounded.
  const cutoff = addDays(today, -7);
  for (const date of Object.keys(dailyTotals)) {
    if (date < cutoff) delete dailyTotals[date];
  }

  const state = { dailyTotals, asOfPacificDate: today };
  await env.WEATHER_KV.put("rain:state", JSON.stringify(state), {
    expirationTtl: 60 * 60 * 24 * 14, // 14 d safety net
  });
  return state;
}

function rainAdvisory(state) {
  const today = state.asOfPacificDate;
  const get = (offset) => state.dailyTotals[addDays(today, offset)] || 0;

  // 48 h ≈ today + yesterday (approximation, drifts up to 24 h either way
  // depending on time of day; conservative for closure decisions).
  // 72 h ≈ today + yesterday + day before.
  const last48h = round(get(0) + get(-1), 2);
  const last72h = round(get(0) + get(-1) + get(-2), 2);

  let closureRecommended = false;
  let reason = null;
  if (last48h > RAIN_THRESHOLDS_IN.last48h) {
    closureRecommended = true;
    reason = `Heavy rain in past 48 hours (${last48h}\")`;
  } else if (last72h > RAIN_THRESHOLDS_IN.last72h) {
    closureRecommended = true;
    reason = `Heavy rain over past 72 hours (${last72h}\")`;
  }

  return {
    last48hInches: last48h,
    last72hInches: last72h,
    thresholds: RAIN_THRESHOLDS_IN,
    closureRecommended,
    reason,
  };
}

// YYYY-MM-DD in America/Los_Angeles for a given ISO timestamp.
function pacificDate(iso) {
  const d = new Date(iso);
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric", month: "2-digit", day: "2-digit",
  });
  return fmt.format(d); // en-CA → "2026-05-04"
}

// Add days (positive or negative) to a YYYY-MM-DD string, returning YYYY-MM-DD.
function addDays(ymd, days) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

// ── Tempest ────────────────────────────────────────────────────────────

async function fetchTempest(env) {
  const token = env.TEMPEST_TOKEN;
  const stationId = env.TEMPEST_STATION_ID;
  if (!token || !stationId) {
    throw new Error("TEMPEST_TOKEN and TEMPEST_STATION_ID must be set");
  }
  const url = `https://swd.weatherflow.com/swd/rest/observations/station/${stationId}?token=${token}&units_temp=c&units_wind=mps&units_pressure=mb&units_precip=mm&units_distance=km`;
  const r = await fetch(url, { headers: { "User-Agent": env.USER_AGENT } });
  if (!r.ok) {
    throw new Error(`Tempest ${r.status}`);
  }
  const json = await r.json();
  const obs = json.obs && json.obs[0];
  if (!obs || obs.timestamp == null) {
    // Without a real obs we'd compute a phantom rain entry under a
    // 1969-12-31 key (because pacificDate(null) → epoch). Fail loudly
    // instead — caller leaves the last-good payload in KV.
    throw new Error("Tempest: no current observation in response");
  }

  // Tempest payload shape (selected fields, all SI units due to query):
  //   air_temperature, relative_humidity, wind_avg, wind_gust,
  //   solar_radiation, feels_like, conditions, timestamp (epoch s),
  //   precip_accum_local_day (mm since local midnight),
  //   precip_accum_local_yesterday (mm, yesterday's full-day total).
  return {
    temperatureC: obs.air_temperature,
    feelsLikeC: obs.feels_like ?? obs.air_temperature,
    humidity: obs.relative_humidity,
    windMs: obs.wind_avg ?? 0,
    windGustMs: obs.wind_gust ?? 0,
    solarWm2: obs.solar_radiation ?? 0,
    conditions: obs.conditions,
    stationName: json.station_name,
    timestampIso: obs.timestamp ? new Date(obs.timestamp * 1000).toISOString() : null,
    precipDayMm: obs.precip_accum_local_day ?? 0,
    precipYesterdayMm: obs.precip_accum_local_yesterday ?? 0,
  };
}

// ── WBGT ───────────────────────────────────────────────────────────────
//
// Bernard 1999 simplified outdoor WBGT. Inputs: air temp °C, RH %, wind
// m/s, solar W/m². Returns WBGT °C. Variance vs. ISO 7243 reference:
// ~1°F under typical Pasadena conditions, well within the noise of CIF
// thresholds (each level is ~5°F wide).
//
//   Tw = T*atan(0.151977*sqrt(RH+8.313659))
//        + atan(T+RH) - atan(RH-1.676331)
//        + 0.00391838*RH^1.5*atan(0.023101*RH) - 4.686035   (Stull 2011)
//   Tg = T + (S/(R*W^0.58)) for sun-exposed black globe (R≈37.5, simplified)
//   WBGT_outdoor = 0.7*Tw + 0.2*Tg + 0.1*T

function computeWbgt({ temperatureC: T, humidity: RH, windMs: W, solarWm2: S }) {
  const Tw = stullWetBulb(T, RH);
  const Tg = approxGlobeTemp(T, S, W);
  return 0.7 * Tw + 0.2 * Tg + 0.1 * T;
}

function stullWetBulb(T, RH) {
  return (
    T * Math.atan(0.151977 * Math.sqrt(RH + 8.313659)) +
    Math.atan(T + RH) -
    Math.atan(RH - 1.676331) +
    0.00391838 * Math.pow(RH, 1.5) * Math.atan(0.023101 * RH) -
    4.686035
  );
}

function approxGlobeTemp(T, S, W) {
  // Bernard simplified: globe temp rises above air temp with solar load,
  // moderated by wind. Floor wind to 0.1 m/s to avoid divide-by-zero on
  // dead-calm days.
  const wind = Math.max(W, 0.1);
  const delta = (1.1e8 * S) / (Math.pow(wind, 0.58) * 5.67e8);
  return T + Math.min(delta, 25); // cap delta at 25°C — sanity bound
}

// ── NWS forecast ───────────────────────────────────────────────────────

async function fetchNwsForecast(env) {
  const lat = env.FORECAST_LAT;
  const lon = env.FORECAST_LON;
  const ua = env.USER_AGENT || "(ayso-region-13)";

  // /points returns gridpoint info + forecast URL; gridpoint info is
  // stable so we cache the resolved forecast URL in KV indefinitely.
  let forecastUrl = await env.WEATHER_KV.get(`forecast-url:${lat},${lon}`);
  if (!forecastUrl) {
    const pointsUrl = `https://api.weather.gov/points/${lat},${lon}`;
    const r = await fetch(pointsUrl, { headers: { "User-Agent": ua, Accept: "application/geo+json" } });
    if (!r.ok) throw new Error(`NWS points ${r.status}`);
    const json = await r.json();
    forecastUrl = json.properties && json.properties.forecast;
    if (!forecastUrl) throw new Error("NWS points: forecast URL missing");
    await env.WEATHER_KV.put(`forecast-url:${lat},${lon}`, forecastUrl);
  }

  const r = await fetch(forecastUrl, { headers: { "User-Agent": ua, Accept: "application/geo+json" } });
  if (!r.ok) throw new Error(`NWS forecast ${r.status}`);
  const json = await r.json();
  const periods = (json.properties && json.properties.periods) || [];

  return periods.slice(0, 14).map((p) => ({
    name: p.name,
    isDaytime: p.isDaytime,
    tempF: p.temperature,
    tempUnit: p.temperatureUnit,
    shortForecast: p.shortForecast,
    detailedForecast: p.detailedForecast,
    windSummary: `${p.windSpeed || ""} ${p.windDirection || ""}`.trim(),
    icon: p.icon,
  }));
}

// ── Helpers ───────────────────────────────────────────────────────────

function cifLevel(wbgtF) {
  for (const tier of CIF_LEVELS) {
    if (wbgtF <= tier.max) return tier;
  }
  return CIF_LEVELS[CIF_LEVELS.length - 1];
}

function celsiusToFahrenheit(c) {
  if (c == null) return null;
  return (c * 9) / 5 + 32;
}

function metersPerSecondToMph(ms) {
  if (ms == null) return null;
  return ms * 2.236936;
}

function round(n, places) {
  if (n == null || Number.isNaN(n)) return null;
  const f = Math.pow(10, places);
  return Math.round(n * f) / f;
}

function jsonError(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
