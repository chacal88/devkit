Verdict: approved
Commit: 551ee6383b99eabd4589e6154ba08c730ad9748b

## ADR review — change-coordinator

### Findings
- [nit] docs/adr/0010-openspec-as-the-harness.md:160 (decision 8) and :28 (Note) — Decision 8 still says the change coordinator has no edit tool. The header and the dated Note point to ADR 0011 as the amendment, but the sentence itself is unchanged, so a reader of decision 8 alone is misled. A short inline pointer, such as 'amended by ADR 0011', beside the sentence would help. The record is otherwise correct.
- [praise] docs/adr/0011-the-change-coordinator-is-the-owners-session.md; openspec/config.yaml:27 — The amendment to ADR 0010 is made through a new accepted ADR, as the config rule for design requires. The owner's acceptance is traceable to approval.md. The ADR has a review trigger and lists the weakening (fail-open) as an accepted cost, and the config's ADRs line is updated.

Verdict: approved
Commit: 551ee6383b99eabd4589e6154ba08c730ad9748b

## ADR review — change-coordinator

ADRs reviewed: ADR 0002 (`docs/adr/0002-merge-without-the-owner-opt-in.md`), ADR 0003 (`docs/adr/0003-auto-merge-the-archive-pr.md`), ADR 0004 (`docs/adr/0004-devkit-per-project.md`), ADR 0005 (`docs/adr/0005-parallel-steps-and-a-session-wake-up.md`, superseded; Note only), ADR 0006 (`docs/adr/0006-phases-as-child-sessions.md`), ADR 0007 (`docs/adr/0007-one-change-on-request.md`, superseded), ADR 0009 (`docs/adr/0009-compozy-loop-as-a-second-driver.md`), ADR 0010 (`docs/adr/0010-openspec-as-the-harness.md`), ADR 0011 (`docs/adr/0011-the-change-coordinator-is-the-owners-session.md`). ADR 0001 and ADR 0008 were checked only for rejected alternatives that the change might retake.

### Conformance notes
- **ADR 0010 decision 5 (hooks veto, they do not drive).** The Stop, SubagentStop and Agent locks in `plugins/openspec/hooks/guard.mjs` and `plugins/openspec/hooks/hooks.json` only refuse with exit 2 and a reason. They refuse at most once for an unchanged state, so they stay inside the limit of eight continuations. They fail open on any error, and they honour `DEVKIT_BYPASS`. The existing locks are untouched, and `--force-with-lease` is still the only force push allowed.
- **ADR 0004 (per-project opt-in).** `lock()` returns early when the root is not opted in. `guardEdit` and `guardBash` check `optedIn` before the run lock, so nothing changes in a project that has not chosen devkit.
- **ADR 0010 decision 8 and ADR 0011.** The one amended sentence is handled by a new accepted ADR, which is the rule in `openspec/config.yaml`. ADR 0010 gets a header line and a dated Note. `docs/coordination-design.md` and `docs/roles.md` now name the hook as the reason for 'no side door'. `grep` finds no stale 'no edit tool' claim outside ADR 0010, which keeps its original text, and ADR 0011, which quotes it.
- **ADR 0010 decisions 2 and 6, and ADR 0002 and ADR 0003.** The coordinator's 'writes no code' is kept by the run lock. `plugins/openspec/skills/devkit/SKILL.md` forbids merging into or pushing to the default branch, bypassing hooks, and writing `approval.md`, the retro answers or gate files except from the right source. The merge rules are unchanged. `change-loop.mjs` only names `enable-auto-merge` and `disable-auto-merge` as `ship-change` delivery steps.
- **ADR 0010 decision 7 and ADRs 0005, 0006, 0007 and 0009.** The retired `/conduct` is recorded in a dated Note on each. The Note on ADR 0006 correctly keeps the child-session code in `conduct-check.mjs` until round 24.
- **Open decisions.** The four open points that `docs/coordination-design.md` answers are the ADR 0007 rules kept, the configuration's field names, waiting on GitHub, and the two roles called `tech-lead`. Each is recorded with its owner decision or its A-number, and each was removed from the open list.
- **Rejected alternatives.** The design does not retake any rejected alternative without an ADR. The session cron (ADR 0005) is excluded, and the Stop hook that drives is excluded. Reading the session transcript for a run is covered by ADR 0011.
- **Tension.** I found none that the change resolved the wrong way. The documented side effect is that typing another slash command ends the run for the hooks, and ADR 0011 accepts it.

### Summary
- 2 items (0 blocking, 0 important, 1 nit, 1 praise)

### Files read
docs/adr/0011-the-change-coordinator-is-the-owners-session.md; docs/adr/0010-openspec-as-the-harness.md (full decisions and Notes); docs/adr/0005, 0006, 0007 and 0009 (diffs); docs/adr/0002 and 0004 (decisions); docs/adr/0001 and 0008 (status only); openspec/config.yaml; openspec/changes/change-coordinator/approval.md; docs/coordination-design.md (diff); docs/compozy-kit.md (diff); docs/roles.md (diff); docs/openspec-flow.md (diff, grepped for ADR, merge and never); plugins/openspec/hooks/guard.mjs (diff plus dispatch and bypass); plugins/openspec/hooks/hooks.json (diff); plugins/openspec/hooks/change-loop.mjs (grepped for merge, force and language); plugins/openspec/skills/devkit/SKILL.md; plugins/openspec/.claude-plugin/plugin.json (diff); plugins/core/agents/commit-and-pr.md, plan-readiness-reviewer.md and tdd-implementer.md (diffs); plugins/core/.claude-plugin/plugin.json (diff); plugins/core/skills/review-change/scripts/review-round.test.mjs (diff). The design sections on ADR handling were grepped, not read in full. The test suites were not re-run, per the instructions.
