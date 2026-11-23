<!-- devkit-stage evidence result=passed attempt=1 commit=52fb4faab60c31831cbeeb138b5e340f9df76392 -->
Commit: 52fb4faab60c31831cbeeb138b5e340f9df76392

# Evidence

Change: `commit-attribution` · Verified at HEAD `52fb4fa` on branch `commit-attribution` (clean tree).

## Verification

### Gates

| Gate | Command | Result |
|---|---|---|
| 1.6 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^commit-attribution" --test-name-pattern="^change-loop" --test-name-pattern="^project-loop" --test-name-pattern="^roadmap-loop skill" --test-name-pattern="^format:" plugins/openspec/hooks/guard.test.mjs` | pass: re-run at this commit, 372 tests, 372 pass, 0 fail, exit 0 |
| 1.6 | `python3 scripts/check.py` | pass: all checks passed, exit 0 |
| 2.5 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs` | pass: whole suite, 1423 tests, 1423 pass, 0 fail; read from the coordinating session's log `/var/tmp/ca-gate2.log` (written 34 s before the HEAD commit, same tree), not re-run by the verifier |
| 2.5 | `python3 scripts/check.py` | pass: all checks passed, exit 0 |
| 2.5 | `python3 scripts/gen-catalog.py --check` | pass: exit 0 |
| 2.5 | `command claude plugin validate .` | pass: Validation passed, exit 0 |
| 2.5 | `openspec validate commit-attribution --strict` | pass: change is valid, exit 0 |
| 2.5 | `grep -qx "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" openspec/changes/commit-attribution/proof/ac3-trailers.txt` | pass: exit 0 |
| 2.5 | `test "$(grep -c . openspec/changes/commit-attribution/proof/ac3-trailers.txt)" = 1` | pass: exit 0 |
| 2.5 | `grep -q "devkit-core:commit-and-pr" openspec/changes/commit-attribution/proof/ac3-run.jsonl` | pass: exit 0 (14 lines name the agent) |

### Acceptance criteria

| Id | Criterion | Proof | Result |
|---|---|---|---|
| AC-1 | `brief-carries-lines`: every commit-agent hand-off of both loops and every dispatch row of `ship-change` and `devkit` carries the request; a test fails when one lacks it | 36 tests named `commit-attribution AC-` (T1 to T36) are in the whole-suite log, all pass; the 372-test focused run at this commit passes; `grep -c "appends below this brief" plugins/openspec/hooks/project-loop.mjs` prints 0 (one copy of the text) | pass |
| AC-2 | `agent-prefers-brief`: `commit-and-pr.md` says the brief's lines win; given lines it writes exactly those, given none it writes none | Tests T26 to T32 on `plugins/core/agents/commit-and-pr.md` pass in the same runs; behaviour shown by AC-3 | pass |
| AC-3 | one real run of the commit agent in a scratch project makes a commit with exactly the Opus trailer and no Sonnet line | `openspec/changes/commit-attribution/proof/ac3-trailers.txt` holds one non-empty line, `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; `ac3-message.txt` is the full message, ending with that line, 0 mentions of Sonnet; `ac3-run.jsonl` holds the Agent call to `devkit-core:commit-and-pr` | pass |
| AC-4 | every commit of the branch by the commit agent ends with the session's trailer | `git log --no-merges --format='%h %s%n%(trailers:key=Co-Authored-By)' "$(git merge-base origin/main HEAD)..HEAD"` at HEAD lists 52fb4fa and 4ae67c9, each with exactly `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and no Sonnet line | pass |

No UI, API or deploy surface is touched; no screenshots apply. The evidence commit itself, if made, is checked again in the retro (D-9).
