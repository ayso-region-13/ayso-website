# How the AYSO Region 13 Website Works

A short reference for board members and volunteers. Last updated April 2026.

---

## Where the site lives

| Where | What it is |
|---|---|
| **www.ayso13.org** | Production — what the public sees |
| **staging.ayso13.org** | Staging — preview of pending changes before they go live |
| **localhost:8080** | Local development — used only by the developer building changes |

The site is hosted on **Cloudflare Pages**. There's no traditional web server, no WordPress, no PHP, no database. Every page is pre-built into static HTML/CSS/JS files and served from Cloudflare's global network.

Source code lives in GitHub: https://github.com/ayso-region-13/ayso-website

---

## How it's built

The site is a custom-built **static site** using [Eleventy (11ty)](https://www.11ty.dev/) — a Node.js tool that turns Markdown files and templates into HTML pages. Styling is done with [Tailwind CSS](https://tailwindcss.com/). The font is Raleway from Google Fonts.

What that means in plain English:
- Every page on the site exists as a Markdown file in the GitHub repo
- A build process turns those files into a folder of static HTML files
- Cloudflare serves those HTML files to visitors

Why this matters:
- **Fast** — no database queries, no PHP runtime; pages load instantly
- **Cheap** — Cloudflare Pages is free at our traffic volume
- **Reliable** — no server to crash, no plugins to update
- **Secure** — no admin panel, no SQL injection, no PHP exploits to worry about

---

## How content gets edited

We have two ways content can change:

### 1. Pages CMS (for non-technical editors)

URL: https://app.pagescms.org

Editors log in with email — no GitHub account needed. The CMS shows a friendly form-based interface for editing specific things:
- **Field Status** — the colored bar at the top of the homepage (Open / Monitoring / Closed)
- **Announcement Bar** — toggleable banner under the hero on the homepage
- **About / Programs / Fields / etc.** — body content of every page on the site
- **Ask the Referee Q&As** — Steve's collection (one form per question)

Saving in the CMS automatically commits to the staging branch on GitHub, which triggers Cloudflare to rebuild staging.ayso13.org within ~1 minute. Production stays unchanged until someone "promotes" staging to production.

### 2. Direct GitHub edits (for the developer)

For structural changes — adding new pages, changing layouts, updating the navigation, etc. — those happen as git commits to the staging branch.

---

## The staging → production workflow

```
Edit in CMS or GitHub
        ↓
   commits to "staging" branch
        ↓
Cloudflare rebuilds staging.ayso13.org (~1 min)
        ↓
Review the change on staging
        ↓
   "/ayso promote" in Slack  or  GitHub Actions "Promote Staging to Production"
        ↓
Cloudflare rebuilds www.ayso13.org (~1 min)
```

**Nothing goes live without explicitly promoting it.** If a change looks wrong on staging, it can be edited or reverted before reaching production.

---

## The Slack bot — `/ayso`

Type `/ayso` in any AYSO Region 13 Slack channel to see options. Available commands:

| Command | What it does |
|---|---|
| `/ayso fields open` | Sets field status to OPEN on the homepage |
| `/ayso fields closed [reason]` | Sets to CLOSED with optional message |
| `/ayso fields monitoring [reason]` | Sets to MONITORING with optional message |
| `/ayso announce [text]` | Updates the announcement bar text |
| `/ayso announce off` | Hides the announcement bar |
| `/ayso promote` | Pushes everything from staging to production |

Only people on the allowlist (`slack-bot/allowed-users.json` in the repo) can run these commands. Updates take effect within ~1 minute.

---

## What's editable vs. what isn't

### Editable in Pages CMS (no developer needed)

- Body text and headings of every page (programs, fields, parents, coaches, referees, FAQs, etc.)
- Hero images on individual pages
- Field status widget (Open / Closed / Monitoring + message)
- Announcement bar (on/off + text)
- Ask the Referee Q&As (add new entries; date is auto-set from the commit date)

### Requires a developer to change

- Site navigation (top menu, section sidebars) — lives in code
- Page templates / layouts — visual design of pages
- Brand colors, fonts, design system
- Adding new pages outside existing sections
- Slack bot configuration
- Image processing pipeline
- Anything in the homepage's hero, "Let's Play" tiles, or the photo gallery strip

---

## Domains and DNS

| Domain | Status |
|---|---|
| `www.ayso13.org` | Production — Cloudflare Pages custom domain on the `main` branch |
| `staging.ayso13.org` | Staging — Cloudflare Pages branch deployment on `staging` |
| `ayso13.org` (apex) | Currently the legacy WordPress site (cutover pending) |

Once the legacy site is retired, `ayso13.org` will redirect to `www.ayso13.org`.

---

## Analytics

Google Analytics 4 is installed site-wide. Property ID `G-9YM9ZDW1J9`. Access via the Region 13 Google Workspace account.

---

## Who maintains what

- **Developer (Matthew)** — code changes, deployments, Slack bot, layout changes, anything in the repo
- **Steve Hawkins** — Ask the Referee answers (via Pages CMS)
- **Board / commissioners** — content on their respective section pages (via Pages CMS)
- **Anyone with `/ayso` access** — field status, announcement bar (via Slack)

For technical issues or to add new editors, contact the developer.

---

## Internal references (for the technically curious)

- Source code: https://github.com/ayso-region-13/ayso-website
- Build platform: Eleventy 3.0 + Tailwind CSS 3.4
- Hosting: Cloudflare Pages
- CMS: Pages CMS (https://pagescms.org)
- Slack bot: Cloudflare Worker (`/slack-bot/`)
- Brand palette: see `brand-colors.md` in repo
- Design context: see `.impeccable.md` in repo
