/* =========================================================================
 * Neon Dash — GameDistribution ad provider (drop-in for NeonAds).
 *
 * Implements window.NEONDASH_AD_PROVIDER using the GameDistribution HTML5 SDK.
 * IMPORTANT: set your real gameId (from the GameDistribution dashboard) below,
 * and enable the "rewarded ads" flag for the game in the dashboard or rewarded
 * requests will fail.
 *
 * Wiring (in index.html, BEFORE ads.js — see ./README.md). GD_OPTIONS must be
 * defined BEFORE the SDK script loads:
 *   <script src="ad-provider.gamedistribution.js"></script>   // sets GD_OPTIONS + provider
 *   <script src="https://html5.api.gamedistribution.com/main.min.js"></script>
 *   ... existing analytics.js / ads.js / engine.js / game.js ...
 *
 * API verified against GameDistribution docs (June 2026):
 *   window.GD_OPTIONS = { gameId, onEvent }
 *   window.gdsdk.showAd("interstitial") -> Promise
 *   window.gdsdk.showAd("rewarded")     -> Promise (resolve = reward, reject = skip/fail)
 * ========================================================================= */

(function () {
  "use strict";

  var GAME_ID = "REPLACE_WITH_YOUR_GAMEDISTRIBUTION_GAME_ID";

  // Configure the SDK before its script tag runs. onEvent lets GD tell us to
  // pause/resume around display ads; we forward those to the game if present.
  window.GD_OPTIONS = window.GD_OPTIONS || {
    gameId: GAME_ID,
    onEvent: function (event) {
      // event.name is e.g. "SDK_GAME_PAUSE" / "SDK_GAME_START".
      // NeonAds already brackets rewarded/interstitial; no action required here,
      // but you can hook pause/resume if you add display ads later.
    },
  };

  function gd() { return window.gdsdk; }

  window.NEONDASH_AD_PROVIDER = {
    available: true,
    init: function () { return Promise.resolve(); }, // GD self-initializes on script load
    gameplayStart: function () {},                   // GD has no explicit start/stop call
    gameplayStop: function () {},
    commercialBreak: function () {
      var s = gd();
      if (!s || !s.showAd) return Promise.resolve();
      try { return Promise.resolve(s.showAd("interstitial")).then(function () {}, function () {}); }
      catch (e) { return Promise.resolve(); }
    },
    rewarded: function () {
      var s = gd();
      if (!s || !s.showAd) return Promise.resolve(false);
      try {
        return Promise.resolve(s.showAd("rewarded")).then(function () { return true; }, function () { return false; });
      } catch (e) { return Promise.resolve(false); }
    },
  };
})();
