<!-- devkit-stage design result=passed attempt=1 commit=9184debf298ce02dbf1268f0ccbc8417947dce3d -->
# Design

Change: `coordinator-field-fixes` · Date: 2026-11-20 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(sources: `requirements.md` with its eight reproductions, `proposal.md`, the specs of this change).

## Context

See `proposal.md` (Why) for the eight defects and `requirements.md` (Reproductions) for how each
was reproduced on 0.16.0 (`9184deb`). The code each defect lives in, as of that commit:

| Defect | Where | What it does today |
|---|---|---|
| 1 | `plugins/openspec/hooks/change-loop.mjs#unfinished` | Skips an active folder only when the main checkout's working tree holds the archived folder, and only for rank 1 (a checkout on another branch); a checkout on `<id>` or `chore/archive-<id>` is always listed |
| 2 | `plugins/openspec/hooks/flow-check.mjs#isPreviousScript` | Previous script only when no stage file of the change has a header; one headed `evidence.md` flips it |
| 3 | `plugins/openspec/hooks/deliver-check.mjs#runCi`, `#selectCiChange`, `#archivePrCheck` | Applies the delivery contract to any selected change; fails on two touched folders; fails an archive folder without `retro.md` whatever its schema |
| 4 | `deliver-check.mjs#findChangePr`, `#collectState` | Off the change branch, the newest merged PR whose body links `openspec/changes/<id>/evidence.md`, else whose head's last segment is the id, is "the change PR"; any merged one switches to the archive steps with every item met |
| 5 | `plugins/openspec/skills/openspec-setup/scripts/github-setup.mjs` | Proposes as required checks every check-run name on the default branch's head; a 403 on the rulesets is a raw `error` line; Actions state never read |
| 6 | `flow-check.mjs#makeOpenspec`, `guard.mjs#sessionChange`, `install-schemas.sh` | `spawnSync('openspec')` / `execFileSync('openspec')` / `command -v openspec`: the `PATH` one |
| 7 | `openspec-setup` step 4, the `devkit` schema (`apply.requires: [approval]` since 0.15.0) | Replaces the schemas with no look at changes under way; a full-script change that started under 0.13/0.14 is blocked by `openspec instructions apply` on a missing `approval.md` |
| 8 | `plugins/compozy/skills/compozy-setup/SKILL.md` ("Re-running over an existing `.compozy/`") | The model replaces every installed file; only `.compozy/README.md` prose is kept as a diff |

Constraints that shape every decision below:

- `guard.mjs`, `deliver-check.mjs` and `merge-setup.mjs` are the three files a project's
  `devkit-reviews` workflow downloads (`docs/openspec-flow.md`, CI): no new module may become a
  static import of them.
- `flow-check.mjs` imports `guard.mjs` and `deliver-check.mjs`; `change-loop.mjs` imports all three
  and `conduct-check.mjs`. New shared code goes into the lowest module that every user already
  imports (`guard.mjs` for the CLI, `deliver-check.mjs` for delivery).
- Product code, `docs/adr/` included, is closed until readiness is approved (`guard.mjs` edit lock):
  ADR 0012 is drafted in this document (D-5) and created by task 4.4.
- OpenSpec 2.0.0 judges an artifact done when its file exists and offers no per-artifact skip but
  `skip_specs` (read in the installed CLI's `dist/core/artifact-graph/instruction-loader.js`,
  2026-11-20). An `apply.requires` artifact can be satisfied only by its file.

## Goals / Non-Goals

**Goals:**

- One rule per defect, each in one function with one owner, used by every caller that needed it.
- Each defect reproduced by a test that fails on 0.16.0 before its fix (AC-13), recorded.
- Every existing test that pinned a replaced rule changed with its invariant named (D-11).

**Non-Goals:**

- New `deliver-check` step names, new `change-loop` rows, new panel views.
- A command that moves a previous-script change to the current script.
- Reading `ship:` in the CI check; any change to the archive PR's file check.
- Redesigning the CompozyOS loop (round 21); only its grill sentences change.
- Bumping projects' pinned `devkit-reviews` workflows (theirs to bump; D-9 says so).

## D-1 The OpenSpec CLI the packs start (defect 6, A-11, AC-9)

**Resolution of A-11's ambiguity: (a) and (b).** An installed pin is used; a declared pin that is
not installed is refused with "install it". (b) is chosen because one field project forbids the
global CLI: falling back to `PATH` there would start exactly the CLI the project refuses.

New exports of `plugins/openspec/hooks/guard.mjs` (no new module, so the CI download stays three
files):

- `openspecCli(root)` → `{ bin, where, pinned }` or `{ error }`:
  1. Candidates, in order: `<root>/node_modules/.bin/openspec`; then, when the checkout is a
     worktree, `<main>/node_modules/.bin/openspec`, where `<main>` is the parent of
     `git -C <root> rev-parse --path-format=absolute --git-common-dir`. The first that exists wins:
     `{ bin: <that path>, where: <that path>, pinned: true }`.
  2. No candidate: read `<root>/package.json`, then `<main>/package.json`; if either lists
     `@fission-ai/openspec` under `dependencies`, `devDependencies` or `optionalDependencies`:
     `{ error: 'the project pins @fission-ai/openspec <range> in <path to package.json> but it is not installed; run the project install (npm install, or its package manager) and run again' }`.
  3. Else `{ bin: 'openspec', where: 'PATH', pinned: false }`.
- `openspecRefusal(cli, versionText)` → `null` or the message: when `versionText` gives no
  `\d+.\d+.\d+` or a major other than 2,
  `openspec <version> at <where> is not supported: devkit needs OpenSpec 2.x; move the project's pin to 2.x (npm i -D @fission-ai/openspec@2)`
  for a pinned CLI, and the message of today (`openspec <version> is not supported: flow-check reads OpenSpec 2.x`) for the `PATH` one (AC-14).

Callers:

- `flow-check.mjs#makeOpenspec(cwd, env, timeoutMs)`: resolves `openspecCli(findRoot(cwd) ?? cwd)`
  once. An `error` makes every call answer `{ refused: <error> }`; for a pinned CLI the first call
  runs `<bin> --version` and a refusal makes that and every later call answer
  `{ refused: <message> }`. `openspecJson` throws `FlowUsageError(r.refused)` before anything
  else; `checkOpenspecVersion` (the `main` preflight) uses `openspecRefusal`, so the version line of
  `flow-check` names where. `missing` keeps today's wording for the `PATH` case
  ("the openspec CLI is not installed or not on PATH").
- `change-loop.mjs`: every `makeOpenspec` call site (`nextAction`, `whereOf`, `openChange`,
  `subagentStopDecision`) inherits it; a refusal becomes `LoopUsageError` through the existing
  paths, so `next` exits 3 with the message in `error` and on stderr.
- `guard.mjs#sessionChange`: `openspec status` runs `openspecCli(root).bin`; on an `error` or a
  refusal (version read with a 15-second `--version` call, only for a pinned CLI) the status text
  is replaced by one line `[devkit] <message>`.
