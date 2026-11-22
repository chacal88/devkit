Verdict: approved
Commit: 83d74b4338fb0bce46595382c50068b816619472

## Spec review — review-writer-prompt (round 4, after the second rebase)

### Findings
- [nit] plugins/core/skills/review-change/scripts/review-round.workflow.js (validateStage1, heading) — A stage-1 heading beginning with Verdict: or Commit: is not stripped, so a written file could hold a second header line; the spec only covers sections, and check-file would catch it.
- [nit] plugins/openspec/hooks/deliver-check.test.mjs (AC-9 'unticked checkbox inside a backtick fence') — Scenario 'An unticked example in a fence' says the next step is not implement; the test asserts parseTasks and tasksItem only, not the next step. The behaviour follows, but the THEN is not asserted literally.
- [nit] openspec/changes/review-writer-prompt/proposal.md, design.md (D-10) — Plan documents named devkit-openspec 0.19.0, v0.19.0 and marketplace 0.23.0; they now say 0.21.0, v0.21.0 and 0.25.0, agreeing with tasks.md and the shipped files. · fixed in 83d74b4338fb0bce46595382c50068b816619472
- [nit] plugins/openspec/hooks/deliver-check.mjs (unclosed-fence fix) — Round-2 finding on the unclosed fence hiding later tasks: fixed and covered. · fixed in 7719a34f391edf3f5cce36a46b328d636c3474a3

In-scope specs: the four spec deltas under openspec/changes/review-writer-prompt/specs/ (review-round, verdict-files, change-stages, change-delivery). All requirements are ADDED; no baseline capability spec was modified.

### Coverage
| Requirement | Status |
|---|---|
| The outcomes command gives the writer prompts | covered |
| The stage-1 prompt names one sha per disposition | covered |
| The stage-1 prompt asks for HEAD and the files read | covered |
| A review round needs the head sha | covered |
| A stage-1 answer at another commit fails its review stage | covered |
| A partial stage-1 answer fails its review stage | covered |
| A verdict file carries one Verdict line and one Commit line | covered |
| The file check refuses a second Verdict or Commit line | covered |
| The review skill fills the head and sends the writer jobs | covered |
| A test file is named by a fixed pattern | covered |
| A commit of test files leaves the reviews it does not concern current | covered |
| The review stage is stale while a reviewer is stale | covered |
| The delivery checker does not count a checkbox inside a fenced block | covered, including the unclosed-fence scenarios |

Second-rebase resolutions reviewed in full: flow-check.mjs keeps main's STAGE_HEADER/parseStageHeader import beside this change's fencedLines/readReviews imports and the stale-reviewers reason (the undeclared-stage hunks are main's project-phases work); reviewerPrompt keeps this change's wording (head sha, read/notRead, no Verdict:/Commit: line in sections) with main's finding-id and commit sentence from PR 57 appended, which does not conflict; change-loop.test.mjs pins v0.21.0, allows main's 'v0.20.0 or later' slice-merge sentence through a filter and pins that sentence separately; docs/openspec-flow.md, CHANGELOG.md (0.25.0 above main's 0.24.1 and 0.24.0), marketplace.json and both plugin.json files agree on devkit-core 0.9.0, devkit-openspec 0.21.0, marketplace 0.25.0, pin v0.21.0. proposal.md, design.md and tasks.md now agree too, which closes the earlier plan-numbers nit. Other hunks in the listed paths are main's merged work (PRs 55 and 57) and belong to other changes.

No scope creep. No ADR conflict, and the specs do not disagree. Tests were not run (the guard suite is excluded by the round's instructions; evidence.md records it green).

Files read, each diff one path at a time: plugins/openspec/hooks/flow-check.mjs, plugins/core/skills/review-change/scripts/review-round.workflow.js, plugins/openspec/hooks/change-loop.test.mjs, docs/openspec-flow.md, CHANGELOG.md, .claude-plugin/marketplace.json, plugins/core/.claude-plugin/plugin.json (empty diff; version checked directly), plugins/openspec/.claude-plugin/plugin.json, openspec/changes/review-writer-prompt/proposal.md, design.md and tasks.md; also the previous reviews/spec-reviewer.md, the spec delta listing and the range-diff. Long lines of the docs, changelog and JSON diffs were cut at 400 characters in my view. No file of my remit is left unread.

### Summary
- 4 findings, all nits (0 scope creep, 0 gaps); 2 open, 2 fixed.
