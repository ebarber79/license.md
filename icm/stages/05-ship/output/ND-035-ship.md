# ND-035 ship log: Android v8 (versionCode 8 / 1.7)

- Date: 2026-11-10 (UTC)
- Branch: `nd-035-run-time` (on top of `nd-034-tracking`). Unit 42/42, e2e 88/88.
- Built on VPS with `/root/neon-dash/build-bundle.sh` (gradle exit 0).
- Artifact: `~/Desktop/NeonDash-release-v8.aab` (9.3 MB) + `gdrive:NeonDash/NeonDash-release-v8.aab`.
- Signer: `CN=Neon Dash, O=ebarber79, C=US`, SHA-256 8C:B9:BA:68:...:8C:8B, same as v6/v7.
- versionCode 8 in the manifest. IS_TESTING=false (live ads, as before).
- Bundled web assets vs v7: only `game.js` (run time excludes pause + game-over/revive ad)
  and `analytics.js` (build label "8 (1.7)") differ.
- No phone-test fixes (v6 test report still not in).
- Upload to Play closed testing: human step (06), not done.
