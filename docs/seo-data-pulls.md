# SEO data pulls — GSC + GA4

How to query Google Search Console and GA4 for ayso13.org. Referenced from `CLAUDE.md` (`## Key Scripts`).

- **GA4 property:** `307558725`
- **GSC property:** `sc-domain:ayso13.org`
- **GA4 measurement ID:** `G-9YM9ZDW1J9`

## ⚠️ Check creds before every query

Other projects on this machine share the `~/.config/claude-seo` OAuth config and **clobber it** (notafintech.co did on 2026-05-19 and 2026-05-27). Before any GA4/GSC query:

```bash
cat ~/.config/claude-seo/google-api.json   # verify ga4_property_id == 307558725
```

If it's wrong, queries silently return another site's data. See memory `feedback_check_seo_creds_first`.

### Creds layout

OAuth is wired via the `claude-seo` plugin. Token + property ID live in **`.seo-creds/`** at the repo root (gitignored), symlinked to `~/.config/claude-seo` by `.envrc` on direnv entry. The symlink keeps the path canonical but does **not** prevent cross-project clobbering.

A durable service-account fix was attempted 2026-05-27 but the GA4 property is Workspace-locked and rejects SA emails ("This email doesn't match a Google Account" — hard block, not bypassable via "Notify by email" or the v1alpha Admin API). Settled defense:

1. `.seo-creds/google-api.json.ayso13-backup` — canonical backup for restore.
2. Verify `ga4_property_id == 307558725` before querying (above).
3. Don't re-auth unless necessary — each auth flow writes the shared token and risks clobbering elsewhere.

`.seo-creds/` contents (all gitignored):
- `client_secret.json` — OAuth client JSON from Google Cloud Console (project `ayso13-seo`)
- `google-api.json` — `{ "ga4_property_id": "307558725", "oauth_client_path": ".../client_secret.json" }`
- `google-api.json.ayso13-backup` — canonical backup for restore after clobbering
- `oauth-token.json` — OAuth refresh token, written on first auth flow

To restore after clobbering: copy the backup over `google-api.json`, then re-auth:
```bash
python3 $SEO/google_auth.py --auth --creds .seo-creds/client_secret.json
```

## Commands

```bash
SEO=~/.claude/plugins/cache/agricidaniel-seo/claude-seo/1.9.6/scripts

# GSC
python3 $SEO/gsc_query.py sites                                              # list verified properties
python3 $SEO/gsc_query.py sitemaps -p sc-domain:ayso13.org                    # sitemap status + errors
python3 $SEO/gsc_query.py query -p sc-domain:ayso13.org --days 28 \
    --dimensions page --limit 50                                             # top pages last 28d
python3 $SEO/gsc_query.py query -p sc-domain:ayso13.org --days 28 \
    --dimensions query --limit 50                                            # top queries last 28d
python3 $SEO/gsc_query.py query -p sc-domain:ayso13.org --days 28 \
    --dimensions query,page --limit 500 --json                               # full query→page pairs

# GA4 (property 307558725, default in google-api.json)
python3 $SEO/ga4_report.py -r top-pages --days 28 --limit 100                # top organic landing pages
python3 $SEO/ga4_report.py -r organic   --days 28                            # organic traffic overview
python3 $SEO/ga4_report.py -r device    --days 28                            # by device
python3 $SEO/ga4_report.py -r country   --days 28                            # by country

# Auth check / reauth
python3 $SEO/google_auth.py --check                                          # verify all credentials work
python3 $SEO/google_auth.py --auth --creds <path-to-client_secret.json>      # full re-auth (browser flow)
```

## Notes

- GSC search analytics covers Google web-search clicks/impressions only — for 404 hits use `check-404s.sh` (Cloudflare edge logs, 24h retention, free plan).
- GA4 records page_views via gtag, including hits to the 404 page itself (it loads gtag) — landing pages with very high bounce that don't exist as routes are likely 404s.
- The 404 page is `_site/404.html`; the gtag tag is included via `base.njk`.
- GA4 reports CTR as a percentage value (e.g. `3.66`), not a fraction — don't multiply by 100 when formatting.