- `plugins/openspec/skills/openspec-setup/scripts/install-schemas.sh`: in the project forms (not
  `--user`), before copying, resolve with
  `node --input-type=module -e '<import guard.mjs from the pack, print bin or the error, check the version>' "$root"`;
  a pinned CLI that is not 2.x, or a declared one not installed, prints the message to stderr and
  exits 1 with nothing replaced. The validation loop uses the resolved `bin`. A `PATH` CLI keeps
  today's behaviour (copy, then best-effort validation), so a machine with a 1.x global and no pin
  behaves as before (AC-14).

The suite's own `openspec` stubs (PATH-based) keep working: test repositories have no
`node_modules/`.

## D-2 The previous script, read from the earliest stage file (defect 2, A-3, AC-2)

`flow-check.mjs#isPreviousScript(files, flow)` (exported): take the artifact stages in the order
`flow.json` lists them; the first one with at least one file decides. The change is on the
previous script when none of that stage's files has a header (`header === null`). No file at all:
current (a change being opened), as today.

Why this rule: every previous script wrote its plan files headerless and in this order (0.13.0
`devkit`: `requirements` first; 0.13.0 `devkit-lite`: `proposal` first); every file that the 0.8.1
agents add with a header (`readiness.md`, `evidence.md`, `reviews/*.md`, `review.md`) comes later
in both `flow.json` files. `change-loop.mjs open` writes `requirements.md` from the template, with
its header, so a change opened on the current script always has a headed earliest file.

It reads the same as today in every case but one: an earliest file without a header and a later
file with one (today current, now previous). A current-script change whose `requirements.md` is
headed and whose `proposal.md` is not stays current and reports `no-header` on the proposal, as
today (scenario "A change opened on the current script").

`computeFlow` and `collectFlow` call it with `flow`; `change-loop.mjs#decide` already ends
`blocked` / `previous-script` for `report.script === 'previous'` (no change there).

## D-3 Archived on the default branch (defect 1, A-2, A-18, AC-1)

New in `change-loop.mjs`: `archivedDates(start, { env, gh })` → a `Map` from each archived change
id to the latest day (`YYYY-MM-DD`) among its archived folders `<date>-<id>`, the union of every
source it can read (an archived folder never leaves the default branch, so a union cannot list a
change that is not archived; an id archived more than once keeps its latest day).
`archivedOnDefault(start, { env, gh })`, exported, is the `Set` of that map's keys. The sources:

1. GitHub: `gh api repos/{owner}/{repo}/contents/openspec/changes/archive?ref=<default>` through
   `makeGh(main, cleanOf(env))` (the `gh` option in tests), the names matching
   `^\d{4}-\d{2}-\d{2}-(.+)$`. A failure is ignored.
2. `git -C <main> ls-tree --name-only refs/remotes/origin/<default>:openspec/changes/archive`.
3. The same on `refs/heads/<default>`.
4. The main checkout's working tree (`openspec/changes/archive/` read with `readdirSync`).

