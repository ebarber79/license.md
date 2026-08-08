#!/usr/bin/env python3
"""Local LEAN-style backtesting MCP server using backtrader + yfinance/CSV."""

import json
import os
import sys
import io
import traceback
import contextlib
from datetime import datetime, date
from typing import Any

import numpy as np
import pandas as pd
import backtrader as bt
import ta

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("lean-local")

# Directory where the user drops CSV files: ~/lean-data/<TICKER>.csv
DATA_DIR = os.path.expanduser("~/lean-data")
os.makedirs(DATA_DIR, exist_ok=True)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _load_csv(ticker: str, start: str, end: str) -> pd.DataFrame | None:
    """Load OHLCV data from ~/lean-data/<TICKER>.csv if it exists.

    Expected columns (case-insensitive): date, open, high, low, close, volume
    """
    path = os.path.join(DATA_DIR, f"{ticker}.csv")
    if not os.path.exists(path):
        path = os.path.join(DATA_DIR, f"{ticker.upper()}.csv")
    if not os.path.exists(path):
        return None

    df = pd.read_csv(path)
    df.columns = [c.strip().lower() for c in df.columns]
    date_col = next((c for c in df.columns if "date" in c or "time" in c), None)
    if date_col is None:
        raise ValueError(f"CSV {path} has no date/time column")
    df["date"] = pd.to_datetime(df[date_col])
    df = df.set_index("date").sort_index()
    rename = {}
    for col in df.columns:
        lc = col.lower()
        if lc in ("open", "high", "low", "close", "volume", "adj close", "adj_close"):
            rename[col] = lc.replace(" ", "_").replace("adj_close", "close")
    df = df.rename(columns=rename)
    for req in ("open", "high", "low", "close"):
        if req not in df.columns:
            raise ValueError(f"CSV {path} missing required column '{req}'")
    if "volume" not in df.columns:
        df["volume"] = 0
    df = df[["open", "high", "low", "close", "volume"]]
    df.columns = ["Open", "High", "Low", "Close", "Volume"]
    mask = (df.index >= pd.Timestamp(start)) & (df.index <= pd.Timestamp(end))
    return df[mask]


def _fetch_ohlcv(ticker: str, start: str, end: str, interval: str = "1d") -> pd.DataFrame:
    # 1. Try local CSV first
    df = _load_csv(ticker, start, end)
    if df is not None and not df.empty:
        return df

    # 2. Try yfinance (may be blocked in some environments)
    try:
        import yfinance as yf
        df = yf.download(ticker, start=start, end=end, interval=interval,
                         auto_adjust=True, progress=False)
        if not df.empty:
            df.columns = [c[0] if isinstance(c, tuple) else c for c in df.columns]
            df.index = pd.to_datetime(df.index)
            return df
    except Exception:
        pass

    raise ValueError(
        f"No data for {ticker} [{start}→{end}]. "
        f"Drop a CSV at ~/lean-data/{ticker}.csv (columns: date,open,high,low,close,volume) "
        f"or use generate_synthetic_ohlcv to create test data."
    )


def _series_to_list(s: pd.Series, round_digits: int = 4) -> list:
    return [round(float(v), round_digits) if pd.notna(v) else None for v in s]


