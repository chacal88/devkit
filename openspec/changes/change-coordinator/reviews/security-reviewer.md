Verdict: approved
Commit: 551ee6383b99eabd4589e6154ba08c730ad9748b

## Security audit — change-coordinator (round 1)

### Findings
- [nit] plugins/openspec/hooks/change-loop.mjs:841-850 (recordFile, refuseOnce) — The refusal record is written to a predictable path under os.tmpdir()/devkit-stop with a plain writeFileSync. On a shared /tmp (Linux) a local user could pre-plant a symlink there, but they would also have to guess the session id, so it is not exploitable as it stands.

Verdict: approved
Commit: 551ee6383b99eabd4589e6154ba08c730ad9748b

## Security audit — change-coordinator (round 1)

Triaged scope: high — plugins/openspec/hooks/guard.mjs, hooks.json, change-loop.mjs (start, open, script, wait, the three locks), skills/devkit/SKILL.md. Medium — the settings readers, the panel hooks, the agents' skills lists. Low — documents, ADRs, tests, changelog.

Categories walked: injection, authn/authz/IDOR, exposure, crypto, secret, config.

Discarded false positives:
- injection (free text in the shell): the request travels through a quoted heredoc (`<<'DEVKIT_ARGS'`) and is read from stdin. It is only written into requirements.md as a Markdown quote, and never reaches a command line.
- injection (change id into git, openspec and a worktree path): `openChange` enforces `^[a-z0-9][a-z0-9-]{1,47}$`, refuses `--` and `archive`, and passes arguments through `execFileSync` with no shell. A leading dash is impossible and the path join cannot traverse.
- injection (id from the transcript `devkit-run:` line): the regex `^[A-Za-z0-9][\w.-]*$` allows no slash and no leading dash or dot. The text comes from the session's own transcript, and forging the line can only switch a lock on (stricter), never off.
- injection (`next --change` / `wait --change` unvalidated): the caller is the owner's own session, which already has shell access. This is not a privilege boundary, and the same trust held before the diff.
- authz (transcript_path from the hook input): the harness supplies it, and it is only read. An unreadable file or one with no run gives allow, which is the intended fail-open of ADR 0011. The hooks that block product edits and PRs are unchanged.
- authz (removed `conduct` skill): it carried no enforcement. The guards (readiness, review and evidence before a PR, destructive git) stay in guard.mjs.
- exposure (DEVKIT_HOOK_LOG): it is set only by the user's own environment. The record holds the session id, agent type, change id, decision and reason, with no secrets or request text.
- exposure (refusal record): it holds only a progress key. The file name is sanitized by `safeName` (`[^\w.-]` replaced, 120-character cap), so there is no path injection through session_id or agent_id.
- config (locks fail open): this is a documented design decision (ADR 0011 and D-8). The code-edit lock fails open only when the record is unreadable, and the existing readiness gate still applies to product code.
- config / exposure (`wait` through gh): it uses `makeGh` with an argument array and a cleaned environment, with a clamped interval and no secret output.
- crypto and secret: nothing touched, and no secret-looking file is staged.

Out-of-round: none.

Files read: plugins/openspec/skills/devkit/SKILL.md; the diff of plugins/openspec/hooks/guard.mjs and hooks.json; plugins/openspec/hooks/change-loop.mjs (start, open, script, next, wait, the locks and the command line).
