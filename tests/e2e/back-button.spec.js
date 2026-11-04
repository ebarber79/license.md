// @ts-check
// ND-031: Android Back button / Escape. Run -> pause; paused or game-over -> menu;
// menu -> not handled (native shell exits the app).
const { test, expect } = require("@playwright/test");

const state = (page) => page.evaluate(() => window.NeonDashTest.getState());
const back = (page) => page.evaluate(() => window.NeonDashTest.back());

test.describe("ND-031 Back button", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/index.html?test=1");
    await page.evaluate(() => localStorage.clear());
    await page.goto("/index.html?test=1");
    await page.waitForFunction(() => !!window.NeonDashTest);
    await page.evaluate(() => window.NeonDashTest.seed(1));
  });

  test("during a run: first Back pauses, second goes to the menu and banks gems", async ({ page }) => {
    await page.evaluate(() => { const t = window.NeonDashTest; t.start(); t.clearObstacles(); t.addGemAhead(); t.step(60); });
    const gems = (await state(page)).coins;
    expect(await back(page)).toBe(true);
    let s = await state(page);
    expect(s.state).toBe("playing");
    expect(s.paused).toBe(true);
    await expect(page.locator("#pause-screen")).toBeVisible();

    expect(await back(page)).toBe(true);
    s = await state(page);
    expect(s.state).toBe("menu");
    expect(s.paused).toBe(false);
    expect(gems).toBeGreaterThan(0);
    expect(s.bank).toBeGreaterThanOrEqual(gems); // run gems banked (plus any first-day bonus)
    await expect(page.locator("#start-screen")).toBeVisible();
    await expect(page.locator("#pause-screen")).toBeHidden();
  });

  test("on game over: Back goes to the menu", async ({ page }) => {
    await page.evaluate(() => {
      const t = window.NeonDashTest;
      t.start(); t.giveShield(0); t.clearObstacles(); t.spawnSpikeAhead(); t.step(10);
    });
    expect((await state(page)).state).toBe("over");
    expect(await back(page)).toBe(true);
    expect((await state(page)).state).toBe("menu");
    await expect(page.locator("#gameover-screen")).toBeHidden();
    await expect(page.locator("#start-screen")).toBeVisible();
  });

  test("on the menu: Back is not handled (the app exits)", async ({ page }) => {
    expect(await back(page)).toBe(false);
    expect((await state(page)).state).toBe("menu");
  });

  test("Escape pauses a run on the web, and does nothing on the menu", async ({ page }) => {
    await page.keyboard.press("Escape");
    expect((await state(page)).state).toBe("menu");
    await page.evaluate(() => window.NeonDashTest.start());
    await page.keyboard.press("Escape");
    expect((await state(page)).paused).toBe(true);
  });
});
