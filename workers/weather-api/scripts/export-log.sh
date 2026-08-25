#!/usr/bin/env bash
#
# Export the weather observation log as CSV to stdout.
#
#   ./scripts/export-log.sh              # last 24 hours
#   ./scripts/export-log.sh 168          # last 7 days
#   ./scripts/export-log.sh 24 > day.csv
#   ./scripts/export-log.sh 24 | open -f -a Numbers
#
# Needs CLOUDFLARE_API_TOKEN with D1 read (the canonical ayso13-worker-deploy
# token has it as of 2026-08-25). Source ../../.envrc first, or run from a
# direnv-enabled shell.
#
# --remote is mandatory and NOT the default: without it wrangler reads the
# LOCAL database, where an empty table looks exactly like a production problem.
set -euo pipefail

HOURS="${1:-24}"
case "$HOURS" in ''|*[!0-9]*) echo "usage: $0 [hours]   (positive integer, default 24)" >&2; exit 2;; esac

cd "$(dirname "$0")/.."

npx --yes wrangler d1 execute ayso13-weather-log --remote --json --command "
  SELECT observed_at,
         datetime(observed_at, 'unixepoch', '-7 hours') AS pacific_time,
         wbgt_f, cif_level, temp_f, feels_like_f, humidity,
         wind_mph, solar_wm2, aqi, rain_48h_in, closure
  FROM observations
  WHERE observed_at >= unixepoch('now', '-${HOURS} hours')
  ORDER BY observed_at;" 2>/dev/null | python3 -c '
import csv, json, sys

payload = json.load(sys.stdin)
rows = payload[0]["results"]
if not rows:
    sys.exit("no rows in that window — the log started 2026-08-25 14:50 PT")

writer = csv.DictWriter(sys.stdout, fieldnames=list(rows[0].keys()))
writer.writeheader()
writer.writerows(rows)
print(f"{len(rows)} rows", file=sys.stderr)
'
