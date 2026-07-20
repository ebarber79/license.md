/* =========================================================================
 * NEON DASH — an HTML5 Canvas endless runner
 * Tap / click / space to jump. Up to two more taps in mid-air = triple jump.
 * Dodge spikes, collect gems, survive as long as you can.
 * ========================================================================= */

(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  // ---- DOM refs ----
  const hud = document.getElementById("hud");
  const scoreEl = document.getElementById("score");
  const coinsEl = document.getElementById("coins");
  const bestEl = document.getElementById("best");
  const startScreen = document.getElementById("start-screen");
  const gameoverScreen = document.getElementById("gameover-screen");
  const startBtn = document.getElementById("start-btn");
  const restartBtn = document.getElementById("restart-btn");
  const startBestEl = document.getElementById("start-best");
  const finalScoreEl = document.getElementById("final-score");
  const finalCoinsEl = document.getElementById("final-coins");
  const finalBestEl = document.getElementById("final-best");
  const newRecordEl = document.getElementById("new-record");
  const muteBtn = document.getElementById("mute-btn");
  const pauseBtn = document.getElementById("pause-btn");
  const pauseScreen = document.getElementById("pause-screen");
  const resumeBtn = document.getElementById("resume-btn");
  const quitBtn = document.getElementById("quit-btn");
  const bankEl = document.getElementById("bank");
  const skinRow = document.getElementById("skin-row");
  const shoeRow = document.getElementById("shoe-row");
  const gemShopEl = document.getElementById("gem-shop");
  const gemPackRow = document.getElementById("gem-pack-row");
  const qrEl = document.getElementById("qr");
  const menuBtn = document.getElementById("menu-btn");
  const doubleGemsBtn = document.getElementById("double-gems-btn");
  const reviveBtn = document.getElementById("revive-btn");
  const toastEl = document.getElementById("toast");
  const streakEl = document.getElementById("streak");
  const dailyRowEl = document.getElementById("daily-row");
  const missionsEl = document.getElementById("missions");
  const comboItem = document.getElementById("combo-item");
  const comboMultEl = document.getElementById("combo-mult");

  // ---- Retention progress (streak / daily / missions); stub-safe ----
  const progress = window.NeonProgress || {
    startDay() { return { isNewDay: false, streak: 0, reward: 0 }; },
    recordRun() { return { rewards: 0, completed: [] }; },
    summary() { return { streak: 0, daily: { progress: 0, target: 0, done: false }, missions: [] }; },
  };
  let powerupsUsedRun = 0;
  let runPending = false;

  // ---- Ads / monetization (portal-agnostic; stub by default) ----
  const ads = window.NeonAds || {
    init() {}, gameplayStart() {}, gameplayStop() {},
    commercialBreak() { return Promise.resolve(); },
    rewarded() { return Promise.resolve(false); },
    available: false,
  };
  ads.init();

  // ---- In-app purchases (gem packs; native-only, stub on web) ----
  const iap = window.NeonIAP || {
    init() { return Promise.resolve(); }, packs() { return []; },
    buy() { return Promise.resolve({ ok: false, gems: 0 }); },
    restore() { return Promise.resolve(); }, available: false,
  };
  // Populate the store, then reveal the gem-pack UI if any packs came back.
  iap.init().then(() => renderGemPacks());

  let runCount = 0;

  // ---- Deterministic RNG (seedable for tests; Math.random in production) ----
  let rng = null;
  function rnd() { return rng ? rng() : Math.random(); }

  // ---- Telemetry + platform helpers ----
  function track(event, props) {
    try { if (window.NeonAnalytics) window.NeonAnalytics.track(event, props); } catch (e) { /* ignore */ }
  }
  function safeSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* storage may be unavailable (ND-DATA-05) */ }
  }
  function safeGet(key) {
    // localStorage access can throw in private mode / when storage is blocked.
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  // Respect prefers-reduced-motion (BUG-01 / ND-A11Y-01).
  const motionQuery = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  let reduceMotion = motionQuery ? motionQuery.matches : false;
  if (motionQuery && motionQuery.addEventListener) {
    motionQuery.addEventListener("change", (e) => { reduceMotion = e.matches; });
  }
  // PWA install funnel (ND-AN: pwa_installed).
  window.addEventListener("appinstalled", () => track("pwa_installed", {}));

  let runId = null;
  let runStart = 0;
  let lastCrashCause = "unknown";

  // ---- Audio (synthesized, no asset files) ----
  const audio = {
    ctx: null,
    muted: safeGet("neondash.muted") === "1",
    ensure() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) this.ctx = new AC();
      }
      if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
    },
    tone(freq, dur, type = "square", vol = 0.15, slideTo = null) {
      if (this.muted || !this.ctx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + dur);
    },
    jump() { this.tone(420, 0.16, "square", 0.12, 720); },
    doubleJump() { this.tone(620, 0.16, "square", 0.12, 980); },
    coin() { this.tone(880, 0.08, "triangle", 0.16, 1320); },
    power() { this.tone(300, 0.25, "sawtooth", 0.14, 900); },
    shieldBreak() { this.tone(500, 0.2, "sawtooth", 0.16, 120); },
    crash() { this.tone(220, 0.45, "sawtooth", 0.2, 60); },
  };

  function updateMuteUI() {
    muteBtn.textContent = audio.muted ? "🔇" : "🔊";
  }
  muteBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    audio.muted = !audio.muted;
    safeSet("neondash.muted", audio.muted ? "1" : "0");
    updateMuteUI();
  });

  // ---- World constants (in CSS pixels) ----
  const GROUND_RATIO = 0.82;   // ground line as fraction of height
  const GRAVITY = 3800;        // px/s^2
  const JUMP_VELOCITY = -1100; // px/s
  const PLAYER_X_RATIO = 0.22; // player horizontal position
  const PLAYER_SIZE = 46;
  const START_SPEED = 420;     // px/s
  const MAX_SPEED = 1100;
  const SPEED_RAMP = 16;       // px/s gained per second
  const SHIELD_DURATION = 7;   // seconds of protection per shield pickup
  const MAGNET_DURATION = 6;   // seconds gems are pulled toward the player
  const SLOWMO_DURATION = 5;   // seconds of slow-motion
  const SLOWMO_FACTOR = 0.5;   // world speed multiplier during slow-mo
  const MAGNET_RANGE = 230;    // px radius the magnet attracts gems within
  const COMBO_STEP = 5;        // gems per consecutive-chain multiplier tier
  const COMBO_MAX_MULT = 5;    // multiplier cap (x5 at a 20-gem chain)
  const HIGH_SCORE_KEY = "neondash.best";
  const BANK_KEY = "neondash.bank";
  const OWNED_KEY = "neondash.skins";
  const SKIN_KEY = "neondash.skin";

  // Unlockable player skins. `rainbow` animates its hue at runtime.
  const SKINS = [
    { id: "cyan",    name: "Cyan",    cost: 0,   c0: "#7afcff", c1: "#0091ff", trail: "#00f5ff" },
    { id: "magenta", name: "Magenta", cost: 60,  c0: "#ff9be0", c1: "#c01f8f", trail: "#ff5ec7" },
    { id: "gold",    name: "Gold",    cost: 150, c0: "#fff0a0", c1: "#e0a020", trail: "#ffd84d" },
    { id: "emerald", name: "Emerald", cost: 300, c0: "#9bffce", c1: "#1f9e6e", trail: "#00ffb4" },
    { id: "ember",   name: "Ember",   cost: 500, c0: "#ffb37a", c1: "#d83a1f", trail: "#ff6b3a" },
    { id: "rainbow", name: "Rainbow", cost: 900, rainbow: true, trail: "#ffffff" },
  ];

  // Shoe cosmetics — a layer drawn on the running feet, SEPARATE from body
  // skins. "classic" is the default neon foot. "retro" is a special chunky
  // sneaker earned (not bought with gems) by ANY of three paths: watching a
  // rewarded video, a high-scoring run (performance), or a player level.
  const SHOES_OWNED_KEY = "neondash.shoes";
  const SHOE_KEY = "neondash.shoe";
  const LIFETIME_KEY = "neondash.lifetimeGems";
  const RETRO_SCORE_UNLOCK = 800; // performance path: one run scoring this high
  const RETRO_LEVEL_UNLOCK = 6;   // level path: reach this player level
  const SHOES = [
    { id: "classic", name: "Classic", special: false },
    { id: "retro",   name: "Retro Kicks", special: true },
  ];
  // Retro sneaker palette (iconic red/white/gold, independent of the skin).
  const RETRO = { sole: "#fdfdff", upper: "#ff3b6b", stripe: "#ffd84d" };

  // Background themes the world cycles through as the score climbs.
  // Each: [skyTop, skyBottom, accent (ground/grid), hill color].
  const THEMES = [
    { top: "#1a1a3e", bot: "#3d1f5e", accent: "#00f5ff", hill: "#502878" }, // twilight
    { top: "#2e1a3e", bot: "#5e1f3d", accent: "#ff5ec7", hill: "#78284f" }, // dusk
    { top: "#0d2340", bot: "#1f4e5e", accent: "#00ffb4", hill: "#1f5e55" }, // deep sea
    { top: "#3e2a1a", bot: "#5e3a1f", accent: "#ffb347", hill: "#785028" }, // sunset
    { top: "#0d0d1a", bot: "#1a1a3e", accent: "#9d6cff", hill: "#3a2878" }, // midnight
  ];

  // ---- Runtime sizing ----
  let W = 0, H = 0, groundY = 0, dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    groundY = H * GROUND_RATIO;
    if (state === "menu" || state === "over") drawStaticBackdrop();
  }
  window.addEventListener("resize", resize);

  // ---- Game state ----
  const STATE = { MENU: "menu", PLAYING: "playing", OVER: "over" };
  let state = STATE.MENU;

  let player, obstacles, gems, particles, stars, hills, powerups;
  let speed, distance, score, coinCount, spawnTimer, gemTimer, powerTimer;
  let shieldTime = 0;  // seconds of shield remaining
  let magnetTime = 0;  // seconds of gem-magnet remaining
  let slowTime = 0;    // seconds of slow-motion remaining
  let gemMultiplier = 1; // 2 after a rewarded "double gems"
  let combo = 0;         // consecutive gems collected without an obstacle hit
  let comboMult = 1;     // gem-value multiplier derived from the current combo
  let reviveUsed = false; // a run gets at most one rewarded revive
  let doubleClaimed = false; // double-gems claimed this run (persists across Revive)
  let best = loadBest();
  let lastTime = 0;
  let shake = 0;
  let paused = false;
  let rafId = 0; // handle of the in-flight animation frame (single loop chain)

  // Progression state
  let bank = parseInt(safeGet(BANK_KEY) || "0", 10) || 0;
  let owned = loadOwned();
  let selectedSkin = safeGet(SKIN_KEY) || "cyan";
  let ownedShoes = loadOwnedShoes();
  let selectedShoe = safeGet(SHOE_KEY) || "classic";
  let lifetimeGems = parseInt(safeGet(LIFETIME_KEY) || "0", 10) || 0;

  function loadBest() {
    const v = parseInt(safeGet(HIGH_SCORE_KEY) || "0", 10);
    return Number.isFinite(v) ? v : 0;
  }
  function saveBest(v) {
    safeSet(HIGH_SCORE_KEY, String(v));
  }
  function loadOwned() {
    try {
      const arr = JSON.parse(safeGet(OWNED_KEY) || "[]");
      const set = new Set(Array.isArray(arr) ? arr : []);
      set.add("cyan"); // default is always owned
      return set;
    } catch (e) { return new Set(["cyan"]); }
  }
  function loadOwnedShoes() {
    try {
      const arr = JSON.parse(safeGet(SHOES_OWNED_KEY) || "[]");
      const set = new Set(Array.isArray(arr) ? arr : []);
      set.add("classic"); // default is always owned
      return set;
    } catch (e) { return new Set(["classic"]); }
  }
  function persistProgress() {
    try {
      localStorage.setItem(BANK_KEY, String(bank));
      localStorage.setItem(OWNED_KEY, JSON.stringify([...owned]));
      localStorage.setItem(SKIN_KEY, selectedSkin);
      localStorage.setItem(SHOES_OWNED_KEY, JSON.stringify([...ownedShoes]));
      localStorage.setItem(SHOE_KEY, selectedShoe);
      localStorage.setItem(LIFETIME_KEY, String(lifetimeGems));
    } catch (e) { /* ignore */ }
  }
  function activeSkin() {
    return SKINS.find((s) => s.id === selectedSkin) || SKINS[0];
  }
  function activeShoe() {
    return SHOES.find((s) => s.id === selectedShoe) || SHOES[0];
  }
  // Player level from lifetime gems earned — a slow progression curve, distinct
  // from a single good run. Lv.6 ≈ 1000 lifetime gems.
  function playerLevel() {
    return Math.floor(Math.sqrt(Math.max(0, lifetimeGems) / 40)) + 1;
  }
  // Retro is EARNED (never bought): true once a high-scoring run or a level
  // milestone has been reached. The rewarded-ad path unlocks it directly.
  function retroEarnedByPlay() {
    return best >= RETRO_SCORE_UNLOCK || playerLevel() >= RETRO_LEVEL_UNLOCK;
  }
  function unlockShoe(id, how) {
    if (ownedShoes.has(id)) return false;
    ownedShoes.add(id);
    persistProgress();
    track("shoe_unlocked", { shoe_id: id, via: how });
    return true;
  }
  function vibrate(ms) {
    if (navigator.vibrate && !audio.muted) {
      try { navigator.vibrate(ms); } catch (e) { /* ignore */ }
    }
  }

  // ---- Background layers (built once, scroll independently) ----
  function buildBackground() {
    stars = [];
    for (let i = 0; i < 70; i++) {
      stars.push({
        x: rnd(),
        y: rnd() * 0.7,
        r: rnd() * 1.6 + 0.4,
        tw: rnd() * Math.PI * 2,
      });
    }
    hills = [];
    let x = 0;
    while (x < 1.4) {
      hills.push({ x, h: 0.10 + rnd() * 0.16, w: 0.18 + rnd() * 0.14 });
      x += 0.16 + rnd() * 0.12;
    }
  }

  let bgScroll = 0;

  // ---- Reset for a new run ----
  function reset() {
    player = {
      x: W * PLAYER_X_RATIO,
      y: groundY - PLAYER_SIZE,
      vy: 0,
      size: PLAYER_SIZE,
      onGround: true,
      jumps: 0,
      rot: 0,
      trail: [],
    };
    obstacles = [];
    gems = [];
    particles = [];
    powerups = [];
    speed = START_SPEED;
    distance = 0;
    score = 0;
    coinCount = 0;
    gemMultiplier = 1;
    combo = 0;
    comboMult = 1;
    updateComboHud();
    reviveUsed = false;
    doubleClaimed = false;
    powerupsUsedRun = 0;
    spawnTimer = 0.8;
    gemTimer = 1.4;
    powerTimer = 7 + rnd() * 4;
    shieldTime = 0;
    magnetTime = 0;
    slowTime = 0;
    shake = 0;
    bgScroll = 0;
  }

  // ---- Input ----
  function jump() {
    if (state !== STATE.PLAYING || paused) return;
    if (player.onGround) {
      player.vy = JUMP_VELOCITY;
      player.onGround = false;
      player.jumps = 1;
      spawnJumpDust();
      audio.jump();
    } else if (player.jumps < 3) {
      // 2nd and 3rd mid-air jumps, each a bit weaker (86% then 72%).
      player.vy = JUMP_VELOCITY * (player.jumps === 1 ? 0.86 : 0.72);
      player.jumps += 1;
      spawnJumpDust();
      audio.doubleJump();
    }
  }

  function onPress(e) {
    // Don't hijack taps/keys on any UI button (PLAY, mute, pause, shop chips,
    // ...) — let their native click / Space-Enter activation through.
    if (e.target.closest("button")) return;
    audio.ensure(); // unlock WebAudio on first user gesture
    if (e.type === "keydown") {
      if (e.code !== "Space" && e.code !== "ArrowUp" && e.key !== "w") return;
      e.preventDefault();
    } else {
      e.preventDefault();
    }
    jump();
  }
  window.addEventListener("pointerdown", onPress, { passive: false });
  window.addEventListener("keydown", onPress, { passive: false });

  startBtn.addEventListener("click", () => startGame());
  // Portal interstitial at a natural break — every 3rd replay, not every run.
  restartBtn.addEventListener("click", () => {
    if (runCount > 0 && runCount % 3 === 0) {
      ads.commercialBreak().catch(() => {}).then(() => startGame());
    } else {
      startGame();
    }
  });
  doubleGemsBtn.addEventListener("click", (e) => { e.stopPropagation(); claimDoubleGems(); });
  pauseBtn.addEventListener("click", (e) => { e.stopPropagation(); togglePause(); });
  resumeBtn.addEventListener("click", (e) => { e.stopPropagation(); togglePause(); });
  quitBtn.addEventListener("click", (e) => { e.stopPropagation(); quitToMenu(); });
  menuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    bankRun();
    state = STATE.MENU;
    gameoverScreen.classList.add("hidden");
    showMenu();
  });
  reviveBtn.addEventListener("click", (e) => { e.stopPropagation(); claimRevive(); });
  // Safety net: finalize a pending run (gems + daily/mission progress) if the
  // tab is closed/backgrounded mid-run, while paused, or on the game-over
  // screen. runPending stays true from startGame() until bankRun() clears it.
  // If gameplay was still active (PLAYING), balance the ads lifecycle too —
  // gameOver()/quitToMenu() already stop it on their own exit paths.
  window.addEventListener("pagehide", () => {
    if (!runPending) return;
    if (state === STATE.PLAYING) ads.gameplayStop();
    bankRun();
  });
  // If the page is restored from the back/forward cache after pagehide already
  // finalized the run, don't resume a banked run — return to the menu.
  window.addEventListener("pageshow", (e) => {
    if (e.persisted && !runPending && (state === STATE.PLAYING || state === STATE.OVER)) {
      paused = false;
      state = STATE.MENU;
      hud.classList.add("hidden");
      pauseBtn.classList.add("hidden");
      pauseScreen.classList.add("hidden");
      gameoverScreen.classList.add("hidden");
      showMenu();
    }
  });

  function startGame() {
    cancelAnimationFrame(rafId); // avoid a leftover OVER/idle frame double-driving the loop
    bankRun(); // bank the previous run's gems before starting a fresh one
    buildBackground();
    resize();
    reset();
    scoreEl.textContent = "0";
    coinsEl.textContent = "0";
    audio.ensure(); // BUG-03: unlock WebAudio on the PLAY/PLAY-AGAIN gesture
    paused = false;
    runId = (window.NeonAnalytics && window.NeonAnalytics.sessionId ? window.NeonAnalytics.sessionId : "r") + "-" + Date.now().toString(36);
    runStart = performance.now();
    runCount++;
    runPending = true;
    track("game_start", { skin: selectedSkin });
    ads.gameplayStart();
    state = STATE.PLAYING;
    startScreen.classList.add("hidden");
    gameoverScreen.classList.add("hidden");
    pauseScreen.classList.add("hidden");
    hud.classList.remove("hidden");
    pauseBtn.classList.remove("hidden");
    bestEl.textContent = best;
    updateMuteUI();
    lastTime = performance.now();
    rafId = requestAnimationFrame(loop);
  }

  // BUG-04: auto-pause when the tab/app is backgrounded mid-run.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === STATE.PLAYING && !paused) togglePause();
  });

  function togglePause() {
    if (state !== STATE.PLAYING) return;
    paused = !paused;
    pauseScreen.classList.toggle("hidden", !paused);
    pauseBtn.textContent = paused ? "▶" : "❚❚";
    if (!paused) {
      audio.ensure(); // BUG-03: ensure audio is unlocked after resume
      lastTime = performance.now(); // avoid a huge dt after resuming
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(loop);
    }
  }

  function quitToMenu() {
    paused = false;
    ads.gameplayStop(); // balance the gameplayStart() from startGame() on this exit path
    bankRun();
    state = STATE.MENU;
    pauseScreen.classList.add("hidden");
    pauseBtn.classList.add("hidden");
    hud.classList.add("hidden");
    showMenu();
  }

  // Bank a finished run's gems exactly once, applying any rewarded multiplier.
  // Called when leaving a finished run (Play Again / Menu / Quit / page hide) —
  // NOT in gameOver(), so a rewarded Revive can continue without double-counting.
  function bankRun() {
    // Record the finished run for retention (streak/daily/missions) once, and
    // pay out any completed goals.
    if (runPending) {
      runPending = false;
      const res = progress.recordRun({ score: score, gems: coinCount, powerups: powerupsUsedRun });
      if (res && res.rewards > 0) bank += res.rewards;
      if (res && res.completed && res.completed.length) showRewardToast(res.completed);
    }
    const gain = (coinCount || 0) * (gemMultiplier || 1);
    if (gain > 0) { bank += gain; lifetimeGems += gain; }
    // Level path: reaching the level milestone earns the Retro shoes.
    if (!ownedShoes.has("retro") && playerLevel() >= RETRO_LEVEL_UNLOCK) {
      if (unlockShoe("retro", "level")) {
        showToast("👟 Retro Kicks unlocked!\nReached level " + playerLevel());
      }
    }
    persistProgress();
    coinCount = 0;
    gemMultiplier = 1;
  }

  // ---- Retention UI ----
  let toastTimer = 0;
  // Show the combo multiplier badge only while a chain is boosting gems (>x1).
  function updateComboHud() {
    if (!comboItem || !comboMultEl) return;
    if (comboMult > 1) {
      comboMultEl.textContent = "×" + comboMult;
      comboItem.classList.remove("hidden");
    } else {
      comboItem.classList.add("hidden");
    }
  }

  function showToast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.remove("hidden");
    requestAnimationFrame(() => toastEl.classList.add("show"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove("show");
      setTimeout(() => toastEl.classList.add("hidden"), 350);
    }, 2600);
  }
  function showRewardToast(completed) {
    const total = completed.reduce((s, c) => s + c.reward, 0);
    const what = completed.length === 1 ? completed[0].desc : (completed.length + " goals complete");
    showToast("✓ " + what + "\n+" + total + " ◆");
  }

  // Daily login: streak + bonus gems, once per calendar day.
  function dailyCheckin() {
    const r = progress.startDay();
    if (r.reward > 0) {
      bank += r.reward;
      persistProgress();
      showToast("🔥 Day " + r.streak + " streak\n+" + r.reward + " ◆ daily bonus");
    }
  }

  function bar(progressVal, target) {
    const pct = target > 0 ? Math.min(100, Math.round((progressVal / target) * 100)) : 0;
    return '<div class="prog-bar"><span style="width:' + pct + '%"></span></div>';
  }
  function renderProgress() {
    const s = progress.summary();
    if (streakEl) streakEl.textContent = s.streak;
    if (dailyRowEl) {
      const d = s.daily;
      dailyRowEl.className = "prog-row" + (d.done ? " done" : "");
      dailyRowEl.innerHTML =
        '<div class="prog-head"><span>Daily: ' + (d.desc || "") + (d.done ? " ✓" : "") +
        '</span><span class="reward">+' + (d.reward || 0) + " ◆</span></div>" +
        (d.done ? "" : bar(d.progress, d.target));
    }
    if (missionsEl) {
      missionsEl.innerHTML = '<div class="prog-label">MISSIONS</div>' +
        s.missions.map((m) =>
          '<div class="prog-row' + (m.done ? " done" : "") + '">' +
          '<div class="prog-head"><span>' + m.desc + (m.done ? " ✓" : "") +
          '</span><span class="reward">+' + m.reward + " ◆</span></div>" +
          (m.done ? "" : bar(m.progress, m.target)) + "</div>"
        ).join("");
    }
  }

  function gameOver() {
    state = STATE.OVER;
    vibrate([40, 30, 80]);
    const newRecord = score > best;
    if (newRecord) { best = score; saveBest(best); }
    // Performance path: a single run scoring high enough earns the Retro shoes.
    if (!ownedShoes.has("retro") && score >= RETRO_SCORE_UNLOCK) {
      if (unlockShoe("retro", "performance")) {
        showToast("👟 Retro Kicks unlocked!\nScored " + score + "!");
      }
    }
    // NOTE: gems are NOT banked here — bankRun() does that when the run is
    // truly left, so a rewarded Revive can continue the same run cleanly.
    persistProgress();
    track("game_over", {
      run_id: runId,
      score: score,
      gems: coinCount,
      duration_ms: Math.round(performance.now() - runStart),
      cause: lastCrashCause,
      new_record: newRecord,
    });
    ads.gameplayStop();
    finalScoreEl.textContent = score;
    finalCoinsEl.textContent = coinCount;
    finalBestEl.textContent = best;
    newRecordEl.classList.toggle("hidden", !newRecord);
    // Rewarded surfaces. Revive: once per run. Double gems: once per run,
    // so it stays claimed across a Revive (no second ad for no extra reward).
    reviveBtn.disabled = false;
    reviveBtn.textContent = "▶ CONTINUE · watch ad";
    reviveBtn.classList.toggle("hidden", reviveUsed);
    if (!doubleClaimed) {
      doubleGemsBtn.disabled = false;
      doubleGemsBtn.textContent = "🎬 DOUBLE GEMS";
    }
    doubleGemsBtn.classList.toggle("hidden", coinCount <= 0 || doubleClaimed);
    hud.classList.add("hidden");
    pauseBtn.classList.add("hidden");
    gameoverScreen.classList.remove("hidden");
  }

  // Watch a rewarded ad to double this run's gems — applied via gemMultiplier
  // and banked by bankRun() when the run is left. Returns a Promise.
  function claimDoubleGems() {
    if (doubleClaimed) return Promise.resolve(false);
    const token = runId; // bind the reward to THIS game-over run
    doubleGemsBtn.disabled = true;
    return ads.rewarded("double_gems").then((ok) => {
      // Ignore a late async reward if the player already left this run.
      if (state !== STATE.OVER || runId !== token) return false;
      if (ok) {
        doubleClaimed = true;
        gemMultiplier = 2;
        finalCoinsEl.textContent = String(coinCount * 2);
        doubleGemsBtn.textContent = "✓ GEMS DOUBLED";
        track("reward_granted", { type: "double_gems", gems: coinCount });
      } else {
        doubleGemsBtn.disabled = false; // ad not completed — allow retry
      }
      return ok;
    });
  }

  // Watch a rewarded ad to continue the same run from where it ended.
  function claimRevive() {
    if (reviveUsed || state !== STATE.OVER) return Promise.resolve(false);
    const token = runId; // bind the reward to THIS game-over run
    reviveBtn.disabled = true;
    return ads.rewarded("revive").then((ok) => {
      // Ignore a late async reward if the player already left this run.
      if (state !== STATE.OVER || runId !== token) return false;
      if (ok) { revive(); }
      else { reviveBtn.disabled = false; }
      return ok;
    });
  }
  function revive() {
    reviveUsed = true;
    track("reward_granted", { type: "revive", score: score });
    // Clear immediate threats and give a short grace window.
    obstacles.length = 0;
    particles.length = 0;
    shieldTime = Math.max(shieldTime, 2.5);
    spawnTimer = Math.max(spawnTimer, 1.2);
    if (player) {
      player.y = groundY - player.size;
      player.vy = 0;
      player.onGround = true;
      player.jumps = 0;
    }
    gameoverScreen.classList.add("hidden");
    hud.classList.remove("hidden");
    pauseBtn.classList.remove("hidden");
    paused = false;
    state = STATE.PLAYING;
    ads.gameplayStart(); // resumed gameplay
    lastTime = performance.now();
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
  }

  // ---- Spawning ----
  function spawnObstacle() {
    // Either ground spikes (1-3) or a floating bar to duck/jump-time.
    const r = rnd();
    if (r < 0.78) {
      const count = 1 + Math.floor(rnd() * 3);
      const spikeW = 26;
      obstacles.push({
        type: "spikes",
        x: W + 40,
        w: spikeW * count,
        h: 34,
        count,
        spikeW,
      });
    } else {
      const h = 30;
      const gap = 120; // height of opening above ground the player jumps through
      obstacles.push({
        type: "bar",
        x: W + 40,
        w: 34,
        h,
        y: groundY - gap - h,
      });
    }
  }

  function spawnGemArc() {
    const n = 3 + Math.floor(rnd() * 3);
    const baseY = groundY - 70 - rnd() * 120;
    for (let i = 0; i < n; i++) {
      gems.push({
        x: W + 40 + i * 46,
        y: baseY - Math.sin((i / (n - 1)) * Math.PI) * 60,
        r: 11,
        got: false,
        bob: rnd() * Math.PI * 2,
      });
    }
  }

  const POWER_TYPES = ["shield", "magnet", "slowmo"];
  function spawnPowerup() {
    powerups.push({
      type: POWER_TYPES[Math.floor(rnd() * POWER_TYPES.length)],
      x: W + 50,
      y: groundY - 90 - rnd() * 100,
      r: 16,
      bob: rnd() * Math.PI * 2,
      spin: 0,
    });
  }

  const POWER_COLORS = { shield: "0,255,180", magnet: "255,216,77", slowmo: "120,180,255" };

  function applyPowerup(type) {
    if (type === "shield") shieldTime = SHIELD_DURATION;
    else if (type === "magnet") magnetTime = MAGNET_DURATION;
    else if (type === "slowmo") slowTime = SLOWMO_DURATION;
    audio.power();
    vibrate(35);
    powerupsUsedRun++;
    track("powerup_collected", { type: type });
    spawnRingBurst(POWER_COLORS[type] || "0,255,180");
  }

  // ---- Particles ----
  function spawnJumpDust() {
    for (let i = 0; i < 8; i++) {
      particles.push({
        x: player.x + player.size / 2,
        y: player.y + player.size,
        vx: (rnd() - 0.5) * 160,
        vy: rnd() * -120 - 20,
        life: 0.4,
        max: 0.4,
        color: "0,245,255",
        r: rnd() * 3 + 1,
      });
    }
  }
  function spawnGemBurst(x, y) {
    for (let i = 0; i < 12; i++) {
      const a = rnd() * Math.PI * 2;
      const sp = rnd() * 200 + 50;
      particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.5,
        max: 0.5,
        color: "255,216,77",
        r: rnd() * 3 + 1.5,
      });
    }
  }
  function spawnCrash() {
    for (let i = 0; i < 26; i++) {
      const a = rnd() * Math.PI * 2;
      const sp = rnd() * 320 + 60;
      particles.push({
        x: player.x + player.size / 2,
        y: player.y + player.size / 2,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.7,
        max: 0.7,
        color: "255,77,109",
        r: rnd() * 4 + 2,
      });
    }
  }

  function spawnRingBurst(color) {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const sp = 180;
      particles.push({
        x: player.x + player.size / 2,
        y: player.y + player.size / 2,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.5,
        max: 0.5,
        color,
        r: rnd() * 3 + 1.5,
      });
    }
  }

  // ---- Collision (AABB) ----
  const hits = NeonEngine.hits;

  // ---- Update ----
  function update(dt) {
    // Difficulty ramp
    speed = Math.min(MAX_SPEED, speed + SPEED_RAMP * dt);
    // Slow-mo scales how fast the world moves toward the player.
    const worldSpeed = speed * (slowTime > 0 ? SLOWMO_FACTOR : 1);
    distance += worldSpeed * dt;
    score = NeonEngine.scoreFromDistance(distance);
    scoreEl.textContent = score;
    bgScroll += worldSpeed * dt;
    theme = currentTheme();

    // Player physics
    player.vy += GRAVITY * dt;
    player.y += player.vy * dt;
    if (player.y >= groundY - player.size) {
      player.y = groundY - player.size;
      player.vy = 0;
      player.onGround = true;
      player.jumps = 0;
    }
    player.rot = player.onGround ? 0 : player.rot + dt * 8;

    // Player trail
    player.trail.unshift({ x: player.x, y: player.y });
    if (player.trail.length > 8) player.trail.pop();

    // Spawn obstacles
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnObstacle();
      // Spacing shrinks as speed rises, but never unfair.
      const base = Math.max(0.5, 1.4 - (speed - START_SPEED) / 700);
      spawnTimer = base + rnd() * 0.45;
    }
    // Spawn gems
    gemTimer -= dt;
    if (gemTimer <= 0) {
      spawnGemArc();
      gemTimer = 1.6 + rnd() * 1.8;
    }
    // Spawn shield power-ups (rare)
    powerTimer -= dt;
    if (powerTimer <= 0) {
      spawnPowerup();
      powerTimer = 12 + rnd() * 8;
    }
    // Countdown active power-ups
    if (shieldTime > 0) shieldTime = Math.max(0, shieldTime - dt);
    if (magnetTime > 0) magnetTime = Math.max(0, magnetTime - dt);
    if (slowTime > 0) slowTime = Math.max(0, slowTime - dt);

    // Move + test obstacles
    const px = player.x, py = player.y, ps = player.size;
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      o.x -= worldSpeed * dt;
      if (o.x + o.w < -10) { obstacles.splice(i, 1); continue; }

      let hit = false;
      if (o.type === "spikes") {
        // Slightly forgiving hitbox: inset the spikes.
        hit = hits(px + 6, py + 6, ps - 12, ps - 6, o.x + 4, groundY - o.h, o.w - 8, o.h);
      } else { // bar
        hit = hits(px + 6, py + 4, ps - 12, ps - 8, o.x, o.y, o.w, o.h);
      }
      if (hit) {
        if (shieldTime > 0) {
          // Shield absorbs the hit: shatter it and clear this obstacle.
          // Touching an obstacle breaks the gem chain (the shield saves the run,
          // not the combo) — a real cost that keeps the multiplier meaningful.
          shieldTime = 0;
          combo = 0;
          comboMult = 1;
          updateComboHud();
          shake = 10;
          audio.shieldBreak();
          vibrate(60);
          spawnRingBurst("0,255,180");
          obstacles.splice(i, 1);
        } else {
          lastCrashCause = o.type; // "spikes" | "bar"
          return crash();
        }
      }
    }

    // Move + collect power-ups
    for (let i = powerups.length - 1; i >= 0; i--) {
      const pu = powerups[i];
      pu.x -= worldSpeed * dt;
      pu.bob += dt * 4;
      pu.spin += dt * 3;
      if (pu.x + pu.r < -10) { powerups.splice(i, 1); continue; }
      if (hits(px, py, ps, ps, pu.x - pu.r, pu.y - pu.r, pu.r * 2, pu.r * 2)) {
        applyPowerup(pu.type);
        powerups.splice(i, 1);
      }
    }

    // Move + collect gems
    const pcx = px + ps / 2, pcy = py + ps / 2;
    for (let i = gems.length - 1; i >= 0; i--) {
      const g = gems[i];
      g.x -= worldSpeed * dt;
      g.bob += dt * 4;
      // Magnet: pull nearby gems toward the player.
      if (magnetTime > 0) {
        const dx = pcx - g.x, dy = pcy - g.y;
        const dist2 = dx * dx + dy * dy;
        if (dist2 < MAGNET_RANGE * MAGNET_RANGE) {
          const d = Math.sqrt(dist2) || 1;
          const pull = 520 * dt;
          g.x += (dx / d) * pull;
          g.y += (dy / d) * pull;
        }
      }
      if (g.x + g.r < -10) { gems.splice(i, 1); continue; }
      if (!g.got && hits(px, py, ps, ps, g.x - g.r, g.y - g.r, g.r * 2, g.r * 2)) {
        g.got = true;
        combo++;
        const m = Math.min(COMBO_MAX_MULT, 1 + Math.floor(combo / COMBO_STEP));
        coinCount += m;                 // each gem in a clean chain is worth `m`
        coinsEl.textContent = coinCount;
        if (m > comboMult) {            // crossed into a higher tier — celebrate
          comboMult = m;
          updateComboHud();
          showToast("COMBO ×" + m + "!");
          vibrate(30);
        }
        spawnGemBurst(g.x, g.y);
        audio.coin();
        gems.splice(i, 1);
      }
    }

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.vy += 400 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    // Twinkle + screen shake decay
    for (const s of stars) s.tw += dt * 2;
    if (shake > 0) shake = Math.max(0, shake - dt * 60);
  }

  function crash() {
    spawnCrash();
    audio.crash();
    shake = 16;
    gameOver();
  }

  // ---- Rendering ----
  function drawStaticBackdrop() {
    // Used on menu/over so the canvas isn't blank.
    ctx.clearRect(0, 0, W, H);
    if (!stars || !hills) buildBackground();
    drawSky();
    drawGround();
  }

  function drawSky() {
    if (!stars || !hills) buildBackground();
    // Themed gradient backdrop (drawn in-canvas so it can shift over time).
    const grad = ctx.createLinearGradient(0, 0, 0, groundY);
    grad.addColorStop(0, theme.top);
    grad.addColorStop(1, theme.bot);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, groundY);

    // Stars
    for (const s of stars) {
      const alpha = 0.4 + Math.sin(s.tw) * 0.35;
      ctx.globalAlpha = Math.max(0.05, alpha);
      ctx.fillStyle = "#cfe9ff";
      ctx.beginPath();
      ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Distant hills (parallax slow)
    const hillScroll = (bgScroll * 0.2) % (W * 1.4);
    ctx.fillStyle = theme.hill;
    ctx.globalAlpha = 0.5;
    for (const hl of hills) {
      let hx = hl.x * W - hillScroll;
      if (hx < -W * 0.4) hx += W * 1.4;
      const hw = hl.w * W;
      const hh = hl.h * H;
      ctx.beginPath();
      ctx.moveTo(hx, groundY);
      ctx.lineTo(hx + hw / 2, groundY - hh);
      ctx.lineTo(hx + hw, groundY);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawGround() {
    // Ground slab
    ctx.fillStyle = "#14142e";
    ctx.fillRect(0, groundY, W, H - groundY);
    // Neon ground line
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 3;
    ctx.shadowColor = theme.accent;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(W, groundY);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Scrolling grid lines for motion feel
    ctx.strokeStyle = theme.accent;
    ctx.globalAlpha = 0.18;
    ctx.lineWidth = 2;
    const spacing = 60;
    const off = bgScroll % spacing;
    for (let x = -off; x < W; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x, groundY);
      ctx.lineTo(x - 40, H);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawPlayer() {
    const skin = activeSkin();
    // Resolve skin colors (rainbow cycles its hue over time).
    let c0, c1, glow, trailCol;
    if (skin.rainbow) {
      const hue = (bgScroll * 0.4) % 360;
      c0 = `hsl(${hue}, 100%, 70%)`;
      c1 = `hsl(${(hue + 60) % 360}, 100%, 50%)`;
      glow = `hsl(${hue}, 100%, 60%)`;
      trailCol = c0;
    } else {
      c0 = skin.c0; c1 = skin.c1; glow = skin.c1; trailCol = skin.trail;
    }

    // Trail
    for (let i = player.trail.length - 1; i >= 0; i--) {
      const t = player.trail[i];
      const a = (1 - i / player.trail.length) * 0.25;
      ctx.globalAlpha = a;
      ctx.fillStyle = trailCol;
      ctx.fillRect(t.x, t.y, player.size, player.size);
    }
    ctx.globalAlpha = 1;

    const cx = player.x + player.size / 2;
    const cy = player.y + player.size / 2;

    // Power-up auras: one ring per active effect, stacked at different radii.
    const auras = [];
    if (shieldTime > 0) auras.push({ t: shieldTime, color: "#00ffb4", rad: 0.85 });
    if (magnetTime > 0) auras.push({ t: magnetTime, color: "#ffd84d", rad: 1.02 });
    if (slowTime > 0) auras.push({ t: slowTime, color: "#78b4ff", rad: 1.18 });
    for (const a of auras) {
      const flashing = !reduceMotion && a.t < 1.5 && Math.floor(a.t * 8) % 2 === 0;
      ctx.globalAlpha = flashing ? 0.3 : 0.7;
      ctx.strokeStyle = a.color;
      ctx.lineWidth = 3;
      ctx.shadowColor = a.color;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(cx, cy, player.size * a.rad, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    const s = player.size;

    // Running feet — two neon legs that pump in an alternating gait while the
    // runner is grounded, tuck up during a jump, and stride faster as the world
    // speeds up (phase tied to distance travelled). Drawn BEFORE the body so the
    // feet poke out the bottom. Frozen to a neutral stance under reduce-motion.
    {
      const bottomY = player.y + s;
      const hipY = bottomY - s * 0.06;
      const reach = s * 0.24;
      const animate = player.onGround && !reduceMotion;
      const retro = activeShoe().special;
      ctx.save();
      ctx.strokeStyle = c1;
      ctx.fillStyle = c1;
      ctx.lineCap = "round";
      ctx.lineWidth = Math.max(3, s * 0.09);
      ctx.shadowColor = glow;
      ctx.shadowBlur = 8;
      const phase = distance * 0.06;
      for (let i = 0; i < 2; i++) {
        const p = phase + i * Math.PI; // legs a half-cycle apart
        let swing, lift;
        if (animate) {
          swing = Math.sin(p);              // -1 back .. +1 forward
          lift = Math.max(0, Math.sin(p));  // foot rises as it swings forward
        } else if (player.onGround) {
          swing = i === 0 ? -0.35 : 0.35;   // static stance (reduce-motion)
          lift = 0;
        } else {
          swing = i === 0 ? -0.25 : -0.05;  // airborne: legs tucked back/up
          lift = 0.7;
        }
        const footX = cx + swing * reach;
        const footY = bottomY + s * 0.16 - lift * s * 0.20;
        // Leg (neon shin) from hip to foot.
        ctx.strokeStyle = c1;
        ctx.lineWidth = Math.max(3, s * 0.09);
        ctx.shadowColor = glow;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(cx, hipY);
        ctx.lineTo(footX, footY);
        ctx.stroke();
        if (retro) {
          drawRetroShoe(footX, footY, s);
        } else {
          ctx.fillStyle = c1;
          ctx.beginPath();
          ctx.arc(footX, footY, Math.max(2.5, s * 0.07), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(player.rot);
    ctx.shadowColor = glow;
    ctx.shadowBlur = 18;
    // Body
    const grad = ctx.createLinearGradient(-s / 2, -s / 2, s / 2, s / 2);
    grad.addColorStop(0, c0);
    grad.addColorStop(1, c1);
    ctx.fillStyle = grad;
    roundRect(ctx, -s / 2, -s / 2, s, s, 8);
    ctx.fill();
    ctx.shadowBlur = 0;
    // Eye
    ctx.fillStyle = "#0d0d1a";
    ctx.fillRect(s * 0.08, -s * 0.18, s * 0.22, s * 0.22);
    ctx.restore();
  }

  // A chunky retro sneaker drawn at a foot position (toe points forward, +x):
  // white sole, colored upper, gold side-stripe. Self-contained save/restore so
  // it never leaks state into the neon-leg strokes.
  function drawRetroShoe(x, y, s) {
    const w = s * 0.42, h = s * 0.24;
    ctx.save();
    ctx.shadowBlur = 5;
    // White sole, rounded, extending forward to a toe.
    ctx.shadowColor = "#ffffff";
    ctx.fillStyle = RETRO.sole;
    roundRect(ctx, x - w * 0.45, y + h * 0.30, w, h * 0.40, h * 0.2);
    ctx.fill();
    // Colored upper (heel + instep) sitting on the sole.
    ctx.shadowColor = RETRO.upper;
    ctx.fillStyle = RETRO.upper;
    roundRect(ctx, x - w * 0.45, y - h * 0.12, w * 0.70, h * 0.50, 3);
    ctx.fill();
    // Gold side stripe.
    ctx.shadowBlur = 0;
    ctx.strokeStyle = RETRO.stripe;
    ctx.lineWidth = Math.max(2, s * 0.05);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x - w * 0.30, y + h * 0.26);
    ctx.lineTo(x + w * 0.03, y - h * 0.02);
    ctx.stroke();
    ctx.restore();
  }

  function drawObstacles() {
    for (const o of obstacles) {
      if (o.type === "spikes") {
        ctx.fillStyle = "#ff4d6d";
        ctx.shadowColor = "#ff4d6d";
        ctx.shadowBlur = 12;
        for (let i = 0; i < o.count; i++) {
          const sx = o.x + i * o.spikeW;
          ctx.beginPath();
          ctx.moveTo(sx, groundY);
          ctx.lineTo(sx + o.spikeW / 2, groundY - o.h);
          ctx.lineTo(sx + o.spikeW, groundY);
          ctx.closePath();
          ctx.fill();
        }
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = "#ff5ec7";
        ctx.shadowColor = "#ff5ec7";
        ctx.shadowBlur = 14;
        roundRect(ctx, o.x, o.y, o.w, o.h, 5);
        ctx.fill();
        // little support pole
        ctx.fillRect(o.x + o.w / 2 - 2, o.y + o.h, 4, groundY - (o.y + o.h));
        ctx.shadowBlur = 0;
      }
    }
  }

  function drawGems() {
    for (const g of gems) {
      const yy = g.y + Math.sin(g.bob) * 4;
      ctx.save();
      ctx.translate(g.x, yy);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = "#ffd84d";
      ctx.shadowColor = "#ffd84d";
      ctx.shadowBlur = 16;
      const r = g.r;
      ctx.fillRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4);
      ctx.restore();
    }
    ctx.shadowBlur = 0;
  }

  const POWER_HEX = { shield: "#00ffb4", magnet: "#ffd84d", slowmo: "#78b4ff" };
  function drawPowerups() {
    for (const pu of powerups) {
      const yy = pu.y + Math.sin(pu.bob) * 5;
      const col = POWER_HEX[pu.type] || "#00ffb4";
      const r = pu.r;
      ctx.save();
      ctx.translate(pu.x, yy);
      ctx.shadowColor = col;
      ctx.shadowBlur = 18;
      // Outer ring
      ctx.strokeStyle = col;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.rotate(pu.spin);
      ctx.fillStyle = col;
      ctx.strokeStyle = col;

      if (pu.type === "shield") {
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.55);
        ctx.lineTo(r * 0.5, -r * 0.15);
        ctx.lineTo(r * 0.5, r * 0.25);
        ctx.lineTo(0, r * 0.6);
        ctx.lineTo(-r * 0.5, r * 0.25);
        ctx.lineTo(-r * 0.5, -r * 0.15);
        ctx.closePath();
        ctx.fill();
      } else if (pu.type === "magnet") {
        // Horseshoe magnet: a thick C with two prongs.
        ctx.lineWidth = r * 0.32;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.45, Math.PI * 0.85, Math.PI * 0.15, false);
        ctx.stroke();
        ctx.fillRect(r * 0.3, -r * 0.05, r * 0.28, r * 0.5);
        ctx.fillRect(-r * 0.58, -r * 0.05, r * 0.28, r * 0.5);
      } else { // slowmo — a clock
        ctx.lineWidth = r * 0.12;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -r * 0.4);
        ctx.moveTo(0, 0);
        ctx.lineTo(r * 0.3, 0);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.shadowBlur = 0;
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = `rgba(${p.color}, 1)`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (shake > 0 && !reduceMotion) {
      ctx.translate((rnd() - 0.5) * shake, (rnd() - 0.5) * shake);
    }
    drawSky();
    drawGround();
    drawObstacles();
    drawGems();
    drawPowerups();
    if (state === STATE.PLAYING) drawPlayer();
    drawParticles();
    ctx.restore();

    // Full-screen tints for time-based power-ups (drawn unshaken).
    if (slowTime > 0) {
      ctx.globalAlpha = 0.12 * Math.min(1, slowTime);
      ctx.fillStyle = "#78b4ff";
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    if (magnetTime > 0) {
      ctx.globalAlpha = 0.08 * Math.min(1, magnetTime);
      ctx.fillStyle = "#ffd84d";
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }

  // ---- Main loop ----
  function loop(now) {
    let dt = (now - lastTime) / 1000;
    lastTime = now;
    if (dt > 0.05) dt = 0.05; // clamp after tab-switch / hiccups

    if (state === STATE.PLAYING) {
      if (paused) return; // frozen until resume re-arms the loop
      update(dt);
      render();
      rafId = requestAnimationFrame(loop);
    } else if (state === STATE.OVER) {
      // Keep particles/shake animating briefly on the game-over backdrop.
      update0Effects(dt);
      render();
      if (particles.length > 0 || shake > 0) rafId = requestAnimationFrame(loop);
    }
  }

  // Lightweight effects-only step for the game-over freeze.
  function update0Effects(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.vy += 400 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (const s of stars) s.tw += dt * 2;
    if (shake > 0) shake = Math.max(0, shake - dt * 60);
  }

  // ---- Theme interpolation ----
  const lerpColor = NeonEngine.lerpColor;
  // Smoothly cycle themes; one full theme roughly every 250 score.
  function currentTheme() {
    const n = THEMES.length;
    // Guard against a non-finite score producing an out-of-range index.
    const prog = (Number.isFinite(score) ? score : 0) / 250;
    let i = Math.floor(prog) % n;
    if (i < 0) i += n;
    const j = (i + 1) % n;
    const t = prog - Math.floor(prog);
    const a = THEMES[i], b = THEMES[j];
    return {
      top: lerpColor(a.top, b.top, t),
      bot: lerpColor(a.bot, b.bot, t),
      accent: lerpColor(a.accent, b.accent, t),
      hill: lerpColor(a.hill, b.hill, t),
    };
  }
  let theme = THEMES[0];

  // ---- Helpers ----
  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  // Gentle idle animation on the menu backdrop.
  function startIdle() {
    (function idle() {
      if (state === STATE.MENU) {
        bgScroll += 0.5;
        for (const s of stars) s.tw += 0.02;
        drawStaticBackdrop();
        requestAnimationFrame(idle);
      }
    })();
  }

  // ---- Shop / skins UI ----
  function skinSwatchStyle(s) {
    if (s.rainbow) {
      return "background: linear-gradient(135deg, #ff5ec7, #ffd84d, #00ffb4, #00f5ff);";
    }
    return `background: linear-gradient(135deg, ${s.c0}, ${s.c1});`;
  }

  function renderShop() {
    bankEl.textContent = bank;
    skinRow.innerHTML = "";
    for (const s of SKINS) {
      const isOwned = owned.has(s.id);
      const isSel = s.id === selectedSkin;
      const chip = document.createElement("button");
      chip.className = "skin-chip" + (isSel ? " selected" : "") + (isOwned ? "" : " locked");
      chip.type = "button";
      chip.setAttribute("aria-label",
        s.name + " skin" + (isOwned ? (isSel ? ", active" : ", owned") : ", costs " + s.cost + " gems"));

      const sw = document.createElement("div");
      sw.className = "swatch";
      sw.setAttribute("style", skinSwatchStyle(s));

      const price = document.createElement("span");
      price.className = "skin-price";
      if (isOwned) { price.textContent = isSel ? "ACTIVE" : "OWNED"; price.classList.add("owned"); }
      else if (bank >= s.cost) { price.textContent = "◆ " + s.cost; price.classList.add("afford"); }
      else { price.textContent = "◆ " + s.cost; price.classList.add("cant"); }

      chip.appendChild(sw);
      chip.appendChild(price);
      chip.addEventListener("click", (e) => { e.stopPropagation(); onSkinClick(s); });
      skinRow.appendChild(chip);
    }
    renderShoes();
    renderGemPacks();
  }

  // Shoe cosmetics row. Owned shoes select on tap; the locked Retro tier shows
  // how to earn it — instantly via a rewarded video, or it auto-unlocks once a
  // performance / level milestone is hit (with a progress hint underneath).
  function renderShoes() {
    if (!shoeRow) return;
    shoeRow.innerHTML = "";
    for (const sh of SHOES) {
      const isOwned = ownedShoes.has(sh.id);
      const isSel = sh.id === selectedShoe;
      const chip = document.createElement("button");
      chip.className = "skin-chip" + (isSel ? " selected" : "") + (isOwned ? "" : " locked");
      chip.type = "button";
      chip.setAttribute("aria-label", sh.name + " shoes" +
        (isOwned ? (isSel ? ", active" : ", owned")
                 : ", watch a video to unlock, or reach " + RETRO_SCORE_UNLOCK +
                   " score or level " + RETRO_LEVEL_UNLOCK));

      const sw = document.createElement("div");
      sw.className = "swatch";
      sw.setAttribute("style", sh.special
        ? "background: linear-gradient(135deg, " + RETRO.upper + ", " + RETRO.sole + " 55%, " + RETRO.stripe + ");"
        : "background: linear-gradient(135deg, #7afcff, #0091ff);");

      const label = document.createElement("span");
      label.className = "skin-price";
      if (isOwned) {
        label.textContent = isSel ? "ACTIVE" : "OWNED";
        label.classList.add("owned");
      } else if (retroEarnedByPlay()) {
        label.textContent = "CLAIM";      // already earned by play — free claim
        label.classList.add("afford");
      } else {
        label.textContent = "🎬 WATCH";   // rewarded-video path
        label.classList.add("afford");
      }

      chip.appendChild(sw);
      chip.appendChild(label);
      chip.addEventListener("click", (e) => { e.stopPropagation(); onShoeClick(sh); });
      shoeRow.appendChild(chip);
    }

    // Progress hint for a still-locked Retro tier.
    if (!ownedShoes.has("retro")) {
      const hint = document.createElement("div");
      hint.className = "shoe-hint";
      hint.textContent = "👟 Retro Kicks — watch a video, score " +
        RETRO_SCORE_UNLOCK + " (best " + best + "), or hit level " +
        RETRO_LEVEL_UNLOCK + " (now " + playerLevel() + ")";
      shoeRow.appendChild(hint);
    }
  }

  function onShoeClick(sh) {
    // Owned: just equip it.
    if (ownedShoes.has(sh.id)) {
      selectedShoe = sh.id;
      audio.coin();
      track("shoe_selected", { shoe_id: sh.id });
      persistProgress();
      renderShoes();
      return;
    }
    // Already earned by play → free claim, no ad.
    if (retroEarnedByPlay()) {
      unlockShoe(sh.id, best >= RETRO_SCORE_UNLOCK ? "performance" : "level");
      selectedShoe = sh.id;
      audio.power();
      vibrate(30);
      showToast("👟 " + sh.name + " unlocked!");
      persistProgress();
      renderShoes();
      return;
    }
    // Otherwise: watch a rewarded video. (Stub auto-grants on web; real ad on
    // native/portal.) Unlock + equip only if the video actually completed.
    audio.coin();
    ads.rewarded("retro_shoes").then((ok) => {
      if (ok) {
        unlockShoe(sh.id, "ad");
        selectedShoe = sh.id;
        audio.power();
        vibrate(30);
        showToast("👟 " + sh.name + " unlocked!");
        track("reward_granted", { type: "retro_shoes" });
      } else {
        audio.shieldBreak();
        showToast("Video didn't finish — try again");
      }
      persistProgress();
      renderShoes();
    });
  }

  // Render buyable gem packs (native IAP). Stays hidden on web / until the store
  // returns products, so the section is invisible in the browser build + CI.
  function renderGemPacks() {
    if (!gemShopEl || !gemPackRow) return;
    const packs = iap.available ? iap.packs() : [];
    if (!packs.length) { gemShopEl.classList.add("hidden"); return; }
    gemShopEl.classList.remove("hidden");
    gemPackRow.innerHTML = "";
    for (const p of packs) {
      const chip = document.createElement("button");
      chip.className = "gem-pack";
      chip.type = "button";
      chip.setAttribute("aria-label", p.title + ", " + p.gems + " gems, " + (p.priceString || "buy"));
      if (p.badge) {
        const badge = document.createElement("span");
        badge.className = "gem-badge";
        badge.textContent = p.badge;
        chip.appendChild(badge);
      }
      const amt = document.createElement("span");
      amt.className = "gem-amt";
      amt.textContent = "◆ " + p.gems;
      const price = document.createElement("span");
      price.className = "gem-price";
      price.textContent = p.priceString || "BUY";
      chip.appendChild(amt);
      chip.appendChild(price);
      chip.addEventListener("click", (e) => { e.stopPropagation(); onGemPackClick(p, chip); });
      gemPackRow.appendChild(chip);
    }
  }

  // Buy a gem pack; on a completed purchase, credit the wallet and persist.
  function onGemPackClick(p, chip) {
    if (chip.disabled) return;
    chip.disabled = true;
    track("gem_pack_buy_start", { pack_id: p.id, gems: p.gems });
    iap.buy(p.id).then((res) => {
      chip.disabled = false;
      if (res && res.ok) {
        bank += res.gems || p.gems;
        persistProgress();
        audio.power();
        vibrate(30);
        showToast("✓ Purchase complete\n+" + (res.gems || p.gems) + " ◆");
        track("gem_pack_purchased", { pack_id: p.id, gems: res.gems || p.gems, bank_after: bank });
        renderShop();
      } else if (res && res.cancelled) {
        track("gem_pack_cancelled", { pack_id: p.id });
      } else {
        audio.shieldBreak();
        showToast("Purchase didn't complete");
        track("gem_pack_failed", { pack_id: p.id });
      }
    });
  }

  function onSkinClick(s) {
    if (owned.has(s.id)) {
      selectedSkin = s.id;
      audio.coin();
      track("skin_selected", { skin_id: s.id });
    } else if (bank >= s.cost) {
      bank -= s.cost;
      owned.add(s.id);
      selectedSkin = s.id;
      audio.power();
      vibrate(30);
      track("skin_purchased", { skin_id: s.id, cost: s.cost, bank_after: bank });
    } else {
      // Can't afford: gentle nudge.
      audio.shieldBreak();
      return;
    }
    persistProgress();
    renderShop();
  }

  // ---- QR code: encodes the live URL so a phone can scan to play ----
  // The encoder (~60KB) is lazy-loaded off the critical path so it doesn't
  // block first paint / interactivity; same-origin src, so CSP-safe, and the
  // service worker already caches qrcode.js for offline use.
  let qrLibPromise = null;
  function loadQrLib() {
    if (window.qrcode) return Promise.resolve(window.qrcode);
    if (!qrLibPromise) {
      qrLibPromise = new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "qrcode.js";
        s.async = true;
        s.onload = () => resolve(window.qrcode);
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }
    return qrLibPromise;
  }
  function renderQR() {
    if (!qrEl) return;
    loadQrLib().then((qrcode) => {
      try {
        const qr = qrcode(0, "M"); // type 0 = auto-fit, error-correction M
        qr.addData(location.href);
        qr.make();
        qrEl.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
      } catch (e) {
        if (qrEl.parentElement) qrEl.parentElement.classList.add("hidden");
      }
    }).catch(() => {
      if (qrEl.parentElement) qrEl.parentElement.classList.add("hidden");
    });
  }

  function showMenu() {
    startScreen.classList.remove("hidden");
    startBestEl.textContent = best;
    dailyCheckin();
    renderShop();
    renderProgress();
    drawStaticBackdrop();
    startIdle();
  }

  // ---- Boot ----
  function init() {
    buildBackground();
    resize();
    best = loadBest();
    startBestEl.textContent = best;
    bestEl.textContent = best;
    updateMuteUI();
    dailyCheckin();
    renderShop();
    renderProgress();
    drawStaticBackdrop();
    startIdle();
    // QR is non-essential chrome: build it when the main thread is idle so it
    // never competes with first paint / interactivity.
    (window.requestIdleCallback || ((fn) => setTimeout(fn, 200)))(renderQR);
  }

  // ---- Test hooks (H4): only exposed with ?test=1, for E2E automation ----
  if (/[?&]test=1/.test(location.search)) {
    window.NeonDashTest = {
      seed(n) { rng = NeonEngine.mulberry32(n >>> 0); },
      start() { startGame(); },
      jump() { jump(); },
      pause() { if (!paused) togglePause(); },
      resume() { if (paused) togglePause(); },
      clearObstacles() { obstacles.length = 0; },
      // Advance the simulation deterministically, independent of rAF /
      // page visibility (which are throttled for backgrounded test pages).
      step(n, dt) {
        const frames = n || 1;
        const d = dt || 1 / 60;
        for (let i = 0; i < frames && state === STATE.PLAYING; i++) update(d);
      },
      spawnSpikeAhead() {
        obstacles.push({ type: "spikes", x: player.x, w: 60, h: 34, count: 2, spikeW: 26 });
      },
      addGemAhead() {
        gems.push({ x: player.x + player.size / 2, y: player.y + player.size / 2, r: 11, got: false, bob: 0 });
      },
      giveShield(secs) { shieldTime = secs == null ? SHIELD_DURATION : secs; },
      setReduceMotion(v) { reduceMotion = !!v; },
      buySkin(id) { const s = SKINS.find((x) => x.id === id); if (s) onSkinClick(s); },
      doubleGems() { return claimDoubleGems(); },
      revive() { return claimRevive(); },
      progressSummary() { return progress.summary(); },
      getState() {
        return {
          state, paused, score, coins: coinCount, bank, best,
          speed, shieldTime, magnetTime, slowTime, reduceMotion,
          gemMultiplier, combo, comboMult, reviveUsed, doubleClaimed,
          obstacles: obstacles ? obstacles.length : 0,
          gems: gems ? gems.length : 0,
          powerups: powerups ? powerups.length : 0,
          player: player ? { x: player.x, y: player.y, vy: player.vy, onGround: player.onGround, jumps: player.jumps, size: player.size } : null,
          groundY,
        };
      },
    };
  }

  init();
})();
