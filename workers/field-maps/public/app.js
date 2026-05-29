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
  goal:     { color: "#2f6fed", code: "G", name: "Goal" },
  restroom: { color: "#6b3fa0", code: "R", name: "Restroom" },
  parking:  { color: "#1f8a4c", code: "P", name: "Parking" },
  tent:     { color: "#d11313", code: "T", name: "Field Host Tent" },
  checkin:  { color: "#d11313", code: "C", name: "Picture-Day Check-in" },
};
const FIELD_PRESETS = {
  "4v4":  [18, 27], "5v5": [23, 35], "7v7": [37, 55],
  "9v9":  [46, 73], "11v11": [64, 100],
};
const HOME_COLOR = "#2f6fed", AWAY_COLOR = "#d98324";

const state = {
  config: null, fields: [], field: null, variant: "game",
  elements: [], selectedId: null, tool: null,
  drag: null, seq: 1,
};
let map;

init().catch((e) => { console.error(e); toast("Failed to start: " + e.message, "error"); });

async function init() {
  state.config = await api("/api/config");
  if (!state.config.mapboxToken) throw new Error("Mapbox token not configured (MAPBOX_TOKEN_PUBLIC).");
  document.getElementById("who").textContent = state.config.editor || "";

  mapboxgl.accessToken = state.config.mapboxToken;
  map = new mapboxgl.Map({
    container: "map", style: "mapbox://styles/mapbox/" + STYLE,
    center: [-118.1445, 34.1478], zoom: 15,
  });
  map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-left");

  map.on("load", () => {
    addSrc("shapes"); addSrc("sidelines"); addSrc("labels"); addSrc("markers"); addSrc("handles");
    map.addLayer({ id: "shapes-fill", type: "fill", source: "shapes",
      filter: ["==", ["geometry-type"], "Polygon"],
      paint: { "fill-color": ["coalesce", ["get", "fill"], "#f74b4b"], "fill-opacity": 0.2 } });
    map.addLayer({ id: "shapes-line", type: "line", source: "shapes",
      paint: { "line-color": ["coalesce", ["get", "stroke"], "#ffffff"], "line-width": ["coalesce", ["get", "strokeW"], 2] } });
    map.addLayer({ id: "sidelines", type: "line", source: "sidelines",
      paint: { "line-color": ["get", "color"], "line-width": ["coalesce", ["get", "w"], 5] } });
    map.addLayer({ id: "markers-c", type: "circle", source: "markers",
      paint: { "circle-radius": 9, "circle-color": ["get", "color"], "circle-stroke-width": 2, "circle-stroke-color": "#fff" } });
    map.addLayer({ id: "markers-code", type: "symbol", source: "markers",
      layout: { "text-field": ["get", "code"], "text-size": 11, "text-allow-overlap": true },
      paint: { "text-color": "#fff" } });
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
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { state.tool = null; select(null); setHint("Click a tool, then click the map. Esc cancels."); } });

  wireUi();
  await loadFields();
}

function addSrc(id) { map.addSource(id, { type: "geojson", data: fc([]) }); }
function fc(features) { return { type: "FeatureCollection", features }; }

