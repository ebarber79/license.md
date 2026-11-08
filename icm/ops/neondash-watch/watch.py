#!/usr/bin/env python3
"""Neon Dash launch watcher (VPS, hourly cron).

1. Sends each scheduled Telegram nudge once, as soon as its time (ET) has passed.
2. Watches onboardingaudit.ai@gmail.com for new Testers Community emails and
   forwards subject + snippet to Telegram (feedback reports feed the production draft).

Read-only on Gmail. Also watches forwarded Google Play mail and starts drafter.py
on tester reports (and on schedule items marked "draft"). Sends only to the user's own Telegram via the daily-triage relay.
State: state.json (sent nudge ids, seen Gmail ids). Log: watch.log via cron.
"""
import json, sys, html, datetime as dt
from pathlib import Path
from zoneinfo import ZoneInfo

HERE = Path(__file__).resolve().parent
STATE = HERE / "state.json"
SCHEDULE = HERE / "schedule.json"
ET = ZoneInfo("America/New_York")
GMAIL_DIR = "/root/.gmail-mcp"  # onboardingaudit.ai@gmail.com (Testers Community account)
TC_QUERY = "from:(testerscommunity.io OR testerscommunity.com) newer_than:3d"

sys.path.insert(0, "/root/daily-triage-pi")
import relay  # noqa: E402


def load_state():
    try:
        return json.loads(STATE.read_text())
    except Exception:
        return {"sent": [], "seen": [], "gmail_err_day": ""}


def save_state(s):
    STATE.write_text(json.dumps(s, indent=1))


def send(text, dry):
    if dry:
        print("[dry] would send:\n" + text + "\n")
    else:
        relay.send(text)


def nudges(state, now, dry):
    for item in json.loads(SCHEDULE.read_text()):
        when = dt.datetime.fromisoformat(item["at"]).replace(tzinfo=ET)
        if item["id"] in state["sent"] or now < when:
            continue
        late = (now - when) > dt.timedelta(days=2)
        send(("(late) " if late else "") + "🎮 NEON DASH: " + item["text"], dry)
        state["sent"].append(item["id"])
        if item.get("draft"):
            state["draft_pending"] = f"scheduled: {item['id']}"
        print(now.isoformat(), "nudge", item["id"])


def gmail_service():
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build
    c = json.load(open(GMAIL_DIR + "/credentials.json"))
    k = json.load(open(GMAIL_DIR + "/gcp-oauth.keys.json"))
    k = k.get("installed") or k.get("web")
    cr = Credentials(c.get("access_token") or c.get("token"), refresh_token=c["refresh_token"],
                     token_uri="https://oauth2.googleapis.com/token",
                     client_id=k["client_id"], client_secret=k["client_secret"])
    return build("gmail", "v1", credentials=cr, cache_discovery=False)


# (label, gmail query, kind). Seen ids are shared, so each email alerts once.
WATCHES = [
    ("Testers Community", TC_QUERY, "tc"),
    ("Google Play", 'from:google.com ("Neon Dash" OR neondash OR "Play Console") '
                    '-from:forwarding-noreply@google.com newer_than:3d', "play"),
    ("Gmail forwarding confirmation", "from:forwarding-noreply@google.com newer_than:3d", "fwd"),
]
# Subject-only: welcome/marketing mail mentions "production access" and "complete" in the body.
REPORT_WORDS = ("report", "feedback", "completed", "day 14", "day 16", "finished", "summary")
PLAY_GOOD = ("approved", "production access", "now available", "granted")
PLAY_BAD = ("isn't ready", "not ready", "more testing", "rejected", "policy", "suspend", "removed")
DRAFT_GAP = dt.timedelta(hours=6)


def mail(state, now, dry, baseline=False):
    try:
        s = gmail_service()
        found = [(label, kind, m["id"]) for label, q, kind in WATCHES
                 for m in s.users().messages().list(userId="me", q=q, maxResults=20).execute().get("messages", [])]
    except Exception as e:
        day = now.date().isoformat()
        if state.get("gmail_err_day") != day:  # alert at most once a day
            send(f"⚠️ Neon Dash watcher can't read the onboardingaudit inbox: {e}\n"
                 "Fix: VPS reauth (/root/.gmail-mcp/reauth.py). Tester/Play emails aren't being watched.", dry)
            state["gmail_err_day"] = day
        print(now.isoformat(), "gmail error", e)
        return
    for label, kind, mid in reversed(found):
        if mid in state["seen"]:
            continue
        state["seen"].append(mid)
        if baseline:
            continue
        x = s.users().messages().get(userId="me", id=mid, format="full").execute()
        subj = next((h["value"] for h in x["payload"]["headers"] if h["name"] == "Subject"), "(no subject)")
        snip = html.unescape(x.get("snippet", ""))[:300]
        low = (subj + " " + snip).lower()
        has_att = any(p.get("filename") for p in x["payload"].get("parts", []) or [])
        head, hint = f"📬 {label} email (onboardingaudit.ai@gmail.com)", ""
        if kind == "tc" and (has_att or any(w in subj.lower() for w in REPORT_WORDS)):
            hint = "\n➡ Looks like a tester report: auto-drafting the production answers now."
            state["draft_pending"] = f"Testers Community: {subj[:60]}"
        elif kind == "play":
            if any(w in low for w in PLAY_BAD):
                head = "🚨 GOOGLE PLAY: needs attention"
                hint = '\n➡ Tell Claude Code: "check the Play email" (keep the closed test running).'
            elif any(w in low for w in PLAY_GOOD):
                head = "🚀 GOOGLE PLAY: looks like good news"
                hint = '\n➡ Tell Claude Code: "production approved" to plan the release.'
        elif kind == "fwd":
            hint = ("\n➡ Gmail forwarding needs this confirmation. Confirm it in the onboardingaudit inbox "
                    "or tell Claude Code: \"confirm Play forwarding\".")
        send(f"{head}\n{subj}\n\n{snip}{hint}", dry)
        print(now.isoformat(), kind, mid, subj)
    state["seen"] = state["seen"][-300:]


def maybe_draft(state, now, dry):
    reason = state.get("draft_pending")
    if not reason:
        return
    last = state.get("last_draft")
    if last and now - dt.datetime.fromisoformat(last) < DRAFT_GAP:
        return  # batch several report emails into one draft
    print(now.isoformat(), "drafting:", reason)
    if dry:
        print("[dry] would run drafter.py --reason", reason)
        return
    import subprocess
    subprocess.run([sys.executable, "-W", "ignore", str(HERE / "drafter.py"), "--reason", reason], timeout=900)
    state["draft_pending"] = ""
    state["last_draft"] = now.isoformat()


def main():
    dry = "--dry-run" in sys.argv
    baseline = "--baseline" in sys.argv  # mark current inbox as seen without alerting
    relay.load_env()
    state = load_state()
    now = dt.datetime.now(ET)
    if not baseline:
        nudges(state, now, dry)
    mail(state, now, dry, baseline)
    if not baseline:
        maybe_draft(state, now, dry)
    if not dry:
        save_state(state)


if __name__ == "__main__":
    main()
