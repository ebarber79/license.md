# CrazyGames integration

Drop-in adapter so Neon Dash's `NeonAds` layer uses CrazyGames ads. No game
code changes — `ads.js` auto-detects `window.NEONDASH_AD_PROVIDER`.

## Quick build (recommended)

```bash
node scripts/build-portal.mjs crazygames   # -> dist/crazygames.zip
```

This generates the CrazyGames build with everything below already applied (SDK +
adapter tags injected, CSP swapped, service worker + QR removed). The manual
steps below document what it does, if you prefer to wire it yourself.

## 1. Add the scripts to `index.html`

Copy `ad-provider.crazygames.js` next to the other JS files, then add these
**before** the existing `analytics.js`/`ads.js`/`game.js` tags:

```html
<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>
<script src="ad-provider.crazygames.js"></script>
```

> Confirm the exact SDK script URL on your CrazyGames developer dashboard — they
> occasionally bump the version path.

## 2. Update the CSP `<meta>` in `index.html`

Add the CrazyGames origins (keep everything else):

```
script-src 'self' https://sdk.crazygames.com;
frame-src https://*.crazygames.com https://*.crazygames.games;
connect-src 'self' https://*.crazygames.com;
img-src 'self' data: https://*.crazygames.com;
```

(If their QA tool reports a blocked domain, add exactly that origin — don't widen to `*`.)

## 3. Test

- Use the **CrazyGames QA tool** (in their docs) to verify `gameplayStart/Stop`,
  a midgame ad on Play Again, and the rewarded **Continue / Double Gems**.
- The reward fires on the SDK's `adFinished` callback; `adError` (e.g. no fill)
  resolves to "no reward", and the button re-enables — already handled.

## Mapping

| NeonAds call | CrazyGames SDK |
|--------------|----------------|
| `gameplayStart()` / `gameplayStop()` | `SDK.game.gameplayStart()` / `gameplayStop()` |
| `commercialBreak()` | `SDK.ad.requestAd("midgame", …)` |
| `rewarded()` | `SDK.ad.requestAd("rewarded", …)` → `adFinished` = reward |

## Notes

- **Service worker:** consider removing `register-sw.js` for the CrazyGames build
  (the game runs in their iframe; SW in a third-party frame is restricted).
- **QR code:** CrazyGames disallows external links — remove the `#qr-box` block
  from `index.html` for this build.
