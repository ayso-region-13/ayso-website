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
    // Authenticated connectivity self-test. A POST carrying the shared
    // X-Selftest-Key header posts a one-off test card to #notify-weather
    // through the REAL postSlack path (this Worker's own token + channel
    // var), then returns Slack's response. Driven by the `/ayso test-weather`
    // Slack command; also runnable ad-hoc for ops checks. GET is unaffected.
    if (request.method === "POST") {
      const key = request.headers.get("X-Selftest-Key");
      if (!env.WEATHER_SELFTEST_KEY || key !== env.WEATHER_SELFTEST_KEY) {
        return jsonError(403, "forbidden");
      }
      const data = await postSlack(env, [
        { type: "section", text: { type: "mrkdwn", text: ":satellite: *Weather notifications test* — confirms the weather Worker can post here. Real closure / NWS-alert / rain-forecast notices arrive in this channel automatically." } },
      ], "Weather notifications connectivity test");
      return new Response(JSON.stringify({ ok: !!(data && data.ok), slack: data }), {
        status: data && data.ok ? 200 : 502,
        headers: { "Content-Type": "application/json" },
      });
    }

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
    //
    // Slack notifications run ONLY on this cron path (never on the fetch()
    // cold-start refresh) so concurrent page loads can't double-post. They
    // run after the cache write and can never break the weather feed.
    try {
      const payload = await refresh(env);
      await notify(env, payload);
    } catch (err) {
      console.error("scheduled refresh failed:", err.message);
    }
  },
};

async function refresh(env) {
  const [tempestObs, nwsForecast, prevRainState, prevPayload] = await Promise.all([
    fetchTempest(env),
    fetchNwsForecast(env),
    env.WEATHER_KV.get("rain:state", { type: "json" }),
    env.WEATHER_KV.get(KV_KEY, { type: "json" }),
  ]);

  const wbgt = computeWbgt(tempestObs);
  const wbgtF = celsiusToFahrenheit(wbgt);
  const cif = cifLevel(wbgtF);

  const rainState = await updateRainState(env, tempestObs, prevRainState);
  const rain = rainAdvisory(rainState);

  // AQI refreshes less often than the 5-min weather cron to conserve PurpleAir
  // API points (default every 15 min via AQI_REFRESH_MINUTES). On the in-between
  // ticks we carry forward the last good reading from the cached payload; a
  // failed/null reading is retried every tick so we recover quickly.
  const nowMs = Date.now();
  const prevAq = prevPayload && prevPayload.airQuality;
  let airQuality, aqiFetchedAt;
  if (prevAq && prevAq.aqi != null &&
      !shouldRefreshAqi(prevPayload.aqiFetchedAt, nowMs, parseInt(env.AQI_REFRESH_MINUTES || "15", 10))) {
    airQuality = prevAq;
    aqiFetchedAt = prevPayload.aqiFetchedAt;
  } else {
    airQuality = await fetchAirQuality(env);
    aqiFetchedAt = nowMs;
  }

  const payload = {
    fetchedAt: new Date().toISOString(),
    aqiFetchedAt,
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
    airQuality: airQuality,
    closureRecommended: cif.level >= 5 || rain.closureRecommended || airQuality.closureRecommended,
    forecast: nwsForecast,
  };

  await env.WEATHER_KV.put(KV_KEY, JSON.stringify(payload), {
    expirationTtl: 60 * 60 * 24, // 24 h safety net if the cron stalls
  });
  return payload;
}

// ── Slack notifications ────────────────────────────────────────────────
//
// Three independent notifiers, all posting to #notify-weather via the
// shared AYSO Slack bot (SLACK_BOT_TOKEN). Each keeps its own state in KV
// so it only posts on a *change*, never every 5-min tick:
//   1. notifyClosure      — closureRecommended transitions (false↔true)
//   2. notifyNwsAlerts     — new / ended NWS active alerts (dedup by id)
//   3. notifyRainForecast  — heads-up when forecast PoP crosses a threshold
//
// The decision logic for each is a PURE function (closureTransition,
// diffAlertIds, rainForecastDecision) exported at the bottom for unit
// tests; the functions here are the thin IO shells around them.

