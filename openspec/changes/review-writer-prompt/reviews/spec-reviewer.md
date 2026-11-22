Verdict: approved
Commit: be4e2edb7c463dc5e59818e66f5906b9cdce4c4b

## Spec review — review-writer-prompt (round 3, after the rebase)

### Findings
- [nit] plugins/core/skills/review-change/scripts/review-round.workflow.js (validateStage1, heading) — A stage-1 heading beginning with Verdict: or Commit: is not stripped, so a written file could hold a second header line; the spec only covers sections, and check-file would catch it.
- [nit] plugins/openspec/hooks/deliver-check.test.mjs (AC-9 'unticked checkbox inside a backtick fence') — Scenario 'An unticked example in a fence' says the next step is not implement; the test asserts parseTasks and tasksItem only, not the next step. The behaviour follows, but the THEN is not asserted literally.
- [nit] openspec/changes/review-writer-prompt/proposal.md:89-96 and design.md:402-418 (D-10) — The plan documents still name devkit-openspec 0.19.0, the tag v0.19.0 and marketplace 0.23.0; tasks.md and the shipped files now say 0.20.0, v0.20.0 and 0.24.0 after the rebase.
- [nit] plugins/openspec/hooks/deliver-check.mjs (unclosed-fence fix, commit 4d10f6fa80f429203699490b829463e0eff47b22) — Round-2 finding on the unclosed fence hiding later tasks: fixed and covered, re-listed with its new sha. · fixed in 4d10f6fa80f429203699490b829463e0eff47b22

In-scope specs: the four spec deltas under openspec/changes/review-writer-prompt/specs/ (review-round, verdict-files, change-stages, change-delivery). All requirements are ADDED; no baseline capability spec was modified.

### Coverage
| Requirement | Status |
|---|---|
| The outcomes command gives the writer prompts | covered (unchanged) |
| The stage-1 prompt names one sha per disposition | covered (unchanged) |
| The stage-1 prompt asks for HEAD and the files read | covered (unchanged) |
| A review round needs the head sha | covered (unchanged) |
| A stage-1 answer at another commit fails its review stage | covered (unchanged) |
| A partial stage-1 answer fails its review stage | covered (unchanged) |
| A verdict file carries one Verdict line and one Commit line | covered (unchanged) |
| The file check refuses a second Verdict or Commit line | covered (unchanged) |
| The review skill fills the head and sends the writer jobs | covered (unchanged) |
| A test file is named by a fixed pattern | covered (unchanged) |
| A commit of test files leaves the reviews it does not concern current | covered; the rebase's merge of main's first-parent rule with the test-file sparing is pinned by the new AC-8 merge test (a merge bringing only a test file is stale by default, current with the sparing `allowed`) |
| The review stage is stale while a reviewer is stale | covered (unchanged) |
| The delivery checker does not count a checkbox inside a fenced block | covered, including the unclosed-fence scenarios (unchanged) |

Rebase resolution reviewed in full: staleness() in deliver-check.mjs uses touchedPaths (first-parent diff for a merge, -m --root diff otherwise), still walks every commit in the range, and passes the `allowed` option through, so the test-file sparing applies to both kinds of commit. The release numbers agree across plugin.json, marketplace.json, CHANGELOG.md (0.24.0 above main's 0.23.1 and 0.23.0), docs/openspec-flow.md (pin v0.20.0), the change-loop.test.mjs pin assertions and tasks.md. The other hunks in the listed paths are main's merged work (roadmap coordinator, update-branch row, followups tests), not this change's.

No scope creep. No ADR conflict, and the specs do not disagree. Tests were not run (the guard suite is excluded by the round's instructions; evidence.md records it green).

Files read, each diff one path at a time: plugins/openspec/hooks/deliver-check.mjs, plugins/openspec/hooks/deliver-check.test.mjs, plugins/openspec/hooks/change-loop.test.mjs, docs/openspec-flow.md, CHANGELOG.md, .claude-plugin/marketplace.json, plugins/openspec/.claude-plugin/plugin.json, openspec/changes/review-writer-prompt/tasks.md; also the previous reviews/spec-reviewer.md and the spec delta listing. No file of my remit is left unread.
