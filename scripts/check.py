#!/usr/bin/env python3
"""Repository checks run in CI:
- every agent/skill name matches its file/folder and its description says when to use it;
- every relative Markdown link in the repo resolves;
- no leftover non-English prose markers;
- every `plugin install` line names its scope: `--scope project` everywhere, and `--scope user`
  only in docs/migrate-to-project-scope.md (ADR 0004).

    python3 scripts/check.py [--root <dir>]
"""
import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SKIP_DIRS = {".git", "node_modules"}
# Paths that quote the old commands or are generated locally: skipped by the install-scope check only.
SCOPE_SKIP_PREFIXES = (
    ("openspec", "changes"),
    (".claude", "worktrees"),
    (".claude", "skills"),
    (".claude", "commands"),
)
MIGRATION_DOC = ("docs", "migrate-to-project-scope.md")
problems = []


def md_files():
    for p in ROOT.rglob("*.md"):
        if not SKIP_DIRS.intersection(p.relative_to(ROOT).parts):
            yield p


def check_assets():
    for f in ROOT.glob("plugins/*/agents/*.md"):
        check_frontmatter(f, f.stem)
    for f in ROOT.glob("plugins/*/skills/*/SKILL.md"):
        check_frontmatter(f, f.parent.name)


def check_frontmatter(f: Path, expected: str):
    text = f.read_text(encoding="utf-8")
    m = re.match(r"---\n(.*?)\n---\n", text, re.S)
    rel = f.relative_to(ROOT)
    if not m:
        problems.append(f"{rel}: no frontmatter")
        return
    fm = m.group(1)
    name = re.search(r'^name:\s*"?([^"\n]+?)"?\s*$', fm, re.M)
    if not name or name.group(1) != expected:
        problems.append(f"{rel}: name {name.group(1) if name else None!r} != {expected!r}")
    desc = re.search(r"^description:\s*(.+)$", fm, re.M)
    if desc and desc.group(1)[:1] not in "\"'>|" and re.search(r": | #", desc.group(1)):
        problems.append(f"{rel}: unquoted description contains ': ' or ' #' (YAML would fail to parse)")
    if not desc:
        problems.append(f"{rel}: no description")
    elif not re.search(r"\bUse (when|after|before|only|at|for)\b|\bLoad before\b", desc.group(1)):
        problems.append(f"{rel}: description doesn't say when to use it")


def check_links():
    for f in md_files():
        if "templates" in f.relative_to(ROOT).parts:
            continue  # template links point to where the file lands in a project
        text = re.sub(r"```.*?```", "", f.read_text(encoding="utf-8"), flags=re.S)
        text = re.sub(r"`[^`\n]*`", "", text)
        for link in re.findall(r"\]\(([^)\s]+)\)", text):
            if re.match(r"(https?:|mailto:|#)", link):
                continue
            target = (f.parent / link.split("#")[0]).resolve()
            if not target.exists():
                problems.append(f"{f.relative_to(ROOT)}: broken link {link}")


def check_language():
    pattern = re.compile(r"\b(não|você|também|está|então|porque|ção|ções)\b", re.I)
    for f in md_files():
        for i, line in enumerate(f.read_text(encoding="utf-8").splitlines(), 1):
            if pattern.search(line):
                problems.append(f"{f.relative_to(ROOT)}:{i}: non-English text")


def check_install_scope():
    install = re.compile(r"(/plugin|claude plugin) install\b")
    for f in md_files():
        parts = f.relative_to(ROOT).parts
        if any(parts[: len(pre)] == pre for pre in SCOPE_SKIP_PREFIXES):
            continue
        scope = "--scope user" if parts == MIGRATION_DOC else "--scope project"
        for i, line in enumerate(f.read_text(encoding="utf-8").splitlines(), 1):
            if install.search(line) and scope not in line:
                problems.append(
                    f"{'/'.join(parts)}:{i}: plugin install must use {scope}"
                )


def main():
    global ROOT
    ap = argparse.ArgumentParser(description="devkit repository checks")
    ap.add_argument("--root", default=str(ROOT), help="directory to check (default: this repository)")
    ROOT = Path(ap.parse_args().root).resolve()
    check_assets()
    check_links()
    check_language()
    check_install_scope()
    print("\n".join(problems) or "all checks passed")
    sys.exit(1 if problems else 0)


main()
print("\n".join(problems) or "all checks passed")
sys.exit(1 if problems else 0)
