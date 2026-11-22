<!-- devkit-stage tasks result=passed attempt=2 commit=2300f84524e5c1ec5ed8a0da41e5a5dccff9cc34 -->
# Tasks

Change: `project-phases` · Date: 2026-11-21 · Owner: Kaue (chacal88)

Work only in this change's worktree, on its branch. Every rule, table, text and test name is in
`design.md` (D-1 the slice, D-2 the schema, D-3 the checker, D-4 the entry, D-5 the commands, D-6
`next`, D-7 the rounds, D-8 the review, D-9 the archive and the pull request, D-10 the readout, D-11 the
slice contract, D-12 the hooks, D-13 the messages, D-14 the skills, D-15 `openspec-setup`, D-16 ADR
0014, D-17 the documents, D-18 the release, D-19 the scripted run and the live checks, D-20 the tests
this plan changes); the implementer copies them and makes no design choice.

Every gate is one backticked command, run as written: the flow takes the first backticked text after
`Gate:` and runs each `&&` part on its own, so no part holds a `|`, and every gate exits 0 when its
phase is done. Every new test of the hook scripts lives in `plugins/openspec/hooks/project-loop.test.mjs`
with a name that starts `project-loop`; the tests of `ship-entry.mjs` live in
`plugins/openspec/skills/openspec-setup/scripts/ship-entry.test.mjs` with names that start `ship-entry`.
`plugins/openspec/hooks/guard.test.mjs` imports both files (two import lines), so a gate runs them
filtered through it. `project-loop.test.mjs` gains its import of `project-loop.mjs` only in task 3.1,
so the gates of phases 1 and 2 load it before that script exists. Every env a new test builds blanks `DEVKIT_BYPASS`, `DEVKIT_BRANCH`,
`DEVKIT_CHANGE`, `GITHUB_HEAD_REF`, `GITHUB_BASE_REF` and `GITHUB_EVENT_PATH` through one shared
constant of its file (the test `no test env blanks DEVKIT_BRANCH without also blanking GITHUB_HEAD_REF`
of `guard.test.mjs` refuses a file that does not), and every gate runs with `GITHUB_HEAD_REF` and
`GITHUB_BASE_REF` set, as a pull-request run on CI does. The tests need the `openspec` CLI 2.x on
`PATH`. The whole suite (`node --test plugins/openspec/hooks/guard.test.mjs`, about 13 minutes) runs
once, in gate 6.8, as a background command.

No gate calls `claude` by name: in these sessions the plain command is a shell function that fails.
The marketplace validation and the live checks are owner-run tasks of the conducting session with the
desktop app's bundled Claude Code, never `tdd-implementer`; their gates read the records.

Test first in every phase: the phase's test task comes before its code task, and its new tests fail on
the base. An existing test is changed only where `design.md` D-20 names it (T-1 to T-8), and the task
says its invariant, the layer that owns it and its suite; every other existing test runs unchanged.
Leave no backup or scratch file in the tree; end every task with `git status --short`.

| Id | Slug | Tasks |
|---|---|---|
| AC-1 | `project-verb-starts-and-resumes` | 3.1, 3.2, 3.3, 4.1, 4.2, 5.1, 5.2, 5.3 |
| AC-2 | `five-stages-readout` | 1.1, 1.2, 1.3, 1.4, 3.1, 3.3, 5.1 |
| AC-3 | `phase-document-per-slice` | 1.1, 1.2, 3.1, 3.3, 4.1, 4.2, 5.1 |
| AC-4 | `phase-not-applicable` | 1.2, 3.1, 3.3, 4.2, 5.1 |
| AC-5 | `roadmap-written-after-approval` | 3.1, 3.3, 4.1, 5.1 |
| AC-6 | `roadmap-not-applicable` | 2.1, 2.2, 3.1, 3.3, 5.1 |
| AC-7 | `one-pr-with-adr-review` | 2.1, 2.2, 3.1, 3.3, 5.1 |
| AC-8 | `flat-design-untouched` | 2.1, 2.2, 4.2, 5.1 |
| AC-9 | `skills-work-alone` | 4.1, 4.2, 5.3 |

