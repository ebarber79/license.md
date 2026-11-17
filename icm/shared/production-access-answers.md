# Neon Dash: production access answers (ND-032)

Single source of truth for the Play "Apply for production" form. Consolidated 2026-11-17 from
the 2026-11-15 draft (current releases + TC feedback), the 2026-11-07 Desktop draft (recruiting
facts) and the watcher's auto-draft (superseded, its facts sheet stopped at v6).
Every sentence below must stay true: Google checks these against the app and release history.
The Testers Community template claims a "dynamic walkthrough", "Rate/Share in settings", ASO work
and surveys. None of that was built or done; don't paste those claims.

## Before you apply (target: Mon Nov 23, 11:00 ET)

- [ ] Play Console > Neon Dash > Dashboard shows 12+ testers opted in for the last 14 days in a
      row (Google's rule for personal accounts). Note the number for Q3.
- [x] v12 (1.11) live on Alpha 2026-11-17 18:27 UTC; 1.11 wording already filled in.
- [ ] Re-run `python3 /root/neondash-events/report.py --days 14` on the VPS and update the Q3
      numbers (snapshot below is from Nov 17).
- [ ] Answer every section and press **Next** on each one; leaving without Next loses answers,
      "Discard" wipes them. Apply is on the last section, and the human clicks it.
- If the form limits answer length, keep the first sentence(s) of each answer; they carry the
  point. Exact question wording is from a third-party guide; use what the live form says.

After applying: review usually takes 7 days or less; Google emails the result (the VPS watcher
forwards Play mail to Telegram). If they ask for more testing, keep the closed test running and
don't remove testers.

## 1. How did you recruit users for your closed test?
I invited friends and family through a Google Group with a one-page sign-up link, then used a
paid testing service (Testers Community) for 15 testers who played over a 16-day run. I also
tested on my own phone as a license tester.

## 2. How easy was it to recruit testers?
Pick: **Difficult**. (True: only 1 tester opted in from my own invites before the paid service.)

## 3. Describe the engagement you received from testers
All 15 Testers Community testers stayed opted in for the test [CONFIRM: Play Dashboard count on
Nov 23]. I added privacy-respecting gameplay analytics in version 1.6 to see how the game was
actually played. Since then there were 163 sessions and 33 recorded runs across versions 1.6 to
1.10, with no app errors logged [REFRESH on Nov 23 with report.py --days 14]. Testers used the
cosmetic shop (skins and shoes), the gem shop, Boost, power-ups and the new tutorial.

## 4. Summary of the feedback, and how you collected it
I collected feedback four ways: the Testers Community feedback reports, an in-app "Send
feedback" link (added in 1.8), my own on-device test checklist, and gameplay analytics.
- Analytics: runs were very short (a few seconds) and most ended on spikes, so the start of a
  run was harder than intended. Version 1.10 added a guided first-run tutorial that pauses at
  the first spike and teaches each jump.
- Analytics also showed gem purchases being started and then failing or being cancelled.
  Version 1.9 added purchase diagnostics, and a test purchase on 1.10 completed and credited
  the gems. Version 1.11 made purchases more robust: one purchase at a time, and an automatic
  retry if Google rejects a purchase made right after cancelling one. A test purchase on 1.11
  also completed.
- Testers Community report (Nov 15): no crashes or bugs on any device. Suggestions: a first-run
  tutorial, a Rate button, a Share button, an exit confirmation on Back, and a clearer store
  description. All five shipped in 1.10.

## 5. Intended audience
Casual mobile players aged 13+ who like short, fast arcade games: one-tap controls, neon
visuals and quick high-score sessions. Not designed for children.

## 6. How does your app provide value to users?
It's a free, quick-to-play endless runner: one-tap jump, double and triple jump, power-ups,
Boost, music that reacts to speed, and cosmetic skins and shoes to unlock. A run takes under a
minute, so it fits short breaks, and it works offline. Gem packs are optional and cosmetic; the
whole game is playable without paying.

## 7. Installs expected in the first year
0 - 10K (honest for a first game with no marketing budget).

## 8. What changes did you make based on the closed test?
Every change below shipped to the closed track during the test:
- 1.5: Android Back button pauses the run; screen locked to portrait (found in my own testing).
- 1.6: gameplay analytics (covered by the privacy policy) to see where players struggle.
- 1.7: fixed how run time is measured (pause and revive no longer counted).
- 1.8: in-app "Send feedback" link on the start screen.
- 1.9: fixes and diagnostics for gem purchases after testers' purchases failed.
- 1.10: from the testers' report: a skippable, replayable first-run tutorial, Rate and Share
  buttons, a "Leave Neon Dash?" confirmation on Back, and a rewritten store description.
- 1.11: more robust gem purchases (one at a time, automatic retry right after a cancel).

## 9. How did you decide the app is ready for production?
The app ran for the whole test with no crashes or app errors recorded, all 15 testers stayed
opted in, the issues the test surfaced (Back button, orientation, purchase flow, first-run
difficulty) were fixed and shipped to testers, and the store listing, privacy policy, terms and
data safety form are complete.

## 10. What did you do differently this time?
This is my first app on Google Play, so there's no previous attempt. What I did on purpose was
ship small updates throughout the test (seven releases, 1.5 to 1.11) and measure real gameplay instead of guessing, so each fix came from what testers
actually did.
