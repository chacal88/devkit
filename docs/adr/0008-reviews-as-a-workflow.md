# ADR 0008: The reviewer round may run as one Workflow script

- Status: accepted
- Date: 2026-11-11
- Change: review-workflow

## Context

ADR 0001 lets devkit coordinate, never through a harness: a coordinating skill runs only the next
step as a subagent of the session the owner typed in, with no state outside the repository and
GitHub. The reviewer round is one such step, and the costliest: the matrix picks two to six
reviewers, each a foreground subagent whose verdict lands in the session's context. A false
`blocking` or `important` finding costs a fix round, and nothing checks it before it does. Claude
Code now offers a Workflow tool: a script, run in the background inside the session, that starts
subagents of that session in parallel and returns one structured result. The harness accepts it only
when the owner opted in on their own turn. In the grill of `review-workflow` the owner chose to
run the round as such a script, with three refuting verifiers per blocking or important finding
before any verdict file is written, and the same stages through the Agent tool wherever the tool
cannot run.

## Decision

1. The reviewer round of the `review-change` skill (and so the `review` step of `ship-change` and
   `/conduct`) may run as one Workflow script, in three stages: the reviewers in parallel, the
   verifiers, the reviewers writing their verdict files. No other step of devkit runs through the
   Workflow tool.
2. Inside the session: the script runs in the session the owner's turn started, as that session's
   background task. It starts subagents of that session only, starts no session, schedules nothing,
   and ends with the round.
3. No state outside the repository and GitHub: the script gets everything through its arguments and
   returns its result to the session. It is a file of the devkit-core pack, passed by path, never a
   saved workflow in the project. A killed round is run again from the files, like any step.
4. The gates do not change: each `reviews/<reviewer>.md` is written by that reviewer's agent type,
   verifiers write nothing, the session writes only `review.md`, and the delivery contract, the
   `Verdict:` and `Commit:` lines and the hooks' writer rules stay as they are. The owner's plan
   approval remains a human gate.
5. The script runs only on a turn the owner typed, through a skill that names the tool. On any other
   turn (a continuation, an Auto-fix wake, a task notification), or on a host without the tool, the
   session runs the same three stages with the Agent tool, and the files have the same shape.
   `review.md` names the path that ran.

## Consequences

- Positive: every blocking or important finding is checked by three independent agents before it
  costs a round; the reviewers start together; the session's context holds one result instead of
  every verdict; the round's rules exist once, in the pack, under one test set.
- Negative: a round runs more agents: the reviewers, three verifiers per open blocking or important
  finding, and the reviewers again to write (Accepted: `nit` and `praise` are never verified, and a
  refuted finding saves a fix round). Two paths must stay equal (Mitigated: both read the rules and
  prompts from the script's one rules section). In `/conduct` the review step usually lands on a
  continuation turn, where only the Agent-tool path is allowed (Accepted: the files are the same).
  A refutation by a majority of agents of the same model can drop a real finding (Mitigated: a
  refutation counts only with evidence, and the refuted finding stays listed in the verdict file
  and in `review.md`, with that evidence).

### Review trigger

The Workflow tool is proposed for any other step; the script needs state outside the repository and
GitHub (a saved workflow, a file outside the change folder); the tool's opt-in changes (automated
turns accepted, or the owner's turn no longer enough); a verdict file written from a Workflow agent
is not seen by the hooks with that agent's type.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| Keep the Agent tool only | Nothing new | Verification multiplies foreground calls in one turn; every verdict and vote lands in the session's context | low |
| Run the whole delivery as a Workflow | One engine | A harness inside the session, the thing ADR 0001 rules out; long-lived state in the tool | high |
| Verify after the file (the reviewer writes, the verifiers amend it) | The file exists early | Two writers per gate file; the guard refuses it | medium |
| A saved workflow in `.claude/workflows/` | Short call | A copy per project that drifts from the pack; state outside the pack | low |
| More reviewers instead of verifiers | No new agent | Whole reviews cost more than one refutation each; no majority on a single finding | low |
