<!-- devkit-stage tasks result=passed attempt=1 commit=c56155334749cdc46bad077ba8f53c4bbec5d140 -->
# Tasks

Change: `jira-entry` · Date: 2026-11-22 · Owner: Kaue (chacal88)

Work only in this change's worktree, on its branch. `design.md` gives every rule, message, function,
file and test name: D-1 the module `jira-task.mjs`, D-2 the `task` mode of `start`, D-3 the session's
read of the task, D-4 `open --task`, D-5 the grill, D-6 the `task` and `writeBack` fields of `next`,
D-7 `write-back` and its record, D-8 the messages, D-9 the module header and usage, D-10 the
documents, the ADR Note, the roadmap line and the release, and D-11 the tests. The implementer copies
them and makes no design choice.

Every gate is one backticked command, run as written. The flow takes the first backticked text after
`Gate:` and runs each `&&` part on its own, so no part holds a `|`. Every new test's name starts
`jira-entry AC-<n> ` or `jira-entry docs:` (D-11). Every new hook test takes its env from the file's
existing fixtures (`cleanEnv`, `SET`, the `env` that `deliveredChange` returns), which blank
`DEVKIT_BYPASS`, `DEVKIT_BRANCH`, `DEVKIT_CHANGE`, `GITHUB_HEAD_REF`, `GITHUB_BASE_REF` and
`GITHUB_EVENT_PATH`. Every hook gate runs with `GITHUB_HEAD_REF` and `GITHUB_BASE_REF` set, as a
pull-request run on CI does, and with `TMPDIR=/var/tmp`. Every Jira task, transition list and
connector answer in a test is a fake JSON object: no test calls a real Jira (AC-9). The tests need
the `openspec` CLI 2.x on `PATH`. The whole suite (`node --test plugins/openspec/hooks/guard.test.mjs`,
13 to 21 minutes) runs once, in 4.6, as a background command of the tool. The marketplace check is
written `command claude plugin validate .`, so that a shell function named `claude` is skipped.

Test first in every task: write its tests, see them fail on the code before the task, then make them
pass. An existing test changes only where `design.md` D-11 names it, in the task that changes its
rule, with its invariant named in the commit message. Leave no backup or scratch file in the tree, and
end every task with `git status --short`.

| Id | Slug | Tasks |
|---|---|---|
| AC-1 | `key-opens-from-task` | 1.1, 2.2, 2.3, 4.1 |
| AC-2 | `link-same-as-key` | 1.1, 2.2, 4.1 |
| AC-3 | `no-connector-asks-text` | 1.1, 2.1, 2.3, 4.1 |
| AC-4 | `grill-skips-answered` | 3.1, 4.1, 4.2 |
| AC-5 | `key-resumes` | 1.1, 2.2, 2.3 |
| AC-6 | `write-back-asks-once` | 1.1, 3.1, 3.2, 4.1 |
| AC-7 | `write-back-only-on-yes` | 1.1, 3.3, 4.1 |
| AC-8 | `free-text-unchanged` | 1.1, 2.2, 2.3 |
| AC-9 | `fakes-only` | 1.2, 4.6 |
| AC-10 | `live-proof-followup` | 4.4 |

## 1. The task module (AC-1 to AC-3, AC-5 to AC-9)

- [x] 1.1 Create `plugins/openspec/hooks/jira-task.mjs` with every export of D-1 (`TASK_KEY`,
  `parseTaskRef`, `taskIdPrefix`, `taskFromJson`, `quoteLines`, `taskRequest`, `recordedTask`,
  `commentText`, `writeBackInput`, `writeBackChoices`) and its own header comment. Create
  `plugins/openspec/hooks/jira-task.test.mjs` with the pure tests of D-11, one or more per D-1 rule,
  each named `jira-entry AC-<n> ...`, every decision for broken input of D-1 included:
  - `parseTaskRef` reads a key typed alone (AC-1);
  - it reads a browse link and a board link, and the path wins (AC-2);
  - it leaves free text, a lower-case word, a key with more words, a link with no key, a blank text
    and a link `new URL` refuses (AC-8);
  - `taskIdPrefix` handles `PROJ-482` and `MY_APP-7` (AC-1);
  - `taskFromJson` keeps the five fields only, and refuses empty, cut-short, non-object, other-key,
    untitled and wrongly typed input (AC-1, AC-3);
  - `taskRequest` writes the key line and quotes each part, leaves out an empty description and an
    absent field, and quotes a description line starting `## ` or `Jira: OTHER-1` (AC-1);
  - `recordedTask` reads the first line of the section, and returns `null` for an empty file, no
    section, an empty section, a quoted key line, a key line that is not first, and a section that
    runs to the end of the file with no key (AC-5);
  - `commentText` handles `en`, `pt-BR` and another tag (AC-7);
  - `writeBackInput` and `writeBackChoices` handle valid input, repeated ids and malformed input (AC-6).

  Add `import './jira-task.test.mjs'; // jira-entry: the Jira key, the task and the write-back` to
  `plugins/openspec/hooks/guard.test.mjs`, right after its `change-loop.test.mjs` import. Check:
  `env TMPDIR=/var/tmp node --test plugins/openspec/hooks/jira-task.test.mjs` passes. Before the
  module exists, the same command fails.
