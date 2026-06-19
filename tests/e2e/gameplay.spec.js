// @ts-check
const { test, expect } = require("@playwright/test");

// All tests load with ?test=1 to expose window.NeonDashTest (H4 hooks),
// and seed RNG for determinism. Console/page-error listeners are attached
// BEFORE navigation so init-time errors are captured (ND-ON-01).
let initErrors;
test.beforeEach(async ({ page }) => {
  initErrors = [];
  page.on("console", (m) => { if (m.type() === "error") initErrors.push(m.text()); });
  page.on("pageerror", (e) => initErrors.push(e.stack || String(e)));
  await page.goto("/index.html?test=1");
  await page.waitForFunction(() => !!window.NeonDashTest);
  await page.evaluate(() => window.NeonDashTest.seed(1));
});

const state = (page) => page.evaluate(() => window.NeonDashTest.getState());

test("ND-ON-01: start screen renders with no console errors", async ({ page }) => {
  await expect(page.locator("#start-screen")).toBeVisible();
  await expect(page.locator("#start-btn")).toBeVisible();
  expect(initErrors).toEqual([]); // captured from before navigation
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
  // Drive the sim deterministically via step() (rAF is throttled for
  // backgrounded parallel test pages, which otherwise flakes this test).
  await page.evaluate(() => {
    const t = window.NeonDashTest;
    t.start(); t.clearObstacles(); t.spawnSpikeAhead(); t.step(10);
  });
  expect((await state(page)).state).toBe("over");
  await expect(page.locator("#gameover-screen")).toBeVisible();
});

test("ND-CORE-06: shield absorbs one hit (survive)", async ({ page }) => {
  await page.evaluate(() => {
    const t = window.NeonDashTest;
    t.start(); t.clearObstacles(); t.giveShield(); t.spawnSpikeAhead(); t.step(10);
  });
  const s = await state(page);
  expect(s.shieldTime).toBe(0); // shield consumed
  expect(s.state).toBe("playing"); // but the run continues
});

test("ND-CORE-05: gem collection increments count", async ({ page }) => {
  await page.evaluate(() => {
    const t = window.NeonDashTest;
    t.start(); t.clearObstacles(); t.addGemAhead(); t.step(3);
  });
  expect((await state(page)).coins).toBeGreaterThan(0);
});

test("ND-ADS-01: rewarded 'double gems' doubles the run's gems when banked", async ({ page }) => {
  await page.evaluate(() => {
    const t = window.NeonDashTest;
    t.start(); t.clearObstacles(); t.addGemAhead(); t.step(3); // collect >=1 gem
  });
  const before = await state(page);
  expect(before.coins).toBeGreaterThan(0);
  const bankBefore = before.bank;
  // End the run — gems are NOT banked yet (so a revive could continue).
  await page.evaluate(() => { const t = window.NeonDashTest; t.clearObstacles(); t.spawnSpikeAhead(); t.step(10); });
  const over = await state(page);
  expect(over.state).toBe("over");
  expect(over.bank).toBe(bankBefore); // not banked on game over
  // Claim the rewarded double (stub auto-grants) -> multiplier 2, still not banked.
  await page.evaluate(() => window.NeonDashTest.doubleGems());
  expect((await state(page)).gemMultiplier).toBe(2);
  // Leaving the run (new game) banks the prior run at 2x.
  await page.evaluate(() => window.NeonDashTest.start());
  expect((await state(page)).bank).toBe(bankBefore + before.coins * 2);
});

test("ND-ADS-02: rewarded revive continues the same run once", async ({ page }) => {
  await page.evaluate(() => {
    const t = window.NeonDashTest;
    t.start(); t.clearObstacles(); t.addGemAhead(); t.step(3);
  });
  const mid = await state(page);
  expect(mid.coins).toBeGreaterThan(0);
  await page.evaluate(() => { const t = window.NeonDashTest; t.clearObstacles(); t.spawnSpikeAhead(); t.step(10); });
  expect((await state(page)).state).toBe("over");
  await page.evaluate(() => window.NeonDashTest.revive()); // stub auto-grants
  const after = await state(page);
  expect(after.state).toBe("playing");   // same run continues
  expect(after.reviveUsed).toBe(true);
  expect(after.obstacles).toBe(0);        // threats cleared
  expect(after.coins).toBe(mid.coins);    // gems preserved
  expect(after.shieldTime).toBeGreaterThan(0); // grace shield
});

test("ND-NAV-02: pause freezes, resume continues", async ({ page }) => {
  await page.evaluate(() => { window.NeonDashTest.start(); window.NeonDashTest.clearObstacles(); });
  await page.evaluate(() => window.NeonDashTest.pause());
  expect((await state(page)).paused).toBe(true);
  await expect(page.locator("#pause-screen")).toBeVisible();
  await page.evaluate(() => window.NeonDashTest.resume());
  expect((await state(page)).paused).toBe(false);
});
