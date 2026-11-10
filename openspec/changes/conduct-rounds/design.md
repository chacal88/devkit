# Design

Change: `conduct-rounds` · Date: 2026-11-09 · Owner: kaue rodrigues dos santos · Inputs: [requirements.md](requirements.md), [proposal.md](proposal.md) · PRD / tech spec: n/a · Decisions: ADR 0001 `docs/adr/0001-coordination-without-a-harness.md` (exception, pointer), ADR 0002 `docs/adr/0002-merge-without-the-owner-opt-in.md` (unchanged), ADR 0003 `docs/adr/0003-auto-merge-the-archive-pr.md` (unchanged), ADR 0005 `docs/adr/0005-parallel-steps-and-a-session-wake-up.md` (new, drafted in D13)

Paths below are from the repository root and appear in backticks rather than as links, because this folder moves one level deeper when it is archived.

## Context

See proposal.md (Why). What shapes the approach:

- **One change per run today.** `ship-change` resolves one id and loops on `deliver-check <id> --json` (`plugins/openspec/skills/ship-change/SKILL.md`, Loop). `deliver-check` reads one checkout: `findRoot(cwd)`, `locateChange`, `collectState` (`plugins/openspec/hooks/deliver-check.mjs:218`, `:1052`). `main(argv, env, cwd)` and `collectState(root, id, { env, gh })` already take a root and an injectable `gh` (`:1461`, `:1052`). A second module can therefore run it per worktree, in-process.
- **`deliver-check` starts at implement.** With no `tasks.md`, `readPhases` returns `[]` (`:285`) and `nextStep` falls through to `review`/`verify` rows (`:941-1028`). For a `devkit` change without an approved readiness it returns `stop-not-approved` (`:955`). It has no step for creating, grilling, planning or approving a change. It also leaves the owner's plan approval unrecorded: ADR 0001 keeps it a human gate, but nothing on disk shows it was given.
- **The branch selects the change.** `currentBranch` reads `DEVKIT_BRANCH`/`GITHUB_HEAD_REF` first, else `git symbolic-ref` (`:1031-1034`). `branchOk` requires the branch to select the id and not be the default branch (`:1128`). `resolveChange` takes the env override, then the archive branch, then the exact tail, the contained name and the only open change (`plugins/openspec/hooks/guard.mjs:84-98`). A worktree on branch `<id>` therefore works unchanged, provided `DEVKIT_*` is not inherited.
- **The hooks resolve the root from the session's cwd.** `guardEdit` calls `findRoot(input.cwd || dirname(file))` (`guard.mjs:304`), and `guardBash` calls `findRoot(input.cwd)` (`:318`). A subagent of a session started in the main checkout that edits `<main>/.claude/worktrees/<id>/src/x` gets the main checkout as root. `classify` then sees `.claude/...` and returns `exempt` (`:163`), so a worktree's product code would not be gated at all. `gh pr create` is checked against the main checkout's change (`:330`). Parallel steps in worktrees are not safe without fixing this.
- **The roadmap.** `readRoadmap(root)` parses `## ` rounds and `- [ ] <id> (after: a, b)` lines into `{ title, items: [{ id, done, after }] }`, ignoring trailing text (`guard.mjs:340-355`). `roadmapReport` computes the current round, `waiting on`, `open` and `not started` from the local disk (`:357-380`). Ticks land on the default branch only through archive PRs (ADR 0003), so the local default branch is as old as the last pull.
- **Post-merge archive steps** exist (archive-after-merge D4–D9). `archive` creates `chore/archive-<id>` from `origin/<base>`, ticks the roadmap, and opens an archive PR. `stop-archive` covers an archive PR with a merge conflict (`deliver-check.mjs:899`). The change PR's conflict is item 5 `blocked` with `PR #n has merge conflicts with <base>` (`:516`).
- **Release files** are a fixed list, shared by the archive file check: `plugins/<pack>/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `CHANGELOG.md`, `docs/catalog.md` (`RELEASE_FILE`, `deliver-check.mjs:754`).
- **Agents.** `change-planner`, `plan-readiness-reviewer` (writes `readiness.md` with `- Status: APPROVED | NEEDS-REVISION | BLOCKED`) and `plan-reality-auditor` (read-only, returns a table and `Verdict: ACCURATE | OUTDATED | UNVERIFIABLE`) are in `plugins/core/agents/`. `requirements-grill` and `review-change` are skills: the grill asks the owner (AskUserQuestion), and `review-change` dispatches reviewer agents. Subagents can neither spawn subagents nor ask the owner, so both run in the main session. `commit-and-pr` already pushes with `--force-with-lease` when the caller says the branch was rewritten (`plugins/core/agents/commit-and-pr.md:36`).
- **Worktrees here.** `git worktree list` shows worktrees under `.claude/worktrees/<random>` on branches such as `conduct-rounds` and `chore/archive-archive-after-merge`. Their paths are not named after the change. `.gitignore` does not list `.claude/`, but `dirtyPaths` and `changedInTree` already skip `.claude/` (`deliver-check.mjs:157`, `:736`).
- **The test harness.** Real git repositories in tmpdirs (`gitRepo`, `put`, `commitAll`, `deliver-check.test.mjs:27-53`) and a PATH-level fake `gh` answering from JSON fixtures keyed by arguments (`fakeGh`, `:710`). `guard.test.mjs` imports the other test files, so the one test command runs every hook test (about 6 minutes, CONTRIBUTING).
- **The last retro's rules** (CONTRIBUTING): every path that reaches a guarded action gets the check and a test, open and resumed states included (section "Guarded actions" below). An ADR or design text changed by a fix is updated in the same fix commit. Every new checker is smoke-run on real input before its gate is green.

## Goals / Non-Goals

**Goals:**

- One read-only computation, `conduct-check`, answers for the whole round: what each conducted change does next, who does it (a subagent, the main session, the owner, GitHub), and whether a wake-up is wanted. It is testable with fixture repositories, and it reuses `deliver-check` for everything from `implement` to `archived`.
- Every run can be killed and resumed from disk, git and GitHub (AC-11). The only state outside them is the one session cron, which carries a prompt and nothing else.
- Product-code gates apply in worktrees exactly as in a checkout.
- `ship-change` keeps its behavior except the recorded plan approval (AC-5).

**Non-Goals (design level):**

- No new state file outside the change folders. `approval.md` and `audit.md` live in the change folder and are archived with it.
- No approval check in `deliver-check --ci` (D7). No dependency enforcement in `deliver-check` for a single `/ship-change` (D8).
- No automatic resolution of a conflict outside the release files, and no roadmap edits other than the archive tick `ship-change` already makes.
- No change to devkit-core agents or skills. The new prompts are dispatch prompts in the `conduct` skill, as `ship-change`'s fix prompts are today.

## Decisions

### D1. No spec delta (`skip_specs: true`)

Same as every archived change in this repository: there is no `openspec/specs/`. Behavior is pinned by the tests run from `guard.test.mjs` and documented in `docs/openspec-flow.md`. `.openspec.yaml` sets `skip_specs: true`.

### D2. The round computation: `plugins/openspec/hooks/conduct-check.mjs`

A new module beside `deliver-check.mjs`, importing from it and from `guard.mjs`, with no dependencies. It is read-only: it never writes files, refs or GitHub, the same contract as `deliver-check`. Exports, all pure over injected facts or over a root plus an injected `gh` factory:

- `conductState(root, { env, ghFor, round, busy })` → the state below. `ghFor(root)` returns a `gh` runner for a given checkout. The CLI passes `(r) => makeGh(r, env)`, and tests pass a fake `gh` per worktree, each with its own fixture directory.
- `planningStep(change)`, `dependencyStep(change, ticked)`, `deliveryStep(change, report)`: the rows of D6, D8 and D9, one function per table, so each table has its own unit tests.
- `actorOf(step)`: the static map of D9.
- `selectDispatch(changes, busy, cap = 3)`, `wakeOf(changes)`: D10 and D12.

CLI: `node conduct-check.mjs [--json] [--round <n>] [--busy <id,id>] [--watch[=<minutes>]]`, run from any checkout of the repository. Exit 0 with a report, or 3 on a usage or setup error (no `openspec/`, no git, default branch unreadable, `--round` out of range), matching `deliver-check`'s exit 3. A blocked change is a state in the report, not an exit code.

JSON (`version: 1`):

```json
{
  "version": 1,
  "base": "main",
  "round": { "n": 5, "title": "Round 5: conduct test round", "done": 1, "total": 3 },
  "startedAt": 5,
  "skipped": [{ "n": 4, "unticked": ["conduct-rounds"] }],
  "roadmapDone": false,
  "changes": [
    {
      "id": "getting-started-roadmap",
      "round": 5,
      "after": [],
      "text": "docs: docs/getting-started.md shows a roadmap and /conduct",
      "schema": "devkit-lite",
      "worktree": "/abs/repo/.claude/worktrees/getting-started-roadmap",
      "branch": "getting-started-roadmap",
      "next": { "step": "implement", "actor": "subagent", "agent": "devkit-core:tdd-implementer", "phase": 1, "reason": "..." },
      "state": "ready to run: implement",
      "deliver": { "summary": "in progress: item 1", "met": 0, "next": { } }
    }
  ],
  "dispatch": ["getting-started-roadmap", "commit-and-pr-trailer"],
  "owner": [],
  "github": [],
  "stopped": [],
  "busy": [],
  "end": false,
  "wake": { "cron": false, "schedule": "*/20 * * * *", "prompt": "/conduct round 5 --wake" }
}
```

- `next` always carries `step`, `actor` and `reason`, plus the fields the step needs: `deliver-check`'s `next` fields unchanged for delivery steps, and the fields named in D6, D8 and D11 for the others. `worktree`, `branch` and `base` are always on the change, so a dispatch prompt never has to look them up.
- `state` is one of the final states of AC-7 (`archived`, `waiting on <ids>`, `waiting for the owner: <gate>`, `waiting on GitHub: <what>`, `blocked: <reason>`), or, while something can still move, `ready to run: <step>` or `running` (busy).
- `deliver` holds `deliver-check`'s `summary`, `met` and `next` when the change is in delivery, and is `null` otherwise.
- Human output: one line per change (`<id>: <state>`), then `dispatch:`, `owner:`, `github:`, `wake:`.

**Alternative rejected: a `--round` mode of `deliver-check`.** `deliver-check` is the delivery contract of one change. Its JSON and exit codes are consumed by `ship-change` and CI, and it is 1,500 lines. A round is a different question: many changes, many checkouts, actors. Planning rows inside `deliver-check` would also change `ship-change`'s single-change behavior, which requirements.md puts out of scope. **Alternative rejected: computing the round in the skill text.** That is not testable, and ADR 0001 wants "one checker anyone can run".

### D3. The base, the roadmap, the current round

- **Base**: `default_branch` from `readRepoSettings(gh)` (`plugins/openspec/hooks/merge-setup.mjs:60`), one call. Unreadable: exit 3 with the `gh` error.
- **Roadmap on the default branch**: `git show origin/<base>:openspec/roadmap.md` in the root, parsed by `readRoadmap` (extended below). The skill runs `git fetch origin --prune --quiet` before every `conduct-check` call. The checker never fetches, so it never writes to `.git` (same rule as `deliver-check`, `docs/openspec-flow.md` "never writes"). A stale fetch errs on the safe side: an unseen tick only makes a dependent change wait longer. A tick can never appear before it lands. If `origin/<base>` does not resolve: exit 3, `git fetch origin <base>`. **Alternative rejected:** the GitHub contents API, as archive-after-merge D4 does. The rebase check (D8) needs `origin/<base>` locally anyway, and one source for "ticked" and "rebased on" avoids a disagreement between GitHub and the local ref.
- **`readRoadmap` keeps the description** (`guard.mjs:340`). Each item gains `text`: the rest of the line after the id and the optional `(after: …)`, with a leading `—`, `-` or `:` and spaces removed (`''` when none). It also gains `notes`: the following lines indented by at least two spaces, up to the next item or heading, joined with `\n`. Existing fields and the session report are unchanged. Tests cover both forms, and the session report test stays green.
- **Current round**: the first round, in file order, with an unticked item. `--round <n>` (1-based index of `## ` rounds in the file) starts there instead. Earlier rounds with unticked items are listed in `skipped` and never conducted. Once round `n` is fully ticked, the next unticked round after `n` is current. `roadmapDone` is true when no round from the start round onwards has an unticked item, and `round` is then null. `--round` exists for the AC-13 dogfood (D15) and for an owner who wants to name a round explicitly. It never makes a later round start while the run's current round has unticked items (Out of scope: "planning changes of a later round before the current one is done").
- **Conducted changes**: the unticked items of the current round, in file order. An `after:` id that is not a ticked item anywhere in the roadmap keeps its dependent `waiting on <id>`. That includes an id that is missing from the roadmap and one in a skipped round.

