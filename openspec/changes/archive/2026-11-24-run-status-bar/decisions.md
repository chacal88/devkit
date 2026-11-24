<!-- devkit-stage decisions result=not-applicable attempt=1 commit=a11521bd439a1a20d302abf4d7f7f82fc930a32f -->
# Decisions and ADRs

No record needed: the bar is one more read-only reader of `change-loop.mjs state`, as ADR 0017 decision 1 and the read-only surfaces of `docs/coordination-design.md` section 6 already decide. It writes nothing and stores no state. It is opt-in through one `statusLine` line the owner sets, so removing that line and the script undoes it. Leaving the budget off the bar keeps ADR 0017's review trigger (a budget end) untouched, and it contradicts no accepted record or rejected alternative.
