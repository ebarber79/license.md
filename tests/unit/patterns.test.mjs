import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const P = require("../../patterns.js");
const E = require("../../engine.js");

// Game geometry used by the solver (desktop 1280x720 and phone 390x844 share
// the same physics; only groundY and the player x differ, and spacing is time based).
const LAYOUTS = [
  { name: "desktop", W: 1280, H: 720 },
  { name: "phone", W: 390, H: 844 },
];
const PLAYER_SIZE = 46;
const START_SPEED = 420;
const MAX_SPEED = 1100;
const DT = 1 / 60;

function makePlayer(W, groundY) {
  return { x: W * 0.22, y: groundY - PLAYER_SIZE, vy: 0, size: PLAYER_SIZE, onGround: true, jumps: 0, coyote: 0 };
}

// Breadth-first search over "jump this frame / don't" until every obstacle has
// passed the player. States are deduplicated on quantised player physics.
// Returns true if at least one input sequence survives.
function solvable(obstacles, { W, groundY, speed, slow = 1, maxFrames = 900, inputEvery = 2 }) {
  let states = [makePlayer(W, groundY)];
  const obs = obstacles.map((o) => ({ ...o }));
  const ws = speed * slow;
  for (let f = 0; f < maxFrames; f++) {
    for (const o of obs) { o.x -= ws * DT; o.age += DT * slow; }
    const next = new Map();
    for (const s of states) {
      for (const press of f % inputEvery === 0 ? [false, true] : [false]) {
        const p = { ...s };
        if (press && P.tryJump(p) === 0) continue;
        if (P.stepPlayer(p, DT, groundY, obs) === "fell") continue;
        let dead = false;
        for (const o of obs) {
          const r = P.interact(o, p, groundY);
          if (r === "hit") { dead = true; break; }
          if (r === "launch") P.launch(p);
        }
        if (dead) continue;
        const key = `${Math.round(p.y / 3)},${Math.round(p.vy / 60)},${p.jumps},${p.onGround ? 1 : 0},${p.coyote > 0 ? 1 : 0}`;
        if (!next.has(key)) next.set(key, p);
      }
    }
    states = [...next.values()];
    if (!states.length) return false;
    const px = states[0].x;
    if (obs.every((o) => o.x + o.w < px - 4)) return true;
  }
  return true;
}

function build(chunks, speed, W, groundY, gap) {
  const out = [];
  let x = W * 0.22 + PLAYER_SIZE + speed * 0.7; // first hazard 0.7 s away
  for (const c of chunks) {
    const b = P.buildChunk(c, speed, x, groundY);
    out.push(...b.obstacles);
    x += (b.length + gap) * speed;
  }
  return out;
}

const SPEEDS = [START_SPEED, 760, MAX_SPEED];

test("every chunk is clearable at slow, mid and max speed, normal and slow-mo, desktop and phone", () => {
  const fails = [];
  for (const L of LAYOUTS) {
    const groundY = L.H * 0.82;
    for (const c of P.CHUNKS) {
      for (const speed of SPEEDS) {
        for (const slow of [1, 0.5]) {
          const obs = build([c], speed, L.W, groundY, 0);
          if (!solvable(obs, { W: L.W, groundY, speed, slow })) fails.push(`${L.name} ${c.id} @${speed}${slow < 1 ? " slow-mo" : ""}`);
        }
      }
    }
  }
  assert.deepEqual(fails, []);
});

test("every ordered pair of chunks is clearable at the tightest gap (0.35 s) at start and max speed",
  { skip: !process.env.ND_FULL && "slow (~60 s): run with npm run test:patterns" }, () => {
  const fails = [];
  const groundY = 720 * 0.82;
  const minGap = Math.min(...P.GAP_BASE);
  for (const a of P.CHUNKS) {
    for (const b of P.CHUNKS) {
      for (const speed of [START_SPEED, MAX_SPEED]) {
        const obs = build([a, b], speed, 1280, groundY, minGap);
        if (!solvable(obs, { W: 1280, groundY, speed, inputEvery: 3 })) fails.push(`${a.id} -> ${b.id} @${speed}`);
      }
    }
  }
  assert.deepEqual(fails, []);
});

test("solver sanity: an impossible wall (above the triple-jump apex) is rejected", () => {
  const groundY = 590;
  const obs = [{ type: "wall", x: 600, w: 40, h: 2000, age: 0 }];
  assert.equal(solvable(obs, { W: 1280, groundY, speed: 420 }), false);
});

