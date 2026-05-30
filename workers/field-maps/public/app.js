/* AYSO Region 13 field-map editor.
 *
 * Parametric authoring model — every element is data, not free geometry:
 *   field   : rotated rectangle (center, widthM, lengthM, rotationDeg) + name +
 *             ageGroup; HOME/AWAY sidelines auto-derived by compass (Geo.homeAway:
 *             HOME = north-or-west long side, AWAY = east-or-south).
 *   grid    : a field subdivided into cols×rows labeled cells — the practice
 *             layout convention (e.g. Victory-Upper A–F, Victory-Lower 1–11).
 *   line    : polyline (custom sideline, path); draggable vertices.
 *   text    : a placed word (e.g. "Park Here"); draggable, colored.
 *   marker  : point icon — goal, restroom, parking, host tent, picture-day check-in.
 *
 * Interaction: click a tool → click the map to drop a default-sized element,
 * then drag its body to move and drag its corner / rotate handles to resize and
 * rotate. All pure geometry lives in geo.js (Node-tested).
 *
 * Export is deterministic: a Mapbox Static Images satellite base + every element
 * re-drawn on a fixed-size 2D canvas via Web-Mercator projection. Never a live
 * GL screenshot. Labels are canvas text (independent of Mapbox glyphs).
 */

const OUT_W = 1000, OUT_H = 750, SCALE = 2;     // → 2000×1500 px export
const STYLE = "satellite-v9";
const EARTH_CIRCUMFERENCE = 40075016.686, TILE = 512;

const MARKER_TYPES = {
  goal:      { color: "#2f6fed", code: "G", emoji: "🥅", name: "Goal" },
  restroom:  { color: "#6b3fa0", code: "R", emoji: "🚻", name: "Restroom" },
  parking:   { color: "#1f8a4c", code: "P", emoji: "🅿️", name: "Parking" },
  tent:      { color: "#d11313", code: "T", emoji: "⛺", name: "Field Host Tent" },
  checkin:   { color: "#d11313", code: "C", emoji: "📷", name: "Picture-Day Check-in" },
  equipment: { color: "#6b3fa0", code: "E", emoji: "🥅", name: "Equipment Storage" },
  // Entrance is directional: a rotatable arrow; its text label stays upright.
  entrance:  { color: "#15610e", code: "⬆", emoji: "⬆", name: "Entrance", arrow: true },
};
// Field size presets by AYSO age division → [widthM, lengthM]. Starting points
// (small-sided field guidance); fine-tune by dragging or via width/length.
// Picking a preset also sets the field's age label.
const FIELD_PRESETS = {
  "6U":      [18, 27],   // 4v4
  "7U":      [18, 27],   // 4v4
  "8U":      [30, 46],   // 7v7 (small)
  "10U":     [37, 55],   // 7v7
  "12U":     [46, 73],   // 9v9
  "14U":     [55, 91],   // 11v11 (youth)
  "16U/19U": [64, 100],  // 11v11
};
// HOME/AWAY in brand colours: gold (dark text) ↔ maroon (white text). The big
// lightness difference keeps them distinguishable (incl. colour-blind) and
// readable on grass. (Brand green is unusable on a green field.)
const HOME_COLOR = "#f4bd4d", HOME_TEXT = "#3a0d12";
const AWAY_COLOR = "#8e2929", AWAY_TEXT = "#ffffff";
const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", -apple-system, Arial, sans-serif';

// Region Overview mode: a region-wide street map with one labeled pin per field
// (kind "place"). Uses a light street base instead of satellite, and a much
// larger frame than per-field maps. Saved under slug "overview", variant "map".
const OVERVIEW_STYLE = "streets-v12";
const OVERVIEW_SLUG = "overview";
const PLAY_COLOR = { game: "#d11313", practice: "#7a1010", both: "#d11313" };
const PLAY_NAME = { game: "Game field", practice: "Practice field", both: "Game field" };
function currentStyle() { return state.overview ? OVERVIEW_STYLE : STYLE; }

const state = {
  config: null, fields: [], field: null, variant: "game",
  doc: null, variants: [], // current field's saved doc + available layouts
  elements: [], selectedId: null, tool: null,
  drag: null, seq: 1, overview: false,
  history: [], histIndex: -1, // element-state snapshots for undo/redo
};
let map;

init().catch((e) => { console.error(e); toast("Failed to start: " + e.message, "error"); });

async function init() {
  state.config = await api("/api/config");
  if (!state.config.mapboxToken) throw new Error("Mapbox token not configured (MAPBOX_TOKEN_PUBLIC).");
  document.getElementById("who").textContent = state.config.editor || "";

  // Preload the AYSO Region 13 logo for the export title pill (square viewBox).
  state.logo = new Image();
  state.logo.src = "/region13-logo.svg";

  state.overview = new URLSearchParams(location.search).get("overview") === "1";

  mapboxgl.accessToken = state.config.mapboxToken;
  map = new mapboxgl.Map({
    container: "map", style: "mapbox://styles/mapbox/" + currentStyle(),
    center: state.overview ? [-118.143, 34.168] : [-118.1445, 34.1478],
    zoom: state.overview ? 11.8 : 15,
  });
  map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-left");

  map.on("load", () => {
    addSrc("shapes"); addSrc("sidelines"); addSrc("labels"); addSrc("markers"); addSrc("arrows"); addSrc("handles");
    map.addLayer({ id: "shapes-fill", type: "fill", source: "shapes",
      filter: ["==", ["geometry-type"], "Polygon"],
      paint: { "fill-color": ["coalesce", ["get", "fill"], "#f74b4b"], "fill-opacity": 0.2 } });
    map.addLayer({ id: "shapes-line", type: "line", source: "shapes",
      paint: { "line-color": ["coalesce", ["get", "stroke"], "#ffffff"], "line-width": ["coalesce", ["get", "strokeW"], 2] } });
    map.addLayer({ id: "sidelines", type: "line", source: "sidelines",
      paint: { "line-color": ["get", "color"], "line-width": ["coalesce", ["get", "w"], 5] } });
    map.addLayer({ id: "markers-c", type: "circle", source: "markers",
      paint: { "circle-radius": ["coalesce", ["get", "r"], 12], "circle-color": ["get", "color"], "circle-stroke-width": ["coalesce", ["get", "sw"], 2], "circle-stroke-color": "#fff" } });
    map.addLayer({ id: "markers-code", type: "symbol", source: "markers",
      layout: { "text-field": ["get", "code"], "text-size": 15, "text-allow-overlap": true, "text-rotate": ["coalesce", ["get", "rot"], 0] },
      paint: { "text-color": "#fff" } });
    map.addLayer({ id: "arrows", type: "symbol", source: "arrows",
      layout: { "text-field": "▲", "text-size": 20, "text-allow-overlap": true, "text-rotate": ["get", "rot"], "text-rotation-alignment": "map", "text-anchor": "center" },
      paint: { "text-color": ["get", "color"], "text-halo-color": "rgba(255,255,255,0.8)", "text-halo-width": 1.5 } });
    map.addLayer({ id: "labels", type: "symbol", source: "labels",
      layout: { "text-field": ["get", "text"], "text-size": ["coalesce", ["get", "size"], 13], "text-allow-overlap": true, "text-anchor": "center" },
      paint: { "text-color": ["coalesce", ["get", "color"], "#ffffff"], "text-halo-color": "rgba(0,0,0,0.75)", "text-halo-width": 1.6 } });
    map.addLayer({ id: "handles", type: "circle", source: "handles",
      paint: { "circle-radius": 7, "circle-color": ["match", ["get", "role"], "rotate", "#f4bd4d", "#ffffff"], "circle-stroke-width": 2, "circle-stroke-color": "#222" } });
    refreshFrameBox();
    rebuild();
  });

  map.on("move", refreshFrameBox);
  map.on("zoom", refreshFrameBox);
  map.on("mousedown", onDown);
  map.on("mousemove", onMove);
  map.on("mouseup", onUp);
  map.on("click", onClick);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { state.tool = null; select(null); setHint("Click a tool, then click the map. Esc cancels."); }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !/^(input|textarea|select)$/i.test((e.target.tagName || ""))) {
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
    }
  });

  wireUi();
  await loadFields();

  if (state.overview) {
    await selectOverview();
    return;
  }
  // Restore field/layout from the URL (so a refresh stays on the same field).
  const params = new URLSearchParams(location.search);
  const fieldParam = params.get("field");
  if (fieldParam && state.fields.some((f) => f.slug === fieldParam)) {
    document.getElementById("fieldSelect").value = fieldParam;
    await selectField(fieldParam, params.get("layout"));
  }
}

function addSrc(id) { map.addSource(id, { type: "geojson", data: fc([]) }); }
function fc(features) { return { type: "FeatureCollection", features }; }

