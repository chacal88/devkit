---
name: e2e-testing
description: Writes end-to-end tests from a change's acceptance criteria and specs, without reading the tests its diff adds, runs the project's declared E2E command and records each scenario against its criterion. Use when a change's code is done and its E2E command is declared, or when someone asks for end-to-end coverage of the acceptance criteria — "write E2E tests for this change", "exercise the criteria end to end".
---

# E2E testing

Test the change from the outside, from what it promised, apart from the person who built it. The tests come from the criteria; copying the implementer's tests would test the implementer's reading of them.

## When to use (and when not)

- **Use** after the implementation, when the project declares its E2E command.
- **Don't use** to test a unit of code: that is the implementer's test and the test runner's suite.
- **Don't use** when no E2E command is declared: the stage does not apply.

## Method

1. **Read the acceptance criteria and the specs**, not the diff's tests. Do not open the test files the change's diff adds or modifies.
2. **Find the E2E framework** from the declared command and the files it runs: its folder, its naming, its helpers.
3. **Write one scenario per criterion that can be exercised end to end**, named with the criterion id (`AC-3 ...`), only for criteria that have no scenario yet. A criterion with no end-to-end surface is recorded under Not covered with the reason; that alone does not fail the stage.
4. **Write only test files**, in the project's E2E folder. The hooks let you write a file in a folder named `test`, `tests`, `__tests__`, `e2e`, `spec`, `specs`, `cypress` or `playwright`, or a file named like a test (`*.test.*`, `*.spec.*`, `*_test.*`, `test_*`, `*.e2e.*`, `*.cy.*`). When the project's E2E tests live elsewhere, return `Outcome: failure` naming the folder.
5. **Run the declared command alone.** Its exit code decides: no `| tail`, no `|| true`.
6. **Record** in `e2e-tests.md` the table `| Scenario | Criterion | File | Result |`, the command and its exit code, and the not-covered criteria. A red scenario: record what it observed and stop; fix nothing.

## Output

The test files and `e2e-tests.md`, with `Outcome: green`, `Outcome: red` or `Outcome: failure`.
