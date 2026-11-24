Verdict: rejected
Commit: 5edea6bd2080c7e55bca299fb82202d2d25484cf

## Spec review — roadmap-sessions-upfront

### Findings
- [important] plugins/openspec/skills/devkit-session/SKILL.md:28; spec roadmap-coordination, requirement "A change's plan waits for its dependencies and starts from the code of that day", scenario "The merge confl… — The session skill did not declare the end blocked after a merge-base exit 3, so no devkit-end blocked line was recorded and the next session-next handed merge-base again (previous finding). · fixed in 6fab305
- [important] plugins/openspec/hooks/roadmap-loop.mjs sessionNext/sessionNextCmd (budget: true); proposal What Changes; tasks 6.1; baseline change-coordination "A run can carry a token budget" — The token budget counted in a change session's session-next has no requirement in any delta spec; the baseline ambiguity was resolved silently (previous finding). · refuted: openspec/specs/change-coordination/spec.md:696-698 already requires the stop at the cap in place of a hand-off or session step and exempts only the coordinator's own reads (734-736); roadmap-loop.mjs restores it with budget: true; proposal.md and design.md state it openly (Since the merge a9ecdc1 note); CHANGELOG records it
- [nit] plugins/openspec/hooks/roadmap-loop.mjs checkCmd; spec roadmap-coordination "A roadmap run keeps one periodic check while it lasts" — The idle line, the stopped-waits line and the archive-later retry line were design-only behaviours with no spec scenario (previous finding). · fixed in 6fab305
- [nit] CHANGELOG.md, devkit-openspec entry of this change — The entry listed schedule-check and delete-check as new subcommands, but they are decision actions, and check was missing (previous finding). · fixed in 6fab305
- [important] openspec/changes/roadmap-sessions-upfront/specs/roadmap-coordination/spec.md:24-29 (A place is held only by a change that loads the machine) against openspec/specs/roadmap-coordination/spec.md:684-68… — After the merge of remote-worker, the added requirement still says "At most the run's number SHALL hold a place at once" with no clause for the machines setting, while main's requirement counts places per machine (this machine's is the run's number, another's is its entry); the code (roadmap-loop.mjs:346-349) counts per machine, so the literal reading of the added text differs from the shipped behaviour and the merge resolved it silently. Qualify the added requirement (as the modified "Every open change of the roadmap fills a place" already does) or say which reading holds.

In-scope specs: openspec/changes/roadmap-sessions-upfront/specs/{roadmap-coordination,coordination-locks,change-coordination,change-delivery}/spec.md; baselines openspec/specs/roadmap-coordination/spec.md (including the remote-worker requirements main brought in), openspec/specs/change-coordination/spec.md (token budget).

### Coverage
| Requirement | Status |
|-------------|--------|
| change-coordination: Every grill asks the triage agent first (now "whose flow lists the triage") | covered (tests `upfront AC-5 triage: the grill of a change on flow 1 names no triage helper and that of a change on flow 2 names it`, `upfront AC-5 skill`) |
| change-coordination: The triage ships as flow version 2 (four scenarios: opened on flow 2, project slice, flow 1 keeps its grill, moved to flow 2) | covered (tests `upfront AC-5 open`, `upfront AC-5 flow` x3, `upfront AC-5 triage`; flows/2.json adds only `requirements-triage` to the requirements helpers in both copies; flows/1.json unchanged, digests in released-flows.json; check.py passes) |
| change-coordination: A triage answer always names its source; a contradicted requirement reopens the grill; a lone change schedules nothing | covered (unchanged since the previous round; the `helpers` field is also carried by the unsourced-answer grill action) |
| coordination-locks: coordinating session hands only a helper of the grill of the flow the change follows; "The triage for a change on an older flow" | covered (`upfront AC-4 lock agent: ... change on flow 1 is refused own-sessions`; `isRequirementsHelper` reads the change's pinned flow, the installed flow when the change has no folder, so "not open" is still reported) |
| roadmap-coordination: A firing of the check acts and reports only what changed; "A grill on an older flow" | covered (`upfront AC-14 check: a grill of a change on flow 1 gives no triage action, and one on flow 2 does`; checkCmd filters on `action.helpers`) |
| roadmap-coordination: Every open change of the roadmap fills a place; Starts are held while the machine is loaded; the board and title requirements; Calling the command again resumes from the files (the combined text with remote-worker) | covered, except the ambiguity of F5 (tests `upfront merge run file`, `upfront merge placement`, `upfront merge ticket`, `upfront merge check`, plus main's remote tests; the combined scenarios agree with main's baseline wording) |
| roadmap-coordination: A place is held only by a change that loads the machine | partial (see F5) |
| roadmap-coordination: session per change, plan after dependencies, grill and plan pushed, periodic check, end cleanup, board waits | covered (unchanged and already reviewed) |
| change-delivery: an ADR number taken is renumbered | covered (ADR is now 0021 after main took 0020) |

### Notes
- Scope of this round: the change's own work since f7c5945: phase 8 (7eb62be, flow version 2 per design D-17), the second merge of origin/main (5cc1c69: remote-worker), and the evidence commits. What main brought in was not judged; only how run-file.mjs (`occupied` kept apart from remote-worker's `placed`, both read by `readRun` and both in OUTLIVES), the placement, the persist block of `decide` (ticket skipped for a change opened on another machine, records pruned by `openLines`), the board and the titles combine with it.
- The narrowing of AC-5 and AC-14 to a change on flow 2 or later is recorded openly (proposal.md, design D-17, approval.md attempt 4 with the owner's words); `requirements.md`, the owner's record, keeps its words, as the proposal says. Not scope creep and not a silent resolution.
- Release numbers match everywhere I looked: devkit-openspec 0.33.0, devkit-core 0.14.0, marketplace 0.37.0, ADR 0021, CHANGELOG 0.37.0 and docs/openspec-flow.md ("from devkit-openspec 0.33.0 on"). `openspec validate --strict` and `scripts/check.py` pass.
- No two specs conflict apart from the literal wording in F5; no ADR is contradicted (ADR 0021 Note names flow 1); nothing needs REQUIRES NEW SPEC CHANGE.
- Tests were read by name and for the new scenarios; I did not re-run the suite (it ran once on 5cc1c69: 2356 tests, 0 fail).

### Summary
- 5 findings: the 4 previous ones (3 fixed in 6fab305, 1 refuted) and 1 new important (F5, a spec ambiguity from the merge). 0 scope creep, 0 gaps, 0 blocking.
