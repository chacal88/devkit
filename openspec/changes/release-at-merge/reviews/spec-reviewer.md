Verdict: approved
Commit: 442e69e1fcdfed53909e1d597685508a2e1fbb33

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
- [blocking] openspec/changes/release-at-merge/specs/change-coordination/spec.md:97-211 vs openspec/specs/change-coordination/spec.md:213-311 ('From the implementation on, the step inside the stage goes to its ro… — This change's MODIFIED block kept the pre-coordinator-loop-fixes text (blocked end for any other conflict, red gate blocked) and lacked two scenarios, colliding with coordinator-loop-fixes' block of the same requirement. · fixed in 8c59255d0193ab5ffdeae3d3f303b7fdd8ee4e6a
- [important] openspec/specs/change-coordination/spec.md:1661 ('A conflict outside the release files goes to the implementer') vs specs/change-coordination of this change — coordinator-loop-fixes gave resolve-base-conflict to every change in conflict outside the release files while this change gave a noted change assign-release then blocked. · fixed in 81d180a0edd8e4df68c8e7d9210f0140a2e9b5c6
- [important] openspec/specs/change-stages/spec.md:770 ('A plan revised after the work started goes back to its gates'); plugins/openspec/hooks/flow-check.mjs:321 — approvalOk read the approval with the note, so a plan revised together with its note after the start skipped plan-revised; resolved silently. · fixed in 355c22c2879b429a693704c2b30f1a1f951732cc
- [nit] openspec/changes/release-at-merge/evidence.md 'Open items for a follow-up'; tasks.md 'Workflow follow-up' — The three post-merge open items of evidence attempt 4 reached no follow-up line. · fixed in 355c22c2879b429a693704c2b30f1a1f951732cc
- [nit] openspec/changes/release-at-merge/tasks.md 'Workflow follow-up' (At the archive, D-33, F-13) and task 11.1's done condition; proposal.md:204; design.md:38 — After train 20 archived coordinator-loop-fixes, the archive-order follow-up, task 11.1's comparison against openspec/changes/coordinator-loop-fixes/specs/change-coordination/spec.md (no longer present) and the 'not archived' wording are stale plan metadata; evidence attempt 6 records it but nothing schedules the text fix.

In-scope specs: openspec/changes/release-at-merge/specs/change-coordination/spec.md (changed in range: 8c59255), openspec/changes/release-at-merge/specs/change-delivery/spec.md (changed in range: 8c59255), openspec/changes/release-at-merge/specs/change-stages/spec.md, openspec/changes/release-at-merge/specs/delivery-train/spec.md, openspec/changes/release-at-merge/specs/reviews-check/spec.md (the last three unchanged in range); canonical openspec/specs/change-coordination, change-stages, change-delivery, delivery-train, reviews-check, which now hold coordinator-loop-fixes, project-setup and archive-release-pin (train 20, merged in 5565091); decisions: docs/adr/0034-release-at-merge.md, docs/adr/0035-release-at-merge-step-record.md (the span-by-span note of 03d6fa7, which the owner's approval of phase 11 accepts).

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
| change-delivery: Every reader of the plan approval checks the release note | covered (the stage checker named as the one exception) |
| change-delivery: A plan revised with its note after the start goes back to the readiness review (ADDED, phase 11) | covered (flow-check.mjs:323 reads approvalState with release false; test 'release-note AC-12 stages: ... plan-revised, and the note alone is not') |
| change-delivery: With no train the release is assigned by one step before the merge | covered (conflict true on N5 in place of the conflict stop; test 'row N5') |
| change-delivery: The release step merges the base and commits only release lines | covered |
| change-delivery: The release step records what it wrote and numbers again after a merge by hand | covered (five scenarios, each with its release-merge.test.mjs test, the span-level give-back) |
| change-delivery: An unnumbered ADR is numbered at the delivery | covered |
| change-delivery: A citation lives in every text file but tests and fixtures | covered |
| change-delivery: The file form of a citation is rewritten only where it names an ADR folder's file | covered |
| change-delivery: The numbering refuses a slug taken and a citation not landed | covered |
| change-delivery: A consumer project's release file follows the note | covered |
| change-delivery: A release bump on a pack's own manifest is stated under packs | covered |
| change-delivery: The repository check refuses an unnumbered ADR on the base | covered |
| change-delivery: The repository check refuses an unlisted unnumbered ADR and a slug held twice | covered |
| change-delivery (MODIFIED): An ADR number taken on the default branch is renumbered without the owner | covered |
| change-delivery (MODIFIED): A plain commit on the branch keeps its rule | covered (sharedNumberMatch for two records holding one number, d9f3872, with its stale and not-stale tests) |
| change-coordination: The release assignment is a session step of the delivery | covered (exit 2 listing conflicts with no error runs next again; test 'AC-4 format') |
| change-coordination: The conductor numbers a noted change only through the release step | covered |
| change-coordination: The conductor classifies a noted change's conflict by the release step's rule (ADDED, phase 11) | covered (conduct-check.mjs assignConflict; three scenarios, each with a conduct test) |
| change-coordination: The planner does not stop without the release note | covered |
| change-coordination: A decision record listed without a number is found after its numbering | covered |
| change-coordination (MODIFIED): From the implementation on, the step inside the stage goes to its role | covered (block now equals the canonical text plus additions only) |
| change-coordination (MODIFIED): A requirement a merged change contradicts reopens the grill | covered |
| change-coordination (MODIFIED): The loop fetches the base branch before it judges a delivery step | covered (new scenario with its fetch test) |
| change-stages (MODIFIED): A plan stage is stale after a plan file changes, until the work starts | covered |
| delivery-train: A join numbers the release a boarded change's note states | covered |
| delivery-train (MODIFIED): Release numbers follow the boarding order on the train only | covered |
| reviews-check (MODIFIED): The train's own commits change only releases, the roadmap and its record | covered |

### Re-review scope
I checked my four open round-3 findings (F11 to F14) and the first-parent line e2efd38..442e69e: 8c59255 (phase 11 plan and deltas), 03d6fa7 (ADR 0035 note), 81d180a (assignConflict, N5 conflict flag), 355c22c (approvalOk without the note, span give-back), d9f3872 (real runs, sharedNumberMatch, the implementer's block), 5565091 (merge of train 20), f7e2845 (roadmap 28r), 90e20ee (kit copy), ceaae56 and 442e69e (evidence). The train-20 content was read only where it meets this change.

### Round-3 findings
- F11: I diffed each MODIFIED block of the five deltas against the canonical requirement at HEAD, with coordinator-loop-fixes now archived. Every block equals the canonical text plus additions scoped to a change with a release note: a no-note qualifier on three scenarios, two noted scenarios, and the noted sentence of the requirement. No canonical line is dropped. 'A conflict git cannot classify', 'A task the conducting session does' and the red-gate fix are kept. No ADDED requirement of this change already exists in the canonical specs.
- F12: a noted change in conflict outside the release lines now goes to resolve-base-conflict and then assign-release. That agrees with canonical 'A conflict outside the release files goes to the implementer', which this change extends with assign-release after the push and does not contradict. The code matches: deliveryRow uses assignConflict for a noted change, and the tests cover the conflict, behind and one-line-list cases.
- F13: there is a new ADDED requirement with two scenarios, the reader exception is written into 'Every reader of the plan approval checks the release note', flow-check.mjs reads approvalState(dir, { release: false }), and there is a test of both cases.
- F14: the two interactions are now requirements (D-31, D-32). D-34 builds the span-level give-back and covers the one-line list case with scenarios and tests. Evidence attempt 6 lists its own open items, and the forced-merge one is on the roadmap under Round 28r.

### Spot checks
- The implementer's text addition (a hand-off with no phase returns the block with Outcome last, d9f3872) serves the canonical 'The implementer cannot resolve it' scenario and is pinned by the AC-14 text test. I do not count it as scope creep.
- The openspec/config.yaml lines Gates and Base renames came from main through 5565091, not from this change.
- openspec validate release-at-merge --type change --strict: valid.
- Test run in the foreground, after wholesuite.sh printed nothing (load 0.45): TMPDIR=/var/tmp/devkit-release-at-merge node scripts/test-suite.mjs --concurrency=3 plugins/openspec/hooks/release-merge.test.mjs plugins/openspec/hooks/release-note.test.mjs plugins/openspec/hooks/flow-check.test.mjs printed 'suite: 3 files, 341 tests, 341 pass, 0 fail, 89.6s, concurrency 3'.

### Summary
- 15 findings: 14 from earlier rounds, all fixed (F11 to F14 in this range), and 1 new nit (F15, stale plan text about coordinator-loop-fixes' archive order). 0 scope creep, 0 gaps, no escalation left open.