// ─── UI wiring ─────────────────────────────────────────────────────────────
function wireUi() {
  document.getElementById("fieldSelect").addEventListener("change", (e) => selectField(e.target.value));
  document.getElementById("variantSelect").addEventListener("change", (e) => { state.variant = e.target.value; if (state.field) loadVariant(); updateFilename(); });
  document.getElementById("frameMeters").addEventListener("input", refreshFrameBox);
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

// ─── Fields ──────────────────────────────────────────────────────────────────
async function loadFields() {
  state.fields = await api("/api/fields");
  const sel = document.getElementById("fieldSelect");
  sel.innerHTML = '<option value="">— choose a field —</option>' +
    state.fields.map((f) => `<option value="${esc(f.slug)}">${esc(f.title)}${f.hasMap ? " ✓" : ""}</option>`).join("");
}
async function selectField(slug) {
  state.tool = null;
  state.field = state.fields.find((f) => f.slug === slug) || null;
  document.getElementById("saveBtn").disabled = !state.field;
  if (!state.field) return;
  recenter();
  await loadVariant();
  updateFilename();
}
function recenter() { if (state.field) { map.jumpTo({ center: [state.field.lon, state.field.lat], zoom: 17 }); refreshFrameBox(); } }

async function loadVariant() {
  state.elements = []; select(null);
  document.getElementById("variantLabel").value = "";
  let doc = null;
  try { doc = await api("/api/map/" + state.field.slug); } catch (_) {}
  const v = doc && doc.variants && doc.variants[state.variant];
  if (v) {
    if (v.view && v.view.center) map.jumpTo({ center: v.view.center, zoom: v.view.zoom || 17 });
    if (v.view && v.view.frameMeters) document.getElementById("frameMeters").value = v.view.frameMeters;
    if (v.label) document.getElementById("variantLabel").value = v.label;
    if (Array.isArray(v.elements)) state.elements = v.elements.map((e) => ({ ...e, id: e.id || "e" + state.seq++ }));
  }
  rebuild();
}

// ─── Placement ─────────────────────────────────────────────────────────────
function onClick(e) {
  if (!state.tool || !state.field) return;
  const c = [e.lngLat.lng, e.lngLat.lat];
  const id = "e" + state.seq++;
  let el;
  if (state.tool === "field") {
    const [w, l] = FIELD_PRESETS["7v7"];
    el = { id, kind: "field", center: c, widthM: w, lengthM: l, rotationDeg: 0, name: "", ageGroup: "", preset: "7v7", markHome: state.variant === "game" };
  } else if (state.tool === "grid") {
    el = { id, kind: "grid", center: c, widthM: 70, lengthM: 50, rotationDeg: 0, cols: 3, rows: 2, scheme: "letters", startIndex: 0, name: "" };
  } else if (state.tool === "line") {
    el = { id, kind: "line", points: [Geo.destination(c, -15, 0), Geo.destination(c, 15, 0)], color: HOME_COLOR, width: 5, label: "" };
  } else if (state.tool === "word") {
    const text = prompt("Word / label text:", "Park Here");
    if (!text) { state.tool = null; clearToolBtns(); return; }
    el = { id, kind: "text", center: c, text, color: "#15610e", size: 18 };
  } else {
    el = { id, kind: "marker", type: state.tool, center: c };
  }
  state.elements.push(el);
  state.tool = null; clearToolBtns();
  select(id);
  setHint("Drag to move; drag handles to resize/rotate. Esc deselects.");
}
function clearToolBtns() { document.querySelectorAll(".tool.active").forEach((x) => x.classList.remove("active")); }

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
  if (b.length) {
    const eid = b[0].properties && b[0].properties.eid;
    if (eid) {
      select(eid);
      state.drag = { mode: "move", id: eid, last: e.lngLat };
      map.dragPan.disable();
      e.preventDefault();
      return;
    }
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
    if (el.points) el.points = el.points.map((p) => [p[0] + dLng, p[1] + dLat]);
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
  }
  rebuild();
}
function onUp() { if (state.drag) { state.drag = null; map.dragPan.enable(); renderSelPanel(); } }

function pick(pt, layers) {
  const present = layers.filter((l) => map.getLayer(l));
  if (!present.length) return [];
  return map.queryRenderedFeatures([[pt.x - 8, pt.y - 8], [pt.x + 8, pt.y + 8]], { layers: present });
}

