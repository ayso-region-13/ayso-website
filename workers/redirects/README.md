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

## Cloudflare account guard

This repo's `package.json` scripts (`dev`, `deploy`) run a `preflight`
step that errors out if **`CLOUDFLARE_ACCOUNT_ID`** is not set. This
exists because some maintainers have multiple Cloudflare accounts on
their machine and an un-pinned `wrangler` could push to the wrong one.

### Recommended setup: direnv

The repo ships a `.envrc.example` at the root. Copy it to `.envrc`,
fill in the AYSO Region 13 account ID, and `direnv allow`:

```bash
cd /path/to/ayso-website
cp .envrc.example .envrc        # the real .envrc is gitignored
$EDITOR .envrc                  # paste the account ID
direnv allow
```

After that, `CLOUDFLARE_ACCOUNT_ID` is exported whenever you're inside
the repo. `cd` out and it unloads.

### Alternative: shell rc

If you don't use direnv, export it per-shell:

```bash
export CLOUDFLARE_ACCOUNT_ID=<ayso13-account-id>
```

Find the AYSO Region 13 account ID in the Cloudflare dashboard
sidebar (or under any zone's Overview → API → Account ID).

The same guard is in `workers/weather-api/package.json`.

## Local dev

```bash
npm install
npm run build       # regenerate src/map.js from _redirects
npm run dev         # preflight + wrangler dev (local Worker on :8787)
```

## Deploy

```bash
npm run deploy
```

`npm run deploy` runs preflight (account-ID check) → `build` (refresh
`src/map.js`) → `test` (smoke tests) → `wrangler deploy`.

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
