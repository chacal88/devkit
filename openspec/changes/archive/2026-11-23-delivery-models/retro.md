<!-- devkit-stage retro result=passed attempt=1 commit=bd0f7929f604e5657b721f69a34f71ece504002c -->
## Retro: delivery-models

1. Went wrong: the change ran for about a day while six sibling changes released to main. It merged origin/main three times. Each merge re-numbered its ADR (planned 0015, written 0017, delivered 0018) or moved its release (0.22.0, 0.25.0, then 0.28.0), and made the evidence and every review stale. The re-verification ran every gate part apart, about three and a half hours, although the whole guard suite imports them all. Implementers left `pgrep -f` wait loops that matched their own shell and never ended: 13 were stopped by hand. Review round 1 confirmed a row-order bug: a closed test-branch pull request was blocked only after the rows that open, push or edit. The design's own table put the blocked row there, against its own "no write" sentence.
2. Better next time: a plan names its ADR number and its versions as "the next free ones on origin/main at the last merge before review", never as literals. A suite longer than two minutes runs with the Bash tool's background option and its completion notice, never in a polling loop. A whole-suite run that imports every gate's files may stand for those gate parts in the evidence. A blocked row goes before every row that writes.
3. Remember: a long change pays for each sibling release with a merge, a renumber and a stale review; fix numbers last.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | ADR numbers and release versions written as literals in the plan collide with sibling releases | process-friction | rule | project |
| 2 | `pgrep -f` polling loops match their own shell and never end | tooling | doc-update | project |
| 3 | Re-verifying each gate part apart repeats the whole suite's work after every merge | process-friction | doc-update | project |
| 4 | A blocked row placed after rows that write lets the run write before it stops | bug-class | memory-only | user |

## Proposed updates


### `openspec/config.yaml` (process-friction)
Plans name the ADR number and the release versions by rule, not by value, so sibling releases cost no renumbering.
- before:     - Every acceptance criterion id appears in at least one task
+ after:     - Every acceptance criterion id appears in at least one task
+ after:     - A task that writes an ADR or bumps a version names "the next free number on origin/main at the last merge before review", never a literal number or version
- Answer: approved
- Applied: yes

### `plugins/core/agents/tdd-implementer.md` (tooling)
Long suites run in the background with a completion notice; polling loops are banned because a `pgrep -f` loop matches its own shell.
- before: 1. Run the touched surfaces' suites with the repo's real commands (from `CLAUDE.md`, `package.json` scripts, `Makefile`, CI config; never invent one). Report the exact command and its output in the Validation section of your return.
+ after: 1. Run the touched surfaces' suites with the repo's real commands (from `CLAUDE.md`, `package.json` scripts, `Makefile`, CI config; never invent one). Report the exact command and its output in the Validation section of your return. Run a suite longer than two minutes with the Bash tool's background option and wait for its completion notice; never wait with an `until`/`while … sleep` loop or `pgrep -f` (it matches its own shell and never ends), and leave nothing running when you return.
- Answer: approved
- Applied: yes

### `plugins/core/agents/pr-verifier.md` (process-friction)
One whole-suite run may stand for the gate parts whose test files it imports, instead of re-running each part apart.
- before: - Run the check command for the touched surfaces and keep its summary (pass/fail per gate). Each gate runs as its own command and its exit code decides; no `| tail`, `; echo $?` or `|| true` masking it.
+ after: - Run the check command for the touched surfaces and keep its summary (pass/fail per gate). Each gate runs as its own command and its exit code decides; no `| tail`, `; echo $?` or `|| true` masking it. When the project's whole-suite command imports every test file a gate part names, one green whole-suite run in this verification may stand for those parts: say so in their rows.
- Answer: approved
- Applied: yes

### user memory (memory-only)
In a step table, a blocked row goes before every row that opens, pushes or edits; check the row order against the design's "no write" sentence.
- Answer: approved
- Applied: yes
