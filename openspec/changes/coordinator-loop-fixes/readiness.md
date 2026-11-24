<!-- devkit-stage readiness result=passed attempt=11 commit=9edb3045c54678b48ba6c90b2abf34f45ecc5fa4 -->
# Readiness review: coordinator-loop-fixes

Reviewed at HEAD 9edb304 (clean tree). Since attempt 10 (written at 0484ec3, header commit 57967cc):
- Phase 2 is done. Gate 2.5 is ticked at a4be2b9.
- 3.0 merged `origin/main` a815222 (5aabd1c).
- 3.1 to 3.7 are implemented and ticked.
- 3.8's code is in a27d9c9. The task stays open because two existing tests that D-15 did not name went red.
- Plan revision 9edb304 is the only change to review. It edits `design.md` in three places: D-6 (`:565-575`), D-7's
  `TEXT` bullet (`:604-606`) and two rows of the D-15 table (`:943`, `:954`). It edits `tasks.md` in two places: 3.3's
  location text (`:231-232`) and 3.8 (`:283-296`). No spec delta and no code changed in the revision.

Checks run at HEAD:
- `openspec validate coordinator-loop-fixes --strict` and `... --type change --strict --no-interactive` both print
  "Change 'coordinator-loop-fixes' is valid".
- `python3 scripts/check.py` prints "all checks passed".
- All runs below used `TMPDIR=/var/tmp/devkit-coordinator-loop-fixes` and `--concurrency=2`. The whole suite was not
  run: the caller's notes forbid it, and gate 3.9 belongs to the conducting session.
  - 3.8's first Check run (`flow-check.test.mjs`, `deliver-check.test.mjs`): 169 + 253 tests. The only failure is
    "flow-check readout: both languages cover every reason code". It fails because `P` lacks `plan-revised`.
  - 3.8's one-test run (`^CLI --json carries the items, phases and next`, `deliver-check-cli.test.mjs`): 1 test,
    1 fail. The actual result differs from the expected one only by `conductor: []`.
  - 3.8's two "Then" runs, exactly as written: 4 files, 477 tests, 1 fail (the readout test); and 9 files,
    389 tests, 1 fail (the CLI test).
  - `^change-loop replies` (`change-loop.test.mjs`): 4 tests, all pass. This test refuses hyphenated reason codes and
    steps in the reply texts, so the new `plan-revised` and `conductor-task` break no reply.
  So the revision names exactly the tests that are red at HEAD, and the fixes it prescribes are the ones the failure
  diffs ask for.
- `openspec/config.yaml` is the same on HEAD and on a815222, the base that 3.0 merged. The local `origin/main`
  (be0c35d, train 16) changes only the `ADRs:` list of `context:` (it adds 0028). It adds no rule, so no new rule
  applies to the revision. `rules.readiness` is applied: the author of this report is not the plan's writer.

The caller gave no verdict, and this review relies on none.

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes. The revision closes the gap that stopped 3.8: two tests that the phase's own changes
  turned red, which D-15 did not list. Each one is now a D-15 row naming its invariant, layer and suite, and 3.8 runs
  both.

## 2. Scope validation
Classification: correct. The revision adds no behaviour. It names two test updates that follow from D-6's
`conductor` field and D-7's `plan-revised` code, and it corrects where 3.3's sentence sits.

## 3. Proposal review
No findings. The revision does not touch the proposal.

## 4. Design review
I re-checked each claim of the revision against the code at HEAD:
- D-6 (`design.md:565-567`) says `tdd-implementer.md` has no `## Work` section and places the sentence right after
  "Work through the phase's tasks in `tasks.md` order.". This holds. The file's sections are listed at
  `plugins/core/agents/tdd-implementer.md:11-111`, and the sentence is at `:50`.
- D-6 (`design.md:571-575`) says `readPhases` puts `conductor` on every phase. It does
  (`plugins/openspec/hooks/deliver-check.mjs:500-513`). D-6 also says the CLI test is "the one test that compares a
  phase of that report exactly". I listed every assertion on `phases` in the suite's test files:
  - `deliver-check.test.mjs:546` maps chosen fields only.
  - `:2852` is the new T63.
  - `:1883` checks the report's keys.
  - `deliver-check-archive.test.mjs:1609` uses `some`.
  - `conduct-check.test.mjs:1421-1434` checks another `phases`.
  Only `deliver-check-cli.test.mjs:205` compares a phase exactly, so the generalization holds. The statement that
  `version` stays 1 fits an added field.
- D-7 (`design.md:604-606`): `plan-revised` is in `TEXT.en` and `TEXT['pt-BR']`
  (`plugins/openspec/hooks/flow-check.mjs:381`, `:439`) and takes no parameters (`:563`), so the row
  `'plan-revised': {}` is correct. The test asserts `Object.keys(P)` equal to `TEXT.en`'s keys
  (`flow-check.test.mjs:1321`). Phase 3's diff of `flow-check.mjs` (5aabd1c..HEAD) adds no other code.
- The two rows of D-15 (`design.md:943`, `:954`) give the invariant, the layer, the suite, the fate and the tasks.
  This meets CLAUDE.md's rule for changing a test, and the preamble's rule "An existing test changes only where
  `design.md` D-15 names it" (`tasks.md:52-53`).

## 5. Specs review
No findings. Strict validation passes, and the revision touches no spec delta.

## 6. Tasks review
- 3.8 (`tasks.md:283-296`) names both edits and says "no other line of either test changes". Its Check names the
  readout test inside the `flow-check.test.mjs` run and adds a one-test run for the CLI test (`:292`). The second
  "Then" run gains the `^CLI --json carries the items, phases and next` pattern (`:296`). All three commands ran as
  written, and each failed only on the named test.
