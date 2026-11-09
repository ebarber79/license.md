#!/usr/bin/env python3
"""Neon Dash event receiver. Stdlib only. Listens on 127.0.0.1:8796 (local only).
Stores anonymous game events in SQLite. No IP addresses or headers are stored."""
import json, sqlite3, time, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

DB = "/root/neondash-events/events.db"
MAX_BODY = 8192
RATE = 30          # events per second, whole server
lock = threading.Lock()
bucket = [RATE, time.time()]

def db():
    c = sqlite3.connect(DB, timeout=10)
    c.execute("""create table if not exists events(
        id integer primary key, received real, t integer, event text,
        install text, session text, build text, platform text, props text)""")
    c.execute("create index if not exists ix_recv on events(received)")
    return c

def allow():
    with lock:
        now = time.time()
        bucket[0] = min(RATE, bucket[0] + (now - bucket[1]) * RATE); bucket[1] = now
        if bucket[0] < 1: return False
        bucket[0] -= 1; return True

def s(v, n=64): return str(v)[:n] if v is not None else None

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def _done(self, code):
        self.send_response(code)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", "0"); self.end_headers()
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
    def do_GET(self):
        self._done(200 if self.path.rstrip("/").endswith("/health") else 404)
    def do_POST(self):
        if not self.path.rstrip("/").endswith("/e"): return self._done(404)
        n = int(self.headers.get("Content-Length") or 0)
        if n <= 0 or n > MAX_BODY: return self._done(413)
        if not allow(): return self._done(429)
        try:
            p = json.loads(self.rfile.read(n))
            if not isinstance(p, dict) or not isinstance(p.get("event"), str): raise ValueError
            props = {k: p[k] for k in ("props", "kind", "message", "stack", "extra") if k in p}
            row = (time.time(), int(p.get("t") or 0), s(p["event"], 40), s(p.get("install")),
                   s(p.get("session")), s(p.get("build"), 32), s(p.get("platform"), 16),
                   json.dumps(props)[:4000])
            with db() as c:
                c.execute("insert into events(received,t,event,install,session,build,platform,props) values(?,?,?,?,?,?,?,?)", row)
        except Exception:
            return self._done(400)
        self._done(204)

if __name__ == "__main__":
    db().close()
    ThreadingHTTPServer(("127.0.0.1", 8796), H).serve_forever()
