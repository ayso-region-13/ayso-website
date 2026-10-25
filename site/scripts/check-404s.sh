#!/usr/bin/env bash
#
# Pull 404 hits from Cloudflare's GraphQL Analytics API for ayso13.org.
# Free plan retention is ~24h, so run this daily if you want a rolling log.
#
# Setup (one-time):
#   The token (ayso13-website-healthcheck, Zone Analytics: Read) and zone ID
#   live in 1Password: my.1password.com → Dev → ayso13-website-healthcheck.
#   When CF_ZONE_ID / CF_API_TOKEN aren't already set, the script re-runs
#   itself under `op run` with site/.check-404s.op.env, the committed
#   template of op:// references. No plaintext copy is kept on disk.
#   Needs the 1Password CLI signed in to my.1password.com (Touch ID prompt).
#
# Usage:
#   ./scripts/check-404s.sh                # last 24h
#   ./scripts/check-404s.sh --hours 6      # last 6h
#   ./scripts/check-404s.sh --limit 50     # top 50 paths (default 25)
#   ./scripts/check-404s.sh --raw          # raw JSON instead of formatted table

set -euo pipefail

SELF="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"
ARGS=("$@")
cd "$(dirname "$0")/.."

HOURS=24
LIMIT=25
RAW=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --hours) HOURS="$2"; shift 2 ;;
    --limit) LIMIT="$2"; shift 2 ;;
    --raw)   RAW=1; shift ;;
    -h|--help)
      sed -n '2,/^$/p' "$SELF" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) echo "unknown arg: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "${CF_ZONE_ID:-}" || -z "${CF_API_TOKEN:-}" ]] && [[ -z "${CHECK_404S_VIA_OP:-}" ]] \
  && command -v op >/dev/null 2>&1; then
  CHECK_404S_VIA_OP=1 exec op run --account my.1password.com \
    --env-file=.check-404s.op.env -- "$SELF" ${ARGS[@]+"${ARGS[@]}"}
fi

if [[ -z "${CF_ZONE_ID:-}" || -z "${CF_API_TOKEN:-}" ]]; then
  echo "error: CF_ZONE_ID and CF_API_TOKEN must be set (in env, or via 1Password: install op and sign in)" >&2
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
      echo "  - Confirm the 1Password item Dev/ayso13-website-healthcheck holds the current token" >&2
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
