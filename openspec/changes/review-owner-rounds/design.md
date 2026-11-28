<!-- devkit-stage design result=passed attempt=1 commit=a0e9efb9e046bf0cfe6f88199fbe8d334ea0b11b -->
# Design

Change: `review-owner-rounds` · Date: 2026-11-28 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(`proposal.md`, `requirements.md`, `decisions.md`, `release.md`, the delta
`specs/review-round/spec.md`). Base: `origin/main` at `6f03a57` as last fetched.

## Context

See `proposal.md`, "Why". The facts this design stands on, read at `a0e9efb`:

- The round's rules live once, between the `// ---- rules: begin` and `// ---- rules: end` markers of
  `plugins/core/skills/review-change/scripts/review-round.workflow.js`; `review-round.mjs` loads that
  section with `new Function` and exports the names of its `NAMES` list. The section is pure: no tool
  globals, no module loading, no file read. The Workflow script gets everything through its
  arguments (ADR 0008 decision 3), so it cannot read `declared.json` itself.
- `validateArgs` already takes the optional `args.limit` (`roundLimit(args)`, 2 when absent) and a
  round from 1 to it; `consolidate` prints `Consensus: <PASS|FAIL> (round N/<limit>)`. Both are the
  delivered half (D-7).
- `change-loop.mjs declare <id> review-round --stdin words` records
  `{ key: 'review-round', scope, round, words: words.slice(0, 200), at }` in
  `openspec/changes/<id>/declared.json` through `recordDeclared`, with `round` =
  `REVIEW_ROUNDS + authorizedRounds(dir, scope) + 1`; `deliver-check.mjs#readDeclared` reads it.
- `plugins/core/skills/review-change/SKILL.md` builds `args` from `review-round.mjs tree` (`head`,
  `dirty`) and the loop's `limit`, and asks the session, in its rounds rule, to "write in the section's
  notes that it is the owner's further round, quoting the owner's words". That copy is what AC-1
  removes.
- `.compozy/loops/devkit-review/loop.yaml` runs the skill's steps 1 to 4, so it builds `args` by the
  same sentence; but the CompozyOS driver stops its review at two rounds (ADR 0032, Note of
  2026-11-25), so its rounds never reach the new rule.
- `deliver-check.mjs#readReviewMd` reads the last `^\s*\**Consensus\**\s*:` line of `review.md`; a
  line starting `Owner's words` is never read as one.

A drift of `requirements.md` resolved here without asking (not a contradiction from code merged since
the grill): its assumption says a backtick "is already replaced by `'` at record time", but
`declare review-round` keeps the words as typed apart from the 200-character cut (`words.slice(0, 200)`
in `change-loop.mjs#declaredStep`; only `wordsOf`, used by the plan and mock-up approvals, replaces
backticks). The printed line therefore wraps the words in double quotes, never in backticks (D-3), so
no backtick of the owner's words can close a quote the line opened.

## Goals / Non-Goals

