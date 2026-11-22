Verdict: rejected
Commit: 643bc4765052e251d8e0412d3247a28d7da2d555

## Coverage analysis: review-writer-prompt (main...HEAD, 643bc47), re-read in full

### Findings
- [important] plugins/openspec/hooks/deliver-check.mjs fencedLines/parseTasks; plugins/openspec/hooks/deliver-check.test.mjs AC-9 tests — [6] An unclosed fence in tasks.md hides every later task and gate (reproduced: parseTasks returned only 1.1, dropping an unticked 1.2 and a gate 1.3), so the delivery tasks item passes with open work. No test or spec scenario covers an unclosed fence. Write in deliver-check.test.mjs next to the AC-9 tests (parseTasks plus tasksItem on a tasks.md with an opening fence and no closing line), and settle the intended rule (count the tasks, or report the unclosed fence) in the change-delivery spec first.
- [nit] review-round.test.mjs AC-1/AC-3/AC-4 text tests — Text tests match exact prose of SKILL.md, the six agent bullets and the ship-change row, so a harmless rewording turns them red. They guard a documented contract; fragility note only.
- [nit] review-round.test.mjs 'a file written from the writer prompt has one of each line and passes check-file' — The file is built by the writeVerdictFile helper from the outcome, not from the writer prompt, so the title overstates it. It still goes red if the header stripping breaks.
- [nit] openspec/changes/review-writer-prompt/evidence.md gate 2.5 — The standalone run of the two hook test files left no output; the proof is indirect, through the guard suite that imports both files.

In-scope surfaces: plugins/core (review-round script, Workflow script, review-change skill, six reviewer agents), plugins/openspec (deliver-check.mjs, flow-check.mjs, ship-change skill).
Blocking gaps (8-10 without a plan): 0

Seams checked (mutation runs: 0, one scratch reproduction of parseTasks):
- Stage-1 commit equals args.head: caught by the exact-message test for a commit that is not HEAD and by the padded-sha tests on the CLI and the workflow, which assert the failed entry, no verifier job, no outcome and a null reviewMd.
- head required in args: caught by a loop over stage1, verify, outcomes and consolidate (exit 3, 'review input invalid:'), and by the workflow test asserting zero agent calls.
- read/notRead: caught by a seven-shape table on the CLI and the workflow, with exact messages; declined with empty read passes.
- writeJobs shared by both paths: caught by the test comparing the CLI job prompts to the Workflow write-call prompts and agent types.
- Header-line stripping and the check-file second-header refusal: caught by tests asserting no header lines in the outcome, the exact line number, indented lines, and a clean file that mentions Verdict: mid-line.
- Scoped staleness: caught by the AC-8 matrix (test-only, product, mixed, uncommitted, a reviewer outside the six, the allowed option, evidence on the default rule, step order verify then review, both --ci entries).
- staleReviewers in flow-check: caught by live collectFlow tests on real git repos, including the post-merge exemption.
- Text tests: the six agents' Stage-1 bullet is byte-identical and matched; the ship-change row and the skill steps are matched. These are wording contracts, so fragile only.
- Unclosed fence in tasks.md: GAP (F1). Reproduced; no test covers it.

Well covered:
- The head and partial-answer guards on both paths, with the failure asserted before any verifier or writer call.
- Writer-prompt equality across the CLI and workflow paths from the same fixtures.
- The test-file staleness matrix through both entry points of the devkit-reviews check.

Files read: the full git diff main...HEAD bodies of review-round.test.mjs, deliver-check.test.mjs and flow-check.test.mjs; the production diffs of review-round.mjs, review-round.workflow.js, deliver-check.mjs, flow-check.mjs and review-change/SKILL.md; the ship-change SKILL.md diff and the six reviewer agent diffs; the four spec deltas; evidence.md. Still unread: design.md, proposal.md, tasks.md, readiness.md, requirements.md, approval.md, the ADRs, and the unchanged parts of the test files outside the diff. None is the core of my remit. I ran no suite; the only run was the scratch parseTasks reproduction.
