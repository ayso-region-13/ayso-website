#!/usr/bin/env bash
#
# Wait for a Cloudflare Pages deployment matching a given SHA to reach a
# terminal state, then exit 0 (success) or 1 (failure).
#
# Used by both the promote-to-production workflow (so the Slack "deploy
# live" message fires when the site is actually serving the new bytes,
# not just when the merge to main pushes) and the IndexNow workflow
# (so we submit URLs after they're guaranteed to resolve).
#
# Required env:
#   CF_API_TOKEN   - Cloudflare API token with Pages:Read access
#   CF_ACCOUNT_ID  - Cloudflare account ID
#
# Optional env (with defaults):
#   PROJECT        - Pages project name (default: ayso-website-prod)
#   SHA            - commit hash to match (default: $GITHUB_SHA)
#   FIND_TIMEOUT   - seconds to wait for CF to register the deployment (default: 180)
#   DEPLOY_TIMEOUT - seconds to wait for the build to finish (default: 600)
#   POLL_INTERVAL  - seconds between polls (default: 10)
#
# Outputs (when GITHUB_OUTPUT is set):
#   deployment_id  - the CF Pages deployment id
#   deployment_url - the *.pages.dev preview URL
#   build_seconds  - elapsed seconds from registration to terminal state
#   final_status   - "success" | "failure"
#   final_stage    - the CF stage where it ended (deploy / build / clone / ...)

set -euo pipefail

: "${CF_API_TOKEN:?CF_API_TOKEN required}"
: "${CF_ACCOUNT_ID:?CF_ACCOUNT_ID required}"
PROJECT="${PROJECT:-ayso-website-prod}"
SHA="${SHA:-${GITHUB_SHA:-}}"
FIND_TIMEOUT="${FIND_TIMEOUT:-180}"
DEPLOY_TIMEOUT="${DEPLOY_TIMEOUT:-600}"
POLL_INTERVAL="${POLL_INTERVAL:-10}"

if [ -z "$SHA" ]; then
  echo "::error::SHA not provided and GITHUB_SHA empty"
  exit 2
fi

API="https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/pages/projects/$PROJECT/deployments"
AUTH_HEADER="Authorization: Bearer $CF_API_TOKEN"

# Best-effort GH Actions output
emit() {
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    echo "$1=$2" >> "$GITHUB_OUTPUT"
  fi
}

cf_get() {
  # Retry transient curl errors up to 3 times
  local url="$1" attempt=0 body
  while [ $attempt -lt 3 ]; do
    if body=$(curl -sS --fail --max-time 30 -H "$AUTH_HEADER" "$url" 2>/dev/null); then
      echo "$body"
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 5
  done
  return 1
}

echo "Looking for CF Pages deployment matching SHA $SHA in project '$PROJECT'..."
START=$SECONDS
DEPLOYMENT_ID=""

while [ -z "$DEPLOYMENT_ID" ]; do
  if [ $((SECONDS - START)) -gt "$FIND_TIMEOUT" ]; then
    echo "::error::Timed out after ${FIND_TIMEOUT}s waiting for CF Pages to register a deployment for $SHA"
    exit 1
  fi

  if response=$(cf_get "$API?per_page=20&env=production"); then
    DEPLOYMENT_ID=$(echo "$response" | jq -r --arg sha "$SHA" '
      .result[]?
      | select(.deployment_trigger.metadata.commit_hash == $sha)
      | .id' | head -1)
  fi

  if [ -z "$DEPLOYMENT_ID" ] || [ "$DEPLOYMENT_ID" = "null" ]; then
    DEPLOYMENT_ID=""
    echo "  not yet registered; sleeping ${POLL_INTERVAL}s ($((SECONDS - START))s elapsed)"
    sleep "$POLL_INTERVAL"
  fi
done

emit deployment_id "$DEPLOYMENT_ID"
echo "Found deployment: $DEPLOYMENT_ID"
DETAIL_URL="$API/$DEPLOYMENT_ID"

DEPLOY_START=$SECONDS
LAST_STAGE=""

while true; do
  if [ $((SECONDS - DEPLOY_START)) -gt "$DEPLOY_TIMEOUT" ]; then
    echo "::error::Timed out after ${DEPLOY_TIMEOUT}s waiting for deployment $DEPLOYMENT_ID to finish"
    emit final_status "timeout"
    exit 1
  fi

  if ! response=$(cf_get "$DETAIL_URL"); then
    echo "  transient API error; retrying"
    sleep "$POLL_INTERVAL"
    continue
  fi

  STAGE_NAME=$(echo "$response" | jq -r '.result.latest_stage.name // "unknown"')
  STAGE_STATUS=$(echo "$response" | jq -r '.result.latest_stage.status // "unknown"')

  if [ "${STAGE_NAME}/${STAGE_STATUS}" != "$LAST_STAGE" ]; then
    echo "  stage=$STAGE_NAME status=$STAGE_STATUS ($((SECONDS - DEPLOY_START))s)"
    LAST_STAGE="${STAGE_NAME}/${STAGE_STATUS}"
  fi

  case "$STAGE_STATUS" in
    success)
      if [ "$STAGE_NAME" = "deploy" ]; then
        DEPLOY_URL=$(echo "$response" | jq -r '.result.url // ""')
        emit deployment_url "$DEPLOY_URL"
        emit build_seconds "$((SECONDS - DEPLOY_START))"
        emit final_status "success"
        emit final_stage "$STAGE_NAME"
        echo "Deployment $DEPLOYMENT_ID succeeded after $((SECONDS - DEPLOY_START))s"
        exit 0
      fi
      # earlier stages succeeded — keep polling
      ;;
    failure | failed | canceled)
      emit final_status "failure"
      emit final_stage "$STAGE_NAME"
      emit build_seconds "$((SECONDS - DEPLOY_START))"
      echo "::error::Deployment $DEPLOYMENT_ID failed at stage '$STAGE_NAME' (status=$STAGE_STATUS)"
      exit 1
      ;;
  esac

  sleep "$POLL_INTERVAL"
done
