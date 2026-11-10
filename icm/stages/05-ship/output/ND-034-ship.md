# ND-034 ship log: Android v7 (versionCode 7 / 1.6)

- Date: 2026-11-10 (UTC)
- Branch: `nd-034-tracking`. Unit 42/42, e2e 84/84 re-run after the relay endpoint change.
- Built on VPS with `/root/neon-dash/build-bundle.sh` (gradle exit 0).
- Artifact: `~/Desktop/NeonDash-release-v7.aab` (9.3 MB) + `gdrive:NeonDash/NeonDash-release-v7.aab`.
- Signer: `CN=Neon Dash, O=ebarber79, C=US`, SHA-256 8C:B9:BA:68:...:8C:8B, same as v6.
- versionCode 7 in the manifest. IS_TESTING=false (live ads, as v6).
- Bundled web assets vs v6: only `analytics.js` (relay endpoint, app_open, platform/build)
  and `index.html` (CSP connect-src adds the relay) differ.
- Contents: gameplay tracking only. No phone-test fixes yet (v6 test report not in).
- Upload to Play closed testing: human step (06), not done.
