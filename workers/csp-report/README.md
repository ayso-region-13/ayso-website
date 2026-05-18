# ayso13-csp-report Worker

Collects Content-Security-Policy violation reports from the AYSO Region 13
website. Reports POSTed to `/api/csp-report` are stored in KV with a 30-day
TTL. Recent reports are viewable via an admin GET endpoint.

## Why this exists

The production CSP includes a `report-uri /api/csp-report` directive.
Without this Worker, browser-generated violation reports would go to a
404 and be discarded. With this Worker, we get centralized visibility:

- Catches breakage we missed in the initial static audit before
  switching the CSP from Report-Only to enforcing.
- Provides a feedback loop for future policy tightening (e.g.,
  removing `'unsafe-inline'` once we've migrated to nonces).
- Surfaces real-world incidents (extension injection, plugin behavior,
  CDN drift) that wouldn't show up locally.

## Endpoints

### `POST /api/csp-report`

Browser CSP `report-uri` target. Stores the violation as a JSON entry
in KV (`CSP_REPORTS` namespace), keyed by ISO timestamp + 8-char id,
with a 30-day TTL. Returns `204 No Content`.

Bodies over 32KB are silently dropped (anti-abuse).

### `GET /api/csp-report?admin_key=<secret>&limit=100`

Admin view of recent reports. Returns JSON:

```json
{
  "count": 12,
  "list_complete": true,
  "reports": [
    {
      "reportedAt": "2026-05-18T20:33:21.000Z",
      "userAgent": "...",
      "referer": "https://www.ayso13.org/about/",
      "contentType": "application/csp-report",
      "cfRay": "...",
      "country": "US",
      "report": { ... browser CSP report object ... }
    },
    ...
  ]
}
```

Newest first. `limit` defaults to 100, max 1000. Requires the
`ADMIN_KEY` secret value as `admin_key=` query param.

## Cloudflare setup (one-time)

```bash
# 1. Create the KV namespace
wrangler kv namespace create CSP_REPORTS

# 2. Paste the returned id into wrangler.toml under [[kv_namespaces]]

# 3. Generate + set the admin key
ADMIN_KEY=$(openssl rand -hex 24)
echo "$ADMIN_KEY" | wrangler secret put ADMIN_KEY
# Save the printed key somewhere secure (1Password) — you'll need it
# to read reports.
```

## Local dev

```bash
npm install
npm run dev    # preflight + wrangler dev (http://localhost:8787)
```

## Deploy

```bash
npm run deploy
```

Same preflight as the other Workers — requires `CLOUDFLARE_ACCOUNT_ID`
exported (via direnv `.envrc` or shell rc).

## Reviewing reports

```bash
# From your local machine, with the admin key from setup:
curl "https://www.ayso13.org/api/csp-report?admin_key=$ADMIN_KEY&limit=50" | jq .

# Or watch reports live as they come in:
npm run tail
# (wrangler tail prints each POST to the console via console.log)
```

## Operational notes

- KV writes are eventually consistent; expect a few seconds of delay
  before a fresh report appears in the list.
- Each report is ~1–3KB. 30-day retention with low typical volume
  keeps KV usage well within free tier.
- If we ever want to keep history beyond 30 days, swap to D1 or R2.
- This Worker has no dependency on the redirect Worker or the
  weather-api Worker — failure modes are isolated.

## Related

- `site/src/_headers.njk` — the CSP that targets this endpoint
- `workers/weather-api/` — sibling Worker (separate concern)
- `workers/redirects/` — sibling Worker (separate concern)
