# ND-020 + ND-022 — build note

Spec skipped for both (small bug fixes, approved in chat 2026-11-03: "yes start with step 1").

Branch `nd-020-022-overflow-webads` (off `mobile-capacitor`).

## ND-020 — overlays overflow on phones
- Before: `.overlay` was `justify-content:center` with no scrolling, and `body` is
  `overflow:hidden`, so content taller than the screen spilled off both ends. Start screen
  was 903/1005/1041px of content on 640/852/915px phones; the title sat 263/155/128px
  above the top, and the bottom (shoes, Best, Privacy choices) was cut off. Game over
  overflowed at 360x640 and the sound button covered MENU & SKINS.
- Fix (`style.css`): overlays scroll (`overflow-y:auto`, `overscroll-behavior:contain`);
  `::before`/`::after` flex spacers centre content when it fits and collapse when it
  doesn't; children don't shrink; bottom padding = sound-button height + safe area.
- After (measured): title at y=22 on all sizes, PLAY above the fold, last item clears the
  sound button after scrolling.

## ND-022 — web gave "watch ad" rewards free
- Before: the plain web build has no ad network; the `ads.js` stub's `rewarded()` returns
  true, so Revive, Double Gems and the Retro Kicks unlock were free on the website.
- Fix (`game.js`): `rewardAdsOn()` = real provider available and not consent-blocked
  (always on in `?test=1`). Revive / Double Gems buttons hide and their claim functions
  refuse when it's off; Retro Kicks shows "🔒 LOCKED" (earn by score 800 / level 6) and its
  hint drops "watch a video". Shoe row re-renders once ads finish initialising, so the app
  shows "🎬 WATCH" as soon as AdMob is ready. Android (AdMob) and CrazyGames unchanged.

## Tests
- New `tests/e2e/layout-and-ads.spec.js` (3 tests × 2 projects). The two layout tests
  fail on the old CSS (checked) and pass now.
- Unit 26/26. Full e2e 40/40 (Pi, `PW_CHROMIUM=/usr/bin/chromium`, 1 worker).

## Not done here
- Not deployed. Pushing to `master` = live site, needs the human's OK.
- Android app needs a new build (versionCode 3) to pick up ND-020 on phones.
