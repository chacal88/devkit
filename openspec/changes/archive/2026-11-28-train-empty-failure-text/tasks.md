<!-- devkit-stage tasks result=passed attempt=1 commit=b7acf8f5042142eb9fcdd89dc96dbf1be40a5263 -->
# Tasks

Change: `train-empty-failure-text` · Date: 2026-11-28 · Owner: Kaue (chacal88) · Base:
`origin/main` at `6f03a57` · PRD / tech spec: n/a (`proposal.md`, `design.md`, `decisions.md`,
`release.md`, `specs/delivery-train/spec.md`)

Work only in this change's worktree, on its branch. Every name, text, path and assertion is in
`design.md`: D-1 the mapper, D-2 the file, D-3 the record, D-4 the end, D-5 the reply, D-6 the tests
T-1 to T-4 and the "Pinned rules" table, D-7 the documents. The implementer copies them and makes no
design choice. No behaviour changes outside the `result: empty` end of `departTrain`.

The release follows the note rule (ADR 0034): `release.md` names one `devkit-openspec` patch, and no
task bumps a version, edits a `CHANGELOG.md` line or a CI pin line, or numbers an ADR. This change
has no ADR (`decisions.md`). No script or test file is added or moved, so `scripts/test-map.json` is
not edited (CLAUDE.md, working rules).

Test first: T-1 to T-4 are written and seen red before the code changes (task 1.1). The gate is one
backticked command, run as written; its `node scripts/test-suite.mjs --own-files` part is not a part
of the train's command, so it has its own passing row in `evidence.md` after the last merge of the
base (`openspec/config.yaml`, `Gates:`). Run every suite run as a background command of the tool,
never with a shell `&`, with no other suite on the machine. End every task with
`git status --short`.

| AC | Tasks |
|---|---|
| AC-1 | 1.1, 1.3, 1.6 |
| AC-2 | 1.1, 1.3, 1.6 |
| AC-3 | 1.1, 1.3, 1.6 |
| AC-4 | 1.1, 1.3, 1.6 |
| AC-5 | 1.1, 1.2, 1.6 |
| AC-6 | 1.1, 1.4, 1.5, 1.6 |

## 1. The empty end keeps its failures (phase 1)

- [x] 1.1 The tests, red (D-6). In `plugins/openspec/hooks/delivery-train.test.mjs`, change T-1
  (the P8 test at line 1708: its new name, the captures before the departure, the added assertions
  and the second departure in `pt-BR`; add `isAbsolute` to the `node:path` import) and add T-2 after
  `CONFLICT_BASE` (line 1720). In `plugins/openspec/hooks/delivery-train-after.test.mjs`, add
  `'train-empty'` to T-3's key list (line 178) and T-4's entry to the docs test's subsection list
  (lines 199-201). These are the only tests that assert the old texts and shapes (the grep of D-6,
  "Pinned rules": the `train-nothing` reply of the empty end at `delivery-train.test.mjs:1715` and
  the key list at `delivery-train-after.test.mjs:178`). Check, a red step and no gate:
  `node scripts/test-suite.mjs plugins/openspec/hooks/delivery-train.test.mjs plugins/openspec/hooks/delivery-train-after.test.mjs`
  fails exactly in T-1 (no `failure`, no `record`, the old reply), T-2 (no `record`), T-3 (no
  `train-empty` key) and T-4 (no sentence), and every other test of the two files passes.
- [x] 1.2 The reply (D-5). In `plugins/openspec/hooks/change-loop.mjs`, add `train-empty` after
  `train-nothing` in `MESSAGES.en` (line 271) and in `MESSAGES['pt-BR']` (line 575), with D-5's two
  texts. Check: T-3 passes when the two files run as in 1.1, and
  `node scripts/test-suite.mjs plugins/openspec/hooks/change-loop.test.mjs` passes, with
  `change-loop replies: no internal term in either language` unchanged (line 114).
- [x] 1.3 The departure (D-1 to D-4). In `plugins/openspec/hooks/train-loop.mjs`, add
  `outLeftFailed` beside `outLeft` (line 338) and `emptyRecordFile` beside `lockFile` (line 153),
  rewrite the empty end (lines 366-369) in D-4's order with D-3's record, and add D-4's clause to
  the header comment (lines 10-11). The `passed`, `nothing` and `base-red` ends are not edited.
  Check: T-1 and T-2 of 1.1 pass when the two files run as in 1.1, and every other test of
  `delivery-train.test.mjs` still passes.
- [x] 1.4 The documents (D-7). In `docs/openspec-flow.md`, add D-7's sentence after the first
  sentence of the **A red train.** paragraph (line 749). Check: T-4 passes when the two files run as
  in 1.1, and `python3 scripts/check.py` passes (English, links).
- [x] 1.5 The spec delta. Check: `openspec validate train-empty-failure-text --strict` passes, and
  `git diff --quiet origin/main -- openspec/specs/` exits 0 (the canonical spec is synced by the
  archive, never edited here) (AC-6).
- [x] 1.6 Gate: `node scripts/test-suite.mjs --own-files && python3 scripts/check.py` green (AC-1,
  AC-2, AC-3, AC-4, AC-5, AC-6).

## Workflow follow-up

- After the reviews, the delivery numbers the release from `release.md` at the merge.
- Archive the change after the train that carries it merges; the archive syncs
  `specs/delivery-train/spec.md` into `openspec/specs/delivery-train/spec.md`.
