// ND-021: power-ups light up the shoes. Pure colour logic lives in engine.js.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { shoePowerStyle: style } = require("../../engine.js");

const base = { shield: 0, magnet: 0, slow: 0, reduceMotion: false, t: 0 };

test("no power-up: shoes are normal", () => {
  const s = style(base);
  assert.equal(s.active, false);
  assert.equal(s.mode, "none");
  assert.equal(s.color, null);
});

test("each single power-up gets its own colour (matching its pickup icon)", () => {
  assert.deepEqual(
    [style({ ...base, shield: 5 }), style({ ...base, magnet: 5 }), style({ ...base, slow: 5 })]
      .map((s) => [s.mode, s.color]),
    [["shield", "rgb(0,255,180)"], ["magnet", "rgb(255,216,77)"], ["slowmo", "rgb(120,180,255)"]],
  );
});

test("two or more at once: rainbow that cycles over time", () => {
  const a = style({ ...base, shield: 5, magnet: 5, t: 0 });
  const b = style({ ...base, shield: 5, magnet: 5, t: 0.5 });
  assert.equal(a.mode, "rainbow");
  assert.equal(style({ ...base, shield: 5, magnet: 5, slow: 5 }).mode, "rainbow");
  assert.notEqual(a.color, b.color);
});

test("reduce motion: rainbow holds still", () => {
  const a = style({ ...base, shield: 5, slow: 5, reduceMotion: true, t: 0 });
  const b = style({ ...base, shield: 5, slow: 5, reduceMotion: true, t: 0.5 });
  assert.equal(a.mode, "rainbow");
  assert.equal(a.color, b.color);
});

test("last 1.5 s: colour blinks back to normal, 4 times a second", () => {
  const samples = [0, 0.125, 0.25, 0.375].map((t) => style({ ...base, magnet: 1.2, t }));
  assert.deepEqual(samples.map((s) => s.blinkOff), [false, true, false, true]);
  assert.deepEqual(samples.map((s) => s.color), ["rgb(255,216,77)", null, "rgb(255,216,77)", null]);
  assert.ok(samples.every((s) => s.active && s.mode === "magnet"));
});

test("more than 1.5 s left: no blinking", () => {
  const ts = [0, 0.1, 0.125, 0.2, 0.375, 0.9];
  assert.ok(ts.every((t) => !style({ ...base, shield: 1.6, t }).blinkOff));
});

test("reduce motion while ending: never blinks, shows a steady dimmer colour", () => {
  const ts = [0, 0.125, 0.25, 0.375];
  const s = ts.map((t) => style({ ...base, slow: 1, reduceMotion: true, t }));
  assert.ok(s.every((x) => !x.blinkOff && x.color === "rgb(120,180,255)" && x.dim));
});
