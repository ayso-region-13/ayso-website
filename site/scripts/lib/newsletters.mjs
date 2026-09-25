// Pure helpers for the newsletter archive sync. No I/O here, so every rule the
// archive depends on (which campaigns count, how they are named, what gets
// stripped) is unit-tested in newsletters.test.mjs.

export const SOCCER_NEWS_LIST_ID = "5ee4e68d-7557-11eb-a3d0-06b4694bee2a";
// Nothing earlier than this is ever archived: the old 2023-2025 hand-pasted
// links were retired when the sync went in, per the original request.
export const RETENTION_FLOOR = "2026-01-01";

const PACIFIC_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Los_Angeles",
  year: "numeric", month: "2-digit", day: "2-digit",
}); // en-CA formats as YYYY-MM-DD

export function pacificDate(iso) {
  return PACIFIC_DATE.format(new Date(iso));
}

// Current + previous Pacific calendar year, never before the floor.
export function retentionCutoff(now = new Date()) {
  const year = Number(PACIFIC_DATE.format(now).slice(0, 4));
  const rolling = `${year - 1}-01-01`;
  return rolling > RETENTION_FLOOR ? rolling : RETENTION_FLOOR;
}

export function isArchived(campaign, cutoff) {
  return campaign.status === "sent"
    && Array.isArray(campaign.to)
    && campaign.to.includes(SOCCER_NEWS_LIST_ID)
    && typeof campaign.sent_at === "string"
    && pacificDate(campaign.sent_at) >= cutoff;
}

// ™ © ® are Extended_Pictographic in Unicode, but they are text here
// ("EXTRA™"), so they are exempt from the emoji strip.
const EMOJI = /(?![©®™])\p{Extended_Pictographic}|\p{Regional_Indicator}|[\u{FE0F}\u{200D}\u{20E3}]/gu;
// Only the subject's lede emoji (and surrounding whitespace) is decorative;
// one appearing mid-sentence ("FIVE DAYS until ⚽!") is part of the text.
const LEADING_EMOJI = new RegExp(`^(?:\\s|${EMOJI.source})+`, "u");

export function cleanTitle(subject) {
  const title = String(subject ?? "").replace(LEADING_EMOJI, "").replace(/\s+/g, " ").trim();
  return title || "Newsletter";
}

export function slugify(title) {
  const slug = title
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  return slug || "newsletter";
}

// Suffixes collide-free in send order (oldest keeps the bare slug, so an
// existing URL never changes when a same-day resend appears), newest first out.
export function assignSlugs(entries) {
  const seen = new Map();
  const withSlugs = [...entries]
    .sort((a, b) => a.sentAt.localeCompare(b.sentAt))
    .map((e) => {
      const base = `${e.date}-${slugify(e.title)}`;
      const n = (seen.get(base) || 0) + 1;
      seen.set(base, n);
      return { ...e, slug: n === 1 ? base : `${base}-${n}` };
    });
  return withSlugs.reverse();
}

const PREHEADER = /<!-- Preheader text[\s\S]*?<!-- Hack to manage presentation of preheader text\. -->\s*<div[^>]*>[\s\S]*?<\/div>/;
const FOOTER_MARKER = "<!-- Footer -->";
const LEFTOVER_TAG = /\{\{[\s\S]*?\}\}|\{%[\s\S]*?%\}/;
// Cleaned email HTML reaches production unreviewed and the CSP on these pages
// allows inline scripts, so any of this must fail the sync rather than
// publish. Of the <meta> tags only http-equiv="refresh" is matched (it can
// redirect the page): every real email carries a harmless
// http-equiv="Content-Type" or "X-UA-Compatible" meta.
const ACTIVE_CONTENT = /<(script|iframe|form|object|embed|base)\b|<meta\b[^>]*http-equiv\s*=\s*["']?\s*refresh|\son[a-z]+\s*=|javascript:/i;

// Index just past the element that opens at `start`, counting nested tags.
function elementEnd(html, start, tag) {
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, "gi");
  re.lastIndex = start;
  let depth = 0;
  let m;
  while ((m = re.exec(html))) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return re.lastIndex;
  }
  throw new Error(`unbalanced <${tag}>`);
}

// Legacy preheader: a bare display:none div holding {{PreviewText}} plus
// tracking <img> tag(s), with no surrounding comment markers at all.
const LEGACY_PREHEADER = /<div\b[^>]*display:\s*none[^>]*>(?:(?!<\/?div\b)[\s\S])*?\{\{PreviewText\}\}(?:(?!<\/?div\b)[\s\S])*?<\/div>/g;

// Template A ("new editor"): a standalone eo-block="text" table holding the
// "View this email in your browser" link. Loops because more than one can
// appear on a page.
function stripWebVersionBlocks(html) {
  let out = html;
  while (true) {
    const tagIndex = out.indexOf("{{WebVersionURL}}");
    if (tagIndex === -1) return out;
    const tableStart = out.lastIndexOf("<table", tagIndex);
    if (tableStart === -1) return out;
    const openTagEnd = out.indexOf(">", tableStart);
    const openTag = out.slice(tableStart, openTagEnd === -1 ? tagIndex : openTagEnd + 1);
    if (!/eo-block\s*=\s*"text"/.test(openTag)) return out;
    const end = elementEnd(out, tableStart, "table");
    if (tagIndex >= end) return out; // the tag isn't actually inside this table
    out = out.slice(0, tableStart) + out.slice(end);
  }
}

// Template B ("legacy"): the footer paragraph(s) and sender-info sentence sit
// as plain body text, not inside a marked footer row.
const LEGACY_FOOTER_PARAGRAPH = /<p\b[^>]*>(?:(?!<\/?p\b)[\s\S])*?\{\{(?:WebVersionURL|UnsubscribeURL|RewardsURL)\}\}(?:(?!<\/?p\b)[\s\S])*?<\/p>/g;
const LEGACY_SENDER_LINE = /You are receiving this message because[^<]*\{\{SenderInfoLine\}\}/g;

function stripLegacyFooter(html) {
  return html.replace(LEGACY_FOOTER_PARAGRAPH, "").replace(LEGACY_SENDER_LINE, "");
}

// Strips the per-recipient parts of an EmailOctopus email (preheader,
// unsubscribe footer, rewards badge). Fails rather than publishing a literal
// merge tag: a tag that survives here would render as "{{FirstName}}" on www.
export function cleanHtml(html) {
  let out = html.replace(PREHEADER, "").replace(LEGACY_PREHEADER, "");
  const marker = out.indexOf(FOOTER_MARKER);
  if (marker !== -1) {
    const trStart = out.indexOf("<tr", marker);
    if (trStart === -1) throw new Error(`no <tr> after "${FOOTER_MARKER}"`);
    out = out.slice(0, marker) + out.slice(elementEnd(out, trStart, "tr"));
  }
  out = stripWebVersionBlocks(out);
  out = stripLegacyFooter(out);
  const leftover = out.match(LEFTOVER_TAG);
  if (leftover) throw new Error(`unfilled merge tag ${leftover[0]}`);
  const active = out.match(ACTIVE_CONTENT);
  if (active) throw new Error(`active content in email: ${active[0]}`);
  return out;
}
