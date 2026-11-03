# ND-021 — Power-ups light up the shoes

Requested by the human 2026-11-03: "I wanted the power ups to be reflected via the
particular shoes that they are running with. I would want fancy colors as they power up."

## Current behavior

`drawPlayer()` in `game.js` draws two neon legs and, at each foot, either a small glowing
dot (Classic) or `drawRetroShoe()` (Retro Kicks: white sole, coloured upper, gold stripe).
Legs and feet always use the skin colour `c1`. Active power-ups show only as a ring/aura
around the body (shield ring, magnet ring); slow-mo has no player effect. Feet are small.

## Target behavior

While a power-up is active, the runner's shoes take on that power-up's colour with an
animated effect. The effect is drawn on the shoes the player is wearing, so it looks
different on Classic and Retro Kicks.

| Power-up | Colour (matches its pickup icon, `POWER_COLORS`) | Effect on the shoes |
|---|---|---|
| Shield | teal `0,255,180` | steady bright glow, slow pulse |
| Magnet | gold `255,216,77` | shimmering gold, colour sweeps heel→toe |
| Slow-mo | ice blue `120,180,255` | cool glow + short fading after-image trail behind each foot |
| Two or more at once | — | **rainbow**: hue cycles continuously through all colours |

- **Pickup flash:** on the frame a power-up is collected, the shoes flash white and emit a
  small spark burst in the power-up colour (reuses the particle system).
- **Sparks while running:** while powered up and on the ground, each footfall throws
  2–3 small sparks in the current shoe colour.
- **Running out:** in the last 1.5 s of the power-up, the shoe colour blinks back to normal
  (about 4 blinks/s) so the player can see it ending.
- **Classic shoes:** the foot dot becomes a bigger glowing orb (≈1.6× radius) in the power colour.
- **Retro Kicks:** the upper takes the power colour; the stripe turns white and sparkles;
  the sole stays white.
- Legs (shins) stay in the skin colour, so the skin is still recognisable.

## What doesn't change

Power-up durations, pickup rates, physics, scoring, collisions, the shield/magnet rings,
shop prices and unlock rules. No new storage keys. No gameplay effect, visual only.

## Platform scope

Both (web + Android): `game.js` canvas rendering only. No native code, no new script tags.

## Reduce motion

With reduce-motion on: colours still change (colour is information), but no hue cycling,
no blinking (show a steady dimmer colour instead in the last 1.5 s), no sparks, no trail.

## Acceptance criteria

1. A pure helper `shoePowerStyle({shieldTime, magnetTime, slowTime, reduceMotion, t})` is
   exported for tests (via `window.NeonDashTest` or `engine.js`) and returns
   `{active, color, mode}` where mode ∈ `none | shield | magnet | slowmo | rainbow`.
   Unit-tested for: no power → `none`; each single power → its mode and colour;
   two powers → `rainbow`; rainbow colour changes between t=0 and t=0.5 unless reduce-motion.
2. Last 1.5 s: for a single power with ≤1.5 s left, the returned colour alternates between
   the power colour and the normal colour over time (unit test samples t); with
   reduce-motion it never alternates.
3. e2e (`?test=1`): start, `giveShield(7)`, step → `getState().shoeMode === "shield"`;
   `giveShield(0)` → `"none"`.
4. e2e: Retro Kicks selected + shield → no console errors over 120 stepped frames.
5. Manual playtest step: pick up each power-up once on Classic and once on Retro Kicks;
   the shoes change colour, flash on pickup, and blink before ending.
6. Frame cost: no new per-frame allocations beyond the existing particle pool (spot check:
   rainbow + sparks for 10 s on the Pi, no visible stutter).

## Tests to add / update

- `tests/unit/` new `shoe-power.test.mjs` (criteria 1–2).
- `tests/e2e/gameplay.spec.js`: criteria 3–4. `getState()` gains `shoeMode`.

## QA-doc drift

`docs/QA_RELAUNCH_PLAN.md` + `docs/qa_verification_matrix.csv`: add a "power-up shoes"
visual check row. Store listing copy (ND-018) mentions the effect.
