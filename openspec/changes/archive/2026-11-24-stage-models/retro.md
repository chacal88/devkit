<!-- devkit-stage retro result=passed attempt=1 commit=8f14bd16fb782477137e94486d406be7550275ca -->
## Retro: stage-models

1. Went wrong: the plan took five readiness rounds and one owner-approved revision, because two decisions met the code late: the retry trigger had to be a stage agent that stops with `Outcome: failure` and writes no stage file (the stop hook refuses a first stop without a file, so a failing stage never reached the retry), and `next` had to read hand-offs only with `--after` so an old test (`change-budget AC-4`) kept its meaning. Review round 1 failed on that retry trigger (one important finding) and phase 5 fixed it with a real run as proof. After that the change met a main that moved four times (PR 88, PR 92, delivery-train PR 93 and the compozy driver): three merges of `origin/main` and one stacked merge of `origin/delivery-train`, each one renumbering the ADR (0019 to 0023) and the releases (devkit-openspec 0.31.0 to 0.35.0, marketplace 0.35.0 to 0.39.0), and each costing about an hour of filtered runs on a loaded machine. The owner then merged PR 91 with admin rights on `8f14bd1` and the loop could not follow: gate 5.5 (the whole `guard.test.mjs` on the final commit), the refreshed `evidence.md` and review round 2 never ran; only the filtered tests of each touched file (all green on `17e876e`), `scripts/check.py` and GitHub's `check` ran. `next` still answers `implement` for the unticked 5.5, so the release tag `v0.35.0` (at the merge commit) and this retro were driven by hand from this session.
2. Better next time: when several changes wait for one landing window, stack on the one that merges first (merge its branch, renumber above it) instead of merging main after every landing; ask the stop-hook question of any "retry on failure" rule in the plan, not in review; keep one whole-suite run per commit that matters and make the suite fast; give the owner's forced merge a path in the loop (already proposed as `forced-merge-path`).
3. Remember: stage-models merged on 2026-11-24 without gate 5.5 on its final commit, without a refreshed evidence and without review round 2; the live dogfood of a session started on its stage's model (AC-6 and AC-7, half) and the spend readout in real sessions were never run on a desktop app.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | A rule that reacts to a stage agent's failure must be checked against the stop hook (`refuseOnce`) and the files the agent leaves, in the plan | bug-class | rule | project |
| 2 | A session started on its stage's model, the step-down floor and the spend readout were proved only by stubs and tests, never on a real desktop run; a remote placement starts with no `model` by design | doc-gap | followup | project |
| 3 | Merging main after every landing renumbers the ADR and the releases each time; stacking on the branch that lands first avoids it | process-friction | memory-only | user |
| 4 | The owner's forced merge leaves the loop at `implement` and `deliver-check` without the merged PR | process-friction | followup | project |

## Proposed updates

### `openspec/roadmap.md` (followup)
Add the live check of what only a real run proves: the model of a started session, its step-down and the spend readout, plus the small findings left by review round 1.
- before: ## Round 28g: the owner's forced merge
+ after: ## Round 28h: live checks of a model per stage
+ after: - [ ] stage-models-live-checks (after: stage-models) — the first real `/devkit roadmap` on the desktop app with devkit-openspec 0.35.0 records in `openspec/changes/stage-models-live-checks/evidence.md`: a change session started on the model of its first stage (the `start_session` input and the session's own model line), the `session-model` action switching it when the stage changes and the refusal path when the host asks the owner, the step-down floor never going below the strongest model of a session-run stage still ahead, the retry one model up on a stage agent that stops with `Outcome: failure` and writes no file, and the spend readout per stage and per model in `/devkit status` against the transcripts. Decide whether a change placed on another machine should start on its first stage's model too (today its `session-start` carries no `model`). Also close the nits of review round 1: a test for the cap precedence, the status block when no roadmap file exists, the run-on sentence in `plugins/openspec/skills/devkit/SKILL.md`, and the release-number re-check before the push.
- Answer: approved
- Applied: yes

### `CLAUDE.md` (project-rule)
Name the question that every plan with a retry-on-failure rule must answer.
- before: - When a change alters what an agent writes, its real-run proof covers every case the plan declares (each input variant, and the conducting session's own part), not one case plus prose tests.
+ after: - When a change alters what an agent writes, its real-run proof covers every case the plan declares (each input variant, and the conducting session's own part), not one case plus prose tests.
+ after: - A plan rule that reacts to a stage agent's failure names the hook that sees the failure (the stop hook refuses a first stop without a stage file) and the files the agent leaves, and its real run proves the failure path as well as the success path.
- Answer: approved
- Applied: yes

### user memory (memory-only)
When several PRs wait for one main window, stack on the one that merges first (merge its branch and renumber above it) instead of merging main after every landing.
- Answer: approved
- Applied: yes
