<!-- devkit-stage proposal result=passed attempt=2 commit=2300f84524e5c1ec5ed8a0da41e5a5dccff9cc34 -->
# Proposal

> Note (project-phases-followups, 2026-11-22): the slice ADR this plan calls ADR 0014 shipped as ADR 0015 (`docs/adr/0015-a-project-slice-is-a-change-delivered-in-one-pull-request.md`), because another change took the number 0014 first (`docs/adr/0014-each-roadmap-change-runs-in-a-session-of-its-own.md`). The approved text below is unchanged.

Change: `project-phases` · Date: 2026-11-21 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(design sources: `requirements.md`, `docs/coordination-design.md` sections 1, 7, 8 and 11,
`docs/adr/0010-openspec-as-the-harness.md` decisions 1, 2 and 8,
`docs/adr/0012-the-reviews-check-follows-the-change-script.md`). Round 19 of `openspec/roadmap.md`,
step 7 of the build order.

## Why

The four `devkit-design` skills each point at the next one, write to one flat `docs/design/` folder
per project, and end in a change backlog inside `docs/design/4-implementation-plan.md` that nothing
turns into `openspec/roadmap.md`. `/devkit project` still answers "not built yet". ADR 0010 decision 2
names the project entry as the third way in, and its decision 8 leaves "whether the hooks also act
under `devkit-project`" to this round. With the roadmap coordinator built (round 18), the missing
piece is the flow that writes the roadmap it reads.

## What Changes

- `/devkit project <slice>` opens a slice in a worktree and branch named after it and carries it, in
  the session where it was typed, through five stages: business, domain model, architecture,
  implementation plan and roadmap. Typed again, with or without the name, it resumes where the slice
  stopped. A new script, `plugins/openspec/hooks/project-loop.mjs`, decides every step.
- A new OpenSpec schema, `devkit-project`, with its `flow.json` and templates. A slice is an OpenSpec
  change on that schema: its folder holds one stage record per stage, and each phase's document
  lives in `docs/design/<slice>/` under today's names (`1-business-vision.md` to
  `4-implementation-plan.md`, plus that slice's `STATE.md`). ADRs go to the project's ADR folder.
  Any phase may be marked not applicable with its reason.
- The roadmap stage shows the proposed rounds and changes, writes nothing before the owner approves,
  then appends them to `openspec/roadmap.md` (or creates it), and the flow names `/devkit roadmap`
  without starting it. When it does not apply, the roadmap stays byte for byte as it was.
- The end of a slice: the `adr-reviewer` agent reviews the slice's diff against the project's ADRs,
  the slice's folder is archived inside its one pull request, and the pull request follows the
  project's ship mode for `devkit-project` (`merge`: GitHub's auto-merge once the checks pass). No
  archive pull request and no retro.
- `devkit-reviews` judges a slice's pull request by a light contract: every stage record passed or
  not applicable, the ADR reviewer's verdict approved and current, the roadmap only appended to (or
  untouched when its stage does not apply), and no file outside the slice's documents, the ADR folders,
  the roadmap and the archived folder. The `gh pr create` hook applies the same contract locally.
- `/devkit change`, `/devkit roadmap` and `/devkit status` never list, resume or start a slice.
- The five `devkit-design` skills ask for the slice when called by name and write under
  `docs/design/<slice>/`; called that way they write no roadmap and open no pull request. A project's
  flat `docs/design/` is never moved or edited.
- `openspec-setup` installs `devkit-project` beside `devkit` and `devkit-lite` and adds its `ship:`
  entry. A new ADR 0014, `proposed` (`design.md` D-16), records the slice model, the hooks' answer and
  the light contract; it amends ADR 0012 decisions 1 and 3. ADRs 0010 and 0012 get dated Notes.

Non-goals: starting `/devkit roadmap` from the flow; a short variant of the flow; moving or rewriting
an existing flat `docs/design/`; rewriting the phases' interviews beyond the slice folder, the stage
record and not applicable; the first real slice in one of the owner's projects (the dogfood, a next
change); the CompozyOS and script drivers (rounds 21, 22); listing slices in `/devkit status`; run
locks (stop, hand-off, edit) for a `/devkit project` run.

## Acceptance criteria

