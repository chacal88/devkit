<!-- devkit-stage tasks result=passed attempt=2 commit=6918c0d9f79ec5774fd1d243a544a14d16b87119 -->
# Tasks

Change: `roadmap-coordinator` · Date: 2026-11-21 · Owner: Kaue (chacal88)

Work only in this change's worktree, on its branch. Every rule, table, text and test name is in
`design.md` (D-2 the shape and the probe, D-3 the entry, D-4 the lines, D-5 the run file, D-6 the load,
D-7 `next`, D-8 the board, D-9 `run` and the draft, D-10 the open lock, D-11 the locks, D-12 the
messages, D-13 the skill, D-14 ADR 0013, D-15 the documents, D-16 the release, D-17 the live test,
D-18 the tests this plan changes); the implementer copies them and makes no design choice.

Every gate is one backticked command, run as written: the flow takes the first backticked text after
`Gate:` and runs each `&&` part on its own, so no part holds a `|`, and every gate exits 0 when its
phase is done. Every new test lives in `plugins/openspec/hooks/roadmap-loop.test.mjs` with a name
that starts `roadmap-loop`, except the changed and added `change-loop` tests named below, so a gate
runs them filtered through `plugins/openspec/hooks/guard.test.mjs`, which imports both files. Every
env a new test builds blanks `DEVKIT_BYPASS`, `DEVKIT_BRANCH`, `DEVKIT_CHANGE`, `GITHUB_HEAD_REF`,
`GITHUB_BASE_REF` and `GITHUB_EVENT_PATH` through one shared constant of the file (the test `no test
env blanks DEVKIT_BRANCH without also blanking GITHUB_HEAD_REF` of `guard.test.mjs` refuses a file
that does not), and every gate runs the tests with `GITHUB_HEAD_REF` and `GITHUB_BASE_REF` set, as a
pull-request run on CI does, before the first push. The tests need the `openspec` CLI 2.x on `PATH`.
The whole suite (`node --test plugins/openspec/hooks/guard.test.mjs`, about 13 minutes) runs once, in
gate 5.9, as a background command.

No gate calls `claude` by name: in these sessions the plain command is a shell function that fails.
The marketplace validation is an owner-run task of the conducting session with the desktop app's
bundled Claude Code (`design.md` D-16; it passed on the base `6918c0d` with 2.1.326), and the gate
reads its record.

Test first in every phase: the phase's test task comes before its code task, and its new tests fail
on the base, except the fixture test of task 1.2, which pins the fixtures to the rule that exists
already. An existing test is changed only where `design.md` D-18 names it (T-1 to T-5), and the task
says its invariant, the layer that owns it and its suite; every other existing test runs unchanged.
Leave no backup or scratch file in the tree; end every task with `git status --short`.

| Id | Slug | Tasks |
|---|---|---|
| AC-1 | `starts-what-is-ready` | 1.3, 1.4, 2.1, 2.2, 4.1 |
| AC-2 | `number-set-per-run` | 1.3, 1.4, 2.1, 2.2 |
| AC-3 | `open-changes-fill-the-places` | 1.3, 1.4 |
| AC-4 | `holds-starts-while-loaded` | 1.3, 1.4, 2.1, 2.2, 3.3, 3.4, 4.1 |
| AC-5 | `one-line-per-event` | 1.3, 1.4, 2.1 |
| AC-6 | `status-shows-the-whole-picture` | 1.3, 1.4, 2.1, 2.2, 4.1 |
| AC-7 | `owner-gates-asked-in-a-queue` | 1.3, 1.4, 3.3, 4.1 |
| AC-8 | `stop-at-the-end-of-the-stage` | 1.3, 1.4, 2.1, 2.2 |
| AC-9 | `blocked-change-keeps-its-place` | 1.3, 1.4, 2.1, 2.2 |
| AC-10 | `no-roadmap-offers-a-draft` | 2.1, 2.2, 3.3 |
| AC-11 | `other-changes-left-alone` | 1.2, 1.3, 1.4, 2.1, 2.2 |
| AC-12 | `calling-again-resumes` | 2.1, 2.2, 4.1 |
| AC-13 | `locks-follow-every-change` | 1.1, 3.1, 3.2, 4.1 |
| AC-14 | `no-end-is-lost` | 1.1, 3.1, 3.2, 4.1 |
| AC-15 | `one-task-unchanged` | 1.3, 1.4, 2.1, 2.2, 3.2, 5.9 |
| AC-16 | `design-and-docs-follow` | 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9 |