def _bt_run(strategy_cls, data_feed, **kwargs) -> dict:
    cerebro = bt.Cerebro()
    cerebro.adddata(data_feed)
    cerebro.addstrategy(strategy_cls, **kwargs)
    cerebro.broker.setcash(kwargs.get("cash", 100_000))
    cerebro.broker.setcommission(commission=kwargs.get("commission", 0.001))
    cerebro.addanalyzer(bt.analyzers.SharpeRatio, _name="sharpe", riskfreerate=0.04, annualize=True)
    cerebro.addanalyzer(bt.analyzers.DrawDown, _name="drawdown")
    cerebro.addanalyzer(bt.analyzers.Returns, _name="returns")
    cerebro.addanalyzer(bt.analyzers.TradeAnalyzer, _name="trades")

    start_cash = cerebro.broker.getvalue()
    results = cerebro.run()
    end_cash = cerebro.broker.getvalue()
    strat = results[0]

    sharpe = strat.analyzers.sharpe.get_analysis().get("sharperatio")
    dd = strat.analyzers.drawdown.get_analysis()
    rets = strat.analyzers.returns.get_analysis()
    trades = strat.analyzers.trades.get_analysis()

    total_trades = trades.get("total", {}).get("total", 0) if trades else 0
    won = trades.get("won", {}).get("total", 0) if trades else 0
    win_rate = round(won / total_trades, 4) if total_trades else None

    return {
        "start_cash": round(start_cash, 2),
        "end_cash": round(end_cash, 2),
        "total_return_pct": round((end_cash / start_cash - 1) * 100, 4),
        "sharpe_ratio": round(sharpe, 4) if sharpe else None,
        "max_drawdown_pct": round(dd.get("max", {}).get("drawdown", 0), 4),
        "total_trades": total_trades,
        "win_rate": win_rate,
        "cagr_pct": round(rets.get("rnorm100", 0), 4),
    }


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------

@mcp.tool()
def fetch_ohlcv(
    ticker: str,
    start: str,
    end: str,
    interval: str = "1d",
) -> str:
    """Fetch OHLCV price data for a ticker via yfinance.

    Args:
        ticker: e.g. "AAPL", "SPY", "BTC-USD"
        start: ISO date string e.g. "2020-01-01"
        end: ISO date string e.g. "2024-01-01"
        interval: "1d", "1wk", "1mo", "1h", "15m", etc.

    Returns JSON with columns open/high/low/close/volume and dates.
    """
    df = _fetch_ohlcv(ticker, start, end, interval)
    result = {
        "ticker": ticker,
        "interval": interval,
        "rows": len(df),
        "start": str(df.index[0].date()),
        "end": str(df.index[-1].date()),
        "dates": [str(d.date()) for d in df.index],
        "open": _series_to_list(df["Open"]),
        "high": _series_to_list(df["High"]),
        "low": _series_to_list(df["Low"]),
        "close": _series_to_list(df["Close"]),
        "volume": [int(v) if pd.notna(v) else None for v in df["Volume"]],
    }
    return json.dumps(result)


@mcp.tool()
def add_indicators(
    ticker: str,
    start: str,
    end: str,
    indicators: list[str],
) -> str:
    """Compute technical indicators for a ticker.

    Args:
        ticker: e.g. "AAPL"
        start: ISO date e.g. "2020-01-01"
        end: ISO date e.g. "2024-01-01"
        indicators: list of indicator names — supported:
            "sma_20", "sma_50", "sma_200",
            "ema_12", "ema_26",
            "rsi_14",
            "macd", "macd_signal", "macd_hist",
            "bb_upper", "bb_middle", "bb_lower",
            "atr_14",
            "obv",
            "stoch_k", "stoch_d"

    Returns JSON with dates + requested indicator series.
    """
    df = _fetch_ohlcv(ticker, start, end)
    out: dict[str, Any] = {
        "ticker": ticker,
        "dates": [str(d.date()) for d in df.index],
    }

    close = df["Close"]
    high = df["High"]
    low = df["Low"]
    volume = df["Volume"]

    for ind in indicators:
        if ind == "sma_20":
            out[ind] = _series_to_list(ta.trend.sma_indicator(close, window=20))
        elif ind == "sma_50":
            out[ind] = _series_to_list(ta.trend.sma_indicator(close, window=50))
        elif ind == "sma_200":
            out[ind] = _series_to_list(ta.trend.sma_indicator(close, window=200))
        elif ind == "ema_12":
            out[ind] = _series_to_list(ta.trend.ema_indicator(close, window=12))
        elif ind == "ema_26":
            out[ind] = _series_to_list(ta.trend.ema_indicator(close, window=26))
        elif ind == "rsi_14":
            out[ind] = _series_to_list(ta.momentum.rsi(close, window=14))
        elif ind in ("macd", "macd_signal", "macd_hist"):
            macd_obj = ta.trend.MACD(close)
            if ind == "macd":
                out[ind] = _series_to_list(macd_obj.macd())
            elif ind == "macd_signal":
                out[ind] = _series_to_list(macd_obj.macd_signal())
            else:
                out[ind] = _series_to_list(macd_obj.macd_diff())
        elif ind in ("bb_upper", "bb_middle", "bb_lower"):
            bb = ta.volatility.BollingerBands(close)
            if ind == "bb_upper":
                out[ind] = _series_to_list(bb.bollinger_hband())
            elif ind == "bb_middle":
                out[ind] = _series_to_list(bb.bollinger_mavg())
            else:
                out[ind] = _series_to_list(bb.bollinger_lband())
        elif ind == "atr_14":
            out[ind] = _series_to_list(ta.volatility.AverageTrueRange(high, low, close, window=14).average_true_range())
        elif ind == "obv":
            out[ind] = _series_to_list(ta.volume.on_balance_volume(close, volume))
        elif ind == "stoch_k":
            out[ind] = _series_to_list(ta.momentum.StochasticOscillator(high, low, close).stoch())
        elif ind == "stoch_d":
            out[ind] = _series_to_list(ta.momentum.StochasticOscillator(high, low, close).stoch_signal())
        else:
            out[ind] = f"unknown indicator: {ind}"

    return json.dumps(out)