test("solver sanity: doing nothing dies on a spike, so the search is really jumping", () => {
  const groundY = 590;
  const p = makePlayer(1280, groundY);
  const o = { type: "spikes", x: 600, w: 26, h: 34, count: 1, spikeW: 26, age: 0 };
  let dead = false;
  for (let f = 0; f < 120 && !dead; f++) {
    o.x -= 420 * DT;
    P.stepPlayer(p, DT, groundY, [o]);
    dead = P.interact(o, p, groundY) === "hit";
  }
  assert.equal(dead, true);
});

test("wall of 180 px cannot be cleared with a single jump but can with a double", () => {
  const apex1 = (P.JUMP_VELOCITY ** 2) / (2 * P.GRAVITY);
  assert.ok(apex1 < 180 + 4, `single-jump apex ${apex1.toFixed(0)} must not clear the wall`);
});

test("ceiling punishes a jump: jumping under it is a hit, running under it is safe", () => {
  const groundY = 590;
  const c = { type: "ceiling", x: 250, w: 200, gap: 92, age: 0 };
  const p = makePlayer(1280, groundY);
  assert.equal(P.interact(c, p, groundY), null);
  P.tryJump(p);
  for (let i = 0; i < 10; i++) P.stepPlayer(p, DT, groundY, [c]);
  assert.equal(P.interact(c, p, groundY), "hit");
});

test("pit: running in falls, jumping over survives; edges inside the inset still support", () => {
  const groundY = 590;
  const pit = { type: "pit", x: 280, w: 90, age: 0 };
  const p = makePlayer(1280, groundY);
  let fell = false;
  for (let i = 0; i < 60 && !fell; i++) fell = P.stepPlayer(p, DT, groundY, [pit]) === "fell";
  assert.equal(fell, true);
});

test("pad launches only from above and gives two air jumps", () => {
  const groundY = 590;
  const pad = { type: "pad", x: 281, w: 44, h: 10, age: 0 };
  const p = makePlayer(1280, groundY);
  assert.equal(P.interact(pad, p, groundY), "launch");
  P.launch(p);
  assert.equal(p.vy, P.PAD_VELOCITY);
  assert.equal(P.tryJump(p), 2);
  assert.equal(P.tryJump(p), 3);
  assert.equal(P.tryJump(p), 0);
});

test("tiers rise with score and gaps shrink with tier", () => {
  assert.equal(P.tierForScore(0), 0);
  assert.equal(P.tierForScore(399), 0);
  assert.equal(P.tierForScore(400), 1);
  assert.equal(P.tierForScore(1200), 2);
  assert.equal(P.tierForScore(99999), 3);
  const rng0 = () => 0;
  assert.ok(P.chunkGap(0, rng0) > P.chunkGap(3, rng0));
  assert.ok(P.chunkGap(3, rng0) >= 0.35);
});

test("pickChunk respects the tier cap, never repeats, and reaches every chunk", () => {
  const rng = E.mulberry32(7);
  const seen = new Set();
  let last = null;
  for (let i = 0; i < 4000; i++) {
    const tier = i % 4;
    const c = P.pickChunk(tier, rng, last);
    assert.ok(c.tier <= tier);
    assert.notEqual(c.id, last);
    seen.add(c.id);
    last = c.id;
  }
  assert.equal(seen.size, P.CHUNKS.length);
});

test("variety: 60 s of tier-appropriate picks covers at least 4 hazard types", () => {
  const rng = E.mulberry32(42);
  const types = new Set();
  let last = null, score = 0;
  for (let t = 0; t < 60; t += 1.5) {
    score = Math.floor((420 * t + 8 * t * t) / 8);
    const c = P.pickChunk(P.tierForScore(score), rng, last);
    last = c.id;
    c.items.forEach((it) => types.add(it.type));
  }
  assert.ok(types.size >= 4, [...types].join(","));
});

test("buildChunk places items by time: spacing scales with speed", () => {
  const c = P.CHUNKS.find((x) => x.id === "spike-spike");
  const slow = P.buildChunk(c, 420, 0, 590).obstacles;
  const fast = P.buildChunk(c, 1100, 0, 590).obstacles;
  assert.equal(slow[1].x - slow[0].x, 0.8 * 420);
  assert.equal(fast[1].x - fast[0].x, 0.8 * 1100);
});
