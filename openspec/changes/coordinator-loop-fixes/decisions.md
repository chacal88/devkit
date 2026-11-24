<!-- devkit-stage decisions result=passed attempt=2 commit=92b2d0156a14fc59308532d1e7e619f004f0d849 -->
# Decisions and ADRs

- ADR: `docs/adr/0032-the-loop-declares-the-decisions-outside-the-stage-gates.md` — The loop declares every decision it meets outside the stage gates, and a plan revised after the start goes back to its gates
- ADR: `docs/adr/0033-a-changes-own-settings-live-in-an-x-devkit-block.md` — A change's own settings live in an `x-devkit:` block of its `.openspec.yaml`

The record was drafted with the next free number of its time and renumbered when this change merged `origin/main` after a sibling took it; it is renumbered again, by the loop's `renumber-adr` step, when a sibling takes its number before this change merges (the path above is the one the loop's `accept-decisions` reads, and the renumbering rewrites it). Not recorded, being easy to reverse and inside one boundary: `pr-verifier`'s second writable place under the change's `proof/` (inside the change folder, no gate file), the host-monitor wait (a wake-up source, the loop's files unchanged), the shared agent map, the language check, the nits, and the two `devkit-lite` decisions, which keep its stages and gates as they are and are recorded in `docs/openspec-flow.md`.

The second record (design D-22, amending ADR 0023 decision 1) was asked for by the readiness review; 0033 was the next free number across the remote branches when it was drafted, and the loop's `renumber-adr` step may renumber it at merge in the same way.
