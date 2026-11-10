Verdict: rejected
Commit: a527a0f40340e774a70af46ab3c0322394e60c3b
Round: 1

## Quality review - conduct-one-change (round 1)

### Findings
- [important] plugins/openspec/hooks/conduct-check.mjs:699 - the id regex `/^[\w.-]+$/` accepts a leading dash. Reproduced: `conduct-check --change --json` swallows `--json` as the id (exit 3, human text, error "no change --json: ... create it with `openspec new change --json ...` on a branch named --json"), and `--change=-rf` reaches the git/worktree layer and the suggested `git worktree add -b`/`git switch -c` commands as an option-like name. The skill promises the typo'd id creates nothing, but a dash id is a flag-injection vector into commands the skill later runs. Not covered by the "bad id" test. · fix: require `^[A-Za-z0-9][\w.-]*$` (also reject when the next token starts with `--` for the space form) and add a test with `--change --json` and `-x`.
- [nit] plugins/openspec/hooks/conduct-check.mjs:711 - `renderHuman` ignores `unfinished` (and `mode`), so the human output of a dirty worktree is silent while only `--json` carries it. Add one line per row with `unfinished` summary.
- [nit] plugins/openspec/hooks/conduct-check.mjs:487 - `unfinishedWork` now runs `gitFacts` (git status) for every row with a worktree in round mode too, including `--watch` re-computes; acceptable at 3 rows, note for later.
- [nit] plugins/openspec/hooks/guard.test.mjs (AC-6 test) - the unfinished-work gate, the missing-change flow and the "never asks on a continuation turn" rules are only text pins; behavior is proven only by the post-merge dogfood (tasks.md follow-up). Fine for a skill, but AC-6/AC-9 have no real-output demonstration in this round.
- [praise] plugins/openspec/hooks/conduct-check.mjs:608,654 - single mode reuses `evaluate`/`conclude` unchanged through one `roundOf` helper, so the watch loop, dispatch summary and sessions stay shared with round mode and the diff stays additive (version 2 kept).
- [praise] plugins/openspec/hooks/conduct-check.test.mjs:1211 - the single-row test compares `next`, `state`, `sessionPrefix` and `session` against the round-mode row, a real parity check; the three exit-3 prefixes each have their own test.

### Summary
- 4 findings (0 blocking, 1 important, 3 nit) + 2 praise
- Justification: read the full checker diff, SKILL.md diff, tasks and test pins; ran the CLI with `--change --json` and `--change=-rf` to confirm the leading-dash id gap. Scope matches the proposal; no ADR conflict seen (ADR 0007 amends 0006 explicitly). One important edge in argument validation stands until fixed.
