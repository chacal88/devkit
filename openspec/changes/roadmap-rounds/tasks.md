# Tasks

## 1. Roadmap in the session hook

- [x] 1.1 Tests first in `plugins/openspec/hooks/guard.test.mjs`: a `repo()` option to write `openspec/roadmap.md`; cases for the current round and `done/total`, each of the four states (`not started`, `open`, `archived, tick it` via `changes/archive/2026-01-01-<id>`, `waiting on <ids>`), all rounds ticked, no roadmap (output unchanged), no active change and several active changes (roadmap still printed) (AC-1, AC-2)
- [x] 1.2 Tests that `edit`, `bash` and `ci` give the same exit code with and without a roadmap, and that a malformed roadmap (no `##` headings, junk lines, unknown ids, `after:` on a missing id) exits 0 in `session` (AC-3)
- [x] 1.3 In `guard.mjs`: an exported `readRoadmap(root)` that parses rounds, items, ticks and `after:` lists, skipping anything it does not recognise, and a `roadmapReport(root)` that renders the current round; `session()` prints it after the change block whether the change is active, ambiguous or absent. Wrapped so any error prints nothing
- [x] 1.9 Gate: `node --test plugins/openspec/hooks/guard.test.mjs` green; covers AC-1, AC-2, AC-3

## 2. Docs and release

- [x] 2.1 `docs/openspec-flow.md`: section "Grouping changes: the roadmap" with the format, how the current round is chosen, the four states, and that it never blocks; one line in Limits (it reports, it does not enforce order) (AC-4)
- [x] 2.2 `plugins/openspec/README.md`: extend the session-start row of the hooks table (AC-4)
- [x] 2.3 `plugins/openspec/skills/openspec-setup/templates/config.yaml`: archive guidance line to tick the change in `openspec/roadmap.md` when the file exists; same line in this repo's `openspec/config.yaml` (AC-4)
- [x] 2.4 Bump devkit-openspec to 0.3.0 in `plugins/openspec/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`; CHANGELOG entry; pin `v0.3.0` in the CI snippet of `docs/openspec-flow.md`
- [x] 2.9 Gate: `node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py && git diff --exit-code docs/catalog.md && claude plugin validate .` green; covers AC-4
