Verdict: rejected
Commit: c1c875e8686bb429ab1bc3d0af2dff21d00082ba

## Spec review — release-at-merge

### Findings
- [important] plugins/openspec/hooks/deliver-check.mjs:30-42 (CITATION_PATHSPEC, holdsCitations); plugins/openspec/hooks/release-merge.mjs numberRelease — Partial: citations were rewritten and checked only in .md/.yaml/.yml files, narrower than 'An unnumbered ADR is numbered at the delivery' (every tracked text file outside openspec/changes/). · fixed in 3510ecf43f98b01a0c77eeb3f5825cbcba65b697
- [important] openspec/specs/change-coordination/spec.md:203-244 vs specs/change-delivery 'With no train the release is assigned by one step before the merge' — Two specs disagreed: the canonical conflict scenarios (blocked end, update-branch) held for every change while the delta answers assign-release for a noted change. · fixed in d66e5600f68aba680c6e976549ecd6dec4ade75f
- [important] evidence.md 'Open item for the owner' (attempt 1); plan-readiness-review SKILL.md; proof/agents-run.md S-6 — A readiness finding on release.md could only be cleared by editing release.md, which staled nothing, so the loop re-handed the same revision brief until no progress. · fixed in 159d2bacc837a4f9e95f7a0c5e66f179b83e0bdf
- [important] scripts/check.py check_adrs (design D-12) — AC-6's check.py rules (unnumbered ADR on the base, two records with one slug, an unlisted unnumbered record) had no requirement in any spec delta. · fixed in d66e5600f68aba680c6e976549ecd6dec4ade75f
- [nit] specs/change-delivery 'A plain commit on the branch keeps its rule'; deliver-check.mjs releaseOnlyEdit — The MODIFIED requirement did not name the change's own ADR renumbered by a later run of the step as a release edit. · fixed in d66e5600f68aba680c6e976549ecd6dec4ade75f
- [nit] openspec/specs/delivery-train/spec.md:144 'Release numbers follow the boarding order on the train only' — The canonical train-numbering requirement was not scoped to heads with no note beside the ADDED join requirement. · fixed in d66e5600f68aba680c6e976549ecd6dec4ade75f
- [nit] plugins/openspec/hooks/release-merge.mjs:580 (--assign with no devkit.release_tag) — --assign with no devkit.release_tag exited 2 with no requirement behind it, though the header reserves 3 for setup errors. · fixed in 80d9425aa095f61f46b30cd01da9668abe862f4c
- [important] openspec/changes/release-at-merge/specs/change-delivery/spec.md:71-76; plugins/openspec/hooks/deliver-check.mjs:2277-2319 (stepRecord); docs/adr/0032-release-at-merge-step-record.md:59-61 (decision 3) — Spec ambiguity resolved silently against an accepted ADR: 'A release line the step wrote is known by the step's own record' says the step's own latest recorded commit decides, and ADR 0032 decision 3 says stepRecord reads the newest recorded commit, but 46c3c2e makes each key take the newest of all recorded commits that wrote it. docs/openspec-flow.md was updated, the spec and the record were not, and no scenario covers a number kept across a later step commit. Owner decides: extend the spec (and amend or note ADR 0032) or narrow the code.
- [important] openspec/specs/change-delivery/spec.md:546-563 ('The open items of a forced merge are named', scenarios 'Evidence recorded before a product change' and 'A review that did not pass') vs specs/change-d… — Two specs disagree (escalate): the delta says the delivery checker reads the evidence and approved reviews as current after the step's commit, but the canonical forced-merge requirement (train 16, merged in a47cec8) lists them as open items whenever a file outside openspec/ changed after their Commit:, which the step's release commit always does. Neither scopes the other. Evidence lists this as a follow-up with no test or real run. The owner decides which is authoritative for a noted change.
- [nit] plugins/openspec/skills/ship-change/SKILL.md:124 (the app host bullet) — 'A merge conflict is reported blocked: item 5, except in a project with a delivery train' leaves out the noted change with no train, which specs/change-coordination scenario 'A change with a release note in conflict with its base' (row N5) hands assign-release. This is evidence open item 2.

