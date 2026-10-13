// Ask the Referee modal config. The staging deploy sets ASK_API_BASE to the
// staging referee Worker; unset (local, prod) uses production, like
// FIELDS_API_BASE. The site key is the platform's shared Turnstile widget
// (repo var TURNSTILE_SITE_KEY in ayso-platform); its hostname list must
// include www.ayso13.org and staging.ayso13.org.
module.exports = {
  apiBase: process.env.ASK_API_BASE || "https://referee.ayso13.org",
  turnstileSiteKey: process.env.ASK_TURNSTILE_SITE_KEY || "0x4AAAAAADza-uyFRocdiTSz",
};
