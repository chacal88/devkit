<!-- devkit-stage retro result=passed attempt=1 commit=2c26acb0661f6ef7bbdb178d56f28b68d6f8a69b -->
## Retro: post-merge-validate

1. Went wrong: the plan, its readiness review and 21 tests all wrote the check as `openspec validate <id> --strict`. None of them caught that a change sharing its id with a canonical spec gets `ambiguous_item` and is read as cannot-run. The code review caught it in round 1. The round-1 fix changed only the call, not the planner brief, the plan or the docs, so round 2 rejected it again. A third pass needed the owner's own word. Separately, the real-run proof streams carried the owner's home path, MCP server names and tool lists toward a public repository, and they were redacted by hand before the first commit. Main also moved four times under the change (suite-speed's test split, stale-only-on-own-files' release numbers, the train switch, archive-release-pin), and each move cost a merge, a renumber and a refresh of the evidence and reviews.
2. Better next time: always run the openspec CLI on a named item with its `--type`. When a review fix changes a literal command, change every copy of it in the same commit (code, agent brief, plan, docs, tests). Strip a real-run stream to the plugin lines the proof reads before it is written to the change folder.
3. Remember: a review fix that changes a literal must change all of its copies, or the next round rejects the partial fix.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | `openspec validate <id>` is ambiguous when a change and a canonical spec share the id; other agents and skills of the kit still call it without `--type change` | bug-class | followup | project |
| 2 | Real-run proof streams (`claude -p --output-format stream-json`) carry the machine's home path and its MCP and tool lists; nothing redacts or refuses them before they reach a public repository | tooling | followup | project |
| 3 | The ADR 0017 Note of this change still reads "status: proposed" and names the bare command, though the plan approval accepted it and the loop runs `--type change` | doc-gap | doc-update | project |
| 4 | A review fix that changes a literal command left its copies in the brief, plan and docs, and cost a third review pass | process-friction | memory-only | user |

## Proposed updates

### `openspec/roadmap.md` (followup)
Add a change that passes `--type change` (or `--type spec`) wherever the kit runs the openspec CLI on one named item, so a change that shares its id with a canonical spec is never ambiguous.
- before: ## Round 28j: private temp folders in tests
+ after: ## Round 28k: the openspec CLI by item type
+ after: - [ ] openspec-type-flag (after: post-merge-validate) — `openspec validate <id> --strict` answers `ambiguous_item` when a change and a canonical spec share the id (post-merge-validate review, reproduced in a scratch repository; seven archived ids of this repository equal spec names). `change-loop.mjs merge-check` now passes `--type change`, but `plugins/core/agents/plan-readiness-reviewer.md` (step 3), `plugins/core/agents/change-planner.md`, `plugins/openspec/agents/openspec-validator.md` and the CompozyOS templates still run the bare form. Pass the item's type in each, with a test of a change and a spec of the same name.
- Answer: approved
- Applied: yes

### `openspec/roadmap.md` (followup)
Add a change that keeps a real-run proof stream from carrying the machine's private setup into the repository.
- before: ## Round 28j: private temp folders in tests
+ after: ## Round 28l: redacted real-run proofs
+ after: - [ ] proof-stream-redaction (after: post-merge-validate) — the real-run streams of post-merge-validate (`proof/real-run-*.jsonl`) carried the owner's home path, every MCP server name and the tool lists of the session, and were redacted by hand before the first commit. Give the real-run recipe one helper that keeps only what the proof reads (the devkit plugin lines of the init event, the Agent and Bash calls, the loop's lines) and writes the home folder as `/home/<user>`, and make `scripts/check.py` refuse a `proof/*.jsonl` that holds a home path or an init event with `mcp_servers`.
- Answer: approved
- Applied: yes

### `docs/adr/0017-a-change-state-is-derived-in-one-place.md` (doc-update)
The Note of post-merge-validate keeps a status clause that nothing will flip, and names the command without the `--type change` the loop runs.
- before: Note (post-merge-validate, 2026-11-23, status: proposed; the owner's approval of the change's plan
- before: accepts it): decision 1 gains one input, the merge-check record
+ after: Note (post-merge-validate, 2026-11-23, accepted with the change's plan): decision 1 gains one
+ after: input, the merge-check record
- before: come. It is a fact, not stored state: it holds what `openspec validate <id> --strict` answered for one
+ after: come. It is a fact, not stored state: it holds what `openspec validate <id> --type change --strict` answered for one
- Answer: approved
- Applied: yes

### user memory (memory-only)
When a review fix changes a literal command or sentence, grep for every copy (code, agent brief, plan, docs, tests) and change them all in the same commit.
- Answer: approved
- Applied: yes
