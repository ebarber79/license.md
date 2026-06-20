# Neon Dash — launch checklist (portal route)

Status legend: ✅ done in repo · 🔲 your manual step · ⚙️ optional

## Phase 1 — Build readiness (mostly done)
- ✅ Game feature-complete, responsive, plays in any modern browser.
- ✅ Monetization hooks wired behind `ads.js` (revive, double-gems, interstitial, gameplay events).
- ✅ Retention loop (daily streak, daily challenge, missions).
- ✅ Drop-in portal adapters: `integrations/crazygames/`, `integrations/gamedistribution/`.
- ✅ Packaging: `bash scripts/build-dist.sh` → `dist/neon-dash.zip`.
- ✅ Store copy: `docs/STORE_LISTING.md`.
- 🔲 Capture thumbnail + 2–4 screenshots (+ optional GIF) — see store-listing doc.
- ⚙️ For portal builds: remove `register-sw.js` + `#qr-box`; relax CSP per portal README.

## Phase 2 — CrazyGames
- 🔲 Create a CrazyGames **developer account**.
- 🔲 Wire `integrations/crazygames/` (SDK script + adapter + CSP origins).
- 🔲 Test with the **CrazyGames QA tool** (gameplay events + midgame + rewarded).
- 🔲 Build a CrazyGames copy (drop SW/QR), zip, upload, fill listing, submit for review.

## Phase 2 — GameDistribution
- 🔲 Create a **GameDistribution** account; create the game to get a **Game ID**; enable the **rewarded** flag.
- 🔲 Set the Game ID in `ad-provider.gamedistribution.js`; wire scripts (adapter before SDK).
- 🔲 Use a **relaxed/removed CSP** for the GD build (programmatic ad partners).
- 🔲 `build-dist.sh` → upload zip → fill listing → submit.

## Phase 3 — Live & iterate (first 2 weeks)
- 🔲 Watch portal analytics: **impressions, RPM/eCPM, rewarded completion, CTR, D1 retention, avg session**.
- 🔲 Tune **ad frequency** (interstitial cadence is every 3rd Play Again — adjust to portal policy/feedback).
- 🔲 Tune **difficulty curve** if early drop-off is high (constants at top of `game.js`).
- ⚙️ Add a **leaderboard** (portal SDK or tiny backend) once retention looks healthy.
- ⚙️ Consider a **native wrapper (TWA/Capacitor) + AdMob/IAP** only after portal metrics justify paid UA.

## Compliance quick-checks
- 🔲 No other ad networks / analytics beacon active in the portal build (default has none; `NEONDASH_ANALYTICS_URL` unset).
- 🔲 Ads only fire on direct user input (Continue / Double Gems taps — already true).
- 🔲 Loading is fast; no console errors in the portal's QA iframe.
- 🔲 Listing metadata + age rating + thumbnail meet each portal's spec.

## Reality check on revenue
A polished but single-mechanic runner typically earns **modest** amounts; the
levers that matter most are **retention** and **breadth of placement**. Lead with
CrazyGames + GameDistribution, lean on the daily loop to grow sessions, and treat
revenue as a function of (players × sessions × impressions) — not the ad network.
