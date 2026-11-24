<!-- devkit-stage requirements result=passed attempt=1 commit=bd896defb73afff3b4ac315ad5a6354e82035e76 -->
# Requirements

## Request

> the stage checker counts a stage's attempts by failed takes, not by takes retaken after a merge of main made the evidence stale, so a merge-heavy delivery does not reach the ceiling of three without three real failures (release-merge-conflict retro, item 2)

## Assumptions

<!-- Each confirmed by the owner. Literal paths, fields, names. -->
- The ceiling is meant to count failed takes: `docs/openspec-flow.md` (line 109) says `flow.json` declares "how many failed attempts they get", and `docs/adr/0010-openspec-as-the-harness.md` says ceilings are "counted by the checker". The code differs: `plugins/openspec/hooks/flow-check.mjs` (the `ceiling-reached` end, `raw.attempt >= ceiling`) compares the ceiling with `attempt`, which is one more on every rewrite, passed or stale or failed alike.
- The owner chose, on 2026-11-23, to keep the count in the stage header (answer "A: campo no cabeçalho"): an optional field `failures=<n>`, written between `attempt` and `commit`: `<!-- devkit-stage <stage> result=<result> attempt=<n> failures=<n> commit=<sha|none> -->`. The checker keeps reading only the header (ADR 0010); the stage file's git history is not read.
- `attempt` stays as it is today (1 on the first write, one more on each rewrite). Only the ceiling reads `failures`.
- `failures` counts the failed takes since the last passed take of the stage: a take that passes sets it to 0, a take that fails sets it to the replaced header's value plus one. A header without the field is read as today: a failed header counts `attempt` failures, so changes under way and old archives keep their behavior.
- A take made only because a merge of the base made the evidence stale, or red for a defect the merge brought (a spec delta that lost main's scenario, a test of main that the change breaks), does not add to `failures`. The writer of the stage (the role that rewrites the file, for evidence the `pr-verifier`) says so in one line in the file's body, because the checker cannot tell the cause from the header. This is the part of `post-merge-validate` (roadmap line, round 17h) that the owner's decision of 2026-11-23 handed to this change: all attempt counting lives here.
- The line between this change and `stage-ceiling-consecutive` (round 28d): both change the single comparison in `flow-check.mjs` and need the same new fact, the failure count in the header, so they are one fix. This change delivers it whole (a pass resets the count, a merge-made take does not add). The coordinating session decides which of the two lines carries the work; the other is closed by it.
- The order of the checks in the failed branch of `flow-check.mjs` stays: the ceiling first, then `rerun-after-fix`, then `fix-after-failure`. Three real failures in a row end `blocked` even when the code changed between them (a ceiling that a fix could always lift would never stop a loop that cannot get green); what changes is only what is counted. The remote-worker case (two passed takes, one real failure, `blocked: ceiling`) is fixed by the count, not by the order.
- Every stage with a numeric ceiling is covered: the default of 3 and the declared 3 and 2 (`plugins/openspec/schemas/*/flow.json`), in the `devkit`, `devkit-lite` and `devkit-project` schemas. A stage declared `ceiling: "owner"` is unchanged.
- The messages that say `failed at attempt N of CEILING` (`header-failed`, `fix-after-failure`, `ceiling-reached`, and the `blocked-why.ceiling` line of `change-loop.mjs`) say the failure count, not the attempt number, in `en` and `pt-BR`.
- The schemas' `attempt` paragraph (each stage's instruction in `plugins/openspec/schemas/devkit/schema.yaml`, `devkit-lite/schema.yaml`, `devkit-project/schema.yaml`) and `docs/openspec-flow.md` say how a writer sets `failures`; the templates keep their line 1 unchanged (the field is optional).
- No real run needs the machine tonight: the plan, its tests and the readiness review are written now; the implementation and the whole suite wait for a place from the coordinating session.

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
- AC-1: `parseStageHeader` (`plugins/openspec/hooks/guard.mjs`) reads `<!-- devkit-stage evidence result=failed attempt=3 failures=1 commit=<sha> -->` as `{ attempt: 3, failures: 1 }`, still reads a header without the field (`failures: null`), and still marks any other extra or misplaced field malformed.
- AC-2: a stage whose header says `result=failed attempt=3 failures=1` is offered again (`fix-after-failure`, or `rerun-after-fix` when the code changed), never `ceiling-reached`, for a ceiling of 3.
- AC-3: a stage whose header says `result=failed attempt=3 failures=3` ends `blocked` with `ceiling-reached`, whether or not the code changed since the take.
- AC-4: a failed header without `failures` keeps today's count (`attempt`): `result=failed attempt=3` is `ceiling-reached`.
- AC-5: a header that says `failures` greater than `attempt` is reported malformed by the checker, not trusted.
- AC-6: the schemas' stage instructions tell the writer to set `failures` to 0 on a pass, to the replaced header's value plus one on a failure, and to leave it unchanged on a take a merge of the base made necessary, with one line in the body saying so; `docs/openspec-flow.md` documents the field.
- AC-7: the blocked message and the `header-failed` reason name the failure count and the ceiling (`failed 3 times, which is its limit`), in English and Brazilian Portuguese, from the count and not from `attempt`.
- AC-8: the tests of the change fail before the fix and pass after it: a failed take after two passed takes is not the third failure; three failures in a row still end `blocked`; a header without the field behaves as before.

## Out of scope

- Running `openspec validate <id> --strict` after a merge of the base and sending its failure to the planner as a merge defect (`post-merge-validate`, round 17h): this change only makes the merge-made take not count; the validate step stays there.
- The ceiling of a stage declared `ceiling: "owner"`.
- Counting attempts of the roadmap or of the review round's own loops (`review-round.mjs`), and the counts the panel shows.
- Reading the stage file's git history (option B of the owner's answer).
- Renaming or changing the meaning of `attempt`.
