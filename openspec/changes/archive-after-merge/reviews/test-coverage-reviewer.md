Verdict: approved
Commit: d50ffb134c0486372e7b44e2888c211b099bfe99

## Coverage analysis — archive-after-merge, round 2 (e497cc2..d50ffb1, scoped)

In-scope surfaces: plugins/openspec/hooks (deliver-check.mjs, deliver-check.test.mjs, merge-setup.mjs).
Blocking gaps (8-10 without a plan): 0
Seams checked: P13/answers on an OPEN archive PR → caught by the three P3j tests (same head, ahead, dirty tree, auto-merge on, unanswered, rejected); openspec/ exemption narrowed → caught by the `bad` rows for config.yaml, schemas/, other openspec/ files and the `ok` row for a named config.yaml; `--ci` on an archive PR → caught by the real-git archivePrRepo tests (extra file, config.yaml, rejected proposal, directory target, unanswered, missing retro, no base); AC-5/AC-8 on GitHub → accepted plan (below). Mutation runs: 0 (suite not re-run, green 380/380 reported).

### Findings
- [blocking] [8] P13 is skipped whenever an archive PR is already OPEN · fixed in d50ffb1. `archiveNext` now computes `held` (answers, then file check) before the OPEN-PR branches; `disable-auto-merge` wins when auto-merge is on, then `held` returns before conflicts/ahead/update-branch/enable-auto-merge. P3j asserts `stop-archive/apply-proposals` for same head, local ahead and dirty tree with `merges(t)` empty, `disable-auto-merge` in all three variants (and `wait-merge` for the all-named control), and `stop-retro-answers` plus `disable-auto-merge` for unanswered. The control case would turn red if `held` were dropped or moved below the branches.
- [important] [6] AC-8 and AC-5 lack real GitHub proof · refuted: the rebuttal holds as a plan, with two conditions. AC-8 (bypass_actors) is a readable fact today: `gh api` on ruleset 26859494 into evidence.md is the right artifact and pr-verifier is the gate that must see it; if it is absent there, that is its blocking finding, not a new unit test. AC-5 on a real archive PR cannot exist before this change merges (design R-4); the AC-9 dogfood is the correct place, and the unit side (P3f-h, P3i, `--ci` real-git tests) already pins the logic. Keep the dogfood item listed as an open obligation in the retro so it is not silently dropped.
- [important] [5] `openspec/` exempt wholesale in `unnamedFiles` · fixed in d50ffb1. `isArchiveRecord` is `openspec/changes/**` or `openspec/roadmap.md`; reject rows cover `openspec/config.yaml`, `openspec/schemas/**`, `openspec/other.md`, and an `ok` row proves a named config.yaml still passes.
- [nit] `openspec/changes/**` still lets an archive branch edit another change's folder (e.g. `openspec/changes/other/notes.md`, asserted as ok at the P13 ok table) without a proposal. The tests pin it, so it is deliberate; confirm it in ADR 0003 or narrow to the archived folder plus the change's own source folder.
- [nit] `held` applies only when `a.local === 'archived'` and the retro is readable; an OPEN archive PR with a local branch still `active` skips the checks. No test covers that combination; low risk because `archive` step precedes it.
- [nit] (carried) implementation-coupled: the `doesNotMatch(src, /step\('merged'/)` source grep and `Object.keys(j.archive)` order assertion from round 1 remain.

### Well covered
- The answers and file gate on an open archive PR, including auto-merge disabling, no `pr merge` call (P3j).
- `--ci` archive-PR check end to end on real git: pass, unnamed file, config.yaml, rejected-proposal target, directory target, unanswered, section-less and missing retro, no-op PR, no GITHUB_BASE_REF.
- findChangePr body-by-number reads: light list fields, newest-first, over-1-MiB list, unreadable body is an error, overflow named by ghError.
