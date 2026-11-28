#!/usr/bin/env python3
"""Repository checks run in CI:
- every agent/skill name matches its file/folder and its description says when to use it;
- every relative Markdown link in the repo resolves;
- no leftover non-English prose markers;
- the panel's copies of the checkers' grammar (plugins/panel/hooks/grammar.ts) match the checkers' literals;
- every `plugin install` line names its scope: `--scope project` everywhere, and `--scope user`
  only in docs/migrate-to-project-scope.md (ADR 0004);
- every `openspec validate` command that names an id in an agent, skill, schema or CompozyOS agent file
  passes `--type change` (a change and a spec of one id are ambiguous);
- no test of the suite is skipped (`skip`, `only` or `todo`; plugins/compozy is exempt: its skips guard a missing `compozy` program, ADR 0026);
- every released flow version of the openspec schemas stays: `flow.json` equals `flows/<its version>.json`, and each
  `flows/<n>.json` matches its digest in scripts/released-flows.json, so a flow change raises its version;
- the ADRs of docs/adr and docs/decisions: no two records share a slug, an unnumbered record (`<slug>.md` titled
  `# ADR [`) is listed by an active change's decisions.md, and none is on the base branch (release-at-merge D-12).

    python3 scripts/check.py [--root <dir>]
"""
import argparse
import hashlib
import json
import os
import re
import subprocess
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
        # A string quoted in backticks is a quotation, not prose; blank fenced
        # blocks and spans (as check_links does) but keep the line numbers.
        text = re.sub(
            r"```.*?```",
            lambda m: "\n" * m.group(0).count("\n"),
            f.read_text(encoding="utf-8"),
            flags=re.S,
        )
        text = re.sub(r"`[^`\n]*`", "", text)
        for i, line in enumerate(text.splitlines(), 1):
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


VALIDATE_GLOBS = (
    "plugins/*/agents/*.md",
    "plugins/*/skills/**/*.md",
    "plugins/*/schemas/**/*.yaml",
    "plugins/*/schemas/**/*.md",
    "openspec/schemas/**/*.yaml",
    "openspec/schemas/**/*.md",
    "plugins/compozy/kit/templates/agents/*/AGENT.md",
    ".compozy/agents/*/AGENT.md",
)
VALIDATE_WITH_ID = re.compile(r"openspec validate\s+(?!-)\S")


def check_validate_type():
    # A command is code when it sits in a backtick span or a fenced block. Two gaps are accepted: a fence of
    # four backticks reads as a three-backtick fence, and a command split over two lines is read per line.
    files = set()
    for pattern in VALIDATE_GLOBS:
        files.update(ROOT.glob(pattern))
    for f in sorted(files):
        parts = f.relative_to(ROOT).parts
        if "fixtures" in parts or SKIP_DIRS.intersection(parts):
            continue
        fenced = False
        for n, line in enumerate(f.read_text(encoding="utf-8").splitlines(), 1):
            if line.lstrip(" ").startswith("```"):
                fenced = not fenced
                continue
            pieces = [line] if fenced else re.findall(r"`([^`\n]*)`", line)
            for piece in pieces:
                starts = [m.start() for m in VALIDATE_WITH_ID.finditer(piece)]
                for start in starts:
                    nxt = piece.find("openspec validate", start + 1)
                    command = piece[start : nxt if nxt != -1 else len(piece)]
                    if "--type change" not in command:
                        problems.append(
                            f"{f.relative_to(ROOT).as_posix()}:{n}: openspec validate names an id without --type change; "
                            "a change and a spec of one id are ambiguous"
                        )


def check_changelog():
    market = ROOT / ".claude-plugin" / "marketplace.json"
    changelog = ROOT / "CHANGELOG.md"
    if not (market.is_file() and changelog.is_file()):
        return
    version = str(json.loads(market.read_text(encoding="utf-8")).get("metadata", {}).get("version", ""))
    if not version:
        return
    heading = re.compile(r"^## " + re.escape(version) + r"(\s|$)", re.M)
    if not heading.search(changelog.read_text(encoding="utf-8")):
        problems.append(f'CHANGELOG.md: no "## {version}" entry for marketplace version {version}')


