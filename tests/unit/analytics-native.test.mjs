// ND-034: the Android app sends events to the VPS receiver; the web build never does.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const sent = [];
globalThis.window = globalThis;
globalThis.location = { search: "" };
globalThis.addEventListener = () => {};
globalThis.Capacitor = { isNativePlatform: () => true };
Object.defineProperty(globalThis, "navigator", {
  value: { sendBeacon: (url, body) => { sent.push({ url, body: JSON.parse(body) }); return true; } },
  configurable: true,
});

const require = createRequire(import.meta.url);
require("../../analytics.js");

test("native: app_open is sent on load to the VPS endpoint", () => {
  assert.equal(window.NeonAnalytics.platform, "android");
  assert.match(window.NeonAnalytics.endpoint, /^https:\/\/.+\/nd\/e$/);
  const open = sent.find((s) => s.body.event === "app_open");
  assert.ok(open, "app_open beacon sent");
  assert.equal(open.url, window.NeonAnalytics.endpoint);
  assert.equal(open.body.platform, "android");
  assert.match(open.body.build, /^\d+ \(\d+\.\d+\)$/);
});

test("native: events carry session but no persistent id", () => {
  window.NeonAnalytics.track("game_over", { score: 7 });
  const last = sent.at(-1).body;
  assert.equal(last.event, "game_over");
  assert.equal(last.session, window.NeonAnalytics.sessionId);
  assert.equal(last.install, undefined);
});

test("native: error stacks are capped", () => {
  window.NeonAnalytics.trackError("onerror", "x", "s".repeat(5000));
  assert.ok(sent.at(-1).body.stack.length <= 1500);
});
