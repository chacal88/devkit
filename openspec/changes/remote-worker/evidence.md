<!-- devkit-stage evidence result=passed attempt=6 commit=37eb77c0f0fde0cb812ddf4169add2abc89ea0dc -->
Commit: 37eb77c0f0fde0cb812ddf4169add2abc89ea0dc

# Evidence

Change: `remote-worker` · Verified again (attempt 6) 2026-11-23 on branch `remote-worker` at the commit above (`37eb77c`). The
working tree was clean (`git status --short` printed nothing). Attempt 6 runs past the stage ceiling of 3 by the owner's
authorization, as attempts 4 and 5 did. The release is devkit-openspec 0.32.0, marketplace 0.36.0 and tag `v0.32.0` (to be
tagged after the merge, `tasks.md` Workflow follow-up); the ADR is `docs/adr/0020-a-change-can-run-on-another-machine.md`
(renamed from 0019). Every phase gate ran from the worktree with `TMPDIR=/var/tmp/devkit-remote-worker`, each as its own
command with its exit code deciding (outputs in the session scratchpad, `.../scratchpad/a6/`). No fetch, push or commit was
made by this run.

### What changed since attempt 5 (8344801)

- Four merges of `origin/main` are in the branch; the latest is `c9f08f0` (main at `fc01230`). Main's tests came with them.
- The plan was revised and re-approved (`approval.md` attempt 5, `readiness.md` attempt 7); `37eb77c` is that approval and
  the tick of task 5.8.
- `git diff --name-only c9f08f0 HEAD` lists only `openspec/changes/remote-worker/{approval,design,proposal,readiness,tasks}.md`.
  `git diff c9f08f0 HEAD --stat -- plugins scripts docs openspec/config.yaml CHANGELOG.md .claude-plugin` prints nothing (0
  lines): the product tree of HEAD is the product tree of `c9f08f0`.
- The claim keys are written before the version pin (task 5.8, D-1 step 4); T-14 edits one assertion of main's
  `delivery-models` test and T-19 narrows this change's own AC-4 test (rows below).

Attempt 3's defects stay fixed: D-1 (the `delivery-models open` test) by T-14, D-2 (`openspec validate --strict`, the
`roadmap-coordination` delta) by the delta's 10 scenarios; both commands exit 0 below.

## Verification

### Gates

Counts are the `ℹ tests/pass/fail/skipped` lines of this attempt's own runs at HEAD, except gate 5.10's `node --test` row
(see its row). The counts of rows 1.4 to 4.6 are the same as attempt 5's (55, 126, 99, 119): the tests main added since do not
match these filters. The `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main` prefix is part of each command.

