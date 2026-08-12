// Home page hero mode switch.
//
// "event"    → single wide event banner with a text overlay (see home.njk)
// "rotation" → the standard 5-photo shuffled hero from _data/heroes.js
//
// TO REVERT AFTER THE EVENT: change `mode` to "rotation", commit, promote.
// Nothing else needs to change — both code paths live in home.njk and
// _data/heroes.js is untouched while the event banner is showing.
//
// `endDate` is a safety net, not a timer: the banner stops rendering on the
// first build AFTER that date. Nothing rebuilds this site on a schedule, so
// a stale banner survives until the next deploy. Flip `mode` to be sure.
const config = {
  mode: "event",
  endDate: "2026-08-29", // inclusive — the banner still shows on this date
  image: "/images/home/rc-rollout-web-hero.jpg", // 2560×996 (2.57:1)
  alt: "Region 13 players, referees and families at the Rose City RollOut",
  eventName: "Rose City RollOut",
  headline: "Saturday, Aug 29",
  subhead: "Victory Park",
  link: "/families/rollout/",
};

const today = new Date().toISOString().slice(0, 10);

module.exports = {
  ...config,
  showEvent: config.mode === "event" && today <= config.endDate,
};
