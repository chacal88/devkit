<!-- devkit-stage specs result=passed attempt=4 commit=41dd40ed6cb3017dd2a8cc5c623ffa6d19934303 -->
# Spec Delta

## ADDED Requirements

### Requirement: A join numbers the release a boarded change's note states
When a boarded head carries a release note, its join SHALL keep the train's release lines, apply the
note's bumps above the train's tip with its changelog entry, CI pins and catalog, and number the
change's unnumbered ADRs with the next free numbers on the train's tip, rewriting their citations as
the delivery does. A head with no note SHALL be joined as before. A join that cannot number SHALL
take the change off the train with the reason attached.

#### Scenario: Two notes that bump the same pack
- **WHEN** `main` is at devkit-openspec 0.29.0, and `alpha` and `beta` both carry notes with `devkit-openspec: minor` and touch no release line
- **THEN** the train joins both with no conflict, holds 0.31.0, the CHANGELOG holds `beta`'s entry as 0.31.0 above `alpha`'s as 0.30.0, the CI pins name v0.31.0, and both branches are unchanged

#### Scenario: Two unnumbered ADRs
- **WHEN** the base's highest ADR is `0026`, `alpha` adds `docs/adr/alpha.md` and `beta` adds `docs/adr/beta.md`
- **THEN** the train holds `0027-alpha.md` and `0028-beta.md` and the citations outside the change folders name those numbers

#### Scenario: A noted change beside an old one
- **WHEN** `alpha` carries a note and `beta` bumps its own manifest with no note
- **THEN** `alpha` is numbered from its note and `beta` is renumbered above it by the kind of its own bump, as before

#### Scenario: A citation the train cannot resolve
- **WHEN** `beta` cites `ADR [gamma]` and neither the base nor an earlier join numbered `gamma`
- **THEN** `beta` is not in the train, and the record lists it as left with a reason naming `gamma`

#### Scenario: A project with no release file setting
- **WHEN** the project names no `devkit.release_tag` and the boarded head `alpha` carries a `release.md` and bumps its own manifest
- **THEN** `alpha` is joined as before this rule, renumbered above the train by the kind of its own bump, and its `release.md` is not read

## MODIFIED Requirements

### Requirement: Release numbers follow the boarding order on the train only
Each join of a head with no release note SHALL renumber the release files the joined head bumped
above the train's tip, keeping the kind of each bump, so the first boarded takes the lowest number.
Every boarded branch SHALL keep its own numbers. A head with a release note SHALL be numbered from
its note instead, as "A join numbers the release a boarded change's note states" says.

#### Scenario: Two minor bumps from the same release
- **WHEN** `main` is at 0.29.0 and `alpha` and `beta` each bump devkit-openspec to 0.30.0 with a CHANGELOG entry
- **THEN** after the joins the train holds 0.31.0, the CHANGELOG holds `beta`'s entry as 0.31.0 above `alpha`'s as 0.30.0, and both change branches still say 0.30.0
