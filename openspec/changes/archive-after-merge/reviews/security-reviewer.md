Verdict: approved
Commit: d50ffb134c0486372e7b44e2888c211b099bfe99

## Security audit - archive-after-merge (round 2, scoped)

Triaged scope: high: plugins/openspec/hooks/deliver-check.mjs (archiveNext, unnamedFiles, archivePrCheck, runCi), merge-setup.mjs; low: docs, tests.
Categories walked: injection, authn/authz/IDOR, exposure, crypto, secret, config
Discarded false positives:
- injection (archivePrCheck folder regex / readRetro path) - folder names come from `git diff --name-only -z` and are matched by `^openspec/changes/archive/\d{4}-\d{2}-\d{2}-[^/]+/`; they are only joined under `root` for a read, and the PR's own files are the data being checked, not an escape from it.
- injection (`gh pr view <n>`) - `n` is a number from `gh pr list` JSON, passed as an execFile argument.
- DoS (maxBuffer 64 MiB, one `gh pr view` per PR) - not security.
- authz (retro answered in the PR's own retro.md) - owner-answer gate is agent-honored by design (ADR 0003).

### Findings (TRUE POSITIVE)
- [blocking] [authz] deliver-check.mjs archiveNext (open-PR branch) vs the missing file check · fixed in d50ffb1. Verified: `filesStop`/`answersStop` now run inside the `pr.state === 'OPEN'` branch before conflicts/headRel/enable-auto-merge, `disable-auto-merge` fires first when auto-merge is on, and `changed` is loaded whenever a PR exists (archiveFacts).
- [important] [authz] unnamedFiles exempted all of `openspec/` · fixed in d50ffb1. Verified: exemption is now `isArchiveRecord` (`openspec/changes/**` and `openspec/roadmap.md`); `openspec/config.yaml` and `openspec/schemas/**` need a named, approved proposal. The same predicate is used by the new CI check.

New, in the changed lines (not blocking):
- [important] [authz] deliver-check.mjs archiveNext, `held = a.local === 'archived' && a.retro.readable ? ... : null` - when an archive PR is OPEN but the local working tree has the change folder still active (a PR on `chore/archive-<id>` that never moved the folder, local head equal to the PR head), `held` is null and the run can reach `enable-auto-merge` with no file or answer check. Not blocking because CI backstops it: on `chore/archive-<id>` with the change still active, `selectCiChange` selects that active change, so `devkit-reviews` applies the staleness rule and fails on a product commit after the recorded reviews; and it needs push access plus a merged change PR. Fix: when an archive PR is OPEN and the folder is not archived locally, return `stop-archive` (or run `filesStop` regardless of `a.local`) instead of skipping the check.
