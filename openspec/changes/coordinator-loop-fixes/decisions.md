<!-- devkit-stage decisions result=passed attempt=1 commit=bec9bf03e8ba0b5dc02c6ad2e719f9b7757f6e7c -->
# Decisions and ADRs

- ADR: `docs/adr/0022-the-loop-declares-the-decisions-outside-the-stage-gates.md` — The loop declares every decision it meets outside the stage gates, and a plan revised after the start goes back to its gates

The number 0022 is the next free one on `origin/main` (c1ac8c4) as drafted; a sibling change may take it first, and the record is then renumbered when this change merges the default branch. Not recorded, being easy to reverse and inside one boundary: `pr-verifier`'s second writable place under the change's `proof/` (inside the change folder, no gate file), the host-monitor wait (a wake-up source, the loop's files unchanged), the shared agent map, the language check, the nits, and the two `devkit-lite` decisions, which keep its stages and gates as they are and are recorded in `docs/openspec-flow.md`.
