<!-- devkit-stage evidence result=passed attempt=3 commit=01070795fe04e0936ad6c064b22a2065f63ad42f -->
Commit: 01070795fe04e0936ad6c064b22a2065f63ad42f

# Evidence: coordinator-loop-fixes

Verified on 2026-11-25 by `pr-verifier` at head `0107079` (attempt 3). Since attempt 2 (`f416d6a`): review round 2
recorded FAIL (`0b71037`); the owner authorized a third review round (recorded in `declared.json`); readiness passed
at attempt 14 and the owner approved the revised plan (`ab2e0e8`); `origin/main` `494daa5` (the change
`project-setup`) was merged at `f72e442`, with the release renumbered; `0107079` changes only the plan's paths
(`design.md`, `proposal.md`, `tasks.md`) to the moved kit (`plugins/compozy/kit/`) and setup scripts
(`plugins/openspec/skills/devkit/scripts/`). The working tree was clean before this verification; the only file it
changed is this one (no file under `proof/` was added or changed). No fetch was done: `origin/main` is the local ref
`494daa5`, an ancestor of `HEAD` (`git merge-base --is-ancestor origin/main HEAD` exit 0). The pack versions at this
head are openspec 0.49.0, core 0.17.0, compozy 0.6.0 and marketplace 0.54.0, each above `origin/main`'s (0.48.0,
0.16.3, 0.5.0, 0.53.0); the CI snippet of `docs/openspec-flow.md` pins `v0.49.0` (4 times) and
`.compozy/kit-manifest.json` records the pack `0.6.0` (1 line). `devkit.delivery.train` on `origin/main` is
`node scripts/test-suite.mjs && python3 scripts/check.py` and this change does not edit that key, so the
`node scripts/test-suite.mjs` parts are `train:` rows; `python3 scripts/check.py` was also run live at this head, after
this file was written. Every test run below used `node scripts/test-suite.mjs` with
`TMPDIR=/var/tmp/devkit-coordinator-loop-fixes`, `GITHUB_HEAD_REF=probe-branch` and `GITHUB_BASE_REF=main`, one at a
time, each started only after `pgrep -f 'scripts/test-suite.mjs$'` showed no other run; the gate parts ran as
`tasks.md` writes them (`--concurrency=2`), the other runs with `--concurrency=3`. The whole suite was not run by this
verification, by the caller's instruction: the train runs it at its head. The times below are not suite timings.

## Verification

### Gates

| Gate | Command | Result |
|---|---|---|
| 1.6 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 plugins/openspec/hooks/guard.test.mjs` | pass: exit 0; `suite: 1 files, 160 tests, 160 pass, 0 fail, 32.0s, concurrency 2`; the file `pass` (T20 to T23 and T99 with its node-option cases among them) |
| 1.6 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="^coordinator-loop-fixes" --test-name-pattern="^roadmap-loop repl" --test-name-pattern="^followups AC-4 reply" --test-name-pattern="^jira-entry-followups AC-8" --test-name-pattern="^upfront AC-8 skill" --test-name-pattern="^change-loop skill" --test-name-pattern="^change-loop lock" --test-name-pattern="^change-loop repl" --test-name-pattern="^change-state" plugins/openspec/hooks/change-loop-declared.test.mjs plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/change-loop-compozy.test.mjs plugins/openspec/hooks/change-loop-remote-state.test.mjs plugins/openspec/hooks/roadmap-loop.test.mjs plugins/openspec/hooks/roadmap-loop-followups.test.mjs plugins/openspec/hooks/roadmap-loop-upfront.test.mjs plugins/openspec/hooks/deliver-check.test.mjs` | pass: exit 0; `suite: 8 files, 325 tests, 325 pass, 0 fail, 224.7s, concurrency 2`; all 8 files `pass`, none `FAIL` or `LEFT` |
| 1.6 | `python3 scripts/check.py` | pass: exit 0, `all checks passed`, run live at this head after this file was written (also a train part) |
| 2.5 | `node scripts/test-suite.mjs` | train: proven by the train record (not run by this verification) |
| 2.5 | `python3 scripts/check.py` | pass: exit 0 live at this head (also a train part) |
| 3.9 | `node scripts/test-suite.mjs` | train: proven by the train record (not run by this verification) |
| 3.9 | `python3 scripts/check.py` | pass: exit 0 live at this head (also a train part) |
| 3.9 | `node plugins/compozy/kit/scripts/gen-agents.mjs --check` | pass: exit 0, `21 CompozyOS agents are up to date` |
| 4.7 | `node scripts/test-suite.mjs` | train: proven by the train record (not run by this verification) |
| 4.7 | `python3 scripts/check.py` | pass: exit 0 live at this head (also a train part) |
| 4.7 | `node plugins/compozy/kit/scripts/gen-agents.mjs --check` | pass: exit 0, `21 CompozyOS agents are up to date` |
| 4.7 | `test -s openspec/changes/coordinator-loop-fixes/proof/checks.txt` | pass: exit 0 |
| 5.9 | `node scripts/test-suite.mjs` | train: proven by the train record (not run by this verification) |
| 5.9 | `python3 scripts/check.py` | pass: exit 0 live at this head (also a train part) |
| 6.6 | `node scripts/test-suite.mjs` | train: proven by the train record (not run by this verification) |
| 6.6 | `python3 scripts/check.py` | pass: exit 0 live at this head (also a train part) |
| 6.6 | `python3 scripts/gen-catalog.py --check` | pass: exit 0, no output |
| 6.6 | `node plugins/compozy/kit/scripts/gen-agents.mjs --check` | pass: exit 0, `21 CompozyOS agents are up to date` |
| 6.6 | `command claude plugin validate .` | pass: exit 0, `Validation passed`, no error line |
| 6.6 | `test -s openspec/changes/coordinator-loop-fixes/proof/checks.txt` | pass: exit 0 |
| 6.6 | `grep -q "^- \[ \] host-monitor-wake (after: coordinator-loop-fixes) — " openspec/roadmap.md` | pass: exit 0 |

