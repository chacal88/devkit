Verdict: approved
Commit: cb79a383d3ea574537c9c09ce539af92dbaeaebc

## Quality review — state-skips-unlocated (round 2)

### Findings
- [praise] plugins/openspec/hooks/change-loop.mjs:1788 — One shared unplacedAction helper feeds both the state command and collectRoadmap, so board and state agree by construction (ADR 0017).
- [praise] plugins/openspec/hooks/change-loop-remote-state.test.mjs:1397 — Each locate guard has its own negative test; run-file precedence and the archived-with-stale-copy and id-reuse cases are pinned; phrases come from render().
- [nit] plugins/openspec/hooks/change-loop.mjs:1843 — stateEntries keeps two caches (days via archivedDates, archived via archivedOnDefault) that can read GitHub/git twice in one command; derive archived from days.
- [nit] plugins/openspec/hooks/change-loop.mjs:1796 — unplacedAction's holder comes from knownChange/checkoutsOf, which does not skip train/<n> checkouts as unfinished does; a train-only folder could read wrong-branch with the train as root (untested).
- [nit] openspec/changes/state-skips-unlocated/requirements.md:18 — requirements.md words the new locate step without design D-5's narrowing (active folder, main holds none); the other artifacts state the narrower rule.
- [nit] plugins/openspec/hooks/change-loop.mjs:1411 — locate now calls realpathSync(start) on every fall-through path; a nonexistent start would throw where it used to fall back (no such caller found).

### Re-review of round 1

Round 1 had no blocking or important finding, only four nits (F3 to F6 above) and two praise items. None of the nits needed a fix. The product code is unchanged between 63c5eac and HEAD, so all four still stand as written.

### What changed since 63c5eac

- f636733 changes the state paragraph of docs/openspec-flow.md. It now says a change only another checkout holds is the one exception: the helper that lists it `blocked` is read by the state command and the board, while `next`, `wait` and `session-next` still exit 3 for it. This matches the code. unplacedAction sits beside nextAction, and nextAction is unchanged.
- f636733 also adds a dated Note to ADR 0017. It names unplacedAction, the `wrong-branch` reason, and the fact that `next`, `wait` and `session-next` keep exit 3 until a later change routes them through it. It says decisions 1 to 4 are otherwise unchanged. The Note adds a clarification and contradicts no locked decision.
- The remaining commits (6932f4f, cb79a38) touch only evidence.md and the review records.
- `git diff 63c5eac..HEAD --stat -- plugins scripts` is empty, so no product code or test changed.
- `python3 scripts/check.py` prints `all checks passed`, so the English-only and link checks accept both doc edits.

### Summary

- 6 findings (0 blocking, 0 important, 4 nit) + 2 praise.
- Justification: re-checked my previous findings and read the two doc edits. All four nits stand and none blocks. No product line changed, so the round-1 reading of the code, tests and real-run proof stands. The whole suite is the train's to prove, and I did not run it. No open blocking or important finding, so the verdict stays approved.
