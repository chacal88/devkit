<!-- devkit-stage decisions result=passed attempt=1 commit=bec9bf03e8ba0b5dc02c6ad2e719f9b7757f6e7c -->
# Decisions and ADRs

- ADR: `docs/adr/0032-the-loop-declares-the-decisions-outside-the-stage-gates.md` — The loop declares every decision it meets outside the stage gates, and a plan revised after the start goes back to its gates

The record was drafted with the next free number of its time and renumbered when this change merged `origin/main` after a sibling took it; it is renumbered again, by the loop's `renumber-adr` step, when a sibling takes its number before this change merges (the path above is the one the loop's `accept-decisions` reads, and the renumbering rewrites it). Not recorded, being easy to reverse and inside one boundary: `pr-verifier`'s second writable place under the change's `proof/` (inside the change folder, no gate file), the host-monitor wait (a wake-up source, the loop's files unchanged), the shared agent map, the language check, the nits, and the two `devkit-lite` decisions, which keep its stages and gates as they are and are recorded in `docs/openspec-flow.md`.
