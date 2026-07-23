// Whether the platform serves a Region Overview map. Sourced from the platform
// public API at build time (was: existence of a committed overview-map.png).
const fetchFieldMaps = require("./lib/fetchFieldMaps");
module.exports = async () => {
  const fm = await fetchFieldMaps();
  return { ready: !!(fm.overview && fm.overview.variants && fm.overview.variants.map) };
};
