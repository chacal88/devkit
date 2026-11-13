# Changelog

## 0.16.0 — evidence before review

- **devkit-openspec** 0.13.0: `deliver-check` puts evidence before review (the `evidence` step comes before `review` in the next-step order); the instructions, skills and docs of the flow follow. The CI snippet pins `v0.13.0`.
- **devkit-core** 0.6.2: the README names evidence before review.
- **devkit-panel** 0.2.1: `Provas` comes before `Revisão` in the ten steps.
- Docs: the flow doc, CONTRIBUTING's release tag rule (a release that changes devkit-openspec's version is tagged on its merge commit) and the CI pin at `v0.13.0`.

## 0.15.0 — retro of panel-conduct-view

- **devkit-core** 0.6.1: the `requirements-grill` skill numbers acceptance criteria `AC-<n>` (with the slug beside) and ends a change with a visible screen in a mock kept in `mock/`; `tdd-implementer` never ticks a `Gate:` task; `pr-verifier` copies each gate part verbatim into its Gates table; the stage-3 writer prompt of the review round names the verdict the round computed (`Verdict: approved` or `rejected`), pinned by a test.
- Docs: CONTRIBUTING's "Testing a mod pack" gains the version-agnostic binary form, live loading of a work-in-progress pack and what the desktop surface draws.

## 0.14.0 — panel: the conducted change

