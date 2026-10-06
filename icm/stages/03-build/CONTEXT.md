# Stage 03 — Build

Implement the approved spec on a branch, commit it, and get unit tests green.
No deploy, no Android build.

## Inputs

| Source | File / location | Section / scope | Why |
|---|---|---|---|
| Spec | `../02-spec/output/ND-###-spec.md` | Full | The contract (absent only for noted skips) |
| Systems | `../../_config/systems.md` | Git, Local | Branches, test commands |
| Guardrails | `../../_config/guardrails.md` | §1, §3, §4, §6 | Secrets, switches, hygiene |
| Product | `../../_config/product.md` | Tuning, switches | Update in the same pass if changed |

## Process

1. `git status` first. If the tree is dirty with unrelated work, stop and report
   (or the item *is* that dirty work, as in ND-001).
2. Work on `mobile-capacitor` (or a branch off it named `nd-###-slug`).
3. Implement only what the spec says. Match the surrounding code style (IIFE, `var` in providers).
4. Add/update the tests the spec names. `npm run test:unit` must pass.
5. If the change touches anything `build:www` copies, add new files to its allowlist.
6. Commit with an `ND-###:` prefixed message. Never stage `www/`, `dist/`, keystores, or logs.

## Audit

- [ ] Unit tests green (paste the summary line).
- [ ] Diff touches only the files the spec named. Anything else is explained.
- [ ] No secret, no `www/`, no `dist/` in the commit.
- [ ] `product.md` tuning/switch table updated if those changed.

## Outputs

| Artifact | Location | Format |
|---|---|---|
| Build note | `output/ND-###-build.md` | Branch · commits · files changed · unit-test result · surprises |

Tracker: `Stage 03`, `Status review`.
