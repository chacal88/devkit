# Design

Change: `review-workflow` · Date: 2026-11-11 · Owner: Kaue (chacal88) · PRD / tech spec: n/a

## Context

The motivation is in proposal.md, under Why. This design builds on these pieces of devkit-core 0.5.3
and devkit-openspec 0.11.0.

**The review round today.** `plugins/core/skills/review-change/SKILL.md`:

- step 3 (line 46) picks the bench from the matrix. A caller's scoped list skips it ("Scoped
  calls", line 109).
- step 4 (line 63) fires one `Agent` call per reviewer in a single message.
- step 6 (line 78) normalizes verdicts, decides by consensus and counts rounds (two at most, round 2
  re-summons only the reviewers that failed, a stale-only re-review is round 1).
- "Finding dispositions" (line 97) defines ` · fixed in <sha>` / ` · refuted: <evidence>`.
- The Output section has the session write `review.md`, and each reviewer writes its own
  `reviews/<reviewer>.md`.

**The reviewers.** `plugins/core/agents/{code-quality,test-coverage,architecture,security,adr,spec}-reviewer.md`
each have a "Verdict file" section (code-quality line 96, test-coverage 79, architecture 115,
security 81, adr 66, spec 64):

- line 1 `Verdict: approved | rejected` (security also `declined`);
- line 2 `Commit: <full sha>[ (uncommitted changes)]`;
- findings tagged `[blocking]` / `[important]` / `[nit]` / `[praise]`;
- dispositions on a re-review.

Their tools are `Read, Glob, Grep, Bash, Write`. Only `plan-readiness-reviewer` has a rule to ignore a
verdict the caller suggests. `docs/openspec-flow.md` ("How roles work") says the same of every
reviewer, so stage 3 must not suggest a verdict (D6).

**The one-writer rule.** `plugins/openspec/hooks/guard.mjs`:

- `role()` (line 60) takes `agent_type` from the hook input and strips the `devkit-core:` prefix.
- `classify()` (line 197) makes `reviews/<name>.md` a gate file owned by `<name>`.
- `writeViolation()` (line 218) refuses it to anyone else. Roles in `REVIEWERS` (line 47) may
  write nothing else.

This change does not edit `guard.mjs`.

**The checker.** `plugins/openspec/hooks/deliver-check.mjs`:

- `findingsItem` (line 338) lists, as `undisposed`, every `[blocking]` / `[important]` line with
  neither a ` · fixed in <sha>` in history nor a ` · refuted: <non-empty>`.
- `nextStep` (line 957) sends reviews that are rejected and current to `fix-review` (line 996).
  Every other reviewer with an undisposed finding joins `toReview` (line 1001) and gets `review`.
- `readReviewMd` (line 1066) reads the last `Consensus: PASS | FAIL (round N/2)` line of
  `review.md` for the deadlock stop and the round number. It is the only thing the checker reads
  from `review.md`.

**The callers.**

- `plugins/openspec/skills/ship-change/SKILL.md`, row `review` (line 41) and row `fix-review`
  (line 42).
- `plugins/openspec/skills/conduct/SKILL.md`, Delivery rows item 5 (line 104). Conduct also
  defines which turn may do what (Start 5) and `--busy`.

Both refer to their own files by `<skill-dir>` (for example `node <skill-dir>/../../hooks/deliver-check.mjs`):
a skill gets its base directory when it loads. A skill under `plugins/<pack>/skills/<name>/` may
carry `scripts/` with tests that `guard.test.mjs` imports (`openspec-setup/scripts/*.test.mjs`,
lines 15-17).

**The decisions.** ADR 0001 (Decision: "runs only that step as a subagent of the session the
owner typed in", "no state outside the repository and GitHub") is the decision this change makes
an exception to. ADR 0006 (Decision 1: "the reviews ... stay with the conducting session") is
untouched, because the Workflow runs in that session. ADR 0002's `devkit-reviews` check reads only
the files, which keep their form.

**The real case.** Round 1 of release-rebase-pin left
`af4055a:openspec/changes/release-rebase-pin/reviews/test-coverage-reviewer.md` with
`Verdict: approved` and an open `- [important] [6] "at every rebase stop" has no multi-stop test: ...`.
`deliver-check` answered `review`. That is retro item (e) and AC-6.

## Goals / Non-Goals

**Goals:**

- One definition of the round's rules: which findings are verified, the majority, the disposition
  text, the verdict a file must carry, the consensus and `review.md`. Both paths run it, and one
  test set covers it.
- The gate files keep their single writer, and the session never writes or copies a verdict.
- Everything the Workflow path does can be replayed by the `agents` path from the files, and a
  killed round is just re-run (ADR 0001's resumability): D6 says when (a result that cannot be read,
  a notice that never comes) and how (the whole round on the `agents` path).
- `node --test` proves the logic and the orchestration shape. The run-time facts that only the
  host can prove are named, and they become the dogfood list. AC-1 to AC-3 are worded to what the
  tests prove (the script under the harness, the `agents` path, the fallbacks); their live half is
  that dogfood list (D16).

**Non-Goals:**

- Using the Workflow tool for any other step, or a saved workflow under `.claude/workflows/`.
- Changing the matrix, the round rules, the eight items, the guard, or the first two lines of a
  verdict file.
- Making `/conduct`'s continuation turns eligible for the Workflow path (that is the tool's
  opt-in, not ours).

## Decisions

### D1. No spec delta

`openspec list --specs` prints "No specs found", and the ten archived changes all set
`skip_specs: true`. `.openspec.yaml` of this change now sets it too. The behaviour lives in the
acceptance criteria, the tests (D16) and `docs/openspec-flow.md`.

### D2. Where the script lives (the AMBIGUOUS item): a file in the pack, passed by `scriptPath`

Resolved as option (b):
`plugins/core/skills/review-change/scripts/review-round.workflow.js`. The skill passes it as
`scriptPath: <skill-dir>/scripts/review-round.workflow.js`, the same `<skill-dir>` form that
`ship-change` and `conduct` already use for their hooks.

Why (b) over (a):

- A file on disk can be loaded by `node --test`. The rules section and the whole orchestration run
  under a test harness (D16). A script inside `SKILL.md` would have to be cut out of Markdown
  first.
- The session does not retype about 200 lines on every round. With option (a) the script crosses
  the model's output on every call, which costs tokens and invites a copy slip that no test sees.
- The `agents` path (D7) reads the same rules from the same file through the CLI (D3). There is one
  copy.
- `SKILL.md` stays prose that the matrix and the round rules can be read in.

Fallback inside (b): if the tool refuses a `scriptPath` outside the project (not verifiable here,
see "Workflow tool facts"), the session reads the file and passes its text verbatim as `script`.
The text is still the file's, never retyped. If the tool refuses that too, the `agents` path runs.

