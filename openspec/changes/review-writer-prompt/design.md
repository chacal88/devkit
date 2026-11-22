<!-- devkit-stage design result=passed attempt=1 commit=2300f84524e5c1ec5ed8a0da41e5a5dccff9cc34 -->
# Design

Change: `review-writer-prompt` · Date: 2026-11-21 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(sources: `requirements.md`, `proposal.md`, the four spec deltas of this change).

## Context

See `proposal.md` (Why). The code each finding lives in, read at `2300f84` (devkit-core 0.8.1,
devkit-openspec 0.18.1):

| Finding | Where | What it does today |
|---|---|---|
| Writer prompt | `plugins/core/skills/review-change/scripts/review-round.mjs#outcomesCommand` | Returns `{ outcomes, failed, verifiersFailed }` only. The Workflow script builds each writer call inline in its `write` phase from `writerPrompt(run, o)` |
| One sha | `review-round.workflow.js#reviewerPrompt`, `#validateStage1` | The prompt shows `disposition: null or "fixed in <sha>" or "refuted: <evidence>"` and says nothing about one sha. The validator's `/^(fixed in [0-9a-f]{7,40}\|refuted:\s*\S.*)$/i` already refuses `fixed in a and b` |
| HEAD | `#validateArgs`, `#validateStage1`, `#STAGE1_SCHEMA` | `args` has no head. `validateStage1(reviewer, value)` checks only that `commit` is 40 hex, so a short sha padded with zeros passes |
| Files read | the same | The stage-1 object has no list of files, so a review of one file out of 54 passes |
| Verdict and Commit lines | `#validateStage1`, `#outcomeOf`, `#writerPrompt`; `review-round.mjs#checkFileCommand` | `sections` is copied verbatim into the outcome and then into the writer prompt. `check-file` checks lines 1 and 2 and the blocking or important lines, and ignores the rest |
| The agents' own text | `plugins/core/agents/<six>-reviewer.md`, "Staged round" | Stage 1 asks for "the verdict and the commit as you would write them", and the stage-1 shape has no verdict key, so the verdict lands in `sections` |
| Test-only staleness | `plugins/openspec/hooks/deliver-check.mjs#staleness`, `#readReviews` | Any commit after the recorded one that touches a path outside `openspec/` makes the file stale, the same for every reviewer and for `evidence.md` |
| Review stage | `plugins/openspec/hooks/flow-check.mjs#artifactState` | A `codeBound` stage is stale when its header commit is stale (the same `staleness`). Reviewer files are not read |
| Fenced tasks | `deliver-check.mjs#parseTasks`; `flow-check.mjs#fencedLines`, `#countedTasks` | `parseTasks` reads every checkbox line. `flow-check` drops the fenced lines from OpenSpec's task list with its own `fencedLines` |

Callers found with `grep -rn "validateStage1(\|structural" plugins --include=*.mjs --include=*.js --include=*.md`:
only the `review-change` skill builds `args`. Only the two paths and `review-round.test.mjs` call
`validateStage1`. Only `deliver-check.mjs#readReviews` judges a verdict file's staleness. Its callers
are `reviewsItem`, `collectState` (behind `nextStep`, `change-loop.mjs`, `conduct-check.mjs`,
`roadmap-loop.mjs` and the panel) and the `devkit-reviews` check.

Constraints that shape every decision below:

