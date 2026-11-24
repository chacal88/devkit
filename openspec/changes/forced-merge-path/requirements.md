<!-- devkit-stage requirements result=passed attempt=1 commit=none -->
# Requirements

## Request

> when the owner merges a change's pull request with admin rights while the delivery contract is below 8/8 (roadmap-sessions-upfront, PR 88: task 9.6, the evidence and the review of the last phase were open), `deliver-check` and `change-loop.mjs next` keep answering `implement` for the open task and, once GitHub deletes the branch, find no pull request for it. The loop should recognise a merged pull request by its number or by the merge commit on the default branch, say "merged by the owner with N items open", and go to the retro and the archive, recording the open items in `retro.md`; it must not tick a gate that did not run.

## Classification

domain=process type=feature flags=[architecture, contract] (confirmed: the change moves the rule of ADR 0003 and changes the step names `deliver-check` and `change-loop` answer).

## Live cases (2026-11-23/24, the owner's forced merges)

1. PR 88 (roadmap-sessions-upfront) merged by the owner with `devkit-reviews` FAILURE and `check` SUCCESS, task 9.6, the last phase's evidence and review open: `next` kept answering `implement`.
2. PR 91 (stage-models): the devkit hook refused `gh pr create` while the review was not approved, so the coordinator opened the pull request by hand.
3. delivery-train and compozy-driver: merged the same way the same night, each without its final evidence and review.
4. In those sessions the retro and the archive were driven by hand.

## Assumptions

