<!-- devkit-stage evidence result=passed attempt=2 commit=f416d6a8915866a9fa23a705f1b08b094e3d9896 -->
Commit: f416d6a8915866a9fa23a705f1b08b094e3d9896

# Evidence: coordinator-loop-fixes

Verified on 2026-11-25 by `pr-verifier` at head `f416d6a` (attempt 2, after review round 1 FAILED and its fixes
`59b8350`, `f1acdfd`, `66f3553`, `3ec3322` and `5dc0830`, then the merge of `origin/main` `fc28735`, train 18, at
`f416d6a`). The working tree was clean before this verification; the only files it added or changed are under
`openspec/changes/coordinator-loop-fixes/`: this file, the five `proof/ver-r7s-*` files and the `ver-r7s` line of
`proof/checks.txt`. No fetch was done: `origin/main` is the local ref `fc28735`, an ancestor of `HEAD`
(`git merge-base --is-ancestor origin/main HEAD` exit 0). The merge brought only the archive of `suite-socket-path`,
`CONTRIBUTING.md` (4 lines) and `openspec/trains/18.md`; the pack versions at this head are openspec 0.48.0, core
0.17.0, compozy 0.5.0 and marketplace 0.53.0, each above `origin/main`'s (0.47.2, 0.16.3, 0.4.0, 0.52.2).
`devkit.delivery.train` on `origin/main` is `node scripts/test-suite.mjs && python3 scripts/check.py` and this change
does not edit that key, so those two parts are `train:` rows. Every test run below used `node scripts/test-suite.mjs`
with `TMPDIR=/var/tmp/devkit-coordinator-loop-fixes`, `GITHUB_HEAD_REF=probe-branch` and `GITHUB_BASE_REF=main`,
started only after `pgrep -f 'scripts/test-suite.mjs$'` showed no other run. The whole suite was not run by this
verification, by the caller's instruction: the train runs it at its head. The times below are not suite timings
(the nested run `ver-r7s` ran at the same time).

## Verification

### Gates