### D4. Worktrees: discovery, reuse, creation; `deliver-check` inside each

**Discovery** (every run): `git worktree list --porcelain` in the root, ignoring entries marked `prunable`. A change's worktree is the entry whose `branch` is `refs/heads/<id>` or `refs/heads/chore/archive-<id>`, at whatever path (the session's own worktree included). Branch facts: `refs/heads/<id>` and `refs/remotes/origin/<id>` via `git rev-parse --verify -q`.

**Creation path**: `<main>/.claude/worktrees/<id>`, where `<main>` is the parent of `git rev-parse --path-format=absolute --git-common-dir`. The path is the same whichever worktree the owner typed `/conduct` in.

| Facts | `next.step` | Actor | What the main session runs |
|---|---|---|---|
| worktree found | (planning, D6) | | nothing; reused (AC-11) |
| no worktree, `refs/heads/<id>` exists | `worktree` | main | `git worktree add <path> <id>` |
| no worktree, only `origin/<id>` | `worktree` | main | `git worktree add --track -b <id> <path> origin/<id>` |
| none, and `openspec/changes/<id>/` on `origin/<base>` | `worktree` | main | `git worktree add -b <id> <path> origin/<base>` |
| none of the above | `create` | owner (askable), then main | see D6 row C1 |

`next` carries `path` and `command` (the exact argv) for these rows. The skill runs `git worktree prune` once per run, before discovery. A second worktree or branch per change is therefore never created (AC-11). Tests cover each row, a worktree at a non-standard path, a worktree on `chore/archive-<id>`, and a prunable entry being ignored.

**`deliver-check` inside a worktree**: `buildReport(collectState(worktree, id, { env: clean, gh: ghFor(worktree) }), clean)`. `clean` is `env` without `DEVKIT_CHANGE`, `DEVKIT_BRANCH`, `GITHUB_HEAD_REF`, `GITHUB_BASE_REF` and `DEVKIT_BYPASS`, so the worktree's own branch selects the change (Context). This is in-process, so no subprocess runs per change. `deliver-check` errors (`UsageError`, a throw) become that change's `blocked: <message>`, and the other changes go on. A test sets `DEVKIT_BRANCH=other` in the parent env and proves the worktree's branch still wins.

### D5. Hooks in worktrees: the root comes from the target, not the session

`plugins/openspec/hooks/guard.mjs`:

- **Edit**: `root = findRoot(dirname(resolve(input.cwd || process.cwd(), file)))`, so the nearest ancestor of the file that has `openspec/changes/` is the root. For a file in `<main>/.claude/worktrees/<id>/`, that is the worktree, and `resolveChange(root)` reads the worktree's branch. A file in the main checkout resolves as before, and a file in no OpenSpec tree is not gated, as before.
- **Bash**: a new exported `commandSegments(cmd, cwd)` yields `{ text, dir }` per segment (`&&`, `||`, `;`, newline), tracking `cd <dir>` the way `bashWrites` already does (`guard.mjs:225-246`). `bashWrites` is refactored onto it, with the same output. Each write target is checked against `findRoot(dirname(target))` and that root's change, resolved once per root. `gh pr create` is checked against `findRoot(dir)` of its own segment.
- Unchanged: `gitViolation`, the session hook, `DEVKIT_BYPASS`, and the `ci` mode.
- **With `devkit-opt-in` (D17).** That change makes the hooks act only where `openspec/config.yaml` selects `devkit` or `devkit-lite` (`optedIn(root)`), judged by the session's `cwd`. Combined with D5, the opt-in check is applied to each **target root**: a worktree's root and its own tracked `openspec/config.yaml`. Plugin loading is per session, not per worktree: the hooks a subagent triggers are those of the owner's session. A worktree's `.claude/settings.json` therefore does not decide whether the gates run in it. Its tracked `openspec/config.yaml` does, and a worktree created by `/conduct` from `origin/<base>` (D4) always has the base's. Whichever of the two PRs merges second writes this combination and its test: a worktree of an opted-in project is gated when the session's `cwd` is the main checkout; a target root that is not opted in is not gated.

Tests (`guard.test.mjs`, real repo plus `git worktree add`): a main checkout on `main` with no open change, and a worktree `.claude/worktrees/feat` on branch `feat` whose `devkit` change is not approved. An `Edit` of `<wt>/src/a.ts` with `cwd` = main is refused (today it is exempt). `cd <wt> && echo x > src/a.ts` is refused. `cd <wt> && gh pr create` without reviews is refused. With readiness APPROVED, `tdd-implementer` may edit and the main session may not. Every existing hook test stays green unchanged.

### D6. Planning steps

Computed by `planningStep` for a change with a worktree, before any `deliver-check` row. The schema is read from the worktree's `<change>/.openspec.yaml` (`changeSchemaAt`). Plan artifacts are the schema's artifacts whose `generates:` is a plain file name, except `requirements` and `readiness`, read from `schema.yaml` (devkit: `proposal.md`, `design.md`, `tasks.md`; devkit-lite: `proposal.md`, `tasks.md`). `started` means some task in `tasks.md` is ticked (`parseTasks`). Rows P-5 to P-8 apply only while `!started`. Once work has started, the planning gates were passed: `ship-change` resumes the same way ("Once work has started on disk ... resuming needs no new go-ahead"). First match wins:

