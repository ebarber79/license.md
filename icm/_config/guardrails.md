# Guardrails — hard stops

These override every stage contract. If a stage would break one, it stops and reports instead.

## 1. Secrets

- The keystore password exists **only** in `/root/.gradle/gradle.properties` on the VPS.
  Never copy it into this workspace, git, memory, or an output file.
- Losing the keystore or its password means the Play app can **never be updated**. Any stage
  that touches signing confirms a backup exists first (tracker ND-002).
- The RevenueCat `goog_` key is semi-public (it ships in the APK), but paste it from the
  human only. Never guess or search for it.

## 2. Nothing goes public without the human

- Pushing to `master` (= live site), uploading to Play Console, and
  publishing a store listing are each **proposed** in a 05/06 output, then approved.
- Committing locally and pushing feature branches is fine once the human has approved the stage.

## 3. Live money switches

- `IS_TESTING=false` serves real, revenue-earning ads. Never tap live ads on your own device
  (AdMob bans invalid traffic). Play-test with the debug APK (`IS_TESTING=true`).
- Any change to `admob-provider.js` IDs, `IS_TESTING`, or IAP product IDs is its own
  tracker item with its own verify step.

## 4. Web build stays clean

- The Pages build keeps the strict CSP and carries **no** native-only script tags
  (`admob-provider.js`, `iap*.js`, CrazyGames). Those load only in the Capacitor build.
- `master` IS the live site (ND-010). Pushing to it is a public deploy: propose first, verify live after.

## 5. Android releases

- Bump `versionCode` in `android/app/build.gradle` before every Play upload. Play rejects
  a reused code. (Currently `1` / `"1.0"`.)
- Play takes **AAB**, not APK.

## 6. Repo hygiene

- Never commit `www/`, `dist/`, `node_modules/`, `test-results/`, keystores, or `*.log`.
- Don't leave work uncommitted across sessions. A working tree with no commit was the riskiest
  state this project has been in (ND-001).