async function notify(env, payload) {
  // allSettled so one notifier failing can't suppress the others.
  await Promise.allSettled([
    notifyClosure(env, payload),
    notifyNwsAlerts(env),
    notifyRainForecast(env, payload),
  ]);
}

async function postSlack(env, blocks, text) {
  const token = env.SLACK_BOT_TOKEN;
  const channel = env.NOTIFY_WEATHER_CHANNEL_ID;
  if (!token || !channel) {
    console.error("Slack notify skipped: SLACK_BOT_TOKEN or NOTIFY_WEATHER_CHANNEL_ID not set");
    return;
  }
  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ channel, blocks, text }),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) console.error("Slack postMessage failed:", data.error || res.status);
  return data;
}

// Build the human-readable reason list behind a closure recommendation.
function closureReasons(payload) {
  const reasons = [];
  if (payload.wbgt && payload.wbgt.level >= 5) {
    reasons.push("Heat: WBGT at CIF Level 5 — outdoor activity should be suspended");
  }
  if (payload.rain && payload.rain.closureRecommended && payload.rain.reason) {
    reasons.push("Rain: " + payload.rain.reason);
  }
  if (payload.airQuality && payload.airQuality.closureRecommended && payload.airQuality.reason) {
    reasons.push("Air quality: " + payload.airQuality.reason);
  }
  return reasons;
}

async function notifyClosure(env, payload) {
  const prev = await env.WEATHER_KV.get("notify:closure", { type: "json" });
  const prevActive = !!(prev && prev.active);
  const nowActive = !!payload.closureRecommended;
  const reasons = closureReasons(payload);
  const decision = closureTransition(prevActive, nowActive, reasons);
  if (!decision.post) return;

  if (decision.kind === "tripped") {
    const bullets = reasons.length ? reasons.map((r) => "• " + r).join("\n") : "• Weather closure threshold reached";
    await postSlack(env, [
      { type: "section", text: { type: "mrkdwn", text: `:warning: *Field-closure threshold reached*\n${bullets}` } },
      { type: "context", elements: [{ type: "mrkdwn", text: "Use `/ayso field` to set field status · <https://www.ayso13.org/resources/weather/|Weather & field conditions>" }] },
    ], `Field-closure threshold reached: ${reasons.join("; ") || "weather"}`);
  } else {
    await postSlack(env, [
      { type: "section", text: { type: "mrkdwn", text: ":white_check_mark: *Conditions are back below the closure threshold.* No weather-driven closure is recommended right now." } },
      { type: "context", elements: [{ type: "mrkdwn", text: "<https://www.ayso13.org/resources/weather/|Weather & field conditions>" }] },
    ], "Conditions back below the closure threshold");
  }
  await env.WEATHER_KV.put("notify:closure", JSON.stringify({ active: nowActive }));
}

async function notifyNwsAlerts(env) {
  let alerts;
  try {
    alerts = await fetchNwsAlerts(env);
  } catch (err) {
    // Keep stored state untouched on a fetch failure so we don't re-post
    // every still-active alert when the API recovers.
    console.error("NWS alerts fetch failed:", err.message);
    return;
  }
  const prev = await env.WEATHER_KV.get("notify:nwsAlerts", { type: "json" });

  // First run (no baseline): seed silently so a deploy during an existing
  // alert doesn't dump a burst of pre-existing alerts into the channel.
  if (!prev) {
    await env.WEATHER_KV.put("notify:nwsAlerts", JSON.stringify({ alerts: alerts.map((a) => ({ id: a.id, event: a.event })) }));
    return;
  }

  const prevAlerts = prev.alerts || [];
  const { newIds, endedIds } = diffAlertIds(prevAlerts.map((a) => a.id), alerts.map((a) => a.id));
  if (!newIds.length && !endedIds.length) return;

  const nowById = new Map(alerts.map((a) => [a.id, a]));
  const prevById = new Map(prevAlerts.map((a) => [a.id, a]));
  for (const id of newIds) {
    const a = nowById.get(id);
    await postSlack(env, alertBlocks(a), `NWS alert: ${a.event || "weather alert"}`);
  }
  for (const id of endedIds) {
    const ev = (prevById.get(id) || {}).event || "weather alert";
    await postSlack(env, [
      { type: "section", text: { type: "mrkdwn", text: `:checkered_flag: *NWS ${ev} ended* — no longer in effect for our area.` } },
    ], `NWS ${ev} ended`);
  }
  await env.WEATHER_KV.put("notify:nwsAlerts", JSON.stringify({ alerts: alerts.map((a) => ({ id: a.id, event: a.event })) }));
}

