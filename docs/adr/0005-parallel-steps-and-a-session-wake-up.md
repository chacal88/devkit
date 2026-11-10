# ADR 0005: Conduct a round: parallel step subagents and a session wake-up

- Status: accepted
- Date: 2026-11-10
- Change: conduct-rounds

## Context

This ADR builds on ADR 0001 and makes two exceptions to it; ADR 0002 and ADR 0003 are unchanged.
ADR 0001 lets a coordinating skill recompute the next step from the repository and GitHub and run
only that step as a subagent of the owner's session, and bounds waiting by the session: one capped
watch, then the owner re-runs the skill. A roadmap round holds several changes, some independent,
some ordered by `after:`. Run one at a time, a round costs the owner one go-ahead and one re-run per
change and per wait. The owner chose, in the grill of `conduct-rounds`, to run the steps of
independent changes at once and to let the skill schedule its own re-run.

## Decision

1. A conducting skill may run the next steps of several changes at once, each step a subagent of
   the owner's session, at most three at a time, each in that change's own git worktree on the
   branch named after the change. Each step is still recomputed from the repository and GitHub
   before it is dispatched, and no subagent runs more than one step of one change. Owner gates
   (grill questions, plan approval, retro answers) stay in the owner's session.
2. When everything that can move waits on GitHub after one capped watch, the skill may leave one
   recurring cron job in the same session, every 20 minutes, whose prompt re-runs the skill with a `--wake` marker, which the skill treats as
   not an owner message (it never takes a `devkit-lite` change's first implement, nor writes an approval or a
   retro answer). It
   lists the session's jobs first and keeps at most one; it deletes it when nothing left can be
   advanced by it (roadmap done, or every remaining change waits on the owner or is stopped). The
   job holds no state: each firing recomputes everything.
3. Unchanged: no process outside the session, no starting or driving other sessions or the app,
   no state outside the repository and GitHub other than that one job; the owner's plan approval
   remains a human gate, now recorded on disk by the owner's session.

## Consequences

- Positive: a round goes from `not started` to `archived` with the owner only at owner gates;
  waits on GitHub no longer need the owner to re-run anything while the session is open.
- Negative: the session has to stay open (Accepted: killing it drops the job; running the skill
  again resumes from disk and GitHub). A firing spends tokens every 20 minutes while GitHub is
  slow (Accepted: the job is deleted once it can advance nothing). Parallel steps share one `.git`
  (Mitigated: only the owner's session fetches; a lock error is retried once). The job is state
  outside the repository (Accepted: it carries only the prompt, and the skill finds it by listing
  the session's jobs). The runtime may expire or drop session jobs (Accepted: the report names
  the job, and the owner's next run recreates it).

### Review trigger

A cron-started run takes a step the owner did not expect, a session holds more than one
conducting job, a step subagent runs more than one step, or Claude Code changes session cron
semantics or lets automation start sessions.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| One change at a time with `ship-change` | Nothing new | The owner remains the loop between changes and waits | low |
| One subagent per whole change | Simple dispatch | A subagent cannot ask the owner or spawn reviewers; a lost subagent loses its place | medium |
| The owner re-runs after each wait (ADR 0001 as is) | No runtime state | The round stalls on every GitHub wait | low |
| A Stop hook or a daemon that re-prompts | Unattended | A hidden harness; state outside the session (ADR 0001) | medium |
| A CI job running Claude | Runs without a session | Secrets and cost in CI; a coordinator outside the session | medium |
