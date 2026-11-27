<!-- devkit-stage requirements result=passed attempt=1 commit=none -->
# Requirements

## Request

> on the next real `/devkit roadmap` run, record the host's real refusal of a session start on a turn nobody typed and what the owner saw, and several ends handled one after another by the coordinating session; a defect found is fixed with its red test (roadmap-coordinator-followups retro, AC-12 and AC-15)

## Assumptions

<!-- Each confirmed by the owner. Literal paths, fields, names. -->
- Classification: domain=process type=feature flags=[] (confirmed). The owner chose "record and fix the defects found" over "record only" (2026-11-27).
- The real run is the `/devkit roadmap 4` run the owner typed on 2026-11-27 in the session `7f47efbd-584a-4edd-8d67-f124148838c2`; its facts are the evidence, no second run is needed.
- The host's refusal, as the app printed it on an event turn: "When the app continues on its own, it can only start sessions where this one runs, in this project."
- Defects seen in that run, each to be reproduced by a red test in `plugins/openspec/hooks/roadmap-loop.test.mjs` (or the test file that already owns the behaviour) before its fix:
  - D1: `next` mints a new start ticket on every call for a session not yet claimed (`decide` in `plugins/openspec/hooks/roadmap-loop.mjs`), so a session started with the ticket of an earlier `next` output is refused by the entry guard as `ticket-unknown`.
  - D2: with `places` at 4 and four changes open, the stop guard keeps naming each further ready change ("is ready to start: open it"), one per stop, so the coordinating session cannot end a turn without opening past the owner's number or declaring an owner decision for each.
  - D3: an owner-decision end declared by `roadmap-loop.mjs reply waiting-owner-decision` stays in `run.declared` and keeps the change out of `session-start` until the owner re-types `/devkit roadmap <n>`.
- A defect the tests show not to be one is recorded as such in `evidence.md` and not fixed.

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
- AC-1: the change's `evidence.md` holds the host's refusal text above, the turn it came on (an event turn, not typed), and what the owner saw (no session opened, the run waiting).
- AC-2: `evidence.md` holds the run in which several ends were declared one after another by the coordinating session (`blocked-why-held`, `host-monitor-wake`, `project-slice-dogfood` and the others), with what each said.
- AC-3: a test starts a session with the ticket of a previous `next` output and the entry guard allows it (D1), red before the fix.
- AC-4: a test with `places` filled by open changes shows the stop guard does not demand opening a further ready change (D2), red before the fix.
- AC-5: a test shows a declared owner-decision end is released by the owner's next typed message to the run, without re-typing the command (D3), red before the fix.
- AC-6: the suite part the change's own files map to passes (`node scripts/test-suite.mjs --own-files`).

## Out of scope

- Opening the sessions of the changes that wait for a place (`roadmap-run-opens-sessions`).
- Named roadmaps (`multi-roadmaps`).
- Any change to how the owner's gates (grill, plan approval, retro) are asked.
