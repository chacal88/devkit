<!-- devkit-stage evidence result=passed attempt=2 commit=a6df7b95c5cddc634f46c2ede89aa48a1c60f337 -->
Commit: a6df7b95c5cddc634f46c2ede89aa48a1c60f337

# Evidence: roadmap-coordinator

Verified at HEAD `a6df7b95c5cddc634f46c2ede89aa48a1c60f337` on branch `roadmap-coordinator`, tree clean
before this file. Verifier re-ran the focused gates and the checkers itself; the whole-suite run is the
conducting session's (cited, not repeated, as instructed). Since attempt 1 (HEAD `8364a35`) one code
commit landed, `a6df7b9`, a refactor with no behaviour change (one lock helper, one transcript
scanner); AC-8 and AC-10 now have real command runs of this tree's scripts (rows below). The
live-run proofs under `proof/live-1/` and `proof/live-2/` were taken at the commits their own records
name (`proof/live-2/commit.txt`: `35c6e8f`), not at this one.

## Verification

### Gates

| Gate | Command | Result |
| --- | --- | --- |
| 1.5 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^roadmap-loop" --test-name-pattern="^change-loop replies" --test-name-pattern="^change-loop decide" --test-name-pattern="^change-loop wait" plugins/openspec/hooks/guard.test.mjs` | pass: 170 tests, 170 pass, 0 fail, exit 0 (run by the verifier at this commit) |
| 1.5 | `python3 scripts/check.py` | pass: "all checks passed", exit 0 |
| 2.3 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^roadmap-loop" --test-name-pattern="^change-loop" plugins/openspec/hooks/guard.test.mjs` | pass: 294 tests, 294 pass, 0 fail, exit 0 |
| 2.3 | `python3 scripts/check.py` | pass: "all checks passed", exit 0 |
| 3.5 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^roadmap-loop" --test-name-pattern="^change-loop" --test-name-pattern="^worktree" --test-name-pattern="^approval.md" --test-name-pattern="^devkit-lite" plugins/openspec/hooks/guard.test.mjs` | pass: 304 tests, 304 pass, 0 fail, exit 0 |
| 3.5 | `python3 scripts/check.py` | pass: "all checks passed", exit 0 |
| 3.5 | `grep -q "Validation passed" "${TMPDIR%/}/devkit-validate-roadmap-coordinator/phase-3.txt"` | pass: exit 0 (record exists; validation ran with Claude Code 2.1.326) |
| 4.2 | `grep -q '"mode":"stop",.*"decision":"refuse"' "${TMPDIR%/}/devkit-live-roadmap-coordinator/hooks.jsonl"` | pass: exit 0 |
| 4.2 | `grep -q '"mode":"subagent-stop",.*"decision":"allow"' "${TMPDIR%/}/devkit-live-roadmap-coordinator/hooks.jsonl"` | pass: exit 0 |
| 4.2 | `test -s "${TMPDIR%/}/devkit-live-roadmap-coordinator/record-5.txt"` | pass: exit 0 |
| 5.9 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs` | pass: whole suite 1112 tests, 1112 pass, 0 fail, taken from the conducting session's log (gate-5-9.log in the session scratchpad); not re-run by the verifier |
| 5.9 | `python3 scripts/check.py` | pass: "all checks passed", exit 0 |
| 5.9 | `python3 scripts/gen-catalog.py --check` | pass: exit 0 |
| 5.9 | `grep -q "Validation passed" "${TMPDIR%/}/devkit-validate-roadmap-coordinator/phase-5.txt"` | pass: exit 0; record shows Claude Code 2.1.326, commit 771c97a (release commit; no manifest changed since), "Validation passed" |

### Acceptance criteria

Tests named per criterion are the ones each gate's "covers" line assigns (tasks.md); the verifier ran
the gates, it did not read each test. Live records are under
`openspec/changes/roadmap-coordinator/proof/` (plugins loaded from commit
`35c6e8f03fa5c224fdf95aade5cc92161eb93c98`, Claude Code 2.1.326, `proof/live-2/commit.txt` and
`version.txt`). Live-1 (plugins from e2519b9) showed four defects, fixed test first in 35c6e8f; live-2
is the run after the fixes.

| ID | Criterion | Proof | Result |
| --- | --- | --- | --- |
| AC-1 | `starts-what-is-ready` | Selection tests in gates 1.5 and 2.3 (pass above). Live: `proof/live-2/record-1.txt` shows `/devkit roadmap 2` starting `add-version-flag` and `add-help-flag` (two worktrees created) while `add-quiet-flag` stays in the queue ("waits for add-version-flag"); two "started" event lines, one per change, reading "1 of 2 in progress" and "2 of 2 in progress". Selection on this repository's own roadmap is "next". | pass |
| AC-2 | `number-set-per-run` | Tests in gates 1.5 and 2.3. Live: the run file in `record-1.txt` holds `"places": 2` after `/devkit roadmap 2`. Changing the number mid-run is covered by tests only. | pass |
| AC-3 | `open-changes-fill-the-places` | Tests in gates 1.5 and 2.3. Live: `record-1.txt` and `record-4.txt` show 2 open of 2 and the third change not started while the places are full (even with both open changes Blocked). | pass |
| AC-4 | `holds-starts-while-loaded` | Decision with replaced load reading: tests in gates 1.5 and 2.3. Live, real reading: `record-0.txt` "Starts held: processor at 174% (limit 80%)" and "add-version-flag   ready, held by the load"; `record-1.txt`, first reply: says add-version-flag is ready to start but the machine is loaded (processor at 148%, limit 80%) and the start is held until the load eases; then the two changes start by themselves (hold released). The "next" part (hold and release in the first real use) was therefore also seen once here. | pass |
| AC-5 | `one-line-per-event` | Message-table and internal-word tests in gates 1.5 and 2.3. Live event lines, each one line and in pt-BR, in `record-1.txt` (a "started" line, and a line saying add-version-flag waits for the owner's answers about the request and the others go on) and in `record-4.txt` (a "resumed" line, and a line saying add-version-flag stopped, with the reason). Note: "As outras seguem" appears when no other change is running (kept as the approved design has it; retro note). | pass |
| AC-6 | `status-shows-the-whole-picture` | Tests in gates 1.5 and 2.3. Live: `record-0.txt` (no run: first line "Roadmap: 0 open of 1 · 3 in the queue · 0 archived", "Starts held" line, "In the queue" block), `record-1.txt` ("Waiting for you" then "In the queue"), `record-4a.txt` and `record-4.txt` ("Blocked" then "In the queue", from a resumed session). Note: "ready, waits for a place" with no run under way is a retro note, not a defect. | pass |
| AC-7 | `owner-gates-asked-in-a-queue` | Order and naming tests in gates 1.5, 2.3 and 3.5. Live: `record-1.txt` run file `"asking": "add-version-flag"`, both changes "gate:grill" at once, and the first question, whose opening words name add-version-flag. Not shown live: other changes running while the owner answers one (only over the scratch stages); "next". | pass |
| AC-8 | `stop-at-the-end-of-the-stage` | Tests in gates 1.5 and 2.3, and a real command run at `a6df7b9` in a scratch git project (`${TMPDIR%/}/devkit-evidence-roadmap-coordinator/ac8`, three-line roadmap, `--lang en --load-limit 80 --session S1`; full output in `${TMPDIR%/}/devkit-evidence-roadmap-coordinator/ac8.out`, script `ac8.sh` beside it). (1) `printf 2 \| roadmap-loop.mjs run ...` printed `devkit-roadmap: 2` and JSON with `"places": 2` and two `start` actions (add-version-flag, add-help-flag; add-quiet-flag, which is `after: add-version-flag`, not started). (2) Both opened with `change-loop.mjs open` (exit 0); setup by hand: a passed `requirements.md` header in add-version-flag's scratch worktree. (3) `next` printed `devkit-roadmap: 2`, lines "Started add-version-flag (1 of 2 under way).", "Started add-help-flag (2 of 2 under way).", "add-help-flag waits for your answers about its request. The others go on." and handed one `agent` action: add-version-flag, stage `proposal`, agent `devkit-core:change-planner`. (4) `printf stop \| roadmap-loop.mjs run ...` printed `devkit-roadmap: stop`, "Stopping: nothing new starts, and each change finishes the stage it is in.", "add-version-flag: next is the proposal.", "add-help-flag: waiting for you at the requirements (grill).", and JSON `"stopping": true`, `"actions": []`, `"end": {"why": "stopped", "reply": "The run stopped. Call /devkit roadmap to go on from where each change stayed. ..."}` (the same two rows). (5) `next` again: `devkit-roadmap: stop`, `"actions": []`, `"ask": null`, the same `stopped` end; no new change started, worktrees stayed at the main checkout plus the two. (6) `printf 2 \| roadmap-loop.mjs run ...` again: `devkit-roadmap: 2`, `"stopping": false`, no `start` action (both already open), the `proposal` agent action for add-version-flag handed again and the grill ask for add-help-flag back: the run resumed. What this does not show: an agent finishing its stage after the word (the session side: the stop lock and the end of a background subagent need a Claude session; not run here). Caveat: with both places full, "nothing new starts" is shown by the empty `actions` against the agent action handed before the word, not by a refused start. | pass |
| AC-9 | `blocked-change-keeps-its-place` | Tests in gates 1.5 and 2.3. Live: `record-2.txt` and `record-4.txt` show both changes ending blocked because the scratch project has no remote (the record says GitHub could not be read, with the cause "no git remotes found"), the reason named, `add-quiet-flag` waiting for its dependency, and the run ending with a line saying nothing more can start or run by itself and listing what each open change needs. | pass |
| AC-10 | `no-roadmap-offers-a-draft` | Tests in gates 2.3 and 3.5, and a real command run at `a6df7b9` in a scratch git project (`${TMPDIR%/}/devkit-evidence-roadmap-coordinator/ac10`: devkit schemas copied in, `openspec/config.yaml` with `schema: devkit` and a `devkit:` block, no `openspec/roadmap.md`; full output in `${TMPDIR%/}/devkit-evidence-roadmap-coordinator/ac10.out`, script `ac10.sh` beside it). (1) `printf '' \| roadmap-loop.mjs run --lang en --load-limit 80 --session S1` exit 0 printed only "This project has no roadmap yet. Should I write a draft with its unfinished changes, for you to review? Nothing starts now."; no run file, no `roadmap.md`, no worktree. (2) `printf 'add a thing' \| change-loop.mjs open one-change --script devkit --why doubt --lang en` exit 0 (one open change). (3) `roadmap-loop.mjs draft --lang en --load-limit 80` exit 0 printed "I wrote a draft roadmap with one-change, not committed. Review it, deliver it as this project does, then call /devkit roadmap again."; the file reads `# Roadmap`, `## Round 1: unfinished changes`, `- [ ] one-change`; `git status --short` showed `?? .claude/` (the worktree folder) and `?? openspec/roadmap.md`, and `git rev-list --count HEAD` stayed 1: untracked, nothing committed. The `AskUserQuestion` between steps 1 and 3 is the session's part (not run: no Claude session). | pass |
| AC-11 | `other-changes-left-alone` | Fixture tests in gates 2.3 (both cases, each previous-script form). Live: in the scratch project the run touched only the three roadmap changes; no change outside the roadmap existed there. "Next" part (many old changes) not proved. | pass |
| AC-12 | `calling-again-resumes` | Tests in gate 2.3. Live: `record-4.txt` (new session `7e38ad30...`, `/devkit roadmap 2`): a "resumed" line for add-version-flag, already open, reading "1 of 2 in progress", and the same for `add-help-flag`; worktree list in the record shows no third worktree and no change opened twice. | pass |
| AC-13 | `locks-follow-every-change` | Lock tests in gate 3.5. Live: `record-5.txt` (resumed session, run files present): the session's `echo 'echo hello' > hello.sh` was refused with "in a /devkit roadmap run this session writes no product code; the implementation is handed to tdd-implementer by the loop. (Writing it through the shell is gated the same way.)"; `hello.sh` not created; `git stash list` allowed. `hooks.jsonl`: a `stop` refusal with `why":"stage-ready"` for change `add-help-flag` (16:45:46Z) and 20 `agent` allows with no `agent` refusal. | pass |
| AC-14 | `no-end-is-lost` | Tests in gate 3.5. Live: `proof/live-2/hooks.jsonl` (52 lines) holds 20 `"mode":"agent"` allows and 20 `"mode":"subagent-stop"` allows, none refused; both changes went from proposal through review (stage files at `record-4.txt` show proposal, requirements, specs, tasks, review and evidence all `result=passed` for both). Over the scratch stages only; "many ends in a row over whole changes" is "next". No change reached the delivery part (blocked at the missing remote, a limit of the scratch project). | pass |
| AC-15 | `one-task-unchanged` | `change-loop` tests in gates 1.5, 2.3 and 3.5 (294 and 304 tests green at this commit) and the whole suite, 1112 of 1112 (conducting session's log, gate 5.9). | pass |
| AC-16 | `design-and-docs-follow` | `python3 scripts/check.py` and `python3 scripts/gen-catalog.py --check` pass at this commit (exit 0). `docs/adr/0013-the-roadmap-coordinator-is-the-owners-session.md` exists; `docs/roles.md`, `docs/openspec-flow.md`, `plugins/openspec/README.md`, `README.md` and `docs/coordination-design.md` mention the roadmap coordinator (match counts 4, 37, 7, 3, 44). The verifier did not read the prose of the sections for accuracy. | pass |

### Probe and live-run records

- Probe (task 1.1), `proof/probe-record.txt`: B1 to B7 all "true" (background subagents return at once,
  each end starts a new turn, two at once both reach the session, the PreToolUse and SubagentStop
  inputs carry the prompt, agent type and id, `${CLAUDE_SESSION_ID}` is substituted).
- Live test run twice by the conducting session on a scratch project (task 4.1): `proof/live-1/` (four
  defects, fixed in 35c6e8f) and `proof/live-2/` (record-0 to record-5, record-4a, `hooks.jsonl`,
  `commit.txt`, `version.txt`). Excerpts quoted in the table above. Raw turn outputs are outside the
  repository, under `${TMPDIR%/}/devkit-live-roadmap-coordinator/`.

### Limits and notes

- No change of the live test reached the delivery part: the scratch project has no remote, so both ended
  blocked as `design.md` D-17 foresaw.
- AC-7 "others keep running while the owner answers" and AC-14 "many ends in a row" are shown live only
  over the scratch roadmap's stages; the parts marked "next" in each criterion are not proved here.
- AC-8 and AC-10 have a real run of the command-line scripts (rows above), but no run with a Claude
  session: the session's own part (asking the owner, a subagent finishing its stage) is not run.
- The full output of those two runs is kept in the scratch folder
  `${TMPDIR%/}/devkit-evidence-roadmap-coordinator/` and is not under `proof/evidence-runs/`: the
  devkit guard refused the verifier's write there ("pr-verifier only writes its own verdict file"),
  so the excerpts in the rows are the repository's record.
- The whole suite (gate 5.9) was not re-run by the verifier; its result is the conducting session's.
- Retro notes, not defects: "ready, waits for a place" for a ready line when no run is under way, and
  "The others go on." when no other change is running.
- No screenshots: no UI surface is touched.
