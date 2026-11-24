<!-- devkit-stage evidence result=passed attempt=6 commit=41caadc6d0afb3d05d783ffd1be249c6b989bb90 -->
Commit: 41caadc6d0afb3d05d783ffd1be249c6b989bb90

# Evidence

Change `run-status-bar`, verified at `41caadc` on branch `run-status-bar`. The tree was clean (`git status --short` printed
nothing before this file was written). Since the last evidence (at `0983bd2`, committed in `b892d4f`): `e14e1fa` merges `origin/main`
`74f2444` (trains 10 and 11): the release moves to devkit-openspec 0.46.0 and marketplace 0.51.0 (`plugin.json` and
`marketplace.json` read 0.46.0, the marketplace's own version 0.51.0, `CHANGELOG.md` starts with `## 0.51.0`, and the doc's pins in
`docs/openspec-flow.md` lines 741, 742 and 755 read `v0.46.0`); `plugins/openspec/hooks/change-loop.mjs` keeps `main`'s base fetch
and this change's `stages` parameter of `nextAction`, and `state` passes no `fetchBase` (only `next` and `wait` do), so the bar's
`state` call still fetches nothing; `main` also brings changes to `change-loop.test.mjs`, `change-loop-fixtures.mjs`,
`roadmap-loop.mjs`, `roadmap-loop.test.mjs`, `test-fixtures.mjs`, `conduct-check.test.mjs` and `deliver-check.mjs`. `41caadc` changes
only `design.md` and `tasks.md` (the owner's decision on the known limit of AC-3 and the release above `main`). `git diff --quiet
74f2444 HEAD -- plugins/openspec/hooks/change-loop-compozy.test.mjs` exits 0. No defect against the plan's criteria was found. Nothing
was fixed and nothing was committed.

Who ran what:

- **The verifier ran live**, at `41caadc` with `TMPDIR=/private/tmp/devkit-run-status-bar` and `--concurrency=2` added to the suite
  commands (the owner's Mac is shared): the suite part of gate 1.7 (log `/private/tmp/devkit-run-status-bar/verify/g17a-6.log`),
  the two suite parts of gate 2.5 (logs `g25a-6.log` and `g25b-6.log` in the same folder), `python3 scripts/check.py`,
  `python3 scripts/gen-catalog.py --check`, the eight real runs R1 to R8 below (log
  `/private/tmp/claude-501/-Users-kauesantos-Documents-devkit--claude-worktrees-run-status-bar/4085ed07-8492-4c4b-8c10-f2febfdb8331/scratchpad/verify-runs-6.log`,
  from the conducting session's `real-runs.sh` in the same folder, fixtures under `/private/tmp/devkit-run-status-bar/real-fixtures/`),
  the README's `statusLine` command against a fake plugin cache (S1 and S2, the command in `snippet-6.sh` in the same scratch folder,
  outputs `s-fake-6.out` and `s-empty-6.out`), and the real runs F1 to F7 of the offline fix on the S-9b fixture (log `fix-run-6.log`
  in the same scratch folder, from `fix-run.mjs` there). Every live run had `GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main` set.
- **The verifier's measurement on this repository's own roadmap run (C1 to C4 below) is kept from `0983bd2`**, as the coordinating
  session asked; it was not re-run at this head. The merge `e14e1fa` changed `change-loop.mjs`, but not the path `state` takes: the
  base fetch it brings is passed only by `next` and `wait`.
- **The conducting session ran**, after the merge `e14e1fa`, change-loop, change-loop-remote-state, change-state-stages, status-line,
  version-pin and roadmap-loop with `--concurrency=2`; the verifier read its log
  (`/private/tmp/claude-501/-Users-kauesantos-Documents-devkit--claude-worktrees-run-status-bar/4085ed07-8492-4c4b-8c10-f2febfdb8331/scratchpad/suite.log`,
  last written 16:20): `suite: 6 files, 838 tests, 838 pass, 0 fail, 527.8s, concurrency 2`, every file `pass` (change-loop 380.4s,
  change-loop-remote-state 201.4s, change-state-stages 52.9s, roadmap-loop 273.5s, status-line 23.7s, version-pin 71.2s; the per-file
  test counts 201, 240, 22, 115, 184 and 76 are the conducting session's report, the log's total is the verifier's reading). It also
  reports the merge check green with 0 reds, and `check.py` and `gen-catalog --check` green after the merge. `git diff --stat e14e1fa
  HEAD` touches only `design.md` and `tasks.md`, so that run stands for this head's `plugins/`.
- **Nobody ran the whole suite at this head.** By the coordinating session's instruction the verifier ran no whole suite here: in
  this repository the delivery train (`devkit.delivery.train` in `openspec/config.yaml`, `node scripts/test-suite.mjs && python3
  scripts/check.py`) runs the whole suite once on the joined heads before anything merges.

### Gates

The train's parts are `node scripts/test-suite.mjs` and `python3 scripts/check.py`. The part `python3 scripts/check.py` equals one of
them, so its rows end in `train:` (docs/openspec-flow.md, "Gate parts proven by the train"); the verifier also ran it live and the
result is in the row. The suite parts of 1.7 and 2.5 are written `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node
scripts/test-suite.mjs ...`, which is not equal to the train's part, so those rows are `pass` rows of live runs at this head. The
suite part of 3.4 is `node scripts/test-suite.mjs`, the train's own part, so its row is a `train:` row. `python3
scripts/gen-catalog.py --check` is not a train part and has a real `pass` row.

| Gate | Command | Result |
| --- | --- | --- |
| 1.7 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs plugins/openspec/hooks/flow-check.test.mjs plugins/openspec/hooks/change-state-stages.test.mjs plugins/openspec/hooks/change-loop-remote-state.test.mjs plugins/openspec/hooks/roadmap-loop.test.mjs plugins/openspec/hooks/roadmap-loop-upfront.test.mjs plugins/openspec/hooks/roadmap-loop-followups.test.mjs` | pass: run live at `41caadc` with `--concurrency=2`, exit 0, `suite: 6 files, 762 tests, 762 pass, 0 fail, 643.8s, concurrency 2` (flow-check 106.6s, change-state-stages 49.8s, change-loop-remote-state 184.3s, roadmap-loop 266.2s, roadmap-loop-upfront 271.0s, roadmap-loop-followups 209.7s); S-9b and E-6 (`unlocated 1: state lists an unplaced change blocked and every other change as before`) among the passing tests |
| 1.7 | `python3 scripts/check.py` | train: proven by the train's part of the same text; the verifier also ran it live at `41caadc` with this file in the tree: exit 0, `all checks passed` |
| 2.5 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs plugins/openspec/hooks/status-line.test.mjs plugins/openspec/hooks/change-state-stages.test.mjs plugins/openspec/hooks/flow-check.test.mjs` | pass: run live at `41caadc` with `--concurrency=2`, exit 0, `suite: 3 files, 360 tests, 360 pass, 0 fail, 107.3s, concurrency 2` (status-line 27.7s, change-state-stages 54.5s, flow-check 107.3s); 71 `run-status-bar AC-` tests pass, S-9b (`run-status-bar AC-3 offline: at the code review of a merge-mode change --offline reads waiting-on-github, silent; online a failed setup read stays blocked`) and every test named in the criteria below among them |
| 2.5 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --test-name-pattern="^change-loop replies: " plugins/openspec/hooks/change-loop.test.mjs` | pass: run live at `41caadc` with `--concurrency=2`, exit 0, `suite: 1 files, 4 tests, 4 pass, 0 fail, 0.1s, concurrency 2`, `change-loop replies: no internal term in either language` among them (the conducting session's run of the whole `change-loop.test.mjs` after the merge passed, in its 838 of 838) |
| 2.5 | `python3 scripts/check.py` | train: proven by the train's part of the same text; the live run at this head: exit 0, `all checks passed` |
| 3.4 | `node scripts/test-suite.mjs` | train: proven by the train's part of the same text, which runs the whole suite once on the joined heads before anything merges; the verifier ran no whole suite at `41caadc` (the coordinating session's instruction on the shared machine); the last whole-suite run, with the CI branch variables set, was at `0528b85` and does not stand for this head; at this head the 1.7 and 2.5 parts above passed live, and at this head's `plugins/` the conducting session's run after the merge passed 838 of 838 over six files |
| 3.4 | `python3 scripts/check.py` | train: proven by the train's part of the same text; the live run at this head with this file in the tree: exit 0, `all checks passed` |
| 3.4 | `python3 scripts/gen-catalog.py --check` | pass: run live at `41caadc`, exit 0, no output (the catalog is up to date) |

### Acceptance criteria

The command in every real run R1 to R8 is `node plugins/openspec/hooks/status-line.mjs --lang <l>` with the JSON of D-2 on standard input
(`session_id`, `workspace.current_dir`, `cwd`, and `transcript_path` in R6); every run exited 0 with an empty standard error. The
widths below are display columns, counted with the command's own `columns` export (an emoji takes two, the marks and `…` one); every
line is at most 100 columns. A line in a fixture repository comes from that fixture's own project (its flags decide `N`), so a fixture
line has the shape of the mock-up line, not its text.

| AC | Criterion | What was run, what it printed, and where the proof is | Result |
| --- | --- | --- | --- |
| AC-1 | `lone-change-bar`: a session that conducts a change at `approval` shows state icon, stage icon, id, stage title, strip, `n of N` and the reason; exit 0 | R4 (a fixture project with change `feat` at the plan approval, waiting for the owner, session id not recorded in any run file) printed `🙋 📝 feat · Owner's approval · ■■■■■■■◆□□□□□ · 8 of 13 · your approval of the plan`, 83 columns, exit 0: the elements of mock moment 3 in order (state icon, stage icon, id, title, 7 done marks, the current mark, 5 not-yet marks, place 8 of 13, reason in words). R1 in this worktree at its real stage today (`evidence`) printed `🔍 run-status-bar · Demonstration · ■■■■■■■■■■■◆□□□ · 12 of 15`, 62 columns: running, so no state icon and no reason. The way the owner turns it on: S1 ran the README's `statusLine` command by `sh -c` with `CLAUDE_CONFIG_DIR` naming a fake plugin cache holding 0.9.0, 0.39.2, 0.45.0 and 0.46.0 (the last a link to this worktree's `plugins/openspec`, whose `plugin.json` reads 0.46.0; the three others print `OLD COPY <version>`): it started the 0.46.0 copy and printed `🔍 run-status-bar · Demonstração · ■■■■■■■■■■■◆□□□ · 12 de 15`, exit 0, empty standard error; S2 with an empty cache printed 0 bytes and exited 0. The tests `run-status-bar AC-1 line:`, `AC-1 strip:`, `AC-1 cut:`, `AC-1 choice:`, `AC-1 input:` and `AC-1 snippet: the README command starts the newest installed copy, and with none prints nothing and exits 0` in `plugins/openspec/hooks/status-line.test.mjs` pass (gate 2.5 at this head). Left to dogfood: the line under the message box in the owner's own session at a real plan approval (this change's approval moment is past, so the approval line is proven on the fixture and by the mock test) | pass |
| AC-2 | `no-budget`: with a `budget` cap set the line has no percentage, no mention of the budget, and no transcript is read | R6: a fixture project whose `openspec/config.yaml` holds `devkit:` and `budget: 1000000`, with `transcript_path` on the input set to `/nonexistent/transcript.jsonl`, printed `🙋 📝 feat · Owner's approval · ■■■■■■■◆□□□□□ · 8 of 13 · your approval of the plan`, exit 0, empty standard error: no `%`, no budget word, no error from the missing transcript; the line is the same as R4's, so the cap changed nothing. Test `run-status-bar AC-2 budget: a cap in the config and a transcript on the input give no percentage and no word about it` passes, and the test `AC-5 read-only: the source writes nothing, spawns only node and git, and never reads a transcript or a cap` passes (gate 2.5 at this head) | pass |
| AC-3 | `roadmap-counts`: the coordinator of a run whose listing holds six changes (3 running, 2 waiting, 1 blocked) shows those counts, no strip, no percentage | Proven on fixtures. R7 (a fixture repository with three changes waiting on the owner and a run file recording the input's session `S-coordinator`) printed `3 in play · 0 working · 🙋 3 waiting on the owner · ⛔ 0 blocked`, 64 columns, exit 0, no strip, no `%`. The offline fix, F1 to F5 below: on the S-9b fixture (a merge-mode change `feat` at the code review, the repository settings unreadable by the fake `gh`, a run file recording `S-coordinator`) the online `state --change feat` read `blocked`, `merge-setup`, `review` (F1, 5 `gh` calls), `state --change feat --offline` and the listing `state --offline` read `waiting-on-github`, `silent`, `review` with 0 `gh` calls (F2, F3), and the coordinator's bar printed `1 in play · 0 working · 🙋 0 waiting on the owner · ⛔ 0 blocked` (F4) and `1 em jogo · 0 em andamento · 🙋 0 aguardando o dono · ⛔ 0 bloqueadas` (F5); the code of `83650a5` on the same fixture read `blocked`, `merge-setup` offline (F6) and printed `⛔ 1 blocked` (F7). The 3/2/1 mix itself is proven by the tests `run-status-bar AC-3 counts: the mix of the criterion` (`6 in play · 3 working · 🙋 2 waiting on the owner · ⛔ 1 blocked`) and `AC-7 mock: each line of the roadmap-run mock-up`, which pass at this head (gate 2.5); S-9b passes in gates 1.7 and 2.5. On this repository's own run (C1 to C4 below, measured at `0983bd2`): the real listing `state --offline --lang en` exits 0 (11 entries: 3 `running`, 2 `waiting-on-github`, 6 `blocked`, 0 `waiting-for-owner`), but it took 45 s from the root checkout (37 s at a later run from this worktree), and the bar with the session the root's run file records printed nothing in both languages, exit 0, after 20 s: the state call passed the 20 s bound (D-9, the scenario "The state cannot be read"), so the line the counts would give, `11 in play · 3 working · 🙋 0 waiting on the owner · ⛔ 6 blocked`, did not show. That is the behaviour the spec states for a slow state call, not a departure from it. **Known limit, accepted by the owner:** on 2026-11-24 the owner chose, in the conducting session's words `Entregar e seguir` (ship as is; make the listing faster in a follow-up), recorded in `design.md` (D-12 and the risk table) at `41caadc`; the follow-up is `state-listing-speed`, which the retro proposes for the roadmap. Left to dogfood: the counts under the coordinator's message box in a roadmap run of this repository, after `state-listing-speed` | pass |
| AC-4 | `nothing-conducted`: with no change conducted and no run the bar prints nothing and exits 0 | R3: `cwd` set to the root checkout `/Users/kauesantos/Documents/devkit` (branch `main`, no change's worktree) with session id `S-unrecorded-session`: exit 0, standard output empty (0 bytes), standard error empty, matching `mock/nothing-conducted.md` (an empty bar). Test `run-status-bar AC-4 mock: a session that conducts nothing prints the empty bar of the mock-up` and the four `AC-4 choice:` tests pass (gate 2.5 at this head) | pass |
| AC-5 | `read-only`: `git status`, the run file and the worktree list are as they were, no AI, no `devkit-run:` or `devkit-end:` line | In R1 to R8, S1, S2 and F1 to F7 at this head the capture before the run and after it was equal: `git status --short --untracked-files=all` (empty in this worktree and in the R fixtures; 6 lines in the root checkout for R3, files of other work, the same before and after; on the F fixture its own untracked worktree folder, the same before and after), the SHA-256 of `<git common dir>/devkit/roadmap-run.json` (R1 to R3, S1 and S2 on the repository's own run file: `b5fe2a11` to `28235c27` before and after; R7, R8 and F1 to F7 on a fixture's: `a92e26a4` to `c1a8e211`; R4 to R6: no run file), and `git worktree list` (24 lines in this repository, 1 in each R fixture, 2 in the F fixture). The R run log holds 0 lines with `devkit-run:` or `devkit-end:`. At `0983bd2`, C1 to C4 had equal captures too and left no `change-loop.mjs state --offline` process after the bounded C3 run. The merge `e14e1fa` brings a base fetch to `change-loop.mjs`, which only `next` and `wait` pass; `state`, the bar's call, passes none. The tests `AC-5 read-only: the source writes nothing, spawns only node and git, and never reads a transcript or a cap`, `AC-5 read-only: git status, the run file and the worktree list are as they were, and no loop marker is printed` and the six `AC-5 failure:` tests pass (gate 2.5 at this head) | pass |
| AC-6 | `person-language`: with `--lang pt-BR` the words are in Brazilian Portuguese; state, stage and counts are those of `--lang en` | R1 against R2 in this worktree: `🔍 run-status-bar · Demonstration · ... · 12 of 15` and `🔍 run-status-bar · Demonstração · ■■■■■■■■■■■◆□□□ · 12 de 15`; R4 against R5 at the plan approval: `... 8 of 13 · your approval of the plan` and `🙋 📝 feat · Aprovação do dono · ■■■■■■■◆□□□□□ · 8 de 13 · a sua aprovação do plano`; R7 against R8: `3 in play · 0 working · 🙋 3 waiting on the owner · ⛔ 0 blocked` and `3 em jogo · 0 em andamento · 🙋 3 aguardando o dono · ⛔ 0 bloqueadas`; F4 against F5 (above). Icons, id, strip, place and counts are equal in each pair; the stage title, `of`/`de`, the reason and the count words change. The three `run-status-bar AC-6 language:` tests pass at this head (gate 2.5). Left to dogfood: the owner's own language setting | pass |
| AC-7 | `mock-matches`: the line printed for each example of the approved mock-up is the one the mock shows, element by element | Test `run-status-bar AC-7 mock: each line of the lone-change mock-up, in both languages and with the long id` passes (moments 1 to 4 in `en` and `pt-BR`, the 100-column cut of the long id, and the widths the mock states), `AC-7 mock: each line of the roadmap-run mock-up` passes and `AC-4 mock: a session that conducts nothing prints the empty bar of the mock-up` passes, all at this head (gate 2.5); those test constants were checked verbatim against `openspec/changes/run-status-bar/mock/` in an earlier evidence, and `git diff --stat 3198a03 HEAD` changes neither `mock/` nor `status-line.test.mjs` nor `status-line.mjs`. At this head the stage is `evidence` (R1, `12 of 15`). Left to dogfood: the owner's look at the line in the app | pass |

### Real runs of the status line command

R1 to R8 ran from `cd /Users/kauesantos/Documents/devkit/.claude/worktrees/run-status-bar`, with the folder named in `cwd`. S1 and S2
ran the `command` of the README's `statusLine` JSON block (parsed from `plugins/openspec/README.md`; the same text, JSON-encoded, is
found once each in `docs/openspec-flow.md` and `design.md` D-1, ending `[ -z "$f" ] || node "$f" --lang pt-BR`, and it is byte for
byte the text of the previous evidence) through `sh -c`, with the same JSON input as R2 and `CLAUDE_CONFIG_DIR` naming a fake config
folder in the verifier's scratch folder (`fake-config-6`, `empty-config-6`). All exit 0, standard error empty, before and after
captures equal.

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
| S1 | this worktree, README command, cache with 0.9.0, 0.39.2, 0.45.0 and 0.46.0 | pt-BR (the snippet's) | `🔍 run-status-bar · Demonstração · ■■■■■■■■■■■◆□□□ · 12 de 15` (the 0.46.0 copy; the three older copies print `OLD COPY ...`, which did not show) |
| S2 | this worktree, README command, empty cache | pt-BR (the snippet's) | nothing (0 bytes) |

### Real runs of the offline fix

`fix-run.mjs` builds the S-9b fixture with the test fixtures' own helpers at this head (`deliveredChange()`, `review.md` removed,
`ship` set to `merge` for both schemas, then a run file recording `S-coordinator` in the fixture's main checkout) and runs the real
commands on it from the fixture's main checkout, with the fixture's fake `gh` on `PATH`. F6 and F7 run the same commands from a copy
of `plugins/openspec` at `83650a5` (`git archive`, in the scratch folder), the code before the fix, as contrast. Every run exited 0
with an empty standard error and equal before and after captures (fixture status, run file SHA-256, worktree list).

| Run | Command | `gh` calls | Read or printed |
| --- | --- | --- | --- |
| F1 | `change-loop.mjs state --change feat --lang en` | 5 | `feat`: `blocked`, `merge-setup`, stage `review` (the guard online) |
| F2 | `change-loop.mjs state --change feat --offline --lang en` | 0 | `feat`: `waiting-on-github`, `silent`, stage `review` |
| F3 | `change-loop.mjs state --offline --lang en` (the listing) | 0 | one entry, `feat`: `waiting-on-github`, `silent`, stage `review` |
| F4 | `status-line.mjs --lang en`, session `S-coordinator` | 0 | `1 in play · 0 working · 🙋 0 waiting on the owner · ⛔ 0 blocked` |
| F5 | `status-line.mjs --lang pt-BR`, session `S-coordinator` | 0 | `1 em jogo · 0 em andamento · 🙋 0 aguardando o dono · ⛔ 0 bloqueadas` |
| F6 | F2 with the `83650a5` code | 0 | `feat`: `blocked`, `merge-setup`, stage `review` (the defect F10 named) |
| F7 | F4 with the `83650a5` code | 0 | `1 in play · 0 working · 🙋 0 waiting on the owner · ⛔ 1 blocked` (the defect F10 named) |

### Real runs on this repository's roadmap run

Measured at `0983bd2` and kept (not re-run at this head). C1 and C2 ran `node plugins/openspec/hooks/change-loop.mjs state --offline
--lang en` (this worktree's code) with `TMPDIR=/private/tmp/devkit-run-status-bar`; C3 and C4 ran `node
plugins/openspec/hooks/status-line.mjs --lang <l>` with the D-2 input naming the root checkout as folder and, as `session_id`, the
session the root's run file `/Users/kauesantos/Documents/devkit/.git/devkit/roadmap-run.json` records (read by the verifier from that
file and passed through without being printed). The machine was loaded (load average 9 to 19, the verifier's own gate 1.7 run among
the load). Every run exited 0 with an empty standard error and equal before and after captures; C1 to C4 ran as the coordinator's
status line would, with no CI variable. Outputs in `/private/tmp/devkit-run-status-bar/verify/` (`state-offline-5.json`,
`state-root.json`, `coord-en.out`, `coord-pt-BR.out`, `coord-timed.out`).

| Run | Command, folder | Time | Result |
| --- | --- | --- | --- |
| C1 | listing, from this worktree | not timed at the first run; 37 s at a second run after the verifier's gates had ended (load average 7.3), exit 0 | exit 0, 11 entries: `running` 3 (`coordinator-loop-fixes`, `project-setup`, `roadmap-coordinator-followups`), `waiting-on-github` 2 (`forced-merge-path`, `run-status-bar`, both `silent`), `blocked` 6 (`wrong-branch` 4, `archive-failed` 2), `waiting-for-owner` 0 |
| C2 | listing, from the root checkout | 45.1 s wall, 13.1 s user, 14.1 s system | exit 0, the same 7925 bytes as C1; `state --change run-status-bar --offline` alone took 5 s from the same folder |
| C3 | the bar, `--lang en` and `--lang pt-BR`, the root's coordinator session | 20 s (timed for `en`) | nothing (0 bytes) in both languages: the state call passed the 20 s bound and was killed; no state process was left afterwards |
| C4 | `countsLine` of the C1 entries (what the bar would print within the bound) | not a run of the bar | `11 in play · 3 working · 🙋 0 waiting on the owner · ⛔ 6 blocked` (65 columns) and `11 em jogo · 3 em andamento · 🙋 0 aguardando o dono · ⛔ 6 bloqueadas` (70 columns) |

### Notes for the owner

- **The real coordinator's bar on this repository prints nothing today: a known limit the owner accepted.** With 11 changes the
  listing took 37 to 45 s (C1, C2), about 5 s per change read one after another, past the bar's 20 s bound (D-9), so C3 printed
  nothing in both languages, as the spec states for a call past the bound. On 2026-11-24 the owner chose `Entregar e seguir` (ship as
  is; make the listing faster in a follow-up); `design.md` records it at `41caadc` (D-12 and the risk table), and the follow-up is
  `state-listing-speed` (the `state` listing fast enough for the coordinator bar, by reading the changes in parallel or skipping the
  per-change GitHub reads), which the retro proposes for the roadmap. The lone-change bar works (R1, R2). The measurement is from
  `0983bd2`; the merge since then does not change the path `state` takes.
- `main` moved again during this verification: the local `origin/main` ref and the root checkout's `main` are `d6d7f6a` (train 12,
  pull request 135, committed 16:15), past this branch's merge of `74f2444`. `git merge-base --is-ancestor origin/main HEAD` exits 1.
  Between `74f2444` and `d6d7f6a` nothing under `plugins/` changes (`git diff --stat 74f2444 origin/main -- plugins` prints nothing;
  the commits archive three changes and record train 12), and at `d6d7f6a` devkit-openspec is still 0.45.0, the marketplace 0.50.0
  and `CHANGELOG.md` starts with `## 0.50.0`, so this branch's 0.46.0 and 0.51.0 stay above `main`. A merge of `main` would stale this
  evidence and every review. Nothing was fetched by the verifier.
- Nobody ran the whole suite at this head; the delivery train proves the suite part of gate 3.4 on the joined heads. The train's
  run does not set the CI branch variables, whose last whole-suite run was at `0528b85`.
- Every criterion has a proof; the parts left to dogfood are named in its row.
- `node plugins/openspec/hooks/deliver-check.mjs run-status-bar --json` with this file in the tree (uncommitted) reports `head`
  `41caadc`, item 1 `tasks` met (`all tasks ticked; 4 gate commands green in evidence.md; 2 proven by the train`, evidence
  `current`) and item 4 `acceptance` met (`7 criteria proven`, evidence `current`); it exits 2 for items outside this stage (2
  reviews rejected or stale behind `e14e1fa`, 3 the test-coverage finding on `change-loop.mjs` not yet disposed, 5 pull request 124
  reported by GitHub as having merge conflicts with `main`: the local `origin/run-status-bar` ref is `9b3da81`, 150 commits behind this
  branch, so the merges `4c25ecc` and `e14e1fa` are not pushed yet;
  6 `devkit-reviews` failing); items 7 and 8 are met.
- `python3 scripts/check.py` ran with this file in the tree: exit 0, `all checks passed`.