// ─── UI wiring ─────────────────────────────────────────────────────────────
function wireUi() {
  document.getElementById("fieldSelect").addEventListener("change", (e) => {
    // Switching to a field from overview mode reloads (satellite base vs streets).
    if (state.overview && e.target.value) { location.href = location.pathname + "?field=" + encodeURIComponent(e.target.value); return; }
    selectField(e.target.value);
  });
  const ovBtn = document.getElementById("overviewBtn");
  if (ovBtn) ovBtn.addEventListener("click", () => { location.href = location.pathname + "?overview=1"; });
  document.getElementById("variantSelect").addEventListener("change", (e) => {
    if (e.target.value === "__add_blank__") { addLayout(false); return; }
    if (e.target.value === "__add_copy__") { addLayout(true); return; }
    state.variant = e.target.value;
    if (state.field) loadVariant();
    updateFilename();
    updateUrl();
  });
  document.getElementById("frameMeters").addEventListener("input", (e) => setFrameMeters(Number(e.target.value)));
  document.getElementById("frameLockBtn").addEventListener("click", toggleFrameLock);
  document.getElementById("undoBtn").addEventListener("click", undo);
  document.getElementById("redoBtn").addEventListener("click", redo);
  document.getElementById("deleteLayoutBtn").addEventListener("click", deleteCurrentLayout);
  wireFrameHandle();
  document.getElementById("recenterBtn").addEventListener("click", recenter);
  document.getElementById("previewBtn").addEventListener("click", () => doExport(false));
  document.getElementById("saveBtn").addEventListener("click", () => doExport(true));
  document.getElementById("modalClose").addEventListener("click", () => modal(false));
  document.getElementById("variantLabel").addEventListener("input", updateFilename);
  document.querySelectorAll(".tool").forEach((b) => b.addEventListener("click", () => {
    if (!state.field) return toast("Pick a field first.", "error");
    document.querySelectorAll(".tool.active").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    state.tool = b.dataset.tool;
    setHint("Click the map to place the " + b.textContent.trim() + ".");
  }));
}
function setHint(t) { document.getElementById("toolHint").textContent = t; }

// Drag the dashed frame's corner grip to resize the export bounds. The frame is
// centered on the map center (= export center), so width is derived from the
// cursor's horizontal distance to center; height follows the export aspect.
function wireFrameHandle() {
  const handle = document.getElementById("frameHandle");
  const input = document.getElementById("frameMeters");
  let dragging = false;
  const move = (e) => {
    if (!dragging) return;
    const pt = e.touches ? e.touches[0] : e;
    const rect = document.getElementById("map").getBoundingClientRect();
    ensureFrameBox();
    // Top-left stays fixed; width grows to the cursor. Height follows aspect.
    let w = (pt.clientX - rect.left) - state.frameBox.x;
    let meters = clampMeters(Math.round((w * mppNow()) / 10) * 10);
    state.frameBox.w = meters / mppNow();
    state.frameBox.h = state.frameBox.w * (OUT_H / OUT_W);
    applyFrameBox();
    syncMetersReadout();
    e.preventDefault();
  };
  const end = () => {
    dragging = false;
    document.removeEventListener("mousemove", move);
    document.removeEventListener("mouseup", end);
    document.removeEventListener("touchmove", move);
    document.removeEventListener("touchend", end);
  };
  const start = (e) => {
    if (state.frameLocked) return;
    dragging = true;
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", end);
    document.addEventListener("touchmove", move, { passive: false });
    document.addEventListener("touchend", end);
    e.preventDefault();
    e.stopPropagation();
  };
  handle.addEventListener("mousedown", start);
  handle.addEventListener("touchstart", start, { passive: false });
}

// ─── Fields ──────────────────────────────────────────────────────────────────
async function loadFields() {
  state.fields = await api("/api/fields");
  const sel = document.getElementById("fieldSelect");
  sel.innerHTML = '<option value="">— choose a field —</option>' +
    state.fields.map((f) => `<option value="${esc(f.slug)}">${esc(f.title)}${f.hasMap ? " ✓" : ""}</option>`).join("");
}
async function selectField(slug, initialLayout) {
  state.tool = null;
  state.field = state.fields.find((f) => f.slug === slug) || null;
  document.getElementById("saveBtn").disabled = !state.field;
  if (!state.field) return;
  state.doc = await fetchDoc(slug);
  buildVariantList();
  state.variant = (initialLayout && state.variants.some((v) => v.id === initialLayout)) ? initialLayout : "game";
  populateVariantSelect();
  recenter();
  loadVariant();
  updateFilename();
  updateUrl();
}

// Region Overview: load the seeded "overview" doc (one pin per field) as a single
// "map" layout. Uses a synthetic field so the existing save/export path works.
async function selectOverview() {
  state.tool = null;
  document.getElementById("fieldSelect").value = "";
  state.field = { slug: OVERVIEW_SLUG, title: "Region Overview", lat: 34.168, lon: -118.143 };
  document.getElementById("saveBtn").disabled = false;
  // No Game/Practice layouts for the overview — just the one map.
  const layoutCtl = document.getElementById("variantSelect").closest("label");
  if (layoutCtl) layoutCtl.style.display = "none";
  // The overview frame spans ~16 km, far beyond the per-field 1200 m cap.
  document.getElementById("frameMeters").max = 40000;
  // Show only the pin + word tools; field/grid/fan tools don't apply region-wide.
  document.querySelectorAll(".tool").forEach((b) => {
    b.style.display = (b.dataset.tool === "place" || b.dataset.tool === "word") ? "" : "none";
  });
  setHint("Pins are fixed at each field's location — drag a field's label to move it (a leader line keeps it connected). Save to publish the overview.");

  state.doc = await fetchDoc(OVERVIEW_SLUG);
  if (state.doc && state.doc.variants && state.doc.variants.map && state.doc.variants.map.view && state.doc.variants.map.view.center) {
    const c = state.doc.variants.map.view.center; state.field.lon = c[0]; state.field.lat = c[1];
  }
  state.variants = [{ id: "map", label: "Region Overview" }];
  state.variant = "map";
  populateVariantSelect();
  loadVariant();
  updateFilename();
}

// Delete the current layout (variant) — removes its map + JSON entry from the repo.
async function deleteCurrentLayout() {
  if (!state.field) return toast("Pick a field first.", "error");
  const saved = state.doc && state.doc.variants && state.doc.variants[state.variant];
  if (!saved) return toast("This layout isn't saved yet — nothing to delete.", "error");
  const label = (state.variants.find((v) => v.id === state.variant) || {}).label || state.variant;
  if (!confirm(`Delete the "${label}" layout for ${state.field.title}? This removes its map from the site.`)) return;
  try {
    const res = await api("/api/map/" + state.field.slug + "?variant=" + encodeURIComponent(state.variant), { method: "DELETE" });
    toast(`Deleted "${label}" (${res.commit.slice(0, 7)}). Preview rebuilds shortly.`, "success");
    state.doc = await fetchDoc(state.field.slug);
    buildVariantList();
    state.variant = state.variants.some((v) => v.id === "game") ? "game" : (state.variants[0] ? state.variants[0].id : "game");
    populateVariantSelect();
    loadVariant();
    updateFilename();
    updateUrl();
    const f = state.fields.find((x) => x.slug === state.field.slug); if (f) f.hasMap = res.remaining > 0;
  } catch (e) {
    toast("Delete failed: " + e.message, "error");
  }
}

// Keep ?field=&layout= in the URL so a refresh reloads the same field/layout.
function updateUrl() {
  if (!state.field) return;
  const p = new URLSearchParams();
  p.set("field", state.field.slug);
  if (state.variant) p.set("layout", state.variant);
  history.replaceState(null, "", location.pathname + "?" + p.toString());
}

async function fetchDoc(slug) {
  try { return await api("/api/map/" + slug); } catch (_) { return { variants: {} }; }
}
// Available layouts for the current field: Game + Practice + any saved named ones.
function buildVariantList() {
  const std = [{ id: "game", label: "Game Day" }, { id: "practice", label: "Practice" }, { id: "wayfinder", label: "Wayfinder" }];
  const variants = (state.doc && state.doc.variants) || {};
  const extra = Object.keys(variants)
    .filter((k) => k !== "game" && k !== "practice")
    .map((k) => ({ id: k, label: (variants[k] && variants[k].label) || k }));
  state.variants = std.concat(extra);
}
function populateVariantSelect() {
  const sel = document.getElementById("variantSelect");
  sel.innerHTML = state.variants.map((v) =>
    `<option value="${esc(v.id)}"${v.id === state.variant ? " selected" : ""}>${esc(v.label)}</option>`).join("")
    + `<option value="__add_blank__">+ New layout (blank)…</option>`
    + `<option value="__add_copy__">+ New layout (copy of current)…</option>`;
}
// Create a new named layout. copy=true clones the layout you're viewing (same
// elements + frame) as a starting point — e.g. "Games B" as a variation of A.
// copy=false starts blank — e.g. Practice vs Game.
function addLayout(copy) {
  const sel = document.getElementById("variantSelect");
  const name = prompt(copy ? 'Name the copy (e.g. "Games B"):' : 'Name this layout (e.g. "Practice", "Tournament"):', "");
  if (!name || !name.trim()) { sel.value = state.variant; return; }
  const id = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!id) { sel.value = state.variant; return; }
  // Snapshot the current layout's elements before switching (for the copy case).
  const cloned = copy ? JSON.parse(JSON.stringify(state.elements)).map((e) => ({ ...e, id: "e" + state.seq++ })) : null;
  if (!state.variants.some((v) => v.id === id)) state.variants.push({ id: id, label: name.trim() });
  state.variant = id;
  populateVariantSelect();
  if (copy) {
    // Keep the current frame; carry over a copy of the elements.
    state.elements = cloned;
    select(null);
    rebuild();
    resetHistory();
  } else {
    loadVariant(); // empty layout + default frame
  }
  document.getElementById("variantLabel").value = name.trim();
  updateFilename();
  updateUrl();
}
function recenter() { if (state.field) { state.frameBox = null; fitToFrame(); refreshFrameBox(); } }

