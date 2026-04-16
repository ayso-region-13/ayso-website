/**
 * AYSO Slack Bot — Cloudflare Worker
 *
 * /ayso               → choose Field Status or Announcement
 * /ayso field         → Field Status modal directly
 * /ayso announce      → Announcement modal directly
 *
 * Commits changes to both `staging` and `main` branches via GitHub API,
 * then posts a formatted update to the configured Slack channel.
 *
 * Required secrets (set via `wrangler secret put`):
 *   SLACK_SIGNING_SECRET   — from Slack app → Basic Information
 *   SLACK_BOT_TOKEN        — xoxb-... from Slack app → OAuth & Permissions
 *   SLACK_CHANNEL_ID       — channel ID for #general (starts with C)
 *   GITHUB_TOKEN           — fine-grained PAT with Contents: read+write on this repo
 */

const GITHUB_REPO    = 'magoldman/ayso-website';
const BRANCHES       = ['staging', 'main'];
const FIELDSTATUS_PATH   = 'site/src/_data/fieldstatus.json';
const ANNOUNCEMENT_PATH  = 'site/src/_data/announcements.json';
const STATUS_EMOJI   = { Open: '🟢', Closed: '🔴', Monitoring: '🟡' };

// ── Entry point ───────────────────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const rawBody = await request.text();

    if (!await verifySlackSignature(request.headers, rawBody, env.SLACK_SIGNING_SECRET)) {
      return new Response('Unauthorized', { status: 401 });
    }

    const url = new URL(request.url);

    if (url.pathname === '/slack/command') {
      return handleCommand(rawBody, env, ctx);
    }
    if (url.pathname === '/slack/interactions') {
      return handleInteraction(rawBody, env, ctx);
    }

    return new Response('Not found', { status: 404 });
  }
};

// ── Slack signature verification ──────────────────────────────────────────

async function verifySlackSignature(headers, rawBody, signingSecret) {
  const timestamp = headers.get('X-Slack-Request-Timestamp');
  const signature = headers.get('X-Slack-Signature');
  if (!timestamp || !signature) return false;

  // Reject requests older than 5 minutes (replay attack protection)
  if (Math.abs(Date.now() / 1000 - parseInt(timestamp, 10)) > 300) return false;

  const sigBase = `v0:${timestamp}:${rawBody}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(signingSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(sigBase));
  const computed = 'v0=' + Array.from(new Uint8Array(sigBytes))
    .map(b => b.toString(16).padStart(2, '0')).join('');

  return computed === signature;
}

// ── Slash command handler ─────────────────────────────────────────────────

async function handleCommand(rawBody, env, ctx) {
  const params = new URLSearchParams(rawBody);
  const text      = (params.get('text') || '').trim().toLowerCase();
  const triggerId = params.get('trigger_id');

  let view;
  if (text === 'field' || text === 'field status') {
    view = buildFieldStatusModal();
  } else if (text === 'announce' || text === 'announcement') {
    view = buildAnnouncementModal();
  } else {
    view = buildSelectTypeModal();
  }

  ctx.waitUntil(openModal(env.SLACK_BOT_TOKEN, triggerId, view));
  return new Response('', { status: 200 });
}

// ── Interaction handler ───────────────────────────────────────────────────

async function handleInteraction(rawBody, env, ctx) {
  const params  = new URLSearchParams(rawBody);
  const payload = JSON.parse(params.get('payload'));

  const callbackId = payload.view?.callback_id;
  const values     = payload.view?.state?.values || {};
  const user       = payload.user?.name || payload.user?.id || 'unknown';

  // Step 1: user picked a type — push the appropriate form modal
  if (callbackId === 'ayso_select_type') {
    const type = values.type_block?.update_type?.selected_option?.value;
    const view = type === 'announcement' ? buildAnnouncementModal() : buildFieldStatusModal();
    // Use response_action: push — no extra API call needed
    return new Response(JSON.stringify({ response_action: 'push', view }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Step 2a: field status submitted
  if (callbackId === 'ayso_field_status') {
    ctx.waitUntil(processFieldStatus(values, user, env));
    return new Response('', { status: 200 });
  }

  // Step 2b: announcement submitted
  if (callbackId === 'ayso_announcement') {
    ctx.waitUntil(processAnnouncement(values, user, env));
    return new Response('', { status: 200 });
  }

  return new Response('', { status: 200 });
}

// ── Background processors ─────────────────────────────────────────────────

async function processFieldStatus(values, user, env) {
  const status  = values.status_block?.status?.selected_option?.value || 'Open';
  const message = values.message_block?.message?.value || '';
  const checked = values.enabled_block?.enabled?.selected_options;
  const enabled = Array.isArray(checked) && checked.length > 0;

  await commitToBothBranches(
    env.GITHUB_TOKEN,
    FIELDSTATUS_PATH,
    { enabled, status, message },
    `Field status: ${status} (via Slack — @${user})`
  );

  const emoji = STATUS_EMOJI[status] || '🟡';
  await postMessage(env.SLACK_BOT_TOKEN, env.SLACK_CHANNEL_ID, [
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `${emoji} *AYSO Field Status: ${status}*\n${message}` }
    },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `_Updated by @${user} — ${pacificTimestamp()}_` }]
    }
  ], `AYSO Field Status: ${status} — ${message}`);
}

async function processAnnouncement(values, user, env) {
  const body    = values.body_block?.body?.value || '';
  const checked = values.enabled_block?.enabled?.selected_options;
  const enabled = Array.isArray(checked) && checked.length > 0;

  await commitToBothBranches(
    env.GITHUB_TOKEN,
    ANNOUNCEMENT_PATH,
    { enabled, body },
    `Announcement updated (via Slack — @${user})`
  );

  await postMessage(env.SLACK_BOT_TOKEN, env.SLACK_CHANNEL_ID, [
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `📢 *AYSO Announcement*\n${body}` }
    },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `_Updated by @${user} — ${pacificTimestamp()}_` }]
    }
  ], `AYSO Announcement: ${body}`);
}

// ── GitHub API ────────────────────────────────────────────────────────────

async function commitToBothBranches(token, path, content, message) {
  for (const branch of BRANCHES) {
    const file = await getFile(token, path, branch);
    await putFile(token, path, branch, content, message, file.sha);
  }
}

async function getFile(token, path, branch) {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}?ref=${branch}`,
    { headers: githubHeaders(token) }
  );
  return res.json();
}

