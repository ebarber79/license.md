/* =========================================================================
 * NEON DASH — an HTML5 Canvas endless runner
 * Tap / click / space to jump. Up to two more taps in mid-air = triple jump.
 * Dodge spikes, collect gems, survive as long as you can.
 * ========================================================================= */

(() => {
  "use strict";

  // All saves go through NeonStore (store.js): localStorage by default, the
  // CrazyGames SDK data module in that portal build.
  const NeonStore = window.NeonStore || {
    getItem: (k) => localStorage.getItem(k),
    setItem: (k, v) => localStorage.setItem(k, v),
    removeItem: (k) => localStorage.removeItem(k),
  };

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
  const tutorialBanner = document.getElementById("tutorial-banner");
  const tutorialText = document.getElementById("tutorial-text");
  const tutorialSkipBtn = document.getElementById("tutorial-skip");
  const howtoBtn = document.getElementById("howto-btn");
  const rateLink = document.getElementById("rate-link");
  const shareBtn = document.getElementById("share-btn");
  const exitConfirm = document.getElementById("exit-confirm");
  const exitStayBtn = document.getElementById("exit-stay-btn");
  const exitLeaveBtn = document.getElementById("exit-leave-btn");
  const NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  function nativePlugin(name) {
    const cap = window.Capacitor;
    return NATIVE && cap.Plugins ? cap.Plugins[name] : null;
  }

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
  // ND-022: reward buttons ("watch ad") only appear when a real ad network is
  // connected (AdMob in the app, CrazyGames on the portal). The plain web build
  // has none, and its stub would hand out rewards for free. Test mode keeps
  // them so the reward flows stay testable.
  const TEST_MODE = /[?&]test=1/.test(location.search);
  function rewardAdsOn() {
    if (TEST_MODE) return true;
    return !!ads.available && !ads.adsBlocked;
  }
  // Ad flow (CrazyGames ad requirements, also fine for the app):
  //  - the screen is blocked (#ad-wait) from the request until the ad finishes
  //    or fails, so the player can't progress meanwhile;
  //  - audio is held when the ad actually starts (providers that report
  //    adStarted), otherwise from the request (ND-025);
  //  - no midgame break right after any rewarded ad (no chained ads);
  //  - an unavailable ad says "try again later"; an ad blocker shows a notice.
  const adWaitEl = document.getElementById("ad-wait");
  let skipNextBreak = false;
  function adBegin() {
    if (adWaitEl) adWaitEl.classList.remove("hidden");
    const early = !ads.signalsAdStart;
    if (early) music.hold(true);
    return { onStart() { if (!early) music.hold(true); } };
  }
  function adEnd() {
    music.hold(false);
    if (adWaitEl) adWaitEl.classList.add("hidden");
  }
  function adUnavailableNote() {
    const code = ads.lastAdError;
    if (ads.adsBlocked || code === "adblock") return "Ad blocker on: video rewards are off";
    if (code === "adsDisabled" || code === "adsDisabledBasicLaunch") return "";
    return "No video available right now. Try again later";
  }
  function adRewarded(name) {
    const hooks = adBegin();
    skipNextBreak = true;
    return ads.rewarded(name, hooks).then((ok) => {
      adEnd();
      if (!ok && !TEST_MODE) {
        const note = adUnavailableNote();
        if (note) showToast(note);
        renderAdSurfaces();
      }
      return ok;
    }, (e) => { adEnd(); throw e; });
  }
  function adBreak() {
    const hooks = adBegin();
    return Promise.resolve(ads.commercialBreak(hooks)).then(adEnd, adEnd);
  }
  function renderAdSurfaces() {
    renderShoes();
    renderBoost();
    if (state === STATE.OVER) renderRewardButtons();
  }
  Promise.resolve(ads.init()).then(() => {
    renderShoes(); // ND-022: the Retro "WATCH" option depends on ads being ready
    renderBoost(); // ND-023: same for the Boost ad button
  });

  // "Send feedback" (ND-036): opens the player's email app with the version
  // filled in. Nothing is sent unless the player sends the email themselves.
  const feedbackLink = document.getElementById("feedback-link");
  if (feedbackLink) {
    const na = window.NeonAnalytics || {};
    const where = na.platform === "android" ? "Android app" : "web";
    const ver = na.platform === "android" && na.build ? na.build : "web";
    const body = "What happened, or what would you like to see?\n\n\n\n---\n" +
      "Neon Dash " + ver + " (" + where + ")";
    feedbackLink.href = "mailto:neondash@gridlas.com?subject=" +
      encodeURIComponent("Neon Dash feedback (" + ver + ")") + "&body=" + encodeURIComponent(body);
    feedbackLink.addEventListener("click", (e) => e.stopPropagation());
  }

  // ND-037: Rate (Android: opens the Play Store page) and Share.
  const PLAY_URL = "https://play.google.com/store/apps/details?id=io.github.ebarber79.neondash";
  const WEB_URL = "https://neondash.gridlas.com/";
  if (rateLink) {
    rateLink.classList.toggle("hidden", !NATIVE);
    rateLink.addEventListener("click", (e) => { e.stopPropagation(); track("rate_tap"); });
  }
  if (shareBtn) shareBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    shareGame();
  });
  function shareGame() {
    const url = NATIVE ? PLAY_URL : WEB_URL;
    const text = "I'm playing Neon Dash, a neon endless runner. Beat my best: " + best + "!";
    track("share_tap");
    const Share = nativePlugin("Share");
    if (Share && Share.share) {
      return Promise.resolve(Share.share({ title: "Neon Dash", text, url, dialogTitle: "Share Neon Dash" }))
        .catch(() => {});
    }
    if (navigator.share) {
      return navigator.share({ title: "Neon Dash", text, url }).catch(() => {});
    }
    const done = () => showToast("Link copied");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text + " " + url).then(done, () => showToast(url));
    }
    showToast(url);
    return Promise.resolve();
  }

  // ND-037: ask for a Play review after the 5th and 25th finished run.
  // Google decides whether the sheet actually shows (and caps it); it's dismissable.
  const RUNS_KEY = "neondash.runs";
  function noteFinishedRun() {
    const n = (parseInt(safeGet(RUNS_KEY), 10) || 0) + 1;
    safeSet(RUNS_KEY, String(n));
    if (n !== 5 && n !== 25) return;
    const Review = nativePlugin("InAppReview");
    if (!Review || !Review.requestReview) return;
    setTimeout(() => {
      track("review_prompt", { runs: n });
      Promise.resolve(Review.requestReview()).catch(() => {});
    }, 1200);
  }

  // ND-037: exit confirmation for Android Back on the start screen.
  function exitOpen() { return !!exitConfirm && !exitConfirm.classList.contains("hidden"); }
  function showExit() { exitConfirm.classList.remove("hidden"); exitStayBtn.focus(); }
  function hideExit() { exitConfirm.classList.add("hidden"); }
  // Step B: menu tabs (Missions / Skins / Boosts) open a sheet over the one-screen menu.
  const tabSheet = document.getElementById("tab-sheet");
  const tabTitle = document.getElementById("tab-sheet-title");
  const TAB_NAMES = { missions: "Missions", skins: "Skins", boosts: "Boosts" };
  let openTabId = null;
  function tabOpen() { return !!tabSheet && !tabSheet.classList.contains("hidden"); }
  function openTab(id) {
    if (!tabSheet || !TAB_NAMES[id]) return;
    openTabId = id;
    tabTitle.textContent = TAB_NAMES[id];
    for (const k of Object.keys(TAB_NAMES)) {
      const pane = document.getElementById("tab-" + k);
      const btn = document.getElementById("tab-btn-" + k);
      if (pane) pane.classList.toggle("hidden", k !== id);
      if (btn) { btn.setAttribute("aria-selected", k === id ? "true" : "false"); btn.classList.toggle("active", k === id); }
    }
    tabSheet.querySelectorAll(".sheet-tab").forEach((c) => c.classList.toggle("active", c.getAttribute("data-tab") === id));
    tabSheet.classList.remove("hidden");
    if (startScreen) startScreen.classList.add("sheet-open");
    track("menu_tab", { tab: id });
  }
  function closeTab() {
    if (!tabSheet) return;
    tabSheet.classList.add("hidden");
    if (startScreen) startScreen.classList.remove("sheet-open");
    openTabId = null;
    for (const k of Object.keys(TAB_NAMES)) {
      const btn = document.getElementById("tab-btn-" + k);
      if (btn) { btn.setAttribute("aria-selected", "false"); btn.classList.remove("active"); }
    }
  }
  document.querySelectorAll(".sheet-tab").forEach((c) => c.addEventListener("click", (e) => {
    e.stopPropagation(); openTab(c.getAttribute("data-tab"));
  }));
  document.querySelectorAll(".tab-btn").forEach((b) => b.addEventListener("click", (e) => {
    e.stopPropagation();
    const id = b.getAttribute("data-tab");
    if (openTabId === id) closeTab(); else openTab(id);
  }));
  { const c = document.getElementById("tab-close"); if (c) c.addEventListener("click", (e) => { e.stopPropagation(); closeTab(); }); }
  if (exitStayBtn) exitStayBtn.addEventListener("click", (e) => { e.stopPropagation(); hideExit(); });
  if (exitLeaveBtn) exitLeaveBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const App = nativePlugin("App");
    if (App && App.exitApp) App.exitApp();
    else hideExit();
  });

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
    try { NeonStore.setItem(key, value); } catch (e) { /* storage may be unavailable (ND-DATA-05) */ }
  }
  function safeGet(key) {
    // localStorage access can throw in private mode / when storage is blocked.
    try { return NeonStore.getItem(key); } catch (e) { return null; }
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
  // When the run clock stopped (pause or game over). Paused and revive-ad time
  // is added back to runStart so duration_ms counts only time spent playing.
  let stoppedAt = 0;
  let lastCrashCause = "unknown";

  // ---- Audio (synthesized, no asset files) ----
  // ---- Music (ND-025): reactive synthwave, generated in music.js ----
  const musicBtn = document.getElementById("music-btn");
  const music = window.NeonMusic
    ? window.NeonMusic.create({ on: safeGet("neondash.music") !== "0" })
    : { attach() {}, setOn() {}, setMode() {}, setIntensity() {}, hold() {}, forceMute() {},
        getState() { return { on: false, mode: "off", bpm: 0, layers: [] }; } };

  const audio = {
    ctx: null,
    muted: safeGet("neondash.muted") === "1",
    portalMuted: false, // CrazyGames muteAudio: overrides the in-game toggles
    ensure() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) this.ctx = new AC();
      }
      if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
      if (this.ctx) music.attach(this.ctx); // ND-025: music starts after the first tap
    },
    tone(freq, dur, type = "square", vol = 0.15, slideTo = null) {
      if (this.muted || this.portalMuted || !this.ctx) return;
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
    const pm = audio.portalMuted;
    muteBtn.textContent = (audio.muted || pm) ? "🔇" : "🔊";
    muteBtn.classList.toggle("off", pm);
    muteBtn.title = pm ? "Sound is muted by the site" : "";
    if (musicBtn) {
      const st = music.getState();
      musicBtn.classList.toggle("off", !st.on || pm);
      musicBtn.title = pm ? "Sound is muted by the site" : "";
      musicBtn.setAttribute("aria-pressed", st.on ? "true" : "false");
      musicBtn.setAttribute("aria-label", st.on ? "Music on (tap to turn off)" : "Music off (tap to turn on)");
    }
  }
  // ND-025: 🎵 = music, 🔊 = sound effects. Separate settings.
  musicBtn && musicBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const nowOn = !music.getState().on;
    music.setOn(nowOn);
    safeSet("neondash.music", nowOn ? "1" : "0");
    audio.ensure();
    updateMuteUI();
  });
  muteBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    audio.muted = !audio.muted;
    safeSet("neondash.muted", audio.muted ? "1" : "0");
    updateMuteUI();
  });
  // Full Launch: the portal's mute (CrazyGames muteAudio) silences music and
  // effects and wins over the buttons; the player's own choices are kept and
  // apply again once the portal unmutes.
  if (ads && typeof ads.onMuteChange === "function") {
    ads.onMuteChange((m) => {
      audio.portalMuted = m;
      music.forceMute(m);
      updateMuteUI();
    });
  }

  // ---- World constants (in CSS pixels) ----
  const GROUND_RATIO = 0.82;   // ground line as fraction of height
  // Gravity and jump strengths live in patterns.js (NeonPatterns), shared with
  // the solver test that proves every obstacle pattern can be cleared.
  const NP = window.NeonPatterns;
  const PLAYER_X_RATIO = 0.22; // player horizontal position
  const PLAYER_SIZE = 46;
  const START_SPEED = 420;     // px/s
  const MAX_SPEED = 1100;
  const SPEED_RAMP = 16;       // px/s gained per second
  const SHIELD_DURATION = 7;   // seconds of protection per shield pickup
  const MAGNET_DURATION = 6;   // seconds gems are pulled toward the player
  const SLOWMO_DURATION = 5;   // seconds of slow-motion
  // ND-023: Boost = start the next run with a power-up (watch an ad, or pay gems).
  const BOOST_GEM_COST = 40;
  const BOOST_KEY = "neondash.boost";
  const BOOST_TYPES = [
    { id: "shield", name: "Shield",  icon: "🛡" },
    { id: "magnet", name: "Magnet",  icon: "🧲" },
    { id: "slowmo", name: "Slow-mo", icon: "⏱" },
  ];
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
    // Step B: each theme also recolours the hazards (haz = spikes/ceiling/wall,
    // haz2 = bars, solid = pillars, saw) and the far city. Jump pads stay green
    // in every theme so "safe" always reads the same.
    { top: "#1a1a3e", bot: "#3d1f5e", accent: "#00f5ff", hill: "#502878", haz: "#ff4d6d", haz2: "#ff5ec7", solid: "#b26bff", saw: "#ff8a3d", city: "#221643" }, // twilight
    { top: "#2e1a3e", bot: "#5e1f3d", accent: "#ff5ec7", hill: "#78284f", haz: "#ff3d4d", haz2: "#ffb347", solid: "#8f7bff", saw: "#ff6a3d", city: "#2a1230" }, // dusk
    { top: "#0d2340", bot: "#1f4e5e", accent: "#00ffb4", hill: "#1f5e55", haz: "#ff5a7a", haz2: "#ff9ae0", solid: "#4dc3ff", saw: "#ff7a45", city: "#0c2233" }, // deep sea
    { top: "#3e2a1a", bot: "#5e3a1f", accent: "#ffb347", hill: "#785028", haz: "#ff3d6e", haz2: "#d07bff", solid: "#ffe07a", saw: "#ff5ec7", city: "#2a1a10" }, // sunset
    { top: "#0d0d1a", bot: "#1a1a3e", accent: "#9d6cff", hill: "#3a2878", haz: "#ff4d8d", haz2: "#00e5ff", solid: "#ff8af0", saw: "#ff9a3d", city: "#120f2a" }, // midnight
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
  // ND-021: power-up shoes. Visual only; sparks use Math.random so the seeded
  // gameplay RNG (obstacle/gem spawns) is unaffected.
  let shoeClock = 0;     // seconds of play, drives pulses/shimmer/blinks
  let shoeFlash = 0;     // seconds of white pickup flash left
  let shoeSparkAcc = 0;  // px run since the last footfall spark
  // ND-023 Boost state. boostArmed is saved so a paid boost survives an app close.
  let boostArmed = null;      // "shield" | "magnet" | "slowmo" | null
  let boostPick = "shield";   // highlighted choice before paying
  let boostBusy = false;      // an ad is in flight
  let boostAdWatched = false; // skip the next replay interstitial after a boost ad
  let gemMultiplier = 1; // 2 after a rewarded "double gems"
  let combo = 0;         // consecutive gems collected without an obstacle hit
  let comboMult = 1;     // gem-value multiplier derived from the current combo
  let reviveUsed = false; // a run gets at most one rewarded revive
  let tutorialRun = false;
  let doubleClaimed = false; // double-gems claimed this run (persists across Revive)
  let best = loadBest();
  let lastTime = 0;
  let shake = 0;
  let nearMissRun = 0; // Step B: near misses this run (analytics)
  let floaters = [];   // Step B: floating "NEAR MISS" text
  let hitstop = 0;     // Step B: freeze frame on death (seconds)
  let flash = 0;       // Step B: white flash on death / near-miss tint
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
      NeonStore.setItem(BANK_KEY, String(bank));
      NeonStore.setItem(OWNED_KEY, JSON.stringify([...owned]));
      NeonStore.setItem(SKIN_KEY, selectedSkin);
      NeonStore.setItem(SHOES_OWNED_KEY, JSON.stringify([...ownedShoes]));
      NeonStore.setItem(SHOE_KEY, selectedShoe);
      NeonStore.setItem(LIFETIME_KEY, String(lifetimeGems));
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
    // Step B: far city skyline (slowest parallax layer), with lit windows.
    city = [];
    x = 0;
    while (x < 1.5) {
      const w = 0.035 + rnd() * 0.05;
      city.push({ x, w, h: 0.10 + rnd() * 0.22, seed: Math.floor(rnd() * 1e6), spire: rnd() < 0.18 });
      x += w + rnd() * 0.012;
    }
  }
  let city = null;

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
      coyote: 0,
      rot: 0,
      sx: 1, sy: 1, // Step B: squash & stretch
      trail: [],
    };
    floaters = [];
    nearMissRun = 0;
    hitstop = 0;
    flash = 0;
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
    lastChunkId = null;
    breatherIn = NP.nextBreatherIn(rnd);
    gemTimer = 1.4;
    powerTimer = 7 + rnd() * 4;
    shieldTime = 0;
    magnetTime = 0;
    slowTime = 0;
    shoeFlash = 0;
    shoeSparkAcc = 0;
    shake = 0;
    bgScroll = 0;
  }

  // ---- Input ----
  function jump() {
    if (state !== STATE.PLAYING || paused) return;
    if (tutorialHold) tutorialHold = false; // ND-037: the tap that unfreezes is the jump
    // Ground (or coyote) jump, then 2nd and 3rd mid-air jumps at 86% / 72%.
    const j = NP.tryJump(player);
    if (j >= 1) stretchPlayer();
    if (j === 1) {
      if (tutorial === "jump") tutorialNext("spike", "Nice! Now watch for spikes...");
      spawnJumpDust();
      audio.jump();
    } else if (j > 1) {
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
  if (howtoBtn) howtoBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    forceTutorial = true;
    startGame();
  });
  if (tutorialSkipBtn) tutorialSkipBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    tutorialEnd(true);
  });
  // Portal interstitial at a natural break — every 3rd replay, not every run.
  restartBtn.addEventListener("click", () => {
    // ND-023: no interstitial right after a boost ad, or any rewarded ad.
    const skipBreak = boostAdWatched || skipNextBreak;
    boostAdWatched = false;
    skipNextBreak = false;
    if (runCount > 0 && runCount % 3 === 0 && !skipBreak) {
      adBreak().then(() => startGame());
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
    useBoost(); // ND-023: armed power-up starts active
    hideExit();
    tutorialRun = tutorialWanted(); // no revive offer on the guided first run
    if (tutorialRun) tutorialStart(); else tutorialAbort();
    scoreEl.textContent = "0";
    coinsEl.textContent = "0";
    audio.ensure(); // BUG-03: unlock WebAudio on the PLAY/PLAY-AGAIN gesture
    paused = false;
    runId = (window.NeonAnalytics && window.NeonAnalytics.sessionId ? window.NeonAnalytics.sessionId : "r") + "-" + Date.now().toString(36);
    runStart = performance.now();
    stoppedAt = 0;
    runCount++;
    runPending = true;
    track("game_start", { skin: selectedSkin });
    ads.gameplayStart();
    state = STATE.PLAYING;
    music.setMode("run");
    startScreen.classList.add("hidden");
    closeTab();
    gameoverScreen.classList.add("hidden");
    placeToast();
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
    if (paused) stoppedAt = performance.now();
    else if (stoppedAt) { runStart += performance.now() - stoppedAt; stoppedAt = 0; }
    pauseScreen.classList.toggle("hidden", !paused);
    tutorialBanner.classList.toggle("hidden", paused || !tutorial); // ND-037
    pauseBtn.textContent = paused ? "▶" : "❚❚";
    music.setMode(paused ? "paused" : "run");
    if (!paused) {
      audio.ensure(); // BUG-03: ensure audio is unlocked after resume
      lastTime = performance.now(); // avoid a huge dt after resuming
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(loop);
    }
  }

  // ND-031: Android Back button (and Escape on the web).
  // Run -> pause; paused or game-over -> menu; menu (Android) -> exit panel (ND-037).
  // Returns true if the game used the press.
  function handleBack() {
    if (state === STATE.PLAYING) {
      if (!paused) togglePause();
      else quitToMenu();
      return true;
    }
    if (state === STATE.OVER) {
      menuBtn.click();
      return true;
    }
    if (tabOpen()) { closeTab(); return true; } // Step B: Back closes an open menu tab first
    // ND-037: menu -> "Leave Neon Dash?" panel (Android); Back again closes it.
    if (exitOpen()) { hideExit(); return true; }
    if (NATIVE) { showExit(); return true; }
    return false;
  }
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && (state !== STATE.MENU || exitOpen() || tabOpen())) { e.preventDefault(); handleBack(); }
  });
  (function wireNativeBack() {
    const cap = window.Capacitor;
    const App = cap && cap.isNativePlatform && cap.isNativePlatform() && cap.Plugins && cap.Plugins.App;
    if (!App || !App.addListener) return;
    App.addListener("backButton", () => { if (!handleBack()) App.exitApp(); });
  })();

  function quitToMenu() {
    paused = false;
    tutorialAbort();
    ads.gameplayStop(); // balance the gameplayStart() from startGame() on this exit path
    bankRun();
    state = STATE.MENU;
    music.setMode("menu");
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

  // Step B: keep toasts clear of overlay titles (menu: top strip; game over: bottom-left).
  function placeToast() {
    if (!toastEl) return;
    toastEl.classList.toggle("on-menu", !!startScreen && !startScreen.classList.contains("hidden"));
    toastEl.classList.toggle("on-over", !!gameoverScreen && !gameoverScreen.classList.contains("hidden"));
  }
  function showToast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    placeToast();
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
    { const dot = document.getElementById("missions-dot"); if (dot) dot.classList.toggle("hidden", !(s.daily && !s.daily.done && s.daily.target)); }
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
    music.setMode("menu"); // drums drop out, back to the menu loop
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
    stoppedAt = performance.now();
    track("game_over", {
      run_id: runId,
      score: score,
      gems: coinCount,
      duration_ms: Math.round(stoppedAt - runStart),
      cause: lastCrashCause,
      new_record: newRecord,
      near_misses: nearMissRun,
    });
    ads.gameplayStop();
    noteFinishedRun();
    finalScoreEl.textContent = score;
    finalCoinsEl.textContent = coinCount;
    finalBestEl.textContent = best;
    newRecordEl.classList.toggle("hidden", !newRecord);
    reviveOffered = reviveAllowed(); // decided once per game over
    if (reviveOffered) lastReviveOfferAt = performance.now();
    renderRewardButtons();
    renderBoost();
    hud.classList.add("hidden");
    pauseBtn.classList.add("hidden");
    gameoverScreen.classList.remove("hidden");
    placeToast();
  }

  // Rewarded surfaces. Revive: at most once per run, and offered at most once
  // every REVIVE_OFFER_GAP_MS (CrazyGames: don't offer an out-of-lives ad on
  // every death), never on the guided first run. Double gems: once per run,
  // so it stays claimed across a Revive (no second ad for no extra reward).
  const REVIVE_OFFER_GAP_MS = 3 * 60 * 1000;
  let lastReviveOfferAt = -Infinity;
  let reviveOffered = false;
  function reviveAllowed() {
    if (reviveUsed || !rewardAdsOn() || tutorialRun) return false;
    if (TEST_MODE) return true;
    return performance.now() - lastReviveOfferAt >= REVIVE_OFFER_GAP_MS;
  }
  function renderRewardButtons() {
    reviveBtn.disabled = false;
    reviveBtn.textContent = "🎬 CONTINUE · watch ad";
    reviveBtn.classList.toggle("hidden", !reviveOffered || reviveUsed || !rewardAdsOn());
    if (!doubleClaimed) {
      doubleGemsBtn.disabled = false;
      doubleGemsBtn.textContent = "🎬 DOUBLE GEMS · watch ad";
    }
    doubleGemsBtn.classList.toggle("hidden", coinCount <= 0 || doubleClaimed || !rewardAdsOn());
    const note = document.getElementById("ad-note");
    if (note) note.classList.toggle("hidden", !ads.adsBlocked);
  }

  // Watch a rewarded ad to double this run's gems — applied via gemMultiplier
  // and banked by bankRun() when the run is left. Returns a Promise.
  function claimDoubleGems() {
    if (doubleClaimed || !rewardAdsOn()) return Promise.resolve(false);
    const token = runId; // bind the reward to THIS game-over run
    doubleGemsBtn.disabled = true;
    return adRewarded("double_gems").then((ok) => {
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
    if (reviveUsed || state !== STATE.OVER || !rewardAdsOn()) return Promise.resolve(false);
    const token = runId; // bind the reward to THIS game-over run
    reviveBtn.disabled = true;
    return adRewarded("revive").then((ok) => {
      // Ignore a late async reward if the player already left this run.
      if (state !== STATE.OVER || runId !== token) return false;
      if (ok) { revive(); }
      else { reviveBtn.disabled = false; }
      return ok;
    });
  }
  function revive() {
    reviveUsed = true;
    if (stoppedAt) { runStart += performance.now() - stoppedAt; stoppedAt = 0; }
    music.setMode("run");
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
      player.coyote = 0;
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
  // ---- ND-037: first-run tutorial ----
  // A guided first run (or any run from "How to play"): jump -> one spike with a
  // freeze-frame prompt -> mid-air jumps -> gems. While guided there's no speed
  // ramp, no random spawns, and a hit clears the obstacle instead of ending the run.
  const TUTORIAL_KEY = "neondash.tutorialDone";
  let tutorial = null;       // null | "jump" | "spike" | "multi" | "gems"
  let tutorialHold = false;  // world frozen until the player taps
  let tutorialTimer = 0;
  let tutorialSpike = null;
  let forceTutorial = false;
  let autoTutorial = !TEST_MODE; // e2e runs stay unguided unless a test opts in
  function tutorialWanted() {
    return forceTutorial || (autoTutorial && safeGet(TUTORIAL_KEY) !== "1");
  }
  function tutorialSay(msg) {
    tutorialText.textContent = msg;
    tutorialBanner.classList.remove("hidden");
  }
  function tutorialStart() {
    track("tutorial_start", { replay: forceTutorial });
    forceTutorial = false;
    tutorial = "jump";
    tutorialHold = false;
    tutorialTimer = 0;
    tutorialSpike = null;
    spawnTimer = Infinity;
    gemTimer = Infinity;
    powerTimer = Infinity;
    tutorialSay("Tap anywhere to jump");
  }
  function tutorialNext(step, msg) {
    tutorial = step;
    tutorialTimer = 0;
    if (msg) tutorialSay(msg);
  }
  function tutorialAbort() {
    tutorial = null;
    tutorialHold = false;
    forceTutorial = false;
    if (tutorialBanner) tutorialBanner.classList.add("hidden");
  }
  function tutorialEnd(skipped) {
    if (!tutorial) return;
    const step = tutorial;
    tutorialAbort();
    safeSet(TUTORIAL_KEY, "1");
    spawnTimer = 1.0;
    gemTimer = 1.4;
    powerTimer = 7 + rnd() * 4;
    track(skipped ? "tutorial_skip" : "tutorial_done", { step });
    if (!skipped) showToast("You're ready. Go!");
  }
  // Runs at the top of update(). Returns true while the world is frozen.
  function tutorialTick(dt) {
    if (tutorialHold) {
      for (const s of stars) s.tw += dt * 2;
      return true;
    }
    tutorialTimer += dt;
    if (tutorial === "spike") {
      if (!tutorialSpike) {
        if (tutorialTimer > 0.6 && player.onGround) {
          tutorialSpike = { type: "spikes", x: W + 40, w: 26, h: 34, count: 1, spikeW: 26 };
          obstacles.push(tutorialSpike);
        }
      } else if (!tutorialSpike.prompted) {
        // Freeze far enough out that a tap right after the prompt always clears it
        // (scaled to world speed, so slow-mo boosts work too).
        const ws = speed * (slowTime > 0 ? SLOWMO_FACTOR : 1);
        if (player.onGround && tutorialSpike.x - (player.x + player.size) <= ws * 0.22) {
          tutorialSpike.prompted = true;
          tutorialHold = true;
          tutorialSay("Spike ahead! Tap to jump over it");
          return true;
        }
      }
      if (tutorialSpike && tutorialSpike.x + tutorialSpike.w < player.x) {
        tutorialSpike = null;
        tutorialNext("multi", "Tap again in mid-air: double jump, then triple jump");
      }
    } else if (tutorial === "multi") {
      if (tutorialTimer > 0.2 && player.jumps >= 2) {
        spawnGemArc();
        tutorialNext("gems", "Grab gems \u25C6 and spend them on skins and shoes");
      }
    } else if (tutorial === "gems") {
      if (coinCount > 0 || tutorialTimer > 4) tutorialEnd(false);
    }
    return false;
  }
  function tutorialForgiveHit(i) {
    obstacles.splice(i, 1);
    tutorialSpike = null;
    tutorialHold = false;
    flash = 0.35; // Step B: shake is for deaths only
    vibrate(40);
    tutorialNext("spike", "Jump a little earlier. Here comes another one...");
  }

  // Step A: runs are built from hand-made chunks (patterns.js), picked by
  // difficulty tier, with a hazard-free breather every 20-30 s from tier 1.
  let lastChunkId = null;
  let breatherIn = 25;
  function spawnChunk() {
    const tier = NP.tierForScore(score);
    let chunk;
    if (tier >= 1 && breatherIn <= 0) {
      chunk = NP.BREATHER;
      breatherIn = NP.nextBreatherIn(rnd);
    } else {
      chunk = NP.pickChunk(tier, rnd, lastChunkId);
      lastChunkId = chunk.id;
    }
    const built = NP.buildChunk(chunk, speed, W + 40, groundY);
    for (const o of built.obstacles) obstacles.push(o);
    for (const g of built.gems) gems.push({ x: g.x, y: g.y, r: 11, got: false, bob: rnd() * Math.PI * 2 });
    if (chunk.breather) gemTimer = Math.max(gemTimer, built.length + 0.6);
    track("chunk", { id: chunk.id, tier: tier });
    return built.length + NP.chunkGap(tier, rnd);
  }
  // A ceiling overlapping [x0, x1] (screen px)? Gems and power-ups avoid it.
  function ceilingOver(x0, x1) {
    for (const o of obstacles) if (o.type === "ceiling" && o.x < x1 && o.x + o.w > x0) return true;
    return false;
  }

  function spawnGemArc() {
    const n = 3 + Math.floor(rnd() * 3);
    let baseY = groundY - 70 - rnd() * 120;
    // Under a ceiling, gems sit at running height: a reward for staying low.
    if (ceilingOver(W + 20, W + 60 + n * 46)) baseY = groundY - 28;
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
    if (ceilingOver(W + 20, W + 90)) return false;
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
    // ND-021: shoes flash white and throw a spark burst in the power colour.
    shoeFlash = SHOE_FLASH_SECS;
    if (!reduceMotion) spawnShoeSparks(POWER_COLORS[type].split(",").map(Number), 10, 220);
    if (type === "shield") shieldTime = SHIELD_DURATION;
    else if (type === "magnet") magnetTime = MAGNET_DURATION;
    else if (type === "slowmo") slowTime = SLOWMO_DURATION;
    audio.power();
    vibrate(35);
    powerupsUsedRun++;
    track("powerup_collected", { type: type });
    spawnRingBurst(POWER_COLORS[type] || "0,255,180");
  }

  // ---- Step B: game feel ----
  function stretchPlayer() { if (!reduceMotion && player) { player.sx = 0.78; player.sy = 1.26; } }
  function squashPlayer() { if (!reduceMotion && player) { player.sx = 1.3; player.sy = 0.74; } }
  function rgbOf(c) { // "rgb(r,g,b)" or "#rrggbb" -> "r,g,b" for particles
    if (c[0] === "#") return parseInt(c.slice(1, 3), 16) + "," + parseInt(c.slice(3, 5), 16) + "," + parseInt(c.slice(5, 7), 16);
    return c.slice(c.indexOf("(") + 1, c.indexOf(")"));
  }
  function spawnLandDust() {
    const col = rgbOf(theme.accent);
    for (let i = 0; i < 10; i++) {
      const dir = i % 2 === 0 ? -1 : 1;
      particles.push({
        x: player.x + player.size / 2 + dir * player.size * 0.3,
        y: player.y + player.size,
        vx: dir * (60 + rnd() * 140),
        vy: -rnd() * 70,
        life: 0.35, max: 0.35, color: col, r: rnd() * 2.5 + 1,
      });
    }
  }
  const NEAR_MISS_PX = 14;
  // Clearance between the player box and a hazard while they overlap
  // horizontally; the smallest value is checked once the hazard is behind.
  function hazardClearance(o) {
    const px = player.x, py = player.y, ps = player.size;
    if (o.type === "spikes" || o.type === "wall") return (groundY - o.h) - (py + ps);
    if (o.type === "pillar") return (groundY - NP.pillarHeight(o)) - (py + ps);
    if (o.type === "ceiling") return py - (groundY - o.gap + 12);
    if (o.type === "bar") return Math.max(o.y - (py + ps), py - (o.y + o.h));
    if (o.type === "saw") {
      const cx = o.x + o.w / 2, cy = NP.sawCenterY(o, groundY);
      const nx = Math.max(px, Math.min(cx, px + ps)), ny = Math.max(py, Math.min(cy, py + ps));
      return Math.hypot(cx - nx, cy - ny) - o.r;
    }
    return Infinity; // pits and pads don't count
  }
  function checkNearMiss(o) {
    if (o.nearDone || tutorial) return;
    const px = player.x, ps = player.size;
    if (o.x < px + ps && o.x + o.w > px) {
      const c = hazardClearance(o);
      if (c < (o.minClear == null ? Infinity : o.minClear)) o.minClear = c;
    } else if (o.x + o.w <= px && o.minClear != null) {
      o.nearDone = true;
      if (o.minClear < NEAR_MISS_PX) {
        coinCount += 1;
        coinsEl.textContent = coinCount;
        nearMissRun++;
        floaters.push({ x: px + ps / 2, y: player.y - 10, text: "NEAR MISS +1 ◆", life: 0.8, max: 0.8 });
        flash = Math.max(flash, 0.12);
        audio.coin();
        vibrate(15);
      }
    }
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

  // ---- Boost (ND-023) ----
  const boostPanels = [document.getElementById("boost-start"), document.getElementById("boost-over")];
  (function loadBoost() {
    const v = safeGet(BOOST_KEY);
    boostArmed = BOOST_TYPES.some((b) => b.id === v) ? v : null;
  })();
  function saveBoost() {
    try {
      if (boostArmed) NeonStore.setItem(BOOST_KEY, boostArmed);
      else NeonStore.removeItem(BOOST_KEY);
    } catch (e) { /* storage may be unavailable */ }
  }
  function armBoost(type, via) {
    boostArmed = type;
    saveBoost();
    track("boost_armed", { type: type, via: via });
    audio.power();
    vibrate(30);
    showToast("✓ " + BOOST_TYPES.find((b) => b.id === type).name + " ready for your next run");
    renderShop(); // bank display + boost panels
  }
  // Returns a Promise<boolean>: true when the boost got armed.
  function buyBoost(type, via) {
    if (boostArmed || boostBusy || !BOOST_TYPES.some((b) => b.id === type)) return Promise.resolve(false);
    if (via === "gems") {
      if (bank < BOOST_GEM_COST) return Promise.resolve(false);
      bank -= BOOST_GEM_COST;
      persistProgress();
      armBoost(type, "gems");
      return Promise.resolve(true);
    }
    if (via !== "ad" || !rewardAdsOn()) return Promise.resolve(false);
    boostBusy = true;
    renderBoost();
    return adRewarded("boost_" + type).then((ok) => {
      boostBusy = false;
      if (ok && !boostArmed) {
        boostAdWatched = true;
        armBoost(type, "ad");
        return true;
      }
      if (!ok && !ads.lastAdError) { audio.shieldBreak(); showToast("Video didn't finish — try again"); }
      renderBoost();
      return false;
    });
  }
  // Called at run start: the armed power-up begins active at full duration.
  function useBoost() {
    if (!boostArmed) return;
    const type = boostArmed;
    if (type === "shield") shieldTime = SHIELD_DURATION;
    else if (type === "magnet") magnetTime = MAGNET_DURATION;
    else if (type === "slowmo") slowTime = SLOWMO_DURATION;
    shoeFlash = SHOE_FLASH_SECS;
    if (!reduceMotion) spawnRingBurst(POWER_COLORS[type]);
    track("boost_used", { type: type });
    boostArmed = null;
    saveBoost();
    renderBoost();
  }
  function renderBoost() {
    { const tb = document.getElementById("tab-btn-boosts"); if (tb) tb.classList.toggle("armed", !!boostArmed); }
    for (const panel of boostPanels) {
      if (!panel) continue;
      panel.innerHTML = "";
      const head = document.createElement("div");
      head.className = "boost-head";
      head.textContent = "BOOST NEXT RUN";
      panel.appendChild(head);
      if (boostArmed) {
        const b = BOOST_TYPES.find((x) => x.id === boostArmed);
        const ready = document.createElement("div");
        ready.className = "boost-ready boost-" + b.id;
        ready.textContent = "✓ " + b.icon + " " + b.name.toUpperCase() + " READY";
        panel.appendChild(ready);
        continue;
      }
      const row = document.createElement("div");
      row.className = "boost-row";
      for (const b of BOOST_TYPES) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "boost-chip boost-" + b.id + (b.id === boostPick ? " selected" : "");
        chip.setAttribute("aria-pressed", b.id === boostPick ? "true" : "false");
        chip.setAttribute("aria-label", "Boost: " + b.name);
        chip.dataset.boost = b.id;
        chip.innerHTML = '<span class="boost-icon">' + b.icon + '</span><span class="boost-name">' + b.name + "</span>";
        chip.addEventListener("click", (e) => { e.stopPropagation(); boostPick = b.id; audio.coin(); renderBoost(); });
        row.appendChild(chip);
      }
      panel.appendChild(row);
      const pay = document.createElement("div");
      pay.className = "boost-pay";
      if (ads.adsBlocked && !TEST_MODE) {
        const note = document.createElement("div");
        note.className = "ad-note";
        note.textContent = "Ad blocker on: the free video boost is off";
        panel.appendChild(note);
      }
      if (rewardAdsOn()) {
        const adBtn = document.createElement("button");
        adBtn.type = "button";
        adBtn.className = "boost-btn boost-ad";
        adBtn.textContent = boostBusy ? "loading…" : "🎬 FREE · watch ad";
        adBtn.disabled = boostBusy;
        adBtn.addEventListener("click", (e) => { e.stopPropagation(); buyBoost(boostPick, "ad"); });
        pay.appendChild(adBtn);
      }
      const gemBtn = document.createElement("button");
      gemBtn.type = "button";
      gemBtn.className = "boost-btn boost-gems";
      const short = bank < BOOST_GEM_COST;
      gemBtn.textContent = short ? "need " + BOOST_GEM_COST + " ◆" : "◆ " + BOOST_GEM_COST;
      gemBtn.disabled = short || boostBusy;
      gemBtn.addEventListener("click", (e) => { e.stopPropagation(); buyBoost(boostPick, "gems"); });
      pay.appendChild(gemBtn);
      panel.appendChild(pay);
    }
  }

  // ---- Power-up shoes (ND-021) ----
  const SHOE_FLASH_SECS = 0.22;
  const SHOE_SPARK_EVERY_PX = 34; // roughly one footfall at running pace
  function shoeLook() {
    return NeonEngine.shoePowerStyle({
      shield: shieldTime, magnet: magnetTime, slow: slowTime,
      reduceMotion: reduceMotion, t: shoeClock,
    });
  }
  // Small sparks kicked up from the feet. Math.random, not rnd(): purely cosmetic.
  function spawnShoeSparks(rgb, n, power) {
    const fx = player.x + player.size / 2;
    const fy = player.y + player.size * 1.12;
    const col = rgb[0] + "," + rgb[1] + "," + rgb[2];
    for (let i = 0; i < n; i++) {
      const a = Math.PI + Math.random() * Math.PI; // upward half
      const sp = Math.random() * power + 40;
      particles.push({
        x: fx + (Math.random() - 0.5) * player.size * 0.5,
        y: fy,
        vx: Math.cos(a) * sp - 60,
        vy: Math.sin(a) * sp,
        life: 0.4,
        max: 0.4,
        color: col,
        r: Math.random() * 2.5 + 1.5,
      });
    }
  }

  // ---- Collision (AABB) ----
  const hits = NeonEngine.hits;

  // ---- Update ----
  function update(dt) {
    if (tutorial && tutorialTick(dt)) return; // ND-037: frozen on a tutorial prompt
    // Difficulty ramp (held at the start speed during the tutorial)
    if (!tutorial) speed = Math.min(MAX_SPEED, speed + SPEED_RAMP * dt);
    // Slow-mo scales how fast the world moves toward the player.
    const worldSpeed = speed * (slowTime > 0 ? SLOWMO_FACTOR : 1);
    distance += worldSpeed * dt;
    score = NeonEngine.scoreFromDistance(distance);
    scoreEl.textContent = score;
    bgScroll += worldSpeed * dt;
    theme = currentTheme();

    // Player physics
    const wasGround = player.onGround;
    if (NP.stepPlayer(player, dt, groundY, obstacles) === "fell") {
      if (shieldTime > 0 && !tutorial) {
        // The shield bounces you out of a pit once (and breaks the gem chain).
        shieldTime = 0;
        combo = 0;
        comboMult = 1;
        updateComboHud();
        flash = 0.35; // Step B: shake is for deaths only; a shield break flashes
        audio.shieldBreak();
        vibrate(60);
        spawnRingBurst("0,255,180");
        NP.launch(player);
      } else {
        lastCrashCause = "pit";
        return crash();
      }
    }
    player.rot = player.onGround ? 0 : player.rot + dt * 8;
    // Step B: squash on landing, then ease back to the normal shape.
    if (!wasGround && player.onGround) { squashPlayer(); spawnLandDust(); }
    const ease = Math.min(1, dt * 14);
    player.sx += (1 - player.sx) * ease;
    player.sy += (1 - player.sy) * ease;

    // Player trail
    player.trail.unshift({ x: player.x, y: player.y });
    if (player.trail.length > 8) player.trail.pop();

    // Spawn obstacles
    // Timers run on world time, so slow-mo stretches the pattern spacing too.
    const worldDt = dt * (slowTime > 0 ? SLOWMO_FACTOR : 1);
    spawnTimer -= worldDt;
    if (!tutorial) breatherIn -= dt;
    if (spawnTimer <= 0) spawnTimer = spawnChunk();
    // Spawn gems
    gemTimer -= dt;
    if (gemTimer <= 0) {
      spawnGemArc();
      gemTimer = 1.6 + rnd() * 1.8;
    }
    // Spawn shield power-ups (rare)
    powerTimer -= dt;
    if (powerTimer <= 0) {
      powerTimer = spawnPowerup() === false ? 1 : 12 + rnd() * 8;
    }
    // Countdown active power-ups
    if (shieldTime > 0) shieldTime = Math.max(0, shieldTime - dt);
    if (magnetTime > 0) magnetTime = Math.max(0, magnetTime - dt);
    if (slowTime > 0) slowTime = Math.max(0, slowTime - dt);
    music.setIntensity(speed, shieldTime > 0 || magnetTime > 0 || slowTime > 0); // ND-025
    // Power-up shoes: clock, pickup flash, footfall sparks (ND-021).
    shoeClock += dt;
    if (shoeFlash > 0) shoeFlash = Math.max(0, shoeFlash - dt);
    if (player.onGround && !reduceMotion) {
      const look = shoeLook();
      if (look.color) {
        shoeSparkAcc += worldSpeed * dt;
        if (shoeSparkAcc >= SHOE_SPARK_EVERY_PX) {
          shoeSparkAcc = 0;
          spawnShoeSparks(look.rgb, 4, 110);
        }
      }
    }

    // Move + test obstacles
    const px = player.x, py = player.y, ps = player.size;
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      o.x -= worldSpeed * dt;
      o.age = (o.age || 0) + worldDt;
      if (o.x + o.w < -10) { obstacles.splice(i, 1); continue; }

      // Forgiving hitboxes per type live in patterns.js (spikes/bar unchanged).
      const res = NP.interact(o, player, groundY);
      if (res === "launch") {
        NP.launch(player);
        stretchPlayer();
        spawnJumpDust();
        audio.doubleJump();
        vibrate(20);
        continue;
      }
      const hit = res === "hit";
      if (hit && tutorial) { tutorialForgiveHit(i); continue; }
      if (hit) {
        if (shieldTime > 0) {
          // Shield absorbs the hit: shatter it and clear this obstacle.
          // Touching an obstacle breaks the gem chain (the shield saves the run,
          // not the combo) — a real cost that keeps the multiplier meaningful.
          shieldTime = 0;
          combo = 0;
          comboMult = 1;
          updateComboHud();
          flash = 0.35; // Step B: shake is for deaths only; a shield break flashes
          audio.shieldBreak();
          vibrate(60);
          spawnRingBurst("0,255,180");
          obstacles.splice(i, 1);
        } else {
          lastCrashCause = o.type; // spikes | bar | ceiling | saw | pillar | wall
          return crash();
        }
      }
    }

    // Step B: near misses (passed a hazard with only a few pixels to spare).
    for (const o of obstacles) checkNearMiss(o);
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i];
      f.life -= dt; f.y -= 46 * dt;
      if (f.life <= 0) floaters.splice(i, 1);
    }
    if (flash > 0) flash = Math.max(0, flash - dt * 2.5);

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
    hitstop = reduceMotion ? 0 : 0.15; // Step B: 150 ms freeze frame before the burst
    flash = reduceMotion ? 0.25 : 0.6;
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

    // Step B: far city skyline (slowest layer) with a few lit windows.
    if (!city) buildBackground();
    const cityScroll = (bgScroll * 0.06) % (W * 1.5);
    ctx.fillStyle = theme.city;
    for (const b of city) {
      let bx = b.x * W - cityScroll;
      if (bx < -b.w * W) bx += W * 1.5;
      if (bx > W) continue;
      const bw = b.w * W, bh = b.h * H, by = groundY - bh;
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = theme.city;
      ctx.fillRect(bx, by, bw, bh);
      if (b.spire) ctx.fillRect(bx + bw / 2 - 1.5, by - bh * 0.18, 3, bh * 0.18);
      // windows: a deterministic pattern per building
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = theme.accent;
      let k = b.seed;
      for (let wy = by + 8; wy < groundY - 10; wy += 12) {
        for (let wx = bx + 5; wx < bx + bw - 6; wx += 9) {
          k = (k * 1103515245 + 12345) & 0x7fffffff;
          if (k % 5 === 0) ctx.fillRect(wx, wy, 3, 4);
        }
      }
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
    // Step B: faint neon rim on the hill ridges.
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const hl of hills) {
      let hx = hl.x * W - hillScroll;
      if (hx < -W * 0.4) hx += W * 1.4;
      const hw = hl.w * W, hh = hl.h * H;
      ctx.moveTo(hx, groundY); ctx.lineTo(hx + hw / 2, groundY - hh); ctx.lineTo(hx + hw, groundY);
    }
    ctx.stroke();
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
    // Step B: receding horizontal lines give the near grid depth.
    ctx.globalAlpha = 0.14;
    for (let k = 1; k <= 4; k++) {
      const y = groundY + (H - groundY) * Math.pow(k / 4.6, 1.6);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
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
      // ND-021: power-up colour for the shoes (null = normal shoes).
      const look = shoeLook();
      const flash = shoeFlash > 0;
      const powerCol = flash ? "#ffffff" : look.color;
      // Coloured light pool on the ground under the feet while powered up.
      if (powerCol && player.onGround) {
        const gx = cx, gy = bottomY + s * 0.22, gr = s * 0.75;
        const rgb = flash ? [255, 255, 255] : look.rgb;
        const pool = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
        pool.addColorStop(0, "rgba(" + rgb + "," + (look.dim ? 0.25 : 0.45) + ")");
        pool.addColorStop(1, "rgba(" + rgb + ",0)");
        ctx.save();
        ctx.fillStyle = pool;
        ctx.beginPath();
        ctx.ellipse(gx, gy, gr, gr * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
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
        if (powerCol) {
          drawPowerShoe(footX, footY, s, retro, powerCol, look, i);
        } else if (retro) {
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
    // Step B: squash & stretch, anchored at the feet so landing squashes down.
    ctx.translate(cx, player.y + s);
    ctx.scale(player.sx || 1, player.sy || 1);
    ctx.translate(0, -s / 2);
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
    // Step B: bright rim + glint so the body reads as a lit neon tile.
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 1.5;
    roundRect(ctx, -s / 2 + 1.5, -s / 2 + 1.5, s - 3, s - 3, 7);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(-s * 0.36, -s * 0.38, s * 0.3, s * 0.08);
    // Eye
    ctx.fillStyle = "#0d0d1a";
    ctx.fillRect(s * 0.08, -s * 0.18, s * 0.22, s * 0.22);
    if (hitstop > 0) { // freeze frame: the player flashes white
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = "#ffffff";
      roundRect(ctx, -s / 2, -s / 2, s, s, 8);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  // ND-021: a shoe lit by the active power-up. Classic = glowing orb (1.6x),
  // Retro = power-coloured upper, white sparkling stripe, white sole.
  //   shield: slow pulse · magnet: shimmer sweeping heel→toe · slow-mo: fading
  //   after-images behind the foot · rainbow: colour from look (cycles).
  function drawPowerShoe(x, y, s, retro, col, look, foot) {
    const t = shoeClock;
    const still = reduceMotion;
    ctx.save();
    if (look.dim) ctx.globalAlpha = 0.6;
    // Slow-mo after-images: the world streams left, so ghosts trail to the left.
    if (look.mode === "slowmo" && !still) {
      for (let k = 3; k >= 1; k--) {
        ctx.save();
        ctx.globalAlpha = (look.dim ? 0.6 : 1) * (0.32 - k * 0.08);
        drawShoeShape(x - k * s * 0.16, y, s, retro, col, 0, false);
        ctx.restore();
      }
    }
    const pulse = look.mode === "shield" && !still ? 0.5 + 0.5 * Math.sin(t * 6) : 0.5;
    // Retro keeps a tighter glow so the upper's colour still reads.
    drawShoeShape(x, y, s, retro, col, retro ? 5 + pulse * 7 : 12 + pulse * 12, true);
    // Magnet shimmer: a bright band sweeping heel→toe.
    if (look.mode === "magnet" && !still) {
      const w = retro ? s * 0.42 : s * 0.22;
      const f = (t * 1.6 + foot * 0.5) % 1;
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.beginPath();
      ctx.arc(x - w * 0.45 + f * w, y, s * 0.05, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.restore();
  }

  // The shoe body in one colour. Used for the lit shoe and its after-images.
  function drawShoeShape(x, y, s, retro, col, blur, detail) {
    ctx.shadowColor = col;
    ctx.shadowBlur = blur;
    if (!retro) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(4, s * 0.07 * 1.6), 0, Math.PI * 2);
      ctx.fill();
      if (detail) { // hot white core
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.beginPath();
        ctx.arc(x - s * 0.02, y - s * 0.02, Math.max(1.5, s * 0.035), 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    const w = s * 0.42, h = s * 0.24;
    // Sole stays white.
    ctx.fillStyle = RETRO.sole;
    roundRect(ctx, x - w * 0.45, y + h * 0.30, w, h * 0.40, h * 0.2);
    ctx.fill();
    // Upper takes the power colour.
    ctx.fillStyle = col;
    roundRect(ctx, x - w * 0.45, y - h * 0.12, w * 0.70, h * 0.50, 3);
    ctx.fill();
    if (!detail) return;
    // White stripe with a sparkle running along it.
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(2, s * 0.05);
    ctx.lineCap = "round";
    const x0 = x - w * 0.30, y0 = y + h * 0.26, x1 = x + w * 0.03, y1 = y - h * 0.02;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    if (!reduceMotion) {
      const f = (shoeClock * 2.2) % 1;
      const sx = x0 + (x1 - x0) * f, sy = y0 + (y1 - y0) * f;
      const r = Math.max(2, s * 0.06);
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 8;
      ctx.beginPath(); // 4-point star
      ctx.moveTo(sx, sy - r); ctx.lineTo(sx + r * 0.3, sy - r * 0.3);
      ctx.lineTo(sx + r, sy); ctx.lineTo(sx + r * 0.3, sy + r * 0.3);
      ctx.lineTo(sx, sy + r); ctx.lineTo(sx - r * 0.3, sy + r * 0.3);
      ctx.lineTo(sx - r, sy); ctx.lineTo(sx - r * 0.3, sy - r * 0.3);
      ctx.closePath();
      ctx.fill();
    }
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

  // Step B: one neon look for every hazard: tinted core, glowing tube outline,
  // thin white inner highlight. Expects the path to be built already.
  function neon(color, blur, core) {
    ctx.globalAlpha = core == null ? 0.42 : core;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineJoin = "round";
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.shadowColor = color;
    ctx.shadowBlur = blur || 14;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,255,255,0.65)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawObstacles() {
    for (const o of obstacles) {
      if (o.type === "spikes") {
        ctx.beginPath();
        for (let i = 0; i < o.count; i++) {
          const sx = o.x + i * o.spikeW;
          ctx.moveTo(sx + 1, groundY);
          ctx.lineTo(sx + o.spikeW / 2, groundY - o.h);
          ctx.lineTo(sx + o.spikeW - 1, groundY);
          ctx.closePath();
        }
        neon(theme.haz, 14, 0.55);
      } else if (o.type === "bar") {
        ctx.beginPath();
        ctx.moveTo(o.x + o.w / 2, o.y + o.h); ctx.lineTo(o.x + o.w / 2, groundY);
        ctx.strokeStyle = theme.haz2; ctx.globalAlpha = 0.5; ctx.lineWidth = 3; ctx.stroke(); ctx.globalAlpha = 1;
        roundRect(ctx, o.x, o.y, o.w, o.h, 5);
        neon(theme.haz2, 14, 0.55);
      } else if (o.type === "pit") {
        // Cut the ground: dark gap with glowing lips, drawn over the ground slab.
        ctx.fillStyle = "#05050f";
        ctx.fillRect(o.x, groundY - 2, o.w, H - groundY + 2);
        const g = ctx.createLinearGradient(0, groundY, 0, H);
        g.addColorStop(0, "rgba(255,77,109,0.18)"); g.addColorStop(1, "rgba(255,77,109,0)");
        ctx.fillStyle = g;
        ctx.fillRect(o.x, groundY, o.w, H - groundY);
        ctx.strokeStyle = theme.accent;
        ctx.lineWidth = 3;
        ctx.shadowColor = theme.accent;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.moveTo(o.x, groundY); ctx.lineTo(o.x, groundY + 26);
        ctx.moveTo(o.x + o.w, groundY); ctx.lineTo(o.x + o.w, groundY + 26);
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else if (o.type === "ceiling") {
        const bottom = groundY - o.gap;
        ctx.globalAlpha = 0.07;
        ctx.fillStyle = theme.haz;
        ctx.fillRect(o.x, 0, o.w, bottom - 6);
        ctx.globalAlpha = 1;
        // slab + downward teeth as one outlined shape
        const tw = 18;
        ctx.beginPath();
        ctx.moveTo(o.x, bottom - 8);
        ctx.lineTo(o.x + o.w, bottom - 8);
        ctx.lineTo(o.x + o.w, bottom);
        for (let x = o.x + o.w; x - tw >= o.x - 0.5; x -= tw) {
          ctx.lineTo(x - tw / 2, bottom + 12);
          ctx.lineTo(x - tw, bottom);
        }
        ctx.lineTo(o.x, bottom);
        ctx.closePath();
        neon(theme.haz, 14, 0.6);
      } else if (o.type === "saw") {
        const cx = o.x + o.w / 2, cy = NP.sawCenterY(o, groundY);
        // tether line to show it is anchored
        ctx.strokeStyle = theme.saw;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, 0); ctx.lineTo(cx, cy - o.r);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(reduceMotion ? 0 : -(o.age || 0) * 9);
        ctx.beginPath();
        const teeth = 10;
        for (let k = 0; k < teeth * 2; k++) {
          const ang = (k / (teeth * 2)) * Math.PI * 2;
          const rr = k % 2 === 0 ? o.r : o.r * 0.72;
          ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
        }
        ctx.closePath();
        neon(theme.saw, 16, 0.55);
        ctx.fillStyle = "#1a1030";
        ctx.beginPath();
        ctx.arc(0, 0, o.r * 0.28, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = theme.saw; ctx.lineWidth = 2; ctx.stroke();
        ctx.restore();
      } else if (o.type === "pillar") {
        const h = NP.pillarHeight(o);
        roundRect(ctx, o.x + 3, groundY - h, o.w - 6, h, 4);
        neon(theme.solid, 14, 0.5);
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.fillRect(o.x + 7, groundY - h + 5, o.w - 14, 3);
      } else if (o.type === "wall") {
        roundRect(ctx, o.x + 2, groundY - o.h, o.w - 4, o.h, 4);
        neon(theme.haz, 14, 0.5);
        ctx.strokeStyle = "rgba(20,10,40,0.55)";
        ctx.lineWidth = 2;
        for (let y = groundY - o.h + 22; y < groundY; y += 22) {
          ctx.beginPath(); ctx.moveTo(o.x + 6, y); ctx.lineTo(o.x + o.w - 6, y); ctx.stroke();
        }
      } else if (o.type === "pad") {
        const pulse = reduceMotion ? 0.6 : 0.5 + 0.5 * Math.sin((o.age || 0) * 10);
        roundRect(ctx, o.x, groundY - o.h, o.w, o.h, 4);
        neon("#3dffb0", 10 + pulse * 12, 0.75);
        // chevrons pointing up
        ctx.strokeStyle = "rgba(61,255,176," + (0.35 + pulse * 0.5) + ")";
        ctx.lineWidth = 3;
        for (let k = 0; k < 2; k++) {
          const yy = groundY - o.h - 8 - k * 10;
          ctx.beginPath();
          ctx.moveTo(o.x + 12, yy + 6); ctx.lineTo(o.x + o.w / 2, yy); ctx.lineTo(o.x + o.w - 12, yy + 6);
          ctx.stroke();
        }
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

  function drawFloaters() {
    if (!floaters || !floaters.length) return;
    ctx.font = "bold 15px system-ui, sans-serif";
    ctx.textAlign = "center";
    for (const f of floaters) {
      ctx.globalAlpha = Math.max(0, f.life / f.max);
      ctx.fillStyle = "#ffe9a8";
      ctx.shadowColor = "#ffd84d";
      ctx.shadowBlur = 10;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.textAlign = "start";
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
    if (state === STATE.PLAYING || hitstop > 0) drawPlayer();
    if (hitstop <= 0) drawParticles();
    drawFloaters();
    ctx.restore();
    if (flash > 0) { // Step B: death / shield / near-miss flash (drawn unshaken)
      ctx.globalAlpha = Math.min(0.28, flash * (reduceMotion ? 0.25 : 0.45));
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }

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
    if (dt < 0) dt = 0; // first frame: rAF's timestamp can predate lastTime

    if (state === STATE.PLAYING) {
      if (paused) return; // frozen until resume re-arms the loop
      update(dt);
      render();
      rafId = requestAnimationFrame(loop);
    } else if (state === STATE.OVER) {
      // Keep particles/shake animating briefly on the game-over backdrop.
      update0Effects(dt);
      render();
      if (particles.length > 0 || shake > 0 || hitstop > 0 || flash > 0) rafId = requestAnimationFrame(loop);
    }
  }

  // Lightweight effects-only step for the game-over freeze.
  function update0Effects(dt) {
    if (flash > 0) flash = Math.max(0, flash - dt * 2.5);
    if (hitstop > 0) { hitstop = Math.max(0, hitstop - dt); return; } // Step B: freeze frame
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
      haz: lerpColor(a.haz, b.haz, t),
      haz2: lerpColor(a.haz2, b.haz2, t),
      solid: lerpColor(a.solid, b.solid, t),
      saw: lerpColor(a.saw, b.saw, t),
      city: lerpColor(a.city, b.city, t),
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
    renderBoost();
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
                 : (rewardAdsOn() ? ", watch a video to unlock, or reach " : ", locked: reach ") + RETRO_SCORE_UNLOCK +
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
      } else if (rewardAdsOn()) {
        label.textContent = "🎬 WATCH";   // rewarded-video path
        label.classList.add("afford");
      } else {
        label.textContent = "🔒 LOCKED";  // no ad network (web): earn by play
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
      hint.textContent = "👟 Retro Kicks — " + (rewardAdsOn() ? "watch a video, " : "") + "score " +
        RETRO_SCORE_UNLOCK + " (best " + best + "), or hit level " +
        RETRO_LEVEL_UNLOCK + " (now " + playerLevel() + ")" +
        (ads.adsBlocked && !TEST_MODE ? ". Ad blocker on: video unlock is off" : "");
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
    // Otherwise: watch a rewarded video (app / portal only). Unlock + equip
    // only if the video actually completed.
    if (!rewardAdsOn()) {
      showToast("Score " + RETRO_SCORE_UNLOCK + " or reach level " + RETRO_LEVEL_UNLOCK + " to unlock");
      return;
    }
    audio.coin();
    adRewarded("retro_shoes").then((ok) => {
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
    placeToast();
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
    // Portal builds that ask for it (CrazyGames Full Launch: "land new users in
    // gameplay immediately") skip the menu for brand-new players and open the
    // guided first run. Returning players still get the menu (shop, missions).
    if (shouldAutostart()) startGame();
  }
  function shouldAutostart() {
    return !!window.NEONDASH_AUTOSTART && best === 0 && safeGet(TUTORIAL_KEY) !== "1";
  }

  // ---- Test hooks (H4): only exposed with ?test=1, for E2E automation ----
  if (/[?&]test=1/.test(location.search)) {
    window.NeonDashTest = {
      seed(n) { rng = NeonEngine.mulberry32(n >>> 0); },
      start() { startGame(); },
      jump() { jump(); },
      pause() { if (!paused) togglePause(); },
      back() { return handleBack(); },
      setAutoTutorial(v) { autoTutorial = !!v; },
      howTo() { howtoBtn.click(); },
      skipTutorial() { tutorialSkipBtn.click(); },
      exitOpen() { return exitOpen(); },
      share() { return shareGame(); },
      resume() { if (paused) togglePause(); },
      clearObstacles() { obstacles.length = 0; },
      // Step B: game-feel state for tests.
      fx() { return { groundY, sx: player ? player.sx : 1, sy: player ? player.sy : 1, hitstop, flash, nearMisses: nearMissRun, floaters: floaters.length, haz: theme.haz, city: !!city && city.length }; },
      openTab(id) { openTab(id); return tabOpen(); },
      placeToast() { placeToast(); },
      tabOpen() { return tabOpen(); },
      // Step B: put a hazard right under a jumping player's path for the near-miss test.
      spawnObstacle(o) { obstacles.push(Object.assign({ age: 0 }, o)); },
      // Advance the simulation deterministically, independent of rAF /
      // page visibility (which are throttled for backgrounded test pages).
      step(n, dt) {
        const frames = n || 1;
        const d = dt || 1 / 60;
        for (let i = 0; i < frames && state === STATE.PLAYING; i++) update(d);
      },
      // Step A: place a named pattern just ahead of the player (for tests and screenshots).
      spawnChunk(id, lead) {
        const c = NP.CHUNKS.find((x) => x.id === id) || (id === "breather" ? NP.BREATHER : null);
        if (!c) return false;
        const built = NP.buildChunk(c, speed, player.x + player.size + (lead == null ? 260 : lead), groundY);
        for (const o of built.obstacles) obstacles.push(o);
        for (const g of built.gems) gems.push({ x: g.x, y: g.y, r: 11, got: false, bob: 0 });
        return built.obstacles.length;
      },
      chunkIds() { return NP.CHUNKS.map((c) => c.id); },
      obstacleTypes() { return obstacles.map((o) => o.type); },
      setScore(n) { distance = n * 8; score = n; },
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
      buyBoost(type, via) { return buyBoost(type, via); },
      setBank(n) { bank = n; persistProgress(); renderShop(); },
      revive() { return claimRevive(); },
      progressSummary() { return progress.summary(); },
      getState() {
        return {
          state, paused, score, coins: coinCount, bank, best,
          speed, shieldTime, magnetTime, slowTime, reduceMotion,
          gemMultiplier, combo, comboMult, reviveUsed, doubleClaimed,
          tutorial, tutorialHold,
          obstacles: obstacles ? obstacles.length : 0,
          gems: gems ? gems.length : 0,
          powerups: powerups ? powerups.length : 0,
          shoeMode: shoeLook().mode,
          boost: boostArmed,
          music: music.getState(),
          player: player ? { x: player.x, y: player.y, vy: player.vy, onGround: player.onGround, jumps: player.jumps, size: player.size } : null,
          groundY,
        };
      },
    };
  }

  init();
})();
