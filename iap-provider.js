/* =========================================================================
 * Neon Dash — native gem-pack IAP provider (RevenueCat → Google Play Billing).
 *
 * Implements window.NEONDASH_IAP_PROVIDER (consumed by iap.js). Load order:
 * BEFORE iap.js.
 *
 * NATIVE-ONLY: activates only inside the Capacitor native shell. On web / CI it
 * does nothing (Capacitor absent) so iap.js falls back to the safe stub and the
 * gem-pack UI stays hidden. Purchases run natively via RevenueCat, so no store
 * network happens inside the WebView and the page CSP is untouched.
 *
 * ⚠️ STEP 5 WIRING — this stays cleanly UNAVAILABLE (packs() empty) until BOTH
 * are done in step 5, so today's build compiles and runs with no store:
 *   1. REVENUECAT_ANDROID_API_KEY — paste the real "goog_…" public SDK key from
 *      the RevenueCat dashboard (replaces the REPLACE_… placeholder below).
 *   2. Create the consumable products in Google Play Console + RevenueCat with
 *      the IDs in GEM_PACKS, then the packs light up automatically.
 * The gem amounts here are the authoritative grant; the PRICE is whatever the
 * store returns (priceString), never hardcoded.
 * ========================================================================= */
(function (global) {
  "use strict";

  var cap = global.Capacitor;
  var isNative = !!(cap && typeof cap.isNativePlatform === "function" && cap.isNativePlatform());
  if (!isNative) return;                                    // web / CI -> leave as-is

  var Purchases = cap.Plugins && cap.Plugins.Purchases;
  if (!Purchases) return;                                   // plugin not linked -> stay stubbed

  // Public Android SDK key from RevenueCat. Placeholder until step 5. ----------
  var REVENUECAT_ANDROID_API_KEY = "goog_REPLACE_WITH_YOUR_REVENUECAT_ANDROID_KEY";

  // Gem-pack catalog: Play Console / RevenueCat product id -> gems granted.
  // Prices are NOT here — they come from the store at runtime (priceString).
  var GEM_PACKS = [
    { id: "neondash.gems.500",  gems: 500,  title: "Handful of Gems" },
    { id: "neondash.gems.1200", gems: 1200, title: "Pouch of Gems",  badge: "+20%" },
    { id: "neondash.gems.3000", gems: 3000, title: "Chest of Gems",  badge: "BEST VALUE" },
    { id: "neondash.gems.7000", gems: 7000, title: "Vault of Gems",  badge: "+40%" },
  ];

  function gemsFor(productId) {
    for (var i = 0; i < GEM_PACKS.length; i++) if (GEM_PACKS[i].id === productId) return GEM_PACKS[i].gems;
    return 0;
  }

  var provider = {
    available: false,
    _initP: null,
    _packs: [],          // populated from the store at init: {id, gems, priceString, title, badge}

    init: function () {
      var self = this;
      if (self._initP) return self._initP;
      self._initP = (function () {
        // No real key yet -> don't configure; stay unavailable (build still runs).
        if (REVENUECAT_ANDROID_API_KEY.indexOf("REPLACE") !== -1) return Promise.resolve();
        return Promise.resolve(Purchases.configure({ apiKey: REVENUECAT_ANDROID_API_KEY }))
          .then(function () {
            return Purchases.getProducts({
              productIdentifiers: GEM_PACKS.map(function (p) { return p.id; }),
              type: "NON_SUBSCRIPTION",     // consumables
            });
          })
          .then(function (res) {
            var products = (res && res.products) || [];
            var byId = {};
            products.forEach(function (pr) { byId[pr.identifier] = pr; });
            // Keep catalog order; only expose packs the store actually returned.
            self._packs = GEM_PACKS
              .filter(function (p) { return byId[p.id]; })
              .map(function (p) {
                var pr = byId[p.id];
                return {
                  id: p.id, gems: p.gems, title: p.title, badge: p.badge,
                  priceString: pr.priceString || "",
                  _product: pr,
                };
              });
            self.available = self._packs.length > 0;
          });
      })().catch(function () { /* never reject; iap.js degrades to no-store */ });
      return self._initP;
    },

    packs: function () {
      // Hand out UI-safe copies (drop the internal _product handle).
      return this._packs.map(function (p) {
        return { id: p.id, gems: p.gems, title: p.title, badge: p.badge, priceString: p.priceString };
      });
    },

    // Returns { ok, gems, cancelled? }. Grant is by the pack the user initiated.
    buy: function (packId) {
      var self = this;
      var pack = null;
      for (var i = 0; i < self._packs.length; i++) if (self._packs[i].id === packId) pack = self._packs[i];
      if (!pack || !pack._product) return Promise.resolve({ ok: false, gems: 0 });
      return Promise.resolve(Purchases.purchaseStoreProduct({ product: pack._product }))
        .then(function () {
          return { ok: true, gems: gemsFor(packId) };
        }, function (err) {
          // RevenueCat flags user-cancel; treat everything else as a failed buy.
          var cancelled = !!(err && (err.userCancelled || err.code === "1" || /cancel/i.test(err.message || "")));
          return { ok: false, gems: 0, cancelled: cancelled };
        });
    },

    restore: function () {
      // Consumables aren't restorable, but expose it for completeness/entitlements.
      return Promise.resolve(Purchases.restorePurchases()).then(function () {}, function () {});
    },
  };

  global.NEONDASH_IAP_PROVIDER = provider;
})(window);
