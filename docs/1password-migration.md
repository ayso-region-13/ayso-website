# 1Password migration

This repo's plaintext secrets are moving into 1Password. Follow the runbook at `~/dev/scripts/op-migrate/README.md`, using the spec in `docs/op-migration.json`. The spec is a draft until step 2 confirms it.

- 1Password account: `my.1password.com`
- Vault: `Dev`
- Files: `site/.env` to `site/.env.tpl`

## Notes for this repo

- AYSO is personal, so this repo uses the `my.1password.com` account and its `Dev` vault.
- The secret file is `site/.env`. Find out what reads it before choosing `use`.
- If this is a Pages CMS repo, fast-forward from `origin/staging` before committing.

## Done when

- `python3 ~/dev/scripts/op-migrate/op-migrate.py verify docs/op-migration.json` prints MATCH for every template.
- The dev server and the staging deploy work through `op inject` or `op run`.
- You have reported back to the user, and the user has decided about deleting the plaintext files and committing.


## Phase 2 (found by the 2026-10-23 scan)

The first migration covered only the files listed above. A later scan found more secrets in this repo, and they're now in the spec: `.envrc`, `workers/weather-api/.dev.vars`, `.seo-creds/oauth-token.json`, `.seo-creds/client_secret.json`. Run the runbook again; `import` skips the items that already exist.

- `.envrc` (direnv) holds a second Cloudflare token, the CSP admin key (already `Dev/ayso13-healthcheck-csp-admin`, so it's referenced, not copied), and WeatherFlow and EmailOctopus keys. Check what `GLOBAL_SEO` is; the draft treats it as plain. If direnv can call `op` directly, that may beat a generated `.envrc`; ask the user.
- `.envrc`'s `WEATHERFLOW_API` and the weather worker's `TEMPEST_TOKEN` are the same value, so they're one item with two fields.
- `.seo-creds/oauth-token.json` refreshes itself, so `verify` ignores the access-token fields. `client_secret.json` is the OAuth client. The two `*.ayso13-backup` files are old copies: ask the user whether to delete them rather than migrate them.
- The Website changelog says this repo and Website (notafintech) both copy Google credentials into `~/.config/claude-seo/`, and whichever ran last wins. Don't change that flow; just note it in your report.

### Phase 2 result (2026-10-25)

- `.envrc` is now a direnv shim (committed as `.envrc.example`; copy it to `.envrc`, then `direnv allow`). On load it runs `op inject` on `.envrc.tpl` and evals the result, so no plaintext copy of these keys is on disk. Edit `.envrc.tpl` to change variables. In the spec, this file's `plain` is `.envrc.plaintext`, a path that never exists, so `template` and `verify` don't read the shim as plaintext and overwrite the template.
- `workers/weather-api/.dev.vars` was deleted. Run `npm run secrets:dev-vars` in that directory to recreate it before `npm run dev`. It's gitignored, so delete it again once you're done if you don't want it on disk.
- `.seo-creds/` stays on disk because the claude-seo plugin reads it through the `~/.config/claude-seo` symlink. 1Password holds a backup copy (`Dev/ayso-website-google-seo-oauth`, `Dev/ayso-website-google-oauth-client`), and `op-migrate.py fetch` restores the files if they're missing. The two `*.ayso13-backup` copies were deleted.
- This repo and notafintech both write Google credentials into `~/.config/claude-seo/`, and whichever ran last wins. Here that path is a symlink to `.seo-creds/`, so the other project writes through it into this repo's files. That flow was left unchanged.
