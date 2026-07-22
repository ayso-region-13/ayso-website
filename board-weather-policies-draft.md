# AYSO Region 13 — Weather Policies (Draft for Board Review)

**Status:** Draft synthesized from the existing `/resources/heat-policy/`, `/resources/rain-policy/`, and the in-progress air-quality policy on the `aqi-feature` branch. The first two are live on the site; the AQI policy is built but held back pending board approval and infrastructure rollout. **Today's date: 2026-05-15.**

**Why now:**

- Heat and rain policies are already published but have never been explicitly ratified by the board.
- AQI policy is ready to ship as soon as the board approves the closure threshold.
- One source of truth — shared notification flow, shared override rules — should be agreed on once for all three categories rather than improvised per incident.

The policies below are intentionally short, consistent, and explicit about who decides what.

---

## 1. Heat Policy (Wet Bulb Globe Temperature)

### Source of authority
California Interscholastic Federation (CIF) Sports Medicine Advisory Committee heat-acclimatization guidelines. Same standard used by California public-school athletics; widely adopted by youth-sports organizations.

### Measurement
Wet Bulb Globe Temperature (WBGT) — combines air temperature, humidity, wind, and solar radiation. Computed every 5 minutes from Region 13's Tempest weather station via the Cloudflare Worker. Displayed live on `/resources/weather/`.

### Action by alert level

| Level | WBGT (°F) | Required action |
|:-----:|:----------|:----------------|
| 1 | ≤ 79.7 | Normal activities. Provide ample water and unrestricted breaks. |
| 2 | 79.8 – 84.6 | Frequent water breaks, every 30 min minimum. Watch for heat illness. |
| 3 | 84.7 – 87.5 | Max 2 hours of practice. Four 4-min water breaks per hour. Lighter clothing. |
| 4 | 87.6 – 89.7 | Practice: max 1 hour, four 4-min breaks per hour, no equipment. Games: length reduced by ⅓, extra water breaks at the ⅛ marks. |
| **5** | **> 89.7** | **All outdoor activity suspended. Practices and games canceled. Region 13 closes fields until conditions cool.** |

### Closure trigger
WBGT > 89.7°F (Level 5).

### Decision items for the board
- [ ] **Ratify CIF Level 5 (WBGT > 89.7°F) as the closure trigger.**
- [ ] Confirm the action language at Levels 3 and 4 (specifically: "max 2 hours" and "no equipment"). These come from CIF; we have not customized them.
- [ ] Confirm: either coach in a game may elect not to play in hot conditions without forfeit penalty.

---

## 2. Rain / Wet-Field Policy

### Source of authority
Region 13's own policy. **Field owners' policies override ours in all cases.** We do not own any of the fields we play on; the City of Pasadena, La Cañada Unified School District, individual schools, and other entities each set their own wet-field rules, and they nearly always close earlier than we would.

### Measurement
Rainfall totals from the Tempest weather station, tracked as rolling 48-hour and 72-hour sums in Cloudflare KV. Displayed live on `/resources/weather/`.

### Action by threshold

| Window | Threshold | Action |
|:-------|:----------|:-------|
| Past 48 hours | More than 0.25 inches | Fields closed. Practices and games canceled. |
| Past 72 hours | More than 1.00 inches | Fields closed. Practices and games canceled. |

Either threshold alone triggers closure. The 48-hour window catches rapid storms; the 72-hour window catches sustained or repeated rain that keeps fields wet across multiple days.

### Closure trigger
Either rolling total exceeded.

### Decision items for the board
- [ ] **Ratify the 0.25" / 48 h and 1.00" / 72 h thresholds.** These are the *latest* point at which Region 13 closes — earlier closures by field owners always take precedence.
- [ ] Confirm: Region 13 publicly posts an owner closure to the home page banner as soon as we are notified by the owner.
- [ ] Confirm: either coach in a game may elect not to play on a wet field without forfeit penalty.

### Notes
- The Tempest station is a single data point. It cannot see field-by-field saturation. Field coordinators may contact owners directly when conditions are borderline; the owner's read of their own field is what counts.
- Saturated turf increases the risk of slips and lower-extremity injuries, and play on saturated turf damages fields, keeping them offline for weeks longer.

---

## 3. Air Quality (AQI) Policy — Pending board approval

### Source of authority
U.S. Environmental Protection Agency's [Air Quality Index](https://www.airnow.gov/aqi/aqi-basics/). Same scale used by Pasadena Unified School District, CIF, CDC, and the Southern California Air Quality Management District (AQMD).

### Measurement
Live AQI from the EPA's AirNow network of regulatory monitors, fetched every 5 minutes and reported on `/resources/weather/`. Dominant pollutant (ozone in summer, PM2.5 during wildfire smoke) is shown alongside the numeric AQI and EPA category.

### Action by AQI band