## 1. The project schema, the checker and the setup (AC-2, AC-3, AC-4)

- [x] 1.1 Write the failing tests in `plugins/openspec/hooks/project-loop.test.mjs` (new; add its import
  line to `guard.test.mjs`), each named `project-loop schema: ...`: a new slice created with the shipped
  schema has exactly the six artifacts in order and `skip_specs: true` (change-stages ADDED, F1); the
  declaration's ids are `open`, the six, `delivery`, with the review's ceiling 2 and fix stage
  `architecture`; each artifact's `generates` is its stage's file; each of the six templates starts with
  its stage header with `result=pending`; no file of the schema holds `devkit-core:`, `subagent_type`,
  `Agent tool`, `AskUserQuestion`, `Workflow tool` or `Claude`; `docs/roles.md` has a section for every
  role and helper of the declaration; the agents of the shipped roles list exactly their stages'
  skills and only `project-coordinator` (besides `change-coordinator`, `review-bench`, `owner`) has no
  agent file; the two copies are byte-identical; `PROJECT_STAGE_FILES` of `guard.mjs` equals the
  declaration's artifact files; `computeFlow` over an active slice with every stage passed ends blocked
  `undeclared-stage` naming `retro`, and a failing check on its delivery ends blocked naming
  `implementation` and the check; `parseStageHeader` imported from `guard.mjs` and from
  `flow-check.mjs` is the same function. Also the failing `ship-entry` tests in
  `plugins/openspec/skills/openspec-setup/scripts/ship-entry.test.mjs` (new; import line in
  `guard.test.mjs`): a `ship:` block with `devkit: merge` gains `devkit-project: merge` with every
  other byte unchanged, with no `devkit` key gains `devkit-project: plan`, with the key present or no
  block nothing changes, the flow form `ship: { devkit: merge }` gains `, devkit-project: merge` before
  its `}` and `ship: {}` becomes `ship: { devkit-project: plan }`, an entry `parseShip` refuses exits 3
  writing nothing, adding `merge` prints the CI pin line, `--apply` writes and the plain run writes
  nothing (D-15). Check: the new tests fail on the base.
- [x] 1.2 Create `plugins/openspec/schemas/devkit-project/` (`schema.yaml`, `flow.json`, the six
  templates) exactly as `design.md` D-2 says, and its byte-identical copy `openspec/schemas/devkit-project/`;
  move `STAGE_HEADER` and `parseStageHeader` to `plugins/openspec/hooks/guard.mjs` and re-export them
  from `plugins/openspec/hooks/flow-check.mjs`; add `PROJECT_STAGE_FILES` to `guard.mjs`; make `offer`
  in `flow-check.mjs` end blocked `undeclared-stage` with its two `TEXT` sentences (D-3); add
  `project-coordinator` to `NOT_AGENTS` of `plugins/openspec/hooks/change-loop.mjs`; add
  `## project-coordinator` to `docs/roles.md` (what it does, delivers, never does). Check: the schema
  tests of 1.1 pass and `openspec schema validate devkit-project` passes in the repository.
- [x] 1.3 Change the seven `names(... 'schemas')` assertions of
  `plugins/openspec/skills/openspec-setup/scripts/install-schemas.test.mjs` (`:41`, `:49`, `:57`, `:64`,
  `:125`, `:145`, `:154`) to the three schemas (T-7; invariant: the installer copies `devkit`,
  `devkit-lite` and `devkit-project`; layer: the installer; suite: `guard.test.mjs` through
  `install-schemas.test.mjs`), and add to `changes-under-way.test.mjs` a `field-fixes 7 listing` test for
  a slice under way listed as continuing on the new project script with nothing written (project-setup
  MODIFIED). Check: both fail on the base.
