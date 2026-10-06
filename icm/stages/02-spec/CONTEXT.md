# Stage 02 — Spec

Turn one tracker item into a spec small enough to build in one pass, with acceptance criteria
04-verify can check mechanically. No code changes.

## Inputs

| Source | File / location | Section / scope | Why |
|---|---|---|---|
| Item | `../../shared/tracker.md` | The one row | What's being specced |
| Product | `../../_config/product.md` | Code map, tuning, switches | Where it lands |
| Guardrails | `../../_config/guardrails.md` | §3, §4 | Money switches, web/native split |
| Code | `../../../` | Only the files the item touches | Current behavior |
| QA plan | `../../../docs/QA_RELAUNCH_PLAN.md` | Matching ND-* cases | Existing expectations |

## Process

1. Read the touched code. Describe current behavior in 2–3 lines.
2. Write the target behavior and **what doesn't change**.
3. Set the platform scope: web, Android, or both. If web, confirm no native script tag leaks in.
4. Acceptance criteria: numbered, each one checkable by a unit test, an e2e test via
   `window.NeonDashTest`, or one named manual playtest step.
5. Name the tests to add or update, and any QA-doc lines that will drift.
6. Tuning changes: give the old → new values and the reason.

## Audit

- [ ] Every criterion is checkable, with no "feels better".
- [ ] Platform scope is stated.
- [ ] The QA-doc drift is listed (or "none").

## Outputs

| Artifact | Location | Format |
|---|---|---|
| Spec | `output/ND-###-spec.md` | Current · Target · Unchanged · Scope · Acceptance · Tests · Docs drift |

Tracker: set `Stage 02`, `Status review`. The human approves or edits before 03.
