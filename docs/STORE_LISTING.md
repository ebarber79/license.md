# Neon Dash — Google Play store listing

Ready to paste into Play Console → Grow users → Store presence → Main store listing.
Rewritten 2026-11-03 (ND-018) for the Android app. Every feature named here is in the
v1.1+ build; gem packs are left out until the gem shop is live (ND-005).

## App name (max 30)

```
Neon Dash: Endless Runner
```
25 characters. Plain "Neon Dash" also works if you prefer it short.

## Short description (max 80)

```
One-tap neon endless runner: triple-jump spikes, grab gems, unlock skins.
```
73 characters. (ND-037, 2026-11-15: leads with the search terms "endless runner" + "one-tap".)

## Full description (max 4000)

ND-037 rewrite (2026-11-15) after the Testers Community ASO note: search terms placed naturally
(endless runner, arcade, one-tap, offline, jump, neon), a scannable feature list, a clear
"who it's for" line, and the new tutorial. Every feature named here is in v11 (1.10).
Nothing about "daily challenges" beyond what exists: daily streak + daily challenge + missions.

```
Neon Dash is a one-tap endless runner for quick arcade runs. Tap to jump, tap again in mid-air to double-jump, and once more to triple-jump. Hop over spikes, slip past neon bars and grab gems while the world speeds up around you.

New to runners? Your first run is a short guided tutorial that pauses at the first spike and shows you each move. You can skip it, or replay it any time from "How to play".

WHO IT'S FOR
Anyone who likes short, fast arcade games: a run takes under a minute, the controls are one finger, and there's always a better score to chase.

FEATURES
• One-tap controls with a triple jump
• Endless runner levels that speed up and change color as you go
• Power-ups you can see on your shoes: Shield, Magnet and Slow-mo
• Boost: start your next run with a power-up already on
• Gem combos: chain gems without getting hit to multiply their value
• Six runner skins, from Cyan to an animated Rainbow, plus Retro Kicks you earn by playing
• Daily streak bonus, a daily challenge and missions with gem rewards
• Original synthwave soundtrack that builds with your speed
• Plays offline, no account needed
• Share the game with friends from the start screen

Free to play with ads. Some ads are your choice: watch one to continue a run, double your gems or boost your next run. Optional gem packs are available as in-app purchases; everything in the game can be earned by playing.
```

## Category and tags

- **App category:** Game → Arcade
- **Tags (pick up to 5 in Play Console):** Arcade, Casual, Action, Offline, Single player
- **Search terms to keep in mind:** endless runner, neon, one tap, jump, arcade, offline runner, triple jump

## Contact and links

- **Website:** https://neondash.gridlas.com/
- **Privacy policy:** https://neondash.gridlas.com/privacy.html
- **Email:** neondash@gridlas.com (only once its forwarding is set up, ND-015; until then use
  your own address)

## Graphics (all in `docs/store/`)

| Play asset | File | Size |
|---|---|---|
| App icon | `play-icon-512.png` | 512×512 |
| Feature graphic | `feature-graphic.png` | 1024×500 |
| Phone screenshot 1 | `screenshots/01-triple-jump.png` | 1080×1920 |
| Phone screenshot 2 | `screenshots/02-power-shoes.png` | 1080×1920 |
| Phone screenshot 3 | `screenshots/03-rainbow.png` | 1080×1920 |
| Phone screenshot 4 | `screenshots/04-boost.png` | 1080×1920 |
| Phone screenshot 5 | `screenshots/05-unlocks.png` | 1080×1920 |

The `screenshots/raw-*.png` files are the same frames without captions (use them if a
portal wants plain gameplay). Regenerate everything with:

```
npm run serve   # in one terminal
PW_CHROMIUM=/usr/bin/chromium node scripts/capture-store-shots.js docs/store
```

## Store-listing facts to keep true

- "Plays offline": the game runs from files bundled in the app. Ads need a connection.
- Ads: rewarded ads are the player's choice; there is also a between-runs interstitial on
  every 3rd Play Again, so the copy says "with ads", not "optional ads".
- Data-safety answers: `icm/stages/06-launch/output/ND-015-data-safety.md`.
