<!-- devkit-stage retro result=passed attempt=1 commit=b19df0ca1d7dd1da9ccba2582e4f6bf6404bef41 -->
# Retro: run-status-bar

## Retro: run-status-bar (PR #124, merged by train 14 in PR #138 at 4eccbdc, tagged v0.46.0)

1. Went wrong: the plan took four readiness attempts (the fourth one by the owner's leave), and two existing tests it had not named broke the phase gates (E-4: a helper comparing `state` with `next` by field names; E-5: the reply test rendering every message key through a `SAMPLE` table), because the plan's search looked for the `state` output and the message keys as literals. Then four merges of main between the first review and the train (each a release renumber, two with code conflicts in `change-loop.mjs`) redid the evidence and the review each time; one of those re-checks found a real bug the first two rounds had missed (with `--offline` a merge-mode change at review read blocked, so the coordinator bar would have counted every reviewed change as blocked), and its fix left one guard half untested, which took the review to the owner after round 2. The documented `models:` table in a change's `.openspec.yaml` made `openspec validate --strict` fail, so it was dropped again. Last, the real run on this repository showed the coordinator bar empty: the 11-change offline listing takes 37 to 45 s against the bar's 20 s bound; the owner accepted it (`Entregar e seguir`).
2. Better next time: search the tests a plan changes by the fields and keys they compare, helpers and sample tables included, not only by literal output; run the real coordinator listing on the project itself while planning a surface that reads it, so its time is a planned number, not a delivery surprise; and give every new guard one test per condition, negatives included, in the same commit as the guard.
3. Remember: a status surface is only as fast as the read under it; measure that read on the real project before planning the surface.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | The plan's search for tests that pin `state` and the message table missed a field-name helper (E-4) and a `SAMPLE` rendering table (E-5); both broke a phase gate | project-rule | rule | project |
| 2 | The coordinator bar prints nothing on this repository: the serial `state --offline` listing (about 5 s per change) passes the 20 s bound | process-friction | followup (`state-listing-speed`) | project |
| 3 | The `statusLine` snippet runs `node` under `sh` without `exec`, so on macOS a signal sent only to the command's pid misses the bar's handlers (code-quality nit F7) | bug-class | followup | project |
| 4 | Open review nits: the spec delta does not name the unplaced stand-in among the `stages: null` cases; the one-word reason is dropped where the spec says cut to its first word | doc-gap | followup | project |
| 5 | The `devkit:` `models:` block the docs offer for a change's `.openspec.yaml` fails `openspec validate --strict` | tooling | memory-only (already in the plan of `coordinator-loop-fixes`) | project |
| 6 | A boarded change in conflict only on release files is the train's to renumber; a conflict in code leaves it behind and needs a merge of main | process-friction | memory-only | user |

## Proposed updates

### `CLAUDE.md` (project-rule)
A plan that changes an output or a message table searches the tests that pin it by the fields and keys they compare, not only by literal text.
- before: "- Before changing a test, name its invariant, the layer that owns it and the suite it lives in. A time or a count the documents state (the suite's minutes, its tests) is measured again after the last merge of the base, with no other suite running on the machine."
+ after: "- Before changing a test, name its invariant, the layer that owns it and the suite it lives in. A time or a count the documents state (the suite's minutes, its tests) is measured again after the last merge of the base, with no other suite running on the machine. A plan that adds a field to an output or a key to a message table searches the tests that pin it by field and key names too (helpers that compare by field lists, sample tables that render every key), not only by the literal output."
- Answer: approved
- Applied: yes

### `openspec/roadmap.md` (doc-update)
A new round for the follow-ups of this change: the listing speed the owner asked for, and the open review nits.
- before: "## Round 28m: redacted real-run proofs"
+ after: "## Round 28n: follow-ups of run-status-bar\n- [ ] state-listing-speed (after: run-status-bar) — from the run-status-bar retro, asked by the owner on 2026-11-24 (`Entregar e seguir`): the `state` listing fast enough for the coordinator's status bar, whose call is bounded at 20 s; on this repository `state --offline` over 11 changes takes 37 to 45 s, about 5 s per change read one after another, so the coordinator bar prints nothing. In the grill: read the changes in parallel, or skip the per-change reads the offline listing does not need.\n- [ ] run-status-bar-followups (after: run-status-bar) — from the run-status-bar review: the `statusLine` snippet ends with `exec node` so a signal sent to the command reaches the bar on macOS; the change-state spec names the unplaced stand-in among the `stages: null` cases; and the spec and the code of the bar agree on a one-word reason (cut to `<word>…` or dropped)\n\n## Round 28m: redacted real-run proofs"
- Answer: approved
- Applied: yes

### user memory (memory-only)
A boarded change in conflict with main only on release files stays boarded (the train renumbers); a code conflict leaves it behind and needs a merge of main, which stales the evidence and every review.
- Answer: approved
- Applied: yes
