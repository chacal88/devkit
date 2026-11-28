<!-- devkit-stage requirements result=passed attempt=1 commit=none -->
# Requirements

## Request

> review-writer-text: in round 3 of coordinator-loop-fixes the writer prompt of `review-round.mjs outcomes` cut a refutation mid-sentence (the code-quality file of that round) and kept a reviewer's summary line that still counted a finding the verifiers refuted as open (the ADR file); the verdicts were right. Give the writer the full disposition text and a summary built from the outcomes, with a test of a refuted finding's line and summary.

## Assumptions

- The cut comes from two 400-character caps in `plugins/core/skills/review-change/scripts/review-round.workflow.js`: `oneLine(f.disposition, 400)` in `validateStage1` (a reviewer's own disposition) and `oneLine(v.evidence, 400)` in `decide` (each verifier's evidence, which `outcomeOf` turns into `refuted: <evidence>`). Evidence: `openspec/changes/archive/2026-11-26-coordinator-loop-fixes/reviews/code-quality-reviewer.md:15` ends in `…`.
- A disposition stays one line: whitespace collapsed and `·` replaced as `oneLine` does today, because `check-file` in `review-round.mjs` compares the file line by line; only the length cap goes away. `oneLine`'s own default cap stays, and so does its test.
- A reviewer's summary lives inside `sections` (free Markdown), under a `### Summary` heading the reviewer agent templates ask for (`plugins/core/agents/code-quality-reviewer.md:126`, `adr-reviewer.md:98`, `spec-reviewer.md:98`). Evidence: `openspec/changes/archive/2026-11-26-coordinator-loop-fixes/reviews/adr-reviewer.md:31-32` counts the refuted F5 as open.
- The canonical spec is `openspec/specs/review-round/spec.md`; the change carries a delta there.
- `consolidate()` already builds `review.md` from the outcomes and does not change.

## Acceptance criteria

- AC-1: A finding whose reviewer disposition is `refuted: <evidence>` longer than 400 characters keeps its whole evidence in its outcome line and in the writer prompt, with no `…`.
- AC-2: A finding the verifiers refute keeps every refuting verifier's whole evidence (each longer than 400 characters in the test) in `refuted: <e1> / <e2>` in its outcome line and in the writer prompt.
- AC-3: The writer prompt no longer carries the reviewer's own summary: a heading line `## Summary` or `### Summary` (any case) in `sections` and the text under it, up to the next heading of the same or a higher level or the end, are left out; the rest of `sections` is passed verbatim.
- AC-4: The writer prompt asks for a last section `### Summary` with one line the round builds from the outcome: `- N findings (B blocking, I important, T nit) + P praise; open: <ids>; fixed: <ids>; refuted: <ids>`, where open lists findings with status `open`, fixed lists dispositions `fixed in <sha>`, refuted lists both a reviewer's own `refuted:` disposition and a verifier refutation, and an empty list reads `none`.
- AC-5: A test with a blocking or important finding the verifiers refute checks its outcome line (`· refuted: ...`, whole evidence) and the built summary line (the finding under refuted, not under open), and the verdict stays approved.
- AC-6: `node scripts/test-suite.mjs --own-files` passes, and the `review-round` spec states AC-1 to AC-4.

## Questions asked

- Q: Is only the reviewer disposition cap lifted, or the verifier evidence cap too? A: Both: each produces the disposition text the writer gets, and the request asks for the full disposition text. (answered by the coordinator's session on the owner's delegation of 2026-11-28)
- Q: What does the built summary say? A: The counts by severity in the reviewer agents' own template form, then the ids open, fixed and refuted, from the outcome's statuses. (answered by the coordinator's session on the owner's delegation of 2026-11-28)
- Q: Which reviewer summary is dropped, and what if there is none? A: A `## Summary` or `### Summary` heading (any case) and its text up to the next heading of the same or a higher level; with none, nothing is dropped; the round's summary is written in both cases. (answered by the coordinator's session on the owner's delegation of 2026-11-28)
- Q: Does a reviewer's own `refuted:` count with the verifiers' refutations? A: Yes, both go under refuted and neither is open. (answered by the coordinator's session on the owner's delegation of 2026-11-28)

## Out of scope

- The other caps (`location` 200, `text` 2000, `heading` 300) and `oneLine`'s default.
- `review.md` (`consolidate`) and the reviewer agent templates' own `### Summary` sections.
- Rewriting verdict files of earlier rounds or archived changes.
