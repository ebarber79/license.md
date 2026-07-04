/* =========================================================================
 * Neon Dash — CrazyGames ad provider (HTML5 SDK v3).
 *
 * Implements the window.NEONDASH_AD_PROVIDER interface that ads.js consumes.
 * Must load BEFORE ads.js (same-origin, so the strict CSP 'self' allows it).
 *
 * PORTAL-SAFE: this only activates when the game is running inside CrazyGames
 * (embedded in an iframe) or when explicitly forced with ?portal=crazygames
 * (for their QA tool / local testing). On the standalone public build it does
 * NOT set a provider, so ads.js falls back to the safe stub and the public site
 * behaves exactly as before — no third-party SDK is even loaded.
 *
 * The CrazyGames SDK script is injected dynamically only when activated, so the
 * public build never fetches it. CSP must still list the CrazyGames origins
 * (see index.html) so the injected SDK + ad iframes work inside the portal.
 * ========================================================================= */
(function (global) {
  "use strict";

  var SDK_URL = "https://sdk.crazygames.com/crazygames-sdk-v3.js";
  var loc = global.location || { search: "" };
  var forced = /[?&]portal=crazygames/.test(loc.search);
  var embedded = (function () { try { return global.self !== global.top; } catch (e) { return true; } })();

  // Only take over monetization inside the portal (or when explicitly forced).
  if (!forced && !embedded) return;

  function loadScript(src) {
    return new Promise(function (resolve) {
      var s = global.document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = function () { resolve(true); };
      s.onerror = function () { resolve(false); };
      global.document.head.appendChild(s);
    });
  }

  var provider = {
    available: false,   // flips true once the SDK initializes
    _sdk: null,
    _initP: null,

    init: function () {
      var self = this;
      if (self._initP) return self._initP;
      self._initP = loadScript(SDK_URL).then(function (ok) {
        var sdk = ok && global.CrazyGames && global.CrazyGames.SDK;
        if (!sdk) return;                       // SDK unavailable -> stay stubbed
        var p = sdk.init ? sdk.init() : Promise.resolve();
        return Promise.resolve(p).then(function () {
          self._sdk = sdk;
          self.available = true;
        });
      }).catch(function () { /* never reject; ads.js degrades to no-ad */ });
      return self._initP;
    },

    gameplayStart: function () {
      try { if (this._sdk) this._sdk.game.gameplayStart(); } catch (e) {}
    },
    gameplayStop: function () {
      try { if (this._sdk) this._sdk.game.gameplayStop(); } catch (e) {}
    },

    // Interstitial / commercial break — resolves regardless of outcome.
    commercialBreak: function () {
      var sdk = this._sdk;
      return new Promise(function (resolve) {
        if (!sdk) { resolve(); return; }
        try {
          sdk.ad.requestAd("midgame", {
            adFinished: function () { resolve(); },
            adError: function () { resolve(); },
          });
        } catch (e) { resolve(); }
      });
    },

    // Rewarded — resolves true only if the ad actually finished.
    rewarded: function (name) {
      var sdk = this._sdk;
      return new Promise(function (resolve) {
        if (!sdk) { resolve(false); return; }
        try {
          sdk.ad.requestAd("rewarded", {
            adFinished: function () { resolve(true); },
            adError: function () { resolve(false); },
          });
        } catch (e) { resolve(false); }
      });
    },
  };

  global.NEONDASH_AD_PROVIDER = provider;
})(window);
