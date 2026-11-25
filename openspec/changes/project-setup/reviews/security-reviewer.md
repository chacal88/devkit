Verdict: approved
Commit: 02e67807136fa670f73202efc2601e0f3b1936c0

## Security audit — project-setup (round 1)

### Findings

Triaged scope:
- High: plugins/openspec/skills/devkit/scripts/setup-block.mjs (new writer of openspec/config.yaml), plugins/openspec/skills/devkit/scripts/kit-installer.mjs (new resolver that spawns devkit-compozy's install-kit.mjs), plugins/openspec/hooks/change-loop.mjs (new `setup` verb that skips projectGate), plugins/openspec/skills/devkit/SKILL.md (new Setup section that runs github-setup, project-settings and the kit installer), the removed SKILL.md files of plugins/openspec/skills/openspec-setup and plugins/compozy/skills/compozy-setup, .github/workflows/ci.yml, plugins/openspec/hooks/merge-setup.mjs (SETUP_POINTER and withoutSetupPointer).
- Medium: plugins/openspec/hooks/project-loop.mjs and train-loop.mjs (pointer stripping now goes through the shared helper), the renamed kit and setup scripts (diffed against their old paths: only path constants and message text changed; project-settings, github-setup, gh-version, ship-entry, install-schemas and devkit-reviews.yml are byte-identical), templates/config.yaml (comments only), plugins/compozy/kit/templates/substitutions.json (prose only).
- Low: docs, ADR 0030, CHANGELOG, catalog, the openspec/changes/project-setup folder and its proof files, generated AGENT.md files (one header line each; `permissions: approve-all` is pre-existing and unchanged), .compozy/kit-manifest.json digests, test files. These were checked by diff stat and by a secret-pattern scan of every added line in the range.

Categories walked: injection, authn/authz/IDOR, exposure, crypto, secret, config.

- Injection: setup-block.mjs takes the owner's answers on stdin through a quoted heredoc (`<<'DEVKIT_SETUP'`, one JSON object on one line, so no shell expansion and no early terminator). It refuses unknown keys and checks values: language against LANGUAGE_TAG, driver/ship/merge_method against option lists, tests.* through isText (one line, written with JSON.stringify), coverage.target as a whole number 0-100, release_tag through releaseTagSetting. The test-command proposals are fixed strings built from a fixed script-name list, never copied from package.json script bodies. kit-installer.mjs spawns `process.execPath` with an argument array, no shell. The installer path comes from the sibling pack or from the user's own plugins folder ($CLAUDE_CONFIG_DIR or $HOME), never from the project.
- Authn/authz: the `setup` verb skips projectGate by design (D-1). It returns only a `root`, and no hook reads the `setup` mode, so no guard or write lock is loosened. The skill keeps `disable-model-invocation: true`. The GitHub step still applies only the items the owner confirmed. The rules of the removed openspec-setup skill (no commit, nothing at user scope, per-item GitHub confirmation, never overwrite config.yaml) carry over into the devkit skill's Never list. The compozy-setup rule (write only `.compozy/`) is still stated for the installer, which is unchanged.
- Exposure: the new error messages print paths and error codes only; no tokens or credentials.
- Crypto: none touched.
- Secret: no credential patterns among the added lines; no secret-looking file in the range. fixtures/old-setup/settings.json holds only a marketplace name and plugin flags.
- Config: ci.yml changes only two script paths. No fail-open default added.

Tests: setup-block.test.mjs and kit-installer.test.mjs ran once, with --concurrency=3 and TMPDIR=/var/tmp/devkit-project-setup, while no other suite was running: 2 files, 22 tests, 22 pass.

Discarded false positives:
- injection: config values such as `delivery.base` are written into YAML unquoted, so a value like `a: b` can break the file. The only source is the owner's own answer, so there is no trust boundary; at worst the loop refuses a malformed setting. Not a security issue.
- injection/file write: setup-block.mjs writes a predictable temp file (`config.yaml.setup-<pid>.tmp`) with writeFileSync, which follows symlinks. A hostile repository could plant symlinks for the likely PIDs. But that attacker already gets code execution through the same setup: step 5 runs the repository's own test command, and step 1 prefers the project's node_modules/.bin/openspec. The symlink adds no new capability.
- authz: kit-installer.mjs picks the highest-version devkit-compozy under the plugins folder. A plugin installed there can already run code through its own hooks, so choosing its installer crosses no boundary.
- authz: skipping projectGate for `setup` lets it run with broken settings, which is what lets setup repair them. It reaches no product-code write and no merge, so nothing to exploit.

Out of round: none.
