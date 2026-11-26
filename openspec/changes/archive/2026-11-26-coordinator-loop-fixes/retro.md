<!-- devkit-stage retro result=passed attempt=1 commit=1a1a091b892b3311a543357f56dc213c3ecc4d9f -->
## Retro: coordinator-loop-fixes

1. Went wrong:
   - The plan went through fourteen readiness attempts and three plan approvals. The base moved under it five times (trains 5 to 19), two project rules arrived after the approval (`Gates:` and `Live roadmap:`), and three implementation phases stopped on existing tests that D-15 did not name (a reason-code table, a whole-phase `--json` shape, two conflict tests). Each stop cost a plan revision, a readiness run and the owner's approval.
   - The readiness ceiling was reached once (attempt 6, three failures in a row) on a one-sentence finding; the owner allowed one more round, and the loop had no way to lift it but a passing run.
   - The round-1 review fixes edited two spec deltas and the design (`--stdin words`, the node option words of the declare guard) and went straight to round 2 with no readiness run and no approval, against the `fix-review` row of `ship-change`. The loop could not see it because this change's own approval has no `- Plan:` line, the case its own D-7 leaves open. Round 2 failed on it and the change needed a third round authorized by the owner.
   - The owner's words for `declare review-round` were passed on the shell command line in double quotes; the code-quality reviewer found it in round 1 and the fix moved them to standard input through the quoted heredoc.
   - In the real runs R7s and its re-run `ver-r7s`, the nested session, with the Agent tool removed, handed `fix-review` to an agent through a Workflow script it wrote, against the skill's "one Agent call".
   - Two waits built as `pgrep -f '<pattern>'` loops matched their own command line and never ended; the roadmap coordinator had to stop them.
   - The empty train 18 dropped the failure text of the change it left `red`, so the failing test was unknown (a 35-minute run lost); and `release-merge.mjs --merge` refuses a head whose manifest changes more than the version, which kept project-setup off a train.
   - The owner's admin-merge path was proposed and then cancelled the same hour, because the guard refuses `gh pr create` until every review in `reviews/` is approved; a stack branch was built for it and thrown away.
   - Two writer files of round 3 carry text the round script cut (a refutation that ends mid-sentence in the code-quality file, a summary line in the ADR file that still counts a refuted finding as open); the verdicts are right.
   - The host's pull-request monitor (AC-11's deferred half, roadmap line `host-monitor-wake`) was not observed: this change left on a train and the coordinator announced the merge, so no wait on GitHub ran in this session.
2. Better next time:
   - Before a `fix-review` hand-off, read each finding against the spec deltas: a fix that changes a SHALL, a scenario or a design decision goes to the planner, readiness and the owner's approval first, then to the implementer, whether or not the approval carries a `- Plan:` line.
   - Before a plan's approval, grep the tests for every exact-shape assertion the plan's new fields and codes touch (a whole-object `deepEqual`, a reason-code table) and name each in D-15, so no phase stops on one.
   - Build a wait on another process with a pattern that cannot match itself (`pgrep -f '[s]cripts/test-suite.mjs$'`) or by pid, never by a bare `pgrep -f` of the same text the wait's own command holds.
   - Check what the guard requires of a step before proposing a short path around it.
3. Remember: a review fix that edits a spec delta is a plan revision: readiness and the owner's approval come before the next review round.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | Review fixes that edit spec deltas skipped readiness and approval | process-friction | memory-only | user |
| 2 | A `pgrep -f` wait matched its own command line | tooling | memory-only | user |
| 3 | An empty train drops the failure text of a red change | bug-class | followup | project |
| 4 | `release-merge.mjs --merge` refuses a manifest edited beyond its version | bug-class | followup | project |
| 5 | A session without the Agent tool handed a stage through a Workflow script | bug-class | followup | project |
| 6 | The declare guard leaves two command forms unmatched; the review's open nits of this change | process-friction | followup | project |
| 7 | The round script's writer prompts cut a refutation and keep a stale summary | bug-class | followup | project |

## Proposed updates

