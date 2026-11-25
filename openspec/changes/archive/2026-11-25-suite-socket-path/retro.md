<!-- devkit-stage retro result=passed attempt=1 commit=e4d5041176c109ec8118083fb766e8acaec06696 -->
## Retro: suite-socket-path

1. Went wrong:
   - The defect itself: the suite-speed change proved its suite with `env TMPDIR=/var/tmp/...`, a short root, so the default macOS `TMPDIR` (56 bytes) was never run and 32 daemon tests failed on every default Mac from the day it merged. The CI runner (Linux, `/tmp`) could not see it either.
   - The grill's byte counts (60/79/111) were worked out by hand and were 4 over the machine's real path (56/76/108); the planner measured and corrected them. The conclusion did not change, but the review reads the plan's numbers as claims.
   - The design exported a byte helper (`runRootFits`) for the tests while `tryRunRoot` kept its own inline arithmetic, so the byte test guarded nothing in production; the review bench caught it (two important findings), one fix commit and a second round followed.
   - The grill wrote a criterion only CI on the pull request can prove (the former AC-5); the delivery check held the change on it (`no proof ... the owner weighs it`) and the plan had to move it to the Workflow follow-up after the review passed.
   - Three whole-suite gate runs each failed one different `--watch` timing test (50 ms windows) while other sessions' suites, Docker and vitest pushed the load average to 28, 126 and 40; each file passed alone, and the only clean run was on a quiet machine (load 5 to 16). Two of the three runs were wasted.
2. Better next time:
   - A change on the suite script, the fixtures or `test-tmp.mjs` runs the whole suite once with no `TMPDIR` override, in the machine's default environment, before its first review: a gate proves the environment it ran in, not another.
   - Measure a path length on the machine (`Buffer.byteLength(realpathSync(tmpdir()))`) instead of counting characters by hand, and write the measured number in the plan.
   - When the design exports a predicate for the tests, production decides through that same export; the reviewer's question "does the runtime call the function the test pins?" is worth asking before the round.
   - A criterion that only the pull request's CI can prove is a Workflow follow-up from the grill on (devkit-core 0.16.1 already says so; the grill of this change was run before that rule reached the session's skills).
   - Before a whole-suite gate, check `uptime` and that no other suite runs; under load, a lone `--watch` failure is a flake to re-run alone, not a regression, and the gate run is repeated once the machine is quiet.
3. Remember: a test gate proves only the environment it ran in; run a harness change once with the machine's defaults.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | The suite's gate was run with a short `TMPDIR` override, so the default macOS layout was never exercised | process-friction | doc-update | project |
| 2 | `--watch` timing tests fail one at a time when the load average is above about 25; the whole-suite gate needs a quiet machine | environment | doc-update | project |
| 3 | A byte helper exported for the tests must be the one production calls | bug-class | memory-only | user |
| 4 | A criterion only the pull request's CI can prove belongs to the Workflow follow-up, never to the acceptance criteria | process-friction | memory-only | user |

## Proposed updates

### `CONTRIBUTING.md` (process-friction)
A change to `scripts/test-suite.mjs`, a fixtures module or `test-tmp.mjs` proves itself once in the machine's default environment.
- before: ...and before the first push run a new or changed test file with `node scripts/test-suite.mjs <file>`.
+ after: ...and before the first push run a new or changed test file with `node scripts/test-suite.mjs <file>`. A change to `scripts/test-suite.mjs`, to a fixtures module or to `test-tmp.mjs` also runs the whole suite once with no `TMPDIR` override, in the machine's default environment, before its first review round: a gate proves only the environment it ran in (the suite-speed change was proven under `env TMPDIR=/var/tmp/...` and failed 32 tests on every default Mac).
- Answer: approved
- Applied: yes

### `CONTRIBUTING.md` (environment)
A whole-suite gate is run on a quiet machine, and a lone `--watch` timing failure under load is re-run alone before it counts.
- before: The whole run takes about 10 minutes on an idle 8-core machine; 9:36 observed on a9babd2.
+ after: The whole run takes about 10 minutes on an idle 8-core machine; 9:36 observed on a9babd2. Run a whole-suite gate with no other suite on the machine and a load average under about 20 (`uptime`): the `--watch` tests of `conduct-check` and `deliver-check-cli` give the watch windows of 10 to 50 ms and fail one at a time under load. A single such failure under load is re-run alone with `node scripts/test-suite.mjs <file>`; the gate counts once the whole run is green on a quiet machine.
- Answer: approved
- Applied: yes

### user memory (memory-only)
A predicate exported for the tests is the one production calls; before a review round, check that the runtime reaches the function the test pins.
- Answer: approved
- Applied: yes

### user memory (memory-only)
A criterion only the pull request's CI can prove goes to the plan's Workflow follow-up from the grill on, never to the acceptance criteria: the delivery check holds a change on a `no proof` row.
- Answer: approved
- Applied: yes