Also run at this head: `openspec validate coordinator-loop-fixes --strict` exit 0 (`Change 'coordinator-loop-fixes' is valid`).

### Test runs of this verification (by name, beyond the gate parts)

| Run | What it ran | Result |
|---|---|---|
| V1 | `--concurrency=3`, task 6.5's second Check command's patterns (`^coordinator-loop-fixes`, `^AC-8 release-ready`, `^the pin in docs/openspec-flow.md`, `^change-loop docs: the design records the answers`, `^stage-roles docs`, `^post-merge-validate 3`, `^jira-entry AC-10`, `^forced-merge-path 1: L`, `^stage-models AC-10`, `^change-budget AC-10`, `^format: review-change`, `^delivery-models AC-7`, `^jira-entry-followups docs`, `^own-files AC-9 docs`) plus `^conduct`, `^change-loop decide` and `^sanitize`, over its 14 files as `tasks.md` names them (`plugins/openspec/skills/devkit/scripts/github-setup.test.mjs` at its new path) | pass: exit 0; `suite: 14 files, 333 tests, 333 pass, 0 fail, 163.0s, concurrency 3`; all 14 files `pass`, no failing test line. 147 distinct `coordinator-loop-fixes AC-<n> T<k>` tests passed, the same 147 the test files define at this head (T1 to T148 without T24; `diff` of the two sorted lists is empty); per criterion: AC-1 27, AC-2 4, AC-4 3, AC-5 1, AC-6 3, AC-7 31, AC-8 17, AC-9 9, AC-10 7, AC-11 1, AC-12 5, AC-13 8, AC-14 8, AC-15 1, AC-16 1, AC-17 7, AC-18 7, AC-19 6, AC-20 1. Also 88 `conduct` tests, 37 `change-loop decide` tests (among them `the loop's step agents match conduct-check's actorOf`), 1 `sanitize`, 3 `post-merge-validate 3`, 5 `stage-roles docs`, 9 `forced-merge-path 1: L`, 31 `stage-models AC-10`, 3 `delivery-models AC-7`, 1 `format: review-change`, 1 `change-budget AC-10`, 1 `jira-entry AC-10`, 1 `AC-8 release-ready`, 1 `the pin in docs/openspec-flow.md`, 1 `change-loop docs: the design records the answers`, 2 `jira-entry-followups docs`, 1 `own-files AC-9 docs` |
| V2 | `--concurrency=3`, `^commit-attribution`, `^project-settings: PACKS equals`, `^delivery-train P3 isOwnPr`, `^delivery-train P3 delivered`, `^stage-roles loop`, `^stage-roles roles verifier`, `^change-loop lock agent`, `^change-loop compozy view`, `^change-loop next: a pull request conflicting`, `^jira-entry-followups AC-10 ` over `project-loop`, `deliver-check-archive`, `change-loop-remote-state`, `delivery-train-after`, `change-loop-compozy`, `roadmap-loop-followups`, `change-loop`, `change-loop-remote` (under `plugins/openspec/hooks/`) and `plugins/openspec/skills/devkit/scripts/project-settings.test.mjs` (its new path) | pass: exit 0; `suite: 9 files, 115 tests, 115 pass, 0 fail, 29.4s, concurrency 3`; all 9 files `pass`. Counted: 36 `commit-attribution` (`AC-1 T25` and `AC-2 T31` among them), 1 `project-settings: PACKS equals`, 1 `delivery-train P3 isOwnPr`, 6 `delivery-train P3 delivered`, 33 `stage-roles loop`, 1 `stage-roles roles verifier`, 9 `change-loop lock agent`, 25 `change-loop compozy view`, 2 `change-loop next: a pull request conflicting`, 1 `jira-entry-followups AC-10` |
| V3 | `--concurrency=3`, task 6.5's first Check command's files: `plugins/compozy/kit/scripts/gen-agents.test.mjs` and `plugins/compozy/kit/scripts/adoption.test.mjs` (the kit's new path) | pass: exit 0; `suite: 2 files, 55 tests, 55 pass, 0 fail, 2.7s, concurrency 3` |
| V4 | Each stored check script of the real runs (`runs/<run>/check.sh` in the scratch folder, reading the files under `proof/` and the runs' recorded exit codes; r1's script also feeds the R1 transcript to this head's `guard.mjs stop` for R4; none runs a loop command or a `declare`), each output to its own file and read with `grep -c` | pass: all 17 scripts exit 0, each with its `checks: pass` lines and no `checks: fail` line: r1 (6 pass lines: r1-start, r1, r2, r3, r4 and its own), r5, r6, r7, r7b, r7s, r8, r9, r11, r11b, r12, r13 (3 pass lines: r13a, r13b, its own), r14, r15, r16, r17 and ver-r7s |

### Real runs of `proof/` (D-14)

**Which runs the merge made stale.** None, judged from the merge's diff of the code the runs drive
(`git diff f416d6a HEAD` over `plugins/openspec/hooks/*.mjs` without tests and the two skills). The merge of
`project-setup` changes: in `change-loop.mjs`, the messages that named `/openspec-setup` or `/compozy-setup` (now
`/devkit setup`), a new `setup-no-repo` message, a `setup` branch of `startMode` taken only for the verb `setup`, and
three exports (`LANGUAGE_TAG`, `DRIVER_ROUND`, `BUILT_DRIVERS`); in `guard.mjs`, `parseDevkitBlock` splitting on
`\r?\n` and the text of one `FlowUsageError`; in `flow-check.mjs`, `readTestSettings` splitting on `\r?\n` and one
text; in `merge-setup.mjs`, `project-loop.mjs`, `train-loop.mjs` and `compozy-driver.mjs`, the setup pointer's text and
its helper `withoutSetupPointer`; in `plugins/openspec/skills/devkit/SKILL.md`, the setup section and the `setup` modes,
and in `plugins/openspec/skills/ship-change/SKILL.md`, two setup pointers. None of these is a path any run's check reads:
`declare` and `reply` (R1 to R3, R5 to R7s, ver-r7s), the stop lock and `DECLARE_CALL` (R1 to R4, R14), the red gate
(R5, R6), the review round and its record (R7, R7b, R7s, ver-r7s), the resolve step (R8), the conductor task (R9), the
language (R10), the plan digest (R11, R11b, R15), the verifier's writes (R12), the host monitor wait (R13a, R13b), the
`archive-` id's pull request (R16) and the advanced branch (R17); the runs' projects hold LF files only. `0107079`
changes plan files only. So no run was repeated; the runs' `init` events still name the pack versions of their time
(ver-r7s: `devkit-openspec` 0.48.0). R4's check (the R1 transcript fed to `guard.mjs stop`) ran again at this head
inside V4 and holds.

`proof/checks.txt` has 22 lines, each ending in `: pass`, none in `: fail` (counted at this head): one line each for
r10, r6, r7, r7b, r16, r11, r15, r1, r2, r3, r4, r11b, r5, r7s, r8, r9, r14, r13a, r13b, r17, r12 and ver-r7s.
`proof/` holds 99 files, none changed since `9eaef84` (the commit of attempt 2's files). R6, R7 and R7b are recorded
from their files, never run here (no `declare` was run by this verification): V4's r6, r7 and r7b scripts re-checked
`r6-declare-2.txt` (one `devkit-end: feat blocked` line), `r6-declared.json` (two `gate-red` entries of phase 1),
`r7-declare-nowords.txt` (`declare-no-words`), `r7-declared.json` (one `review-round` entry) and `r7b-declared.json`
(one entry of scope `resolution`). R10 is recorded from its files (installed `devkit-openspec@devkit 0.33.0`, no
`language` key). R12 (the verifier's own run, attempt 1) is recorded from `proof/ver-r12-*` (V4: its script passes).
ver-r7s (attempt 2's re-run of R7s on the fixed skill text, the session's `declare ... review-round --stdin words`
through the quoted heredoc `<<'DEVKIT_ARGS'`) is recorded from its five files (V4: its 24 checks hold). Scrub (D-14
rule 5), counted at this head: `grep -rlF` over `proof/` of the home folder, of this worktree's path and of the scratch
runs' folder each finds 0 files.

### Acceptance criteria

| AC | Criterion | Proof | Result |
|---|---|---|---|
| AC-1 | `declared-step-outside-gates`: a pause or a decision outside the gates is recorded by a declared `reply` key; ending the turn with its first output line is accepted by the stop lock, without it refused | V1: the 27 AC-1 tests (T1 to T19, T98 to T104, T114) pass, T99 with the node-option cases (`node --no-warnings <path>`, `node -- <path>`, two options before a quoted path, refused for a subagent and allowed for the main session); gate 1.6 part 2: the D-15 reply tests (`roadmap-loop repl`, `followups AC-4 reply`, `change-loop repl`, `jira-entry-followups AC-8`) pass among its 325; V1's `sanitize` test passes. Real runs `r1` (a pause: `reply waiting-pause`, stop decision `allow` `end-recorded`), `r2` (`reply waiting-owner-decision` with the decision's words, `allow` `end-recorded`), `r3` (no declared end: first stop decision `refuse` `stage-ready`), `r14` (a subagent's `declare` refused naming the main session, no `declared.json`), `r5`; not stale after the merge (see above); V4 re-checked each | pass |
| AC-2 | `end-marker-id-checked`: an end marker naming another change does not release the stop lock; one naming the run's change does | V1: T20 to T23 pass (gate 1.6 part 1 runs all of `guard.test.mjs`: 160 pass). Real run `r4`, re-checked at this head inside V4's r1 script: the R1 transcript fed to `guard.mjs stop` exits 0 unchanged and exits 2 with every end line's id changed to `other-change`, refusing with the stage named | pass |
| AC-3 | `skill-names-declared-end`: dropped, covered by main (merge 8f14bd1, `stage-models`) | No test or task of this change belongs to it (`tasks.md`: dropped) | pass: dropped by the plan |
| AC-4 | `agent-map-from-pack-table`: the fallback agent map and `PACKS` come from one source; a test fails when they differ | V1: T75 to T77 pass; V2: `project-settings: PACKS equals the plugin names in marketplace.json` (at the file's new path), the 33 `stage-roles loop` tests and the 9 `change-loop lock agent` tests pass | pass |
| AC-5 | `adr-0011-note`: a dated Note on the stop lock after a recorded end; the Decision section unchanged | `docs/adr/0011-the-change-coordinator-is-the-owners-session.md` holds `Note (coordinator-loop-fixes, 2026-11-24)` once; its diff against `origin/main` is 5 added lines, 0 removed; its `## Decision` section, extracted at this head and on `origin/main`, compares byte-identical (`cmp` exit 0). V1: T78 passes | pass |
| AC-6 | `language-never-set`: with the language never set, messages come out in the default language with no placeholder; a test and a real run of the installed plugin | V1: T79 to T81 pass. Real run `r10` (conducting session, task 4.1), recorded from its files; `checks.txt` line `r10 ...: pass`. `ver-r7s` turn 1 also shows a nested session whose `--lang` was the unfilled `${user_config.language}` replying in the project's default language | pass |
| AC-7 | `review-round-after-limit`: after round 2, the owner's own typed message hands a third round; without it the deadlock stays; `review-round.workflow.js` accepts the round | V1: the 31 AC-7 tests pass: T32 to T44 (T44 pins `--stdin words` through `<<'DEVKIT_ARGS'` and no `--param words` in both skills), T95 to T97, T105 to T113, T132, T141, T143 (`--stdin words` records words with a backtick, `$(...)`, an apostrophe and a double quote byte for byte, as `--param words` does), T144 (a spawned `bash` with the quoted heredoc: the words recorded, no `touch` file created), T145 (`--stdin` of another name, the words named twice and an empty input each exit 3 with nothing recorded), T147 (ADR 0032's Decision section and its dated Note of 2026-11-25; `docs/compozy-kit.md` points to it); `format: review-change` (1) and `delivery-models AC-7` (3) pass. Real runs `r7`, `r7b` recorded from their files, and `ver-r7s` (turn 1: `next` ends `blocked` `ceiling` on the stage `review`, no `declare`, the last message holds the blocked reply and a sentence saying one more review round happens only on the owner's own typed request; turn 2: one `declare ... review-round --stdin words` call of the nested main session through the quoted heredoc, the words recorded byte for byte, round 3, `fix-review`, no command of the words run); V4 re-checked each | pass |
| AC-8 | `plan-revised-after-start`: a plan file edited after the start stales readiness and approval and goes back to its gate; a tick or evidence does not; both drivers write the `- Plan:` digest | V1: the 17 AC-8 tests (T51 to T61, T93, T94, T115, T116, T133, T134) pass. Real runs `r11`, `r11b`, `r15`; V4 re-checked each. ADR 0032's 2026-11-25 Note records that an approval written without a `- Plan:` line never goes stale (T147); see the first observation below for this change's own approval | pass |
| AC-9 | `task-for-the-conductor`: a `Conductor:` task is never handed to the implementer and counts done only when ticked | V1: T62 to T69 and T146 pass (`actorOf('conductor-task')` is `{ actor: 'main' }`; `deliveryStep` on a `conductor-task` report gives actor `main`, deliver-check's reason and the state `ready to run: conductor-task`); V1's `change-loop decide: the loop's step agents match conduct-check's actorOf` and the 88 `conduct` tests pass. The kit's copy of the agent is current (gate parts `gen-agents.mjs --check`, V3). Real run `r9`; V4 re-checked | pass |
| AC-10 | `fix-after-red-gate`: a red gate hands one declared fix; a second red ends `blocked` (`why=tests-red`) | V1: T25 to T31 pass. Real runs `r5` (nested session: one `declare gate-red`, the `fix-gate` hand-off to `devkit-core:tdd-implementer`, gate green after) and `r6` (from its files: second `declare` exits 2, two `gate-red` entries); V4 re-checked each. ADR 0032's 2026-11-25 Note records that the CompozyOS driver asks the owner at a red gate (T147) | pass |
| AC-11 | `host-monitor-wait` (proven half): with a host monitor that forbids polling, no background `wait` and the session says so; without it the `wait` starts. Deferred half carried by `host-monitor-wake` | V1: T82 passes; gate 1.6 part 2: `change-loop skill: the wait is started in the background on a GitHub wait` and `upfront AC-8 skill` pass among its 325. Real runs `r13a` and `r13b`; V4 re-checked both. Deferred half: `openspec/roadmap.md` holds `- [ ] host-monitor-wake (after: coordinator-loop-fixes) — ` (gate 6.6 `grep -q` exit 0); not claimed here | pass (proven half); deferred half carried by the roadmap line `host-monitor-wake` |
| AC-12 | `verifier-writes-proof`: `pr-verifier` can write under `proof/`, `guard.mjs` allows it, `pr-verifier.md` says so, and a write outside `evidence.md` and `proof/` is still refused | V1: T70 to T74 pass; V2: `stage-roles roles verifier: ...` passes. `plugins/core/agents/pr-verifier.md` and its two kit copies (`plugins/compozy/kit/templates/agents/pr-verifier/AGENT.md` at the kit's new path and `.compozy/agents/pr-verifier/AGENT.md`) each hold "besides it you write only the output of the runs you record, under the change's `proof/` folder" once and "it is the only file you write" 0 times. Real run R12 of attempt 1 (`proof/ver-r12-*`, V4 re-checked): the write under `proof/` allowed, `proposal.md` and `src/a.txt` refused and unchanged | pass |
| AC-13 | `resolve-outside-release-files`: a conflict outside the release files gets `resolve-base-conflict`, not a blocked end; release files keep `resolve-release-conflict` | V1: T45 to T50, T117, T118 and the 88 `conduct` tests pass. V2: `change-loop next: a pull request conflicting ...` (2), the 25 `change-loop compozy view` tests and `jira-entry-followups AC-10 next carries no writeBack on a blocked end held at the pull request` pass. Real run `r8`; V4 re-checked. ADR 0032's 2026-11-25 Note records that an archive that left a delivery train keeps its blocked `stop-archive` (T147) | pass |
| AC-14 | `nits-closed` | V1: T85 to T92 pass. V2: `commit-attribution AC-1 T25 ...` and `commit-attribution AC-2 T31 ...` pass (36 `commit-attribution` tests in all over V2's files). `openspec validate coordinator-loop-fixes --strict` exit 0 | pass |
| AC-15 | `short-script-decisions-recorded`: `docs/openspec-flow.md` records the two `devkit-lite` decisions; `devkit-lite`'s stages and gates unchanged | V1: T83 passes. The merge brought no schema edit (`git diff --stat f416d6a HEAD -- plugins/openspec/schemas openspec/schemas` is empty); `devkit-lite`'s schema differs from `origin/main` only in two instruction texts (the `Conductor:` task sentence of the tasks instruction and "one more for each round the owner authorizes" in the review gate's text, D-12), with the same artifacts | pass |
| AC-16 | `no-behaviour-change-elsewhere`: no behaviour change outside AC-1 to AC-13 and AC-17 to AC-20; the existing suites stay green | Observed here: T84 passes (V1); every run of this verification is green (gate 1.6: 160 and 325 tests; V1 333; V2 115; V3 55; 0 fail, no `FAIL` or `LEFT` file), including the D-15 tests kept for the rules this change replaces; the merge's own code (the `setup` verb and texts of `project-setup`) is outside this change's criteria and was judged above for the real runs only | no proof: the whole suite was not run by this verification (by the caller's instruction; it is the train's part `node scripts/test-suite.mjs`, proven by the train record) |
| AC-17 | `archive-prefixed-id-own-pr`: an `archive-` id finds its own pull request; an archive head of another change never | V1: T119 to T124, T142 and the 9 `forced-merge-path 1: L` tests pass. V2: `delivery-train P3 isOwnPr` (1) and `delivery-train P3 delivered` (6) pass. Real run `r16`; V4 re-checked | pass |
| AC-18 | `delivered-advanced-branch-no-rereview`: a delivered change on a branch advanced into the base goes to the retro with no new evidence or review; ahead of the base, as today | V1: T125 to T131 pass. Real run `r17`; V4 re-checked | pass |
| AC-19 | `stage-models-override-validates`: the table in the `x-devkit:` block validates strictly and `modelsOf` reads it (`budget` too) | V1: T135 to T139 and T148 pass, with the 31 `stage-models AC-10` tests and `change-budget AC-10`. `docs/adr/0023-the-model-is-chosen-by-stage.md` holds `- Amended by ADR 0033 (0033-a-changes-own-settings-live-in-an-x-devkit-block.md)` on line 5, before `- Date:` on line 6; its diff against `origin/main` is 9 added lines, 0 removed. ADRs 0032 and 0033 keep their numbers after the merge (`origin/main`'s last ADR is 0031) | pass |
| AC-20 | `no-test-pins-live-roadmap-state`: the `Live roadmap:` rule in `openspec/config.yaml`; the named tests pass on the live roadmap and on a copy with the line ticked | V1: T140 passes, with `jira-entry AC-10` (1), the 5 `stage-roles docs` tests and the 3 `post-merge-validate 3` tests | pass |

### Observations (not defects of this change)

- This change's own `approval.md` (`ab2e0e8`, attempt 6) holds no `- Plan:` line, so `planRevision` reads it as an
  approval written before D-7 and never stale: the plan edit of `0107079` (paths only, made after that approval) is
  not seen by AC-8's rule on this change itself. The conducting session reports the loop's `merge-check` green. The
  owner may weigh whether the approval should be recorded again with its `- Plan:` digest by the driver this change
  ships.
- In `ver-r7s` turn 2 (attempt 2) the Agent tool was disallowed so the run would stop after the `declare`. The nested
  session instead loaded the `workflow-authoring` and `ship-change` skills and handed `fix-review` to one agent through
  a Workflow script it wrote; that agent changed nothing and the next `next` ended the run blocked. This is beyond the
  R7s case and does not touch its checks. The owner may weigh whether a session should route a `tdd-implementer`
  hand-off through a self-written Workflow when the Agent tool is missing.
- The stream JSON files under `proof/` keep two kinds of host detail that D-14 rule 5 does not scrub: TMPDIR-derived
  paths under `/var/tmp/devkit-coordinator-loop-fixes/` and the synced plugin folder ids in the `init` event's plugin
  list. Neither is the home folder, the worktree or a scratch run folder; the owner may weigh them for a public
  repository.

No defect was found.
