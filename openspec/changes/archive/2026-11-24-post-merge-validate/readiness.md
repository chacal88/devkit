<!-- devkit-stage readiness result=passed attempt=2 commit=02208a3517799997e0a4950c46c466ec161c88c6 -->
# Readiness review: post-merge-validate

Round 2, reviewed at `02208a3` (devkit-openspec 0.32.0, marketplace 0.36.1; `origin/main` still at `4631376`, no fetch). The plan files were revised after round 1 (`design.md`, `tasks.md`, `proposal.md`, `decisions.md`, the spec delta and the ADR 0017 Note are newer than the round-1 report). `openspec validate post-merge-validate --strict` passes (exit 0). `python3 scripts/check.py`, `python3 scripts/gen-catalog.py --check` and `command claude plugin validate .` are green on the base. No instruction from the caller about the verdict was given or taken.

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

The three mandatory fixes of round 1 (M-1, M-2, M-3) are done and I re-checked each against the files and the code, not against the author's say-so. No mandatory finding is open. Three Low points remain; none changes what an implementer builds.

## 2. Scope validation
Classification: correct. The change is the first half of the owner's request (the post-merge `openspec validate <id> --strict`, handed to the planner on red); counting attempts by real failures stays whole in `evidence-attempts-by-failure` (`requirements.md:17`, `proposal.md` Non-goals). Out-of-scope items and the sibling lines are named, and no spec requirement goes beyond the proposal.

