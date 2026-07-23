// site/src/_data/lib/fetchFieldMaps.js
// Build-time fetch of the platform's public field-map API. Replaces the old
// committed site/src/_data/fieldmaps/*.json. Cached on disk by eleventy-fetch so
// a transient platform outage serves the last-good copy instead of failing the
// build. Base URL is env-driven (FIELDS_API_BASE) so staging builds read
// fields-staging and the Phase 3 cutover flips it to fields.ayso13.org.
const EleventyFetch = require("@11ty/eleventy-fetch");
const Image = require("@11ty/eleventy-img");
const path = require("path");

const BASE = process.env.FIELDS_API_BASE || "https://fields-staging.ayso13.org";
const FETCH_OPTS = { duration: "1d", type: "json" };

// Field-map images are optimized HERE, at data-fetch time, instead of relying
// on the sitewide `eleventyImageTransformPlugin` (.eleventy.js). That plugin
// only rewrites <img src>, never <a href> -- and the field-map lightbox wraps
// each map in `<a href="{{ v.png }}">`, so a raw remote PNG (~4.5 MB,
// cross-origin) would keep shipping behind the lightbox even though the
// inline <img> got optimized. Pre-generating a local optimized image for
// BOTH the inline picture and the lightbox href closes that gap. Output goes
// to the same `_site/img/` + `/img/` urlPath the transform plugin defaults
// to, so both mechanisms share one image namespace (filenames are
// content-hashed, so no collision risk).
const IMAGE_OUTPUT_DIR = path.join(__dirname, "..", "..", "..", "_site", "img");
const IMAGE_URL_PATH = "/img/";
const IMAGE_WIDTHS = [600, 1200, 2000];
const IMAGE_FORMATS = ["webp", "png"];
// Field-map <img> tags are already fully optimized (see optimizeVariantImage
// below) -- eleventy:ignore tells the sitewide transform plugin to leave them
// alone. Without it, the transform would try to re-process our already-local
// <img src="/img/...">, resolve it as a path relative to the input dir (where
// it doesn't exist) and fail the build.
const SKIP_TRANSFORM_ATTR = { "eleventy:ignore": "" };

async function getJson(url) {
  return EleventyFetch(url, FETCH_OPTS);
}

// Fetches + optimizes one field-map PNG at build time. Returns:
// - pngLarge: local url of the largest generated PNG, used for the lightbox <a href>
// - pictureHtml: pre-rendered <picture> markup, used for the inline image
async function optimizeVariantImage(absoluteUrl, alt) {
  const metadata = await Image(absoluteUrl, {
    widths: IMAGE_WIDTHS,
    formats: IMAGE_FORMATS,
    outputDir: IMAGE_OUTPUT_DIR,
    urlPath: IMAGE_URL_PATH,
  });
  const pngEntries = metadata.png || [];
  const pngLarge = pngEntries.length ? pngEntries[pngEntries.length - 1].url : absoluteUrl;
  const pictureHtml = Image.generateHTML(metadata, {
    ...SKIP_TRANSFORM_ATTR,
    alt,
    loading: "lazy",
    decoding: "async",
    sizes: "(min-width: 768px) 760px, 100vw",
    class: "w-full h-auto block",
  });
  return { pngLarge, pictureHtml };
}

// The public detail route returns variants as an ARRAY [{name,label,alt,view,elements,image_url}].
// The site consumes a name-keyed OBJECT with {label, alt, png, pictureHtml}. image_url is
// relative (e.g. "/field-images/marshall-game.png"), so make it absolute against the API
// base first -- otherwise the site would resolve it against www.ayso13.org (which doesn't
// serve it) and eleventy-img couldn't fetch it at build time.
async function reshape(detail) {
  const variants = {};
  for (const v of detail.variants || []) {
    const absoluteUrl = v.image_url && v.image_url.startsWith("http") ? v.image_url : `${BASE}${v.image_url}`;
    const { pngLarge, pictureHtml } = await optimizeVariantImage(absoluteUrl, v.alt);
    variants[v.name] = {
      label: v.label,
      alt: v.alt,
      png: pngLarge, // local optimized PNG -- used for the lightbox href, never the remote original
      pictureHtml,
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
      out[slug] = await reshape(detail);
    } catch (e) {
      // A 404 for a slug with no maps is expected/benign; skip it.
      if (!String(e).includes("404")) throw e;
    }
  }
  cache = out;
  return out;
};
