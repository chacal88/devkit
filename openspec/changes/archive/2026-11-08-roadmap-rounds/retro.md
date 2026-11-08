## Retro: roadmap-rounds

1. Went wrong: the archived-state check matched archive folders by suffix (`csv-export` reported archived when `add-csv-export` was), and the tests only used the exact id, so 24/24 was green with the bug in. The error path the proposal promised (a broken roadmap never breaks the hook) had no test that actually reached it. The doc's state table did not say which state wins.
2. Better next time: when matching ids against names on disk, write the decoy test first (an id that is a suffix/prefix of another). For every "never fails" claim, add one test that forces the throw. The repo itself had no `openspec/`, so the change had to start by adopting OpenSpec mid-flow.
3. Remember: name matching needs a decoy test; "never fails" needs a test that makes it fail.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | Suffix match on archive folder names gave a false state | bug-class | regression-gate (done: test "archived means the exact id...") | project |
| 2 | try/catch around the roadmap report was never exercised | bug-class | regression-gate (done: test "an unreadable roadmap...") | project |
| 3 | Precedence between states undocumented | doc-gap | doc-update (done in the PR) | project |
| 4 | CONTRIBUTING does not say this repo's own changes go through `openspec/changes/` | doc-gap | doc-update (proposed below) | project |
| 5 | Decoy test for name matching; forced-error test for "never fails" claims | process-friction | memory-only | user |

## Proposed updates

### CONTRIBUTING.md (doc-gap)
Say that changes to devkit itself use its own flow.
- before: `## Adding or changing an asset` starts directly with the conventions step.
+ after: a short section before it:
  `## How changes are made here` — "This repo uses its own flow: open a change with `openspec new change <id>` (devkit-lite by default; `--schema devkit` for the cases in docs/openspec-flow.md), name the branch after it, and let the hooks gate the PR. `openspec/roadmap.md`, when present, lists the rounds."

### user memory (memory-only)
"When code matches ids against names on disk, test a decoy (suffix/prefix collision); a 'never throws' claim needs a test that forces the throw."
