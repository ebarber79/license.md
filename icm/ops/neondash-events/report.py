#!/usr/bin/env python3
"""Neon Dash gameplay report from events.db (VPS: /root/neondash-events).
  report.py [--days N]      text report (default 7 days)
  report.py --telegram      short daily summary to Telegram (last 24h)
  report.py --prune         delete events older than 365 days (privacy policy)
Env ND_EVENTS_DB overrides the database path (tests).

builds.json (next to the db) holds when each build went live on Play:
  {"7 (1.6)": {"live": "2026-11-10T06:08:00Z", "revive_time_in_duration": true}}
Sessions that start before their build went live are Google's review / pre-launch
test devices: shown separately as "Google test devices", never mixed into player
numbers. Builds missing from the file are treated as players and flagged."""
import json, os, sqlite3, sys, time, statistics
from collections import Counter, defaultdict
from datetime import datetime, timezone, timedelta

DB = os.environ.get("ND_EVENTS_DB", "/root/neondash-events/events.db")
ET = timezone(timedelta(hours=-5))  # report by Eastern (standard) day
CORE = ("app_open", "game_start", "game_over", "error")
BUILDS = os.environ.get("ND_BUILDS", os.path.join(os.path.dirname(DB), "builds.json"))


def builds():
    try:
        return json.load(open(BUILDS))
    except (OSError, ValueError):
        return {}


def live_ts(info):
    try:
        return datetime.fromisoformat(info["live"].replace("Z", "+00:00")).timestamp()
    except (KeyError, ValueError, AttributeError):
        return None


def split(rs):
    """Return (player_rows, robot_rows, builds_without_live_time)."""
    b = builds()
    first = {}
    for r in rs:
        first.setdefault(r[2], (r[0], r[3]))
    robot, unknown = set(), set()
    for sess, (t0, build) in first.items():
        lt = live_ts(b.get(build, {}))
        if lt is None:
            unknown.add(build)
        elif t0 < lt:
            robot.add(sess)
    return ([r for r in rs if r[2] not in robot], [r for r in rs if r[2] in robot], unknown)


def runs(rs):
    """One entry per run. A revived run sends game_over twice with the same run_id;
    keep the last. Builds flagged revive_time_in_duration counted the game-over
    screen + revive ad as play time: subtract the gap between each earlier
    game_over and the revive that followed it (client clock t)."""
    b = builds()
    by_run, order = {}, []
    pending = {}  # session -> t of a game_over waiting for a revive
    for r in rs:
        recv, event, sess, build, plat, props, t = r
        p = json.loads(props).get("props", {})
        if event == "game_over":
            rid = p.get("run_id") or f"{sess}-{recv}"
            if rid not in by_run:
                order.append(rid)
                by_run[rid] = {"gap": 0}
            run = by_run[rid]
            run.update(p)
            run["build"] = build
            pending[sess] = (rid, t)
        elif event == "reward_granted" and p.get("type") == "revive" and sess in pending:
            rid, t_over = pending.pop(sess)
            if t and t_over and t > t_over:
                by_run[rid]["gap"] += t - t_over
    out = []
    for rid in order:
        run = by_run[rid]
        d = run.get("duration_ms")
        if isinstance(d, (int, float)) and b.get(run["build"], {}).get("revive_time_in_duration"):
            d = max(0, d - run["gap"])
        run["active_ms"] = d
        out.append(run)
    return out


def rows(since):
    c = sqlite3.connect(DB)
    return c.execute(
        "select received,event,session,build,platform,props,t from events "
        "where received>=? order by received", (since,)).fetchall()


def summarize(rs):
    sessions = {r[2] for r in rs}
    ev = Counter(r[1] for r in rs)
    overs = runs(rs)
    scores = [o["score"] for o in overs if isinstance(o.get("score"), (int, float))]
    durs = [o["active_ms"] / 1000 for o in overs if isinstance(o.get("active_ms"), (int, float))]
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
    rs, bots, unknown = split(rs)
    if bots:
        sb = summarize(bots)
        out += [f"Google test devices (before the build went live, not counted below): "
                f"{sb['sessions']} sessions, {sb['runs']} runs", ""]
    if unknown:
        out += ["NOTE: no go-live time in builds.json for: " + ", ".join(sorted(unknown))
                + " (its test-device sessions are counted as players)", ""]
    if not rs:
        return "\n".join(out + ["No player sessions yet."])
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
    rs, bots, unknown = split(rows(time.time() - 86400))
    s = summarize(rs)
    note = f"\n🤖 {summarize(bots)['sessions']} Google test-device session(s) not counted" if bots else ""
    if unknown:
        note += "\n❓ builds.json has no go-live time for " + ", ".join(sorted(unknown))
    if s["opens"] == 0 and not s["errors"]:
        return "🎮 Neon Dash, last 24h: no player app opens recorded." + note
    msg = (f"🎮 Neon Dash, last 24h: {s['sessions']} sessions, {s['runs']} runs, "
           f"median score {s['median']:.0f}, best {s['best']}, avg run {s['avg_len']:.0f}s")
    if s["errors"]:
        msg += f"\n⚠️ {len(s['errors'])} error(s), latest: {str(s['errors'][-1].get('message'))[:150]}"
    return msg + note


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
