Verdict: approved
Commit: 69c42d96c05415a9a1c766834b0a75347adb8db4

## ADR review — devkit-opt-in

ADR review — pass. 4 ADRs reviewed: ADR 0001 (`docs/adr/0001-coordination-without-a-harness.md`), ADR 0002 (`docs/adr/0002-merge-without-the-owner-opt-in.md`), ADR 0003 (`docs/adr/0003-auto-merge-the-archive-pr.md`), ADR 0004 (`docs/adr/0004-devkit-per-project.md`).

### Findings
None.

Checked:
- ADR 0001: no long-running process or state outside the repo and GitHub. The opt-in marker is `openspec/config.yaml`, read from disk in `plugins/openspec/hooks/guard.mjs` (`projectSchema`, `optedIn`). The gates in `guardEdit`, `guardBash` and `session` are unchanged once `optedIn` is true.
- ADR 0002 and 0003: the merge mode and the `ci` path are untouched. `guard.mjs` `ci` mode (the `mode === 'ci'` dispatch) does not call `optedIn`, as ADR 0004 requires.
- ADR 0004 against the implementation:
  - The hooks are silent for edit, bash (destructive git included) and session outside a `devkit` or `devkit-lite` project.
  - `install-schemas.sh` installs into the project by default, and machine-wide only with `--user`.
  - `openspec-setup` writes `.claude/settings.json` through `project-settings.mjs` and never installs at user scope.
  - `scripts/check.py` enforces `--scope project`, with `--scope user` allowed only in the migration doc.
  - The repo's own `.claude/settings.json` and `openspec/config.yaml` (`schema: devkit-lite`) opt this repo in.
  - The accepted negatives (the `cd` case, a renamed schema) are documented in the ADR.
