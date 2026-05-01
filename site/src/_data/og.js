// Default OG/Twitter image per site section. Used by base.njk when a page
// doesn't set its own `heroImage` in frontmatter.
//
// Paths are relative to /images/ (the same convention heroImage uses), so the
// resolved URL is `${site.url}/images/${og.sectionDefaults[section] || og.fallback}`.
module.exports = {
  sectionDefaults: {
    programs:   "fall-soccer-interior.jpg",
    register:   "fall-soccer-interior.jpg",
    schedules:  "fall-soccer-interior.jpg",
    fields:     "fall-soccer-interior.jpg",
    about:      "about-interior.jpg",
    contact:    "about-interior.jpg",
    resources:  "about-interior.jpg",
    coaches:    "coaches-interior.jpg",
    referees:   "referees-interior.jpg",
    families:   "families-interior.jpg",
    managers:   "team-interior.jpg",
    volunteers: "team-interior.jpg",
  },
  // Last-resort fallback for pages with no section or unknown section.
  fallback: "home/region13_home_5.jpg",
};
