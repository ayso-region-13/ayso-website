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
      // Also render the REAL closure card against the live payload so the
      // self-test previews the exact wording a closure would post. Heat is
      // forced on (heatActive=true) so the live WBGT value shows even when
      // conditions are calm; the card is clearly labeled a drill.
      const livePayload = (await env.WEATHER_KV.get(KV_KEY, { type: "json" })) || {};
      const sample = closureTrippedCard(closureReasons(livePayload, true), payloadAsOf(livePayload));
      const data = await postSlack(env, [
        { type: "section", text: { type: "mrkdwn", text: ":satellite: *Weather notifications test* — confirms the weather Worker can post here. Real closure / NWS-alert / rain-forecast notices arrive in this channel automatically." } },
        { type: "divider" },
        { type: "context", elements: [{ type: "mrkdwn", text: ":test_tube: *Sample closure card (TEST — not a real closure)* — this is the exact wording a heat closure would post:" }] },
        ...sample.blocks,
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

  const wbgtF = celsiusToFahrenheit(tempestObs.wbgtC);
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
  await logObservation(env, payload);
  return payload;
}

// ── Observation log (D1) ───────────────────────────────────────────────
//
// KV holds only the latest reading, so without this table the site had no
// history: "how many hours were we in Level 4 last week" was unanswerable.
// It cannot be backfilled — Tempest exposes wet_bulb_globe_temperature only on
// the CURRENT observation (time_start / day_offset / bucket are silently ignored
// on that endpoint, the device-level history carries raw sensor fields with no
// WBGT, and the stats endpoint has none either), so history starts here.
//
// Written from refresh(), which means the fetch() cold-start path logs too. That
// is safe because observed_at is the primary key and the insert ignores
// conflicts. A D1 failure must never break the weather feed, hence the catch:
// the log is analytics, the feed is the product.
async function logObservation(env, payload) {
  if (!env.WEATHER_DB) return; // binding not configured yet
  const c = payload.current || {};
  const w = payload.wbgt || {};
  const a = payload.airQuality || {};
  const r = payload.rain || {};
  const observedMs = new Date(c.stationTimestamp || payload.fetchedAt).getTime();
  if (!Number.isFinite(observedMs)) return;
  try {
    await env.WEATHER_DB.prepare(
      `INSERT INTO observations
         (observed_at, wbgt_f, cif_level, temp_f, feels_like_f, humidity,
          wind_mph, solar_wm2, aqi, rain_48h_in, closure)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(observed_at) DO NOTHING`
    ).bind(
      Math.floor(observedMs / 1000),
      w.valueF ?? null,
      w.level ?? null,
      c.tempF ?? null,
      c.feelsLikeF ?? null,
      c.humidity ?? null,
      c.windMph ?? null,
      c.solarWm2 ?? null,
      a.aqi ?? null,
      r.last48hInches ?? null,
      payload.closureRecommended ? 1 : 0
    ).run();
  } catch (err) {
    console.error("observation log write failed:", err.message);
  }
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
// The decision logic for each is a PURE function (closureNotifyDecision,
// diffAlertIds, rainForecastDecision) exported at the bottom for unit
// tests; the functions here are the thin IO shells around them.

async function notify(env, payload) {
  const tasks = [
    notifyHeatWarning(env, payload),
    notifyClosure(env, payload),
    notifyRainForecast(env, payload),
  ];
  // The NWS active-alert notifier is opt-in (disabled by default — it was too
  // noisy in #notify-weather). Re-enable by setting NWS_ALERTS_ENABLED="true"
  // in wrangler.toml [vars]. When off we skip the fetch entirely.
  if (String(env.NWS_ALERTS_ENABLED || "").toLowerCase() === "true") {
    tasks.push(notifyNwsAlerts(env));
  }
  // allSettled so one notifier failing can't suppress the others.
  await Promise.allSettled(tasks);
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
// `heatActive` (optional) is the notifier's hysteresis-latched heat flag: when
// supplied it decides the heat line instead of the raw live CIF level. This
// matters because the notifier keeps a heat closure active across the 88–89.7°F
// deadband (CIF Level 4 territory) — without it, a closure that tripped on heat
// but whose WBGT dipped into that band before the notice posted would produce
// an empty list and fall through to a generic "threshold reached" bullet.
function closureReasons(payload, heatActive) {
  const reasons = [];
  const wbgt = payload.wbgt || {};
  const level = typeof wbgt.level === "number" ? wbgt.level : null;
  const heat = heatActive != null ? heatActive : (level != null && level >= 5);
  if (heat) {
    const value = typeof wbgt.valueF === "number"
      ? `WBGT ${wbgt.valueF}°F`
      : "WBGT";
    // Only claim "CIF Level 5" when the live reading actually reads Level 5;
    // in the hysteresis deadband the value is honest but the level label isn't.
    const suffix = level != null && level >= 5 ? " (CIF Level 5)" : "";
    reasons.push(`Heat: ${value}${suffix} — outdoor activity should be suspended`);
  }
  if (payload.rain && payload.rain.closureRecommended && payload.rain.reason) {
    reasons.push("Rain: " + payload.rain.reason);
  }
  if (payload.airQuality && payload.airQuality.closureRecommended && payload.airQuality.reason) {
    reasons.push("Air quality: " + payload.airQuality.reason);
  }
  return reasons;
}

// Render the "field-closure threshold reached" Slack card from a reason list.
// Shared by notifyClosure (the real notice) and the self-test's sample preview
// so the two can never drift in wording.
// `asOf` is the reading's own timestamp, preformatted Pacific ("11:15 AM PT").
// It matters more than it looks: the card is a frozen snapshot posted up to
// CLOSURE_DWELL_MINUTES after the threshold was crossed, and on a hot morning
// WBGT keeps climbing after that, so an unstamped number reads as though it
// disagrees with the live page. Stamped, the two reconcile.
function closureTrippedCard(reasons, asOf) {
  const bullets = reasons.length ? reasons.map((r) => "• " + r).join("\n") : "• Weather closure threshold reached";
  return {
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: `:warning: *Field-closure threshold reached*\n${bullets}` } },
      { type: "context", elements: [{ type: "mrkdwn", text: contextLine(asOf, "Use `/ayso field` to set field status", "<https://www.ayso13.org/resources/weather/|Weather & field conditions>") }] },
    ],
    text: `Field-closure threshold reached: ${reasons.join("; ") || "weather"}`,
  };
}