| # | Condition | `next.step` | Actor | Fields |
|---|---|---|---|---|
| C1 | no worktree, no branch, no folder on `origin/<base>` | `create` | owner (askable), then main | `path`, `text`, `notes`, `proposedSchema`, `reason` |
| C2 | worktree, no change folder (active or archived) | `new-change` | owner (askable), then main | `proposedSchema`, `reason`, `command: openspec new change <id> --schema <confirmed schema>` |
| P-1 | schema has `requirements`, `requirements.md` missing | `grill` | owner (askable) | `text`, `notes`; the schema was already confirmed at C1/C2, so the grill does not ask it again |
| P-2 | a plan artifact missing | `plan` | subagent `devkit-core:change-planner` | `request` (`requirements.md` path, or `text` + `notes`), `missing` |
| P-3 | schema has `readiness`, and `readiness.md` missing or older than the newest plan artifact by more than 2 s | `readiness` | subagent `devkit-core:plan-readiness-reviewer` | |
| P-4 | readiness `NEEDS-REVISION` (current) | `revise-plan` | subagent `devkit-core:change-planner` | `findings: readiness.md` |
| P-4b | readiness `BLOCKED` (current) | `stop-readiness-blocked` | owner (not askable) | state `waiting for the owner: readiness BLOCKED` |
| P-5 | `devkit`, approval not current (D7), `!started` | `approve` | owner (askable) | `readiness` hash, `file` |
| (D8 rows) | | | | |
| — | otherwise | delivery (D9) | | |

