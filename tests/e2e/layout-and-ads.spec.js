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
      const mu = document.getElementById("music-btn").getBoundingClientRect();
      return { hintBottom: h.bottom, muteTop: Math.min(m.top, mu.top) };
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
      const muteTop = Math.min(document.getElementById("mute-btn").getBoundingClientRect().top,
        document.getElementById("music-btn").getBoundingClientRect().top);
      return { titleTop, menuBottom, muteTop };
    });
    expect(r.titleTop).toBeGreaterThanOrEqual(0);
    expect(r.menuBottom).toBeLessThanOrEqual(r.muteTop);
  });
});

// ND-022: the plain web build has no ad network, so no "watch ad" reward is offered.
test("ND-022: web build without ads offers no ad rewards", async ({ page }) => {
  // ND-037: a first-ever run is the guided tutorial (no deaths); this test needs a normal run.
  await page.addInitScript(() => localStorage.setItem("neondash.tutorialDone", "1"));
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

// Step B: the one-screen menu and the game-over screen never overlap, toast included.
for (const vp of [{ width: 360, height: 640 }, { width: 667, height: 375 }, { width: 915, height: 412 }, { width: 1280, height: 720 }]) {
  test.describe(`ND-STEPB-06 no overlaps at ${vp.width}x${vp.height}`, () => {
    test.use({ viewport: vp });
    test("menu + game over: nothing overlaps, menu doesn't scroll", async ({ page }) => {
      await page.goto("/index.html?test=1");
      await page.waitForFunction(() => !!window.NeonDashTest);
      const overlaps = (sels) => page.evaluate((sels) => {
        const box = {};
        for (const q of sels) { const e = document.querySelector(q); if (!e) continue; const st = getComputedStyle(e); const r = e.getBoundingClientRect();
          if (st.display === "none" || st.visibility === "hidden" || r.width === 0 || e.closest(".hidden")) continue; box[q] = r; }
        const out = []; const ks = Object.keys(box);
        for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) { const a = box[ks[i]], c = box[ks[j]];
          if (a.left < c.right - 1 && c.left < a.right - 1 && a.top < c.bottom - 1 && c.top < a.bottom - 1) out.push(ks[i] + " x " + ks[j]); }
        return out;
      }, sels);
      const toast = (text) => page.evaluate((text) => {
        const el = document.getElementById("toast"); el.textContent = text; el.classList.remove("hidden"); el.classList.add("show");
        window.NeonDashTest.placeToast();
      }, text);
      await toast("Day 1 streak\n+15 ◆ daily bonus");
      expect(await overlaps(["#start-screen .title", "#start-screen .tagline", "#start-btn", "#start-screen .hint", ".menu-tabs", ".menu-links", "#mute-btn", "#music-btn", "#toast"])).toEqual([]);
      expect(await page.evaluate(() => { const s = document.getElementById("start-screen"); return s.scrollHeight > s.clientHeight + 1; })).toBe(false);
      await page.evaluate(() => { const t = window.NeonDashTest; t.start(); t.clearObstacles(); t.step(5); t.spawnSpikeAhead(); t.step(10); });
      await expect(page.locator("#gameover-screen")).toBeVisible();
      await page.waitForTimeout(600); // fade-in
      await toast("Retro Kicks unlocked!\nScored 1276!");
      expect(await overlaps(["#toast", "#gameover-screen .gameover-title", "#gameover-screen .results", "#revive-btn", "#restart-btn", "#menu-btn", "#mute-btn", "#music-btn", "#boost-over"])).toEqual([]);
      // ND-STEPB-07: game over fits one screen; PLAY AGAIN and MENU are in view without scrolling.
      const fit = await page.evaluate(() => { const s = document.getElementById("gameover-screen");
        return { scrolls: s.scrollHeight > s.clientHeight + 1, menuBottom: document.getElementById("menu-btn").getBoundingClientRect().bottom, h: innerHeight }; });
      expect(fit.scrolls).toBe(false);
      expect(fit.menuBottom).toBeLessThanOrEqual(fit.h);
    });
  });
}
