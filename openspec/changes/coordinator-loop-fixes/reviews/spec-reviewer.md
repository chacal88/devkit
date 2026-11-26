Verdict: approved
Commit: 9c4fffed5a46c751787fcf1e08e410bcac3c70e4

## Spec review — coordinator-loop-fixes (round 3)

### Findings
- [nit] openspec/changes/coordinator-loop-fixes/specs/change-stages/spec.md:8 (Requirement "A plan revised after the work started goes back to its gates") — The requirement put "every file under `specs/`" in the plan digest while design D-7 and `specFiles` count only `.md` files; make the delta's wording match the design. · fixed in cccd21b
- [important] openspec/changes/coordinator-loop-fixes/specs/change-coordination/spec.md:317-330 (Requirement "The owner authorizes one more review round after the limit") — The round-1 fixes rewrote a SHALL and scenarios of the change-coordination and file-writers deltas, and design D-1/D-4, after the owner's last approval, with no new readiness review or approval. · fixed in ab2e0e8
- [praise] openspec/changes/coordinator-loop-fixes/proof/ver-r7s-declared.json; plugins/openspec/hooks/change-loop-declared.test.mjs T143-T145 — The scenario "The owner's words are recorded as typed" is proven at every layer (unit T143, spawned bash T144, refusals T145, real nested session ver-r7s), and its revised THEN (first 200 characters) matches `runDeclare`'s `words.slice(0, 200)`.

