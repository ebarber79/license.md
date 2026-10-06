# ND-008 — verify report

**Item:** QA docs + e2e said double jump (cap 2); the game ships triple jump (cap 3, `game.js`
`player.jumps < 3`, 2nd jump 86%, 3rd jump 72%). Docs/test-only, so 02 was skipped. 2026-10-06.

## Test counts

| Suite | Before | After |
|---|---|---|
| Unit (`npm run test:unit`) | 18/18 | 18/18 |
| e2e (`PW_CHROMIUM=/usr/bin/chromium npx playwright test`) | 32/34: ND-CORE-01/02 failed on mobile + desktop | **34/34** (rerun of the fixed test: 2/2) |

The baseline grew from 32 to 34 tests since July (combo + ads cases were added).

## Changes

| File | Change |
|---|---|
| `tests/e2e/gameplay.spec.js` | ND-CORE-01/02 asserts jumps 1→2→3, 4th tap ignored |
| `docs/qa_verification_matrix.csv` | ND-CORE-02 → triple jump, cap 3, 86%/72% |
| `docs/QA_RELAUNCH_PLAN.md` | ND-CORE-02 row + smoke-test (2) wording |
| `README.md` | Controls + features mention triple jump |
| `playwright.config.js` | Opt-in `PW_CHROMIUM` env → `launchOptions.executablePath`. Unset = unchanged (CI) |

## Environment finding

`~/.cache/ms-playwright` had been emptied (only a stub left), so every e2e failed at browser
launch. That has nothing to do with the game. The fix is the system browser via `PW_CHROMIUM`, not a 100MB+ re-download
(keep-Pi-lean). Recorded in `_config/systems.md`.

## Verdict: GO
Docs and tests now match shipped behavior. No game code changed, so there's nothing to ship (05 skipped).
