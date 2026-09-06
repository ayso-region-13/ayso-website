#!/usr/bin/env bash
# Case table for classify-silent-run.sh. Rows marked [real] carry the actual
# values observed on the named run via the GitHub API on 2026-08-06.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUT="$HERE/classify-silent-run.sh"
STAGING_WF="Deploy Staging (Pages Direct Upload)"
PROMOTE_WF="Promote Staging to Production"
REBUILD_WF="Rebuild Production (no promote)"

pass=0
fail=0

check() {
  local desc="$1" wf="$2" concl="$3" steps="$4" want="$5" got
  got=$(WF_NAME="$wf" CONCLUSION="$concl" STEP_COUNT="$steps" bash "$SUT")
  if [ "$got" = "$want" ]; then
    pass=$((pass + 1))
    printf 'ok    %-58s -> %s\n' "$desc" "$got"
  else
    fail=$((fail + 1))
    printf 'FAIL  %-58s -> %s (want %s)\n' "$desc" "$got" "$want"
  fi
}

# --- the two failures this watchdog exists to surface ---------------------
check "[real 31124662160] staging, runner not acquired" \
  "$STAGING_WF" failure 0 silent-runner
check "promote superseded in deploy-pages-prod group" \
  "$PROMOTE_WF" cancelled 0 silent-superseded
check "promote, runner not acquired" \
  "$PROMOTE_WF" failure 0 silent-runner
check "prod rebuild superseded in deploy-pages-prod group" \
  "$REBUILD_WF" cancelled 0 silent-superseded-rebuild
check "prod rebuild, runner not acquired" \
  "$REBUILD_WF" failure 0 silent-runner

# --- silence that is correct: the run already told someone ----------------
check "[real 31130648494] staging build failed (11 steps ran)" \
  "$STAGING_WF" failure 11 none
check "[real 30876896511] promote succeeded (14 steps ran)" \
  "$PROMOTE_WF" success 14 none
check "staging deploy succeeded" \
  "$STAGING_WF" success 8 none

# --- silence that is by design -------------------------------------------
check "[real 31124271824] staging debounce supersede (8m in)" \
  "$STAGING_WF" cancelled 0 none
check "[real 31124270318] staging debounce supersede (3s in)" \
  "$STAGING_WF" cancelled 0 none
check "promote skipped, confirmation mistyped" \
  "$PROMOTE_WF" skipped 0 none
# The rebuild's job `if:` skips a promote's merge commit, so a promote that
# happens to touch fieldstatus/announcements now leaves a skipped rebuild run
# behind. Expected and silent — the promote reported its own outcome.
check "prod rebuild skipped, promote merge commit" \
  "$REBUILD_WF" skipped 0 none
check "[real 34049461658] prod rebuild succeeded (14 steps ran)" \
  "$REBUILD_WF" success 14 none
check "prod rebuild build failed (10 steps ran)" \
  "$REBUILD_WF" failure 10 none
check "cancelled build that had already started steps" \
  "$STAGING_WF" cancelled 6 none

# --- workflows outside this watchdog's remit -----------------------------
check "unrelated workflow, failure with no steps" \
  "Deploy Workers" failure 0 none
check "empty conclusion" \
  "$STAGING_WF" "" 0 none

echo
echo "$pass passed, $fail failed"
[ "$fail" -eq 0 ]
