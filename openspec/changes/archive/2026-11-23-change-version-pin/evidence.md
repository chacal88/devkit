<!-- devkit-stage evidence result=passed attempt=5 commit=4b75272b8a997d3eef96223a35cc3fd5ab2eac19 -->
Commit: 4b75272b8a997d3eef96223a35cc3fd5ab2eac19

# Evidence

Change: `change-version-pin` · Verified at HEAD `4b75272` (pushed to pull request 84); `git status --short` printed nothing before this
file was written, so the verified code is exactly HEAD. This replaces the evidence written at `0835475` (attempt 4, verified at
`da6cbd5`), which the merges since then made stale. The release of this tree is devkit-openspec 0.31.0
(`plugins/openspec/.claude-plugin/plugin.json`) and marketplace 0.35.0 (`.claude-plugin/marketplace.json`, `metadata.version`); origin/main
(`1cad7e2`, as the local ref holds it; nothing was fetched) holds 0.30.1 and 0.34.1. The `openspec` CLI on PATH is 2.0.0.

What moved since the evidence of `0835475`, counted at this commit with `git diff 0835475 HEAD --stat -- . ':!openspec'`: 20 files, 972
insertions, 51 deletions. In plain words:

- PR 86 (the delivery loop tags the release it merged, devkit-openspec 0.30.0), merged in the fourth merge: the new `tag-release`
  archive step and the `release_tag` setting. `deliver-check.mjs` (140 lines changed), `guard.mjs` (25: `releaseTagSetting`, the
  `release_tag` key of the devkit block, the two `tag-elsewhere` / `release file` texts), `conduct-check.mjs` (2: `tag-release` in the
  main-session list), `change-loop.mjs` (the `tag-elsewhere` stop of the archive), the new `release-tags.test.mjs` (601 lines), a new
  ADR file under `docs/adr/` (93 lines), `ship-change/SKILL.md`, `CONTRIBUTING.md`, and a few lines in `guard.test.mjs`,
  `delivery-models.test.mjs`, `roadmap-loop.test.mjs`.
- PR 87 (archive of release-tags with its retro, devkit-openspec 0.30.1), merged in the fifth merge: its retro edits to
  `change-loop.mjs` (a plain bulleted `- Status:` line now gets a bulleted `- Accepted by:` line, the `BULLETED_STATUS` pattern) and
  their test lines in `change-loop.test.mjs`. They auto-merged.
- This change's resolution: in the fourth merge the `guard.mjs` import of `deliver-check.mjs` takes main's `releaseTagSetting` and this
  change's `changeDeclares` (the two readiness reads stay routed through it), and the `change-loop.mjs` import takes `releaseTagSetting`
  with this change's `changeFlow`, `readFlow`, `readPin`; the SAMPLE of reply tokens keeps `version: 1`, `tag`, `at`, `sha`. In the
  fifth merge only release files conflicted (`marketplace.json`, `plugin.json`, `CHANGELOG.md`, `docs/openspec-flow.md`), resolved by
  keeping both entries. All of that is recorded in `proof/merge-notes.txt` ('Fourth merge', 'Fifth merge').
- Release renumbering: this change's release moved from 0.30.0 / 0.34.0 to 0.31.0 / 0.35.0 (`plugin.json`, `marketplace.json`, the
  CHANGELOG heading `## 0.35.0 — change-version-pin` above main's `## 0.34.1`, the CI-pin tags in `docs/openspec-flow.md`,
  `openspec-setup/SKILL.md`, `devkit/SKILL.md`).
- Not moved: `git diff 0835475 HEAD --stat` of `flow-check.mjs`, `roadmap-loop.mjs`, `project-loop.mjs`, `version-pin.test.mjs`,
  `scripts/` and the three `schemas/*/flow.json` files is empty; the four hook files above are the only product `.mjs` files that
  changed (4 files, 173 insertions, 16 deletions).

## Verification

### Gates

