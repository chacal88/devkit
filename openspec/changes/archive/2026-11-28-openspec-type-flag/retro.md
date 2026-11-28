<!-- devkit-stage retro result=passed attempt=1 commit=b2310fa61fea93411adf7124e7632a4a7417e110 -->
## Retro: openspec-type-flag

1. Went wrong: the plan gave the validation section (4) a gate with the same selective command as phase 3's gate, though section 4 changed no file outside `openspec/`. The loop ran the 27-file `--own-files` selection a second time, about 48 minutes on a loaded machine, to prove what the 3.4 run had already proven. The section headings also numbered phases one below their `##` number ("## 2 ... (phase 1 ...)"), and the first implementer stopped after section 1 asking which "phase 1" was meant.
2. Better next time: a section that only checks the work and edits no product file carries no second selective gate (the last product gate already covers its criteria), or its gate is the short parts only; and a section's heading number is its phase number.
3. Remember: one selective gate per product state; a verification-only section re-proves nothing.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | A verification-only section repeated the selective gate of the last product phase (about 48 minutes) | process-friction | memory-only | project |
| 2 | The check skips `openspec validate --strict <id>` (a flag before the id) and does not read `docs/` (review nits) | tooling | followup | project |

## Proposed updates

### user memory (memory-only)
When planning or running a devkit change, a last section that only verifies and edits no file outside `openspec/` gets no second `--own-files` gate: the last product gate covers it.
- Answer: approved
- Applied: yes
Answered by the coordinator's session on the owner's delegation of 2026-11-28 (the owner told the coordinator to answer every session's questions itself).

### `scripts/check.py`, `plugins/openspec/hooks/validate-type.test.mjs` (regression-gate)
Extend `check_validate_type` to a command whose first token after `validate` is a flag followed by an id (`openspec validate --strict <id>`), with one test each way.
- before: `VALIDATE_WITH_ID` matches only an id right after `validate`.
+ after: `VALIDATE_WITH_ID` also matches an id after leading flags; T-12 refuses `openspec validate --strict <id>`, T-13 accepts `openspec validate --strict <id> --type change`.
- Answer: rejected: a review nit; no file in the repository writes a flag before the id, and the scope stays what the request named
Answered by the coordinator's session on the owner's delegation of 2026-11-28 (the owner told the coordinator to answer every session's questions itself).
