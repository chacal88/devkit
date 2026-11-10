Verdict: approved
Commit: 69c42d96c05415a9a1c766834b0a75347adb8db4

## Quality review — devkit-opt-in (round 1)

### Findings
- [nit] scripts/check.py:109-110 — dead code: `main()` ends with `sys.exit`, so the trailing `print(...)`/`sys.exit(...)` after `main()` never runs. · fix: delete those two lines.
- [nit] scripts/check.py:100-101 — `main()` reassigns the module-global `ROOT` so the check functions see `--root`. It works (the fixture tests prove it) but is fragile. · fix: pass `root` into the check functions, or add a one-line comment saying the global is intentional.
- [nit] plugins/openspec/skills/openspec-setup/scripts/project-settings.mjs:60-66 — `"extraKnownMarketplaces": {"devkit": null}` crashes with a raw TypeError (`Cannot read properties of null (reading 'source')`, exit 1; reproduced in a temp dir, nothing written). The file stays intact and the exit code is right, but the message is not diagnosable. · fix: `have?.source ?? have`, or refuse non-object values with a RefusedError.
- [nit] project-settings.mjs:108-113 — `apply()` leaves a `.tmp` file if `renameSync` fails, and a rewrite drops the existing file's mode. Neither matters for a committed settings file. · fix: optional cleanup in a `finally`.
- [nit] plugins/openspec/hooks/guard.mjs:136-142 — `projectSchema` is a line regex over config.yaml. It handles quotes and trailing comments, and the tasks cover `# schema: devkit` and `devkit-lite-custom`. A `schema:` key nested under another block (indented) is correctly ignored by `^`. No defect; the YAML-lite limit is stated nowhere. · fix: one comment line saying the parse is intentionally minimal.
- [praise] plugins/openspec/hooks/guard.mjs:321-342 — the opt-in check sits at the boundary of each mode, and `gitViolation` moves behind `findRoot` and `optedIn`, so the silent-outside rule has one owner. `ci` and the existing exports are untouched, as the proposal says. The fail-closed default for AC-1 and AC-2 is right: an unreadable or missing config means no gating.
- [praise] project-settings.mjs:50-85 — a pure `merge`/`plan` split from `apply`, so `--dry-run` and the tests share one code path. It refuses the home folder, writes atomically and never touches `settings.local.json`. The tests list every edge (invalid JSON, array, key order, mtime unchanged).
- [praise] docs/adr/0004-devkit-per-project.md — the negative consequences are honest (destructive git is no longer refused outside opted-in projects, the `cd` bypass, old-branch worktrees), each tagged Accepted or Mitigated, with a review trigger. The ADR does not contradict the diff.
- [praise] scripts/check.py:84-95 — the install-scope lint with a `--root` fixture option, a single exemption for the migration doc, and a proof run on real input before the docs change (tasks 3.1).

### Summary
- 5 findings (0 blocking, 0 important, 5 nit) + 4 praise
- Justification: I checked the diff against requirements AC-1..AC-8 and ADR 0004. Scope matches the proposal (hooks, setup scripts, docs, release bumps, repo settings). AC-6 is met by the committed `.claude/settings.json`. AC-4 is enforced mechanically by the lint. AC-8 is shown by the version, marketplace and catalog changes in the stat plus the green gate. Gate result as supplied by the caller (not re-run): guard tests 421/421, check.py, gen-catalog --check and `claude plugin validate .` all green at 69c42d9. I ran one reproduction (the null marketplace value). AC-7's machine state is deliberately post-merge and recorded in the retro, per the owner's answer to Q2. The doc and its format test are in the diff, but I did not open the doc line by line, and none of the migration commands were run. The security-reviewer and test-coverage-reviewer cover the deeper settings-writer and coverage questions.
