Proof of coordinator-field-fixes (design D-10, AC-13)

Each defect is reproduced by `field-fixes` tests that failed on the unchanged code. The red file is
the run's output as printed (a failing line starts with the cross mark and the test name). Select a
defect's tests with: node --test --test-name-pattern="^field-fixes <n> " <test file>

Defect 1: an archived change listed as unfinished
  test: field-fixes 1 archived: an archive branch whose pull request merged does not list the change
  red:  proof/red-2.txt
Defect 2: a previous-script change read as current after one headed file
  test: field-fixes 2 previous-script: a headed readiness.md over a headerless plan is still the previous script
  red:  proof/red-2.txt
Defect 3: the devkit-reviews check failing other scripts and pull requests that touch several changes
  test: field-fixes 3 reviews-check: a change on another schema passes with a note from both entries, whatever it lacks
  red:  proof/red-4.txt
Defect 4: a change read as delivered from any merged pull request that names it
  test: field-fixes 4 delivered: a pull request that only links the evidence does not switch to the walk after the merge
  red:  proof/red-3.txt
Defect 5: github-setup silent on what the repository refuses
  test: field-fixes 5 actions: Actions disabled for the repository is blocked, names where to enable it and exits 1
  red:  proof/red-5a.txt
Defect 6: the OpenSpec CLI taken from PATH instead of the project's
  test: field-fixes 6 flow-check: a pinned 1.16.0 and a 2.x on PATH exits 3 naming the version, the path and the move, and the PATH one never runs
  red:  proof/red-1.txt
Defect 7: a schema upgrade over changes under way
  test: field-fixes 7 listing: every change under way with its script, checkout and what the upgrade changes for it; nothing is written
  red:  proof/red-5b.txt
Defect 8: the CompozyOS kit's re-run overwriting local edits
  test: field-fixes 8 kit: a re-run with a changed template updates an unedited file with the recorded inputs
  red:  proof/red-6.txt

AC-1 on this repository: proof/start-this-repo.txt holds the run of
  node plugins/openspec/hooks/change-loop.mjs start --lang en < /dev/null
after phase 2.

The test `field-fixes 12 roadmap` (the roadmap line, AC-12) has no red file: it reads the roadmap text already in the
working tree and passes at once, as task 7.1 states.
