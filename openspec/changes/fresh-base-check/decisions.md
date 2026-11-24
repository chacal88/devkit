<!-- devkit-stage decisions result=not-applicable attempt=1 commit=480032c3236f700f639cc64fff699595bde43042 -->
# Decisions and ADRs

No record needed: the change adds one non-blocking `git fetch` of `origin/<base>` inside `change-loop.mjs#nextAction` (and the `next`/`wait` callers that drive a change). That is easy to reverse, since removing the call restores today's behaviour and the fetch writes only the remote-tracking ref. It keeps the documented contract that `conduct-check` and `deliver-check` never fetch, picks no technology, and contradicts or amends no accepted record (0010, 0017, 0018, 0019 and 0020 say nothing about where the base is fetched; 0005, the only one that does, is superseded).
