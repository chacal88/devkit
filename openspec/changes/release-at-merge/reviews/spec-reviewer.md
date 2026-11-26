Verdict: approved
Commit: 5c8e13d071450156fc14f29f69997bbdd09216b0

## Spec review — release-at-merge

### Findings
- [important] plugins/openspec/hooks/deliver-check.mjs:30-42 (CITATION_PATHSPEC, holdsCitations); plugins/openspec/hooks/release-merge.mjs numberRelease — Partial: citations were rewritten and checked only in .md/.yaml/.yml files, narrower than 'An unnumbered ADR is numbered at the delivery'. · fixed in 3510ecf43f98b01a0c77eeb3f5825cbcba65b697
- [important] openspec/specs/change-coordination/spec.md:203-244 vs specs/change-delivery 'With no train the release is assigned by one step before the merge' — Two specs disagreed: the canonical conflict scenarios held for every change while the delta answers assign-release for a noted change. · fixed in d66e5600f68aba680c6e976549ecd6dec4ade75f
- [important] evidence.md 'Open item for the owner' (attempt 1); plan-readiness-review SKILL.md; proof/agents-run.md S-6 — A readiness finding on release.md could only be cleared by editing release.md, which staled nothing, so the loop re-handed the same revision brief. · fixed in 159d2bacc837a4f9e95f7a0c5e66f179b83e0bdf
- [important] scripts/check.py check_adrs (design D-12) — AC-6's check.py rules had no requirement in any spec delta. · fixed in d66e5600f68aba680c6e976549ecd6dec4ade75f
- [nit] specs/change-delivery 'A plain commit on the branch keeps its rule'; deliver-check.mjs releaseOnlyEdit — The MODIFIED requirement did not name the change's own ADR renumbered by a later run of the step as a release edit. · fixed in d66e5600f68aba680c6e976549ecd6dec4ade75f
- [nit] openspec/specs/delivery-train/spec.md:144 'Release numbers follow the boarding order on the train only' — The canonical train-numbering requirement was not scoped to heads with no note beside the ADDED join requirement. · fixed in d66e5600f68aba680c6e976549ecd6dec4ade75f
- [nit] plugins/openspec/hooks/release-merge.mjs:580 (--assign with no devkit.release_tag) — --assign with no devkit.release_tag exited 2 with no requirement behind it. · fixed in 80d9425aa095f61f46b30cd01da9668abe862f4c
- [important] specs/change-delivery/spec.md:71-76; deliver-check.mjs stepRecord; docs/adr/0035-release-at-merge-step-record.md decision 3 — Spec ambiguity resolved silently against an accepted ADR: latest recorded commit vs per-key reading. · fixed in 8b5075852419f3e4aaec9e8b6dcfddf884d2c102
- [important] openspec/specs/change-delivery/spec.md 'The open items of a forced merge are named' vs specs/change-delivery 'A plain commit on the branch keeps its rule' — Two specs disagreed on whether the step's commit leaves evidence and approved reviews current on an owner's forced merge. · fixed in f9f7b8f1bb418d6e8af55f241486d9697c16fe82
- [nit] plugins/openspec/skills/ship-change/SKILL.md (Hosts, app bullet) — The app host sentence left out the noted no-train change that row N5 hands assign-release. · fixed in 2cd3aa8870a866b370ff679879e13f8f36e00b3f
- [blocking] openspec/changes/release-at-merge/specs/change-coordination/spec.md:97-211 vs openspec/specs/change-coordination/spec.md:213-311 ('From the implementation on, the step inside the stage goes to its ro… — This change's MODIFIED block kept the pre-coordinator-loop-fixes text and lacked two scenarios, colliding with coordinator-loop-fixes' block of the same requirement. · fixed in 8c59255d0193ab5ffdeae3d3f303b7fdd8ee4e6a
- [important] openspec/specs/change-coordination/spec.md:1661 ('A conflict outside the release files goes to the implementer') vs specs/change-coordination of this change — coordinator-loop-fixes gave resolve-base-conflict to every change in conflict outside the release files while this change gave a noted change assign-release then blocked. · fixed in 81d180a0edd8e4df68c8e7d9210f0140a2e9b5c6
- [important] openspec/specs/change-stages/spec.md:770 ('A plan revised after the work started goes back to its gates'); plugins/openspec/hooks/flow-check.mjs:321 — approvalOk read the approval with the note, so a plan revised together with its note after the start skipped plan-revised; resolved silently. · fixed in 355c22c2879b429a693704c2b30f1a1f951732cc
- [nit] openspec/changes/release-at-merge/evidence.md 'Open items for a follow-up'; tasks.md 'Workflow follow-up' — The three post-merge open items of evidence attempt 4 reached no follow-up line. · fixed in 355c22c2879b429a693704c2b30f1a1f951732cc
- [nit] openspec/changes/release-at-merge/tasks.md 'Workflow follow-up' (At the archive, D-33, F-13) and task 11.1's done condition; proposal.md:204; design.md:38 — After train 20 archived coordinator-loop-fixes, the archive-order follow-up, task 11.1's comparison against the no-longer-present coordinator-loop-fixes delta and the 'not archived' wording are stale plan metadata; the range 442e69e..5c8e13d does not touch tasks.md, proposal.md or design.md.

In-scope specs: openspec/changes/release-at-merge/specs/change-delivery/spec.md, openspec/changes/release-at-merge/specs/change-coordination/spec.md, openspec/changes/release-at-merge/specs/change-stages/spec.md, openspec/changes/release-at-merge/specs/delivery-train/spec.md, openspec/changes/release-at-merge/specs/reviews-check/spec.md (none changed in range 442e69e..5c8e13d); canonical openspec/specs/change-delivery, change-coordination, change-stages, delivery-train, reviews-check; decisions: docs/adr/0034-release-at-merge.md, docs/adr/0035-release-at-merge-step-record.md (not touched in range).

### Coverage
| Requirement | Status |
|-------------|--------|
| change-delivery: A change states its release in a note when its project names a release file | covered |
| change-delivery: A malformed release note is refused naming the field | covered |
| change-delivery: A change with a release note leaves the release lines as the base has them | covered |
| change-delivery: A release line the step wrote is known by the step's own record | covered |
| change-delivery: The release is never judged without the base | covered |
| change-delivery: A change with neither a note nor a bump of its own is refused | covered |
| change-delivery: The plan approval covers the release note | covered |
| change-delivery: Every reader of the plan approval checks the release note | covered |
| change-delivery: A plan revised with its note after the start goes back to the readiness review | covered |
| change-delivery: With no train the release is assigned by one step before the merge | covered |
| change-delivery: The release step merges the base and commits only release lines | covered |
| change-delivery: The release step records what it wrote and numbers again after a merge by hand | covered (givenBackBySpan now reads ADR <number> through adrNumberRe, 80ac753; behaviour unchanged for numeric numbers) |
| change-delivery: An unnumbered ADR is numbered at the delivery | covered (maskCitations through adrNumberRe, 80ac753) |
| change-delivery: A citation lives in every text file but tests and fixtures | covered |
| change-delivery: The file form of a citation is rewritten only where it names an ADR folder's file | covered |
| change-delivery: The numbering refuses a slug taken and a citation not landed | covered |
| change-delivery: A consumer project's release file follows the note | covered |
| change-delivery: A release bump on a pack's own manifest is stated under packs | covered |
| change-delivery: The repository check refuses an unnumbered ADR on the base | covered |
| change-delivery: The repository check refuses an unlisted unnumbered ADR and a slug held twice | covered |
| change-delivery (MODIFIED): An ADR number taken on the default branch is renumbered without the owner | covered |
| change-delivery (MODIFIED): A plain commit on the branch keeps its rule | covered (sharedNumberMatch through adrNumberRe, 80ac753; the forced-merge sentence at spec.md:431-432 and scenario 'The step's commit' line 446 are now pinned by test G15 in deliver-check-archive.test.mjs, which lists evidence.md and each approved review as open items, as the delta says 'can list them as open items') |
| change-coordination: The release assignment is a session step of the delivery | covered |
| change-coordination: The conductor numbers a noted change only through the release step | covered |
| change-coordination: The conductor classifies a noted change's conflict by the release step's rule | covered |
| change-coordination: The planner does not stop without the release note | covered |
| change-coordination: A decision record listed without a number is found after its numbering | covered |
| change-coordination (MODIFIED): From the implementation on, the step inside the stage goes to its role | covered |
| change-coordination (MODIFIED): A requirement a merged change contradicts reopens the grill | covered |
| change-coordination (MODIFIED): The loop fetches the base branch before it judges a delivery step | covered |
| change-stages (MODIFIED): A plan stage is stale after a plan file changes, until the work starts | covered |
| delivery-train: A join numbers the release a boarded change's note states | covered |
| delivery-train (MODIFIED): Release numbers follow the boarding order on the train only | covered |
| reviews-check (MODIFIED): The train's own commits change only releases, the roadmap and its record | covered |

### Re-review scope
This is a stale refresh of my approval at 442e69e. I checked my previous findings and the range 442e69e..5c8e13d. Its product commit is 80ac753: adrNumberRe exported from deliver-check.mjs, which replaces three inline copies of the `ADR <number>` pattern in maskCitations, sharedNumberMatch and release-merge.mjs givenBackBySpan and now escapes the number; test G15 of the forced merge of a noted change; and a unit test of adrNumberRe. The records are 818476b and 5c8e13d (review.md, reviews/, evidence.md attempt 7).

### Spot checks
- adrNumberRe is a refactor with no new behaviour a spec covers. Escaping matters only for a non-numeric number, which the numbering never produces. No requirement is added and none is dropped, so there is no scope creep.
- G15 pins the owner's decision 2b (design D-29) as the delta already writes it: on an owner's forced merge, the step's commit leaves evidence.md and the approved reviews as open items, and gatesAtHead is unchanged. The test's comment names the roadmap follow-up forced-merge-release-edit, which flips that expectation. That agrees with design.md:1262, the roadmap line. design.md:1970 still says 'no test of the over-report'. I read that line as part of the round-2 disposition table, a historical record, and do not flag it.
- F15 stays open as a nit: tasks.md, proposal.md and design.md are untouched in the range.
- openspec validate release-at-merge --type change --strict: valid.
- Test run after wholesuite.sh printed nothing (load average 30.5 at the start, so not a timing measurement): TMPDIR=/var/tmp/devkit-release-at-merge node scripts/test-suite.mjs --concurrency=3 plugins/openspec/hooks/release-note.test.mjs plugins/openspec/hooks/deliver-check-archive.test.mjs printed 'suite: 2 files, 345 tests, 345 pass, 0 fail, 729.5s, concurrency 3'. The tool moved the command to the background after 180 s. I waited for it to end before answering, and nothing is left running.

### Summary
- 15 findings: 14 from earlier rounds, all fixed, and 1 open nit (F15, stale plan text about coordinator-loop-fixes' archive order). Nothing new in range 442e69e..5c8e13d: 0 scope creep, 0 gaps, no escalation.
