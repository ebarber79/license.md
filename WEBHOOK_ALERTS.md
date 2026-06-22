# Webhook Alerts — TradingView → Execution Bridge

How to turn the indicator's breakout signals into webhook alerts, the JSON
payload schema, and the **safety/compliance** rules you must not skip.

> ⚠️ **Read this first.** A webhook that places live trades is auto-execution.
> Treat it as dangerous until proven safe: test on a **demo** for weeks, and
> confirm your prop firm allows third-party execution bridges (some FTMO rules
> restrict copy/3rd-party trade tools — verify at ftmo.com).

---

## 1. How TradingView webhooks work

1. The indicator (`POStrategicEA_Indicator.pine`) calls `alert()` with a JSON
   message on each breakout.
2. You create an alert on the indicator and paste a **Webhook URL** (your
   server/bridge endpoint).
3. TradingView POSTs the JSON to that URL when the alert fires.
4. **Your bridge** (not TradingView) validates it and sends the order to your
   broker/MT5. TradingView cannot place trades by itself.

You need **TradingView Pro+ or higher** for webhook alerts.

---

## 2. Create the alert

1. Add the indicator to the chart (chart TF = entry TF, e.g. H1).
2. Click the **⏰ Alert** button → Condition = **POStrategic Breakout** →
   choose the alert (or "Any alert() function call" to use the JSON payload).
3. Alert actions → tick **Webhook URL** → paste your endpoint.
4. Set expiration to **Open-ended** and "Once Per Bar Close".

---

## 3. JSON payload schema (what the bridge receives)

The indicator emits, on a long breakout:

```json
{
  "strategy": "POStrategic",
  "action":   "buy",
  "symbol":   "EURUSD",
  "entry":    1.08450,
  "sl":       1.08100,
  "tp":       1.08975,
  "risk_pct": 0.5,
  "tf":       "60",
  "time":     "1718972400000"
}
```

| Field | Meaning |
|---|---|
| `action` | `buy` or `sell` |
| `symbol` | TradingView ticker — map to your broker's symbol on the bridge |
| `entry` | breakout level (ref high/low) |
| `sl` / `tp` | stop / target prices (RR-derived) |
| `risk_pct` | risk per trade — bridge converts to lots |
| `tf` | chart timeframe |
| `time` | bar time (epoch ms) |

Edit the `str.format(...)` lines in the `.pine` to add/rename fields your bridge
needs (e.g. an auth token, account id).

---

## 4. The bridge (you must provide this)

TradingView → broker requires a middleman that:
- **Authenticates** the request (a secret token in the payload or header — never
  trust an open webhook; anyone who finds the URL could POST to it).
- **Maps symbols** (EURUSD → your broker's EURUSD/EURUSD.x).
- **Sizes the position** from `risk_pct` and the SL distance.
- **Places the order** via broker API or an MT5 connector
  (e.g. a small Flask/FastAPI app + MetaApi / a local MT5 socket EA).

Common options: a self-hosted Flask endpoint, or services like 3Commas /
PineConnector / a custom MetaApi script. **Whatever you use, you are responsible
for its security and behavior.**

---

## 5. Safety checklist (do not skip)

- [ ] **Demo first.** Run the full webhook → bridge → demo account loop for
      weeks before any live money.
- [ ] **Secret token** in every payload; bridge rejects anything without it.
- [ ] **HTTPS** endpoint only.
- [ ] **Idempotency / dedupe** so a repeated POST can't double-fire an order.
- [ ] **Sanity limits** on the bridge: max lot, max open trades, reject if
      `risk_pct` looks wrong.
- [ ] **Keep the Equity Guardian running** (`FTMO_EquityGuardian.mq5`) as the
      last line of defense regardless of what the bridge does.
- [ ] **Recovery stays OFF** — never let a webhook drive martingale sizing.
- [ ] **Prop-firm rules:** confirm third-party execution tools are permitted.

---

## 6. Honest limitations

- Alerts fire on **bar close** (`freq_once_per_bar_close`) to avoid intrabar
  repaint — so execution is one bar later than a tick-perfect EA. For a daily
  breakout this is usually fine; for scalping it isn't.
- Network/latency between TradingView, your bridge, and the broker adds slippage
  not present in any backtest. Shade expectations accordingly.
- This path is **semi-automation glue**, not a tested trading system. It only
  matters *after* the strategy has proven an edge in the three backtest engines
  and on a demo forward test.
