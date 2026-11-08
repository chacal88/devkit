Verdict: approved
Commit: 1acce88ed3366a841c5c97dab4f0e615d09a3537

## Coverage analysis — ship-modes (c15ff9b..1acce88), round 2

In-scope surfaces: plugins/openspec/hooks (deliver-check.mjs, deliver-check.test.mjs)
Blocking gaps (8-10 without a plan): 0
Seams checked (mutation runs: 0; `node --test plugins/openspec/hooks/guard.test.mjs` is green, 184/184):
- collectState -> needsReadiness/readiness -> stop-not-approved (AC-3): caught by `AC-3: a devkit change without readiness.md...` (asserts needsReadiness true, readiness null, step, reason /missing/), `...Status is not APPROVED` (BLOCKED, NEEDS_CHANGES, "APPROVED | BLOCKED"), the APPROVED pass-through, the devkit-lite negative, and the CLI `--json` case. `devkitRepo()` writes `openspec/schemas/devkit/schema.yaml` with a `readiness` artifact, so `schemaHasArtifact` is really exercised.
- collectState -> branchOk -> stop-branch: caught by `branchOk: ...` (main, unrelated branch, own branch) and `currentBranch: DEVKIT_BRANCH wins over GITHUB_HEAD_REF...` (precedence, default branch named by env).
- item 7 authorAssociation filter -> comments/reviews/threads/CHANGES_REQUESTED: caught by the OWNER/MEMBER/COLLABORATOR vs CONTRIBUTOR/NONE/FIRST_TIME_*/MANNEQUIN/missing loop, covering all four paths, and by the query assertion (3 occurrences of authorAssociation).
- item 7 answered model (thread replies do not answer): caught by the two new tests.
- real gh payloads: not a unit test, see below.

### Findings (round 1 re-listed)
- [blocking] [8] AC-3 readiness wiring in collectState · fixed in 1acce88. The new tests go through `collectState` and the CLI with schema devkit. Breaking the artifact id, the file path or `needsReadiness` turns them red.
- [important] [6] branchOk derivation and currentBranch precedence · fixed in 1acce88. Both directions are tested, plus env precedence.
- [important] [5] Item 7 answered model · fixed in 1acce88. `spoke` is now top-level only; the tests pin "thread reply does not answer" and "later top-level answers".
- [important] [6] Real `gh` contract not exercised · open as an evidence item, not as a gap. I accept the disposition "refuted as a unit test": my round-1 plan was already a recorded real run, not a unit test. Not blocking. Condition: pr-verifier must run `deliver-check ship-modes --json` against the real open PR (with at least one check and one review thread) and record it in evidence.md, showing items 5-8 are not `blocked` for a payload reason. Until then it is a pending follow-up. Because the run now depends on `authorAssociation`, check that field in the real GraphQL response too: if it is missing, every person is ignored and item 7 passes falsely as `met`.
- [nit] still open from round 1: the exact `--json` field list assertion for `gh pr view` (PR_FIELDS), the grep-style format-contract tests, and the loose `describeNext` strings. No change needed.
- [nit] [3] New: `.`/`..` change ids now exit 3 (tested). Fine.
- [nit] [3] Fail-closed on a missing `authorAssociation` is pinned by a test, but the fixtures only exercise it through hand-written payloads. This is the same real-payload follow-up as above.

### Well covered
- AC-3 and stop-branch, now through the real derivation, on a temporary git repo, in the CLI too.
- Item 7 trust filter across comments, review bodies, threads and CHANGES_REQUESTED, with each outsider association.
- Round-1 coverage (contract items 1-4, staleness, resume, gh error paths, --watch) is unchanged and still green.
