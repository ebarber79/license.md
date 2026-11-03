# ND-025 — Reactive synthwave music · build note

Spec: `../02-spec/output/ND-025-spec.md` (approved 2026-11-03). Branch `nd-025-music`.

## What it does
- New `music.js` (pure rules + WebAudio player). A minor, Am–F–C–G, 16 steps/bar,
  look-ahead scheduler (25 ms tick, 120 ms ahead). Layers: pad, bass (menu); + kick (run),
  snare/hats (speed ≥ 600), arp (≥ 850), sparkle (power-up active). Tempo 96 menu,
  110→128 with speed, applied at bar starts. Shared echo on arp + sparkle.
- `game.js`: `music` object (stub if `music.js` missing); attaches on the first tap
  (`audio.ensure()`); modes from startGame / pause / gameOver / quitToMenu / revive;
  `setIntensity(speed, powered)` each update; `getState().music`.
- New 🎵 button (`#music-btn`, left of 🔊). 🎵 = music (`neondash.music`), 🔊 = SFX only.
- `index.html` script tag, `build-www` allowlist, CSS for the button.

## Beyond the spec
- **Music goes silent during ads** (`adRewarded()` / `adBreak()` wrappers call
  `music.hold()`), so it never plays over an ad's own sound.
- **Mix lowered after a real recording.** First pass: kick peaked ≈ −7 dB, louder than the
  SFX (≈ −14 to −18 dB). Now music LEVEL 0.22, kick 0.6 → run peaks −12.5 to −16 dB, menu
  ≈ −25 dB peak.

## Verified
- Unit 38/38 (5 new). e2e 72/72 (4 new × 2 projects + layout test now includes 🎵).
- 44 s recording from headless Chromium (game audio tapped into MediaRecorder): stages
  menu → run (115 BPM, drums) → powered (sparkle) → late (123 BPM, arp) → game over (menu),
  no page errors. Listening copy: `~/Desktop/NeonDash-music-preview.mp3` (+ Drive),
  loudness-normalised for listening.

## Open
- Manual listen on a phone (spec 6) with the next test APK.
- Web deploy = cherry-pick to master (new `music.js` + script tag go with it).
