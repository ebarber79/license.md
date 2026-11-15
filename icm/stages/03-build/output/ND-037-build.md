# ND-037 build: tester-feedback features (v11)

- Branch `nd-037-tester-feedback` (off `nd-005-purchase-diag` / v10). 2026-11-15.
- Files: game.js (tutorial, Rate/Share, review prompt, exit confirm, test hooks), index.html,
  style.css, analytics.js (APP_BUILD 11 (1.10)), android/ (versionCode 11 / 1.10, 2 plugins),
  package.json (+@capacitor/share 8.0.3, +@capacitor-community/in-app-review 8.0.0),
  tests/e2e/tutorial.spec.js (new), layout-and-ads.spec.js (presets tutorial flag),
  docs/STORE_LISTING.md, docs/qa_verification_matrix.csv, icm/_config/systems.md.
- Unit 42/42. E2E 114/114 (112 + ND-022 fixed: real first web run is now the tutorial).
- Surprises: none in code. Tutorial auto-start is off under ?test=1 so older e2e stay unguided;
  tests opt in via NeonDashTest.setAutoTutorial(true).
- New analytics events (no schema change): tutorial_start/done/skip, share_tap, rate_tap,
  review_prompt.
- Web build: no new script tags; CSP unchanged. Native plugins only via Capacitor.Plugins.
