Verdict: rejected
Commit: 585b8b3649ef3732c58bf6b3f74f9ff575ecce5e

## Coverage analysis — roadmap-coordinator-followups (6e803eb..HEAD)

### Findings
- [important] plugins/openspec/hooks/roadmap-loop.test.mjs:2476 (AC-15 session-refused path) — [5] The host refusing a session start on a turn nobody typed (the session-refused key, the waits-turn and waits-refused lines, the later start at the typed turn) is proven only by tests that feed hand-written --after a=session-refused; evidence.md admits no live run saw it. Follow-up: when the first real untyped-turn case appears, record the host's real refusal text and check it produces this key. Not a rejection.
- [nit] plugins/openspec/hooks/roadmap-loop.test.mjs:2580 and the 'followups ... skill' tests — Implementation-coupled: the skill tests pin literal phrases in SKILL.md; a rewording turns them red and a behaviour change that keeps the phrases stays green. This is the project's usual way of testing prompts, so it is only noted.
- [nit] plugins/openspec/hooks/change-loop.test.mjs (F-4 guard tests) and guard.mjs STARTED_BY_SESSION — The 'Background (from the session that started this one):' first-message form is a hand-written fixture, not a transcript captured from a real host-started session; if the app changes the wording the test stays green and the guard stops recognising the command.

In-scope surfaces: plugins/openspec hooks (roadmap-loop.mjs, change-loop.mjs, guard.mjs), the devkit SKILL.md, and the ADR and docs. Runner: node:test in guard.test.mjs.

Blocking gaps (8-10 without a plan): 0

Seams checked (read only, no mutation runs): session-start action input (followups AC-13, exact input object); sessionName and sessionTitle cut rules; stage icon on every change-loop next action (AC-14); --after, --change and --param id validation (AC-4); run file lock with injected lockSleep (AC-6, AC-10); hold as { pid, at } and the dead-watch check (AC-7, with a killed hold process); turn typed|event, withheld starts, unknown word and missing --turn (AC-15); start anyway once (F-2, AC-8); others-go-on wording (AC-2); parseRunInput (F-1); guard typedOf for a session started by another session (F-4); failed write leaves no .tmp (AC-5); run file fields against ADR 0013 decision 4 (AC-3); transcript read once (AC-10).

Cross-process flow (coordinator -> host start tool -> change session -> report -> coordinator): not unit-testable; evidence.md and proof/live/records.txt hold real records of start_session, list_sessions with linked sessions, the title icon changes and the 150-archived run. Only the untyped-turn refusal is not seen live (F1).

Bug-fix reproduction: the live defects of the first run have named tests and red-before-fix records.

### Well covered
- Session-start payload: exact-object assertion in followups AC-13.
- Stale hold after a killed process: AC-7 tests with a real dead pid.
- Run file lock, hook timeout budget and temp-file cleanup: AC-5, AC-6, AC-10.
- Id validation at the three entry points, each with exit 3 and nothing written.
- Withheld-start accounting: every withheld start has its line.
- Suite state given by the caller (1162/1162 whole, 342/342 filtered); not re-run.
