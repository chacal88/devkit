<!-- devkit-stage proposal result=passed attempt=1 commit=4aa88a1ebea8213e62cdcfafa0b7b8257cf0867b -->
# Proposal

Change: `release-merge-manifest-fields` · Date: 2026-11-28 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(sources: `requirements.md`, `decisions.md`, `release.md`; roadmap line `release-merge-manifest-fields` of
`openspec/roadmap.md`). Base: `origin/main` at `6f03a57c`; the branch was opened on it (`61fb8fe3`) and has
merged nothing since, so no code merged after the grill contradicts a requirement.

## Why

The no-note path of `plugins/openspec/hooks/release-merge.mjs` refuses any head whose manifest changes
anything but a version field (`a manifest was edited beyond its version`, `release-merge.mjs:713`). A
change that edits a pack's description therefore cannot ride a delivery train, nor merge its base by
`--base`: train 19 left pull request 148 (project-setup) for exactly that. The edit is a reviewed value of
one side; refusing it costs a solo delivery each time.

## What Changes

- The version step that `--base` and `--merge` share (with the change side and the base side swapped,
  `release-merge.mjs:684`) does a three-way, field-level merge of each manifest the change side touched
  (`plugins/*/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`): the base side's text, with
  the renumbered versions as today, plus the change side's value of every field only the change side
  edited. A field only the base side edited keeps the base side's value (already true today).
- A field both sides edited, whatever the two values, or a field inside an entry the other side removed,
  aborts with exit 2, the branch at its old head, and an `error` starting
  `a manifest field was edited on both sides:` that names each file and field path.
- **Unchanged from today** (requirements question 4, read as "the old behaviour stays"): a pack entry the
  change side added to or removed from `marketplace.json` `plugins[]`, or a manifest the merge base lacks,
  still aborts with the old error `a manifest was edited beyond its version: <file> (<paths>)`; an entry or
  a manifest the base side added or removed stays the base side's, as today. The literal "on either side"
  would newly refuse a train that carries a new pack, which the requirements did not ask for.
- `docs/catalog.md` follows a kept description through the existing `scripts/gen-catalog.py` run.
- The docs that state the old refusal (`docs/openspec-flow.md` "Classification", "The version rule",
  "A join that conflicts"; `CONTRIBUTING.md` step 5) state the new rule.

Non-goals: the noted path (`numberRelease`, `assignBlocking`) and its refusal of a conflicting manifest
edited beyond its versions; accepting a field both sides edited to the same value; keeping a new or removed
pack entry or a new manifest; any change to the CHANGELOG step or to `scripts/gen-catalog.py`.

## Acceptance criteria

- AC-1 `head-only-field-kept`: `release-merge.mjs --merge <head>` where the head bumped a pack's version and edited its `plugin.json` `description` (and the matching `marketplace.json` entry), and the train did not edit those fields, exits 0 with `resolved: true`; the committed manifests carry the version renumbered above the train's and the head's description.
- AC-2 `train-only-field-kept`: when only the train edited a manifest field beyond its version (the head bumped only the version), the join exits 0 and the committed manifest keeps the train's value of that field with the renumbered version.
- AC-3 `both-sides-field-refused`: when the head and the train both edited the same manifest field, the join exits 2 with `resolved: false`, the branch is at its old head with no merge in progress and a clean tree, and `error` starts with `a manifest field was edited on both sides:` and names the file and the field path.
- AC-4 `disjoint-fields-merged`: when the head edited one field and the train edited another field of the same manifest, the join exits 0 and the committed manifest holds both edits and the renumbered version.
- AC-5 `base-mode-same-rule`: `release-merge.mjs --base <base>` on a change branch that edited a pack's description, with the base not editing it, exits 0 and keeps the branch's description with the version renumbered above the base's; a field both sides edited exits 2 as in AC-3.
- AC-6 `catalog-follows`: after AC-1's join, `python3 scripts/gen-catalog.py --check` passes on the committed tree (the catalog is regenerated from the kept description).
- AC-7 `docs-say-the-rule`: `docs/openspec-flow.md` ("Classification", "The version rule"), `CONTRIBUTING.md` (the train-join line) and the `change-coordination` spec state the new rule (fields only one side edited are kept, a field both sides edited aborts) and no longer say a description edit aborts or that such a change is delivered alone.

## Capabilities

### New Capabilities

- none

### Modified Capabilities

- `change-coordination`: "A release-only conflict is resolved by a merge of the base" gains the field rule
  for `--base` (a field only the branch edited is kept; a field both sides edited is a release file the rule
  cannot resolve).
- `delivery-train`: "Release numbers follow the boarding order on the train only" gains the kept fields of
  a join (AC-1, AC-2, AC-4); "A join conflict outside the release files takes the change off" gains the
  both-sides field (AC-3).

## Impact

- `plugins/openspec` (devkit-openspec): `hooks/release-merge.mjs` (the version step of `main`,
  `resolveVersions`, `diffPaths`, one new export); its tests `hooks/release-merge.test.mjs` and
  `hooks/delivery-train.test.mjs`. `hooks/train-loop.mjs` is unchanged: its `pathsDetail` already names
  the files of a refused join.
- Repository docs: `docs/openspec-flow.md`, `CONTRIBUTING.md`.
- No other surface: no skill, agent, schema, hook registration or CI file changes.
- Dependencies: none open. The `delivery-train` change it follows (roadmap `after: delivery-train`) is
  archived on `main`.

Exit criteria: `node scripts/test-suite.mjs --own-files --concurrency=4 && python3 scripts/check.py`
exits 0; `python3 scripts/gen-catalog.py --check` and `claude plugin validate .` exit 0; the real run of
`tasks.md` 2.2 is under `proof/`; `openspec validate release-merge-manifest-fields --strict` passes.

Decisions cited: `decisions.md` (no record: the rule stays inside the release files); ADR 0022 decision 8
(a join conflict only in release files is resolved by the `release-merge.mjs` rule); ADR 0034 decision 8
(the old rule stays for changes with no note); ADR 0003 (the release list, unchanged); ADR 0036 (the gate's
selective part). Open decisions inherited: none (the repository keeps no open-decisions log).

Release rule: this change carries `release.md`; no task bumps a version, edits a `CHANGELOG.md` line or a
CI pin line, or numbers an ADR.
