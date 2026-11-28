<!-- devkit-stage proposal result=passed attempt=1 commit=1e8c2a5084a7b8508f46fe3c2a4aa8e43affe817 -->
# Proposal

Change: `review-writer-text` · Date: 2026-11-28 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(sources: `requirements.md`, `decisions.md`, `release.md`). Base: `origin/main` at `6f03a57`
(train 21); the branch was opened on it and has merged nothing yet.

## Why

In round 3 of `coordinator-loop-fixes` the writer prompt the review round builds cut a refutation in the
middle of a sentence and kept a reviewer's own summary that still counted a refuted finding as open. The
code-quality verdict file has a line ending in `…`
(`openspec/changes/archive/2026-11-26-coordinator-loop-fixes/reviews/code-quality-reviewer.md:15`).
The ADR verdict file has a `### Summary` that calls F5 open after the verifiers refuted it
(`.../reviews/adr-reviewer.md:31-32`). The verdicts were right, but a verdict file is read by the
owner and by the next round's reviewer. A cut refutation hides the evidence that ADR 0008 keeps listed
"with that evidence", and a summary that contradicts the findings above it misleads both readers.

## What Changes

- **Whole dispositions.** The two 400-character caps on a disposition's text go away, in the rules
  section of `plugins/core/skills/review-change/scripts/review-round.workflow.js`. The first is a
  reviewer's own disposition (`validateStage1`). The second is each refuting verifier's evidence
  (`decide`), which becomes `refuted: <e1> / <e2>`. A disposition stays one line: whitespace is collapsed
  and `·` becomes `-`, as today, because `check-file` compares the file line by line. `oneLine`'s own
  default cap of 400 stays.
- **No reviewer summary in the writer prompt.** The writer prompt leaves out a `## Summary` or
  `### Summary` heading (any case) in `sections`, and the text under it, up to the next heading of the
  same or a higher level or the end. The rest of `sections` is passed verbatim.
- **A summary built from the outcome.** The writer prompt asks for a last section `### Summary` holding
  one line the round builds from the outcome:
  `- N findings (B blocking, I important, T nit) + P praise; open: <ids>; fixed: <ids>; refuted: <ids>`.
- The `workflow` path, the `agents` path (`review-round.mjs outcomes` jobs) and the CompozyOS
  `devkit-review` loop all take the writer prompt from the same rules section (ADR 0008 decision 5,
  ADR 0024 decision 5), so all three get the change with no edit of their own.
- Tests in `plugins/core/skills/review-change/scripts/review-round.test.mjs`, including a refuted
  finding's outcome line and its built summary line (AC-5). No test file is added or moved, so
  `scripts/test-map.json` does not change.
- Docs: step 3 of "The review round" in `docs/openspec-flow.md`, and the "Verification and the verdict
  file" paragraph of `plugins/core/skills/review-change/SKILL.md`, each gain one sentence on the whole
  disposition and the round's summary.

Non-goals: everything under "Out of scope" in `requirements.md`. The other caps (`location` 200, `text`
2000, `heading` 300) and `oneLine`'s default stay. `consolidate()` and `review.md` stay as they are. The
reviewer agent templates' own `### Summary` sections stay too: a single-pass review still writes them.
Verdict files of earlier rounds and archived changes are not rewritten. `check-file` does not start
checking the summary line, and the outcome object gains no key.

## Acceptance criteria

Copied from `requirements.md`, with their ids.

- AC-1: A finding whose reviewer disposition is `refuted: <evidence>` longer than 400 characters keeps its whole evidence in its outcome line and in the writer prompt, with no `…`.
- AC-2: A finding the verifiers refute keeps every refuting verifier's whole evidence (each longer than 400 characters in the test) in `refuted: <e1> / <e2>` in its outcome line and in the writer prompt.
- AC-3: The writer prompt no longer carries the reviewer's own summary: a heading line `## Summary` or `### Summary` (any case) in `sections` and the text under it, up to the next heading of the same or a higher level or the end, are left out; the rest of `sections` is passed verbatim.
- AC-4: The writer prompt asks for a last section `### Summary` with one line the round builds from the outcome: `- N findings (B blocking, I important, T nit) + P praise; open: <ids>; fixed: <ids>; refuted: <ids>`, where open lists findings with status `open`, fixed lists dispositions `fixed in <sha>`, refuted lists both a reviewer's own `refuted:` disposition and a verifier refutation, and an empty list reads `none`.
- AC-5: A test with a blocking or important finding the verifiers refute checks its outcome line (`· refuted: ...`, whole evidence) and the built summary line (the finding under refuted, not under open), and the verdict stays approved.
- AC-6: `node scripts/test-suite.mjs --own-files` passes, and the `review-round` spec states AC-1 to AC-4.

Exit criteria: every phase gate of `tasks.md` green
(`node scripts/test-suite.mjs --own-files && python3 scripts/check.py`); `python3 scripts/gen-catalog.py
--check`, `node plugins/compozy/kit/scripts/gen-agents.mjs --check`, `claude plugin validate .` and
`openspec validate review-writer-text --strict` pass; the real-run proof of the writer stage
(`design.md` D-6) is in `evidence.md` before the first review round.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `review-round`: adds three requirements: a disposition keeps its whole text, the writer prompt leaves
  out the reviewer's own summary, and the writer prompt asks for a summary the round builds from the
  outcome. No existing requirement changes. "The other keys keep their shape" still holds, because the
  outcome gains no key and the suite's fixtures carry short dispositions.

## Impact

- **devkit-core** (`plugins/core/`): `skills/review-change/scripts/review-round.workflow.js` (rules
  section), `skills/review-change/scripts/review-round.mjs` (the loader's name list),
  `skills/review-change/scripts/review-round.test.mjs`, `skills/review-change/SKILL.md`. Released as a
  patch (`release.md`).
- **Repository docs**: `docs/openspec-flow.md`, one sentence.
- **devkit-openspec, devkit-compozy, panel**: no file changes. `deliver-check.mjs` reads only the
  `- [blocking]`/`- [important]` lines and lines 1 and 2 of a verdict file, so the new summary line
  changes none of its answers.

Decisions cited: ADR 0008 (reviews as a workflow: decisions 4 and 5, and its "Mitigated" consequence
that a refuted finding stays listed with its evidence), ADR 0024 decision 5 (the CompozyOS review loop
over `review-round.mjs`), ADR 0034 (the release note), ADR 0036 (the selective gate). `decisions.md`
records that no new decision is needed. No open decision is inherited.