- The round's rules live once, between `// ---- rules: begin` and `// ---- rules: end` of
  `review-round.workflow.js`. `review-round.mjs#loadRules` reads them, and the section stays pure
  (ADR 0008 decisions 1 and 5; pinned by `review-round.test.mjs`, "the script holds no module
  loading, clock, randomness, process or fs use").
- `guard.mjs`, `deliver-check.mjs` and `merge-setup.mjs` are the three files a project's
  `devkit-reviews` workflow downloads (`docs/openspec-flow.md`, CI). No new module and no new import
  between them. `flow-check.mjs` already imports from `deliver-check.mjs`.
- `scripts/check.py#check_panel_parity` compares the literals `SECTION_RE`
  (`/^##\s+(\d+)\.\s*(.*)$/`) and `TASK_RE` (`/^\s*[-*]\s+\[([ xX])\]\s+(\S+)\s*(.*)$/`) of
  `plugins/panel/hooks/grammar.ts` with `deliver-check.mjs`. Both stay byte-identical there.
- Product code is closed until the owner approves this plan (the `guard.mjs` edit lock).

## Goals / Non-Goals

**Goals:**

- Every new stage-1 rule lives in the rules section, so the `workflow` and `agents` paths refuse
  the same answers. The cross-path test (`review-round.test.mjs`, "cli equals the workflow")
  stays green.
- One staleness function with one new option, and one fence helper shared by both checkers.
- Every existing test that changes is listed with its invariant (D-9).

**Non-Goals:**

- A reason in a review-stage `failed` entry. The Workflow script already logs the validator's message.
  Two tests pin the entry's exact shape (`review-round.test.mjs`, "workflow reports a failed stage 1
  …" and "cli verify makes three jobs …").
- Writer jobs in the Workflow script's result. On a `write` failure of the `workflow` path, the
  session keeps building stage 3 from the `outcomes` entry, as today.
- Changing the panel's `tasks.md` reader (`plugins/panel/hooks/steps.ts`), `guard.mjs#parseRoadmap`
  or `deliver-check.mjs#roadmapFacts`.
- A new reason code in `deliver-check`, a new step, or a new field in its `--json` report.

## D-1 `args.head` and the stage-1 checks (AC-4, AC-5; spec `review-round`)

In the rules section of `review-round.workflow.js`:

- `validateArgs(args)`: after the loop over `change`, `changeDir` and `range`:
  `if (typeof args.head !== 'string' || !/^[0-9a-f]{40}$/.test(args.head)) invalid('args.head must be the full 40 hex sha git rev-parse HEAD prints');`.
- `validateStage1(reviewer, value, head)` takes a third, required parameter. Right after the reviewer
  check it refuses a bad head: `invalid('head must be a full 40 hex sha')`. After today's checks, in
  this order:
  1. `value.commit !== head` → `invalid(reviewer + ': commit ' + value.commit + ' is not HEAD ' + head)`;
  2. `read` not an array, or holding an entry that is not a non-blank string → `invalid(reviewer + ': read must be a list of paths')`;
  3. the same for `notRead` → `invalid(reviewer + ': notRead must be a list of paths')`;
  4. `value.notRead.length > 0` → `invalid(reviewer + ': partial review: not read ' + value.notRead.slice(0, 3).join(', '))`;
  5. `value.declined === false && value.read.length === 0` → `invalid(reviewer + ': partial review: nothing read')`.

  The returned object keeps today's keys. `read` and `notRead` are not returned, so neither the
  outcome, the verdict file nor `review.md` carries them (`requirements.md`, Assumptions).
- Call sites: the Workflow script's review phase calls `validateStage1(e.reviewer, reviewed[i], run.head)`,
  and `review-round.mjs#readStage1` calls `validateStage1(entry.reviewer, value, args.head)`.

A refused answer takes the existing path. In the Workflow script, the `catch` pushes
`{ reviewer, stage: 'review', error: 'review stage failed: <r> review' }` and logs the message. In
`readStage1`, the reviewer goes to `failed` through `failedReview`. In both cases the reviewer gets no
verifier and no outcome. Nothing else changes.

**Alternatives.** *Compare in the session, not in the script.* Rejected: the coordinator-field-fixes
retro asks for the script to refuse it, and only the rules section serves both paths. *Make `head`
optional in `validateStage1` and skip the check without it.* Rejected: a caller that forgets it would
get today's loophole back silently. *Put the head sha in the stage-1 prompt.* Rejected: a reviewer
could copy it without running `git rev-parse HEAD` in the tree it reviews (spec `review-round`, "The
prompt does not give the answer away").

## D-2 The stage-1 prompt and schema (AC-2, AC-3; spec `review-round`)

`STAGE1_SCHEMA` (rules section):

- `required` gains `'read'` and `'notRead'` (after `'heading'`).
- `read`: `{ type: 'array', items: { type: 'string' }, description: 'every repo-relative path you opened' }`.
- `notRead`: `{ type: 'array', items: { type: 'string' }, description: 'every path of your remit you did not open; empty when you opened them all' }`.
- The `commit` description becomes `'the full 40 hex sha git rev-parse HEAD prints'`. The
  `disposition` description becomes `'null, "fixed in <one sha>" or "refuted: <evidence>"'`. The
  `sections` description becomes
  `'the rest of your output as Markdown, without the findings list and without a Verdict: or Commit: line'`.

`reviewerPrompt(args, entry)`: the lines up to "Review as your own instructions say, but write no
file: …" stay. The `previous` line's parenthesis becomes `(fixed in <one sha>, the commit that holds
the fix, or refuted: <evidence>)`. After the "write no file" line, before "End your reply …", four
lines are added, in this order:

```text
Run git rev-parse HEAD in the worktree and put the full sha it prints in commit; the round refuses any other value, a short sha padded with zeros included.
List in read every repo-relative path you opened, and in notRead every path of your remit you did not open (an empty list when you opened them all); the round refuses an answer with a path in notRead, or with an empty read unless you declined.
A disposition is either fixed in <sha>, naming exactly one sha, the commit that holds the fix, or refuted: <evidence>; never name two shas.
sections holds neither a Verdict: line nor a Commit: line: stage 3 writes both.
```

In the closing JSON shape, `commit: "<full 40 hex sha of HEAD>"` becomes
`commit: "<the full sha git rev-parse HEAD printed>"`. `read: ["<repo-relative path you opened>"],
notRead: ["<path of your remit you did not open>"]` are added after `heading`. The disposition becomes
`null or "fixed in <one sha>" or "refuted: <evidence>"`, and the `sections` placeholder becomes
`"<the rest of your output as Markdown, without the findings list and without a Verdict: or Commit: line>"`.
The prompt never names `args.head`.

**Alternatives.** *Change the disposition validator to accept several shas.* Out of scope
(`requirements.md`).

## D-3 One Verdict line and one Commit line (AC-6, AC-7; spec `review-round`)

In the rules section:

```js
// A line that only lines 1 and 2 of a verdict file may hold: it begins, after optional spaces, with `Verdict:` or `Commit:`.
const HEADER_LINE = /^\s*(?:Verdict|Commit):/;
function isHeaderLine(line) // -> HEADER_LINE.test(String(line))
function withoutHeaderLines(text) // -> String(text).split('\n').filter((l) => !isHeaderLine(l)).join('\n')
```

- `validateStage1` returns `sections: withoutHeaderLines(value.sections)`. `outcomeOf` and
  `writerPrompt` are unchanged, so the outcome's `sections` and the writer prompt's verbatim text hold
  no such line. The prompt's own `line 1:` and `line 2:` instructions are written by `writerPrompt`
  and are not part of `sections`.
- `review-round.mjs#checkFileCommand`: after the line-2 check and before the findings check, the first
  line after line 2 for which `isHeaderLine` holds throws
  `mismatch(file, 'line <n> begins with <Verdict|Commit>:, which only lines 1 and 2 may')`. `<n>` is
  1-based. The CLI exits 2 with `review file mismatch: <file>: …`, as for every mismatch.
- Only lines are removed, and nothing is trimmed, so a `sections` text without such lines stays
  byte-identical (the cross-path test compares them).

The pattern is case-sensitive and plain: the form `requirements.md` names, and the form the field
showed. ADR 0008 decision 4 keeps the two lines' form. This change only stops a copy of them, and
every reader already takes the first `Verdict:` line (spec `verdict-files`).

**Alternatives.** *The readers' wider pattern (a bullet, bold, any case).* Rejected: it widens the
owner's rule. A bold `**Verdict:**` further down cannot change a gate, because the readers take the
first line. *Refuse the stage-1 answer instead of stripping.* Rejected: the owner chose stripping
(question 1 of the grill), and a refusal would cost a re-run for a cosmetic line.

## D-4 The writer jobs (AC-1; spec `review-round`)

In the rules section, beside `verifyJobs`:

```js
// One writer job per outcome, in the order of the outcomes: both paths send exactly these.
function writeJobs(args, outcomes) // -> outcomes.map((o) => ({ reviewer: o.reviewer, agentType: 'devkit-core:' + o.reviewer, prompt: writerPrompt(args, o) }))
```

- The Workflow script's `write` phase sends `writeJobs(run, outcomes)`: `agent(j.prompt, { agentType:
  j.agentType, schema: WRITE_SCHEMA, label: j.reviewer + ' write', phase: 'write' })`. The calls are
  the same as today's.
- `review-round.mjs#outcomesCommand` returns `{ outcomes, failed, verifiersFailed, jobs: writeJobs(a, outcomes) }`.
- `review-round.mjs`'s `NAMES` and its export list gain `writeJobs`, `isHeaderLine` and
  `withoutHeaderLines`.

