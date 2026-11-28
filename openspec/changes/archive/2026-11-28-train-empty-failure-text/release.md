# Release note

packs:
- devkit-openspec: patch

## an empty train keeps the failure of each change it left

- **devkit-openspec**: when every boarded change leaves a train (`result: empty`),
  `train-loop.mjs depart` keeps each left change's `failure` in its JSON output (the failing suite
  output for a `red` change, `null` for a `conflict`) and writes the train record, with
  `result=empty`, uncommitted at `<git common dir>/devkit-trains/<n>.md`, named in a new `record`
  field and in the new reply `train-empty`. An empty train still creates no branch, worktree,
  commit or pull request and takes no train number. The `passed`, `nothing` and `base-red` ends are
  unchanged.
- Docs: `docs/openspec-flow.md` says where an empty train's record is written; the delivery-train
  spec gains the requirement.
