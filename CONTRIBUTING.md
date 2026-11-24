# Contributing

## How changes are made here

This repo uses its own flow. Open a change with `openspec new change <id>` (`devkit-lite` by default; `--schema devkit` for the cases listed in [docs/openspec-flow.md](docs/openspec-flow.md#choosing-a-schema)), name the branch after it, and let the hooks gate the PR. When `openspec/roadmap.md` exists, it lists the rounds the changes belong to. After the merge, `ship-change` archives the change through a PR on `chore/archive-<id>` (in `pr` mode, run it again after you merge).

This repository ships in `merge` mode ([ADR 0002](docs/adr/0002-merge-without-the-owner-opt-in.md)): once a change is at 8/8, GitHub merges it when the `devkit-reviews` check passes. The `devkit` ruleset blocks direct pushes to `main` for everyone, so every change, the archive commit included, lands through a pull request; the archive PR's auto-merge rule is [ADR 0003](docs/adr/0003-auto-merge-the-archive-pr.md).

This repository opts in to its own hooks through its `.claude/settings.json` and `openspec/config.yaml` ([ADR 0004](docs/adr/0004-devkit-per-project.md)).

When a change edits an agent's output format, dispatch that change's agents with the repo's `plugins/<pack>/agents/<name>.md` as the format source: the installed plugins follow the old format until the release is installed.

When an implementer resolves a readiness note in a way the design does not say, amend `design.md` in the same phase. When a check guards an action (auto-merge, a push, a merge), the design lists every step path that reaches that action, open and resumed states included, and each path gets the check and a test.

When a fix changes behaviour that an ADR or `design.md` written in the same change describes, update that text in the same fix commit; a stale ADR found by review costs another round.

When a change merges a base that merged a sibling while the change was in review (`resolve-release-conflict`, `update-branch`, or by hand), re-read what the change consumes from that sibling before pushing the merged head: a skill's argument forms, a checker's exit codes and JSON fields, the text a button fills; and run by name the tests that base added since the plan's base (`git diff <plan base>..origin/<base> --stat -- '*.test.mjs'`) before the evidence run: a failing one is a row for the plan's test table and one plan revision, not a failed evidence attempt. The reviews run again on the pushed head either way; a contract found moved by review costs another round. In a roadmap run, a change that reaches its release step asks the coordinator to hold other merges to `main` until its PR merges, and takes its version numbers from `origin/main` right after a fresh `git fetch`: every sibling merged meanwhile costs one more merge, and one more evidence run and review when the sibling brought one of the change's own files (the own-files rule of [docs/openspec-flow.md](docs/openspec-flow.md), ADR 0025). In a project with a delivery train ([ADR 0022](docs/adr/0022-reviewed-changes-leave-on-a-delivery-train.md)) a boarded change never merges the base for a sibling: the sibling's merge does not touch its head, so its evidence and reviews stay current, and the departure merges the base into the train instead.

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
   node scripts/test-suite.mjs
   ```

   `scripts/test-suite.mjs` runs every `*.test.mjs` of `plugins/openspec/hooks/`, `plugins/openspec/skills/openspec-setup/scripts/`, `plugins/core/skills/review-change/scripts/` and `plugins/compozy/skills/compozy-setup/scripts/` (the CompozyOS kit's five suites), each file in a process of its own with its own empty `TMPDIR` (a real path, under one run root the script removes at the end). The run root is made under the real path of the environment's `TMPDIR` when it leaves room for the longest Unix socket path a test binds: a socket path holds 104 bytes on macOS, the terminator included, so the run root takes at most 71. Otherwise the run root goes under the real path of `/tmp` (`/private/tmp` on macOS), and the script prints one `run root:` line saying where and why; when neither folder can hold it, the script exits 2. A test that binds a Unix socket does so under its `TMPDIR` (as `fakeCompozy(...).daemon` does), so the leftover check covers the socket. The script runs as many files at once as the machine has cores (`--concurrency=<n>` on a loaded machine). Give it file arguments to run only those files, and `--test-name-pattern="^<name>"` to run only the tests whose name matches. A test file that imports another test file is refused before any file runs: what several test files share lives in `plugins/openspec/hooks/test-fixtures.mjs`. A file that leaves anything in its `TMPDIR` fails the run, and the summary names what it left. The whole run takes about 10 minutes on an idle 8-core machine; 9:36 observed on a9babd2. The wall clock is the largest file: keep every test file under about 300 s in the summary of `node scripts/test-suite.mjs`, and split a file above it at its section headings into `<name>-<part>.test.mjs` parts with their shared helpers in `<name>-fixtures.mjs` (no test renamed; the sorted test names before and after are equal). Give reviewers its result instead of having them re-run it. To run only the review round's tests, use `node scripts/test-suite.mjs plugins/core/skills/review-change/scripts/review-round.test.mjs`.

   A test fixture never depends on the branch variables of the machine that runs it: every env it builds blanks `DEVKIT_BYPASS`, `DEVKIT_BRANCH`, `DEVKIT_CHANGE`, `GITHUB_HEAD_REF`, `GITHUB_BASE_REF` and `GITHUB_EVENT_PATH`, through one shared constant of the test file. A test in `guard.test.mjs` refuses an env that blanks `DEVKIT_BRANCH` alone.

   A test fixture makes every temporary folder through its pack's `test-tmp.mjs` (`plugins/openspec/hooks/`, `plugins/core/skills/review-change/scripts/`, `plugins/compozy/skills/`; the three copies stay byte-identical), with a prefix that starts with `devkit-`. The helper removes each folder when its test ends, passed or failed, and sweeps the rest when the run ends or gets `SIGINT` or `SIGTERM`. A test reads the temporary root only through `tmpRoot()`. A fixture shared by several tests is made at module level, never lazily inside the first test that needs it: the helper removes a folder when the test that made it ends. `test-tmp.test.mjs` refuses a raw `mkdtempSync` or `tmpdir()` call in any `*.test.mjs` or `*-fixtures.mjs` under `plugins/`. The suite script runs each file with its own empty `TMPDIR` and fails a file that leaves anything there (CI runs the suite as its one `Test suite` step); a test that calls, in its own process, code that writes under the temporary root (a stop record, a lock) points the process's temporary root at a `tmpFolder` for that call and restores it afterwards, and before the first push run a new or changed test file with `node scripts/test-suite.mjs <file>`.

   Await every subtest (`await t.test(...)` in an `async` parent): an un-awaited subtest passes on a newer local Node and is cancelled on CI's. `scripts/check.py` fails on a `t.test(` line without `await` in any `plugins/**/*.test.mjs`, naming the file and line.

   ```bash
   "$HOME/Library/Application Support/Claude/claude-code/<version>/<hash>/claude.app/Contents/MacOS/claude" plugin validate .
   ```

   Use the desktop app's bundled Claude Code (see "Testing a mod pack" below); the npm `claude` (2.1.227) validates the repository and the pack again, since devkit-panel 0.2.0 dropped `userConfig.language.options`, but it still has no `plugin test`.

   A change that reads a GitHub route for the first time records one read-only live call of it in `evidence.md`; a fake-gh fixture alone does not prove the route or the shape.

5. Bump the `version` of every pack you changed, in its `plugin.json` and in `marketplace.json`, and add a line to [CHANGELOG.md](CHANGELOG.md). Changes run in parallel: when you merge `main` before the merge of your pull request, take the next version after `main`'s and the next free ADR number in `main`'s `docs/adr/`, and renumber your ADR and every reference your change made to it when another change took its number first. When a change has had to redo its release against `main` twice, its session asks the coordinator for a merge window: sibling changes hold their own merge (and auto-merge) until that pull request lands, so it does not loop on release collisions. Fetch `main` again right before each push of the delivery and before `enable-auto-merge`: a sibling that merged in between took your number, and merging it then costs one merge, and one suite and one re-review when the sibling brought one of the change's own files, instead of a conflict found after the checks. In a project with a delivery train a boarded change takes its release numbers on the train: the departure renumbers each join above the train's numbers, and the change's own head keeps the numbers it had. A release that changes devkit-openspec's version moves the CI pins of `docs/openspec-flow.md` and no test: the test `change-loop docs: the design records the answers` (in `plugins/openspec/hooks/change-loop-compozy.test.mjs`) reads the expected pin from `plugins/openspec/.claude-plugin/plugin.json`, so a release does not edit it ([ADR 0030](docs/adr/0030-the-pin-test-reads-the-manifest-so-only-the-flow-page-pins-pass-unnamed.md)).

   A release that changes devkit-openspec's version is tagged `v<that version>` on its merge commit on `main`: a lightweight tag, pushed after the merge (`git tag v<x> <merge sha>`, then `git push origin v<x>`), because `openspec-setup` pins projects' CI and vendored schemas to that tag's commit (ADR 0002). A release that bumps only other packs gets no new tag: it has nothing new to pin, and `v<that version>` already names an earlier commit. On a delivery train the release is the train's: a train whose release changes devkit-openspec's version is tagged `v<the train's version>` on the train's merge commit, and the intermediate versions of the boarded changes get no tag.

   This repository sets `devkit.release_tag` to devkit-openspec's `plugin.json`, so after the merge `deliver-check` answers `tag-release` and the session pushes that tag itself, before the retro ([ADR 0019](docs/adr/0019-the-delivery-loop-tags-the-release-it-merged.md)); the by-hand commands above are for a release made outside the loop.

## Changing the OpenSpec schemas

Validate them against the current OpenSpec CLI:

```bash
cd "$(mktemp -d)" && git init -q && openspec init --tools none
```

```bash
bash <repo>/plugins/openspec/skills/openspec-setup/scripts/install-schemas.sh .
```

Each schema lives in two copies (`plugins/openspec/schemas/` and this repository's `openspec/schemas/`, kept byte-identical by `install-schemas.sh`), and each folder holds `flow.json`, `flows/<n>.json` and the templates with their stage header: change `schema.yaml`, `flow.json` and the templates together, because `flow-check` reads all three. A change to a `flow.json` raises its `version`, copies the new file to `flows/<n>.json` (the same bytes) and records its digest in `scripts/released-flows.json` (`sha256:` and the hex of `shasum -a 256`); a released `flows/<n>.json` is never edited, because changes opened under it keep following it. The same change adds a top-level `readerRelease` to the new `flow.json` (the devkit-openspec release that ships it) and raises that script's entry of `FLOW_VERSIONS` in `plugins/openspec/hooks/guard.mjs`: a reader older than the file then says which release to install, and a test fails when the entry and the shipped version differ. `scripts/check.py` refuses anything else. The suite needs the `openspec` CLI (major 2) on `PATH` (this repository pins none; a project that pins one has it used instead): the schema tests create a change with it.

The hooks depend on the artifact id `readiness` and on the `- Status:` / `Verdict:` lines; keep them, or change `plugins/openspec/hooks/guard.mjs` and its tests together.

## Testing a pack locally

Load a pack straight from the working tree, without installing it:

```bash
claude --plugin-dir plugins/core --plugin-dir plugins/openspec
```

A session runs the pack installed at project scope, not the working tree: after a release merges, run `claude plugin update devkit-openspec@devkit` (and `devkit-core@devkit` when it changed) in the project before dogfooding the new version, or load the tree with `--plugin-dir` as above. When a change branch merges a `main` whose `flow.json` schema changed, the installed `change-loop.mjs` refuses the change as malformed: drive it with the worktree's `node plugins/openspec/hooks/change-loop.mjs` until that release is installed.

**Testing a mod pack.** A pack of hooks modules (`plugins/panel`) is tested with `claude plugin test <dir>`, which only the desktop app's bundled Claude Code has: `"$HOME/Library/Application Support/Claude/claude-code/<version>/<hash>/claude.app/Contents/MacOS/claude"` (the npm `claude` has no `plugin test`, but its `plugin validate` accepts the repository and the pack again). Before a run, `<that binary> plugin test --help` must print `Run a mod's tests`; when it prints the rollout-switch refusal instead (exit 0 as well), run `<that binary> -p "ok" --max-turns 1 --model haiku` once with network access and check again; the refreshed switch holds for about two minutes. In `tasks.md` a gate is the first backticked text after `Gate:`, and `deliver-check`, `ship-change` and `pr-verifier` run each `&&` part of it on its own: name the binary by absolute path inside the command (prose or an `export PATH` outside the backticks does not count) and put the `plugin test` part first, before the test suite.

- The app updates its bundled Claude Code under you, so a gate names it with the version-agnostic form `"$(for c in "$HOME/Library/Application Support/Claude/claude-code/"*/*/claude.app/Contents/MacOS/claude; do :; done; echo "$c")"` (no `|`, so `deliver-check` can match it).
- To see a pack live in a session, link its folder into that session's dev-mods folder (the plugin-authoring skill names it) and turn hot reload on. Every save reloads the pack. A project `settings.local.json` `env` is never read, and reopening a session does not restart its process.
- On the desktop surface a Box takes `backgroundColor`. The surface clips nothing by `height` or `overflow`, and a one-row Box is a full line tall. Draw dividers as spacing and bars as Boxes with a percentage width, never as glyph runs sized to a column count.
