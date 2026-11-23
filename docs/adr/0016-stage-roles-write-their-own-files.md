# ADR 0016: Stage roles write their own files, and a stage that does not apply may leave none

- Status: accepted
- Date: 2026-11-21
- Change: stage-roles
- Amends: ADR 0010 (0010-openspec-as-the-harness.md), decision 3's sentence on a stage that does not apply and decision 8's sentence on product code; ADR 0011 (0011-the-change-coordinator-is-the-owners-session.md), decision 3
- Accepted by: the owner, on 2026-11-22, in the message that approved the plan of the change: `Aprovo`; recorded in `openspec/changes/stage-roles/approval.md`

## Context

Note (compozy-driver, 2026-11-23): decision 3's last sentence ("In the CompozyOS kit the implementer
sets them before its first phase, after the operator's approval.") is replaced by decision 4 of
[ADR 0021](0021-compozy-runs-the-short-loop.md) (proposed). The implementer shell that sentence
names leaves with the old kit, and on CompozyOS the records are accepted by the same
`accept-decisions` script as on the Claude driver, which the loop runs with no agent right after the
recorded plan approval. The rest of this record is unchanged.

Round 16 ships the roles of four stages that the scripts declared and nobody ran: the screen
designer (the mock-up), the ADR author (decisions and ADRs), the test runner (the unit suite) and the
E2E tester. Two facts of the accepted records stop them as written.

ADR 0010 decision 3 says every stage leaves a file and "a stage that does not apply leaves its file
saying so". The owner decided that a change touching no screen gets no mock-up file, that a project
with no E2E command gets no E2E file and no agent, and that a change opened before this version never
gains a file for a stage it has passed. The checker already reports a stage whose role is not shipped
as not applying without a file, and says why in the stage's line.

ADR 0010 decision 8 and ADR 0011 decision 3 say product code is written only by the implementer
role under the same hooks. The hooks call every path outside `openspec/` and `.claude/` product
code. The owner decided that the ADR author drafts each record in the project's ADR folder before the
plan is approved, that the E2E tester writes E2E tests apart from the implementer, and that the
owner's plan approval accepts the records together with the plan.

## Decision

1. A stage may declare when it applies: a flag of the grill's classification, a setting of the
   project's `devkit:` block, or a later stage that the change has not reached yet. A stage whose
   condition does not hold, or that the change had already passed, leaves no file; the checker
   reports it as not applying, with the reason in its line. Every other stage leaves its file, as
   ADR 0010 decision 3 says.
2. Two kinds of file outside the change folder are not product code when their role writes them
   under the hooks: a decision record (a Markdown file in a folder named `adr`, `adrs` or
   `decisions`), which the ADR author drafts before the plan is approved; and a test file, which the
   E2E tester writes only after the full script's readiness is approved. Every other path outside
   `openspec/` and `.claude/` stays product code, written only by the implementer role on the full
   script once the plan is approved. On a script without a readiness stage (`devkit-lite`) the guard
   keeps product code open to every agent, the E2E tester included, as before this record: the
   test-file limit applies on the full script only.
3. A record the ADR author proposes is accepted by the owner's plan approval. In the Claude driver,
   once that approval is recorded, the loop hands the session one step that runs a script: it sets
   every record `decisions.md` lists from proposed to accepted with the approval's date, refuses
   while the approval is not current, and writes nothing else; the session's own product edits stay
   refused in a run (ADR 0011 decision 2). In the CompozyOS kit the implementer sets them before its
   first phase, after the operator's approval.
4. ADR 0010's other decisions, and ADR 0011's decisions 1 and 2, are unchanged.

## Consequences

- Positive: the four stage roles run under the same hooks; a change that does not need a stage
  carries no file for it; a change under way is never sent back; the records the plan depends on are
  accepted in the same message as the plan, and the date is set by a script, not by hand.
- Negative: the E2E tester's write rule reads the path, so a product file named like a test passes it
  (Mitigated: the tester's own instructions, and the review bench reads the diff). A stage with no
  file is visible only in the readout, not in the change folder (Accepted: the readout and
  `/devkit status` say why). The accepting script writes from the session's shell, which the edit
  lock does not see (Accepted: it writes only listed records, only after a current approval).

### Review trigger

A product file reaches a pull request through the E2E tester's or the ADR author's write rule; an
owner asks for a stage's skip to be kept as a file; the accepting script is found writing anything
but a listed record's status.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| A Note on ADR 0010 only | No new record | Two decision sentences would change with no record; ADR 0011 rejected that form for a weaker guarantee | low |
| A `not-applicable` file for every skipped stage | Decision 3 kept as written | The owner decided no file for the mock-up and E2E; a change under way would gain files | low |
| The implementer writes the E2E tests and the ADRs | No new writer | The owner wants E2E tests apart from the implementer, and records before the plan is approved | medium |
| A project setting naming the E2E test folder | An exact rule | One more setting before any project needs it; left to the project setup round | low |
| The session edits the records' status by hand | No script | The session writes no product code in a run, and a hand edit can skip a record | low |
