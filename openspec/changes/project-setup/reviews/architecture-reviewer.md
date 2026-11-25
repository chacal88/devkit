Verdict: approved
Commit: 2079b0f84d05c024a14338da7f9117b44b14c137

## Architecture review — project-setup staleness re-review (76e88ad..2079b0f)

### Findings
- [important] plugins/openspec/skills/devkit/scripts/setup-block.mjs:101 — ciPinOf read the CI pin with its own regex, a second pin reader beside deliver-check.mjs PIN_MARKER/pinsIn (ADR 0027 decision 6); a change of the pin line would leave the setup's ciPin silently null. · fixed in 387bf1553e85d7610c5ee64c0bf5e4b6f6a444d7
- [nit] plugins/openspec/skills/devkit/scripts/setup-block.mjs:96 — defaultBranch re-implements change-loop.mjs#defaultBase with a narrower fallback (origin/HEAD else 'main'); design D-3 states the narrower rule, so import defaultBase as a follow-up.
- [nit] plugins/openspec/skills/devkit/scripts/setup-block.mjs:30 — TRAIN_MODELS is a third copy of the train's model rule that guard.mjs trainSetting hardcodes inline; export it from guard.mjs beside DELIVERY_MODELS and import it here.
- [nit] plugins/openspec/skills/devkit/scripts/kit-installer.mjs:44 — compareVersions is a second dotted-version comparator beside merge-setup.mjs versionOlder, with different edge rules; merge them when either is next touched.
- [nit] docs/adr/0026-the-devkit-test-suite-runs-by-file-in-parallel.md:29 — ADR 0026 decisions 1 and 6 named the setup skills' script folders this change moves, with no dated Note and no mention in ADR 0031's Amends line. · fixed in 387bf1553e85d7610c5ee64c0bf5e4b6f6a444d7
- [praise] plugins/openspec/hooks/merge-setup.mjs:24 — SETUP_POINTER and withoutSetupPointer cut the two regex copies project-loop.mjs and train-loop.mjs carried: the pointer text has one owner.
- [praise] plugins/openspec/hooks/change-loop.mjs:2061 — BUILT_DRIVERS is derived from DRIVERS and DRIVER_ROUND at the gate's owner and imported by setup-block, so the setup's driver question and the loop's driver-not-built gate cannot disagree.
- [praise] plugins/openspec/hooks/guard.mjs:122 — The CRLF fix lands in the two owners of the devkit block's reading (guard parseDevkitBlock, flow-check readTestSettings), so every reader gains it at once.
- [nit] plugins/openspec/hooks/change-loop.mjs:2118 — The setup branch inlines the outside-the-folder predicate (rel === '..' || startsWith('..' + sep) || isAbsolute) that readRecord already holds as a local closure at :1793; hoist one module-level helper so the two containment checks in the file cannot drift.
- [nit] plugins/openspec/hooks/change-loop.mjs:2102 — In the nested-repository case the setup output's settings come from findRoot's outer folder while root is the inner top level; no setup-mode reader routes on them today and design D-1 states it, so read the settings from the chosen root when the setup branch is next touched.

Analyzed (staleness re-review, bounded to 76e88ad..2079b0f): one product-code commit, ac5958e (change-loop.mjs#startMode's setup branch plus one test, N-20), and the plan text that restates it (design D-1, N-3/N-20 rows in 78001de). The rest of the range is evidence and review files (b8253f7, d51b033, 816d179, 2079b0f), which are outside this remit.

Owners: the fix stays in the owner of the start decision (change-loop.mjs#startMode) and reuses guard.mjs#findRoot unchanged. It does not change findRoot itself, which every other verb and hook relies on to climb to the project root. So the clamp is local to the one verb whose contract is "the repository where the command was typed", and that is where it belongs. The setup still decides on git's toplevel first, so a non-git folder holding openspec/changes still answers setup-no-repo, as spec-reviewer F2 required.

Boundaries: the commit adds no import; relative, isAbsolute, sep and realpathSync were already imported in change-loop.mjs. No hook gains a dependency on a skill script, and setup-block.mjs, guard.mjs, deliver-check.mjs and merge-setup.mjs are untouched in the range.

Contract consumers: the output shape of the setup and setup-no-repo modes is unchanged ({ mode, root, reply }); only which folder root names in the nested case changes. Searching for startMode and setup-no-repo outside tests finds only the devkit skill's SKILL.md as a reader of those modes (Start list line 44: the Setup section works in root, whatever the driver; line 36 excludes setup from the compozy routing on settings.driver). plugins/panel/hooks/project.ts and roadmap-loop.mjs match only unrelated names. Design D-1 now states the order and the clamp as the code has them.

Deletion tests: no new module or home in the range. The inline `inside` predicate is the only new structure, and it is a second copy of a closure already in the same file (F9, nit).

Grill: F10 is kept as a nit, not raised, because design D-1 says the settings are still read from findRoot's folder, and the Setup section reads every value it needs through setup-block.mjs plan <project-root>, which uses root. F2-F4 are unchanged, because setup-block.mjs and kit-installer.mjs are untouched in the range. F1 and F5 stay fixed at 387bf15.

Tests run once, scoped, with no other test-suite run on the machine (load 0.28): TMPDIR=/var/tmp/devkit-project-setup node scripts/test-suite.mjs --concurrency=3 plugins/openspec/hooks/change-loop.test.mjs: 1 file, 212 tests, 212 pass, 0 fail, 302.9 s.

Remit: product code, skill texts and contracts touched by the range, and the plan's design. Outside this reviewer's remit, so neither read nor listed: evidence.md and proof/, review.md and the other reviewers' files.

No escalation: no locked ADR is contradicted, the fix stays inside design D-1 as restated, and no owner is ambiguous.
