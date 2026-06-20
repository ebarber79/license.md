# TradingView Setup & Recommended Settings — POStrategicEA port

How to load `POStrategicEA_TradingView.pine` and the settings that mirror the
FTMO-safe configuration. This is a **third independent engine** to cross-check
the MT5 Strategy Tester and `backtest_sim.py`.

> ⚠️ It reconstructs the strategy from `.set` parameters, not the vendor's source.
> Treat the **relative** results (recovery on vs off) as the signal, not the
> absolute profit numbers.

---

## 1. Load it

1. Open TradingView → bottom panel → **Pine Editor**.
2. Paste the contents of `POStrategicEA_TradingView.pine`.
3. Click **Add to chart**. It appears as a **strategy** (note the Strategy Tester
   tab at the bottom — that's your backtest).

## 2. Set the chart correctly (important)

- **Chart timeframe = your entry timeframe.** The `.set` used H1 (`EntryTF=16385`),
  so set the chart to **1 hour**. The script reads bars at the chart TF.
- Pick the symbol: **EURUSD** or **GBPUSD** (FX). Times in the inputs are **chart
  (exchange) time** — confirm your chart's session/timezone.

## 3. Recommended settings (FTMO-safe, matches `POStrategicEA_FTMO_100k.set`)

| Input | Value | Why |
|---|---|---|
| PastXCandlesForHighLow | **2** | breakout band length |
| Start hour / minute | **11 / 10** | mirrors `StartTime=11:10` |
| Hours to allow entry | **8** | window to catch the breakout |
| Direction | **Both** | `TakeOrders=3` |
| Risk % per trade | **0.5** | under the FTMO 10% wall (see plan) |
| RiskRewardRatio | **1.5** | reward ≥ risk (break-even WR 40%) |
| **EnableRecoveryTrade** | **OFF** | martingale = FTMO fail + blow-up risk |
| RecoveryPositionRiskMultiplier | 1 | irrelevant while recovery off |
| Enable trailing | **true** | lock profit |
| Start trailing after pips | 0.5 | |
| Trailing stop pips | 15 | |

Also set the Strategy **Properties** tab:
- Initial capital: **100000** (or your account size)
- Commission + slippage: add realistic values (e.g. commission 0.00007/contract,
  slippage 1–2 ticks) so the backtest isn't fantasy.

## 4. The decisive test (same as the other engines)

Run it **twice** and compare the Strategy Tester → Performance Summary:

1. **Recovery OFF, RR 1.5** — the honest config.
2. **Recovery ON, RR 0.4, Multiplier 10** — the original danger config.

If it only makes money in case 2, the "edge" is just the martingale → **do not
trade it.** Look at **Max Drawdown** and **Profit Factor**, not net profit.

## 5. Alerts (optional, for live signals)

The script exposes two `alertcondition`s: **Long breakout** and **Short breakout**.
Right-click chart → **Add alert** → Condition = the strategy → pick the breakout →
set delivery (app/email/webhook). Use these for manual or semi-automated signals.

---

## TradingView-specific caveats

- **Backtest realism:** Pine fills breakout **stop orders** intrabar, which is
  good, but TradingView can't model every tick on higher TFs — keep
  `process_orders_on_close` in mind and don't over-trust a perfect curve.
- **No partial-tick stops:** if SL and TP sit in one bar, results can be
  optimistic. Cross-check against the MT5 real-tick test.
- **Position sizing is approximate** (risk% / stop distance). For exact FTMO
  sizing, trust the MT5 preset; use TradingView for shape and logic validation.
- **Repaint:** entries are stop-order based and evaluated at the window start, so
  signals are stable, but always confirm on a replay before trusting alerts.

---

## Where it fits in the pipeline

| Engine | Strength | File |
|---|---|---|
| MT5 Strategy Tester | Real-tick, the reference | `*_VALIDATION.ini` |
| Python sim | Transparent, scriptable, recovery on/off | `backtest_sim.py` |
| **TradingView** | **Fast visual + multi-symbol, third opinion** | this file |

Agreement across all three (recovery off, positive RR, edge holds out-of-sample)
is strong evidence. Divergence is a flag to investigate before risking money.
