---
name: openspec-setup
description: Sets up a project to run the devkit flow on OpenSpec - opts the project into devkit in its .claude/settings.json, runs openspec init, installs the devkit and devkit-lite schemas, writes openspec/config.yaml with the project's real context (stack, test command, ADRs, conventions). Use when the user says "set up devkit", "set up openspec with devkit", "adopt the devkit flow here", or a project has no openspec/ folder and wants the flow.
---

# Set up the devkit flow in a project

Leaves the project ready for `openspec new change <name>` to run the devkit flow. Idempotent: re-running it upgrades the schemas and keeps the project's config. Devkit is per project (ADR 0004): the packs and the hooks act only where the project opts in, so nothing here is installed at user scope.

Paths below are relative to this skill's directory:
- `scripts/project-settings.mjs` writes the project's `.claude/settings.json` (step 2).
- `scripts/install-schemas.sh` installs the schemas.
- `scripts/changes-under-way.mjs` lists the changes under way and what the schema upgrade changes for each (step 4).
- `scripts/ship-entry.mjs` adds the `devkit-project` entry to the `ship:` block of `openspec/config.yaml` (step 5).
- `templates/config.yaml` is the starting `openspec/config.yaml`.
- `scripts/github-setup.mjs` plans and applies the GitHub settings of `merge` mode (step 7).

## Steps

1. **Check the CLI.** The packs start the project's own OpenSpec: the one installed in the project (`node_modules/.bin/openspec` of the checkout, or of the main checkout when this is a worktree) wins over the one on `PATH`. Run that one with `--version`.
   - A project that declares `@fission-ai/openspec` in its `package.json` and has it not installed: say so, name the file and the range, tell the user to run the project's install (`npm install` or its package manager), and stop. Never fall back to the one on `PATH`: a project that pins its CLI may forbid the global one.
   - A pinned CLI that is not 2.x: say so and tell the user to move the project's pin to 2.x (`npm i -D @fission-ai/openspec@2`); stop.
   - No pin: `openspec --version` on `PATH`. If missing, tell the user to install it (`npm i -g @fission-ai/openspec@2`, a 2.x release: the flow checker refuses another major) and stop. If the installed major is not 2, say so and ask whether to install a 2.x release.

