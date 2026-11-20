<!-- devkit-stage retro result=pending attempt=1 commit=9c83a7238f55cc8565b776819edf84988a343b7d -->
## Retro: change-coordinator

1. Went wrong:
   - The gate of phase 5 (the panel pack's tests) was red on one test this change never touched: the test was already red on `main` under the app's Claude Code 2.1.326, and nobody knew, because the pack's tests run only by hand. The plan was approved without that gate ever being run on the base. The conducting session then promised the owner a second plan approval before diagnosing; the diagnosis found a one-line fix in the test's own stand-in.
   - The first live run of `/devkit change` found two defects in the skill's text that 149 green tests had not: the opening reply never reached the owner (a reply followed by more tool calls is lost), and the session's own sentences showed a progress key, an agent id and a reason code.
   - Review round 1 rejected the change on six verified findings. Three came from the spec-reviewer only after its first answer, which had matched scenario titles to test titles without reading the spec deltas or the code, was sent back. The stop lock refused once after an end the session itself had declared, against AC-6; the hand-off lock let a call with no agent type and another plugin's same-named agent through, against AC-8; a usage error showed the script's own usage text.
   - The verdict files of round 1 carry two `Verdict:` lines: the writer copies the stage-1 text, which holds its own.
   - In the live test the planner wrote a phase gate that expects a red run, so the scratch change could never pass it; and the session chose the short script for a project with no spec, then stopped before the implementation because the person's own rule asks for a plan approval the short script does not have.
   - This session could not wait on GitHub by itself (the old flow), so the owner had to write when the pull request was merged.
2. Better next time:
   - Run every phase gate of the plan on the base before asking for the plan approval, the ones that run only by hand included.
   - Diagnose a gate that is red on the base before telling the owner what it costs.
   - Run the live test of a command as soon as the command exists, before the documents and the review.
   - Send back any reviewer whose answer lists files of its remit as not read.
3. Remember: a gate nobody runs in CI is red until someone proves it green on the base.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | A phase gate that runs only by hand was red on the base and stopped the change at phase 5 | process-friction | rule | project |
| 2 | A live run of a command finds what text tests of its skill cannot | bug-class | followup | project |
| 3 | A stage-1 review can match titles only; the verdict file repeats the stage-1 `Verdict:` line | process-friction | followup | project |
| 4 | The loop has no declared end for a pause the owner asks for, or for a decision outside the script's gates; the end marker's id is not compared with the run's change | bug-class | followup | project |
| 5 | The person's language reached the script unsubstituted when the person never set it; the unlimited wait on GitHub is still unproved in real use | tooling | followup | project |
| 6 | A planner can write a phase gate that expects a red run | process-friction | rule | project |
| 7 | The short script has no plan approval, and the owner's own rule asks for one before any code | doc-gap | followup | project |
| 8 | The conducting session promised a second approval before knowing the size of the fix | process-friction | memory-only | user |
| 9 | The owner asked, during this round, to record that a change can run on another machine | doc-gap | doc-update | project |

## Proposed updates
### `plugins/core/skills/plan-readiness-review/SKILL.md` (process-friction)
Step 7 of the readiness review ("Review the tasks") gains one check, so a gate that is already red on the base is found before the plan is approved, not at its phase.
- before: `every task path falls under a real directory of the repo.`
+ after: `every task path falls under a real directory of the repo; every phase gate command that already exists on the base is run there once (a command the tasks mark as long is run by the caller and its result handed over), and a gate that is red on the base is a Mandatory finding.`
- Answer: approved
- Applied: yes

### `plugins/core/agents/change-planner.md` (process-friction)
The planner's rule for `tasks.md` says what a gate is, so no phase can be closed only by a failing run.
- before: `If the work splits into phases with gates, mark each phase and its exit gate.`
+ after: `If the work splits into phases with gates, mark each phase and its exit gate. A gate's command exits 0 when its phase is done: a step that expects a failing run (the red half of test-first) is a task with its own check, never a gate.`
- Answer: approved
- Applied: yes

### `openspec/roadmap.md` (doc-gap)
Carries what this change found into the rounds that will build it.
- before: `- [ ] stage-roles (after: change-coordinator) — the ADR author, the unit-test suite, the E2E tester, the screen designer and the demonstration recorded as text in the change (D-4 stages 3, 4, 9, 10, 11)`
+ after: `the same line, followed by: Carried from the change-coordinator retro for its grill, as the first real use of /devkit change: a declared end for a pause the owner asks for and for a decision outside the script's gates; the end marker's id compared with the run's change; the skill's resolve-release-conflict item naming the declared end; the loop's fallback agent map tied to the pack table; a dated Note on ADR 0011 for the stop lock after a recorded end; the person's language checked with the installed plugin when it was never set; the unlimited wait on GitHub proved in real use; whether a change that creates the project's first spec may run on the short script; and whether the short script gains the owner's plan approval.`
- before: `as flow-check already does)` (the end of the review-writer-prompt line of round 25)
+ after: `as flow-check already does); and two findings of the change-coordinator retro: the writer leaves out the stage-1 text's own Verdict and Commit lines, and a stage-1 answer that lists files of its remit as not read is sent back before the verify stage`
- Answer: approved
- Applied: yes

### `openspec/roadmap.md`, `docs/coordination-design.md` (doc-gap)
Requested by the owner on 2026-11-20: record that a change can run on another machine. A new last round in the roadmap and a short proposed section near the end of the design page; no code and no behaviour.
- before: `(the roadmap ends at round 27, and the design page has no section on where a change runs)`
+ after: `roadmap, a new round after the last: "- [ ] remote-worker (after: roadmap-coordinator) — a change can run on another machine: the project configures a command that starts a change there and one that asks its state, and the roadmap coordinator chooses where each change runs". Design page, a new section marked proposed, requested by the owner on 2026-11-20: the loop keeps no memory, so where the session runs does not matter; state is read by asking flow-check --json over the connection, never by reading the other machine's screen; the owner's gates are never typed by another session on the owner's behalf (either the owner answers in the remote session, or planning and approval happen locally and only the part after the approval runs remotely, which needs the approved plan pushed to the branch first, something the flow does not do today); the worker needs the same devkit plugin version and OpenSpec CLI and a restricted GitHub credential; it also answers the open point of how the roadmap coordinator holds a start while the machine is loaded.`
- Answer: approved
- Applied: yes

### user memory (memory-only)
Run every phase gate of a plan on the base before asking the owner to approve it, the gates that run only by hand included (the panel pack's `plugin test`).
- Answer: approved
- Applied: yes

### user memory (memory-only)
When a gate is red on the base, diagnose it before telling the owner what the fix costs: do not promise a new plan approval for a fix whose size is unknown.
- Answer: approved
- Applied: yes
