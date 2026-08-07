#!/usr/bin/env bash
# Decides whether a finished workflow run went SILENT -- i.e. concluded without
# any in-job notifier being able to fire -- and if so, why.
#
# WHY THIS EXISTS: every Slack notifier in this repo lives inside the deploy job
# (`if: success()` / `if: failure()`). A run whose job never executes a single
# step therefore reports nothing to anyone, not even from an `always()` step.
# Zero executed steps is the precise test for that condition.
#
# Pure by design: reads three env vars, writes a verdict to stdout, touches no
# network. That keeps it testable -- see test-classify-silent-run.sh.
#
# Inputs (env):
#   WF_NAME     workflow_run.name
#   CONCLUSION  workflow_run.conclusion (RUN level, not job level -- see below)
#   STEP_COUNT  total executed steps across all jobs in the run
#
# Verdicts (stdout):
#   silent-runner      job never started; nobody was told
#   silent-superseded  promote dropped from the shared prod concurrency group
#   none               the run reported its own outcome, or silence is by design
set -euo pipefail

STAGING_WF="Deploy Staging (Pages Direct Upload)"
PROMOTE_WF="Promote Staging to Production"

# A run with executed steps reached its own notifier, whatever the outcome was.
if [ "${STEP_COUNT:-0}" -gt 0 ]; then
  echo "none"
  exit 0
fi

# RUN-level conclusion is load-bearing and differs from the job's. A runner
# allocation failure reports job conclusion `cancelled` but run conclusion
# `failure`; a debounce supersede reports `cancelled` at both levels. Verified
# against runs 31124662160 (runner) and 31124271824 / 31124270318 (debounce).
case "${WF_NAME:-}|${CONCLUSION:-}" in
  "$STAGING_WF|failure")
    # "The job was not acquired by Runner of type hosted..."
    echo "silent-runner" ;;
  "$STAGING_WF|cancelled")
    # The 45s debounce doing its job: a newer CMS push superseded this run.
    # Alerting here would fire on every burst of edits and train editors to
    # ignore the channel.
    echo "none" ;;
  "$PROMOTE_WF|failure")
    echo "silent-runner" ;;
  "$PROMOTE_WF|cancelled")
    # Promote has no debounce, so a cancel before any step means this promote
    # was evicted from the `deploy-pages-prod` group by a later publish click.
    echo "silent-superseded" ;;
  *)
    # success, skipped (mistyped promote confirm -> job `if:` false), or a
    # workflow this watchdog does not cover.
    echo "none" ;;
esac
