## Retro: flow-script-checker

1. Went wrong:
   - The `check` job failed on the first run of the pull request (11 of 741 tests) after 741 of 741 locally. The new flow-check fixtures blanked only `DEVKIT_BRANCH`, and GitHub sets `GITHUB_HEAD_REF` on a pull_request run. The fix was ten lines of test code, but it cost a fix commit, a new evidence and a re-review by all five reviewers.
   - Review round 1 rejected the change on six verified findings. Three were behaviour the design decided in tables (plan staleness, the delivery rows, the OpenSpec version rule) that the spec delta never stated; the readiness review approved the plan with that gap. Two were missing tests (header validation through the walk, a stage of several files). One was a copied branch helper where an export was the cut.
   - The first stage-1 answer of the code-quality reviewer read one file of a 54-file diff and still said "approved"; two reviewers returned a commit padded from the short sha instead of running `git rev-parse HEAD`.
   - An implementer left a `sed` backup file beside the test file; only `git status` before the commit caught it.
   - The gate names `claude plugin validate .`, which the verifier could not run in its shell; the session ran it through the app's bundled binary and the evidence records it as the caller's.
2. Better next time:
   - Run the new hook tests once with the pull-request variables set before the first push, and make the fixture rule a test.
   - At readiness, match every outcome row of a design decision table to a spec scenario.
   - Ask a reviewer for the list of files it read and the sha `git rev-parse HEAD` printed, and send a partial review back before the verify stage.
3. Remember: a green local suite is not the CI result while a fixture reads the machine's branch variables.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | A hook test fixture that blanks only `DEVKIT_BRANCH` passes locally and fails on a pull_request run | bug-class | regression-gate | project |
| 2 | A design decision table with no spec scenario per row passes readiness and fails review | process-friction | rule | project |
| 3 | An implementer can leave an editor or `sed` backup file in the tree | process-friction | rule | project |
| 4 | A stage-1 review can cover part of the diff and pad the sha | process-friction | followup | project |
| 5 | A test-only commit makes every review stale, so five reviewers ran again for ten lines | process-friction | followup | project |
| 6 | Fifteen questions the design document did not answer were decided while planning, and `deliver-check` still counts a checkbox inside a fenced example as a task | doc-gap | followup | project |
| 7 | A session is not woken by green checks or by a merge | environment | followup | project |
| 8 | Found at the archive step: `openspec archive` wrote the first canonical spec of this repository and the archive check refused it as a file no proposal names, so a change with a spec delta cannot be archived | bug-class | regression-gate | project |

## Proposed updates

### `plugins/openspec/hooks/guard.test.mjs`, `CONTRIBUTING.md` (regression-gate)
A test reads every `*.test.mjs` under `plugins/` and fails when a line builds an env that blanks `DEVKIT_BRANCH` without also blanking `GITHUB_HEAD_REF` (directly or by spreading a set that holds both); CONTRIBUTING states the rule.
- before: `(CONTRIBUTING.md has no rule about the environment a test fixture builds)`
+ after: `A test fixture never depends on the branch variables of the machine that runs it: every env it builds blanks DEVKIT_BYPASS, DEVKIT_BRANCH, DEVKIT_CHANGE, GITHUB_HEAD_REF, GITHUB_BASE_REF and GITHUB_EVENT_PATH, through one shared constant of the test file. A test in guard.test.mjs refuses an env that blanks DEVKIT_BRANCH alone.`
- Answer: approved
- Applied: yes

### `plugins/core/skills/plan-readiness-review/SKILL.md` (process-friction)
Step 6 of the readiness review ("Review the specs") gains one check, so a design that decides outcomes in a table cannot pass with a spec that states only some of them.
- before: `specs align with proposal and design; no requirement lives only in support docs.`
+ after: `specs align with proposal and design; every outcome row of a decision table in design.md (a state, an exit code, a refusal, a next step) has a scenario in the spec delta, and a row without one is a Mandatory finding; no requirement lives only in support docs.`
- Answer: approved
- Applied: yes

### `plugins/core/agents/tdd-implementer.md` (process-friction)
One more line in the implementer's Never list.
- before: `- Edit files outside the change's scope, or edit the plan's review/approval records.`
+ after: `- Edit files outside the change's scope, or edit the plan's review/approval records. Leave no backup or scratch file in the tree (an in-place edit with a suffix writes one): end with git status --short and remove what you created by accident.`
- Answer: approved
- Applied: yes

### `openspec/roadmap.md` (doc-gap)
Carries what this change found into the two rounds that will build it, so the grill of each starts from it.
- before: `- [ ] change-coordinator (after: flow-script-checker) — the change coordinator runs one change as a loop over the checker, with /devkit change, the two stop locks, the skills wired into the agents and the two language settings; retires /conduct (D-1, D-2, D-3, D-8, D-9)`
+ after: `the same line, followed by: Carried from the flow-script-checker retro for its grill: the questions the design did not answer (requirements.md of that change lists them), a commit that touches only tests should make stale only the reviewers it concerns, the wait on GitHub without the owner's message, and deliver-check still counting a checkbox inside a fenced example.`
- before: `- [ ] review-writer-prompt — review-round.mjs outcomes returns each outcome's stage-3 writer prompt, as review-change's agents path says, and the stage 1 prompt says a disposition names one sha (orchestrator-replan retro, items 1 and 2)`
+ after: `the same line, followed by: and the stage 1 prompt asks for the sha git rev-parse HEAD printed and for the list of files read, so a partial review is seen before the verify stage (flow-script-checker retro, item 4)`
- Answer: approved
- Applied: yes

### `plugins/openspec/hooks/deliver-check.mjs`, `plugins/openspec/hooks/deliver-check.test.mjs`, `docs/openspec-flow.md` (regression-gate)
Added at the archive step of this change (learning 8). The archive check accepts the canonical spec of each capability the archived change's own delta names, test first; a hand edit to any other canonical spec is still refused. The same test file holds the one fixture line the first proposal corrects, and `docs/openspec-flow.md` states the new exemption in row P13 and carries the CI pin of this release.
- before: `the archive record is openspec/changes/** and openspec/roadmap.md; openspec/specs/<capability>/spec.md, which openspec archive writes, is refused as a file no approved proposal names`
+ after: `the archive record also holds openspec/specs/<capability>/spec.md for every capability with a spec delta in the archived change folder; a test archives a change with a spec delta and the check names no file, and a second test still refuses a canonical spec the change does not name`
- Answer: approved
- Applied: yes
