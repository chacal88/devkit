<!-- devkit-stage readiness result=passed attempt=2 commit=d2010cafc71627b2d8d365d75af477fbecd0e736 -->
# Readiness review: archive-release-pin

Round 2. Reviewed at `d2010ca` (the plan files are uncommitted in the worktree). `openspec validate archive-release-pin --strict`: valid. `python3 scripts/check.py` and `python3 scripts/gen-catalog.py --check`: pass. I re-ran two phase gates on the base, filtered only and with the private `TMPDIR`: gate 1.5 part 1 (the conduct-check entry, eight name patterns): 65 tests, 65 pass, exit 0; gate 2.4 hook part (`guard.test.mjs`, twelve name patterns): 27 tests, 27 pass, exit 0. The caller's instructions were to work only on the plan and to run no whole suite; no instruction on the verdict was given.

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

Both round-1 blockers are fixed in the artifacts, and a full re-review found no new blocker.

Round-1 blockers:

1. Task 2.3 literal versions. Fixed: `tasks.md` task 2.3 now reads `version` from `git show origin/main:plugins/openspec/.claude-plugin/plugin.json` and `metadata.version` from `git show origin/main:.claude-plugin/marketplace.json`, takes "the next free minor of each, as read on `origin/main` at the last merge of `main` before review; never copy a number from this file or from `design.md`", and its check uses `<previous>` as a placeholder. The parenthetical with `0.34.0` and `0.38.0` is gone. `design.md` D-9 keeps the literals and says they are re-taken from `origin/main` before each push, which the `rules.tasks` rule allows (it binds tasks).
2. Unpinned unterminated and empty input. Fixed: `design.md` D-6 test 5 now asserts `false` for a lost and for a gained final newline on both pin files, for an empty `before` against a non-empty `after` (doc `'a\n'`, test file `'x\n'`), and `true` for empty against empty on both files. Task 1.2 lists those cases as negatives and positives. I re-derived each against `setPins` (`release-merge.mjs:138`, split and join on `\n`) and the D-2 line rule: `''` against `'a\n'` masks to two different strings, so `false`; `[''] ` against `['x', '']` differ, so `false`; `'a\nb\n'` against `'a\nb'` splits to three and two elements, so `false` for both files; `''` against `''` is equal, so `true`. Every case lands on the value the test table states. The spec delta also gained the scenarios the round-1 notes asked for: unreadable, only the final newline changed, and an empty file at the merge base (`specs/reviews-check/spec.md`).

