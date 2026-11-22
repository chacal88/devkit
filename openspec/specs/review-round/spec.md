# review-round Specification

## Purpose
Says what the review round's script (`review-round.mjs` and its Workflow script) asks of each
reviewer, which stage-1 answers it accepts, what it gives the session to write the verdict files, and
what its file check refuses, so that both paths of the round refuse the same answers.

## Requirements

### Requirement: The outcomes command gives the writer prompts
`review-round.mjs outcomes` SHALL print, besides `outcomes`, `failed` and `verifiersFailed`, a `jobs`
list with one entry per outcome, in the order of `outcomes`: `{ reviewer, agentType:
"devkit-core:<reviewer>", prompt }`, where `prompt` is the stage-3 writer prompt the `workflow` path
sends that reviewer for the same outcome. A reviewer listed in `failed` SHALL have no job.

#### Scenario: Two outcomes give two writer jobs
- **WHEN** `review-round.mjs outcomes` runs with a bench of `code-quality-reviewer` and `test-coverage-reviewer`, both stage-1 answers usable
- **THEN** it exits 0 and `jobs` holds two entries, in the order of `outcomes`, with the agent types `devkit-core:code-quality-reviewer` and `devkit-core:test-coverage-reviewer`, and each `prompt` is the prompt the Workflow script's write stage sends that reviewer for the same fixtures

#### Scenario: A failed reviewer gets no writer job
- **WHEN** the stage-1 answer of one reviewer of the bench is unusable
- **THEN** that reviewer is in `failed` and in no entry of `jobs`

#### Scenario: The other keys keep their shape
- **WHEN** `review-round.mjs outcomes` runs on the fixtures of the existing suite
- **THEN** `outcomes`, `failed` and `verifiersFailed` hold what they held before this change

### Requirement: The stage-1 prompt names one sha per disposition
The stage-1 prompt SHALL say that a disposition is either `fixed in <sha>`, naming exactly one sha
(the commit that holds the fix), or `refuted: <evidence>`. A disposition that names two shas SHALL
make the stage-1 answer unusable, as before this change.

#### Scenario: The prompt states the rule
- **WHEN** `review-round.mjs stage1` prints the prompt of a reviewer
- **THEN** the prompt says that `fixed in` names exactly one sha, the commit that holds the fix, and that the other form is `refuted: <evidence>`

#### Scenario: Two shas are refused
- **WHEN** a stage-1 answer carries the disposition `fixed in abc1234 and def5678`
- **THEN** that reviewer is listed in `failed` as `review stage failed: <reviewer> review`

### Requirement: The stage-1 prompt asks for HEAD and the files read
The stage-1 prompt SHALL ask for `commit` as `git rev-parse HEAD` prints it in the worktree, for a
`read` list of the repo-relative paths the reviewer opened and a `notRead` list of the paths of its
remit it did not open, and SHALL say that `sections` holds no `Verdict:` and no `Commit:` line. The
prompt SHALL NOT carry the value of `args.head`.

#### Scenario: The prompt asks for the commit and both lists
- **WHEN** `review-round.mjs stage1` prints the prompt of a reviewer
- **THEN** the prompt names `git rev-parse HEAD`, `read` and `notRead`, its JSON shape holds the keys `read` and `notRead`, and it says that `sections` holds neither a `Verdict:` line nor a `Commit:` line

#### Scenario: The prompt does not give the answer away
- **WHEN** the prompt is built for `args` whose `head` is a given sha
- **THEN** the prompt does not contain that sha

### Requirement: A review round needs the head sha
The `args` of a review round SHALL hold `head`, the full 40-hex sha `git rev-parse HEAD` prints in
the change's worktree. Every command of `review-round.mjs` that takes `args` SHALL refuse `args`
without such a `head` as an input error (exit 3, `review input invalid:`), and the Workflow script
SHALL refuse it before any agent runs.

#### Scenario: A command without head
- **WHEN** `review-round.mjs stage1`, `verify`, `outcomes` or `consolidate` runs with `args` that have no `head`, or a `head` of 7 hex characters
- **THEN** it exits 3 and stderr starts with `review input invalid:`

#### Scenario: The Workflow script without head
- **WHEN** the Workflow script runs with `args` that have no `head`
- **THEN** it throws an error starting `review input invalid:` and starts no agent

### Requirement: A stage-1 answer at another commit fails its review stage
A stage-1 answer whose `commit` is not equal to `args.head` SHALL be unusable, on both paths: the
reviewer SHALL be listed in `failed` as `review stage failed: <reviewer> review` and SHALL get no
verifier job and no outcome, before the verify stage.