`<default>` is `defaultBase(main)` (origin/HEAD, else `main`, else `master`). `unfinished(start, { env, gh })`
reads the map once and skips an id in it at every rank (archive branch, own branch, any other
checkout), with one exception (A-18): an active folder of an archived id is listed when
`createdAfter(root, id, day)` is true, that is when the `created:` line of that checkout's
`openspec/changes/<id>/.openspec.yaml` (written by `openspec new change`) holds a day strictly
later than the id's latest archived day. Such a folder is a new change that reuses the id, not the
old copy of the archived one. A folder created on the day of the archive or before it, one with no
`created:` line, or one whose `.openspec.yaml` cannot be read (the code reads it as recording no
day) is the old copy and is not listed. No test covers the unreadable file, so the
`change-coordination` delta does not state that case. A
checkout on `chore/archive-<id>` is never under the exception: it is listed only while no archived
folder of `<id>` is on the default branch (its archive PR is not merged). `startMode` passes its
`env` and `gh` through. `knownChange` and resuming by id are unchanged (scenario "Resuming an
archived change by its id"). Nothing removes a worktree.

The comparison is by day because the archived folder's name is the only record of the archive on
the default branch and it carries only a day; the archive commit's time would need one more read
per source and is not in GitHub's contents listing. The known limit: a change reopened under the
same id on the very day of its archive is treated as the old copy and not listed. It reaches only a
hand-made folder: `/devkit change` (`openChange`) already refuses a new change under an id that has
a change folder, active or archived, in any checkout, or a branch of that name, through `nameTaken`
(`name-taken`).

Plan revision: the exception was added in fix commit `fb91e5f` after review round 1
(code-quality-reviewer: 0.16.0 listed a new change that reuses an archived id, and this change hid
it), and stated in this plan and the `change-coordination` delta on 2026-11-21 after review round 2, as
its own requirement "A new change that reuses an archived id is unfinished", which the archived
requirement now names as its exception
(spec-reviewer: the delta said SHALL NOT with no exception), as the owner decided (A-18,
requirements question 9). Proved by `field-fixes 1 archived: a new change that reuses an archived
id, created after the archive, stays listed` (later day, earlier day, same day); the other
`field-fixes 1` tests use active folders whose `.openspec.yaml` has no `created:` line, so they
prove the no-day case.

## D-4 Delivered: its own pull request and every task ticked (defect 4, A-9, AC-6)

**Resolution of A-9's ambiguity: (a).** A task that can only be done after the merge is ticked in a
further pull request of the change, before its archive. (b), ticking it in the archive PR, would put
the retro before the last task is ticked on the default branch, which A-9 forbids; and the archive
PR carries no delivery contract (ADR 0003). The preferred form stays a `## Workflow follow-up`
bullet (`CONTRIBUTING.md`); a checkbox task done after the merge is the case this answers.

New in `deliver-check.mjs` (exported, used by `flow-check.mjs` too):

- `isArchiveHead(name)`: `/^(chore\/)?archive-/.test(name)` (every change's archive head, not only
  this id's).
- `prFiles(gh, number)`: `gh api repos/{owner}/{repo}/pulls/<n>/files --paginate --jq '.[].filename'`
  → `{ files }` or `{ error }` (up to 3000 files; `gh pr view --json files` stops at 100).
- `isOwnPr(id, pr, files)`: not `isArchiveHead(pr.headRefName)`, no file under
  `openspec/changes/archive/`, and some file under `openspec/changes/<id>/`.
- `tasksOnDefault(gh, id, base)`: `readContents(gh, 'openspec/changes/<id>/tasks.md', base)`,
  base64-decoded, `parseTasks` → `{ unticked: [ids] }`, `{ absent: true }` on 404, `{ error }`.
- `deliveryOf(gh, root, id, { ship, branch, env, located, number })` →
  `{ fetched, delivered, merged, left, error }`: `fetched` from `findChangePr`; when it is MERGED
  and the change is not archived locally, `tasksOnDefault` on the repository's default branch
  (`readRepoSettings`, already read after a merge); `delivered = located.archived || (merged && left.length === 0)`.
  `absent` on the default branch counts as not delivered unless archived.

`findChangePr` changes:

- The list path (off the change branch, `pr` and `merge` modes): merged PRs, light fields as
  today, minus every archive head, newest `mergedAt` first; for each, `prFiles`; the first
  `isOwnPr` wins (`via: 'list'`). The body-link rule and the head-name rule are removed: a body or a
  head name is never proof of ownership. A files read that fails is an `error`, never a silent miss
  (as the body read is today).
- The branch path: a PR found by `gh pr view` / `--head` must be `isOwnPr` too. When it is MERGED
  and `tasksOnDefault` leaves tasks, the OPEN PR of the same head is looked up
  (`gh pr list --head <branch> --state open`); none gives `{ none: true, mergedBefore: <n> }`, so the
  delivery asks for a further pull request through the existing `open-pr` row.

`collectState`: `postMerge = ship !== 'plan' && delivered` (was: archived or any merged PR). A
merged, not delivered change goes through the ordinary items. On a checkout that is not the
change's branch, the existing `stop-branch` step's reason becomes
`PR #<n> of <id> merged with tasks left (<ids>); continue on branch <id> and open a further pull request`
with `{ number, tasks }` in its details (no new step name, so `change-loop`'s rows and the panel
need nothing). On the change's branch the ordinary rows apply: `implement` for the unticked
tasks, then `open-pr`.

`flow-check.mjs#collectFlow`: `postMerge` uses `deliveryOf(...).delivered`. `readDelivery`: a
MERGED PR passes only when delivered; otherwise `next('implementation', 'tasks-left-after-merge', { number, tasks })`,
a new reason code with one sentence in each language of `TEXT`
(`pull request #<n> merged with tasks left (<ids>); they go in a further pull request` /
`o pull request #<n> foi mesclado com tarefas pendentes (<ids>); elas vão num novo pull request`).

## D-5 The `devkit-reviews` check follows the change's script (defect 3, A-4 to A-8, AC-3 to AC-5)

**Resolution of A-4's ambiguity: (a).** A devkit script is the schema named `devkit` or
`devkit-lite` (`guard.mjs#DEVKIT_SCHEMAS`), the rule the hooks' opt-in reads. (b) would need the
CI job to read schema files it does not download, and the previous devkit scripts declared neither
evidence nor review, so their changes under way would escape the check. **A-6 kept as assumed**: a
pull request that delivers no change fails.

`deliver-check.mjs` (and so `guard.mjs ci`, which calls `ciMain`):

1. `isDevkitScript(schema)` = `DEVKIT_SCHEMAS.includes(schema)`; the schema is
   `changeSchemaAt(root, dir)` (the change's `.openspec.yaml`, else `openspec/config.yaml`).
2. A single selected change (argument, `DEVKIT_CHANGE`, branch, one touched folder, the only open
   change) on another schema: exit 0, text
   `devkit-reviews: <id> is on the <schema> script, not a devkit script (devkit, devkit-lite); nothing was checked` then `pass`;
   JSON `{ version: 1, mode: 'ci', change, schema, pass: true, note }`.
3. `selectCiChange` with `GITHUB_BASE_REF` and several touched folders returns `{ several: [ids] }`
   instead of throwing. `runCi` sorts each into `judged` (devkit script and at least one ticked task
   in `tasks.md` at HEAD, `parseTasks`), `plan` (devkit script, no ticked task) and `other`.
   - `judged` empty and `plan` not empty: exit 1,
     `fail: this PR delivers no change: <ids> hold only a plan (no ticked task in tasks.md)`.
   - `judged` empty and `plan` empty: exit 0 with one note per change.
   - Otherwise each judged change runs today's single-change check (`checkOne(root, id, facts)`,
     extracted from `runCi` unchanged); the text is
     `devkit-reviews: <n> changes touched by this PR (<ids>)`, each change's block as today, then
     `  note: <id> holds only a plan (no ticked task in tasks.md); not checked` and
     `  note: <id> is on the <schema> script, not a devkit script; nothing was checked`, then `pass`
     or `fail: <id>: <failed items>; ...`. JSON:
     `{ version: 1, mode: 'ci', change: null, changes: [<today's per-change report>], notes: [{ change, why: 'plan-only' | 'other-script', schema }], pass }`.
   The branch-name selection and its `several changes match branch` failure are unchanged (scenario
   "The branch still selects first").
4. `archivePrCheck`: each archived folder's schema from its own `.openspec.yaml`
   (`changeSchemaAt(root, join(root, folder))`); other-script folders become notes and are dropped
   from `noRetro`, `unanswered` and the proposals; with no devkit-script folder left: exit 0 with the
   notes. The unnamed-file check stays on every changed path, as ADR 0003 decides, against the
   devkit folders' approved proposals.
5. The retro messages (both still match the existing test's
   `/retro\.md.*(missing|no "## Proposed updates")/`):
   - missing: `<folder>/retro.md is missing: it holds the change's retro, with a "## Proposed updates" section listing each proposal and the owner's answer to it; the retro step of the archive writes it (/devkit change, or ship-change for a change begun under the previous script, after the change's pull request merges)`;
   - no section: `<folder>/retro.md has no "## Proposed updates" section: it must list each proposal with the owner's answer; the retro step of the archive writes it`.
   `readRetro` already tells `exists` from `readable`.

The comment above `runCi` ("Does not read `ship` or `merge_method`") stays true.

### ADR 0012, proposed with this plan

This changes what ADR 0002 says the check recomputes, ADR 0003's consequence on archive PRs, and
sits next to ADR 0004's sentence that the check does not depend on the opt-in. ADR 0004 also
rejected "Per-change schema as the marker" for the hooks, so the decision needs its own ADR
(`openspec/config.yaml` rules for `design`). Task 4.4 creates
`docs/adr/0012-the-reviews-check-follows-the-change-script.md` with exactly this text; on the owner's
acceptance with the plan, task 4.4 also sets `Status: accepted` and the `Accepted by:` line with the
owner's words from `approval.md`. If the owner refuses it, the plan returns to planning.

```markdown
# ADR 0012: The devkit-reviews check checks only changes on a devkit script

- Status: proposed
- Date: 2026-11-20
- Change: coordinator-field-fixes
- Amends: ADR 0002 (0002-merge-without-the-owner-opt-in.md), the sentence of its Decision on what `devkit-reviews` recomputes; ADR 0003 (0003-auto-merge-the-archive-pr.md), the Negative consequence on archive PRs; ADR 0004 (0004-devkit-per-project.md), the sentence on the CI check
- Accepted by: pending the owner's plan approval of `coordinator-field-fixes`

## Context

ADR 0002 makes `devkit-reviews` (`deliver-check --ci`, also run as `guard.mjs ci`) the check
GitHub merges on: it "recomputes reviews, findings, gates and acceptance proof at the PR head in
CI". ADR 0003 adds that it checks an archive PR against the archived `retro.md` and "fails on a
missing retro". ADR 0004 says the CI check "does not depend on" the project's opt-in. None of the
three says which changes the check applies to: today it applies the devkit delivery contract to
whatever change the branch or the PR diff selects.

When devkit-openspec 0.16.0 was installed in three other projects on 2026-11-20 (the defects are
listed in `openspec/changes/coordinator-field-fixes/requirements.md`, reproduced on scratch
repositories), the required check failed three kinds of pull request that the contract was never
meant for:

- a pull request of a change on another OpenSpec schema (`spec-driven`), every task ticked: it
  fails on reviews, findings and acceptance proof that schema never asks for;
- a pull request that touches the folders of two changes: it fails with `several changes are
  touched by this PR` before checking either;
- the archive pull request of a `spec-driven` change: it fails on a `retro.md` that schema never
  writes.

A required check that fails a pull request no rule of the project asks it to judge blocks the
project's merges (ADR 0002 makes it required on the default branch). In the grill of
`coordinator-field-fixes` (question 1) the owner chose: the pull request of a change outside the
devkit scripts passes with a note, and that is recorded as a decision the owner approves with the
plan.

ADR 0004's alternatives table rejected "Per-change schema as the marker" for turning the hooks on
("projects with their own schema lose their gates; the git rule depends on which change is open").
This ADR uses the change's schema as the marker of what the CI check judges, not of whether the
hooks act; it answers that rejection under Consequences.

## Decision

1. `devkit-reviews` checks a change only when the change is on a devkit script: its own
   `.openspec.yaml` (else the project's `openspec/config.yaml`) names the schema `devkit` or
   `devkit-lite`, the same two names that turn the hooks on (ADR 0004). For a selected change on
   any other schema it checks nothing, prints that the change is not on a devkit script and that
   nothing was checked, and passes.
2. When the pull request touches the folders of several active changes and the branch selects
   none of them, the check judges each touched change on a devkit script that the pull request
   delivers (at least one ticked task in its `tasks.md` at the PR head), prints one result per
   change, and passes only when every one of them passes. A touched change that holds only a plan
   (no ticked task) or is on another schema is printed as a note and fails nothing. A pull request
   that touches devkit-script changes and delivers none of them fails, as a single plan-only change
   fails today.
3. An archive pull request is judged per archived folder by the schema its own `.openspec.yaml`
   names: a folder on another schema is a note; a devkit-script folder is checked as ADR 0003
   says, and a missing `retro.md` still fails, with a message that names the file, what it must
   hold and the step that writes it.
4. Everything else ADR 0002 and ADR 0003 decide is unchanged: the check still recomputes reviews,
   findings, gates and acceptance proof at the PR head for every devkit-script change it judges;
   it still reads neither `ship` nor `merge_method`; it still ignores `DEVKIT_BYPASS`; and it still
   does not depend on the project's opt-in.

## Consequences

- Positive: a project can keep changes on its own schema next to devkit ones without a red
  required check on every such pull request; a pull request that carries the plans of the next
  changes no longer blocks the delivery it ships; the required check fails only where the devkit
  contract applies, so a red `devkit-reviews` again means a devkit gate is open.
- Negative: a project that renames its copy of a devkit schema gets no CI check for the changes on
  the renamed copy (Mitigated: the check prints, on that pull request, that nothing was checked and
  why, so the gap is visible on every such pull request; ADR 0004 already documents that a renamed
  schema turns the hooks off, and the Customizing section of `docs/openspec-flow.md` says the same
  of the check). This is the cost ADR 0004 named when it rejected the per-change schema as the
  hooks' marker; here it is accepted because the alternative is a required check that judges
  changes against rules their schema never set. A change whose `.openspec.yaml` is edited to
  another schema escapes the check (Accepted: the edit is in the pull request's diff, which the
  reviewers read, as ADR 0002 accepts for edits of the workflow itself). A pull request that
  touches several changes is judged on more than one contract at once and is slower to make green
  (Accepted: each result is printed on its own).

### Review trigger

A merge lands a devkit-script change that the check reported as "not on a devkit script", a
project needs the check under a renamed schema, or OpenSpec starts recording a change's schema
somewhere other than its `.openspec.yaml`.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| Keep checking every selected change against the devkit contract | Nothing new | Every pull request of a change on another schema, and every pull request touching two changes, fails the required check; the field projects had to remove the rule | low |
| A devkit script is any schema that declares the evidence and review stages | Follows a renamed copy | Reads schema files the CI job does not download (it fetches three files, `docs/openspec-flow.md` CI section); the previous devkit scripts declared neither stage, so their changes still under way would escape | medium |
| Fail a pull request that touches several changes, as today | One contract per pull request | The plans of later changes cannot ride with a delivery; projects split pull requests by hand to please the check | low |
| Let a plan-only pull request pass | Plans can merge alone | Not asked for by the owner (question 8 of the grill was not answered); kept failing as today, and the owner may correct it at the plan approval | low |
| Make the check read `ship:` and skip `plan` mode projects | Fewer runs | Not asked for; a project in `plan` mode that installs the workflow asks for the proof on purpose | low |
```

Dated Notes (task 4.4), each one paragraph at the top of the ADR's Context, as ADRs 0005 to 0010
already carry:

- ADR 0002: `Note (coordinator-field-fixes, 2026-11-20): ADR 0012 limits what devkit-reviews judges to changes on a devkit script, judges each delivered change of a pull request that touches several, and passes other changes with a note; for every change it judges it still recomputes reviews, findings, gates and acceptance proof at the PR head. The Decision is otherwise unchanged.`
- ADR 0003: `Note (coordinator-field-fixes, 2026-11-20): ADR 0012 judges an archive PR per archived folder by its schema; a devkit-script folder without retro.md still fails, with a message that explains. The archive starts after the change is delivered, its own pull request merged and every task ticked on the default branch (a change may ship over several pull requests). The Decision is unchanged.`
- ADR 0004: `Note (coordinator-field-fixes, 2026-11-20): the CI check still does not depend on the project's opt-in; ADR 0012 makes it judge only changes whose own schema is devkit or devkit-lite. The Decision is unchanged.`

`openspec/config.yaml` `context` gains `0012 the devkit-reviews check follows the change's script, amends 0002, 0003 and 0004` in its ADR line.

## D-6 What `github-setup` names, and which checks it proposes (defect 5, A-10, AC-7, AC-8)

`plugins/openspec/skills/openspec-setup/scripts/github-setup.mjs`, read-only by default as today:

- **Repository checks**, a new `repository` array in the result (JSON additive), printed before
  the items as `<check padded to 14> <state padded to 9> <why>`:
  - `actions`: `gh api repos/{owner}/{repo}/actions/permissions`; `enabled: false` gives `blocked`
    with `GitHub Actions is disabled for this repository: no check runs, devkit-reviews included; enable it in Settings > Actions > General`;
    an unreadable answer gives `unknown` with `cannot read whether GitHub Actions is enabled: <error>`
    (the endpoint needs admin rights); else `ok`.
  - `runs`: `gh api 'repos/{owner}/{repo}/actions/runs?status=completed&per_page=3'`; when at least
    one run is listed and each listed run concluded `failure` and
    `gh api repos/{owner}/{repo}/actions/runs/<id>/jobs` shows no job with a step whose
    `started_at` is set: `blocked` with
    `the newest runs failed without starting (no job ran a step); one possible cause is GitHub Actions billing (a failed payment or a spending limit): check Settings > Billing and plans; the repository's API does not say which`;
    unreadable: `unknown`; else `ok`.
- **Rulesets refused**: in `rulesetItem`, a read that answers `HTTP 403` whose GitHub message names
  an upgrade, a plan or a public repository (`/upgrade|plan|public/i`) gives the item state
  `blocked` with
  `GitHub refuses rulesets for this repository's plan (<GitHub's message, first line>): make the repository public, or move it to a plan with rulesets; merge mode needs the ruleset (ADR 0002), so auto-merge is not applied either`.
  Any other read failure stays `error` (AC-14). With the ruleset `blocked`, the `auto-merge` item
  becomes `deferred` with `the ruleset is refused; merge mode needs it (ADR 0002)`. `--apply`
  already applies only `create`/`update` items, so neither is written; `workflow` and
  `delete-branch` are applied as today.
- **Proposed checks**: `discoverContexts` reads `gh pr list --state all --limit 5 --json number,headRefOid`
  and, for each head, the check-run names (`--paginate`, as today), union, without
  `devkit-reviews`. The header line says
  `the ruleset will require these checks, reported on the newest pull requests (confirm them, or pass --checks): <list>`;
  with no name it says `none: no pull request has a check reported yet; pass --checks`.
  A job that runs only on push to the default branch never reports on a pull request head.
- Exit code: 1 when an item is `error` or `blocked`, or a repository check is `blocked`; else 0.
  The 403 case exits 1 as today, now with the named line.

`openspec-setup/SKILL.md` step 7 says the plan names these states, that billing cannot be read from
the repository's API and is reported only as a possible cause, and that a `blocked` ruleset means
`merge` mode is not available on that plan.

## D-7 The schema upgrade over changes under way (defect 7, A-12, AC-10)

How the state before the upgrade is remembered: in the change's own files, written before the
schemas are replaced. Only one state needs a file: a full-script change whose implementation
started. Its `approval.md` is written as not applying, so OpenSpec (which judges by the file's
existence) does not block `instructions apply`, and `flow-check` reads the stage as settled. The
other two states need no file: `deliver-check` already stops a full-script change with an approved
readiness and no ticked task at `stop-plan-approval` once (`nextStep`, `state.started` false), and
a short-script change begun on the previous script stays on it by D-2 and is never sent to the
grill.

Alternatives rejected: changing the `devkit` schema's `apply.requires` back to `[readiness]` (it
would stop `openspec instructions apply` from asking any new change for the owner's approval, a
behaviour change outside AC-10); installing the previous schema beside the new one under another
name and moving the change to it (the change would leave the devkit scripts, and D-5 would stop
checking it in CI); the setup writing a `requirements.md` for a short-script change (a headed
earliest file would move it to the current script, against D-2).

New script `plugins/openspec/skills/openspec-setup/scripts/changes-under-way.mjs <project-root> [--json] [--apply --owner-answer "<text>"]`:

- Lists every change of `change-loop.mjs#unfinished(start)` (main checkout and worktrees, D-3's
  rule included) whose schema is `devkit` or `devkit-lite`; one on another schema is listed as
  untouched by the upgrade. For each: `id`, `checkout` (root, branch), `script`, `started` (a ticked
  task in `tasks.md`, `parseTasks`), `readiness` (`readValue(..., 'Status')`), `approval`
  (`approval.md` exists), `previous` (`flow-check.mjs#isPreviousScript` over the pack's own
  `flow.json` for that script, read through a new `readFlowFile(path)` export that `readFlow` calls).
- `effect` and `write`, first match:

  | Change | Effect line | Write |
  |---|---|---|
  | `devkit`, started, no `approval.md` | continues where it was; the owner's approval stage did not exist when its implementation began, so `approval.md` is written as not applying | `approval-not-applicable` |
  | `devkit`, readiness APPROVED, not started, no `approval.md` | asks the owner's approval once, before its implementation | none |
  | `devkit-lite`, `previous` | continues where it was; it is not sent back to the grill | none |
  | any other | nothing changes for it | none |

- Text: `<n> changes under way:` then `- <id> (<script>, <checkout path>, branch <branch>): <effect>`,
  or `no change under way`. Read-only without `--apply`.
- `--apply` needs `--owner-answer` (exit 2 without it), writes only the `approval-not-applicable`
  rows, and never overwrites an existing `approval.md`. The file:

  ```markdown
  <!-- devkit-stage approval result=not-applicable attempt=1 commit=<git rev-parse HEAD of that checkout> -->
  # Plan approval: <id>

  - Status: not applicable
  - Date: <YYYY-MM-DD>
  - Why: the implementation of this change had started (tasks ticked in tasks.md) when openspec-setup replaced the devkit schemas, before the script asked for this approval. No approval is recorded here.
  - Owner's words: "<the owner's answer to the listing, up to 200 characters>"
  ```

  `readValue(..., 'Status')` reads `NOT`, never `APPROVED`, so `approvalState.ok` stays false and
  nothing reads it as an approval; `deliver-check` already skips the plan-approval stop for a
  started change. The file is written by the main session's Bash call after the owner's yes, the
  only writer `guard.mjs#writeViolation` allows for `approval.md` (ADR 0011 unchanged).

`openspec-setup/SKILL.md` step 4 becomes: run `changes-under-way.mjs <root>`; with no change under
way, install as today; otherwise show every line and ask the owner one question (upgrade with these
effects, yes or no); on yes run `changes-under-way.mjs <root> --apply --owner-answer "<their words>"`
then `install-schemas.sh <root>`; on no, replace nothing. It also says a worktree gets the new
schemas when its branch takes the default branch.

## D-8 The CompozyOS kit installed by a script with a manifest (defect 8, A-13, AC-11)

How an edit is recognised: a digest recorded at install time. New
`plugins/compozy/skills/compozy-setup/scripts/install-kit.mjs <project-root> [--set __NAME__=value]... [--accept <path>,...] [--json]`:

- Files: `.compozy/config.toml`, `.compozy/README.md`, `.compozy/agents/<role>/AGENT.md` for the
  four roles, `.compozy/loops/openspec-change/loop.yaml` (each from its template with every
  `__NAME__` of `templates/substitutions.json` replaced), `.compozy/bin/devkit-kit` (verbatim, mode
  755).
- Inputs: the manifest's recorded `inputs`, overlaid by `--set`, else each placeholder's default.
- Manifest `.compozy/kit-manifest.json`:
  `{ "version": 1, "pack": "<devkit-compozy version>", "inputs": { "__NAME__": "value", ... }, "files": { "<path under .compozy/>": "sha256:<hex>" } }`.
- Per file, first match: absent → `create` (written); identical to the rendering → `same`; its
  sha256 equals the manifest's → `update` (written); otherwise (no manifest entry, or a different
  digest) → `edited`: not written; its difference from the rendering
  (`git diff --no-index --no-color <installed> <rendering in a temporary file>`) is printed. An
  `edited` path named in `--accept` → `accepted` (written). The manifest records the digest of
  every file written or `same`; an `edited` file keeps its old entry.
