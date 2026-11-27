<!-- devkit-stage specs result=passed attempt=8 commit=98ffb172675d7d320587e3c7d2ca8f51ae6ec410 -->
# Spec Delta

## ADDED Requirements

### Requirement: A change states its release in a note when its project names a release file
In a project that names `devkit.release_tag`, a change SHALL state its release in
`openspec/changes/<id>/release.md`: a `packs:` list (each pack with `patch`, `minor` or `major`; an
empty list is no release), an optional `marketplace:` then `release:` bump, a changelog title line and
a body. One reader SHALL read it for the checker and the step. Without `devkit.release_tag` the file
SHALL be ignored.

#### Scenario: A complete note
- **WHEN** `release.md` lists `devkit-openspec: minor` and `devkit-core: patch`, no `marketplace:` line, and a `## <title>` line followed by a body
- **THEN** the note is read with those two bumps, a marketplace bump of `minor` (the largest pack bump), that title and that body

#### Scenario: An empty packs list
- **WHEN** `release.md` says `packs: []` and has no `marketplace:` or `release:` line
- **THEN** the note is read as no release, and no changelog title or body is required

#### Scenario: No release file setting
- **WHEN** the project names no `devkit.release_tag` and a change carries a `release.md` with a malformed field
- **THEN** the delivery checker answers exactly what it answered before this rule, and no step reads the file

### Requirement: A malformed release note is refused naming the field
A release note the reader cannot read SHALL be refused by the delivery checker (`blocked`) and by the
delivery step (exit 2) with one plain message that starts `release.md:` and names the field. An empty
file SHALL be refused as having no `packs:` line; a last line with no newline SHALL be read as if it
had one. A note the project cannot release SHALL be refused the same way: a pack the project does not
have, and a `marketplace:` bump in a project with no `.claude-plugin/marketplace.json`.

#### Scenario: A malformed field
- **WHEN** `release.md` has no `packs:` line, a bump other than `patch`, `minor` or `major`, a pack named twice, the fields out of order, an unknown line before the title, no title or no body for a release, a body that opens a code fence it never closes, or a body line outside a code fence that starts `## ` (a heading the changelog reads as a version)
- **THEN** the delivery checker answers `blocked` with a reason that starts `release.md:` and names that field, and the delivery step exits 2 with the same message

#### Scenario: An empty or unterminated file
- **WHEN** `release.md` is empty, or its last line has no newline
- **THEN** the empty file is refused as having no `packs:` line, and the file without a final newline is read as if it had one

#### Scenario: A pack the project does not have
- **WHEN** every task is ticked and `release.md` lists `devkit-nope: patch`, a name no `plugins/<dir>/.claude-plugin/plugin.json` has
- **THEN** the delivery checker answers `blocked` with a reason that starts `release.md: packs:` and names `devkit-nope`, and the delivery step exits 2 with the same message

#### Scenario: A marketplace bump with no marketplace
- **WHEN** every task is ticked, `release.md` says `marketplace: minor`, and the project has no `.claude-plugin/marketplace.json`
- **THEN** the delivery checker answers `blocked` with a reason that starts `release.md: marketplace:`, and the delivery step exits 2 with the same message

### Requirement: A change with a release note leaves the release lines as the base has them
For a change with a release note, the delivery checker SHALL accept a branch whose release lines
equal those of its merge base with the base, or what the delivery step computes from that merge base
and the note, and SHALL refuse any other with `release lines edited by hand:` and the paths. The
release lines are the pack and marketplace versions, `CHANGELOG.md`, the CI pins, the release file's
`version`, and the names and citations of the unnumbered ADRs `decisions.md` lists.

#### Scenario: The base's lines
- **WHEN** a change with a note bumps nothing on its branch and adds `docs/adr/<id>.md`
- **THEN** the delivery checker raises no release refusal

