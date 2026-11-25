<!-- devkit-stage readiness result=failed attempt=13 commit=0b71037ae0184af4bffa050a6cb279087de825a0 -->
# Readiness review: coordinator-loop-fixes

Reviewed at HEAD 0b71037. The last readiness report (attempt 12, header commit 8c62468) approved the plan of 8504644,
and the owner approved that plan at 84da214 (approval header commit d8f81ed). Since 84da214 the plan files changed in
the review round 1 fixes only. `git diff 84da214 HEAD` on `proposal.md`, `design.md`, `tasks.md`, `specs/` and
`docs/adr/` shows:
- `specs/change-coordination/spec.md:318-330`: the requirement "The owner authorizes one more review round after the
  limit" now names `declare <id> review-round --stdin words`, and adds the scenario "The owner's words are recorded as
  typed".
- `specs/file-writers/spec.md:49`: the scenario "A subagent runs the declare command" now covers node option words
  before the script.
- `design.md:265` and `:271-272` (D-1, `DECLARE_CALL` skips node option words), `:444-447` and `:483-487` (D-4,
  `--stdin words` and the quoted heredoc in both skills), `:1071` (T44), `:1126` (T99), and the new rows T143 to T148
  (`:1170-1175`).
- `tasks.md`: checkbox ticks of 6.4 to 6.6 only. No task text changed.
- `docs/adr/0032-...md:78-88` (a dated Note in `## Decision`) and `docs/adr/0023-...md:5` (an `- Amended by ADR 0033`
  header line), plus `docs/compozy-kit.md:127-128`.

The caller gave facts and no verdict. Nothing in its message was taken as a verdict.

Checks run at HEAD (`TMPDIR=/var/tmp/devkit-coordinator-loop-fixes`; before the test run, `pgrep -f
'scripts/test-suite.mjs$'` found no other run):
- `openspec validate coordinator-loop-fixes --type change --strict --no-interactive`: "Change 'coordinator-loop-fixes'
  is valid".
- `python3 scripts/check.py`: exit 1, `openspec/changes/coordinator-loop-fixes/evidence.md:91: non-English text`. That
  line is in the evidence, not the plan. See section 7.
- `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=3
  --test-name-pattern="^coordinator-loop-fixes AC-(1|7|9|19) T(44|9[6-9]|10[0-2]|14[3-8]) "` over
  `change-loop-declared.test.mjs`, `guard.test.mjs` and `conduct-check.test.mjs`: 3 files, 14 tests, 14 pass, 33.9 s.
- `openspec/config.yaml` is unchanged since 84da214, so no new rule applies. `origin/main` (fc28735) is an ancestor of
  HEAD.
- The whole suite was not run. The caller's notes forbid it.

## 1. Decision
- Status: NEEDS-REVISION
- Confidence: high
- Ready to implement: no

The revised design and spec deltas are sound, and the code matches them (section 4). Two narrow gaps remain:
- `tasks.md` was not revised with them.
- D-12 does not give the words of the three document edits the revision made.

Both fit in one change-planner edit, and neither changes scope.

## 2. Scope validation
Classification: correct.
- `--stdin words` closes the round 1 code-quality finding: owner words that pass through the shell can run a command
  substitution. It reuses `reply`'s existing `--stdin` contract (jira-entry-followups D-5).
- The option-word skip widens an existing guard rule.
- T146 adds a test only.
- The ADR 0032 Note records limits that the approved plan already held:
  - AC-10 at `proposal.md:64` ("the CompozyOS driver keeps asking the owner at a red gate").
  - The `stop-archive` for an archive that left a train, at `design.md:112` and `:165`.
  - An approval without `- Plan:` never goes stale, at `design.md:634` and `:688`.
- The ADR 0023 header line records the amendment that ADR 0033 already makes.

No capability was added. `CHANGELOG.md:3-24` (0.53.0) already covers the `declare` command and both ADRs, so no
release line changes.

## 3. Proposal review
No findings. The proposal is unchanged. AC-7 (`proposal.md:61`) does not name the CLI form of the owner's words, so
the switch from `--param words` to `--stdin words` stays within it.

