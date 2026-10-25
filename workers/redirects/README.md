# ayso13-redirects Worker

Cloudflare Worker that handles all legacy URL redirects in front of the
AYSO Region 13 Cloudflare Pages site.

## Why this exists

Cloudflare Pages' `_redirects` file is silently capped at ~224 active
rules per project, despite the published 2,100 limit. We have 570+
rules. The Worker has no cap and serves as the durable solution.

## Source of truth

Editors keep editing `site/src/_redirects` exactly as before (or via
Pages CMS once we expose it). The Worker build parses that file and
emits `src/map.js` for the deployed bundle.

```
site/src/_redirects        <- human-editable source
   |
   v  (scripts/generate-map.js)
src/map.js                 <- generated, do not edit
   |
   v  (wrangler deploy)
Cloudflare Worker on routes www.ayso13.org/* and staging.ayso13.org/*
```

## Routes

- `www.ayso13.org/*`        — production
- `staging.ayso13.org/*`    — staging

The more-specific `www.ayso13.org/api/weather` route (handled by the
`ayso13-weather-api` Worker) takes precedence, so this Worker only
sees everything else. Real pages and static assets pass through via
`fetch(request)`.

## Cloudflare account and token

`wrangler.toml` pins `account_id` (a public ID), so wrangler always
targets the AYSO Region 13 account, even on a machine with several.
The same pin is in the weather-api and csp-report Workers.

The deploy token lives in 1Password (`my.1password.com`, item
`Dev/ayso13-worker-deploy`). The `:op` scripts load it for that one
command through `op run` and the repo-root `.ayso.op.env`:

```bash
npm run deploy:prod:op      # or deploy:staging:op, tail:op
```

The plain `deploy:prod` / `deploy:staging` scripts are what CI runs,
with the token from GitHub secrets.

## Local dev

```bash
npm install
npm run build       # regenerate src/map.js from _redirects
npm run dev         # wrangler dev (local Worker on :8787)
```

## Deploy

```bash
npm run deploy:prod:op
```

`deploy:prod` runs `build` (refresh `src/map.js`) → `test` (smoke
tests) → `wrangler deploy --env production`.

The first deploy will need the routes bound. If the `[[routes]]`
blocks in `wrangler.toml` don't auto-create the routes, bind them in
the Cloudflare dashboard:
- Workers & Pages → ayso13-redirects → Triggers → Routes
- Add `www.ayso13.org/*` (zone: ayso13.org)
- Add `staging.ayso13.org/*` (zone: ayso13.org)

## After deploy: empty out _redirects

Once the Worker is live and verified, `site/src/_redirects` can be
emptied (keep the file present with a header comment pointing at the
Worker so it stays documented). The Worker handles everything.

If you want a transition state, keep just the Tier 1 rules in
`_redirects` (CF Pages will apply them first; the Worker handles the
rest of the file's 570 rules including all currently-broken ones).

## Adding or removing redirects

1. Edit `site/src/_redirects` (or via Pages CMS — same file).
2. `npm run deploy` from this directory.

If you only edit `_redirects` and don't redeploy the Worker, the
change won't take effect — the Worker bundle is what serves.

Long-term: a GitHub Action could run `npm run deploy` on every push
that touches `_redirects`. Not set up yet.

## What's in the map

Run `npm run build` and check the banner of `src/map.js` for current
counts. As of the initial Worker:
- ~560 exact-match rules
- ~10 splat patterns (`/old/*` → `/new/`)
