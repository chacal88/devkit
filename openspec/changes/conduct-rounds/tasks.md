# Tasks

Change: `conduct-rounds` · Date: 2026-11-09 · Owner: kaue rodrigues dos santos · Design: [design.md](design.md)

## How to run these phases

- **One run per phase.** Each of phases 1 to 4 is one `devkit-core:tdd-implementer` run.
- **Tests first.** In every task that changes behavior, the tests come first.
- **The gate.** The test command `node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py` runs every hook test, because `guard.test.mjs` imports the other test files (about 6 minutes). Give reviewers its result instead of having them re-run it (CONTRIBUTING).
- **Source files.** Agents dispatched in this change follow the repo's `plugins/*/agents/*.md` and `plugins/*/skills/*/SKILL.md`, not the installed plugins.
- **Paths.** Tests never read this change folder by its active path, because the archive moves it.
- **Plain bullets after merge.** Work that needs the main session's runtime tools, or that can only happen after the merge, is in `## Workflow follow-up` as plain bullets: `deliver-check` item 1 counts every checkbox.

## 1. Hooks in worktrees, the recorded plan approval, roadmap descriptions

- [x] 1.1 Confirm the setup and record the result in the phase report:
  - the branch is `conduct-rounds` (`git branch --show-current`);
  - `openspec status --change conduct-rounds` shows readiness APPROVED;
  - `openspec/changes/conduct-rounds/approval.md` exists in the design D7 form (Workflow follow-up).
- [x] 1.2 Worktree-aware hooks in `plugins/openspec/hooks/guard.mjs` (design D5). Tests first, in `plugins/openspec/hooks/guard.test.mjs`.
  - **Code**:
    - `guardEdit` takes the root from the file's path;
    - new exported `commandSegments(cmd, cwd)`, with `bashWrites` refactored onto it and its output unchanged;
    - `guardBash` checks each write target against its own root and change;
    - `gh pr create` is checked against its segment's `cd` dir.
  - **Fixture**: a real repo whose main checkout is on `main` with no open change, plus `git worktree add .claude/worktrees/feat -b feat` holding an unapproved `devkit` change `feat`.
  - **Refused**, with the hook's `cwd` set to the main checkout:
    - an `Edit` of `<wt>/src/a.ts`;
    - `cd <wt> && echo x > src/a.ts`;
    - `cd <wt> && gh pr create` without reviews.
  - **With readiness APPROVED**: the `tdd-implementer` edit is allowed and the main session's edit is refused.
  - **Regression**: every existing hook test passes unchanged.
- [x] 1.3 `approval.md` has one writer, the main session (design D7). Tests first, in `guard.test.mjs`.
  - `classify` returns a gate with owner `''`.
  - `writeViolation` refuses `change-planner`, `plan-readiness-reviewer` and `tdd-implementer`, by `Write` and by a shell redirect, with the D7 message.
  - The main session (no `agent_type`) is allowed.
- [x] 1.4 `stop-plan-approval` in `plugins/openspec/hooks/deliver-check.mjs` (design D7, AC-5).
  - **Code**: `approvalState(dir)`; `started` and `approval` in `collectState`; the row after `stop-not-approved`; summary `waiting for the owner's plan approval`, exit 1; the `approval` JSON object (`version` stays 1); export `RELEASE_FILE`.
  - **Tests first**, in `plugins/openspec/hooks/deliver-check.test.mjs`, a `devkit` change with readiness APPROVED:
    - no `approval.md` gives `next.step` `stop-plan-approval` with `next.readiness` equal to the sha256 prefix of `readiness.md`;
    - a current `approval.md` gives `implement`;
    - a hash of an earlier `readiness.md` gives `stop-plan-approval` with the "earlier readiness" reason;
    - a ticked task and no approval gives `implement`;
    - `devkit-lite` never gives this row;
    - `--ci` output is unchanged for the existing fixtures.
- [x] 1.5 `plugins/openspec/skills/ship-change/SKILL.md` (design D7, AC-5).
  - **Go-ahead**: names the recorded approval.
  - **Loop**: a `stop-plan-approval` row that writes `approval.md` in the D7 form only after the owner's own message.
  - **Report**: gains `waiting for the owner's plan approval`.
  - **Never**: gains "Write `approval.md` except from the owner's own message".
  - A text test in `guard.test.mjs` pins the row's "owner's own message" sentence and the Never line.
