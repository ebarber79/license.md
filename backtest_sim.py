#!/usr/bin/env python3
"""
backtest_sim.py  -  Independent, transparent backtester for the
POStrategicEA-style strategy.

WHY THIS EXISTS
---------------
The vendor EA ships as a compiled .ex5 (no source). This script does NOT
run that binary. Instead it reconstructs the strategy from the *parameter
names* in the .set file and lets you test the one thing that matters most:
does the strategy stand on its own, or only on the martingale "recovery"?

HONEST LIMITATIONS  (read before trusting any number)
-----------------------------------------------------
1. The entry logic below is an INFERRED reconstruction (a time-of-day
   previous-candles breakout). It is almost certainly NOT identical to the
   vendor's code. Treat absolute returns with suspicion; treat the
   *relative* comparison (recovery ON vs OFF, RR>1 vs RR<1) as the signal.
2. Intrabar fills are resolved CONSERVATIVELY: if both stop and target sit
   inside one bar, the stop is assumed hit first.
3. Data must already be at the entry timeframe (e.g. H1 bars) as CSV.
4. When you obtain the real .mq5, fix `detect_entry()` / `build_levels()`
   to match it. Everything else (sizing, recovery, trailing, metrics) is
   strategy-agnostic and stays valid.

USAGE
-----
    python3 backtest_sim.py --data EURUSD_H1.csv --set POStrategicEA_EURUSD_VALIDATION.set
    python3 backtest_sim.py --data EURUSD_H1.csv --recovery off --rr 1.5
    python3 backtest_sim.py --data EURUSD_H1.csv --recovery on  --rr 0.4 --recov-mult 10

CSV format (header required, names flexible via --cols):
    datetime,open,high,low,close
    2015-01-02 00:00,1.2098,1.2105,1.2090,1.2101
"""

import argparse
import csv
import math
from datetime import datetime, date


# --------------------------------------------------------------------------
# Parameter handling
# --------------------------------------------------------------------------
def parse_set(path):
    """Read an MT5 .set / [TesterInputs] file -> {name: first_value}."""
    params = {}
    with open(path, "r", encoding="utf-8", errors="ignore") as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith(";") or "=" not in line:
                continue
            name, rest = line.split("=", 1)
            value = rest.split("||", 1)[0].strip()
            params[name.strip()] = value
    return params


def as_bool(v, default=False):
    if v is None:
        return default
    return str(v).strip().lower() in ("true", "1", "yes", "y")


def as_float(v, default):
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


# --------------------------------------------------------------------------
# Data
# --------------------------------------------------------------------------
class Bar:
    __slots__ = ("dt", "o", "h", "l", "c")

    def __init__(self, dt, o, h, l, c):
        self.dt, self.o, self.h, self.l, self.c = dt, o, h, l, c


def load_csv(path, cols, dtfmt):
    idx = {k: i for i, k in enumerate(cols.split(","))}
    bars = []
    with open(path, newline="") as fh:
        reader = csv.reader(fh)
        header = next(reader, None)  # skip header row
        for row in reader:
            if not row or len(row) < 5:
                continue
            try:
                raw = row[idx["datetime"]].strip()
                dt = datetime.strptime(raw, dtfmt) if dtfmt else _autodate(raw)
                bars.append(Bar(
                    dt,
                    float(row[idx["open"]]),
                    float(row[idx["high"]]),
                    float(row[idx["low"]]),
                    float(row[idx["close"]]),
                ))
            except (ValueError, KeyError, IndexError):
                continue
    bars.sort(key=lambda b: b.dt)
    return bars


def _autodate(s):
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M",
                "%Y.%m.%d %H:%M:%S", "%Y.%m.%d %H:%M",
                "%Y-%m-%d", "%Y.%m.%d"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    raise ValueError("Unrecognised datetime: %r (use --dtfmt)" % s)


# --------------------------------------------------------------------------
# Strategy reconstruction  (EDIT HERE once you have the real .mq5)
# --------------------------------------------------------------------------
def build_levels(window):
    """Reference breakout band from the prior X candles."""
    ref_high = max(b.h for b in window)
    ref_low = min(b.l for b in window)
    return ref_high, ref_low


