# ND-001 — build note

**Item:** commit + push the uncommitted gem-shop WIP. Skipped 02: no new behavior, it's existing work.
**Branch:** `mobile-capacitor` · **Date:** 2026-10-06

## What was committed

| Area | Files |
|---|---|
| Gem shop (IAP, Android only) | `iap.js`, `iap-provider.js` (new) · `index.html` (gem-shop panel, script tags) · `scripts/build-www.mjs` (allowlist) |
| Native plugins | `package.json` / `package-lock.json` (+`@capacitor-community/admob`, `@revenuecat/purchases-capacitor`) · `android/capacitor.settings.gradle`, `android/app/capacitor.build.gradle` (`cap sync` output) |
| July gameplay (already live on web as Pages `d3e43ea`, never committed here) | `game.js` (rebalance, triple jump, running legs, shoes/Retro Kicks) · `style.css` · `engine.js` (score = distance/8) · `index.html` tagline |
| Hygiene | `.gitignore` (+`.aider*`) |
| Tests | `tests/unit/engine.test.mjs`, updated to the shipped /8 score rule (was stale at /10) |
| Tracking | `icm/` workspace (new) |

**Not committed:** `dist/neon-dash-debug.apk` (build artifact, guardrails §6).

## Results

- Unit: **18/18 pass**. One stale test was updated, not the code.
- Secret scan of the diff + new files: clean (RevenueCat key is still the `goog_REPLACE…` placeholder).
- e2e **not run** in this pass. The 04-verify job expects at least one failure: the e2e/QA
  expectations predate the triple jump (see ND-008).

## Surprises

- The web Pages branch had the July gameplay commit, but `mobile-capacitor` only had it as
  uncommitted changes. They're now on the same code.
