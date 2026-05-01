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

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  year: "numeric", month: "long", day: "numeric",
});

module.exports = function (eleventyConfig) {

  // --- Passthrough copies ---
  eleventyConfig.addPassthroughCopy("src/images");
  eleventyConfig.addPassthroughCopy("src/assets/css/style.css");
  eleventyConfig.addPassthroughCopy("src/assets/fonts");
  eleventyConfig.addPassthroughCopy("src/assets/docs");
  eleventyConfig.addPassthroughCopy("src/_redirects");
  eleventyConfig.addPassthroughCopy("src/favicon.ico");
  eleventyConfig.addPassthroughCopy("src/site.webmanifest");

  // --- Markdown configuration ---
  const md = markdownIt({
    html: true,
    linkify: true,
    typographer: true,
  }).use(markdownItAnchor, {
    permalink: false,
  });
  eleventyConfig.setLibrary("md", md);

  // --- Filters ---
  eleventyConfig.addFilter("date", (dateObj, format) => {
    const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
    if (format === "yyyy-MM-dd") {
      return d.toISOString().split("T")[0];
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

  // True when this build is for the staging branch on Cloudflare Pages.
  // Used by _headers.njk and robots.njk to block crawlers on staging only.
  eleventyConfig.addGlobalData("isStaging", () => process.env.CF_PAGES_BRANCH === "staging");

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
    const iso  = date.toISOString().split("T")[0];
    const nice = DATE_FMT.format(date);

    return content.replace(
      /\[DATE\]/g,
      `<time datetime="${iso}">${nice}</time>`
    );
  });

  // --- Collections ---

  // Ask the Referee Q&As — grouped by category, newest first within each group
  eleventyConfig.addCollection("qaAnswers", function(collectionApi) {
    return collectionApi.getFilteredByGlob("src/referees/qa/*.md")
      .sort((a, b) => {
        if (!a.date && !b.date) return 0;
        if (!a.date) return 1;
        if (!b.date) return -1;
        return b.date - a.date; // newest first
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