## 4. Design review
Each revised claim was re-derived against the code:
- D-4, `--stdin words`:
  - `runDeclare` is at `plugins/openspec/hooks/change-loop.mjs:3305-3313`. It parses `--stdin` and refuses any other
    well-formed name with "declare --stdin reads only words" (`:3310`).
  - It shares `withStdinParam` with `runReply` (`:3294-3301`, `:3338`). That helper applies the name rule, refuses
    the same parameter named twice, removes one final `\r\n` or `\n` (`withoutFinalBreak`, `:3289`), and refuses an
    empty input with "needs the text on standard input".
  - The entry point reads standard input for `declare` only when `--stdin` is given (`:3582`).
  - `USAGE` names `[--stdin words]` (`:3172`). No test file asserts the usage text: a grep for
    `gate-red|review-round` finds no hit, so the `Existing tests:` rule adds no row.
  - All of this matches `design.md:444-447` and T143 to T145.
- D-4, the skills:
  - The ship-change `stop-review-deadlock` row (`plugins/openspec/skills/ship-change/SKILL.md:60`) holds `--stdin words`,
    the quoted heredoc and "its terminator rule (the `devkit` skill's)".
  - The devkit skill's Owner gates (`plugins/openspec/skills/devkit/SKILL.md:151`) holds the full heredoc call.
  - The terminator rule exists at `devkit/SKILL.md:34`.
  - Neither skill holds `--param words`, which T44 asserts.
  - All of this matches `design.md:483-487`.
- D-1, the guard:
  - `DECLARE_CALL` (`plugins/openspec/hooks/guard.mjs:746`) is the regex at `design.md:265`, byte for byte.
  - A probe of `declareViolation` for `devkit-core:tdd-implementer` refuses the skill's heredoc form and `node
    --no-warnings <path> declare ...`. It allows `node -r ./x.cjs <path> declare ...` and `node --stack-size 2000
    <path> declare ...` (round 2 code-quality nit F9). See section 10.
- T146: `conduct-check.test.mjs:1641` exists and passes.
- T147 and T148: they read the ADR files by pattern (`change-loop-declared.test.mjs:1269`, `:1293`), not by literal
  number, so `renumber-adr` keeps them valid. Both pass.
- The ADR 0032 Note's three limits each have a source in the approved plan (section 2), and decisions 1 to 8 are
  unchanged (T147 holds them). This is the change's own ADR (`decisions.md`), and the Note changes no decision's
  text. So the design rule "a decision that changes an ADR is a proposal for a new ADR" is not triggered.

Findings:
- Medium, Mandatory before implementation: `design.md:758-803` (D-12 Documents) gives the words of ADR 0011's Note
  (`:760-765`) and of every other document edit, but it has no entry for the three edits of the revision:
  - The ADR 0032 Note (`docs/adr/0032-...md:78-88`) is described only by the fragments T147 asserts
    (`design.md:1174`).
  - The ADR 0023 header line is described only by T148 (`:1175`).
  - The D-12 `docs/compozy-kit.md` entry (`:800-803`) still says "one sentence", while the file now adds a second
    sentence that points at the Note (`docs/compozy-kit.md:127-128`).

  `tasks.md:6` promises that "every text, name, test and command is in `design.md`". The Note narrows the reach of
  four decisions of an accepted ADR, and the owner approves the plan, so its words belong in the plan.

  Smallest correction: add D-12 bullets that quote, as committed in 3ec3322 and 5dc0830, the ADR 0032 Note (its
  place, after decision 8 and before `## Consequences`), the ADR 0023 header line (with "the number the settings ADR
  has at the last merge"), and the compozy-kit pointer sentence.

## 5. Specs review
Strict validation passes. The new scenario (`specs/change-coordination/spec.md:328-330`) and the widened scenario
(`specs/file-writers/spec.md:48-50`) each have tests: T143 to T145, T144 through a real `bash`, and T99.

Findings:
- Low, Nice to have: `specs/change-coordination/spec.md:330` says `declared.json` "holds the words byte for byte".
  D-4 cuts the words to 200 characters (`design.md:450`; `change-loop.mjs:3250`, `words.slice(0, 200)`), so the
  scenario is false for longer words. Smallest correction: "byte for byte (up to the 200 characters D-4 keeps)".