| Gate | Command | Result |
|---|---|---|
| 1.7, 2.7, 3.5 | `env GITHUB_HEAD_REF=change-version-pin GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs` | pass: carried from `5f8aa35`, NOT re-run locally at this commit (about 28 minutes). At `5f8aa35` the whole suite ran locally: exit 0, 2131 of 2131, `TMPDIR` set to the real path of `os.tmpdir()` on this Mac. CI runs it on the pushed head `4b75272`, together with its step 'Hook tests left nothing in TMPDIR', and is the final judge. The carried rows below and the AC-group runs of this verification are the local proof at or near this tree |
| 1.7, 2.7, 3.5 | `python3 scripts/check.py` | pass: exit 0, `all checks passed` (run by the verifier at `4b75272`) |
| 3.5 | `python3 scripts/gen-catalog.py --check` | pass: exit 0, no output (run by the verifier at `4b75272`) |
| 3.5 | `command claude plugin validate .` | pass: exit 0, `Validation passed with warnings`, one warning: `plugins[5] plugin.json -> types: Unknown field 'types'. Claude Code ignores it at load time.` (`plugins/panel`, untouched by this change; run with the binary `/Users/kauesantos/.nvm/versions/node/v22.22.0/bin/claude` first on PATH) |
| 3.5 | `openspec validate change-version-pin --strict` | pass: exit 0, `Change 'change-version-pin' is valid` (run by the verifier at `4b75272`) |

Version-pin tests by group, run by the verifier at `4b75272` with a fresh empty `TMPDIR`: `T` was made with
`fs.realpathSync(fs.mkdtempSync(os.tmpdir() + '/devkit-ci-'))` (`/private/var/folders/.../T/devkit-ci-j9eY3w`), `ls -A $T` printed
nothing before; `env TMPDIR=$T GITHUB_HEAD_REF=change-version-pin GITHUB_BASE_REF=main node --test --test-name-pattern="^version-pin AC-(2|3|4|5)" plugins/openspec/hooks/version-pin.test.mjs`:
exit 0, 37 tests, 37 pass, 0 fail, 0 cancelled, 0 skipped (90 seconds; the file holds AC-2 10, AC-3 9, AC-4 14, AC-5 4 = 37, counted
with `grep -c`); afterwards `ls -A $T` printed nothing (0 entries), so the CI step 'Hook tests left nothing in TMPDIR' would pass for
these groups.

Carried results (run by the implementers, not re-run by the verifier; each labelled with its commit, every one with a fresh empty
`TMPDIR` and `ls -A` empty afterwards, `GITHUB_HEAD_REF=change-version-pin GITHUB_BASE_REF=main`):

| Run | Commit | Result |
|---|---|---|
| `version-pin.test.mjs`, whole file | `12ba3e4` (fourth merge) | carried: exit 0, 645 of 645 |
| `change-loop.test.mjs`, whole file | `12ba3e4` | carried: exit 0, 1054 of 1054 |
| `deliver-check.test.mjs`, whole file | `12ba3e4` | carried: exit 0, 443 of 443 |
| `release-tags.test.mjs`, whole file | `12ba3e4` | carried: exit 0, 828 of 828 |
| `conduct-check.test.mjs`, whole file | `12ba3e4` | carried: exit 0, 579 of 579 |
| `flow-check.test.mjs`, whole file | `12ba3e4` | carried: exit 0, 703 of 703 |
| `change-loop.test.mjs`, pattern `docs\|release\|the pin in docs\|CI snippet\|pin` | `4b75272` (fifth merge) | carried: 81 pass |
| `version-pin.test.mjs`, pattern `^version-pin AC-(1\|6\|7)` | `4b75272` | carried: 29 pass (AC-1 8, AC-6 8, AC-7 13 = 29, counted with `grep -c`) |
| `check.py`, `gen-catalog.py --check`, `plugin validate`, `openspec validate --strict` | `4b75272` | carried: all exit 0 (re-run by the verifier above) |

The fifth merge changed no product file beyond release files and the auto-merged retro lines of PR 87, so the whole-file runs at
`12ba3e4` are the nearest whole-file proof; they are carried, and CI on `4b75272` re-runs everything.

Counted at this commit: `tasks.md` has 19 ticked tasks and 0 unticked; `version-pin.test.mjs` holds 66 tests named `version-pin AC-<n> ...`
(8 + 10 + 9 + 14 + 4 + 8 + 13).

### Acceptance criteria

