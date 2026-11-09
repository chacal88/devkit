Verdict: approved
Commit: d50ffb134c0486372e7b44e2888c211b099bfe99

## Architecture review — archive-after-merge (e497cc2..d50ffb1), round 2 (re-review)

Analyzed: only the two previous findings and the range e497cc2..HEAD. Owners: `unnamedFiles` and `readRetro` stay the single owners of the file check and the retro format, and `runCi` now calls both. Boundaries: CI (server side) and the local run enforce the same rule. Contract consumers: the `--ci` JSON gains an `archive` object, additive on `{version, mode, change, pass}`. Deletion test: `archivePrCheck` passes, because it hides the base-ref diff, the folder detection and the retro reads behind one return value that `runCi` formats. The suite was not re-run; the caller reports 380/380 at d50ffb1.

### Findings
- [important] "file check is local only" (deliver-check.mjs `unnamedFiles` / `selectCiChange`) · fixed in d50ffb1. `runCi` (deliver-check.mjs:1398) calls `archivePrCheck` (:1381) when no change is selected and `GITHUB_BASE_REF` is set. That function lists the PR's changed paths, finds the archived folders, reads each `retro.md` with `readRetro`, and runs the same `unnamedFiles` over the proposals. It fails on a missing retro, unanswered proposals, or unnamed files. Detection is by folder in the diff, not by branch name, so a renamed branch cannot bypass it. Tests at deliver-check.test.mjs:2765-2810 cover pass, unnamed file, unanswered or missing retro, and no-archive. Design D8 ("The check in CI") is amended to match.
- [important] "retro format unpinned" (retro/SKILL.md vs `readRetro`) · refuted: deliver-check.test.mjs:3833 reads plugins/core/skills/retro/SKILL.md, takes the fenced block under `## Output`, and runs `readRetro` on it. It asserts the block is readable, has at least two proposals, and that every proposal has targets and a kind, no Answer and no Applied. It also checks that a user-memory proposal is present. A wording edit to the skill that breaks the parser now fails the suite. The test was already in e497cc2, so my round-1 finding was wrong to say nothing pinned the format.

### Remaining nits (round 1, unchanged, not blocking)
- [nit] The `YYYY-MM-DD-<id>` archive-folder pattern is still repeated across guard.mjs and deliver-check.mjs. `archivePrCheck` adds one more regex (:1385). Consider one helper exported from guard.mjs.
- [nit] deliver-check.mjs keeps growing, now with `archivePrCheck` as well. Consider an archive module behind the existing `state.archive` seam if post-merge behavior grows again.
