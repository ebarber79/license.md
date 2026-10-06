/* =========================================================================
 * Neon Dash — portal-agnostic in-app-purchase adapter (gem packs).
 *
 * Mirrors ads.js: a safe STUB by default (no network, no store) so web play
 * and CI are unaffected and the strict CSP stays intact. A real store is wired
 * by providing window.NEONDASH_IAP_PROVIDER BEFORE this script loads:
 *
 *   window.NEONDASH_IAP_PROVIDER = {
 *     available: true,
 *     init()        { return store.init(); },              // Promise
 *     packs()       { return [{id, gems, priceString, title}]; }, // sync list
 *     buy(packId)   { return store.buy(packId); },         // Promise<{ok,gems,cancelled?}>
 *     restore()     { return store.restore(); },           // Promise
 *   };
 *
 * `packs()` is the authoritative catalog (gem amounts + localized store prices)
 * and `buy()` returns how many gems to credit — the game never hardcodes either,
 * so pricing/catalog live entirely in the provider (see iap-provider.js).
 * ========================================================================= */
(function (global) {
  "use strict";

  var debug = /[?&]debug=1/.test(global.location ? global.location.search : "");
  function log() {
    if (debug && global.console) {
      global.console.log.apply(global.console, ["[iap]"].concat([].slice.call(arguments)));
    }
  }

  // Stub: no store. buy() never grants; packs() is empty so the UI stays hidden.
  var stub = {
    available: false,
    init: function () { return Promise.resolve(); },
    packs: function () { return []; },
    buy: function (id) { log("buy", id, "(stub — no store)"); return Promise.resolve({ ok: false, gems: 0 }); },
    restore: function () { log("restore (stub)"); return Promise.resolve(); },
  };

  var provider = global.NEONDASH_IAP_PROVIDER || stub;

  // Run provider.init() once and gate store calls on it (same discipline as ads.js).
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

  global.NeonIAP = {
    init: function () { return ensureInit(); },
    // Synchronous snapshot of the catalog; empty until init() has populated it.
    packs: function () {
      try { return (provider && provider.packs) ? (provider.packs() || []) : []; }
      catch (e) { log("packs threw", e); return []; }
    },
    // Resolves { ok, gems, cancelled? }. Degrades to a safe no-grant on any error.
    buy: function (packId) {
      return ensureInit().then(function () {
        try {
          var r = (provider && provider.buy) ? provider.buy(packId) : stub.buy(packId);
          return Promise.resolve(r).then(
            function (v) { return v || { ok: false, gems: 0 }; },
            function (e) { log("buy rejected", e); return { ok: false, gems: 0 }; }
          );
        } catch (e) { log("buy threw", e); return { ok: false, gems: 0 }; }
      });
    },
    restore: function () {
      return ensureInit().then(function () {
        try { return Promise.resolve((provider && provider.restore) ? provider.restore() : undefined); }
        catch (e) { log("restore threw", e); return undefined; }
      });
    },
    get available() { return !!(provider && provider.available); },
  };
})(window);
