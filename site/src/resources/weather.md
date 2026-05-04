---

title: "Weather and Field Conditions"
layout: page.njk
section: resources
description: "Current conditions, Wet Bulb Globe Temperature (WBGT), and 7-day forecast for AYSO Region 13 fields in Pasadena. Live data from our on-site weather station."
heroImage: action-04.jpg
---

Live conditions from Region 13's on-site Tempest weather station, plus the current Wet Bulb Globe Temperature (WBGT) and the corresponding California CIF heat-policy alert level. For what each level means, see the [Heat Policy](/resources/heat-policy/) page.

<div id="simulate-banner" class="bg-yellow-50 border-l-4 border-yellow-400 p-3 mb-6" hidden></div>

<div id="closure-banner" class="bg-brand-cream border-l-4 border-brand-red-dark p-4 mb-6" hidden>
  <p class="font-semibold text-brand-red-dark mb-1">Outdoor activity suspended (CIF Level 5)</p>
  <p class="text-brand-dark text-sm m-0">WBGT has crossed the closure threshold. Fields are closed pending board confirmation. Watch the home page banner for the official call.</p>
</div>

<div id="weather-loading" class="bg-brand-cream p-4 mb-6 text-brand-dark text-sm">
  Loading current conditions…
</div>

<div id="weather-error" class="bg-brand-cream border-l-4 border-brand-red-dark p-4 mb-6" hidden>
  <p class="font-semibold text-brand-red-dark mb-1">Live data temporarily unavailable</p>
  <p class="text-brand-dark text-sm m-0">We couldn't reach the weather station. Try refreshing in a minute. For the official heat-alert call, check the home page banner.</p>
</div>

<div id="weather-content" hidden>

## Current conditions

<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 not-prose">
  <div class="bg-brand-cream p-4">
    <p class="text-sm uppercase tracking-wider text-brand-dark mb-1">Temperature</p>
    <p class="text-4xl font-bold text-brand-dark leading-none mb-2"><span id="temp">—</span>°F</p>
    <p class="text-sm text-gray-700 m-0">Feels like <span id="feels-like">—</span>°F</p>
    <p class="text-sm text-gray-700 m-0">Humidity <span id="humidity">—</span>%</p>
    <p class="text-sm text-gray-700 m-0">Wind <span id="wind">—</span> mph</p>
    <p class="text-xs text-gray-500 mt-2 m-0">Updated <span id="updated">—</span></p>
  </div>
  <div id="wbgt-card" class="border-l-4 p-4 bg-white border-gray-300">
    <p class="text-sm uppercase tracking-wider text-brand-dark mb-1">WBGT — CIF Level <span id="cif-level">—</span></p>
    <p class="text-4xl font-bold text-brand-dark leading-none mb-2"><span id="wbgt">—</span>°F</p>
    <p class="text-sm font-semibold text-brand-dark mb-1" id="cif-label">—</p>
    <p class="text-sm text-gray-700 m-0" id="cif-action">—</p>
    <p class="text-xs text-gray-500 mt-2 m-0"><a href="/resources/heat-policy/" class="text-brand-red-dark underline">All alert levels →</a></p>
  </div>
</div>

</div>

## Field status

{% if fieldstatus.enabled %}
Region 13 staff have currently set fields to: **{{ fieldstatus.status }}** — {{ fieldstatus.message }}
{% else %}
Region 13 staff have not posted a current field-status update.
{% endif %}

This is the human-controlled status that appears on the [home page](/). It is set by Region 13 board members via Slack and is separate from the auto-derived WBGT level above. A WBGT closure recommendation does not automatically close fields — a board member must make the call.

<div id="forecast-section" hidden>

## 7-day forecast

<div id="forecast-grid" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6 not-prose"></div>

</div>

## About this data

Current conditions come from Region 13's on-site [Tempest WeatherFlow](https://weatherflow.com/tempest-home-weather-system/) station, polled every five minutes. Forecast data is from the [National Weather Service](https://www.weather.gov/) for Pasadena, California.

WBGT (Wet Bulb Globe Temperature) is computed from temperature, humidity, wind speed, and solar irradiance using the Bernard 1999 simplified outdoor approximation. Variance versus the ISO 7243 reference is roughly ±1°F under typical Pasadena conditions, well within the ~5°F width of each CIF alert tier.

## Related

- [Heat Policy](/resources/heat-policy/) — CIF alert levels and required actions
- [Safety](/resources/safety/) — concussion, sudden cardiac arrest, incident reporting

