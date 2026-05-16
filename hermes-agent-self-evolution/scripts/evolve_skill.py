#!/usr/bin/env python3
"""Evolution: mutate a skill via Anthropic API, evaluate variants with LLM-as-judge, pick best.

Pipeline:
  1. Read target SKILL.md
  2. Generate N mutated variants (Anthropic Messages API)
  3. Synthesize K test prompts that the skill should handle
  4. For each (variant, test) pair: ask the API to score quality (1-10)
  5. Aggregate scores, output diff vs baseline; only --apply writes back

Constraints (hard gates):
  - max 15KB skill size
  - max +20% growth vs baseline
  - YAML frontmatter must remain valid
  - body must be non-empty after frontmatter

API config: reads ANTHROPIC_AUTH_TOKEN, ANTHROPIC_BASE_URL, ANTHROPIC_MODEL from
env or ~/.claude/settings.json (env wins).
"""
from __future__ import annotations
import argparse, difflib, json, os, re, shutil, sys, tempfile, time
import urllib.request, urllib.error
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

MAX_BYTES = 15 * 1024
MAX_GROWTH = 1.20

FRONTMATTER_RE = re.compile(r"^---\r?\n.*?\r?\n---\r?\n", re.S)


def load_api_config() -> dict:
    cfg = {
        "token": os.environ.get("ANTHROPIC_AUTH_TOKEN") or os.environ.get("ANTHROPIC_API_KEY"),
        "base_url": os.environ.get("ANTHROPIC_BASE_URL", "https://api.anthropic.com"),
        "model": os.environ.get("ANTHROPIC_MODEL", "claude-opus-4-7"),
    }
    settings = Path.home() / ".claude" / "settings.json"
    if settings.exists() and not cfg["token"]:
        try:
            s = json.loads(settings.read_text(encoding="utf-8"))
            env = s.get("env", {})
            cfg["token"] = cfg["token"] or env.get("ANTHROPIC_AUTH_TOKEN") or env.get("ANTHROPIC_API_KEY")
            if not os.environ.get("ANTHROPIC_BASE_URL"):
                cfg["base_url"] = env.get("ANTHROPIC_BASE_URL", cfg["base_url"])
            if not os.environ.get("ANTHROPIC_MODEL"):
                cfg["model"] = env.get("ANTHROPIC_MODEL", cfg["model"])
        except Exception as e:
            print(f"[api] settings.json read failed: {e}", file=sys.stderr)
    if not cfg["token"]:
        print("[api] missing ANTHROPIC_AUTH_TOKEN — set env or ~/.claude/settings.json", file=sys.stderr)
        sys.exit(2)
    return cfg


def call_api(cfg: dict, prompt: str, max_tokens: int = 4096, timeout: int = 180) -> str:
    url = cfg["base_url"].rstrip("/") + "/v1/messages"
    payload = json.dumps({
        "model": cfg["model"],
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": prompt}],
    }).encode("utf-8")
    req = urllib.request.Request(url, data=payload, method="POST", headers={
        "Content-Type": "application/json",
        "x-api-key": cfg["token"],
        "Authorization": f"Bearer {cfg['token']}",
        "anthropic-version": "2023-06-01",
    })
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        for blk in data.get("content", []):
            if blk.get("type") == "text":
                return blk.get("text", "").strip()
        return ""
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")[:500]
        print(f"[api] HTTP {e.code}: {body}", file=sys.stderr)
        return ""
    except Exception as e:
        print(f"[api] error: {e}", file=sys.stderr)
        return ""


def validate(content: str, baseline_size: int) -> list[str]:
    issues = []
    if len(content.encode("utf-8")) > MAX_BYTES:
        issues.append(f"size > {MAX_BYTES}B")
    if len(content) > baseline_size * MAX_GROWTH:
        issues.append(f"growth > {(MAX_GROWTH-1)*100:.0f}%")
    if not FRONTMATTER_RE.match(content):
        issues.append("missing/invalid YAML frontmatter")
    body = FRONTMATTER_RE.sub("", content).strip()
    if not body:
        issues.append("empty body")
    return issues


def extract_block(text: str, fence: str = "```") -> str:
    """Pull out first fenced code block, else return text. Normalize CRLF→LF."""
    text = text.replace("\r\n", "\n")
    m = re.search(rf"{fence}(?:markdown|md|yaml)?\n(.*?)\n{fence}", text, re.S)
    body = m.group(1).strip() if m else text.strip()
    return body + "\n"


