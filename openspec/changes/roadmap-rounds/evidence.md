# Evidence

Verified on the uncommitted worktree (no PR yet). Scratch repos built under the session scratchpad (`.../scratchpad/r/`), each with `git init`, `openspec/changes/<ids>`, `openspec/changes/archive/2026-01-01-<id>` and a `roadmap.md`. Baseline for "today's output" is `git show HEAD:plugins/openspec/hooks/guard.mjs`.

## Verification

### Gates

| Gate | Command | Result |
|---|---|---|
| Hook tests | `node --test plugins/openspec/hooks/guard.test.mjs` | pass: tests 26, pass 26, fail 0 (exit 0) |
| Repo check | `python3 scripts/check.py` | pass: `all checks passed` (exit 0) |
| Plugin validation | `claude plugin validate .` | pass: `Validation passed` (exit 0) |

### Acceptance criteria

| Criterion | Command | Observed | Result |
|---|---|---|---|
| AC-1, one active change | `echo '{"cwd":"<scratch>/one"}' \| node plugins/openspec/hooks/guard.mjs session` (round 1: `auth-scopes` ticked, `old-done` unticked and only in `archive/2026-01-01-old-done`) | Change report, then `[devkit] Roadmap: Round 1: auth (1/2 done). Pending:` / `  - old-done: archived, tick it`. Exit 0. | pass |
| AC-1, several active | same, `changes/{add-csv-export,other-x}` | `[devkit] Open OpenSpec changes: add-csv-export, other-x. ...` followed by the same Roadmap block. Exit 0. | pass |
| AC-1, none active | same, no change folders | Only the Roadmap block. Exit 0. | pass |
| AC-1, `waiting on` / `not started` | roadmap `## R2` with `a (after: b)`, `b`, no folders | `Roadmap: R2 (1/3 done)`, `a: waiting on b`, `b: not started` | pass |
| AC-1, `open` | `op/` repo, folders `add-csv-export`, `export-audit-log`, roadmap `add-csv-export (after: auth-scopes)` (ticked), `export-audit-log`, `third` | `Round 2 (1/4 done)`, `add-csv-export: open`, `export-audit-log: open`, `third: not started` | pass |
| AC-2, no roadmap is byte-identical | session on `nor/` with new hook vs HEAD hook, output files compared with `cmp` | `IDENTICAL` (exit 0) | pass |
| AC-2, all ticked adds one line | `done/` repo, roadmap all `[x]`; `diff old new` | `13a14 > [devkit] Roadmap: all rounds done.` (only one added line). Without any change: just that line. | pass |
| AC-3, edit/bash/ci unchanged | `edit`, `bash` (`git commit -m x`), `ci` on twin repos with and without `roadmap.md`; stdout, stderr and exit code compared | `edit SAME rc=0`, `bash SAME rc=0`, `ci SAME rc=1` (rc 1 is the pre-existing "review not approved" gate, identical in both) | pass |
| AC-3, malformed roadmap | session on `mal/` (junk, item before any round, empty heading, `[?]`, NUL/0xff bytes, unknown id, empty `after:`); also a roadmap with no rounds; also `roadmap.md` as a directory | All exit 0. `mal/`: Roadmap block `Empty (0/1 done)`, `unknown-id: waiting on nope`. No-rounds and directory cases: change report only, no Roadmap block. `ci` on `mal/` exit 1 with the same message as the baseline hook. | pass |
| AC-4, documented format and states | read `docs/openspec-flow.md` | Section "Grouping changes: the roadmap" at line 109: format example (lines 113-122), rules (124-125), states table for `not started`, `open`, `waiting on <ids>`, `archived, tick it` (128-133), non-gating note (136). Line 105 links to it. | pass |
| AC-4, README hook row | read `plugins/openspec/README.md` | Line 28: Session start row now mentions `openspec/roadmap.md`, current round, pending state, "report only, never a gate". | pass |
| AC-4, setup template archive guidance | read `plugins/openspec/skills/openspec-setup/templates/config.yaml` | Line 41: `If openspec/roadmap.md lists the change, tick its line after archiving`. | pass |

### Notes (not defects)

- The proposal says the hook never writes the file; confirmed by reading the diff (`readRoadmap` only uses `existsSync` and `readFileSync`).
- State precedence in the code is `archived, tick it`, then `waiting on`, then `open` / `not started`. A change that is both waiting and open reports `waiting on` (pinned by a test). The proposal lists the states without an order; the doc table does not mention this precedence.
- The repo's own `openspec/` has no `roadmap.md`, so the feature was not exercised against it; scratch repos only.
- Not exercised: UI, API, deploy (none touched).

## Outcome

verified: all four acceptance criteria have direct proof, all three gates pass, no defect found.
