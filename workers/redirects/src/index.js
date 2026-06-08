// AYSO Region 13 redirect Worker.
//
// Sits in front of Cloudflare Pages on www.ayso13.org/* and
// staging.ayso13.org/* (see wrangler.toml routes). Every request:
//
//   1. Exact-match the path against EXACT (O(1)).
//      Hit -> respond with redirect.
//   2. Test path against each SPLAT pattern (O(n), n ~10).
//      Hit -> respond with redirect, expanding $1 if destination uses it.
//   3. Miss -> pass through with fetch(request) so Pages serves the
//      real page / static asset / 404.
//
// The map is generated from site/src/_redirects by scripts/generate-map.js.
// This Worker exists because CF Pages' _redirects file is silently capped
// at ~224 active rules, and Region 13 has 570+ legacy URLs to redirect.
//
// Note: the more-specific weather-api Worker on /api/weather wins by
// route precedence, so this Worker never sees those requests.

import { EXACT, SPLAT } from "./map.js";

// Pre-compile splat regexes once at module load.
const SPLAT_COMPILED = SPLAT.map((rule) => ({
  re: new RegExp(rule.re),
  d: rule.d,
  s: rule.s,
}));

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    // 0. Geo endpoint — returns the visitor's Cloudflare-derived country
    //    and region so the static pages can show an out-of-area banner
    //    client-side (keeps the HTML cacheable; no per-request injection).
    if (path === "/api/geo") {
      const cf = request.cf || {};
      return new Response(
        JSON.stringify({
          country: cf.country || null,       // e.g. "US"
          region: cf.region || null,         // e.g. "California"
          regionCode: cf.regionCode || null, // e.g. "CA"
        }),
        {
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store",
            "access-control-allow-origin": "*",
          },
        }
      );
    }

    // 1. Exact match.
    const hit = EXACT[path];
    if (hit) {
      return buildRedirect(hit.d, hit.s, url);
    }

    // 2. Splat patterns.
    for (const rule of SPLAT_COMPILED) {
      const match = rule.re.exec(path);
      if (match) {
        // Replace $1 in destination with the captured splat, if present.
        const dest = rule.d.includes("$1") ? rule.d.replace("$1", match[1] || "") : rule.d;
        return buildRedirect(dest, rule.s, url);
      }
    }

    // 3. Not a redirect -- pass through to Pages.
    return fetch(request);
  },
};

function buildRedirect(destination, status, requestUrl) {
  if (/^https?:\/\//i.test(destination)) {
    return Response.redirect(destination, status);
  }
  return Response.redirect(new URL(destination, requestUrl.origin).toString(), status);
}