function alertBlocks(a) {
  const fmt = (iso) => {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    } catch (_) { return null; }
  };
  const lines = [`:rotating_light: *NWS ${a.event || "Weather Alert"}*`];
  if (a.severity) lines.push(`*Severity:* ${a.severity}`);
  if (a.headline) lines.push(a.headline);
  const onset = fmt(a.onset);
  const expires = fmt(a.expires);
  if (onset || expires) lines.push(`*In effect:* ${onset || "now"} → ${expires || "until further notice"}`);
  const blocks = [{ type: "section", text: { type: "mrkdwn", text: lines.join("\n") } }];
  if (a.url) blocks.push({ type: "context", elements: [{ type: "mrkdwn", text: `<${a.url}|View on weather.gov>` }] });
  return blocks;
}

async function notifyRainForecast(env, payload) {
  const threshold = parseInt(env.POP_FORECAST_THRESHOLD || "60", 10);
  const prev = await env.WEATHER_KV.get("notify:rainForecast", { type: "json" });
  const nowTs = Date.now();
  const decision = rainForecastDecision(payload.forecast || [], prev, threshold, nowTs);
  if (!decision.post) return;

  const p = decision.period;
  await postSlack(env, [
    { type: "section", text: { type: "mrkdwn", text: `:rain_cloud: *Rain in the forecast* — *${p.name}*: ${p.pop}% chance of precipitation.\n${p.shortForecast || ""}` } },
    { type: "context", elements: [{ type: "mrkdwn", text: "<https://www.ayso13.org/resources/weather/|7-day forecast> · <https://www.ayso13.org/resources/rain-policy/|Rain policy>" }] },
  ], `Rain in the forecast — ${p.name}: ${p.pop}%`);
  await env.WEATHER_KV.put("notify:rainForecast", JSON.stringify({ alertedPeriod: p.name, ts: nowTs }));
}

// ── Pure decision logic (unit-tested) ──────────────────────────────────

// Closure state machine: post only on a transition.
//   false→true → {post:true, kind:"tripped"}
//   true→false → {post:true, kind:"cleared"}
//   unchanged  → {post:false}
function closureTransition(prevActive, nowActive, reasons) {
  if (nowActive && !prevActive) return { post: true, kind: "tripped", reasons: reasons || [] };
  if (!nowActive && prevActive) return { post: true, kind: "cleared", reasons: [] };
  return { post: false, kind: null, reasons: [] };
}

// Set difference over alert id lists.
function diffAlertIds(prevIds, nowIds) {
  const prev = new Set(prevIds || []);
  const now = new Set(nowIds || []);
  const newIds = [...now].filter((id) => !prev.has(id));
  const endedIds = [...prev].filter((id) => !now.has(id));
  return { newIds, endedIds };
}

