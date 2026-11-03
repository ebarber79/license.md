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

  // Score is distance-based (1 point per 8px travelled).
  function scoreFromDistance(distance) {
    return Math.floor(distance / 8);
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

  // ND-021: how the shoes look while power-ups are active. Pure, so it's
  // unit-testable; game.js does the drawing.
  //   o = { shield, magnet, slow, reduceMotion, t }  (seconds left per power, clock in s)
  // Returns { active, mode, rgb, color, blinkOff, dim }:
  //   mode     none | shield | magnet | slowmo | rainbow (2+ powers at once)
  //   rgb      [r,g,b] of the current shoe colour (null when mode is none)
  //   color    "rgb(r,g,b)" string, or null when none or blinked off
  //   blinkOff true on the "off" half of the end-of-power blink (draw normal shoes)
  //   dim      true when ending under reduce-motion (steady, dimmer, no blink)
  var SHOE_POWER_RGB = { shield: [0, 255, 180], magnet: [255, 216, 77], slowmo: [120, 180, 255] };
  var SHOE_RAINBOW_STILL = [255, 120, 255]; // reduce-motion: no hue cycling
  var SHOE_ENDING_SECS = 1.5;
  var SHOE_BLINKS_PER_SEC = 4;

  function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360 / 360;
    function f(n) {
      var k = (n + h * 12) % 12;
      var a = s * Math.min(l, 1 - l);
      return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
    }
    return [f(0), f(8), f(4)];
  }

  function shoePowerStyle(o) {
    var t = o.t || 0;
    var on = [];
    if (o.shield > 0) on.push(["shield", o.shield]);
    if (o.magnet > 0) on.push(["magnet", o.magnet]);
    if (o.slow > 0) on.push(["slowmo", o.slow]);
    if (!on.length) return { active: false, mode: "none", rgb: null, color: null, blinkOff: false, dim: false };
    var rgb, mode, left = Infinity;
    if (on.length > 1) {
      mode = "rainbow";
      rgb = o.reduceMotion ? SHOE_RAINBOW_STILL : hslToRgb(t * 220, 1, 0.62);
    } else {
      mode = on[0][0];
      rgb = SHOE_POWER_RGB[mode];
      left = on[0][1];
    }
    var ending = left <= SHOE_ENDING_SECS;
    var blinkOff = ending && !o.reduceMotion && Math.floor(t * SHOE_BLINKS_PER_SEC * 2) % 2 === 1;
    return {
      active: true,
      mode: mode,
      rgb: rgb,
      color: blinkOff ? null : "rgb(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ")",
      blinkOff: blinkOff,
      dim: ending && !!o.reduceMotion,
    };
  }

  var NeonEngine = {
    mulberry32: mulberry32,
    hits: hits,
    scoreFromDistance: scoreFromDistance,
    hexToRgb: hexToRgb,
    lerpColor: lerpColor,
    shoePowerStyle: shoePowerStyle,
  };

  if (typeof module === "object" && module.exports) module.exports = NeonEngine;
  global.NeonEngine = NeonEngine;
})(typeof window !== "undefined" ? window : globalThis);
