# ND-037 ship log: Android v11 (versionCode 11 / 1.10), tester-feedback features

- Built on VPS (build-bundle.sh, gradle exit 0, 2026-11-15 12:33 UTC).
- Artifact `~/Desktop/NeonDash-release-v11.aab` (9,325,479 B, sha256 250b04b80ca04be4…) + `gdrive:NeonDash/`.
- Verified: signer CN=Neon Dash SHA-256 8C:B9:…:8C:8B (same as v6-v10), APP_BUILD 11 (1.10),
  IS_TESTING=false, plugins AdMob/InAppReview/App/Share/Purchases registered, tutorial + exit panel in bundle.
- Upload: PROPOSED. Handoff ~/Desktop/CLAUDE-DESKTOP-NEONDASH-V11-UPLOAD.txt (human drags AAB; Desktop
  stops before Send for review). Also replaces the store short + full description (docs/STORE_LISTING.md).
- Web (Pages/master): NOT shipped yet. The tutorial/Share/How-to-play are web-safe and can be
  cherry-picked to master after v11 is approved (separate proposal).
- After live: phone check per QA ND-UX-01/02; then fill the [FILL] lines in
  icm/shared/production-access-answers.md (Q4/Q8/Q9) with what shipped.
- 2026-11-15 Desktop report (handoff step 4): reached Closed testing › Alpha › Create closed testing
  release, "Drop app bundles here to upload" box shown; no Play App Signing prompt (step 3 skipped,
  signing already on); 10 (1.9) listed under "Not included" (v11 will replace it); "Declare your
  trader status" banner present, left alone (ND-030, deadline Feb 2027). Waiting on human drag of
  NeonDash-release-v11.aab, then Desktop continues from step 5.
