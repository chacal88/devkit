Verdict: rejected
Commit: e2efd38e178c89039a803580ae3d19d8117463c5

## Spec review — release-at-merge

### Findings
- [important] plugins/openspec/hooks/deliver-check.mjs:30-42 (CITATION_PATHSPEC, holdsCitations); plugins/openspec/hooks/release-merge.mjs numberRelease — Partial: citations were rewritten and checked only in .md/.yaml/.yml files, narrower than 'An unnumbered ADR is numbered at the delivery' (every tracked text file outside openspec/changes/). · fixed in 3510ecf43f98b01a0c77eeb3f5825cbcba65b697
- [important] openspec/specs/change-coordination/spec.md:203-244 vs specs/change-delivery 'With no train the release is assigned by one step before the merge' — Two specs disagreed: the canonical conflict scenarios (blocked end, update-branch) held for every change while the delta answers assign-release for a noted change. · fixed in d66e5600f68aba680c6e976549ecd6dec4ade75f
- [important] evidence.md 'Open item for the owner' (attempt 1); plan-readiness-review SKILL.md; proof/agents-run.md S-6 — A readiness finding on release.md could only be cleared by editing release.md, which staled nothing, so the loop re-handed the same revision brief until no progress. · fixed in 159d2bacc837a4f9e95f7a0c5e66f179b83e0bdf
- [important] scripts/check.py check_adrs (design D-12) — AC-6's check.py rules (unnumbered ADR on the base, two records with one slug, an unlisted unnumbered record) had no requirement in any spec delta. · fixed in d66e5600f68aba680c6e976549ecd6dec4ade75f
- [nit] specs/change-delivery 'A plain commit on the branch keeps its rule'; deliver-check.mjs releaseOnlyEdit — The MODIFIED requirement did not name the change's own ADR renumbered by a later run of the step as a release edit. · fixed in d66e5600f68aba680c6e976549ecd6dec4ade75f
- [nit] openspec/specs/delivery-train/spec.md:144 'Release numbers follow the boarding order on the train only' — The canonical train-numbering requirement was not scoped to heads with no note beside the ADDED join requirement. · fixed in d66e5600f68aba680c6e976549ecd6dec4ade75f
- [nit] plugins/openspec/hooks/release-merge.mjs:580 (--assign with no devkit.release_tag) — --assign with no devkit.release_tag exited 2 with no requirement behind it, though the header reserves 3 for setup errors. · fixed in 80d9425aa095f61f46b30cd01da9668abe862f4c
- [important] openspec/changes/release-at-merge/specs/change-delivery/spec.md:71-76; deliver-check.mjs stepRecord; docs/adr/0035-release-at-merge-step-record.md decision 3 — Spec ambiguity resolved silently against an accepted ADR: the requirement and ADR decision 3 said the latest recorded commit decides, the code reads each key from the newest recorded commit that wrote it, and no scenario covered a number kept across a later step commit. Now the delta reads per line with scenario 'A number the step kept across a later step commit' (f9f7b8f) and ADR 0035 carries the owner's dated note. · fixed in 8b5075852419f3e4aaec9e8b6dcfddf884d2c102
- [important] openspec/specs/change-delivery/spec.md 'The open items of a forced merge are named' vs specs/change-delivery 'A plain commit on the branch keeps its rule' (scenario 'The step's commit') — Two specs disagreed on whether the step's commit leaves evidence and approved reviews current on an owner's forced merge. The delta now scopes the release-edit rule to the normal path and hands a forced merge to the canonical requirement; the gatesAtHead allowance is roadmap line forced-merge-release-edit (2cd3aa8). · fixed in f9f7b8f1bb418d6e8af55f241486d9697c16fe82
- [nit] plugins/openspec/skills/ship-change/SKILL.md (Hosts, app bullet) — The app host sentence reported every merge conflict blocked: item 5 except with a train, leaving out the noted no-train change that row N5 hands assign-release. · fixed in 2cd3aa8870a866b370ff679879e13f8f36e00b3f
- [blocking] openspec/changes/release-at-merge/specs/change-coordination/spec.md:72-168 vs openspec/changes/coordinator-loop-fixes/specs/change-coordination/spec.md:6-103 (same requirement 'From the implementatio… — Gap and spec conflict (escalate). Two open changes, both merged on main, MODIFY this one requirement, and each archive replaces the whole block. This change's block keeps the pre-coordinator-loop-fixes text: scenario 'A conflict in any other file' (no note: the run ends blocked), scenario 'A phase gate' (red: the run ends blocked), and the override '(a release-file conflict)'. It also lacks 'A conflict git cannot classify' and 'A task the conducting session does'. HEAD instead hands resolve-base-conflict and one gate fix, so two of this delta's scenarios are not delivered, and archiving it after coordinator-loop-fixes would revert that change's requirement. Rebase the block onto coordinator-loop-fixes' text, or the owner decides which is authoritative.
- [important] openspec/changes/coordinator-loop-fixes/specs/change-coordination/spec.md:356-385 ('A conflict outside the release files goes to the implementer') vs openspec/changes/release-at-merge/specs/change-co… — Two specs disagree (escalate). coordinator-loop-fixes gives resolve-base-conflict to every change in conflict outside the release files, except stop-archive, rejoin-train and train projects. This change gives a noted change in a project with no train assign-release, then blocked on exit 2. Neither scopes the other. The code follows this change: N5 runs first, and the override skips a noted change. Evidence lists this as interaction 2, left as merged, with no spec, test or roadmap line. The owner decides.
- [important] openspec/changes/coordinator-loop-fixes/specs/change-stages/spec.md:6-51 ('A plan revised after the work started goes back to its gates') vs openspec/changes/release-at-merge/specs/change-delivery/sp… — Spec ambiguity resolved silently. flow-check's approvalOk reads approvalState with the note, so a started noted change whose plan files and release.md both changed after the approval never fires plan-revised. It goes to stop-plan-approval (row A1), and the owner approves a revised plan the readiness review never re-ran on, against coordinator-loop-fixes' SHALL. No scenario covers the combined case, no test exercises it, and no follow-up records it (evidence interaction 1).
- [nit] openspec/changes/release-at-merge/evidence.md 'Open items for a follow-up'; tasks.md 'Workflow follow-up' — Evidence attempt 4 lists three post-merge open items: the two coordinator-loop-fixes interactions and the step's give-back that cannot merge the one-line ADRs: list of openspec/config.yaml. Unlike D-29's line, none of them reached tasks.md's follow-up list or the roadmap.

In-scope specs: openspec/changes/release-at-merge/specs/change-delivery/spec.md (changed in range: f9f7b8f), openspec/changes/release-at-merge/specs/change-coordination/spec.md, openspec/changes/release-at-merge/specs/change-stages/spec.md, openspec/changes/release-at-merge/specs/delivery-train/spec.md, openspec/changes/release-at-merge/specs/reviews-check/spec.md (the last four unchanged in range); canonical openspec/specs/change-delivery, change-coordination, change-stages, delivery-train, reviews-check, release-tags (unchanged in range; only compozy-kit-setup and project-setup moved, project-setup's own content); the open, merged-but-unarchived deltas this change now meets: openspec/changes/coordinator-loop-fixes/specs/change-coordination/spec.md and openspec/changes/coordinator-loop-fixes/specs/change-stages/spec.md (train 19, main 2ddaf16), and openspec/changes/project-setup/specs/* (no requirement shared with this change); decisions: docs/adr/0034-release-at-merge.md, docs/adr/0035-release-at-merge-step-record.md (with the 2026-11-25 note), the owner's "1a e 2b" (design D-28 to D-30).

### Coverage
| Requirement | Status |
|-------------|--------|
| change-delivery: A change states its release in a note when its project names a release file | covered |
| change-delivery: A malformed release note is refused naming the field | covered |
| change-delivery: A change with a release note leaves the release lines as the base has them | covered |
| change-delivery: A release line the step wrote is known by the step's own record | covered (read per line; new scenario "A number the step kept across a later step commit" proven by release-merge.test.mjs:1022, which passed in my run) |
| change-delivery: The release is never judged without the base | covered |
| change-delivery: A change with neither a note nor a bump of its own is refused | covered |
| change-delivery: The plan approval covers the release note | covered |
| change-delivery: Every reader of the plan approval checks the release note | covered; its meeting with coordinator-loop-fixes' plan-revised rule is unspecified (F13) |
| change-delivery: With no train the release is assigned by one step before the merge | covered; disagrees with coordinator-loop-fixes' ADDED "A conflict outside the release files goes to the implementer" (F12) |
| change-delivery: The release step merges the base and commits only release lines | covered (this change's own run at 6836ad2 over train 19) |
| change-delivery: The release step records what it wrote and numbers again after a merge by hand | covered |
| change-delivery: An unnumbered ADR is numbered at the delivery | covered (ADR 0034, ADR 0035 at 6836ad2) |
| change-delivery: A citation lives in every text file but tests and fixtures | covered |
| change-delivery: The file form of a citation is rewritten only where it names an ADR folder's file | covered |
| change-delivery: The numbering refuses a slug taken and a citation not landed | covered |
| change-delivery: A consumer project's release file follows the note | covered |
| change-delivery: A release bump on a pack's own manifest is stated under packs | covered |
| change-delivery: The repository check refuses an unnumbered ADR on the base | covered |
| change-delivery: The repository check refuses an unlisted unnumbered ADR and a slug held twice | covered |
| change-delivery (MODIFIED): An ADR number taken on the default branch is renumbered without the owner | covered |
| change-delivery (MODIFIED): A plain commit on the branch keeps its rule | covered (scoped to the normal path; forced merge reads the canonical forced-merge requirement; roadmap line forced-merge-release-edit) |
| change-coordination: The release assignment is a session step of the delivery | covered |
| change-coordination: The conductor numbers a noted change only through the release step | covered |
| change-coordination: The planner does not stop without the release note | covered |
| change-coordination: A decision record listed without a number is found after its numbering | covered |
| change-coordination (MODIFIED): From the implementation on, the step inside the stage goes to its role | partial: the noted-change scenarios hold; the block's no-note scenarios "A conflict in any other file" and "A phase gate" are contradicted by the code at HEAD, and the block collides with coordinator-loop-fixes' MODIFIED block of the same requirement (F11) |
| change-coordination (MODIFIED): A requirement a merged change contradicts reopens the grill | covered |
| change-coordination (MODIFIED): The loop fetches the base branch before it judges a delivery step | covered |
| change-stages (MODIFIED): A plan stage is stale after a plan file changes, until the work starts | covered |
| delivery-train: A join numbers the release a boarded change's note states | covered |
| delivery-train (MODIFIED): Release numbers follow the boarding order on the train only | covered |
| reviews-check (MODIFIED): The train's own commits change only releases, the roadmap and its record | covered |
| release-tags (AC-13, unchanged) | covered |

### Re-review scope
I checked my ten round-2 findings and the first-parent line c1c875e..e2efd38: f9f7b8f (phase 10 plan, the change-delivery delta), 8b50758 (ADR note), 2cd3aa8 (ship-change, test renames, roadmap), e633b9a and 6836ad2 (the step's runs), 13e44cc (the hand give-back), 7a92080 (merge of coordinator-loop-fixes with project-setup), 49d7679 (three tests), 4944c5b (kit path) and e2efd38 (evidence attempt 4). The content brought in by 7a92080 and 6836ad2 was read only where it meets this change. I compared every MODIFIED requirement of this change with the MODIFIED blocks of the other open changes now on the base. Only "From the implementation on, the step inside the stage goes to its role" is modified by both. Neither design.md of release-at-merge nor that of coordinator-loop-fixes mentions the other's block.

### Round-2 findings
- F8: the delta reads the record per line and adds the scenario (f9f7b8f). ADR 0035's Context opens with the owner's dated note, word for word as D-28, with no token and no number (8b50758). The scenario's test asserts every part of the THEN.
- F9: "A plain commit on the branch keeps its rule" and its scenario "The step's commit" now hand an owner's forced merge to "The open items of a forced merge are named" (f9f7b8f), so neither requirement contradicts the other. The gatesAtHead allowance is the roadmap line forced-merge-release-edit under Round 28p (2cd3aa8), as the owner decided (2b).
- F10: the ship-change app bullet names the noted no-train exception and row N5 (2cd3aa8).

### The evidence's open items
- Forced merge: answered by 2b (F9 above). No finding.
- Give-back of the one-line ADRs: list: this came up when merging a stacked change branch, not origin/<base>, which is outside the step's requirements. It was not reproduced, and the step's run at 6836ad2 over train 19 is clean. No follow-up records it (F14).
- Interaction 1 (flow-check.mjs:321 approvalOk through approvalState with the note): F13.
- Interaction 2 (deliver-check.mjs:2858 N5 before conduct-check.mjs:491, which skips releaseConflict for a noted change): F12. The spec text it rests on is F11.
- 13e44cc (a hand edit of release lines with no trailer) followed by 6836ad2: the step then numbered from the base's tree, and deliver-check names no row N1 to N7. That is consistent with "A release line the step wrote is known by the step's own record". No finding.
- 49d7679: the three tests change only their expectations of the merged approval form (- Plan:) and of the kit path. No assertion of this change's rules was weakened. No finding.
- 4944c5b: the plan text only (gate paths, AC-14 path). No behaviour change. No finding.

### Spot checks
- conduct-check.mjs:416-450 releaseConflict hands resolve-base-conflict for a conflict outside the release files (coordinator-loop-fixes D-5) and one fix for a red gate. conduct-check.mjs:490-491 skips it when state.release.noted.
- deliver-check.mjs:2858 answers assign-release for a noted change in conflict before item 5's blocked end.
- flow-check.mjs:321 sets approvalOk from approvalState(located.dir).ok, which requires the note's hash. flow-check.mjs:570 fires plan-revised only when approvalOk.
- Test run, foreground, after wholesuite.sh printed nothing (load 0.33): TMPDIR=/var/tmp/devkit-release-at-merge node scripts/test-suite.mjs --concurrency=3 plugins/openspec/hooks/release-merge.test.mjs plugins/openspec/hooks/release-note.test.mjs printed 'suite: 2 files, 157 tests, 157 pass, 0 fail, 27.9s, concurrency 3'.

### Escalations for the owner
- F11 and F12: two specs disagree about the same behaviour. Both deltas are open, both are merged on main, and each would overwrite or contradict the other at the archive. The owner decides which is authoritative for a noted change in conflict outside the release files (assign-release then blocked, or resolve-base-conflict). This change's MODIFIED block then has to carry coordinator-loop-fixes' text and scenarios, or the reverse.

### Summary
- 14 findings: 10 from earlier rounds, all fixed (F1-F7 in round 2; F8, F9 and F10 in this range), and 4 new ones: F11 blocking (this change's MODIFIED change-coordination block is stale against coordinator-loop-fixes' block of the same requirement, and two of its no-note scenarios are contradicted at HEAD; escalated), F12 important (noted-change conflict: assign-release against resolve-base-conflict; escalated), F13 important (the note's hash in approvalOk suppresses plan-revised; resolved silently by the code), and F14 nit (the post-merge open items have no follow-up line). 0 scope creep. 1 gap (F11).
