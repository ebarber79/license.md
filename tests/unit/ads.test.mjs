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

test("a rejected provider promise degrades to false (no unhandled rejection)", async () => {
  delete require.cache[require.resolve("../../ads.js")];
  window.NEONDASH_AD_PROVIDER = {
    available: true,
    rewarded() { return Promise.reject(new Error("ad failed")); },
    init() {}, gameplayStart() {}, gameplayStop() {}, commercialBreak() {},
  };
  require("../../ads.js");
  const ok = await window.NeonAds.rewarded("revive");
  assert.equal(ok, false, "rejected ad resolves to false, not a throw");
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

// ---- Full Launch: portal mute (CrazyGames muteAudio) ----
function loadWith(provider) {
  delete require.cache[require.resolve("../../ads.js")];
  window.NEONDASH_AD_PROVIDER = provider;
  require("../../ads.js");
  return window.NeonAds;
}
const base = { available: true, init() {}, gameplayStart() {}, gameplayStop() {}, commercialBreak() {}, rewarded() { return false; } };

test("onMuteChange: reports the portal's current mute, then each change (deduped)", async () => {
  let listener = null;
  const a = loadWith({ ...base, muteAudio() { return true; }, onSettingsChange(cb) { listener = cb; } });
  const seen = [];
  await a.onMuteChange((m) => seen.push(m));
  assert.deepEqual(seen, [true], "initial state delivered after init");
  listener(true);  // unchanged -> no duplicate
  listener(false);
  listener(false);
  listener(true);
  assert.deepEqual(seen, [true, false, true]);
});

test("onMuteChange: no callback without a mute-capable provider (local/PWA untouched)", async () => {
  const a = loadWith({ ...base });
  const seen = [];
  await a.onMuteChange((m) => seen.push(m));
  assert.deepEqual(seen, []);
});

test("onMuteChange: a throwing provider degrades safely", async () => {
  const a = loadWith({ ...base, muteAudio() { throw new Error("x"); }, onSettingsChange() { throw new Error("y"); } });
  await a.onMuteChange(() => {});
  assert.ok(true, "no throw");
});

test("CrazyGames adapter: reads SDK settings.muteAudio and forwards listener changes", async () => {
  let sdkListener = null;
  window.CrazyGames = { SDK: {
    environment: "crazygames",
    init() { return Promise.resolve(); },
    game: { settings: { muteAudio: false }, gameplayStart() {}, gameplayStop() {},
      addSettingsChangeListener(fn) { sdkListener = fn; } },
    ad: { requestAd() {} },
  } };
  delete require.cache[require.resolve("../../integrations/crazygames/ad-provider.crazygames.js")];
  delete window.NEONDASH_AD_PROVIDER;
  require("../../integrations/crazygames/ad-provider.crazygames.js");
  const p = window.NEONDASH_AD_PROVIDER;
  assert.equal(p.muteAudio(), false);
  window.CrazyGames.SDK.game.settings.muteAudio = true;
  assert.equal(p.muteAudio(), true);
  const a = loadWith(p);
  const seen = [];
  await a.onMuteChange((m) => seen.push(m));
  sdkListener({ muteAudio: false });
  assert.deepEqual(seen, [true, false]);
  delete window.CrazyGames;
});