- [x] 1.4 Make the installer, the listing and the setup follow (D-15):
  `plugins/openspec/skills/openspec-setup/scripts/install-schemas.sh` (both loops, three names),
  `scripts/changes-under-way.mjs` (the `devkit-project` line), new `scripts/ship-entry.mjs`,
  `SKILL.md` (steps 2, 4, 5 with the CI pin sentence, 6), `templates/config.yaml` (the commented `devkit-project: merge`). Check:
  the tests of 1.1 and 1.3 pass.
- [x] 1.5 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^project-loop schema" --test-name-pattern="^flow-check" --test-name-pattern="install-schemas" --test-name-pattern="field-fixes 7" --test-name-pattern="^ship-entry" --test-name-pattern="instructions-follow" plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py` green; covers AC-2 (the schema and its installation), AC-3 and AC-4 (the records and their templates).

## 2. The slice contract in CI and in the pull request hook (AC-6, AC-7, AC-8)

- [x] 2.1 Write the failing tests, each named `project-loop ci: ...` or `project-loop hook: ...`, over a
  scratch repository with a base commit and a slice branch holding an archived `devkit-project` folder
  (D-11): a complete slice passes from `deliver-check.mjs --ci` and from `guard.mjs ci` with
  `GITHUB_BASE_REF`, `GITHUB_HEAD_REF` and an event file, printing that it passed the slice contract;
  one test per failure, each named in the output: a record missing, a record with another stage's
  header, a phase record `pending`, `review.md` not `passed`, no verdict file, a rejected first
  `Verdict:` line, no `Commit:`, a commit that is not an ancestor, a later commit touching
  `docs/design/<slice>/`, `docs/adr/` or `docs/decisions/` (one test each), a file outside the allowed
  paths (`src/app.ts`, and a flat `docs/design/1-business-vision.md`), an existing roadmap line
  rewritten, `openspec/roadmap.md` touched while `roadmap.md` is not applicable; and the negatives: a
  merge of a base with an unrelated product commit keeps the review current, rounds appended after the
  base's bytes pass, a roadmap absent at the base passes; a selected active `devkit-project` change fails
  with the reviews-check message; a slice touched among several changes is a note; a `spec-driven`
  archived folder is still a note; `gh pr create` in the slice's checkout with another change active is
  not refused when the contract holds and is refused naming `review.md` when it is missing; the session
  writing an archived `reviews/adr-reviewer.md` is refused with and without an active change, and the
  `adr-reviewer` agent writing it is not. Add the `project-loop locks: ...` tests of coordination-locks
  ADDED (D-12): a transcript whose newest typed command is `/devkit project billing`, after a change run
  and after a roadmap run, gives no run to `runOf` and `roadmapRunOf`; the stop, hand-off and edit hooks
  refuse nothing there; the session writing `docs/design/billing/1-business-vision.md` in the slice's
  checkout is not refused. These pin today's behaviour and pass on the base; every other new test of this
  task fails on the base.
- [x] 2.2 Implement D-8's `sliceReviewStale` and D-11's `sliceProblems`, the archived verdict files in
  `classify` and their early check in `guardEdit` and `guardBash`, and the slice branch of the
  `gh pr create` loop, in `plugins/openspec/hooks/guard.mjs`; the three-way split of `archivePrCheck`, the
  slice output and the selected active slice in `runCi` of `plugins/openspec/hooks/deliver-check.mjs`.
  Check: the tests of 2.1 pass and every `field-fixes 3 reviews-check` test passes unchanged.
- [x] 2.3 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^project-loop" --test-name-pattern="reviews-check" --test-name-pattern="^flow-check" plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py` green; covers AC-6 and AC-8 (the CI rules), AC-7 (the contract and the hook).

## 3. The loop and the entry (AC-1 to AC-7)

