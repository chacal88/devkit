Verdict: approved
Commit: 60e251cdb2d9d0e775a0f0eb18dae0f29fdded55

## Quality review — suite-speed (round 3, re-review after the merge of origin/main)

### Findings
- [important] scripts/test-suite.mjs:231-243,305 — Entry check compared resolve(argv[1]) with the real path, so a symlinked start exited 0 silently; now realpathSync with ENOENT/ENOTDIR handling and a probe over a symlinked file and folder. · fixed in 21d1d4d
- [nit] scripts/test-suite.mjs:219 — A FAIL file hid what it left in its TMPDIR; the summary now prints left: for any result with leftovers. · fixed in 21d1d4d
- [nit] plugins/openspec/hooks/test-tmp.test.mjs:198 — Kept test name still says a step fails when TMPDIR is not empty after, while it now asserts the single Test suite step.
- [nit] scripts/check.py:140-157 — Exemption of plugins/compozy let 'only' through; now only skip and todo pass there and 'only' is refused. · fixed in 21d1d4d
- [nit] plugins/openspec/hooks/roadmap-loop-upfront.test.mjs:409 — Stale comment about the git identity source; now names GIT_ENV in test-fixtures.mjs. · fixed in 21d1d4d
- [nit] CLAUDE.md:33 — Command row said 'Every test file'; now 'The suite's test files'. · fixed in 21d1d4d
- [nit] openspec/changes/suite-speed/evidence.md AC-2 — The AC-2 name lists date from a9babd2 and the claim that they still hold rests on a diff and a count, not a fresh TAP extraction; the evidence says so openly.
- [praise] plugins/openspec/hooks/test-suite.test.mjs:74 — The symlink probe covers both a symlinked folder and a symlinked file and asserts the exit code and the usage text, so a silent exit 0 cannot pass.
- [praise] openspec/changes/suite-speed/evidence.md:6-42 — The refreshed evidence says plainly that the whole-suite run belongs to 21d1d4d and stands for the merge head only because the diff outside openspec/ is empty. It also says what the verifier did and did not run.

### Summary

- 9 findings (0 blocking, 0 important open, 2 nit open) + 2 praise.
- Justification: this re-review exists only because the Commit lines went stale after the branch merged origin/main (`ea482c0`, the owner-merged PRs 91, 93 and 94).
  - `git diff 21d1d4d HEAD --stat -- . ':!openspec'` printed nothing (0 bytes), so the code and docs outside `openspec/` are byte-identical to what I approved at `21d1d4d`.
  - `git diff 06debd0..HEAD --stat -- . ':!openspec'` is also empty. The merge `bd1151a` and the refresh `60e251c` changed only four records under `openspec/changes/suite-speed/`: `evidence.md`, `review.md`, `reviews/code-quality-reviewer.md` and `reviews/test-coverage-reviewer.md`.
  - `evidence.md` at attempt 4 states the same byte-identical claim and ties the whole-suite proof (`2917 tests, 2914 pass, 0 fail`, `exit=0`) to `21d1d4d`. It does not claim a run at the merge head. `review.md` now records round 2 as passed.
  - I opened no code file, so there is nothing new to hunt for. My round 2 verdict stands: no blocking, no important open. The two open nits (F3, F7) are unchanged and do not block.
  - I did not run the whole suite or any test file, as instructed.

### Carried questions for the coordinating session

- Re-check the CHANGELOG release numbers and the ADR numbering against origin/main before the push (not fetched here). The merge brought in the stack PRs, so this matters more now.
- AC-5b and the CI-green half of AC-7 still need the pull request's first check run before enable-auto-merge.
