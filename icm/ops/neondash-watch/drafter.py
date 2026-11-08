#!/usr/bin/env python3
"""Auto-draft the Neon Dash production application from tester emails.

Reads every Testers Community email (and forwarded Google Play email) in
onboardingaudit.ai@gmail.com, extracts text from bodies and PDF attachments,
and has headless Claude (no tools) fill the draft template using ONLY those
sources + facts.md. Unknowns stay as [NEEDS: ...]. Output goes to drafts/ and
to the user's Telegram. It never submits anything: the human reviews and applies.

Usage: drafter.py [--reason TEXT] [--dry-run]
"""
import base64, html, io, json, os, re, subprocess, sys, datetime as dt
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, "/root/daily-triage-pi")
import relay  # noqa: E402
from watch import gmail_service, ET  # noqa: E402

CLAUDE = "/root/.nvm/versions/node/v22.23.1/bin/claude"
TOKEN_ENV = "/etc/dropzone/env"  # CLAUDE_CODE_OAUTH_TOKEN (Max subscription)
SOURCES_Q = ('(from:(testerscommunity.io OR testerscommunity.com) OR '
             '(from:google.com ("Neon Dash" OR neondash OR "Play Console"))) newer_than:60d')
MAX_SOURCE_CHARS = 60000


def strip_html(s):
    s = re.sub(r"(?is)<(style|script).*?</\1>", " ", s)
    s = re.sub(r"(?i)<br\s*/?>|</p>|</div>|</tr>|</li>", "\n", s)
    return re.sub(r"[ \t]+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s)))


def pdf_text(data):
    try:
        from pypdf import PdfReader
        return "\n".join((p.extract_text() or "") for p in PdfReader(io.BytesIO(data)).pages)
    except Exception as e:
        return f"[could not read PDF: {e}]"


def collect(svc):
    out = []
    msgs = svc.users().messages().list(userId="me", q=SOURCES_Q, maxResults=50).execute().get("messages", [])
    for m in reversed(msgs):
        x = svc.users().messages().get(userId="me", id=m["id"], format="full").execute()
        hdr = {h["name"]: h["value"] for h in x["payload"]["headers"]}
        plain, htm, atts = [], [], []

        def walk(p):
            if p.get("parts"):
                for q in p["parts"]:
                    walk(q)
                return
            body, fn = p.get("body", {}), p.get("filename") or ""
            data = body.get("data")
            if not data and body.get("attachmentId"):
                data = svc.users().messages().attachments().get(
                    userId="me", messageId=m["id"], id=body["attachmentId"]).execute()["data"]
            if not data:
                return
            raw = base64.urlsafe_b64decode(data)
            if fn.lower().endswith(".pdf") or p["mimeType"] == "application/pdf":
                atts.append(f"--- attachment {fn} ---\n{pdf_text(raw)}")
            elif p["mimeType"] == "text/plain":
                plain.append(raw.decode("utf-8", "ignore"))
            elif p["mimeType"] == "text/html":
                htm.append(strip_html(raw.decode("utf-8", "ignore")))
            elif fn:
                atts.append(f"--- attachment {fn} ({p['mimeType']}): not readable as text ---")

        walk(x["payload"])
        text = "\n".join(plain) or "\n".join(htm)
        text = re.sub(r"\n\s*\n+", "\n\n", text).strip()
        out.append(f"=== EMAIL {hdr.get('Date','')} | {hdr.get('From','')} | {hdr.get('Subject','')} ===\n"
                   f"{text}\n" + "\n".join(atts))
    return "\n\n".join(out)[-MAX_SOURCE_CHARS:], len(msgs)


PROMPT = """You are filling in a Google Play production-access application for the Android game Neon Dash.

Rules (strict):
- Use ONLY facts from FACTS and SOURCES below. Never invent numbers, quotes, tester counts, bugs or fixes.
- Replace each [BRACKET] / [FROM TC REPORT ...] / [ADD ...] placeholder with real content when a source supports it.
  If no source supports it, write [NEEDS: <what is missing>] instead.
- Every answer: plain English, specific, first person ("I"), at most 300 characters.
- Keep the template's layout, section headings and the BEFORE YOU APPLY checklist. Do not tick any checklist box.
- Q4 must include at least one real criticism from testers if the sources contain one.
- Q7 (installs) stays as the owner's choice; do not pick one.
- Output ONLY the completed draft as plain text (no markdown fences), then a final section
  "OPEN ITEMS" listing every [NEEDS: ...] left.

FACTS:
{facts}

TEMPLATE:
{template}

SOURCES (emails from Testers Community and Google Play, oldest first):
{sources}
"""


def run_claude(prompt):
    env = dict(os.environ)
    for line in Path(TOKEN_ENV).read_text().splitlines():
        if line.startswith("CLAUDE_CODE_OAUTH_TOKEN="):
            env["CLAUDE_CODE_OAUTH_TOKEN"] = line.split("=", 1)[1].strip().strip('"')
    r = subprocess.run([CLAUDE, "-p", "--tools", "", "--output-format", "text"], input=prompt,
                       capture_output=True, text=True, timeout=600, env=env, cwd="/tmp")
    if r.returncode != 0 or not r.stdout.strip():
        raise RuntimeError(f"claude exit {r.returncode}: {r.stderr[-300:]}")
    return r.stdout.strip()


def main():
    dry = "--dry-run" in sys.argv
    reason = sys.argv[sys.argv.index("--reason") + 1] if "--reason" in sys.argv else "manual run"
    relay.load_env()
    now = dt.datetime.now(ET)
    try:
        sources, n = collect(gmail_service())
        draft = run_claude(PROMPT.format(facts=(HERE / "facts.md").read_text(),
                                         template=(HERE / "draft-template.txt").read_text(),
                                         sources=sources or "(no emails yet)"))
    except Exception as e:
        msg = f"⚠️ Neon Dash auto-draft FAILED ({reason}): {e}\nTell Claude Code: \"fill the production draft\"."
        print(now.isoformat(), msg)
        if not dry:
            relay.send(msg)
        return 1
    out = HERE / "drafts" / f"production-draft-{now:%Y%m%d-%H%M}.txt"
    needs = len(re.findall(r"\[NEEDS:", draft.split("OPEN ITEMS")[0]))
    if dry:
        print(draft)
        print(f"\n[dry] {n} source emails, {needs} open items, would save {out}")
        return 0
    out.parent.mkdir(exist_ok=True)
    out.write_text(draft + "\n")
    (HERE / "drafts" / "LATEST.txt").write_text(draft + "\n")
    relay.send(f"📝 NEON DASH production draft updated ({reason}).\n{n} source emails read, "
               f"{needs} open items left. Review only, nothing was submitted.\n"
               f"To get it on your Desktop: tell Claude Code \"pull the production draft\".\n\n{draft}")
    print(now.isoformat(), "draft saved", out, "needs", needs)
    return 0


if __name__ == "__main__":
    sys.exit(main())
