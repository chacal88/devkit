<!-- devkit-stage readiness result=passed attempt=3 commit=ba3126b84f6821144dad1cfb02b260bf68dc7e77 -->
# Readiness review: release-at-merge

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

The one blocker of round 2 (the plan was written against the base before `archive-release-pin`) is fixed: the
plan base is now `ba3126b`, the merge of `origin/main` `c663f21` (train 4) into the branch, and
`git merge-base --is-ancestor origin/main HEAD` exits 0 (`git rev-list --count HEAD..origin/main` is 0). I
re-derived the moved helpers, the re-exports, the module boundary and the tests the plan names against the code at
that HEAD; each claim holds, with two small wording points (section 10) that do not change what is built.
`openspec validate release-at-merge --strict` passes. No instruction from the caller to give a verdict was received.

## 2. Scope validation
Classification: correct

The problem (a change picks release numbers and ADR numbers that every other change also picks), the in and out
of scope, the two extra capabilities `delivery-train` and `reviews-check` (flagged F-3) and the line with
`archive-release-pin` (D-17: built on, not amended) are explicit and agree across `proposal.md`, `design.md`, the
four spec deltas and the ADR. The module boundary (D-3a) stays inside the change's own hook files.

## 3. Proposal review
- Problem, the four decisions taken for the owner, impact and 15 acceptance criteria are clear and testable; every
  AC id is in the tasks table (`tasks.md:29-45`), checked AC-1 to AC-15.
- `proposal.md:6-7` and `:101-109` now state the real base and that nothing waits on `archive-release-pin`; the
  Impact line (`:95`) says `pinsIn` and `setPins` are already re-exported and the other helpers move. Matches the code.
- Non-goals are tight (`:54-57`); dependencies and exit criteria named.

## 4. Design review
Round 2 finding 1, re-derived at HEAD `ba3126b`:

| Claim | Code |
|---|---|
| `PIN_MARKER`, `PIN_TOKEN`, `pinsIn`, `setPins`, `PIN_LINE_FILES`, `pinLinesOnly`, `RELEASE_FILE`, `TRAIN_PIN_FILE` are in `deliver-check.mjs` | `deliver-check.mjs:1359-1388`; `TRAIN_PIN_FILE` is the literal `'docs/openspec-flow.md'` (`:1388`), which D-3a rewrites to `= PIN_FILE`. |
| `release-merge.mjs` already imports and re-exports `pinsIn`, `setPins` | `release-merge.mjs:18-19`. |
| Still in `release-merge.mjs`, and moved by D-3a: `ReleaseError`, `SEMVER`, `parseSemver`, `bumpKind`, `applyBump`, `resolveManifest`, `withoutVersions` (private today, so "now exported" is right), `PIN_FILE`, `PIN_PACK`, `PIN_PACK_NAME` | `release-merge.mjs:21-47,57-70,128-130`. |
| Stays: `resolveVersion`, `manifestEditsBeyondVersion` (uses `withoutVersions`, `:87-90`), `resolveChangelog`, `mergePins` with local `MASK` (`:131-148`), roadmap ticks, `classifyConflict`, `main` | as D-3a lists. |
| `deliver-check.mjs` imports only `./merge-setup.mjs` (`:13`) and `./guard.mjs` (`:19`), no dynamic import | confirmed; the source-scan test of D-3a and T-42 (`release-merge.test.mjs:651-659`) hold the same line. |
| Importers of `release-merge.mjs` | `release-merge.test.mjs:10` (names `bumpKind`, `applyBump`, `resolveManifest`, `PIN_FILE`, `PIN_PACK`, `PIN_PACK_NAME`, `setPins`, `pinsIn`), `release-tags.test.mjs:18` and `change-loop-compozy.test.mjs:16` (`pinsIn`), `delivery-train(.after).test.mjs` (`import * as release`), `conduct-check.mjs:19` (`PIN_FILE`): each is covered by the grown re-export line. |
| T-6: the pin test reads the manifest | `change-loop-compozy.test.mjs:303,364` (`pinMismatches(pinsIn(...))`, no literal). |
| T-41 to T-44 exist and assert what the plan says | `deliver-check-archive.test.mjs:1249-1279` (ADR 0003 header lines, `ADRs:` entries for 0027 and 0030, P13 row), `:1045`, `:1093`, `:1235`, `:1282`; `delivery-models.test.mjs:1906`; `release-tags.test.mjs:594`; `guard.test.mjs:455`. |
| `releaseTagOf` becomes exported; `ADR_DIRS` moves from `conduct-check.mjs:376`, `ADR_LINES` from `change-loop.mjs:1593` | both unexported or local today; `ADR_FILE` stays in `conduct-check.mjs:377`; `ADR_LINES` is only read through `matchAll` (`change-loop.mjs:1623`). |