## 1. The probe and the decision core (AC-1 to AC-9, AC-11, AC-13 to AC-15)

The probe runs first; the core of this phase is pure and does not depend on the shape it settles.

- [x] 1.1 Owner-run task, done by the session that conducts this change (never `tdd-implementer`):
  run the probe of `design.md` D-2 as a background command and write
  `${TMPDIR%/}/devkit-probe-roadmap-coordinator/probe-record.txt` with one line per fact B1 to B7
  (`B<n>: true|false` and what was seen) and the stored forms of the `PreToolUse`, `SubagentStop` and
  `Stop` inputs. When B1, B2 or B3 is false, stop here and report to the owner: nothing is built on
  D-2 until the owner rules. Check: the record file holds seven `B<n>:` lines, and B1 to B3 read true
  before task 3.1 starts.
- [x] 1.2 Create `plugins/openspec/hooks/roadmap-loop.test.mjs` with the shared env constant, and add
  `import './roadmap-loop.test.mjs'; // roadmap-coordinator: the roadmap loop, its commands and its locks`
  to the imports of `plugins/openspec/hooks/guard.test.mjs`. Write in it the fixture helper
  `previousForms(root)` of `design.md` D-4, which commits the change folders P1 to P6, Q1, Q2 and
  `other-work` exactly as D-4's table gives them (built from the rule of
  `plugins/openspec/hooks/flow-check.mjs#isPreviousScript`; no checkout's state is read and no id of
  another project is used), and the test `roadmap-loop lines: the previous-script forms are the ones
  flow-check recognises` (`nextAction` of `plugins/openspec/hooks/change-loop.mjs` on each: the end
  `blocked`, why `previous-script`, for P1 to P6; not for Q1, Q2 and `other-work`). Check: the test
  passes on the base, where `nextAction` exists (it pins the fixtures to the rule; it is the one new
  test that is not red first), and the helper builds all nine folders.
- [x] 1.3 In `plugins/openspec/hooks/roadmap-loop.test.mjs`, write the pure tests: `roadmap-loop lines:`
  one per row C1 to C8 of D-4 (archived read from the archived set only, never from the tick; the
  outside rows for a change not on the roadmap and for a change whose action is the end `blocked`,
  why `previous-script`);
  `roadmap-loop decide:` `starts` (file order, free places, never C3 or an archived change),
  `places` (an owner wait, a GitHub wait, a blocked and a declared change each fill one; a change open
  before the run is resumed first and counts; a lower number starts nothing and hands no stop),
  `load` (at, above, below the limit, none open, `hold` once, `held` cleared on a start), `per change`
  rows N1 to N8, `owner queue` (roadmap order, the head kept while its gate is open, the `ask` names
  its change, the others' stages handed in the same decision), `events` (each event of the D-7 table
  once, in order, none for a stage change or a GitHub wait), `stopping` (no dispatch, waits ignored, E2
  when nothing is in flight), `blocked` (place kept, dependents wait), `end` E1 to E3 (E3 lists each
  need), `after` (`--after` clears in flight and passes the key, so K1 and K2 end blocked);
  `roadmap-loop setting: limitOf` (absent, `80%`, `0`, `1001`, a placeholder give 80; `150` gives
  150); `roadmap-loop status: the board` (the owner's approved board of `requirements.md` rebuilt from
  a fixture in `pt-BR` line by line, the same in `en`, blocks in order and only when filled, the load
  line only while held, ids aligned); `roadmap-loop status: no roadmap` (the unfinished list, and the
  empty case); the rendering tests of D-12: `roadmap-loop replies: a blocked line renders every
  blocked reason in both languages`, `roadmap-loop replies: every owner wait has a gate` and
  `roadmap-loop decide: an end action carries the parameters of its reply` (on fixture P1 of 1.2 and
  the ceiling fixture D-12 names). In the same task, change T-5, `change-loop replies: no internal
  term in either language` in `plugins/openspec/hooks/change-loop.test.mjs` (invariant: every message
  of the one table, each parameter code included, renders in both languages with no internal term, and
  every key is translated but the listed exempt ones; layer: the message table of `change-loop.mjs`,
  `MESSAGES` and `render`; suite: `change-loop.test.mjs`): `SAMPLE` gains `places: 3`, `open: 2`,
  `load: 92`, `limit: 80`, `queue: 5`, `archived: 9`, `word: 'many'`, `after: 'add-csv-import'`,
  `gate: 'approval'`, `phases: 4`; `renderings`' `base` gains `title: STAGE_SAMPLE[lang]`; `renderings`
  picks the `blocked-why.` codes for the keys `blocked`, `roadmap-blocked` and `need.blocked` (written
  out in the test) and the `gate.` codes for a template holding `{gate}`; the refused words gain
  `roadmap-loop` and `load_limit`; `EXEMPT_EQUAL` gains exactly `roadmap-stayed`, `need.owner` and
  `running.stage`; every assertion stays. Check: the new tests fail on the base, where
  `roadmap-loop.mjs` does not exist and an end action has no `params`; T-5 still passes on the base
  (the table has no new key yet), so the replies test is green at every step of the phase.
