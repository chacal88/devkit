<!-- devkit-stage evidence result=passed attempt=1 commit=0637603bc47cf3382a7b2d09bd7fc2fb8b5881b3 -->
Commit: 0637603bc47cf3382a7b2d09bd7fc2fb8b5881b3

# Evidence

Change: `jira-entry` · verified on branch `jira-entry` with `TMPDIR=/var/tmp`. Every Jira task and connector answer in the tests is a fake JSON object; no real Jira was called (AC-9).

## Verification

### Gates

| Gate | Command | Result |
|---|---|---|
| 1.3 | `env TMPDIR=/var/tmp node --test plugins/openspec/hooks/jira-task.test.mjs` | pass: 18 tests, 18 pass, 0 fail |
| 1.3 | `python3 scripts/check.py` | pass: all checks passed |
| 2.4, 3.4 | `env TMPDIR=/var/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/jira-task.test.mjs` | pass: 782 tests, 782 pass, 0 fail |
| 4.6 | `env TMPDIR=/var/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs` | pass: 1439 tests, 1439 pass, 0 fail (about 28 minutes under load) |
| 4.6 | `python3 scripts/gen-catalog.py --check` | pass: exit 0 |
| 4.6 | `command claude plugin validate .` | pass: validation passed |
| 4.6 | `openspec validate jira-entry --strict` | pass: change is valid |

### Acceptance criteria

Counts of tests named `jira-entry AC-<n>` in `plugins/openspec/hooks/*.test.mjs` at this commit, all inside the green suites above.

| Id | Criterion | Proof | Result |
|---|---|---|---|
| AC-1 | key opens from task | 12 `jira-entry AC-1` tests (start mode `task`, `open --task`, skill text) in `change-loop.test.mjs` and `jira-task.test.mjs` | pass |
| AC-2 | link same as key | 2 `jira-entry AC-2` tests (browse and board links) | pass |
| AC-3 | no connector or unreadable task asks for text | 3 `jira-entry AC-3` tests (replies in both languages, open refuses unreadable answers) | pass |
| AC-4 | grill skips answered points | 3 `jira-entry AC-4` tests (next hands the grill, both skill texts) | pass |
| AC-5 | key resumes its unfinished change | 7 `jira-entry AC-5` tests (resume for key and link, task-taken refusal, archived key is new) | pass |
| AC-6 | write-back asked once | 11 `jira-entry AC-6` tests (next, write-back ask, record, no change of decisions) | pass |
| AC-7 | write only on yes | 8 `jira-entry AC-7` tests (transition, only comment, no, after archive, language) | pass |
| AC-8 | free text unchanged | 3 `jira-entry AC-8` tests plus every existing `change-loop start:` and `open:` test unchanged | pass |
| AC-9 | fakes only | 1 `jira-entry AC-9` source test: no network import or `fetch(` in `jira-task.mjs` and `change-loop.mjs`; all answers are fake JSON | pass |
| AC-10 | live-proof follow-up | 1 `jira-entry AC-10` test: roadmap line `jira-entry-live (after: jira-entry)` read by `guard.mjs#readRoadmap` | pass |

Also 1 `jira-entry docs:` test for the flow document, the design document and ADR 0010.

No UI, API server or deploy surface is touched; no screenshots apply.