| Gate | Command | Result |
|---|---|---|
| 1.4 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^remote" --test-name-pattern="^change-loop open" --test-name-pattern="^project-loop start: open" --test-name-pattern="^followups AC-3 run file" plugins/openspec/hooks/guard.test.mjs` | pass: exit 0, 55 tests, 55 passed, 0 failed, 0 cancelled, 0 skipped |
| 1.4 | `python3 scripts/check.py` | pass: exit 0, all checks passed |
| 2.4 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^remote" --test-name-pattern="^change-loop open" --test-name-pattern="^change-loop decide" --test-name-pattern="^change-loop next" --test-name-pattern="^change-loop lock stop" --test-name-pattern="^change-loop withLockFile" --test-name-pattern="^roadmap-loop run" --test-name-pattern="^followups AC-3 run file" --test-name-pattern="^followups AC-5 run file" plugins/openspec/hooks/guard.test.mjs` | pass: exit 0, 126 tests, 126 passed, 0 failed, 0 cancelled, 0 skipped |
| 2.4 | `python3 scripts/check.py` | pass: exit 0, all checks passed |
| 3.6 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^remote" --test-name-pattern="^roadmap-loop lines" --test-name-pattern="^roadmap-loop status" --test-name-pattern="^roadmap-loop setting" --test-name-pattern="^roadmap-loop decide" --test-name-pattern="^followups AC-1 status" --test-name-pattern="^followups AC-15 status" --test-name-pattern="^followups AC-3 run file" plugins/openspec/hooks/guard.test.mjs` | pass: exit 0, 99 tests, 99 passed, 0 failed, 0 cancelled, 0 skipped |
| 3.6 | `python3 scripts/check.py` | pass: exit 0, all checks passed |
| 4.6 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^remote" --test-name-pattern="^roadmap-loop decide" --test-name-pattern="^roadmap-loop next" --test-name-pattern="^roadmap-loop run" --test-name-pattern="^roadmap-loop lock stop" --test-name-pattern="^followups AC-7" --test-name-pattern="^followups AC-13" --test-name-pattern="^followups AC-15" --test-name-pattern="^followups F-3" --test-name-pattern="^followups AC-3 run file" --test-name-pattern="^followups ADR 0014" plugins/openspec/hooks/guard.test.mjs` | pass: exit 0, 119 tests, 119 passed, 0 failed, 0 cancelled, 0 skipped (all 41 `remote ...` tests are in it and passed) |
| 4.6 | `python3 scripts/check.py` | pass: exit 0, all checks passed |
| 5.8 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^delivery-models open" plugins/openspec/hooks/guard.test.mjs` | pass: exit 0, 10 tests, 10 passed, 0 failed, 0 skipped (includes `delivery-models open: a two-prs change starts from origin/<base>`, T-14) |
| 5.8 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="version-pin" plugins/openspec/hooks/guard.test.mjs` | pass: exit 0, 66 tests, 66 passed, 0 failed, 0 skipped (main's `version-pin` tests, T-16 to T-18, unedited) |
| 5.8 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^remote" plugins/openspec/hooks/guard.test.mjs` | pass: exit 0, 41 tests, 41 passed, 0 failed, 0 skipped (includes T-19's `remote AC-4 open: with no origin nothing is committed or pushed`) |
| 5.9 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^change-state ADR 0017" --test-name-pattern="^followups ADR 0014" --test-name-pattern="^followups AC-3 run file" plugins/openspec/hooks/guard.test.mjs` | pass: exit 0, 3 tests, 3 passed, 0 failed, 0 skipped (includes `change-state ADR 0017: the documents follow`, T-15) |
| 5.10 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs` | pass: the whole suite, 2220 tests, 2220 passed, 0 failed, 0 cancelled, 0 skipped, 2535 s (about 42 min), run at the tree of `c9f08f0` plus the plan commits with `TMPDIR=/var/tmp/devkit-remote-worker`, and not re-run here. Proof: the file `/var/tmp/claude-1000/-home-kaue-repos-devkit--claude-worktrees-remote-worker/baace92b-2719-4eb0-a1ad-a8ea30c76658/scratchpad/suite.txt` (`ℹ tests 2220`, `ℹ pass 2220`, `ℹ fail 0`, `ℹ cancelled 0`, `ℹ skipped 0`, no `✖` line, 41 `✔ remote ...` lines; written 18:12:41 on 2026-11-23). It holds for HEAD because `git diff c9f08f0 HEAD -- plugins scripts docs openspec/config.yaml CHANGELOG.md .claude-plugin` is empty (0 lines, shown above); HEAD differs from `c9f08f0` only by 5 files of this change's own folder |
| 5.10 | `python3 scripts/check.py` | pass: exit 0, all checks passed (run at this commit) |
| 5.10 | `python3 scripts/gen-catalog.py --check` | pass: exit 0 (run at this commit) |
| 5.10 | `grep -q "Validation passed" "${TMPDIR%/}/devkit-validate-remote-worker/phase-5.txt"` | pass: exit 0 (run with `TMPDIR=/var/tmp`). The file was written 17:21:47 on 2026-11-23, after the merge commit `c9f08f0` (17:13:39); no manifest changed since (the diff above has no `.claude-plugin` line). I also ran a fresh `claude plugin validate .` at this commit: exit 0, `Validation passed` |

Other checks, run at this commit, each exit 0: `openspec validate remote-worker --strict` (`Change 'remote-worker' is valid`),
`python3 scripts/check.py`, `python3 scripts/gen-catalog.py --check`, `claude plugin validate .`.

Note on the counts: the owner expected higher counts than before because main's tests were added. Rows 1.4 to 4.6 and 5.8 to 5.9
are filtered runs, and none of main's new tests match those filters, so those counts equal attempt 5's. The whole suite shows the
growth: 2220 tests, against 2106 in attempt 5.

### The existing tests the plan changed (T-14, T-15, T-19), the claim order and the ADR 0017 amendment

| Item | What was checked | Result |
|---|---|---|
| T-14 | `git diff fc01230 HEAD --numstat -- plugins/openspec/hooks/delivery-models.test.mjs` prints `2 1`: one line removed, two added, only the last assertion of `delivery-models open: a two-prs change starts from origin/<base>`, which is now `HEAD^` equals `origin/main` plus `git merge-base --is-ancestor origin/main HEAD` exits 0. The test passed in gate 5.8 (10 of 10) and in the whole suite. | pass |
| T-19 | `remote AC-4 open: with no origin nothing is committed or pushed` (`change-loop.test.mjs`): its two `/x-devkit/` assertions are now `/x-devkit-(machine\|places)/` (lines 3642 and 3648); the other assertions are unchanged. It passed in gate 5.8 (41 of 41) and in the whole suite. | pass |
| claim before pin | In `plugins/openspec/hooks/change-loop.mjs` `openCheckout` calls `writeClaimKeys` (line 1899) before `recordPin` (line 1900), and `claimOnOrigin` (line 1902, which only commits and pushes) after both. `git diff 37a7063 HEAD --stat -- plugins/openspec/hooks/version-pin.test.mjs` prints nothing: no `version-pin` test was edited, and all 66 pass (gate 5.8). | pass |
| T-15 | `change-state ADR 0017: the documents follow` (`change-loop.test.mjs`) passed in gate 5.9 and in the whole suite. | pass |
| ADR 0020 amends ADR 0017 decision 4 | `docs/adr/0020-a-change-can-run-on-another-machine.md` (the file is named 0020; `git ls-files docs/adr` has no other file of this change) has `Status: accepted`, the `Amends:` line naming ADR 0013, ADR 0014 and ADR 0017 decision 4 (the title of a change waiting for a place), decision 5's `(⏳, decision 8)` and the new decision 8 (a change waiting for a place is the one blocked end titled `⏳ <id>`, no ⛔). `git diff fc01230 HEAD --numstat -- docs/adr/0017-a-change-state-is-derived-in-one-place.md` prints `5 0`: 5 added lines, 0 removed (the header line `- Amended by ADR 0020 (...)` and the Note), and `Amends: ADR 0014` of ADR 0017 is still at line 7. `openspec/config.yaml` lists the 0020 entry. `python3 scripts/check.py` reports no broken link. | pass |

### Acceptance criteria

All 41 `remote ...` tests passed in gate 4.6's run, in gate 5.8's `^remote` run (41 of 41) and in the whole suite of gate 5.10. Per AC, the
whole-suite file `suite.txt` has `✔` lines for: AC-1 2, AC-2 3, AC-3 2, AC-4 1, AC-5 3, AC-6 2, AC-7 3, AC-8 2, AC-9 3, AC-10 9, AC-11 3,
AC-12 5, `remote locks` 3 (41 in all, no `✖`). The red runs of each phase are kept in
`openspec/changes/remote-worker/proof/red-1.txt` to `red-5.txt`. By the owner's decision of 2026-11-23 (`B: depois do merge`;
`tasks.md` Workflow follow-up, `design.md` D-16 and R-10), the live record on two machines (L-1 to L-4) comes after the merge. It is
named below as "live: after the merge", not as a defect. No test runs `ssh`, starts a session or sends a message (D-16): those host
calls are proved by the exact `input` and `message` the decision returns.

| AC | Criterion | Proof | Result |
|---|---|---|---|
| AC-1 | `open-refuses-claimed`: opening a change already claimed on `origin` is refused naming the machine; no worktree, folder or local branch | `change-loop.test.mjs`: `remote AC-1 open: a branch on origin with a claim refuses the open, naming its machine, and creates nothing` and `remote AC-1 open: a claim with no machine says another machine` passed. Live: after the merge (L-1). | pass |
| AC-2 | `open-pushes-claim`: the open leaves `refs/heads/<id>` on `origin` with `requirements.md` and the machine, with or without `machines` | `remote AC-2 open: the claim on origin holds requirements.md and the machine, with machines unset`, `remote AC-2 open: a remote open claims for that machine and leaves no local worktree or branch` and `remote AC-2 open: a machine name or a places value that is not valid is a usage error and creates nothing` passed (bare local remote). The claim commit sits on the base tip, which T-14 asserts for a two-prs change, and the claim keys are written before the version pin (see the order row below). | pass |
| AC-3 | `open-race-one-wins`: of two racing opens exactly one claims; the other is refused and leaves nothing | `remote AC-3 open: the clone that pushes second is refused and leaves nothing` (the `beforePush` seam) and `remote AC-3 open: two clones opening one id at once, exactly one wins` (two child processes) passed. Live race against GitHub: after the merge (L-1). | pass |
| AC-4 | `no-origin-unchanged`: with no `origin`, no push and no refusal | `remote AC-4 open: with no origin nothing is committed or pushed` passed; `change-loop open: O4 with no remote starts from HEAD` is in gate 1.4's filter and passed. T-19 narrowed this test's two `/x-devkit/` assertions to `/x-devkit-(machine|places)/` (see the T-19 row below); both pass. | pass |
| AC-5 | `status-shows-machine`: `/devkit status` lists open changes of other machines with their machine, never as ready | `roadmap-loop.test.mjs`: `remote AC-5 status: a line open only on another machine is listed under way with its machine, never in the queue`, `remote AC-5 status: GitHub unreadable prints the board with its line` and `remote AC-5 status: the machines block and the machine of each row` passed. Live: after the merge (L-1). | pass |
| AC-6 | `roadmap-never-reopens`: a roadmap run never opens a change whose branch is on `origin` | `remote AC-6 next: a line claimed on origin is never started, and its dependent waits` and `remote AC-6 next: a declared cannot-open of a line claimed elsewhere is dropped` passed. Live: after the merge (L-1). | pass |
| AC-7 | `machines-setting`: unset keeps today's behavior; set, an entry missing a field is refused naming it | `remote AC-7 machines: unset, empty, [] and a placeholder read as unset`, `remote AC-7 machines: an entry without a field is refused naming it, and nothing is written` and `remote AC-7 next: with machines unset the decision is today's` passed. | pass |
| AC-8 | `open-on-fewest`: a change goes to the answering machine with the fewest open changes; this machine skipped while loaded | `remote AC-8 next: each ready line goes to the answering machine with the fewest open changes` and `remote AC-8 next: this machine is skipped while loaded, and a start is held only when nothing can take it` passed. Live: after the merge (L-2). | pass |
| AC-9 | `remote-session-start`: a remote change gets a `session-start` with target ssh in its worktree there, only on a typed turn | `remote AC-9 next: a placed change gets a session-start with its checkout, target ssh, host and the remote cwd, only on a typed turn`, `remote AC-9 next: the run file keeps placed, which another session keeps and --fresh clears` and `remote AC-9 checkout: the worktree is made on the other clone from its branch` passed (the decision's exact `input` is asserted; no session is started by a test). Live session start: after the merge (L-2). | pass |
| AC-10 | `place-at-implementation`: grill and plan never wait; the implementation waits in ⏳ with no free place and runs once one is free | `change-loop.test.mjs`: nine `remote AC-10` tests passed (no free place ends waiting with icon ⏳; a free place gives take-place then the implementation step; grill and plan never wait; a change without `x-devkit-places` never waits; a place already taken is not checked again; places of a run come from the run file; a change held by no approval or another machine takes no place; `remote AC-10 place: two changes of one machine at once, one takes the place`; `remote AC-10 stop: the blocked end no-place lets a /devkit change run stop`). The ⏳ title with no ⛔ is the ADR 0017 amendment above (ADR 0019 decision 8), checked by T-15, and the "Waiting for a place" scenario of the `roadmap-coordination` delta validates. Live: after the merge (L-3). | pass |
| AC-11 | `wake-on-free-place`: a freed place wakes one waiting change, which implements only if the script finds the place free | `roadmap-loop.test.mjs`: `remote AC-11 next: a freed place gives one wake per state for the first waiting change` and `remote AC-11 next: no wake without session mode`; `change-loop.test.mjs`: `remote AC-11 place: a wake that comes too early leaves the change waiting` passed (the wake `message` is asserted, none is sent). Whether the wake is delivered on a turn nobody typed: live, after the merge (L-3, R-7). | pass |
| AC-12 | `unreachable-machine`: a silent machine gets no change; the board says "no answer" for it and its changes; its changes keep their places | `remote AC-12 next: a silent machine gets no change, and its placed change no session`, `remote AC-12 status: a silent machine and its changes read no answer`, `remote AC-12 probe: state through the injected ssh returns the other clone's changes, and a failing ssh is no answer` (fake `ssh` exiting 255), `remote AC-12 probe: the installation is the project-scoped one at or above the folder, else the user-scoped one` and `remote AC-12 probe: the probe itself answers with an error and exit 3 when the pack is missing, the file unreadable or the status fails` passed. Live: after the merge (L-4). | pass |

`coordination-locks` delta: `remote locks stop: no ssh from the stop hook, and a start only another machine could take does not refuse
the stop`, `remote locks claims: the claims of a stale clone cost at most 8 gh calls, and none for the default branch` and `remote locks
claims: a listing with approval.md and a .openspec.yaml with places reads as placed with machine and places` passed (the last backs
the placed reading behind AC-10 and AC-12).

Live record on two machines (L-1 to L-4): comes after the merge, by the owner's decision of 2026-11-23. It is open work after the
merge, not a defect of this change.

No defect is open at this commit.
