# ND-009 — build + verify report

**Item:** rename the `TEST` ad-unit object to `AD_UNITS` in `admob-provider.js`. It held the
LIVE units, so the name was misleading. P3, but it touches the live ad code, so it gets its own verify
(guardrails §3). 02 skipped (pure rename, no behavior change). 2026-10-06.

## Change

`admob-provider.js`: 3 identifiers (`var TEST` → `var AD_UNITS`, plus 2 `adId:` uses). IDs,
`IS_TESTING`, and logic untouched. The Android `assets/public` copy is generated (gitignored) and
picks this up at the next `cap sync` / build.

## New guard: `tests/unit/admob-provider.test.mjs`

The e2e suite runs on web, where the provider exits immediately, so nothing tested the
native ad path until now. The new test loads the provider in a `vm` sandbox with a fake native
Capacitor + AdMob plugin and asserts exactly what reaches the SDK:

| Test | Asserts |
|---|---|
| inert on web | No provider when not native, or the plugin isn't linked |
| init live mode | `initialize({ initializeForTesting: false })` |
| interstitial | `prepareInterstitial({ adId: …/3616110679, isTesting: false })` then show |
| rewarded | `prepareRewardVideoAd({ adId: …/3241274379, isTesting: false })`, resolves `true` when earned |

**Mutation-checked:** a wrong interstitial ID fails test 3; `IS_TESTING=true` fails 3 tests.
If someone changes a live ID or the testing flag, the change now has to show up in a failing test.

## Results

| Suite | Result |
|---|---|
| Unit | **22/22** (18 + 4 new) |
| e2e smoke + ads (`ND-ON-01`, `ND-REG-01`, `ND-ADS-*`, both devices) | **10/10** |

Verdict: **GO**. Nothing to ship separately: it rides the next Android build (05) and needs no
web deploy (the provider never loads on Pages).
