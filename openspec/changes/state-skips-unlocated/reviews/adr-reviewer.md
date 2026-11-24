Verdict: approved
Commit: cb79a383d3ea574537c9c09ce539af92dbaeaebc

## ADR review — state-skips-unlocated

### Findings
- [important] docs/openspec-flow.md:240; docs/adr/0017-a-change-state-is-derived-in-one-place.md — The state of an unplaced change is derived outside nextAction, so next, wait and session-next still exit 3 while state and board say blocked wrong-branch; docs and ADR were silent on it. · fixed in f636733
- [nit] openspec/changes/state-skips-unlocated/design.md § D-3 — D-3 did not cite ADR 0017 decision 1 for the stand-in kept outside nextAction; design.md already cites it at lines 35, 46 and 55, next to the Non-Goals bullet that keeps next exiting 3. · fixed in f636733

ADRs reviewed: ADR 0017 (`docs/adr/0017-a-change-state-is-derived-in-one-place.md`), ADR 0010 (`docs/adr/0010-openspec-as-the-harness.md`), ADR 0020 (`docs/adr/0020-a-change-can-run-on-another-machine.md`), ADR 0025 (`docs/adr/0025-a-base-merge-stales-only-on-the-changes-own-files.md`), ADR 0026 (`docs/adr/0026-the-devkit-test-suite-runs-by-file-in-parallel.md`).

Re-review scope: the previous findings and the range 63c5eac..HEAD. That range holds f636733 (docs/openspec-flow.md and ADR 0017), the refreshed evidence (6932f4f) and the round-1 review records (cb79a38). No product code or test changed in it.

F1 is satisfied by two edits:
- The state paragraph of `docs/openspec-flow.md` (line 240) now names the exception. A change that only another checkout holds is the one case where the state is not derived in one function shared by `next`, the state command and `/devkit status`. The helper that lists it `blocked` is read by this command and the board, and `next`, `wait` and `session-next` still exit 3 for it.
- ADR 0017 gets a dated Note (state-skips-unlocated, 2026-11-24). It records `unplacedAction` as the helper the state command and the board both call, and says it sits beside `nextAction`. It also says the three commands keep exiting 3 until a later change routes them through it, and that decisions 1 to 4 are otherwise unchanged.

The code matches the docs. `unplacedAction` is exported at `plugins/openspec/hooks/change-loop.mjs:1790`. The state command calls it at line 1850 and the roadmap board at `plugins/openspec/hooks/roadmap-loop.mjs:807`, before `nextAction`. The ADR 0017 Note, not `decisions.md`, now carries the record of the divergence, so it is acknowledged at the ADR level. That fits the plan's choice to leave `decisions.md` unedited after approval.

No open-decisions log exists, so no open decision is touched. No new finding.

### Summary
- 2 findings (0 blocking, 0 important open, 0 nit open): F1 and F2 both closed by f636733. Nothing is left open.