- [x] 1.4 Create `plugins/openspec/hooks/roadmap-loop.mjs` with the pure part of its layout
  (`design.md`, Implementation plan): `limitOf`, `readLoad`, `parseWord`, `gateOf`, `classifyLines`,
  `decideRoadmap`, `boardOf`, `draftText`. In `plugins/openspec/hooks/change-loop.mjs`: add the message
  keys of D-12 to `MESSAGES` in both languages; add `gate: 'gate.'` to `render`'s `FAMILY` and nothing
  else to it (`queue.`, `outside.`, `need.`, `running.` stay key prefixes that `roadmap-loop.mjs`
  renders by full name); make `render` look `{why}` up in `blocked-why.` for every key of
  `BLOCKED_WHY_KEYS = ['blocked', 'roadmap-blocked', 'need.blocked']` and in `why.` otherwise; add
  `params: { id: ctx.id, ...params }` beside `end` in `decide`'s `finish` (`end` keeps `{ state, why }`);
  export `projectGate` and `scriptAgents` (no behaviour of `/devkit change` changes). Check: the 1.3
  tests and T-5 pass.
- [x] 1.5 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^roadmap-loop" --test-name-pattern="^change-loop replies" --test-name-pattern="^change-loop decide" --test-name-pattern="^change-loop wait" plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py` green; covers AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-11 (decisions and the previous-script forms), and AC-15 for the table, `render` and the end actions.

## 2. The commands, the run file and the open lock (AC-1, AC-2, AC-4 to AC-6, AC-8 to AC-12, AC-15)

