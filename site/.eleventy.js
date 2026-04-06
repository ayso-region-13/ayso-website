const markdownIt = require("markdown-it");
const markdownItAnchor = require("markdown-it-anchor");
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
  eleventyConfig.addPassthroughCopy("src/_redirects");
  eleventyConfig.addPassthroughCopy("src/robots.txt");

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

  // --- Transform: replace [DATE] placeholder with per-file last-modified date ---
  eleventyConfig.addTransform("date-placeholder", function (content) {
    if (!this.page?.outputPath?.endsWith(".html")) return content;
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