// Zoom/pan so the export frame fits the visible map area (so a wide frame never
// extends under the side panel). Uses the saved/locked geo frame if present,
// else a default-sized box around the field center.
function fitToFrame() {
  if (!state.field) return;
  let nw, se;
  if (state.frameGeo) { nw = state.frameGeo.nw; se = state.frameGeo.se; }
  else {
    const c = [state.field.lon, state.field.lat];
    const m = clampMeters(Number(document.getElementById("frameMeters").value) || 200);
    const aspect = OUT_H / OUT_W;
    nw = Geo.destination(c, -m / 2, (m * aspect) / 2);
    se = Geo.destination(c, m / 2, -(m * aspect) / 2);
  }
  map.fitBounds([nw, se], { padding: 30, duration: 0 });
}

async function loadVariant() {
  state.elements = []; select(null);
  document.getElementById("variantLabel").value = "";
  // Reset frame to default (unlocked) unless a saved frame is restored below.
  state.frameBox = null; state.frameGeo = null; state.frameLocked = false;
  const doc = state.doc;
  const v = doc && doc.variants && doc.variants[state.variant];
  if (v) {
    if (v.view && v.view.frameMeters) document.getElementById("frameMeters").value = v.view.frameMeters;
    if (v.label) document.getElementById("variantLabel").value = v.label;
    // Always assign FRESH session ids (don't reuse saved e.id) so state.seq
    // advances past loaded elements — otherwise a newly placed element reuses an
    // id like "e1" and collides with a loaded one (they'd select/lock together).
    if (Array.isArray(v.elements)) state.elements = v.elements.map((e) => ({ ...e, id: "e" + state.seq++ }));
    // Restore + pin the saved export frame (reconstruct from center + width)
    // so the dashed frame persists across loads, glued to the same ground.
    if (v.view && v.view.center && v.view.frameMeters) {
      const c = v.view.center, m = v.view.frameMeters, aspect = OUT_H / OUT_W;
      state.frameGeo = { nw: Geo.destination(c, -m / 2, (m * aspect) / 2), se: Geo.destination(c, m / 2, -(m * aspect) / 2) };
      state.frameLocked = true;
    }
  }
  syncFrameLockUI();
  fitToFrame();
  rebuild();
  refreshFrameBox();
  resetHistory(); // baseline = the just-loaded layout
}

// ─── Placement ─────────────────────────────────────────────────────────────
function onClick(e) {
  if (!state.tool || !state.field) return;
  const c = [e.lngLat.lng, e.lngLat.lat];
  const id = "e" + state.seq++;
  let el;
  if (state.tool === "field") {
    const [w, l] = FIELD_PRESETS["10U"];
    el = { id, kind: "field", center: c, widthM: w, lengthM: l, rotationDeg: 0, name: "", ageGroup: "10U", preset: "10U", markHome: state.variant === "game" };
  } else if (state.tool === "grid") {
    el = { id, kind: "grid", center: c, widthM: 70, lengthM: 50, rotationDeg: 0, cols: 3, rows: 2, scheme: "letters", startIndex: 0, name: "" };
  } else if (state.tool === "fan") {
    el = { id, kind: "fan", center: c, innerRadiusM: 25, radiusM: 65, startDeg: -45, sweepDeg: 90, wedges: 3, scheme: "lcr", startIndex: 0, name: "" };
  } else if (state.tool === "infield") {
    el = { id, kind: "infield", center: c, radiusM: 30, startDeg: -45, sweepDeg: 90 };
  } else if (state.tool === "nogo") {
    el = { id, kind: "nogo", center: c, widthM: 30, lengthM: 20, rotationDeg: 0, label: "Do not use" };
  } else if (state.tool === "line") {
    el = { id, kind: "line", points: [Geo.destination(c, -15, 0), Geo.destination(c, 15, 0)], color: HOME_COLOR, width: 5, label: "" };
  } else if (state.tool === "arrow") {
    el = { id, kind: "arrow", points: [c, Geo.destination(c, 30, 0)], color: "#83312d", width: 7, label: "" };
  } else if (state.tool === "word") {
    const text = prompt("Word / label text:", "Park Here");
    if (!text) { state.tool = null; clearToolBtns(); return; }
    el = { id, kind: "text", center: c, text, color: "#83312d", size: 18 };
  } else if (state.tool === "place") {
    const name = prompt("Field name for this pin:", "New field");
    if (!name) { state.tool = null; clearToolBtns(); return; }
    el = { id, kind: "place", center: c, name: name.trim(), play: "game" };
  } else {
    el = { id, kind: "marker", type: state.tool, center: c };
    if (state.tool === "entrance") el.rotationDeg = 0;
  }
  if (!confirmLayoutMatch(el.kind)) { state.tool = null; clearToolBtns(); return; }
  state.elements.push(el);
  state.tool = null; clearToolBtns();
  select(id);
  snapshot(true);
  setHint("Drag to move; drag handles to resize/rotate. Esc deselects.");
}
function clearToolBtns() { document.querySelectorAll(".tool.active").forEach((x) => x.classList.remove("active")); }

// Warn on element/layout mismatches: a game Field on a Practice layout, or a
// practice grid/fan on a Game layout. Returns false if the user cancels.
function confirmLayoutMatch(kind) {
  const v = state.variant || "";
  if (kind === "field" && /practice/.test(v)) {
    return confirm("This is a Practice layout, but you're adding a game Field.\nFields usually go on Game maps. Add it anyway?");
  }
  if ((kind === "grid" || kind === "fan") && /game/.test(v)) {
    return confirm("This is a Game layout, but you're adding a practice " + (kind === "grid" ? "grid" : "fan") + ".\nThose usually go on Practice maps. Add it anyway?");
  }
  return true;
}

// ─── Interaction (move / resize / rotate / vertex) ─────────────────────────────
function onDown(e) {
  if (state.tool) return; // placement handled by click
  const h = pick(e.point, ["handles"]);
  if (h.length) {
    const p = h[0].properties;
    state.drag = { mode: p.role, id: p.eid, idx: p.idx != null ? +p.idx : null, last: e.lngLat };
    map.dragPan.disable();
    e.preventDefault();
    return;
  }
  const b = pick(e.point, ["shapes-fill", "shapes-line", "markers-c", "labels", "sidelines"]);
  // Choose the best non-locked element under the cursor. Prefer point-like
  // elements (text, markers) over areas (field/grid/fan/line) so a text label or
  // marker sitting on top of a field is selectable instead of grabbing the field.
  let eid = null, bestRank = 99;
  const rankOf = (k) => (k === "text" || k === "marker" || k === "place" ? 0 : k === "line" ? 1 : 2);
  for (let i = 0; i < b.length; i++) {
    const id = b[i].properties && b[i].properties.eid;
    const el = id && byId(id);
    if (!el || el.locked) continue;
    const r = rankOf(el.kind);
    if (r < bestRank) { eid = id; bestRank = r; if (r === 0) break; }
  }
  if (eid) {
    select(eid);
    state.drag = { mode: "move", id: eid, last: e.lngLat };
    map.dragPan.disable();
    e.preventDefault();
    return;
  }
  select(null);
}

function onMove(e) {
  if (!state.drag) return;
  const el = byId(state.drag.id);
  if (!el) return;
  const cur = [e.lngLat.lng, e.lngLat.lat];
  if (state.drag.mode === "move") {
    const dLng = e.lngLat.lng - state.drag.last.lng, dLat = e.lngLat.lat - state.drag.last.lat;
    if (el.kind === "place") {
      // The pin stays at the field's true coordinates; dragging moves the label.
      const base = el.label || el.center;
      el.label = [base[0] + dLng, base[1] + dLat];
    } else if (el.points) el.points = el.points.map((p) => [p[0] + dLng, p[1] + dLat]);
    else el.center = [el.center[0] + dLng, el.center[1] + dLat];
    state.drag.last = e.lngLat;
  } else if (state.drag.mode === "corner") {
    const d = Geo.resizeFromCorner(el.center, el.rotationDeg, cur);
    el.widthM = Math.round(d.widthM); el.lengthM = Math.round(d.lengthM);
    if (el.kind === "field") el.preset = "custom";
  } else if (state.drag.mode === "rotate") {
    el.rotationDeg = Math.round(Geo.bearingDeg(el.center, cur));
  } else if (state.drag.mode === "vertex" && el.points) {
    el.points[state.drag.idx] = cur;
  } else if (state.drag.mode === "fanarc" && (el.kind === "fan" || el.kind === "infield")) {
    el.radiusM = Math.max(10, Math.round(Geo.distanceM(el.center, cur)));
    el.startDeg = Geo.bearingDeg(el.center, cur) - el.sweepDeg / 2; // keep handle at arc mid
    if (el.innerRadiusM > el.radiusM - 5) el.innerRadiusM = Math.max(5, el.radiusM - 5);
  } else if (state.drag.mode === "faninner" && el.kind === "fan") {
    el.innerRadiusM = Math.max(5, Math.min(el.radiusM - 5, Math.round(Geo.distanceM(el.center, cur))));
  } else if (state.drag.mode === "markerrot") {
    el.rotationDeg = Math.round(Geo.bearingDeg(el.center, cur));
  }
  rebuildMap(); // map only during drag — panel refreshes on mouseup (keeps perf + focus)
}
function onUp() { if (state.drag) { state.drag = null; map.dragPan.enable(); renderSelPanel(); renderElemList(); snapshot(true); } }

function pick(pt, layers) {
  const present = layers.filter((l) => map.getLayer(l));
  if (!present.length) return [];
  return map.queryRenderedFeatures([[pt.x - 11, pt.y - 11], [pt.x + 11, pt.y + 11]], { layers: present });
}