- Low, Nice to have (carried from the round 2 spec-reviewer nit F1, not part of this revision):
  `specs/change-stages/spec.md:8` says "every file under `specs/`". `specFiles` takes only `.md` files
  (`deliver-check.mjs:2018-2025`), as D-7 does.

## 6. Tasks review
Finding:
- Medium, Mandatory before implementation: `tasks.md` carries none of the revision.
  - `tasks.md:10` still says "D-16 the new tests (T1 to T142, ...)", but D-16 now ends at T148 (`design.md:1170-1175`).
  - No task writes T143 to T148. No task names the units they test:
    - `runDeclare`'s `--stdin words` and `withStdinParam`.
    - `DECLARE_CALL`'s option words.
    - The two skill rows' heredoc wording.
    - `conduct-check`'s `conductor-task`.
    - The ADR 0032 Note, the ADR 0023 header line and the compozy-kit sentence.
  - The tasks that own these areas list their tests by number, and none of them covers the new rows: 2.1 and 2.3
    ("T32 to T44, T95 to T97, ..."), 1.2 (T98 to T104), 3.x (T62 to T68) and 5.1 (T135 to T140).
  - The trace table rows AC-7 (`tasks.md:66`), AC-9 (`:68`) and AC-19 (`:79`) name no task for T143 to T148. AC-1
    (`:60`) and T99's widened row (task 1.2) are in the same position.
  - The new scenario is still verified: 6.5's `^coordinator-loop-fixes` pattern runs the three files whole by prefix,
    and gate 6.6 runs the whole suite. But no task delivers it.
  - Every earlier plan revision got its own task with a red-first Check (6.4a to 6.4c, `tasks.md:489-524`). This
    one breaks that pattern, so an implementer working from `tasks.md` would not build the revised behaviour.

  Smallest correction:
  - Add one task after 6.4c (for example "6.4d, review round 1 fixes") that names the units above and writes T143
    to T148, with T99 and T44 brought to their D-16 rows. Its Check is the command this review ran (14 tests, 14
    pass).
  - Set `tasks.md:10` to "T1 to T148".
  - Add the task to the AC-1, AC-7, AC-9 and AC-19 rows.

  Whether the task is written ticked (the code exists) is the planner's call. Ticking is not a plan edit for D-7.

Gate 6.6 is unchanged, and it is still the train's command (the `Gates:` rule).

## 7. Omission detection
- Error handling of `--stdin words`: defined, with exit 3 and nothing recorded (`design.md:445-447`, T145).
- Unterminated input (the `Parsers:` rule):
  - An empty input, or one line break, is a usage error.
  - A heredoc line equal to the terminator falls under the devkit skill's terminator rule (`devkit/SKILL.md:34`).
- Idempotency, rollback and migration: unchanged.
- Outside the plan, High, Fix during implementation: `python3 scripts/check.py` fails at HEAD on
  `openspec/changes/coordinator-loop-fixes/evidence.md:91`. The line quotes the nested session's Portuguese reply
  from ver-r7s. Gate 6.6 (`tasks.md:536`) and the train's command both include `check.py`, so the train would go red.
  Owner: `devkit-core:pr-verifier`, which writes `evidence.md`. It should state that reply in English, or point at
  the proof file. This does not count as a plan blocker.

## 8. Execution risks (top 5 failures)
1. Cause: the plan is approved as it is, and a later verifier or reviewer reads `tasks.md` as the record of what was
   built. Impact: T143 to T148 and the `--stdin` contract look like scope creep, and the next review round reopens
   them. Prevention: the task of section 6.
2. Cause: the train runs `python3 scripts/check.py` with evidence.md:91 as it is. Impact: the train goes red after
   the review. Prevention: the evidence fix in section 7.
3. Cause: a subagent runs `node -r <m> <path>/change-loop.mjs declare ...`. Impact: the guard allows it, and a
   subagent records a declared step. Prevention: the parser decision in section 10. The cost is low today because
   no prompt of the kit writes that form.
4. Cause: `renumber-adr` renumbers ADR 0033 at a later merge. Impact: the ADR 0023 header line names the old number.
   Prevention: `renumber-adr` carries references (`design.md:790-793`), and T148 reads the number by file pattern,
   so it fails if the line is not carried.