@mcp.tool()
def run_sma_crossover_backtest(
    ticker: str,
    start: str,
    end: str,
    fast_period: int = 20,
    slow_period: int = 50,
    cash: float = 100_000,
    commission: float = 0.001,
) -> str:
    """Run a simple SMA crossover backtest (buy when fast > slow, sell when fast < slow).

    Args:
        ticker: e.g. "SPY"
        start: ISO date e.g. "2015-01-01"
        end: ISO date e.g. "2024-01-01"
        fast_period: fast SMA window (default 20)
        slow_period: slow SMA window (default 50)
        cash: starting capital (default 100000)
        commission: per-trade commission fraction (default 0.001 = 0.1%)

    Returns JSON with performance metrics.
    """
    df = _fetch_ohlcv(ticker, start, end)
    data = bt.feeds.PandasData(dataname=df)

    class SMACrossover(bt.Strategy):
        params = dict(fast=fast_period, slow=slow_period, cash=cash, commission=commission)

        def __init__(self):
            fast = bt.indicators.SMA(self.data.close, period=self.p.fast)
            slow = bt.indicators.SMA(self.data.close, period=self.p.slow)
            self.crossover = bt.indicators.CrossOver(fast, slow)

        def next(self):
            if not self.position:
                if self.crossover > 0:
                    self.buy()
            elif self.crossover < 0:
                self.close()

    metrics = _bt_run(SMACrossover, data, cash=cash, commission=commission)
    metrics["strategy"] = "SMA Crossover"
    metrics["params"] = {"fast_period": fast_period, "slow_period": slow_period}
    metrics["ticker"] = ticker
    metrics["period"] = f"{start} → {end}"
    return json.dumps(metrics)