Copied from `requirements.md`, with their ids. "Proven here" means the tests, the scripted run and
the recorded checks of this change (`design.md` D-19); "dogfood" means the first real slice.

- AC-1 `project-verb-starts-and-resumes`: `/devkit project <slice>` no longer answers "not built
  yet": in the session where it is typed it opens the slice in a worktree named after the slice and
  starts the first phase's conversation; typed again after the session stops, it resumes at the stage
  where it stopped. Proven here.
- AC-2 `five-stages-readout`: the `devkit-project` schema is installed into a project by
  `openspec-setup` beside `devkit` and `devkit-lite`, and the stage readout of a slice lists five
  stages (business, domain model, architecture, implementation plan, roadmap), each as passed, not
  applicable, ready or blocked. Proven here.
- AC-3 `phase-document-per-slice`: each phase writes its document under `docs/design/<slice>/` and
  the architecture phase writes its ADRs to `docs/adr/`; a phase passes only with the owner's explicit
  approval, and the next stage stays blocked until it does. Proven here for the files and the order;
  the quality of each phase's conversation is the dogfood.
- AC-4 `phase-not-applicable`: a phase marked not applicable leaves its file with its reason, and the
  next stage becomes ready. Proven here.
- AC-5 `roadmap-written-after-approval`: the fifth stage shows the proposed rounds and changes and
  writes nothing to `openspec/roadmap.md` before the owner approves; after approval it appends them
  after the existing content, leaving every existing line unchanged, or creates the file when it is
  absent; `/devkit roadmap` reads the new rounds and their `after:` dependencies; the flow stops naming
  `/devkit roadmap` and does not start it. Proven here.
- AC-6 `roadmap-not-applicable`: when the fifth stage is not applicable, its file holds the reason and
  `openspec/roadmap.md` is byte for byte what it was before the slice. Proven here.
- AC-7 `one-pr-with-adr-review`: the slice ends in one pull request holding its documents, its new
  ADRs and the roadmap rounds; the ADR reviewer's verdict on the new ADRs is the only review it needs;
  the project's required checks pass on it, and auto-merge is enabled on it. Proven here on a scratch
  repository.
- AC-8 `flat-design-untouched`: in a project with the flat `docs/design/` layout, running a slice
  leaves every existing file under `docs/design/` (outside `docs/design/<slice>/`) byte for byte
  unchanged. Proven here.
- AC-9 `skills-work-alone`: each of the five `devkit-design` skills, called by name outside
  `/devkit project`, asks for the slice and writes under `docs/design/<slice>/`, writes nothing to
  `openspec/roadmap.md` and opens no pull request. Proven here.

## Capabilities

### New Capabilities

- `project-definition`: `/devkit project`, the slice and its folder, the five stages and not
  applicable, the roadmap append after approval, the ADR review, the archive inside the one pull
  request, the slice readout, resuming, the design skills alone, and slices kept out of the change and
  roadmap commands.

### Modified Capabilities

- `change-coordination`: the verb requirement (`project` runs; `help` still names round 23; the reply
  to an unknown verb names the four commands that exist).
- `reviews-check`: a change or archived folder on `devkit-project` is judged by the slice contract,
  not passed with a note; the slice contract itself.
- `change-stages`: the `devkit-project` schema's stages and its declaration rules; a stage the script
  does not declare is never offered.
- `project-setup`: the third schema installed, its `ship:` entry, and a slice under way listed with
  what a schema upgrade changes for it.
- `coordination-locks`: a typed `/devkit project` ends a change run and a roadmap run, and no lock of
  that capability holds a project run.

## Impact

- devkit-openspec (0.18.1 to 0.19.0): new `hooks/project-loop.mjs`, `hooks/project-loop.test.mjs`
  and `schemas/devkit-project/` (`schema.yaml`, `flow.json`, six templates); `hooks/change-loop.mjs`
  (the `project` route, `verb-unknown`, new message keys, slices out of `unfinished` and the resume
  by id, the open helper shared with `project-loop.mjs`); `hooks/flow-check.mjs` (the header reader
  moved to `guard.mjs`, an undeclared stage never offered); `hooks/guard.mjs` (the header reader, the
  slice contract, the `gh pr create` hook for a slice, archived review files with one writer);
  `hooks/deliver-check.mjs` (the slice contract in CI); `hooks/guard.test.mjs` (two import lines);
  the changed tests T-1 to T-8 of `design.md` D-20; `skills/devkit/SKILL.md`; `skills/openspec-setup/`
  (`SKILL.md`, `scripts/install-schemas.sh`, `scripts/changes-under-way.mjs`, new
  `scripts/ship-entry.mjs` and its test, `templates/config.yaml`); `.claude-plugin/plugin.json`;
  `README.md`.
