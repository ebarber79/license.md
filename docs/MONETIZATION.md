# Neon Dash — Monetization (Game Portal route)

Chosen path: **publish to an HTML5 game portal** that runs the ads and pays a
revenue share. The codebase is now **portal-ready** — gameplay events and a
rewarded "double gems" surface are wired through a portal-agnostic adapter
(`ads.js`), defaulting to a safe stub so local play and CI are unaffected.

> What's done in code vs. what's on you: the integration *hooks* and reward UX
> are built and tested. Creating the developer account, getting SDK access,
> passing portal review, and submitting the build are manual steps only you can do.

## 1. What's already wired

| Surface | Where | Behavior today (stub) | With a real SDK |
|---------|-------|-----------------------|-----------------|
| `gameplayStart` / `gameplayStop` | `startGame()` / `gameOver()` | no-op (logs with `?debug=1`) | tells the portal when a run is active (required by most) |
| Interstitial (commercial break) | every 3rd **Play Again** | resolves instantly | shows a full-screen ad between runs |
| Rewarded — **Revive** (highest ROI) | **▶ Continue** button on game-over (once/run) | auto-grants | shows a rewarded ad; continues the run only if watched |
| Rewarded — **Double Gems** | **🎬 Double Gems** button on game-over | auto-grants (so UX is testable) | shows a rewarded ad; gems double only if watched |

> Gems are banked once per run by `bankRun()` (on Play Again / Menu / Quit /
> tab-hide), applying the double multiplier — never on game-over — so a Revive
> can continue the same run without double-counting.

All of it goes through `window.NeonAds` (see `ads.js`). The reward grants are
analytics-tracked (`reward_granted`) and covered by tests (`ads.test.mjs`,
`ND-ADS-01`).

## 2. Pick a portal

| Portal | Pros | Notes |
|--------|------|-------|
| **CrazyGames** (recommended first) | Great docs, self-serve SDK + local QA tool, rewarded + interstitial | Game runs in their iframe; review required |
| **Poki** | High traffic / payouts | Requires application + approval before SDK access |
| **GameDistribution / GameMonetize** | Open signup, simple HTML5 ad SDK, wide syndication | Lower RPM than the big two |

## 3. Plug in the SDK (one small adapter)

Provide `window.NEONDASH_AD_PROVIDER` **before** `ads.js` loads. Example shape
for **CrazyGames** (verify against their current SDK docs):

```html
<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>
<script>
  window.NEONDASH_AD_PROVIDER = {
    available: true,
    async init() { window.CrazyGames.SDK.init && await window.CrazyGames.SDK.init(); },
    gameplayStart() { window.CrazyGames.SDK.game.gameplayStart(); },
    gameplayStop()  { window.CrazyGames.SDK.game.gameplayStop(); },
    commercialBreak() {
      return window.CrazyGames.SDK.ad.requestAd("midgame").catch(() => {});
    },
    rewarded() {
      return new Promise((resolve) => {
        window.CrazyGames.SDK.ad.requestAd("rewarded", {
          adFinished: () => resolve(true),
          adError:    () => resolve(false),
        });
      });
    },
  };
</script>
```

No game code changes are needed — `ads.js` picks the provider up automatically.

## 4. ⚠️ CSP must allow the portal's origins

The site ships a strict CSP (`script-src 'self'`). Ad SDKs load third-party
scripts/iframes, so **add the portal's origins** to the `<meta>` CSP in
`index.html`. Example for CrazyGames (confirm exact hosts from their docs):

```
script-src 'self' https://sdk.crazygames.com;
frame-src https://*.crazygames.com;
connect-src 'self' https://*.crazygames.com;
img-src 'self' data: https://*.crazygames.com;
```

Keep this change scoped to the chosen portal's domains — don't broaden to `*`.

## 5. ⚠️ Storage in an iframe

Portals embed the game cross-origin, so `localStorage` (best score / gem bank /
skins) is **partitioned per portal** (modern browsers) or, in stricter modes,
unavailable. The code already fails safe via `safeGet`/`safeSet` (defaults, no
crash), but progress won't sync across portals/devices. If you need durable
profiles, use the portal's data API (e.g. CrazyGames user/data module) or add a
backend later.

## 6. Submission checklist

- [ ] Game loads and is fully playable from a single URL, responsive portrait + landscape.
- [ ] No other ad networks or your own analytics beacon active (default build has none — `NEONDASH_ANALYTICS_URL` unset).
- [ ] Portal SDK integrated; `gameplayStart/Stop` fire; rewarded + interstitial tested with the portal's QA tool.
- [ ] CSP updated for the portal's domains (§4); verify no console CSP violations in their iframe.
- [ ] Loading/branding rules met; remove the scan-to-play QR if the portal disallows external links.
- [ ] Reasonable ad frequency (interstitial cadence currently every 3rd replay — tune per portal policy).
- [ ] Create developer account, upload build / submit URL, fill metadata, pass review.

## 7. Other routes (for later)

- **Native app + store IAP** (Capacitor/TWA → Play/App Store + AdMob + IAP): highest ceiling; the gem shop becomes real IAP.
- **Web IAP** (Stripe + small backend): sell gem packs directly; needs server + accounts for durable entitlements.