- Output: one line per file `<state padded to 9> <path>`, then each difference. Exit 0; 2 on a
  usage error. Writes nothing outside `.compozy/`.

`compozy-setup/SKILL.md`: steps 2 to 6 become one step that runs the script; the re-run section
says that a file the project edited is shown and kept until the owner says yes for that file, one
question per file, and that the first re-run of an install made before the manifest treats every
file that differs from the template as edited. The `design:` block of step 7 stays a prose step.
`docs/compozy-kit.md` says the same.

**The grill sentences (A-13).** Since 0.15.0 both scripts open with the grill, an owner gate
(`flow.json` `requirements`, `owner: true`), and the config rule says "never answer your own grill
questions". The kit tells the unattended planner to "run the grill when the schema has a
`requirements` artifact" and to plan "until the next step is `implement`": in a CompozyOS run that
is a planner answering its own grill. So the template needs the correction. The field project's
own wording is not in this repository; the plan's wording, which the owner compares at approval:

1. `templates/agents/tech-lead/AGENT.md`, step 1: "run the grill when the schema has a
   `requirements` artifact" becomes "write the grill's `requirements.md` with each assumption marked
   `strict-assumed` and return every question as an open question: only the operator answers the
   grill; never answer its questions yourself".
2. `templates/loops/openspec-change/loop.yaml`, the comment above `propose`: "the grill when the
   schema has a `requirements` artifact" becomes "the grill's questions as open questions for the
   operator (both schemas open with the grill)".
