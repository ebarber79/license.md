import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

globalThis.window = globalThis;
globalThis.location = { search: "" };

const require = createRequire(import.meta.url);
require("../../ads.js");

test("stub: NeonAds exposes the adapter interface", () => {
  const a = window.NeonAds;
  for (const fn of ["init", "gameplayStart", "gameplayStop", "commercialBreak", "rewarded"]) {
    assert.equal(typeof a[fn], "function", `${fn} is a function`);
  }
  assert.equal(a.available, false, "stub reports no real provider");
});

test("stub: lifecycle calls resolve to promises", async () => {
  await window.NeonAds.init();
  await window.NeonAds.commercialBreak();
  assert.ok(true, "no throw");
});

test("stub: rewarded() auto-grants (resolves true) so the UX is testable", async () => {
  const ok = await window.NeonAds.rewarded("double_gems");
  assert.equal(ok, true);
});

test("a thrown provider degrades safely", async () => {
  // Re-evaluate ads.js with a broken provider to exercise the try/catch path.
  delete require.cache[require.resolve("../../ads.js")];
  window.NEONDASH_AD_PROVIDER = {
    available: true,
    rewarded() { throw new Error("boom"); },
    init() {}, gameplayStart() {}, gameplayStop() {}, commercialBreak() {},
  };
  require("../../ads.js");
  const ok = await window.NeonAds.rewarded("double_gems");
  assert.equal(ok, false, "reward denied (not granted) when provider throws");
});
