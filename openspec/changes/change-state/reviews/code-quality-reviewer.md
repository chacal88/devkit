Verdict: approved
Commit: c8a9f5cdd08fb476adf59effe66147de5704349f

## Quality review — change-state (round 1, re-review after two main merges)

### Findings
- [praise] plugins/openspec/hooks/change-loop.mjs:621 — changeState is one pure derivation shared by nextAction and stateEntries, with S1-S8 first-match rows; the moved run-file helpers are re-exported, not duplicated.
- [praise] plugins/openspec/hooks/change-loop.mjs:675 — One githubSilent predicate feeds decide, whereOf and waitLoop's isUnreadable, and the 3-failures-then-blocked guarantee is kept.
- [nit] openspec/changes/change-state/evidence.md (AC-4, AC-5) — AC-4, AC-5 and the hourglass, stop and archive title forms have test proof only; a real-output demonstration with a stubbed gh and a temp run file would close it. The evidence states why not.
- [nit] plugins/openspec/hooks/change-loop.mjs:1499 — waitLoop quotes action.detail?.error ?? '' when error is null, so an empty string yields 'GitHub cannot be read ()'; add a fallback phrase.
- [praise] plugins/openspec/hooks/change-loop.test.mjs — Every t.test subtest of the change's tests is now awaited, and no un-awaited t.test remains in plugins/openspec/hooks; this fixes the CI Node cancellation.

### Summary
- 5 findings (0 blocking, 0 important, 2 nit) + 3 praise
- Justification: re-review of the range 8120c98..c8a9f5c. The diff of change-loop.mjs and roadmap-loop.mjs against 8120c98 is empty, so the production behaviour I approved is unchanged. The range holds main's stage-roles archive and the #62 shared tmp helper (main's own commits, out of scope) plus this change's awaiting of subtests in change-loop.test.mjs. I grepped the hook tests for un-awaited t.test and found none; the file passes node --check. The coordinator's whole-suite result at fe37b56 (1676 of 1676 pass, CI check passed) was relied on, not re-run; HEAD differs from fe37b56 only in evidence.md. The known exit 3 of 'state' without --change on a stale local main is pre-existing on main and not a regression of this change. Only nits remain.