## 3. Proposal review
- Problem, goal, non-goals and impact are clear and fit two pages. The AC-7 wording now says what is true: the command runs without the CLI, then `next` runs with it; with no CLI at all `next` itself exits 3 (`proposal.md` AC-7, `requirements.md` AC-7; round 1's L-1 is fixed).
- The rebase of the task branch is now a stated non-goal (`proposal.md` Non-goals, `design.md` Goals / Non-Goals; round 1's L-3 is fixed).
- `decisions.md` and `proposal.md` now agree: ADR 0017 is a checked record with a Note, and the proposal's Impact says so.
- Release names "the next free numbers on `origin/main` at the last merge before review", as `openspec/config.yaml` asks; the literals `0.33.0` and `0.37.0` in `design.md` D-11 are tied to `02208a3`, where `plugin.json` says 0.32.0 and `marketplace.json` 0.36.1, so they are an anchor someone ran, not an instruction.

## 4. Design review
Round 1 re-derived the code claims at `02208a3`; HEAD has not moved and no hook file is modified, so those results stand (decision order in `decide`/`buildPart`, `ROWS`/`ROW_STEPS`, `writeBackFile`/`saveWriteBack`, `makeOpenspec`, `fingerprint`, the plan gate in `artifactState`/`approvalState`/`nextStep`, the `openspec validate --json` shapes, the planner's role in both flows). This round I re-derived what the revision added or changed:

| Claim | Result |
|---|---|
| T-5 and T-13: an empty `PATH` folder yields ENOENT while `node` is called by absolute path and `git` keeps the process's own `PATH` | Holds. `makeOpenspec` passes `env` only to `spawnSync('openspec', ...)` (`flow-check.mjs:41-62`), and `execFileSync('git', ...)` takes no `env` (`change-loop.mjs` `git`, `fingerprint` `flow-check.mjs:165`). I ran `spawnSync('openspec', { env: { PATH: <empty dir> } })`: `ENOENT`. Here `openspec` sits beside `node` (fnm), so the folder of `node` would have found it, as M-2 said |
| `openspecCli` does not start a program from the project's `PATH` when no pin exists | Holds (`guard.mjs:1175-1190`): no `node_modules/.bin/openspec` and no `package.json` pin gives `{ bin: 'openspec', pinned: false }` |
| `fingerprint` of the command (`git rev-parse HEAD`) equals `facts.fingerprint` of `next` | Holds. `gitFacts().head` is `git rev-parse HEAD` (`deliver-check.mjs:268-271`) and `facts.fingerprint = fingerprint(root, gf.head)` (`flow-check.mjs:271`); `nextAction` passes it as `fingerprint` to `decide` (`change-loop.mjs:1189`), and `key()` uses it (`:926`) |
| `agent(stage, role, step, what, detail, named)`, `sessionAction(stage, step, detail)` and `blocked(why, params, stageId)` take the arguments D-4 gives them; `brief()` wraps `what` as "... stage <stage>: <what>. Work only in ..." | Holds (`change-loop.mjs:923`, `:928-934`, `:949-957`) |
| `blocked-why.*` codes live only in `MESSAGES` and in `change-state AC-3 state` (`change-loop.test.mjs:4942`); `roadmap-loop.test.mjs:559` `BLOCKED_PARAMS` holds `sha`, `attempt`, `error` | Holds. I grepped `tag-elsewhere`, the last code added the same way: `MESSAGES`, `release-tags.test.mjs` and the AC-3 test only |
| Anchors `change-loop.test.mjs:546`, `:819`, `:2573`, `:3166-3167`, `:4942`; `guard.test.mjs:1578`; `docs/openspec-flow.md:230`, `:316`; `SKILL.md:91`; `openspec/roadmap.md:74` | Hold. `:4942` is the AC-3 test (round 1's L-2 is fixed); `deliveredChange` has 21 callers plus its definition |
| D-1: `git rev-list --first-parent --merges -n 1 HEAD ^origin/main` | Holds for the cases T-1 lists. In a scratch repository: a branch that merged `origin/main` gives the merge's sha; after the branch is merged into `main` with a merge commit the answer is empty. It does not hold for the last sentence of D-1 (see L-5) |
| CI and docs pins: `change-loop.test.mjs:2573` `pinMismatches`; no test asserts the line-316 sentence, the README row's "writes nothing but" (`change-loop.mjs:6` only) or the roadmap line | Holds; I grepped `plugins`, `scripts`, `docs` |
| `change-state ADR 0017: the documents follow` (`change-loop.test.mjs:5525`) still passes with the Note in `docs/adr/0017-...md` | Holds; I ran it by name: 1 of 1 |

ADRs. The plan now settles the ADR 0017 question in writing, where round 1 found it open:
- The Note on ADR 0017 (`docs/adr/0017-...md`, Context, third Note) adds the merge-check record as one more input of decision 1, a fact and not stored state, with the same shape as the Note ADR 0020 left there for `no-place`.
- `decisions.md` lists ADR 0017 as an `ADR:` record. `decisionRecords` reads the first status line of that file, `- Status: accepted`, so it lists nothing as proposed and no `accept-decisions` step appears. The design says so (`design.md`, "ADR 0017: a proposed Note", last paragraph), so nothing in the loop contradicts it.
- The rejected alternative in ADR 0017 is "one event log per change"; the record keeps only the newest merge's latest result and a count, rewritten each time, so it is not that log. ADR 0010 decisions 3 and 6, ADR 0011 decision 2, ADR 0016 and ADR 0019 are respected.

Rollout, rollback and migration are covered (`design.md` Migration Plan): a branch that already holds a merge gets one check on its next `next`; a revert leaves the records unread.

## 5. Specs review
`specs/change-coordination/spec.md` has six ADDED requirements, all with SHALL and WHEN/THEN scenarios, and validates strict. Round 1's M-3 and L-4 are done:
- The command with no merge (`result: none`, no record, exit 0), the command on an unknown change (exit 3), a damaged, foreign or version-2 record read as no record and never green, and the cannot-run causes other than a missing CLI (timeout, pin refusal, no validation result, `valid: true` with a non-zero exit) each have a scenario now.
- The held steps are named: `review`, `push`, `open-pr`, `update-branch`, `wait-checks`, `ready` and `ready-base` besides `verify`; the steps not held back are named too.
- Every outcome row of D-4's decision table has a scenario: no record, green, red with the current fingerprint, red with another fingerprint, the third red, cannot-run with and without the step's progress key, no merge, no evidence stage, archive branch.
- Not written as a scenario, and not needed: a red record of an older merge reads as no record (D-2 and D-4 say so, T-7/T-8 test it).

## 6. Tasks review
- Three phases, each a `## N.` group ending in a gate that names its command; every AC id (AC-1 to AC-10) appears in a task; tests first with `proof/red-<phase>.txt` (the folder has precedent in the archive); `- [ ]` boxes; paths are real.
- The release task names "the next free numbers on `origin/main` at the last merge before review" and no literal version (`tasks.md` 3.5). Tasks that change a pinned text name the test file: `guard.test.mjs` in 3.2, `change-loop.test.mjs:2573` in 3.5. T-5's PATH recipe is fixed in 1.1 and in `design.md` T-5/T-13.
- Gates run on the base: `python3 scripts/check.py`, `python3 scripts/gen-catalog.py --check`, `command claude plugin validate .` and `openspec validate post-merge-validate --strict` are green. The filtered loop gates match no new test yet, and the existing `change-loop settings`, `change-loop replies` and `change-state AC-3` tests passed at this HEAD in round 1 (62 of 62); no test file changed since. The whole `change-loop`/`roadmap-loop` suites (2.6) and the guard suite (3.7) are marked as background commands of the conducting session; I did not run them.
- `tasks.md` "Workflow follow-up" says correctly that the installed loop does not run this change's own merges until release: validate by hand or drive with the worktree's `change-loop.mjs` (`CLAUDE.md`).

## 7. Omission detection
Validation, error handling (red, bounded red, cannot-run, damaged record, unterminated or non-JSON CLI output), retries (three reds, `ceilings.default`), idempotency (once per merge), observability (the record and the reply), rollback, compatibility with legacy branches and the test strategy including the real run (D-10: red case, green case, the conducting session's own part) are defined. Permissions: none new (ADR 0011, 0016). Not covered, and stated as a non-goal: a rebase of the task branch leaves no merge commit and gets no check.

## 8. Execution risks (top 5 failures)
1. The planner raises a stage header's `attempt=` on a rewrite (its agent file says so). Cause: R-2. Impact: a hidden attempt spent. Prevention: the brief says to leave every header line, T-12 compares the `devkit-stage` lines byte for byte, and D-10 step 7 diffs them in the real run.
2. The planner changes whitespace each round, so the fingerprint changes and K1 `no-progress` never fires. Cause: K1 compares keys. Impact: bounded by the three reds, then `merge-defect`. Prevention: D-4 and T-10.
3. A red check whose errors are not the plan's (an invalid canonical spec on the base) sends the planner three times. Cause: validate cannot tell. Impact: three hand-offs, then blocked with the Troubleshooting row of D-8. Acceptable.
4. A sibling in flight (`stale-only-on-own-files`, `delivery-merge-hold`) edits the same `buildPart` and the same release numbers. Cause: R-6. Impact: a conflict or a wrong version at the release task. Prevention: merge `origin/main` before phase 1 and before 3.5, as `tasks.md` says.
5. The ADR 0017 Note keeps the words "status: proposed" for good (see L-6), and a later reader takes it for an open decision. Cause: nothing flips it. Impact: confusion, not behavior. Prevention: L-6.

## 9. Mandatory fixes before implementation
None open. Round 1's M-1 (ADR 0017 decided in writing: `decisions.md`, the Note, `design.md`), M-2 (T-5 and T-13 use an empty `PATH` folder) and M-3 (the missing scenarios) are closed.

## 10. Optional improvements (within scope)
- [ ] L-5 Low, fix during implementation — `design.md` D-1, last sentence ("Once the change's pull request is merged into the fetched base, its merges are reachable from `ref` and the answer is `null`") — true for a merge-commit pull request (I ran it), false for a squash merge, which is this project's `merge_method` (`openspec/config.yaml`): the branch's merge commit is then not reachable from `origin/<base>` and `baseMergeOf` still returns it. No outcome depends on it: after the change's pull request merges, the delivery checker returns archive steps, the `archive` step switches the worktree to `chore/archive-<id>`, and every row there is excluded by `facts.archiving`; the steps before the switch (`retro`, `archive`) are not in `CHECK_BEFORE`. Smallest correction: say "for a merge-commit pull request" or drop the sentence.
- [ ] L-6 Low, fix during implementation — `docs/adr/0017-a-change-state-is-derived-in-one-place.md`, third Note, and `design.md` "ADR 0017: a proposed Note" — the Note says "status: proposed; the owner's approval of the change's plan accepts it", but the loop marks nothing (the file's status line is already `accepted`) and no task flips the words, so the merged ADR keeps "status: proposed" for good. Smallest correction: let the adr-author reword the Note without a status clause (as the `remote-worker` Note has none) once the owner approves, or add a task that does it at the archive.
- [ ] L-7 Low, hypothesis — `decisions.md:4`, `design.md` "ADR 0017: a proposed Note", the Note: "the owner chose this place on 2026-11-23 (answer A)". No artifact holds the question or the owner's message, so I cannot confirm it from the files. The plan approval is the owner's check on that sentence. Smallest correction: quote the owner's words in `decisions.md`.

## 11. Explicitly out of scope
- [ ] Counting attempts by real failures and exempting retakes after a merge (`evidence-attempts-by-failure`).
- [ ] Fetching the base, holding or batching merges, keeping evidence current across merges that touch none of the change's files (`fresh-base-check`, `delivery-merge-hold`, `delivery-train`, `stale-only-on-own-files`).
- [ ] A check after a rebase of the task branch.
- [ ] The CompozyOS kit, `project-loop.mjs` and `devkit-project`.

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes: a base merge that changes a spec a delta modifies is caught by a step of the loop, not by the evidence.
2. Is the result measurable? Yes: AC-1 to AC-10 are observable; AC-8 has a pass condition in D-10.
3. Are error behaviors defined? Yes: red, bounded red, cannot-run in all its causes, no merge, unknown change and a damaged record each have a design row and a scenario.
4. Are edge cases covered? Yes: a stale local `origin/<base>`, two merges, a pull of GitHub's merge, a planner that changed nothing, the third red, the count reset. The rebase case is a stated non-goal.
5. Are dependencies clear? Yes: ADR 0010, 0011, 0016, 0017, 0019; the siblings are independent.
6. Are contracts defined? Yes: the record, the command's JSON, the action shape, the brief, the two reply keys and their texts.
7. Can two developers interpret this differently? Hardly: names, texts, commands and rules are in the design, and the tasks say a choice the design does not settle stops the phase.
8. Are any decisions implicit instead of written? No; the ADR 0017 question is written (L-6 and L-7 are about wording and proof, not about the decision).
9. Do the tasks fully deliver the intended outcome? Yes; every AC has a task and a way to be verified.
10. What will be discovered too late if implementation starts now? Nothing I can find; the one inaccurate sentence (L-5) has no operational effect.

## 13. Final conclusion
- Can we start? Yes, once the owner approves the plan.
- What must be fixed? Nothing is mandatory. L-5, L-6 and L-7 are wording points the author or the adr-author can settle at any time before the retro.
- Main risk if ignored? A permanent "proposed" label on an accepted ADR's Note (L-6) and one imprecise sentence about squash merges (L-5); neither changes the code.
