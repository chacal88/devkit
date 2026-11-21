<!-- devkit-stage evidence result=passed attempt=1 commit=8364a35494ee8c300738313a4604aa92478858ab -->
Commit: 8364a35494ee8c300738313a4604aa92478858ab

# Evidence: roadmap-coordinator

Verified at HEAD `8364a35494ee8c300738313a4604aa92478858ab` on branch `roadmap-coordinator`, tree clean
before this file. Verifier ran the focused gates and the checkers itself; the whole-suite run is the
conducting session's (cited, not repeated, as instructed).

## Verification

### Gates

| Gate | Command | Result |
| --- | --- | --- |
| 1.5 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^roadmap-loop" --test-name-pattern="^change-loop replies" --test-name-pattern="^change-loop decide" --test-name-pattern="^change-loop wait" plugins/openspec/hooks/guard.test.mjs` | pass: 170 tests, 170 pass, 0 fail, exit 0 (run by the verifier at this commit) |
| 1.5 | `python3 scripts/check.py` | pass: "all checks passed", exit 0 |
| 2.3 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^roadmap-loop" --test-name-pattern="^change-loop" plugins/openspec/hooks/guard.test.mjs` | pass: 287 tests, 287 pass, 0 fail, exit 0 |
| 2.3 | `python3 scripts/check.py` | pass: "all checks passed", exit 0 |
| 3.5 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^roadmap-loop" --test-name-pattern="^change-loop" --test-name-pattern="^worktree" --test-name-pattern="^approval.md" --test-name-pattern="^devkit-lite" plugins/openspec/hooks/guard.test.mjs` | pass: 297 tests, 297 pass, 0 fail, exit 0 |
| 3.5 | `python3 scripts/check.py` | pass: "all checks passed", exit 0 |
| 3.5 | `grep -q "Validation passed" "${TMPDIR%/}/devkit-validate-roadmap-coordinator/phase-3.txt"` | pass: exit 0 (record exists; validation ran with Claude Code 2.1.326) |
| 4.2 | `grep -q '"mode":"stop",.*"decision":"refuse"' "${TMPDIR%/}/devkit-live-roadmap-coordinator/hooks.jsonl"` | pass: exit 0 |
| 4.2 | `grep -q '"mode":"subagent-stop",.*"decision":"allow"' "${TMPDIR%/}/devkit-live-roadmap-coordinator/hooks.jsonl"` | pass: exit 0 |
| 4.2 | `test -s "${TMPDIR%/}/devkit-live-roadmap-coordinator/record-5.txt"` | pass: exit 0 |
| 5.9 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs` | pass: whole suite 1105 tests, 1105 pass, 0 fail, taken from the conducting session's log (gate-5-9.log in the session scratchpad); not re-run by the verifier |
| 5.9 | `python3 scripts/check.py` | pass: "all checks passed", exit 0 |
| 5.9 | `python3 scripts/gen-catalog.py --check` | pass: exit 0 |
| 5.9 | `grep -q "Validation passed" "${TMPDIR%/}/devkit-validate-roadmap-coordinator/phase-5.txt"` | pass: exit 0; record shows Claude Code 2.1.326, commit 771c97a (release commit; 8364a35 changes no manifest), "Validation passed" |

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
| AC-8 | `stop-at-the-end-of-the-stage` | Tests in gates 1.5 and 2.3 only; no live proof of the stop word is claimed. `record-3.txt` is a later turn in the same session; the reading that it exercised the stop word is not asserted. | pass |
| AC-9 | `blocked-change-keeps-its-place` | Tests in gates 1.5 and 2.3. Live: `record-2.txt` and `record-4.txt` show both changes ending blocked because the scratch project has no remote (the record says GitHub could not be read, with the cause "no git remotes found"), the reason named, `add-quiet-flag` waiting for its dependency, and the run ending with a line saying nothing more can start or run by itself and listing what each open change needs. | pass |
| AC-10 | `no-roadmap-offers-a-draft` | Tests in gates 2.3 and 3.5 (command routing and skill, per the tasks' covers lines). Not run live. | pass |
| AC-11 | `other-changes-left-alone` | Fixture tests in gates 2.3 (both cases, each previous-script form). Live: in the scratch project the run touched only the three roadmap changes; no change outside the roadmap existed there. "Next" part (many old changes) not proved. | pass |
| AC-12 | `calling-again-resumes` | Tests in gate 2.3. Live: `record-4.txt` (new session `7e38ad30...`, `/devkit roadmap 2`): a "resumed" line for add-version-flag, already open, reading "1 of 2 in progress", and the same for `add-help-flag`; worktree list in the record shows no third worktree and no change opened twice. | pass |
| AC-13 | `locks-follow-every-change` | Lock tests in gate 3.5. Live: `record-5.txt` (resumed session, run files present): the session's `echo 'echo hello' > hello.sh` was refused with "in a /devkit roadmap run this session writes no product code; the implementation is handed to tdd-implementer by the loop. (Writing it through the shell is gated the same way.)"; `hello.sh` not created; `git stash list` allowed. `hooks.jsonl`: a `stop` refusal with `why":"stage-ready"` for change `add-help-flag` (16:45:46Z) and 20 `agent` allows with no `agent` refusal. | pass |
| AC-14 | `no-end-is-lost` | Tests in gate 3.5. Live: `proof/live-2/hooks.jsonl` (52 lines) holds 20 `"mode":"agent"` allows and 20 `"mode":"subagent-stop"` allows, none refused; both changes went from proposal through review (stage files at `record-4.txt` show proposal, requirements, specs, tasks, review and evidence all `result=passed` for both). Over the scratch stages only; "many ends in a row over whole changes" is "next". No change reached the delivery part (blocked at the missing remote, a limit of the scratch project). | pass |
| AC-15 | `one-task-unchanged` | `change-loop` tests in gates 1.5, 2.3 and 3.5 (287 and 297 tests green at this commit) and the whole suite, 1105 of 1105 (conducting session's log, gate 5.9). | pass |
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
- AC-8 and AC-10 have no live run; they rest on tests.
- The whole suite (gate 5.9) was not re-run by the verifier; its result is the conducting session's.
- Retro notes, not defects: "ready, waits for a place" for a ready line when no run is under way, and
  "The others go on." when no other change is running.
- No screenshots: no UI surface is touched.
