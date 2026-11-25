Verdict: approved
Commit: 73e159c2acfac2959d8f6f84b099c538b0eafc54

## Spec review — coordinator-loop-fixes

### Findings
- [nit] plugins/openspec/hooks/deliver-check.mjs:2019 (specFiles/planDigest); openspec/changes/coordinator-loop-fixes/specs/change-stages/spec.md, Requirement "A plan revised after the work started goes back… — The requirement puts "every file under `specs/`" in the plan digest, but design D-7 (design.md:597) and `specFiles` count only `.md` files. OpenSpec reads only spec.md, so nothing visible changes; make the spec delta's wording match the design (or the reverse).
- [praise] openspec/changes/coordinator-loop-fixes/specs/* — Every ADDED and MODIFIED scenario has a named test, negatives included (T1 to T142 without T24). The 141 tests re-ran green by name at concurrency 3 at this head: 10 files, 141 pass, 0 fail.

In-scope specs: openspec/changes/coordinator-loop-fixes/specs/{change-coordination,change-delivery,change-stages,coordination-locks,delivery-models,file-writers,project-setup,review-round,stage-models}/spec.md, against their baselines in openspec/specs/<capability>/spec.md. Cross-cutting specs read: openspec/specs/compozy-driver/spec.md (its red gate still asks the owner, which matches AC-10's Claude-only scope) and openspec/specs/verdict-files/spec.md. Decisions read: ADR 0032, ADR 0033 (amends 0023 decision 1; 0023 has its Note), ADR 0011 (Note only, Decision unchanged).

### Coverage
| Requirement | Status |
|-------------|--------|
| change-coordination: From the implementation on, the step inside the stage goes to its role (MODIFIED: resolve-base-conflict, gate red, conductor-task) | covered |
| change-coordination: The session waits on GitHub with no time limit (MODIFIED: host monitor) | covered (skill text: devkit SKILL.md "Waiting on GitHub" and devkit-session item 3; whether the host's event wakes the session is deferred to roadmap line host-monitor-wake, as AC-11 states) |
| change-coordination: A change archived on the default branch is not unfinished (MODIFIED: union wording) | covered |
| change-coordination: A run can carry a token budget (MODIFIED: x-devkit) | covered |
| change-coordination: The budget stop says how to go on (MODIFIED: x-devkit) | covered |
| change-coordination: A merge-defect fix follows the rule of every plan edit (MODIFIED) | covered |
| change-coordination: The session declares a pause or a decision outside the gates (ADDED) | covered |
| change-coordination: A red gate gets one declared fix before the run stops (ADDED) | covered |
| change-coordination: The owner authorizes one more review round after the limit (ADDED) | covered |
| change-coordination: A conflict outside the release files goes to the implementer (ADDED) | covered |
| change-delivery: A task marked for the conducting session is not the implementer's (ADDED) | covered |
| change-delivery: The review round limit is two plus the rounds the owner authorized (ADDED) | covered |
| change-delivery: A change's own pull request (MODIFIED: archive- ids) | covered |
| change-stages: A plan revised after the work started goes back to its gates (ADDED) | covered (see F1 on how far the digest reaches) |
| change-stages: Attempt ceilings and no progress stop the run (MODIFIED: lifted code-review ceiling) | covered |
| change-stages: After a merge the walk resumes at the retro (MODIFIED: advanced own branch) | covered |
| coordination-locks: A run is known from the session's own record (MODIFIED: end id checked) | covered |
| delivery-models: A resolution review deadlock goes to the owner (MODIFIED: authorized limit) | covered |
| file-writers: The verifier writes its evidence and its proof folder (ADDED) | covered |
| file-writers: The record of declared steps is the main session's (ADDED) | covered |
| project-setup: The GitHub plan names what the repository refuses (MODIFIED: exit 1) | covered |
| review-round: A round beyond the second runs within the authorized limit (ADDED) | covered |
| stage-models: A project and a change can set a stage's model (MODIFIED: x-devkit) | covered |

Scope creep: none found. The items in the diff with no spec delta behind them are each backed by a proposal criterion and are internal or documentation only: the agent map built from PACKS (AC-4, D-9), the ADR 0011 Note (AC-5), the language-never-set paragraph in docs/openspec-flow.md (AC-6), the two devkit-lite decisions recorded in docs/openspec-flow.md (AC-15), the `Live roadmap:` rule and the re-pinned tests (AC-20), the host-monitor-wake roadmap line (D-10), the compozy-kit paragraph (D-19), and the release bumps (D-18).

No two specs disagree. The canonical coordination-locks scenario "An end the session declared after a red gate" and the change-coordination scenario "An end the session declares" still hold: a second red gate prints its own `devkit-end: <id> blocked` through `declare`, and an exit 3 of `declare` falls back to `reply blocked`. No change assumes a decision that was never taken.

Test run (one scoped run, foreground): `--concurrency=3 --test-name-pattern="^coordinator-loop-fixes"` over the 10 files that hold the change's tests: 10 files, 141 tests, 141 pass, 0 fail, 196.3s.

Observation (not a finding): the change's own approval.md (attempt 5, 2026-11-25) records no `- Plan:` line, so the D-7 rule does not guard this change's own plan after its last approval. The scenario "An approval with no digest" allows this, and the only plan-file edits since that approval (84da214..HEAD) are the tasks.md ticks of 6.4 to 6.6, which the digest ignores anyway.

### Summary
- 2 findings (0 scope creep, 0 gaps): 1 nit (F1, the digest's reach under specs/), 1 praise.
- No blocking or important finding is open.
