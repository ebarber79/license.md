import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

// Minimal browser-ish globals so analytics.js can attach + capture errors.
const handlers = {};
globalThis.window = globalThis;
globalThis.location = { search: "" };
// Note: Node provides a read-only `navigator` with no sendBeacon, so
// analytics.js falls back to its in-memory buffer — exactly what we assert on.
globalThis.addEventListener = (type, fn) => { handlers[type] = fn; };

const require = createRequire(import.meta.url);
require("../../analytics.js");

test("track buffers events with session + build metadata", () => {
  const before = window.NeonAnalytics._buffer.length;
  window.NeonAnalytics.track("game_start", { skin: "cyan" });
  const buf = window.NeonAnalytics._buffer;
  assert.equal(buf.length, before + 1);
  const last = buf[buf.length - 1];
  assert.equal(last.event, "game_start");
  assert.equal(last.props.skin, "cyan");
  assert.ok(last.session, "has session id");
  assert.ok(typeof last.t === "number", "has timestamp");
});

test("game_over payload carries score/gems/cause", () => {
  window.NeonAnalytics.track("game_over", { score: 42, gems: 5, cause: "spikes" });
  const last = window.NeonAnalytics._buffer.at(-1);
  assert.equal(last.event, "game_over");
  assert.equal(last.props.score, 42);
  assert.equal(last.props.cause, "spikes");
});

test("ND-AN-05: window error is captured with stack + source", () => {
  assert.ok(handlers.error, "error handler registered");
  handlers.error({ message: "boom", error: { stack: "at game.js:1" }, filename: "game.js", lineno: 1, colno: 2 });
  const last = window.NeonAnalytics._buffer.at(-1);
  assert.equal(last.event, "error");
  assert.equal(last.kind, "onerror");
  assert.equal(last.message, "boom");
  assert.match(last.stack, /game\.js/);
  assert.equal(last.extra.line, 1);
});

test("ND-AN-05: unhandled rejection is captured", () => {
  assert.ok(handlers.unhandledrejection, "rejection handler registered");
  handlers.unhandledrejection({ reason: { message: "nope", stack: "at p" } });
  const last = window.NeonAnalytics._buffer.at(-1);
  assert.equal(last.event, "error");
  assert.equal(last.kind, "unhandledrejection");
  assert.equal(last.message, "nope");
});
