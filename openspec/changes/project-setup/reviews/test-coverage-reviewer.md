Verdict: approved
Commit: ca7ca7bbc145acdb5a1523f5bcc29397a868f930

## Coverage analysis — project-setup round 6 re-review (2079b0f84d05c024a14338da7f9117b44b14c137..ca7ca7bbc145acdb5a1523f5bcc29397a868f930)

### Findings
- [important] plugins/openspec/skills/devkit/scripts/setup-block.mjs:326 — [7] The default delivery answer 'none' was never tested; a broken skip at lines 326/357 would write `model: none`, which the loop then reads as an unknown model. · fixed in 387bf1553e85d7610c5ee64c0bf5e4b6f6a444d7
- [important] plugins/openspec/skills/devkit/scripts/setup-block.mjs:145 — [6] No test checked that a model answered in the same call decides what else may be answered (trunk-auto with merge_method and no ship map; trunk with a ship answer refused). · fixed in 387bf1553e85d7610c5ee64c0bf5e4b6f6a444d7
- [nit] plugins/openspec/skills/devkit/scripts/setup-block.mjs:180 — [4] No test reads plan.kit as 'installed' (a project with .compozy/kit-manifest.json); only 'absent' is checked at setup-block.test.mjs:73. Write in: setup-block.test.mjs, one plan assertion with files {'.compozy/kit-manifest.json': '{}'}.
- [nit] plugins/openspec/skills/devkit/scripts/kit-installer.mjs:91 — [3] kit-installer's own usage errors (no argument, '--where' with an extra argument, a root starting with '-') should exit 2 with nothing run, and no test covers them. Write in: kit-installer.test.mjs, a loop over the three argument sets on sandbox().
- [nit] plugins/openspec/skills/devkit/scripts/setup-block.mjs:245 — [3] Two minor paths have no test: refusing an invalid release_tag ('VERSION', '../x.json'), and the kept entries built from settings.missing at line 141 (two-prs with no test_branch gives value null). Write in: setup-block.test.mjs, one row in the invalid-answer table and one plan assertion.
- [nit] plugins/compozy/kit/scripts/install-kit.mjs:30 — [4] No test checks the `pack` version that the kit manifest records after PACK_JSON moved from three '..' to two; a wrong path would silently record 'unknown'. Write in: kit-installer.test.mjs:139, read the manifest and check that pack equals plugins/compozy/.claude-plugin/plugin.json's version.
- [nit] plugins/openspec/hooks/guard.test.mjs:192 — Implementation-coupled: the 'setup AC-n skill' tests match exact SKILL.md sentences and would fail on a rewording that keeps the meaning (the step-7 test at guard.test.mjs:1900 follows the same pattern). This is the project's convention for the skill-text layer; noted only.
- [important] plugins/openspec/hooks/change-loop.mjs:2119 — [5] The 'inside' branch (findRoot's folder strictly below the git top level, design D-1) had no test: `root: inside ? start : top` changed to `root: top` left every setup test green, so setup typed in app/ of a repository holding app/openspec/changes would write its config at the repository top. · fixed in 9f9aef1f4c131c31770198acd03a438d986a72e2
- [praise] plugins/openspec/hooks/change-loop.test.mjs:1060 — N-21 pins the subfolder root by its observable result (mode and root in the start JSON, from app/ and app/src/) plus an unchanged file list, and states its invariant, layer and suite as the working rule requires.

In-scope surfaces: devkit-openspec hooks (change-loop.test.mjs, one new test N-21 in 9f9aef1). The rest of the range (5e4011e, ca7ca7b) is plan, evidence and review text (design.md N-21 row, evidence.md attempt 5, review.md, reviews/*.md), with no product code; `git diff 2079b0f..ca7ca7b -- plugins/` holds only the added test.

Blocking gaps (8-10 without a plan): 0

Seams checked (mutation runs: 0; one run of the setup start tests only, with no other suite run on the machine per `pgrep -f 'scripts/test-suite.mjs$'`: `TMPDIR=/var/tmp/devkit-project-setup node scripts/test-suite.mjs --concurrency=3 --test-name-pattern='^setup AC-1 start' plugins/openspec/hooks/change-loop.test.mjs`, which passed: 1 file, 7 tests, 7 pass, 0 fail):
- findRoot's folder strictly inside the git top level (change-loop.mjs:2116-2119, the `inside ? start : top` branch): caught by change-loop.test.mjs:1060 'setup AC-1 start: setup in a subfolder holding openspec/changes inside the repository answers that subfolder as root'. plainGitRepo() returns a realpath top, app/openspec/changes is created under it, and the test deepEquals [mode, root] against ['setup', app] from app/ and from app/src/. With `root: top`, root would be the repository top, not app, and the assertion fails. I confirmed this by reading the code and did not run the mutation. With `inside` forced to false, the result is the same.
- Nested repository in an outer folder (N-20), start == top (N-2 and the no-openspec case), null start (N-1), no git repository (N-3): unchanged since round 5 and still green in this run.
- realpathSync(start) before relative(): this matters only when the path goes through a symlink, and Linux tests cannot reach it. It scores under 4 and is not listed, as in round 5.

### Well covered
- The setup root rule from design D-1 now has a test for each of its branches: no repository (N-3), no openspec folder (N-1), openspec at the top (N-2), openspec strictly inside the top (N-21), and openspec outside the top through a nested repository (N-20). Each test checks the start JSON the hook returns, and the tests that cover writing check that the file list stays unchanged.
- The evidence (attempt 5) runs N-21 again in gate 3.6 and gate 7.8 on 9f9aef1. It also explains why gates 2.9 and 6.10 did not need a new run (their patterns or file lists already cover the test, and their inputs did not change).
