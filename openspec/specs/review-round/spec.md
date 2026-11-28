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

### Requirement: The round reads the uncommitted paths from git
`review-round.mjs tree` SHALL print the worktree's head sha and the uncommitted paths that count: a
tracked path outside `openspec/` with a staged or unstaged change (both paths of a rename or copy),
and an untracked path outside `openspec/` and outside `.claude/`. A path under `openspec/` SHALL
never count. The `args` of a round SHALL hold those paths as `dirty`; every command that takes
`args`, and the Workflow script, SHALL refuse `args` without a `dirty` list.

#### Scenario: Only openspec files are uncommitted
- **WHEN** `review-round.mjs tree` runs in a worktree where `openspec/changes/<id>/evidence.md` and `openspec/changes/<id>/design.md` are edited and not committed, and `openspec/changes/<id>/notes.md` is untracked
- **THEN** it prints the head sha and an empty `dirty` list

#### Scenario: Paths that count
- **WHEN** `src/a.mjs` is edited, `src/b.mjs` is staged, `src/new.mjs` is untracked, `.claude/settings.json` is tracked and edited, and `src/old.mjs` is renamed to `openspec/moved.mjs`
- **THEN** `dirty` lists `src/a.mjs`, `src/b.mjs`, `src/new.mjs`, `.claude/settings.json` and `src/old.mjs`, and no `openspec/` path

#### Scenario: An untracked path under .claude
- **WHEN** the only uncommitted path is the untracked `.claude/worktrees/x/a.txt`
- **THEN** `dirty` is empty

#### Scenario: The same rule as the delivery check
- **WHEN** `review-round.mjs tree` and `deliver-check.mjs` read the same worktree, for each tree of the scenarios above
- **THEN** the round's `dirty` list holds exactly the paths the delivery check counts as uncommitted

#### Scenario: A root that is not a git worktree with a commit
- **WHEN** `review-round.mjs tree` runs with a `root` that is a folder with no git, or a git repository with no commit yet
- **THEN** it exits 3, prints nothing on stdout, and stderr is `review input invalid: <root> is not a git worktree with a commit`

#### Scenario: A missing or malformed root
- **WHEN** `review-round.mjs tree` runs with input that has no `root`, or a `root` that is not a non-empty string
- **THEN** it exits 3 and stderr is `review input invalid: root must be a path`

#### Scenario: A relative root
- **WHEN** `review-round.mjs tree` runs with `root` `.` from inside the worktree
- **THEN** it prints the same `head` and `dirty` as with the worktree's absolute path

#### Scenario: A command without dirty
- **WHEN** `review-round.mjs stage1`, `verify`, `outcomes` or `consolidate` runs with `args` that have no `dirty`, or a `dirty` that is not a list of non-empty strings
- **THEN** it exits 3 and stderr starts with `review input invalid:`

#### Scenario: The Workflow script without dirty
- **WHEN** the Workflow script runs with `args` that have no `dirty`
- **THEN** it throws an error starting `review input invalid:` and starts no agent

### Requirement: The round marks a verdict's Commit line from git
Line 2 of every verdict file a round asks for SHALL be `Commit: <args.head>` followed by
` (uncommitted changes)` exactly when `args.dirty` is not empty. The stage-1 prompt SHALL NOT ask the
reviewer whether the tree is dirty, SHALL say that the round marks the line from git and by which
rule, and an `uncommitted` key in a stage-1 answer SHALL change nothing.

#### Scenario: A round with only openspec files uncommitted
- **WHEN** a round runs with `args.dirty` empty while `openspec/changes/<id>/evidence.md` is not committed, and its reviewers approve
- **THEN** each writer prompt's line 2 is `Commit: <args.head>` with no marker, and `deliver-check.mjs <id>` reads those verdicts as current

#### Scenario: A round with a product file uncommitted
- **WHEN** a round runs with `args.dirty` holding `src/a.mjs`
- **THEN** each writer prompt's line 2 is `Commit: <args.head> (uncommitted changes)`, `check-file` expects that line, and `deliver-check.mjs <id>` lists the written verdicts as stale, recorded with uncommitted changes

#### Scenario: A reviewer's own flag
- **WHEN** a stage-1 answer carries `uncommitted: true` and `args.dirty` is empty
- **THEN** the outcome's writer prompt has line 2 with no marker, and the answer is not refused for the key

#### Scenario: The stage-1 prompt
- **WHEN** `review-round.mjs stage1` prints the prompt of a reviewer
- **THEN** its JSON shape holds no `uncommitted` key, and it says that the round marks the `Commit:` line from git when a path outside `openspec/` is uncommitted

#### Scenario: The skill text
- **WHEN** `plugins/core/skills/review-change/SKILL.md` and the `review` row of `plugins/openspec/skills/ship-change/SKILL.md` are read
- **THEN** both say that `args.head` and `args.dirty` come from `review-round.mjs tree`, run in the change's worktree right before the round

### Requirement: A round beyond the second runs within the authorized limit
The round script SHALL accept an optional `limit` argument, a whole number of 2 or more, 2 when
absent, and a round from 1 to that limit. The prompts and `review.md` SHALL name the round as `round
<n> of <limit>` and `(round <n>/<limit>)`, and a failed round at the limit SHALL say the owner decides.

#### Scenario: A third round with its limit
- **WHEN** the round runs with `round: 3` and `limit: 3`
- **THEN** the arguments are accepted and `review.md` reads `Consensus: FAIL (round 3/3)` on a failure, with the deadlock sentence after round 3