#### Scenario: A version written by hand
- **WHEN** the same branch also changes the `version` of `plugins/a/.claude-plugin/plugin.json`
- **THEN** the delivery checker answers `blocked` with `release lines edited by hand: plugins/a/.claude-plugin/plugin.json`

#### Scenario: Numbers the step wrote
- **WHEN** the branch holds exactly what the delivery step wrote from its merge base and its note
- **THEN** the delivery checker raises no release refusal

#### Scenario: Half of what the step writes
- **WHEN** the branch holds the versions the step computes but its ADR still has no number
- **THEN** the delivery checker refuses it as release lines edited by hand, naming the ADR path

### Requirement: A release line the step wrote is known by the step's own record
For a change with a release note, a release line whose head value is the merge base's SHALL be read
as the base's, even when the step's record holds it too. Otherwise a line whose head value the
step's own record holds SHALL be read as the step's, for the step to number again, and never refused
as edited by hand. The record SHALL be read per line, each line from the newest recorded commit that
changed it. A value no recorded commit wrote keeps the refusal.

#### Scenario: The base merged by hand after the step refused a conflict
- **WHEN** the step numbered the branch `devkit-openspec` 1.1.0 and `docs/adr/0002-feat.md`, the base then released 1.1.0 and took `0002` for `docs/adr/0002-other.md`, and a person merged the base by hand, resolving a conflict in `src/a.ts` and taking the base's side of every release file
- **THEN** the delivery checker raises no release refusal and the next step is `assign-release`

#### Scenario: A version both sides released
- **WHEN** the step's record wrote `devkit-openspec` 1.1.0, the base released 1.1.0 too, and a person merged the base by hand as above
- **THEN** the manifest reads as the merge base's, the step gives none of its text back, and the step then writes the version it computes from the base

#### Scenario: A number the step kept across a later step commit
- **WHEN** the step numbered `docs/adr/0002-feat.md`, the base then released `devkit-openspec` 1.1.0 with no ADR, the step ran again in a merge commit that kept `0002` without renaming it, and the base then took `0002` for `docs/adr/0002-other.md` and changed `src/a.ts`, so the step exited 2 naming `src/a.ts` and a person merged the base by hand as above
- **THEN** the step does not refuse the branch as edited by hand: it gives back the `0002` the first step commit wrote and exits 0, and the branch holds `docs/adr/0003-feat.md`, the base's `docs/adr/0002-other.md` as it was, `devkit-openspec` 1.2.0, every citation the step had written naming `0003`, and the release assigned and current

#### Scenario: A number the step never wrote
- **WHEN** the same merged branch also sets a version the step's recorded commit did not write
- **THEN** the delivery checker answers `blocked` with `release lines edited by hand:` naming that manifest

#### Scenario: No record
- **WHEN** the step's commit carries no record, as one made before this rule, and the branch was merged by hand as above
- **THEN** the delivery checker refuses it as release lines edited by hand, naming `docs/adr/feat.md`

### Requirement: The release is never judged without the base
For a change with a release note, when `origin/<base>` is missing, so the release lines cannot be
computed, the delivery checker SHALL answer `blocked` naming the fetch to run, and SHALL never pass
the release.

#### Scenario: No base to compute from
- **WHEN** a change with a note has every task ticked and the clone has no `origin/main`, its base
- **THEN** the delivery checker answers `blocked` with a reason that names `origin/main` and `git fetch origin main`, and gives no step after it

### Requirement: A change with neither a note nor a bump of its own is refused
In a project that names `devkit.release_tag`, once every task of a change is ticked, the delivery
checker SHALL refuse with a reason that starts `no release:` a change with no release note whose
branch changes a file of a pack whose manifest version it did not change, or whose `decisions.md`
lists an ADR without a number. A change with a note, its `packs:` list empty included, SHALL NOT be
refused for this.

