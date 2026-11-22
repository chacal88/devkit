<!-- devkit-stage retro result=passed attempt=1 commit=bf7e32b8a503b81c785d8d691f43007b98afa84d -->
## Retro: review-writer-prompt

1. Went wrong:
   - Review round 1 found a defect that the plan had not decided. The plan moved `fencedLines` into `deliver-check.mjs` unchanged, but an unclosed fence hid every later task and gate, so the tasks item could pass with open work. Six of six verifiers confirmed it. The plan was revised (the owner chose that an unclosed fence hides nothing), the readiness review and the approval ran again, and round 2 passed.
   - All five stage-1 answers of round 1 were partial: each listed files of its remit as not read (truncated diffs, test bodies judged from their titles), so each was sent back by hand before the verify stage, the spec reviewer twice. The installed round script (devkit-core 0.8.1) has neither the `read`/`notRead` rule nor the writer prompt that this change adds, so the session also built every writer prompt from the exported `writerPrompt` rule.
   - The first gate of phase 1 failed on the session's own `approval.md`. `scripts/check.py` refused the owner's Portuguese words quoted as prose, and the quote had to be wrapped in backticks.
   - The owner's Linux worker ran out of `/tmp` inodes four times. The hook suites leave their fixture folders behind (about 230,000 inodes for deliver-check plus flow-check, about 200,000 for the guard suite), and three sessions ran suites at once. Gates went red for no defect (572 of 994 tests) until the folders were deleted. The coordinating session then set the rule: run every suite with `TMPDIR=/var/tmp` and delete nothing by age.
   - Main moved three times while PR 56 waited (PRs 47 and 51, then 55, then 57). Each time the PR conflicted in the release files and in shared hooks (`deliver-check.mjs` `staleness()`, `flow-check.mjs`, `reviewerPrompt`). Two rebases and two force-pushes followed, each with a full evidence run and a stale-only review of the five reviewers. Once, the loop's `update-branch` step said the base "merges cleanly" while a fresh `origin/main` conflicted: the loop judged with an `origin/main` that was not fetched.
2. Better next time:
   - At readiness, ask what a moved or new parser does with unterminated input: an unclosed fence, a missing closing line, an empty file.
   - Quote the owner's words in `approval.md` inside backticks from the start.
   - Run test suites with `TMPDIR=/var/tmp` on the Linux worker.
   - Once a change's PR is in delivery, the coordinator holds other changes' merges that touch the same packs until it lands, as it did here from the third conflict on.
   - Pass long generated prompts to subagents as a file to read, not retyped. This worked well for every writer and stage-1 prompt in this change.
3. Remember: a PR that waits while other changes of the same packs merge pays a rebase, an evidence run and a review each time.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | A moved parser's unterminated-input case (unclosed fence) was undecided in the plan and found only in review | bug-class | memory-only | project |
| 2 | The owner's words quoted as prose in `approval.md` fail `scripts/check.py` when they are not English | process-friction | doc-update (proposal 1) | project |
| 3 | The delivery loop judged a conflict against an unfetched `origin/main`; parallel changes merging into the same packs cost a PR three conflicts | tooling | followup (proposal 2) | project |
| 4 | Hook test suites fill a tmpfs `/tmp`; runs on the Linux worker use `TMPDIR=/var/tmp` | environment | followup (already the roadmap line `test-fixture-cleanup`, round 17g) | project |
| 5 | The installed round script gave no writer prompt and accepted partial stage-1 answers | tooling | none: this change fixes both, from devkit-core 0.9.0 | project |

## Proposed updates

### `plugins/openspec/skills/ship-change/SKILL.md`, `docs/openspec-flow.md`, `plugins/openspec/hooks/change-loop.test.mjs` (process-friction)
The plan approval record quotes the owner's words in backticks, so `scripts/check.py` never reads them as prose in another language.
- before: `` and `- Owner's words: "<the owner's message, up to 200 characters>"`. ``
+ after: `` and `- Owner's words: "`<the owner's message, up to 200 characters>`"` (the words inside backticks, so the language check of `scripts/check.py` skips them). ``
The version bump of devkit-openspec that this edit needs moves the CI pin in `docs/openspec-flow.md` to v0.21.1 and its assertion in `change-loop.test.mjs`; the owner approved naming both here on 2026-11-22.
- Answer: approved
- Applied: yes

### `openspec/roadmap.md` (tooling)
Two follow-ups from the delivery of this change, added as a new round after round 17g.
- before: (round 17g is followed by "## Round 25: review round tooling")
+ after: `## Round 17h: delivery against a moving base` with the lines `- [ ] fresh-base-check — the delivery loop fetches origin/<base> before it judges a pull request's conflict or decides update-branch, so a step never says the base merges cleanly from a stale copy (review-writer-prompt retro, item 3)` and `- [ ] delivery-merge-hold (after: roadmap-coordinator) — while a change's pull request is in delivery, the roadmap coordinator holds the merge of any other change that touches the same packs until it lands, and /devkit status shows the hold; in review-writer-prompt main moved three times under PR 56 and each move cost a rebase, an evidence run and a review of five reviewers (review-writer-prompt retro, item 3)`
- Answer: approved
- Applied: yes

### `openspec/config.yaml` (memory-only)
A line for the context the agents get: when a plan moves or writes a parser of Markdown or of a file format, the plan decides what unterminated input does (an unclosed fence, a missing closing line, an empty file), and the readiness review asks for it.
- before: (no such line in the `context:` block)
+ after: `- A plan that moves or writes a parser decides what unterminated input does (an unclosed fence, a missing closing line, an empty file); the readiness review asks for it.`
- Answer: approved
- Applied: yes
