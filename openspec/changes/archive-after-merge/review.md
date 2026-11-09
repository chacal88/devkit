# Review: archive-after-merge

Round 1/2 at `e497cc29002c8cda9fdddbe2c945f7ed95e65479` (range `dac9784..e497cc2`).

Structural: PASS (`openspec validate archive-after-merge --strict`)

| Reviewer | Verdict | Blocking findings |
|---|---|---|
| adr-reviewer | PASS | 0 |
| architecture-reviewer | PASS (2 important) | 0 |
| code-quality-reviewer | FAIL | 0 (1 important) |
| test-coverage-reviewer | FAIL | 1 |
| security-reviewer | FAIL | 1 |

Consensus: FAIL (round 1/2)

## Blockers

- security-reviewer, test-coverage-reviewer — `plugins/openspec/hooks/deliver-check.mjs:866-885` vs `:908-910` — with an archive PR open, `archiveNext` returns before the exact-path file check and the retro answer rows, so a file no approved proposal names can reach `enable-auto-merge`.
- security-reviewer, test-coverage-reviewer (important) — `plugins/openspec/hooks/deliver-check.mjs:144` — `isOpenspec` exempts all of `openspec/`, including `openspec/config.yaml`.
- architecture-reviewer (important) — `plugins/openspec/hooks/deliver-check.mjs:748` — the file check runs only locally; `devkit-reviews --ci` passes an archive branch with "nothing to check".
- code-quality-reviewer (important) — `plugins/openspec/hooks/deliver-check.mjs` `findChangePr` — 100 merged PRs with `body` can exceed `spawnSync`'s 1 MiB buffer (`plugins/openspec/hooks/merge-setup.mjs:29`, `ENOBUFS`).

## Rebutted

- architecture-reviewer (important) — retro format unpinned across plugins: refuted by `plugins/openspec/hooks/deliver-check.test.mjs:3677`, which parses `plugins/core/skills/retro/SKILL.md`'s Output example with `readRetro`.
- test-coverage-reviewer (important) — AC-5/AC-8 need real GitHub proof: assigned to `evidence.md` (AC-8: `gh api` on ruleset 26859494) and to the AC-9 dogfood (AC-5 on the archive PR exists only after this change's merge, design R-4).

## Next

Fix the blockers through `tdd-implementer`; round 2 re-summons code-quality-reviewer, security-reviewer and test-coverage-reviewer.
