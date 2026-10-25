# 1Password references only; no secrets in this file. Use: op inject --account my.1password.com -i .envrc.tpl -o .envrc
# Local direnv config (gitignored). Loaded automatically when you `cd`
# into this repo if you have direnv installed and hooked into your shell.
#
# Setup:
#   1. Replace the placeholder below with the AYSO Region 13 Cloudflare
#      account ID (Cloudflare dashboard sidebar -> Account ID).
#   2. Run `direnv allow` in this directory.
#
# After that, CLOUDFLARE_ACCOUNT_ID is set whenever you're inside the
# repo, so the Worker deploys (workers/redirects/, workers/weather-api/)
# always target the right account.

export CLOUDFLARE_ACCOUNT_ID="op://Dev/ayso13-worker-deploy/account_id"

# CSP report Worker admin key — pulls violation reports out of the
# csp-report Worker's KV. Read-only read-the-reports access; the
# Worker is otherwise locked down. Used by the daily CSP review.
export CSP_ADMIN_KEY="op://Dev/ayso13-healthcheck-csp-admin/credential"

export CLOUDFLARE_API_TOKEN=op://Dev/ayso13-worker-deploy/credential

# Per-project Google credentials for the claude-seo plugin scripts.
# The plugin hardcodes the path ~/.config/claude-seo, so to keep the
# ayso13 creds isolated from other projects (which keep clobbering
# google-api.json + oauth-token.json), we symlink the global location
# at our project's .seo-creds/ on entry. .seo-creds/ holds:
# client_secret.json, google-api.json, oauth-token.json (gitignored).
#
# Known fragility: this DOES NOT prevent another project from writing
# THROUGH the symlink to ayso13's files. Service-account-based isolation
# would be more durable, but the ayso13 GA4 property is Workspace-locked
# and rejects SA emails ("This email doesn't match a Google Account").
# Until that's resolvable, the live mitigation is: a) re-symlink on entry,
# b) re-auth when notafintech clobbers (`google_auth.py --auth ...`),
# c) sanity-check property IDs before running GA4/GSC queries — see
# `feedback_check_seo_creds_first` memory.
if [ -d "$PWD/.seo-creds" ]; then
  GLOBAL_SEO="$HOME/.config/claude-seo"
  if [ ! -L "$GLOBAL_SEO" ] || [ "$(readlink "$GLOBAL_SEO")" != "$PWD/.seo-creds" ]; then
    if [ -d "$GLOBAL_SEO" ] && [ ! -L "$GLOBAL_SEO" ]; then
      mv "$GLOBAL_SEO" "$GLOBAL_SEO.preserved-$(date +%Y%m%d%H%M%S)"
    fi
    /bin/mkdir -p "$HOME/.config"
    /bin/ln -sfn "$PWD/.seo-creds" "$GLOBAL_SEO"
  fi
fi

export WEATHERFLOW_API=op://Dev/ayso-website-weatherflow/credential
export EMAILOCTOPUS_API_KEY=op://Dev/ayso-website-emailoctopus/credential
