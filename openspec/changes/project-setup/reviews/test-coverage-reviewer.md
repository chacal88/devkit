Verdict: rejected
Commit: 02e67807136fa670f73202efc2601e0f3b1936c0

## Coverage analysis — project-setup (3ca2e47e35e95cf53cf745a23838909c88dcd5ce..02e67807136fa670f73202efc2601e0f3b1936c0)

### Findings
- [important] plugins/openspec/skills/devkit/scripts/setup-block.mjs:326 — [7] The default delivery answer is never tested. The skill sends {"model":"none"} (every real run did), and lines 326 and 357 keep it from being written. No test sends 'none' to a project with no delivery train: if both lines broke, apply would write `model: none` and exit 0, and readDevkitSettings would then report delivery-model 'none' as unknown, so the next /devkit change refuses. Write in: setup-block.test.mjs, a 'setup AC-3 block apply' test that sends {delivery:{model:'none'}, language:'en'} to project(null), checks that `added` lacks delivery and that readDevkitSettings(root).unknown is [], and checks the exact file text as the first apply test does.
- [important] plugins/openspec/skills/devkit/scripts/setup-block.mjs:145 — [6] The spec scenario 'A delivery model chosen' has no test, at the unit level or in a real run. In one apply call, an answered model should change what else may be answered (lines 145-148): {delivery:{model:'trunk-auto'}, merge_method:'squash'} should be accepted and write no ship: map, and {delivery:{model:'trunk'}, ship:'merge'} should be refused. The existing B-9 test only reads plan() with the model already in the file. If answeredModel broke (say, always null), trunk-auto setups would be refused with exit 3 and trunk plus ship:merge would write a ship map next to the model, and setup-block.test.mjs would stay green. Write in: setup-block.test.mjs, one apply test with the two cases, using applied() and refused() and checking deliveryConfig(root,'devkit').
- [nit] plugins/openspec/skills/devkit/scripts/setup-block.mjs:180 — [4] No test reads plan.kit as 'installed' (a project with .compozy/kit-manifest.json); only 'absent' is checked. Step 8 of the skill reads this field to skip the kit question on a re-run. Write in: setup-block.test.mjs, one assertion with files {'.compozy/kit-manifest.json': '{}'}.
- [nit] plugins/openspec/skills/devkit/scripts/kit-installer.mjs:91 — [3] kit-installer's own usage errors (no argument, '--where' with an extra argument, a root starting with '-') should exit 2 with nothing run, and no test covers them. The installer's usage error that is passed back is covered. Write in: kit-installer.test.mjs, a loop over the three argument sets on sandbox().
- [nit] plugins/openspec/skills/devkit/scripts/setup-block.mjs:245 — [3] Two minor paths have no test: refusing an invalid release_tag (for example 'VERSION' or '../x.json'), and the kept entries built from settings.missing at line 140 (two-prs with no test_branch gives value null). Write in: setup-block.test.mjs, one row in the invalid-answer table and one plan assertion.
- [nit] plugins/compozy/kit/scripts/install-kit.mjs:30 — [4] The move changed PACK_JSON from three '..' segments to two. No test checks the `pack` version the manifest records: the install-kit tests run a copied kit with no plugin.json, and kit-installer.test.mjs:139 only checks that the manifest exists. Only real run R-4 shows 0.5.0. A wrong path would silently record 'unknown'. Write in: kit-installer.test.mjs:139, read the manifest and check pack equals the version in plugins/compozy/.claude-plugin/plugin.json.
- [nit] plugins/openspec/hooks/guard.test.mjs:192 — Implementation-coupled: the 'setup AC-1/4/5/6/7 skill' tests match exact sentences of SKILL.md's Setup section (for example 'Every part of `openspec/config.yaml` that `fill` does not name stays as it is: ...'). They will fail on a rewording that keeps the meaning. This is the project's convention for the skill-text layer, and the real runs R-1 to R-6 carry the behaviour; noted only.

In-scope surfaces: devkit-openspec (hooks/change-loop.mjs setup mode and BUILT_DRIVERS, merge-setup.mjs SETUP_POINTER and withoutSetupPointer, project-loop.mjs, train-loop.mjs, guard.mjs, flow-check.mjs, compozy-driver.mjs replies; skills/devkit/scripts/setup-block.mjs, kit-installer.mjs, the moved setup scripts; the Setup section of SKILL.md), devkit-compozy (kit/scripts moved: install-kit.mjs, gen-agents.mjs), repository (scripts/test-suite.mjs SUITE_FOLDERS, ci.yml paths)

