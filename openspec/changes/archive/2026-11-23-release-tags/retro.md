<!-- devkit-stage retro result=passed attempt=1 commit=405a64319a66f26cd8b3c516c6feb47d0806875f -->
# Retro: release-tags

PR: #86, merged at 5d85f35; the tag v0.30.0 was pushed by the new step itself.

## What went wrong, how to do better, what to remember

1. Went wrong: round 1 of the review failed on four important findings, all about proof and not about the code. The ship-change row's safety clauses (the local-tag guard, the refused push) were pinned by no test, the `two-prs` filter had no fixture, the ADR did not record a limit the design already listed (R-3), and the new GitHub routes were proven only against hand-written fakes. Separately, implementer and reviewer agents ran whole suites in the foreground, hit their timeouts and left `node --test` processes running on the shared machine, and `accept-decisions` wrote a second `Status:` line into the accepted ADR.
2. Better next time: a change that reads a GitHub route for the first time records one live read of it in `evidence.md` at the verify step, not after the review asks; the plan's test table names a test for every prose clause that carries a safety claim; the full suite runs once, by the coordinator, in the background, and agents get filtered patterns.
3. Remember: proof for a new external read is a live read, not a fixture.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | A new GitHub route needs one recorded live read before the review | process-friction | doc-update | project |
| 2 | `accept-decisions` duplicates the `Status:` label in an ADR that uses a bulleted `- Status:` line | tooling | regression-gate | project |
| 3 | Agents that run whole suites time out and leave test processes behind | environment | memory-only | user |

## Proposed updates

### `CONTRIBUTING.md` (process-friction)
A change that makes the checker read a GitHub route it did not read before records one live read of each new route in its `evidence.md` at the verify step.
- before: the section on testing says nothing about proof for a new external read.
+ after: one sentence under the change checklist: "A change that reads a GitHub route for the first time records one read-only live call of it in evidence.md; a fake-gh fixture alone does not prove the route or the shape." Bump devkit-openspec's patch version only if the change also touches that pack.
- Answer: approved
- Applied: yes

### `plugins/openspec/hooks/change-loop.mjs`, `plugins/openspec/hooks/change-loop.test.mjs`, `docs/openspec-flow.md` (regression-gate)
`accept-decisions` writes the acceptance line with the status line's own prefix, so a record whose status is `- Status: proposed` ends with `- Status: accepted` followed by `- Status: Accepted by: ...`. Test-first: when the status line is a bulleted `- Status:` line, the acceptance line starts with `- Accepted by:`, as ADR 0017 and 0018 read; a status line without a label keeps today's prefix.
- before: the line after the accepted status is `- Status: Accepted by: the owner, on <date>, ...`.
+ after: the line is `- Accepted by: the owner, on <date>, ...`. The change needs a version bump of devkit-openspec (patch), its `.claude-plugin/marketplace.json` entry and a CHANGELOG line, and the test 'stage-roles loop: accept-decisions keeps the letter case and the prefix of the status line' changes with it.
- Answer: approved
- Applied: yes

### user memory (memory-only)
When a subagent runs a whole devkit suite in the foreground it hits its timeout and leaves `node --test` processes running; give subagents filtered `--test-name-pattern` runs and run the roughly 19 minute guard gate once, as a background command, from the coordinator.
- Answer: approved
- Applied: yes
