<!-- devkit-stage retro result=passed attempt=1 commit=0a5791f34f650ec734bca585cffca0aef3d37e19 -->
## Retro: change-state

1. Went wrong: `main` moved three times during delivery (stage-roles archive, the shared tmp helper, commit-attribution). Each merge staled the evidence and both reviews, cost a whole-suite run of about 27 minutes plus a fresh verify and review, and twice took this change's release numbers (0.22.0/0.26.0, then 0.23.0/0.27.0). CI's Node cancelled 82 un-awaited `t.test` subtests that passed locally. The installed devkit-openspec 0.21.1 could not read the merged `flow.json` (`appliesWhen`), so the loop ran from the worktree's own scripts. The plan kept the CI pin for the retro although the release tests tie it to the version. In a worktree whose local `main` ref is behind `origin/main`, `state` without `--change` and `/devkit status` exit 3 on a change folder the main checkout lacks (pre-existing on `main`).
2. Better next time: await every subtest and gate it in `scripts/check.py`; let a change's own test find its folder after the archive; let a merge of `main` that touches none of the change's files stale nothing; plan the CI pin move in the release task.
3. Remember: in this repository a release moves the CI pin with the version, and every `t.test` subtest is awaited.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | CI's Node cancels un-awaited `t.test` subtests that pass on a newer local Node | bug-class | regression-gate | project |
| 2 | A change's own docs test reads `openspec/changes/<id>/approval.md`, which the archive moves, so the archive PR goes red (stage-roles hit it too) | bug-class | regression-gate | project |
| 3 | A merge of `main` that touches only other changes' files stales this change's evidence and reviews, costing a 27-minute suite and a review per merge | process-friction | followup | project |
| 4 | `state` and `/devkit status` abort on one change the main checkout cannot locate | bug-class | followup | project |
| 5 | The installed plugin cannot read a branch whose `flow.json` is newer; the loop must run the worktree's own scripts | tooling | memory-only | project |
| 6 | The plan moved the CI pin in the retro; the release tests require it in the release | doc-gap | memory-only | project |

## Proposed updates

### `scripts/check.py`, `CONTRIBUTING.md` (regression-gate)
Refuse a `t.test(` call that is not awaited in any `plugins/**/*.test.mjs`, and say why in CONTRIBUTING's testing section.
- before: CONTRIBUTING says nothing about subtests; `scripts/check.py` does not read test files for this.
+ after: CONTRIBUTING: "Await every subtest (`await t.test(...)` in an `async` parent): an un-awaited subtest passes on a newer local Node and is cancelled on CI's." `scripts/check.py` fails on a line matching `^\s*t\.test\(` (no `await`) in a hook test file, naming the file and line.
- Answer: approved
- Applied: yes

### `plugins/openspec/hooks/change-loop.test.mjs`, `docs/openspec-flow.md` (regression-gate)
`change-state ADR 0017: the documents follow` reads `approval.md` from `openspec/changes/change-state/` or, once archived, from the newest `openspec/changes/archive/<date>-change-state/`, as main's stage-roles test does; applied in this change's archive pull request so its CI stays green.
- before: `const approval = readRepo('openspec', 'changes', 'change-state', 'approval.md');`
+ after: the approval path falls back to `openspec/changes/archive/<date>-change-state/approval.md` when the change folder is gone (the same lookup as `stage-roles docs: ADR 0016 ...`).
- Answer: approved
- Applied: yes

Note (2026-11-23, the owner's choice A in their own message, "`Nomear o pin (A)`"): `docs/openspec-flow.md` was added to this proposal's files after the approval, because the test change bumps devkit-openspec and a release moves the CI pin with the version; the archive check names no such file on its own (follow-up `release-pin-is-a-release-file` on the roadmap).

### `openspec/roadmap.md` (process-friction)
Add two follow-up lines to the roadmap.
- before: no line for either.
+ after: "- [ ] stale-only-on-own-files — a merge of the default branch that changes none of a change's files (outside its release files) leaves its evidence and reviews current, so a busy `main` does not cost a whole suite and a review per merge (change-state retro, learning 3)" and "- [ ] state-skips-unlocated — `change-loop.mjs state` and `/devkit status` list a change the main checkout cannot locate as blocked with its reason instead of exiting 3, and `locate` prefers the caller's worktree (change-state retro, learning 4)".
- Answer: approved
- Applied: yes

### user memory (memory-only)
On a devkit branch newer than the installed plugin, run the worktree's own `plugins/openspec/hooks/change-loop.mjs`; a release moves the CI pin with the version in the same pull request.
- Answer: approved
- Applied: yes
