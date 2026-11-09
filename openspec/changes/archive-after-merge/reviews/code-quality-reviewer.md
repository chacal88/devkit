Verdict: approved
Commit: 1286cfb50d6b8269bf6eea653be6bdc52fbc5f96

## Quality review: archive-after-merge (round 3, scoped to d50ffb1..1286cfb)

### Findings
- [praise] plugins/openspec/hooks/deliver-check.mjs:893-901 — the old ternary turned "folder not archived / retro unreadable" into `held = null`, which let an open archive PR fall through to `enable-auto-merge`. Both states are now explicit `stop-archive` results (`archive`, `retro`). Because `held` is truthy, the existing `merge && pr.autoMerge && held` branch emits `disable-auto-merge` first. The stop reasons name the PR number.
- [praise] plugins/openspec/hooks/deliver-check.test.mjs:3379 — the test covers both new states. For each it asserts the step, the `archiveStep`, the PR number in the reason, CLI exit code 2, `disable-auto-merge` when auto-merge is already on, and no merge call.
- [nit] docs/adr/0003-auto-merge-the-archive-pr.md:28-29 — the rewrapped paragraph leaves one over-long line ("...stops holding. The gate for that PR is..."). Cosmetic only.
- [nit] plugins/openspec/hooks/guard.test.mjs:463-468 — the pins are regexes on prose (`gates nothing`, `outside \`openspec/\``). They are brittle against rewording, but they do guard against the stale claim coming back. Optional.

### Summary
- 2 findings (0 blocking, 0 important, 2 nit) + 2 praise
- Justification: I read the range diff and the full `archiveNext` open-PR branch. The ADR 0003, design D10 and flow-doc wording now matches the code: the file-check exemptions are `openspec/changes/**` and `openspec/roadmap.md`, `devkit-reviews --ci` checks archive PRs, and the unreadable-retro/unarchived case is a stop. The ADR no longer says the check gates nothing, so the rationale no longer contradicts the diff. I did not re-run the suite and relied on the supplied result (381/381 green at 1286cfb). The earlier approval's findings are unaffected by this range.