3. The same file, the `propose` prompt, after "Follow your procedure: ...": a sentence "Both
   schemas open with the grill: never answer its questions yourself; record each assumption as
   `strict-assumed` in requirements.md and return every question in `open_questions`."
4. The same file, the `review` prompt: "(proposal, design, tasks, readiness)" becomes
   "(requirements and its open questions, proposal, tasks, and design and readiness on the devkit
   schema)".

`.compozy/` of this repository is re-installed with the script (its values: the defaults plus
`__VERIFY_COMMAND__` and `__TIMEZONE__`, as `adoption.test.mjs` states), so it gains the manifest
and the corrected sentences, and `adoption.test.mjs` keeps comparing byte for byte (the manifest is
not a template file and is not compared).

## D-9 Documents, versions and release

- `docs/openspec-flow.md`: the stage-header section (the previous-script sentence: the earliest
  stage file decides); "Adopting it in a project" (the project's pinned CLI wins, a declared pin
  must be installed, OpenSpec 2.x only); "Running a change" and "After the merge: the archive
  steps" (delivered = own PR merged and every task ticked; a further PR for tasks left; the
  `stop-branch` reason); CI (the script rule, several touched changes, the archive notes and the
  retro message; selection rule 3 rewritten; the snippet's pin `v0.16.0` → `v0.17.0`, three
  places); Customizing (a renamed schema also turns the check into a note); Troubleshooting (rows
  for `nothing was checked`, `this PR delivers no change`, `rulesets refused`, `Actions disabled`,
  `the project pins @fission-ai/openspec`); Limits (line 637: "validated against OpenSpec 1.16"
  becomes 2.x, the one contradicting statement of the supported version).
