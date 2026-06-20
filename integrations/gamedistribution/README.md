# GameDistribution integration

Drop-in adapter so Neon Dash's `NeonAds` layer uses GameDistribution ads.

## Quick build (recommended)

```bash
node scripts/build-portal.mjs gamedistribution   # -> dist/gamedistribution.zip
```

This generates the GameDistribution build with everything below already applied
(adapter + SDK tags injected, CSP removed, service worker + QR removed). You
**still** need to set your Game ID (step 1) before building. The manual steps
below document what the script does, if you prefer to wire it yourself.

## 1. Set your game id

In `ad-provider.gamedistribution.js`, replace `REPLACE_WITH_YOUR_GAMEDISTRIBUTION_GAME_ID`
with the **Game ID** from your GameDistribution dashboard, and **enable the
"rewarded ads" flag** for the game there (otherwise rewarded requests fail).

## 2. Add the scripts to `index.html`

Copy `ad-provider.gamedistribution.js` next to the other JS files. Add these
**before** `analytics.js`/`ads.js`/`game.js` — the adapter sets `GD_OPTIONS`,
so it must come **before** the SDK script:

```html
<script src="ad-provider.gamedistribution.js"></script>
<script src="https://html5.api.gamedistribution.com/main.min.js"></script>
```

## 3. CSP — important caveat

GameDistribution serves **programmatic ads from many third-party partners** whose
domains change frequently. A strict `script-src 'self'` CSP will block them, and
maintaining an allowlist is impractical.

Recommended for the GD build:
- GD typically **hosts your uploaded build inside its own iframe** and manages the
  ad page, so the simplest path is to **remove the `<meta>` CSP** from the GD
  build's `index.html` (or relax it substantially). Keep the strict CSP on your
  own GitHub Pages build; use a separate, relaxed copy for the GD upload.

## Mapping

| NeonAds call | GameDistribution SDK |
|--------------|----------------------|
| `commercialBreak()` | `gdsdk.showAd("interstitial")` |
| `rewarded()` | `gdsdk.showAd("rewarded")` → resolve = reward, reject = skip |
| `gameplayStart()` / `gameplayStop()` | no-op (GD pauses via `GD_OPTIONS.onEvent`) |

## Notes

- Only request ads on **direct user input** (the Continue / Double Gems taps
  already are) — browsers block ads otherwise.
- **Service worker / QR:** same as CrazyGames — drop `register-sw.js` and the
  `#qr-box` for the portal build.
