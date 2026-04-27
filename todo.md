# AYSO Region 13 — Launch Checklist
**Staging:** https://staging.ayso13.org → **Production:** https://www.ayso13.org

---

## Workflow
```
Edit in CMS or GitHub → commits to staging → staging.ayso13.org
  → review → /ayso promote (Slack) → www.ayso13.org
```

---

## Remaining Tasks

### Infrastructure
- [ ] Update Node version in Cloudflare Pages to suppress LTS maintenance warning (currently 22, upgrade to 24)

### Content
- [ ] **2 missing IMAGE placeholders** — source or remove:
  - `parents/pledge` — no source found
  - `parents/support` — no source found
- [ ] Full content review pass on staging.ayso13.org (board members)


### Pre-Launch
- [x] Run link checker — clean (`cd site && node scripts/check-links.js`)
- [ ] Promote staging → main (clean deploy before cutover)

### DNS Cutover
- [ ] Add `www.ayso13.org` as custom domain in Cloudflare Pages → main branch deployment
- [ ] Add apex redirect in Cloudflare: `ayso13.org` → `www.ayso13.org`
- [ ] Verify `https://www.ayso13.org` resolves and SSL is active
- [ ] Retire `new.ayso13.org` — redirect to `www.ayso13.org` or remove custom domain

### Post-Launch
- [ ] Announce launch internally
- [ ] Monitor 404s for 48 hours — Cloudflare Pages analytics → Error rates

---

## Completed ✓

### Session 13 (2026-04-26)
- [x] INLEAGUE newsletter signup links resolved — Region 13 Referee Newsletter + WhistleStop Newsletter URLs wired up (referees/resources, resources/newsletters)
- [x] Site-wide negative-to-positive tone sweep — 7 markdown files reframed ("Don't yell at referees" → "Speak respectfully to referees", etc.); deliberate keeps documented for safety/policy prohibitions
- [x] Parent Pledge reframed as Kids Zone — page rewritten to follow AYSO National's authoritative 10 guidelines (kids first, fun > winning, respect referees, etc.); no longer framed as a contract parents sign; site-wide reference sweep across 9 files
- [x] PDFs relocated from old WordPress to local `/assets/docs/`:
  - `concussion-sca-forms.pdf` (used in 2 places)
  - `fifa-11plus.pdf` (resources/safety)
  - `penalty-kick-guidelines-2023.pdf` (referees/laws)
- [x] New `/resources/newsletters/` page — replaces old `/resources/newsletter/`; EmailOctopus subscribe widget copied 1:1 from WP; full archive (97 newsletters, 2021–2025) preserved with original third-party URLs intact
- [x] New `/forms/` page — replicates the WP `/forms/?go=1` Google Apps Script iframe upload tool; same iframe overlay behavior, same script URL, same query-string triggers (`?go=1`, `?go=2`, `?key=`, `?ID=`)
- [x] Gallery page palette fix — green header → cream + maroon, two-tone signature strip added, filter buttons updated to new burgundy `#83312d`, AA contrast on Share callout links
- [x] Link checker hardened — `scripts/check-links.js` now auto-runs `npm run build` before checking; pass `--no-build` to skip; eliminates false positives from dev-server transform-on-request URLs
- [x] Redirect map updates — `/news/` → `/resources/newsletters/`, `/resources/newsletter/` → plural URL; `/forms/` no longer redirects (now serves the upload page directly)
- [x] Leadership table fixed — Operations table was rendering only 2 of 3 columns (header declared `Role | Name`, rows had Role/Name/Email); now full 3 columns visible with all email addresses
- [x] Horizontal rules stripped — 536 standalone `---` body separators removed across 77 markdown files
- [x] Prose H2 underline removed — `border-b border-gray-200` on every `.prose h2` was the source of the gray line under "Quick Facts", "How Registration Works", etc.

