<!-- devkit-stage decisions result=not-applicable attempt=1 commit=1e8c2a5084a7b8508f46fe3c2a4aa8e43affe817 -->
# Decisions and ADRs

No decision needs a record: lifting the two 400-character caps on dispositions and verifier evidence and replacing the reviewer's own `### Summary` with one the round builds from the outcomes change only the writer prompt inside `review-round.workflow.js` (stated in the `review-round` spec delta, reversible in one commit), and keep ADR 0008's gates as they are: the same writers, the same verdict file shape and `Verdict:`/`Commit:` lines, verifiers writing nothing, and a refuted finding still listed with its evidence. No hook or checker parses the summary section.
