// @ts-check
// ND-037: first-run tutorial, How to play, Share/Rate links, exit confirmation.
const { test, expect } = require("@playwright/test");

const state = (page) => page.evaluate(() => window.NeonDashTest.getState());

async function fresh(page, native) {
  if (native) {
    await page.addInitScript(() => {
      window.__exited = false;
      window.Capacitor = {
        isNativePlatform: () => true,
        Plugins: { App: { exitApp() { window.__exited = true; } } },
      };
    });
  }
  await page.goto("/index.html?test=1");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/index.html?test=1");
  await page.waitForFunction(() => !!window.NeonDashTest);
  await page.evaluate(() => window.NeonDashTest.seed(1));
}

test.describe("ND-037 tutorial", () => {
  test.beforeEach(async ({ page }) => {
    await fresh(page, false);
    await page.evaluate(() => window.NeonDashTest.setAutoTutorial(true));
  });

  test("first run is guided: no obstacles until the first jump", async ({ page }) => {
    await page.evaluate(() => { window.NeonDashTest.start(); window.NeonDashTest.step(120); });
    const s = await state(page);
    expect(s.tutorial).toBe("jump");
    expect(s.obstacles).toBe(0);
    await expect(page.locator("#tutorial-banner")).toBeVisible();
    await expect(page.locator("#tutorial-text")).toHaveText(/Tap anywhere to jump/);
  });

  test("spike step freezes the world until a tap, and the tap clears the spike", async ({ page }) => {
    await page.evaluate(() => {
      const t = window.NeonDashTest;
      t.start(); t.jump(); t.step(400);
    });
    let s = await state(page);
    expect(s.tutorial).toBe("spike");
    expect(s.tutorialHold).toBe(true);
    const frozenScore = s.score;
    await page.evaluate(() => window.NeonDashTest.step(30));
    expect((await state(page)).score).toBe(frozenScore);
    await expect(page.locator("#tutorial-text")).toHaveText(/Spike ahead/);

    await page.evaluate(() => { const t = window.NeonDashTest; t.jump(); t.step(90); });
    s = await state(page);
    expect(s.state).toBe("playing");
    expect(s.tutorial).toBe("multi");
  });

  test("a hit during the tutorial doesn't end the run", async ({ page }) => {
    await page.evaluate(() => {
      const t = window.NeonDashTest;
      t.start(); t.jump(); t.step(60); t.spawnSpikeAhead(); t.step(5);
    });
    const s = await state(page);
    expect(s.state).toBe("playing");
    expect(s.tutorial).toBe("spike");
  });

  test("full tutorial: mid-air jumps, gems, then normal play and the flag is saved", async ({ page }) => {
    await page.evaluate(() => {
      const t = window.NeonDashTest;
      t.start(); t.jump(); t.step(400); t.jump(); t.step(90); // past the spike
      t.step(30); t.jump(); t.step(4); t.jump(); t.step(2);    // ground jump + mid-air jump
    });
    expect((await state(page)).tutorial).toBe("gems");
    await page.evaluate(() => window.NeonDashTest.step(300)); // 5 s: done by gem or timeout
    const s = await state(page);
    expect(s.tutorial).toBe(null);
    expect(await page.evaluate(() => localStorage.getItem("neondash.tutorialDone"))).toBe("1");
    await expect(page.locator("#tutorial-banner")).toBeHidden();
  });

  test("Skip ends it, saves the flag, and the next run is unguided", async ({ page }) => {
    await page.evaluate(() => { const t = window.NeonDashTest; t.start(); t.skipTutorial(); });
    expect((await state(page)).tutorial).toBe(null);
    await expect(page.locator("#tutorial-banner")).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem("neondash.tutorialDone"))).toBe("1");
    await page.evaluate(() => { const t = window.NeonDashTest; t.back(); t.back(); t.start(); });
    expect((await state(page)).tutorial).toBe(null);
  });

  test("How to play replays the tutorial even after it's done", async ({ page }) => {
    await page.evaluate(() => localStorage.setItem("neondash.tutorialDone", "1"));
    await page.locator("#howto-btn").click();
    expect((await state(page)).tutorial).toBe("jump");
  });

  test("pausing hides the banner; resuming shows it again", async ({ page }) => {
    await page.evaluate(() => { const t = window.NeonDashTest; t.start(); t.pause(); });
    await expect(page.locator("#tutorial-banner")).toBeHidden();
    await page.evaluate(() => window.NeonDashTest.resume());
    await expect(page.locator("#tutorial-banner")).toBeVisible();
  });
});

test.describe("ND-037 menu links (web)", () => {
  test.beforeEach(async ({ page }) => { await fresh(page, false); });

  test("Share is shown and Rate is hidden on the web; Share falls back without errors", async ({ page }) => {
    await expect(page.locator("#share-btn")).toBeVisible();
    await expect(page.locator("#rate-link")).toBeHidden();
    await expect(page.locator("#howto-btn")).toBeVisible();
    await page.evaluate(() => { try { Object.defineProperty(navigator, "share", { value: undefined }); } catch (e) {} });
    await page.evaluate(() => window.NeonDashTest.share());
    await expect(page.locator("#toast")).toContainText(/Link copied|neondash\.gridlas\.com/);
  });

  test("Back on the web menu is still not handled", async ({ page }) => {
    expect(await page.evaluate(() => window.NeonDashTest.back())).toBe(false);
    await expect(page.locator("#exit-confirm")).toBeHidden();
  });
});

test.describe("ND-037 Android exit confirmation", () => {
  test.beforeEach(async ({ page }) => { await fresh(page, true); });

  test("Back on the menu opens the panel; Back again closes it", async ({ page }) => {
    await expect(page.locator("#rate-link")).toBeVisible();
    expect(await page.evaluate(() => window.NeonDashTest.back())).toBe(true);
    await expect(page.locator("#exit-confirm")).toBeVisible();
    expect(await page.evaluate(() => window.NeonDashTest.back())).toBe(true);
    await expect(page.locator("#exit-confirm")).toBeHidden();
    expect(await page.evaluate(() => window.__exited)).toBe(false);
  });

  test("Stay closes the panel, Leave exits the app", async ({ page }) => {
    await page.evaluate(() => window.NeonDashTest.back());
    await page.locator("#exit-stay-btn").click();
    await expect(page.locator("#exit-confirm")).toBeHidden();
    await page.evaluate(() => window.NeonDashTest.back());
    await page.locator("#exit-leave-btn").click();
    expect(await page.evaluate(() => window.__exited)).toBe(true);
  });
});