- [x] 3.1 Write the failing tests, each named `project-loop start: ...`, `project-loop next: ...`,
  `project-loop rounds: ...`, `project-loop review: ...`, `project-loop archive: ...`,
  `project-loop status: ...` or `project-loop wait: ...`: the nine start steps of D-5, one test each, the
  new slice's worktree, branch and change, and a failed open leaving nothing; `unfinishedSlices` with an
  active slice and one archived on its branch; one test per row S1 to S26 of D-6 with a faked `gh`, and
  the progress guard (no progress, not delivered); in the `phase` (S4, S5) and `rounds` (S6) tests,
  `next` runs from the main checkout and the test asserts that every path of `detail` is absolute and
  starts with the action's `root`, the slice's worktree (D-6, "Where the session writes"); `rounds` with each refusal of D-7, the check writing
  nothing, `--write` refused while `pending`, the append keeping every old byte, the file created when
  absent, and a second `--write` writing nothing; `record-review` for approved, declined and rejected
  verdicts and its two refusals; `archive` refused with a stage unsettled and done with every stage
  settled; `status` with the four words and the line after the five stages; `wait` ending when the
  decision changes; every new message key rendered in both languages with no internal term. Change the
  existing tests T-1 (`change-loop.test.mjs:886`; invariant: only `help` is a later round; layer: the
  entry of `change-loop.mjs`; suite: `guard.test.mjs` through `change-loop.test.mjs`), T-2 (`:901`;
  invariant: the reply names the four commands; layer: the message table; same suite) and T-4
  (`roadmap-loop.test.mjs:797-799`; invariant: `help` keeps round 23, `project` leaves the not-built
  row, the patterns follow the new text; layer: the entry; suite: `guard.test.mjs` through
  `roadmap-loop.test.mjs`), and add `change-loop start` tests for `project` reaching the project gate,
  `is-slice`, and `unfinished` leaving a slice out (`/devkit change <text>` asks nothing about it;
  `roadmap-loop.mjs status` shows no row for it). Check: the new and changed tests fail on the base.
- [x] 3.2 Split `openUnderLock` of `plugins/openspec/hooks/change-loop.mjs` into the exported
  `openCheckout` and `openChange`'s `prepare` (D-5), route `project` in `startMode`, set `VERB_ROUND` to
  `{ help: 23 }`, add `is-slice` and the `unfinished` filter (D-4), and add every message key of D-13 in
  both languages. Check: the `change-loop` tests pass, the open tests among them unchanged.
- [x] 3.3 Write `plugins/openspec/hooks/project-loop.mjs` with the commands of D-5, `startProject`,
  `unfinishedSlices`, `nextSlice` and `decideSlice` (D-6), `rounds` (D-7), `record-review` (D-8),
  `archive` and `wait` (D-9), `status` (D-10), `main` and `isMain` as in `change-loop.mjs`. Check: every
  `project-loop` test of 3.1 passes.
- [x] 3.4 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^project-loop" --test-name-pattern="^change-loop" --test-name-pattern="^roadmap-loop" plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py` green; covers AC-1 (start, open, resume), AC-2 (the readout), AC-3 and AC-4 (the phase rows), AC-5 and AC-6 (the rounds), AC-7 (review, archive, pull request rows).

## 4. The skills (AC-1, AC-3, AC-4, AC-5, AC-8, AC-9)

- [x] 4.1 Write the failing tests: `project-loop skill: ...` for the `## Project` section of
  `plugins/openspec/skills/devkit/SKILL.md` (every `project-loop.mjs` call carries
  `--lang ${user_config.language}`, the start reads the words through the quoted heredoc, the action
  kinds `phase`, `rounds`, `agent`, `session` and `end` are each carried, the end names `/devkit roadmap`
  and the section says never to start it, the `## Never` items of D-14); `project-loop design skills:
  ...` for each of the five `plugins/design/skills/*/SKILL.md` (it asks for the slice first when called
  by name, names `docs/design/<slice>/` as its output, names no top-level `docs/design/<n>-` output and
  no top-level `docs/design/STATE.md`, says it writes nothing to `openspec/roadmap.md` and opens no pull
  request alone, reads a flat `docs/design/` as context only, and has a description that says when to
  use it), and the `STATE.md` template's ADR link. Change T-3 (`change-loop.test.mjs:2370`; invariant:
  the headings gain `## Project` before `## Never`, the modes gain `project` and `is-slice`; layer: the
  skill text; suite: `guard.test.mjs` through `change-loop.test.mjs`) and T-6
  (`roadmap-loop.test.mjs:1812`; invariant: the exact `argument-hint` gains `| project [<name>]`; layer:
  the skill text; suite: `guard.test.mjs` through `roadmap-loop.test.mjs`). Check: they fail on the base.
