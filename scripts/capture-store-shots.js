// Play Store assets for Neon Dash (ND-018).
//   npm run serve            (repo on :8000)
//   PW_CHROMIUM=/usr/bin/chromium node scripts/capture-store-shots.js docs/store
// Writes:
//   <out>/screenshots/raw-*.png      1080x1920 game frames
//   <out>/screenshots/0N-*.png       1080x1920 captioned store screenshots
//   <out>/feature-graphic.png        1024x500
// Gameplay frames come from a served COPY of game.js with two screenshot-only hooks
// (_stage, _pow) so a scene can be posed; the repo's game.js is never modified.
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const { chromium } = require(path.join(ROOT, "node_modules/playwright"));
const OUT = path.resolve(process.argv[2] || path.join(ROOT, "docs/store"));
const SHOTS = path.join(OUT, "screenshots");
fs.mkdirSync(SHOTS, { recursive: true });

const HOOKS = `_stage(o) {
        obstacles.length = 0; gems.length = 0; powerups.length = 0;
        const P = { x: player.x, s: player.size, W, g: groundY };
        const L = o.layout(P);
        L.obstacles.forEach((x) => obstacles.push(x));
        L.gems.forEach((x) => gems.push(Object.assign({ r: 11, got: false, bob: 0 }, x)));
        L.powerups.forEach((x) => powerups.push(Object.assign({ r: 16, bob: 0, spin: 0 }, x)));
        if (o.coins != null) { coinCount = o.coins; coinsEl.textContent = coinCount; }
        if (o.combo) { combo = o.combo; comboMult = o.comboMult || 2; }
      },
      _pow(o) { shieldTime = o.shield || 0; magnetTime = o.magnet || 0; slowTime = o.slow || 0; },
      getState() {`;
const GAME_SRC = fs.readFileSync(path.join(ROOT, "game.js"), "utf8").replace("getState() {", HOOKS);

const BASE = "http://localhost:8000/index.html?test=1";
const exe = process.env.PW_CHROMIUM || undefined;

async function newPage(b, { w = 360, h = 640, dsf = 3, skin = "cyan", app = true, bank = 420 } = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf, isMobile: w < 900, hasTouch: true });
  const p = await ctx.newPage();
  await p.route("**/game.js*", (r) => r.fulfill({ contentType: "application/javascript", body: GAME_SRC }));
  await p.addInitScript(({ skin, app, bank }) => {
    // Freeze switch: hold the next animation frame so one exact frame can be drawn.
    let q = null; const o = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => { if (window.__freeze) { q = cb; return 1; } return o(cb); };
    window.__tick = () => { const c = q; q = null; if (c) c(performance.now()); };
    if (app) window.Capacitor = { isNativePlatform: () => true }; // app look (no QR)
    if (!sessionStorage.getItem("seeded")) {
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem("neondash.best", "1840");
      localStorage.setItem("neondash.bank", String(bank));
      localStorage.setItem("neondash.lifetimeGems", "2600");
      localStorage.setItem("neondash.skins", JSON.stringify(["cyan", "magenta", "gold", "emerald"]));
      localStorage.setItem("neondash.skin", skin);
      localStorage.setItem("neondash.shoes", JSON.stringify(["classic", "retro"]));
      localStorage.setItem("neondash.shoe", "retro");
    }
  }, { skin, app, bank });
  await p.goto(BASE);
  await p.waitForFunction(() => !!window.NeonDashTest && !!window.NeonDashTest._stage);
  await p.waitForTimeout(4500); // daily-bonus toast clears
  return { ctx, p };
}