// ─── Build all map sources from state ──────────────────────────────────────────
// rebuildMap() refreshes only the map layers (no panel re-render) — call it on
// keystroke edits so the input you're typing in keeps focus. rebuild() also
// re-renders the side panel (use it for selection / preset / structural changes).
function rebuildMap() {
  const shapes = [], sidelines = [], labels = [], markers = [], arrows = [], handles = [];

  state.elements.forEach((el) => {
    if (el.kind === "field") {
      const ring = Geo.rectRing(el.center, el.widthM, el.lengthM, el.rotationDeg);
      shapes.push(poly(ring, el.id, { fill: "#f74b4b", stroke: "#ffffff", strokeW: 2 }));
      // Thin white pitch markings (halfway line, center circle, goals).
      const mk = Geo.fieldMarkings(el.center, el.widthM, el.lengthM, el.rotationDeg);
      shapes.push(lineFeat(mk.halfway, el.id, { stroke: "#ffffff", strokeW: 1.5 }));
      shapes.push(lineFeat(mk.circle, el.id, { stroke: "#ffffff", strokeW: 1.5 }));
      mk.goals.forEach((g) => shapes.push(lineFeat(g, el.id, { stroke: "#ffffff", strokeW: 1.5 })));
      const txt = [el.name, el.ageGroup].filter(Boolean).join("\n");
      if (txt) labels.push(label(Geo.centroid(ring), txt, el.id, { size: 15 }));
      if (el.markHome) {
        const ha = Geo.homeAway(ring);
        if (ha) {
          sidelines.push(lineFeat([ha.home.a, ha.home.b], el.id, { color: HOME_COLOR, w: 6 }));
          sidelines.push(lineFeat([ha.away.a, ha.away.b], el.id, { color: AWAY_COLOR, w: 5 }));
          labels.push(label(ha.home.mid, "HOME", el.id, { size: 12, color: "#f4bd4d" }));
          labels.push(label(ha.away.mid, "AWAY", el.id, { size: 12, color: "#ffd9d2" }));
        }
      }
    } else if (el.kind === "grid") {
      const cells = Geo.gridCells(el.center, el.widthM, el.lengthM, el.rotationDeg, el.cols, el.rows);
      cells.forEach((cell) => {
        shapes.push(poly(cell.ring, el.id, { fill: "#f4bd4d", stroke: "#f4bd4d", strokeW: 2 }));
        labels.push(label(cell.center, Geo.cellLabel(cell.index, el.scheme, el.startIndex), el.id, { size: 16, color: "#fff8e6" }));
      });
      if (el.name) {
        const top = Geo.rectRing(el.center, el.widthM, el.lengthM, el.rotationDeg);
        labels.push(label(Geo.midpoint(top[0], top[1]), el.name, el.id, { size: 15, color: "#fff8e6" }));
      }
    } else if (el.kind === "fan") {
      const cells = Geo.fanCells(el.center, el.innerRadiusM, el.radiusM, el.startDeg, el.sweepDeg, el.wedges);
      cells.forEach((cell) => {
        shapes.push(poly(cell.ring, el.id, { fill: "#f4bd4d", stroke: "#f4bd4d", strokeW: 2 }));
        labels.push(label(cell.center, fanLabel(el, cell.index), el.id, { size: 14, color: "#fff8e6" }));
      });
      const inf = Geo.fanInfield(el.center, el.innerRadiusM, el.startDeg, el.sweepDeg);
      shapes.push(poly(inf.ring, el.id, { fill: "#d11313", stroke: "#ffffff", strokeW: 1.5 }));
      labels.push(label(inf.center, "Stay off the infield", el.id, { size: 11, color: "#ffffff" }));
      if (el.name) labels.push(label(Geo.fanArcPoint(el.center, el.radiusM * 1.12, el.startDeg, el.sweepDeg), el.name, el.id, { size: 14, color: "#fff8e6" }));
    } else if (el.kind === "infield") {
      const inf = Geo.fanInfield(el.center, el.radiusM, el.startDeg, el.sweepDeg);
      shapes.push(poly(inf.ring, el.id, { fill: "#d11313", stroke: "#ffffff", strokeW: 1.5 }));
      labels.push(label(inf.center, "Stay off the infield", el.id, { size: 11, color: "#ffffff" }));
    } else if (el.kind === "nogo") {
      const ring = Geo.rectRing(el.center, el.widthM, el.lengthM, el.rotationDeg);
      shapes.push(poly(ring, el.id, { fill: "#d11313", stroke: "#ffffff", strokeW: 1.5 }));
      labels.push(label(Geo.centroid(ring), el.label || "Do not use", el.id, { size: 12, color: "#ffffff" }));
    } else if (el.kind === "arrow") {
      const a = el.points[0], b = el.points[el.points.length - 1];
      shapes.push(lineFeat(el.points, el.id, { stroke: el.color, strokeW: el.width }));
      arrows.push({ type: "Feature", properties: { eid: el.id, color: el.color, rot: Geo.bearingDeg(a, b) }, geometry: { type: "Point", coordinates: b } });
      if (el.label) labels.push(label(a, el.label, el.id, { size: 14, color: el.color }));
    } else if (el.kind === "line") {
      shapes.push(lineFeat(el.points, el.id, { stroke: el.color, strokeW: el.width }));
      if (el.label) labels.push(label(el.points[0], el.label, el.id, { size: 13, color: el.color }));
    } else if (el.kind === "text") {
      labels.push(label(el.center, el.text, el.id, { size: el.size || 18, color: el.color }));
    } else if (el.kind === "place") {
      const color = PLAY_COLOR[el.play] || PLAY_COLOR.game;
      const lp = el.label || el.center; // pin is fixed at center; only the label moves
      if (el.label && Geo.distanceM(el.center, el.label) > 2) shapes.push(lineFeat([el.center, el.label], el.id, { stroke: "#444", strokeW: 1 }));
      markers.push({ type: "Feature", properties: { eid: el.id, color, code: "", r: 5, sw: 1.5 }, geometry: { type: "Point", coordinates: el.center } });
      if (el.name) labels.push(label(lp, el.name, el.id, { size: 13, color: "#ffffff" }));
    } else if (el.kind === "marker") {
      const t = MARKER_TYPES[el.type];
      markers.push({ type: "Feature", properties: { eid: el.id, color: t.color, code: t.code, rot: el.rotationDeg || 0 }, geometry: { type: "Point", coordinates: el.center } });
    }
  });

  // Selection handles — none for locked elements (can't move/resize on the map).
  const sel = byId(state.selectedId);
  if (sel && !sel.locked) {
    if (sel.kind === "field" || sel.kind === "grid" || sel.kind === "nogo") {
      const ring = Geo.rectRing(sel.center, sel.widthM, sel.lengthM, sel.rotationDeg);
      for (let i = 0; i < 4; i++) handles.push(handle(ring[i], sel.id, "corner", i));
      const rot = Geo.rotateOffset(0, sel.lengthM / 2 + 18, sel.rotationDeg);
      handles.push(handle(Geo.destination(sel.center, rot[0], rot[1]), sel.id, "rotate"));
    } else if (sel.kind === "line" || sel.kind === "arrow") {
      sel.points.forEach((p, i) => handles.push(handle(p, sel.id, "vertex", i)));
    } else if (sel.kind === "fan") {
      handles.push(handle(Geo.fanArcPoint(sel.center, sel.radiusM, sel.startDeg, sel.sweepDeg), sel.id, "fanarc"));
      handles.push(handle(Geo.fanArcPoint(sel.center, sel.innerRadiusM, sel.startDeg, sel.sweepDeg), sel.id, "faninner"));
    } else if (sel.kind === "infield") {
      handles.push(handle(Geo.fanArcPoint(sel.center, sel.radiusM, sel.startDeg, sel.sweepDeg), sel.id, "fanarc"));
    } else if (sel.kind === "marker" && MARKER_TYPES[sel.type].arrow) {
      handles.push(handle(Geo.fanArcPoint(sel.center, 12, sel.rotationDeg || 0, 0), sel.id, "markerrot"));
    }
  }

  setData("shapes", shapes); setData("sidelines", sidelines);
  setData("labels", labels); setData("markers", markers); setData("arrows", arrows); setData("handles", handles);
  if (state.frameBox) updateReservedZones(state.frameBox); // legend size tracks marker count
}
function rebuild() { rebuildMap(); renderSelPanel(); renderElemList(); }
function setData(id, features) { const s = map.getSource(id); if (s) s.setData(fc(features)); }
function poly(ring, eid, props) { return { type: "Feature", properties: { eid, ...props }, geometry: { type: "Polygon", coordinates: [ring] } }; }
function lineFeat(pts, eid, props) { return { type: "Feature", properties: { eid, ...props }, geometry: { type: "LineString", coordinates: pts } }; }
function label(coord, text, eid, props) { return { type: "Feature", properties: { eid, text, ...props }, geometry: { type: "Point", coordinates: coord } }; }
function handle(coord, eid, role, idx) { return { type: "Feature", properties: { eid, role, idx }, geometry: { type: "Point", coordinates: coord } }; }

// ─── Selection + panels ─────────────────────────────────────────────────────
function byId(id) { return state.elements.find((e) => e.id === id); }
function select(id) { state.selectedId = id; rebuild(); }

