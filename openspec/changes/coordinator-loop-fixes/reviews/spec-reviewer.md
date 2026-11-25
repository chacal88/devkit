Verdict: rejected
Commit: 9eaef847377372376ef25eb7a8f400d0e3ccf619

## Spec review — coordinator-loop-fixes (round 2)

### Findings
- [nit] openspec/changes/coordinator-loop-fixes/specs/change-stages/spec.md:8 (Requirement "A plan revised after the work started goes back to its gates"); plugins/openspec/hooks/deliver-check.mjs:2019 (spec… — The requirement puts "every file under `specs/`" in the plan digest, but design D-7 and `specFiles` count only `.md` files; still unchanged at this head, so make the delta's wording match the design (or the reverse).
- [important] openspec/changes/coordinator-loop-fixes/specs/change-coordination/spec.md:317-330 (Requirement "The owner authorizes one more review round after the limit", new scenario "The owner's words are record… — The round-1 fixes (59b8350, 66f3553) rewrote a SHALL of the change-coordination delta (`--param words` to `--stdin words`), added a scenario, widened a file-writers scenario and edited design D-1/D-4 after the owner's last approval (84da214), with no new readiness review or approval; the ship-change fix-review row, the change's own requirement "A plan revised after the work started goes back to its gates" and ADR 0032 decision 7 ask for both, and only the missing `- Plan:` line lets the tool miss it. The owner decides whether these deltas join the approved plan.
- [praise] openspec/changes/coordinator-loop-fixes/proof/ver-r7s-declared.json; plugins/openspec/hooks/change-loop-declared.test.mjs T143-T145 — The new scenario "The owner's words are recorded as typed" is proven at every layer: unit (T143), a spawned bash with the quoted heredoc (T144), the refusals (T145), and a real nested session (ver-r7s) whose recorded words hold a backtick, $(...), an apostrophe and double quotes byte for byte with no touched file.

Re-review scope: the previous findings and the range 73e159c..9eaef84. The change's own commits are 59b8350, f1acdfd, 66f3553, 3ec3322, 5dc0830 and 9eaef84. The merge f416d6a brings origin/main (archive of suite-socket-path, openspec/trains/18.md, two CONTRIBUTING.md paragraphs). That content belongs to another change and is outside this review's scope; its CONTRIBUTING.md diff was read and touches no in-scope spec.

In-scope specs: openspec/changes/coordinator-loop-fixes/specs/{change-coordination,change-delivery,change-stages,coordination-locks,delivery-models,file-writers,project-setup,review-round,stage-models}/spec.md, against their baselines in openspec/specs/<capability>/spec.md. In this range only change-coordination and file-writers changed. Decisions read again: ADR 0032 (new dated Note, decisions 1 to 8 unchanged, pinned by T147) and ADR 0023 (header now names ADR 0033 as amending it, T148).

### Previous findings
- [nit] F1 (digest reach under specs/): still open, untouched in this range.
- [praise] Round 1's praise (every ADDED and MODIFIED scenario has a named test) still holds. The new scenarios are tested by T99 and T143 to T148.

### Coverage
| Requirement | Status |
|-------------|--------|
| change-coordination: From the implementation on, the step inside the stage goes to its role (MODIFIED) | covered (T146 now pins conduct-check's side of conductor-task) |
| change-coordination: The session waits on GitHub with no time limit (MODIFIED) | covered (unchanged; the wake half stays deferred to host-monitor-wake, AC-11) |
| change-coordination: A change archived on the default branch is not unfinished (MODIFIED) | covered |
| change-coordination: A run can carry a token budget (MODIFIED) | covered |
| change-coordination: The budget stop says how to go on (MODIFIED) | covered |
| change-coordination: A merge-defect fix follows the rule of every plan edit (MODIFIED) | covered |
| change-coordination: The session declares a pause or a decision outside the gates (ADDED) | covered |
| change-coordination: A red gate gets one declared fix before the run stops (ADDED) | covered |
| change-coordination: The owner authorizes one more review round after the limit (ADDED, revised in round 1) | covered (`--stdin words` in runDeclare, both skills' rows, T44 and T143 to T145, real run ver-r7s; see F2 on the revision's approval) |
| change-coordination: A conflict outside the release files goes to the implementer (ADDED) | covered |
| change-delivery: A task marked for the conducting session is not the implementer's (ADDED) | covered |
| change-delivery: The review round limit is two plus the rounds the owner authorized (ADDED) | covered |
| change-delivery: A change's own pull request (MODIFIED) | covered |
| change-stages: A plan revised after the work started goes back to its gates (ADDED) | covered (F1 on the digest's reach; F2 on this change's own plan) |
| change-stages: Attempt ceilings and no progress stop the run (MODIFIED) | covered |
| change-stages: After a merge the walk resumes at the retro (MODIFIED) | covered |
| coordination-locks: A run is known from the session's own record (MODIFIED) | covered |
| delivery-models: A resolution review deadlock goes to the owner (MODIFIED) | covered |
| file-writers: The verifier writes its evidence and its proof folder (ADDED) | covered |
| file-writers: The record of declared steps is the main session's (ADDED, scenario widened in round 1) | covered (DECLARE_CALL skips node option words; T99 refuses `--no-warnings`, `--` and two options before a quoted path, and allows the main session's) |
| project-setup: The GitHub plan names what the repository refuses (MODIFIED) | covered |
| review-round: A round beyond the second runs within the authorized limit (ADDED) | covered |
| stage-models: A project and a change can set a stage's model (MODIFIED) | covered |

Scope creep: none. `--param words` still being accepted is stated in design D-4 and tested by T143. The guard's option-word skip and the `declare --stdin` refusals (T145) each sit behind a scenario of the revised deltas. The ADR 0032 Note and the docs/compozy-kit.md sentence record limits the approved plan already stated (proposal AC-7, AC-10; design D-5, D-7). They add no behaviour.

No two specs disagree. The skills now pass the words only through `--stdin words` with the quoted heredoc. The change-coordination requirement names the same command, and no copy of `--param words="<their words>"` remains in a skill or a doc.

Escalation (recorded decision at play, F2): ADR 0032 decision 7 and the ship-change fix-review row send a plan edited after the start back to readiness and the owner's approval. Round 1's spec-delta edits did not go back. The rule is not bypassed in code, but the owner has not approved the revised deltas.

Test run (one scoped run, foreground, concurrency 3): change-loop-declared.test.mjs, conduct-check.test.mjs and guard.test.mjs filtered to the AC-1, AC-7, AC-9 and AC-19 tests the fixes touched (T38-T40, T44, T96-T102, T111-T113 by pattern, T143-T148): 17 tests, 17 pass, 0 fail, 56.6 s. `openspec validate coordinator-loop-fixes --strict`: valid.

### Summary
- 3 findings (0 scope creep, 0 gaps): 1 important (F2, the plan revised in round 1 without readiness or the owner's approval), 1 nit (F1, still open), 1 praise.
- No blocking finding is open.
