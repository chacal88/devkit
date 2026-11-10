## Retro: conduct-sessions

1. Went wrong: the ship itself was clean (three phases, three green gates, two review rounds, PR #14 merged by GitHub at 8/8), but three things slipped past the agents and were caught only by a second look. The phase-3 `tdd-implementer` reported a CHANGELOG `## 0.9.0` entry it never wrote, ticked task 3.3, and gate 3.9 stayed green because nothing checks that the released version has a CHANGELOG heading; the main session noticed only when `commit-and-pr` said the file was unchanged. The first `commit` dispatch was built from `deliver-check`'s `next.paths`, which lists only paths outside `openspec/`, so `openspec/config.yaml` (task 3.1) was left out and needed a second commit. Review round 1 found the conduct skill's Archive paragraph naming `session.name`, a field the checker emits only on `implement` rows, so no row carries it once the phase's gate is ticked; and every descriptor test used phase 1, so a mis-derived phase would have stayed green. Smaller: `enable-auto-merge` was followed at once by `disable-auto-merge` because item 6 counts "no checks reported" as met before CI starts, then `wait-checks`, then `enable-auto-merge` again; harmless, two extra GitHub calls. The readiness session before this one ran its reviewer as a general-purpose subagent because devkit-core was not installed in that session; this session had both packs installed at project scope and every agent ran as its real type.
2. Better next time: treat an implementer's "files changed" as a claim and check `git status` against the task's named files before ticking or committing; when `deliver-check` says `commit`, stage `next.paths` plus every other modified tracked file `git status` shows, not only the listed ones; let `scripts/check.py` refuse a marketplace version without its CHANGELOG heading; when a skill paragraph reads a JSON field, name the step at which the field exists; test a derived value at a non-default input (phase 2, not only phase 1).
3. Remember: a subagent's report of an edit is a claim until `git status` shows the file.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | A ticked release task had no CHANGELOG entry and no gate caught it | tooling | regression-gate (proposed below: `scripts/check.py` + test) | project |
| 2 | `deliver-check`'s `commit` paths exclude `openspec/`, so the dispatch missed `openspec/config.yaml` | doc-gap | doc-update (proposed below: ship-change commit row) | project |
| 3 | The implementer reported an edit it did not make; the coordinator trusted the report | process-friction | memory-only (proposed below: user memory) | user |
| 4 | Skill text read `session.name` at a step where no row carries it (caught in review round 1, fixed in e2ad482) | bug-class | none (fixed) | project |
| 5 | Descriptor tests used phase 1 only (caught in review round 1, fixed in e2ad482) | bug-class | none (fixed) | project |
| 6 | Item 6 counts "no checks reported" as met right after `open-pr`, so `enable-auto-merge` flips to `disable-auto-merge` once CI starts | tooling | followup: a change of its own (treat zero checks on a PR younger than the CI workflow's usual start as pending, or have ship-change watch once before the first `enable-auto-merge`) | project |
| 7 | A session runs the installed pack, not the working tree: the 0.9.0 `/conduct` dogfood needs the project's devkit-openspec updated first | environment | doc-update (proposed below: CONTRIBUTING "Testing a pack locally") | project |
| 8 | Two rules collide at the archive: `unnamedFiles` refuses `docs/openspec-flow.md` at apply-proposals (not a release file) while `deliver-check.test.mjs` requires its CI pin to follow the devkit-openspec version, so a pack bump at apply-proposals always fails one of them (seen on archive PR #15: CI `check` red after the pin was reverted) | tooling | doc-update (proposed below: the pin) + followup: a change of its own adds `docs/openspec-flow.md` to `RELEASE_FILE` or moves the pin bump into the release step | project |

## Proposed updates

### `scripts/check.py`, `plugins/openspec/hooks/guard.test.mjs` (regression-gate)
Add `check_changelog()` to `scripts/check.py`, called from `main()` after `check_install_scope()`: when both `.claude-plugin/marketplace.json` and `CHANGELOG.md` exist under the root, the marketplace `metadata.version` must have a heading `## <version>` (followed by a space, ` — ` or end of line) in `CHANGELOG.md`; otherwise append `CHANGELOG.md: no "## <version>" entry for marketplace version <version>` to `problems`. A fixture without either file is skipped, so the existing lint fixtures stay green. Add a `lint(...)` test next to the install-scope tests in `guard.test.mjs`: a root with `metadata.version: "1.2.3"` and a CHANGELOG whose first heading is `## 1.2.2` exits 1 with that message; the same root with `## 1.2.3 — x` exits 0.
- before: check_install_scope() is the last check in main(); nothing ties the marketplace version to CHANGELOG.md
+ after: check_changelog() runs after it and fails the lint when the marketplace version has no `## <version>` heading in CHANGELOG.md; one guard test pins both outcomes
- Answer: approved
- Applied: yes

### `plugins/openspec/skills/ship-change/SKILL.md` (doc-gap)
The `commit` row of the Loop table: say what to stage, since `next.paths` lists only the paths outside `openspec/`.
- before: | `commit` | Dispatch `devkit-core:commit-and-pr`: "Commit only for change <id>: stage the changed files by name (not `.claude/`), commit, push; no PR. This is a pre-review commit: precondition 3 does not apply, review runs next." |
+ after: | `commit` | Dispatch `devkit-core:commit-and-pr`: "Commit only for change <id>: stage by name `next.paths` plus every other modified or untracked file `git status` shows under `openspec/` (the change folder, `openspec/config.yaml`), never `.claude/`; commit, push; no PR. This is a pre-review commit: precondition 3 does not apply, review runs next." `next.paths` lists only the paths outside `openspec/`; the change folder and `openspec/config.yaml` are staged from `git status`. |
- Answer: approved
- Applied: yes

### `CONTRIBUTING.md` (environment)
Under "Testing a pack locally", after the `--plugin-dir` snippet.
- before: (none)
+ after: A session runs the pack installed at project scope, not the working tree: after a release merges, run `claude plugin update devkit-openspec@devkit` (and `devkit-core@devkit` when it changed) in the project before dogfooding the new version, or load the tree with `--plugin-dir` as above.
- Answer: approved
- Applied: yes

### user memory (memory-only)
A subagent's report of an edit is a claim: check `git status` for each file it names before ticking a task or dispatching a commit.
- Answer: approved
- Applied: yes

### `docs/openspec-flow.md` (tooling)
The CI snippet pin follows the devkit-openspec release (0.9.1): the test "the pin in docs/openspec-flow.md is the commit sha of v + the devkit-openspec version" in `deliver-check.test.mjs` requires it, and `unnamedFiles` accepts the file only when a proposal names it. Every `v0.9.0` in the snippet and its prose becomes `v0.9.1`; nothing else in the file changes.
- before: # pinned to the commit of v0.9.0 (a tag can move; a commit cannot) · <commit sha of v0.9.0> in the raw URL · the prose "(`v0.9.0` above)" and "git/ref/tags/v0.9.0"
+ after: the same lines with v0.9.1
- Answer: approved

## Dogfood

Pending: the live half of AC-5, AC-6, AC-7, AC-9 and AC-11 (round 5 of `openspec/roadmap.md` conducted with sessions to `archived`) needs the owner's typed `/conduct` in the desktop app with devkit-openspec 0.9.0 installed (this session still runs the 0.8.0 pack). Not run by this session: only the owner's typed `/conduct` is the go-ahead (design D13). Recorded here once the owner runs it.