- `plugins/openspec/README.md`: the `flow-check.mjs` row says the project's pinned CLI is used.
- `plugins/openspec/skills/openspec-setup/SKILL.md`: steps 1 (check the project's CLI:
  `node_modules/.bin/openspec` when pinned), 4 (D-7), 6 (validate with the same CLI), 7 (D-6).
- `docs/compozy-kit.md`, `plugins/compozy/skills/compozy-setup/SKILL.md`: D-8.
- `CONTRIBUTING.md` line 68: "The suite needs the `openspec` CLI (major 2) on `PATH`" gains "(this
  repository pins none; a project that pins one has it used instead)".
- `CHANGELOG.md` `## 0.21.0 — field fixes of 0.16.0`: devkit-openspec 0.17.0 and devkit-compozy
  0.2.0 lines, a "Projects" line: bump the pinned `devkit-reviews` workflow to the commit of
  `v0.17.0` to get the CI fix; `install-schemas.sh` refuses a project pin that is not 2.x.
- Versions: devkit-openspec 0.16.0 → 0.17.0 (`plugins/openspec/.claude-plugin/plugin.json`,
  `.claude-plugin/marketplace.json`); devkit-compozy 0.1.1 → 0.2.0 (same two files); marketplace
  `metadata.version` 0.20.1 → 0.21.0; `docs/catalog.md` regenerated
  (`python3 scripts/gen-catalog.py`). devkit-core unchanged. The tag `v0.17.0` is a Workflow
  follow-up after the merge (`CONTRIBUTING.md`).
- `openspec/roadmap.md`: the round 17b line and the numbering sentence are already in the working
  tree from the requirements stage; task 7.1 checks them with `parseRoadmap`; the tick is the
  archive's.

## D-10 Proof: red first, then green (AC-13, AC-1)

Every new test's name starts `field-fixes <defect> ` (for example
`field-fixes 4 delivered: a body link is not the change's own PR`), so a gate selects them with
`--test-name-pattern="^field-fixes"`. New tests of the hooks live in the existing test file of the
module they exercise (`change-loop.test.mjs`, `flow-check.test.mjs`, `deliver-check.test.mjs`,
`guard.test.mjs`), of the setup scripts in `github-setup.test.mjs`, `install-schemas.test.mjs` and a
new `changes-under-way.test.mjs` imported by `guard.test.mjs`, of the kit in a new
`plugins/compozy/skills/compozy-setup/scripts/install-kit.test.mjs` (run directly, as the kit's
other tests are). Every env a new hook test builds blanks `DEVKIT_BYPASS`, `DEVKIT_BRANCH`,
`DEVKIT_CHANGE`, `GITHUB_HEAD_REF`, `GITHUB_BASE_REF` and `GITHUB_EVENT_PATH` through the file's
shared constant (the guard test `no test env blanks DEVKIT_BRANCH without also blanking
GITHUB_HEAD_REF` refuses one that does not).

The first task of each phase writes its tests and runs them on the unchanged code; the failing
output is saved, as the run printed it, to
`openspec/changes/coordinator-field-fixes/proof/red-<phase>.txt` (a check of that task, never a
gate). `pr-verifier` quotes each in `evidence.md` (AC-13). For AC-1 the run of
`node plugins/openspec/hooks/change-loop.mjs start --lang en < /dev/null` in this repository's main
checkout, after phase 2, is saved to `proof/start-this-repo.txt` and quoted the same way.

## D-11 Existing tests this change touches (AC-14)

Each is changed in the task that changes its rule; the invariant it held, the layer that owns it
and its suite:

