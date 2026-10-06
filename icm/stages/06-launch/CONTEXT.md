# Stage 06 — Launch & monetization ops

Store, ads, IAP and payout work. Mostly **human-owned**: accounts, payments, consoles. Claude's
job is to keep the checklist accurate, prepare exact instructions, and do the code half
when the human hands over a value (e.g. the RevenueCat key).

## Inputs

| Source | File / location | Section / scope | Why |
|---|---|---|---|
| Board | `../../shared/tracker.md` | Rows at Stage 06 | What's open |
| Checklist | `output/launch-checklist.md` | Full | Current launch state |
| Product | `../../_config/product.md` | Public identifiers, switches | IDs to enter in consoles |
| Guardrails | `../../_config/guardrails.md` | §1, §3 | Secrets, live money |
| Runbooks | `~/Desktop/AdMob-Setup-Instructions-NeonDash.md`, `~/Desktop/IAP-Setup-Instructions-NeonDash.md` | Relevant step | Click-by-click |

## Process

1. Read the checklist. Pick the first unchecked step whose dependencies are met.
2. If it's human-owned, write the exact steps + values into the checklist and set the row
   `review`, then stop.
3. If the human supplied a value (key, product IDs, site URL), open a code item (01 → 03)
   for the wiring. Don't edit code from this stage.
4. Tick what the human confirms done, with the date.

## Audit

- [ ] No secret was written anywhere in this workspace.
- [ ] Checklist and tracker agree.

## Outputs

| Artifact | Location | Format |
|---|---|---|
| Launch checklist | `output/launch-checklist.md` | Phased checkbox list, dated ticks |
