Verdict: approved
Commit: 3b427c89ef2a7c0016422616b23bdf385727e273

## Spec review: loop-place-and-evidence (re-review after the merge of main, round 1 of 2)

### Findings
- [important] openspec/changes/loop-place-and-evidence/evidence.md (AC-5 row); spec delta scenario "The round after the step records clean commits" — Previous finding: AC-5 rested on the fixture only and the Real-run proof table (S, V0 to V4) was missing; the table and the real rounds' clean Commit lines are in evidence.md. · fixed in 96ea09921ecd863be523e40ec403b87596c25406
- [nit] plugins/openspec/hooks/deliver-check.mjs:1875; spec delta requirement "The change folder is committed before a review round" — Still open: the requirement says the commit reason SHALL name the folder's paths, but the code lists at most three (slice(0, 3)); the spec does not state the cap. Extend the requirement or list every path.
- [nit] openspec/changes/loop-place-and-evidence/evidence.md, Real-run proof section (V1 to V4) — Still open: the V records hold each call's answer but not the clone's sha or the restore commands that design D-5 prescribes; evidence.md says so and did not re-check. Record-detail gap only.

### Coverage

Every requirement and scenario of the delta is covered, with the tests `loop-evidence 1` to `17`; AC-1 to AC-7 pass. AC-7 holds: `change-loop.test.mjs` gains only the 10-line `loop-evidence 15`, and `change-loop.mjs`, `roadmap-loop.mjs` and the other place-wait files show no diff.

### What I checked

- The own diff against main in `deliver-check.mjs` is two additions. `collectState` reads `folderDirty` through `changedUnder` with the pathspec `openspec/changes/<id>`, a directory match, so `foox` does not match `foo`. `nextStep` returns `commit` with `paths: []` only inside `if (toReview.length)`, after the product `commit`, `fix-review`, `fix-defect` and `verify`, and before `review`. The `?.` guard keeps states without `folderDirty` unchanged.
- Main's new code does not interact badly with the change. The ADR 0025 own-files rule exempts the release files and counts the change folder as own, and the checker answers `review` for the four stale reviewers, round 1, with the folder clean. The version-pin test reads `plugin.json` (0.41.0) and the pin is `v0.41.0`; `archive-release-pin 12` passes. Release files agree: plugin 0.41.0, marketplace 0.46.0, CHANGELOG `## 0.46.0`, the flow doc pin `v0.41.0` in three places.
- Filtered tests in the foreground with TMPDIR=/var/tmp/devkit-loop-place-and-evidence: deliver-check-archive 16 of 16, deliver-check-cli 4 of 4, change-loop 1 of 1, deliver-check 1 of 1. The whole suite was not run, as instructed. `git status --porcelain` is empty.
- The commit since my last review (3b427c8) rewrites only `evidence.md` (attempt 4, for 53f0fe4). It says that the real-run records are from 80ae287 and that the whole suite is the train's to prove.

### Summary

- 0 blocking and 0 important open. F1 is fixed in 96ea099. Two nits stay open (F2, F3), and neither blocks. No scope creep and no gap.
