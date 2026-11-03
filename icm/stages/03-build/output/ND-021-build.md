# ND-021 — Power-ups light up the shoes · build note

Spec: `../02-spec/output/ND-021-spec.md` (approved 2026-11-03). Branch `nd-021-shoe-power`.

## What it does
- `engine.js` `shoePowerStyle()` (pure): mode none/shield/magnet/slowmo/rainbow, the colour,
  end-of-power blink (last 1.5 s, 4/s), reduce-motion = steady + dim, no hue cycling.
- `game.js`:
  - Classic: foot dot → glowing orb (1.6×) with a white core. Retro Kicks: upper takes the
    power colour, stripe turns white with a star sparkle running along it, sole stays white.
  - Shield = slow glow pulse; magnet = bright band sweeping heel→toe; slow-mo = 3 fading
    after-images behind each foot; 2+ powers = rainbow.
  - Coloured light pool on the ground under the feet while powered (added after the first
    look: at phone size the shoes alone read too subtle).
  - Pickup: shoes flash white 0.22 s + 10-spark burst in the power colour.
  - Footfall sparks every ~34 px run while powered and grounded.
  - Legs stay skin-coloured. Shield/magnet/slow-mo rings unchanged.
- Sparks use `Math.random`, not the seeded `rnd()`, so gameplay spawn sequences (and the
  seeded tests) are unchanged.
- `getState().shoeMode` added for tests.

## Tests
- New `tests/unit/shoe-power.test.mjs` (7). Unit total 33/33.
- e2e: 2 new in `gameplay.spec.js` (shield → shoeMode, back to none; Retro + shield 120
  frames, no errors). Full suite 44/44 (Pi, 1 worker).
- QA docs: ND-CORE-21 added to `docs/QA_RELAUNCH_PLAN.md` + `docs/qa_verification_matrix.csv`.

## Open
- Manual playtest (spec criterion 5) on a phone: next Android build.
- Criterion 6 (perf): sparks reuse the existing particle array (no pool exists; same as
  gem bursts). Spot-check on device with the debug APK.
- Not on the web yet. Web deploy = cherry-pick to master (needs the human's OK).
