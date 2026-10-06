import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// admob-provider.js only activates inside a native Capacitor shell, so the e2e
// suite (web) never exercises it. Load it in a sandbox with a fake native
// Capacitor + AdMob plugin and record exactly what reaches the SDK.
const SRC = readFileSync(new URL("../../admob-provider.js", import.meta.url), "utf8");

const LIVE_INTERSTITIAL = "ca-app-pub-6072709464334522/3616110679";
const LIVE_REWARDED = "ca-app-pub-6072709464334522/3241274379";

function load({ native = true, plugin = true } = {}) {
  const calls = [];
  const listeners = {};
  const AdMob = {
    initialize: (o) => { calls.push(["initialize", o]); return Promise.resolve(); },
    prepareInterstitial: (o) => { calls.push(["prepareInterstitial", o]); return Promise.resolve(); },
    showInterstitial: () => { calls.push(["showInterstitial"]); return Promise.resolve(); },
    prepareRewardVideoAd: (o) => { calls.push(["prepareRewardVideoAd", o]); return Promise.resolve(); },
    showRewardVideoAd: () => {
      calls.push(["showRewardVideoAd"]);
      // Simulate a watched-to-the-end rewarded ad.
      setTimeout(() => { listeners.onRewardedVideoAdReward?.(); listeners.onRewardedVideoAdDismissed?.(); }, 0);
      return Promise.resolve();
    },
    addListener: (evt, cb) => { listeners[evt] = cb; return Promise.resolve({ remove() {} }); },
  };
  const window = {
    Capacitor: { isNativePlatform: () => native, Plugins: plugin ? { AdMob } : {} },
    setTimeout: () => 0, // disable the 60s safety net so tests don't hang
  };
  vm.runInNewContext(SRC, { window, Promise, setTimeout });
  return { provider: window.NEONDASH_AD_PROVIDER, calls };
}

// Objects built inside the vm realm have foreign prototypes; normalize before deepEqual.
const norm = (v) => JSON.parse(JSON.stringify(v));

test("admob: inert on web (no provider installed)", () => {
  assert.equal(load({ native: false }).provider, undefined);
  assert.equal(load({ plugin: false }).provider, undefined);
});

test("admob: init uses live mode (initializeForTesting false)", async () => {
  const { provider, calls } = load();
  await provider.init();
  assert.equal(provider.available, true);
  assert.deepEqual(norm(calls[0]), ["initialize", { initializeForTesting: false, testingDevices: [] }]);
});

test("admob: interstitial requests the real live unit", async () => {
  const { provider, calls } = load();
  await provider.commercialBreak();
  assert.deepEqual(norm(calls[0]), ["prepareInterstitial", { adId: LIVE_INTERSTITIAL, isTesting: false }]);
  assert.deepEqual(norm(calls[1]), ["showInterstitial"]);
});

test("admob: rewarded requests the real live unit and resolves true when earned", async () => {
  const { provider, calls } = load();
  const earned = await provider.rewarded("revive");
  assert.equal(earned, true);
  assert.deepEqual(norm(calls[0]), ["prepareRewardVideoAd", { adId: LIVE_REWARDED, isTesting: false }]);
});