<!-- Each confirmed by the owner. Literal paths, fields, names. -->
- A merged pull request of the change counts as the owner's forced, final merge when its head commit's required checks are not all green at merge: `check` or `devkit-reviews` of the pull request's `statusCheckRollup` has a conclusion other than `SUCCESS`, or is absent. (Owner's answer, 2026-11-24: automatic, by the checks.)
- A merged pull request of the change with unticked tasks and every required check green stays a deliberate partial pull request: `plugins/openspec/hooks/deliver-check.mjs#nextStep` keeps answering `stop-branch` ("continue on branch ... and open a further pull request") exactly as `openspec/specs/change-delivery/spec.md` says today. No behaviour of that case changes.
- A forced merge is recognised from any checkout and with the change's branch deleted on GitHub, by the pull request's number or by the merge commit on the default branch (`origin/<base>`). Today's lookups are: by number (`deliver-check.mjs#fetchPr`), by head branch (`fetchPr` `listFound`), by the files the pull request changed (`deliver-check.mjs#findChangePr`, newest 100 merged); none starts from the merge commit. AMBIGUOUS: (a) `gh api repos/<repo>/commits/<merge-sha>/pulls` from the default branch's log | (b) a `(#<n>)` or `Merge pull request #<n>` subject on the default branch's first-parent log; the planner resolves, after reproducing the PR 88 miss (merge commit `6999a043f0e94b76ea42a3ae77392dc67af6855e`, head `roadmap-sessions-upfront`) to find where the lookup lost the pull request.
- "N items open" counts what did not run or was not done at the merge: every unticked task of `openspec/changes/<id>/tasks.md` on the default branch, plus each required check not green, plus each gate file of the delivery contract (`evidence.md`, `reviews/`) that does not hold a passing verdict for the merged head. The reply says `merged by the owner with N items open`, in the owner's language and in `filesLanguage` for files.
- A forced merge leads `deliver-check.mjs` and `change-loop.mjs next` to the same archive steps a delivered change gets (`retro`, `stop-retro-answers`, `archive`, `tick-roadmap`, `apply-proposals`, `open-archive-pr`, `tag-release`), never to `implement`, `fix-*`, `verify` or `review`.
- Nothing is ticked, written or faked for what did not run: `tasks.md` on the default branch keeps its unticked tasks, and no gate file (`readiness.md`, `reviews/<reviewer>.md`, `evidence.md`, `approval.md`) is created or changed by this path. Each gate file keeps its one writer (`docs/conventions.md`, ADR 0016).
- The open items are recorded in `openspec/changes/<id>/retro.md`, in the retro's own "went wrong" content (the retro of `roadmap-sessions-upfront` already wrote it as prose). AMBIGUOUS: (a) a dedicated section of the retro template | (b) a line the retro agent's brief carries into "Went wrong"; the planner resolves from `plugins/core/skills/retro/SKILL.md`.
- The retro proposals of such a change are answered only by the owner's own typed message, as for any change (`stop-retro-answers`, `plugins/core/skills/retro/SKILL.md`); the forced merge gets no exception.
- `openspec archive` of a change with unticked tasks must run non-interactively; the planner checks the installed CLI's behaviour (`openspec-cli` spec) and records how the archive step passes it.
- The release tag (ADR 0019) applies to a forced merge that bumped the release file: the `tag-release` row is reached once the change is in the archive phase, and the pull request's number must be known (the lookup above is its precondition).
- The decision is a new ADR with status `proposed`, drafted by the adr-author, that amends ADR 0003 ("the archive starts after the change is delivered") by naming the owner's forced merge as a second way to the archive; it becomes accepted only at the owner's plan approval. The `change-delivery` spec gets a delta for "Delivered means its own pull request merged and every task ticked" and "The work left after a merge is named". (Owner's answer, 2026-11-24: new ADR that amends 0003.)
- `ship-change` keeps its ban on `--admin` and on merging; this change only recognises a merge the owner already made.
- The proof of the change replays the live cases against GitHub, read-only, for every case merged by then (PR 88 first), and uses a fixture for any case not merged yet; a plan that declares more cases proves each one.

### Answered by triage

1. [project rules] Does recognising an owner's forced merge collide with an ADR or inviolable rule? → no ADR bars the owner from merging (ADR 0002: "the default stays the owner's merge"); ADR 0003 and the `change-delivery` spec say only a delivered change leads to the archive, so this path moves ADR 0003's rule and needs a proposal for a new ADR (source: `docs/adr/0002-merge-without-the-owner-opt-in.md:27`, `docs/adr/0003-auto-merge-the-archive-pr.md:10`, `openspec/specs/change-delivery/spec.md:31`, `openspec/config.yaml:46`).
2. [end effect] Is a gate ticked by anyone but its writer? → never; the gate is ticked by whoever re-runs it, each gate file has one writer, and a criterion without evidence stays open (source: `plugins/core/agents/tdd-implementer.md:74`, `docs/conventions.md:63`, `plugins/core/agents/pr-verifier.md:72`).
3. [edges] Which lookups exist when the branch is deleted? → by number, by head branch, by the files of the newest 100 merged pull requests; none by the merge commit (source: `plugins/openspec/hooks/deliver-check.mjs:579`, `:583-596`, `:687-698`).
4. [edges] Does the release tag step already apply to a forced merge? → no: `tag-release` is a row of `archiveNext`, reached only for a delivered change, and it needs the change pull request's number (source: `plugins/openspec/hooks/deliver-check.mjs:1386`, `:1403-1413`, `:1714`, `:1344`).
5. [end effect] Who answers the retro proposals? → only the owner's own message (source: `plugins/core/skills/retro/SKILL.md:102`, `plugins/openspec/skills/ship-change/SKILL.md:147`, `plugins/openspec/skills/devkit/SKILL.md:235`).

### Questions asked

1. [scope] A merged pull request with tasks left is today a deliberate partial one; how does the loop know the owner's merge was the last, forced one? → automatic, by the required checks not being green at merge (a partial pull request with every check green stays as it is).
2. [project rules] ADR 0003 says the archive starts only for a delivered change; how is the new path recorded? → a new ADR that amends 0003, proposed here and accepted at the plan approval.

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
- AC-1 `forced-merge-recognised`: given a merged pull request of the change whose `check` or `devkit-reviews` is not `SUCCESS` on its head, with the change's tasks unticked on the default branch (the PR 88 facts), `deliver-check.mjs <id>` and `change-loop.mjs next --change <id>` answer a retro step that says `merged by the owner with N items open` (N the real count), never `implement`, `stop-branch`, `verify` or `review`.
- AC-2 `partial-merge-unchanged`: given a merged pull request with unticked tasks and every required check `SUCCESS`, the answer is the `stop-branch` of today ("continue on branch ... open a further pull request"), and every scenario of the `change-delivery` spec for a partial pull request passes unchanged.
- AC-3 `found-after-branch-deleted`: with the change's branch deleted on GitHub and the checkout on the default branch, on another branch or in the change's own worktree, the forced merge is found by the pull request's number or by the merge commit on the default branch, and the answer of AC-1 holds.
- AC-4 `no-gate-ticked`: after the path runs, `tasks.md` on the default branch has the same unticked tasks it had, and `readiness.md`, `reviews/`, `evidence.md` and `approval.md` of the change are byte-identical to before the path.
- AC-5 `open-items-in-retro`: the `retro.md` the path produces lists each open item (each unticked task, each required check not green, each gate without a passing verdict) and says the owner merged with N items open; its `## Proposed updates` section is readable by the retro checker.
- AC-6 `archive-as-delivered`: after the owner's own retro answers, the loop reaches `archive`, `tick-roadmap`, `open-archive-pr` and, when the pull request bumped the release file, `tag-release`, as for a delivered change; no retro answer is written from a file, an agent's report or a turn the owner did not type.
- AC-7 `adr-and-spec-delta`: an ADR with status `proposed` that amends ADR 0003 exists under `docs/adr/` with the next free number on `origin/main` at the last merge, and the `change-delivery` spec delta states the forced-merge scenarios of AC-1 to AC-3; `openspec validate --strict` and `python3 scripts/check.py` pass.
- AC-8 `live-cases-replayed`: the evidence replays the live cases (PR 88 first; PR 91, delivery-train and compozy-driver once merged, otherwise a fixture of their shape) read-only against GitHub, and shows for each the step `next` answers before and after the change; it also shows the partial-merge case of AC-2 unchanged.

## Out of scope

- The devkit hook refusing `gh pr create` while the review is not approved (live case 2): the guard keeps that refusal; opening the pull request for an owner who wants to merge early stays by hand. Noted for the owner as a possible follow-up.
- Merging, auto-merge and `--admin` by any session: `ship-change` and its rules do not change.
- Re-running, ticking or faking the evidence, the review or any gate after the merge.
- A way for the owner to declare a merge final by typed message (not chosen: the owner picked the automatic signal).
- Changes to the review bench, the evidence stage or the plan approval.
