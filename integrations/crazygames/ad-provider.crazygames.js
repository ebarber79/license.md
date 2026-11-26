/* =========================================================================
 * Neon Dash — CrazyGames ad provider (drop-in for NeonAds).
 *
 * This is the same-origin adapter file referenced by docs/MONETIZATION.md.
 * It implements window.NEONDASH_AD_PROVIDER using the CrazyGames HTML5 SDK,
 * so ads.js picks it up automatically (CSP-safe: no inline script needed).
 *
 * Wiring (in index.html, BEFORE ads.js — see ./README.md):
 *   <script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>
 *   <script src="ad-provider.crazygames.js"></script>
 *   ... existing analytics.js / ads.js / engine.js / game.js ...
 *
 * API verified against CrazyGames docs (June 2026):
 *   window.CrazyGames.SDK.init() -> Promise
 *   window.CrazyGames.SDK.game.gameplayStart() / gameplayStop()
 *   window.CrazyGames.SDK.ad.requestAd("midgame"|"rewarded",
 *     { adStarted, adFinished, adError })   // adFinished == reward earned
 *   window.CrazyGames.SDK.game.settings.muteAudio  (Full Launch: must win
 *     over in-game audio toggles) + game.addSettingsChangeListener(fn)
 * ========================================================================= */

(function () {
  "use strict";

  function sdk() { return window.CrazyGames && window.CrazyGames.SDK; }
  // Basic Launch has CrazyGames ads switched off. After the first rewarded-ad
  // error, report ads as unavailable so the game hides its "watch ad" buttons
  // instead of offering rewards that can't load.
  var adsFailed = false;

  function requestAd(type) {
    return new Promise(function (resolve) {
      var s = sdk();
      if (!s || !s.ad || !s.ad.requestAd) { resolve(type === "rewarded" ? false : undefined); return; }
      var settled = false;
      var done = function (v) { if (!settled) { settled = true; resolve(v); } };
      s.ad.requestAd(type, {
        // Mute while the ad plays (CrazyGames requirement); NeonAds callers
        // don't need it, but it's polite — the game pauses on gameplayStop.
        adStarted: function () {},
        adFinished: function () { done(type === "rewarded" ? true : undefined); },
        adError: function () { if (type === "rewarded") adsFailed = true; done(type === "rewarded" ? false : undefined); },
      });
    });
  }

  window.NEONDASH_AD_PROVIDER = {
    get available() {
      var s = sdk();
      if (adsFailed || !s) return false;
      return s.environment !== "disabled";
    },
    init: function () {
      var s = sdk();
      try { return Promise.resolve(s && s.init ? s.init() : undefined); }
      catch (e) { return Promise.resolve(); }
    },
    gameplayStart: function () { var s = sdk(); if (s && s.game) s.game.gameplayStart(); },
    gameplayStop: function () { var s = sdk(); if (s && s.game) s.game.gameplayStop(); },
    // Full Launch requirement: respect the SDK's muteAudio setting.
    muteAudio: function () {
      var s = sdk();
      return !!(s && s.game && s.game.settings && s.game.settings.muteAudio);
    },
    onSettingsChange: function (cb) {
      var s = sdk();
      if (!s || !s.game || !s.game.addSettingsChangeListener) return;
      s.game.addSettingsChangeListener(function (ns) { cb(!!(ns && ns.muteAudio)); });
    },
    commercialBreak: function () { return requestAd("midgame"); },
    rewarded: function () { return requestAd("rewarded"); },
  };
})();
