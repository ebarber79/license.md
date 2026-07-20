/* =========================================================================
 * Neon Dash — native Google AdMob ad provider (Capacitor).
 *
 * Implements the window.NEONDASH_AD_PROVIDER interface that ads.js consumes,
 * backed by @capacitor-community/admob. Load order: AFTER ad-provider.js
 * (CrazyGames) and BEFORE ads.js.
 *
 * NATIVE-ONLY: this only takes over monetization when the game runs inside the
 * Capacitor native shell (Android/iOS). On the web / CrazyGames / CI it does
 * nothing — Capacitor is absent, so NEONDASH_AD_PROVIDER is left untouched and
 * ads.js falls back to the CrazyGames provider (portal) or the safe stub (web).
 * The two providers are mutually exclusive: CrazyGames only activates when
 * embedded in a portal iframe, AdMob only when native — a native app is never
 * an embedded iframe, so they never fight over the provider slot.
 *
 * ⚠️ TESTING FLAG: the ad unit IDs below are the REAL units from the user's
 * AdMob account (Neon Dash app), and the real app ID is wired in
 * AndroidManifest.xml (com.google.android.gms.ads.APPLICATION_ID). However
 * IS_TESTING is deliberately still `true`: showing REAL ads to yourself during
 * development can get an AdMob account flagged for invalid traffic. Flip
 * IS_TESTING to `false` as the FINAL step, when building the release APK.
 * ========================================================================= */
(function (global) {
  "use strict";

  var cap = global.Capacitor;
  var isNative = !!(cap && typeof cap.isNativePlatform === "function" && cap.isNativePlatform());
  if (!isNative) return;                                  // web / portal / CI -> leave as-is

  var AdMob = cap.Plugins && cap.Plugins.AdMob;
  if (!AdMob) return;                                     // plugin not linked -> stay stubbed

  // Real AdMob ad units (Android) for the Neon Dash app. ----------------------
  var TEST = {
    interstitial: "ca-app-pub-6072709464334522/3616110679",
    rewarded:     "ca-app-pub-6072709464334522/3241274379",
  };
  // Keep true during development; flip to false only for the release build.
  var IS_TESTING = true;

  function once(fn) { var done = false; return function () { if (done) return; done = true; return fn.apply(null, arguments); }; }

  var provider = {
    available: false,
    _initP: null,

    init: function () {
      var self = this;
      if (self._initP) return self._initP;
      self._initP = Promise.resolve(
        AdMob.initialize({ initializeForTesting: IS_TESTING, testingDevices: [] })
      ).then(function () {
        self.available = true;
      }).catch(function () { /* never reject; ads.js degrades to no-ad */ });
      return self._initP;
    },

    // AdMob has no gameplay-lifecycle signals; no-ops keep the interface whole.
    gameplayStart: function () {},
    gameplayStop: function () {},

    // Interstitial / commercial break — always resolves (ad optional).
    commercialBreak: function () {
      return Promise.resolve()
        .then(function () { return AdMob.prepareInterstitial({ adId: TEST.interstitial, isTesting: IS_TESTING }); })
        .then(function () { return AdMob.showInterstitial(); })
        .then(function () {}, function () {});   // swallow load/show failure
    },

    // Rewarded — resolves true ONLY if the user actually earned the reward.
    rewarded: function (name) {
      return new Promise(function (resolve) {
        var earned = false;
        var handles = [];
        var settle = once(function (v) {
          handles.forEach(function (h) { try { if (h && h.remove) h.remove(); } catch (e) {} });
          resolve(v);
        });

        function listen(evt, cb) {
          try {
            var p = AdMob.addListener(evt, cb);
            Promise.resolve(p).then(function (h) { handles.push(h); });
          } catch (e) {}
        }

        listen("onRewardedVideoAdReward", function () { earned = true; });
        listen("onRewardedVideoAdDismissed", function () { settle(earned); });
        listen("onRewardedVideoAdFailedToLoad", function () { settle(false); });
        listen("onRewardedVideoAdFailedToShow", function () { settle(false); });

        Promise.resolve(AdMob.prepareRewardVideoAd({ adId: TEST.rewarded, isTesting: IS_TESTING }))
          .then(function () { return AdMob.showRewardVideoAd(); })
          .catch(function () { settle(false); });   // prepare/show threw synchronously

        // Safety net: never hang the reward flow forever if no event arrives.
        try { global.setTimeout(function () { settle(earned); }, 60000); } catch (e) {}
      });
    },
  };

  global.NEONDASH_AD_PROVIDER = provider;
})(window);
