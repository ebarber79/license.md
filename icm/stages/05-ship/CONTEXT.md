# Stage 05 — Ship

Get a verified change to its audience: the live web game and/or an Android artifact.
Anything public is **proposed, then executed only on the human's go**.

## Inputs

| Source | File / location | Section / scope | Why |
|---|---|---|---|
| Verify | `../04-verify/output/ND-###-verify.md` | Verdict | Must be GO |
| Systems | `../../_config/systems.md` | Git, Android builds, Artifacts | How + where |
| Guardrails | `../../_config/guardrails.md` | §2, §4, §5 | Approval, web cleanliness, versionCode |
| Procedure | skill `github-pages-deploy` | Full | Web deploy mechanics |

## Process

**Web**
1. Cherry-pick the commit(s) onto `claude/mobile-app-game-tjpjlk`. Check that no native tags
   came along.
2. Write the proposal (commits, files, preview). Wait for the go.
3. Push, wait for the Pages build, then confirm specific markers are present on the live URL.

**Android**
1. Bump `versionCode` (+ `versionName` if user-visible). Commit.
2. Sync source to the VPS. Run the matching flock script (release APK / AAB).
3. Pull the artifact to `~/Desktop`, copy it to `gdrive:NeonDash/`. Confirm the signer is `CN=Neon Dash`.
4. Upload to Play is a human step (06) unless Play API access is set up later.

## Audit

- [ ] Verify was GO.
- [ ] Web: live URL shows the new markers. Pages-branch CSP intact.
- [ ] Android: versionCode is higher than the last upload. The artifact is signed and backed up.

## Outputs

| Artifact | Location | Format |
|---|---|---|
| Ship log | `output/ND-###-ship.md` | Target(s) · commits/branch · artifact paths · live check · versionCode |

Tracker: `✓ done` (web) or `Stage 06` (Android, pending upload).
