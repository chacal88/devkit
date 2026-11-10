Verdict: rejected
Commit: 5f0caebbe70e088a52e3cc90d96ca093c1160b58
Round: 1

## Quality review - conduct-sessions (round 1)

### Findings
- [important] plugins/openspec/skills/conduct/SKILL.md (Archive paragraph, "every idle linked session whose `name` is that phase's `session.name`") - `session.name` exists only on a `session` row (conduct-check.mjs addSessions: `if (c.next.actor !== 'session') continue`). Archiving fires when the phase's gate task is ticked, at which point the change's next step is `review`, `gate` or the next phase's `implement`, so the row carries no descriptor for the finished phase (or one for the wrong phase). The executor has no field to read; the skill never says to build `<sessionPrefix><n>`. Busy detection already defines the rule (`^<prefix>[0-9]+$`), so the two paragraphs disagree on how a name is formed. Nothing in the tests covers it (the checker emits no data for it). fix: say the name is `<sessionPrefix><n>` with `n` the phase whose gate just ticked (read from tasks.md / the previous row's `phase`), not `session.name`.
- [nit] plugins/openspec/hooks/conduct-check.mjs:507-512 (`sessionPrefixes`) - the collision suffix is 2 hex chars (256 values). Two ids sharing a cut can get the same `hh`, and a collided prefix can equal another id's plain prefix; both give two changes the same prefix, so busy detection would mark the wrong change. Tests (conduct-check.test.mjs:1125-1145) cover only one colliding pair with distinct hashes. fix: after assigning, detect duplicates and re-hash with a longer slice (or a test that documents the accepted odds).
- [nit] plugins/openspec/hooks/conduct-check.mjs:521-523 (`briefOf`) - `cd ${worktree} && ` is unquoted; a worktree path with spaces breaks the child's first command. The same convention exists in the ship-change preamble, so this is consistent, not new. fix: quote it in both places in a later change.
- [nit] plugins/openspec/hooks/conduct-check.mjs:529 - names are `<=24` chars only while the phase has at most 2 digits (20 + `-p` + digits); a phase 100+ exceeds the limit that the test asserts for 1-99 only.
- [praise] plugins/openspec/hooks/conduct-check.mjs:76-77 - `actorOf(step, host = 'cli')` keeps the CLI path unchanged by default, and `deliveryStep` passes `report.host ?? 'cli'`; the host split is a single choke point with one test per host.
- [praise] conduct-check.test.mjs:1137 - the "one id extending another" test checks the digits-only match in both directions, the exact trap (`add-x` vs `add-x-pagination-p1`) the skill text warns about.
- [praise] CHANGELOG.md / docs/openspec-flow.md:217 - the breaking JSON change (`wake` removed, version 2) is named as BREAKING in the CHANGELOG and in the flow doc; no stale `wake` reference remains in code, plugin READMEs or ADR 0001/0005 (0005 is marked superseded by 0006).

### Summary
- 4 findings (0 blocking, 1 important, 3 nit) + 3 praise
- Justification: read the checker diff fully, the whole conduct SKILL.md, ADR 0005/0006 status lines, and the relevant docs and tests. Suite results taken from ship-change (not re-run). The checker is sound; the single open item is a skill-text gap in the Archive step that makes the executor guess the name of the session to archive. It is a one-line fix, so the verdict is rejected only because an important finding stays open.
