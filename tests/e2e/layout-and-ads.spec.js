// @ts-check
const { test, expect } = require("@playwright/test");

// ND-020: overlays fit small phones (title on screen, everything reachable by scrolling,
// nothing hidden under the sound button).
test.describe("ND-020 small-phone layout", () => {
  test.use({ viewport: { width: 360, height: 640 } });

  test("start screen: title and PLAY on screen, bottom reachable", async ({ page }) => {
    await page.goto("/index.html?test=1");
    await page.waitForFunction(() => !!window.NeonDashTest);
    const top = await page.evaluate(() => {
      const t = document.querySelector("#start-screen .title").getBoundingClientRect();
      const p = document.getElementById("start-btn").getBoundingClientRect();
      return { titleTop: t.top, playBottom: p.bottom, vh: innerHeight };
    });
    expect(top.titleTop).toBeGreaterThanOrEqual(0);
    expect(top.playBottom).toBeLessThanOrEqual(top.vh);
    const bottom = await page.evaluate(() => {
      const s = document.getElementById("start-screen");
      s.scrollTop = 1e6;
      const h = document.querySelector("#start-screen .hint").getBoundingClientRect();
      const m = document.getElementById("mute-btn").getBoundingClientRect();
      return { hintBottom: h.bottom, muteTop: m.top };
    });
    expect(bottom.hintBottom).toBeLessThanOrEqual(bottom.muteTop);
  });

  test("game over: title on screen, MENU reachable above the sound button", async ({ page }) => {
    await page.goto("/index.html?test=1"); // test mode shows both reward buttons (tallest case)
    await page.waitForFunction(() => !!window.NeonDashTest);
    await page.evaluate(() => {
      const t = window.NeonDashTest;
      t.seed(1); t.start(); t.clearObstacles(); t.addGemAhead(); t.step(3);
      t.clearObstacles(); t.spawnSpikeAhead(); t.step(10);
    });
    await expect(page.locator("#gameover-screen")).toBeVisible();
    const r = await page.evaluate(() => {
      const s = document.getElementById("gameover-screen");
      const titleTop = s.querySelector(".gameover-title").getBoundingClientRect().top;
      s.scrollTop = 1e6;
      const menuBottom = document.getElementById("menu-btn").getBoundingClientRect().bottom;
      const muteTop = document.getElementById("mute-btn").getBoundingClientRect().top;
      return { titleTop, menuBottom, muteTop };
    });
    expect(r.titleTop).toBeGreaterThanOrEqual(0);
    expect(r.menuBottom).toBeLessThanOrEqual(r.muteTop);
  });
});

// ND-022: the plain web build has no ad network, so no "watch ad" reward is offered.
test("ND-022: web build without ads offers no ad rewards", async ({ page }) => {
  await page.goto("/index.html"); // no ?test=1: real web behaviour
  await expect(page.locator("#start-screen")).toBeVisible();
  await expect(page.locator("#shoe-row")).not.toContainText("WATCH");
  await expect(page.locator("#shoe-row")).toContainText("LOCKED");
  await expect(page.locator("#shoe-row .shoe-hint")).not.toContainText("video");
  await page.locator("#start-btn").click();
  // No jumping: the first obstacle ends the run.
  await expect(page.locator("#gameover-screen")).toBeVisible({ timeout: 30000 });
  await expect(page.locator("#revive-btn")).toBeHidden();
  await expect(page.locator("#double-gems-btn")).toBeHidden();
});
