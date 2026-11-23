<!-- devkit-stage design result=passed attempt=1 commit=c56155334749cdc46bad077ba8f53c4bbec5d140 -->
# Design

Change: `jira-entry` · Date: 2026-11-22 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(source: `requirements.md`; motivation in `proposal.md`, "Why"; behaviour in `specs/jira-tasks/spec.md`).

## Context

- `plugins/openspec/hooks/change-loop.mjs` is the decision core of `/devkit change`. `startMode`
  reads the request and answers a `mode`. `openChange` creates the worktree and writes
  `requirements.md` through `requirementsFor`, which quotes the request under `## Request` of the
  schema's template. `nextAction` computes one action from the files, git and GitHub. It reads the
  delivery checker (`collectState`, `buildReport`), whose report holds `pr: { number, url }` once
  the pull request exists (`deliver-check.mjs#buildReport`). The message table `MESSAGES` holds
  every reply in `en` and `pt-BR`. Only `open` and `script` write.
- Today `/devkit change PROJ-482` is free text. `parseStart` gives `text: 'PROJ-482'`. The
  `/^\S+$/` branch of `startMode` asks `knownChange`, which finds nothing for an upper-case word.
  The mode is then `new` or `ask-unfinished`.
- No hook of devkit-openspec matches an MCP tool (`plugins/openspec/hooks/hooks.json` has matchers
  for edits, Bash and Agent only), so the session's connector calls pass no lock.
- The roadmap run file already lives in the git common directory
  (`roadmap-loop.mjs#runFilePath`: `<common git directory>/devkit/roadmap-run.json`). Every checkout
  and every session of the clone see it, and no commit holds it.
- The skill `plugins/openspec/skills/devkit/SKILL.md` is the session's side. Its `## ` headings are
  pinned by the test "change-loop skill: the sections of D-3 to D-9 and the modes of start", so new
  text goes under `### ` headings.
- `scripts/check.py` refuses Portuguese prose in any Markdown file. Every Brazilian Portuguese text
  of this change lives only in `.mjs` tables, as the existing `pt-BR` entries of `MESSAGES` do.

## Goals / Non-Goals

**Goals:**

- One pure module for everything Jira-shaped: recognising a key or a link, validating the task the
  session gives, writing and reading the request section, the comment text. It is testable with
  fake answers only.
- The script stays a reader of files, git and GitHub. The session makes every connector call.
- The write-back question is computed by the loop and recorded outside the change's files, so it
  is asked once and never holds a stage.

**Non-Goals:**

- Parsing the connector's raw answer in the script. The session maps it to a small JSON object
  (D-3), because the connector's shape is not devkit's contract.
- A hook lock on Jira writes (`proposal.md`, "Flagged").
- Changing `decide`, the progress keys, the stop locks or the wait's `decisionKey`.

## Decisions

### D-1 The module `plugins/openspec/hooks/jira-task.mjs`

A new module with no imports beyond Node built-ins (it needs none) and no I/O. Its exports:

- `TASK_KEY = /^[A-Z][A-Z0-9_]+-[0-9]+$/`.
- `parseTaskRef(text)` returns `{ key, link }` or `null`. The input is trimmed (`String(text ?? '')`).
  - A trimmed text that matches `TASK_KEY` gives `{ key, link: null }`.
  - A text matching `/^https?:\/\/\S+$/i` is parsed with `new URL`. A parse error gives `null`. The
    key comes from `/\/browse\/([A-Z][A-Z0-9_]+-[0-9]+)(?:\/|$)/` on `pathname`, else from
    `searchParams.get('selectedIssue')` when it matches `TASK_KEY`. With a key it gives
    `{ key, link: <the trimmed text> }`, else `null`. The path wins when both hold a key.
  - Anything else gives `null`: empty or blank text, a key with more words, a lower-case word,
    `ftp:` or other schemes, and a link with no key.
- `taskIdPrefix(key)` returns the key lower-cased, with each `_` turned into `-` and runs of `-`
  collapsed, then trailing dashes dropped (`PROJ-482` gives `proj-482`, `MY_APP-7` gives `my-app-7`).
  The id of a change opened from the task must start with `<prefix>-`.
