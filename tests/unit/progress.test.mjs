import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

globalThis.window = globalThis;
const require = createRequire(import.meta.url);
require("../../progress.js");

// In-memory storage + controllable clock.
function harness(startISO) {
  const map = new Map();
  const storage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
  };
  let cur = new Date(startISO);
  const now = () => cur;
  const setDate = (iso) => { cur = new Date(iso); };
  return { p: window.NeonProgress.create(storage, now), setDate };
}

test("startDay: first play starts a streak and grants a login reward", () => {
  const { p } = harness("2026-06-19T10:00:00Z");
  const r = p.startDay();
  assert.equal(r.isNewDay, true);
  assert.equal(r.streak, 1);
  assert.ok(r.reward > 0);
  // Same day again -> no new day, no reward.
  const r2 = p.startDay();
  assert.equal(r2.isNewDay, false);
  assert.equal(r2.reward, 0);
});

test("streak: consecutive day increments, a gap resets to 1", () => {
  const h = harness("2026-06-19T10:00:00Z");
  assert.equal(h.p.startDay().streak, 1);
  h.setDate("2026-06-20T10:00:00Z");
  assert.equal(h.p.startDay().streak, 2);
  h.setDate("2026-06-21T09:00:00Z");
  assert.equal(h.p.startDay().streak, 3);
  h.setDate("2026-06-23T09:00:00Z"); // skipped the 22nd
  assert.equal(h.p.startDay().streak, 1);
});

test("daily challenge: completing it pays out exactly once", () => {
  const h = harness("2026-06-19T10:00:00Z");
  h.p.startDay();
  const d = h.p.summary().daily; // target/metric vary by date, but progress logic is uniform
  // Earn well past any daily target via gems + powerups in one run.
  const res = h.p.recordRun({ score: 100, gems: 100, powerups: 20 });
  assert.ok(res.rewards > 0, "reward granted on completion");
  assert.ok(res.completed.some((c) => c.type === "daily"), "daily marked complete");
  // A second run does not pay the daily again.
  const res2 = h.p.recordRun({ score: 100, gems: 100, powerups: 20 });
  assert.equal(res2.completed.some((c) => c.type === "daily"), false);
  assert.ok(d.target > 0);
});

test("missions: lifetime goals pay out once when crossed", () => {
  const h = harness("2026-06-19T10:00:00Z");
  h.p.startDay();
  const r1 = h.p.recordRun({ score: 600, gems: 60, powerups: 16 }); // crosses gems_50, score_500, power_15
  const ids = r1.completed.filter((c) => c.type === "mission").map((c) => c.desc);
  assert.ok(ids.length >= 3, "multiple missions completed");
  const summary = h.p.summary();
  assert.ok(summary.missions.find((m) => m.desc === "Reach 500 in a run").done);
  // Re-running doesn't re-pay an already-claimed mission.
  const r2 = h.p.recordRun({ score: 10, gems: 1, powerups: 0 });
  assert.equal(r2.completed.some((c) => c.desc === "Collect 50 gems"), false);
});

test("summary reflects streak and progress", () => {
  const h = harness("2026-06-19T10:00:00Z");
  h.p.startDay();
  h.p.recordRun({ score: 300, gems: 5, powerups: 1 });
  const s = h.p.summary();
  assert.equal(s.streak, 1);
  assert.ok(s.daily.target > 0);
  assert.equal(s.missions.length, 5);
});
