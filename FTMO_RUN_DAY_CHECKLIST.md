# FTMO Run-Day Checklist — POStrategicEA

Print this. Tick it every trading day. The goal is simple: **never breach a
rule, never let emotion override the plan.**

> ⚠️ Verify current FTMO limits at ftmo.com. Defaults assume 5% daily / 10% total.

---

## ☀️ Before the session (5 min)

- [ ] VPS / terminal online, stable connection, correct **server time**
- [ ] Correct account loaded (Challenge / Verification / Funded)
- [ ] Trading EA settings = FTMO preset: `EnableRecoveryTrade=false`, RR ≥ 1.5,
      risk = correct $ for this account size (see `FTMO_PROP_PLAN.md` table)
- [ ] **FTMO_EquityGuardian** attached on one chart, "OK" status showing
- [ ] AutoTrading button is **ON** (green)
- [ ] No high-impact news inside your `StartTime` window that you don't want
- [ ] Note today's **starting balance/equity** (your daily-loss baseline)

## 📊 Daily limits — know your two floors

| | Limit | Today's floor (fill in) |
|---|---|---|
| Daily loss (from day-start equity) | −5% | __________ |
| Total loss (from initial balance) | −10% | __________ |
| Guardian daily cut-off (buffer) | −4% | __________ |

## ⏱️ During the session

- [ ] Let the EA work — **do not** manually add trades or move stops
- [ ] Every open trade has a **real server-side SL** (check the Trade tab)
- [ ] Lot sizes look right (no escalation = recovery stayed off)
- [ ] Floating loss stays well clear of the daily floor
- [ ] If Guardian flips to **DAILY-LOCKED** → you're done for the day. Walk away.

## 🌙 End of day

- [ ] Log: P/L %, max drawdown today, trade count, biggest single loss %
- [ ] Biggest loss stayed ≈ your risk cap (0.5%)? If not, investigate **before** tomorrow
- [ ] Equity curve still trending the right way?
- [ ] Screenshot the FTMO dashboard (your own audit trail)

## 🛑 HARD STOP — pause everything and review if ANY occur

- [ ] One trade lost > 3% of balance → risk control is broken
- [ ] Drawdown approached the daily or total floor
- [ ] Recovery/martingale lot escalation appeared
- [ ] A trade ran without a server-side SL
- [ ] Guardian had to flatten you (understand *why* before resuming)

## 📅 Weekly review

- [ ] Profit factor still > 1.2 out-of-sample?
- [ ] Drawdown comfortably < 7% (FTMO-tight gate)?
- [ ] Behavior on demo ≈ behavior live? (forward test still matches)
- [ ] On track for the profit target without forcing trades?

---

### Mindset rules (the part that actually fails people)
1. **The fee is sunk. Capital preservation > hitting the target.** A blown
   challenge costs the fee; over-risking to "make it back" costs the account.
2. **No revenge trading, no manual overrides.** If you don't trust the EA enough
   to leave it alone, it isn't ready for funded.
3. **Slow is fine.** No time limit (verify) means patience beats aggression.
4. **If it only works with recovery ON, it doesn't work.** Don't be tempted.
