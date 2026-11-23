Verdict: approved
Commit: 26e00b19de03124db593d628a40c3383400db2c6

## Coverage analysis — delivery-models (origin/main...HEAD)

### Findings
- [nit] plugins/openspec/hooks/guard.mjs:541 testBranchViolation, plugins/openspec/hooks/delivery-models.test.mjs:1085-1105 — The test-branch lock covers only merge, rebase and pull. Tests pin refused and allowed forms for those three. `git cherry-pick develop..`, `git merge FETCH_HEAD` after a fetch, and `git merge -- develop` are not tested as refused or as deliberately allowed. The base pull request check (testBranchCommit, tested at lines 1200 and 1286) is the backstop. Pin one deliberately-allowed form so the boundary is documented.
- [nit] plugins/openspec/hooks/delivery-models.test.mjs:2065 — The 'documents follow' test is a prose-pinned regex over ADR, design and flow text. It is implementation-coupled, so a legitimate rewording of a doc line turns it red. It is also the only test mapped to AC-1 docs and AC-10 in ac-map.md. Its invariant is stated in a comment, which helps, but keep the pins to structural markers (headings, table rows, step names) and drop the long literal sentences.
- [praise] plugins/openspec/hooks/delivery-models.test.mjs — Each seam is exercised through its real wire, with a fake GitHub backed by a real bare origin and real worktrees. This covers the hook lock (refused and allowed through the CLI), the CI check (--ci with env), the resolution-review hold, the archive to both branches, the workflow template (GH_TOKEN and pull-requests: read), and verdictDir for the review writer. Negative tests accompany the positives.

In-scope surfaces: plugins/openspec/hooks (guard, deliver-check, change-loop, conduct-check, flow-check), plugins/core review-round workflow, the devkit-reviews.yml template and the docs.
Blocking gaps (8-10 without a plan): 0
Seams checked (mutation runs: 0):
- Test-branch lock in the hook -> caught by `delivery-models P3` refused/allowed table, including a bare pull with upstream, `-C`, `cd &&`, the support branch, the test branch itself and the bypass env var, and by `AC-5: the hook refuses...`.
- Task branch holding a test-branch commit (state and --ci) -> caught by `P4 testBranchCommit` (merge, rebase, squash, neg) and `P7 T1`.
- Base pull request waits for the test-branch pull request -> caught by `AC-4`.
- Conflict on the support branch, with resolution review before push -> caught by `AC-6`, `AC-7`, `P7 T8` and `P6` (rejected verdict, undisposed finding, clean merges).
- Resolution verdict path `reviews/resolution/<name>.md` -> caught by `guard.test` P11 classify tests (positive, neg, wrong reviewer, main session) and the review-round P15 verdictDir tests.
- Archive to both branches -> caught by `AC-9 archive/delivered` and `P10`.
- Settings parsing and the ship-config agreement -> caught by `delivery-models config:` (about 20 tests, including negatives).
- CI workflow template -> caught by `P5 workflow`.
- Opening from origin/<base> and its refusals -> caught by `delivery-models open:` tests.

Well covered: every behavior in ac-map.md has a named test, and the ones I opened assert on observable output, not on mocks. The fake gh is stateful and reads heads from a real origin, so it is not a canned response. No test-that-tests-the-mock or impossible fixture found.
