# ND-025 — Reactive synthwave music

Asked by the human 2026-11-03 ("think you can add music"). Choices made in chat:
style **Synthwave**, behavior **Reactive** (calm on menus, builds during a run, power-up
layer, separate Music and Sound buttons).

## Current behavior

No music. Sound effects are synthesized in `game.js` (`audio.tone()`: jump, coin, power,
shield break, crash) through one WebAudio context, unlocked on the first tap
(`audio.ensure()`). One 🔊 button mutes all sound (`neondash.muted`).

## Target behavior

An original synthwave track, generated live with WebAudio (no audio files, no licensing,
nothing to download).

**Music.** Key A minor, chords Am–F–C–G (one per bar, 16 steps per bar), looping.

| Layer | Sound | Plays when |
|---|---|---|
| pad | soft detuned saw chords, low-passed | menus + runs |
| bass | pulsing 8th-note root notes | menus (quiet) + runs |
| kick | four-on-the-floor | runs |
| snare + hats | backbeat + 8th-note hats | runs, once speed ≥ 600 (≈ a few seconds in) |
| lead arp | bright 16th-note arpeggio | runs, once speed ≥ 850 |
| sparkle | high shimmering arpeggio | while any power-up is active |

**Reactive.**
- Tempo: 96 BPM on menus. During a run it follows speed: 110 BPM at start speed (420)
  rising to 128 BPM at max speed (1100). Changes apply at bar boundaries (no glitching).
- Game over: drums cut, the mix drops to the menu loop.
- Pause or app in background: music stops; resumes with the run.
- Revive: picks back up at the run's current intensity.

**Controls.** A new 🎵 button sits left of the 🔊 button (both bottom-right).
🎵 = music on/off (`neondash.music`, default on). 🔊 = sound effects only (existing key).
Both remembered across launches. Music starts on the first tap (browsers require a tap
before audio).

**Mix.** Music sits under the sound effects (music bus ≈ 35% of SFX level) so jumps and
gems stay clear.

## What doesn't change

Gameplay, sound effects themselves, ads, Boost, shoes, scoring. No new network requests.

## Platform scope

Both. New file `music.js` (pure scheduling + synth voices) loaded before `game.js`:
added to `index.html` (web + app), to the `build-www` allowlist, and cherry-picked to
`master` like the other web changes. CSP unaffected (`'self'`).

## Acceptance criteria

1. Unit (`music.js`, pure helpers): `tempoFor({mode, speed})` → 96 on menu; 110 at speed
   420; 128 at 1100; clamped outside. `layersFor({mode, speed, powered})` → menu
   `[pad, bass]`; run at 420 `[pad, bass, kick]`; at 600 adds `snare, hats`; at 850 adds
   `arp`; powered adds `sparkle`. `stepEvents(layer, step)`: kick on steps 0/4/8/12,
   snare on 4/12; chord for bar n cycles Am, F, C, G.
2. e2e (`?test=1`): `getState().music` reports `{ on, mode, bpm, layers }`; menu → mode
   `menu`; after `start()` → mode `run` and `kick` in layers; `giveShield(7)` + step →
   `sparkle` in layers; game over → mode `menu`.
3. e2e: 🎵 toggles `music.on` and persists across reload; 🔊 does not change `music.on`
   (and 🎵 does not change SFX mute).
4. e2e: pause → `music.mode === "paused"`; resume → `run`.
5. e2e: layout — 🎵 and 🔊 don't overlap each other or the pause button at 360×640; the
   ND-020 checks still pass (last item scrolls clear of both buttons).
6. Manual (phone, test APK): music plays after the first tap, builds during a run, sparkle
   on power-up, no crackle or stutter, SFX still clearly audible, 🎵/🔊 work separately.

## Tests to add / update

- `tests/unit/music.test.mjs` (criterion 1).
- `tests/e2e/music.spec.js` (2–4); `layout-and-ads.spec.js` (5).
- `getState().music` + `NeonDashTest` hooks as needed.

## QA-doc / config drift

QA plan + matrix: ND-AUD-01 (music). `product.md` code map: add `music.js`.
Store listing (ND-018): can add "Original synthwave soundtrack that builds as you speed up"
once it ships.
