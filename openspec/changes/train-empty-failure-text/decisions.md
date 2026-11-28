<!-- devkit-stage decisions result=not-applicable attempt=1 commit=b7acf8f5042142eb9fcdd89dc96dbf1be40a5263 -->
# Decisions and ADRs

No record needed: the change carries out ADR 0022 decision 7 ("leaves the train with the failure attached") at the `result: empty` end of `departTrain` by keeping `failure` in the `left` entries, writing an uncommitted, unread diagnostic file under `<git common dir>/devkit-trains/` and adding the `train-empty` message key; nothing is committed, the train record that `devkit-reviews` requires and `parseTrainRecord` are unchanged, no accepted record is contradicted, and the whole change is undone by removing the write and the key.
