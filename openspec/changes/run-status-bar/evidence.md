<!-- devkit-stage evidence result=passed attempt=1 commit=752a3f2a396be54840c0f3acb41f58179147569b -->
Commit: 752a3f2a396be54840c0f3acb41f58179147569b

# Evidence

Change `run-status-bar`, verified at `752a3f2` on branch `run-status-bar`. The tree was clean (`git status --short` printed
nothing before this file was written). `752a3f2` is the head after `e4ebb2e` (release 0.40.0 / 0.44.0) and `f39c93e` (the merge of
`origin/main`); the only difference between `e4ebb2e` and `752a3f2` is one tick in `openspec/changes/run-status-bar/tasks.md`
(`git diff e4ebb2e HEAD --stat`: 1 file changed), so every file outside `openspec/changes/` is the one the whole-suite run saw.
No defect found. Nothing was fixed and nothing was committed.

Who ran what:

- **The whole-suite run was run by the conducting session**, not by the verifier (the machine is shared), after `e4ebb2e` and on
  the tree of this head. The verifier read its log, `/private/tmp/devkit-run-status-bar/suite-log-head.txt` (last written 10:49,
  `e4ebb2e` is 10:37:37), and quotes it: `suite: 40 files, 3139 tests, 3139 pass, 0 fail, 672.7s, concurrency 14`, then
  `all checks passed`, then `exit=0`. The verifier counted 40 `^pass ` lines and 0 `^FAIL` lines in it. The log holds one `pass`
  line for each of `flow-check`, `change-state-stages`, `change-loop-remote-state`, `roadmap-loop`, `roadmap-loop-upfront` and
  `roadmap-loop-followups` (`.test.mjs` under `plugins/openspec/hooks/`), for `status-line.test.mjs` (42.6s) and for
  `change-loop.test.mjs` (417.3s).
