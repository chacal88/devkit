<!-- devkit-stage proposal result=passed attempt=1 commit=466f908cf1f23235f45246423900b23e45ab524a -->
# Proposal

Change: `state-listing-speed` · Date: 2026-11-28 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(sources: `requirements.md`, `decisions.md`, `release.md`). Base: `origin/main` at `6f03a57c`; the
branch was opened on it (`466f908c`) and has merged nothing yet. One other change is in
`openspec/changes/`, `test-map-hub-links`, already merged into the base (train 21); it touches
`scripts/test-map.json`, which this change edits too.

## Why

The coordinator's status bar reads `change-loop.mjs state --offline` with a 20 s bound
(`STATE_BOUND_MS`, `plugins/openspec/hooks/status-line.mjs:20`), and on this repository that call
takes 37 to 45 s over 11 changes, so the bar prints nothing. The listing reads each change one
after another (`stateEntries`, `plugins/openspec/hooks/change-loop.mjs:2093`), and each read waits
mostly on two `openspec` CLI calls and about 100 short git calls, so its time grows with the number
of changes in play.

## What Changes

- **The listing reads its changes concurrently.** When `change-loop.mjs state` runs as a command
  without `--change`, it reads the listing's ids as today, then reads each change in a child
  process of the same script (`state --change <id>` with the same `--offline` and `--lang`, the
  same environment and folder), at most `os.availableParallelism()` at a time and never fewer than
  one, and joins their entries in id order (`design.md` D-1 to D-4).
- **Its output does not change.** Every entry is the one `state --change <id>` prints, so the
  listing is byte-identical to the sequential read: no field dropped, no read skipped or cached,
  each id once, in id order. A change that cannot be read is still its `blocked` entry with the
  reason `unreadable`; a read that fails the command (an unknown `merge_method` in that change's
  checkout, the one such failure a listing can reach) still fails it with the same output, that of
  the first such id in id order; `state --change <id>` with an id no file can place still fails
  with `no change named <id>`, a case a listing cannot reach (its ids come from the change folders
  and the run file). One case is new: a child that dies by a signal, fails to start, exits with a
  code other than 0 or 3 or prints no single entry for its id fails the command with exit 3 and
  `state of <id> could not be read: <why>`; the read one after another has no such case (D-5).
- **In-process callers keep the sequential read.** `main(['state', ...])`, which the tests call with
  stand-in `openspec` and `gh` runners that cannot cross a process, and a listing of one change or
  none, read in process exactly as today, with no child started (D-1, D-6).
- **The children take no optional git lock.** Each child runs with `GIT_OPTIONAL_LOCKS=0`, so the
  `git status` calls of reads that share one checkout never refresh its index, and two children
  never contend on its `index.lock`; the read path holds no fetch and no other write (D-2).
- **One sentence in `docs/openspec-flow.md`** ("A change's state." paragraph) says that the listing
  reads its changes at once, bounded by the machine's cores (D-8).
- **A new test file**, `plugins/openspec/hooks/change-state-listing.test.mjs`, linked in
  `scripts/test-map.json` in the same commit (D-7).

Non-goals: everything under "Out of scope" in `requirements.md` (no skipped, cached or dropped
read; `status-line.mjs` untouched; the remote state reads of `machine-probe.mjs` and
`roadmap-loop.mjs`; `openspec` and git themselves). Also out: an async rewrite of `nextAction`, a
setting or environment variable for the bound, and any change to `state --change <id>`, `next`,
`wait` or the board.

## Acceptance criteria

Copied from `requirements.md`, with their ids.

- AC-1 `listing-reads-in-parallel`: `change-loop.mjs state` without `--change`, over a listing of several changes, runs the per-change reads concurrently: a test with a stand-in `openspec` that records when each call starts and ends shows at least two changes' reads overlapping, and never more at once than the bound of AC-3.
- AC-2 `listing-output-unchanged`: the listing's JSON is byte-identical to the sequential read's for the same repository state: the same entries, each id once, in id order, with the same fields and values (`openspec/specs/change-state/spec.md` "in id order, each as for one change"); a test compares the parallel listing with each entry read alone through `state --change <id>`.
- AC-3 `listing-concurrency-bound`: no more per-change reads run at once than `os.availableParallelism()` (and never fewer than one); a test pins the bound with a stand-in that counts overlapping calls.
- AC-4 `listing-failures-unchanged`: a change that cannot be read still appears as its `blocked` entry with the reason `unreadable`; a change whose read fails the whole command today (an invalid merge setting in its worktree, exit 3) still fails the listing with exit 3; `state --change <id>` with an id no file can place still fails with `no change named <id>` (a listing cannot reach that case: its ids come from the change folders and the run file). Tests cover each case under the parallel read.
- AC-5 `eleven-changes-under-ten-seconds`: on the avel machine, with no test suite running and the load recorded next to the time, `state --offline` over a repository holding 11 changes in play completes in under 10 s; the run, its time and the load are in `evidence.md`.
- AC-6 `single-change-and-next-unchanged`: `state --change <id>` and `next --change <id>` print what they print today; the existing tests of `change-state-stages.test.mjs`, `change-loop.test.mjs` and `status-line.test.mjs` pass unchanged.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `change-state`: one ADDED requirement, "The listing reads its changes concurrently": the
  listing's reads overlap within the machine's core bound, its output and its failures stay those
  of the sequential read, a read process that gives no entry fails the command with exit 3, and a
  listing of one change or none starts no read process. No existing requirement's text changes.

## Impact

- `devkit-openspec`: `plugins/openspec/hooks/change-loop.mjs` (the `state` listing path in
  `runCommand`, an id helper split out of `stateEntries`, a bounded pool, the child read and the
  join); `plugins/openspec/hooks/change-state-listing.test.mjs` (new). `status-line.mjs`,
  `machine-probe.mjs` and `roadmap-loop.mjs` are not edited; the status line's coordinator call
  gets faster because `state` does.
- Repository: `scripts/test-map.json` (the new test under the `change-loop.mjs` key);
  `docs/openspec-flow.md` (one sentence).
- Release: `release.md`, `devkit-openspec: patch`; no task bumps a version, edits `CHANGELOG.md`
  or a CI pin.
- CI: none. `.github/workflows/ci.yml` is not edited.

**Dependencies.** None under way. The status line's bound and its process-group kill
(`status-line.mjs:157-171`, change `run-status-bar`) and the `--offline` flag are on the base.

**Decisions cited.** ADR 0017 decision 1 (the state is derived on every read by the loop's own
code and stored nowhere), ADR 0026 (the core-count bound of the suite's parallel files; its
Consequences on a loaded machine), ADR 0034 (the release note), ADR 0036 (the gate's
`--own-files` part), and `decisions.md` (no record needed).

**Open decisions inherited.** None. No point of `docs/coordination-design.md` "Open points" is
touched.

**Exit criteria.** `node scripts/test-suite.mjs --own-files && python3 scripts/check.py` green;
`python3 scripts/gen-catalog.py --check`, `node plugins/compozy/kit/scripts/gen-agents.mjs --check`,
`claude plugin validate .` and `openspec validate state-listing-speed --strict` pass; the AC-5 run
is in `evidence.md`.
