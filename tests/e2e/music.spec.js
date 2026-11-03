// @ts-check
// ND-025: reactive synthwave music.
const { test, expect } = require("@playwright/test");

const music = (page) => page.evaluate(() => window.NeonDashTest.getState().music);

test.beforeEach(async ({ page }) => {
  await page.goto("/index.html?test=1");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/index.html?test=1");
  await page.waitForFunction(() => !!window.NeonDashTest);
  await page.evaluate(() => window.NeonDashTest.seed(1));
});

test("music follows the game: menu → run builds → power-up sparkle → game over back to menu", async ({ page }) => {
  let m = await music(page);
  expect(m.on).toBe(true);
  expect(m.mode).toBe("menu");
  expect(m.layers).toEqual(["pad", "bass"]);
  expect(m.bpm).toBe(96);
  await page.evaluate(() => { const t = window.NeonDashTest; t.start(); t.clearObstacles(); t.step(2); });
  m = await music(page);
  expect(m.mode).toBe("run");
  expect(m.layers).toContain("kick");
  expect(m.bpm).toBeGreaterThanOrEqual(110);
  await page.evaluate(() => { const t = window.NeonDashTest; t.giveShield(7); t.step(2); });
  expect((await music(page)).layers).toContain("sparkle");
  await page.evaluate(() => { const t = window.NeonDashTest; t.giveShield(0); t.clearObstacles(); t.spawnSpikeAhead(); t.step(10); });
  m = await music(page);
  expect(m.mode).toBe("menu");
  expect(m.layers).not.toContain("kick");
});

test("pause stops the music, resume brings it back", async ({ page }) => {
  await page.evaluate(() => { const t = window.NeonDashTest; t.start(); t.clearObstacles(); t.pause(); });
  expect((await music(page)).mode).toBe("paused");
  expect((await music(page)).layers).toEqual([]);
  await page.evaluate(() => window.NeonDashTest.resume());
  expect((await music(page)).mode).toBe("run");
});

test("🎵 and 🔊 are separate, and 🎵 is remembered", async ({ page }) => {
  const sfx = () => page.locator("#mute-btn").textContent();
  await page.locator("#music-btn").click();
  expect((await music(page)).on).toBe(false);
  await expect(page.locator("#music-btn")).toHaveClass(/off/);
  expect(await sfx()).toBe("🔊"); // sound effects untouched
  await page.locator("#mute-btn").click();
  expect(await sfx()).toBe("🔇");
  expect((await music(page)).on).toBe(false); // music untouched by 🔊
  await page.reload();
  await page.waitForFunction(() => !!window.NeonDashTest);
  expect((await music(page)).on).toBe(false);
  await page.locator("#music-btn").click();
  expect((await music(page)).on).toBe(true);
  expect(await sfx()).toBe("🔇");
});

test.describe("buttons fit on a small phone", () => {
  test.use({ viewport: { width: 360, height: 640 } });
  test("🎵 doesn't overlap 🔊 or the pause button", async ({ page }) => {
    await page.evaluate(() => { window.NeonDashTest.start(); window.NeonDashTest.clearObstacles(); });
    const r = await page.evaluate(() => {
      const b = (id) => document.getElementById(id).getBoundingClientRect();
      const a = b("music-btn"), m = b("mute-btn"), p = b("pause-btn");
      const apart = (x, y) => x.right <= y.left || y.right <= x.left || x.bottom <= y.top || y.bottom <= x.top;
      return { musicMute: apart(a, m), musicPause: apart(a, p), onScreen: a.left >= 0 && a.bottom <= innerHeight };
    });
    expect(r).toEqual({ musicMute: true, musicPause: true, onScreen: true });
  });
});
