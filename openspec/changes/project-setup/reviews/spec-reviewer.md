Verdict: approved
Commit: 2079b0f84d05c024a14338da7f9117b44b14c137

## Spec review — project-setup

### Findings
- [blocking] openspec/changes/project-setup/specs/project-setup/spec.md:24 (Requirement: The setup skill is invoked only from the owner's typed command, scenario "A request that is not the typed command") — Gap: a plain-words request wrote a setup's files (proof/r6-typed-only.txt, evidence F-1) while the requirement promised no agent or session could start the setup and the scenario promised no file written; enforce it or amend the spec to AC-1's wording. · fixed in 45cbd1c86593727bbf88fe940be4a4a29f196052
- [important] plugins/openspec/hooks/change-loop.mjs:2113 vs openspec/changes/project-setup/specs/change-coordination/spec.md:39 (scenario "The setup verb outside a git repository") — Partial: a git-less folder holding openspec/changes answered mode setup instead of setup-no-repo because findRoot ran before the git top-level check. · fixed in 387bf1553e85d7610c5ee64c0bf5e4b6f6a444d7
- [important] openspec/changes/project-setup/specs/project-setup/spec.md:47 and :300; plugins/openspec/skills/devkit/SKILL.md step 3/5 — Ambiguity resolved outside the spec: openspec init writes the config before step 5, so the template path (commented budget/design and tests keys) is never taken on a first install; the spec did not say which reading stands. · fixed in 45cbd1c86593727bbf88fe940be4a4a29f196052
- [nit] plugins/openspec/skills/devkit/SKILL.md:251 (step 8) — Step 8 still does not say to skip the follow-up project-settings.mjs run that enables devkit-compozy when kit-installer.mjs exits 3; scenario "devkit-compozy not installed" says the setup writes nothing for the kit (SKILL.md unchanged in 76e88ad..2079b0f).
- [praise] plugins/openspec/skills/devkit/scripts/setup-block.mjs — The block writer follows the spec closely (exit 3 refusals, exit 2 usage, CRLF kept, empty file, kept/train narrowing, fill), with CRLF-aware shared readers and the CI pin routed through deliver-check's one pin reader, each pinned by a test.

In-scope specs: openspec/changes/project-setup/specs/project-setup/spec.md, openspec/changes/project-setup/specs/compozy-kit-setup/spec.md, openspec/changes/project-setup/specs/change-coordination/spec.md, openspec/specs/project-setup/spec.md, openspec/specs/compozy-kit-setup/spec.md, openspec/specs/change-coordination/spec.md. Decisions: docs/adr/0031-one-setup-verb-replaces-the-two-setup-skills.md, docs/adr/0004-devkit-per-project.md, docs/adr/0026-the-devkit-test-suite-runs-by-file-in-parallel.md (amended by 0031).

Scope of this round (staleness re-review): the previous findings and the range 76e88ad..2079b0f. The only product-code commit in it is ac5958e (code-quality F6). It changes startMode's setup branch in plugins/openspec/hooks/change-loop.mjs: findRoot's folder is the root only when it is the git top level or inside it, otherwise the top level is the root. It also adds one test (N-20). The rest of the range is plan text (design D-1 restated, N-3 note, N-20 row), evidence attempt 4 and review files.

### Coverage
| Requirement | Status |
|-------------|--------|
| project-setup: One typed verb sets a project up | covered |
| project-setup: The setup skill is invoked only from the owner's typed command | covered (narrowed in 45cbd1c) |
| project-setup: The setup asks each key of the devkit block | covered |
| project-setup: A re-run keeps every value and asks only what is missing | covered |
| project-setup: A re-run writes outside the block only what is unset | covered |
| project-setup: The driver question offers only drivers that run | covered |
| project-setup: The CompozyOS kit is a question of its own | covered (F4 nit still open) |
| project-setup: The setup copies no checker and names what the project uses | covered |
| project-setup: In merge mode each GitHub item is confirmed on its own | covered |
| project-setup: The block writer refuses what it cannot read or accept | covered |
| project-setup: The removed setup skills are named nowhere | covered |
| project-setup: A project set up with the old skills keeps working | covered |
| project-setup (MODIFIED): The changes under way are listed before the schemas are replaced | covered |
| project-setup (MODIFIED): The project script is installed beside the two others | covered |
| project-setup (MODIFIED): The setup asks for the project's test commands | covered |
| project-setup (MODIFIED): The setup names a gh too old for the delivery | covered |
| project-setup: canonical requirements not modified (GitHub report, proposed checks) | covered |
| compozy-kit-setup (MODIFIED, six blocks) and (ADDED) the kit installer ships in devkit-compozy | covered (unchanged this range) |
| change-coordination (MODIFIED): The devkit command reads its verb | covered (scenario "The setup verb": typed in any folder of a git repository, the inner one of a nested pair included, setup still answers the setup mode and creates nothing, pinned by N-20; scenario "The setup verb outside a git repository" unchanged, N-3) |
| change-coordination (MODIFIED): The command runs only in a project set up for devkit | covered (unchanged this range) |

Checks run on this head (2079b0f):
- `openspec validate project-setup --type change --strict`: valid.
- `TMPDIR=/var/tmp/devkit-project-setup node scripts/test-suite.mjs --concurrency=3 --test-name-pattern="^setup AC-1 start" plugins/openspec/hooks/change-loop.test.mjs`, with no other suite run on the machine: 1 file, 6 tests, 6 pass. The new nested-repository test is among them.

The ac5958e root rule adds no scope creep. The specs do not say which folder is the root for a repository nested in a folder that holds openspec/changes. The change-coordination scenario "The setup verb" requires only the setup mode in any folder of a git repository, with nothing created by the script, and that still holds. design.md D-1 now records the rule (findRoot's folder only when at or under the git top level, otherwise the top level, with settings still read from findRoot's folder) and its reason (code-quality F6). The ambiguity is resolved in the plan rather than silently, so it is not flagged. No spec or ADR conflict: ADR 0031 does not address the root.

### Summary
- 5 findings: 0 scope creep. Previous gaps F1 (blocking, fixed in 45cbd1c) and F2 (important, fixed in 387bf15); ambiguity F3 fixed in 45cbd1c; 1 nit still open (F4); 1 praise (F5). No new findings in 76e88ad..2079b0f.
