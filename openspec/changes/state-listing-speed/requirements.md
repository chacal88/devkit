<!-- devkit-stage requirements result=passed attempt=1 commit=none -->
# Requirements

## Request

> make the `state` listing fast enough for the coordinator's status bar, whose call is bounded at 20 s; on this repository `state --offline` over 11 changes takes 37 to 45 s, about 5 s per change read one after another, so the coordinator bar prints nothing. Read the changes in parallel, or skip the per-change reads the offline listing does not need.

Classification: domain=process type=bug flags=[] (strict-assumed: devkit script)

## Assumptions

<!-- Each confirmed by the owner. Literal paths, fields, names. -->
- The slow part is the per-change derivation in `stateEntries` (`plugins/openspec/hooks/change-loop.mjs`), which runs one synchronous `nextAction(..., { stages: true })` per id, one after another; each spends most of its time in two `openspec` CLI calls (`openspec status --change <id> --json`, `openspec instructions apply --change <id> --json`, about 0.75 s each on the avel machine, more on the owner's Mac). Measured on the avel machine: `state --offline` over 7 changes takes about 14 s, with 14 `openspec` calls and about 700 git calls.
- The fix reads the changes of the listing in parallel; it skips no per-change read, so every field of every entry is derived exactly as today (ADR 0017 decision 1: the state is derived on every read by the loop's own code and stored nowhere).
- The number of per-change reads that run at once is bounded by the machine's core count (`os.availableParallelism()`), the bound the project already uses for parallel work (ADR 0026).
- `plugins/openspec/hooks/status-line.mjs` is not changed: its 20 s bound (`STATE_BOUND_MS`) and its output stay as they are; it gets faster only because `state` does.
- `state --change <id>` and `next` keep their output; only the listing of several changes (no `--change`) is read in parallel.

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
- AC-1 `listing-reads-in-parallel`: `change-loop.mjs state` without `--change`, over a listing of several changes, runs the per-change reads concurrently: a test with a stand-in `openspec` that records when each call starts and ends shows at least two changes' reads overlapping, and never more at once than the bound of AC-3.
- AC-2 `listing-output-unchanged`: the listing's JSON is byte-identical to the sequential read's for the same repository state: the same entries, each id once, in id order, with the same fields and values (`openspec/specs/change-state/spec.md` "in id order, each as for one change"); a test compares the parallel listing with each entry read alone through `state --change <id>`.
- AC-3 `listing-concurrency-bound`: no more per-change reads run at once than `os.availableParallelism()` (and never fewer than one); a test pins the bound with a stand-in that counts overlapping calls.
- AC-4 `listing-failures-unchanged`: a change that cannot be read still appears as its `blocked` entry with the reason `unreadable`; a change whose read fails the whole command today (an invalid merge setting in its worktree, exit 3) still fails the listing with exit 3; `state --change <id>` with an id no file can place still fails with `no change named <id>` (a listing cannot reach that case: its ids come from the change folders and the run file). Tests cover each case under the parallel read.
- AC-5 `eleven-changes-under-ten-seconds`: on the avel machine, with no test suite running and the load recorded next to the time, `state --offline` over a repository holding 11 changes in play completes in under 10 s; the run, its time and the load are in `evidence.md`.
- AC-6 `single-change-and-next-unchanged`: `state --change <id>` and `next --change <id>` print what they print today; the existing tests of `change-state-stages.test.mjs`, `change-loop.test.mjs` and `status-line.test.mjs` pass unchanged.

## Answered by triage

1. [end effect] Must the listing's JSON stay identical? → One entry per change, each id once, in id order, each as for one change; the entry is `{ change, ...changeState, script, root, branch, stages }` (source: `openspec/specs/change-state/spec.md:42-46`, `plugins/openspec/hooks/change-loop.mjs:2101,2108,2120`).
2. [project rules] Which ADRs bind this? → ADR 0017 decision 1: the state is derived on every read by the loop's own code and stored nowhere; the panels read the command (source: `docs/adr/0017-a-change-state-is-derived-in-one-place.md:55-65`). `--offline` makes no GitHub call, writes nothing and exits 0 (source: `openspec/specs/change-state/spec.md:246-249`).
3. [project rules] Where do the tests of `state` live, and does a new test file need a map entry? → `plugins/openspec/hooks/change-state-stages.test.mjs`, `change-loop.test.mjs`, `change-loop-remote-state.test.mjs`, `status-line.test.mjs`; a new test file edits `scripts/test-map.json` in the same commit (source: `plugins/openspec/hooks/change-state-stages.test.mjs:16,109`, `CLAUDE.md` Working rules).

## Questions asked

1. [scope] Is the change limited to the listing without `--change`, leaving `state --change <id>` and `next` unchanged? → Yes: only the multi-change listing is read in parallel; `state --change <id>` and `next` keep their output (AC-6). (answered by the coordinator's session on the owner's delegation of 2026-11-28)
2. [scope] Does the change touch status-line.mjs? → No: its 20 s bound and output stay; the fix is in the `state` command of `change-loop.mjs`. (answered by the coordinator's session on the owner's delegation of 2026-11-28)
3. [end effect] Which per-change reads may the offline listing skip? → None: the listing reads in parallel and keeps every field, the most conservative of the two ways the request names; dropping fields would change what the command delivers. (answered by the coordinator's session on the owner's delegation of 2026-11-28)
4. [edges] How is one change's failed read handled under a parallel read? → As today: an unreadable change is its `blocked` entry with reason `unreadable`; a read that fails the whole command for one change fails the listing; an unknown id given to `--change` fails with `no change named <id>` (AC-4). (answered by the coordinator's session on the owner's delegation of 2026-11-28)
5. [edges] What bounds the concurrent reads? → The core count, `os.availableParallelism()`, as the test runner's concurrency does under ADR 0026 (AC-3). (answered by the coordinator's session on the owner's delegation of 2026-11-28)
6. [end effect] How is "11 changes under 10 s" proved before merge? → Two ways: a test pins the overlap and the bound with a stand-in `openspec` that records its calls (no timing assertion in the suite); a real timed run over 11 changes on the avel machine, with the load recorded, goes in `evidence.md` (AC-1, AC-3, AC-5). (answered by the coordinator's session on the owner's delegation of 2026-11-28)

## Escalations

- None.

## Out of scope

- Skipping or caching per-change reads, or dropping fields from the listing's entries.
- Any change to `plugins/openspec/hooks/status-line.mjs`, its 20 s bound or its lines.
- The `machine-probe.mjs` / `roadmap-loop.mjs` remote state reads.
- Making `openspec` or the git calls themselves faster.