// ─── Build all map sources from state ──────────────────────────────────────────
function rebuild() {
  const shapes = [], sidelines = [], labels = [], markers = [], handles = [];

  state.elements.forEach((el) => {
    if (el.kind === "field") {
      const ring = Geo.rectRing(el.center, el.widthM, el.lengthM, el.rotationDeg);
      shapes.push(poly(ring, el.id, { fill: "#f74b4b", stroke: "#ffffff", strokeW: 2 }));
      const txt = [el.name, el.ageGroup].filter(Boolean).join("\n");
      if (txt) labels.push(label(Geo.centroid(ring), txt, el.id, { size: 15 }));
      if (el.markHome) {
        const ha = Geo.homeAway(ring);
        if (ha) {
          sidelines.push(lineFeat([ha.home.a, ha.home.b], el.id, { color: HOME_COLOR, w: 6 }));
          sidelines.push(lineFeat([ha.away.a, ha.away.b], el.id, { color: AWAY_COLOR, w: 5 }));
          labels.push(label(ha.home.mid, "HOME", el.id, { size: 12, color: "#cfe0ff" }));
          labels.push(label(ha.away.mid, "AWAY", el.id, { size: 12, color: "#ffe6c9" }));
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
    } else if (el.kind === "line") {
      shapes.push(lineFeat(el.points, el.id, { stroke: el.color, strokeW: el.width }));
      if (el.label) labels.push(label(el.points[0], el.label, el.id, { size: 13, color: el.color }));
    } else if (el.kind === "text") {
      labels.push(label(el.center, el.text, el.id, { size: el.size || 18, color: el.color }));
    } else if (el.kind === "marker") {
      const t = MARKER_TYPES[el.type];
      markers.push({ type: "Feature", properties: { eid: el.id, color: t.color, code: t.code }, geometry: { type: "Point", coordinates: el.center } });
    }
  });

  // Selection handles
  const sel = byId(state.selectedId);
  if (sel) {
    if (sel.kind === "field" || sel.kind === "grid") {
      const ring = Geo.rectRing(sel.center, sel.widthM, sel.lengthM, sel.rotationDeg);
      for (let i = 0; i < 4; i++) handles.push(handle(ring[i], sel.id, "corner", i));
      const rot = Geo.rotateOffset(0, sel.lengthM / 2 + 18, sel.rotationDeg);
      handles.push(handle(Geo.destination(sel.center, rot[0], rot[1]), sel.id, "rotate"));
    } else if (sel.kind === "line") {
      sel.points.forEach((p, i) => handles.push(handle(p, sel.id, "vertex", i)));
    }
  }

  setData("shapes", shapes); setData("sidelines", sidelines);
  setData("labels", labels); setData("markers", markers); setData("handles", handles);
  renderSelPanel(); renderElemList();
}
function setData(id, features) { const s = map.getSource(id); if (s) s.setData(fc(features)); }
function poly(ring, eid, props) { return { type: "Feature", properties: { eid, ...props }, geometry: { type: "Polygon", coordinates: [ring] } }; }
function lineFeat(pts, eid, props) { return { type: "Feature", properties: { eid, ...props }, geometry: { type: "LineString", coordinates: pts } }; }
function label(coord, text, eid, props) { return { type: "Feature", properties: { eid, text, ...props }, geometry: { type: "Point", coordinates: coord } }; }
function handle(coord, eid, role, idx) { return { type: "Feature", properties: { eid, role, idx }, geometry: { type: "Point", coordinates: coord } }; }

// ─── Selection + panels ─────────────────────────────────────────────────────
function byId(id) { return state.elements.find((e) => e.id === id); }
function select(id) { state.selectedId = id; rebuild(); }

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
      <label class="block">Size preset<select data-k="preset">${presetOpts(el.preset)}</select></label>
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
  } else if (el.kind === "line") {
    html = `<label class="block">Label<input data-k="label" value="${esc(el.label)}"></label>
      <label class="block">Color<input type="color" data-k="color" value="${el.color}"></label>
      <label class="block">Width<input type="number" data-k="width" value="${el.width}"></label>
      <p class="hint">Drag the endpoint handles to reshape.</p>`;
  } else if (el.kind === "text") {
    html = `<label class="block">Text<input data-k="text" value="${esc(el.text)}"></label>
      <label class="block">Color<input type="color" data-k="color" value="${el.color}"></label>
      <label class="block">Size<input type="number" data-k="size" value="${el.size}"></label>`;
  } else if (el.kind === "marker") {
    html = `<p>${MARKER_TYPES[el.type].name}</p><p class="hint">Drag to reposition.</p>`;
  }
  html += `<button type="button" class="del" id="delSel">Delete element</button>`;
  panel.innerHTML = html;
  panel.querySelectorAll("[data-k]").forEach((inp) => inp.addEventListener("input", () => applyField(el, inp)));
  const del = document.getElementById("delSel");
  if (del) del.addEventListener("click", () => { state.elements = state.elements.filter((x) => x.id !== el.id); select(null); });
}

