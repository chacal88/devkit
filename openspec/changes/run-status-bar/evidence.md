<!-- devkit-stage evidence result=passed attempt=2 commit=ec1b00bfb7f712f3446b35b98cc267e524bfeabe -->
Commit: ec1b00bfb7f712f3446b35b98cc267e524bfeabe

# Evidence

Change `run-status-bar`, verified at `ec1b00b` on branch `run-status-bar`. The tree was clean (`git status --short` printed
nothing before this file was written). Since the last evidence (at `752a3f2`): review round 1 failed on four important findings,
fixed in `792fde6` (the bar kills the process group of its state call; new tests of the real signal wiring, of the language
reaching the state call and of the `statusLine` snippet; the snippet now ends `[ -z "$f" ] || node ...`); `f4bad47` merged
`origin/main` `a347ac0` (release renumbered to devkit-openspec 0.40.0 and marketplace 0.45.0, E-3 pinned against 0.39.2);
`0528b85` made the new tests wait for processes to die; `ec1b00b` only adds a models table to the change's `.openspec.yaml`
(`git diff 0528b85 ec1b00b --stat`: 1 file changed, 5 insertions), so every file outside `openspec/changes/` is the one the
whole-suite run at `0528b85` saw. No defect found in the delivered behaviour. Nothing was fixed and nothing was committed.

Who ran what:

- **The whole-suite run was run by the conducting session** at `0528b85`, not by the verifier (the machine is shared). The verifier
  read its log, `/private/tmp/devkit-run-status-bar/suite-log-final.txt` (last written 12:02), and quotes it:
  `suite: 40 files, 3165 tests, 3165 pass, 0 fail, 898.8s, concurrency 14`, then `all checks passed`, then `exit=0`. The verifier
  counted 40 `^pass ` lines and 0 `^FAIL` lines in it. It holds one `pass` line for each of `flow-check` (278.1s),
  `change-state-stages` (95.4s), `change-loop-remote-state` (417.6s), `roadmap-loop` (466.2s), `roadmap-loop-upfront` (601.4s),
  `roadmap-loop-followups` (519.7s), `status-line` (76.2s), `change-loop` (558.2s), `change-loop-compozy` (644.8s),
  `deliver-check-cli` (502.9s) and `release-merge` (113.0s), all `.test.mjs` under `plugins/openspec/hooks/`.
