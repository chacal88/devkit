Verdict: approved
Commit: 5c8e13d071450156fc14f29f69997bbdd09216b0

## Architecture review — release-at-merge (round 5, 442e69e..5c8e13d)

### Findings
- [important] openspec/schemas/devkit/flow.json:27 — Round 1: readiness and the release note had two owners that disagreed; a revision of the note alone was handed the same readiness brief again (S-6). · fixed in 159d2ba
- [important] plugins/openspec/hooks/deliver-check.mjs:2270 — Round 1: approvalState checked the note only on { release: true }, so planFacts and acceptDecisions read a plan whose note changed after approval as approved; D-32 keeps flow-check approvalOk as the one documented exception. · fixed in 159d2ba
- [nit] plugins/openspec/hooks/release-merge.mjs:306 — Round 1: the lookups that match a numbered ADR to its slug live in about five places; still standing, design.md:1311 keeps it as a follow-up.
- [nit] openspec/changes/release-at-merge/design.md:265 — Round 1: D-6 step 3 said the manifests were versioned on the base's text while the writer used the merged text. · fixed in 80d9425
- [nit] plugins/openspec/hooks/release-merge.mjs:537 — Round 1: --assign with no devkit.release_tag exited 2 (the blocked code) for a setup error; it now exits 3. · fixed in 80d9425
- [praise] plugins/openspec/hooks/deliver-check.mjs:7 — The D-3a module boundary still holds at 5c8e13d: deliver-check.mjs imports only node: modules, merge-setup.mjs and guard.mjs; the new adrNumberRe flows release-merge -> deliver-check only, never back.
- [nit] plugins/openspec/hooks/deliver-check.mjs:926 — gatesAtHead does not follow the release-edit rule on an owner's forced merge; the roadmap holds forced-merge-release-edit (round 28r) and test G15 now pins today's over-report. · fixed in 2cd3aa8
- [nit] plugins/openspec/hooks/release-merge.mjs:513 — numberRelease still reads the step record a second time after releaseStateAt read it; correct while both get the same head, tip and id; design.md:1311 keeps it as a follow-up.
- [important] plugins/openspec/hooks/release-merge.mjs:399 — The `ADR <NNNN>` citation form had three copies (maskCitations, sharedNumberMatch, givenBackBySpan), one across the module seam; now one exported builder adrNumberRe (deliver-check.mjs:2193) beside adrFileRe, read by all three, the number escaped. · fixed in 80ac753
- [nit] plugins/openspec/hooks/release-merge.mjs:383 — assignBlockingAt derives { from, folder, slug } from changeAdrs again, a copy of computeRelease's parse (deliver-check.mjs:2127-2128), while conduct-check.mjs:480 already holds state.release.state.adrs in that shape; left open on purpose.
- [praise] plugins/openspec/hooks/release-merge.mjs:336 — assignBlocking and ownRecords remain a real cut out of numberRelease, so the conductor's assignConflict classifies by the step's own rule with parity by construction.

Scope: re-review (round 5, authorized by the owner for F9). I judged my own round-4 findings and the product commit in the range, 80ac753; 818476b and 5c8e13d are records only (review.md, reviews/, evidence.md) and hold no topology.

Analyzed: owners: the `ADR <number>` citation form now has one owner, adrNumberRe in deliver-check.mjs (lines 2190-2195), next to adrFileRe, the owner of the file form; maskCitations (:2204), sharedNumberMatch (:2264) and release-merge givenBackBySpan (:399) are its only readers. A search of the non-test .mjs files under plugins/ finds no other copy of the pattern; release-merge.mjs:289 is the reverse literal rewrite (`ADR [slug]` to `ADR number`), not the citation pattern. Boundaries: release-merge.mjs's import line gains adrNumberRe from deliver-check.mjs, the existing direction; deliver-check.mjs's imports are unchanged (D-3a holds). Contract consumers enumerated: adrNumberRe is a new additive export; its consumers are release-merge.mjs and release-note.test.mjs; it changes no existing export's signature. Behaviour delta: the number is now escaped through esc; for the 4-digit numbers callers pass, the pattern is unchanged, and the new test pins the escape on a pattern character. Deletion tests: adrNumberRe is a one-line builder; inlining it brings back three copies across a seam, so it passes on leverage and single ownership, not depth (the same reason as adrFileRe). Test G15 (deliver-check-archive.test.mjs) adds no module; it pins today's forced-merge over-report until roadmap round 28r forced-merge-release-edit (D-29), which matches F7's recorded follow-up.

Not findings: F10 stays a nit by the conductor's choice; it breaks no boundary.

Tests run once, through scripts/test-suite.mjs at 5c8e13d (wholesuite.sh printed nothing; load average about 30 from the other reviewers' filtered runs of this round). The tool moved the command to the background after 180 s; I waited for it to end before answering: env TMPDIR=/var/tmp/devkit-release-at-merge GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=3 plugins/openspec/hooks/release-note.test.mjs plugins/openspec/hooks/release-merge.test.mjs printed `suite: 2 files, 165 tests, 165 pass, 0 fail, 198.8s, concurrency 3`. My wait loop also matched the other reviewers' runs, so I stopped it (pid 4064753) once my run had ended; none of my commands are left running.

Escalation: none. No blocking or important finding is open: F9 is fixed in 80ac753; F3, F8 and F10 are open nits recorded as follow-ups.
