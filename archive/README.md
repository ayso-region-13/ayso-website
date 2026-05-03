# Legacy WordPress PDF archive

Recovered from Wayback Machine snapshots of `ayso13.org/wp-content/uploads/` (the legacy WordPress site, retired 2026-05-01 when DNS cut over to the new Eleventy site).

## Why this exists

The legacy WP site held ~155 PDFs that were lost during the platform migration. Wayback Machine had snapshots of most of them. This directory preserves the ones we recovered, in their original WP path structure (`year/month/filename.pdf`), so the institutional record isn't lost.

## What's served vs. archived

This directory is **outside `site/`**, so Cloudflare Pages never deploys it. Files here are tracked in git for posterity but are not publicly accessible from the live site.

The subset that is publicly linked from the site lives in `site/src/assets/docs/`:

| Topic | Served path |
|---|---|
| Coach manuals (6U / 8U / 10U / 12U / Intermediate) | `site/src/assets/docs/{6u,8u,10u,12u,intermediate}-coach.pdf` |
| Region 13 referee guidelines | `site/src/assets/docs/region13-{6u-7u-8u-modifications-2024,10u-referee-guidelines-2023,12u-referee-guidelines-2023,penalty-kick-guidelines-2023}.pdf` |
| Game card / game report | `site/src/assets/docs/{game-card-2023,6u-8u-game-report-2023}.pdf` |
| Concussion + SCA forms | `site/src/assets/docs/concussion-sca-forms.pdf` |
| FIFA 11+ warmup | `site/src/assets/docs/fifa-11plus.pdf` |
| Board minutes (2014–2022) | `site/src/assets/docs/minutes/` |

Old WP URLs (e.g. `/wp-content/uploads/2022/07/8U-Coach.pdf`) redirect to the served paths via `site/src/_redirects`.

## What's NOT here

Wayback's "most recent" snapshot of each URL is often a placeholder padded with junk to ~5 MB or 1 MB (captured after the WP site was already broken). When that happens, no real bytes were preserved. ~12 PDFs flagged corrupt during recovery were deleted; some priority items (5 coach manuals) had to be re-fetched from earlier Wayback timestamps.

About 88 of the 155 unique PDFs in the WP-era inventory haven't been downloaded yet (Wayback rate-limited the bulk fetch). Anything missing from this directory either wasn't preserved by Wayback, returned a placeholder, or hit the rate limit during recovery — try `web.archive.org` directly with the original URL if you need a specific file.