@mcp.tool()
def run_rsi_backtest(
    ticker: str,
    start: str,
    end: str,
    rsi_period: int = 14,
    oversold: float = 30.0,
    overbought: float = 70.0,
    cash: float = 100_000,
    commission: float = 0.001,
) -> str:
    """Run an RSI mean-reversion backtest (buy oversold, sell overbought).

    Args:
        ticker: e.g. "QQQ"
        start: ISO date e.g. "2015-01-01"
        end: ISO date e.g. "2024-01-01"
        rsi_period: RSI window (default 14)
        oversold: RSI level to buy (default 30)
        overbought: RSI level to sell (default 70)
        cash: starting capital
        commission: per-trade commission fraction

    Returns JSON with performance metrics.
    """
    df = _fetch_ohlcv(ticker, start, end)
    data = bt.feeds.PandasData(dataname=df)

    class RSIStrategy(bt.Strategy):
        params = dict(period=rsi_period, oversold=oversold, overbought=overbought,
                      cash=cash, commission=commission)

        def __init__(self):
            self.rsi = bt.indicators.RSI(self.data.close, period=self.p.period)

        def next(self):
            if not self.position and self.rsi < self.p.oversold:
                self.buy()
            elif self.position and self.rsi > self.p.overbought:
                self.close()

    metrics = _bt_run(RSIStrategy, data, cash=cash, commission=commission)
    metrics["strategy"] = "RSI Mean-Reversion"
    metrics["params"] = {"rsi_period": rsi_period, "oversold": oversold, "overbought": overbought}
    metrics["ticker"] = ticker
    metrics["period"] = f"{start} → {end}"
    return json.dumps(metrics)


@mcp.tool()
def run_custom_strategy_backtest(
    ticker: str,
    start: str,
    end: str,
    strategy_code: str,
    cash: float = 100_000,
    commission: float = 0.001,
) -> str:
    """Run a custom backtrader strategy defined as Python code.

    Args:
        ticker: e.g. "AAPL"
        start: ISO date e.g. "2020-01-01"
        end: ISO date e.g. "2024-01-01"
        strategy_code: Python code defining a class named 'MyStrategy' that
            subclasses bt.Strategy. Must implement __init__ and next methods.
            Example:
                class MyStrategy(bt.Strategy):
                    params = dict(period=20)
                    def __init__(self):
                        self.sma = bt.indicators.SMA(self.data.close, period=self.p.period)
                    def next(self):
                        if not self.position and self.data.close[0] > self.sma[0]:
                            self.buy()
                        elif self.position and self.data.close[0] < self.sma[0]:
                            self.close()
        cash: starting capital
        commission: per-trade commission fraction

    Returns JSON with performance metrics.
    """
    df = _fetch_ohlcv(ticker, start, end)
    data_feed = bt.feeds.PandasData(dataname=df)

    namespace = {"bt": bt}
    try:
        exec(strategy_code, namespace)  # noqa: S102
    except Exception as e:
        return json.dumps({"error": f"Strategy code error: {e}", "traceback": traceback.format_exc()})

    if "MyStrategy" not in namespace:
        return json.dumps({"error": "strategy_code must define a class named 'MyStrategy'"})

    strategy_cls = namespace["MyStrategy"]

    try:
        metrics = _bt_run(strategy_cls, data_feed, cash=cash, commission=commission)
    except Exception as e:
        return json.dumps({"error": f"Backtest execution error: {e}", "traceback": traceback.format_exc()})

    metrics["strategy"] = "Custom"
    metrics["ticker"] = ticker
    metrics["period"] = f"{start} → {end}"
    return json.dumps(metrics)


