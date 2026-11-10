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
- 2026-11-10: human said 'upload v8'. Desktop handoff CLAUDE-DESKTOP-UPLOAD-V8.txt written (human drags the AAB in; send for review approved).
- 2026-11-10: UPLOADED to Closed testing - Alpha: vc 8 '8 (1.7)', notes 'Run length is now measured accurately: time spent paused or watching a revive ad no longer counts.', only warning = no deobfuscation file, quick checks clean, SENT FOR REVIEW (Changes in review). Alpha: 8 (1.7) in review, 178 countries; 7 (1.6) stays live until approval. Watcher adds the '8 (1.7)' go-live to builds.json.
- 2026-11-10: fix also LIVE on the web (human OK): master 2ff135d (game.js + run-time.spec.js), unit 30/30, e2e 74/74, verified neondash.gridlas.com/game.js serves it.
