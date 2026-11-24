# ADR 0017: A change's state is derived in one place, and a stopped change's session title shows it

- Status: accepted
- Amended by ADR 0020 (0020-a-change-can-run-on-another-machine.md)
- Amended by ADR 0021 (0021-a-roadmap-run-opens-every-change-at-its-start.md)
- Date: 2026-11-22
- Change: change-state
- Amends: ADR 0014 (0014-each-roadmap-change-runs-in-a-session-of-its-own.md), decision 3, the title of a change session
- Accepted by: the owner, on 2026-11-22, in the message that approved the plan of the change: `Aprovo`; recorded in `openspec/changes/change-state/approval.md`

## Context

Note (remote-worker, 2026-11-23): a change waiting for a free place on its machine is the one
blocked end titled `⏳ <id>`, with no ⛔ ([ADR 0020](0020-a-change-can-run-on-another-machine.md)).
Decisions 1 to 4 are otherwise unchanged.

Note (roadmap-sessions-upfront, 2026-11-23): [ADR 0021](0021-a-roadmap-run-opens-every-change-at-its-start.md) amends decision 4 for a change session
of a roadmap run: while it waits for a place, the load or its dependencies, its title is ⏳ and the
id, the stage icon replaced, and its state is `running` with the reason of that wait, derived as
decision 1 says. A wait on GitHub keeps ⏳ beside the stage icon. Decisions 1 to 3 are unchanged.

Note (post-merge-validate, 2026-11-23, accepted with the change's plan): decision 1 gains one
input, the merge-check record
`<git common dir>/devkit/merge-check/<id>.json`, which the change loop's `merge-check` command writes
after a merge of the base and from which the blocked reasons `merge-defect` and `merge-check-failed`
come. It is a fact, not stored state: it holds what `openspec validate <id> --type change --strict` answered for one
merge commit at one fingerprint of the worktree (green, red with its errors and the count of reds on
that merge, or cannot-run with its cause), never the change's state or its next action. The state is
still derived on every read by the code that decides the loop's next action; a missing, damaged or
foreign record reads as no check, so the loop offers the check again and never reads it as green.
The record sits in the git common directory beside the write-back record, as the run file is an
input beside the change's files. The owner chose this place for it on 2026-11-23 (answer A).
Decisions 1 to 4 are otherwise unchanged.

ADR 0010 decision 3 gives the loop four ends, each with its reason, and decision 6 keeps the state in
the repository and GitHub. Each surface still read it its own way: `/devkit status` worked each row
out from the loop's action and the run file, the change session's title (ADR 0014 decision 3) showed
the stage only, so a session waiting for the owner looked like one at work, and the panels of
`coordination-panels` would have read the files a third way. The managed-agents-study (item F-1)
compared this with a Managed Agents session, which reports one status and one stop reason. In the
grill of `change-state` (2026-11-22), answers the owner delegated to the coordinating session: the
command, `/devkit status` and the title read the state in this change, the panels later; the title
carries the state icon beside the stage icon while the change is stopped; a change nobody works on in
a roadmap run reads running, ready for someone to continue; a GitHub that does not answer is a wait
on GitHub.

## Decision

1. A change's state is `running` or one of ADR 0010's four ends, with a reason when one applies and
   the stage. It is derived on every read, from the change's files, git, GitHub and the roadmap run
   file, by the code that decides the loop's next action, and stored nowhere. The loop's action, the
   change loop's state command, `/devkit status` and the change session's title read it; the panels
   read the command. The hooks' locks keep reading the transcript: they gate a run and report no state.
2. In a roadmap run the run file weighs first: an end the session declared, a stage or wait in
   flight, and, in a run with a session per change, a change with no session of its own or whose
   start waits for the owner's next message, which reads `running`, ready for someone to continue.
3. When the change's stage needs GitHub and GitHub does not answer, the loop ends waiting on GitHub
   with that reason, not blocked; the wait ends blocked, quoting GitHub's error, after three failed
   reads in a row.
4. ADR 0014 decision 3, amended: a change session's title is the stage icon and the change id while
   the change runs; while it is stopped, the state icon (🙋 waiting for the owner, ⏳ waiting on
   GitHub, ⛔ blocked), a space, then the stage icon and the id; 📦 and the id once archived. The stage
   icons and when the session renames itself are unchanged.

## Consequences

- Positive: the board, the title and the panels give one answer; a session waiting for the owner is
  told apart in the sidebar at a glance; a GitHub outage no longer stops a run as blocked.
- Negative: outside a roadmap run, an end the session declared (an agent's failure, a red gate) is
  in no file, so the state shows the stage as ready again until `next` runs (Accepted: ADR 0010
  keeps no stored log). A `gh` that is missing or not signed in reads as GitHub not answering until
  the wait's third failed read (Mitigated: the blocked reply quotes gh's error). A title holds two
  emoji (Accepted: cut to 59 code points). A GitHub failure the delivery checker meets on its own,
  before the delivery stage or on the archive branch, keeps its blocked end (Accepted: flagged in
  the change's design).

### Review trigger

A surface needs a state the loop cannot derive (a budget end); the app gains a session icon or a
session status; the owner asks for a stored history of states.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| One event log per change, the study's first candidate | A history to read | A stored state ADR 0010 rejects ("a session that remembers where it is"); the files already hold the facts | medium |
| Each surface keeps its own reading | Nothing to build | The board and the title already disagree on a stopped change | low |
| GitHub's silence mapped only in the state, the loop still blocked | The loop unchanged | The state and the loop's end disagree | low |
| The state icon in place of the stage icon | A shorter title | Loses where the change stopped; the owner chose both icons | low |
| A state icon while the change runs too | One form | The owner's answer: only the stage icon while it runs | low |
| Tell a missing gh or a refused login from an outage | An exact reason | The failure's kind would cross the delivery checker's lookup; the blocked reply already quotes gh's error | medium |
