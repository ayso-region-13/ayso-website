---

title: "Weather and Field Conditions"
layout: page.njk
section: resources
description: "Current conditions, Wet Bulb Globe Temperature (WBGT), and 7-day forecast for AYSO Region 13 fields in Pasadena. Live data from our Tempest weather station."
heroImage: /images/action-04.jpg
showFieldStatus: true
---

Live conditions from Region 13's Tempest weather station, plus the current Wet Bulb Globe Temperature (WBGT) and the corresponding California CIF heat-policy alert level. For what each level means, see the [Heat Policy](/resources/heat-policy/) page.

<div id="simulate-banner" class="bg-brand-cream border-l-4 border-brand-red-dark p-3 mb-6 not-prose" hidden></div>

<div id="rain-banner" class="not-prose mb-6" aria-live="assertive" hidden></div>

<div id="air-banner" class="not-prose mb-6" aria-live="assertive" hidden></div>

<div id="heat-banner" class="not-prose mb-6" aria-live="assertive" hidden></div>

<div id="weather-loading" class="bg-brand-cream p-4 mb-6 text-brand-dark text-sm not-prose">
  Loading current conditions…
</div>

<div id="weather-error" class="bg-brand-cream border-l-4 border-brand-red-dark p-4 mb-6 not-prose" hidden>
  <p class="font-semibold text-brand-red-dark mb-1">Live data temporarily unavailable</p>
  <p class="text-brand-dark text-sm m-0">We couldn't reach the weather station. Try refreshing in a minute. For the official heat-alert call, check the home page banner.</p>
</div>

<div id="weather-content" hidden>

## Current conditions

<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 not-prose">
  <div class="bg-brand-cream p-4">
    <p class="text-sm uppercase tracking-wider text-brand-dark mb-1">Temperature</p>
    <p class="text-4xl font-bold text-brand-dark leading-none mb-2"><span id="temp">—</span></p>
    <p class="text-sm text-gray-700 m-0">Feels like <span id="feels-like">—</span></p>
    <p class="text-sm text-gray-700 m-0">Humidity <span id="humidity">—</span>%</p>
    <p class="text-sm text-gray-700 m-0">Wind <span id="wind">—</span> mph</p>
    <p class="text-xs text-gray-500 mt-2 m-0">Updated <span id="updated">—</span></p>
    <p class="text-xs mt-1 m-0"><a href="#" id="unit-toggle" class="text-brand-red-dark underline">Switch to °C</a></p>
  </div>
  <div class="bg-brand-cream p-4">
    <p class="text-sm uppercase tracking-wider text-brand-dark mb-1">WBGT, CIF Level <span id="cif-level">—</span></p>
    <p class="text-4xl font-bold text-brand-dark leading-none mb-2"><span id="wbgt">—</span></p>
    <p class="text-sm font-semibold text-brand-dark mb-1" id="cif-label">—</p>
    <p class="text-xs text-gray-500 mt-2 m-0">Updated <span id="wbgt-updated">—</span></p>
    <p class="text-xs text-gray-500 mt-1 m-0"><a href="/resources/heat-policy/" class="text-brand-red-dark underline">All alert levels →</a></p>
  </div>
  <div class="bg-brand-cream p-4">
    <p class="text-sm uppercase tracking-wider text-brand-dark mb-1">Air Quality (AQI)</p>
    <p class="text-4xl font-bold text-brand-dark leading-none mb-2"><span id="aqi">—</span></p>
    <p class="text-sm font-semibold text-brand-dark mb-1" id="aqi-category">—</p>
    <p class="text-sm text-gray-700 m-0">Pollutant: <span id="aqi-pollutant">—</span></p>
    <p class="text-xs text-gray-500 mt-2 m-0">Updated <span id="aqi-updated">—</span></p>
    <p class="text-xs text-gray-500 mt-1 m-0"><a href="/resources/air-quality-policy/" class="text-brand-red-dark underline">All AQI bands →</a></p>
  </div>
</div>

</div>

<div id="forecast-section" hidden>

