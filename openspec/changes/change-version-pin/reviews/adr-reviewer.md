Verdict: approved
Commit: c1dc4033d78fb79eafea79ef073afec7949d36f2

## ADR review — change-version-pin

### Findings
- [nit] openspec/changes/change-version-pin/design.md § Decisions and ADRs (no new ADR); docs/adr/0010-openspec-as-the-harness.md and docs/adr/0012-the-reviews-check-follows-the-change-script.md — Earlier changes that altered how a locked ADR's mechanism behaves (stage-roles, change-state, coordinator-field-fixes) added a dated Note to the ADR. This one makes the devkit-reviews check and the loop judge a change by its recorded flow, but adds no Note to ADR 0010 or ADR 0012, and the design does not say why none is needed. No decision sentence is contradicted, so this is alignment only.
- [nit] openspec/changes/change-version-pin/design.md § D-1 and § Decisions and ADRs; plugins/openspec/hooks/deliver-check.mjs checkOne — A pull request can lower its own change's x-devkit-flow to an older kept flow, for example one that does not ask a stage a later flow adds, and the check then judges it by that flow. The design rejects a per-change copy of the flow partly because a hand edit changes the rules, but never records this same property of the pin edit as accepted. ADR 0012 accepts the analogous schema edit because the diff is visible to reviewers, so the design should state the same acceptance and cite ADR 0012.

ADRs reviewed: ADRs 0001 and 0005 (superseded), 0002, 0003, 0004, 0006 to 0009 (skimmed), 0010, 0011, 0012, 0013, 0014, 0015, 0016, 0017, 0018. I read 0002, 0004, 0010, 0011, 0012, 0016 and 0017 in full and the rest by header and by search for flow versions. The project has no open-decisions log.

Conformance, checked against the diff (origin/main...c1dc403):

- ADR 0010 decision 1: the kept flows live under each schema folder in `openspec/schemas/` (`flows/<n>.json`), so the flow stays under the project's `openspec/`.
- ADR 0010 decision 3: the attempt ceilings stay in configuration, and each kept version carries its own.
- ADR 0010 decision 6: the stage gates and the owner's plan approval are untouched, and the `flow` command moves a change only on the owner's request.
- ADR 0011: the code gate (`guard.mjs#writeViolation`) and the conductor's planning rows use `changeDeclaresOrInstalled`, which falls back to the installed `schema.yaml` on an unreadable pin, so no hook blocks on its own error. The hard gates (`deliver-check.mjs#collectState` and `checkOne`) fail on a bad pin through `changeDeclares`. That fits ADR 0011's rejection of a hook that fails closed, because those are the CI check and the delivery checker, not an edit hook.
- ADR 0012 and ADR 0004: the set of changes the check judges is still decided by the schema's name (`deliver-check.mjs#isDevkitScript`, design row B11), and the opt-in is unchanged.
- ADR 0002 and ADR 0003: the CI job downloads only `guard.mjs`, `deliver-check.mjs` and `merge-setup.mjs`. The new reader lives in `guard.mjs`, and `deliver-check.mjs` imports only `merge-setup.mjs` and `guard.mjs`, so the three-file download still works. The check still recomputes readiness at the PR head, by the flow that head's change records.
- ADR 0016: the product-code gate and the roles' write rules are unchanged apart from which flow answers whether a readiness stage exists.
- ADR 0017: the state, the title and the board still go through `collectFlow` and `changeFlow` (design rows A1, A5, A6, A9).
- ADR 0015 and ADR 0018: the project and slice readers (rows A11 and A12) route through `collectFlow`, and the delivery model is untouched.
- The remaining `readFlow` and `schemaHasArtifact` calls in the hooks are deliberate: the pin writers and the `flow` command read the installed flow on purpose, and so do the not-yet-opened project slice and the `open` stage title.
- The release (devkit-openspec 0.30.0, marketplace 0.34.0), the changelog, the CI snippet and the setup skill agree on the version.

No test was run: the caller supplied the full-suite result.

### Summary
- 2 findings (0 blocking, 0 important, 2 nit)
