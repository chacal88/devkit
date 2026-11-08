## Retro: ship-modes

1. Went wrong: the checker's parsers trusted their own fixtures. The gate parser took any task that mentioned `Gate:` as a gate, so task 1.6 (which describes the rule) produced the command `and split on`; 151/151 was green until `deliver-check` ran on this very change. The AC-3 readiness stop, the one human gate the change promises to keep, was tested only from a hand-built state, never through `collectState`. The `Commit:` placement was a cross-pack contract written two ways ("near the top" in `pr-verifier.md`, "before the first heading" in the parser) and only real use exposed it. Reviewers, running the installed 0.2.0 agents, wrote dispositions as free prose, so item 3 stayed open until they were rewritten in the parseable form. `commit-and-pr` pushed without the re-review files; item 5 caught it.
2. Better next time: run a new checker on its own change before calling a phase gate green. For every gate or stop the plan names as human, keep one test that goes through the real collector, not a synthetic state. When one pack parses another pack's output, state the format once with its exact position and pin it with a test on the producer's text. When a change edits agent formats, tell each dispatched agent to follow the repo's agent file, since the installed plugins lag until the release is installed.
3. Remember: a checker is proven on real input, starting with its own change.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | Gate detection matched `Gate:` anywhere in a task line | bug-class | regression-gate (done: `parseTasks` mid-sentence `Gate:` test) | project |
| 2 | AC-3 stop tested only from a hand-built state | bug-class | regression-gate (done: `devkitRepo()` AC-3 tests through `collectState` and the CLI) | project |
| 3 | `Commit:` position stated differently by producer and parser | doc-gap | regression-gate (done: format tests on `pr-verifier.md` and the six reviewers) | project |
| 4 | Item 7 counted any GitHub user's comment as work | bug-class | regression-gate (done: `authorAssociation` tests) | project |
| 5 | Agents dispatched inside a change that edits their own format follow the installed version | process-friction | doc-update (proposed below) | project |
| 6 | Installed devkit plugins are 0.2.0 while the repo ships 0.4.0 / 0.3.0 | environment | followup: update the installed plugins | user |
| 7 | Smoke-run a new checker on its own change before the gate | process-friction | memory-only | user |
| 8 | CI `reviewConsensus` and `deliver-check` disagree on staleness | project-rule | followup: recorded in `openspec/roadmap.md` round 2 | project |

## Proposed updates

### CONTRIBUTING.md (process-friction)
Under "How changes are made here", add one sentence for changes that edit agents.
- before: the section ends after the roadmap sentence.
+ after: "When a change edits an agent's output format, dispatch that change's agents with the repo's `plugins/<pack>/agents/<name>.md` as the format source: the installed plugins follow the old format until the release is installed."

### user memory (memory-only)
"A new checker or parser is only proven on real input: run it on its own change before calling the gate green."
