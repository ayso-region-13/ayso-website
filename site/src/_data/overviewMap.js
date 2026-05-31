// Whether the editor-generated Region Overview PNG exists yet. Until a board
// member opens "Region Overview" in the field-maps editor and saves it (which
// commits overview-map.png), the /fields/ page falls back to the legacy
// AI-generated overview image. Once the PNG lands, the next build switches over.
const fs = require("fs");
const path = require("path");

module.exports = () => ({
  ready: fs.existsSync(path.join(__dirname, "..", "images", "fields", "overview-map.png")),
});
