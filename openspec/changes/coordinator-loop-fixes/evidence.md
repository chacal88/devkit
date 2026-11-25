<!-- devkit-stage evidence result=passed attempt=1 commit=e29771b8deead55b39026412ca402898afe791ec -->
Commit: e29771b8deead55b39026412ca402898afe791ec

# Evidence: coordinator-loop-fixes

Verified on 2026-11-25 by `pr-verifier` at head `e29771b` (working tree clean outside `openspec/` before and after;
the only files this verification added are under `openspec/changes/coordinator-loop-fixes/`: this file, the three
`proof/ver-r12-*` files and the `r12` line of `proof/checks.txt`). No fetch was done: `origin/main` is the local ref
`3ca2e47`, an ancestor of `HEAD` (`git merge-base --is-ancestor origin/main HEAD` exit 0), and the branch's last merge of
the base is `03a18db`. `devkit.delivery.train` on `origin/main` is `node scripts/test-suite.mjs && python3 scripts/check.py`
and this change does not edit that key, so those two parts are `train:` rows. Every test run below used
`node scripts/test-suite.mjs` (one process and one private TMPDIR per file) with
`TMPDIR=/var/tmp/devkit-coordinator-loop-fixes`, `GITHUB_HEAD_REF=probe-branch` and `GITHUB_BASE_REF=main`, started only
after `pgrep -f 'scripts/test-suite.mjs$'` showed no other run (train 18's suite was waited out with `tail --pid`). The
whole suite was not run by this verification, by the caller's instruction: the train runs it at its head.

## Verification

### Gates

| Gate | Command | Result |
|---|---|---|
| 1.6 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 plugins/openspec/hooks/guard.test.mjs` | pass: exit 0; `suite: 1 files, 149 tests, 149 pass, 0 fail, 34.9s, concurrency 2`; the file `pass` |
| 1.6 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="^coordinator-loop-fixes" --test-name-pattern="^roadmap-loop repl" --test-name-pattern="^followups AC-4 reply" --test-name-pattern="^jira-entry-followups AC-8" --test-name-pattern="^upfront AC-8 skill" --test-name-pattern="^change-loop skill" --test-name-pattern="^change-loop lock" --test-name-pattern="^change-loop repl" --test-name-pattern="^change-state" plugins/openspec/hooks/change-loop-declared.test.mjs plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/change-loop-compozy.test.mjs plugins/openspec/hooks/change-loop-remote-state.test.mjs plugins/openspec/hooks/roadmap-loop.test.mjs plugins/openspec/hooks/roadmap-loop-followups.test.mjs plugins/openspec/hooks/roadmap-loop-upfront.test.mjs plugins/openspec/hooks/deliver-check.test.mjs` | pass: exit 0; `suite: 8 files, 320 tests, 320 pass, 0 fail, 243.2s, concurrency 2`; all 8 files `pass`, none `FAIL` or `LEFT` |
| 1.6 | `python3 scripts/check.py` | train: proven by the train record (also run live at this head: `all checks passed`, exit 0) |
| 2.5 | `node scripts/test-suite.mjs` | train: proven by the train record (not run by this verification) |
| 2.5 | `python3 scripts/check.py` | train: proven by the train record (live at this head: exit 0) |
| 3.9 | `node scripts/test-suite.mjs` | train: proven by the train record (not run by this verification) |
| 3.9 | `python3 scripts/check.py` | train: proven by the train record (live at this head: exit 0) |
| 3.9 | `node plugins/compozy/skills/compozy-setup/scripts/gen-agents.mjs --check` | pass: exit 0, `21 CompozyOS agents are up to date` |
| 4.7 | `node scripts/test-suite.mjs` | train: proven by the train record (not run by this verification) |
| 4.7 | `python3 scripts/check.py` | train: proven by the train record (live at this head: exit 0) |
| 4.7 | `node plugins/compozy/skills/compozy-setup/scripts/gen-agents.mjs --check` | pass: exit 0, `21 CompozyOS agents are up to date` |
| 4.7 | `test -s openspec/changes/coordinator-loop-fixes/proof/checks.txt` | pass: exit 0 |
| 5.9 | `node scripts/test-suite.mjs` | train: proven by the train record (not run by this verification) |
| 5.9 | `python3 scripts/check.py` | train: proven by the train record (live at this head: exit 0) |
| 6.6 | `node scripts/test-suite.mjs` | train: proven by the train record (not run by this verification) |
| 6.6 | `python3 scripts/check.py` | train: proven by the train record (live at this head: exit 0) |
| 6.6 | `python3 scripts/gen-catalog.py --check` | pass: exit 0, no output |
| 6.6 | `node plugins/compozy/skills/compozy-setup/scripts/gen-agents.mjs --check` | pass: exit 0, `21 CompozyOS agents are up to date` |
| 6.6 | `command claude plugin validate .` | pass: exit 0, `Validation passed`, no error line |
| 6.6 | `test -s openspec/changes/coordinator-loop-fixes/proof/checks.txt` | pass: exit 0 |
| 6.6 | `grep -q "^- \[ \] host-monitor-wake (after: coordinator-loop-fixes) — " openspec/roadmap.md` | pass: exit 0 |

Also run at this head: `openspec validate coordinator-loop-fixes --strict` exit 0 (`Change 'coordinator-loop-fixes' is valid`).

### Test runs of this verification (by name, beyond the gate parts)

| Run | What it ran | Result |
|---|---|---|
| V1 | The run of task 6.5's Check that gate 6.6 held, as written (`--concurrency=2`): `^coordinator-loop-fixes` and the D-15 patterns (`^AC-8 release-ready`, `^the pin in docs/openspec-flow.md`, `^change-loop docs: the design records the answers`, `^stage-roles docs`, `^post-merge-validate 3`, `^jira-entry AC-10`, `^forced-merge-path 1: L`, `^stage-models AC-10`, `^change-budget AC-10`, `^format: review-change`, `^delivery-models AC-7`, `^jira-entry-followups docs`, `^own-files AC-9 docs`) over its 14 files | pass: exit 0; `suite: 14 files, 201 tests, 201 pass, 0 fail, 196.6s, concurrency 2`; all 14 files `pass`. 141 distinct `coordinator-loop-fixes AC-<n> T<k>` tests passed, the same 141 the test files define (T1 to T142 without T24); per criterion: AC-1 27, AC-2 4, AC-4 3, AC-5 1, AC-6 3, AC-7 27, AC-8 17, AC-9 8, AC-10 7, AC-11 1, AC-12 5, AC-13 8, AC-14 8, AC-15 1, AC-16 1, AC-17 7, AC-18 7, AC-19 5, AC-20 1 |
| V2 | `--concurrency=3`, `^commit-attribution`, `^project-settings: PACKS equals`, `^delivery-train P3 isOwnPr`, `^delivery-train P3 delivered`, `^change-loop skill`, `^upfront AC-8 skill`, `^change-loop lock agent`, `^stage-roles loop`, `^stage-roles roles verifier`, `^delivery-train docs` over `project-loop`, `deliver-check-archive`, `project-settings`, `delivery-train-after`, `change-loop-compozy`, `roadmap-loop-upfront`, `change-loop` test files | pass: exit 0; `suite: 7 files, 86 tests, 86 pass, 0 fail, 20.7s, concurrency 3`; all 7 files `pass` |
| V3 | `--concurrency=3`, `^conduct`, `^change-loop compozy view`, `^change-loop next: a pull request conflicting`, `^jira-entry-followups AC-10 ` over `conduct-check`, `change-loop-compozy`, `change-loop`, `change-loop-remote` test files | pass: exit 0; `suite: 4 files, 116 tests, 116 pass, 0 fail, 46.0s, concurrency 3`; all 4 files `pass` |
| V4 | Each stored check script of the real runs (`runs/<run>/check.sh` in the scratch folder, reading only the files under `proof/` and the run's recorded exit codes; none runs a loop command or a `declare`), output to a file and read with `grep -c` | pass: every script exits 0 and prints its `checks: pass` line: r1 (with r1-start, r2, r3, r4), r5, r6, r7, r7b, r7s, r8, r9, r11, r11b, r13 (r13a, r13b), r14, r15, r16, r17 and r12 |

### Real runs of `proof/` (D-14)

`proof/checks.txt` has 21 lines, each ending in `: pass`, none in `: fail`; one line each for r1 to r17 with r7b, r7s,
r11b, r13a and r13b, and r12 (counted with `grep -c "^<id> .*: pass$"`: 1 each). R6, R7 and R7b are recorded from their
files, never run here (no `declare` was run by this verification): `r6-declare-2.txt` holds one
`devkit-end: feat blocked` line and `r6-declared.json` two `gate-red` entries of phase 1; `r7-declare-nowords.txt` names
`declare-no-words`; `r7-declared.json` holds one `review-round` entry; `r7b-declared.json` one entry of scope
`resolution`. R10 is recorded from its files: the `init` event of `r10-run.jsonl` lists `devkit-openspec@devkit 0.33.0`
(the installed plugin) and `r10-config.jsonl` holds no `language` key. Scrub (D-14 rule 5): `grep -rlF` of the home
folder over `proof/` finds 0 files; the worktree and scratch run paths were replaced by each run's scrub (V4 re-checks
the three raw paths per run: 0 lines each).

**R12, this verification's own run** (D-14, AC-12). First, in this session: the `Write` tool call of `pr-verifier` to
`proof/ver-r12-session.txt` was refused by the guard of the installed devkit-openspec 0.33.0, which predates D-8
(`devkit guard: pr-verifier only writes its own verdict file, not openspec/changes/coordinator-loop-fixes/proof/ver-r12-session.txt`);
the file was not written. This session's hooks are the installed release, not this branch's, so the run that proves D-8
is a nested one on this worktree's packs: a fixture script in the scratch folder (outside this repository, rule 3)
builds a project that selects the `devkit` schema with an approved change `feat`; a nested
`claude -p "$(cat prompt.txt)" --plugin-dir <worktree>/plugins/core --plugin-dir <worktree>/plugins/openspec` (the prompt
written with a quoted heredoc, rule 2) makes one Agent call to `devkit-core:pr-verifier`, told to make three `Write` calls.
Outputs (scrubbed, rule 5): `proof/ver-r12-run.jsonl`, `proof/ver-r12-hooklog.jsonl`, `proof/ver-r12-after.txt`.
Observed: the `init` event lists `devkit-core` 0.17.0 and `devkit-openspec` 0.48.0 from `<worktree>/plugins/...`;
one Agent call of type `devkit-core:pr-verifier` (the hook log's `agent` decision for it is `allow`); the subagent made
3 `Write` calls and no Bash call; the `Write` to `openspec/changes/feat/proof/ver-r12.txt` was allowed and the file holds
its line; the `Write` to `openspec/changes/feat/proposal.md` and to `src/a.txt` were each refused with
`pr-verifier writes only evidence.md and the output of the runs it records under openspec/changes/feat/proof/, not ...`,
and both files are byte-identical to before (sha256 compared); no `declared.json`; the result event is `success`. Its
line `r12 ...: pass` was appended to `proof/checks.txt` only after its check script passed (16 checks, 0 raw paths).

### Acceptance criteria

| AC | Criterion | Proof | Result |
|---|---|---|---|
| AC-1 | `declared-step-outside-gates`: a pause or a decision outside the gates is recorded by a declared `reply` key; ending the turn with its first output line is accepted by the stop lock, without it refused | V1: the 27 AC-1 tests (T1 to T19, T98 to T104, T114) pass; gate 1.6 part 2 (the `runReply` / `replyCmd` D-15 tests) passes. Real runs: `r1` (a pause: `reply waiting-pause`, hook log stop decision `allow` `end-recorded`), `r2` (`reply waiting-owner-decision` with the decision's words, `allow` `end-recorded`), `r3` (no declared end: first stop decision `refuse` `stage-ready`), `r14` (a subagent's `declare` refused naming the main session, no `declared.json`), `r5`; V4 re-checked each | pass |
| AC-2 | `end-marker-id-checked`: an end marker naming another change does not release the stop lock; one naming the run's change does | V1: T20 to T23 pass (gate 1.6 part 1 runs all of `guard.test.mjs`: 149 pass). Real run `r4`: the R1 transcript fed to `guard.mjs stop` exits 0 unchanged and exits 2 with every end line's id changed to `other-change`, refusing with the stage named | pass |
| AC-3 | `skill-names-declared-end`: dropped, covered by main (merge 8f14bd1, `stage-models`) | Read at this head: `plugins/openspec/skills/devkit/SKILL.md` holds "`Outcome: failure` goes back to `next`, as for any agent" in its items (the `origin/main` copy holds it twice); no test or task of this change belongs to it (tasks.md: dropped) | pass: dropped by the plan, the covering text is present on main and on the branch |
| AC-4 | `agent-map-from-pack-table`: the fallback agent map and `PACKS` come from one source; a test fails when they differ | V1: T75 to T77 pass; V2: `project-settings: PACKS equals the plugin names in marketplace.json`, `stage-roles loop: the loop's own hand-offs of the test stages carry a role the packs know` and `change-loop lock agent: the accepted packs are the ones docs/roles.md names` pass | pass |
| AC-5 | `adr-0011-note`: a dated Note on the stop lock after a recorded end; the Decision section unchanged | `docs/adr/0011-...md` has one `Note (coordinator-loop-fixes, 2026-11-24)` linking ADR 0032 (the diff against `origin/main` is those 4 added lines only); its `## Decision` section, extracted at this head and on `origin/main`, compares byte-identical (`cmp` exit 0). V1: T78 passes | pass |
| AC-6 | `language-never-set`: with the language never set, messages come out in the default language with no placeholder; a test and a real run of the installed plugin | V1: T79 to T81 pass. Real run `r10` (conducting session, task 4.1), recorded from its files: installed `devkit-openspec@devkit 0.33.0` in the `init` event, no `language` key in `r10-config.jsonl`, the reply in Portuguese with no `${user_config`; `checks.txt` line `r10 ...: pass` | pass |
| AC-7 | `review-round-after-limit`: after round 2, the owner's own typed message hands a third round; without it the deadlock stays; `review-round.workflow.js` accepts the round | V1: the 27 AC-7 tests (T32 to T44, T95 to T97, T105 to T113, T132, T141) pass, `format: review-change` and `delivery-models AC-7` pass. Real runs recorded from their files: `r7` (`next` blocked `ceiling` on `review`; `declare` without words exit 3 `declare-no-words` and the same end; with words a `review-round` entry round 3 and `fix-review`; then `review` round 3 limit 3; `validateArgs` accepts `{round:3,limit:3}` and refuses `{round:3}`), `r7b` (a `two-prs` resolution: scope `resolution`, `push` naming `declared.json`, then `fix-resolution`, then `review-resolution` round 3 limit 3; the code review's limit stays 2), `r7s` (the nested session: no `declare` in turn 1, one main-session `declare review-round` in turn 2 with the owner's words); V4 re-checked each | pass |
| AC-8 | `plan-revised-after-start`: a plan file edited after the start stales readiness and approval and goes back to its gate; a tick or evidence does not; both drivers write the `- Plan:` digest | V1: the 17 AC-8 tests (T51 to T61, T93, T94, T115, T116, T133, T134) pass. Real runs: `r11` (a design edit after the first tick: readiness "out of date", then `waiting-approval-again` with `detail.plan`; a tick alone: `implement`), `r11b` (a merge-defect fix with and without a `- Plan:` line, real `openspec validate --strict`), `r15` (the CompozyOS driver's view and `record-approval` writing `- Plan:` equal to `planDigest`); V4 re-checked each | pass |
| AC-9 | `task-for-the-conductor`: a `Conductor:` task is never handed to the implementer and counts done only when ticked | V1: T62 to T69 pass. Real run `r9`: `conductor-task` first; `implement` with `stopAt 1.3`; a real `tdd-implementer` stops at 1.3, leaves the marked task and the gate unticked; `next` then gives `conductor-task 1.3`; V4 re-checked | pass |
| AC-10 | `fix-after-red-gate`: a red gate hands one declared fix; a second red ends `blocked` (`why=tests-red`) | V1: T25 to T31 pass. Real runs: `r5` (nested session: one `declare gate-red`, the `fix-gate` hand-off to `devkit-core:tdd-implementer`, gate green after, task ticked; `r5-declared.json` one `gate-red` entry), `r6` recorded from its files (second `declare` exits 2 with `devkit-end: feat blocked`, two `gate-red` entries); V4 re-checked each | pass |
| AC-11 | `host-monitor-wait` (proven half): with a host monitor that forbids polling, no background `wait` and the session says so; without it the `wait` starts. Deferred half carried by `host-monitor-wake` | V1: T82 passes; V2: `change-loop skill: the wait is started in the background on a GitHub wait` and `upfront AC-8 skill: ...` pass. Real runs `r13a` (host text in `proof/r13a-host.txt`: no Bash call holding `change-loop.mjs wait`, the last message names the monitor, result `success`) and `r13b` (a Bash call with `run_in_background: true` holding `change-loop.mjs wait --change feat`); V4 re-checked both. Deferred half: `openspec/roadmap.md` holds `- [ ] host-monitor-wake (after: coordinator-loop-fixes) — ` (gate 6.6 `grep -q` exit 0); not claimed here | pass (proven half); deferred half carried by the roadmap line `host-monitor-wake` |
| AC-12 | `verifier-writes-proof`: `pr-verifier` can write under `proof/`, `guard.mjs` allows it, `pr-verifier.md` says so, and a write outside `evidence.md` and `proof/` is still refused | V1: T70 to T74 pass; V2: `stage-roles roles verifier: pr-verifier records text, takes no screenshot and posts no pull-request comment` passes. `plugins/core/agents/pr-verifier.md` holds "you are its only writer; besides it you write only the output of the runs you record, under the change's `proof/` folder" (1 line) and "it is the only file you write" 0 times; the two kit copies (`plugins/compozy/.../pr-verifier/AGENT.md`, `.compozy/agents/pr-verifier/AGENT.md`) hold the new sentence (1 each). Real run R12 above (`proof/ver-r12-*`): the write under `proof/` allowed, `proposal.md` and `src/a.txt` refused with the verifier's message and left unchanged | pass |
| AC-13 | `resolve-outside-release-files`: a conflict outside the release files gets `resolve-base-conflict`, not a blocked end; release files keep `resolve-release-conflict` | V1: T45 to T50, T117, T118 pass. V3: the updated D-15 tests pass (`conduct: a conflict that also has README.md is resolve-base-conflict ...`, `conduct: under two-prs, a conflict that also has README.md is resolve-base-conflict on the base branch ...`, 3 `conduct pin` tests, `change-loop next: a pull request conflicting in another file hands resolve-base-conflict ...`, `change-loop compozy view: every hand-off step ...`, `jira-entry-followups AC-10 next carries no writeBack on a blocked end held at the pull request`). Real run `r8`: a change's pull request conflicting in `README.md` gives `resolve-base-conflict` and a real `tdd-implementer` ends with one merge commit and no push; an archive's gives it with `archive: true`; `CHANGELOG.md` only gives `resolve-release-conflict`; V4 re-checked | pass |
| AC-14 | `nits-closed` | V1: T85 to T92 pass (the `createdAfter` export, `github-setup` exit 1, the commit-attribution roadmap scenario). V2: `commit-attribution AC-1 T25 ...` (`project-loop.test.mjs`) and `commit-attribution AC-2 T31 ...` (`deliver-check-archive.test.mjs`) pass. `openspec validate coordinator-loop-fixes --strict` exit 0 (the spec deltas) | pass |
| AC-15 | `short-script-decisions-recorded`: `docs/openspec-flow.md` records the two `devkit-lite` decisions; `devkit-lite`'s stages and gates unchanged | `docs/openspec-flow.md` line 91 records both (no plan approval of its own, by decision; a first-spec change follows the ordinary choice rule, `WHY_CODES`). `devkit-lite/schema.yaml` diff against `origin/main`: the `Conductor:` sentence of the tasks instruction and the review gate sentence only; its `id:`/`requires:` lines hash the same on both (md5 `3aed4d4f...`); both copies byte-identical. V1: T83 passes | pass |
| AC-16 | `no-behaviour-change-elsewhere`: no behaviour change outside AC-1 to AC-13 and AC-17 to AC-20; the existing suites stay green | Observed here: T84 passes (V1); every by-name run of this verification is green (gate 1.6: 149 and 320 tests; V1 201; V2 86; V3 116; 0 fail, no `FAIL` or `LEFT` file), including the D-15 tests kept for the rules this change replaces; AC-15's `devkit-lite` stages unchanged | no proof: the whole suite was not run by this verification (by the caller's instruction; it is the train's part `node scripts/test-suite.mjs`, proven by the train record) |
| AC-17 | `archive-prefixed-id-own-pr`: an `archive-` id finds its own pull request; an archive head of another change never | V1: T119 to T124 and T142 pass, with every `forced-merge-path 1: L` test. V2: `delivery-train P3 isOwnPr: ...` and the 6 `delivery-train P3 delivered` tests pass. Real run `r16` on the real repository: with `origin/main`'s hooks `next --change archive-release-pin` says no pull request yet; with this worktree's, the post-merge row `tag-release` naming PR #107; V4 re-checked | pass |
| AC-18 | `delivered-advanced-branch-no-rereview`: a delivered change on a branch advanced into the base goes to the retro with no new evidence or review; ahead of the base, as today | V1: T125 to T131 pass. Real run `r17`: with `origin/main`'s hooks blocked `pr-problem` on stage `evidence` (item 5 blocked in `r17-before-dc.json`); with this worktree's hooks the retro and no reviewer hand-off; with one commit of its own, blocked `pr-problem` again (`r17-own-commit-dc.json`); V4 re-checked | pass |
| AC-19 | `stage-models-override-validates`: the table in the `x-devkit:` block validates strictly and `modelsOf` reads it (`budget` too) | V1: T135 to T139 pass (T137 writes the table as the document shows it, runs `openspec validate <id> --type change --strict` and asserts exit 0), with `stage-models AC-10` and `change-budget AC-10` | pass |
| AC-20 | `no-test-pins-live-roadmap-state`: the `Live roadmap:` rule in `openspec/config.yaml`; the named tests pass on the live roadmap and on a copy with the line ticked | `openspec/config.yaml` holds the `Live roadmap:` line once, right after `Test history:`. V1: T140 passes, and `jira-entry AC-10 the roadmap has the live-proof follow-up after jira-entry`, `stage-roles docs: the roadmap line of stage-roles keeps its text, ...` and the 3 `post-merge-validate 3` tests pass | pass |

### Observations (not defects of this change)

- This session's guard is the installed devkit-openspec 0.33.0, which refuses a `pr-verifier` write under `proof/`; the
  R12 output files and the `r12` line were written by the run's own script (D-14's form), not by the `Write` tool.
  Once the release of this change is installed, the verifier's own `Write` under `proof/` is allowed (R12).
- The stream JSON files under `proof/` keep two kinds of host detail that D-14 rule 5 does not scrub: TMPDIR-derived
  paths under `/var/tmp/devkit-coordinator-loop-fixes/` (socket and temporary folders; 13 files) and the synced plugin
  folder ids in the `init` event's plugin list (14 files; the archived changes' proof files already hold the same ids).
  Neither is the home folder, the worktree or a scratch run folder; the owner may weigh them for a public repository.