function applyField(el, inp) {
  const k = inp.dataset.k;
  let v = inp.type === "checkbox" ? inp.checked : (inp.type === "number" ? Number(inp.value) : inp.value);
  if (k === "preset" && FIELD_PRESETS[v]) { el.preset = v; el.widthM = FIELD_PRESETS[v][0]; el.lengthM = FIELD_PRESETS[v][1]; }
  else el[k] = v;
  rebuild();
}
function presetOpts(cur) {
  return Object.keys(FIELD_PRESETS).map((k) => `<option value="${k}"${cur===k?" selected":""}>${k} (${FIELD_PRESETS[k][0]}×${FIELD_PRESETS[k][1]} m)</option>`).join("") +
    `<option value="custom"${cur==="custom"?" selected":""}>Custom</option>`;
}

function renderElemList() {
  const list = document.getElementById("elemList");
  if (!state.elements.length) { list.innerHTML = '<p class="subtle">None yet.</p>'; return; }
  list.innerHTML = "";
  state.elements.forEach((el) => {
    const name = el.kind === "field" ? ("Field " + (el.name || el.ageGroup || "")).trim()
      : el.kind === "grid" ? ("Grid " + (el.name || `${el.cols}×${el.rows}`))
      : el.kind === "line" ? "Line"
      : el.kind === "text" ? `“${el.text}”`
      : MARKER_TYPES[el.type].name;
    const row = document.createElement("div");
    row.className = "item" + (el.id === state.selectedId ? " sel" : "");
    row.innerHTML = `<span class="grow">${esc(name)}</span><button class="del" data-del="${el.id}">✕</button>`;
    row.querySelector(".grow").addEventListener("click", () => select(el.id));
    row.querySelector("[data-del]").addEventListener("click", () => { state.elements = state.elements.filter((x) => x.id !== el.id); if (state.selectedId === el.id) select(null); else rebuild(); });
    list.appendChild(row);
  });
}

// ─── Framing guide ──────────────────────────────────────────────────────────
function frameMeters() { return Math.max(40, Math.min(600, Number(document.getElementById("frameMeters").value) || 200)); }
function refreshFrameBox() {
  if (!map) return;
  const lat = map.getCenter().lat;
  const mpp = EARTH_CIRCUMFERENCE * Math.cos((lat * Math.PI) / 180) / (TILE * Math.pow(2, map.getZoom()));
  const w = frameMeters() / mpp;
  const box = document.getElementById("frameBox");
  box.style.width = w + "px"; box.style.height = w * (OUT_H / OUT_W) + "px";
}

// ─── Export ─────────────────────────────────────────────────────────────────
async function doExport(commit) {
  if (!state.field) return toast("Pick a field first.", "error");
  state.tool = null; clearToolBtns();
  const center = [map.getCenter().lng, map.getCenter().lat];
  const meters = frameMeters();
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
    styleVersion: STYLE,
    view: { center, zoom, bearing: 0, frameMeters: meters, width: OUT_W, height: OUT_H, scale: SCALE },
    elements: state.elements,
    alt: `${state.field.title} ${state.variant} field map`,
  };
  modal(true, "Saving…", '<p class="subtle">Committing PNG + annotation JSON to staging…</p>');
  try {
    const res = await api("/api/map/" + state.field.slug, { method: "POST", body: { variant: state.variant, pngBase64: dataUrl, annotation } });
    modal(false);
    toast(`Saved to staging (${res.commit.slice(0, 7)}). Appears after the staging build; promote to go live.`, "success");
    const f = state.fields.find((x) => x.slug === state.field.slug); if (f) f.hasMap = true;
  } catch (e) { modal(false); toast("Save failed: " + e.message, "error"); }
}