Two round-1 optional items were also taken: the design no longer says ADR 0023 cites `release-merge-conflict 16` (design.md assumptions now state 15 is right and the 16 in requirements.md is the grill's record), and D-1 now carries the no-`release-merge`-string wording rule that test 10 needs.

## 2. Scope validation
Classification: correct

One gap: a retro that bumps devkit-openspec stops on `apply-proposals` because `unnamedFiles` exempts only paths. Scope is two files checked by content, one shared function, and the pin definition moved. The non-goals (no `RELEASE_FILE` growth, no staleness change, no bump requirement, no manifest-reading test) are explicit and match ADR 0023. The spec delta adds nothing the proposal does not justify.

## 3. Proposal review
- Problem and goal are clear, with the owner's grill answers recorded in `requirements.md` and ADR 0023.
- Capability `reviews-check` is modified; the delta is ADDED requirements and contradicts no existing one.
- Impact names the hooks, tests, docs and release files. Importers of `pinsIn`, `setPins` and `PIN_FILE` are all named.
- Non-goals are tight; the risks are in the design's risk table.

## 4. Design review
No ADR conflict: ADR 0023 is the new record and amends ADR 0003 by the ADR 0018 pattern (header line plus Note). No metadata or current-state files are used beyond `openspec/roadmap.md`, which the plan ticks at archive.

Claims re-derived against the code at `d2010ca` (round 1 verified them all; I re-opened the load-bearing ones this round):

| Claim | Result |
|---|---|
| `unnamedFiles(paths, proposals)` at `deliver-check.mjs:1128`, `RELEASE_FILE` at 1124, `archiveChanges` at 1110 returns `{ missing }` or `{ paths }` | true |
| callers `filesStop` (1441) and `archivePrCheck` (2202) | true (round 1) |
| pin definition at `release-merge.mjs:129-141`; `PIN_MARKER` and `PIN_TOKEN` module-private; `pinsIn` and `setPins` exported | true, read again this round |
| `deliver-check.mjs` has no "release-merge" text today | true |
| consumer CI downloads three files; `merge-setup.test.mjs:184` | true (round 1) |
| c561553 hunks and fixture line counts 15, 15, 7, 8 | true (round 1) |
| `release-merge-conflict 15` is the `pinMismatches` test and 16 the release-step docs test | true |
| every existing test name used in a gate pattern matches at least one test | true: the two re-run gates ran 65 and 27 tests |

The failure modes are decided and fail closed: a missing or unreadable side, an unknown path, a CRLF line, a changed final newline. An empty text is a text. Rollback (revert the merge) and compatibility (a caller that passes no texts gets today's answer) are stated.

## 5. Specs review
Four requirements, each with SHALL and WHEN/THEN scenarios, and each AC of `requirements.md` maps to a scenario or a D-6 test. The delta now covers: pin-only move, sentence beside the pins, a pin line with other words, the real c561553 for both files, other line changed, new file, deleted file, unreadable file, only the final newline changed, empty file at the merge base, CI pass from three files, CI beyond the pin, and a conflict beyond the pin. Every outcome row of the D-2 decision list (false for missing, unreadable, other path, CRLF, final newline; true for empty against empty) has a scenario or a named test case.

## 6. Tasks review
- Three phases, each ending in a gate task naming a backticked command; every AC id (AC-1 to AC-10) appears in the table and in at least one task. Test first: red runs saved at tasks 1.2 and 2.1.
- Every task path falls under a real directory; `plugins/openspec/hooks/fixtures/` is created by task 1.1, which re-runs the two repository-wide scan tests.
- Gates on the base: results in the Decision section. The whole suite is the owner's background run of phase 3.
- `rules.tasks`: no task writes a literal version (2.3 fixed); no task writes an ADR (ADR 0023 exists and is accepted by the loop; task 1.1 stops if it is not).
- Tests that assert changed text: D-7 greps for them and lists the one existing test edited, the one helper and the helper added.

## 7. Omission detection
- Validation, error handling, fail-closed reads, idempotency, permissions: covered (D-2, D-3). No retries needed (two local git calls).
- Parsers rule of `openspec/config.yaml`: unterminated input and empty input are decided (D-2) and now tested (test 5) and specified.
- Observability: the stop reason `files no approved proposal names: <path>` is unchanged.
- Test strategy: D-6 table with 11 tests, plus a real-run proof (D-10) of eight cases including the three-file run, with the local stop proved through `collectState` and the fake `gh`, stated as such.

## 8. Execution risks (top 5 failures)
1. Cause: the test-file rule drops form lines anywhere in the file. Impact: an assertion moved into another test passes. Prevention: accepted and recorded in ADR 0023's review trigger and D-2.
2. Cause: a sibling release takes the next minor or ADR number 0023 first. Impact: a re-merge, evidence and review (1-2 h on this machine). Prevention: task 2.3 reads `origin/main`; the workflow follow-up re-checks before each push.
3. Cause: the content read fails on a shallow checkout. Impact: a pin-only archive stops. Prevention: fail closed; both workflows fetch full history.
4. Cause: a later refactor of the line split loosens CRLF or final-newline handling. Impact: the rule silently loosens. Prevention: test 5 now pins both.
5. Cause: the pin markers change shape. Impact: the doc rule stops matching and every bump stops again. Prevention: ADR 0023's review trigger; fail closed.

## 9. Mandatory fixes before implementation
None.

## 10. Optional improvements (within scope)
- [ ] Low — `openspec/changes/archive-release-pin/requirements.md:22` — still cites `release-merge-conflict 16` for the pin-versus-manifest guard; the design records that 15 is the right test. Fix at the next edit of requirements.md, or leave as the grill recorded it.

## 11. Explicitly out of scope
- [ ] Making the test read its pin from the manifest (a later roadmap line).
- [ ] Tightening the test-file rule so a form line cannot move between tests (accepted looseness).
- [ ] `stale-only-on-own-files` and any growth of `RELEASE_FILE`.

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes: two files, one stop, one commit (c561553) as the real case.
2. Is the result measurable? Yes: ten ACs, each with a test of D-6 or a case of D-10.
3. Are error behaviors defined? Yes, all fail closed, and each has a test.
4. Are edge cases covered? Yes: CRLF, escaped quotes, missing sides, deleted file, new file, final newline, empty text.
5. Are dependencies clear? Yes: ADR 0023 accepted before phase 1 (task 1.1 stops if not), the consumer CI's three files, release numbers read from `origin/main`.
6. Are contracts defined? Yes: `pinLinesOnly(path, pair)`, `unnamedFiles(paths, proposals, texts = {})`, `archiveChanges` gaining `texts`, the re-export.
7. Can two developers interpret this differently? No divergence found; the rule, read and tests are specified to the line.
8. Are any decisions implicit instead of written? No.
9. Do the tasks fully deliver the intended outcome? Yes, including docs, ADR 0003's header and Note, the config line, the release and the proof.
10. What will be discovered too late? A release or ADR number taken by a sibling, handled by the follow-up and the `origin/main` read in task 2.3.

## 13. Final conclusion
- Can we start? Yes.
- What must be fixed? Nothing before implementation.
- Main risk if ignored? A sibling release or ADR landing first and costing a re-merge; the plan's follow-up and task 2.3 already cover it.