@mcp.tool()
def optimize_strategy(
    ticker: str,
    start: str,
    end: str,
    strategy: str = "sma_crossover",
    param_grid: dict = None,
    cash: float = 100_000,
    commission: float = 0.001,
) -> str:
    """Grid-search strategy parameters to find the best Sharpe ratio.

    Args:
        ticker: e.g. "SPY"
        start: ISO date e.g. "2015-01-01"
        end: ISO date e.g. "2023-01-01"
        strategy: "sma_crossover" or "rsi"
        param_grid: dict of param name → list of values to try.
            For sma_crossover: {"fast_period": [10,20,50], "slow_period": [50,100,200]}
            For rsi: {"rsi_period": [7,14,21], "oversold": [25,30], "overbought": [70,75]}
        cash: starting capital
        commission: per-trade commission fraction

    Returns JSON with ranked results by Sharpe ratio.
    """
    import itertools

    if param_grid is None:
        if strategy == "sma_crossover":
            param_grid = {"fast_period": [10, 20, 50], "slow_period": [50, 100, 200]}
        else:
            param_grid = {"rsi_period": [7, 14, 21], "oversold": [25, 30], "overbought": [70, 75]}

    df = _fetch_ohlcv(ticker, start, end)
    data_feed_base = df  # will re-create feed each run

    keys = list(param_grid.keys())
    combos = list(itertools.product(*[param_grid[k] for k in keys]))
    results = []

    for combo in combos:
        params = dict(zip(keys, combo))
        data_feed = bt.feeds.PandasData(dataname=data_feed_base.copy())

        if strategy == "sma_crossover":
            fp = params.get("fast_period", 20)
            sp = params.get("slow_period", 50)
            if fp >= sp:
                continue

            class SMACrossover(bt.Strategy):
                p_fast = fp
                p_slow = sp

                def __init__(self):
                    fast = bt.indicators.SMA(self.data.close, period=self.p_fast)
                    slow = bt.indicators.SMA(self.data.close, period=self.p_slow)
                    self.crossover = bt.indicators.CrossOver(fast, slow)

                def next(self):
                    if not self.position:
                        if self.crossover > 0:
                            self.buy()
                    elif self.crossover < 0:
                        self.close()

            try:
                metrics = _bt_run(SMACrossover, data_feed, cash=cash, commission=commission)
            except Exception:
                continue

        elif strategy == "rsi":
            rp = params.get("rsi_period", 14)
            os_ = params.get("oversold", 30)
            ob = params.get("overbought", 70)

            class RSIStrategy(bt.Strategy):
                p_period = rp
                p_oversold = os_
                p_overbought = ob

                def __init__(self):
                    self.rsi = bt.indicators.RSI(self.data.close, period=self.p_period)

                def next(self):
                    if not self.position and self.rsi < self.p_oversold:
                        self.buy()
                    elif self.position and self.rsi > self.p_overbought:
                        self.close()

            try:
                metrics = _bt_run(RSIStrategy, data_feed, cash=cash, commission=commission)
            except Exception:
                continue
        else:
            return json.dumps({"error": f"Unknown strategy: {strategy}. Use 'sma_crossover' or 'rsi'."})

        results.append({"params": params, **metrics})

    results.sort(key=lambda r: r.get("sharpe_ratio") or -999, reverse=True)
    return json.dumps({
        "ticker": ticker,
        "period": f"{start} → {end}",
        "strategy": strategy,
        "total_combinations_tested": len(results),
        "best_params": results[0]["params"] if results else None,
        "results": results[:20],
    })


@mcp.tool()
def portfolio_analytics(
    tickers: list[str],
    start: str,
    end: str,
    weights: list[float] = None,
) -> str:
    """Compute portfolio statistics for a set of tickers.

    Args:
        tickers: list of ticker symbols e.g. ["SPY", "QQQ", "GLD"]
        start: ISO date e.g. "2015-01-01"
        end: ISO date e.g. "2024-01-01"
        weights: portfolio weights (must sum to 1.0). Equal-weighted if omitted.

    Returns JSON with per-asset and portfolio-level metrics.
    """
    import numpy as np

    prices = {}
    for t in tickers:
        df = _fetch_ohlcv(t, start, end)
        prices[t] = df["Close"]

    price_df = pd.DataFrame(prices).dropna()
    returns = price_df.pct_change().dropna()

    n = len(tickers)
    if weights is None:
        weights = [1.0 / n] * n
    weights = [w / sum(weights) for w in weights]  # normalize

    port_returns = returns.dot(weights)
    annual_factor = 252

    def _metrics(r: pd.Series, name: str) -> dict:
        mean_r = float(r.mean())
        std_r = float(r.std())
        sharpe = round((mean_r / std_r) * (annual_factor ** 0.5), 4) if std_r else None
        cagr = round(((1 + r).prod() ** (annual_factor / len(r)) - 1) * 100, 4)
        cumulative = (1 + r).cumprod()
        rolling_max = cumulative.cummax()
        drawdown = (cumulative - rolling_max) / rolling_max
        max_dd = round(float(drawdown.min()) * 100, 4)
        total_ret = round(float((cumulative.iloc[-1] - 1) * 100), 4)
        return {
            "name": name,
            "total_return_pct": total_ret,
            "cagr_pct": cagr,
            "sharpe_ratio": sharpe,
            "max_drawdown_pct": max_dd,
            "annualized_vol_pct": round(std_r * (annual_factor ** 0.5) * 100, 4),
        }

    asset_metrics = [_metrics(returns[t], t) for t in tickers]
    port_metrics = _metrics(port_returns, "Portfolio")

    corr = returns.corr().round(4).to_dict()

    return json.dumps({
        "period": f"{start} → {end}",
        "weights": dict(zip(tickers, [round(w, 4) for w in weights])),
        "portfolio": port_metrics,
        "assets": asset_metrics,
        "correlation_matrix": corr,
    })