| Test (file) | Invariant before | After | Layer / suite |
|---|---|---|---|
| `--ci selection 3: with GITHUB_BASE_REF the one active change the PR diff touches is selected, two fail (R-3)` (`deliver-check.test.mjs`) | two touched changes fail | two touched changes are each judged when delivered (its `two` half moves to the new rule; the `one` half is unchanged) | CI selection, `deliver-check.mjs` / `guard.test.mjs` |
| `findChangePr: with no body link the exact last head segment matches; a head that merely contains the id never does (D4)` | a head name is proof | a head name is never proof; the files are | `findChangePr` / same |
| `findChangePr: among several PRs with the evidence link the newest mergedAt wins; a body link beats a head match (D4)` | a body link is proof | among several own PRs the newest `mergedAt` wins; a body link is not proof | same |
| `findChangePr: this repository's history — id auto-merge is PR #5, never the archive PR #6 nor feat/auto-merge-docs ... (D4)` | PR #5 found | unchanged; fixtures gain each PR's files | same |
| `findChangePr: lists light fields only and reads a body one candidate at a time ...` and `... a body that cannot be read is an error ...` | bodies read per candidate | files read per candidate; an unreadable files answer is an error | same |
| `findChangePr: on a branch that names neither the change nor an archive head the merged PR is still found by its body link ...` | found by body | found by its files | same |
| `carry-over: after an immediate merge ...`, `carry-over: pr mode with a MERGED PR leads to the archive steps ...`, `merge mode: a MERGED PR is the first archive step (retro) ...` (`deliver-check.test.mjs`); the post-merge tests of `flow-check.test.mjs` and `change-loop.test.mjs` that reach the retro | a merged PR leads to the retro | unchanged; fixtures answer `tasks.md` on the default branch with every task ticked and the PR's files | delivery / same |
| `plan: contexts come from the default branch check-runs without devkit-reviews; --checks replaces them` and `plan: check runs are read across pages (--paginate) ...` (`github-setup.test.mjs`) | default-branch names | names on the newest PR heads, paginated per head | `github-setup.mjs` / same |
| `AC-9 repo-adopts: ...` (`adoption.test.mjs`) | `.compozy/` equals the rendered templates | unchanged, over the corrected templates; the manifest is not compared | kit / run directly |

No other existing test changes. The CI retro test (`--ci on an archive branch: ... a missing retro
fail the check`) passes unchanged because both new messages keep its pattern.

## Proof map: each criterion, its tasks and where it is proved

| AC | Tasks | Proved by |
|---|---|---|
| AC-1 | 2.1, 2.3, 2.5 | `field-fixes 1` tests (`change-loop.test.mjs`), the reuse rule (A-18) by `field-fixes 1 archived: a new change that reuses an archived id, created after the archive, stays listed`; `proof/start-this-repo.txt` |
| AC-2 | 2.1, 2.2, 2.5 | `field-fixes 2` tests (`flow-check.test.mjs`, `change-loop.test.mjs`) |
| AC-3 | 4.1, 4.2, 4.5 | `field-fixes 3 other-script` tests, through `deliver-check.mjs --ci` and `guard.mjs ci` |
| AC-4 | 4.1, 4.2, 4.5 | `field-fixes 3 several` tests |
| AC-5 | 4.1, 4.3, 4.5 | `field-fixes 3 retro` tests |
| AC-6 | 3.1, 3.2, 3.3, 3.4 | `field-fixes 4` tests (`deliver-check.test.mjs`, `flow-check.test.mjs`) |
| AC-7 | 5.1, 5.2, 5.6 | `field-fixes 5` tests (`github-setup.test.mjs`) |
| AC-8 | 5.1, 5.2, 5.6 | `field-fixes 5 checks` test |
| AC-9 | 1.1, 1.2, 1.3, 1.4 | `field-fixes 6` tests (`guard.test.mjs`, `flow-check.test.mjs`, `change-loop.test.mjs`, `install-schemas.test.mjs`) |
| AC-10 | 5.3, 5.4, 5.5, 5.6 | `field-fixes 7` tests (`changes-under-way.test.mjs`, with the real `openspec` CLI for `instructions apply`) |
| AC-11 | 6.1, 6.2, 6.3, 6.4 | `field-fixes 8` tests (`install-kit.test.mjs`) |
| AC-12 | 7.1 | `field-fixes 12 roadmap` test (`guard.test.mjs`, `parseRoadmap` over the real file) |
| AC-13 | 1.1, 2.1, 3.1, 4.1, 5.1, 5.3, 6.1, 7.4 | `proof/red-*.txt`, quoted in `evidence.md` |
| AC-14 | every phase's gate, 7.5 | D-11's table; the whole suite and the kit's tests green |

## Risks / Trade-offs

- [Reading each candidate PR's files costs one `gh` call per merged PR, up to 100, when the change
  has no own PR] → newest first, stop at the first own PR; the same bound as today's body reads.
- [A rename of `openspec/changes/<id>/` in a PR misreads ownership] → `--jq '.[].filename'` gives
  the new name; an archive move is excluded by the archive-folder rule.
- [The remote-tracking default branch is stale and GitHub cannot be read] → D-3 unions four
  sources; the worst case is today's listing.
- [The earliest-file rule reads a hand-made current change as previous] → only when its earliest
  file is headerless and a later one is headed; `open` writes a headed `requirements.md`; scenario
  pinned.
- [The CI check passes a renamed devkit schema silently] → the note names the schema on every such
  PR; ADR 0012 Consequences; the Customizing section says so.
- [Projects keep the 0.16.0 pin of the workflow and see no fix] → CHANGELOG "Projects" line and the
  CI section say to bump it.
- [`install-schemas.sh` now refuses in a project pinned to 1.x] → the owner's answer (no 1.x); the
  message says what to do; a `PATH` 1.x keeps today's behaviour.
- [A billing failure is guessed] → worded as one possible cause; `SKILL.md` says the API cannot
  say which.
- [The not-applicable `approval.md` is read as a bypass] → written only for a started change, after
  the owner's yes, quoting it, with no `Status: APPROVED`; `deliver-check` already skipped the
  approval stop for a started change.
- [A first re-run of an old kit install asks about every file that differs] → one question per
  file, once; then the manifest exists.
- [Fixture churn in `deliver-check.test.mjs`] → D-11 names every test and its invariant.

## Migration Plan

1. Merge; tag `v0.17.0` on the merge commit (Workflow follow-up).
2. Projects: `claude plugin update devkit-openspec@devkit` (and `devkit-compozy`), then bump the
   pinned commit in `.github/workflows/devkit-reviews.yml` to `v0.17.0`'s. Re-running
   `openspec-setup` lists the changes under way before the schemas move.
3. Rollback: revert the merge; projects keep their pinned workflow commit, so CI goes back with
   their pin; any not-applicable `approval.md` written by the setup stays harmless under 0.16.0
   (`flow-check` reads it as settled; `deliver-check` reads no approval from it).

## Implementation plan

Dependency order: the CLI resolver (every checker starts the CLI) → the stage checker's readings
(previous script, unfinished) → delivery (shared by the checker and CI) → the CI check → the setup
scripts → the kit → documents and release.

**Per surface.**

- devkit-openspec hooks: D-1 (`guard.mjs`, `flow-check.mjs`, `change-loop.mjs`), D-2, D-3, D-4
  (`deliver-check.mjs`, `flow-check.mjs`), D-5.