- **The verifier ran live**, at `752a3f2` with `TMPDIR=/private/tmp/devkit-run-status-bar GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main`
  and no whole suite: gate parts 2.5 (three files, then the reply tests), `python3 scripts/check.py`,
  `python3 scripts/gen-catalog.py --check`, and the eight real runs of the status line command below (logged at
  `/private/tmp/claude-501/-Users-kauesantos-Documents-devkit--claude-worktrees-run-status-bar/4085ed07-8492-4c4b-8c10-f2febfdb8331/scratchpad/verify-runs.log`,
  from the conducting session's `real-runs.sh` in the same folder, fixtures under `/private/tmp/devkit-run-status-bar/real-fixtures/`).
  The verifier's own gate logs are `/private/tmp/devkit-run-status-bar/verify/g25a.log` and `g25b.log`.
- The earlier gate logs `/private/tmp/devkit-run-status-bar/gate1.log` (`suite: 6 files, 691 tests, 691 pass, 0 fail, 307.0s`,
  `all checks passed`, `exit=0`, last written 10:06) and `gate2.log` (10:24) ran at heads before the merge and the release; they are
  history. The proof for 1.7 below is the whole-suite log at this head.

### Gates

The delivery train (`devkit.delivery.train` in `openspec/config.yaml`) is `node scripts/test-suite.mjs && python3 scripts/check.py`.
The part `python3 scripts/check.py` equals one of its parts, so its rows end in `train:` (docs/openspec-flow.md, "Gate parts proven by
the train"); the verifier also ran it live and the result is in the row. The suite part of the gates is written
`env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs ...`, which is not equal to the train's part, so
those rows are `pass` rows (the whole-suite run above, or the live run, as each row says). `python3 scripts/gen-catalog.py --check`
is not a train part and has a real `pass` row.

| Gate | Command | Result |
| --- | --- | --- |
| 1.7 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs plugins/openspec/hooks/flow-check.test.mjs plugins/openspec/hooks/change-state-stages.test.mjs plugins/openspec/hooks/change-loop-remote-state.test.mjs plugins/openspec/hooks/roadmap-loop.test.mjs plugins/openspec/hooks/roadmap-loop-upfront.test.mjs plugins/openspec/hooks/roadmap-loop-followups.test.mjs` | pass: not run again by the verifier; the one green whole-suite run at this head (`suite: 40 files, 3139 tests, 3139 pass, 0 fail`, exit 0) imports all six files and the log has a `pass` line for each, so it stands for this part (flow-check and change-state-stages also ran live in the 2.5 row below: 317 tests pass) |
| 1.7 | `python3 scripts/check.py` | train: proven by the train's part of the same text; the verifier also ran it live at `752a3f2` before writing this file: exit 0, `all checks passed` |
| 2.5 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs plugins/openspec/hooks/status-line.test.mjs plugins/openspec/hooks/change-state-stages.test.mjs plugins/openspec/hooks/flow-check.test.mjs` | pass: run live, exit 0, `suite: 3 files, 317 tests, 317 pass, 0 fail, 83.7s, concurrency 14` (status-line 20.0s, change-state-stages 45.6s, flow-check 83.7s) |
| 2.5 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --test-name-pattern="^change-loop replies: " plugins/openspec/hooks/change-loop.test.mjs` | pass: run live, exit 0, `suite: 1 files, 4 tests, 4 pass, 0 fail, 0.2s, concurrency 14`, then `all checks passed` (the whole-suite run also passed the whole `change-loop.test.mjs`, 417.3s) |
| 2.5 | `python3 scripts/check.py` | train: proven by the train's part of the same text; the live run at this head: exit 0, `all checks passed` |
| 3.4 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs` | pass: the conducting session's whole-suite run at this head's tree, exit 0, `suite: 40 files, 3139 tests, 3139 pass, 0 fail, 672.7s, concurrency 14` (log named above); the verifier ran no whole suite |
| 3.4 | `python3 scripts/check.py` | train: proven by the train's part of the same text; the live run at this head: exit 0, `all checks passed`; run again after this file was written (see the last bullet of the notes) |
| 3.4 | `python3 scripts/gen-catalog.py --check` | pass: run live at `752a3f2`, exit 0, no output (the catalog is up to date) |

### Acceptance criteria

The command in every real run is `node plugins/openspec/hooks/status-line.mjs --lang <l>` with the JSON of D-2 on standard input
(`session_id`, `workspace.current_dir`, `cwd`, and `transcript_path` in R6); every run exited 0 with an empty standard error. The
widths below are display columns, counted with the command's own `columns` export (an emoji takes two, the marks and `…` one); every
line is at most 100 columns. A line in a fixture repository comes from that fixture's own project (its flags decide `N`), so a fixture
line has the shape of the mock-up line, not its text.

| AC | Criterion | What was run, what it printed, and where the proof is | Result |
| --- | --- | --- | --- |
| AC-1 | `lone-change-bar`: a session that conducts a change at `approval` shows state icon, stage icon, id, stage title, strip, `n of N` and the reason; exit 0 | R4 (a fixture project with change `feat` at the plan approval, waiting for the owner, session id not recorded in any run file) printed `🙋 📝 feat · Owner's approval · ■■■■■■■◆□□□□□ · 8 of 13 · your approval of the plan`, 83 columns, exit 0: the elements of mock moment 3 in order (state icon, stage icon, id, title, 7 done marks, the current mark, 5 not-yet marks, place 8 of 13, reason in words). R1 in this worktree at its real stage today (`evidence`) printed `🔍 run-status-bar · Demonstration · ■■■■■■■■■■■◆□□□ · 12 of 15`, 62 columns: running, so no state icon and no reason, 11 done marks, the current mark and 3 not-yet marks, as mock moment 4 draws a running change. The tests `run-status-bar AC-1 line:`, `AC-1 strip:`, `AC-1 cut:`, `AC-1 choice:` and `AC-1 input:` in `plugins/openspec/hooks/status-line.test.mjs` pass (gate 2.5, 317 tests). Left to dogfood: the line under the message box in the owner's own session at a real plan approval (the approval moment of this change itself is past, so the approval line is proven on the fixture and by the mock test, not on this change) | pass |
| AC-2 | `no-budget`: with a `budget` cap set the line has no percentage, no mention of the budget, and no transcript is read | R6: a fixture project whose `openspec/config.yaml` holds `devkit:` and `budget: 1000000`, with `transcript_path` on the input set to `/nonexistent/transcript.jsonl`, printed `🙋 📝 feat · Owner's approval · ■■■■■■■◆□□□□□ · 8 of 13 · your approval of the plan`, exit 0, empty standard error: no `%`, no budget word, no error from the missing transcript. The line is the same as R4's, so the cap changed nothing. Test `run-status-bar AC-2 budget:` (cap in the config and a real transcript file of 950000 tokens on the input, both languages, both views: no `%`, `budget`, `orçamento` or `token` in the output) passes. A scan of `plugins/openspec/hooks/status-line.mjs` for `transcript_path`, `spentOf`, `budget`, `devkit-run:` and `devkit-end:` counted 0 hits, and the test `AC-5 read-only: the source writes nothing, ... never reads a transcript or a cap` passes | pass |
| AC-3 | `roadmap-counts`: the coordinator of a run whose listing holds six changes (3 running, 2 waiting, 1 blocked) shows those counts, no strip, no percentage | Proven on a fixture, not on the repository's own listing. R7 (a fixture repository with three changes waiting on the owner and a run file recording the input's session `S-coordinator`) printed `3 in play · 0 working · 🙋 3 waiting on the owner · ⛔ 0 blocked`, 64 columns, exit 0, no strip, no `%`. The 3/2/1 mix itself is proven by the tests `run-status-bar AC-3 counts: the mix of the criterion` (`6 in play · 3 working · 🙋 2 waiting on the owner · ⛔ 1 blocked`) and the `AC-7 mock: ... roadmap-run mock-up` test, which pass; no real run with exactly that mix was made, since no real listing holds it. The count of this repository's own roadmap run is left to dogfood, after `state-skips-unlocated` (the plan says so in D-12); the verifier did not read the run file of the root checkout to find its session | pass |
| AC-4 | `nothing-conducted`: with no change conducted and no run the bar prints nothing and exits 0 | R3: `cwd` set to the root checkout `/Users/kauesantos/Documents/devkit` (branch `main`, no change's worktree) with session id `S-unrecorded-session`, `--lang en`: exit 0, standard output empty (`wc -c` printed 0 bytes with `--lang en` and with `--lang pt-BR`, so not even a newline), standard error empty, matching `mock/nothing-conducted.md` (an empty bar). Test `run-status-bar AC-4 mock: a session that conducts nothing prints the empty bar of the mock-up` and the `AC-4 choice:` tests pass | pass |
| AC-5 | `read-only`: `git status`, the run file and the worktree list are as they were, no AI, no `devkit-run:` or `devkit-end:` line | In all eight real runs the capture before the run and after it was equal: `git status --short --untracked-files=all` (empty in this worktree and in the fixtures), the SHA-256 of `<git common dir>/devkit/roadmap-run.json` (R1 to R3 on the repository's own run file: `b5fe2a11` to `28235c27` before and after; R7 and R8 on the fixture's: `a92e26a4` to `c1a8e211`), and `git worktree list` (23 lines in this repository, 1 in each fixture). The run log holds 0 lines with `devkit-run:` or `devkit-end:`. Calls no AI: the test `AC-5 read-only: the source writes nothing, spawns only node and git, and never reads a transcript or a cap` passes (only `existsSync`, `statSync`, `realpathSync` and `readFileSync` imported from `node:fs`, no write call but the two standard streams, every spawn is `git`, `node` or the injected state command) and the test `AC-5 read-only: git status, the run file and the worktree list are as they were, and no loop marker is printed` passes in each view | pass |
| AC-6 | `person-language`: with `--lang pt-BR` the words are in Brazilian Portuguese; state, stage and counts are those of `--lang en` | R1 against R2 in this worktree: `🔍 run-status-bar · Demonstration · ... · 12 of 15` and `🔍 run-status-bar · Demonstração · ■■■■■■■■■■■◆□□□ · 12 de 15`; R4 against R5 at the plan approval: `... 8 of 13 · your approval of the plan` and `🙋 📝 feat · Aprovação do dono · ■■■■■■■◆□□□□□ · 8 de 13 · a sua aprovação do plano`; R7 against R8: `3 in play · 0 working · 🙋 3 waiting on the owner · ⛔ 0 blocked` and `3 em jogo · 0 em andamento · 🙋 3 aguardando o dono · ⛔ 0 bloqueadas`. Icons, id, strip, place and counts are equal in each pair; the stage title, `of`/`de`, the reason and the count words change. Tests `run-status-bar AC-6 language:` (two of them) pass. Left to dogfood: the owner's own language setting | pass |
| AC-7 | `mock-matches`: the line printed for each example of the approved mock-up is the one the mock shows, element by element | Test `run-status-bar AC-7 mock: each line of the lone-change mock-up, in both languages and with the long id` passes: moments 1 to 4 in `en` and `pt-BR`, the 100-column cut of the long id `roadmap-coordinator-followups`, and the widths 97, 98 and 104 the mock states. Test `AC-7 mock: each line of the roadmap-run mock-up` passes (10 running in both languages, and the 3/2/1 mix in both) and `AC-4 mock: ... empty bar` passes. The verifier checked that the expected lines held as constants in the test file are each present verbatim in a file of `openspec/changes/run-status-bar/mock/` (a node script comparing the test's constants with the mock files: the four `en` lines, the four `pt-BR` lines and the long-id line of `lone-change.md`, 9 found, 0 missing; the four roadmap lines of `roadmap-run.md`, 4 found, 0 missing). The conducting session's earlier real run of this worktree at its then stage `implementation` (`real-runs.log` R1, at `e4ebb2e`) printed `🛠️ run-status-bar · Implementation · ■■■■■■■■■■◆□□□□ · 11 of 15`, byte for byte the fourth line of `mock/lone-change.md`; at this head the stage has moved on (R1 above), so the live equality to a mock line is the earlier run's and the test's. Left to dogfood: the owner's look at the line in the app | pass |

### Real runs of the status line command

Each ran from `cd /Users/kauesantos/Documents/devkit/.claude/worktrees/run-status-bar`, with the folder named in `cwd`, and printed the text
quoted in the rows above. All exit 0, standard error empty, before and after captures equal.

| Run | Folder (as `cwd`) | `--lang` | Printed |
| --- | --- | --- | --- |
| R1 | this worktree | en | `🔍 run-status-bar · Demonstration · ■■■■■■■■■■■◆□□□ · 12 of 15` (62 columns) |
| R2 | this worktree | pt-BR | `🔍 run-status-bar · Demonstração · ■■■■■■■■■■■◆□□□ · 12 de 15` (61 columns) |
| R3 | root checkout on `main`, unrecorded session | en | nothing (0 bytes) |
| R4 | fixture `approval`, change `feat` | en | `🙋 📝 feat · Owner's approval · ■■■■■■■◆□□□□□ · 8 of 13 · your approval of the plan` (83 columns) |
| R5 | fixture `approval` | pt-BR | `🙋 📝 feat · Aprovação do dono · ■■■■■■■◆□□□□□ · 8 de 13 · a sua aprovação do plano` (83 columns) |
| R6 | fixture `budget` (cap 1000000, `transcript_path` named) | en | `🙋 📝 feat · Owner's approval · ■■■■■■■◆□□□□□ · 8 of 13 · your approval of the plan` (83 columns) |
| R7 | fixture `roadmap` (run file records the session) | en | `3 in play · 0 working · 🙋 3 waiting on the owner · ⛔ 0 blocked` (64 columns) |
| R8 | fixture `roadmap` | pt-BR | `3 em jogo · 0 em andamento · 🙋 3 aguardando o dono · ⛔ 0 bloqueadas` (69 columns) |

### Notes for the owner

- The `stdout columns (chars)` line in the conducting session's `real-runs.log` is a byte or character count from `wc -m`, not the display width
  (it printed 101 for a 97-column line). The widths in this file are display columns from the command's own `columns` export.
- The state listing of this repository (`change-loop.mjs state --offline --lang en`, run by the verifier in this worktree) exited 0 at this head, while
  D-12 expects it to exit 3 before `state-skips-unlocated`. The real count under the coordinator's message box is still unproven here and is left to
  the next roadmap run.
- Every criterion has a proof; the parts left to dogfood are named in its row.
- After this file was written, `python3 scripts/check.py` ran again with this file in the tree: exit 0, `all checks passed`.
