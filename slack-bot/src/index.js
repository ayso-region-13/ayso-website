/**
 * AYSO Slack Bot — Cloudflare Worker
 *
 * /ayso               → choose Field Status or Announcement
 * /ayso field         → Field Status modal directly
 * /ayso announce      → Announcement modal directly
 * /ayso promote       → trigger staging → production promotion
 * /ayso staging       → rebuild + redeploy staging.ayso13.org from `staging`
 * /ayso weather       → show current conditions (private/ephemeral reply)
 * /ayso test-weather  → post a connectivity test to #notify-weather via the
 *                       weather-api Worker (verifies its Slack notifier path)
 *
 * Commits changes to both `staging` and `main` branches via GitHub API,
 * then posts a formatted update to the configured Slack channel.
 *
 * Required secrets (set via `wrangler secret put`):
 *   SLACK_SIGNING_SECRET   — from Slack app → Basic Information
 *   SLACK_BOT_TOKEN        — xoxb-... from Slack app → OAuth & Permissions
 *   SLACK_CHANNEL_ID       — channel ID for #general (starts with C)
 *   GITHUB_TOKEN           — fine-grained PAT with Contents: read+write on this repo
 *   WEATHER_SELFTEST_KEY   — shared secret; matches the same on weather-api,
 *                            gates the /api/weather self-test endpoint
 */

