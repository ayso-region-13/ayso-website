# AYSO Region 13 — Todo

## In Progress
- [ ] Review and refine site (https://new.ayso13.org)
- [x] Incorporate content edits from Slab review

## Site / Build
- [x] Verify all internal links work — 0 broken
- [x] Check external links — 35 checked, 0 broken
- [x] SEO & OpenGraph — canonical, og:site_name, Twitter cards, unique descriptions on all 95 pages
- [x] sitemap.xml — auto-generated at `/sitemap.xml`
- [x] robots.txt — created, points to sitemap
- [x] Audit `[INLEAGUE: ...]` placeholders — 44 files updated, 36 remaining
- [ ] Resolve 36 remaining INLEAGUE placeholders — URLs documented in `links-to-resolve.md`
- [x] Audit `[IMAGE: ...]` placeholders — wilson, allendale, history filled; 3 still need originals (equipment, parents/pledge, parents/support); winter-stars also missing
- [x] Validate all image ALT tags — 100% coverage confirmed across all .njk and .md files
- [x] Photo gallery — `/resources/gallery/` with GLightbox, 62 photos, category filter
- [x] Add search (Pagefind) — `/search/`, footer search box, footer link
- [x] Field maps — downloaded from ayso13.org, placed on all field pages; FIS Upper/Lower pages created
- [x] Set up Pages CMS — `.pages.yml` committed; connect repo at app.pagescms.org
- [x] Test mobile nav on real devices
- [x] Test all section sidebar links — 0 broken
- [x] Confirm `[DATE]` placeholder resolves correctly on all pages
- [x] Fix search page header alignment — max-w-2xl to match search box width

## Content
- [x] Home page — `site/src/index.md` updated to match `home.njk` layout expectations
- [x] Remove Summer Camps from all pages and navigation
- [ ] Review field pages for accuracy (hours, address, parking)
- [x] Confirm sponsor logos/data in `site/src/_data/sponsors.js` are current
- [x] Volunteer matrix — `/volunteers/training-matrix/`
- [x] Age chart — updated for Fall 2026 cutoff change (Dec 31 → Aug 1), new official chart image, 8U/Grad Series play-up exception
- [x] Visual polish — dark page headers (red nav → dark content header hierarchy), green sidebar strip + hover/active states, green checkmarks in training matrix
- [x] Photo gallery GLightbox fix — filter-aware lightbox using `.lb-active` selector; clicking photos now opens modal with prev/next navigation

## Assets
- [x] Export/collect photos from WordPress — wilson-field.jpg, allendale-field.jpg, about-history.jpeg downloaded and placed; IMAGE placeholders replaced on those pages
- [ ] Source photos for parents/pledge, parents/support, programs/winter-stars — no usable photos found on WordPress site; need originals
- [x] Organize documents in Google Drive for embedded links
- [x] Confirm logo.svg is final version

## Redirects & Launch
- [x] Create redirect map: all 159 old WordPress URLs → new URLs (`site/src/_redirects`, copies to `_site/` on build)
- [x] Set up Cloudflare Pages — https://new.ayso13.org (staging), https://ayso13.pages.dev (direct)
- [x] Test all redirects on new.ayso13.org — 13/13 pass; created 404.html (was missing, causing 200 on unknown paths)
- [x] Custom 404 page — red card theme, search bar, top-level nav links
- [x] Spell check — 1 fix: "Soccersauruses" in hall-of-fame.md; all other flags were proper nouns or jargon
- [x] Security audit — no leaked keys or secrets; fixed: GLightbox pinned to 3.3.1, .env* added to .gitignore, _headers file added (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy)
- [x] Accessibility audit (WCAG 2.1 AA) — all issues resolved: aria role on mobile menu, 7 contrast fixes across nav, sidebar, checkmarks, and footer
- [x] Color system overhaul — green nav (dark #007a32), green page headers (brand green), gold buttons, red prose headings; home page declashed (dark quick bar, simplified role cards)
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
