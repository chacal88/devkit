<!-- devkit-stage readiness result=passed attempt=2 commit=bbb831f9b6dc488a64d519a4d02d3e05ab521e9d -->
# Readiness review: project-slice-claim

Reviewed at `bbb831f` (the plan's own commit; `origin/main` is `c1ac8c4`, the commit `bbb831f` sits on; nothing was
fetched). This is round 2: it re-reads the revised `proposal.md`, `design.md`, `specs/project-definition/spec.md` and
`tasks.md` against round 1 (NEEDS-REVISION: F-1, F-2, O-1 to O-4). No test suite and no phase gate was run: the caller
said the machine is overloaded. `openspec validate project-slice-claim --strict` was run and passes. Every claim about
internals below was re-derived by reading the code, not the plan; one claim (the push the remote refuses) was also
run by hand with git in a scratch repository under `/var/tmp/devkit-project-slice-claim`.

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

Both round-1 findings are closed in the artifacts, and the four optional improvements were taken as well. No open
blocker. An implementer can build every task from `design.md` D-1 to D-9 without choosing behaviour, and each of
AC-1 to AC-9 has a task and a named test with an expected value.

## 2. Scope validation
Classification: correct

- Problem: a slice opened through `project-loop.mjs open` shares `openCheckout` and passes no `claim`, so its branch
  is not on `origin` until its pull request (`plugins/openspec/hooks/project-loop.mjs:437-447`, `openSlice` calls
  `openCheckout(cwd, id, { script, lang, env, openspec })`; `change-loop.mjs:2003-2059`). Verified.
- In scope and out of scope are explicit (`proposal.md` Non-goals; `design.md` Non-Goals). Board, roadmap, places,
  `--machine/--places/--remote` for a slice stay out, and the spec delta keeps them out.
- The spec delta adds nothing the proposal does not justify. The failed-push scenario added in this round is the
  proposal's own BREAKING line, so it is not new scope.
- Open decisions: none. ADR 0022 exists as `proposed` (`docs/adr/0022-...md`), `decisions.md` points at it, and the
  owner's acceptance is a stated dependency.

## 3. Proposal review
- Problem, goal and the BREAKING impact are stated, now including the remote that answers the fetch and refuses the
  push (`proposal.md:23-27`).
- Capabilities: `project-definition` modified (three requirements, each with its earlier scenarios kept and the new
  ones added); `change-coordination` referenced, not modified. Correct.
- Facts about the repository are true at `bbb831f`. This includes the sentence the plan says is wrong today in
  `docs/openspec-flow.md` ("`/devkit status` shows each slice's readout"): `/devkit status` lists no slice
  (`unfinished` skips slice folders).
- The proposal is about 100 lines, within the "under two pages" rule as it was at round 1 (the one added clause is a
  sentence long).

## 4. Design review
Claims re-derived against live code at `bbb831f`:

- `openUnderLock` refuses on `refs/remotes/origin/<id>` whether or not a claim is passed (`change-loop.mjs:2018`), so
  the refusal of AC-3 is a regression guard. Confirmed.
- The claim keys are written before the pin and both sit under `if (hasOrigin && claim)` for the claim keys
  (`change-loop.mjs:2036-2042`); `writeClaimKeys` with `places: null` writes the machine line alone (`:2062-2067`).
  Confirmed.
- `claimOnOrigin` commits `chore(openspec): open <id>` and pushes `--force-with-lease=refs/heads/<id>:`; a push error
  matching `PUSH_RACE` (`stale info|already exists|fetch first`) becomes `ClaimRace`, any other error is rethrown
  (`:1909-1920`, `:1891-1895`). Confirmed.
- D-2's new passage on a failed push, step by step: the catch in `openUnderLock` calls `removeLocalOpen` (worktree
  remove, `rmSync`, prune, `branch -D`) and rethrows a non-`ClaimRace` error (`:2044-2056`); `gitRun` wraps it as a
  `LoopUsageError` carrying git's stderr (`:1774-1780`); `project-loop.mjs#failure` (`:704-709`) turns a non-refusal
  into exit 3 with `render(lang, 'project-unreadable')` and the message in `error`/stderr, never in `reply`. The text
  of `project-unreadable` in both languages is at `change-loop.mjs:350` and `:605`. The change's counterpart
  `request-unreadable` is at `:196`, `:451` and `:2540`. Confirmed.
- The red test's setup was run by hand: `git remote set-url --push origin <missing path>` leaves `git fetch origin`
  working, and the claim's push then fails with "does not appear to be a git repository" and "Could not read from
  remote repository", neither of which `PUSH_RACE` matches. So the failure is not mistaken for a lost race, and today
  no push happens at all (red on `bbb831f`). Confirmed.
- `thisMachine`, `parseClaim`, `MACHINE_NAME` are exported (`change-loop.mjs:1801`, `:1811`, `:1817`); the import
  list of `project-loop.mjs` (lines 28-31) has none of them yet. `main`'s `open` branch parses only `--lang`
  (`project-loop.mjs:662-665`). Confirmed.
