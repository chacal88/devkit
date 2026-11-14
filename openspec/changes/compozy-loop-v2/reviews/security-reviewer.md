Verdict: approved
Commit: e10b21d46af3cc79a5977063f55fa74776073875

## Security audit — compozy-loop-v2 (round 1)

Triaged scope:
- High: `plugins/compozy/skills/compozy-setup/templates/bin/devkit-kit` and its deployed copy
  `.compozy/bin/devkit-kit` (shell resolver, `exec node`), the loop templates
  (`plugins/compozy/skills/compozy-setup/templates/loops/openspec-change/loop.yaml` and
  `.compozy/loops/openspec-change/loop.yaml`, shell interpolation into gate `check:` commands).
- Medium: `plugins/compozy/skills/screen-design/scripts/screens-check.mjs` (config-driven file
  path, CLI arg parsing), `plugins/compozy/skills/screen-demo/scripts/evidence-names.mjs` (pure
  path naming, no I/O).
- Low: AGENT.md role files, `config.toml`, `substitutions.json`, `plugin.json`,
  `marketplace.json`, docs, tests.

Categories walked: injection, authn/authz/IDOR, exposure, crypto, secret, config.

Discarded false positives:
- injection/config — `devkit-kit`'s walk-up (`find_repo_checkout`) and plugins-directory search
  (`find_installed`) can in theory be won by a `plugin.json`/`<subcommand>.mjs` planted in an
  ancestor of `$PWD` or under `$CLAUDE_CONFIG_DIR/plugins`, but both require the attacker to
  already have write access to a directory above the developer's own checkout or to the
  developer's local Claude plugins cache — out of scope per the stated threat model (local
  dev-tooling, not a multi-tenant service). The `find ... | while IFS= read -r pj` loop and
  `json_field`'s sed extraction are read-only, quoted throughout (`"$pj"`, `"$proot/$rel"`,
  `"$root"`), and the `ver_cmp`/`path_gt` helpers only compare already-captured strings — no
  word-splitting or glob expansion on attacker-influenced data was found under `set -eu`.
- path traversal — `screens-check.mjs`'s `design.screen_map` (from `openspec/config.yaml`) is
  `join(root, design.screen_map)` with no containment check, so a `screen_map: ../../../etc/foo`
  value can make the checker read a file outside the project root. This is committed project
  configuration, not externally supplied input reachable by an unauthenticated actor, and nothing
  in this diff adds a new channel for an attacker to control that value without already having
  write access to the repository (at which point they could replace any script directly). The
  `--change` CLI argument itself is validated against `^[A-Za-z0-9][\w.-]*$` and explicitly
  rejects `.`, `..` and `archive`, so no traversal is reachable through the one argument an
  external caller supplies.
- fail-open on exit code — traced `compute()` in `screens-check.mjs` end to end: missing
  `design:` block or an empty `## Screens` list are documented, intentional no-ops (`pass: true`);
  every other setup problem (`screen_map` unset, target missing or unreadable) throws `UsageError`
  (exit 3, not a silent pass); the real pass/fail (`missing.length === 0 && mapMockupOk`) is
  computed from the parsed map with no path that forces `pass: true` while screens are actually
  unmapped.
- command injection — read every `check:` line in both `loop.yaml` copies (6 gate criteria plus
  the loop-level `verification` entry). Every interpolated value
  (`.inputs.change_id`, `.inputs.verify_command`, `.nodes.design.output.worktree_path`,
  `.nodes.implement.output.worktree_path`, `.nodes.deliver.output.pr_url`) is piped through
  `| shellQuote` and none of those interpolations sit inside an author-written quote (they are
  concatenated as standalone shell words, e.g. `-{{ ... | shellQuote }}$`,
  `b={{ ... | shellQuote }}`, `sh -c {{ .inputs.verify_command | shellQuote }}`), matching the
  project's interpolation rule. `.inputs.verify_command` is an operator-level loop input (a test
  command the project owner configures), not data from an agent's structured output, so routing it
  through `sh -c` after `shellQuote` is the intended design, not an injection sink. The same
  `shellQuote` convention was already in place in the version-1 loop before this diff.

### Findings (TRUE POSITIVE)

None.

No exploitable defect survived the false-positive filter. I inspected the new shell resolver
(`devkit-kit`, both the template and the deployed copy, plus its pinning tests in
`devkit-kit.test.mjs`), the config-driven file read and CLI parsing in `screens-check.mjs` (plus
`screens-check.test.mjs`), every `check:` line and interpolation in both `loop.yaml` copies, the
new AGENT.md role grants (`approve-all`, unchanged from version 1, with the stated rationale that
the Loop gates and devkit hooks hold the oversight), `config.toml`, `substitutions.json`,
`plugin.json` and `marketplace.json` for hardcoded secrets or insecure defaults, and
`evidence-names.mjs` (pure path-naming, no I/O or shell sink). No injection, authz bypass, data
exposure, weak crypto, hardcoded secret or fail-open config was found introduced by this diff.
