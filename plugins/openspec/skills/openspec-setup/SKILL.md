---
name: openspec-setup
description: Sets up a project to run the devkit flow on OpenSpec - runs openspec init, installs the devkit and devkit-lite schemas, writes openspec/config.yaml with the project's real context (stack, test command, ADRs, conventions). Use when the user says "set up devkit", "set up openspec with devkit", "adopt the devkit flow here", or a project has no openspec/ folder and wants the flow.
---

# Set up the devkit flow in a project

Leaves the project ready for `openspec new change <name>` to run the devkit flow. Idempotent: re-running it upgrades the schemas and keeps the project's config.

Paths below are relative to this skill's directory:
- `scripts/install-schemas.sh` installs the schemas.
- `templates/config.yaml` is the starting `openspec/config.yaml`.

## Steps

1. **Check the CLI.** `openspec --version`. If missing, tell the user to install it (`npm i -g @fission-ai/openspec@latest`) and stop. If `npm view @fission-ai/openspec version` is newer than the installed version, say so and ask whether to upgrade.

2. **Initialize OpenSpec** if the project has no `openspec/` folder: `openspec init --tools claude`. If it already has one, run `openspec update` so the generated `openspec-*` skills match the installed CLI.

3. **Install the schemas.** Ask where, recommending the first option:
   - **In the project** (`bash <skill-dir>/scripts/install-schemas.sh <project-root>`): versioned with the repo, so the whole team and CI get the same flow.
   - **On this machine** (`bash <skill-dir>/scripts/install-schemas.sh`): for every project, in `~/.local/share/openspec/schemas/`.

4. **Write `openspec/config.yaml`.**
   - If it doesn't exist, start from `templates/config.yaml`.
   - If it exists, keep the user's values: set `schema: devkit-lite` as the default (ask first if it names another schema), and merge in only the missing `rules` / `operations` keys.
   - Fill `context` from the repo, never with placeholders:
     - stack: `package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `pom.xml`, ...;
     - test, lint and typecheck commands: package scripts, `Makefile`, CI workflows (`.github/workflows/`);
     - ADR folder: `docs/adr/`, `docs/decisions/`, `adr/`, or "none";
     - default branch: `git symbolic-ref --short refs/remotes/origin/HEAD`, else `main`;
     - conventions: commitlint config, `CONTRIBUTING.md`, recent `git log` subjects.
   - Run the test command once. If it fails, record it in `context` as failing and tell the user.

5. **Check.**
   - `openspec schema validate devkit` and `openspec schema validate devkit-lite` both pass.
   - `openspec schema which devkit` resolves to where you installed it.
   - The devkit plugins are active: the `devkit-openspec` hooks (code stays closed until readiness is APPROVED) and `devkit-core` (the agents and skills the schema names). If `/plugin` doesn't list them, tell the user to install them: `/plugin marketplace add chacal88/devkit`, then `/plugin install devkit-core@devkit` and `/plugin install devkit-openspec@devkit`.

6. **Report** what was created or changed, and the first command to run: `openspec new change <name>` (default, `devkit-lite`) or `openspec new change <name> --schema devkit` (full flow, for the changes the config's header comment lists).

## Never

- Overwrite an existing `openspec/config.yaml` wholesale, or remove the user's rules.
- Leave `<placeholder>` values in `context`.
- Commit. Show the diff and leave committing to the user.