- [x] 1.6 `readRoadmap` keeps `text` and `notes` (design D3). Tests first, in `guard.test.mjs`:
  - `- [ ] a — docs: x` gives `text` `docs: x`;
  - `- [ ] b (after: a) — y` gives `after` `['a']` and `text` `y`;
  - indented lines under an item become `notes`;
  - a line with no description gives `''`;
  - the session roadmap report tests still pass unchanged.
- [x] 1.7 `docs/openspec-flow.md`; `python3 scripts/check.py` passes.
  - "The gates": `approval.md` (main session only) in the roles table; the hooks resolve the root from the target path, so worktrees are gated.
  - "The delivery contract": `stop-plan-approval` and the `approval` object.
  - "Shipping a change": the Go-ahead line.
  - "Limits": CI does not check `approval.md` (design D7).
- [x] 1.8 Gate: `node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py` green; covers AC-4 (the recorded approval for `devkit`), AC-5, AC-12 (approval line)

## 2. `conduct-check`: the round computation

- [x] 2.1 Fixture harness in the new `plugins/openspec/hooks/conduct-check.test.mjs`, imported by `guard.test.mjs`.
  - **Repo**: a bare `origin` with `main`, a clone, `git worktree add` per change, and roadmap and change files committed on `origin/main`.
  - **`gh`**: `ghFor(root)` returns a separate `fakeGh()` per worktree (its own fixture dir). The repo fixture answers `repos/{owner}/{repo}` with `default_branch: main`.
  - **Proof**: a test shows two worktrees reading different `pr-view` fixtures.
- [x] 2.2 Base, roadmap, rounds and worktrees in `plugins/openspec/hooks/conduct-check.mjs` (design D3, D4; AC-8, AC-11). Tests first:
  - the roadmap is read from `origin/main`, not the working tree;
  - the current round is the first with an unticked line;
  - with round 1 fully ticked on `origin/main`, round 2's changes are conducted in the same call (AC-8);
  - every round ticked gives `roadmapDone: true`;
  - `--round 2` skips an unticked round 1 into `skipped`;
  - `--round 9` exits 3;
  - worktree rows, one test each: a worktree found at a non-standard path is reused, with no `worktree`/`create` step (AC-11); a worktree on `chore/archive-<id>` is found; a local branch only gives `worktree` with `git worktree add <path> <id>`; `origin/<id>` only gives `--track`; a folder on `origin/main` gives `-b <id> … origin/main`; nothing gives `create`; a prunable entry is ignored;
  - the creation path is `<main>/.claude/worktrees/<id>` when run from a linked worktree.
- [x] 2.3 Planning rows C1, C2, P-1 to P-5 (design D6; AC-1, AC-4). Tests first, one per row:
  - `devkit`: no `requirements.md` gives `grill` (owner); no `design.md` gives `plan` with `request` = the requirements path; `readiness.md` older than `tasks.md` by more than 2 s (`utimesSync`) gives `readiness`; `NEEDS-REVISION` gives `revise-plan`; `BLOCKED` gives `waiting for the owner: readiness BLOCKED`; APPROVED without `approval.md` gives `approve`; with it, delivery;
  - every new change, `devkit-lite` included, gets `create` as an askable owner row with `proposedSchema` and `reason` (AC-1): a line whose `text` matches a criterion (for example "public contract") is proposed `devkit`, a docs-only line `devkit-lite`, and a line without `text`/`notes` is `devkit` with `text: ''`. A worktree with no change folder gives `new-change`, also askable, with `proposedSchema`;
  - after creation, a `devkit-lite` change with proposal and tasks goes straight to delivery, and no planning row of it is an owner row: `plan` is a subagent row, and no `grill` or `approve` row appears (AC-4);
  - a ticked task skips every planning row.
- [x] 2.4 Dependency rows D-1 to D-5 (design D8, AC-3). Tests first, with `B (after: A)`:
  - while A is unticked on `origin/main`, B's `grill`, `plan`, `readiness` and `approve` rows still come up (early planning), and B's final state is `waiting on A`, never `implement`;
  - after A's tick lands on `origin/main`, B's worktree `HEAD` without the tick gives `rebase`;
  - after a real `git rebase --autostash origin/main` in the fixture, `audit` comes up;
  - `audit.md` `ACCURATE` with a `Base:` that has the tick gives delivery (`implement`);
  - `OUTDATED` gives `revise-plan`; after a plan file is touched, `devkit` B gives `readiness`, then `approve` (hash changed), then `audit`;
  - `UNVERIFIABLE` gives `waiting for the owner: plan audit UNVERIFIABLE`;
  - a rebase left in progress gives `blocked: rebase of B stopped`.
