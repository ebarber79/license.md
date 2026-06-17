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

test("ND-OFF-01: service worker registers", async ({ page }) => {
  await page.goto("/index.html");
  const hasController = await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return false;
    const reg = await navigator.serviceWorker.ready.catch(() => null);
    return !!reg;
  });
  expect(hasController).toBe(true);
});
