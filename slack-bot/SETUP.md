# AYSO Slack Bot — Setup Instructions

The bot lets anyone with Slack access update field status or the announcement bar directly from Slack. Changes commit immediately to both `staging` and `main` branches and auto-post to #general.

## Usage

Once deployed, type in any Slack channel:

| Command | Opens |
|---|---|
| `/ayso` | Choose between Field Status or Announcement |
| `/ayso field` | Field Status modal directly |
| `/ayso announce` | Announcement modal directly |

---

## One-Time Setup

### Step 1 — Create Slack App

1. Go to https://api.slack.com/apps → **Create New App** → From scratch
2. Name: `AYSO Bot`, select your workspace
3. **Slash Commands** → Create New Command:
   - Command: `/ayso`
   - Request URL: `https://ayso-slack-bot.<account>.workers.dev/slack/command`
   - Description: `Update field status or announcement`
4. **Interactivity & Shortcuts** → toggle on:
   - Request URL: `https://ayso-slack-bot.<account>.workers.dev/slack/interactions`
5. **OAuth & Permissions** → Bot Token Scopes → Add: `chat:write`, `commands`
6. **Install App** → Install to Workspace → authorize
7. Copy the **Bot Token** (`xoxb-...`) from OAuth & Permissions
8. Copy the **Signing Secret** from Basic Information

> Update the Request URLs in steps 3 and 4 after deploying the Worker (Step 3 below).

---

### Step 2 — Create GitHub Personal Access Token

1. GitHub → Settings → Developer Settings → **Personal Access Tokens** → Fine-grained tokens → Generate new token
2. Repository access: `magoldman/ayso-website` only
3. Permissions → Repository permissions → **Contents: Read and write**
4. Copy the token

---

### Step 3 — Deploy the Cloudflare Worker

```bash
cd slack-bot
npx wrangler deploy
```

Log in with your Cloudflare account if prompted. The command prints the deployed URL, e.g.:
```
https://ayso-slack-bot.<account>.workers.dev
```

Go back to your Slack app settings and update both Request URLs (Slash Command and Interactivity) with the actual deployed URL.

---

### Step 4 — Set Worker Secrets

```bash
cd slack-bot
npx wrangler secret put SLACK_SIGNING_SECRET   # from Slack app → Basic Information
npx wrangler secret put SLACK_BOT_TOKEN        # xoxb-... from Slack app → OAuth & Permissions
npx wrangler secret put GITHUB_TOKEN           # fine-grained PAT from Step 2
npx wrangler secret put SLACK_CHANNEL_ID       # see below
```

**Finding the #general channel ID:**
In Slack, right-click **#general** → View channel details → scroll to the bottom → copy the Channel ID (starts with `C`).

---

### Step 5 — Test

1. Type `/ayso` in any Slack channel
2. A modal should open with Field Status / Announcement options
3. Submit a change and verify:
   - GitHub: `site/src/_data/fieldstatus.json` updated on both `staging` and `main` branches
   - Cloudflare Pages builds both branches (check deployments dashboard)
   - #general receives a formatted bot message

---

## Redeploying After Code Changes

```bash
cd slack-bot
npx wrangler deploy
```

Secrets are stored separately and persist across deploys.

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

Both commits trigger Cloudflare Pages builds on the respective branches.
