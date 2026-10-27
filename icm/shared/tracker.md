# Tracker — the board

The **only** home for an item's status. Stages update their item's row; nothing else
duplicates it. Seeded 2026-10-06 from the repo state and the project history.

**Stage:** 01 backlog · 02 spec · 03 build · 04 verify · 05 ship · 06 launch · ✓ done
**Status:** `todo` · `active` · `review` (waiting on the human) · `blocked` · `done` · `dropped`
**Pri:** P0 risk of loss · P1 launch path · P2 quality · P3 nice-to-have
**Owner:** `claude` · `human` (only the human can do it: accounts, payments, approvals)

| ID | Title | Pri | Stage | Status | Owner | Depends | Notes |
|---|---|---|---|---|---|---|---|
| ND-001 | Commit + push uncommitted gem-shop WIP (`iap.js`, `iap-provider.js` + 10 modified files) | P0 | ✓ | done | claude | — | 2026-10-06, pushed to `mobile-capacitor`. Build note: `stages/03-build/output/ND-001-build.md`. Stale /10 score test fixed. e2e not run (→ ND-008). |
| ND-002 | Back up keystore password off the VPS (password manager) | P0 | 06 | todo | human | — | Only copy is `/root/.gradle/gradle.properties`. Lose it and the Play app can't be updated. |
| ND-003 | Play Console account ($25) + create app `io.github.ebarber79.neondash` | P1 | 06 | todo | human | — | Unblocks ND-004, 005, 007. |
| ND-004 | Upload signed AAB to internal-test track | P1 | 05 | blocked | claude+human | ND-003 | AAB exists at `~/Desktop/NeonDash-release.aab` (versionCode 1). |
| ND-005 | Gem shop live: 4 consumables in Play + RevenueCat, paste `goog_` key, rebuild | P1 | 06 | blocked | human→claude | ND-003 | Code is complete; inert only on the key and products. Runbook: `~/Desktop/IAP-Setup-Instructions-NeonDash.md`. |
| ND-006 | AdMob payout setup: W-9/tax + bank | P1 | 06 | todo | human | — | No payout until done. Ads are already live. |
| ND-007 | Publish `app-ads.txt` on the declared developer site | P1 | 05 | blocked | claude | ND-003 | Likely `ebarber79.github.io` root. Line is in `_config/product.md`. |
| ND-008 | QA docs say double jump; game ships triple jump | P2 | ✓ | done | claude | — | 2026-10-06. e2e 34/34. Report: `stages/04-verify/output/ND-008-verify.md`. Also added `PW_CHROMIUM` (Playwright cache was wiped). |
| ND-009 | Rename `TEST` → `AD_UNITS` in `admob-provider.js` | P3 | ✓ | done | claude | — | 2026-10-06. Added `tests/unit/admob-provider.test.mjs` (mutation-checked guard on live IDs + IS_TESTING). Unit 22/22. Ships with next Android build. |
| ND-010 | Make `master` the single web branch (Pages publishes from it) | P3 | ✓ | done | claude+human | — | 2026-10-06. Pages→master merged (`95a91f7`, tree = live), human flipped Pages source, deploy verified byte-identical live, master merged into mobile-capacitor. CI on master still red from 2 stale tests (→ ND-012). |
| ND-011 | Branch cleanup | P3 | 05 | review | human | — | 2026-10-07: local `pages-deploy` deleted. 4 non-game branches tagged `archive/<branch>` locally + backed up to TB `/mnt/storage/archive/neon-dash-branches/` (verified git bundle + plain FTMO folder; ~/eurusd-bot no longer on Pi, real copy is VPS /home/eurusd/eurusd-bot). Remote push of tags + branch deletes blocked by Claude Code guard → **human runs** the push-tags then delete-branches commands. |
| ND-013 | Replace default Capacitor app icon + splash with Neon Dash art (from `icon.svg`) | P1 | 01 | todo | claude | — | 2026-10-27 audit: `mipmap-*/ic_launcher*.png` and `drawable*/splash.png` are still Capacitor's blue "X". Needs adaptive icon (foreground + background), round icon, 512px Play icon. |
| ND-014 | GDPR/UK ad consent: Google UMP form before AdMob loads | P1 | 01 | todo | claude+human | — | 2026-10-27 audit: `admob-provider.js` calls `initialize()` with no consent step. Plugin has `requestConsentInfo` / `showConsentForm`. Human: publish a GDPR message in AdMob → Privacy & messaging. |
| ND-015 | Privacy policy for the Android app (AdMob, advertising ID, Play Billing/RevenueCat) at a public URL + data-safety answers | P1 | 01 | todo | claude+human | — | 2026-10-27 audit: `docs/PRIVACY.md` says nothing is collected and only covers web/portals. Play needs a policy URL that matches the data-safety form. Human fills the form from Claude's draft answers. |
| ND-016 | Audience + ad rating: target 13+, cap ad content rating, not child-directed | P1 | 01 | todo | claude+human | — | 2026-10-27 audit: policy says "general audiences"; ads to kids bring Families-policy rules. Code: set max ad content rating in AdMob request config. Human: Play target-audience form = 13+. |
| ND-017 | Release build v2 (versionCode 2) with ND-009, 013–016 | P1 | 01 | todo | claude | ND-013, ND-014, ND-015, ND-016 | The July AAB (versionCode 1) predates ND-009 and lacks all of the above, so don't upload it. |

## Done log

| ID | Title | Done | Ref |
|---|---|---|---|
| ND-010 | master = single web branch, Pages flipped + verified live | 2026-10-06 | master `95a91f7` |
| ND-009 | AD_UNITS rename + first test of the native ad path | 2026-10-06 | `mobile-capacitor` |
| ND-008 | QA docs/e2e/README → triple jump; e2e runnable again on Pi | 2026-10-06 | `mobile-capacitor` |
| ND-001 | Gem-shop WIP + July gameplay + icm/ committed | 2026-10-06 | `mobile-capacitor` |
| ND-012 | Fix red CI on `master`: port ND-001 score-test + ND-008 triple-jump test/doc fixes | P2 | 05 | review | human | — | 2026-10-06: commit `2dd51a6` ready on local branch `nd-012` (fast-forward of master). Unit 18/18, targeted e2e 3/3 (full local run impossible: Pi swap full, load ~20). Push to master blocked by Claude Code permission guard (production deploy). **Human runs:** `git -C ~/neon-dash-src push origin nd-012:master`, then GitHub CI = full-suite check. |
| — | Capacitor Android scaffold | 2026-07-05 | `73316f1` |
| — | Real AdMob IDs, live ads, release signing | 2026-07-20 | `af6d974`, `a88453c` |
| — | Rebalance + running legs + Retro Kicks, web deploy verified live | 2026-07-20 | Pages `d3e43ea`, master `71ee72d` |
| — | First signed release AAB | 2026-07-20 | `~/Desktop/NeonDash-release.aab` |
