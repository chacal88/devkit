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

Pending: the owner's yes per migration item; the result of each approved item and the final check are recorded here after they run.

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
