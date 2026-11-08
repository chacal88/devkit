# Contributing

## How changes are made here

This repo uses its own flow. Open a change with `openspec new change <id>` (`devkit-lite` by default; `--schema devkit` for the cases listed in [docs/openspec-flow.md](docs/openspec-flow.md#choosing-a-schema)), name the branch after it, and let the hooks gate the PR. When `openspec/roadmap.md` exists, it lists the rounds the changes belong to. After the merge, run the `retro` skill and `openspec archive <id>`.

When a change edits an agent's output format, dispatch that change's agents with the repo's `plugins/<pack>/agents/<name>.md` as the format source: the installed plugins follow the old format until the release is installed.

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
