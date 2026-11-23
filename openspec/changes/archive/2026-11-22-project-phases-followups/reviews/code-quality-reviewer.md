Verdict: approved
Commit: 827f66034b77129a1243860bc6016edc2f2f2e71

## Quality review — project-phases-followups (round 1)

### Findings
- [praise] plugins/openspec/hooks/guard.mjs:237 — The uncommitted-marker check runs before the resolve check, so a marked verdict gets one precise problem line. Test followups 6 asserts that no 'does not resolve' line appears alongside it.
- [praise] plugins/openspec/hooks/project-loop.test.mjs:1403 — followups 8 covers the HEAD commit and a non-resolving sha, both languages, and asserts that nothing is recorded. followups 9 covers active and archived slices.
- [nit] plugins/openspec/hooks/project-loop.mjs:71 — usable now excludes uncommitted, and recordReviewCommand also checks v.uncommitted explicitly. The two overlap and could drift. A one-line comment saying the explicit check supplies the 'uncommitted' reason would help.

### Summary
- 3 findings (0 blocking, 0 important, 1 nit) + 2 praise
- Justification: The diff matches the proposal's scope. Production changes are small and consistent: guard.mjs refuses an uncommitted ADR verdict, project-loop.mjs sends it back to the reviewer and refuses to record it, and change-loop.mjs adds the `why.uncommitted` message in both languages. Everything else is tests, docs, version bumps and the pin move to v0.21.2.
- Every declared variant has a test: commit does not resolve, header missing, header malformed, no base ref (direct call and the PR hook), uncommitted verdict (CI, hook, record-review, next) and a merge that brings an ADR.
- The ADR renumbering note (0014 to 0015) is added to the three archived files as a note only, with the approved text left unchanged. README's reference now says 0015, which matches `docs/adr/0015-*`.
- The dogfood item is split into its own roadmap line with the correct dependency.
- Acceptance proof: the focused `followups` run passed 10 of 10 here. `evidence.md` ties the other gates to named logs and exact commands. I did not rerun the whole guard suite, as instructed; for it I relied on the evidence's log `/var/tmp/ppf-gate2.log` (1397 of 1397 passing).
- Re-emitted at 827f660: the only change since a8b07da is the evidence.md commit (45 added lines), and git status is empty. The findings are unchanged.