- `taskFromJson(text, key)` returns `{ task }` or `{ error }`. It reads the JSON the session pipes
  to `open --task`. Its decisions for broken input:
  - empty or blank text: `the task on standard input is empty`;
  - text `JSON.parse` refuses (cut short, unclosed): `the task on standard input is not JSON`;
  - a value that is not a plain object: `the task on standard input is not an object`;
  - `key` not equal to `key`: `the task names <x>, not <key>`;
  - `title` missing, not a string or blank: `the task has no title`;
  - `description` must be a string, `null` or absent (`''` when not a string); any other type is
    `the task's description is not text`;
  - `acceptanceCriteria` must be a string, `null` or absent (`null` when absent or blank); any other
    type is `the task's acceptance criteria are not text`;
  - `url` must be a string matching `/^https?:\/\/\S+$/`, `null` or absent (`null`); anything else
    is `the task's link is not an http(s) link`.

  Every other field is ignored, so comments, subtasks, links and attachments in the input are never
  copied. `task` is `{ key, url, title, description, acceptanceCriteria }`, with line ends
  normalised to `\n`.
- `quoteLines(text)` turns each line into `> <line without trailing blanks>` and a blank line into
  `>`. The quoting currently inside `change-loop.mjs#requirementsFor` moves here unchanged.
- `taskRequest(task)` returns the body of `## Request`:

  ```
  Jira: PROJ-482 https://acme.atlassian.net/browse/PROJ-482

  Title:

  > Login times out after 30 seconds

  Description:

  > <the description, quoted line by line>

  Acceptance criteria field:

  > <the field, quoted line by line>
  ```

  The key line has no link when `url` is `null`. The Description block is left out when the
  description is empty. The Acceptance-criteria block is left out when the field is `null`. The
  labels are fixed English text, like the template's own headings.
- `recordedTask(text)` returns `{ key, link }` or `null`. It reads the text of `requirements.md`.
  CRLF becomes LF. It finds the first line equal to `## Request` (trailing blanks allowed) and
  takes the first non-blank line after it, before the next line starting `## ` or the end of the
  text. That line must match `/^Jira: ([A-Z][A-Z0-9_]+-[0-9]+)(?:[ \t]+(https?:\/\/\S+))?[ \t]*$/`.
  Each of these gives `null`: an empty or unreadable file, no `## Request`, an empty section, a
  section whose first line is not a key line, and a key line that is quoted (`> Jira: ...`). A
  section running to the end of the file is read to its end. Reading only the first line means
  that a fence, a heading or a key line inside the quoted task can never be read as the record.
- `commentText(filesLanguage, { url, id })` returns the comment written on the task. For `en`:
  `devkit opened the pull request <url> for this task (change <id>).`. `pt-BR` has its translation
  in the module's table. Any other tag gets the English text.
- `writeBackInput(text)` returns `{ number, url, transitions }` or `{ error }`. It reads the JSON the
  session pipes to `write-back ask`:
  - `number` must be a positive integer;
  - `url` must match `/^https?:\/\/\S+$/`;
  - `transitions` is an array (absent means `[]`) of `{ id, name }`, where `id` is a non-empty
    string or a number (kept as a string) and `name` is a non-blank string;
  - a repeated `id` keeps its first entry.

  Empty, non-JSON and wrongly typed input each get an error naming the field.
- `writeBackChoices(transitions)` returns
  `[...transitions.map((t) => ({ choice: 'transition:' + t.id, kind: 'transition', name: t.name })), { choice: 'comment', kind: 'comment' }, { choice: 'no', kind: 'no' }]`.

Alternative rejected: keep these in `change-loop.mjs` (1,489 lines). A separate module keeps the
Jira shapes testable on their own, and the AC-9 source check can name exactly one file that knows
Jira. Rejected too: a stage-header field for the key (the AMBIGUOUS (b) of `requirements.md`). The
header grammar is shared by `flow-check`, `deliver-check` and the panel's copy
(`plugins/panel/hooks/grammar.ts`, checked by `scripts/check.py`), and it holds stage facts only.
The plain `Jira:` line (reading (a)) is the record.

### D-2 `start`: the `task` mode

`startMode` (`change-loop.mjs`) gains one field on every output, `task`, which is `null` unless the
verb is `change` and `parseTaskRef(text)` returns a task. In that case it is
`{ key, link, idPrefix: taskIdPrefix(key) }`. `version` stays 1, because the field and the mode are
additive. After the project gate and the `unfinished` list, and before the existing `/^\S+$/` branch:

