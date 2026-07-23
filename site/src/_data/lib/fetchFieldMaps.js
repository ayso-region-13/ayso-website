// site/src/_data/lib/fetchFieldMaps.js
// Build-time fetch of the platform's public field-map API. Replaces the old
// committed site/src/_data/fieldmaps/*.json. Cached on disk by eleventy-fetch so
// a transient platform outage serves the last-good copy instead of failing the
// build. Base URL is env-driven (FIELDS_API_BASE) so staging builds read
// fields-staging and the Phase 3 cutover flips it to fields.ayso13.org.
const EleventyFetch = require("@11ty/eleventy-fetch");

const BASE = process.env.FIELDS_API_BASE || "https://fields-staging.ayso13.org";
const FETCH_OPTS = { duration: "1d", type: "json" };

async function getJson(url) {
  return EleventyFetch(url, FETCH_OPTS);
}

// The public detail route returns variants as an ARRAY [{name,label,alt,view,elements,image_url}].
// The site consumes a name-keyed OBJECT with only {label, alt, png}. image_url is relative
// (e.g. "/field-images/marshall-game.png"), so make it absolute against the API base --
// otherwise the site would resolve it against www.ayso13.org (which doesn't serve it) and
// eleventy-img couldn't fetch it at build time.
function reshape(detail) {
  const variants = {};
  for (const v of detail.variants || []) {
    variants[v.name] = {
      label: v.label,
      alt: v.alt,
      png: v.image_url && v.image_url.startsWith("http") ? v.image_url : `${BASE}${v.image_url}`,
    };
  }
  return { field: detail.slug, variants };
}

let cache = null; // memoize within a single build (data file + collection both call this)
module.exports = async function fetchFieldMaps() {
  if (cache) return cache;
  const index = await getJson(`${BASE}/public/fields`); // { venues: [{slug,title}] }
  const slugs = (index.venues || []).map((v) => v.slug);
  slugs.push("overview"); // served by slug, excluded from the index by design
  const out = {};
  for (const slug of slugs) {
    try {
      const detail = await getJson(`${BASE}/public/fields/${slug}`);
      out[slug] = reshape(detail);
    } catch (e) {
      // A 404 for a slug with no maps is expected/benign; skip it.
      if (!String(e).includes("404")) throw e;
    }
  }
  cache = out;
  return out;
};
