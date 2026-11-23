<!-- devkit-stage design result=passed attempt=2 commit=2300f84524e5c1ec5ed8a0da41e5a5dccff9cc34 -->
# Design

> Note (project-phases-followups, 2026-11-22): the slice ADR this plan calls ADR 0014 shipped as ADR 0015 (`docs/adr/0015-a-project-slice-is-a-change-delivered-in-one-pull-request.md`), because another change took the number 0014 first (`docs/adr/0014-each-roadmap-change-runs-in-a-session-of-its-own.md`). The approved text below is unchanged.

Change: `project-phases` · Date: 2026-11-21 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(design sources: `requirements.md`, `docs/coordination-design.md` sections 1, 7, 8, 11 and 13,
`docs/adr/0010-openspec-as-the-harness.md`, `docs/adr/0012-the-reviews-check-follows-the-change-script.md`).
Paths are written relative to the repository root and in backticks, never as links: this file moves
one folder deeper when the change is archived. Line numbers are those of `2300f84`.

## Context

See `proposal.md` (Why). What exists at `2300f84`, each fact read in the source:

- `plugins/openspec/hooks/change-loop.mjs` (1320 lines) decides `/devkit change`. `startMode`
  (`:806-841`) answers `not-built` for `VERB_ROUND = { project: 19, help: 23 }` (`:783`, `:816`), runs
  only `change`, `roadmap` and `status` (`:817`), and hands `roadmap` and `status` to the skill with
  `out(verb)` (`:820`). `unfinished(start, opts)` (`:736-746`) lists every active folder of every
  checkout, whatever its schema, and `knownChange` (`:749-755`) resumes any folder named by
  `/devkit change <id>`. `openChange` and `openUnderLock` (`:916-969`) hold the open steps: the open
  lock, `git fetch`, the id check (`nameTaken`, `:868`), `git worktree add` from `origin/<default>`,
  `openspec new change`, the requirements file, and the clean-up of a half-made open. `NAME` (`:848`)
  is the id rule; `SCRIPTS = ['devkit', 'devkit-lite']` (`:845`). `render` and `MESSAGES` (`:96`,
  `:351`) are the one message table; `waitLoop` (`:1004`) is the stateless background wait.
- `plugins/openspec/hooks/flow-check.mjs` (669 lines) holds the stage header reader (`STAGE_HEADER`,
  `parseStageHeader`, `:19-28`), `readFlowFile` (`:48-77`, which accepts any stage ids), `collectFlow`
  (`:238-279`, `gh` only at a `github` stage) and `computeFlow` (`:446-543`). When every stage is settled
  it offers `retro` by name (`:523`), and `readDelivery` sends a failing check to `implementation` by
  name (`:229`); `offer` looks the stage up and would throw on a stage the script lacks (`:507-511`).
- `plugins/openspec/hooks/guard.mjs` (773 lines): `DEVKIT_SCHEMAS` and `optedIn` (`:147-157`, the
  project-level opt-in of ADR 0004); `classify` (`:208-227`) makes `reviews/<reviewer>.md` a gate file
  only inside the active change's folder; `writeViolation` (`:229-253`) needs a readiness only where the
  change's schema declares one; `prViolation` (`:333-343`) asks every change for the two required
  reviewers and `evidence.md`; `guardBash` (`:495-540`) applies it to `gh pr create` for the change
  `resolveChange` picks, which falls back to the only active change (`:114-129`); `runOf` and
  `roadmapRunOf` (`:356`, `:436`) end a run on any other typed slash command; `parseRoadmap`
  (`:588-610`) reads rounds from `## ` headings and items from checkbox lines.
- `plugins/openspec/hooks/deliver-check.mjs` (1718 lines): `runCi` (`:1552-1597`) selects a change by
  branch or touched folders (`selectCiChange`, `:1473-1504`), passes any schema but `devkit` and
  `devkit-lite` with a note (`:1588-1592`), and, when none is selected, judges archived folders by
  schema (`archivePrCheck`, `:1529-1550`: another schema is a note). `staleness` (`:193-212`) calls a
  recorded commit stale when any later commit touches a path outside `openspec/`. The CI job downloads
  only `guard.mjs`, `deliver-check.mjs` and `merge-setup.mjs` (`docs/openspec-flow.md`, CI section).
- `plugins/design/skills/` holds the five `devkit-design` skills; each writes to `docs/design/` with
  one `docs/design/STATE.md`, the architecture skill defaults the ADR folder to `docs/decisions/`, and
  the plan skill hands its backlog to `openspec-propose`.
- `plugins/openspec/skills/openspec-setup/scripts/install-schemas.sh` copies `devkit` and
  `devkit-lite` only; `changes-under-way.mjs:45` calls any other schema untouched by an upgrade.

## Goals / Non-Goals

**Goals:** one command and one script that carry a slice from its name to a merged pull request; a
declared schema the checker walks; a CI check that holds the light review; the design skills usable
alone; nothing changed for `/devkit change`, `/devkit roadmap` or `/devkit status` beyond keeping
slices out of them.

**Non-Goals (design level):** a lock that holds a `/devkit project` run (D-12); a slice row in
`/devkit status`; a retro or an archive pull request for a slice; any change to how a change on
`devkit` or `devkit-lite` is opened, walked, checked or merged.

## D-1 What a slice is (A-1, A-5, A-6, A-10; AC-1, AC-3, AC-8)

Facts probed on 2026-11-21 with OpenSpec 2.0.0 and a throwaway `devkit-project` schema in a scratch
repository (`openspec schema validate`, `openspec new change`, `openspec status --json`,
`openspec validate --strict`, `openspec archive --yes`):

- F1. A schema with no spec artifact and no `apply` block validates, and `openspec new change <id>
  --schema devkit-project` writes `skip_specs: true` into the change's `.openspec.yaml` by itself.
- F2. `openspec validate <id> --strict` passes such a change with zero deltas.
- F3. `openspec archive <id> --yes` moves the folder to `openspec/changes/archive/<date>-<id>/` even
  when an artifact is missing; it refuses nothing, so the loop checks the stages itself first (D-9).

**Decision.** A slice is an OpenSpec change on the `devkit-project` schema whose id is the slice's
name, in a worktree `.claude/worktrees/<slice>` on branch `<slice>`, as a change is. Two places hold it:

| Where | What | Who reads it |
|---|---|---|
| `openspec/changes/<slice>/` | `.openspec.yaml` and one stage record per stage: `business.md`, `domain-model.md`, `architecture.md`, `implementation-plan.md`, `roadmap.md`, `review.md`, plus `reviews/adr-reviewer.md` | `flow-check`, `project-loop.mjs`, `devkit-reviews` (after the archive) |
| `docs/design/<slice>/` | `1-business-vision.md`, `2-domain-model.md`, `3-architecture.md`, `4-implementation-plan.md` (today's names), `STATE.md` (the slice's progress notes: stopping point, pending questions, parking lot) | the owner, the next phases, the next slices |

