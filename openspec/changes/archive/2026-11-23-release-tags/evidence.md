<!-- devkit-stage evidence result=passed attempt=2 commit=6e33ca70798db42ce91d0694024aa688d2adf10c -->
Commit: 6e33ca70798db42ce91d0694024aa688d2adf10c

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

### Live GitHub reads of the tag step (review round 1, test-coverage finding)

The test-coverage-reviewer found that the six GitHub reads of `releaseTagFacts` were proven only against hand-written `fakeGh` fixtures (`releaseFixtures` in `plugins/openspec/hooks/release-tags.test.mjs`). This section records the same reads against the real `chacal88/devkit`, at commit `6e33ca70798db42ce91d0694024aa688d2adf10c`, read-only (`gh api` GET only; nothing written, no ref created, no fetch). The throwaway scripts live in `/var/tmp/rt-review/` (`routes.sh`, `run.mjs`, `scan.mjs`, `sub.mjs`), outside the repository.

#### The routes, one by one

PR #73 is the merge `7640d9c1d412ef197bad82afb04395f761acb2bd` (devkit-openspec 0.27.0 to 0.28.0, tag `v0.28.0`); PR #72 is the merge `07fb73269b3ddfa5ed71a5697f2afe70625b52ce` (0.24.0 to 0.25.0, tag `v0.25.0`). `{r}` is `repos/chacal88/devkit`, `{f}` is `plugins/openspec/.claude-plugin/plugin.json`.

