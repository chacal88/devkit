<!-- devkit-stage proposal result=passed attempt=1 commit=b7acf8f5042142eb9fcdd89dc96dbf1be40a5263 -->
# Proposal

Change: `train-empty-failure-text` · Date: 2026-11-28 · Owner: Kaue (chacal88) · PRD / tech spec:
n/a (sources: `requirements.md`, `decisions.md`, `release.md`). Base: `origin/main` at `6f03a57`
(train 21); the branch was opened on it (`b7acf8f`) and has merged nothing since. The only other
change folder, `test-map-hub-links`, is already on that base.

## Why

When every boarded change leaves a train, the departure ends `result: empty` and drops what it
learned: the `left` entries of its JSON output omit `failure` (`outLeft`,
`plugins/openspec/hooks/train-loop.mjs:338`), and no record is written, because the record is
written and committed only on the green path (`train-loop.mjs:393-404`). The failing test of a
change left `red` is then unknown, and train 18 cost a 35-minute run of the whole suite to find it
again. ADR 0022 decision 7 says a red change "leaves the train with the failure attached"; at the
empty end it does not.

## What Changes

- **The empty end keeps the failure.** Each `left` entry of a departure that ends `result: empty`
  carries `failure`: the failing suite output for a `red` entry, `null` for a `conflict` entry.
  The `left` entries of the `passed` output stay as they are.
- **An empty train writes its record outside every checkout.** The departure writes the text the
  train record already has (`result=empty`, an empty Boarded table, every left change with its
  reason, each red change's `## Failure of` section, the Runs table) to
  `<git common dir>/devkit-trains/<n>.md`, uncommitted, overwriting an earlier file at that path,
  and names its absolute path in a new output field `record`.
- **Nothing else is created.** An empty train still creates no `train/<n>` branch, no worktree, no
  commit and no pull request, so it takes no train number: the next departure gets the same `<n>`.
- **A new reply.** The empty end replies with a new message key `train-empty` (English and
  Brazilian Portuguese) that says the train emptied, nothing was boarded, and names the record's
  path. `train-nothing` stays the reply of `result: nothing` only.
- **Tests.** The existing test of a train that empties (`delivery-train.test.mjs:1708`) keeps its
  branch assertion and gains the record's and the reply's; new tests cover a train emptied only by
  a conflict and a second empty departure; the key list of `delivery-train-after.test.mjs:178` and
  its document test gain the new key and the new sentence.
- **Documents.** The delivery-train spec gains a requirement with its scenarios, and
  `docs/openspec-flow.md` says where an empty train's record is written.

Non-goals (from `requirements.md`, "Out of scope"): no pull request, branch or commit for an empty
train, and no wait for the changes it left; no `failure` in the `passed` output's `left` entries; no
history of a reused train number beyond the latest file; no change to `parseTrainRecord`.

## Acceptance criteria

- AC-1: A departure whose train empties with a red change exits 1 with `result: empty`, and that change's `left` entry in the JSON output has `why: red` and a `failure` holding the suite's failing output.
- AC-2: A departure whose train empties writes `<git common dir>/devkit-trains/<n>.md`, names its absolute path in the output's `record` field, and the file's header says `result=empty`, lists every left change with its `why`, and holds a `## Failure of` section with the failing output for each red change.
- AC-3: A departure whose train empties creates no `train/<n>` branch, no `.claude/worktrees/train-<n>` worktree and no commit, leaves the root checkout's `git status` as it was, leaves no scratch folder, and the next departure is numbered the same `<n>`.
- AC-4: A train that empties only by conflicts also writes the record, and its `left` entries carry `failure: null`.
- AC-5: The reply of an empty departure is `train-empty` with the record's path, in English and in Brazilian Portuguese; a departure with nothing boarded still replies `train-nothing`.
- AC-6: The delivery-train spec gains a scenario for a train that empties, and `docs/openspec-flow.md` says where an empty train's record is written.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `delivery-train`: a new requirement, "A train that empties keeps its record outside every
  checkout", with scenarios for a train emptied by red changes, one emptied only by a conflict,
  and a second empty departure of the same number. No existing requirement's text changes.

## Impact

- `plugins/openspec/hooks/train-loop.mjs` (devkit-openspec): the `result: empty` end of
  `departTrain` only; the `passed`, `nothing` and `base-red` ends, `updateTrain`, `next`,
  `nextNumber`, `underWay` and `writeTrainRecord` keep their behaviour.
- `plugins/openspec/hooks/change-loop.mjs` (devkit-openspec): one key, `train-empty`, in each of
  the two message tables.
- Tests: `plugins/openspec/hooks/delivery-train.test.mjs` and
  `plugins/openspec/hooks/delivery-train-after.test.mjs`. No test file is added or moved, so
  `scripts/test-map.json` is not edited.
- Docs: `docs/openspec-flow.md` (one sentence) and the delivery-train spec delta.
- Readers of train records (`parseTrainRecord`, `trainFacts`, the `devkit-reviews` train check):
  unchanged; none reads the new file, which is outside every tracked tree.
- Changes left by an empty train keep today's cycle (`openspec/specs/delivery-train/spec.md:193-196`,
  `plugins/openspec/hooks/deliver-check.mjs:1207-1221`): no train pull request lists them, so they
  board again at the same head.
- Release: one patch of `devkit-openspec` (`release.md`); no task bumps a version, edits a
  `CHANGELOG.md` line or a CI pin, or numbers an ADR.

Exit criteria: every task of `tasks.md` checked, its gate
`node scripts/test-suite.mjs --own-files && python3 scripts/check.py` green, and
`openspec validate train-empty-failure-text --strict` passing.

Decisions cited: ADR 0022 (decision 7, the failure attached; decision 1, the train branch), ADR
0034 (the release note), ADR 0036 (the gate's selective part). No new ADR (`decisions.md`). Open
decisions inherited: none; the repository keeps no open-decisions log.
