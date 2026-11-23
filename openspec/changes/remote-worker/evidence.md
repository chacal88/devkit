<!-- devkit-stage evidence result=passed attempt=5 commit=8344801e559626ca9cc30c660bd67cdca4cbb5db -->
Commit: 8344801e559626ca9cc30c660bd67cdca4cbb5db

# Evidence

Change: `remote-worker` · Verified again (attempt 5) 2026-11-23 on branch `remote-worker` at the commit above. The
working tree was clean (`git status --short` printed nothing). Attempt 5 runs past the stage ceiling of 3 by the owner's
authorization, as attempt 4 did. HEAD is 8344801, two commits after attempt 4's 7b21aad: `0187ac5` (evidence and review files
under `openspec/changes/remote-worker/`) and `8344801` (a one-word `CHANGELOG.md` fix and a comment-only edit of the header
of `plugins/openspec/hooks/run-file.mjs`). The release is devkit-openspec 0.30.0 and marketplace 0.34.0, and the ADR is
`docs/adr/0019-a-change-can-run-on-another-machine.md`. Every command ran from the worktree with `TMPDIR=/var/tmp`, each
as its own command with its exit code deciding. No fetch, push or commit was made by this run.

### What changed since attempt 4's commit

`git diff 7b21aad HEAD -- plugins docs scripts openspec/config.yaml CHANGELOG.md .claude-plugin` prints two hunks and
`git diff --stat` for the same paths says `2 files changed, 2 insertions(+), 2 deletions(-)`:

- `CHANGELOG.md` line 15: `ADR 0019 (proposed)` becomes `ADR 0019 (accepted)`.
- `plugins/openspec/hooks/run-file.mjs` line 2: the second line of the header comment (a line starting with `//`) is reworded
  to "Moved here from `change-loop.mjs`, where they now also carry `placed`, so that ...".

No code line changed: filtering that diff for added or removed lines that do not start with `//` leaves 0 lines for
`plugins`, and the only other changed line is the one changelog word. No test reads this repository's `CHANGELOG.md` or
`run-file.mjs` header text (the `CHANGELOG.md` strings in the test files are fixture repositories). So the whole-suite
run of gate 5.10 at 7b21aad stands as the proof for the gate, as the owner's instruction allows, and was not re-run.

Attempt 3 recorded two defects. Both are fixed at this commit:

- D-1 (the `delivery-models open: a two-prs change starts from origin/<base>` test failed): fixed by task 5.8 (T-14),
  commit 7b21aad. The test now asserts that the new HEAD's parent (`HEAD^`) is `origin/main` and that `origin/main` is an
  ancestor of HEAD. It passes (gate 5.8 below).
- D-2 (`openspec validate remote-worker --strict` failed on the `roadmap-coordination` delta): the delta now carries
  main's 9 scenarios of "A change session shows the stage its change is in" plus "Waiting for a place" (10 in all). The
  command exits 0: `Change 'remote-worker' is valid`.

## Verification

### Gates

Counts are the `ℹ tests/pass/fail/skipped` lines of this attempt's own runs at HEAD, except gate 5.10's `node --test` row (see
its row). Rows 1.4 to 4.6 and 5.8 to 5.9 were re-run at HEAD in this attempt and gave the same counts as attempt 4. The `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main` prefix is part of each command.