UNAWAITED_SUBTEST = re.compile(r"^\s*t\.test\(")


def check_awaited_subtests():
    # An un-awaited `t.test(...)` passes on a newer local Node and is cancelled on CI's.
    for f in sorted(ROOT.glob("plugins/**/*.test.mjs")):
        if SKIP_DIRS.intersection(f.relative_to(ROOT).parts):
            continue
        for n, line in enumerate(f.read_text(encoding="utf-8").splitlines(), 1):
            if UNAWAITED_SUBTEST.match(line):
                problems.append(f"{f.relative_to(ROOT)}:{n}: subtest `t.test(` is not awaited; write `await t.test(` in an async parent")


SKIPPED_TEST = (
    re.compile(r"\b(?:test|it|describe|suite|t)\.(?P<kind>skip|only|todo)\s*\("),
    re.compile(r"^\s*(?:await\s+)?(?:test|it|describe|suite|t\.test)\s*\(.*[{,]\s*(?P<kind>skip|only|todo)\s*:"),
)


def check_no_skipped_tests():
    # The suite runs every test (ADR 0026): a skipped, only or todo test is a test that does not run.
    # In plugins/compozy skip and todo pass: its tests skip themselves when the `compozy` program is not installed. `only` is
    # refused there too. An options object split over several lines is not seen.
    for f in sorted(ROOT.glob("plugins/**/*.test.mjs")):
        parts = f.relative_to(ROOT).parts
        if SKIP_DIRS.intersection(parts):
            continue
        exempt = {"skip", "todo"} if parts[1] == "compozy" else set()
        for n, line in enumerate(f.read_text(encoding="utf-8").splitlines(), 1):
            hits = (rx.search(line) for rx in SKIPPED_TEST)
            if any(hit and hit.group("kind") not in exempt for hit in hits):
                problems.append(f"{f.relative_to(ROOT)}:{n}: a test is skipped (skip, only or todo); the suite runs every test")


PANEL_GRAMMAR = ("plugins", "panel", "hooks", "grammar.ts")
OPENSPEC_HOOKS = ("plugins", "openspec", "hooks")


def check_panel_parity():
    """The panel keeps copies of grammar the openspec checkers own (design D27, D3): the tasks.md headings and
    task lines of deliver-check.mjs, the `--change` id rule of conduct-check.mjs. A copy that changes alone fails here."""
    grammar = ROOT.joinpath(*PANEL_GRAMMAR)
    if not grammar.is_file():
        return
    rel = "/".join(PANEL_GRAMMAR)
    ts = grammar.read_text(encoding="utf-8")

    def literal(name):
        m = re.search(r"^export const " + name + r" = /(.+)/[a-z]*$", ts, re.M)
        return m.group(1) if m else None

    def read(name):
        f = ROOT.joinpath(*OPENSPEC_HOOKS, name)
        return f.read_text(encoding="utf-8") if f.is_file() else None

    def expect_literal(name, checker):
        src, text = literal(name), read(checker)
        if src is None:
            problems.append(f"{rel}: no `export const {name} = /.../` literal to compare with {checker}")
        elif text is None:
            problems.append(f"{rel}: {checker} not found to compare {name} with")
        elif "/" + src + "/" not in text:
            problems.append(f"{rel}: copy of {name} differs from {'/'.join(OPENSPEC_HOOKS)}/{checker}")

    expect_literal("SECTION_RE", "deliver-check.mjs")
    expect_literal("TASK_RE", "deliver-check.mjs")
    expect_literal("CHANGE_ID_RE", "conduct-check.mjs")
    ids = re.search(r"^export const NOT_IDS[^=]*= \[([^\]]*)\]", ts, re.M)
    conduct = read("conduct-check.mjs")
    if ids is None:
        problems.append(f"{rel}: no `export const NOT_IDS = [...]` list to compare with conduct-check.mjs")
    elif conduct is not None:
        theirs = re.search(r"\[((?:'[^']*',?\s*)+)\]\.includes\(v\)", conduct)
        mine = sorted(re.findall(r"'([^']*)'", ids.group(1)))
        if theirs is None or sorted(re.findall(r"'([^']*)'", theirs.group(1))) != mine:
            problems.append(f"{rel}: copy of NOT_IDS differs from {'/'.join(OPENSPEC_HOOKS)}/conduct-check.mjs")


