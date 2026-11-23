<!-- devkit-stage evidence result=passed attempt=1 commit=4ebd5c9ccba31ec26200561d2aa0194e2f10084c -->
Commit: 4ebd5c9ccba31ec26200561d2aa0194e2f10084c

# Evidence

Verified at commit `4ebd5c9ccba31ec26200561d2aa0194e2f10084c` on branch `release-tags`, working tree clean before this file was written. Every hook command ran with `TMPDIR=/var/tmp`, `GITHUB_HEAD_REF=probe-branch` and `GITHUB_BASE_REF=main`, in the foreground or as a bounded background command, with a `timeout`; no process was left running. The tests fake `gh` (`fakeGh`) and read no git history. No defect was found.

### Gates

The full guard suite ran once before this verification, on this same commit, and its log is kept: `/var/tmp/release-tags-gate.log` ends with `tests 2110`, `pass 2110`, `fail 0`, `exit 0`. The same log's run covered `python3 scripts/check.py`, `python3 scripts/gen-catalog.py --check`, `claude plugin validate .` and `openspec validate release-tags --strict`. The verifier re-ran every other gate part below at this commit; their logs are `/var/tmp/rt-v-g14.log`, `/var/tmp/rt-v-g26a.log`, `/var/tmp/rt-v-g34a.log` and `/var/tmp/rt-v-g34b.log`.

| Gate | Command | Result |
|---|---|---|
| 1.4 | `env TMPDIR=/var/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^release-tags 1" --test-name-pattern="^change-loop settings" --test-name-pattern="^change-loop start" --test-name-pattern="^change-loop replies" --test-name-pattern="^delivery-models config" plugins/openspec/hooks/release-tags.test.mjs plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/delivery-models.test.mjs` | pass: exit 0, tests 62, pass 62, fail 0 (`/var/tmp/rt-v-g14.log`) |
| 1.4 | `python3 scripts/check.py` | pass: exit 0, `all checks passed` |
| 2.6 | `env TMPDIR=/var/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/release-tags.test.mjs plugins/openspec/hooks/conduct-check.test.mjs` | pass: exit 0, tests 1065, pass 1065, fail 0 (`/var/tmp/rt-v-g26a.log`) |
| 2.6 | `env TMPDIR=/var/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^change-loop decide" plugins/openspec/hooks/change-loop.test.mjs` | pass: exit 0, 37 tests of `change-loop.test.mjs` selected by the pattern and the `release-tags 1` pattern, 37 pass, 0 fail (`/var/tmp/rt-v-cl.log`); the pattern alone is a subset of the full change-loop run of gate 3.4 |
| 2.6 | `python3 scripts/check.py` | pass: exit 0, `all checks passed` |
| 3.4 | `env TMPDIR=/var/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/roadmap-loop.test.mjs` | pass: exit 0, tests 2300, pass 2300, fail 0 (`/var/tmp/rt-v-g34a.log`) |
| 3.4 | `env TMPDIR=/var/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^release-tags" --test-name-pattern="^format: ship-change" plugins/openspec/hooks/release-tags.test.mjs` | pass: exit 0, tests 49, pass 49, fail 0 (`/var/tmp/rt-v-g34b.log`) |
| 3.4 | `python3 scripts/check.py` | pass: exit 0, `all checks passed` |
| 3.4 | `python3 scripts/gen-catalog.py --check` | pass: exit 0, no diff |
| 4.6 | `env TMPDIR=/var/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs` | pass: exit 0, tests 2110, pass 2110, fail 0 (`/var/tmp/release-tags-gate.log`, run on this commit before this verification) |
| 4.6 | `python3 scripts/check.py` | pass: exit 0, `all checks passed` (also in the gate log) |
| 4.6 | `python3 scripts/gen-catalog.py --check` | pass: exit 0, no diff |
| 4.6 | `command claude plugin validate .` | pass: exit 0, `Validation passed` (re-run by the verifier) |
| 4.6 | `openspec validate release-tags --strict` | pass: exit 0, `Change 'release-tags' is valid` (re-run by the verifier) |

### Acceptance criteria

The `release-tags` suite run alone with `node --test --test-name-pattern="^release-tags" plugins/openspec/hooks/release-tags.test.mjs` printed `tests 43`, `pass 43`, `fail 0`, exit 0 (`/var/tmp/release-tags-verify-rt.log`). Every test named below is in that run and passed.