// ─── Undo / redo (element-state snapshots) ──────────────────────────────────
let snapTimer = null;
function snapshot(immediate) {
  clearTimeout(snapTimer);
  const take = () => {
    const snap = JSON.stringify(state.elements);
    if (state.history[state.histIndex] === snap) return; // no-op change
    state.history = state.history.slice(0, state.histIndex + 1);
    state.history.push(snap);
    if (state.history.length > 60) state.history.shift();
    state.histIndex = state.history.length - 1;
    updateUndoButtons();
  };
  if (immediate) take(); else snapTimer = setTimeout(take, 600); // debounce typing
}
function resetHistory() { state.history = [JSON.stringify(state.elements)]; state.histIndex = 0; updateUndoButtons(); }
function restoreHistory() { state.elements = JSON.parse(state.history[state.histIndex]); state.selectedId = null; rebuild(); updateUndoButtons(); }
function undo() { clearTimeout(snapTimer); if (state.histIndex > 0) { state.histIndex--; restoreHistory(); } }
function redo() { if (state.histIndex < state.history.length - 1) { state.histIndex++; restoreHistory(); } }
function updateUndoButtons() {
  const u = document.getElementById("undoBtn"), r = document.getElementById("redoBtn");
  if (u) u.disabled = state.histIndex <= 0;
  if (r) r.disabled = state.histIndex >= state.history.length - 1;
}

function renderSelPanel() {
  const wrap = document.getElementById("selWrap"), panel = document.getElementById("selPanel");
  const el = byId(state.selectedId);
  if (!el) { wrap.hidden = true; panel.innerHTML = ""; return; }
  wrap.hidden = false;
  let html = "";
  if (el.kind === "field") {
    const dims = `≈ ${el.widthM}×${el.lengthM} m`;
    html = `
      <div class="field-row"><label class="block">Name<input data-k="name" value="${esc(el.name)}" placeholder="e.g. VP1"></label>
      <label class="block">Age<input data-k="ageGroup" value="${esc(el.ageGroup)}" placeholder="e.g. 10U"></label></div>
      <label class="block">Field size (by age)<select data-k="preset">${presetOpts(el.preset)}</select></label>
      <div class="field-row"><label class="block">Width m<input type="number" data-k="widthM" value="${el.widthM}"></label>
      <label class="block">Length m<input type="number" data-k="lengthM" value="${el.lengthM}"></label></div>
      <label class="block">Rotation °<input type="number" data-k="rotationDeg" value="${el.rotationDeg}"></label>
      <label class="inline"><input type="checkbox" data-k="markHome" ${el.markHome ? "checked" : ""}> Mark HOME/AWAY sidelines</label>
      <p class="hint">${dims}. HOME = north/west side, AWAY = east/south (auto).</p>`;
  } else if (el.kind === "grid") {
    html = `
      <label class="block">Area name<input data-k="name" value="${esc(el.name)}" placeholder="e.g. Victory-Upper"></label>
      <div class="field-row"><label class="block">Columns<input type="number" min="1" data-k="cols" value="${el.cols}"></label>
      <label class="block">Rows<input type="number" min="1" data-k="rows" value="${el.rows}"></label></div>
      <div class="field-row"><label class="block">Labels<select data-k="scheme"><option value="letters"${el.scheme==="letters"?" selected":""}>A, B, C…</option><option value="numbers"${el.scheme==="numbers"?" selected":""}>1, 2, 3…</option></select></label>
      <label class="block">Start #<input type="number" data-k="startIndex" value="${el.startIndex}"></label></div>
      <div class="field-row"><label class="block">Width m<input type="number" data-k="widthM" value="${el.widthM}"></label>
      <label class="block">Length m<input type="number" data-k="lengthM" value="${el.lengthM}"></label></div>
      <label class="block">Rotation °<input type="number" data-k="rotationDeg" value="${el.rotationDeg}"></label>`;
  } else if (el.kind === "fan") {
    html = `
      <label class="block">Area name<input data-k="name" value="${esc(el.name)}" placeholder="e.g. Allendale outfield"></label>
      <div class="field-row"><label class="block">Sections<input type="number" min="1" data-k="wedges" value="${el.wedges}"></label>
      <label class="block">Labels<select data-k="scheme">
        <option value="lcr"${el.scheme==="lcr"?" selected":""}>Left / Center / Right</option>
        <option value="letters"${el.scheme==="letters"?" selected":""}>A, B, C…</option>
        <option value="numbers"${el.scheme==="numbers"?" selected":""}>1, 2, 3…</option></select></label></div>
      <div class="field-row"><label class="block">Outer radius m<input type="number" data-k="radiusM" value="${el.radiusM}"></label>
      <label class="block">Infield radius m<input type="number" data-k="innerRadiusM" value="${el.innerRadiusM}"></label></div>
      <label class="block">Sweep °<input type="number" data-k="sweepDeg" value="${el.sweepDeg}"></label>
      <p class="hint">Outer handle = size + direction; inner handle = infield edge. Left/Center/Right are from the home-plate view; the infield is marked off-limits.</p>`;
  } else if (el.kind === "infield") {
    html = `
      <div class="field-row"><label class="block">Radius m<input type="number" data-k="radiusM" value="${el.radiusM}"></label>
      <label class="block">Sweep °<input type="number" data-k="sweepDeg" value="${el.sweepDeg}"></label></div>
      <p class="hint">Drag the arc handle to size + aim the off-limits infield. Sweep 90° = a quarter (a typical baseball infield). Apex = home plate.</p>`;
  } else if (el.kind === "nogo") {
    html = `<label class="block">Label<input data-k="label" value="${esc(el.label)}" placeholder="Do not use"></label>
      <div class="field-row"><label class="block">Width m<input type="number" data-k="widthM" value="${el.widthM}"></label>
      <label class="block">Length m<input type="number" data-k="lengthM" value="${el.lengthM}"></label></div>
      <label class="block">Rotation °<input type="number" data-k="rotationDeg" value="${el.rotationDeg}"></label>
      <p class="hint">A cross-hatched out-of-bounds box. Drag corners to resize, top handle to rotate.</p>`;
  } else if (el.kind === "arrow") {
    html = `<label class="block">Label (optional)<input data-k="label" value="${esc(el.label)}" placeholder="e.g. Walk this way"></label>
      <label class="block">Color<input type="color" data-k="color" value="${el.color}"></label>
      <label class="block">Thickness<input type="number" data-k="width" value="${el.width}"></label>
      <p class="hint">Drag the two endpoint handles to size + aim the arrow (it points toward the second end).</p>`;
  } else if (el.kind === "line") {
    html = `<label class="block">Label<input data-k="label" value="${esc(el.label)}"></label>
      <label class="block">Color<input type="color" data-k="color" value="${el.color}"></label>
      <label class="block">Width<input type="number" data-k="width" value="${el.width}"></label>
      <p class="hint">Drag the endpoint handles to reshape.</p>`;
  } else if (el.kind === "text") {
    html = `<label class="block">Text<input data-k="text" value="${esc(el.text)}"></label>
      <label class="block">Color<input type="color" data-k="color" value="${el.color}"></label>
      <label class="block">Size<input type="number" data-k="size" value="${el.size}"></label>`;
  } else if (el.kind === "place") {
    html = `<label class="block">Field name<input data-k="name" value="${esc(el.name)}"></label>
      <label class="block">Type<select data-k="play">
        <option value="game"${el.play==="game"?" selected":""}>Game field (red)</option>
        <option value="practice"${el.play==="practice"?" selected":""}>Practice field (dark red)</option>
        <option value="both"${el.play==="both"?" selected":""}>Game &amp; practice</option></select></label>
      <p class="hint">The pin stays at the field's location; drag the label to move it. Edit the name to keep it short.</p>`;
  } else if (el.kind === "marker") {
    html = `<p>${MARKER_TYPES[el.type].name}</p><p class="hint">Drag to reposition.</p>`;
  }
  html += `<label class="inline" style="margin-top:.5rem"><input type="checkbox" data-k="locked" ${el.locked ? "checked" : ""}> 🔒 Lock — freeze on map (edit fields on top of it)</label>`;
  html += `<button type="button" class="del" id="delSel">Delete element</button>`;
  panel.innerHTML = html;
  panel.querySelectorAll("[data-k]").forEach((inp) => inp.addEventListener("input", () => applyField(el, inp)));
  const del = document.getElementById("delSel");
  if (del) del.addEventListener("click", () => { state.elements = state.elements.filter((x) => x.id !== el.id); select(null); snapshot(true); });
}

function applyField(el, inp) {
  const k = inp.dataset.k;
  let v = inp.type === "checkbox" ? inp.checked : (inp.type === "number" ? Number(inp.value) : inp.value);
  // Choosing an age size preset sets the field size AND auto-labels by age.
  // It changes other panel inputs, so it's the one case that re-renders the panel.
  if (k === "preset" && FIELD_PRESETS[v]) {
    el.preset = v; el.widthM = FIELD_PRESETS[v][0]; el.lengthM = FIELD_PRESETS[v][1]; el.ageGroup = v;
    rebuild();
    snapshot(false);
    return;
  }
  // Every other edit (text/number/checkbox/select): update the element and the
  // map, but DON'T re-render the side panel — re-rendering destroys the <input>
  // and drops focus mid-keystroke. renderElemList is safe (separate elements).
  el[k] = v;
  rebuildMap();
  renderElemList();
  snapshot(false);
}
function presetOpts(cur) {
  return Object.keys(FIELD_PRESETS).map((k) => `<option value="${k}"${cur===k?" selected":""}>${k} — ${FIELD_PRESETS[k][0]}×${FIELD_PRESETS[k][1]} m</option>`).join("") +
    `<option value="custom"${cur==="custom"?" selected":""}>Custom size</option>`;
}

