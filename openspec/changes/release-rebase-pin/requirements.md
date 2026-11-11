# Requirements

## Request

Roadmap round 8, line `release-rebase-pin` (translated from Portuguese: the owner asked to create the change "from the round 8 line of the roadmap"): release-rebase and deliver-check accept a conflict in `docs/openspec-flow.md` when it is only the CI pin: the three stages are merged with the pin version masked, then the pin is set to the resolved devkit-openspec version; any other conflict in that file still aborts (retros: conduct-sessions item 8, conduct-one-change item 9, devkit-panel item 1).

Classification: domain=process type=feature flags=[contract] (confirmed). The contract is the `resolve-release-conflict` row of `conduct-check --json` (its `paths`) and the JSON report of `release-rebase.mjs` (its `files`, `conflicts`, `error`).

## Assumptions

- The conflict is classified in `plugins/openspec/hooks/conduct-check.mjs#releaseConflict` (with `conflictedPaths`), not in `deliver-check.mjs`; `deliver-check.mjs` only exports `RELEASE_FILE`. The roadmap line's "deliver-check" means this classification.
- `RELEASE_FILE` in `plugins/openspec/hooks/deliver-check.mjs` does not change, so `unnamedFiles` and the archive exemption of ADR 0003 (`docs/adr/0003-auto-merge-the-archive-pr.md`) do not change: an archive PR that changes `docs/openspec-flow.md` still needs an approved retro proposal naming it. The pin rule is a separate predicate, used only by the conflict classification and by `release-rebase.mjs`. No new ADR. (Owner: "Regra separada".)
- The rule covers one file only, fixed in the code: `docs/openspec-flow.md`. No configuration key. (Owner: "Só esse arquivo".)
- A pin line is a line of that file containing one of these markers: `pinned to the commit of v`, `<commit sha of v`, `git/ref/tags/v`, or the prose form `` (`v<semver>` above) ``. On a pin line, every `v<MAJOR>.<MINOR>.<PATCH>` is the pin and is masked; every other byte of the file, pin lines included, takes part in the merge as is.
- "Only the pin" means: the three versions of the file (merge base, `origin/<base>`, the change's head), each with its pins masked, merge cleanly with `git merge-file -p`. Anything else in the file that conflicts is "beyond the pin".
- `conduct-check` decides before any rebase: on a PR conflict (`item 5`, or the archive PR's `stop-archive` at `archive-pr`) whose conflicted paths are release files plus `docs/openspec-flow.md`, it runs the masked merge on the file's three blobs and gives `resolve-release-conflict` only when that merge is clean; otherwise the change stays blocked with the file named, as any other path is today. (Owner: "O checker decide".) `release-rebase.mjs` repeats the same check at every rebase stop.
- The resolved pin version is the devkit-openspec version `release-rebase.mjs` already computes (`resolveVersions`, from `plugins/openspec/.claude-plugin/plugin.json` at merge base, old head and `origin/<base>`); when the change did not bump devkit-openspec, it is the base's version.
- After the replay, whenever `release-rebase.mjs` resolves a devkit-openspec version and `docs/openspec-flow.md` exists, every pin on every pin line is set to that version, whether or not the file conflicted; the file is then listed in `files` and left uncommitted like the other release edits. (Owner: "Sim, sempre segue a versão".)
- This change bumps devkit-openspec from 0.10.3 to 0.11.0 (new behaviour), with a CHANGELOG line, and moves the pin in `docs/openspec-flow.md` to `v0.11.0`, as the existing test "the pin in docs/openspec-flow.md is the commit sha of v + the devkit-openspec version" requires.
- Proof is by tests on throwaway git repositories (the existing style of `plugins/openspec/hooks/release-rebase.test.mjs`) and by unit tests of the classification in the conduct-check tests; no live collision between two real PRs is staged.

## Acceptance criteria

- AC-1: `conduct-check --json` on a change whose PR conflicts with its base in release files and in `docs/openspec-flow.md`, where the file's conflict is only the pin, gives `next.step: "resolve-release-conflict"` with `docs/openspec-flow.md` in `paths`.
- AC-2: The same, where `docs/openspec-flow.md` also conflicts outside the pin (the same paragraph edited on both sides), gives the blocked state `blocked: item 5 (conflict in docs/openspec-flow.md)`, and no `resolve-release-conflict`.
- AC-3: AC-1 and AC-2 hold for an archive PR conflict as well: pin only gives `resolve-release-conflict`; beyond the pin gives `blocked: archive (archive-pr): conflict in docs/openspec-flow.md`.
- AC-4: `release-rebase.mjs --base <base> --json` where the base moved the pin and added a paragraph, and the change moved the pin and added a section: exit 0, `resolved: true`, both the paragraph and the section are in the file, every pin in the file equals the resolved devkit-openspec version, `docs/openspec-flow.md` is in `files`, and the edit is uncommitted.
- AC-5: `release-rebase.mjs` where the same paragraph of `docs/openspec-flow.md` was edited on both sides: exit 2, `resolved: false`, `conflicts` names `docs/openspec-flow.md`, the branch is back at its old head and the worktree is clean.
- AC-6: `release-rebase.mjs` where the devkit-openspec version is renumbered by the rebase and `docs/openspec-flow.md` did not conflict: every pin is rewritten to the resolved version and the file is in `files`; where the change did not bump devkit-openspec, every pin equals the base's version.
- AC-7: `RELEASE_FILE` is unchanged, and `unnamedFiles` still reports `docs/openspec-flow.md` when no approved proposal names it (a test pins both).
- AC-8: `docs/openspec-flow.md` describes the pin rule in the "Release-file conflict" override and in the "Classification" bullet of the `release-rebase.mjs` section; devkit-openspec is 0.11.0 in `plugins/openspec/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`, CHANGELOG has the entry, the pin is `v0.11.0`; `node --test plugins/openspec/hooks/guard.test.mjs` and `python3 scripts/check.py` are green.

## Out of scope

- Adding `docs/openspec-flow.md` (or any file) to `RELEASE_FILE`, or changing ADR 0003's exemption.
- A configurable list of pinned files, or pins in any file other than `docs/openspec-flow.md`.
- Changing how manifests, CHANGELOG or the catalog are resolved.
- The `ship-change` skill's own handling of conflicts (it reports `blocked: item 5`); only the `conduct-check` override and the script change.
- A live collision between two real PRs; the tests are the proof.

## Questions asked

1. [project rules] ADR 0003: the release list is also the archive PR's exemption. How does the file enter the automatic rebase? → A separate predicate for the pin only; the release list and ADR 0003 stay as they are.
2. [scope] Who decides that the conflict is only the pin, before any rebase? → `conduct-check`, with the same masked merge on the three blobs; the script repeats it at every stop.
3. [edges] Rewrite the pin when devkit-openspec is renumbered but the file did not conflict? → Yes, the pin always follows the resolved version.
4. [scope] Only `docs/openspec-flow.md`, or any file with pin lines? → Only that file, markers fixed in the code.

## Escalations

- None.
