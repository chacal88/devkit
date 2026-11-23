<!-- devkit-stage evidence result=passed attempt=2 commit=7b9c499654e1b08818d7a4ff4a465fffb88e8d68 -->
Commit: 7b9c499654e1b08818d7a4ff4a465fffb88e8d68

# Evidence

Change: `remote-worker` · Verified again (attempt 2) 2026-11-23 on branch `remote-worker` at the commit above (the
working tree differed from it only in files under `openspec/`). Every command ran with
`TMPDIR=/var/tmp`, from the worktree, each as its own command with its exit code deciding.

## Verification

### Gates

The `python3 scripts/check.py` part is the same command in gates 1.4, 2.4, 3.6, 4.6 and 5.8; it
exited 0 ("all checks passed") once after all gates, on the same tree (each part ran as its own command; the phase gates were not each followed by it in this attempt).

| Gate | Command | Result |
|---|---|---|
| 1.4 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^remote" --test-name-pattern="^change-loop open" --test-name-pattern="^project-loop start: open" --test-name-pattern="^followups AC-3 run file" plugins/openspec/hooks/guard.test.mjs` | pass: 55 tests, 55 passed, 0 failed |
| 1.4 | `python3 scripts/check.py` | pass: all checks passed |
| 2.4 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^remote" --test-name-pattern="^change-loop open" --test-name-pattern="^change-loop decide" --test-name-pattern="^change-loop next" --test-name-pattern="^change-loop lock stop" --test-name-pattern="^change-loop withLockFile" --test-name-pattern="^roadmap-loop run" --test-name-pattern="^followups AC-3 run file" --test-name-pattern="^followups AC-5 run file" plugins/openspec/hooks/guard.test.mjs` | pass: 127 tests, 127 passed, 0 failed |
| 2.4 | `python3 scripts/check.py` | pass: all checks passed |
| 3.6 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^remote" --test-name-pattern="^roadmap-loop lines" --test-name-pattern="^roadmap-loop status" --test-name-pattern="^roadmap-loop setting" --test-name-pattern="^roadmap-loop decide" --test-name-pattern="^followups AC-1 status" --test-name-pattern="^followups AC-15 status" --test-name-pattern="^followups AC-3 run file" plugins/openspec/hooks/guard.test.mjs` | pass: 99 tests, 99 passed, 0 failed |
| 3.6 | `python3 scripts/check.py` | pass: all checks passed |
| 4.6 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^remote" --test-name-pattern="^roadmap-loop decide" --test-name-pattern="^roadmap-loop next" --test-name-pattern="^roadmap-loop run" --test-name-pattern="^roadmap-loop lock stop" --test-name-pattern="^followups AC-7" --test-name-pattern="^followups AC-13" --test-name-pattern="^followups AC-15" --test-name-pattern="^followups F-3" --test-name-pattern="^followups AC-3 run file" --test-name-pattern="^followups ADR 0014" plugins/openspec/hooks/guard.test.mjs` | pass: 119 tests, 119 passed, 0 failed |
| 4.6 | `python3 scripts/check.py` | pass: all checks passed |
| 5.8 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs` | pass: whole suite, 1428 tests, 1428 passed, 0 failed, 0 skipped |
| 5.8 | `python3 scripts/check.py` | pass: all checks passed |
| 5.8 | `python3 scripts/gen-catalog.py --check` | pass: exit 0, all checks passed |
| 5.8 | `grep -q "Validation passed" "${TMPDIR%/}/devkit-validate-remote-worker/phase-5.txt"` | pass: exit 0 (file from task 5.5, not re-run here) |

### Acceptance criteria

All 41 `remote ...` tests (the 38 of the Proof map and the 3 of commit 7b9c499) passed in gate 4.6's run (and again in the whole suite of
gate 5.8). The red runs of each phase are kept in `openspec/changes/remote-worker/proof/red-1.txt`
to `red-4.txt`. By the owner's decision of 2026-11-23 (`B: depois do merge`; `tasks.md` Workflow
follow-up, `design.md` D-16 and R-10), the live part on two machines (L-1 to L-4) runs after the
merge. It is named below as "live: after the merge", not as a defect. No test runs `ssh`, starts a
session or sends a message (D-16): those host calls are proved by the exact `input` and `message`
the decision returns.

| AC | Criterion | Proof | Result |
|---|---|---|---|
| AC-1 | `open-refuses-claimed`: opening a change already claimed on `origin` is refused naming the machine; no worktree, folder or local branch | `change-loop.test.mjs`: `remote AC-1 open: a branch on origin with a claim refuses the open, naming its machine, and creates nothing` and `remote AC-1 open: a claim with no machine says another machine` passed. Live: after the merge (L-1). | pass |
| AC-2 | `open-pushes-claim`: the open leaves `refs/heads/<id>` on `origin` with `requirements.md` and the machine, with or without `machines` | `remote AC-2 open: the claim on origin holds requirements.md and the machine, with machines unset`, `remote AC-2 open: a remote open claims for that machine and leaves no local worktree or branch` and `remote AC-2 open: a machine name or a places value that is not valid is a usage error and creates nothing` passed (bare local remote). | pass |
| AC-3 | `open-race-one-wins`: of two racing opens exactly one claims; the other is refused and leaves nothing | `remote AC-3 open: the clone that pushes second is refused and leaves nothing` (the `beforePush` seam) and `remote AC-3 open: two clones opening one id at once, exactly one wins` (two child processes) passed. Live race against GitHub: after the merge (L-1). | pass |
| AC-4 | `no-origin-unchanged`: with no `origin`, no push and no refusal | `remote AC-4 open: with no origin nothing is committed or pushed` passed; `change-loop open: O4 with no remote starts from HEAD` is in gate 1.4 and passed. | pass |
| AC-5 | `status-shows-machine`: `/devkit status` lists open changes of other machines with their machine, never as ready | `roadmap-loop.test.mjs`: `remote AC-5 status: a line open only on another machine is listed under way with its machine, never in the queue`, `remote AC-5 status: GitHub unreadable prints the board with its line` and `remote AC-5 status: the machines block and the machine of each row` passed. Live: after the merge (L-1). | pass |
| AC-6 | `roadmap-never-reopens`: a roadmap run never opens a change whose branch is on `origin` | `remote AC-6 next: a line claimed on origin is never started, and its dependent waits` and `remote AC-6 next: a declared cannot-open of a line claimed elsewhere is dropped` passed. Live: after the merge (L-1). | pass |
| AC-7 | `machines-setting`: unset keeps today's behavior; set, an entry missing a field is refused naming it | `remote AC-7 machines: unset, empty, [] and a placeholder read as unset`, `remote AC-7 machines: an entry without a field is refused naming it, and nothing is written` and `remote AC-7 next: with machines unset the decision is today's` passed. | pass |
| AC-8 | `open-on-fewest`: a change goes to the answering machine with the fewest open changes; this machine skipped while loaded | `remote AC-8 next: each ready line goes to the answering machine with the fewest open changes` and `remote AC-8 next: this machine is skipped while loaded, and a start is held only when nothing can take it` passed. Live: after the merge (L-2). | pass |
| AC-9 | `remote-session-start`: a remote change gets a `session-start` with target ssh in its worktree there, only on a typed turn | `remote AC-9 next: a placed change gets a session-start with its checkout, target ssh, host and the remote cwd, only on a typed turn`, `remote AC-9 next: the run file keeps placed, which another session keeps and --fresh clears` and `remote AC-9 checkout: the worktree is made on the other clone from its branch` passed (the decision's exact `input` is asserted; no session is started by a test). Live session start: after the merge (L-2). | pass |
| AC-10 | `place-at-implementation`: grill and plan never wait; the implementation waits in ⏳ with no free place and runs once one is free | `change-loop.test.mjs`: `remote AC-10 next:` tests (no free place ends waiting with icon ⏳; a free place gives take-place then the implementation step; grill and plan never wait; a change without `x-devkit-places` never waits; a place already taken is not checked again; places of a run come from the run file; a change held by no approval or another machine takes no place), `remote AC-10 place: two changes of one machine at once, one takes the place` and `remote AC-10 stop: the blocked end no-place lets a /devkit change run stop` passed. Live: after the merge (L-3). | pass |
| AC-11 | `wake-on-free-place`: a freed place wakes one waiting change, which implements only if the script finds the place free | `roadmap-loop.test.mjs`: `remote AC-11 next: a freed place gives one wake per state for the first waiting change` and `remote AC-11 next: no wake without session mode`; `change-loop.test.mjs`: `remote AC-11 place: a wake that comes too early leaves the change waiting` passed (the wake `message` is asserted, none is sent). Whether the wake is delivered on a turn nobody typed: live, after the merge (L-3, R-7). | pass |
| AC-12 | `unreachable-machine`: a silent machine gets no change; the board says "no answer" for it and its changes; its changes keep their places | `remote AC-12 next: a silent machine gets no change, and its placed change no session`, `remote AC-12 status: a silent machine and its changes read no answer` and `remote AC-12 probe: state through the injected ssh returns the other clone's changes, and a failing ssh is no answer` (fake `ssh` exiting 255), `remote AC-12 probe: the installation is the project-scoped one at or above the folder, else the user-scoped one` and `remote AC-12 probe: the probe itself answers with an error and exit 3 when the pack is missing, the file unreadable or the status fails` passed. Live: after the merge (L-4). | pass |

`coordination-locks` delta: `remote locks stop: no ssh from the stop hook, and a start only another
machine could take does not refuse the stop` and `remote locks claims: the claims of a stale clone
cost at most 8 gh calls, and none for the default branch` passed, as did `remote locks claims: a listing with approval.md and a .openspec.yaml with places reads as placed with machine and places` (added by 7b9c499; it backs the placed reading behind AC-10 and AC-12).

No defect found.
