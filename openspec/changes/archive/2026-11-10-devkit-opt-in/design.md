# Design

Change: `devkit-opt-in` · Date: 2026-11-09 · Owner: kaue rodrigues dos santos · Inputs: [requirements.md](requirements.md), [proposal.md](proposal.md) · PRD / tech spec: n/a · Decisions: ADR 0001 `docs/adr/0001-coordination-without-a-harness.md` (kept), ADR 0002 `docs/adr/0002-merge-without-the-owner-opt-in.md` and ADR 0003 `docs/adr/0003-auto-merge-the-archive-pr.md` (untouched), ADR 0004 `docs/adr/0004-devkit-per-project.md` (new, drafted in D7)

Paths below are from the repository root and appear in backticks rather than as relative links, because this folder moves one level deeper when it is archived.

## Context

See proposal.md (Why). What shapes the approach:

- **Where the guard decides.** `guardBash` runs `gitViolation` before anything else (`plugins/openspec/hooks/guard.mjs:321-322`), so destructive git is refused in any folder. Every other check needs `findRoot` (`:59-66`), which walks up from `cwd` to the first folder holding `openspec/changes/`, and an active change (`resolveChange`, `:98-114`). `session` (`:387-394`) prints the change report and the roadmap report for any such root. `guardEdit` (`:302-317`) and the `gh pr create` check (`:334-337`) have no notion of devkit at all: any OpenSpec project is gated.
- **The schema is already read.** `changeSchemaAt` (`:122-129`) takes `schema:` from a change's `.openspec.yaml`, else from `openspec/config.yaml`, else `spec-driven`, with the regex `^schema:\s*["']?([\w.-]+)` (line-anchored, so comments and nested keys never match).
- **`deliver-check.mjs` imports the guard's helpers** (`plugins/openspec/hooks/deliver-check.mjs:15`: `archiveBranchChange`, `changeDir`, `changeSchema`, `changeSchemaAt`, `findRoot`, `readValue`, `resolveChange`, `schemaHasArtifact`, `REQUIRED_REVIEWERS`). `guard.mjs ci` only forwards to `deliver-check --ci` (`:418-432`). Neither may change meaning, or CI and `ship-change` move with it.
- **The opted-in projects.** This repo: `openspec/config.yaml:8` `schema: devkit-lite`, schemas in `openspec/schemas/`. representante-digital: `openspec/config.yaml:9` `schema: devkit-lite`, schemas `devkit`, `devkit-lite` and its own `representante-digital` in `openspec/schemas/`; several of its active changes use `schema: representante-digital` in their `.openspec.yaml`, others `devkit`. Its committed `.claude/settings.json` already declares the marketplace and both packs. The plain ones: margi and recruit have `schema: spec-driven` (read 2026-11-09).
- **The tests already build opted-in repos.** `repo()` in `guard.test.mjs:19-36` writes `openspec/config.yaml` `schema: devkit`; `gitRepo()` in `deliver-check.test.mjs:31-41` writes `schema: devkit-lite`. Every existing hook test is therefore an opted-in test, which is what AC-3 needs.
- **Setup today.** `openspec-setup` step 3 asks where to install the schemas (`plugins/openspec/skills/openspec-setup/SKILL.md:21-23`), step 5 tells the user to `/plugin install` the packs (`:39`, user scope by default). `install-schemas.sh` with no argument writes `${XDG_DATA_HOME:-$HOME/.local/share}/openspec/schemas` (`scripts/install-schemas.sh:10-14`). Nothing tests the script except CI's `install-schemas.sh .` (`.github/workflows/ci.yml:28`); `scripts/check.py` checks names, links and language only. `github-setup.mjs` sets the pattern for a setup script: plain Node, a plan by default, tests imported by `guard.test.mjs:13`.
- **Claude Code's CLI** (2.1.227, `--help` read 2026-11-09): `claude plugin install|uninstall <plugin> -s, --scope <user|project|local>` (default `user`); `claude plugin marketplace add <source> --scope <user|project|local>` (default `user`); `claude plugin marketplace remove <name> [--scope ...]`, which **without `--scope` removes the declaration from every scope**, the project's `.claude/settings.json` included; `claude plugin list --json` and `claude plugin marketplace list --json` give `id`, `scope`, `projectPath` and `name`. The owner's registry (`~/.claude/plugins/installed_plugins.json`) holds both packs at `user` scope plus 8 `project` entries each: representante-digital itself and 7 of its worktrees, of which `hopeful-tesla-fbfb96`, `dreamy-maxwell-295900` and `confident-benz-440216` no longer exist on disk. The `devkit` marketplace is in `~/.claude/plugins/known_marketplaces.json` only; `~/.claude/settings.json` has `enabledPlugins` for both packs and no `extraKnownMarketplaces.devkit`.
- **Releases.** `docs/openspec-flow.md:348-356` pins the CI snippet to `<commit sha of v<devkit-openspec version>>`, enforced by `deliver-check.test.mjs:2926-2933`; the owner creates the tag after the merge (archive-after-merge R-8).
- **The parallel change `conduct-rounds`** is being planned at the same time and touches `ship-change` and `deliver-check`. This change edits neither.

## Goals / Non-Goals

**Goals:**

- One answer to "is this project using devkit?", read from the repository alone (ADR 0001: no state outside the repository and GitHub), the same in a worktree, a subdirectory and CI.
- Opted-in projects keep every gate exactly as today, with no edit on their side (representante-digital is not touched).
- A project chooses devkit with committed files only; nothing on the machine decides it.
- The owner's machine changes only through documented, reversible items, each on its own yes.

**Non-Goals (design level):**

- No change to `deliver-check.mjs`, `ship-change`, `merge-setup.mjs`, `github-setup.mjs` or the `devkit-reviews` workflow.
- No new key in `openspec/config.yaml`, and no edit to representante-digital.
- The hooks do not read Claude Code's settings files.
- No automatic migration: no script edits `~/.claude`.

## Decisions

### D1. No spec delta (`skip_specs: true`)

Same as the four archived changes (for example `openspec/changes/archive/2026-11-09-archive-after-merge/`, its D1). `openspec/specs/` is empty: the repository keeps no canonical specs, and behavior is pinned by the tests that `guard.test.mjs` runs and documented in `docs/openspec-flow.md`. `.openspec.yaml` sets `skip_specs: true`.

### D2. The opt-in marker: `openspec/config.yaml` selects `devkit` or `devkit-lite`

**Decision.** A project is opted into devkit's hooks when the `openspec/config.yaml` beside the `openspec/changes/` that `findRoot` found has a top-level `schema:` equal to `devkit` or `devkit-lite`. This is requirements option (a), project level only. A change's own `.openspec.yaml` does not opt a project in or out. No `config.yaml`, no `schema:` line, or any other value (`spec-driven`, a custom name) means not opted in.

Two layers, each with one job:

| Layer | Where | Decides |
|---|---|---|
| Loading | the project's committed `.claude/settings.json` (`extraKnownMarketplaces.devkit`, `enabledPlugins`) | whether Claude Code loads the packs (skills, agents, hooks) in that project; Claude Code's own mechanism |
| Gating | `openspec/config.yaml` `schema:` | whether the loaded hooks act; the guard's own check, so a user-scope install (a mistake, or another machine) stays harmless |

**Why (a), project level:**

- **Readable from the repository alone**, committed, so a worktree checkout and CI see the same value (ADR 0001). `findRoot` already walks up from a subdirectory to the folder holding `openspec/changes/`, and `config.yaml` sits next to it, so a deep `cwd` and a `.claude/worktrees/<name>` checkout (which has its own `openspec/`) resolve to their own config.
- **Gates what the gates are about.** The readiness gate, the one-writer rule and the PR gate are steps of the devkit schemas. A project on `spec-driven` has nothing for them to check.
- **No edit to the projects that keep devkit.** Both have `schema: devkit-lite` today, so AC-3 holds there without a commit. representante-digital's changes on its own `representante-digital` schema stay gated, because the project-level value decides. A per-change marker would have dropped their gates.
- **Plain OpenSpec projects come out not opted in** (AC-2): margi and recruit have `schema: spec-driven`.
- **CI is untouched.** `guard.mjs ci` never reaches the check (D3), and `deliver-check --ci` keeps its own rules.

**Alternatives rejected:**

| Option | Why not |
|---|---|
| (b) The project's `.claude/settings.json` / `settings.local.json` enables `devkit-openspec@devkit` | It ties the gate to how Claude Code was configured, not to the flow the repo runs. `settings.local.json` is uncommitted and absent from worktrees and CI. `claude --plugin-dir plugins/openspec` (CONTRIBUTING "Testing a pack locally") loads the hooks with no `enabledPlugins` entry, so the guard would go silent while testing. A plugin from a fork or a renamed marketplace (`devkit-openspec@other`) would also look not opted in. |
| (c) Both (a) and (b) | Every failure mode of (b), plus a second place to keep in step. It adds nothing that the loading layer does not already do. |
| An explicit key in `openspec/config.yaml` (for example `devkit: true`) | Every opted-in project would need an edit, representante-digital included, and until that edit its gates would be off, which breaks AC-3. The schema already says it. |
| Per-change schema (`.openspec.yaml`) | representante-digital's `representante-digital`-schema changes would lose their gates. In a `spec-driven` project, one `--schema devkit` change would switch the destructive-git rule on and off depending on which change is open. |

**Known limit (recorded in ADR 0004 and the docs):** a project that renames a copied devkit schema (`openspec/schemas/myflow/`) and selects it in `config.yaml` is not opted in. `docs/openspec-flow.md` "Customizing" already tells users to copy the schema under the same name. The docs now add that the name is also what turns the hooks on.

### D3. Where the guard checks it: every hook mode except `ci`

New exports in `plugins/openspec/hooks/guard.mjs`. The existing exports keep their meaning, because `deliver-check.mjs:15` imports them.

```js
export const DEVKIT_SCHEMAS = ['devkit', 'devkit-lite'];
// The project's default schema: openspec/config.yaml `schema:`, else null.
export function projectSchema(root) { /* same line-anchored regex as changeSchemaAt */ }
// Has this project chosen devkit? Its openspec/config.yaml selects a devkit schema.
export function optedIn(root) { return DEVKIT_SCHEMAS.includes(projectSchema(root)); }
```

Each path that reaches a hook's effect gets the check (CONTRIBUTING: a guarding check goes on every step path that reaches the guarded action) and a test (tasks 1.2-1.5):

| Mode / path | Today | After |
|---|---|---|
| `session` (SessionStart): change report, roadmap report | prints for any root with `openspec/changes/` | `root && optedIn(root)` first; otherwise no output, exit 0 |
| `edit` (Edit, Write, MultiEdit, NotebookEdit): gate files, readiness gate, implementer rule, ambiguous-change block | any root | `root && optedIn(root)` before `resolveChange`; otherwise exit 0 |
| `bash`: destructive git (`gitViolation`) | every folder, before `findRoot` | moved after `findRoot(input.cwd)` and `optedIn(root)`; silent outside (owner's choice) |
| `bash`: shell writes (`bashWrites` + `writeViolation`) | any root | after `optedIn` |
| `bash`: `gh pr create` (`prViolation`) | any root | after `optedIn` |
| `ci` | `deliver-check --ci` | unchanged, never calls `optedIn` |
| `DEVKIT_BYPASS=1` | exit 0 for `session`/`edit`/`bash` | unchanged |

Inside an opted-in project nothing changes. That includes the destructive-git rule with no active change, which is refused there as it is today. The `bash` hook judges by the session's `cwd`, as `writeViolation` already does. A command that `cd`s into an opted-in repository from an outside `cwd` is not refused. That is a new gap only for destructive git (Limits, R2). The header comment of `guard.mjs` (`:1-31`) gains "Only in projects whose openspec/config.yaml selects devkit or devkit-lite (ADR 0004)". The `description` in `hooks/hooks.json` says the same.

### D4. `openspec-setup` writes `.claude/settings.json` through a script

A skill alone would leave the merge to the model's judgment, and nothing could test it. New file `plugins/openspec/skills/openspec-setup/scripts/project-settings.mjs`: plain Node, no dependencies, in the style of `github-setup.mjs`.

```
node project-settings.mjs [<project-root>] [--packs <pack,...>] [--dry-run] [--json]
```

- **Root.** `<project-root>`, else `git rev-parse --show-toplevel` from the `cwd` (a worktree resolves to itself), else exit 1 with "pass the project path". The script writes only `<root>/.claude/settings.json`. It refuses (exit 1, nothing written) when `realpath(<root>)` equals `realpath(os.homedir())`, because `~/.claude/settings.json` is the user scope. It never reads or writes `settings.local.json`.
- **Packs.** `PACKS` is the five pack names, and a test pins the list against `.claude-plugin/marketplace.json`. The default is `devkit-core,devkit-openspec`. An unknown name exits 2.
- **Merge rules.**
  - The file is missing: create `{ "extraKnownMarketplaces": { "devkit": { "source": { "source": "github", "repo": "chacal88/devkit" } } }, "enabledPlugins": { "<pack>@devkit": true, ... } }`.
  - The file exists: parse it. Invalid JSON, or a top level that is not an object: exit 1, file untouched. Every other key and its order is kept, and new keys go at the end.
  - `extraKnownMarketplaces.devkit`: missing, `add`; deep-equal to the default, `ok`; another source (a fork, a local `directory`), `kept (<source>)`, left alone, because the project chose it.
  - `enabledPlugins["<pack>@devkit"]`: missing, `enable`; `true`, `ok`; `false`, `enable (was false)`, set to `true`, because running setup is the request to use the pack.
- **Write.** `JSON.stringify(obj, null, 2) + '\n'` to a temp file in `.claude/`, then `rename`, so a killed run never leaves half a file. A file that is already up to date is not rewritten (`file: unchanged`). `--dry-run` prints the same lines and writes nothing.
- **Output.** One line per item (`marketplace devkit: add|ok|kept (...)`, `<pack>@devkit: enable|ok|enable (was false)`, `file: create|update|unchanged <path>`). `--json` prints `{ path, file, items: [{ key, action }] }`. Exit 0 done, 1 refused or unreadable, 2 usage.

Paths to the guarded action (writing a settings file): default root, explicit root, root equal to `$HOME`, `--dry-run`, a file already up to date. Each one gets a test (task 2.2). The tests set `HOME` to a temp folder, so no test can reach the real `~/.claude`.

Why not run `claude plugin install --scope project` from the skill: it starts a nested CLI that needs the marketplace and the network, it cannot be tested offline, and the marketplace declaration takes a second call (`marketplace add --scope project`). Humans can still use the CLI (D8). It writes the same keys.

### D5. `install-schemas.sh`: the project by default, `--user` for machine-wide

```
install-schemas.sh               # the current project: git top level of $PWD, else $PWD; needs openspec/ there
install-schemas.sh <project>     # <project>/openspec/schemas (unchanged)
install-schemas.sh --user        # machine-wide: ${XDG_DATA_HOME:-$HOME/.local/share}/openspec/schemas
```

- No argument and no `openspec/` folder at the resolved root: exit 1, "no openspec/ in <root>: run openspec init first, or pass the project path". This keeps a stray run in `~` from creating `~/openspec/schemas`.
- `--user` together with a path, more than one path, or any other `-*` argument: exit 2 with the usage line, nothing written.
- The explicit `<project>` form keeps today's behavior, so `ci.yml:28` and CONTRIBUTING's `install-schemas.sh .` are unchanged.
- The final `openspec schema validate` runs in the project root, or in `$PWD` for `--user`. It replaces `${1:-.}`, which would break with `--user`.
- The flag is named `--user` after Claude Code's scope names. The header comment documents all three forms.

Tests: new `plugins/openspec/skills/openspec-setup/scripts/install-schemas.test.mjs`, imported by `guard.test.mjs` like `github-setup.test.mjs`. It spawns `bash install-schemas.sh` with `HOME` and `XDG_DATA_HOME` set to temp folders, and with `PATH` limited to the folders of `bash` and `git` so that `openspec` is not found and the validate step is skipped. It covers each form, each refusal, and a re-run that replaces the schemas.

### D6. `openspec-setup` steps

`plugins/openspec/skills/openspec-setup/SKILL.md`:

- **Description:** adds "opts the project into devkit in its `.claude/settings.json`". The catalog is regenerated.
- **New step 2, "Opt the project in"**, after the CLI check: run `node <skill-dir>/scripts/project-settings.mjs <project-root>`, show its lines and `git diff -- .claude/settings.json`, and tell the user the packs load in this project after a restart of Claude Code (or `/plugin` to accept the project's plugins). Other packs only on request (`--packs`).
- **Step "Install the schemas"**: no more question. Run `install-schemas.sh <project-root>`. The machine-wide `--user` form is used only when the owner asks for it explicitly, with the reason (it applies to every project on the machine).
- **Step "Write `openspec/config.yaml`"**: adds that `schema: devkit-lite` (or `devkit`) is also what turns the hooks on (ADR 0004). If the owner keeps another schema, say that the hooks will stay silent.
- **Step "Check"**: replaces the `/plugin install` advice with "`.claude/settings.json` lists the packs (step 2)", and checks that `openspec schema which devkit` resolves under the project.
- **Never** gains: install a pack at user scope, run `claude plugin install` without `--scope project`, or edit `~/.claude/` or `.claude/settings.local.json`.

### D7. ADR 0004 (new, draft below)

The decision is new and locked: where devkit is active, and that a user-scope install is inert. It does not change ADR 0001's gates or its "no state outside the repository" rule, both of which it relies on, nor ADRs 0002 and 0003. It is written to `docs/adr/0004-devkit-per-project.md` in task 1.6, wording free, substance fixed (a substantive change amends this draft in the same phase), and cited where the repository lists ADRs: `openspec/config.yaml` `context` ADR line, `README.md` ("Why no harness"), `docs/openspec-flow.md` (the gates), `CONTRIBUTING.md`. Its status is `accepted` only if the owner accepts it with the plan (open question Q1); otherwise `proposed`.

> # ADR 0004: devkit is opt-in per project
>
> - Status: accepted
> - Date: 2026-11-09
> - Change: devkit-opt-in
>
> ## Context
>
> This ADR builds on ADR 0001 and leaves ADRs 0001-0003 unchanged. devkit was taught as a user-scope install ("install it once"). Every project on a machine then loaded the packs' context and hooks: plain OpenSpec projects got devkit's session report and gates, and every folder had destructive git refused. Owners use devkit in some projects and plain OpenSpec, or nothing, in others.
>
> ## Decision
>
> A project chooses devkit with committed files. Its `.claude/settings.json` declares the `devkit` marketplace and enables the packs it uses, so Claude Code loads them there and nowhere else. The devkit-openspec hooks (`session`, `edit`, `bash`) act only in a project whose `openspec/config.yaml` selects the `devkit` or `devkit-lite` schema. Anywhere else they print nothing and block nothing, the destructive-git rule included, even when the plugin is loaded at user scope. Inside such a project every gate stays as ADR 0001 describes. The CI check (`deliver-check --ci`, `guard.mjs ci`) does not depend on this rule. The docs and `openspec-setup` teach only the per-project install. Machine-wide schemas are installed only on explicit request.
>
> ## Consequences
>
> - Positive: projects that did not choose devkit pay no context and meet no devkit gate. The choice is in the repository, reviewable, the same in worktrees and CI, and needs no machine state (ADR 0001). A user-scope install by mistake is harmless.
> - Negative: destructive git is no longer refused outside opted-in projects, or for a command that `cd`s into one from outside (Accepted: the owner's choice; Claude Code's own permission rules can refuse it per user). Each project is set up once (Mitigated: `openspec-setup` writes the settings). A project that renames its copy of a devkit schema turns the hooks off (Mitigated: documented under Customizing). A worktree made from a branch older than the project's `.claude/settings.json` does not load devkit (Accepted: merge the default branch into it).
>
> ### Review trigger
>
> Claude Code adds a native per-project activation for user-scope plugins, a gate is needed in projects that do not run a devkit schema, or a project needs devkit's hooks under a schema with another name.
>
> ## Alternatives considered
>
> | Option | Pros | Cons | Cost to undo |
> |---|---|---|---|
> | Keep the user-scope install; opt out per project (`enabledPlugins: false` in `settings.local.json`) | Nothing to set up per project | The default invades, so every new project needs an opt-out, and the opt-out is machine-local | low |
> | Hooks gate on Claude Code settings (`enabledPlugins`) | Mirrors loading | Not in CI or worktrees for `settings.local.json`; `--plugin-dir` testing turns the gates off; fork names break it | low |
> | An explicit `devkit: true` key in `openspec/config.yaml` | Explicit | Every opted-in project needs an edit before its gates come back | low |
> | Per-change schema as the marker | Finer grained | Projects with their own schema lose their gates; the git rule depends on which change is open | medium |

### D8. Teaching the per-project install (AC-4)

- **`README.md`**: line 5 becomes "Install the packs per project: each project's `.claude/settings.json` names the packs it uses, so they load only in the projects that chose them and every other project pays no context for them". The Install section shows the `.claude/settings.json` snippet, then the CLI equivalent run at the project root: `claude plugin marketplace add chacal88/devkit --scope project` and `claude plugin install devkit-core@devkit --scope project`. It links the migration doc for machines that have the old user-scope install. "Why no harness" layer 3 adds "in projects that opted in" (ADR 0004).
- **`docs/getting-started.md`**: sections 1 and 2 become "Opt the project in", with the snippet first and the CLI as the alternative. The table "If the project... | Install" stays. The `/plugin install` blocks become `claude plugin install <pack>@devkit --scope project`. Section 4 says `/openspec-setup` writes the settings. "Share with a team" folds into section 1, because the committed file is now the default, not the team variant. A line explains why per project and links `migrate-to-project-scope.md`.
- **Each pack README** (`plugins/{core,openspec,design,stack,ai-engineering}/README.md`): the `/plugin install <pack>@devkit` block becomes `claude plugin install <pack>@devkit --scope project`, with one line "run at the project root; or add it to `.claude/settings.json`, see getting-started".
- **`docs/openspec-flow.md`**: "Adopting it in a project" step 2 uses the no-argument form and `--user` for machine-wide; step 4 says per project. The gates section gets a "Where the hooks act" paragraph (D2, D3). Customizing notes that a renamed schema turns the hooks off. The troubleshooting row "The hooks don't fire at all" adds the cause "`openspec/config.yaml` does not select `devkit` or `devkit-lite`". The `v0.7.0` pin (D11).
- **Lint, so it stays true:** `scripts/check.py` gains `check_install_scope()`. The exact rule:
  - Files: every `*.md` under the root, except paths with a part `.git` or `node_modules` (the existing `md_files()` skip) and paths under `openspec/changes/` (planning artifacts quote the old commands), `.claude/worktrees/` (other checkouts in the main checkout), `.claude/skills/` and `.claude/commands/` (generated by `openspec init`, local only). The extra skips apply to this check only. The link and language checks keep today's files.
  - Lines: each line matching `(/plugin|claude plugin) install\b`. In fenced blocks too, because that is where the commands are.
  - In `docs/migrate-to-project-scope.md` only, such a line passes when it contains `--scope user`. Those are the undo lines of item 1 (D10), and that file is the one place a user-scope install is legitimate.
  - Everywhere else, a line passes only when it contains `--scope project`. `--scope user`, `--scope local` and no scope each fail with `<path>:<line>: plugin install must use --scope project`.

  `check.py` gains an optional `--root <dir>` argument (default: the repository), so a test can run it on fixtures. A node test in `guard.test.mjs` builds a temp root and runs `python3 scripts/check.py --root <tmp>`. Each case:
  - `docs/migrate-to-project-scope.md` with `claude plugin install devkit-core@devkit --scope user` passes (the exemption);
  - `README.md` with the same line fails and names `README.md:<n>`;
  - `README.md` with `/plugin install devkit-core@devkit` fails, and with `claude plugin install devkit-core@devkit --scope project` passes;
  - bad lines under `openspec/changes/x/`, `.claude/worktrees/w/`, `.claude/skills/s/` and `.claude/commands/c/` are ignored.

  The lint is also proven red on the current docs before they change (task 3.1). A node test in `guard.test.mjs` checks that `README.md` and `docs/getting-started.md` say why (the packs load only in projects that chose them) and link the migration doc.

### D9. This repository opts in (AC-6)

`.claude/settings.json` is written by running `node plugins/openspec/skills/openspec-setup/scripts/project-settings.mjs .` on this repo (the real-input smoke of D4), giving exactly the default content: the `devkit` marketplace from `chacal88/devkit`, `devkit-core@devkit` and `devkit-openspec@devkit` true. `.git/info/exclude` excludes only `.claude/worktrees/` and the generated `openspec-*` skills and `opsx` commands, so the file is committed normally. A test parses it and checks those keys, and a second run with `--dry-run` reports `file: unchanged`. `guard.mjs` `classify` treats `.claude/` as exempt (`:185`), so writing it is never gated.

### D10. The owner-machine migration (AC-7)

New `docs/migrate-to-project-scope.md`, linked from `README.md` and `docs/getting-started.md`. It opens with the rule: **run an item only after the owner says yes to that item; an agent never runs one on its own.** Then the order and the preconditions:

- **Preconditions (all before item 1).** This change is merged and released: `claude plugin marketplace update devkit`, then `claude plugin list --json | jq -r '.[] | select(.id=="devkit-openspec@devkit" and .scope=="user") | .version'` prints `0.7.0` or later, so the self-defending hooks are what is installed. `git -C ~/Documents/devkit pull` brings this repo's `.claude/settings.json` into the main checkout. `git -C ~/Documents/devkit worktree list` is reviewed, and each worktree still in use has `.claude/settings.json` (merge `main` into it first), because one without the file loses devkit after item 1.

Items, each with **Command**, **Check** and **Undo** in fenced `bash` blocks:

| # | Command | Check | Undo |
|---|---|---|---|
| 1 | `cd ~ && claude plugin uninstall devkit-core@devkit --scope user && claude plugin uninstall devkit-openspec@devkit --scope user` | `claude plugin list --json \| jq '[.[] \| select((.id \| endswith("@devkit")) and .scope=="user")] \| length'` prints `0`; `jq '.enabledPlugins // {} \| keys \| map(select(endswith("@devkit")))' ~/.claude/settings.json` prints `[]` | `claude plugin install devkit-core@devkit --scope user && claude plugin install devkit-openspec@devkit --scope user` |
| 2 | `cd ~ && claude plugin marketplace remove devkit --scope user` (always with `--scope user`: without it the CLI also removes the declaration from the current project's `.claude/settings.json`) | `jq 'has("devkit")' ~/.claude/plugins/known_marketplaces.json` prints `false` (opening a project that declares the marketplace adds it back; that is expected) | `claude plugin marketplace add chacal88/devkit --scope user` |
| 3 | `f=~/Documents/recruit/.claude/settings.local.json && cp "$f" "$f.bak-devkit-opt-in" && jq 'del(.enabledPlugins["devkit-openspec@devkit"]) \| if .enabledPlugins == {} then del(.enabledPlugins) else . end' "$f.bak-devkit-opt-in" > "$f"` | `jq '.enabledPlugins // {} \| has("devkit-openspec@devkit")' "$f"` prints `false`, and `jq . "$f"` parses | `mv "$f.bak-devkit-opt-in" "$f"` |
| 4 | With no Claude Code session open: `r=~/.claude/plugins/installed_plugins.json && cp "$r" "$r.bak-devkit-opt-in" && jq --arg p "$HOME/Documents/representante-digital/.claude/worktrees/" '.plugins \|= with_entries(if (.key \| endswith("@devkit")) then .value \|= map(select(((.projectPath // "") \| startswith($p)) \| not)) else . end)' "$r.bak-devkit-opt-in" > "$r"` | `claude plugin list --json \| jq '[.[] \| select((.id \| endswith("@devkit")) and ((.projectPath // "") \| contains("/representante-digital/.claude/worktrees/")))] \| length'` prints `0`; representante-digital's own entry is still listed | `cp "$r.bak-devkit-opt-in" "$r"` |

Notes the doc carries:

- Item 1 goes first. Item 3 only matters once item 1 is done, because recruit then loads nothing from devkit anyway.
- Item 4 edits Claude Code's own registry, because the CLI cannot remove project entries without editing each worktree's committed `.claude/settings.json`, and three of the paths no longer exist. A worktree that still exists registers again the next time a session opens there, because representante-digital opts in. That is expected.
- Final check for AC-7: `claude plugin list` shows no devkit pack with `Scope: user`. In `~/Documents/projects/margi`, `for f in ~/.claude/settings.json .claude/settings.json .claude/settings.local.json; do [ -f "$f" ] && jq -r '.enabledPlugins // {} | keys[] | select(endswith("@devkit"))' "$f"; done` prints nothing (each file is read on its own, so a missing one does not hide the others). A new Claude Code session there prints no `[devkit]` line, and `/plugin` lists no devkit pack as enabled for that project.
- In the devkit repo and in representante-digital, a new session loads the packs from the project scope (accept them in `/plugin` if Claude Code asks).

**Lint interplay.** Item 1's Undo (`claude plugin install ... --scope user`) is the only user-scope install line in the repository's docs. The D8 lint allows `--scope user` in this file only. The format test (task 3.3) pins that every `claude plugin install` line in this file carries `--scope user`, so the doc never teaches a project install that would bypass the D8 rule.

**Who runs it and when.** Tasks hold only the doc and its format test (task 3.4). The items are in tasks.md's `## Workflow follow-up` as plain bullets: `deliver-check` item 1 counts every checkbox, and a checkbox that can only be ticked after the merge would hold this change's PR below 8/8 (archive-after-merge R-10). Each bullet says "only on the owner's explicit yes for this item, in that message". AC-7's first sentence (the doc) is proven in evidence before the merge. Its second sentence (the machine state) can only be proven after the merge, and is recorded in `retro.md` (open question Q2).

