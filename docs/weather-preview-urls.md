# AYSO Region 13 — Weather Page Preview URLs

These query-string "simulate" modes let you **see exactly what the weather page shows** under heat, rain, or air-quality conditions — without waiting for real weather. They're **display-only previews** (client-side): they do **not** change live data and do **not** trigger any Slack notifications.

**Base page:** <https://www.ayso13.org/resources/weather/>

A yellow "preview mode" notice appears at the top whenever a simulate parameter is active, so it's obvious you're not looking at live readings.

> Note: these preview modes work on `/resources/weather/` only — not on the `/temp` quick-view page.

## 🌡 Heat (WBGT / CIF level) — `?simulate=1`…`5`

| URL | Shows | Banner |
|---|---|---|
| [`?simulate=1`](https://www.ayso13.org/resources/weather/?simulate=1) | WBGT 75°F · Level 1 — Normal activities | none |
| [`?simulate=2`](https://www.ayso13.org/resources/weather/?simulate=2) | WBGT 82°F · Level 2 — Frequent water breaks | 🟡 gold heat alert |
| [`?simulate=3`](https://www.ayso13.org/resources/weather/?simulate=3) | WBGT 86°F · Level 3 — Activity reduced (2-hr cap) | 🟡 gold heat alert |
| [`?simulate=4`](https://www.ayso13.org/resources/weather/?simulate=4) | WBGT 88.5°F · Level 4 — Strict limits | 🔴 red heat alert |
| [`?simulate=5`](https://www.ayso13.org/resources/weather/?simulate=5) | WBGT 91°F · Level 5 — **Outdoor activity suspended** | 🔴 red — closure |

## 🌧 Rain — `?simulate-rain=48h` / `72h`

| URL | Shows | Banner |
|---|---|---|
| [`?simulate-rain=48h`](https://www.ayso13.org/resources/weather/?simulate-rain=48h) | 0.40″ in past 48h | 🔵 rain alert — **closure recommended** |
| [`?simulate-rain=72h`](https://www.ayso13.org/resources/weather/?simulate-rain=72h) | 1.20″ over past 72h | 🔵 rain alert — **closure recommended** |

## 💨 Air Quality (EPA AQI band) — `?simulate-aqi=1`…`6`

| URL | Shows | Banner |
|---|---|---|
| [`?simulate-aqi=1`](https://www.ayso13.org/resources/weather/?simulate-aqi=1) | AQI 35 — Good | none |
| [`?simulate-aqi=2`](https://www.ayso13.org/resources/weather/?simulate-aqi=2) | AQI 75 — Moderate | none |
| [`?simulate-aqi=3`](https://www.ayso13.org/resources/weather/?simulate-aqi=3) | AQI 130 — Unhealthy for Sensitive Groups | none (below 150 threshold) |
| [`?simulate-aqi=4`](https://www.ayso13.org/resources/weather/?simulate-aqi=4) | AQI 175 — Unhealthy | 🟠 AQI alert — **closure recommended** |
| [`?simulate-aqi=5`](https://www.ayso13.org/resources/weather/?simulate-aqi=5) | AQI 240 — Very Unhealthy | 🟠 AQI alert — **closure recommended** |
| [`?simulate-aqi=6`](https://www.ayso13.org/resources/weather/?simulate-aqi=6) | AQI 320 — Hazardous | 🟠 AQI alert — **closure recommended** |

## 🔀 Combine them

Parameters stack — useful for seeing multiple banners at once:

- **Everything at once:** [`?simulate=5&simulate-rain=72h&simulate-aqi=6`](https://www.ayso13.org/resources/weather/?simulate=5&simulate-rain=72h&simulate-aqi=6)
- **Heat + smoke:** [`?simulate=4&simulate-aqi=5`](https://www.ayso13.org/resources/weather/?simulate=4&simulate-aqi=5)

**To exit preview:** remove the `?…` part of the URL (or just reload [the plain weather page](https://www.ayso13.org/resources/weather/)).

---

## Closure thresholds

What flips a banner to "closure recommended":

| Condition | Threshold |
|---|---|
| Heat | WBGT **Level 5** |
| Rain | **> 0.25″ / 48h** or **> 1″ / 72h** |
| Air quality | **AQI > 150** |

Live conditions that cross these thresholds post automatically to the **`#notify-weather`** Slack channel. The preview URLs above are display-only and never post to Slack.

To check live conditions from Slack at any time: **`/ayso weather`** (private reply). To verify the Slack alerting path itself: **`/ayso test-weather`**.

---

*Source fixtures: `site/src/resources/weather.md` (`SIMULATE_FIXTURES` / `SIMULATE_RAIN` / `SIMULATE_AQI`). Keep this guide in sync if those change.*
