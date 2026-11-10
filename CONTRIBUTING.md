# Contributing

## How changes are made here

This repo uses its own flow. Open a change with `openspec new change <id>` (`devkit-lite` by default; `--schema devkit` for the cases listed in [docs/openspec-flow.md](docs/openspec-flow.md#choosing-a-schema)), name the branch after it, and let the hooks gate the PR. When `openspec/roadmap.md` exists, it lists the rounds the changes belong to. After the merge, `ship-change` archives the change through a PR on `chore/archive-<id>` (in `pr` mode, run it again after you merge).

This repository ships in `merge` mode ([ADR 0002](docs/adr/0002-merge-without-the-owner-opt-in.md)): once a change is at 8/8, GitHub merges it when the `devkit-reviews` check passes. The `devkit` ruleset blocks direct pushes to `main` for everyone, so every change, the archive commit included, lands through a pull request; the archive PR's auto-merge rule is [ADR 0003](docs/adr/0003-auto-merge-the-archive-pr.md).

This repository opts in to its own hooks through its `.claude/settings.json` and `openspec/config.yaml` ([ADR 0004](docs/adr/0004-devkit-per-project.md)).

When a change edits an agent's output format, dispatch that change's agents with the repo's `plugins/<pack>/agents/<name>.md` as the format source: the installed plugins follow the old format until the release is installed.

When an implementer resolves a readiness note in a way the design does not say, amend `design.md` in the same phase. When a check guards an action (auto-merge, a push, a merge), the design lists every step path that reaches that action, open and resumed states included, and each path gets the check and a test.

When a fix changes behaviour that an ADR or `design.md` written in the same change describes, update that text in the same fix commit; a stale ADR found by review costs another round.

When a change alters how the owner works (what runs, in which order, who starts it), the grill ends with a walkthrough of one concrete day under the new behaviour, including an urgent item, and the owner confirms the walkthrough itself, not only the options.

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

   `guard.test.mjs` imports `deliver-check.test.mjs`, `merge-setup.test.mjs` and `github-setup.test.mjs`, so this one command runs every hook test (about 6 minutes); give reviewers its result instead of having them re-run it.

   ```bash
   claude plugin validate .
   ```

5. Bump the `version` of every pack you changed, in its `plugin.json` and in `marketplace.json`, and add a line to [CHANGELOG.md](CHANGELOG.md).

## Changing the OpenSpec schemas

Validate them against the current OpenSpec CLI:

```bash
cd "$(mktemp -d)" && git init -q && openspec init --tools none
```

```bash
bash <repo>/plugins/openspec/skills/openspec-setup/scripts/install-schemas.sh .
```

The hooks depend on the artifact id `readiness` and on the `- Status:` / `Verdict:` lines; keep them, or change `plugins/openspec/hooks/guard.mjs` and its tests together.

## Testing a pack locally

Load a pack straight from the working tree, without installing it:

```bash
claude --plugin-dir plugins/core --plugin-dir plugins/openspec
```