const GITHUB_REPO        = 'ayso-region-13/ayso-website';
const BRANCHES           = ['staging', 'main'];
const FIELDSTATUS_PATH   = 'site/src/_data/fieldstatus.json';
const ANNOUNCEMENT_PATH  = 'site/src/_data/announcements.json';
const STATUS_EMOJI       = { Open: '🟢', Closed: '🔴', Monitoring: '🟡' };
const NOTIFY_CHANNEL_ID  = 'C0A024YGR9C'; // #notify-website-status

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
  const userId    = params.get('user_id');

  const allowedIds = await getAllowedUsers(env.GITHUB_TOKEN);
  if (allowedIds.length > 0 && !allowedIds.includes(userId)) {
    return new Response(
      JSON.stringify({ response_type: 'ephemeral', text: "Sorry, you're not authorized to use this command." }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (text === 'promote') {
    ctx.waitUntil(triggerPromotion(env.GITHUB_TOKEN, env.SLACK_BOT_TOKEN, userId, params.get('user_name')));
    return new Response(
      JSON.stringify({ response_type: 'ephemeral', text: '🚀 Promotion triggered — staging → production. Check <https://github.com/ayso-region-13/ayso-website/actions|GitHub Actions> for status.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Manual staging rebuild. Useful when a staging deploy went silent (GitHub
  // failed to allocate a runner) or when a field-map edit needs re-fetching
  // without touching content. Unlike `promote` this deploys nothing to
  // production, so it needs no confirmation step.
  if (text === 'staging' || text === 'rebuild-staging') {
    ctx.waitUntil(triggerStagingDeploy(env.GITHUB_TOKEN, env.SLACK_BOT_TOKEN, userId, params.get('user_name')));
    return new Response(
      JSON.stringify({ response_type: 'ephemeral', text: '🔧 Staging rebuild triggered. Check <https://github.com/ayso-region-13/ayso-website/actions|GitHub Actions> for status.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (text === 'test-weather' || text === 'weather-test') {
    ctx.waitUntil(runWeatherSelfTest(env, params.get('response_url')));
    return new Response(
      JSON.stringify({ response_type: 'ephemeral', text: '🛰️ Testing weather notifications — posting a test card to #notify-weather…' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (text === 'weather' || text === 'conditions') {
    // Silent ack (no visible message); the ephemeral result follows via
    // response_url so a cold-start /api/weather fetch can't blow the 3s limit.
    ctx.waitUntil(sendWeatherStatus(params.get('response_url')));
    return new Response('', { status: 200 });
  }

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
    return jsonResponse({ response_action: 'clear' });
  }

  // Step 2b: announcement submitted
  if (callbackId === 'ayso_announcement') {
    ctx.waitUntil(processAnnouncement(values, user, env));
    return jsonResponse({ response_action: 'clear' });
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

// Fires a workflow_dispatch. `ref` decides WHICH COPY of the workflow file runs,
// not just what gets built — promote reads from `main` deliberately (see the
// promote notes in CLAUDE.md), staging reads from `staging`.
async function dispatchWorkflow(githubToken, workflowFile, ref, inputs) {
  return fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${workflowFile}/dispatches`,
    {
      method: 'POST',
      headers: { ...githubHeaders(githubToken), 'Content-Type': 'application/json' },
      body: JSON.stringify(inputs ? { ref, inputs } : { ref })
    }
  );
}

async function triggerStagingDeploy(githubToken, slackToken, userId, userName) {
  const res = await dispatchWorkflow(githubToken, 'deploy-pages-staging.yml', 'staging');
  const user = userName || userId;

  if (res.status === 204) {
    await postMessage(slackToken, NOTIFY_CHANNEL_ID, [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '🔧 *Staging rebuild*\nDeploy workflow started. staging.ayso13.org will be rebuilt from the `staging` branch in ~2 minutes.' }
      },
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `_Triggered by @${user} — ${pacificTimestamp()}_ · <https://github.com/${GITHUB_REPO}/actions|View Actions>` }]
      }
    ], `Staging rebuild started by @${user}`);
  } else {
    await postMessage(slackToken, NOTIFY_CHANNEL_ID, [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `⚠️ *Staging rebuild failed to start* — GitHub API returned ${res.status}. <https://github.com/${GITHUB_REPO}/actions|Check Actions>.` }
      }
    ], 'Staging rebuild failed to start');
  }
}

async function triggerPromotion(githubToken, slackToken, userId, userName) {
  const res = await dispatchWorkflow(githubToken, 'promote-to-production.yml', 'main', { confirm: 'promote' });

  const user = userName || userId;
  if (res.status === 204) {
    await postMessage(slackToken, NOTIFY_CHANNEL_ID, [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '🚀 *Staging → Production*\nPromotion workflow started. Changes will be live on www.ayso13.org in ~2 minutes.' }
      },
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `_Triggered by @${user} — ${pacificTimestamp()}_ · <https://github.com/${GITHUB_REPO}/actions|View Actions>` }]
      }
    ], `Staging promoted to production by @${user}`);
  } else {
    await postMessage(slackToken, NOTIFY_CHANNEL_ID, [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `⚠️ *Promotion failed* — GitHub API returned ${res.status}. <https://github.com/${GITHUB_REPO}/actions|Check Actions>.` }
      }
    ], 'Promotion failed');
  }
}

function githubHeaders(token) {
  return {
    'Authorization': `token ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'AYSO-Slack-Bot'
  };
}

// Fetches the live /api/weather payload and replies privately (ephemeral)
// to the command invoker with a concise conditions summary.
async function sendWeatherStatus(responseUrl) {
  if (!responseUrl) return;
  let blocks, fallback;
  try {
    const res = await fetch('https://www.ayso13.org/api/weather', { headers: { 'Cache-Control': 'no-cache' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json();
    const c = d.current || {}, w = d.wbgt || {}, a = d.airQuality || {}, r = d.rain || {};
    const fc = (Array.isArray(d.forecast) ? d.forecast : []).find(p => p && typeof p.pop === 'number');

    const lines = ['*🌤 Current conditions — Region 13*'];
    if (c.tempF != null) lines.push(`*Temp:* ${c.tempF}°F (feels ${c.feelsLikeF ?? '—'}°F) · Humidity ${c.humidity ?? '—'}% · Wind ${c.windMph ?? '—'} mph`);
    if (w.valueF != null) lines.push(`*WBGT:* ${w.valueF}°F — CIF Level ${w.level} (${w.levelLabel || '—'})`);
    if (a.aqi != null) lines.push(`*Air Quality:* AQI ${a.aqi} (${a.category || '—'})${a.dominantPollutant ? ' · ' + a.dominantPollutant : ''}`);
    if (r.last48hInches != null) lines.push(`*Rain:* ${r.last48hInches}" past 48h / ${r.last72hInches}" past 72h`);
    if (fc) lines.push(`*Forecast:* ${fc.name} — ${fc.pop}% chance of precip`);

    if (d.closureRecommended) {
      const reasons = [];
      if (w.level >= 5) reasons.push('heat (WBGT Level 5)');
      if (r.closureRecommended) reasons.push('rain');
      if (a.closureRecommended) reasons.push('air quality');
      lines.push(`*⚠️ Closure recommended* — ${reasons.join(', ') || 'weather'}. Use \`/ayso field\` to set field status.`);
    } else {
      lines.push('*✅ No weather-driven closure recommended.*');
    }

    let updated = null;
    try { updated = c.stationTimestamp ? new Date(c.stationTimestamp).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit' }) : null; } catch (_) {}
    blocks = [
      { type: 'section', text: { type: 'mrkdwn', text: lines.join('\n') } },
      { type: 'context', elements: [{ type: 'mrkdwn', text: `${updated ? 'Updated ' + updated + ' PT · ' : ''}<https://www.ayso13.org/resources/weather/|Full weather page>` }] }
    ];
    fallback = 'Current weather conditions';
  } catch (e) {
    blocks = [{ type: 'section', text: { type: 'mrkdwn', text: `⚠️ Couldn't reach the weather service: ${e.message}` } }];
    fallback = 'Weather unavailable';
  }
  await fetch(responseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ response_type: 'ephemeral', text: fallback, blocks })
  });
}