| AQI | EPA Category | Action |
|:---:|:-------------|:-------|
| 0–50 | Good | Normal activities. |
| 51–100 | Moderate | Players with asthma or other sensitivities monitor symptoms and limit prolonged exertion if needed. |
| 101–150 | Unhealthy for Sensitive Groups | Sensitive players (asthma, lung conditions, allergies) reduce intensity or move indoors. Coaches add water breaks and watch for symptoms in all players. |
| **151–200** | **Unhealthy** | **Region 13 cancels outdoor practices and games.** Indoor alternatives at coach discretion. |
| 201–300 | Very Unhealthy | All outdoor activity canceled. |
| 301+ | Hazardous | Emergency conditions. All outdoor activity canceled; players stay indoors. |

### Proposed closure trigger
**AQI > 150** (EPA's "Unhealthy" category or worse). This aligns with PUSD's wildfire-smoke guidance, CIF, and CDC recommendations for youth athletics.

### Decision items for the board
- [ ] **Ratify AQI > 150 as the closure trigger.** Alternative thresholds:
  - AQI > 100 (PUSD often closes recess at this level; aggressive)
  - AQI > 200 (Very Unhealthy; conservative — many schools have already closed at this point)
- [ ] Approve the visible-smoke override clause: if visible smoke or smell is bad even when the monitor reads below threshold, field coordinator may close on judgment.
- [ ] Approve: either coach in a game may elect not to play in poor air quality without forfeit penalty.

### Notes
- AirNow monitors are regulatory-grade but sparse. A single nearby wildfire can produce localized impact that the nearest monitor (often miles away) understates. The visible-smoke override exists to handle this case.
- The AQI policy page and the AirNow integration are ready to launch on the `aqi-feature` branch; both will go live when the board ratifies the threshold.

---

## 4. Cross-cutting policy items (apply to all three)

These should be ratified once and applied consistently across heat, rain, and AQI.

### Who has authority
- **The automated banner on `/resources/weather/` is advisory only.** A Region 13 board member must confirm any closure call.
- **A board member posts the official closure to the home page banner via the Slack `/ayso` bot.** That posting is the canonical Region 13 status.
- **Field owner closures override Region 13 closures.** If a field owner has closed a field, it is closed regardless of what our weather page or banner says. Region 13 posts owner closures to the home page banner as soon as we are notified.
- **Coach and family judgment is the final layer.** Any coach or family may elect not to play under unsafe conditions, at any alert level, without forfeit penalty.

### Notification timing
- Game days: notifications by **7:00 AM**.
- Practice days: notifications by **4:00 PM**.

### Decision items for the board
- [ ] Confirm the four-tier authority order: Field owner > Region 13 board > Automated advisory > Coach/family override at the individual level.
- [ ] Confirm the 7 AM / 4 PM notification cutoffs.
- [ ] Identify the on-call board member(s) responsible for the closure call each season. Document the rotation in `/about/leadership/`.
- [ ] Establish a brief annual review of these thresholds (recommend pre-fall-season board meeting).

---

## 5. Implementation status — what's already in code

| Item | Status |
|---|---|
| Live WBGT calculation + CIF level rendering | **Live in production** (`/resources/weather/`) |
| Heat policy page | **Live** (`/resources/heat-policy/`) |
| 48 h / 72 h rolling rainfall tracking + closure advisory | **Live in production** |
| Rain policy page | **Live** (`/resources/rain-policy/`) |
| AirNow AQI integration in the Worker | **Built and deployed** — Worker returns `airQuality` block on `/api/weather` |
| Weather page AQI stat card | **Built on `aqi-feature` branch, held back pending policy approval** |
| Air-quality policy page | **Built on `aqi-feature` branch** |
| AQI nav/footer/redirects | **Built on `aqi-feature` branch** |
| Slack auto-notification when threshold crossed | **Not built** — currently the on-call board member is the trigger |

---

## 6. Open questions for board discussion

1. **Should we auto-notify Slack when the advisory crosses any closure threshold (heat L5, rain, AQI)?** The data is already in the Worker; only a Slack webhook + threshold-cross detection in KV needs to be wired up. Trade-off: faster response time vs. more false alarms during shoulder hours.

2. **Should we differentiate game-day and practice-day thresholds?** Some leagues use tighter thresholds on game days (more sustained exertion, less ability for individual coach modification). Current policy is unified.

3. **Should we publish a brief post-season summary of closures?** Useful for transparency and for spotting if our thresholds are too aggressive or too loose vs. actual conditions.

4. **Forecast-based pre-closure (preemptive cancellation):** the Worker has the NWS 7-day forecast available. Should we ever close 24 h ahead based on a forecast alone, or always wait for the live reading? Current policy is reactive only.

5. **Air quality during fall practice season:** wildfire seasons are getting longer and the heaviest practice/game weeks (September–November) overlap with peak smoke risk. Worth coaching coaches to expect this and have indoor backup plans?

---

## Sources

- California Interscholastic Federation Sports Medicine Advisory Committee — heat acclimatization policy. [cifstate.org/sports-medicine/heat-illness](https://www.cifstate.org/sports-medicine/heat-illness/index)
- U.S. Environmental Protection Agency — Air Quality Index. [airnow.gov/aqi/aqi-basics](https://www.airnow.gov/aqi/aqi-basics/)
- South Coast Air Quality Management District. [aqmd.gov](https://www.aqmd.gov/)
- Pasadena Unified School District — wildfire-smoke guidance (referenced threshold practice)
- CDC — youth sports during poor air quality
