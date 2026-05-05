// Default OG/Twitter image per site section. Used by base.njk when a page
// doesn't set its own `heroImage` in frontmatter.
//
// Values are full site-relative URLs (e.g. "/images/foo.jpg") to match the
// convention used by `heroImage` and body markdown image links. Pages CMS
// previews images correctly when the stored value is a complete URL path
// rather than a bare filename.
module.exports = {
  sectionDefaults: {
    programs:   "/images/fall-soccer-interior.jpg",
    register:   "/images/fall-soccer-interior.jpg",
    schedules:  "/images/fall-soccer-interior.jpg",
    fields:     "/images/fall-soccer-interior.jpg",
    about:      "/images/about-interior.jpg",
    contact:    "/images/about-interior.jpg",
    resources:  "/images/about-interior.jpg",
    coaches:    "/images/coaches-interior.jpg",
    referees:   "/images/referees-interior.jpg",
    families:   "/images/families-interior.jpg",
    managers:   "/images/team-interior.jpg",
    volunteers: "/images/team-interior.jpg",
  },
  // Last-resort fallback for pages with no section or unknown section.
  fallback: "/images/home/region13_home_5.jpg",
};