- **The schema is always confirmed (requirements.md "Schema per change"; owner's answer to Open question 1, 2026-11-09: "Perguntar sempre").**
  - **The proposal.** `planningStep` puts `proposedSchema` and a one-line `reason` on C1/C2. It applies the criteria in the `openspec/config.yaml` header comment (new capability, crosses areas, public contract or data model, auth/money/personal data, hard to roll back) to the roadmap line's `text` and `notes`, as keyword matches the main session may override with its own reading. A line with no `text` and no `notes` is proposed `devkit`, the grill's "ambiguous → the strictest track".
  - **The question.** The main session asks the owner with AskUserQuestion (proposed schema first, the reason in the question), for every new change, `devkit-lite` included.
  - **Only then does it create.** It runs `git worktree add -b <id> <path> origin/<base>` and `openspec new change <id> --schema <answer>`, back to back.
  - **For `devkit`**, this question is the grill's first question (requirements.md). The `requirements-grill` skill then continues with its next question (P-1) and does not ask the schema again.
  - **For `devkit-lite`** it is the only owner question before the first `implement` (AC-4): plan, and everything after it up to the retro answers, runs without asking.
- **The answer is recorded by the change folder itself.** Its `.openspec.yaml` `schema:` is the confirmed schema, because nothing is created before the answer. A resumed run therefore never asks again for a change whose folder exists.
  - Killed after the answer and before `git worktree add`: C1 asks again. Nothing was written, so the answer is not on disk.
  - Killed between `git worktree add` and `openspec new change`: C2 asks again, for the same reason.
  - Both are accepted: a lost answer costs one repeated question, and no new state file is introduced (Non-Goals).
  - **Alternative rejected:** a `schema-confirmed` file or an extra key in `.openspec.yaml`. That is another format to parse, and OpenSpec owns `.openspec.yaml`.
- **Freshness by mtime (P-3).** Before the first commit, planning files in a fresh worktree are untracked, and no rebase or checkout touches them (D8 rebases only untracked planning). The 2-second tolerance covers files that git writes in one checkout when a change was planned on the default branch. Tests set mtimes with `utimesSync`.
- **Loops are bounded by the skill.** A third `revise-plan` dispatch for the same change in one run, or the same `next` twice in a row, stops that change as `blocked: no progress at <step>` (the `ship-change` Stops rule).

### D7. Plan approval on disk (resolves the AMBIGUOUS assumption)

**File and form**: `openspec/changes/<id>/approval.md`, written only by the main session, only after the owner's own message approving the plan:

```markdown
# Plan approval: <id>

- Status: APPROVED
- Readiness: sha256:<first 12 hex of sha256(readiness.md bytes)>
- Date: <YYYY-MM-DD>
- Owner's words: "<the owner's message, up to 200 characters>"
```

**Current** means `readValue(approval.md, 'Status') === 'APPROVED'` and the `Readiness:` value equals the hash of the current `readiness.md`. A new readiness round (after a re-plan, D8) changes the file, so the owner is asked again. The approval cannot silently carry over to a plan the owner did not see. **Alternatives rejected:** (a) a line inside `readiness.md`: that file has one writer, the readiness reviewer (`guard.mjs` roles), and it is overwritten every round. (b) A `Status:` line with no hash: a re-planned change would keep an approval of the earlier plan. (c) A git commit or PR comment as the record: it does not exist before the first commit, and a comment is not on disk (ADR 0001).

**`deliver-check`** (`deliver-check.mjs`):

- New export `approvalState(dir)` → `{ status, recorded, readiness, ok }`.
- `collectState` adds `approval` and `started` for schemas that have `readiness`.
- `nextStep` gets a new row right after `stop-not-approved` (`:955`): `needsReadiness && readiness === 'APPROVED' && !approval.ok && !started` → `stop-plan-approval` with `{ readiness: 'sha256:…', file: 'openspec/changes/<id>/approval.md', reason: 'no recorded owner approval' | 'approval.md is for an earlier readiness.md' }`. Summary: `waiting for the owner's plan approval`. Exit 1.
- JSON: `approval` object (additive, `version` stays 1). `--ci` is unchanged.
- The `started` exemption keeps every in-flight `devkit` change whose tasks are already ticked running after the upgrade.

AC-5 tests: APPROVED readiness without `approval.md` → `stop-plan-approval`. With a current `approval.md` → `implement`. With a stale hash → `stop-plan-approval` naming the earlier readiness. With a ticked task and no approval → `implement`. `devkit-lite` → never this row.

**Guard**: `classify` returns `{ kind: 'gate', owner: '' }` for `approval.md`. `writeViolation` allows only the main session (`role()` is `''`) and refuses every subagent with `approval.md is written only by the main session, from the owner's own message; not by <agent>`. Tests: `change-planner`, `plan-readiness-reviewer` and `tdd-implementer` are refused, by `Write` and by a shell redirect. The main session is allowed. This is also how "subagents cannot approve" holds in `/conduct`.

**`ship-change`**: Go-ahead and Loop gain a `stop-plan-approval` row: "Stop. Summarize the plan (proposal's What Changes, design decisions, tasks' phases) and ask the owner to approve it. Only when the owner's own message approves, write `approval.md` in exactly the D7 form with `next.readiness`, then run the loop again. Never write it from your own reading, from a subagent's report or from a cron-started run without the owner's message." Never gains "Write `approval.md` except from the owner's own message". Report gains `waiting for the owner's plan approval`. A test pins these sentences in `SKILL.md`, the precedent being the retro format tests.

**Why not in CI**: the main session writes `approval.md`, so CI could check only that the file exists, not that the owner gave it. That adds nothing to the readiness check CI already makes, and it would fail every open `devkit` PR made before this release. Recorded under Limits in `docs/openspec-flow.md`.

### D8. Dependencies: wait, rebase, audit

Rows of `dependencyStep`, after P-5 and before delivery, applying only while `!started` (once B has started, its dependencies were already met):

| # | Condition | `next.step` | Actor | Fields / state |
|---|---|---|---|---|
| D-1 | an `after:` id not ticked on `origin/<base>` | — | none | state `waiting on <ids>` |
| D-2 | every dep ticked on `origin/<base>`, but the roadmap at `HEAD` of B's worktree (`git show HEAD:openspec/roadmap.md`) lacks a tick | `rebase` | main | `command: git -C <wt> rebase --autostash origin/<base>` |
| D-3 | B has deps, and `audit.md` missing, or its `Base:` commit's roadmap lacks a dep's tick, or a plan artifact newer than `audit.md` by more than 2 s | `audit` | subagent `devkit-core:plan-reality-auditor` | `base` (the sha of `origin/<base>`) |
| D-4 | `audit.md` `Verdict: OUTDATED` (current) | `revise-plan` | subagent `devkit-core:change-planner` | `findings: audit.md` |
| D-5 | `audit.md` `Verdict: UNVERIFIABLE` (current) | `stop-audit-unverifiable` | owner (not askable) | `waiting for the owner: plan audit UNVERIFIABLE` |

- **Early planning (AC-3).** Rows P-1 to P-5 come before D-1, so B's grill, plan, readiness and approval run while A is in progress. Only the delivery rows (from `implement`) wait.
- **"Ticked on the default branch"** is read from the roadmap on `origin/<base>` (D3). The archive PR ticks the line (ADR 0003), so "ticked" means A's archive merged.
- **Rebase (D-2).** Before its first implement B has no product commits: its planning files are untracked, and `--autostash` covers anything tracked. A rebase conflict leaves `rebase-merge/` in the worktree's git dir. `conduct-check` reports that as `blocked: rebase of <id> stopped: resolve or abort it in <wt>`, and the skill runs `git rebase --abort` only when the owner asks. Tests: B's `HEAD` roadmap without A's tick gives `rebase`, and after a real rebase onto an `origin/main` that has the tick, the next row applies.
- **`audit.md`** is written by the main session from the auditor's returned table: `# Plan audit: <id>`, `- Verdict: <ACCURATE|OUTDATED|UNVERIFIABLE>`, `- Base: <full sha>`, `- Date:`, then the table. It is a planning file for the hooks. After `revise-plan`, P-3 re-runs readiness and P-5 asks the owner again for a `devkit` change, because the readiness hash changed. D-3 then re-audits. Requirements: "OUTDATED stops B for re-planning".
- **`/ship-change B` alone** does not check dependencies, as today (`docs/openspec-flow.md` Limits: the roadmap does not enforce order). Only `/conduct` enforces them. That is recorded in Limits.

### D9. Delivery steps: actors and the three overrides

Once planning and dependencies pass, `deliveryStep` takes `deliver-check`'s report from the worktree (D4) and maps `next.step` to an actor. `deliver-check`'s fields are passed through unchanged. The skill does what `ship-change`'s Loop row says (D14).

| `deliver-check` `next.step` | Actor | Final state when not runnable |
|---|---|---|
| `implement`, `fix-review`, `fix-defect`, `fix-checks`, `apply-proposals` | subagent `devkit-core:tdd-implementer` | |
| `commit`, `open-pr`, `push`, `open-archive-pr` | subagent `devkit-core:commit-and-pr` | |
| `verify` | subagent `devkit-core:pr-verifier` | |
| `retro` | subagent `general-purpose` running the `devkit-core:retro` skill | |
| `review` | review (the main session runs `review-change`, which dispatches the reviewers) | |
| `gate` | gate (the main session runs `next.command` in a background Bash) | |
| `edit-pr-body`, `enable-auto-merge`, `disable-auto-merge`, `update-branch`, `archive`, `tick-roadmap`, `answer` | main | |
| `stop-retro-answers`, `stop-plan-approval` | owner (askable) | |
| `wait-checks`, `wait-merge` | github | `waiting on GitHub: <checks \| next.waitingFor>` |
| `ready` (`pr` mode), `archive-pr-ready` | owner (not askable) | `waiting for the owner: merge PR #n` / `merge archive PR #n` |
| `stop-review-deadlock` | owner (not askable) | `waiting for the owner: review deadlock (<reviewers>)` |
| `stop-plan-mode` | stop | `blocked: ship mode plan for <schema>` |
| `stop-branch`, `stop-merge-setup`, `stop-archive`, `blocked`, `stop-not-approved` | stop | `blocked: <summary>: <reason>` |
| `archived` | none | `archived` |

`answer` stays with the main session because `ship-change` already stops it on an owner decision. In `/conduct`, that stop becomes `waiting for the owner: PR decision <url>`.

**Override 1: release-file conflict (AC-6).** When `next` is `blocked` with `item: 5` and the change PR is `CONFLICTING`, or `stop-archive` with `archiveStep: archive-pr` and a conflict reason, `conduct-check` classifies the conflict in the worktree with `git merge-tree --write-tree --name-only --no-messages origin/<base> HEAD`. Exit 1 lists the conflicted paths after the tree line. All paths matching `RELEASE_FILE` (exported from `deliver-check.mjs` for this) gives `resolve-release-conflict` (subagent `devkit-core:tdd-implementer`, fields `paths`, `base`, `command`). Any other path gives `blocked: item 5 (conflict in <paths>)`, or `blocked: archive (archive-pr): conflict in <paths>`. Exit 0 (GitHub's view is stale) gives `update-branch` in `merge` mode, else `blocked` as reported. Git older than 2.38 gives `blocked: item 5 (cannot classify the conflict: git merge-tree --write-tree needs git 2.38)`. `disable-auto-merge` needs no special case: `deliver-check` already returns it first while auto-merge is on (row 0b, P3a).

**Override 2: a branch we rewrote (`push-rebased`).** After `release-rebase`, the PR head is no longer an ancestor of the local head. The working tree also holds the uncommitted renumbering edits (D11 step 6), and every review is stale, because no recorded `Commit:` is an ancestor of the rebased head (`staleness`, `deliver-check.mjs:192`). `deliver-check`'s real order would give `commit` first, whose plain push GitHub rejects as non-fast-forward (`ship-change` `commit` row; `commit-and-pr.md:36` forces only when told). Then it would give `review`, then `verify`, and only then item 5 `blocked` "not in local history" (`nextStep`, `deliver-check.mjs:941-1028`). `conduct-check` therefore checks the rewritten-branch condition **before** taking `deliver-check`'s `next`. The single exception is `disable-auto-merge`, which still comes first.

- **The condition**: an open PR (change PR, or archive PR) whose `headRefOid` is not an ancestor of `HEAD` but appears in `git reflog show --format=%H refs/heads/<branch>`. This branch held that head before our own rebase.
- **The step**: `push-rebased`, dispatched to subagent `devkit-core:commit-and-pr` with `oldHead` and `paths` (dirty paths, possibly none): "The branch was rewritten by a rebase. Commit these files by name if any, then push with `git push --force-with-lease=<branch>:<oldHead> origin <branch>`. No PR edit."
- **Sequence after a release rebase**:
  1. `resolve-release-conflict` (`tdd-implementer`: script plus the test command);
  2. `push-rebased`;
  3. `review` (all reviewers stale; the reviews run on the pushed head);
  4. `verify`;
  5. the normal rows (`push` when there are new commits, `wait-checks`, `enable-auto-merge` at 8/8).
- **Why push before re-reviewing**: the reviewers then review the head GitHub has, the PR stops reporting a conflict, and auto-merge cannot fire in between. It was disabled before the conflict row (row 0b, P3a), and is enabled again only at 8/8, after the new reviews.
- **A foreign push**: a PR head that is not in the reflog means someone else pushed. `deliver-check`'s row stands (`blocked` "not in local history" or P3c).
- **Tests (task 2.6)**: (a) the resumed state right after the script: rebased, release files dirty, reviews recorded at the old head, PR head = old head in the reflog. `deliver-check` alone gives `commit`; `conduct-check` gives `push-rebased` with those `paths`. (b) Killed after the commit and before the push: clean tree, same condition, `push-rebased` with no `paths`. (c) After a simulated force push (PR head = `HEAD`): `review` with every reviewer stale. (d) A foreign head: `blocked`. (e) Auto-merge still on: `disable-auto-merge` first.

**Override 3: archives are serialized.** When `next` is `archive` (P9) and another conducted change has an archive branch (`refs/heads/chore/archive-<x>` with an unmerged archive PR, or an archived folder in its worktree), the state is `waiting on <x> (archive)`. Two archive PRs branched from the same base would tick adjacent roadmap lines, which git reports as a conflict, so `ship-change`'s P3b would stop the second one. Serializing removes that conflict class without resolving roadmap conflicts, which requirements.md puts out of scope. Retro, answers and everything before `archive` still run in parallel.

### D10. The parallel set, the owner gates, the end of a run

- **`dispatch`** lists the conducted changes whose actor is `subagent`, `review`, `gate` or `main`, in roadmap order, excluding `--busy` ids, capped at `3 − |busy|` (requirements.md: at most 3). `main` steps take seconds and are not capped: the skill runs them inline and recomputes. Changes are independent unless linked by `after:`. A change has at most one next step, so two dispatched steps never belong to the same change (AC-2).
- **`owner`** lists the askable gates (`create` and `new-change` for the schema question, `grill`, `approve`, `stop-retro-answers`). The not-askable ones are final states (D9 table). **`github`** lists `wait-*`. **`stopped`** lists `blocked`.
- **`end`** is true when `dispatch`, `owner` and `busy` are all empty: nothing can move without GitHub or the owner. The skill then does one capped watch (D12), recomputes, and ends the run if `end` still holds.
- **AC-7 report**: every change in `changes` has exactly one `state`. At `end`, each state is one of the five final forms. A test builds a round with one change of each kind and asserts the five forms, one per change. A stopped change does not stop the others: its dependents read `waiting on <id>` (D-1), and independent changes keep their rows. A test covers A `blocked` with B `(after: A)` waiting and C dispatched.

### D11. Release-file conflicts: `plugins/openspec/hooks/release-rebase.mjs`

A script with exported pure functions and a CLI, run by `tdd-implementer` in the change's worktree: `node <plugin>/hooks/release-rebase.mjs --base <base> [--json]`.

**Pure functions** (unit tests):

- `bumpKind(from, to)` → `major | minor | patch | none` for `X.Y.Z` (the first field that differs; `none` when equal; an error for a non-semver value).
- `applyBump(version, kind)` → the bumped version (minor resets the patch, major resets both).
Parameter names avoid git's `ours`/`theirs`, which swap meaning during a rebase. `base` is `origin/<base>` now. `mergeBase` is `git merge-base <oldHead> origin/<base>`. `change` is the change's recorded old head (`oldHead`, before the rebase).

- `resolveVersion({ mergeBase, change, base })` → `applyBump(base, bumpKind(mergeBase, change))`, or `base` when the kind is `none`. Example: base moved 0.6.0 → 0.7.0 (another change), change 0.6.0 → 0.6.1 gives 0.7.1. Change 0.6.0 → 0.7.0 gives 0.8.0.
- `resolveManifest(baseText, versions)` for `plugin.json` and `marketplace.json`: takes the base's JSON text and sets each pack's `version` (by plugin `name`) and `metadata.version` to the resolved values, preserving key order and 2-space formatting.
- `manifestEditsBeyondVersion(mergeBaseText, changeText)` → the JSON paths the change edited other than `version` fields and `metadata.version`. A non-empty result means the change edited a manifest beyond its version, for example a description. Taking the base's text would drop that edit, so it is handled like a non-release conflict (CLI step 4).
- `resolveChangelog({ mergeBase, change, base, version })`: entries are `## <semver> — <title>` sections. The change's own entry is the entry of `change` (the `CHANGELOG.md` text at `oldHead`) whose heading is not in `mergeBase`. There must be exactly one, and the change must not edit any older entry. It is renumbered to `version` (the resolved `metadata.version`) and placed above the newest entry of `base`. Every entry of `base` is kept. Zero or several new entries, or an edited older entry, is an error (`cannot place the CHANGELOG entry: ...`).

**CLI flow**:

1. If a rebase is in progress in this worktree (a killed run), `git rebase --abort`.
2. Record `oldHead` (`git rev-parse HEAD`) and `mergeBase` (`git merge-base HEAD origin/<base>`) before rebasing.
3. `git rebase origin/<base>`.
4. At each stop, list conflicted paths (`git diff --name-only --diff-filter=U`). If any is outside `RELEASE_FILE`: `git rebase --abort`, exit 2, JSON `{ resolved: false, conflicts }`. Otherwise keep the **base's side** for every conflicted release file and continue. During a rebase that is git's `--ours` (the upstream being rebased onto, plus the commits already replayed), not `--theirs`, which is the change's commit being replayed. So: `git checkout --ours -- <path>`, `git add <path>`, `GIT_EDITOR=true git rebase --continue`. The change's side is not lost: step 5 reads it from `oldHead`.
5. After the rebase, read each release file three times with `git show`: at `mergeBase`, at `oldHead` (the change's own versions and its own CHANGELOG entry) and at `origin/<base>`. If `manifestEditsBeyondVersion` is non-empty for any manifest, `git reset --keep <oldHead>` (back to the pre-rebase state) and exit 2 as in step 4, naming the manifest. Otherwise compute, with `resolveVersion`, the final version of every pack whose `plugin.json` version differs between `mergeBase` and `oldHead`, and `metadata.version`. Write `plugin.json`, `.claude-plugin/marketplace.json` (`resolveManifest` on the base's text) and `CHANGELOG.md` (`resolveChangelog`). A file the rebase merged without a conflict is rewritten the same way, so the result never depends on which file happened to conflict. If `docs/catalog.md` is a release path and `scripts/gen-catalog.py` exists, run it. Without that script, a catalog conflict is unresolvable and is handled like step 4's abort.
6. Leave these edits uncommitted. Exit 0 with `{ resolved: true, oldHead, newHead, versions, files }`.

The script never pushes and never commits. The subagent then runs the project's test command (the gate re-run required by requirements.md), and `Outcome: failure` on red stops the change. The next recompute gives `push-rebased`, which commits the edits and force-pushes with lease (D9 override 2). Every review is already stale from the rebase itself, so after the push `deliver-check` re-runs `review` and then `verify` on the pushed head. ADR 0002 already accepts that cost for base updates ("Strict up-to-date re-runs stale reviews").

**Tests** (`release-rebase.test.mjs`, real repos):

- Change A bumps pack `a` 0.6.0 → 0.7.0 with a CHANGELOG entry and is merged on `main`. Branch B bumps `a` 0.6.0 → 0.6.1 with its own entry. Result: `a` 0.7.1, `metadata.version` 0.7.1, B's entry `## 0.7.1` above A's `## 0.7.0`, both kept, history linear on `origin/main`.
- B bumps pack `b` only: `metadata.version` conflict resolved, `a` untouched.
- A conflict in `README.md` as well: aborted, exit 2, `HEAD` equal to the old head, worktree clean.
- The change also edits a pack's `description` in a conflicting `plugin.json`: exit 2, back at `oldHead`.
- The base side is kept during the replay (asserted on the intermediate commit) and the change's entry and versions come from `oldHead`: a test where only `CHANGELOG.md` conflicts still renumbers `plugin.json`.
- A catalog conflict with a stub `scripts/gen-catalog.py`: regenerated.
- A rebase left in progress: aborted, then done.
- Several new CHANGELOG entries: error, aborted.

**The bump rule's source**: requirements.md, "Release-file conflicts" (owner-confirmed). The release list is the existing `RELEASE_FILE` (ADR 0003's exempt list), so a consumer repository without these files never takes this path: any conflict there stays `blocked: item 5`.

**Alternatives rejected:** (a) a merge commit instead of a rebase. Reviews go stale either way (`staleness` sees the merge bring product files), and requirements.md asks for a rebase. (b) Resolving by the main session in Bash. The guard sees no write from `node script.mjs`, so the change's own role rules (`tdd-implementer` writes product files in `devkit`) would be bypassed in practice. (c) Rewriting version numbers in prose (for example the `v0.x.0` pin in `docs/openspec-flow.md`). That is not a release file, so a conflict there is a real conflict and stops the change.

### D12. Waiting and the wake-up cron

**One capped watch per run.** `conduct-check --watch[=<minutes>]` (default 9, max 30, the `deliver-check` limits) applies only when `end` holds and `github` is not empty. It polls every `DEVKIT_POLL_SECONDS` (default 60; tests use 0). Each poll recomputes `deliver-check` for the GitHub-waiting changes only, until one of their `next.step` values changes or the cap is reached, then returns the full recomputed report with `watch: { minutes, timedOut }`. Every `gh` call keeps `makeGh`'s 60 s timeout, cut at the remaining cap as `waitForMerge` does (`deliver-check.mjs:1270`).

**Desired state from the checker.** `wake.cron` is true iff `end` holds and `github` is not empty. `prompt` is the invocation that produced the run with a `--wake` marker (`/conduct --wake`, or `/conduct round <n> --wake`), so the skill can tell a cron-started run from the owner's typed one (D14: a `--wake` run is not an owner message and never takes a `devkit-lite` change's first `implement`, nor writes `approval.md` or a retro answer), and `schedule` is `*/20 * * * *` (requirements.md: 20 minutes). When the roadmap is done, or every remaining change waits on the owner or is stopped, `wake.cron` is false (AC-8, AC-9). Tests cover each case, including a round where one change waits on GitHub and another on the owner (`cron: true`: the cron can advance the first).

