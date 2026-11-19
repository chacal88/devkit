## Retro: orchestrator-replan

1. Went wrong: the plan took three readiness rounds and the review two. The causes were small and
   of one kind, a claim written without being checked against the repository: the proposed ADR
   took up alternatives earlier ADRs had rejected without answering them by name; the requirements
   cited `docs/conventions.md` for the version rule, which lives in `CONTRIBUTING.md`; the evidence
   recorded a table of 12 rows that has 11; an acceptance criterion forbade any change under
   `plugins/*/hooks` and then had to be reworded twice, first for one assertion and then for the
   two tests the review asked for. Two things of the tooling got in the way: `review-round.mjs
   outcomes` returned no writer prompt in either review round, although the `review-change` skill
   says it does, and a reviewer's two-sha disposition was refused by the validator. The name of
   another project of the owner reached the files and was caught only at the first push, on a
   public repository. And the design left out how a project is set up for the new flow: the owner
   asked about it after the merge.
2. Better next time: count before writing a number, and cite a rule from the file that holds it.
   Word an acceptance criterion as "no behaviour changes", never as "no file under a path changes".
   Commit the evidence before a review round, so no reviewer records uncommitted changes. Keep the
   names of the owner's other projects out of anything pushed to this repository from the first
   draft. Ask "how does a project get this?" in the grill of any design.
3. Remember: a claim about the repository is checked against the repository before it is written.

What worked: the readiness review and the review bench found every one of these before the merge,
and the twelve verifiers refuted none of the four findings they were given. The filtered doc tests
(22 tests in under a second) made each phase gate cheap, and the whole suite ran only where a gate
named it (669 tests on the base, 671 at the delivered commit). The delivery contract went from 0
to 8 of 8 with no step chosen by hand. The quoting fix in `openspec/config.yaml` turned out to
matter in this very change: the dropped design rule is the one the first readiness round enforced.

Dogfood still pending: whether `docs/coordination-design.md` is enough to plan the next change is
known only when `flow-script-checker` (round 14) is planned from it. Its planner reports it, and
the result is recorded in that change's requirements.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | `review-round.mjs outcomes` returns no writer prompt, though `review-change` says the command gives it; the session built the prompts from the exported `writerPrompt` rule in both rounds. The roadmap item for it (`review-writer-prompt`) was withdrawn in this change | tooling | followup (proposal 1) | project |
| 2 | A reviewer wrote "fixed in a and b" as a disposition; the validator accepts one sha, and the stage 1 prompt does not say so | tooling | followup (proposal 1) | project |
| 3 | The design has no stage or round for setting a project up for the new flow (the `devkit:` block, the three schemas, the checker, the driver) | doc-gap | doc-update (proposal 2) | project |
| 4 | `CLAUDE.md` sends the reader to `docs/conventions.md` for versions; the version and tag rule is in `CONTRIBUTING.md` | doc-gap | doc-update (proposal 3) | project |
| 5 | The verifier recorded a count it had not counted; it was the only blocking finding of the review | bug-class | rule (proposal 4) | project |
| 6 | An acceptance criterion that forbids file changes forbids the tests a review will ask for | process-friction | memory-only (proposal 5) | user |
| 7 | The repository is public and the files named another project of the owner until the first push | project-rule | memory-only (proposal 6) | user |
| 8 | Evidence left uncommitted during a review round makes a reviewer record "uncommitted changes", which the checker reads as stale | process-friction | memory-only (proposal 7) | user |
| 9 | An implementer restored a file with `git checkout -- <file>` after proving a test red; the project lists that command as destructive, and the guard refuses only the `.` form | project-rule | followup: the "destructive Git refused" lock of round 15 covers the single-file form | project |
| 10 | `docs/migrate-to-project-scope.md` names another project of the owner and has been public since before this change | doc-gap | followup: the owner decides whether to reword it | project |
| 11 | Green checks do not wake the session, and the session may not poll them; the owner merged the pull request by hand before auto-merge was enabled | environment | none: the limit ADR 0010 answers with the loop of round 15 | project |

## Proposed updates

### `openspec/roadmap.md`, `docs/coordination-design.md` (tooling)
Bring back the review-round follow-up this change withdrew, because the defect is real and the review stage stays in the new flow.
- before: `openspec/roadmap.md` ends at "Round 24: the cleanup"; `docs/coordination-design.md`, "Withdrawn roadmap items", lists `review-writer-prompt` (round 11) among the six withdrawn lines.
+ after: `openspec/roadmap.md` gains "## Round 25: review round tooling" with the line "- [ ] review-writer-prompt — `review-round.mjs outcomes` returns each outcome's stage-3 writer prompt, as `review-change`'s agents path says, and the stage 1 prompt says a disposition names one sha (orchestrator-replan retro, items 1 and 2)"; `docs/coordination-design.md` says five lines stay withdrawn and that `review-writer-prompt` returned as round 25, with the reason.
- Answer: approved
- Applied: yes

### `docs/coordination-design.md`, `openspec/roadmap.md` (doc-gap)
Say how a project is set up for the new flow, which the design left out.
- before: `docs/coordination-design.md` has no mention of project setup; `openspec/roadmap.md` has no round for it.
+ after: `docs/coordination-design.md`, "Open points", gains an item marked proposed: one setup step per project writes the `devkit:` block of `openspec/config.yaml` (driver, language of the files, delivery model, test commands, task source), installs the schemas and the checker under the project's `openspec/` and wires the chosen driver, replacing what `openspec-setup` and `compozy-setup` do today; `openspec/roadmap.md` gains "## Round 26: project setup" with the line "- [ ] project-setup (after: delivery-models) — one setup step writes the `devkit:` block, installs the schemas and the checker into the project and wires its driver (orchestrator-replan retro, item 3)".
- Answer: approved
- Applied: yes

### `CLAUDE.md` (doc-gap)
Point the reader at the file that holds the version rule.
- before: the row `| How to contribute, test and release | [CONTRIBUTING.md](CONTRIBUTING.md) |` and the row `| Conventions (commits, language, versions) | [docs/conventions.md](docs/conventions.md) |`
+ after: the row `| How to contribute, test and release (version bumps, tags) | [CONTRIBUTING.md](CONTRIBUTING.md) |` and the row `| Conventions (names, commits, language) | [docs/conventions.md](docs/conventions.md) |`
- Answer: approved
- Applied: yes

### `plugins/core/agents/pr-verifier.md` (project-rule)
A number in the evidence is one the verifier counted at that commit.
- before: the agent's rules for `evidence.md` say what each row holds and do not say where a number may come from.
+ after: one added rule: "Every number you record (a count, a line range, a total) is one you counted at this commit; never carry a number from memory, from the plan or from an earlier evidence file."
- Answer: approved
- Applied: yes

### user memory (memory-only)
An acceptance criterion says "no behaviour changes", never "no file under this path changes": the second forbids the tests a review will ask for.
- Answer: approved
- Applied: yes

### user memory (memory-only)
The devkit repository is public: keep the names of the owner's other projects out of every file that is pushed, from the first draft, and ask before the first push if one slipped in.
- Answer: approved
- Applied: yes

### user memory (memory-only)
Commit the evidence before a review round starts, so no reviewer records "uncommitted changes" and goes stale for that alone.
- Answer: approved
- Applied: yes
