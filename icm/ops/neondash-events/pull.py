#!/usr/bin/env python3
"""Pull buffered Neon Dash events from the Cloudflare relay into events.db.
Cron on the VPS every 5 min. Acks (deletes) a batch on the relay only after it
is committed here, so a crash never loses events (worst case: a re-pull)."""
import json, os, sys, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import receiver

RELAY = os.environ.get("ND_RELAY", "https://neondash-events.onboardingaudit.workers.dev/nd/pull")
TOKEN_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pull_token")

def call(ack, token):
    req = urllib.request.Request(f"{RELAY}?ack={ack}", method="POST",
                                 headers={"Authorization": "Bearer " + token, "User-Agent": "neondash-pull"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)

def main():
    token = open(TOKEN_FILE).read().strip()
    ack, total, bad = 0, 0, 0
    for _ in range(200):                      # at most 100k events per run
        d = call(ack, token)
        rows = d["rows"]
        if not rows: break
        c = receiver.db()
        with c:
            for r in rows:
                try:
                    receiver.store(c, json.loads(r["body"]), r["received"]); total += 1
                except Exception:
                    bad += 1
        c.close()
        ack = rows[-1]["id"]
    else:
        pass
    if ack: call(ack, token)                  # ack the final batch
    if total or bad: print(f"pulled {total}, skipped {bad}")

if __name__ == "__main__":
    main()