- [x] 2.1 Write the command tests: `roadmap-loop start: roadmap and status are routed` (D-3: modes
  `roadmap` and `status` with their text, after the project gate; `verb-unknown`'s new text);
  `roadmap-loop run:` U1 to U5 of D-9 (a word, `0`, `-1`, `1.5` refused with nothing written and no
  marker; the offer with no roadmap; `stop` sets stopping and says where each change stays; the same
  session keeps in-flight entries and changes the number with the `roadmap-places` line; another
  session or `--fresh` starts the file from empty); `roadmap-loop run file:` (its path in the git
  common directory, shared by two worktrees; a missing or broken file reads as an empty run with one
  place; two writers at once both land under the lock); `roadmap-loop next:` (the
  `devkit-roadmap:` first line, the JSON of D-7, the run file's fields written, exit 3 in the
  usage-error form); `roadmap-loop resume:` (killed between `next` and `open`: no change opened twice);
  `roadmap-loop status: nothing written` (the run file, the tree and the branches unchanged);
  `roadmap-loop draft:` (the D-9 content, the previous-script changes named and left out, an existing
  file never overwritten, nothing committed, the `pt-BR` round title); `roadmap-loop wait:` (in flight
  at its start, cleared at its end and on error, the change's action printed); `roadmap-loop hold:`
  (polls with an injected load and sleep, exits below the limit or on stop, `holding` set then cleared);
  `roadmap-loop reply:` (an end key records `declared` and prints `devkit-end: <id> <state>` first; the
  draft-declined key prints the reply alone); `change-loop open: two opens at once` (D-10: two ids in
  two child processes both open; one id twice opens once and refuses the other with nothing left; a
  lock older than ten minutes is taken over); `roadmap-loop next: changes left alone` and
  `roadmap-loop status: changes left alone` (D-4: the roadmap fixture of P1 to P6, Q1 and `after-old`
  over the helper of 1.2, with `other-work` beside it; P1 to P6 class C4 with one `roadmap-skipped`
  line each, no action, no `ask`, no place; Q1 C5 filling one place; `after-old` C8 waiting for
  `old-lone-proposal`; `other-work` no action, no place, no question; the board's `status-outside` rows).
  Change T-1, `change-loop start: S1 a verb of a later round says its round and creates nothing` in
  `plugins/openspec/hooks/change-loop.test.mjs` (invariant: a verb not built yet answers its round and
  creates nothing; layer: `change-loop.mjs start`; suite: `change-loop.test.mjs`): its list keeps
  `project` 19 and `help` 23 only. Change T-4, `change-loop start: S2 no verb or an unknown verb says
  only change exists` (same file; invariant: an unknown verb, or none, answers one sentence naming the
  commands that exist and creates nothing; layer: `change-loop.mjs start`; suite:
  `change-loop.test.mjs`): rename it `change-loop start: S2 no verb or an unknown verb names the
  commands that exist`, and change its pt-BR assertion to
  `/^Por enquanto existem \/devkit change, \/devkit roadmap e \/devkit status/`; its other assertions
  stay. Check: the new tests fail on the base of this phase; T-1 and T-4 fail until 2.2.
- [x] 2.2 Write in `plugins/openspec/hooks/roadmap-loop.mjs` the run file (D-5), `collectRoadmap`,
  `main` and the subcommands `run`, `next`, `status`, `draft`, `wait`, `hold`, `reply`; in
  `plugins/openspec/hooks/change-loop.mjs` the `start` routing and `VERB_ROUND` of D-3, the new
  `verb-unknown` text, and the open lock of D-10 around `openChange`'s body, waiting between tries with
  `sleepSync(ms)` written as `plugins/openspec/hooks/deliver-check.mjs:1401` writes it
  (`Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)`), so `openChange` stays
  synchronous (no busy loop, no `async`); the run file's lock in `roadmap-loop.mjs` waits the same way
  (D-5). Check: the 2.1 tests pass, T-1 and T-4 pass, and every other `change-loop` test passes
  unchanged.
- [x] 2.3 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^roadmap-loop" --test-name-pattern="^change-loop" plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py` green; covers AC-1, AC-2, AC-4, AC-5, AC-6, AC-8, AC-9, AC-10, AC-11 (the changes left alone over the D-4 fixtures), AC-12, and AC-15 for `change-loop.mjs`.

## 3. The locks, the skill and the setting (AC-4, AC-7, AC-10, AC-13 to AC-15)

Starts only when the probe record of task 1.1 shows B1, B2 and B3 true.

- [x] 3.1 Write the lock tests, their transcript and hook-input fixtures in the forms the probe record
  stored (ids replaced): `roadmap-loop lock run:` (`roadmapRunOf`: no run, a typed `/devkit status`
  skipped, another command ends it, `stop` gives a stopping run, the plugin-scoped command, and a
  change run still ended by `/devkit status`); `roadmap-loop lock stop:` RS1 to RS5 of D-11 (one change
  in flight and another ready refused, every change in flight or waiting allowed, a possible start
  refused, a watched hold allowed, an archived change releasing no other, the same key allowed, a lost
  end refused once naming the stage, any error allowed); `roadmap-loop lock agent:` RH0 to RH5 (a
  brief of an open change and a role of its script allowed and recorded in flight, no brief, a change
  not open, a role of the other script, a general-purpose agent, no agent type, a subagent's call, an
  error records nothing); `roadmap-loop lock subagent-stop:` RU1 to RU7 (two planners of two changes,
  the change from the prompt and from the in-flight entry, an unknown change allowed, an allowed stop
  clearing its entry); `roadmap-loop lock edit:` (the session's product edit and shell write refused in
  a roadmap run, a planning file and `approval.md` as today, a subagent as today, no run as today);
  `roadmap-loop lock: no trap` (not opted in, `DEVKIT_BYPASS=1`, an unreadable transcript or run file:
  allowed). Check: they fail on the base of this phase.
- [x] 3.2 Write `roadmapRunOf`, the routing of `lock` and `mainInRun` of D-11 in
  `plugins/openspec/hooks/guard.mjs`; the three roadmap lock decisions in
  `plugins/openspec/hooks/roadmap-loop.mjs`; and in `plugins/openspec/hooks/change-loop.mjs` the
  extraction of `subagentStopFor` and `handOffFor` that `subagentStopDecision` and `agentDecision` call
  (no behaviour change: every `change-loop lock` test passes unchanged). Check: the 3.1 tests and every
  `change-loop lock` test pass.
- [x] 3.3 Write the skill and the setting: `plugins/openspec/skills/devkit/SKILL.md` as D-13 says (the
  frontmatter, the `## Start` modes, `## Roadmap` and `## Status`); the `load_limit` entry of D-6 in
  `plugins/openspec/.claude-plugin/plugin.json`. Change T-2, `change-loop skill: the sections of D-3 to
  D-9 and the modes of start` in `plugins/openspec/hooks/change-loop.test.mjs` (invariant: the skill
  holds its sections in order and names every mode of `start`; layer: the skill's text; suite:
  `change-loop.test.mjs`): the headings gain `## Roadmap` and `## Status` before `## Never` and the
  modes gain `roadmap` and `status`. Add `roadmap-loop skill: every roadmap-loop command carries the
  person's language and the load limit`, `roadmap-loop skill: background hand-offs, one change per
  question, and the message that ends a turn` (D-13 items 2 to 4) and `roadmap-loop setting: the
  load_limit user setting` (type `string`, default `"80"`, a title, the description naming a whole
  number; `language` unchanged). Check: those tests pass.
- [x] 3.4 Owner-run task, done by the session that conducts this change (never `tdd-implementer`),
  after task 3.3's edit of `plugins/openspec/.claude-plugin/plugin.json`: from the worktree's root,
  run the marketplace validation with the desktop app's bundled Claude Code exactly as `design.md`
  D-16 writes it, into `${TMPDIR%/}/devkit-validate-roadmap-coordinator/phase-3.txt` (the binary's
  version, the commit, then the output of its `plugin validate .`). Check: the record holds
  "Validation passed" and the commit of the phase; a failure is fixed in task 3.3 and the run repeated.
- [x] 3.5 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^roadmap-loop" --test-name-pattern="^change-loop" --test-name-pattern="^worktree" --test-name-pattern="^approval.md" --test-name-pattern="^devkit-lite" plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py && grep -q "Validation passed" "${TMPDIR%/}/devkit-validate-roadmap-coordinator/phase-3.txt"` green; covers AC-4 (setting), AC-7 (skill), AC-10 (skill), AC-13, AC-14, and AC-15 for the locks of a change run.

## 4. The live test (AC-1, AC-4, AC-6, AC-7, AC-12, AC-13, AC-14)

Run as soon as phase 3 is committed, before the documents and the review.

- [x] 4.1 Owner-run task, done by the session that conducts this change: commit phase 3, then run the
  live test of `design.md` D-17, turns L0 to L5, as background commands, and write
  `${TMPDIR%/}/devkit-live-roadmap-coordinator/record-<n>.txt` after each turn. A defect the run
  shows is fixed test first in the phase that owns it (a new `roadmap-loop` test, then the fix, then
  that phase's gate again), and the turn is run again; the record says so. Check: the six records exist
  and the hook log holds a roadmap `stop` refusal, `agent` allows for both changes and `subagent-stop`
  allows for at least three stages of each.
- [x] 4.2 Gate: `grep -q '"mode":"stop",.*"decision":"refuse"' "${TMPDIR%/}/devkit-live-roadmap-coordinator/hooks.jsonl" && grep -q '"mode":"subagent-stop",.*"decision":"allow"' "${TMPDIR%/}/devkit-live-roadmap-coordinator/hooks.jsonl" && test -s "${TMPDIR%/}/devkit-live-roadmap-coordinator/record-5.txt"` green; covers the live parts of AC-1, AC-4, AC-6, AC-7, AC-12, AC-13 and AC-14.

## 5. ADR 0013, the documents, the release and the whole suite (AC-15, AC-16)

- [x] 5.1 Write `docs/adr/0013-the-roadmap-coordinator-is-the-owners-session.md` with the text of
  `design.md` D-14, status `proposed`, the date of the day. Check: the file has the headings the
  ADR tests read (`## Context`, `## Decision`, `## Consequences`, `### Review trigger`, `## Alternatives
  considered`).
- [x] 5.2 Only when `approval.md`'s owner's words accept ADR 0013 and the probe record shows B1 to B3
  true: set its status to `accepted` with an `Accepted by:` line in ADR 0011's form, and add `- Amended
  by ADR 0013 (0013-the-roadmap-coordinator-is-the-owners-session.md)` to the headers of
  `docs/adr/0010-openspec-as-the-harness.md` and `docs/adr/0011-the-change-coordinator-is-the-owners-session.md`;
  otherwise stop and report. Check: the three headers read as D-15 says.
- [x] 5.3 Write the dated Notes of D-15 in `docs/adr/0010-openspec-as-the-harness.md` and
  `docs/adr/0011-the-change-coordinator-is-the-owners-session.md`, and the ADR 0013 entry of the `ADRs:`
  line of `openspec/config.yaml`. Check: `ADR 0010 is accepted, supersedes ADR 0001 and ADR 0007, and
  the config names it` (`guard.test.mjs`) passes unchanged.
- [x] 5.4 Update `docs/coordination-design.md` as D-15 says (tense paragraph, sections 1, 2, 4, 10 and
  13, the open point on load out of "Open points" and named among the answered ones). Check:
  `roadmap-loop docs: the documents follow` (written in 5.5) passes for this file.
- [x] 5.5 Update `docs/openspec-flow.md` as D-15 says (the verbs line, the roadmap section, the new
  section "The roadmap coordinator: `/devkit roadmap` and `/devkit status`", Troubleshooting, Limits, the
  CI pin `v0.18.0`). Change T-3, `change-loop docs: the design records the answers` in
  `plugins/openspec/hooks/change-loop.test.mjs` (invariant: the CI snippet pins the current release
  and no earlier one; layer: the documents; suite: `change-loop.test.mjs`): `/v0\.17\.1/` becomes
  `/v0\.18\.0/` and `v0.17.1` is refused. Add `roadmap-loop docs: the documents follow` (the design's
  sections and the absent open point, ADR 0013's headings and status `proposed` or `accepted`, the two
  Notes naming ADR 0013, the config line naming 0013, the flow section's heading, `docs/roles.md`'s
  `## roadmap-coordinator`, both READMEs naming `/devkit roadmap` and `/devkit status`). Check: both
  tests pass.
- [x] 5.6 Update `docs/roles.md`, `plugins/openspec/README.md` and `README.md` as D-15 says. Check:
  `flow-check AC-2: the role document covers every role` and `change-loop lock agent: the accepted
  packs are the ones docs/roles.md names` pass unchanged, and `roadmap-loop docs: the documents
  follow` passes.
- [x] 5.7 Release as D-16 says: `plugins/openspec/.claude-plugin/plugin.json` (0.18.0, the
  description), `.claude-plugin/marketplace.json` (devkit-openspec 0.18.0 with the same description,
  marketplace 0.22.0), `CHANGELOG.md` (`## 0.22.0 — the roadmap coordinator, /devkit roadmap and
  /devkit status`), then `python3 scripts/gen-catalog.py` to regenerate `docs/catalog.md`. Check:
  `python3 scripts/gen-catalog.py --check` passes.
- [ ] 5.8 Owner-run task, done by the session that conducts this change (never `tdd-implementer`),
  after task 5.7: run the marketplace validation as task 3.4 does, into
  `${TMPDIR%/}/devkit-validate-roadmap-coordinator/phase-5.txt`. Check: the record holds "Validation
  passed" and the commit of the release; a failure is fixed in task 5.7 and the run repeated.
- [ ] 5.9 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && grep -q "Validation passed" "${TMPDIR%/}/devkit-validate-roadmap-coordinator/phase-5.txt"` green, the whole suite run once as a background command; covers AC-15 (every existing test of `/devkit change` passes) and AC-16.

## Workflow follow-up

- After the merge, tag `v0.18.0` on the merge commit and push the tag (`CONTRIBUTING.md`).
- Archive with the retro; the archive ticks the round 18 line of `openspec/roadmap.md`.
- Next: the first real `/devkit roadmap` on this repository's roadmap, recorded in the retro of the
  first change it carries: the selection (AC-1), a start held and released under real load (AC-4),
  changes running while the owner answers another one (AC-7), many ends in a row (AC-14); and a run in
  a project that holds many old changes (AC-11).
