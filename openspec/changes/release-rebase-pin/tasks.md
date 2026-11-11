# Tasks

Change: `release-rebase-pin` · Date: 2026-11-11 · Owner: Kaue (chacal88)

Every gate is one backticked command, run as written (the flow takes the first backticked text after
`Gate:` and runs each `&&` part on its own). Work only in the worktree
`.claude/worktrees/release-rebase-pin` on branch `release-rebase-pin`. Plain bullets under
`## Workflow follow-up` are not tasks (`deliver-check` counts every checkbox of this file).

Red first, as a reported step: in every task that adds behaviour, write the tests, run the task's
red command, and put the failing test names (or the load error) in the phase report before you
write the code. Then run the same command green. A test that passes on its first run is reported as
such, with the reason. The full suite takes about 9 minutes (8.7 observed on `94e795d`); run it only at the gate.

## 1. The pin rule in both callers (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8)

- [x] 1.1 The shared rule (design D1-D4) in `plugins/openspec/hooks/release-rebase.mjs`. Under a new section `// ---- the CI pin`, export `PIN_FILE`, `PIN_PACK`, `PIN_PACK_NAME`, `setPins(text, version)`, `mergePins({ base, ours, theirs })` and `classifyConflict(paths, stagesOf)`. Masking is `setPins(text, '0.0.0')`. `mergePins` runs `git merge-file -p` in a `mkdtempSync(join(tmpdir(), 'devkit-pin-'))` folder that it removes in `finally`. Tests in `plugins/openspec/hooks/release-rebase.test.mjs`, each named `release-rebase pin: ...`:
  - `setPins` rewrites the pin on a line of each of the four marker forms, rewrites both pins of one line, keeps the period of `v0.10.3.`, replaces `v1.2.34` whole, leaves a `v1.2.3` on a line without a marker as it is, keeps `\r\n` endings, leaves a line that names a marker but holds no pin (``the markers are `git/ref/tags/v` and `<commit sha of v` ``) as it is, and is idempotent.
  - `mergePins` returns a text holding both edits, with every pin at `v0.0.0`, when one side moved the pin and added a top paragraph and the other moved the pin and added a bottom section. It returns `null` when both sides edit the same paragraph, and `null` when any side is `null`. No `devkit-pin-*` folder is left in `tmpdir()` after either call.
  - `classifyConflict`, with a spy `stagesOf`: release files only give `{ blocking: [], pinMerged: null }` and never call `stagesOf`; adding a pin-only `docs/openspec-flow.md` gives `blocking: []` and a string `pinMerged`; a beyond-the-pin file gives `blocking: ['docs/openspec-flow.md']`; `README.md` is always blocking; `stagesOf` is called at most once and only with `docs/openspec-flow.md`.
  - The real-file smoke test, named `release-rebase pin: the real docs/openspec-flow.md: setPins changes exactly its CI pin lines`. Read the repository's `docs/openspec-flow.md` and `plugins/openspec/.claude-plugin/plugin.json`. Assert that `setPins(doc, <that version>) === doc`. Assert that `setPins(doc, '99.0.0')` differs from `doc` in exactly the pin lines that hold a pin (lines that match the marker regex and hold at least one match of the pin regex, design D2), that there are at least 3 such lines, and that all of them are between the `## CI` heading and the next `## ` heading. A marker line with no pin (task 1.5 writes the markers literally in the "Classification" and "Release-file conflict" bullets) may sit anywhere: `setPins` leaves it as it is, and the test does not count it. Assert that the URL regex of the `deliver-check.test.mjs` pin test then yields only `<commit sha of v99.0.0>`.

  Red: `node --test --test-name-pattern="release-rebase pin" plugins/openspec/hooks/release-rebase.test.mjs` (expect the missing-export load error); then the same command green.
