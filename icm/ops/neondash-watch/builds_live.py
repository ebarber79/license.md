"""ND-035: record when each Neon Dash build went live on Play, from Play's
"Your update is live" emails, into /root/neondash-events/builds.json.
report.py uses it to keep Google's review / pre-launch test devices (sessions
that start before a build went live) out of the player numbers.

Play sends the same email for every kind of update (Data safety, store listing,
a release) and doesn't name the build. Rule: an email belongs to a build when the
update's "created on" time is at or after the build's first event. Uploading a
bundle starts Google's test devices straight away; the release is created after
that, while policy/listing changes made before the upload are skipped.
If a later email also matches a build recorded automatically less than 48 h
earlier, the go-live time moves to the later email (errs toward calling early
sessions test devices, never the other way round). Manual entries are never
touched."""
import datetime as dt, json, os, re, sqlite3

EVENTS_DIR = os.environ.get("ND_EVENTS_DIR", "/root/neondash-events")
DB = os.path.join(EVENTS_DIR, "events.db")
BUILDS = os.path.join(EVENTS_DIR, "builds.json")
CREATED_RE = re.compile(r"created on (\w+ \d{1,2}, \d{4}) at (\d{1,2}:\d{2} [AP]M) GMT")
MOVE_WINDOW = 48 * 3600


def iso(ts):
    return dt.datetime.fromtimestamp(ts, dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_created(text):
    m = CREATED_RE.search(text or "")
    if not m:
        return None
    d = dt.datetime.strptime(f"{m.group(1)} {m.group(2)}", "%b %d, %Y %I:%M %p")
    return d.replace(tzinfo=dt.timezone.utc).timestamp()


def first_events(live_ts):
    """build -> first received time, for Android builds with events before live_ts."""
    c = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    try:
        return dict(c.execute("select build, min(received) from events where platform='android' "
                              "and build is not null group by build having min(received) <= ?",
                              (live_ts,)).fetchall())
    finally:
        c.close()


def record(text, live_ts, msg_id):
    """Handle one "Your update is live" email. Returns lines to report (may be empty)."""
    created = parse_created(text)
    if created is None:
        return [f"couldn't read the 'created on' time in Play email {msg_id}; builds.json unchanged"]
    try:
        builds = json.load(open(BUILDS))
    except (OSError, ValueError):
        builds = {}
    out = []
    for build, first in sorted(first_events(live_ts).items(), key=lambda x: x[1]):
        if created < first:
            continue  # update created before this build existed: not its release
        cur = builds.get(build)
        if cur is None:
            builds[build] = {"live": iso(live_ts), "created": iso(created), "source": f"auto: Play email {msg_id}"}
            out.append(f"build {build} went live {iso(live_ts)}: its earlier sessions now count as Google test devices")
        elif str(cur.get("source", "")).startswith("auto"):
            old = dt.datetime.fromisoformat(cur["live"].replace("Z", "+00:00")).timestamp()
            if old < live_ts <= old + MOVE_WINDOW:
                cur.update(live=iso(live_ts), created=iso(created), source=f"auto: Play email {msg_id} (moved)")
                out.append(f"build {build}: a later Play update also matched, go-live moved to {iso(live_ts)}")
    if out:
        tmp = BUILDS + ".tmp"
        with open(tmp, "w") as f:
            json.dump(builds, f, indent=2)
        os.replace(tmp, BUILDS)
    return out
