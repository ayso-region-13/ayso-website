# AYSO Region 13 — Todo

## In Progress
- [ ] Review and refine site (https://new.ayso13.org)
- [ ] Incorporate content edits from Slab review

## Site / Build
- [x] Verify all internal links work — 0 broken
- [x] Check external links — 35 checked, 0 broken
- [x] SEO & OpenGraph — canonical, og:site_name, Twitter cards, unique descriptions on all 95 pages
- [x] sitemap.xml — auto-generated at `/sitemap.xml`
- [x] robots.txt — created, points to sitemap
- [x] Audit `[INLEAGUE: ...]` placeholders — 44 files updated, 36 remaining
- [ ] Resolve 36 remaining INLEAGUE placeholders — URLs documented in `links-to-resolve.md`
- [x] Audit `[IMAGE: ...]` placeholders — all field maps placed; 4 remaining need original assets (equipment, historical photo, parents/pledge, parents/support)
- [x] Photo gallery — `/resources/gallery/` with GLightbox, 62 photos, category filter
- [x] Add search (Pagefind) — `/search/`, footer search box, footer link
- [x] Field maps — downloaded from ayso13.org, placed on all field pages; FIS Upper/Lower pages created
- [x] Set up Pages CMS — `.pages.yml` committed; connect repo at app.pagescms.org
- [ ] Test mobile nav on real devices
- [x] Test all section sidebar links — 0 broken
- [ ] Confirm `[DATE]` placeholder resolves correctly on all pages

## Content
- [x] Home page — `site/src/index.md` updated to match `home.njk` layout expectations
- [x] Remove Summer Camps from all pages and navigation
- [ ] Review field pages for accuracy (hours, address, parking)
- [x] Confirm sponsor logos/data in `site/src/_data/sponsors.js` are current
- [x] Volunteer matrix — `/volunteers/training-matrix/`
- [x] Visual polish — dark page headers (red nav → dark content header hierarchy), green sidebar strip + hover/active states, green checkmarks in training matrix
- [x] Photo gallery GLightbox fix — filter-aware lightbox using `.lb-active` selector; clicking photos now opens modal with prev/next navigation

## Assets
- [ ] Export/collect remaining photos from current WordPress site
- [ ] Organize documents in Google Drive for embedded links
- [ ] Confirm logo.svg is final version

## Redirects & Launch
- [x] Create redirect map: all 159 old WordPress URLs → new URLs (`site/src/_redirects`, copies to `_site/` on build)
- [x] Set up Cloudflare Pages — https://new.ayso13.org (staging), https://ayso13.pages.dev (direct)
- [ ] Test all redirects on new.ayso13.org
- [ ] Update `site.json` URL from `new.ayso13.org` → `ayso13.org` before final launch
- [ ] Cut over custom domain from new.ayso13.org → ayso13.org
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
- [x] Fix btn-primary/btn-gold/btn-secondary text invisible inside .prose
- [x] Deploy to Cloudflare Pages — live at https://new.ayso13.org
