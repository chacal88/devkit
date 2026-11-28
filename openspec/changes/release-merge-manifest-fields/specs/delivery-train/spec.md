<!-- devkit-stage specs result=passed attempt=1 commit=4aa88a1ebea8213e62cdcfafa0b7b8257cf0867b -->
# Spec Delta

## MODIFIED Requirements

### Requirement: Release numbers follow the boarding order on the train only
Each join of a head with no release note SHALL renumber the release files the joined head bumped
above the train's tip, keeping the kind of each bump, so the first boarded takes the lowest number.
Every boarded branch SHALL keep its own numbers. A head with a release note SHALL be numbered from
its note instead, as "A join numbers the release a boarded change's note states" says.

#### Scenario: Two minor bumps from the same release
- **WHEN** `main` is at 0.29.0 and `alpha` and `beta` each bump devkit-openspec to 0.30.0 with a CHANGELOG entry
- **THEN** after the joins the train holds 0.31.0, the CHANGELOG holds `beta`'s entry as 0.31.0 above `alpha`'s as 0.30.0, and both change branches still say 0.30.0

#### Scenario: A description only the joined head edited
- **WHEN** a head with no release note bumps pack `a` from 0.6.0 to 0.6.1 and edits `a`'s `description` in its `plugin.json` and in its `marketplace.json` entry, and the train's tip bumped `a` to 0.7.0 without editing either description
- **THEN** the join exits 0 with `resolved: true`, both manifests of the train carry 0.7.1 and the head's description, and `python3 scripts/gen-catalog.py --check` passes on the committed tree

#### Scenario: A field only the train edited
- **WHEN** the train's tip edited a manifest field beyond the version fields and the joined head with no release note only bumped that manifest's version
- **THEN** the join exits 0 and the committed manifest keeps the train's value of that field with the renumbered version

#### Scenario: Two different fields of one manifest
- **WHEN** the joined head with no release note edited one field of a manifest beyond its version fields and the train's tip edited another field of the same manifest
- **THEN** the join exits 0 and the committed manifest holds both edits and the renumbered version

#### Scenario: A pack entry or a manifest the joined head added
- **WHEN** the joined head with no release note added or removed a pack entry of `marketplace.json`, or added a manifest the merge base lacks
- **THEN** the join exits 2 with an `error` starting `a manifest was edited beyond its version:`, while an entry or a manifest only the train added stays the train's and does not refuse the join

### Requirement: A join conflict outside the release files takes the change off
A join whose conflicts are only in release files, in the CI pin, or in `openspec/roadmap.md` where the
joined side only ticks lines, SHALL be resolved by rule. A conflict in any other path SHALL take that
change off the train with the paths attached, and the train SHALL go on without it. A manifest field
the joined head and the train both edited SHALL take the change off the same way.

#### Scenario: A conflict in product code
- **WHEN** `beta` conflicts with the train's tip in `plugins/x/hooks/a.mjs`
- **THEN** `beta` is not in the train, the train record lists it as left with `plugins/x/hooks/a.mjs`, and the other boarded changes leave on the train

#### Scenario: Two neighbouring roadmap ticks
- **WHEN** two archives tick neighbouring lines of `openspec/roadmap.md` and their joins conflict there
- **THEN** the conflict is resolved with both lines ticked and nothing else of the file changed

#### Scenario: A roadmap edit that is not a tick
- **WHEN** a joined archive both ticks a line and rewrites another line of `openspec/roadmap.md`, and the join conflicts in that file
- **THEN** the archive is taken off the train with `openspec/roadmap.md` attached

#### Scenario: A manifest field both sides edited
- **WHEN** a joined head with no release note and the train's tip both edited the `description` of pack `a` in `plugins/a/.claude-plugin/plugin.json`, to the same value or to different values
- **THEN** the join exits 2 with `resolved: false` and an `error` starting `a manifest field was edited on both sides:` naming that file and `description`, the train's branch is at its old tip with no merge in progress and a clean tree, and the join's `conflicts` is `["plugins/a/.claude-plugin/plugin.json"]`, the path the departure attaches when it takes the change off