Round 1 and round 2 claims not touched by the revision were spot-checked again and still hold: `subagentStopFor`
returns `allow('delivered')` at `change-loop.mjs:2503` before the `no-file` and `UNDELIVERED` refusals and `refuseOnce`
accepts the planned key (`:2442-2447`); `stop-plan-approval` is `needsReadiness && APPROVED && !approval.ok &&
!started` (`deliver-check.mjs:1824`); the `commit` row, the item 5 rows with `conflict: true`, `wait-merge`,
`enable-auto-merge`, `ready` and `ready-base` are where D-8 puts N1 to N7 (`:1788-1977`); `staleness` takes `own`
(`:356`); `releaseConflict` fires on `blocked`, item 5, `conflict` (`conduct-check.mjs:~430`); `MAIN` has no
`assign-release` yet (`:62`), as the plan says.

Gates that exist on the base and were run here, green: `openspec validate release-at-merge --strict`,
`python3 scripts/check.py`, `python3 scripts/gen-catalog.py --check`,
`node plugins/compozy/skills/compozy-setup/scripts/gen-agents.mjs --check`, `claude plugin validate .`. Every test
file the phase gates name exists except `release-note.test.mjs`, which task 2.1 creates; `scripts/test-suite.mjs`
takes file arguments (its usage line). The whole-suite gate (task 8.2) is long and is the caller's; not run.

Decisions inherited from ADRs: the plan amends ADR 0022 and ADR 0025 and builds on ADR 0003, 0019, 0027 and 0030
without editing them (ADR `release-at-merge` Amends and Builds-on lines; D-13, D-17, task 5.6). No conflict left.

## 5. Specs review
- Normative language and `#### Scenario:` blocks in all four deltas; MODIFIED headers match `main`'s requirement
  names.
- D-8 decision table against the scenarios: A1, N1 (every repository error), N2, N3, N4, N5 (both halves), N6
  (including `wait-merge`: "Auto-merge on while the release is not current"), N7 each have one. Round 2 item 3 is
  fixed.
- The three smaller deltas (`change-coordination`, `delivery-train`, `reviews-check`) agree with the design.

## 6. Tasks review
- One `## N.` group per phase, each ends in a gate task naming a single backticked command; test-first tasks save
  `proof/red-<n>.txt`; the config rule "next free number on origin/main at the last merge before review"
  (`openspec/config.yaml:57`) is applied in task 8.1; no task writes a literal version or ADR number.
- Task 1.1 now says what to do in both cases (ancestor: nothing; not an ancestor: merge, re-read D-3a's two lists,
  stop for a plan revision on a mismatch); round 2 item 2 is fixed. Task 2.2 moves only what is still in
  `release-merge.mjs` and says not to touch the pin helpers; round 2 item 1(a) is fixed. Task 8.1 no longer stops
  for `archive-release-pin`.
- Every task path falls under a real directory; every test it names exists (above).

## 7. Omission detection
Validation, error handling, idempotency, parsers (D-1, D-12), rollback, compatibility with older consumers, test
strategy and evidence (D-14 to D-16, red files, real runs of every variant): defined. Observability: the step's JSON
only, which is enough here. The plan's own base is stated and re-checked by task 1.1.

## 8. Execution risks (top 5 failures)
1. Cause: the base moves again before the implementation. Impact: a name D-3a lists is somewhere else. Prevention:
   task 1.1 re-reads D-3a's lists after the merge and stops for a plan revision.
2. Cause: a plain-commit release edit the masking misses (a citation form, a pin line). Impact: stale evidence
   after the step, one re-review per assignment. Prevention: D-15's per-form tests and P-1.