- [x] 1.2 `release-rebase.mjs`: the stop loop (design D6) and the post-replay rewrite (design D7).
  - In the loop, `classifyConflict(conflicts, <reader of :1:/:2:/:3:>)`. A non-empty `blocking` gives today's `unresolved({ conflicts })`.
  - A conflicted `PIN_FILE` is written as `setPins(pinMerged, baseVersion)` and `git add`ed.
  - `baseVersion` is the `version` of `origin/<base>:plugins/openspec/.claude-plugin/plugin.json` when its `name` is `devkit-openspec`, read once before the loop. When it is missing at a stop that needs it: `unresolved({ conflicts, error })`, with an error that starts `cannot set the pin:`.
  - After the manifests and CHANGELOG: `pinVersion = versions.packs['devkit-openspec'] ?? baseVersion`. When it is set and the file exists, rewrite every pin and push `PIN_FILE` into `files`. That is `written`, so a later failure restores it.

  Tests in `release-rebase.test.mjs`, named `release-rebase pin: ...`. Give `releaseRepo` an `initial = {}` option merged into the first commit. Export a fixture `pinDoc(version, { top, bottom })`: a doc with a top paragraph slot, a body, a `## CI` block holding the three pin lines of the real file (comment, raw URL, the prose line with two pins), and a bottom section slot, each slot at least 3 unchanged lines away from the pin lines and from the other slot. The fixtures put `plugins/openspec/.claude-plugin/plugin.json` (`name: devkit-openspec`) in `initial`, `extraA` and `extraB`.
  - AC-4: initial 0.10.0 with `pinDoc('0.10.0')`; A (the base) bumps the pack to 0.11.0, moves the pins to `v0.11.0` and adds a top paragraph; B (the change) bumps the pack to 0.10.1, moves the pins to `v0.10.1` and adds a bottom section. Expect exit 0, `resolved: true`, both texts in the file, every pin `v0.11.1` and no `v0.11.0`/`v0.10.1`/`v0.10.0` left, the file in `files`, `versions.packs['devkit-openspec'] === '0.11.1'`, the file in `git status --porcelain`, and `git show HEAD:docs/openspec-flow.md` holding both texts with its pins at `v0.11.0` (the replay keeps the base).
  - AC-5: both sides edit the top paragraph. Expect exit 2, `resolved: false`, `conflicts` including `docs/openspec-flow.md`, HEAD at `oldHead`, an empty `git status --porcelain` and no `rebase-merge` folder.
  - AC-6, renumbered without a conflict: A bumps the pack to 0.11.0 without touching the doc; B bumps it to 0.10.1 and moves the pins to `v0.10.1`. Expect `git show HEAD:...` pins at `v0.10.1` (no stop on the file), the worktree pins at `v0.11.1` and the file in `files`.
  - AC-6, the change did not bump: B is `B_PATCH`; A bumps the pack to 0.11.0 and leaves the doc pins at `v0.10.0`. Expect every pin at `v0.11.0` (the base's version) and the file in `files`.
  - No pack: `initial` without `plugins/openspec`. A pin conflict exits 2 with `error` starting `cannot set the pin:`, the old head restored and a clean worktree. With no conflict in the file, it exits 0, the file is not in `files` and its bytes are unchanged.
  - Every existing `release-rebase:` test passes unchanged.

  Red: `node --test --test-name-pattern="release-rebase pin" plugins/openspec/hooks/release-rebase.test.mjs` (the new CLI tests fail); then the same command green (AC-4, AC-5, AC-6).
- [x] 1.3 `conduct-check.mjs` `releaseConflict` through `classifyConflict` (design D5).
  - Add a local `threeVersions(worktree, ref, path)`: `git merge-base <ref> HEAD`, then `git show <rev>:<path>` for the merge base, `<ref>` and `HEAD`, with `null` when a show fails.
  - The blocked texts keep their shape.
  - When `paths` holds `docs/openspec-flow.md`, the `reason` of `resolve-release-conflict` is `the PR conflicts only in release files and the CI pin: <paths>`.
  - Import `classifyConflict` from `./release-rebase.mjs` and drop `RELEASE_FILE` from the `./deliver-check.mjs` import.
  - The header comment says no file is written in the repository (the pin check merges in a temporary folder it removes).

  Tests in `plugins/openspec/hooks/conduct-check.test.mjs`, named `conduct pin: ...`. Import `pinDoc` from `./release-rebase.test.mjs`. `roundRepo`'s `files` hold `CHANGELOG.md` and `docs/openspec-flow.md` as `pinDoc('0.10.0')`. Both sides edit both files: the change in `readyChange`'s `files`, origin through `t.commitOrigin`.
  - AC-1, change PR: the change moves the pin and adds a bottom section; origin moves the pin and adds a top paragraph. Expect `next.step` `resolve-release-conflict`, actor `subagent`, `paths` `['CHANGELOG.md', 'docs/openspec-flow.md']`, the reason with `and the CI pin`, the worktree's HEAD and `git status --porcelain` unchanged, and no `devkit-pin-*` folder left in `tmpdir()`.
  - AC-2: both sides edit the top paragraph. Expect the state `blocked: item 5 (conflict in docs/openspec-flow.md)` and actor `stop`.
  - AC-3, archive PR: `archiveRepo`, with a retro whose approved and applied proposal names `docs/openspec-flow.md` (as the existing README case does), and `archiveFiles` editing `CHANGELOG.md` and the doc against an origin commit. Pin only: `resolve-release-conflict` with the doc in `paths`. Beyond the pin: `blocked: archive (archive-pr): conflict in docs/openspec-flow.md`.
  - The existing release-conflict tests (lines 626-668, 780) pass unchanged.

  Red: `node --test --test-name-pattern="conduct pin" plugins/openspec/hooks/conduct-check.test.mjs`; then the same command green (AC-1, AC-2, AC-3).
- [x] 1.4 Pin the release list (design D10). In `plugins/openspec/hooks/deliver-check.test.mjs`, import `unnamedFiles` and add `release list: RELEASE_FILE is unchanged and unnamedFiles still reports docs/openspec-flow.md (AC-7)`. It asserts:
  - `RELEASE_FILE.source` equals today's literal source (copy it from `deliver-check.mjs` line 755);
  - `RELEASE_FILE.test('docs/openspec-flow.md')` is `false`;
  - `unnamedFiles(['docs/openspec-flow.md', 'CHANGELOG.md', 'openspec/roadmap.md'], [])` deep-equals `['docs/openspec-flow.md']`;
  - with `[{ answer: 'approved', targets: ['docs/openspec-flow.md'] }]` it gives `[]`.

  This test pins existing behaviour, so it is green on its first run; report it as such. Run: `node --test --test-name-pattern="release list" plugins/openspec/hooks/deliver-check.test.mjs` (AC-7).
- [x] 1.5 Docs (design D9).
  - `docs/openspec-flow.md`: one sentence on the pin in the "Release-file conflict" override bullet; the pin-line markers, the pins, the masked `git merge-file -p` merge, the repeat at every stop and the abort beyond the pin in the "Classification" bullet of "Release-file conflicts: `release-rebase.mjs`"; the base's version at the stop in "The replay keeps the base"; the post-replay rewrite of every pin to the resolved devkit-openspec version, and the `cannot set the pin:` error, in "The edits stay uncommitted".
  - The markers may be written literally (`` `pinned to the commit of v` ``, `` `<commit sha of v` ``, `` `git/ref/tags/v` ``); the prose form is written `` (`v<version>` above) ``, which is not a marker. On any line that holds a marker, write versions as `v<version>`, never as digits, the mask `v0.0.0` included. Each bullet of this file is one line, so the rule holds for the whole bullet. A marker line with no pin is left alone by `setPins` and is not counted by 1.1's smoke test; a marker line with a pin outside `## CI` turns it red.
  - `plugins/openspec/README.md`: the `hooks/release-rebase.mjs` row names the CI pin in `docs/openspec-flow.md`.

  Verify: `python3 scripts/check.py` passes, and `node --test --test-name-pattern="the real docs/openspec-flow.md" plugins/openspec/hooks/release-rebase.test.mjs` is still green: the lines `setPins` changes are still exactly the three pin lines inside `## CI`, so no new marker line holds a pin (AC-8).
- [x] 1.9 Gate: `node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py` green (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, and the docs half of AC-8).

## 2. Release 0.11.0, with the pin moved by the new rule (AC-8)

Phase 2 needs phase 1 green: task 2.2 moves the pin with phase 1's `setPins`, so the new code runs
once on the real file before the gate.

- [x] 2.1 Bump devkit-openspec to `0.11.0` in `plugins/openspec/.claude-plugin/plugin.json` and in its `.claude-plugin/marketplace.json` entry, and set the marketplace `metadata.version` to `0.12.0`. Add `## 0.12.0 — release-rebase pin` above `## 0.11.1` in `CHANGELOG.md`, with a **devkit-openspec** 0.11.0 line covering:
  - a conflict in `docs/openspec-flow.md` that is only the CI pin (pins masked, `git merge-file -p` clean) is `resolve-release-conflict` in `conduct-check` and is resolved by `release-rebase.mjs` at every stop;
  - anything beyond the pin is still blocked or exit 2;
  - after every replay the pins follow the resolved devkit-openspec version;
  - the new `cannot set the pin:` error;
  - `RELEASE_FILE` and ADR 0003's exemption are unchanged;
  - the CI snippet pins `v0.11.0`.

  Red: `node --test --test-name-pattern="the pin in docs/openspec-flow.md|the real docs/openspec-flow.md" plugins/openspec/hooks/deliver-check.test.mjs plugins/openspec/hooks/release-rebase.test.mjs` (both fail: the pins are still `v0.10.3`); report it (AC-8).
- [x] 2.2 Move the pin with the new rule. Run `git add docs/openspec-flow.md`, then `node --input-type=module -e "import { setPins } from './plugins/openspec/hooks/release-rebase.mjs'; import { readFileSync, writeFileSync } from 'node:fs'; const f = 'docs/openspec-flow.md'; writeFileSync(f, setPins(readFileSync(f, 'utf8'), '0.11.0'));"`. Verify that `git diff -U0 docs/openspec-flow.md` shows exactly the three pin lines changed (the comment, the raw URL, the prose line), that `grep -c "v0\.10\.3" docs/openspec-flow.md` prints `0`, and that 2.1's red command is now green (AC-8).
- [x] 2.3 Run `python3 scripts/gen-catalog.py`. Verify that `python3 scripts/gen-catalog.py --check` exits 0 and `"$HOME/Library/Application Support/Claude/claude-code/2.1.317/91184d3d9ba3/claude.app/Contents/MacOS/claude" plugin validate .` passes (AC-8); the bundled binary by absolute path, never the bare `claude` (see design.md, Risks).
- [x] 2.9 Gate: `node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && "$HOME/Library/Application Support/Claude/claude-code/2.1.317/91184d3d9ba3/claude.app/Contents/MacOS/claude" plugin validate . && openspec validate release-rebase-pin --strict` green (AC-8).

## Workflow follow-up

These are plain bullets, outside `deliver-check`'s count (see the note at the top).

- Review and evidence: give the reviewers and `pr-verifier` the result of gate 2.9 (the suite takes about 9 minutes) instead of having them re-run it.
- After the merge and before the archive: `claude plugin update devkit-openspec@devkit` in the project. The first real pin collision between two changes is the live proof. When it happens, record in the retro the `resolve-release-conflict` row and `release-rebase.mjs`'s JSON.
- Archive through `ship-change`. If a retro proposal bumps devkit-openspec, it also names `docs/openspec-flow.md` (the pin follows the version, and ADR 0003's exemption does not cover the file).