Rejected: (c) `name` with a saved workflow in `.claude/workflows/`. It would install a copy of the
script into every project, which ADR 0004's "per project" setup does not do. That copy would drift
from the pack on every update and be state outside the pack. ADR 0008 rules it out.

### D3. One source for the rules: the script's rules section, loaded by a CLI

`review-round.workflow.js` has three parts, in this order:

```text
export const meta = { name: 'review-round', description: '<one sentence>', phases: ['review', 'verify', 'write'] }

// ---- rules: begin   (pure: no tool globals, no import/require/process/fs, no Date.now/Math.random)
STAGE1_SCHEMA, VOTE_SCHEMA, WRITE_SCHEMA            JSON-schema literals (D4)
validateArgs(args)                    -> args | throws 'review input invalid: <what>'
validateStage1(reviewer, value)       -> normalized stage-1 return | throws 'review input invalid: <what>'
needsVerification(finding)            -> boolean (D5)
isRefutation(vote)                    -> boolean (D5)
decide(votes)                         -> { refuted, refutations, evidence }   (D5)
oneLine(text, max)                    -> string (D5)
findingLine(finding)                  -> '- [<sev>] <location> — <text>[ · <disposition>]'
outcomeOf(args, stage1, votesById)    -> outcome (D6)
consensusOf(outcomes)                 -> 'PASS' | 'FAIL'
reviewerPrompt(args, entry)           -> string (stage 1)
verifierPrompt(args, entry, finding)  -> string (stage 2)
writerPrompt(args, outcome)           -> string (stage 3)
consolidate({ args, outcomes, failed, notes }) -> { consensus, text }   (D8)
// ---- rules: end

<orchestration: the three stages with agent(), parallel(), phase(), log(), args (D4)>
```

`plugins/core/skills/review-change/scripts/review-round.mjs` is the loader and the CLI.

- `loadRules(file = <the script>)` reads the script and takes the text between the two markers.
  It returns the named functions and constants from
  `new Function(`${section}\nreturn { <names> };`)()`.
- A missing marker or a missing name throws `review usage: rules section not found in <file>`.
- It exports `loadRules` and, for tests and other modules, the loaded functions as named
  exports.
- The CLI subcommands are listed in D15.

Why: the `agents` path must apply the same majority, disposition text and prompts as the script.
A second copy in prose or in a module would drift, and the lesson is "one function, one test
set". The tool forbids `import` inside the script, so the module reads the script, never the other
way round.

Rejected:

- A pure `.mjs` module, with a copy pasted into the script and a test comparing
  `fn.toString()`. That is two physical copies: the test catches drift, but every rule edit is made
  twice.
- A build step that generates the script. It is one more tool, and `gen-catalog.py` would grow a
  job it does not own.

### D4. The three stages and their contracts

