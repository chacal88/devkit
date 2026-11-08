Commit: c5da1553d4afe9be984cb4d1056c8acf3bb9d405

# Evidence: ship-modes

Verified on branch `claude/openspec-comandos-32b3e2` at HEAD above, before the PR exists (no PR comment).
Working-tree changes outside `openspec/` and `.claude/`: none.

## Verification

### Gates

| Gate | Command | Result |
|------|---------|--------|
| unit tests | `node --test plugins/openspec/hooks/guard.test.mjs` | pass: exit 0, 187 tests, 187 pass, 0 fail, 0 skipped |
| repo check | `python3 scripts/check.py` | pass: exit 0, "all checks passed" |
| catalog | `python3 scripts/gen-catalog.py --check` | pass: exit 0, catalog up to date |
| plugin validation | `claude plugin validate .` | pass: exit 0, "Validation passed" (marketplace manifest) |

### Acceptance criteria

Tests are in `plugins/openspec/hooks/guard.test.mjs` and `deliver-check.test.mjs` (imported by it); names below are the `node --test` names.

| AC | Criterion | Proof | Result |
|----|-----------|-------|--------|
| AC-1 | No `ship` key: stops at every gate as today | Tests "parseShip" (no file / no key / empty `ship:` give `plan`), task 1.4 test (guard `session`/`edit`/`bash`/`ci` output identical with and without `ship`), "CLI: a plan-mode project reports stop-plan-mode". Live: `deliver-check ship-modes` in this repo (no `ship` key) printed `next: stop-plan-mode: ship mode for devkit is plan; follow the usual apply flow`. `openspec/config.yaml` has no `ship` key. | pass |
| AC-2 | `ship: {devkit-lite: pr}` runs everything to an opened PR without owner input | Logic level, per tasks 2.6: test "walkthrough: a devkit-lite change goes from no ticked task to ready without a stop step". Live skill run needs a session and a real PR. | pass (logic level; live run is a follow-up after the PR opens) |
| AC-3 | `devkit` change without `Status: APPROVED` is refused | Test "CLI --json: a devkit change reports next.step stop-not-approved, then moves on when APPROVED" (and nextStep row for `stop-not-approved`). | pass |
| AC-4 | Red gate / stale-plan / round-2 reviewer failure stops with reason | Tests "nextStep row 7: FAIL ..." (`stop-review-deadlock`) and "resume: a round-2 deadlock on disk stops while current ...". Red gate and stale-plan stops are in the skill text and tdd-implementer, with no live run. | pass (deadlock stop proven by tests; gate and stale-plan stops are skill instructions, not executed) |
| AC-5 | Resume at first unfinished step | Tests "resume: phase 1 gate ticked and phase 2 half done continues phase 2 and never redoes phase 1", "resume: code committed with one review current runs only the other reviewer", "resume: reviews and evidence current and no PR opens the PR". | pass |
| AC-6 | `deliver-check` prints eight items, `--json`, exit 0 only at 8/8 | Live: `node plugins/openspec/hooks/deliver-check.mjs ship-modes` printed 8 item lines (met/open) and `1/8 met`, exit 1; `--json` printed `version: 1`, `change`, `schema`, `ship`, `host`, `head`, `pr`, `phases`. Live re-run at c5da155: unknown change gives exit 3. Tests "CLI: exit 0 only at 8/8, with the PR in the JSON", "CLI: exit 2 when an item is blocked", "CLI: exit 3 for an unknown change ...". | pass |
| AC-7 | Product commit after reviews makes item 2 open; only stale reviewers re-run | Tests "staleness: a later commit touching src/ or openspecx/ makes it stale", "item 2: a product commit after the reviews lists the stale reviewers", "nextStep row 9: reviewers stale only after an approval re-run at round 1, and only the stale ones". | pass |
| AC-8 | "ready" only at 8/8; otherwise "in progress" / "blocked: item N" | Live: summary line `1/8 met: in progress: item 1`. Walkthrough test reaches `ready` only at 8/8; CLI exit-code tests above. | pass |
| AC-9 | Red CI: fix via tdd-implementer in the app; outside the app one capped watch ends 8/8 or "in progress: item 6" | CLI side, per tasks 2.8: tests "CLI --watch: one gh pr checks --watch --interval 30", "CLI --watch: a watch that outlives its cap is killed and the result is in progress: item 6", "host: app for the desktop entrypoint, cli otherwise, DEVKIT_HOST overrides", "watchMinutes: default 9, capped at 30 ...". The app Auto-fix wake-up loop is skill behavior with no live run. | pass (watch logic by tests; live Auto-fix run is a follow-up) |
| AC-10 | `merge` rejected, nothing merges | Live (re-run at c5da155) in a scratch git repo with `devkit-lite: merge`: stderr `deliver-check: openspec/config.yaml: ship.devkit-lite: merge arrives in a later round (round 2, auto-merge); use plan or pr`, exit 3. Tests "parseShip: merge is rejected with the round-2 message", "CLI: an invalid ship config is exit 3 with the AC-10 message, and { version, error } in JSON". | pass |
| AC-11 | ADR 0001 exists, README cites it, config names `docs/adr/` | `docs/adr/0001-coordination-without-a-harness.md` exists; `README.md` line 48 links it; `openspec/config.yaml` line 15: `ADRs: docs/adr/ (0001 coordination without a harness)`; check.py (link check) green. | pass |
| AC-12 | Test command passes, covering deliver-check and ship parsing | Gates table: 187 tests green, including `deliver-check.test.mjs` suites and `parseShip` tests; check.py green. | pass |

## Observations (not blocking, nothing fixed)

- Resolved by c5da155: `plugins/core/agents/pr-verifier.md` now says `Commit:` goes first, before the first heading; `deliver-check` outside a git repo now exits 3 with a clear message ("... is not a git repository: deliver-check reads commits and the working tree"), checked live in a scratch directory without git. Three tests were added (184 to 187).
- Reviewer agents' Output blocks may still have the same "near the top" wording gap for their `Commit:` lines (not checked in this round).
- `deliver-check ship-modes` at c5da155 reports 3/8 met; item 3 (findings disposed) is open: `test-coverage-reviewer` finding `[important] [6] Real gh contract not exercised` (carried from round 1) has no `fixed in <sha>` / `refuted:` disposition the parser accepts. Items 5-8 need the PR.
- No live `gh` run was made: that is a follow-up after the PR opens.
