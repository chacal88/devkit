# ADR 0009: The CompozyOS loop is a second driver of the devkit flow

- Status: accepted
- Date: 2026-11-14
- Change: compozy-loop-v2

## Context

Note (change-coordinator, 2026-11-20): `/conduct` was retired in round 15; the in-session driver is now `/devkit change` (ADR 0010).

Note (ADR 0010, 2026-11-19): ADR 0010 supersedes ADR 0001, whose Note this ADR extended, and keeps
CompozyOS as one of the drivers a project chooses. Until round 21 (compozy-driver) replaces it with
the short generic loop, the twelve-stage loop of devkit-compozy, its gates that shell out to
deliver-check, conduct-check and screens-check, and its opt-in per project hold as decided here;
round 24 (coordination-cleanup) removes the old loop.

Note (compozy-driver, 2026-11-23): [ADR 0021](0021-compozy-runs-the-short-loop.md) (proposed)
amends this record. The twelve-stage loop and its four role shells leave with round 21, and
CompozyOS runs one short loop that asks the change loop each turn, so the Decision's first bullet now
reads: every gate of a CompozyOS run is decided by `change-loop.mjs`, reading `flow-check` and,
through `conduct-check`, `deliver-check`, the checkers the Claude driver reads; no loop node shells
out to `screens-check`. Its third bullet reads: `/devkit change` is the in-session driver and
`/devkit` starts a CompozyOS run for a project that chose the driver; the opt-in per project stays.
The review trigger's first clause is read the same way: a CompozyOS gate that stops being decided by
those scripts. Everything else here is unchanged.

ADR 0001 forbids coordination through a harness and names its own review trigger: "a coordinator
needs state that cannot be derived from the repository or GitHub". A CompozyOS run holds exactly
that state — `iteration_cap`, `no_progress.window`, `budget.wall_clock_sec`, an armed
pull-request monitor — so the trigger has fired. ADR 0006's alternatives table already rejected "a
daemon that starts sessions (Compozy-style)" by name, for being "a harness outside the app; state
outside the repository (ADR 0001)".

The posture is not introduced by this change. `.compozy/` with its four role shells and the pilot's
loop already merged to `main` in PR #29 (`184dc17`), and `main`'s own `CLAUDE.md` already states
that `.compozy/` sequences this flow; this very change was driven by that loop. What `compozy-loop-v2`
adds is packaging the loop as `devkit-compozy`, an installable pack any project can adopt — and that
is what raises the stakes enough that `openspec/config.yaml`'s design rule applies: record the fired
trigger as an ADR, not as a silent deviation.

## Decision

CompozyOS is a **second driver** of the devkit flow, recorded as an exception in ADR 0001's Note —
the same pattern ADR 0006 and ADR 0008 already use — rather than as a superseder of ADR 0001.

- The gates do not move: every loop node that decides whether a change is ready shells out to
  `deliver-check`, `conduct-check` or `screens-check`, the same checkers `/conduct` calls, so what
  "ready" means stays one checker anyone can run regardless of which driver started the run.
- The repository and GitHub remain the source of truth. The run state a CompozyOS daemon holds
  (`iteration_cap`, `no_progress.window`, `budget.wall_clock_sec`, the armed pull-request monitor)
  is bookkeeping for one run, which can be killed and restarted from disk, the same resumability
  ADR 0001 asks of any coordination.
- The loop is opt-in per project (ADR 0004): a project that never installs `devkit-compozy` keeps
  ADR 0001's world exactly as it is. `/conduct` (ADR 0006, ADR 0007) stays the in-session driver; a
  project picks one of the two, never both on the same change.

ADR 0006's rejected "Compozy-style daemon" row gains a pointer to this ADR, so the table reads as
"this is where that tradeoff was accepted on its own terms", not as a standing refusal.

## Consequences

- Positive: a project that wants an unattended loop gets one without devkit growing a harness of
  its own; the gates, the checkers and the definition of "ready" are shared by both drivers, so a
  change started under one driver is reviewed by the same rules as one started under the other;
  the opt-in boundary (ADR 0004) keeps every project that does not install the pack unaffected.
- Negative: two drivers now exist, so a reader of ADR 0001 must also read this ADR to know the
  devkit flow's full shape (Accepted: ADR 0001's Note points here, the way it already points at
  ADR 0006 and ADR 0008). A CompozyOS run's bookkeeping state (the iteration cap, the no-progress
  window, the wall-clock budget, the armed monitor) lives outside the repository and GitHub while
  the run is active (Mitigated: it is bookkeeping only — no gate, no "ready" decision and no merge
  depends on it, and a killed run resumes from disk because every gate re-reads the repository and
  GitHub, never the daemon's own state).

### Review trigger

A CompozyOS gate stops shelling out to `deliver-check`, `conduct-check` or `screens-check` and
starts deciding readiness some other way; the loop starts driving sessions or merging without the
owner's or GitHub's own ship-mode decision (ADR 0002); or `devkit-compozy` becomes a default pack
rather than an opt-in one (ADR 0004).

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| Record it as an exception in ADR 0001's Note (chosen) | One line in the ADR that already lists the other two drivers' exceptions; no status change anywhere | A reader must follow the Note to this ADR to see the full picture | low |
| ADR 0009 supersedes ADR 0001 | States plainly that a harness is now accepted | Reads as reversing ADR 0001's own "Why no harness" for every project, including the ones that never install the pack; no shipped file needs the stronger form | medium |
| Leave the posture undocumented (reject D12's premise) | No new file | The fired review trigger goes unrecorded, contradicting `openspec/config.yaml`'s own design rule; the next reviewer re-opens the same question | low |
| Fold the decision into `design.md` only, no ADR | Fastest | `openspec/config.yaml` asks for a decision that changes an ADR to be a proposal for a new ADR, not a design-doc footnote; the next change cites no stable record | low |
