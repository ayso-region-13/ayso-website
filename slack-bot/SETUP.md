# AYSO Slack Bot — Setup & Deployment

Lets any authorized Slack user update field status or the announcement bar directly from Slack. Changes commit to both `staging` and `main` simultaneously and post to #general.

## Commands

| Command | Opens |
|---|---|
| `/ayso` | Choose between Field Status or Announcement |
| `/ayso field` | Field Status modal directly |
| `/ayso announce` | Announcement modal directly |

---

## Setup Steps

### Step 1 — Create the Slack App

1. Go to https://api.slack.com/apps → **Create New App** → **From scratch**
2. Name: `AYSO Bot`, select your workspace → **Create App**

**Slash command:**

3. Left sidebar → **Slash Commands** → **Create New Command**
   - Command: `/ayso`
   - Request URL: `https://placeholder.workers.dev/slack/command` *(update after Step 3)*
   - Description: `Update field status or announcement`
   - Save

**Interactivity:**

4. Left sidebar → **Interactivity & Shortcuts** → toggle **On**
   - Request URL: `https://placeholder.workers.dev/slack/interactions` *(update after Step 3)*
   - Save Changes

**Permissions:**

5. Left sidebar → **OAuth & Permissions** → scroll to **Bot Token Scopes** → **Add an OAuth Scope**
   - Add `chat:write`
   - Add `commands`

**Install:**

6. Scroll up → **Install to Workspace** → **Allow**
7. Copy the **Bot OAuth Token** (starts with `xoxb-`) — you'll need it in Step 4
8. Left sidebar → **Basic Information** → **App Credentials** → copy **Signing Secret** — you'll need it in Step 4

---

### Step 2 — Create GitHub Personal Access Token

1. GitHub → avatar (top right) → **Settings**
2. Left sidebar → **Developer settings** (bottom) → **Personal access tokens** → **Fine-grained tokens**
3. **Generate new token**
   - Name: `AYSO Slack Bot`
   - Expiration: 1 year
   - Repository access: **Only select repositories** → select `ayso-website`
   - Permissions → **Repository permissions** → **Contents** → **Read and write**
4. **Generate token** → copy immediately (shown once)

---

### Step 3 — Deploy the Cloudflare Worker

```bash
cd slack-bot
npx wrangler deploy
```

The command prints the deployed URL, e.g.:
```
https://ayso-slack-bot.<account>.workers.dev
```

Go back to your Slack app settings and update both Request URLs (Slash Command and Interactivity) with the actual deployed URL.

---

### Step 4 — Set Worker Secrets

Run each command and paste the value when prompted:

```bash
cd slack-bot
npx wrangler secret put SLACK_SIGNING_SECRET   # from Step 1 → Basic Information → Signing Secret
npx wrangler secret put SLACK_BOT_TOKEN        # from Step 1 → OAuth & Permissions → Bot Token (xoxb-...)
npx wrangler secret put GITHUB_TOKEN           # from Step 2
npx wrangler secret put SLACK_CHANNEL_ID       # see below
```

**Finding the #general channel ID:**
In Slack, right-click **#general** → **View channel details** → scroll to the bottom → copy the Channel ID (starts with `C`).

---

### Step 5 — Test

1. Type `/ayso` in any Slack channel — a modal should open
2. Submit a Field Status change → verify:
   - GitHub: `site/src/_data/fieldstatus.json` updated on both `staging` and `main`
   - Cloudflare Pages builds both branches
   - #general receives a formatted bot message
3. Repeat for announcement

---

## Redeploying After Code Changes

```bash
cd slack-bot
npx wrangler deploy
```

Secrets persist across deploys — no need to re-set them.

---

## Architecture

```
/ayso in Slack
      ↓
Cloudflare Worker (ayso-slack-bot)
  ├── Verifies Slack request signature
  ├── Opens modal (Field Status or Announcement)
  └── On submit:
        ├── Commits JSON data file to staging branch (GitHub API)
        ├── Commits same file to main branch (GitHub API)
        └── Posts formatted message to #general (Slack API)
```

**Data files written:**
- Field status → `site/src/_data/fieldstatus.json`
- Announcement → `site/src/_data/announcements.json`