**Goals:** the rule "no round above 2 without the owner's recorded words" lives in the round's one
rules section, so both paths refuse the same calls (ADR 0008, Consequences: "two paths must stay
equal"); the words reach the section from the record through a command, never through the session's
retelling; rounds 1 and 2 stay byte for byte as they are.

**Non-Goals:** the reviewer, verifier and writer prompts (no word of the owner reaches an agent); the
loop's `review` and `review-resolution` steps, `REVIEW_ROUNDS`, `declare review-round` and
`readDeclared`, all unchanged; the CompozyOS loops; the map `scripts/test-map.json` (no file is
added or moved; see Risks for the readers it does not select).

## Decisions

### D-1 `args.owner`, checked by `validateArgs`

`args` gains an optional `owner`: `{ round, scope, words }`. The review's scope is
`args.verdictDir === undefined ? 'review' : 'resolution'`: the resolution call is the only caller that
sets `verdictDir` (`SKILL.md`, "Resolution calls", `verdictDir: "reviews/resolution"`). The checks run
in `validateArgs`, right after the existing round range check (so a round 3 with no `limit` keeps its
message `args.round must be from 1 to 2`), in this order, each through the existing `invalid(what)`
(prefix `review input invalid: `):

| Case | `what` |
|---|---|
| `round` ≤ 2 and `owner` neither `undefined` nor `null` | `args.owner is only for a round above 2` |
| `round` > 2 and `owner` `undefined` or `null` | `round <N> needs the owner's authorization: args.owner holds no words recorded for round <N> of scope <S> (change-loop.mjs declare <args.change> review-round)` |
| `owner` not a plain object (an array included) | `args.owner must be an object` |
| `owner.round !== args.round` | `args.owner.round must be <N>, the round` |
| `owner.scope !== <S>` | `args.owner.scope must be <S>` |
| `owner.words` not a string, blank after `trim()`, or longer than 200 characters | `args.owner.words must be the owner's words, 1 to 200 characters` |

The 200 is the record's own cut (`words.slice(0, 200)`). The Workflow script calls `validateArgs`
before `phase('review')`, so a refusal starts no agent and returns no `reviewMd` (AC-3); every CLI
command that takes `args` (`stage1`, `verify`, `outcomes`, `consolidate`) passes it through
`validateArgs` already and exits 3 on the message (AC-3).

Alternatives: the session copies the loop's step detail into a free-text note, as today (rejected:
AC-1 forbids the session's copy); the round accepts a round above 2 with a warning (rejected by the
owner's delegated answer, requirements question 2, and by ADR 0032's review trigger).

### D-2 `review-round.mjs owner`: the record, read in the pack

A new subcommand of the `review-round.mjs` CLI, added to `SUBCOMMANDS` and `COMMANDS`, and an
exported helper `recordedOwner({ changeDir, scope, round })` that it calls (exported as `treeState`
is, so that `deliver-check.test.mjs` can hold the two readings together):

- Input checks, in order: `changeDir` a non-empty string, else `changeDir must be a path`; `scope`
  `review` or `resolution`, else `scope must be review or resolution`; `round` a whole number of 1 or
  more, else `round must be a whole number of 1 or more`. `changeDir` is resolved against the working
  folder (`resolve`), as `tree` resolves `root`.
- `round` ≤ 2: `{ owner: null }`, nothing read.
- The record `<changeDir>/declared.json`, read by the rules of `deliver-check.mjs#readDeclared`
  (devkit-core installs alone, so this is a copy, as `dirtyPaths` is): a missing file holds no entry;
  an unreadable one refuses with `<file>: <reason>`, the reason being readDeclared's own text
  (`cannot read declared.json: <code>`, `declared.json is empty`, `declared.json is not JSON`,
  `declared.json holds no object`, `declared.json has version <v>, not 1`,
  `declared.json has no list of steps`).
- The match: the last entry that is a plain object with `key === 'review-round'`,
  `(entry.scope ?? 'review') === scope`, `entry.round === round` and a non-blank string `words`.
  None: `round <N> needs the owner's authorization: <file> records no words for round <N> of scope
  <S> (change-loop.mjs declare <basename(changeDir)> review-round)`. The record's order is the order
  `recordDeclared` appended in, so the last match is the latest record.
- Found: `{ owner: { round, scope, words } }`, the words exactly as recorded.

The refusals throw the CLI's own `invalid(...)`, so they exit 3 with `review input invalid: ...` on
stderr and nothing on stdout, as every other input error. The header comment of the CLI lists
`owner` with its input and output.

Alternatives: the loop's `review` / `review-resolution` step gives the words in its detail and the
skill copies them into `args` (rejected: it adds a field to the loop's step and to every caller's
reading of it, and devkit-core's round would then trust devkit-openspec's step for its own gate;
the command keeps the reading in the pack that enforces it, for the skill and the CompozyOS loop
alike); `validateArgs` or the CLI commands read `declared.json` themselves (rejected: the rules
section reads no file, so the Workflow path could not, and the two paths would refuse different
calls); importing `readDeclared` from devkit-openspec (rejected: devkit-core installs alone).

