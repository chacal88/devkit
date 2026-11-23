<!-- devkit-stage retro result=passed attempt=1 commit=4fa637e5017ccace224fc98da30454706b44ffe1 -->
## Retro: release-merge-conflict

1. Went wrong: the delivery took far longer than the code: main was merged into the branch eight times while PR #65 waited (stage-roles #58 took devkit-openspec 0.22.0 and the marketplace 0.26.0, delivery-models #73 took 0.28.0 and 0.32.0, plus archives and patch releases), so the release was renumbered three times by hand (0.22.0 to 0.23.0, then 0.28.0, then 0.29.0), and each merge of main made the evidence (a guard suite of 30 to 40 minutes) and the reviews stale. The evidence attempts kept counting across those re-takes: the third take, which failed for a real reason, hit the stage's ceiling of three and ended the run blocked for hours until the owner answered. That failure was a plan gap: a modified requirement carries the whole block, and main's archive of stage-roles added three scenarios to it after the plan was approved, so `openspec validate --strict` failed. The same drift showed twice more: two attribution tests from main still pinned the removed `push-rebased` step (found only when the suite ran), and the canonical `openspec/specs/commit-attribution/spec.md` still names that step; no delta of this change covers it and the PR merged before the owner could decide. The installed devkit-openspec 0.21.1 also refused the merged `flow.json` (`appliesWhen` key), and the loop first offered `update-branch` from a stale local main. A `TMPDIR` of `/tmp/...` made one budget test fail on macOS (`/tmp` is `/private/tmp`), and the waiter loops of suite-running agents polled for `# fail` (node prints `ℹ fail`) and ran on after the work was done.
2. Better next time: at every merge of the base, before the evidence, run `openspec validate <id> --strict`, copy main's new scenarios verbatim into a modified requirement, and search the canonical specs and the tests again for the names of what the plan removes; count evidence attempts by failures, not by re-takes after a merge; in a roadmap run with siblings, ask the coordinating session for a merge pause before the first long evidence run, not after five stale cycles (the pause is what let this PR land); give suite-running agents a private `TMPDIR` under `/private/tmp` and the exact end condition (the `exit N` line, never a shell `&`).
3. Remember: a branch that rewrites a rule other changes also touch pays for every merge of main with a fresh evidence and review; renumber above the base, re-validate the spec delta first, and ask for a merge pause early. The dogfood held live: this branch's own `release-merge.mjs` refused to merge main when a non-release file conflicted (`proof/live-merge-main.txt`), and the loop handed a plain `git push` for the release merge.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | A canonical spec (`commit-attribution`) and the panel labels still name the removed `push-rebased` step; two tests from main pinned it; the release override has no test under a two-PR delivery config | doc-gap | followup | project |
| 2 | Evidence attempts count re-takes after a merge of main, so a real failure on the third take hit the ceiling | tooling | followup | project |
| 3 | After a merge of main, a modified requirement can lose main's new scenarios and a replaced rule can come back in new tests; nothing re-checks them before the evidence | process-friction | doc-update | project |
| 4 | On macOS `TMPDIR=/tmp/...` fails a path-equality test; suite-running agents polled for `# fail` and ran on | environment | memory-only | user |
| 5 | Asking the coordinating session for a merge pause after five stale cycles instead of before the first long evidence run | process-friction | memory-only | user |

## Proposed updates

### `openspec/roadmap.md` (tooling)
Add two follow-up lines: one for the leftovers of the removed `push-rebased` step, one for the evidence attempt count.
- before: (no line for them)
+ after: - [ ] release-merge-leftovers — `openspec/specs/commit-attribution/spec.md` drops the scenario that hands `push-rebased` and its mention in the devkit skill's rows, the panel's step vocabulary (`plugins/panel/hooks/steps.ts`, `plugins/panel/hooks/i18n.ts`) drops the label, and a conduct-check test runs the release-merge override under a two-PR delivery-model config (release-merge-conflict retro, items 1)
+ after: - [ ] evidence-attempts-by-failure — the stage checker counts a stage's attempts by failed takes, not by takes retaken after a merge of main made the evidence stale, so a merge-heavy delivery does not reach the ceiling of three without three real failures (release-merge-conflict retro, item 2)
- Answer: approved
- Applied: yes

### `docs/openspec-flow.md` (process-friction)
In the release-conflict paragraph, say what to re-check after every merge of the base.
- before: (the paragraph ends with the release-merge step and its staleness cost)
+ after: After every merge of the base, before the evidence, run `openspec validate <id> --strict`; copy any scenario main added to a requirement the change modifies into the delta verbatim; and search the canonical specs and the tests again for the names of the steps and rules the plan removes.
- Answer: approved
- Applied: yes

### user memory (memory-only)
On macOS give suite-running agents `TMPDIR=/private/tmp/<folder>` (`/tmp` resolves to `/private/tmp` and a path-equality test fails), and tell them to wait on the run's `exit N` line (node prints `ℹ fail`, not `# fail`), never a shell `&`.
- Answer: approved
- Applied: yes

### user memory (memory-only)
In a roadmap run with sibling changes in flight, ask the coordinating session for a merge pause on main before the first long evidence run, not after repeated stale cycles.
- Answer: approved
- Applied: yes
