// Captures Play Store phone screenshots (1080x1920). Serve the repo on :8000 first
// (npm run serve), then: node scripts/capture-store-shots.js <outdir>
// Uses a served copy of game.js with a screenshot-only _stage() hook; the repo file is untouched.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'node_modules/playwright'));
const OUT = process.argv[2];
// Screenshot-only hook, injected into a served copy of game.js (repo file untouched).
const HOOK = `_stage(o) {
        obstacles.length = 0; gems.length = 0; powerups.length = 0;
        const P = { x: player.x, s: player.size, W, g: groundY };
        const L = o.layout(P);
        L.obstacles.forEach((x) => obstacles.push(x));
        L.gems.forEach((x) => gems.push(Object.assign({ r: 11, got: false, bob: 0 }, x)));
        L.powerups.forEach((x) => powerups.push(Object.assign({ r: 16, bob: 0, spin: 0 }, x)));
        if (o.coins != null) { coinCount = o.coins; coinsEl.textContent = coinCount; }
        if (o.magnet) magnetTime = o.magnet;
        if (o.slow) slowTime = o.slow;
        if (o.combo) { combo = o.combo; comboMult = o.comboMult || 2; }
      },
      getState() {`;
const src = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8').replace('getState() {', HOOK);
const LAYOUTS = {
  // mid-jump over spikes, gem arc + bar ahead
  runA: `(P) => ({ obstacles: [ { type: 'spikes', x: P.x - 14, w: 78, h: 34, count: 3, spikeW: 26 }, { type: 'bar', x: P.W - 70, w: 34, h: 30, y: P.g - 150 } ],
    gems: [0,1,2,3].map(i => ({ x: P.x + 120 + i * 40, y: P.g - 150 - Math.sin(i / 3 * Math.PI) * 55 })), powerups: [] })`,
  // shielded, slow-mo pickup ahead, spikes ahead
  runB: `(P) => ({ obstacles: [ { type: 'spikes', x: P.x + 150, w: 52, h: 34, count: 2, spikeW: 26 }, { type: 'spikes', x: P.W - 40, w: 26, h: 34, count: 1, spikeW: 26 } ],
    gems: [0,1,2].map(i => ({ x: P.x + 135 + i * 36, y: P.g - 110 - Math.sin(i / 2 * Math.PI) * 45 })), powerups: [ { type: 'slowmo', x: P.W - 60, y: P.g - 200 } ] })`,
  // magnet pulling a gem line, magnet + shield pickups ahead
  runC: `(P) => ({ obstacles: [ { type: 'bar', x: P.x + 190, w: 34, h: 30, y: P.g - 150 } ],
    gems: [0,1,2,3,4].map(i => ({ x: P.x + 60 + i * 34, y: P.g - 190 + i * 6 })), powerups: [ { type: 'magnet', x: P.W - 50, y: P.g - 120 } ] })`,
};
async function shot(b, name, skin, runMs, keepShield, seed, extra) {
  const ctx = await b.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  await p.route('**/game.js*', (r) => r.fulfill({ contentType: 'application/javascript', body: src }));
  await p.addInitScript((skin) => {
    let q = null; const o = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => { if (window.__freeze) { q = cb; return 1; } return o(cb); };
    window.__tick = () => { const c = q; q = null; if (c) c(performance.now()); };
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('neondash.best', '1840'); localStorage.setItem('neondash.bank', '420');
      localStorage.setItem('neondash.skins', JSON.stringify(['cyan', 'magenta', 'gold', 'emerald']));
      localStorage.setItem('neondash.skin', skin);
    }
  }, skin);
  await p.goto('http://localhost:8000/index.html?test=1');
  await p.waitForFunction(() => !!window.NeonDashTest && !!NeonDashTest._stage);
  await p.waitForTimeout(4500);
  await p.evaluate((seed) => { const t = NeonDashTest; t.seed(seed); t.start(); window.__sh = setInterval(() => t.giveShield(7), 40); }, seed);
  await p.waitForTimeout(runMs);
  await p.evaluate(() => NeonDashTest.jump());
  await p.waitForTimeout(extra.air || 200);
  await p.evaluate(([keep, layout, extra]) => {
    window.__freeze = true; clearInterval(window.__sh);
    if (!keep) NeonDashTest.giveShield(0);
    NeonDashTest._stage(Object.assign({ layout: eval(layout) }, extra));
  }, [keepShield, LAYOUTS[name], extra]);
  await p.waitForTimeout(80);
  await p.evaluate(() => { window.__tick(); window.__tick(); });
  await p.waitForTimeout(80);
  await p.screenshot({ path: `${OUT}/raw-${name}.png` });
  console.log(name, JSON.stringify(await p.evaluate(() => { const s = NeonDashTest.getState(); return { state: s.state, score: s.score, ob: s.obstacles, gems: s.gems, pu: s.powerups, shield: +s.shieldTime.toFixed(1), mag: s.magnetTime }; })));
  await ctx.close();
}
(async () => {
  const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
  await shot(b, 'runA', 'magenta', 6000, false, 3, { coins: 23, combo: 6, comboMult: 2, air: 230 });
  await shot(b, 'runB', 'gold', 9000, true, 11, { coins: 41, air: 120 });
  await shot(b, 'runC', 'emerald', 12000, false, 21, { coins: 58, magnet: 4, combo: 12, comboMult: 3, air: 260 });
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
