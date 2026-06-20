# POStrategicEA Validation & FTMO Toolkit

A complete, self-honest pipeline to decide whether the `POStrategicEA_ver12`
expert advisor is **safe to automate** and **viable for an FTMO challenge** —
*before* you risk real money or a challenge fee.

> ⚠️ **None of this creates an edge.** It is built to find out — cheaply — whether
> a genuine edge exists, and to remove the account-killing behaviors of the
> original settings. If the strategy only profits with the martingale "recovery"
> turned on, it does not work. Full stop.

---

## Why this exists (the original problem)

The EA as shipped is a **martingale/recovery system**: after a loss it opens a
trade at up to **10× the risk** (`RecoveryPositionRiskMultiplier=10`) with an
**inverted reward/risk** (`RiskRewardRatio=0.4` — risking more than the target).
That produces a smooth equity curve for months, then a single losing streak
erases the account. This toolkit strips that out and tests what's left honestly.

---

## The pipeline (do these IN ORDER)

| # | Step | Files | Pass gate |
|---|---|---|---|
| 1 | Honest backtest | `*_VALIDATION.ini` + `.set` | Out-of-sample PF > 1.2, DD < 20% |
| 2 | Independent sim | `backtest_sim.py` | Profitable with `--recovery off` |
| 3 | Demo forward test | `DEMO_FORWARD_TEST_PLAN.md` | Meets all pre-committed gates |
| 4 | FTMO sizing | `FTMO_PROP_PLAN.md` + `POStrategicEA_FTMO_100k.set` | Risk under the 10% wall |
| 5 | FTMO execution | `FTMO_EquityGuardian.mq5` + `FTMO_RUN_DAY_CHECKLIST.md` | No rule breaches |

**Never skip ahead.** A paid FTMO challenge is step 4+, only after 1–3 pass.

---

## File index

### Backtest configs (MT5 Strategy Tester)
- `POStrategicEA_EURUSD_VALIDATION.ini` / `.set`
- `POStrategicEA_GBPUSD_VALIDATION.ini` / `.set`
  - Forward (out-of-sample) ON, multi-year, martingale locked off, Sharpe-optimized.
  - `.ini` = full tester setup (Method B / command line). `.set` = inputs only
    (load via Inputs tab → right-click → Load).

### Independent simulator (no vendor binary needed)
- `backtest_sim.py` — pure Python 3, zero dependencies. Reconstructs the strategy
  from the `.set` and walks real price data. Compare recovery on/off:
  ```bash
  python3 backtest_sim.py --data EURUSD_H1.csv --set POStrategicEA_EURUSD_VALIDATION.set --recovery off --equity-out eq.csv
  python3 backtest_sim.py --data EURUSD_H1.csv --set POStrategicEA_EURUSD_VALIDATION.set --recovery on --rr 0.4 --recov-mult 10 --ruin-level 1000
  ```
  > Entry logic is a documented *reconstruction* (no `.mq5` source). Trust the
  > relative comparison, not absolute returns. Fix `detect_entry()` once you have
  > the real source.
- `equity_plot.py` — render the `--equity-out` curve to SVG (or PNG with matplotlib):
  ```bash
  python3 equity_plot.py --in eq.csv --out eq.svg
  ```

### Demo validation
- `DEMO_FORWARD_TEST_PLAN.md` — pre-committed pass/fail protocol (≥3 months /
  100+ trades), hard-fail triggers, prop-firm martingale caveat.

### FTMO use case
- `FTMO_PROP_PLAN.md` — rules summary, risk tables across all 5 account sizes ×
  3 profiles, trades-to-target averages, daily-loss gap, compliance checklist.
- `POStrategicEA_FTMO_100k.set` — live preset, $100k Balanced (0.5% risk),
  recovery off. Scale `OriginalPositionRiskAmount` per the plan's table.
- `FTMO_EquityGuardian.mq5` — defensive EA that flattens all trades before you
  breach the daily (4%) / total (8%) loss caps. Run alongside the trading EA.
- `FTMO_RUN_DAY_CHECKLIST.md` — printable daily discipline checklist.

### Safe baseline
- `EURUSD_84K_REVISED_SAFE.set` — the original preset, de-risked (martingale off,
  RR flipped positive, trailing on, ~1% risk).

---

## Recommended order of operations (quick version)

1. Export H1 CSV data for EURUSD & GBPUSD from MT5.
2. Run `backtest_sim.py` twice (recovery off vs on). If it needs recovery to
   profit → **stop**.
3. Run the `.ini`/`.set` in MT5 Strategy Tester. Check the **Forward** tab.
4. If both pass, run the **demo forward test** for months with FTMO-tight gates.
5. Only then: smallest FTMO `$10k` challenge, with the Guardian + checklist.
6. Scale up only after a pass **and** a clean funded month.

---

## Honest limitations (keep these in mind)

- No `.mq5` source → the simulator approximates entry logic; MT5 results are the
  reference, the sim is the cross-check.
- Prop-firm rules change — **verify FTMO's current terms at ftmo.com.**
- Demo ≠ live: shade demo results down ~10–20% for real slippage.
- The MQL5 guardian is written to spec but **compile and demo-test it yourself**
  before trusting it on a funded account.

---

## Bottom line

This kit makes the EA *eligible* and *survivable* for automated / FTMO use by
removing the auto-fail mechanics and sizing risk under the limits. Whether it is
ultimately **profitable** depends on a real, consistent out-of-sample edge at
≤ 0.5% risk with recovery off — which steps 1–3 are designed to reveal before
you spend a cent.
