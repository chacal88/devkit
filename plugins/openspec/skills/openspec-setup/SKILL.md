---
name: openspec-setup
description: Sets up a project to run the devkit flow on OpenSpec - opts the project into devkit in its .claude/settings.json, runs openspec init, installs the devkit and devkit-lite schemas, writes openspec/config.yaml with the project's real context (stack, test command, ADRs, conventions). Use when the user says "set up devkit", "set up openspec with devkit", "adopt the devkit flow here", or a project has no openspec/ folder and wants the flow.
---

# Set up the devkit flow in a project

Leaves the project ready for `openspec new change <name>` to run the devkit flow. Idempotent: re-running it upgrades the schemas and keeps the project's config. Devkit is per project (ADR 0004): the packs and the hooks act only where the project opts in, so nothing here is installed at user scope.

Paths below are relative to this skill's directory:
- `scripts/project-settings.mjs` writes the project's `.claude/settings.json` (step 2).
- `scripts/install-schemas.sh` installs the schemas.
- `templates/config.yaml` is the starting `openspec/config.yaml`.
- `scripts/github-setup.mjs` plans and applies the GitHub settings of `merge` mode (step 7).

## Steps

1. **Check the CLI.** `openspec --version`. If missing, tell the user to install it (`npm i -g @fission-ai/openspec@latest`) and stop. If `npm view @fission-ai/openspec version` is newer than the installed version, say so and ask whether to upgrade.

2. **Opt the project in.** Run `node <skill-dir>/scripts/project-settings.mjs <project-root>`. It adds the `devkit` marketplace and enables `devkit-core` and `devkit-openspec` in `<project-root>/.claude/settings.json`, keeping every other key; it never touches `settings.local.json` or `~/.claude`. Show its lines and `git diff -- .claude/settings.json`, and tell the user the packs load in this project after a restart of Claude Code (or `/plugin` to accept the project's plugins). Other packs only on request: add `--packs <pack,...>`.

3. **Initialize OpenSpec** if the project has no `openspec/` folder: `openspec init --tools claude`. If it already has one, run `openspec update` so the generated `openspec-*` skills match the installed CLI.

4. **Install the schemas** into the project, with no question: `bash <skill-dir>/scripts/install-schemas.sh <project-root>`. It is versioned with the repo, so the whole team and CI get the same flow. Use the machine-wide form (`bash <skill-dir>/scripts/install-schemas.sh --user`) only when the owner asks for it explicitly, and say why it matters: it applies to every project on the machine.

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
   - The schema is also what turns the devkit hooks on (ADR 0004): `devkit-lite` or `devkit`. If the owner keeps another schema, say that the hooks will stay silent.

6. **Check.**
   - `openspec schema validate devkit` and `openspec schema validate devkit-lite` both pass.
   - `openspec schema which devkit` resolves under the project.
   - `.claude/settings.json` lists the packs (step 2).

7. **GitHub (merge mode).** Ask only when the owner wants `ship: merge` or asks for this step; skip it otherwise. It changes repository settings, so nothing is applied without the owner's confirmation of that item.
   - Run the plan, which reads and writes nothing: `node <skill-dir>/scripts/github-setup.mjs` (add `--method <squash|merge|rebase>` for another merge method, `--checks <a,b>` to replace the checks it found). Show every line, with its payload, and the list of checks the ruleset will require: the owner confirms that list (or gives `--checks`) before the `ruleset` item is applied.
   - Items: `workflow` (`.github/workflows/devkit-reviews.yml`, written from the template, pinned to the commit sha of the release tag `v<devkit-openspec version>`, and never committed by the script; `deferred` while that tag does not exist), `auto-merge`, `delete-branch`, `ruleset` (`devkit`: a pull request, the existing checks plus `devkit-reviews`, up to date, no force pushes, no bypass). States: `ok`, `create`, `update`, `deferred: <why>`. A `deferred` item is not applied; follow its reason (for `ruleset`: commit the workflow and merge it through a normal PR first, because a required check that never reports blocks every PR).
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
