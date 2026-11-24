<!-- devkit-stage specs result=passed attempt=1 commit=c56155334749cdc46bad077ba8f53c4bbec5d140 -->
# Spec Delta

## ADDED Requirements

### Requirement: An ADR number taken on the default branch is renumbered without the owner
From the implementation on, when the change's branch adds an ADR file in `docs/adr/` or
`docs/decisions/` whose four-digit number the default branch already gives another file of the same
folder, the next step SHALL hand the implementer the renumbering: each such file to the next free
number, and every reference to it in the branch's files. The owner SHALL NOT be asked.

#### Scenario: A sibling took the number
- **WHEN** the branch adds `docs/adr/0016-a.md` and the default branch holds `docs/adr/0016-b.md` and `docs/adr/0017-c.md`
- **THEN** the next step renumbers `docs/adr/0016-a.md` to `0018`, handed to the implementer, and names both paths

#### Scenario: No clash
- **WHEN** the branch adds `docs/adr/0016-a.md` and the default branch has no other file numbered `0016` in that folder
- **THEN** no renumbering step is given

#### Scenario: The same file on both
- **WHEN** the default branch holds the same `docs/adr/0016-a.md` the branch added, after a merge
- **THEN** no renumbering step is given

#### Scenario: Two clashes
- **WHEN** the branch adds `0016-a.md` and `0017-b.md` and the default branch holds other files numbered `0016` and `0017`, its highest being `0017`
- **THEN** the step renumbers them to `0018` and `0019`, in the order of their numbers
