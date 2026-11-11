# Proposal

Change: `release-rebase-pin` · Date: 2026-11-11 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(requirements.md holds the grill; roadmap round 8)

## Why

Every devkit-openspec release moves the CI pin in `docs/openspec-flow.md` (the test "the pin in
docs/openspec-flow.md is the commit sha of v + the devkit-openspec version" requires it), and that
file is not a release file. So two changes that each bump devkit-openspec always conflict there,
`conduct-check` reports `blocked: item 5 (conflict in docs/openspec-flow.md)`, and
`release-rebase.mjs` exits 2. Three retros hit this (conduct-sessions item 8, conduct-one-change
item 9, devkit-panel item 1), and each time someone rebased by hand.

## What Changes

- A pin rule, separate from the release list, for one file fixed in the code
  (`docs/openspec-flow.md`). A pin line is a line holding one of the markers
  `pinned to the commit of v`, `<commit sha of v`, `git/ref/tags/v` or the prose form
  `` (`v<semver>` above) ``. Every `v<MAJOR>.<MINOR>.<PATCH>` on a pin line is a pin. A conflict in
  the file counts as "only the pin" when its three versions, each with its pins masked, merge
  cleanly with `git merge-file -p`.
- `conduct-check`: a change PR (`item 5`) or archive PR (`stop-archive` at `archive-pr`) whose
  conflicted paths are release files plus a pin-only `docs/openspec-flow.md` gets
  `resolve-release-conflict`, with the file in `paths`. A conflict beyond the pin stays blocked
  and names the file, as any other path does today.
- `release-rebase.mjs` makes the same check, through the same exported function, at every rebase
  stop. A pin-only conflict is resolved with the masked merge, and its pins get the base's
  devkit-openspec version. Anything beyond the pin still aborts with exit 2 and restores the old
  head. After the replay, when a devkit-openspec version is resolved and the file exists, every pin
  is set to that version and the file goes into `files`, uncommitted.
- `RELEASE_FILE`, `unnamedFiles` and ADR 0003's archive exemption stay as they are, and a test pins
  them.
- Release: devkit-openspec 0.10.3 → 0.11.0, marketplace 0.11.1 → 0.12.0, CHANGELOG
  `## 0.12.0 — release-rebase pin`, CI pin `v0.11.0`. The two bullets in `docs/openspec-flow.md`
  and the `release-rebase.mjs` row of `plugins/openspec/README.md` describe the rule.

Non-goals (from requirements.md, Out of scope): adding any file to `RELEASE_FILE` or changing ADR
0003's exemption; a configurable list of pinned files, or pins in other files; changing how
manifests, CHANGELOG or the catalog are resolved; changing how the `ship-change` skill handles
conflicts; staging a live collision between two real PRs.

## Acceptance criteria

- AC-1: `conduct-check --json` on a change whose PR conflicts with its base in release files and in `docs/openspec-flow.md`, where the file's conflict is only the pin, gives `next.step: "resolve-release-conflict"` with `docs/openspec-flow.md` in `paths`.
- AC-2: The same, where `docs/openspec-flow.md` also conflicts outside the pin (the same paragraph edited on both sides), gives the blocked state `blocked: item 5 (conflict in docs/openspec-flow.md)`, and no `resolve-release-conflict`.
- AC-3: AC-1 and AC-2 hold for an archive PR conflict as well: pin only gives `resolve-release-conflict`; beyond the pin gives `blocked: archive (archive-pr): conflict in docs/openspec-flow.md`.
- AC-4: `release-rebase.mjs --base <base> --json` where the base moved the pin and added a paragraph, and the change moved the pin and added a section: exit 0, `resolved: true`, both the paragraph and the section are in the file, every pin in the file equals the resolved devkit-openspec version, `docs/openspec-flow.md` is in `files`, and the edit is uncommitted.
- AC-5: `release-rebase.mjs` where the same paragraph of `docs/openspec-flow.md` was edited on both sides: exit 2, `resolved: false`, `conflicts` names `docs/openspec-flow.md`, the branch is back at its old head and the worktree is clean.
- AC-6: `release-rebase.mjs` where the devkit-openspec version is renumbered by the rebase and `docs/openspec-flow.md` did not conflict: every pin is rewritten to the resolved version and the file is in `files`; where the change did not bump devkit-openspec, every pin equals the base's version.
- AC-7: `RELEASE_FILE` is unchanged, and `unnamedFiles` still reports `docs/openspec-flow.md` when no approved proposal names it (a test pins both).
- AC-8: `docs/openspec-flow.md` describes the pin rule in the "Release-file conflict" override and in the "Classification" bullet of the `release-rebase.mjs` section; devkit-openspec is 0.11.0 in `plugins/openspec/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`, CHANGELOG has the entry, the pin is `v0.11.0`; `node --test plugins/openspec/hooks/guard.test.mjs` and `python3 scripts/check.py` are green.

## Capabilities

### New Capabilities

None as spec deltas. `openspec list --specs` reports no specs: this repository keeps no
`openspec/specs/` and pins behaviour with tests, and every archived change set
`skip_specs: true`, so this one does too. The acceptance criteria above are the behaviour.
`release-rebase.test.mjs`, `conduct-check.test.mjs` and `deliver-check.test.mjs` pin them, and
`docs/openspec-flow.md` documents them. The contract (`flags=[contract]`) is the
`resolve-release-conflict` row's `paths` and the `files` / `conflicts` / `error` fields of
`release-rebase.mjs --json`. No field is added or removed. Only the set of inputs that reach each
outcome changes (design D8).

### Modified Capabilities

None.

## Impact

- `plugins/openspec/hooks/release-rebase.mjs`: the pin rule (exported), its use at every stop and
  after the replay.
- `plugins/openspec/hooks/conduct-check.mjs`: `releaseConflict` classifies through the shared
  function. `deliver-check.mjs` is not edited.
- Tests: `release-rebase.test.mjs`, `conduct-check.test.mjs`, `deliver-check.test.mjs`. All run
  under `guard.test.mjs`.
- Docs and release: `docs/openspec-flow.md` (two bullets, one clause, the pin),
  `plugins/openspec/README.md` (one row), `plugins/openspec/.claude-plugin/plugin.json`,
  `.claude-plugin/marketplace.json`, `CHANGELOG.md`.
- Other projects: the rewrite applies only where `origin/<base>` or the branch has
  `plugins/openspec/.claude-plugin/plugin.json` named `devkit-openspec`. A project without it gets
  the masked-merge classification but no pin rewrite (design D7).
- Dependencies: git ≥ 2.38 (already required by `git merge-tree --write-tree`); `git merge-file`
  has been in git for much longer. No new package.
- Exit criteria: `node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py`,
  `python3 scripts/gen-catalog.py --check`, `claude plugin validate .` and
  `openspec validate release-rebase-pin --strict`, all green at the PR head.
- Decisions cited: ADR 0003 (the archive exemption, unchanged), ADR 0002 (stale reviews after a
  rebase, accepted), ADR 0001 (the checker recomputes and drives nothing). No new ADR. Open
  decisions inherited: none (the repository keeps no open-decisions log).
