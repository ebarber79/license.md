# Systems — where Neon Dash actually builds and ships

## Git (`github.com/ebarber79/license.md` — repo is oddly named, it's the game)

| Branch | Role |
|---|---|
| `master` | **What GitHub Pages publishes** (since 2026-10-06, ND-010). The live web game. Push here = deploy. |
| `mobile-capacitor` | Android/Capacitor work + current dev branch on the Pi. **Never publish this to Pages.** Its `index.html` loads native-only scripts. |
| `claude/mobile-app-game-tjpjlk` | Old Pages branch, fully merged into master. Pending deletion (ND-011). |

Web change flow: build on `mobile-capacitor` → cherry-pick the web-safe commit(s) onto `master`
(keep the CSP, no native script tags) → push → verify live. Merge `master` → `mobile-capacitor` after.
Pages settings: https://github.com/ebarber79/license.md/settings/pages

Live URL: https://ebarber79.github.io/license.md/index.html
Push from the Pi: SSH key, tokenless (skill `github-pages-deploy`). Don't attempt `gh auth`.

## Local (Pi)

- Source: `~/neon-dash-src`. TB backup: `/mnt/storage/apps/neon-dash` (no node_modules).
- Serve: `npm run serve` → http://localhost:8000
- Tests: `npm run test:unit` (node --test) · e2e: **`PW_CHROMIUM=/usr/bin/chromium npm run test:e2e`**
  (Playwright, mobile + desktop chrome; drives the game via `?test=1` → `window.NeonDashTest`).
  Playwright's bundled browsers are NOT kept on the Pi (cache was emptied). Use system chromium.
  Baseline: e2e **34/34**, unit **22/22** (2026-10-06).
- `www/` is **generated** by `npm run build:www` from a 13-file allowlist. Never hand-edit it, never commit it.

## Android builds (IONOS VPS — keeps the Pi lean)

| Item | Value |
|---|---|
| Host | `root@100.93.253.90` (Tailscale; more reliable than the public IP) |
| Source | `/root/neon-dash` (needs `node_modules/@capacitor*` + `@revenuecat/*` beside `android/`) |
| Toolchain | JDK 21 `/root/jdk-21`, SDK `/root/android-sdk`, Gradle wrapper 8.14.3 |
| Debug APK | `/root/neon-dash/build-once.sh` (flock-guarded) |
| Release APK | `/root/neon-dash/build-release.sh` |
| Release AAB (Play) | `/root/neon-dash/build-bundle.sh` |
| Signing | keystore `/root/neon-dash/neondash-release.jks`, password in `/root/.gradle/gradle.properties` |

Ops rules learned the hard way: launch builds **only** through the flock scripts (a retry loop
triple-launched gradle and OOM'd the box); probe with `pgrep -x java`; `rsync --partial` with retries.

## Artifacts

| Artifact | Location |
|---|---|
| Release APK / AAB | `~/Desktop/NeonDash-release-admob.apk` · `~/Desktop/NeonDash-release.aab` |
| Debug APK (test creatives, safe to tap) | `~/Desktop/NeonDash-debug-admob.apk` |
| Keystore copy | `~/Desktop/neondash-release.jks` (mode 600) |
| Off-site | `gdrive:NeonDash/` |
