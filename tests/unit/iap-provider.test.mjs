import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// iap-provider.js only runs inside the native Capacitor shell. Load it in a sandbox
// with a fake Purchases plugin that mimics the Capacitor bridge, so ND-005's two
// bugs (code 4 right after a cancel, iap_log never firing) are pinned down.
const SRC = readFileSync(new URL("../../iap-provider.js", import.meta.url), "utf8");
const IDS = ["neondash.gems.500", "neondash.gems.1200", "neondash.gems.3000", "neondash.gems.7000"];

function load({ purchase } = {}) {
  const calls = [];
  const events = [];
  let logCallback = null;
  const Purchases = {
    configure: (o) => { calls.push(["configure"]); return Promise.resolve(); },
    // Capacitor CALLBACK method: the bridge proxy is (options, callback).
    setLogHandler: (options, callback) => {
      calls.push(["setLogHandler", typeof options, typeof callback]);
      logCallback = typeof callback === "function" ? callback : null;
      return Promise.resolve("cb-1");
    },
    getProducts: (o) => {
      calls.push(["getProducts", o.productIdentifiers.length]);
      return Promise.resolve({ products: o.productIdentifiers.map((id) => ({ identifier: id + ":buy", priceString: "$1.99", v: calls.length })) });
    },
    purchaseStoreProduct: (o) => { calls.push(["purchase", o.product.identifier, o.product.v]); return purchase(o, calls); },
  };
  const window = {
    Capacitor: { isNativePlatform: () => true, Plugins: { Purchases } },
    NeonAnalytics: { track: (e, p) => events.push([e, p]) },
  };
  vm.runInNewContext(SRC, { window, setTimeout, Promise, String, RegExp });
  const p = window.NEONDASH_IAP_PROVIDER;
  p.RETRY_DELAY_MS = 1;
  return { p, calls, events, log: (d) => logCallback && logCallback(d) };
}

// Objects made inside the vm sandbox live in another realm; compare them as plain JSON.
const plain = (v) => JSON.parse(JSON.stringify(v));
const cancel = () => Promise.reject({ code: "1", userCancelled: true, message: "Purchase was cancelled." });
const invalid = () => Promise.reject({ code: "4", message: "One or more of the arguments provided are invalid." });

test("catalog loads all four packs from the store", async () => {
  const { p } = load({ purchase: () => Promise.resolve({}) });
  await p.init();
  assert.equal(p.available, true);
  assert.deepEqual(plain(p.packs().map((x) => x.id)), IDS);
});

test("log handler is registered as a callback (options, fn) and forwards warnings as iap_log", async () => {
  const { p, calls, events, log } = load({ purchase: () => Promise.resolve({}) });
  await p.init();
  assert.deepEqual(calls.find((c) => c[0] === "setLogHandler"), ["setLogHandler", "object", "function"]);
  log({ logLevel: "WARN", message: "BillingClient disconnected" });
  log({ logLevel: "DEBUG", message: "unrelated chatter" });
  assert.deepEqual(plain(events), [["iap_log", { level: "WARN", msg: "BillingClient disconnected" }]]);
});

test("code 4 right after a cancel: refetch the product and retry once, then succeed", async () => {
  let n = 0;
  const { p, calls } = load({ purchase: () => [cancel, invalid, () => Promise.resolve({})][n++]() });
  await p.init();
  assert.equal((await p.buy("neondash.gems.3000")).cancelled, true);
  const res = await p.buy("neondash.gems.3000");
  assert.deepEqual({ ok: res.ok, gems: res.gems, retried: res.retried }, { ok: true, gems: 3000, retried: true });
  const buys = calls.filter((c) => c[0] === "purchase");
  assert.equal(buys.length, 3);
  assert.notEqual(buys[2][2], buys[1][2], "retry uses a freshly fetched product");
  assert.deepEqual(calls.filter((c) => c[0] === "getProducts").map((c) => c[1]), [4, 1]);
});

test("code 4 twice: only one retry, the failure is reported with its code", async () => {
  const { p, calls } = load({ purchase: invalid });
  await p.init();
  const res = await p.buy("neondash.gems.7000");
  assert.deepEqual({ ok: res.ok, code: res.code, retried: res.retried }, { ok: false, code: "4", retried: true });
  assert.equal(calls.filter((c) => c[0] === "purchase").length, 2);
});

test("other errors are not retried", async () => {
  const { p, calls } = load({ purchase: () => Promise.reject({ code: "2", message: "store problem" }) });
  await p.init();
  const res = await p.buy("neondash.gems.500");
  assert.equal(res.code, "2");
  assert.equal(res.retried, undefined);
  assert.equal(calls.filter((c) => c[0] === "purchase").length, 1);
});

test("one purchase at a time across all packs; the lock clears afterwards", async () => {
  let release;
  const { p, calls } = load({ purchase: () => new Promise((r) => { release = r; }) });
  await p.init();
  const first = p.buy("neondash.gems.500");
  await new Promise((r) => setTimeout(r, 0));
  const second = await p.buy("neondash.gems.7000");
  assert.deepEqual({ ok: second.ok, cancelled: second.cancelled, code: second.code }, { ok: false, cancelled: true, code: "busy" });
  release({});
  assert.equal((await first).ok, true);
  assert.equal(calls.filter((c) => c[0] === "purchase").length, 1);
  const again = p.buy("neondash.gems.1200");
  await new Promise((r) => setTimeout(r, 0));
  release({});
  assert.equal((await again).gems, 1200);
});
