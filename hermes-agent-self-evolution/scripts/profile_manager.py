#!/usr/bin/env python3
"""L4: Profile manager — atomic writes for USER.md / MEMORY.md with size cap + injection scan.

Subcommands:
    init                       Create profile dir + empty files
    show {user|memory}         Print file content
    append {user|memory} TEXT  Append a bullet (with size + injection guards)
    review-prompt              Output a review-prompt for hook integration
"""
from __future__ import annotations
import argparse, os, re, sys, tempfile, time
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

HOME = Path.home()
PROFILE_DIR = HOME / ".claude" / "hermes-evolve" / "profile"
USER_FILE = PROFILE_DIR / "USER.md"
MEM_FILE = PROFILE_DIR / "MEMORY.md"
REVIEW_QUEUE = HOME / ".claude" / "hermes-evolve" / "review-queue.jsonl"

LIMITS = {"user": 1375, "memory": 2200}
FILES = {"user": USER_FILE, "memory": MEM_FILE}

INJECTION_PATTERNS = [
    re.compile(r"ignore\s+(all\s+)?previous\s+instructions", re.I),
    re.compile(r"do\s+not\s+tell\s+the\s+user", re.I),
    re.compile(r"you\s+are\s+now\s+(a|an)\s+", re.I),
    re.compile(r"system\s+prompt\s*[:=]", re.I),
    re.compile(r"</?\s*system\s*>", re.I),
    re.compile(r"\bcurl\b[^\n]*\b(secret|token|api[_-]?key)\b", re.I),
    re.compile(r"\bwget\b[^\n]*\b(secret|token|api[_-]?key)\b", re.I),
    re.compile(r"ssh-rsa\s+[A-Za-z0-9+/=]{40,}"),
    re.compile(r"\.env\b.*\b(cat|read|show)\b", re.I),
    re.compile(r"override\s+(system|safety|guardrails)", re.I),
]
HIDDEN_UNICODE = re.compile(r"[​-\u200F\u202A-\u202E⁠﻿᠎]")


def scan_injection(text: str) -> list[str]:
    issues = []
    for pat in INJECTION_PATTERNS:
        if pat.search(text):
            issues.append(f"injection-pattern: {pat.pattern[:60]}")
    if HIDDEN_UNICODE.search(text):
        issues.append("hidden-unicode-character")
    return issues


def atomic_write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".tmp_", dir=str(path.parent), text=True)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as f:
            f.write(content)
        os.replace(tmp, path)
    except Exception:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def cmd_init(args):
    PROFILE_DIR.mkdir(parents=True, exist_ok=True)
    if not USER_FILE.exists():
        atomic_write(USER_FILE, "# USER PROFILE\n\n")
    if not MEM_FILE.exists():
        atomic_write(MEM_FILE, "# AGENT MEMORY\n\n")
    REVIEW_QUEUE.parent.mkdir(parents=True, exist_ok=True)
    REVIEW_QUEUE.touch(exist_ok=True)
    print(f"[init] {USER_FILE}\n[init] {MEM_FILE}\n[init] {REVIEW_QUEUE}")


def cmd_show(args):
    f = FILES[args.kind]
    if not f.exists():
        print(f"(empty) {f}"); return
    print(f.read_text(encoding="utf-8"))


def cmd_append(args):
    kind = args.kind
    text = args.text.strip()
    if not text:
        print("[append] empty text", file=sys.stderr); sys.exit(2)
    issues = scan_injection(text)
    if issues:
        print(f"[append] BLOCKED — {'; '.join(issues)}", file=sys.stderr); sys.exit(3)
    f = FILES[kind]
    f.parent.mkdir(parents=True, exist_ok=True)
    current = f.read_text(encoding="utf-8") if f.exists() else f"# {kind.upper()} PROFILE\n\n"
    if text in current:
        print(f"[append] duplicate, skipped"); return
    new = current.rstrip() + f"\n- [{time.strftime('%Y-%m-%d')}] {text}\n"
    if len(new) > LIMITS[kind]:
        print(f"[append] OVERFLOW — would be {len(new)} > {LIMITS[kind]} chars; prune {f} first", file=sys.stderr)
        sys.exit(4)
    atomic_write(f, new)
    print(f"[append] ok ({len(new)}/{LIMITS[kind]} chars)")


def cmd_review_prompt(args):
    PROMPT = (
        "After-turn review: scan the just-completed exchange for (a) durable user preferences "
        "or environment facts worth saving, and (b) reusable procedural patterns worth promoting "
        "to a skill. If any found, propose `python scripts/profile_manager.py append ...` or a new "
        "skill outline. If none, say 'no-op'."
    )
    REVIEW_QUEUE.parent.mkdir(parents=True, exist_ok=True)
    with REVIEW_QUEUE.open("a", encoding="utf-8") as f:
        f.write(f'{{"ts":{time.time()},"prompt":"{PROMPT}"}}\n')
    print(PROMPT)


def main():
    p = argparse.ArgumentParser(description="Hermes L4 profile manager")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("init").set_defaults(func=cmd_init)
    sp = sub.add_parser("show"); sp.add_argument("kind", choices=["user", "memory"]); sp.set_defaults(func=cmd_show)
    sp = sub.add_parser("append"); sp.add_argument("kind", choices=["user", "memory"]); sp.add_argument("text"); sp.set_defaults(func=cmd_append)
    sub.add_parser("review-prompt").set_defaults(func=cmd_review_prompt)
    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
