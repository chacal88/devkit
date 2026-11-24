<!-- devkit-stage evidence result=passed attempt=3 commit=83650a590e3bb0bdc8a3e2fe95d5c50dfa6e515f -->
Commit: 83650a590e3bb0bdc8a3e2fe95d5c50dfa6e515f

# Evidence

Change `run-status-bar`, verified at `83650a5` on branch `run-status-bar`. The tree was clean (`git status --short` printed
nothing before this file was written). Since the last evidence (at `ec1b00b`): `3a53ac9` and `009b455` touch only the change's
folder (that evidence, the design's review fixes, review round 2 passed); `aa8a685` merged `origin/main` `d917ae0` (trains 4, 5
and 6; 73 commits, 106 files, none in this change's folder), so the release is now devkit-openspec 0.43.0 and marketplace 0.48.0
(`plugin.json` and `marketplace.json` both read `0.43.0`, the marketplace `0.48.0`, `CHANGELOG.md` has `## 0.48.0 — a status line
for the session of a change or a roadmap run`); `change-loop-compozy.test.mjs` is `main`'s file (`git diff --quiet d917ae0 HEAD --
plugins/openspec/hooks/change-loop-compozy.test.mjs` exits 0, ADR 0030; E-3 superseded); `83650a5` changes only `design.md` and
`tasks.md` of this change. `git diff --stat ec1b00b HEAD` changes no line of `status-line.mjs`, `status-line.test.mjs`,
`change-state-stages.test.mjs`, `mock/` or `proposal.md`; in `change-loop.mjs` the merge adds `merge-check` to `USAGE` beside this
change's `state [--change <id>] [--offline]`. No defect found in the delivered behaviour. Nothing was fixed and nothing was committed.

Who ran what:

- **The verifier ran live**, at `83650a5` with `TMPDIR=/private/tmp/devkit-run-status-bar` and `--concurrency=2` added to the suite
  commands (the owner's Mac is shared): the suite part of gate 1.7 (log `/private/tmp/devkit-run-status-bar/verify/g17a-3.log`),
  the two suite parts of gate 2.5 (logs `g25a-3.log` and `g25b-3.log` in the same folder), `python3 scripts/check.py`,
  `python3 scripts/gen-catalog.py --check`, the eight real runs of the status line command below (log
  `/private/tmp/claude-501/-Users-kauesantos-Documents-devkit--claude-worktrees-run-status-bar/4085ed07-8492-4c4b-8c10-f2febfdb8331/scratchpad/verify-runs-3.log`,
  from the conducting session's `real-runs.sh` in the same folder, fixtures under `/private/tmp/devkit-run-status-bar/real-fixtures/`)
  and the README's `statusLine` command against a fake plugin cache (S1 and S2 below).
- **The conducting session ran**, at the merge head, seven touched test files with `--concurrency=2` (change-loop-compozy,
  change-loop, change-loop-remote-state, change-state-stages, status-line, deliver-check-cli, release-merge). The verifier read its
  log, `/private/tmp/claude-501/-Users-kauesantos-Documents-devkit--claude-worktrees-run-status-bar/4085ed07-8492-4c4b-8c10-f2febfdb8331/scratchpad/suite.txt`,
  and quotes it: `suite: 7 files, 935 tests, 935 pass, 0 fail, 1008.7s, concurrency 2`, then `exit=0`, with a `pass` line for each
  of the seven files. That log was last written at 12:38:49, 31 seconds before the merge commit `aa8a685` was made (12:39:20), so it
  ran on the resolved merge in the working tree; the verifier cannot tell from the log alone that the tree was byte for byte
  `aa8a685`, and `83650a5` changes no file outside this change's folder.
- **Nobody ran the whole suite at this head.** The last whole-suite run was at `0528b85`, before the merge of `d917ae0`
  (`suite: 40 files, 3165 tests, 3165 pass, 0 fail`, log `/private/tmp/devkit-run-status-bar/suite-log-final.txt`); the merge brought
  106 files, so it does not stand for this head. By the coordinating session's instruction the verifier ran no whole suite here: in
  this repository the delivery train (`devkit.delivery.train` in `openspec/config.yaml`, `node scripts/test-suite.mjs && python3
  scripts/check.py`) runs the whole suite once on the joined heads before anything merges.

### Gates

The train's parts are `node scripts/test-suite.mjs` and `python3 scripts/check.py`. The part `python3 scripts/check.py` equals one of
them, so its rows end in `train:` (docs/openspec-flow.md, "Gate parts proven by the train"); the verifier also ran it live and the
result is in the row. The suite parts of 1.7 and 2.5 are written `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node
scripts/test-suite.mjs ...`, which is not equal to the train's part, so those rows are `pass` rows of live runs at this head. The
suite part of 3.4, as `tasks.md` reads after the conducting session's amendment (uncommitted at this verification, inside
`openspec/`), is `node scripts/test-suite.mjs`, the train's own part, so its row is a `train:` row. `python3 scripts/gen-catalog.py
--check` is not a train part and has a real `pass` row.

| Gate | Command | Result |
| --- | --- | --- |
| 1.7 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs plugins/openspec/hooks/flow-check.test.mjs plugins/openspec/hooks/change-state-stages.test.mjs plugins/openspec/hooks/change-loop-remote-state.test.mjs plugins/openspec/hooks/roadmap-loop.test.mjs plugins/openspec/hooks/roadmap-loop-upfront.test.mjs plugins/openspec/hooks/roadmap-loop-followups.test.mjs` | pass: run live at `83650a5` with `--concurrency=2`, exit 0, `suite: 6 files, 693 tests, 693 pass, 0 fail, 685.4s, concurrency 2` (flow-check 136.7s, change-state-stages 58.7s, change-loop-remote-state 210.2s, roadmap-loop 272.0s, roadmap-loop-upfront 338.5s, roadmap-loop-followups 289.8s) |
| 1.7 | `python3 scripts/check.py` | train: proven by the train's part of the same text; the verifier also ran it live at `83650a5` with this file in the tree: exit 0, `all checks passed` |
| 2.5 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs plugins/openspec/hooks/status-line.test.mjs plugins/openspec/hooks/change-state-stages.test.mjs plugins/openspec/hooks/flow-check.test.mjs` | pass: run live at `83650a5` with `--concurrency=2`, exit 0, `suite: 3 files, 341 tests, 341 pass, 0 fail, 115.5s, concurrency 2` (status-line 31.1s, change-state-stages 54.0s, flow-check 115.5s) |
| 2.5 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --test-name-pattern="^change-loop replies: " plugins/openspec/hooks/change-loop.test.mjs` | pass: run live at `83650a5` with `--concurrency=2`, exit 0, `suite: 1 files, 4 tests, 4 pass, 0 fail, 0.3s, concurrency 2` (the conducting session's seven-file run also passed the whole `change-loop.test.mjs` at the merge head) |
| 2.5 | `python3 scripts/check.py` | train: proven by the train's part of the same text; the live run at this head: exit 0, `all checks passed` |
| 3.4 | `node scripts/test-suite.mjs` | train: proven by the train's part of the same text, which runs the whole suite once on the joined heads before anything merges; the verifier ran no whole suite at `83650a5` (the coordinating session's instruction on the shared machine); the last whole-suite run, with the CI branch variables set, was at `0528b85` before the merge of `d917ae0` (3165 of 3165) and does not stand for this head; at this head the 1.7 and 2.5 parts above and the conducting session's seven-file run (935 of 935) passed, 11 distinct test files in all |
| 3.4 | `python3 scripts/check.py` | train: proven by the train's part of the same text; the live run at this head with this file in the tree: exit 0, `all checks passed` |
| 3.4 | `python3 scripts/gen-catalog.py --check` | pass: run live at `83650a5`, exit 0, no output (the catalog is up to date) |

### Acceptance criteria

The command in every real run R1 to R8 is `node plugins/openspec/hooks/status-line.mjs --lang <l>` with the JSON of D-2 on standard input
(`session_id`, `workspace.current_dir`, `cwd`, and `transcript_path` in R6); every run exited 0 with an empty standard error. The
widths below are display columns, counted with the command's own `columns` export (an emoji takes two, the marks and `…` one); every
line is at most 100 columns. A line in a fixture repository comes from that fixture's own project (its flags decide `N`), so a fixture
line has the shape of the mock-up line, not its text.

| AC | Criterion | What was run, what it printed, and where the proof is | Result |
| --- | --- | --- | --- |
| AC-1 | `lone-change-bar`: a session that conducts a change at `approval` shows state icon, stage icon, id, stage title, strip, `n of N` and the reason; exit 0 | R4 (a fixture project with change `feat` at the plan approval, waiting for the owner, session id not recorded in any run file) printed `🙋 📝 feat · Owner's approval · ■■■■■■■◆□□□□□ · 8 of 13 · your approval of the plan`, 83 columns, exit 0: the elements of mock moment 3 in order (state icon, stage icon, id, title, 7 done marks, the current mark, 5 not-yet marks, place 8 of 13, reason in words). R1 in this worktree at its real stage today (`evidence`) printed `🔍 run-status-bar · Demonstration · ■■■■■■■■■■■◆□□□ · 12 of 15`, 62 columns: running, so no state icon and no reason. The way the owner turns it on: S1 ran the README's `statusLine` command by `sh -c` with `CLAUDE_CONFIG_DIR` naming a fake plugin cache holding 0.9.0, 0.39.2, 0.42.0 and 0.43.0 (the last a link to this worktree's `plugins/openspec`): it started the 0.43.0 copy and printed `🔍 run-status-bar · Demonstração · ■■■■■■■■■■■◆□□□ · 12 de 15`, exit 0, empty standard error; S2 with an empty cache printed 0 bytes and exited 0. The tests `run-status-bar AC-1 line:`, `AC-1 strip:`, `AC-1 cut:`, `AC-1 choice:`, `AC-1 input:` and `AC-1 snippet: the README command starts the newest installed copy, and with none prints nothing and exits 0` in `plugins/openspec/hooks/status-line.test.mjs` pass (gate 2.5 at this head). Left to dogfood: the line under the message box in the owner's own session at a real plan approval (this change's approval moment is past, so the approval line is proven on the fixture and by the mock test) | pass |
| AC-2 | `no-budget`: with a `budget` cap set the line has no percentage, no mention of the budget, and no transcript is read | R6: a fixture project whose `openspec/config.yaml` holds `devkit:` and `budget: 1000000`, with `transcript_path` on the input set to `/nonexistent/transcript.jsonl`, printed `🙋 📝 feat · Owner's approval · ■■■■■■■◆□□□□□ · 8 of 13 · your approval of the plan`, exit 0, empty standard error: no `%`, no budget word, no error from the missing transcript; the line is the same as R4's, so the cap changed nothing. Test `run-status-bar AC-2 budget:` (cap in the config and a real transcript file on the input, both languages, both views) passes, and the test `AC-5 read-only: the source writes nothing, spawns only node and git, and never reads a transcript or a cap` passes (gate 2.5 at this head) | pass |
| AC-3 | `roadmap-counts`: the coordinator of a run whose listing holds six changes (3 running, 2 waiting, 1 blocked) shows those counts, no strip, no percentage | Proven on a fixture, not on the repository's own listing. R7 (a fixture repository with three changes waiting on the owner and a run file recording the input's session `S-coordinator`) printed `3 in play · 0 working · 🙋 3 waiting on the owner · ⛔ 0 blocked`, 64 columns, exit 0, no strip, no `%`. The 3/2/1 mix itself is proven by the tests `run-status-bar AC-3 counts: the mix of the criterion` (`6 in play · 3 working · 🙋 2 waiting on the owner · ⛔ 1 blocked`) and `AC-7 mock: ... roadmap-run mock-up`, which pass at this head; no real run with exactly that mix was made, since no real listing holds it. The count of this repository's own roadmap run is left to dogfood, after `state-skips-unlocated` (D-12); the verifier did not read the run file of the root checkout to find its session | pass |
| AC-4 | `nothing-conducted`: with no change conducted and no run the bar prints nothing and exits 0 | R3: `cwd` set to the root checkout `/Users/kauesantos/Documents/devkit` (branch `main`, no change's worktree) with session id `S-unrecorded-session`: exit 0, standard output empty (0 bytes with `--lang en` in the run log, and 0 bytes with `--lang pt-BR` in a second run, exit 0 and 0 bytes of standard error each, so not even a newline), matching `mock/nothing-conducted.md` (an empty bar). Test `run-status-bar AC-4 mock: a session that conducts nothing prints the empty bar of the mock-up` and the `AC-4 choice:` tests pass | pass |
| AC-5 | `read-only`: `git status`, the run file and the worktree list are as they were, no AI, no `devkit-run:` or `devkit-end:` line | In all eight real runs and in S1 the capture before the run and after it was equal: `git status --short --untracked-files=all` (empty in this worktree and in the fixtures; 6 lines in the root checkout for R3, files of other work, the same before and after), the SHA-256 of `<git common dir>/devkit/roadmap-run.json` (R1 to R3 and S1 on the repository's own run file: `b5fe2a11` to `28235c27` before and after; R7 and R8 on the fixture's: `a92e26a4` to `c1a8e211`; R4 to R6: no run file), and `git worktree list` (23 lines in this repository, 1 in each fixture). The run log holds 0 lines with `devkit-run:` or `devkit-end:`. The tests `AC-5 read-only: the source writes nothing, spawns only node and git, and never reads a transcript or a cap`, `AC-5 read-only: git status, the run file and the worktree list are as they were, and no loop marker is printed` and the six `AC-5 failure:` tests (state exits 3, state prints no listing, the bound kills the state, an abort ends it, the bound and an abort end the processes the state call started, and SIGTERM, SIGINT and SIGHUP end the real bar and the real `openspec` its state waits on) pass (gate 2.5 at this head) | pass |
| AC-6 | `person-language`: with `--lang pt-BR` the words are in Brazilian Portuguese; state, stage and counts are those of `--lang en` | R1 against R2 in this worktree: `🔍 run-status-bar · Demonstration · ... · 12 of 15` and `🔍 run-status-bar · Demonstração · ■■■■■■■■■■■◆□□□ · 12 de 15`; R4 against R5 at the plan approval: `... 8 of 13 · your approval of the plan` and `🙋 📝 feat · Aprovação do dono · ■■■■■■■◆□□□□□ · 8 de 13 · a sua aprovação do plano`; R7 against R8: `3 in play · 0 working · 🙋 3 waiting on the owner · ⛔ 0 blocked` and `3 em jogo · 0 em andamento · 🙋 3 aguardando o dono · ⛔ 0 bloqueadas`. Icons, id, strip, place and counts are equal in each pair; the stage title, `of`/`de`, the reason and the count words change. The three `run-status-bar AC-6 language:` tests pass at this head, `the language reaches the state call of the coordinator and of a change worktree` among them. Left to dogfood: the owner's own language setting | pass |
| AC-7 | `mock-matches`: the line printed for each example of the approved mock-up is the one the mock shows, element by element | Test `run-status-bar AC-7 mock: each line of the lone-change mock-up, in both languages and with the long id` passes (moments 1 to 4 in `en` and `pt-BR`, the 100-column cut of the long id, and the widths the mock states), `AC-7 mock: each line of the roadmap-run mock-up` passes and `AC-4 mock: ... empty bar` passes, all at this head; those test constants were checked verbatim against `openspec/changes/run-status-bar/mock/` in an earlier evidence, and `git diff --stat ec1b00b HEAD` changes neither `mock/` nor `status-line.test.mjs`. At this head the stage is `evidence` (R1, `12 of 15`). Left to dogfood: the owner's look at the line in the app | pass |

### Real runs of the status line command

R1 to R8 ran from `cd /Users/kauesantos/Documents/devkit/.claude/worktrees/run-status-bar`, with the folder named in `cwd`. S1 and S2
ran the `command` of the README's `statusLine` JSON block (parsed from `plugins/openspec/README.md`; the same text as in
`docs/openspec-flow.md` and `design.md` D-1, each ending `[ -z "$f" ] || node "$f" --lang pt-BR`) through `sh -c`, with the same JSON
input as R2 and `CLAUDE_CONFIG_DIR` naming a fake config folder in the verifier's scratch folder (`fake-config-3`, `empty-config-3`).
All exit 0, standard error empty, before and after captures equal.

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
| S1 | this worktree, README command, cache with 0.9.0, 0.39.2, 0.42.0 and 0.43.0 | pt-BR (the snippet's) | `🔍 run-status-bar · Demonstração · ■■■■■■■■■■■◆□□□ · 12 de 15` (the 0.43.0 copy; the three older copies print `OLD COPY ...`, which did not show) |
| S2 | this worktree, README command, empty cache | pt-BR (the snippet's) | nothing (0 bytes) |

### Notes for the owner

- Nobody ran the whole suite at this head. The conducting session amended gate 3.4 of `tasks.md` (uncommitted, under the
  coordinator's delegation) from `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs && ...` to
  `node scripts/test-suite.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check`, so its suite part equals the
  train's. The whole suite at the merged head is proven by the delivery train, which runs `node scripts/test-suite.mjs` once on the
  joined heads before anything merges; the train's run does not set the CI branch variables, whose last whole-suite run was at
  `0528b85`.
- The note of the previous evidence on D-1 is resolved: `design.md` D-1 now ends `[ -z "$f" ] || node "$f" --lang pt-BR`, the same
  text as the README and `docs/openspec-flow.md`.
- The state listing of this repository is still unproven under the coordinator's message box; the real count is left to the next roadmap run
  (D-12, after `state-skips-unlocated`).
- Every criterion has a proof; the parts left to dogfood are named in its row.
- `python3 scripts/check.py` ran with this file in the tree: exit 0, `all checks passed`.