@mcp.tool()
def walk_forward_validation(
    ticker: str,
    strategy: str,
    total_start: str,
    total_end: str,
    train_months: int = 12,
    test_months: int = 3,
    params: dict = None,
    cash: float = 100_000,
    commission: float = 0.001,
) -> str:
    """Walk-forward validation: train/test splits across time.

    Args:
        ticker: e.g. "SPY"
        strategy: "sma_crossover" or "rsi"
        total_start: ISO date for the full period start
        total_end: ISO date for the full period end
        train_months: months in each training window (default 12)
        test_months: months in each test window (default 3)
        params: strategy params to use in test windows. If None uses defaults.
            For sma_crossover: {"fast_period": 20, "slow_period": 50}
            For rsi: {"rsi_period": 14, "oversold": 30, "overbought": 70}
        cash: starting capital per window
        commission: per-trade commission fraction

    Returns JSON with per-window metrics and aggregate stats.
    """
    import numpy as np
    from dateutil.relativedelta import relativedelta

    if params is None:
        params = {"fast_period": 20, "slow_period": 50} if strategy == "sma_crossover" else \
                 {"rsi_period": 14, "oversold": 30, "overbought": 70}

    start_dt = datetime.strptime(total_start, "%Y-%m-%d")
    end_dt = datetime.strptime(total_end, "%Y-%m-%d")

    windows = []
    cursor = start_dt
    while True:
        train_end = cursor + relativedelta(months=train_months)
        test_end = train_end + relativedelta(months=test_months)
        if test_end > end_dt:
            break
        windows.append((cursor.strftime("%Y-%m-%d"),
                         train_end.strftime("%Y-%m-%d"),
                         test_end.strftime("%Y-%m-%d")))
        cursor = train_end

    window_results = []
    for train_start, train_end, test_end in windows:
        # run on test window
        import importlib, sys as _sys
        tool_name = "run_sma_crossover_backtest" if strategy == "sma_crossover" else "run_rsi_backtest"
        try:
            result_json = json.loads(
                run_sma_crossover_backtest(ticker, train_end, test_end,
                    fast_period=params.get("fast_period", 20),
                    slow_period=params.get("slow_period", 50),
                    cash=cash, commission=commission)
                if strategy == "sma_crossover" else
                run_rsi_backtest(ticker, train_end, test_end,
                    rsi_period=params.get("rsi_period", 14),
                    oversold=params.get("oversold", 30),
                    overbought=params.get("overbought", 70),
                    cash=cash, commission=commission)
            )
            result_json["train_period"] = f"{train_start} → {train_end}"
            result_json["test_period"] = f"{train_end} → {test_end}"
            window_results.append(result_json)
        except Exception as e:
            window_results.append({"test_period": f"{train_end} → {test_end}", "error": str(e)})

    valid = [w for w in window_results if "error" not in w]
    returns = [w["total_return_pct"] for w in valid]
    sharpes = [w["sharpe_ratio"] for w in valid if w.get("sharpe_ratio") is not None]

    summary = {
        "ticker": ticker,
        "strategy": strategy,
        "params": params,
        "windows_tested": len(window_results),
        "windows_valid": len(valid),
        "avg_return_pct": round(float(np.mean(returns)), 4) if returns else None,
        "std_return_pct": round(float(np.std(returns)), 4) if returns else None,
        "pct_profitable_windows": round(sum(r > 0 for r in returns) / len(returns) * 100, 1) if returns else None,
        "avg_sharpe": round(float(np.mean(sharpes)), 4) if sharpes else None,
        "windows": window_results,
    }
    return json.dumps(summary)