// Join a Slack context line, dropping the "as of" segment when no usable
// timestamp was available rather than printing a half-empty stamp.
function contextLine(asOf, ...rest) {
  return [asOf ? `Reading as of ${asOf}` : null, ...rest].filter(Boolean).join(" · ");
}

// Notifier state is identical on the vast majority of ticks (nothing is
// changing), and KV writes are metered. Read the raw string alongside the
// parsed object so the caller can skip the put when the serialized state is
// unchanged; a corrupt value parses to {} and gets rewritten on the next tick.
async function readNotifyState(env, key) {
  const text = await env.WEATHER_KV.get(key);
  let parsed = {};
  try { parsed = text ? JSON.parse(text) : {}; } catch (_) { parsed = {}; }
  return { parsed, text };
}

async function writeNotifyState(env, key, state, prevText) {
  const next = JSON.stringify(state);
  if (next === prevText) return;
  await env.WEATHER_KV.put(key, next);
}

async function notifyClosure(env, payload) {
  const { parsed: raw, text: prevText } = await readNotifyState(env, "notify:closure");
  // Back-compat: old state was just { active: bool }. Carry `active` forward as
  // `posted`, but do NOT seed `heatActive` from it — the old flag could have
  // been set by a rain/AQI closure, and latching heatActive true from that
  // (then holding it through a WBGT gap) would suppress the eventual "cleared"
  // post. Seed heatActive false and let the first tick recompute it from the
  // live WBGT (a genuine Level 5 re-arms it immediately; otherwise it clears).
  const state = {
    posted: raw.posted ?? raw.active ?? false,
    heatActive: raw.heatActive ?? false,
    candidate: raw.candidate,
    since: raw.since || 0,
  };
  const input = {
    wbgtF: payload.wbgt && typeof payload.wbgt.valueF === "number" ? payload.wbgt.valueF : null,
    rain: !!(payload.rain && payload.rain.closureRecommended),
    aqi: !!(payload.airQuality && payload.airQuality.closureRecommended),
  };
  const cfg = {
    tripF: parseFloat(env.WBGT_TRIP_F || "89.7"),
    clearF: parseFloat(env.WBGT_CLEAR_F || "88.0"),
    dwellMs: parseInt(env.CLOSURE_DWELL_MINUTES || "15", 10) * 60 * 1000,
  };
  const decision = closureNotifyDecision(state, input, Date.now(), cfg);
  // Always persist the updated state (heat hysteresis + dwell timer advance),
  // even on ticks that don't post — but only when it actually changed.
  await writeNotifyState(env, "notify:closure", decision.state, prevText);
  if (!decision.post) return;

  if (decision.kind === "tripped") {
    // Build the reasons from the decision's hysteresis-latched heat flag (not the
    // raw live level) so a heat closure that dipped into the 88–89.7°F deadband
    // during the dwell still names heat instead of a generic bullet.
    const reasons = closureReasons(payload, decision.state.heatActive);
    const { blocks, text } = closureTrippedCard(reasons, payloadAsOf(payload));
    await postSlack(env, blocks, text);
  } else {
    await postSlack(env, [
      { type: "section", text: { type: "mrkdwn", text: ":white_check_mark: *Conditions are back below the closure threshold.* No weather-driven closure is recommended right now." } },
      { type: "context", elements: [{ type: "mrkdwn", text: contextLine(payloadAsOf(payload), "<https://www.ayso13.org/resources/weather/|Weather & field conditions>") }] },
    ], "Conditions back below the closure threshold");
  }
}

