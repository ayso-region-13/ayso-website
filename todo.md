# AYSO Region 13 — Launch Checklist
**Target: Launch in ~2 weeks**
**Staging:** https://staging.ayso13.org → **Production:** https://www.ayso13.org

---

## Workflow
```
Edit in CMS or GitHub → commits to staging → staging.ayso13.org
  → review → /github workflow run promote-to-production → www.ayso13.org
```

---

## Week 1 — Staging Setup & Content

### Staging Infrastructure
- [x] Create `staging` branch — pushed to origin
- [x] Add `branch: staging` to `.pages.yml` — CMS commits now target staging
- [x] Create `.github/workflows/promote-to-production.yml` — GitHub Actions promote workflow
- [x] Update `site.json` URL → `https://www.ayso13.org`
- [ ] **Add `staging.ayso13.org` custom domain in Cloudflare Pages** ← manual step
  - Cloudflare Pages dashboard → project → Settings → Custom Domains → Add domain
  - Enter `staging.ayso13.org`, associate with the `staging` branch deployment
  - Cloudflare auto-creates the CNAME since DNS is already in Cloudflare
- [ ] **Test promote workflow** — trigger from GitHub Actions UI (Actions tab → Run workflow → type "promote"), verify staging merges to main cleanly
- [ ] **Install GitHub Slack app** — https://slack.github.com → `/github signin` → `/github subscribe magoldman/ayso-website`
  - To promote from Slack: `/github workflow run promote-to-production.yml --repo magoldman/ayso-website`

### Content
- [ ] Resolve 36 remaining INLEAGUE placeholders — URLs documented in `links-to-resolve.md` ← **biggest task**
- [ ] Review field pages for accuracy: hours, addresses, parking notes
- [ ] Source or drop 3 missing IMAGE placeholders:
  - `parents/pledge` — no source found, may need to remove or replace with generic
  - `parents/support` — no source found
  - `programs/winter-stars` — no source found

---

## Week 2 — Final Review & Launch

### Pre-Launch Review
- [ ] Full content review pass on staging.ayso13.org
- [ ] Run link checker: `cd site && node scripts/check-links.js`
- [ ] Promote staging → main (clean deploy before cutover)

### DNS Cutover
- [ ] Add `www.ayso13.org` as custom domain in Cloudflare Pages → main branch deployment
- [ ] Add apex redirect in Cloudflare: `ayso13.org` → `www.ayso13.org`
  - Cloudflare Pages Settings → Custom Domains handles this, or add a redirect rule in Cloudflare
- [ ] Verify `https://www.ayso13.org` resolves and SSL certificate is active (may take a few minutes)
- [ ] Retire `new.ayso13.org` — add a redirect to `www.ayso13.org` or remove the custom domain

### Post-Launch
- [ ] Announce launch internally
- [ ] Monitor 404s for 48 hours — Cloudflare Pages analytics → Error rates

---

## Ongoing / Nice to Have
- [ ] (Optional) Add Cloudflare Access rule to password-protect staging if needed later
- [ ] (Optional) Automate staging → main on a merge schedule

---

## Completed ✓
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
- [x] Tailwind brand colors — red primary, green accent, gold CTAs
- [x] Verify all internal links — 0 broken
- [x] Check external links — 35 checked, 0 broken
- [x] SEO & OpenGraph — canonical, og:site_name, Twitter cards, unique descriptions on all 95 pages
- [x] sitemap.xml and robots.txt
- [x] Photo gallery — `/resources/gallery/` with GLightbox, 62 photos, category filter
- [x] Site search (Pagefind) — `/search/`, footer search box
- [x] Field maps — all field pages; FIS Upper/Lower pages created
- [x] Set up Pages CMS (`.pages.yml`)
- [x] Announcement bar — editable via Pages CMS, toggle + rich-text
- [x] Field status widget — color-coded Open/Monitoring/Closed, Pacific-time last-updated
- [x] Ask the Referee — reinstated as standalone page, 30 verbatim Q&As
- [x] Volunteer training matrix
- [x] Age chart — updated for Fall 2026 cutoff change
- [x] AYSO philosophies bar + affiliate logos (AYSO, Section 1, Area 1C) in footer
- [x] Fixed founding year: 1969 → 1972
- [x] Custom 404 page
- [x] Accessibility audit (WCAG 2.1 AA) — all issues resolved
- [x] Security audit — no secrets, headers file, GLightbox pinned
- [x] Spell check — 1 fix
- [x] Create redirect map (159 old URLs + 76 WordPress Redirection rules)
- [x] Deploy to Cloudflare Pages — live at new.ayso13.org
- [x] Color system: red primary nav/headers, green accent, gold buttons