- [x] 2.5 Delivery mapping (design D4, D9 table). Tests first:
  - for each `deliver-check` `next.step` in the table, fed through `deliveryStep`: the actor, the agent name and the final state;
  - in-process `collectState` per worktree with a cleaned env: `DEVKIT_BRANCH=other` in the parent env does not change the worktree's selection;
  - a `deliver-check` error in one worktree gives that change `blocked: <message>` while another change still gets its row.
- [x] 2.6 The three overrides (design D9; AC-6). Tests first, real repos:
  - **Release conflict**: a change PR `CONFLICTING` whose `git merge-tree` conflict is only `CHANGELOG.md` and `.claude-plugin/marketplace.json` gives `resolve-release-conflict` with `paths`; a conflict that also has `README.md` gives `blocked: item 5 (conflict in README.md)`, while an independent change in the same round is still in `dispatch`; an archive PR's P3b conflict on release files only gives `resolve-release-conflict`;
  - **Push-rebased** (design D9 override 2), checked before `deliver-check`'s own rows, against the real `nextStep` order:
    - (a) the state right after `release-rebase`: rebased, release files dirty, `reviews/*.md` with `Commit:` at the old head, PR head = old head (in the branch reflog, not an ancestor of `HEAD`). `deliver-check` alone gives `commit`; `conduct-check` gives `push-rebased` with `oldHead`, the dirty `paths`, and a command using `--force-with-lease=<branch>:<oldHead>`;
    - (b) killed after the commit and before the push: clean tree, same reflog condition, `push-rebased` with empty `paths`;
    - (c) after the force push (fixture PR head = `HEAD`): `review` with every reviewer stale, then `verify`;
    - (d) auto-merge still on: `disable-auto-merge` first;
    - (e) a PR head not in the reflog stays `blocked` "not in local history";
    - (f) the same five on an archive PR (`chore/archive-<id>`, P3c);
  - **Archive serialization**: with A's archive PR open on `chore/archive-A`, B at `archive` reads `waiting on A (archive)`, and B's `retro` is not held.
- [x] 2.7 Dispatch, owner, GitHub, stopped, end and the final states (design D10; AC-2, AC-7). Tests first:
  - two independent changes at `implement` and `plan` both appear in `dispatch` in one result, each with its own `worktree` and a `branch` equal to its id (AC-2);
  - with four runnable changes `dispatch` has 3; with `--busy x` it has 2 and `x` is `running`;
  - `main` steps are not capped;
  - a round with one change of each kind at `end` gives exactly one of the five AC-7 forms per change;
  - A `blocked` makes B `(after: A)` read `waiting on A`, while independent C is dispatched (AC-7).
- [x] 2.8 Wake and watch (design D12; AC-8, AC-9). Tests first:
  - `wake.cron` true when `end` holds and one change waits on GitHub, including when another waits on the owner;
  - false when the roadmap is done (AC-8), when every change waits on the owner or is stopped, and when anything is dispatchable;
  - `wake.prompt` is `/conduct round 5` under `--round 5`, else `/conduct`, and `schedule` is `*/20 * * * *`;
  - `--watch=0.01` with `DEVKIT_POLL_SECONDS=0` returns when a per-call fixture flips a PR to MERGED, and at the cap with `watch.timedOut`;
  - `--watch` on a result that is not `end` does not wait.
- [x] 2.9 CLI and JSON (design D2). Tests first:
  - `--json` prints `version: 1` with the D2 fields;
  - human output has one `<id>: <state>` line per change, then `dispatch:`, `owner:`, `github:`, `wake:`;
  - exit 0 for a report;
  - exit 3 for no `openspec/`, an unreadable default branch, a missing `origin/<base>` (message `git fetch origin <base>`) and an unknown option;
  - the checker never writes: `git status --porcelain` and `.git/refs` are unchanged after a run.
