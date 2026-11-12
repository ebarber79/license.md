# ND-005 ship log: Android v10 (versionCode 10 / 1.9), purchase diagnostics

- Date: 2026-11-12 (UTC). Branch `nd-005-purchase-diag` (off `nd-036-feedback`).
- Why: v9 phone test. Licensed-tester purchase of gems.500 completes on Google
  (receipt email) but the gems are never added, and RevenueCat has no record of it
  (credentials valid, products published). purchaseStoreProduct never resolves
  (12:47 UTC) or fails after 2m19s (12:53, likely already-owned). v9 drops the reason.
- Changes: gem_pack_cancelled/failed carry `code` + `msg`; RevenueCat log handler
  forwards WARN/ERROR + purchase/receipt/billing lines as `iap_log` events (max 40
  per session, msg <= 300 chars, no personal data). APP_BUILD "10 (1.9)".
- Tests: unit 42/42, e2e 92/92 (PW_CHROMIUM=/usr/bin/chromium).
- Built on VPS (build-bundle.sh, gradle exit 0, 13:37 UTC). Artifact
  `~/Desktop/NeonDash-release-v10.aab` + `gdrive:NeonDash/`.
- Upload: human said "build v10 and prep the upload". Handoff
  CLAUDE-DESKTOP-UPLOAD-V10.txt (human drags the AAB; send for review approved).
  Notes: "Fixes in progress for gem purchases. Thanks for testing!"
- After live: human buys the 1200 pack (500 is stuck as owned); read iap_log events.
