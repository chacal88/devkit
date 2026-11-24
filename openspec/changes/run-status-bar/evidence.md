<!-- devkit-stage evidence result=passed attempt=5 commit=0983bd2d744c303640062cd95a66f0bfc0122074 -->
Commit: 0983bd2d744c303640062cd95a66f0bfc0122074

# Evidence

Change `run-status-bar`, verified at `0983bd2` on branch `run-status-bar`. The tree was clean (`git status --short` printed
nothing before this file was written). Since the last evidence (at `3198a03`, committed in `9ad0f6f`): `9b3da81` touches only the
change's folder (review round 2, which failed only on the test-coverage finding F11); `4c25ecc` merges `origin/main` `c09860c`
(the release moves to devkit-openspec 0.45.0 and marketplace 0.50.0; conflicts resolved in the release files,
`docs/openspec-flow.md`, `plugins/openspec/hooks/change-loop.mjs`, where `main`'s entries for an unplaced change keep this change's
`stages`, and `plugins/openspec/hooks/flow-check.test.mjs`, both sides' tests kept; `main`'s test `unlocated 1: state lists an
unplaced change blocked and every other change as before` gets `stages: null`, E-6); `62bd607` adds the test B14b to
`plugins/openspec/hooks/change-loop.test.mjs` and the `offline` fact to the doc comment of `decide` in `change-loop.mjs` (3 lines,
comment only); `0983bd2` changes only `design.md` and `tasks.md`. `git diff --quiet c09860c HEAD --
plugins/openspec/hooks/change-loop-compozy.test.mjs` exits 0. No defect against the plan's criteria was found; one finding on this
repository's own roadmap run is in "Notes for the owner" (the real coordinator's bar prints nothing, its listing passes the 20 s
bound). Nothing was fixed and nothing was committed.

Who ran what:

