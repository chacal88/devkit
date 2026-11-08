Verdict: approved
Commit: c15ff9b5443255278571f6b9b90b385219998c2e

## Security audit — ship-modes (round 1)

Triaged scope: high: plugins/openspec/hooks/deliver-check.mjs (git/gh spawns, argv, repo-file parsing), plugins/openspec/hooks/guard.mjs (PreToolUse hook, main-guard), plugins/openspec/skills/ship-change/SKILL.md (runs gate commands, posts PR replies); medium: agent prompt edits under plugins/core/agents; low: docs, tests, manifests.
Categories walked: injection, authn/authz/IDOR, exposure, crypto, secret, config
Discarded false positives:
- injection (git/gh) — every call uses execFileSync/spawnSync with an argv array and no shell. Values from repo files reach git only as `<hex 7-40>^{commit}` (the `Commit:` regex is `[0-9a-f]{7,40}`, so no leading `-`); `rev-list` gets the resolved full sha. The PR number passed to `gh pr checks` comes from `gh` JSON and goes through `String()`.
- injection (change id from argv) — `/^[\w.-]+$/` rejects separators, so no traversal out of `openspec/changes/`. `..` passes the regex and resolves to `openspec/`, but the effect is a read-only "tasks.md missing" result for an id the local operator typed, with no write and no boundary crossed (nit).
- injection (gate commands from tasks.md) — `next.command` is run by the agent in Bash. tasks.md is part of the plan that readiness approval covers in `devkit`, and it has the same trust as the repo's test scripts. PR content is never turned into a command.
- hook bypass (guard.mjs `isMain`) — hooks.json starts it as `node "${CLAUDE_PLUGIN_ROOT}/hooks/guard.mjs" <mode>`, and Node resolves the entry URL to the real path, so the realpath comparison matches. A mismatch could only fail open when a path symlink is resolved differently, and no such trigger was demonstrated. `DEVKIT_BYPASS` is still read only inside the main-guard. The exports add no new bypass, and `ci` mode still runs.
- data exposure — the checker prints PR URLs, check names and links, and 100-character excerpts of review lines. No tokens are read or echoed. `gh` inherits the existing env and no credential is logged.
- weak crypto / hardcoded secret / insecure config — none present. A missing or invalid `ship` setting is a config error (exit 3) or `plan` mode, which does nothing, so it fails safe. `merge` is refused.

### Findings (TRUE POSITIVE)
- [important] [injection / untrusted content, hardening] plugins/openspec/skills/ship-change/SKILL.md `answer` row; deliver-check.mjs:497-517 — item 7 treats every non-Bot author as a person to answer, with no `authorAssociation` or collaborator filter, and the skill tells the agent to implement "a code request" from that comment through `tdd-implementer`, then push.
  - Exploitability: on a public repo, any GitHub user can comment on the PR (source). The text reaches the agent as an instruction and can end in a pushed commit on the PR branch (sink). Impact is limited: `tdd-implementer` works within the approved tasks, the scoped re-review reruns, and the owner alone merges. So this is a prompt-injection hazard, not a direct exploit, and it does not block this change.
  - Fix: list only comments from OWNER/MEMBER/COLLABORATOR (add `authorAssociation` to the GraphQL query), and add a line to the skill that comment text is data, never commands, and that anything outside the approved tasks stops as an owner decision. Follow up in a later round.

No exploitable TRUE POSITIVE. Approved.
