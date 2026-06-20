#!/usr/bin/env python3
"""
equity_plot.py  -  Render the equity curve produced by backtest_sim.py
(--equity-out) into a chart for a quick visual gut-check.

Dependency-free by default: writes a self-contained SVG (opens in any
browser). If matplotlib is installed and you pass --png, it writes a PNG
instead.

The shape is what matters: a steady climb is healthy; long flat-then-cliff
is the martingale signature you do NOT want.

USAGE
    python3 backtest_sim.py --data EURUSD_H1.csv --set ...set --equity-out eq.csv
    python3 equity_plot.py --in eq.csv --out eq.svg
    python3 equity_plot.py --in eq.csv --out eq.png --png   (needs matplotlib)
"""

import argparse
import csv
from datetime import datetime


def load_curve(path):
    xs, ys = [], []
    with open(path, newline="") as fh:
        reader = csv.reader(fh)
        next(reader, None)  # header
        for row in reader:
            if len(row) < 2:
                continue
            try:
                ys.append(float(row[1]))
                xs.append(row[0])
            except ValueError:
                continue
    return xs, ys


def max_drawdown(ys):
    peak = ys[0]
    mdd = 0.0
    for v in ys:
        peak = max(peak, v)
        if peak > 0:
            mdd = max(mdd, (peak - v) / peak)
    return mdd * 100.0


def render_svg(xs, ys, out, width=960, height=420, pad=60):
    lo, hi = min(ys), max(ys)
    rng = (hi - lo) or 1.0
    n = len(ys)
    plot_w = width - 2 * pad
    plot_h = height - 2 * pad

    def px(i):
        return pad + (plot_w * i / max(1, n - 1))

    def py(v):
        return pad + plot_h * (1 - (v - lo) / rng)

    pts = " ".join("%.1f,%.1f" % (px(i), py(v)) for i, v in enumerate(ys))
    start_bal = ys[0]
    final_bal = ys[-1]
    color = "#1a9850" if final_bal >= start_bal else "#d73027"
    mdd = max_drawdown(ys)

    # y gridlines (5 ticks)
    grid = []
    for k in range(5):
        v = lo + rng * k / 4
        y = py(v)
        grid.append('<line x1="%d" y1="%.1f" x2="%d" y2="%.1f" stroke="#eee"/>'
                    % (pad, y, width - pad, y))
        grid.append('<text x="%d" y="%.1f" font-size="11" fill="#666" '
                    'text-anchor="end">%.0f</text>' % (pad - 6, y + 4, v))

    # baseline (starting balance) reference
    base_y = py(start_bal)

    svg = f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" font-family="sans-serif">
  <rect width="{width}" height="{height}" fill="white"/>
  <text x="{pad}" y="28" font-size="16" font-weight="bold" fill="#222">Equity Curve</text>
  <text x="{pad}" y="46" font-size="12" fill="#555">
    start {start_bal:.0f} &#8594; final {final_bal:.0f}  |  max drawdown {mdd:.1f}%  |  {n} points</text>
  {''.join(grid)}
  <line x1="{pad}" y1="{base_y:.1f}" x2="{width-pad}" y2="{base_y:.1f}" stroke="#bbb" stroke-dasharray="4 4"/>
  <polyline fill="none" stroke="{color}" stroke-width="2" points="{pts}"/>
  <line x1="{pad}" y1="{pad}" x2="{pad}" y2="{height-pad}" stroke="#888"/>
  <line x1="{pad}" y1="{height-pad}" x2="{width-pad}" y2="{height-pad}" stroke="#888"/>
  <text x="{pad}" y="{height-pad+22}" font-size="11" fill="#666">{xs[0] if xs else ''}</text>
  <text x="{width-pad}" y="{height-pad+22}" font-size="11" fill="#666" text-anchor="end">{xs[-1] if xs else ''}</text>
</svg>"""
    with open(out, "w", encoding="utf-8") as fh:
        fh.write(svg)
    print("Wrote SVG: %s  (final %.0f, max DD %.1f%%)" % (out, final_bal, mdd))


def render_png(xs, ys, out):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    mdd = max_drawdown(ys)
    color = "#1a9850" if ys[-1] >= ys[0] else "#d73027"
    plt.figure(figsize=(10, 4.4))
    plt.plot(range(len(ys)), ys, color=color, lw=1.6)
    plt.axhline(ys[0], color="#bbb", ls="--", lw=1)
    plt.title("Equity Curve  |  start %.0f -> final %.0f  |  max DD %.1f%%"
              % (ys[0], ys[-1], mdd))
    plt.xlabel("trade #"); plt.ylabel("balance")
    plt.tight_layout()
    plt.savefig(out, dpi=120)
    print("Wrote PNG: %s  (final %.0f, max DD %.1f%%)" % (out, ys[-1], mdd))


def main():
    ap = argparse.ArgumentParser(description="Plot equity curve from backtest_sim.py output")
    ap.add_argument("--in", dest="infile", required=True, help="equity CSV (datetime,balance)")
    ap.add_argument("--out", default="equity.svg", help="output file")
    ap.add_argument("--png", action="store_true", help="render PNG via matplotlib (else SVG)")
    args = ap.parse_args()

    xs, ys = load_curve(args.infile)
    if len(ys) < 2:
        raise SystemExit("Need at least 2 equity points in %s" % args.infile)

    if args.png:
        try:
            render_png(xs, ys, args.out)
        except ImportError:
            alt = args.out.rsplit(".", 1)[0] + ".svg"
            print("matplotlib not available; writing SVG instead -> %s" % alt)
            render_svg(xs, ys, alt)
    else:
        render_svg(xs, ys, args.out)


if __name__ == "__main__":
    main()
