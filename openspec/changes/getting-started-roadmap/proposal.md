# Proposal

Change: `getting-started-roadmap` · Date: 2026-11-10 · Owner: kaue rodrigues dos santos · Design: n/a (`devkit-lite`) · PRD / tech spec: n/a · Roadmap: `openspec/roadmap.md`, Round 5 ("docs: docs/getting-started.md shows a roadmap round and /conduct")

## Why

`docs/getting-started.md` stops at "start a change and ask Claude to continue it". The roadmap (`openspec/roadmap.md`) and `/conduct` (0.8.0) are documented only in the reference page `docs/openspec-flow.md`, whose two sections ("Grouping changes: the roadmap", "Conducting a round: `/conduct`") are written as row tables for the checker. A new user has no short, concrete picture of what a round looks like and what happens after typing `/conduct`.

## What Changes

- `docs/getting-started.md` gains one short section, after "4. Optional: enforce the flow with OpenSpec" and before "Update", titled `## 5. Optional: run a roadmap round with /conduct`. It holds a worked example and nothing else:
  - a fenced `openspec/roadmap.md` with one round of two changes, each with a description, the second with `(after: <first>)`, both unticked;
  - what `/conduct` then does with them, in order, as a short numbered list: it asks the owner to confirm each new change's schema (proposed from the line's description) before creating its worktree under `.claude/worktrees/<id>`; it plans both changes at once (at most three steps run in parallel); the independent change goes on through implement, review, evidence, PR, merge (per the ship mode), retro and the archive PR that ticks its line; the dependent change, once planned, reads `waiting on <first>` and starts its first `implement` only after that tick lands on `origin/<base>`, after a rebase and a plan audit; the owner is asked only at owner gates (schema, grill and plan approval for `devkit` changes, retro answers); while everything waits on GitHub it leaves one session cron that re-runs `/conduct --wake` every 20 minutes;
  - the shape of the end-of-run report (one `<id>: <state>` line per change, the `round:` line, the `wake-up:` line);
  - links to `openspec-flow.md#grouping-changes-the-roadmap` and `openspec-flow.md#conducting-a-round-conduct` for the full rules.
- Every statement in the section is taken from `docs/openspec-flow.md` and `plugins/openspec/skills/conduct/SKILL.md` as they are on `main`; the section adds no rule and changes no behavior.
- No version bump and no CHANGELOG line: no file under `plugins/` changes and no pack's behavior changes. CONTRIBUTING step 5 bumps "every pack you changed", which is none here; the previous docs-only change outside the packs (`0af3faf`, #11) shipped without a CHANGELOG line. Touching no release file also keeps this change free of release-file conflicts with the other Round 5 changes (`commit-and-pr-trailer` bumps a pack).

Non-goals: changing `docs/openspec-flow.md`, the `conduct` skill, `conduct-check` or `README.md`; adding rows to the "Use the assets" table; documenting `--round`, `--watch`, the JSON output or the release-file rules in the getting-started guide; editing `openspec/roadmap.md` (its line is ticked by the archive step).

## Acceptance criteria

- AC-1: `docs/getting-started.md` has a section, after section 4 and before "Update", containing a fenced `openspec/roadmap.md` with one `## ` round of exactly two unticked changes, one of them declaring `(after: <the other>)`, in the format `docs/openspec-flow.md` "Grouping changes: the roadmap" defines.
- AC-2: The same section says, in order, what `/conduct` does with that round: schema confirmation per new change before its worktree, both changes planned in parallel worktrees, the independent change delivered to archive with its line ticked, the dependent change shown as `waiting on <id>` until the tick is on `origin/<base>` and then rebased and audited before its first `implement`, the owner asked only at owner gates, the 20-minute session cron while waiting on GitHub, and the end report's shape. Each claim matches `docs/openspec-flow.md` and `plugins/openspec/skills/conduct/SKILL.md`, and the section links both reference sections of `docs/openspec-flow.md`.
- AC-3: Nothing else regresses: the existing guard test on `docs/getting-started.md` (per-project wording and the link to `migrate-to-project-scope.md`) still passes, `python3 scripts/check.py` passes (links, language, install scope), and no file under `plugins/`, `.claude-plugin/`, `CHANGELOG.md` or `docs/catalog.md` changes.

## Capabilities

### New Capabilities

None. The repository keeps no canonical specs (`openspec list --specs`: none), and this change is docs-only, so `.openspec.yaml` sets `skip_specs: true`, as every archived change does.

### Modified Capabilities

None (see above).

## Impact

- `docs/getting-started.md`: one new section (about 30 lines).
- Packs, manifests, CHANGELOG, catalog, hooks, tests: unchanged.
- Decisions cited: ADR 0005 (`docs/adr/0005-parallel-steps-and-a-session-wake-up.md`), which the described `/conduct` behavior implements (parallel steps, at most three; one session cron every 20 minutes); ADR 0004 (`docs/adr/0004-devkit-per-project.md`), whose per-project wording in the guide stays as is. No ADR changes.
- Dependencies: `conduct-rounds` (0.8.0), merged on `main` (`4b6f437`). Inherited open decisions: none (the repository keeps no open-decisions log).
