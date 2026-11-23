<!-- devkit-stage readiness result=passed attempt=4 commit=cc4d863ed45de6268e0baab71024b91399a9e17e -->
# Readiness review: change-version-pin

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

Round 4, on the base `cc4d863` (devkit-openspec 0.22.0, marketplace 0.26.0, after `stage-roles`).
The package was re-based on that tree: `proposal.md`, `design.md` and `tasks.md` now carry
`commit=cc4d863`, and their claims about the base hold. `openspec validate change-version-pin
--strict` passes.

## 2. Scope validation
Classification: correct. Problem, scope and non-goals are explicit; no spec delta adds behaviour the
proposal does not justify.

## 3. Proposal review
No findings. The proposal states that `flows/1.json` is the `cc4d863` content because `stage-roles`
edited `flow.json` in place under `"version": 1`; the three `flow.json` files hold `"version": 1`.

## 4. Design review
Claims re-derived against the code at `cc4d863`. Holding:
- `readFlowFile` checks at `flow-check.mjs:57` (`ceiling`), `:60` (`appliesWhen`) and `:75` (`notAfter`);
  base report at `flow-check.mjs:516`; `flow-check.test.mjs:1076` (JSON key list);
  `change-loop.test.mjs:1137` and `:2481` (`/v0\.22\.0/`).
- `USAGE` ends at `change-loop.mjs:1464` with `accept-decisions <id> --lang <l>`; `openUnderLock` `:1233`,
  `switchScript` `:1268`, `startMode` `:1081`, `subagentStopFor` `:1388`, `handOffFor` `:1442`.
- `readFlow` callers: `change-loop.mjs:1394` and `:1447`, `conduct-check.mjs:182`,
  `roadmap-loop.mjs:509`, `project-loop.mjs:302`, `flow-check.mjs:281`;
  `readFlowFile` in `changes-under-way.mjs:61`; `collectFlow` callers `change-loop.mjs:821`, `:1040`,
  `:1396`, `project-loop.mjs:304`, `:557`, `roadmap-loop.mjs:638`. All are in D-4 table A or B.
- `schemaHasArtifact` (`guard.mjs:308`) callers `guard.mjs:408`, `deliver-check.mjs:1296` and `:1654`,
  `conduct-check.mjs:220-221`: rows A14 to A17.
- The "list is exhaustive" generalization was swept across `plugins/`, `scripts/` and `.github/`: no
  reader of a change's stages is missing from D-4.
No findings.

## 5. Specs review
Four deltas, unchanged since round 3, with normative language and `#### Scenario:` blocks; every row of
the D-7 decision table has a scenario. No findings.

## 6. Tasks review
Ordered, one gate per phase, every AC mapped, test-first with saved red output, paths under real
directories. Gates on the base: `python3 scripts/check.py` prints "all checks passed" and
`python3 scripts/gen-catalog.py --check` exits 0. The long suite was not run by this review (13 to 21
minutes; the caller runs it). No findings.

## 7. Omission detection
No findings: malformed pin, missing kept file, equal and newer versions, the CI job's limits, the
`FlowUsageError` re-export, and the release and tag steps are written.

## 8. Execution risks (top 5 failures)
1. A project's `devkit-reviews` pins an older tag that ignores pins: CHANGELOG "Projects" line (planned).
2. Moving `FlowUsageError` breaks `instanceof`: re-export and reader tests (planned).
3. Suite time at three gates: shared scratch (planned).
4. A setup re-run with an older pack leaves a pin on an uninstalled version: message names the version;
   hook and conductor fall back (planned).
5. A future flow edit that keeps its version: `check_flow_versions()` with `scripts/released-flows.json`
   (planned, AC-7).

## 9. Mandatory fixes before implementation
- [x] None.

## 10. Fix during implementation
- [ ] None.

## 11. Explicitly out of scope
- [ ] The OpenSpec CLI honouring the pin, bulk or automatic moves, pinning agents or checkers, the
  consumer re-install check (named in `requirements.md`).

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes.
2. Is the result measurable? Yes: seven ACs with named tests in D-9.
3. Are error behaviors defined? Yes, by caller, in D-3 and the specs.
4. Are edge cases covered? Yes.
5. Are dependencies clear? Yes.
6. Are contracts defined? Yes.
7. Can two developers interpret this differently? Not on a behaviour.
8. Are any decisions implicit instead of written? No finding.
9. Do the tasks fully deliver the intended outcome? Yes.
10. What will be discovered too late? A consumer project pinning an old `devkit-reviews` tag, named as a
    risk with a CHANGELOG line.
