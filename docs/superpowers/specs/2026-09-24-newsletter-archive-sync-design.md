# Newsletter archive sync — design

Date: 2026-09-24
Status: draft, awaiting review

## Goal

https://www.ayso13.org/resources/newsletters/ should list every Soccer News newsletter from the retention window and keep itself current, with no one pasting links. Today the page is 92 hand-pasted `eomail4.com/web-version` links covering 2023–2025, and nothing from 2026.

## Why we host the newsletters ourselves

The EmailOctopus v2 API is read-only for campaigns (`GET /campaigns`, `GET /campaigns/{id}`). It returns `id`, `status`, `name`, `subject`, `to` (list IDs), `sent_at` and `content.html`, but not the web-version URL. That URL carries a signature (`s=`, 64 hex characters) we can't compute. Tested 2026-09-24 against a real link: with `s` it returns 200; without it, or with a fake one, it returns 400.

So each newsletter gets its own page on ayso13.org, built from `content.html`.

## What was found in the real data

- The public newsletter is the **Soccer News** list, `5ee4e68d-7557-11eb-a3d0-06b4694bee2a` (6,276 subscribers). Everything else goes to small targeted lists (EXTRA invites and tryouts, a U12 team, preschool rosters, Winter Stars, referee staff). Those stay off the site; some carry roster or tryout details.
- Soccer News had 14 sends in 2026, from 2026-02-07 to 2026-09-24.
- `content.html` is a full HTML document: three `<style>` blocks, a Raleway `<link>`, no scripts, no iframes. Images load from `eogallery1.com`, `gallery.eomail4.com` and `gallery.eousercontent.com`. Links are the raw destinations (tracking is added at send time).
- The merge tags present are `{{PreviewText}}`, `{{UnsubscribeURL}}`, `{{SenderInfo}}` and `{{RewardsURL}}`, all in the preheader or footer.
- The API has no preview-text field, so the page description is built from the subject and date.
- `GET /campaigns` returns newest first, 100 per page, with a `paging.next.starting_after` cursor. The account has more than 100 campaigns.

## Decisions

1. **Approach:** a daily snapshot committed to git. Builds never call EmailOctopus.
2. **Publishing:** straight to production. The sync commits to both `staging` and `main`, the same way Slack field status does.
3. **Retention:** the current and previous calendar year (Pacific time), with a floor of 2026-01-01. So through 2027 the page shows 2026 onward; in 2028 it shows 2027 and 2028. The floor exists because the request was "all 2026 newsletters" with the older ones cleaned out.
4. **Rendering:** a standalone page per newsletter, not an iframe. The site CSP `frame-src` has no `'self'`, and iframe content isn't indexed by search engines or Pagefind.

## Components

### 1. Sync script: `site/scripts/sync-newsletters.mjs`

Node, no new dependencies. It reads `EMAILOCTOPUS_API_KEY` from the environment.

- Pages through `GET /campaigns`, stopping once `sent_at` falls before the retention cutoff.
- Keeps campaigns with `status == "sent"`, `to` containing the Soccer News list ID, and `sent_at` inside the window.
- Cleans each `content.html`:
  - removes the footer block holding "You received this email because you subscribed" (the `{{UnsubscribeURL}}` and `{{SenderInfo}}` block)
  - removes the element linking `{{RewardsURL}}` (the "Sent by EmailOctopus" badge)
  - replaces `{{PreviewText}}` with an empty string
  - fails if any `{{…}}` is left afterwards, naming the campaign and the tag. A future `{{FirstName}}` must not go live unfilled.
- Slug: `YYYY-MM-DD-<subject slug>`, from the Pacific send date and the subject with emoji and punctuation stripped. Example: `2026-09-16-week-2-news-info`. If two sends share a date and subject, add `-2`, `-3` in send order.
- Label: the subject with emoji stripped and whitespace collapsed, e.g. "Week 2 News & Info".
- Writes the whole set every run:
  - `site/newsletters/<slug>.html`, the cleaned document
  - `site/newsletters/index.json`, an array of `{ id, slug, title, sentAt }`, newest first
  - It deletes any `.html` in `site/newsletters/` that isn't in the new index. That is how old newsletters get removed.
- Output is deterministic (stable key order, trailing newline), so an unchanged API produces an unchanged tree and no commit.
- Pure functions (filtering, cutoff, cleaning, slug) are exported and covered by `node:test` in `site/scripts/sync-newsletters.test.mjs`. The fixture is trimmed from a real Soccer News email. A `test` script is added to `site/package.json`.

