// Ask the Referee modal config. The staging deploy sets ASK_API_BASE to the
// staging referee Worker; unset (local, prod) uses production, like
// FIELDS_API_BASE. The site key is the platform's shared Turnstile widget
// (repo var TURNSTILE_SITE_KEY in ayso-platform), whose `ayso13.org` hostname
// covers www. The staging deploy overrides it with Cloudflare's always-pass
// test key (ASK_TURNSTILE_SITE_KEY), because the staging referee Worker holds
// the test secret, and the test secret rejects real tokens.
module.exports = {
  apiBase: process.env.ASK_API_BASE || "https://referee.ayso13.org",
  turnstileSiteKey: process.env.ASK_TURNSTILE_SITE_KEY || "0x4AAAAAADza-uyFRocdiTSz",
};
