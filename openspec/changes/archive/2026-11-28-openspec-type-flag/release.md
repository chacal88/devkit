# Release note

packs:
- devkit-core: patch
- devkit-openspec: patch
- devkit-compozy: patch

## a change's validation names its type

- **devkit-core**: the `plan-readiness-reviewer` and `change-planner` agents and the `plan-readiness-review`
  and `review-change` skills run `openspec validate <id> --type change --strict` (the skills with
  `--no-interactive`), so a change whose id is also a spec's name no longer fails with `ambiguous_item`.
  The skills drop their fallback to the form without `--type change`.
- **devkit-openspec**: the `openspec-validator` agent runs and reports `openspec validate <change-id> --type change --strict`,
  and the plan stages of the `devkit` and `devkit-lite` schemas gate on `openspec validate <id> --type change --strict`.
  No flow version changes.
- **devkit-compozy**: the CompozyOS agents `change-planner`, `plan-readiness-reviewer` and `openspec-validator`
  are regenerated from those agents.
- Repository: `scripts/check.py` fails, naming the file and the line, on an `openspec validate` command that
  names an id without `--type change` in an agent, skill, schema or CompozyOS agent file. The new
  `plugins/openspec/hooks/validate-type.test.mjs` tests the check and the texts, and it shows on the real CLI that a change and a spec of one id
  are ambiguous without the type.