**Alternatives.** *A new `write` subcommand.* Rejected: `requirements.md` puts the jobs in
`outcomes`, and the skill already calls it at that point.

## D-5 The callers and the reviewers' text (AC-1, AC-3; spec `review-round`)

`plugins/core/skills/review-change/SKILL.md`:

- Step 4, the `args` sentence: the object is
  `{ change, changeDir, round, path, range, head, structural: "PASS", preamble, bench: [...] }`, and
  `head` is "the full sha `git rev-parse HEAD` prints in the change's worktree, run right before the
  round".
- After the three-stage list of step 4: one sentence. The script refuses a stage-1 answer whose
  `commit` is not `args.head`, that lists a path in `notRead`, or whose `read` is empty without
  declining. That reviewer is in `failed` as `review stage failed: <r> review` before the verify
  stage, and the table's first row applies.
- The `agents` path, step 3: the command gives `{ outcomes, failed, verifiersFailed, jobs: [{ reviewer,
  agentType, prompt }] }`. Send one `Agent` call per job (`subagent_type` the job's `agentType`, the
  job's prompt), and never build a writer prompt by hand.
- Output, the `check-file` bullet: the check also refuses a `Verdict:` or `Commit:` line after line 2.
- The Cost paragraph and the "Any code edit after a review makes it stale" bullet: D-6's rule (see
  D-10 for the wording).

`plugins/openspec/skills/ship-change/SKILL.md`, the `review` row: after "at round `next.round`", add
"with `args.head` the full sha `git rev-parse HEAD` prints in the change's worktree right before the
round". The rest of the row stays. The text test "the ship-change review row …" keeps matching.

