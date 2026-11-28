<!-- devkit-stage readiness result=failed attempt=3 commit=0c64ce1bf67c10215f0db9357142192c2b28fcdd -->
# Readiness review: helper-conductor

## 1. Decision
- Status: NEEDS-REVISION
- Confidence: high
- Ready to implement: no

This is round 3, on the revision of 0c64ce1 ("revise the plan of helper-conductor from probes 1 and 2"): the helper is now the tick's own session, the task never removes itself, prompt form S-B, D-25 test capacity. `openspec validate helper-conductor --strict` passes. On this head: `python3 scripts/check.py` passes, `python3 scripts/gen-catalog.py --check` is clean and `node scripts/test-suite.mjs --own-files` reports `selected no test file: 21 own files, none maps to a test` (the phase 1 and phase 2 gates read green on the base). The whole suite was not run by this review. One Mandatory finding is open (spec scenarios for decision-table rows); it is narrow and fixes without changing scope.

## 2. Scope validation
Classification: correct. Problem, 22 ACs, non-goals and the dependency on `multi-roadmaps` are written. The revision stays inside the request: the removal of the sessions, one task, a refused empty tick. Stop-and-revise cases of the second decision point (task 3.6) are named (`design.md:126-131`).

## 3. Proposal review
Consistent with the revision: `proposal.md:21-45` states the task that never removes itself, the hook's note, the tick's own session as the helper, and no agent helper. No leftover of the agent-helper or the self-deleting task in `proposal.md`, the specs or `tasks.md` (grep for `delete-task`, `roadmap-helper`, `Helper A`, `task=deleted`: only as forbidden or removed items).

## 4. Design review
Claims about internals re-derived against the code at 0c64ce1:
- `run-file.mjs:8` imports `isChangeId` from `guard.mjs`, `:9` imports `change-loop.mjs`, `:24-28` is `runFilePath` with `git rev-parse`: as D-3 and D-4 say.
- `deliver-check.mjs:19` imports from `guard.mjs`; `:3099` and `:3152` are the two `trainOn ? { train: ... }` sites D-25 names; `prFiles` exists (`:788`, the design says `:786`); `listWorktrees` is `deliver-check.mjs:246` (design says `:244`): off by two lines, no effect.
- `roadmap-loop.mjs:62-71` (`DEFAULT_LIMIT`, `limitOf`), `:891` (`limitOf(env.CLAUDE_PLUGIN_OPTION_LOAD_LIMIT)`), `:1024` (`free = places - entriesCount(occupied)`), `:1070-1079` (`placeDecision` and the `occupied` write), `:1240` (the prune loop), `:247` (`sessionBackground`), `:310` (`CHECK_CRON`): all as written. `guard.mjs:1302` is `roadmapRunOf`. `change-loop.mjs:6` ("runs nothing when imported") and `:43-50` (the import list) match.
- `hooks.json` has no `UserPromptSubmit` and no `AskUserQuestion` matcher today, and has the `Skill` matcher at `:31`: the additions and the removal are as D-4, D-10 and D-12 say.
- `review-change/SKILL.md:77` "Which path runs" names the "scheduled prompt" exclusion that D-9 amends.
No failed re-derivation. `origin/main` has moved since the base `6f03a57` (train 22, `review-writer-text`), and touches `plugins/core/skills/review-change/SKILL.md` (a different line than `:77`) and `review-round.mjs`/`.test.mjs`/`.workflow.js`, which task 4.1 also reads; see section 10.
Host unknowns (blocked firing cost, the note reaching the session, the payload form, the cron, the notification tool) are assigned to task 3.6 with stop-and-revise cases, not left open for the implementer.

## 5. Specs review
Normative language and WHEN/THEN scenarios are present across the six deltas. Decision-table coverage:
- D-3 rules, D-6 rules 1 to 5, D-7's table (place, github, delegated, owner, blocked, archived, stopping), D-13, D-22, D-23 and D-25 have scenarios.
- **Not covered** (Mandatory, section 9): D-21's table rows "departed, checks running" (the `github` train hold with a 10-minute `recheckAt`), "merged" (hold cleared, boarded changes archived by the sweep) and "a change left with `why: conflict`" (its `boarded` hold deleted, claimable again); and D-5's `--after task=refused` outcome (the app refuses the task: nothing recorded, reply `roadmap-no-task`). `specs/roadmap-conductor/spec.md:380-403` has scenarios only for boards, runs, needs-owner and red; `:38-40` only covers a host that offers no tool.