async function putFile(token, path, branch, content, message, sha) {
  const json = JSON.stringify(content, null, 2) + '\n';
  const encoded = btoa(unescape(encodeURIComponent(json)));
  await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`,
    {
      method: 'PUT',
      headers: { ...githubHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, content: encoded, sha, branch })
    }
  );
}

function githubHeaders(token) {
  return {
    'Authorization': `token ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'AYSO-Slack-Bot'
  };
}

// ── Slack API ─────────────────────────────────────────────────────────────

async function openModal(token, triggerId, view) {
  await fetch('https://slack.com/api/views.open', {
    method: 'POST',
    headers: slackHeaders(token),
    body: JSON.stringify({ trigger_id: triggerId, view })
  });
}

async function postMessage(token, channel, blocks, text) {
  await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: slackHeaders(token),
    body: JSON.stringify({ channel, blocks, text })
  });
}

function slackHeaders(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

// ── Modal builders ────────────────────────────────────────────────────────

function buildSelectTypeModal() {
  return {
    type: 'modal',
    callback_id: 'ayso_select_type',
    title: { type: 'plain_text', text: 'AYSO Update' },
    submit: { type: 'plain_text', text: 'Next →' },
    close: { type: 'plain_text', text: 'Cancel' },
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: 'Changes go live on *both* staging and production immediately.' }
      },
      {
        type: 'input',
        block_id: 'type_block',
        element: {
          type: 'static_select',
          action_id: 'update_type',
          placeholder: { type: 'plain_text', text: 'Choose one...' },
          options: [
            { text: { type: 'plain_text', text: '🏟️  Field Status  (Open / Closed / Monitoring)' }, value: 'field_status' },
            { text: { type: 'plain_text', text: '📢  Announcement Bar' }, value: 'announcement' }
          ]
        },
        label: { type: 'plain_text', text: 'What would you like to update?' }
      }
    ]
  };
}

function buildFieldStatusModal() {
  return {
    type: 'modal',
    callback_id: 'ayso_field_status',
    title: { type: 'plain_text', text: 'Field Status' },
    submit: { type: 'plain_text', text: 'Update' },
    close: { type: 'plain_text', text: 'Cancel' },
    blocks: [
      {
        type: 'input',
        block_id: 'status_block',
        element: {
          type: 'static_select',
          action_id: 'status',
          placeholder: { type: 'plain_text', text: 'Select status' },
          options: [
            { text: { type: 'plain_text', text: '🟢  Open' },       value: 'Open' },
            { text: { type: 'plain_text', text: '🔴  Closed' },     value: 'Closed' },
            { text: { type: 'plain_text', text: '🟡  Monitoring' }, value: 'Monitoring' }
          ]
        },
        label: { type: 'plain_text', text: 'Status' }
      },
      {
        type: 'input',
        block_id: 'message_block',
        element: {
          type: 'plain_text_input',
          action_id: 'message',
          placeholder: { type: 'plain_text', text: 'e.g. All fields are open for play.' }
        },
        label: { type: 'plain_text', text: 'Message' }
      },
      {
        type: 'input',
        block_id: 'enabled_block',
        optional: true,
        element: {
          type: 'checkboxes',
          action_id: 'enabled',
          options: [
            { text: { type: 'plain_text', text: 'Show field status widget on home page' }, value: 'true' }
          ],
          initial_options: [
            { text: { type: 'plain_text', text: 'Show field status widget on home page' }, value: 'true' }
          ]
        },
        label: { type: 'plain_text', text: 'Widget visibility' }
      }
    ]
  };
}

function buildAnnouncementModal() {
  return {
    type: 'modal',
    callback_id: 'ayso_announcement',
    title: { type: 'plain_text', text: 'Announcement' },
    submit: { type: 'plain_text', text: 'Update' },
    close: { type: 'plain_text', text: 'Cancel' },
    blocks: [
      {
        type: 'input',
        block_id: 'body_block',
        element: {
          type: 'plain_text_input',
          action_id: 'body',
          multiline: true,
          placeholder: { type: 'plain_text', text: 'e.g. Registration is now open for Fall 2026.' }
        },
        label: { type: 'plain_text', text: 'Announcement text' }
      },
      {
        type: 'input',
        block_id: 'enabled_block',
        optional: true,
        element: {
          type: 'checkboxes',
          action_id: 'enabled',
          options: [
            { text: { type: 'plain_text', text: 'Show announcement bar on home page' }, value: 'true' }
          ],
          initial_options: [
            { text: { type: 'plain_text', text: 'Show announcement bar on home page' }, value: 'true' }
          ]
        },
        label: { type: 'plain_text', text: 'Bar visibility' }
      }
    ]
  };
}

// ── Utilities ─────────────────────────────────────────────────────────────

function pacificTimestamp() {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
  }).format(new Date());
}