| Criterion | Text | Proof | Result |
|---|---|---|---|
| AC-1 | `tag-after-change-merge`: with `release_tag` set, after the change's PR merges with a bumped version and no tag on `origin`, `deliver-check` answers `tag-release` naming the tag and the merge sha before `retro`, and `change-loop.mjs next` turns it into a session action of the delivery stage | Ran `release-tags 2: the change's merge that bumped the release asks tag-release before the retro` (checker answer `tag-release` with tag and sha, ahead of the retro; the fake `gh` calls are asserted), `release-tags 2: a retro written but a tag still missing is still tag-release`, and `release-tags 3: tag-release after the change's merge is a session step of the delivery stage` (`decide` on `deliveryStep` of the real checker report gives a session action of stage `delivery`). All pass. `change-loop decide: the B rows are exactly the steps the checkers can return` also passes with `tag-release` in `ROWS`. | pass |
| AC-2 | `tag-after-archive-merge`: after the archive PR merges with a bump and the tag missing, the answer is `tag-release` for that merge commit instead of `archived` | Ran `release-tags 2: the archive merge that bumped the release asks tag-release instead of archived`, `release-tags 2: an archive with the change tag done and its own missing is tag-release for the archive`, `release-tags 2: both merges bumped asks the change first, then the archive` and `release-tags 3: on the archive branch tag-release comes before the archived end`. All pass. | pass |
| AC-3 | `no-tag-when-unchanged`: an unchanged version, a tag already at the merge commit, or a project without `release_tag` gives no `tag-release` step | Ran `release-tags 2: an unchanged version asks no tag`, `release-tags 2: a tag at the merge commit is the step done (lightweight and annotated)`, `release-tags 2: without release_tag the answer and the gh calls are today's` (also asserts the `gh` calls equal today's), plus the negatives `a release file gone at the merge asks nothing`, `a pull request to another base, or one not merged, asks nothing`, `an archive that did not move the version is archived` and `HTTP 404 on the tag read is the step to run, not a stop`. `release-tags 1: no release_tag keeps the three-key settings exactly` shows the settings are unchanged without the key. All pass. | pass |
| AC-4 | `tag-on-other-commit-stops`: a tag `v<version>` on `origin` at a different commit stops the run blocked, naming the tag, its commit and the merge commit | Ran `release-tags 2: a tag at another commit stops naming the tag and both commits` (checker stop with exit code 2 on the CLI, reason holds tag, its commit and the merge sha) and `release-tags 3: a tag at another commit ends the run blocked tag-elsewhere, naming both commits` (the loop's blocked reason in both languages). All pass. | pass |
| AC-5 | `tag-unreadable-stops`: when GitHub cannot answer a fact the tag step needs, the run stops as the existing unreadable stop, never a skip | Ran `release-tags 2: each fact GitHub does not answer stops tag-release, never a pass`, `a pull request answer without a merge commit is a stop`, `an answer that is not JSON, or has no parent list, or names another ref is a stop`, `a gh that times out on the tag read is a stop naming it`, `an archive PR list that cannot be read, on an archived change, is a stop`, `a release file a tag cannot carry is a stop, never a pass`, and `release-tags 3: a tag-release stop that GitHub could not answer stays archive-failed`. All pass. | pass |
| AC-6 | `ship-change-runs-the-step`: `ship-change/SKILL.md` has a `tag-release` row that creates the lightweight tag on the named sha, pushes it, then runs the loop again; CONTRIBUTING.md step 5 and `docs/openspec-flow.md` describe the key and the step | Ran `release-tags 3: ship-change has the tag-release row, its report line and its never line`, `release-tags 3: the devkit skill declares a stopped tag-release as an archive-failed end`, `release-tags 4: CONTRIBUTING and the flow page describe the key and the step` (step 5 names `release_tag`, `tag-release`, the ADR 0019 link, `git tag v<x> <merge sha>`, lightweight, merge commit; the flow page has the release-tag paragraph, rows R1 to R3 ahead of P0, the merge-mode row, the Troubleshooting row), `format: ship-change names every next.step the checker can return` (6 pass of 6 in its filtered run) and `AC-8 release-ready ...` (pass). Read `SKILL.md` line 76 at this commit: the `tag-release` row runs `git tag <next.tag> <next.sha>` (no `-a`, `-s`, `-f`), then `git push origin refs/tags/<next.tag>` alone. Line 152 holds the Never line: no tag except at `tag-release`, none moved, deleted or force-pushed. `CONTRIBUTING.md` line 60 and `docs/openspec-flow.md` lines 478 to 486, 565 and 727 hold the text. | pass |
| AC-7 | `devkit-sets-the-key`: this repository's `openspec/config.yaml` sets `release_tag: plugins/openspec/.claude-plugin/plugin.json` | Read `openspec/config.yaml` line 24: `  release_tag: plugins/openspec/.claude-plugin/plugin.json`, inside the `devkit:` block with its comment line. Ran `release-tags 4: this repository names devkit-openspec's plugin.json as its release file` (reads the working tree through `readDevkitSettings`, the ADRs line naming 0019, and the string `version` of `plugin.json`): pass. | pass |

### Fact outside the criteria: tags pushed by hand earlier today

Not an acceptance criterion. The owner approved pushing, by hand, the tags of releases that merged without one. `git ls-remote --tags origin` (a read, no fetch) lists them on `origin` at these commits:

```
8c8b7b89ca898242699b60e964e74a183e98258f	refs/tags/v0.21.0
c56155334749cdc46bad077ba8f53c4bbec5d140	refs/tags/v0.21.1
d1c7fa491c196941ae64e1c1ba6ea3dfccbc3110	refs/tags/v0.22.0
77b15b107e15b2071ba2de372fa75eb23daa390f	refs/tags/v0.22.1
07fb73269b3ddfa5ed71a5697f2afe70625b52ce	refs/tags/v0.25.0
cb9ba1b2ed00b89bffacacb4b659d33cd11743be	refs/tags/v0.26.0
7640d9c1d412ef197bad82afb04395f761acb2bd	refs/tags/v0.28.0
```

The short shas match the ones given: v0.21.0 `8c8b7b8`, v0.21.1 `c561553`, v0.22.0 `d1c7fa4`, v0.22.1 `77b15b1`, v0.25.0 `07fb732`, v0.26.0 `cb9ba1b`, v0.28.0 `7640d9c`.

Outcome: verified, no defect.
