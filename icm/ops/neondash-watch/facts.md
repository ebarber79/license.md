# Neon Dash: verified facts for the production application

Source: icm/shared/tracker.md (2026-11-07). Only these facts, plus what the tester emails and
reports actually say, may go into the draft.

## App
- Name: Neon Dash: Endless Runner. Package io.github.ebarber79.neondash. Game > Arcade. Free.
- One-tap endless runner: tap to jump, tap again for double and triple jump. Neon synthwave look.
- Power-ups: Shield, Magnet, Slow-mo. The runner's shoes glow in the power-up's colour, go rainbow
  when two stack, and blink before one runs out.
- Boost: start a run with a power-up (watch an ad or pay 40 gems).
- Music is generated in code and reacts to speed; separate Music and Sound buttons.
- Six runner skins + Retro Kicks unlock. Gem combos.
- Monetisation: AdMob ads (rewarded continue, double gems, boost; occasional interstitial) and
  4 consumable gem packs ($0.99 / $1.99 / $4.99 / $9.99) via Play Billing + RevenueCat.
- Works offline (game files are bundled in the app; built with Capacitor).
- Audience settings: target ages 13+ (13-15, 16-17, 18+), not child-directed, ad content capped
  at Parental Guidance. Content rating ESRB Everyone / PEGI 3 / IARC 3+.
- No login, no accounts.

## Closed test
- Track: Closed testing - Alpha, all 178 countries.
- Tester groups: neondash-testers@googlegroups.com (own invites: friends/family, one-page sign-up at
  neondash.gridlas.com/test.html) and testers-community@googlegroups.com (Testers Community, paid
  Starter plan: 15 testers, 16-day run, started Nov 7 2026 ~11:20 PM ET).
- Recruiting was hard: only 1 tester had opted in from own invites before the paid service.
- Feedback channels: Testers Community reports, Play private feedback email, own phone test
  checklist.

## Releases during the test
- v4 (1.3) first closed-test build, Nov 4 2026.
- v5 (1.4) Nov 4 2026: gem shop live.
- v6 (1.5) Nov 6 2026: Android Back button pauses the run (again = menu, on menu = exit);
  screen locked to portrait. Found while writing the on-device test checklist (own testing).
- Automated tests: 38 unit tests and 84 end-to-end browser tests pass.

## Not yet known (must stay as [NEEDS: ...] unless a source states it)
- How many testers opted in and how active they were.
- What testers said (bugs, likes, complaints).
- Any v7 fixes.
- Phone test results.
- Play pre-launch report status.
- Expected first-year installs (owner decides).
