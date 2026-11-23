Verdict: approved
Commit: f7c5945b8bd8763a51040c609968fe937a9633c4

## Spec review — roadmap-sessions-upfront

### Findings
- [important] plugins/openspec/skills/devkit-session/SKILL.md:28; spec roadmap-coordination, requirement "A change's plan waits for its dependencies and starts from the code of that day", scenario "The merge confl… — The session skill did not declare the end blocked after a merge-base exit 3, so no devkit-end blocked line was recorded and the next session-next handed merge-base again. · fixed in 6fab305
- [important] plugins/openspec/hooks/roadmap-loop.mjs sessionNext/sessionNextCmd (budget: true); proposal What Changes; tasks 6.1; baseline change-coordination "A run can carry a token budget" — The token budget counted in a change session's session-next has no requirement in any delta spec; the baseline ambiguity was resolved silently. · refuted: openspec/specs/change-coordination/spec.md:696-698 already requires the stop at the cap in place of a hand-off or session step and exempts only the coordinator's own reads (734-736); roadmap-loop.mjs restores it with budget: true; proposal.md and design.md state it openly (Since the merge a9ecdc1 note); CHANGELOG records it
- [nit] plugins/openspec/hooks/roadmap-loop.mjs checkCmd; spec roadmap-coordination "A roadmap run keeps one periodic check while it lasts" — The idle line, the stopped-waits line and the archive-later retry line were design-only behaviours with no spec scenario. · fixed in 6fab305
- [nit] CHANGELOG.md, devkit-openspec entry of this change — The entry listed schedule-check and delete-check as new subcommands, but they are decision actions, and check was missing. · fixed in 6fab305

## Spec review — roadmap-sessions-upfront

In-scope specs: openspec/changes/roadmap-sessions-upfront/specs/{roadmap-coordination,coordination-locks,change-coordination,change-delivery}/spec.md; baselines openspec/specs/roadmap-coordination/spec.md and openspec/specs/change-coordination/spec.md (token budget requirements).

### Coverage
| Requirement | Status |
|-------------|--------|
| roadmap-coordination: session per change, places, board | covered (new scenario "A change that leaves the roadmap", test roadmap-loop.test.mjs:4340) |
| roadmap-coordination: A change's plan waits for its dependencies and starts from the code of that day | covered ("The merge conflicts": the skill now declares the end blocked, test :4490) |
| roadmap-coordination: the grill and plan pushed | covered (new scenarios "Tasks ticked after the plan was pushed", "A plan approved again"; test :4216) |
| roadmap-coordination: A roadmap run keeps one periodic check while it lasts | covered (new scenarios: wait loops stopped, recorded wait loop no longer one, place given to a session not watching, archive not done yet, triage heading that is no section; tests :3762, :3785, :3865, :4263, :4283, :4361) |
| roadmap-coordination: cleanup at the end of the run | covered ("A process that took a wait loop's number", test :4300) |
| roadmap-coordination: the board shows what each change session waits for | covered |
| coordination-locks: ticket entry, "A session is in a run of a change" | covered (new scenarios: a started task after a note of the host, words before the started form) |
| change-coordination: triage first, triage source, grill reopened, a lone change schedules nothing | covered |
| change-delivery: an ADR number taken is renumbered | covered |

### Notes
- Scope of this round: the lines changed since 123a7ba (6fab305 review fixes, the merge of origin/main, the ADR renumbering to 0020 in 877026a, the evidence in f7c5945); what main brought in was not judged.
- ADR 0020 is accepted and records the owner's approval; the release is devkit-openspec 0.31.0 / marketplace 0.35.0 and CHANGELOG.md matches.
- No two specs conflict, no ADR is contradicted, nothing needs REQUIRES NEW SPEC CHANGE.
- Test files were read by test name and the tests for the new scenarios; the suite was not re-run.

### Summary
- 4 previous findings: 3 fixed in 6fab305, 1 refuted. No new findings. 0 scope creep, 0 gaps.
