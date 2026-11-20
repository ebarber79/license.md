# Neon Dash: launch checklist

Seeded 2026-10-06, rewritten 2026-11-20 for the **live-before-Christmas plan**.
Tick with a date when confirmed. Tracker IDs in brackets.

## Phases 0-2: done

- [x] Keystore file + password backed up off the VPS [ND-002]
- [x] Play developer account (personal), app `io.github.ebarber79.neondash` created [ND-003]
- [x] AdMob real ad units, UMP consent, payments/tax + Play payout bank verified [ND-006, ND-014]
- [x] Developer site + `app-ads.txt` published (AdMob crawls only after the listing is public) [ND-007]
- [x] Gem packs live on Play billing; phone purchase verified on 1.11 [ND-005]
- [x] Store listing, icon, screenshots, privacy policy, ToS, data safety, content rating [ND-013, ND-015, ND-018]
- [x] Closed testing - Alpha: v12 (1.11) live 2026-11-17; Testers Community 15 testers [ND-028]

## Phase 3a: apply (Nov 21-23)

- [ ] Sat Nov 21: Play Dashboard opt-in count is 12+ for 14 days straight (human reads it) [ND-032]
- [ ] Sat-Sun: own testers play a few real runs (`~/Desktop/NeonDash-TESTER-PLAY-MESSAGE.txt`, human sends)
- [ ] Sun Nov 22: "refresh the production answers" (`report.py --days 14` + opt-in count) [ND-032]
- [ ] Mon Nov 23: apply for production; human clicks Apply [ND-032]
- [ ] Ask Testers Community what happens after day 16 / on a Google rejection (`~/Desktop/NeonDash-TC-EMAIL.txt`)

## Phase 3b: protect the fallback (Nov 23 until approved)

- [ ] NO new builds while production access is in review
- [ ] Remove NO testers / do not end the closed test until production is approved, so a rejection can be answered with an immediate reapply instead of a fresh 14 days

## Phase 3c: release (target Dec 1-7)

- [ ] Production access approved (watcher Telegram Nov 30 / Dec 1)
- [ ] Production release: v12 AAB (promote from Alpha), all countries, release notes; Claude Desktop handoff, human sends for review
- [ ] Production release review passed, app public on Play
- [ ] Post-launch: real ad served, AdMob finds app-ads.txt, one real purchase works, gameplay report shows production build
- [ ] Start ND-038 / ND-040 (difficulty + engagement) once ~200 real runs exist

## Checkpoint

- **Dec 10:** if production access is not approved, decide: reapply and push for Christmas, or aim for early January. (Watcher Telegram.)