- [x] 1.2 Add the AC-9 source test of D-11 to `plugins/openspec/hooks/jira-task.test.mjs`
  (`jira-entry AC-9 jira-task.mjs and change-loop.mjs open no network connection`). It reads both
  sources and refuses an import of `node:http`, `node:https`, `node:net`, `node:tls`, `node:dgram`
  or `undici`, and any `fetch(`. Check: it passes. Pointing it at a scratch string that holds
  `fetch(` makes its assertion fail (shown in the test itself with `assert.throws` on the helper).
- [x] 1.3 Gate: `env TMPDIR=/var/tmp node --test plugins/openspec/hooks/jira-task.test.mjs && python3 scripts/check.py` green; covers the pure parts of AC-1, AC-2, AC-3, AC-5, AC-6, AC-7, AC-8 and AC-9.

## 2. The entry: start and open (AC-1, AC-2, AC-3, AC-5, AC-8)

- [x] 2.1 Add the fourteen keys of D-8 to `MESSAGES.en` and `MESSAGES['pt-BR']` in
  `plugins/openspec/hooks/change-loop.mjs`. In the same task, add `key`, `name` and `choices` to
  `SAMPLE` in `plugins/openspec/hooks/change-loop.test.mjs` (D-8), naming its invariant in the
  commit message. Write `jira-entry AC-3 the replies for no connector and an unreadable task name the
  key, ask for text and hold no internal term, in both languages` (spec `jira-tasks`: "A task that
  cannot be read opens nothing"). It renders `task-no-connector` and `task-unreadable` through
  `main(['reply', ...])` and checks that they name `PROJ-482`, name `/devkit change`, print no
  `devkit-end:` line, and differ between `en` and `pt-BR`. Check: that test and "change-loop
  replies: no internal term in either language" pass.
- [x] 2.2 Add the `task` field and the `task` mode to `startMode` (D-2), importing `parseTaskRef`,
  `taskIdPrefix` and `recordedTask` from `./jira-task.mjs`. Write these tests (spec `jira-tasks`: "A
  Jira key or link typed alone is read as a task" and "The key resumes its unfinished change", every
  scenario that names `start`):
  - `jira-entry AC-1 start answers task for a key in a project with no unfinished change, and creates
    nothing`: `mode` is `task`, `task` is `{ key: 'PROJ-482', link: null, idPrefix: 'proj-482' }`,
    and `snapshot` is unchanged;
  - `jira-entry AC-2 start answers the same task for a browse link and a board link`;
  - `jira-entry AC-5 start resumes the unfinished change that records the key, for the key and for
    its link`: an `addChange` change whose committed `requirements.md` starts its request section
    with `Jira: PROJ-482 <link>`;
  - `jira-entry AC-5 start asks about other unfinished changes before a task, and carries the task`;
  - `jira-entry AC-5 a key whose only change is archived reads as a new task`;
  - `jira-entry AC-8 start answers free text, a lower-case key, a change id and no text as before,
    with task null`.

  Check: those tests pass, and every existing `change-loop start:` test passes unchanged.
- [x] 2.3 Add `--task <KEY>` to `openChange` and `runOpen`, pass `gh` from `main` to `runOpen`, split
  `requirementsFor` into `withRequest` plus `quoteLines`, and add the task-taken refusal and the
  `opened-task` reply (D-4). Update `USAGE` and the module header for `open --task` (D-9). Write
  these tests (spec `jira-tasks`: "A change opened from a task records the task", every scenario,
  and "The key resumes its unfinished change": "A second opening for the same key"):
  - `jira-entry AC-1 open --task writes the key line and the three quoted parts under Request, and
    nothing else of the task`: the fake JSON also carries `comments`, `subtasks` and `issuelinks`,
    and `requirements.md` holds none of their text;
  - `jira-entry AC-1 open --task without an acceptance-criteria field writes the key line, the title
    and the description`;
  - `jira-entry AC-1 open --task refuses an id that does not start with the key, and creates
    nothing`;
  - `jira-entry AC-3 open --task refuses a task answer it cannot read, and creates nothing`: empty,
    cut-short JSON, another key, no title;
  - `jira-entry AC-5 open --task refuses a second change for a key whose change is unfinished`:
    exit 3, reply `task-taken` naming the first change;
  - `jira-entry AC-8 open without --task writes the request byte for byte as before`: it compares
    with the quoted form the existing O-tests expect.

  Check: those tests pass, and every existing `change-loop open:` test passes unchanged.
- [x] 2.4 Gate: `env TMPDIR=/var/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/jira-task.test.mjs && python3 scripts/check.py` green; covers AC-1, AC-2, AC-3, AC-5 and AC-8.

## 3. The write-back (AC-4, AC-6, AC-7)

- [x] 3.1 In `nextAction` add the `task` and `writeBack` fields, with `writeBackFile` and
  `readWriteBack` (D-6, D-7, the record), keeping the delivery report's `pr` as `deliveredPr`. Give
  `deliveredChange` in `plugins/openspec/hooks/change-loop.test.mjs` its optional `requirements`
  parameter (D-11). Write these tests (spec `jira-tasks`: "The grill asks only what the task leaves
  open": "The grill knows the task"; "The write-back question is asked once when the pull request
  opens": "The pull request opens", "Asked once", "The delivery goes on", "Not on the archive pull
  request"):
  - `jira-entry AC-4 next hands the grill of a task change with the task's key and link`;
  - `jira-entry AC-6 next carries writeBack once the pull request exists, for a change that records a
    task`: number 12, the `prJson` link;
  - `jira-entry AC-6 next carries no writeBack after the question was asked, for a change with no
    task, for a corrupt record, and on the archive branch`;
  - `jira-entry AC-6 a pending question changes no decision`: the same `kind`, `end`, `step`, `agent`
    and `reply` with and without a task, and the same `wait` result through the fake gh.

  Check: those tests pass, and every existing `change-loop next:` and `change-loop wait:` test passes
  unchanged.
- [x] 3.2 Add `write-back ask` (D-7), its standard input in `isMain`, and `USAGE` and the header
  (D-9). Write these tests (spec `jira-tasks`: "The choices", "No transition can be read", "Asked
  once"):
  - `jira-entry AC-6 write-back ask lists the transitions, only comment and no, records the question,
    and answers ask false the second time`: transitions "In Review" and "Done";
  - `jira-entry AC-6 write-back ask with no transitions offers only comment and no`;
  - `jira-entry AC-6 write-back ask refuses a change with no task and malformed input with exit 3`;
  - `jira-entry AC-6 write-back ask on an archived change asks nothing`.

  Check: those tests pass.
- [x] 3.3 Add `write-back answer` (D-7). Write these tests (spec `jira-tasks`: "Jira is written only on
  the developer's yes", every scenario except "Jira refuses the write", which 4.1 covers through the
  skill text):
  - `jira-entry AC-7 write-back answer with a transition gives one comment and that transition`;
  - `jira-entry AC-7 write-back answer only comment gives the comment and no transition`;
  - `jira-entry AC-7 write-back answer no, a second answer, and an answer before the question write
    nothing`;
  - `jira-entry AC-7 write-back answer after the archive writes nothing`;
  - `jira-entry AC-7 write-back answer with a transition not offered writes nothing and lists the
    choices again`;
  - `jira-entry AC-7 the comment names the link and the change in the files language`, with
    `devkit:\n  language: pt-BR\n` and with no block.

  Check: those tests pass.
- [x] 3.4 Gate: `env TMPDIR=/var/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/jira-task.test.mjs && python3 scripts/check.py` green; covers AC-4, AC-6 and AC-7 on the script's side.

## 4. Skills, documents and release (AC-1 to AC-7 on the session's side, AC-9, AC-10)

- [x] 4.1 Edit `plugins/openspec/skills/devkit/SKILL.md` as D-3, D-5 and D-7 say:
  - the `task` mode and the `ask-unfinished` sentence in `## Start`;
  - `### A Jira task` under `## A new change`;
  - the `grill` sentence;
  - `### Writing back to the task` at the end of `## Loop`;
  - the `## Owner gates` sentence and the four `## Never` items;
  - the frontmatter `description` and `argument-hint` of D-10.

  Add no `## ` heading. Write these text tests in `plugins/openspec/hooks/change-loop.test.mjs`:
  - `jira-entry AC-1 skill: the task mode, the connector's read, open --task and the two replies that
    open nothing` (it also covers AC-2 and AC-3);
  - `jira-entry AC-4 skill: the grill of a task leaves the request section as it is`;
  - `jira-entry AC-6 skill: the write-back question is asked once, in plain text, never with
    AskUserQuestion, and holds nothing`;
  - `jira-entry AC-7 skill: Jira is written only through write-back answer on the owner's own
    message, and a failed write is said and not retried`.

  Check: those tests pass, and so do "change-loop skill: the sections of D-3 to D-9 and the modes of
  start" and every other `change-loop skill:` test, unchanged.
- [x] 4.2 Add the paragraph **A request copied from a task.** of D-5 at the end of "### 3. Grill on
  the four axes" in `plugins/core/skills/requirements-grill/SKILL.md`. Write
  `jira-entry AC-4 grill skill: a request copied from a task is asked only what it leaves open` in
  `plugins/openspec/hooks/change-loop.test.mjs`. It reads the file with `readRepo` and checks for
  `Jira: <KEY>`, `(answered by the task)`, the one confirming question and "never edit the request
  section". Check: that test passes, and `python3 scripts/check.py` passes.
- [x] 4.3 Edit `docs/openspec-flow.md` (the forms list, the corrected `project` sentence, the
  **A Jira task.** paragraph), `docs/coordination-design.md` (sections 1, 8 and 13) and
  `docs/adr/0010-openspec-as-the-harness.md` (the dated Note) as D-10 says. Write
  `jira-entry docs: the flow document, the design document and ADR 0010 record the Jira entry` in
  `plugins/openspec/hooks/change-loop.test.mjs`. It checks:
  - the flow document's form and paragraph;
  - `20 (built)`, the "Built by `jira-entry`" and "Decided by `jira-entry`" sentences, and no
    `source: jira` line, in the design document;
  - the Note `Note (jira-entry, 2026-11-22)` in ADR 0010's Context, with its status still
    `accepted`.

  Check: that test passes, and so does `python3 scripts/check.py` (links, language).
- [x] 4.4 Add the round 20b block of D-10 to `openspec/roadmap.md`, right after the round 20 block.
  Write `jira-entry AC-10 the roadmap has the live-proof follow-up after jira-entry` in
  `plugins/openspec/hooks/change-loop.test.mjs`. It finds the unticked line
  `jira-entry-live (after: jira-entry)` and checks that it names a disposable test task the owner
  names, and that `guard.mjs#readRoadmap` reads it. Check: that test passes.
- [x] 4.5 Release as D-10 says:
  - bump devkit-openspec to 0.22.0 in `plugins/openspec/.claude-plugin/plugin.json` and devkit-core
    to 0.10.0 in `plugins/core/.claude-plugin/plugin.json`, both also in
    `.claude-plugin/marketplace.json`, and bump the marketplace to 0.26.0;
  - add the `CHANGELOG.md` section `## 0.26.0 — the Jira entry`;
  - turn the three `v0.21.1` lines of `docs/openspec-flow.md` into `v0.22.0`, and make the D-11
    change in "change-loop docs: the design records the answers", naming its invariant in the
    commit message;
  - run `python3 scripts/gen-catalog.py`.

  Check: `python3 scripts/gen-catalog.py --check` passes, `grep -c "v0.21.1" docs/openspec-flow.md`
  prints 0, and
  `node --test --test-name-pattern="change-loop docs: the design records the answers" plugins/openspec/hooks/change-loop.test.mjs`
  passes.
- [x] 4.6 Gate: `env TMPDIR=/var/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && command claude plugin validate . && openspec validate jira-entry --strict` green (the guard suite as a background command); covers AC-1 to AC-10 and every other suite at once, with fake connector answers only (AC-9).

## Workflow follow-up

- After the merge, tag `v0.22.0` on the merge commit and push the tag (`CONTRIBUTING.md`).
- Archive with the retro. The archive ticks the round 20 line of `openspec/roadmap.md`.
- In the projects that use devkit, update devkit-openspec and devkit-core, and move the pinned
  `devkit-reviews` workflow to `v0.22.0` through each project's own pull request.
- The live proof is the roadmap line `jira-entry-live` (round 20b). It runs when the owner names a
  disposable test task.