- [x] 4.2 Write the skill texts of D-14: `plugins/openspec/skills/devkit/SKILL.md` (frontmatter,
  `## Start`, `## Project`, `## Never`); the five `plugins/design/skills/*/SKILL.md`;
  `plugins/design/skills/design-business-discovery/templates/STATE.md`; `plugins/design/README.md`;
  regenerate the catalog blocks with `python3 scripts/gen-catalog.py`. Check: the tests of 4.1 pass.
- [x] 4.3 Owner-run task, done by the session that conducts this change (never `tdd-implementer`): run
  the marketplace validation with the desktop app's bundled Claude Code
  (`"$(for c in "$HOME/Library/Application Support/Claude/claude-code/"*/*/claude.app/Contents/MacOS/claude; do :; done; echo "$c")" plugin validate .`)
  and save its output to `${TMPDIR%/}/devkit-validate-project-phases/phase-4.txt`. Check: the file
  holds `Validation passed`.
- [x] 4.4 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^project-loop" --test-name-pattern="^change-loop skill" --test-name-pattern="^roadmap-loop skill" plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && grep -q "Validation passed" "${TMPDIR%/}/devkit-validate-project-phases/phase-4.txt"` green; covers AC-1, AC-3, AC-4, AC-5 (the skill), AC-8 (context only), AC-9 (the skills' text).

## 5. The scripted run and the live checks (AC-1 to AC-9)

- [x] 5.1 Write the two scripted tests of `design.md` D-19 in `plugins/openspec/hooks/project-loop.test.mjs`,
  `project-loop scripted: a slice from its name to the merge` (steps 1 to 9, with the session report
  `guard.mjs session` on the checkout with an open slice exiting 0) and `project-loop scripted: a slice
  whose roadmap does not apply`, each writing its transcript to `DEVKIT_PROOF_OUT` when set; run them
  with `DEVKIT_PROOF_OUT` set to `openspec/changes/project-phases/proof/scripted-run.txt` and
  `openspec/changes/project-phases/proof/scripted-run-no-rounds.txt`. Check: both pass and both
  transcripts exist.
- [x] 5.2 Owner-run task, done by the session that conducts this change (never `tdd-implementer`): live
  check L1 of D-19 in a scratch project outside this repository, with the bundled Claude Code and
  `--plugin-dir` for `plugins/openspec` and `plugins/design`; save both replies and `git worktree list`
  to `openspec/changes/project-phases/proof/live-l1.txt`, or the reason it could not run. Check: the
  file exists and is not empty.
- [x] 5.3 Owner-run task, as 5.2: live check L2 of D-19; save the first reply and `git status --short`
  to `openspec/changes/project-phases/proof/live-l2.txt`, or the reason it could not run. Check: the
  file exists and is not empty.
- [x] 5.4 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^project-loop scripted" plugins/openspec/hooks/guard.test.mjs && test -s openspec/changes/project-phases/proof/scripted-run.txt && test -s openspec/changes/project-phases/proof/scripted-run-no-rounds.txt && test -s openspec/changes/project-phases/proof/live-l1.txt && test -s openspec/changes/project-phases/proof/live-l2.txt` green; covers AC-1 to AC-9 end to end, with the limits of the proof map.

## 6. ADR 0014, the documents, the release and the whole suite (AC-2, AC-7, AC-9)

- [x] 6.1 Write `docs/adr/0015-a-project-slice-is-a-change-delivered-in-one-pull-request.md` with the
  text of `design.md` D-16, status `proposed`. Check: the file has `## Context`, `## Decision`,
  `## Consequences`, `### Review trigger` and `## Alternatives considered`.
