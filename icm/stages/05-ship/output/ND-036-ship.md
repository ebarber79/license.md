# ND-036 ship log: Android v9 (versionCode 9 / 1.8)

- Date: 2026-11-10 (UTC). Branch `nd-036-feedback` (off `nd-035-run-time`).
- Change: "Send feedback" link at the bottom of the start screen. Opens the
  player's email app (mailto via Capacitor's ACTION_VIEW intent) to
  neondash@gridlas.com, subject "Neon Dash feedback (9 (1.8))", body ends with the
  version + platform. Nothing sent unless the player sends it; no new tracking event.
- Also: APP_BUILD "9 (1.8)", NeonAnalytics exposes `build`.
- Why: third update during the Testers Community run (ND-033) + a tester feedback
  channel for the production form. Phone-test fixes not included (v6 report not in).
- Tests: unit 42/42; e2e 92/92 (2 new in feedback.spec.js; 4 timeouts on the first
  run under load passed on re-run).
- Built on VPS (build-bundle.sh, gradle exit 0, 17:59 UTC). Artifact
  `~/Desktop/NeonDash-release-v9.aab` (9.3 MB) + `gdrive:NeonDash/`.
- Signer CN=Neon Dash, SHA-256 8C:B9:...:8C:8B (same as v6-v8). versionCode 9 / 1.8.
  IS_TESTING=false (live ads). Assets vs v8: only analytics.js, game.js, index.html,
  style.css differ (expected).
- NOT uploaded. Needs human OK ("upload v9"); release note:
  "New: a Send feedback link on the start screen, so you can tell us about bugs or ideas."
