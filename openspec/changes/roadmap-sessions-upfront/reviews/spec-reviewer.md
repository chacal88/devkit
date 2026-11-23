Verdict: rejected
Commit: 123a7ba4a7084ed466075cfbb23bdb9b82fdbbd0

## Spec review — roadmap-sessions-upfront

### Findings
- [important] plugins/openspec/skills/devkit-session/SKILL.md:28; spec roadmap-coordination, requirement "A change's plan waits for its dependencies and starts from the code of that day", scenario "The merge confl… — Partial: merge-base aborts and exits 3, but the session skill never says to declare the end (design D-8 says change-loop.mjs reply blocked why=base-conflict), so no devkit-end blocked line is recorded and the change does not stop blocked; the next session-next hands merge-base again.
- [important] plugins/openspec/hooks/roadmap-loop.mjs sessionNext/sessionNextCmd (budget: true); proposal What Changes; tasks 6.1; baseline change-coordination "A run can carry a token budget" — The token budget counted in a change session's session-next has no requirement in any delta spec or AC (plan says "no AC of this change"); the baseline names /devkit change and excludes only the coordinator's own reading, so the ambiguity was resolved silently: add a MODIFIED scenario or remove it. · refuted: Baseline openspec/specs/change-coordination/spec.md:696-698 already requires the stop at the cap in place of a hand-off or session step and exempts only the coordinator's own reads (734-736); roadmap-loop.mjs:1305 restores it; proposal.md:47-51 and design.md:48-53 state it openly / Baseline openspec/specs/change-coordination/spec.md:696-698 already requires the stop at the cap in place of a hand-off or session step and exempts only the coordinator's own reads (734-736); roadmap-loop.mjs:1305 restores it; proposal.md:47-51 and design.md:48-53 state it openly / Baseline openspec/specs/change-coordination/spec.md:696-698 already requires the stop at the cap in place of a hand-off or session step and exempts only the coordinator's own reads (734-736); roadmap-loop.mjs:1305 restores it; proposal.md:47-51 and design.md:48-53 state it openly
- [nit] plugins/openspec/hooks/roadmap-loop.mjs checkCmd; design D-9; spec roadmap-coordination "A firing of the check acts and reports only what changed" — Design-only behaviours with no spec scenario: the roadmap-check-idle line (a place given to a change with no live wait, asking the owner to type in its session), the stopped-waits line and the archive-later retry line; add scenarios or accept as design-only.
- [nit] CHANGELOG.md, 0.34.0 entry — Lists schedule-check and delete-check as new subcommands, but they are decision actions; the real new subcommands are session-next, session-wait, merge-base, push and check, and check is missing.

### Coverage
Every in-scope requirement of the four spec deltas is covered; the scenario 'The merge conflicts' of the dependency requirement is partial (F1); AC-1 to AC-16 are covered and the dogfood parts of D-15 are open, as evidence.md says.

In-scope specs: openspec/changes/roadmap-sessions-upfront/specs/{roadmap-coordination,coordination-locks,change-coordination,change-delivery}/spec.md; baseline openspec/specs/change-coordination/spec.md (token budget requirements) and openspec/specs/roadmap-coordination/spec.md.

### Notes
- Place stages: LOAD_PARTS build and after match both flow.json scripts; delivery and retro hold no place.
- The entry hook fails closed; DEVKIT_BYPASS=1 exits before the skill mode; devkit stays owner-only and devkit-session is the model-invocable skill.
- The check writes no approval, hands no stage and starts no session on its turn.
- ADR 0019 status is proposed (ADRs 0015 to 0018 are accepted); the accept step is presumably still to come. The number 0019 is free on origin/main.
- Test files were read by test names only; the suite result was taken from the caller and not re-run.

### Summary
- 4 findings (0 scope creep that blocks, 1 gap, 1 spec ambiguity resolved silently, 2 nits). No REQUIRES NEW SPEC CHANGE, no two specs in conflict, no ADR contradiction.