1. When a listed change's `requirements.md` (read at `locateChange(u.root, u.id).dir`) gives
   `recordedTask(...).key === task.key`, the first such change in the list's order is resumed,
   with the existing `resume` output and `resumed` reply.
2. Otherwise, when the list is not empty, the output is the existing `ask-unfinished` output with
   `task` set.
3. Otherwise, the mode is `task`, with `reply: null`.

A text that is not a task reaches the existing code unchanged (AC-8). A change that recorded the key
and is archived on the default branch is not in `unfinished`, so its key reads as a new task. The
id the session proposes then must differ (O2 refuses a taken name).

### D-3 The session reads the task (skill text)

`plugins/openspec/skills/devkit/SKILL.md` gains, under `## A new change`, a `### A Jira task`
subsection that the `task` mode points to. Its steps:

1. Load the connector's Jira tools with ToolSearch (query `jira issue`). The read tool is the one
   whose name ends in `getJiraIssue`. Its siblings are `getTransitionsForJiraIssue`,
   `addCommentToJiraIssue`, `transitionJiraIssue` and `getAccessibleAtlassianResources` (the
   `cloudId` when the read tool asks for one). Use the site whose host the typed link names, else
   try each accessible site until one reads the task. When no read tool loads, run
   `change-loop.mjs reply task-no-connector --param key=<KEY> --lang ...`, say it and end the turn.
2. Read the task. A not-found, a refusal or any error runs
   `change-loop.mjs reply task-unreadable --param key=<KEY> --lang ...`; say it and end the turn.
3. Build the JSON with these fields:
   - `key`;
   - `url`: the task's browse link `https://<site>/browse/<KEY>`, else the typed link;
   - `title`: the summary;
   - `description`: as text, in the Markdown form when the connector offers one;
   - `acceptanceCriteria`: the value of the field whose name is "Acceptance criteria", compared
     without case, when the project has one, else `null`.

   Nothing else of the task goes in.
4. Propose the id `<task.idPrefix>-<subject in at most four words>`, at most 48 characters. Choose
   the script by the rule of `## A new change`, applied to the task's text.
5. Run `change-loop.mjs open <id> --script <s> --why <code> --task <KEY> --lang ...` with the JSON on
   standard input, through the quoted heredoc and its terminator rule. On `name-taken`, choose
   another id. On `task-taken` or any other exit 3, say `reply` and end the turn. Keep the opening
   `reply` for the message that ends the turn, then enter the Loop.

The `## Start` list gains the `task` mode, and `ask-unfinished` says that when `task` is not null,
"start the new request" goes to `### A Jira task`.

Alternative rejected: let `open` read the connector's raw issue JSON. Its field ids differ per site
(the acceptance-criteria field is a custom field), and its description may be Atlassian Document
Format. The script would then own a third-party shape that only a live run can pin. The session's
mapping is proved live by the follow-up of AC-10.

### D-4 `open --task`

`openChange(cwd, id, { ..., task: key, gh })` and `runOpen` accept `--task <KEY>`. `main` passes
`gh` to `runOpen`. After the existing checks for the name, the script, the reason and a non-empty
standard input:

1. `--task` must match `TASK_KEY`, else `LoopUsageError('open --task needs a Jira key')`.
2. `taskFromJson(text, key)`: an `error` is a `LoopUsageError` with that message.
3. `id` must start with `taskIdPrefix(key) + '-'`, else
   `LoopUsageError('a change opened from <KEY> needs an id that starts with <prefix>-')`.
4. The project gate, as today.
5. When an `unfinished(start, { env, gh })` entry records the key (as in D-2), throw
   `LoopRefusal('task-taken', render(l, 'task-taken', { key, id: <that id> }))`.
6. `prepare` writes the template with `withRequest(template, taskRequest(task))`.

`requirementsFor` becomes `withRequest(template, body)`, which does today's replace and keeps the
"no `## Request` section" error. The free-text path calls `withRequest(template, quoteLines(request))`,
which gives byte-identical output (AC-8). The result JSON gains `task: { key, link: task.url }`, and
its reply is `opened-task` in place of `opened`. Steps 1 to 5 create nothing. Every refusal exits 3.

### D-5 The grill of a task

