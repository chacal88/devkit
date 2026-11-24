<!-- devkit-stage decisions result=not-applicable attempt=1 commit=2aea5d914ea2e8266f2de39f6a5b19696d40d65d -->
# Decisions and ADRs

No record needed: the change reuses the existing `commit` step of `deliver-check.mjs` and its `commit-and-pr` hand-off one call earlier (before `review` when the change folder is dirty), which adds no role, row, contract or technology, contradicts no accepted record (ADR 0008, 0016 and 0017 keep their wording), and is undone by removing one condition in the checker.