// Render the Level-4 heat-advisory card. Copy mirrors the site's own Level 4
// banner (WBGT_BANNERS[4] in site/src/resources/weather.md) and the heat-policy
// table, so Slack and the page say the same thing.
function heatWarnCard(wbgtF, level, asOf) {
  const value = typeof wbgtF === "number" ? `WBGT ${wbgtF}\u00b0F` : "WBGT";
  const limits = [
    "• Practice: maximum 1 hour, four 4-minute water breaks per hour, no equipment",
    "• Games: length reduced by one-third, with additional water breaks at the 1/8 marks",
  ].join("\n");
  // The advisory is always about the Level 4 threshold — that is what was
  // crossed. But WBGT can climb past Level 5 during the 15-minute dwell (today's
  // 09:00–09:30 ramp was 4.5°F), and printing Level 4 limits beside a Level 5
  // reading would be wrong. Name the escalation instead; notifyClosure owns the
  // suspension notice itself.
  const escalated = typeof level === "number" && level >= 5
    ? "\nWBGT has since reached CIF Level 5; a closure notice follows."
    : "";
  return {
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: `:thermometer: *Heat advisory \u2014 CIF Level 4*\n${value}. Strict limits on practice; games are shortened with extra water breaks.\n${limits}${escalated}` } },
      { type: "context", elements: [{ type: "mrkdwn", text: contextLine(asOf, "<https://www.ayso13.org/resources/heat-policy/|Heat policy>", "<https://www.ayso13.org/resources/weather/|Weather & field conditions>") }] },
    ],
    text: `Heat advisory \u2014 CIF Level 4: ${value}`,
  };
}

