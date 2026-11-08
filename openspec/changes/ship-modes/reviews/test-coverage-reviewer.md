Verdict: rejected
Commit: c15ff9b5443255278571f6b9b90b385219998c2e

## Coverage analysis — ship-modes (28a83b9..c15ff9b), round 1

In-scope surfaces: plugins/openspec/hooks (deliver-check.mjs, guard.mjs exports), agent/skill markdown contracts
Blocking gaps (8-10 without a plan): 1
Seams checked (mutation runs: 0; the suite is green, 173/173 via `node --test plugins/openspec/hooks/guard.test.mjs`):
- ship config -> shipMode -> collectState -> stop-plan-mode: caught by `CLI: a plan-mode project reports stop-plan-mode` (deliver-check.test.mjs:1448) and the AC-1 guard test (:140)
- merge rejected -> CLI exit 3 + JSON error: caught by :1425 (AC-10)
- git staleness -> reviews/evidence `current` -> nextStep review/verify, real repos: caught by the resume tests :1260-1350 (AC-5, AC-7)
- gh -> items 5/6/7/8 (fake `gh` on PATH, per-call fixtures): caught by :727-1000
- --watch capped, single, required flag: caught by :1495-1545 (AC-9)
- collectState -> `needsReadiness` / `readiness` -> stop-not-approved (AC-3): GAP
- collectState -> `branchOk` -> stop-branch: GAP
- real `gh` payload shapes (pr view, pr checks --json, api graphql with `{owner}/{repo}` placeholders): GAP (cross-process, real evidence)

### Findings
- [blocking] [8] AC-3 seam, readiness wiring in collectState — failure: for a `devkit` change with `ship: devkit: pr` and `readiness.md` at `Status: NEEDS-REVISION` or missing, `deliver-check.mjs:708-717` computes `needsReadiness = schemaHasArtifact(root, schema, 'readiness')` and `readiness = readValue(...)`. Break either (wrong artifact id, wrong file path, `needsReadiness` always false) and the flow starts implementing an unapproved plan, the one human gate the change promises to keep. The only test is `nextStep row 3` (deliver-check.test.mjs:1050), which hand-builds `needsReadiness: true, readiness: 'NEEDS-REVISION'` in a synthetic state and so never touches the derivation. No test calls `collectState` or the CLI with `schema: devkit`. Every shipRepo/CLI test is `devkit-lite`, and `schemaHasArtifact` returns false unless `openspec/schemas/devkit/schema.yaml` exists (guard.mjs:109-121), which no fixture creates. A real `stop-not-approved` can never fire in the suite. · write in: deliver-check.test.mjs, next to `shipRepo()` (:1240). Add a `devkit` fixture with `openspec/schemas/devkit/schema.yaml` declaring `- id: readiness`. Assert `nextStep(collectState(...)).step === 'stop-not-approved'` for missing and non-APPROVED status, and that APPROVED proceeds past it. Add a CLI `--json` case (`next.step`).
- [important] [6] `branchOk` derivation — failure: `deliver-check.mjs:715` (`selected?.name === id && Boolean(branch) && !defaultBranches(root).includes(branch)`) is only tested in its "true" direction (every walkthrough runs on `ship/feat`). With `branchOk` forced true, or the default-branch exclusion dropped, a run on `main` or on a branch unrelated to the change is not stopped, and the hooks will not select the change for the subagents. `stop-branch` (:1046) is tested only against a synthetic `branchOk: false`. Also untested: the `DEVKIT_BRANCH` / `GITHUB_HEAD_REF` precedence in `currentBranch` (:668), and `origin/HEAD` as a default branch. · write in: deliver-check.test.mjs, on the `shipRepo()` convention. Run `collectState` on `main`, on `other/branch`, and with `DEVKIT_BRANCH=ship/feat` set; assert `stop-branch` in the first two.
- [important] [6] Real `gh` contract, not exercised anywhere — failure: the fake `gh` answers fixtures that the author wrote by hand, so the field names (`headRefOid`, `mergeable`, `bucket`), the `-F owner={owner} -F name={repo}` placeholders, the GraphQL shape (`viewer`, `reviewThreads`, `comments(last:100)`) and the exit codes 8/1 of `gh pr checks` are not checked against a real repo. A wrong field makes item 5/6/7 `blocked` on every real PR. This flow chooses the next automated action (push, fix-checks, answer), and a unit test can't cover it. · write in: not a unit test. Record one real run in the change's `evidence.md` or the PR: `node plugins/openspec/hooks/deliver-check.mjs ship-modes --json` against a real open PR with at least one check and one review thread, and show that items 5-8 are not `blocked` for a reason about the payload.
- [important] [5] Item 7 time-based "answered" model — failure: `conversationItem` (:524-541) treats everything older than the viewer's latest word anywhere on the PR as answered. A person's comment A on thread X, then the viewer replying only on thread Y, hides A. Tests (:927-960) cover single-comment cases, not one reply that covers an older comment elsewhere. This is a design choice; at least one test should pin it so a change is deliberate. · write in: deliver-check.test.mjs next to :927 (`conversation()` fixture).
- [nit] implementation-coupled: deliver-check.test.mjs:737 asserts the exact `--json` field list passed to `gh pr view` (PR_FIELDS). A legitimate extra field breaks the test, though the contract is "the fields we read exist".
- [nit] format-contract tests (:1565-1650) grep the agent/skill markdown. They are intentional and guard real parsing coupling (Output block order, `· fixed in <sha>`), but they pass on wording rather than behavior; keep them narrow.
- [nit] `describeNext` and the human `renderHuman` strings for `fix-checks`, `edit-pr-body` and `blocked` are only matched by regex on the `implement` line (:1359-1370). Low risk.

### Well covered
- Contract items 1-4: unticked tasks, gate sub-commands split on `&&`, `AC-1` vs `AC-12` prefix collision, fail beside pass, "no proof" blocked, stale/missing evidence (:358-618).
- Staleness (AC-7): openspec-only commits current, product commit, mixed commit, merge from base, unresolvable/non-ancestor sha, dirty tree, untracked `.claude/` (:182-272), on real temporary git repos, not mocks.
- Item 2 re-run only the stale reviewers, and the round 1/2 transitions plus the deadlock stop, including resume after the owner's own commit (:1103-1130, :1336).
- End-to-end walkthrough devkit-lite to ready with the exact step sequence (AC-2) and resume without redoing phases (AC-5), (:1260-1340).
- Item 5/6/7 error paths: gh missing/unauthenticated, CLOSED/MERGED/CONFLICTING, no PR is open not blocked, exit 8 and 1 with a parseable list, 100+ threads blocked, CHANGES_REQUESTED open then blocked then cleared.
- guard.mjs import safety and symlinked execution (guard.test.mjs:313-340), which protect the existing hooks against the refactor.
- `--watch`: one watch, cap kills it, never watches before a PR or when a commit is due (:1495-1545).

Blocking: the AC-3 derivation seam. Close it (and preferably the `branchOk` one) and re-run this review as round 2. No contract change or scope widening is needed.
