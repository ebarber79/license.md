# Stage 01 — Backlog (capture + triage)

Turn raw input (an idea, a bug, a playtest note, a store-review comment) into a numbered
tracker item with a priority. This stage writes no code.

## Inputs

| Source | File / location | Section / scope | Why |
|---|---|---|---|
| Board | `../../shared/tracker.md` | Full | Existing IDs, dedupe, next free ID |
| Product | `../../_config/product.md` | Code map | Which file an item touches |
| Guardrails | `../../_config/guardrails.md` | Full | Flags items that need a human or their own verify |
| Raw input | The human's message, or `output/inbox.md` | Full | What's being triaged |

## Process

1. Dedupe against the tracker. If it's already there, add a note to that row instead.
2. Assign the next `ND-###`. Write the title as a doable outcome ("Rename X to Y"), not a topic.
3. Priority: P0 (risk of loss), P1 (launch path), P2 (quality), P3 (nice-to-have).
4. Owner: `human` if it needs an account, payment, password, or approval. Otherwise `claude`.
5. Route it. Code with new behavior goes to 02. Docs/rename-only goes to 03 (note the skip).
   Store/ads/payout ops go to 06.
6. Append the row. Note the route in the Notes column.

## Audit

- [ ] No duplicate of an existing item.
- [ ] Every item touching ads, IAP, or signing is marked for its own verify step.
- [ ] Nothing triaged was implemented in this pass.

## Outputs

| Artifact | Location | Format |
|---|---|---|
| New/updated rows | `../../shared/tracker.md` | Table rows |
| Unprocessed ideas (optional) | `output/inbox.md` | Bullets. Anyone can drop raw notes here |