// Level-4 heads-up. Fires ahead of the closure notice so coaches get warning
// before WBGT reaches the Level 5 suspension threshold, and clears when the
// heat backs off. Independent of notifyClosure by design (see heatWarnDecision):
// on a fast jump straight past Level 4 into Level 5 both post, which is honest
// rather than redundant.
async function notifyHeatWarning(env, payload) {
  const { parsed: raw, text: prevText } = await readNotifyState(env, "notify:heatWarn");
  const state = {
    posted: raw.posted ?? false,
    active: raw.active ?? false,
    candidate: raw.candidate,
    since: raw.since || 0,
  };
  const wbgtF = payload.wbgt && typeof payload.wbgt.valueF === "number" ? payload.wbgt.valueF : null;
  const cfg = {
    tripF: parseFloat(env.WBGT_WARN_TRIP_F || "87.5"),
    clearF: parseFloat(env.WBGT_WARN_CLEAR_F || "86.0"),
    dwellMs: parseInt(env.CLOSURE_DWELL_MINUTES || "15", 10) * 60 * 1000,
  };
  const decision = heatWarnDecision(state, wbgtF, Date.now(), cfg);

  // First run (no state key yet): seed silently, the same way notifyNwsAlerts
  // does. Without this, a deploy on a hot afternoon posts an advisory 15 min
  // later for heat that has been going for hours — and its escalation line
  // would promise a closure notice that already fired long before. Seeding
  // `posted` from the latch means the eventual "dropped below Level 4" still
  // lands, which is the part worth hearing.
  if (prevText == null) {
    await env.WEATHER_KV.put("notify:heatWarn", JSON.stringify({
      posted: decision.state.active, candidate: null, since: 0, active: decision.state.active,
    }));
    return;
  }

  await writeNotifyState(env, "notify:heatWarn", decision.state, prevText);
  if (!decision.post) return;

  const asOf = payloadAsOf(payload);
  if (decision.kind === "tripped") {
    const level = payload.wbgt && typeof payload.wbgt.level === "number" ? payload.wbgt.level : 4;
    const { blocks, text } = heatWarnCard(wbgtF, level, asOf);
    await postSlack(env, blocks, text);
  } else {
    await postSlack(env, [
      { type: "section", text: { type: "mrkdwn", text: `:sunny: *Heat has dropped below CIF Level 4.*${typeof wbgtF === "number" ? ` WBGT ${wbgtF}\u00b0F.` : ""} Normal practice and game limits apply.` } },
      { type: "context", elements: [{ type: "mrkdwn", text: contextLine(asOf, "<https://www.ayso13.org/resources/heat-policy/|Heat policy>") }] },
    ], "Heat has dropped below CIF Level 4");
  }
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

// Shared notifier primitives ------------------------------------------------
//
// Both heat notifiers (Level 4 advisory, Level 5 closure) need the same two
// mechanisms, so they live here once:
//
//   heatLatch — hysteresis. Once active it stays active until WBGT falls to
//     clearF, so a reading bouncing at the boundary can't clear-and-re-trip.
//     A missing WBGT holds the prior state: a deliberate fail-safe, because
//     while the sensor is blind we would rather keep a posted notice up than
//     declare an all-clear on no data. A prolonged outage therefore holds the
//     notice until valid WBGT returns.
//
//   dwellGate — any change must persist dwellMs before it is announced, which
//     filters transient one-tick spikes.
//
// Trips use strict `> tripF` to match the site, whose level comes from
// cifLevel() and puts a value exactly equal to a tier max in the LOWER tier
// (`<= max`). Using `>=` here would announce a level the live page doesn't show.
function heatLatch(prevActive, wbgtF, tripF, clearF) {
  if (typeof wbgtF !== "number") return !!prevActive;
  return prevActive ? wbgtF > clearF : wbgtF > tripF;
}

// `state` carries { posted, candidate, since }; the caller merges its own
// extra fields (heatActive/active) into the returned `next`.
function dwellGate(state, desired, nowMs, dwellMs) {
  const posted = !!state.posted;
  const candidate = state.candidate === true || state.candidate === false ? state.candidate : null;
  const since = state.since || 0;

  // No pending change → clear any candidate, don't post.
  if (desired === posted) return { post: false, kind: null, next: { posted, candidate: null, since: 0 } };
  // A change is pending. Start (or restart) the dwell timer for a new candidate.
  if (candidate !== desired) return { post: false, kind: null, next: { posted, candidate: desired, since: nowMs } };
  // Candidate unchanged — has it held long enough?
  if (nowMs - since >= dwellMs) {
    return { post: true, kind: desired ? "tripped" : "cleared", next: { posted: desired, candidate: null, since: 0 } };
  }
  // Still waiting out the dwell.
  return { post: false, kind: null, next: { posted, candidate: desired, since } };
}

// Closure state machine: post only on a transition.
//   false→true → {post:true, kind:"tripped"}
//   true→false → {post:true, kind:"cleared"}
//   unchanged  → {post:false}
// Heat is hysteresed and dwelled (see above). Rain/AQI don't flap, so they pass
// through un-hysteresed but still respect the dwell.
// Pure + unit-tested. `state` carries { posted, heatActive, candidate, since }.
// `input` = { wbgtF|null, rain, aqi, reasons }. Returns { post, kind, reasons, state }.
function closureNotifyDecision(state, input, nowMs, cfg) {
  const heatActive = heatLatch(state.heatActive, input.wbgtF, cfg.tripF, cfg.clearF);
  const desired = heatActive || !!input.rain || !!input.aqi;
  const gate = dwellGate(state, desired, nowMs, cfg.dwellMs);
  return {
    post: gate.post,
    kind: gate.kind,
    reasons: gate.post && desired ? input.reasons || [] : [],
    state: { ...gate.next, heatActive },
  };
}

// Level-4 heat-advisory state machine. Same primitives at the Level 4 boundary,
// and deliberately INDEPENDENT of the closure notifier: the advisory stays
// latched through Level 5, so an escalation posts the closure notice without
// re-posting the advisory, and a drop from 5 back to 4 stays quiet because the
// advisory never cleared. It clears only when WBGT falls under clearF.
// Pure + unit-tested. `state` carries { posted, active, candidate, since }.
function heatWarnDecision(state, wbgtF, nowMs, cfg) {
  const active = heatLatch(state.active, wbgtF, cfg.tripF, cfg.clearF);
  const gate = dwellGate(state, active, nowMs, cfg.dwellMs);
  return { post: gate.post, kind: gate.kind, state: { ...gate.next, active } };
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

// "11:15 AM PT" in Pacific for an ISO timestamp — how the Slack cards stamp
// the reading they were built from. Returns null for a missing or unparseable
// input so callers can drop the segment instead of printing "Invalid Date".
function pacificClock(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  try {
    return d.toLocaleString("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", minute: "2-digit" }) + " PT";
  } catch (_) { return null; }
}

// The "as of" stamp for a payload: the station's own observation time, falling
// back to when we fetched it. Prefer the station time — that is when the sensor
// actually read the value the card is about.
function payloadAsOf(payload) {
  const c = (payload && payload.current) || {};
  return pacificClock(c.stationTimestamp || (payload && payload.fetchedAt));
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

  // WBGT comes from the station's own derived field. Guard it the same way as
  // the observation itself: cifLevel(null) would return Level 1 ("normal
  // activities") because null coerces to 0, i.e. a missing sensor would publish
  // an all-clear. Fail loudly instead so KV keeps the last-good payload.
  if (obs.wet_bulb_globe_temperature == null) {
    throw new Error("Tempest: no wet_bulb_globe_temperature in response");
  }

  // Tempest payload shape (selected fields, all SI units due to query):
  //   air_temperature, relative_humidity, wind_avg, wind_gust,
  //   solar_radiation, feels_like, conditions, timestamp (epoch s),
  //   wet_bulb_globe_temperature (station-derived WBGT),
  //   precip_accum_local_day (mm since local midnight),
  //   precip_accum_local_yesterday (mm, yesterday's full-day total).
  return {
    temperatureC: obs.air_temperature,
    wbgtC: obs.wet_bulb_globe_temperature,
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
// WBGT is read from the Tempest station's own `wet_bulb_globe_temperature`
// field, not derived here. We previously computed it locally, but that
// implementation clamped its globe-temperature term to a constant +25°C, and
// the clamp bound above ~86 W/m² of solar at calm wind — every daylight hour.
// Solar and wind therefore had no effect on the published value, which read
// 2 to 8.5°F too hot against the station's own figure and repeatedly reported
// CIF Level 5 ("outdoor activity suspended") where the station read Level 2-3.
// See docs/superpowers/specs/2026-07-24-wbgt-source-design.md.

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
export { closureNotifyDecision, heatWarnDecision, heatLatch, dwellGate, heatWarnCard, pacificClock, payloadAsOf, contextLine, diffAlertIds, rainForecastDecision, closureReasons, closureTrippedCard, normalizeAirNow, airAdvisory, hasUsableAqi, epaCorrect, pm25ToAqi, aqiCategory, parsePurpleAir, compositePm25, purpleAirAdvisory, shouldRefreshAqi };