- [x] 6.2 Only when `approval.md`'s owner's words accept ADR 0014: set its status to `accepted` with
  `- Accepted by: ` quoting `approval.md`, and add `- Amended by ADR 0014
  (0015-a-project-slice-is-a-change-delivered-in-one-pull-request.md)` to the headers of
  `docs/adr/0010-openspec-as-the-harness.md` and `docs/adr/0012-the-reviews-check-follows-the-change-script.md`;
  in every case add the two dated Notes of D-16 to those two ADRs. Check: `grep -c "project-phases"` on
  each ADR is at least 1.
- [x] 6.3 Write the failing test `project-loop docs: the documents follow`: section 7 of
  `docs/coordination-design.md` says built in round 19 and lists the nine answers, the tense paragraph
  names `/devkit project`, section 1's table says `19 (built)`; ADR 0014 has its headings and status
  `proposed` or `accepted`; the two Notes link ADR 0014; the `ADRs:` line of `openspec/config.yaml` names
  0014 and its `ship:` names `devkit-project: merge`; `docs/openspec-flow.md` has the two new sections;
  `docs/roles.md` has `## project-coordinator`; both READMEs name `/devkit project`; the `## 0.23.0`
  entry of `CHANGELOG.md` says to move the CI pin before `ship: devkit-project: merge`. Change T-5
  (`roadmap-loop.test.mjs:1890`; invariant: section 13's sentence follows its corrected text of D-17;
  layer: the documents; suite: `guard.test.mjs` through `roadmap-loop.test.mjs`) and T-8
  (`change-loop docs: the design records the answers`, `change-loop.test.mjs:2473-2476`; invariant: the
  CI snippet of `docs/openspec-flow.md` pins the current release, now `v0.19.0`, and `v0.18.1` joins the
  pins that must be gone; layer: the documents; suite: `guard.test.mjs` through `change-loop.test.mjs`).
  Check: the new test and both changed tests fail on the base.
- [x] 6.4 Write the documents of D-17: `docs/coordination-design.md`, `docs/openspec-flow.md`,
  `README.md`, `plugins/openspec/README.md`, `openspec/config.yaml`. Check: T-5 passes, and the
  `project-loop docs` test fails only on its CHANGELOG assertion (T-8 and that assertion pass after
  6.5, which writes the pin and the entry).
- [x] 6.5 Bump the versions of D-18 in `plugins/openspec/.claude-plugin/plugin.json`,
  `plugins/design/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`, add the `## 0.23.0`
  entry to `CHANGELOG.md` (with the CI pin sentence of D-18), move the CI pin of
  `docs/openspec-flow.md` to `v0.19.0`, and regenerate `docs/catalog.md` with
  `python3 scripts/gen-catalog.py`. Check: `python3 scripts/check.py`, the `deliver-check` pin test, T-8
  and the `project-loop docs` test pass.
- [x] 6.6 Run `openspec validate project-phases --strict`. Check: it passes.
- [x] 6.7 Owner-run task, as 4.3: the marketplace validation saved to
  `${TMPDIR%/}/devkit-validate-project-phases/phase-6.txt`. Check: the file holds `Validation passed`.
- [x] 6.8 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && grep -q "Validation passed" "${TMPDIR%/}/devkit-validate-project-phases/phase-6.txt"` green, the whole suite run once as a background command; covers AC-2, AC-7 and AC-9 for the documents and the release, and every existing test of `/devkit change` and `/devkit roadmap`.

## Workflow follow-up

- After the merge, push the lightweight tag `v0.19.0` on the merge commit (`CONTRIBUTING.md`), since
  `openspec-setup` pins projects' CI and schemas to it.
- Archive the change with its retro after the project's review requirements are met, and tick round 19
  of `openspec/roadmap.md`.
- Record in the retro, as the follow-up of a next change, the dogfood: the first real slice in one of
  the owner's projects (the conversations' quality, the real GitHub auto-merge).
