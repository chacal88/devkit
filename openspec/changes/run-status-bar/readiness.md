<!-- devkit-stage readiness result=passed attempt=4 commit=a11521bd439a1a20d302abf4d7f7f82fc930a32f -->
# Readiness review: run-status-bar (attempt 4)

Reviewed at `a11521b` (the branch has not merged `origin/main`, as the plan says); every claim about code was re-derived on `origin/main` at `3af3655`, extracted with `git archive` into a scratch folder, not on the stale worktree. `openspec validate run-status-bar --strict`: valid (run here). `python3 scripts/check.py` and `gen-catalog.py --check`: green as the caller ran them; `check.py` also passes on the scratch copy after the bump below. The full suite and `claude plugin validate .` were not run (plan stage).

This round I did run the 3.1 bump in the scratch copy of `3af3655` (version 0.40.0, marketplace 0.44.0, the doc's pins moved, a `## 0.44.0` heading, E-3 applied as D-11 words it). The scratch folder is no git repository, so the whole-file suite runs failed on git calls and say nothing; I ran the four tests of the 3.1 check by name instead. They pass (see section 6, 3.1).

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

The attempt-3 mandatory finding (the third release-pin test, `change-loop-compozy.test.mjs`) is fixed in `design.md` (D-11 E-3, D-13) and `tasks.md` (preamble, 3.1), and the fix works when run. The two optional items are fixed. No open mandatory finding.

## 2. Scope validation
Classification: correct. One new capability (`status-line`), two additive requirements on `change-state`, no budget, no panel, no settings write. The revision added no scope: E-3 is the release bump's own edit, as every earlier release did with it.

## 3. Proposal review
Unchanged since attempt 2; it holds. Problem, outcome, in and out of scope are explicit.

## 4. Design review
Attempt-3 items, re-derived on `3af3655`:

- E-3 anchors. `plugins/openspec/hooks/change-loop-compozy.test.mjs`: the test `change-loop docs: the design records the answers` opens at line 325; the comment is line 359 (it begins `// Invariant: the CI snippet pins the current release` and lists the earlier releases); line 360 is `assert.match(flow, /v0\.39\.0/, 'the CI snippet pins the current release (stale-only-on-own-files: 0.39.0)')`; line 361 is `assert.doesNotMatch(flow, /v0\.38\.0/, ...)`. Every anchor in D-11 E-3 is true.
- Doc pins. `docs/openspec-flow.md:733` (`pinned to the commit of v0.39.0`), `:734` (`<commit sha of v0.39.0>`), `:747` (`` `v0.39.0` above `` and `git/ref/tags/v0.39.0`). These are the only three occurrences of `v0.39.0` in the doc; a repository-wide grep for `0.39.0` and `0.43.0` outside the CHANGELOG and archived changes finds only those three lines, the test lines 359-360, `plugin.json:3` and `marketplace.json:9` and `:23`.
- Release. `plugin.json` 0.39.0, marketplace metadata 0.43.0, devkit-openspec entry 0.39.0; `CHANGELOG.md:3` is `## 0.43.0 — ...`. The rule in `openspec/config.yaml:52` (a version task names "the next free number on origin/main at the last merge before review") holds: 3.1 names no literal new version; the `0.39.0` literals are anchors at `3af3655`, which I ran.
- Other pin tests. `deliver-check-cli.test.mjs:1228` and `:1238`, and `release-merge.test.mjs:409`, read `plugin.json`'s version and compare the doc to it; none holds a literal. The tail of E-3's own test (`pinMismatches(flow, version)`) reads the manifest too. `PIN_MARKER` is `release-merge.mjs:132`. No other file names `commit sha of v`, `PIN_MARKER` or `pinMismatches` outside these. `version-pin.test.mjs` does not read the doc's release.
- `state` internals, unchanged between `298c3f3` and `3af3655`: `git diff --stat` shows no change to `change-loop.mjs`, `roadmap-loop.mjs`, `merge-setup.mjs` or `run-file.mjs`; `flow-check.mjs` changes 6 lines, none in `artifactState` (`:434`). `nextAction` `change-loop.mjs:1432`, `stateEntries` `:1816`, `runState` `:2965`, `readStdin()` `:3185` with `STDIN_WAIT.ms` 10000 (`:3184`) and no parameter, `OFFLINE_GH` local at `roadmap-loop.mjs:852`, used at `:894` and `:939`. The plan's claims hold.
- Release-bump simulation. In the scratch copy of `3af3655` I moved the three doc lines to `v0.40.0`, `plugin.json` and the marketplace entry to 0.40.0, the marketplace to 0.44.0, added a `## 0.44.0` heading, and edited line 360 to `/v0\.40\.0/` with a `doesNotMatch` for `v0\.39\.0` right after it. Results: `change-loop docs: the design records the answers` pass; `the pin in docs/openspec-flow.md is the commit sha of v + ...` and `AC-8 release-ready: ...` pass; `release-merge pin: the real docs/openspec-flow.md: ...` pass; `check.py` all checks passed. The E-3 edit is therefore both necessary (the unedited line 360 would fail once the doc holds no `v0.39.0`) and sufficient.

## 5. Specs review
No change since attempt 3: every outcome row of D-1 to D-9 has a scenario in `specs/status-line/spec.md` or `specs/change-state/spec.md`. No gap.

## 6. Tasks review
Walk of every check, in the order of `tasks.md`:

- 1.1: `git merge-base --is-ancestor 3af3655 HEAD` after the merge, then `flow-check.test.mjs` and `change-loop-remote-state.test.mjs` (both exist at `3af3655`; `scripts/test-suite.mjs` takes file arguments). Can pass.
- 1.2: `--test-name-pattern="^run-status-bar"` is a form the script accepts (`test-suite.mjs` `parseArgs`), and D-11 names every new test `run-status-bar <AC-n> <area>: ...`. `flow-check.test.mjs` fails at load on the missing exports; the check now says S-6 and S-10 pass on the base and why (attempt-3 optional 1, fixed). Can fail as written.
- 1.3: H-1 to H-8 and the existing `flow-check.test.mjs` tests. Can pass.
- 1.4: S-1 to S-6, S-12, E-1; none uses `--offline`. Can pass.
- 1.5: S-7 to S-11 and the three roadmap-loop files; `merge-setup.mjs` imports only `node:child_process`, so no import cycle. Can pass.
- 1.6: E-2 and `check.py`. Can pass.
- 1.7: gate. Can pass.
- 2.1: the test file statically imports `status-line.mjs`, so it fails at load with the missing module. Can pass.
- 2.2: the stub exports `main`, `inputOf`, `lineOfChange`, `countsLine`, `columns`, so the file loads. The B-ids of 2.2 and 2.3 together cover B-1 to B-46 once each. Can pass.
- 2.3: B-7, B-9, B-10, B-20 to B-35, B-37, B-38, B-42, B-43. Can pass.
- 2.4: `check.py` and the entry equal to D-1. Can pass.
- 2.5: gate. Can pass.
- 3.1: now one task with the bump, the CHANGELOG heading (`check_changelog`, `scripts/check.py:113-123`), the doc's pins, E-3, and the three tests the manifest drives; the check names `deliver-check-cli`, `change-loop-compozy` and `release-merge`. I ran the equivalent by name on the scratch copy: it passes. Can pass.
- 3.2: `gen-catalog.py --check` writes only the asset tables, so the README row and the bump leave it green; `claude plugin validate .` is run by the implementer. Can pass.
- 3.3: the real runs. 3.3 now names `evidence.md` and says the pr-verifier writes it (attempt-3 optional 2, fixed). The expected line is consistent with the 15 applicable stages. Can pass.
- 3.4: the full suite. With E-3 done in 3.1, no known test is left red by the bump. Can pass.

## 7. Omission detection
- Existing tests: the grep that `openspec/config.yaml:35` asks for is done and recorded in D-11 (the `state` output, the usage line, the offline stub, and now every test that holds a release as a literal). No gap.
- Validation, error handling, bounds, idempotency, rollback, rollout (opt-in, remove the entry), observability, permissions, migration: covered or not needed.

## 8. Execution risks (top 5 failures)
1. Cause: a sibling merges into `main` and renumbers the release between this review and the merge. Impact: the doc's pins and E-3 name the wrong version. Prevention: stated in 3.1 and D-13 (the version, the pins and E-3 move together; the manifest-driven tests follow on their own).
2. Cause: the session id of the status line differs from `CLAUDE_SESSION_ID` of the skill in some host. Impact: empty bar, never wrong. Stated in the risk table and the AC-3 dogfood row.
3. Cause: the archive-branch session and the roadmap change session with dependencies call GitHub on each refresh. Impact: bounded by the 20 s kill; stated and tested (B-10).
4. Cause: Claude Code keeps standard input open after the JSON. Impact: each refresh waits 1 s; pinned by B-46.
5. Cause: the classification line is written after the grill starts, so N moves from 14 to 15 mid-change. Impact: cosmetic; stated in D-5 and pinned by S-12.

## 9. Mandatory fixes before implementation
None.

## 10. Optional improvements (within scope)
- [ ] `design.md:446-448` and `tasks.md:116` (renumbering case): say that after a renumber E-3 keeps its `doesNotMatch` line for `v0.39.0` and adds one for the number it moves above, so the list of earlier releases only grows. The test's existing shape makes this the natural reading; the sentence only removes the choice.

## 11. Explicitly out of scope
- [ ] The listing exiting 3 in this repository (`state-skips-unlocated`); routed to dogfood.
- [ ] Heading placement of "The status line" inside "The change coordinator" section of `docs/openspec-flow.md`.
- [ ] East Asian ambiguous width of `■ ◆ □` (accepted in the design's risk table).

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes.
2. Is the result measurable? Yes: AC-1 to AC-7, each with tests (B-, S-, H-, E- ids) and a real run (D-12).
3. Are error behaviors defined? Yes, each with a scenario.
4. Are edge cases covered? Yes.
5. Are dependencies clear? Yes: the merge of `origin/main` first (1.1), shared helper and stub moves in order.
6. Are contracts defined? Yes: the settings entry, the input, the three lines, the `stages` field, `--offline`.
7. Can two developers interpret this differently? No for behavior; the one wording choice is optional item 1.
8. Are any decisions implicit instead of written? No.
9. Do the tasks fully deliver the intended outcome? Yes.
10. What will be discovered too late if implementation starts now? Nothing known; the release renumbering case is covered by a written rule.

## 13. Final conclusion
- Can we start? Yes.
- What must be fixed? Nothing mandatory; one optional wording item.
- Main risk if ignored? A sibling's renumbering of the release, handled by the rule in 3.1.