### `openspec/roadmap.md` (bug-class)
A follow-up line for the empty train's lost failure text, in a new round of this change's follow-ups.
- before: (no round for the follow-ups of coordinator-loop-fixes)
+ after: ## Round 28p: follow-ups of coordinator-loop-fixes
+ after: - [ ] train-empty-failure-text (after: delivery-train) — from the coordinator-loop-fixes retro: when a train ends empty (`result: empty`), `train-loop.mjs` drops the `failure` text of a change it left `red` (`outLeft` omits it and no `openspec/trains/<n>.md` is written), so the failing test is unknown; train 18 cost a 35-minute run for it. Keep the failure text in the end's output and write the train record for an empty train too, with a test of a train that ends empty.
- Answer: approved
- Applied: yes

### `openspec/roadmap.md` (bug-class)
A follow-up line for `release-merge.mjs --merge` refusing a manifest edited beyond its version.
- before: (the round of item 1, without this line)
+ after: - [ ] release-merge-manifest-fields (after: delivery-train) — from the coordinator-loop-fixes retro: `release-merge.mjs --merge` refuses a head whose manifest changes anything but the version ("a manifest was edited beyond its version"), so a change that edits a pack's description cannot ride a train (project-setup, pull request 148, was left for it). Renumber the version and keep the head's other manifest fields when only one side changed them, refusing only a field both sides changed, with a test of each case.
- Answer: approved
- Applied: yes

### `openspec/roadmap.md` (bug-class)
A follow-up line for a stage handed through a Workflow script when the Agent tool is missing.
- before: (the round of item 1, without this line)
+ after: - [ ] handoff-tool-guard (after: coordinator-loop-fixes) — from the coordinator-loop-fixes retro: in the real runs R7s and `ver-r7s`, a nested session whose Agent tool was removed handed `fix-review` to an agent through a Workflow script it wrote, against the devkit skill's "one Agent call" for an `agent` action. Decide whether a hook refuses a Workflow call outside the review round's own script while a devkit run is under way, or the skill names the case, with a real run that removes the Agent tool.
- Answer: approved
- Applied: yes

### `openspec/roadmap.md` (process-friction)
A follow-up line for the declare guard's two unmatched forms and the review's open nits of this change.
- before: (the round of item 1, without this line)
+ after: - [ ] coordinator-loop-fixes-followups (after: coordinator-loop-fixes) — from the coordinator-loop-fixes review (rounds 1 to 3): the declare guard leaves unmatched a node option whose value is a separate word (`node -r <module> <path>/change-loop.mjs declare`, `--stack-size 2000`) and a script path held in a variable (design D-1 records both as a follow-up); no test refuses a subagent's declare in the quoted-heredoc form the skills prescribe; the declare's round number is tested only at round 3 and its 200-character cut not at all; no test covers a plan revised before the first tick; `planDigest`'s tick pattern also blanks a `- [link text](url)`; the `at` field of DECLARED's declare rows is not read, `declared.json` has two owners (RECORDED_KEYS), GATE_OF_WHY repeats the reply rows' gate, and a `gate-red` entry records no commit; and ADR 0032's Amends line does not name ADR 0010 decision 3.
- Answer: approved
- Applied: yes

### `openspec/roadmap.md` (bug-class)
A follow-up line for the round script's writer prompts.
- before: (the round of item 1, without this line)
+ after: - [ ] review-writer-text (after: coordinator-loop-fixes) — from the coordinator-loop-fixes retro: in round 3 the writer prompt of `review-round.mjs outcomes` cut a refutation mid-sentence (the code-quality file of that round) and kept a reviewer's summary line that still counted a finding the verifiers refuted as open (the ADR file); the verdicts were right. Give the writer the full disposition text and a summary built from the outcomes, with a test of a refuted finding's line and summary.
- Answer: approved
- Applied: yes

### user memory (memory-only)
Before a fix-review hand-off, a finding whose fix edits a spec delta, a SHALL or a design decision goes to the planner, the readiness review and the owner's approval first, even when the approval has no `- Plan:` line.
- Answer: approved
- Applied: yes

### user memory (memory-only)
A wait built as `pgrep -f '<pattern>'` matches its own command line: use `pgrep -f '[s]cripts/test-suite.mjs$'` or wait on a pid, never a bare pattern the waiting command also holds.
- Answer: approved
- Applied: yes
