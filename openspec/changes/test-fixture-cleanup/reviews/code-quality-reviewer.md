Verdict: approved
Commit: 1d75ac1cbcdefd556e433d0e43e86330b897767b

## Quality review — test-fixture-cleanup (round 1, re-review after the second merge of origin/main)

### Findings
- [nit] plugins/openspec/hooks/flow-check.test.mjs:138 — The module-level schemaProject() and sampleChange() calls now run on import, so every filtered run pays for the slow fixtures. The comment says why, but there is a stray double blank line after the call.
- [nit] plugins/openspec/hooks/test-tmp.mjs:14 — Innermost-test attribution assumes sequential tests; add a one-line comment stating the assumption. Unchanged by this merge.
- [nit] openspec/changes/test-fixture-cleanup/proposal.md:82 — The old finding was that the plan text named the stale release 0.21.2 / tag v0.21.2. proposal.md now carries 0.22.1 and v0.22.1 with the history. tasks.md 4.2 keeps its original 0.21.2 / 0.25.2 wording but adds a note giving the final release (0.22.1 / 0.26.1, pin v0.22.1). tasks.md item 4.3 (the three v0.21.1 pins) was not rechecked. That is acceptable as a plan record. · fixed in 3248cda
- [praise] plugins/openspec/hooks/change-loop.test.mjs:2480 — The pin assertion now matches v0.22.1 and adds doesNotMatch for v0.22.0 beside the older ones, so a stale pin fails the test.
- [praise] CHANGELOG.md:3 — The 0.26.1 section matches the diff pack by pack (openspec 0.22.1, core 0.10.1, compozy 0.3.1), states the CI step and names the CONTRIBUTING rule.
- [praise] .github/workflows/ci.yml:21 — The hook tests run on an empty TMPDIR and a separate step fails the job when anything is left in it, so a leak is checked in CI.

### Summary
- 6 findings (0 blocking, 0 important, 2 nit open and 1 nit closed) + 3 praise
- Justification: I reviewed only this change's side of the second merge (`git diff d1c7fa4 HEAD`). The marketplace.json and the three plugin.json files agree on 0.26.1 / 0.22.1 / 0.10.1 / 0.3.1. The CHANGELOG section matches, and the three pins in docs/openspec-flow.md read v0.22.1. The change-loop docs assertion now also forbids v0.22.0. The two accept-decisions tests from main (the symlink-outside test and the nocwd usage test) now use `tmpFolder`. In flow-check.test.mjs, `dirWith` and `configRoot` were not located or inspected; the diff I read there shows only `tmpFolder` replacements. The three `test-tmp.mjs` copies are byte-identical (`cmp` printed nothing). In the plugins tree, the only file still calling `mkdtemp` or `tmpdir()` is `test-tmp.test.mjs`, which tests the helper itself. `scripts/check.py` printed 'all checks passed'. `scripts/gen-catalog.py --check` printed nothing within its 60 s limit, so it is not demonstrated. A `node --test` run of flow-check.test.mjs with TMPDIR=/var/tmp was started but had not finished when the round ended, so I have no result from it. I did not run the change-loop test. The only acceptance output I have is evidence.md's record of the whole guard suite at 1532/1532 on an empty TMPDIR and the green PR CI check, which I did not reproduce. Previous verdict is approved and nothing in this delta contradicts it.
