# Review: conduct-one-change

Structural: PASS (`openspec validate conduct-one-change --strict` valid; `scripts/check.py` all checks passed; HEAD a527a0f)

| Reviewer | Verdict | Blocking findings |
|---|---|---|
| code-quality-reviewer | FAIL (1 important) | 0 |
| test-coverage-reviewer | FAIL (1 important, verdict line approved) | 0 |
| adr-reviewer | PASS | 0 |

Consensus: FAIL (round 1/2)

## Blockers

- code-quality-reviewer — plugins/openspec/hooks/conduct-check.mjs:699 — the `--change` id regex accepts a leading dash (`--change --json` swallows `--json`; `--change=-rf` reaches the suggested git commands); require `^[A-Za-z0-9][\w.-]*$` and test `--change --json` and `-x`.
- test-coverage-reviewer — plugins/openspec/hooks/conduct-check.test.mjs — no test reads a `chore/archive-<id>` worktree holding only the archived folder with `--change`; a live-only guard in `evaluate` would exit 3 on the archive step and nothing would go red.

## Nits (no re-review)

- `renderHuman` does not show `unfinished`; round mode now runs `git status` per worktree row; `dirty.slice(0, 3)` untested past three paths; skill pins are prose substrings.
- ADR 0007 Decision 4 lists the sidebar group and the archive as ADR 0006 rules that live in 0006's Consequences and the skill; ADR 0001's Note names only the roadmap round; the Auto-fix line says `/conduct` where `/conduct <id>` reads better.

## Next

Fix the blockers and run review-change again (round 2: code-quality-reviewer and test-coverage-reviewer only).