In-scope specs: openspec/changes/release-at-merge/specs/change-delivery/spec.md, openspec/changes/release-at-merge/specs/change-coordination/spec.md, openspec/changes/release-at-merge/specs/change-stages/spec.md (new in round 2), openspec/changes/release-at-merge/specs/delivery-train/spec.md, openspec/changes/release-at-merge/specs/reviews-check/spec.md; canonical openspec/specs/change-delivery/spec.md (with train 16's forced-merge requirements from the base), openspec/specs/change-coordination/spec.md (with train 15's fetch requirements), openspec/specs/change-stages/spec.md, openspec/specs/delivery-train/spec.md, openspec/specs/reviews-check/spec.md, openspec/specs/release-tags/spec.md (AC-13, tag rule unchanged); decisions: docs/adr/0031-release-at-merge.md (amends 0022 and 0025; amended by 0032), docs/adr/0032-release-at-merge-step-record.md (amends 0031 decision 6), docs/adr/0022-*.md and docs/adr/0025-*.md (Amended by lines and notes).

### Coverage
| Requirement | Status |
|-------------|--------|
| change-delivery: A change states its release in a note when its project names a release file | covered |
| change-delivery: A malformed release note is refused naming the field (the `## ` body line included, D-23) | covered |
| change-delivery: A change with a release note leaves the release lines as the base has them | covered |
| change-delivery: A release line the step wrote is known by the step's own record | covered; the code reads each key's newest recorded commit, the text says the latest recorded commit (F8) |
| change-delivery: The release is never judged without the base | covered |
| change-delivery: A change with neither a note nor a bump of its own is refused | covered |
| change-delivery: The plan approval covers the release note | covered |
| change-delivery: Every reader of the plan approval checks the release note | covered (approvalState reads namesReleaseTag(changeRoot(dir)); conduct-check and acceptDecisions use it) |
| change-delivery: With no train the release is assigned by one step before the merge | covered |
| change-delivery: The release step merges the base and commits only release lines | covered (no-setting exit 3, release-merge.mjs:580) |
| change-delivery: The release step records what it wrote and numbers again after a merge by hand | covered (P-13, dogfood 923aab5) |
| change-delivery: An unnumbered ADR is numbered at the delivery | covered |
| change-delivery: A citation lives in every text file but tests and fixtures | covered (CITATION_PATHSPEC and holdsCitations match the requirement's exclusions) |
| change-delivery: The file form of a citation is rewritten only where it names an ADR folder's file | covered (adrFileRe) |
| change-delivery: The numbering refuses a slug taken and a citation not landed | covered |
| change-delivery: A consumer project's release file follows the note | covered |
| change-delivery: A release bump on a pack's own manifest is stated under packs | covered |
| change-delivery: The repository check refuses an unnumbered ADR on the base | covered (check.py check_adrs) |
| change-delivery: The repository check refuses an unlisted unnumbered ADR and a slug held twice | covered |
| change-delivery (MODIFIED): An ADR number taken on the default branch is renumbered without the owner | covered |
| change-delivery (MODIFIED): A plain commit on the branch keeps its rule | covered; contradicted for a forced merge by canonical 'The open items of a forced merge are named' (F9) |
| change-coordination: The release assignment is a session step of the delivery | covered |
| change-coordination: The conductor numbers a noted change only through the release step | covered |
| change-coordination: The planner does not stop without the release note | covered |
| change-coordination: A decision record listed without a number is found after its numbering | covered |
| change-coordination (MODIFIED): From the implementation on, the step inside the stage goes to its role | covered (canonical text and scenarios carried verbatim, three conflict scenarios scoped) |
| change-coordination (MODIFIED): A requirement a merged change contradicts reopens the grill | covered |
| change-coordination (MODIFIED): The loop fetches the base branch before it judges a delivery step | covered (verbatim against the canonical text at the merged base) |
| change-stages (MODIFIED): A plan stage is stale after a plan file changes, until the work starts | covered (flow-check noteFilesOf; conduct-check newestNote) |
| delivery-train: A join numbers the release a boarded change's note states | covered |
| delivery-train (MODIFIED): Release numbers follow the boarding order on the train only | covered |
| reviews-check (MODIFIED): The train's own commits change only releases, the roadmap and its record | covered |
| release-tags (AC-13, unchanged) | covered |

### Re-review scope
I checked the seven findings of round 1 and the lines changed since 4a6e858 on the change's first-parent line (d66e560 to c1c875e). The trains 15 to 17 merged in a47cec8 were read only where they meet this change's deltas. Every MODIFIED block was diffed against the canonical requirement at HEAD. Each block keeps the canonical text and scenarios word for word, with only this change's sentences and scenarios added or scoped. No scope creep was found.

### The deviations and open items in evidence.md
- Deviation 'stepRecord reads each key from the newest step commit that wrote it' (46c3c2e): F8. The behaviour fixes defect 7 and fits AC-4, but it differs from the ADDED requirement's text and from accepted ADR 0032 decision 3. So it is reported for the owner, not approved silently.
- Exports maskCitations and noteMoved: internal names, no spec effect. No finding.
- --assign also prints its exit-2 error on stderr: consistent with the scenario 'A line the step wrote, edited after its record', which names stderr. No finding.
- M2 fetch guard built with deliveredChange rather than staleMergeFixture: a test construction choice. The scenario 'A base that moved on the remote, for a change with a release note' is proven. No finding.
- Merge a47cec8 resolving openspec/config.yaml and plugins/openspec/skills/devkit/SKILL.md beyond task 9.1's two expected hunks: config.yaml is under openspec/. The SKILL.md hunk keeps both sides: the base's added forced-merge retro sentence sits after this change's assign-release sentence, and the diff against the first parent shows only that addition. Task 9.1's stop-for-the-owner rule was not applied, but the merge message records that the coordinating session announced the conflict. No spec effect, so no finding; the owner may want to confirm it.
- Open item 'forced owner merge of a noted change': F9. The spec conflict came in with the base merge, so the owner decides.
- Open item 'ship-change app host sentence': F10.
- Open item of attempt 1 (readiness not re-run): closed by the change-stages MODIFIED block and D-21 (F3).

### Spot checks against the code
- CITATION_PATHSPEC (deliver-check.mjs:35) and holdsCitations (:36-41) exclude openspec/changes, *.test.*, *-fixtures.* and test/ and tests/ folders, as the ADDED requirement says. git grep runs with -I in citedAt and numberRelease.
- approvalState(dir, { release } = {}) defaults to namesReleaseTag(changeRoot(dir)), and changeRoot returns null outside the openspec/changes or archive layout (scenario 'A folder outside a project's layout').
- flow-check.mjs noteFilesOf counts release.md only when namesReleaseTag(root) holds, and only in the tasks entry of the staleAfter loop (:559). The started and postMerge guard is unchanged. conduct-check.mjs compares newestNote only in readiness.fresh.
- parseReleaseNote refuses a `## ` body line outside a fence (deliver-check.mjs:1997).
- Test run (foreground, no other suite running): TMPDIR=/var/tmp/devkit-release-at-merge node scripts/test-suite.mjs --concurrency=3 plugins/openspec/hooks/release-note.test.mjs plugins/openspec/hooks/flow-check.test.mjs printed 'suite: 2 files, 251 tests, 251 pass, 0 fail, 52.6s, concurrency 3'.

### Summary
- 10 findings: 7 from round 1, all fixed (4 important, 3 nit), and 3 new open ones (F8 important: spec and ADR text versus the per-key record; F9 important: spec conflict with the canonical forced-merge requirement, escalated; F10 nit: ship-change app host sentence). 0 blocking, 0 scope creep, 0 gaps.