**The skill reconciles with the runtime** (the checker cannot see crons). At the end of every run, after the watch: call `CronList` and take the jobs whose prompt starts with `/conduct` (the conduct jobs).

| `wake.cron` | Conduct jobs listed | Do |
|---|---|---|
| true | none | `CronCreate` with `schedule`, `prompt`, recurring |
| true | one, same prompt | keep it |
| true | one with another prompt, or more than one | `CronDelete` all, then `CronCreate` one |
| false | any | `CronDelete` all |

The final report says which: `wake-up: cron <id> every 20 minutes` or `wake-up: none`. The runtime fires a session cron only while the session is idle, up to half its period late (up to 10 minutes here), and deletes a recurring job after 7 days; the reconciliation above recreates an expired job on the next run that wants one (Runtime smoke). The skill knows the cron exists only through `CronList`. A session restart drops session crons, and the next `/conduct` recreates one if wanted, so AC-11 holds. A cron firing starts a `/conduct --wake` run that recomputes everything and is not an owner message. Nothing is remembered from the run that created the cron. A test pins the reconciliation table's four rows in `SKILL.md`, and the main session smoke-tests the three tools (create, list, delete a one-minute job) before phase 4 (tasks.md Workflow follow-up), since subagents do not have them.

### D13. ADR 0005 (new, draft below) and the ADR 0001 pointer

**Numbering note.** Another in-flight change already claims `docs/adr/0004`. This change uses **0005**. Whichever of the two PRs lands second renumbers its ADR, and every reference to it, in the same PR if the number is taken by then. It also checks that `docs/adr/` has no duplicate number. A gap is accepted: if this change lands first, `0004` is missing until the other change lands. Task 4.3 carries that check.

The owner chose the exception in the grill (requirements.md, Escalations). It is recorded as ADR 0005, and ADR 0001 gets only a pointer. Written in phase 4 by `tdd-implementer`. Wording may change but substance may not; a substantive change amends this section in the same phase (CONTRIBUTING).

```markdown
# ADR 0005: Conduct a round: parallel step subagents and a session wake-up

- Status: accepted
- Date: <date written>
- Change: conduct-rounds

## Context

This ADR builds on ADR 0001 and makes two exceptions to it; ADR 0002 and ADR 0003 are unchanged.
ADR 0001 lets a coordinating skill recompute the next step from the repository and GitHub and run
only that step as a subagent of the owner's session, and bounds waiting by the session: one capped
watch, then the owner re-runs the skill. A roadmap round holds several changes, some independent,
some ordered by `after:`. Run one at a time, a round costs the owner one go-ahead and one re-run per
change and per wait. The owner chose, in the grill of `conduct-rounds`, to run the steps of
independent changes at once and to let the skill schedule its own re-run.

## Decision

1. A conducting skill may run the next steps of several changes at once, each step a subagent of
   the owner's session, at most three at a time, each in that change's own git worktree on the
   branch named after the change. Each step is still recomputed from the repository and GitHub
   before it is dispatched, and no subagent runs more than one step of one change. Owner gates
   (grill questions, plan approval, retro answers) stay in the owner's session.
2. When everything that can move waits on GitHub after one capped watch, the skill may leave one
   recurring cron job in the same session, every 20 minutes, whose prompt re-runs the skill with a `--wake` marker, which the skill treats as
   not an owner message (it never takes a `devkit-lite` change's first implement, nor writes an approval or a
   retro answer). It
   lists the session's jobs first and keeps at most one; it deletes it when nothing left can be
   advanced by it (roadmap done, or every remaining change waits on the owner or is stopped). The
   job holds no state: each firing recomputes everything.
3. Unchanged: no process outside the session, no starting or driving other sessions or the app,
   no state outside the repository and GitHub other than that one job; the owner's plan approval
   remains a human gate, now recorded on disk by the owner's session.

## Consequences

- Positive: a round goes from `not started` to `archived` with the owner only at owner gates;
  waits on GitHub no longer need the owner to re-run anything while the session is open.
- Negative: the session has to stay open (Accepted: killing it drops the job; running the skill
  again resumes from disk and GitHub). A firing spends tokens every 20 minutes while GitHub is
  slow (Accepted: the job is deleted once it can advance nothing). Parallel steps share one `.git`
  (Mitigated: only the owner's session fetches; a lock error is retried once). The job is state
  outside the repository (Accepted: it carries only the prompt, and the skill finds it by listing
  the session's jobs). The runtime may expire or drop session jobs (Accepted: the report names
  the job, and the owner's next run recreates it).

### Review trigger

A cron-started run takes a step the owner did not expect, a session holds more than one
conducting job, a step subagent runs more than one step, or Claude Code changes session cron
semantics or lets automation start sessions.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| One change at a time with `ship-change` | Nothing new | The owner remains the loop between changes and waits | low |
| One subagent per whole change | Simple dispatch | A subagent cannot ask the owner or spawn reviewers; a lost subagent loses its place | medium |
| The owner re-runs after each wait (ADR 0001 as is) | No runtime state | The round stalls on every GitHub wait | low |
| A Stop hook or a daemon that re-prompts | Unattended | A hidden harness; state outside the session (ADR 0001) | medium |
| A CI job running Claude | Runs without a session | Secrets and cost in CI; a coordinator outside the session | medium |
```