All the commands above were checked against `claude ... --help` and the real `--json` output on 2026-11-09, and none of them was run. The implementer must not run them either. Task 3.4 checks the doc's commands only with `bash -n` and `jq -n` on fixtures.

### D11. Versions and release (AC-8)

| Pack | From | To | Why |
|---|---|---|---|
| devkit-openspec | 0.6.0 | 0.7.0 | hook behavior (BREAKING outside opted-in projects), `install-schemas.sh` default, new script |
| devkit-core | 0.5.0 | 0.5.1 | README install lines |
| devkit-design, devkit-stack, devkit-ai-engineering | 0.1.0 | 0.1.1 | README install lines |
| marketplace `metadata.version` | 0.6.0 | 0.7.0 | |

Each pack's `plugin.json` and its `.claude-plugin/marketplace.json` entry change together. `CHANGELOG.md` gets "## 0.7.0 — devkit per project", with one line per pack and the two BREAKING notes. `docs/openspec-flow.md` pins `v0.7.0` (the test at `deliver-check.test.mjs:2926` requires it). `python3 scripts/gen-catalog.py` is re-run because the `openspec-setup` description changes. The owner creates tag `v0.7.0` after the merge, as in archive-after-merge R-8. If `conduct-rounds` merges first with 0.7.0, this change takes the next minor when it rebases (R6).

