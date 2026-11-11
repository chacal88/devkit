# Readiness review: release-rebase-pin

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes (no blockers)

`openspec validate release-rebase-pin --strict` passes (`skip_specs` is set, zero deltas accepted). The full hook suite was not re-run, as instructed (569 tests green on 94e795d).

Blockers: 0. Re-review after the plan changed: tasks 2.3 and gate 2.9 now call the desktop app's bundled Claude Code by absolute path for `plugin validate .`, and design.md has a new risk row for it. Checked: the binary `$HOME/Library/Application Support/Claude/claude-code/2.1.317/91184d3d9ba3/claude.app/Contents/MacOS/claude` exists and `plugin validate .` on this tree prints `Validation passed`. The gate regex in `deliver-check.mjs:280` takes the first backticked text after `Gate:`, and the command holds no backtick, so the whole line is one gate. The absolute-path form is the one `CONTRIBUTING.md:72` prescribes. Design risk row (npm 2.1.227 rejects the panel manifest on base) matches the fact given by the caller. The mandatory fix of the previous round (smoke test of task 1.1 against the marker wording of task 1.5) is closed. Task 1.1 now counts only marker lines that hold a pin, and requires them inside `## CI`. Task 1.5 allows literal markers, bans digits on marker lines (`v<version>`, never `v0.0.0`), and re-runs the smoke test as its verify step. Design D2 and D9 say the same.

## 2. Scope validation
Classification: correct. One file, one shared predicate, two callers. Non-goals are explicit. `RELEASE_FILE` and ADR 0003 stay as they are, and task 1.4 pins that (AC-7).

## 3. Proposal review
Problem, eight testable acceptance criteria, impact, non-goals and the "no specs" choice (the repo keeps no `openspec/specs/`) are clear. No findings.

## 4. Design review
Claims re-derived against live code at 94e795d:
- `conflictedPaths` (`plugins/openspec/hooks/conduct-check.mjs:366`) and `releaseConflict` (`:377`) match. The filter at `:392` is the only use of `RELEASE_FILE` there, imported at `:15`.
- Stop loop and post-replay code in `plugins/openspec/hooks/release-rebase.mjs` match (`others` filter, `checkout --ours` + `add`, `resolveVersions`, `files` aliasing `written`, `restore` checking `written` out before `reset --keep`). The `main` entry guard is at `:263`, so the new import from `conduct-check` creates no cycle (`release-rebase` imports only `deliver-check`).
- `RELEASE_FILE` is at `plugins/openspec/hooks/deliver-check.mjs:755` and `unnamedFiles` at `:759`.
- Pin lines are `docs/openspec-flow.md:460, 461, 468`. They are the only marker lines in the file, all inside `## CI` (437-508), and line 468 holds exactly two pins. The pin test is at `plugins/openspec/hooks/deliver-check.test.mjs:3031`. Today `plugin.json` is 0.10.3 and the marketplace metadata is 0.11.1, so `setPins(doc, version) === doc` holds at the start of phase 1.
- Test fixtures exist as described: `releaseRepo`, `bump`, `B_PATCH` (`release-rebase.test.mjs:118-172`), `roundRepo`, `commitOrigin`, `readyChange`, `conflictRepo` (`:613`), `archiveRepo` (`:765`), and the existing release-conflict tests (`:626-668`, `:780`). `guard.test.mjs` imports both test files (`:13-14`).
- Version arithmetic of the AC-4 and AC-6 fixtures (0.10.0 / 0.10.1 / 0.11.0 gives 0.11.1) follows `resolveVersion`.
- Release arithmetic: marketplace 0.11.1 to 0.12.0 matches `check_changelog` in `scripts/check.py`. After 2.2 no `0.10.3` is left in the doc.

## 5. Specs review
No spec deltas, by design. The criteria in `proposal.md` are the behavior, and each maps to a task: AC-1..3 in 1.3, AC-4..6 in 1.2, AC-7 in 1.4, AC-8 in 1.5 and 2.x. No findings.

## 6. Tasks review
Ordered, each with a red or verify command, one backticked gate each. Phase 2 depends on phase 1, and the plan says so. Findings (none blocking):
- Low, Fix during implementation: the tests in 1.3 assert "no `devkit-pin-*` folder left in `tmpdir()`". A leftover folder from an earlier crashed run, or a concurrent process, would fail it. Snapshot the matching names before the call and compare after.
- Low, Fix during implementation: `proposal.md:88` (Exit criteria) still says a bare `claude plugin validate .`, while tasks 2.3 and 2.9 use the bundled binary. Tasks and design govern; align the proposal line when convenient.
- Low, Nice to have: the path in 2.3 and 2.9 hardcodes bundled version `2.1.317` and hash `91184d3d9ba3`. It exists on this machine now; if the app updates before the gate runs, the implementer swaps in the current `<version>/<hash>` (CONTRIBUTING.md:72 uses the same placeholders).
- Low: `conduct-check.test.mjs` imports `pinDoc` from `release-rebase.test.mjs`. That is harmless, because the module cache registers its tests once under `guard.test.mjs`, and the task uses `--test-name-pattern`.

## 7. Omission detection
Error handling (`cannot set the pin:`, exit 2, restore), idempotency (`setPins`), rollback (`written` restored), legacy and no-pack projects, missing blobs, and CRLF endings are all covered. Observability, authorization and feature flags do not apply.

## 8. Execution risks (top 5)
1. Fixture friction in making AC-4 and AC-5 stop on the doc. Mitigation: slots at least 3 unchanged lines from the pins (written in 1.2).
2. `git merge-file` treats adjacent edits as a conflict. The result is blocked or exit 2, which is conservative and accepted (D3).
3. A later doc edit puts a semver on a marker line. The real-file smoke test catches it.
4. Criss-cross history makes the pre-rebase verdict differ from the per-stop one. Worst case is exit 2 with the old head restored.
5. An archive PR that bumps devkit-openspec needs a retro proposal naming `docs/openspec-flow.md`. This is intended (ADR 0003 unchanged) and is noted in the workflow follow-up.

## 9. Mandatory fixes before implementation
None.

## 10. Optional improvements (within scope)
- [ ] The tmpdir assertion as in section 6.

## 11. Explicitly out of scope
- [ ] Other pinned files, configuration keys, pre-release tags, `ship-change` conflict handling, and a live two-PR collision.

## 12. Mandatory review questions
1. Problem objectively defined: yes.
2. Result measurable: yes (AC-1..AC-8).
3. Error behaviors defined: yes (D6, D8).
4. Edge cases covered: yes (no pack, renumbering without a conflict, missing blob, marker line with no pin).
5. Dependencies clear: yes.
6. Contracts defined: yes (D8; no field added).
7. Two developers interpreting differently: not on any behavior that matters. The marker wording is now settled.
8. Implicit decisions: none found.
9. Tasks deliver the outcome: yes.
10. Discovered too late: only fixture friction in the rebase stops.

## 13. Final conclusion
- Can we start? Yes.
- What must be fixed? Nothing.
- Main risk if ignored? A flaky tmpdir assertion (Low).
