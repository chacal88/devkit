Verdict: approved
Commit: 52fb4faab60c31831cbeeb138b5e340f9df76392 (uncommitted changes)

## Quality review — commit-attribution (round 1)

### Findings
- [praise] plugins/openspec/hooks/change-loop.mjs:507-514 — One shared helper, keyed on the agent id the action names, is imported by project-loop instead of a second copy of the request text. Any step handed to the commit agent carries the request.
- [praise] plugins/core/agents/commit-and-pr.md (Attribution section) — Three cases are handled explicitly: a block with lines, `none`, and no block. The no-block case keeps the old behaviour, so older callers stay compatible. The agent can be checked against `ac3-trailers.txt`, whose single Opus line matches AC-3.
- [nit] .claude-plugin/marketplace.json:9, CHANGELOG.md:3 — The branch forks from c561553 and bumps to 0.27.0 / 0.11.0 / 0.23.0, deliberately one minor above origin/main (0.26.0 / 0.10.0 / 0.22.0). The branch lacks main's 0.22.0 and 0.26.0 changelog entries (PRs #58, #66), so the version, CHANGELOG and flow-doc pin hunks will conflict on rebase. Rebase onto origin/main and re-run the pin test and `check.py` before the PR.
- [nit] plugins/openspec/hooks/deliver-check.test.mjs:5256-5262 (T31), project-loop.test.mjs T25 — T31 counts the literal 'Attribution below' (exactly 2), which breaks on a harmless rewording. T25 falls back to '\u0000' if the export is missing, so the negative could pass vacuously. T21 to T24 and the change-loop tests do assert the export exists. Assert the export exists in T25 as well.
- [praise] plugins/openspec/hooks/change-loop.test.mjs (T1 to T15) — Positive tests for every commit-agent row, once-only checks, and negatives for other agents and for the plan stages and `verify`. T20 pins one block format across the request, the skill and the agent, which guards drift between the three texts.

### Summary
- 5 findings (0 blocking, 0 important, 2 nit) + 3 praise
- Justification: I read the production diff (`change-loop.mjs`, `project-loop.mjs`, the agent text, both skills, the flow doc, the CHANGELOG and the version bumps) and the three test files' hunks in the review range. I compared them with `tasks.md` and `evidence.md` and found no false claim and no contradiction with the proposal. The loop's request text lives in one place; evidence reports 0 matches for a copy in `project-loop`, which I did not re-run. Every dispatch row that goes to the commit agent and the roadmap and project loops name the Attribution block. AC-1 to AC-4 each have a real-output proof: the AC-3 run transcript, `ac3-trailers.txt` with the single Opus line, and the AC-4 `git log` output. I confirmed that `git log` at HEAD: both branch commits end with the Opus trailer and no Sonnet line. I did not run the tests; evidence reports 372 focused and 1423 whole-suite tests passing, and the whole-suite run was read from the coordinating session's log, not re-run by the verifier, which evidence states openly.

Residual risk (not a finding): the verbatim-copy guarantee depends on the model following the prompt. The tests only assert that the text is present, and AC-3 is a single real run.
