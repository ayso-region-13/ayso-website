/* Pure geometry helpers for the field-map editor.
 *
 * No DOM, no Mapbox — so it can be unit-tested in Node and reused in the
 * browser. Field-scale distances (tens to hundreds of metres) use a local
 * equirectangular approximation, which is more than accurate enough here.
 *
 * Conventions:
 *   - Coordinates are [lng, lat] (GeoJSON order).
 *   - A field rectangle is parameterised by center, widthM (across, the short
 *     axis by default), lengthM (along, the long axis), and rotationDeg
 *     (0 = length axis points true north; positive rotates clockwise).
 *   - HOME is the sideline (long edge) toward the north; if the two sidelines
 *     are level in latitude, HOME is the western one. AWAY is the opposite.
 */
(function (root) {
  "use strict";

  var M_PER_DEG_LAT = 111320;

  function metersPerDegLng(lat) {
    return M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
  }

  // Offset a [lng,lat] by east/north metres.
  function destination(center, eastM, northM) {
    return [
      center[0] + eastM / metersPerDegLng(center[1]),
      center[1] + northM / M_PER_DEG_LAT,
    ];
  }

  // Planar metre distance between two [lng,lat] points (field scale).
  function distanceM(a, b) {
    var latMid = (a[1] + b[1]) / 2;
    var dx = (b[0] - a[0]) * metersPerDegLng(latMid);
    var dy = (b[1] - a[1]) * M_PER_DEG_LAT;
    return Math.hypot(dx, dy);
  }

  // Rectangle ring (closed, 5 points) from parametric form.
  function rectRing(center, widthM, lengthM, rotationDeg) {
    var t = (rotationDeg * Math.PI) / 180;
    var cos = Math.cos(t), sin = Math.sin(t);
    var hw = widthM / 2, hl = lengthM / 2;
    // local (x=east-ish, y=north-ish) corners before rotation
    var local = [
      [-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl],
    ];
    var ring = local.map(function (p) {
      // rotate clockwise: east' = x*cos + y*sin, north' = -x*sin + y*cos
      var east = p[0] * cos + p[1] * sin;
      var north = -p[0] * sin + p[1] * cos;
      return destination(center, east, north);
    });
    ring.push(ring[0].slice());
    return ring;
  }

  function midpoint(a, b) {
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  }

  // Edges of a closed ring (ignoring the repeated last point).
  function edges(ring) {
    var pts = ring.slice();
    if (pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) {
      pts = pts.slice(0, -1);
    }
    var out = [];
    for (var i = 0; i < pts.length; i++) {
      out.push([pts[i], pts[(i + 1) % pts.length]]);
    }
    return out;
  }

  // Approximate width/length of a (roughly rectangular) quad ring: average the
  // two pairs of opposite edges; the longer pair is the length.
  function quadDims(ring) {
    var e = edges(ring);
    if (e.length < 4) return { widthM: 0, lengthM: 0 };
    var l = function (edge) { return distanceM(edge[0], edge[1]); };
    var pairA = (l(e[0]) + l(e[2])) / 2; // edges 0 & 2 opposite
    var pairB = (l(e[1]) + l(e[3])) / 2; // edges 1 & 3 opposite
    var lengthM = Math.max(pairA, pairB);
    var widthM = Math.min(pairA, pairB);
    return { widthM: widthM, lengthM: lengthM };
  }

  // Determine HOME/AWAY sidelines for a quad ring. Sidelines = the longer
  // opposite-edge pair (the touchlines). HOME = the sideline toward the north;
  // if the two are level in latitude (field runs N–S), HOME = the western one.
  // Returns each sideline as { mid, a, b } so callers can draw the full edge.
  function homeAway(ring) {
    var e = edges(ring);
    if (e.length < 4) return null;
    var l = function (edge) { return distanceM(edge[0], edge[1]); };
    var side = function (edge) { return { a: edge[0], b: edge[1], mid: midpoint(edge[0], edge[1]) }; };
    var pairA = { len: (l(e[0]) + l(e[2])) / 2, sides: [side(e[0]), side(e[2])] };
    var pairB = { len: (l(e[1]) + l(e[3])) / 2, sides: [side(e[1]), side(e[3])] };
    var sidelines = pairA.len >= pairB.len ? pairA.sides : pairB.sides;
    var s0 = sidelines[0], s1 = sidelines[1];
    var EPS = 1e-6; // ~0.1 m in latitude degrees
    var home, away;
    if (Math.abs(s0.mid[1] - s1.mid[1]) > EPS) {
      if (s0.mid[1] > s1.mid[1]) { home = s0; away = s1; } else { home = s1; away = s0; }
    } else {
      if (s0.mid[0] < s1.mid[0]) { home = s0; away = s1; } else { home = s1; away = s0; }
    }
    return { home: home, away: away };
  }

  // Rotate a local (east,north) metre offset clockwise by rotationDeg.
  function rotateOffset(eastM, northM, rotationDeg) {
    var t = (rotationDeg * Math.PI) / 180;
    var cos = Math.cos(t), sin = Math.sin(t);
    return [eastM * cos + northM * sin, -eastM * sin + northM * cos];
  }

  // East/north metres of `point` relative to `center`.
  function metersFromCenter(center, point) {
    return {
      eastM: (point[0] - center[0]) * metersPerDegLng(center[1]),
      northM: (point[1] - center[1]) * M_PER_DEG_LAT,
    };
  }

  // Given a dragged corner at `point`, return symmetric-about-center
  // width/length for a rectangle rotated by rotationDeg.
  function resizeFromCorner(center, rotationDeg, point) {
    var off = metersFromCenter(center, point);
    // inverse-rotate the world offset back into the rectangle's local frame
    var t = (-rotationDeg * Math.PI) / 180;
    var cos = Math.cos(t), sin = Math.sin(t);
    var localX = off.eastM * cos + off.northM * sin;
    var localY = -off.eastM * sin + off.northM * cos;
    return {
      widthM: Math.max(5, Math.abs(localX) * 2),
      lengthM: Math.max(5, Math.abs(localY) * 2),
    };
  }

  // Compass bearing (deg, 0 = north, clockwise) from center to point.
  function bearingDeg(center, point) {
    var off = metersFromCenter(center, point);
    var deg = (Math.atan2(off.eastM, off.northM) * 180) / Math.PI;
    return (deg + 360) % 360;
  }

  // Subdivide a rectangle into cols×rows cells. Returns an array of
  // { ring, center, col, row, index } in row-major order (row 0 = north edge,
  // col 0 = west-most before rotation), so labels read left-to-right, top-down.
  function gridCells(center, widthM, lengthM, rotationDeg, cols, rows) {
    cols = Math.max(1, cols | 0);
    rows = Math.max(1, rows | 0);
    var cw = widthM / cols, ch = lengthM / rows;
    var hw = widthM / 2, hl = lengthM / 2;
    var out = [];
    var place = function (lx, ly) {
      var o = rotateOffset(lx, ly, rotationDeg);
      return destination(center, o[0], o[1]);
    };
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        // local coords: x east from -hw..hw, y north from hl(top)..-hl(bottom)
        var x0 = -hw + c * cw, x1 = x0 + cw;
        var y1 = hl - r * ch, y0 = y1 - ch; // y1 is the more-north edge
        var ring = [place(x0, y0), place(x1, y0), place(x1, y1), place(x0, y1)];
        ring.push(ring[0].slice());
        out.push({
          ring: ring,
          center: place(x0 + cw / 2, y0 + ch / 2),
          col: c, row: r, index: r * cols + c,
        });
      }
    }
    return out;
  }

  // Soccer-pitch markings for a field rectangle, returned as geo geometries so
  // both the live editor and the export can draw them. Length is the goal-to-goal
  // axis; goals sit at the two short ends, halfway line + center circle in the
  // middle. All as LineStrings (the circle/goals are closed rings) so they draw
  // as thin lines, not filled. Sizes scale with the field and are clamped so
  // small-sided fields still look right.
  function fieldMarkings(center, widthM, lengthM, rotationDeg) {
    var hw = widthM / 2, hl = lengthM / 2;
    var place = function (lx, ly) {
      var o = rotateOffset(lx, ly, rotationDeg);
      return destination(center, o[0], o[1]);
    };
    var halfway = [place(-hw, 0), place(hw, 0)];
    var r = Math.max(2, Math.min(widthM, lengthM) * 0.15);
    var circle = [];
    for (var i = 0; i <= 40; i++) {
      var a = (i / 40) * 2 * Math.PI;
      circle.push(place(Math.cos(a) * r, Math.sin(a) * r));
    }
    var gw = Math.min(widthM * 0.5, 7.32) / 2; // half goal width
    var gd = Math.max(1, Math.min(lengthM * 0.06, 2)); // net depth, outward
    var goalAt = function (endY, dir) {
      return [
        place(-gw, endY), place(gw, endY),
        place(gw, endY + dir * gd), place(-gw, endY + dir * gd), place(-gw, endY),
      ];
    };
    return {
      halfway: halfway,
      circle: circle,
      dot: center,
      goals: [goalAt(hl, 1), goalAt(-hl, -1)],
    };
  }

  // Cell label for a given index under a scheme.
  function cellLabel(index, scheme, startIndex) {
    var start = startIndex || 0;
    if (scheme === "letters") {
      var n = index; // 0→A
      var s = "";
      do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
      return s;
    }
    return String(index + 1 + start); // numbers, 1-based, offset by start
  }

  // Web-Mercator projector matching the Mapbox Static Images API (512-px tiles).
  // Returns fn(lng,lat) → {x,y} in physical canvas px for an OUT_W×OUT_H@scale image.
  function projector(center, zoom, OUT_W, OUT_H, scale) {
    var TILE = 512;
    var worldSize = TILE * Math.pow(2, zoom);
    var lngX = function (lng) { return ((lng + 180) / 360) * worldSize; };
    var latY = function (lat) {
      var r = (lat * Math.PI) / 180;
      return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * worldSize;
    };
    var cx = lngX(center[0]);
    var cy = latY(center[1]);
    return function (lng, lat) {
      return {
        x: (OUT_W / 2 + (lngX(lng) - cx)) * scale,
        y: (OUT_H / 2 + (latY(lat) - cy)) * scale,
      };
    };
  }

  // Zoom such that `meters` spans OUT_W logical px at the given latitude.
  function zoomForGroundWidth(lat, meters, OUT_W) {
    var TILE = 512;
    var EARTH = 40075016.686;
    var z = Math.log2((EARTH * Math.cos((lat * Math.PI) / 180) * OUT_W) / (meters * TILE));
    return Math.max(0, Math.min(22, z));
  }

  function centroid(ring) {
    var pts = ring.slice(0, -1); // drop repeated last
    var x = 0, y = 0;
    for (var i = 0; i < pts.length; i++) { x += pts[i][0]; y += pts[i][1]; }
    return [x / pts.length, y / pts.length];
  }

  var Geo = {
    destination: destination,
    distanceM: distanceM,
    rectRing: rectRing,
    quadDims: quadDims,
    homeAway: homeAway,
    projector: projector,
    zoomForGroundWidth: zoomForGroundWidth,
    centroid: centroid,
    edges: edges,
    midpoint: midpoint,
    rotateOffset: rotateOffset,
    metersFromCenter: metersFromCenter,
    resizeFromCorner: resizeFromCorner,
    bearingDeg: bearingDeg,
    gridCells: gridCells,
    cellLabel: cellLabel,
    fieldMarkings: fieldMarkings,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = Geo;
  root.Geo = Geo;
})(typeof self !== "undefined" ? self : this);