#### Scenario: A pack changed with no release
- **WHEN** a change with no note changes `plugins/a/hooks/x.mjs` and leaves `plugins/a/.claude-plugin/plugin.json` at its merge base's version
- **THEN** the delivery checker answers `blocked` with a reason that starts `no release:` and names `plugins/a`

#### Scenario: A change opened before release notes
- **WHEN** a change with no note changes `plugins/a/hooks/x.mjs` and bumps `plugins/a/.claude-plugin/plugin.json`
- **THEN** no release refusal is given, and the change is delivered by the rule it had before

#### Scenario: A note that releases nothing
- **WHEN** a change whose note says `packs: []` changes `plugins/a/hooks/x.mjs`
- **THEN** no release refusal is given

#### Scenario: An unnumbered ADR with no note
- **WHEN** a change with no note lists `docs/adr/<id>.md` in its `decisions.md`
- **THEN** the delivery checker answers `blocked` with a reason that starts `no release:` and names that path

### Requirement: The plan approval covers the release note
For a change on a script with a readiness stage that carries a release note, the recorded plan
approval SHALL hold the hash of the note it approved, and the delivery checker SHALL ask the owner's
approval again (`stop-plan-approval`) whenever the note's hash differs from the recorded one, whether
or not a task is ticked, with the reason `release note changed after approval`. An approval recorded
for a change with no note SHALL be read as before.

#### Scenario: The note edited after the approval
- **WHEN** `approval.md` records the hash of `release.md`, tasks are ticked, and `release.md` then changes
- **THEN** the next step is `stop-plan-approval` with the reason `release note changed after approval` and the new hash in its `release` field

#### Scenario: A note added after the approval
- **WHEN** `approval.md` records no note and the change now carries `release.md`
- **THEN** the next step is `stop-plan-approval` with the same reason

#### Scenario: No note
- **WHEN** a change with no `release.md` has an approval with no note line
- **THEN** the approval is read exactly as before this rule

### Requirement: Every reader of the plan approval checks the release note
Every reader of the plan approval (the delivery checker, the conductor's planning row and the loop's
acceptance of the decision records) SHALL apply the release note's hash as the delivery checker
does, the project's `devkit.release_tag` read by the approval reader itself, so no caller can leave
the note out. The stage checker's test of a plan revised after the start is the one exception (the
next requirement).

#### Scenario: The conductor and the acceptance of the records
- **WHEN** `release.md` changed after the approval and no task is ticked
- **THEN** the conductor's planning row answers `approve` with the reason `release note changed after approval`, and the acceptance of the decision records is refused with that reason

#### Scenario: A folder outside a project's layout
- **WHEN** the approval reader is given a change folder that is not under `openspec/changes/` or `openspec/changes/archive/` of a project
- **THEN** it reads no release setting and the approval it returns has no note keys

### Requirement: A plan revised with its note after the start goes back to the readiness review
The stage checker's test of whether the owner approved the current readiness review, which decides
that a plan revised after the work started goes back to its gates, SHALL read the plan approval
without the release note, so a plan revised together with its note goes back to the readiness review
first, and the note is asked at the approval that follows it.

#### Scenario: A plan and its note revised after the work started
- **WHEN** a task is ticked, `approval.md` records the readiness hash, the plan's digest and the note's hash, and `design.md` and `release.md` both changed since
- **THEN** the plan readiness is reported stale with the reason `plan-revised` and is the next stage, and once it passed again the next step is `stop-plan-approval` carrying the readiness hash, the plan's digest and the note's hash

#### Scenario: Only the note revised after the work started
- **WHEN** a task is ticked, `approval.md` records the readiness hash, the plan's digest and the note's hash, and only `release.md` changed since
- **THEN** the plan readiness stays passed, and the next step is `stop-plan-approval` with the reason `release note changed after approval`

