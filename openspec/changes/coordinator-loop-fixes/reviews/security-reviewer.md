Verdict: approved
Commit: 9eaef847377372376ef25eb7a8f400d0e3ccf619

## Security audit — coordinator-loop-fixes (round 2)

### Findings
- [nit] plugins/openspec/hooks/guard.mjs:745 — DECLARE_CALL needed the script path right after `node`, so `node --no-warnings <path>/change-loop.mjs declare ...` and `node -- <path>` passed declareViolation for a subagent; allow node option words before the path. · fixed in 66f3553
- [nit] plugins/openspec/hooks/guard.mjs:746 — DECLARE_CALL still misses a node option that takes a separate value (`node -r ./x.cjs <path>/change-loop.mjs declare`, `--require x`) and a variable path (`P=...; node $P declare`), probed false for tdd-implementer; a forged record only lifts the review ceiling or records a red gate (never approves a review or opens a gate), so this is a follow-up: skip one value word after -r/--require/--import/--loader.
- [praise] plugins/openspec/hooks/change-loop.mjs:3303 (runDeclare --stdin words); plugins/openspec/skills/ship-change/SKILL.md:60; plugins/openspec/skills/devkit/SKILL.md:151 — The owner's words for declare review-round now travel on standard input through the quoted heredoc instead of a double-quoted --param, closing the path where a backtick or $(...) in the words would run in the main session's shell; T144 and the verifier's real ver-r7s run prove no command in the words ran.

Triaged scope:
- High: plugins/openspec/hooks/guard.mjs (DECLARE_CALL widened to skip node option words), plugins/openspec/hooks/change-loop.mjs (runDeclare gains `--stdin words`; withStdinParam factored out of runReply; isMain reads stdin for `declare --stdin`).
- Medium: plugins/openspec/skills/devkit/SKILL.md and ship-change/SKILL.md (the deadlock's declare now passes the owner's words through the quoted heredoc `<<'DEVKIT_ARGS'` and its terminator rule), docs/adr/0023 and 0032 (header line, dated Note), docs/compozy-kit.md.
- Low (scanned for secrets and personal data across every added line of the range): guard.test.mjs, change-loop-declared.test.mjs, conduct-check.test.mjs, design.md, specs/, evidence.md, review.md, reviews/*, proof/ver-r7s-* and checks.txt, the merged suite-socket-path archive retro, openspec/trains/18.md, CONTRIBUTING.md.

Categories walked: injection, authn/authz/IDOR, exposure, crypto, secret, config

Discarded false positives:
- injection (`declare --stdin` names another parameter) — runDeclare refuses any valid name other than `words`, and withStdinParam refuses an invalid name, a name also given by --param, and an empty input; each is exit 3 and nothing is recorded (T145). The words are still cut to 200 characters, have their backticks replaced (`words.slice(0, 200)`, line 3009's sanitizer) and are JSON-serialized into declared.json; they never reach a shell.
- injection (an owner line equal to `DEVKIT_ARGS` ends the heredoc early) — the devkit skill's terminator rule (SKILL.md:34) picks `DEVKIT_ARGS_<digits>` when a line equals the terminator, and the words are the owner's own typed message, not attacker input.
- authz (a subagent hides the declare inside a heredoc) — declareViolation strips only heredoc bodies; the command line before `<<` still matches (probed true for `node --no-warnings p/change-loop.mjs declare f review-round --stdin words <<'X'`).
- exposure (proof/ver-r7s-turn1.jsonl lists the owner's MCP connector tool names) — connector and tool names are not credentials. Round 1's proof files and archived proofs on origin/main already hold the same init event. The new proof files have no home path, email or token: a pattern grep over every added line of the range found none, and `cwd` is scrubbed to `<scratch>/proj`.
- secret — no secret-looking file in the range; no key, token or credential pattern in any added line.
- config — no config or schema edit in this range.

Removed code checked: runReply's inline --stdin block moved into withStdinParam with the same checks (name regex, duplicate with --param, empty input), so reply's validation is unchanged. The old DECLARE_CALL is a strict subset of the new one, so every command refused before is still refused (T98-T100 green). The skills' `--param words="<their words>"` instruction is removed in favour of the heredoc, which is safer.

Tests run (foreground, no other suite running): `node --test --test-concurrency=3 --test-name-pattern='coordinator-loop-fixes AC-1 T9|coordinator-loop-fixes AC-1 T100|AC-7 T14[345]' guard.test.mjs change-loop-declared.test.mjs` with TMPDIR=/var/tmp/devkit-coordinator-loop-fixes GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main: 7 tests, 7 pass, 0 fail (T98, T99, T100, T143, T144, T145 and T147, which the name pattern also matched). Plus a node -e check of declareViolation on five commands; no file written in the repository.
