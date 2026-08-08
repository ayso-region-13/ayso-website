# Deploy watchdog — surfacing runs that report nothing

_2026-08-06_

## Problem

A workflow run whose job never executes a single step reports **nothing to anyone**.
Every notifier in this repo lives *inside* the deploy job (`if: success()` /
`if: failure()`), so if the job never starts, no Slack message is possible — not
even from an `always()` step.

Two real members of this failure class:

1. **Runner not acquired.** Run `31124662160` (2026-08-06 17:58, a CMS push to
   `staging`): GitHub annotation "The job was not acquired by Runner of type
   hosted even after multiple attempts". The CMS edit sat undeployed and silent.
2. **Superseded promote.** Documented in `CLAUDE.md` as an accepted cost of
   sharing the `deploy-pages-prod` concurrency group with `rebuild-production.yml`:
   GitHub keeps only one pending run per group, so a queued `/ayso promote` can be
   cancelled by a later "Publish Site" click. The current mitigation is a note
   telling the operator "if `/ayso promote` posts nothing within ~60s, run it again."

Both are the same shape, and both are invisible.

## Approach

A separate `workflow_run: completed` workflow. It runs on its own fresh runner
*after* the watched run finishes, so it survives the watched job never starting.

### Discriminator

Run-level conclusion plus executed-step count. Both are needed — verified against
real runs, because the runner-allocation failure reports **job**-level `cancelled`
while its **run**-level conclusion is `failure`:

| run conclusion | steps | meaning | action |
|---|---|---|---|
| `failure` | 0 | job never started | alert (+ retry, staging only) |
| `failure` | >0 | build/upload failed; in-job notifier fired | silent |
| `cancelled` | 0 | **staging:** 45s debounce supersede, by design | silent |
| `cancelled` | 0 | **promote:** superseded in `deploy-pages-prod` | alert |
| anything | * | `success`, `skipped` (mistyped promote confirm) | silent |

Step count comes from `/actions/runs/{id}/jobs` → `[.jobs[].steps[]] | length`.
Zero executed steps is the precise definition of "no in-job notifier could have
fired", which is exactly the gap being closed.

The `cancelled` row means opposite things per workflow, so the rule is
per-workflow. Staging debounce-cancels happen on every CMS burst; alerting on
them would train editors to ignore the channel.

### Retry

Staging only, at most once. Production is never auto-promoted — a promote is an
outward-facing deploy that stays a human decision; the watchdog only tells the
operator their promote was dropped so they can re-run it.

Loop guard needs no persisted state: only retry when the failed run's event was
`push` or `repository_dispatch`, never `workflow_dispatch`. A re-dispatch is
itself a `workflow_dispatch`, so a retry that also fails to acquire a runner
cannot spawn another.

The retry rebuilds from the tip of `staging` rather than the original commit,
which matches the existing debounce philosophy: latest content wins.

### GITHUB_TOKEN can dispatch

Events created with `GITHUB_TOKEN` normally do not start new workflow runs, which
would make the retry a no-op. `workflow_dispatch` and `repository_dispatch` are
the two documented exceptions, so no PAT is required. Needs `actions: write`.

## Structure

Classification logic lives in `.github/scripts/classify-silent-run.sh` (pure — no
network, reads three env vars, prints a verdict) rather than inline YAML, so it is
testable locally. `.github/scripts/test-classify-silent-run.sh` runs a case table
that includes the real values from runs `31124662160`, `31124271824`,
`31124270318`, and `31130648494`.

## Residual risk

Whether `workflow_run: completed` fires at all for a run that never acquired a
runner can only be proven by the next real occurrence — it cannot be simulated.
Every other path (debounce cancel, build failure, success) is exercisable now and
is covered by the test table. If the runner case turns out not to fire, the
fallback is a scheduled drift check comparing the deployed commit against the tip
of `staging`.

`workflow_run` workflows only trigger from the repository's **default branch**.
That is `staging` here, which is where this file lands.
