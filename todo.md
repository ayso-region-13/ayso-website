# AYSO Region 13 — Launch Checklist
**Staging:** https://staging.ayso13.org → **Production:** https://www.ayso13.org

---

## Workflow
```
Edit in CMS or GitHub → commits to staging → staging.ayso13.org
  → review → /github workflow run promote-to-production → www.ayso13.org
```

---

## Remaining Tasks

### Infrastructure
- [ ] **Update NODE_VERSION** from 18 → 22 in Cloudflare Pages dashboard (Settings → Environment variables)
- [ ] **Test promote workflow** — trigger from GitHub Actions UI (Actions tab → Run workflow → type "promote"), verify staging merges to main cleanly
- [ ] **Install GitHub Slack app** — https://slack.github.com → `/github signin` → `/github subscribe ayso-region-13/ayso-website`
  - To promote from Slack: `/github workflow run promote-to-production.yml --repo ayso-region-13/ayso-website`

### Content
- [ ] **2 unresolved INLEAGUE placeholders** (newsletter signup URLs not found on old site — ask the team):
  - `referees/resources.md` — Newsletter subscription links
  - `resources/newsletter.md` — WhistleStop (AYSO national referee newsletter) subscription link
- [ ] **3 missing IMAGE placeholders** — source or remove:
  - `parents/pledge` — no source found
  - `parents/support` — no source found
  - `programs/winter-stars` — no source found
- [ ] Review field pages for accuracy: hours, addresses, parking notes
- [ ] Full content review pass on staging.ayso13.org

### Slack Bot (field status / announcements from Slack)
- [ ] Complete Slack app setup (Steps 1–5 in `slack-bot/SETUP.md`)
- [ ] Deploy Cloudflare Worker: `cd slack-bot && wrangler deploy`
- [ ] Set 4 secrets: `SLACK_SIGNING_SECRET`, `SLACK_BOT_TOKEN`, `SLACK_CHANNEL_ID`, `GITHUB_TOKEN`
- [ ] Test: `/ayso` in Slack → modal opens → submit → check staging and main both update

### Pre-Launch
- [ ] Run link checker: `cd site && node scripts/check-links.js`
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