def detect_entry(bars, start, ref_high, ref_low, same_day):
    """Scan forward (within the signal day) for a breakout of the band.
    Returns (direction, entry_price, entry_index) or None.
    Conservative: if a single bar breaches both sides, skip (ambiguous)."""
    for i in range(start, len(bars)):
        b = bars[i]
        if b.dt.date() != same_day:
            return None  # no breakout during the signal day
        up = b.h >= ref_high
        dn = b.l <= ref_low
        if up and dn:
            return None
        if up:
            return ("long", ref_high, i)
        if dn:
            return ("short", ref_low, i)
    return None


# --------------------------------------------------------------------------
# Trade execution (sizing, stop/target, trailing) -- strategy agnostic
# --------------------------------------------------------------------------
def run_trade(bars, entry_idx, direction, entry, ref_high, ref_low,
              risk, rr, cfg, max_hold=2000):
    """Walk bars from entry to exit. Returns realised PnL in account ccy."""
    dist = ref_high - ref_low
    if dist <= 0:
        return None
    # value per price unit so that hitting the stop loses exactly `risk`
    if cfg["mm"]:
        vpp = risk / dist
    else:
        vpp = cfg["lots"] * cfg["contract"]

    if direction == "long":
        stop = ref_low
        target = entry + rr * dist
    else:
        stop = ref_high
        target = entry - rr * dist

    trail_on = cfg["trail_on"]
    start_trail = cfg["trail_start_pips"] * cfg["pip"]
    trail_dist = cfg["trail_stop_pips"] * cfg["pip"]
    activated = False

    end = min(len(bars), entry_idx + max_hold)
    for i in range(entry_idx, end):
        b = bars[i]
        if direction == "long":
            # 1) adverse check first (conservative)
            if b.l <= stop:
                return vpp * (stop - entry)
            if b.h >= target:
                return vpp * (target - entry)
            # 2) update trailing using the favourable extreme
            if trail_on:
                if not activated and (b.h - entry) >= start_trail:
                    activated = True
                if activated:
                    stop = max(stop, b.h - trail_dist)
        else:
            if b.h >= stop:
                return vpp * (entry - stop)
            if b.l <= target:
                return vpp * (entry - target)
            if trail_on:
                if not activated and (entry - b.l) >= start_trail:
                    activated = True
                if activated:
                    stop = min(stop, b.l + trail_dist)
    # timed out -> mark to last close
    last = bars[end - 1].c
    return vpp * (last - entry) if direction == "long" else vpp * (entry - last)


# --------------------------------------------------------------------------
# Backtest loop
# --------------------------------------------------------------------------
def backtest(bars, cfg):
    balance = cfg["start_balance"]
    peak = balance
    equity_curve = [(bars[0].dt, balance)] if bars else []
    trades = []  # (dt, pnl, balance_after, was_recovery)
    max_dd = 0.0
    armed_days = set()
    last_loss = False
    x = cfg["pastx"]
    sh, sm = cfg["start_time"]

    i = x
    while i < len(bars):
        b = bars[i]
        d = b.dt.date()
        if d in armed_days or (b.dt.hour, b.dt.minute) < (sh, sm):
            i += 1
            continue
        armed_days.add(d)

        ref_high, ref_low = build_levels(bars[i - x:i])
        sig = detect_entry(bars, i, ref_high, ref_low, d)
        if not sig:
            i += 1
            continue
        direction, entry, eidx = sig

        # recovery sizing
        is_recovery = cfg["recovery"] and last_loss
        if is_recovery:
            risk = cfg["risk"] * cfg["recov_mult"]
            rr = cfg["recov_rr"]
        else:
            risk = cfg["risk"]
            rr = cfg["rr"]

        pnl = run_trade(bars, eidx, direction, entry, ref_high, ref_low,
                        risk, rr, cfg)
        if pnl is None:
            i += 1
            continue

        balance += pnl
        peak = max(peak, balance)
        if peak > 0:
            max_dd = max(max_dd, (peak - balance) / peak)
        trades.append((b.dt, pnl, balance, is_recovery))
        equity_curve.append((b.dt, balance))
        last_loss = pnl < 0

        if balance <= cfg["ruin_level"]:
            trades.append((b.dt, 0.0, balance, False))  # marker
            break

        # resume after the exit bar
        i = max(eidx + 1, i + 1)

    return {"balance": balance, "trades": trades, "max_dd": max_dd,
            "equity": equity_curve, "blown": balance <= cfg["ruin_level"]}


