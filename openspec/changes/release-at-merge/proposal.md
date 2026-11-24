<!-- devkit-stage proposal result=passed attempt=3 commit=ba3126b84f6821144dad1cfb02b260bf68dc7e77 -->
# Proposal

Change: `release-at-merge` · Date: 2026-11-24 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(sources: `requirements.md`, `decisions.md`, `ADR [release-at-merge]`, `release.md`). Plan base:
`ba3126b`, the merge of `origin/main` at `c663f21` (train 4, with `archive-release-pin`) into
`66a27b1`, which merged `a347ac0` (train 3) into the first base `2ecd562`.

## Four decisions taken for the owner

The grill's questions 1 to 4 were answered by the coordinating session under the owner's delegation
of 2026-11-24. The owner can overturn each one when approving this plan:

1. **Who writes the numbers.** With a delivery train, the train's join writes them. With no train, a
   new delivery step, `assign-release`, writes them on the change's own branch as its last step
   before `enable-auto-merge` (or `ready`), and again after a merge of the base moved them. No other
   step and no author writes a version, a changelog line, a CI pin or an ADR number.
2. **The release note is a plain file**, `openspec/changes/<id>/release.md`, written with the plan:
   not a stage and not a new flow version, so changes already open keep their flow.
3. **The ADR has no number until the delivery.** A change names it `docs/adr/<slug>.md` and cites it
   `ADR [<slug>]`; the step that gives the version renames it to the next free number and rewrites
   the citations outside the change folders, so no plan file, approval, review or evidence changes.
4. **The consumer rule is minimal.** A project that names `devkit.release_tag` gets the version of
   that file and, only if it has one, a root `CHANGELOG.md` line; nothing else is created or assumed.
   A project without the key sees nothing new.

## Why

Every change writes its release into lines every other change also edits and picks the next free ADR
number, so any two changes in flight conflict by design. Train 2 left every boarded change for the
CI pin, and parallel ADR numbers collided four times on 2026-11-24, each renumbering staling reviews
and sometimes the owner's approval. The owner asked that a change stop choosing numbers.

## What Changes

- **The note.** `release.md` holds a `packs:` list (pack and `patch`, `minor` or `major`; empty is
  no release), an optional `marketplace:` and `release:` bump, a changelog title and body. One
  function reads it and names the field of a malformed note.
