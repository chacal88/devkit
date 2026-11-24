<!-- devkit-stage decisions result=passed attempt=1 commit=df0beb015918e8ea5344202a3eeb41ebbfdda78c -->
# Decisions and ADRs

- ADR: `docs/adr/0025-one-setup-verb-replaces-the-two-setup-skills.md` — One setup verb, `/devkit setup`, replaces the two setup skills

Notes for the planner:

- The record amends ADR 0004 (its Decision and Consequences name `openspec-setup`) and keeps ADR 0009's Decision; ADR 0009 does not name `compozy-setup`, so it needs no amendment. Its number 0025 is final unless a later merge of `main` takes it (`origin/main` holds 0022 to 0024 today; 0024 is the `compozy-driver` record): then the record takes the next free number at the change's last merge of `main` before review, and every link to it moves with it.
- `docs/coordination-design.md` needs no amending record: ADR 0010, decision 1, lists the configuration, the roadmap and the schemas, not checker code. Its Open points line on project setup is answered in that doc ("answered by the change project-setup"), as other changes answered theirs, reading "the checker" as the version pin.
- The driver rule, the `devkit:` block's questions and the re-run behaviour use keys earlier records decided and are easy to reverse: no record.
- The ADR list in `openspec/config.yaml` (`context`, ADRs line) and the dated Note on ADR 0004 that the project adds when a record amends it are the planner's edits, written after plan approval; this stage did not edit them.