### Requirement: With no train the release is assigned by one step before the merge
In a project that names `devkit.release_tag` and sets no delivery train, for a change with a release
note the delivery checker SHALL answer `assign-release` in place of `update-branch` or the conflict
stop when the branch is behind or in conflict with the base, and, once every other item is met,
before `enable-auto-merge`, `wait-merge`, `ready` or `ready-base` until the branch holds the base and
the release computed from it. A train project SHALL never be answered `assign-release`.

#### Scenario: The last step before the merge
- **WHEN** a change with a note has every item met in `merge` mode, holds `origin/<base>`, and its release lines are the base's
- **THEN** the next step is `assign-release`, not `enable-auto-merge`, and after the step's commit and a push the next step is `enable-auto-merge`

#### Scenario: The base moved after the assignment
- **WHEN** a change whose branch holds the assigned release falls behind a base that released another change
- **THEN** the next step is `assign-release`

#### Scenario: Auto-merge on while the release is not current
- **WHEN** a change with a note has auto-merge on, GitHub does not report its branch behind the base, and the base has released another change since the branch's assignment
- **THEN** the next step is `assign-release`, not `wait-merge`

#### Scenario: The pull request in conflict with the base
- **WHEN** a change with a note and no train has its pull request reported in conflict with the base, and that conflict is the only thing item 5 is blocked for
- **THEN** the next step is `assign-release` with `conflict` true, not `blocked` with the conflict, and for a branch only behind the base it is `assign-release` with no `conflict`

#### Scenario: A train project
- **WHEN** the project sets `devkit.delivery.train`
- **THEN** no change is answered `assign-release`, and a noted change boards with its release lines as the base has them

### Requirement: The release step merges the base and commits only release lines
The delivery step SHALL merge `origin/<base>` when the branch is behind it, resolving release lines
by rule and keeping no branch-written number, then write the release lines from the note and commit
only them (and the merge). It SHALL never push. A merge it cannot resolve SHALL be undone, leaving the
branch at its old head, and the step SHALL exit 2 with the paths. In a project that names no
`devkit.release_tag` the step SHALL exit 3, a setup error, and write nothing.

#### Scenario: A base that released another change
- **WHEN** the branch holds an assigned release and the base since released the same pack
- **THEN** the step exits 0, the branch holds the base's release plus the note's bumps, and no conflict was left for anyone to resolve

#### Scenario: Two changes in a row
- **WHEN** two changes with notes bump the same pack and merge one after the other with no train
- **THEN** the second takes the version after the first's, and neither branch ever conflicts on a release line

#### Scenario: A conflict outside the release lines
- **WHEN** the merge of the base conflicts in `src/a.ts`
- **THEN** the step exits 2 naming `src/a.ts`, the branch is at its old head and no merge is in progress

#### Scenario: A project with no release file setting
- **WHEN** `release-merge.mjs --assign --base main` runs in a project that names no `devkit.release_tag`
- **THEN** it exits 3 with a message naming `devkit.release_tag`, and no file and no commit is written

### Requirement: The release step records what it wrote and numbers again after a merge by hand
The delivery step SHALL record in its own commit's message the change, the release files, the ADR
renames and the citation paths it wrote. After the base was merged by hand, the step SHALL give back
only the numbers its record names, each found by the text around it where a whole-text merge of the
path conflicts, and number the branch above the base. When a number it wrote cannot be found once
that way, the step SHALL exit 2 naming the path and leave the branch as it was.

#### Scenario: The step after a merge by hand
- **WHEN** the step numbered the branch `devkit-openspec` 1.1.0 and `docs/adr/0002-feat.md`, the base then released 1.1.0 with `docs/adr/0002-other.md` and changed `src/a.ts`, the step exited 2 naming `src/a.ts`, and a person merged the base by hand, resolving `src/a.ts` and taking the base's side of every release file
- **THEN** the step exits 0, the branch holds `docs/adr/0003-feat.md`, `devkit-openspec` 1.2.0 with its changelog entry above the base's 1.1.0, every citation the step had written names `0003`, and the release reads assigned and current