Method: the verifier built three scratch projects outside the worktree in the session scratchpad
(`/private/tmp/claude-501/-Users-kauesantos-Documents-devkit--claude-worktrees-change-version-pin/195fe088-c80f-48ea-9073-374c13bfa0f1/scratchpad/v5/`),
each a real git repository with a bare origin, `openspec/config.yaml` holding `schema: devkit`, the schemas installed by this tree's
`install-schemas.sh` (flow version 1), driven with this tree's `change-loop.mjs`, `flow-check.mjs`, `guard.mjs`, `deliver-check.mjs`,
`install-schemas.sh` and `scripts/check.py`; `DEVKIT_*` and `GITHUB_*` variables were unset (`DEVKIT_CHANGE` is set on the command where
the row names it). `p` (AC-1), `p3` (changes `old` and `pinned` pinned at flow 1, `legacy` unpinned; later upgraded to flow 2) and `p4`
(the same three changes, never upgraded) were made fresh by the scratch scripts `mk.sh`, `chg.sh` and `plan.mjs` in that folder.
The flow version 2 used for the upgrade (a scratch copy of the shape the earlier rounds used) adds a `threat-model` stage after the
design, removes the `readiness` stage and lowers the `review` ceiling from 2 to 1; it was committed to the scratch origin/main as a
re-install leaves it and merged into each existing change's branch. Checked by a script: `flow.json` version 2 with review ceiling 1,
`flows/1.json` version 1 byte-identical to this tree's (`cmp`) with ceiling 2, `flows/2.json` version 2; stages of version 2: `open,
requirements, mockup, decisions, proposal, specs, design, threat-model, tasks, approval, implementation, unit-tests, e2e-tests,
evidence, review, delivery, retro` (no `readiness`). For the AC-4 comparison, `plugins/openspec` from `origin/main` (devkit-openspec
0.30.1, `git archive origin/main plugins/openspec`) ran the same commands on the same worktrees; its three `flow.json` files are
byte-identical to this tree's (`cmp`).

| Id | Criterion | Proof | Result |
|---|---|---|---|
| AC-1 | A change opened with `/devkit change` (also `/devkit roadmap` and `/devkit project`) has the devkit version and the flow version in its `.openspec.yaml`, and `openspec status --change <id>` prints no unrecognized-key warning | In `p`, `printf 'Add a CSV export\n' \| change-loop.mjs open csv-export --script devkit --why doubt --lang en`: exit 0, JSON with `"change": "csv-export"`, `"script": "devkit"`, `"base": "origin/main"` and the reply `I opened the change csv-export on the full script, because it is not clearly small ...`. Its `.openspec.yaml` read `schema: devkit`, `created: 2026-11-23`, `x-devkit-version: 0.31.0`, `x-devkit-flow: 1`; 0.31.0 equals this tree's `plugin.json` version and 1 the installed `flow.json` version. In that change's worktree `openspec status --change csv-export` exited 0 and printed `Change: csv-export`, `Schema: devkit`, `Progress: 1/14 artifacts complete`; lines containing `unrecognized` (case-insensitive) 0, containing `warning` 0. The short script: `open lite2 --script devkit-lite --why small` exit 0, `"script": "devkit-lite"`, its `.openspec.yaml` read `schema: devkit-lite`, `x-devkit-version: 0.31.0`, `x-devkit-flow: 1`, and `openspec status --change lite2` exited 0, printed `Schema: devkit-lite`, `Progress: 1/9 artifacts complete`, 0 lines with `unrecognized` or `warning` (an earlier `lite` run in the same project gave the same two lines; its repeat printed `name-taken`, my command error, not a defect). The roadmap and project opens (`/devkit roadmap` through the same `open`, `/devkit project` through `project-loop.mjs open`) were not run by hand; the 8 `version-pin AC-1` tests cover a devkit and a devkit-lite change, a project slice recording the `devkit-project` flow and the `openspec status` no-warning assertion (carried, 29 of 29 for AC-1/6/7 at `4b75272`) | pass |
| AC-2 | After a re-installed flow version 2 (a stage added, one removed, a ceiling changed), the readout, the loop's next step, the guard hook and `devkit-reviews` judge a version-1 change by version 1 | `p3`, change `old` pinned `x-devkit-flow: 1`, after the upgrade was pushed and merged into its branch. `flow-check.mjs old --lang en` exit 0, line 2 `Flow: this change follows version 1 of the devkit script; version 2 is installed. To move it: change-loop.mjs flow old.`, ` 9  Plan readiness  pending: readiness.md does not exist yet` (the removed stage is still asked), `Threat model` rows 0 (the added stage is not asked), `Next stage: 9 Plan readiness`, `Who runs it: plan-readiness-reviewer`. `change-loop.mjs next --change old --lang en` exit 0: `"kind": "agent"`, `"stage": "readiness"`, `"role": "plan-readiness-reviewer"`. The old ceiling holds: with `readiness.md`, `approval.md`, `evidence.md` and a `review.md` headed `result=failed attempt=1` written into the worktree the readout printed `15  Code review  failed at attempt 1 of 2` and `Next stage: 11 Implementation`; with the header changed to `attempt=2`, `failed at attempt 2 of 2` (version 2's ceiling reads `of 1`, AC-3); the four files were removed (`git status --short` 0 lines). The hook and `devkit-reviews`, with `DEVKIT_CHANGE=<id>` and the change's worktree as folder, on `old` and on the unpinned `legacy` (read as version 1) in the same upgraded project: `guard.mjs edit` with a hook-shaped Write of `src/a.js` on stdin exited 2 for both, `devkit guard: change "old" has no approved readiness (Status: missing). Product code stays closed until the plan-readiness-reviewer agent writes "- Status: APPROVED" in openspec/changes/old/readiness.md ...` (the same with `legacy`); `deliver-check.mjs --ci` exited 1 for both, printing `devkit-reviews: old (schema devkit, head 42c3e11)`, `readiness open     Status: missing` and ending `fail: readiness, item 1, item 2, item 4`. The 10 `version-pin AC-2` tests (readout including the version-1 ceiling, loop, guard hook, ci, locks, where, roadmap, conductor) ran at `4b75272` in the group run above: 10 of the 37 pass | pass |
| AC-3 | In the same project, a change opened after the upgrade is judged by flow version 2 | In `p3` after the upgrade, `printf 'Add a CSV export\n' \| change-loop.mjs open fresh --script devkit --why doubt --lang en` exit 0; its `.openspec.yaml` ended `x-devkit-version: 0.31.0`, `x-devkit-flow: 2`. With the plan files written into it (pin lines kept), `flow-check.mjs fresh --lang en` exit 0 with 0 `Flow:` lines, ` 8  Threat model  pending: threat-model.md does not exist yet`, `Next stage: 8 Threat model`, `Who runs it: change-planner`; `change-loop.mjs next --change fresh --lang en` printed `"kind": "agent"`, `"stage": "threat-model"`, `"role": "change-planner"`. With `threat-model.md`, `approval.md`, `evidence.md` and a `review.md` headed `failed attempt=1` written, the readout printed `15  Code review  failed at attempt 1 of 1` and ended `End: blocked. The code review failed at attempt 1 and its ceiling is 1.` (version 2's ceiling blocks where version 1 allowed another attempt), and `guard.mjs edit` on a Write of `src/a.js` with `DEVKIT_CHANGE=fresh` exited 0 (no readiness is asked in version 2; `old` and `legacy` exit 2 in AC-2); the four files were removed again. The 9 `version-pin AC-3` tests (readout, version-2 ceiling, guard, ci, locks, conductor, deliver, open) ran in the group run above: 9 of the 37 pass | pass |
| AC-4 | A change with no pin is read as flow version 1; with every installed flow at version 1 no behaviour changes in the readout, the loop, the hook or the check | `p4` (installed flow 1, never upgraded) and `p3` before its upgrade, each with the unpinned `legacy`, `pinned` and `old` (both pinned 1). For each of the 6 project-change pairs, four commands ran by this tree and by `plugins/openspec` from origin/main on the same worktree, output captured and compared with `diff`: `flow-check.mjs <id> --lang en` exit 0 on both sides, 23 lines each, 0 diff lines; `change-loop.mjs next --change <id> --lang en` exit 0 on both, 31 lines, 0 diff lines; `guard.mjs edit` (Write of `src/a.js`, `DEVKIT_CHANGE=<id>`) exit 2 on both, 1 line (`devkit guard: change "<id>" has no approved readiness (Status: missing). ...`), 0 diff lines; `deliver-check.mjs --ci` exit 1 on both, 7 lines ending `fail: readiness, item 1, item 2, item 4`, 0 diff lines. That is 24 comparisons, all with exit codes equal and a zero diff. The readout of `old` in `p4` has 0 `Flow:` lines and the unpinned `legacy`'s `.openspec.yaml` 0 `x-devkit` lines. After the upgrade, the unpinned `legacy` was still read as version 1: `guard.mjs edit` exit 2 and `--ci` exit 1 with the readiness messages above (AC-2). The 14 `version-pin AC-4` tests (readout, change, roadmap and project loops, guard, ci, conductor, the pin reader) ran in the group run above: 14 of the 37 pass | pass |
| AC-5 | When the installed flow is newer than the change's, the readout and the resume reply carry one line naming both versions and how to move, in `pt-BR` and `en`; when equal, neither carries it | Readout, newer (`old` in `p3`, pin 1, installed 2), line 2, `--lang en`: `Flow: this change follows version 1 of the devkit script; version 2 is installed. To move it: change-loop.mjs flow old.`; `--lang pt-BR`: `Fluxo: esta change segue a versão 1 do roteiro devkit; a versão 2 está instalada. Para mudá-la: change-loop.mjs flow old.` Readout, equal (`pinned` in `p4`, pin 1 installed 1; `fresh` in `p3`, pin 2 installed 2), `en` and `pt-BR`: lines starting `Flow:` or `Fluxo:` were 0 in all four runs. Resume reply, newer: `printf 'change old' \| change-loop.mjs start --lang en` printed `"mode": "resume"` and `Continuing the change old: next is the plan readiness.` followed by a second line `It follows version 1 of its script's flow; version 2 is installed, and it moves to it only if you ask me.`; `--lang pt-BR`: `Continuando a change old: a próxima é a etapa Revisão do plano.` and `Ela segue a versão 1 do fluxo do roteiro; a versão 2 está instalada, e só muda para ela se você me pedir.` Resume reply, equal (`change pinned` in `p4`, `change fresh` in `p3`), both languages, only the first sentence: `Continuing the change pinned: next is the plan readiness.` / `Continuando a change pinned: a próxima é a etapa Revisão do plano.` and `Continuing the change fresh: next is the threat model.` / `Continuando a change fresh: a próxima é a etapa Modelo de ameaças.` The 4 `version-pin AC-5` tests ran in the group run above: 4 of the 37 pass | pass |
| AC-6 | The explicit command moves the change to the installed flow and records the new versions, after which the readout shows the new flow's stages; `next`, `wait`, a setup re-run and a pack update leave the pin as it was | In the upgraded `p3`, the `shasum` of `old`'s (pin 1) and `legacy`'s (no pin) `.openspec.yaml` was taken (`c9b7ed5d329e`, `5f2a2cfe1375`), then `change-loop.mjs next` for both (exit 0 each), `open other --script devkit --why doubt` (exit 0) and `change-loop.mjs wait --change old --lang en --interval 5` under a 12-second alarm (exit 0, 31 lines, `"stage": "readiness"`) ran: both checksums identical afterwards, `old` still `x-devkit-version: 0.29.0`, `x-devkit-flow: 1`, `legacy` still 0 `x-devkit` lines. A setup re-run (`install-schemas.sh <folder>`, exit 0, `Schema 'devkit' is valid`, `devkit-lite`, `devkit-project` likewise) on a copy of the project's `openspec/` folder holding both `.openspec.yaml` files left the three change files' checksums identical (the re-run installs what this pack ships, so the copy's installed flow went from 2 to 1). Then `change-loop.mjs flow old --lang en` exit 0, `"flow": 2`, reply `The change old now follows version 2 of its script's flow; it followed version 1.`; its `.openspec.yaml` ended `x-devkit-version: 0.31.0`, `x-devkit-flow: 2`; the readout then had 0 `Flow:` lines, ` 8  Threat model  pending` and `Next stage: 8 Threat model`. A second `flow old` exit 0, `"flow": 2`, no reply (nothing to move). `flow legacy --lang pt-BR` moved the unpinned change: `"flow": 2`, reply `A change legacy agora segue a versão 2 do fluxo do roteiro; antes seguia a versão 1.`, and its `.openspec.yaml` gained `x-devkit-version: 0.31.0`, `x-devkit-flow: 2`. The pack update (a newer pack's setup script, loop and readout) was not run by hand; the 8 `version-pin AC-6` tests cover it (carried, 29 of 29 at `4b75272` with AC-1 and AC-7). The `docs/openspec-flow.md` text for the command is read by the docs tests (`change-loop.test.mjs` targeted run, 81 pass at `4b75272`, carried) and by `python3 scripts/check.py` (exit 0, gate row) | pass |
| AC-7 | The repository's checks fail when a `flow.json` differs from the released content of its declared version, and pass when the version is raised | On five scratch copies of this commit (`git archive HEAD` into the scratchpad), each with its own `scripts/check.py` (`python3 -I scripts/check.py` from the copy): (1) untouched, exit 0, `all checks passed`; (2) the `devkit` `flow.json` edited (review ceiling 2 to 3) with `version` kept at 1, exit 1: `plugins/openspec/schemas/devkit/flow.json: differs from flows/1.json, the released content of version 1; a flow change raises its version`; (3) `flow.json` and `flows/1.json` both edited the same way, version kept, exit 1: `plugins/openspec/schemas/devkit/flows/1.json: does not match the digest of released version 1 in scripts/released-flows.json`; (4) `version` raised to 2, `flows/1.json` kept (`cmp` equal to the tree's), `flows/2.json` equal to `flow.json` (`cmp`), the sha256 of `flows/2.json` added to the digest list (`{"1": "sha256:1d85f4...", "2": "sha256:c3b6d6..."}`, edited by a scratch script that refuses any folder outside the scratchpad), exit 0, `all checks passed`; (5) the copy of (4) with the digest of version 1 replaced by zeros, exit 1 with the digest message of (3). The 13 `version-pin AC-7` tests are in the carried AC-1/6/7 run (29 of 29 at `4b75272`), and `python3 scripts/check.py` on the real tree passes (gate row) | pass |