// Rain-forecast throttle. Scans the next ~72h (6 day/night periods) for the
// soonest period whose PoP meets the threshold. Posts unless we already
// alerted on that same period within the last 24h.
function rainForecastDecision(periods, prev, threshold, nowTs) {
  const horizon = (periods || []).slice(0, 6);
  const rainy = horizon.find((p) => p && typeof p.pop === "number" && p.pop >= threshold);
  if (!rainy) return { post: false, period: null };
  const within24h = !!(prev && prev.ts && (nowTs - prev.ts) < 24 * 60 * 60 * 1000);
  const samePeriod = !!(prev && prev.alertedPeriod === rainy.name);
  if (within24h && samePeriod) return { post: false, period: null };
  return { post: true, period: rainy };
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

// ── Air quality (AirNow / EPA) ─────────────────────────────────────────
//
// AirNow is the EPA's official AQI feed — same data schools, fire
// departments, and the South Coast AQMD reference. Free with an API key
// from https://docs.airnowapi.org/ ; we read the nearest reporting area
// to our forecast lat/lon. The endpoint returns one row per pollutant
// (O3, PM2.5, PM10); we report the dominant (highest-AQI) row.
//
// Closure threshold: AQI > 150 (EPA "Unhealthy" or worse). See
// /resources/air-quality-policy/ for the policy that drives this number.

const AQI_CLOSURE_THRESHOLD = 150;

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

// ── PurpleAir parse + composite ────────────────────────────────────────

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

async function fetchAirNow(env) {
  const key = env.AIRNOW_API_KEY;
  if (!key) {
    // Soft fail: AirNow key is optional; without it we report the
    // airQuality block as unavailable rather than throwing.
    return null;
  }
  const lat = env.FORECAST_LAT;
  const lon = env.FORECAST_LON;
  const qs =
    `?format=application/json&latitude=${lat}&longitude=${lon}` +
    `&distance=25&API_KEY=${key}`;

  // AirNow is the FALLBACK source for AQI (PurpleAir is primary). It uses the
  // "Current Observations by Latitude/Longitude or ZIP Code" service
  // (/aq/observation/current/ziplatlong/, live 2026-06-17). The older
  // /aq/observation/latLong/current/ endpoint was dropped 2026-06-21 ahead of
  // its 2026-09-30 retirement. A response is only ACCEPTED if it actually
  // contains a usable numeric AQI (hasUsableAqi); otherwise we log a sample and
  // return null so the card shows "unavailable" rather than blank/garbage.
  const url = "https://www.airnowapi.org/aq/observation/current/ziplatlong/" + qs;
  try {
    const r = await fetch(url, { headers: { "User-Agent": env.USER_AGENT } });
    if (!r.ok) {
      console.error(`AirNow HTTP ${r.status}`);
      return null;
    }
    const json = await r.json();
    if (hasUsableAqi(json)) {
      console.log("AirNow served (ziplatlong)");
      return json;
    }
    const sample = Array.isArray(json) ? JSON.stringify(json[0] || null) : JSON.stringify(json);
    console.error(`AirNow no usable AQI (rows=${Array.isArray(json) ? json.length : "n/a"}) sample=${(sample || "").slice(0, 400)}`);
  } catch (err) {
    console.error("AirNow fetch failed:", err.message);
  }
  return null;
}

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

// Decide whether the AQI reading is due for a refresh. AQI is fetched on a
// slower cadence than the 5-min weather cron to conserve PurpleAir API points.
// A 1-min slack absorbs cron jitter so a 15-min interval doesn't slip to 20.
function shouldRefreshAqi(prevFetchedAtMs, nowMs, intervalMin) {
  if (!prevFetchedAtMs) return true;
  const slackMs = 60 * 1000;
  return (nowMs - prevFetchedAtMs) >= (intervalMin * 60 * 1000 - slackMs);
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

// True only if the response is a non-empty array with at least one row
// carrying a numeric AQI — the minimum airAdvisory() needs to report a value.
function hasUsableAqi(json) {
  return normalizeAirNow(json).length > 0;
}

// Normalize an AirNow observations array to a canonical row shape, tolerating
// BOTH endpoint schemas:
//   old /aq/observation/latLong/current/ : AQI, ParameterName ("O3"),
//     Category.Name, ReportingArea, DateObserved, HourObserved (10), LocalTimeZone
//   new /aq/observation/current/ziplatlong/ : nowcastAQI, parameterName ("OZONE"),
//     aqiCategoryName, reportingAreaName, dateObserved, hourObserved ("11:00"),
//     localTimeZone
// Rows without a numeric AQI are dropped. Returns [] for null/non-array input.
function normalizeAirNow(json) {
  if (!Array.isArray(json)) return [];
  return json
    .map((o) => {
      if (!o || typeof o !== "object") return null;
      const aqi =
        typeof o.AQI === "number" ? o.AQI
        : typeof o.nowcastAQI === "number" ? o.nowcastAQI
        : null;
      if (aqi === null) return null;
      let parameter = o.ParameterName || o.parameterName || null;
      // New endpoint labels ozone "OZONE"/"Ozone"; old uses "O3". The docs and
      // the live response also disagree on case (AQICategoryName vs
      // aqiCategoryName), so match defensively.
      if (parameter && /^ozone$/i.test(parameter)) parameter = "O3";
      let hour = null;
      if (typeof o.HourObserved === "number") hour = o.HourObserved;
      else if (typeof o.hourObserved === "string") {
        const m = o.hourObserved.match(/^(\d{1,2})/);
        if (m) hour = parseInt(m[1], 10);
      }
      return {
        aqi,
        parameter,
        categoryName:
          (o.Category && o.Category.Name) || o.aqiCategoryName || o.AQICategoryName || null,
        reportingArea: o.ReportingArea || o.reportingAreaName || null,
        dateObserved: o.DateObserved || o.dateObserved || null,
        hour,
        tz: o.LocalTimeZone || o.localTimeZone || null,
      };
    })
    .filter(Boolean);
}

function airAdvisory(observations) {
  const rows = normalizeAirNow(observations);
  if (rows.length === 0) {
    return {
      aqi: null,
      category: null,
      dominantPollutant: null,
      reportingArea: null,
      observedAt: null,
      thresholdAqi: AQI_CLOSURE_THRESHOLD,
      closureRecommended: false,
      reason: null,
      source: null,
    };
  }

  // Pick the observation with the highest AQI — that's the dominant
  // pollutant driving the EPA category. Ties go to PM2.5 (more concerning
  // for short-term exertion).
  rows.sort((a, b) => {
    if (b.aqi !== a.aqi) return b.aqi - a.aqi;
    const pm = (r) => (r.parameter === "PM2.5" ? 0 : 1);
    return pm(a) - pm(b);
  });
  const top = rows[0];

  let observedAt = null;
  if (top.dateObserved && top.hour != null) {
    // AirNow returns local time; we just record what they reported.
    observedAt = `${String(top.dateObserved).trim()} ${String(top.hour).padStart(2, "0")}:00 ${top.tz || ""}`.trim();
  }

  const closureRecommended = top.aqi > AQI_CLOSURE_THRESHOLD;

  return {
    aqi: top.aqi,
    category: top.categoryName,
    dominantPollutant: top.parameter,
    reportingArea: top.reportingArea,
    observedAt,
    thresholdAqi: AQI_CLOSURE_THRESHOLD,
    closureRecommended,
    reason: closureRecommended
      ? `AQI ${top.aqi} (${top.categoryName || "Unhealthy"}) — above the ${AQI_CLOSURE_THRESHOLD} closure threshold`
      : null,
    source: "AirNow / EPA",
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
    // NWS gives probabilityOfPrecipitation as { unitCode, value } where
    // value is 0-100 or null. Surface the bare number for the forecast
    // heads-up notifier (and any future page use).
    pop: (p.probabilityOfPrecipitation && p.probabilityOfPrecipitation.value != null)
      ? p.probabilityOfPrecipitation.value
      : null,
    shortForecast: p.shortForecast,
    detailedForecast: p.detailedForecast,
    windSummary: `${p.windSpeed || ""} ${p.windDirection || ""}`.trim(),
    icon: p.icon,
  }));
}

async function fetchNwsAlerts(env) {
  const lat = env.FORECAST_LAT;
  const lon = env.FORECAST_LON;
  const ua = env.USER_AGENT || "(ayso-region-13)";
  const url = `https://api.weather.gov/alerts/active?point=${lat},${lon}`;
  const r = await fetch(url, { headers: { "User-Agent": ua, Accept: "application/geo+json" } });
  if (!r.ok) throw new Error(`NWS alerts ${r.status}`);
  const json = await r.json();
  return ((json && json.features) || []).map((f) => {
    const props = f.properties || {};
    return {
      id: f.id,
      event: props.event || null,
      severity: props.severity || null,
      headline: props.headline || null,
      onset: props.onset || props.effective || null,
      expires: props.expires || props.ends || null,
      url: props["@id"] || f.id,
    };
  });
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

// Named exports for unit tests (Node). The Worker runtime uses the default
// export above and ignores these.
export { closureTransition, diffAlertIds, rainForecastDecision, closureReasons, normalizeAirNow, airAdvisory, hasUsableAqi, epaCorrect, pm25ToAqi, aqiCategory, parsePurpleAir, compositePm25, purpleAirAdvisory, shouldRefreshAqi };
