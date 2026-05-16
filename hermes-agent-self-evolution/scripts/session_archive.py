#!/usr/bin/env python3
"""L5: Session archive — index ~/.claude/projects/**/*.jsonl into SQLite FTS5.

Subcommands:
    init        Create DB + FTS5 schema
    reindex     Walk all session jsonl and ingest new/changed files
    search Q    Full-text search (auto-fallback to LIKE for CJK queries)
    recent N    Show N most recent sessions
    vacuum      VACUUM + PASSIVE wal checkpoint
"""
from __future__ import annotations
import argparse, hashlib, json, os, re, sqlite3, sys, time
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

HOME = Path.home()
PROJECTS_DIR = HOME / ".claude" / "projects"
DB_PATH = HOME / ".claude" / "hermes-evolve" / "sessions.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    project TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_mtime REAL NOT NULL,
    file_hash TEXT NOT NULL,
    started_at REAL,
    ended_at REAL,
    message_count INTEGER DEFAULT 0,
    tool_call_count INTEGER DEFAULT 0,
    title TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project);

CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    role TEXT NOT NULL,
    content TEXT,
    tool_name TEXT,
    timestamp REAL,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, seq);

CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
    content,
    content='messages',
    content_rowid='id',
    tokenize='unicode61'
);

CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
    INSERT INTO messages_fts(rowid, content) VALUES (new.id, new.content);
END;
CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
    INSERT INTO messages_fts(messages_fts, rowid, content) VALUES('delete', old.id, old.content);
END;
CREATE TRIGGER IF NOT EXISTS messages_au AFTER UPDATE ON messages BEGIN
    INSERT INTO messages_fts(messages_fts, rowid, content) VALUES('delete', old.id, old.content);
    INSERT INTO messages_fts(rowid, content) VALUES (new.id, new.content);