## Defects

None found. One tool note, not a defect of the change: `git add -A` in a scratch project was refused by the devkit guard hook ("stage
files by name"); the step was redone staging the two files by name. A repeat of `open lite` printed `name-taken` because the earlier
run had already opened it; the proof uses `lite2`.

## Not proven

The human weighs these; none is a defect.

- The whole `guard.test.mjs` suite was not re-run locally at this commit: its result (2131 of 2131) is carried from `5f8aa35`; CI runs the full suite on the pushed head `4b75272` (with the 'Hook tests left nothing in TMPDIR' step) and is the final judge. The whole-file runs of `version-pin`, `change-loop`, `deliver-check`, `release-tags`, `conduct-check` and `flow-check` are carried from `12ba3e4`; the verifier re-ran the AC-2/3/4/5 groups of `version-pin.test.mjs` at `4b75272`, and the implementer ran the AC-1/6/7 groups and the docs tests of `change-loop.test.mjs` there.
- The `/devkit roadmap` and `/devkit project` opens and the pack update (a newer pack's setup script, loop and readout) were not run by hand; they rest on the `version-pin AC-1` and `AC-6` tests.
- The guard hook and the `devkit-reviews` check were run by hand as scripts (`guard.mjs edit` with a hook-shaped input on stdin, `deliver-check.mjs --ci` with `DEVKIT_CHANGE`) in a scratch project, not through Claude Code's hook wiring and not on a real GitHub pull request with its `GITHUB_HEAD_REF` and `GITHUB_BASE_REF`; the tests cover the CI shape.
- The new release-tag code of PR 86 (the `tag-release` step) and the retro edits of PR 87 were not exercised by hand; their own tests (`release-tags.test.mjs`, `change-loop.test.mjs`) were carried from the implementers' runs.
- The dogfood on the next change opened in this repository after the release, and the re-install check in the consumer projects, are owed by the plan and are not part of this verification.
- Findings that are not defects: a setup re-run installs the flow its pack ships, so re-running an older pack over a project at flow 2 sets the installed flow back to 1 (the pins in the changes do not move, as AC-6 shows); `plugin validate` with the Node 22 binary prints one warning about `plugins/panel`'s `types` field, which this change does not touch.
