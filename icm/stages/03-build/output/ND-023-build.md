# ND-023 — Boost (start a run with a power-up: ad or 40 gems) · build note

Spec: `../02-spec/output/ND-023-spec.md` (approved 2026-11-03). Branch `nd-023-boost`.

## What it does
- `index.html`: two panels, `#boost-start` (under PLAY) and `#boost-over` (above PLAY AGAIN).
- `game.js`:
  - `BOOST_GEM_COST = 40`, `BOOST_TYPES` (shield / magnet / slowmo), saved as `neondash.boost`.
  - `buyBoost(type, via)`: refuses if armed, busy, bad type; `gems` needs bank ≥ 40;
    `ad` only when `rewardAdsOn()` (ND-022), arms only if the rewarded ad (`boost_<type>`) completes.
  - `useBoost()` in `startGame()` after `reset()`: full duration, shoe flash + ring burst,
    then cleared. Does NOT count toward the "grab N power-ups" mission.
  - PLAY AGAIN skips its every-3rd interstitial once after a boost ad.
  - Analytics: `boost_armed {type, via}`, `boost_used {type}`.
  - Test hooks: `buyBoost`, `setBank`; `getState().boost`.
- `style.css`: boost panel, colour-coded chips (teal/gold/blue = power + shoe colours).

## Also changed (found while building)
- **Reward buttons compacted** (`.btn-reward`: smaller single line). They used PLAY's
  28px font, so "CONTINUE · watch ad" wrapped to two lines. With Boost added, PLAY AGAIN
  bottom with all reward buttons: 360x640 685px (short scroll), 393x852 707, 412x915 732,
  1280x800 771 (fits).
- **Negative first-frame dt clamped** (`loop()`): rAF's timestamp can predate `lastTime`, so
  the first frame ran the sim backwards a few ms (timers ticked up, e.g. magnet 6.05 s).

## Tests
- New `tests/e2e/boost.spec.js` (8 × 2 projects). Unit 33/33. Full e2e 60/60 (Pi).
- Docs: `docs/MONETIZATION.md`, `icm/_config/product.md` (tuning), QA ND-ADS-04.

## Open
- Manual (spec 9): Android debug APK, watch the boost ad, check the shoes at run start.
- Web deploy (gems-only Boost) = cherry-pick to master; needs the human's OK.