The six reviewer agents (`plugins/core/agents/{code-quality,test-coverage,architecture,security,adr,spec}-reviewer.md`),
"Staged round", the Stage 1 bullet, with the same text in all six:

```text
- **Stage 1 (review):** review as usual but write no file. Return the shape the caller asks for: the commit as `git rev-parse HEAD` prints it, the files you opened and the files of your remit you did not open, the findings with severity, location, text and any disposition (`fixed in` names one sha), and the rest of your output as the other sections, without your verdict line and your `Commit:` line, which stage 3 writes.
```

This bullet is flagged in `proposal.md`. `requirements.md` does not name it, but today's sentence is
what puts the verdict into `sections`. If the owner drops it, D-3 still removes the pasted line.
`CONTRIBUTING.md` asks that this change's own agents be dispatched with the repository's agent files
as the format source.

## D-6 Test files and the scoped staleness (AC-8; spec `verdict-files`)

In `plugins/openspec/hooks/deliver-check.mjs`, beside `isOpenspec`:

```js
// A test file (review-writer-prompt D-6): `.test.` or `.spec.` in its file name, or a folder named
// test, tests, __tests__ or fixtures on its path. A fixed pattern, no setting.
const TEST_FOLDERS = ['test', 'tests', '__tests__', 'fixtures'];
export function isTestFile(path) // -> name.includes('.test.') || name.includes('.spec.') || folders.some((f) => TEST_FOLDERS.includes(f))
// The reviewers whose verdict a commit of test files only (and openspec/) leaves current.
export const TEST_SPARED_REVIEWERS = ['spec-reviewer', 'adr-reviewer', 'architecture-reviewer', 'security-reviewer'];
```

- `staleness(root, recorded, facts = gitFacts(root), { allowed = isOpenspec } = {})`: the per-commit
  loop takes `const product = files.find((f) => !allowed(f))`. Everything else stays: the
  uncommitted marker, `facts.dirty` (still judged against `openspec/` and `.claude/` only), resolution,
  ancestry and the message. Every existing caller passes no option and keeps today's rule.
- `readReviews`: `why: staleness(root, parseCommitLine(text), facts, TEST_SPARED_REVIEWERS.includes(name) ? { allowed: (p) => isOpenspec(p) || isTestFile(p) } : {})`.
- `evidence.md` (`tasksItem`, `acceptanceItem`) and the stage headers read by `flow-check` keep the
  default, so a test-only commit stales the evidence. `nextStep` then answers `verify` first and then
  `review` for the stale reviewers only, with no change to `nextStep`.

Because the check runs commit by commit, a range with one product commit stales all six, and a commit
that mixes a test file and a product file stales all six. A reviewer outside the six keeps today's
rule.

**Alternatives.** *Judge the whole range's union of files.* Rejected: the requirements say commit by
commit, and the result is the same for the rule as stated. *A per-reviewer map of file kinds, or a
project setting.* Out of scope (`requirements.md`). *Also spare the evidence.* Rejected by the owner
(question 4).

## D-7 The review stage while a reviewer is stale (AC-8; spec `change-stages`)

In `plugins/openspec/hooks/flow-check.mjs`:

- `collectFlow` adds to the facts, beside `staleness`:
  `staleReviewers: () => (postMerge ? [] : readReviews(root, id, gf).filter((r) => r.why).map((r) => r.name))`.
  `readReviews` is imported from `deliver-check.mjs`, which `flow-check.mjs` already imports from.
- `artifactState`: after the `codeBound` loop, when `!stale`, the stage id is `review` and
  `facts.staleReviewers` exists, `const names = facts.staleReviewers()`. A non-empty `names` sets
  `stale = { code: 'stale-reviewers', params: { names } }`. Synthetic facts without the function (the
  `walk` fixture of `flow-check.test.mjs`) keep today's result.
- `TEXT.en` and `TEXT['pt-BR']` gain the key `'stale-reviewers'`, a function of `p` that joins
  `p.names` with `', '` into `the reviews of <names> are stale` and
  `as revisões de <names> estão desatualizadas`. The readout test "both languages cover every
  reason code" covers it once its sample table names the code (D-9).

