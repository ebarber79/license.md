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

  function call(fn, arg) {
    try {
      var impl = (provider && provider[fn]) ? provider[fn].bind(provider) : stub[fn];
      var r = impl(arg);
      return (r && typeof r.then === "function") ? r : Promise.resolve(r);
    } catch (e) {
      log("error in", fn, e);
      // rewarded must resolve to a boolean (no reward on error); others void.
      return Promise.resolve(fn === "rewarded" ? false : undefined);
    }
  }

  global.NeonAds = {
    init: function () { return call("init"); },
    gameplayStart: function () { return call("gameplayStart"); },
    gameplayStop: function () { return call("gameplayStop"); },
    commercialBreak: function () { return call("commercialBreak"); },
    rewarded: function (name) { return call("rewarded", name); },
    get available() { return !!(provider && provider.available); },
  };
})(window);