- D-3's `folder: located.dir` in `common` (`project-loop.mjs:306`) serves every kind: for an archived slice
  `locateChange` returns the archived folder, which is the folder `statusText` reads for the stage records
  (`:595-597`), so the machine line survives `archive` (the AC-6 test asserts it). The `default` kind returns
  `common` before the rest (`:307`). Confirmed.
- The `devkit-project` flow has no `approval` stage, and the readers that count places count only claims whose
  branch holds `approval.md` or only the roadmap's ids (D-4). Held at round 1 and unchanged.
- D-5: `sliceProblems`/`sliceReviewStale` read the verdict, commits after it and the net diff; the open commit is
  before the verdict and its path leaves the net diff after the archive move. Held at round 1 and unchanged.
- The AC-9 source test forbids five strings in `project-loop.mjs`; none of them occurs there today (grep), and tasks
  1.3 and 1.5 now tell the implementer that no comment may use them (round 1 O-4, closed).
- Parsers rule (`openspec/config.yaml`): D-3 states what an absent, empty, unterminated, odd or unreadable
  `.openspec.yaml` does. Present.
- Existing-tests rule: D-6 carries the greps and a table (T-1 to T-8). I re-checked the tests that could see the
  open's new commit and push: `project-loop docs: the documents follow` (`project-loop.test.mjs:1838`) reads section 7
  and ADR 0015's headers and 0010/0012's Notes, none of which the edits touch; the first eight lines of ADR 0020 keep
  the 0021 line first. Held.
- `rules.design` (a sentence saying a test pins a behaviour names that test file): the five sentences of round 1 now
  carry `project-loop.test.mjs`, `change-loop.test.mjs` or `roadmap-loop.test.mjs` (design lines 68-69, 148-150,
  155-156, 270-271, 278-280, 299). F-2 closed.
- Rejected alternatives of ADRs: ADR 0020's draft-PR and `refs/devkit/claims/` options and ADR 0015's table are not
  used.

