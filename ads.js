/* =========================================================================
 * Neon Dash — portal-agnostic monetization adapter.
 *
 * Default implementation is a safe STUB (no network, no external scripts) so
 * local play and CI are unaffected and the strict CSP stays intact. To go
 * live on a portal, provide a real implementation of this interface BEFORE
 * this script loads:
 *
 *   window.NEONDASH_AD_PROVIDER = {
 *     available: true,
 *     init()            { return portalSdk.init(...); },        // Promise
 *     gameplayStart()   { portalSdk.gameplayStart(); },
 *     gameplayStop()    { portalSdk.gameplayStop(); },
 *     commercialBreak() { return portalSdk.commercialBreak(); }, // Promise
 *     rewarded(name)    { return portalSdk.rewarded(name); },    // Promise<bool>
 *   };
 *
 * See docs/MONETIZATION.md for per-portal adapters (CrazyGames / Poki /
 * GameDistribution) and the CSP origins each one needs.
 * ========================================================================= */

(function (global) {
  "use strict";

  var debug = /[?&]debug=1/.test(global.location ? global.location.search : "");
  function log() {
    if (debug && global.console) {
      global.console.log.apply(global.console, ["[ads]"].concat([].slice.call(arguments)));
    }
  }

  // Stub: no ads. rewarded() auto-grants so the reward UX is exercisable in
  // dev; a real provider replaces this with an actual ad view.
  var stub = {
    available: false,
    init: function () { return Promise.resolve(); },
    gameplayStart: function () { log("gameplayStart"); },
    gameplayStop: function () { log("gameplayStop"); },
    commercialBreak: function () { log("commercialBreak (stub)"); return Promise.resolve(); },
    rewarded: function (name) { log("rewarded", name, "(stub auto-grants)"); return Promise.resolve(true); },
  };

  var provider = global.NEONDASH_AD_PROVIDER || stub;

  // Run provider.init() once and gate every other call on it, so a real SDK
  // that must finish initializing before gameplay/ad requests is never called
  // too early (a dropped init() promise on the game side can't race it).
  var initPromise = null;
  function ensureInit() {
    if (!initPromise) {
      initPromise = new Promise(function (resolve) {
        try {
          var r = (provider && provider.init) ? provider.init() : undefined;
          if (r && typeof r.then === "function") r.then(resolve, function (e) { log("init failed", e); resolve(); });
          else resolve();
        } catch (e) { log("init threw", e); resolve(); }
      });
    }
    return initPromise;
  }

  function invoke(fn, arg) {
    var safe = (fn === "rewarded" ? false : undefined);
    try {
      var impl = (provider && provider[fn]) ? provider[fn].bind(provider) : stub[fn];
      var r = impl(arg);
      if (r && typeof r.then === "function") {
        // Degrade safely if the provider's promise rejects (ad/init failure).
        return r.then(function (v) { return v; }, function (e) { log("rejected in", fn, e); return safe; });
      }
      return Promise.resolve(r);
    } catch (e) {
      log("error in", fn, e);
      return Promise.resolve(safe);
    }
  }
  // Non-init calls wait for init to settle first.
  function call(fn, arg) { return ensureInit().then(function () { return invoke(fn, arg); }); }

  global.NeonAds = {
    init: function () { return ensureInit(); },
    gameplayStart: function () { return call("gameplayStart"); },
    gameplayStop: function () { return call("gameplayStop"); },
    commercialBreak: function () { return call("commercialBreak"); },
    rewarded: function (name) { return call("rewarded", name); },
    get available() { return !!(provider && provider.available); },
  };
})(window);
