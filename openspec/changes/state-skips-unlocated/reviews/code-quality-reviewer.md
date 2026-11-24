Verdict: approved
Commit: 535524cac1bb7936280169bb3aec4f5082dbc716

## Quality review — state-skips-unlocated (round 4, re-review of faddf80..HEAD, after the merge of train 6)

### Findings
- [praise] plugins/openspec/hooks/change-loop.mjs:unplacedAction — One shared unplacedAction helper feeds both the state command and collectRoadmap, so board and state agree by construction (ADR 0017); the merge kept that wiring intact.
- [praise] plugins/openspec/hooks/change-loop-remote-state.test.mjs:1397 — Each locate guard has its own negative test; precedence, archived stale copy and id-reuse cases are pinned; the import list keeps both sides' fixtures after the merge.
- [nit] plugins/openspec/hooks/change-loop.mjs:stateEntries — stateEntries keeps two caches (days via archivedDates, archived via archivedOnDefault) that can read GitHub/git twice in one command; derive archived from days.
- [nit] plugins/openspec/hooks/change-loop.mjs:unplacedAction — The holder comes from knownChange/checkoutsOf, which does not skip train/<n> checkouts as unfinished does; a train-only folder could read wrong-branch with the train as root (untested).
- [nit] openspec/changes/state-skips-unlocated/requirements.md:18 — requirements.md words the new locate step without design D-5's narrowing (active folder, main holds none); the other artifacts state the narrower rule.
- [nit] plugins/openspec/hooks/change-loop.mjs:locate — locate calls realpathSync(start) on every fall-through path; a nonexistent start would throw where it used to fall back (no such caller found).

### Re-review of my previous findings

The previous verdict (round 3, at faddf80) had no blocking or important finding. Its four nits are F3 to F6 above, and each still stands as written. The code lines they point at are unchanged by the merge of train 6, which only added baseMergeOf, runMergeCheck and the merge-check command above locate.

### What changed in faddf80..HEAD that belongs to this change or to the conflict resolution

- change-loop.mjs: passes node --check; main's baseMergeOf appears 3 times, nothing doubled; stateEntries keeps its order (archived stand-in, unplacedAction, nextAction, archived, named, usage error).
- roadmap-loop.mjs: unplacedAction is imported and called before nextAction in collectRoadmap.
- change-loop-remote-state.test.mjs: the import list holds both sides' fixtures (pmvFacts and pmvRec from main; addChange, runTranscript, archiveGh, archivedFolder, archiveOnOrigin, withCreated from this change), none doubled; the filtered run 'unlocated 1: locate' passes 10 of 10 at --concurrency=2.
- ADR 0017: the post-merge-validate Note and the state-skips-unlocated Note are each their own paragraph, in that order; decisions 1 to 4 are stated unchanged.
- Release 0.42.1 / 0.47.1: plugin.json, marketplace.json, CHANGELOG (0.47.1 on top) and docs/openspec-flow.md pins (v0.42.1 at lines 733, 734 and 747) agree; no stale 0.42.0 or v0.40.x pin outside CHANGELOG.

### Summary

- 6 findings (0 blocking, 0 important, 4 nit) + 2 praise.
- Justification: re-checked only my previous findings and what belongs to this change or its conflict resolution since faddf80. Both sides of each conflict are kept, with nothing lost or doubled, and the release numbers agree across the four files. The whole suite and check.py belong to the train and the pr-verifier's attempt-7 evidence, and I did not run them. No open blocking or important finding remains, so the stage-3 verdict should stay approved.
