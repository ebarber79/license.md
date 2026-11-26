import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const PATH = "../../integrations/crazygames/ad-provider.crazygames.js";

function load(adImpl, { adblock = false } = {}) {
  globalThis.window = globalThis;
  const calls = [];
  globalThis.CrazyGames = { SDK: {
    environment: "crazygames",
    init: () => Promise.resolve(),
    game: { gameplayStart() {}, gameplayStop() {}, settings: {} },
    ad: { hasAdblock: () => Promise.resolve(adblock), requestAd: (t, cb) => { calls.push(t); adImpl(t, cb); } },
  } };
  delete require.cache[require.resolve(PATH)];
  require(PATH);
  return { p: globalThis.NEONDASH_AD_PROVIDER, calls };
}

test("rewarded: onStart fires on adStarted, reward only on adFinished", async () => {
  const { p } = load((t, cb) => { cb.adStarted(); cb.adFinished(); });
  let started = 0;
  assert.equal(p.signalsAdStart, true);
  assert.equal(await p.rewarded("x", { onStart: () => started++ }), true);
  assert.equal(started, 1);
});

test("rewarded: adError never rewards; unfilled stays available, adsDisabled turns ads off", async () => {
  let code = "unfilled";
  const { p } = load((t, cb) => cb.adError({ code }));
  assert.equal(await p.rewarded("x"), false);
  assert.equal(p.lastAdError, "unfilled");
  assert.equal(p.available, true, "a no-fill is temporary");
  code = "adsDisabled";
  assert.equal(await p.rewarded("x"), false);
  assert.equal(p.available, false, "Basic Launch: hide ad buttons");
});

test("adblock: detected at init or from an adblock error -> unavailable and flagged", async () => {
  let { p } = load(() => {}, { adblock: true });
  await p.init();
  assert.equal(p.adsBlocked, true);
  assert.equal(p.available, false);
  ({ p } = load((t, cb) => cb.adError({ code: "adblock" })));
  await p.init();
  assert.equal(p.adsBlocked, false);
  assert.equal(await p.rewarded("x"), false);
  assert.equal(p.adsBlocked, true);
});

test("midgame passes hooks and resolves on error so the game continues", async () => {
  const { p, calls } = load((t, cb) => cb.adError({ code: "adCooldown" }));
  assert.equal(await p.commercialBreak({ onStart() {} }), undefined);
  assert.deepEqual(calls, ["midgame"]);
});

test("game.js: revive offer gap, no break after rewarded, ad screen blocker", async () => {
  const fs = await import("node:fs");
  const g = fs.readFileSync(new URL("../../game.js", import.meta.url), "utf8");
  assert.match(g, /REVIVE_OFFER_GAP_MS = 3 \* 60 \* 1000/);
  assert.match(g, /const skipBreak = boostAdWatched \|\| skipNextBreak/);
  const html = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");
  assert.match(html, /id="ad-wait"/);
  assert.match(html, /id="ad-note"/);
});
