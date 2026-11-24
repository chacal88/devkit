<!-- devkit-stage decisions result=not-applicable attempt=1 commit=6fce9721974668c73a1403e5d3121aa24349d8a2 -->
# Decisions and ADRs

No record needed: counting a stage's failures in a row from the stage file's earlier headers is a rule inside `plugins/openspec/hooks/flow-check.mjs`, which already starts git, under ADR 0010 decision 3 ("attempt ceilings live in configuration and are counted by the checker") and ADR 0017 decision 1 (state derived from the change's files and git, stored nowhere); the header, `attempt`, the agents and the `flow.json` files keep their form, the reason params only gain a `failures` field, no accepted record or rejected alternative is contradicted, and a revert of the checker undoes it with no data to migrate.