Blocking gaps (8-10 without a plan): 0

Seams checked (mutation runs: 0; scoped run: setup-block.test.mjs + kit-installer.test.mjs, 22/22 pass, --concurrency=3, TMPDIR=/var/tmp/devkit-project-setup):
- startMode `setup` branch before the project gate -> caught by change-loop.test.mjs 'setup AC-1 start: setup in a folder with no openspec ...' (mode, root, nothing created, subfolder) and '... unknown setting, missing delivery setting or driver not built still answers the setup mode'
- `setup-no-repo` outside git -> caught by 'setup AC-1 start: setup outside a git repository ...' (both languages)
- exact verb only -> caught by 'setup AC-1 start: setups is an unknown verb'
- BUILT_DRIVERS feeding the driver question -> caught by change-loop.test.mjs 'setup AC-6 drivers' (checked against startMode's driver-not-built) and setup-block.test.mjs 'setup AC-3 block plan' (options) and 'setup AC-6 block apply' (script/robot refused)
- withoutSetupPointer in project-loop decideSlice -> caught by project-loop.test.mjs 'setup AC-2 project: the S23 reply lists the missing facts without the setup pointer'
- withoutSetupPointer in train-loop nextAction -> caught by delivery-train.test.mjs 'setup AC-2 train: the blocked train reply ...'
- SETUP_POINTER text in mergeSetup -> caught by merge-setup.test.mjs 'each fact missing alone ...' (exact POINTER)
- reply texts naming /devkit setup and no removed skill -> caught by change-loop.test.mjs 'setup AC-2 replies' (every reply key, both languages) and guard.test.mjs 'setup AC-2 tree'
- typed /devkit setup ends a change or roadmap hold -> caught by guard.test.mjs 'setup AC-1 guard' (two tests; they pass on the base by design)
- SUITE_FOLDERS -> caught by test-suite.test.mjs 'setup AC-3 suite: the repository suite lists setup-block.test.mjs and kit-installer.test.mjs ...'
- setup-block apply: block keys present are kept (exit 3) -> caught; nothing missing leaves the bytes and mtime unchanged -> caught; key inserted under its map -> caught; CRLF, missing final newline, empty file -> caught; inline value, second devkit line, tab indent, unreadable config -> caught; usage errors exit 2 -> caught; the ship and merge_method gating that follows a ship answer -> caught (pr plus merge_method refused; merge plus squash written)
- setup-block apply: delivery answer 'none' -> gap (F1); an answered model gating ship and merge_method -> gap (F2)
- setup-block plan: fill, kept language and train values, release_tag only with a version, pluginVersion and ciPin -> caught; kit 'installed' -> gap (F3). The ciPin fixture matches the producer's comment in templates/devkit-reviews.yml:19, so it is a state the producer can emit
- kit-installer search order (sibling, highest installed version, tie on last path, HOME fallback, old skill location refused, not found exit 3) and the passthrough of arguments and exit code -> caught by kit-installer.test.mjs (5 tests, including a real install through the repository's compozy pack)
- install-kit PACK_JSON path changed by the move -> gap (F6, nit)
- old projects keep working (AC-8) -> caught by guard.test.mjs 'setup AC-8 old project' (start opens a change on claude, open, flow-check readout)
- SKILL.md Setup steps (the asking order, the kit question, GitHub one by one) -> prose; tested by the skill-text tests in guard.test.mjs and proven by real runs R-1 to R-6. The GitHub ruleset question itself rests on github-setup.test.mjs only (evidence O-1). The typed-only limit (evidence F-1) is a hook-scope matter outside this change, not a coverage gap of its diff.
- moved setup and kit tests: the diff only changes their paths (checked with rename-aware diffs); they protect the behaviour as before (AC-9).

### Well covered
- The setup branch of startMode: setup-mode and no-repo tests in change-loop.test.mjs check the mode, the root, the reply, both languages, and that nothing is created.
- Re-run byte identity: setup-block.test.mjs 'setup AC-4 block apply: nothing missing leaves the file byte-identical and unwritten' checks the bytes and the mtime.
- Refusals of the block writer: the refused() helper checks exit 3, one stderr line, empty stdout and the file unchanged, in every case.
- Finding the kit installer: kit-installer.test.mjs builds real sandboxes for every search branch and runs one real install through the repository's own compozy pack.
- The pointer-strip helper is tested through both of its callers' blocked replies, not only as a function.
- The removed-name sweep: guard.test.mjs 'setup AC-2 tree' scans every tracked and untracked file outside the history, with the delta's MODIFIED blocks left out.