- devkit-openspec setup skill: D-1 (`install-schemas.sh`), D-6, D-7.
- devkit-compozy: D-8.
- Repository: ADR 0012 and three Notes, `openspec/config.yaml`, docs, `.compozy/`, release files.

**File structure.**

- Create: `plugins/openspec/skills/openspec-setup/scripts/changes-under-way.mjs`,
  `plugins/openspec/skills/openspec-setup/scripts/changes-under-way.test.mjs`,
  `plugins/openspec/skills/openspec-setup/scripts/fixtures/schemas-0.13.0/` (the two schemas of
  `v0.13.0`, for the upgrade tests: CI checks out without tags),
  `plugins/compozy/skills/compozy-setup/scripts/install-kit.mjs`,
  `plugins/compozy/skills/compozy-setup/scripts/install-kit.test.mjs`,
  `docs/adr/0012-the-reviews-check-follows-the-change-script.md`, `.compozy/kit-manifest.json`,
  `openspec/changes/coordinator-field-fixes/proof/*.txt`.
- Modify: `plugins/openspec/hooks/{guard,flow-check,change-loop,deliver-check}.mjs` and their
  `*.test.mjs`; `plugins/openspec/skills/openspec-setup/{SKILL.md,scripts/github-setup.mjs,scripts/github-setup.test.mjs,scripts/install-schemas.sh,scripts/install-schemas.test.mjs}`;
  `plugins/openspec/README.md`; `plugins/compozy/skills/compozy-setup/{SKILL.md,templates/agents/tech-lead/AGENT.md,templates/loops/openspec-change/loop.yaml}`;
  `.compozy/agents/tech-lead/AGENT.md`, `.compozy/loops/openspec-change/loop.yaml`;
  `docs/adr/000{2,3,4}-*.md`; `openspec/config.yaml`; `docs/openspec-flow.md`; `docs/compozy-kit.md`;
  `CONTRIBUTING.md`; `CHANGELOG.md`; `plugins/openspec/.claude-plugin/plugin.json`;
  `plugins/compozy/.claude-plugin/plugin.json`; `.claude-plugin/marketplace.json`; `docs/catalog.md`.
- Delete: none.

**Estimate.** Optimistic 55 h, likely 71 h, pessimistic 95 h.

| Deliverable | Hours | Type | Risk |
|---|---|---|---|
| D-1 resolver and its four callers | 5 | Core | MEDIUM |
| D-1 tests (pin, worktree, declared, 1.x, install-schemas) | 3 | Testing | LOW |
| D-2 earliest-file rule | 1 | Core | LOW |
| D-3 archived on the default branch | 2 | Core | LOW |
| D-2, D-3 tests and the run in this repository | 3 | Testing | LOW |
| D-4 own PR, tasks on the default branch, `deliveryOf` | 6 | Core | HIGH |
| D-4 tests and the D-11 fixture changes | 5 | Testing | HIGH |
| D-5 CI script rule, several changes, archive notes, messages | 6 | Core | MEDIUM |
| D-5 tests | 4 | Testing | MEDIUM |
| ADR 0012 and the three Notes, `config.yaml` line | 1 | Documentation | LOW |
| D-6 github-setup | 5 | Integration | MEDIUM |
| D-6 tests | 4 | Testing | LOW |
| D-7 changes-under-way and SKILL step 4 | 5 | Migration | MEDIUM |
| D-7 tests with the real CLI | 4 | Testing | MEDIUM |
| D-8 install-kit and SKILL | 5 | Core | MEDIUM |
| D-8 tests | 3 | Testing | LOW |
| D-8 grill sentences and this repository's `.compozy/` | 2 | Core | LOW |
| D-9 documents | 4 | Documentation | LOW |
| D-9 versions, CHANGELOG, catalog | 1 | Documentation | LOW |
| Whole suite and proof files | 2 | Testing | LOW |

**Risks** (probability × impact, mitigation):

- The `findChangePr` rewrite breaks a delivery path the suite covers only through fixtures
  (MEDIUM × HIGH) → D-11 lists every affected test; phase 3's gate runs every `deliver-check`,
  `flow-check` and `change-loop` test.
- The `gh` fake of `deliver-check.test.mjs` has no key for `api .../pulls/<n>/files` or
  `contents/.../tasks.md` (HIGH × LOW) → task 3.1 adds the keys to the fake first, with a test
  that an unset key fails loudly (the fake's existing rule).
- Phase gates that run the `^change-loop` and `^flow-check` tests take minutes (HIGH × LOW) →
  accepted, as in round 15; the whole 13-minute suite runs once, in 7.5, in the background.
- The owner refuses ADR 0012 (LOW × HIGH) → the plan returns to planning before any code; phases
  1 to 3 do not depend on it.
- The kit's corrected sentences differ from the field project's (MEDIUM × LOW) → owner compares
  at approval (proposal).

**Assumptions** (where the plan breaks if reality differs):

- OpenSpec 2.0.0 judges `approval.md` done by existence and supports no per-artifact skip but
  `skip_specs` (source: the installed CLI's `instruction-loader.js`, read 2026-11-20). If a later
  2.x adds skips, D-7 could use one instead; the plan does not depend on it.
- `gh api repos/{owner}/{repo}/pulls/<n>/files` lists a squash-merged PR's files (source: GitHub
  REST docs, "List pull requests files", up to 3000 files).
- GitHub's 403 on rulesets for a private repository on the free plan names an upgrade (source:
  `requirements.md`, defect 5 reproduction; the field projects' message).
- Projects install OpenSpec as `@fission-ai/openspec` (source: `docs/openspec-flow.md`,
  `openspec-setup` step 1).
- No project relies on `findChangePr`'s body-link rule for a PR that changes no file of its change
  folder (source: `requirements.md` A-9: "a merged pull request that only ... links its evidence
  is not its own").

**Dependencies.** `change-coordinator` (archived at `9184deb`): `change-loop.mjs`,
`flow-check.mjs`, `deliver-check.mjs`, `conduct-check.mjs#listWorktrees` as of that commit;
OpenSpec CLI 2.x on `PATH` for the suite; `gh` for live runs only; ADR 0012 accepted by the owner
with the plan.

## Decisions cited

- ADR 0002, ADR 0003, ADR 0004: amended by the proposed ADR 0012 (D-5); Notes added.
- ADR 0010 decision 3 (headers and the checker; D-2 keeps the header as the only signal), decision 5
  (where a driver cannot refuse, a GitHub check is the lock; D-5 keeps it for devkit-script changes),
  decision 6 (the owner's plan approval stays a human gate; D-7 records no approval).
- ADR 0011: `approval.md` written only by the main session from the owner's message (D-7 writes the
  not-applicable file only after the owner's yes, quoting it).
- ADR 0009: the CompozyOS kit stays the second driver; D-8 changes its installer and three
  sentences, not its loop.

## Open Questions

None that changes the specs, the approach or the tasks. The three points the owner confirms at the
approval are listed in `proposal.md` (What the owner approves).
