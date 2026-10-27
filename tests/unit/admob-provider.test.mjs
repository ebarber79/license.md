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

// Default UMP answer: a user outside regulated regions (no form, ads allowed).
const CONSENT_OK = { status: "NOT_REQUIRED", isConsentFormAvailable: false, canRequestAds: true,
  privacyOptionsRequirementStatus: "NOT_REQUIRED" };

function load({ native = true, plugin = true, consent = CONSENT_OK, afterForm = null, consentError = false } = {}) {
  const calls = [];
  const listeners = {};
  const AdMob = {
    requestConsentInfo: (o) => {
      calls.push(["requestConsentInfo", o]);
      return consentError ? Promise.reject(new Error("offline")) : Promise.resolve(consent);
    },
    showConsentForm: () => { calls.push(["showConsentForm"]); return Promise.resolve(afterForm); },
    showPrivacyOptionsForm: () => { calls.push(["showPrivacyOptionsForm"]); return Promise.resolve(); },
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

const LIVE_INIT = {
  initializeForTesting: false, testingDevices: [],
  tagForChildDirectedTreatment: false, tagForUnderAgeOfConsent: false, maxAdContentRating: "ParentalGuidance",
};
const only = (calls, name) => calls.filter((c) => c[0] === name);

test("admob: checks consent first, then inits live mode with the 13+/PG audience config", async () => {
  const { provider, calls } = load();
  await provider.init();
  assert.equal(provider.available, true);
  assert.equal(provider.adsBlocked, false);
  assert.deepEqual(norm(calls[0]), ["requestConsentInfo", { tagForUnderAgeOfConsent: false }]);
  assert.deepEqual(norm(calls[1]), ["initialize", LIVE_INIT]);
  assert.equal(only(calls, "showConsentForm").length, 0);
});

test("admob: consent REQUIRED shows the form, then inits when the user allows ads", async () => {
  const { provider, calls } = load({
    consent: { status: "REQUIRED", isConsentFormAvailable: true, canRequestAds: false, privacyOptionsRequirementStatus: "REQUIRED" },
    afterForm: { status: "OBTAINED", canRequestAds: true, privacyOptionsRequirementStatus: "REQUIRED" },
  });
  await provider.init();
  assert.equal(only(calls, "showConsentForm").length, 1);
  assert.deepEqual(norm(only(calls, "initialize")[0]), ["initialize", LIVE_INIT]);
  assert.equal(provider.available, true);
  assert.equal(provider.privacyOptionsRequired, true);
});

test("admob: no consent means no SDK init, no ad requests, no reward buttons", async () => {
  const { provider, calls } = load({
    consent: { status: "REQUIRED", isConsentFormAvailable: true, canRequestAds: false, privacyOptionsRequirementStatus: "REQUIRED" },
    afterForm: { status: "REQUIRED", canRequestAds: false, privacyOptionsRequirementStatus: "REQUIRED" },
  });
  await provider.init();
  assert.equal(provider.available, false);
  assert.equal(provider.adsBlocked, true);
  assert.equal(only(calls, "initialize").length, 0);
  await provider.commercialBreak();
  assert.equal(await provider.rewarded("revive"), false);
  assert.equal(only(calls, "prepareInterstitial").length + only(calls, "prepareRewardVideoAd").length, 0);
});

test("admob: a consent-SDK failure serves no ads (fails closed)", async () => {
  const { provider, calls } = load({ consentError: true });
  await provider.init();
  assert.equal(provider.available, false);
  assert.equal(only(calls, "initialize").length, 0);
});

test("admob: privacy options form re-checks consent and stops ads if withdrawn", async () => {
  // The re-check after the form returns "consent withdrawn".
  const withdrawn = { status: "REQUIRED", canRequestAds: false, privacyOptionsRequirementStatus: "REQUIRED" };
  const { provider, calls } = load({ consent: withdrawn });
  provider.available = true; // ads were running before the user opened the form
  await provider.showPrivacyOptions();
  assert.equal(only(calls, "showPrivacyOptionsForm").length, 1);
  assert.equal(provider.available, false);
  assert.equal(provider.adsBlocked, true);
});

test("admob: interstitial requests the real live unit", async () => {
  const { provider, calls } = load();
  await provider.init();
  calls.length = 0;
  await provider.commercialBreak();
  assert.deepEqual(norm(calls[0]), ["prepareInterstitial", { adId: LIVE_INTERSTITIAL, isTesting: false }]);
  assert.deepEqual(norm(calls[1]), ["showInterstitial"]);
});

test("admob: rewarded requests the real live unit and resolves true when earned", async () => {
  const { provider, calls } = load();
  await provider.init();
  calls.length = 0;
  const earned = await provider.rewarded("revive");
  assert.equal(earned, true);
  assert.deepEqual(norm(calls[0]), ["prepareRewardVideoAd", { adId: LIVE_REWARDED, isTesting: false }]);
});