## 7-day forecast

<div id="forecast-grid" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6 not-prose"></div>

</div>

## About this data

Current conditions come from Region 13's [Tempest WeatherFlow](https://weatherflow.com/tempest-home-weather-system/) station, polled every five minutes. Forecast data is from the [National Weather Service](https://www.weather.gov/) for Pasadena, California.

Air quality (AQI) is a median composite of nearby [PurpleAir](https://www2.purpleair.com/) sensors in Pasadena, Altadena, and La Cañada, EPA-corrected and converted to the AQI scale, refreshed every 15 minutes; if those sensors are unavailable it falls back to the EPA's [AirNow](https://www.airnow.gov/) regulatory monitors. See the [Air Quality Policy](/resources/air-quality-policy/) for details.

WBGT (Wet Bulb Globe Temperature) combines air temperature, humidity, wind speed, and solar radiation into a single heat-stress measure. The value shown here is calculated by our Tempest weather station from its own sensor readings. Because WBGT varies with shade, surface, and microclimate, a reading from the station may differ from conditions at a specific field.

The field-status bar at the top of this page is human-controlled. It reflects what Region 13 board members have set via Slack, and is the same status shown on the [home page](/). A high WBGT reading above does not automatically close fields; a board member still makes that call.

## Related

- [Heat Policy](/resources/heat-policy/): CIF alert levels and required actions
- [Rain Policy](/resources/rain-policy/): wet-field closure thresholds
- [Air Quality Policy](/resources/air-quality-policy/): EPA AQI thresholds and required actions
- [Safety](/resources/safety/): concussion, sudden cardiac arrest, incident reporting

<script>
(function () {
  // Two-tier alert palette mirroring the site's field-status semantics:
  //   Levels 2–3 → "Monitoring" (gold + dark text)
  //   Levels 4–5 → "Closed"     (red-dark + white text)
  // Both color combos are validated AA elsewhere on the site (home-page
  // field status widget). Level 1 = silent/no banner.
  var WBGT_BANNERS = {
    2: {
      bg:    "bg-brand-gold",
      text:  "text-brand-dark",
      title: "Heat Alert: CIF Level 2",
      lead:  "Frequent water breaks. Watch for heat illness.",
      limits: [
        "Water breaks every 30 minutes minimum",
        "Watch carefully for heat-illness signs"
      ]
    },
    3: {
      bg:    "bg-brand-gold",
      text:  "text-brand-dark",
      title: "Heat Alert: CIF Level 3",
      lead:  "Activity reduced. Practice limited to two hours.",
      limits: [
        "Maximum 2 hours of practice",
        "Four 4-minute water breaks per hour",
        "Lighter clothing"
      ]
    },
    4: {
      bg:    "bg-brand-red-dark",
      text:  "text-white",
      title: "Heat Alert: CIF Level 4",
      lead:  "Strict limits on practice. Games are shortened with extra water breaks.",
      limits: [
        "Practice: maximum 1 hour, four 4-minute water breaks per hour, no equipment",
        "Games: length reduced by one-third, with additional water breaks at the 1/8 marks"
      ]
    },
    5: {
      bg:    "bg-brand-red-dark",
      text:  "text-white",
      title: "Advisory: Outdoor Activity Should Be Suspended (Level 5)",
      lead:  "WBGT has crossed the CIF closure threshold. Watch the home-page status bar for the official call by Region 13 staff.",
      limits: [
        "Games and practices should be canceled",
        "Fields should close until conditions cool",
        "Final closure call comes from Region 13 staff via the home-page status bar"
      ]
    }
  };

  // Synthetic WBGT values + labels for ?simulate=N preview mode (visual QA only).
  var SIMULATE_FIXTURES = {
    1: { valueF: 75.0, level: 1, levelLabel: "Normal activities" },
    2: { valueF: 82.0, level: 2, levelLabel: "Frequent water breaks" },
    3: { valueF: 86.0, level: 3, levelLabel: "Activity reduced" },
    4: { valueF: 88.5, level: 4, levelLabel: "Strict activity limits" },
    5: { valueF: 91.0, level: 5, levelLabel: "Outdoor activity suspended" }
  };

  // Synthetic rain values for ?simulate-rain=48h | 72h preview mode.
  var SIMULATE_RAIN = {
    "48h": { last48hInches: 0.40, last72hInches: 0.40, closureRecommended: true,
             reason: "Heavy rain in past 48 hours (0.40\")" },
    "72h": { last48hInches: 0.20, last72hInches: 1.20, closureRecommended: true,
             reason: "Heavy rain over past 72 hours (1.20\")" }
  };

  // Synthetic AQI values for ?simulate-aqi=N preview mode.
  // Maps to EPA AQI bands; 1=Good, 2=Moderate, 3=USG, 4=Unhealthy, 5=Very Unhealthy, 6=Hazardous.
  var SIMULATE_AQI = {
    1: { aqi: 35,  category: "Good",                            dominantPollutant: "O3",    closureRecommended: false, reason: null },
    2: { aqi: 75,  category: "Moderate",                        dominantPollutant: "O3",    closureRecommended: false, reason: null },
    3: { aqi: 130, category: "Unhealthy for Sensitive Groups",  dominantPollutant: "PM2.5", closureRecommended: false, reason: null },
    4: { aqi: 175, category: "Unhealthy",                       dominantPollutant: "PM2.5", closureRecommended: true,  reason: "AQI 175 (Unhealthy) — above the 150 closure threshold" },
    5: { aqi: 240, category: "Very Unhealthy",                  dominantPollutant: "PM2.5", closureRecommended: true,  reason: "AQI 240 (Very Unhealthy) — above the 150 closure threshold" },
    6: { aqi: 320, category: "Hazardous",                       dominantPollutant: "PM2.5", closureRecommended: true,  reason: "AQI 320 (Hazardous) — above the 150 closure threshold" }
  };

  function getSimulateLevel() {
    var m = (window.location.search || "").match(/[?&]simulate=([1-5])(?:&|$)/);
    return m ? Number(m[1]) : null;
  }

  function getSimulateRain() {
    var m = (window.location.search || "").match(/[?&]simulate-rain=(48h|72h)(?:&|$)/);
    return m ? m[1] : null;
  }

  function getSimulateAqi() {
    var m = (window.location.search || "").match(/[?&]simulate-aqi=([1-6])(?:&|$)/);
    return m ? Number(m[1]) : null;
  }

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value == null ? "—" : String(value);
  }

  function show(id) { var el = document.getElementById(id); if (el) el.removeAttribute("hidden"); }
  function hide(id) { var el = document.getElementById(id); if (el) el.setAttribute("hidden", ""); }

  // --- Temperature unit (°F default; user can switch to °C, persisted in
  // localStorage and shared with /temp). The API always sends °F; we convert
  // for display only. Toggling re-renders the cached payload — no re-fetch. ---
  var TEMP_UNIT = (function () {
    try { return localStorage.getItem("tempUnit") === "C" ? "C" : "F"; }
    catch (_) { return "F"; }
  })();
  var lastData = null;

  function fmtTemp(f) {
    if (f == null || f === "" || isNaN(Number(f))) return "—";
    var n = Number(f);
    return TEMP_UNIT === "C" ? (Math.round((n - 32) * 5 / 9 * 10) / 10) + "°C" : f + "°F";
  }

  function syncUnitToggle() {
    var t = document.getElementById("unit-toggle");
    if (t) t.textContent = TEMP_UNIT === "C" ? "Switch to °F" : "Switch to °C";
  }

  function bindUnitToggle() {
    var t = document.getElementById("unit-toggle");
    if (!t) return;
    t.addEventListener("click", function (e) {
      e.preventDefault();
      TEMP_UNIT = TEMP_UNIT === "C" ? "F" : "C";
      try { localStorage.setItem("tempUnit", TEMP_UNIT); } catch (_) {}
      syncUnitToggle();
      if (lastData) render(lastData);
    });
    syncUnitToggle();
  }

  function formatUpdated(iso) {
    if (!iso) return "—";
    try {
      var d = new Date(iso);
      return d.toLocaleString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" });
    } catch (_) { return iso; }
  }

  // AirNow reports hourly and the Worker hands us a preformatted local string
  // ("YYYY-MM-DD HH:MM TZ", already Pacific) — NOT an ISO timestamp, so it
  // can't go through formatUpdated (new Date() chokes on the "PST" suffix).
  // Pull the hour/minute straight out and render to match the temp card.
  function formatAqiObserved(s) {
    if (!s) return "—";
    var m = String(s).match(/\d{4}-\d{2}-\d{2}\s+(\d{2}):(\d{2})/);
    if (!m) return s;
    var hour = parseInt(m[1], 10);
    var ampm = hour >= 12 ? "PM" : "AM";
    var h12 = hour % 12; if (h12 === 0) h12 = 12;
    return h12 + ":" + m[2] + " " + ampm;
  }

  function renderForecast(periods) {
    var grid = document.getElementById("forecast-grid");
    if (!grid || !periods || !periods.length) return;
    // NWS returns 14 periods (day + night for 7 days). Show daytime only
    // so a 7-card grid lines up with the "7-day forecast" heading.
    var days = periods.filter(function (p) { return p.isDaytime; }).slice(0, 7);
    while (grid.firstChild) grid.removeChild(grid.firstChild);
    days.forEach(function (p) {
      var card = document.createElement("div");
      card.className = "bg-white border border-gray-200 rounded-lg p-3 text-sm flex flex-col items-start";

      var name = document.createElement("p");
      name.className = "font-semibold text-brand-dark text-xs uppercase tracking-wider mb-1";
      name.textContent = p.name || "";
      card.appendChild(name);

      if (p.icon) {
        var img = document.createElement("img");
        img.src = p.icon;
        img.alt = "";
        img.loading = "lazy";
        img.width = 48;
        img.height = 48;
        img.className = "w-12 h-12 mb-2";
        card.appendChild(img);
      }

      var temp = document.createElement("p");
      temp.className = "font-bold text-brand-dark text-lg leading-none mb-1";
      temp.textContent = fmtTemp(p.tempF);
      card.appendChild(temp);

      var fc = document.createElement("p");
      fc.className = "text-gray-700 text-xs leading-snug";
      fc.textContent = p.shortForecast || "";
      card.appendChild(fc);

      if (p.windSummary) {
        var w = document.createElement("p");
        w.className = "text-gray-500 text-xs mt-1";
        w.textContent = p.windSummary;
        card.appendChild(w);
      }
      grid.appendChild(card);
    });
    show("forecast-section");
  }

  function showSimulateBanner(state) {
    var host = document.getElementById("simulate-banner");
    if (!host) return;
    while (host.firstChild) host.removeChild(host.firstChild);

    var pieces = [];
    if (state.level) pieces.push("CIF Level " + state.level);
    if (state.rain)  pieces.push("rain past " + state.rain);
    if (state.aqi)   pieces.push("AQI band " + state.aqi);

    var label = document.createElement("p");
    label.className = "font-semibold text-brand-red-dark text-sm mb-2";
    label.textContent = "Preview mode: showing " + pieces.join(" + ") + " (synthetic data, not live)";
    host.appendChild(label);

    function makeLink(text, href, isCurrent) {
      var a = document.createElement("a");
      a.href = href;
      a.textContent = text;
      a.className = isCurrent
        ? "font-bold text-brand-red-dark underline"
        : "text-brand-red-dark underline";
      return a;
    }

    var heatRow = document.createElement("p");
    heatRow.className = "text-xs text-brand-dark m-0";
    heatRow.appendChild(document.createTextNode("Heat: "));
    [1, 2, 3, 4, 5].forEach(function (n, i) {
      if (i > 0) heatRow.appendChild(document.createTextNode(" · "));
      heatRow.appendChild(makeLink("Level " + n, "?simulate=" + n, n === state.level));
    });
    host.appendChild(heatRow);

    var rainRow = document.createElement("p");
    rainRow.className = "text-xs text-brand-dark m-0 mt-1";
    rainRow.appendChild(document.createTextNode("Rain: "));
    rainRow.appendChild(makeLink("48h heavy",  "?simulate-rain=48h", state.rain === "48h"));
    rainRow.appendChild(document.createTextNode(" · "));
    rainRow.appendChild(makeLink("72h heavy",  "?simulate-rain=72h", state.rain === "72h"));
    host.appendChild(rainRow);

    var aqiRow = document.createElement("p");
    aqiRow.className = "text-xs text-brand-dark m-0 mt-1";
    aqiRow.appendChild(document.createTextNode("AQI: "));
    [1, 2, 3, 4, 5, 6].forEach(function (n, i) {
      if (i > 0) aqiRow.appendChild(document.createTextNode(" · "));
      aqiRow.appendChild(makeLink("Band " + n, "?simulate-aqi=" + n, n === state.aqi));
    });
    host.appendChild(aqiRow);

    var liveRow = document.createElement("p");
    liveRow.className = "text-xs text-brand-dark m-0 mt-1";
    liveRow.appendChild(makeLink("Back to live data", location.pathname, false));
    host.appendChild(liveRow);

    host.removeAttribute("hidden");
  }

  function renderRainBanner(rain) {
    var host = document.getElementById("rain-banner");
    if (!host) return;
    while (host.firstChild) host.removeChild(host.firstChild);
    host.setAttribute("hidden", "");
    if (!rain || !rain.closureRecommended) return;

    // role="alert" goes on the inner box, not the host. An alert role on
    // an empty hidden container won't re-announce when content arrives.
    var box = document.createElement("div");
    box.className = "bg-brand-red-dark text-white p-5";
    box.setAttribute("role", "alert");

    var title = document.createElement("p");
    title.className = "text-base font-bold uppercase tracking-wider mb-2 m-0";
    title.textContent = "Advisory: Wet Field Conditions";
    box.appendChild(title);

    var lead = document.createElement("p");
    lead.className = "text-sm font-semibold mb-3 m-0";
    lead.textContent = rain.reason
      ? rain.reason + " — fields likely unsafe for play."
      : "Recent heavy rain has saturated the fields.";
    box.appendChild(lead);

    var list = document.createElement("ul");
    list.className = "text-sm list-disc pl-5 m-0 space-y-1";
    [
      "Games and practices should be canceled",
      "Fields should close until conditions improve",
      "Final closure call comes from Region 13 staff via the home-page status bar"
    ].forEach(function (text) {
      var li = document.createElement("li");
      li.textContent = text;
      list.appendChild(li);
    });
    box.appendChild(list);

    host.appendChild(box);
    host.removeAttribute("hidden");
  }

  function renderAirBanner(air) {
    var host = document.getElementById("air-banner");
    if (!host) return;
    while (host.firstChild) host.removeChild(host.firstChild);
    host.setAttribute("hidden", "");
    if (!air || !air.closureRecommended) return;

    var box = document.createElement("div");
    box.className = "bg-brand-red-dark text-white p-5";
    box.setAttribute("role", "alert");

    var title = document.createElement("p");
    title.className = "text-base font-bold uppercase tracking-wider mb-2 m-0";
    title.textContent = "Advisory: Unhealthy Air Quality";
    box.appendChild(title);

    var lead = document.createElement("p");
    lead.className = "text-sm font-semibold mb-3 m-0";
    lead.textContent = air.reason || "Air quality has crossed the closure threshold.";
    box.appendChild(lead);

    var list = document.createElement("ul");
    list.className = "text-sm list-disc pl-5 m-0 space-y-1";
    [
      "Outdoor games and practices should be canceled",
      "Sensitive players (asthma, lung conditions) should stay indoors",
      "Final closure call comes from Region 13 staff via the home-page status bar"
    ].forEach(function (text) {
      var li = document.createElement("li");
      li.textContent = text;
      list.appendChild(li);
    });
    box.appendChild(list);

    host.appendChild(box);
    host.removeAttribute("hidden");
  }

  function renderHeatBanner(level) {
    var host = document.getElementById("heat-banner");
    if (!host) return;
    while (host.firstChild) host.removeChild(host.firstChild);
    host.setAttribute("hidden", "");

    var b = WBGT_BANNERS[level];
    if (!b) return;

    // role="alert" goes on the inner box, not the host. An alert role on
    // an empty hidden container won't re-announce when content arrives.
    var box = document.createElement("div");
    box.className = b.bg + " " + b.text + " p-5";
    box.setAttribute("role", "alert");

    var title = document.createElement("p");
    title.className = "text-base font-bold uppercase tracking-wider mb-2 m-0";
    title.textContent = b.title;
    box.appendChild(title);

    var lead = document.createElement("p");
    lead.className = "text-sm font-semibold mb-3 m-0";
    lead.textContent = b.lead;
    box.appendChild(lead);

    var list = document.createElement("ul");
    list.className = "text-sm list-disc pl-5 m-0 space-y-1";
    b.limits.forEach(function (limit) {
      var li = document.createElement("li");
      li.textContent = limit;
      list.appendChild(li);
    });
    box.appendChild(list);

    host.appendChild(box);
    host.removeAttribute("hidden");
  }

  function render(data) {
    lastData = data;
    var simLevel = getSimulateLevel();
    var simRain  = getSimulateRain();
    var simAqi   = getSimulateAqi();
    if (simLevel || simRain || simAqi) {
      data = JSON.parse(JSON.stringify(data || {}));
      if (simLevel) {
        data.wbgt = SIMULATE_FIXTURES[simLevel];
      }
      if (simRain) {
        data.rain = SIMULATE_RAIN[simRain];
      }
      if (simAqi) {
        data.airQuality = SIMULATE_AQI[simAqi];
      }
      data.closureRecommended =
        (simLevel >= 5)
        || (data.rain && data.rain.closureRecommended)
        || (data.airQuality && data.airQuality.closureRecommended);
      showSimulateBanner({ level: simLevel, rain: simRain, aqi: simAqi });
    }
    var c = data.current || {};
    var w = data.wbgt || {};
    var a = data.airQuality || {};
    setText("temp",       fmtTemp(c.tempF));
    setText("feels-like", fmtTemp(c.feelsLikeF));
    setText("humidity",   c.humidity != null ? c.humidity : "—");
    setText("wind",       c.windMph != null ? c.windMph : "—");
    setText("updated",    formatUpdated(c.stationTimestamp || data.fetchedAt));
    setText("wbgt",       fmtTemp(w.valueF));
    setText("cif-level",  w.level != null ? w.level : "—");
    setText("cif-label",  w.levelLabel || "—");
    setText("wbgt-updated", formatUpdated(c.stationTimestamp || data.fetchedAt));
    setText("aqi",            a.aqi != null ? a.aqi : "—");
    setText("aqi-category",   a.category || "—");
    setText("aqi-pollutant",  a.dominantPollutant || "—");
    setText("aqi-updated",    formatAqiObserved(a.observedAt));

    renderRainBanner(data.rain);
    renderAirBanner(data.airQuality);
    renderHeatBanner(w.level);
    renderForecast(data.forecast || []);

    hide("weather-loading");
    show("weather-content");
  }

  function fail() {
    // If we're in simulate mode, render synthetic data even when the live
    // fetch fails. Lets local dev (no Worker bound) iterate on banner
    // styling without deploying.
    if (getSimulateLevel() || getSimulateRain() || getSimulateAqi()) {
      render({});
      return;
    }
    hide("weather-loading");
    show("weather-error");
  }

  bindUnitToggle();

  fetch("/api/weather", { cache: "no-cache" })
    .then(function (r) { if (!r.ok) throw new Error("status " + r.status); return r.json(); })
    .then(render)
    .catch(fail);
})();
</script>

*Last updated: [DATE]*
