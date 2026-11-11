# ADR 0001: Coordination without a harness

- Status: accepted
- Date: 2026-11-08
- Change: ship-modes

## Context

devkit replaced an orchestrator that drove changes through a coordinator session and a state
machine; it was slow, rigid and lost its place. README "Why no harness" and the 0.3.0 change
(roadmap rounds) therefore ruled coordination out: the state is the change's files, the schema
orders the artifacts, hooks veto. Owners still had to type every go-ahead, open the PR and push
each step. Two runtime facts bound any answer: app sessions cannot be started from automated
turns (chacal88/orchestrator 0.16.0), and the desktop app's PR Auto-fix can wake a session on a
CI failure, a merge conflict or a review comment.

## Decision

devkit may coordinate, never through a harness. A coordinating skill recomputes the next step
from the repository and GitHub every time it runs, runs only that step as a subagent of the
session the owner typed in, and stops with a reason. No long-running process, no state outside
the repository and GitHub, no starting or driving sessions or the app from outside. The gates
(one writer per gate file, approved plan before code, approved reviews and evidence before the
PR) stay as they are, and the owner's plan approval remains a human gate.

## Consequences

- Positive: changes reach a verifiable ready PR without the owner between gates; any run can be
  killed and resumed from disk; what "ready" means is one checker anyone can run.
- Negative: every step re-reads files and GitHub (Accepted: seconds against agent runs that take
  minutes). Waiting is bounded by the session: outside the app, one capped watch, then the owner
  re-runs the skill (Accepted). Auto-fix cannot be detected from the session (Mitigated: the
  skill says what will wake it).
- Note: conducting a change on request (`/conduct <id>`, and on an explicit `round <n>` the next
  steps of several changes at once, each in its own worktree; in the desktop app each
  implementation phase is a child session the conducting skill starts) is an exception recorded in
  ADR 0006 (0006-phases-as-child-sessions.md), which supersedes ADR 0005
  (0005-parallel-steps-and-a-session-wake-up.md), and in ADR 0007 (0007-one-change-on-request.md),
  which amends it. Running the reviewer round as one
  Workflow script inside the session is an exception recorded in ADR 0008
  (0008-reviews-as-a-workflow.md). This ADR's Decision governs everything else.

### Review trigger

A coordinator needs state that cannot be derived from the repository or GitHub, or Claude Code
lets automation start sessions (ADR 0006 already allows starting child sessions from the owner's
turn and its continuations; review it if an automated turn can start them).

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| Keep no coordination | Nothing new | The owner remains the loop | low |
| Long-running orchestrator session or daemon | Full control | The failure this repo left; fights the runtime; state outside the repo | high |
| A Stop hook that re-prompts until done | No new skill | A hidden harness; hooks should veto, not drive | medium |
| CI job running Claude on each push | Runs unattended | Secrets and cost in CI; state outside the session; not needed for round 1 | medium |
