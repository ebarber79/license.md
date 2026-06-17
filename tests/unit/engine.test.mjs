import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const E = require("../../engine.js");

test("scoreFromDistance: 1 point per 10px, floored", () => {
  assert.equal(E.scoreFromDistance(0), 0);
  assert.equal(E.scoreFromDistance(95), 9);
  assert.equal(E.scoreFromDistance(100), 10);
  assert.equal(E.scoreFromDistance(109), 10);
});

test("hits: AABB overlap detection", () => {
  // overlapping
  assert.equal(E.hits(0, 0, 10, 10, 5, 5, 10, 10), true);
  // touching edge only (not overlapping)
  assert.equal(E.hits(0, 0, 10, 10, 10, 0, 10, 10), false);
  // fully separate
  assert.equal(E.hits(0, 0, 10, 10, 100, 100, 5, 5), false);
  // contained
  assert.equal(E.hits(0, 0, 100, 100, 40, 40, 5, 5), true);
});

test("mulberry32: deterministic and in [0,1)", () => {
  const a = E.mulberry32(12345);
  const b = E.mulberry32(12345);
  const seqA = [a(), a(), a()];
  const seqB = [b(), b(), b()];
  assert.deepEqual(seqA, seqB, "same seed -> same sequence");
  for (const v of seqA) {
    assert.ok(v >= 0 && v < 1, `value ${v} in range`);
  }
  const c = E.mulberry32(999);
  assert.notDeepEqual([c(), c(), c()], seqA, "different seed -> different sequence");
});

test("hexToRgb + lerpColor: endpoints and midpoint", () => {
  assert.deepEqual(E.hexToRgb("#000000"), [0, 0, 0]);
  assert.deepEqual(E.hexToRgb("#ffffff"), [255, 255, 255]);
  assert.equal(E.lerpColor("#000000", "#ffffff", 0), "rgb(0,0,0)");
  assert.equal(E.lerpColor("#000000", "#ffffff", 1), "rgb(255,255,255)");
  assert.equal(E.lerpColor("#000000", "#ffffff", 0.5), "rgb(128,128,128)");
});
