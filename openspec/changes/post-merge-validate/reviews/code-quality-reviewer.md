Verdict: approved
Commit: 7f9624e3d9f70fe680520528fd76ab79fd8cdf95

## Quality review — post-merge-validate (round 2, third pass)

### Findings
- [blocking] plugins/openspec/hooks/change-loop.mjs:1672 — validate ran without --type change, so a change named like a canonical spec ended cannot-run (ambiguous_item) and blocked · fixed in 86c928f864ffa621bcfec985231e19be67288d8a
- [nit] openspec/changes/post-merge-validate/evidence.md (AC-8), proof/real-run-red.jsonl — init line shows plugin versions 0.32.0 and 0.13.3 while the manifest says 0.40.0 · refuted: the branch's creation commit 105ea3b had plugin.json at 0.32.0 and 0.40.0 arrived only with the later merge of origin/main; evidence.md AC-8 explains the label
- [praise] plugins/openspec/hooks/change-loop.test.mjs (same-name test) — Same-name test uses a real repository, merge and openspec and covers both the green and the red path, never cannot-run
- [important] plugins/openspec/hooks/change-loop.mjs:1373 — The planner's brief, design.md, spec.md and the header comment named openspec validate <id> --strict without --type change, so for a same-name spec the planner's own confirmation command answers ambiguous_item · fixed in 1c283d6e825885d20d34de5e49552af3a02b597d
- [nit] openspec/changes/post-merge-validate/specs/change-coordination/spec.md:9-12 — Stray quoted fragment in the requirement sentence reads as pasted prose · fixed in 1c283d6e825885d20d34de5e49552af3a02b597d
- [praise] plugins/openspec/hooks/change-loop-compozy.test.mjs:1680 — A CompozyOS view test for merge-check as a command step backs the COMMAND_STEPS fix
- [praise] plugins/openspec/hooks/change-loop.test.mjs (ceiling test), design.md — The fingerprint scope is documented as deliberate and the ceiling test covers a new fingerprint after the third red
- [praise] plugins/openspec/hooks/change-loop.test.mjs (4000-character cut test) — The cut test checks the length, the ellipsis, the first line and that the record holds the cut text
- [nit] openspec/changes/post-merge-validate/proposal.md:49,55; requirements.md:6,17,33,49; design.md:241; docs/adr/0017-a-change-state-is-derived-in-one-place.md:26 — Plan prose, AC-2 and the ADR 0017 Note still write the bare openspec validate <id> --strict; design.md:241 differs from the delivered Troubleshooting row, and design.md:371 says the Note names --type change but the ADR text does not
- [praise] plugins/openspec/hooks/change-loop.test.mjs:2419,2509,2518 — The fix is pinned in three places (the brief names --type change exactly twice, the flow sentence and the roadmap line), so a regression to the bare form fails a test

### Summary
- 10 findings: 0 blocking, 0 important, 2 nit (F2 refuted, F9 open) and 1 more nit (F5) fixed, 4 praise, plus F1 and F4 fixed.
- Re-review of the third pass: F4 is closed (`--type change --strict` in the planner brief, the header comment, the command, the spec delta, design.md, the flow document, the roadmap line and the CHANGELOG; the tests pin it); 21 post-merge-validate tests pass. The only open item is F9, a nit of shorthand in plan prose and the ADR Note that nothing runs.
