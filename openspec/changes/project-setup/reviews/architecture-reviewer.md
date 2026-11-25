Verdict: approved
Commit: 76e88ad3fdab3ffd0ced32b6418bc4c38cef11da

## Architecture review — project-setup round 2 (02e6780..76e88ad)

### Findings
- [important] plugins/openspec/skills/devkit/scripts/setup-block.mjs:101 — ciPinOf read the CI pin with its own regex, a second pin reader beside the one pin definition (PIN_MARKER/pinsIn) that ADR 0027 decision 6 put in deliver-check.mjs; a change of the pin line would leave the setup's ciPin silently null. · fixed in 387bf1553e85d7610c5ee64c0bf5e4b6f6a444d7
- [nit] plugins/openspec/skills/devkit/scripts/setup-block.mjs:96 — defaultBranch re-implements change-loop.mjs#defaultBase with a narrower fallback (origin/HEAD else 'main', no local main/master probe), so in a master-only repository without origin/HEAD the two-prs base the setup proposes differs from the loop's; design D-3 states the narrower rule, so import defaultBase as a follow-up.
- [nit] plugins/openspec/skills/devkit/scripts/setup-block.mjs:30 — TRAIN_MODELS = ['trunk', 'trunk-auto'] is a third copy of the train's model rule that guard.mjs trainSetting hardcodes inline; export the list from guard.mjs beside DELIVERY_MODELS and import it here so the offered options and the gate's accepted values cannot drift.
- [nit] plugins/openspec/skills/devkit/scripts/kit-installer.mjs:44 — compareVersions is a second dotted-version comparator in devkit-openspec beside merge-setup.mjs versionOlder, with different edge rules; when either is next touched, make one comparator and have both import it.
- [nit] docs/adr/0026-the-devkit-test-suite-runs-by-file-in-parallel.md:29 — ADR 0026 decisions 1 and 6 named the two setup skills' script folders this change moves, with no dated Note and no mention in ADR 0031's Amends line. · fixed in 387bf1553e85d7610c5ee64c0bf5e4b6f6a444d7
- [praise] plugins/openspec/hooks/merge-setup.mjs:24 — SETUP_POINTER and withoutSetupPointer cut the two regex copies that project-loop.mjs and train-loop.mjs carried: the pointer text has one owner.
- [praise] plugins/openspec/hooks/change-loop.mjs:2061 — BUILT_DRIVERS is derived from DRIVERS and DRIVER_ROUND at the gate's own owner and imported by setup-block, so the setup's driver question and the loop's driver-not-built gate cannot disagree.
- [praise] plugins/openspec/hooks/guard.mjs:122 — The CRLF fix lands in the two owners of the devkit block's reading (guard parseDevkitBlock, flow-check readTestSettings), not in a normalisation inside setup-block, so every reader of the block gains it at once.

Analyzed (re-review, bounded to the round-1 findings and the lines changed since 02e6780): the fix commit 387bf15, the owner's wording commit 45cbd1c (design D-14 note and the spec's typed-only requirement), the evidence commit 76e88ad (no code), and the base merge 22d0706 (train 18).

Owners: setup-block.mjs#ciPinOf now reads the CI pin through deliver-check.mjs#pinsIn, the one pin reader (PIN_MARKER/PIN_TOKEN, ADR 0027 decision 6); templates/devkit-reviews.yml's only pin line ('# pinned to the commit of {{tag}}') matches PIN_MARKER, so the first pin of the workflow is the tag github-setup.mjs wrote, and setup-block.test.mjs pins it ('the pin reader of deliver-check, not a second one'). The CRLF reading is fixed in the block's own readers (guard.mjs parseDevkitBlock, flow-check.mjs readTestSettings), not worked around in the writer. setup-block's checkBlock gains the inline map/list refusal inside its existing refusal set, which is where it belongs. change-loop.mjs#startMode's setup branch now decides on git's toplevel alone and keeps `start` only as the root, which fixes the no-repo case without a new mode.

Boundaries: setup-block still imports hooks through ../../../hooks and adds only `pinsIn` from deliver-check.mjs; deliver-check.mjs, guard.mjs and merge-setup.mjs (downloaded by consumer CI) gain no import; no hook imports a skill script.

Contract consumers: pinsIn already serves release-merge and the flow page; its new consumer only reads. The startMode 'setup'/'setup-no-repo' modes are still consumed only by the devkit skill's Start list. ADR 0026 has a dated Note and an 'Amended by ADR 0031' line, ADR 0031's Amends line names 0026, and openspec/config.yaml's ADR list says the same. The merge of the base touched CONTRIBUTING.md, which keeps this change's folder names (skills/devkit/scripts, compozy/kit/scripts, '/devkit setup'). The three test-tmp.mjs copies it names still exist (plugins/compozy/skills/test-tmp.mjs stays). openspec/trains/18.md is main's record only.

Deletion tests: no new module in this round; setup-block.mjs's ciPinOf now does less (one call to the owner), which is the direction F1 asked for.

Grill: the 45cbd1c narrowing of the typed-only requirement (the skill is not model-invocable; a hook refusing hand-run setup scripts is a retro proposal) is the owner's recorded decision (D-14 note, 'Ajustar o texto (A)'), so it is not re-litigated here. It adds no seam and no home. F2's narrower default-branch rule stays a nit because design D-3 states it.

Tests run once, scoped, with no other suite running on the machine: TMPDIR=/var/tmp/devkit-project-setup node scripts/test-suite.mjs --concurrency=3 on setup-block.test.mjs and flow-check.test.mjs: 2 files, 177 tests, 177 pass, 0 fail.

Remit: product code, skill texts, contracts (specs, ADRs, docs, CI, manifests) and the plan's design and spec. Outside this reviewer's remit, so neither read nor listed: test bodies other than setup-block.test.mjs, evidence.md and proof/ (evidence), tasks.md (plan readiness), review.md and the other reviewers' files, and the archived suite-socket-path folder that the base merge brought.

No escalation: no locked ADR is contradicted, the round's changes stay inside the approved plan and the owner's recorded D-14 choice, and no owner is ambiguous.