| Gate | Command | Result |
|---|---|---|
| 1.6 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 plugins/openspec/hooks/guard.test.mjs` | pass: exit 0; `suite: 1 files, 149 tests, 149 pass, 0 fail, 29.8s, concurrency 2`; the file `pass` (T99 with its node-option cases among them) |
| 1.6 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="^coordinator-loop-fixes" --test-name-pattern="^roadmap-loop repl" --test-name-pattern="^followups AC-4 reply" --test-name-pattern="^jira-entry-followups AC-8" --test-name-pattern="^upfront AC-8 skill" --test-name-pattern="^change-loop skill" --test-name-pattern="^change-loop lock" --test-name-pattern="^change-loop repl" --test-name-pattern="^change-state" plugins/openspec/hooks/change-loop-declared.test.mjs plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/change-loop-compozy.test.mjs plugins/openspec/hooks/change-loop-remote-state.test.mjs plugins/openspec/hooks/roadmap-loop.test.mjs plugins/openspec/hooks/roadmap-loop-followups.test.mjs plugins/openspec/hooks/roadmap-loop-upfront.test.mjs plugins/openspec/hooks/deliver-check.test.mjs` | pass: exit 0; `suite: 8 files, 325 tests, 325 pass, 0 fail, 224.2s, concurrency 2`; all 8 files `pass`, none `FAIL` or `LEFT` |
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
| V1 | `--concurrency=3`, task 6.5's Check patterns (`^coordinator-loop-fixes`, `^AC-8 release-ready`, `^the pin in docs/openspec-flow.md`, `^change-loop docs: the design records the answers`, `^stage-roles docs`, `^post-merge-validate 3`, `^jira-entry AC-10`, `^forced-merge-path 1: L`, `^stage-models AC-10`, `^change-budget AC-10`, `^format: review-change`, `^delivery-models AC-7`, `^jira-entry-followups docs`, `^own-files AC-9 docs`) plus `^conduct`, `^change-loop decide` and `^sanitize`, over its 14 files | pass: exit 0; `suite: 14 files, 333 tests, 333 pass, 0 fail, 163.3s, concurrency 3`; all 14 files `pass`. 147 distinct `coordinator-loop-fixes AC-<n> T<k>` tests passed, the same 147 the test files define (T1 to T148 without T24; T143 to T148 once each); per criterion: AC-1 27, AC-2 4, AC-4 3, AC-5 1, AC-6 3, AC-7 31, AC-8 17, AC-9 9, AC-10 7, AC-11 1, AC-12 5, AC-13 8, AC-14 8, AC-15 1, AC-16 1, AC-17 7, AC-18 7, AC-19 6, AC-20 1. Also 88 `conduct` tests, 37 `change-loop decide` tests (among them `the loop's step agents match conduct-check's actorOf`), 1 `sanitize`, 3 `post-merge-validate 3`, 5 `stage-roles docs`, 9 `forced-merge-path 1: L`, 31 `stage-models AC-10`, 3 `delivery-models AC-7`, 1 `format: review-change`, 1 `change-budget AC-10`, 1 `jira-entry AC-10` |
| V2 | `--concurrency=3`, `^commit-attribution`, `^project-settings: PACKS equals`, `^delivery-train P3 isOwnPr`, `^delivery-train P3 delivered`, `^stage-roles loop`, `^stage-roles roles verifier`, `^change-loop lock agent`, `^change-loop compozy view`, `^change-loop next: a pull request conflicting`, `^jira-entry-followups AC-10 ` over `project-loop`, `deliver-check-archive`, `project-settings`, `delivery-train-after`, `change-loop-compozy`, `change-loop`, `change-loop-remote` test files | pass: exit 0; `suite: 7 files, 94 tests, 94 pass, 0 fail, 35.1s, concurrency 3`; all 7 files `pass` |
| V4 | Each stored check script of the real runs (`runs/<run>/check.sh` in the scratch folder, reading only the files under `proof/` and the run's recorded exit codes; none runs a loop command or a `declare`), output to a file and read with `grep -c` | pass: all 17 scripts exit 0 with their `checks: pass` lines and no `checks: fail` line: r1 (6 lines: r1-start, r1, r2, r3, r4 and its own), r5, r6, r7, r7b, r7s, r8, r9, r11, r11b, r12, r13 (3 lines: r13a, r13b, its own), r14, r15, r16, r17 and ver-r7s |

### Real runs of `proof/` (D-14)

**Which runs the fixes made stale.** Review round 1's fixes change what the conducting session runs at a review
deadlock (the `devkit` and `ship-change` skills now say `declare <id> review-round --stdin words` with the owner's words
as the body of the quoted heredoc `<<'DEVKIT_ARGS'`, in place of `--param words="<their words>"`). R7s is the real run of
that session part, and it ran the old text, so it is stale: it was run again as `ver-r7s` below. The other runs are not
stale: R7 and R7b call `declare` directly with `--param words=...`, which `runDeclare` still accepts unchanged (design
D-4); R14's command (`node <path>/change-loop.mjs declare ...` with no node option) is still matched by the widened
`DECLARE_CALL` (the new pattern only adds optional `-...` words after `node`), so its refusal holds, and the new
option-word variants are proven at the hook's own entry, `guardBash`, by T99 (gate 1.6 part 1); `f1acdfd` adds a test
only (T146), no code, so R9 is unchanged; `3ec3322` and `5dc0830` are document edits; the merge brought no hook code.

`proof/checks.txt` has 22 lines, each ending in `: pass`, none in `: fail` (counted at this head): one line each for r1
to r17 with r7b, r7s, r11b, r13a and r13b, r12, and ver-r7s. R6, R7 and R7b are recorded from their files, never run
here (no `declare` was run by this verification itself): `r6-declare-2.txt` holds one `devkit-end: feat blocked` line and
`r6-declared.json` two `gate-red` entries of phase 1; `r7-declare-nowords.txt` names `declare-no-words`;
`r7-declared.json` holds one `review-round` entry; `r7b-declared.json` one entry of scope `resolution` (V4 re-checked
each). R10 is recorded from its files (installed `devkit-openspec@devkit 0.33.0`, no `language` key). R12 (the
verifier's own run, attempt 1) is recorded from `proof/ver-r12-*` (V4: its check script passes). Scrub (D-14 rule 5):
`grep -rlF` of the home folder over `proof/` finds 0 files.

**ver-r7s, R7s again after the fix** (D-14 rule 2, AC-7). Scripts in the scratch folder `runs/ver-r7s/` (outside this
repository, rule 3): `build.mjs` is R7s's fixture copied (a delivered `devkit-lite` change `feat` whose code review failed
at rounds 1 and 2, `code-quality-reviewer` rejecting at the head; no `declared.json`); `p1.txt` is
`/devkit-openspec:devkit change feat`; `p2.txt`, written with a quoted heredoc, is the owner's message of turn 2, 174
bytes holding a backtick, a `$(...)`, an apostrophe and double quotes, with two `touch ver-tick-*` texts; both turns are
`claude -p "$(cat <file>)" --plugin-dir <worktree>/plugins/core --plugin-dir <worktree>/plugins/openspec`, turn 2 with
`--resume` and the Agent tool disallowed. Outputs (scrubbed, rule 5): `proof/ver-r7s-turn1.jsonl`,
`proof/ver-r7s-turn1-hooklog.jsonl`, `proof/ver-r7s-turn2.jsonl`, `proof/ver-r7s-turn2-hooklog.jsonl`,
`proof/ver-r7s-declared.json`. Observed (24 checks of `check.sh`, all hold): the `init` event lists `devkit-core` 0.17.0
and `devkit-openspec` 0.48.0 from `<worktree>/plugins/...`; turn 1: result `success`, `next` ends `blocked` `ceiling` on
the stage `review`, no `declare` call in any thread, the last assistant message holds the blocked reply and, beyond it,
"Mais uma rodada de revisão só acontece com o seu pedido, escrito por você aqui."; turn 2: result `success`, exactly
one Bash call of the nested main session holding `change-loop.mjs declare` and `review-round`, whose command holds
`--stdin words` and `<<'DEVKIT_ARGS'` and no `--param words=` (4 lines: the command, the words, the terminator), whose
result's first line is `devkit-run: feat` and whose action is `fix-review` for `devkit-core:tdd-implementer`; no
subagent `declare`; the turn-2 hook log holds 5 decisions, all `allow`; `declared.json` holds one `review-round` entry of
scope `review`, round 3, whose `words` equal the message byte for byte (without its final line break); `find` of
`ver-tick-*` under the scratch run folder prints 0, so no command in the words ran; 0 lines hold the worktree, scratch
or home path. Its line `ver-r7s ...: pass` was appended to `proof/checks.txt` after the check passed. Two of the checks
were corrected after the first check run, each a parser fault of the script, not a change in the run: the `next` reply
is parsed between the first `{` and the last `}` (the session added `; echo "exit=$?"`), and the owner's-word sentence
may say "pedido" (request) as well as "palavra" (word); both corrections are commented in `check.sh`.

### Acceptance criteria

| AC | Criterion | Proof | Result |
|---|---|---|---|
| AC-1 | `declared-step-outside-gates`: a pause or a decision outside the gates is recorded by a declared `reply` key; ending the turn with its first output line is accepted by the stop lock, without it refused | V1: the 27 AC-1 tests (T1 to T19, T98 to T104, T114) pass, T99 with the review-round-1 cases (`node --no-warnings <path>`, `node -- <path>`, two options before a quoted path, refused for a subagent and allowed for the main session); gate 1.6 part 2: the D-15 reply tests (`roadmap-loop repl` 3, `followups AC-4 reply` 1, `change-loop repl` 7, `jira-entry-followups AC-8` 5) pass; V1's `sanitize` test passes. Real runs: `r1` (a pause: `reply waiting-pause`, stop decision `allow` `end-recorded`), `r2` (`reply waiting-owner-decision` with the decision's words, `allow` `end-recorded`), `r3` (no declared end: first stop decision `refuse` `stage-ready`), `r14` (a subagent's `declare` refused naming the main session, no `declared.json`; not stale, see above), `r5`; V4 re-checked each | pass |
| AC-2 | `end-marker-id-checked`: an end marker naming another change does not release the stop lock; one naming the run's change does | V1: T20 to T23 pass (gate 1.6 part 1 runs all of `guard.test.mjs`: 149 pass). Real run `r4`: the R1 transcript fed to `guard.mjs stop` exits 0 unchanged and exits 2 with every end line's id changed to `other-change`, refusing with the stage named; V4 re-checked | pass |
| AC-3 | `skill-names-declared-end`: dropped, covered by main (merge 8f14bd1, `stage-models`) | No test or task of this change belongs to it (tasks.md: dropped); the fixes do not touch it | pass: dropped by the plan |
| AC-4 | `agent-map-from-pack-table`: the fallback agent map and `PACKS` come from one source; a test fails when they differ | V1: T75 to T77 pass; V2: `project-settings: PACKS equals the plugin names in marketplace.json`, the `stage-roles loop` tests (32) and the `change-loop lock agent` tests (9) pass | pass |
| AC-5 | `adr-0011-note`: a dated Note on the stop lock after a recorded end; the Decision section unchanged | `docs/adr/0011-...md` has the `Note (coordinator-loop-fixes, 2026-11-24)` (the diff against `origin/main` is 5 added lines, 0 removed); its `## Decision` section, extracted at this head and on `origin/main`, compares byte-identical (`cmp` exit 0). V1: T78 passes | pass |
| AC-6 | `language-never-set`: with the language never set, messages come out in the default language with no placeholder; a test and a real run of the installed plugin | V1: T79 to T81 pass. Real run `r10` (conducting session, task 4.1), recorded from its files; `checks.txt` line `r10 ...: pass`. `ver-r7s` turn 1 also shows a nested session whose `--lang` was the unfilled `${user_config.language}` replying in Portuguese | pass |
| AC-7 | `review-round-after-limit`: after round 2, the owner's own typed message hands a third round; without it the deadlock stays; `review-round.workflow.js` accepts the round | V1: the 31 AC-7 tests pass: T32 to T44 (T44 now pins `--stdin words` through `<<'DEVKIT_ARGS'` and no `--param words` in both skills), T95 to T97, T105 to T113, T132, T141, and the review-round-1 tests T143 (`--stdin words` records words with a backtick, `$(...)`, an apostrophe and a double quote byte for byte, as `--param words` does), T144 (a spawned `bash` with the quoted heredoc: the words recorded, no `touch` file created), T145 (`--stdin decision`, `--stdin Words`, both forms at once and an empty input each exit 3 with nothing recorded), T147 (ADR 0032's Decision section unchanged and its dated Note of 2026-11-25 on the three limits; `docs/compozy-kit.md` points to it); `format: review-change` and `delivery-models AC-7` (3) pass. ADR 0032 at this head: one `Note (coordinator-loop-fixes, 2026-11-25)` line, ending "No decision's text changes."; its diff since review round 1 is 12 added lines, 0 removed. Real runs: `r7`, `r7b` recorded from their files (not stale: `--param words` is unchanged), and `ver-r7s` above (the session's own part on the fixed skill text: `declare ... review-round --stdin words` with the owner's typed words through the quoted heredoc, recorded byte for byte, round 3, `fix-review`, no command of the words run); the older `r7s` (on the old `--param words` text) is superseded by `ver-r7s` for the session's command; V4 re-checked each | pass |
| AC-8 | `plan-revised-after-start`: a plan file edited after the start stales readiness and approval and goes back to its gate; a tick or evidence does not; both drivers write the `- Plan:` digest | V1: the 17 AC-8 tests (T51 to T61, T93, T94, T115, T116, T133, T134) pass. Real runs `r11`, `r11b`, `r15` (unchanged by the fixes); V4 re-checked each. ADR 0032's 2026-11-25 Note records that an approval written without a `- Plan:` line never goes stale (T147) | pass |
| AC-9 | `task-for-the-conductor`: a `Conductor:` task is never handed to the implementer and counts done only when ticked | V1: T62 to T69 and the review-round-1 test T146 pass (`actorOf('conductor-task')` is `{ actor: 'main' }`; `deliveryStep` on a `conductor-task` report gives actor `main`, deliver-check's reason and the state `ready to run: conductor-task`); V1's `change-loop decide: the loop's step agents match conduct-check's actorOf` and the 88 `conduct` tests pass. Real run `r9`: `conductor-task` first; `implement` with `stopAt 1.3`; a real `tdd-implementer` stops at 1.3, leaving the marked task and the gate unticked; then `conductor-task 1.3`; V4 re-checked | pass |
| AC-10 | `fix-after-red-gate`: a red gate hands one declared fix; a second red ends `blocked` (`why=tests-red`) | V1: T25 to T31 pass. Real runs `r5` (nested session: one `declare gate-red`, the `fix-gate` hand-off to `devkit-core:tdd-implementer`, gate green after) and `r6` (from its files: second `declare` exits 2, two `gate-red` entries); V4 re-checked each. ADR 0032's 2026-11-25 Note records that the CompozyOS driver asks the owner at a red gate (T147) | pass |
| AC-11 | `host-monitor-wait` (proven half): with a host monitor that forbids polling, no background `wait` and the session says so; without it the `wait` starts. Deferred half carried by `host-monitor-wake` | V1: T82 passes; gate 1.6 part 2: `change-loop skill: the wait is started in the background on a GitHub wait` and `upfront AC-8 skill` pass. Real runs `r13a` and `r13b`; V4 re-checked both. Deferred half: `openspec/roadmap.md` holds `- [ ] host-monitor-wake (after: coordinator-loop-fixes) — ` (gate 6.6 `grep -q` exit 0); not claimed here | pass (proven half); deferred half carried by the roadmap line `host-monitor-wake` |
| AC-12 | `verifier-writes-proof`: `pr-verifier` can write under `proof/`, `guard.mjs` allows it, `pr-verifier.md` says so, and a write outside `evidence.md` and `proof/` is still refused | V1: T70 to T74 pass; V2: `stage-roles roles verifier: ...` passes. `plugins/core/agents/pr-verifier.md` and its two kit copies each hold "besides it you write only the output of the runs you record, under the change's `proof/` folder" once and "it is the only file you write" 0 times. Real run R12 of attempt 1 (`proof/ver-r12-*`, V4 re-checked): the write under `proof/` allowed, `proposal.md` and `src/a.txt` refused and unchanged | pass |
| AC-13 | `resolve-outside-release-files`: a conflict outside the release files gets `resolve-base-conflict`, not a blocked end; release files keep `resolve-release-conflict` | V1: T45 to T50, T117, T118 and the 88 `conduct` tests (the updated D-15 `conduct` and `conduct pin` tests among them) pass. V2: `change-loop next: a pull request conflicting ...` (2), the `change-loop compozy view` tests (25) and `jira-entry-followups AC-10 next carries no writeBack on a blocked end held at the pull request` pass. Real run `r8`; V4 re-checked. ADR 0032's 2026-11-25 Note records that an archive that left a delivery train keeps its blocked `stop-archive` (T147) | pass |
| AC-14 | `nits-closed` | V1: T85 to T92 pass. V2: `commit-attribution AC-1 T25 ...` and `commit-attribution AC-2 T31 ...` pass (16 `commit-attribution` tests in all). `openspec validate coordinator-loop-fixes --strict` exit 0 (the spec deltas, with the file-writers scenario now naming node option words, and the change-coordination scenario "The owner's words are recorded as typed") | pass |
| AC-15 | `short-script-decisions-recorded`: `docs/openspec-flow.md` records the two `devkit-lite` decisions; `devkit-lite`'s stages and gates unchanged | V1: T83 passes; the fixes and the merge touch neither `docs/openspec-flow.md` nor the schemas (`git diff e29771b HEAD` lists neither) | pass |
| AC-16 | `no-behaviour-change-elsewhere`: no behaviour change outside AC-1 to AC-13 and AC-17 to AC-20; the existing suites stay green | Observed here: T84 passes (V1); every by-name run of this verification is green (gate 1.6: 149 and 325 tests; V1 333; V2 94; 0 fail, no `FAIL` or `LEFT` file), including the D-15 tests kept for the rules this change replaces | no proof: the whole suite was not run by this verification (by the caller's instruction; it is the train's part `node scripts/test-suite.mjs`, proven by the train record) |
| AC-17 | `archive-prefixed-id-own-pr`: an `archive-` id finds its own pull request; an archive head of another change never | V1: T119 to T124, T142 and the 9 `forced-merge-path 1: L` tests pass. V2: `delivery-train P3 isOwnPr` (1) and `delivery-train P3 delivered` (6) pass. Real run `r16`; V4 re-checked | pass |
| AC-18 | `delivered-advanced-branch-no-rereview`: a delivered change on a branch advanced into the base goes to the retro with no new evidence or review; ahead of the base, as today | V1: T125 to T131 pass. Real run `r17`; V4 re-checked | pass |
| AC-19 | `stage-models-override-validates`: the table in the `x-devkit:` block validates strictly and `modelsOf` reads it (`budget` too) | V1: T135 to T139 and the review-round-1 test T148 pass (ADR 0023's header holds `- Amended by ADR 0033 (0033-a-changes-own-settings-live-in-an-x-devkit-block.md)` before `- Date:`), with the 31 `stage-models AC-10` tests and `change-budget AC-10`. ADR 0023's diff against `origin/main` is 9 added lines, 0 removed (the header line and the 2026-11-24 Note) | pass |
| AC-20 | `no-test-pins-live-roadmap-state`: the `Live roadmap:` rule in `openspec/config.yaml`; the named tests pass on the live roadmap and on a copy with the line ticked | V1: T140 passes, with `jira-entry AC-10` (1), the 5 `stage-roles docs` tests and the 3 `post-merge-validate 3` tests | pass |

### Observations (not defects of this change)

- In `ver-r7s` turn 2 the Agent tool was disallowed so the run would stop after the `declare` (as R7s did). The
  nested session instead searched for an Agent tool, loaded the `workflow-authoring` and `ship-change` skills and handed
  `fix-review` to one agent through a Workflow script it wrote; that agent changed nothing (the fixture's finding has no
  content to fix) and the next `next` ended the run blocked. This is beyond the R7s case and does not touch its checks
  (the record holds one entry, no subagent `declare` is in the stream). The owner may weigh whether a session should
  route a `tdd-implementer` hand-off through a self-written Workflow when the Agent tool is missing.
- In `ver-r7s` turn 1 the nested session first grepped this worktree's `change-loop.mjs` for `user_config`, because
  under `--plugin-dir` the `${user_config.language}` placeholder is not filled; the loop's default language then applied.
- The stream JSON files under `proof/` keep two kinds of host detail that D-14 rule 5 does not scrub: TMPDIR-derived
  paths under `/var/tmp/devkit-coordinator-loop-fixes/` and the synced plugin folder ids in the `init` event's plugin
  list (the `ver-r7s` files too). Neither is the home folder, the worktree or a scratch run folder; the owner may weigh
  them for a public repository.

No defect was found.
