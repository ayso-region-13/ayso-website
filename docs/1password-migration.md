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