- **The delivery numbers once.** `release-merge.mjs --merge <rev>` (the train's join) numbers a noted
  change from its note; the new `release-merge.mjs --assign --base <base>` does it on the branch with
  no train. Both rename the unnumbered ADR and rewrite its citations, refuse a second ADR with the
  same slug and a citation of an ADR that has not landed.
- **The delivery checker** refuses release lines edited by hand, a change that touches a pack with
  neither a note nor a bump of its own ("no release"), and a note that differs from the one the
  owner approved; a commit that only writes release lines leaves the evidence and reviews current.
- **The readers** accept the unnumbered ADR before the delivery; `scripts/check.py` refuses it on the
  default branch and refuses two files with one slug. The planner, the ADR author, the implementer,
  the readiness review, the skills, `CONTRIBUTING.md`, `docs/openspec-flow.md` and
  `openspec/config.yaml` follow; ADR 0022 and ADR 0025 get their "Amended by" lines. ADR 0003,
  ADR 0027 and ADR 0030 are built on and not edited: the archive check's pin-line rule stays as the
  safety net for archive pull requests and old-rule changes, removed with the old rule.
- **The old rule stays** for changes with no note: joins, `--base`, `renumber-adr`, as today.

Non-goals: moving the open changes over or removing the old rule; `change-loop-compozy.test.mjs`'s
pin test and the archive check's pin-line rule (`archive-release-pin`, merged: ADR 0027, ADR 0030); a new stage or flow version; a release pull
request after the merge; GitHub Releases or other tag kinds; any consumer layout beyond the
`devkit.release_tag` file and a root `CHANGELOG.md`; the panel (a new step shows by its id).

## Acceptance criteria

- AC-1 `release-note-file`: a change carries `openspec/changes/<id>/release.md` written with the plan; one function reads it and a malformed note is refused with a plain message naming the field (one test per field, negatives included).
- AC-2 `no-hand-edit`: a branch of a change with a note, before the numbers are assigned, holds the release files exactly as the base has them; `deliver-check` refuses a branch whose release files are neither the base's nor what the step computes, saying "release lines edited by hand".
- AC-3 `train-join-from-notes`: two boarded changes with notes that both bump the same pack, with neither branch touching a release line, join on one train with no conflict: the first boarded takes the next version, the second the one after, each CHANGELOG entry, the marketplace version, the catalog and the CI pin follow, and each change's head, evidence and reviews stay current.
- AC-4 `assign-before-auto-merge`: with no train, `assign-release` runs last, before `enable-auto-merge`, commits only release files, leaves the evidence and the reviews current, and runs again after a merge of the base that moved the release; two such changes in a row never conflict on a release line.
- AC-5 `adr-numbered-at-delivery`: a change that names its ADR `docs/adr/<slug>.md` and cites it `ADR [<slug>]` has it renamed to `docs/adr/<NNNN>-<slug>.md` (the next free number on the base) and every citation outside the change's folder rewritten, by the train's join or by `assign-release`; no file of the change's folder changes, so the readiness verdict, the plan approval, the reviews and the evidence stay current and the owner is not asked for the approval again.
- AC-6 `adr-unnumbered-readers`: before the delivery every reader of ADRs listed in the assumptions accepts `docs/adr/<slug>.md`; on the base branch `scripts/check.py` refuses an ADR with no number, and a second file with one slug is refused.
- AC-7 `adr-cross-citation`: `amends ADR [<slug>]` of another change's ADR resolves once that ADR has landed, and `assign-release` or the join refuses with a plain message naming the slug while it has not.
- AC-8 `consumer-release-file`: a project that names `devkit.release_tag` gets its file's `version` written from the note's bump, and its root `CHANGELOG.md` gets the note's line only when the file exists; no file is created and no layout is assumed.
- AC-9 `consumer-nothing-new`: a project with no `devkit.release_tag`, with no train, with no release file or with no `docs/adr` sees no new step, no new refusal and no new file; a test per case.
- AC-10 `old-rule-kept`: a change with no note and a bump of its own (opened before this change) joins a train, merges alone and renumbers on a base update exactly as before, and a clashing ADR number still takes `renumber-adr`.
- AC-11 `no-release-refused`: a change that touches the files of a pack, has no note and no bump of its own, is refused as "no release", and one with a note whose `packs:` list is empty passes.
- AC-12 `note-after-approval`: a `release.md` that differs from the one at the commit recorded in `approval.md` is refused until the plan is approved again.
- AC-13 `tag-unchanged`: the release tag of ADR 0019 is asked and pushed for the merge that carries the numbers, with the same rules (a test through the train and one through a single merge).
- AC-14 `rules-and-docs`: every text and test the assumptions list is changed with the rule, `python3 scripts/check.py`, `python3 scripts/gen-catalog.py --check` and `node plugins/compozy/skills/compozy-setup/scripts/gen-agents.mjs --check` pass, and a new ADR records the decisions, amends ADR 0022 and ADR 0025, and builds on ADR 0003, ADR 0027 and ADR 0030 without amending them.
- AC-15 `real-run-every-case`: the real-run proof covers every case the plan declares, each input variant and the conducting session's own part: the planner writing `release.md`, the adr-author drafting `docs/adr/<slug>.md`, a train of two noted changes, a single merge with a noted change, an old-rule change, a consumer project, and each refusal (hand edit, no release, note after approval, unlanded citation, duplicate slug); and, with the real agents, the adr-author in a project with no ADR folder and in one with no `devkit.release_tag`, the planner with a malformed note and without the setting, the readiness review flagging a missing note, a numbered ADR and a bump task, and the implementer refusing to edit a release line of a noted change; not one case plus prose tests.

AC-12 is met by recording the note's hash in `approval.md` (design D-9): the commit an approval
header names holds no plan file, so "the note at that commit" cannot be read.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `change-delivery`: the release note, the derived release state and its refusals, `assign-release`, the unnumbered ADR, the release edit that stales nothing; the renumbering requirement keeps to numbered ADRs.
- `change-coordination`: `assign-release` as a session step, the planner's stop without a note, a listed record found after its numbering; "An ADR number taken" kept for changes with no note.
- `delivery-train`: a join numbers a noted change from its note (flagged: beyond the two capabilities the brief named).
- `reviews-check`: the train's own commits may number an unnumbered ADR (flagged likewise).

## Impact

- devkit-openspec hooks: `deliver-check.mjs`, `release-merge.mjs`, `conduct-check.mjs`, `change-loop.mjs`, `flow-check.mjs` (one call site); tests of each. The version helpers and `PIN_FILE`, `PIN_PACK` and `PIN_PACK_NAME` move from `release-merge.mjs` into `deliver-check.mjs` and are re-exported, as `pinsIn` and `setPins` already are (ADR 0027 put them there), so a consumer's CI, which downloads `guard.mjs`, `deliver-check.mjs` and `merge-setup.mjs` only, keeps loading the checker (design D-3a).
- devkit-openspec skills: `ship-change` and `devkit` rows for `assign-release` and the approval line.
- devkit-core: `change-planner`, `adr-author`, `adr-reviewer`, `tdd-implementer`, `adr-authoring` and `plan-readiness-review`.
- devkit-compozy: regenerated agent copies only.
- Repository: `scripts/check.py`, `docs/openspec-flow.md`, `CONTRIBUTING.md`, `openspec/config.yaml`, ADR 0022 and 0025 header lines and notes (ADR 0003, 0027 and 0030 unchanged).

Dependencies: `archive-release-pin` has merged (train 4, in the plan base): the pin definition is in
`deliver-check.mjs`, and the pin test reads devkit-openspec's version from its manifest, so this change
edits no pin assertion and waits for nothing. The line between the two: ADR 0027 and ADR 0030 let the
pin lines pass unnamed in the archive check; this change removes the rewrite from every branch (design
D-17). Exit criteria: every phase gate, then `node scripts/test-suite.mjs && python3
scripts/check.py` (run by the train), `python3 scripts/gen-catalog.py --check`, the `gen-agents.mjs
--check`, `claude plugin validate .` and `openspec validate release-at-merge --strict`. Decisions cited:
`ADR [release-at-merge]`, ADR 0002, 0003, 0019, 0022, 0025, 0027, 0030. Open decisions inherited: none logged;
the flags for the owner are in design.md, "Flagged for the owner".
