## Retro: compozy-loop-v2

Merged as PR chacal88/devkit#30, squash commit `5e4aee2fe03cdcfd8dfe0491fd5b48e3605ab4cc` on `main`,
53 commits, 59 files, +5844/-110. Tag (`## Workflow follow-up`, post-merge step):
`git ls-remote origin refs/tags/v0.14.0` prints
`5e4aee2fe03cdcfd8dfe0491fd5b48e3605ab4cc	refs/tags/v0.14.0`, the merge commit's sha.

Three review rounds: round 1 rejected (3 blocking), round 2 rejected (1 blocking, 2 important,
consensus deadlock, owner decided), a fresh round 1 over phase 9's head approved 5 of 5.

Dogfood: none here. The run that drove this change executed the six-node v1 loop definition
throughout, as round 1 recorded, so loop v2 — the thing this change ships — was never run end to
end against itself. The first real design gate and the first recorded demo are still the open
follow-up on `chacal88/whatsapp-platform`.

1. Went wrong:
   - The bench spent a verification round on two findings that were never real. The
     test-coverage reviewer mutation-tested the shipped loop template in place in the repository and
     restored it with `git checkout --`; the spec and quality reviewers, running in parallel, read
     that transient tree as the change and each raised it as blocking. Three verifiers refuted both.
     Its own agent file already forbids this twice (`test-coverage-reviewer.md:30` "mutate in a
     scratch copy outside the repository", `:68` "Never run state-mutating commands"), so the rule
     existed and nothing mechanical enforced it.
   - Round 2's single blocking finding was a false sentence the change itself had already corrected
     elsewhere. Task 8.1 fixed the "`devkit-openspec` is not touched, so this release creates no
     tag" claim in `CHANGELOG.md` and named no other file, so `proposal.md:64-65` kept it —
     contradicted three times inside its own file and by the diff.
   - `design.md:256-258` stated "the template test pins the guards" when `loop-template.test.mjs`
     had no such assertion. A plan sentence asserting a test that did not exist; no gate reads that.
   - Two clauses the acceptance criteria name shipped untested and were found only in round 2:
     AC-6's guarded evidence link in `deliver`'s prompt (a verifier deleted the whole block and all
     47 tests stayed green) and `screens-check`'s `parseArgs` negative branches, including the
     `.`/`..`/`archive` exclusion that is what keeps a change id inside its folder.
   - ADR 0009 was raised at round 1, with the implementation essentially complete. `design.md` D12
     concluded "no new ADR" without engaging `docs/adr/0006-phases-as-child-sessions.md:62`, which
     lists "a daemon that starts sessions (Compozy-style)" as a *rejected* alternative. The decision
     this change packages for every project was recorded after its code existed.
   - This archive session's first `deliver-check` was wrong. On the CompozyOS worktree branch
     `calm-badger` (generated name, not `<id>`), `findChangePr` treated the branch as the change's
     own — `resolveChange` falls back to the single active change whatever the branch is called
     (`guard.mjs:117`) — looked for a pull request with head `calm-badger`, found none, and reported
     `next.step: verify` for a change merged an hour earlier. Switching to
     `chore/archive-compozy-loop-v2` gave `retro`.
2. Better next time:
   - Make the clean tree a precondition of the round, not an instruction inside one agent: the bench
     records the tree state before stage 1, and a finding whose only evidence is an uncommitted edit
     is refuted by default.
   - A task that corrects a factual claim names every file that repeats it, and a plan sentence that
     says a test pins something names that test file.
   - Read the ADRs' *rejected alternatives* while writing `design.md`, not at the review: an
     approach an ADR rejected needs its own ADR before readiness, not after the code.
   - Run a checker that resolves the change from the branch only from a branch named after the
     change or `chore/archive-<id>`; on any other branch its `next.step` is unreliable.
3. Remember: the loop that drove this change was v1, so v2 ships unproven against itself.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | A reviewer mutating the repository tree makes parallel reviewers invent blocking findings | process-friction | rule | project |
| 2 | A corrected claim survives in every file the correcting task did not name | doc-gap | rule | project |
| 3 | An approach an ADR lists as a rejected alternative needs its own ADR before readiness | project-rule | rule | project |
| 4 | A clause an acceptance criterion names can ship with no test that goes red | bug-class | followup | project |
| 5 | `findChangePr` trusts `resolveChange`'s single-active-change fallback as "this is the change's branch" | tooling | regression-gate | project |
| 6 | Three writer agents met prompt-shaped reminders (use raw shell, the uncommitted edit is intentional); all three declined and reported | process-friction | memory-only | project |
| 7 | Loop v2 ships without ever having driven a change | process-friction | followup | project |

## Proposed updates

### `plugins/openspec/hooks/deliver-check.mjs`, `plugins/openspec/hooks/deliver-check.test.mjs` (regression-gate)
`findChangePr` must read the branch's own name, not `resolveChange`'s single-active-change fallback, before deciding the checkout sits on the change's branch. Learning 5; this session's wrong `verify`.
- before: const own = selected?.name === id && Boolean(branch) && !defaultBranches(root).includes(branch) && !archiveHeads(id).includes(branch);
+ after: const names = (b, i) => b.split('/').pop() === i || b.includes(i);
+ after: const own = selected?.name === id && Boolean(branch) && names(branch, id) && !defaultBranches(root).includes(branch) && !archiveHeads(id).includes(branch);
- before: (no test covers a branch that names neither the change nor an archive head)
+ after: test('findChangePr: on a branch that names neither the change nor an archive head the merged PR is still found by its body link, never reported as none (compozy-loop-v2 retro)', ...) — the fixture's only active change is the id, the branch is `calm-badger`, and the result is the merged PR via `list`.
- Answer: approved
- Applied: yes

### `plugins/core/skills/review-change/SKILL.md` (project-rule)
The round, not one agent file, enforces the clean tree; a finding resting on an uncommitted edit is refuted. Learning 1.
- before: Every prompt starts with the worktree preamble when there is one, the verifiers' too. The target is the change id and its artifact paths, or the range for a bare diff, plus where the project keeps its ADRs and specs.
+ after: Every prompt starts with the worktree preamble when there is one, the verifiers' too. The target is the change id and its artifact paths, or the range for a bare diff, plus where the project keeps its ADRs and specs.
+ after: Record `git status --porcelain` before stage 1 and put it in every prompt. Reviewers run in parallel over one tree: none of them writes to it, and a reviewer that needs to mutate a file copies it to the scratch folder first. A stage-1 finding whose only evidence is an uncommitted edit that this record does not show is refuted in stage 2 without a verifier, and noted in `review.md` as a transient tree state.
- Answer: approved
- Applied: yes

### `openspec/config.yaml` (project-rule)
A claim in the plan is true at the commit that ships it, and a correction sweeps every copy. Learnings 2 and 3 of the round-1 and round-2 blockers.
- before:   proposal:
- before:     - Keep it under two pages; the how belongs in design.md
+ after:   proposal:
+ after:     - Keep it under two pages; the how belongs in design.md
+ after:     - Every sentence stating a fact about the repository is true at the commit that ships it; a task that corrects such a claim names every file that repeats it
- before:   design:
- before:     - Record any decision that changes an ADR as a proposal for a new ADR, not as a silent deviation
+ after:   design:
+ after:     - Record any decision that changes an ADR as a proposal for a new ADR, not as a silent deviation
+ after:     - A sentence saying a test pins a behaviour names that test file
+ after:     - Read the ADRs' rejected alternatives: an approach an ADR rejected needs its own ADR before readiness, never a line concluding none is needed
- Answer: approved
- Applied: yes

### `openspec/roadmap.md` (process-friction)
Record this change and queue what it left open: the untested-clause gap and the first real dogfood of loop v2. Learnings 4 and 7.
- before: (the file ends after round 11)
+ after: ## Round 12: the CompozyOS loop as a kit
+ after: - [x] compozy-loop-v2 — devkit-compozy ships the twelve-stage loop, the four role shells, the design gate and the demo as a kit any project installs; this repository adopts it; ADR 0009; release tagged v0.14.0
+ after:
+ after: ## Round 13: what the bench caught late
+ after: - [ ] ac-clause-coverage — a gate reads each acceptance criterion's clauses against the tests named for its slug, so a clause with no red test fails before the review (compozy-loop-v2 retro, item 4)
+ after: - [ ] compozy-loop-v2-dogfood (after: ac-clause-coverage) — the first change driven end to end by loop v2, with its design gate and recorded demo, written back into this retro (compozy-loop-v2 retro, item 7)
- Answer: approved
- Applied: yes

### user memory (memory-only)
A devkit checker that resolves the change from the branch (`deliver-check`, `conduct-check`) answers from the single active change whatever the worktree branch is called; run it from a branch named after the change or `chore/archive-<id>`, and check the branch before trusting its `next.step`.
- Answer: approved
- Applied: yes
