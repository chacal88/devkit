Verdict: approved
Commit: af4055acf094de5228be025d780f5d611905f06c

## ADR review — release-rebase-pin

ADRs reviewed: ADR 0001 (`docs/adr/0001-coordination-without-a-harness.md`), ADR 0002 (`docs/adr/0002-merge-without-the-owner-opt-in.md`), ADR 0003 (`docs/adr/0003-auto-merge-the-archive-pr.md`). ADRs 0004-0007 skimmed; not touched by the change (0005 superseded by 0006; 0007 only amends conduct-on-request). No open-decisions log found.

### Re-review (round 1, range 66b6041..HEAD)
Only change outside `openspec/`: one new test in `plugins/openspec/hooks/release-rebase.test.mjs` (two change commits touching the pin file). No hook, doc, or ADR-governed file changed; ADRs 0001-0003 conformance is unchanged. No new findings.

### Findings
- [nit] (previous, no action needed) `plugins/openspec/hooks/conduct-check.mjs:4-5`, `plugins/openspec/hooks/release-rebase.mjs` (`mergePins`) — ADR 0001 § Decision (no state outside the repository and GitHub)
  - What is wrong: conduct-check now creates and removes a temp folder under the OS tmpdir to run `git merge-file`. It is transient, removed in `finally`, and carries no state between runs, so it does not break the ADR. The header comment already says it.
  - Fix: none needed; keep the header comment.

ADR 0003 check (the focus):
- `git diff origin/main..HEAD --stat` shows `plugins/openspec/hooks/deliver-check.mjs` is not in the diff. `RELEASE_FILE` (`deliver-check.mjs:755`) and `unnamedFiles` (`:759`) are byte-identical to main, so the archive PR exemption list is unchanged.
- `docs/openspec-flow.md` is not added to the release list. The pin rule is a separate predicate (`PIN_FILE`, `classifyConflict` in `release-rebase.mjs`) used only for conflict classification in `conduct-check.mjs` and `release-rebase.mjs`.
- `deliver-check.test.mjs` adds a test that pins `RELEASE_FILE.source` and the `unnamedFiles` behaviour for `docs/openspec-flow.md`.
- The docs (`docs/openspec-flow.md`, release-rebase bullets) say "the same list ADR 0003 exempts" and state that the list does not change. This matches.

ADR 0001: `release-rebase.mjs` still never commits or pushes. The edits stay uncommitted and the recompute gives `push-rebased`. `conduct-check` still reads and never fetches or writes the repository. No harness, daemon or gate change.

ADR 0002: reviews go stale after the rebase, which the ADR accepts ("Strict up-to-date re-runs stale reviews"). The CI snippet is still pinned to a release tag's commit (`<commit sha of v0.11.0>` placeholder, resolved at setup), not to a movable tag. Only the version number moves, and the doc still says to bump it on purpose.

### Summary
- 1 finding (0 blocking, 0 important, 1 nit)
