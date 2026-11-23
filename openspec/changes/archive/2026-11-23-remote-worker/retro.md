<!-- devkit-stage retro result=passed attempt=1 commit=51e2dbd3bc7d37d1647738cc193ace36d4a3e8dc -->
## Retro: remote-worker

1. Went wrong: the change delivered what the grill recorded (a claim on GitHub when a change opens, the `machines` setting, placement, a place taken only from the implementation on, a remote session start, ADR 0020), and all of it is proven by tests only: by the owner's decision of 2026-11-23 (`B: depois do merge`) the live record on two machines (the claim race on GitHub, the SSH session start, the wake, a silent machine) was not run before the merge. The delivery then cost far more than the work. `main` took the release numbers three times while the change was in delivery (0.29.0, then 0.31.0 with ADR 0019), so the release moved from 0.22.0/0.26.0 to 0.32.0/0.36.0 and this change's ADR from 0016 to 0019 to 0020, and every move meant a merge of `main`, a plan revision, a readiness review and the owner's approval again (five approvals of `Aprovo` in all). Each merge also brought tests of `main` that the claim commit breaks: eight in the first run (not in the plan's test table), one `delivery-models` test, and three `version-pin` tests that were avoided by writing the claim keys before the version pin. Then the evidence stage hit its ceiling of 3: attempts 1 and 2 had passed, each rewritten because the code changed, and the third failed on the two defects above, so the loop declared `blocked: ceiling` although the defects were found and fixed, and only the owner's authorization ran a fourth attempt. Smaller: the plan named release numbers and an ADR number as literals although `openspec/config.yaml` (line 51) says a task never names one; the plan's check lines carried test counts nobody had run (49 for 41 tests) and anchors on commits that main had since moved; a CHANGELOG line still said "proposed" for an ADR the same diff accepted; the session cannot edit `docs/adr` (the guard treats it as product code), so the ADR's acceptance line had to go through the implementer; the sessions of this machine share `/var/tmp`, and the "leaves no temporary folder" tests compare the whole folder, so the coordinating session asked for a folder of each session's own.
2. Better next time: a plan revision after a merge of `main` re-reads the project's rules first (a rule added since the approval applies to the revised plan), so release numbers and ADR numbers are written by rule and the next merge costs no revision. After the release merge, run the tests that `main` added since the plan's base by name before the evidence run, so a broken one becomes one plan revision and not a failed evidence attempt. A passed evidence attempt must not count toward the ceiling of a later failure: the ceiling is for consecutive failures. Run the live check on two machines right after the merge, as the follow-up line below says.
3. Remember: the evidence ceiling counts rewrites of the stage, not consecutive failures, so a fix after two green re-runs ends in `blocked: ceiling`.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | The live part of AC-1, AC-3, AC-5, AC-6 and AC-8 to AC-12 was not run before the merge | process-friction | followup | project |
| 2 | A `/devkit project` slice is not claimed on `origin` when it opens (left out of this change) | doc-gap | followup | project |
| 3 | The evidence ceiling counts rewrites, not consecutive failures | tooling | regression-gate | project |
| 4 | A plan revision after a merge of `main` kept literal release and ADR numbers that a rule since forbids | doc-gap | doc-update | project |
| 5 | Tests added by `main` after the plan's approval break a change at the release merge, found only by the evidence run | process-friction | doc-update | project |
| 6 | Sessions of one machine share `/var/tmp`; the no-leftover tests need a folder of each session's own | environment | memory-only | user |

## Proposed updates

