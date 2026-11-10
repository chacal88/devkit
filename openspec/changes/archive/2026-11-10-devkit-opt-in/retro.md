## Retro: devkit-opt-in

1. Went wrong:
   - The first plan made the new install-scope lint contradict the migration doc's Undo line (`--scope user`); readiness caught it (NEEDS-REVISION, then APPROVED).
   - The phase-2 `tdd-implementer` killed a hung test run with a broad `pkill -f` pattern, which can kill other sessions' node processes on the same machine (another session, conduct-rounds, was working in parallel).
   - `requirements.md` quoted the owner's request in Portuguese, as the schema asks ("the owner's request, in their words"), and `scripts/check.py` `check_language` (`scripts/check.py:76-81`) then failed the gate; the planner replaced it with the English translation.
   - The security review found that the migration doc's items 3 and 4 copy the backup on every run (`docs/migrate-to-project-scope.md:84`, `:108`): a second run overwrites `.bak-devkit-opt-in` with the already edited file, so Undo restores the edited one.
2. Better next time:
   - Agents kill only the PID they started, never by pattern.
   - The requirements template says how to quote a request made in another language when the project's docs must be English.
   - Owner-machine commands that edit a file keep the first backup (`cp -n`) and write through a temporary file.
3. Remember: a command that runs on the owner's machine must be safe to run twice.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | Broad `pkill` patterns kill other sessions' processes | process-friction | doc-update | project |
| 2 | "In their words" collides with the English-only docs check | doc-gap | doc-update | project |
| 3 | Migration items 3 and 4 are not safe to re-run | bug-class | doc-update | project |
| 4 | Readiness caught a plan contradiction before code | process-friction | memory-only (no change: the gate worked) | project |

## Post-merge: machine state (AC-7, per design Q2)

Run on 2026-11-10, each step after the owner's own yes for it (`docs/migrate-to-project-scope.md`).

- Preconditions (owner: yes). `git -C ~/Documents/devkit pull --ff-only` brought `.claude/settings.json` to the main checkout. `claude plugin marketplace update devkit` left the installed packs at 0.5.0 / 0.6.0: it refreshes the catalog only. `claude plugin update <pack>@devkit --scope user` then installed devkit-core 0.5.2 and devkit-openspec 0.7.1. Worktrees: conduct-rounds has `.claude/settings.json`; `openspec-setup-b0bdf2` (an old archive branch) has not.
- Item 1 (owner: yes). Both packs uninstalled from user scope. Check: `0`, then `[]`.
- Item 2 (owner: yes, then yes to the alternative). The doc's `claude plugin marketplace remove devkit --scope user` failed with no change: "Marketplace 'devkit' is not declared in user settings". Run instead without `--scope` from a new empty folder: removed. Check: `false`. `~/.claude/settings.json` unchanged, and both opted-in projects still declare the marketplace. Side effect: every devkit install record was removed, project scope included (representante-digital and its worktrees), so item 4 had nothing left to do.
- Item 3 (owner: yes). The `devkit-openspec@devkit` entry removed from `~/Documents/recruit/.claude/settings.local.json`, first backup kept as `settings.local.json.bak-devkit-opt-in`. Check: `false`, `parses`.
- Item 4. Not run: item 2 had already removed the entries (`claude plugin list --json` lists no devkit entry).
- Final check. `claude plugin list` shows no devkit pack at user scope (no devkit entry at all until an opted-in project is opened). The margi settings loop prints nothing. A new session in margi was not opened from this session.
- The doc's precondition 1 and item 2 are fixed to what was run, item 4 says when to skip it, and the doc test pins both (PR after this archive).

## Proposed updates

### `plugins/core/agents/tdd-implementer.md` (process-friction)
Never stop a process by pattern; other sessions share the machine.
- before: (no rule about stopping processes)
+ after: under "Never": "Stop a hung command by its own PID only; never `pkill`/`killall` by pattern: other sessions run the same tools on this machine."
- Answer: approved
- Applied: yes

### `plugins/openspec/schemas/devkit/schema.yaml`, `plugins/openspec/schemas/devkit/templates/requirements.md`, `openspec/schemas/devkit/schema.yaml`, `openspec/schemas/devkit/templates/requirements.md` (doc-gap)
Say how to quote a request made in another language.
- before: - **Request**: the owner's request, in their words.
+ after: - **Request**: the owner's request, in their words; when the project's docs must be in another language than the request, the faithful translation, marked "(translated from <language>)".
- Answer: approved
- Applied: yes

### `docs/migrate-to-project-scope.md`, `plugins/openspec/hooks/guard.test.mjs`, `docs/openspec-flow.md` (bug-class)
Items 3 and 4 keep the first backup and write through a temporary file, with the doc test pinning both. (`docs/openspec-flow.md` added when applying: its CI pin follows the devkit-openspec version bump, `v0.7.0` to `v0.7.1`, which `deliver-check.test.mjs` enforces.)
- before: f=… && cp "$f" "$f.bak-devkit-opt-in" && jq '…' "$f.bak-devkit-opt-in" > "$f"
+ after: f=… && cp -n "$f" "$f.bak-devkit-opt-in" && jq '…' "$f.bak-devkit-opt-in" > "$f.tmp" && mv "$f.tmp" "$f"
- Answer: approved
- Applied: yes
