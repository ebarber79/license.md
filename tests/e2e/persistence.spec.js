// @ts-check
const { test, expect } = require("@playwright/test");

const state = (page) => page.evaluate(() => window.NeonDashTest.getState());

test("ND-DATA-02/03: gem bank + skin selection persist across reload", async ({ page }) => {
  await page.goto("/index.html?test=1");
  await page.waitForFunction(() => !!window.NeonDashTest);

  // Grant gems directly via storage, then reload to load the bank.
  await page.evaluate(() => localStorage.setItem("neondash.bank", "500"));
  await page.reload();
  await page.waitForFunction(() => !!window.NeonDashTest);
  expect((await state(page)).bank).toBe(500);

  // Buy + equip the magenta skin (cost 60) via the purchase logic
  // (driven through the test hook to keep the persistence assertion
  // independent of canvas/overlay click-actionability flakiness).
  await page.evaluate(() => window.NeonDashTest.buySkin("magenta"));
  await expect.poll(async () => page.evaluate(() => localStorage.getItem("neondash.skin"))).toBe("magenta");

  // Reload: selection persists and bank was debited.
  await page.reload();
  await page.waitForFunction(() => !!window.NeonDashTest);
  expect(await page.evaluate(() => localStorage.getItem("neondash.skin"))).toBe("magenta");
  expect((await state(page)).bank).toBe(440);
});

test("ND-DATA-01: high score persists across reload", async ({ page }) => {
  await page.goto("/index.html?test=1");
  await page.waitForFunction(() => !!window.NeonDashTest);
  await page.evaluate(() => localStorage.setItem("neondash.best", "1234"));
  await page.reload();
  await page.waitForFunction(() => !!window.NeonDashTest);
  expect((await state(page)).best).toBe(1234);
});

test("ND-REG-01: production load + start works with no uncaught errors (unseeded RNG)", async ({ page }) => {
  // Regression for the rnd() self-recursion: with no test seed, the game
  // must fall back to Math.random() and start cleanly. pageerror is wired
  // before navigation so an init-time RangeError would be caught.
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.stack || String(e)));
  await page.goto("/index.html?test=1");
  await page.waitForFunction(() => !!window.NeonDashTest);
  // Not seeded (exercise the Math.random() fallback); step() advances the sim
  // deterministically so this doesn't depend on rAF/visibility timing.
  await page.evaluate(() => { window.NeonDashTest.start(); window.NeonDashTest.step(8); });
  expect((await page.evaluate(() => window.NeonDashTest.getState())).state).toBe("playing");
  expect(errors).toEqual([]);
});

test("ND-A11Y-04b: Space activates a focused shop chip (no gameplay hijack)", async ({ page }) => {
  await page.goto("/index.html?test=1");
  await page.waitForFunction(() => !!window.NeonDashTest);
  await page.evaluate(() => localStorage.setItem("neondash.bank", "500"));
  await page.reload();
  await page.waitForFunction(() => !!window.NeonDashTest);
  // Focus the magenta chip and activate it with the keyboard. The global
  // key handler must NOT preventDefault Space here, or native activation fails.
  await page.locator(".skin-chip").nth(1).focus();
  await page.keyboard.press("Space");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("neondash.skin"))).toBe("magenta");
});

test("ND-OFF-01: service worker registers", async ({ page }) => {
  await page.goto("/index.html");
  const hasController = await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return false;
    const reg = await navigator.serviceWorker.ready.catch(() => null);
    return !!reg;
  });
  expect(hasController).toBe(true);
});
