# Demo Forward-Test Plan — POStrategicEA_ver12

A disciplined, self-honest protocol for deciding whether this EA is safe to
fund. **Backtests can be curve-fit; a forward test on a demo cannot.** This is
the gate the strategy must pass *before* any real or prop-firm money.

> Golden rule: decide the pass/fail rules **now**, in writing, before you see
> any results. Do not move the goalposts once trades start.

---

## Phase 0 — Setup (Day 0)

| Item | Requirement |
|---|---|
| Account | Free MT5 **demo**, reputable broker (IC Markets, Pepperstone, Oanda, etc.) |
| Balance | Match your *real* intended starting capital (don't test 100k if you'll fund 5k) |
| Leverage | Same as you'll trade live (e.g. 1:100) |
| EA build | `POStrategicEA_ver12.ex5`, license activated |
| Settings | The **risk-sane** preset: `EnableRecoveryTrade=false`, `RiskRewardRatio>=1.5`, per-trade risk **= 1% of balance** |
| Platform | Run on a **VPS** or always-on machine — gaps/restarts invalidate results |
| Symbols | EURUSD and GBPUSD in parallel (separate charts, same settings) |

Record the broker, spread type, commission, and server time before you start.

---

## Phase 1 — Minimum duration

- **Run for at least 3 months**, or **100+ trades per symbol**, whichever comes later.
- Rationale: martingale/streak risk only shows up across a bad run. A 2-week
  "it's up 8%!" tells you nothing.
- **Do not** touch settings mid-test. If you change anything, the clock resets.

---

## Phase 2 — What to record (weekly)

Keep a simple log (the included `backtest_sim.py --equity-out` format works, or a
spreadsheet):

- Net P/L (% of starting balance)
- Max drawdown so far (% from peak) — **the number that matters most**
- Trade count, win rate
- Longest losing streak
- Largest single loss (as % of balance) — must stay near your 1% risk cap
- Any anomalies: stop not honored, lot size larger than expected, slippage spikes,
  trades outside the `StartTime` window

---

## Phase 3 — PASS / FAIL criteria (decide before you start)

### Hard FAIL — stop immediately if ANY occur
- [ ] A single trade loses **> 3%** of balance (means risk control is broken)
- [ ] Drawdown exceeds **20%** at any point
- [ ] You discover `EnableRecoveryTrade` silently re-enabled or lot sizes escalating
- [ ] Stops are "virtual" (no real SL on the server) — check the open orders
- [ ] Equity curve makes new lows for **6+ consecutive weeks**

### PASS — all must be true at the end of the window
- [ ] Profit factor **> 1.2** on each symbol
- [ ] Max drawdown **< 20%**
- [ ] Profitable, or roughly flat, on **both** symbols (consistency = real edge)
- [ ] Largest loss stayed within ~1% (risk cap held)
- [ ] Forward result is in the same ballpark as the honest backtest (`.ini`/`.set`)

### MARGINAL — extend, don't fund
- Mixed results, shallow profit, or one symbol good / one poor → run another
  1–2 months. Do not graduate to funded on a coin-flip.

---

## Phase 4 — Only after PASS

1. **Prop-firm note:** most firms (FTMO etc.) **ban martingale/grid/recovery
   EAs**. With recovery OFF you're likely compliant, but read their rules — a
   ToS breach voids payouts.
2. Fund the **smallest** account that proves the point. Scale only after a live
   month matches the demo.
3. Re-run this whole plan if you change broker, symbol, or any setting.

---

## Reality checks (keep these honest)

- **Demo ≠ live.** Real fills have worse slippage and requotes. Shade your demo
  results down ~10–20% in your head.
- **Survivorship bias.** "My friend's is profitable" ignores the accounts that
  blew up silently. Trust *your* logged forward test, nothing else.
- **The vendor's track record** should be an audited Myfxbook/broker statement
  showing **drawdown**, not a cherry-picked equity screenshot.
- If it only works with the martingale ON, it does not work. Full stop.

---

## Companion tools in this repo

- `POStrategicEA_EURUSD_VALIDATION.ini` / `.set` — honest backtest, EURUSD
- `POStrategicEA_GBPUSD_VALIDATION.ini` / `.set` — honest backtest, GBPUSD
- `backtest_sim.py` — independent simulator; compare recovery ON vs OFF:
  ```
  python3 backtest_sim.py --data EURUSD_H1.csv --set POStrategicEA_EURUSD_VALIDATION.set --recovery off
  python3 backtest_sim.py --data EURUSD_H1.csv --set POStrategicEA_EURUSD_VALIDATION.set --recovery on --rr 0.4 --recov-mult 10
  ```