function renderElemList() {
  const list = document.getElementById("elemList");
  if (!state.elements.length) { list.innerHTML = '<p class="subtle">None yet.</p>'; return; }
  list.innerHTML = "";
  state.elements.forEach((el) => {
    const name = el.kind === "field" ? ("Field " + (el.name || el.ageGroup || "")).trim()
      : el.kind === "grid" ? ("Grid " + (el.name || `${el.cols}×${el.rows}`))
      : el.kind === "fan" ? ("Fan " + (el.name || `${el.wedges}-section`))
      : el.kind === "infield" ? "Infield warning"
      : el.kind === "nogo" ? (el.label || "Do not use")
      : el.kind === "arrow" ? ("Arrow" + (el.label ? " — " + el.label : ""))
      : el.kind === "line" ? "Line"
      : el.kind === "text" ? `“${el.text}”`
      : el.kind === "place" ? `📍 ${el.name || "pin"}`
      : MARKER_TYPES[el.type].name;
    const row = document.createElement("div");
    row.className = "item" + (el.id === state.selectedId ? " sel" : "");
    row.innerHTML = `<span class="grow">${esc(name)}</span>` +
      `<button class="lockbtn${el.locked ? " locked" : ""}" data-lock="${el.id}" title="${el.locked ? "Unlock (allow moving/resizing)" : "Lock (freeze on map)"}">${el.locked ? "🔒" : "🔓"}</button>` +
      `<button class="del" data-del="${el.id}">✕</button>`;
    row.querySelector(".grow").addEventListener("click", () => select(el.id));
    row.querySelector("[data-lock]").addEventListener("click", () => { const m = byId(el.id); if (m) { m.locked = !m.locked; rebuild(); snapshot(true); } });
    row.querySelector("[data-del]").addEventListener("click", () => { state.elements = state.elements.filter((x) => x.id !== el.id); if (state.selectedId === el.id) select(null); else rebuild(); snapshot(true); });
    list.appendChild(row);
  });
}

// ─── Framing guide ──────────────────────────────────────────────────────────
// The dashed box is a fixed on-screen crop: pan the map to position it, drag the
// corner grip to grow it right/down from a fixed TOP-LEFT. The export center is
// the box's center (not the map center). The meters field is a live readout of
// the box's ground width at the current zoom (and resizes the box when typed).
function clampMeters(m) { return Math.max(40, Math.min(state.overview ? 40000 : 1200, m || 200)); }
function mppNow() {
  const lat = map.getCenter().lat;
  return EARTH_CIRCUMFERENCE * Math.cos((lat * Math.PI) / 180) / (TILE * Math.pow(2, map.getZoom()));
}
function ensureFrameBox() {
  if (state.frameBox) return;
  const rect = document.getElementById("map").getBoundingClientRect();
  const w = clampMeters(Number(document.getElementById("frameMeters").value)) / mppNow();
  const h = w * (OUT_H / OUT_W);
  state.frameBox = { x: Math.max(8, (rect.width - w) / 2), y: Math.max(8, (rect.height - h) / 2), w: w, h: h };
}
function applyFrameBox() {
  // Locked → the box is pinned to ground coordinates: reproject its NW/SE
  // corners every frame so it tracks zoom and pan. Unlocked → screen-anchored.
  if (state.frameLocked && state.frameGeo) {
    const pNW = map.project(state.frameGeo.nw);
    const pSE = map.project(state.frameGeo.se);
    state.frameBox = { x: pNW.x, y: pNW.y, w: pSE.x - pNW.x, h: pSE.y - pNW.y };
  } else {
    ensureFrameBox();
  }
  const b = state.frameBox, el = document.getElementById("frameBox");
  el.style.left = b.x + "px"; el.style.top = b.y + "px";
  el.style.width = b.w + "px"; el.style.height = b.h + "px";
  updateReservedZones(b);
}

// Show where the export title + legend will sit (scaled to the frame), so the
// user avoids placing elements under them. Sizes mirror the export layout.
function updateReservedZones(b) {
  const sx = b.w / OUT_W, sy = b.h / OUT_H;
  const title = document.getElementById("titleZone");
  if (title) {
    title.style.left = 12 * sx + "px"; title.style.top = 12 * sy + "px";
    title.style.width = 320 * sx + "px"; title.style.height = 58 * sy + "px";
  }
  const legend = document.getElementById("legendZone");
  if (legend) {
    const types = new Set(state.elements.filter((e) => e.kind === "marker").map((e) => e.type)).size;
    let items = types + (state.elements.some((e) => e.kind === "field" && e.markHome) ? 2 : 0);
    if (items === 0) { legend.style.display = "none"; }
    else {
      legend.style.display = "flex";
      const hLogical = items * 24 + 24, wLogical = 210;
      legend.style.left = 12 * sx + "px";
      legend.style.top = (OUT_H - 12 - hLogical) * sy + "px";
      legend.style.width = wLogical * sx + "px"; legend.style.height = hLogical * sy + "px";
    }
  }
}
function syncMetersReadout() {
  if (state.frameBox) document.getElementById("frameMeters").value = clampMeters(Math.round(state.frameBox.w * mppNow() / 10) * 10);
}
// Map move/zoom: reposition box on screen unchanged, refresh the meters readout.
function refreshFrameBox() { if (!map) return; applyFrameBox(); syncMetersReadout(); }
// Lock the export frame so the corner grip and meters field can't change it.
function syncFrameLockUI() {
  const locked = state.frameLocked;
  const btn = document.getElementById("frameLockBtn");
  btn.textContent = locked ? "🔒 Frame" : "🔓 Frame";
  btn.classList.toggle("active", locked);
  document.getElementById("frameHandle").style.display = locked ? "none" : "block";
  document.getElementById("frameMeters").disabled = locked;
  document.getElementById("frameBox").classList.toggle("locked", locked);
}
function toggleFrameLock() {
  state.frameLocked = !state.frameLocked;
  if (state.frameLocked) {
    // Pin to ground: capture the current box's geographic corners.
    ensureFrameBox();
    const b = state.frameBox;
    const nw = map.unproject([b.x, b.y]);
    const se = map.unproject([b.x + b.w, b.y + b.h]);
    state.frameGeo = { nw: [nw.lng, nw.lat], se: [se.lng, se.lat] };
  } else {
    // Release to screen-anchored, keeping its current on-screen position.
    state.frameGeo = null;
  }
  syncFrameLockUI();
  applyFrameBox();
}

// Resize the box from a typed meters value, keeping the top-left fixed.
function setFrameMeters(m) {
  ensureFrameBox();
  state.frameBox.w = clampMeters(m) / mppNow();
  state.frameBox.h = state.frameBox.w * (OUT_H / OUT_W);
  applyFrameBox();
}

// ─── Export ─────────────────────────────────────────────────────────────────
async function doExport(commit) {
  if (!state.field) return toast("Pick a field first.", "error");
  state.tool = null; clearToolBtns();
  // Export captures exactly the dashed crop box: center = box center, width =
  // box ground width at the current zoom.
  ensureFrameBox();
  const b = state.frameBox;
  const cc = map.unproject([b.x + b.w / 2, b.y + b.h / 2]);
  const center = [cc.lng, cc.lat];
  const meters = clampMeters(Math.round(b.w * mppNow()));
  const zoom = Geo.zoomForGroundWidth(center[1], meters, OUT_W);

  modal(true, "Rendering…", '<p class="subtle">Fetching satellite base and compositing…</p>');
  let dataUrl;
  try { dataUrl = await renderPng(center, zoom); }
  catch (e) { modal(false); return toast("Render failed: " + e.message, "error"); }

  if (!commit) {
    modal(true, "Export preview", `<img src="${dataUrl}" alt="preview"><p class="hint">${OUT_W*SCALE}×${OUT_H*SCALE}px. Looks right? Click Save to staging.</p>`);
    return;
  }
  const annotation = {
    label: document.getElementById("variantLabel").value.trim() || undefined,
    styleVersion: currentStyle(),
    view: { center, zoom, bearing: 0, frameMeters: meters, width: OUT_W, height: OUT_H, scale: SCALE },
    elements: state.elements,
    alt: state.overview
      ? "AYSO Region 13 field locations across Pasadena, Altadena, and La Cañada Flintridge"
      : `${state.field.title} ${state.variant} field map`,
  };
  modal(true, "Saving…", '<p class="subtle">Committing PNG + annotation JSON to staging…</p>');
  try {
    const res = await api("/api/map/" + state.field.slug, { method: "POST", body: { variant: state.variant, pngBase64: dataUrl, annotation } });
    modal(false);
    toast(`Saved (${res.commit.slice(0, 7)}). Preview rebuilds in ~1–2 min at field-maps.ayso-website-staging.pages.dev.`, "success");
    const f = state.fields.find((x) => x.slug === state.field.slug); if (f) f.hasMap = true;
    // Refresh the cached doc + layout list so a newly-saved named layout sticks.
    // (Overview has a single fixed "map" layout — keep its variant list as-is.)
    state.doc = await fetchDoc(state.field.slug);
    if (!state.overview) { buildVariantList(); populateVariantSelect(); }
  } catch (e) { modal(false); toast("Save failed: " + e.message, "error"); }
}

async function renderPng(center, zoom) {
  const token = encodeURIComponent(state.config.mapboxToken);
  const url = `https://api.mapbox.com/styles/v1/mapbox/${currentStyle()}/static/` +
    `${center[0].toFixed(6)},${center[1].toFixed(6)},${zoom.toFixed(3)},0/${OUT_W}x${OUT_H}@2x` +
    `?access_token=${token}&attribution=true&logo=true`;
  const base = await loadImage(url);
  const canvas = document.createElement("canvas");
  canvas.width = OUT_W * SCALE; canvas.height = OUT_H * SCALE;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(base, 0, 0, canvas.width, canvas.height);
  const project = Geo.projector(center, zoom, OUT_W, OUT_H, SCALE);

  state.elements.forEach((el) => drawElement(ctx, project, el));
  drawTitle(ctx);
  drawLegend(ctx);
  return canvas.toDataURL("image/png");
}