- devkit-design (0.1.1 to 0.2.0): the five skills, the shared templates, `README.md`.
- Repository: `docs/adr/0015-a-project-slice-is-a-change-delivered-in-one-pull-request.md` (new),
  Notes in ADRs 0010 and 0012, `docs/coordination-design.md`, `docs/openspec-flow.md` (CI pin
  `v0.19.0`), `docs/roles.md`, `openspec/config.yaml` (ADR line, `ship: devkit-project: merge`),
  `openspec/schemas/devkit-project/` (the byte-identical copy), `README.md`, `CHANGELOG.md`,
  `.claude-plugin/marketplace.json` (0.23.0), `docs/catalog.md` (generated).
- Projects: one more verb and one more schema; nothing changes for a project that does not type
  `/devkit project`, apart from the third schema folder `openspec-setup` installs. A project that wants
  a slice to merge by itself moves its CI pin to `v0.19.0` before it sets `ship: devkit-project: merge`:
  on an older pin `devkit-reviews` passes a slice with a note (`design.md` Migration Plan).

**Dependencies.** The roadmap coordinator (round 18, archived), which reads `openspec/roadmap.md`
with `guard.mjs#parseRoadmap`; the change coordinator's `change-loop.mjs` exports (`render`,
`waitLoop`, `locate`, `archivedOnDefault`, `projectGate`, `readDevkitSettings`, the open steps);
`flow-check.mjs` (`collectFlow`, `computeFlow`); `merge-setup.mjs#mergeSetup`; the OpenSpec 2.0.0
facts probed for this plan (`design.md` D-1).

**Exit criteria.** `openspec validate project-phases --strict`; the whole hook suite
`node --test plugins/openspec/hooks/guard.test.mjs` green with `GITHUB_HEAD_REF` and `GITHUB_BASE_REF`
set; `python3 scripts/check.py`; `python3 scripts/gen-catalog.py --check`; `claude plugin validate .`
run with the desktop app's bundled Claude Code and recorded; the scripted run and the live check of
`design.md` D-19 recorded.

**What the owner approves**, in the message that approves the plan:

- The plan, and ADR 0014 (`design.md` D-16): accept it, and it becomes `accepted`; refuse it, and the
  plan goes back to planning before any code.
- The choices the grill left to the planner (`requirements.md`, last assumption): the stage records in
  the slice's OpenSpec folder and the documents under today's names in `docs/design/<slice>/` with a
  per-slice `STATE.md` (D-1); `devkit-reviews` learning the light review as the slice contract (D-11).
- The slice's pull request follows `ship: devkit-project:` like every other script (ADR 0002's opt-in
  per schema kept): `merge` auto-merges, which this repository and `openspec-setup` set beside the other
  two scripts; `pr` leaves the merge to the owner; `plan` stops with the slice on its branch (D-9).
- The stated limits of the proof map: auto-merge is shown as the exact call the loop makes against a
  faked `gh` on a scratch repository with a local remote, the real GitHub run being the dogfood; the
  session half of AC-1 and AC-9 rests on one recorded live session each (D-19).

**Decisions cited.** ADR 0010 (decisions 1, 2, 3, 5 and 8, the last answered by ADR 0014), ADR 0012
(decisions 1 and 3 amended by ADR 0014), ADR 0004 (the project-level opt-in, unchanged), ADR 0002 (the
merge rests on `devkit-reviews`, per-schema opt-in, unchanged), ADR 0003 (no archive pull request for a
slice; unchanged for changes), ADR 0011 and ADR 0013 (their locks hold only their runs).

**Open decisions inherited.** None of the design's open points is touched. Whether the review stage
keeps the Workflow path stays open (a slice's review is one agent, not the bench).