**`args`** (Workflow `args`, and the CLI's `args` field), validated by `validateArgs`:

```text
{ change: '<id>', changeDir: 'openspec/changes/<id>', round: 1 | 2, path: 'workflow' | 'agents',
  range: '<base>..HEAD' | '<sha>..HEAD', structural: 'PASS', preamble: '' | '<worktree preamble>',
  bench: [ { reviewer: '<one of the six>', previous: null | '<path of its verdict file>', range: null | '<its Commit>..HEAD' } ] }
```

- `bench` has 1-6 distinct names from the six reviewers.
- `structural` must be `PASS`: the session runs the structural check (step 2) before any stage,
  as today.
- `preamble` is the conduct worktree preamble. Every prompt starts with it, verifiers' prompts
  included.

**Stage 1, review** (phase `review`): one `agent(reviewerPrompt(args, e), { agentType: 'devkit-core:' + e.reviewer, schema: STAGE1_SCHEMA, label: e.reviewer, phase: 'review' })`
per bench entry. All of them go inside one `parallel()`, so every reviewer starts before any
returns (AC-1). `STAGE1_SCHEMA`:

```text
{ declined: boolean, commit: '<40 hex>', uncommitted: boolean, heading: '<the "## ..." title line>',
  findings: [ { id: 'F<n>', severity: 'blocking'|'important'|'nit'|'praise', location: '<file:line or section>',
                text: '<one line>', disposition: null | 'fixed in <sha>' | 'refuted: <evidence>' } ],
  sections: '<the rest of the reviewer\'s output, Markdown, without the findings list>' }
```

- A finding with a `disposition` is a re-listed previous finding (a round-2 re-review).
- `validateStage1` checks the shape, gives ids to findings that lack one (`F1`, `F2`, ... in order),
  and makes `text` and `disposition` one line.
- A `null` return (a failed agent), or a value that fails validation, is a failed stage
  (`review stage failed: <reviewer> review`, D6).

**Stage 2, verify** (phase `verify`): for each reviewer that passed stage 1, and each of its
findings where `needsVerification(f)` holds, three thunks
`agent(verifierPrompt(args, e, f), { agentType: 'devkit-core:finding-verifier', schema: VOTE_SCHEMA, label: '<reviewer> <id> v<k>', phase: 'verify' })`,
`k` = 1..3. All of them run in one `parallel()`. `VOTE_SCHEMA` is
`{ refuted: boolean, evidence: '<code at file:line, a test and its output, or a command and its output>' }`.

**Stage 3, write** (phase `write`): for each reviewer that passed stage 1,
`agent(writerPrompt(args, outcome), { agentType: 'devkit-core:' + reviewer, schema: WRITE_SCHEMA, label: '<reviewer> write', phase: 'write' })`,
all in one `parallel()`. `WRITE_SCHEMA` is `{ written: boolean, verdict: 'approved'|'rejected'|'declined', commit: '<40 hex>' }`.
A `null` return, or `written: false`, is `review stage failed: <reviewer> write`.

**Result** (the script's final value):

```text
{ version: 1, path: 'workflow', change, round,
  outcomes: [ outcome ... ],                          // D6, one per reviewer that passed stage 1
  failed: [ { reviewer, stage: 'review'|'write', error: 'review stage failed: <reviewer> <stage>' } ],
  verifiersFailed: <count of null votes>,
  consensus: 'PASS'|'FAIL', reviewMd: '<consolidate().text>' | null }   // null when failed is not empty
```

The stages are barriers (all reviewers, then all verifiers, then all writers). That matches
`meta.phases`, keeps the harness deterministic and caps the wall time at three slow agents.
Rejected: a per-reviewer `pipeline()`, which is faster when one reviewer is slow but interleaves
phases and makes the call-order assertions of AC-1 weaker.

### D5. The verification rule

- `needsVerification(f)`: `f.severity` is `blocking` or `important`, and `f.disposition` is
  `null`. `nit` and `praise` are never verified (AC-2). A previous finding already marked
  `fixed in` / `refuted:` is not verified again. A finding that stays open in round 2 is verified
  again, because the code under it changed.
- Independence: each verifier gets the change id, `args.range`, the finding's reviewer, its
  `findingLine`, and the instruction to try to refute it from the code, the tests and the plan. It
  does not see the other verifiers or their votes, the reviewer's other findings, or any verdict.
  The three prompts are identical: independence comes from three separate contexts. Rejected:
  giving each verifier a different lens (code / tests / ADRs). A lens that does not fit the finding
  can never refute it, so 2 of 3 would become unreachable for findings that only one lens can
  judge.
- `isRefutation(v)`: `v` is not `null`, `v.refuted === true`, and `v.evidence.trim()` is not empty.
  A failed verifier (`null`) and a refutation with no evidence both count as "not refuted".
- `decide(votes)`: `refutations` is the number of `isRefutation`. The finding is `refuted` when
  `refutations >= 2` (AC-2). `evidence` joins the refuting verifiers' evidence, each made one line,
  with ` / `.
- `oneLine(text, max = 400)`:
  - newlines and runs of whitespace become one space;
  - every `·` becomes `-`, so evidence can never forge a ` · fixed in <sha>` that `findingsItem`
    would read as a fix;
  - the result is trimmed and cut at `max` with `…`.

  `deliver-check`'s regex `·\s*refuted:\s*\S` then matches the disposition line, which a
  cross-pack test pins (D16).

### D6. Writing the file (stage 3) and checking it

`outcomeOf(args, stage1, votesById)` returns:

```text
{ reviewer, declined, commit, uncommitted, heading, sections,
  findings: [ { ...finding, status: 'open'|'refuted'|'disposed', disposition } ],
  lines: [ findingLine(f) ... ],          // every finding, in stage-1 order, refuted ones with ' · refuted: <evidence>'
  verified: <findings sent to verifiers>, refuted: <findings refuted>,
  verdict: declined ? 'declined' : (no blocking/important with status 'open' ? 'approved' : 'rejected') }
```

`writerPrompt(args, outcome)` tells the same agent type (stage 3 of a staged round) to write
`<changeDir>/reviews/<reviewer>.md`, overwriting it, and nothing else. The file is:

- line 1: its verdict line, **by its own rules, from the findings below**;
- line 2: `Commit: <outcome.commit>` plus ` (uncommitted changes)` when `uncommitted`;
- a blank line, `heading`, a blank line, `### Findings`, `lines` verbatim, a blank line, and
  `sections`.

It must not review again, and must not change, add or drop a finding.

The prompt never states a verdict. The writer applies its existing rule ("never `approved` with
an open `blocking`, or an `important` without a fix or contest") to the lines it is given. The
script's `outcome.verdict` is used only to check the result. This keeps the reviewers' "ignore a
verdict the caller suggests" posture true (Context). Refuted lines already carry their
disposition, so the rule yields `outcome.verdict` (AC-3).

After the round, the session checks every written file. It uses the CLI `check-file` (D15), one
function for both paths:

- line 1 is `Verdict: <outcome.verdict>`;
- line 2 is the commit line;
- every `[blocking]` / `[important]` entry of `outcome.lines` appears verbatim.

On `review file mismatch:` the session runs stage 3 again for that reviewer with the Agent tool,
once, and checks again. A second mismatch stops the round and goes to the owner with the error.
The session never edits the file itself.

Failures and what the session does:

| result | session action |
|---|---|
| `failed` has `review stage failed: <r> review` | run that reviewer's three stages with the Agent tool (D7), then consolidate |
| `failed` has `review stage failed: <r> write` | run stage 3 for that reviewer with the Agent tool, from `outcomes[r]` |
| `check-file` → `review file mismatch:` | stage 3 again with the Agent tool, once; then stop and report |
| the Workflow call itself errors or is refused | the whole round on the `agents` path, with a note `Workflow refused: <first line>` |
| the notice arrives, but the result is missing, is not an object, or lacks a D4 field (`version: 1`, `path: 'workflow'`, the call's `change` and `round`, the `outcomes` and `failed` lists, `reviewMd` a string or `null`) | the whole round on the `agents` path, with a note `Workflow result invalid: <the first missing or wrong field>` |
| no completion notice: on a later turn (the owner's message, a continuation, an Auto-fix wake, another task's notice) the Workflow task is no longer listed as running, or the owner says the round is dead | drop the busy mark (`ship-change` may recompute; `conduct` leaves the id out of `--busy`) and run the whole round on the `agents` path, with a note `Workflow lost: no completion notice` |
| `review input invalid:` (args or CLI input) | stop and report: a bug in the skill's call, not a review result |

The two rows for an accepted call cover the facts the repository cannot verify: how the script
hands back its result, and whether the notice comes ("Workflow tool facts"). The result check is
the session's, on the fields above; it does not re-validate each outcome, because `check-file`
checks every written file anyway. For the lost round:

- While the task is still listed as running, the change stays busy, and the session prints one
  line: the review round of `<change>` is still running as a Workflow.
- When the session cannot see the task's state, it treats the task as running, and the same line
  adds that the owner can say the round is dead to re-run it with the Agent tool. So the round
  never hangs without a way out.
- The lost attempt appends nothing to `review.md`, and the re-run is the same round N, so round
  counting does not move.
- A notice that arrives after the re-run started is not consolidated. If it lands after the
  re-run's `check-file`, the session runs `check-file` again against the re-run's outcomes and
  follows the mismatch row (its writers may have overwritten a file).

### D7. Which path runs

`review-change` runs the `workflow` path only when all of these hold:

1. the Workflow tool is among the session's tools;
2. the current turn began with the owner's own typed message. It is not a `<side-sessions-event>`
   continuation, an Auto-fix wake, a background task notification or a scheduled prompt;
3. the skill the owner invoked, or a skill on its chain, names the Workflow tool. `review-change`
   itself does, and `ship-change`'s `review` row and `conduct`'s Delivery row 5 will say "through
   the Workflow tool as `review-change` describes", so the tool's "a skill whose instructions tell
   you to call Workflow" form holds.

On any other turn it runs the `agents` path: the same three stages with the Agent tool.

- Stage 1 sends one message with one `Agent` call per reviewer
  (`subagent_type: devkit-core:<reviewer>`). The prompts come from `review-round.mjs stage1`, and
  each prompt asks for the stage-1 object as the last fenced `json` block.
- Stage 2 sends one message with every verifier call (`subagent_type: devkit-core:finding-verifier`).
  The prompts come from `review-round.mjs verify`.
- Stage 3 sends one message with every writer call. The prompts come from `review-round.mjs outcomes`.

The CLI's inputs are JSON files in the scratch or temp folder, never in the repository. Its
outputs are the same objects the script builds. AC-5 follows.

The Workflow call returns at once and runs in the background. Until its completion notification,
the change's review step is running:

- `ship-change` does not recompute that change: a recompute would see missing or stale reviews and
  start a second round;
- `conduct` passes the id in `--busy`.

The busy mark also ends when the round is declared lost (D6, no completion notice).

On the notification, the session finishes the round (D6 checks, D8 `review.md`), prints the
skill's Output, and the caller recomputes.

In `/conduct`, the `review` step usually lands on a continuation turn after the last phase's child
ends. There it runs the `agents` path. This is expected and is stated in the docs and in ADR 0008.

### D8. `review.md`

The session appends one section per call. It creates the file on the change's first review:

```text
# Review: <change>, round <N>

Path: <workflow|agents> · range `<range>` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| <reviewer> | <approved|rejected|declined> | <n> | <n> | <n> | <n> | <first 7 of sha> |

Consensus: <PASS|FAIL> (round <N>/2)

## Open findings
- <reviewer> — [<severity>] <location> — <text>        ("None." when empty)

## Refuted by verification
- <reviewer> — [<severity>] <location> — <text> · refuted: <evidence> (<refutations> of 3)

## Notes
- <one line per note: "completed with the Agent tool: <reviewers>", "verifiers failed: <n>", "Workflow refused: <reason>", "Workflow result invalid: <field>", "Workflow lost: no completion notice">

## Next
Ready to ship. | Fix the open findings, then run review-change again (round <N+1>). | Consensus deadlock after round 2: the owner decides.
```

- `consolidate()` produces the section, and `consensusOf` decides it. The consensus is `PASS` only
  when every outcome is `approved` or `declined` and `failed` is empty.
- The `Consensus:` line keeps the exact form `readReviewMd` parses (a cross-pack test pins it), so
  the deadlock stop and the round number work unchanged.
- Each reviewer's verdict, the verified and refuted counts, the consensus, the round and the path
  are all present (AC-4). The gate still does not read `review.md` (the CI check reads only
  `reviews/` and `evidence.md`).

### D9. A read-only verifier agent: `devkit-core:finding-verifier`

New `plugins/core/agents/finding-verifier.md`:

- frontmatter: `tools: Read, Glob, Grep, Bash`, with no `Write` or `Edit`; `model: sonnet`; a
  description with "Use when";
- receives: one finding, the change and its range;
- method: read the cited code and its callers; run at most one scoped test or command; check the
  plan, the ADRs and the conventions the finding invokes;
- returns `Refuted: yes | no` and `Evidence: <one line>`, or the caller's schema;
- Never: write or edit any file, commit, see or ask for other verdicts, or refute without
  evidence.

Why a new agent and not an existing type:

- With no `agentType` you get a general-purpose agent. It has `Write` and `Edit`. In a
  `devkit-lite` project the guard lets such an agent edit product code. It would not be read-only
  by construction.
- The reviewer's own type carries "write your verdict file" in its system prompt, and the guard
  lets it write `reviews/<reviewer>.md`. It is not independent of the finding's author either.

The verifier is not a reviewer type: it is not in the matrix, writes no gate file and is not added
to `guard.mjs`'s `REVIEWERS` (the guard is out of scope). Without a `Write` tool it cannot use
Edit/Write. A shell write is still judged by the guard as for any agent. Adding it to the
"writes nothing" roles is a follow-up for a guard change (Risks).

### D10. The reviewers' staged-round paragraph

Each of the six reviewer agents gains, at the end of its "Verdict file" section, a `### Staged round`
paragraph with the same meaning:

- **stage 1**: when the caller says the round is staged, review as usual but write no file; return
  the shape the caller asks for (verdict and commit as you would write them, the findings with
  severity, location, text and any disposition, the rest as `sections`);
- **stage 3**: when the caller gives you your stage-1 output and the verification outcome, write
  your verdict file as given, with refuted findings carrying the ` · refuted: <evidence>` given
  and survivors open with their severity, and your verdict line by your own rules; do not review
  again.

This is the only edit to the reviewers' prompts (requirements: "beyond returning findings to the
script and writing dispositions"). A text test pins its presence in all six.

### D11. `deliver-check`: an approved review with an undisposed finding is `fix-review`

In `nextStep`, right after the `stop-review-deadlock` check:

```text
approvedOpen = uniq(undisposed reviewers r where state.reviews has r with current && approved(r.verdict))
fix = uniq([...rejectedNow, ...approvedOpen])
if fix.length: step('fix-review', <reason>, { reviewers: fix, findings: undisposed.filter(f => fix.includes(f.reviewer)) })
```

- `<reason>` joins `"<rejectedNow> rejected at the current commit"` and
  `"<approvedOpen> approved with an undisposed finding"` with `; `, leaving out an empty part.
- `toReview` keeps its three sources. An undisposed finding of a stale review still gives
  `review`, because the re-review re-lists it with a disposition.
- The deadlock check still uses `rejectedNow` only.

The eight items, their met/open rules, `--ci` and the JSON (`next.reviewers`, `next.findings`, same
shapes) do not change.

Existing tests:

- "nextStep row 8" (`deliver-check.test.mjs:1257`) is unchanged.
- "nextStep row 9: missing reviewers and approved reviewers with undisposed findings are reviewed"
  (line 1300) stays green as written. Its undisposed `security-reviewer` has no entry in
  `state.reviews`, so it is not "approved and current", and it gets `review`. The test is left
  untouched.
- The walkthroughs (`driveToReady`, line 1669, and "walkthrough (merge)", line 2242) never write
  an approved file with an open finding, so their step lists do not move.

New tests are in D16.

### D12. Skills and docs

- `review-change/SKILL.md`:
  - step 4 becomes "Run the round in three stages": the path rule (D7), the Workflow call
    (`scriptPath`, the inline fallback, `args`), the `agents` path with the CLI commands,
    "busy until the completion notice", and D6's result check and lost round (with the notes
    `Workflow result invalid` and `Workflow lost: no completion notice`);
  - step 6 states the verification rule (D5) and the verdict rule;
  - the Output part names `review.md`'s new header, table and sections (D8) and the `check-file`
    step (D6);
  - "Never" gains four rules: run the Workflow path on a turn the owner did not type; use the
    Workflow tool for anything but this round; write or fix a `reviews/` file from the session or a
    verifier; send `nit` / `praise` to verifiers;
  - the `description` adds "verifies each blocking or important finding with three refuting
    agents" (kept under about 500 characters, with its "Use after" clause);
  - by the conventions, no ADR number appears in a core asset.
- `ship-change/SKILL.md`:
  - row `review`: "Run the `review-change` skill on change <id> through the Workflow tool as it
    describes (its `agents` path on a turn the owner did not type), scoped ...; until the round's
    completion notice the change's review is running: do not recompute it, unless `review-change`
    declares the round lost";
  - row `fix-review`: `next.findings` may come from an approved review with an undisposed finding.
- `conduct/SKILL.md` Delivery rows item 5: the same wording, plus "pass the id in `--busy` until
  the notice, or until the round is declared lost; on a continuation turn or an Auto-fix wake the
  round runs on the `agents` path".
- `docs/openspec-flow.md`:
  - a new `## The review round` before `## The delivery contract`: stages, paths, the opt-in, the
    verification rule, the files, `review.md`, the `fix-review` change, and ADR 0008 as a link;
  - the "One writer per gate file" row of the gates table: "`finding-verifier` writes nothing";
  - Cost: a bullet on the extra runs (R reviewers + 3 per open blocking/important finding + R
    writers);
  - Limits: the Workflow path runs only on the owner's typed turn;
  - a troubleshooting row: `review.md` says `Path: agents` on a typed turn → the host has no
    Workflow tool, or the tool refused (see the Notes line);
  - the CI pin.
- `plugins/core/README.md`: the Review row of "The path through a change" names the three stages.
  The catalog gains `finding-verifier` through `gen-catalog.py`.
- `README.md`: the paragraph "Coordination is allowed; a harness is not." gains one sentence: the
  reviewer round may run as one Workflow script inside your session, an exception recorded in
  ADR 0008 (link).

### D13. ADR 0008 (draft; written as `docs/adr/0008-reviews-as-a-workflow.md` in task 2.4)

The name proposed in requirements.md is confirmed. The draft text:

```markdown
# ADR 0008: The reviewer round may run as one Workflow script

- Status: accepted
- Date: 2026-11-11
- Change: review-workflow

## Context

ADR 0001 lets devkit coordinate, never through a harness: a coordinating skill runs only the next
step as a subagent of the session the owner typed in, with no state outside the repository and
GitHub. The reviewer round is one such step, and the costliest: the matrix picks two to six
reviewers, each a foreground subagent whose verdict lands in the session's context. A false
`blocking` or `important` finding costs a fix round, and nothing checks it before it does. Claude
Code now offers a Workflow tool: a script, run in the background inside the session, that starts
subagents of that session in parallel and returns one structured result. The harness accepts it only
when the owner opted in on their own turn. In the grill of `review-workflow` the owner chose to
run the round as such a script, with three refuting verifiers per blocking or important finding
before any verdict file is written, and the same stages through the Agent tool wherever the tool
cannot run.

## Decision

1. The reviewer round of the `review-change` skill (and so the `review` step of `ship-change` and
   `/conduct`) may run as one Workflow script, in three stages: the reviewers in parallel, the
   verifiers, the reviewers writing their verdict files. No other step of devkit runs through the
   Workflow tool.
2. Inside the session: the script runs in the session the owner's turn started, as that session's
   background task. It starts subagents of that session only, starts no session, schedules nothing,
   and ends with the round.
3. No state outside the repository and GitHub: the script gets everything through its arguments and
   returns its result to the session. It is a file of the devkit-core pack, passed by path, never a
   saved workflow in the project. A killed round is run again from the files, like any step.
4. The gates do not change: each `reviews/<reviewer>.md` is written by that reviewer's agent type,
   verifiers write nothing, the session writes only `review.md`, and the delivery contract, the
   `Verdict:` and `Commit:` lines and the hooks' writer rules stay as they are. The owner's plan
   approval remains a human gate.
5. The script runs only on a turn the owner typed, through a skill that names the tool. On any other
   turn (a continuation, an Auto-fix wake, a task notification), or on a host without the tool, the
   session runs the same three stages with the Agent tool, and the files have the same shape.
   `review.md` names the path that ran.

## Consequences

- Positive: every blocking or important finding is checked by three independent agents before it
  costs a round; the reviewers start together; the session's context holds one result instead of
  every verdict; the round's rules exist once, in the pack, under one test set.
- Negative: a round runs more agents: the reviewers, three verifiers per open blocking or important
  finding, and the reviewers again to write (Accepted: `nit` and `praise` are never verified, and a
  refuted finding saves a fix round). Two paths must stay equal (Mitigated: both read the rules and
  prompts from the script's one rules section). In `/conduct` the review step usually lands on a
  continuation turn, where only the Agent-tool path is allowed (Accepted: the files are the same).
  A refutation by a majority of agents of the same model can drop a real finding (Mitigated: a
  refutation counts only with evidence, and the refuted finding stays listed in the verdict file
  and in `review.md`, with that evidence).

### Review trigger

The Workflow tool is proposed for any other step; the script needs state outside the repository and
GitHub (a saved workflow, a file outside the change folder); the tool's opt-in changes (automated
turns accepted, or the owner's turn no longer enough); a verdict file written from a Workflow agent
is not seen by the hooks with that agent's type.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| Keep the Agent tool only | Nothing new | Verification multiplies foreground calls in one turn; every verdict and vote lands in the session's context | low |
| Run the whole delivery as a Workflow | One engine | A harness inside the session, the thing ADR 0001 rules out; long-lived state in the tool | high |
| Verify after the file (the reviewer writes, the verifiers amend it) | The file exists early | Two writers per gate file; the guard refuses it | medium |
| A saved workflow in `.claude/workflows/` | Short call | A copy per project that drifts from the pack; state outside the pack | low |
| More reviewers instead of verifiers | No new agent | Whole reviews cost more than one refutation each; no majority on a single finding | low |
```

ADR 0001's Note gains one sentence after its ADR 0007 clause: "Running the reviewer round as one
Workflow script inside the session is an exception recorded in ADR 0008
(0008-reviews-as-a-workflow.md)." `openspec/config.yaml` `context:` → `ADRs:` gains
`; 0008 reviews as a workflow`.

This ADR is an exception, not a superseder. ADR 0001's Decision still governs everything else, the
way ADRs 0006 and 0007 are recorded. The owner decided it in the grill (question 1).

### D14. Release

- devkit-core 0.5.3 → **0.6.0** (a new script and CLI, a new agent, skill behaviour), in
  `plugins/core/.claude-plugin/plugin.json` and its `.claude-plugin/marketplace.json` entry.
- devkit-openspec 0.11.0 → **0.12.0** (a `nextStep` change, skill text), in
  `plugins/openspec/.claude-plugin/plugin.json` and its marketplace entry.
- Marketplace `metadata.version` 0.12.0 → **0.13.0**. `check_changelog` requires the heading
  `## 0.13.0 — reviews as a workflow`.
- The CI pin in `docs/openspec-flow.md` (lines 460, 461 and 468) moves to `v0.12.0` with
  `setPins` from `plugins/openspec/hooks/release-rebase.mjs`, as release-rebase-pin did.
- `python3 scripts/gen-catalog.py` regenerates `plugins/core/README.md` and `docs/catalog.md`
  (the new agent, and the review-change description).

### D15. CLI, exit codes and error prefixes

```text
node <skill-dir>/scripts/review-round.mjs stage1      --input <json>   # { args }                          -> { jobs: [{ reviewer, agentType, prompt }] }
node <skill-dir>/scripts/review-round.mjs verify      --input <json>   # { args, stage1: { <r>: obj|text } } -> { jobs: [{ reviewer, id, k, agentType, prompt }], failed }
node <skill-dir>/scripts/review-round.mjs outcomes    --input <json>   # { args, stage1, votes: { '<r>#<id>': [obj|text|null x3] } } -> { outcomes, failed, verifiersFailed }
node <skill-dir>/scripts/review-round.mjs consolidate --input <json>   # { args, outcomes, failed, notes } -> { consensus, text }
node <skill-dir>/scripts/review-round.mjs check-file  --input <json>   # { file, outcome }                 -> { ok: true }
```

- Text values (the `agents` path) are read from their last fenced `json` block, then validated
  like the script's objects. A missing block is `review stage failed: <r> review` in `failed`, not
  a CLI error.
- Output is JSON on stdout.
- Exit codes: `0` ok; `2` `check-file` mismatch; `3` usage or input error.

| prefix | where | the caller must |
|---|---|---|
| `review usage:` | unknown subcommand, missing `--input`, unreadable file, rules section not found | fix the call (a skill bug) and stop |
| `review input invalid:` | `validateArgs` / `validateStage1` / a vote that is neither object, text nor `null`; also thrown by the script | stop and report: the call is wrong, not the review |
| `review stage failed: <reviewer> <review\|write>` | a `failed` entry (script result, `verify`, `outcomes`) | re-run that reviewer's stage(s) with the Agent tool (D6) |
| `review file mismatch: <file>: <what>` | `check-file`, exit 2 (a missing file included) | re-run stage 3 for that reviewer once, then stop |

Each prefix maps to one action, and no two actions share a prefix. The error is the first line of
stderr, or the `error` field in JSON. The script throws only `review input invalid:`. Everything
else it reports in `failed`.

### D16. Testing: what `node --test` proves and what only a live run can

New `plugins/core/skills/review-change/scripts/review-round.test.mjs`, imported by
`plugins/openspec/hooks/guard.test.mjs` (as the openspec-setup script tests are). Every test name
starts with `review round:`.

- **Rules** (through `loadRules`):
  - `needsVerification` over the four severities, with and without a disposition;
  - `decide`:
    - 3 / 2 / 1 / 0 refutations;
    - 2 refutations where one has blank evidence → not refuted;
    - `null` votes;
  - `oneLine`: newlines, `·` → `-`, the 400 cap;
  - `outcomeOf`:
    - only nit/praise → `approved`;
    - a surviving important → `rejected`;
    - all refuted → `approved`;
    - a disposed previous finding → neither open nor verified;
    - `declined`;
  - `consensusOf` with a failed entry;
  - `validateArgs` / `validateStage1`: prefixes, id assignment, one-line text.
- **Prompts**:
  - every prompt starts with `args.preamble`;
  - `reviewerPrompt` says stage 1 and "write no file";
  - `verifierPrompt` holds the finding line, "refute" and the range, and no other finding;
  - `writerPrompt` holds every `lines` entry verbatim and the commit line, and contains neither
    `Verdict: approved` nor `Verdict: rejected` (no suggested verdict).
- **Script harness**:
  - The test reads `review-round.workflow.js` and checks that it starts with
    `export const meta = {`. It removes that `export ` and runs the text as the body of an
    `AsyncFunction('agent', 'parallel', 'pipeline', 'phase', 'log', 'args', body)`.
  - The stubs record every call. `agent` returns a promise that the test resolves from fixtures.
    `parallel` maps thunks and turns a rejection into `null`, as the tool does.
  - AC-1: with a bench of three reviewers, all three `agent` calls are recorded before the first
    resolves, each with `agentType: 'devkit-core:<reviewer>'`, `phase: 'review'` and a schema.
  - AC-2: fixtures give one reviewer a blocking, an important, a nit, a praise and a re-listed
    `fixed in` finding. Exactly 6 verifier calls follow, with `agentType: 'devkit-core:finding-verifier'`
    and none for the nit, the praise or the disposed finding. Votes cover each case:
    - 2 refutations with evidence → refuted;
    - 2 where one has blank evidence → open;
    - one `null`.
  - AC-3: one writer call per reviewer with its own agent type. Its prompt holds the refuted line
    with ` · refuted: <evidence>` on one line, the open line without a disposition, and
    `Commit: <stage-1 sha>`. `outcome.verdict` is `rejected` while an important stays open, and
    `approved` when all are refuted.
  - AC-4: the result's `reviewMd` holds each reviewer's verdict, verified and refuted counts,
    `Consensus: ... (round N/2)` and `Path: workflow`.
  - Failures:
    - a stage-1 `null` → `failed` holds `review stage failed: <r> review`, with no verifier or
      writer call for it, and `reviewMd` is `null`;
    - a writer `null` → `review stage failed: <r> write`;
    - invalid `args` → the run rejects with `review input invalid:`.
  - Result: the run resolves to an object with `version: 1`, `path: 'workflow'`, the `change` and
    `round` of `args`, the `outcomes` and `failed` lists and `reviewMd`: the fields D6's result
    check reads, so the check and the script agree on one shape.
- **Static**:
  - the script holds no `import `, `require(`, `Date.now` or `Math.random`, and no match of
    `/\bprocess\./` or `/\bfs\./` (a word boundary: prose such as "diffs." or "specs." in a prompt
    is not a match);
  - `meta` holds only literals (no `(` inside the `meta` object's text);
  - the rules section loads and exports every name D3 lists.
- **CLI** (spawned `node`):
  - every subcommand on a fixture, text inputs with a fenced `json` block included; `stage1` gives
    one job per bench entry with `agentType: 'devkit-core:<reviewer>'` (AC-1 on the `agents` path);
  - the four prefixes and exit codes 0 / 2 / 3;
  - `check-file`: a missing file, a wrong line 1, a wrong line 2, a missing refuted line.
- **AC-5 equivalence**: the same fixtures run through the harness and through the CLI chain
  (`stage1` → `verify` → `outcomes` → `consolidate`, with `args.path` `agents`). The outcomes are
  deep-equal except `path`, and the CLI's `text` says `Path: agents`.
- **Text tests** (phase 2):
  - `review-change/SKILL.md` names `scripts/review-round.workflow.js`, `scriptPath`, the `agents`
    path with `subagent_type: devkit-core:<reviewer>` and one message per stage, and `check-file`;
  - `review-change/SKILL.md` holds D6's two rows for an accepted call: `Workflow result invalid`
    with the whole round on the `agents` path, and `Workflow lost: no completion notice` with the
    busy mark dropped;
  - the ship-change `review` row and conduct's Delivery item 5 name the Workflow tool, the
    `agents` path and the lost round (`declares the round lost`, `declared lost`);
  - all six reviewer agents have `### Staged round`;
  - `finding-verifier.md`'s `tools:` has no `Write` or `Edit`;
  - `docs/openspec-flow.md` has `## The review round` linking `adr/0008-reviews-as-a-workflow.md`.

In `plugins/openspec/hooks/deliver-check.test.mjs` (they import `loadRules` from the core
script's loader, one test set per rule):

- `nextStep: an approved review at the current commit with an undisposed important finding goes to fix-review with that finding (AC-6)`.
  It uses the real round-1 line from `af4055a` (Context), copied verbatim into the fixture,
  because CI's shallow checkout has no history. The blocking case and the mixed case
  (rejected + approved-open → one `fix-review` with both reviewers) are covered too.
- `nextStep: an approved but stale review with an undisposed finding is still reviewed`.
- `review round: findingsItem reads findingLine's refuted line as refuted and its open line as undisposed`.
  It writes a `reviews/` file from `findingLine` output in a temp repo.
- `review round: readReviewMd reads consolidate's Consensus line and round`.

In `guard.test.mjs`: "ADR 0008 records the reviewer round as a Workflow script; ADR 0001 and the
config point to it". It follows the ADR 0006 test (line 1285): Status accepted, the four sections,
ADR 0001 names `0008-reviews-as-a-workflow.md`, config lists `0008 reviews as a workflow`, and no
duplicate ADR number.

Only a live run can prove the following. They are the Workflow follow-up (dogfood of the next
change), not acceptance criteria of this one. Items 2, 3, 6 and 7 are the live half of AC-1 to
AC-3, which are worded to what the tests above prove:

1. the tool accepts `scriptPath` into the installed plugin (or the inline fallback);
2. `agentType: 'devkit-core:<name>'` resolves the pack's agents inside a Workflow;
3. the guard's hook sees `agent_type` for a Workflow agent, so stage 3's write is accepted and
   another writer refused;
4. `schema` returns objects in the shapes of D4;
5. the script's result convention and the `meta.phases` form (see "Workflow tool facts");
6. a typed `/ship-change` or `/conduct` turn is accepted, and an automated turn is refused and falls
   back;
7. the completion notification arrives and the session finishes the round, and the session can
   see a running Workflow task's state (the lost-round row of D6 relies on it; without it the
   owner's word ends the round).

## Workflow tool facts: verified and not

| Fact (from the tool's authoring reference, as relayed) | Verified here? |
|---|---|
| `agentType` uses the Agent tool's registry; plugin agents are named `devkit-core:<name>` | Partly: every reviewer is dispatched as `devkit-core:<name>` today, and `guard.mjs` `role()` (line 60) strips the prefix. Not verified inside a Workflow |
| Hooks receive `agent_type` for an agent a Workflow started | **Not verified**: no Workflow run or doc in the repository |
| Script = plain JS starting with a literal `export const meta = { name, description, phases }`, then `agent()`, `parallel()`, `pipeline()`, `phase()`, `log()`, `args`; no filesystem or Node API; no `Date.now()` / `Math.random()` | **Not verified** (no example in the repository or in `~/.claude/workflows/`). The design follows it, and the static test enforces the "no" list |
| `parallel()` never rejects; a failed thunk is `null` | **Not verified**. The harness stub implements it, and the script handles `null` either way |
| `schema` forces a structured return | **Not verified**. `validateStage1` re-checks every return, so a loose return is a failed stage, not a wrong file |
| How the script hands back its result (assumed: a top-level `return` of the final value, the script run as an async function body) and the form of `meta.phases` (assumed: a list of names) | **Not verified**. Fixed for this change as assumed (task 1.2): only the last statement of the script and the harness wrapper depend on it. A different form seen live is a dogfood finding for a later change; at run time a result that does not pass D6's result check sends the round to the `agents` path |
| Called with `script`, `scriptPath` or `name`, plus `args`; runs in the background; notifies on completion | **Not verified** (whether `scriptPath` may point outside the project especially), hence the inline fallback (D2) and, for a notice that never comes, D6's lost round |
| Allowed only on the owner's explicit opt-in, including "a skill whose instructions tell you to call Workflow"; automated turns are not opt-in | **Not verified**. D7 encodes it, and any refusal falls back to `agents` |

## Risks / Trade-offs

| Risk | P × I | Mitigation |
|---|---|---|
| A Workflow fact above is wrong (path refused, result convention, `meta` form, schema) | HIGH × MEDIUM | The `agents` path is complete on its own and runs on any refusal or error, and on a result that fails D6's result check (D6); the logic is tested without the tool; the first live run is the next change's dogfood, recorded in this change's retro |
| The guard does not see `agent_type` for Workflow agents: stage 3's write is refused, or not gated | MEDIUM × HIGH | `check-file` after every round; a mismatch reruns stage 3 with the Agent tool, whose `agent_type` the guard sees today; the session never writes a verdict; ADR 0008's review trigger names it |
| More agent runs per round (R + 3F + R instead of R) | HIGH × MEDIUM | Only open blocking/important findings are verified; the verifier has a one-finding budget (one scoped command at most); `review.md` records verified/refuted counts so the retro can measure; Cost bullet in the docs |
| Three verifiers of the same model agree and refute a real defect | MEDIUM × HIGH | A refutation needs evidence; the refuted line stays in the verdict file and in `review.md` with that evidence, visible to `pr-verifier`, the owner and the next round; 2 of 3, never 1 |
| The completion notice never comes (a killed or stuck script), and the change stays busy | MEDIUM × MEDIUM | D6's lost round: on a later turn with the task no longer running, or on the owner's word, the busy mark drops and the round re-runs on `agents`; while the session cannot tell, it says so every turn and names the owner's way out; a late notice is not consolidated and triggers `check-file` again |
| The session recomputes while the Workflow runs and starts a second round | MEDIUM × MEDIUM | The skills say the change is busy until the notice; conduct passes `--busy`; a second round would only overwrite files by their own writers |
| The writer drifts from the given lines (drops or rewrites a finding) | MEDIUM × MEDIUM | The prompt gives exact lines; `check-file` checks lines 1-2 and every blocking/important line; `deliver-check` item 3 still counts undisposed findings |
| `new Function` over the rules section hides a syntax error until load | LOW × LOW | Every test loads it; the CLI's first line of error names the file |
| `finding-verifier` writes through Bash in a `devkit-lite` project (the guard lets non-implementer agents write product code there) | LOW × MEDIUM | No Write/Edit tool; its Never list; follow-up: add it to the guard's "writes nothing" roles in a guard change (out of scope here) |
| In `/conduct` the Workflow path rarely runs (reviews land on continuation turns) | HIGH × LOW | Accepted in ADR 0008; the `agents` path gives the same files; the docs say so |
| The npm `claude` (2.1.227) fails `claude plugin validate .` | HIGH × MEDIUM | Gates name the desktop app's bundled binary by absolute path (CONTRIBUTING, "Adding or changing an asset") |
| The full suite takes about 9 minutes | HIGH × LOW | Run only at the two gates; give the reviewers and `pr-verifier` the gate result |

## Migration Plan

Nothing stored to migrate. `reviews/` and `review.md` written before this change stay readable
(`readReviewMd` reads the old `Consensus:` lines). Installed projects get the round with
`claude plugin update devkit-core@devkit` and `devkit-openspec@devkit`. Only devkit-core is needed
for the round. `deliver-check`'s `fix-review` change needs devkit-openspec.

This change's own reviews run the current way, because the new skill is installed only after the
release (requirements.md).

Rollback: revert the squash commit. Rounds already run keep their files, which have the old shape
plus extra `review.md` lines. ADR 0008 then goes to `superseded` or `rejected` through the owner.

## Implementation plan

Dependency order: the rules section → the orchestration → the CLI → `deliver-check` → the agents →
the skills → ADR and docs → release.

**Per surface:**

- devkit-core: the script, its loader/CLI and tests (D2-D8, D15, D16); `finding-verifier` (D9);
  the six reviewers' paragraph (D10); `review-change` text (D12); README.
- devkit-openspec: `deliver-check.mjs` `nextStep` (D11) and tests; `guard.test.mjs` (import, ADR
  test); the `ship-change` and `conduct` rows (D12).
- Repository docs and release: ADR 0008, ADR 0001's Note, `openspec/config.yaml`, `README.md`,
  `docs/openspec-flow.md`, the manifests, `CHANGELOG.md`, the catalog (D13, D14).

**File structure:**

| action | path |
|---|---|
| create | `plugins/core/skills/review-change/scripts/review-round.workflow.js` |
| create | `plugins/core/skills/review-change/scripts/review-round.mjs` |
| create | `plugins/core/skills/review-change/scripts/review-round.test.mjs` |
| create | `plugins/core/agents/finding-verifier.md` |
| create | `docs/adr/0008-reviews-as-a-workflow.md` |
| modify | `plugins/core/skills/review-change/SKILL.md` |
| modify | `plugins/core/agents/{code-quality,test-coverage,architecture,security,adr,spec}-reviewer.md` (Verdict file section) |
| modify | `plugins/core/README.md`, `docs/catalog.md` (catalog, generated) |
| modify | `plugins/openspec/hooks/deliver-check.mjs` (`nextStep`), `plugins/openspec/hooks/deliver-check.test.mjs`, `plugins/openspec/hooks/guard.test.mjs` |
| modify | `plugins/openspec/skills/ship-change/SKILL.md`, `plugins/openspec/skills/conduct/SKILL.md` |
| modify | `docs/adr/0001-coordination-without-a-harness.md` (Note), `openspec/config.yaml` (ADR list), `README.md`, `docs/openspec-flow.md` |
| modify | `plugins/core/.claude-plugin/plugin.json`, `plugins/openspec/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `CHANGELOG.md` |
| delete | none |

**Estimate:** optimistic 10 h, likely 15.5 h, pessimistic 24 h. The pessimistic case comes from
harness friction (running the script body under stubs, deterministic call-order assertions), the
CLI's text-input parsing, and two full-suite gates of about 9 minutes each.

| Component | Hours | Type | Risk |
|---|---|---|---|
| Rules section, loader, unit tests (D3, D5, D6, D8) | 3 | Core | MEDIUM |
| Orchestration and harness tests (D4, AC-1..AC-4) | 2.5 | Core | MEDIUM |
| CLI subcommands, prefixes, AC-5 equivalence tests (D15) | 2 | Integration | LOW |
| `deliver-check` `fix-review` and cross-pack tests (D11, AC-6) | 1 | Core | LOW |
| `finding-verifier` and the six reviewers' paragraph (D9, D10) | 1 | Documentation | LOW |
| `review-change`, `ship-change`, `conduct` text and text tests (D12, D6 fallbacks) | 2.5 | Documentation | MEDIUM |
| ADR 0008, ADR 0001 Note, config, README, ADR test (D13, AC-7) | 1 | Documentation | LOW |
| `docs/openspec-flow.md` (D12) | 1 | Documentation | LOW |
| Real-input smoke, release, catalog, gates (D14) | 1.5 | Testing | LOW |

**Assumptions** (each one is where the plan breaks if reality differs):

- The Workflow facts in the table above. Source: the tool's authoring reference as relayed in the
  planning request. None of them is needed by a test.
- A skill knows its base directory, so `<skill-dir>/scripts/...` resolves. Source: `ship-change`
  and `conduct` already run `node <skill-dir>/../../hooks/*.mjs`.
- `new Function` is available to Node's test runner and CLI (Node 22 in CI, `.github/workflows/ci.yml`).
- `guard.test.mjs` may import a test file of another pack. Source: it already imports
  `../skills/openspec-setup/scripts/*.test.mjs`, and CI runs only that file.
- CI's checkout is shallow (`actions/checkout@v4` with no `fetch-depth` in `ci.yml`), so tests copy
  the real round-1 line instead of reading `af4055a`.

**Dependencies:**

- Retro item (e) of release-rebase-pin, archived in `openspec/changes/archive/2026-11-11-release-rebase-pin/retro.md`.
- `setPins` from release-rebase-pin (devkit-openspec 0.11.0), to move the pin.
- The roadmap line, round 9 of `openspec/roadmap.md`. `panel-conduct-view` is `after: review-workflow`
  and does not block this change.

## Open Questions

None. The AMBIGUOUS item is resolved in D2.