function drawElement(ctx, project, el) {
  if (el.kind === "field") {
    const ring = Geo.rectRing(el.center, el.widthM, el.lengthM, el.rotationDeg);
    fillStrokeRing(ctx, project, ring, "rgba(247,75,75,0.14)", "#ffffff", 3, "#83312d");
    drawMarkings(ctx, project, Geo.fieldMarkings(el.center, el.widthM, el.lengthM, el.rotationDeg));
    if (el.markHome) {
      const ha = Geo.homeAway(ring);
      if (ha) {
        strokeSeg(ctx, project, ha.home.a, ha.home.b, HOME_COLOR, 7);
        strokeSeg(ctx, project, ha.away.a, ha.away.b, AWAY_COLOR, 6);
        // Labels run ALONG each touchline (rotated) so they don't overlap the
        // field interior — important on small fields.
        sidelineLabel(ctx, project, ha.home.a, ha.home.b, "HOME", HOME_COLOR, HOME_TEXT);
        sidelineLabel(ctx, project, ha.away.a, ha.away.b, "AWAY", AWAY_COLOR, AWAY_TEXT);
      }
    }
    const t = [el.name, el.ageGroup].filter(Boolean).join("  ");
    if (t) { const c = Geo.centroid(ring); textBox(ctx, project(c[0], c[1]), t, { size: 16 * SCALE, bg: "rgba(58,13,18,0.82)", fg: "#fff", center: true }); }
  } else if (el.kind === "grid") {
    const cells = Geo.gridCells(el.center, el.widthM, el.lengthM, el.rotationDeg, el.cols, el.rows);
    cells.forEach((cell) => {
      fillStrokeRing(ctx, project, cell.ring, "rgba(244,189,77,0.16)", "#f4bd4d", 2.5, null);
      const p = project(cell.center[0], cell.center[1]);
      ctx.fillStyle = "#fff8e6"; ctx.font = `bold ${17 * SCALE}px -apple-system, Arial, sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.lineWidth = 3 * SCALE; ctx.strokeStyle = "rgba(0,0,0,0.55)";
      const lbl = Geo.cellLabel(cell.index, el.scheme, el.startIndex);
      ctx.strokeText(lbl, p.x, p.y); ctx.fillText(lbl, p.x, p.y);
    });
    if (el.name) {
      const ring = Geo.rectRing(el.center, el.widthM, el.lengthM, el.rotationDeg);
      const m = Geo.midpoint(ring[0], ring[1]);
      textBox(ctx, project(m[0], m[1]), el.name, { size: 15 * SCALE, bg: "rgba(58,13,18,0.82)", fg: "#fff8e6", center: true });
    }
  } else if (el.kind === "fan") {
    const cells = Geo.fanCells(el.center, el.innerRadiusM, el.radiusM, el.startDeg, el.sweepDeg, el.wedges);
    cells.forEach((cell) => {
      fillStrokeRing(ctx, project, cell.ring, "rgba(244,189,77,0.16)", "#f4bd4d", 2.5, null);
      const p = project(cell.center[0], cell.center[1]);
      ctx.fillStyle = "#fff8e6"; ctx.font = `bold ${15 * SCALE}px -apple-system, Arial, sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.lineWidth = 3 * SCALE; ctx.strokeStyle = "rgba(0,0,0,0.55)";
      const lbl = fanLabel(el, cell.index);
      ctx.strokeText(lbl, p.x, p.y); ctx.fillText(lbl, p.x, p.y);
    });
    drawInfield(ctx, project, Geo.fanInfield(el.center, el.innerRadiusM, el.startDeg, el.sweepDeg));
    if (el.name) { const np = Geo.fanArcPoint(el.center, el.radiusM * 1.12, el.startDeg, el.sweepDeg); textBox(ctx, project(np[0], np[1]), el.name, { size: 14 * SCALE, bg: "rgba(58,13,18,0.82)", fg: "#fff8e6", center: true }); }
  } else if (el.kind === "infield") {
    drawInfield(ctx, project, Geo.fanInfield(el.center, el.radiusM, el.startDeg, el.sweepDeg));
  } else if (el.kind === "nogo") {
    const ring = Geo.rectRing(el.center, el.widthM, el.lengthM, el.rotationDeg);
    drawHatchZone(ctx, project, ring, Geo.centroid(ring), el.label || "Do not use");
  } else if (el.kind === "line") {
    ctx.beginPath();
    el.points.forEach((pt, i) => { const p = project(pt[0], pt[1]); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); });
    ctx.lineCap = "round"; ctx.lineWidth = (el.width || 5) * SCALE; ctx.strokeStyle = el.color; ctx.stroke();
    if (el.label) { const p = project(el.points[0][0], el.points[0][1]); textBox(ctx, p, el.label, { size: 13 * SCALE, bg: "rgba(0,0,0,0.6)", fg: "#fff", left: true }); }
  } else if (el.kind === "arrow") {
    const a = project(el.points[0][0], el.points[0][1]);
    const b = project(el.points[el.points.length - 1][0], el.points[el.points.length - 1][1]);
    const w = (el.width || 7) * SCALE, head = w * 2.4;
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const bx = b.x - Math.cos(ang) * head * 0.8, by = b.y - Math.sin(ang) * head * 0.8; // shaft stops short of tip
    ctx.lineCap = "round"; ctx.lineWidth = w; ctx.strokeStyle = el.color;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(bx, by); ctx.stroke();
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(ang); ctx.fillStyle = el.color;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-head, -head * 0.6); ctx.lineTo(-head, head * 0.6); ctx.closePath(); ctx.fill();
    ctx.restore();
    if (el.label) textBox(ctx, a, el.label, { size: 14 * SCALE, bg: "rgba(255,255,255,0.95)", fg: el.color, center: true });
  } else if (el.kind === "text") {
    // Dark-red text on a white pill — reads clearly over grass/satellite.
    const p = project(el.center[0], el.center[1]);
    textBox(ctx, p, el.text, { size: (el.size || 18) * SCALE, bg: "rgba(255,255,255,0.95)", fg: el.color || "#83312d", center: true });
  } else if (el.kind === "place") {
    // Region-overview pin: a small teardrop pin whose TIP sits at the field's
    // coordinates; the name label can be dragged away (leader line) to declutter.
    const p = project(el.center[0], el.center[1]);
    const color = PLAY_COLOR[el.play] || PLAY_COLOR.game;
    const moved = el.label && Geo.distanceM(el.center, el.label) > 2;
    const lp = moved ? project(el.label[0], el.label[1]) : null;
    if (moved) { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(lp.x, lp.y); ctx.strokeStyle = "rgba(40,40,40,0.7)"; ctx.lineWidth = 1.2 * SCALE; ctx.stroke(); }
    const headY = drawPin(ctx, p.x, p.y, color); // returns head-center y
    if (el.name) {
      if (moved) textBox(ctx, lp, el.name, { size: 12 * SCALE, bg: "rgba(255,255,255,0.95)", fg: "#221f1f", center: true });
      else textBox(ctx, { x: p.x + 5 * SCALE + 4 * SCALE, y: headY }, el.name, { size: 12 * SCALE, bg: "rgba(255,255,255,0.95)", fg: "#221f1f", left: true });
    }
  } else if (el.kind === "marker") {
    const p = project(el.center[0], el.center[1]); const t = MARKER_TYPES[el.type]; const r = 19 * SCALE;
    // White badge with a colored ring; emoji glyph (or a rotatable arrow for the
    // entrance), and the name in an upright white pill to the right.
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill();
    ctx.lineWidth = 3 * SCALE; ctx.strokeStyle = t.color; ctx.stroke();
    if (t.arrow) {
      drawArrow(ctx, p.x, p.y, r, el.rotationDeg || 0, t.color);
    } else {
      ctx.font = `${24 * SCALE}px ${EMOJI_FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(t.emoji, p.x, p.y + SCALE);
    }
    textBox(ctx, { x: p.x + r + 5 * SCALE, y: p.y }, t.name, { size: 13 * SCALE, bg: "rgba(255,255,255,0.92)", fg: "#221f1f", left: true });
  }
}

function fillStrokeRing(ctx, project, ring, fill, stroke, w, inner) {
  ctx.beginPath();
  ring.forEach((c, i) => { const p = project(c[0], c[1]); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); });
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  ctx.lineWidth = w * SCALE; ctx.strokeStyle = stroke; ctx.stroke();
  if (inner) { ctx.lineWidth = 1.2 * SCALE; ctx.strokeStyle = inner; ctx.stroke(); }
}
function strokeSeg(ctx, project, a, b, color, w) {
  const pa = project(a[0], a[1]), pb = project(b[0], b[1]);
  ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y);
  ctx.lineCap = "round"; ctx.lineWidth = w * SCALE; ctx.strokeStyle = color; ctx.stroke();
}
// A small teardrop map-pin whose TIP sits at (x,y). Returns the head-center y so
// callers can align a label beside the head. Used for the region-overview pins.
function drawPin(ctx, x, y, color) {
  const r = 5 * SCALE, stem = 10 * SCALE, cy = y - stem - r;
  ctx.beginPath(); // pointer triangle from head bottom to the tip
  ctx.moveTo(x, y); ctx.lineTo(x - r * 0.72, cy + r * 0.55); ctx.lineTo(x + r * 0.72, cy + r * 0.55); ctx.closePath();
  ctx.fillStyle = color; ctx.fill();
  ctx.beginPath(); ctx.arc(x, cy, r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
  ctx.lineWidth = 1.4 * SCALE; ctx.strokeStyle = "#fff"; ctx.stroke();
  ctx.beginPath(); ctx.arc(x, cy, r * 0.42, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill();
  return cy;
}

// Fan wedge label: Left/Center/Right (home-plate view) or letters/numbers.
function fanLabel(el, index) {
  return el.scheme === "lcr" ? Geo.lcrLabel(index, el.wedges) : Geo.cellLabel(index, el.scheme, el.startIndex);
}

// Cross-hatched "Stay off the infield" no-go zone on export.
// Cross-hatched red "off-limits" zone for any ring (infield sector, no-go box…).
function drawHatchZone(ctx, project, ring, labelPoint, text) {
  const pts = ring.map((c) => project(c[0], c[1]));
  const trace = () => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); };
  ctx.save();
  trace();
  ctx.fillStyle = "rgba(209,19,19,0.16)"; ctx.fill();
  ctx.save();
  ctx.clip();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  pts.forEach((p) => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); });
  const span = maxY - minY, step = 11 * SCALE;
  ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 1.2 * SCALE;
  for (let x = minX - span; x < maxX; x += step) { ctx.beginPath(); ctx.moveTo(x, minY); ctx.lineTo(x + span, maxY); ctx.stroke(); }
  for (let x = minX; x < maxX + span; x += step) { ctx.beginPath(); ctx.moveTo(x, minY); ctx.lineTo(x - span, maxY); ctx.stroke(); }
  ctx.restore(); // remove clip (the hatch loop's beginPath replaced the path)
  trace();
  ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 2 * SCALE; ctx.stroke();
  ctx.restore();
  if (text) textBox(ctx, project(labelPoint[0], labelPoint[1]), text, { size: 12 * SCALE, bg: "rgba(142,41,41,0.92)", fg: "#fff", center: true });
}
function drawInfield(ctx, project, inf) { drawHatchZone(ctx, project, inf.ring, inf.center, "Stay off the infield"); }

// A filled arrow within a marker badge, pointing at `deg` (0 = north).
function drawArrow(ctx, cx, cy, r, deg, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.fillStyle = color;
  const s = r * 0.9;
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.lineTo(s * 0.6, -s * 0.05);
  ctx.lineTo(s * 0.24, -s * 0.05);
  ctx.lineTo(s * 0.24, s * 0.7);
  ctx.lineTo(-s * 0.24, s * 0.7);
  ctx.lineTo(-s * 0.24, -s * 0.05);
  ctx.lineTo(-s * 0.6, -s * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Thin white pitch markings (halfway line, center circle + dot, goals) on export.
function drawMarkings(ctx, project, mk) {
  ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 1.5 * SCALE; ctx.lineCap = "round";
  const line = (pts, close) => {
    ctx.beginPath();
    pts.forEach((c, i) => { const p = project(c[0], c[1]); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); });
    if (close) ctx.closePath();
    ctx.stroke();
  };
  line(mk.halfway, false);
  line(mk.circle, true);
  mk.goals.forEach((g) => line(g, true));
  const d = project(mk.dot[0], mk.dot[1]);
  ctx.beginPath(); ctx.arc(d.x, d.y, 2 * SCALE, 0, Math.PI * 2); ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.fill();
}

// A pill label centered on a touchline and rotated to run along it (kept upright).
function sidelineLabel(ctx, project, a, b, text, color, textColor) {
  const pa = project(a[0], a[1]), pb = project(b[0], b[1]);
  let angle = Math.atan2(pb.y - pa.y, pb.x - pa.x);
  if (angle > Math.PI / 2 || angle < -Math.PI / 2) angle += Math.PI; // never upside-down
  const mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2;
  const size = 13 * SCALE, padX = 7 * SCALE, padY = 4 * SCALE;
  ctx.save();
  ctx.translate(mx, my);
  ctx.rotate(angle);
  ctx.font = `bold ${size}px -apple-system, Arial, sans-serif`;
  const w = ctx.measureText(text).width, h = size + padY * 2;
  ctx.fillStyle = color;
  roundRect(ctx, -w / 2 - padX, -h / 2, w + padX * 2, h, 4 * SCALE); ctx.fill();
  ctx.fillStyle = textColor || "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function drawTitle(ctx) {
  const v = document.getElementById("variantLabel").value.trim() || (state.variant === "practice" ? "Practice" : "Game Day");
  const text = state.overview ? "AYSO Region 13 Fields" : `${state.field.title} — ${v}`;
  const pad = 10 * SCALE, x = 12 * SCALE, y = 12 * SCALE;
  ctx.font = `bold ${17 * SCALE}px -apple-system, Arial, sans-serif`;
  const textW = ctx.measureText(text).width;
  const logo = state.logo;
  const logoH = 32 * SCALE;
  // Region 13 logo is ~square; fall back to square if the SVG reports no size.
  const logoW = (logo && logo.naturalWidth && logo.naturalHeight) ? logoH * (logo.naturalWidth / logo.naturalHeight) : (logo ? logoH : 0);
  const gap = logoW ? 9 * SCALE : 0;
  const pillH = logoH + pad;
  const pillW = pad * 2 + logoW + gap + textW;
  // White pill reads clearly on grass; logo sits on its natural white; maroon text on white clears AA.
  ctx.fillStyle = "rgba(255,255,255,0.96)";
  roundRect(ctx, x, y, pillW, pillH, 8 * SCALE); ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.18)"; ctx.lineWidth = 1 * SCALE; ctx.stroke();
  let tx = x + pad;
  if (logoW) { ctx.drawImage(logo, tx, y + (pillH - logoH) / 2, logoW, logoH); tx += logoW + gap; }
  ctx.fillStyle = "#8e2929"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
  ctx.fillText(text, tx, y + pillH / 2);
}

function drawLegend(ctx) {
  const items = [];
  if (state.overview) {
    // Game/practice color key for the region overview pins.
    const plays = new Set(state.elements.filter((e) => e.kind === "place").map((e) => (e.play === "practice" ? "practice" : "game")));
    if (plays.has("game")) items.push({ dot: PLAY_COLOR.game, name: "Game field" });
    if (plays.has("practice")) items.push({ dot: PLAY_COLOR.practice, name: "Practice field" });
  } else {
    const markerTypes = [...new Set(state.elements.filter((e) => e.kind === "marker").map((e) => e.type))];
    markerTypes.forEach((t) => items.push({ emoji: MARKER_TYPES[t].emoji, name: MARKER_TYPES[t].name }));
    if (state.elements.some((e) => e.kind === "field" && e.markHome)) {
      items.push({ line: HOME_COLOR, name: "Home sideline" });
      items.push({ line: AWAY_COLOR, name: "Away sideline" });
    }
  }
  if (!items.length) return;
  const lh = 24 * SCALE, padX = 12 * SCALE, padY = 10 * SCALE;
  const boxW = 190 * SCALE, boxH = items.length * lh + padY * 2 - 4 * SCALE;
  const x = 12 * SCALE, y = ctx.canvas.height - boxH - 12 * SCALE;
  ctx.fillStyle = "rgba(255,255,255,0.92)"; roundRect(ctx, x, y, boxW, boxH, 6 * SCALE); ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.15)"; ctx.lineWidth = 1 * SCALE; ctx.stroke();
  items.forEach((it, i) => {
    const cy = y + padY + i * lh + lh / 2;
    if (it.dot) {
      ctx.fillStyle = it.dot; ctx.beginPath(); ctx.arc(x + padX + 8 * SCALE, cy, 6 * SCALE, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5 * SCALE; ctx.stroke();
    } else if (it.line) {
      ctx.strokeStyle = it.line; ctx.lineWidth = 5 * SCALE; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(x + padX, cy); ctx.lineTo(x + padX + 16 * SCALE, cy); ctx.stroke();
    } else {
      ctx.font = `${15 * SCALE}px ${EMOJI_FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(it.emoji, x + padX + 8 * SCALE, cy);
    }
    ctx.fillStyle = "#221f1f"; ctx.font = `${12 * SCALE}px -apple-system, Arial, sans-serif`; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText(it.name, x + padX + 24 * SCALE, cy);
  });
}

