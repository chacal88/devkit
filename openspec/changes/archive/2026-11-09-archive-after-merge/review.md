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

---

# Round 2/2 at `d50ffb134c0486372e7b44e2888c211b099bfe99` (range `e497cc2..d50ffb1`)

| Reviewer | Verdict | Open important |
|---|---|---|
| adr-reviewer | approved | 1 |
| architecture-reviewer | approved | 0 |
| code-quality-reviewer | approved | 0 |
| security-reviewer | approved | 1 |
| test-coverage-reviewer | approved | 0 |

Round-1 blockers: all fixed in `d50ffb1` (verified by each reviewer).

Consensus: FAIL by rule (two `important` findings without a rebuttal) after round 2 → escalated to the owner.

## Escalated to the owner

- adr-reviewer — `docs/adr/0003-auto-merge-the-archive-pr.md` — its Consequences say `devkit-reviews` gates nothing on an archive PR and its file rule says "outside `openspec/`"; since `d50ffb1` CI checks archive PRs and only `openspec/changes/**` and `openspec/roadmap.md` are exempt. Stricter than the ADR; the text is stale.
- security-reviewer — `plugins/openspec/hooks/deliver-check.mjs` `archiveNext` — the local file/answer check runs only when the folder is archived locally; an open archive PR whose folder never moved can reach `enable-auto-merge` locally (CI staleness backstops it; needs push access).

Owner decision (2026-11-09, in Portuguese: "Corrigir os dois"): fix both through `tdd-implementer`, then a short round 3 with adr-reviewer and security-reviewer only, authorized by the owner.

---

# Round 3 at `1286cfb50d6b8269bf6eea653be6bdc52fbc5f96` (range `d50ffb1..1286cfb`, owner-authorized)

| Reviewer | Verdict | Open blocking / important |
|---|---|---|
| adr-reviewer | approved | 0 (ADR 0003 text: fixed in `1286cfb`) |
| security-reviewer | approved | 0 (open archive PR without a local archived folder: fixed in `1286cfb`) |
| architecture-reviewer | approved (staleness re-check) | 0 |
| code-quality-reviewer | approved (staleness re-check) | 0 |
| test-coverage-reviewer | approved (staleness re-check) | 0 |

Consensus: PASS. Open nits only (long lines in ADR 0003 and design.md, regex text pins in `plugins/openspec/hooks/guard.test.mjs`, the archive-folder pattern repeated across `guard.mjs` and `deliver-check.mjs`).

## Next

`devkit-core:pr-verifier` writes `evidence.md`; then `devkit-core:commit-and-pr` opens the PR.
