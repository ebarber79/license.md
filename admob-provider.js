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
 * LIVE ADS: the ad unit IDs below are the REAL units from the user's AdMob
 * account (Neon Dash app), the real app ID is wired in AndroidManifest.xml
 * (com.google.android.gms.ads.APPLICATION_ID), and IS_TESTING is now `false`
 * — this build serves LIVE, revenue-earning ads. Only ship IS_TESTING=false in
 * signed RELEASE builds; do NOT run it on your own dev device (self-viewed live
 * ads can get an AdMob account flagged for invalid traffic).
 *
 * CONSENT (ND-014): before AdMob starts, Google's User Messaging Platform (UMP)
 * decides whether this user needs a consent form (EEA/UK/Switzerland and other
 * regulated regions). The form is the "GDPR message" published in AdMob >
 * Privacy & messaging. Ads are requested only when UMP says canRequestAds. If
 * UMP asks for a privacy-options entry point, the start screen shows a
 * "Privacy choices" button that reopens the form.
 *
 * AUDIENCE (ND-016): the app is for ages 13+, not child-directed. Ad requests
 * are tagged that way and capped at the ParentalGuidance content rating.
 * ========================================================================= */
(function (global) {
  "use strict";

  var cap = global.Capacitor;
  var isNative = !!(cap && typeof cap.isNativePlatform === "function" && cap.isNativePlatform());
  if (!isNative) return;                                  // web / portal / CI -> leave as-is

  var AdMob = cap.Plugins && cap.Plugins.AdMob;
  if (!AdMob) return;                                     // plugin not linked -> stay stubbed

  // Real AdMob ad units (Android) for the Neon Dash app. ----------------------
  var AD_UNITS = {
    interstitial: "ca-app-pub-6072709464334522/3616110679",
    rewarded:     "ca-app-pub-6072709464334522/3241274379",
  };
  // LIVE ads for the release build. Keep false only in signed release APKs.
  var IS_TESTING = false;
  // Who the ads are for (ND-016): 13+, not child-directed, at most PG ads.
  var AD_REQUEST_CONFIG = {
    tagForChildDirectedTreatment: false,
    tagForUnderAgeOfConsent: false,
    maxAdContentRating: "ParentalGuidance",
  };

  // Ask UMP for this user's consent state; show the form when it is required.
  // Resolves the latest consent info, or null if UMP failed (then no ads).
  function gatherConsent() {
    return Promise.resolve(AdMob.requestConsentInfo({ tagForUnderAgeOfConsent: false }))
      .then(function (info) {
        if (info && info.status === "REQUIRED" && info.isConsentFormAvailable) {
          return Promise.resolve(AdMob.showConsentForm()).then(function (after) { return after || info; });
        }
        return info;
      })
      .catch(function () { return null; });
  }

  function once(fn) { var done = false; return function () { if (done) return; done = true; return fn.apply(null, arguments); }; }

  var provider = {
    available: false,
    _initP: null,

    init: function () {
      var self = this;
      if (self._initP) return self._initP;
      self._initP = gatherConsent().then(function (info) {
        self.privacyOptionsRequired = !!(info && info.privacyOptionsRequirementStatus === "REQUIRED");
        if (!info || !info.canRequestAds) { self.adsBlocked = true; return; }  // no consent -> no ads
        return Promise.resolve(AdMob.initialize({
          initializeForTesting: IS_TESTING,
          testingDevices: [],
          tagForChildDirectedTreatment: AD_REQUEST_CONFIG.tagForChildDirectedTreatment,
          tagForUnderAgeOfConsent: AD_REQUEST_CONFIG.tagForUnderAgeOfConsent,
          maxAdContentRating: AD_REQUEST_CONFIG.maxAdContentRating,
        })).then(function () { self.available = true; });
      }).catch(function () { /* never reject; ads.js degrades to no-ad */ });
      return self._initP;
    },

    // UMP privacy options (the "Privacy choices" button). Re-checks consent after
    // the form closes; a user who withdraws consent gets no more ads this session.
    privacyOptionsRequired: false,
    adsBlocked: false,   // true when the user's consent choice rules out ads (hide ad-reward buttons)
    showPrivacyOptions: function () {
      var self = this;
      return Promise.resolve(AdMob.showPrivacyOptionsForm())
        .then(function () { return AdMob.requestConsentInfo({ tagForUnderAgeOfConsent: false }); })
        .then(function (info) {
          if (info && !info.canRequestAds) { self.available = false; self.adsBlocked = true; }
        })
        .catch(function () {});
    },

    // AdMob has no gameplay-lifecycle signals; no-ops keep the interface whole.
    gameplayStart: function () {},
    gameplayStop: function () {},

    // Interstitial / commercial break — always resolves (ad optional).
    commercialBreak: function () {
      if (!this.available) return Promise.resolve();     // no consent / no SDK -> skip
      return Promise.resolve()
        .then(function () { return AdMob.prepareInterstitial({ adId: AD_UNITS.interstitial, isTesting: IS_TESTING }); })
        .then(function () { return AdMob.showInterstitial(); })
        .then(function () {}, function () {});   // swallow load/show failure
    },

    // Rewarded — resolves true ONLY if the user actually earned the reward.
    rewarded: function (name) {
      if (!this.available) return Promise.resolve(false); // no ad -> no reward
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

        Promise.resolve(AdMob.prepareRewardVideoAd({ adId: AD_UNITS.rewarded, isTesting: IS_TESTING }))
          .then(function () { return AdMob.showRewardVideoAd(); })
          .catch(function () { settle(false); });   // prepare/show threw synchronously

        // Safety net: never hang the reward flow forever if no event arrives.
        try { global.setTimeout(function () { settle(earned); }, 60000); } catch (e) {}
      });
    },
  };

  global.NEONDASH_AD_PROVIDER = provider;
})(window);
