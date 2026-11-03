# ND-023 — Boost: start a run with a power-up (watch an ad, or pay 40 gems)

Asked by the human 2026-11-03: "look into connecting ads for power ups … How can I monetize
this section?" Recommendation (a pre-run Boost) and price (40 gems) agreed in chat the same day.

## Current behavior

Power-ups (shield 7 s, magnet 6 s, slow-mo 5 s) only come from random pickups during a run
(`spawnPowerup`, every 12–20 s). No ad slot and no gem cost are attached to power-ups. Rewarded
ads exist for Revive, Double Gems and the Retro Kicks unlock. Gems have few sinks once the 6
skins are bought.

## Target behavior

A **BOOST** row lets the player arm one power-up for their next run.

```
BOOST NEXT RUN
[🛡 Shield] [🧲 Magnet] [⏱ Slow-mo]
   🎬 FREE · watch ad        ◆ 40
```

1. **Where:** on the start screen (under PLAY) and on the game-over screen (above PLAY AGAIN),
   since most replays go through PLAY AGAIN and never see the start screen.
2. **Pick, then pay:** tap a power-up to select it (one at a time), then either
   - **🎬 FREE · watch ad**: rewarded ad `boost_<type>`; arms only if the ad completes.
     Shown only when `rewardAdsOn()` (ND-022), so never on the plain website.
   - **◆ 40**: takes 40 gems from the bank; disabled with "need 40 ◆" when the bank is short.
3. **Armed:** the row shows "✓ SHIELD READY" (etc.) and the pay buttons hide. One boost at a
   time; it can't be swapped once paid.
4. **Run start:** the armed power-up starts active at full duration (shield 7 s, magnet 6 s,
   slow-mo 5 s), with the ND-021 pickup flash and the shoes lit. Then the boost is used up.
5. **Saved:** an armed boost is stored (`neondash.boost`) so paid gems or a watched ad aren't
   lost if the app is closed before the run.
6. **No ad stacking:** if a boost ad was watched, the next PLAY AGAIN skips its every-3rd-replay
   interstitial.
7. **Analytics:** `boost_armed { type, via: "ad" | "gems" }` and `boost_used { type }`.
8. **Tuning:** `BOOST_GEM_COST = 40` (new constant, in `product.md`).

## What doesn't change

Random power-up pickups, durations, physics, scoring, Revive / Double Gems / Retro Kicks, IAP,
the interstitial rule except point 6.

## Platform scope

Both. Android + CrazyGames: ad and gems. Plain website: gems only (no ad option shown).
Gem shop (ND-005) is separate; Boost just gives gems a reason to be spent.

## Acceptance criteria

1. e2e (`?test=1`): bank 100 → `buyBoost("shield","gems")` → bank 60, `getState().boost ===
   "shield"`; `start()` → `shieldTime > 6.9` and `shoeMode === "shield"`; after start,
   `boost === null`.
2. e2e: bank 30 → gems purchase refused, bank stays 30, ◆ 40 button disabled.
3. e2e: `buyBoost("magnet","ad")` in test mode (stub grants) → armed, bank unchanged;
   `start()` → `magnetTime > 5.9`.
4. e2e: while armed, a second purchase is refused (bank unchanged).
5. e2e: armed boost survives `page.reload()` and is used by the next run.
6. e2e (no `?test=1`, plain web): boost row visible, no "watch ad" button; gem button present.
7. e2e: boost row visible on the game-over screen; layout still passes the ND-020 checks
   (360×640: game-over title on screen, MENU reachable above the sound button).
8. e2e: after an ad boost, PLAY AGAIN on a 3rd replay does not call `commercialBreak`
   (spy via test hook).
9. Manual (Android debug APK, `IS_TESTING=true`): watch the boost ad; shoes light up at run start.

## Tests to add / update

- `tests/e2e/boost.spec.js` (criteria 1–8). `NeonDashTest` gains `buyBoost(type, via)`,
  `setBank(n)`, and `getState().boost`.
- `tests/e2e/layout-and-ads.spec.js`: game-over check covers the new row (criterion 7).

## QA-doc / config drift

- `docs/QA_RELAUNCH_PLAN.md` + `qa_verification_matrix.csv`: add ND-ADS-04 (Boost).
- `icm/_config/product.md`: add `BOOST_GEM_COST` to tuning.
- `docs/MONETIZATION.md`: add the Boost placement.
