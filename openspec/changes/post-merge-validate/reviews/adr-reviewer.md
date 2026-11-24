Verdict: approved
Commit: 7f9624e3d9f70fe680520528fd76ab79fd8cdf95

## ADR review — post-merge-validate

### Findings
- [important] plugins/openspec/hooks/change-loop.mjs:2739 and 2795 — merge-check was a command-only session step missing from COMMAND_STEPS, so the CompozyOS view handed it to a coordinator agent (ADR 0024 decision 4); now listed, with a passing compozy view test. · fixed in 86c928f864ffa621bcfec985231e19be67288d8a
- [nit] docs/adr/0017-a-change-state-is-derived-in-one-place.md:22 (third Note in Context) — The Note keeps the words 'status: proposed' for good though the ADR is accepted and nothing flips them; reword without a status clause. Left open on purpose, the ADR is the adr-author's file.
- [nit] plugins/openspec/hooks/change-loop.mjs:1365-1376 and redsAfter; design.md — The loop's own count of reds against ceilings.default sits outside the checker of ADR 0010 decision 3; the design now cites decision 3 and says why the count is the loop's own fact. · fixed in 86c928f864ffa621bcfec985231e19be67288d8a
- [nit] docs/adr/0017-a-change-state-is-derived-in-one-place.md:26 — The Note names the check as `openspec validate <id> --strict`, while the command now runs with `--type change`; align the wording when the adr-author next touches the Note (the ADR is not this change's file, so it stays open).

The range 369bbac..7f9624e holds 1c283d6 and an evidence commit. 1c283d6 changes only the text and the argument list of the check, now `openspec validate <id> --type change --strict`. ADR 0017's record path and fact-not-state shape are untouched, ADR 0010 decision 3 holds, the ADR 0024 COMMAND_STEPS entry is unchanged. No ADR conflict was found; 21 post-merge-validate tests pass.

### Summary
- 4 findings (0 blocking, 0 important, 2 nit still open, 2 resolved)