## Implementation plan

Dependency order: the guard's opt-in rule and ADR 0004 (the contract everything else teaches), then the setup scripts and this repo's settings (they implement the opt-in), then the teaching docs, the migration doc and the release (they name the flags and files that phase 2 creates). Each phase is one `devkit-core:tdd-implementer` run.

### Per surface

- **devkit-openspec hooks**: `guard.mjs` (`DEVKIT_SCHEMAS`, `projectSchema`, `optedIn`, the checks in `session`, `guardEdit`, `guardBash`, header), `hooks.json` (description), `guard.test.mjs` (new tests and imports).
- **devkit-openspec setup**: `skills/openspec-setup/SKILL.md`, `scripts/install-schemas.sh`, new `scripts/project-settings.mjs`, new `scripts/project-settings.test.mjs`, new `scripts/install-schemas.test.mjs`.
- **All packs**: `README.md` install lines; `plugin.json` versions.
- **Repo**: `.claude/settings.json`, `docs/adr/0004-devkit-per-project.md`, `docs/migrate-to-project-scope.md`, `README.md`, `docs/getting-started.md`, `docs/openspec-flow.md`, `CONTRIBUTING.md` (ADR list line), `openspec/config.yaml` (ADR line), `scripts/check.py`, `.claude-plugin/marketplace.json`, `CHANGELOG.md`, `docs/catalog.md`.
- **Owner's machine**: none in apply. Workflow follow-up only, one yes per item.

