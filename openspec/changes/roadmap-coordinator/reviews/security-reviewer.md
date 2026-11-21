Verdict: approved
Commit: ba000172e43ae6b2bfc979d744bcc6da7b045c13

## Security audit — roadmap-coordinator (round 2)

### Findings

Verdict: approved

Triaged scope: high = the changes to guard.mjs (transcriptEvents, runOf, roadmapRunOf, mainInRun, lock), change-loop.mjs (withLockFile, withOpenLock, the three decision functions) and roadmap-loop.mjs (updateRun); low = evidence records and review files.

Categories walked: injection, authn/authz/IDOR, exposure, crypto, secret, config.

Round 1 had no findings, so there is nothing to re-list.

What I checked in the refactor:
- The scan now happens once and the events are passed on. The filters are unchanged: `isMeta`, `isSidechain` and non-`user` lines are skipped, and typed commands and tool-result markers are read as before. `runOf` and `roadmapRunOf` still return null when the file cannot be read. Both are fail-open as before, and the lock stays fail-open by design. The edit block on product code for runs (`mainInRun`) still sees both run kinds.
- A forged marker in a transcript event is read exactly as it was before. The refactor adds no new input path.
- `withLockFile` keeps the same logic as before. The lock is created with `wx`, retried, taken over when stale and removed in `finally`. `updateRun` passes `sleep: undefined`, so the default applies. The lock path still comes from the git common directory or the run file directory, with no request input in it. The open lock still writes its pid and timestamp; the run lock writes no holder, as before.
- No secrets, no crypto and no new config defaults.

Discarded false positives: injection (no new sink; paths and arguments are unchanged); lock race or stale takeover (bookkeeping only, no security boundary, same as round 1); events passed into the decisions (internal call from guard.mjs, and the hook input was already the trust boundary).

Out-of-round: none.
