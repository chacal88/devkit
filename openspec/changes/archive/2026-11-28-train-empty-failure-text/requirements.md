<!-- devkit-stage requirements result=passed attempt=1 commit=none -->
# Requirements

## Request

> train-empty-failure-text: when a train ends empty (`result: empty`), `train-loop.mjs` drops the `failure` text of a change it left `red` (`outLeft` omits it and no `openspec/trains/<n>.md` is written), so the failing test is unknown; train 18 cost a 35-minute run for it. Keep the failure text in the end's output and write the train record for an empty train too, with a test of a train that ends empty.

## Assumptions

<!-- Each confirmed by the owner. Literal paths, fields, names. -->
- The change touches only the `result: empty` end of `departTrain` in `plugins/openspec/hooks/train-loop.mjs`; the `passed`, `nothing` and `base-red` ends keep their output and behaviour.
- Each `left` entry of an empty departure's JSON output carries `failure`: the failing suite output for a `red` entry, `null` for a `conflict` entry. The `left` entries of the `passed` output are not changed by this change.
- The record of an empty train is the text `writeTrainRecord` makes, with `result=empty`, an empty Boarded table, every left entry and each red entry's `## Failure of` section, and its Runs table.
- The record of an empty train is written as an uncommitted file outside the tracked tree of every checkout: `<git common dir>/devkit-trains/<n>.md`, where `<git common dir>` is what `git rev-parse --git-common-dir` prints in the root, made absolute. An earlier file at that path is overwritten. The output names its absolute path in a field `record`.
- An empty train creates no `train/<n>` branch, no worktree under `.claude/worktrees`, no commit and no pull request, so it consumes no train number: the next departure gets the same `<n>`, and `underWay` and `nextNumber` are unchanged.
- Every empty train gets the record, whether its changes left `red`, by `conflict`, or both.
- The reply of an empty departure is a new message key `train-empty` (in the English and Brazilian Portuguese tables of `change-loop.mjs`) that says the train emptied, nothing was boarded, and names the record's path; `train-nothing` stays for `result: nothing` only.
- Changes left by an empty train keep today's cycle: no train pull request lists them, so they board again at the same head.
- No reader of train records (`parseTrainRecord`, `trainFacts`, the `devkit-reviews` train check) reads an empty train's record; `parseTrainRecord` is not changed.

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
- AC-1: A departure whose train empties with a red change exits 1 with `result: empty`, and that change's `left` entry in the JSON output has `why: red` and a `failure` holding the suite's failing output.
- AC-2: A departure whose train empties writes `<git common dir>/devkit-trains/<n>.md`, names its absolute path in the output's `record` field, and the file's header says `result=empty`, lists every left change with its `why`, and holds a `## Failure of` section with the failing output for each red change.
- AC-3: A departure whose train empties creates no `train/<n>` branch, no `.claude/worktrees/train-<n>` worktree and no commit, leaves the root checkout's `git status` as it was, leaves no scratch folder, and the next departure is numbered the same `<n>`.
- AC-4: A train that empties only by conflicts also writes the record, and its `left` entries carry `failure: null`.
- AC-5: The reply of an empty departure is `train-empty` with the record's path, in English and in Brazilian Portuguese; a departure with nothing boarded still replies `train-nothing`.
- AC-6: The delivery-train spec gains a scenario for a train that empties, and `docs/openspec-flow.md` says where an empty train's record is written.

## Questions asked

- Q1 (scope): Which outputs of an empty departure carry each red change's failure text? Answer: the JSON `left` entries (`failure`, `null` for a conflict); the reply names the record's path and does not repeat the text. (answered by the coordinator's session on the owner's delegation of 2026-11-28)
- Q2 (end effect): Where is an empty train's record written? Answer: an uncommitted file at `<git common dir>/devkit-trains/<n>.md`, outside every checkout's tracked tree, named in the output's `record` field; a commit on `train/<n>` would make `underWay` see a train under way. (answered by the coordinator's session on the owner's delegation of 2026-11-28)
- Q3 (edges): Does an empty train consume a train number? Answer: no; the next departure gets the same number and overwrites the file. (answered by the coordinator's session on the owner's delegation of 2026-11-28)
- Q4 (edges): Does a train emptied only by conflicts get a record? Answer: yes, every empty train does. (answered by the coordinator's session on the owner's delegation of 2026-11-28)
- Q5 (conflict): May the test "a train that empties ... creates nothing" change, and does the reply change? Answer: the test (invariant: an empty train creates no train branch or worktree; layer: the `train-loop.mjs` departure; suite: `delivery-train.test.mjs`) keeps its branch assertion and adds the record's; the reply becomes the new key `train-empty`, and the key table in `delivery-train-after.test.mjs` gains it. (answered by the coordinator's session on the owner's delegation of 2026-11-28)
- Q6 (conflict): Do changes left by an empty train change their cycle? Answered by triage: no; only a train pull request's record changes a left change's cycle (`openspec/specs/delivery-train/spec.md:193-196`, `plugins/openspec/hooks/deliver-check.mjs:1207-1221`).
- Q7 (conflict): Does any reader need an empty train's record? Answered by triage: no; `parseTrainRecord` is read only on train pull requests (`plugins/openspec/hooks/deliver-check.mjs:1207-1213`, `:3633`).
- Q8 (scope): Which docs change? Answer: the delivery-train spec (a scenario) and `docs/openspec-flow.md` (one sentence); the Train section of `plugins/openspec/skills/devkit/SKILL.md` already says to say the `reply`. (answered by the coordinator's session on the owner's delegation of 2026-11-28)

## Out of scope

- Opening a pull request, a branch or a commit for an empty train, or making changes left by an empty train wait on anything.
- Adding `failure` to the `left` entries of the `passed` output.
- Keeping more than the latest record of a reused train number.
- Changing `parseTrainRecord` to read an empty Boarded table.