**ADR 0001** (`docs/adr/0001-coordination-without-a-harness.md`): the Decision is unchanged. Under Consequences, after the Negative bullet, add: `- Note: conducting a roadmap round (the next steps of several changes at once, each in its own worktree, and a session cron that re-runs the skill while everything waits on GitHub) is an exception recorded in ADR 0005 (docs/adr/0005-parallel-steps-and-a-session-wake-up.md). This ADR's Decision governs everything else.` A test in `guard.test.mjs` reads ADR 0001 and ADR 0005 (durable paths, not this change folder; archive-after-merge retro item 6). It asserts the pointer and ADR 0005's two decisions (`at most three`, `every 20 minutes`).

**ADR 0002 and 0003** are unchanged. Release conflicts re-run stale reviews as ADR 0002 accepts, and archive PRs keep ADR 0003's gate.

### D14. The `conduct` skill (`plugins/openspec/skills/conduct/SKILL.md`)

The skill is project-agnostic (`docs/conventions.md`: no ADR numbers, no repo-only paths). It names `conduct-check` by its path relative to the skill, `../../hooks/conduct-check.mjs`, as `ship-change` does. Sections:

- **Frontmatter**: `name: conduct`. The description says it conducts every change of the current `openspec/roadmap.md` round, from creation to archive, running independent changes' steps in parallel worktrees and asking the owner only at owner gates. Use when the owner says "/conduct", "conduct the round", "run the roadmap", or when its own wake-up fires.
- **Start**: argument `round <n>` (optional). `git worktree prune`. `git fetch origin --prune --quiet`. Run `node <skill-dir>/../../hooks/conduct-check.mjs --json [--round <n>] [--busy …]`. Exit 3: print `error` and stop. The go-ahead: every new change's schema is confirmed with the owner first (D6). After that answer, the owner typing `/conduct` is the go-ahead for every `devkit-lite` change it conducts; a run started with `--wake` (the cron's prompt) is not, and takes no first `implement` of a `devkit-lite` change. `devkit` changes still go through the grill, readiness and the owner's approval.
- **Loop**: recompute (fetch, `conduct-check`); run every `main` step inline; dispatch every id in `dispatch` at once (subagents in the background, `gate` as a background Bash); ask the first `owner` gate; on each finished step or answered question, recompute. Between two grill questions, handle finished steps first. Never choose the order yourself.
- **Planning rows**: `create` and `new-change` (ask the owner to confirm `proposedSchema` with its `reason`; only after the answer, `git worktree add -b <id> <path> origin/<base>` and `openspec new change <id> --schema <answer>` in the worktree), `worktree`, `grill` (the `requirements-grill` skill in the main session, writing `requirements.md` in the worktree; the schema is already confirmed, so it is not asked again), `plan`/`revise-plan` (change-planner with `request` or `findings`), `readiness`, `approve` (as `ship-change`'s `stop-plan-approval`, D7), `rebase`, `audit` (the auditor's table into `audit.md`, D8).
- **Delivery rows**: "Do what `ship-change`'s Loop says for this `next.step`, in the change's worktree", with five differences. (1) Every dispatch prompt starts with the worktree preamble: "Work only in `<worktree>` on branch `<branch>`; every file path is absolute under it; start every Bash command with `cd <worktree> && `; do not fetch." (2) `wait-checks`/`wait-merge` are not run per change: the round's single watch covers them (D12). (3) A `ship-change` stop sets that change aside with its state and the loop goes on. (4) Overrides: `resolve-release-conflict` (tdd-implementer: "Run `node <skill-dir>/../../hooks/release-rebase.mjs --base <base> --json` in `<worktree>`, then the project's test command; report the JSON and the result; change nothing else") and `push-rebased` (commit-and-pr, D9). (5) `review` runs `review-change` from the main session, scoped as in `ship-change`, with the preamble passed to each reviewer.
- **Owner gates**: AskUserQuestion, one at a time, in the owner's language. Plan approval and retro answers are written only from the owner's own message. A cron-started (`--wake`) run asks too: the question waits for the owner, and it writes no `approval.md` or retro answer.
- **Waits and wake-up**: D12 (one watch per run, the reconciliation table).
- **Stops per change**: `ship-change`'s Stops (red gate, `Outcome: failure`, `stop-*`/`blocked`, the same `next` twice, a third fix dispatch), plus a third `revise-plan`. A stop applies to that change only.
- **Report**: one line per conducted change with its D10 state and schema, then `round: <title> (<done>/<total>)`, `roadmap: done` when it is, `skipped rounds` when `--round` skipped any, and the wake-up line.
- **Never**: dispatch a subagent for a whole change, or more than three steps at once; edit product code in the main session; write `readiness.md`, `reviews/*`, `evidence.md`; write `approval.md` or a retro answer without the owner's message; create a second conduct cron; push to or commit on the default branch; edit roadmap lines (the archive tick is `ship-change`'s); start or drive another session; bypass a hook or a gate.

**Background subagents.** Dispatches use the Agent tool's background mode, so owner questions can be asked while steps run. While an AskUserQuestion is pending, the turn is blocked: running subagents go on, but their results are handled after the answer. If background dispatch is unavailable in the host, the skill dispatches the `dispatch` set in one message (parallel, foreground) and asks owner gates between batches. Both forms satisfy AC-2. The main session smoke-tests the background form before phase 4 (tasks.md Workflow follow-up).

### D15. The round-5 dogfood (AC-13): order and tolerance

- **Round 5 lands with this change.** Phase 4 adds to `openspec/roadmap.md`, after round 4:

  ```markdown
  ## Round 5: conduct test round
  - [ ] commit-and-pr-trailer — commit-and-pr lets the caller's Co-Authored-By trailer win (archive-after-merge retro, item 4)
  - [ ] getting-started-roadmap — docs: docs/getting-started.md shows a roadmap round and /conduct
  - [ ] conventions-trailer (after: commit-and-pr-trailer) — docs: docs/conventions.md states the trailer rule once the fix lands
  ```

  Ids and texts are the planner's choice (owner: "decide routine"); the owner may rename them before phase 4. No id contains another active id (the `contained` branch rule, `guard.mjs:95`).
- **Why `--round`.** After this PR merges, round 4's `conduct-rounds` is unticked until its archive. A plain `/conduct` would conduct it, and its next step is `retro`, which must come after the dogfood. The dogfood therefore runs `/conduct round 5`. `conduct-rounds` is listed in `skipped` and nothing touches it.
- **How the archive flow tolerates it.** During the dogfood, `deliver-check conduct-rounds` reports `merged: archive step retro`, and nothing runs it. Round 5's archive PRs tick round-5 lines and bump versions. `conduct-rounds`' own archive starts later with `ship-change`, whose `archive` step branches `chore/archive-conduct-rounds` from a fresh `origin/<base>` (P9). Its retro (written after the dogfood) gets `## Dogfood` from the main session before `open-archive-pr`, as archive-after-merge did. `retro.md` is under `openspec/changes/**`, which is exempt from the P13 file check.
- **Preconditions**: the devkit-openspec release from this change (its version set in task 4.7, D17) is what runs. Either the owner tags it and updates the installed plugin, or the session is started with `claude --plugin-dir plugins/core --plugin-dir plugins/openspec` from an up-to-date `main`. The worktree-aware hooks (D5) and the conduct skill must be the new ones.
- **What is recorded** in `retro.md` `## Dogfood`: each change's schema and final state, at least one parallel dispatch of two changes with their worktree paths (AC-2), the `waiting on commit-and-pr-trailer` state and the rebase of `conventions-trailer` (AC-3), any release conflict resolved (AC-6), the cron created and deleted (`CronList` before and after, AC-9), and the final `conduct-check --json --round 5`.

### D16. Docs and release

