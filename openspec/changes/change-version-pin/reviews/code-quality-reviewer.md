Verdict: approved
Commit: c1dc4033d78fb79eafea79ef073afec7949d36f2

## Quality review — change-version-pin (round 1)

### Findings
- [praise] plugins/openspec/hooks/guard.mjs:441-503 — One shared pin reader (readPin, changeFlow, changeDeclares) in the CI-downloaded file; hard-gate mode (changeDeclares) and hook/conductor fallback mode (changeDeclaresOrInstalled) kept distinct; duplicate flow reader removed from flow-check.mjs.
- [praise] plugins/openspec/hooks/version-pin.test.mjs — Per-reader tests for each AC with negatives (unreadable pin, missing or wrong kept file, equal and newer flow, check.py failure modes, both schema copies); 645 of 645 pass on the targeted run.
- [nit] scripts/check.py:208-244 — The digest gate compares flow.json, flows/<n>.json and released-flows.json only against each other in the same tree; one commit editing all three at version 1 passes. Optionally also compare the base's released-flows.json when origin/<base> is readable.
- [nit] plugins/openspec/hooks/change-loop.mjs:1761-1779 — writePin appends LF lines to, and rewrites lines in, a CRLF .openspec.yaml, leaving mixed line endings; readPin still parses it. Optionally reuse the file's line ending.
- [nit] plugins/openspec/skills/openspec-setup/scripts/install-schemas.sh:64-69 — An older pack run over a project at flow 2 removes flows/2.json (rm -r then cp -R), so changes pinned to 2 stop with a usage error; documented in evidence.md. Optionally refuse a pack whose flow version is below the project's.
- [nit] plugins/openspec/hooks/change-loop.mjs:1511-1518 — flowNotice swallows every error (catch returns null) so the resume reply silently omits the newer-flow line; deliberate and documented. Optionally let a non-FlowUsageError propagate.

### Summary
- 6 findings: 0 blocking, 0 important, 4 nit, 2 praise.
- The pin has one reader, guard.mjs#changeFlow, and every reader of a change's stages goes through it: the readout, the change, roadmap and project loops, the code-closed hook, the devkit-reviews check, the conductor and the locks. The only remaining direct read of the installed flow.json is project-loop readStatusFlow, used only when there is no report, so a pinned slice is unaffected.
- Ran only plugins/openspec/hooks/version-pin.test.mjs with GITHUB_HEAD_REF=change-version-pin, GITHUB_BASE_REF=main and TMPDIR at the realpath: 645 of 645 pass, 0 fail. This agrees with the 2131 of 2131 in evidence.md; the whole suite was not re-run.
- The three flows/1.json files in the plugin and in openspec/schemas are byte-equal to their flow.json, and their digests are in scripts/released-flows.json. The pin value is validated as ^[1-9][0-9]{0,5}$ before it enters the flows/<n>.json path, so there is no traversal. Release numbers agree across plugin.json, marketplace.json, CHANGELOG.md, the docs and the CI snippet pin (devkit-openspec 0.30.0, marketplace 0.34.0, above origin/main at 0.29.0 and 0.33.0). Nothing was written to the tree.
- Not proven by a demonstration here, as evidence.md already states: the roadmap and project opens and a pack update were not run by hand (tests cover them); the guard hook and the CI check were run by hand on an unpinned change only; the dogfood on the next change opened in this repository is owed by the plan.
- Justification: no bug, locked-decision violation, false claim or performance or security gate found; the claims in evidence.md, CHANGELOG.md and the docs match the code; only optional nits remain, so the verdict is approved.
