Verdict: approved
Commit: 9eaef847377372376ef25eb7a8f400d0e3ccf619

## ADR review — coordinator-loop-fixes (round 2)

### Findings
- [important] docs/adr/0032-the-loop-declares-the-decisions-outside-the-stage-gates.md:55-74 (Decision 3, 4, 5, 7); docs/compozy-kit.md:124-128 — ADR 0032 decisions 3, 4, 5 and 7 read as applying to every run, but the approved plan narrows them (CompozyOS has no declare step; an archive that left a train keeps its blocked stop-archive; approvals without a '- Plan:' line never go stale), and neither ADR 0032 nor ADR 0024 records those limits. · fixed in 3ec33222a0a1095f84cc34bedad20bb079ae01f9
- [nit] docs/adr/0032-the-loop-declares-the-decisions-outside-the-stage-gates.md:12-15 (Amends line) — ADR 0032 says it amends no accepted record, yet decision 3 raises the review stage's attempt ceiling from a record outside configuration (declared.json), which touches ADR 0010 decision 3's rule that attempt ceilings live in configuration; name that sentence in the Amends line, or say in one sentence why it is not an amendment.
- [nit] docs/adr/0023-the-model-is-chosen-by-stage.md:3-8 (header) — ADR 0033 amends ADR 0023 decision 1, but ADR 0023's header had no '- Amended by ADR 0033 (...)' line, unlike every other amended record. · fixed in 5dc0830ffaa1d2813491070bcbe1bc0096c7bdc2
- [praise] plugins/openspec/hooks/guard.mjs (DECLARE_CALL, declareViolation); plugins/openspec/hooks/change-loop.mjs (runDeclare, withStdinParam) — The round-1 fixes stay inside the existing decisions: the widened declare guard still only vetoes (ADR 0010 decision 5), and declare --stdin words reuses reply's stdin helper so the owner's own typed words reach declared.json unchanged (ADR 0032 decision 3, ADR 0021 decision 3).

ADRs reviewed:
- ADR 0010 (`docs/adr/0010-openspec-as-the-harness.md`)
- ADR 0011 (`docs/adr/0011-the-change-coordinator-is-the-owners-session.md`)
- ADR 0021 (`docs/adr/0021-a-roadmap-run-opens-every-change-at-its-start.md`)
- ADR 0022 (`docs/adr/0022-reviewed-changes-leave-on-a-delivery-train.md`)
- ADR 0023 (`docs/adr/0023-the-model-is-chosen-by-stage.md`)
- ADR 0024 (`docs/adr/0024-compozy-runs-the-short-loop.md`)
- ADR 0030 (`docs/adr/0030-the-pin-test-reads-the-manifest-so-only-the-flow-page-pins-pass-unnamed.md`)
- ADR 0032 (`docs/adr/0032-the-loop-declares-the-decisions-outside-the-stage-gates.md`)
- ADR 0033 (`docs/adr/0033-a-changes-own-settings-live-in-an-x-devkit-block.md`)

Scope (re-review): I checked only the round-1 findings and the commits since 73e159c: ccd181f, 59b8350, f1acdfd, 66f3553, 3ec3322, 5dc0830, the merge f416d6a (origin/main fc28735, train 18) and 9eaef84. The round-1 ADR set still applies. Nothing in these commits touches another ADR's subject. I ran no tests: this check needed only the diff, the ADRs and the plan, and the evidence records the verifier's filtered runs at f416d6a. I did not open the raw run logs under `proof/` or the other reviewers' files in `reviews/`. They are outside an ADR check, because no ADR decision applies to them.

Conforms:
- F1's fix adds a dated Note to ADR 0032 and leaves every decision's text unchanged. The Note names the three limits and their sources (proposal AC-7 and AC-10, design D-5 and D-7, ADR 0022 decision 8). `docs/compozy-kit.md` points at that Note for the declared-steps limit and still credits ADR 0024 only for the limits it lists. T147 checks both.
- F3's fix adds the `- Amended by ADR 0033 (...)` header line in the same form the other amended records use. T148 checks it.
- The `declare review-round --stdin words` fix (59b8350) uses reply's `--stdin` helper (one shared `withStdinParam`). The skills, design D-4 and the change-coordination delta now pass the owner's words through the quoted `<<'DEVKIT_ARGS'` heredoc. Only the owner's own typed message authorizes a round, in the change's own session (ADR 0021 decision 3, ADR 0032 decision 3), and the main session is still the only writer of `declared.json` (ADR 0010 decision 5).
- The widened `DECLARE_CALL` (66f3553) only adds node option words before the script. The rule still only vetoes a subagent's call and never drives (ADR 0010 decision 5). The file-writers delta and design D-1 name the new forms.
- T146 (f1acdfd) checks that conduct-check maps `conductor-task` to the main session, which matches ADR 0011 decision 2 (the conductor task lifts no lock).
- The merge f416d6a bumps every pack above origin/main (openspec 0.48.0, core 0.17.0, compozy 0.5.0, marketplace 0.53.0). It brings only main's own CONTRIBUTING.md, train and archive files. No new test pins a release version (ADR 0030).
- Every commit subject in the range is conventional (`docs/conventions.md`), apart from the merge commits.

### Summary
- 4 findings (0 blocking, 1 important, 2 nit, 1 praise). F1 and F3 are fixed; F2 (nit) is still open and does not reject.
