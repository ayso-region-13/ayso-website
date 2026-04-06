# AYSO Region 13 — Todo

## In Progress
- [ ] Review and refine site locally (testing at localhost:8080)
- [ ] Incorporate content edits from Slab review

## Site / Build
- [x] Verify all internal links work — 0 broken
- [x] Check external links — 35 checked, 0 broken
- [x] SEO & OpenGraph — canonical, og:site_name, Twitter cards, unique descriptions on all 95 pages
- [x] sitemap.xml — auto-generated at `/sitemap.xml`
- [x] robots.txt — created, points to sitemap
- [ ] Update `site.json` URL from `new.ayso13.org` → `ayso13.org` before launch
- [x] Audit `[INLEAGUE: ...]` placeholders — 44 files updated, 36 remaining
- [ ] Resolve 36 remaining INLEAGUE placeholders — URLs documented in `links-to-resolve.md`
- [ ] Audit `[IMAGE: ...]` placeholders — assign actual images or remove
- [ ] Test mobile nav on real devices
- [ ] Test all section sidebar links
- [ ] Confirm `[DATE]` placeholder resolves correctly on all pages

## Content
- [x] Home page — `site/src/index.md` updated to match `home.njk` layout expectations
- [x] Remove Summer Camps from all pages and navigation
- [ ] Review field pages for accuracy (hours, address, parking)
- [x] Confirm sponsor logos/data in `site/src/_data/sponsors.js` are current

## Assets
- [ ] Export/collect remaining photos from current WordPress site
- [ ] Organize documents in Google Drive for embedded links
- [ ] Confirm logo.svg is final version

## Redirects & Launch
- [x] Create redirect map: all 159 old WordPress URLs → new URLs (`site/src/_redirects`, copies to `_site/` on build)
- [ ] Set up Cloudflare Pages project
  - Root directory: `site`
  - Build command: `npm run build`
  - Build output: `_site`
- [ ] Connect custom domain (ayso13.org)
- [ ] Test all redirects
- [ ] Announce launch internally
- [ ] Monitor 404s post-launch

## Completed
- [x] Crawl existing site (159 pages)
- [x] Propose new IA (~75 pages)
- [x] Write all 97 content pages in `/content/`
- [x] Upload content to Slab for review
- [x] Choose platform (Eleventy + Tailwind CSS)
- [x] Scaffold Eleventy site in `/site/`
- [x] Build base/page/home layouts (Nunjucks)
- [x] Build full navigation (desktop dropdown, mobile accordion, section sidebars)
- [x] Migrate content from `/content/` into `site/src/`
- [x] Add photos (65 images) and logo to `site/src/images/`
- [x] Set up build scripts (migrate, file-dates, photo processing, link checking)
- [x] Tailwind brand colors configured (red, green, gold, dark)
- [x] Fix btn-primary/btn-gold/btn-secondary text invisible inside .prose (`.prose a` now excludes btn- classes)
