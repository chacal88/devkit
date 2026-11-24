<!-- devkit-stage readiness result=passed attempt=1 commit=5d255b1e77f67a5628a3f1f7dabbcfe8f0147634 -->
# Readiness review: stale-only-on-own-files

Plan base `5d255b1` (HEAD of the worktree). Method: artifacts read in full, the code the plan
describes re-derived with Read and Grep, `openspec validate stale-only-on-own-files --strict`
(valid), phase gates 1.5 and 2.5 run on the base (both green: 171 and 152 tests pass, `python3
scripts/check.py` passes). Gate 3.8 is the whole suite (13 to 21 minutes) and is left to the caller.

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

## 2. Scope validation
Classification: correct

One roadmap line (`openspec/roadmap.md:92`, Round 25d), one rule, one function. The proposal's
non-goals (`fresh-base-check`, `post-merge-validate`, merge trains, dependency closure,
per-project release list, narrowing reviewers) match `requirements.md` "Out of scope". The specs add
no behavior the proposal does not justify. The only addition not literally asked for is D-5 (a
rejected verdict gets no exemption); it follows ADR 0021 decision 3 and requirements AC-6, and the
`verdict-files` delta states it.

## 3. Proposal review
Problem, goal, impact and non-goals are explicit. Ten acceptance criteria are observable and each
has a task (table at `tasks.md:30-41`). The proposal's repository facts hold at `5d255b1`: the
checkers named exist, `change-loop.mjs` and `conduct-check.mjs` write no staleness code
(`conduct-check.mjs:442` reads only `gitFacts(worktree).dirty`; `change-loop.mjs` reaches the rule
through `collectFlow` and `collectState`). Length is at the edge of the two-page rule but readable.

## 4. Design review
Internal claims re-derived against live code:

- `staleness` in `plugins/openspec/hooks/deliver-check.mjs:289-305` walks `rev-list --parents
  <full>..<head>`, takes `touchedPaths` (a merge against its first parent), and returns `<short> is
  behind <c short>, which touches <path>`. Matches D-3.
- `gitFacts(root)` returns `{ head, dirty }` (line 268) and is a default parameter of every item
  function (lines 344, 353, 437, 493, 521, 864). Adding `{ base }` with `null` as the default keeps
  every existing direct call unchanged. Matches D-4.
- Callers of `staleness`: only `tasksItem` (448), `acceptanceItem` (530), `readReviews` (348) and
  `flow-check.mjs:272`. No other implementation of the rule exists (`guard.mjs` holds only the
  slice ADR-review rule, `sliceReviewStale`, which the design excludes). `findingsItem` reads
  `readReviews`, so it inherits the rule.
- `collectState` computes `gitFacts` on its first line (1701) and `deliveryConfig` later (1705);
  `deliveryConfig` reads only the config file, so reordering has no effect. `runCi` (2219) and
  `checkOne`/`runSeveral` already take `facts`. `testBranchPr` calls no staleness function.
- `RELEASE_FILE` is at line 1124 and exported. `touchedChanges` already reads `origin/<base>` and
  `ciPreflight` already refuses a shallow clone. `.github/workflows/devkit-reviews.yml` checks out
  with `fetch-depth: 0` (A-1 holds).
- `deliveryConfig(...).base` is non-null only for a model (two-prs); D-1 step 2 is right.
- D-7 grep: no test in the repository pins the sentences D-6 changes except `release-merge-conflict
  16` (`change-loop.test.mjs:2529`, the `devkit` skill sentence). No test pins "Stale means" in the
  `review-change` skill or the `CONTRIBUTING.md` / flow doc sentences.
- T-4: `release-merge-conflict 8` (`conduct-check.test.mjs:790`) builds a merge that brings only
  `CHANGELOG.md` (`mergedChange`, lines 767-782), so under AC-4 it must hand `push` at once, as D-7
  says. `commitOrigin` pushes from the main checkout, so `refs/remotes/origin/main` exists in the
  worktree and `stalenessBase` resolves it. The loop reads only `collectState` (it imports only
  `FlowUsageError` from `flow-check`), so task 2.2 can pass on phase 1 code alone.
- The walk's classification (a commit of the base brought in; a merge of the base; everything else
  as today) fails safe in each case I traced: an unfetched base, a merge of another branch, a head
  inside the base, a merge made on the base, a fast-forwarded base, unrelated histories.

No internal claim failed re-derivation. Config rule "Read the ADRs' rejected alternatives": the
alternatives of ADR 0002 and the rows ADR 0021 adds do not reject the own-files approach.

## 5. Specs review
Four deltas with `#### Scenario:` blocks, normative language, full MODIFIED requirement text. Every
D-3 fail-safe case has a scenario (no origin, unfetched base, other branch, head in base, restored
file). The `verdict-files` delta carries the D-5 outcome. The `reviews-check` delta covers both CI
entries. Gaps are minor (section 10).

## 6. Tasks review
Three phases, each ending in a gate with one backticked command (`1.5`, `2.5`, `3.8`), test-first
order with red proofs, every AC id present, version and ADR numbers stated as "next free ... at the
last merge before review" (3.3, 3.5), existing tests changed only where D-7 names them (3.6 and 2.2
name invariant, layer and suite). Gates 1.5 and 2.5 exist on the base and are green there. The
`${TMPDIR%/}` and `env VAR=...` forms have precedent in archived changes' gates.

