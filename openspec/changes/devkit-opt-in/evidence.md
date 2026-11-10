Commit: 69c42d96c05415a9a1c766834b0a75347adb8db4

# Evidence: devkit-opt-in

## Verification

Fixtures were built in the session scratchpad (`.../scratchpad/fx/{plain,opt,proj}`): `plain` is `schema: spec-driven` with an active change, `opt` is `schema: devkit` with an active change. Nothing was written under `~/.claude` or in other projects, and no `claude plugin` mutation was run. `~/Documents/projects/margi` was only read.

### Gates

The gate chain was run by ship-change at 69c42d9 and is cited, not re-run here (the suite takes about 6 minutes): 421 tests, 421 pass, 0 fail; all checks passed; Validation passed.

| Gate | Command | Result |
|---|---|---|
| hook tests | `node --test plugins/openspec/hooks/guard.test.mjs` | pass: 421 tests, 421 pass, 0 fail (cited from ship-change, exit 0) |
| repo checks | `python3 scripts/check.py` | pass: all checks passed (cited from ship-change, exit 0) |
| catalog | `python3 scripts/gen-catalog.py --check` | pass: catalog up to date (cited from ship-change, exit 0) |
| plugin validation | `claude plugin validate .` | pass: Validation passed (cited from ship-change, exit 0) |

### Acceptance criteria

| AC | Criterion | Proof | Result |
|---|---|---|---|
| AC-1 | Hooks silent outside opted-in projects, destructive git included | Ran `guard.mjs` with stdin JSON in the `plain` fixture: `session`, `bash` with `git push --force origin main`, `git reset --hard` and `gh pr create --title t` each gave exit 0 and empty stdout and stderr. Same inputs in the `opt` fixture: `session` printed the `[devkit] Active OpenSpec change` line, and the three bash commands exited 2 with the force push, reset --hard and review-not-approved messages. Plus the guard tests (gate above). | pass |
| AC-2 | Plain OpenSpec project: no `[devkit]` line, gate-file writes and `gh pr create` not blocked | In the `plain` fixture with an active change: `session` printed nothing; `edit` Write to `openspec/changes/x/evidence.md` and `readiness.md` exited 0 silently; `gh pr create` exited 0. Read-only `session` against `~/Documents/projects/margi` (`schema: spec-driven`, no active change) exited 0 with no output. | pass |
| AC-3 | Opted-in project: current gates unchanged | In the `opt` fixture: destructive git exit 2, writes to `evidence.md` (pr-verifier only) and `readiness.md` (plan-readiness-reviewer only) exit 2, PR gate exit 2 (missing reviewers). The existing guard tests pass in the gate above. | pass |
| AC-4 | Docs teach per-project install, not user scope, and say why | Every `claude plugin install` line in `README.md`, `docs/getting-started.md` and the five pack READMEs carries `--scope project` (grep found none without `--scope`). `README.md:40` says the packs load only in the projects that chose them. `docs/getting-started.md` shows the `.claude/settings.json` snippet and links the migration doc. Judgment: the "why" sentence is in the root README and the openspec README line 31, not repeated in every pack README. `scripts/check.py` (gate) refuses user-scope install lines. | pass |
| AC-5 | `openspec-setup` writes/updates project settings keeping other keys; schemas install into the project by default; machine-wide only on request | `project-settings.mjs <fixture>` on a settings file holding only `permissions` printed add/enable/enable/update and the file kept `permissions` and gained `extraKnownMarketplaces.devkit` and both `enabledPlugins`. `install-schemas.sh` with no argument in the `proj` fixture (HOME and XDG_DATA_HOME pointed at temp dirs) installed `devkit` and `devkit-lite` under `proj/openspec/schemas/`, validated, and left the temp XDG dir empty. `install-schemas.sh --user` installed into `$XDG_DATA_HOME/openspec/schemas`. | pass |
| AC-6 | This repo has a committed `.claude/settings.json` opting into devkit-core and devkit-openspec | `.claude/settings.json` is tracked (clean in `git status`) and holds the marketplace and both `enabledPlugins`. `project-settings.mjs . --dry-run` reported `file: unchanged`. | pass |
| AC-7 | Migration doc with four items (command, check, undo; owner's yes per item); machine state after the owner's migration | Doc half: `docs/migrate-to-project-scope.md` (132 lines) has Preconditions, items 1 to 4 and a Final check, and states that an item runs only after the owner's yes and an agent never runs one; it is linked from `README.md:69` and `docs/getting-started.md:26`; its format test is in the guard suite (gate above). Machine-state half (`claude plugin list` with no user-scope devkit pack, a new session in margi with no `[devkit]` line): deferred per design Q2, to be recorded in `retro.md` after the merge. No migration command was run here. | pass for the doc; machine state deferred to retro.md (design Q2), not a failure |
| AC-8 | Versions bumped in plugin.json and marketplace.json, CHANGELOG line, validate and catalog pass | `plugin.json`: openspec 0.7.0, core 0.5.1, design/stack/ai-engineering 0.1.1. `marketplace.json`: metadata 0.7.0 and the five pack entries match. `CHANGELOG.md` has "## 0.7.0 — devkit per project" with a line per pack. `claude plugin validate .` and `gen-catalog.py --check` pass (gates above). | pass |

Outcome: verified. No defect found.
