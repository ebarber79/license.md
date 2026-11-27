// Full Launch progress save: NeonStore + CrazyGames boot migration.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
function mem(init = {}) {
  const m = new Map(Object.entries(init));
  return {
    get length() { return m.size; },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    dump: () => Object.fromEntries(m),
  };
}

test("NeonStore defaults to localStorage and switches backend with use()", () => {
  globalThis.localStorage = mem({ "neondash.best": "120" });
  delete require.cache[require.resolve("../../store.js")];
  const S = require("../../store.js");
  assert.equal(S.getItem("neondash.best"), "120");
  assert.equal(S.backendName, "localStorage");
  const data = mem();
  data.__name = "crazygames-data";
  S.use(data);
  S.setItem("neondash.bank", 40);
  assert.equal(data.getItem("neondash.bank"), "40", "writes go to the new backend as strings");
  assert.equal(globalThis.localStorage.getItem("neondash.bank"), null, "localStorage untouched");
  assert.equal(S.backendName, "crazygames-data");
  S.use(null);
});

function loadBoot() {
  // Boot runs on require; give it a provider with no init so start() runs at once,
  // and a document stub so script loading is a no-op.
  globalThis.window = globalThis;
  globalThis.document = { createElement: () => ({}), body: { appendChild: () => {} } };
  delete require.cache[require.resolve("../../integrations/crazygames/boot.crazygames.js")];
  return require("../../integrations/crazygames/boot.crazygames.js");
}

test("migration copies an existing local save into an empty data module", () => {
  globalThis.localStorage = mem({ "neondash.best": "900", "neondash.bank": "75", "neondash.skins": "[\"cyan\"]", "other.app": "x" });
  globalThis.NEONDASH_AD_PROVIDER = undefined;
  const { migrate } = loadBoot();
  const data = mem();
  const n = migrate(data);
  assert.equal(n, 3);
  assert.equal(data.getItem("neondash.best"), "900");
  assert.equal(data.getItem("other.app"), null, "only Neon Dash keys");
  assert.equal(data.getItem("neondash.__migrated"), "3");
});

test("migration never overwrites an existing data-module save (e.g. synced account)", () => {
  globalThis.localStorage = mem({ "neondash.best": "50", "neondash.bank": "5" });
  const { migrate } = loadBoot();
  const data = mem({ "neondash.best": "2000" });
  assert.equal(migrate(data), 0);
  assert.equal(data.getItem("neondash.best"), "2000");
  assert.equal(data.getItem("neondash.bank"), null);
});

test("migration runs once: a fresh player gets a marker, later local keys aren't re-copied", () => {
  globalThis.localStorage = mem();
  const { migrate } = loadBoot();
  const data = mem();
  assert.equal(migrate(data), 0);
  globalThis.localStorage.setItem("neondash.best", "10");
  assert.equal(migrate(data), 0, "marker present -> no second migration");
});

test("boot switches NeonStore to the provider's data module and loads the game scripts in order", () => {
  globalThis.localStorage = mem({ "neondash.best": "300" });
  delete require.cache[require.resolve("../../store.js")];
  require("../../store.js");
  const data = mem();
  data.__name = "crazygames-data";
  globalThis.NEONDASH_AD_PROVIDER = { storage: () => data };
  const loaded = [];
  globalThis.window = globalThis;
  globalThis.document = { createElement: () => ({}), body: { appendChild: (el) => { loaded.push(el.src); el.onload && el.onload(); } } };
  delete require.cache[require.resolve("../../integrations/crazygames/boot.crazygames.js")];
  require("../../integrations/crazygames/boot.crazygames.js");
  assert.equal(globalThis.NeonStore.backendName, "crazygames-data");
  assert.equal(globalThis.NeonStore.getItem("neondash.best"), "300", "local save migrated");
  assert.deepEqual(loaded, ["progress.js", "music.js", "engine.js", "patterns.js", "game.js"]);
  assert.equal(globalThis.NEONDASH_SAVE_INFO.backend, "crazygames-data");
  assert.equal(globalThis.NEONDASH_AUTOSTART, true, "CrazyGames build lands new players in gameplay");
  globalThis.NeonStore.use(null);
  delete globalThis.NEONDASH_AD_PROVIDER;
});

test("boot falls back to localStorage when the data module is unavailable", () => {
  globalThis.localStorage = mem();
  delete require.cache[require.resolve("../../store.js")];
  require("../../store.js");
  globalThis.NEONDASH_AD_PROVIDER = { storage: () => null };
  loadBoot();
  assert.equal(globalThis.NeonStore.backendName, "localStorage");
  assert.equal(globalThis.NEONDASH_SAVE_INFO.backend, "localStorage");
  delete globalThis.NEONDASH_AD_PROVIDER;
});

test("autostart only in the CrazyGames boot, and game.js gates it to brand-new players", async () => {
  const fs = await import("node:fs");
  const game = fs.readFileSync(new URL("../../game.js", import.meta.url), "utf8");
  assert.match(game, /window\.NEONDASH_AUTOSTART && best === 0 && safeGet\(TUTORIAL_KEY\) !== "1"/);
  const html = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");
  assert.doesNotMatch(html, /NEONDASH_AUTOSTART/, "main site keeps its menu");
  const gd = fs.readFileSync(new URL("../../integrations/gamedistribution/ad-provider.gamedistribution.js", import.meta.url), "utf8");
  assert.doesNotMatch(gd, /NEONDASH_AUTOSTART/);
});
