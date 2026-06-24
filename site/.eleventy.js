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
  eleventyConfig.addPassthroughCopy("src/assets/audio");
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

  // Convert rendered HTML to readable plain text for /llms-full.txt:
  // drop script/style, turn block elements into line breaks, bullet list
  // items, strip remaining tags, decode common entities, collapse blank runs.
  eleventyConfig.addFilter("plaintext", (html) => {
    if (!html) return "";
    let s = String(html);
    s = s.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ");
    s = s.replace(/<li[^>]*>/gi, "- ");
    s = s.replace(/<br\s*\/?>/gi, "\n");
    s = s.replace(/<\/(h[1-6]|p|li|tr|div|section|article|ul|ol|table|blockquote|figcaption)>/gi, "\n");
    s = s.replace(/<[^>]+>/g, "");
    s = s
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/gi, "'")
      .replace(/&nbsp;/g, " ").replace(/&mdash;/g, "—").replace(/&ndash;/g, "–")
      .replace(/&hellip;/g, "…").replace(/&deg;/g, "°").replace(/&times;/g, "×")
      .replace(/&rsquo;/g, "’").replace(/&lsquo;/g, "‘")
      .replace(/&ldquo;/g, "“").replace(/&rdquo;/g, "”");
    s = s.split("\n").map((l) => l.replace(/[ \t]+/g, " ").trim()).join("\n");
    return s.replace(/\n{3,}/g, "\n\n").trim();
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

  // --- Transform: in-page table of contents for field pages ---
  // After the maps block is relocated, collect the <h2 id="…"> headings inside
  // the article (markdown sections + the map sections) and render a "On this
  // page" jump list at the top of the article. Runs after field-maps-after-
  // directions so the map headings are present and in order.
  eleventyConfig.addTransform("field-page-toc", function (content) {
    if (typeof this.page?.outputPath !== "string" || !this.page.outputPath.endsWith(".html")) return content;
    if (!this.page.url || !this.page.url.startsWith("/fields/")) return content;

    const aStart = content.indexOf("<article");
    if (aStart < 0) return content;
    const tagEnd = content.indexOf(">", aStart) + 1;
    const aEnd = content.indexOf("</article>", tagEnd);
    if (aEnd < 0) return content;
    const inner = content.slice(tagEnd, aEnd);

    const headings = [];
    const re = /<h2[^>]*\sid="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/g;
    let m;
    while ((m = re.exec(inner)) !== null) {
      const text = m[2].replace(/<[^>]+>/g, "").trim();
      if (text) headings.push({ id: m[1], text: text });
    }
    if (headings.length < 3) return content; // not worth a TOC

    const items = headings.map((h) =>
      `<li><a href="#${h.id}" class="block py-1 text-brand-red-dark hover:text-brand-dark transition-colors">${h.text}</a></li>`
    ).join("");
    const toc =
      `<nav class="not-prose mb-6 max-w-3xl bg-brand-cream rounded-lg p-4" aria-label="On this page">` +
      `<p class="text-xs font-semibold uppercase tracking-wider text-brand-red-dark mb-2">On this page</p>` +
      `<ul class="text-sm">${items}</ul></nav>`;

    return content.slice(0, tagEnd) + "\n" + toc + content.slice(tagEnd);
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
  // --- Collection: field complexes ---
  // Groups field pages that share a `complex` frontmatter slug (e.g. the three
  // FIS fields) so member pages can cross-link siblings and share one wayfinder.
  // Each complex also resolves a shared wayfinder by reading the member
  // fieldmaps JSON for the first member that has a `wayfinder` variant.
  eleventyConfig.addCollection("complexes", function (collectionApi) {
    const fields = collectionApi.getFilteredByGlob("src/fields/*.md");
    const map = {};
    fields.forEach((f) => {
      const cx = f.data.complex;
      if (!cx) return;
      if (!map[cx]) map[cx] = { slug: cx, name: f.data.complexName || cx, members: [], wayfinder: null };
      if (f.data.complexName) map[cx].name = f.data.complexName;
      map[cx].members.push({ slug: f.fileSlug, title: f.data.title, url: f.url });
    });
    Object.keys(map).forEach((cx) => {
      for (const m of map[cx].members) {
        try {
          const doc = JSON.parse(fs.readFileSync(path.join(__dirname, "src/_data/fieldmaps", m.slug + ".json"), "utf8"));
          if (doc.variants && doc.variants.wayfinder) {
            map[cx].wayfinder = Object.assign({}, doc.variants.wayfinder, { hostSlug: m.slug });
            break;
          }
        } catch (_) { /* member has no saved map yet */ }
      }
    });
    return map;
  });

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

  // Ordered, grouped content pages for /llms-full.txt — the full-text export.
  // Substantive content only: skips the board-minutes PDF archive, photo
  // galleries, search, forms, noindex utility pages, and non-page outputs.
  // Returns [{ section, label, items: [templateObjects] }] so the template
  // can emit one block per section without Nunjucks loop-scope gymnastics.
  eleventyConfig.addCollection("llmsContent", function (collectionApi) {
    const LABELS = {
      about: "About AYSO Region 13",
      programs: "Programs & Tournaments",
      register: "Registration",
      schedules: "Schedules & Calendar",
      families: "For Families",
      coaches: "Coaches",
      referees: "Referees",
      managers: "Team Managers",
      volunteers: "Volunteers",
      resources: "Resources & Policies",
      fields: "Fields & Locations",
      contact: "Contact",
    };
    const ORDER = Object.keys(LABELS);
    const EXCLUDE = ["/about/board-minutes/", "/resources/gallery/", "/search/", "/forms/"];
    const pages = collectionApi.getAll().filter((item) => {
      const url = item.url;
      if (!url || url === "/") return false;            // home: covered by the header summary
      if (!url.endsWith("/")) return false;             // page outputs only (skip .txt/.xml/.json)
      if (!item.data.title) return false;
      if (item.data.noindex) return false;              // skip /temp and other noindex pages
      if (EXCLUDE.some((p) => url === p || url.startsWith(p))) return false;
      return ORDER.indexOf(item.data.section) !== -1;
    });
    return ORDER
      .map((section) => ({
        section,
        label: LABELS[section],
        items: pages
          .filter((p) => p.data.section === section)
          .sort((a, b) => a.url.localeCompare(b.url)),
      }))
      .filter((g) => g.items.length);
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