- **The verifier ran live**, at `ec1b00b` with `TMPDIR=/private/tmp/devkit-run-status-bar GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main`,
  `--concurrency=2` added to the suite commands (the machine is shared) and no whole suite: the two suite parts of gate 2.5
  (logs `/private/tmp/devkit-run-status-bar/verify/g25a-2.log` and `g25b-2.log`), `python3 scripts/check.py`,
  `python3 scripts/gen-catalog.py --check`, the eight real runs of the status line command below (log
  `/private/tmp/claude-501/-Users-kauesantos-Documents-devkit--claude-worktrees-run-status-bar/4085ed07-8492-4c4b-8c10-f2febfdb8331/scratchpad/verify-runs-2.log`,
  from the conducting session's `real-runs.sh` in the same folder, fixtures under `/private/tmp/devkit-run-status-bar/real-fixtures/`)
  and one run of the README's `statusLine` command against a fake plugin cache (S1 and S2 below).

### Gates

The delivery train (`devkit.delivery.train` in `openspec/config.yaml`) is `node scripts/test-suite.mjs && python3 scripts/check.py`.
The part `python3 scripts/check.py` equals one of its parts, so its rows end in `train:` (docs/openspec-flow.md, "Gate parts proven by
the train"); the verifier also ran it live and the result is in the row. The suite part of the gates is written
`env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs ...`, which is not equal to the train's part, so
those rows are `pass` rows (the whole-suite run above, or the live run, as each row says). `python3 scripts/gen-catalog.py --check`
is not a train part and has a real `pass` row.

| Gate | Command | Result |
| --- | --- | --- |
| 1.7 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs plugins/openspec/hooks/flow-check.test.mjs plugins/openspec/hooks/change-state-stages.test.mjs plugins/openspec/hooks/change-loop-remote-state.test.mjs plugins/openspec/hooks/roadmap-loop.test.mjs plugins/openspec/hooks/roadmap-loop-upfront.test.mjs plugins/openspec/hooks/roadmap-loop-followups.test.mjs` | pass: not run again whole by the verifier; the one green whole-suite run at `0528b85` (`suite: 40 files, 3165 tests, 3165 pass, 0 fail`, exit 0) imports all six files and the log has a `pass` line for each, so it stands for this part (flow-check and change-state-stages also ran live in the 2.5 row below) |
| 1.7 | `python3 scripts/check.py` | train: proven by the train's part of the same text; the verifier also ran it live at `ec1b00b` with this file in the tree: exit 0, `all checks passed` |
| 2.5 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs plugins/openspec/hooks/status-line.test.mjs plugins/openspec/hooks/change-state-stages.test.mjs plugins/openspec/hooks/flow-check.test.mjs` | pass: run live with `--concurrency=2`, exit 0, `suite: 3 files, 341 tests, 341 pass, 0 fail, 99.7s, concurrency 2` (status-line 33.3s, change-state-stages 47.8s, flow-check 99.7s); the whole-suite run also passed all three |
| 2.5 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --test-name-pattern="^change-loop replies: " plugins/openspec/hooks/change-loop.test.mjs` | pass: run live with `--concurrency=2`, exit 0, `suite: 1 files, 4 tests, 4 pass, 0 fail, 0.1s, concurrency 2` (the whole-suite run also passed the whole `change-loop.test.mjs`, 558.2s) |
| 2.5 | `python3 scripts/check.py` | train: proven by the train's part of the same text; the live run at this head: exit 0, `all checks passed` |
| 3.4 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs` | pass: the conducting session's whole-suite run at `0528b85` (the same tree outside `openspec/changes/`), exit 0, `suite: 40 files, 3165 tests, 3165 pass, 0 fail, 898.8s, concurrency 14` (log named above); the verifier ran no whole suite |
| 3.4 | `python3 scripts/check.py` | train: proven by the train's part of the same text; the live run at this head with this file in the tree: exit 0, `all checks passed` |
| 3.4 | `python3 scripts/gen-catalog.py --check` | pass: run live at `ec1b00b`, exit 0, no output (the catalog is up to date) |

### Acceptance criteria

The command in every real run R1 to R8 is `node plugins/openspec/hooks/status-line.mjs --lang <l>` with the JSON of D-2 on standard input
(`session_id`, `workspace.current_dir`, `cwd`, and `transcript_path` in R6); every run exited 0 with an empty standard error. The
widths below are display columns, counted with the command's own `columns` export (an emoji takes two, the marks and `…` one); every
line is at most 100 columns. A line in a fixture repository comes from that fixture's own project (its flags decide `N`), so a fixture
line has the shape of the mock-up line, not its text.

| AC | Criterion | What was run, what it printed, and where the proof is | Result |
| --- | --- | --- | --- |
| AC-1 | `lone-change-bar`: a session that conducts a change at `approval` shows state icon, stage icon, id, stage title, strip, `n of N` and the reason; exit 0 | R4 (a fixture project with change `feat` at the plan approval, waiting for the owner, session id not recorded in any run file) printed `🙋 📝 feat · Owner's approval · ■■■■■■■◆□□□□□ · 8 of 13 · your approval of the plan`, 83 columns, exit 0: the elements of mock moment 3 in order (state icon, stage icon, id, title, 7 done marks, the current mark, 5 not-yet marks, place 8 of 13, reason in words). R1 in this worktree at its real stage today (`evidence`) printed `🔍 run-status-bar · Demonstration · ■■■■■■■■■■■◆□□□ · 12 of 15`, 62 columns: running, so no state icon and no reason. The way the owner turns it on: S1 ran the README's `statusLine` command by `sh -c` with `CLAUDE_CONFIG_DIR` naming a fake plugin cache holding 0.9.0, 0.39.2 and 0.40.0 (the last a link to this worktree's `plugins/openspec`): it started the 0.40.0 copy and printed `🔍 run-status-bar · Demonstração · ■■■■■■■■■■■◆□□□ · 12 de 15`, exit 0, empty standard error; S2 with an empty cache printed 0 bytes and exited 0. The tests `run-status-bar AC-1 line:`, `AC-1 strip:`, `AC-1 cut:`, `AC-1 choice:`, `AC-1 input:` and `AC-1 snippet: the README command starts the newest installed copy, and with none prints nothing and exits 0` in `plugins/openspec/hooks/status-line.test.mjs` pass (gate 2.5, 341 tests). Left to dogfood: the line under the message box in the owner's own session at a real plan approval (this change's approval moment is past, so the approval line is proven on the fixture and by the mock test) | pass |
| AC-2 | `no-budget`: with a `budget` cap set the line has no percentage, no mention of the budget, and no transcript is read | R6: a fixture project whose `openspec/config.yaml` holds `devkit:` and `budget: 1000000`, with `transcript_path` on the input set to `/nonexistent/transcript.jsonl`, printed `🙋 📝 feat · Owner's approval · ■■■■■■■◆□□□□□ · 8 of 13 · your approval of the plan`, exit 0, empty standard error: no `%`, no budget word, no error from the missing transcript; the line is the same as R4's, so the cap changed nothing. Test `run-status-bar AC-2 budget:` (cap in the config and a real transcript file on the input, both languages, both views) passes, and the test `AC-5 read-only: the source writes nothing, spawns only node and git, and never reads a transcript or a cap` passes | pass |
| AC-3 | `roadmap-counts`: the coordinator of a run whose listing holds six changes (3 running, 2 waiting, 1 blocked) shows those counts, no strip, no percentage | Proven on a fixture, not on the repository's own listing. R7 (a fixture repository with three changes waiting on the owner and a run file recording the input's session `S-coordinator`) printed `3 in play · 0 working · 🙋 3 waiting on the owner · ⛔ 0 blocked`, 64 columns, exit 0, no strip, no `%`. The 3/2/1 mix itself is proven by the tests `run-status-bar AC-3 counts: the mix of the criterion` (`6 in play · 3 working · 🙋 2 waiting on the owner · ⛔ 1 blocked`) and `AC-7 mock: ... roadmap-run mock-up`, which pass; no real run with exactly that mix was made, since no real listing holds it. The count of this repository's own roadmap run is left to dogfood, after `state-skips-unlocated` (the plan says so in D-12); the verifier did not read the run file of the root checkout to find its session | pass |
| AC-4 | `nothing-conducted`: with no change conducted and no run the bar prints nothing and exits 0 | R3: `cwd` set to the root checkout `/Users/kauesantos/Documents/devkit` (branch `main`, no change's worktree) with session id `S-unrecorded-session`: exit 0, standard output empty (`wc -c` printed 0 bytes with `--lang en` and with `--lang pt-BR`, so not even a newline, exit 0 and 0 bytes of standard error each), matching `mock/nothing-conducted.md` (an empty bar). Test `run-status-bar AC-4 mock: a session that conducts nothing prints the empty bar of the mock-up` and the `AC-4 choice:` tests pass | pass |
| AC-5 | `read-only`: `git status`, the run file and the worktree list are as they were, no AI, no `devkit-run:` or `devkit-end:` line | In all eight real runs and in S1 the capture before the run and after it was equal: `git status --short --untracked-files=all` (empty in this worktree and in the fixtures; 6 lines in the root checkout for R3, files of other work, the same before and after), the SHA-256 of `<git common dir>/devkit/roadmap-run.json` (R1 to R3 and S1 on the repository's own run file: `b5fe2a11` to `28235c27` before and after; R7 and R8 on the fixture's: `a92e26a4` to `c1a8e211`; R4 to R6: no run file), and `git worktree list` (23 lines in this repository, 1 in each fixture). The run log holds 0 lines with `devkit-run:` or `devkit-end:`. The tests `AC-5 read-only: the source writes nothing, spawns only node and git, and never reads a transcript or a cap` and `AC-5 read-only: git status, the run file and the worktree list are as they were, and no loop marker is printed` pass. The review's finding on the state call is covered: `AC-5 failure: a state that passes the bound is killed ...`, `AC-5 failure: the bound and an abort also end the processes the state call started` and `AC-5 failure: SIGTERM, SIGINT and SIGHUP end the real bar and the real openspec its state is waiting on` pass (gate 2.5) | pass |
| AC-6 | `person-language`: with `--lang pt-BR` the words are in Brazilian Portuguese; state, stage and counts are those of `--lang en` | R1 against R2 in this worktree: `🔍 run-status-bar · Demonstration · ... · 12 of 15` and `🔍 run-status-bar · Demonstração · ■■■■■■■■■■■◆□□□ · 12 de 15`; R4 against R5 at the plan approval: `... 8 of 13 · your approval of the plan` and `🙋 📝 feat · Aprovação do dono · ■■■■■■■◆□□□□□ · 8 de 13 · a sua aprovação do plano`; R7 against R8: `3 in play · 0 working · 🙋 3 waiting on the owner · ⛔ 0 blocked` and `3 em jogo · 0 em andamento · 🙋 3 aguardando o dono · ⛔ 0 bloqueadas`. Icons, id, strip, place and counts are equal in each pair; the stage title, `of`/`de`, the reason and the count words change. Tests `run-status-bar AC-6 language:` pass, the new one among them (`the language reaches the state call of the coordinator and of a change worktree`: `--lang pt-BR` for both views). Left to dogfood: the owner's own language setting | pass |
| AC-7 | `mock-matches`: the line printed for each example of the approved mock-up is the one the mock shows, element by element | Test `run-status-bar AC-7 mock: each line of the lone-change mock-up, in both languages and with the long id` passes (moments 1 to 4 in `en` and `pt-BR`, the 100-column cut of the long id, and the widths the mock states), `AC-7 mock: each line of the roadmap-run mock-up` passes and `AC-4 mock: ... empty bar` passes; those test constants were checked verbatim against `openspec/changes/run-status-bar/mock/` in the previous evidence, and `git diff 752a3f2 HEAD` changes no line of `mock/` and no expected-line constant of the mock tests (the lines the test file's diff removes are helper and wait lines of the process tests). The conducting session's earlier real run at the stage `implementation` printed byte for byte the fourth line of `mock/lone-change.md`; at this head the stage is `evidence` (R1). Left to dogfood: the owner's look at the line in the app | pass |

### Real runs of the status line command

R1 to R8 ran from `cd /Users/kauesantos/Documents/devkit/.claude/worktrees/run-status-bar`, with the folder named in `cwd`. S1 and S2
ran the `command` of the README's `statusLine` JSON block (parsed from `plugins/openspec/README.md`) through `sh -c`, with the same
JSON input as R1 and `CLAUDE_CONFIG_DIR` naming a fake config folder in the verifier's scratch folder. All exit 0, standard error
empty, before and after captures equal.

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
| S1 | this worktree, README command, cache with 0.9.0, 0.39.2 and 0.40.0 | pt-BR (the snippet's) | `🔍 run-status-bar · Demonstração · ■■■■■■■■■■■◆□□□ · 12 de 15` (the 0.40.0 copy; the two older copies print `OLD COPY ...`, which did not show) |
| S2 | this worktree, README command, empty cache | pt-BR (the snippet's) | nothing (0 bytes) |

### Notes for the owner

- The whole-suite run at `f4bad47` (the merge, before `0528b85`) had 7 failures, log `/private/tmp/devkit-run-status-bar/suite-log-head2.txt`
  (`suite: 40 files, 3165 tests, 3158 pass, 7 fail, 1287.5s`, exit 1): 2 in `conduct-check.test.mjs` and 2 in `deliver-check-cli.test.mjs`
  (`--watch` timing tests), and 3 in `status-line.test.mjs` (the new process-group test, which checked once whether the processes had
  died; `0528b85` makes it wait). The two load-sensitive files then passed alone, log `/private/tmp/devkit-run-status-bar/watchfiles.log`
  (`suite: 2 files, 207 tests, 207 pass, 0 fail, 364.7s`, exit 0), and the whole suite passed at `0528b85` (the gate rows above).
- The `statusLine` entry in `design.md` D-1 still ends `[ -n "$f" ] && node "$f" --lang pt-BR`, while the README and `docs/openspec-flow.md`
  now end `[ -z "$f" ] || node "$f" --lang pt-BR` (the review-round-1 fix, so that the command exits 0 with no installed copy, as both
  documents say). The check of task 2.4 ("the entry in both files is the same text as in `design.md` D-1") no longer holds as written;
  the delivered text is the one S1, S2 and the snippet test prove.
- The local `origin/main` ref (fetched 11:45, not by the verifier) is at `49d865f`, which is not merged into this branch and already
  ships devkit-openspec 0.40.0 and marketplace 0.45.0 (`## 0.45.0 — the archive check lets the release pin lines pass unnamed`), the
  same numbers this branch's release takes. The next merge of `origin/main`, or the train's renumbering, moves this change's release
  numbers, the doc's pins and E-3, and stales this evidence.
- The state listing of this repository is still unproven under the coordinator's message box; the real count is left to the next roadmap run
  (D-12, after `state-skips-unlocated`).
- Every criterion has a proof; the parts left to dogfood are named in its row.
- `python3 scripts/check.py` ran with this file in the tree: exit 0, `all checks passed`.
