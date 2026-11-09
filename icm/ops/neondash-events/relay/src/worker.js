// Neon Dash event relay. The Android app beacons events here; the VPS pulls them
// every few minutes (pull.py) into its SQLite db. Nothing about the sender
// (IP, headers, user agent) is stored: only the JSON body and a receive time.
const MAX_BODY = 8192;
const MAX_ROWS = 50000;      // hard cap on the buffer if the VPS stops pulling
const BATCH = 500;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST",
  "Access-Control-Allow-Headers": "Content-Type",
};
const done = (status, body = null, extra = {}) =>
  new Response(body, { status, headers: { ...cors, ...extra } });

export default {
  async fetch(req, env) {
    const path = new URL(req.url).pathname.replace(/\/+$/, "");
    if (req.method === "OPTIONS") return done(204);
    if (req.method === "GET" && path.endsWith("/health")) return done(200, "ok");
    const stub = env.BUF.get(env.BUF.idFromName("main"));

    if (req.method === "POST" && path === "/nd/e") {
      const body = await req.text();
      if (!body || body.length > MAX_BODY) return done(413);
      let p;
      try { p = JSON.parse(body); } catch { return done(400); }
      if (!p || typeof p !== "object" || Array.isArray(p) || typeof p.event !== "string") return done(400);
      const r = await stub.fetch("https://buf/add", { method: "POST", body });
      return done(r.status);
    }

    if (req.method === "POST" && path === "/nd/pull") {
      const auth = req.headers.get("Authorization") || "";
      if (!env.PULL_TOKEN || auth !== "Bearer " + env.PULL_TOKEN) return done(401);
      const ack = new URL(req.url).searchParams.get("ack") || "0";
      return stub.fetch("https://buf/pull?ack=" + encodeURIComponent(ack), { method: "POST" });
    }
    return done(404);
  },
};

export class EventBuffer {
  constructor(state) {
    this.sql = state.storage.sql;
    this.sql.exec("create table if not exists ev(id integer primary key autoincrement, received real, body text)");
  }
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/add") {
      const n = this.sql.exec("select count(*) as n from ev").one().n;
      if (n >= MAX_ROWS) return new Response(null, { status: 429 });
      this.sql.exec("insert into ev(received, body) values(?, ?)", Date.now() / 1000, await req.text());
      return new Response(null, { status: 204 });
    }
    if (url.pathname === "/pull") {
      const ack = parseInt(url.searchParams.get("ack") || "0", 10) || 0;
      if (ack > 0) this.sql.exec("delete from ev where id <= ?", ack);
      const rows = this.sql.exec("select id, received, body from ev order by id limit ?", BATCH).toArray();
      const left = this.sql.exec("select count(*) as n from ev").one().n;
      return Response.json({ rows, left });
    }
    return new Response(null, { status: 404 });
  }
}
