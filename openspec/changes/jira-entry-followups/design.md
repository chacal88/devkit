<!-- devkit-stage design result=passed attempt=4 commit=697f69983efc45b037b67fecde4960ec728a0597 -->
# Design

Change: `jira-entry-followups` · Date: 2026-11-23 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(sources: `requirements.md`, `proposal.md`, `specs/verdict-files/spec.md`,
`specs/review-round/spec.md`, `specs/jira-tasks/spec.md`, `specs/change-stages/spec.md`).

## Context

See `proposal.md` (Why). The code, read at `697f699` (devkit-openspec 0.33.0, devkit-core 0.14.0,
marketplace 0.37.0):

| Where | What it does today |
|---|---|
| `plugins/core/skills/review-change/scripts/review-round.workflow.js` (rules section) | `STAGE1_SCHEMA` (line 9) requires `uncommitted: boolean`; `validateStage1` (line 104) refuses a non-boolean and copies it into the normalized answer; `outcomeOf` (line 210) copies `stage1.uncommitted` into the outcome; `commitLine` (line 252) adds ` (uncommitted changes)` from it; `reviewerPrompt` (line 256) asks for `uncommitted: boolean` and never says what it means. `validateArgs` (line 65) knows no `dirty` |
| `plugins/core/skills/review-change/scripts/review-round.mjs` | The loader of the rules and the CLI `stage1 \| verify \| outcomes \| consolidate \| check-file --input <json>`; `checkFileCommand` (line 124) expects line 2 from `outcome.uncommitted`. It runs no git |
| `plugins/openspec/hooks/deliver-check.mjs#dirtyPaths` (line 250) | `git status --porcelain -z -uall`: a tracked path (both paths of a rename or copy) outside `openspec/`, an untracked path outside `openspec/` and `.claude/` |
| `deliver-check.mjs#reviewRecord` (line 235), `#verdictAllowed` (line 243), `#readReviews` (line 344) | A verdict that is not approved or declined is current only while later commits touch the change's review record (`reviews/`, `review.md`, `evidence.md`); an approved or declined one keeps the `openspec/` rule (plus test files for the four test-spared reviewers), whatever findings it lists |
| `deliver-check.mjs#findingsIn` (line 474) | Per folder: each `[blocking]`/`[important]` line is fixed (a `fixed in <sha>` in the history of the head), refuted, or undisposed |
| `deliver-check.mjs#changedUnder` (line 851) | Paths `git status` lists under a pathspec, tracked or untracked |
| `deliver-check.mjs#nextStep` (line 1510) | `commit` only for `state.dirty` (outside `openspec/`, line 1551); then `stop-review-deadlock`; then `fix-review` for current rejected verdicts and current approved ones with an undisposed finding (lines 1553 to 1570), whatever the change folder holds uncommitted |
| `deliver-check.mjs#collectState` (line 1700) | Builds `dirty: facts.dirty` and no list of the change folder's own uncommitted files |
| `plugins/openspec/hooks/guard.mjs#readFlowFile` (line 421) | Parses, checks `stages`, `version` (whole number from 1) and `ceilings.default`, then every stage's keys against `STAGE_KEYS` (line 405): an unknown key is `malformed: stage <id> has an unknown key <k>`. `version` is never compared with anything. The top-level keys are not checked |
| `plugins/openspec/schemas/{devkit,devkit-lite}/flow.json` | Version 2, byte-identical to `flows/2.json`, whose digest `scripts/released-flows.json` records; `scripts/check.py` refuses any other content for version 2 |
| `plugins/openspec/hooks/change-loop.mjs#writeBackAsk` (line 1406) | Answers `ask: false, why: asked` for any readable record (line 1414); `writeBackAsked` (line 1383), which `nextAction` uses, compares the key and the number |
| `change-loop.mjs#runReply` (line 2425), `isMain` (line 2606) | `reply <key> --lang <l> [--param name=value]...`; standard input is read only for `start`, `open` and `write-back` |
| `change-loop.mjs#openChange` (line 1955) | The `task-taken` check (lines 1979 to 1982) runs before `openCheckout` takes the open lock (`withOpenLock`, line 2009), so two calls for one key both pass it |
| `change-loop.mjs#nextAction` (lines 1333 to 1342) | `stopped` (a `blocked` end or `waiting-budget`) keeps `writeBack` off; the budget half has a test, the blocked half none |
| `plugins/openspec/hooks/jira-task.mjs#taskIdPrefix` (line 27) | Lower case, `_` to `-`, runs of `-` collapsed, trailing `-` removed |
| `plugins/openspec/skills/devkit/SKILL.md` (line 115) | `reply write-back-failed --param key=<KEY> --param error="<message>"` |

Constraints:

- `deliver-check.mjs` and `guard.mjs` are among the files a project's `devkit-reviews` workflow
  downloads (`docs/openspec-flow.md`, CI section): no new module and no new import in either.
