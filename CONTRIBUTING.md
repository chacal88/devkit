# Contributing

## How changes are made here

This repo uses its own flow. Open a change with `openspec new change <id>` (`devkit-lite` by default; `--schema devkit` for the cases listed in [docs/openspec-flow.md](docs/openspec-flow.md#choosing-a-schema)), name the branch after it, and let the hooks gate the PR. When `openspec/roadmap.md` exists, it lists the rounds the changes belong to. After the merge, `ship-change` archives the change through a PR on `chore/archive-<id>` (in `pr` mode, run it again after you merge).

This repository ships in `merge` mode ([ADR 0002](docs/adr/0002-merge-without-the-owner-opt-in.md)): once a change is at 8/8, GitHub merges it when the `devkit-reviews` check passes. The `devkit` ruleset blocks direct pushes to `main` for everyone, so every change, the archive commit included, lands through a pull request; the archive PR's auto-merge rule is [ADR 0003](docs/adr/0003-auto-merge-the-archive-pr.md).

This repository opts in to its own hooks through its `.claude/settings.json` and `openspec/config.yaml` ([ADR 0004](docs/adr/0004-devkit-per-project.md)).

When a change edits an agent's output format, dispatch that change's agents with the repo's `plugins/<pack>/agents/<name>.md` as the format source: the installed plugins follow the old format until the release is installed.

When an implementer resolves a readiness note in a way the design does not say, amend `design.md` in the same phase. When a check guards an action (auto-merge, a push, a merge), the design lists every step path that reaches that action, open and resumed states included, and each path gets the check and a test.

When a fix changes behaviour that an ADR or `design.md` written in the same change describes, update that text in the same fix commit; a stale ADR found by review costs another round.

When a change is rebased onto a base that merged a sibling while the change was in review (`resolve-release-conflict`, or by hand), re-read what the change consumes from that sibling before pushing the rebased head: a skill's argument forms, a checker's exit codes and JSON fields, the text a button fills. The reviews run again on the pushed head either way; a contract found moved by review costs another round.

When a change alters how the owner works (what runs, in which order, who starts it), the grill ends with a walkthrough of one concrete day under the new behaviour, including an urgent item, and the owner confirms the walkthrough itself, not only the options.

An acceptance criterion states only what can be proven before the PR: `deliver-check` reads every criterion's row in `evidence.md` before `open-pr`. A fact that exists only after the merge (a tag, a release, a deploy) is a bullet under the change's `## Workflow follow-up`, done after the merge and recorded in `retro.md`.

## Adding or changing an asset

1. Read [docs/conventions.md](docs/conventions.md): naming, frontmatter, and what an agent or skill body must contain.
2. Put it in the pack it belongs to (`plugins/<pack>/agents/<name>.md` or `plugins/<pack>/skills/<name>/SKILL.md`). A new pack also needs `.claude-plugin/plugin.json`, a `README.md` with the catalog markers, and an entry in [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json).
3. If you adapt a third-party skill, keep its license and add a row to [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
4. Regenerate the catalog and run the checks:

   ```bash
   python3 scripts/gen-catalog.py
   ```

   ```bash
   python3 scripts/check.py
   ```

   ```bash
   node --test plugins/openspec/hooks/guard.test.mjs
   ```

   `guard.test.mjs` imports `deliver-check.test.mjs`, `merge-setup.test.mjs`, `github-setup.test.mjs` and devkit-core's `plugins/core/skills/review-change/scripts/review-round.test.mjs`, so this one command runs every hook test and the review round's tests (about 13 minutes; 12m54s observed on 279c830); give reviewers its result instead of having them re-run it. To run only the review round's tests, use `node --test plugins/core/skills/review-change/scripts/review-round.test.mjs`.

   A test fixture never depends on the branch variables of the machine that runs it: every env it builds blanks `DEVKIT_BYPASS`, `DEVKIT_BRANCH`, `DEVKIT_CHANGE`, `GITHUB_HEAD_REF`, `GITHUB_BASE_REF` and `GITHUB_EVENT_PATH`, through one shared constant of the test file. A test in `guard.test.mjs` refuses an env that blanks `DEVKIT_BRANCH` alone.

   A test fixture makes every temporary folder through its pack's `test-tmp.mjs` (`plugins/openspec/hooks/`, `plugins/core/skills/review-change/scripts/`, `plugins/compozy/skills/`; the three copies stay byte-identical), with a prefix that starts with `devkit-`. The helper removes each folder when its test ends, passed or failed, and sweeps the rest when the run ends or gets `SIGINT` or `SIGTERM`. A test reads the temporary root only through `tmpRoot()`. A fixture shared by several tests is made at module level, never lazily inside the first test that needs it: the helper removes a folder when the test that made it ends. `test-tmp.test.mjs` refuses a raw `mkdtempSync` or `tmpdir()` call in any `*.test.mjs` under `plugins/`.

   ```bash
   "$HOME/Library/Application Support/Claude/claude-code/<version>/<hash>/claude.app/Contents/MacOS/claude" plugin validate .
   ```

   Use the desktop app's bundled Claude Code (see "Testing a mod pack" below); the npm `claude` (2.1.227) validates the repository and the pack again, since devkit-panel 0.2.0 dropped `userConfig.language.options`, but it still has no `plugin test`.

5. Bump the `version` of every pack you changed, in its `plugin.json` and in `marketplace.json`, and add a line to [CHANGELOG.md](CHANGELOG.md). Changes run in parallel: when you merge `main` before the merge of your pull request, take the next version after `main`'s and the next free ADR number in `main`'s `docs/adr/`, and renumber your ADR and every reference your change made to it when another change took its number first. When a change has had to redo its release against `main` twice, its session asks the coordinator for a merge window: sibling changes hold their own merge (and auto-merge) until that pull request lands, so it does not loop on release collisions.

   A release that changes devkit-openspec's version is tagged `v<that version>` on its merge commit on `main`: a lightweight tag, pushed after the merge (`git tag v<x> <merge sha>`, then `git push origin v<x>`), because `openspec-setup` pins projects' CI and vendored schemas to that tag's commit (ADR 0002). A release that bumps only other packs gets no new tag: it has nothing new to pin, and `v<that version>` already names an earlier commit.

## Changing the OpenSpec schemas

Validate them against the current OpenSpec CLI:

```bash
cd "$(mktemp -d)" && git init -q && openspec init --tools none
```

```bash
bash <repo>/plugins/openspec/skills/openspec-setup/scripts/install-schemas.sh .
```

Each schema lives in two copies (`plugins/openspec/schemas/` and this repository's `openspec/schemas/`, kept byte-identical by `install-schemas.sh`), and each folder holds `flow.json` and the templates with their stage header: change `schema.yaml`, `flow.json` and the templates together, because `flow-check` reads all three. The suite needs the `openspec` CLI (major 2) on `PATH` (this repository pins none; a project that pins one has it used instead): the schema tests create a change with it.

The hooks depend on the artifact id `readiness` and on the `- Status:` / `Verdict:` lines; keep them, or change `plugins/openspec/hooks/guard.mjs` and its tests together.

## Testing a pack locally

Load a pack straight from the working tree, without installing it:

```bash
claude --plugin-dir plugins/core --plugin-dir plugins/openspec
```

A session runs the pack installed at project scope, not the working tree: after a release merges, run `claude plugin update devkit-openspec@devkit` (and `devkit-core@devkit` when it changed) in the project before dogfooding the new version, or load the tree with `--plugin-dir` as above.

**Testing a mod pack.** A pack of hooks modules (`plugins/panel`) is tested with `claude plugin test <dir>`, which only the desktop app's bundled Claude Code has: `"$HOME/Library/Application Support/Claude/claude-code/<version>/<hash>/claude.app/Contents/MacOS/claude"` (the npm `claude` has no `plugin test`, but its `plugin validate` accepts the repository and the pack again). Before a run, `<that binary> plugin test --help` must print `Run a mod's tests`; when it prints the rollout-switch refusal instead (exit 0 as well), run `<that binary> -p "ok" --max-turns 1 --model haiku` once with network access and check again; the refreshed switch holds for about two minutes. In `tasks.md` a gate is the first backticked text after `Gate:`, and `deliver-check`, `ship-change` and `pr-verifier` run each `&&` part of it on its own: name the binary by absolute path inside the command (prose or an `export PATH` outside the backticks does not count) and put the `plugin test` part first, before the guard suite.

- The app updates its bundled Claude Code under you, so a gate names it with the version-agnostic form `"$(for c in "$HOME/Library/Application Support/Claude/claude-code/"*/*/claude.app/Contents/MacOS/claude; do :; done; echo "$c")"` (no `|`, so `deliver-check` can match it).
- To see a pack live in a session, link its folder into that session's dev-mods folder (the plugin-authoring skill names it) and turn hot reload on. Every save reloads the pack. A project `settings.local.json` `env` is never read, and reopening a session does not restart its process.
- On the desktop surface a Box takes `backgroundColor`. The surface clips nothing by `height` or `overflow`, and a one-row Box is a full line tall. Draw dividers as spacing and bars as Boxes with a percentage width, never as glyph runs sized to a column count.