### D-3 The quoted line in `consolidate`

A pure helper of the rules section, `ownerLine(args)`, added to `NAMES` in `review-round.mjs`:
`null` when `args.round <= 2` or `args.owner` is `undefined` or `null`; otherwise
`"Owner's words for round " + args.round + ': "' + String(args.owner.words).replace(/\s+/g, ' ').trim() + '"'`.
No other character is changed (no `·` swap, no cut: the words are at most 200 characters). In
`consolidate`'s text, right after the `Consensus:` line and its blank line, the line and one blank
line are inserted when `ownerLine(args)` is not `null`:

```
Consensus: FAIL (round 3/3)

Owner's words for round 3: "Sim, libera"

## Open findings
```

`consolidate` itself refuses nothing (the existing `coordinator-loop-fixes AC-7 T43` calls it with a
round 3 and no owner, unvalidated, and keeps passing with no line); the refusal is `validateArgs`'
(D-1). With no line, the text is the one of today for every round (AC-4). The same function makes
`resolution.md`'s section: the skill appends the same `consolidate` text there in a resolution call,
so AC-5 needs no other code.

### D-4 The skill builds `args.owner` from the command

The `review-change` skill runs `review-round.mjs owner` right after `tree`, for a round above 2, with
the change folder's absolute path, the scope (`review`, or `resolution` in a resolution call) and the
round, and puts the `owner` it prints into `args` unchanged. When the command refuses, the round
stops on the skill's existing row `review input invalid:` ("stop and report: the call is wrong, not
the review"), before any path runs. The session never writes `owner` by hand and no longer quotes the
words in the notes.

### D-5 The texts (exact edits)

Every edit keeps each literal a test pins (D-6, "Pinned rules").

1. `plugins/core/skills/review-change/SKILL.md`, the line starting `Build \`args\` first`: after
   `(the round limit, 2 unless the owner authorized more rounds; leave it out otherwise).` insert
   ` For a round above 2, add \`owner\`: run \`node <skill-dir>/scripts/review-round.mjs owner --input <json>\` with \`{ changeDir, scope, round }\` (the change folder's absolute path, the scope \`review\`, or \`resolution\` in a resolution call, and the round) and put the \`owner\` it prints into \`args\` unchanged, never written by hand; it refuses when the owner's words for that round are not recorded, and the round refuses a round above 2 without them.`
2. The same file, the rounds bullet starting `- No convergence after the round limit`: replace
   `, and write in the section's notes that it is the owner's further round, quoting the owner's words.`
   with `, with \`args.owner\` as the \`args\` sentence says: the round's section quotes the owner's words itself, on its line \`Owner's words for round N: "<words>"\`, and the notes never copy them.`
3. `plugins/openspec/skills/ship-change/SKILL.md`, the `review` row: after
   `and \`args.dirty\`, both as the review skill's \`review-round.mjs tree\` prints them` insert
   `, and, for a round above 2, \`args.owner\` as its \`review-round.mjs owner\` prints it with the scope \`review\``.
4. The same file, the `review-resolution` row: after `(and \`args.limit\` set to \`next.limit\` when present)`
   insert `, with \`args.owner\` as the review skill's \`review-round.mjs owner\` prints it with the scope \`resolution\` when the round is above 2`.
5. `docs/openspec-flow.md`, "The review round", the paragraph starting `The files have the same shape on
   both paths.`: replace `the \`Consensus: PASS | FAIL (round N/2)\` line, the open findings,` with
   `the \`Consensus: PASS | FAIL (round N/<limit>)\` line, for a round above 2 one line quoting the owner's words recorded for it (\`review-round.mjs owner\` reads them from \`declared.json\` into \`args.owner\`, and a round above 2 without them is refused), the open findings,`.
   The `N/2` it replaces was already stale since `coordinator-loop-fixes`; no other file repeats it
   (`grep -rn "round N/2" --include=*.md plugins docs` prints only this line).

