# Prompt: claude-seo creds keep clobbering across projects — defense

Paste the body below into the Claude Code session for the **other** project on
this machine (the one whose `claude-seo` queries keep wiping out — or getting
wiped out by — another project's Google credentials). It is self-contained.

---

Multiple repos on this machine use the `claude-seo` plugin. The plugin
hardcodes two paths it both reads from and writes to:

```
~/.config/claude-seo/google-api.json    # property IDs, oauth client path
~/.config/claude-seo/oauth-token.json   # OAuth identity token
```

There is **no env-var override for either path** (`google_auth.py` L25–26).
Every project's plugin scripts read and **write** these same two files.
Re-authing in one project overwrites the other's identity. Writing config
in one project overwrites the other's property IDs. We've been wedging each
other's GA4 + GSC access on a recurring basis.

## What I tried and where it broke

I attempted a **service-account + env-var** isolation (SA driven by
`GOOGLE_APPLICATION_CREDENTIALS`, which IS env-overridable, plus
`GA4_PROPERTY_ID` and `GSC_PROPERTY`). The repo-side mechanics work — the
plugin will fall through to the SA when no `~/.config/claude-seo/oauth-token.json`
exists. But:

- **GA4 hard-rejected the SA email** ("This email doesn't match a Google
  Account") because the GA4 property is tied to a Workspace org and refuses
  identities outside that org. Unchecking "Notify by email" did **not** help
  — the rejection is a hard block, not just a notification check.
- Trying the GA4 Admin API directly (`POST .../accessBindings`) also fails:
  v1beta returns 404 (the endpoint is **v1alpha**), and v1alpha still hits
  the same Workspace-lock rejection.
- gcloud ADC for GA4 returns `ACCESS_TOKEN_SCOPE_INSUFFICIENT` until you
  re-login with explicit scopes:
  `gcloud auth application-default login --scopes=openid,https://www.googleapis.com/auth/analytics.readonly,https://www.googleapis.com/auth/webmasters.readonly`
  …and even then, you still need the identity (your user or an SA) to be on
  the property's access list.

Conclusion: **if your GA4 property is Workspace-locked, the SA path doesn't
work** and OAuth-as-yourself via the plugin is the only practical path. That
puts us back in the shared-mutable-creds situation.

## What you should do for this project

1. **Keep a backup of YOUR project's `google-api.json`** so we can restore
   after the other project clobbers it:
   ```bash
   cp .seo-creds/google-api.json .seo-creds/google-api.json.<your-project>-backup
   ```

2. **Sanity-check creds before every GA4/GSC call** — don't trust them to
   still be yours:
   ```bash
   cat ~/.config/claude-seo/google-api.json
   # Expect: "ga4_property_id": "<YOUR property id>"
   ```
   If the property id isn't yours, the creds were clobbered. Restore:
   ```bash
   cp .seo-creds/google-api.json.<your-project>-backup .seo-creds/google-api.json
   ```
   The OAuth token at `~/.config/claude-seo/oauth-token.json` is also probably
   wrong-identity at this point; re-auth in a browser:
   ```bash
   python3 ~/.claude/plugins/cache/agricidaniel-seo/claude-seo/<version>/scripts/google_auth.py \
     --auth --creds <this-repo>/.seo-creds/client_secret.json
   ```

3. **Never re-auth or write config unnecessarily.** Every auth flow / config
   write through the plugin scripts updates the shared global path and risks
   clobbering whichever project last set it up. Treat re-auth as a deliberate
   action — not a default debugging step.

4. **Only try the service-account isolation if your GA4 property is NOT
   Workspace-locked.** Test by manually adding any service-account email at
   GA4 Admin → Property Access Management. If GA4 accepts the SA email, the
   full SA isolation works (env vars + symlink removal in `.envrc`). If GA4
   rejects ("This email doesn't match a Google Account"), give up on SA and
   adopt the defensive pattern above.

## tl;dr — the actual realistic posture

Until the plugin upstream adds env-var overrides for `CONFIG_PATH` and
`TOKEN_PATH`, **the shared global state is unavoidable** for OAuth flows.
Defense is per-project backups + a sanity check before every query.
