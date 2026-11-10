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
- Live site: **https://neondash.gridlas.com** (GitHub Pages from `master`, CNAME file; Cloudflare DNS CNAME `neondash` → `ebarber79.github.io`, proxy OFF; Enforce HTTPS on). Old `ebarber79.github.io/license.md/` redirects. `app-ads.txt` stays at `ebarber79.github.io` root (ebarber79.github.io repo).
- Serve: `npm run serve` → http://localhost:8000
- Tests: `npm run test:unit` (node --test) · e2e: **`PW_CHROMIUM=/usr/bin/chromium npm run test:e2e`**
  (Playwright, mobile + desktop chrome; drives the game via `?test=1` → `window.NeonDashTest`).
  Playwright's bundled browsers are NOT kept on the Pi (cache was emptied). Use system chromium.
  Baseline: e2e **84/84**, unit **38/38** (2026-11-04). Run e2e with `--workers=1` on the Pi (parallel workers overload it → false timeouts).
- `www/` is **generated** by `npm run build:www` from a 13-file allowlist. Never hand-edit it, never commit it.

## Android builds (IONOS VPS — keeps the Pi lean)

| Item | Value |
|---|---|
| Host | `root@50.21.191.200` (since ~2026-10-14 the Tailscale address hangs on a browser check) |
| Source | `/root/neon-dash` (needs `node_modules/@capacitor*` + `@revenuecat/*` beside `android/`) |
| Toolchain | JDK 21 `/root/jdk-21`, SDK `/root/android-sdk`, Gradle wrapper 8.14.3 |
| Debug APK | `/root/neon-dash/build-once.sh` (flock-guarded) |
| Release APK | `/root/neon-dash/build-release.sh` |
| Release AAB (Play) | `/root/neon-dash/build-bundle.sh` |
| Test APK (Google test ads, play-testing) | `/root/neon-dash/build-test-apk.sh` (patches IS_TESTING=true into the bundled asset for that build only, restores on exit) |
| Sync from Pi | `npm run cap:sync`, then `rsync -a --exclude build/ --exclude .gradle/ --exclude local.properties --exclude app/src/main/assets/public/ android/ root@50.21.191.200:/root/neon-dash/android/` + `rsync -a --delete android/app/src/main/assets/public/ …/assets/public/` |
| Signing | keystore `/root/neon-dash/neondash-release.jks`, password in `/root/.gradle/gradle.properties` |

Ops rules learned the hard way: launch builds **only** through the flock scripts (a retry loop
triple-launched gradle and OOM'd the box); probe with `pgrep -x java`; `rsync --partial` with retries.

## Artifacts

| Artifact | Location |
|---|---|
| Release AAB (Play) | `~/Desktop/NeonDash-release-v7.aab` (versionCode 7 / 1.6, ND-034 gameplay tracking, 2026-11-10, + Drive, same cert). Previous: `NeonDash-release-v6.aab` (versionCode 6 / 1.5, ND-031 Back + portrait, 2026-11-06, + Drive, same cert as v5). Previous: v5 (on closed test), v4 (on closed test), v3 (never uploaded), v2. Old: `NeonDash-release-v1-OLD-do-not-upload.aab`, `NeonDash-release-admob.apk` (July) |
| Debug APK (test creatives, safe to tap) | `~/Desktop/NeonDash-debug-admob.apk` |
| Keystore copy | `~/Desktop/neondash-release.jks` (mode 600); backups: TB `/mnt/storage/apps/neon-dash/signing/`, `gdrive:NeonDash/signing/` (password NOT stored with them) |
| RevenueCat service-account key | TB `/mnt/storage/apps/neon-dash/signing/revenuecat-gen-lang-client-0188456877-4e6a8e7adf59.json` only (mode 600, Google Cloud project gen-lang-client-0188456877). Already uploaded to RevenueCat; only needed to reconnect. Not on Drive. |
| Off-site | `gdrive:NeonDash/` |

## Launch watcher (VPS, added 2026-11-07)

`/root/neondash-watch/watch.py` + `schedule.json`, cron hourly at :05 (`# NEONDASH-WATCH`), log `watch.log`.
Sends each dated launch nudge to the user's Telegram once (daily-triage relay) and forwards every new
Testers Community email (`from:testerscommunity.io`, onboardingaudit.ai@gmail.com, read-only).
Copy of the code: `icm/ops/neondash-watch/`. To add a nudge: append to schedule.json on the VPS.
Also watches forwarded Google Play mail (needs the human's Gmail filter: Desktop
`CLAUDE-DESKTOP-PLAY-EMAIL-FORWARDING.txt`) and the forwarding-confirmation email; flags approved / not-ready.
Auto-draft: `drafter.py` runs headless Claude (no tools, token from `/etc/dropzone/env`) over all TC + Play
emails (bodies + PDF attachments) + `facts.md` + `draft-template.txt` (= ND-032 output). Unknowns stay
`[NEEDS: ...]`. Triggered by a TC email whose SUBJECT looks like a report (or has an attachment) and by the
nov21 schedule item; batched to one draft per 6h. Output `drafts/LATEST.txt` + Telegram. Never submits.
Own venv `/root/neondash-watch/venv` (google libs + pypdf). Keep `facts.md` current when releases ship.
Can't see Play Console or the TC dashboard (both need a human login).

## Gameplay events (ND-034/035)
App -> Cloudflare Worker `neondash-events.onboardingaudit.workers.dev` -> VPS `pull.py` (*/5) -> `/root/neondash-events/events.db`. Report: `python3 report.py --days N` on the VPS. After every Play go-live, add the build to `/root/neondash-events/builds.json` (go-live time from the Play 'Your update is live' email), or its test-device sessions count as players.