RELEASED_FLOWS = ("scripts", "released-flows.json")
FLOW_SCHEMAS = ("plugins", "openspec", "schemas")
FLOW_VERSION_NAME = re.compile(r"^[1-9][0-9]*$")


def flow_digest(data: bytes) -> str:
    return "sha256:" + hashlib.sha256(data).hexdigest()


def read_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def check_flow_versions():
    """A flow change raises its version (design change-version-pin D-8): each schema's `flow.json` equals
    `flows/<its version>.json`, and every kept `flows/<n>.json` matches its digest in scripts/released-flows.json."""
    schemas = ROOT.joinpath(*FLOW_SCHEMAS)
    if not schemas.is_dir():
        return
    listing = "/".join(RELEASED_FLOWS)
    digest_file = ROOT.joinpath(*RELEASED_FLOWS)
    if not digest_file.is_file():
        problems.append(f"{listing} is missing: it records the digest of every released flow version")
        return
    digests = read_json(digest_file)
    if not isinstance(digests, dict):
        problems.append(f"{listing} is not JSON")
        return
    for folder in sorted(p for p in schemas.iterdir() if (p / "flow.json").is_file()):
        rel = folder.relative_to(ROOT).as_posix()
        kept = folder / "flows"
        current = read_json(folder / "flow.json")
        version = current.get("version") if isinstance(current, dict) else None
        if isinstance(version, int) and not isinstance(version, bool):
            released = kept / f"{version}.json"
            if not released.is_file():
                problems.append(f"{rel}/flow.json: version {version} has no flows/{version}.json; keep each released flow version there")
            elif released.read_bytes() != (folder / "flow.json").read_bytes():
                problems.append(
                    f"{rel}/flow.json: differs from flows/{version}.json, the released content of version {version}; a flow change raises its version"
                )
        else:
            problems.append(f'{rel}/flow.json: no integer "version"')
        recorded = digests.get(folder.name)
        recorded = recorded if isinstance(recorded, dict) else {}
        for file in sorted(kept.glob("*.json")) if kept.is_dir() else []:
            if not FLOW_VERSION_NAME.match(file.stem):
                problems.append(f"{rel}/flows/{file.name}: not a flow version")
                continue
            own = read_json(file)
            own_version = own.get("version") if isinstance(own, dict) else None
            if own_version != int(file.stem) or isinstance(own_version, bool):
                problems.append(f"{rel}/flows/{file.name}: its version is {own_version}, not {file.stem}")
            expected = recorded.get(file.stem)
            if expected is None:
                problems.append(f"{rel}/flows/{file.name}: no digest in {listing}")
            elif expected != flow_digest(file.read_bytes()):
                problems.append(f"{rel}/flows/{file.name}: does not match the digest of released version {file.stem} in {listing}")
    for script in sorted(digests):
        versions = digests[script] if isinstance(digests[script], dict) else {}
        for n in sorted(versions):
            if not (schemas / script / "flows" / f"{n}.json").is_file():
                problems.append(f"{listing}: {script} version {n} has no flows/{n}.json")


ADR_FOLDERS = (("docs", "adr"), ("docs", "decisions"))
NUMBERED_ADR = re.compile(r"^\d{4}-(?P<slug>.+)\.md$")
# The `- ADR:` lines of a change's decisions.md, as deliver-check.mjs's ADR_LINES reads them.
ADR_LINE = re.compile(r"^[ \t]*(?:[-*][ \t]+)?ADR:[ \t]*`([^`\n]+)`", re.M)
TRAIN_BRANCH = re.compile(r"^train/\d+$")


def git_out(*args):
    try:
        r = subprocess.run(["git", "-C", str(ROOT), *args], capture_output=True, text=True)
    except OSError:
        return None
    return r.stdout.strip() if r.returncode == 0 else None


