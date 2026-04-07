// Shim — Pages CMS edits navigation.json; this exposes it as a flat array
// so templates can continue to use `navigation` without changes.
module.exports = require('./navigation.json').sections;
