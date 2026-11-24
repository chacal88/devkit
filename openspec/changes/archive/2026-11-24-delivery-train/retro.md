<!-- devkit-stage retro result=passed attempt=1 commit=none -->
## Retro: delivery-train

1. Went wrong: the plan was approved on 2026-11-23 against a main that then moved five times before this change landed (PR 84, PR 88, `stage-models`, `compozy-driver` and the archive PR 92), and each move cost a merge of main, a renumbered release and, twice, a renumbered ADR (0019, then 0021, then 0022; devkit-openspec 0.34.0, devkit-core 0.14.1). The first merge of main aborted on code conflicts as well as release files, so 14 conflicts were resolved by hand. Two whole-suite gates failed on one test each, both from shared temporary folders: the new `run` helper of `delivery-train.test.mjs` spawned `release-merge.mjs` with the shared `TMPDIR` while a parallel process compared that folder, and the pin tests of `release-merge.test.mjs` and `conduct-check.test.mjs` run in several processes because test files import each other, so they needed a private folder; gate 6.9 then failed on a scanner that matched the text of a raw tmpdir call inside a comment. The owner merged PR 93 with admin rights on 2026-11-24 (merge commit `4e7c32b`, tagged `v0.34.0` afterwards) without the last stages: gate 6.9 was never ticked, and the unit-tests, e2e-tests, evidence (so the "6.9 run" column of `proof/ac-map.md` stays `pending`), demonstration and review round did not run, and `devkit-reviews` was red on the pull request by design. What did run: the phase gates 1 to 5 (4850 tests at gate 3.7), the focused file of this change (957 tests, 0 fail), `scripts/check.py`, and GitHub's `check` job (the whole suite) green on `eca590e`, the head that merged. A later try to run gate 6.9 on the merged tree was stopped on the coordinator's word, to free the machine; it was not completed and no gate was ticked. The mock-up stage did not apply (no screen). The delivery train itself has never run on this repository: the AC-12 proof ran it in a scratch repository (`proof/real-run.md`), and `devkit.delivery.train` is not set in `openspec/config.yaml`.
2. Better next time: have the change that rewrites the delivery flow land first, so the others merge main once; give every helper that spawns a child process, and every test that compares a shared folder, its own `TMPDIR` from the start; keep one whole-suite run per commit that matters and make the suite fast (`suite-speed`); give the owner's forced merge a path in the loop (`forced-merge-path`); and prove the train on the real repository before relying on it.
3. Remember: the train (`/devkit train`, `train-loop.mjs`, `devkit.delivery.train`) merged without its evidence, demonstration and independent review, so it counts as unverified until a live train runs; GitHub's marking of a boarded pull request as merged after a merge-commit train (design Open Questions) is still unobserved, and the `close-boarded-pr` step is the fallback.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | The train, its `train` check mode and `close-boarded-pr` were proved only in a scratch repository and by tests; no real train ran, and the evidence, demonstration and review of the change did not run | process-friction | followup | project |
| 2 | The repository does not set `devkit.delivery.train` yet, and `github-setup.mjs --method merge` must allow merge commits before it does | doc-gap | followup | project |
| 3 | Two parallel processes of one gate run test files that compare a shared temporary folder; each such test and each spawning helper needs a private `TMPDIR` | testing-gap | followup | project |

## Proposed updates

### `openspec/roadmap.md` (followup)
Add the live check of the train: the evidence, demonstration and review of this change did not run, so one real train of two small changes and one archive proves it once the repository turns it on.
- before: ## Round 28g: the owner's forced merge
+ after: ## Round 28h: the first live train
+ after: - [ ] train-live-check (after: delivery-train) — delivery-train merged without its evidence, demonstration and review round (the owner's admin merge of PR 93; gate 6.9 never ticked, GitHub's `check` green on eca590e). In one pull request set `devkit.delivery.model: trunk-auto` and `devkit.delivery.train` in `openspec/config.yaml` after `github-setup.mjs --method merge` allows merge commits (design D-12), then run one real train of two small changes and one ready archive and record in `openspec/changes/train-live-check/evidence.md`: the departure through `/devkit train`, the join order and the renumbered release files, the train record, `devkit-reviews` in train mode on the train's pull request, whether GitHub marks each boarded pull request merged or the `close-boarded-pr` step closes it, the post-merge tag `v<train version>`, and one red case if it can be made safely. Also record the independent review the change never had.
- Answer: approved
- Applied: yes

### `openspec/roadmap.md` (followup)
Add a change that gives every test comparing a shared temporary folder, and every helper spawning a child process, a private `TMPDIR` by construction (the suite-speed change already merged, so this is a new item, not an edit of its line).
- before: ## Round 28h: the first live train
+ after: ## Round 28i: private temp folders in tests
+ after: - [ ] test-private-tmpdir (after: delivery-train) — two whole-suite gates of delivery-train failed because tests that compare the whole shared temporary folder ("leaves no temporary folder") ran in several processes, and a helper spawned `release-merge.mjs` with the shared `TMPDIR`. List every test file and helper that still uses the shared folder, and give each a private `TMPDIR` by construction (`underOwnTmp` in `release-merge.test.mjs` and `runEnv` in `delivery-train.test.mjs` are the pattern), so running the test files in parallel cannot make one compare another's folder; add a scanner or a test that refuses a new one.
- Answer: approved
- Applied: yes
