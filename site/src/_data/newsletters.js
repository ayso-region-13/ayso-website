// Global data: the newsletter snapshot written by scripts/sync-newsletters.mjs.
// Each email is split into its <style> blocks and <body> so
// _includes/newsletter.njk can host it in a page of our own. Pagination in
// newsletter-pages.njk turns each entry into /resources/newsletters/<slug>/.
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "../../newsletters");
const TZ = "America/Los_Angeles";
const SHORT = new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short", day: "numeric" });
const LONG = new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "long", day: "numeric", year: "numeric" });

// Outlook conditional comments are stripped from <head> only: there they hold
// mso-only CSS (e.g. `* { font-family: sans-serif !important }`) that would
// apply in every browser once lifted out of the comment. In <body> they are
// left alone, because downlevel-revealed blocks there are real content.
function splitEmail(html) {
  const head = (html.match(/<head[^>]*>([\s\S]*?)<\/head>/i) || [, ""])[1]
    .replace(/<!--\[if[\s\S]*?<!\[endif\]-->/g, "");
  const styles = (head.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || []).join("\n");
  const body = html.match(/<body([^>]*)>([\s\S]*)<\/body>/i);
  if (!body) throw new Error("newsletter HTML has no <body>");
  const bodyStyle = (body[1].match(/\sstyle="([^"]*)"/i) || [, ""])[1];
  // Email images stay on EmailOctopus's CDN (copying them is out of scope), so
  // they must bypass the sitewide eleventy-img transform in .eleventy.js —
  // otherwise it tries to fetch/optimize them and throws on the missing `alt`
  // these emails don't carry. Same precedent as fetchFieldMaps.js. Do not
  // invent alt text.
  const taggedBody = body[2].replace(/<img\b/gi, "<img eleventy:ignore");
  return { styles, bodyStyle, body: taggedBody };
}

function loadNewsletters() {
  let index;
  try {
    index = JSON.parse(fs.readFileSync(path.join(DIR, "index.json"), "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
  return index.map((entry) => {
    const sent = new Date(entry.sentAt);
    return {
      ...entry,
      year: entry.date.slice(0, 4),
      shortDate: SHORT.format(sent),
      displayDate: LONG.format(sent),
      ...splitEmail(fs.readFileSync(path.join(DIR, `${entry.slug}.html`), "utf8")),
    };
  });
}

module.exports = loadNewsletters;
module.exports.splitEmail = splitEmail;
