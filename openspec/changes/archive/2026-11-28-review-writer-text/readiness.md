<!-- devkit-stage readiness result=passed attempt=1 commit=1e8c2a5084a7b8508f46fe3c2a4aa8e43affe817 -->
# Readiness review: review-writer-text

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

## 2. Scope validation
Classification: correct. One rules section, three small functions, two caps lifted, two doc sentences. Out-of-scope is explicit in `requirements.md` and `proposal.md`. No spec behaviour goes beyond the proposal.

## 3. Proposal review
Problem, goal and non-goals are clear and anchored to archived verdict files. Capabilities: `review-round` modified, none new. Impact lists the files and says no devkit-openspec or compozy file changes. `openspec validate review-writer-text --strict` passes. `release.md` reads: `packs:` with `devkit-core: patch`, a `##` title and a body, no open fence. No task bumps a version, edits the changelog or numbers an ADR. `decisions.md` lists no record.

## 4. Design review
Claims re-derived against the code at `1e8c2a5`; all hold:
- `oneLine(text, max = 400)` at `review-round.workflow.js:59`. With `max = Infinity`, `s.length > max` never holds, so D-1 works as written.
- `validateStage1` at `:136` has `oneLine(f.disposition, 400)`, and the regex check at `:137` runs on the collapsed text.
- `decide` at `:164` has `oneLine(v.evidence, 400)`.
- `outcomeOf` at `:215-231` gives the statuses `disposed`, `open` and `refuted`. Praise and nit get `open` through `needsVerification`. The D-3 reading is consistent with this.
- `writerPrompt` at `:297-312` ends with `outcome.sections + '\n'` and then the reply line, which is the D-4 anchor.
- `review-round.mjs` `NAMES` (`:12`) and the export list (`:36-39`) are as D-5 says.
- `checkFileCommand` requires only lines 1 and 2 and the `- [blocking|important]` lines. The summary line `- <n> findings (...)` carries no bracketed severity, so no gate reads it.
- `scripts/test-map.json` maps `RW`, `review-round.mjs`, `SKILL.md` and `docs/openspec-flow.md` as D-6 states. The map needs no edit.
- The two doc anchors exist: `docs/openspec-flow.md:447` ("from the lines it is given") and `SKILL.md:119` ("(one line, `·` replaced by `-`)" and "The writer states it"). No test pins either text.

D-2 handles unterminated and edge input (unclosed fence before and under a summary, empty text, `\r\n`, no final newline), as `config.yaml` requires of a parser.

The D-3 reading that praise is in no id list, which the plan asks this review to confirm: confirmed. It matches the reviewer templates' "N findings (...) + P praise". It also gives `open: none` for case B, where F2 is praise. It matches the spec scenario "Every list filled".

## 5. Specs review
Three requirements with SHALL and testable WHEN/THEN scenarios, which cover AC-1 to AC-4 and the AC-5 case. The `Still one line` and `The prompt names no second header line` scenarios are present. Findings in section 10.

## 6. Tasks review
Two phases, each ending in a gate task, and every AC id appears in a task. Gates are one backticked command each. Run on the base (`1e8c2a5`):
- `python3 scripts/check.py` passes.
- `node scripts/test-suite.mjs --own-files` selects no test file (2 own files), so it is green.
- `openspec validate --strict` passes.

`--test-name-pattern=` in the `=` form is supported by `scripts/test-suite.mjs:293`. The seven new tests in D-6 match the "seven" of 1.4. The real-run proof (2.1, 2.2) covers each variant (reviewer's own refutation, verifier refutation, no summary) before the first review round, as CLAUDE.md asks.

## 7. Omission detection
No findings. Validation (the disposition check still runs), rollback (revert), idempotency, compatibility (verdict-file shape unchanged) and the test strategy are all stated.

## 8. Execution risks (top 5 failures)
1. A writer agent ignores the summary instruction. Impact: a misleading reader-only line, with no gate failing. Prevention: the real-run proof checks three files.
2. `withoutSummary` drops too much on a `## Summary` used as a sub-heading. Prevention: the D-2 level rule and the D-6 AC-3 test.
3. A very long evidence line makes `review.md` and the verdict file hard to read. Accepted in the Risks section.
4. The doc sentence in `docs/openspec-flow.md` wraps so that `round builds from the outcome` splits across lines. Then the 1.5 check `grep -c` prints 0. Prevention: keep the phrase on one line.
5. The real-run writers cannot write outside the worktree. The probe in 2.1 covers it.

## 9. Mandatory fixes before implementation
None.

## 10. Optional improvements (within scope)
- [ ] Low, Nice to have: `specs/review-round/spec.md` has no scenario for D-2's "an unclosed fence before a summary" (nothing dropped), "two summaries" or "a summary at the end". D-6's AC-3 test covers them, so the code is pinned. Add one scenario for the unclosed fence before a summary if the author wants the spec to be complete.
- [ ] Low, Fix during implementation: the 1.4 check says the diff of `review-round.test.mjs` shows "only additions, plus the two names". Two existing lines are edited (the import list and the name list), so read it as "additions and those two line edits".

## 11. Explicitly out of scope
- [ ] The other caps (`location`, `text`, `heading`), `oneLine`'s default, `consolidate()` and `review.md`, the reviewer agent templates, and old verdict files.

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes, with archived files as evidence.
2. Is the result measurable? Yes, AC-1 to AC-6 each have a named test or run.
3. Are error behaviors defined? Yes: an invalid disposition still throws, and unterminated Markdown has a defined result.
4. Are edge cases covered? Yes (D-2, D-3), with the small spec gap in section 10.
5. Are dependencies clear? Yes: none beyond `6f03a57`.
6. Are contracts defined? Yes: the summary line format, the prompt text and the loader names.
7. Can two developers interpret this differently? Not materially; D-2 and D-4 give the rules and the text.
8. Are any decisions implicit instead of written? No; the praise reading is written in D-3.
9. Do the tasks fully deliver the intended outcome? Yes.
10. What will be discovered too late if implementation starts now? Nothing found. The real-run proof is the one late check, and it is scheduled before review.

## 13. Final conclusion
- Can we start? Yes.
- What must be fixed? Nothing is mandatory.
- Main risk if ignored? A writer agent keeps the reviewer's summary or drops the new one. Only the real-run proof sees it, and no gate fails.
