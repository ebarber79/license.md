# ND-005 ship log: Android v12 (versionCode 12 / 1.11), purchase fixes

- Code: 8f7ee28 (iap_log handler registered as a Capacitor callback; one purchase at a time;
  code 4 -> wait 0.8 s, refetch product, retry once; events carry retried). Bump a7758ba.
- Tests: unit 48/48, e2e 114/114 (--workers=1).
- Built on VPS 2026-11-16 05:19 UTC (build-bundle.sh, gradle exit 0, log /root/neon-dash/build-v12.log).
- Artifact `~/Desktop/NeonDash-release-v12.aab` (9,326,227 B, sha256 53864102ff126a3c…) + `gdrive:NeonDash/`.
- Verified: jar verified, signer CN=Neon Dash SHA-256 8C:B9:…:8C:8B (same as v6-v11), merged manifest
  versionCode 12 / 1.11, APP_BUILD 12 (1.11), IS_TESTING=false, retry code in the bundle.
- Upload: handoff ~/Desktop/CLAUDE-DESKTOP-NEONDASH-V12-UPLOAD.txt (human drags AAB; release only,
  no listing change; Desktop stops before Send for review).
- After live: check events for code 4 / retried and that iap_log lines arrive.