def has_ref(ref):
    return git_out("rev-parse", "--verify", "--quiet", ref) is not None


def default_branch():
    """`origin/HEAD`'s target, else `main` or `master` (local or on origin), else None."""
    target = git_out("symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD")
    if target and target.startswith("origin/"):
        return target[len("origin/"):]
    for name in ("main", "master"):
        if has_ref(f"refs/heads/{name}") or has_ref(f"refs/remotes/origin/{name}"):
            return name
    return None


def on_base():
    """Whether the checked tree is the base branch, first match wins (release-at-merge D-12): a root that is not a git repository
    is the base; `GITHUB_HEAD_REF` set is a pull request's head, the base only for `train/<n>`; the default branch checked out is
    the base; a `HEAD` contained in the default branch (local or `origin/`) is the base; anything else is a change branch."""
    top = git_out("rev-parse", "--show-toplevel")
    if top is None or Path(top).resolve() != ROOT:
        return True
    head_ref = os.environ.get("GITHUB_HEAD_REF", "")
    if head_ref:
        return bool(TRAIN_BRANCH.match(head_ref))
    default = default_branch()
    if default is None:
        return False
    if git_out("symbolic-ref", "--quiet", "--short", "HEAD") == default:
        return True
    for ref in (f"refs/remotes/origin/{default}", f"refs/heads/{default}"):
        if has_ref(ref) and git_out("merge-base", "--is-ancestor", "HEAD", ref) is not None:
            return True
    return False


def first_line(path: Path) -> str:
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            return line.strip()
    return ""


def listed_adrs():
    """The `- ADR:` paths of every active change's decisions.md (the archive is not active)."""
    changes = ROOT / "openspec" / "changes"
    listed = set()
    if not changes.is_dir():
        return listed
    for folder in changes.iterdir():
        decisions = folder / "decisions.md"
        if folder.name != "archive" and decisions.is_file():
            listed.update(p.strip() for p in ADR_LINE.findall(decisions.read_text(encoding="utf-8")))
    return listed


def check_adrs():
    """A record is numbered (`NNNN-<slug>.md`) or unnumbered (`<slug>.md` whose first non-blank line starts `# ADR [`); other files,
    a README.md, are not records. The delivery numbers an unnumbered record, so it lives only on a change branch, listed by its change."""
    slugs = {}
    unnumbered = []
    for parts in ADR_FOLDERS:
        folder = ROOT.joinpath(*parts)
        if not folder.is_dir():
            continue
        for f in sorted(folder.glob("*.md")):
            if not f.is_file():
                continue
            rel = f.relative_to(ROOT).as_posix()
            numbered = NUMBERED_ADR.match(f.name)
            if numbered:
                slug = numbered.group("slug")
            elif first_line(f).startswith("# ADR ["):
                slug = f.stem
                unnumbered.append(rel)
            else:
                continue
            slugs.setdefault(slug, []).append(rel)
    for slug, paths in sorted(slugs.items()):
        if len(paths) > 1:
            problems.append(f"a second ADR with the slug {slug}: {', '.join(sorted(paths))}")
    if not unnumbered:
        return
    listed = listed_adrs()
    base = on_base()
    for rel in unnumbered:
        if rel not in listed:
            problems.append(f"{rel}: an unnumbered ADR that no active openspec/changes/<id>/decisions.md lists in an `- ADR:` line")
        if base:
            problems.append(f"{rel}: an unnumbered ADR on the base branch; the delivery numbers it with its change's release")


def main():
    global ROOT
    ap = argparse.ArgumentParser(description="devkit repository checks")
    ap.add_argument("--root", default=str(ROOT), help="directory to check (default: this repository)")
    ROOT = Path(ap.parse_args().root).resolve()
    check_assets()
    check_links()
    check_language()
    check_install_scope()
    check_validate_type()
    check_changelog()
    check_panel_parity()
    check_awaited_subtests()
    check_no_skipped_tests()
    check_flow_versions()
    check_adrs()
    print("\n".join(problems) or "all checks passed")
    sys.exit(1 if problems else 0)


main()
print("\n".join(problems) or "all checks passed")
sys.exit(1 if problems else 0)