// A posed gameplay frame. keepShield: shield refreshed every 40 ms so the run survives.
async function gameplay(b, name, o) {
  const { ctx, p } = await newPage(b, o.page || {});
  await p.evaluate((seed) => {
    const t = NeonDashTest; t.seed(seed); t.start();
    window.__sh = setInterval(() => { t.giveShield(7); t.clearObstacles(); }, 40);
  }, o.seed || 3);
  await p.waitForTimeout(o.runMs || 6000);
  if (o.powers) { // switch to the shot's power-ups a moment early so the sparks match
    await p.evaluate((pw) => { clearInterval(window.__sh); window.__sh = setInterval(() => { NeonDashTest._pow(pw); NeonDashTest.clearObstacles(); }, 40); }, o.powers);
    await p.waitForTimeout(1300);
  }
  if (o.jump) { await p.evaluate(() => NeonDashTest.jump()); await p.waitForTimeout(o.air || 220); }
  await p.evaluate(([layout, extra, powers]) => {
    window.__freeze = true; clearInterval(window.__sh);
    NeonDashTest._pow(powers || {});
    NeonDashTest._stage(Object.assign({ layout: eval(layout) }, extra));
  }, [o.layout, o.extra || {}, o.powers || null]);
  await p.waitForTimeout(80);
  await p.evaluate(() => { window.__tick(); window.__tick(); });
  await p.waitForTimeout(80);
  if (o.hideUi) await p.addStyleTag({ content: "#hud,#pause-btn,#mute-btn{display:none!important}" });
  const file = path.join(o.dir || SHOTS, name + ".png");
  await p.screenshot({ path: file });
  await ctx.close();
  return file;
}

async function menu(b, name, o) {
  const { ctx, p } = await newPage(b, o.page || {});
  if (o.pick) await p.click(`#boost-start .boost-chip[data-boost="${o.pick}"]`);
  if (o.scrollTo) await p.evaluate((sel) => {
    const s = document.getElementById("start-screen");
    const el = document.querySelector(sel);
    s.scrollTop = el.getBoundingClientRect().top + s.scrollTop - 6;
  }, o.scrollTo);
  await p.waitForTimeout(300);
  const file = path.join(SHOTS, name + ".png");
  await p.screenshot({ path: file });
  await ctx.close();
  return file;
}

const L = {
  jump: `(P) => ({ obstacles: [ { type: 'spikes', x: P.x - 14, w: 78, h: 34, count: 3, spikeW: 26 }, { type: 'bar', x: P.W - 70, w: 34, h: 30, y: P.g - 150 } ],
    gems: [0,1,2,3].map(i => ({ x: P.x + 120 + i * 40, y: P.g - 150 - Math.sin(i / 3 * Math.PI) * 55 })), powerups: [] })`,
  shield: `(P) => ({ obstacles: [ { type: 'spikes', x: P.x + 170, w: 52, h: 34, count: 2, spikeW: 26 } ],
    gems: [0,1,2].map(i => ({ x: P.x + 150 + i * 36, y: P.g - 120 - Math.sin(i / 2 * Math.PI) * 45 })), powerups: [ { type: 'magnet', x: P.W - 50, y: P.g - 210 } ] })`,
  rainbow: `(P) => ({ obstacles: [ { type: 'bar', x: P.W - 60, w: 34, h: 30, y: P.g - 150 } ],
    gems: [0,1,2,3,4].map(i => ({ x: P.x + 70 + i * 34, y: P.g - 170 + i * 8 })), powerups: [] })`,
  feature: `(P) => ({ obstacles: [ { type: 'spikes', x: P.x + 230, w: 78, h: 34, count: 3, spikeW: 26 }, { type: 'bar', x: P.x + 400, w: 34, h: 30, y: P.g - 150 } ],
    gems: [0,1,2,3,4].map(i => ({ x: P.x + 200 + i * 38, y: P.g - 120 - Math.sin(i / 4 * Math.PI) * 70 })), powerups: [ { type: 'shield', x: P.x + 560, y: P.g - 170 } ] })`,
};

const CAPTIONS = [
  ["01-triple-jump", "raw-jump", "Tap to <b>triple-jump</b><br>over neon spikes"],
  ["02-power-shoes", "raw-shield", "Power-ups <b>light up</b><br>your shoes"],
  ["03-rainbow", "raw-rainbow", "Stack power-ups for<br><b>rainbow kicks</b>"],
  ["04-boost", "raw-start", "<b>Boost</b> your next run<br>with a power-up"],
  ["05-unlocks", "raw-shop", "Unlock <b>skins</b>, <b>shoes</b><br>&amp; daily missions"],
];