| Call | Route | Field the checker reads | Real value | Same shape as the fixture |
|---|---|---|---|---|
| 1 | `{r}/pulls/73` | `merged`, `base.ref`, `merge_commit_sha` | `true`, `main`, `7640d9c1d412ef197bad82afb04395f761acb2bd` (a 40-hex sha) | yes: `releaseFixtures` answers `{ number, merged, base: { ref }, merge_commit_sha }` |
| 1 | `{r}/pulls/72` | same | `true`, `main`, `07fb73269b3ddfa5ed71a5697f2afe70625b52ce` | yes |
| 2 | `{r}/contents/{f}?ref=7640d9c...` | `content` (string, base64) holding JSON with a top-level string `version` | keys `name path sha size url html_url git_url download_url type content encoding _links`; `type` `file`, `encoding` `base64`; decoded `version` `0.28.0` | yes: the fixture `contents()` carries `type`, `encoding` and `content`, a superset is read through only `content` |
| 2 | `{r}/contents/{f}?ref=07fb732...` | same | decoded `version` `0.25.0` | yes |
| 3 | `{r}/git/commits/7640d9c...` | `parents` (array), `parents[0].sha` | one parent, `ae1243c1be0ad37cfc6824d6cd37cb5637b3f3b1` (a squash merge); the answer also has `sha` and `message` | yes: the fixture answers `{ parents: [{ sha }] }` |
| 3 | `{r}/git/commits/07fb732...` | same | one parent, `90c9786a2056e217900086d04c56bb8892e2e2b4` | yes |
| 4 | `{r}/contents/{f}?ref=ae1243c...` (first parent of #73) | same as call 2 | decoded `version` `0.27.0`, different from `0.28.0`, so the release changed | yes |
| 4 | `{r}/contents/{f}?ref=90c9786...` (first parent of #72) | same | decoded `version` `0.24.0`, different from `0.25.0` | yes |
| 5 | `{r}/git/ref/tags/v0.28.0` | `ref`, `object.type`, `object.sha` | `refs/tags/v0.28.0`, `commit`, `7640d9c1d412ef197bad82afb04395f761acb2bd` (equal to the merge commit); a single object, not an array | yes: the fixture answers `{ ref, object: { type: 'commit', sha } }` |
| 5 | `{r}/git/ref/tags/v0.25.0` | same | `refs/tags/v0.25.0`, `commit`, `07fb73269b3ddfa5ed71a5697f2afe70625b52ce` (equal to the merge commit) | yes |
| 5 | `{r}/git/ref/tags/v0.99.0` (no such tag) | the exit status and `HTTP 404` on stderr | exit 1, stdout `{"message":"Not Found","documentation_url":"https://docs.github.com/rest/git/refs#get-a-reference","status":"404"}`, stderr `gh: Not Found (HTTP 404)`; the checker's test is `/HTTP 404\b/` on stderr, which matches | yes: the fixture `NOT_FOUND` is an HTTP 404 on stderr |
| 5 | `{r}/git/ref/tags/v0.2` (a prefix of real tags) | the same | exit 1, `gh: Not Found (HTTP 404)`, not an array: the ref endpoint does not prefix-match | yes: the checker's array branch is defensive, and the real answer never took it |
| 6 | `{r}/git/tags/<sha>` | `object.type`, `object.sha` | no tag in `chacal88/devkit` is annotated: `git/matching-refs/tags/` lists 33 refs, every `object.type` is `commit`. This route has no live read on this repository (see below) | not proven on this repository |

The tag list was `git/matching-refs/tags/` on `chacal88/devkit`: 33 tags, all `commit`, among them `v0.25.0`, `v0.26.0`, `v0.28.0` at the merge commits recorded above and `v0.28.1` (`d5d1cc2`) and `v0.28.2` (`1c8a445`).

Call 6 shape, from the one public read that has an annotated tag (a third party's public repository, read through the same GitHub API, `gh api` GET only): `git/ref/tags/v20.0.0` of `nodejs/node` answers `{ "ref": "refs/tags/v20.0.0", "object": { "sha": "ffca5a7a113131b1a252fd95b53161b5182e66be", "type": "tag", "url": ... } }`, and `git/tags/ffca5a7a...` answers keys `message node_id object sha tag tagger url verification` with `object` `{ "sha": "e7618fb5a5fc25d76b6474e2a6607f04fd6f10e0", "type": "commit", "url": ... }`. The fixture answers `{ ref, object: { type: 'tag', sha } }` and `{ object: { type: 'commit', sha } }`: the same fields, the same nesting. This is a shape check only; the checker was not run against that repository.

#### The checker's own `releaseTagFacts` against the real `gh`

`releaseTagFacts` is not exported, so the throwaway copy `/var/tmp/rt-review/hooks/` holds the non-test `.mjs` files of `plugins/openspec/hooks/` with one line appended to `deliver-check.mjs` (`export { releaseTagFacts };`); `diff` against the unmodified copy `deliver-check.orig` shows that line alone, and the unmodified copy has the same sha256 prefix (`0b9978b8342c8169`) as the file in the repository. It was called with `makeGh(<the worktree>)`, so `{owner}/{repo}` resolved from `origin` (`chacal88/devkit`), with the file `plugins/openspec/.claude-plugin/plugin.json` and base `main`:

```
PR #73: {"state":"done","tag":"v0.28.0","sha":"7640d9c1d412ef197bad82afb04395f761acb2bd","number":73,"merged":"change"}
  gh api calls: pulls/73 | contents/...plugin.json?ref=7640d9c1... | git/commits/7640d9c1... | contents/...plugin.json?ref=ae1243c1... | git/ref/tags/v0.28.0
PR #72: {"state":"done","tag":"v0.25.0","sha":"07fb73269b3ddfa5ed71a5697f2afe70625b52ce","number":72,"merged":"change"}
  gh api calls: pulls/72 | contents/...plugin.json?ref=07fb7326... | git/commits/07fb7326... | contents/...plugin.json?ref=90c9786a... | git/ref/tags/v0.25.0
PR #74: {"state":"none","why":"unchanged"}
PR #999999: {"state":"unreadable","number":999999,"reason":"cannot read the release of PR #999999 on GitHub: gh: Not Found (HTTP 404)"}
PR #73 asked for base develop: {"state":"none","why":"other-base"}
```

The same call over the twelve latest merged pull requests (#72 to #83): #72, #73, #79 (`v0.28.1`) and #81 (`v0.28.2`) are `done` (the tag is at the merge commit), and the other eight are `none`, `unchanged` (they did not move the version). No real pull request is `missing` or `elsewhere` today, because every release has its tag.

Two states that need a tag read the repository cannot give were driven through the real `gh` by redirecting only the tag route of the call for PR #73 (every other call went to GitHub unchanged; `sub.mjs`):

- the tag read redirected to `git/ref/tags/v0.99.0` (a real 404): `{"state":"missing","tag":"v0.28.0","sha":"7640d9c1d412ef197bad82afb04395f761acb2bd","number":73,"merged":"change","version":"0.28.0","file":"plugins/openspec/.claude-plugin/plugin.json","base":"main"}`. A real 404 from GitHub is the step to run, as the fixtures claim.
- the tag read redirected to `git/ref/tags/v0.27.0` (a real tag at another commit): `{"state":"unreadable",... "the answer for v0.28.0 names another ref"}`. That is the checker's own `entry?.ref !== wanted` guard answering a redirected answer, an artifact of the redirection and not a finding. `elsewhere` with a real tag at another commit has no live proof, since it would need a real tag that is wrong.

Real calls per state: `done` and `elsewhere` take 5 calls (6 with an annotated tag), `none unchanged` takes 4, as the fixtures assert (`releaseCalls(t).length` equal to 4 for an unchanged version).

#### Result for the finding

| Finding | Text | Proof | Result |
|---|---|---|---|
| R1-test-coverage | The six GitHub reads of the tag step are proven only against hand-written fixtures; no live read is recorded | The five routes in use on this repository (pulls, contents at the merge and at the first parent, git/commits, git/ref/tags with an existing and a missing tag) answered with the fields and nesting the fixtures use; `releaseTagFacts` run through the real `gh` answered `done` for PR #73 (`v0.28.0` at `7640d9c`, nothing to do) and PR #72 (`v0.25.0` at `07fb732`), `none unchanged` for PR #74, `unreadable` on a real 404 pull request, `none other-base` for another base, and `missing` when the tag read is a real 404. Real-GitHub answer and fixture shape agree on every route read; no mismatch, no defect. Not proven live: `git/tags/<sha>` on this repository (it has no annotated tag; the shape was read once on a public annotated tag of another repository) and the `elsewhere` state | pass |

#### Gates re-run at this commit

The gate rows above were recorded at `4ebd5c9`; since then the round-1 fix changed `plugins/openspec/hooks/release-tags.test.mjs` and `plugins/openspec/hooks/delivery-models.test.mjs` (`git diff --stat 4ebd5c9 HEAD`: no product-code file under `plugins/` other than those two tests). At `6e33ca70798db42ce91d0694024aa688d2adf10c`, with `TMPDIR=/var/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main` and a `timeout`:

- `node --test --test-name-pattern="^release-tags" plugins/openspec/hooks/release-tags.test.mjs`: exit 0, tests 45, pass 45, fail 0 (`/var/tmp/rt-v2-rt43.log`; the run at `4ebd5c9` had 43).
- `node --test --test-name-pattern="^release-tags" --test-name-pattern="^format: ship-change" plugins/openspec/hooks/release-tags.test.mjs` (the gate 3.4 selection): exit 0, tests 51, pass 51, fail 0 (`/var/tmp/rt-v2-g34b.log`; 49 at `4ebd5c9`).
- The gate 1.4 selection (`release-tags 1`, `change-loop settings`, `change-loop start`, `change-loop replies`, `delivery-models config`): exit 0, tests 88, pass 88, fail 0 (`/var/tmp/rt-v2-g14.log`; 62 at `4ebd5c9`).
- `python3 scripts/check.py`: exit 0, `all checks passed`. `python3 scripts/gen-catalog.py --check`: exit 0.
- No proof at this commit for the whole-file runs of `release-tags.test.mjs` with `delivery-models.test.mjs`, nor for the full `guard.test.mjs`: a first attempt to run the two files whole hit the 590 s timeout (exit 124, no test result, `/var/tmp/rt-v2-rt.log`) because other sessions were running their own suites on the same machine; it was not repeated. The recorded 2110-test full run is at `4ebd5c9`.

Outcome: verified, no defect.