### File structure

| Action | Path |
|---|---|
| modify | `plugins/openspec/hooks/guard.mjs`, `plugins/openspec/hooks/guard.test.mjs`, `plugins/openspec/hooks/hooks.json` |
| modify | `plugins/openspec/skills/openspec-setup/SKILL.md`, `plugins/openspec/skills/openspec-setup/scripts/install-schemas.sh` |
| create | `plugins/openspec/skills/openspec-setup/scripts/project-settings.mjs`, `plugins/openspec/skills/openspec-setup/scripts/project-settings.test.mjs`, `plugins/openspec/skills/openspec-setup/scripts/install-schemas.test.mjs` |
| create | `.claude/settings.json`, `docs/adr/0004-devkit-per-project.md`, `docs/migrate-to-project-scope.md` |
| modify | `README.md`, `docs/getting-started.md`, `docs/openspec-flow.md`, `CONTRIBUTING.md`, `openspec/config.yaml`, `scripts/check.py` |
| modify | `plugins/core/README.md`, `plugins/openspec/README.md`, `plugins/design/README.md`, `plugins/stack/README.md`, `plugins/ai-engineering/README.md` |
| modify | `plugins/*/.claude-plugin/plugin.json` (five), `.claude-plugin/marketplace.json`, `CHANGELOG.md`, `docs/catalog.md` |
| delete | none |

