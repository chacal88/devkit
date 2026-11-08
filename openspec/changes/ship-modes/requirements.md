# Requirements

Classification: domain=process, type=feature, flags=[architecture, contract] (confirmed)

## Request

The owner, in their words (translated from Portuguese): "I want an option for the flow to go all
the way to a ready PR. Today I keep having to open the PR and push each step myself; I want the
workflow to deliver the PR to me ready." Orchestration (splitting work, advancing steps on its own,
managing state) is wanted; a harness that fights Claude's own runtime is not. It should feel
natural: Claude's own subagents, worktrees and wake-ups, with state kept in files.

This change is round 1 of `openspec/roadmap.md`. Auto-merge, the GitHub setup, the post-merge
archive Action and the multi-change `conduct` skill are later rounds.

## Assumptions

- A new optional key in `openspec/config.yaml`, top level: `ship`, a map from schema name to mode.
  This change ships the modes `plan` and `pr`; `merge` is reserved for round 2 and, until then, is
  rejected with a message naming round 2. Example:
  ```yaml
  ship:
    devkit-lite: pr
    devkit: pr
  ```
- A schema with no entry under `ship`, or a config with no `ship` key, behaves as `plan`: exactly
  today's flow, stopping at every gate.
- The mode applies to both schemas, `devkit` and `devkit-lite`.
- The owner's plan approval stays a human gate in every mode: for `devkit`, the
  plan-readiness-reviewer's `readiness.md` with `- Status: APPROVED`; for `devkit-lite`, the
  owner's explicit go-ahead to apply. Nothing in `pr` mode starts before that.
- A new skill drives one change to a ready PR (working name `ship-change`, in
  `plugins/openspec/skills/`). It is a skill, not a long-running process: every time it runs or
  wakes, it computes the next step from files on disk and GitHub, runs only that step, and repeats.
  Re-running it after an interruption resumes from disk.
- Steps run as subagents of the session the owner typed in: phases through
  `devkit-core:tdd-implementer`, reviews through `review-change`, evidence through
  `devkit-core:pr-verifier`, the PR through `devkit-core:commit-and-pr`. No app session is started
  by the flow (app sessions cannot be started from automated turns; lesson from
  chacal88/orchestrator 0.16.0).
- Phases stay sequential, as `tdd-implementer` requires (phase N never starts before phase N-1's
  gate is checked). In `pr` mode the go-ahead between phases comes from the coordinating skill
  when the phase gate's test command is green and recorded in `evidence.md`, instead of from the
  owner.
- The flow stops and reports the reason, instead of continuing, when: a phase gate is red;
  `tdd-implementer` returns `Outcome: failure` with a stale plan; a reviewer still fails in
  `review-change` round 2; or an item of the delivery contract is blocked by something outside the
  repo.
- The delivery contract ("ready PR") has eight items, each checked from a file or from GitHub:
  1. every task in `tasks.md` checked, every phase gate recorded green in `evidence.md`;
  2. every review in `reviews/<reviewer>.md` says `Verdict: approved` and carries a
     `Commit: <sha>` line equal to the PR head, ignoring commits that only touch `openspec/**`;
  3. every finding in `reviews/*.md` has a disposition: fixed (commit) or refuted with evidence;
  4. every acceptance criterion id has proof in `evidence.md` from `pr-verifier`;
  5. the PR is open and its head equals the local branch head;
  6. the required checks are green on the PR head (`gh pr checks`);
  7. every review thread and every outstanding "changes requested" review on the PR, from people
     or bots, is answered or resolved; people's top-level comments count too; bots' top-level
     comments and review bodies that request nothing (CI, coverage, deploy-preview summaries) do
     not (owner decision 13 below);
  8. the PR body names the change id, lists the acceptance criteria and links the evidence.
- One checker computes the contract (working name `deliver-check`, Node, next to
  `plugins/openspec/hooks/guard.mjs`): given a change id it prints each item as met, open or blocked,
  with the reason, and a JSON form (`--json`). The skill uses it to pick the next step. The CI job
  that consumes it is round 2.
- Reviewers write the `Commit: <sha>` line (item 2) into their verdict file. This changes the
  verdict format of every reviewer agent in `plugins/core/agents/` that writes `reviews/<name>.md`.
- After the PR opens, items 6 and 7 need waiting. In the Claude desktop app, the app's PR Auto-fix
  wakes the coordinating session on CI failure, merge conflict or review comment; the skill then
  runs `deliver-check`, dispatches the fix to `tdd-implementer` (never edits product code in the
  main session), re-runs only the affected reviewers, and checks again. Outside the app, the skill
  runs one `gh pr checks --watch` with a time cap; if the contract is still open it stops with
  "in progress: item N".
- The skill only says "ready" when `deliver-check` reports 8/8. Otherwise it reports "in progress"
  or "blocked: item N".
- `commit-and-pr` keeps stopping at the PR URL and never merges in this change.
- The change to the "no orchestrator" stance is recorded as a new ADR,
  `docs/adr/0001-coordination-without-a-harness.md`: coordination yes; harness no (no long-running
  process, no state outside the repo and GitHub, no driving the app from outside). `README.md`
  "Why no harness" cites it. This creates the `docs/adr/` folder and the `context` line
  `ADRs: none` in `openspec/config.yaml` changes to point at it.

## Acceptance criteria

- AC-1: With no `ship` key in `openspec/config.yaml`, applying a change stops at every phase gate
  and at the PR exactly as today.
