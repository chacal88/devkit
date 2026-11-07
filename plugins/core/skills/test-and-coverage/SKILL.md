---
name: test-and-coverage
description: Discovers the repo's test surfaces and their commands, runs them per surface with coverage, reports PASS/WARN/FAIL against the coverage target, and analyzes gaps with prioritized test suggestions. Use when validating an implementation, before a commit or PR, or when the user says "run the tests", "test this surface", "check coverage", "coverage report", "what's untested", "which files need tests".
---

# Test and coverage

Run the tests of any part of the repo with coverage, without assuming a layout, and turn the coverage numbers into a short, prioritized list of tests worth writing.

A **surface** is any part of the repo with its own test setup: a workspace, package, service or top-level directory with its own test config.

## When to use (and when not)

- **Use** to validate an implementation, before a commit or PR, to check the coverage target, or to find which files need tests.
- **Don't use** to debug a failing test: use the systematic-debugging skill.
- **Don't use** to judge whether a diff's *behaviors* are tested: that's the test-coverage-reviewer agent (behavioral lens, not line %).

## Input

- A surface name, a list of surfaces, or `all`.
- Optional: `--coverage=<N>` threshold override, a file path for line-level analysis, `--verbose` for failure detail.

## Process

### 1. Discover surfaces and commands

Never assume a fixed layout or that coverage is configured.

1. **Layout:** monorepo markers (`workspaces` in `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `nx.json`, `go.work`, top-level `apps/`, `packages/`, `services/`) or a single package.
2. **Runner per surface:** `jest.config.*`, `vitest.config.*`, `pytest.ini`/`pyproject.toml` (`[tool.pytest]`), `go.mod`, `Cargo.toml`, etc.
3. **Command per surface:** prefer what the repo defines, in this order: documented commands (CLAUDE.md, README, CONTRIBUTING), package scripts (`test`, `test:cov`, `coverage`), `Makefile`/task runner targets, the CI config. Fall back to a generic invocation only when nothing is defined.
4. **Coverage config:** check it's enabled and where the report lands before running.

Show the table you'll use:

| Surface | Runner | Test command | Coverage command | Report |
|---|---|---|---|---|

### 2. Check prerequisites

Services the tests need (database, queue, containers) are up; test files exist on the surface. Report any missing prerequisite instead of running blind. If the repo has a compose file, that's the usual way to bring dependencies up.

### 3. Run per surface

Run each target surface's coverage command from its directory (e.g. `npm run test:cov`, `npx vitest run --coverage`, `pytest --cov=<pkg> --tb=short`, `go test -cover ./...`). Independent surfaces can run in parallel.

### 4. Parse results

Per surface: tests passed/failed/skipped, duration, line and branch coverage overall and per file, uncovered lines/branches, failing test names with file:line and error.

Reports to read (prefer machine-readable): Jest/Vitest `coverage/coverage-final.json` or `coverage/lcov.info`; coverage.py `coverage.xml` or `coverage json`; Go `-coverprofile`; LCOV for anything else. In istanbul JSON, `s`/`f`/`b` are statement/function/branch hit counts; 0 means uncovered.

### 5. Analyze gaps (when below target or asked)

For each surface: files below target, uncovered functions, complex branches without a test, missing integration coverage. Pick the **top 5 files** by impact × complexity and, for each:

- what's missing (specific functions/branches);
- suggested tests (unit, integration, edge case) with a short starter snippet that **mirrors the repo's existing tests**: read the nearest `*.test`/`*.spec`/`test_*` file first and copy its mock style, fixtures and assertions;
- effort (low/medium/high) and priority.

What to suggest first:

- **Error paths** (the most common gap): not found, persistence failure, invalid input, timeout and retry.
- **Edges:** empty input, boundaries, invalid types, concurrency, state transitions, rollback/cleanup.
- Each suggestion: happy path plus errors plus edges, external dependencies mocked, one behavior per test, descriptive name, minimal arrange-act-assert setup.

High coverage isn't good tests. Flag: high % with untested error branches; high % from slow integration tests and few unit tests; tests coupled to specific database state; tests that assert on the mock instead of the behavior.

## Targets

The project's documented target wins (CLAUDE.md, CONTRIBUTING, an ADR, CI thresholds). Default when none is documented: **80% lines and branches per surface**.

| Tier (by role, not path) | Target | Examples |
|---|---|---|
| 1. Critical | 85–90%+ | business logic, API boundaries, auth/authz, payment/signup flows, external adapters, retry logic, queue consumers |
| 2. Standard | 80%+ | data layer, validated schemas/DTOs, utilities with branching, infra services |
| 3. Light | 70%+ | wiring, layout/composition components, constants, static pages |

Exclude: entrypoints and framework wiring, the test files and setup, build/dependency dirs, config files.

## Block vs warn

**Blocks commit/PR:** any failing test; critical-path coverage below 80%; the project's typecheck or lint fails.

**Warns:** critical-path coverage 80–85%; complex functions with branch coverage below 85%; a new file with no tests (flag it explicitly).

## Output

Per surface, one of:

```
PASS <surface>: lines 85%, branches 82% | 47 passed, 0 failed, 0 skipped | 12.3s

WARN <surface>: lines 72% (target 80%) | 45 passed, 0 failed
  Gaps (top 5):
  1. <file>:<lines> — <function/branch> — <n>%

FAIL <surface>: 38 passed, 2 failed, 1 skipped (coverage N/A)
  1. <file>:<line> "<test name>" — <error>
```

Then, when gaps were analyzed:

```
## Top files to test
1. <file> (<surface>) — <n>% — missing: <..> — effort: <..> — priority: <..>
   <starter test snippet in the repo's style>

## Next steps
1. ...
```

Next-step hints: all green → ready for review (review-change skill); below target → write the suggested tests (TDD where new behavior); failures → systematic-debugging, or rerun the single test with the runner's filter. Put a before/after coverage line in the PR body when coverage moved.

Report in chat. Don't create files unless the change needs recorded evidence; then put it inside the change package directory, never as a loose doc.

## Troubleshooting

- **No tests found:** check the surface's test file convention and runner `include` globs.
- **Connection refused:** a dependency service isn't up; start it (compose) and rerun.
- **Port in use:** a dev server is holding it; stop it or use another port.
- **0% or missing coverage:** coverage not enabled in the runner config, or tests failed before reporting; clear stale `coverage/` and rerun.
- **Modules not found:** runner aliases don't match `tsconfig` paths.

## Never

- Assume a surface or command without discovering it, or that coverage is configured.
- Dump raw coverage JSON or list hundreds of files: summarize and prioritize.
- Suggest tests without an example in the repo's style.
- Lower a documented coverage target on your own; changing it is the owner's decision.
- Merge anything. All-green means ready for review, not merged.

## Related

- Skills: `systematic-debugging` (failing tests), `test-driven-development` (writing the missing tests), `review-change` (next gate).
- Agents: `test-coverage-reviewer` (behavioral coverage of a diff), `tdd-implementer` (closes gaps test-first).
