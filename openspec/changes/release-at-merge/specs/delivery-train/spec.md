<!-- devkit-stage specs result=passed attempt=1 commit=2ecd562495b490011ebc73c0165172169b92b8b7 -->
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
