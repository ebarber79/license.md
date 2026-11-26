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
 *   window.CrazyGames.SDK.data.getItem/setItem/removeItem (localStorage API)
 *   window.CrazyGames.SDK.game.settings.muteAudio  (Full Launch: must win
 *     over in-game audio toggles) + game.addSettingsChangeListener(fn)
 * ========================================================================= */

(function () {
  "use strict";

  function sdk() { return window.CrazyGames && window.CrazyGames.SDK; }
  // Ad state from adError codes (docs.crazygames.com/sdk/video-ads):
  //   adsDisabled -> ads are off for this session (Basic Launch, Kids mode):
  //                  hide every "watch ad" button for the rest of the session.
  //   adblock     -> an ad blocker is on: hide them and show a notice.
  //   unfilled / adCooldown / other -> temporary; the game says "try later".
  var adsDisabled = false;
  var adsBlocked = false;
  var lastAdError = null;
  // SDK.init() runs once; the boot script and NeonAds both wait on it.
  var initPromise = null;

  function requestAd(type, hooks) {
    hooks = hooks || {};
    return new Promise(function (resolve) {
      var s = sdk();
      var fail = type === "rewarded" ? false : undefined;
      if (!s || !s.ad || !s.ad.requestAd) { lastAdError = "nosdk"; resolve(fail); return; }
      var settled = false;
      var done = function (v) { if (!settled) { settled = true; resolve(v); } };
      lastAdError = null;
      try {
        s.ad.requestAd(type, {
          // The game mutes and pauses only once the ad actually starts.
          adStarted: function () { try { hooks.onStart && hooks.onStart(); } catch (e) { /* ignore */ } },
          adFinished: function () { done(type === "rewarded" ? true : undefined); },
          adError: function (err) {
            var code = (err && err.code) || "other";
            lastAdError = code;
            if (code === "adsDisabled" || code === "adsDisabledBasicLaunch") adsDisabled = true;
            if (code === "adblock") adsBlocked = true;
            done(fail); // never reward after adError
          },
        });
      } catch (e) { lastAdError = "other"; done(fail); }
    });
  }

  function detectAdblock() {
    var s = sdk();
    if (!s || !s.ad || typeof s.ad.hasAdblock !== "function") return Promise.resolve();
    try {
      return Promise.resolve(s.ad.hasAdblock()).then(function (b) { if (b) adsBlocked = true; }, function () {});
    } catch (e) { return Promise.resolve(); }
  }

  window.NEONDASH_AD_PROVIDER = {
    get available() {
      var s = sdk();
      if (adsDisabled || adsBlocked || !s) return false;
      return s.environment !== "disabled";
    },
    get adsBlocked() { return adsBlocked; },
    get lastAdError() { return lastAdError; },
    // adStarted is reported, so the game mutes when the ad starts playing,
    // not when it's requested (CrazyGames ad requirement).
    signalsAdStart: true,
    init: function () {
      if (!initPromise) {
        var s = sdk();
        try { initPromise = Promise.resolve(s && s.init ? s.init() : undefined); }
        catch (e) { initPromise = Promise.resolve(); }
        initPromise = initPromise.then(detectAdblock, detectAdblock);
      }
      return initPromise;
    },
    // Full Launch progress save: the SDK data module (localStorage API; synced
    // across devices for signed-in players, local for guests). Null when the
    // module is missing or disabled (Progress Save not set to Data Module on
    // the submission form), so the game keeps using localStorage.
    storage: function () {
      var s = sdk();
      var d = s && s.data;
      if (!d || typeof d.getItem !== "function" || typeof d.setItem !== "function") return null;
      try { d.getItem("neondash.__probe"); } catch (e) { return null; }
      return {
        __name: "crazygames-data",
        getItem: function (k) { return d.getItem(k); },
        setItem: function (k, v) { d.setItem(k, String(v)); },
        removeItem: function (k) { d.removeItem(k); },
      };
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
    commercialBreak: function (hooks) { return requestAd("midgame", hooks); },
    rewarded: function (name, hooks) { return requestAd("rewarded", hooks); },
  };
})();