@mcp.tool()
def generate_synthetic_ohlcv(
    ticker: str,
    start: str,
    end: str,
    initial_price: float = 100.0,
    annual_drift: float = 0.08,
    annual_vol: float = 0.20,
    seed: int = 42,
) -> str:
    """Generate synthetic OHLCV data using geometric Brownian motion and save to ~/lean-data/<TICKER>.csv.

    Use this for testing strategies when live data isn't available.

    Args:
        ticker: name for the synthetic asset e.g. "SYNTH"
        start: ISO date e.g. "2015-01-01"
        end: ISO date e.g. "2024-01-01"
        initial_price: starting price (default 100)
        annual_drift: expected annual return (default 0.08 = 8%)
        annual_vol: annual volatility (default 0.20 = 20%)
        seed: random seed for reproducibility

    Returns JSON confirming rows generated and file path.
    """
    rng = np.random.default_rng(seed)
    dates = pd.bdate_range(start=start, end=end)
    n = len(dates)
    dt = 1 / 252
    mu = annual_drift * dt
    sigma = annual_vol * np.sqrt(dt)
    log_returns = rng.normal(mu - 0.5 * sigma**2, sigma, n)
    closes = initial_price * np.exp(np.cumsum(log_returns))

    daily_vol = rng.uniform(0.003, 0.015, n)
    opens = closes * np.exp(rng.normal(0, daily_vol / 2, n))
    highs = np.maximum(opens, closes) * (1 + rng.uniform(0, daily_vol, n))
    lows = np.minimum(opens, closes) * (1 - rng.uniform(0, daily_vol, n))
    volumes = (rng.integers(500_000, 5_000_000, n)).astype(float)

    df = pd.DataFrame({
        "date": dates,
        "open": np.round(opens, 4),
        "high": np.round(highs, 4),
        "low": np.round(lows, 4),
        "close": np.round(closes, 4),
        "volume": volumes.astype(int),
    })

    path = os.path.join(DATA_DIR, f"{ticker}.csv")
    df.to_csv(path, index=False)

    return json.dumps({
        "ticker": ticker,
        "rows": n,
        "start": str(dates[0].date()),
        "end": str(dates[-1].date()),
        "initial_price": initial_price,
        "final_price": round(float(closes[-1]), 4),
        "saved_to": path,
    })


@mcp.tool()
def list_available_data() -> str:
    """List all CSV data files available in ~/lean-data/ for backtesting.

    Returns JSON with file names, row counts, and date ranges.
    """
    files = []
    if os.path.exists(DATA_DIR):
        for fname in sorted(os.listdir(DATA_DIR)):
            if fname.endswith(".csv"):
                fpath = os.path.join(DATA_DIR, fname)
                try:
                    df = pd.read_csv(fpath, nrows=1)
                    full = pd.read_csv(fpath)
                    files.append({
                        "file": fname,
                        "ticker": fname.replace(".csv", ""),
                        "rows": len(full),
                        "columns": list(full.columns),
                        "size_kb": round(os.path.getsize(fpath) / 1024, 1),
                    })
                except Exception as e:
                    files.append({"file": fname, "error": str(e)})

    return json.dumps({
        "data_directory": DATA_DIR,
        "files": files,
        "tip": f"Drop CSV files into {DATA_DIR}/<TICKER>.csv with columns: date,open,high,low,close,volume",
    })


if __name__ == "__main__":
    mcp.run(transport="stdio")
