Verdict: approved
Commit: 8719eaa079da564091503bc6ccf8d7b7fc523052

## Spec review — review-writer-prompt (round 2)

### Findings
- [nit] plugins/core/skills/review-change/scripts/review-round.workflow.js (validateStage1, heading) — A stage-1 heading beginning with Verdict: or Commit: is not stripped, so a written file could hold a second header line; the spec only covers sections, and check-file would catch it.
- [nit] plugins/openspec/hooks/deliver-check.test.mjs (AC-9 'unticked checkbox inside a backtick fence') — Scenario 'An unticked example in a fence' says the next step is not implement; the test asserts parseTasks and tasksItem only, not the next step. The behaviour follows, but the THEN is not asserted literally.

In-scope specs: the four spec deltas under openspec/changes/review-writer-prompt/specs/ (review-round, verdict-files, change-stages, change-delivery). All requirements are ADDED; no baseline capability spec was modified. Round 2 changed only the change-delivery delta.

### Coverage
| Requirement | Status |
|---|---|
| The outcomes command gives the writer prompts | covered (round 1, unchanged) |
| The stage-1 prompt names one sha per disposition | covered (unchanged) |
| The stage-1 prompt asks for HEAD and the files read | covered (unchanged) |
| A review round needs the head sha | covered (unchanged) |
| A stage-1 answer at another commit fails its review stage | covered (unchanged) |
| A partial stage-1 answer fails its review stage | covered (unchanged) |
| A verdict file carries one Verdict line and one Commit line | covered (unchanged) |
| The file check refuses a second Verdict or Commit line | covered (unchanged) |
| The review skill fills the head and sends the writer jobs | covered (unchanged) |
| A test file is named by a fixed pattern | covered (unchanged) |
| A commit of test files leaves the reviews it does not concern current | covered (unchanged) |
| The review stage is stale while a reviewer is stale | covered (unchanged) |
| The delivery checker does not count a checkbox inside a fenced block | covered, including the three new scenarios: 'An unclosed fence hides nothing' (fencedLines tests, including a later closed fence still hiding its own lines), 'A task and a gate after an unclosed fence are counted' (parseTasks, readPhases with open ['1.2'] and gate 1.3, tasksItem unticked ['1.2','1.3'], pendingTasks from flow-check), 'The next step after an unclosed fence' (nextStep is implement and names 1.2) |

No scope creep. The unclosed-fence behaviour derives from the new spec scenarios and design D-8 (the owner's rule of 2026-11-22). Task phase 4 and the AC-9 row of the tasks table map to it. The fencedLines rewrite changes no result for a text whose fences all close.

No ADR conflict, and the two specs do not disagree.

Tests run: the 13 AC-9 tests in deliver-check.test.mjs (`--test-name-pattern="^review-writer-prompt AC-9 "`), all passing. The full guard suite was not run, as instructed; evidence.md records it green.

Files read, each diff in the range 643bc47..HEAD one path at a time: specs/change-delivery/spec.md, plugins/openspec/hooks/deliver-check.mjs, plugins/openspec/hooks/deliver-check.test.mjs, design.md, tasks.md. I also read the previous reviews/spec-reviewer.md and the stage prompt, and checked requirements.md AC-9. The other changed files in the range are process artifacts (approval.md, evidence.md, readiness.md, review.md, reviews/*) and are not spec, test or code. No file of my remit is left unread.