A stage record opens with the stage header and says which document it stands for, the owner's
approval in the owner's own words, or the reason the stage does not apply (templates, D-2). The
record is the gate; `STATE.md` keeps the in-phase notes the skills already keep, and its progress
table is informative only (the headers decide). New ADRs go to the project's ADR folder
(`docs/adr/`, or `docs/decisions/` when that is the project's), never under `docs/design/`.

A flat `docs/design/` (the `1-` to `4-` files and `STATE.md` at its top) is read as context and never
written: the skills' new output path is always `docs/design/<slice>/`, and the CI path rule (D-11)
fails any pull request of a slice that touches it.

**Alternatives.** (a) The progress in `docs/design/<slice>/` with a header on each document and no
OpenSpec change: rejected, because ADR 0010 decision 1 names the `devkit-project` schema, and it would
need a second walker beside `flow-check` and give up `openspec status` and `openspec instructions`.
(b) The documents inside the change folder, moved to `docs/design/<slice>/` at the end: rejected; the
owner reads them in `docs/design/<slice>/` while the slice runs (A-1), and a move is one more step that
can half-fail. (c) A `{change}` placeholder in `flow.json` file paths so the headers sit on the
documents: rejected; OpenSpec's `generates` has no placeholder, so `openspec status` would never see the
stages done.

## D-2 The `devkit-project` schema (AC-2, AC-3, AC-4)

New folder `plugins/openspec/schemas/devkit-project/` and its byte-identical copy
`openspec/schemas/devkit-project/` (`CONTRIBUTING.md`, "Changing the OpenSpec schemas").

**`schema.yaml`**: `name: devkit-project`, `version: 1`, a description, and six artifacts, each
`requires` the one before (`business` requires none): `business` (`business.md`), `domain-model`
(`domain-model.md`), `architecture` (`architecture.md`), `implementation-plan`
(`implementation-plan.md`), `roadmap` (`roadmap.md`), `review` (`review.md`). No `apply` block. Each
instruction opens with `Role: <role>. Skills: <skills>.`, then the stage-header paragraph the two other
schemas use word for word, then what the stage does:

- the four phases: "Run the `<skill>` skill with the owner, in the session, for the slice named by the
  change id: its document is `docs/design/<id>/<file>`, its notes `docs/design/<id>/STATE.md`, and every
  new ADR goes to the project's ADR folder (`docs/adr/` when it has none). Read the earlier phases'
  documents of this slice and, as context only, a flat `docs/design/` and other slices' folders; never
  edit them. Write this record with `result=pending` when the document is shown to the owner for
  approval; set `result=passed` only from the owner's explicit approval, quoting the owner's words
  under `## Owner's approval`. When the owner and the session agree the phase does not apply, write the
  document with one paragraph saying so and why, and this record with `result=not-applicable` and the
  reason under `## Not applicable`." The architecture and plan records also list the ADR files they
  added under `## ADRs`. Gate: the owner approved, or the phase does not apply with its reason.
- `roadmap`: "From the change backlog of `docs/design/<id>/4-implementation-plan.md`, propose rounds
  and changes in the roadmap's own format between the two markers of the template; check them with the
  check command the action gives; show them to the owner; set `result=passed` only from the owner's
  approval, quoting it. When no change comes out of the slice, `result=not-applicable` with the reason;
  `openspec/roadmap.md` is never edited by hand." Gate: the owner approved, or not applicable.
- `review`: "Written by the loop from `reviews/adr-reviewer.md`, never by hand." Role `adr-reviewer`.

No instruction, template or declaration names a platform tool or a `devkit-core:` agent type
(`change-stages`, ADDED "The project script follows the declaration rules").

**`flow.json`** (`version: 1`, `script: devkit-project`, `ceilings: { default: 3 }`):

| # | id | source | file | role | skills | part | other | title `en` / `pt-BR` |
|---|---|---|---|---|---|---|---|---|
| 1 | `open` | folder | | `project-coordinator` | | open | | Open the slice / `Abrir a fatia` |
| 2 | `business` | artifact | `business.md` | `project-coordinator` | `design-business-discovery` | plan | `owner: true` | Business / `Negócio` |
| 3 | `domain-model` | artifact | `domain-model.md` | `project-coordinator` | `design-domain-model`, `ddd-strategic-design` | plan | `owner: true` | Domain model / `Modelo de domínio` |
| 4 | `architecture` | artifact | `architecture.md` | `project-coordinator` | `design-architecture` | plan | `owner: true` | Architecture / `Arquitetura` |
| 5 | `implementation-plan` | artifact | `implementation-plan.md` | `project-coordinator` | `design-implementation-plan` | plan | `owner: true` | Implementation plan / `Plano de implementação` |
| 6 | `roadmap` | artifact | `roadmap.md` | `project-coordinator` | | plan | `owner: true` | Roadmap / `Roadmap` |
| 7 | `review` | artifact | `review.md` | `adr-reviewer` | | after | `codeBound: true`, `ceiling: 2`, `onFail: architecture`, `staleAfter` the five stages before | ADR review / `Revisão dos ADRs` |
| 8 | `delivery` | github | | `commit-and-pr` | `commit-message-guidelines` | delivery | | Pull request / `Pull request` |

`codeBound` makes the review stale when a later commit touches a path outside `openspec/` (the
checker's existing rule, `flow-check.mjs:404-409`), so the documents are committed before the review
(D-8). With no `tasks` stage, `heldByTasks` never applies (`flow-check.mjs:490`).

**Templates** (six, `templates/<stage>.md`), each with line 1 `<!-- devkit-stage <stage> result=pending
attempt=1 commit=none -->`, a title `# <Stage title>: <slice>`, and the sections: phases `## Document`,
`## Owner's approval`, `## Not applicable` (architecture and plan also `## ADRs`); `roadmap.md` `## Source`,
`## Rounds to append` holding the two marker lines `<!-- devkit-rounds:begin -->` and
`<!-- devkit-rounds:end -->`, `## Owner's approval`, `## Not applicable`; `review.md` `## Verdict` (filled
by `record-review`).

**Role.** `project-coordinator` is the session the owner typed `/devkit project` in; it has no agent
file, like `change-coordinator`, `review-bench` and `owner`. `docs/roles.md` gains its section (D-17);
`change-loop.mjs#scriptAgents`'s `NOT_AGENTS` (`:1118`) gains it, so a hand-off list never names it.

## D-3 The checker and the shared header reader (AC-2; change-stages ADDED)

- `STAGE_HEADER` and `parseStageHeader` move from `flow-check.mjs:19-28` to `guard.mjs`, unchanged;
  `flow-check.mjs` imports and re-exports both, so every importer keeps working. Reason: the CI job
  downloads `guard.mjs` and not `flow-check.mjs`, and the slice contract (D-11) reads headers. One
  reader for the header, as before.
- `computeFlow`'s `offer` (`flow-check.mjs:507`): when `stageId` is not a stage of the declaration, the
  report ends `blocked` with the new reason code `undeclared-stage`, params `{ stage, why }` where `why`
  is the reason text the walk would have offered (`TEXT.en` / `TEXT['pt-BR']` gain the sentence "the
  script declares no `<stage>` stage (`<why>`)", in both languages). This covers `offer('retro')` at
  `:523` and `readDelivery`'s `implementation` (`:224`, `:229`) on a script without them. Nothing
  changes for `devkit` and `devkit-lite`, which declare both stages.
- Nothing else in the checker changes: it walks a slice's records like any change's.

## D-4 The entry and the other commands (AC-1; change-coordination MODIFIED; project-definition "not a change")

`change-loop.mjs`:

- `VERB_ROUND` becomes `{ help: 23 }`; `startMode` runs `change`, `roadmap`, `status` and `project`
  (`:817`), so `project` reaches `projectGate` (set up, settings known, driver `claude`) like the others
  and returns `out('project')` with `text` the rest of the words (`:820`). `verb-unknown` names the four
  commands in both languages (D-13).
- `unfinished` skips every active folder whose own `.openspec.yaml` names `devkit-project`
  (`changeSchemaAt`); the archive-branch entries are unchanged (a slice has none). So `/devkit change`
  never asks about a slice, and `roadmap-loop.mjs`, which calls `unfinished` for the board, the run and
  the draft (`:402`, `:501`, `:704`), never shows, starts or drafts one.
- `startMode` with a one-word text whose `knownChange` is a slice (its folder, active or archived,
  names `devkit-project`) returns mode `is-slice` with the reply `is-slice` and runs nothing.
- `SCRIPTS`, `openChange`'s behaviour and every `/devkit change` reply stay as they are.

The skill's `Start` section gains `project`: "the Project section below, with `text` as the words after
`project`" and `is-slice`: "say `reply` and end the turn".

## D-5 `project-loop.mjs`: commands, start and open (AC-1)

New `plugins/openspec/hooks/project-loop.mjs`, no AI, Node built-ins and the pack's hook modules only,
the same output shape and exit codes as `change-loop.mjs` (0 an action or delivered, 1 a wait, 2
blocked, 3 an error), every reply from `render`.

| Command | What it does |
|---|---|
| `start --lang <l>` (the words after `project` on standard input) | read-only: the mode of the start, below |
| `open <slice> --lang <l>` | creates the worktree, the branch and the change; reply `project-opened` |
| `next --slice <slice> --lang <l> [--after <key>]` | one action of D-6 |
| `status <slice> --lang <l>` | the readout of D-10 |
| `rounds <slice> --lang <l> [--write]` | checks the record's rounds; with `--write`, appends them (D-7) |
| `record-review <slice> --lang <l>` | writes `review.md` from the verdict file (D-8) |
| `archive <slice> --lang <l>` | archives the slice when every stage before the delivery is settled (D-9) |
| `wait --slice <slice> --lang <l> [--interval <s>]` | `waitLoop` over `next` (D-9) |

**The start** (`startProject(cwd, text, { lang, env, gh })`), in this order:

1. the project gate of `change-loop.mjs#projectGate` (the same replies as `/devkit change`);
2. `devkit-design@devkit` not enabled in `.claude/settings.json` or `.claude/settings.local.json` of the
   checkout: mode `design-pack-missing`, reply naming the pack and `/openspec-setup` with
   `--packs devkit-core,devkit-openspec,devkit-design`;
3. no text: the unfinished slices (`unfinishedSlices`, below): one is `resume`, several `choose` (listed
   with where each stopped), none `project-name-needed`;
4. a text that is not one word matching `NAME`, or is `archive`: `name-invalid`;
5. an unfinished slice of that name: `resume` (reply `project-resumed` with where it stopped);
6. a slice of that name archived on the default branch: `project-done-already`;
7. a change of that name (`knownChange`, another schema): `is-change` naming `/devkit change <id>`;
8. `docs/design/<slice>/` present on the default branch (`git ls-tree origin/<default>`, else the main
   checkout): `project-folder-exists`;
9. otherwise `new`.

**The open** reuses the open steps of `change-loop.mjs`: `openUnderLock` is split so its common part
becomes the exported `openCheckout(cwd, id, { script, lang, env, openspec, prepare })` (open lock,
fetch, `nameTaken`, worktree from `origin/<default>`, `openspec new change <id> --schema <script>`,
`prepare(folder)` for the script's own first file, and the clean-up of a half-made open). `openChange`
calls it with `prepare` writing `requirements.md` (its behaviour unchanged, `SCRIPTS` unchanged);
`project-loop.mjs open` calls it with `script: 'devkit-project'` and no `prepare`. One helper for the
mechanism.

**`unfinishedSlices(start, { env, gh })`**: every checkout's active folder on `devkit-project`, plus
every worktree on branch `<slice>` that holds `openspec/changes/archive/<date>-<slice>/` on
`devkit-project` while `<slice>` is not in `archivedOnDefault` (archived on its branch, pull request not
merged). Each once, sorted by id.

## D-6 The decision of a slice: `next` (AC-1, AC-3 to AC-7)

`nextSlice(cwd, slice, { env, lang, after, openspec, gh })` reads the facts, and the pure
`decideSlice(facts)` returns one action. The slice's checkout comes from `change-loop.mjs#locate`. While
the folder is active, `collectFlow` and `computeFlow` give the report, with `facts.delivery` replaced by
a function that answers `{ next: { stage: 'delivery', reasonCode: 'no-pr' } }`: an active slice is
always archived before its pull request, so the walk asks GitHub nothing (`flow-check <slice>` alone
still asks, as a readout).

Action kinds: `phase` and `rounds` (session conversations with the owner), `agent` (one hand-off),
`session` (one command the session runs), `end`. Every action carries `slice`, `root`, `branch`,
`filesLanguage`, `stage`, `stageTitle`, `progressKey` (`<stage>/<step>@<fingerprint>`, as
`change-loop.mjs` builds it).

**Where the session writes.** `root` is the absolute path of the slice's worktree
(`.claude/worktrees/<slice>` of the main checkout, from `locate`). Every path in an action's `detail`
is absolute and starts with `root`: `document`, `record`, `notes`, `adrFolder`, `earlier`, `findings`
and `source` alike. The session writes the documents, `STATE.md`, the new ADRs and the stage records at
those paths, never at a relative path: the checkout the owner typed `/devkit project` in is usually the
main one, which stays clean (`CLAUDE.md`), and the guard judges a write by the checkout of its target
path. Only `flat` reads outside `root`'s slice folder, and it is a boolean.

The rows, first match wins:

| # | When | Action |
|---|---|---|
| S1 | the slice is not found in any checkout | exit 3, `project-not-found` |
| S2 | archived on the default branch (`archivedOnDefault`) | `end` delivered (`project-delivered`, or `project-delivered-no-rounds` when `roadmap.md` is not applicable) |
| S3 | active; report next `open` (the folder exists without its `.openspec.yaml`, a half-made open) | `end` blocked `not-opened` |
| S4 | active; next is a phase with `no-file`, or the report ends waiting for the owner at a phase (`owner-pending`) | `phase`, step `interview` or `approval`; detail: `skills`, `document` (`<root>/docs/design/<slice>/<file>`), `record` (`<root>/openspec/changes/<slice>/<stage>.md`), `notes` (`<root>/docs/design/<slice>/STATE.md`), `adrFolder` (`<root>/docs/adr`, or `<root>/docs/decisions` when that is the project's), `earlier` (the absolute paths of the earlier documents of the slice that exist), `flat` (true when `<root>/docs/design/1-business-vision.md` exists) |
| S5 | active; next `architecture` with `fix-after-failure` (the review failed) | `phase`, step `revise`; detail adds `findings` (`<root>/openspec/changes/<slice>/reviews/adr-reviewer.md`) |
| S6 | active; next `roadmap` (`no-file`) or waiting at `roadmap` | `rounds`, step `propose` or `approval`; detail: `record` (`<root>/openspec/changes/<slice>/roadmap.md`), `source` (`<root>/docs/design/<slice>/4-implementation-plan.md`), `nextRound` (one more than the highest number of a `## Round <n>` heading, 1 with none), `checkCommand`, `writeCommand` |
| S7 | active; `roadmap.md` passed and some id of its rounds is not on `openspec/roadmap.md` | `session`, step `write-rounds`, detail `command` (`rounds <slice> --write`) |
| S8 | active; next `review` (`no-file`, `stale-code`, `stale-plan`, `rerun-after-fix`), a path outside `openspec/` uncommitted | `agent` `commit-and-pr`, step `commit`: commit the slice's files by name on its branch, push nothing |
| S9 | active; next `review`, `reviews/adr-reviewer.md` has a verdict whose `Commit:` is `HEAD` and `review.md` is missing or records another commit | `session`, step `record-review`, detail `command` |
| S10 | active; next `review` otherwise | `agent` `adr-reviewer`, brief of D-8 |
| S11 | active; next `delivery` | `session`, step `archive`, detail `command` |
| S12 | active; the report ends blocked (`ceiling-reached`, `no-progress`, `undeclared-stage`) | `end` blocked with the reason |
| S13 | archived on its branch; uncommitted change, no pull request, ship `plan` | `agent` `commit-and-pr`, step `commit` |
| S14 | archived on its branch; ship `plan`, nothing uncommitted | `end` waiting for the owner, `project-plan-mode` |
| S15 | archived on its branch; the review is stale by D-8's rule, or `review.md` is not passed | `agent` `adr-reviewer` (verdict file in the archived folder), then S9 over that folder |
| S16 | archived on its branch; no pull request | `agent` `commit-and-pr`, step `open-pr` (D-9) |
| S17 | pull request open, its head is not the local head, or something is uncommitted | `agent` `commit-and-pr`, step `push` |
| S18 | pull request open, a check failing | `end` blocked `checks-failing`, naming each check and its link |
| S19 | pull request open, conflicting with its base (`mergeable` `CONFLICTING`) | `end` blocked `branch-conflict`, naming the pull request and its base branch |
| S20 | pull request open, behind its base (`mergeStateStatus` `BEHIND`) | `session`, step `update-branch`, detail `{ number }`: the session runs the `ship-change` `update-branch` row (`gh pr update-branch <number>`, then `git pull --ff-only` in `root`) |
| S21 | pull request open, checks pending, or auto-merge on | `end` waiting on GitHub |
| S22 | pull request green, ship `pr` | `end` waiting for the owner, `project-pr-mode` |
| S23 | pull request green, ship `merge`, `mergeSetup` not ok | `end` blocked `merge-setup-missing`, naming what is missing |
| S24 | pull request green, ship `merge`, auto-merge off | `session`, step `enable-auto-merge`, detail `{ number, head, method }` |
| S25 | pull request merged | `end` delivered, as S2 |
| S26 | pull request closed unmerged | `end` blocked `pr-closed` |

S19 and S20 follow the delivery of a change: `deliver-check.mjs` item 5 blocks a conflicting pull
request with its number and base (`:599`) and offers `update-branch` for one behind it (`:1009`,
`:1130`), whose `ship-change` row updates it on GitHub. A conflict is not resolved by the loop and its
files are not listed: the loop merges nothing locally and does not fetch, and GitHub's `mergeable`
names no file. The owner resolves the conflict on the slice's branch and types `/devkit project <slice>`
again. An update that GitHub refuses is declared blocked by the session with `change-loop.mjs reply
blocked`, as any failed `session` step; the next run reads GitHub again and gives S19 when the refusal
was a conflict.

The pull request is the one whose head is the slice's branch (`deliver-check.mjs#fetchPr` with
`branch` and `list`); the checks come from `checksItem`, the setup from `merge-setup.mjs#mergeSetup`
with the project's `merge_method`, the ship mode from `shipConfig(root, 'devkit-project')`. A GitHub
read that fails ends blocked `github-unreadable`, as in `change-loop.mjs`.

**Progress guard.** As `change-loop.mjs` K1 and K2 (`decide`, `:486-498`): with `--after` equal to the
new action's key the run ends blocked `no-progress`; an `agent` stage (`review`) handed and still
missing or pending ends blocked `not-delivered`. An agent that answers `Outcome: failure` is declared
blocked by the session with `change-loop.mjs reply blocked`, as for a change.

**Brief** (agents): `Slice <slice> (devkit-project script), stage <stage>: <what>. Work only in <root>
on branch <branch>; every file path is absolute under it; start every Bash command with cd <root> && ;
do not fetch. Write the slice's files in <language>.` The commit hand-offs add: "Commit by name only
the files under docs/design/<slice>/, the ADR folders, openspec/roadmap.md and the slice's folder; never
on the default branch."

## D-7 The roadmap stage (A-3, A-8; AC-5, AC-6)

The session proposes the rounds from the plan's backlog and writes them between the markers of
`roadmap.md`, in the roadmap's own grammar (`guard.mjs#parseRoadmap`): a `## Round <n>: <title>`
heading, then one unticked checkbox line per change with its id, an optional `(after: <ids>)` and
` — <description>`. It runs `rounds <slice>` (the check), shows the owner the rounds, and on the owner's
approval sets the header to `passed` with the owner's words; the loop then gives S7.

`rounds <slice> [--write]`:

1. reads `openspec/changes/<slice>/roadmap.md`; a missing file, a `not-applicable` header, or no markers
   is exit 3 `rounds-missing` (not applicable is never written);
2. parses the text between the markers with `parseRoadmap`; refuses (exit 2, `rounds-invalid`, each line
   named) a block with no round or no item, a ticked item, an id that fails `NAME`, an id twice in the
   block, an id already on `openspec/roadmap.md`, an `after:` id that is not in the block before that
   line, not on the roadmap and not in `archivedOnDefault`, or text outside rounds;
3. without `--write`: prints `rounds-ok` with the ids and their `after:`; writes nothing;
4. with `--write`: refuses unless the header is `passed` (`rounds-not-approved`); when every id of the
   block is already on the roadmap and the file ends with the block, prints `rounds-already` and writes
   nothing; otherwise appends: the existing bytes, a newline when they do not end with one, one blank
   line, the block, a final newline; with no file, writes `# Roadmap`, a blank line and the block.

Not applicable (AC-6): the loop never calls `--write`; the CI contract fails a slice whose roadmap
record is not applicable and whose pull request touches `openspec/roadmap.md` (D-11).

`/devkit roadmap` reads the new lines as it reads any (`parseRoadmap`, `classifyLines`): proved by
`roadmap-loop.mjs status` on the scratch project after the write (D-19).

## D-8 The ADR review (A-4; AC-7)

**Brief** of S10 and S15: "review the slice's diff against origin/<base> (the documents under
docs/design/<slice>/ and the new or changed files of the ADR folders) against the project's ADRs, and
write your verdict file to <folder>/reviews/adr-reviewer.md", where `<folder>` is the absolute path under
`root` of the active folder, or of the archived one after the archive. The agent's own rules (verdict on line 1, `Commit:` on line 2)
hold; it is not asked to write a stage header.

**`record-review <slice>`**: reads the verdict file's first `Verdict:` line (`guard.mjs#readValue`) and
`Commit:` (`deliver-check.mjs#parseCommitLine`); refuses (exit 2, `verdict-unusable` with the reason)
when either is missing or the commit is not `HEAD`; writes `review.md` with header `result=passed` for `APPROVED` or `DECLINED`, `failed` otherwise,
`attempt` one more than the replaced header's (1 when none), `commit` the verdict's sha, and under
`## Verdict` the verdict word and the file's path. The verdict file stays as the reviewer wrote it.

**A failed review** (below the ceiling of 2) offers `architecture` with `fix-after-failure` (S5): the
session shows the owner the findings, revises the documents and ADRs with the owner, rewrites the
architecture record from the owner's approval (attempt plus one); the record is newer than
`review.md`, so the review runs again (`rerun-after-fix`). At the ceiling the run ends blocked.

**Current after the archive** (S15 and the CI contract): a review is stale when a commit after its
`Commit:` changes, against that commit's first parent, a file under `docs/design/<slice>/`,
`docs/adr/` or `docs/decisions/`. A merge of the default branch that brings none of those files keeps it
current, so a strict ruleset's update does not force a second review unless the base brought an ADR.
This rule lives in one helper, `guard.mjs#sliceReviewStale(root, sha, slice, head)`, used by
`project-loop.mjs` and the CI contract. The active walk keeps the checker's `codeBound` rule, which is
stricter.

## D-9 The archive and the pull request (A-4; AC-7)

**`archive <slice>`**: refuses (exit 2, `archive-refused`) unless the folder is active and every stage
from `business` to `review` is passed or not applicable in a fresh report; then runs `openspec archive
<slice> --yes` with the project's CLI (`makeOpenspec`) and checks that
`openspec/changes/archive/<date>-<slice>/` exists and the active folder does not; reply `archived-slice`.

**`open-pr`** (S16), appended to the brief: "commit by name the archive move and anything uncommitted
of the slice, push the branch, and open one pull request to <base> titled `docs(design): <slice>`, whose
body lists the slice's documents, its new ADRs, the appended rounds (or that the roadmap is unchanged)
and the archived folder; never merge." The `gh pr create` hook judges it by the slice contract (D-11).

**Ship modes**, from `shipConfig(root, 'devkit-project')` (ADR 0002 unchanged): `merge` enables
GitHub's auto-merge once every check is green and `mergeSetup` holds (`gh pr merge <n> --auto
--<method> --match-head-commit <head>`, the session step S24); `pr` stops for the owner's merge; `plan`
stops after the archive commit (S13, S14). This repository's `openspec/config.yaml` and the
`openspec-setup` template gain `devkit-project: merge` under `ship:` (D-15).

**Waiting.** On an `end` waiting on GitHub the session starts `project-loop.mjs wait --slice <slice>`
with the background option, as `change-loop.mjs wait` (`waitLoop`, no time limit, stateless).

## D-10 The slice readout (AC-2)

`status <slice>` prints, in the person's language: a title line `Slice <slice>` (`Fatia <slice>`), then
one line per stage from `business` to `roadmap` with its title and one of four words: passed, not
applicable, ready (the first stage not settled, whether its record is missing or waits for the
owner, with the reason after it), blocked (every later one). After the five, one line only when all
five are settled: the ADR review next, the pull request (number and state), or delivered. Exit 0.
The skill shows it when the owner asks where the slice stands. `flow-check <slice>` keeps printing all
eight stages, as for any change.

## D-11 The slice contract, in CI and in the `gh pr create` hook (A-4; AC-7, AC-8)

One helper in `guard.mjs` (the CI job downloads it), `sliceProblems(root, folder, { base, head })`,
returns the list of problems of an archived `devkit-project` folder at `head` against `base`:

1. each of `business.md`, `domain-model.md`, `architecture.md`, `implementation-plan.md`,
   `roadmap.md`, `review.md` exists and line 1 is its own stage's header (`parseStageHeader`), the first
   five `passed` or `not-applicable`, `review.md` `passed`;
2. `reviews/adr-reviewer.md` exists, its first `Verdict:` is `APPROVED` or `DECLINED`, it has a
   `Commit:` that resolves, is an ancestor of `head`, and `sliceReviewStale` finds no later commit;
3. every path of `git diff --name-only <base>...<head>` is under `docs/design/<slice>/`, `docs/adr/`,
   `docs/decisions/`, the folder itself, or is `openspec/roadmap.md`;
4. `openspec/roadmap.md`: unchanged when `roadmap.md` is not applicable; otherwise the head's bytes start
   with the base's (absent at base: anything).

`PROJECT_STAGE_FILES` (the six names) is a constant of `guard.mjs`; the test `project-loop schema: PROJECT_STAGE_FILES are the artifact files of the declaration` of
`project-loop.test.mjs` pins it to the artifact files of `devkit-project/flow.json`, since CI downloads no schema (ADR 0012's rejected alternative stays
rejected).

**CI** (`deliver-check.mjs#runCi`): `archivePrCheck` splits folders three ways by schema: devkit (as
today), `devkit-project` (`sliceProblems` with `base` `origin/<GITHUB_BASE_REF>`), other (note). The
output prints, per slice, `slice <id>: passed the slice contract` or each problem, and fails on any. A
selected active change on `devkit-project` (`runCi`, before the `isDevkitScript` note) fails with the
message of the reviews-check scenario. A slice touched among several changes (`runSeveral`) is a note,
as a plan is.

**The hook** (`guard.mjs#guardBash`, the `gh pr create` loop): before `resolveChange`, when the
checkout's branch is `<id>` and `openspec/changes/archive/<date>-<id>/` exists on `devkit-project`, the
command is judged only by `sliceProblems` with `base` `origin/<default>` (refused with the problems),
never by `prViolation`; so another change active in the checkout no longer decides it.

**One writer for archived verdict files.** `classify` makes `openspec/changes/archive/<folder>/reviews/
<reviewer>.md` a gate file of that reviewer, wherever the active change is (as `approval.md` is the main
session's anywhere, `:216`). `guardEdit` and the shell-write loop of `guardBash` judge such a file
before resolving the active change (`:482`, `:515`), so the rule also holds with no active change, the
usual state of a slice's checkout after its archive; every other path keeps today's order. No step of
today's flow writes those files.

## D-12 Hooks in a project run (ADR 0010 decision 8's open point; coordination-locks ADDED)

- The project-level opt-in (ADR 0004) is unchanged: `devkit-project` is not in `DEVKIT_SCHEMAS`, and a
  project still opts in by selecting `devkit` or `devkit-lite`.
- In a slice's checkout the edit and bash gates act as for any change: the destructive-git rules, one
  writer per gate file (D-11 adds the archived verdict files), approval files only by the main session.
  `devkit-project` declares no readiness, so `writeViolation` closes no path (`guard.mjs:246`).
- The run locks of ADR 0011 and ADR 0013 do not hold a `/devkit project` run: the typed command ends
  both runs (`runOf`, `roadmapRunOf`), and no new lock is added. The session writes the phase documents
  itself, so the edit lock cannot apply; every phase ends at an owner gate, so a stop lock would refuse
  little; and a lost turn costs one retyped `/devkit project`, which resumes (D-6).
- The lock that matters for the light review is on the pull request: the CI contract and the hook
  (D-11), as ADR 0010 decision 5 names a GitHub check the lock where a driver does not refuse.

## D-13 The messages (AC-1, AC-2, AC-5 to AC-7; project-definition "no internal term")

New keys in `MESSAGES` of `change-loop.mjs`, in `en` and `pt-BR`, rendered by `render`, no internal
term; the test `change-loop replies: no internal term in either language` of `change-loop.test.mjs` covers them. English texts
(the `pt-BR` ones are their faithful translation with the same parameters):

- `verb-unknown` (changed): "So far /devkit change, /devkit roadmap, /devkit status and /devkit project
  exist: type /devkit change and what you want done, /devkit roadmap to run the roadmap, /devkit status
  to see where everything is, or /devkit project and a name to plan a new project or slice."
- `project-opened`: "I opened the slice {id} in its own worktree. We start with the business: I ask one
  question at a time, and each phase ends with your approval."
- `project-resumed`: "Continuing the slice {id}: {where}."
- `project-choose`: "{n} slices are unfinished: {list}. Which one should I continue?"
- `project-name-needed`: "Type /devkit project and the name of the project or slice to plan, for
  example /devkit project billing."
- `project-done-already`: "The slice {id} is already delivered. Choose another name."
- `project-folder-exists`: "The default branch already has a design folder named {id}. Choose another
  name."
- `is-slice`: "{id} is a slice of a project: /devkit project {id} continues it."
- `is-change`: "{id} is a change: /devkit change {id} continues it."
- `design-pack-missing`: "The project flow needs the devkit-design pack in this project: run
  /openspec-setup with the devkit-design pack, then call /devkit project again. Nothing was run."
- `phase-approval`: "The {stage} of {id} is written. Do you approve it, or what should change?"
- `rounds-approval`: "These are the rounds and changes I would add to the roadmap: {list}. Do you
  approve them, or what should change?"
- `rounds-invalid`: "The proposed rounds cannot go on the roadmap yet: {list}."
- `rounds-not-approved`: "Nothing was written to the roadmap: you have not approved the rounds yet."
- `project-plan-mode`: "The slice {id} is ready on its branch. In this project you open its pull
  request and merge it."
- `project-pr-mode`: "Pull request #{number} of the slice {id} is ready: in this project, merging it is
  up to you."
- `project-delivered`: "The slice {id} is delivered and its rounds are on the roadmap: /devkit roadmap
  runs them."
- `project-delivered-no-rounds`: "The slice {id} is delivered. It added no change to the roadmap."
- `where.slice-pr`: "its pull request #{number} {state}" (`{state}`: waits on GitHub, waits for you,
  is blocked).
- Blocked reasons (`blocked-why.` family), new: `checks-failing` ("checks failing on the pull
  request: {checks}"), `merge-setup-missing` ("the repository is not prepared for automatic merging yet
  ({missing}), which /openspec-setup does"), `branch-conflict` ("pull request #{number} conflicts with
  {base}: resolve the conflict on the slice's branch, then call /devkit project {id} again"),
  `archive-refused` ("the slice cannot be archived yet: {stages} not settled"), `undeclared-stage` (the
  checker's sentence of D-3). Reused unchanged from `/devkit change` (`change-loop.mjs:184-200`):
  `ceiling` (the review at its ceiling), `no-progress`, `not-delivered`, `github-unreadable`,
  `pr-closed`, `not-opened`. The existing `merge-setup` key keeps its text: the slice's reply names what
  is missing, so it is a new key.
- Script replies: `project-not-found` ("No slice named {id} was found in this project."),
  `rounds-missing` ("The roadmap stage of {id} holds no rounds to check."), `rounds-ok` ("The rounds can
  go on the roadmap: {list}."), `rounds-already` ("The rounds of {id} are already on the roadmap; nothing
  was written."), `archived-slice` ("The slice {id} is archived on its branch; its pull request comes
  next."), `verdict-unusable` ("The ADR review of {id} cannot be recorded yet: {why}.").
- Readout words: `Slice {id}` / `Fatia {id}`, `ready` / `pronta`, `next: the ADR review`, `pull request
  #{number}: {state}`, `delivered`.

## D-14 The skills (A-5, A-7; AC-1, AC-3, AC-4, AC-9)

**`plugins/openspec/skills/devkit/SKILL.md`.** Description and `argument-hint` gain
`project [<name>]` (`argument-hint: "change [<request> | <change-id>] | roadmap [<n> | stop] | status |
project [<name>]"`). A new section `## Project`, between `## Status` and `## Never`:

1. Start: run `project-loop.mjs start --lang ${user_config.language}` with the words on standard input
   through the quoted heredoc of `## Start`; on `new`, run `project-loop.mjs open <id>`; keep the reply.
2. Loop: `project-loop.mjs next --slice <id> --lang ...` (with `--after` after every `agent` or
   `session` action), then carry the action:
   - `phase`: run the named design skill with the owner in this session, in the person's language,
     writing the document, `STATE.md`, the new ADRs and the record in `filesLanguage` at the absolute
     paths of `detail`, all under `root` (never a relative path: the session's own working directory is
     the checkout the command was typed in, which stays clean); one question at a
     time with AskUserQuestion; write the record with `result=pending` when the document is shown for
     approval and `result=passed` only from the owner's explicit approval, quoting it; agree not
     applicable only with the owner, writing the document and the record with the reason; step
     `revise` shows the findings file first. A question the owner must answer ends the turn.
   - `rounds`: propose into `detail.record` (absolute, under `root`), run `checkCommand`, show the
     rounds with `rounds-approval`, record the approval as for a phase; never edit
     `openspec/roadmap.md` by hand.
   - `agent`, `session`, `end`: as the Loop of `/devkit change` says for the same kinds; `session` runs
     `detail.command`, or for `enable-auto-merge` and `update-branch` the `ship-change` rows of those
     names.
3. When the owner asks where the slice stands: `project-loop.mjs status <id>`.
4. The end of a slice names `/devkit roadmap` and never starts it.

`## Never` gains: "In a project run: start `/devkit roadmap`, edit `openspec/roadmap.md` by hand, set
a stage record to passed without the owner's approval, or edit a file of a flat `docs/design/` or of
another slice."

**The five `devkit-design` skills** (`plugins/design/skills/*/SKILL.md`):

- Output folder `docs/design/<slice>/`; every path in the descriptions, prerequisites, outputs and
  related sections moves there; `STATE.md` is the slice's.
- A new first step, "The slice": "Run by `/devkit project`, the action names the slice. Called by name,
  ask the owner first for the slice's name (2 to 48 lowercase letters and digits, words joined by single
  dashes) and say the folder it uses."
- Context: a flat `docs/design/` and other slices' folders are read as context, never edited.
- ADR folder: the project's (`docs/adr/` or `docs/decisions/`), `docs/adr/` when it has none (the
  architecture skill's default moves from `docs/decisions/`, `SKILL.md:25`).
- Not applicable: when the owner agrees the phase does not apply to this slice, the document says so
  and why, and the phase ends there.
- Alone: "write nothing to `openspec/roadmap.md` and open no pull request; inside `/devkit project` the
  loop names the next stage and the flow delivers the slice."
- `design-implementation-plan` "Handing off to execution": the backlog stays in
  `4-implementation-plan.md`; `/devkit project <slice>` turns it into roadmap rounds; `/devkit change`
  runs one change. `openspec-propose` and `change-planner` are no longer named.
- `ddd-strategic-design`: called alone it writes `docs/design/<slice>/strategic-design.md`; in phase 2
  its artifacts go into `2-domain-model.md`.
- Templates (`design-business-discovery/templates/`): `STATE.md` links the ADR index at `../../adr/`
  and its progress table names the slice; the other templates keep their headings.
- `plugins/design/README.md`: the slice layout, `/devkit project`, the skills alone.

## D-15 `openspec-setup` (AC-2; project-setup)

- `scripts/install-schemas.sh`: the two `for name in devkit devkit-lite` loops become
  `devkit devkit-lite devkit-project`, project and machine-wide forms alike.
- `scripts/changes-under-way.mjs:45`: a change on `devkit-project` is listed "continues on the new
  project script; its stage records and documents stay", write `none`; other schemas unchanged.
- New `scripts/ship-entry.mjs <project-root> [--apply]`: when `openspec/config.yaml` has a `ship:` entry
  (read with `deliver-check.mjs#parseShip`) and no `devkit-project` key, prints (or with `--apply`
  writes) the file with the entry `devkit-project: <mode of devkit, else plan>` added, every other byte
  unchanged: in the block form, one line `  devkit-project: <mode>` (the block's own indent) after the
  block's last entry; in the flow form `ship: { devkit: merge }`, `, devkit-project: <mode>` before the
  closing `}` on the same line, and `ship: {}` becomes `ship: { devkit-project: plan }`. No `ship:`
  entry, or the key already there: nothing to do, exit 0. An entry `parseShip` refuses: exit 3 with its
  message, nothing written. When the mode it adds is `merge` it also prints one line: the CI pin must
  name the new release before a slice can merge by itself.
- `SKILL.md`: steps 4 and 6 name three schemas (`openspec schema validate devkit-project`); step 5 runs
  `ship-entry.mjs` and shows its diff, and says that a project moves the sha of
  `.github/workflows/devkit-reviews.yml` to the commit of the new release (the by-hand command of
  `docs/openspec-flow.md`'s CI section) before it sets `ship: devkit-project: merge`: on an older pin
  `devkit-reviews` passes a slice's pull request with a note, so it would merge with no review check;
  step 2 says the project flow needs `--packs` with `devkit-design`.
- `templates/config.yaml`: the commented `ship:` example gains `#   devkit-project: merge`.

## D-16 ADR 0014, proposed with this plan

File `docs/adr/0015-a-project-slice-is-a-change-delivered-in-one-pull-request.md`, status `proposed`
until the owner accepts it with the plan (then `accepted`, with `Accepted by:` quoting `approval.md`).
Text:

> # ADR 0014: A project slice is a change on the devkit-project script, delivered in one pull request
> that the ADR reviewer clears
>
> - Status: proposed
> - Date: 2026-11-21
> - Change: project-phases
> - Amends: ADR 0010 (0010-openspec-as-the-harness.md), the open point of decision 8 on whether the
>   hooks also act under `devkit-project`; ADR 0012 (0012-the-reviews-check-follows-the-change-script.md),
>   decisions 1 and 3, for `devkit-project` only
>
> ## Context
>
> ADR 0010 decision 1 names a `devkit-project` schema for the four design phases and decision 2 a
> project entry that ends in the roadmap; its decision 8 leaves "whether the hooks also act under
> `devkit-project`" to round 19. The owner decided in the grill of `project-phases` (2026-11-21): each
> slice's documents in `docs/design/<slice>/`, ADRs in the ADR folder; any phase may not apply; the
> roadmap written only after the owner approves the rounds; one pull request at the end, cleared by the
> ADR reviewer alone, merged by GitHub once the checks pass; the phases in the session the command was
> typed in; a flat `docs/design/` untouched. ADR 0012 makes `devkit-reviews` pass every schema but
> `devkit` and `devkit-lite` with a note, active or archived, so a slice's pull request would merge on no
> check of its review. ADR 0003's archive pull request needs a retro the owner's flow does not have.
>
> ## Decision
>
> 1. A slice is an OpenSpec change on `devkit-project`, named after the slice, in its own worktree and
>    branch. Its folder holds one stage record per stage; the phase documents live in
>    `docs/design/<slice>/`.
> 2. The phases are conversations in the session the owner typed `/devkit project` in; the only stages
>    handed to subagents are the ADR review and the commits and pull request.
> 3. Hooks: the project-level opt-in of ADR 0004 is unchanged and `devkit-project` does not opt a
>    project in. In a slice's checkout the edit and bash gates act as for any change; with no readiness
>    stage, no path is closed. The run locks of ADR 0011 and ADR 0013 do not hold a `/devkit project`
>    run.
> 4. The slice's folder is archived on its branch before its one pull request; no folder of the slice
>    stays active on the default branch, and no archive pull request or retro follows.
> 5. `devkit-reviews` judges a slice's archived folder, and fails a selected active slice, by a slice
>    contract: every stage record passed or not applicable, the ADR reviewer's verdict approved and
>    current, the pull request's files only the slice's documents, the ADR folders, the roadmap
>    (appended to, or untouched when the roadmap stage does not apply) and the archived folder. The
>    `gh pr create` hook applies the same contract. This amends ADR 0012 decisions 1 and 3 for
>    `devkit-project` only.
> 6. The pull request follows `ship: devkit-project:` as any script follows its entry (ADR 0002
>    unchanged): auto-merge only in `merge` mode, on a default branch that requires `devkit-reviews`.
>
> ## Consequences
>
> - Positive: a slice reaches the default branch in one pull request with a check anyone can read; the
>   roadmap coordinator finds its rounds; the change and roadmap commands never see a slice; the hooks'
>   question of ADR 0010 is answered without a new lock.
> - Negative: the light review reads ADRs, not the documents' quality (Accepted: the owner approves each
>   phase). A session that stops mid-slice is not held (Accepted: `/devkit project <slice>` resumes from
>   the files). The slice contract knows the six record names without reading the schema (Mitigated: a
>   test pins them to `flow.json`). A pull request that brings a slice and anything else fails
>   (Accepted: one slice, one pull request). Two slices appending to the roadmap at once conflict
>   (Mitigated: the loop ends blocked naming the conflicting pull request; rare with one owner).
>
> ### Review trigger
>
> A slice's pull request merges with a stage record not settled or a review not current; the owner asks
> for a fuller review of slices; OpenSpec changes how `archive` or `skip_specs` behave.
>
> ## Alternatives considered
>
> | Option | Pros | Cons | Cost to undo |
> |---|---|---|---|
> | The slice's progress only in `docs/design/<slice>/`, no OpenSpec change | No OpenSpec folder | ADR 0010 decision 1 names the schema; a second walker; no `openspec status` | medium |
> | Archive after the merge, in an archive pull request (ADR 0003) | The usual path | Two pull requests against the owner's one; a retro the flow does not have | low |
> | Leave the slice's folder active on the default branch | No archive step | `/devkit change`, `/devkit roadmap` and the panel would list it forever | low |
> | The full review bench on a slice's pull request | The usual contract | Not asked for; the owner chose the ADR reviewer alone (grill question 4) | low |
> | Keep ADR 0012's note for `devkit-project` | No CI change | The light review would rest on the session's word; ADR 0002 merges on the check | low |
> | Run locks for `/devkit project` | A session held to the flow | The session writes the documents itself, so the edit lock cannot apply; every phase ends at an owner gate | medium |
> | `devkit-project` as an opt-in schema (in `DEVKIT_SCHEMAS`) | One list | A project choosing it as its default would get no change flow; ADR 0004's opt-in is the project's default schema | low |

**Notes** (dated, by this change): ADR 0010 Context, after the roadmap-coordinator Note: "Note
(project-phases, <date>): the project entry and the `devkit-project` schema are built; ADR 0014 answers
decision 8's open point (the hooks act in a slice's checkout as for any change, no run lock holds a
`/devkit project` run) and records the slice model. Decisions 1 to 8 are otherwise unchanged." ADR
0012 Context: "Note (project-phases, <date>): ADR 0014 amends decisions 1 and 3 for `devkit-project`:
its active changes fail and its archived folders are judged by the slice contract. The Decision is
otherwise unchanged." When ADR 0014 is accepted, both gain `- Amended by ADR 0014
(0015-a-project-slice-is-a-change-delivered-in-one-pull-request.md)` in their headers.

**Rejected alternatives of earlier ADRs, read.** ADR 0004 rejected "per-change schema as the marker"
of the hooks: not taken up (D-12, the opt-in stays project-level). ADR 0012 rejected "a devkit script
is any schema that declares the evidence and review stages" because CI reads no schema file: not taken
up (the six names are a constant pinned by a test). ADR 0010 rejected "devkit's own harness program
outside OpenSpec" and "app child sessions": `project-loop.mjs` is a loop over OpenSpec files like
`change-loop.mjs`, and no app session is started. ADR 0003's decision is unchanged for changes; a slice
never has an archive pull request, so none of its conditions is relaxed. No rejected alternative is
taken up.

## D-17 The documents (AC-2, AC-9)

- `docs/coordination-design.md`: the tense paragraph names, since `project-phases` (round 19),
  `/devkit project`, the `devkit-project` schema and `project-loop.mjs`, and drops them from the
  to-be-built list; section 1's table says `19 (built)`; section 7 says "decided; built in round 19",
  replaces "Today" and "The proposal" with what exists and lists the grill's nine answers as "Decided by
  `project-phases` on 2026-11-21"; section 8's harness bullet marks `devkit-project` built; section 13's
  "(round 19 proves it)" becomes "(not proved by round 19, whose phases run in the session; the first
  `/devkit roadmap` run that carries several changes to their ends records it)" (T-5).
- `docs/openspec-flow.md`: a schema section `## The \`devkit-project\` schema` after the `devkit-lite`
  one; a section `## Defining a project: \`/devkit project\`` after the roadmap coordinator's; the CI
  section says the check judges a slice's archived folder by the slice contract; the pin moves to
  `v0.19.0`.
- `docs/roles.md`: `## project-coordinator` (what it does, delivers, never does).
- `README.md` (root) and `plugins/openspec/README.md`: `/devkit project` and the third schema;
  `plugins/design/README.md` (D-14).
- `openspec/config.yaml`: the `ADRs:` line names `0014 a project slice is a change on devkit-project
  delivered in one pull request, amends 0012`; `ship:` gains `devkit-project: merge`.
- `docs/catalog.md` and the catalog blocks regenerated by `python3 scripts/gen-catalog.py`.

## D-18 Versions and release

devkit-openspec 0.18.1 to 0.19.0 and devkit-design 0.1.1 to 0.2.0 (`plugin.json` and
`.claude-plugin/marketplace.json`), marketplace 0.22.1 to 0.23.0, a `## 0.23.0` entry in `CHANGELOG.md`,
the CI pin `v0.19.0` in `docs/openspec-flow.md` (the test `the pin in docs/openspec-flow.md is the
commit sha of v + the devkit-openspec version` of `deliver-check.test.mjs` follows the plugin version by
itself; the test `change-loop docs: the design records the answers` names the release literally and
changes, T-8 of D-20). The `## 0.23.0` entry says that a project moves its CI pin to `v0.19.0` before it
sets `ship: devkit-project: merge` (D-15). devkit-core is not changed. The tag `v0.19.0` is pushed after the merge (`CONTRIBUTING.md`), a Workflow follow-up.

## D-19 The scripted run and the live checks (A-9; the proof)

**The scripted run** is the test `project-loop scripted: a slice from its name to the merge` of
`plugins/openspec/hooks/project-loop.test.mjs`, which also writes its transcript to the path in
`DEVKIT_PROOF_OUT` when that is set (the evidence copies it to `openspec/changes/project-phases/proof/
scripted-run.txt`). In a scratch repository with a bare local `origin`, a flat `docs/design/` (the four
files and `STATE.md`), an existing `openspec/roadmap.md`, `devkit-design@devkit` enabled, and a faked
`gh` that records every call and answers pull request states from a script, it runs the real
commands, with written files standing in for the session's writing and the owner's answers:

1. `start` with `billing` gives `new`; `open billing` makes the worktree and the change (AC-1).
2. `next`, run from the main checkout, gives `phase` business `interview`; the test writes the
   document, `STATE.md` and the record `pending` at the action's `detail` paths, and the main
   checkout's `git status --short` stays empty; `next` gives `approval` and `status` shows business ready, the rest blocked; the
   record set `passed` makes domain model ready (AC-2, AC-3).
3. The domain model record and document written as not applicable: architecture ready (AC-4).
4. Architecture with two ADRs under `docs/adr/`, the plan, each passed (AC-3).
5. `rounds billing` with the record pending: `rounds --write` refuses and the roadmap's bytes are
   unchanged; set `passed`, `next` gives `write-rounds`, `rounds --write` appends; the file starts with
   its old bytes; `roadmap-loop.mjs status` lists the new lines with their `after:` (AC-5).
6. `next` gives the `commit` hand-off (the test commits by name), then the `adr-reviewer` hand-off (the
   test writes the verdict file with `Commit:` HEAD), then `record-review`, then `archive` (AC-7).
7. A new session is simulated by calling `start` with no text: `resume billing` (AC-1).
8. `open-pr` (the test pushes to the local origin; the faked `gh` records `pr create`), the hook's
   `sliceProblems` and `deliver-check.mjs --ci` with `GITHUB_BASE_REF`, `GITHUB_HEAD_REF` and an event
   file both pass; the faked `gh` reports green checks and an allowed merge setup; `next` gives
   `enable-auto-merge` with the head commit; then merged: `project-delivered` (AC-7).
9. The flat `docs/design/` files have the bytes they had before (AC-8).

A second scripted test, `project-loop scripted: a slice whose roadmap does not apply`, runs the same
path with the roadmap record not applicable and checks `openspec/roadmap.md` byte for byte and the CI
contract's roadmap rule (AC-6).

**The live checks** (owner-run, by the conducting session, with the desktop app's bundled Claude Code,
never by `tdd-implementer`), each recorded under `openspec/changes/project-phases/proof/`:

- L1 (AC-1, session half): in a scratch project set up from this branch's tree (`--plugin-dir` for
  `plugins/openspec` and `plugins/design`), `-p "/devkit project billing"` and the reply; then a second
  `-p` session with `"/devkit project billing"` after the business record was written `passed` by hand,
  and its reply naming the domain model. Recorded: both replies and the worktree list.
- L2 (AC-9, session half): `-p "/devkit-design:design-business-discovery"` in the same scratch project,
  and its first reply asking for the slice. Recorded: the reply and `git status` showing no
  `openspec/roadmap.md` change.

If the bundled CLI cannot run a live check, the record says why and that criterion's session half is
left to the dogfood; the scripted run still proves the scripts.

## D-20 Tests that pin a rule this plan replaces

Every other existing test runs unchanged. Each changed test, with its invariant, the layer that owns
it and its suite:

| Id | Test (file) | Invariant after the change | Layer | Suite |
|---|---|---|---|---|
| T-1 | `change-loop start: S1 a verb of a later round says its round and creates nothing` (`change-loop.test.mjs:886`) | only `help` is a later round (23); `project` no longer answers `not-built` | the entry of `change-loop.mjs` | `guard.test.mjs` through `change-loop.test.mjs` |
| T-2 | `change-loop start: S2 no verb or an unknown verb names the commands that exist` (`:901`) | the reply names the four commands; the `pt-BR` pattern follows the new text | the message table | same |
| T-3 | `change-loop skill: the sections of D-3 to D-9 and the modes of start` (`:2370`) | the headings list gains `## Project` before `## Never`; the modes gain `project` and `is-slice` | the skill text | same |
| T-4 | `roadmap-loop start: ...` lines `:797-799` of `roadmap-loop.test.mjs` | `help` keeps round 23; `project` leaves the not-built row; the `verb-unknown` patterns follow the new text | the entry | `guard.test.mjs` through `roadmap-loop.test.mjs` |
| T-5 | `roadmap-loop docs: the documents follow` (`roadmap-loop.test.mjs:1890`) | section 13's sentence on many background ends follows its corrected text | the documents | same |
| T-6 | `roadmap-loop skill: the frontmatter and the start modes name the roadmap and the status` (`roadmap-loop.test.mjs:1812`) | the exact `argument-hint` gains `\| project [<name>]` | the skill text | same |
| T-7 | the seven `names(... 'schemas')` assertions of `install-schemas.test.mjs` (`:41`, `:49`, `:57`, `:64`, `:125`, `:145`, `:154`) | the installer copies three schemas | the installer | `guard.test.mjs` through `install-schemas.test.mjs` |
| T-8 | `change-loop docs: the design records the answers` (`change-loop.test.mjs:2439`), its pin assertions `:2473-2476` | the CI snippet of `docs/openspec-flow.md` pins the current release, now `v0.19.0`; `v0.18.1` joins `v0.18.0`, `v0.17.1` and `v0.16.0` as pins that must be gone | the documents | `guard.test.mjs` through `change-loop.test.mjs` |

New tests extend, without changing them, the tests that iterate `['devkit', 'devkit-lite']` in
`flow-check.test.mjs` (`:166`, `:223`, `:246`, `:688`) and `deliver-check.test.mjs:2961`: each gets a
sibling test for `devkit-project`. `guard.test.mjs:577` (`DEVKIT_SCHEMAS` equals the two names) stays,
and pins D-12's "not an opt-in schema".

## Proof map: each criterion, its tasks and where it is proved

| AC | Proved by | Limit |
|---|---|---|
| AC-1 | `project-loop start/open/next` tests, the scripted run steps 1 and 7, L1 | the session half rests on L1 |
| AC-2 | schema and installer tests, `status` tests, scripted step 2 | |
| AC-3 | `next` phase rows, scripted steps 2 and 4 | the conversations' quality is the dogfood |
| AC-4 | scripted step 3, `status` test | |
| AC-5 | `rounds` tests, scripted step 5 with `roadmap-loop.mjs status` | |
| AC-6 | the second scripted test, the CI roadmap rule tests | |
| AC-7 | `sliceProblems`, CI and hook tests, scripted steps 6 and 8 | auto-merge is the exact call against a faked `gh`; the real GitHub run is the dogfood |
| AC-8 | scripted step 9, the CI path rule tests | |
| AC-9 | the skills' text test, L2 | the session half rests on L2 |

## Risks / Trade-offs

- [The session skips a phase's approval and writes `passed`] → the record quotes the owner's words, the
  CI contract reads only headers (ADR 0010: the checker never reads prose); accepted as for
  `approval.md`, the weakest lock.
- [Two slices, or a slice and a tick, edit `openspec/roadmap.md` at once] → the append is at the end;
  a conflicting pull request ends blocked `branch-conflict` naming it and its base (S19); one owner,
  rarely two slices.
- [The panel lists a slice as an open change] → the current panel reads active folders and is retired in
  round 24; the scripted test `project-loop scripted: a slice from its name to the merge` of
  `project-loop.test.mjs` checks that the session report (`guard.mjs session`) on a checkout with an
  open slice exits 0.
- [The session writes a phase file at a relative path, into the checkout it was started in] → every
  path of a `phase` or `rounds` action is absolute under `root` (D-6, "Where the session writes"), the
  skill says never a relative path (D-14), and the `project-loop next` tests assert that each detail
  path starts with `root`.
- [A project sets `ship: devkit-project: merge` on its old CI pin, where `devkit-reviews` passes a slice
  with a note] → `ship-entry.mjs` prints the pin line when it adds `merge`, and the `openspec-setup` text
  and the CHANGELOG say to move the pin first (D-15, D-18).
- [The ADR reviewer is asked to write a header and refuses] → it is not asked: `record-review` writes the
  record from its verdict file.
- [OpenSpec's experimental schema commands change] → F1 to F3 are checked by the `project-loop schema` tests of
  `project-loop.test.mjs`, which create a slice with the CLI; the project pins its CLI (ADR 0010).

## Migration Plan

Nothing migrates: a project gets the third schema the next time it runs `openspec-setup`, and its flat
`docs/design/` stays. Its CI keeps its old pin until the project moves the sha of
`.github/workflows/devkit-reviews.yml` by hand (the workflow item of `github-setup.mjs` never overwrites
an existing file): on the old pin a slice's archived folder gets the "other script" note, so the project
moves the pin to `v0.19.0` before it sets `ship: devkit-project: merge` (D-15, D-18). Rollback: revert the release; a slice under way keeps its files, and its
`docs/design/<slice>/` documents stay readable without devkit.

## Implementation plan

Dependency order: the schema and the checker (data and declaration), then the CI contract and the hook
(the lock on the pull request), then the loop and the entry, then the skills, then the scripted run and
the live checks, then the ADR, the documents and the release.

**Per surface.**

- devkit-openspec: new `hooks/project-loop.mjs`, `hooks/project-loop.test.mjs`,
  `schemas/devkit-project/` (`schema.yaml`, `flow.json`, six templates),
  `skills/openspec-setup/scripts/ship-entry.mjs` and its test; changed `hooks/change-loop.mjs` (D-4, D-5,
  D-13), `hooks/flow-check.mjs` (D-3), `hooks/guard.mjs` (D-3, D-8, D-11), `hooks/deliver-check.mjs`
  (D-11), `hooks/guard.test.mjs` (two import lines), the tests of D-20, `skills/devkit/SKILL.md`,
  `skills/openspec-setup/` (`SKILL.md`, `install-schemas.sh`, `changes-under-way.mjs`,
  `templates/config.yaml`), `.claude-plugin/plugin.json`, `README.md`.
- devkit-design: the five `SKILL.md`, `skills/design-business-discovery/templates/STATE.md`, `README.md`,
  `.claude-plugin/plugin.json`.
- Repository: `openspec/schemas/devkit-project/` (copy), `docs/adr/0014-...md` (new), ADRs 0010 and 0012,
  `docs/coordination-design.md`, `docs/openspec-flow.md`, `docs/roles.md`, `openspec/config.yaml`,
  `README.md`, `CHANGELOG.md`, `.claude-plugin/marketplace.json`, `docs/catalog.md`.

**Files to create**: the eight files of the new schema folder (and its copy), `project-loop.mjs`,
`project-loop.test.mjs`, `ship-entry.mjs`, `ship-entry.test.mjs`, the ADR. **Files to delete**: none.

**Estimate**: optimistic 30 h, likely 42 h, pessimistic 60 h.

| Component | Hours | Type | Risk |
|---|---|---|---|
| Schema, flow, templates, copy, header move, `undeclared-stage`, declaration tests (phase 1) | 5 | Core | LOW |
| Installer, `changes-under-way`, `ship-entry.mjs`, T-7 (phase 1) | 2.5 | Integration | LOW |
| `sliceProblems`, `sliceReviewStale`, `classify`, the hook, `runCi`, their tests (phase 2) | 7 | Core | MEDIUM |
| `openCheckout` split, `startProject`, `unfinishedSlices`, `unfinished` and `is-slice`, messages, T-1, T-2, T-4 (phase 3) | 6 | Core | MEDIUM |
| `decideSlice` and its rows, `rounds`, `record-review`, `archive`, `status`, `wait`, their tests (phase 3) | 10 | Core | HIGH |
| The devkit skill section, the five design skills, templates, README, T-3, T-6, text tests (phase 4) | 4 | Integration | MEDIUM |
| The two scripted tests and the proof transcript (phase 5) | 4 | Testing | MEDIUM |
| L1 and L2 and their records (phase 5) | 1.5 | Testing | MEDIUM |
| ADR 0014, Notes, design and flow pages, roles, READMEs, config, versions, CHANGELOG, pin, T-5, catalog, whole suite (phase 6) | 4 | Documentation | LOW |

**Risks** (probability × impact, mitigation):

| Risk | P | I | Mitigation |
|---|---|---|---|
| `decideSlice`'s 26 rows miss a state (a pull request opened by hand before the archive) | MEDIUM | MEDIUM | one test per row, negatives included; S11 archives first whatever the remote holds; an unknown state ends blocked |
| The `openCheckout` split changes `/devkit change`'s open | LOW | HIGH | the existing open tests of `change-loop.test.mjs` run unchanged; no `SCRIPTS` change |
| The header move breaks an importer of `flow-check.mjs` | LOW | MEDIUM | re-export from `flow-check.mjs`; the whole suite in gate 6 |
| The CI contract fails a valid slice on a strict update | MEDIUM | MEDIUM | `sliceReviewStale` reads first-parent diffs; a test merges a base with an unrelated product commit |
| The bundled CLI cannot run L1 or L2 | MEDIUM | LOW | recorded with the reason; the scripted run carries the scripts' proof; the owner sees the limit at approval |
| The suite grows past its 13 minutes noticeably | MEDIUM | LOW | the scripted tests share one scratch repository each and use the faked `gh` |

**Assumptions** (where the plan breaks if wrong): F1 to F3 hold for the project's pinned OpenSpec 2.x
(probed with 2.0.0); the `adr-reviewer` agent writes `Verdict:` on line 1 and `Commit:` on line 2 into
the folder it is given (`plugins/core/agents/adr-reviewer.md`, "Verdict file"); `gh pr list --head`
finds a pull request by its branch (`deliver-check.mjs#fetchPr`); the CI job downloads exactly three
files (`docs/openspec-flow.md`, CI section); the whole suite runs about 13 minutes (`CLAUDE.md`).

**Dependencies**: round 18 (`roadmap-coordinator`, archived) for `parseRoadmap`'s readers and the board;
round 15 (`change-coordinator`) for `change-loop.mjs`; ADRs 0002, 0004, 0010, 0012; the desktop app's
bundled Claude Code for L1, L2 and the marketplace validation (`CONTRIBUTING.md`).

## Decisions cited

ADR 0010 decisions 1 (OpenSpec is the harness; the `devkit-project` schema), 2 (the project entry), 3
(a loop over files, four end states), 5 (hooks veto; a GitHub check is the lock where a driver does not
refuse) and 8 (its open point on the hooks, answered by ADR 0014); ADR 0012 decisions 1 and 3 (amended
by ADR 0014 for `devkit-project`); ADR 0004 (the project-level opt-in, unchanged; its rejected per-change
marker not taken up); ADR 0002 (merge on `devkit-reviews`, per-schema opt-in, unchanged); ADR 0003
(archive pull requests, unchanged for changes); ADR 0011 and ADR 0013 (their locks hold only their runs).

## Open Questions

None that changes the specs, the approach or the task breakdown. The exact `pt-BR` wording of the new
replies is the implementer's, within D-13's meaning and parameters.