The `grill` item of the skill's Loop gains one sentence. When the action carries `task`, follow the
requirements-grill skill's paragraph on a request copied from a task, and leave `## Request` (its
`Jira:` line and its quoted parts) exactly as it is. `plugins/core/skills/requirements-grill/SKILL.md`
gains, at the end of "### 3. Grill on the four axes", a paragraph that starts
**A request copied from a task.** It says five things:

- when the request section starts with a `Jira: <KEY>` line, the quoted title, description and
  acceptance-criteria field are the ammunition;
- ask no question they answer;
- record each such point under Assumptions as a bullet ending in `(answered by the task)`, and turn
  criteria the task states into `AC-<n>` entries;
- when nothing is left to ask, ask one question that confirms the assumptions drawn from the task,
  because the requirements pass only on the owner's answer;
- never edit the request section.

Every action of such a change carries `task` (D-6), the grill's included.

### D-6 `next`: the `task` and `writeBack` fields

`nextAction` keeps `decide` as it is and adds two fields after it, next to `icon` and `sessionTitle`:

- `task: { key, link }` when `recordedTask` of the change's `requirements.md` is not `null`.
- `writeBack: { key, link, number, url }` when all four of these hold:
  - the change records a task;
  - the checkout is not on `chore/archive-<id>`;
  - the action is not a blocked end;
  - the delivery report read in this call has `pr` and `readWriteBack(writeBackFile(found.root, id))`
    is not "asked" for `(key, pr.number)`.

  The report's `pr` is kept from the `try` block that builds `row`, as `let deliveredPr = null`.

"Asked" means the record is corrupt (D-7), or its `key` and `number` equal the task's key and the
pull request's number. A new pull request (another number) asks again. `waitLoop`'s `decisionKey`
does not read the new fields, so a question that is pending or answered never ends a wait or
changes a progress key (AC-6, "the delivery goes on").

### D-7 `write-back ask|answer` and its record

The record file is `writeBackFile(root, id)`, which is
`join(<git rev-parse --path-format=absolute --git-common-dir>, 'devkit', 'write-back', id + '.json')`,
falling back to `join(root, '.git')` as `withOpenLock` does. Its content is
`{ version: 1, change, key, number, url, askedAt, transitions: [{ id, name }], answer: null | { choice, at, written } }`.
It is written to a temporary file in the same folder and then renamed. `readWriteBack(file)` returns
`null` when the file does not exist. When the file exists but cannot be read, is not JSON or has
another `version`, it returns `{ corrupt: true }`: a damaged record asks nothing and writes nothing.