def mutate(cfg: dict, original: str, n: int) -> list[str]:
    prompt = (
        "You are a skill optimizer. Below is a SKILL.md file. Produce a single improved variant "
        "that is more concise, clearer, and better-structured. Preserve the YAML frontmatter "
        "exactly. Output ONLY the full new SKILL.md inside a ```markdown ... ``` fence.\n\n"
        f"```markdown\n{original}\n```"
    )
    variants = []
    for i in range(n):
        out = call_api(cfg, prompt + f"\n\n(variant seed: {i})", max_tokens=8192)
        v = extract_block(out)
        if v and v.strip() != original.strip():
            variants.append(v)
    return variants


def synth_tests(cfg: dict, original: str, k: int = 3) -> list[str]:
    prompt = (
        f"Read this SKILL.md and produce {k} short user prompts (one per line, no numbering) "
        "that would trigger the skill. Output only the prompts, nothing else.\n\n"
        f"```markdown\n{original}\n```"
    )
    out = call_api(cfg, prompt, max_tokens=512)
    lines = [l.strip(" -*\t") for l in out.splitlines() if l.strip()]
    return lines[:k] if lines else [
        "Apply this skill to a typical task.",
        "Demonstrate this skill briefly.",
        "Use this skill on a sample input.",
    ]


def judge(cfg: dict, skill: str, test_prompt: str) -> float:
    judge_prompt = (
        "You are evaluating a SKILL.md. Read it, then judge how well it would guide an agent "
        "handling this user request. Reply with ONLY a single integer 1-10, no other text.\n\n"
        f"USER REQUEST: {test_prompt}\n\n"
        f"SKILL:\n```markdown\n{skill}\n```"
    )
    out = call_api(cfg, judge_prompt, max_tokens=16, timeout=120)
    m = re.search(r"\b([1-9]|10)\b", out)
    return float(m.group(1)) if m else 0.0


def cmd_evolve(args):
    cfg = load_api_config()
    print(f"[api] base_url={cfg['base_url']} model={cfg['model']}")
    target = Path(args.skill)
    if not target.exists():
        print(f"[evolve] not found: {target}", file=sys.stderr); sys.exit(1)
    original = target.read_text(encoding="utf-8")
    baseline_size = len(original)
    print(f"[evolve] baseline: {target} ({baseline_size} chars)")

    print(f"[evolve] generating {args.rounds} variants ...")
    variants = mutate(cfg, original, args.rounds)
    print(f"[evolve] got {len(variants)} variants")

    valid = []
    for i, v in enumerate(variants):
        issues = validate(v, baseline_size)
        if issues:
            print(f"[evolve] variant#{i} rejected: {'; '.join(issues)}")
            continue
        valid.append(v)
    if not valid:
        print("[evolve] no valid variants, abort"); sys.exit(0)

    print(f"[evolve] synthesizing test prompts ...")
    tests = synth_tests(cfg, original, k=args.tests)
    print(f"[evolve] tests: {tests}")

    print(f"[evolve] scoring baseline + {len(valid)} variants on {len(tests)} tests ...")
    candidates = [("baseline", original)] + [(f"variant#{i}", v) for i, v in enumerate(valid)]
    scores = {}
    for name, c in candidates:
        s = sum(judge(cfg, c, t) for t in tests) / len(tests)
        scores[name] = s
        print(f"  {name}: {s:.2f}")

    winner_name = max(scores, key=scores.get)
    winner = original if winner_name == "baseline" else valid[int(winner_name.split("#")[1])]
    print(f"\n[evolve] winner: {winner_name} ({scores[winner_name]:.2f})")

    if winner_name != "baseline":
        diff = "\n".join(difflib.unified_diff(
            original.splitlines(), winner.splitlines(),
            fromfile="baseline", tofile=winner_name, lineterm="",
        ))
        print("\n--- DIFF ---")
        print(diff[:3000] + ("\n...(truncated)" if len(diff) > 3000 else ""))

    if args.apply and winner_name != "baseline":
        backup = target.with_suffix(target.suffix + f".bak.{int(time.time())}")
        shutil.copy2(target, backup)
        target.write_text(winner, encoding="utf-8")
        report = target.parent / f".evolve-report.{int(time.time())}.json"
        report.write_text(json.dumps({
            "target": str(target), "winner": winner_name, "scores": scores,
            "tests": tests, "backup": str(backup),
        }, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"[evolve] applied; backup={backup.name}, report={report.name}")
    else:
        print("\n[evolve] dry-run (no write). Use --apply to commit.")


def main():
    p = argparse.ArgumentParser(description="LLM-driven skill evolution (Anthropic API)")
    p.add_argument("skill", help="Path to SKILL.md to evolve")
    p.add_argument("--rounds", type=int, default=3, help="N mutation variants")
    p.add_argument("--tests", type=int, default=3, help="K synthesized eval prompts")
    p.add_argument("--apply", action="store_true", help="Write winner back (default dry-run)")
    p.set_defaults(func=cmd_evolve)
    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