### Session 12 (2026-04-26)
- [x] Sponsor strip removed from home page (commented out in home.njk for easy re-enable)
- [x] Sponsor logos removed from /volunteers/sponsors/ page; page now leads with "Become a Sponsor" tier cards + how-to-contribute info
- [x] Wide hero strip removed from interior page template (page.njk); body imagery only
- [x] Hero image moved into body markdown for the 2 pages that had hero only (wca, winter-stars)
- [x] Page H1 weight bumped to font-extrabold for stronger headline
- [x] 100 markdown files swept: duplicate `# Title` and description-rephrase intro paragraphs removed; substantive intros (definitions, dates, tips) kept
- [x] /volunteers/roles/ enhanced — combined with authoritative content from old ayso13.org/roles; added 12 missing roles; existing role descriptions enriched; reorganized General Board into 6 subgroups
- [x] Lighter red strip added below maroon quick-action bar (above field status bar)
- [x] "I'm a soccer..." panel given brand-red border-4
- [x] New logo SVG (red/pink design) — squared viewBox, regenerated favicons via rsvg-convert (true transparency)
- [x] Brand palette refresh:
  - brand-red: #ff3c3c → #f74b4b (coral)
  - brand-red-dark: #ce0e2d → #83312d (burgundy; contrast improves: white-on-dark goes 5.83→8.6:1)
  - brand-cream: #ede5d3 → #ede8e2 (cooler off-white)
  - brand-header, brand-dark, brand-green, brand-gold: small palette-matching tweaks
- [x] Random hero on page load — 5 candidate images at site/src/images/home/region13_home_*.jpg; JS picks one each load; image 1 is no-JS fallback (loading=eager + fetchpriority=high), 2-5 hidden + lazy
- [x] Highlighter-bar text overlay for hero (white-on-red bar + red-on-white bar, semi-transparent)
- [x] OG image fallback set to /images/home/region13_home_5.jpg
- [x] New branded home imagery installed: 6 program tiles (tile_core, tile_preschool, tile_upper, tile_allstars, tile_grad, tile_epic) + 3 gallery photos (gallery_1/2/3)
- [x] Audit pass (19/20 → resolved 3 items): Ask the Referee Related Pages links, sponsor strip hover, tile subtitle weight bumped to large-text qualifying
- [x] Documentation updated: claude.md (palette + last-updated), brand-colors.md (full palette refresh), site-overview.md (Slab-friendly summary)

### Session 11 (2026-04-26)
- [x] Home page redesign — huge SOCCER FOR EVERYONE hero, two-tone alternating buttons, Let's Play tiles with semi-transparent inset labels (alternating dark red / maroon bodies)
- [x] Header redesign — light/white background, dark nav text, inLeague pill button replacing the gold Register CTA
- [x] New logo SVG (recolored) — replaced existing; viewBox made square (`0 -13.7295 264.817 264.817`) so square containers don't distort it
- [x] Brand palette refresh — `brand-red` #ff3c3c (bright accent), `brand-red-dark` #ce0e2d (logo red, primary), added `brand-cream` #ede5d3, `brand-maroon-dark` #3a0d12; `brand-green` to #a7ce57; `brand-gold` to #f5bd4e
- [x] Site-wide font swap: Inter → Raleway (Google Fonts, weights 300–900)
- [x] Image optimization pipeline — `@11ty/eleventy-img` plugin auto-converts every `<img>` to `<picture>` with AVIF + WebP + JPEG variants at 600/1200/1920w
- [x] Interior page redesign — `bg-red-50` → `bg-brand-cream` for page header, `text-red-900` → `text-brand-maroon` for breadcrumb/description, `bg-brand-red` → `bg-brand-maroon` for sidebar header bar, two-tone signature strip below page header
- [x] Site-wide WCAG AA contrast pass — prose H1/H2/H3 + body links to `brand-red-dark`, sidebar hover/active states, desktop nav hover/active, skip-to-main focus, Ask the Referee category headings + TOC links
- [x] Favicon transparency fixed — regenerated via `rsvg-convert` (ImageMagick was rasterizing with opaque white in padded areas)
- [x] `.impeccable.md` design context document — locks in personality, brand principles, locked-in colors/font/logo
- [x] `brand-colors.md` — full palette with hex, RGB, usage notes, contrast cheat-sheet
- [x] `site-overview.md` — Slab-friendly site summary for the team wiki

### Session 10 (2026-04-19)
- [x] Ask the Referee — rebuilt as accordion FAQ with 30 Q&As in 7 categories (ask-the-referee.njk layout)
- [x] Pages CMS qa-answers collection — Steve can add Q&As via form UI (question, category, answer); date auto-set from git commit
- [x] Fixed redirect `/ask-the-referee` → `/referees/ask-the-referee/` (was pointing to `/referees/faqs/`)
- [x] Fixed `TemplateContentUnrenderedTemplateError` — use `layout: false` + `noindex: true` instead of `permalink: false` for Q&A files
- [x] Fix `/ayso promote` merge conflict — workflow now uses `-X theirs` so staging always wins; synced workflow file on both branches
- [x] Promoted staging → production (www.ayso13.org)