### 2. Build: data loader and templates

- `site/src/_data/newsletters.js` reads `index.json` and each HTML file. For each document it separates the `<style>` blocks from the `<body>` inner HTML. Missing directory means an empty list, not a failed build.
- `site/src/resources/newsletters/newsletter.njk` paginates over it (size 1). Permalink: `/resources/newsletters/<slug>/`.
- The newsletter layout is its own minimal document, not `base.njk`, so the email's CSS can't collide with Tailwind. It has:
  - our `<head>`: title "<label> · Region 13 Newsletter", canonical URL, meta description ("Region 13 Soccer News newsletter sent <date>: <label>."), OG and Twitter tags using the resources section default image, favicon, the email's `<style>` blocks
  - a thin Region 13 bar above the email: logo linking home, the send date, and an "All newsletters" link back to the archive
  - the email body inside `<main data-pagefind-body>`
- Analytics: the GA4 block is currently copied into both `base.njk` and `temp.njk`. A third copy would drift, so this work pulls it into `_includes/ga4.njk`, used by all three. PostHog already has a shared include.
- Sitemap: newsletter pages are included. `sitemap.njk` currently takes `<lastmod>` from `page.inputPath | lastModDate`, which would give every paginated newsletter the template's own git date. It gets a small change: use `page.data.newsletter.sentAt` when present, otherwise fall back to the existing filter. `llms-full` skips newsletter pages, since the news is dated.
- Archive page: `resources/newsletters.md` stays CMS-editable. The 2023–2025 HTML block is replaced with a `[NEWSLETTER ARCHIVE]` paragraph. `page.njk` swaps it for `_includes/newsletter-archive.njk`, which renders year headings (newest first) with dated links, following the `[SPONSOR TIERS]` pattern. With no newsletters it says the archive is empty rather than rendering nothing.

### 3. Workflow: `.github/workflows/sync-newsletters.yml`

It lives on `staging`, since a `schedule` trigger only fires from the default branch.

- Triggers: `schedule` at `0 13 * * *` (6am PDT, 5am PST) and `workflow_dispatch`.
- Secret: `EMAILOCTOPUS_API_KEY` (new). It also uses the existing `PROMOTE_TOKEN` and `SLACK_BOT_TOKEN`.
- Steps:
  1. Check out `staging` with `PROMOTE_TOKEN`. A push made with `GITHUB_TOKEN` starts no workflows, so the staging deploy would never fire.
  2. Run the sync. If `site/newsletters/` is unchanged, stop.
  3. Commit ("Newsletters: sync from EmailOctopus (N added, M removed)") and push to `staging`. That starts `deploy-pages-staging.yml`.
  4. Check out `main`, run the sync again, commit and push with `PROMOTE_TOKEN`, which bypasses the ruleset.
  5. Post to `#notify-website-status`: the titles added and removed on success, the error on failure. Untrusted strings (subjects) reach the shell only through `env:`, never inline `${{ }}`.
- `rebuild-production.yml` adds `site/newsletters/**` to its `push` paths filter. Its existing `Merge ` skip still applies, so a promote doesn't queue a second deploy.
- A push to `main` fires only the narrow rebuild, so no other staging content reaches production.
- `concurrency: sync-newsletters`, so a manual run can't overlap the scheduled one.

## Error handling

- API error, bad key or rate limit: the script exits non-zero, nothing is committed, and Slack gets the failure. The site keeps the last good snapshot.
- Leftover merge tag: the same, with the campaign subject in the message.
- A push to `main` that loses a race with a promote: rebase and retry once, then fail loudly.
- The deploy watchdog already covers `rebuild-production.yml`.

## Rollout

1. Build on `staging`, run the sync locally, commit the first snapshot, build and check the rendered pages.
2. Add the `EMAILOCTOPUS_API_KEY` GitHub secret.
3. Promote once, so `main` has the templates and the widened `rebuild-production.yml` filter.
4. Run the workflow by hand and confirm www updates.

## Out of scope

- Other lists (Winter Stars, EXTRA, preschool, referees).
- Copying images to R2. They stay on EmailOctopus's CDN.
- Redirects for the old eomail links (they are external URLs, not ours).
- An RSS feed.
