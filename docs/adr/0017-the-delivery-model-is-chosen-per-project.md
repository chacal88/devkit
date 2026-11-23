# ADR 0017: The delivery model is chosen per project, and the two-PR model keeps the test branch out of the task branch

- Status: accepted
- Date: 2026-11-22
- Change: delivery-models
- Amends: ADR 0002 (0002-merge-without-the-owner-opt-in.md), the sentence of its Decision that names `ship: <schema>: merge` as the opt-in; ADR 0003 (0003-auto-merge-the-archive-pr.md), the sentence on who merges the archive PR in `pr` mode; ADR 0010 (0010-openspec-as-the-harness.md), decision 6, which keeps the merge rules of ADR 0002 and ADR 0003 unchanged; ADR 0012 (0012-the-reviews-check-follows-the-change-script.md), decision 1, on what the check judges for a change on a devkit script
- Accepted by: the owner, on 2026-11-22, in the message that approved the plan of the change: `Aprovo` ("I approve"); recorded in `openspec/changes/delivery-models/approval.md`

## Context

ADR 0010 decision 1 puts the delivery model in the project's configuration in round 17, and
decision 5 says that where a driver cannot refuse an action, a GitHub check on the pull request is
the lock. docs/coordination-design.md section 5 decided three models chosen per project: two pull
requests from the same branch, trunk-based, and trunk-based with automatic merge. In the first,
every task branch is cut from the base branch (master or main); one pull request goes to the test
branch (develop) and one to the base branch; the test branch never goes to the base branch, so the
task branch never receives it, not even to solve a conflict. What to do on a conflict was open.

devkit knew only the last two models, as the ship modes pr and merge of ADR 0002, set per schema
in the top-level ship: map. The grill of the change delivery-models (2026-11-21) answered: both
pull requests open together; the owner merges both; on a conflict a support branch
<task-branch>-<test_branch> takes the test branch, and the test-branch pull request comes from
it; the pull request to the base branch stays red until the one to the test branch is merged; the
conflict resolution goes through the review bench again, on the resolution only; the archive
goes to both branches.

## Decision

1. The project chooses its model in openspec/config.yaml as devkit.delivery.model: two-prs,
   trunk or trunk-auto; two-prs also names devkit.delivery.base and devkit.delivery.test_branch.
   Without the key, the ship: map decides as before. With it, every ship: entry must agree
   (pr with trunk, merge with trunk-auto; plan and two-prs agree with none), or the
   configuration is refused. trunk-auto is ADR 0002's merge mode under a second spelling, with
   all of ADR 0002's conditions.
2. In two-prs the base branch is the repository's default branch, every task branch is cut from
   it, both pull requests open together from the task branch, and the owner merges both: devkit
   enables auto-merge on neither, nor on either archive pull request.
3. The test branch never enters a task branch. In the Claude driver a git merge, rebase or pull
   that would bring it into any branch other than the test branch or a branch named
   <name>-<test_branch> is refused, naming the support branch. devkit-reviews, on a pull request
   to the base branch, fails while the head holds a commit of the test branch's first-parent
   history that the base branch lacks, and while no pull request to the test branch from the same
   branch or its support branch is merged. It reads devkit.delivery from the repository's default
   branch (named by the pull request event, else by origin/HEAD), never from the pull request's
   head or from the test branch, and needs pull-requests: read.
4. A conflict with the test branch is resolved on the support branch <task-branch>-<test_branch>,
   cut from the task branch, which alone receives the test branch. The resolution, read as the
   support branch's own work (each merge's difference from Git's automatic merge, and its own
   commits), is reviewed by the two required reviewers before the support branch is pushed; their
   verdicts live in reviews/resolution/. The pull request to the test branch is closed and opened
   again from the support branch. Later commits of the task branch reach it by a merge into the
   support branch.
5. On a pull request to the test branch, devkit-reviews does not judge the delivery contract,
   which the pull request to the base branch carries; from a support branch it judges the
   resolution's verdicts.
6. The change is archived through two archive pull requests, to the base branch from
   chore/archive-<id> and to the test branch from chore/archive-<id>-<test_branch> (cut from the
   test branch, with the same commits); it counts as archived when both branches hold it.

## Consequences

- Positive: a project that tests on a shared branch before the base branch runs the devkit flow
  without carrying the test branch into the base branch; the lock holds in every driver through
  the required check, and the Claude driver refuses the command before it runs.
- Negative: the owner merges four pull requests per change (Accepted: the owner's answer to
  question 2; two-prs is chosen per project). The check now reads GitHub in two-prs and needs a
  wider token (Accepted: read-only, and only two-prs projects need it). A fast-forward push of a
  task branch into the test branch would put the task's commits on its first-parent history and
  fail the check falsely (Accepted: GitHub's merge button never fast-forwards). A cherry-pick of a
  test-branch commit is a new commit and escapes the check (Accepted: the hook does not refuse it
  either; reviewers read the diff). A base branch other than the default branch is not supported
  (Mitigated: the change does not open, and says why).

### Review trigger

A test-branch commit reaches a base branch through a merged pull request that devkit-reviews
passed, a project needs a base branch other than its default branch, or the owner asks for the
test-branch pull request to merge without the owner.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| ship: gains a two-prs value; devkit.delivery holds only the branch names | No second switch | Per schema where D-5 says per project; trunk and trunk-auto would never be written | low |
| The model silently wins over a disagreeing ship: entry | No error | A project would run a model its ship: map denies, with nothing said | low |
| Solve the conflict on the task branch by merging the test branch | One branch | D-5 forbids it: the test branch would reach the base branch | high |
| Rebase the support branch on the test branch | Linear history | Rewrites a pushed branch; the hook refuses force pushes | medium |
| Review the whole difference between the task and support branches | Literal | Holds every commit the test branch gained; no round can read it | low |
| Record the pull request numbers in a file of the change | Readable offline | A second record that drifts from GitHub; the branch names already find both | low |
| Read devkit.delivery from the pull request's head | Simpler | A pull request could switch off the rules it is judged by | low |
| Read devkit.delivery from the pull request's base branch | No default-branch lookup | On a pull request to the test branch it reads the test branch's copy, which lags the base branch's and may name no model, so the test-branch rules would not run | low |
| A fourth downloaded checker file for two-prs | Smaller deliver-check.mjs | Every project moving its pin would break until it edits its workflow | medium |
| Route every default-branch read through the configured base | Any base | Six readers change, and the roadmap and archive would be read from the test branch when it is the default | medium |
| Make the check read ship: (ADR 0012's rejected option) | Fewer runs | Still rejected: the check reads only devkit.delivery, and only for two-prs rules no other model has | low |
