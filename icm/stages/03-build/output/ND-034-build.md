# ND-034 build: gameplay tracking (Android only)

Asked by the human 2026-11-09 ("add the tracking to v7"; "I want you to be able to follow
the tracking, produce the reports"). Spec skipped: small, wires an existing hook.

## What changed (branch nd-034-tracking)
- `analytics.js`: on Android (Capacitor native) events go by `sendBeacon` to
  `https://my-vps-ionos.taile95d57.ts.net:10000/nd/e`. Web: endpoint null, nothing sent.
  New `app_open` event; every event carries `build` ("7 (1.6)", bump per release) and
  `platform`. No persistent ID: session id is random per launch, in memory only.
  Error stacks capped at 1500 chars.
- `index.html` (Android branch only): CSP `connect-src` += the endpoint origin.
  Do NOT cherry-pick index.html to master (web CSP stays as is).
- `privacy.html`: new "Gameplay statistics (Android app only)" section, summary row,
  12-month retention, dated Nov 9. Needs a master deploy (human OK) and the Play
  Data safety form update (human, see below) BEFORE v7 is sent for review.
- `android/app/build.gradle`: versionCode 7 / 1.6.
- Tests: unit 42/42 (new analytics-native.test.mjs + web no-endpoint test),
  e2e 84/84 (PW_CHROMIUM=/usr/bin/chromium, --workers=1).

## Server side (VPS, live)
- `/root/neondash-events/receiver.py` (systemd `neondash-events`, 127.0.0.1:8796):
  validates JSON, 8 KB cap, 30 ev/s limit, stores no IP/headers. SQLite `events.db`.
- `/root/neondash-events/report.py`: `--days N` text report, `--telegram` daily summary
  (cron 01:00 UTC = 8 PM EST), `--prune` weekly (>365 days). Copies in `icm/ops/neondash-events/`.

## BLOCKER: public route
The receiver is local-only. The app needs a public HTTPS route to it. Plan: Tailscale
Funnel on port 10000, path /nd only. Claude's safety check blocks opening it; the human
must approve (enable Funnel for the VPS node in the Tailscale admin console, then run
`tailscale funnel --bg --https=10000 --set-path=/nd http://127.0.0.1:8796/nd`).
Until then the app's beacons fail silently (no effect on gameplay).

## Play Data safety (human, Play Console > App content > Data safety)
Add as COLLECTED (not shared), processed for Analytics + App functionality, encrypted in
transit, not optional, users can request deletion (neondash@gridlas.com):
- App activity > App interactions
- App info and performance > Crash logs, Diagnostics
