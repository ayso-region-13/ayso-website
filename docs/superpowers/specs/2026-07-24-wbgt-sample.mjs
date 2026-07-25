// Sample station 33318 and compare WeatherFlow's own wet_bulb_globe_temperature
// against what our worker's computeWbgt() derives from the SAME observation.
// Requires WEATHERFLOW_API in the environment (direnv exec . node wbgt-sample.mjs).

const TOKEN = process.env.WEATHERFLOW_API;
if (!TOKEN) throw new Error("WEATHERFLOW_API not set — run via: direnv exec . node wbgt-sample.mjs");
const STATION = "33318";

const F = (c) => (c * 9) / 5 + 32;
const MPH_TO_MS = 0.44704;

// ── verbatim from workers/weather-api/src/index.js ──
function stullWetBulb(T, RH) {
  return T * Math.atan(0.151977 * Math.sqrt(RH + 8.313659)) + Math.atan(T + RH)
    - Math.atan(RH - 1.676331)
    + 0.00391838 * Math.pow(RH, 1.5) * Math.atan(0.023101 * RH) - 4.686035;
}
function approxGlobeTemp(T, S, W) {
  const wind = Math.max(W, 0.1);
  const delta = (1.1e8 * S) / (Math.pow(wind, 0.58) * 5.67e8);
  return T + Math.min(delta, 25);
}
function computeWbgt({ temperatureC: T, humidity: RH, windMs: W, solarWm2: S }) {
  return 0.7 * stullWetBulb(T, RH) + 0.2 * approxGlobeTemp(T, S, W) + 0.1 * T;
}
// ────────────────────────────────────────────────────

const CIF = [{ l: 1, max: 79.7 }, { l: 2, max: 84.6 }, { l: 3, max: 87.5 }, { l: 4, max: 89.7 }, { l: 5, max: Infinity }];
const cif = (f) => CIF.find((t) => f <= t.max).l;

// Query in SI to match exactly what the worker requests (units_temp=c etc).
const url = `https://swd.weatherflow.com/swd/rest/observations/station/${STATION}` +
  `?token=${TOKEN}&units_temp=c&units_wind=mps&units_pressure=mb&units_precip=mm&units_distance=km`;

const r = await fetch(url, { headers: { "User-Agent": "(ayso13.org weather page, info@ayso13.org)" } });
if (!r.ok) throw new Error(`Tempest ${r.status}`);
const json = await r.json();
const o = json.obs[0];

const obs = {
  temperatureC: o.air_temperature,
  humidity: o.relative_humidity,
  windMs: o.wind_avg ?? 0,
  solarWm2: o.solar_radiation ?? 0,
};

const ours = F(computeWbgt(obs));
const theirs = o.wet_bulb_globe_temperature;   // already °C because units_temp=c
const theirsF = theirs == null ? null : F(theirs);
const ourWb = F(stullWetBulb(obs.temperatureC, obs.humidity));
const theirWb = o.wet_bulb_temperature == null ? null : F(o.wet_bulb_temperature);
const rawDelta = (1.1e8 * obs.solarWm2) / (Math.pow(Math.max(obs.windMs, 0.1), 0.58) * 5.67e8);

const row = {
  at: new Date().toISOString(),
  obsTime: new Date(o.timestamp * 1000).toISOString(),
  tempF: +F(obs.temperatureC).toFixed(1),
  rh: obs.humidity,
  windMph: +(obs.windMs / MPH_TO_MS).toFixed(1),
  solar: obs.solarWm2,
  wbOursF: +ourWb.toFixed(2),
  wbTheirsF: theirWb == null ? null : +theirWb.toFixed(2),
  wbgtOursF: +ours.toFixed(1),
  wbgtTheirsF: theirsF == null ? null : +theirsF.toFixed(1),
  deltaF: theirsF == null ? null : +(ours - theirsF).toFixed(1),
  levelOurs: cif(ours),
  levelTheirs: theirsF == null ? null : cif(theirsF),
  globeCapped: rawDelta > 25,
  rawGlobeDelta: +rawDelta.toFixed(0),
};

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(row));
} else {
  console.log(`obs ${row.obsTime}`);
  console.log(`  ${row.tempF}°F  RH ${row.rh}%  wind ${row.windMph} mph  solar ${row.solar} W/m²`);
  console.log(`  wet bulb    ours ${row.wbOursF}°F   WeatherFlow ${row.wbTheirsF}°F`);
  console.log(`  WBGT        ours ${row.wbgtOursF}°F (L${row.levelOurs})   ` +
    `WeatherFlow ${row.wbgtTheirsF}°F (L${row.levelTheirs})   delta ${row.deltaF > 0 ? "+" : ""}${row.deltaF}°F`);
  console.log(`  globe delta raw ${row.rawGlobeDelta}°C ${row.globeCapped ? "-> CAPPED at 25" : "(under cap)"}`);
}

const ai = process.argv.indexOf("--append");
if (ai > -1) (await import("node:fs")).appendFileSync(process.argv[ai + 1], JSON.stringify(row) + "\n");
