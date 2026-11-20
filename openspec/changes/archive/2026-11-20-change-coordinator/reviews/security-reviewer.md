Verdict: approved
Commit: c45c6b6467d7d3a3bce4efafd1eca890cc587a14

## Security audit — change-coordinator (round 2)

### Findings
- [nit] plugins/openspec/hooks/change-loop.mjs (recordFile, refuseOnce) — Round 1 nit: the refusal record sits at a predictable path under os.tmpdir()/devkit-stop and is written with a plain writeFileSync. A symlink would need a guessed session id, so it is not exploitable. Still open as a nit, unchanged by 2d48034.

Verdict: approved

Triaged scope: high — plugins/openspec/hooks/guard.mjs (`runOf`), plugins/openspec/hooks/change-loop.mjs (`agentDecision`, `PACKS`, the `openChange` rollback, `failure`, `loopOutput`, `runReply`, `stopDecision`). Low — SKILL.md, docs, ADR 0008, CHANGELOG, tests.

Categories walked: injection, authn/authz/IDOR, exposure, crypto, secret, config.

Discarded false positives:
- authz (stop lock accepts `devkit-end: <id> <state>` from any tool result at line start): a file or PR text the session reads could carry such a line and let the session stop. It only loosens a workflow nudge (ADR 0011 fail-open) and grants no access. The product-code, PR and destructive-git guards in guard.mjs do not read this field. The `devkit-run:` line has the same property and was judged in round 1. The end id is not compared with the run's id, which changes nothing about the impact. Not exploitable.
- authz (agent lock): the pack check is stricter than before. A missing or blank type is now refused, where it was allowed. `evil:tdd-implementer` fails because `PACKS[role]` must equal the prefix. A leading-space type matches no role, so it is refused. It fails closed and there is no bypass.
- injection (rollback path): `NAME` is `^(?=.{2,48}$)[a-z0-9]+(?:-[a-z0-9]+)*$`, JS `$` has no trailing-newline allowance, and `id === 'archive'` is refused. The worktree path is `join(main, '.claude/worktrees', id)`, so it cannot traverse. `nameTaken` also rules out a pre-existing folder, and the cleanup runs only after this call's own `worktree add` succeeded. So `rmSync(recursive, force)` can only remove the folder this call created. Git calls use `execFileSync` arrays with no shell.
- exposure (`failure` reply): the raw error message now stays out of `reply` and appears only in `error` and stderr, which is an improvement. Non-refusal errors render the fixed `request-unreadable` text.
- exposure (`runReply` `devkit-end` line): it prints `params.id`, a caller-supplied value, to the caller's own stdout. It holds no secret and nothing parses it beyond the regex `[A-Za-z0-9][\w.-]*`.
- injection (regex in `runOf`): the new alternation is anchored and linear, with no nested quantifiers, so it is not a ReDoS concern. `ended` resets on a new command and on a new `devkit-run:` line.
- config: the locks keep failing open on an unreadable transcript or an error, as ADR 0011 documents. The end-recorded allow is in the same family.
- crypto and secret: nothing touched; no secret-looking file in the range.

Re-review of previous findings: the only round-1 finding is the nit above, still open as a nit. There were no `blocking` or `important` findings in round 1.

Out-of-round: none.

Files read: /Users/kauesantos/Documents/devkit/.claude/worktrees/panel-conduct-view-404c57/openspec/changes/change-coordinator/reviews/security-reviewer.md; the diff 551ee63..HEAD of plugins/openspec/hooks/change-loop.mjs and plugins/openspec/hooks/guard.mjs; plugins/openspec/hooks/change-loop.mjs lines 725-775 (`nameTaken`, `openChange`).
