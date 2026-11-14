Verdict: rejected
Commit: 307e1f54ea97c27a45796299bbaeb918bf5c3102

## Quality review — compozy-loop-v2 (round 2, stage 1)

### Findings
- [important] openspec/changes/compozy-loop-v2/design.md:256-258 / plugins/compozy/skills/compozy-setup/templates/loops/openspec-change/loop.yaml:265 (round 1 finding) — implement's prompt conditioned on a nested field of a skipped node's output, and design.md falsely claimed a test pinned the guards. · fixed in a9d879428c13231809601419dddb5f6a0b502904
- [blocking] openspec/changes/compozy-loop-v2/proposal.md:64-65 — The 'Docs and release' bullet still says devkit-openspec is untouched and this release creates no tag, contradicting the same file's Impact section, AC-10 and the diff (plugin.json 0.13.0 to 0.14.0, the CHANGELOG 0.14.0 entry, the docs/openspec-flow.md v0.14.0 pin).

### Context
Review range `e10b21d4..HEAD` (8 commits), worktree HEAD `307e1f5`, clean tree. `skip_specs: true`, so the contract is `proposal.md`'s `## Acceptance criteria`.

### Round-1 finding, re-checked
My round-1 important finding (the `implement` prompt conditioning on a nested field of a node the screenless path skips, plus the false "the template test pins the guards" claim) is fixed in `a9d8794`: the guard moved to the parent in both the template and the installed copy; `loop-template.test.mjs` gained a sequential open/close scan that fails on exactly the shape that was shipped, with a named, structurally justified exemption for `screens_ok` (confirmed: exactly one incoming edge, from `design`); `adoption.test.mjs` gained a matching assertion over the installed copy; and `design.md`'s Risk bullet now states what is actually checked. Re-ran both test files (31 pass) and `compozy loop validate` against the live daemon (`valid: true`).

### Praise
- [praise] `a9d8794` - the fix is exactly the shape the review asked for: a structural, mechanical scan rather than a hand-maintained list of line numbers, a narrowly scoped exemption tied to the graph's actual reachability, the assertion placed at the right layer in each file that owns its surface, and `design.md` corrected to no longer claim a test that did not exist.

### Summary
- 2 findings (1 blocking, 0 important, 0 nit) and 1 praise. The round-1 important finding is closed; a new blocking internal contradiction surfaced in `proposal.md`, introduced by the same phase-8 commit that fixed everything else this round.
- Justification: re-verified the previous finding's fix by reading the diff, re-running the two touched test files and `compozy loop validate` live; ran the touched-surface test matrix (loop-template, adoption, devkit-kit, project-settings - 56 tests), `gen-catalog.py --check`, `check.py` and the bundled app's `plugin validate .`, all green; cross-read `proposal.md`, `design.md`, `tasks.md`, the two ADR diffs and `openspec/config.yaml` for self-consistency and found one place where phase 8's correction was incomplete.