<script>
(function () {
  var WBGT_PALETTE = {
    1: { border: "border-brand-green",    action: "Normal activities. Provide ample water and unrestricted breaks." },
    2: { border: "border-brand-gold",     action: "Frequent water breaks every 30 minutes minimum. Watch carefully for heat illness." },
    3: { border: "border-orange-500",     action: "Maximum 2 hours of practice. Four 4-minute water breaks per hour. Lighter clothing." },
    4: { border: "border-brand-red",      action: "Maximum 1 hour of practice. Four 4-minute water breaks per hour. No equipment." },
    5: { border: "border-brand-red-dark", action: "No outdoor activity. Suspend until conditions cool. Region 13 closes fields." }
  };

  // Synthetic WBGT values + labels for ?simulate=N preview mode (visual QA only).
  var SIMULATE_FIXTURES = {
    1: { valueF: 75.0, level: 1, levelLabel: "Normal activities" },
    2: { valueF: 82.0, level: 2, levelLabel: "Frequent water breaks" },
    3: { valueF: 86.0, level: 3, levelLabel: "Activity reduced" },
    4: { valueF: 88.5, level: 4, levelLabel: "Strict activity limits" },
    5: { valueF: 91.0, level: 5, levelLabel: "Outdoor activity suspended" }
  };

  function getSimulateLevel() {
    var m = (window.location.search || "").match(/[?&]simulate=([1-5])\b/);
    return m ? Number(m[1]) : null;
  }

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value == null ? "—" : String(value);
  }

  function show(id)  { var el = document.getElementById(id); if (el) el.removeAttribute("hidden"); }
  function hide(id)  { var el = document.getElementById(id); if (el) el.setAttribute("hidden", ""); }

  function formatUpdated(iso) {
    if (!iso) return "—";
    try {
      var d = new Date(iso);
      return d.toLocaleString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" });
    } catch (_) { return iso; }
  }

  function renderForecast(periods) {
    var grid = document.getElementById("forecast-grid");
    if (!grid || !periods || !periods.length) return;
    while (grid.firstChild) grid.removeChild(grid.firstChild);
    periods.forEach(function (p) {
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
      temp.textContent = (p.tempF != null ? p.tempF + "°" : "—");
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

  function showSimulateBanner(currentLevel) {
    var host = document.getElementById("simulate-banner");
    if (!host) return;
    while (host.firstChild) host.removeChild(host.firstChild);

    var label = document.createElement("p");
    label.className = "font-semibold text-brand-red-dark text-sm mb-2";
    label.textContent = "Preview mode — showing CIF Level " + currentLevel + " (synthetic data, not live)";
    host.appendChild(label);

    var links = document.createElement("p");
    links.className = "text-xs text-brand-dark m-0";
    links.appendChild(document.createTextNode("Switch: "));
    [1, 2, 3, 4, 5].forEach(function (n, i) {
      if (i > 0) links.appendChild(document.createTextNode(" · "));
      var a = document.createElement("a");
      a.href = "?simulate=" + n;
      a.textContent = "Level " + n;
      a.className = (n === currentLevel)
        ? "font-bold text-brand-red-dark underline"
        : "text-brand-red-dark underline";
      links.appendChild(a);
    });
    links.appendChild(document.createTextNode(" · "));
    var live = document.createElement("a");
    live.href = location.pathname;
    live.textContent = "Live data";
    live.className = "text-brand-red-dark underline";
    links.appendChild(live);

    host.appendChild(links);
    host.removeAttribute("hidden");
  }

  function applyWbgtPalette(level) {
    var card = document.getElementById("wbgt-card");
    if (!card) return;
    Object.keys(WBGT_PALETTE).forEach(function (k) {
      card.classList.remove(WBGT_PALETTE[k].border);
    });
    var p = WBGT_PALETTE[level];
    if (p) card.classList.add(p.border);
  }

  function render(data) {
    var simLevel = getSimulateLevel();
    if (simLevel) {
      data = JSON.parse(JSON.stringify(data || {}));
      data.wbgt = SIMULATE_FIXTURES[simLevel];
      data.closureRecommended = simLevel >= 5;
      showSimulateBanner(simLevel);
    }
    var c = data.current || {};
    var w = data.wbgt || {};
    setText("temp",       c.tempF != null ? c.tempF : "—");
    setText("feels-like", c.feelsLikeF != null ? c.feelsLikeF : "—");
    setText("humidity",   c.humidity != null ? c.humidity : "—");
    setText("wind",       c.windMph != null ? c.windMph : "—");
    setText("updated",    formatUpdated(c.stationTimestamp || data.fetchedAt));
    setText("wbgt",       w.valueF != null ? w.valueF : "—");
    setText("cif-level",  w.level != null ? w.level : "—");
    setText("cif-label",  w.levelLabel || "—");

    var palette = WBGT_PALETTE[w.level];
    setText("cif-action", palette ? palette.action : "—");
    applyWbgtPalette(w.level);

    if (data.closureRecommended) show("closure-banner");
    renderForecast(data.forecast || []);

    hide("weather-loading");
    show("weather-content");
  }

  function fail() {
    hide("weather-loading");
    show("weather-error");
  }

  fetch("/api/weather", { cache: "no-cache" })
    .then(function (r) { if (!r.ok) throw new Error("status " + r.status); return r.json(); })
    .then(render)
    .catch(fail);
})();
</script>

*Last updated: [DATE]*
