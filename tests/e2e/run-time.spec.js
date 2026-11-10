// @ts-check
// ND-035: game_over duration_ms counts only time spent playing, not time paused
// or spent on the game-over screen / revive ad.
const { test, expect } = require("@playwright/test");

const overs = (page) => page.evaluate(() =>
  window.NeonAnalytics._buffer.filter((e) => e.event === "game_over").map((e) => e.props));
const crash = (page) => page.evaluate(() => {
  const t = window.NeonDashTest; t.giveShield(0); t.clearObstacles(); t.spawnSpikeAhead(); t.step(10);
});

test.describe("ND-035 run time", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/index.html?test=1");
    await page.evaluate(() => localStorage.clear());
    await page.goto("/index.html?test=1");
    await page.waitForFunction(() => !!window.NeonDashTest && !!window.NeonAnalytics);
    await page.evaluate(() => window.NeonDashTest.seed(1));
  });

  test("paused time is not counted", async ({ page }) => {
    await page.evaluate(() => { const t = window.NeonDashTest; t.start(); t.clearObstacles(); t.pause(); });
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.NeonDashTest.resume());
    await crash(page);
    const o = await overs(page);
    expect(o.length).toBe(1);
    expect(o[0].duration_ms).toBeLessThan(1500);
  });

  test("time on the game-over screen before a revive is not counted", async ({ page }) => {
    await page.evaluate(() => { const t = window.NeonDashTest; t.start(); t.clearObstacles(); });
    await crash(page);
    await page.waitForTimeout(2000); // player looks at game over / watches the ad
    await page.evaluate(() => window.NeonDashTest.revive());
    await crash(page);
    const o = await overs(page);
    expect(o.length).toBe(2);
    expect(o[1].run_id).toBe(o[0].run_id);           // same run continued
    expect(o[1].duration_ms).toBeLessThan(1500);
  });
});