2. **Opt the project in.** Run `node <skill-dir>/scripts/project-settings.mjs <project-root>`. It adds the `devkit` marketplace and enables `devkit-core` and `devkit-openspec` in `<project-root>/.claude/settings.json`, keeping every other key; it never touches `settings.local.json` or `~/.claude`. Show its lines and `git diff -- .claude/settings.json`, and tell the user the packs load in this project after a restart of Claude Code (or `/plugin` to accept the project's plugins). Other packs only on request: add `--packs <pack,...>`; the project flow (`/devkit project`) needs `--packs devkit-core,devkit-openspec,devkit-design`, so add `devkit-design` when the owner wants it.

3. **Initialize OpenSpec** if the project has no `openspec/` folder: `openspec init --tools claude`. If it already has one, run `openspec update` so the generated `openspec-*` skills match the installed CLI.

4. **Install the schemas** into the project. Replacing them changes the flow of the changes already under way, so first list those: `node <skill-dir>/scripts/changes-under-way.mjs <project-root>` (read-only; it covers the main checkout and every worktree).
   - With `no change under way`, install with no question: `bash <skill-dir>/scripts/install-schemas.sh <project-root>`.
   - Otherwise show every line it printed, each with its script, checkout and what the upgrade changes for it (a slice on `devkit-project` is listed as continuing on the new project script with its files kept; a change on another schema is listed as untouched), and ask the owner one question: upgrade with these effects, yes or no. Without a yes, replace nothing and write nothing.
   - On yes, run `node <skill-dir>/scripts/changes-under-way.mjs <project-root> --apply --owner-answer "<the owner's words>"` first, then `bash <skill-dir>/scripts/install-schemas.sh <project-root>`. The first writes `approval.md`, as not applying and only from that answer, for each full-script change whose implementation had started (so it continues where it was and is not asked an approval that did not exist when it began); it never overwrites a file. A full-script change with only its plan ready asks the owner's approval once, before its implementation. A short-script change begun on the previous script is not sent back to the grill.
   - A worktree gets the new schemas when its branch takes the default branch.
   - A change opened from devkit-openspec 0.29.0 on records its flow version in its `.openspec.yaml` (`x-devkit-flow`), and replacing the schemas keeps the earlier versions under `flows/`, so such a change keeps its flow until the owner moves it (`change-loop.mjs flow`, only on the owner's request). A change opened before that has no record and follows version 1.
   - The schemas are versioned with the repo, so the whole team and CI get the same flow. Use the machine-wide form (`bash <skill-dir>/scripts/install-schemas.sh --user`) only when the owner asks for it explicitly, and say why it matters: it applies to every project on the machine.

5. **Write `openspec/config.yaml`.**
   - If it doesn't exist, start from `templates/config.yaml`.
   - If it exists, keep the user's values: set `schema: devkit-lite` as the default (ask first if it names another schema), and merge in only the missing `rules` / `operations` keys.
   - Fill `context` from the repo, never with placeholders:
     - stack: `package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `pom.xml`, ...;
     - test, lint and typecheck commands: package scripts, `Makefile`, CI workflows (`.github/workflows/`);
     - ADR folder: `docs/adr/`, `docs/decisions/`, `adr/`, or "none";
     - default branch: `git symbolic-ref --short refs/remotes/origin/HEAD`, else `main`;
     - conventions: commitlint config, `CONTRIBUTING.md`, recent `git log` subjects.
   - Run the test command once. If it fails, record it in `context` as failing and tell the user.
   - Fill the `devkit:` block's `tests:` from the repository: `unit` from the test command (package scripts, `Makefile`, CI), `coverage.command` when the stack has a coverage command, `e2e` only when the project has an E2E tool configured (Playwright, Cypress, a CI E2E job). Show each proposed value and ask the owner to confirm or change it, and ask for `coverage.target` (none is a valid answer). Write only what the owner confirmed; keep every value the block already holds and ask nothing about it. A stage whose command is absent does not run.
   - The schema is also what turns the devkit hooks on (ADR 0004): `devkit-lite` or `devkit`. If the owner keeps another schema, say that the hooks will stay silent. `devkit-project` is not a default schema: a project never selects it in its config.
   - When the config has a `ship:` entry, run `node <skill-dir>/scripts/ship-entry.mjs <project-root>` and show what it prints: it adds `devkit-project: <the mode of devkit, else plan>` to the block and changes nothing else (a block that already has the key, or a config with no `ship:` entry, is left alone; an entry it cannot read stops it with its message). After the owner agrees, run it again with `--apply`.
   - A project moves the sha of `.github/workflows/devkit-reviews.yml` to the commit of the new release (the by-hand command of `docs/openspec-flow.md`'s CI section) before it sets `ship: devkit-project: merge`: on an older pin `devkit-reviews` passes a slice's pull request with a note, so the slice would merge with no review check. `ship-entry.mjs` prints this sentence when the mode it adds is `merge`.

6. **Check.**
   - With the project's CLI (step 1): `openspec schema validate devkit`, `openspec schema validate devkit-lite` and `openspec schema validate devkit-project` all pass.
   - `openspec schema which devkit` resolves under the project.
   - Run `node <skill-dir>/scripts/changes-under-way.mjs <project-root>` again: each change the owner said yes for now has its `approval.md`, and no other change got a file.
   - `.claude/settings.json` lists the packs (step 2).

7. **GitHub (merge mode).** Ask only when the owner wants `ship: merge` or asks for this step; skip it otherwise. It changes repository settings, so nothing is applied without the owner's confirmation of that item.
   - Run the plan, which reads and writes nothing: `node <skill-dir>/scripts/github-setup.mjs` (add `--method <squash|merge|rebase>` for another merge method, `--checks <a,b>` to replace the checks it found). Show every line, with its payload, and the list of checks the ruleset will require: the owner confirms that list (or gives `--checks`) before the `ruleset` item is applied.
   - The plan also prints the repository's own state before the items: `actions` (is GitHub Actions enabled for the repository) and `runs` (did the newest runs fail without a job starting a step). States: `ok`, `blocked: <why>`, `unknown: <why>`. `unknown` means GitHub did not let the plan read that state (usually missing admin rights): say so, and do not treat it as a fault. Show every `blocked` line to the owner as it is printed. Billing cannot be read from the repository's API: a `runs` line names it only as one possible cause, and the owner checks it in Settings > Billing and plans.
   - A `ruleset` that reads `blocked` means GitHub refuses rulesets for the repository's plan (the owner makes the repository public or moves to a plan with rulesets). Then `merge` mode is not available on that plan: the plan shows `auto-merge` as `deferred` and `--apply` writes neither; say so plainly and stay in `plan` or `pr` mode (ADR 0002).
   - The printed list is every check the ruleset will require, each part labelled with its source (JSON field `requires`): `devkit-reviews`, which the ruleset always requires; the checks reported on the newest pull requests (a job that runs only after the merge never appears) or given with `--checks`; and any check the existing ruleset already requires. The owner confirms the list as the plan prints it.
   - Items: `workflow` (`.github/workflows/devkit-reviews.yml`, written from the template, pinned to the commit sha of the release tag `v<devkit-openspec version>`, and never committed by the script; `deferred` while that tag does not exist), `auto-merge`, `delete-branch`, `ruleset` (`devkit`: a pull request, the existing checks plus `devkit-reviews`, up to date, no force pushes, no bypass). States: `ok`, `create`, `update`, `deferred: <why>`, `blocked: <why>`, `error`. A `deferred` item is not applied; follow its reason (for `ruleset`: commit the workflow and merge it through a normal PR first, because a required check that never reports blocks every PR).
   - Before asking, say plainly: once the `ruleset` is active, `main` will refuse direct pushes from everyone, the owner included, so every change, archive commits too, lands through a PR; and when it is applied from a PR, the other open PRs listed will wait for `devkit-reviews` until updated with the default branch.
   - Ask the owner to confirm each item that is not `ok`: one question per item. Run `node <skill-dir>/scripts/github-setup.mjs --apply <confirmed items>` with only the items that got a yes. Then run the plan again and show it; every confirmed item must read `ok`. A write error is reported per item (usually missing admin rights); report it and stop that item.
   - Add `ship` and `merge_method` to `openspec/config.yaml` only if the owner asks (the template has a commented example). Re-running the step is safe: items already `ok` are not touched.

8. **Report** what was created or changed, and the first command to run: `openspec new change <name>` (default, `devkit-lite`) or `openspec new change <name> --schema devkit` (full flow, for the changes the config's header comment lists).

## Never

- Overwrite an existing `openspec/config.yaml` wholesale, or remove the user's rules.
- Leave `<placeholder>` values in `context`.
- Commit. Show the diff and leave committing to the user.
- Install a pack at user scope, run `claude plugin install` without `--scope project`, or edit `~/.claude/` or `.claude/settings.local.json`.
- Change GitHub settings without the owner's confirmation of that item, or apply an item that was not confirmed.