The header rule is broader than D-6: any commit outside `openspec/` stales the `review.md` header. So
after a test-only commit the review stage is stale by its header alone (the spec's first scenario).
The new check covers a reviewer that is stale while the header is current. That happens with a
reviewer file left at an older commit by a scoped round, or with a file marked `(uncommitted
changes)`. Both stage ids are `review` in the `devkit` and `devkit-lite` declarations
(`flow.json`, read).

**Alternatives.** *No code: rely on the header.* Rejected: the requirement says "whenever", and the
case above shows the header can be current while a reviewer is stale. *Reuse `stale-code`.*
Rejected: "the code changed since it ran" is wrong for a file recorded with uncommitted changes.

## D-8 One fence helper (AC-9; spec `change-delivery`)

- `fencedLines(text)` moves verbatim from `flow-check.mjs` to `deliver-check.mjs`, as an export, with
  its comment (phase 2); phase 4 then changes it for an unclosed fence, as the bullet below says. `flow-check.mjs` drops its copy and imports it. `countedTasks` and `pendingTasks` are
  unchanged.
- `parseTasks(text)` computes `const fenced = fencedLines(text)` and skips every line whose 1-based
  number is in `fenced`, the fenced `## N.` headings included, before it matches a heading or a task.
  Its two regular expressions stay byte-identical (Context, panel parity). `fencedLines` splits on
  `'\n'` and `parseTasks` on `/\r?\n/`, and both give the same line numbers.
- Every reader of `parseTasks` gets the rule with no edit of its own: `readPhases`, `tasksItem`,
  `tasksOnDefault` (so `defaultTasks` and the delivered test), the `started` fact of `collectState`
  and the ticked count of `runSeveral`.
- **An unclosed fence hides nothing** (the owner's rule, chosen on 2026-11-22 after review round 1
  found that a fence with no closing line hid every later task and gate, so item 1 could pass with
  open work). A fence opening line with no closing line before the end of the text is not a fence.
  `fencedLines` keeps its scan; when the scan reaches the end of the text with a fence still open, it
  removes from `inside` that fence's opening line and every line added after it, and resumes the scan
  at the line after the opening line with no fence open. A later fence that opens and closes still
  hides its own lines. The comment above `fencedLines` gains the sentence "An opening line with no
  closing line before the end of the text opens no fence." The closing rule (the next line opening
  with at least as many of the same character) is unchanged, and so is every result for a text whose
  fences all close.
- Why: it fails safe. A misread fence can now only make the checkers count an example checkbox,
  which the author sees and fixes (by closing the fence or ticking the line), and never hide a real
  unticked task or gate. *An unclosed fence runs to the end of the text* (CommonMark's rule, and the
  behaviour before this fix) is rejected for that reason. *Report the unclosed fence* is rejected
  because it needs a new reason code or step, which Non-Goals exclude.
- `flow-check.mjs` gets the rule through its import: `countedTasks` and `pendingTasks` are unchanged,
  so the stage checker counts a task after an unclosed fence as pending. No existing test changes: the
  "flow-check tasks:" and "flow-check stages: a fenced example …" tests and the earlier AC-9 tests
  close every fence they open.
- Tests, in `deliver-check.test.mjs` right after the AC-9 tests of D-10, named
  `review-writer-prompt AC-9 …`: `fencedLines` of a text with an unclosed fence (no line after the
  opening line is in the set, and a closed fence after it is); `parseTasks` of
  `- [x] 1.1 code`, an unclosed backtick fence, `- [ ] 1.2 more` and `` - [ ] 1.3 Gate: `node -e 0` green ``
  (ids `1.1`, `1.2`, `1.3`, with `1.3` a gate holding `node -e 0`); `readPhases` (phase 1 open
  `['1.2']`, gate `1.3`); `tasksItem` (`unticked` is `['1.2', '1.3']`); `nextStep` through
  `planRepo({ tasks })` (step `implement`, reason naming `1.2`); and the flow-check side,
  `pendingTasks` imported from `./flow-check.mjs` given OpenSpec's list for the same text (both
  lines pending).

## D-9 Existing tests that change

Searches: `grep -n "SHA2\|validateStage1(\|baseArgs\|stage1Of" plugins/core/skills/review-change/scripts/review-round.test.mjs`,
`grep -rn "fencedLines\|parseTasks" plugins --include=*.test.mjs`,
`grep -n "v0\\\\.18\|review-writer-prompt" plugins/openspec/hooks/*.test.mjs`, and the sample table `P` of
`flow-check.test.mjs`. Every other existing
test stays as it is and must stay green.

`plugins/core/skills/review-change/scripts/review-round.test.mjs`:

- Fixtures, no invariant changes: `baseArgs` gains `head: SHA`, and `stage1Of` gains `read: ['a.mjs'],
  notRead: []`. Every direct `validateStage1(r, v)` call passes the head as its third argument: `SHA`,
  or `SHA2` in "consolidate writes the table …", whose `test-coverage-reviewer` answer records `SHA2`
  so that the commit column differs.
- "workflow writes one prompt per reviewer with its own agent type, the lines and the commit (AC-3)":
  the `test-coverage-reviewer` answer loses `{ commit: SHA2 }`, and the assertion on
  `writers[1].prompt` expects `Commit: ${SHA}`. Invariant: each writer prompt carries its outcome's
  commit line.
- "cli equals the workflow for the same fixtures, except the path (AC-5)": the
  `test-coverage-reviewer` answer loses `{ commit: SHA2 }`. Invariant: both paths give equal outcomes,
  verifier counts and `review.md` text.
