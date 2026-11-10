# Readiness review: conduct-sessions

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

Fifth round. The one mandatory fix of round 4 (M1, the `bind_pr` part of AC-9 with no way to be verified) is in `tasks.md`, and the fixes of rounds 1 to 3 still hold. `openspec validate conduct-sessions --strict`: valid, 0 errors (INFO only: `skip_specs`). `rules.tasks` met (one `## N.` group per phase, each ending in a gate task that names the test command, every AC id in a task). `rules.readiness` respected (only this reviewer writes the file). No verdict was suggested by the caller, and none of the owner's decisions in requirements.md ("Decided with the owner") is impossible given the code.

## 2. Scope validation
Classification: correct. Problem, scope, non-goals and the owner's decisions are explicit. The author's edit touched only `tasks.md` (`git diff HEAD` shows pin text, gate wording, dogfood bullet, 3.1 and 2.3 clarifications); scope did not grow.

## 3. Proposal review
Proposal AC-9 (proposal.md:49) and requirements AC-9 (requirements.md:170-172) agree: capped watch, `waiting on GitHub: <what>`, the Auto-fix line, `get_status`/`bind_pr` after `open-pr`. No findings.

## 4. Design review
Round 4 fix, re-checked against the edited artifacts:

- M1: fixed. `tasks.md` 2.3 now ends with "add a pin test for the PR binding: `mcp__ccd_pr__get_status` then `mcp__ccd_pr__bind_pr` after `open-pr`, 'one PR bound per session' and 'the PR opened last' named in the report", matching design D8 (design.md:158-170: `get_status` first, `bind_pr` only when it does not report the PR, one PR bound per session, the PR opened last, which one is bound said in the report). The 2.9 gate names the pins of 2.1, 2.2 and 2.3 "the AC-9 pin of 2.3 included" and AC-9 among the live proofs. The dogfood bullet records `get_status`/`bind_pr` after `open-pr` with the bound PR named in the report. AC-9 now has a test and a live record.
- Round 4 optional items: 3.1 now says 0005 is already in `openspec/config.yaml` and 0006 is added beside it (verified: `openspec/config.yaml:22` lists 0001..0005; `docs/adr/` holds 0001..0005 and 0006 is free). 2.3 says Start 4 keeps "After that answer, the owner invoking `/conduct` is the go-ahead for every `devkit-lite` change", which is pinned at `guard.test.mjs:1073` and present in `SKILL.md:17` today. The hash-suffix item was left as is (1 in 256), accepted.
- Rounds 1 to 3: unchanged by this edit (only `tasks.md` changed and only the lines above). "Under way" (D13) text is the same in 2.1, 2.3, design and requirements; the digits-only prefix match (2.1, 1.2, D6) is unchanged.
- Claims about the code re-checked this round: `SKILL.md:17` holds the `--wake` text 2.3 replaces; the six `guard.test.mjs` tests named in 2.3, 3.1 and 2.4 each exist by name (one match each); no other file than readiness.md and tasks.md is modified in the worktree. The rest of the code claims (`conduct-check.mjs`, `deliver-check.mjs`, `guard.mjs` line references) were verified in round 4 and the plan's wording of them did not change.

No new findings.

## 5. Specs review
Not applicable by design (`skip_specs: true`, design D1; archived precedents). The acceptance criteria AC-1..AC-11 in requirements.md serve as the testable list; each has a task and a verification (test pin or dogfood record).

## 6. Tasks review
Ordered by dependency (checker, then skill, then ADR/docs/release), `- [ ]` checkboxes, each with a verify clause, each phase ending in a gate (1.9, 2.9, 3.9). Dogfood items are plain bullets after the merge, as the note at the top of the file requires.
- Low (nice to have, fix during implementation): 2.3 pins "the PR opened last named in the report" without fixing a report-line format (unlike `not bound:`). The pin only needs those phrases to appear in the skill text; any wording that contains them satisfies it. Not blocking.

## 7. Omission detection
Validation, error handling, idempotency (D6), permissions (D13), side effects (D9 archive risk with a dogfood check and fallback), observability (report lines), rollback (install 0.8.0), compatibility (JSON version 2, BREAKING note) and test strategy are defined. No findings.

## 8. Execution risks (top 5 failures)
1. Cause: the app archives the change's worktree along with the child. Impact: later phases and the gate lose their folder. Prevention: D9 dogfood check of `git worktree list` and the "group only" fallback.
2. Cause: a continuation turn misreads "under way" for a change whose previous child is archived. Impact: a phase waits for the owner's next message. Prevention: D13 reads it from `tasks.md` and `approval.md`.
3. Cause: `limit: 100` hides a running child past 100 linked sessions. Impact: a second session for a busy phase. Prevention: stopped attempts are archived after the gate; the dogfood records the rows.
4. Cause: the host read from the ambient env in tests. Impact: `implement` rows turn into sessions and old tests fail. Prevention: 1.1 pins `DEVKIT_HOST` in `cleanEnv` and `cli()`.
5. Cause: `bind_pr` refused or declined by the owner. Impact: Auto-fix does not wake the session. Prevention: reported as `not bound: <url> (<why>)`, never a stop (2.2), with the AC-9 pin and dogfood record.

## 9. Mandatory fixes before implementation
No mandatory fixes.

## 10. Optional improvements (within scope)
- [ ] 2.3: give the "which PR is bound" report line a fixed form (for example `bound: <url>`), as `not bound:` has.
- [ ] 1.2: note the unhandled second collision of the two-character suffix (1 in 256) or widen the suffix if the name budget allows.

## 11. Explicitly out of scope
- [ ] The orquestrador panel, a Workflow-based review round, a per-project flow file, child sessions for steps other than `implement` (requirements "Out of scope").

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes: requirements.md Request and proposal Why.
2. Is the result measurable? Yes: AC-1..AC-11 each have a test pin or a dogfood record, AC-9 included.
3. Are error behaviors defined? Yes: refused start (D5), refused archive/move/bind (D9), a child without a ticked task (D6), unreadable roadmap (unchanged).
4. Are edge cases covered? Yes: name cut and collision, prefix extension, a re-run during a phase, a retried phase, a continuation turn at an owner gate, `devkit-lite`.
5. Are dependencies clear? Yes: phases 1, 2, 3 in order; the dogfood needs the merge.
6. Are contracts defined? Yes: `session` descriptor, `sessionPrefix`, JSON version 2, start fields, report lines.
7. Can two developers interpret this differently? Not on any point found beyond the free wording noted in section 6.
8. Are any decisions implicit instead of written? No.
9. Do the tasks fully deliver the intended outcome? Yes.
10. What will be discovered too late if implementation starts now? Whether `archive_session` removes the worktree and whether the app accepts chained starts; both are the dogfood's and have a fallback.

## 13. Final conclusion
- Can we start? Yes.
- What must be fixed? Nothing mandatory.
- Main risk if ignored? The app behaviors (worktree on archive, chained starts, `bind_pr`) can differ from the tool descriptions; the dogfood and the planned fallbacks cover them.
