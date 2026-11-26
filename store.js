/* =========================================================================
 * Neon Dash — save storage (NeonStore).
 *
 * Every save goes through NeonStore (same API as localStorage). By default it
 * uses the browser's localStorage, so the website/PWA/app behave as before.
 * A portal build can switch the backend before the game loads, e.g. the
 * CrazyGames build uses the SDK data module (synced across devices for
 * signed-in players) — see integrations/crazygames/boot.crazygames.js.
 *
 * Methods delegate without swallowing errors; callers already wrap storage
 * access in try/catch (storage can be blocked in private mode, ND-DATA-05).
 * ========================================================================= */
(function (global) {
  "use strict";
  var backend = null;
  function b() { return backend || global.localStorage; }
  var NeonStore = {
    getItem: function (k) { return b().getItem(k); },
    setItem: function (k, v) { b().setItem(k, String(v)); },
    removeItem: function (k) { b().removeItem(k); },
    use: function (store) { backend = store || null; },
    get backendName() { return backend ? (backend.__name || "custom") : "localStorage"; },
  };
  global.NeonStore = NeonStore;
  if (typeof module === "object" && module.exports) module.exports = NeonStore;
})(typeof window !== "undefined" ? window : globalThis);