- devkit-core installs without devkit-openspec: `review-round.mjs` cannot import `deliver-check.mjs`.
- A released flow version never changes (`scripts/check.py`, CONTRIBUTING.md "Changing the OpenSpec
  schemas"); the two schema copies (`plugins/openspec/schemas/`, `openspec/schemas/`) stay
  byte-identical.
- The rules section of `review-round.workflow.js` stays pure: no git, no module loading (its own
  header comment; ADR 0008 decision 3: the script gets everything through its arguments).

## Goals / Non-Goals

**Goals:** the four parts of `proposal.md` (What Changes), with one test per guard, branch and label
of every new predicate, negatives included.

**Non-Goals:** a shared module between the packs for the dirty-path rule (a parity test holds the
two copies together instead); any change to how `staleness` treats a marked verdict, to the merge
half of `staleness`, to `findingsIn`'s rule, or to the readout's newer-flow line; any other caller
of `reply` reading standard input.

## Decisions

### D-1 The `Commit:` marker comes from git (item 1; AC-1, AC-2)

- `review-round.mjs` gains `export function treeState(root)` and the subcommand
  `tree --input <json>` with `{ root }` (an absolute path, or one relative to the current folder,
  resolved with `path.resolve`). A `root` that is missing or not a non-empty string is
  `review input invalid: root must be a path` (exit 3).
  It prints `{ "head": "<40 hex>", "dirty": ["<repo-relative path>", ...] }`. `dirty` follows
  `deliver-check.mjs#dirtyPaths` line for line: `git -C <root> status --porcelain -z -uall`; a
  tracked entry counts its path, and for `R`/`C` also its source, when outside `openspec/`; an
  untracked entry counts when outside `openspec/` and not under `.claude/`. A root that is not a git
  worktree (a folder with no git), or a repository with no commit yet (`git rev-parse HEAD` fails), is `review input invalid: <root> is not a git worktree with a
  commit` (exit 3). `SUBCOMMANDS` and the CLI header comment gain `tree`.
  - Why a copy and not an import: devkit-core installs alone (Constraints). The rule is six lines;
    the parity test of D-10 (`jira-entry-followups AC-1 the round's tree rule is the delivery
    check's`) holds both copies to the same trees.
- The rules section: `validateArgs` requires `args.dirty`, an array of non-empty strings
  (`review input invalid: args.dirty must be a list of paths`). `STAGE1_SCHEMA` drops `uncommitted`
  from `required` and `properties`. `validateStage1` drops its `uncommitted` check and does not copy
  the key (an answer that still holds it is read as if it did not). `outcomeOf` sets
  `uncommitted: Array.isArray(args.dirty) && args.dirty.length > 0`. `commitLine` and
  `checkFileCommand` are unchanged: both read `outcome.uncommitted`.
- `reviewerPrompt`: the JSON shape loses `uncommitted: boolean`, and one sentence is added after the
  `git rev-parse HEAD` sentence: "The round writes your Commit line itself, from git: it adds
  (uncommitted changes) only when a path outside openspec/ is uncommitted (an untracked path under
  .claude/ does not count); report nothing about it."
- `plugins/core/skills/review-change/SKILL.md`, the `Build \`args\` first` sentence: `args` gains
  `dirty`; "`head` is the full sha `git rev-parse HEAD` prints in the change's worktree, run right
  before the round" stays, followed by "(`node <skill-dir>/scripts/review-round.mjs tree --input
  <json>` with `{ root }` prints it as `head`, with `dirty`, the uncommitted paths outside
  `openspec/` that mark every verdict's `Commit:` line)". The `head` wording the test
  `review-writer-prompt AC-4 text ...` matches is kept.
- `plugins/openspec/skills/ship-change/SKILL.md`, the `review` row: after "with `args.head` the full
  sha `git rev-parse HEAD` prints in the change's worktree right before the round" add "and
  `args.dirty`, both as the review skill's `review-round.mjs tree` prints them".
- Real-run proof (CLAUDE.md working rules), task 2.5. What an agent writes changes in two places:
  the stage-1 answer (one key fewer; an answer that still carries `uncommitted: true` is accepted
  and changes nothing) and line 2 of the writer prompt, which the writer copies verbatim
  (`check-file` refuses anything else). The cases the plan declares, each run for real on a scratch
  clone of the worktree with this worktree's files:
  - the conducting session's part: `review-round.mjs tree` on the clone, its `head` and `dirty`
    put into `args` as the skill text of D-1 says;
  - two trees: only `openspec/` files dirty (`evidence.md`, `design.md`), and one `src/` file dirty;
  - two stage-1 answers per tree: one without `uncommitted`, one carrying `uncommitted: true`;
  - two paths: the `agents` path (`stage1`, `verify`, `outcomes` CLI calls, the answers as JSON
    files) and the `workflow` path (`review-round.workflow.js` run by `node` with the tool globals
    of the test harness of `review-round.test.mjs`, `agent` returning the same answers and a writer
    reply);
  - for each of the eight runs: line 2 of every writer prompt, the file written as the prompt says,
    `check-file` on it, and `deliver-check.mjs <id>`'s reviews item on the clone.
  The implementer records the commands and outputs in `openspec/changes/jira-entry-followups/proof/real-run.md`
  (precedent: `openspec/changes/archive/2026-11-23-review-openspec-fix/proof/`); the verify step cites
  it in `evidence.md`. Real reviewer agents writing their own files on the new line 2 are this
  change's own review round: the session runs it with this worktree's
  `plugins/core/skills/review-change` as `<skill-dir>` (its `tree`, its scripts; the installed
  devkit-core 0.14.0 has neither), and records in `review.md`'s section the `tree` output and each
  verdict file's line 2.
- Alternatives rejected: keep the reviewer's flag and define it in the prompt (the reviewer still
  decides from its own reading, the defect's cause); compute the list in the skill text with a shell
  pipeline (no test can hold it to `dirtyPaths`); leave `args.dirty` optional with `[]` as default (a
  caller that forgets it writes a plain line over product edits: AC-2 broken silently).

### D-2 A plan fix reaches `commit` (item 2; AC-3, AC-4)

- `collectState` (non-post-merge return): `planDirty: changedUnder(root, \`openspec/changes/${id}\`)
  .filter((p) => !reviewRecord(id)(p))`. The post-merge return: `planDirty: []`.
- `nextStep`, in the `fix` block, before `return step('fix-review', ...)`:
  `const planDirty = state.planDirty ?? []; if (planDirty.length) return step('commit', \`the fix
  for ${fix.join(', ')} is not committed: ${planDirty.slice(0, 3).join(', ')}\`, { paths: planDirty });`.
  `stop-review-deadlock` keeps its place before it, so a round-2 stop still stops with a plan edit
  pending. `state.planDirty ?? []` keeps every existing `state()` fixture valid.
- An approved (or declined) verdict that lists an undisposed finding follows the rejected rule:
  `findingsIn`'s loop body moves into `export function undisposedIn(root, file, head)` (the
  undisposed entries of one file; `findingsIn` sums it and keeps its output byte for byte);
  `verdictAllowed(id, name, verdict, open)` returns `reviewRecord(id)` when
  `!approved(verdict) || open`; `readReviews` passes `open = undisposedIn(root, file,
  facts.head).length > 0`, where `file` is `join(changeDir(root, id), 'reviews', name + '.md')`,
  built from the `name` that `verdictFiles` returns (it returns no path). Without it the approved
  case loops: after the plan fix is committed
  the approved verdict stays current, the finding stays undisposed, and `next` answers
  `fix-review` again (AC-4).
- The round after the commit: `nextStep`'s round rule is unchanged. A rejected verdict after a
  `FAIL (round 1/2)` gets `review` at round 2; an approved verdict with an undisposed finding under
  `PASS` gets `review` at round 1 (proposal, "Flagged").
- `ship-change` `commit` row: "`next.paths` lists only the paths outside `openspec/`; ..." becomes
  "`next.paths` lists the paths outside `openspec/`, or, after a review asked for a fix, the change
  folder's own files the fix left uncommitted; the rest of the change folder and
  `openspec/config.yaml` are staged from `git status`." The `fix-review` row's "Then `commit` (or
  `push` once a PR exists)" becomes "Then run the loop again: it hands `commit` for what the fix
  left uncommitted (or `push` once a PR exists)"; the words "approved review" stay (pinned by
  `review round: text the ship-change review row ...` in `review-round.test.mjs`).
