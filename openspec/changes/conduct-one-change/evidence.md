Commit: ace7ac08536e0fd6fb4ce400116ca7c712ab284a

# Evidence: conduct-one-change

Verified at HEAD ace7ac0 (uncommitted changes only under `openspec/changes/conduct-one-change/reviews/` and `review.md`, outside the code). No PR exists yet.

## Verification

### Gates

| Gate | Command | Result |
|---|---|---|
| 1.9 | `node --test plugins/openspec/hooks/conduct-check.test.mjs` | pass: 397 tests, 397 pass, 0 fail |
| 1.9 | `python3 scripts/check.py` | pass: all checks passed |
| 2.9 | `node --test plugins/openspec/hooks/guard.test.mjs` | pass: 568 tests, 568 pass, 0 fail (full suite, run once) |
| 2.9 | `python3 scripts/check.py` | pass: all checks passed |
| 3.9 | `node --test plugins/openspec/hooks/guard.test.mjs` | pass: 568 tests, 568 pass, 0 fail (same run) |
| 3.9 | `python3 scripts/check.py` | pass: all checks passed |
| 3.9 | `python3 scripts/gen-catalog.py --check` | pass: exit 0, no drift |
| 3.9 | `claude plugin validate .` | pass: Validation passed |
| 3.9 | `openspec validate conduct-one-change --strict` | pass: change is valid (skip_specs, zero deltas) |

### Acceptance criteria

| AC | Criterion | Proof | Result |
|---|---|---|---|
| AC-1 | `--change <id>` reports mode change, one row, round null | Live: `conduct-check.mjs --json --change conduct-one-change` exit 0, `version 2`, `mode "change"`, `change "conduct-one-change"`, `round null`, 1 row with id, next (`verify`), state, sessionPrefix `conduct-one-change-p`. Round mode live (`--round 6`): `mode "round"`, `change null`. `--change X --round 1` exit 3 `--change and --round do not combine`. `DEVKIT_HOST=app` run: change is at `verify`, so no `session` descriptor live; the `session` at `implement`, parity with round mode and the roadmap-less repo are covered by conduct-check.test.mjs (397 pass). | pass |
| AC-2 | Existence check, exit-3 prefixes, archived, watch | Live: `--change nope-nope` exit 3, error starts `no change nope-nope:` and names `openspec new change`; `--change conduct-sessions` (worktree on `chore/archive-conduct-sessions`) exit 0, `next.step "archived"`, reason `2026-11-10-conduct-sessions is on main`. The `worktree without a folder`, `on another branch` prefixes (with `git switch -c`), unchanged worktree rows and `--watch` are covered by conduct-check.test.mjs (397 pass), not run live. | pass |
| AC-3 | `unfinished` on every change row, version 2 | Live: row carries `unfinished: null` (clean worktree) in change mode; `version` 2. Round 6 has no open rows, so the round-mode row was not seen live. Dirty/phases/summary and both modes are covered by conduct-check.test.mjs (397 pass). | pass |
| AC-4 | SKILL.md single-change mode first, `--change` on every call, bare `/conduct` lists, Never | Skill-text pins: `node --test --test-name-pattern="conduct SKILL.md\|README\|ADR\|pin in docs" guard.test.mjs` 25 tests, 25 pass; full suite 568 pass. | pass |
| AC-5 | Single-change steps are 0.9.0's | Existing skill-text pins stay green (same runs: 25/25 and 568/568). | pass |
| AC-6 | Unfinished work reported first, only at a typed start | Skill-text pin green (same runs). Live proof is the dogfood, pending after the merge. | pass |
| AC-7 | Missing change: one question, create only on answer; stop on another branch | Skill-text pin green (same runs). | pass |
| AC-8 | ADR 0007, 0006 amended, config, READMEs/flow, CHANGELOG, versions, pin, catalog, roadmap | `docs/adr/0007-one-change-on-request.md` has Context, Decision, Consequences, `### Review trigger`, Alternatives considered. ADR 0006 keeps `- Status: accepted` and has `- Amended by ADR 0007`. `openspec/config.yaml` lists 0007. Both manifests 0.10.0 (`plugins/openspec/.claude-plugin/plugin.json`, devkit-openspec in `.claude-plugin/marketplace.json`). `## 0.10.0 — one change on request` in CHANGELOG. `docs/openspec-flow.md` pins `v0.10.0`. `gen-catalog.py --check` exit 0. `git diff origin/main -- openspec/roadmap.md` adds `## Round 7: one change on request` with the `conduct-one-change` line. `grep -rn "conducting-a-round-conduct" --include='*.md' . \| grep -v tasks.md` is empty. README/flow wording is covered by the README/pin-in-docs tests (25 pass). | pass |
| AC-9 | Gate commands pass; post-merge dogfood in `retro.md` | All gate commands above pass. The post-merge dogfood (`/conduct <id>` recorded in `retro.md` `## Dogfood`) is pending until the merge and not proven here. | verified |
