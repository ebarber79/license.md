# Neon Dash: production access answers (ND-032)

Draft 2026-11-15, written from what actually happened. The Testers Community template
(questionnaire report, pasted 2026-11-15) claims a "dynamic walkthrough", "Rate/Share in
settings", ASO work and surveys. None of that was built or done. Don't paste those claims:
Google reviews these answers against the app and the release history.

[FILL] = still open: only the final 14-day numbers in Q3 (re-run report.py first).
Re-run the numbers on Nov 23 with `report.py --days 14` on the VPS before submitting.

## 1. How did you recruit users for your closed test?
I used a paid testing service (Testers Community) to get a group of 15 Android testers,
and I also tested on my own devices as a license tester.

## 2. How easy was it to recruit testers?
Easy (the paid service supplied the testers).

## 3. Describe the engagement you received from testers
All 15 testers stayed opted in for the full test. I added privacy-respecting gameplay
analytics in version 1.6 so I could see how the game was actually played, not just
installed. Over the first 6 days after that went live there were 92 sessions and
17 recorded runs across versions 1.6 to 1.9, with no app errors logged. Testers also
browsed and used the cosmetic shop (skins and shoes) and the gem shop.
[FILL: final 14-day numbers; anything the testers wrote in the TC feedback report.]

## 4. Summary of the feedback, and how you collected it
I collected feedback three ways: the Testers Community feedback reports, an in-app
"Send feedback" link I added to the start screen in version 1.8, and the gameplay
analytics. The analytics showed:
- Runs are very short (average a few seconds) and every run ended on spikes, so the
  opening of a run is harder than intended for new players. Version 1.10 added a guided
  first-run tutorial that pauses at the first spike and teaches each jump.
- Players started gem purchases that failed or were cancelled, which pointed to a
  problem in the purchase flow. Version 1.9 added error reporting for purchases, and a
  test purchase on 1.10 completed and credited the gems.
- Testers Community feedback report (Nov 15): no crashes or bugs found on any device.
  Suggestions: a first-run tutorial, a Rate button, a Share button, an exit
  confirmation on Back, and a clearer store description.

## 5. Intended audience
Casual mobile players who like short, fast arcade games: endless runners with simple
one-tap controls, neon visuals and quick high-score sessions. Rated for a general
audience; not designed for children specifically.

## 6. How does your app provide value to users?
It's a free, quick-to-play endless runner: one-tap controls, a jump/triple-jump
mechanic, power-ups and boosts, and cosmetic skins and shoes to unlock. A run takes
under a minute, so it fits short breaks. Gem packs are optional and cosmetic; the whole
game is playable without paying.

## 7. Installs expected in the first year
0 - 10K (honest for a first game with no marketing budget).

## 8. What changes did you make based on the closed test?
Every change below shipped to the closed track during the test:
- 1.5: Android Back button now behaves correctly; screen locked to portrait.
- 1.6: gameplay analytics (with a privacy policy) to see where players struggle.
- 1.7: fixed how run time is measured (pause and revive no longer counted).
- 1.8: in-app "Send feedback" link on the start screen.
- 1.9: fixes and diagnostics for gem purchases after testers' purchases failed.
- 1.10: a guided first-run tutorial (skippable, and replayable from "How to play"),
  Rate and Share buttons on the start screen, a "Leave Neon Dash?" confirmation on
  Back, and a rewritten store description. These came straight from the testers'
  feedback report.

## 9. How did you decide the app is ready for production?
The app ran for the whole test with no crashes or app errors recorded across seven
releases, all 15 testers stayed opted in, the issues the test surfaced (Back button,
orientation, purchase flow, first-run difficulty) were fixed and shipped to testers, and
the store listing, privacy policy and data safety form are complete.

## 10. What did you do differently this time?
This is my first app on Google Play, so there's no previous attempt. What I did on
purpose this time was ship small updates throughout the test (seven releases in two weeks)
and measure real gameplay instead of guessing, so each fix came from what testers did.
