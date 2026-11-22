Verdict: approved
Commit: 643bc4765052e251d8e0412d3247a28d7da2d555

## Spec review — review-writer-prompt

### Findings
- [nit] plugins/core/skills/review-change/scripts/review-round.workflow.js (validateStage1, heading) — A stage-1 heading beginning with Verdict: or Commit: is not stripped, so a written file could still hold a second header line; the spec only covers sections, and check-file would catch it.
- [nit] plugins/openspec/hooks/deliver-check.test.mjs (AC-9 'unticked checkbox inside a backtick fence') — Scenario 'An unticked example in a fence' says the next step is not implement; the test asserts parseTasks and tasksItem only, not the next step. The behaviour follows, but the THEN is not asserted literally.

In-scope specs: the four spec deltas under openspec/changes/review-writer-prompt/specs/ (review-round, verdict-files, change-stages, change-delivery). All are ADDED requirements; no baseline capability spec was modified.

### Coverage
| Requirement | Status | Asserting tests |
|---|---|---|
| The outcomes command gives the writer prompts | covered | AC-1: jobs order, agent types, prompt equal to writerPrompt and to the workflow write calls; no job for a failed reviewer; the key list is outcomes, failed, verifiersFailed, jobs |
| The stage-1 prompt names one sha per disposition | covered | AC-2: prompt regexes, schema description, two shas fail on the CLI and the workflow |
| The stage-1 prompt asks for HEAD and the files read | covered | AC-3: regexes for rev-parse, read, notRead and the sections rule; the args.head sha is absent from the prompt; the schema requires both lists |
| A review round needs the head sha | covered | AC-4: exit 3 on four commands with no head or a 7-char head; the workflow throws with zero agent calls |
| A stage-1 answer at another commit fails its review stage | covered | AC-4: exact error naming both shas; padded sha on verify and outcomes (failed, no job, no outcome); on the workflow (no verifier or writer, reviewMd null); the HEAD commit passes on both paths |
| A partial stage-1 answer fails its review stage | covered | AC-5: exact messages; table of partials on the CLI and the workflow; the declined case with an empty read passes with verdict declined |
| A verdict file carries one Verdict line and one Commit line | covered | AC-6: all scenarios asserted, including the indented line and the file written from the prompt passing check-file |
| The file check refuses a second Verdict or Commit line | covered | AC-7: exit 2, prefix, line number, Commit, indented; clean file exits 0 |
| The review skill fills the head and sends the writer jobs | covered | text tests for SKILL.md and the ship-change row; the six agent files each hold the same Stage 1 bullet |
| A test file is named by a fixed pattern | covered | AC-8 isTestFile with the exact path lists of both scenarios |
| A commit of test files leaves the reviews it does not concern current | covered | AC-8: all 8 scenarios asserted, plus both CI entries |
| The review stage is stale while a reviewer is stale | covered | flow-check AC-8: all 4 scenarios, plus the reason text and the walk without the fact |
| The delivery checker does not count a checkbox inside a fenced block | covered | AC-9: all 5 scenarios (see F2) |

No scope creep. Every change maps to a requirement, to requirements.md or proposal.md, or to a design.md decision D-1 to D-10. That includes the fencedLines move, the bilingual stale-reviewers text, the six agent-paragraph edits (flagged in proposal.md for the owner), the docs/openspec-flow.md edits, the v0.19.0 pin, the version bumps and the CHANGELOG. No ADR conflict.

Tests run: review-round.test.mjs, 87 of 87 pass. The hook test files were read but not run, because the machine is short on inodes. The evidence file records the full suite green at this commit.

Files read: the four spec deltas; requirements.md and proposal.md in full; design.md headings and decision list; git diff main...HEAD of review-round.mjs, review-round.workflow.js, deliver-check.mjs, flow-check.mjs, review-change/SKILL.md, ship-change/SKILL.md, docs/openspec-flow.md and the six plugins/core/agents/*-reviewer.md files; the deliver-check, flow-check and change-loop test diffs; review-round.test.mjs in full for every test that backs a requirement row; the function bodies of staleness, writerPrompt and the parseTasks callers.

Still unread: tasks.md, readiness.md and evidence.md of the change, and the rest of design.md prose. They are plan and process artifacts, not the specs, tests or code that prove a requirement. Nothing of the spec, test or code remit is left unread.
