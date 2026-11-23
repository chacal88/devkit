<!-- devkit-stage evidence result=passed attempt=5 commit=a1cd6d381f8c5edef9857af646acf54bdd897499 -->
Commit: a1cd6d381f8c5edef9857af646acf54bdd897499

# Evidence

Change: `gh-version-check` · Verified on the branch before the PR exists (no PR comment).

## Verification

### Gates

Every gate ran at the commit above (attempt 5, re-run at HEAD a1cd6d3; attempt 4 was at 748ebd2, attempt 3 at 492b586, attempt 2 at 7492d49, attempt 1 at 4fadc2a) with `TMPDIR=/var/tmp`, as its own command; the exit code decided. Since attempt 4, `origin/main` was merged once more: a1cd6d3 (cb9ba1b, #71, `/devkit change` reads a Jira task as the request). Conflicts were only `CHANGELOG.md` and `change-loop.test.mjs` (the `SAMPLE` fixture and the pin test). The merge moved this change's release again: devkit-openspec 0.27.0 / marketplace 0.31.0 (CI snippet pin `v0.27.0`). #71 did not touch `deliver-check.mjs`; it did change `change-loop.mjs`, and the AC-2 rows below were rechecked against it. No gate command in `tasks.md` names a version number, so each ran exactly as written; the pin tests that name 0.27.0 ran inside the guard suite (5.3) and passed. Test counts grew because main's suites are in the tree.

| Gate | Command | Result |
| --- | --- | --- |
| 1.2 | `grep -qx "minimum: v2.50.0" openspec/changes/gh-version-check/proof/gh-min-version.txt` | pass: exit 0 |
| 2.5 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/merge-setup.test.mjs plugins/openspec/hooks/deliver-check.test.mjs` | pass: 874 tests, 874 pass, 0 fail |
| 2.5 | `python3 scripts/check.py` | pass: all checks passed |
| 3.6 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/flow-check.test.mjs plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/project-loop.test.mjs plugins/openspec/hooks/roadmap-loop.test.mjs` | pass: 3059 tests, 3059 pass, 0 fail (first run, no flake) |
| 3.6 | `python3 scripts/check.py` | pass: all checks passed |
| 4.4 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/skills/openspec-setup/scripts/gh-version.test.mjs` | pass: 428 tests, 428 pass, 0 fail |
| 4.4 | `python3 scripts/check.py` | pass: all checks passed |
| 5.3 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs` | pass: 1827 tests, 1827 pass, 0 fail |
| 5.3 | `python3 scripts/check.py` | pass: all checks passed |
| 5.3 | `python3 scripts/gen-catalog.py --check` | pass: exit 0 |
| 5.3 | `command claude plugin validate .` | pass: Validation passed |

Attempt 5: every gate passed on its first run at a1cd6d3: gate 2.5 874/874, gate 3.6 3059/3059, gate 4.4 428/428, gate 5.3 guard suite 1827/1827; `python3 scripts/check.py`, `python3 scripts/gen-catalog.py --check` and `command claude plugin validate .` ran once at HEAD and exited 0, the result recorded on each row that names them; gate 1.2 exited 0. The `release-rebase pin` flake did not occur, so no gate was repeated. Attempt 4 passed every gate on its first run at 748ebd2 (874, 2989, 428 and 1774 tests). Attempt 3 also passed every gate on its first run (852, 2569, 417 and 1542 tests at 492b586). Earlier run notes follow.

Note on gate 3.6 (attempt 2): the first run printed 2393 tests, 2392 pass, 1 fail, the same `release-rebase pin` test below; the run with nothing changed passed. Attempt 1 note: the first run printed 2390 tests, 2389 pass, 1 fail. The failure was
`release-rebase pin: mergePins ... leaves no temporary folder` (`release-rebase.test.mjs:392`),
which found a foreign `devkit-pin-*` folder in the shared `/var/tmp`, left by another session's
concurrent run. This change does not touch `release-rebase*`, and the same test passed in the
whole guard run. The gate was run again once, with no other change, and passed as recorded above.

### Acceptance criteria

| AC | Criterion | Proof | Result |
| --- | --- | --- | --- |
| AC-1 | Old `gh` (`unknown flag: --json`, version 2.46.0): the `checks` item is blocked naming 2.46.0 and 2.50.0, details carry both | Tests `gh-version 5`, `6` and `20` (gate 2.5; `20` is the old `gh` on the open archive PR, named in the collected checks error, not reported as an unreadable GitHub). Local run of `checksItem` with a fake `gh` script (`--version` prints `gh version 2.46.0 (2024-03-18)`, `pr checks` fails with `unknown flag: --json`): status `blocked`, reason `cannot read the checks: gh pr checks --json needs gh 2.50.0 or newer and the installed gh is 2.46.0; update gh`, details `ghTooOld: {installed: 2.46.0, minimum: 2.50.0}` | pass |
| AC-2 | `change-loop.mjs next` ends blocked `gh-too-old`, reply in `en` and `pt-BR` names both versions and `/devkit change`, not "GitHub cannot be read" | Tests `gh-version 12`, `13`, `14` (gate 3.6). Rechecked at 748ebd2 against main's #70 and again at a1cd6d3 against #71 (`change-loop.mjs` changed in the merge): `BLOCKED_OF` still maps `gh-too-old`, `blockedEnd` still adds `installed`, `minimum` and `verb: 'change'`, and `githubSilent` still matches only `gh-error` and `checks-unreadable`; at 748ebd2 the same held against #70: `githubSilent` in `change-loop.mjs` matches only `gh-error` and `checks-unreadable` (a wait on GitHub), so `gh-too-old` still goes through `BLOCKED_OF` to `blocked('gh-too-old', ...)` in `blockedEnd`, with `installed`, `minimum` and `verb: 'change'`; tests 12, 13 and 14 passed in the 3.6 run at a1cd6d3 | pass |
| AC-3 | `project-loop.mjs next` ends blocked with the same reason naming both versions and `/devkit project` | Test `gh-version 15` (gate 3.6); at a1cd6d3 (and 748ebd2) `project-loop.mjs` still maps `gh-too-old` to a blocked end (`BLOCKED_OF`, `blocked('gh-too-old', ghParams(old), ...)`), and the test passed | pass |
| AC-4 | `flow-check.mjs` shows the old-`gh` reason in both languages | Tests `gh-version 10`, `11` (gate 3.6); source has `gh-too-old` entries in `en` and `pt-BR` in `flow-check.mjs` | pass |
| AC-5 | Unknown or unparseable `gh --version` still gives the old-`gh` reason, version unknown | Tests `gh-version 7`, `11`, `12` (gates 2.5, 3.6) | pass |
| AC-6 | Other failures keep their text; a successful read never calls `gh --version` | Tests `gh-version 8`, `9`, `16` (gates 2.5, 3.6) | pass |
| AC-7 | Setup step 1 runs the version check: warns on 2.46.0, says not installed when `gh` is missing, `ok` with the version on 2.50.0 or newer, setup goes on | Tests `gh-version 17`, `18`, `19` (gate 4.4). Local runs of `plugins/openspec/skills/openspec-setup/scripts/gh-version.mjs`, each exit 0: with the fake `gh` (and with the system 2.46.0 at `/usr/bin/gh`) it printed `gh: warning: the installed gh is 2.46.0, older than 2.50.0; ... update gh`; with an empty `PATH` it printed `gh: warning: gh is not installed; the pr and merge ship modes need gh 2.50.0 or newer`; with the installed 2.105.0 it printed `gh: ok 2.105.0` | pass |

Earlier note (attempt 2): product code was unchanged between 4fadc2a and 7492d49; the local fake-`gh` runs were then taken at 4fadc2a.

Attempt 3: main's code is now in the tree, so the local fake-`gh` runs were repeated at 492b586, with `PATH` put first on a fake `gh` script. AC-1: `checksItem({ pr: { number: 1 } }, makeGh(cwd))` (`--version` prints `gh version 2.46.0 (2024-03-18)`, `pr checks` exits 1 with `unknown flag: --json`) gave status `blocked`, reason `cannot read the checks: gh pr checks --json needs gh 2.50.0 or newer and the installed gh is 2.46.0; update gh`, `details.ghTooOld` `{installed: 2.46.0, minimum: 2.50.0}`. AC-7: `gh-version.mjs` with the fake `gh` printed the 2.46.0 warning (`... older than 2.50.0 ... update gh`); with `PATH` an empty folder it printed `gh: warning: gh is not installed; the pr and merge ship modes need gh 2.50.0 or newer`; with the real installed `gh` (2.105.0) it printed `gh: ok 2.105.0`; every run exited 0. `git status --short` was clean before this file was written.

Attempt 4: the local fake-`gh` runs were repeated at 748ebd2, with `PATH` put first on a fake `gh` script. AC-1: `checksItem({ pr: { number: 1 } }, makeGh(cwd, env))` (`--version` prints `gh version 2.46.0 (2024-03-18)`, `pr checks` exits 1 with `unknown flag: --json`) gave status `blocked`, reason `cannot read the checks: gh pr checks --json needs gh 2.50.0 or newer and the installed gh is 2.46.0; update gh`, `details.ghTooOld` `{installed: 2.46.0, minimum: 2.50.0}`. AC-7: `gh-version.mjs` with the fake `gh` printed the 2.46.0 warning (`... older than 2.50.0 ... update gh`); with `PATH` an empty folder it printed `gh: warning: gh is not installed; the pr and merge ship modes need gh 2.50.0 or newer`; with the real installed `gh` (2.105.0) it printed `gh: ok 2.105.0`; every run exited 0. `git status --short` was clean before this file was written; the evidence is not committed.

Attempt 5: the local fake-`gh` runs were repeated at a1cd6d3, with `PATH` put first on a fake `gh` script. AC-1: `checksItem({ pr: { number: 1 } }, makeGh(cwd, env))` (`--version` prints `gh version 2.46.0 (2024-03-18)`, `pr checks` exits 1 with `unknown flag: --json`) gave status `blocked`, reason `cannot read the checks: gh pr checks --json needs gh 2.50.0 or newer and the installed gh is 2.46.0; update gh`, `details.ghTooOld` `{installed: 2.46.0, minimum: 2.50.0}`. AC-7: `gh-version.mjs` with the fake `gh` printed the 2.46.0 warning (`... older than 2.50.0 ... update gh`); with `PATH` an empty folder (node by absolute path) it printed `gh: warning: gh is not installed; the pr and merge ship modes need gh 2.50.0 or newer`; with the real installed `gh` (2.105.0) it printed `gh: ok 2.105.0`; every run exited 0. AC-2 and AC-3 still end blocked (tests 12 to 15 passed in gate 3.6). `git status --short` was clean before this file was written; the evidence is not committed.

No screenshots: the change has no UI surface.
