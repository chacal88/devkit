Verdict: rejected
Commit: 02e67807136fa670f73202efc2601e0f3b1936c0

## Spec review — project-setup

### Findings
- [blocking] openspec/changes/project-setup/specs/project-setup/spec.md:32 (Requirement: The setup runs only from the owner's typed command) — Gap: scenario "A request that is not the typed command" is not delivered. Its THEN "no file of the setup is written" and the requirement's "no agent, stage or other session can start the setup" fail in proof/r6-typed-only.txt, where a plain-words request in a fresh repository made the session run the Setup section's scripts by hand and write .claude/settings.json, openspec/ (schemas, config) and .agents/skills (evidence.md F-1). The change adds nothing that enforces it. Add the enforcement (a hook that refuses the setup scripts without a typed /devkit setup) or amend the scenario to AC-1's "as /devkit change is"; the owner decides which.
- [important] plugins/openspec/hooks/change-loop.mjs:2113 (startMode setup branch) vs openspec/changes/project-setup/specs/change-coordination/spec.md:39 — Partial: scenario "The setup verb outside a git repository". startMode takes findRoot(cwd) before the git top level, so a non-git folder holding openspec/changes answers mode setup instead of setup-no-repo (probed on this head). Design D-1 settled that order, but the spec does not allow the exception: align the spec or the code.
- [important] openspec/changes/project-setup/specs/project-setup/spec.md:47 and :296; plugins/openspec/skills/devkit/SKILL.md:196,208 — Ambiguity resolved outside the spec: step 3's openspec init writes openspec/config.yaml before step 5, so a real first install never takes the template path. AC-3 / "A first setup with answers given" (budget and design: only on commented lines) then holds only because neither key appears, and "The starting configuration" (the commented tests keys) is reached only when no config exists at step 5. evidence.md O-4 records this reading; the spec does not say which reading stands.
- [nit] plugins/openspec/skills/devkit/SKILL.md:249 (step 8) — Step 8 does not say to skip the follow-up project-settings.mjs run that enables devkit-compozy when kit-installer.mjs exits 3. Scenario "devkit-compozy not installed" says the setup writes nothing for the kit, which enabling the pack would break.
- [praise] plugins/openspec/skills/devkit/scripts/setup-block.mjs — The block writer follows the spec closely: refusals with exit 3, usage errors with exit 2, CRLF kept, the empty file, the kept and train narrowing, and fill. The six MODIFIED compozy-kit-setup blocks and both change-coordination blocks keep every canonical scenario, and only the change-coordination verb block adds scenarios (the two setup ones).

In-scope specs: openspec/changes/project-setup/specs/project-setup/spec.md, openspec/changes/project-setup/specs/compozy-kit-setup/spec.md, openspec/changes/project-setup/specs/change-coordination/spec.md, openspec/specs/project-setup/spec.md, openspec/specs/compozy-kit-setup/spec.md, openspec/specs/change-coordination/spec.md; decisions: docs/adr/0031-one-setup-verb-replaces-the-two-setup-skills.md, docs/adr/0004-devkit-per-project.md; open point answered: docs/coordination-design.md (Open points, Project setup).

### Coverage
| Requirement | Status |
|-------------|--------|
| project-setup: One typed verb sets a project up | covered |
| project-setup: The setup runs only from the owner's typed command | partial (F1) |
| project-setup: The setup asks each key of the devkit block | covered (F3 on the commented budget/design wording) |
| project-setup: A re-run keeps every value and asks only what is missing | covered |
| project-setup: A re-run writes outside the block only what is unset | covered |
| project-setup: The driver question offers only drivers that run | covered |
| project-setup: The CompozyOS kit is a question of its own | covered (F4) |
| project-setup: The setup copies no checker and names what the project uses | covered |
| project-setup: In merge mode each GitHub item is confirmed on its own | covered (R-3 asked auto-merge and delete-branch; the ruleset question is proven by tests, evidence O-1) |
| project-setup: The block writer refuses what it cannot read or accept | covered |
| project-setup: The removed setup skills are named nowhere | covered |
| project-setup: A project set up with the old skills keeps working | covered |
| project-setup (MODIFIED): The changes under way are listed before the schemas are replaced | covered |
| project-setup (MODIFIED): The project script is installed beside the two others | covered |
| project-setup (MODIFIED): The setup asks for the project's test commands | covered (F3 on "The starting configuration") |
| project-setup (MODIFIED): The setup names a gh too old for the delivery | covered |
| project-setup: canonical requirements not modified (GitHub report, proposed checks) | covered (moved tests pass in their new place) |
| compozy-kit-setup (MODIFIED): The kit records what it installed | covered |
| compozy-kit-setup (MODIFIED): A re-run updates the files the project did not edit | covered |
| compozy-kit-setup (MODIFIED): A re-run never replaces an edited file without the owner's yes | covered |
| compozy-kit-setup (MODIFIED): A re-run removes the retired files the project did not edit | covered |
| compozy-kit-setup (MODIFIED): A retired file the project edited stays and is named | covered |
| compozy-kit-setup (MODIFIED): Inputs the kit no longer uses are dropped | covered |
| compozy-kit-setup (ADDED): The kit installer ships in devkit-compozy with no setup skill | covered |
| change-coordination (MODIFIED): The devkit command reads its verb | partial (F2) |
| change-coordination (MODIFIED): The command runs only in a project set up for devkit | covered |

Checks run on this head:
- `openspec validate project-setup --type change --strict`: valid.
- `node scripts/test-suite.mjs --concurrency=3 --test-name-pattern="^setup "` on setup-block, kit-installer, project-settings, change-loop, project-loop, delivery-train and guard (TMPDIR /var/tmp/devkit-project-setup, no other suite running): 7 files, 42 tests, 42 pass.
- A probe of startMode: a git-less folder with openspec/changes answers `setup` (F2); an empty git-less folder answers `setup-no-repo`.
- `git grep` for the old names outside the exempt history lists only the canonical blocks the deltas MODIFY and the D-9 fixtures.
- Every scenario line of each canonical block the deltas MODIFY is present in the delta.

No scope creep found: every new behaviour (the setup mode, setup-no-repo, BUILT_DRIVERS, setup-block.mjs, kit-installer.mjs with --where, the Setup section, the template's commented examples, the documents and the releases) traces to a requirement, or to design D-1 to D-15 under an approved plan. ADR 0031 is accepted and ADR 0004 carries its Note and its Amended by line.

### Summary
- 4 findings (0 scope creep, 2 gaps: F1 blocking, F2 partial), plus 1 ambiguity (F3), 1 nit (F4) and 1 praise (F5).
