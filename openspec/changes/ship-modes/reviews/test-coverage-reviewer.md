Verdict: approved
Commit: c5da1553d4afe9be984cb4d1056c8acf3bb9d405

## Coverage analysis — ship-modes, stale-only re-review (1acce88..c5da155)

In-scope surfaces: plugins/openspec/hooks (deliver-check.mjs, deliver-check.test.mjs), plugins/core/agents/pr-verifier.md, docs/openspec-flow.md
Blocking gaps (8-10 without a plan): 0
Seams checked (mutation runs: 0; `node --test plugins/openspec/hooks/guard.test.mjs` green, 187/187):
- main() git precondition -> UsageError exit 3: caught by `CLI: openspec/ without a git repo is a clear usage error...` (spawns the real CLI in a temp dir with GIT_CEILING_DIRECTORIES so no parent repo leaks in; asserts status 3, /not a git repository/, and no raw `fatal:`). Removing the guard turns it red.
- evidence.md `Commit:` placement (pr-verifier wording -> parseCommitLine header rule): reader side caught by `parseCommitLine: reads the header only` (a Commit line after the first heading returns null); writer side is prose, pinned by a format test.
- Reviewer agents' "second line is Commit" instruction: caught by the new loop over the six reviewer agents.

### Findings
- [nit] format-contract grep: `format: pr-verifier puts the Commit line before the first heading...` asserts wording in the agent prompt, not behavior. It is consistent with the repo's existing format tests, and the behavior that matters (parseCommitLine) is tested separately. No change needed.
- [important] [6] Real `gh` contract not exercised (carried from round 1). Accepted follow-up, not a unit-test gap. Condition: pr-verifier runs `deliver-check ship-modes --json` against the real open PR (at least one check and one review thread) and records it in evidence.md, showing items 5-8 are not `blocked` for a payload reason, and checks that `authorAssociation` is present in the real GraphQL response (if missing, every person is ignored and item 7 passes falsely as `met`). I leave this line without a disposition on purpose: the live run has not happened, so item 3 stays open until it does.

### Round-1 findings, unchanged
- [blocking] [8] AC-3 readiness wiring in collectState · fixed in 1acce88
- [important] [6] branchOk derivation and currentBranch precedence · fixed in 1acce88
- [important] [5] Item 7 answered model · fixed in 1acce88

### Well covered
- The no-git usage error, through the real CLI process with the parent-repo escape closed.
- Commit header rule on the reader side (parseCommitLine, heading boundary).
- Earlier coverage (AC-3, stop-branch, item 7 trust filter, contract items 1-4, staleness, gh error paths, --watch) is untouched by this diff and still green.