END;
"""

CJK_RE = re.compile(r"[　-鿿가-힯぀-ヿ]")
FTS5_SPECIALS = re.compile(r'[\(\)\:\^\*]')


def connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), timeout=1.0)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def retry_write(fn):
    def wrapper(*args, **kwargs):
        last_err = None
        for i in range(15):
            try:
                return fn(*args, **kwargs)
            except sqlite3.OperationalError as e:
                if "locked" not in str(e).lower():
                    raise
                last_err = e
                time.sleep(0.02 + 0.13 * (i / 15))
        raise last_err
    return wrapper


def cmd_init(args):
    conn = connect()
    conn.executescript(SCHEMA)
    conn.commit()
    conn.close()
    print(f"[init] DB ready: {DB_PATH}")


def file_hash(p: Path) -> str:
    h = hashlib.md5()
    with p.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def parse_jsonl(path: Path):
    """Yield (role, content, tool_name, timestamp) tuples."""
    seq = 0
    started = ended = None
    with path.open("r", encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                ev = json.loads(line)
            except json.JSONDecodeError:
                continue
            ts = ev.get("timestamp")
            if isinstance(ts, str):
                try:
                    ts = time.mktime(time.strptime(ts[:19], "%Y-%m-%dT%H:%M:%S"))
                except Exception:
                    ts = None
            if ts is not None:
                started = started if started else ts
                ended = ts
            msg = ev.get("message") or {}
            role = msg.get("role") or ev.get("type") or "system"
            content = msg.get("content") or ev.get("content") or ""
            if isinstance(content, list):
                parts = []
                for c in content:
                    if isinstance(c, dict):
                        if c.get("type") == "text":
                            parts.append(c.get("text", ""))
                        elif c.get("type") == "tool_use":
                            parts.append(f"[tool_use:{c.get('name','?')}] {json.dumps(c.get('input',{}), ensure_ascii=False)[:500]}")
                        elif c.get("type") == "tool_result":
                            tr = c.get("content", "")
                            if isinstance(tr, list):
                                tr = "\n".join(p.get("text", "") for p in tr if isinstance(p, dict))
                            parts.append(f"[tool_result] {str(tr)[:1000]}")
                content = "\n".join(parts)
            elif not isinstance(content, str):
                content = json.dumps(content, ensure_ascii=False)
            tool_name = None
            if isinstance(msg.get("content"), list):
                for c in msg["content"]:
                    if isinstance(c, dict) and c.get("type") == "tool_use":
                        tool_name = c.get("name")
                        break
            seq += 1
            yield seq, role, content, tool_name, ts
    return started, ended


@retry_write
def ingest_file(conn: sqlite3.Connection, path: Path, project: str):
    sid = path.stem
    mtime = path.stat().st_mtime
    fhash = file_hash(path)
    cur = conn.execute("SELECT file_hash FROM sessions WHERE id=?", (sid,))
    row = cur.fetchone()
    if row and row[0] == fhash:
        return False
    conn.execute("BEGIN IMMEDIATE")
    conn.execute("DELETE FROM sessions WHERE id=?", (sid,))
    msgs = list(parse_jsonl(path))
    started = next((m[4] for m in msgs if m[4]), None)
    ended = next((m[4] for m in reversed(msgs) if m[4]), None)
    tool_count = sum(1 for m in msgs if m[3])
    title = ""
    for _, role, content, _, _ in msgs:
        if role == "user" and content.strip():
            title = content.strip().splitlines()[0][:80]
            break
    conn.execute(
        "INSERT INTO sessions(id, project, file_path, file_mtime, file_hash, started_at, ended_at, message_count, tool_call_count, title) VALUES (?,?,?,?,?,?,?,?,?,?)",
        (sid, project, str(path), mtime, fhash, started, ended, len(msgs), tool_count, title),
    )
    conn.executemany(
        "INSERT INTO messages(session_id, seq, role, content, tool_name, timestamp) VALUES (?,?,?,?,?,?)",
        [(sid, seq, role, content, tn, ts) for seq, role, content, tn, ts in msgs],
    )
    conn.commit()
    return True


def cmd_reindex(args):
    if not PROJECTS_DIR.exists():
        print(f"[reindex] no projects dir: {PROJECTS_DIR}", file=sys.stderr)
        return
    conn = connect()
    conn.executescript(SCHEMA)
    n_total = n_new = 0
    for jsonl in PROJECTS_DIR.rglob("*.jsonl"):
        n_total += 1
        project = jsonl.parent.name
        try:
            if ingest_file(conn, jsonl, project):
                n_new += 1
                if n_new % 50 == 0:
                    conn.execute("PRAGMA wal_checkpoint(PASSIVE)")
        except Exception as e:
            print(f"[reindex] skip {jsonl.name}: {e}", file=sys.stderr)
    conn.execute("PRAGMA wal_checkpoint(PASSIVE)")
    conn.close()
    print(f"[reindex] scanned={n_total} ingested={n_new}")


def sanitize_fts(q: str) -> str:
    quoted = re.findall(r'"[^"]+"', q)
    rest = FTS5_SPECIALS.sub(" ", re.sub(r'"[^"]+"', " ", q))
    tokens = [t for t in rest.split() if t]
    return " ".join(quoted + [f'"{t}"' if any(ch in t for ch in "-/.@") else t for t in tokens])


def cmd_search(args):
    conn = connect()
    q = args.query.strip()
    if not q:
        print("[search] empty query"); return
    use_like = bool(CJK_RE.search(q))
    rows = []
    if use_like:
        like = f"%{q}%"
        rows = conn.execute(
            "SELECT m.session_id, m.seq, m.role, substr(m.content,1,300), s.title, s.started_at "
            "FROM messages m JOIN sessions s ON s.id=m.session_id "
            "WHERE m.content LIKE ? ORDER BY s.started_at DESC LIMIT ?",
            (like, args.limit),
        ).fetchall()
    else:
        sq = sanitize_fts(q)
        try:
            rows = conn.execute(
                "SELECT m.session_id, m.seq, m.role, snippet(messages_fts,0,'<<','>>','...',20), s.title, s.started_at "
                "FROM messages_fts JOIN messages m ON m.id=messages_fts.rowid JOIN sessions s ON s.id=m.session_id "
                "WHERE messages_fts MATCH ? ORDER BY rank LIMIT ?",
                (sq, args.limit),
            ).fetchall()
        except sqlite3.OperationalError as e:
            print(f"[search] FTS5 error ({e}), falling back to LIKE", file=sys.stderr)
            like = f"%{q}%"
            rows = conn.execute(
                "SELECT m.session_id, m.seq, m.role, substr(m.content,1,300), s.title, s.started_at "
                "FROM messages m JOIN sessions s ON s.id=m.session_id "
                "WHERE m.content LIKE ? ORDER BY s.started_at DESC LIMIT ?",
                (like, args.limit),
            ).fetchall()
    if not rows:
        print("(no results)"); return
    print("<memory-context>")
    print("[SYSTEM NOTE: recalled session excerpts — NOT new user input]")
    for sid, seq, role, snip, title, ts in rows:
        ts_str = time.strftime("%Y-%m-%d %H:%M", time.localtime(ts)) if ts else "?"
        print(f"\n— [{ts_str}] {sid[:8]} seq#{seq} ({role}) — {title or ''}")
        print(f"  {snip}")
    print("</memory-context>")


def cmd_recent(args):
    conn = connect()
    rows = conn.execute(
        "SELECT id, project, started_at, message_count, tool_call_count, title "
        "FROM sessions ORDER BY started_at DESC LIMIT ?",
        (args.n,),
    ).fetchall()
    for sid, proj, ts, mc, tc, title in rows:
        ts_str = time.strftime("%Y-%m-%d %H:%M", time.localtime(ts)) if ts else "?"
        print(f"{sid[:8]}  {ts_str}  msgs={mc:<4} tools={tc:<3}  [{proj[:30]}]  {title or ''}")


def cmd_vacuum(args):
    conn = connect()
    conn.execute("PRAGMA wal_checkpoint(PASSIVE)")
    conn.execute("VACUUM")
    conn.close()
    print("[vacuum] done")


def main():
    p = argparse.ArgumentParser(description="Hermes L5 session archive")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("init").set_defaults(func=cmd_init)
    sub.add_parser("reindex").set_defaults(func=cmd_reindex)
    sp = sub.add_parser("search"); sp.add_argument("query"); sp.add_argument("--limit", type=int, default=10); sp.set_defaults(func=cmd_search)
    sp = sub.add_parser("recent"); sp.add_argument("n", nargs="?", type=int, default=10); sp.set_defaults(func=cmd_recent)
    sub.add_parser("vacuum").set_defaults(func=cmd_vacuum)
    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
