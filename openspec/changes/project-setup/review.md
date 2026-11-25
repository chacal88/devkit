<!-- devkit-stage review result=failed attempt=5 commit=2079b0f84d05c024a14338da7f9117b44b14c137 -->
# Review: project-setup, round 1

Path: agents · range `3ca2e47e35e95cf53cf745a23838909c88dcd5ce..02e67807136fa670f73202efc2601e0f3b1936c0` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| adr-reviewer | rejected | 0 | 2 | 2 | 0 | 02e6780 |
| spec-reviewer | rejected | 1 | 2 | 3 | 0 | 02e6780 |
| code-quality-reviewer | rejected | 1 | 2 | 3 | 0 | 02e6780 |
| test-coverage-reviewer | rejected | 0 | 2 | 2 | 0 | 02e6780 |
| architecture-reviewer | rejected | 0 | 1 | 1 | 0 | 02e6780 |
| security-reviewer | approved | 0 | 0 | 0 | 0 | 02e6780 |

Consensus: FAIL (round 1/2)

## Open findings
- adr-reviewer — [important] docs/adr/0026-the-devkit-test-suite-runs-by-file-in-parallel.md § Decision 1 and 6 (lines 29, 52); scripts/test-suite.mjs:21 — ADR 0026's Decision (`docs/adr/0026-the-devkit-test-suite-runs-by-file-in-parallel.md`) names the suite's folders as the two removed setup folders, and this change moves SUITE_FOLDERS to `plugins/openspec/skills/devkit/scripts` and `plugins/compozy/kit/scripts`. Unlike ADR 0004, which got a dated Note and an Amended-by line for the same kind of stale Decision text, ADR 0026 gets neither, and ADR 0031's Amends line (`docs/adr/0031-one-setup-verb-replaces-the-two-setup-skills.md`) does not list it. The tests that run are the same, so this is drift from the record, not a violation. Fix: add a dated Note to ADR 0026 naming the two new folders (same files, moved by project-setup) and its Amended-by line, and name ADR 0026 in ADR 0031's Amends line.
- adr-reviewer — [important] plugins/openspec/skills/devkit/SKILL.md:218, :239, :242 (Setup steps 5 and 7); plugins/openspec/skills/devkit/scripts/setup-block.mjs:165, :226 — Tension with ADR 0002 (`docs/adr/0002-merge-without-the-owner-opt-in.md`) § Decision (merge by opt-in, blocked not downgraded, the owner's merge stays the default). Step 5 now suggests `merge` and writes `ship: merge` before step 7 reads whether GitHub allows the ruleset. On `ruleset: blocked`, step 7 tells the session to stay in `plan` or `pr` mode, but setup-block.mjs `check` refuses an answer for a `ship` map already present. A re-run therefore cannot carry that out, and the project stays opted into a merge mode where every delivery stops at `stop-merge-setup`. The design cites ADR 0002 but does not address this ordering. Fix: in step 7's ruleset-blocked bullet, have the session say that the owner changes the written `ship:` map to `pr` or `plan` by hand, or ask `ship` only after step 7's read-only plan.
- spec-reviewer — [blocking] openspec/changes/project-setup/specs/project-setup/spec.md:32 (Requirement: The setup runs only from the owner's typed command) — Gap: scenario "A request that is not the typed command" is not delivered. Its THEN "no file of the setup is written" and the requirement's "no agent, stage or other session can start the setup" fail in proof/r6-typed-only.txt, where a plain-words request in a fresh repository made the session run the Setup section's scripts by hand and write .claude/settings.json, openspec/ (schemas, config) and .agents/skills (evidence.md F-1). The change adds nothing that enforces it. Add the enforcement (a hook that refuses the setup scripts without a typed /devkit setup) or amend the scenario to AC-1's "as /devkit change is"; the owner decides which.
- spec-reviewer — [important] plugins/openspec/hooks/change-loop.mjs:2113 (startMode setup branch) vs openspec/changes/project-setup/specs/change-coordination/spec.md:39 — Partial: scenario "The setup verb outside a git repository". startMode takes findRoot(cwd) before the git top level, so a non-git folder holding openspec/changes answers mode setup instead of setup-no-repo (probed on this head). Design D-1 settled that order, but the spec does not allow the exception: align the spec or the code.
- spec-reviewer — [important] openspec/changes/project-setup/specs/project-setup/spec.md:47 and :296; plugins/openspec/skills/devkit/SKILL.md:196,208 — Ambiguity resolved outside the spec: step 3's openspec init writes openspec/config.yaml before step 5, so a real first install never takes the template path. AC-3 / "A first setup with answers given" (budget and design: only on commented lines) then holds only because neither key appears, and "The starting configuration" (the commented tests keys) is reached only when no config exists at step 5. evidence.md O-4 records this reading; the spec does not say which reading stands.
- code-quality-reviewer — [blocking] openspec/changes/project-setup/specs/project-setup/spec.md:23 — The requirement 'The setup SHALL run only when the owner types /devkit setup ... no agent, stage or other session can start the setup' and its scenario (lines 32-34, 'no file of the setup is written') are contradicted by the change's own real run: proof/r6-typed-only.txt shows a plain-words session that ran setup scripts by hand (old 0.33.0 scripts in the declared case, which changed nothing only because the project was already set up). In a project not set up it wrote .claude/settings.json, openspec/ and .agents/, and in isolation it ran this change's own scripts. Task 7.6 (tasks.md:396, 'a plain-words request that ran no setup') is ticked [x] anyway (evidence F-1). Fix: the owner chooses one. Either narrow the requirement and scenario to what the change enforces (the devkit skill is not model-invocable, as for /devkit change) and check 7.6 against that wording, or add the hook that refuses the setup scripts without a typed /devkit setup. 7.6 cannot stay ticked against the current wording.
- code-quality-reviewer — [important] plugins/openspec/skills/devkit/scripts/setup-block.mjs:115 — CRLF files are declared supported ('CRLF line endings are kept', written() at :338), but planOf passes the raw CRLF text to parseDevkitBlock, whose key regex (guard.mjs:127, `(.*)$` without stripping \r) matches no line. readTestSettings fails the same way. Reproduced: after apply on 'schema: devkit-lite\r\ndevkit:\r\n language: en\r\n', the plan reports language, driver and tests.unit as missing. A second apply with {language:'pt-BR'} is accepted and writes a duplicate 'language:' key (PyYAML with a duplicate check rejects the file). On a CRLF checkout every re-run asks every key again and appends duplicates, which breaks AC-4. The CRLF test (setup-block.test.mjs:230) checks only the bytes of one write. Fix: strip \r in the shared reader (parseDevkitBlock and readTestSettings), or refuse a CRLF config with exit 3 until they read it; add a test that runs plan after apply on the CRLF fixture.
- code-quality-reviewer — [important] plugins/openspec/skills/devkit/scripts/setup-block.mjs:261 — checkBlock refuses an inline value only on the devkit: line itself. A nested flow map such as 'tests: { unit: "npm test" }' is not read (tests.unit is reported missing), and insertPath then writes ' coverage:' under that inline-valued key. The resulting file is invalid YAML (PyYAML: 'expected <block end>, but found <block mapping start>'), which also breaks the openspec CLI, even though the function's own comment says it refuses 'a block the writer cannot edit without guessing'. Fix: refuse (exit 3, 'edit the block by hand') any line of the block whose value starts with '{' or '[', and add the case to the refusal test at setup-block.test.mjs:248.
- test-coverage-reviewer — [important] plugins/openspec/skills/devkit/scripts/setup-block.mjs:326 — [7] The default delivery answer is never tested. The skill sends {"model":"none"} (every real run did), and lines 326 and 357 keep it from being written. No test sends 'none' to a project with no delivery train: if both lines broke, apply would write `model: none` and exit 0, and readDevkitSettings would then report delivery-model 'none' as unknown, so the next /devkit change refuses. Write in: setup-block.test.mjs, a 'setup AC-3 block apply' test that sends {delivery:{model:'none'}, language:'en'} to project(null), checks that `added` lacks delivery and that readDevkitSettings(root).unknown is [], and checks the exact file text as the first apply test does.
- test-coverage-reviewer — [important] plugins/openspec/skills/devkit/scripts/setup-block.mjs:145 — [6] The spec scenario 'A delivery model chosen' has no test, at the unit level or in a real run. In one apply call, an answered model should change what else may be answered (lines 145-148): {delivery:{model:'trunk-auto'}, merge_method:'squash'} should be accepted and write no ship: map, and {delivery:{model:'trunk'}, ship:'merge'} should be refused. The existing B-9 test only reads plan() with the model already in the file. If answeredModel broke (say, always null), trunk-auto setups would be refused with exit 3 and trunk plus ship:merge would write a ship map next to the model, and setup-block.test.mjs would stay green. Write in: setup-block.test.mjs, one apply test with the two cases, using applied() and refused() and checking deliveryConfig(root,'devkit').
- architecture-reviewer — [important] plugins/openspec/skills/devkit/scripts/setup-block.mjs:101 — friction: ciPinOf reads the CI pin with its own regex (`# pinned to the commit of (\S+)`), a second pin reader beside the one pin definition (PIN_MARKER/pinsIn) that ADR 0027 decision 6 put in deliver-check.mjs:1569, which this script already imports - why: single owner/leverage: a change of the workflow template's pin line (deliver-check, release-merge and the flow page move together through pinsIn/setPins) leaves the setup's ciPin silently null, and the version report of step 9 drifts - direction: take the pin from deliver-check.mjs#pinsIn (the first pin of the workflow's text) instead of a local regex.

## Refuted by verification
None.

## Notes
- Agents path: this round ran on a turn the owner did not type.
- A first attempt at d2f9c5d was stopped before any verdict, because the base moved (train 17); this round is the one on the final base.
- Each stage-3 writer read its prompt, unchanged, from the file the round script printed it to, because of its length.

## Next
Fix the open findings, then run review-change again (round 2).

# Review: project-setup, round 2

Path: agents · range `fc287351f9aee0c2cf1f38eb0a4c28d23f172205..76e88ad3fdab3ffd0ced32b6418bc4c38cef11da` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| adr-reviewer | approved | 0 | 0 | 0 | 0 | 76e88ad |
| spec-reviewer | approved | 0 | 0 | 0 | 0 | 76e88ad |
| code-quality-reviewer | rejected | 0 | 1 | 1 | 0 | 76e88ad |
| test-coverage-reviewer | approved | 0 | 0 | 0 | 0 | 76e88ad |
| architecture-reviewer | approved | 0 | 0 | 0 | 0 | 76e88ad |
| security-reviewer | approved | 0 | 0 | 0 | 0 | 76e88ad |

Consensus: FAIL (round 2/2)

## Open findings
- code-quality-reviewer — [important] plugins/openspec/hooks/change-loop.mjs:2114 — The no-repo check tests cwd, but root is start ?? top and findRoot climbs past the repository's top: a git repo nested in a folder holding openspec/changes (reproduced: outer non-git folder) or in another devkit project (a submodule) gets mode setup with the outer folder as root, so the setup writes outside the repo the owner typed in. Fix: use start only when it is top or inside it, else top; add the nested-repo case to the setup-no-repo test.

## Refuted by verification
None.

## Notes
- Agents path: this round ran on a turn the owner did not type.
- Round 2 re-reviewed the round-1 findings and the lines changed since 02e6780 (387bf15 fixes, 45cbd1c owner choice A, 22d0706 train-18 merge, 76e88ad evidence).
- Each stage-3 writer read its prompt, unchanged, from the file the round script printed it to, because of its length.

## Next
Consensus deadlock after round 2: the owner decides.

# Review: project-setup, round 3 (owner-authorized)

Path: agents · range `fc287351f9aee0c2cf1f38eb0a4c28d23f172205..b8253f7b8dae299ada82c6d9bab4a8e0533259df` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| code-quality-reviewer | rejected | 1 | 0 | 1 | 0 | b8253f7 |

Consensus: FAIL (round 2/2)

## Open findings
- code-quality-reviewer — [blocking] openspec/changes/project-setup/design.md:175 — D-1 still says root is findRoot(cwd), else the git top, else null (no-repo), but the code checks the git top first (387bf15) and now drops a findRoot answer above the top (ac5958e): the approved design names the outer folder as root in the case F6 fixed; fix: restate D-1 as the code does it and add the new nested-repository test to the N table (lines 810-827).

## Refuted by verification
None.

## Notes
- Round 3, authorized by the owner ("Sim, terceira rodada", typed in the conducting session on 2026-11-25); the round script accepts only rounds 1 and 2, so it prints 2/2. Only code-quality-reviewer ran: the other five approved in round 2 and no product line they reviewed changed except the F6 fix (ac5958e).
- F10 is plan text only: design.md D-1 still stated the old setup root rule; 78001de restates it as the code does.

## Next
Consensus deadlock after round 2: the owner decides.

# Review: project-setup, round 4 (owner-authorized)

Path: agents · range `fc287351f9aee0c2cf1f38eb0a4c28d23f172205..816d17933190f34f883f55651ac90c99d3bfd5d5` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| code-quality-reviewer | approved | 0 | 0 | 0 | 0 | 816d179 |

Consensus: PASS (round 2/2)

## Open findings
None.

## Refuted by verification
None.

## Notes
- Round 4, authorized by the owner ("Sim", typed in the conducting session on 2026-11-25, to a fourth round limited to code-quality-reviewer and F10); the round script accepts only rounds 1 and 2, so it prints 2/2.
- With this round every reviewer is approved: adr, spec, test-coverage, architecture and security in round 2 (their files unchanged since; only plan text and review files changed after, and ac5958e touched only the setup branch code-quality re-reviewed), code-quality here.

## Next
Ready to ship.

# Review: project-setup, staleness re-review (round 1)

Path: agents · range `fc287351f9aee0c2cf1f38eb0a4c28d23f172205..2079b0f84d05c024a14338da7f9117b44b14c137` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| adr-reviewer | approved | 0 | 0 | 0 | 0 | 2079b0f |
| architecture-reviewer | approved | 0 | 0 | 0 | 0 | 2079b0f |
| security-reviewer | approved | 0 | 0 | 0 | 0 | 2079b0f |
| spec-reviewer | approved | 0 | 0 | 0 | 0 | 2079b0f |
| test-coverage-reviewer | rejected | 0 | 1 | 1 | 0 | 2079b0f |

Consensus: FAIL (round 1/2)

## Open findings
- test-coverage-reviewer — [important] plugins/openspec/hooks/change-loop.mjs:2119 — [5] The 'inside' branch that ac5958e made explicit (findRoot's folder strictly below the git top level, as design D-1 states) has no test: if `root: inside ? start : top` became `root: top`, every setup test stays green (the existing cases have start == top, a null start, or an outer start), and in a repository holding app/openspec/changes, setup typed in app/ would write its config at the repository top. Write in: change-loop.test.mjs next to N-20, as a 'setup AC-1 start:' test: plainGitRepo() plus mkdir app/openspec/changes, startRun(join(root, 'app'), 'setup') and startRun(join(root, 'app', 'src'), 'setup') both answer [mode, root] = ['setup', join(root, 'app')].

## Refuted by verification
None.

## Notes
- A staleness re-review (round 1 by the skill rule: Commit lines went stale after ac5958e), for the five reviewers approved at 76e88ad; code-quality-reviewer is approved at 816d179 (owner-authorized round 4).

## Next
Fix the open findings, then run review-change again (round 2).
