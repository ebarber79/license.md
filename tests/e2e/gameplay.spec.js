// @ts-check
const { test, expect } = require("@playwright/test");

// All tests load with ?test=1 to expose window.NeonDashTest (H4 hooks),
// and seed RNG for determinism.
test.beforeEach(async ({ page }) => {
  await page.goto("/index.html?test=1");
  await page.waitForFunction(() => !!window.NeonDashTest);
  await page.evaluate(() => window.NeonDashTest.seed(1));
});

const state = (page) => page.evaluate(() => window.NeonDashTest.getState());

test("ND-ON-01: start screen renders with no console errors", async ({ page }) => {
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await expect(page.locator("#start-screen")).toBeVisible();
  await expect(page.locator("#start-btn")).toBeVisible();
  expect(errors).toEqual([]);
});

test("ND-NAV-01: Start -> Play enters playing state", async ({ page }) => {
  await page.evaluate(() => window.NeonDashTest.start());
  expect((await state(page)).state).toBe("playing");
  await expect(page.locator("#hud")).toBeVisible();
});

test("ND-CORE-01/02: single + double jump, capped at two", async ({ page }) => {
  await page.evaluate(() => { const t = window.NeonDashTest; t.start(); t.clearObstacles(); });
  // First jump leaves the ground.
  await page.evaluate(() => window.NeonDashTest.jump());
  await expect.poll(async () => (await state(page)).player.onGround).toBe(false);
  expect((await state(page)).player.jumps).toBe(1);
  // Second jump = double jump.
  await page.evaluate(() => window.NeonDashTest.jump());
  expect((await state(page)).player.jumps).toBe(2);
  // Third tap ignored.
  await page.evaluate(() => window.NeonDashTest.jump());
  expect((await state(page)).player.jumps).toBe(2);
});

test("ND-CORE-03: spike collision ends the run", async ({ page }) => {
  await page.evaluate(() => {
    const t = window.NeonDashTest;
    t.start(); t.clearObstacles(); t.spawnSpikeAhead();
  });
  await expect.poll(async () => (await state(page)).state, { timeout: 4000 }).toBe("over");
  await expect(page.locator("#gameover-screen")).toBeVisible();
});

test("ND-CORE-06: shield absorbs one hit (survive)", async ({ page }) => {
  await page.evaluate(() => {
    const t = window.NeonDashTest;
    t.start(); t.clearObstacles(); t.giveShield(); t.spawnSpikeAhead();
  });
  // Shield should be consumed but the run continues.
  await expect.poll(async () => (await state(page)).shieldTime).toBe(0);
  expect((await state(page)).state).toBe("playing");
});

test("ND-CORE-05: gem collection increments count", async ({ page }) => {
  await page.evaluate(() => {
    const t = window.NeonDashTest;
    t.start(); t.clearObstacles(); t.addGemAhead();
  });
  await expect.poll(async () => (await state(page)).coins).toBeGreaterThan(0);
});

test("ND-NAV-02: pause freezes, resume continues", async ({ page }) => {
  await page.evaluate(() => { window.NeonDashTest.start(); window.NeonDashTest.clearObstacles(); });
  await page.evaluate(() => window.NeonDashTest.pause());
  expect((await state(page)).paused).toBe(true);
  await expect(page.locator("#pause-screen")).toBeVisible();
  await page.evaluate(() => window.NeonDashTest.resume());
  expect((await state(page)).paused).toBe(false);
});
