# Readiness review: devkit-opt-in

Round 2 (re-review of the whole change after the planner revised design D8/D10 and tasks 3.1/3.3).

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

## 2. Scope validation
Classification: correct. Request, proposal, AC-1..AC-8 and the three task phases line up. Out of scope is explicit (no devkit in margi/recruit/psim-kernel, no gate changes inside opted-in projects, no edits to `deliver-check`/`ship-change`/CI). `skip_specs: true` is justified (D1, `openspec/specs/` empty). Owner-machine changes stay owner-gated: no task runs a `claude plugin` command or writes under `~/.claude`, recruit or representante-digital; the four items are plain bullets in `## Workflow follow-up`, each only on the owner's explicit yes for that item (design D10, tasks.md Workflow follow-up). Q1 (ADR 0004 accepted) and Q2 (machine state proven in `retro.md` after the merge) are recorded in design.md Open Questions.

## 3. Proposal review
Problem, goal, BREAKING notes (silent destructive git outside opted-in projects; `install-schemas.sh` no-argument default), impact and non-goals are explicit. No finding.

## 4. Design review
No metadata/roadmap/current-state artifact is required (`openspec/roadmap.md` does not list the change; the proposal says so).

Claims re-derived against live code (all hold):
- `guard.mjs`: `findRoot` (`:59-66`), `resolveChange` (`:98-114`), `changeSchemaAt` with the line-anchored regex (`:122-129`), `.claude/` exempt in `classify` (`:185`), `guardEdit` without a devkit notion (`:302-317`), `guardBash` running `gitViolation` before `findRoot` (`:321-323`), `gh pr create` check (`:334-337`), `session` printing for any root (`:387-394`), `ci` only forwarding by dynamic import.
- `deliver-check.mjs:15` imports exactly the helpers D3 says must keep their meaning.
- `install-schemas.sh` no-argument writes the XDG dir, and its final validate uses `${1:-.}` (breaks with `--user`, as D5 says).
- `SKILL.md:21-23` and `:39`; `README.md:5`; `/plugin install` lines in README, getting-started and the five pack READMEs.
- `repo()` in `guard.test.mjs:24` writes `schema: devkit`; existing hook tests use only opted-in repos, so "pass unchanged" (AC-3) is true. The CI test with no `openspec/` (`:249`) exercises `ci`, which is untouched. Pin test `deliver-check.test.mjs:2926`, marketplace versions, `docs/adr/` contents, `openspec/config.yaml` ADR line, margi and recruit paths: as stated. `.claude/settings.json` is not ignored.
- Revised D8 lint: `scripts/check.py:18-20` `md_files()` skips only `.git`/`node_modules`, as the plan now says; `ROOT` is a module constant, so adding `--root <dir>` is feasible, and on a fixture root the `plugins/*` globs match nothing, so the node test can assert on the lint's own messages.

Prior blocker resolved: D8 now has an exact rule (`--scope project` everywhere; `--scope user` only inside `docs/migrate-to-project-scope.md`, whose only `claude plugin install` lines are item 1's Undo; other scopes fail with `<path>:<line>`), skip-list (`openspec/changes/`, `.claude/worktrees/`, `.claude/skills/`, `.claude/commands/`) and fixture tests; D10 "Lint interplay" and tasks 3.1/3.3 agree with it. Item 2's undo is `marketplace add`, which the regex does not match. No remaining contradiction found.

## 5. Specs review
Not applicable by design (`skip_specs: true`, D1). Behavior is pinned by named tests per task. No finding.

## 6. Tasks review
Ordered by dependency; tests first with an explicit red step in every behavior task; each phase ends in a gate; paths are real or explicit creates. Every AC has a task and a way to verify it: AC-1/2/3 -> 1.2-1.5, 1.8; AC-4 -> 3.1-3.2; AC-5 -> 2.1-2.4; AC-6 -> 2.5; AC-7 -> 3.3-3.4 (doc) plus follow-up and `retro.md` (machine state, per Q2); AC-8 -> 3.5-3.6. Task 1.1 depends on this APPROVED, as intended.

## 7. Omission detection
Validation and error behavior are defined for both scripts (exit codes, refusals, `$HOME` root, invalid JSON) and for the hooks (silent exit 0). Idempotency: unchanged file not rewritten; re-run replaces schemas; atomic write. Rollback: revert the PR plus per-item Undo and backups. Compatibility with representante-digital's own schema is tested (1.3, 1.5). Observability, retries, flags: not relevant. Recorded limits in ADR 0004: renamed schema turns hooks off; `cd`-into-repo gap for destructive git; worktrees on old branches lack the settings file.

## 8. Execution risks (top 5 failures)
1. Cause: `gitViolation` is moved after `optedIn`. Impact: a later reorder restores or drops the rule. Prevention: per-mode and per-rule tests in 1.2/1.3.
2. Cause: `install-schemas.test.mjs` restricts `PATH` to the folders of `bash` and `git`. Impact: macOS/ubuntu portability (R10). Prevention: resolve the folders at runtime, as designed; CI runs it.
3. Cause: the lint test runs `check.py --root <tmp>`. Impact: argument parsing or fixture layout drifts from the real run. Prevention: 3.1 also runs the lint on the real repository and pastes the red output.
4. Cause: the owner-machine items run by an agent after the merge. Impact: user-scope devkit lost mid-session. Prevention: the doc's opening rule, one yes per item, backups, undo lines, repeated in the Workflow follow-up.
5. Cause: a concurrent `conduct-rounds` release of 0.7.0. Impact: version/pin collision. Prevention: R6 (second to merge rebases, takes the next minor, pin test fails loudly).

## 9. Mandatory fixes before implementation
None.

## 10. Optional improvements (within scope)
- [ ] Low: `SKILL.md:39`'s `/plugin install` text is rewritten by both 2.4 and 3.2's lint; the overlap is harmless.

## 11. Explicitly out of scope
- [ ] `conduct-rounds` edits to `ship-change`/`deliver-check`.
- [ ] Reading Claude Code settings from the hooks (options b and c rejected in D2).

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes, with verified line citations.
2. Is the result measurable? Yes: each AC maps to a test, smoke or gate; AC-7's machine state is measured after the merge in `retro.md` (Q2).
3. Are error behaviors defined? Yes, for both scripts, the lint and the hooks.
4. Are edge cases covered? Yes: quoted/comment-only/renamed schema, subdirectory `cwd`, nested worktree, no active change, `$HOME` root, invalid JSON, lint skip-list.
5. Are dependencies clear? Yes; phase order justified; ADR 0001 and the archive-after-merge pin named.
6. Are contracts defined? Yes: CLI flags, exit codes, output lines and JSON shape, `optedIn` exports, the lint rule.
7. Can two developers interpret this differently? Not on anything material.
8. Are any decisions implicit instead of written? No.
9. Do the tasks fully deliver the intended outcome? Yes; the machine part is intentionally post-merge and owner-gated.
10. What will be discovered too late? Portability of the shell test (risk 2) at worst; nothing that changes scope.

## 13. Final conclusion
- Can we start? Yes.
- What must be fixed? Nothing mandatory.
- Main risk if ignored? Not applicable; watch the shell-test portability and keep the owner-machine items behind an explicit yes per item.
Validation: `openspec validate devkit-opt-in --strict` valid and `python3 scripts/check.py` passing, per the caller (not re-run).