5. Cause: the owner's words exceed 200 characters. Impact: `declared.json` holds a truncated text, against the
   scenario's literal wording. Prevention: the wording fix in section 5.

## 9. Mandatory fixes before implementation
- [ ] Medium — `tasks.md:10`, `:60`, `:66`, `:68`, `:79`, and a new task after 6.4c (`:513-524`). The revision
  (T143 to T148, `--stdin words`, `DECLARE_CALL` option words, the skill rows, T146, the ADR 0032 Note, the ADR 0023
  header, the compozy-kit sentence) has no task, and the D-16 range is stale. Smallest correction: one task naming
  the units and tests, with the Check of section 6, "T1 to T148", and the AC rows updated.
- [ ] Medium — `design.md:758-803` (D-12). The words of the ADR 0032 Note, the ADR 0023 header line and the
  compozy-kit pointer sentence are not in the design. Smallest correction: three D-12 bullets that quote them as
  committed (3ec3322, 5dc0830), with the D-12 compozy-kit entry's "one sentence" brought to match.

## 10. Optional improvements (within scope)
- [ ] Medium, Fix during implementation: `design.md:271-280` (D-1 parser decisions). The parser decisions do not say
  what happens to a node option whose value is a separate word (`-r <module>`, `--stack-size <n>`). `DECLARE_CALL`
  does not match that form (probed above), while the requirement at `specs/file-writers/spec.md:31-34` refuses "a
  subagent's Bash command that runs `change-loop.mjs declare`". Smallest correction: one parser-decision sentence.
  Either the form is not matched, as for any command built from variables, because the rule judges text. Or widen
  the regex and add one case to T99.
- [ ] Low: `specs/change-coordination/spec.md:330`, "byte for byte" qualified by D-4's 200-character cut.
- [ ] Low: `specs/change-stages/spec.md:8`, "every file under `specs/`" becomes "every `.md` file under `specs/`".
- [ ] Low (carried from attempt 12): `design.md:1334`. D-20's "two readers" is three, now that `findByCommits` skips
  archive heads.

## 11. Explicitly out of scope
- [ ] The round 2 code-quality nit F3 (`planDigest`'s checkbox regex and `- [text]` links). It is a code nit on an
  approved D-7 rule, not part of this revision.
- [ ] Whether the owner lets this revision ride the earlier approval. The owner decides; this report changes the
  readiness hash, so `approval.md` must be recorded again in any case.

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes. The round 1 findings name the shell path of the owner's words, the
   option-word gap and the missing `conductor-task` test, each with a file and line.
2. Is the result measurable? Yes. T143 to T148 and T99 are concrete. They pass at HEAD (14 of 14 by name).
3. Are error behaviors defined? Yes. `--stdin` of another name, the words named twice and an empty input each exit 3
   and record nothing (`design.md:445-447`).
4. Are edge cases covered? Mostly. Hostile characters, the final line break and the heredoc terminator are covered.
   Two gaps stay: an option with a separate value is not decided (section 10), and the 200-character cut is not in
   the scenario (section 5).
5. Are dependencies clear? Yes. `withStdinParam` is shared with `reply`, and the terminator rule lives in the devkit
   skill.
6. Are contracts defined? Yes, for the CLI. The ADR texts are not given in D-12 (section 9).
7. Can two developers interpret this differently? Yes, for the ADR 0032 Note's wording. Only T147's fragments bind
   it.
8. Are any decisions implicit instead of written? Yes, two: the Note's text, and what happens to option values in
   the guard.
9. Do the tasks fully deliver the intended outcome? No. No task delivers the revised scenario or T143 to T148.
10. What will be discovered too late if implementation starts now? That `check.py` is red on `evidence.md:91` (at
    the train), and that `tasks.md` does not record the revised work (at the next review).

## 13. Final conclusion
- Can we start? No, not as the plan stands. The code is already built and its tests pass, so what is left is a
  plan edit: change-planner adds the task and the D-12 bullets of section 9, the readiness review runs again, and
  the owner approves the revised plan.
- What must be fixed? Two items, both Medium and Mandatory (section 9). Separately, the verifier must fix
  `evidence.md:91` before the train.
- Main risk if ignored? Approving a plan whose tasks do not describe the delivered work. The next review round then
  meets the same "revised without its gates" objection, and the train fails `check.py`.