- **devkit-panel** 0.2.0: the pane draws the change this session conducts (its newest `/conduct <id>`, else its own child sessions) with the next step, who acts, the phases, the PR and its checks, the eight delivery items and the phase child sessions, and folds the other changes in progress below it; a press on a child opens it, a filled button shows it is filled, and the band shows the conducted change. The layout is the owner's approved mock: the change with its summary, an `Agora` box, ten `Passos` with where the change stands, the open tasks as `Pendências`, the change's documents, and a second detail pane (Escape or `✕` closes it) for a step, the pending list, a document, another change or an error line; the phase bar, the Delivery group and the Ship button are gone, and a phase marked `owner-run` reads as the owner acting. It calls `$.ui.copy` (`Copiar`, on your press) and `$.ui.scroll` (the document's section index) besides what it called before; nothing is sent. It loads in the npm `claude` too (`userConfig.language.options` and the hooks entry are gone). The round view, `Archived` and the `--change` probe are removed; devkit-openspec 0.10.0 or newer is needed. Read-only, as before.
- Docs: the panel's README and "The panel: devkit-panel" in `docs/openspec-flow.md` are rewritten; CONTRIBUTING says the npm `claude` validates the repository and the pack again but has no `plugin test`.

## 0.13.0 — reviews as a workflow

- **devkit-core** 0.6.0: the `review-change` round runs in three stages (the reviewers in parallel, three `finding-verifier` agents per blocking or important finding, the reviewers writing their own files), as one Workflow script (`review-round.workflow.js`) on the owner's typed turn and with the Agent tool on any other turn or when the tool is missing, through the same rules (`review-round.mjs`: `stage1`, `verify`, `outcomes`, `consolidate`, `check-file`). A new read-only agent, `finding-verifier`; a `### Staged round` paragraph in the six reviewers; `review.md` gains the path, the verified and refuted counts and the notes.
- **devkit-openspec** 0.12.0: an approved review with an undisposed blocking or important finding is `fix-review` in `deliver-check`, not `review`; the `review` rows of `ship-change` and `conduct` run the round through the Workflow tool as `review-change` describes, with the busy mark until its notice. The CI snippet pins `v0.12.0`.
- Docs: ADR 0008, ADR 0001's Note, "The review round" in `docs/openspec-flow.md`.

## 0.12.0 — release-rebase pin

- **devkit-openspec** 0.11.0: a conflict in `docs/openspec-flow.md` that is only the CI pin (pins masked, `git merge-file -p` clean) is `resolve-release-conflict` in `conduct-check` and is resolved by `release-rebase.mjs` at every stop; anything beyond the pin is still blocked in `conduct-check` and exit 2 in `release-rebase.mjs`. After every replay the pins follow the resolved devkit-openspec version. A new error, `cannot set the pin:`, when the base's version cannot be read. `RELEASE_FILE` and ADR 0003's exemption are unchanged. The CI snippet pins `v0.11.0`.

## 0.11.1 — retro of devkit-panel

- **devkit-openspec** 0.10.3: `scripts/check.py`'s language check blanks fenced blocks and backticked spans before scanning (a quoted UI string is a quotation, not prose), pinned by a guard test; the CI snippet pins `v0.10.3`.
- Docs: round 8 of `openspec/roadmap.md` is `release-rebase-pin` (the CI pin collision becomes a change); CONTRIBUTING gains "Testing a mod pack" (the app's bundled binary, the rollout-switch warm-up, how a gate line is read) and the rule to re-read what a change consumes from a sibling after a rebase; a troubleshooting row in `docs/openspec-flow.md` for a conducting session started in another folder.

## 0.11.0 — devkit panel

- **devkit-panel** 0.1.0: a new pack, a Claude Code mod for the desktop app. A side pane over `conduct-check --json` and `deliver-check <id> --json`: the round's changes with their state, next step and actor, the eight delivery items and the linked child sessions (`^<sessionPrefix>[0-9]+$`) of an unfolded row, the other and archived changes by name; a one-line band above the prompt with an `Open` / `Close` button; `/devkit-panel` (`status` prints the pane as text) and the `mcp__devkit-panel__status` tool. The `Conduct`, `Ship`, `Approve` and `Answer` buttons fill the prompt box with the owner's next command and never submit it. Read-only: no session start, no file write, no `prompt.submit`, no schedule beyond its 60 s refresh while the pane is open. It runs the repository's own `plugins/openspec/hooks/` in the devkit repository, else the `devkit-openspec` installed at project scope (user scope as the fallback). `userConfig.language` (`pt-BR` by default, `en`) selects its texts.
- **devkit-openspec** 0.10.2: `openspec-setup --packs` accepts `devkit-panel` (`PACKS` of `project-settings.mjs` lists it; `DEFAULT_PACKS` unchanged); the CI snippet pins `v0.10.2`.
- Docs: the pack row in `docs/conventions.md`, "The panel: devkit-panel" in `docs/openspec-flow.md`, `plugins/panel/README.md` and `docs/catalog.md`; `scripts/gen-catalog.py` lists the pack. No change to devkit-core.

## 0.10.1 — retro of conduct-one-change

- **devkit-core** 0.5.3: `commit-and-pr` opens the PR with `--body-file -` (the body as a heredoc on stdin), never `--body -`.
- **devkit-openspec** 0.10.1: the Auto-fix line says `/conduct <id>` (or `round <n>`); the CI snippet pins `v0.10.1`.
- Docs: ADR 0001's note names the single change and ADR 0007.

## 0.10.0 — one change on request

- **devkit-openspec** 0.10.0: `conduct-check --change <id>` restricts the report to the one change the owner names, with the same engine and row, and never reads the roadmap (`--round` does not combine with it, exit 3). A missing change is exit 3 with a prefix (`no change <id>:`, `change <id> has a worktree without a folder:`, `change <id> is on another branch:`). The JSON stays version 2 with `mode`, `change` and `unfinished` as additive fields.
- `/conduct` has three argument forms: `<id>` conducts exactly that change, `round <n>` is the explicit round mode, and a bare `/conduct` lists the open ids and asks, never sweeping. Before a change runs on a turn the owner typed, unfinished work in its worktree (uncommitted product paths, half-done phases) is reported and goes on only on the owner's own message. A missing change is created only after the owner confirms the id and the schema.
- Docs: ADR 0007 records one change on request and amends ADR 0006; round 7 of `openspec/roadmap.md` is this change; the CI snippet pins `v0.10.0`.

## 0.9.1 — retro of conduct-sessions

- **devkit-openspec** 0.9.1: the `ship-change` `commit` row names what to stage (`next.paths` plus every other modified or untracked file under `openspec/`).
- Repo: `scripts/check.py` requires a CHANGELOG heading for the marketplace version, pinned by a guard test.
- Docs: CONTRIBUTING notes updating the installed pack before dogfooding.

## 0.9.0 — phases as child sessions

- **devkit-openspec** 0.9.0: `conduct-check --json` is version 2 (**BREAKING** for consumers of the JSON: the `wake` field is removed, `version` is 2). In `host: app`, a change whose next step is `implement` carries `next.actor: "session"` and a `session` descriptor (title, name, cwd, branch, phase, brief, background), and every change row carries `sessionPrefix`; in `host: cli` the subagent actor is unchanged.
- `/conduct` starts one child session per phase in the change's worktree (`start_session` with `wake_when_done`), never a subagent in its place. A refused start ends that change's run as `waiting for the owner: start session <id> phase <n>`. Only the owner's typed `/conduct` is the go-ahead; a continuation turn after a child's end starts the next phase. Children join a sidebar group named after the change and are archived when the phase's gate is ticked. There is no session cron (the first run after the upgrade deletes a `/conduct` cron left by 0.8.0); waits on GitHub are one capped watch plus the app's PR Auto-fix.
- Docs: ADR 0006 records phases as child sessions and supersedes ADR 0005; ADR 0001 points to it; round 6 of `openspec/roadmap.md` is this change; the CI snippet pins `v0.9.0`.

## 0.8.0 — conduct rounds

- **devkit-openspec**: the `conduct` skill conducts every change of the current `openspec/roadmap.md` round from creation to archive. `conduct-check` (read-only, `--json`) computes each change's next step, who does it and whether the session should wake itself later; independent changes run their steps in parallel git worktrees (at most three at once, as background subagents), and a change with `after:` plans early and waits for its dependency's archive. `release-rebase` resolves release-file conflicts (versions, CHANGELOG, catalog) by rule, in the change's worktree. `/conduct round <n>` starts at a named round.
- The hooks are worktree-aware: the root comes from the edited file or from a command's own `cd`, not only from the session's folder, and the opt-in check applies to each target root.
- `approval.md`: the owner's recorded plan approval, written only by the main session from the owner's own message. `deliver-check` gains the `stop-plan-approval` stop for a `devkit` change not yet started whose readiness is APPROVED but has no current approval; a change with a ticked task is unaffected.
- Docs: ADR 0005 records parallel step subagents and a session wake-up (every 20 minutes) as an exception to ADR 0001; round 5 of `openspec/roadmap.md` is the dogfood round; the CI snippet pins `v0.8.0`.

## 0.7.1 — retro of devkit-opt-in

- **devkit-core** 0.5.2: `tdd-implementer` stops a hung command by its own PID only, never `pkill`/`killall` by pattern.
- **devkit-openspec** 0.7.1: the `devkit` schema's Request line says how to quote a request in another language (faithful translation marked "(translated from <language>)").
- Docs: the CI snippet pins `v0.7.1`; `docs/migrate-to-project-scope.md` items 3 and 4 keep the first backup (`cp -n`) and write through a temporary file, so they are safe to run twice; a test pins both.

## 0.7.0 — devkit per project

- **devkit-openspec** (BREAKING): the hooks (`session`, `edit`, `bash`) act only in projects whose `openspec/config.yaml` selects the `devkit` or `devkit-lite` schema; everywhere else they are silent, destructive git included. `ci` is unchanged. `install-schemas.sh` with no argument now installs into the current project (`--user` for machine-wide, the old default). New `project-settings.mjs` writes the project's `.claude/settings.json` opt-in; `openspec-setup` runs it and installs the schemas into the project.
- **devkit-core** 0.5.1, **devkit-design** 0.1.1, **devkit-stack** 0.1.1, **devkit-ai-engineering** 0.1.1: the READMEs install with `claude plugin install <pack>@devkit --scope project`.
- Docs: ADR 0004 records devkit as opt-in per project; `docs/migrate-to-project-scope.md` removes the old user-scope install from a machine, item by item; `scripts/check.py` refuses a `plugin install` line without `--scope project`; this repository opts in through its `.claude/settings.json`; the CI snippet pins `v0.7.0`.

## 0.6.0 — archive after merge

- **devkit-openspec**: after a change PR merges, `deliver-check` and `ship-change` go on to the archive steps (`retro`, `stop-retro-answers`, `archive`, `tick-roadmap`, `apply-proposals`, `open-archive-pr`, `archive-pr-ready`, `stop-archive`, `archived`): the owner answers each retro proposal, and the archive lands through a PR on `chore/archive-<id>` that GitHub auto-merges in `merge` mode (a file the owner did not approve stops the run). The guard hooks and `--ci` never select another change from an archive branch, so the archive PR passes `devkit-reviews`. In `pr` mode a merged PR now leads to the archive steps instead of `blocked: item 5`, and `merged` is no longer a final `next.step`.
- **devkit-core**: `retro` writes proposals in a format `deliver-check` reads (exact paths, `None.`, `Answer:` and `Applied:` lines); `commit-and-pr` gains the archive call; `tdd-implementer` gains the apply-proposals call.
- Docs: ADR 0003 records auto-merging the archive PR without 8/8, ADR 0002 notes round 3 has no bypass; the CI snippet pins `v0.6.0`.

## 0.5.1 — auto-merge retro

- **devkit-core**: `adr-reviewer` cites ADRs by repo-root path in backticks instead of relative links, which broke when a change folder was archived.
- Docs: ADR 0002 notes that GitHub records an auto-merge under the identity that enabled it; CONTRIBUTING asks to amend `design.md` when a readiness note is resolved differently.

## 0.5.0 — auto-merge

- **devkit-openspec**: new `merge` ship mode (with `merge_method`): at 8/8 `ship-change` enables GitHub auto-merge pinned to the checked head and disables it when the contract drops; `deliver-check` gains the merge steps and a `--ci` mode (the `devkit-reviews` check); new `merge-setup.mjs`, the `devkit-reviews` workflow template and the read-only-by-default `github-setup.mjs` in `openspec-setup`. `guard.mjs ci` now runs the same stale-aware check: it needs `deliver-check.mjs` beside it, the full history and the PR head checked out.
- **devkit-core**: `commit-and-pr`, `review-change` and the README say the merge is the owner's, or GitHub's in `merge` ship mode; `commit-and-pr` itself still never merges.
- Docs: ADR 0002 records merging without the owner by opt-in; the CI snippet and workflow template pin `v0.5.0`.

## 0.4.0 — ship modes

- **devkit-openspec**: new `ship-change` skill drives one approved change to a ready PR from your own session, configured by an optional `ship` key in `openspec/config.yaml`; new `deliver-check` module (JSON contract) computes the next step from the repository and GitHub; `guard.mjs` exports its checks for reuse.
- **devkit-core**: reviewers, `pr-verifier`, `commit-and-pr`, `tdd-implementer` and `review-change` gain the output formats (`Commit:` line, gates table, commit-only mode) that `deliver-check` parses.
- Docs: ADR 0001 records why coordination is allowed but a harness is not; the CI snippet pins `v0.4.0`.

## 0.3.0 — rounds without an orchestrator

- **devkit-openspec**: optional `openspec/roadmap.md` groups changes into rounds (`## ` headings, `- [ ] <change-id> (after: ...)` lines). The session hook prints the current round, `done/total` and each pending change's state (`not started`, `open`, `waiting on ...`, `archived, tick it`), with or without an active change. It reports only; no gate reads it. The setup template's archive guidance now ticks the line.

## 0.2.0 — lighter by default

A full-flow run on a one-function change took over an hour, mostly in review loops on Opus with mutation testing. Now:

- **devkit-openspec**: `devkit-lite` is the default schema in the project template and accepts an optional spec delta; the full `devkit` flow is for new capabilities, contract or data-model changes, sensitive areas, hard-to-revert or ambiguous changes. Full-flow tasks use as few phases as the work needs. The hooks follow `cd` inside a command and skip paths built from variables, fixing two false positives.
- **devkit-core**: reviewers and `plan-readiness-reviewer` run on Sonnet. Every reviewer has a Budget section (depth scaled to the diff, test suite at most once, re-review limited to previous findings). `test-coverage-reviewer` reads tests to judge seams and runs mutations only on request. `review-change` re-runs only reviewers that rejected, and `nit`s never trigger a round.

## 0.1.0 — first release

- **devkit-core**: 13 agents (`codebase-researcher`, `change-planner`, `plan-reality-auditor`, `plan-readiness-reviewer`, `tdd-implementer`, six reviewers, `pr-verifier`, `commit-and-pr`) and 8 skills (`requirements-grill`, `plan-readiness-review`, `review-change`, `test-and-coverage`, `test-driven-development`, `systematic-debugging`, `commit-message-guidelines`, `retro`).
- **devkit-openspec**: `devkit` and `devkit-lite` schemas for OpenSpec 1.16; hooks that give each gate file one writer (by subagent type), gate product code on an independently approved readiness and on the `tdd-implementer` agent, gate `gh pr create` on approved reviews plus evidence, and refuse destructive git; a `ci` mode for the same gates in CI; `openspec-setup` skill; `openspec-validator` agent.
- **devkit-design**: four DDD design phases plus `ddd-strategic-design`.
- **devkit-stack**: `postgres`, `neon-postgres`, `react-performance`, `vitest`, `saas-multi-tenant`, `threat-model`.
- **devkit-ai-engineering**: `llm-evaluation`, `multi-agent-patterns`, `agent-tool-design`, `agent-friendly-cli`, `context-compression`, `skill-scanner`.
