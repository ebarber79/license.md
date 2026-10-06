# Product — what Neon Dash is

Neon endless runner. Tap to jump (up to **triple jump**), dodge spikes, grab gems (◆).
Retention: daily streak, missions (gems / distance / power-ups / runs), skins + shoes bought
with gems. Score = `distance / 8`. Combo scoring.

## Code map

| File | Owns |
|---|---|
| `game.js` | Loop, physics, spawns, collision, render, shop, skins/shoes, QR |
| `engine.js` | Core engine helpers |
| `progress.js` | Missions, streak, daily |
| `ads.js` · `ad-provider.js` · `admob-provider.js` | Ad facade · provider interface · native AdMob (Android only) |
| `iap.js` · `iap-provider.js` | Gem shop · RevenueCat → Play Billing (Android only) |
| `analytics.js` | Events |
| `index.html` · `style.css` · `sw.js` · `manifest.json` | Shell, styling, PWA |

## Tuning (as of 2026-10-06 — `game.js`)

| Constant | Value |
|---|---|
| `GRAVITY` | 3800 px/s² |
| `JUMP_VELOCITY` | -1100 px/s (2nd jump ×0.86, 3rd ×0.72) |
| `START_SPEED` / `MAX_SPEED` / `SPEED_RAMP` | 420 / 1100 / 16 px/s per s |
| `RETRO_SCORE_UNLOCK` / `RETRO_LEVEL_UNLOCK` | 800 / level 6 (level = √(lifetimeGems/40)+1) |

When a stage changes a constant, update this table in the same pass.

## Public identifiers (safe to keep here)

| Item | Value |
|---|---|
| Android appId | `io.github.ebarber79.neondash` |
| AdMob publisher | `ca-app-pub-6072709464334522` |
| AdMob app id | `…~8005681746` · interstitial `/3616110679` · rewarded `/3241274379` |
| Gem packs (consumables) | `neondash.gems.500` · `.1200` · `.3000` · `.7000` |
| app-ads.txt line | `google.com, pub-6072709464334522, DIRECT, f08c47fec0942fa0` |

## Monetization switches

| Switch | Where | Now |
|---|---|---|
| `IS_TESTING` | `admob-provider.js` | `false`: **live ads** |
| `REVENUECAT_ANDROID_API_KEY` | `iap-provider.js` | placeholder `goog_REPLACE…`, so the shop is inert |
