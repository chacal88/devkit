Verdict: rejected
Commit: e497cc29002c8cda9fdddbe2c945f7ed95e65479

## Security audit - archive-after-merge (round 1)

Triaged scope: high: plugins/openspec/hooks/deliver-check.mjs, guard.mjs, merge-setup.mjs, ship-change/SKILL.md, ADR 0003; medium: retro skill, commit-and-pr/tdd-implementer agent edits; low: docs, tests, version manifests.
Categories walked: injection, authn/authz/IDOR, exposure, crypto, secret, config
Discarded false positives:
- injection (gh/shell) - ids are validated `^[\w.-]+$` (locateChange, selectCiChange); gh and git run through execFile argument arrays; `ref` is encodeURIComponent'd; git refuses branch names starting with `-`; base comes from the GitHub API.
- authz (CI bypass via branch `chore/archive-<archived-id>`) - selectCiChange still returns "none" only when the PR touches no active change folder; the old code did the same for any PR touching none (pre-existing, not widened by this diff).
- authz (path matching in unnamedFiles) - exact match after stripping leading `./`; `docs/../x` or directory/glob targets fail closed; renames and deletions are included (`--no-renames`, `-z`).
- authz (`.claude/` filtered in changedInTree) - applies to uncommitted files only; committed `.claude/` paths stay in the diff and hit unnamedFiles.
- config (retro.md self-answered `Answer: approved`) - the owner-answer gate is agent-honored by design (ADR 0003 accepted); not a code defect.

### Findings (TRUE POSITIVE)
- [blocking] [authz] plugins/openspec/hooks/deliver-check.mjs:866-885 vs 908-910 - the P13 exact-path file check (`unnamedFiles`) runs only after the `pr?.state === 'OPEN'` block, which returns first, so an open archive PR is auto-merged with no file check at all.
  - Exploitability: source = any commit on `chore/archive-<id>` after its PR exists (a second commit adding `plugins/**/hooks/*.mjs`, a workflow, or a stray file; or a PR opened by hand). Trace: archivePrFacts finds the OPEN PR -> archiveNext enters the OPEN branch; headRel 'ahead' or uncommitted yields `open-archive-pr` ("commit and push", no file check, lines 880-882), the next run has headRel 'same' and reaches `enable-auto-merge` (line 885) -> `gh pr merge --auto --match-head-commit`. `a.changed`/`unnamedFiles` are read only at lines 908-910, reachable only when no archive PR exists. CI passes "nothing to check" on that branch (selectCiChange), so unreviewed code reaches main. This contradicts the guarantee stated in ADR 0003 (Decision: auto-merge only when "no changed file outside openspec/ that an owner-approved retro proposal does not name"). The same early return skips the retro answer/applied rows, so an OPEN PR also merges with unanswered or rejected proposals.
  - Fix: compute `unnamedFiles(a.changed.paths, proposals)` (and the unanswered-proposal check) before the OPEN-state branch, or gate `enable-auto-merge`/`archive-pr-ready` on it and fall to `disable-auto-merge` when it fails; load `changed` whenever a PR exists, not only on the P13 path.
- [important] [authz] plugins/openspec/hooks/deliver-check.mjs:744 (`isOpenspec` exemption in unnamedFiles) - every path under `openspec/` is exempt, including `openspec/config.yaml` (schema, ship, merge_method) and any custom schema; an archive PR can weaken the gates of later changes with no named proposal and no review. Not independently blocking while the exemption is limited to the retro-approved flow, but restrict it to `openspec/changes/**` and `openspec/roadmap.md`.