### `openspec/roadmap.md` (followup)
Add the live check of this change as its own roadmap line, in a new round after round 28, as round 18c does for `roadmap-live-checks`.
- before: ## Round 28: remote worker
+ after: ## Round 28b: live checks of a change on another machine
+ after: - [ ] remote-worker-live-checks (after: remote-worker) — the first time the owner uses two machines after the merge of `remote-worker`, the Mac and the Linux worker `avel`, both on the merged devkit-openspec (`claude plugin update devkit-openspec@devkit`, the same version on both) and with the `machines` setting of the Mac listing `avel` with its folder and 1 place, record in `openspec/changes/remote-worker-live-checks/proof/live.txt`, in order and with their times: L-1 on `avel`, `/devkit change` opens a scratch change `probe-claim`; the Mac refuses `open probe-claim` naming the machine (AC-1), `/devkit status` lists it under way with the machine and never in the queue (AC-5), and a `/devkit roadmap` run whose roadmap names it does not open it (AC-6); then the race against GitHub, `change-loop.mjs open probe-race --script devkit-lite --why small --lang en` started on the Mac and on `avel` within the same second: exactly one exits 0, the other exits 3 with `claimed` naming the winner and leaves no worktree, folder or branch (AC-3); the scratch branches and worktrees are deleted only with the owner's explicit authorization; L-2 with the Mac above its `load_limit`, a typed `/devkit roadmap` opens a ready line for `avel` (AC-8), `ssh avel true` exits 0, `checkout` makes the worktree there and a session starts on the connection `avel`, nested under the Mac's session and titled `❓ <id>` (AC-9); L-3 with `avel`'s one place held by a change in its implementation, a second change on `avel` reaches its approval and ends ⏳, and when the first is archived the Mac's session sends the wake and the second takes the place (AC-10, AC-11), recording whether the wake was sent on a turn nobody typed; L-4 with `avel` asleep or its Tailscale down, `/devkit status` on the Mac reads "no answer" for `avel` and each of its changes, and a typed `/devkit roadmap` opens the next ready line on the Mac (AC-12); no connection detail beyond the connection name `avel` is written; a defect found is fixed with its red test (remote-worker retro, the owner's decision of 2026-11-23)
- Answer: approved
- Applied: yes

### `openspec/roadmap.md` (followup)
Add the claim of a `/devkit project` slice, which `design.md` left out of this change, as a roadmap line of its own.
- before: ## Round 28b: live checks of a change on another machine
+ after: ## Round 28c: the claim of a project slice
+ after: - [ ] project-slice-claim (after: remote-worker) — a `/devkit project` slice is a change on `devkit-project`; today `open` claims a change on `origin` when it opens, but a slice opened through `project-loop.mjs` shares `openCheckout` and takes no claim, so two machines can still open the same slice. Make the slice open take the same create-only claim (branch pushed at once with the machine name in `.openspec.yaml`), refuse a slice already claimed, and show it in `/devkit status` and the roadmap with its machine; the claim keys are written before the version pin, as `remote-worker` does (remote-worker retro, `design.md` Non-Goals)
- Answer: approved
- Applied: yes

### `openspec/roadmap.md`, `plugins/openspec/hooks/flow-check.test.mjs` (regression-gate)
The stage ceiling blocks a change after a failure that follows passed attempts; the ceiling is meant for consecutive failures. Add a roadmap line, and the test the fix must turn green.
- before: ## Round 28c: the claim of a project slice
+ after: ## Round 28d: the evidence ceiling counts consecutive failures
+ after: - [ ] stage-ceiling-consecutive (after: remote-worker) — `flow-check.mjs` blocks a stage with `ceiling-reached` when its header says `result=failed` and `attempt >= ceiling`, but `attempt` is one more on each rewrite, so a stage that passed at attempts 1 and 2 (rewritten after code changed) and failed at attempt 3 is blocked at the first failure after two green runs (remote-worker, the evidence stage, 2026-11-23: two defects found and fixed, the loop declared `blocked: ceiling`, and only the owner's authorization ran a fourth attempt). Count the failures since the last passed attempt, keep `attempt` as it is, and pin it in `flow-check.test.mjs`
- before: (no test for a failed attempt that follows passed ones)
+ after: test('flow-check ceiling: a failed attempt after passed ones is not the third failure of the stage', ...) — a stage header `result=failed attempt=3` whose attempts 1 and 2 passed is offered again, not `ceiling-reached`; three failures in a row still end `blocked`
- Answer: approved
- Applied: yes
The roadmap line is applied; the test it describes is added by the change that fixes the ceiling, because a test that is red today would fail the suite.

### `plugins/core/skills/plan-readiness-review/SKILL.md` (doc-gap)
A plan revision after a merge of `main` re-reads the project's rules, so a rule added since the approval is applied to the revised plan.
- before: Core rules do not say what a revision after a merge of `main` re-reads.
+ after: A revision that follows a merge of `main` re-reads the project's rules (`openspec/config.yaml`) before it is reviewed: a rule added since the approval applies to the revised plan, for example a task naming "the next free number" and not a literal ADR number or version, and a check line carries only a count or an anchor that someone ran at the commit it names.
- Answer: approved
- Applied: yes

### `CONTRIBUTING.md` (process-friction)
At the release merge, run the tests that `main` added since the plan's base before the evidence run.
- before: When a change merges a base that merged a sibling while the change was in review (`resolve-release-conflict`, `update-branch`, or by hand), re-read what the change consumes from that sibling before pushing the merged head.
+ after: When a change merges a base that merged a sibling while the change was in review (`resolve-release-conflict`, `update-branch`, or by hand), re-read what the change consumes from that sibling before pushing the merged head, and run by name the tests that base added since the plan's base (`git diff <plan base>..origin/<base> --stat -- '*.test.mjs'`) before the evidence run: a failing one is a row for the plan's test table and one plan revision, not a failed evidence attempt.
- Answer: approved
- Applied: yes

### user memory (memory-only)
The sessions of one worker share `/var/tmp`, and the no-leftover tests compare the whole `TMPDIR`: give each change's suite a folder of its own (`mkdir -p /var/tmp/devkit-<change-id> && TMPDIR=/var/tmp/devkit-<change-id> <command>`).
- Answer: approved
- Applied: yes
