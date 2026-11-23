<!-- devkit-stage evidence result=passed attempt=4 commit=bf77a9fb28d04c2df0f8653d5710f21ef02624a8 -->
Commit: bf77a9fb28d04c2df0f8653d5710f21ef02624a8

# Evidence

Change: `change-budget`. Verified at the commit above (the third merge of origin/main into the branch; release is devkit-openspec 0.25.0, marketplace 0.29.0), with a clean tree. Surface touched: hook scripts, docs and release metadata
(no API, UI or deploy), so the proof is the gate commands and the tests, run with `TMPDIR=/var/tmp`.

## Verification

### Gates

| Gate | Command | Result |
|---|---|---|
| 1.5 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^change-budget" --test-name-pattern="^change-loop lock" plugins/openspec/hooks/change-loop.test.mjs` | pass: re-run by the verifier at this commit, 92 tests, 92 pass, 0 fail, exit 0 |
| 1.5 | `python3 scripts/check.py` | pass: re-run by the verifier at this commit, "all checks passed" |
| 2.7 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^change-budget" --test-name-pattern="^change-loop" --test-name-pattern="^roadmap-loop" plugins/openspec/hooks/guard.test.mjs` | pass: the verifier ran the same patterns on change-loop.test.mjs and roadmap-loop.test.mjs at this commit, exit 0 (count not captured); the guard.test.mjs entry also ran inside the full suite of gate 3.2 by the coordinator |
| 2.7 | `python3 scripts/check.py` | pass: re-run by the verifier at this commit, "all checks passed" |
| 3.2 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs` | pass: not re-run by the verifier (13 to 21 minutes); the coordinator ran it at this commit with TMPDIR=/var/tmp, 1754 tests, 1754 pass, 0 fail |
| 3.2 | `python3 scripts/check.py` | pass: re-run by the verifier at this commit, "all checks passed" |
| 3.2 | `python3 scripts/gen-catalog.py --check` | pass: re-run by the verifier at this commit, exit 0 |
| 3.2 | `command claude plugin validate .` | pass: re-run by the verifier at this commit, "Validation passed" |
| 3.2 | `openspec validate change-budget --strict` | pass: re-run by the verifier at this commit, "Change 'change-budget' is valid" |

### Acceptance criteria

All proofs are tests in `plugins/openspec/hooks/change-loop.test.mjs` whose names start
`change-budget AC-<n> `; they are inside the 92-test run of gate 1.5 and the full suite of gate 3.2.
Test counts per criterion are the number of such test definitions found at this commit.

| Id | Criterion | Proof | Result |
|---|---|---|---|
| AC-1 | stop-at-cap | 8 `change-budget AC-1` tests (decision and `next` end `waiting-for-owner`, marker printed; the budget end waits with its gate phrase, as an end and as a declared wait) | pass |
| AC-2 | stop-message-says-how | 1 `change-budget AC-2` test over the reply in `pt-BR` and `en` (spent, cap, file and key, resume) | pass |
| AC-3 | under-cap-unchanged | 1 `change-budget AC-3` test (same action as with no cap) | pass |
| AC-4 | no-cap-unchanged | 5 `change-budget AC-4` tests, plus the existing `change-loop` tests passing unchanged in gates 2.7 and 3.2 | pass |
| AC-5 | change-overrides-project | 5 `change-budget AC-5` tests (change value wins; another change keeps the project's) | pass |
| AC-6 | raised-cap-resumes | 2 `change-budget AC-6` tests (the held hand-off returns once the cap is raised) | pass |
| AC-7 | count-rule | 8 `change-budget AC-7` tests with fixtures of known numbers (exact sum, cache reads left out, subagents after the first run line) | pass |
| AC-8 | invalid-cap-refused | 5 `change-budget AC-8` tests (settings-error reply naming key and value) | pass |
| AC-9 | unreadable-transcript-passes | 6 `change-budget AC-9` tests (lookup and count fail open) | pass |
| AC-10 | documented | 1 `change-budget AC-10` test; `docs/openspec-flow.md` has the setting and override, the count, the stop and the resume (paragraph "The token budget.", two Troubleshooting rows, Cost bullet) | pass |

Not proved here: the live half of AC-1, AC-2 and AC-6 in a real run (task "Dogfood" in the workflow
follow-up of `tasks.md`); this change proves them on fixtures.
