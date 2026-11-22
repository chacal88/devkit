<!-- devkit-stage evidence result=passed attempt=3 commit=c292a5dadffebdd027b5ad8305f7bba97684a3e5 -->
Commit: c292a5dadffebdd027b5ad8305f7bba97684a3e5

# Evidence: merge-setup-field-fixes

Verified on branch `merge-setup-field-fixes` at the commit above (the merge of `main` into the branch for PR #46).
The working tree was clean outside `openspec/`. Every gate ran at this commit with
`GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main`, as a pull-request run on CI does. No UI, no
screenshots: the change touches scripts and hooks only.

## Verification

### Gates

| Gate | Command | Result |
|------|---------|--------|
| 1.4 deliver-check suite | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/deliver-check.test.mjs` | pass: exit 0, 376 tests, 376 pass, 0 fail, 0 skipped |
| 1.4 repo check | `python3 scripts/check.py` | pass: exit 0, "all checks passed" |
| 2.4 github-setup suite | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/skills/openspec-setup/scripts/github-setup.test.mjs` | pass: exit 0, 421 tests, 421 pass, 0 fail, 0 skipped |
| 2.4 repo check | `python3 scripts/check.py` | pass: exit 0, "all checks passed" |
| 3.4 verdict tests | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^field-fixes 10 " --test-name-pattern="^readValue" --test-name-pattern="^reviewConsensus" --test-name-pattern="^gh pr create" --test-name-pattern="^conduct" plugins/openspec/hooks/guard.test.mjs` | pass: exit 0, 103 tests, 103 pass, 0 fail, 0 skipped |
| 3.4 repo check | `python3 scripts/check.py` | pass: exit 0, "all checks passed" |
| 4.3 whole guard suite | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs` | pass: exit 0, 1130 tests, 1130 pass, 0 fail, 0 skipped, 1014 s |
| 4.3 repo check | `python3 scripts/check.py` | pass: exit 0, "all checks passed" (includes the Markdown language check) |
| 4.3 catalog | `python3 scripts/gen-catalog.py --check` | pass: exit 0, catalog up to date |
| 4.3 plugin validation | `command claude plugin validate .` | pass: exit 0, "Validation passed" |

The deliver-check and github-setup suites are also imported by the whole guard suite; the counts
above are what each run printed.

### Acceptance criteria

| Id | Criterion | Proof | Result |
|----|-----------|-------|--------|
| AC-1 | `deliver-check --watch` at `stop-merge-setup` waits for pending checks and then reports their final state | Real run on a scratch merge-mode repo with a faked `gh` (no rule requires `devkit-reviews`, `e2e` pending): `deliver-check feat --watch=1` exit 2, one `gh pr checks 12 --watch --interval 30 --required` call, item 6 `met  required checks green: 2 required checks green`, `8/8 met: blocked: merge setup`, `next: stop-merge-setup: ...`, `watch: ended`. With the watch sleeping 20 s and `--watch=0.02`: returned in 2322 ms, item 6 `open  required checks green: pending e2e`, `watch: stopped after 0.02 minutes`, step still `stop-merge-setup`. Without `--watch`: 0 watch calls. Tests: the five `field-fixes 9 watch` tests in `deliver-check.test.mjs` (gate 1.4), including the one added after review round 1, "no watch target in the archive phase or for a MERGED or CLOSED pull request". | pass |
| AC-2 | `github-setup.mjs --checks ""` prints the checks the ruleset will require, `devkit-reviews` included, never "none" | Real run on a scratch repo with a faked `gh`, no ruleset: line `the ruleset will require these checks (confirm them, or pass --checks): devkit-reviews (devkit-reviews always; no other check given with --checks)`; no `none`; `--json` gives `requires` `["devkit-reviews"]`, `checksFrom` `option`, `contexts` `[]`; no `-X` write call. Without `--checks` and with `test`, `lint` reported on a pull request head: `test, lint, devkit-reviews (devkit-reviews always; test, lint reported on the newest pull requests)`. Tests: the six `field-fixes 11 setup` tests (gate 2.4), including the one added after review round 1, "with the newest pull requests unreadable...". | pass |
| AC-3 | Two disagreeing `Verdict:` lines read as the first line's verdict by every reader | Seven `field-fixes 10 verdict` tests, both orders, covering `readValue`, `reviewConsensus`, the `gh pr create` hook, deliver-check item 2, the `devkit-reviews` check from both entries, and the conduct plan audit; green in gates 3.4 and 4.3 (7/7 on the proof run). | pass |
| AC-4 | Each of the three defects has a test that fails before its fix and passes after | Item 9: `proof/red-9.txt`, unchanged code, 2 of 4 `field-fixes 9` (the original four) tests fail (the watch and the cap tests), now pass in gate 1.4. Item 11: `proof/red-11.txt`, unchanged code, 5 of 5 `field-fixes 11` tests fail, now pass in gate 2.4. Item 10: `proof/base-10.txt`, unchanged code, 7 of 7 `field-fixes 10` tests pass, because no reader was wrong at the base; the owner accepted that run as the proof for item 10 (design D-4, `proof/README.txt`). The tests stay as regression pins and pass in gate 3.4. | pass |

### Notes

- The two real runs used scripts copied from this commit into a scratch directory outside the
  repository, with the test fixtures' faked `gh`; nothing touched GitHub, and no file in the tree
  changed.
- Item 10's tests cannot be red on the base; the table row says so and cites the owner's acceptance
  recorded in the plan, which this run did not decide.
- This refresh ran at the HEAD above. `git diff 49294bc..HEAD --stat` lists only files under
  `openspec/` (this evidence, `review.md`, `reviews/`, and `roadmap.md` from the merge of `main`), so
  no production file or test changed since the 49294bc run; every gate was re-run at HEAD and the
  counts are the same (376, 421, 103, 1130).