`change-loop.mjs write-back ask <id> --lang <l>` takes `writeBackInput` JSON on standard input
(`main`'s `isMain` reads standard input for `write-back` too). It does these steps in order:

1. Locate the change as `nextAction` does. An unknown change, or one with no recorded task, is a
   `LoopUsageError`. Input that `writeBackInput` refuses is a `LoopUsageError` too.
2. Archived on the default branch (`archivedOnDefault(start, { env, gh })`) or on the archive branch:
   print `{ version: 1, change, key, ask: false, why: 'archived' }`.
3. Already asked: `{ ..., ask: false, why: 'asked' }`.
4. Otherwise write the record. With
   `choices = writeBackChoices(transitions).map((c) => ({ choice: c.choice, label }))`, where each
   label is `render(l, 'choice.' + c.kind, { name })`, print
   `{ version: 1, change, key, ask: true, question: render(l, 'write-back-ask', { id, key, number, choices: <labels joined by '; '> }), choices }`.

`change-loop.mjs write-back answer <id> --choice <comment|no|transition:<id>> --lang <l>`:

1. Locate and read the task as above. A `--choice` outside that form is a `LoopUsageError`.
2. No record, a corrupt record, or a record of another key: `{ write: false, why: 'not-asked' }`
   with `write-back-none`.
3. An answer already recorded: `{ write: false, why: 'answered' }` with `write-back-none`.
4. Archived on the default branch: record the answer with `written: false` and return
   `{ write: false, why: 'archived' }` with `write-back-late`.
5. `no`: record it and return `{ write: false, why: 'no' }` with `write-back-none`.
6. `transition:<x>` not among the recorded transitions: `{ write: false, why: 'unknown-choice' }`
   with `write-back-unknown` (and the labels of the recorded choices). Nothing is recorded, so a
   valid answer can follow.
7. Otherwise record the answer with `written: true` and return
   `{ version: 1, change, key, write: true, comment: commentText(filesLanguageOf(readDevkitSettings(found.root)), { url: record.url, id }), transition: { id, name } | null, reply }`.
   `reply` is `write-back-moved` (with `name`) or `write-back-commented`.

Every output carries `version: 1`, `change` and `key`. Both subcommands exit 0, or 3 on a usage
error (the common `failure` form). Neither prints a `devkit-run:` or `devkit-end:` line, so the stop
lock's record is untouched. The answer is recorded before the session writes to Jira, so a
repeated call never comments twice. A failed write is then not retried: the session says
`write-back-failed`.

The skill gains `### Writing back to the task` at the end of `## Loop`:

- When an action carries `writeBack`, before carrying the action out, read the task's transitions
  with the connector (`[]` when it cannot). Run `write-back ask` with
  `{ "number", "url", "transitions": [{ "id", "name" }] }` through the quoted heredoc.
- On `ask: true`, keep `question` for the message that ends the turn. Ask it as plain text, never
  with AskUserQuestion, because that would hold the turn and with it the delivery. Then carry out
  the action.
- Only the owner's own typed message answers. Map it to one `choices[].choice`. An answer that maps
  to none gets the question said again.
- Run `write-back answer`. On `write: true`, add `comment` to the task and then apply
  `transition.id` when present, and say `reply`. On a connector failure, run
  `reply write-back-failed --param key=<KEY> --param error="<message>"` and say it. On
  `write: false`, say `reply`.
- Then go on: when no wait on GitHub is running and the run has not ended, run `next`.

`## Owner gates` gains: the write-back question is not a gate and blocks nothing. `## Never` gains:
write to Jira except from `write-back answer` on the owner's own message; ask the write-back question
with AskUserQuestion; copy a comment, subtask, linked task or attachment of a task into the change;
keep a Jira token or a Jira setting in the project.

Alternatives rejected:

- A record file in the change folder. It would be an uncommitted file in the worktree after the pull
  request opens, or a commit that runs the checks again. The question is a conversation with the
  developer, not part of the change.
- No record at all. The loop would ask on every call, or the session would have to remember, which
  ADR 0010 decision 3 rules out.
- AskUserQuestion. It holds the turn, and grill question 2 says the question does not hold the
  delivery.
- Asking at the merge or the archive. Grill question 2 settled the moment.

### D-8 The messages

`MESSAGES.en` gains the keys below, and `MESSAGES['pt-BR']` gains their translations, in the register
of the existing `pt-BR` entries. `choice.no` translates to the Portuguese word for "no".

| Key | English text |
|---|---|
| `task-no-connector` | This session has no Jira connector, so I cannot read {key}. Nothing was opened: type /devkit change and what you want done, in your own words. |
| `task-unreadable` | I could not read the task {key} in Jira: it was not found, or this account cannot see it. Nothing was opened: type /devkit change and what you want done, in your own words. |
| `task-taken` | The task {key} already has the unfinished change {id}: type /devkit change {key} to continue it. Nothing was opened. |
| `opened-task` | I read the task {key} and opened the change {id} on the {script}, because {why}. Next come a few questions on what the task leaves open; to use the {other} instead, say so before the plan is written. |
| `write-back-ask` | Pull request #{number} of {id} is open. Should I write its link on the task {key}? Answer one of: {choices}. Nothing is written to {key} until you answer, and the delivery goes on meanwhile. |
| `choice.transition` | move it to "{name}" |
| `choice.comment` | only comment |
| `choice.no` | no |
| `write-back-commented` | I wrote the link of pull request #{number} on {key}. |
| `write-back-moved` | I wrote the link of pull request #{number} on {key} and moved it to "{name}". |
| `write-back-none` | Nothing was written to {key}. |
| `write-back-late` | The change {id} is already archived, so nothing was written to {key}. |
| `write-back-unknown` | That is not one of the choices {key} had when I asked. Answer one of: {choices}. |
| `write-back-failed` | Jira did not accept the write on {key} ({error}). Nothing more is tried; you can add the link to the task by hand. |

None of these keys ends a run, so `END_OF_KEY` does not change. The `SAMPLE` table of
`change-loop.test.mjs` gains `key: 'PROJ-482'`, `name: 'In Review'` and
`choices: 'move it to "In Review"; only comment; no'`. It is data for the new keys. The invariant of
"change-loop replies: no internal term in either language" does not change.

### D-9 What `change-loop.mjs` says about itself

The module header lists `write-back ask <id> --lang <l>` (JSON on standard input) and
`write-back answer <id> --choice <c> --lang <l>`. It also says that `open`, `script` and `write-back`
write, the last only its record in the git common directory, and that `open --task` takes the task
as JSON on standard input. `USAGE` names both forms and `--task <KEY>`.

### D-10 Documents, the ADR Note, the roadmap and the release

- `docs/openspec-flow.md`, section "The change coordinator: `/devkit change`":
  - The forms list gains `/devkit change <Jira key or link>`.
  - The forms sentence that says `project` is not built is corrected: `project` is built and only
    `help` is not.
  - A paragraph **A Jira task.** says five things: what is recognised; that the session reads the
    task through its Atlassian connector and the script makes no call and keeps no token; what
    `requirements.md` records; the resume by key; and the one write-back question with its record
    in the git common directory.
  - The CI pin goes from `v0.21.1` to `v0.22.0` (its three lines).
- `docs/coordination-design.md`:
  - Section 1: the round column of `/devkit change PROJ-482` becomes `20 (built)`. The "Writing back
    to Jira" paragraph gains one sentence, "Built by `jira-entry` on 2026-11-22: ...", naming the one
    question when the pull request opens, the transitions offered, the yes taken only from the
    developer's message, and nothing written after the archive.
  - Section 8: the `tasks:` and `source: jira` lines leave the example. The field-names paragraph
    gains "Decided by `jira-entry` on 2026-11-22: the task source needs no field; the key or link
    typed names it."
  - Section 13: "Jira can be read on each platform." gains "(the follow-up `jira-entry-live`, round
    20b)".
