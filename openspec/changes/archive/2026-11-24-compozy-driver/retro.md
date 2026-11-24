<!-- devkit-stage retro result=passed attempt=1 commit=ea482c01a6dab5111dd247e79cf7efb02faa89e2 -->
## Retro: compozy-driver

1. Went wrong:
   - The live proof on CompozyOS 0.6.2 (phase 5) found four defects that the unit tests could not see:
     generated agent descriptions over 280 characters, a gate that failed in 3 seconds because the
     record step read the key the loop had just handed, an `ask` node with several predecessors that
     opened its request eagerly, and a proof project without a `ship:` setting.
   - `main` moved six times while the change was open. Each merge forced a renumbering of the ADR and
     the versions, and the first plan approval went stale once.
   - The owner merged PR 94 with admin rights on 2026-11-24, stacked on stage-models and
     delivery-train, before three steps ran: the whole hook suite on the final tree (task 6.8), the
     marketplace validator (task 6.7: `claude plugin validate .` answers `permission denied` in this
     session) and the independent review round with its evidence. The change reached `main` with
     tasks 6.7 to 6.10 unticked and no `evidence.md` or `review.md`.
   - Known gaps, accepted in ADR 0024 or found at the last merge: the CompozyOS view does not carry
     the delivery train steps (`on-train`, `wait-train`, `boarded`), the `train` verb, the stage
     models or the retry one model up; the grill's triage seat `requirements-triage` is installed but
     nothing dispatches it; the plan approval and `accept-decisions` were not exercised live (the
     proof ran on the `devkit-lite` script).
2. Better next time:
   - Run the host's own validator on every generated artifact in the first phase of a change that
     targets an external host, not in the last one.
   - When sibling pull requests are in flight, stack on the sibling's head and renumber once, after
     its numbers are final.
   - A forced merge needs a recorded path: today `change-loop next` and `deliver-check` keep asking
     for the unticked tasks, and the flow offers no "merged without its gates" state.
3. Remember: a live run on the real host finds what tests of our own code cannot; record every host
   rule it finds in the ADR and pin it with a test.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | Host rules (description length, ask predecessors) surfaced only in the live proof | process-friction | doc-update | project |
| 2 | A forced merge leaves the loop asking for tasks forever; no recorded state for it | doc-gap | doc-update | project |
| 3 | The kit carries none of the train or stage-model steps; they need their own change | tooling | followup | project |
| 4 | Prove an integration against the real host early | process-friction | memory-only | user |

## Proposed updates

### `docs/compozy-kit.md` (doc-gap)
Record what the CompozyOS driver does not carry yet, so the next change on it starts from the list.
- before: the page lists what the kit installs and how the loops run.
+ after: a section "Not carried yet" lists the delivery train steps (`on-train`, `wait-train`, `boarded`) and the `train` verb, the stage models and the retry one model up, and the unused `requirements-triage` seat, each as a line of a later change.
- Answer: approved
- Applied: yes

### `openspec/roadmap.md` (process-friction)
Give the three gaps a roadmap line so they are not forgotten after the archive.
- before: `compozy-driver-dogfood` is the only line that follows this change.
+ after: a line `compozy-driver-gaps` (after `compozy-driver-dogfood`) names the train steps, the stage models with the retry, and the triage seat dispatch on the CompozyOS driver.
- Answer: approved
- Applied: yes

### `docs/openspec-flow.md` (doc-gap)
Say what a change does after the owner merged it with admin rights before its gates ran.
- before: "A change is delivered when its own pull request is merged and every task of its `tasks.md` is ticked on the default branch."
+ after: the same paragraph adds that when the owner merged without the evidence or the review, the change records that in `retro.md` (what did not run, with the reason), runs the tasks that can still run in a further pull request of the same change, and archives with the missing proof named.
- Answer: approved
- Applied: yes

### user memory (memory-only)
Prove an integration against the real host in the first phase: a live run found four defects of the CompozyOS kit that its unit tests could not.
- Answer: approved
- Applied: yes