# --------------------------------------------------------------------------
# Metrics & reporting
# --------------------------------------------------------------------------
def metrics(res, start_balance, label):
    trades = [t for t in res["trades"] if t[1] != 0.0 or True]
    pnls = [t[1] for t in res["trades"]]
    # drop the ruin marker (last zero) if present
    if res["blown"] and pnls and pnls[-1] == 0.0:
        pnls = pnls[:-1]
    n = len(pnls)
    wins = [p for p in pnls if p > 0]
    losses = [p for p in pnls if p < 0]
    gross_win = sum(wins)
    gross_loss = -sum(losses)
    pf = (gross_win / gross_loss) if gross_loss > 0 else float("inf")
    win_rate = (len(wins) / n * 100) if n else 0.0
    net = res["balance"] - start_balance
    # per-trade Sharpe (not annualised)
    if n > 1:
        mean = sum(pnls) / n
        var = sum((p - mean) ** 2 for p in pnls) / (n - 1)
        sd = math.sqrt(var)
        sharpe = (mean / sd) if sd > 0 else 0.0
    else:
        sharpe = 0.0
    # longest losing streak
    streak = worst = 0
    for p in pnls:
        if p < 0:
            streak += 1
            worst = max(worst, streak)
        else:
            streak = 0

    print("\n=== %s ===" % label)
    print("  Trades ................ %d" % n)
    print("  Win rate .............. %.1f%%" % win_rate)
    print("  Net profit ............ %.2f  (%.1f%% of start)"
          % (net, (net / start_balance * 100) if start_balance else 0))
    print("  Final balance ......... %.2f" % res["balance"])
    print("  Profit factor ......... %s" % ("inf" if pf == float("inf") else "%.2f" % pf))
    print("  Max drawdown .......... %.1f%%" % (res["max_dd"] * 100))
    print("  Longest losing streak . %d" % worst)
    print("  Per-trade Sharpe ...... %.3f" % sharpe)
    if res["blown"]:
        print("  *** ACCOUNT BLEW UP (hit ruin level) ***")
    # verdict heuristic
    flag = "PASS-ish" if (pf >= 1.2 and res["max_dd"] < 0.20 and not res["blown"]) else "FAIL"
    print("  Heuristic verdict ..... %s" % flag)
    return {"pf": pf, "dd": res["max_dd"], "net": net, "blown": res["blown"]}


def split_bars(bars, oos_frac):
    if not bars or oos_frac <= 0:
        return bars, []
    cut = int(len(bars) * (1 - oos_frac))
    return bars[:cut], bars[cut:]


