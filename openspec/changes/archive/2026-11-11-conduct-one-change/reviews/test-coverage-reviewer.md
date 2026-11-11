Verdict: approved
Commit: ace7ac08536e0fd6fb4ce400116ca7c712ab284a
Round: 2

## Coverage analysis: conduct-one-change, re-review (a527a0f..ace7ac0)

In-scope surfaces: plugins/openspec/hooks (conduct-check.mjs, node:test)
Blocking gaps (8-10 without a plan): 0
Seams checked (by reading; mutation runs: 0, suite result 397 pass taken as given):
- `--change` on a `chore/archive-<id>` worktree holding only the archived folder -> new test "reads a chore/archive-<id> worktree that holds only the archived folder (D2)" (uses archiveRepo/archiveGh; asserts one row and the same next.step and state as round mode; a live-only guard would make `t.state` exit 3 and fail it)
- dash-led ids in parseArgs (`/^[A-Za-z0-9][\w.-]*$/`) -> CLI test: `--change --json`, `--change -x`, `--change=-rf` all exit 3 with the usage message; plain id `a` still exit 0

### Findings
- [important] A `chore/archive-<id>` worktree holding only the archived folder, read with `--change <id>`, had no test · fixed in ace7ac0
- [nit] `dirty.slice(0, 3)` still not exercised with 4 or more paths (unchanged, optional).
- [nit] guard.test.mjs prose-substring pins are implementation-coupled (accepted convention).
- [nit] `--change` with `--busy` untested (shared code, low risk).

### Well covered
- Dash-led id refusal, including the case where the next flag is swallowed as the value.
- Single-row equivalence with round mode on the archive step.
