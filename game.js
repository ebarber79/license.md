/* =========================================================================
 * NEON DASH — an HTML5 Canvas endless runner
 * Tap / click / space to jump. A second tap in mid-air = double jump.
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

  // ---- Audio (synthesized, no asset files) ----
  const audio = {
    ctx: null,
    muted: localStorage.getItem("neondash.muted") === "1",
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
    localStorage.setItem("neondash.muted", audio.muted ? "1" : "0");
    updateMuteUI();
  });

  // ---- World constants (in CSS pixels) ----
  const GROUND_RATIO = 0.82;   // ground line as fraction of height
  const GRAVITY = 2600;        // px/s^2
  const JUMP_VELOCITY = -920;  // px/s
  const PLAYER_X_RATIO = 0.22; // player horizontal position
  const PLAYER_SIZE = 46;
  const START_SPEED = 360;     // px/s
  const MAX_SPEED = 900;
  const SPEED_RAMP = 11;       // px/s gained per second
  const SHIELD_DURATION = 7;   // seconds of protection per shield pickup
  const HIGH_SCORE_KEY = "neondash.best";

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
  let shieldTime = 0; // seconds of shield remaining
  let best = loadBest();
  let lastTime = 0;
  let shake = 0;

  function loadBest() {
    const v = parseInt(localStorage.getItem(HIGH_SCORE_KEY) || "0", 10);
    return Number.isFinite(v) ? v : 0;
  }
  function saveBest(v) {
    try { localStorage.setItem(HIGH_SCORE_KEY, String(v)); } catch (e) { /* ignore */ }
  }

  // ---- Background layers (built once, scroll independently) ----
  function buildBackground() {
    stars = [];
    for (let i = 0; i < 70; i++) {
      stars.push({
        x: Math.random(),
        y: Math.random() * 0.7,
        r: Math.random() * 1.6 + 0.4,
        tw: Math.random() * Math.PI * 2,
      });
    }
    hills = [];
    let x = 0;
    while (x < 1.4) {
      hills.push({ x, h: 0.10 + Math.random() * 0.16, w: 0.18 + Math.random() * 0.14 });
      x += 0.16 + Math.random() * 0.12;
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
    spawnTimer = 0.8;
    gemTimer = 1.4;
    powerTimer = 7 + Math.random() * 4;
    shieldTime = 0;
    shake = 0;
    bgScroll = 0;
  }

  // ---- Input ----
  function jump() {
    if (state !== STATE.PLAYING) return;
    if (player.onGround) {
      player.vy = JUMP_VELOCITY;
      player.onGround = false;
      player.jumps = 1;
      spawnJumpDust();
      audio.jump();
    } else if (player.jumps < 2) {
      player.vy = JUMP_VELOCITY * 0.86;
      player.jumps = 2;
      spawnJumpDust();
      audio.doubleJump();
    }
  }

  function onPress(e) {
    // Don't hijack taps on UI buttons.
    if (e.target.closest(".btn") || e.target.closest(".icon-btn")) return;
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
  restartBtn.addEventListener("click", () => startGame());

  function startGame() {
    resize();
    buildBackground();
    reset();
    state = STATE.PLAYING;
    startScreen.classList.add("hidden");
    gameoverScreen.classList.add("hidden");
    hud.classList.remove("hidden");
    bestEl.textContent = best;
    updateMuteUI();
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  function gameOver() {
    state = STATE.OVER;
    const newRecord = score > best;
    if (newRecord) { best = score; saveBest(best); }
    finalScoreEl.textContent = score;
    finalCoinsEl.textContent = coinCount;
    finalBestEl.textContent = best;
    newRecordEl.classList.toggle("hidden", !newRecord);
    hud.classList.add("hidden");
    gameoverScreen.classList.remove("hidden");
  }

  // ---- Spawning ----
  function spawnObstacle() {
    // Either ground spikes (1-3) or a floating bar to duck/jump-time.
    const r = Math.random();
    if (r < 0.78) {
      const count = 1 + Math.floor(Math.random() * 3);
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
    const n = 3 + Math.floor(Math.random() * 3);
    const baseY = groundY - 70 - Math.random() * 120;
    for (let i = 0; i < n; i++) {
      gems.push({
        x: W + 40 + i * 46,
        y: baseY - Math.sin((i / (n - 1)) * Math.PI) * 60,
        r: 11,
        got: false,
        bob: Math.random() * Math.PI * 2,
      });
    }
  }

  function spawnPowerup() {
    powerups.push({
      type: "shield",
      x: W + 50,
      y: groundY - 90 - Math.random() * 100,
      r: 16,
      bob: Math.random() * Math.PI * 2,
      spin: 0,
    });
  }

  // ---- Particles ----
  function spawnJumpDust() {
    for (let i = 0; i < 8; i++) {
      particles.push({
        x: player.x + player.size / 2,
        y: player.y + player.size,
        vx: (Math.random() - 0.5) * 160,
        vy: Math.random() * -120 - 20,
        life: 0.4,
        max: 0.4,
        color: "0,245,255",
        r: Math.random() * 3 + 1,
      });
    }
  }
  function spawnGemBurst(x, y) {
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = Math.random() * 200 + 50;
      particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.5,
        max: 0.5,
        color: "255,216,77",
        r: Math.random() * 3 + 1.5,
      });
    }
  }
  function spawnCrash() {
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = Math.random() * 320 + 60;
      particles.push({
        x: player.x + player.size / 2,
        y: player.y + player.size / 2,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.7,
        max: 0.7,
        color: "255,77,109",
        r: Math.random() * 4 + 2,
      });
    }
  }

  function spawnShieldBurst() {
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
        color: "0,255,180",
        r: Math.random() * 3 + 1.5,
      });
    }
  }

  // ---- Collision (AABB) ----
  function hits(px, py, pw, ph, ox, oy, ow, oh) {
    return px < ox + ow && px + pw > ox && py < oy + oh && py + ph > oy;
  }

  // ---- Update ----
  function update(dt) {
    // Difficulty ramp
    speed = Math.min(MAX_SPEED, speed + SPEED_RAMP * dt);
    distance += speed * dt;
    score = Math.floor(distance / 10);
    scoreEl.textContent = score;
    bgScroll += speed * dt;

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
      const base = Math.max(0.7, 1.6 - (speed - START_SPEED) / 900);
      spawnTimer = base + Math.random() * 0.6;
    }
    // Spawn gems
    gemTimer -= dt;
    if (gemTimer <= 0) {
      spawnGemArc();
      gemTimer = 1.6 + Math.random() * 1.8;
    }
    // Spawn shield power-ups (rare)
    powerTimer -= dt;
    if (powerTimer <= 0) {
      spawnPowerup();
      powerTimer = 12 + Math.random() * 8;
    }
    // Countdown active shield
    if (shieldTime > 0) shieldTime = Math.max(0, shieldTime - dt);

    // Move + test obstacles
    const px = player.x, py = player.y, ps = player.size;
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      o.x -= speed * dt;
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
          shieldTime = 0;
          shake = 10;
          audio.shieldBreak();
          spawnShieldBurst();
          obstacles.splice(i, 1);
        } else {
          return crash();
        }
      }
    }

    // Move + collect power-ups
    for (let i = powerups.length - 1; i >= 0; i--) {
      const pu = powerups[i];
      pu.x -= speed * dt;
      pu.bob += dt * 4;
      pu.spin += dt * 3;
      if (pu.x + pu.r < -10) { powerups.splice(i, 1); continue; }
      if (hits(px, py, ps, ps, pu.x - pu.r, pu.y - pu.r, pu.r * 2, pu.r * 2)) {
        shieldTime = SHIELD_DURATION;
        audio.power();
        spawnShieldBurst();
        powerups.splice(i, 1);
      }
    }

    // Move + collect gems
    for (let i = gems.length - 1; i >= 0; i--) {
      const g = gems[i];
      g.x -= speed * dt;
      g.bob += dt * 4;
      if (g.x + g.r < -10) { gems.splice(i, 1); continue; }
      if (!g.got && hits(px, py, ps, ps, g.x - g.r, g.y - g.r, g.r * 2, g.r * 2)) {
        g.got = true;
        coinCount++;
        coinsEl.textContent = coinCount;
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
    if (!stars) buildBackground();
    drawSky();
    drawGround();
  }

  function drawSky() {
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
    ctx.fillStyle = "rgba(80, 40, 120, 0.5)";
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
  }

  function drawGround() {
    // Ground slab
    ctx.fillStyle = "#14142e";
    ctx.fillRect(0, groundY, W, H - groundY);
    // Neon ground line
    ctx.strokeStyle = "#00f5ff";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#00f5ff";
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(W, groundY);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Scrolling grid lines for motion feel
    ctx.strokeStyle = "rgba(0, 245, 255, 0.18)";
    ctx.lineWidth = 2;
    const spacing = 60;
    const off = bgScroll % spacing;
    for (let x = -off; x < W; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x, groundY);
      ctx.lineTo(x - 40, H);
      ctx.stroke();
    }
  }

  function drawPlayer() {
    // Trail
    for (let i = player.trail.length - 1; i >= 0; i--) {
      const t = player.trail[i];
      const a = (1 - i / player.trail.length) * 0.25;
      ctx.globalAlpha = a;
      ctx.fillStyle = "#00f5ff";
      ctx.fillRect(t.x, t.y, player.size, player.size);
    }
    ctx.globalAlpha = 1;

    const cx = player.x + player.size / 2;
    const cy = player.y + player.size / 2;

    // Shield aura (flashes when about to expire)
    if (shieldTime > 0) {
      const flashing = shieldTime < 1.5 && Math.floor(shieldTime * 8) % 2 === 0;
      ctx.globalAlpha = flashing ? 0.3 : 0.7;
      ctx.strokeStyle = "#00ffb4";
      ctx.lineWidth = 3;
      ctx.shadowColor = "#00ffb4";
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(cx, cy, player.size * 0.85, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(player.rot);
    ctx.shadowColor = "#00f5ff";
    ctx.shadowBlur = 18;
    // Body
    const s = player.size;
    const grad = ctx.createLinearGradient(-s / 2, -s / 2, s / 2, s / 2);
    grad.addColorStop(0, "#7afcff");
    grad.addColorStop(1, "#0091ff");
    ctx.fillStyle = grad;
    roundRect(ctx, -s / 2, -s / 2, s, s, 8);
    ctx.fill();
    ctx.shadowBlur = 0;
    // Eye
    ctx.fillStyle = "#0d0d1a";
    ctx.fillRect(s * 0.08, -s * 0.18, s * 0.22, s * 0.22);
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

  function drawPowerups() {
    for (const pu of powerups) {
      const yy = pu.y + Math.sin(pu.bob) * 5;
      ctx.save();
      ctx.translate(pu.x, yy);
      ctx.shadowColor = "#00ffb4";
      ctx.shadowBlur = 18;
      // Outer ring
      ctx.strokeStyle = "#00ffb4";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, pu.r, 0, Math.PI * 2);
      ctx.stroke();
      // Inner shield glyph
      ctx.rotate(pu.spin);
      ctx.fillStyle = "rgba(0, 255, 180, 0.85)";
      ctx.beginPath();
      ctx.moveTo(0, -pu.r * 0.55);
      ctx.lineTo(pu.r * 0.5, -pu.r * 0.15);
      ctx.lineTo(pu.r * 0.5, pu.r * 0.25);
      ctx.lineTo(0, pu.r * 0.6);
      ctx.lineTo(-pu.r * 0.5, pu.r * 0.25);
      ctx.lineTo(-pu.r * 0.5, -pu.r * 0.15);
      ctx.closePath();
      ctx.fill();
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
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }
    drawSky();
    drawGround();
    drawObstacles();
    drawGems();
    drawPowerups();
    if (state === STATE.PLAYING) drawPlayer();
    drawParticles();
    ctx.restore();
  }

  // ---- Main loop ----
  function loop(now) {
    let dt = (now - lastTime) / 1000;
    lastTime = now;
    if (dt > 0.05) dt = 0.05; // clamp after tab-switch / hiccups

    if (state === STATE.PLAYING) {
      update(dt);
      render();
      requestAnimationFrame(loop);
    } else if (state === STATE.OVER) {
      // Keep particles/shake animating briefly on the game-over backdrop.
      update0Effects(dt);
      render();
      if (particles.length > 0 || shake > 0) requestAnimationFrame(loop);
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

  // ---- Boot ----
  function init() {
    resize();
    buildBackground();
    best = loadBest();
    startBestEl.textContent = best;
    bestEl.textContent = best;
    updateMuteUI();
    drawStaticBackdrop();
    // Gentle idle animation on the menu backdrop.
    (function idle() {
      if (state === STATE.MENU) {
        bgScroll += 0.5;
        for (const s of stars) s.tw += 0.02;
        drawStaticBackdrop();
        requestAnimationFrame(idle);
      }
    })();
  }

  init();
})();
