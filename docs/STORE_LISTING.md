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
Triple-jump over neon spikes, grab gems, and light up your shoes with power-ups.
```
80 characters.

## Full description (max 4000)

```
Tap to jump. Tap again in mid-air to double-jump, and once more to triple-jump. That's all you need to know to start, and it takes a while to master.

Neon Dash is a fast, glowing endless runner. Hop over red spikes, time your jumps past neon bars, and scoop up gems while the world speeds up and the colors shift around you. Every run is a new shot at your best score.

POWER-UPS THAT YOU CAN SEE
• Shield: survive one hit.
• Magnet: pulls nearby gems straight to you.
• Slow-mo: the world slows down so you can thread the tight spots.
Your shoes light up in the power-up's color: teal for shield, gold for magnet, ice blue for slow-mo. Grab two at once and they go rainbow. They blink when it's about to run out, so you're never caught off guard.

BOOST YOUR NEXT RUN
Pick a power-up before you start and begin the run with it already on.

COLLECT AND UNLOCK
• Six runner skins, from Cyan to an animated Rainbow
• Retro Kicks: chunky sneakers you earn by playing
• Gem combos: chain gems without getting hit to multiply what each one is worth

COME BACK DAILY
• Daily streak bonus
• A fresh daily challenge
• Missions with gem rewards

MADE FOR QUICK RUNS
• One-tap controls, instant restarts
• Original synthwave soundtrack that builds as you speed up
• Plays offline
• Smooth on phones

Free to play, with ads. Some are your choice: watch one to continue a run, double your gems, or boost your next run.
```

## Category and tags

- **App category:** Game → Arcade
- **Tags (pick up to 5 in Play Console):** Arcade, Casual, Action, Offline, Single player
- **Search terms to keep in mind:** endless runner, neon, one tap, jump, arcade

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