### Session 9 (2026-04-19)
- [x] Fields audit — added 4 missing field pages: Butler, Cornishon, LC LDS, Pasadena HS
- [x] Field pages — Problems & Contact section on all 22 field pages (Rolf text + Typeform link)
- [x] Area H — updated with specific rules (Mon–Thu until dark, Fields 1–4 only, no Fridays)
- [x] Removed Marco's personal number from all field pages
- [x] NODE_VERSION updated to 22 in Cloudflare Pages (done by user)

### Session 8 (2026-04-19)
- [x] Slack bot (`/ayso`) — field status, announcements, and promote (staging → main) all working
- [x] `/ayso promote` — triggers GitHub Actions workflow; posts result to #notify-website-status
- [x] User allowlist — `slack-bot/allowed-users.json` (editable without secrets)
- [x] Google Analytics — GA4 tag (G-9YM9ZDW1J9) in base.njk, conditioned on `site.gaId`
- [x] robots.txt — fixed sitemap URL to `https://www.ayso13.org/sitemap.xml`
- [x] FIS Upper/Lower — address corrected to 4320 Cornishon Ave, La Cañada Flintridge

### Session 7 (2026-04-19)
- [x] Board minutes archive — 79 PDFs self-hosted at `/assets/docs/minutes/`, page updated with all links (2014–2022)
- [x] Google Maps embeds — all 17 field pages (auto-generated from existing address links)
- [x] Resolved 28 of 30 INLEAGUE link placeholders (scraped real URLs from ayso13.org)
- [x] Deleted `/content/` folder — all content lives in `site/src/`

### Session 6 (2026-04-07)
- [x] Site color redesign — dark header (`#230612`), maroon quick action bar (`#8e2929`), updated red/gold
- [x] Announcement bar moved below hero (field status stays at top)
- [x] All 18 field pages standardized — consistent layout, map embeds, sidebar fix, HRs removed
- [x] Pages CMS `branch: staging` cherry-picked to main so CMS targets correct branch
- [x] Slack bot plan documented in `slack-bot/SETUP.md`

### Earlier Sessions
- [x] Crawl existing site (159 pages)
- [x] Propose new IA (~75 pages)
- [x] Write all 97 content pages
- [x] Upload content to Slab for review
- [x] Choose platform (Eleventy + Tailwind CSS)
- [x] Scaffold Eleventy site in `/site/`
- [x] Build base/page/home layouts (Nunjucks)
- [x] Build full navigation (desktop dropdown, mobile accordion, section sidebars)
- [x] Migrate content from `/content/` into `site/src/`
- [x] Add photos (65 images) and logo
- [x] Set up build scripts (migrate, file-dates, photo processing, link checking)
- [x] Tailwind brand colors — red, green, gold
- [x] Verify all internal links — 0 broken
- [x] SEO & OpenGraph — canonical, og tags, unique descriptions on all 95 pages
- [x] sitemap.xml and robots.txt
- [x] Photo gallery — `/resources/gallery/` with GLightbox, 62 photos, category filter
- [x] Site search (Pagefind) — `/search/`, footer search box
- [x] Field maps — all field pages; FIS Upper/Lower pages created
- [x] Set up Pages CMS (`.pages.yml`)
- [x] Announcement bar — editable via CMS, toggle + rich-text
- [x] Field status widget — color-coded Open/Monitoring/Closed, Pacific-time last-updated
- [x] Ask the Referee — standalone page, 30 Q&As
- [x] Volunteer training matrix
- [x] Age chart — updated for Fall 2026 cutoff change
- [x] AYSO philosophies bar + affiliate logos in footer
- [x] Custom 404 page
- [x] Accessibility audit (WCAG 2.1 AA)
- [x] Security audit — no secrets, headers file, GLightbox pinned
- [x] Create redirect map (159 old URLs + 76 WordPress rules)
- [x] Deploy to Cloudflare Pages — live at new.ayso13.org
- [x] staging.ayso13.org custom domain configured
- [x] Promote-to-production GitHub Actions workflow created
