Verdict: approved
Commit: d50ffb134c0486372e7b44e2888c211b099bfe99

## Quality review — archive-after-merge (round 2, scoped)

Range e497cc2..d50ffb1. Suite result taken from the caller (380/380, check.py, catalog, validate green); not re-run. I ran only the 20 tests of deliver-check.test.mjs matching list/buffer: 20 pass, 0 fail.

### Findings
- [important] plugins/openspec/hooks/deliver-check.mjs (findChangePr, merged-PR list overflowing spawnSync's 1 MiB buffer, "gh exited null") · fixed in d50ffb1. Verified in the code:
  - The list asks for light fields only (`body` stripped from MERGE_FIELDS/PR_FIELDS, deliver-check.mjs:469-472).
  - Bodies are read with `gh pr view <n> --json body`, newest first, stopping at the first PR whose body holds the evidence link (:481-486). A failing or unreadable view is an `{ error }`, never a silent none.
  - `makeGh` passes `maxBuffer: GH_MAX_BUFFER` (64 MiB), and `overflowed` is set from `ENOBUFS` (merge-setup.mjs:27-39).
  - `ghError` names it: "gh output too large to read (ENOBUFS)" (:48).
  - Tests: the findChangePr test builds a list whose full JSON is above 1 MiB (asserted in the test) and still finds the PR. The makeGh/ghError test forces `maxBuffer: 4` and asserts `overflowed`. Both pass here.
  - The other `pr list` calls (`--head <branch> --limit 10`, `archivePrFacts`) are bounded and carry no unbounded bodies.
- [nit] deliver-check.mjs:481 — worst case (the change PR is not among the newest few) is up to 100 sequential `gh pr view` calls, each capped at 60 s. This is bounded and only reached when no PR links the evidence path. Optional: cap the body reads (say the 30 newest) or use `gh pr list --search "<link> in:body"`.
- [nit] (carried from round 1, still open, non-blocking) `--limit 100` truncation is not named in the reason, and the contents-API listing of `openspec/changes/archive` is limited to 1000 entries.
- [praise] deliver-check.mjs:466-486 — the fix removes the cause (payload size), not only the symptom: the cap and the named error are defense in depth, and the lookup keeps the original precedence (link in body, then branch name, newest first).
- [praise] deliver-check.mjs `archiveNext` (`held`, `filesStop`, `answersStop`) — one shared check serves both the open-PR and the post-merge paths, and `disable-auto-merge` fires before any stop when the answer or file check fails. `archivePrCheck` fails closed when `origin/<base>` is missing.

### Summary
- 2 open findings (0 blocking, 0 important, 2 nit) + 2 praise; the round-1 important is fixed
- Justification: the only previous blocking/important finding is fixed and verified in code and in the two new tests. The range's other changes (open-PR answer and file checks, CI archive check, `isArchiveRecord`) are consistent with the design and add no defect I could find. `unnamedFiles` now treats only `openspec/changes/` and `openspec/roadmap.md` as free, which tightens AC-3. No open blocking or important item remains.