- `docs/openspec-flow.md`:
  - New section "Conducting a round: `/conduct`": what it runs, the planning, dependency and delivery rows (D6, D8, D9), the states (D10), worktrees (D4), release conflicts (D11), the watch and wake-up (D12), the JSON.
  - "Grouping changes: the roadmap": descriptions on lines; `/conduct` enforces `after:` before implement.
  - "The gates": roles table gains `approval.md` (main session only); hooks resolve the root from the target path.
  - "The delivery contract": `stop-plan-approval` and the `approval` object.
  - "Shipping a change": the go-ahead line names the recorded approval.
  - Limits: `/ship-change` alone does not enforce `after:`; CI does not check `approval.md`; session cron limits.
  - Troubleshooting: a stale worktree (`git worktree prune`), a rebase left in progress, removing a conduct cron by hand.
  - The CI snippet pins the tag of this change's release (D17).
- `plugins/openspec/README.md`: rows for `conduct`, `conduct-check.mjs`, `release-rebase.mjs`; the roles table and the "Active change" bullet (worktrees).
- `README.md`: the "Coordination is allowed" paragraph names `/conduct` and ADR 0005.
- `openspec/config.yaml` `context` ADR list: add 0005.
- Catalog: `python3 scripts/gen-catalog.py` (new skill).
- Versions (not hard-coded, D17): devkit-openspec one minor above `origin/main`'s devkit-openspec version, read when phase 4 runs after its rebase (`plugins/openspec/.claude-plugin/plugin.json` and its `.claude-plugin/marketplace.json` entry). Marketplace `metadata.version` is one minor above `origin/main`'s. With `main` as of 2026-11-09 both would be 0.7.0, but `devkit-opt-in` also claims 0.7.0, so the number is read, not assumed. devkit-core unchanged (Goals).
- `CHANGELOG.md`: `## <that metadata version> — conduct rounds`, above the newest entry on `origin/main`.

### D17. The parallel change `devkit-opt-in`

The `devkit-opt-in` change (branch `claude/devkit-opt-in-37291e`, folder `openspec/changes/devkit-opt-in/` in its worktree) is in flight at the same time and overlaps with this change:

- **Release**: devkit-openspec and marketplace 0.7.0, a `## 0.7.0` CHANGELOG entry and a `v0.7.0` CI pin in `docs/openspec-flow.md`.
- **Code and docs**: edits to `plugins/openspec/hooks/guard.mjs` (the opt-in check moves `gitViolation` after `findRoot(input.cwd)`), `guard.test.mjs`, `docs/openspec-flow.md`, `README.md` and the hook description.
- **ADR**: it claims ADR 0004.

Rules:

1. **No fixed numbers.** Phase 4 starts with `git fetch origin` and `git rebase origin/main` (task 4.0). It then sets each version one minor above `origin/main`'s at that moment, the CHANGELOG heading to the new `metadata.version`, and the CI pin to that version's tag.
2. **Whichever PR merges second rebases.** It rebases on `origin/main`, re-reads the versions, and renumbers its versions, CHANGELOG heading, CI pin and (D13) ADR. It merges the overlaps in `guard.mjs`, `guard.test.mjs`, `docs/openspec-flow.md` and `README.md` by hand, keeping both behaviors (D5's combination with the opt-in check included). Then it re-runs the full gate and its stale reviews. For this change, that is a `ship-change` run after the rebase.
   - If `devkit-opt-in` merges while this PR is open, `ship-change` reports `blocked: item 5` (conflict). The main session then rebases this branch by hand (`release-rebase` cannot be used: the conflict includes non-release files), re-applies rule 1, and resumes `ship-change`.
   - This is a one-time manual step for this change, not a `/conduct` feature: `/conduct` keeps non-release conflicts `blocked` (AC-6).

## Guarded actions and every path that reaches them (CONTRIBUTING rule)

| Action | Guard | Paths that reach it | Test |
|---|---|---|---|
| First `implement` of a `devkit` change | approval current (D7) | `/ship-change` (deliver-check row); `/conduct` (P-5 before delivery); resumed with approval for an earlier readiness (hash); resumed after a task is ticked (exempt by design) | deliver-check tests (task 1.4), conduct-check P-5 tests (task 2.3) |
| First `implement` of `B (after: A)` | A ticked on `origin/<base>`, B rebased, audit current | `/conduct` rows D-1 to D-4; resumed after the rebase (D-2 no longer matches); resumed after OUTDATED (re-plan, readiness, approval, re-audit); `/ship-change B` alone (not guarded: documented limit) | task 2.4 |
| `approval.md` written | main session only (guard), owner's message (skills) | `Write`/`Edit`; shell redirect; a subagent of `/conduct`; `ship-change`; several active changes (ambiguous); another change's folder (`openspec/changes/<other>/approval.md`), by `Write` and by shell redirect; a cron-started `--wake` run (D12, D14: not an owner message) | task 1.3 (hook), 1.5 and 4.1 (skill text tests), review fixes (ambiguous and other-folder tests) |
| Product edit in a worktree | readiness and role (guard, D5) | `Edit` with the session's cwd elsewhere; `cd <wt> && >`; `gh pr create` in `cd <wt>`; `gh pr create` after `cd` to a folder with no project (falls back to the session's root) | task 1.2, review fixes |
| Rebase of a PR branch | conflicts only in release files (D9, D11) | change PR open; change PR with auto-merge on (disable first, from deliver-check); archive PR (P3b); resumed with a rebase in progress (abort, restart) | tasks 2.6, 3.2 |
| Force push | PR head in the branch's reflog and not an ancestor of `HEAD` (D9 override 2), checked before `deliver-check`'s `commit`/`review`/`verify` rows | right after `release-rebase` (dirty release files, stale reviews); resumed after the commit but before the push; with auto-merge still on (`disable-auto-merge` first); a foreign push (refused, `blocked`) | task 2.6 |
| `archive` step | no other conducted archive in flight (D9) | first archive; second archive while the first PR is open; resumed with an archive branch present | task 2.6 |
| Parallel dispatch | cap 3 minus busy (D10) | fresh run; run with busy ids; cron-started run | task 2.7 |
| Cron create, keep or delete | `wake.cron` plus the reconciliation table (D12) | run end with GitHub waits; owner and GitHub mixed; roadmap done; every change at an owner gate or stopped; existing job with another prompt; duplicates | tasks 2.8 (checker), 4.1 (skill text), runtime smoke (Workflow follow-up) |

## Implementation plan

### Per surface

- **Hooks (`guard.mjs`)**: root from target path and `cd` (D5); `approval.md` writer (D7); `readRoadmap` text and notes (D3).
- **`deliver-check.mjs`**: `approvalState`, `started`, the `stop-plan-approval` row, summary and JSON (D7); export `RELEASE_FILE`.
- **New `conduct-check.mjs`**: D2–D4, D6, D8–D10, D12.
- **New `release-rebase.mjs`**: D11.
- **Skills**: new `conduct` (D14); `ship-change` gains `stop-plan-approval` (D7).
- **Docs, ADRs, roadmap, release**: D13, D15, D16.

### File structure

- Create:
  - `plugins/openspec/hooks/conduct-check.mjs`
  - `plugins/openspec/hooks/conduct-check.test.mjs`
  - `plugins/openspec/hooks/release-rebase.mjs`
  - `plugins/openspec/hooks/release-rebase.test.mjs`
  - `plugins/openspec/skills/conduct/SKILL.md`
  - `docs/adr/0005-parallel-steps-and-a-session-wake-up.md`
- Modify:
  - `plugins/openspec/hooks/guard.mjs`
  - `plugins/openspec/hooks/guard.test.mjs` (imports the two new test files; hook, ADR and skill-text tests)
  - `plugins/openspec/hooks/deliver-check.mjs`
  - `plugins/openspec/hooks/deliver-check.test.mjs`
  - `plugins/openspec/skills/ship-change/SKILL.md`
  - `plugins/openspec/README.md`
  - `plugins/openspec/.claude-plugin/plugin.json`
  - `docs/adr/0001-coordination-without-a-harness.md`
  - `docs/openspec-flow.md`
  - `README.md`
  - `docs/catalog.md` (generated)
  - `openspec/config.yaml`
  - `openspec/roadmap.md`
  - `.claude-plugin/marketplace.json`
  - `CHANGELOG.md`
- Delete: none.

### Estimate

Optimistic 30 h · likely 42 h · pessimistic 64 h. The dogfood (AC-13) is included at 6 h likely. The pessimistic case is driven by runtime unknowns (background subagents, cron) and by release conflicts during the dogfood.

### Effort

| Component | Hours | Type | Risk |
|---|---|---|---|
| Hooks: worktree roots, `commandSegments`, tests (D5) | 4 | Core | MEDIUM |
| `approval.md`: guard writer, deliver-check row, JSON, tests (D7) | 3 | Core | LOW |
| `readRoadmap` text/notes, tests (D3) | 1 | Core | LOW |
| `ship-change` approval rows and text test | 1 | Documentation | LOW |
| `conduct-check`: base, roadmap, rounds, `--round`, worktree discovery (D3, D4) | 4 | Core | MEDIUM |
| `conduct-check`: planning rows, mtime freshness (D6) | 3 | Core | MEDIUM |
| `conduct-check`: dependency rows, rebase, audit (D8) | 3 | Core | MEDIUM |
| `conduct-check`: delivery mapping and three overrides (D9) | 4 | Core | HIGH |
| `conduct-check`: dispatch, states, wake, watch, CLI/JSON (D10, D12) | 4 | Core | MEDIUM |
| `conduct-check` fixture harness (bare origin, worktrees, per-root fake gh) | 3 | Testing | MEDIUM |
| `release-rebase`: pure functions and CLI, tests (D11) | 5 | Core | MEDIUM |
| Smoke runs on real input (conduct-check, release-rebase, cron, background) | 2 | Testing | MEDIUM |
| `conduct` skill (D14) and its text tests | 3 | Core | MEDIUM |
| ADR 0005, ADR 0001 pointer, test (D13) | 1 | Documentation | LOW |
| Docs, roadmap round 5, catalog, release (D15, D16) | 3 | Documentation | LOW |
| Dogfood AC-13 and the `## Dogfood` record | 6 | Integration | HIGH |