# --------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description="Independent POStrategicEA-style backtester")
    ap.add_argument("--data", required=True, help="CSV of OHLC bars at the entry timeframe")
    ap.add_argument("--set", dest="setfile", help="Optional .set file to seed parameters")
    ap.add_argument("--cols", default="datetime,open,high,low,close")
    ap.add_argument("--dtfmt", default="", help="strptime format; blank = auto-detect")
    ap.add_argument("--start-balance", type=float, default=100000.0)
    ap.add_argument("--ruin-level", type=float, default=0.0, help="Stop if balance <= this")
    ap.add_argument("--oos", type=float, default=1/3, help="Out-of-sample fraction (0 disables)")
    # strategy overrides (else taken from --set / defaults)
    ap.add_argument("--recovery", choices=["on", "off"], help="Force martingale recovery")
    ap.add_argument("--rr", type=float, help="Override RiskRewardRatio")
    ap.add_argument("--recov-mult", type=float, help="Override RecoveryPositionRiskMultiplier")
    ap.add_argument("--recov-rr", type=float, help="Override RecoveryRiskRewardRatio")
    ap.add_argument("--risk", type=float, help="Override OriginalPositionRiskAmount")
    ap.add_argument("--pip", type=float, default=0.0001, help="Pip size (FX=0.0001, JPY=0.01)")
    ap.add_argument("--contract", type=float, default=100000.0)
    ap.add_argument("--equity-out", help="Write equity curve CSV here")
    args = ap.parse_args()

    p = parse_set(args.setfile) if args.setfile else {}

    def stime(v):
        try:
            hh, mm = str(v).split(":")
            return int(hh), int(mm)
        except Exception:
            return (0, 0)

    cfg = {
        "pastx": int(as_float(p.get("PastXCandlesForHighLow"), 2)),
        "start_time": stime(p.get("StartTime", "00:00")),
        "mm": as_bool(p.get("MoneyManagement"), True),
        "lots": as_float(p.get("Lotsize"), 0.1),
        "risk": args.risk if args.risk is not None
                else as_float(p.get("OriginalPositionRiskAmount"), 1000.0),
        "rr": args.rr if args.rr is not None
              else as_float(p.get("RiskRewardRatio"), 1.5),
        "recovery": (args.recovery == "on") if args.recovery
                    else as_bool(p.get("EnableRecoveryTrade"), False),
        "recov_mult": args.recov_mult if args.recov_mult is not None
                      else as_float(p.get("RecoveryPositionRiskMultiplier"), 1.0),
        "recov_rr": args.recov_rr if args.recov_rr is not None
                    else as_float(p.get("RecoveryRiskRewardRatio"), 1.5),
        "trail_on": as_bool(p.get("EnableTrailingOnRecoveryTradeOrig"), False),
        "trail_start_pips": as_float(p.get("StartTrailingAfterPipsProfitOnTradeOrig"), 0.5),
        "trail_stop_pips": as_float(p.get("TrailingStopPipsOrig"), 15.0),
        "pip": args.pip,
        "contract": args.contract,
        "start_balance": args.start_balance,
        "ruin_level": args.ruin_level,
    }

    bars = load_csv(args.data, args.cols, args.dtfmt or None)
    if len(bars) < cfg["pastx"] + 10:
        raise SystemExit("Not enough bars loaded (%d). Check --cols / --dtfmt." % len(bars))

    print("Loaded %d bars: %s -> %s" % (len(bars), bars[0].dt, bars[-1].dt))
    print("Config: recovery=%s  rr=%.2f  recov_mult=%.1f  risk=%.0f  trail=%s"
          % (cfg["recovery"], cfg["rr"], cfg["recov_mult"], cfg["risk"], cfg["trail_on"]))

    is_bars, oos_bars = split_bars(bars, args.oos)

    full = backtest(bars, cfg)
    metrics(full, cfg["start_balance"], "FULL SAMPLE")

    if oos_bars:
        m_is = backtest(is_bars, cfg)
        metrics(m_is, cfg["start_balance"], "IN-SAMPLE (first %d%%)" % int((1-args.oos)*100))
        cfg_oos = dict(cfg)  # fresh balance for OOS
        m_oos = backtest(oos_bars, cfg_oos)
        metrics(m_oos, cfg["start_balance"], "OUT-OF-SAMPLE (last %d%%)" % int(args.oos*100))
        print("\n>>> The OUT-OF-SAMPLE block is the one that matters. If it")
        print(">>> collapses while in-sample looked good, the edge was curve-fit.")

    if args.equity_out:
        with open(args.equity_out, "w", newline="") as fh:
            w = csv.writer(fh)
            w.writerow(["datetime", "balance"])
            for dt, bal in full["equity"]:
                w.writerow([dt.isoformat(), "%.2f" % bal])
        print("\nEquity curve written to %s" % args.equity_out)


if __name__ == "__main__":
    main()