3. Cause: this change's dogfood (task 8.1) writes numbers on the branch and `main`'s installed train then joins it as
   an old-rule change. Impact: a manual command and one to two hours on the Avell per round. Prevention: D-17; the
   coordinator holds `main` at the release step.
4. Cause: `deliver-check.mjs` gains an import a consumer job cannot load. Impact: every consumer's `--ci` fails at
   load. Prevention: the three boundary tests and T-20.
5. Cause: the planner's stop hook refuses a stage that is not the plan's last. Impact: one extra planner turn.
   Prevention: D-11 places the check inside the `delivered` branch with `tasks.md` present, once per key.

## 9. Mandatory fixes before implementation
None.

## 10. Optional improvements (within scope)
- [ ] Low, fix during implementation: `design.md:242-243` and `tasks.md:137-138` say `trainCheck`'s message keeps
  the substring `release files, the CI pin, \`openspec/roadmap.md\` and` the record. The code's message
  (`deliver-check.mjs:2620`) holds the same words without backticks and ends in `${file}`; the backticked sentence is
  the flow page's CI paragraph, asserted by `delivery-train-after.test.mjs:197` (T-9, already in task 3.4). No test
  reads the code's message. Smallest correction: say "the CI paragraph keeps the substring" and leave the message as is.
- [ ] Low, fix during implementation: D-8 row A1 (`design.md:297`) does not say which reason wins when the
  readiness changed after the approval and the note changed too (no task ticked). Smallest correction: one clause,
  for example the existing reason first, since the owner approves again either way.
- [ ] Low: task 2.3 says `ADR_DIRS` and `ADR_LINES` move "here"; they come from two files (`conduct-check.mjs:376`,
  `change-loop.mjs:1593`). `changeAdrs` should read `ADR_LINES` with `matchAll` as `decisionRecords` does, because the
  regular expression carries the `g` flag.
- [ ] D-13 (carried): write the `ADRs:` entry of `openspec/config.yaml` as `ADR [release-at-merge] <subject>` as the
  design says; the existing entries for 0027 and 0030 stay untouched (T-41 reads them).

## 11. Explicitly out of scope
- [ ] Moving the ten open changes to notes; removing the old rule.
- [ ] The panel (an unknown step shows by its id).
- [ ] The archive check's pin-line rule, `PIN_LINE_FILES`, `pinLinesOnly` and the pin test: `archive-release-pin`,
  merged (ADR 0027, ADR 0030).

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes (`proposal.md` Why; `requirements.md`).
2. Is the result measurable? Yes: 15 acceptance criteria, each with a test file or a real-run case (tasks table).
3. Are error behaviors defined? Yes: exit codes and messages for the step and the join, `blocked` reasons for the
   checker, the planner stop with its key; every D-8 row has a scenario.
4. Are edge cases covered? Yes for the note, the numbering, the consumer variants, the old rule and the missing base;
   the one open edge (A1 with two causes) is Low and listed.
5. Are dependencies clear? Yes: `archive-release-pin` and `release-merge-leftovers` are in the base; nothing waits.
6. Are contracts defined? Yes: the note, the step's JSON, the rows, the approval line, the module boundary and its
   three tests.
7. Can two developers interpret this differently? Not on anything that changes behavior; the wording points of
   section 10 do not.
8. Are any decisions implicit instead of written? No; the four owner-overturnable decisions and F-1 to F-7 are
   written.
9. Do the tasks fully deliver the intended outcome? Yes: phases 2 to 5 build it, phases 6 and 7 prove each case
   and each agent variant (including the failure path through `guard.mjs subagent-stop`), phase 8 bootstraps and runs
   the suite.
10. What will be discovered too late if implementation starts now? Nothing found; the one thing that can move is the
    base, and task 1.1 catches it before task 2.2.

## 13. Final conclusion
- Can we start? Yes, after the owner approves the plan (with the `- Release note:` line, task 1.2).
- What must be fixed? Nothing before implementation; the three Low items of section 10 can be done in the first
  phase that touches those lines.
- Main risk if ignored? A reader of the `trainCheck` sentence edits a message no test pins; nothing breaks.