| Gate | Command | Result |
|---|---|---|
| 1.4 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^remote" --test-name-pattern="^change-loop open" --test-name-pattern="^project-loop start: open" --test-name-pattern="^followups AC-3 run file" plugins/openspec/hooks/guard.test.mjs` | pass: exit 0, 55 tests, 55 passed, 0 failed, 0 skipped |
| 1.4 | `python3 scripts/check.py` | pass: exit 0, all checks passed |
| 2.4 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^remote" --test-name-pattern="^change-loop open" --test-name-pattern="^change-loop decide" --test-name-pattern="^change-loop next" --test-name-pattern="^change-loop lock stop" --test-name-pattern="^change-loop withLockFile" --test-name-pattern="^roadmap-loop run" --test-name-pattern="^followups AC-3 run file" --test-name-pattern="^followups AC-5 run file" plugins/openspec/hooks/guard.test.mjs` | pass: exit 0, 126 tests, 126 passed, 0 failed, 0 skipped (attempt 3 counted 127: the second merge of main renamed `change-loop decide: B2a ...` to `release-merge-conflict 14: ...`, which this filter no longer matches) |
| 2.4 | `python3 scripts/check.py` | pass: exit 0, all checks passed |
| 3.6 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^remote" --test-name-pattern="^roadmap-loop lines" --test-name-pattern="^roadmap-loop status" --test-name-pattern="^roadmap-loop setting" --test-name-pattern="^roadmap-loop decide" --test-name-pattern="^followups AC-1 status" --test-name-pattern="^followups AC-15 status" --test-name-pattern="^followups AC-3 run file" plugins/openspec/hooks/guard.test.mjs` | pass: exit 0, 99 tests, 99 passed, 0 failed, 0 skipped |
| 3.6 | `python3 scripts/check.py` | pass: exit 0, all checks passed |
| 4.6 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^remote" --test-name-pattern="^roadmap-loop decide" --test-name-pattern="^roadmap-loop next" --test-name-pattern="^roadmap-loop run" --test-name-pattern="^roadmap-loop lock stop" --test-name-pattern="^followups AC-7" --test-name-pattern="^followups AC-13" --test-name-pattern="^followups AC-15" --test-name-pattern="^followups F-3" --test-name-pattern="^followups AC-3 run file" --test-name-pattern="^followups ADR 0014" plugins/openspec/hooks/guard.test.mjs` | pass: exit 0, 119 tests, 119 passed, 0 failed, 0 skipped (all 41 `remote ...` tests are in it and passed) |
| 4.6 | `python3 scripts/check.py` | pass: exit 0, all checks passed |
| 5.8 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^delivery-models open" plugins/openspec/hooks/guard.test.mjs` | pass: exit 0, 10 tests, 10 passed, 0 failed (includes `delivery-models open: a two-prs change starts from origin/<base>`, D-1 fixed, T-14) |
| 5.9 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^change-state ADR 0017" --test-name-pattern="^followups ADR 0014" --test-name-pattern="^followups AC-3 run file" plugins/openspec/hooks/guard.test.mjs` | pass: exit 0, 3 tests, 3 passed, 0 failed (includes `change-state ADR 0017: the documents follow`, T-15) |
| 5.10 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs` | pass: the whole suite, 2106 tests, 2106 passed, 0 failed, 0 cancelled, 0 skipped, 1722 s (28.7 min), run at 7b21aad and not re-run here. Proof: `/var/tmp/devkit-validate-remote-worker/gate-5.10.txt` (`ℹ tests 2106`, `ℹ pass 2106`, `ℹ fail 0`, `ℹ cancelled 0`, no `✖` line, its `✔` lines include all 41 `remote ...` tests; written 2026-11-23 12:28:15, run started about 11:59:30 with `TMPDIR=/var/tmp`). It holds for HEAD because the diff above, 7b21aad to HEAD over `plugins docs scripts openspec/config.yaml CHANGELOG.md .claude-plugin`, is a comment in `run-file.mjs` and one word of `CHANGELOG.md`, with no code line |
| 5.10 | `python3 scripts/check.py` | pass: exit 0, all checks passed (run at this commit) |
| 5.10 | `python3 scripts/gen-catalog.py --check` | pass: exit 0 (run at this commit) |
| 5.10 | `grep -q "Validation passed" "${TMPDIR%/}/devkit-validate-remote-worker/phase-5.txt"` | pass: exit 0 (re-run here with `TMPDIR=/var/tmp`). The file was written 11:57:12 on 2026-11-23, after the manifests of the second merge (11:29:44); no manifest changed since (the diff above has no `.claude-plugin` line). I also ran a fresh `claude plugin validate .` at this commit: exit 0, `Validation passed` |

Other checks, run at this commit, each exit 0: `openspec validate remote-worker --strict` (`Change 'remote-worker' is valid`;
this is D-2 fixed), `python3 scripts/check.py`, `python3 scripts/gen-catalog.py --check`, `claude plugin validate .`.

### The existing tests the plan changed (T-14, T-15) and the ADR 0017 amendment

| Item | What was checked | Result |
|---|---|---|
| T-14 | `git diff 212d007 -- plugins/openspec/hooks/delivery-models.test.mjs` has 3 changed lines (1 removed, 2 added): only the last assertion of `delivery-models open: a two-prs change starts from origin/<base>`, which is now `HEAD^` equals `origin/main` plus `git merge-base --is-ancestor origin/main HEAD` exits 0. The exit-code and `[b.branch, b.base]` assertions are as they were. The test passed in gate 5.8 and in the whole suite. | pass |
| T-15 | `change-state ADR 0017: the documents follow` (`change-loop.test.mjs`) passed in gate 5.9 and in the whole suite. | pass |
| ADR 0017 amended by ADR 0019 decision 8 | `git diff ccb3dfb -- docs/adr/0017-a-change-state-is-derived-in-one-place.md` has 5 added lines and 0 removed: the header line `Amended by ADR 0019 (...)` after `Status:`, and the Note as the first paragraph of its Context. `git grep -n "Amends: ADR 0014"` still finds the original line 7. ADR 0019 has the `Amends:` line naming ADR 0017, decision 5's `(⏳, decision 8)` and the new decision 8 (a place wait is the one blocked end titled `⏳ <id>`, with no ⛔ and no stage icon). `openspec/config.yaml` has the 0019 entry. `scripts/check.py` reports no broken link. | pass |

### Acceptance criteria

All 41 `remote ...` tests (the 38 of the Proof map and the 3 of commit 7b9c499) passed in gate 4.6's run and again in the whole
suite of gate 5.10. Per AC, the whole-suite file `gate-5.10.txt` has `✔` lines for: AC-1 2, AC-2 3, AC-3 2, AC-4 1, AC-5 3,
AC-6 2, AC-7 3, AC-8 2, AC-9 3, AC-10 9, AC-11 3, AC-12 5, `remote locks` 3 (41 in all, no `✖`). The red runs of each phase
are kept in `openspec/changes/remote-worker/proof/red-1.txt` to `red-5.txt`. By the owner's decision of 2026-11-23 (`B: depois
do merge`; `tasks.md` Workflow follow-up, `design.md` D-16 and R-10), the live record on two machines (L-1 to L-4) comes
after the merge. It is named below as "live: after the merge", not as a defect. No test runs `ssh`, starts a session or sends a
message (D-16): those host calls are proved by the exact `input` and `message` the decision returns.

| AC | Criterion | Proof | Result |
|---|---|---|---|
| AC-1 | `open-refuses-claimed`: opening a change already claimed on `origin` is refused naming the machine; no worktree, folder or local branch | `change-loop.test.mjs`: `remote AC-1 open: a branch on origin with a claim refuses the open, naming its machine, and creates nothing` and `remote AC-1 open: a claim with no machine says another machine` passed. Live: after the merge (L-1). | pass |
| AC-2 | `open-pushes-claim`: the open leaves `refs/heads/<id>` on `origin` with `requirements.md` and the machine, with or without `machines` | `remote AC-2 open: the claim on origin holds requirements.md and the machine, with machines unset`, `remote AC-2 open: a remote open claims for that machine and leaves no local worktree or branch` and `remote AC-2 open: a machine name or a places value that is not valid is a usage error and creates nothing` passed (bare local remote). The claim commit now sits on the base tip, which T-14 asserts for a two-prs change. | pass |
| AC-3 | `open-race-one-wins`: of two racing opens exactly one claims; the other is refused and leaves nothing | `remote AC-3 open: the clone that pushes second is refused and leaves nothing` (the `beforePush` seam) and `remote AC-3 open: two clones opening one id at once, exactly one wins` (two child processes) passed. Live race against GitHub: after the merge (L-1). | pass |
| AC-4 | `no-origin-unchanged`: with no `origin`, no push and no refusal | `remote AC-4 open: with no origin nothing is committed or pushed` passed; `change-loop open: O4 with no remote starts from HEAD` is in gate 1.4's filter and passed. | pass |
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