// Calls the weather-api Worker's authenticated self-test endpoint, which
// posts a test card to #notify-weather via its REAL Slack notifier path,
// then reports the outcome back to the command invoker (ephemeral).
async function runWeatherSelfTest(env, responseUrl) {
  let resultText;
  try {
    const res = await fetch('https://www.ayso13.org/api/weather', {
      method: 'POST',
      headers: { 'X-Selftest-Key': env.WEATHER_SELFTEST_KEY || '' }
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 403) {
      resultText = '❌ Weather test rejected (auth). The WEATHER_SELFTEST_KEY secret is missing or mismatched between the bot and weather-api.';
    } else if (data.ok) {
      resultText = '✅ Test posted to <#C0BB7JJ0XRN|notify-weather> — the weather Worker can post. Real closure / NWS-alert / rain-forecast notices will land there automatically.';
    } else {
      const err = (data.slack && data.slack.error) || `HTTP ${res.status}`;
      const hint = err === 'not_in_channel' ? ' Invite the bot to #notify-weather (`/invite @<bot>`).' : '';
      resultText = `❌ Weather test failed: \`${err}\`.${hint}`;
    }
  } catch (e) {
    resultText = `❌ Weather test error: ${e.message}`;
  }
  if (responseUrl) {
    await fetch(responseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response_type: 'ephemeral', text: resultText })
    });
  }
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
  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: slackHeaders(token),
    body: JSON.stringify({ channel, blocks, text })
  });
  const data = await res.json();
  if (!data.ok) {
    // If target channel failed, report the error to the notify channel so it's visible
    if (channel !== NOTIFY_CHANNEL_ID) {
      await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: slackHeaders(token),
        body: JSON.stringify({
          channel: NOTIFY_CHANNEL_ID,
          text: `⚠️ Bot failed to post to <#${channel}>: \`${data.error}\`\n\nMessage was: ${text}`
        })
      });
    }
  }
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

async function getAllowedUsers(token) {
  try {
    const file = await getFile(token, 'slack-bot/allowed-users.json', 'main');
    const json = JSON.parse(atob(file.content.replace(/\n/g, '')));
    return json.allowed_user_ids || [];
  } catch {
    return []; // if file missing or unreadable, allow all
  }
}

function jsonResponse(body) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

function pacificTimestamp() {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
  }).format(new Date());
}
