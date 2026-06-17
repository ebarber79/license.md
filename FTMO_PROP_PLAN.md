# FTMO Use-Case Plan — POStrategicEA (recovery OFF)

> ⚠️ **Verify before trusting.** Prop firms change rules frequently. These are
> FTMO's *commonly published* terms; confirm the current numbers on ftmo.com
> before risking a challenge fee. Figures here are **illustrative averages**,
> not promises.

---

## 1. FTMO rules that constrain this EA (typical)

| Phase | Profit target | Max daily loss | Max total loss | Min trading days |
|---|---|---|---|---|
| Challenge (Step 1) | **+10%** | **5%** | **10%** | 4 |
| Verification (Step 2) | **+5%** | **5%** | **10%** | 4 |
| Funded | — (keep profits) | 5% | 10% | — |

Key mechanics:
- **Max total loss** = a static line at **90% of starting balance**. Touch it = fail.
- **Max daily loss** = 5% measured from the **day's starting balance/equity**,
  and it **includes floating (open) P/L**. Touch it = fail.
- Recent terms removed the calendar time limit (verify), but you still need
  **≥ 4 trading days**.

**The binding constraint is the 10% max loss — not the profit target.** Everything
below is sized so a losing streak can't breach it.

---

## 2. Why recovery MUST stay off here

The original `RecoveryPositionRiskMultiplier=10` risks ~10% of a $100k account in
a *single* recovery trade. On FTMO that is an **instant fail** on one bad trade —
and high-risk "recovery/gambling" behavior also risks tripping FTMO's conduct
rules. Keep `EnableRecoveryTrade=false`. Non-negotiable for prop.

---

## 3. Risk sizing — the "generic averages"

With `MoneyManagement=true`, `OriginalPositionRiskAmount` is a **dollar risk per
trade**. Pick a profile, then read your account-size row.

### Per-trade risk by profile

| Profile | Risk/trade | Losses to hit 10% wall | Verdict for FTMO |
|---|---|---|---|
| **Conservative** | 0.25% | 40 in a row | Safest, slowest |
| **Balanced** (recommended) | 0.50% | 20 in a row | Best survivability/speed trade-off |
| **Aggressive** | 1.00% | 10 in a row | Risky — one streak can fail you |

### Dollar risk per trade by FTMO account size

| Account | 0.25% (Cons.) | 0.50% (Balanced) | 1.00% (Aggr.) |
|---|---|---|---|
| $10,000  | $25   | **$50**   | $100  |
| $25,000  | $62   | **$125**  | $250  |
| $50,000  | $125  | **$250**  | $500  |
| $100,000 | $250  | **$500**  | $1,000 |
| $200,000 | $500  | **$1,000** | $2,000 |

> Set `OriginalPositionRiskAmount` to the **Balanced** column unless your own
> forward test justifies otherwise.

---

## 4. How long to pass (averages, RR = 1.5, Balanced 0.5%)

Break-even win rate at RR 1.5 is **40%**. Above that you have positive
expectancy. Rough trades-to-target for the +10% Step 1 (ignores variance/compounding):

| Win rate | Edge / trade | ~Trades to +10% | Worst-streak risk* |
|---|---|---|---|
| 45% | +0.06% | ~160 | low |
| 50% | +0.125% | ~80 | low |
| 55% | +0.19% | ~55 | low |
| 60% | +0.25% | ~40 | low |

\*At 0.5% risk a 10-loss streak is only 5% drawdown — half the FTMO wall. That
headroom is the whole point of the Balanced profile.

**Reality check:** this EA takes ~1 trade/day, so 40–160 trades ≈ months. With no
time limit that's fine — but it means **patience**, and it means the demo forward
test (below) must run long enough to be meaningful.

---

## 5. The daily-loss gap (important)

This EA has **no built-in daily-loss stop**. FTMO fails you the instant floating
losses hit 5% on the day. Options:
1. **Hard cap risk so the math can't breach it.** At 0.5%/trade and max 3 trades/day
   (`TakeOrders=3`), worst realistic day ≈ 1.5% — safely under 5%. This alone is
   usually enough.
2. **Add an equity-guardian** EA/script that force-closes everything and disables
   trading at, say, −4% on the day. Recommended belt-and-suspenders for funded.

---

## 6. Recommended path (do NOT pay the fee first)

1. **Backtest** with the FTMO config (recovery off, RR ≥ 1.5, Balanced risk) →
   out-of-sample PF > 1.2, drawdown < 8%.
2. **Sim cross-check** (`backtest_sim.py --recovery off`).
3. **Demo forward test** per `DEMO_FORWARD_TEST_PLAN.md`, but with **FTMO-tight
   gates**: if demo drawdown ever exceeds ~7%, it will eventually fail a real
   challenge — fix or abandon.
4. **Only then** buy the **smallest** FTMO challenge ($10k) as a live proof.
   Scale up account size *after* a pass + a funded month, not before.

---

## 7. FTMO compliance checklist

- [ ] `EnableRecoveryTrade = false`
- [ ] Risk/trade ≤ 0.5% (per table above)
- [ ] No martingale/grid lot escalation anywhere
- [ ] Real server-side SL on every trade (not virtual)
- [ ] Daily worst-case (risk × max trades/day) < 5%
- [ ] Worst-streak drawdown < 10% (with margin)
- [ ] Read FTMO's current Terms for EA / strategy restrictions
- [ ] ≥ 4 trading days achievable

---

## 8. Bottom line

The tooling makes the EA **eligible** for an FTMO attempt by removing the
auto-fail behaviors and sizing risk under the 10% wall. It does **not** create an
edge. If Steps 1–3 don't show a genuine, consistent out-of-sample edge at ≤ 0.5%
risk, no configuration will pass FTMO over time — you'd just be paying fees on
variance.