function frameHtml(img, caption) {
  return `<!doctype html><html><head><style>
  html,body{margin:0;width:1080px;height:1920px;overflow:hidden}
  body{background:radial-gradient(ellipse at 50% 0%,#2b1d4e 0%,#120b26 45%,#0d0d1a 100%);
       font-family:"Trebuchet MS","Segoe UI",system-ui,sans-serif;color:#fff;
       display:flex;flex-direction:column;align-items:center}
  .cap{height:330px;display:flex;align-items:center;justify-content:center;text-align:center;
       font-size:76px;font-weight:900;line-height:1.08;letter-spacing:1px;padding:0 50px;
       text-shadow:0 0 18px rgba(0,245,255,.35)}
  .cap b{color:#00f5ff;text-shadow:0 0 22px rgba(0,245,255,.85),0 0 44px rgba(0,245,255,.4)}
  .cap b:nth-of-type(2){color:#ff5ec7;text-shadow:0 0 22px rgba(255,94,199,.85),0 0 44px rgba(255,94,199,.4)}
  .phone{width:860px;height:1529px;border-radius:56px;overflow:hidden;
       border:5px solid rgba(0,245,255,.55);
       box-shadow:0 0 40px rgba(0,245,255,.35),0 0 90px rgba(255,94,199,.18)}
  .phone img{width:100%;height:100%;display:block}
  </style></head><body><div class="cap"><div>${caption}</div></div>
  <div class="phone"><img src="data:image/png;base64,${img}"></div></body></html>`;
}

(async () => {
  const b = await chromium.launch({ executablePath: exe });
  await gameplay(b, "raw-jump", { page: { skin: "magenta" }, seed: 3, runMs: 6000, jump: true, air: 230, layout: L.jump, extra: { coins: 23, combo: 6, comboMult: 2 } });
  await gameplay(b, "raw-shield", { page: { skin: "gold" }, seed: 11, runMs: 7000, powers: { shield: 6 }, layout: L.shield, extra: { coins: 41 } });
  await gameplay(b, "raw-rainbow", { page: { skin: "emerald" }, seed: 21, runMs: 9000, powers: { magnet: 5, slow: 4 }, layout: L.rainbow, extra: { coins: 72, combo: 12, comboMult: 3 } });
  await menu(b, "raw-start", { pick: "magnet" });
  await menu(b, "raw-shop", { scrollTo: "#missions" });
  console.log("raw frames done");

  const fctx = await b.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const fp = await fctx.newPage();
  for (const [out, raw, cap] of CAPTIONS) {
    const img = fs.readFileSync(path.join(SHOTS, raw + ".png")).toString("base64");
    await fp.setContent(frameHtml(img, cap));
    await fp.waitForTimeout(200);
    await fp.screenshot({ path: path.join(SHOTS, out + ".png") });
  }
  await fctx.close();
  console.log("store screenshots done");

  // Feature graphic: a landscape gameplay frame + the title, 1024x500.
  const bg = await gameplay(b, "_feature-bg", {
    page: { w: 1024, h: 500, dsf: 1, skin: "magenta" }, seed: 5, runMs: 6000,
    powers: { shield: 6, magnet: 6 }, layout: L.feature, hideUi: true, dir: OUT,
  });
  const gctx = await b.newContext({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
  const gp = await gctx.newPage();
  const bgImg = fs.readFileSync(bg).toString("base64");
  await gp.setContent(`<!doctype html><html><head><style>
    html,body{margin:0;width:1024px;height:500px;overflow:hidden;font-family:"Trebuchet MS","Segoe UI",system-ui,sans-serif}
    .bg{position:absolute;inset:0;background:url(data:image/png;base64,${bgImg}) center/cover}
    .shade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(13,13,26,0) 35%,rgba(13,13,26,.75) 75%)}
    .t{position:absolute;right:56px;top:50%;transform:translateY(-58%);text-align:right}
    h1{margin:0;font-size:118px;font-weight:900;letter-spacing:5px;line-height:.9;color:#00f5ff;
       text-shadow:0 0 20px rgba(0,245,255,.85),0 0 46px rgba(0,245,255,.45)}
    h1 span{display:block;color:#ff5ec7;text-shadow:0 0 20px rgba(255,94,199,.85),0 0 46px rgba(255,94,199,.45)}
    p{margin:18px 4px 0;color:#fff;font-size:27px;letter-spacing:3px;opacity:.9}
  </style></head><body><div class="bg"></div><div class="shade"></div>
  <div class="t"><h1>NEON<span>DASH</span></h1><p>TAP · JUMP · GLOW</p></div></body></html>`);
  await gp.waitForTimeout(200);
  await gp.screenshot({ path: path.join(OUT, "feature-graphic.png") });
  await gctx.close();
  fs.unlinkSync(bg);
  console.log("feature graphic done");
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
