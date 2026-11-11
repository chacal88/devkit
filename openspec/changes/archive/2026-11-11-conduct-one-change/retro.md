## Retro: conduct-one-change

1. Went wrong: the ship was clean (three phases, three green gates, two review rounds, PR #16 squash-merged by GitHub at 8/8 right after `enable-auto-merge`, the checks already green from the watch), with four things worth keeping. The PR was opened with an empty body: `commit-and-pr` ran `gh pr create --body - <<'EOF'`, and `gh` reads `-` after `--body` as the literal body (reading stdin is `--body-file -`); `deliver-check` item 8 caught it and `edit-pr-body` rewrote it from a file, so nothing was lost but one step. The readiness review needed a second round because the plan gave `--change <id>` only to the first `conduct-check` call and forgot the watch and the recomputes (a single-change run would have swept the round during its GitHub wait), gave two exit-3 errors the same prefix (the skill would have created a duplicate of a change on another branch), and ran `git worktree add -b` over an existing worktree. Review round 1 found the `--change` id regex accepting a leading dash (`--change --json` swallowed the next flag; `--change=-rf` reached the suggested git commands) and no test for a `chore/archive-<id>` worktree in single-change mode; both fixed in ace7ac0. Every `tdd-implementer` run wrote code and tests in the same step and reported it never saw the tests red.
2. Better next time: open PRs with `--body-file`, never `--body -`; when a plan adds a mode flag to a checker, grep the skill for every call of that checker (watch, recompute, continuation lines included) before the readiness review; give each error a caller must act on its own prefix the first time it is designed; validate a CLI value that can look like an option at the boundary (first character) and test the flag-swallowing case; say in the implementer's prompt that the red run is a reported step.
3. Remember: `gh pr create --body -` is a literal dash; a mode flag must reach every call of the command, not only the first.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | `gh pr create --body - <<EOF` sets the body to `-`; the agent text says "body via HEREDOC" without the flag that reads stdin | bug-class | doc-update (proposed below: `commit-and-pr` agent) | project |
| 2 | The plan gave `--change <id>` to the first call only; the watch and recompute lines would have swept the round (caught by readiness round 1) | process-friction | memory-only (proposed below: user memory) | user |
| 3 | Two exit-3 errors shared a prefix the skill acts on; the skill would have created a duplicate change (caught by readiness round 1, fixed in the plan) | bug-class | none (fixed in the plan) | project |
| 4 | The id regex accepted a leading dash: `--change --json` swallowed the flag (caught in review round 1, fixed in ace7ac0 with tests) | bug-class | none (fixed; the tests are the gate) | project |
| 5 | The Auto-fix line and the troubleshooting row say "run `/conduct` again", but a bare `/conduct` now asks which change (adr-reviewer nit) | doc-gap | doc-update (proposed below: skill, its pin test, the docs row) | project |
| 6 | ADR 0001's Note names only the roadmap round as the exception; the single change is now the default (adr-reviewer nit) | doc-gap | doc-update (proposed below: ADR 0001) | project |
| 7 | `renderHuman` prints no `unfinished` or `mode`, so the human output is silent about a dirty worktree (code-quality nit) | tooling | followup: a change of its own, or part of the next checker change | project |
| 8 | `tdd-implementer` wrote code and tests together in all four runs and reported no red run | process-friction | followup: a change of its own (the agent's prompt makes the red run a reported step) | project |
| 9 | A pack bump at `apply-proposals` moves the CI pin in `docs/openspec-flow.md` (retro of conduct-sessions, item 8) | tooling | doc-update (proposed below: the pin) | project |

## Proposed updates

### `plugins/core/agents/commit-and-pr.md` (bug-class)
Step 5 "Open the PR": name the flag that reads the heredoc from stdin. `gh pr create --body -` takes the dash as the body text; `--body-file -` reads stdin. Bump devkit-core (0.5.3) with a CHANGELOG line.
- before: 5. **Open the PR** with `gh pr create`, body via HEREDOC. If the branch already has an open PR (`gh pr view --json url,state`), don't create another: the push already updated it, so stop at its URL.
+ after: 5. **Open the PR** with `gh pr create --body-file - <<'EOF'` (the body as a heredoc on stdin; never `--body -`, which `gh` takes as the literal body `-`). If the branch already has an open PR (`gh pr view --json url,state`), don't create another: the push already updated it, so stop at its URL.
- Answer: approved
- Applied: yes

### `plugins/openspec/skills/conduct/SKILL.md`, `plugins/openspec/hooks/guard.test.mjs`, `docs/openspec-flow.md` (doc-gap)
The fixed Auto-fix line (Waits on GitHub and Report) and the troubleshooting row "A start was refused" tell the owner to run a bare `/conduct`, which now asks which change. Say `/conduct <id>` (or `/conduct round <n>`); the pin in `guard.test.mjs` ("the report names the five states") follows. Bump devkit-openspec (0.10.1) with a CHANGELOG line.
- before: run `/conduct` again to go on. · Type `/conduct` again; the phase is never run as a subagent in its place
+ after: run `/conduct <id>` (or `/conduct round <n>`) again to go on. · Type `/conduct <id>` (or `/conduct round <n>`) again; the phase is never run as a subagent in its place
- Answer: approved
- Applied: yes

### `docs/adr/0001-coordination-without-a-harness.md` (doc-gap)
The Note in Consequences names only the roadmap round as the exception; add the single change and ADR 0007.
- before: - Note: conducting a roadmap round (the next steps of several changes at once, each in its own worktree, and in the desktop app each implementation phase as a child session the conducting skill starts) is an exception recorded in ADR 0006 (0006-phases-as-child-sessions.md), which supersedes ADR 0005 (0005-parallel-steps-and-a-session-wake-up.md). This ADR's Decision governs everything else.
+ after: - Note: conducting a change on request (`/conduct <id>`, and on an explicit `round <n>` the next steps of several changes at once, each in its own worktree; in the desktop app each implementation phase is a child session the conducting skill starts) is an exception recorded in ADR 0006 (0006-phases-as-child-sessions.md), which supersedes ADR 0005 (0005-parallel-steps-and-a-session-wake-up.md), and in ADR 0007 (0007-one-change-on-request.md), which amends it. This ADR's Decision governs everything else.
- Answer: approved
- Applied: yes

### `docs/openspec-flow.md` (tooling)
The CI snippet pin follows the devkit-openspec release made by the proposals above (0.10.1): the test "the pin in docs/openspec-flow.md is the commit sha of v + the devkit-openspec version" in `deliver-check.test.mjs` requires it, and `unnamedFiles` accepts the file only when a proposal names it. Every `v0.10.0` in the snippet and its prose becomes `v0.10.1`; nothing else in the file changes beyond the row above.
- before: # pinned to the commit of v0.10.0 (a tag can move; a commit cannot) · <commit sha of v0.10.0> in the raw URL · the prose "(`v0.10.0` above)" and "git/ref/tags/v0.10.0"
+ after: the same lines with v0.10.1
- Answer: approved
- Applied: yes

### user memory (memory-only)
When a plan adds a mode flag to a checker a skill calls, grep the skill for every call of that checker (watch, recompute and continuation lines included) before the readiness review; a flag that reaches only the first call is the sweep the flag was meant to prevent.
- Answer: approved
- Applied: yes

## Dogfood

Pending: AC-9's live half (the owner's typed `/conduct <id>` on one change in the desktop app with devkit-openspec 0.10.0 installed: the single row, the unfinished-work question when it applied and the owner's answer, the child sessions under the change's group, no other change touched, and a bare `/conduct` answered with the list of open ids and a question). Needs `claude plugin update devkit-openspec@devkit` in the project first (CONTRIBUTING, "Testing a pack locally"); this session runs the 0.9.1 pack. Not run by this session: only the owner's typed `/conduct <id>` is the go-ahead. Recorded here once the owner runs it.

Recorded on 2026-11-11, conducting `release-rebase-pin` (schema `devkit`) with `/conduct release-rebase-pin`, typed by the owner, in the desktop app with devkit-openspec 0.10.3 installed at project scope (`claude plugin update` reported every pack already at its latest version).

- **The single row.** Every `conduct-check --json --change release-rebase-pin` (`DEVKIT_HOST=app`) returned `mode: "change"` and one row only: `release-rebase-pin`, schema `devkit`, `round: null` (the single-change run reads no roadmap), `sessionPrefix: "release-rebase-pin-p"`. The round 5 changes (`commit-and-pr-trailer`, `conventions-trailer`) never appeared in the report, and nothing of theirs was read or touched: their worktrees kept their uncommitted files.
- **The unfinished-work question.** Not asked on the first two typed runs (`unfinished: null`: only the untracked change folder under `openspec/`). Asked on the third: "7 uncommitted paths outside openspec/: docs/openspec-flow.md, plugins/openspec/README.md, plugins/openspec/hooks/conduct-check.mjs" (the run's own phase 1, gate green, uncommitted by design until the last phase). The owner answered "Sim, seguir" and phase 2 started. Every refused start therefore costs one extra question on the re-typed `/conduct`.
- **Child sessions.** `release-rebase-pin-p1` and `release-rebase-pin-p2` started with `use_worktree: false` in the change worktree, `wake_when_done: true`. Each ended a first turn without an `Outcome:` line while its `tdd-implementer` ran in the background, then a second turn with `Outcome: success`. Two starts were refused by the app ("Start sessions only on the user's own words to you here"): phase 1 when the plan approval was asked in a turn opened by the readiness agent's notification, and phase 2 when the phase 1 gate ran as a background Bash (its completion is a task notification, not a `<side-sessions-event>`). Both started on the owner's next typed `/conduct`.
- **Grouping.** The group `release-rebase-pin` was created, but `move_sessions` was refused for both children: "nested sessions move with their parent" (the conducting session, which the skill never moves). Report lines: `not grouped: release-rebase-pin-p1 (nested under the conducting session)`, the same for p2. In the sidebar the children show nested under the conducting session; the group stays empty.
- **Archive and worktrees.** Each child was archived once its gate ticked ("phase 1 of release-rebase-pin: gate green", then phase 2). `git worktree list` right after the first archive still listed `/Users/kauesantos/Documents/devkit/.claude/worktrees/release-rebase-pin 94e795d [release-rebase-pin]`, with the uncommitted phase 1 edits intact. Side effect: the app moved the conducting session's working directory to the main checkout and back.
- **No other change touched.** The run never read `openspec/roadmap.md` and touched no other change's worktree or branch.
- **Delivery.** Review round 1 (four reviewers) failed on one `[important]` test-coverage finding; round 2 passed. PR https://github.com/chacal88/devkit/pull/21 reached 8/8, `enable-auto-merge` ran with `--match-head-commit`, and GitHub merged it at once (b39daf5).
- **Not exercised.** A bare `/conduct` (the list of open ids and a question) was not run in this session; that half of AC-9 stays pending.
