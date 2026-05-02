#!/usr/bin/env bash
#
# Pull 404 hits from Cloudflare's GraphQL Analytics API for ayso13.org.
# Free plan retention is ~24h, so run this daily if you want a rolling log.
#
# Setup (one-time):
#   1. Get a zone-scoped API token:
#        dash.cloudflare.com → My Profile → API Tokens → Create Token
#        → "Read analytics and logs" template → Zone: ayso13.org → Create
#   2. Get the zone ID:
#        dash.cloudflare.com → ayso13.org → Overview page, right sidebar
#   3. Save credentials to site/.env (already gitignored):
#        CF_ZONE_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
#        CF_API_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
#
# Usage:
#   ./scripts/check-404s.sh                # last 24h
#   ./scripts/check-404s.sh --hours 6      # last 6h
#   ./scripts/check-404s.sh --limit 50     # top 50 paths (default 25)
#   ./scripts/check-404s.sh --raw          # raw JSON instead of formatted table

set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

HOURS=24
LIMIT=25
RAW=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --hours) HOURS="$2"; shift 2 ;;
    --limit) LIMIT="$2"; shift 2 ;;
    --raw)   RAW=1; shift ;;
    -h|--help)
      sed -n '2,/^$/p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) echo "unknown arg: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "${CF_ZONE_ID:-}" || -z "${CF_API_TOKEN:-}" ]]; then
  echo "error: CF_ZONE_ID and CF_API_TOKEN must be set (in env or site/.env)" >&2
  echo "see header of $0 for setup instructions, or run with --help" >&2
  exit 1
fi

if command -v gdate >/dev/null 2>&1; then
  DATE=gdate
elif date -u -v-1H +%Y-%m-%dT%H:%M:%SZ >/dev/null 2>&1; then
  DATE=date_bsd
else
  DATE=date_gnu
fi

case "$DATE" in
  gdate)    SINCE=$(gdate -u -d "$HOURS hours ago" +%Y-%m-%dT%H:%M:%SZ) ;;
  date_bsd) SINCE=$(date -u -v-"${HOURS}"H +%Y-%m-%dT%H:%M:%SZ) ;;
  date_gnu) SINCE=$(date -u -d "$HOURS hours ago" +%Y-%m-%dT%H:%M:%SZ) ;;
esac
UNTIL=$(date -u +%Y-%m-%dT%H:%M:%SZ)

read -r -d '' QUERY <<EOF || true
{
  "query": "query(\$zone: String!, \$since: Time!, \$until: Time!, \$limit: Int!) { viewer { zones(filter: {zoneTag: \$zone}) { httpRequestsAdaptiveGroups(limit: \$limit, filter: {datetime_geq: \$since, datetime_leq: \$until, edgeResponseStatus: 404}, orderBy: [count_DESC]) { count dimensions { clientRequestPath clientRequestHTTPHost } } } } }",
  "variables": {
    "zone": "$CF_ZONE_ID",
    "since": "$SINCE",
    "until": "$UNTIL",
    "limit": $LIMIT
  }
}
EOF

RESPONSE=$(curl -sS https://api.cloudflare.com/client/v4/graphql \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data "$QUERY")

if echo "$RESPONSE" | jq -e '.errors' >/dev/null 2>&1; then
  err=$(echo "$RESPONSE" | jq -r '.errors[0].message // "Unknown error"')
  echo "error: Cloudflare API call failed: $err" >&2
  case "$err" in
    *Authentication*|*authentication*|*Invalid*|*invalid*|*[Tt]oken*|*[Uu]nauthorized*)
      echo "" >&2
      echo "Check your CF_API_TOKEN — common fixes:" >&2
      echo "  - Confirm token is in site/.env (no quotes around the value)" >&2
      echo "  - Verify token still exists at https://dash.cloudflare.com/profile/api-tokens" >&2
      echo "  - Confirm token has 'Read analytics and logs' template scoped to ayso13.org zone" >&2
      ;;
  esac
  echo "" >&2
  echo "Full response:" >&2
  echo "$RESPONSE" | jq '.errors' >&2
  exit 1
fi

if [[ $RAW -eq 1 ]]; then
  echo "$RESPONSE" | jq .
  exit 0
fi

echo "404 hits on ayso13.org — last ${HOURS}h (since $SINCE)"
echo "----------------------------------------------------------------"
echo "$RESPONSE" | jq -r '
  .data.viewer.zones[0].httpRequestsAdaptiveGroups
  | if length == 0 then "(no 404s in window — clean)"
    else
      ["HITS\tHOST\tPATH"],
      (.[] | [.count, .dimensions.clientRequestHTTPHost, .dimensions.clientRequestPath] | @tsv)
    end' | column -t -s $'\t'
