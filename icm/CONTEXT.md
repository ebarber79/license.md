# Neon Dash Workspace — Layer 1 (routing)

Tracks every change to Neon Dash from idea to live: web (GitHub Pages) and Android (Play).
This file routes. It does not contain instructions — those live in stage contracts.

## Rule of entry

Read this file and `shared/tracker.md`, then read **exactly one** stage `CONTEXT.md` and do
that stage's job for **one tracker item**. Every stage writes to its own `output/` and moves
the item's `Stage`/`Status` in the tracker. The human reviews before the next stage reads it.

## Stages

| # | Stage | Job | Run when |
|---|---|---|---|
| 01 | `stages/01-backlog/` | Capture ideas, bugs, debt, ops tasks; triage + prioritize | Anything new comes up / weekly |
| 02 | `stages/02-spec/` | Turn one item into a spec with acceptance criteria | An item is picked as next |
| 03 | `stages/03-build/` | Implement on a branch, commit, unit tests green | Spec approved |
| 04 | `stages/04-verify/` | Unit + e2e + play-test + QA-doc drift check | Build done |
| 05 | `stages/05-ship/` | Web deploy to Pages and/or Android APK/AAB build | Verify passes |
| 06 | `stages/06-launch/` | Store, ads, IAP, payouts: the human-gated launch checklist | Any Play/AdMob/RevenueCat work |

Not every item walks all six. Ops-only items (accounts, payouts) go straight 01 → 06.
Docs-only fixes may skip 02. Write the skip, with its reason, in the tracker's Notes column.

## Config (Layer 3 — the factory, set once)

| File | Holds |
|---|---|
| `_config/product.md` | What the game is, its systems, the tuning constants, the IDs that are public |
| `_config/systems.md` | Branches, where builds run, deploy paths, artifacts, tests |
| `_config/guardrails.md` | Hard stops: secrets, live ads, Pages branch, version codes, push rules |
| `shared/tracker.md` | **The board.** One row per item, the only home for an item's status |

## Canonical sources (do not duplicate — reference)

- **Code:** the repo root (`../`). `game.js` tuning constants sit near the top of the IIFE.
- **Monetization strategy:** `../docs/MONETIZATION.md`.
- **QA plan + matrix:** `../docs/QA_RELAUNCH_PLAN.md`, `../docs/qa_verification_matrix.csv`.
- **Setup runbooks (human steps):** `~/Desktop/AdMob-Setup-Instructions-NeonDash.md`,
  `~/Desktop/IAP-Setup-Instructions-NeonDash.md`.

## Conventions

- Item IDs: `ND-###`, assigned in 01, never reused.
- Outputs are plain markdown, named `ND-###-[artifact].md` (e.g. `ND-004-spec.md`).
- One-way references: a stage reads earlier stages' `output/`, never later ones.
- This folder is never shipped: `scripts/build-www.mjs` uses an allowlist, and the Pages
  branch doesn't carry `icm/`.
