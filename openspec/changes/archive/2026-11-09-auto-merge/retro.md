## Retro: auto-merge

## The merge (AC-10, design R-4/R-5)

`deliver-check auto-merge --json --watch` reported 8/8 at `bf7acf0` with `next.step:
enable-auto-merge`. `ship-change` then ran exactly
`gh pr merge 5 --auto --squash --match-head-commit bf7acf07c106f65db8620f0af6081fa10e10e5e4`
(exit 0). Both required checks were already green, so GitHub merged at once; the next
`deliver-check` run returned `merged` (exit 0) and found the PR by number although
`delete_branch_on_merge` had already removed the branch.

```
$ gh pr view 5 --json state,mergedAt,mergedBy,mergeCommit,autoMergeRequest,headRefOid
{"autoMergeRequest":null,"headRefOid":"bf7acf07c106f65db8620f0af6081fa10e10e5e4",
 "mergeCommit":{"oid":"0b0b08e4721c7fdc88302be7d35d0cf1dcd81a32"},
 "mergedAt":"2026-11-09T14:56:01Z","mergedBy":{"login":"chacal88","is_bot":false},
 "state":"MERGED"}
$ git ls-remote --heads origin auto-merge   # no output: branch deleted on merge
```

Timeline (2026-11-09, UTC): PR #5 opened at `faf6a72`; `devkit-reviews` reported (red:
phase 5 and AC-10 open) and `check` green; settings and ruleset applied with the owner's
confirmation per item; `ship: merge` set; `bf7acf0` pushed; checks green; 8/8; auto-merge
enabled; merged 14:56:01. Tag `v0.5.0` points at `0b0b08e` (R-10).

`mergedBy` is the owner: GitHub credits the merge to whoever enabled auto-merge, and
`ship-change` enables it with the owner's `gh` token. "Without the owner" means without the
owner's action, not under another identity.

## Three questions

1. Went wrong: every `gh` helper was written where it was first needed, so phases 1–3 left
   three runners with three error formats and no timeout; one stalled call could outrun the
   capped merge wait. Check-run discovery read only GitHub's first page. The consumer
   workflow pinned a mutable tag. All four surfaced only in review round 1, as `important`,
   none in readiness. Design D5 said `--ci` without `openspec/` exits 3, which contradicted
   R-3; the implementer chose exit 0 and the design was amended only after review. The
   adr-reviewer wrote relative links one level too shallow (the same class broke on archive
   in round 1). Reviewers ran the 4-minute suite and ran out of budget before it finished.
   Subagent commits again carry the Sonnet co-author line.
2. Better next time: give a change one shared `gh` runner (with a timeout) from the first
   phase that calls `gh`, and list "every external call has a timeout and reads all pages" in
   the plan's risks. When the implementer resolves a readiness note against the design,
   amend the design in the same phase. Tell reviewers the suite result instead of making
   each re-run it. Write review links from the repo root or none at all, since change
   folders move one level deeper on archive.
3. Remember: an external call without a timeout makes every cap a wish.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | `gh` runner copied per phase, no timeout | bug-class | regression-gate (done: shared runner test and stalled-`gh` tests in `deliver-check.test.mjs`) | project |
| 2 | Paginated APIs read one page | bug-class | regression-gate (done: 45-run discovery test in `github-setup.test.mjs`) | project |
| 3 | Merge gate pinned to a mutable tag | bug-class | regression-gate (done: sha-pin tests) | project |
| 4 | Design contradicted an accepted resolution (D5 vs R-3) and was fixed late | process-friction | doc-update (proposed below) | project |
| 5 | Relative links in verdict files break when the change folder moves | bug-class | doc-update + fix on archive (proposed below) | project |
| 6 | Reviewers re-run a slow suite and time out | process-friction | memory-only | user |
| 7 | `mergedBy` is the owner under auto-merge | doc-gap | doc-update to ADR 0002 (proposed below) | project |
| 8 | Live `wait-merge` never ran: checks were green, GitHub merged at once | process-friction | followup: exercise it on a repo whose checks are still pending | project |
| 9 | `commit-and-pr` writes the Sonnet co-author line | tooling | followup: let the caller pass the trailer | project |

## Proposed updates

### docs/adr/0002-merge-without-the-owner-opt-in.md (doc-gap)
Add to Consequences:
+ "GitHub records the merge under the identity that enabled auto-merge, normally the owner's
+ `gh` login. 'Without the owner' means without the owner's action."

### CONTRIBUTING.md (process-friction)
Under "How changes are made here":
+ "When an implementer resolves a readiness note in a way the design does not say, amend
+ `design.md` in the same phase."

### plugins/core/agents/adr-reviewer.md and the other reviewers (bug-class)
+ "Link ADRs and docs from the verdict file with repo-root paths in backticks, not relative
+ links: the change folder moves one level deeper when archived."

### user memory (memory-only)
"Dispatching reviewers: pass the suite's result; a reviewer re-running a 4-minute suite
times out before it can use it."