- "the rules section loads and exports every name": the name list gains `writeJobs`, `isHeaderLine`
  and `withoutHeaderLines`. This adds to the test and changes nothing it already checks.
- "validateArgs accepts the contract …": the `bad` list gains `args` without `head` and with a
  7-character `head`. This also only adds.

`plugins/openspec/hooks/change-loop.test.mjs`, in the docs test that holds the CI pin:

- `assert.match(flow, /v0\.18\.1/, …)` becomes `/v0\.19\.0/` with the message naming this change, and
  a `doesNotMatch` for `v0\.18\.1` joins the existing ones. Invariant: the CI snippet pins the
  current release.
- The roadmap check finds the line with `/^- \[[ x]\] review-writer-prompt/` instead of
  `startsWith('- [ ] review-writer-prompt')`. Invariant: the round 25 line names the two carried
  findings. Without this change the archive, which ticks the line, would break the `check` job.

`plugins/openspec/hooks/flow-check.test.mjs`, "flow-check readout: both languages cover every reason
code": its sample table `P` gains `'stale-reviewers': { names: ['spec-reviewer'] }`. Invariant: every
reason code has a sentence in both languages, and the table names every code. The fence tests of
that file call `countedTasks`, which keeps its behaviour.

`plugins/openspec/hooks/deliver-check.test.mjs`: no existing test changes. The staleness and item 2
tests commit `src/` paths, which keep today's rule.

## D-10 Tests, documents and release

New tests start with `review-writer-prompt AC-<n> `, so that a gate can select them:

- `review-round.test.mjs`: AC-1 (the `jobs` of `cli outcomes`: count, order, agent types, prompts
  equal to `writerPrompt(args, outcome)` and to the workflow's write calls for the same fixtures, no
  job for a failed reviewer; the skill text names `jobs`), AC-2 (the prompt's one-sha sentence;
  `fixed in abc1234 and def5678` fails stage 1), AC-3 (the prompt names `git rev-parse HEAD`, `read`,
  `notRead` and the `sections` sentence, and not `args.head`; `STAGE1_SCHEMA.required` holds both
  lists), AC-4 (every command exits 3 without `head` or with a short one; the workflow refuses before
  any agent; a padded short sha fails stage 1 on `cli verify`, `cli outcomes` and the workflow, with
  no verifier and no writer call; the skill and `ship-change` texts name `args.head`), AC-5 (a
  non-empty `notRead`, an empty `read` while not declined, a missing list: each fails on both paths;
  declined with an empty `read` passes as `declined`), AC-6 (plain and indented `Verdict:`/`Commit:`
  lines leave the outcome, the writer prompt names them only on its `line 1:` and `line 2:`, and a
  file written from it has one of each and passes `check-file`), AC-7 (`check-file` exits 2 for a later
  `Verdict:` line and for a later `Commit:` line, naming the line number).
- `deliver-check.test.mjs`: AC-8 (`isTestFile` on both path lists of the spec; six reviewers after a
  test-only commit; the `review` step after the evidence is recorded again; the evidence going stale;
  a product commit in the range; a mixed commit; an uncommitted product edit; `perf-reviewer`; both CI
  entries through `bothEntries` with `ciRepo`/`ciProve`), AC-9 (backtick and tilde fences, a fenced
  gate, a checkbox after the fence, a fenced unticked line on the default branch through
  `t.gh.tasksOnDefault` answering the retro, and the source of `flow-check.mjs` holding no `function
  fencedLines`).
- `flow-check.test.mjs`: AC-8 (a test-only commit makes the review stage stale; a stale reviewer under
  a current header gives `stale-reviewers` naming it; every reviewer current gives `passed`; the walk
  after the merge does not apply it).

Documents:

- `docs/openspec-flow.md`:
  - "The review round", item 1: the reviewer also returns the commit `git rev-parse HEAD` printed and
    the files it read and those of its remit it did not read. An answer at another commit than the
    round's `head`, or a partial one, fails its review stage before the verify stage.
  - The `check-file` sentence: "… and no `Verdict:` or `Commit:` line after line 2".
  - The delivery table: row 1 adds "a checkbox inside a fenced block is not a task". Row 2's "or its
    `Commit:` stale" adds "(a commit of test files only stales only `code-quality-reviewer` and
    `test-coverage-reviewer`)".
  - **The `Commit:` staleness rule**: one added sentence, D-6's rule with the test-file pattern, and
    that `flow-check` reports the review stage stale while any reviewer is stale.
  - **Order of the delivery steps**: after "only a later commit outside `openspec/` stales both",
    add "(a commit of test files only stales the evidence and the two reviewers that read tests)".
  - CI: after "a later product commit fails the job", add "(after a commit of test files only, the
    reviews of `spec-reviewer`, `adr-reviewer`, `architecture-reviewer` and `security-reviewer` stay
    current)". The three `v0.18.1` lines become `v0.19.0`.