#### Scenario: The step's record
- **WHEN** the step commits
- **THEN** the commit's subject is as before and its message ends with the trailers `Release-change: <id>`, one `Release-line:` per release file it wrote, one `Release-adr: <from> -> <to>` per record it renamed and one `Release-citation:` per path whose citations it rewrote

#### Scenario: Words added beside a citation the step wrote
- **WHEN** the branch was merged by hand as above, and a person then added words in `docs/x.md` beside the citation the step had written (`see ADR 0002` became `see ADR 0002 and its notes`)
- **THEN** the step exits 0, and `docs/x.md` reads `see ADR 0003 and its notes`

#### Scenario: A citation the step wrote, changed after its record
- **WHEN** the branch was merged by hand as above, and a person then changed in `docs/x.md` the citation the step had written (`see ADR 0002` became `see the record 0002`)
- **THEN** the step exits 2 with `cannot give back the numbers the step wrote in docs/x.md`, writes nothing, and the branch's head and tree are as they were before the run

#### Scenario: A citation on a one-line list the base extended
- **WHEN** the step wrote `ADR 0002` on the one-line list `ADRs: docs/adr/ (0001 first; ADR 0002 the rule)` of `docs/context.yaml`, the base then added `; 0002 other` to that line and took `0002`, and the base was merged by hand keeping both entries on the line
- **THEN** the step exits 0 with `docs/adr/0003-feat.md`, the line reads `ADRs: docs/adr/ (0001 first; ADR 0003 the rule; 0002 other)`, and the release reads assigned and current, with no give-back by hand

#### Scenario: The base's entry with the same number on the same line
- **WHEN** the same, but the base wrote its entry `; ADR 0002 other` and the merge by hand left the line `ADRs: docs/adr/ (0001 first; ADR 0002 the rule; ADR 0002 other)`
- **THEN** the step exits 0, and the line reads `ADRs: docs/adr/ (0001 first; ADR 0003 the rule; ADR 0002 other)`

#### Scenario: A citation the merge dropped where the base cites its own number
- **WHEN** the same base entry `; ADR 0002 other`, and the merge by hand left the base's line `ADRs: docs/adr/ (0001 first; ADR 0002 other)`
- **THEN** the step exits 2 with `cannot give back the numbers the step wrote in docs/context.yaml`, writes nothing, the branch's head and tree are as they were, and the base's `ADR 0002` is not touched

### Requirement: An unnumbered ADR is numbered at the delivery
A change with a release note SHALL name each ADR it adds `<folder>/<slug>.md` and cite it
`ADR [<slug>]`. The delivery step and the train's join SHALL rename each such file `decisions.md`
lists to `<folder>/<NNNN>-<slug>.md`, NNNN being the next free number of that folder on the base, in
the order listed, and rewrite its citations in every tracked text file outside `openspec/changes/`.
They SHALL change no file under `openspec/changes/`.

#### Scenario: One ADR
- **WHEN** the base's highest ADR is `0026` and the change adds `docs/adr/feat.md`, cited `ADR [feat]` in `docs/x.md` and in its own `design.md`
- **THEN** the file becomes `docs/adr/0027-feat.md`, `docs/x.md` says `ADR 0027`, `design.md` still says `ADR [feat]`, and the readiness, approval, reviews and evidence stay current

#### Scenario: Two ADRs of one change
- **WHEN** the change's `decisions.md` lists `docs/adr/feat.md` then `docs/adr/feat-store.md`, the second cites the first as `ADR [feat]` and `(feat.md)`, and the base's highest ADR is `0026`
- **THEN** they become `0027-feat.md` and `0028-feat-store.md`, the second says `ADR 0027` and `(0027-feat.md)`, every `ADR [feat-store]` becomes `ADR 0028` and none becomes `ADR 0027`, and the record of `assign-release`'s commit names the two renames in that order

