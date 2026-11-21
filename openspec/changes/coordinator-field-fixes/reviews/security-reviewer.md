Verdict: approved
Commit: 403b38c5370d0279c75d0c2ad20824c72570e014

## Security audit — coordinator-field-fixes (round 1)

### Findings

Triaged scope: high: guard.mjs, change-loop.mjs, github-setup.mjs, install-schemas.sh, install-kit.mjs, changes-under-way.mjs, deliver-check.mjs, flow-check.mjs; medium: compozy templates (loop.yaml, tech-lead AGENT.md); low: tests, fixtures, docs, plugin.json bumps.

Categories walked: injection, authn/authz/IDOR, exposure, crypto, secret, config.

Discarded false positives:
- injection, install-kit.mjs: `--accept` is checked against the fixed KIT_FILES list, so a path like `../x` is refused with exit 2. `--set` keys must be placeholders from substitutions.json. Values are only substituted into templates, never run as a shell command.
- injection, github-setup.mjs: `headRefOid` and `run.id` come from GitHub's API and go into `gh api` paths through spawnSync arguments, not a shell.
- injection, changes-under-way.mjs: `--owner-answer` is collapsed to one line and cut to 200 characters. It cannot add a `devkit-stage` marker line to approval.md. The file is written with flag `wx`, so it never overwrites an existing approval. The skill owns the owner-answer gate, which is a design decision rather than a new bypass.
- config, guard.mjs `openspecCli`: it runs `node_modules/.bin/openspec --version` and `status` from the project checkout or the main checkout. This only runs code the project already controls, in a session where the project's own hooks already run. It fails secure: a pin that is declared but not installed, or a pinned CLI that is not 2.x, prints a refusal and does not run the status command.
- config, install-schemas.sh: the guard path comes from `dirname $src` and the root from the script's own arguments. Both are passed to node as argv, not interpolated into the script text.
- exposure: the new `gh` and `git` failure messages echo only gh stderr and non-secret repository state. Nothing in the diff prints tokens.
- crypto: sha256 is used in install-kit.mjs only to detect edited files, not as a security control.
- secret: no credential-like files or literals were added.
- authz, github-setup.mjs: the new `blocked` states fail closed. They exit 1 and defer auto-merge when the ruleset is refused. They do not weaken the ruleset or the check requirements.

Removed code: the removed `locateChange(...).archived` filter in `change-loop.mjs` is replaced by `archivedOnDefault`, which is stricter. It takes the union of GitHub, the remote-tracking and local default branches, and the main checkout's working tree. A source that cannot be read adds nothing. This only affects which changes are listed as unfinished and gates nothing for security.

I did not re-run the test suites; I used the results you recorded.