Re-review scope: the previous findings and the range 9eaef84..9c4fffe. The change's own commits in this range are 0b71037, f29093d, cccd21b, 81d5bcd, ab2e0e8, 0107079 and 9c4fffe, plus the merge f72e442. The merge brings origin/main 494daa5 (project-setup: the kit moves to `plugins/compozy/kit/` and the setup scripts to `plugins/openspec/skills/devkit/scripts/`). That content belongs to another change. Its combined diff was read only where it touches this change's surfaces: the release renumbering (openspec 0.49.0, compozy 0.6.0, marketplace 0.54.0, the CI pin v0.49.0), `guard.mjs` `parseDevkitBlock` (main's `split(/\r?\n/)` with this change's keyed `opening` regex, so D-22's `x-devkit:` reading is kept), the ADR list in `openspec/config.yaml` (0031, 0032, 0033) and the CHANGELOG entry. The merge resolution adds no behaviour that this change's deltas do not state.

In-scope specs: openspec/changes/coordinator-loop-fixes/specs/{change-coordination,change-delivery,change-stages,coordination-locks,delivery-models,file-writers,project-setup,review-round,stage-models}/spec.md, checked against their baselines in openspec/specs/<capability>/spec.md. The deltas of the merged-but-not-archived project-setup change (openspec/changes/project-setup/specs/{project-setup,change-coordination,compozy-kit-setup}) were checked for overlap. Decisions read again: ADR 0032 (decision 7 and the dated Note's third narrowing, under which an approval with no `- Plan:` line never goes stale).

### Previous findings
- F1 (nit): cccd21b rewrites the requirement to "every `.md` file under `specs/`", which matches design D-7 and `planDigest`/`specFiles` in deliver-check.mjs.
- F2 (important): the revised plan (cccd21b, which also writes task 6.4d, the D-1 forms left unmatched, the D-12 quoted edits and the 200-character THEN) passed readiness attempt 14 (81d5bcd). The owner then approved it in their own words ("Aprovo", ab2e0e8; approval attempt 6, the readiness hash sha256:6d0ec15a761b). The third review round is recorded from the owner's words in `declared.json` ("Sim, libera", round 3).
- F3 (praise): still holds.

### Coverage
| Requirement | Status |
|-------------|--------|
| change-coordination: From the implementation on, the step inside the stage goes to its role (MODIFIED) | covered |
| change-coordination: The session waits on GitHub with no time limit (MODIFIED) | covered (the wake half stays deferred to host-monitor-wake, AC-11) |
| change-coordination: A change archived on the default branch is not unfinished (MODIFIED) | covered |
| change-coordination: A run can carry a token budget (MODIFIED) | covered |
| change-coordination: The budget stop says how to go on (MODIFIED) | covered |
| change-coordination: A merge-defect fix follows the rule of every plan edit (MODIFIED) | covered (T133, T134 and post-merge-validate 2 re-run green in this round) |
| change-coordination: The session declares a pause or a decision outside the gates (ADDED) | covered |
| change-coordination: A red gate gets one declared fix before the run stops (ADDED) | covered |
| change-coordination: The owner authorizes one more review round after the limit (ADDED) | covered (`--stdin words`, the 200-character cap in `runDeclare`, T44, T143 to T145, ver-r7s) |
| change-coordination: A conflict outside the release files goes to the implementer (ADDED) | covered |
| change-delivery: A task marked for the conducting session is not the implementer's (ADDED) | covered |
| change-delivery: The review round limit is two plus the rounds the owner authorized (ADDED) | covered |
| change-delivery: A change's own pull request (MODIFIED) | covered |
| change-stages: A plan revised after the work started goes back to its gates (ADDED) | covered (wording now matches D-7, F1 fixed) |
| change-stages: Attempt ceilings and no progress stop the run (MODIFIED) | covered |
| change-stages: After a merge the walk resumes at the retro (MODIFIED) | covered |
| coordination-locks: A run is known from the session's own record (MODIFIED) | covered |
| delivery-models: A resolution review deadlock goes to the owner (MODIFIED) | covered |
| file-writers: The verifier writes its evidence and its proof folder (ADDED) | covered |
| file-writers: The record of declared steps is the main session's (ADDED) | covered (the matched form is stated in the SHALL; D-1 names the two forms left unmatched as a follow-up) |
| project-setup: The GitHub plan names what the repository refuses (MODIFIED) | covered (`github-setup.mjs` now at plugins/openspec/skills/devkit/scripts/; the delta names the script by file name, so the move changes nothing) |
| review-round: A round beyond the second runs within the authorized limit (ADDED) | covered |
| stage-models: A project and a change can set a stage's model (MODIFIED) | covered |

Scope creep: none. cccd21b states in the plan what the round-1 commits already did (task 6.4d, written ticked). It adds no behaviour: the D-1 paragraph on the unmatched forms records a limit, the D-12 quotes copy text already committed in 3ec3322 and 5dc0830, and D-20's third reader (`findByCommits`) was already task 6.4a.

Plan edit after the approval, noted and not a finding: 0107079 edits `design.md`, `proposal.md` and `tasks.md` after the owner's approval (ab2e0e8), as a merge-defect fix. It changes only paths: the moved kit and setup scripts. Every path it now names exists at HEAD, and no spec delta changed. The approval records no `- Plan:` line, so ADR 0032 decision 7 as narrowed by its Note (the third narrowing) and the change's own requirement "A merge-defect fix follows the rule of every plan edit" ask for no new readiness or approval. The owner may still want to know that the approved plan's text moved after the approval.

No two specs disagree. project-setup's deltas modify no requirement this change modifies (the two change-coordination deltas touch different requirements). No spec delta or plan file of this change names either removed setup skill, which project-setup's requirement "The removed setup skills are named nowhere" asks for. That requirement exempts change folders anyway.

Test run (one scoped run, foreground, concurrency 3): T133 (flow-check.test.mjs), T134 (change-loop-declared.test.mjs) and `post-merge-validate 2: a plan edit made as a merge-defect fix leaves the plan gate where an ordinary design edit does` (change-loop.test.mjs): 3 tests, 3 pass, 0 fail, 11.7 s. `openspec validate coordinator-loop-fixes --strict`: valid.

### Summary
- 3 findings (0 scope creep, 0 gaps): F1 (nit) fixed in cccd21b, F2 (important) fixed in ab2e0e8, F3 praise.
- No blocking or important finding is open.