- [x] 2.10 Smoke on real input (retro lesson). In this repository, after `git fetch origin`, run `node plugins/openspec/hooks/conduct-check.mjs --json`. It exits 0 with round 4, `conduct-rounds` found in its existing worktree (no `worktree`/`create` step), and a delivery `next` from `deliver-check`. Record the output in the phase report.
- [x] 2.11 `docs/openspec-flow.md`; `python3 scripts/check.py` passes.
  - New section "Conducting a round: `/conduct`", contract part: the D6, D8 and D9 rows, the states, the worktree rules, the JSON, the watch, `wake`.
  - "Grouping changes: the roadmap": descriptions on lines; `/conduct` enforces `after:` before implement.
- [x] 2.12 Gate: `node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py` green; covers AC-1, AC-2, AC-3, AC-4, AC-6 (classification), AC-7, AC-8, AC-9 (desired state), AC-11, AC-12 (round/next-step computation)

## 3. `release-rebase`: release-file conflicts

- [x] 3.1 Pure functions in the new `plugins/openspec/hooks/release-rebase.mjs` (design D11). Tests first, in the new `plugins/openspec/hooks/release-rebase.test.mjs`, imported by `guard.test.mjs`:
  - `bumpKind` (major, minor, patch, none; a non-semver value throws);
  - `applyBump`;
  - `resolveVersion({ mergeBase, change, base })`: change 0.6.0→0.6.1 over a base at 0.7.0 gives 0.7.1; 0.6.0→0.7.0 over 0.7.0 gives 0.8.0; `none` keeps the base's;
  - `resolveManifest(baseText, versions)` keeps key order and 2-space JSON, and sets each named pack and `metadata.version`;
  - `manifestEditsBeyondVersion` returns `[]` for a version-only edit and the path for a `description` edit;
  - `resolveChangelog({ mergeBase, change, base, version })` takes the change's entry from `change` (not in `mergeBase`), puts it, renumbered, above the base's newest, and keeps every base entry; zero or two new entries, or an edited older entry, throw.
- [x] 3.2 The CLI flow (design D11; AC-6). Tests first, real repos with a bare origin:
  - A's minor bump merged on `main` and B's patch bump on its branch give, after `release-rebase --base main --json`: exit 0, linear history on `origin/main`, pack 0.7.1, `metadata.version` 0.7.1, both CHANGELOG entries, edits uncommitted;
  - B bumping another pack resolves only `metadata.version`;
  - an extra `README.md` conflict gives exit 2, `conflicts` listed, `HEAD` equal to the old head and a clean worktree;
  - during the replay the base's side is kept (`git checkout --ours`, the upstream in a rebase; asserted on the intermediate commit), and the final versions and CHANGELOG entry come from `oldHead` against `git merge-base <oldHead> origin/main`. A case where only `CHANGELOG.md` conflicts still renumbers `plugin.json`;
  - a change that also edits a pack's `description` in a conflicting `plugin.json` gives exit 2 and is back at `oldHead`;
  - a `docs/catalog.md` conflict runs a stub `scripts/gen-catalog.py`, and without that script it aborts with exit 2;
  - a rebase left in progress is aborted and redone;
  - the script never pushes (fake `git` remote unchanged) and never commits after the rebase.
- [x] 3.3 Smoke on real input:
  1. In a scratchpad clone of this repository, make branch A bump `devkit-openspec` to 0.7.0 with a CHANGELOG entry and merge it into the clone's `main`.
  2. Make branch B, from the old `main`, bump `devkit-core` 0.5.0 → 0.5.1 with its own entry.
  3. Run `release-rebase --base main --json` on B.
  4. Check: `devkit-core` 0.5.1, `devkit-openspec` 0.7.0, `metadata.version` 0.7.1, and `python3 scripts/gen-catalog.py --check` exits 0.
  5. Record the output in the phase report.
- [x] 3.4 `docs/openspec-flow.md`, "Conducting a round": the release-conflict part (classification, the version rule, CHANGELOG, catalog, `push-rebased`, stale reviews re-run as ADR 0002 accepts). `python3 scripts/check.py` passes.
- [x] 3.5 Gate: `node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py` green; covers AC-6, AC-12 (release-file conflict classification and resolution)

## 4. The `conduct` skill, ADRs, round 5 and release