## 6. Tasks review
Ordered by dependency, checkbox form, each with a command; every AC of the table has a task; no task numbers an ADR, bumps a version or writes a CHANGELOG line (`release.md` carries `packs:` with `devkit-openspec: minor`, `devkit-core: minor`, `marketplace: minor`, a title and a body; fences closed). `decisions.md` lists the record unnumbered. Test-map edits are named in each task that adds a file. The tests that pin removed text are rows of D-15. Task 1.4 (the "Probe 2" section of `proof/decision.md`) is still open by design, and the plan's approval of this revision is not recorded (`approval.md` is for the plan at f4db047); both gate phase 2 as `tasks.md:27-30` says. The phase 1 and 2 gate commands exist and run green on the base.

## 7. Omission detection
Validation, errors, idempotency (two ticks at once, a stale claim, a dead pid), permissions (owner-only paths), observability (`DEVKIT_HOOK_LOG`), rollback and migration (an old run file keeps working) are defined. Real-run failure paths name the hook that sees them and the files left (6.2, 6.5). No findings beyond section 9.

## 8. Execution risks (top 5 failures)
1. A blocked firing still reaches the model, or the hook's `additionalContext` does not reach the firing's session. Impact: the whole tick design fails. Prevention: task 3.6 before phase 4, with the stop-and-revise case named.
2. A tick's session ends its turn mid-drive on a background notice and the claim goes stale for up to 2 hours. Prevention: D-11's stop rule and the takeover (6.2).
3. The hook's file-only facts differ from the tick's git-based facts. Prevention: D-15's test against `runFilePath` and `listWorktrees` on one fixture.
4. The removal breaks a test outside D-15's 171 rows. Prevention: the grep-first rule and the phase 5 gate.
5. `scripts/test-map.json` out of step with the new modules, failing every later gate. Prevention: each task names its map edit.

## 9. Mandatory fixes before implementation
- [ ] High — `openspec/changes/helper-conductor/specs/roadmap-conductor/spec.md:380-403` — D-21's table (`design.md:986-993`) has six outcome rows and the spec has scenarios for three; "departed, checks running", "merged" and "a left change with `why: conflict`" have none, so a test for each has no scenario to cite (AC-18) — add one scenario each under "A boarded change gets its train dispatched".
- [ ] Medium — `openspec/changes/helper-conductor/specs/roadmap-conductor/spec.md:38-40` — D-5 and task 2.4 name `--after task=refused` (the app refuses the created task, as an SSH host does) with the reply `roadmap-no-task` and nothing recorded; only the no-tool case has a scenario — add "The app refuses the task".

## 10. Optional improvements (within scope)
- [ ] Stage headers of `proposal.md`, `design.md`, `tasks.md` and the specs still read `attempt=4` / `attempt=1` at commit `5a3d5cd`, although the content was revised at `0c64ce1`; `requirements.md` carries `attempt=7` while `proposal.md:5`, `design.md:5` and `tasks.md:6` cite "attempt 6". The author re-stamps the headers and the citation with the next planning round.
- [ ] Fix during implementation: before task 4.1 and again before the delivery, merge `origin/main` (it changed `review-change/SKILL.md` and `review-round.*` since `6f03a57`), then re-read `openspec/config.yaml` and edit `tasks.md:4-5` ("has merged nothing yet") in the same commit as the merge (CLAUDE.md).
- [ ] Anchors `deliver-check.mjs:244` and `:786` in D-3 and D-25 are `:246` and `:788`.

## 11. Explicitly out of scope
- [ ] The CompozyOS driver, parsing `<name>`/`round <k>` (`multi-roadmaps`), starting work over SSH, a phone channel beyond the host's notification tool.

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes (`requirements.md` request, 22 ACs).
2. Is the result measurable? Yes; each AC maps to a test name prefix or a `proof/` file.
3. Are error behaviors defined? Mostly; the refused-task and train-conflict outcomes lack scenarios (section 9).
4. Are edge cases covered? Yes: no git on the path, a broken run file, an unclosed fence, a dead pid, a stale claim.
5. Are dependencies clear? Yes: `multi-roadmaps`, probe 2, the record's revision, the base merge.
6. Are contracts defined? Yes: run file shape, hook note, verbs, request files, ledger.
7. Can two developers interpret this differently? Not on the points checked; the tables fix names and outcomes.
8. Are any decisions implicit instead of written? The cron and the notification tool wait for task 3.6, written as such.
9. Do the tasks fully deliver the intended outcome? Yes, with the proofs in phase 6.
10. What will be discovered too late? A hook that does not block before the model, which task 3.6 finds before phase 4.

## 13. Final conclusion
- Can we start? Not yet: add the missing scenarios, then phase 1's task 1.4 and the owner's approval of the revision.
- What must be fixed? The two items of section 9.
- Main risk if ignored? A train end or a refused task is implemented with no scenario, so its test and its review have nothing to cite.
