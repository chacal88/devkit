# Design

Change: `archive-after-merge` · Date: 2026-11-09 · Owner: kaue rodrigues dos santos · Inputs: [requirements.md](requirements.md), [proposal.md](proposal.md) · PRD / tech spec: n/a · Decisions: ADR 0001 `docs/adr/0001-coordination-without-a-harness.md`, ADR 0002 `docs/adr/0002-merge-without-the-owner-opt-in.md` (note, D10), ADR 0003 `docs/adr/0003-auto-merge-the-archive-pr.md` (new, drafted in D10)

Paths below are from the repository root and appear in backticks rather than as relative links, because this folder moves one level deeper when it is archived (auto-merge retro, learning 5).

## Context

See proposal.md (Why). What shapes the approach:

- **`merged` is the last step today, and only in `merge` mode.** `nextStep` returns `merged` when item 5 reports `details.merged` (`plugins/openspec/hooks/deliver-check.mjs:653`). Item 5 is `met` for a MERGED PR only when `merge` is set and the PR head equals the local head (`:448-451`); in `plan`/`pr` modes a MERGED PR is `blocked` (`:452`), pinned by the `prItem` unit tests (`plugins/openspec/hooks/deliver-check.test.mjs:820`, `:1576`, which stay valid because `prItem` itself does not change) and by the collector/CLI test `:1894` (which this change rewrites), and documented (`docs/openspec-flow.md:194`). AC-1 changes this for `pr` mode.
- **The PR is found from the current branch.** `fetchPr` runs `gh pr view` and, only in `merge` mode, falls back to `gh pr list --head <branch> --state all` when the branch's PR is gone (`deliver-check.mjs:410-424`). After a merge the archive work happens on another branch (the default branch, or the archive branch), so the change PR can no longer come from the current branch alone.
- **Items 1–4 read the local change folder and the staleness rule.** `tasksItem` blocks when `openspec/changes/<id>/tasks.md` is missing (`:283`). `staleness` needs each recorded `Commit:` sha to be an ancestor of `HEAD` (`:201`). After a squash merge, on the default branch or on a branch made from it, the reviews' shas are not ancestors, so every review would read as stale. Once the folder has moved, `tasks.md` is not there at all.
- **An archived change is an unknown change.** `main` exits 3 when `openspec/changes/<id>/` does not exist: "archived changes do not count" (`:1068-1071`). `changeSchema` reads `openspec/changes/<id>/.openspec.yaml`, else the project's default schema (`plugins/openspec/hooks/guard.mjs:100-107`). For an archived `devkit` change in a `devkit-lite` project it would therefore return the wrong schema and the wrong `ship` mode. AC-6 needs `deliver-check <id>` to answer after the archive.
- **The local checkout can be behind GitHub.** GitHub merges on its own in `merge` mode, and the owner merges in `pr` mode. Nothing in the session pulls. `origin/<default>` is as old as the last fetch.
- **The `devkit-reviews` check on an archive PR (requirement R-3 of auto-merge).** `selectCiChange` (`deliver-check.mjs:971-996`) tries, in order: the argument or `DEVKIT_CHANGE`; then the branch, as an active change equal to the branch's last segment or contained in the branch name (`:980-986`); then, with `GITHUB_BASE_REF`, the active changes whose folder the PR diff touches (`:987-992`, `touchedChanges` `:956-966`); else nothing (pass with a note, `:1030-1033`). On an archive PR the folder has moved, so `<id>` is no longer active at the PR head. `touchedChanges` maps `openspec/changes/<id>/…` to `<id>`, which is not active, and `openspec/changes/archive/…` to `archive`, which `activeChangeNames` excludes (`:952`). Result: no change, pass with the note. Checked on real input: the `devkit-reviews` run of archive PR #6 (branch `archive-auto-merge`) printed `devkit-reviews: no change selected by branch archive-auto-merge or touched by this PR; nothing to check` (run 42648882342), and `gh pr checks 6` shows it green. **One gap:** the "contained in the branch name" rule (`:983`) picks any other *active* change whose name occurs in the archive branch name. With branch `chore/archive-auto-merge` and an open change `merge`, for example, CI would check `merge` and fail the archive PR. D2 closes it.
- **The hooks have the same rule.** `resolveChange` (`guard.mjs:84-98`) also falls back to "the only open change" (`:96`). On an archive branch whose change has moved, with exactly one other open change, the `gh pr create` hook would apply `prViolation` (`:266-276`) to *that* change and refuse the archive PR. With several open changes it refuses with "several active OpenSpec changes". Product edits on the archive branch would be gated by the other change's readiness (`writeViolation`, `:187-196`).
- **The retro proposes and never writes** (`plugins/core/skills/retro/SKILL.md:36-40`, `:63`). Its output format (`:42-59`) has `## Proposed updates` with one `### <target file> (<kind>)` block per proposal, and no place for an answer. Precedent: `openspec/changes/archive/2026-11-09-auto-merge/retro.md` has four proposals, one of them aimed at "plugins/core/agents/adr-reviewer.md and the other reviewers". The heading text is free prose today.
- **`commit-and-pr` needs a review statement** (precondition 3, `plugins/core/agents/commit-and-pr.md:24`) and, for a PR that closes a change, a body with every AC and the evidence link (`:40`). Neither fits an archive PR. It never merges and never enables auto-merge (`:63`).
- **`openspec archive <id> --yes`** (OpenSpec 1.16.1) moves the folder to `openspec/changes/archive/<YYYY-MM-DD>-<id>/`, honours `skip_specs`, does not refuse unticked tasks, and with `--json` prints `archive.archivedAs`. A second run exits 1 with `archive_change_not_found`. Checked in a scratch repository on 2026-11-09.
- **Precedent archive PRs** used the branches `chore/archive-roadmap-rounds` (#2), `chore/archive-ship-modes` (#4) and `archive-auto-merge` (#6), titles `chore(openspec): archive <id> with its retro` (#6 added ` (0.5.1)` because it bumped versions), and carried the retro, the approved proposals, the version bumps and the roadmap tick in one squash commit (`git show --stat dac9784`).
- **GitHub today** (read 2026-11-09): ruleset `devkit` #26859494 `enforcement: active`, `bypass_actors: []`, `current_user_can_bypass: never`. `github-setup.mjs` already treats a ruleset with bypass actors as `update` (`plugins/openspec/skills/openspec-setup/scripts/github-setup.mjs:115`, test `github-setup.test.mjs:140`).
- **The auto-merge retro's lessons**, applied here: every external call goes through the shared `gh` runner with its timeout (`makeGh`, `plugins/openspec/hooks/merge-setup.mjs:27-39`, 60 s) and reads every page or states its cap; a cross-pack format is stated once and pinned by a test on the producer's text; the design is amended in the same phase when an implementer resolves a note differently; a new checker is smoke-run on real input before its gate is green; reviewers get the suite's result instead of re-running it.

## Goals / Non-Goals

**Goals:**

- One source of the next step after the merge: `deliver-check`, recomputed from the working tree, the default branch as GitHub reports it, and the archive PR (ADR 0001).
- Every archive step can be killed and resumed. The owner is asked once per proposal, and the answers survive a killed session in the same checkout.
- The archive PR gets through the same ruleset as every PR. There is no bypass, and nothing is pushed to the default branch.
- `plan` mode is unchanged. The `pr`-mode change PR loop is unchanged until the PR is MERGED.

**Non-Goals (design level):**

- No new state file. The answers live in `retro.md`, which is part of the change and is archived with it.
- No veto hook on `git push` to the default branch. The ruleset refuses it, and `commit-and-pr` refuses the default branch (precondition 1). This is the same split as auto-merge D9.
- No archiving of a change whose PR was not found as MERGED (D4), and no archiving in `plan` mode.
- No automatic conflict resolution on the archive PR; a conflict stops the run.

## Decisions

### D1. No spec delta (`skip_specs: true`)

Same as `openspec/changes/archive/2026-11-09-auto-merge/` (its D1) and the two earlier rounds. The repository keeps no canonical specs, so behavior is pinned by the tests run from `guard.test.mjs` and documented in `docs/openspec-flow.md`. `.openspec.yaml` sets `skip_specs: true`, and proposal.md's Capabilities carries the same comment form.

### D2. The archive branch: `chore/archive-<id>`, one rule for hooks, CI and the checker

**Name.** `chore/archive-<id>`, as precedent PRs #2 and #4 (#6 used `archive-<id>`). The `chore/` prefix matches the commit type, and `archive-` makes the branch's purpose readable.

**Rule.** New export in `guard.mjs`: `archiveBranchChange(root, branch)`. It returns `<x>` when `branch` matches `^chore/archive-(.+)$` and `<x>` is a known change: active (`openspec/changes/<x>/`) or archived (`openspec/changes/archive/<YYYY-MM-DD>-<x>/`, exact id after the date prefix, as `guard.mjs:350-352` already parses). Otherwise it returns null, so an unrelated branch that happens to start with `chore/archive-` is resolved as today. Its three users:

| User | Today | With the rule |
|---|---|---|
| `resolveChange` (`guard.mjs:84-98`), used by the edit, bash and session hooks | tail, contained name, then the only open change | an archive branch selects `<x>` while `<x>` is active, and **nothing** (`null`, outside the flow) once `<x>` is archived. It never falls back to the contained-name rule or to the only open change |
| `selectCiChange` (`deliver-check.mjs:980-986`) | branch tail or contained name | an archive branch selects `<x>` only while `<x>` is active, else skips the branch rules and goes on to the touched-folders rule (`:987`), which finds nothing on an archive PR → pass with the note |
| `deliver-check` change mode (D4) | — | the archive branch is never taken for the change branch when looking for the change PR |

`archiveBranchChange` is also how the id is found on a resumed run: once the folder has moved, `resolveChange` returns null on `chore/archive-<id>`, but the branch name still carries `<id>`. `ship-change` Start reads it from there (D9).

Before `openspec archive` runs, the archive branch selects the change itself. Edits are then gated by its own approved readiness, in the `devkit` schema by `tdd-implementer`, which is the agent D9 uses. After the move, the hooks gate nothing on that branch, as for any work with no open change (`guard.mjs:26-28`). The `gh pr create` hook therefore never applies another change's review gate to the archive PR. **This is how the archive PR passes `devkit-reviews`:** a PR that selects no change passes with a note (auto-merge R-3), and with this rule that holds even while other changes are open.

Alternatives rejected: (a) `archive-<id>` (#6). It contains `<id>`, and an open change whose name is a substring of `<id>` hits the same gap. (b) Having CI skip any PR whose diff only adds `openspec/changes/archive/` paths. The archive PR also carries approved proposals that touch product files, so "only archive paths" is false for most of them. (c) Leaving the gap open. It is cheap to close now, and round 4 will run several changes at once.

### D3. Locating a change, active or archived

New `locateChange(root, id)` in `deliver-check.mjs`. It returns `{ dir, archived: false }` for `openspec/changes/<id>/`, or `{ dir, archived: true }` for the newest `openspec/changes/archive/<YYYY-MM-DD>-<id>/` (exact id), or null. `main` (`:1068-1071`) accepts either form. It still exits 3 for null, and the message becomes `unknown change "<id>": no openspec/changes/<id>/ and no openspec/changes/archive/<date>-<id>/ in this checkout; switch to the default branch and pull, or to the change's branch`. The schema is read from `<dir>/.openspec.yaml`, through a `changeSchema` variant that takes the folder. `--ci` keeps counting only active changes: an archived change has nothing for CI to check.

### D4. Detecting "merged, not archived": the post-merge phase

**Finding the change PR** (`findChangePr`, every external call through `makeGh`, so each has the 60 s timeout):

**Archive heads** are `chore/archive-<id>` (D2) and `archive-<id>` (precedent PR #6). Neither is ever taken for the change PR, in either step below.

1. When the current branch selects the change (`resolveChange` → `<id>`), is not the default branch and is not an archive head: `fetchPr` as today. The `gh pr list --head <branch> --state all --limit 10` fallback (`:415-422`) now runs in `pr` mode too, so a merged PR whose branch GitHub deleted is still found.
2. Otherwise, in `pr` and `merge` modes only: `gh pr list --state merged --limit 100 --json number,url,state,headRefName,headRefOid,mergedAt` (light fields: 100 bodies can pass `spawnSync`'s 1 MiB buffer, and `makeGh` now also sets `maxBuffer` and `ghError` names `ENOBUFS`). Archive heads are dropped first. Then, in order: (a) the PRs whose body contains `openspec/changes/<id>/evidence.md`, the link item 8 requires in every change PR, newest `mergedAt` first, each body read with `gh pr view <n> --json body` while none has matched, so the first match is the newest; (b) only if (a) finds none, the PRs whose head's last `/` segment equals `<id>` exactly, newest first. There is no "contains" match. A short id occurs inside other branch names: on this repository's history, id `auto-merge` is contained in `archive-auto-merge` (PR #6, merged after PR #5, body without the evidence link). The old rule would have taken #6, and this one takes #5. The archive PR's own body (D9) links `openspec/changes/archive/<date>-<id>/retro.md`, never the active `openspec/changes/<id>/evidence.md`. `--limit 100` is the cap: `gh` pages internally up to it, and a change merged more than 100 merged PRs ago is not found (Risks R5). In `plan` mode no list call is made, as today (test `deliver-check.test.mjs:1894`).

**Entering the phase.** The post-merge phase applies when `ship` is `pr` or `merge` and either the change PR is MERGED or `locateChange` returned an archived folder. `plan` mode stops at `stop-plan-mode` first, so it never archives (requirements.md).

**Items in the phase.** The change's contract was met before the merge, and items 1–4 cannot be recomputed afterwards (Context). All eight items are therefore `met`. Item 5 reads `PR #n merged`; the others read `checked before PR #n merged`. No item reads files or calls `gh`, as items 6 and 7 already do for a merged PR (`:776-777`). One exception is kept from today: on the change branch, a PR merged at a head other than the local head is item 5 `blocked` (`:450`). Local commits would be lost, and the archive steps wait until the owner looks.

**Reading the default branch: from GitHub, not from the checkout.** Default branch name: `default_branch` from `readRepoSettings` (`merge-setup.mjs:56-61`), reused from `mergeSetup` in `merge` mode so no extra call is made. Then:

- `gh api repos/{owner}/{repo}/contents/openspec/changes/archive?ref=<base>`: an entry whose `name` is `<YYYY-MM-DD>-<id>` makes the change `archived` on the default branch (`onDefault: "archived"`, `folder`).
- Otherwise `gh api repos/{owner}/{repo}/contents/openspec/changes/<id>?ref=<base>`: 200 is `active`, and a 404 (`HTTP 404` in stderr) is `absent`.
- Any other `gh` error fails closed: `stop-archive` (`read-default-branch`, `cannot read <base> on GitHub: <first stderr line>`). The contents API lists at most 1,000 entries per directory, far above this repository's archive. The cap is stated in the docs.

Why GitHub and not the local checkout or `origin/<base>`: the local default branch is behind whenever GitHub merged on its own. A fetch would make `deliver-check` write to `.git`, and it "never writes" (`docs/openspec-flow.md:161`). A stale `origin/<base>` would report `retro` again after the archive PR merged. GitHub's tree is the one GitHub merges into, and reading it is consistent with ADR 0001 ("recomputes the next step from the repository and GitHub"). The working tree is read only for what exists only there before the archive PR: `retro.md` with the answers (D6), the moved folder, the roadmap tick and the applied files.

**Archive PR facts.** `gh pr list --head chore/archive-<id> --state all --limit 10 --json number,url,state,headRefOid,mergeable,autoMergeRequest,mergeStateStatus`. An OPEN PR is preferred, then the newest MERGED, then the newest CLOSED. For an OPEN one, its checks come from `readChecks` (`:474-483`, `--required`, else all).

### D5. (folded into D4) Which branch the folder is read on

Recorded separately because the brief asks for it: **the change folder's state (active or archived) is read on the default branch as GitHub serves it** (D4), never on the local default branch or `origin/<base>`. The local working tree is read only for the archive branch's own work in progress.

### D6. The owner's answers: in `retro.md`, per proposal

**Where.** In the change's own `retro.md`: `openspec/changes/<id>/retro.md` while the folder is active, and `openspec/changes/archive/<date>-<id>/retro.md` after the move. It is a planning file, so the hooks let the main session write it (`classify`, `guard.mjs:165-172`). It is uncommitted until the archive PR's commit. A killed session resumed in the same checkout reads the answers from disk and does not ask again (ADR 0001: "any run can be killed and resumed from disk"). If the checkout itself is lost before the archive PR, the retro runs again and the owner is asked again (Risks R2; planning resolution R-2).

**Format** (stated once, in `plugins/core/skills/retro/SKILL.md` Output; pinned by a test on that text, retro lesson):

```markdown
## Proposed updates

### `CONTRIBUTING.md` (process-friction)
<summary>
- before: ...
+ after: ...
- Answer: approved
- Applied: yes

### `plugins/core/agents/adr-reviewer.md`, `plugins/core/agents/code-quality-reviewer.md` (bug-class)
...
- Answer: rejected: <the owner's reason, optional>

### user memory (memory-only)
...
```

- A proposal is a `### ` heading under `## Proposed updates`. Its targets are the backticked repository paths on the heading line, or the literal `user memory`. A project-scope memory line targets a file such as `CLAUDE.md`, which is then named as a path. The kind is in parentheses at the end.
- **A proposal lists every file it changes, by exact repository-relative path: no directories, no globs, no prose.** A `regression-gate` proposal names its test file. A proposal that edits `CONTRIBUTING.md` and adds a test names both. The retro writes the paths, and the owner approves exactly those.
- `- Answer: approved` or `- Answer: rejected` (optionally `: <reason>`). The main session writes it from the owner's own message, never from its own judgment (ship-change Never). A proposal with no `Answer:` line is unanswered.
- `- Applied: yes` is written by whoever applied it (D9), only under an approved proposal.
- No proposals: `## Proposed updates` followed by `None.`. The section is required. Without it, `retro.md` is unreadable and the run stops (`stop-archive`, `retro`).
- A `- before:`/`+ after:` diff line inside a block that happens to start with `- Answer:` cannot occur: diff lines are `- before:`/`+ after:` by the retro format (`retro/SKILL.md:57-58`). The parser takes only the **last** `- Answer:` and `- Applied:` line of each block.

`deliver-check` parses this (`readRetro(file)` → `{ exists, readable, proposals: [{ n, targets, kind, answer: 'approved'|'rejected'|null, applied }] }`).

Alternatives rejected: (a) a separate `answers.md`. That is one more file and one more format, and the answers belong with the retro they answer. (b) Committing and pushing `retro.md` to the archive branch before asking. It would survive a lost checkout, but it adds a second commit and pushes a branch with no PR, and the requirements want one archive PR made of one change. (c) Asking inside one run with no stop. Requirements AC-2 and the retro's own rule ("never writing them blindly") ask for a stop.

### D7. The archive steps: rows, summaries, exit codes, JSON

`nextStep` keeps rows 0b (`disable-auto-merge` for an OPEN change PR) and 1 (`stop-plan-mode`) first. The post-merge block then runs before every other row: it replaces row 0a `merged`, and `stop-branch` does not apply in it. First match wins:

| # | Condition (post-merge phase) | `next.step` | Fields |
|---|---|---|---|
| P0 | `onDefault` is `archived` | `archived` | `folder` |
| P1 | default branch unreadable | `stop-archive` | `archiveStep: read-default-branch`, `reason` |
| P1b | item 5 `blocked` (change PR merged at another head, on the change branch) | `blocked` | `item: 5` (today's text) |
| P2 | `merge` mode and `setup.ok` false | `stop-merge-setup` | `missing` (as today) |
| P3a | archive PR OPEN, auto-merge on, and any of: conflict, a failing check, PR head ≠ local head, uncommitted files | `disable-auto-merge` | `number` (archive PR) |
| P3b | archive PR OPEN, `mergeable: CONFLICTING` | `stop-archive` | `archive-pr`, `PR #n has merge conflicts with <base>` |
| P3c | archive PR OPEN, head not in local history | `stop-archive` | `archive-pr`, `PR #n head <sha> is not in local history (someone else pushed?)` |
| P3d | archive PR OPEN, local ahead of its head, or uncommitted files | `open-archive-pr` | `branch`, `number` |
| P3e | archive PR OPEN, a check failing or cancelled | `stop-archive` | `archive-pr`, `failing <name> (<link>)` |
| P3f | `merge`, archive PR `BEHIND` | `update-branch` | `number` |
| P3g | `merge`, auto-merge off | `enable-auto-merge` | `number`, `method`, `head` |
| P3h | `merge`, auto-merge on | `wait-merge` | `number`, `head`, `waitingFor` |
| P3i | `pr`, archive PR OPEN | `archive-pr-ready` | `number`, `url` |
| P4 | archive PR MERGED, `onDefault` not `archived` | `stop-archive` | `archive-pr`, `PR #n is merged but <base> still has openspec/changes/<id>/; run again` |
| P5 | archive PR CLOSED, none open | `stop-archive` | `archive-pr`, `PR #n was closed without merging; reopen it (the flow opens no second archive PR)` |
| P6 | no `retro.md` in the local change folder | `retro` | `number` (change PR), `base` |
| P7 | `retro.md` without `## Proposed updates` | `stop-archive` | `retro`, `retro.md has no "## Proposed updates" section` |
| P8 | a proposal without `Answer:` | `stop-retro-answers` | `proposals: [{ n, targets, kind }]` |
| P9 | local folder active | `archive` | `branch: chore/archive-<id>`, `base`, `create` (`git rev-parse --verify refs/heads/<branch>` fails) |
| P10 | local folder archived, current branch ≠ `chore/archive-<id>` | `stop-archive` | `archive`, `the change is archived in the working tree of <branch>, not on chore/archive-<id>` |
| P11 | `openspec/roadmap.md` lists `<id>` unticked (`readRoadmap`, `guard.mjs:325`) | `tick-roadmap` | `line` |
| P12 | an approved proposal without `Applied: yes` | `apply-proposals` | `proposals: [{ n, targets, kind }]` (approved and unapplied only) |
| P13 | a changed path that no approved proposal names, outside `openspec/changes/**` and `openspec/roadmap.md` (D8) | `stop-archive` | `apply-proposals`, `files no approved proposal names: <paths>` |
| P14 | otherwise | `open-archive-pr` | `branch`, `base`, `title` |

- `retro` is the first archive step for a change merged with its folder still on the default branch, in both modes (AC-1). P0 is checked before everything else, so a re-run after the archive PR merged is `archived` from any branch that has the folder, active or archived (AC-6).
- P6–P9 read the folder in the working tree. Running them on the change branch or on the default branch is equally valid, because both hold the merged folder. P9 moves the work to the archive branch.
- The rows that need the owner, or a person outside the flow, are `stop-*`. The skill already stops on every `stop-*` (`plugins/openspec/skills/ship-change/SKILL.md:63`).
- **No archive PR can exist before every proposal is answered** (AC-2): the only row that opens it, P14 (or P3d, which needs an existing PR), sits after P8.

**Summaries** (post-merge phase): `archived` (P0); `archive PR open: waiting for <what>` (P3h, `<what>` from `waitingFor`, `deliver-check.mjs:638-643`); `archive PR ready` (P3i); `archive: waiting for the owner's answers` (P8); `blocked: archive (<archiveStep>)` (every `stop-archive`); `blocked: merge setup` (P2); `blocked: item 5` (P1b); otherwise `merged: archive step <step>`.

**Exit codes**: 2 for any `blocked: ...` summary, else 0 (the change's eight items are met). 3 as today.

**JSON** stays `version: 1`. Additive: an `archive` object, present only in the post-merge phase: `{ "base", "branch", "changePr": { "number", "url" }, "onDefault": "active"|"archived"|"absent", "folder", "local": "active"|"archived", "retro": { "exists", "readable", "proposals": [...] }, "roadmap": { "listed", "ticked" }, "pr": { "number", "url", "state", "autoMerge", "mergeStateStatus", "headRefOid" } | null, "waitingFor" }`. New step and summary values. `merged` is no longer emitted as a `next.step`: it is a state now, not an end. The change is the release that also updates `ship-change`, its only consumer (planning resolution R-9). Alternative rejected: JSON `version: 2`. No field is removed or changes meaning, only the set of values grows and loses one end state, which `docs/openspec-flow.md` documents.

### D8. The archive PR: devkit-reviews, auto-merge, the wait, and AC-3

- **devkit-reviews**: passes with its note (Context, D2). Nothing changes in the workflow (`.github/workflows/devkit-reviews.yml`). `check` (job of `ci`) runs the suite on the applied proposals.
- **Auto-merge** (`merge` mode, AC-5): `enable-auto-merge` on the archive PR runs the same command as for a change PR, `gh pr merge <n> --auto --<merge_method> --match-head-commit <head>`, when P3a–P3f do not apply. That means the P13 file check and the retro answers hold (below), no conflict, no failing check, the PR head equal to the local head, nothing uncommitted, and not behind. Pending checks do not block enabling: GitHub waits for the required `check` and `devkit-reviews` itself. There is no 8/8 for an archive PR: its gate is the owner's answer to each proposal (D6), the P13 file check, and the ruleset's required checks. This is the decision of ADR 0003 (D10, R-5). In `pr` mode no `gh pr merge` call is made (P3i), which a test pins through the gh call log (AC-5).
- **Disable**: P3a disables auto-merge before any stop, mirroring row 0b. It also fires when the answers or the file check fail on the open PR.
- **The wait** (reused): `--watch[=<minutes>]` at `wait-merge` polls `gh pr view <next.number>` (`waitForMerge`, `:906-922`) with the same default (9) and cap (30). `waitForMerge` now takes `{ number, headRefOid }` from `next` (`number`, `head`) instead of the change PR (`:1083`), so the same loop waits on the archive PR. After the wait, the state is collected again: `archived` when GitHub merged, else `archive PR open: waiting for <what>`.
- **AC-3, checked rather than trusted (P13).** Changed paths are `git diff --name-only <merge-base of origin/<base> and HEAD>` plus `git status --porcelain -uall`. Each must be either exactly equal, as a repository-relative path string after normalising `./` and with no directory, prefix or glob matching, to a target of an approved proposal (D6), or one of the paths an archive changes by itself: anything under `openspec/changes/` (the move) and `openspec/roadmap.md` (the tick), or the release files a bump needs. `openspec/config.yaml` and `openspec/schemas/**` are not exempt: they need a named approved proposal. The release list is fixed: `plugins/<pack>/.claude-plugin/plugin.json` for any pack, `.claude-plugin/marketplace.json`, `CHANGELOG.md` and `docs/catalog.md` (regenerated). Any other path stops the run, naming it. A regression-gate test file that its proposal did not name stops the run too. The fix is to stop: the owner amends the proposal's targets in `retro.md` and answers again; the checker never guesses. A path that only a rejected proposal names is therefore caught too. `origin/<base>` was fetched by the `archive` step; if it does not resolve, P13 stops with `archive`, `origin/<base> is not available; git fetch origin <base>`.
- **Placement of the check (review round 1).** The answers (P8) and P13 run in two places. In the row order they come after P12; with the archive PR open (P3) they are computed first, whenever the change is archived in the working tree and its retro is readable, and the PR's rows (`disable-auto-merge` when auto-merge is on, else the stop `stop-retro-answers` or `stop-archive`/`apply-proposals`) come before `open-archive-pr`, `update-branch`, `enable-auto-merge`, `archive-pr-ready` and `wait-merge`. A file pushed after the first run, or an answer edited, therefore never reaches auto-merge. `archiveFacts` loads the changed paths whenever the change is archived locally or an archive PR exists.
- **The check in CI.** `deliver-check --ci` (the `devkit-reviews` check) no longer passes an archive PR blindly. With `GITHUB_BASE_REF` set and no change selected, it lists the PR's changed paths against `origin/<base>`; if any lies in `openspec/changes/archive/<date>-<id>/`, the PR is an archive PR (whatever its branch is called) and the check reads each such folder's `retro.md` (the PR's own files) and runs the same exact-path check. It fails (exit 1) when a retro is missing or has no `## Proposed updates`, a proposal is unanswered, or a changed path is unnamed, and prints and reports (`archive: { folders, noRetro, unanswered, unnamed }`) each. A PR that archives nothing keeps the "nothing to check" note, as does a run without `GITHUB_BASE_REF`. This makes the file check hold in `merge` mode even if the local skill is bypassed, because `devkit-reviews` is a required check.

### D9. `ship-change`, `retro`, `commit-and-pr`, `tdd-implementer`

`plugins/openspec/skills/ship-change/SKILL.md`:

- Description and intro: drives the change to a merged PR and on to its archive. In `pr` mode it stops at `ready` and, after the owner's merge, at `archive PR ready`. In `merge` mode it ends at `archived`.
- Start, step 1 (resolving the id): the argument; else the change the current branch selects; else, on a branch `chore/archive-<id>`, the `<id>` in its name (the D2 rule: the active or archived `openspec/changes/…<id>/` must exist). With none of these, ask for the id. A resumed `/ship-change` with no argument on the archive branch therefore finds its change after the folder has moved.
- New rows in the Loop table:

| `next.step` | Do |
|---|---|
| `retro` | Run the `devkit-core:retro` skill for change <id>, on the change PR #`next.number` (`gh pr diff <n>`, the reviews, `evidence.md`), writing `retro.md` in the change folder in the format of its Output section, with no `Answer:` lines |
| `stop-retro-answers` | Stop. Show every proposal in `next.proposals` with its targets, kind, summary and diff, and ask the owner to approve or reject each one. When the owner answers (their own message), write `- Answer: approved` or `- Answer: rejected: <reason>` under each proposal in `retro.md`, then run the loop again. Never answer for the owner. |
| `archive` | `git fetch origin <next.base>`; `git switch -c <next.branch> origin/<next.base>` (`git switch <next.branch>` when `next.create` is false); `openspec archive <id> --yes`. Any non-zero exit stops as `blocked: archive (archive): <stderr's first line>` |
| `tick-roadmap` | In `openspec/roadmap.md`, change `- [ ] <id>` to `- [x] <id>` on `next.line` |
| `apply-proposals` | Dispatch `devkit-core:tdd-implementer`: "Apply exactly these approved retro proposals of change <id> (archived at <folder>): <next.proposals>. A regression-gate proposal is test-first. Bump the version of each pack whose files you change (`plugin.json` and `.claude-plugin/marketplace.json`) with a CHANGELOG line, regenerate the catalog if an agent or skill description changed, run the test command, and write `- Applied: yes` under each proposal you applied. Nothing else." Proposals whose target is `user memory` are applied by the main session to the user's memory and never touch the repository. `Outcome: failure` stops as `blocked: archive (apply-proposals): <reason>` |
| `open-archive-pr` | Dispatch `devkit-core:commit-and-pr` with an archive call: "Archive change <id>: stage by name the moved folder (both paths), `openspec/roadmap.md` and the applied files; commit and open the PR titled `next.title`; push `next.branch`, or reuse its open PR." |
| `archive-pr-ready` | Report `archive PR ready` with the PR URL (`pr` mode): the owner merges it, and the next run reports `archived` |
| `stop-archive` | Stop and report `blocked: archive (<next.archiveStep>): <next.reason>` |
| `archived` | Report `archived` |

- `disable-auto-merge`, `update-branch`, `enable-auto-merge` and `wait-merge` keep their rows. Their `next.number` is the archive PR in the post-merge phase. The `merged` row is removed.
- **Stops**: add "an archive step's command or agent fails: stop as `blocked: archive (<step>): <reason>`" (AC-7).
- **Report**: `archived`; `archive PR open: waiting for <what>`; `archive PR ready`; `archive: waiting for the owner's answers`; `blocked: archive (<step>)`; plus the existing values. `merged` is no longer a final report.
- **Never**: add "Push to the default branch, or commit on it: every archive commit goes through `chore/archive-<id>` and a PR" (AC-7) and "Apply a retro proposal the owner did not approve, or record an answer the owner did not give" (AC-3).
- **Hosts**: the capped wait also covers `wait-merge` on the archive PR. In `merge` mode one run may wait twice: once for the change PR, once for the archive PR. Each wait is capped.

`plugins/core/skills/retro/SKILL.md` (devkit-core): Output gains the D6 format (targets as backticked paths or `user memory`, `None.` when empty, the `Answer:` and `Applied:` lines and who writes them). Never gains "write an `Answer:` line yourself". When to use: "at the archive step of `ship-change`, after the merge".

`plugins/core/agents/commit-and-pr.md`: Receives gains "an **archive call** (from `ship-change` at `open-archive-pr`): the change id, the archive folder and the change PR number". In that call precondition 3 is waived, because the change PR's reviews gated the change and the owner answered each proposal. Precondition 4 is met by `chore/archive-<id>`. The title is `chore(openspec): archive <id> with its retro`, with ` (<marketplace version>)` appended when the commit bumps versions, as in #6. The body names the change and the change PR, links `openspec/changes/archive/<date>-<id>/retro.md` from the repo root, and lists the proposals approved and rejected. There is no "Closes change" block and no AC list. Never stays: no merge, no auto-merge.

`plugins/core/agents/tdd-implementer.md`: Receives gains "an **apply-proposals call** (from `ship-change`): a list of approved retro proposals of an archived change". It applies exactly those, test-first for a regression gate, bumps versions, marks `Applied: yes` and runs the test command. There is no phase and no `tasks.md` tick, and preconditions 1–2 are read as "the owner approved these proposals". Precondition 3 holds: `chore/archive-<id>` is not the default branch.

### D10. ADR 0003 (new, draft below) and the ADR 0002 note

The owner ruled on 2026-11-09 (requirements.md, planning resolutions, answer A) that auto-merging the archive PR without 8/8 is a new decision. It is recorded as ADR 0003, and ADR 0002 gets only the AC-8 bypass note and a pointer to 0003.

**ADR 0002** (`docs/adr/0002-merge-without-the-owner-opt-in.md`), written in phase 3:

- Line 35, `(Accepted until round 3's bypass)`, becomes `(Accepted: round 3 archives through a PR, so there is no bypass; see ADR 0003)` (AC-8).
- After the existing `mergedBy` note, add: `- Note: the archive PR that follows a merge has no 8/8; when it is auto-merged is decided in ADR 0003 (docs/adr/0003-auto-merge-the-archive-pr.md).` ADR 0002's Decision text stays as it is: it governs change PRs.

**ADR 0003**: file `docs/adr/0003-auto-merge-the-archive-pr.md`, written in phase 3 by `tdd-implementer`. It follows the ADR 0001/0002 pattern, with `Status: accepted` because the owner decided it in requirements.md (answer A, building on questions 2, 3 and 6). The draft text follows. The implementer may fix wording but not substance; any substantive change amends this section in the same phase (auto-merge retro, learning 4).

```markdown
# ADR 0003: Auto-merge the archive PR without the delivery contract

- Status: accepted
- Date: 2026-11-09
- Change: archive-after-merge

## Context

This ADR builds on ADR 0001 and ADR 0002 and leaves both decisions unchanged. Under ADR 0002,
`ship-change` enables auto-merge on a change PR only when `deliver-check` reports 8/8, and
`devkit-reviews` re-checks reviews, findings, gates and acceptance proof at the PR head. Round 3
(`archive-after-merge`) archives a change after its PR merges: the retro, the owner's answer to
each of its proposals, `openspec archive`, the roadmap tick and the approved proposals land in
one archive PR on `chore/archive-<id>`. The `devkit` ruleset refuses direct pushes to the default
branch for everyone, and the owner ruled out a bypass. An archive PR has no delivery contract:
no tasks, no reviews, no acceptance criteria. `devkit-reviews` selects no change on it and runs
only the archive check described under Consequences. Yet it can change product files, because
approved proposals edit docs, agents and tests.

## Decision

In `merge` ship mode, `ship-change` enables GitHub's auto-merge on the archive PR, with the
project's `merge_method`, pinned to the head `deliver-check` checked (`--match-head-commit`),
when `deliver-check` reports that PR open with no merge conflict, no failing or cancelled
check, its head equal to the local head, nothing uncommitted, not behind its base, and no
changed file that an owner-approved retro proposal does not name (exempt:
`openspec/changes/**`, `openspec/roadmap.md`, the version manifests, CHANGELOG and the
generated catalog). It disables auto-merge as soon as one of those stops holding. The gate for that PR is the owner's explicit answer to each proposal,
recorded in `retro.md` before the PR exists, together with the ruleset's required checks.
GitHub performs the merge; nothing pushes to the default branch. In `pr` mode the owner
merges the archive PR. In `plan` mode no change reaches a PR, so there is nothing to archive.

## Consequences

- Positive: a change goes from merged to archived without the owner's merge; no ruleset
  bypass exists for anyone; every archive commit is a reviewable PR on GitHub.
- Negative: approved proposals land without a code review (Accepted: the owner approved each
  one by name and the file check refuses anything else; `check` runs the suite on the PR).
  `devkit-reviews --ci` checks archive PRs (detected by the archived folder in the diff)
  against the archived `retro.md` and fails on a missing retro, an unanswered proposal or a
  file no approved proposal names, so the required check backs the local file check (the hooks
  and CI never select another change from an archive branch). The owner's answers live
  uncommitted in `retro.md` until the archive PR, so a lost checkout means asking again
  (Accepted by the owner). Between skill runs GitHub merges on required checks alone
  (Mitigated, as in ADR 0002: the skill disables auto-merge when a condition drops).

### Review trigger

An archive PR merges a file the owner did not approve, a retro proposal needs more than a
docs or test edit (a product behavior change belongs in its own change), or the owner wants
the archive PR held to a review.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| Owner merges every archive PR, in every mode | Nothing new | The owner stays the last loop after every merge, which round 3 exists to remove | low |
| Ruleset bypass so the skill pushes the archive to `main` | No PR | A bypass for everyone with the token; ruled out by the owner | medium |
| Require `review-change` and 8/8 on the archive PR | Same gate as a change | A second full contract for a retro and a folder move; reviews of a diff the owner just approved line by line | medium |
| A post-merge GitHub Action that archives | Unattended | Secrets in CI, a coordinator outside the session (ADR 0001) | medium |
```

**Where it is cited** (the repository keeps no ADR index file; these are the places that list ADRs): `openspec/config.yaml:22` `context` line (`0003 auto-merge the archive PR`) and `:11` comment (archive PR: ADR 0003); `README.md:50` gets one sentence after the ADR 0002 paragraph ("After the merge, `ship-change` archives the change through a PR that GitHub merges in `merge` mode; see ADR 0003."); `docs/openspec-flow.md` links it from the new "After the merge" part and from the ship-modes section next to the ADR 0002 link (`:232`); `CONTRIBUTING.md:7` names it with the archive PR. `adr-reviewer` reviews ADR 0003 and the ADR 0002 edit together.

ADR 0001 is unchanged and not superseded. The archive steps are recomputed from the repository and GitHub, run as subagents of the owner's session and stop with a reason, and the answers live in a file of the change.

### D11. Dogfood (AC-9): order and proof

1. Phases 1–3 (`tdd-implementer`), the reviews, `pr-verifier`, and `commit-and-pr` on branch `archive-after-merge` (R-11). Evidence proves AC-9's **pre-merge part**: the end-to-end walkthrough test (task 2.9), the CI smoke on a simulated archive branch of this repository (task 1.5) and the real-input smoke of `deliver-check` (task 2.10). The AC-9 row says so and cites R-4.
2. `ship-change archive-after-merge`, run from this repository's `plugins/openspec/skills/ship-change/SKILL.md` and `plugins/openspec/hooks/deliver-check.mjs` (CONTRIBUTING.md; the installed 0.5.x would end at `merged`): 8/8 → `enable-auto-merge` → `wait-merge` → GitHub merges → the same run gets `retro`.
3. `retro` → `stop-retro-answers`. The owner answers each proposal → `archive` → `tick-roadmap` (round 3's line) → `apply-proposals` (if any approved) → `open-archive-pr` → `enable-auto-merge` → `wait-merge` → `archived`.
4. Before `open-archive-pr`, the main session appends a `## Dogfood` section to `retro.md` with each step's `deliver-check` summary and `next.step`. It is a planning file, and it shows AC-9's middle part in the archive PR itself.
5. The archive PR's merge cannot be written into a file of that PR. It is proven on GitHub (`gh pr view <n> --json state,mergedAt,mergedBy,autoMergeRequest`), in `ship-change`'s final `archived` report, and by `deliver-check archive-after-merge --json` returning `archived` from a fresh checkout of `main` (R-4).

These steps are plain bullets under `## Workflow follow-up` in tasks.md, not checkboxes: `tasksItem` counts every checkbox (`deliver-check.mjs:285`), so a post-merge checkbox would hold the change PR below 8/8 forever. The schema's tasks instruction also says post-archive work goes there as plain bullets (R-10).

### D12. Docs and release

- `docs/openspec-flow.md`: "The delivery contract" gets a "After the merge: the archive steps" part (D4, D7, D8: the rows, summaries, `archive` object, exit codes, the default branch read and its cap). The "Merge mode" bullet at `:194` drops "a merged PR is still `blocked` at item 5" for `pr` mode. The steps line `:207` drops `merged` as the final state. "Shipping a change" gets the archive rows in the skill table (`:240-247`) and the `pr`/`merge` end states. Troubleshooting gets rows for `blocked: archive (<step>)`, `archive: waiting for the owner's answers`, `archive PR open: waiting for ...` and the exit-3 message for an id that is in neither place. CI notes that an archive branch never selects another change. The CI snippet pins `v0.6.0`.
- `CONTRIBUTING.md:5` ("After the merge, run the `retro` skill and `openspec archive <id>`") becomes "after the merge, `ship-change` archives the change through a PR on `chore/archive-<id>` (in `pr` mode, run it again after you merge)". Line 7 keeps "every change, the archive commit included, lands through a pull request".
- `openspec/config.yaml` and `plugins/openspec/skills/openspec-setup/templates/config.yaml`, `operations.archive.guidance`: "In `pr` and `merge` ship modes `ship-change` runs the archive steps after the merge (retro, the owner's answer per proposal, `openspec archive`, roadmap tick, approved proposals, archive PR on `chore/archive-<id>`)".
- `plugins/openspec/README.md` (`ship-change` row, `:20`, `:69` from the description), `plugins/core/README.md` (`:28` Learn row: the owner answers each proposal; `ship-change` applies the approved ones), the `docs/catalog.md` regeneration.
- `plugins/openspec/skills/openspec-setup/templates/devkit-reviews.yml`: not modified. Its `{{ref}}` is filled at setup time by `github-setup.mjs`, from the tag `v<plugin version>`, so a consumer re-running the setup after 0.6.0 gets the D2 rule once the owner creates tag `v0.6.0` after the merge, as for `v0.5.0`. This repository's own workflow runs the checkout's checker and needs no re-pin.
- Versions: devkit-openspec 0.5.0 → 0.6.0, devkit-core 0.4.1 → 0.5.0, marketplace `metadata.version` 0.5.1 → 0.6.0; CHANGELOG "0.6.0 — archive after merge", one line per pack, a line saying that in `pr` mode a merged PR now leads to the archive steps instead of `blocked: item 5`, and that `merged` is no longer a final step.

## Implementation plan

Dependency order: the archive branch rule (guard and CI, no GitHub) → the post-merge phase in `deliver-check` (GitHub facts, rows, wait) → skills, agents, docs, ADR note and release → dogfood after the merge.

### Per surface

- **devkit-openspec hooks**: `guard.mjs` (`archiveBranchChange`, `resolveChange`), `deliver-check.mjs` (`selectCiChange`, `locateChange`, `findChangePr`, default-branch read, archive PR facts, `readRetro`, post-merge items and rows, summary/exit/JSON, `waitForMerge` input), tests in `guard.test.mjs` and `deliver-check.test.mjs` (fake `gh` key for `pr list` by `--head`/`--state`).
- **devkit-openspec skills**: `ship-change/SKILL.md` (D9), `openspec-setup/templates/config.yaml`; pack `README.md`.
- **devkit-core**: `skills/retro/SKILL.md`, `agents/commit-and-pr.md`, `agents/tdd-implementer.md`, `README.md`.
- **Repo**: new ADR 0003, ADR 0002 note and pointer, `README.md`, `docs/openspec-flow.md`, `CONTRIBUTING.md`, `openspec/config.yaml`, `docs/catalog.md`, manifests, `CHANGELOG.md`.
- **GitHub**: none (AC-8 is read back, not changed).

### File structure

| Action | Path |
|---|---|
| modify | `plugins/openspec/hooks/guard.mjs`, `plugins/openspec/hooks/guard.test.mjs` |
| modify | `plugins/openspec/hooks/deliver-check.mjs`, `plugins/openspec/hooks/deliver-check.test.mjs` |
| modify | `plugins/openspec/skills/ship-change/SKILL.md`, `plugins/openspec/skills/openspec-setup/templates/config.yaml`, `plugins/openspec/README.md` |
| modify | `plugins/core/skills/retro/SKILL.md`, `plugins/core/agents/commit-and-pr.md`, `plugins/core/agents/tdd-implementer.md`, `plugins/core/README.md` |
| create | `docs/adr/0003-auto-merge-the-archive-pr.md` |
| modify | `docs/adr/0002-merge-without-the-owner-opt-in.md`, `README.md`, `docs/openspec-flow.md`, `docs/catalog.md`, `CONTRIBUTING.md`, `openspec/config.yaml` |
| modify | `plugins/openspec/.claude-plugin/plugin.json`, `plugins/core/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `CHANGELOG.md` |
| delete | none (the dogfood's archive PR moves this folder and ticks `openspec/roadmap.md`) |

### Estimate

Optimistic 18.5 h · likely 26.5 h · pessimistic 36.5 h. Most of the spread is in the post-merge rows with their fixtures (four kinds of `gh` answers per run) and in the walkthrough test.

### Effort

| Component | Hours | Type | Risk |
|---|---|---|---|
| `archiveBranchChange`, `resolveChange` and `selectCiChange` rule + tests; CI smoke on a simulated archive branch | 2.5 | Core | MEDIUM (gate file) |
| `locateChange`, `main` accepts archived ids, schema from the folder | 1 | Core | LOW |
| `findChangePr` (branch path in `pr` mode, merged list path) + fake `gh` key per `--head`/`--state` | 2.5 | Integration | MEDIUM |
| Default-branch read (contents API, 404, fail closed) and archive PR facts | 2 | Integration | MEDIUM |
| `readRetro` and the D6 format | 1.5 | Core | MEDIUM (cross-pack format) |
| Post-merge items and rows P0–P14, summaries, exit codes, `archive` JSON, tests per row | 4.5 | Core | HIGH |
| P13 file check (AC-3) | 1.5 | Core | MEDIUM |
| `wait-merge` on the archive PR + the end-to-end walkthrough test | 2.5 | Testing | MEDIUM |
| Real-input smokes (`deliver-check` on this change; `--ci` on a simulated archive branch) | 1 | Testing | LOW |
| `ship-change/SKILL.md` + format tests | 2 | Core | MEDIUM |
| `retro`, `commit-and-pr`, `tdd-implementer` + producer-text tests | 1.5 | Core | MEDIUM |
| `docs/openspec-flow.md`, CONTRIBUTING, config guidance, READMEs | 1.5 | Documentation | LOW |
| ADR 0003 from the D10 draft, ADR 0002 note and pointer, citations (config, README, docs, CONTRIBUTING), AC-8 read-back | 1 | Documentation | LOW |
| Versions, CHANGELOG, catalog | 0.5 | Documentation | LOW |
| Dogfood (Workflow follow-up) | 1 | Integration | HIGH |
| Total | 26.5 | | |

### Risks / Trade-offs

| # | Risk | P × I | Mitigation |
|---|---|---|---|
| R1 | GitHub's contents API lags right after the archive PR merges, and the run reports P4 instead of `archived` | LOW × LOW | P4 names the cause and asks for a re-run; the wait exits on the PR state, then the next collection reads again |
| R2 | The checkout is lost between the owner's answers and the archive PR, so the answers are lost | MEDIUM × LOW | The retro re-runs and the owner is asked again (R-2); the stop shows every proposal at once, so re-asking costs one message |
| R3 | The archive PR lands product edits (approved proposals) without a code review, by auto-merge in `merge` mode | MEDIUM × MEDIUM | Each proposal was approved by the owner (AC-2); P13 stops on any file no approved proposal names (AC-3); `check` runs the suite; recorded as ADR 0003 with its review trigger (D10, R-5) |
| R4 | During the dogfood the **installed** guard (0.5.x, `${CLAUDE_PLUGIN_ROOT}`) runs, without the D2 rule; with another open change, its `gh pr create` hook refuses the archive PR | MEDIUM × MEDIUM | Dogfood precondition: no other active change under `openspec/changes/` (check `ls`), or install 0.6.0 first; stated in Workflow follow-up |
| R5 | The change PR is not found after the merge (branch not named after the change and body without the evidence link, or more than 100 merged PRs ago) | LOW × MEDIUM | The run then falls through to today's rows (`stop-branch` on the default branch) and does nothing; running from the change branch finds it by branch; the cap is documented |
| R6 | An external call stalls or reads one page | LOW × MEDIUM | Every call goes through `makeGh` (60 s); `gh pr list --limit` pages internally; the contents API's 1,000-entry cap is stated; a stalled-`gh` test on the new calls (auto-merge retro, learning 1) |
| R7 | `pr`-mode consumers relied on `blocked: item 5` for a merged PR, or on `merged` as the last step | LOW × LOW | CHANGELOG and docs say so; `ship-change`, the only consumer, ships in the same release |
| R8 | The retro format (devkit-core) and its parser (devkit-openspec) drift apart | MEDIUM × MEDIUM | Stated once in `retro/SKILL.md`; a test reads that text's example block and parses it with `readRetro` (retro lesson) |
| R9 | `git switch -c` refuses because an untracked `retro.md` would be overwritten, or the fetch fails | LOW × LOW | The `archive` row stops as `blocked: archive (archive): <stderr>`; nothing is pushed |
| R10 | The archive PR is behind `main` under the strict rule | MEDIUM × LOW | `update-branch` (P3f) is reused; `devkit-reviews` still passes with its note |
| R11 | The dogfood runs the installed 0.5.x skill and checker, which end at `merged` | MEDIUM × MEDIUM | D11 step 2 runs this repository's files (CONTRIBUTING.md) |
| R12 | A change legitimately named `archive-<x>` on branch `chore/archive-<x>` is read as the archive branch of `<x>` | LOW × LOW | The rule applies only when `<x>` is itself a known change (D2); documented |

### Assumptions

| Assumption | Source | Breaks if |
|---|---|---|
| `openspec archive <id> --yes` works with `skip_specs` and unticked tasks, and names `<YYYY-MM-DD>-<id>` | Scratch run, OpenSpec 1.16.1, 2026-11-09 | A stricter CLI: the `archive` row stops with its stderr; the dogfood shows it |
| An archive PR passes `devkit-reviews` with the note | `deliver-check.mjs:952-992`; PR #6's run log | Another active change's name occurs in the archive branch: fixed by D2 |
| `gh pr view` finds a merged PR from its branch, and `gh pr list --head <b> --state all` finds it after GitHub deleted the branch | auto-merge retro (PR #5 found by number after `delete_branch_on_merge`); `fetchPr` fallback | gh changes: the merged-list path (D4 step 2) still finds it |
| The contents API returns 404 (`HTTP 404`) for a missing folder on a ref | GitHub REST docs, "Get repository content" | Another error shape: treated as unreadable, fail closed (P1) |
| The ruleset `devkit` keeps `bypass_actors: []` | `gh api repos/chacal88/devkit/rulesets/26859494` (2026-11-09) | Someone adds one: `github-setup.mjs` reports `update`, and the evidence row for AC-8 fails |
| The owner answers in the same conversation, so the main session can record the answers | requirements.md question 2 | The owner answers elsewhere: they edit `retro.md` by hand, and the format (D6) is plain |

### Dependencies

- `openspec/changes/archive/2026-11-09-auto-merge/` (merged, archived): `merge` mode, `enable-auto-merge`/`wait-merge`, `--ci`, `makeGh`, `readChecks`, the ruleset.
- ADR 0001 (kept), ADR 0002 (note and pointer), ADR 0003 (this change, D10).
- Owner decisions: requirements.md questions 1–7.
- A branch named after the change (`archive-after-merge`) for apply (R-11).

## Planning resolutions (accepted by the owner on 2026-11-09)

These are points where requirements.md was ambiguous or did not match the code. The owner accepted them on 2026-11-09, as recorded in requirements.md under "Planning resolutions accepted by the owner". R-2 and R-5 carry the owner's two explicit answers.

- **R-1 — archive branch name.** `chore/archive-<id>` (precedents #2, #4). With it, a fix in the hooks and in CI (D2): an archive branch never selects another open change.
- **R-2 — where the answers live.** In the change's `retro.md`, one `- Answer:` line per proposal, uncommitted until the archive PR. A killed session resumed in the same checkout does not re-ask. A lost checkout means the retro and the questions run again. Owner's answer B: keep the answers uncommitted, accept the re-ask risk, no early push.
- **R-3 — `pr` mode after the merge.** A merged change PR in `pr` mode was `blocked: item 5`. It now leads to the archive steps (AC-1). The collector/CLI test that pins the old behavior (`deliver-check.test.mjs:1894`) is rewritten. The `prItem` unit tests (`:820`, `:1576`) stay, because `prItem` is unchanged: the post-merge phase builds its items in `collectState`. The `merge`-mode tests expecting `merged` as `next.step` (for example `:1845`) are rewritten to expect `retro`. `merged` is no longer a final step in `merge` mode either.
- **R-4 — proving AC-9.** `deliver-check` item 4 needs AC-9 proven before 8/8, and the archive happens after the merge. Evidence proves the pre-merge part: the walkthrough test, the CI smoke on a simulated archive branch, and the real-input smoke. `retro.md` records the dogfood's steps up to the archive PR (`## Dogfood`). The archive PR's own merge cannot be recorded inside that PR. Its proof is GitHub's record (`gh pr view <n>`), `ship-change`'s final `archived`, and `deliver-check` returning `archived` from `main`. The owner may prefer that round 4 cites it in its requirements.
- **R-5 — auto-merge of the archive PR without 8/8.** ADR 0002's decision says auto-merge is enabled "when `deliver-check` reports 8/8". An archive PR has no contract, and `devkit-reviews` has nothing to check on it. Its gate is the owner's per-proposal answer, the P13 file check and the required checks. Requirements question 3 makes the archive PR auto-merge in `merge` mode, and question 6 says ADR 0002 gets a note. Owner's answer A: it is a new decision. It is drafted as ADR 0003 in D10 and written to `docs/adr/0003-auto-merge-the-archive-pr.md` in apply; ADR 0002 gets only the AC-8 bypass note and a pointer to 0003.
- **R-6 — AC-3 machine-checked.** For P13 to work, retro proposals must name every file they change as an exact backticked repository-relative path on the heading line, a regression gate's test file included (no directories or globs). That is a retro format change in devkit-core. A free-prose target like "and the other reviewers" (auto-merge retro) then has to list the paths.
- **R-7 — who applies approved proposals.** `tdd-implementer`, with a new apply-proposals call, because `ship-change` never edits product files in the main session. `user memory` proposals are applied by the main session and are not in the diff.
- **R-8 — versions and tag.** devkit-openspec 0.6.0, devkit-core 0.5.0, marketplace 0.6.0; docs pin `v0.6.0`; the owner creates the tag after the merge.
- **R-9 — `merged` step removed, JSON stays `version: 1`.**
- **R-10 — AC-9 tasks.** The dogfood is the last section of tasks.md, `## Workflow follow-up`, as plain bullets. Checkboxes would hold this change's own PR below 8/8 (item 1). AC-9's pre-merge proof is in checkbox tasks 1.5, 2.9 and 2.10.
- **R-11 — this change's branch.** The worktree is on `claude/openspec-setup-b0bdf2`, which does not select `archive-after-merge`: `ship-change` would stop at `stop-branch`, and D4 would not find the PR by branch. Apply starts on a branch named `archive-after-merge` (task 1.1).

## Migration Plan

- Release devkit-openspec 0.6.0 and devkit-core 0.5.0. `plan` mode: no change. `pr` and `merge` modes: after a merge, `ship-change` goes on to archive the change. A consumer who archives by hand can keep doing so, and the next `deliver-check` run then reports `archived`.
- Consumers of the `devkit-reviews` template get the D2 rule when they re-pin to `v0.6.0` (`openspec-setup` GitHub step).
- Rollback: revert the PR. Archive PRs already merged are ordinary commits. An open archive PR can be closed (`gh pr close`); after a rollback nothing reopens it.

## Open Questions

None. R-1 to R-11 were accepted by the owner on 2026-11-09.
