# Branch protection review — 2026-08-18

Status: **findings only, nothing changed.** Written after the org moved to the GitHub
Team plan, to answer "does this finally let us control flow into main/prod?"

Short answer: for `ayso-website`, no, because the plan was never what was blocking it.
For the 11 private repos, yes, and that is where the new capability is worth spending.

---

## 1. What is actually true today

`ayso-region-13/ayso-website` is a **public** repo, so rulesets were always available to it.
The org is now on `plan.name = "team"` (3 of 3 seats filled).

Ruleset `15738123` ("Protect Main") has been `active` since 2026-04-29 and targets the
literal `refs/heads/main`, which is correct. Its rules are `deletion`, `non_fast_forward`,
and `pull_request` with `required_approving_review_count: 0`. All fine.

The problem is one entry:

```json
"bypass_actors": [{"actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "always"}]
```

`actor_id 5` is the repository **admin** role. `magoldman` and `pshopbell` are org owners,
which makes them admin on every repo, which means they bypass the ruleset unconditionally.

CLAUDE.md currently says org owners bypass rulesets as a matter of course. That is wrong,
and worth correcting when this gets fixed: per the GitHub docs, nobody bypasses a ruleset
unless they are on the bypass list. Admins bypass here because we put them there.

### Evidence it has been used, not just theoretically possible

`main` carries **61 direct pushes** (first-parent, non-merge) against 171 merges. Four
landed *after* the 2026-06-13 retarget that CLAUDE.md records as the fix:

```
7b7e202  2026-06-26  Field status: Open (via Slack — @pshopbell)
16d8241  2026-06-26  Announcement updated (via Slack — @pshopbell)
4339593  2026-06-23  Announcement updated (via Slack — @pshopbell)
c95929e  2026-06-18  Announcement updated (via Slack — @pshopbell)
857d3c2  2026-06-08  Update site/src/_data/importantDates.json (via Pages CMS)
```

Reproduce with:

```bash
git log --first-parent origin/main --no-merges --pretty='%h %ad %an | %s' --date=short
gh api /repos/ayso-region-13/ayso-website/rulesets/15738123
```

---

## 2. Three things break if you just delete the bypass

This is why it is not a one-click change.

**a. Promote stops working.** `.github/workflows/promote-to-production.yml:71` runs
`git push origin main` with `secrets.PROMOTE_TOKEN`, a classic PAT belonging to
`magoldman`. It succeeds today only because of the admin bypass.

**b. The Slack bot stops working.** `slack-bot/src/index.js:26`:

```js
const BRANCHES = ['staging', 'main'];
```

`commitToBothBranches()` PUTs `fieldstatus.json` and `announcements.json` to *both* refs
using a fine-grained PAT, also `magoldman`'s. So `/ayso field` and `/ayso announce`
depend on the bypass too. These are game-day commands. Last use was 2026-06-26, so the
off-season is the window to change them; Fall is not.

**c. Pages CMS behaviour is unknown.** Recent commit authorship is inconsistent —
`pages-cms[bot]` on 2026-08-17, `magoldman` on 2026-08-14 — which suggests the CMS
sometimes commits as an installation and sometimes as a user-to-server token attributed to
the user. GitHub's docs do not settle which identity a ruleset evaluates for bypass.
Design so it does not matter, then test it (see §5).

### Adjacent bug found while tracing (b)

The bot's write to `main` dispatches nothing, and **no workflow deploys
`ayso-website-prod` on push to `main`** — `deploy-workers.yml` is path-filtered to
`workers/weather-api/**` and `workers/csp-report/**`. So a `/ayso field` update does not
reach www.ayso13.org until the next `/ayso promote` or fields "Publish Site" rebuild.
Writing to `main` buys no speed today. Worth confirming against a real closure before the
season starts, because the intent was presumably the opposite.

---

## 3. Recommended sequence

Ordered by risk. Items 3–5 are safe to do on their own; 1–2 change the production deploy
path and the game-day Slack commands, so they want a brainstorm → spec → plan pass first.

1. **Replace the human bypass with one machine bypass.** Create a dedicated GitHub App
   (contents: write, installed on `ayso-website` only), make it the ruleset's sole bypass
   actor, and swap `PROMOTE_TOKEN` for `actions/create-github-app-token`. Promote keeps
   working, no person can push `main`, and a classic PAT with full `repo` scope retires.
2. **Take the Slack bot off `main`** — `BRANCHES = ['staging']`. Since the write to `main`
   gains nothing today, the direct loss is zero, and it removes the second write path.
   Open question: should `/ayso field` then dispatch a promote so a closure reaches prod
   quickly? A promote sweeps all of staging, so that is a real trade-off, not a detail.
3. **Leave required approvals at 0.** Two admins, and requiring one approval means neither
   can self-merge. The predictable outcome of that is somebody re-adding the bypass.
4. **Add `deletion` + `non_fast_forward` to `staging`.** Cheap, no workflow impact; CMS and
   bot keep normal write access.
5. **Add a PR check gate, then require it.** There is no `pull_request` trigger in any of
   the 7 workflows and no `test` script in `site/package.json`, so `required_status_checks`
   is currently impossible and "requires a PR" is ceremony with nothing behind it. CLAUDE.md
   describes a shared check gate this repo does not have. A small one — Eleventy build,
   `workers/redirects` `npm test`, `check-links.js` — is what gives the ruleset teeth.
6. **Prune two over-scoped GitHub Apps:**
   - `cloudflare-workers-and-pages`: `repository_selection: "all"`, with
     `administration: write` and `contents: write`, while CF Git integration is disabled on
     both Pages projects. Scope it to selected repos, or uninstall it.
   - `pages-cms`: holds `administration: write` and `workflows: write`. `administration:
     write` is enough to edit the very ruleset protecting `main`. An installer cannot reduce
     an app's permissions, only its repo scope, so this is accept-and-document rather than
     fix.

---

## 4. What the Team upgrade did unlock

The 11 private repos, which have no protection at all:

```
ayso-platform  default=main  rulesets=0  main protected=false
ayso-email     default=main  rulesets=0  main protected=false
```

`ayso-platform` serves fields.ayso13.org, and this site fetches field maps from it at build
time. Its `main` is production for a dependency of production, and it has nothing on it.
That is the best return on the new plan.

Constraint: per the current docs, **organization-level rulesets are Enterprise, not Team**,
so expect to configure per-repo. Confirm before planning around it:

```bash
gh auth refresh -h github.com -s admin:org
gh api /orgs/ayso-region-13/rulesets
```

---

## 5. How to verify once changed

- **CMS**: have an editor switch the Pages CMS branch picker to `main` and try to save. It
  should be rejected. If it is not, the CMS is committing as an identity that still
  bypasses, and the bypass list needs another look.
- **Promote**: run `/ayso promote` from Slack and confirm `#notify-website-status` posts.
- **Direct push**: from a clean clone, `git push origin main` on a throwaway commit should
  be rejected for both owners.
- **Slack**: run `/ayso field` and confirm the commit lands on `staging` only.

## Sources

- https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets
- https://github.blog/changelog/2026-05-07-repository-rulesets-user-bypass-and-branch-renaming/
- https://docs.github.com/en/apps/using-github-apps/authorizing-github-apps
