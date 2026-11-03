/* =========================================================================
 * Neon Dash — reactive synthwave music (ND-025), generated live with WebAudio.
 * No audio files. Pure helpers (tempo, layers, patterns) are exported for
 * unit tests; create(ctx) builds the player in the browser.
 *
 * Track: A minor, Am–F–C–G, one chord per bar, 16 steps per bar.
 * Menus: pad + bass at 96 BPM. Runs: kick joins, then snare/hats, then a lead
 * arp as speed rises; a sparkle layer plays while a power-up is active.
 * Tempo follows speed (110→128 BPM) and changes only at bar starts.
 * ========================================================================= */
(function (global) {
  "use strict";

  var MENU_BPM = 96, RUN_BPM_MIN = 110, RUN_BPM_MAX = 128;
  var SPEED_MIN = 420, SPEED_MAX = 1100;   // game START_SPEED / MAX_SPEED
  var DRUMS_AT = 600, ARP_AT = 850;        // speed thresholds for layers

  // Chords as MIDI notes (close voicing around A3-E4) + bass roots.
  var CHORDS = [
    { name: "Am", notes: [57, 60, 64], root: 45 },
    { name: "F",  notes: [57, 60, 65], root: 41 },
    { name: "C",  notes: [55, 60, 64], root: 48 },
    { name: "G",  notes: [55, 59, 62], root: 43 },
  ];

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function tempoFor(o) {
    if (!o || o.mode !== "run") return MENU_BPM;
    var f = (clamp(o.speed || SPEED_MIN, SPEED_MIN, SPEED_MAX) - SPEED_MIN) / (SPEED_MAX - SPEED_MIN);
    return Math.round((RUN_BPM_MIN + f * (RUN_BPM_MAX - RUN_BPM_MIN)) * 10) / 10;
  }

  function layersFor(o) {
    if (!o || o.mode === "paused" || o.mode === "off") return [];
    var l = ["pad", "bass"];
    if (o.mode === "run") {
      l.push("kick");
      if ((o.speed || 0) >= DRUMS_AT) l.push("snare", "hats");
      if ((o.speed || 0) >= ARP_AT) l.push("arp");
      if (o.powered) l.push("sparkle");
    }
    return l;
  }

  function chordFor(bar) { return CHORDS[((bar % 4) + 4) % 4]; }

  // Notes a layer plays on one 16th-note step of a bar.
  // Returns [] or a list of { midi, len (steps), vel } (drums: midi null).
  var ARP_SHAPE = [0, 1, 2, 1, 0, 2, 1, 2];
  var SPARKLE_SHAPE = [2, 0, 1, 2, 1, 0, 2, 1];
  function stepEvents(layer, step, bar) {
    var c = chordFor(bar || 0);
    switch (layer) {
      case "kick":  return step % 4 === 0 ? [{ midi: null, len: 1, vel: 1 }] : [];
      case "snare": return step === 4 || step === 12 ? [{ midi: null, len: 1, vel: 1 }] : [];
      case "hats":  return step % 2 === 0 ? [{ midi: null, len: 1, vel: step % 4 === 2 ? 1 : 0.6 }] : [];
      case "bass":  return step % 2 === 0
        ? [{ midi: c.root + (step === 6 || step === 14 ? 12 : 0), len: 1.6, vel: step % 4 === 0 ? 1 : 0.75 }] : [];
      case "pad":   return step === 0 ? c.notes.map(function (m) { return { midi: m, len: 16, vel: 1 }; }) : [];
      case "arp":   return [{ midi: c.notes[ARP_SHAPE[step % 8]] + 12, len: 0.9, vel: step % 4 === 0 ? 1 : 0.7 }];
      case "sparkle": return [{ midi: c.notes[SPARKLE_SHAPE[step % 8]] + 24, len: 0.6, vel: 0.8 }];
      default: return [];
    }
  }

  function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  // ---------------- Browser player ----------------
  function create(opts) {
    opts = opts || {};
    var ctx = null, out = null, delay = null, delayFb = null, noise = null;
    var on = opts.on !== false;
    var mode = "menu";          // menu | run | paused
    var speed = SPEED_MIN, powered = false;
    var held = false;           // true while an ad is on screen
    var bpm = MENU_BPM, step = 0, bar = 0, nextTime = 0, timer = null;
    var LEVEL = opts.level || 0.22; // under the SFX (jump/gem peaks ≈ -14 to -18 dB)
    var LOOKAHEAD = 0.12, TICK_MS = 25;

    function current() { return { mode: mode, speed: speed, powered: powered }; }
    function active() { return on && !held && ctx && mode !== "paused" && !(global.document && global.document.hidden); }

    function build() {
      out = ctx.createGain();
      out.gain.value = 0;
      out.connect(ctx.destination);
      // Shared echo for arp + sparkle (the synthwave shimmer).
      delay = ctx.createDelay(1.5);
      delayFb = ctx.createGain();
      delayFb.gain.value = 0.32;
      var wet = ctx.createGain();
      wet.gain.value = 0.35;
      delay.connect(delayFb).connect(delay);
      delay.connect(wet).connect(out);
      // One second of white noise for drums.
      var len = ctx.sampleRate;
      noise = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = noise.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }

    function env(g, t, peak, attack, dur) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, attack + 0.02));
    }

    function osc(type, freq, t, dur, peak, attack, cutoff, send) {
      var o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      f.type = "lowpass";
      f.frequency.setValueAtTime(cutoff, t);
      env(g, t, peak, attack, dur);
      o.connect(f).connect(g).connect(out);
      if (send) g.connect(delay);
      o.start(t);
      o.stop(t + dur + 0.05);
      return o;
    }

    function noiseHit(t, dur, peak, hp) {
      var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = noise;
      f.type = "highpass";
      f.frequency.value = hp;
      env(g, t, peak, 0.002, dur);
      s.connect(f).connect(g).connect(out);
      s.start(t, Math.random() * 0.5);
      s.stop(t + dur + 0.02);
    }

    function play(layer, ev, t, stepDur) {
      var dur = ev.len * stepDur;
      switch (layer) {
        case "kick": {
          var o = ctx.createOscillator(), g = ctx.createGain();
          o.type = "sine";
          o.frequency.setValueAtTime(150, t);
          o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
          env(g, t, 0.6, 0.003, 0.28);
          o.connect(g).connect(out);
          o.start(t); o.stop(t + 0.3);
          break;
        }
        case "snare": noiseHit(t, 0.18, 0.35, 1200); osc("triangle", 185, t, 0.1, 0.18, 0.002, 2000, false); break;
        case "hats": noiseHit(t, 0.045, 0.1 * ev.vel, 7000); break;
        case "bass": osc("sawtooth", midiToFreq(ev.midi), t, dur, 0.26 * ev.vel, 0.01, 520, false); break;
        case "pad":
          [-7, 7].forEach(function (cents) {
            var p = osc("sawtooth", midiToFreq(ev.midi), t, dur * 0.98, 0.045, 0.35, 1400, false);
            p.detune.value = cents;
          });
          break;
        case "arp": osc("square", midiToFreq(ev.midi), t, dur, 0.06 * ev.vel, 0.005, 2600, true); break;
        case "sparkle": osc("triangle", midiToFreq(ev.midi), t, dur, 0.07 * ev.vel, 0.004, 9000, true); break;
      }
    }

    function scheduleStep(t) {
      if (step === 0) { // tempo + echo time change only at bar starts
        bpm = tempoFor(current());
        if (delay) delay.delayTime.setValueAtTime((60 / bpm) * 0.75, t);
      }
      var stepDur = 60 / bpm / 4;
      var layers = layersFor(current());
      for (var i = 0; i < layers.length; i++) {
        var evs = stepEvents(layers[i], step, bar);
        for (var j = 0; j < evs.length; j++) play(layers[i], evs[j], t, stepDur);
      }
      nextTime = t + stepDur;
      step = (step + 1) % 16;
      if (step === 0) bar++;
    }

    function tick() {
      if (!active()) return;
      while (nextTime < ctx.currentTime + LOOKAHEAD) scheduleStep(Math.max(nextTime, ctx.currentTime));
    }

    function fadeTo(v, secs) {
      if (!out) return;
      var t = ctx.currentTime;
      out.gain.cancelScheduledValues(t);
      out.gain.setValueAtTime(out.gain.value, t);
      out.gain.linearRampToValueAtTime(v, t + secs);
    }

    function refresh() {
      if (!ctx) return;
      if (active()) {
        if (!timer) {
          step = 0;
          nextTime = ctx.currentTime + 0.05;
          timer = setInterval(tick, TICK_MS);
          tick();
        }
        fadeTo(LEVEL, 0.4);
      } else {
        fadeTo(0, 0.15);
        if (timer) { clearInterval(timer); timer = null; }
      }
    }

    if (global.document) global.document.addEventListener("visibilitychange", refresh);

    return {
      attach: function (audioCtx) {
        if (ctx || !audioCtx) return;
        ctx = audioCtx;
        build();
        refresh();
      },
      setOn: function (v) { on = !!v; refresh(); },
      setMode: function (m) {
        if (m === mode) return;
        var wasMenu = mode !== "run";
        mode = m;
        if (m === "run" && wasMenu) bar = 0; // runs start on the Am bar
        refresh();
      },
      setIntensity: function (s, p) { speed = s; powered = !!p; },
      hold: function (v) { held = !!v; refresh(); }, // silence during ads
      getState: function () {
        var st = current();
        return { on: on, mode: mode, bpm: tempoFor(st), layers: on ? layersFor(st) : [] };
      },
    };
  }

  var NeonMusic = {
    tempoFor: tempoFor,
    layersFor: layersFor,
    chordFor: chordFor,
    stepEvents: stepEvents,
    midiToFreq: midiToFreq,
    create: create,
  };
  if (typeof module === "object" && module.exports) module.exports = NeonMusic;
  global.NeonMusic = NeonMusic;
})(typeof window !== "undefined" ? window : globalThis);
