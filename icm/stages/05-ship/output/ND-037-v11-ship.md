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
- 2026-11-15 Desktop report (steps 5-9): bundle vc 11 "11 (1.10)", release name auto "11 (1.10)",
  10 (1.9) not included; en-US notes exact; only warning = no deobfuscation file; devices unchanged
  (Phone 12,620 / Tablet 6,853 / TV 4 / Car 13 / Chromebook 77 / XR 2); 8.89 MB (+~14.4 KB vs v10).
  Release saved as DRAFT. Recommended "Part B first" so release + store listing go to one review.

## Part B, step 12 (2026-11-15)
- Desktop report: the Review step shows the new short and full descriptions exactly as written. Name, graphics and screenshots are untouched, and there are no warnings.
- A new "AI asset declaration" section has appeared. Answer: keep "Don't label assets", the same as Nov 4, because all images are game renders.
- A Manage languages dialog opened by accident and was cancelled, so the listing is still en-US only.
- Told Desktop to Save and then report the step 13 list (handoff CLAUDE-DESKTOP-NEONDASH-V11-SAVE.txt).