### Requirement: A citation lives in every text file but tests and fixtures
The files that hold ADR citations SHALL be every tracked text file outside `openspec/changes/`
except test files and fixtures: a name matching `*.test.*` or `*-fixtures.*`, or a file under a
folder named `test` or `tests`, which hold test data and no citation. The same files SHALL be read
for the citations of a change, for a citation still standing, for the rewrite, for the numbers a
later run or a join gives back, and for the release edit that stales nothing.

#### Scenario: A citation in a source file
- **WHEN** the base's highest ADR is `0026` and `plugins/a/hooks/x.mjs` holds the comment `// see ADR [feat]`
- **THEN** the comment says `// see ADR 0027` after the numbering

#### Scenario: A test fixture
- **WHEN** `plugins/a/hooks/x.test.mjs`, `plugins/a/hooks/x-fixtures.mjs` and `tests/a.md` each hold the text `ADR [feat] in docs/adr/feat.md`
- **THEN** none of them changes, and none is read as a citation still standing

#### Scenario: A test literal edited by hand
- **WHEN** a commit after the recorded evidence changes the literal `docs/adr/feat.md` to `docs/adr/0002-feat.md` in `plugins/a/hooks/x.test.mjs` and nothing else
- **THEN** the evidence is stale, naming that commit and that file

### Requirement: The file form of a citation is rewritten only where it names an ADR folder's file
The citation form `<slug>.md` SHALL be rewritten to `<NNNN>-<slug>.md`, and masked back, only where
it names a file of an ADR folder: its folder part ends in `adr/` or `decisions/`, or it has no folder
part and stands in a file of `docs/adr/` or `docs/decisions/`. A document elsewhere that shares the
slug's name SHALL keep every link to it.

#### Scenario: A document with the change's name
- **WHEN** the base's highest ADR is `0026`, the change `roles` adds `docs/adr/roles.md`, `docs/x.md` links `docs/roles.md` and `adr/roles.md`, and `docs/adr/0010-y.md` links `(roles.md)`
- **THEN** after the numbering `docs/x.md` still links `docs/roles.md`, its `adr/roles.md` link names `adr/0027-roles.md`, and `docs/adr/0010-y.md` links `(0027-roles.md)`

### Requirement: The numbering refuses a slug taken and a citation not landed
The delivery step and the train's join SHALL refuse, naming the slug, an ADR whose slug another file
of `docs/adr/` or `docs/decisions/` already has, and a citation `ADR [<other>]` of an ADR the base
has not numbered; once the base numbers it, the citation SHALL be rewritten to that number. With no
train, the delivery checker SHALL answer `blocked` for such a citation once every task is ticked, so
the step is not handed a numbering it must refuse.

#### Scenario: A slug the base already has
- **WHEN** the change adds `docs/adr/feat.md` and the base holds `docs/adr/0031-feat.md`
- **THEN** the step exits 2 naming `feat` and both paths, and nothing is renamed

#### Scenario: A citation of another change's ADR
- **WHEN** the change cites `ADR [other]` and the base has no `docs/adr/<NNNN>-other.md`
- **THEN** the step exits 2 with a message naming `other`

#### Scenario: A citation in a source comment
- **WHEN** a changed `plugins/a/hooks/x.mjs` holds the comment `// amends ADR [other]` and the base has no `docs/adr/<NNNN>-other.md`
- **THEN** the step exits 2 with a message naming `other`, as for the same citation in a Markdown file

#### Scenario: The checker sees the citation first
- **WHEN** a change with a note in a project with no train has every task ticked and cites `ADR [other]`, and `origin/main` has no `docs/adr/<NNNN>-other.md`
- **THEN** the delivery checker answers `blocked` with `ADR [other] is cited but has not landed on main`, not `assign-release`

#### Scenario: The cited ADR landed
- **WHEN** the base now holds `docs/adr/0028-other.md`
- **THEN** the step rewrites `ADR [other]` outside `openspec/changes/` to `ADR 0028`