- [ ] 4.0 Rebase on the default branch first (design D17).
  - Run `git fetch origin`, then `git rebase origin/main`.
  - If `devkit-opt-in` (or any other change) has landed, merge its overlaps in `guard.mjs`, `guard.test.mjs`, `docs/openspec-flow.md` and `README.md` by hand, keeping both behaviors. If the opt-in check is on `main`, add D5's combination: the opt-in check applies to each target root. Add its test: a worktree of an opted-in project is gated with the session's `cwd` in the main checkout, and a target root that is not opted in is not gated.
  - Record `origin/main`'s devkit-openspec version and `metadata.version` in the phase report for task 4.7.
  - Re-run the phase 1–3 tests before going on.
- [ ] 4.1 Precondition: the runtime smoke in Workflow follow-up is recorded (cron create/list/delete, background subagents with a pending AskUserQuestion, the hook `cwd` observed), and design D12/D14 were amended if it differed. If it is not recorded, stop with `Outcome: failure` naming it. Then write the new `plugins/openspec/skills/conduct/SKILL.md` per design D14: frontmatter, Start, Loop, the planning and delivery rows, owner gates, waits and the reconciliation table, stops, Report, Never. AC-1, AC-2, AC-4, AC-7, AC-8, AC-9, AC-11. Text tests in `guard.test.mjs` pin:
  - "at most three";
  - the worktree preamble;
  - the four reconciliation rows;
  - "only from the owner's own message" for `approval.md` and retro answers;
  - the schema question for every new change, asked before `git worktree add`, `devkit-lite` included;
  - "after that answer, invoking `/conduct` is the go-ahead" for `devkit-lite`;
  - the five report states;
  - "Never dispatch a subagent for a whole change".

  `python3 scripts/check.py` passes (frontmatter, links, language).
- [ ] 4.2 ADR 0005 and the ADR 0001 pointer (design D13; AC-10).
  - Write `docs/adr/0005-parallel-steps-and-a-session-wake-up.md` from the D13 draft. Wording may change, substance may not; a substantive change amends D13 in this phase.
  - Add the pointer note to `docs/adr/0001-coordination-without-a-harness.md`, leaving its Decision unchanged.
  - Red first, in `guard.test.mjs`: a test that fails while ADR 0001 lacks `0005-parallel-steps-and-a-session-wake-up.md`, or while ADR 0005 lacks "at most three" and "every 20 minutes".
- [ ] 4.3 ADR numbering check (design D13).
  - Run `git fetch origin` and `git ls-tree origin/main docs/adr/`.
  - If `0005` is taken on `origin/main` by another change, renumber this ADR and every reference to it (proposal, design, tasks, ADR 0001, docs, tests) to the next free number in this phase.
  - Record the result in the phase report.
- [ ] 4.4 Round 5 for the dogfood (design D15; AC-13, pre-merge part).
  - Add the three D15 lines to `openspec/roadmap.md`, after round 4.
  - Smoke in this worktree: `node plugins/openspec/hooks/conduct-check.mjs --json --round 5` (with the roadmap committed on a scratch ref pointed to by `refs/remotes/origin/main` in a scratchpad clone) reports:
    - round 5 with three changes, each `create`, with its `text`;
    - `conventions-trailer` with `after: ['commit-and-pr-trailer']`;
    - round 4 in `skipped`.
  - Record the output in the phase report.
- [ ] 4.5 Docs.
  - `docs/openspec-flow.md`:
    - "Conducting a round": what the skill runs, the owner gates, background subagents and the fallback, the wake-up and its limits;
    - "Limits": `/ship-change` alone does not enforce `after:`, plus the session cron limits;
    - "Troubleshooting": a stale worktree, a rebase left in progress, deleting a conduct cron;
    - the CI snippet pins the tag of the version set in task 4.7 (`v<metadata.version>`).
  - `plugins/openspec/README.md`: rows for `conduct`, `conduct-check.mjs`, `release-rebase.mjs`; the roles table with `approval.md`; the "Active change" bullet for worktrees.
  - `README.md`: the coordination paragraph names `/conduct` and ADR 0005.
  - `openspec/config.yaml` `context` ADR list adds 0005.
  - `python3 scripts/check.py` passes.