## 7. Omission detection
Validation, error handling, idempotency, rollback, migration (none needed, rule reads only git),
compatibility with legacy records (judged by the new rule from the first run), observability (the
reason text keeps today's form) and test strategy are all defined. Permissions, retries, feature
flags and backfill do not apply.

## 8. Execution risks (top 5 failures)
1. Cause: the local `origin/<base>` is stale in a worktree. Impact: a merge is not exempted and the
   change redoes its suite as today. Prevention: already by design (D-3 fail-safe); `fresh-base-check`
   is the separate line.
2. Cause: a base change breaks the change without touching its files. Impact: a green record on a
   red merged ref. Prevention: the required `check` CI (ADR 0021 decision 6, R-1, AC-9).
3. Cause: an existing test outside D-7 that merges a real `origin/<base>` and expects stale (only
   gate 3.8 runs the whole suite). Impact: a late red at the end. Prevention: A-3's grep plus the
   by-name runs; one plan revision per the plan's own rule.
4. Cause: a rejected review goes stale on a base merge during `fix-review` (D-5, R-4). Impact: one
   extra reviewer run. Prevention: accepted and recorded.
5. Cause: the CI pin of the flow doc and the release numbers race with a sibling merge. Impact: one
   release re-run. Prevention: the tasks name "next free ... at the last merge before review".

## 9. Mandatory fixes before implementation
- [x] none

## 10. Optional improvements (within scope)
- [ ] Low, Nice to have: `design.md` D-7 T-5 says "run by name at gate 2.6"; the gate is 2.5
  (`tasks.md:79`). Fix the number.
- [ ] Low, Nice to have: `design.md` R-7 says the phase gates run every group that builds an
  `origin`. They run only the subsets in 1.5 and 2.5 (the other groups, for example `delivery-models
  P4 testBranchCommit`, which merges `origin/develop`, run at gate 3.8). Say "the groups that merge
  the base".
- [ ] Medium, Nice to have: `design.md` D-1 (base order: `GITHUB_BASE_REF`, configured base,
  `origin/HEAD`, `main`/`master`) has a test (`own-files AC-7 base`) but no spec scenario; the
  `reviews-check` delta names only `GITHUB_BASE_REF`. Add one scenario per step if the spec is
  touched again. The spec says CI uses "else the base the delivery checker reads", while D-4 passes
  no configured base to `runCi`; in a pull request `GITHUB_BASE_REF` is always set, so no behavior
  differs.
- [ ] Low, Nice to have: no scenario shows a base commit brought in by a merge as exempt when it
  touches only unrelated files (the `change-delivery` scenario "A product commit the merge brings
  in" covers only the stale side). The D-8 test row `own-files AC-1 rule: the base commits a merge
  brings in ...` covers it.
- [ ] Low, Nice to have: tasks 3.3 and 3.4 name "ADR 0021" literally. The renumber clause in 3.3
  makes this safe; rewording to "this change's ADR" would follow the config rule to the letter.
- [ ] Low, Fix during implementation: task 1.1 red run. `deliver-check.test.mjs` imports named
  exports at line 12; a named import of `stalenessBase` or `ownFiles` that does not exist fails the
  whole file, and `guard.test.mjs` imports it. Use the `DC` namespace import (line 13) in the new
  tests so only the `own-files` tests fail on the base.

## 11. Explicitly out of scope
- [x] `fresh-base-check`, `post-merge-validate`, merge trains and holds, a dependency closure, a
  per-project release list, narrowing reviewers by area (requirements "Out of scope").

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes: every merge of `main` stales every open change (`proposal.md` Why; ADR 0021 Context).
2. Is the result measurable? Yes: AC-1 to AC-10, each with a named test or a real-run case (P-1 to P-7).
3. Are error behaviors defined? Yes: no `origin/<base>`, unfetched base, head in base, unrelated histories and a failing `git diff` all give today's verdict (D-2, D-3, spec "fails safe").
4. Are edge cases covered? Yes: restored file, moves (`--no-renames`), release files, mixed merges, test-only commit, rejected verdict, another branch.
5. Are dependencies clear? Yes: ADR 0021 only; no other change.
6. Are contracts defined? Yes: `stalenessBase`, `ownFiles`, `gitFacts(root, { base })`, `staleness(..., { own })`, and the unchanged reason string.
7. Can two developers interpret this differently? Not materially; D-3 gives the walk step by step and D-8 names every test.
8. Are any decisions implicit instead of written? No; the rejected-verdict choice is explicit (D-5) and the base order is explicit (D-1).
9. Do the tasks fully deliver the intended outcome? Yes: rule, stage checker, loop expectations, documents, ADRs, release and real-run proof.
10. What will be discovered too late if implementation starts now? At most an existing test outside D-7 that expects a stale verdict after a real base merge (A-3 says there is none; gate 3.8 would show it).

## 13. Final conclusion
- Can we start? Yes.
- What must be fixed? Nothing before implementation; the section 10 items are optional.
- Main risk if ignored? A late red from an unlisted test at gate 3.8, which the plan already routes to a plan revision.