### Requirement: A consumer project's release file follows the note
In a project that names `devkit.release_tag`, the delivery step SHALL write the top-level `version`
of that file with the note's `release:` bump and, only when the project has a root `CHANGELOG.md`,
the note's entry headed by that version. It SHALL create no file, and a missing release file, ADR
folder or `CHANGELOG.md` SHALL give no refusal.

#### Scenario: A consumer with a changelog
- **WHEN** `devkit.release_tag` names `package.json` at version `1.4.0`, the note says `packs: []` and `release: minor`, and the project has `CHANGELOG.md`
- **THEN** the step writes `1.5.0` into `package.json` and the entry `## 1.5.0 — <title>` above the newest entry of `CHANGELOG.md`

#### Scenario: A consumer with nothing else
- **WHEN** the same project has no `CHANGELOG.md`, no `docs/adr/` and no pack
- **THEN** the step changes only `package.json`, and no other file is created

#### Scenario: A release file that does not exist
- **WHEN** `devkit.release_tag` names a file the project does not have
- **THEN** the step writes nothing for it and refuses nothing

### Requirement: A release bump on a pack's own manifest is stated under packs
When the file `devkit.release_tag` names is the manifest of a pack, a note that gives a `release:`
bump SHALL be refused, naming the pack, because that file's version follows the pack's bump.

#### Scenario: This repository's release file
- **WHEN** `devkit.release_tag` names `plugins/openspec/.claude-plugin/plugin.json` and the note says `release: minor`
- **THEN** the delivery checker answers `blocked` with a reason that starts `release.md: release:` and names `devkit-openspec`

### Requirement: The repository check refuses an unnumbered ADR on the base
This repository's `scripts/check.py` SHALL read as a record of `docs/adr/` or `docs/decisions/` a
file `<NNNN>-<slug>.md`, or a file `<slug>.md` whose first non-blank line starts `# ADR [`, and
SHALL refuse an unnumbered record on the base. The base is, first match wins: a root that is not a
git repository; a pull request whose head is `train/<n>` (any other pull request is a branch); the
default branch checked out; a `HEAD` the default branch contains. Anything else is a change branch.

#### Scenario: An unnumbered record on its change branch
- **WHEN** a change branch adds `docs/adr/feat.md` titled `# ADR [feat]: ...` and the change's `decisions.md` lists it
- **THEN** `scripts/check.py` reports no ADR problem

#### Scenario: An unnumbered record on the base
- **WHEN** the default branch is checked out, or the pull request's head is `train/1`, and `docs/adr/feat.md` is an unnumbered record
- **THEN** `scripts/check.py` exits 1 naming `docs/adr/feat.md` as an unnumbered ADR on the base branch

#### Scenario: A file that is not a record
- **WHEN** `docs/adr/README.md` does not start with `# ADR [`
- **THEN** `scripts/check.py` does not read it as a record

### Requirement: The repository check refuses an unlisted unnumbered ADR and a slug held twice
`scripts/check.py` SHALL refuse, on the base and on a change branch, two records with one slug
across `docs/adr/` and `docs/decisions/`, and an unnumbered record that no active change's
`decisions.md` lists in an `- ADR:` line.

#### Scenario: An unnumbered record no change lists
- **WHEN** a change branch holds the unnumbered record `docs/adr/stray.md` and no active change's `decisions.md` lists it
- **THEN** `scripts/check.py` exits 1 naming `docs/adr/stray.md`

#### Scenario: Two records with one slug
- **WHEN** `docs/adr/feat.md` and `docs/adr/0031-feat.md` are both records, on a change branch or on the base
- **THEN** `scripts/check.py` exits 1 with `a second ADR with the slug feat:` naming both paths

## MODIFIED Requirements