- `plugins/core/skills/review-change/SKILL.md`, as D-5 says. The Cost paragraph's "or an ancestor of
  it with only `openspec/` changes since" adds "(for `spec-reviewer`, `adr-reviewer`,
  `architecture-reviewer` and `security-reviewer`, test files may change too)". The stale bullet adds
  "a commit of test files only stales only `code-quality-reviewer` and `test-coverage-reviewer`, and
  any reviewer outside the six".

Release (`CONTRIBUTING.md`, step 5):

- devkit-core 0.8.1 to 0.9.0 and devkit-openspec 0.18.1 to 0.19.0, in each `plugin.json` and in
  `.claude-plugin/marketplace.json`.
- The marketplace from 0.22.1 to 0.23.0, with a `CHANGELOG.md` section
  `## 0.23.0 — review round tooling`: one bullet per pack, a docs bullet, and the line "The CI snippet
  now pins `v0.19.0`, the release's tag."
- Both are minor bumps: `args.head` is a new required input of devkit-core's script, and the
  staleness rule changes what devkit-openspec's checkers report.
- The tag `v0.19.0` is pushed after the merge (Workflow follow-up). The sibling
  `roadmap-coordinator-followups` bumps devkit-openspec too, and the release rebase settles that.

## Decisions and ADRs

No ADR is needed:

- ADR 0008 decision 1 (one rules section) holds: every new rule is in it. Decision 5 (same stages,
  same files on both paths) holds: D-1 to D-4 serve both paths. Decision 4 keeps the `Verdict:` and
  `Commit:` lines and the hooks' writer rules "as they are". Their form does not change, `check-file`
  only refuses a copy of them, and the writer of each file is unchanged. Its "the delivery contract …
  stay as they are" is about running the round as a Workflow. This change runs nothing new through
  the tool.
- ADR 0002 and ADR 0012 decision 4: the check still recomputes reviews, findings, gates and acceptance
  proof at the PR head. The rule for "current" is not in an ADR. It is in `docs/openspec-flow.md` ("The
  `Commit:` staleness rule"), which D-10 updates.
- Rejected alternatives in the ADRs: ADR 0008's (verifying after the file, a saved workflow, more
  reviewers) and ADR 0012's (reading schema files the CI job does not download) are not used. D-8
  adds no downloaded file.

## Implementation plan

**Per surface.** devkit-core: the rules section, `review-round.mjs`, its tests, the skill and the
six agents (D-1 to D-5). devkit-openspec: `deliver-check.mjs` and `flow-check.mjs` with their tests
(D-6 to D-8), and the `ship-change` row (D-5). Docs and release: D-10. There is no backend, frontend
or worker surface, and the panel does not change.

**File structure.**

| Action | Path |
|---|---|
| modify | `plugins/core/skills/review-change/scripts/review-round.workflow.js` |
| modify | `plugins/core/skills/review-change/scripts/review-round.mjs` |
| modify | `plugins/core/skills/review-change/scripts/review-round.test.mjs` |
| modify | `plugins/core/skills/review-change/SKILL.md` |
| modify | `plugins/core/agents/code-quality-reviewer.md`, `test-coverage-reviewer.md`, `architecture-reviewer.md`, `security-reviewer.md`, `adr-reviewer.md`, `spec-reviewer.md` |
| modify | `plugins/openspec/skills/ship-change/SKILL.md` |
| modify | `plugins/openspec/hooks/deliver-check.mjs`, `deliver-check.test.mjs` |
| modify | `plugins/openspec/hooks/flow-check.mjs`, `flow-check.test.mjs` |
| modify | `plugins/openspec/hooks/change-loop.test.mjs` (the pin and the roadmap line only) |
| modify | `docs/openspec-flow.md`, `CHANGELOG.md` |
| modify | `plugins/core/.claude-plugin/plugin.json`, `plugins/openspec/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` |
| create | none |
| delete | none |

**Estimate.** Optimistic 6 h, likely 9 h, pessimistic 13 h. The pessimistic case is a cascade of
fixture updates in `review-round.test.mjs` and an existing `flow-check` or `change-loop` test that
reads a review stage with stale reviewer files.

