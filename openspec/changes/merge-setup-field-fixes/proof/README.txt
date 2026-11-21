Proof of merge-setup-field-fixes (design D-4). Run from the worktree root, with
GITHUB_HEAD_REF and GITHUB_BASE_REF set as on a pull-request run.

Field item 9 (the watch at stop-merge-setup), proof file: proof/red-9.txt (red on the unchanged code)
  Tests in plugins/openspec/hooks/deliver-check.test.mjs:
  - field-fixes 9 watch: at stop-merge-setup with a check pending, one gh pr checks --watch runs and the report shows the final checks (AC-1)
  - field-fixes 9 watch: the cap stops the watch, item 6 still names the pending check and the step is stop-merge-setup (AC-1)
  - field-fixes 9 watch: no pending check, or no pull request, starts no watch (AC-1)
  - field-fixes 9 watch: without --watch no watch starts at stop-merge-setup (AC-1)
  - field-fixes 9 watch: no watch target in the archive phase or for a MERGED or CLOSED pull request, even with a check pending (AC-1)
  Command: node --test --test-name-pattern="^field-fixes 9 " plugins/openspec/hooks/deliver-check.test.mjs

Field item 10 (the first Verdict line), proof file: proof/base-10.txt (green on the unchanged code:
no reader was wrong at 6e803eb; the tests pin the rule against regressions)
  Tests in plugins/openspec/hooks/deliver-check.test.mjs:
  - field-fixes 10 verdict: item 2 counts the first Verdict line, approved then rejected, and prints nothing about the second (AC-3)
  - field-fixes 10 verdict: item 2 counts the first Verdict line, rejected then approved, and reports the reviewer as rejected (AC-3)
  - field-fixes 10 verdict: the devkit-reviews check from both entries passes on approved then rejected and fails on the reverse naming the reviewer (AC-3)
  Tests in plugins/openspec/hooks/guard.test.mjs:
  - field-fixes 10 verdict: readValue returns the first Verdict line whichever order the two come in (AC-3)
  - field-fixes 10 verdict: reviewConsensus passes on approved then rejected and fails on the reverse, naming the reviewer (AC-3)
  - field-fixes 10 verdict: gh pr create is not refused for a reviewer whose first Verdict line approves, and is refused naming one whose first rejects (AC-3)
  Test in plugins/openspec/hooks/conduct-check.test.mjs:
  - field-fixes 10 verdict: an audit with ACCURATE first and OUTDATED later is not revise-plan, and the reverse is (AC-3)
  Command: node --test --test-name-pattern="^field-fixes 10 " <each of the three test files>

Field item 11 (the setup line), proof file: proof/red-11.txt (red on the unchanged code)
  Tests in plugins/openspec/skills/openspec-setup/scripts/github-setup.test.mjs:
  - field-fixes 11 setup: --checks "" with no ruleset lists devkit-reviews, says it is always required and holds no none
  - field-fixes 11 setup: checks found on the newest pull requests are listed with devkit-reviews and labelled
  - field-fixes 11 setup: no check reported lists devkit-reviews and says to pass --checks
  - field-fixes 11 setup: a check the stored ruleset requires is kept, listed and labelled
  - field-fixes 11 setup: with the rulesets refused the line still lists devkit-reviews, and requires equals the printed list
  - field-fixes 11 setup: with the newest pull requests unreadable the line says so, and checksFrom is unreadable
  Command: node --test --test-name-pattern="^field-fixes 11 " plugins/openspec/skills/openspec-setup/scripts/github-setup.test.mjs
