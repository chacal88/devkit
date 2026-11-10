# Review: devkit-opt-in

Structural: PASS (`openspec validate devkit-opt-in --strict` valid; links checked by `scripts/check.py`, green at 69c42d9)

| Reviewer | Verdict | Blocking findings |
|---|---|---|
| adr-reviewer | PASS | 0 |
| code-quality-reviewer | PASS | 0 (5 nits) |
| test-coverage-reviewer | PASS | 0 (4 nits) |
| security-reviewer | PASS | 0 (2 nits) |

Consensus: PASS (round 1/2)

Gate given to reviewers (not re-run by them): `node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && claude plugin validate .` green at 69c42d9 (421/421).

## Nits (non-blocking, follow-up candidates)

- `scripts/check.py:109-110` unreachable after `main()`'s `sys.exit`; `ROOT` reassigned as a global for `--root`.
- `project-settings.mjs:60-66` raw TypeError on `"devkit": null`; `apply()` may leave a `.tmp` on a failed rename.
- `guard.mjs` `projectSchema` is a minimal line parse of `config.yaml` (undocumented limit).
- Untested: `schema: devkit` with no `openspec/changes/` (no git guard); symlinked `HOME` refusal; nonexistent `install-schemas.sh <path>`.
- `docs/migrate-to-project-scope.md` items 3 and 4: a re-run overwrites the `.bak-devkit-opt-in` backup (`cp -n` avoids it); item 3 truncates the file if `jq` fails (write to a temp file, then move).

## Next

Ready to ship: `pr-verifier`, then `commit-and-pr`.