| Component | Hours | Type | Risk |
|---|---|---|---|
| D-1 `head`, the commit and partial checks, both call sites | 1.0 | Core | LOW |
| D-2 schema and stage-1 prompt | 0.5 | Core | LOW |
| D-3 header lines: strip and `check-file` | 0.5 | Core | LOW |
| D-4 `writeJobs`, the workflow's write phase, `outcomes` | 0.5 | Core | LOW |
| D-9 fixture updates in `review-round.test.mjs` | 0.75 | Testing | MEDIUM |
| D-10 review-round tests AC-1 to AC-7 and the text tests | 1.75 | Testing | MEDIUM |
| D-5 skill, `ship-change` row, six agents | 0.5 | Documentation | LOW |
| D-6 `isTestFile`, `staleness` option, `readReviews` | 0.5 | Core | LOW |
| D-7 `staleReviewers`, `stale-reviewers` and its two texts | 0.5 | Core | MEDIUM |
| D-8 fence helper move, `parseTasks` | 0.5 | Core | LOW |
| D-10 deliver-check and flow-check tests AC-8, AC-9 | 1.5 | Testing | MEDIUM |
| D-10 `docs/openspec-flow.md` | 0.5 | Documentation | LOW |
| Release: versions, CHANGELOG, pin, roadmap test | 0.5 | Migration | LOW |
| Whole suite, checks, validate | 0.5 | Testing | MEDIUM |

**Risks.**

| Risk | Probability × impact | Mitigation |
|---|---|---|
| The fixture updates in `review-round.test.mjs` hide a changed invariant | MEDIUM × MEDIUM | D-9 lists every test whose assertions change, with its invariant. All other edits are the two fixture defaults and the head argument |
| A reviewer honestly lists part of a large remit in `notRead`, and the round refuses it twice | MEDIUM × MEDIUM | This is the owner's rule. The refusal comes before the verify stage, the skill re-runs that reviewer once, and a second failure goes to the owner as today |
| A session with an older `review-change` text calls the new script without `head` | LOW × MEDIUM | The script and the skill ship in the same pack. The exit-3 message names `args.head` and how to fill it |
| A file that matters to security or architecture sits under a `fixtures` or `test` folder, and a commit of it spares those reviewers | LOW × HIGH | This is the owner's fixed pattern. `code-quality-reviewer` and `test-coverage-reviewer` still re-review that commit, and `docs/openspec-flow.md` states the rule |
| D-7 changes an existing `flow-check`, `change-loop` or `roadmap-loop` result where reviewer files are stale under a current `review.md` header | LOW × MEDIUM | Synthetic `walk` facts do not have the function. The live fixtures write reviewer files at the head they commit. Phase 3 runs the whole suite before any review |
| The panel parity check fails because `parseTasks` changed a literal | LOW × LOW | D-8 keeps both literals, and every gate runs `python3 scripts/check.py` |
| A new hook test passes locally and fails on CI, where `GITHUB_HEAD_REF` is set | MEDIUM × MEDIUM | New tests take their env from the existing fixtures (`shipRepo`, `CI_ENV`), and every hook gate runs with `GITHUB_HEAD_REF` and `GITHUB_BASE_REF` set |
| The sibling change bumps devkit-openspec too | MEDIUM × LOW | The release rebase settles it (`CONTRIBUTING.md`) |
| The owner drops the agents' paragraph (task 1.5) | LOW × LOW | D-3 removes the pasted lines whatever the agent sends |

**Assumptions.**

- A-1: only the `review-change` skill builds `args`, and only the two paths and the suite call
  `validateStage1` (the `grep` in Context). If a hook built `args`, it would need `head` too.
- A-2: `readReviews` is the only staleness reader of verdict files, and the `devkit-reviews` check
  reaches it through `reviewsItem` (`deliver-check.mjs#runCi`, read at `2300f84`).
- A-3: `flow-check.mjs` already imports from `deliver-check.mjs` (its import line), so D-7 and D-8 add
  no module edge, and the CI job still downloads three files.
- A-4: both stage declarations name the review stage `review` (`plugins/openspec/schemas/*/flow.json`).
- A-5: OpenSpec's `instructions apply` list still counts fenced lines, and `flow-check` subtracts
  them (`flow-check.test.mjs`, the comment before its OpenSpec fake).

**Dependencies.** `merge-setup-field-fixes` (archived 2026-11-21, devkit-openspec 0.18.1): the
first-`Verdict:`-line rule of spec `verdict-files`, which this change extends. The retros of
`orchestrator-replan`, `flow-script-checker`, `change-coordinator` and `coordinator-field-fixes`, as
the roadmap line cites them. ADR 0002, 0008 and 0012, as cited.

## Migration Plan

Projects get the rules when they update the packs. A session's round needs `args.head` from
devkit-core 0.9.0 on, and the skill text of the same release says so. A project's pinned
`devkit-reviews` workflow keeps the old staleness rule until the project moves its pin to `v0.19.0`.
That is stricter, never looser, so a pull request the new rule passes can fail under an old pin until
its two code reviewers are current. This repository's own workflow runs the tree's
`deliver-check.mjs`, so this change's pull request is judged by the new rule.

The review stage of this change may run with the installed devkit-core 0.8.1 (no `head`) or with the
tree's scripts, which need `args.head`. Either way, its reviewers are dispatched with the repository's
agent files (`CONTRIBUTING.md`).

Rollback: revert the change's pull request. No file format is removed. `jobs` is an added key, and a
verdict file written under the new rules is valid under the old ones.