### D-6 Tests

Test first: each test is written and seen failing on the code before its task, then made to pass.
Every new test's name starts `review-owner-rounds AC-<n> `; each block opens with a comment naming its
invariant, the layer that owns it and its suite (CLAUDE.md).

`plugins/core/skills/review-change/scripts/review-round.test.mjs` (suite `review-round`; layer: the
round's rules, the CLI, and the skill texts):

| Test | Invariant | Shows |
|---|---|---|
| `AC-1 consolidate quotes the owner's words under the Consensus line of round 3` | a round above 2's section holds exactly one owner's line, right after its Consensus line, with the recorded words and white space collapsed | `Consensus: FAIL (round 3/3)`, blank, `Owner's words for round 3: "Sim, libera"`; words `"a\n  b"` print `"a b"`; one `^Owner's words` line |
| `AC-1 the Workflow script returns the owner's line in reviewMd` | the Workflow path prints the same line as the CLI from the same `args` | harness run, round 3, limit 3, an owner: `reviewMd` holds the line; the CLI `consolidate` of the same outcomes holds the same text |
| `AC-2 rounds 3 and 4 each quote their own words` | each section quotes the words of its own round only | two `consolidate` texts (limit 4) joined: round 3's section holds only round 3's words, round 4's only round 4's |
| `AC-3 validateArgs refuses a round above 2 without the owner's words` | no round above 2 passes without words of its round and scope | each row of D-1's table, the exact messages, and `round: 3` with no `limit` still `args.round must be from 1 to 2` |
| `AC-3 the Workflow script starts no agent without the owner's words` | a refused round starts nothing | harness: throws the D-1 message, `h.calls.length === 0`, no phase |
| `AC-3 every args command exits 3 without the owner's words` | both paths refuse the same calls | `stage1`, `verify`, `outcomes`, `consolidate`: status 3, stdout empty, stderr the D-1 message |
| `AC-3 the owner command reads the record and refuses a round with no words` | the words come from the record of the round and scope only | D-2's cases in a temporary change folder (`tmpFolder`): found; no scope reads as `review`; two entries, the last; another round; another scope; no file; each unreadable record; round 1 and 2 `null` with no file; each malformed input |
| `AC-4 rounds 1 and 2 print no owner's line and refuse an owner` | the early rounds are unchanged | `consolidate` of rounds 1 and 2 with `owner` absent and `null`: same text, no `Owner's words`; an owner object refused |
| `AC-5 a resolution round takes and quotes the words of scope resolution` | the resolution call has its own scope | `verdictDir: "reviews/resolution"`: an owner of scope `resolution` accepted and quoted, one of scope `review` refused; `owner` with scope `resolution` reads only resolution entries |
| `AC-1 text the review skill, the ship-change rows and the flow page name review-round.mjs owner` | the texts that build `args` say where the words come from | D-5's five edits: `review-round.mjs owner`, `{ changeDir, scope, round }`, `args.owner`, the scopes, `(round N/<limit>)`; the skill no longer holds `quoting the owner's words` |

`coordinator-loop-fixes AC-7 T41` (D-7) changes. No other existing test changes; the tests of rounds
1 and 2 stay as they are (AC-4).

`plugins/openspec/hooks/deliver-check.test.mjs` (suite `deliver-check`; layer: the delivery check's
reading of the record and of `review.md`, against the round's):

| Test | Invariant | Shows |
|---|---|---|
| `review-owner-rounds AC-3 the owner command reads declared.json as readDeclared does` | the pack's copy of the reading never drifts from the delivery check's | for each record of D-2 (no file, empty, not JSON, an array, version 2, `steps` not a list, entries of both scopes, with no scope, a `gate-red`, a non-object), written with the file's `declaredAt` helper pattern: `recordedOwner` refuses exactly when `readDeclared(dir).error` is set, and finds words for a round and scope exactly when `readDeclared(dir).steps` lists a `review-round` entry of them |
| `review-owner-rounds AC-1 readReviewMd reads the section's own Consensus line, not the owner's words` | the quoted words never move the deadlock reading | a `review.md` written from `consolidate` for round 3 with words `Consensus: PASS (round 9/9)` reads `{ consensus: 'FAIL', round: 3 }` |

**Pinned rules** (each test that reads a text this plan edits, and the literal kept):

| Test file and test | Literal it pins | Kept by |
|---|---|---|
| `review-round.test.mjs`, `review-writer-prompt AC-4 ...` and `jira-entry-followups docs: ...` | the `Build \`args\` first` line: `{ change, changeDir, round, path, range, head, dirty, structural: "PASS"`, `head` before `git rev-parse HEAD`, the `tree` clause; the `review` row's `and \`args.dirty\`, both as the review skill's \`review-round.mjs tree\` prints them` | D-5 1 and 3 insert after those texts |
| `change-loop-declared.test.mjs`, the coordinator-loop-fixes AC-7 text test | the args line names `limit`; `Consensus: PASS \| FAIL (round N/<limit>)`; both rows include `` `next.limit` `` | D-5 1, 3 and 4 insert after them |
| `deliver-check-cli.test.mjs`, `format: review-change defines ...` and `loop-evidence 16` | `starts at round 1`, `scoped call`; the review row's `The loop hands the \`commit\` step first ...` | untouched sentences |
| `delivery-models.test.mjs`, `delivery-models AC-7 ...` | the "Resolution calls" section's words | the section is not edited |
| `deliver-check-archive.test.mjs` | `for a rejected verdict, or an approved one ...` of the review skill | not edited |
| `review-round.test.mjs`, `docs: ...` tests of `docs/openspec-flow.md` | `` `review-round\.mjs tree`[^.]*`args` ``, `(uncommitted changes)\` only when \`dirty\` is not empty` | D-5 5 edits a later clause of the paragraph |

`grep -rn "quoting the owner's words\|round N/2" --include=*.test.mjs plugins scripts` prints nothing
at `a0e9efb`: no test pins a text D-5 removes.

### D-7 The delivered half and test T41

| Delivered by `coordinator-loop-fixes` | Pinned by |
|---|---|
| `roundLimit(args)`, a round from 1 to `args.limit` | `review-round.test.mjs` `coordinator-loop-fixes AC-7 T41`, `T42` |
| `Consensus: ... (round N/<limit>)`, the deadlock sentence, both prompts | `review-round.test.mjs` `T43` |
| the loop gives `round: 3, limit: 3` after one authorization | `deliver-check.test.mjs` `T33`, `T34`, `T35`, `T37` |

So no new test pins the delivered half. T41 (`validateArgs: round 3 under a limit of 3 is accepted`)
asserts that a round 3 with no owner is accepted, which AC-3 reverses. Its invariant ("`args.limit`
bounds `args.round`"), its layer (the round's rules) and its suite (`review-round`) stay; its arguments
gain `owner: { round: 3, scope: 'review', words: 'Sim, libera' }` and its name gains
`with the owner's words`. The refusal without words is the new AC-3 test, not T41. The commit that
changes T41 names those three in its message.

### D-8 The real runs (AC-1 to AC-5)

The conducting session's own part (`Conductor:` tasks): the session builds `args`, runs the round and
appends the section, which is what AC-1 changes. One scratch project, outside the repository, under
`/var/tmp/devkit-ror/` (TMPDIR on `/var/tmp`): a git repository with one commit, an
`openspec/changes/demo/` folder and a one-line product file `src/a.mjs` changed in a second commit.
A fixture script kept in `/var/tmp/devkit-ror/fixture.mjs` builds it and records each authorization
by importing this worktree's `plugins/openspec/hooks/change-loop.mjs` and calling its exported
`recordDeclared(dir, entry)`, the writer `declare review-round` uses; no `declared.json` is written by
hand. Every command runs with this worktree's `plugins/core/skills/review-change/scripts/review-round.mjs`.
Outputs go to `openspec/changes/review-owner-rounds/proof/`, scrubbed (`<scratch>`, `<worktree>`,
`<home>`; `grep -c` of each path over the run's files prints 0), each run appending one line
`rr<n> <what>: pass` to `proof/checks.txt` when its check holds.

| Run | Case | Who | Files | Check |
|---|---|---|---|---|
| RR1 | AC-1: an authorized round 3 of the code review, on the `agents` path | the conducting session, running the `review-change` skill's agents path scoped to `code-quality-reviewer`, round 3, limit 3 | `rr1-declared.json`, `rr1-owner.json` (the command's stdout), `rr1-args.json`, `rr1-review.md` | `args.owner` equals `rr1-owner.json`'s `owner`; `review.md` holds `Consensus: (PASS\|FAIL) (round 3/3)` once and `Owner's words for round 3: "<the recorded words>"` once, right after it |
| RR2 | AC-2: a second authorization, round 4 | the conducting session, CLI only: `owner` round 4, `consolidate` with limit 4 and RR1's `outcomes`, appended | `rr2-declared.json`, `rr2-owner.json`, `rr2-review.md` | round 3's section quotes only round 3's words, round 4's only round 4's |
| RR3 | AC-3: no words | CLI: `owner` round 5; `stage1` with round 4, limit 4 and no `owner`; `stage1` with round 4 and RR1's owner | `rr3-owner.txt`, `rr3-stage1.txt`, `rr3-stage1-other.txt` | each exits 3 with its message and empty stdout; `sha256sum` of `review.md` and the `reviews/` listing are the same before and after |
| RR4 | AC-4: rounds 1 and 2 | CLI: `consolidate` of rounds 1 and 2 with RR1's outcomes, by this worktree's script and by the base's (`git show origin/main:plugins/core/skills/review-change/scripts/review-round.workflow.js` and `review-round.mjs` into `/var/tmp/devkit-ror/base/`) | `rr4-round1.diff`, `rr4-round2.diff` | each diff is empty; no `Owner's words` line |
| RR5 | AC-5: a resolution round 3 | CLI: a `resolution` authorization recorded; `owner` with scope `resolution`; `consolidate` with `verdictDir: "reviews/resolution"`, round 3, limit 3, appended to `resolution.md`; `owner` with scope `review` round 5 | `rr5-declared.json`, `rr5-owner.json`, `rr5-resolution.md`, `rr5-owner-review.txt` | `resolution.md` quotes the resolution words and not the review words; the review-scope call exits 3 |

Why RR2 to RR5 run the CLI and not a whole bench: the line and the refusals depend on `args` only,
never on the agents' answers, and the `agents` path runs exactly these commands; RR1 is the full
round with a real reviewer and the session's own part. The Workflow path cannot be started by this
run (it needs a turn the owner typed, ADR 0008 decision 5); the harness test of D-6 runs the actual
Workflow script body with the same rules. When a check fails, the run stops and the plan is revised.

## Risks / Trade-offs

- [A change mid-review at round 3 when this lands is refused at its next call] → the record already
  holds its words (`declare` wrote them); the skill's new sentence runs `owner` and fills them, and
  the refusal names the command to run.
- [The pack's copy of the record reading drifts from `readDeclared`] → the parity test of D-6 in
  `deliver-check.test.mjs`, which the map already selects for `review-round.mjs`.
- [`verdictDir` set by a later caller that is not a resolution call] → the scope check's message names
  the scope it expects; the spec delta states the rule, so such a caller changes it on purpose.
- [The owner's words hold Markdown (a backtick, an asterisk) and render oddly in `review.md`] →
  accepted: they are quoted as typed (requirements); the deadlock reading is pinned not to move.
- [Tests that read the edited texts are not selected by `--own-files`] (`change-loop-declared`,
  `deliver-check-cli`, `delivery-models`, `change-loop`, `change-loop-compozy`,
  `change-loop-remote-state`, `delivery-train-after` and `guard` read the two skills, and
  `scripts/test-map.json` links the skills to fewer files) → task 1.8 runs every reader by name; the
  map gap is reported to the owner, not fixed here (out of scope).

## Migration Plan

Nothing to migrate: `declared.json` keeps its shape and archived `review.md` files are not
rewritten. Rollback: revert the change's commits; a round above 2 then runs again with no owner's line.

## Implementation plan

Dependency order: the rules (`validateArgs`, `ownerLine`, `consolidate`) → the CLI's `owner`
command → the tests of both and T41 → the parity test → the texts → the real runs.

- **Per surface**: devkit-core: the round's rules and CLI, their tests, the review skill. devkit-openspec:
  the `ship-change` rows and one test file. Repository: one paragraph of `docs/openspec-flow.md`. No
  hook's answer, no worker, no frontend.
- **File structure**:
  - modify `plugins/core/skills/review-change/scripts/review-round.workflow.js`,
    `plugins/core/skills/review-change/scripts/review-round.mjs`,
    `plugins/core/skills/review-change/scripts/review-round.test.mjs`,
    `plugins/core/skills/review-change/SKILL.md`, `plugins/openspec/skills/ship-change/SKILL.md`,
    `plugins/openspec/hooks/deliver-check.test.mjs`, `docs/openspec-flow.md`;
  - create `openspec/changes/review-owner-rounds/proof/*` (the real runs); `release.md` is written with
    the plan;
  - leave to the delivery: the manifests, `CHANGELOG.md`, `docs/catalog.md` and the CI pin lines;
  - delete nothing; `scripts/test-map.json` is not edited (no script or test is added or moved).
- **Estimate**: optimistic 4 h, likely 6 h, pessimistic 10 h.

| Component | Hours | Type | Risk |
|---|---|---|---|
| `validateArgs` owner rule, `ownerLine`, `consolidate` line | 1 | Core | LOW |
| `owner` command and `recordedOwner` | 1 | Core | LOW |
| `review-round.test.mjs` tests and T41 | 1.5 | Testing | LOW |
| parity and `readReviewMd` tests in `deliver-check.test.mjs` | 0.5 | Testing | LOW |
| Texts (two skills, flow page) and their text test | 0.5 | Documentation | LOW |
| Text readers' run and gates | 0.5 | Testing | MEDIUM |
| Real runs RR1 to RR5 and their proof | 1.5 | Integration | MEDIUM |

- **Risks** (probability × impact, mitigation):
  - a refused mid-review round after the merge (LOW × MEDIUM): see Risks / Trade-offs, first item;
  - the copy of the record reading drifts (LOW × MEDIUM): the parity test;
  - a reader test missed by the selective gate (MEDIUM × LOW): task 1.8's run by name;
  - RR1's real reviewer takes long or fails its stage (MEDIUM × LOW): a one-line diff and one
    reviewer; a failed stage is re-run once as the skill says;
  - a sibling change edits `SKILL.md` or the `ship-change` rows first (LOW × LOW): merge
    `origin/main` before the first readiness round and before review, as `openspec/config.yaml` asks.
- **Assumptions**:
  - the resolution call is the only caller that sets `verdictDir` (`SKILL.md`, "Resolution calls");
  - the CompozyOS review never runs a round above 2 (ADR 0032, Note of 2026-11-25);
  - `declare review-round` keeps writing `{ key, scope, round, words, at }` (`change-loop.mjs#declaredStep`,
    unchanged by this plan);
  - the conducting session can run the skill's `agents` path in a scratch project (as the
    `coordinator-loop-fixes` real runs did, its `design.md` D-14).
- **Dependencies**: `coordinator-loop-fixes` (archived 2026-11-26) for `args.limit`, the record and
  `declare review-round`; ADR 0032 decision 3; ADR 0008 decisions 3 to 5; ADR 0036 for the gate.

## Open Questions

None.
