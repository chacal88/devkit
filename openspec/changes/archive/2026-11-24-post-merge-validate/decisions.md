<!-- devkit-stage decisions result=passed attempt=2 commit=02208a3517799997e0a4950c46c466ec161c88c6 -->
# Decisions and ADRs

- ADR: `docs/adr/0017-a-change-state-is-derived-in-one-place.md` — Note (post-merge-validate, proposed): the merge-check record `<git common dir>/devkit/merge-check/<id>.json` is one more input of decision 1, a fact (what `openspec validate <id> --strict` answered for one merge), not stored state; the owner chose that place on 2026-11-23 (answer A), and the plan approval accepts the Note.

Records checked: ADR 0017 decision 1 (amended by the Note above: the readiness review's finding M-1 and the design's section "ADR 0017: escalated to the decisions stage"); ADR 0010 decisions 3 and 6, ADR 0016 and ADR 0019, which the change respects unchanged (one read-only step of `next`, a hand-off to the existing planner role bounded by `ceilings.default`, ADR 0010's existing `blocked` end, no stage attempt counter touched and no exception to the plan gate). No other decision needs a record: loop steps of the same kind (`update-branch`, `resolve-release-conflict`) shipped without one, and removing the step undoes the change.