### Requirement: An ADR number taken on the default branch is renumbered without the owner
From the implementation on, when the change's branch adds an ADR file in `docs/adr/` or
`docs/decisions/` whose four-digit number the default branch already gives another file of the same
folder, the next step SHALL hand the implementer the renumbering: each such file to the next free
number, and every reference to it in the branch's files. The owner SHALL NOT be asked. An ADR that a
change with a release note lists without a number SHALL NOT be given this step.

#### Scenario: A sibling took the number
- **WHEN** the branch adds `docs/adr/0016-a.md` and the default branch holds `docs/adr/0016-b.md` and `docs/adr/0017-c.md`
- **THEN** the next step renumbers `docs/adr/0016-a.md` to `0018`, handed to the implementer, and names both paths

#### Scenario: No clash
- **WHEN** the branch adds `docs/adr/0016-a.md` and the default branch has no other file numbered `0016` in that folder
- **THEN** no renumbering step is given

#### Scenario: The same file on both
- **WHEN** the default branch holds the same `docs/adr/0016-a.md` the branch added, after a merge
- **THEN** no renumbering step is given

#### Scenario: Two clashes
- **WHEN** the branch adds `0016-a.md` and `0017-b.md` and the default branch holds other files numbered `0016` and `0017`, its highest being `0017`
- **THEN** the step renumbers them to `0018` and `0019`, in the order of their numbers

#### Scenario: A change with a release note
- **WHEN** a change that carries `release.md` holds `docs/adr/0018-feat.md` after the delivery step and the default branch took `0018` since
- **THEN** no renumbering step is given, and the next step is `assign-release`

### Requirement: A plain commit on the branch keeps its rule
A commit on the branch's own line that is not a merge of the base SHALL be judged as before the
own-files rule, whatever files it touches, and the per-reviewer allowances (the test-spared
reviewers, the `openspec/`-only rule for approved or declined verdicts) SHALL stay as they are.
For a change with a release note, a release edit SHALL NOT be judged as a plain commit: a commit
after the recorded evidence or an approved or declined review, the delivery step's commit and its
merge of the base included, whose every changed path differs from its parent (a merge's first
parent) only in release lines (versions, the changelog, the CI pins, the version of the release
file, and an unnumbered ADR renamed to its number, or the change's own ADR renumbered by a later run
of the step after the base took its number, with its citations rewritten) SHALL leave them current.
A rejected review and a change with no note SHALL be judged as before. On an owner's forced merge
the evidence and the reviews SHALL be read by the requirement "The open items of a forced merge are
named", so the delivery step's release commit can list them there as open items, an over-report and
never a pass.

#### Scenario: A plain product commit after a base merge
- **WHEN** a merge of `origin/<base>` after R brings only unrelated files and a later one-parent commit on the branch changes `src/unrelated.ts`, a file the branch never changed before
- **THEN** the records are stale and the reason names that commit and `src/unrelated.ts`

#### Scenario: A test-only commit after a base merge
- **WHEN** a merge of `origin/<base>` after R brings only unrelated files and a later one-parent commit changes only test files
- **THEN** the reviews of the four test-spared reviewers stay current and the evidence and the other reviews are stale, as before this rule

#### Scenario: The step's commit
- **WHEN** the evidence and the approved reviews record commit R and the only later commit is the one `assign-release` made
- **THEN** the delivery checker, the stage checker and `deliver-check --ci` read them as current, while an owner's forced merge of that head reads them by "The open items of a forced merge are named" and can list them as open items

#### Scenario: A later run that renumbers the change's own ADR
- **WHEN** the evidence and the approved reviews record commit R after a first run of the step numbered `docs/adr/0002-feat.md`, the base then took `0002` and changed no file of the change, and the only later commit is the step's merge of the base that renumbers the record to `0003` and rewrites its citations
- **THEN** the delivery checker reads them as current

#### Scenario: A release commit that also edits a sentence
- **WHEN** the later commit renames the ADR and also changes a sentence of `docs/openspec-flow.md` that is not a citation
- **THEN** the records are stale and the reason names that commit and `docs/openspec-flow.md`
