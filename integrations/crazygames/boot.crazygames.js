/* =========================================================================
 * Neon Dash — CrazyGames boot (Full Launch progress save).
 *
 * Loaded instead of the game scripts in the CrazyGames build. It waits for
 * CrazyGames.SDK.init() (which preloads the player's saved data), points
 * NeonStore at the SDK data module, copies an existing local save into the
 * data module once, and then loads the game scripts in order.
 *
 * Migration (CrazyGames guidance: read before writing so progress isn't
 * lost): copy "neondash.*" keys from localStorage only when the data module
 * has no Neon Dash save yet. Never overwrites existing data-module values.
 *
 * If init or the data module fails, or init takes longer than
 * BOOT_TIMEOUT_MS, the game starts on localStorage as before.
 * ========================================================================= */
(function (global) {
  "use strict";

  var GAME_SCRIPTS = ["progress.js", "music.js", "engine.js", "game.js"];
  var BOOT_TIMEOUT_MS = 10000;
  var PREFIX = "neondash.";
  // Keys whose presence means "this player already has a data-module save".
  var SAVE_KEYS = ["neondash.best", "neondash.bank", "neondash.runs", "neondash.progress",
    "neondash.skins", "neondash.lifetimeGems", "neondash.tutorialDone", "neondash.__migrated"];

  function localKeys() {
    var out = [];
    try {
      var ls = global.localStorage;
      for (var i = 0; i < ls.length; i++) {
        var k = ls.key(i);
        if (k && k.indexOf(PREFIX) === 0) out.push(k);
      }
    } catch (e) { /* storage blocked */ }
    return out;
  }

  function migrate(store) {
    for (var i = 0; i < SAVE_KEYS.length; i++) {
      if (store.getItem(SAVE_KEYS[i]) !== null) return 0; // already has a save
    }
    var n = 0;
    localKeys().forEach(function (k) {
      try {
        var v = global.localStorage.getItem(k);
        if (v !== null && store.getItem(k) === null) { store.setItem(k, v); n++; }
      } catch (e) { /* skip */ }
    });
    store.setItem("neondash.__migrated", String(n));
    return n;
  }

  function useDataModule() {
    var p = global.NEONDASH_AD_PROVIDER;
    var store = p && typeof p.storage === "function" ? p.storage() : null;
    if (!store || !global.NeonStore) return { backend: "localStorage", migratedKeys: 0 };
    try {
      var moved = migrate(store);
      global.NeonStore.use(store);
      return { backend: "crazygames-data", migratedKeys: moved };
    } catch (e) {
      return { backend: "localStorage", migratedKeys: 0 };
    }
  }

  function loadScripts(list, done) {
    var i = 0;
    (function next() {
      if (i >= list.length) { if (done) done(); return; }
      var el = global.document.createElement("script");
      el.src = list[i++];
      el.async = false;
      el.onload = next;
      el.onerror = next;
      global.document.body.appendChild(el);
    })();
  }

  var started = false;
  function start() {
    if (started) return;
    started = true;
    global.NEONDASH_SAVE_INFO = useDataModule();
    loadScripts(GAME_SCRIPTS);
  }

  var p = global.NEONDASH_AD_PROVIDER;
  var init = p && typeof p.init === "function" ? p.init() : null;
  if (!init || typeof init.then !== "function") { start(); }
  else {
    var timer = setTimeout(function () {
      // Too slow: start on localStorage rather than leave a blank screen.
      if (!started) { started = true; global.NEONDASH_SAVE_INFO = { backend: "localStorage", migratedKeys: 0, timeout: true }; loadScripts(GAME_SCRIPTS); }
    }, BOOT_TIMEOUT_MS);
    init.then(function () { clearTimeout(timer); start(); }, function () { clearTimeout(timer); start(); });
  }

  if (typeof module === "object" && module.exports) module.exports = { migrate: migrate, GAME_SCRIPTS: GAME_SCRIPTS };
})(typeof window !== "undefined" ? window : globalThis);
