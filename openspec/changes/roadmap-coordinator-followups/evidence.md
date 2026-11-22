<!-- devkit-stage evidence result=passed attempt=4 commit=da18ca0227b91899a3db38073ce26aa8f25be68b -->
Commit: da18ca0227b91899a3db38073ce26aa8f25be68b

# Evidence: roadmap-coordinator-followups

Verified on branch `roadmap-coordinator-followups` at HEAD da18ca0. Since the last evidence (ab2c044) the branch took two merges of origin/main: 03f7566 (merge-setup-field-fixes, devkit-openspec 0.18.1; release conflicts resolved keeping this branch's 0.19.0 / 0.23.0 and the v0.19.0 CI pin, CHANGELOG keeps both entries, `change-loop.test.mjs` keeps both sides' tests) and da18ca0 (the archive of merge-setup-field-fixes, PR #48). `git diff --name-only 03f7566 da18ca0` lists only files under `openspec/`, so the code at da18ca0 equals the code at 03f7566. The whole suite ran on that merged tree (conducting session, 1181/1181, cited, not re-run here). Run here at da18ca0: `python3 scripts/check.py`, `python3 scripts/gen-catalog.py --check`, the filtered suite (345/345, exit 0), the 5.4 `test -s` and `grep -q` parts and the validation-record `grep -q`. The owner's acceptance of the live parts of AC-12 and AC-15 (2026-11-22, "Aceito, vai p/ retro") stands. No PR comment.

## Verification

### Gates

| Gate | Command | Result |
|---|---|---|
| 1.6 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^followups" --test-name-pattern="^roadmap-loop" --test-name-pattern="^change-loop" plugins/openspec/hooks/guard.test.mjs` | pass: 310/310 filtered at a82519d (cited from the conducting session) |
| 1.6 | `python3 scripts/check.py` | pass: all checks passed (run here at da18ca0, exit 0) |
| 2.5 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^followups" --test-name-pattern="^roadmap-loop" --test-name-pattern="^change-loop" plugins/openspec/hooks/guard.test.mjs` | pass: 317/317 filtered at a82519d (cited) |
| 2.5 | `python3 scripts/check.py` | pass: all checks passed (run here at da18ca0, exit 0) |
| 3.7 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^followups" --test-name-pattern="^roadmap-loop" --test-name-pattern="^change-loop" plugins/openspec/hooks/guard.test.mjs` | pass: 342/342 filtered at a82519d (cited) |
| 3.7 | `python3 scripts/check.py` | pass: all checks passed (run here at da18ca0, exit 0) |
| 4.6 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs` | pass: whole suite 1181/1181 at 03f7566 on the merged tree, same code as da18ca0 (cited from the conducting session; earlier 1162/1162 at a82519d) |
| 4.6 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^followups" --test-name-pattern="^roadmap-loop" --test-name-pattern="^change-loop" plugins/openspec/hooks/guard.test.mjs` | pass: 345/345 filtered at da18ca0 (run here, exit 0) |
| 4.6 | `python3 scripts/check.py` | pass: all checks passed (run here at da18ca0, exit 0) |
| 4.6 | `python3 scripts/gen-catalog.py --check` | pass: catalog up to date (run here at da18ca0, exit 0) |
| 4.6 | `grep -q "Validation passed" "${TMPDIR%/}/devkit-validate-roadmap-coordinator-followups/phase-4.txt"` | pass: record found (run here at da18ca0, exit 0); it holds "Validation passed" from the desktop app's bundled Claude Code 2.1.326 |
| 5.4 | `test -s openspec/changes/roadmap-coordinator-followups/proof/live/records.txt` | pass: file non-empty (run here at da18ca0, exit 0) |
| 5.4 | `test -s openspec/changes/roadmap-coordinator-followups/proof/many-archived.txt` | pass: file non-empty (run here at da18ca0, exit 0) |
| 5.4 | `grep -q "150 archived" openspec/changes/roadmap-coordinator-followups/proof/many-archived.txt` | pass: line "Roadmap: 0 open of 1 · 2 in the queue · 150 archived" found (run here at da18ca0, exit 0) |
| 5.4 | `python3 scripts/check.py` | pass: all checks passed (run here at da18ca0, exit 0) |

### Acceptance criteria

Proof for AC-1 to AC-11 is the named `followups AC-n ...` / `followups F-n ...` tests inside the passing suite (1181/1181 whole at 03f7566 (same code as da18ca0), 345/345 filtered at da18ca0, and the filtered phase runs); the red-before-fix records are `proof/red-1.txt`, `proof/red-2.txt`, `proof/red-3.txt` in the change folder. Live proof is `proof/live/records.txt` and `proof/many-archived.txt`.

| AC | Criterion | Proof and where it is | Result |
|---|---|---|---|
| AC-1 | ready-line-waits-only-when-full | Tests `followups AC-1 ...` in `plugins/openspec/hooks/roadmap-loop.test.mjs`, in gates 2.5 and 4.6 | pass |
| AC-2 | others-go-on-only-when-running | Tests `followups AC-2 ...`, in gates 2.5 and 4.6 | pass |
| AC-3 | adr-names-run-file-fields | Test `followups AC-3 run file: every field the run file holds is named in ADR 0013 decision 4 ...` (roadmap-loop.test.mjs line 2624), in gate 4.6 | pass |
| AC-4 | ids-checked-before-keys | Tests `followups AC-4 ...`, in gates 1.6 and 4.6 | pass |
| AC-5 | failed-write-cleans-temp | Tests `followups AC-5 ...`, in gates 1.6 and 4.6 | pass |
| AC-6 | lock-wait-under-hook-timeout | Tests `followups AC-6 ...`, in gates 1.6 and 4.6 | pass |
| AC-7 | killed-hold-does-not-hold | Tests `followups AC-7 ...`, in gates 1.6 and 4.6; the live run's stale `holding: true` after the killed hold of 21:18:56Z is the defect (`proof/live/records.txt`, Part 5) | pass |
| AC-8 | start-anyway-once | Test `followups F-2 decide: start anyway starts the held changes once` and the `AC-8` tests, in gates 2.5 and 4.6 | pass |
| AC-9 | roadmap-n-starts-first-call | Test `followups F-1 run: the arguments as typed start the run on the first call` and the `AC-9` tests, in gates 2.5 and 4.6 | pass |
| AC-10 | missing-tests-added | `followups AC-10 ...` tests (run without `--session`, lock timeout through each caller, draft language fallback, `mainInRun` read once), in gates 1.6 and 4.6 | pass |
| AC-11 | first-run-defects-fixed | F-1, F-2 (`roadmap-loop.test.mjs` 2133, 2164, 2259, 2270), F-3 (2291) and F-4 (`change-loop.test.mjs` 2724, 2738) tests, each with a red record in `proof/red-1.txt` to `proof/red-3.txt` (phase 3: 25 of 25 new tests red on the base); live defects seen at 21:18:45Z (`roadmap 2` refused) and 21:18:50Z (held by load, 239% vs 80%) in `proof/live/records.txt` | pass |
| AC-12 | first-run-observed | `proof/live/records.txt` Index: selection of the two ready changes (21:25:39Z `next`, both opened 21:25:48Z and 21:25:55Z); a change going on while the owner answers the other's grill (21:35:34Z); a change reaching delivery (merge-setup-field-fixes renamed to delivery at 23:20:25Z); many archived: `proof/many-archived.txt` (150 archived on a scratch project and this repository's clone, every call under 0.4 s, no archived change listed as open). Several ends in a row after the move are listed by the index as "after verification: in the retro" | pass: several ends of the run handled one after another was not seen live (it was not reached before verification; the index leaves it for the retro); the other four parts pass; the owner accepted the live part as a retro follow-up on 2026-11-22 ("Aceito, vai p/ retro") |
| AC-13 | one-session-per-change | Tests (gate 3.7); live: `start_session` at 21:57:12Z and 21:58:00Z, one session per change with its worktree as cwd, and `list_sessions {"linked": true}` at 22:14:41Z lists both with `startedBy` the coordinating session (`proof/live/records.txt`, Part 2); the plan approval of each happened in its own session (22:13:31Z to 22:14:16Z and 22:48:30Z) | pass |
| AC-14 | session-icon-by-stage | Tests (gate 3.7); live: title changes 📝 to 🛠️ (22:14:28Z and 22:48:57Z), 🛠️ to 🚀 (23:20:25Z), 🚀 to 🔍 (23:38:22Z), 🔍 to 🛠️ (23:42:13Z), in `proof/live/records.txt` Index. The icon of this change's later stages is left to the retro | pass |
| AC-15 | start-needs-no-retyping | Tests `followups ... guard` / board lines in gate 3.7 (F-4 guard tests: a session started by another session makes a change run); after the review fix, test `followups AC-15 next: a start that gave no session id is reported as session-refused, the line shows once and the change starts on the owner's next typed turn` (`plugins/openspec/hooks/roadmap-loop.test.mjs` line 2486, run as a subprocess end to end), in the 345/345 filtered run at da18ca0. Live: no change became ready on a turn nobody typed during the run (stopped 21:56:56Z), so the index leaves it for the retro | pass: a change becoming ready on a turn nobody typed, with the host's real refusal, was not seen live (no change became ready on an untyped turn during the live run); proven by tests only; the live part is a retro follow-up, written in design.md D-16; the owner accepted the live part as a retro follow-up on 2026-11-22 ("Aceito, vai p/ retro") |