- `docs/adr/0010-openspec-as-the-harness.md`: a Note in Context, after the project-phases Note:
  "Note (jira-entry, 2026-11-22): round 20 adds no task-source setting to the configuration block
  of decision 1. The key or link the owner types names the task, and the session's Atlassian
  connector reads it, so the project keeps no Jira token or setting. The 'task source, round 20' of
  decision 1 and the task source of decision 8 need no field; decisions 1 to 8 are otherwise
  unchanged." The status does not change.
- `openspec/roadmap.md`: after the round 20 block, a new block:

  ```
  ## Round 20b: live proof of the Jira entry
  - [ ] jira-entry-live (after: jira-entry) — read a real Jira task through the session's Atlassian connector with `/devkit change <key>`, and write back once on a disposable test task the owner names (one comment, one transition), on each platform the owner uses; it checks what the jira-entry plan assumed: the connector's tool names, the description's text form and the acceptance-criteria field (coordination-design D-13: Jira can be read on each platform)
  ```

- Release (`CONTRIBUTING.md` step 5):
  - devkit-openspec goes from 0.21.1 to 0.22.0 (`plugins/openspec/.claude-plugin/plugin.json` and
    `.claude-plugin/marketplace.json`).
  - devkit-core goes from 0.9.0 to 0.10.0 (`plugins/core/.claude-plugin/plugin.json` and the
    marketplace).
  - The marketplace goes from 0.25.1 to 0.26.0.
  - `CHANGELOG.md` gains `## 0.26.0 — the Jira entry`.
  - The `devkit` skill's frontmatter `description` and `argument-hint` name the Jira form. Its
    description gains "/devkit change <Jira key or link> opens the change from that task, read
    through the session's Atlassian connector, and asks once, when the pull request opens, whether
    to write its link back", and "/devkit change <Jira key or link>" joins its "Use when" list. So
    `python3 scripts/gen-catalog.py` regenerates `docs/catalog.md` and `plugins/openspec/README.md`.
  - The tag `v0.22.0` goes on after the merge (Workflow follow-up).

### D-11 Tests

Every new test's name starts `jira-entry AC-<n> ` (or `jira-entry docs:`).

- `plugins/openspec/hooks/jira-task.test.mjs` (new; imported by `guard.test.mjs` after the
  `change-loop.test.mjs` import, with the comment `// jira-entry: the Jira key, the task and the write-back`):
  - the pure tests of D-1, every decision for broken input included;
  - the AC-9 source check: `jira-task.mjs` and `change-loop.mjs` import none of `node:http`,
    `node:https`, `node:net`, `node:tls`, `node:dgram`, `undici`, and call no `fetch(`;
  - every task in the tests is a fake JSON object.