- AC-2: With `ship: { devkit-lite: pr }` and an approved plan, one invocation of the skill on a
  `devkit-lite` change runs every phase, the reviews, the evidence and opens the PR without the
  owner typing anything in between.
- AC-3: With `ship: { devkit: pr }`, the skill refuses to start a `devkit` change whose
  `readiness.md` is not `- Status: APPROVED`, and says so.
- AC-4: A red phase gate, a stale-plan failure from `tdd-implementer`, or a reviewer failing in
  round 2 stops the run with a message naming the step and the reason; no later step runs.
- AC-5: Killing the session mid-run and invoking the skill again resumes at the first unfinished
  step, without redoing finished phases or reviews.
- AC-6: `deliver-check <change-id>` prints the eight items, each met, open or blocked with its
  reason, and `--json` prints the same as JSON; it exits 0 only when all eight are met.
- AC-7: A commit to product code after the reviews makes item 2 open, and the skill re-runs only the
  reviewers whose verdict carries the old SHA.
- AC-8: The skill reports "ready" only when `deliver-check` reports 8/8; any open item is reported
  as "in progress" or "blocked: item N".
- AC-9: A red CI on the PR, while the skill runs in the app with Auto-fix on, ends with the fix
  committed by `tdd-implementer`, the affected reviews re-run and the contract checked again;
  outside the app, one capped `gh pr checks --watch` ends in either 8/8 or "in progress: item 6".
- AC-10: `ship: { devkit-lite: merge }` is rejected with a message saying `merge` arrives in a later
  round; nothing merges.
- AC-11: `docs/adr/0001-coordination-without-a-harness.md` exists, `README.md` cites it, and
  `openspec/config.yaml` `context` names `docs/adr/` as the ADR folder.
- AC-12: The test command (`node --test plugins/openspec/hooks/guard.test.mjs && python3
  scripts/check.py`) passes, with tests covering `deliver-check` and the `ship` config parsing.

## Out of scope

- The `merge` mode, `gh pr merge --auto`, the `devkit-reviews` CI check, and `openspec-setup`
  configuring GitHub (round 2: `auto-merge`).
- The post-merge archive Action and the ruleset bypass (round 3: `archive-after-merge`).
- The multi-change `conduct` skill over `openspec/roadmap.md` rounds (round 4: `conduct-rounds`).
- Starting app sessions from the flow; a side panel; any state store outside the repo and GitHub.
- Parallel phases.

## Questions asked

1. [scope] Deliver all five pieces in one change, or in rounds? → Rounds; this change is pieces
   1+2 (`ship` modes up to a ready PR, and the delivery contract).
2. [project rules] README "Why no harness" and 0.3.0's out-of-scope line rule out coordination; how
   to record the change of course? → A new ADR, `docs/adr/0001-coordination-without-a-harness.md`.
3. [edges] After the PR opens, who fixes red CI and answers comments? → In the app, Auto-fix wakes
   the session and the skill fixes through `tdd-implementer`; outside, one capped
   `gh pr checks --watch`.
4. [scope] Does `conduct` (roadmap rounds) belong here? → No, its own later round.

Earlier owner decisions from the explore session: the gate before merge is CI plus reviews green;
auto-merge only for `devkit-lite`; `openspec-setup` configures GitHub; after merge, delete the
branch and archive; archive in a post-merge Action pushing to `main` through a ruleset bypass; the
`pr` mode for both schemas; adopt a verifiable delivery contract. Those beyond this round are
recorded in `openspec/roadmap.md` for their rounds.

## Planning resolutions accepted by the owner

On 2026-11-08 the owner accepted, as a whole, the resolutions the change-planner recorded in
`design.md` for the points this file left ambiguous or that contradicted the code:

1. Phase gate go-ahead: the skill re-runs the gate command and ticks the gate task in `tasks.md`;
   `evidence.md` stays `pr-verifier`'s only (`tdd-implementer.md:59` is corrected).
2. In `pr` mode the skill, not the owner, ticks the phase gate task.
3. A commit-only call to `commit-and-pr` before review, so a reviewer's `Commit:` sha can equal the
   PR head. This changes the order of the flow.
4. `evidence.md` also carries a `Commit:` line.
5. After a fix commit, every reviewer whose `Commit:` is stale re-runs, not only the failed ones
   (cost accepted; mitigations in design risk R3).
6. The disposition format for item 3 and the reading of "answered" for item 7 defined in
   `design.md`.
7. A merge conflict is reported as blocked under item 5; it is not resolved automatically.
8. Inside the app the skill also runs one capped `gh pr checks --watch`, because Auto-fix does not
   wake the session when checks turn green.
9. The `devkit-lite` go-ahead is the owner's message asking to ship or apply the change; resuming
   started work needs no new go-ahead.
10. An acceptance criterion with no proof leaves item 4 not met.
11. `skip_specs: true`, following the roadmap-rounds precedent.
12. New tests in `deliver-check.test.mjs`, imported by `guard.test.mjs`, so the AC-12 command stays
    unchanged.
13. Added 2026-11-08, after readiness round 2: bots' informational top-level comments and review
    bodies (CI, coverage, deploy-preview summaries) are out of item 7, and the skill never posts
    acknowledgements to bots. Bots' inline review threads and their "changes requested" reviews
    still count exactly like a person's. Item 7 above is reworded accordingly.

## Escalations

- None open for this round. Round 3 depends on an unverified assumption: that the GitHub Actions
  app can be a ruleset bypass actor. Verify it when round 3 is planned.
