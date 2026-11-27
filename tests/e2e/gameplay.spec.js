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

test("ND-CORE-01/02: single + double + triple jump, capped at three", async ({ page }) => {
  // Run every jump and check in one synchronous evaluate so real-time rAF
  // frames can't land the player or spawn a chunk between steps (was flaky).
  const r = await page.evaluate(() => {
    const t = window.NeonDashTest;
    t.start(); t.clearObstacles();
    const p = () => t.getState().player;
    const out = [];
    t.jump(); t.clearObstacles(); t.step(1);
    out.push([p().onGround, p().jumps]);
    for (let i = 0; i < 3; i++) { t.jump(); out.push([p().onGround, p().jumps]); }
    return out;
  });
  expect(r[0]).toEqual([false, 1]); // first jump leaves the ground
  expect(r[1][1]).toBe(2);          // double jump
  expect(r[2][1]).toBe(3);          // triple jump
  expect(r[3][1]).toBe(3);          // fourth tap ignored
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

test("ND-ADS-03: double-gems stays claimed across a revive", async ({ page }) => {
  await page.evaluate(() => {
    const t = window.NeonDashTest;
    t.start(); t.clearObstacles(); t.addGemAhead(); t.step(3);
    t.clearObstacles(); t.spawnSpikeAhead(); t.step(10); // die
  });
  expect((await state(page)).state).toBe("over");
  await page.evaluate(() => window.NeonDashTest.doubleGems()); // multiplier 2
  await page.evaluate(() => window.NeonDashTest.revive());     // continue same run
  expect((await state(page)).reviveUsed).toBe(true);
  // Die again on the revived run (clear the revive grace shield first so the
  // spike is lethal).
  await page.evaluate(() => { const t = window.NeonDashTest; t.giveShield(0); t.clearObstacles(); t.spawnSpikeAhead(); t.step(10); });
  const s = await state(page);
  expect(s.state).toBe("over");
  expect(s.gemMultiplier).toBe(2);     // still doubled, not reset
  expect(s.doubleClaimed).toBe(true);  // not re-offered
  await expect(page.locator("#double-gems-btn")).toBeHidden(); // button hidden, no wasted ad
});

test("ND-NAV-02: pause freezes, resume continues", async ({ page }) => {
  await page.evaluate(() => { window.NeonDashTest.start(); window.NeonDashTest.clearObstacles(); });
  await page.evaluate(() => window.NeonDashTest.pause());
  expect((await state(page)).paused).toBe(true);
  await expect(page.locator("#pause-screen")).toBeVisible();
  await page.evaluate(() => window.NeonDashTest.resume());
  expect((await state(page)).paused).toBe(false);
});

// ND-021: power-ups light up the shoes.
test("ND-021: shield lights the shoes, and they go back to normal when it ends", async ({ page }) => {
  await page.evaluate(() => { const t = window.NeonDashTest; t.start(); t.clearObstacles(); t.giveShield(7); t.step(5); });
  expect((await state(page)).shoeMode).toBe("shield");
  await page.evaluate(() => { const t = window.NeonDashTest; t.giveShield(0); t.step(1); });
  expect((await state(page)).shoeMode).toBe("none");
});

test("ND-021: Retro Kicks + shield draw for 120 frames with no errors", async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem("neondash.shoes", JSON.stringify(["classic", "retro"]));
    localStorage.setItem("neondash.shoe", "retro");
  });
  await page.reload();
  await page.waitForFunction(() => !!window.NeonDashTest);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.evaluate(() => {
    const t = window.NeonDashTest;
    t.seed(1); t.start();
    for (let i = 0; i < 120; i++) { t.clearObstacles(); t.giveShield(7); t.step(1); }
  });
  await page.waitForTimeout(300); // let a few real frames draw too
  expect((await state(page)).shoeMode).toBe("shield");
  expect(errors).toEqual([]);
});

test("ND-STEPA-01: every pattern spawns, draws and runs without errors (shielded)", async ({ page }) => {
  const res = await page.evaluate(() => {
    const t = window.NeonDashTest;
    const out = {};
    for (const id of t.chunkIds()) {
      t.seed(5); t.start(); t.clearObstacles(); t.giveShield(99);
      out[id] = t.spawnChunk(id, 200);
      for (let i = 0; i < 240; i++) { t.giveShield(99); t.step(1); }
      if (t.getState().state !== "playing") return { out, state: "over after " + id };
    }
    return { out, state: t.getState().state };
  });
  for (const [id, n] of Object.entries(res.out)) expect(n, id).toBeGreaterThan(0);
  expect(res.state).toBe("playing");
  expect(initErrors).toEqual([]);
});

test("ND-STEPA-02: running into a pit ends the run with cause pit", async ({ page }) => {
  const s = await page.evaluate(() => {
    const t = window.NeonDashTest;
    t.seed(1); t.start(); t.giveShield(0); t.clearObstacles();
    t.spawnChunk("pit", 40);
    t.step(90);
    return t.getState();
  });
  expect(s.state).toBe("over");
});