- `plugins/openspec/hooks/change-loop.test.mjs` gets the start, open, next and write-back tests of
  `tasks.md`, over the existing fixtures: `devkitRepo`, `addChange`, `startRun`, `freshProject`,
  `openRun`, `snapshot` and `deliveredChange`. `deliveredChange` gains an optional
  `requirements = '# Requirements\n'` parameter, used in both places it writes `requirements.md`.
  The default keeps every existing caller byte-identical.
  - The archived case puts `openspec/changes/archive/2026-11-22-feat/` in the main checkout's
    working tree, one of the sources `archivedDates` reads.
  - The skill and document text tests (AC-1 to AC-7, AC-10, docs) read the files with the file's
    `skillText()` and `readRepo`.
- Existing tests that change, each with its invariant named in the commit message:
  - "change-loop replies: no internal term in either language": `SAMPLE` gains three keys (D-8).
    The invariant is unchanged: every key renders with no internal term.
  - "change-loop docs: the design records the answers": `/v0\.21\.1/` becomes `/v0\.22\.0/`, with
    an added `doesNotMatch(/v0\.21\.1/)`. The invariant: the CI snippet pins the current release.

## Decisions and ADRs

No new ADR. The change follows ADR 0010 decision 3 (a loop over files: the question's record is a
file, and the session remembers nothing), decision 5 (no new hook; the hooks still only veto) and
decision 6 (the owner's gates are unchanged; the write-back question is not a gate). It follows ADR
0011, because the session, which is the change coordinator, makes the connector calls and the
script stays a reader. It follows ADR 0014, because in a roadmap run a change's question is asked
in its own session. ADR 0002 and ADR 0003 are untouched: the pending question holds no merge mode.
The one point that touches an ADR's text is the task-source setting of ADR 0010 decisions 1 and 8.
It is recorded as a dated Note (D-10) and flagged for the owner in `proposal.md`. No rejected
alternative of an ADR is taken up: no ADR rejected a session-side connector or a record in the git
common directory.

## Implementation plan

Dependency order: the pure module, then the entry (`start`, `open`, the messages), then the loop's
fields and `write-back`, then the skills, the documents and the release.

**Per surface.**

- `plugins/openspec/hooks` (Node): `jira-task.mjs` (new), `change-loop.mjs` (D-2, D-4, D-6 to D-9).
- `plugins/openspec/skills/devkit` (session text): D-3, D-5, D-7.
- `plugins/core/skills/requirements-grill` (session text): D-5.
- Docs and release: D-10.
- No frontend, worker or schema change. The stage headers, `flow-check`, `deliver-check`,
  `conduct-check`, `roadmap-loop.mjs` and the panel are untouched.

**File structure.**

| Action | Path |
|---|---|
| create | `plugins/openspec/hooks/jira-task.mjs` |
| create | `plugins/openspec/hooks/jira-task.test.mjs` |
| modify | `plugins/openspec/hooks/change-loop.mjs` |
| modify | `plugins/openspec/hooks/change-loop.test.mjs` |
| modify | `plugins/openspec/hooks/guard.test.mjs` (one import line) |
| modify | `plugins/openspec/skills/devkit/SKILL.md` |
| modify | `plugins/core/skills/requirements-grill/SKILL.md` |
| modify | `docs/openspec-flow.md`, `docs/coordination-design.md`, `docs/adr/0010-openspec-as-the-harness.md` |
| modify | `openspec/roadmap.md` |
| modify | `CHANGELOG.md`, `.claude-plugin/marketplace.json`, `plugins/openspec/.claude-plugin/plugin.json`, `plugins/core/.claude-plugin/plugin.json` |
| regenerate | `docs/catalog.md`, `plugins/openspec/README.md` |
| delete | none |

**Estimate.** Optimistic 10 h, likely 16 h, pessimistic 26 h. The pessimistic case is a slow
guard suite run twice, plus fixture work for the archived and archive-branch cases.

**Effort.**

| Component | Hours | Type | Risk |
|---|---|---|---|
| `jira-task.mjs` (D-1) | 2 | Core | LOW |
| `jira-task.test.mjs` with the source check (D-11) | 1.5 | Testing | LOW |
| `start` task mode and resume by key (D-2) | 1.5 | Core | MEDIUM |
| `open --task`, `withRequest` refactor, task-taken (D-4) | 2 | Core | MEDIUM |
| Messages in two languages (D-8) | 1 | Core | LOW |
| Start and open tests (D-11) | 2 | Testing | MEDIUM |
| `next` fields and the record (D-6, D-7) | 1.5 | Core | MEDIUM |
| `write-back ask` and `answer` (D-7, D-9) | 1.5 | Core | MEDIUM |
| Write-back tests (D-11) | 2 | Testing | MEDIUM |
| Skill texts and their tests (D-3, D-5, D-7) | 1.5 | Documentation | MEDIUM |
| Docs, ADR Note, roadmap line, release, catalog (D-10) | 1 | Documentation | LOW |
| Whole suite and validation | 0.5 | Testing | LOW |

**Risks.**

| Risk | Probability × impact | Mitigation |
|---|---|---|
| The connector's tool names or answer shape differ from D-3 | MEDIUM × MEDIUM | The skill finds the tools by ToolSearch and describes each by what it does. The script never sees the connector's shape. The follow-up `jira-entry-live` checks it live before anyone relies on it. |
| The description comes back as Atlassian Document Format, not text | MEDIUM × LOW | The skill asks for the Markdown form when the connector offers one. The script quotes whatever text it gets, literally. |
| The grill rewrites `## Request` and the `Jira:` line is lost, so the key no longer resumes and no write-back is asked | LOW × MEDIUM | Both skills say to leave the section as it is. `recordedTask` reads only the first line. A test pins the skill text. |
| The yes rests on the session's discipline, with no hook | LOW × HIGH | It is the same lock as the plan approval: only the main session runs `write-back answer`, and only from the owner's typed message (skill `## Never`). It is flagged for the owner, and a hook would need its own roadmap line. |
| An answer after the archive is not caught because GitHub cannot be read and the local refs are old | LOW × MEDIUM | `archivedOnDefault` unions GitHub, the remote-tracking ref, the local ref and the main working tree. The write needs the record's question first, and the comment only links a merged pull request. |
| The record file is lost (another clone or machine), so the question is asked again there | LOW × LOW | Accepted. It is one more question, and still nothing is written without a yes. |
| The `start` change breaks AC-8 | LOW × HIGH | The task branch runs only when `parseTaskRef` returns a task. The existing S-tests stay unchanged, and new AC-8 tests compare outputs. |

**Assumptions.**

- A Jira key matches `^[A-Z][A-Z0-9_]+-[0-9]+$` (`requirements.md`, Assumptions).
- The Atlassian connector has the tools named in D-3. Source: Atlassian's remote MCP server, as the
  planner knows it. This is not verified in this repository, and the follow-up checks it.
- The acceptance-criteria field, when a project has one, is a field named "Acceptance criteria"
  (`requirements.md`, question 4).
- `deliver-check.mjs#buildReport` gives `pr: { number, url }` once the change's pull request exists
  (read at `deliver-check.mjs`, `buildReport`).
- The git common directory is writable by the session, as the roadmap run file already needs
  (`roadmap-loop.mjs#runFilePath`).
- No devkit hook matches MCP tools (`plugins/openspec/hooks/hooks.json`).

**Dependencies.**

- `change-coordinator` (archived): `change-loop.mjs`, the message table and the skill.
- `review-writer-prompt` (archived): the current pin and versions.
- No open decision of `docs/coordination-design.md` is touched.

## Risks / Trade-offs

- [The script trusts the session's JSON for the task and the pull request] → It validates the shape
  and the key. The pull request's number and link come from the same `next` output the session was
  just given. The session is the change coordinator under ADR 0011.
- [A question per pull request, not per change] → A closed and reopened pull request asks again,
  and that is accepted. The spec's "asked once" is per pull request, as `writeBack` says.
- [Labels in `requirements.md` are English in a `pt-BR` project] → They are fixed labels like the
  template's own headings. The task's text is copied as written.

## Migration Plan

Nothing migrates. A project gets the entry when it updates devkit-openspec to 0.22.0, and devkit-core
to 0.10.0 for the grill paragraph. Rollback is reverting the pull request. Changes opened from tasks
stay ordinary changes, because their `Jira:` line is plain text. Record files under
`<git common dir>/devkit/write-back/` are then inert and can be deleted.
