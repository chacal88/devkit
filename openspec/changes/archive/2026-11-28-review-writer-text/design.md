<!-- devkit-stage design result=passed attempt=1 commit=1e8c2a5084a7b8508f46fe3c2a4aa8e43affe817 -->
# Design

Change: `review-writer-text` · Date: 2026-11-28 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(`proposal.md`, `requirements.md`, `decisions.md`, `release.md`, the delta
`specs/review-round/spec.md`). Base: `origin/main` at `6f03a57`.

## Context

See `proposal.md` (Why) for the motivation. The facts below hold at `6f03a57`. `RW` is
`plugins/core/skills/review-change/scripts/review-round.workflow.js` and `RT` is
`plugins/core/skills/review-change/scripts/review-round.test.mjs`.

| Part | Where | Today |
|---|---|---|
| One-line normalizer | `RW#oneLine(text, max = 400)` | Collapses whitespace, turns `·` into `-`, trims, and cuts past `max` with `…` |
| Reviewer disposition | `RW#validateStage1` | `disposition = oneLine(f.disposition, 400)`, then checked against `^(fixed in [0-9a-f]{7,40}\|refuted:\s*\S.*)$` (case-insensitive) |
| Verifier evidence | `RW#decide` | `evidence: refuting.map((v) => oneLine(v.evidence, 400)).join(' / ')`; `outcomeOf` sets `disposition: 'refuted: ' + d.evidence` |
| Outcome line | `RW#findingLine` | `- [<severity>] <location> — <text> · <disposition>` |
| Statuses | `RW#outcomeOf` | `disposed` (the reviewer's own disposition), `refuted` (verifiers), `open` (everything else, nit and praise included) |
| Writer prompt | `RW#writerPrompt` | Line 1, line 2, the heading, `### Findings`, `outcome.lines`, then `outcome.sections` verbatim, then the reply shape |
| Loader | `plugins/core/skills/review-change/scripts/review-round.mjs#NAMES` | Every rule name the module exports; `loadRules` refuses a section that lacks one |
| Writer jobs | `RW#writeJobs` | The `workflow` path, `review-round.mjs outcomes` (`jobs`) and the CompozyOS `devkit-review` loop (`plugins/compozy/kit/templates/loops/devkit-review/loop.yaml`, writing stage) all take `writerPrompt` from here |
| File check | `review-round.mjs#checkFileCommand` | Lines 1 and 2, no later `Verdict:`/`Commit:` line, and every `- [blocking]`/`- [important]` line of the outcome present |
| Delivery check | `plugins/openspec/hooks/deliver-check.mjs:630-640` | Reads only bullet lines holding `[blocking]` or `[important]` |

The round's rules live once, between `// ---- rules: begin` and `// ---- rules: end` of `RW`, and stay
pure (ADR 0008 decisions 1 and 5; pinned by `RT`, "the script holds no module loading, clock,
randomness, process or fs use"). ADR 0008 decision 4 keeps the gates: each reviewer writes its own
file, verifiers write nothing, and the `Verdict:`/`Commit:` lines stay as they are. Its consequences
keep a refuted finding listed "with that evidence".

## Goals / Non-Goals

**Goals:**

- One change in the rules section reaches all three paths, and `RT`'s cross-path tests ("cli equals
  the workflow", "AC-1 cli outcomes gives one writer job per outcome ... equal to the workflow write
  calls") stay green with no edit.
- The outcome object keeps its keys and their meaning. Only the text of a disposition longer than 400
  characters changes.

**Non-Goals:**

- `check-file` does not check the summary line. A writer that drops it fails nothing. The line is for
  the reader, and no gate reads it (`decisions.md`).
- No change to `consolidate()`, to `findingLine`, to the verifier prompt or to the stage-1 prompt.

## Decisions

### D-1 The two caps go, `oneLine` stays

In `RW#validateStage1`, `oneLine(f.disposition, 400)` becomes `oneLine(f.disposition, Infinity)`.
In `RW#decide`, `oneLine(v.evidence, 400)` becomes `oneLine(v.evidence, Infinity)`. With `Infinity`,
`s.length > max` never holds, so the text is collapsed and its `·` replaced but never cut. The
disposition check runs on the collapsed text, as today. `oneLine`'s default (`max = 400`) and the other
callers (`location` 200, `text` 2000, `heading` 300) do not change, and neither does `RT`, "oneLine
joins lines, turns the middle dot into a dash and caps the length" (AC-1, AC-2).

Alternatives: a higher cap (2000) still cuts a verifier's command output, and the request asks for
the full text. A second helper that only collapses whitespace would put a second copy of the `·` rule
in the section, and the line must stay one line for `check-file`.

### D-2 `withoutSummary(sections)`: the reviewer's summary left out

A new pure function in the rules section, called only by `writerPrompt`
(`withoutSummary(outcome.sections)` in place of `outcome.sections`). It splits the text on `\n` and
walks the lines:

- A **fence line** is a line that, after up to 3 spaces, starts with 3 or more backticks or tildes. It
  opens a fence. The fence closes on a later line of the same character, at least as long, with
  nothing after it but spaces or tabs (and a final `\r`). Inside a fence, no line is a heading.
- A **summary heading** is a line outside a fence that matches `/^(#{2,3})[ \t]+summary[ \t]*\r?$/i`.
  Its level is the count of `#`.
- A **heading** is a line outside a fence that matches `/^(#{1,6})(?:[ \t]|\r?$)/`.
- From a summary heading, every line is left out, the heading included, up to (not including) the
  next heading whose level is the summary's level or lower (`#` counts as higher than `##`), or to the
  end. A heading of a deeper level (`####` under `###`) is left out with the summary. If that next
  heading is itself a summary heading, the walk drops it too.
- Every other line is kept, and the kept lines are joined with `\n`. Nothing is trimmed, so a text
  with no summary heading comes back byte for byte (AC-3).

Unterminated and edge input (the project's parser rule): an empty text gives `''`. A fence that no
line closes runs to the end, so no heading after it is seen. If it opens under a summary heading, the
summary runs to the end. If it opens before one, that heading is fence content and nothing is dropped.
A summary at the end of the text drops to the end. A text without a final `\n` stays without one. A
`\r\n` text keeps its `\r` on every kept line. `# Summary` and `#### Summary` are not summary headings
(AC-3 names only `##` and `###`).

The blank line before a dropped heading is kept (it belongs to the section above). The blank line
before the next kept heading is dropped with the summary.

Alternative: dropping the summary in `validateStage1`, where `withoutHeaderLines` already cleans
`sections`. Rejected, for three reasons. It would change `outcome.sections`, which
`review-round.mjs outcomes` prints. It would break the spec's "The other keys keep their shape"
scenario and the `RT` helpers that write a file from `o.sections` (`writeVerdictFile`, `checkWith`).
And AC-3 is about the writer prompt only.

### D-3 `summaryLine(outcome)`: the round's summary

A new pure function in the rules section that returns one line:

```
- N findings (B blocking, I important, T nit) + P praise; open: <ids>; fixed: <ids>; refuted: <ids>
```

- B, I, T and P count the outcome's findings of each severity, whatever their status. N is B + I + T,
  as in the reviewer agents' own template (`plugins/core/agents/code-quality-reviewer.md`, "Summary":
  `- N findings (B blocking, I important, T nit) + P praise`). Praise is counted apart there.
- **open**: the blocking, important and nit findings with `status === 'open'`.
- **fixed**: the blocking, important and nit findings whose disposition matches `/^fixed in /i`.
- **refuted**: the blocking, important and nit findings with `status === 'refuted'` (the verifiers'
  refutation) or a disposition matching `/^refuted:/i` (the reviewer's own).
- Each list holds ids in the order of `outcome.findings`, joined by `, `. An empty list is `none`.

AC-4 says "open lists findings with status `open`", and `outcomeOf` gives praise that status too. The
template's form counts praise apart from the findings ("N findings (...) + P praise"), so the three
lists name only what N counts. Praise is never listed: a praise is never open, and a praise with a
disposition is not a finding to dispose of. This is the one reading this plan takes beyond the letter
of AC-4, and the readiness review is asked to confirm it.

Alternative: an outcome key `summary`. Rejected: it adds a key to `outcomes` that the agents path
prints, the line can be derived from `findings`, and the outcome would carry the same fact twice.

### D-4 The writer prompt text

`RW#writerPrompt` changes only after `### Findings` and its lines. Today:

```
then a blank line, then this text, verbatim:
<outcome.sections>
End your reply ...
```

After this change:

```
then a blank line, then this text, verbatim:
<withoutSummary(outcome.sections)>
then a blank line, then the line: ### Summary
then this line, verbatim, as the last line of the file:
<summaryLine(outcome)>
End your reply ...
```

In code, the `'then a blank line, then this text, verbatim:\n' + outcome.sections + '\n'` part
becomes `'then a blank line, then this text, verbatim:\n' + withoutSummary(outcome.sections) + '\n'`,
followed by `'then a blank line, then the line: ### Summary\n'`,
`'then this line, verbatim, as the last line of the file:\n'` and `summaryLine(outcome) + '\n'`. The
new text names neither `Verdict:` nor `Commit:`, so `RT`, "AC-6 the writer prompt names Verdict only
on line 1 and Commit only on line 2", stays green. The summary line starts `- <digit>`, not `- [`, so
`check-file`, `deliver-check.mjs` and `RT`'s honest writer (`responder`) never read it as a finding.

### D-5 The loader and the names

`review-round.mjs` adds `withoutSummary` and `summaryLine` to `NAMES` and to its `export const { ... }
= loadRules()` list, so that `RT` can import them. `RT`, "the rules section loads and exports every
name", gains both names in its list. The invariant: every name the loader exports is defined in the
rules section. Layer: the loader. Suite: `RT`.

### D-6 Tests and the real-run proof

New tests go in `RT`, each named `review-writer-text AC-<n> <what>`. No test file is added or moved,
so `scripts/test-map.json` does not change. `node scripts/test-suite.mjs --own-files` selects `RT`,
`plugins/openspec/hooks/deliver-check.test.mjs` and `plugins/compozy/kit/scripts/devkit-kit.test.mjs`
(the map's entries for `RW` and `review-round.mjs`). It also selects
`plugins/openspec/hooks/guard.test.mjs` and `plugins/openspec/hooks/status-line.test.mjs` (the entry
for `docs/openspec-flow.md`), with `RT` again for `SKILL.md`.

| Test (new, in `RT`) | Checks | AC |
|---|---|---|
| `review-writer-text AC-1 a reviewer's own refutation of 600 characters stays whole` | `validateStage1` keeps the whole collapsed text. `findingLine` ends with it and holds no `…`. `writerPrompt` holds the line. A line break and a `·` in it become a space and `-` | AC-1 |
| `review-writer-text AC-2 two refuting verifiers keep their whole evidence` | `decide` with two pieces of evidence of 500 characters and a keep gives `e1 / e2` whole. The outcome line ends with ` · refuted: <e1> / <e2>`. `writerPrompt` holds it. No `…` | AC-2 |
| `review-writer-text AC-3 withoutSummary leaves out a summary section and nothing else` | The cases of D-2: `###` between sections, `## SUMMARY` with a deeper heading, two summaries, a summary at the end, none (byte for byte), `#` and `####` kept, a fenced heading kept, an unclosed fence under a summary, an unclosed fence before one, `\r\n`, `''` | AC-3 |
| `review-writer-text AC-3 the writer prompt holds the rest of sections verbatim and not the reviewer's summary` | `sections` = `### Notes\nKept.\n\n### Summary\n- 2 findings; F1 is open\n\n### Next\nKept too.`: the prompt holds `### Notes\nKept.\n\n### Next\nKept too.` and not `F1 is open` | AC-3 |
| `review-writer-text AC-4 summaryLine fills every list in the outcome's order` | The six findings of the spec scenario give `- 5 findings (1 blocking, 2 important, 2 nit) + 1 praise; open: F2, F3; fixed: F5; refuted: F1, F6`. An outcome with no finding gives the `none` line. A praise with a disposition is in no list | AC-4 |
| `review-writer-text AC-4 the writer prompt asks for the round's summary as the last section` | `### Summary` and the line come after the sections text and before `End your reply`. The prompt's lines naming `Verdict:` or `Commit:` are only `line 1:` and `line 2:` | AC-4 |
| `review-writer-text AC-5 a blocking finding refuted with long evidence is approved, under refuted, on both paths` | Harness run and `review-round.mjs outcomes`. Stage 1 holds F1 blocking and a `### Summary` calling F1 open. The votes are two refutations of 500 characters and a keep. On both paths: verdict `approved`; `lines[0]` ends with ` · refuted: <e1> / <e2>`; the writer prompt holds `open: none` and `refuted: F1` and not the reviewer's summary line; the cli job's prompt equals the workflow's write call | AC-5 |

Pinned rules: the existing `RT` tests that read what this change touches. `rg -n "oneLine|decide\(|writerPrompt|sections|Summary|NAMES|loadRules" RT` found them, plus `findingLine`
and `validateStage1` in `plugins/openspec/hooks/deliver-check.test.mjs`. Each stays as it is unless
the row says so:

| Test | Invariant | Layer | Suite | This change |
|---|---|---|---|---|
| `review round: the rules section loads and exports every name` | Every exported name is defined | loader | `RT` | Gains `withoutSummary` and `summaryLine` (D-5) |
| `review round: oneLine joins lines, turns the middle dot into a dash and caps the length` | The default cap and the normalizing | rules | `RT` | Unchanged; the default stays |
| `review round: decide refutes at 2 of 3 with evidence, never at 1 or 0` | Majority and the ` / ` join | rules | `RT` | Unchanged; short evidence |
| `review round: validateStage1 rejects a malformed return ...` | `maybe later` is no disposition | rules | `RT` | Unchanged; the check still runs |
| `review round: writerPrompt holds every line verbatim and the commit line` | Every outcome line in the prompt | rules | `RT` | Unchanged |
| `review-writer-prompt AC-6 the writer prompt names Verdict only on line 1 and Commit only on line 2` | No second header line in the prompt | rules | `RT` | Unchanged; D-4's text keeps it |
| `review-writer-prompt AC-6 ... has one of each line and passes check-file`, `AC-7 ...` (`checkWith`) | A file from `o.sections` | file check | `RT` | Unchanged; `outcome.sections` keeps its text (D-2) |
| `review round: cli equals the workflow ...`, `review-writer-prompt AC-1 ...` (four tests) | Both paths give the same outcomes and prompts | cross-path | `RT` | Unchanged |
| The `responder` honest writer in `RT` | Reads `- [blocking\|important]` lines without a disposition | harness | `RT` | Unchanged; the summary line starts `- <digit>` |
| `review round: findingsItem reads findingLine's refuted line ...` | A refuted line reads as refuted | delivery check | `plugins/openspec/hooks/deliver-check.test.mjs` | Unchanged |

**Real-run proof** (CLAUDE.md: the change alters what an agent writes). The conducting session
does this. It builds one input in its scratch folder, runs the worktree's own
`node plugins/core/skills/review-change/scripts/review-round.mjs outcomes --input <file>`, and sends
each job of `jobs` as one Agent call (`subagent_type` the job's `agentType`, the job's prompt). It
then runs `review-round.mjs check-file` on each written file. `args` takes `head` and `dirty` from
`review-round.mjs tree` in the worktree, `round: 1`, `path: 'agents'`, `structural: 'PASS'`, and as
`changeDir` an absolute folder under the session's scratch folder (with `TMPDIR=/var/tmp` on this
machine), so the writers write outside the repository. Three cases, one per reviewer:

| Case | Reviewer | Stage 1 | Votes | Covers |
|---|---|---|---|---|
| A | `code-quality-reviewer` | F1 important with its own `refuted: ` + 600 characters (one line break and one `·` in it); F2 nit; `sections` with `### Notes` and a `### Summary` that calls F1 open | none | AC-1, AC-3 (`###`), AC-4 |
| B | `adr-reviewer` | F1 blocking, no disposition; F2 praise; `sections` with a `## SUMMARY` that calls F1 open, then `## Notes` | F1: two refutations of 500+ characters and one keep | AC-2, AC-3 (`##`, case), AC-4, AC-5 |
| C | `spec-reviewer` | F1 important `fixed in <a sha of the branch>`; `sections` with no summary | none | AC-3 (verbatim), AC-4 |

The proof passes when each written file passes `check-file` (exit 0) and holds its outcome lines
byte for byte, with no `…`. Its last section must be `### Summary` and the line `summaryLine` gives.
Its text must hold neither the reviewer's own summary line nor its heading. The rest of `sections`
must be as given. Then the pr-verifier copies the input, the `outcomes` answer, the three files and
the `check-file` outputs into `proof/`. It records one row per case in `evidence.md` before the first
review round. The installed `devkit-core` reviewer agents are fine as writers: this change edits no
agent file, and the prompt comes from the worktree's script (CONTRIBUTING.md, "When a change edits an
agent's output format").

### D-7 Docs and release

- `docs/openspec-flow.md`, "The review round", step 3: after "the verdict by its own rules from the
  lines it is given", add: "Each disposition is whole, and the file ends with a `### Summary` line the
  round builds from the outcome (counts, then the open, fixed and refuted ids); the reviewer's own
  summary is left out."
- `plugins/core/skills/review-change/SKILL.md`, "Verification and the verdict file": after "(one line,
  `·` replaced by `-`)", add ", whole, with no length cap". Before "The writer states it", add: "The
  writer prompt leaves out the reviewer's own `## Summary` or `### Summary` section and asks for a
  last `### Summary` line built from the outcome: `- N findings (B blocking, I important, T nit) + P
  praise; open: <ids>; fixed: <ids>; refuted: <ids>`."
- Neither text is pinned by a test (`rg -n "from the lines it is given|refuted finding stays" --glob
  '*.test.mjs'` finds nothing). `RT`'s text tests read other lines of both files.
- `release.md`: `devkit-core: patch`. No task bumps a version, edits `CHANGELOG.md` or numbers an ADR
  (ADR 0034).

## Implementation plan

Order: rules (D-1 to D-4) → loader (D-5) → tests (D-6, written first, red, then green) → docs (D-7)
→ real-run proof (D-6). One surface, devkit-core. There is no backend, frontend or worker split.

Files to modify: `plugins/core/skills/review-change/scripts/review-round.workflow.js`,
`plugins/core/skills/review-change/scripts/review-round.mjs`,
`plugins/core/skills/review-change/scripts/review-round.test.mjs`,
`plugins/core/skills/review-change/SKILL.md`, `docs/openspec-flow.md`. Files to create: none outside
the change folder. Files to delete: none.

Estimate: optimistic 2 h, likely 3.5 h, pessimistic 6 h (a selective gate that also runs
`guard.test.mjs` and `deliver-check.test.mjs`, and the real run's three writer agents).

| Component | Hours | Type | Risk |
|---|---|---|---|
| D-1 caps lifted | 0.25 | Core | LOW |
| D-2 `withoutSummary` | 0.75 | Core | MEDIUM |
| D-3 `summaryLine` and D-4 prompt | 0.5 | Core | LOW |
| D-5 loader names | 0.1 | Core | LOW |
| D-6 new tests in `RT` | 1 | Testing | LOW |
| D-7 docs | 0.25 | Documentation | LOW |
| D-6 real-run proof | 0.75 | Integration | MEDIUM |

## Risks / Trade-offs

- [A long verifier evidence makes a very long line in the verdict file and in `review.md`]
  (probability MEDIUM, impact LOW) → Accepted: the request asks for the whole text. ADR 0008 keeps
  the evidence listed, and a verifier's answer is one line by its schema.
- [A writer agent ignores the summary instruction or keeps the reviewer's summary] (LOW × LOW) → The
  real-run proof checks the three files. No gate reads the summary, so a slip misleads a reader but
  fails nothing. `check-file` already catches a dropped or reworded finding.
- [`withoutSummary` drops more than the summary on odd Markdown (a `## Summary` used as a
  sub-heading)] (LOW × MEDIUM) → The fence rule and the level rule follow CommonMark ATX headings and
  fences, and D-6's AC-3 test covers each edge of D-2.
- [The praise reading of D-3 differs from what the owner meant by AC-4] (LOW × LOW) → It is stated in
  D-3 and asked of the readiness review. A different reading changes one filter and one test row.
- [The real-run writers cannot write outside the worktree on this host] (LOW × LOW) → Before the run,
  the session writes and deletes one probe file in the scratch `changeDir`. If either fails, it stops
  and asks the owner for a folder, and writes nothing in the repository.

Rollback: revert the change's commits. The verdict files written meanwhile stay valid, because their
shape is unchanged and only the summary text and the disposition length differ.

Assumptions:

- The cut in round 3 came from the two 400 caps (`requirements.md`, Assumptions; the line at
  `.../reviews/code-quality-reviewer.md:15` ends in `…`, its disposition cut at 399 characters).
- No hook or checker reads a verdict file's summary (`decisions.md`; `deliver-check.mjs:637` reads
  only `[blocking]`/`[important]` bullets).
- All three paths build the writer prompt with `writeJobs` (the Context table; `loop.yaml`, writing
  stage, writes "each writer job's prompt").

Dependencies: none beyond `6f03a57`. The `review-round` spec (`openspec/specs/review-round/spec.md`)
is the one the delta extends.
