# ADR 0011: The change coordinator is the owner's session, held by hooks

- Status: accepted
- Date: 2026-11-20
- Change: change-coordinator
- Amends: ADR 0010 (0010-openspec-as-the-harness.md), one sentence of decision 8
- Accepted by: the owner, on 2026-11-20, in the message that approved the plan of the change: `Aprovo com o ADR 0011` ("I approve, with ADR 0011"); recorded in `openspec/changes/change-coordinator/approval.md`

## Context

ADR 0010 decision 8 answers ADR 0006's "side door" objection with "the change coordinator has no
edit tool and product code is still written only by the implementer role under the same hooks",
and the locks table of docs/coordination-design.md says the lock comes "from the role's
definition: it has no edit tool". In the Claude driver that holds only if the coordinator is a
subagent defined without edit tools. It cannot be: only the session the owner types in can ask
the owner the grill's questions, write approval.md from the owner's own message (a subagent may
not), and be called back when a background wait on GitHub ends; a subagent has finished by then.
No command or skill can make that session adopt an agent definition.

## Decision

1. In the Claude driver the change coordinator is the session the owner typed /devkit change in.
2. Its product edits, by an edit tool or a shell write, and its hand-offs to any agent whose role
   the change's script does not list are refused by a hook while a /devkit change run is under
   way. A run is under way when the newest slash command typed in the session is /devkit change
   and the loop has named the change after it, both read from the session's transcript.
3. That refusal replaces "it has no edit tool" as the reason there is no side door. Product code
   is still written only by the implementer role under the same hooks; the rest of decision 8,
   and decisions 1 to 7 of ADR 0010, are unchanged.

## Consequences

- Positive: the coordinator asks the owner, records the approval and resumes after a wait in one
  session; the guarantee is checked before each edit, by tests, in every project that opts in.
- Negative: the guarantee is weaker than a missing tool. The hook lets an edit through when it
  cannot read the transcript, the checker, git or GitHub, so that it never traps a session
  (Accepted: a lock that fails closed would trap sessions outside a run). Run detection reads a
  transcript whose format Claude Code does not document (Mitigated: probed before the locks are
  built, and recorded in the live test; a wrong reading fails open). A slash command typed after
  /devkit change ends the run for the hooks (Accepted: /devkit change resumes it).

### Review trigger

The transcript's stored form of a typed command or of a tool result changes, or the run is not
found in a live session; Claude Code lets a session adopt an agent definition, or lets a subagent
ask the owner; a product edit by the coordinating session is found in a /devkit change run.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| A change-coordinator subagent without edit tools, the session relaying the owner's gates | Keeps "no edit tool" literally | It cannot ask the owner or write approval.md, needs a write tool for its own files anyway, and is gone when a wait on GitHub ends | high |
| Keep ADR 0010's sentence and record the hook in a Note only | No new ADR | A weaker guarantee replacing an ADR's stated one with no decision record (openspec/config.yaml rules) | low |
| A hook that fails closed | A stronger refusal | A session with an unreadable transcript or a failing checker could not edit at all, in a run or not | low |
