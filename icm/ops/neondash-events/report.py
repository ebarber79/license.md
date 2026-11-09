#!/usr/bin/env python3
"""Neon Dash gameplay report from events.db (VPS: /root/neondash-events).
  report.py [--days N]      text report (default 7 days)
  report.py --telegram      short daily summary to Telegram (last 24h)
  report.py --prune         delete events older than 365 days (privacy policy)
Env ND_EVENTS_DB overrides the database path (tests)."""
import json, os, sqlite3, sys, time, statistics
from collections import Counter, defaultdict
from datetime import datetime, timezone, timedelta

DB = os.environ.get("ND_EVENTS_DB", "/root/neondash-events/events.db")
ET = timezone(timedelta(hours=-5))  # report by Eastern (standard) day
CORE = ("app_open", "game_start", "game_over", "error")


def rows(since):
    c = sqlite3.connect(DB)
    return c.execute(
        "select received,event,session,build,platform,props from events "
        "where received>=? order by received", (since,)).fetchall()


def summarize(rs):
    sessions = {r[2] for r in rs}
    ev = Counter(r[1] for r in rs)
    overs = [json.loads(r[5]).get("props", {}) for r in rs if r[1] == "game_over"]
    scores = [o["score"] for o in overs if isinstance(o.get("score"), (int, float))]
    durs = [o["duration_ms"] / 1000 for o in overs if isinstance(o.get("duration_ms"), (int, float))]
    return {
        "sessions": len(sessions),
        "opens": ev["app_open"],
        "runs": len(overs),
        "median": statistics.median(scores) if scores else 0,
        "best": max(scores) if scores else 0,
        "avg_len": sum(durs) / len(durs) if durs else 0,
        "causes": Counter(o.get("cause") or "?" for o in overs),
        "errors": [json.loads(r[5]) for r in rs if r[1] == "error"],
        "builds": Counter(r[3] for r in rs if r[1] == "app_open"),
        "events": ev,
    }


def text(days):
    rs = rows(time.time() - days * 86400)
    out = [f"NEON DASH GAMEPLAY, last {days} days (Android)", ""]
    if not rs:
        return "\n".join(out + ["No events received yet."])
    by_day = defaultdict(list)
    for r in rs:
        by_day[datetime.fromtimestamp(r[0], ET).strftime("%a %b %d")].append(r)
    out.append(f"{'Day':<11}{'Sessions':>9}{'Runs':>6}{'Median':>8}{'Best':>7}{'Avg run':>9}{'Errors':>7}")
    for day, dr in by_day.items():
        s = summarize(dr)
        out.append(f"{day:<11}{s['sessions']:>9}{s['runs']:>6}{s['median']:>8.0f}"
                   f"{s['best']:>7}{s['avg_len']:>8.0f}s{len(s['errors']):>7}")
    s = summarize(rs)
    out += ["",
            f"Total: {s['sessions']} sessions, {s['runs']} runs, best score {s['best']}",
            "Builds seen: " + ", ".join(f"{b} x{n}" for b, n in s["builds"].most_common()),
            "Runs ended by: " + ", ".join(f"{c} {n}" for c, n in s["causes"].most_common(6)),
            "Other events: " + ", ".join(f"{e} {n}" for e, n in s["events"].most_common() if e not in CORE)]
    if s["errors"]:
        out += ["", "Errors (latest 5):"]
        for e in s["errors"][-5:]:
            out.append(f"  - {e.get('kind')}: {str(e.get('message'))[:150]}")
    return "\n".join(out)


def daily_message():
    s = summarize(rows(time.time() - 86400))
    if s["opens"] == 0 and not s["errors"]:
        return "🎮 Neon Dash, last 24h: no app opens recorded."
    msg = (f"🎮 Neon Dash, last 24h: {s['sessions']} sessions, {s['runs']} runs, "
           f"median score {s['median']:.0f}, best {s['best']}, avg run {s['avg_len']:.0f}s")
    if s["errors"]:
        msg += f"\n⚠️ {len(s['errors'])} error(s), latest: {str(s['errors'][-1].get('message'))[:150]}"
    return msg


def main(a):
    if "--prune" in a:
        c = sqlite3.connect(DB)
        n = c.execute("delete from events where received < ?", (time.time() - 365 * 86400,)).rowcount
        c.commit()
        print("pruned", n)
    elif "--telegram" in a:
        msg = daily_message()
        if "--dry-run" in a:
            print(msg)
            return
        sys.path.insert(0, "/root/daily-triage-pi")
        import relay
        relay.load_env()
        relay.send(msg)
    else:
        print(text(int(a[a.index("--days") + 1]) if "--days" in a else 7))


if __name__ == "__main__":
    main(sys.argv[1:])
