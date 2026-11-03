// @ts-check
// ND-023: Boost = start the next run with a power-up (watch an ad, or pay 40 gems).
const { test, expect } = require("@playwright/test");

const state = (page) => page.evaluate(() => window.NeonDashTest.getState());
async function load(page, query = "?test=1") {
  await page.goto("/index.html" + query);
  await page.waitForFunction(() => !!window.NeonDashTest);
}
const die = (page) => page.evaluate(() => {
  const t = window.NeonDashTest;
  t.giveShield(0); t.clearObstacles(); t.spawnSpikeAhead(); t.step(10);
});

test.describe("ND-023 Boost", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/index.html?test=1");
    await page.evaluate(() => localStorage.clear());
    await load(page);
    await page.evaluate(() => window.NeonDashTest.seed(1));
  });

  test("pay 40 gems: armed, then the next run starts with it and uses it up", async ({ page }) => {
    await page.evaluate(() => window.NeonDashTest.setBank(100));
    expect(await page.evaluate(() => window.NeonDashTest.buyBoost("shield", "gems"))).toBe(true);
    let s = await state(page);
    expect(s.bank).toBe(60);
    expect(s.boost).toBe("shield");
    await expect(page.locator("#boost-start")).toContainText("SHIELD READY");
    const atStart = await page.evaluate(() => {
      const t = window.NeonDashTest; t.start(); const g = t.getState();
      return { shield: g.shieldTime, shoe: g.shoeMode, boost: g.boost };
    });
    expect(atStart.shield).toBeGreaterThan(6.9);
    expect(atStart.shoe).toBe("shield");
    expect(atStart.boost).toBe(null);
  });

  test("not enough gems: refused, bank unchanged, gem button disabled", async ({ page }) => {
    await page.evaluate(() => window.NeonDashTest.setBank(30));
    await expect(page.locator("#boost-start .boost-gems")).toBeDisabled();
    await expect(page.locator("#boost-start .boost-gems")).toContainText("need 40");
    expect(await page.evaluate(() => window.NeonDashTest.buyBoost("shield", "gems"))).toBe(false);
    const s = await state(page);
    expect(s.bank).toBe(30);
    expect(s.boost).toBe(null);
  });

  test("watch ad: armed without spending gems", async ({ page }) => {
    await page.evaluate(() => window.NeonDashTest.setBank(10));
    expect(await page.evaluate(() => window.NeonDashTest.buyBoost("magnet", "ad"))).toBe(true);
    expect((await state(page)).bank).toBe(10);
    const mag = await page.evaluate(() => { const t = window.NeonDashTest; t.start(); return t.getState().magnetTime; });
    expect(mag).toBeGreaterThan(5.9);
  });

  test("one boost at a time: a second purchase is refused", async ({ page }) => {
    await page.evaluate(() => window.NeonDashTest.setBank(200));
    await page.evaluate(() => window.NeonDashTest.buyBoost("slowmo", "gems"));
    expect(await page.evaluate(() => window.NeonDashTest.buyBoost("shield", "gems"))).toBe(false);
    const s = await state(page);
    expect(s.bank).toBe(160);
    expect(s.boost).toBe("slowmo");
  });

  test("armed boost survives a reload and is used by the next run", async ({ page }) => {
    await page.evaluate(() => window.NeonDashTest.setBank(100));
    await page.evaluate(() => window.NeonDashTest.buyBoost("shield", "gems"));
    await page.reload();
    await page.waitForFunction(() => !!window.NeonDashTest);
    expect((await state(page)).boost).toBe("shield");
    const shield = await page.evaluate(() => { const t = window.NeonDashTest; t.start(); return t.getState().shieldTime; });
    expect(shield).toBeGreaterThan(6.9);
  });

  test("UI: pick a power-up and pay from the game-over screen", async ({ page }) => {
    await page.evaluate(() => { const t = window.NeonDashTest; t.setBank(100); t.start(); });
    await die(page);
    await expect(page.locator("#boost-over")).toBeVisible();
    await page.locator('#boost-over .boost-chip[data-boost="slowmo"]').click();
    await page.locator("#boost-over .boost-gems").click();
    await expect(page.locator("#boost-over")).toContainText("SLOW-MO READY");
    expect((await state(page)).boost).toBe("slowmo");
  });

  test("no interstitial on the replay right after a boost ad", async ({ page }) => {
    await page.evaluate(() => {
      window.__breaks = 0;
      const a = window.NeonAds;
      a.commercialBreak = () => { window.__breaks++; return Promise.resolve(); };
    });
    const replay = async () => { await page.locator("#restart-btn").click(); await expect(page.locator("#hud")).toBeVisible(); };
    // Control: runs 1-3, then PLAY AGAIN on run 3 shows the every-3rd-replay break.
    await page.evaluate(() => window.NeonDashTest.start());
    for (let i = 0; i < 2; i++) { await die(page); await replay(); }
    await die(page);
    await replay();
    expect(await page.evaluate(() => window.__breaks)).toBe(1);
    // Runs 4-6; boost ad watched before the run-6 replay -> no break.
    for (let i = 0; i < 2; i++) { await die(page); await replay(); }
    await die(page);
    expect(await page.evaluate(() => window.NeonDashTest.buyBoost("shield", "ad"))).toBe(true);
    await replay();
    expect(await page.evaluate(() => window.__breaks)).toBe(1);
  });
});

test("ND-023: plain web build offers Boost for gems only (no ad button)", async ({ page }) => {
  await page.goto("/index.html");
  await expect(page.locator("#boost-start")).toBeVisible();
  await expect(page.locator("#boost-start .boost-gems")).toBeVisible();
  await expect(page.locator("#boost-start .boost-ad")).toHaveCount(0);
});