- **The verifier ran live**, at `0983bd2` with `TMPDIR=/private/tmp/devkit-run-status-bar` and `--concurrency=2` added to the suite
  commands (the owner's Mac is shared): the suite part of gate 1.7 (log `/private/tmp/devkit-run-status-bar/verify/g17a-5.log`),
  the two suite parts of gate 2.5 (logs `g25a-5.log` and `g25b-5.log` in the same folder), `python3 scripts/check.py`,
  `python3 scripts/gen-catalog.py --check`, the eight real runs R1 to R8 below (log
  `/private/tmp/claude-501/-Users-kauesantos-Documents-devkit--claude-worktrees-run-status-bar/4085ed07-8492-4c4b-8c10-f2febfdb8331/scratchpad/verify-runs-5.log`,
  from the conducting session's `real-runs.sh` in the same folder, fixtures under `/private/tmp/devkit-run-status-bar/real-fixtures/`),
  the README's `statusLine` command against a fake plugin cache (S1 and S2), the real runs F1 to F7 of the offline fix on the S-9b
  fixture (log `fix-run-5.log` in the same scratch folder, from `fix-run.mjs` there), and the real listing and coordinator's bar on
  this repository (C1 to C4 below; outputs `state-offline-5.json`, `state-root.json`, `coord-en.out`, `coord-pt-BR.out` and
  `coord-timed.out` in `/private/tmp/devkit-run-status-bar/verify/`). Every live run had `GITHUB_HEAD_REF=probe-branch
  GITHUB_BASE_REF=main` set except C1 to C4, which ran as the coordinator's status line would, with no CI variable.
- **The conducting session ran**, after the merge `4c25ecc` with the E-6 edit, change-loop, change-loop-compozy,
  change-loop-remote-state, change-state-stages, flow-check and status-line with `--concurrency=2` (984 tests, all pass, then
  change-loop-remote-state alone 240 of 240), and `version-pin.test.mjs` (the verifier read its log,
  `/private/tmp/devkit-run-status-bar/vp.log`: `tests 76`, `pass 76`, `fail 0`); after `62bd607`, `change-loop.test.mjs` with
  `change-state-stages.test.mjs` (the verifier read the log
  `/private/tmp/claude-501/-Users-kauesantos-Documents-devkit--claude-worktrees-run-status-bar/4085ed07-8492-4c4b-8c10-f2febfdb8331/scratchpad/suite.log`,
  last written 15:49: `suite: 2 files, 207 tests, 207 pass, 0 fail, 386.5s, concurrency 2`, with `✔ change-loop decide: B14 the
  stops of the delivery checker end blocked with the matching reason` and `✔ change-loop decide: B14b offline, only the merge-setup
  stop reads as GitHub silent; the other stops stay blocked` among them). `git diff --stat 62bd607 HEAD` touches only `design.md`
  and `tasks.md`, so that run stands for this head's `plugins/`.
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
| 1.7 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs plugins/openspec/hooks/flow-check.test.mjs plugins/openspec/hooks/change-state-stages.test.mjs plugins/openspec/hooks/change-loop-remote-state.test.mjs plugins/openspec/hooks/roadmap-loop.test.mjs plugins/openspec/hooks/roadmap-loop-upfront.test.mjs plugins/openspec/hooks/roadmap-loop-followups.test.mjs` | pass: run live at `0983bd2` with `--concurrency=2`, exit 0, `suite: 6 files, 757 tests, 757 pass, 0 fail, 602.7s, concurrency 2` (flow-check 101.2s, change-state-stages 56.5s, change-loop-remote-state 212.4s, roadmap-loop 195.0s, roadmap-loop-upfront 306.5s, roadmap-loop-followups 216.0s); S-9b and E-6 (`unlocated 1: state lists an unplaced change blocked and every other change as before`) among the passing tests |
| 1.7 | `python3 scripts/check.py` | train: proven by the train's part of the same text; the verifier also ran it live at `0983bd2` with this file in the tree: exit 0, `all checks passed` |
| 2.5 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs plugins/openspec/hooks/status-line.test.mjs plugins/openspec/hooks/change-state-stages.test.mjs plugins/openspec/hooks/flow-check.test.mjs` | pass: run live at `0983bd2` with `--concurrency=2`, exit 0, `suite: 3 files, 360 tests, 360 pass, 0 fail, 99.1s, concurrency 2` (status-line 24.2s, change-state-stages 52.8s, flow-check 99.1s); S-9b and every `run-status-bar AC-` test named in the criteria below among the passing tests |
| 2.5 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --test-name-pattern="^change-loop replies: " plugins/openspec/hooks/change-loop.test.mjs` | pass: run live at `0983bd2` with `--concurrency=2`, exit 0, `suite: 1 files, 4 tests, 4 pass, 0 fail, 0.1s, concurrency 2` (the conducting session's run of the whole `change-loop.test.mjs` with `change-state-stages.test.mjs` after `62bd607` passed 207 of 207, B14b among them) |
| 2.5 | `python3 scripts/check.py` | train: proven by the train's part of the same text; the live run at this head: exit 0, `all checks passed` |
| 3.4 | `node scripts/test-suite.mjs` | train: proven by the train's part of the same text, which runs the whole suite once on the joined heads before anything merges; the verifier ran no whole suite at `0983bd2` (the coordinating session's instruction on the shared machine); the last whole-suite run, with the CI branch variables set, was at `0528b85` and does not stand for this head; at this head the 1.7 and 2.5 parts above passed live, and at this head's `plugins/` the conducting session's runs passed (984 tests over six files after the merge, change-loop-remote-state 240 of 240, version-pin 76 of 76, change-loop with change-state-stages 207 of 207) |
| 3.4 | `python3 scripts/check.py` | train: proven by the train's part of the same text; the live run at this head with this file in the tree: exit 0, `all checks passed` |
| 3.4 | `python3 scripts/gen-catalog.py --check` | pass: run live at `0983bd2`, exit 0, no output (the catalog is up to date) |

### Acceptance criteria

The command in every real run R1 to R8 is `node plugins/openspec/hooks/status-line.mjs --lang <l>` with the JSON of D-2 on standard input
(`session_id`, `workspace.current_dir`, `cwd`, and `transcript_path` in R6); every run exited 0 with an empty standard error. The
widths below are display columns, counted with the command's own `columns` export (an emoji takes two, the marks and `…` one); every
line is at most 100 columns. A line in a fixture repository comes from that fixture's own project (its flags decide `N`), so a fixture
line has the shape of the mock-up line, not its text.

| AC | Criterion | What was run, what it printed, and where the proof is | Result |
| --- | --- | --- | --- |
| AC-1 | `lone-change-bar`: a session that conducts a change at `approval` shows state icon, stage icon, id, stage title, strip, `n of N` and the reason; exit 0 | R4 (a fixture project with change `feat` at the plan approval, waiting for the owner, session id not recorded in any run file) printed `🙋 📝 feat · Owner's approval · ■■■■■■■◆□□□□□ · 8 of 13 · your approval of the plan`, 83 columns, exit 0: the elements of mock moment 3 in order (state icon, stage icon, id, title, 7 done marks, the current mark, 5 not-yet marks, place 8 of 13, reason in words). R1 in this worktree at its real stage today (`evidence`) printed `🔍 run-status-bar · Demonstration · ■■■■■■■■■■■◆□□□ · 12 of 15`, 62 columns: running, so no state icon and no reason. The way the owner turns it on: S1 ran the README's `statusLine` command by `sh -c` with `CLAUDE_CONFIG_DIR` naming a fake plugin cache holding 0.9.0, 0.39.2, 0.44.1 and 0.45.0 (the last a link to this worktree's `plugins/openspec`, whose `plugin.json` reads 0.45.0): it started the 0.45.0 copy and printed `🔍 run-status-bar · Demonstração · ■■■■■■■■■■■◆□□□ · 12 de 15`, exit 0, empty standard error; S2 with an empty cache printed 0 bytes and exited 0. The tests `run-status-bar AC-1 line:`, `AC-1 strip:`, `AC-1 cut:`, `AC-1 choice:`, `AC-1 input:` and `AC-1 snippet: the README command starts the newest installed copy, and with none prints nothing and exits 0` in `plugins/openspec/hooks/status-line.test.mjs` pass (gate 2.5 at this head). Left to dogfood: the line under the message box in the owner's own session at a real plan approval (this change's approval moment is past, so the approval line is proven on the fixture and by the mock test) | pass |
| AC-2 | `no-budget`: with a `budget` cap set the line has no percentage, no mention of the budget, and no transcript is read | R6: a fixture project whose `openspec/config.yaml` holds `devkit:` and `budget: 1000000`, with `transcript_path` on the input set to `/nonexistent/transcript.jsonl`, printed `🙋 📝 feat · Owner's approval · ■■■■■■■◆□□□□□ · 8 of 13 · your approval of the plan`, exit 0, empty standard error: no `%`, no budget word, no error from the missing transcript; the line is the same as R4's, so the cap changed nothing. Test `run-status-bar AC-2 budget:` (cap in the config and a real transcript file on the input, both languages, both views) passes, and the test `AC-5 read-only: the source writes nothing, spawns only node and git, and never reads a transcript or a cap` passes (gate 2.5 at this head) | pass |
| AC-3 | `roadmap-counts`: the coordinator of a run whose listing holds six changes (3 running, 2 waiting, 1 blocked) shows those counts, no strip, no percentage | Proven on fixtures. R7 (a fixture repository with three changes waiting on the owner and a run file recording the input's session `S-coordinator`) printed `3 in play · 0 working · 🙋 3 waiting on the owner · ⛔ 0 blocked`, 64 columns, exit 0, no strip, no `%`. The offline fix, F1 to F5 below: on the S-9b fixture (a merge-mode change `feat` at the code review, the repository settings unreadable by the fake `gh`, a run file recording `S-coordinator`) the online `state --change feat` read `blocked`, `merge-setup`, `review` (F1, 5 `gh` calls), `state --change feat --offline` and the listing `state --offline` read `waiting-on-github`, `silent`, `review` with 0 `gh` calls (F2, F3), and the coordinator's bar printed `1 in play · 0 working · 🙋 0 waiting on the owner · ⛔ 0 blocked` (F4, 64 columns) and `1 em jogo · 0 em andamento · 🙋 0 aguardando o dono · ⛔ 0 bloqueadas` (F5, 69 columns); the code of `83650a5` on the same fixture read `blocked`, `merge-setup` offline (F6) and printed `⛔ 1 blocked` (F7). The 3/2/1 mix itself is proven by the tests `run-status-bar AC-3 counts: the mix of the criterion` (`6 in play · 3 working · 🙋 2 waiting on the owner · ⛔ 1 blocked`) and `AC-7 mock: ... roadmap-run mock-up`, which pass at this head (gate 2.5), S-9b passes in gates 1.7 and 2.5, and B14b (the other blocked stops stay blocked offline) passed in the conducting session's run after `62bd607`. On this repository's own run (C1 to C4 below): the real listing `state --offline --lang en` now exits 0 (11 entries: 3 `running`, 2 `waiting-on-github`, 6 `blocked`, 0 `waiting-for-owner`), but it took 45 s from the root checkout (37 s at a later run from this worktree), and the bar with the session the root's run file records printed nothing in both languages, exit 0, after 20 s: the state call passed the 20 s bound (D-9, the scenario "The state cannot be read"), so the line the counts would give, `11 in play · 3 working · 🙋 0 waiting on the owner · ⛔ 6 blocked`, did not show. That is the behaviour the spec states for a slow state call, not a departure from it; see "Notes for the owner". Left to dogfood: the counts under the coordinator's message box in a roadmap run of this repository, which today exceeds the bound | pass |
| AC-4 | `nothing-conducted`: with no change conducted and no run the bar prints nothing and exits 0 | R3: `cwd` set to the root checkout `/Users/kauesantos/Documents/devkit` (branch `main`, no change's worktree) with session id `S-unrecorded-session`: exit 0, standard output empty (0 bytes), standard error empty, matching `mock/nothing-conducted.md` (an empty bar). Test `run-status-bar AC-4 mock: a session that conducts nothing prints the empty bar of the mock-up` and the `AC-4 choice:` tests pass (gate 2.5 at this head) | pass |
| AC-5 | `read-only`: `git status`, the run file and the worktree list are as they were, no AI, no `devkit-run:` or `devkit-end:` line | In R1 to R8, S1, S2, F1 to F7 and C1 to C4 the capture before the run and after it was equal: `git status --short --untracked-files=all` (empty in this worktree and in the R fixtures; 6 lines in the root checkout for R3 and C1 to C4, files of other work, the same before and after; on the F fixture its own untracked worktree folder, the same before and after), the SHA-256 of `<git common dir>/devkit/roadmap-run.json` (R1 to R3, S1, S2 and C1 to C4 on the repository's own run file: `b5fe2a11` to `28235c27` before and after; R7, R8 and F1 to F7 on a fixture's: `a92e26a4` to `c1a8e211`; R4 to R6: no run file), and `git worktree list` (23 lines in this repository, 1 in each R fixture, 2 in the F fixture). The R run log holds 0 lines with `devkit-run:` or `devkit-end:`. After the bounded C3 run no `change-loop.mjs state --offline` process was left (`pgrep` found none). The tests `AC-5 read-only: the source writes nothing, spawns only node and git, and never reads a transcript or a cap`, `AC-5 read-only: git status, the run file and the worktree list are as they were, and no loop marker is printed` and the six `AC-5 failure:` tests pass (gate 2.5 at this head) | pass |
| AC-6 | `person-language`: with `--lang pt-BR` the words are in Brazilian Portuguese; state, stage and counts are those of `--lang en` | R1 against R2 in this worktree: `🔍 run-status-bar · Demonstration · ... · 12 of 15` and `🔍 run-status-bar · Demonstração · ■■■■■■■■■■■◆□□□ · 12 de 15`; R4 against R5 at the plan approval: `... 8 of 13 · your approval of the plan` and `🙋 📝 feat · Aprovação do dono · ■■■■■■■◆□□□□□ · 8 de 13 · a sua aprovação do plano`; R7 against R8: `3 in play · 0 working · 🙋 3 waiting on the owner · ⛔ 0 blocked` and `3 em jogo · 0 em andamento · 🙋 3 aguardando o dono · ⛔ 0 bloqueadas`; F4 against F5 (above). Icons, id, strip, place and counts are equal in each pair; the stage title, `of`/`de`, the reason and the count words change. The three `run-status-bar AC-6 language:` tests pass at this head (gate 2.5). Left to dogfood: the owner's own language setting | pass |
| AC-7 | `mock-matches`: the line printed for each example of the approved mock-up is the one the mock shows, element by element | Test `run-status-bar AC-7 mock: each line of the lone-change mock-up, in both languages and with the long id` passes (moments 1 to 4 in `en` and `pt-BR`, the 100-column cut of the long id, and the widths the mock states), `AC-7 mock: each line of the roadmap-run mock-up` passes and `AC-4 mock: ... empty bar` passes, all at this head (gate 2.5); those test constants were checked verbatim against `openspec/changes/run-status-bar/mock/` in an earlier evidence, and `git diff --stat 3198a03 HEAD` changes neither `mock/` nor `status-line.test.mjs` nor `status-line.mjs`. At this head the stage is `evidence` (R1, `12 of 15`). Left to dogfood: the owner's look at the line in the app | pass |

### Real runs of the status line command

R1 to R8 ran from `cd /Users/kauesantos/Documents/devkit/.claude/worktrees/run-status-bar`, with the folder named in `cwd`. S1 and S2
ran the `command` of the README's `statusLine` JSON block (parsed from `plugins/openspec/README.md`; the same text, JSON-encoded, is
found once each in `docs/openspec-flow.md` and `design.md` D-1, ending `[ -z "$f" ] || node "$f" --lang pt-BR`, and it is byte for
byte the text of the previous evidence) through `sh -c`, with the same JSON input as R2 and `CLAUDE_CONFIG_DIR` naming a fake config
folder in the verifier's scratch folder (`fake-config-5`, `empty-config-5`). All exit 0, standard error empty, before and after
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
| S1 | this worktree, README command, cache with 0.9.0, 0.39.2, 0.44.1 and 0.45.0 | pt-BR (the snippet's) | `🔍 run-status-bar · Demonstração · ■■■■■■■■■■■◆□□□ · 12 de 15` (the 0.45.0 copy; the three older copies print `OLD COPY ...`, which did not show) |
| S2 | this worktree, README command, empty cache | pt-BR (the snippet's) | nothing (0 bytes) |

### Real runs of the offline fix

`fix-run.mjs` builds the S-9b fixture with the test fixtures' own helpers (`deliveredChange()`, `review.md` removed, `ship` set to
`merge` for both schemas, then a run file recording `S-coordinator` in the fixture's main checkout) and runs the real commands on it
from the fixture's main checkout, with the fixture's fake `gh` on `PATH`. F6 and F7 run the same commands from a copy of
`plugins/openspec` at `83650a5` (`git archive`, in the scratch folder), the code before the fix, as contrast. Every run exited 0 with
an empty standard error and equal before and after captures (fixture status, run file SHA-256, worktree list).

| Run | Command | `gh` calls | Read or printed |
| --- | --- | --- | --- |
| F1 | `change-loop.mjs state --change feat --lang en` | 5 | `feat`: `blocked`, `merge-setup`, stage `review` (the guard online) |
| F2 | `change-loop.mjs state --change feat --offline --lang en` | 0 | `feat`: `waiting-on-github`, `silent`, stage `review` |
| F3 | `change-loop.mjs state --offline --lang en` (the listing) | 0 | one entry, `feat`: `waiting-on-github`, `silent`, stage `review` |
| F4 | `status-line.mjs --lang en`, session `S-coordinator` | 0 | `1 in play · 0 working · 🙋 0 waiting on the owner · ⛔ 0 blocked` (64 columns) |
| F5 | `status-line.mjs --lang pt-BR`, session `S-coordinator` | 0 | `1 em jogo · 0 em andamento · 🙋 0 aguardando o dono · ⛔ 0 bloqueadas` (69 columns) |
| F6 | F2 with the `83650a5` code | 0 | `feat`: `blocked`, `merge-setup`, stage `review` (the defect F10 named) |
| F7 | F4 with the `83650a5` code | 0 | `1 in play · 0 working · 🙋 0 waiting on the owner · ⛔ 1 blocked` (the defect F10 named) |

### Real runs on this repository's roadmap run

C1 and C2 ran `node plugins/openspec/hooks/change-loop.mjs state --offline --lang en` (this worktree's code) with
`TMPDIR=/private/tmp/devkit-run-status-bar`; C3 and C4 ran `node plugins/openspec/hooks/status-line.mjs --lang <l>` with the D-2 input
naming the root checkout as folder and, as `session_id`, the session the root's run file `/Users/kauesantos/Documents/devkit/.git/devkit/roadmap-run.json`
records (read by the verifier from that file and passed through without being printed). The machine was loaded (load average 9 to 19,
the verifier's own gate 1.7 run among the load). Every run exited 0 with an empty standard error and equal before and after captures.

| Run | Command, folder | Time | Result |
| --- | --- | --- | --- |
| C1 | listing, from this worktree | not timed at the first run; 37 s at a second run after the verifier's gates had ended (load average 7.3), exit 0 | exit 0, 11 entries: `running` 3 (`coordinator-loop-fixes`, `project-setup`, `roadmap-coordinator-followups`), `waiting-on-github` 2 (`forced-merge-path`, `run-status-bar`, both `silent`), `blocked` 6 (`wrong-branch` 4, `archive-failed` 2), `waiting-for-owner` 0 |
| C2 | listing, from the root checkout | 45.1 s wall, 13.1 s user, 14.1 s system | exit 0, the same 7925 bytes as C1; `state --change run-status-bar --offline` alone took 5 s from the same folder |
| C3 | the bar, `--lang en` and `--lang pt-BR`, the root's coordinator session | 20 s (timed for `en`) | nothing (0 bytes) in both languages: the state call passed the 20 s bound and was killed; no state process was left afterwards |
| C4 | `countsLine` of the C1 entries (what the bar would print within the bound) | not a run of the bar | `11 in play · 3 working · 🙋 0 waiting on the owner · ⛔ 6 blocked` (65 columns) and `11 em jogo · 3 em andamento · 🙋 0 aguardando o dono · ⛔ 6 bloqueadas` (70 columns) |

### Notes for the owner

- **The real coordinator's bar on this repository prints nothing today.** The listing now exits 0 (`state-skips-unlocated` merged),
  but with 11 changes it took 45 s on the loaded machine (37 s once the verifier's own suites had ended), about 5 s per change
  read one after another, with 27 s of CPU time in the 45 s run, and the bar's state call
  has a 20 s bound (D-9), so C3 printed nothing in both languages. That follows the spec ("runs past 20 seconds": prints nothing,
  exits 0, no process left), so it is not recorded as a defect, but the AC-3 dogfood in this repository will likely show an empty
  bar until the listing is faster or the bound changes; the design's risk row on a slow `state` named only `state --change`. This is
  a design choice for the owner, not something the implementation can change without a revised plan.
- `main` moved during this verification: `origin/main` and the root checkout's `main` are `74f2444` (trains 10 and 11, pull
  requests 130 and 134, committed 15:45), past this branch's merge of `c09860c`. At `74f2444` devkit-openspec is already 0.45.0 and
  the marketplace 0.50.0, the same versions this branch releases, and `main` touches `change-loop.mjs`, `change-loop.test.mjs`,
  `change-loop-fixtures.mjs`, `roadmap-loop.mjs` and `roadmap-loop.test.mjs`. The next merge of `main` must move the release above
  it, and it stales this evidence and every review.
- Nobody ran the whole suite at this head; the delivery train proves the suite part of gate 3.4 on the joined heads. The train's
  run does not set the CI branch variables, whose last whole-suite run was at `0528b85`.
- Every criterion has a proof; the parts left to dogfood are named in its row.
- `node plugins/openspec/hooks/deliver-check.mjs run-status-bar --json` with this file in the tree (uncommitted) reports `head`
  `0983bd2`, item 1 `tasks` met (`all tasks ticked; 4 gate commands green in evidence.md; 2 proven by the train`, evidence
  `current`) and item 4 `acceptance` met (`7 criteria proven`, evidence `current`); it exits 2 for the items outside this stage
  (2 reviews rejected or stale behind `62bd607`, 3 the test-coverage finding not yet disposed, 5 pull request 124 has merge
  conflicts with `main`, 6 `devkit-reviews` failing).
- `python3 scripts/check.py` ran with this file in the tree: exit 0, `all checks passed`.
