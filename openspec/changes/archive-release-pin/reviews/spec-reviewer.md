Verdict: approved
Commit: e0c946ad9e3e83cbaa94f41ee4da75a5bbba172f

## Spec review — archive-release-pin (round 3, re-review after the base merges and the 0.40.0 / 0.44.0 renumber)

### Findings
- [important] openspec/changes/archive-release-pin/specs/reviews-check/spec.md:81 (A pin-only archive pull request on CI) — The --ci scenario named change-loop.test.mjs while requirements 2 and 3 and PIN_LINE_FILES name change-loop-compozy.test.mjs; the spec now names change-loop-compozy.test.mjs throughout (still so at this head). · fixed in 211c1eb8713d82358ed76faffd577b2c9d037601
- [nit] openspec/changes/archive-release-pin/requirements.md (AC-3, AC-4, AC-10) and proposal.md (What Changes, AC-3, AC-4) — Stage documents still name change-loop.test.mjs (and older release numbers), while spec and code use change-loop-compozy.test.mjs and 0.40.0/0.44.0; ADR 0027 and decisions.md record the rename.
- [nit] openspec/roadmap.md:73 and :94 — Both roadmap lines (archive-release-pin, release-pin-is-a-release-file) are still unticked; requirements say to tick them at archive, so this is expected here.

In-scope specs: openspec/changes/archive-release-pin/specs/reviews-check/spec.md (delta, 4 ADDED requirements), openspec/specs/reviews-check/spec.md (baseline), docs/adr/0003-auto-merge-the-archive-pr.md, docs/adr/0027-the-archive-check-lets-the-release-pin-lines-pass-unnamed.md, openspec/changes/archive-release-pin/requirements.md (AC-1 to AC-10).

### Coverage
| Requirement | Status |
|-------------|--------|
| The archive file check passes a CI pin move in the flow page unnamed | covered |
| The archive file check passes the pin assertions of the loop's test unnamed | covered |
| A pin file the check cannot compare stays unnamed | covered |
| The local archive stop and the reviews check apply one pin-line rule | covered |

### Re-review notes
- The spec delta is unchanged since the previous Commit (c63ad63); only evidence.md and review files changed in the change's folder. The pin code of deliver-check.mjs (PIN_MARKER, PIN_TOKEN, pinsIn, setPins, PIN_LINE_FILES, pinLinesOnly, unnamedFiles, archiveChanges) is untouched by the base merges; the main-side hunks are in gitFacts, staleness, ownFiles, readReviews, tasksItem, acceptanceItem, collectState, judgeBoarded and runCi.
- Release numbers are consistent: devkit-openspec 0.40.0 and marketplace 0.44.0; docs/openspec-flow.md pins v0.40.0 (lines 733, 734, 745, 747); the pin test in change-loop-compozy.test.mjs asserts v0.40.0 and refuses v0.39.0, v0.38.0 and v0.37.0.
- The baseline openspec/specs/reviews-check/spec.md gained only the five train requirements from delivery-train; none touches the archive file check or the pin files, so no two specs disagree. ADR numbers do not collide (0025 is stale-only-on-own-files, 0027 is this change). ADR 0003 still carries the archive-release-pin note.
- The own-files rule from main excludes only RELEASE_FILE paths, and the pin files are not release files, which agrees with requirement 4 (neither file counts as a release file).
- Filtered run in the foreground with TMPDIR=/var/tmp/devkit-archive-release-pin, GITHUB_HEAD_REF=probe-branch, GITHUB_BASE_REF=main, pattern archive-release-pin over deliver-check-archive.test.mjs, deliver-check-cli.test.mjs and release-merge.test.mjs: 12 tests, 12 pass, 0 fail (covers tests 1 to 11, including --ci from only the three downloaded files and the shared pin definition). The whole suite was not run, as instructed.

### Summary
- 3 findings (0 blocking, 0 important open, 2 nit open). 0 scope creep, 0 gaps.
