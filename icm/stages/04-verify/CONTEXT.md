# Stage 04 — Verify

Prove the build meets the spec's acceptance criteria. Reports only. Fixes go back to 03.

## Inputs

| Source | File / location | Section / scope | Why |
|---|---|---|---|
| Spec | `../02-spec/output/ND-###-spec.md` | Acceptance, Tests, Docs drift | What to check |
| Build | `../03-build/output/ND-###-build.md` | Full | What changed |
| Systems | `../../_config/systems.md` | Local | Test commands |
| QA | `../../../docs/QA_RELAUNCH_PLAN.md`, `../../../docs/qa_verification_matrix.csv` | Matching cases | Regression + drift |

## Process

1. `npm run test:unit` and `PW_CHROMIUM=/usr/bin/chromium npm run test:e2e`. Record the pass/total counts.
2. Walk each acceptance criterion: PASS / FAIL with evidence (test name, screenshot, log).
3. Web scope: serve locally, check the console has no CSP errors and no native script tags.
4. Android scope: verify on the **debug** APK only (test creatives). Never tap live ads.
5. Update the QA docs for any drift the spec listed.

## Audit

- [ ] Every criterion has a verdict + evidence.
- [ ] e2e counts are no lower than the last recorded run (baseline in `_config/systems.md`).
- [ ] QA docs match the shipped behavior.

## Outputs

| Artifact | Location | Format |
|---|---|---|
| Verify report | `output/ND-###-verify.md` | Test counts · criterion table · drift fixed · GO / NO-GO |

NO-GO → back to 03 with the failing criteria. Tracker: `Stage 04`, `Status review`.