- Docs: `docs/openspec-flow.md` "The `Commit:` staleness rule" (the narrower rule covers an
  approved verdict with an undisposed finding; "and `next` stays on `fix-review`" gains "while only
  the record is uncommitted; a plan file edited and not committed is handed to `commit` first") and
  "Order of the delivery steps" (`commit` for a plan fix before `fix-review`); the `review-change`
  skill's stale bullet ("for a rejected verdict, anything outside the change's own review record"
  gains "or an approved one that still lists an undisposed finding").
- Alternatives rejected: make the rejected verdict stale on an uncommitted plan file (the review
  would run on an uncommitted tree, and `review` commits the folder anyway: one more step for the
  same result); hand `commit` for any uncommitted change-folder file (a tick or a header write
  after an approved round would block on a commit no review needs).

### D-3 The flow reader refuses a newer flow clearly (item 3; AC-5, AC-6)

- Reader only (the owner's answer, 2026-11-23): no flow file changes in this release. The optional
  field a future flow file may carry is a top-level `"readerRelease": "<x.y.z>"`, the
  devkit-openspec release from which the reader reads that file; it enters with the next flow
  change, which raises the version anyway (CONTRIBUTING.md, "Changing the OpenSpec schemas").
  Older readers ignore top-level keys (`readFlowFile` checks none), so such a file stays readable by
  every installed release whose stage keys it uses.
- Where the reader's newest version lives: `export const FLOW_VERSIONS = Object.freeze({ devkit: 2,
  'devkit-lite': 2, 'devkit-project': 1 })` in `guard.mjs`, beside `STAGE_KEYS` (the CI job
  downloads `guard.mjs`; no import). It equals the shipped versions; the next flow change raises the
  entry of its script with the file (the test of D-10 fails when the two differ).
- `readFlowFile`, right after `JSON.parse` succeeds: when `flow` is an object, `flow.version` is a
  whole number, `flow.script` is a key of `FLOW_VERSIONS` and `flow.version >
  FLOW_VERSIONS[flow.script]`, throw `new FlowUsageError(...)` with the text
  `flow.json of <name> is version <v> of the <script> flow, and this devkit-openspec reads that flow up to version <newest>: it needs devkit-openspec <readerRelease> or later; update the plugin and restart the session`,
  or, when `readerRelease` is missing or not a string matching `^\d+\.\d+\.\d+$`, the same text
  with `it needs a later devkit-openspec; update the plugin and restart the session`. No other
  check runs first, so an unknown stage key of a newer file never shows. A non-integer `version`
  falls through to today's `is not a whole number from 1` (the test `version-pin AC-4 readFlowFile:
  a version is a whole number from 1` is unchanged).
- At a known version, after today's checks: a `readerRelease` that is present and not such a string
  is `bad(\`readerRelease ${JSON.stringify(v)} is not a release number such as 1.2.3\`)`. Every
  other check, the unknown-key message included, is unchanged (AC-6).
- A script outside `FLOW_VERSIONS` (a project's own) has no ceiling: read as today.
- The shipped `flow.json` files of `devkit` and `devkit-lite` stay byte-identical to their
  `flows/2.json` (both schema copies); a test pins it (D-10), beside `scripts/check.py`'s digest
  check.
- Docs: one sentence in `docs/openspec-flow.md`, "The flow a change follows": a reader from this
  release on refuses a `flow.json` newer than it knows, saying to update devkit-openspec and
  restart the session, and names the release when the file carries `readerRelease`; an unknown key
  at a known version stays malformed. A second sentence after "A change to a `flow.json` raises its
  `version`": a new version adds `readerRelease` with the release that ships it, and raises
  `FLOW_VERSIONS` in `guard.mjs`.
  `CONTRIBUTING.md`, "Changing the OpenSpec schemas" (where raising a version is described), gains
  the same two steps.
- Alternatives rejected: flow version 3 now, carrying the field (the owner chose reader only: every
  change opened after the release would move to a new flow with no stage change); a sidecar file
  next to `flow.json` (every reader would need a second file); writing the field into
  `flows/2.json` (a released version never changes); one global ceiling for all scripts
  (`devkit-project` moves on its own).

### D-4 `write-back ask` by number (item 4a; AC-7)

`writeBackAsk`, line 1414: `if (readWriteBack(file))` becomes
`if (writeBackAsked(readWriteBack(file), task.key, read.number))`. A record for another number or
another key falls through and `saveWriteBack` replaces it with the change's key and the new number;
a damaged record (`{ corrupt: true }`) reads as asked, as in `nextAction`.

### D-5 The connector's error on standard input (item 4b; AC-8)

- `runReply` gains the option `--stdin <name>`: the parameter `<name>` is read from standard input.
  The value is the input with one final `\r\n`, else one final `\n`, removed (the heredoc's);
  every other byte, inner line breaks included, is kept. Refusals, each a `LoopUsageError` (exit 3,
  no reply printed), checked in this order: `--stdin` without a name (the existing parser error,
  `--stdin needs a value; usage: ...`); a name that is not `[a-z][a-zA-Z]*` (`--stdin needs a
  parameter name of letters, starting with a lower-case one`); a `--param` of the same name
  (`--param error and --stdin error name the same parameter`); a value that is empty once the final
  line break is removed, so an input of only `\n` or `\r\n` counts as empty (`reply --stdin error
  needs the text on standard input`).
- `main` passes `stdin` to `runReply`; `isMain` reads standard input for `reply` only when the
  arguments hold `--stdin` (a `reply` without it never waits on an empty pipe: `readStdin` waits up
  to 10 s for one). `USAGE` and the module header line 10 gain `[--stdin <name>]`.
- `plugins/openspec/skills/devkit/SKILL.md`, `### Writing back to the task`: the failure sentence
  becomes "On a connector failure, run the call below with the connector's error message on
  standard input, through the quoted heredoc and its terminator rule, and say what it prints; the
  write is not retried." followed by the fenced call
  `node <skill-dir>/../../hooks/change-loop.mjs reply write-back-failed --param key=<KEY> --stdin error --lang ${user_config.language} <<'DEVKIT_ARGS'`,
  `<the connector's error message>`, `DEVKIT_ARGS`. The `cannot-accept` and `blocked` uses keep
  `--param error=` (requirements, Out of scope).
- Alternative rejected: `reply` reading standard input on its own whenever it is not a terminal
  (the call form `reply write-back-failed --param key=<KEY>` with no option). `readStdin` waits up
  to 10 s on an open, empty pipe, and `reply` is called by many skill lines with no input, so every
  one of them could stall; and which parameter the input fills would be implicit. The explicit
  `--stdin <name>` names the parameter and leaves every other `reply` call as it is.

### D-6 `task-taken` inside the open lock (item 4c; AC-9)

`openCheckout(cwd, id, { ..., check })` passes `check` to `openUnderLock`, which calls `check?.()`
right after the fetch and before the two name checks (`name-taken`, the remote branch). The order
is chosen to keep today's reply: an `open --task` on the id of the key's own unfinished change
answers `task-taken` (it names the change and how to continue it), as the pre-lock check does
today, never `name-taken`; the `jira-tasks` delta states it ("An opening on the id of the key's own
change") and D-10 has its test. The check sees the origin as the fetch just left it.
`openChange` drops its pre-lock block (lines 1979 to 1982) and passes
`check: task ? () => { const taken = unfinished(start, { env, gh }).find((u) => recordedTask(readRequirements(u))?.key === taskKey); if (taken) throw refuse('task-taken', { key: taskKey, id: taken.id }); } : undefined`.
A refusal thrown there happens before `worktree add`, so nothing is created. `project-loop.mjs`
calls `openCheckout` without `check`: unchanged. `unfinished()`, with its `gh` read of the claims,
now runs while the open lock is held; the lock waits up to 60 s, and a slow `gh` lengthens a
waiting second `open` by that read only.

### D-7 The blocked half of the write-back condition (item 4d; AC-10)

No code change. One test in `change-loop.test.mjs` with the fixture of `change-loop next: a pull
request conflicting in another file ends blocked as a pull request problem` (line 887):
`deliveredChange({ conflicts: ['CHANGELOG.md', 'README.md'], mergeable: 'CONFLICTING', checks:
[check('build', 'pass')], requirements: TASK_REQUIREMENTS })`, already proven to end `blocked` /
`pr-problem`: the action is an end with `state: blocked`,
`task` is present and `writeBack` is absent. The budget half keeps its test (`jira-entry AC-6 next
carries the task but no writeBack on a budget end held at the pull request`). The new test passes
before and after this change; its proof is the mutation run of task 4.4: with
`action.end.state === 'blocked' ||` removed from `stopped`, it fails.

### D-8 The id prefix in the spec (item 4e; AC-11)

No code change. `specs/jira-tasks/spec.md` adds "The change id's prefix comes from the key" with one
scenario per step. `jira-task.test.mjs` gains one test per scenario (D-10), each calling
`taskIdPrefix` with the scenario's input.

### D-9 Docs and release

- Docs: `docs/openspec-flow.md`, the CI pin `v0.33.0` (three places) moves to the new tag.
- Release (CONTRIBUTING.md step 5), at the last merge of main: devkit-openspec and devkit-core each
  take the next minor after main's (`0.34.0` and `0.15.0` if no sibling took them first), the
  marketplace too (`0.38.0` then), in both `plugin.json` files and `.claude-plugin/marketplace.json`;
  a `CHANGELOG.md` section; `python3 scripts/gen-catalog.py`. No flow file, kept flow or digest
  changes. The tag `v<devkit-openspec version>` is pushed after the merge (`tag-release`).

### D-10 Tests

Every new test's name starts `jira-entry-followups AC-<n> ` (or `jira-entry-followups docs:`). Each
new hook test takes its env from the file's fixtures (`cleanEnv`, `SET`, `deliveredChange`'s `env`).

| Test (file) | Proves | AC |
|---|---|---|
| `AC-3 a plan fix edited after a rejecting round is handed to commit, not fix-review` (`deliver-check.test.mjs`) | `rejectedLoop`, committed; `design.md` edited: `t.next()` is `commit` with `paths` `['openspec/changes/feat/design.md']`. Red before D-2 (`fix-review`): the reproduction | 3 |
| `AC-3 an approved verdict's undisposed finding fixed in the plan is handed to commit` (same) | approved file with `- [important] x`, `design.md` edited: `commit` | 3 |
| `AC-3 only the review record uncommitted keeps fix-review` (same) | for each of `reviews/x.md`, `review.md`, `evidence.md` alone: `fix-review` | 3 |
| `AC-3 a plan edit after the round-2 stop still stops` (same) | `FAIL (round 2/2)` and `design.md` edited: `stop-review-deadlock` | 3 |
| `AC-3 a plan edit with nothing to fix is not a commit step` (same) | all approved, no finding, `design.md` edited: the step is the one it was without the edit | 3 |
| `AC-3 nextStep: planDirty with a fix gives commit, without a fix or without planDirty it does not` (same, `state()` fixture) | the three branches of the new row | 3 |
| `AC-4 the committed plan fix gets review at round 2, never fix-review again` (same) | `fix-review` → edit → `commit` → commit → `review` round 2 `['code-quality-reviewer']` | 4 |
| `AC-4 an approved verdict with an undisposed finding goes stale after a plan commit, and its record alone keeps it` (same) | `readReviews` `why` names the commit and `design.md`; next `review`; a record-only commit keeps it current and `fix-review` | 4 |
| `AC-4 a disposed finding keeps the approved rule` (same) | `fixed in <sha in history>` and `refuted:` each stay current after a `design.md` commit | 4 |
| `AC-4 a test-spared reviewer's approved verdict with an undisposed finding goes stale after a test-only commit` (same) | `spec-reviewer` approved with `- [important] x`, commit of `src/a.test.ts`: stale | 4 |
| `AC-4 the stage readout offers the review again after an approved verdict's finding is fixed in the plan` (`flow-check.test.mjs`) | the readout's review stage is stale with the reason code `stale-reviewers` naming `test-coverage-reviewer` | 4 |
| `docs: the ship-change commit row and the flow document name the commit of a plan fix` (`deliver-check.test.mjs`) | the `commit` row's `next.paths` sentence, the `fix-review` row's "run the loop again", and the two paragraphs of `docs/openspec-flow.md` | 3, 4 |
| `AC-1 review-round tree lists no openspec path` (`review-round.test.mjs`) | `evidence.md`, `design.md` edited, an untracked `openspec/` file: `dirty` `[]`, `head` the full sha | 1 |
| `AC-2 review-round tree lists every path that counts` (same) | modified, staged, untracked, tracked `.claude/` file, rename source out of `openspec/`; untracked `.claude/worktrees/x/a.txt` alone gives `[]`; a folder with no git exits 3 | 2 |
| `AC-2 review-round tree refuses a root it cannot read` (`review-round.test.mjs`) | one CLI call each: input `{}`, `{ root: 7 }`, `{ root: '' }`: exit 3, `review input invalid: root must be a path`; a folder with no git and a `git init` folder with no commit: exit 3, `review input invalid: <root> is not a git worktree with a commit`; stdout empty in every case | 2 |
| `AC-2 review-round tree resolves a relative root` (same) | `{ root: '.' }` with the CLI's current folder at the worktree: the same output as with the absolute path | 2 |
| `AC-1 the round's tree rule is the delivery check's` (`deliver-check.test.mjs`) | for each tree of the two rows above, `treeState(root).dirty` deep-equals `gitFacts(root).dirty` | 1, 2 |
| `AC-1 a round with only openspec files uncommitted writes plain Commit lines that deliver-check reads as current` (same) | scratch change, approvals, `evidence.md` dirty: `tree` → `outcomes` CLI → each job's line 2 has no marker; the files written as the prompt says pass `check-file`; `reviewsItem` lists none stale | 1 |
| `AC-2 a round with a product file uncommitted writes the marker and deliver-check lists it stale` (same) | `src/a.mjs` dirty: line 2 with the marker; `reviewsItem` reason `recorded with uncommitted changes` | 2 |
| `AC-1 validateArgs refuses args without a dirty list` (`review-round.test.mjs`) | missing, not a list, an empty string inside; each `stage1`/`verify`/`outcomes`/`consolidate` CLI call exits 3 | 1 |
| `AC-1 a reviewer's uncommitted flag changes nothing` (same) | `uncommitted: true` with `dirty: []`: line 2 plain; `uncommitted: 1` is not refused | 1 |
| `AC-1 the stage-1 prompt asks no uncommitted flag and states the rule` (same) | no `uncommitted` in the JSON shape; the sentence of D-1 | 1 |
| `AC-1 the Workflow script refuses args without dirty` (same, the existing Workflow-run harness of the file) | throws `review input invalid:` before any agent | 1 |
| `docs: the review skill and the ship-change review row fill args.dirty from review-round.mjs tree` (same) | the two texts | 1 |
| `AC-5 readFlowFile refuses a newer flow with the update to make` (`version-pin.test.mjs`) | version `FLOW_VERSIONS.devkit + 1`, no `readerRelease`, a stage key `colour`: the second text of D-3 exactly, no `malformed`, no `unknown key` | 5 |
| `AC-5 a newer flow that names its release gets it in the message` (same) | the same file with `readerRelease: '9.1.0'`: the first text of D-3 exactly | 5 |
| `AC-5 a newer flow with a release field that is not a release number gets the text with no release` (same) | `'soon'`, `9`: the second text | 5 |
| `AC-5 a script outside FLOW_VERSIONS has no ceiling` (same) | `script: 'mine'`, version 99: read | 5 |
| `AC-5 a release number that cannot be read at a known version is malformed` (same) | `readerRelease: 'soon'` and `readerRelease: '1.2'` at a known version: `flow.json of devkit is malformed: readerRelease "soon" is not a release number such as 1.2.3` (and the same for `1.2`) | 5 |
| `AC-5 a release number at a known version is accepted` (same) | `readerRelease: '1.2.3'` at a known version: the file is read | 5 |
| `AC-6 an unknown stage key at a known version is still malformed` (same) | `flow.json of devkit is malformed: stage mockup has an unknown key colour` | 6 |
| `AC-5 FLOW_VERSIONS equals the version of each shipped flow.json` (same) | both copies, three scripts | 5 |
| `AC-5 the shipped flow.json files stay byte-identical to flows/2.json` (same) | `devkit` and `devkit-lite`, both schema copies: version 2, bytes equal, no `readerRelease` | 5 |
| `AC-7 write-back ask by key and number` (`change-loop.test.mjs`) | same key and number: asked, record unchanged; same key, number 15: `ask: true`, record number 15; another key: `ask: true`; damaged JSON and `version: 2`: asked, record unchanged | 7 |
| `AC-8 reply --stdin passes the error byte for byte` (same) | `main(['reply', 'write-back-failed', '--param', 'key=PROJ-482', '--stdin', 'error', '--lang', 'en'], { stdin })` with quotes, `$(rm -rf x)`, backticks and a newline, plus the heredoc's final newline: the reply holds the error unchanged | 8 |
| `AC-8 reply --stdin refuses an empty input, a duplicate name, a bad name and no name` (same) | stdin `''`, `'\n'` and `'\r\n'`: `reply --stdin error needs the text on standard input`; `--param error=x --stdin error`: `--param error and --stdin error name the same parameter`; `--stdin Error` and `--stdin 1x`: `--stdin needs a parameter name of letters, starting with a lower-case one`; `--stdin` last: `--stdin needs a value`; each exit 3, no reply | 8 |
| `AC-8 reply --stdin removes one final line break, \r\n or \n` (same) | stdin `'a\r\nb\r\n'` gives `a\r\nb`; `'a\n\n'` gives `a\n` | 8 |
| `AC-8 reply without --stdin reads no standard input` (same, a spawned process with its standard input left open) | exits at once with the rendered reply | 8 |
| `AC-8 a spawned reply --stdin reads the error from a heredoc` (same) | `spawnSync('bash', ['-c', ...<<'DEVKIT_ARGS' ...])`, no file named `x` appears, the reply holds the text | 8 |
| `AC-9 two open --task calls for one key at once create one change` (same) | the test holds `devkit-open.lock`, starts `proj-482-a` and `proj-482-b` with `FAKE_TASK`, releases the lock: codes `[0, 3]`, one worktree, the reply `task-taken` naming the created id. Red before D-6 (`[0, 0]`) | 9 |
| `AC-9 open --task on the id of the key's own unfinished change answers task-taken` (same) | `taskOpen(t.main, 'proj-482-login-timeout')` twice: the second exits 3 with `task-taken` naming `proj-482-login-timeout`, not `name-taken`; `snapshot` unchanged | 9 |
| `AC-10 next carries no writeBack on a blocked end held at the pull request` (same) | the fixture of line 887 with `requirements: TASK_REQUIREMENTS` (D-7): end `blocked` / `pr-problem`, `task` present, no `writeBack` | 10 |
| `AC-11 taskIdPrefix: lower case`, `underscores`, `runs collapsed`, `a trailing dash removed` (`jira-task.test.mjs`) | the four scenarios | 11 |

Existing tests that change, each in the task that changes its rule, its invariant named in the
commit message (found with `grep -n` over `plugins/openspec/hooks/*.test.mjs`,
`plugins/core/skills/review-change/scripts/*.test.mjs`, `scripts/*.py`, the `flow.json` files and
every `argument-hint`):

| Test (file) | Today | After | Task |
|---|---|---|---|
| `review-openspec-fix 12: a plan fix written and not committed leaves a rejected verdict current` (`deliver-check.test.mjs`) | stale `[]` | stale `[]` and, through `readyRepo`, next `commit`; renamed `... and hands it to commit` | 1.2 |
| `baseArgs` fixture (`review-round.test.mjs`) | no `dirty` | `dirty: []` | 2.2 |
| `review round: validateStage1 rejects a malformed return ...` (same) | `{ uncommitted: 1 }` refused | that row removed (AC-1 row above covers it) | 2.2 |
| `review round: writerPrompt holds every line verbatim and the commit line` (same) | marker from `stage1Of(..., { uncommitted: true })` | marker from `baseArgs({ dirty: ['src/a.mjs'] })` | 2.2 |
| `jira-entry AC-7 skill: Jira is written only through write-back answer ...` (`change-loop.test.mjs`) | matches `--param error="<message>"` | matches `reply write-back-failed --param key=<KEY> --stdin error`, `<<'DEVKIT_ARGS'` and no `--param error=` in that call | 4.2 |
| the CI-pin test of `change-loop.test.mjs` (`/v0\.33\.0/`, line 2578) | `v0.33.0` | the new tag | 5.2 |
| `upfront AC-4 lock agent: a helper of the requirements stage is read from the flow the change is pinned to` (`roadmap-loop.test.mjs:4048`) | installs a flow at `kept.version + 1` (3), which the new reader refuses (`roadmapAgentDecision` would then not allow the helper) | invariant kept (a change follows the flow it is pinned to, not the installed one) with no version above `FLOW_VERSIONS`: the pinned flow is `{ ...kept, version: kept.version - 1 }` written to `flows/1.json` with the pin `x-devkit-flow: 1`, and the installed `flow.json` and `flows/2.json` are the changed flow at `kept.version` (2) | 3.1 |
| `upfront partOfStage: the part of a stage is read from the flow the change is pinned to` (`roadmap-loop.test.mjs:4069`) | the same fixture; `partOfStage` swallows the refusal | the same rewrite: pinned version 1 file with `design` in `plan`, installed version 2 with `design` in `build` | 3.1 |

Pinned and unchanged: `item 2` and `staleness` tests of the `(uncommitted changes)` marker
(`deliver-check.test.mjs`), `project-loop ci: followups 6` (`project-loop.test.mjs`), `parseCommitLine`,
`version-pin AC-4 readFlowFile: a version is a whole number from 1`, `flow-check.test.mjs`'s
`appliesWhen` refusals (`an unknown key` is a key of `appliesWhen`, not a stage key), `jira-entry
AC-5 open --task refuses a second change ...`, `jira-entry AC-1 taskIdPrefix ...`, the
`argument-hint` of the devkit skill (no form changes), `guard.test.mjs`'s version-2 sentences of the
flow doc and the 0.37.0 changelog entry (kept), and every flow-version test of `version-pin.test.mjs`,
`change-loop.test.mjs` (`upfront AC-5 flow: ...`) and `flow-check.test.mjs` (no flow file changes),
and `review round: readReviewMd reads consolidate's Consensus line and round`
(`deliver-check.test.mjs:1599`), whose `args` have no `dirty` and reach only `outcomeOf` and
`consolidate`, never `validateArgs` (`outcomeOf` guards with `Array.isArray`). The flow-version
tests above were found with `grep -n "version + 1\|version: [3-9]" plugins/openspec/hooks/*.test.mjs`;
its other hits read no flow file above version 2 through `readFlowFile`
(`version-pin.test.mjs:645` and `release-tags.test.mjs:253`, `:284` are plugin manifests;
`version-pin.test.mjs:755` pins a change to 3 with no `flows/3.json`, refused by the pin check
before any read; `version-pin.test.mjs:955` is a `scripts/check.py` run). Task 3.1 runs the grep
again and rewrites any new hit that installs a flow above `FLOW_VERSIONS` the same way.

## Risks / Trade-offs

- [The next flow change forgets to raise `FLOW_VERSIONS`, and the new reader refuses its own
  shipped flow] → the test `AC-5 FLOW_VERSIONS equals the version of each shipped flow.json` fails
  in that change; the flow document's sentence (D-3) names the step.
- [Two copies of the dirty-path rule drift] → the parity test runs both on the same trees.
- [`args.dirty` required breaks a caller that builds `args` by hand] → both callers are the
  `review-change` skill's two paths, changed in tasks 2.2 and 2.4; the CHANGELOG line says so.
- [A change-folder file left uncommitted for another reason (a tick) blocks a needed `fix-review`]
  → the step is `commit`, which commits it; one extra commit, never a loop (AC-3 negatives).
- [A sibling (`stale-only-on-own-files`) edits `staleness` and merges first] → different
  functions; the merge of main re-runs phase 1's gate (CONTRIBUTING.md step 5).
- [No shipped file carries `readerRelease` yet, so a reader of this release meeting the next flow
  version names no release unless that change adds the field] → D-3's doc sentence makes it part of
  raising a version; the message without it still says what to do.

## Migration Plan

Nothing to migrate: no flow file changes, so projects need no `openspec-setup` re-run and changes
under way keep their flow. Updating the plugins brings the new reader, the `tree` subcommand and the
loop fixes. Rollback: revert the merge commit.

## Implementation plan

Dependency order: the delivery check (D-2), the review round (D-1, which reads `gitFacts` in its
parity test), the flow reader (D-3), the loop's nits (D-4 to D-8), then docs and release (D-9).

| Surface | Change |
|---|---|
| devkit-openspec hooks | `deliver-check.mjs` (D-2), `guard.mjs` (D-3), `change-loop.mjs` (D-4 to D-6) |
| devkit-openspec skills | `ship-change/SKILL.md` (D-1, D-2), `devkit/SKILL.md` (D-5) |
| devkit-core | `review-change/scripts/review-round.workflow.js`, `review-round.mjs`, `review-change/SKILL.md` (D-1, D-2) |
| Repository | `docs/openspec-flow.md`, `CHANGELOG.md`, `.claude-plugin/marketplace.json`, both `plugin.json`, catalog files |

Files created: none. Files modified: the ones above and the test files of D-10. Files deleted:
none. Unchanged on purpose: every `flow.json`, `flows/<n>.json` and `scripts/released-flows.json`.

Estimate: optimistic 13.5 h, likely 20.5 h, pessimistic 28 h (the pessimistic case is fixtures that
expect `fix-review` with change-folder files left uncommitted).

| Component | Hours | Type | Risk |
|---|---|---|---|
| D-2 `commit` row, `planDirty`, approved-with-open staleness | 3 | Core | MEDIUM |
| D-2 tests (AC-3, AC-4) | 3 | Testing | MEDIUM |
| D-1 `tree`, `args.dirty`, prompt, skill texts | 2 | Core | LOW |
| D-1 tests and parity | 2.5 | Testing | LOW |
| D-1 real-run proof (task 2.5) | 1.5 | Testing | MEDIUM |
| D-3 reader and `FLOW_VERSIONS` | 1 | Core | LOW |
| D-3 tests (AC-5, AC-6) and the two `roadmap-loop` rewrites | 2 | Testing | MEDIUM |
| D-4 to D-6 code and skill text | 1.5 | Core | LOW |
| D-4 to D-8 tests (AC-7 to AC-11) | 2.5 | Testing | MEDIUM |
| D-3 and D-9 docs | 0.5 | Documentation | LOW |
| D-9 release and gates | 1 | Integration | LOW |

Risks (probability × impact, mitigation):

- Hidden `fix-review` expectations with change-folder files left uncommitted in fixtures: MEDIUM ×
  LOW. Mitigation: phase 1's gate runs the `deliver-check`, `flow-check` and `conduct-check`
  suites and phase 4's the `change-loop` suite; a fixture whose uncommitted non-record file is incidental gets it committed,
  named in the commit message.
- The AC-9 race test flaky on a loaded machine: LOW × MEDIUM. Mitigation: the test writes
  `devkit-open.lock` itself before it starts both children, as `change-loop open: a lock held by
  another call is waited for, and one older than ten minutes is taken over` does, waits 1 s so both
  have passed their pre-lock steps, then removes it; which child wins does not matter, only that one
  does.
- A sibling takes the version numbers first: MEDIUM × LOW. Mitigation: the numbers are
  set at the last merge (CONTRIBUTING.md step 5).

Assumptions (where the plan breaks if reality differs):

- `review-change`'s two paths are the only builders of `args` (`grep -rn "structural: \"PASS\""` over
  `plugins/`, `docs/`): source, `plugins/core/skills/review-change/SKILL.md` step 4.
- Older readers ignore top-level keys of `flow.json`: source, `guard.mjs#readFlowFile` at `697f699`
  (it validates `stages` keys only) and `requirements.md` (0.21.1 refused a stage key,
  `appliesWhen`, not a top-level one).
- The `commit` hand-off stages the change folder from `git status`: source, `ship-change` `commit`
  row.
- `unfinished()` sees a change opened by another call once that call released the lock: source,
  the sequential test `jira-entry AC-5 open --task refuses a second change ...`.

Dependencies: `jira-entry`, `review-openspec-fix`, `change-version-pin`, `review-writer-prompt`
(all archived on main, `proposal.md` Dependencies); the `openspec` CLI 2.x on `PATH` for the suites.
