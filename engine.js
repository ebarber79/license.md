/* =========================================================================
 * Neon Dash — pure engine helpers (no DOM, no canvas) so they can be
 * unit-tested in Node and reused by the game. Loaded as a plain script in
 * the browser (attaches window.NeonEngine) and via require() in tests.
 * ========================================================================= */

(function (global) {
  "use strict";

  // Seedable PRNG (mulberry32) for deterministic tests.
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Axis-aligned bounding-box overlap test.
  function hits(px, py, pw, ph, ox, oy, ow, oh) {
    return px < ox + ow && px + pw > ox && py < oy + oh && py + ph > oy;
  }

  // Score is distance-based (1 point per 10px travelled).
  function scoreFromDistance(distance) {
    return Math.floor(distance / 10);
  }

  function hexToRgb(h) {
    var n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function lerpColor(a, b, t) {
    var ca = hexToRgb(a), cb = hexToRgb(b);
    var r = Math.round(ca[0] + (cb[0] - ca[0]) * t);
    var g = Math.round(ca[1] + (cb[1] - ca[1]) * t);
    var bl = Math.round(ca[2] + (cb[2] - ca[2]) * t);
    return "rgb(" + r + "," + g + "," + bl + ")";
  }

  var NeonEngine = {
    mulberry32: mulberry32,
    hits: hits,
    scoreFromDistance: scoreFromDistance,
    hexToRgb: hexToRgb,
    lerpColor: lerpColor,
  };

  if (typeof module === "object" && module.exports) module.exports = NeonEngine;
  global.NeonEngine = NeonEngine;
})(typeof window !== "undefined" ? window : globalThis);