#### Scenario: A third round with no limit
- **WHEN** the round runs with `round: 3` and no `limit`
- **THEN** the arguments are refused, as before

#### Scenario: A round above its limit
- **WHEN** the round runs with `round: 4` and `limit: 3`
- **THEN** the arguments are refused

#### Scenario: A limit below two
- **WHEN** the round runs with `limit: 1`, or a limit that is not a whole number
- **THEN** the arguments are refused

#### Scenario: No limit
- **WHEN** the round runs with `round: 2` and no `limit`
- **THEN** the texts are those of today: `round 2 of 2`, `(round 2/2)` and the deadlock after round 2

### Requirement: A disposition keeps its whole text
A finding's disposition SHALL reach its outcome line and the writer prompt whole, on both paths: a
reviewer's own `refuted: <evidence>` or `fixed in <sha>`, and the `refuted: <e1> / <e2>` the round
builds from each refuting verifier's evidence, with no length cap and no `…`. A disposition SHALL stay
one line: runs of whitespace become one space and `·` becomes `-`, as before this change.

#### Scenario: A reviewer's own long refutation
- **WHEN** a stage-1 answer lists a finding with the disposition `refuted: ` followed by 600 characters of evidence
- **THEN** the finding's outcome line ends with ` · refuted: ` and the whole 600 characters, the writer prompt holds that line, and neither ends the evidence with `…`

#### Scenario: Long evidence of the verifiers
- **WHEN** two of the three verifiers of an `important` finding refute it, each with evidence longer than 400 characters
- **THEN** the finding's outcome line ends with ` · refuted: <first evidence> / <second evidence>`, each evidence whole, and the writer prompt holds that line

#### Scenario: Still one line
- **WHEN** a reviewer's own disposition holds a line break and a `·`
- **THEN** its outcome line holds one space for the line break and `-` for the `·`

### Requirement: The writer prompt leaves out the reviewer's own summary
The writer prompt SHALL leave out every summary section of a stage-1 `sections` text. A summary
section is a line `## Summary` or `### Summary`, in any case, with no text after the word but spaces.
The text under it, up to the next heading of the same or a higher level or the end, goes too. A line
inside a fenced code block is no heading, and an unclosed fence runs to the end. The rest of `sections`
SHALL reach the writer prompt verbatim.

#### Scenario: A summary between two sections
- **WHEN** `sections` is `### Notes\nKept.\n\n### Summary\n- 2 findings; F1 is open\n\n### Next\nKept too.`
- **THEN** the writer prompt holds `### Notes\nKept.\n\n` followed by `### Next\nKept too.`, and not the line `- 2 findings; F1 is open`

#### Scenario: A second-level summary in another case
- **WHEN** `sections` holds `## SUMMARY` followed by a `### Detail` heading, its text, and then a `## Notes` heading
- **THEN** the writer prompt holds neither `## SUMMARY` nor `### Detail` nor its text, and holds `## Notes` and what follows it

#### Scenario: No summary section
- **WHEN** `sections` holds no summary heading, or only a `#### Summary` or `# Summary` heading
- **THEN** the writer prompt holds `sections` byte for byte

#### Scenario: A summary heading inside a fence
- **WHEN** the line `### Summary` of `sections` sits between two fence lines
- **THEN** the writer prompt holds `sections` byte for byte

#### Scenario: An unclosed fence under a summary
- **WHEN** a `### Summary` heading of `sections` is followed by a fence line that no later line closes, and then by a `### Notes` heading
- **THEN** the writer prompt holds nothing of `sections` from the `### Summary` line to the end

### Requirement: The writer prompt asks for the round's summary
The writer prompt SHALL ask, as the file's last section, for the line `### Summary`, then one line built
from the outcome: `- N findings (B blocking, I important, T nit) + P praise; open: <ids>; fixed: <ids>;
refuted: <ids>`. B, I, T and P count the findings of each severity and N is B + I + T. The id lists hold
blocking, important and nit findings, in the outcome's order, joined by `, `. An empty list reads `none`.

#### Scenario: Every list filled
- **WHEN** an outcome holds F1 blocking refuted by the verifiers, F2 important open, F3 nit open, F4 praise, F5 important with `fixed in abc1234` and F6 nit with the reviewer's own `refuted: <evidence>`
- **THEN** the writer prompt asks for `### Summary` and then `- 5 findings (1 blocking, 2 important, 2 nit) + 1 praise; open: F2, F3; fixed: F5; refuted: F1, F6`, after the `sections` text

#### Scenario: No findings
- **WHEN** an outcome holds no finding
- **THEN** the line is `- 0 findings (0 blocking, 0 important, 0 nit) + 0 praise; open: none; fixed: none; refuted: none`

#### Scenario: A refuted blocking finding on both paths
- **WHEN** a round's only finding is a `blocking` one that two of its three verifiers refute, each with evidence longer than 400 characters, and the reviewer's `sections` holds a `### Summary` that calls it open
- **THEN** on the `workflow` path and in the `jobs` of `review-round.mjs outcomes` the outcome's verdict is `approved`. Its line ends with ` · refuted: ` and both pieces of evidence whole. The writer prompt holds `open: none` and `refuted: F1` and not the reviewer's summary line

#### Scenario: The prompt names no second header line
- **WHEN** the writer prompt is built for any outcome
- **THEN** it names `Verdict:` only in its `line 1:` instruction and `Commit:` only in its `line 2:` instruction
