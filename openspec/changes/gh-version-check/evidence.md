<!-- devkit-stage evidence result=passed attempt=2 commit=7492d49d748b5d124b792a98a889e599df61702e -->
Commit: 7492d49d748b5d124b792a98a889e599df61702e

# Evidence

Change: `gh-version-check` · Verified on the branch before the PR exists (no PR comment).

## Verification

### Gates

Every gate ran at the commit above (attempt 2, re-run at HEAD after the test-only commit 7492d49; attempt 1 was at 4fadc2a) with `TMPDIR=/var/tmp`, as its own command; the exit code decided.

| Gate | Command | Result |
| --- | --- | --- |
| 1.2 | `grep -qx "minimum: v2.50.0" openspec/changes/gh-version-check/proof/gh-min-version.txt` | pass: exit 0 |
| 2.5 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/merge-setup.test.mjs plugins/openspec/hooks/deliver-check.test.mjs` | pass: 852 tests, 852 pass, 0 fail |
| 2.5 | `python3 scripts/check.py` | pass: all checks passed |
| 3.6 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/flow-check.test.mjs plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/project-loop.test.mjs plugins/openspec/hooks/roadmap-loop.test.mjs` | pass: 2393 tests, 2393 pass, 0 fail (second run; see note) |
| 3.6 | `python3 scripts/check.py` | pass: all checks passed |
| 4.4 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/skills/openspec-setup/scripts/gh-version.test.mjs` | pass: 417 tests, 417 pass, 0 fail |
| 4.4 | `python3 scripts/check.py` | pass: all checks passed |
| 5.3 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs` | pass: 1407 tests, 1407 pass, 0 fail |
| 5.3 | `python3 scripts/check.py` | pass: all checks passed |
| 5.3 | `python3 scripts/gen-catalog.py --check` | pass: exit 0 |
| 5.3 | `command claude plugin validate .` | pass: Validation passed |

Note on gate 3.6 (attempt 2): the first run printed 2393 tests, 2392 pass, 1 fail, the same `release-rebase pin` test below; the run with nothing changed passed. Attempt 1 note: the first run printed 2390 tests, 2389 pass, 1 fail. The failure was
`release-rebase pin: mergePins ... leaves no temporary folder` (`release-rebase.test.mjs:392`),
which found a foreign `devkit-pin-*` folder in the shared `/var/tmp`, left by another session's
concurrent run. This change does not touch `release-rebase*`, and the same test passed in the
whole guard run. The gate was run again once, with no other change, and passed as recorded above.

### Acceptance criteria

| AC | Criterion | Proof | Result |
| --- | --- | --- | --- |
| AC-1 | Old `gh` (`unknown flag: --json`, version 2.46.0): the `checks` item is blocked naming 2.46.0 and 2.50.0, details carry both | Tests `gh-version 5`, `6` and `20` (gate 2.5; `20` is the old `gh` on the open archive PR, named in the collected checks error, not reported as an unreadable GitHub). Local run of `checksItem` with a fake `gh` script (`--version` prints `gh version 2.46.0 (2024-03-18)`, `pr checks` fails with `unknown flag: --json`): status `blocked`, reason `cannot read the checks: gh pr checks --json needs gh 2.50.0 or newer and the installed gh is 2.46.0; update gh`, details `ghTooOld: {installed: 2.46.0, minimum: 2.50.0}` | pass |
| AC-2 | `change-loop.mjs next` ends blocked `gh-too-old`, reply in `en` and `pt-BR` names both versions and `/devkit change`, not "GitHub cannot be read" | Tests `gh-version 12`, `13`, `14` (gate 3.6) | pass |
| AC-3 | `project-loop.mjs next` ends blocked with the same reason naming both versions and `/devkit project` | Test `gh-version 15` (gate 3.6) | pass |
| AC-4 | `flow-check.mjs` shows the old-`gh` reason in both languages | Tests `gh-version 10`, `11` (gate 3.6); source has `gh-too-old` entries in `en` and `pt-BR` in `flow-check.mjs` | pass |
| AC-5 | Unknown or unparseable `gh --version` still gives the old-`gh` reason, version unknown | Tests `gh-version 7`, `11`, `12` (gates 2.5, 3.6) | pass |
| AC-6 | Other failures keep their text; a successful read never calls `gh --version` | Tests `gh-version 8`, `9`, `16` (gates 2.5, 3.6) | pass |
| AC-7 | Setup step 1 runs the version check: warns on 2.46.0, says not installed when `gh` is missing, `ok` with the version on 2.50.0 or newer, setup goes on | Tests `gh-version 17`, `18`, `19` (gate 4.4). Local runs of `plugins/openspec/skills/openspec-setup/scripts/gh-version.mjs`, each exit 0: with the fake `gh` (and with the system 2.46.0 at `/usr/bin/gh`) it printed `gh: warning: the installed gh is 2.46.0, older than 2.50.0; ... update gh`; with an empty `PATH` it printed `gh: warning: gh is not installed; the pr and merge ship modes need gh 2.50.0 or newer`; with the installed 2.105.0 it printed `gh: ok 2.105.0` | pass |

Product code is unchanged between 4fadc2a and 7492d49 (`git diff 4fadc2a..HEAD --stat` shows only the test file and the change folder); the local fake-`gh` runs in AC-1 and AC-7 were taken at 4fadc2a.

No screenshots: the change has no UI surface.
