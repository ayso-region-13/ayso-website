---

title: "Heat Policy"
layout: page.njk
section: resources
description: "AYSO Region 13 heat policy. Wet Bulb Globe Temperature (WBGT) thresholds and required actions for each alert level, following California CIF guidelines."
---

AYSO Region 13 follows California Interscholastic Federation (CIF) heat acclimatization guidelines. We monitor Wet Bulb Globe Temperature (WBGT) at our field locations and adjust or cancel activities based on the alert level. Live readings are available on the [Weather and Field Conditions](/resources/weather/) page.

## What is WBGT?

Wet Bulb Globe Temperature is a heat-stress measure that combines air temperature, humidity, wind, and solar radiation. It reflects how the human body actually experiences heat during outdoor exertion, which is why CIF and most major youth-sports organizations use it instead of plain air temperature.

WBGT is always lower than air temperature in dry conditions and approaches air temperature in humid conditions. A WBGT of <span class="js-degf" data-f="85" data-u>85°F</span> is roughly equivalent to a hot, sunny, humid afternoon, meaningfully more dangerous than a <span class="js-degf" data-f="90" data-u>90°F</span> dry, breezy one.

## Alert levels

| Level | WBGT (<span id="wbgt-unit">°F</span>) | Required action |
|:-----:|:----------|:----------------|
| **1** | ≤ <span class="js-degf" data-f="79.7">79.7</span>    | Normal activities. Provide ample water and unrestricted breaks. |
| **2** | <span class="js-degf" data-f="79.8">79.8</span> – <span class="js-degf" data-f="84.6">84.6</span> | Frequent water breaks, every 30 minutes minimum. Watch carefully for heat illness. |
| **3** | <span class="js-degf" data-f="84.7">84.7</span> – <span class="js-degf" data-f="87.5">87.5</span> | Maximum 2 hours of practice. Four 4-minute water breaks per hour. Lighter clothing. |
| **4** | <span class="js-degf" data-f="87.6">87.6</span> – <span class="js-degf" data-f="89.7">89.7</span> | **Practice:** maximum 1 hour, four 4-minute water breaks per hour, no equipment.<br>**Games:** length reduced by one-third, with additional water breaks at the 1/8 marks. |
| **5** | > <span class="js-degf" data-f="89.7">89.7</span>    | **All outdoor activity suspended.** Practices and games are canceled. Region 13 closes fields until conditions cool. |

<p class="not-prose text-sm mt-2"><a href="#" id="unit-toggle" class="text-brand-red-dark underline">Switch to °C</a></p>

## How we make the call

Region 13 monitors WBGT throughout the day. The current reading and CIF level are visible on [Weather and Field Conditions](/resources/weather/), updated every five minutes from our on-site weather station.

When WBGT crosses into Level 5, the weather page shows a closure banner. The board confirms and posts an official closure to the home page banner via Slack. Notifications go out by 7 AM on game days or 4 PM on practice days when heat alerts are in effect.

If a coach or family judges conditions to be unsafe at any level, they have the final say on individual participation. Either coach in a game may elect not to play in hot conditions without forfeit penalty.

## What you can do

- **Hydrate before, during, and after.** Cold water; sports drinks for longer practices.
- **Watch for heat illness signs.** Cramping, dizziness, headache, confusion, hot dry skin, stopped sweating, nausea. If you see them, stop the activity, get the player into shade, cool them with water, and call for help. Heat stroke is a medical emergency.
- **Speak up.** Players, coaches, and families should report conditions to the referee or division coordinator. Earlier is better.

## Source

These thresholds and required actions follow the California Interscholastic Federation Sports Medicine Advisory Committee heat acclimatization policy, applied to AYSO Region 13's program. See [CIF State](https://www.cifstate.org/sports-medicine/heat-illness/index) for the original guidance.

## Related

- [Weather and Field Conditions](/resources/weather/): live WBGT, current conditions, 7-day forecast
- [Rain Policy](/resources/rain-policy/): wet-field closure thresholds
- [Air Quality Policy](/resources/air-quality-policy/): EPA AQI thresholds and required actions
- [Safety](/resources/safety/): concussion, sudden cardiac arrest, incident reporting

<script>
(function () {
  // Honor the °F/°C preference shared with /resources/weather/ and /temp
  // (localStorage "tempUnit", default °F). The WBGT thresholds in the table
  // are stored in °F on data-f; we convert for display only. The link below
  // the table flips the preference for the whole site. WBGT thresholds are
  // CIF values precise to 0.1°F, so we show one decimal in °C (integer
  // rounding would collapse adjacent rows onto the same boundary number).
  function unit() {
    try { return localStorage.getItem("tempUnit") === "C" ? "C" : "F"; }
    catch (_) { return "F"; }
  }
  function fmtC(f) { return String(Math.round((f - 32) * 5 / 9 * 10) / 10); }

  function apply() {
    var u = unit();
    var els = document.querySelectorAll(".js-degf");
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var f = parseFloat(el.getAttribute("data-f"));
      if (isNaN(f)) continue;
      var num = u === "C" ? fmtC(f) : el.getAttribute("data-f");
      el.textContent = num + (el.hasAttribute("data-u") ? (u === "C" ? "°C" : "°F") : "");
    }
    var hdr = document.getElementById("wbgt-unit");
    if (hdr) hdr.textContent = u === "C" ? "°C" : "°F";
    var link = document.getElementById("unit-toggle");
    if (link) link.textContent = u === "C" ? "Switch to °F" : "Switch to °C";
  }

  var link = document.getElementById("unit-toggle");
  if (link) {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      var next = unit() === "C" ? "F" : "C";
      try { localStorage.setItem("tempUnit", next); } catch (_) {}
      apply();
    });
  }
  apply();
})();
</script>

*Last updated: [DATE]*
