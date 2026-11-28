<!-- devkit-stage readiness result=passed attempt=1 commit=b7acf8f5042142eb9fcdd89dc96dbf1be40a5263 -->
# Readiness review: train-empty-failure-text

## Decision

- Status: APPROVED

Blockers: 0. An implementer can build every task without asking a question, and every acceptance
criterion (AC-1 to AC-6) has a task and a test or check that proves it.

## Validation

- `openspec validate train-empty-failure-text --strict`: valid.
- `python3 scripts/check.py` on the base: all checks passed. The own-files gate (`node scripts/test-suite.mjs --own-files`) is long and is left to the caller; no finding depends on it.
- `release.md` exists: `packs:` with `devkit-openspec: patch`, a `## <title>` line and a body. No task bumps a version, edits a CHANGELOG line or a CI pin, or numbers an ADR. `decisions.md` is `not-applicable` and the change has no ADR.
- `openspec/specs/` is unchanged against `origin/main` (task 1.5 holds).

## Scope

Classification: correct. The change touches only the `result: empty` end of `departTrain`, one message key in two tables, two test files and one doc sentence. Non-goals are explicit and match the requirements.

## Claims checked against the code

| Claim | Result |
|---|---|
| `outLeft` omits `failure` (`train-loop.mjs:338`); `leftOf` keeps `head` and `failure` (`:336`) | confirmed |
| Empty end at `:366-369` replies `train-nothing`; `passed` end writes and commits the record at `:396-404` | confirmed |
| Red entries carry `failure: found.output` (`:390`); conflict entries carry `failure: null` (`:328`) | confirmed |
| `lockFile` uses `rev-parse --path-format=absolute --git-common-dir` (`:153-156`) | confirmed |
| `nextNumber` (`:210`) and `underWay` (`:219`) would see a committed `train/<n>`, and a file outside the tree touches neither | confirmed |
| `writeTrainRecord` writes the Boarded header with no rows, `## Left` and `## Runs` only when they have rows, and `## Failure of` per non-null failure (`:75-95`) | confirmed |
| `mkdirSync`, `writeFileSync`, `dirname` and `join` are already imported (`:16-17`) | confirmed |
| `train-nothing` is at `change-loop.mjs:271` and `:575`; `train-running` already takes `{where}` | confirmed |
| `delivery-train.test.mjs:1708-1717` asserts `train-nothing` for the empty end; `CONFLICT_BASE` is at `:1720`; the `node:path` import is `join, dirname` (so `isAbsolute` must be added, as task 1.1 says) | confirmed |
| `delivery-train-after.test.mjs:178` key list and `:199-201` subsection list | confirmed |
| `docs/openspec-flow.md:749` is the "A red train." paragraph | confirmed |
| `change-loop.test.mjs` no-internal-term rules: D-5's two texts have no backtick, file name, `name=value`, option or hyphenated internal id | confirmed by reading the rules |
| `noScratch` checks only the scratch folder and its worktrees, so it holds with the new file | confirmed |
| `scripts/test-map.json` already maps both test files to `train-loop.mjs`, so no edit is needed | confirmed |
| The skill's Train section already says to say the `reply` of a `depart` that exits 1 or 2 | confirmed |

## Specs

The requirement uses SHALL and has three scenarios: red, conflict only, and a second empty departure. Every outcome of D-4 and D-5 has a scenario (result, record, reply, no branch, same number). No requirement lives only in support docs.

## Tasks

Tasks 1.1 to 1.6 are ordered tests-first and each has a concrete check. Every path is real. The AC-to-task table is complete. The gate command exists and is stated once.

## Omissions

- Write failure: D-4 says it is thrown and turned into exit 3 by `main`, as the `passed` end already does.
- Number reuse and overwrite: covered by T-1 (second departure) and the third scenario.
- Compatibility: `parseTrainRecord` never reads the file; the `passed` output is unchanged.
- Observability and rollback: stated (D-4, Migration Plan).

## Mandatory questions

1. Problem defined: yes. 2. Measurable: yes, by AC-1 to AC-6. 3. Error behavior: yes (exit 3 on a write error; the exit stays 1). 4. Edge cases: yes (conflict-only, reused number, backticks in a failure). 5. Dependencies: clear. 6. Contracts: the `left[].failure`, `record` and `train-empty` shapes are defined. 7. Two readings: none found, since the texts, names and assertions are literal in `design.md`. 8. Implicit decisions: none found. 9. Tasks deliver the outcome: yes. 10. Discovered too late: the T-2 conflict fixture may not conflict, and 1.1 sees it red first.

## Findings

No findings with severity Critical, High or Medium.

- Low, Fix during implementation: the Pinned rules table cites line numbers at the base, and these shift after edits. The implementer matches by name.