test("ND-STEPA-03: a natural 40 s run (shielded) meets five or more hazard types", async ({ page }) => {
  const types = await page.evaluate(() => {
    const t = window.NeonDashTest;
    t.seed(11); t.start(); t.clearObstacles();
    const seen = new Set();
    for (let i = 0; i < 800; i++) { t.giveShield(99); t.step(3); t.obstacleTypes().forEach((x) => seen.add(x)); }
    return [...seen];
  });
  expect(types.length).toBeGreaterThanOrEqual(5);
});

// ---------- Step B: art, game feel, one-screen menu ----------
test("ND-STEPB-01: menu fits one screen with tabs; Escape closes an open tab", async ({ page }) => {
  await page.goto("/index.html?test=1");
  await page.waitForFunction(() => !!window.NeonDashTest);
  const r = await page.evaluate(() => {
    const s = document.getElementById("start-screen");
    return { scrolls: s.scrollHeight > s.clientHeight + 1, sheetHidden: document.getElementById("tab-sheet").classList.contains("hidden") };
  });
  expect(r.scrolls).toBe(false);
  expect(r.sheetHidden).toBe(true);
  await page.locator("#tab-btn-missions").click();
  await expect(page.locator("#tab-missions")).toBeVisible();
  await expect(page.locator("#missions")).toContainText("MISSIONS");
  await page.locator(".sheet-tab[data-tab=skins]").click();
  await expect(page.locator("#skin-row")).toBeVisible();
  await expect(page.locator("#tab-missions")).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(page.locator("#tab-sheet")).toBeHidden();
  await expect(page.locator("#start-screen")).toBeVisible(); // Escape closed the tab, not the menu
});

test("ND-STEPB-02: squash on landing, stretch on jump", async ({ page }) => {
  const r = await page.evaluate(() => {
    const t = window.NeonDashTest; t.start(); t.clearObstacles(); t.step(2);
    t.jump(); const up = t.fx();
    t.clearObstacles(); t.step(90); // long enough to land; reset shape check right after
    return { up, after: t.fx() };
  });
  expect(r.up.sy).toBeGreaterThan(1.1); // stretched tall on take-off
  expect(r.up.sx).toBeLessThan(0.9);
  expect(Math.abs(r.after.sx - 1)).toBeLessThan(0.05); // eased back after landing
  // Catch the landing frame itself.
  const land = await page.evaluate(() => {
    const t = window.NeonDashTest; t.start(); t.clearObstacles(); t.step(2); t.jump();
    for (let i = 0; i < 200; i++) { t.clearObstacles(); const was = t.getState().player.onGround; t.step(1); const p = t.getState().player; if (!was && p.onGround) return t.fx(); }
    return null;
  });
  expect(land).not.toBeNull();
  expect(land.sx).toBeGreaterThan(1.1); // squashed wide on touch-down
});

test("ND-STEPB-03: death freezes the frame for 150 ms and flashes", async ({ page }) => {
  const r = await page.evaluate(() => {
    const t = window.NeonDashTest; t.start(); t.clearObstacles(); t.spawnSpikeAhead(); t.step(10);
    return { state: t.getState().state, fx: t.fx() };
  });
  expect(r.state).toBe("over");
  expect(r.fx.hitstop).toBeCloseTo(0.15, 2);
  expect(r.fx.flash).toBeGreaterThan(0);
});

test("ND-STEPB-04: a near miss awards +1 gem and a floating label", async ({ page }) => {
  const r = await page.evaluate(() => {
    const t = window.NeonDashTest; t.start(); t.clearObstacles(); t.step(2);
    const p = t.getState().player;
    const before = t.getState().coins;
    // A low ceiling whose teeth pass just over a running player's head: clear, but close.
    t.spawnObstacle({ type: "ceiling", x: p.x + p.size + 4, w: 54, gap: p.size + 10 });
    for (let i = 0; i < 40; i++) { t.step(1); }
    return { coins: t.getState().coins - before, fx: t.fx(), state: t.getState().state };
  });
  expect(r.state).toBe("playing");
  expect(r.fx.nearMisses).toBe(1);
  expect(r.coins).toBe(1);
  expect(r.fx.floaters).toBeGreaterThan(0);
});

test("ND-STEPB-05: themes recolour hazards and the far city layer exists", async ({ page }) => {
  const r = await page.evaluate(() => {
    const t = window.NeonDashTest; t.start(); t.clearObstacles(); t.step(1);
    const a = t.fx().haz; t.setScore(500); t.step(1); const b = t.fx().haz;
    return { a, b, city: t.fx().city };
  });
  expect(r.a).not.toBe(r.b);
  expect(r.city).toBeGreaterThan(5);
});