### Risks / Trade-offs

| # | Risk | P × I | Mitigation |
|---|---|---|---|
| R1 | Background subagents or their interplay with AskUserQuestion behave differently than assumed | MEDIUM × MEDIUM | Runtime smoke by the main session before phase 4 (tasks.md Workflow follow-up); the foreground-batch fallback in D14 still meets AC-2 |
| R2 | Session cron semantics (fires only when idle, recurring expiry, prompt form) differ | MEDIUM × MEDIUM | Runtime smoke of create, list and delete before phase 4 (Workflow follow-up); the skill finds jobs only through `CronList`; ADR 0005 accepts a dropped job |
| R3 | The root-from-target change regresses an existing gate | LOW × HIGH | Every existing hook test unchanged and green; new tests for the worktree cases (task 1.2) |
| R4 | Concurrent git operations on one `.git` hit lock errors | MEDIUM × LOW | Only the main session fetches; subagents are told not to fetch; one retry on `index.lock`/ref lock errors (skill text) |
| R5 | A release rebase makes every review stale | HIGH × MEDIUM | Accepted as in ADR 0002; scoped re-review by `deliver-check` |
| R6 | mtime freshness misfires after a checkout | LOW × MEDIUM | 2 s tolerance; applied only before the first ticked task; tests with `utimesSync` |
| R7 | The dogfood runs installed 0.6.0 hooks and skills | MEDIUM × HIGH | Precondition in D15 and Workflow follow-up (tag and update, or `--plugin-dir`) |
| R8 | Token cost of three parallel steps and a 20-minute cron | MEDIUM × LOW | Cap 3; cron deleted as soon as it can advance nothing; report names it |
| R9 | `gh` call volume during the watch | LOW × LOW | Poll every 60 s; only GitHub-waiting changes recomputed |
| R10 | A pending owner question blocks the turn, so finished steps queue | HIGH × LOW | Between grill questions the skill handles finished steps; documented in D14 and the flow doc |
| R11 | Every new change starts with an owner question, so a round cannot start unattended | HIGH × LOW | The owner's choice (Open question 1); one question per change, asked as soon as the round starts, while other changes' steps run |
| R12 | Parallel changes conflict outside release files | MEDIUM × MEDIUM | That change stops as `blocked: item 5`; others continue (AC-6) |
| R13 | Archive PRs of parallel changes conflict on roadmap ticks | HIGH × MEDIUM | Archives serialized (D9 override 3) |
| R14 | The ADR number collides with the other in-flight change | HIGH × LOW | D13 numbering note; task 4.3 checks `docs/adr/` before the gate |
| R15 | `devkit-opt-in` and this change both release 0.7.0 and edit `guard.mjs`, `guard.test.mjs`, `docs/openspec-flow.md`, `README.md` | HIGH × MEDIUM | D17: versions read from `origin/main` after a rebase at phase 4 start; whichever PR merges second rebases, renumbers and merges the overlaps by hand, then re-runs the gate and stale reviews |
| R16 | `release-rebase` keeps the wrong side or drops a change's manifest edit | MEDIUM × HIGH | Base side by `--ours` during the replay, change side read from `oldHead` (D11); a manifest edited beyond its version aborts; tests on the intermediate commit |

### Assumptions

- A1: Claude Code offers session cron tools `CronCreate` (cron expression, prompt, recurring), `CronList` and `CronDelete` to the main session, and a job fires its prompt into the same session when idle. Source: the owner's grill choice (requirements.md); verified by the runtime smoke (tasks.md Workflow follow-up).
- A2: The Agent tool can run subagents in the background, and a hook's `agent_type` names the subagent. Source: `guard.mjs:12-18` (roles); verified by the runtime smoke. If background mode is missing, see the D14 fallback.
- A3: Hooks receive the session's `cwd`, not the subagent's working directory. Source: `guard.mjs:304`, `:318`. D5 removes the dependency either way; the runtime smoke records the observed `cwd` for the record.
- A4: git ≥ 2.38 for `merge-tree --write-tree`. Source: `git --version` 2.50.1 here; older git is reported as `blocked`.
- A5: The only conflicts expected between parallel changes in this repository are release files. Source: the release convention in `openspec/config.yaml` `context` and the three previous rounds' diffs.
- A6: The owner's plan approval of this change is recorded in `openspec/changes/conduct-rounds/approval.md` in the D7 form, by the main session, after readiness is APPROVED (Workflow follow-up). The installed 0.6.0 does not read it. It is the format's first real instance.

### Dependencies

- `archive-after-merge` (archived, `openspec/changes/archive/2026-11-09-archive-after-merge/`): archive steps, `chore/archive-<id>`, `RELEASE_FILE`, `readRetro`.
- `auto-merge` (archived): `merge` mode, `makeGh`, `readRepoSettings`, `waitForMerge` limits.
- `ship-modes` (archived; roadmap `after: ship-modes`): `deliver-check`, `ship-change`.
- ADR 0001 (exception via ADR 0005), ADR 0002 (stale-review cost), ADR 0003 (archive PR gate).

## Migration Plan

- Additive for consumers. The one behavior change: a `devkit` change with APPROVED readiness and no ticked task now stops at `stop-plan-approval` under `ship-change` until the owner approves. The CHANGELOG states it, and in-flight changes with ticked tasks are unaffected.
- Rollback: revert the PR. No data or GitHub settings change. A conduct cron in a running session is removed with `CronDelete` or by ending the session. Worktrees under `.claude/worktrees/` stay and can be removed with `git worktree remove`. `approval.md` and `audit.md` files are inert without this release.

## Open Questions

None open. The owner answered the three planning questions with the plan approval on 2026-11-09:

1. **AC-1 versus AC-4 for `devkit-lite`.** **Answered: "Perguntar sempre"** (always ask). `/conduct` confirms the proposed schema of every new change with the owner, `devkit-lite` included, as the change's first owner question: the grill's first question for `devkit`, one schema-confirmation question for `devkit-lite`. After that answer, a `devkit-lite` change gets no further owner question before its first `implement`. AC-1, AC-4 and the "Schema per change" and "Go-ahead for devkit-lite" assumptions in requirements.md were reworded to match; implemented by D6 rows C1/C2.
2. **`/conduct round <n>`.** **Answered: confirmed** as designed (D3, D15). It is an explicit owner argument to start at a named round, so the AC-13 dogfood does not run `conduct-rounds`' own retro early. It never starts a later round while the run's current round is open.
3. **Archive serialization (D9 override 3).** **Answered: confirmed** as designed. The archive steps of conducted changes run one at a time, instead of resolving adjacent roadmap-tick conflicts.

## Runtime smoke

Run by the main session on 2026-11-09, before phase 4 (tasks.md Workflow follow-up), in the Claude Code desktop app (`host: app`), devkit-openspec 0.6.0 installed.

- **Cron (D12).** `CronCreate` with cron `*/20 * * * *`, prompt `/conduct-smoke-noop`, recurring: returned job `6dc81667`, "Every 20 minutes", next run listed, "Session-only (not written to disk, dies when Claude exits). Auto-expires after 7 days". `CronList` listed it as `6dc81667 — Every 20 minutes (recurring) [session-only] ...: /conduct-smoke-noop`. `CronDelete 6dc81667` → "Cancelled job"; `CronList` → "No scheduled jobs". A 20-minute schedule was used instead of one minute so the job could not fire into the session during the smoke; create, list and delete behave the same. Facts from the tool's contract that D12 must account for: jobs fire only while the session is idle; a recurring job runs up to 50% of its period late (here up to 10 minutes); recurring jobs auto-expire after 7 days (they fire once more, then are deleted). D12's reconciliation already covers expiry (a missing job is recreated by the next run that wants one); D12 is amended below with the jitter and expiry.
- **Background subagents with a pending question (D14).** Two background subagents were dispatched in the same message as an `AskUserQuestion`. The owner answered within seconds, before either subagent finished; both results then arrived as task notifications after the answer, in later turns, while the main session was idle. Delivery while a question is pending was therefore not observed; D14's statement ("running subagents go on, their results are handled after the answer") is consistent with what was seen. Subagents may not run a foreground `sleep N; ...` chain (the harness refused it; the subagent re-ran it as a background Bash), so no step may rely on a subagent sleeping.
- **Working folder (A3, D5).** A subagent's Bash reported `pwd` and `git rev-parse --show-toplevel` = the session's worktree (`.../orquestradores-openspec-sessoes-bfb4bd`, branch `conduct-rounds`). A `cd <dir> && ... && pwd` printed `<dir>`, and the next Bash call's `pwd` was back at the session's folder: a `cd` does not persist between a subagent's Bash calls. So a subagent's tools, and the hooks that see them, start from the session's working folder, not from the change's worktree. This confirms A3 and the need for D5 (root from the edited file's path and from a command's own `cd`); no design change.
