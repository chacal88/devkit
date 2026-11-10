# Migrate to project scope

Before devkit 0.7.0 the packs were installed at user scope, so every project on the machine loaded them. From 0.7.0 on each project opts in through its own `.claude/settings.json` ([ADR 0004](adr/0004-devkit-per-project.md)). This page removes the old user-scope install from a machine, one item at a time.

**Run an item only after the owner says yes to that item; an agent never runs one on its own.** Give the yes for each item in its own message, never batched with another. Every item has a **Command**, a **Check** and an **Undo**. Read the Undo before you run the Command.

## Preconditions

All of these hold before item 1:

1. This repository's change is merged and released. Update the marketplace, then confirm the installed `devkit-openspec` is 0.7.0 or later, so the self-defending hooks are what is installed:

   ```bash
   claude plugin marketplace update devkit
   claude plugin list --json | jq -r '.[] | select(.id=="devkit-openspec@devkit" and .scope=="user") | .version'
   ```

2. The main checkout has the repository's own `.claude/settings.json`:

   ```bash
   git -C ~/Documents/devkit pull
   ```

3. Every worktree still in use has `.claude/settings.json` too (merge `main` into it first), because a worktree without the file loses devkit after item 1:

   ```bash
   git -C ~/Documents/devkit worktree list
   ```

## Items

Run them in this order. Item 1 goes first; item 3 only matters once item 1 is done, because recruit then loads nothing from devkit anyway.

### 1. Uninstall both packs from user scope

**Command**

```bash
cd ~ && claude plugin uninstall devkit-core@devkit --scope user && claude plugin uninstall devkit-openspec@devkit --scope user
```

**Check** (the first prints `0`, the second prints `[]`)

```bash
claude plugin list --json | jq '[.[] | select((.id | endswith("@devkit")) and .scope=="user")] | length'
jq '.enabledPlugins // {} | keys | map(select(endswith("@devkit")))' ~/.claude/settings.json
```

**Undo**

```bash
claude plugin install devkit-core@devkit --scope user && claude plugin install devkit-openspec@devkit --scope user
```

### 2. Remove the user-scope devkit marketplace

Always pass `--scope user`: without `--scope` the CLI also removes the declaration from the current project's `.claude/settings.json`.

**Command**

```bash
cd ~ && claude plugin marketplace remove devkit --scope user
```

**Check** (prints `false`; opening a project that declares the marketplace adds it back, and that is expected)

```bash
jq 'has("devkit")' ~/.claude/plugins/known_marketplaces.json
```

**Undo**

```bash
claude plugin marketplace add chacal88/devkit --scope user
```

### 3. Remove the stale entry from recruit's local settings

Recruit's `~/Documents/recruit/.claude/settings.local.json` carries `"devkit-openspec@devkit": false`. The command keeps a backup before the edit, and drops `enabledPlugins` when it ends up empty.

**Command**

```bash
f=~/Documents/recruit/.claude/settings.local.json && cp "$f" "$f.bak-devkit-opt-in" && jq 'del(.enabledPlugins["devkit-openspec@devkit"]) | if .enabledPlugins == {} then del(.enabledPlugins) else . end' "$f.bak-devkit-opt-in" > "$f"
```

**Check** (prints `false`, then the file parses)

```bash
f=~/Documents/recruit/.claude/settings.local.json
jq '.enabledPlugins // {} | has("devkit-openspec@devkit")' "$f"
jq . "$f" > /dev/null && echo parses
```

**Undo**

```bash
f=~/Documents/recruit/.claude/settings.local.json && mv "$f.bak-devkit-opt-in" "$f"
```

### 4. Remove the representante-digital worktree entries from Claude Code's registry

This edits Claude Code's own registry, `installed_plugins.json`, because the CLI cannot remove project entries without editing each worktree's committed `.claude/settings.json`, and some of those paths no longer exist. Do it with no Claude Code session open, so nothing rewrites the file under you. The command keeps a backup first. A worktree that still exists registers again the next time a session opens there, because representante-digital opts in; that is expected.

**Command**

```bash
r=~/.claude/plugins/installed_plugins.json && cp "$r" "$r.bak-devkit-opt-in" && jq --arg p "$HOME/Documents/representante-digital/.claude/worktrees/" '.plugins |= with_entries(if (.key | endswith("@devkit")) then .value |= map(select(((.projectPath // "") | startswith($p)) | not)) else . end)' "$r.bak-devkit-opt-in" > "$r"
```

**Check** (prints `0`; representante-digital's own entry is still listed)

```bash
claude plugin list --json | jq '[.[] | select((.id | endswith("@devkit")) and ((.projectPath // "") | contains("/representante-digital/.claude/worktrees/")))] | length'
claude plugin list --json | jq -r '.[] | select((.id | endswith("@devkit")) and ((.projectPath // "") | endswith("/representante-digital"))) | .id'
```

**Undo**

```bash
r=~/.claude/plugins/installed_plugins.json && cp "$r.bak-devkit-opt-in" "$r"
```

## Final check

`claude plugin list` shows no devkit pack with `Scope: user`. In `~/Documents/projects/margi` no devkit pack is enabled in any settings file (each file is read on its own, so a missing one does not hide the others); the loop prints nothing:

```bash
cd ~/Documents/projects/margi && for f in ~/.claude/settings.json .claude/settings.json .claude/settings.local.json; do [ -f "$f" ] && jq -r '.enabledPlugins // {} | keys[] | select(endswith("@devkit"))' "$f"; done
```

Then open a new Claude Code session there: it prints no `[devkit]` line, and `/plugin` lists no devkit pack as enabled for that project. In the devkit repository and in representante-digital a new session loads the packs from the project scope (accept them in `/plugin` if Claude Code asks).