function textBox(ctx, p, text, opts) {
  ctx.font = `bold ${opts.size}px -apple-system, Arial, sans-serif`;
  const w = ctx.measureText(text).width, padX = 6 * SCALE, padY = 4 * SCALE, h = opts.size + padY * 2;
  let bx = opts.center ? p.x - (w / 2 + padX) : p.x;
  const by = p.y - h / 2;
  ctx.fillStyle = opts.bg; roundRect(ctx, bx, by, w + padX * 2, h, 4 * SCALE); ctx.fill();
  ctx.fillStyle = opts.fg; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(text, bx + padX, p.y);
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image(); img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load Mapbox satellite image (check token + URL restriction)."));
    img.src = src;
  });
}

// ─── Misc ──────────────────────────────────────────────────────────────────
function updateFilename() {
  document.getElementById("filenamePreview").textContent = state.field ? `images/fields/${state.field.slug}-${state.variant}.png` : "—";
}
function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function modal(show, title, body) {
  const m = document.getElementById("modal");
  if (!show) { m.hidden = true; return; }
  document.getElementById("modalTitle").textContent = title || "";
  document.getElementById("modalBody").innerHTML = body || "";
  m.hidden = false;
}
let toastTimer;
function toast(msg, kind) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.className = "toast" + (kind ? " " + kind : ""); t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, kind === "success" ? 8000 : 5000);
}
async function api(path, opts = {}) {
  const res = await fetch(path, { method: opts.method || "GET", headers: opts.body ? { "Content-Type": "application/json" } : undefined, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch (_) { data = { error: text }; }
  if (!res.ok) throw new Error(data.error || res.status);
  return data;
}
