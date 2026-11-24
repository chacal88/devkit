Verdict: approved
Commit: faddf80f7035fb873748b734bd3515341ab62456

## Quality review — state-skips-unlocated (round 3, re-review of cb79a38..HEAD)

### Findings
- [praise] plugins/openspec/hooks/change-loop.mjs:1788 — One shared unplacedAction helper feeds both the state command and collectRoadmap, so board and state agree by construction (ADR 0017).
- [praise] plugins/openspec/hooks/change-loop-remote-state.test.mjs:1397 — Each locate guard has its own negative test; run-file precedence and the archived-with-stale-copy and id-reuse cases are pinned; phrases come from render().
- [nit] plugins/openspec/hooks/change-loop.mjs:1843 — stateEntries keeps two caches (days via archivedDates, archived via archivedOnDefault) that can read GitHub/git twice in one command; derive archived from days.
- [nit] plugins/openspec/hooks/change-loop.mjs:1796 — unplacedAction's holder comes from knownChange/checkoutsOf, which does not skip train/<n> checkouts as unfinished does; a train-only folder could read wrong-branch with the train as root (untested).
- [nit] openspec/changes/state-skips-unlocated/requirements.md:18 — requirements.md words the new locate step without design D-5's narrowing (active folder, main holds none); the other artifacts state the narrower rule.
- [nit] plugins/openspec/hooks/change-loop.mjs:1411 — locate now calls realpathSync(start) on every fall-through path; a nonexistent start would throw where it used to fall back (no such caller found).

### Re-review of my previous findings

The previous verdict (round 2 at cb79a38) had no blocking or important finding. It had four nits (F3 to F6 above) and two praise items. None needed a fix, and each still stands as written.

The product code did not change after cb79a38. `git diff cb79a38..HEAD --stat` on change-loop.mjs, roadmap-loop.mjs, change-loop-remote-state.test.mjs, roadmap-loop-upfront.test.mjs and change-loop-fixtures.mjs is empty. The line numbers I cited are therefore still right, and my earlier reading of the code and tests holds.

### What changed in cb79a38..HEAD that belongs to this change

- **Release renumber to devkit-openspec 0.40.1 / marketplace 0.45.1.** Four places agree:
  - `plugins/openspec/.claude-plugin/plugin.json` says 0.40.1.
  - `.claude-plugin/marketplace.json` says marketplace 0.45.1 and plugin 0.40.1.
  - CHANGELOG has a `0.45.1` entry for this change. It describes the `blocked` / `wrong-branch` behaviour, the archived stale copy, the id nothing knows, the new `locate` order, and the CI pin `v0.40.1`.
  - `docs/openspec-flow.md` lines 733, 734 and 747 pin `v0.40.1` and no longer mention `v0.40.0`.
- **ADR 0017 Note (state-skips-unlocated, 2026-11-24).** It is intact. It names `unplacedAction`, `wrong-branch` and the `next` / `wait` / `session-next` exit 3 that stays until a later change. It also says decisions 1 to 4 are otherwise unchanged.
- **`docs/openspec-flow.md` line 240.** The parenthetical sentence from f636733 is intact. It says a change only another checkout holds is the one exception, listed `blocked` by the helper that the state command and the board read, and that `next`, `wait` and `session-next` still exit 3 for it. The new `locate` order is in the same paragraph.
- **Merged main files.** The merge of train 4 brought the release-merge-leftovers change, deliver-check, panel and spec files, and other changes' archives. They are other changes' work and I did not review them.
- **`unplacedAction` call sites against main.** They merged cleanly. `roadmap-loop.mjs` imports `unplacedAction` and calls it before `nextAction` in `collectRoadmap`. The state path in `change-loop.mjs` keeps its order: archived stand-in, then `unplacedAction`, then `nextAction`.

### Summary

- 6 findings (0 blocking, 0 important, 4 nit) + 2 praise.
- Justification: re-checked only my previous findings and the lines of this change that moved since cb79a38. Those are the release files, the ADR 0017 Note and the docs sentence, and all are intact after the merge. No product or test line of this change changed, so no new defect can come from it. The whole suite and check.py belong to the train, and I did not run them. The pr-verifier's attempt-5 evidence covers the filtered `unlocated` tests and both whole files, and it covers the pin tests. My own scoped run of the pin test timed out and I stopped it, so that run says nothing either way. No open blocking or important finding remains, so the stage-3 verdict should stay approved.