- [ ] 4.6 Regenerate the catalog: `python3 scripts/gen-catalog.py`, then `python3 scripts/gen-catalog.py --check` exits 0.
- [ ] 4.7 Release.
  - Versions are not hard-coded (design D17). devkit-openspec goes one minor above the `origin/main` version recorded in task 4.0, in `plugins/openspec/.claude-plugin/plugin.json` and its `.claude-plugin/marketplace.json` entry. `metadata.version` goes one minor above `origin/main`'s. A test-free check: `git diff origin/main -- plugins/openspec/.claude-plugin/plugin.json .claude-plugin/marketplace.json` shows exactly those two bumps.
  - `CHANGELOG.md`: a `## <new metadata.version> — conduct rounds` entry above the newest entry on `origin/main`, with:
    - the `conduct` skill, `conduct-check` and `release-rebase`;
    - worktree-aware hooks;
    - `approval.md` and the new `stop-plan-approval` stop for `devkit` changes not yet started;
    - ADR 0005.
  - devkit-core is unchanged. `claude plugin validate .` passes.
- [ ] 4.8 Gate: `node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && claude plugin validate .` green; covers AC-1, AC-2, AC-4, AC-7, AC-8, AC-9, AC-10, AC-11, AC-12, AC-13 (pre-merge part)

## Workflow follow-up

- **Before phase 1**:
  - The owner reviews the plan, including ADR 0005 (design D13) and the three Open questions in design.md.
  - Dispatch `devkit-core:plan-readiness-reviewer`.
  - Once readiness is `- Status: APPROVED` and the owner's own message approves the plan, the main session writes `openspec/changes/conduct-rounds/approval.md` in the design D7 form (assumption A6).
  - Product code stays closed until then.
- **Before phase 4 (runtime smoke, main session only, because subagents do not have these tools)**:
  - Create a one-minute recurring `CronCreate` job with prompt `/conduct-smoke-noop`, see it in `CronList`, delete it with `CronDelete`, and see it gone.
  - Dispatch two trivial background subagents and confirm both results arrive while an AskUserQuestion is pending and after it is answered.
  - Record the `cwd` a hook receives for a subagent's `Edit` (assumption A3).
  - Write the results where task 4.1 can read them: a `## Runtime smoke` section appended to `design.md`.
  - If either differs from design D12 or D14, amend the design before phase 4 (CONTRIBUTING).
- **After phase 4**: `review-change` with this bench, each reviewer given the suite's result instead of re-running it:
  - `code-quality-reviewer`;
  - `test-coverage-reviewer`;
  - `architecture-reviewer` (the conduct-check JSON and step contract);
  - `security-reviewer` (the worktree hook change, the `approval.md` writer, force push after a rebase);
  - `adr-reviewer` (ADR 0005 and the ADR 0001 pointer).
- **If `devkit-opt-in` merges while this PR is open** (design D17): `ship-change` reports `blocked: item 5`. The main session rebases this branch on `origin/main` by hand, merges the overlaps, re-applies the task 4.7 version rule, re-runs the gate, and resumes `ship-change`, which re-runs the stale reviews. If this PR merges first, `devkit-opt-in` does the same.
- **Ship**: `ship-change` takes this change to merge in this repository's `merge` mode (installed 0.6.0 or the repo's skill). After the merge, `deliver-check conduct-rounds` reports `merged: archive step retro`. Do not run the retro yet (design D15).
- **Dogfood preconditions** (design D15, R7): this change's devkit-openspec release (task 4.7) is what runs, either because the owner tagged it and updated the plugin, or because the session uses `claude --plugin-dir plugins/core --plugin-dir plugins/openspec` from an up-to-date `main`.
- **Dogfood (AC-13)**:
  - Run `/conduct round 5` until all three round-5 changes are `archived`, with the owner answering only the owner gates.
  - Record the evidence listed in design D15 for the `## Dogfood` section: dispatches with worktree paths, `waiting on`, the rebase, any release conflict, `CronList` before and after, and the final `conduct-check --json --round 5`.
- **Archive this change**: run `ship-change` for `conduct-rounds`: `retro`, the owner's answers, then `## Dogfood` appended to `retro.md` by the main session before `open-archive-pr`, then `archive`, the round-4 tick, and the archive PR merged by GitHub.
- **After the archive PR merges**: the owner creates the release tag (`v<metadata.version>` from task 4.7) on the release commit, if not done for the dogfood.
