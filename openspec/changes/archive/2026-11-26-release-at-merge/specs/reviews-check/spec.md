<!-- devkit-stage specs result=passed attempt=1 commit=2ecd562495b490011ebc73c0165172169b92b8b7 -->
# Spec Delta

## MODIFIED Requirements

### Requirement: The train's own commits change only releases, the roadmap and its record
Every commit of the train not reachable from a boarded head or from the base branch SHALL change, beyond
what Git merges by itself, only release files, the CI pin, `openspec/roadmap.md` and the train's own
record, and the numbering of a boarded change's unnumbered ADR: the file renamed to its number and
citations that differ only by that number; any other path SHALL fail the check, naming the commit and
the path.

#### Scenario: A commit pushed onto the train
- **WHEN** a commit on `train/4` that no boarded head holds edits `plugins/x/hooks/a.mjs`
- **THEN** the check fails naming that commit and `plugins/x/hooks/a.mjs`

#### Scenario: The joins and the record
- **WHEN** the train's own commits are its join merges, whose resolutions edit only release files, and the record's commit
- **THEN** this rule passes

#### Scenario: A join that numbers an ADR
- **WHEN** a join renames `docs/adr/alpha.md` to `docs/adr/0027-alpha.md` and rewrites `ADR [alpha]` to `ADR 0027` in `docs/openspec-flow.md`
- **THEN** this rule passes

#### Scenario: A join that numbers an ADR and edits a sentence
- **WHEN** the same join also changes a sentence of `docs/openspec-flow.md` that is not a citation
- **THEN** the check fails naming the join commit and `docs/openspec-flow.md`
