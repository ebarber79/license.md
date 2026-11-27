/* =========================================================================
 * Neon Dash — obstacle patterns, pacing and shared player physics.
 * Pure (no DOM, no canvas): loaded as a plain script in the browser
 * (window.NeonPatterns) and via require() in Node tests. The same physics and
 * collision code runs in the game and in the solver test that proves every
 * pattern can be cleared at the slowest and fastest world speeds.
 * ========================================================================= */

(function (global) {
  "use strict";

  // ---- Physics constants (single source of truth; game.js reads these) ----
  var GRAVITY = 3800;          // px/s^2
  var JUMP_VELOCITY = -1100;   // px/s (ground jump)
  var AIR_JUMP_SCALE = [0.86, 0.72]; // 2nd and 3rd jump strength
  var PAD_VELOCITY = -1500;    // jump-pad launch
  var COYOTE_SECS = 0.09;      // grace to jump after running off a pit edge
  var PIT_INSET = 10;          // px each side of a pit that still supports you
  var PIT_FALL_DEPTH = 14;     // feet this far below the ground line = fell in

  // ---- Hazard geometry -----------------------------------------------------
  // Every obstacle: { type, x, w, ... , age }. x is the left edge in px.
  //   spikes  { count, spikeW, h }            ground spikes (existing)
  //   bar     { y, h }                        floating bar (existing)
  //   ceiling { gap }                         hangs from the top; bottom at groundY-gap
  //   saw     { r, alt, bob, freq, phase }    spinning saw, centre alt px above ground
  //   pillar  { hMin, hMax, freq, phase }     piston rising and falling from the ground
  //   wall    { h }                           tall block (needs a double jump or a pad)
  //   pit     { }                             gap in the ground
  //   pad     { h }                           jump pad: launches you, never hurts
  var SAW_HIT = 0.62;          // hitbox half-size as a fraction of saw radius

  function sawCenterY(o, groundY) {
    var bob = o.bob ? Math.sin((o.phase || 0) + (o.age || 0) * (o.freq || 3)) * o.bob : 0;
    return groundY - o.alt + bob;
  }
  function pillarHeight(o) {
    var s = 0.5 + 0.5 * Math.sin((o.phase || 0) + (o.age || 0) * (o.freq || 4));
    return o.hMin + (o.hMax - o.hMin) * s;
  }

  function hitRect(px, py, pw, ph, ox, oy, ow, oh) {
    return px < ox + ow && px + pw > ox && py < oy + oh && py + ph > oy;
  }

  // Returns "hit" | "launch" | null for one obstacle against the player.
  // Spikes and bar keep their original forgiving hitboxes exactly.
  function interact(o, p, groundY) {
    var px = p.x, py = p.y, ps = p.size;
    switch (o.type) {
      case "spikes":
        return hitRect(px + 6, py + 6, ps - 12, ps - 6, o.x + 4, groundY - o.h, o.w - 8, o.h) ? "hit" : null;
      case "bar":
        return hitRect(px + 6, py + 4, ps - 12, ps - 8, o.x, o.y, o.w, o.h) ? "hit" : null;
      case "ceiling":
        return hitRect(px + 6, py + 4, ps - 12, ps - 8, o.x, -10000, o.w, 10000 + groundY - o.gap) ? "hit" : null;
      case "saw": {
        var cy = sawCenterY(o, groundY), cx = o.x + o.w / 2, hs = o.r * SAW_HIT;
        return hitRect(px + 6, py + 4, ps - 12, ps - 8, cx - hs, cy - hs, hs * 2, hs * 2) ? "hit" : null;
      }
      case "pillar": {
        var h = pillarHeight(o);
        return hitRect(px + 6, py + 4, ps - 12, ps - 8, o.x + 3, groundY - h, o.w - 6, h) ? "hit" : null;
      }
      case "wall":
        return hitRect(px + 6, py + 4, ps - 12, ps - 8, o.x + 2, groundY - o.h, o.w - 4, o.h) ? "hit" : null;
      case "pad":
        // Only from above, while landing or running: feet inside the pad's top strip.
        if (p.vy >= 0 && hitRect(px + 4, py + ps - 4, ps - 8, 10, o.x, groundY - o.h - 4, o.w, o.h + 8)) return "launch";
        return null;
      default:
        return null; // pits are handled by ground support
    }
  }

  // Is the ground under the player's centre missing (inside a pit)?
  function overPit(obstacles, p) {
    var cx = p.x + p.size / 2;
    for (var i = 0; i < obstacles.length; i++) {
      var o = obstacles[i];
      if (o.type === "pit" && cx > o.x + PIT_INSET && cx < o.x + o.w - PIT_INSET) return true;
    }
    return false;
  }

  // ---- Player physics (shared by game and solver) --------------------------
  // p = { x, y, vy, size, onGround, jumps, coyote }
  // Returns "fell" when the player has dropped into a pit, else null.
  function stepPlayer(p, dt, groundY, obstacles) {
    var noGround = overPit(obstacles, p);
    if (p.onGround && noGround) {           // ran off an edge
      p.onGround = false;
      p.coyote = COYOTE_SECS;
      p.jumps = 0;
    }
    if (!p.onGround && p.coyote > 0) p.coyote = Math.max(0, p.coyote - dt);
    p.vy += GRAVITY * dt;
    var prevBottom = p.y + p.size;
    p.y += p.vy * dt;
    var floor = groundY - p.size;
    if (p.y >= floor) {
      if (!noGround && prevBottom <= groundY + 0.5) {
        p.y = floor;
        p.vy = 0;
        p.onGround = true;
        p.jumps = 0;
        p.coyote = 0;
      } else if (p.y + p.size > groundY + PIT_FALL_DEPTH) {
        return "fell";
      }
    }
    return null;
  }

  // Returns 0 if no jump happened, 1 for a ground (or coyote) jump, 2/3 for air jumps.
  function tryJump(p) {
    if (p.onGround || (p.coyote > 0 && p.jumps === 0)) {
      p.vy = JUMP_VELOCITY;
      p.onGround = false;
      p.coyote = 0;
      p.jumps = 1;
      return 1;
    }
    if (p.jumps === 0) p.jumps = 1;        // fell off an edge: the ground jump is spent
    if (p.jumps < 3) {
      p.vy = JUMP_VELOCITY * AIR_JUMP_SCALE[p.jumps - 1];
      p.jumps += 1;
      return p.jumps;
    }
    return 0;
  }

  function launch(p) {
    p.vy = PAD_VELOCITY;
    p.onGround = false;
    p.coyote = 0;
    p.jumps = 1; // two air jumps still available after a pad
  }

  // ---- Pattern library -----------------------------------------------------
  // Items are placed by time (seconds after the chunk starts reaching the right
  // edge), so spacing scales with speed the same way jump arcs do. Durations
  // (d) of pits and ceilings are also in seconds of travel.
  //   tier: earliest difficulty tier the chunk may appear in.
  var CHUNKS = [
    // Tier 0: teach one hazard at a time.
    { id: "spike1", tier: 0, items: [{ t: 0, type: "spikes", count: 1 }] },
    { id: "spike2", tier: 0, items: [{ t: 0, type: "spikes", count: 2 }] },
    { id: "spike-spike", tier: 0, items: [{ t: 0, type: "spikes", count: 1 }, { t: 0.8, type: "spikes", count: 1 }] },
    { id: "bar", tier: 0, items: [{ t: 0, type: "bar" }] },
    { id: "pit", tier: 0, items: [{ t: 0, type: "pit", d: 0.2 }] },
    { id: "saw-high", tier: 0, items: [{ t: 0, type: "saw", alt: 112 }] },
    // Tier 1: new reads (stay low, double jump, timing).
    { id: "spike3", tier: 1, items: [{ t: 0, type: "spikes", count: 3 }] },
    { id: "ceiling", tier: 1, items: [{ t: 0, type: "ceiling", d: 0.45 }] },
    { id: "spike-ceiling", tier: 1, items: [{ t: 0, type: "spikes", count: 1 }, { t: 0.75, type: "ceiling", d: 0.4 }] },
    { id: "pit-spike", tier: 1, items: [{ t: 0, type: "pit", d: 0.22 }, { t: 0.85, type: "spikes", count: 1 }] },
    { id: "pillar", tier: 1, items: [{ t: 0, type: "pillar", phase: 0 }] },
    { id: "wall", tier: 1, items: [{ t: 0, type: "wall", h: 180 }] },
    { id: "saw-bob", tier: 1, items: [{ t: 0, type: "saw", alt: 55, bob: 30, freq: 3 }] },
    // Tier 2: combinations.
    { id: "pit-pit", tier: 2, items: [{ t: 0, type: "pit", d: 0.2 }, { t: 0.75, type: "pit", d: 0.2 }] },
    { id: "ceiling-spike-ceiling", tier: 2, items: [{ t: 0, type: "ceiling", d: 0.3 }, { t: 0.65, type: "spikes", count: 1 }, { t: 1.35, type: "ceiling", d: 0.3 }] },
    { id: "pad-wall", tier: 2, items: [{ t: 0, type: "pad" }, { t: 0.4, type: "wall", h: 240 }] },
    { id: "pillar-pillar", tier: 2, items: [{ t: 0, type: "pillar", phase: 0 }, { t: 0.7, type: "pillar", phase: Math.PI }] },
    { id: "spike-wall", tier: 2, items: [{ t: 0, type: "spikes", count: 1 }, { t: 0.85, type: "wall", h: 180 }] },
    { id: "saw-low-high", tier: 2, items: [{ t: 0, type: "saw", alt: 30 }, { t: 0.9, type: "saw", alt: 112 }] },
    // Tier 3: gauntlets.
    { id: "gauntlet", tier: 3, items: [{ t: 0, type: "spikes", count: 1 }, { t: 0.7, type: "pit", d: 0.2 }, { t: 1.45, type: "spikes", count: 2 }] },
    { id: "ceiling-pit", tier: 3, items: [{ t: 0, type: "ceiling", d: 0.35 }, { t: 0.7, type: "pit", d: 0.2 }] },
    { id: "pad-wall-spike", tier: 3, items: [{ t: 0, type: "pad" }, { t: 0.4, type: "wall", h: 240 }, { t: 1.4, type: "spikes", count: 2 }] },
    { id: "pillar-pit", tier: 3, items: [{ t: 0, type: "pillar", phase: Math.PI / 2 }, { t: 0.85, type: "pit", d: 0.2 }] },
    { id: "bar-spike-bar", tier: 3, items: [{ t: 0, type: "bar" }, { t: 0.6, type: "spikes", count: 2 }, { t: 1.3, type: "bar" }] },
  ];
  // Breather: no hazards, a gem arc to collect. Spawned every 20-30 s from tier 1.
  var BREATHER = { id: "breather", tier: 0, breather: true, items: [{ t: 0, type: "gems", n: 5, alt: 90 }, { t: 0.9, type: "gems", n: 4, alt: 150 }] };

  // Score thresholds for tiers (score = distance / 8; ~7 s, ~18 s, ~30 s at the default ramp).
  var TIER_SCORES = [0, 400, 1200, 2500];
  function tierForScore(score) {
    var t = 0;
    for (var i = 0; i < TIER_SCORES.length; i++) if (score >= TIER_SCORES[i]) t = i;
    return t;
  }

  // Seconds of travel from a chunk's first item to its end (last item + its length + landing).
  function chunkLength(chunk, speed) {
    var end = 0;
    for (var i = 0; i < chunk.items.length; i++) {
      var it = chunk.items[i];
      var w = itemWidth(it, speed);
      end = Math.max(end, it.t + w / speed);
    }
    return end + 0.25;
  }

  // Gap between chunks: tighter as tiers rise, never below 0.35 s.
  var GAP_BASE = [0.6, 0.5, 0.42, 0.35];
  var GAP_JITTER = 0.25;
  function chunkGap(tier, rng) {
    return GAP_BASE[Math.min(tier, GAP_BASE.length - 1)] + rng() * GAP_JITTER;
  }

  function itemWidth(it, speed) {
    switch (it.type) {
      case "spikes": return 26 * (it.count || 1);
      case "bar": return 34;
      case "ceiling": return Math.round((it.d || 0.4) * speed);
      case "pit": return Math.round((it.d || 0.2) * speed);
      case "saw": return 2 * (it.r || 22);
      case "pillar": return 36;
      case "wall": return 40;
      case "pad": return 44;
      case "gems": return 46 * (it.n || 4);
      default: return 30;
    }
  }

  // Build a chunk at the given speed with its first item at startX.
  // Returns { obstacles: [...], gems: [{x, y}] , length } (length in seconds).
  function buildChunk(chunk, speed, startX, groundY) {
    var obs = [], gems = [];
    for (var i = 0; i < chunk.items.length; i++) {
      var it = chunk.items[i];
      var x = startX + it.t * speed;
      var w = itemWidth(it, speed);
      switch (it.type) {
        case "spikes": obs.push({ type: "spikes", x: x, w: w, h: 34, count: it.count || 1, spikeW: 26, age: 0 }); break;
        case "bar": obs.push({ type: "bar", x: x, w: w, h: 30, y: groundY - 120 - 30, age: 0 }); break;
        case "ceiling": obs.push({ type: "ceiling", x: x, w: w, gap: it.gap || 92, age: 0 }); break;
        case "pit": obs.push({ type: "pit", x: x, w: w, age: 0 }); break;
        case "saw": obs.push({ type: "saw", x: x, w: w, r: it.r || 22, alt: it.alt, bob: it.bob || 0, freq: it.freq || 3, phase: it.phase || 0, age: 0 }); break;
        case "pillar": obs.push({ type: "pillar", x: x, w: w, hMin: it.hMin || 18, hMax: it.hMax || 118, freq: it.freq || 4.2, phase: it.phase || 0, age: 0 }); break;
        case "wall": obs.push({ type: "wall", x: x, w: w, h: it.h || 180, age: 0 }); break;
        case "pad": obs.push({ type: "pad", x: x, w: w, h: 10, age: 0 }); break;
        case "gems": {
          var n = it.n || 4;
          for (var k = 0; k < n; k++) {
            gems.push({ x: x + k * 46, y: groundY - it.alt - Math.sin((k / Math.max(1, n - 1)) * Math.PI) * 50 });
          }
          break;
        }
      }
    }
    return { obstacles: obs, gems: gems, length: chunkLength(chunk, speed) };
  }

  // Pick the next chunk: current-tier chunks weighted 2x, never the same id twice.
  function pickChunk(tier, rng, lastId) {
    var pool = [], weights = [], total = 0;
    for (var i = 0; i < CHUNKS.length; i++) {
      var c = CHUNKS[i];
      if (c.tier > tier || c.id === lastId) continue;
      var wt = c.tier === tier ? 2 : 1;
      pool.push(c); weights.push(wt); total += wt;
    }
    var r = rng() * total;
    for (var j = 0; j < pool.length; j++) {
      r -= weights[j];
      if (r < 0) return pool[j];
    }
    return pool[pool.length - 1];
  }

  // Breather cadence: every 20-30 s of play from tier 1 on.
  function nextBreatherIn(rng) { return 20 + rng() * 10; }

  var NeonPatterns = {
    GRAVITY: GRAVITY, JUMP_VELOCITY: JUMP_VELOCITY, AIR_JUMP_SCALE: AIR_JUMP_SCALE,
    PAD_VELOCITY: PAD_VELOCITY, COYOTE_SECS: COYOTE_SECS,
    CHUNKS: CHUNKS, BREATHER: BREATHER, TIER_SCORES: TIER_SCORES,
    GAP_BASE: GAP_BASE, GAP_JITTER: GAP_JITTER,
    interact: interact, overPit: overPit, stepPlayer: stepPlayer, tryJump: tryJump, launch: launch,
    sawCenterY: sawCenterY, pillarHeight: pillarHeight,
    tierForScore: tierForScore, chunkLength: chunkLength, chunkGap: chunkGap,
    buildChunk: buildChunk, pickChunk: pickChunk, nextBreatherIn: nextBreatherIn,
  };

  if (typeof module === "object" && module.exports) module.exports = NeonPatterns;
  global.NeonPatterns = NeonPatterns;
})(typeof window !== "undefined" ? window : globalThis);
