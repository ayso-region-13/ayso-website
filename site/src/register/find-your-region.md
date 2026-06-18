---
title: "Find Your Local AYSO"
layout: page.njk
section: register
description: "AYSO Region 13 is based in the Pasadena area and welcomes nearby families. Live farther away? Use AYSO's national Region Locator to find the program closest to you."
---

AYSO Region 13 is based in the Pasadena area — **Pasadena, Altadena, and La Cañada Flintridge**. True to AYSO's Open Registration philosophy, we also welcome players from nearby communities, including Glendale, Los Angeles, South Pasadena, and surrounding neighborhoods — even if those areas have their own AYSO region.

## Live in or near the Pasadena area?

You're welcome to play with us. Head to [registration](/register/) to sign up for the season — no tryouts, everyone plays.

## Live farther away?

AYSO has programs across the country, and there is very likely a region closer to you. Use AYSO's national **Region Locator** to find the program nearest your home:

<a id="region-locator-link" href="https://www.aysonational.org/Default.aspx?tabid=961582" target="_blank" rel="noopener">Find your local AYSO region</a>

<script>
  // Fire a GA4 event when an out-of-area visitor clicks through to AYSO's
  // national Region Locator — the conversion metric for the out-of-area
  // banner / find-your-region flow. (Enhanced-Measurement outbound clicks
  // weren't capturing this, and the target is aysonational.org.) Query later
  // in GA4 by event name `region_locator_click`. `beacon` transport ensures
  // the hit sends before the new tab steals focus.
  (function () {
    var link = document.getElementById("region-locator-link");
    if (link && typeof gtag === "function") {
      link.addEventListener("click", function () {
        gtag("event", "region_locator_click", {
          event_category: "outbound",
          event_label: "aysonational_region_locator",
          transport_type: "beacon",
        });
      });
    }
  })();
</script>

Enter your address or ZIP code and AYSO will point you to the regions serving your area.

## A few things to know

- Region 13 plays in person in the Pasadena area. We aren't able to register players who can't attend our practices and games, and we don't offer a virtual or remote program.
- Registration fees, season dates, and age groups vary by region, so check with your local region for their specifics.
- The Laws of the Game, age divisions, and AYSO's core philosophies are the same everywhere — so our [Ask the Referee](/referees/ask-the-referee/) answers and [age chart](/register/age-chart/) are useful no matter which region you join.

## Related Pages

- [Register](/register/) — Sign up with Region 13
- [Programs](/programs/) — What we offer in the Pasadena area
- [Contact](/contact/) — Questions about Region 13 specifically

*Last updated: [DATE]*
