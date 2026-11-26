<!-- devkit-stage retro result=passed attempt=1 commit=daed34243e0df488e7091f356f3bd226d305bebf -->
## Retro: project-setup

1. Went wrong:
   - The typed-only promise was larger than the change. The spec said a plain-words request writes no file of the setup. R-6 showed that a session runs the setup scripts it reads on disk by hand (F-1), first from an old 0.33.0 copy and then from this change's own scripts. `disable-model-invocation` stops only the skill. The owner chose to narrow the wording (choice A), and the hook that would enforce it is left for later.
   - The base moved under the change five times (trains 5 to 18). Each merge restarted evidence or review: one review round was stopped half-way and one evidence run was thrown away. The readiness stage also hit its failure ceiling on attempts that had already passed, which waited for `stage-ceiling-consecutive`.
   - The change could not ride its train. The join (`release-merge.mjs --merge`) refused its head because two manifests were edited beyond their version: the devkit-compozy description in `.claude-plugin/marketplace.json` and in `plugins/compozy/.claude-plugin/plugin.json`. The train ended empty, and the coordinator merged pull request 148 through GitHub on green checks.
   - Review needed four rounds plus a staleness re-review. Each fix opened one narrow new finding (F6 nested repository, F10 design text, F8 a missing test). The round script accepts only rounds 1 and 2, so the owner-authorized rounds 3 and 4 print "2/2".
   - The plan was written on the Mac and carried its paths and limits (`/private/tmp`, `--concurrency=2`). On the Linux worker these had to be translated, and the gates ran at a concurrency other than the one written.
   - The R-3 GitHub repository could not be deleted by the session: the machine's `gh` token lacks `delete_repo`. The repository still waits for the owner.
2. Better next time:
   - A spec scenario that promises what no hook enforces is checked by a real run before readiness, not after. Here R-6 would have shown it at plan time.
   - A change that edits a pack's description, or any manifest field beyond `version`, either asks for the train join to accept that field or is delivered alone, and the plan says which.
   - A fix that changes how a rule decides (D-1's root) edits the design line in the same commit, so the next round does not open a finding on stale text.
   - A plan names machine-neutral paths and the session's own TMPDIR, and leaves the concurrency to the machine's rule.
   - A real run that creates something outside the repository (a GitHub repository) checks first that the session can also delete it.
3. Remember: a promise in the spec needs either a mechanism that enforces it or a real run that shows it, before the plan is approved.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | The typed-only claim covered only the skill; nothing stops a session from running the setup scripts by hand | bug-class | followup | project |
| 2 | The train join refuses a change that edits a manifest field beyond its version, such as a pack description | tooling | followup | project |
| 3 | The review round script accepts no round above 2, even one the owner authorized | tooling | followup | project |
| 4 | Small open nits: R-3 never ran the ruleset question, the D-13 counts and N-20/N-21 order, kit-installer searching marketplace clones, ADR 0031's dated line on the typed-only gap, and settings read from the outer folder in a nested repository | doc-gap | followup | project |
| 5 | A change that edits a pack description cannot ride a train today | process-friction | doc-update | project |
| 6 | A real run that creates something outside the repository checks first that the session can delete it | environment | memory-only | user |

## Proposed updates

### `openspec/roadmap.md` (followup)
A round for the follow-ups of project-setup: the hook from F-1, the train join and description edits, owner-authorized review rounds, and the review's open nits.
- before: (no round for the follow-ups of project-setup)
+ after: ## Round 28p: follow-ups of project-setup
+ after: - [ ] setup-typed-hook (after: project-setup) — from the project-setup retro (F-1): a hook refuses the setup scripts (`setup-block.mjs apply`, `project-settings.mjs`, `install-schemas.sh`, `kit-installer.mjs`) unless the session's run started from a typed `/devkit setup`, so a plain-words request writes no file of a setup; the spec of project-setup gets back its stronger scenario.
+ after: - [ ] train-manifest-fields (after: delivery-train) — from the project-setup retro: `release-merge.mjs --merge` refuses a head that edits a manifest field beyond its version (pull request 148 changed the devkit-compozy description), so such a change cannot ride a train; the join accepts description edits, or the departure says so before it starts.
+ after: - [ ] review-owner-rounds (after: project-setup) — from the project-setup retro: `review-round.workflow.js` accepts a round above 2 when the owner authorized it, and `review.md` prints the real round number and the owner's words.
+ after: - [ ] project-setup-followups (after: project-setup) — from the project-setup review nits: run R-3's ruleset question once the release tag exists; widen D-13's N counts and order N-20/N-21; restrict kit-installer (and bin/devkit-kit) to the installed cache; add ADR 0031's dated line on the typed-only gap; read the setup's settings from the chosen root in a nested repository.
- Answer: approved
- Applied: yes

### `CONTRIBUTING.md` (process-friction)
A change that edits a manifest field beyond `version` cannot ride a train today, and its plan says how it is delivered.
- before: In a project with a delivery train a boarded change takes its release numbers on the train: the departure renumbers each join above the train's numbers, and the change's own head keeps the numbers it had.
+ after: In a project with a delivery train a boarded change takes its release numbers on the train: the departure renumbers each join above the train's numbers, and the change's own head keeps the numbers it had. The join refuses a head that edits a manifest field beyond `version` (a pack's description in `plugin.json` or `marketplace.json`), so such a change is delivered alone, merged on its own green checks, and its plan says so.
- Answer: approved
- Applied: yes

### user memory (memory-only)
A real run that creates something outside the repository (a GitHub repository) first checks that the session can delete it (for `gh`, the `delete_repo` scope).
- Answer: approved
- Applied: yes
