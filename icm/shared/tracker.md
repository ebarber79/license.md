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
| ND-009 | Rename `TEST` → `AD_UNITS` in `admob-provider.js` | P3 | 01 | todo | claude | ND-001 | Cosmetic, but the name lies (they're live units). Needs its own verify (guardrails §3). |
| ND-010 | Decide: point Pages at `master` instead of `claude/mobile-app-game-tjpjlk`? | P3 | 01 | todo | human | — | The current split forces a cherry-pick on every web deploy. |
| ND-011 | Prune stale remote `claude/*` branches | P3 | 01 | todo | claude | ND-010 | 4 leftovers besides the Pages branch. |

## Done log

| ID | Title | Done | Ref |
|---|---|---|---|
| ND-008 | QA docs/e2e/README → triple jump; e2e runnable again on Pi | 2026-10-06 | `mobile-capacitor` |
| ND-001 | Gem-shop WIP + July gameplay + icm/ committed | 2026-10-06 | `mobile-capacitor` |
| — | Capacitor Android scaffold | 2026-07-05 | `73316f1` |
| — | Real AdMob IDs, live ads, release signing | 2026-07-20 | `af6d974`, `a88453c` |
| — | Rebalance + running legs + Retro Kicks, web deploy verified live | 2026-07-20 | Pages `d3e43ea`, master `71ee72d` |
| — | First signed release AAB | 2026-07-20 | `~/Desktop/NeonDash-release.aab` |
