// ND-025: reactive synthwave music — pure rules (tempo, layers, patterns).
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const M = require("../../music.js");

test("tempo: 96 on menus; 110 at start speed rising to 128 at max; clamped", () => {
  assert.equal(M.tempoFor({ mode: "menu", speed: 900 }), 96);
  assert.equal(M.tempoFor({ mode: "run", speed: 420 }), 110);
  assert.equal(M.tempoFor({ mode: "run", speed: 1100 }), 128);
  assert.equal(M.tempoFor({ mode: "run", speed: 100 }), 110);
  assert.equal(M.tempoFor({ mode: "run", speed: 5000 }), 128);
  const mid = M.tempoFor({ mode: "run", speed: 760 });
  assert.ok(mid > 110 && mid < 128);
});

test("layers build with the run", () => {
  assert.deepEqual(M.layersFor({ mode: "menu" }), ["pad", "bass"]);
  assert.deepEqual(M.layersFor({ mode: "run", speed: 420 }), ["pad", "bass", "kick"]);
  assert.deepEqual(M.layersFor({ mode: "run", speed: 600 }), ["pad", "bass", "kick", "snare", "hats"]);
  assert.deepEqual(M.layersFor({ mode: "run", speed: 850 }), ["pad", "bass", "kick", "snare", "hats", "arp"]);
  assert.ok(M.layersFor({ mode: "run", speed: 420, powered: true }).includes("sparkle"));
  assert.ok(!M.layersFor({ mode: "menu", powered: true }).includes("sparkle"));
  assert.deepEqual(M.layersFor({ mode: "paused" }), []);
});

test("drum patterns: kick on the beat, snare on 2 and 4, hats on 8ths", () => {
  const hits = (layer) => [...Array(16).keys()].filter((s) => M.stepEvents(layer, s, 0).length);
  assert.deepEqual(hits("kick"), [0, 4, 8, 12]);
  assert.deepEqual(hits("snare"), [4, 12]);
  assert.deepEqual(hits("hats"), [0, 2, 4, 6, 8, 10, 12, 14]);
});

test("chords cycle Am, F, C, G; pad plays the chord at the bar start", () => {
  assert.deepEqual([0, 1, 2, 3, 4].map((b) => M.chordFor(b).name), ["Am", "F", "C", "G", "Am"]);
  assert.equal(M.stepEvents("pad", 0, 1).length, 3);
  assert.deepEqual(M.stepEvents("pad", 0, 1).map((e) => e.midi), M.chordFor(1).notes);
  assert.deepEqual(M.stepEvents("pad", 5, 1), []);
  // Bass follows the chord root.
  assert.equal(M.stepEvents("bass", 0, 2)[0].midi, M.chordFor(2).root);
});

test("midiToFreq: A4 = 440 Hz", () => {
  assert.equal(M.midiToFreq(69), 440);
  assert.ok(Math.abs(M.midiToFreq(57) - 220) < 1e-9);
});