async function renderPng(center, zoom) {
  const token = encodeURIComponent(state.config.mapboxToken);
  const url = `https://api.mapbox.com/styles/v1/mapbox/${STYLE}/static/` +
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
    if (el.markHome) {
      const ha = Geo.homeAway(ring);
      if (ha) {
        strokeSeg(ctx, project, ha.home.a, ha.home.b, HOME_COLOR, 7);
        strokeSeg(ctx, project, ha.away.a, ha.away.b, AWAY_COLOR, 6);
        textBox(ctx, project(ha.home.mid[0], ha.home.mid[1]), "HOME", { size: 13 * SCALE, bg: HOME_COLOR, fg: "#fff", center: true });
        textBox(ctx, project(ha.away.mid[0], ha.away.mid[1]), "AWAY", { size: 13 * SCALE, bg: AWAY_COLOR, fg: "#fff", center: true });
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
  } else if (el.kind === "line") {
    ctx.beginPath();
    el.points.forEach((pt, i) => { const p = project(pt[0], pt[1]); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); });
    ctx.lineCap = "round"; ctx.lineWidth = (el.width || 5) * SCALE; ctx.strokeStyle = el.color; ctx.stroke();
    if (el.label) { const p = project(el.points[0][0], el.points[0][1]); textBox(ctx, p, el.label, { size: 13 * SCALE, bg: "rgba(0,0,0,0.6)", fg: "#fff", left: true }); }
  } else if (el.kind === "text") {
    const p = project(el.center[0], el.center[1]);
    ctx.font = `bold ${(el.size || 18) * SCALE}px -apple-system, Arial, sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.lineWidth = 4 * SCALE; ctx.strokeStyle = "rgba(255,255,255,0.92)";
    ctx.strokeText(el.text, p.x, p.y); ctx.fillStyle = el.color; ctx.fillText(el.text, p.x, p.y);
  } else if (el.kind === "marker") {
    const p = project(el.center[0], el.center[1]); const t = MARKER_TYPES[el.type]; const r = 11 * SCALE;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fillStyle = t.color; ctx.fill();
    ctx.lineWidth = 2.5 * SCALE; ctx.strokeStyle = "#fff"; ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.font = `bold ${13 * SCALE}px Arial`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(t.code, p.x, p.y + SCALE);
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

function drawTitle(ctx) {
  const v = document.getElementById("variantLabel").value.trim() || (state.variant === "practice" ? "Practice" : "Game Day");
  const text = `${state.field.title} — ${v}`;
  ctx.font = `bold ${18 * SCALE}px -apple-system, Arial, sans-serif`;
  const w = ctx.measureText(text).width, padX = 12 * SCALE, padY = 8 * SCALE, x = 12 * SCALE, y = 12 * SCALE;
  ctx.fillStyle = "rgba(142,41,41,0.92)"; roundRect(ctx, x, y, w + padX * 2, 26 * SCALE + padY, 6 * SCALE); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText(text, x + padX, y + padY);
}

function drawLegend(ctx) {
  const items = [];
  const markerTypes = [...new Set(state.elements.filter((e) => e.kind === "marker").map((e) => e.type))];
  markerTypes.forEach((t) => items.push({ color: MARKER_TYPES[t].color, code: MARKER_TYPES[t].code, name: MARKER_TYPES[t].name }));
  if (state.elements.some((e) => e.kind === "field" && e.markHome)) {
    items.push({ line: HOME_COLOR, name: "Home sideline" });
    items.push({ line: AWAY_COLOR, name: "Away sideline" });
  }
  if (!items.length) return;
  const lh = 24 * SCALE, padX = 12 * SCALE, padY = 10 * SCALE;
  const boxW = 190 * SCALE, boxH = items.length * lh + padY * 2 - 4 * SCALE;
  const x = 12 * SCALE, y = ctx.canvas.height - boxH - 12 * SCALE;
  ctx.fillStyle = "rgba(255,255,255,0.92)"; roundRect(ctx, x, y, boxW, boxH, 6 * SCALE); ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.15)"; ctx.lineWidth = 1 * SCALE; ctx.stroke();
  items.forEach((it, i) => {
    const cy = y + padY + i * lh + lh / 2;
    if (it.line) {
      ctx.strokeStyle = it.line; ctx.lineWidth = 5 * SCALE; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(x + padX, cy); ctx.lineTo(x + padX + 16 * SCALE, cy); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(x + padX + 7 * SCALE, cy, 7 * SCALE, 0, Math.PI * 2); ctx.fillStyle = it.color; ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = `bold ${9 * SCALE}px Arial`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(it.code, x + padX + 7 * SCALE, cy + 0.5 * SCALE);
    }
    ctx.fillStyle = "#221f1f"; ctx.font = `${12 * SCALE}px -apple-system, Arial, sans-serif`; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText(it.name, x + padX + 22 * SCALE, cy);
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