## 5. Specs review
- Normative language and `#### Scenario:` blocks are present. The three MODIFIED requirements keep their earlier
  scenarios and add: the claim on the remote, the order of keys, the refusal, the pre-claim branch, the race, a push
  that fails for another reason (new, closes F-1), no remote, the remote branch with no folder (now in "A name that
  cannot be used", closes O-2), the machine line present and absent, and the board with a claimed slice.
- Every outcome row of D-2's table (`claimed`, `claimed-elsewhere`, `name-taken`) and the failed push have a
  scenario. The scenario "A slice open on another machine" no longer claims that no phase question is asked: the spec
  says what the open does (exit 3, nothing created) and D-2 says the rest rests on the skill's line, which no test
  pins (round 1 O-3, closed by narrowing the claim).
- No requirement lives only in a support document.

## 6. Tasks review
- Two phases, each ending in a gate with a backticked command (1.6; 2.5 and 2.6); every AC id appears in the
  traceability table and in at least one task.
- Order is right: tests and the red run (1.1), identity lines (1.2), `openSlice` (1.3), the message key (1.4),
  `readFacts` and the readout with T-1 (1.5), gate (1.6); then ADRs, documents, release, validation and gates.
- Task 1.1 counts thirteen tests; D-7's table has 13 (1+1+2+2+1 push refused+1+2+1+1+1). The regression guards it
  names (AC-3, AC-5, AC-6 second test, AC-7) match D-7's "no" rows; the push-refused test is a "yes" row, as it is
  checked above.
- The gate 1.6 pattern list covers every test that opens a slice (`^project-loop `, `^commit-attribution AC-1`,
  `^gh-version 1[56]`) plus the change-path tests of D-6.
- The version and ADR number rule: tasks 2.1 and 2.3 name "the next free number on `origin/main` at the last merge
  before review". Task 2.1 now writes `<N>` with "0022 at `bbb831f`" as the current value (round 1 O-1, closed). The
  release versions in D-9 are anchored `at bbb831f` and match `plugin.json` 0.33.0 and `marketplace.json` 0.37.0.
- The rule on a task changing a pinned text: task 2.2 greps the tests for `slice's readout` and for the README row
  before editing; I ran both greps and found no test asserting either. 1.5 names T-1's edit.
- Every task path is under a real directory. `proof/red-1.txt` is created by task 1.1; `proof/real-run.txt` by the
  evidence stage.
- Phase gates that already exist on the base (`python3 scripts/check.py`, `python3 scripts/gen-catalog.py --check`,
  the `node --test` patterns) were not run, by the caller's instruction (overloaded machine); the two `node --test`
  gates are marked long and background by the tasks, and `openspec validate` ran green. This is not a finding, since
  nothing indicates that any of them is red on the base.

## 7. Omission detection
- Validation: covered (name check and gate before the claim).
- Error handling: the refusal, the lost race, the unreadable `.openspec.yaml` and, now, a push that fails for another
  reason (D-2, scenario, D-7 row, R-6, CHANGELOG bullet, BREAKING line). The reply blaming the request rather than
  the remote is accepted in writing with its limits, with a follow-up named for both commands.
- Retries: none needed; the open lock and the create-only push decide.
- Permissions: a remote that refuses the new branch now fails a slice's open; stated (BREAKING, R-6).
- Side effects: the branch is public from the open (ADR 0022 Negative, R-1).
- Observability, rollback, migration: Migration Plan covers slices opened before the release and rollback by revert.
- Idempotency: a second open of the same name is refused locally (`name-taken`) or on `origin` (`claimed`).
- Compatibility: `x-*` keys are ignored by OpenSpec and by the earlier pack (the existing pin tests prove an `x-` key
  raises no warning).
- Test strategy and evidence: D-7 and the real-run proof list every declared case, including the refused push.

## 8. Execution risks (top 5 failures)
1. `main` takes ADR 0022 or the release numbers first. Impact: a renumbering across ADR 0015 and ADR 0020, the config
   line, documents and the CHANGELOG. Prevention: in the plan (D-8, D-9, "Workflow follow-up"; re-check before push
   and before auto-merge).
2. A test outside D-6 sees the open's new commit or push (every `openIn` user gets one). Impact: a red whole-suite
   gate at 2.6 after hours of work. Prevention: the plan lists T-1 to T-8, gate 1.6 runs every slice-opening test,
   and the plan says to stop for a revision rather than patch a test; I found none outside D-6.
3. Two-process race test flakes on a loaded machine. Impact: a red gate that is not a defect. Prevention: it asserts
   only the sorted exit codes and `origin`'s sha, as `remote AC-3 open: two clones ...` does; keep it a background
   gate; the deterministic `beforePush` test is the main proof of AC-4.
4. A comment added to `project-loop.mjs` naming one of the five forbidden strings makes the AC-9 test fail for a
   reason unrelated to a second copy of the claim. Prevention: said in tasks 1.3 and 1.5 and in D-7.
5. A project whose `origin` refuses the new branch gets `project-unreadable` ("I could not read that request") from
   `/devkit project`. Impact: a misleading reply in the BREAKING case. Prevention: stated and accepted in D-2, R-6 and
   the CHANGELOG; the real-run proof covers it; a reply naming the remote is a follow-up, not part of this plan.

## 9. Mandatory fixes before implementation
None. Round 1's F-1 (the failed push) and F-2 (test files named in five sentences of `design.md`) are closed.

## 10. Optional improvements (within scope)
- [ ] O-5 `design.md` D-8 (lines 260-280) and `decisions.md` still spell `ADR 0022` as a literal number where the tasks
  rule is only about tasks. The sentence at D-8's start covers the renumbering; no change needed unless `main` takes
  0022 first, when every mention moves with it.
- [ ] O-6 Nothing pins the skill line "On any exit 3, say `reply` and end the turn" (`SKILL.md:217`), which the
  "no phase question follows a refusal" behaviour rests on. D-2 says so. A one-line test could pin it in a later
  change; it is not needed here.

## 11. Explicitly out of scope
- [ ] Showing a slice open on another machine on the `/devkit status` board or the roadmap (grill answer A, ADR 0022
  decision 5).
- [ ] Places and `--machine`, `--places`, `--remote` for a slice; continuing a slice on another machine; claims for
  archive branches.
- [ ] A reply for a refused push that names the remote, for a slice and a change alike (follow-up named in D-2, R-6).
- [ ] A slice opened and abandoned leaves its branch on `origin`, so a later open of the same name is refused as
  `claimed`; this is ADR 0020's behaviour for a change, not new.
- [ ] A real push race against GitHub (ADR 0020's live check L-1 covers the same code).

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes: two machines can open one slice; AC-1 to AC-9 state the claim, the
   refusal, the race, no remote, the readout, the board and the delivery.
2. Is the result measurable? Yes: each AC has a named test in D-7 with its expected values and a red-or-guard mark.
3. Are error behaviors defined? Yes: the refusal (three keys), the lost race, the refused push (new), the unreadable
   or malformed `.openspec.yaml`, no `origin`.
4. Are edge cases covered? Yes: no `origin`, a branch with no folder, a branch with no machine, a bad machine value, an
   unterminated or absent `.openspec.yaml`, an archived and a delivered slice on the readout.
5. Are dependencies clear? Yes: `remote-worker`, `change-version-pin` and `project-phases` are archived; ADR 0022's
   acceptance and the `openspec` CLI 2.x are named.
6. Are contracts defined? Yes: the claim keys and their order, the commit subject, the replies, the readout line and
   both message texts.
7. Can two developers interpret this differently? Not in a way that changes behaviour: D-1 and D-3 give the code
   shape, D-2 the replies, D-7 the assertions.
8. Are any decisions implicit instead of written? No. The one that was (the reply of a refused push) is now in D-2.
9. Do the tasks fully deliver the intended outcome? Yes: tests, code, the message key, the ADR edits, documents,
   release, validation and both gates are tasks.
10. What will be discovered too late? Only a test outside D-6 that sees the open's push; the plan stops for a revision
    on it, and gates 1.6 and 2.6 find it.

## 13. Final conclusion
- Can we start? Yes.
- What must be fixed? Nothing before implementation.
- Main risk if ignored? Not applicable; the residual risks are in section 8 and each has its prevention in the plan.