Not touched: `plugins/openspec/hooks/deliver-check.mjs`, `merge-setup.mjs`, `plugins/openspec/skills/ship-change/SKILL.md`, `.github/workflows/*`, `plugins/openspec/schemas/*`.

### Estimate

Optimistic 9 h · likely 13 h · pessimistic 19 h. Most of the spread is in the docs rewrite across eight files and in the shell test's portability (PATH, macOS and Linux `git` locations).

### Effort

| Component | Hours | Type | Risk |
|---|---|---|---|
| `optedIn` and the checks in `session`/`edit`/`bash`, with tests (AC-1, AC-2, AC-3) | 2 | Core | MEDIUM (every gate passes through it) |
| Real-input smoke of the guard on margi, recruit, representante-digital and this repo | 0.5 | Testing | LOW |
| ADR 0004, its citations and its format test | 1 | Documentation | LOW |
| `docs/openspec-flow.md` gates, customizing and troubleshooting; `plugins/openspec/README.md` hooks table | 0.5 | Documentation | LOW |
| `project-settings.mjs` and its tests | 2.5 | Core | MEDIUM (writes a config file) |
| `install-schemas.sh` flags and its tests | 1.5 | Core | MEDIUM (shell portability) |
| `openspec-setup/SKILL.md` steps | 0.5 | Documentation | LOW |
| This repo's `.claude/settings.json` and its test | 0.5 | Integration | LOW |
| `check.py` install-scope lint (red on today's docs, then green) | 0.5 | Testing | LOW |
| README, getting-started, openspec-flow adoption, five pack READMEs | 1.5 | Documentation | LOW |
| `docs/migrate-to-project-scope.md` and its format test | 1.5 | Documentation | MEDIUM (owner-machine commands) |
| Versions, CHANGELOG, pin, catalog | 0.5 | Documentation | LOW |
| Total | 13 | | |

### Risks / Trade-offs

| # | Risk | P × I | Mitigation |
|---|---|---|---|
| R1 | A project that should be gated reads as not opted in (no `config.yaml`, schema renamed), and its gates go silent | LOW × HIGH | Both known opted-in projects checked on real input (task 1.5); the rule and the rename limit are documented (D2, D8); `deliver-check --ci` still gates PRs in CI where configured |
| R2 | Destructive git is no longer refused outside opted-in projects, or from an outside `cwd` that `cd`s in | HIGH × MEDIUM | The owner chose this (requirements question 2); recorded in ADR 0004 Consequences; docs say Claude Code permission rules can refuse it per user |
| R3 | A future edit moves `gitViolation` back before the opt-in check, or drops the check from one mode | LOW × MEDIUM | One test per mode and per rule kind in a non-opted project (task 1.2); the D3 table in the docs |
| R4 | `project-settings.mjs` damages a hand-edited settings file | LOW × MEDIUM | Invalid JSON is refused untouched; atomic write; keys and order kept; `--dry-run`; tests for each case (task 2.2) |
| R5 | The script is pointed at `$HOME` and writes the user-scope settings | LOW × HIGH | Refused by realpath comparison, with a test under a temp `HOME` |
| R6 | `conduct-rounds` also releases 0.7.0 and edits `docs/openspec-flow.md` / `CHANGELOG.md` | MEDIUM × LOW | This change edits neither `ship-change` nor `deliver-check`; the second change to merge rebases, takes the next minor and re-pins (the pin test fails loudly until it does) |
| R7 | A migration command behaves differently than its `--help` says (for example `marketplace remove` touching project settings) | MEDIUM × MEDIUM | Always `--scope user` and `cd ~` first; each item has a check and an undo; backups before every hand edit; one item per owner yes |
| R8 | After item 1, a worktree of this repo on an old branch (for example `conduct-rounds`) loses devkit mid-change | MEDIUM × MEDIUM | Precondition in the doc: every worktree in use has `.claude/settings.json` (merge `main`) before item 1 |
| R9 | Item 4 races a running Claude Code process that rewrites `installed_plugins.json` | MEDIUM × LOW | "With no Claude Code session open"; backup and restore as undo; the check re-reads through the CLI |
| R10 | The install-schemas test is not portable (macOS vs Linux `git`, `bash` paths) | MEDIUM × LOW | `PATH` built from the resolved folders of `bash` and `git`, not hard-coded; CI runs it on ubuntu |
| R11 | The installed (0.6.0, user-scope) guard runs during apply, not this branch's guard | LOW × LOW | This repo is opted in under both rules, so the gates are the same; the new behavior is proven by tests and the task 1.5 smoke, which runs this branch's `guard.mjs` |

### Assumptions

| Assumption | Source | Breaks if |
|---|---|---|
| Claude Code loads a plugin enabled in the project's `.claude/settings.json` and offers the marketplace from `extraKnownMarketplaces` | requirements.md facts; representante-digital works that way today | It does not: the docs' CLI route still works, and the owner sees it in the migration's final check before removing more |
| `claude plugin install --scope project` and `marketplace add --scope project` write the project's `.claude/settings.json` | `--help` text, 2.1.227 | They write elsewhere: the snippet is the primary path in the docs, and the CLI line is secondary |
| Claude Code settings files are strict JSON | Current files parse with `jq` | Comments appear: the script refuses (exit 1) and leaves the file alone |
| `installed_plugins.json` keeps `{ plugins: { "<id>": [ { scope, projectPath, ... } ] } }` | File read 2026-11-09 | The format changes: item 4's check shows it and its undo restores the backup |
| The opted-in projects keep `schema: devkit-lite` | Both `config.yaml` read 2026-11-09 | One changes schema: its hooks go silent (R1) |

### Dependencies

- ADR 0001 (no state outside the repository and GitHub; the gates kept), the base of D2 and ADR 0004.
- `openspec/changes/archive/2026-11-09-archive-after-merge/` (merged): the `v<version>` pin test, the Workflow follow-up pattern (R-10) and the owner-made tag (R-8).
- Owner decisions: requirements.md questions 1-6.
- The branch `devkit-opt-in` (current) selects this change.

## Migration Plan

- Release devkit-openspec 0.7.0 with the others. Projects with `schema: devkit` or `devkit-lite` see no difference. Projects without one stop seeing devkit's hooks even where the plugin is still loaded. A script calling `install-schemas.sh` with no argument for a machine-wide install must add `--user` (CHANGELOG, BREAKING).
- The owner's machine follows `docs/migrate-to-project-scope.md` after the merge, one yes per item (D10).
- Rollback: revert the PR. The hooks then gate every OpenSpec project again. The migration's undo lines restore the user-scope install, the marketplace, recruit's entry and the registry backup.

## Open Questions

For the owner, before readiness (they would change task text, not the approach):

- **Q1.** Is ADR 0004 (D7) accepted as drafted, so task 1.6 writes `- Status: accepted`? Otherwise it is written as `proposed`. **Answered 2026-11-09: the owner accepts it; task 1.6 writes `- Status: accepted`.**
- **Q2.** AC-7's second sentence (the machine state after the migration) can only be observed after the merge. Is it acceptable that evidence proves the doc (first sentence) before the merge, and that the result of the items the owner approves is recorded in this change's `retro.md` after it? **Answered 2026-11-09: yes (routine process choice, made for the owner per their standing instruction to decide reversible choices): evidence proves the doc before the merge; the approved items' results go to `retro.md` after it.**
