const markdownIt = require("markdown-it");
const markdownItAnchor = require("markdown-it-anchor");
const { eleventyImageTransformPlugin } = require("@11ty/eleventy-img");
const path = require("path");
const fs   = require("fs");

// Load pre-generated per-file dates (written by scripts/generate-file-dates.js).
// Keyed by relative path from project root, e.g. "src/programs/fall-soccer.md"
let fileDates = {};
const FILE_DATES_PATH = path.join(__dirname, "src/_data/fileDates.json");
try {
  fileDates = JSON.parse(fs.readFileSync(FILE_DATES_PATH, "utf8"));
} catch (_) {
  // Not yet generated — will use current date as fallback
}

// Pin every date format to America/Los_Angeles so output matches the editor's
// expectation regardless of where the build runs (CF Pages runners are UTC,
// which would otherwise shift late-evening Pacific commits forward by a day
// in sitemap <lastmod> and "Last updated" footers).
const PACIFIC_TZ = "America/Los_Angeles";
const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: PACIFIC_TZ,
  year: "numeric", month: "long", day: "numeric",
});
const ISO_DATE_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: PACIFIC_TZ,
  year: "numeric", month: "2-digit", day: "2-digit",
}); // "en-CA" outputs YYYY-MM-DD natively.

module.exports = function (eleventyConfig) {

  // --- Passthrough copies ---
  eleventyConfig.addPassthroughCopy("src/images");
  eleventyConfig.addPassthroughCopy("src/assets/css/style.css");
  eleventyConfig.addPassthroughCopy("src/assets/fonts");
  eleventyConfig.addPassthroughCopy("src/assets/docs");
  // NOTE: src/_redirects is intentionally NOT passed through.
  // The ayso13-redirects Worker (workers/redirects/) handles all 607
  // redirects upstream of Pages. Emitting _redirects to _site/ triggered
  // CF Pages' "Maximum number of dynamic rules supported is 100" parser
  // and was suspected of producing 500s on freshly-uploaded files.
  // The src file remains source-of-truth for the Worker map generator.
  eleventyConfig.addPassthroughCopy("src/favicon.ico");
  // Browsers (esp. iOS Safari) probe /apple-touch-icon.png at the root.
  eleventyConfig.addPassthroughCopy({ "src/images/apple-touch-icon.png": "apple-touch-icon.png" });
  eleventyConfig.addPassthroughCopy("src/site.webmanifest");
  // IndexNow ownership-verification key. Served at /<key>.txt.
  eleventyConfig.addPassthroughCopy("src/61d4461c23b7dcda89290711860408d3.txt");

  // --- Markdown configuration ---
  // typographer: true enables both `replacements` (which converts
  // (c)/(r)/(tm)/--/--/... into ©/®/™/–/—/…) and `smartquotes`. We disable
  // `replacements` because the (c) → © conversion mangles "501(c)(3)" into
  // "501©(3)" — and we already type ®/™/em-dashes as Unicode in the source.
  // Smart quotes stay on.
  const md = markdownIt({
    html: true,
    linkify: true,
    typographer: true,
  })
    .disable("replacements")
    .use(markdownItAnchor, {
      permalink: false,
      // Cleaner ID slugify — lowercase, strip punctuation, hyphenate spaces.
      // Default markdown-it-anchor preserves "?", "/", "(", ")" and URL-encodes them
      // (e.g. "section?" → id="section%3F"), making in-page links ugly.
      slugify: (s) => s.toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-"),
    });
  eleventyConfig.setLibrary("md", md);

  // --- Filters ---
  eleventyConfig.addFilter("date", (dateObj, format) => {
    const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
    if (format === "yyyy-MM-dd") {
      return ISO_DATE_FMT.format(d);
    }
    return d.toISOString();
  });

  eleventyConfig.addFilter("readableDate", (dateObj) => {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(dateObj instanceof Date ? dateObj : new Date(dateObj));
  });

  eleventyConfig.addFilter("currentYear", () => new Date().getFullYear());

  // Compact MMM d, yyyy formatter (Pacific) for the Important Dates widget
  const SHORT_DATE_FMT = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  eleventyConfig.addFilter("shortDate", (dateInput) => {
    if (!dateInput) return "";
    const d = typeof dateInput === "string" ? new Date(dateInput + "T12:00:00") : new Date(dateInput);
    return SHORT_DATE_FMT.format(d);
  });

  // Filter: drop past events, sort ascending, take first n. Used by the home
  // page Important Dates widget. Server-side build matches the on-page JS that
  // re-runs the same comparison so the widget never shows stale past events
  // between publishes.
  eleventyConfig.addFilter("upcomingEvents", (events, n) => {
    const limit = typeof n === "number" ? n : 3;
    if (!Array.isArray(events)) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return events
      .filter(e => e && e.date && e.name)
      .filter(e => new Date(e.date + "T00:00:00") >= today)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .slice(0, limit);
  });

  // Returns true if the current page URL starts with the given section path
  eleventyConfig.addFilter("isActiveSection", (pageUrl, sectionUrl) => {
    if (!pageUrl || !sectionUrl) return false;
    if (sectionUrl === "/" ) return pageUrl === "/";
    return pageUrl.startsWith(sectionUrl);
  });

  // Field status last-updated timestamp — reads git log date of fieldstatus.json
  // formatted to Pacific time. Falls back to null if git is unavailable.
  eleventyConfig.addGlobalData("fieldStatusDate", () => {
    try {
      const { execSync } = require("child_process");
      const raw = execSync(
        'git log -1 --format="%ai" -- site/src/_data/fieldstatus.json',
        { cwd: path.join(__dirname, "..") }
      ).toString().trim();
      if (!raw) return null;
      return new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Los_Angeles",
        month:    "long",
        day:      "numeric",
        year:     "numeric",
        hour:     "numeric",
        minute:   "2-digit",
        timeZoneName: "short",
      }).format(new Date(raw));
    } catch (_) {
      return null;
    }
  });

  // Render a markdown string to HTML (for data files like announcements.json)
  eleventyConfig.addFilter("markdownify", (str) => {
    if (!str) return "";
    return md.renderInline(str);
  });

  // Resolve a page's last-modified date from fileDates.json by inputPath.
  // Returns ISO string (e.g. "2026-04-30T20:53:32-07:00") or null.
  eleventyConfig.addFilter("lastModDate", function (inputPath) {
    if (!inputPath) return null;
    const rel = path.relative(__dirname, inputPath).replace(/\\/g, "/");
    return fileDates[rel] || null;
  });

  // Strip HTML tags from a string (for JSON-LD answer text)
  eleventyConfig.addFilter("striptags", (str) => {
    if (!str) return "";
    return str.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  });

  // Slugify a string for use in URLs
  eleventyConfig.addFilter("slug", (str) => {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
  });

  // --- Global data ---
  eleventyConfig.addGlobalData("currentYear", () => new Date().getFullYear());

  // True for any Cloudflare Pages build that is NOT production (the `main`
  // branch) — i.e. staging AND preview branches (e.g. field-maps). Used by
  // _headers.njk and robots.njk to emit noindex so only www.ayso13.org (main)
  // is crawlable. Local dev (npm start) has no CF_PAGES_BRANCH → treated as
  // production (allow), which is fine since local builds are never served.
  eleventyConfig.addGlobalData("isStaging", () => {
    const branch = process.env.CF_PAGES_BRANCH;
    return !!branch && branch !== "main";
  });

  // --- Transform: auto-style InLeague Register links as big yellow buttons ---
  // Editors save plain markdown via Pages CMS (which mangles raw HTML) — this
  // post-processes the built HTML so any anchor pointing at the InLeague
  // register URL with text starting with "Register" renders as a btn-primary.
  eleventyConfig.addTransform("inleague-register-button", function (content) {
    if (typeof this.page?.outputPath !== "string" || !this.page.outputPath.endsWith(".html")) return content;
    return content.replace(
      /<a\s+href="(https?:\/\/ayso13\.inleague\.com\/app\/?)"[^>]*>([^<]*)<\/a>/g,
      (match, url, text) => {
        if (!/^Register/i.test(text.trim())) return match;
        return `<a href="${url}" class="btn-primary text-lg px-8 py-4" target="_blank" rel="noopener">${text}</a>`;
      }
    );
  });

  // --- Transform: move Field Info callout to just above "Last updated:" ---
  // page.njk renders the Field Info cream box at the top of <article> (so the
  // CMS rendering preview shows it inline). For the public page we want it at
  // the bottom — useful reference info, not the lead. Match the rendered
  // block, strip it from the top, re-inject right before the "Last updated:"
  // paragraph. Only fires on /fields/ pages with a Field Info block present.
  eleventyConfig.addTransform("field-info-bottom", function (content) {
    if (typeof this.page?.outputPath !== "string" || !this.page.outputPath.endsWith(".html")) return content;
    if (!this.page.url || !this.page.url.startsWith("/fields/")) return content;

    const fieldInfoRegex = /<div class="bg-brand-cream rounded-lg border border-brand-cream[^"]*">\s*<p[^>]*>Field Info<\/p>[\s\S]*?<\/div>/;
    const m = content.match(fieldInfoRegex);
    if (!m) return content;

    const fieldInfoHtml = m[0];
    content = content.replace(fieldInfoRegex, "");

    // Re-inject just before the "Last updated:" paragraph. The date-placeholder
    // transform may or may not have fired by the time we run, so match either
    // the raw [DATE] form or the rendered <time> form.
    const lastUpdatedRegex = /(<p><em>Last updated:[\s\S]*?<\/em><\/p>)/;
    if (lastUpdatedRegex.test(content)) {
      return content.replace(lastUpdatedRegex, fieldInfoHtml + "\n$1");
    }
    // Fallback: append at the bottom of the prose container.
    return content.replace(/(<\/div>\s*<\/article>)/, fieldInfoHtml + "\n$1");
  });

  // --- Transform: replace [DATE] placeholder with per-file last-modified date ---
  eleventyConfig.addTransform("date-placeholder", function (content) {
    if (typeof this.page?.outputPath !== "string" || !this.page.outputPath.endsWith(".html")) return content;
    if (!content.includes("[DATE]")) return content;

    // Normalise inputPath to the same relative form used in fileDates.json
    // e.g. "/abs/path/to/site/src/programs/fall-soccer.md" → "src/programs/fall-soccer.md"
    const rel = this.page.inputPath
      ? path.relative(__dirname, this.page.inputPath).replace(/\\/g, "/")
      : null;

    const raw  = (rel && fileDates[rel]) ? fileDates[rel] : new Date().toISOString();
    const date = new Date(raw);
    const iso  = ISO_DATE_FMT.format(date);
    const nice = DATE_FMT.format(date);

    return content.replace(
      /\[DATE\]/g,
      `<time datetime="${iso}">${nice}</time>`
    );
  });

  // --- Collections ---

  // Ask the Referee Q&As — grouped by category. Sort: explicit-dated items
  // first (newest first, alpha tiebreaker), then undated items alpha by
  // question. Eleventy auto-assigns a fallback date to every file, so the
  // raw frontmatter / filename is the only reliable signal for "intentional"
  // date.
  const matter = require("gray-matter");
  eleventyConfig.addCollection("qaAnswers", function(collectionApi) {
    const items = collectionApi.getFilteredByGlob("src/referees/qa/*.md")
      .map(item => {
        const fmDate = matter.read(item.inputPath).data.date;
        const filenameMatch = path.basename(item.inputPath).match(/^(\d{4}-\d{2}-\d{2})/);
        const explicit = fmDate || (filenameMatch ? filenameMatch[1] : null);
        item._explicitDate = explicit ? new Date(explicit) : null;
        return item;
      });
    const qLower = item => (item.data.question || "").toLowerCase();
    return items.sort((a, b) => {
      if (a._explicitDate && b._explicitDate) {
        const diff = b._explicitDate - a._explicitDate;
        if (diff !== 0) return diff;
      } else if (a._explicitDate) {
        return -1;
      } else if (b._explicitDate) {
        return 1;
      }
      return qLower(a).localeCompare(qLower(b));
    });
  });

  // --- Image optimization ---
  // Auto-transforms every <img> tag in HTML output into a <picture> element
  // with WebP sources and the original format as fallback. SVGs are passed
  // through unchanged. Generated variants live under /img/. Existing attributes
  // on <img> tags (e.g. loading="eager", fetchpriority) override the defaults.
  //
  // AVIF is intentionally excluded: encoding is disproportionately slow (60%+
  // of total image processing time) and Cloudflare Pages build cache doesn't
  // engage for this project, so every deploy regenerates from scratch. WebP
  // covers 96%+ of users globally and gives most of the size benefit. See
  // todo.md "Build time optimization" for the history.
  eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
    extensions: "html",
    formats: ["webp", "auto"],
    widths: [600, 1200, "auto"],
    defaultAttributes: {
      loading: "lazy",
      decoding: "async",
      // Most body images render inside prose container (max-w-3xl ~768px).
      // Templates with wider/narrower images (hero, tiles, logos) override
      // sizes inline. See /seo audit "images" finding.
      sizes: "(min-width: 800px) 800px, 100vw",
    },
  });

  // --- Watch targets ---
  eleventyConfig.addWatchTarget("src/assets/css/style.css");

  // --- Return configuration ---
  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data",
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    templateFormats: ["md", "njk", "html"],
  };
};