#### Scenario: A padded short sha on the agents path
- **WHEN** `review-round.mjs verify` runs with `args.head` set and a stage-1 answer whose `commit` is the first 7 characters of `args.head` followed by 33 zeros
- **THEN** that reviewer is in `failed` as `review stage failed: <reviewer> review` and no job of `jobs` names it

#### Scenario: The same answer on the workflow path
- **WHEN** the Workflow script receives that stage-1 answer
- **THEN** its result lists the reviewer in `failed` with the same error, no verifier and no writer call names it, and `reviewMd` is null

#### Scenario: The commit of HEAD passes
- **WHEN** a stage-1 answer's `commit` equals `args.head`
- **THEN** the reviewer is not in `failed`

### Requirement: A partial stage-1 answer fails its review stage
A stage-1 answer SHALL hold a `read` list and a `notRead` list of paths. An answer whose `notRead` is
not empty, whose `read` is empty while `declined` is `false`, or that lacks either list SHALL be
unusable, on both paths, with the same failure as a wrong commit. A declined answer with an empty
`read` SHALL be usable.

#### Scenario: A path of its remit not read
- **WHEN** a stage-1 answer has `notRead: ["src/b.ts"]`
- **THEN** that reviewer is in `failed` as `review stage failed: <reviewer> review` and gets no verifier job

#### Scenario: Nothing read and not declined
- **WHEN** a stage-1 answer has `read: []` and `declined: false`
- **THEN** that reviewer is in `failed` the same way

#### Scenario: A declined reviewer that read nothing
- **WHEN** a stage-1 answer has `read: []`, `notRead: []` and `declined: true`
- **THEN** the reviewer is not in `failed` and its outcome's verdict is `declined`

#### Scenario: A list missing
- **WHEN** a stage-1 answer has no `read` key, or no `notRead` key
- **THEN** that reviewer is in `failed` the same way

### Requirement: A verdict file carries one Verdict line and one Commit line
Before it builds an outcome, the round SHALL remove from the stage-1 `sections` text every line that
begins, after optional spaces, with `Verdict:` or `Commit:`, so that neither the outcome's `sections`
nor the writer prompt carries such a line besides the writer prompt's own line 1 and line 2.

#### Scenario: A stage-1 text with its own lines
- **WHEN** a stage-1 `sections` text is `Verdict: approved\nCommit: <sha>\n\n## Notes\nBody`
- **THEN** the outcome's `sections` holds `## Notes` and `Body` and no line beginning with `Verdict:` or `Commit:`, and the writer prompt names `Verdict:` only in its `line 1:` instruction and `Commit:` only in its `line 2:` instruction

#### Scenario: The file written from it
- **WHEN** a verdict file is written as that writer prompt says
- **THEN** it has exactly one line beginning with `Verdict:` (line 1) and one beginning with `Commit:` (line 2), and `check-file` exits 0 for it

#### Scenario: An indented line
- **WHEN** a stage-1 `sections` text holds the line `  Verdict: rejected`
- **THEN** the outcome's `sections` does not hold it

### Requirement: The file check refuses a second Verdict or Commit line
`review-round.mjs check-file` SHALL exit 2 with stderr starting `review file mismatch: <file>:` when
any line after line 2 of the verdict file begins, after optional spaces, with `Verdict:` or
`Commit:`. Its other checks SHALL stay as they are.

#### Scenario: A second Verdict line
- **WHEN** a verdict file matches its outcome on lines 1 and 2 and holds `Verdict: rejected` further down
- **THEN** `check-file` exits 2 and stderr starts with `review file mismatch: <file>:` and names that line's number

#### Scenario: A second Commit line
- **WHEN** a verdict file matches its outcome on lines 1 and 2 and holds `Commit: <sha>` further down
- **THEN** `check-file` exits 2 with the same prefix

#### Scenario: A clean file
- **WHEN** a verdict file holds no line beginning with `Verdict:` or `Commit:` after line 2 and matches its outcome otherwise
- **THEN** `check-file` exits 0

### Requirement: The review skill fills the head and sends the writer jobs
The `review-change` skill SHALL tell its caller to fill `args.head` with the full sha that
`git rev-parse HEAD` prints in the change's worktree, and its `agents` path SHALL send, in stage 3,
the `jobs` prompts of `review-round.mjs outcomes`. The `ship-change` `review` row SHALL say how
`args.head` is filled.

#### Scenario: The skill text
- **WHEN** `plugins/core/skills/review-change/SKILL.md` is read
- **THEN** its `args` sentence names `head` and `git rev-parse HEAD`, and its third `agents` step names the `jobs` of `review-round.mjs outcomes` as the prompts it sends

#### Scenario: The ship-change review row
- **WHEN** the `review` row of `plugins/openspec/skills/ship-change/SKILL.md` is read
- **THEN** it names `args.head` and `git rev-parse HEAD`
