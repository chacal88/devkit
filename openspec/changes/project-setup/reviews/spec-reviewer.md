Verdict: approved
Commit: 76e88ad3fdab3ffd0ced32b6418bc4c38cef11da

## Spec review — project-setup

### Findings
- [blocking] openspec/changes/project-setup/specs/project-setup/spec.md:24 (Requirement: The setup skill is invoked only from the owner's typed command, scenario "A request that is not the typed command") — Gap: a plain-words request wrote a setup's files (proof/r6-typed-only.txt, evidence F-1) while the requirement promised no agent or session could start the setup and the scenario promised no file written; enforce it or amend the spec to AC-1's wording. · fixed in 45cbd1c86593727bbf88fe940be4a4a29f196052
- [important] plugins/openspec/hooks/change-loop.mjs:2113 vs openspec/changes/project-setup/specs/change-coordination/spec.md:39 (scenario "The setup verb outside a git repository") — Partial: a git-less folder holding openspec/changes answered mode setup instead of setup-no-repo because findRoot ran before the git top-level check. · fixed in 387bf1553e85d7610c5ee64c0bf5e4b6f6a444d7
- [important] openspec/changes/project-setup/specs/project-setup/spec.md:47 and :300; plugins/openspec/skills/devkit/SKILL.md step 3/5 — Ambiguity resolved outside the spec: openspec init writes the config before step 5, so the template path (commented budget/design and tests keys) is never taken on a first install; the spec did not say which reading stands. · fixed in 45cbd1c86593727bbf88fe940be4a4a29f196052
- [nit] plugins/openspec/skills/devkit/SKILL.md:251 (step 8) — Step 8 still does not say to skip the follow-up project-settings.mjs run that enables devkit-compozy when kit-installer.mjs exits 3; scenario "devkit-compozy not installed" says the setup writes nothing for the kit.
- [praise] plugins/openspec/skills/devkit/scripts/setup-block.mjs — The block writer follows the spec closely (exit 3 refusals, exit 2 usage, CRLF kept, empty file, kept/train narrowing, fill); this round adds the CRLF-aware shared readers and routes the CI pin through deliver-check's one pin reader, each pinned by a test.

In-scope specs: openspec/changes/project-setup/specs/project-setup/spec.md, openspec/changes/project-setup/specs/compozy-kit-setup/spec.md, openspec/changes/project-setup/specs/change-coordination/spec.md, openspec/specs/project-setup/spec.md, openspec/specs/compozy-kit-setup/spec.md, openspec/specs/change-coordination/spec.md. Decisions: docs/adr/0031-one-setup-verb-replaces-the-two-setup-skills.md, docs/adr/0004-devkit-per-project.md, docs/adr/0026-the-devkit-test-suite-runs-by-file-in-parallel.md (now amended by 0031).

Scope of this round (re-review): the previous findings and the lines changed in 02e6780..76e88ad. That range is 387bf15 (round-1 fixes), 45cbd1c (owner's choice A on the typed-only wording) and 76e88ad (evidence). The merge 22d0706 brought train 18, the suite-socket-path archive and a CONTRIBUTING.md paragraph from main. None of these is this change's behaviour.

### Coverage
| Requirement | Status |
|-------------|--------|
| project-setup: One typed verb sets a project up | covered |
| project-setup: The setup skill is invoked only from the owner's typed command | covered (narrowed in 45cbd1c; R-6 shows no Skill call in all three cases and an empty git status in R-1's project; evidence F-1 records the hand-run scripts the requirement now excludes in so many words) |
| project-setup: The setup asks each key of the devkit block | covered (both config paths now stated in the scenario) |
| project-setup: A re-run keeps every value and asks only what is missing | covered (CRLF configs now read as their LF twin by parseDevkitBlock and readTestSettings, with tests) |
| project-setup: A re-run writes outside the block only what is unset | covered |
| project-setup: The driver question offers only drivers that run | covered |
| project-setup: The CompozyOS kit is a question of its own | covered (F4 nit) |
| project-setup: The setup copies no checker and names what the project uses | covered |
| project-setup: In merge mode each GitHub item is confirmed on its own | covered (step 7 now also tells the owner a written ship: merge stays and is changed by hand when the ruleset is blocked; pinned by a guard test) |
| project-setup: The block writer refuses what it cannot read or accept | covered (the inline map/list refusal follows the requirement's "cannot read ... its devkit: block") |
| project-setup: The removed setup skills are named nowhere | covered |
| project-setup: A project set up with the old skills keeps working | covered |
| project-setup (MODIFIED): The changes under way are listed before the schemas are replaced | covered |
| project-setup (MODIFIED): The project script is installed beside the two others | covered |
| project-setup (MODIFIED): The setup asks for the project's test commands | covered ("The starting configuration" now scoped to a template-written file) |
| project-setup (MODIFIED): The setup names a gh too old for the delivery | covered |
| project-setup: canonical requirements not modified (GitHub report, proposed checks) | covered |
| compozy-kit-setup (MODIFIED, six blocks) and (ADDED) the kit installer ships in devkit-compozy | covered (unchanged this round) |
| change-coordination (MODIFIED): The devkit command reads its verb | covered (setup-no-repo outside git even with openspec/changes; test extended in 387bf15) |
| change-coordination (MODIFIED): The command runs only in a project set up for devkit | covered |

Checks run on this head (76e88ad):
- `openspec validate project-setup --type change --strict`: valid.
- `TMPDIR=/var/tmp/devkit-project-setup node scripts/test-suite.mjs --concurrency=3 --test-name-pattern="^setup "` on change-loop, setup-block, guard, flow-check and delivery-models test files, with no other suite running: 5 files, 42 tests, 42 pass.
- ADR 0031 Decision 1 ("runs only from the owner's typed command (the skill is not invocable by the model)") agrees with the narrowed requirement. No spec–ADR conflict.
- The design's D-14 note and Risks entry record the owner's choice A and the retro proposal (a hook refusing the setup scripts without a typed /devkit setup). It is not part of this change, so it is not scope creep and not a gap against the narrowed spec.

No new scope creep this round. Every behaviour 387bf15 adds traces to an existing requirement:
- CRLF reading traces to the re-run requirement and the block writer's line-endings scenario.
- The inline map/list refusal traces to "cannot read its devkit: block".
- The pin reader traces to plan ciPin.
- setup-no-repo traces to the change-coordination scenario.
- The ruleset-blocked text traces to step 7 under ADR 0002.
- The ADR 0026 note traces to the removed-names requirement and ADR 0031's Amends line.

### Summary
- 5 findings: 0 scope creep. Of the gaps, F1 (blocking, fixed in 45cbd1c) and F2 (partial, fixed in 387bf15). The ambiguity F3 is fixed in 45cbd1c. 1 nit is still open (F4) and 1 praise (F5).