- 3.3's revised text (`tasks.md:231-232`) matches what was done (`tdd-implementer.md:50`). It is a ticked task, and
  only its description of the location changed.
- Gate 3.9 (`tasks.md:297`) is unchanged and follows D-17.
- Low: 3.8's first Check command (`tasks.md:289-290`) runs without `GITHUB_HEAD_REF`/`GITHUB_BASE_REF`. D-17 says
  "Each part runs with `GITHUB_HEAD_REF` and `GITHUB_BASE_REF` set" (`design.md`, D-17). The text was already like this
  at attempt 10. The "Then" runs set both variables. My runs of this command set them too, so I have no result
  without them. See section 10.

## 7. Omission detection
No findings. The revision adds no behaviour, so no new error path, rollout step or compatibility question comes with
it.

## 8. Execution risks (top 5 failures)
1. Cause: the local `origin/main` (be0c35d, train 16) now holds `forced-merge-path` as merged. The siblings table
   still lists it as "open" (`design.md:1226`, "State on c09860c"). That sibling edits `findChangePr` and
   `deliveryOf` in `deliver-check.mjs`, plus the `field-fixes 4` tests in `flow-check.test.mjs`. 3.7 (D-20) and 3.8
   (D-21, `prItem`'s merged arm) also edit `deliver-check.mjs`, and 3.8's Check runs the `field-fixes 4` tests.
   Impact: 4.0's merge meets conflicts in `findChangePr`, or a base-added test fails.
   Prevention: as planned. D-17 has the session fetch before 4.0, the implementer re-read each named function after
   the merge (and stop on a contradiction), base-added tests run first, and a failing one becomes a D-15 row through
   one plan revision.
2. Cause: gate 3.9's whole suite finds a red test outside 3.8's filtered runs.
   Impact: `gate-red` hands a `fix-gate`, or the plan needs a third phase-3 revision.
   Prevention: as planned (D-3, D-17). My grep for assertions on `phases`, on `TEXT`'s keys and on the step list
   found no other dependent test.
3. Cause: the session runs gate 3.9 in the foreground.
   Impact: the Bash tool's 10-minute ceiling cuts the run.
   Prevention: the plan says "in the background" (`tasks.md:36-38`), and so does CLAUDE.md.
4. Cause: `deliver-check.test.mjs` keeps growing.
   Impact: it crosses CONTRIBUTING's 300 s.
   Prevention: as planned (the D-16 split rule). Here it took 193.5 s and 224.4 s, each time run together with
   `flow-check.test.mjs` at concurrency 2, not alone.
5. Cause: a sibling takes 0032 or 0033 before 6.1.
   Impact: stale ADR links.
   Prevention: as planned (`renumber-adr`). On the local `origin/main` the highest ADR is 0030.

## 9. Mandatory fixes before implementation
No findings.

## 10. Optional improvements (within scope)
- [ ] Low, Nice to have: in `tasks.md:289-290`, 3.8's first Check command has no `env GITHUB_HEAD_REF=probe-branch
  GITHUB_BASE_REF=main` prefix, unlike D-17's rule and the other runs of 3.8. Smallest correction: add the prefix.
- [ ] Low, Nice to have: D-15's search list (`design.md:892-907`) does not include the two kinds of assertion that
  this revision added rows for: an exact `deepEqual` of a phase of the `--json` report, and the reason-code table
  `P`. Smallest correction: add "`phases`" and "the keys of `TEXT`" to the list, so that the next phase's search
  covers them.
- [ ] Low, Nice to have: `design.md:1180-1181` and `tasks.md:36-38` attribute "in the background" to the `gate` item
  of `plugins/openspec/skills/devkit/SKILL.md`, which says "alone" (`:114`). Carried.
- [ ] Low, Nice to have: `docs/adr/0033-a-changes-own-settings-live-in-an-x-devkit-block.md:53` still says that ADR
  0023's "`## Decision` section [is] untouched". Carried.
- [ ] Low, Nice to have: `proposal.md` is longer than `rules.proposal`'s "under two pages". Carried.

## 11. Explicitly out of scope
- [ ] Reviewing the code of 3.1 to 3.8. That is the review bench's job after the phase.
- [ ] Updating the siblings table's states before 4.0's merge.
- [ ] Everything attempts 7 to 10 listed as out of scope.

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes. Two named tests are red at HEAD, and the failure diffs show the cause.
2. Is the result measurable? Yes. 3.8's three commands each have a test count and a pass/fail result.
3. Are error behaviors defined? Yes. A red gate goes through D-3. A base-added red test goes through D-17 and D-15.
4. Are edge cases covered? Yes. `plan-revised` takes no parameters, and `conductor` is `[]` when no task is marked.
5. Are dependencies clear? Yes. 3.8 comes before 3.9, and 4.0's merge follows the conducting session's fetch.
6. Are contracts defined? Yes. The `--json` report stays version 1 with an added field. `TEXT` and `P` stay equal.
7. Can two developers interpret this differently? No. Both edits are given literally, and the rest of each test is
   fixed.
8. Are any decisions implicit instead of written? No.
9. Do the tasks fully deliver the intended outcome? Yes. 3.8's Check now passes once the two edits are made.
10. What will be discovered too late if implementation starts now? Nothing at the plan level for phase 3. The
    known later meeting is `forced-merge-path` at 4.0 (risk 1).

## 13. Final conclusion
- Can we start? Yes. Finish 3.8 with the two D-15 updates, then the conducting session runs gate 3.9.
- What must be fixed? Nothing mandatory. The five Low items are optional.
- Main risk if ignored? The Lows only risk wording drift and a run without the CI environment. The real risk is
  4.0's merge of `forced-merge-path` into the functions that 3.7 and 3.8 edited, and D-17 plans for that merge.
