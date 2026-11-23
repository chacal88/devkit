<!-- devkit-stage design result=passed attempt=3 commit=77b15b107e15b2071ba2de372fa75eb23daa390f -->
# Design

Change: `compozy-driver` · Date: 2026-11-22 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(design sources: `requirements.md`, `docs/coordination-design.md` sections 2, 3, 8, 10, 11 and 13,
ADRs 0008, 0009, 0010 and 0016, and the CompozyOS 0.6.2 Loops guide embedded in the `compozy`
binary, read on 2026-11-22). Paths are relative to the repository root and in backticks, never
links: this file moves one folder deeper when the change is archived. Line numbers are those of
`77b15b1` (see "Revision 2026-11-22 (main at 77b15b1)" at the end).

## Context

See `proposal.md` (Why). What exists at `77b15b1`, each fact read in the source:

- `plugins/openspec/hooks/change-loop.mjs` (1622 lines) decides `/devkit change`. `DRIVER_ROUND =
  { compozy: 21, script: 22 }` (`:1059`) makes `projectGate` (`:1069-1075`) answer `driver-not-built`
  for both; `startMode` (`:1081-1118`) calls it for every verb, so `/devkit roadmap`, `/devkit status`
  and `/devkit project` stop there too, and `project-loop.mjs` calls the same `projectGate`
  (`:402`, `:435`). `decide` (`:609-769`) returns one action (`agent`, `session`, `grill` or `end`)
  with `role`, `agent` (`devkit-core:<role>`, from `AGENT` or the delivery row), `brief`,
  `progressKey` and, for ends, `end.state`/`end.why` and a rendered `reply`; `nextAction`
  (`:813-855`) collects the facts; `--after <key>` feeds the K1 and K2 guards (`:632-643`).
  `PACKS` (`:1420-1425`) is the one table of the roles that ship a Claude agent and their pack: 18
  `devkit-core` roles and `openspec-validator`, 19 keys; `NOT_AGENTS` (`:1413`) keeps `owner`,
  `change-coordinator`, `project-coordinator` and `review-bench` out of the hand-off lock's list.
  `openChange` (`:1194`) opens a change.
- The owner's gates the checker ends on (`decide`, `:703-708`, and the delivery rows): the grill
  (kind `grill`), the mock-up (`waiting-mockup`, stage `mockup`, `owner-pending`, detail `file`
  and `folder`, `:705-707`; an answer recorded as changes makes the next action hand the mock-up to
  `screen-designer` again, `owner-changes`, `:685-688`), the plan approval (`waiting-approval`,
  `waiting-approval-again`) and the retro answers (`waiting-retro`). The `ship-change` rows
  `stop-mockup-approval` and `stop-plan-approval` (`plugins/openspec/skills/ship-change/SKILL.md:37-38`)
  say how the session records the mock-up and the plan approval.
- Session steps with no `ship-change` row: `switch-script` (`:681-684`) and `accept-decisions`
  (`:659-664`, right after a current recorded approval while `decisions.md` lists a proposed or
  unreadable record) carry `detail.command`, an argv the checker built; the `devkit` skill
  (`plugins/openspec/skills/devkit/SKILL.md:71`) runs it, and an `accept-decisions` exit 3 is
  declared with `blocked-why.cannot-accept` (`:204`, `:385`); the command's own exit-3 JSON already
  carries that rendered reply (`acceptDecisions`, `:905-938`; `failure`, `:1552-1557`). The agent
  steps `resolve-release-conflict` and `push-rebased` (`ROWS`, `:555`, `:560`) take their dispatch
  sentence from the `devkit` skill's Loop (`SKILL.md:75-76`), not from a `ship-change` row; the
  test-stage steps (`unit-tests`, `e2e-tests`, `fix-tests`, `:715-733`) have no row either.
- The four stage roles of round 16 report outcomes other than `done`: `test-runner` and `e2e-tester`
  `green | red | failure`, `adr-author` `proposed <n> | none-needed | failure`, `screen-designer`
  `drawn | failure` (`plugins/core/agents/*.md`); `change-planner` reports `planned | escalated`,
  `commit-and-pr` `shipped | refused`, `pr-verifier` `verified | defect-found`, `tdd-implementer`
  `success | failure`. A red test stage is not a failure: the checker's next action is `fix-tests`
  (`:727-731`).
- `plugins/openspec/hooks/roadmap-loop.mjs` (973 lines): `classifyLines`, `readLoad`, `limitOf`, the
  run file in the git common directory (`runFilePath`, `:435`), and the `run`, `next`, `status`
  commands of the Claude driver. `run` (`runCmd`, `:774-807`) does not read the driver: the skill
  only calls it after `start` answered `roadmap`.
- `plugins/openspec/hooks/guard.mjs` (972 lines): `role(input)` (`:73-75`) is the acting agent from
  `agent_type`, `''` for the main session; `classify` (`:348-370`) makes `approval.md` a gate file
  of the main session and `mockup.md` a planning file; `writeViolation` (`:387-420`) allows
  `approval.md` only when the actor is `''` (round 16 added the `adr-author` and `e2e-tester`
  branches, `:404-415`; the `approval.md` rule is unchanged).
- Tests make every temporary folder through their pack's `test-tmp.mjs` (`tmpFolder('devkit-...-')`,
  `tmpRoot()`; copies in `plugins/openspec/hooks/`, `plugins/core/skills/review-change/scripts/` and
  `plugins/compozy/skills/`); `test-tmp.test.mjs` refuses a raw `mkdtempSync` or `tmpdir()` call in
  any `*.test.mjs` under `plugins/`, and CI fails when the hook tests leave anything in `$TMPDIR`
  (`.github/workflows/ci.yml:20-33`, `CONTRIBUTING.md:46`). `openspec/config.yaml` adds the rules
  "Existing tests" (a plan that changes a message or doc string lists every test that asserts it)
  and "Test history" (no test reads git history; old content is a fixture or a constant).
- `plugins/core/skills/review-change/scripts/review-round.mjs` is the CLI of the review round's
  rules (`stage1`, `verify`, `outcomes`, `consolidate`, `check-file`), the one the skill's `agents`
  path uses with JSON input files in the temp folder; the rules live once in
  `review-round.workflow.js` (ADR 0008 decision 4).
- `plugins/compozy/skills/compozy-setup/`: `install-kit.mjs` (188 lines) installs `KIT_FILES`
  (`:26-35`: `config.toml`, `README.md`, four `agents/<role>/AGENT.md` for `ROLES = ['tech-lead',
  'dev', 'qa', 'design']`, `loops/openspec-change/loop.yaml`, `bin/devkit-kit`), records digests in
  `.compozy/kit-manifest.json` and throws a usage error for a recorded input with no placeholder
  (`resolveInputs`, `:87-94`). `templates/substitutions.json` has ten placeholders, seven of them
  for the old loop and shells. `bin/devkit-kit` resolves `deliver-check`, `conduct-check` and
  `screens-check` only. Its five test files are not imported by `guard.test.mjs`, so CI never runs
  them (`.github/workflows/ci.yml` runs only `guard.test.mjs`); `install-kit.test.mjs` and
  `devkit-kit.test.mjs` already import `plugins/compozy/skills/test-tmp.mjs`. Since round 16 the
  old shells also carry the new stage roles: the planner shell dispatches `adr-author`, the design
  shell `screen-designer`, the reviewer shell `test-runner` and `e2e-tester`, and the implementer
  shell sets the records `decisions.md` lists and `mockup.md`'s header after the operator's approval
  (`openspec/specs/compozy-kit-setup/spec.md`, "The kit runs the new stages in its four shells").
- This repository adopted the kit: `.compozy/` holds the four shells and the 629-line loop, recorded
  at pack `0.3.0`, every file equal to its recorded digest (checked on 2026-11-22). CompozyOS lists
  that loop in the workspace `devkit` with `source: workspace`, `version: 0` (`compozy loop inspect
  --name openspec-change --workspace devkit`).
- CompozyOS 0.6.2 (`/opt/homebrew/bin/compozy`), read in its embedded Loops guide and probed live:
  node kinds are `run-agent`, `run-loop`, `goal`, `transform`, a literal tool id (`compozy__*`) and
  the controls `fan-out`, `collect`, `branch`, `route`, `gate`, `wait`, `sub-loop`, `ask`; an
  `ask` needs `params.prompt` and `params.expect` (a JSON schema) and parks the node until a human
  answers (`compozy loop respond`); a `fan-out` needs `collection` and `max_fan_out` (both
  validated live on 2026-11-22), its body reads `item` and `index`; `contract.stop_when` is a CEL
  condition that ends the run, else a new generation starts; templates allow only `json`,
  `toJson`, `join`, `default`, `shellQuote` and comparisons, and a value inside a command `check`
  must end with `| shellQuote`; `run-agent` takes `params.environment` (`directory` mode); a
  `run-agent` node's `params.agent` may be an earlier node's output (run
  `looprun-51f6f97521863670`); `compozy loop runs -o json` lists each run's `status` and
  `inputs`; agent sessions see `COMPOZY_SESSION_ID` and `COMPOZY_AGENT` (named in the binary;
  whether the hooks see them is probe P-1).

## Goals / Non-Goals

**Goals:** one generic change loop whose every decision comes from `change-loop.mjs`; the agents
named exactly as the roles, generated from the Claude agents; the owner's gates as CompozyOS
requests whose answers the run records by script; the review round with the same rules in parallel
sessions; the roadmap run in CompozyOS; the old loop and shells removed with a safe reinstall; the
Claude driver untouched.

**Non-Goals:** a new checker or new stage logic (the loop reads `change-loop.mjs` as it is); the
Workflow tool on CompozyOS; `/devkit project` on CompozyOS; the `screen-design` and `screen-demo`
skills' future (they stay shipped, unused by the new loops; their sentences naming the removed loop
are reworded); a lock that fails closed; any change to `devkit-core`'s agents or `review-round.mjs`.

## D-1 The driver gate and the entry (A-1, A-2, A-9; AC-1, AC-11, AC-12)

- `DRIVER_ROUND` becomes `{ script: 22 }`. `projectGate(start, settings, verb)` gains the verb:
  `not-set-up` and `setting-unknown` as today; `script` answers `driver-not-built` as today; the
  `compozy` driver with the verb `project` answers the new mode and key `driver-no-project` (D-12);
  every other case returns `null`. `startMode` passes its verb; `project-loop.mjs` passes
  `'project'` at both calls (`:402`, `:435`).
- With `compozy`, `startMode` answers exactly as on `claude` (`new`, `resume`, `choose`,
  `ask-unfinished`, `nothing`, `roadmap`, `status`, `is-slice`), with `settings.driver:
  'compozy'` in its JSON; the skill branches on that field (D-13). `choose` and `ask-unfinished`
  stay questions of the session: they pick which change, before any run exists.
- New subcommand `change-loop.mjs compozy-start <id> --lang <l>`, the request on standard input
  (empty for a resume). Rows, first match wins, each printing `{ version: 1, mode, change, runId,
  url, reply }`, never a `devkit-run:` line (so the stop lock of ADR 0011 never holds the turn):
  - C1 `<id>` fails `NAME`: mode `name-invalid`, the existing reply, exit 3.
  - C2 `projectGate` stops: that row's mode and reply, exit 3.
  - C3 the CompozyOS check of D-2 fails: mode `compozy-unavailable`, its reply, exit 3.
  - C4 a run of `devkit-change` whose `inputs.change_id` is `<id>` is live (`queued`, `running`,
    `watching`, `needs-approval`, `paused`): mode `compozy-running`, reply with its url, exit 0.
  - C5 `<id>` is known (`knownChange`): start a run with `change_id`, `lang` and an empty
    `request`: mode `compozy-started`, exit 0.
  - C6 `<id>` is new and the request is empty: usage error, exit 3.
  - C7 `<id>` is new and taken (`nameTaken`): mode `name-taken`, the existing reply, exit 3.
  - C8 start a run with `change_id`, `request` and `lang`: mode `compozy-started`, exit 0.
  The change is opened by the run (D-5, kind `open`), never by the session.
- `/devkit roadmap` and `/devkit status` on `compozy`: D-7.

Tests (`change-loop.test.mjs`, names `change-loop compozy start ...`, with the fake `compozy` of
D-2): one per row C1 to C8 (C2 twice: a project not set up whose settings name `compozy`, and an
unknown setting value), each also asserting what was started (or that nothing was) and that the
project's files did not change; `projectGate` per cell: `compozy` with `change`, `roadmap`, `status`
(null) and `project` (`driver-no-project`), `script` (`driver-not-built`), `claude` (null);
`startMode` on `compozy` answers `new` and `resume` with `settings.driver: 'compozy'`; the stop
lock lets the turn end after `compozy-start` printed its JSON (no `devkit-run:` line). In
`project-loop.test.mjs` (names `project-loop compozy ...`): `project-loop start` on `compozy`
answers `driver-no-project`, creating nothing.

## D-2 The CompozyOS helper: `plugins/openspec/hooks/compozy-driver.mjs` (AC-1, AC-9, AC-11)

One module for every call to CompozyOS from the scripts, imported by `change-loop.mjs` and
`roadmap-loop.mjs`; no other file spawns `compozy`. Each function takes `{ env, exec }` so tests
pass a fake: the binary is `env.COMPOZY_BIN` when set, else `compozy` on `PATH`.

- `readiness(root, opts)` returns `{ ok: true }` or the first failing of, in order:
  `not-installed` (spawning the binary gives `ENOENT`), `daemon-stopped` (the socket
  `$COMPOZY_HOME/daemon.sock`, default `~/.compozy/daemon.sock`, refuses a connection or does not
  exist; a child `node -e` connects and exits 0 or 1, so the check never starts the daemon),
  `workspace-unknown` (`compozy workspace info -o json`, run with `cwd` the main checkout, exits
  non-zero), `kit-missing` (`compozy loop inspect --name devkit-change --workspace <main> -o json`
  exits non-zero). Each carries its fixing command: `brew install compozy/compozy/compozy`,
  `compozy daemon start`, `compozy workspace add <main>`, and the `compozy-setup` skill.
- `liveRuns(root, loop, opts)`: `compozy loop runs --loop <loop> --workspace <main> -o json`,
  filtered to the five live states, as `[{ runId, status, inputs }]`.
- `startRun(root, loop, inputs, opts)`: `compozy loop run --name <loop> --workspace <main>
  --no-prompt -o json` with one `--input k=v` per input; returns `{ runId, url }` from the reply's
  run id and `web_url` (`url` null when absent; the reply then names the run id).
- `pauseRun`, `resumeRun`, `cancelRun` (`compozy loop pause|resume|cancel --run-id <id>
  --workspace <main>`) and `pendingRequests(root, opts)` (`compozy loop requests --workspace <main>
  -o json`, the count of pending items).
- Any other failure throws `LoopUsageError` with the command's first stderr line.

Tests (`plugins/openspec/hooks/compozy-driver.test.mjs`, names `compozy-driver ...`, imported by
`guard.test.mjs`): a fake `compozy` (a node script written to a folder made by
`tmpFolder('devkit-compozy-bin-')` of `plugins/openspec/hooks/test-tmp.mjs`, given as
`COMPOZY_BIN`) records its argv and answers canned JSON per subcommand; a `COMPOZY_HOME` made by
`tmpFolder('devkit-compozy-home-')` holds a listening or absent socket. One shared helper of the
file builds both (the other suites that need the fake import it from this file, as
`guard.test.mjs` imports `deliver-check.test.mjs`'s helpers); the socket's server is closed in the
test's `t.after`, so the folder is removed by `test-tmp.mjs` when the test ends and nothing stays in
`$TMPDIR`; no test calls `mkdtempSync` or `tmpdir()`. One test per readiness row, positive and
negative, in order; one per function for its argv and its parsing; `url` null when `web_url` is
absent.

## D-3 The checker's CompozyOS view, the confirm step and the run record (AC-2)

The loop never decides; it reads one JSON object from the checker and has the checker confirm it.

- `compozyView(action, record)` (pure, in `change-loop.mjs`) maps the action of `decide` to
  `{ version: 1, kind, change, root, stage, stage_title, agent, step, brief, progress_key,
  question, reply }`, every field present (`''` when it does not apply), one of fourteen kinds:

| action | `kind` | `agent` | `brief` / `question` |
|---|---|---|---|
| any action, and the record's `failed.key` equals the handed key or the action's `progressKey` | `blocked` | `''` | `question`: the recorded `failed.reply` |
| any action, and the record holds the words of an approved mock-up | `coordinator` | `change-coordinator` | "the owner approved the mock-up (`<words>`): append to `requirements.md`, under `## What the mock-up revealed`, each fact the mock-up settled that the requirements did not hold, as the `ship-change` `stop-mockup-approval` row says (none: say so in one line); change nothing else", in the action's brief frame |
| `agent` | `agent` | the role: `action.agent` after its `:` | the action's `brief`, then the dispatch line of its step: for a step that has a `ship-change` row (`implement`, `fix-review`, `fix-defect`, `fix-checks`, `apply-proposals`, `commit`, `open-pr`, `push`, `open-archive-pr`, `verify`), "add the dispatch sentence of the `ship-change` row of step `<step>`"; for `resolve-release-conflict` and `push-rebased`, "add the dispatch sentence of the `devkit` skill's Loop bullet `<step>`"; for any other step (`unit-tests`, `e2e-tests`, `fix-tests`) and the plan stages, nothing |
| `session`, step `review` | `review` | `''` | `question`: the `blocked` reply with why `role-failed` and the review stage's title |
| `session`, step `gate` | `gate` | `''` | `question`: the `blocked` reply with why `tests-red` and `detail.phase` |
| `session`, a step whose `detail.command` the checker built (`switch-script`, `accept-decisions`) | `command` | `''` | `''` (the record step `run-step` of D-4 runs it; no agent runs it) |
| any other `session` step | `coordinator` | `change-coordinator` | "carry out step `<step>` as the `ship-change` row of that name says, with this `next` object: `<detail JSON>`", in the action's brief frame |
| `grill` | `grill` | `change-coordinator` | one grill turn (D-5), with every answer the record holds |
| end `waiting-for-owner`, `waiting-mockup` | `mockup` | `''` | `question`: the action's `reply`, then the absolute paths of `detail.file` and `detail.folder` under `root` |
| end `waiting-for-owner`, `waiting-approval` or `waiting-approval-again`, no notes recorded | `approval` | `''` | `question`: the action's `reply`, then where the plan is |
| the same, notes recorded | `agent` | `change-planner` | "the owner did not approve the plan and asked: `<notes>`; revise the plan" |
| end `waiting-for-owner`, `waiting-retro`, no answers recorded | `retro-answers` | `''` | `question`: the `reply`, then the path of `retro.md` |
| the same, answers recorded | `coordinator` | `change-coordinator` | "record these answers of the owner as the `ship-change` `stop-retro-answers` row says: `<answers>`" |
| any other `waiting-for-owner` end | `owner` | `''` | `question`: the `reply` |
| end `waiting-on-github` | `github` | `''` | `''` |
| the change is not known in any checkout and the record's handed key is `open/<id>` | `blocked` | `''` | `question`: the `blocked` reply with why `open-failed` (D-12) |
| the change is not known in any checkout, any other handed key | `open` | `change-coordinator` | open the change: choose the script by the rule of the `devkit` skill's "A new change" and run `change-loop open` with the request; with an empty request, open nothing and return `failure` |
| end `blocked` | `blocked` | `''` | `question`: the `reply` |
| end `archived` | `archived` | `''` | `''` |

  `progress_key` is the action's `progressKey`, else `end/<state>/<why>/<stage>`; for `open`,
  `open/<id>`; for the `open-failed` row, `end/blocked/open-failed/open`; for the recorded-failure
  row, `end/blocked/step-failed/<stage>`; for the mock-up facts row, `mockup-facts/<id>`. The rows
  are read top to bottom, first match wins. The `open-failed` row is the K2 guard of the open turn:
  an `open` turn that ended with the change still unknown (an empty request, a name taken
  meanwhile, a failed `change-loop open`) makes the next turn ask the owner to retry or stop, never
  open again silently. Its `confirm` clears the handed key (it is not one of the six recorded kinds
  below), so a retry runs the `open` turn once more. The recorded-failure row is the same guard for
  a `command` step: a refused command makes the next turn ask the owner with the command's own
  reply (for `accept-decisions`, `blocked-why.cannot-accept` naming the file), never run it again
  silently.
- `next --view compozy` (a new flag of `next`) prints that object alone, and passes as `--after`
  the key the run record holds as handed (below), so the K1 and K2 guards of `decide` apply as on
  the Claude driver. Without `--view` the command is unchanged.
- `confirm --change <id> --lang <l> --view <json>` recomputes the view and exits 0 only when every
  field equals the given object; else exit 1, printing the current view. On exit 0, for the six
  kinds `agent`, `coordinator`, `review`, `gate`, `command` and `open`, it records `progress_key` as
  handed; for any other kind it clears the handed key. It also clears the recorded approval notes
  once an `agent` view built from them is confirmed, the recorded retro answers once their
  `coordinator` view is, the recorded mock-up words once the mock-up facts view is, and a recorded
  failure once a view not built from it is.
- The run record: `<git common dir>/devkit-compozy/<id>.json`, `{ version: 1, handed: { key, at } |
  null, failed: { key, reply, at } | null, answers: { grill: [{ question, answer, at }],
  approvalNotes: string | null, retro: string | null, mockup: string | null } }`, written
  atomically (temp file, then rename) under `withLockFile`, outside every working tree, as the
  roadmap run file is (ADR 0013). One pair of functions, `readRunRecord` and `updateRunRecord`,
  reads and writes it for every subcommand. It is bookkeeping: losing it costs one repeated stage
  (or one repeated command, or the mock-up facts of one approval), never a wrong gate. The grill
  answers stay until the requirements stage passes.
- Unreadable input (the parser rule of `openspec/config.yaml`): a record file that is empty, cut
  short or not JSON reads as an empty record and is rewritten whole by the next record step; a
  `--view` argument that does not parse as a JSON object makes `confirm` exit 1, as a differing
  view does.

Tests (`change-loop.test.mjs`, names `change-loop compozy view ...`): one per table row, the
negative of each condition (a recorded failure whose key equals the handed key, equals the action's
`progressKey`, or equals neither, which gives the action's own view; mock-up words recorded or
absent; notes absent or present, answers absent or present, an unknown change with the handed key
`open/<id>` giving `open-failed` and with no or another handed key giving `open`); the agent
dispatch line once per class (`implement` names the `ship-change` row, `resolve-release-conflict`
and `push-rebased` name the `devkit` skill's Loop bullet, `fix-tests` and a plan stage add
nothing); `switch-script` and `accept-decisions` giving `command` with agent `''`, and
`enable-auto-merge` giving `coordinator` (the negative); `waiting-mockup` giving `mockup`, never
`owner`, its question naming `mockup.md` and the `mock/` folder; one per other `waiting-for-owner`
reply key of `decide` giving `owner` (`waiting-merge`, `waiting-archive-merge`,
`waiting-review-dispute`, `waiting-by-hand`, `waiting-unrun-stage`, `waiting-pr-decision`); the key
forms; `next --view` with a handed key blocks with `no-progress` when the state did not move, and
without `--view` prints exactly what it prints at `77b15b1`; `confirm` exits 1 on one differing
field (one test per field), records only for the six kinds (one test per kind), clears for the
others, clears each recorded answer as written above (one test each, and one that a view not built
from it leaves it), and leaves the record unchanged on exit 1.

## D-4 The record steps (AC-3)

Deterministic subcommands of `change-loop.mjs`, each run by a gate node: exit 0 when done, 3 on a
refusal (nothing written or run), 1 for a red gate or a refused command (`run-gate`, `run-step`):

- `record-approval --change <id> --words <text> --lang <l>`: only when the current view is
  `approval` (else exit 3, nothing written); writes `approval.md` in exactly the form of the
  `ship-change` `stop-plan-approval` row (`plugins/openspec/skills/ship-change/SKILL.md:37`): the
  stage header with `result=passed`, the attempt one more than the replaced header's, `commit` the
  checkout's HEAD; `# Plan approval: <id>`; `- Status: APPROVED`; `- Readiness: <approvalState's
  readiness>`; `- Date: <today>`; `` - Owner's words: "`<words, up to 200 characters>`" ``. One
  function, `approvalText(...)`, builds it; a test reads the file back with `approvalState` and gets
  `ok: true`.
- `record-mockup --change <id> --decision approve|changes --words <text> --lang <l>`: only when the
  current view is `mockup` (else exit 3, nothing written); `mockup.md` must start with a valid
  `mockup` stage header (else exit 3, nothing written). It writes `mockup.md` in exactly the form of
  the `ship-change` `stop-mockup-approval` row (`plugins/openspec/skills/ship-change/SKILL.md:38`):
  for `approve`, line 1 becomes `<!-- devkit-stage mockup result=passed attempt=<same n>
  commit=<HEAD> -->` and the file gains `## Owner's approval` with `- Date: <today>` and `- Owner's
  words: "<words, up to 200 characters>"`, and the run record keeps the words as
  `answers.mockup` (the next turn's mock-up facts view of D-3 hands the `requirements.md` part of
  the row to `change-coordinator`); for `changes`, line 1 becomes `result=failed` with the same
  attempt and the file gains `## Owner's notes (attempt <n>)` with the words, and the record keeps
  nothing (the checker's own `owner-changes` row hands the mock-up back to `screen-designer`). One
  function, `mockupText(...)`, builds both forms. An unknown `--decision` is a usage error (exit 3).
- `record-answer --change <id> --gate grill|approval|retro --answer <text> [--question <text>]`:
  appends to or sets the record's answers; refuses a gate that does not match the current view
  (`grill`, `approval`, `retro-answers`): exit 3, the record unchanged.
- These refusals are the barrier against a forged approval that holds whatever probe P-1 finds:
  the view is recomputed by the record step itself, never taken from an argument, so an approval
  recorded while the readiness review, the plan or anything else is due writes nothing
  (compozy-driver spec, "The plan approval is the owner's answer in CompozyOS"); the same holds for
  the mock-up.
- `run-gate --change <id> --lang <l>`: only when the current view is `gate`; runs `detail.command`
  in `root`, each `&&` part on its own as `deliver-check` does, and ticks `detail.task` in
  `tasks.md` when all are green (exit 0); exit 1 when one is red, ticking nothing.
- `run-step --change <id> --lang <l>`: only when the current view is `command` (else exit 3,
  nothing run); runs `detail.command` (an argv, no shell) with `cwd` the action's `root`. Exit 0
  when it exits 0, the record's `failed` cleared. Any other exit: it records `failed: { key:
  <progress_key>, reply }` and exits 1, where `reply` is the `reply` field of the command's JSON
  output when it prints one (for `accept-decisions`, the `blocked` reply with why `cannot-accept`
  naming the file), else the `blocked` reply with why `role-failed` and the stage's title. The
  steps' own commands are unchanged (`accept-decisions` and `script` of `change-loop.mjs`). The
  hooks do not see a gate's command; ADR 0016's Consequences already accept that the accepting
  script writes where the edit lock does not look, and it writes only listed records after a
  current approval.
- `compozy-retry --change <id>`: clears the handed key and a recorded failure, so the next turn
  hands the stage or runs the command again.

Tests: one per subcommand per refusal and per success; `record-approval` while the readiness review
is due (view `agent`) exits 3 and leaves no `approval.md`, and while the retro answers are due
leaves an existing `approval.md` byte for byte; `record-answer --gate grill` while the view is
`approval` exits 3 with the record unchanged; `record-approval` with words longer than 200
characters cuts them; a second approval raises the attempt. `record-mockup`: refused while the view
is `approval` (exit 3, `mockup.md` byte for byte); refused when `mockup.md` has no valid header
(exit 3, unchanged); `approve` writes the passed header with the same attempt and the approval
section, after which `flow-check` reports the mock-up stage passed and the record holds the words;
`changes` writes the failed header and the notes section, after which `decide` hands
`screen-designer` the `owner-changes` brief and the record holds no words; words longer than 200
characters are cut; an unknown `--decision` exits 3. `run-step`: refused while the view is `agent`
(exit 3, nothing run); `accept-decisions` with a current approval and a proposed record sets it
accepted and exits 0 with no `failed`; `accept-decisions` with a listed record that has no status
line exits 1, changes no file and records `failed` whose reply is the command's `cannot-accept`
reply naming that file; a command that exits non-zero with no JSON records the `role-failed`
reply; `switch-script` runs the `script` subcommand and exits 0. `compozy-retry` clears a recorded
failure as well as the handed key.

## D-5 The change loop: `templates/loops/devkit-change/loop.yaml` (AC-2, AC-3, AC-4)

Inputs: `change_id` (string, required), `request` (string, default `""`), `lang` (enum `en`,
`pt-BR`, default `pt-BR`). `concurrency: allow`; `start: [cli, uds]`; `iteration_cap: 0` (no
limit, as the Claude driver waits on GitHub with none); `no_progress.window: 3`;
`stop_when: nodes.read.output.kind == "archived" && nodes.confirm.status == "succeeded"`. Every
command criterion calls `.compozy/bin/devkit-kit change-loop ...` with every runtime value through
`| shellQuote`. One generation is one turn:

1. `read` (`run-agent`, agent `change-coordinator`, prompt starting `Read only:`, see D-8): runs
   `devkit-kit change-loop next --view compozy --change <id> --lang <lang>` and returns its object
   through an `output_schema` of the twelve fields (`kind` an enum of the fourteen kinds of D-3);
   `retry.max_attempts: 2`.
2. `confirm` (`gate`, one command criterion `change-loop confirm ... --view {{ toJson
   .nodes.read.output | shellQuote }}`; `on_result.fail: next_generation`).
3. `by_kind` (`route`): `agent`, `coordinator`, `grill`, `open` go to `run_role`; `review` to
   `run_review`; `gate` to `phase_gate`; `command` to `run_step`; `mockup` to `ask_mockup`;
   `approval` to `ask_approval`; `retro-answers` to `ask_retro`; `owner` to `ask_owner`; `blocked`
   to `ask_blocked`; `github` to `wait_github`; default (`archived`) to `turn_end`.
4. `run_role` (`run-agent`, `agent: "{{ .nodes.read.output.agent }}"`, `environment: { mode:
   directory, directory: "{{ .nodes.read.output.root }}" }`, prompt the `brief`, the person's
   language and, when `request` is not empty, the request; `output_schema`: `outcome` (`done`,
   `failure`), `question` (string), `summary`). `retry.max_attempts: 1`; `on_error.route:
   ask_blocked`. The seat maps the Claude agent's own outcome words to these two (D-8). An `open`
   turn with an empty request opens nothing and returns `failure`; like every `failure` outcome it
   ends the turn through `after_role`, and the next turn's view is the `open-failed` row of D-3 (for
   a stage, K2's `no-progress`), which routes to `ask_blocked`. For the `open` kind (the change
   unknown), the environment is the workspace root.
5. `after_role` (`route`): `kind == "grill" && question != ""` to `ask_grill`; default `turn_end`.
6. `ask_grill` (`ask`, prompt the question; expect `{ answer: string }`), then `record_grill`
   (`gate`: `record-answer --gate grill`).
7. `ask_mockup` (`ask`, prompt `{{ .nodes.read.output.question }}`; expect `{ decision:
   approve|changes, words: string }`), then `record_mockup` (`gate`: `record-mockup --decision
   <decision> --words <words>`, both through `| shellQuote`).
8. `ask_approval` (`ask`; expect `{ decision: approve|changes, words: string }`), then
   `approval_route` (`route`): `approve` to `record_approval` (`gate`: `record-approval`), default
   to `record_notes` (`gate`: `record-answer --gate approval`).
9. `ask_retro` (`ask`; expect `{ answers: string }`), then `record_retro` (`gate`:
   `record-answer --gate retro`).
10. `ask_owner` (`ask`; expect `{ note: string }`): the owner did what the reply asked; the next
    turn reads again.
11. `ask_blocked` (`ask`, prompt `{{ .nodes.read.output.question }}` and the two choices; expect
    `{ decision: retry|stop, note: string }`), then `blocked_route`: `stop` to `stop_run` (`gate`
    with criterion `exit 1`, `on_result.fail: halt`), default to `retry` (`gate`:
    `compozy-retry`).
12. `run_review` (`run-loop`, `loop: devkit-review`, `mode: await`, inputs `change_id`, `lang`,
    `root`); `on_error.route: ask_blocked`.
13. `phase_gate` (`gate`: `run-gate`; `timeout: 3h`; `on_result.fail: { route: ask_blocked }`).
14. `run_step` (`gate`: `run-step`; `timeout: 10m`; `on_result.fail: next_generation`): a refused
    command is recorded by `run-step` itself, and the next turn's view is the recorded-failure row
    of D-3, which routes to `ask_blocked` with the command's own reply.
15. `wait_github` (`wait`, `for: 5m`).
16. `turn_end` (`transform` mapping `done: true`): the target of the routes' defaults.

Every `ask` keeps `responders` at its default (humans only); the run starter and its agents can
never answer (Loops guide, "Human Requests"). The grill's turn: the brief of a `grill` view lists
every recorded answer; the `change-coordinator` agent writes them into `requirements.md`, then
returns the next question in the person's language, or `''` once the owner answered the last one
and it set the stage header to `passed`. A question the owner answers is recorded by `record_grill`
before the generation ends, so a later turn that runs nothing loses no answer.

Tests of the three loops (`plugins/compozy/skills/compozy-setup/scripts/loop-templates.test.mjs`,
names `compozy-loops ...`; no YAML library, so each assertion is anchored on the templates' own
indentation, as the deleted `loop-template.test.mjs` did): each loop's node ids and edges are the
ones of D-5, D-6 and D-7, in order; every `gate` criterion is `type: command` and calls
`.compozy/bin/devkit-kit`; every runtime value inside a `check` ends with `| shellQuote`; no
command sleeps, watches or polls; `run_role`'s agent is `{{ .nodes.read.output.agent }}` and no node
names `tech-lead`, `dev`, `qa` or `design`; every `ask` has an `expect` and no `responders` allowing
agents; `by_kind` routes each of the fourteen kinds as listed (one assertion per kind: `owner` to
`ask_owner`, `blocked` to `ask_blocked`, `mockup` to `ask_mockup`, `command` to `run_step`, and the
rest); `record_mockup` passes `decision` and `words` through `| shellQuote`; the errors of
`run_role` and `run_review` and the failed result of `phase_gate` route to `ask_blocked`, and the
failed result of `run_step` goes to the next generation;
`blocked_route` sends `stop` to `stop_run`, whose criterion fails with `on_result.fail: halt`, and
`retry` to the `compozy-retry` gate; the review loop's lanes take their agent from `item`, and
`verify_lane` is `finding-verifier`; `start` holds `cli` and `uds`; `stop_when` is as written above; and `compozy
loop validate --file` accepts each (skipped when the CLI or the daemon cannot be reached, as before).

## D-6 The review loop: `templates/loops/devkit-review/loop.yaml` (A-5; AC-5)

The three stages of the review skill (`plugins/core/skills/review-change/SKILL.md`, "Run the round
in three stages"), each stage's agents in parallel CompozyOS sessions, the rules and prompts from
`review-round.mjs` (ADR 0008 decision 4), the exchange through JSON files in a folder under the
system temp directory, as the skill's `agents` path does. Inputs `change_id`, `lang`, `root`;
`iteration_cap: 1`; `stop_when: generation >= 1`.

1. `bench` (`run-agent`, `change-coordinator`, environment `root`): the skill's steps 1 to 4 (the
   surface, the structural check, the bench by its matrix or a scoped call, `args` with `head` and
   `path: agents`), writes `args.json` in `<tmp>/devkit-review/<change>/<head>/`, runs
   `devkit-kit review-round stage1`, writes each job's prompt to `prompts/<reviewer>.md`; returns
   `{ structural: PASS|FAIL, dir, jobs: [{ reviewer, prompt_file, save_to }] }`. A failed
   structural check writes `review.md` as the skill says and returns no job.
2. `reviewers` (`fan-out` over `jobs`, `max_fan_out: 6`, `max_parallel: 6`) with body
   `review_lane` (`run-agent`, `agent: "{{ .item.reviewer }}"`): hands the prompt in `prompt_file`,
   unchanged, to its Claude agent and saves the stage-1 object it returns as JSON at `save_to`;
   then `reviewed` (`collect`).
3. `verify_plan` (`change-coordinator`): `review-round verify` with the saved objects; writes the
   verifier prompts; returns `{ jobs: [{ reviewer, id, k, prompt_file, save_to }] }`.
4. `verifiers` (`fan-out`, `max_fan_out: 90`, `max_parallel: 9`) with body `verify_lane`
   (`run-agent`, agent `finding-verifier`); then `verified` (`collect`).
5. `outcomes` (`change-coordinator`): `review-round outcomes`; writes the writer prompts; returns
   the writer jobs.
6. `writers` (`fan-out`, `max_fan_out: 6`) with body `write_lane` (`run-agent`, `agent: "{{
   .item.reviewer }}"`): its Claude agent writes `reviews/<reviewer>.md`; then `written`
   (`collect`).
7. `consolidate` (`change-coordinator`): `review-round check-file` per file, then
   `review-round consolidate`, and writes `review.md` with its stage header as the `ship-change`
   `review` row says, naming the path `agents`. A `check-file` mismatch returns `failure` before
   `review.md` is written: the child run fails, `run_review` routes to `ask_blocked`, and a retry
   runs the round again from the files.

The verdict rule is the script's: any open blocking finding rejects (`consolidate`).

## D-7 The roadmap on CompozyOS (A-8; AC-9, AC-10)

- `roadmap-loop.mjs compozy-start --lang <l> --load-limit <p>`, the owner's words on standard input
  (as `run`): `roadmap-invalid` and `roadmap-none` as `run` answers them; the CompozyOS check (D-2);
  then, for a number `n`: cancel any live `devkit-roadmap` run, resume every paused `devkit-change`
  run, start `devkit-roadmap` with `places=n`, `load_limit=p`, `lang=l`, and reply with where to
  follow it; for `stop`: cancel the live `devkit-roadmap` run, pause every live `devkit-change` run of
  a roadmap line (each pauses at its next node boundary, so its current step ends), and reply with
  the stopping line and one `roadmap-stayed` line per open change (`whereOf`). It never prints
  `devkit-roadmap:`.
- `roadmap-loop.mjs compozy-tick --places <n> --load-limit <p> --lang <l>`: fetches when the
  repository has `origin`; reads the lines with `classifyLines` (archived from `archivedOnDefault`,
  open from `unfinished`); a place is filled by an open line or by a line whose `devkit-change` run
  is live; when places are free and lines are ready, starts none while `readLoad()` is above
  `limitOf(p)` (prints the held line), else starts the ready lines in roadmap order up to the free
  places, each with `startRun(devkit-change, { change_id, request: the line's text, lang })`.
  Exit 0; 3 with the reply when CompozyOS cannot be reached.
- `roadmap-loop.mjs compozy-state`: reads the same facts and exits 0 while something is under way
  or can start, 10 when every line is archived, 11 when nothing can start and no change run is live
  (printing what each open change needs); it writes and starts nothing.
- `status` on the `compozy` driver adds one line after the board: the number of pending CompozyOS
  requests, or the D-2 reason when CompozyOS cannot be reached. On `claude` it is unchanged.
- The loop `templates/loops/devkit-roadmap/loop.yaml`: inputs `places` (number, required),
  `load_limit` (number, default 80), `lang`; `iteration_cap: 0`; `stop_when:
  nodes.state.output.exit_code == 10 || nodes.state.output.exit_code == 11`. Nodes: `tick` (`gate`:
  `compozy-tick`; `on_result.fail: escalate`), `state` (`compozy__terminal_exec`, command
  `.compozy/bin/devkit-kit`, args `roadmap-loop compozy-state --lang <lang>`), `pause` (`wait`,
  `for: 1m`). A held start is checked each minute, as on the Claude driver.

Tests (`roadmap-loop.test.mjs`, names `roadmap-loop compozy ...`): one per `compozy-start` row
(number, stop, invalid, none, unavailable, a live roadmap run cancelled, paused runs resumed); the
tick with free places and ready lines, with no free place, with a loaded machine (starts none), with
a line whose run is live and folder absent (fills a place), with a dependency not archived (not
started) and the same line once its dependency is archived on the default branch (started: AC-10's
rule); the state's three exits; `status` on `compozy` with and without CompozyOS, and on
`claude` unchanged. The fake `compozy` of D-2 records every start.

## D-8 The kit's agents (A-3, A-4; AC-7)

- **Who plays each role on CompozyOS.** Every role in `PACKS` is a CompozyOS agent of the same name.
  `owner` is the loop's `ask` nodes; `review-bench` is the review loop (D-6), its AI steps carried
  by `change-coordinator`; `change-coordinator` gains a Claude agent so its CompozyOS agent has a
  source (A-4): `plugins/openspec/agents/change-coordinator.md` (`tools: Read, Write, Edit, Bash,
  Glob, Grep`; `skills: requirements-grill, retro`), whose body holds the steps the loop hands it:
  open, one grill turn, the delivery and retro steps by their `ship-change` rows (`edit-pr-body`,
  `enable-auto-merge`, `disable-auto-merge`, `update-branch`, `answer`, `retro`, `archive`,
  `tick-roadmap`), recording the owner's recorded retro answers, the `requirements.md` part of the
  `stop-mockup-approval` row after an approved mock-up, and the review loop's four coordinator
  steps. It never writes `approval.md`, `readiness.md`, `evidence.md`, `reviews/`, the header or the
  owner's sections of `mockup.md`, or product code, and it runs neither `accept-decisions` nor
  `script`: those two session steps are `command` views that the loop's `run_step` gate runs (D-3,
  D-4), so no AI runs them. Its report ends with `Outcome: done | failure — <summary>`, and a grill
  turn's report names the next question. Its description says it serves drivers outside Claude Code. `PACKS`
  gains `'change-coordinator': 'devkit-openspec'` (19 keys become 20); `NOT_AGENTS` keeps it, so
  the hand-off lock of a Claude run still refuses it, with either prefix or none (AC-12). In
  `docs/roles.md`, the `change-coordinator` line becomes "- Played today by: The agent
  `devkit-openspec:change-coordinator` on the CompozyOS driver; in Claude Code, the main session
  ...", and the `project-coordinator` line (`:41`), "it has no agent file, as `change-coordinator`
  has none", becomes "it has no agent file." so it stays true.
- **The seat.** A CompozyOS session is a main session to the hooks, so an agent that did the stage
  itself would be refused every gate file and, on `devkit`, product code. Each generated agent is a
  seat: it hands its work, unchanged, to the Claude agent `<pack>:<role>` with the Agent tool and
  returns that agent's report in the shape the node asks; a brief that asks for a dispatch sentence
  gets the one it names (a `ship-change` row, or a `devkit` skill Loop bullet, D-3). The outcome:
  the Claude agent's `Outcome: failure` returns `failure`; every other outcome word returns `done`
  (`success`, `planned`, `escalated`, `shipped`, `refused`, `verified`, `defect-found`, `green`,
  `red`, `proposed <n>`, `none-needed`, `drawn`), with the agent's Outcome line as `summary`: a red
  test run, a refused push or an escalated plan is a stage result the checker judges from the
  files on the next turn (a red unit or E2E stage gives `fix-tests`), never a failure of the seat.
  A report with no Outcome line returns `failure`. One exception: a prompt that starts with
  `Read only:` names one command, which the seat runs itself and whose output it returns
  unchanged, handing nothing on.
- **The generator.** `plugins/compozy/skills/compozy-setup/scripts/gen-agents.mjs [--check]
  [--root <repo>]` reads `PACKS` from `plugins/openspec/hooks/change-loop.mjs` (the one table of
  agents) and each source `plugins/<core|openspec>/agents/<role>.md`, and writes
  `templates/agents/<role>/AGENT.md`: frontmatter `name: <role>`, `display_name` (the role's words
  capitalised), `description` (the source's), `provider: claude`, `permissions: approve-all`,
  `category_path: [Project, Devkit]`, `appearance` (`icon: shield-check` for the reviewers,
  `finding-verifier`, `plan-reality-auditor`, `plan-readiness-reviewer` and `openspec-validator`,
  `list-checks` for the rest; `color: "#5B5BD6"`); then a generated-file comment naming the source,
  the seat paragraph (one constant of the generator), `## The role's instructions` and the source's
  body verbatim. `--check` writes nothing and exits 1 naming each agent that differs, is missing or
  is extra; else 0. Exports `renderAgent(role, pack, sourceText)` and `expectedAgents(root)`.
  Unreadable input: a source that does not start with a `---` line, has no closing `---` line, is
  empty, or lacks `name` or `description` makes the generator (and `--check`) exit 2 naming the
  file, writing nothing.
- **CI.** `.github/workflows/ci.yml` gains the step "CompozyOS agents are up to date": `node
  plugins/compozy/skills/compozy-setup/scripts/gen-agents.mjs --check`, after the catalog check;
  `CLAUDE.md`'s command table gains the row.

Tests (`gen-agents.test.mjs`, names `compozy-agents ...`): the set equals `PACKS`' keys (20) and
holds no `tech-lead`, `dev`, `qa` or `design`; each agent has every frontmatter key the daemon reads
and a body containing its source body; the icon is `shield-check` for the six reviewers,
`finding-verifier`, `plan-reality-auditor`, `plan-readiness-reviewer` and `openspec-validator`, and
`list-checks` for the other ten (`screen-designer`, `adr-author`, `test-runner` and `e2e-tester`
among them); every agent carries the seat paragraph, and that paragraph maps `failure` to
`failure`, each of `green`, `red`, `proposed <n>`, `none-needed` and `drawn` to `done` (one
assertion each), and a report with no Outcome line to `failure`; `--check` is 0 on the repository;
on a copy in a folder made by `tmpFolder('devkit-gen-agents-')` of
`plugins/compozy/skills/test-tmp.mjs`, one changed source line makes `--check` exit 1 naming that
role (AC-7), and generating again makes it 0; a missing and an extra agent each exit 1; each of the
four unreadable sources exits 2 naming the file. In `change-loop.test.mjs`, a new test
`change-loop lock agent: change-coordinator is refused with either pack prefix` asserts that the
hand-off lock of a Claude run refuses `devkit-openspec:change-coordinator` and bare
`change-coordinator` now that `PACKS` holds it (the existing `H3` keeps
`devkit-core:change-coordinator`).

## D-9 The resolver `bin/devkit-kit`

Accepts `change-loop`, `roadmap-loop` (resolved exactly as `deliver-check`: `$DEVKIT_HOOKS`, the
repository checkout, the installed `devkit-openspec` with the highest version) and `review-round`
(the checkout's `plugins/core/skills/review-change/scripts/review-round.mjs`, else the installed
`devkit-core`'s `skills/review-change/scripts/review-round.mjs`, highest version; `$DEVKIT_HOOKS`
does not apply), beside the three it has. Tests (`devkit-kit.test.mjs`): each new subcommand from
each of its sources, and the unknown-subcommand message lists all six.

## D-10 The installer (A-6; AC-8)

- `KIT_FILES`: `config.toml`, `README.md`, every `agents/<role>/AGENT.md` under `templates/agents/`
  (listed at run time, sorted), `loops/devkit-change/loop.yaml`, `loops/devkit-review/loop.yaml`,
  `loops/devkit-roadmap/loop.yaml`, `bin/devkit-kit`. The agents and `bin/devkit-kit` are verbatim.
- `RETIRED`: `agents/tech-lead/AGENT.md`, `agents/dev/AGENT.md`, `agents/qa/AGENT.md`,
  `agents/design/AGENT.md`, `loops/openspec-change/loop.yaml`. Per retired file present: equal to
  its recorded digest, deleted (state `remove`), its digest dropped from the manifest and its folder
  removed when empty; otherwise left (state `kept`) and printed as "edited by the project, left in
  place: delete it or run again with --accept <path>"; with `--accept` for it, deleted (`remove`).
  `--accept` accepts a retired path.
- `substitutions.json` keeps `__TIMEZONE__`, `__SCREEN_MAP__` and `__MOCKUP__`; the seven of the
  old loop and shells leave. `resolveInputs` drops a recorded input with no placeholder and the run
  prints `dropped __NAME__`; `--set` of an unknown token stays a usage error.
- `templates/config.toml`: `[defaults] agent = "change-coordinator"`; the comment on permissions
  names the kit's agents. `templates/README.md`: the agents, the three loops and how `/devkit`
  starts them.
- This repository's `.compozy/` is installed again with the new kit (task 4.7).

Tests (`install-kit.test.mjs`, every project folder made by `tmpFolder('devkit-install-kit-')` of
`plugins/compozy/skills/test-tmp.mjs`, as the file already does): the first install writes the new
set; each retired row (unedited removed with its folder; edited kept and named; no digest kept;
accepted removed; absent nothing); a recorded `__PLANNER__` dropped and named; `--set
__PLANNER__=x` a usage error; the AC-8 proof runs the installer over a scratch copy of the old kit
and asserts the new files, the four removed files and the kept one named in the output. The old
kit's five files are held as constants of the test with a manifest recording their digests and the
old inputs, one file then hand-edited: the installer judges a retired file only by its recorded
digest, and no test reads git history for the deleted templates ("Test history",
`openspec/config.yaml`). The owner-run `reinstall.md` of D-18 uses the real old kit instead.

## D-11 The approval lock in a CompozyOS session (coordination-locks ADDED)

`guard.mjs` gains `compozySession(env)`: `env.COMPOZY_SESSION_ID` is non-empty. In
`writeViolation`, a write to an `approval.md` (`owner === ''`) is refused when `compozySession`
holds, whatever the actor, with the reason "in a CompozyOS session approval.md is written only by
the kit's record step, from the owner's answer"; otherwise the rule is the one at `77b15b1`. The
record step is a node script the hooks never see. Tests (`guard.test.mjs`, names `guard compozy
approval ...`): Write tool, main session, CompozyOS env: refused; Bash redirect, same: refused;
subagent, CompozyOS env: refused; main session, no CompozyOS env: allowed; subagent, no CompozyOS
env: refused with the reason of `77b15b1`. Probe P-1 decides whether the hooks see the variable; if
they do not, the rule stays and is inert, and the ADR says so.

## D-12 The messages

New keys of `MESSAGES` in both languages, plain and with no internal term (the message-table test
of `change-loop.test.mjs` applies): `driver-no-project` ("/devkit project does not run on CompozyOS
yet; nothing was run."), `compozy-started` ("{id} runs in CompozyOS now: follow it and answer its
questions there, at {url}."), `compozy-started-no-url` (the same, naming the run {run}),
`compozy-running` ("{id} already runs in CompozyOS: {url}."), `compozy-not-installed` (names
{fix}), `compozy-stopped` (names {fix}), `compozy-workspace` (names {fix}), `compozy-kit-missing`
(names the CompozyOS setup skill), `compozy-roadmap-started` ("The roadmap runs in CompozyOS with up
to {places} changes at once: {url}."), `compozy-requests` ("{n} questions wait for you in
CompozyOS."), `blocked-why.open-failed` (completes the `blocked` reply: "the run could not open
it; start it again from Claude Code with its request, /devkit change <request>"). Each says that
nothing was run where nothing was. No new key for the mock-up or for a refused command: the
`mockup` view asks with the existing `waiting-mockup` reply, and a refused `accept-decisions` is
asked with the command's own reply, the existing `blocked-why.cannot-accept` (`:204`, `:385`); a
command that prints no reply uses the existing `blocked-why.role-failed`. The exact `pt-BR` wording
is the implementer's, within these meanings and parameters.

## D-13 The `devkit` skill

`plugins/openspec/skills/devkit/SKILL.md` gains the section `## On the CompozyOS driver`, after
`## Start`, read when `start`'s JSON has `settings.driver: compozy`: `new` (propose the id by the
rule of "A new change", choose no script, run `change-loop.mjs compozy-start <id> --lang ...` with
the request through the quoted heredoc; `name-taken` picks another id), `resume` (the same with the
`change`, no request), `choose` and `ask-unfinished` (asked as today, then `compozy-start`),
`roadmap` (`roadmap-loop.mjs compozy-start` with the arguments through the heredoc), `status`
(unchanged), `driver-no-project` (say it, end the turn). In every case say `reply` and end the turn:
the session runs no loop, hands no stage and asks nothing of the change. `## Start` lists
`driver-no-project` among the modes it says and ends on.

## D-14 The new ADR and the Notes (A-11)

`docs/adr/0017-compozy-runs-the-short-loop.md` (0016 went to stage-roles; 0017 is the next free
number on `main` at `77b15b1`; at the merge of `main` it takes the next free one on `origin/main`,
and every reference moves with it), status `proposed`, `accepted` with `- Accepted by:` quoting
`approval.md` when the owner's words accept it. `- Amends:` ADR 0009 (its Decision's first and
third bullets and its review trigger's first clause), ADR 0008 decision 5 (a third path for the
round's three stages, on the CompozyOS driver only) and ADR 0016 decision 3's last sentence ("In
the CompozyOS kit the implementer sets them before its first phase, after the operator's
approval."): the implementer shell that sentence names leaves with the old kit, and on CompozyOS
the records are accepted by the same `accept-decisions` script as on the Claude driver, run by the
loop's `run_step` gate right after the recorded approval. Decision:

1. On CompozyOS a change runs as one short generic loop: each turn asks `change-loop.mjs`, the
   checker the Claude driver asks, runs the agent it names, and has every gate decided by the same
   scripts (`change-loop.mjs` reading `flow-check` and, through `conduct-check`, `deliver-check`);
   the twelve-stage loop and its four shells leave.
2. One CompozyOS agent per role that has a Claude agent file, named as the role, generated from it,
   checked in CI; each hands its stage to the Claude agent, so the hooks judge both drivers alike.
3. `/devkit` starts the run; the roadmap run starts change runs on its own, never an app session,
   and merges nothing: the ship mode decides as before (ADR 0002).
4. The owner's gates (the grill, the mock-up approval, the plan approval, the retro answers) are
   CompozyOS human requests; their answers are recorded by scripts, and no tool of a CompozyOS
   session writes `approval.md`. The session steps that run a command the checker built (accepting
   the plan's decision records after the recorded approval, switching the script) are run by the
   loop itself, with no agent; this replaces ADR 0016 decision 3's CompozyOS sentence, and the rest
   of ADR 0016 is unchanged.
5. The review round's three stages run as parallel CompozyOS sessions over `review-round.mjs`, with
   the same rules.
6. The run's state is bookkeeping: each turn re-reads the files, a killed run restarts from them.

It has the headings of the other ADRs (Context, Decision, Consequences, Review trigger,
Alternatives considered); its Consequences take the rows of "Risks / Trade-offs" below that touch
the decision (the seat's reliance on the hand-off, the approval lock's dependence on P-1, the run
record as bookkeeping), its review trigger names CompozyOS dropping `params.agent` templating, the
hooks stop seeing the seat's subagent, or a gate deciding readiness outside the scripts, and its
alternatives table is the one under "Alternatives considered" below. Notes, each dated and placed
after the record's existing Notes so the asserted ones stay where the tests read them (D-19):
ADR 0009 (compozy-driver: what the new ADR amends), ADR 0008 (the CompozyOS path of decision 5),
ADR 0016 (decision 3's CompozyOS sentence is replaced by ADR 0017's decision 4), ADR 0010
(decision 4's CompozyOS driver is built; the CompozyOS planner is named `change-planner`, the
owner's choice on 2026-11-22, grill question 4, over the `planner` of the 2026-11-19 Note).
`openspec/config.yaml`'s `ADRs:` line gains `0017 CompozyOS runs the short loop, amends 0008, 0009
and 0016`. When accepted, ADRs 0008, 0009 and 0016 get `- Amended by ADR 0017
(0017-compozy-runs-the-short-loop.md)` in their header, after their status line.

## D-15 The documents

Every sentence that would be false at the shipping commit is corrected, in every file that repeats
it (found with `grep -rn` over the Markdown files for `twelve-stage`, `role shell`,
`openspec-change`, `tech-lead`, the word planner in backticks, `round 21` and `not built`, outside
`openspec/changes/`, `openspec/specs/` (the deltas carry those), `docs/adr/` (Notes only) and
`CHANGELOG.md`). Kept as history: the team names of `docs/coordination-design.md` section 2
(`manager`, and `tech-lead` for the change coordinator, decided on 2026-11-19) and the ticked
`compozy-loop-v2` line of `openspec/roadmap.md`. Corrected:
`docs/compozy-kit.md` (rewritten: the three loops, the agents and the seat, how `/devkit` starts a
run, the owner's requests, reinstalling over the old kit), `docs/roles.md` (the intro's CompozyOS
sentence; `change-coordinator`'s note and "Played today by"; `owner` and `review-bench` on
CompozyOS; the `project-coordinator` "Played today by" line, `:41`, which says `change-coordinator`
has no agent file, D-8), `docs/coordination-design.md` (the Tense paragraph; section 2's names paragraph and
"two roles called `tech-lead`"; section 10's CompozyOS bullet, built; section 11's rows 9 and 12
and the `after:` paragraph; section 13's "CompozyOS accepts the generic loop", proved by this
change; Open points without "Whether CompozyOS can choose the role", added to the answered
sentence; the "What stays shipped" row of the CompozyOS loop: removed in round 21),
`openspec/roadmap.md` (the `coordination-cleanup` line no longer names the old CompozyOS loop; the
`compozy-driver` line names `change-planner`), `docs/openspec-flow.md` (`:208`, the CompozyOS
delivery loop as the other driver; `:217`, the `compozy` driver's round; `:687`, the
troubleshooting row "says the driver is not built"; and the CI snippet's pin, `:594`, `:595`,
`:604`, D-16), `docs/conventions.md` (`:24`), `README.md` (`:15`), `CLAUDE.md` (`:20`, `:53-54`,
the command row), `CONTRIBUTING.md` (`:42`, the suites the hook suite imports),
`plugins/compozy/README.md`, the `compozy-setup` skill (description, steps, re-run states
`remove`, `kept`, `dropped`), `plugins/compozy/.claude-plugin/plugin.json` and
`.claude-plugin/marketplace.json` descriptions, `plugins/compozy/skills/screen-design/SKILL.md`
(`:3`, `:29`, `:58-60`, `:64`, `:75`: the old loop's design gate and operator) and
`plugins/compozy/skills/screen-demo/SKILL.md` (`:48`, `:61`, `:65`), then `python3
scripts/gen-catalog.py` for `docs/catalog.md` and the READMEs' catalog blocks. The anchors are
those of `77b15b1`; the implementer re-runs the `grep -rn` above, which is the list that counts.

## D-16 Versions, CI and release

Read from `plugin.json` and `.claude-plugin/marketplace.json` at `77b15b1`: devkit-openspec 0.22.1
to 0.23.0; devkit-compozy 0.3.1 to 0.4.0; the marketplace 0.26.1 to 0.27.0 (devkit-core stays
0.10.1: its agents are only read). `CHANGELOG.md` gains `## 0.27.0 — the CompozyOS driver` above
`## 0.26.1`. The CI snippet of `docs/openspec-flow.md` pins `v0.23.0` (`:594`, `:595`, `:604`), and
the test that pins it moves with it (T-7). After the merge: tag `v0.23.0` on the merge commit
(Workflow follow-up). When `main` moves these numbers again before the merge, they are recomputed
from the files then, as the ADR number is. `guard.test.mjs` imports the five setup
suites (`install-kit`, `devkit-kit`, `gen-agents`, `loop-templates`, `adoption`) and
`compozy-driver.test.mjs`, so the one CI command runs them.

## D-17 The probes (phase 1)

Run by the session that conducts this change, never `tdd-implementer`, in a scratch git repository
outside this one registered as the workspace `devkit-probe` (`compozy workspace add <path> --name
devkit-probe`, removed after with `compozy workspace remove devkit-probe`), with throwaway loops
created there and deleted after. Each result, with the command and its output, goes to
`openspec/changes/compozy-driver/proof/probes.md`, one `## P-<n>` heading each.

| Id | What | Passes when | When it fails |
|---|---|---|---|
| P-1 | a seat's Bash env | `COMPOZY_SESSION_ID` is set in a `provider: claude` agent session | D-11 stays inert; the ADR says so |
| P-2 | a seat hands work on | the session's Agent call carries `subagent_type: devkit-core:codebase-researcher` and its answer returns | stop: D-8 does not hold; to the owner |
| P-3 | `stop_when` and `iteration_cap: 0` | generations continue while false and the run ends `done` when true | stop; to the owner |
| P-4 | `fan-out`, `item`, `collect` | lanes run at once with `{{ .item.x }}` as agent and prompt; the node after `collect` runs once after all; an empty collection settles and the next node runs | stop; to the owner (the round's sessions are AC-5) |
| P-5 | gate commands | `.compozy/bin/devkit-kit` resolves from the criterion's cwd; `toJson ... \| shellQuote` passes an object; `on_result.fail: { route: x }` routes; `timeout: 3h` validates | stop; to the owner |
| P-6 | workspace loops | a file at `.compozy/loops/<name>/loop.yaml` of the workspace is listed and run by name without `loop create`; `loop run -o json` gives a run id (and `web_url`) | the kit's setup step and D-2's `kit-missing` fix name `compozy loop create --file`; design amended |
| P-7 | `wait` and `run-loop` | `for: 1m` resumes; an awaited child with inputs settles the parent node | stop; to the owner |
| P-8 | `ask` | the prompt renders a node output; `compozy loop respond --payload` moves the run; the answer is read later in the same generation | stop; to the owner |
| P-9 | the daemon socket | `$COMPOZY_HOME/daemon.sock` accepts a connection while the daemon runs | D-2 reads `compozy status -o json` instead; design amended |
| P-10 | `compozy__terminal_exec` | `exit_code` is an integer for a short command, run in the workspace root | the state node becomes a `gate` per end state; design amended |
| P-11 | `route` | `{ when, to }` over a `run-agent` output and its `default` | stop; to the owner |
| P-12 | runs | `loop runs --loop -o json` carries `inputs` and `status`; `pause`, `resume`, `cancel` by run id | stop; to the owner |
| P-13 | the readiness reads | `compozy workspace info -o json` exits non-zero in an unregistered folder; `loop inspect --name <unknown>` exits non-zero | D-2 matches the path in `compozy workspace list -o json` and the name in `compozy loop list -o json`; design amended |

"Stop; to the owner" means the change stops at phase 1 with the record and a revised plan (spec
delta and design) goes back for the owner's approval before phase 2.

## D-18 The local proof (AC-1 to AC-5, AC-8, AC-9, AC-11)

Run by the conducting session with the owner, after phase 4, in a scratch project outside this
repository (`devkit-proof`, a git repository with no remote, `openspec-setup` done on the `devkit`
script, `devkit.driver: compozy`), registered as a CompozyOS workspace and removed after. The
branch's packs are installed into it at project scope from a temporary local marketplace: a copy of
this worktree's `plugins/` and `.claude-plugin/marketplace.json` renamed `devkit-proof`, added and
removed with the desktop app's bundled Claude Code (`CONTRIBUTING.md`), so `devkit-kit` resolves the
branch's `devkit-openspec` 0.23.0 and the seats find `devkit-openspec:change-coordinator`.
`compozy-setup` installs the kit there. Records under `openspec/changes/compozy-driver/proof/`:

- `local-run.md` (AC-1 to AC-5): the `/devkit change` reply (AC-1); the owner closes the session;
  the owner answers every request in CompozyOS (each grill question one at a time, the plan
  approval) (AC-3); `approval.md` as written, and the `accept-decisions` step run by `run_step`
  when the proof change's `decisions.md` lists a record; a table per generation from `compozy loop nodes --run
  <id> --all -o json`: the `read` kind and agent, the `run_role` session's agent (AC-2); the run
  reaches the review round and `review.md` with no Claude Code session open (AC-4); the review
  child run's lanes with their start times and agents, the verifier lanes per blocking finding,
  and the verdict (AC-5). When the round raises no blocking finding, the conducting session commits
  a seeded defect on the change's branch (a deleted test of the delivered function) and runs
  `devkit-review` again with `compozy loop run`, recording the second round.
- `roadmap.md` (AC-9): a test roadmap of three independent lines; `/devkit roadmap 2` starts two
  change runs (from `compozy loop runs`); with `load_limit` 1 a new start is held (the tick's line).
- `not-running.md` (AC-11): the three replies with `PATH` lacking `compozy`, with the daemon
  stopped by the owner for the check, and `/devkit project billing`; `git status` unchanged each
  time.
- `reinstall.md` (AC-8): the installer's output over a scratch copy of the real old kit: this
  repository's `.compozy/` files and `kit-manifest.json` as they are at `77b15b1` (`git show
  77b15b1:.compozy/<path>`, an owner-run step, not a test), one shell hand-edited after the copy.

The mock-up approval is proved here by the D-3, D-4 and D-5 tests; its live run needs a change
flagged `ui` and is recorded by the dogfood line (task 6.4), as the retro answers are.

## D-19 Tests that pin a rule this plan replaces

Found by searching every suite under `plugins/` (all `*.test.mjs`), `scripts/check.py` and
`.github/workflows/ci.yml` for `driver-not-built`, `compozy`, `tech-lead`, `openspec-change`,
`role shell`, `__PLANNER__` and the agent-file lists. Every other existing test runs unchanged.

| Id | Test (file) | Invariant · layer · suite | What happens |
|---|---|---|---|
| T-1 | `change-loop start: S5 the compozy and script drivers are not built and run nothing` (`change-loop.test.mjs`) | an unbuilt driver runs nothing · `projectGate` · guard suite | keeps `script` (round 22) only; `compozy` moves to the new `change-loop compozy ...` tests |
| T-2 | `change-loop open: O3 refuses in a project not set up or with an unknown or unbuilt driver` (`change-loop.test.mjs`) | `open` refuses where `/devkit change` refuses · `openChange` · guard suite | the `compozy` row leaves the refusals; one assertion that `open` creates the change on `compozy` (the run opens changes there) |
| T-3 | `roadmap-loop start: roadmap and status are routed` (`roadmap-loop.test.mjs`) | roadmap and status stop where change stops · `startMode` · guard suite | `compozy` leaves the equality loop; it asserts `roadmap` and `status` modes with `settings.driver: compozy` |
| T-4 | `project-loop start: /devkit change start routes project to the project gate and runs nothing` (`project-loop.test.mjs`) | project stops where change stops · `startMode` · guard suite | for `compozy` it asserts `driver-no-project` instead of the change verb's answer |
| T-5 | `project-loop start: step 1 the project gate answers first, as for /devkit change` (`project-loop.test.mjs`) | the gate answers first · `project-loop start` · guard suite | the `compozy` row expects `driver-no-project` and its reply |
| T-6 | `change-loop skills: every shipped stage agent declares its stage's skills` (`change-loop.test.mjs`) | only the session's, the review skill's and the owner's roles lack an agent · agent files · guard suite | the bare list becomes `['owner', 'review-bench']` (change-stages MODIFIED, rebased on main's block, which names the four round-16 roles) |
| T-7 | `change-loop docs: the design records the answers` (`change-loop.test.mjs`) | the CI snippet pins the current release · docs · guard suite | the pin assertion `v0.22.1` becomes `v0.23.0`, and `v0.22.1` joins the "no pin left" list (`v0.22.0` is already there); its comment names compozy-driver and release 0.27.0; every other assertion of the test runs unchanged, and D-14 and D-15 keep the sentences it reads (Open points, section 2's two "Decided" sentences, the ADR 0008, 0009, 0010 and 0011 Notes and headings) |
| T-8 | `change-loop skill: the sections of D-3 to D-9 and the modes of start` (`change-loop.test.mjs`) | the skill keeps its sections and start modes · skill text · guard suite | the headings list gains `## On the CompozyOS driver` after `## Start`; the modes gain `driver-no-project` |
| T-9 | `project-loop skill: the start reads the words through the quoted heredoc and carries every start mode` (`project-loop.test.mjs`) | the project section names every start mode · skill text · guard suite | the modes gain `driver-no-project` |
| T-10 | `role-shells.test.mjs` (all 13 tests, the five `stage-roles kit: ...` tests included) | the four shells' keys, monitors and rules, and the round-16 roles they dispatch · kit templates · not run in CI | deleted with the shells (compozy-kit-setup REMOVED "The kit runs the new stages in its four shells"); `gen-agents.test.mjs` owns the agents' keys, and the round-16 roles run as their own agents through the checker (`change-loop compozy view ...`) |
| T-11 | `loop-template.test.mjs` (all 25 tests, the three `stage-roles kit: ...` tests included) | the seventeen-node loop's shape · kit template · not run in CI | deleted with the loop; `loop-templates.test.mjs` owns the three new loops |
| T-12 | `adoption.test.mjs` (all 5 tests: the shells, `loop.yaml` guards, the resolver) | this repository's `.compozy/` is the rendered kit · install · not run in CI | rewritten for the new file set; imported by the guard suite |
| T-13 | `install-kit.test.mjs`: `a first install writes the eight files ...`, `an edited loop.yaml is left in place ...`, the two `field-fixes 8 grill: ...` tests | the install record and the grill rule of the old loop · installer · not run in CI | the first two move to the new set and `loops/devkit-change/loop.yaml`; the two grill tests are deleted (compozy-kit-setup REMOVED) |
| T-14 | `devkit-kit.test.mjs`: `exit 3 on an unknown subcommand` | an unknown subcommand exits 3 · resolver · not run in CI | unchanged; a new test asserts the message lists the six subcommands |

The test `change-loop lock agent: the accepted packs are the ones docs/roles.md names` (`:2082`)
runs unchanged and holds the new `PACKS` row and the new `docs/roles.md` line together; the
hand-off test `H3` keeps refusing `devkit-core:change-coordinator`, and the new test of D-8 adds
the other two forms.

Doc tests that read the files D-14 and D-15 edit, found by grepping every `*.test.mjs` for the
edited files' names ("Existing tests", `openspec/config.yaml`), run unchanged; the edits keep every
sentence they assert: `roadmap-loop docs: the documents follow` (`roadmap-loop.test.mjs:1890`) and
`followups ADR 0014: the documents follow` (`:2675`) (section 10's background stages, section 13's
"Many background subagent ends" sentence, Open points' "how the load is measured", the ADR 0014 citations
in `README.md`, `docs/roles.md` and `docs/coordination-design.md`), `project-loop docs: the
documents follow` (`project-loop.test.mjs:1817`: the Tense paragraph naming `/devkit project`,
sections 1 and 7, the `0.24.0` CHANGELOG entry), `flow-check AC-2: the role document covers every
role` (`flow-check.test.mjs:246`: a `##` heading per role), and the two `stage-roles docs: ...`
tests (`change-loop.test.mjs:3201`, `:3221`: ADR 0016's first line, headings, status, `Amends:`
and `Accepted by:` lines, which the new Note and `Amended by` line leave as they are; ADR 0010's
and 0011's first eight lines, which this change does not touch).

## Proof map

| AC | Proved by | Where |
|---|---|---|
| AC-1 | D-1 tests; `local-run.md` | here |
| AC-2 | D-3 tests; `loop-templates.test.mjs`; `local-run.md` table | here |
| AC-3 | D-3, D-4 and D-5 tests (grill, mock-up, approval, retro); `local-run.md` (grill, approval) | here; the retro answers and the live mock-up approval dogfood |
| AC-4 | `local-run.md` | here |
| AC-5 | `loop-templates.test.mjs` (review loop shape); `local-run.md` | here |
| AC-6 | the first real change on CompozyOS | dogfood |
| AC-7 | `gen-agents.test.mjs`; the CI step | here |
| AC-8 | `install-kit.test.mjs`; `reinstall.md` | here |
| AC-9 | D-7 tests; `roadmap.md` | here |
| AC-10 | D-7 tick test (an archived dependency frees a line) | dogfood (archive needs GitHub) |
| AC-11 | D-1, D-2 tests; `not-running.md` | here |
| AC-12 | the whole hook suite, its existing tests unchanged except T-1 to T-9 | here |

## Alternatives considered

| Option | Why not |
|---|---|
| Keep the twelve-stage loop with the renamed roles | Two stage orders to keep equal; the checker already owns the order (ADR 0010 decision 3) |
| A translation table from roles to the four shells | The owner chose one agent per role, named as the role, with no table (A-3) |
| The seat does the stage itself and the hooks trust `COMPOZY_AGENT` | A lock relaxed on an environment variable; product code and gate files would rest on it; the seat keeps the hooks exactly as on the Claude driver |
| The loop reads the checker through `compozy__terminal_exec` and templates | Templates have no JSON parsing and `params.agent` needs a string; the agent read plus a deterministic `confirm` gives typed fields that cannot be wrong when a stage runs |
| CompozyOS's `general` agent for the read | Its provider and permissions are the user's defaults, not the kit's; a `Bash` call may wait for an approval |
| `change-coordinator` played by the loop alone, no agent | The grill, the retro and the delivery steps need an AI with the devkit's skills and hooks; an agent with no Claude source would break AC-7 |
| The review round in one seat through the skill's `agents` path | Reviewers would share one CompozyOS session; A-5 asks for a session each |
| The roadmap as one long CompozyOS session | A session that remembers is what ADR 0010 decision 3 rejects |
| `accept-decisions` and `switch-script` carried by the `change-coordinator` agent, which runs `detail.command` | An AI would run a deterministic command, and a refusal would come back as the agent's `failure`, which the next turn can only report as "no progress", losing the command's own reason (`cannot-accept` naming the file); the `run_step` gate runs it with no AI and keeps the reason for the owner's question |
| The mock-up approval as a free `owner` request that records nothing | The run would wait forever: the checker moves on only when `mockup.md`'s header is passed or failed, which the session writes on the Claude driver (`stop-mockup-approval`) |
| A record step that also writes the mock-up's facts into `requirements.md` | Choosing which facts the mock-up settled is a judgement; the script records the owner's answer and the `change-coordinator` agent writes the facts, as the approval notes go to `change-planner` |
| An ADR-free change | It changes ADR 0009's gates and review trigger, ADR 0008 decision 5 and ADR 0016 decision 3's CompozyOS sentence (config rule) |

## Risks / Trade-offs

| Risk | P | I | Mitigation |
|---|---|---|---|
| A CompozyOS semantic differs from the guide (P-3 to P-12) | MEDIUM | HIGH | phase 1 probes each before any code; a failure stops the change for the owner |
| The read agent miscopies the view | MEDIUM | LOW | `confirm` compares every field with the checker; a mismatch runs nothing; `no_progress.window` stalls a run that keeps failing |
| The seat skips the hand-off and does the stage itself | LOW | MEDIUM | the hooks refuse its gate files and product code (main session); the stage stays undelivered and K2 blocks it |
| A forged `approval.md` by a CompozyOS session | LOW | HIGH | D-11 refuses every tool write there (if P-1 holds); the record step is the only writer |
| The local proof's temporary marketplace disturbs the owner's plugins | MEDIUM | MEDIUM | a distinct marketplace name, project scope in a scratch project, removed after; owner-run |
| The review loop's fan-in or file exchange breaks a round | MEDIUM | MEDIUM | P-4; the exchange folder is under the temp directory and the round can run again from the files |
| A project edited an old shell and loses work on reinstall | LOW | HIGH | an edited retired file is never deleted without `--accept` (D-10) |
| A refused `accept-decisions` or `switch-script` loops on CompozyOS | LOW | MEDIUM | `run-step` records the refusal; the next turn asks the owner with the command's own reply, and only `compozy-retry` runs it again (D-3, D-4) |
| An approved mock-up's facts never reach `requirements.md` (the run is killed between the record and the coordinator turn) | LOW | LOW | the words stay in the run record until the facts view is confirmed; the record is bookkeeping, the gate (`mockup.md`'s header) is already written from the owner's answer |
| A seat reads a non-failure outcome (`red`, `refused`, `escalated`) as a failure and blocks the run | MEDIUM | MEDIUM | the seat paragraph maps only `failure` to `failure` and the generator's test asserts it; the checker judges the stage from the files on the next turn |
| The new tests leave sockets or folders in `$TMPDIR` and CI's empty-`TMPDIR` step fails | MEDIUM | LOW | every folder through `test-tmp.mjs`; the fake daemon's server is closed in `t.after`; the gates run the suite before the push |
| `main` moves the ADR number or the versions again before the merge | MEDIUM | LOW | both are recomputed at the merge of `main` from `origin/main` (D-14, D-16) |
| The suite grows past its 13 minutes | MEDIUM | LOW | the CompozyOS tests use the fake binary; the setup suites are small |

**Assumptions** (where the plan breaks if wrong): the facts of Context, each probed or read on
2026-11-22; Claude Code sessions started by CompozyOS load the project's devkit packs and their
hooks (the old loop's shells relied on it, ADR 0009 Context); `review-round.mjs`'s CLI is stable
(`plugins/core/skills/review-change/SKILL.md`, "The `agents` path"); `compozy install` creates
nothing the kit relies on beyond the daemon (the kit ships its own agents).

## Migration Plan

A project on the old kit runs `compozy-setup` again: the unedited old files are removed, edited
ones are kept and named, the new agents and loops are written; it sets `devkit.driver: compozy`
when it wants `/devkit` to start CompozyOS runs. Runs of the old loop under way finish on the loop
definition CompozyOS already holds. Rollback: revert the merge; a project reinstalls the previous
kit with the previous pack version (its manifest records the inputs it needs again only for the
placeholders that return, which take their defaults).

## Implementation plan

**Per surface.** devkit-openspec (scripts, the hook, the skill, the new agent): D-1 to D-4, D-7,
D-11 to D-13. devkit-compozy (templates, installer, generator, resolver): D-5, D-6, D-8 to D-10.
This repository (docs, ADRs, CI, `.compozy/`, versions): D-14 to D-16. CompozyOS (probes and
proof, owner-run): D-17, D-18. Order: probes, then the scripts the loops call, then the kit, then
the proof, then the record.

**Files.** Create: `plugins/openspec/hooks/compozy-driver.mjs`, `plugins/openspec/hooks/compozy-driver.test.mjs`,
`plugins/openspec/agents/change-coordinator.md`, `plugins/compozy/skills/compozy-setup/scripts/gen-agents.mjs`,
`plugins/compozy/skills/compozy-setup/scripts/gen-agents.test.mjs`,
`plugins/compozy/skills/compozy-setup/scripts/loop-templates.test.mjs`,
`plugins/compozy/skills/compozy-setup/templates/agents/<role>/AGENT.md` (20, generated),
`plugins/compozy/skills/compozy-setup/templates/loops/{devkit-change,devkit-review,devkit-roadmap}/loop.yaml`,
`docs/adr/0017-compozy-runs-the-short-loop.md`, `openspec/changes/compozy-driver/proof/*.md`. Modify:
`plugins/openspec/hooks/{change-loop,roadmap-loop,project-loop,guard}.mjs` and their tests,
`plugins/openspec/hooks/guard.test.mjs`, `plugins/openspec/skills/devkit/SKILL.md`,
`plugins/compozy/skills/compozy-setup/{SKILL.md,scripts/install-kit.mjs,scripts/install-kit.test.mjs,scripts/adoption.test.mjs,scripts/devkit-kit.test.mjs,templates/README.md,templates/config.toml,templates/substitutions.json,templates/bin/devkit-kit}`,
the screen skills' two `SKILL.md`, `.compozy/` (reinstalled), `.github/workflows/ci.yml`, the docs
of D-15, ADRs 0008, 0009, 0010 and 0016, `openspec/config.yaml`, `openspec/roadmap.md`, the versions and
`CHANGELOG.md`. Delete: `templates/agents/{tech-lead,dev,qa,design}/`,
`templates/loops/openspec-change/`, `scripts/role-shells.test.mjs`, `scripts/loop-template.test.mjs`.

**Estimate.** Optimistic 41 h, likely 57 h (the table's sum), pessimistic 86 h.

| Deliverable | Hours | Type | Risk |
|---|---|---|---|
| Probes P-1 to P-13 and their record (phase 1) | 4 | Testing | HIGH |
| `compozy-driver.mjs` and its tests | 4 | Core | MEDIUM |
| Driver gate, `compozy-start`, messages, T-1 to T-5 | 4 | Core | LOW |
| View, `confirm`, record, record steps (`record-mockup` and `run-step` included), `run-gate` and tests | 9.5 | Core | MEDIUM |
| Approval lock and tests | 1.5 | Core | LOW |
| Roadmap `compozy-start`, tick, state, status and tests | 5 | Core | MEDIUM |
| The `devkit` skill, T-8, T-9 | 1.5 | Documentation | LOW |
| `change-coordinator` agent, `PACKS`, the two roles lines, T-6, the hand-off test | 2.5 | Core | LOW |
| Generator, 20 agents, the seat's outcome mapping, CI step, tests | 3.5 | Core | LOW |
| Three loop templates (the `mockup` and `command` routes included) and `loop-templates.test.mjs` | 6.5 | Integration | HIGH |
| Resolver, installer, retired files, tests, `.compozy/` reinstall | 4 | Migration | MEDIUM |
| Local proof and records (phase 5) | 6 | Testing | HIGH |
| ADR 0017, Notes (ADR 0016 included), docs, versions, catalog, whole suite (phase 6) | 5 | Documentation | LOW |

**Dependencies**: round 15 (`change-coordinator`) for `change-loop.mjs` and round 18
(`roadmap-coordinator`) for `roadmap-loop.mjs`, both archived; round 16 (`stage-roles`, archived,
ADR 0016) for the mock-up gate, `accept-decisions` and the four new roles; `review-round.mjs` of
devkit-core 0.10.1; CompozyOS 0.6.2 on this Mac; the desktop app's bundled Claude Code for the local proof and the
marketplace validation (`CONTRIBUTING.md`).

## Decisions cited

ADR 0009 (CompozyOS as a second driver; amended by the new ADR); ADR 0016 decisions 1 to 3 (the
stage roles write their own files; the plan approval accepts the records by script; decision 3's
CompozyOS sentence amended by the new ADR); ADR 0010 decisions 2, 3, 4, 5 and 8
(the coordinators, a loop over files, the driver per project, hooks veto, the daemon as one run's
bookkeeping); ADR 0008 decisions 3 to 5 (the round's rules once, files outside the repository,
the paths; decision 5 amended for CompozyOS); ADR 0011 (its locks hold only Claude runs; the
`devkit-run:` line `compozy-start` never prints); ADR 0013 (the bookkeeping file in the git common
directory); ADR 0002 and ADR 0003 (merges unchanged); ADR 0004 (opt-in per project, unchanged);
ADR 0006's rejected "daemon that starts sessions", accepted by ADR 0009 and still starting no app
session.

## Open Questions

None that changes the specs, the approach or the task breakdown. The probes of D-17 are checks of
documented behaviour; a failing one stops the change for the owner rather than being resolved in
place. The exact `pt-BR` wording of the new replies is the implementer's, within D-12.

## Revision 2026-11-22 (main at 77b15b1)

The plan was approved on base `c561553`; the branch then moved to `origin/main` `77b15b1`
(stage-roles with ADR 0016 and the roles `adr-author`, `e2e-tester`, `screen-designer` and
`test-runner`; the owner gate `waiting-mockup`; the session step `accept-decisions`; new versions;
the shared test helper `test-tmp.mjs`). A plan-reality audit found the plan outdated. What changed
here, and why; the approach, A-1 to A-11 and AC-1 to AC-12 are unchanged:

1. The mock-up approval is an owner gate: D-3 gains the `mockup` kind and the mock-up facts row,
   D-4 the record step `record-mockup` (the `stop-mockup-approval` row's form), D-5 the nodes
   `ask_mockup` and `record_mockup`. Mapped to `owner`, the run would have waited forever.
2. The session steps with no `ship-change` row: `accept-decisions` and `switch-script` become the
   `command` kind, run by the new record step `run-step` through the gate `run_step`, with a
   refusal recorded and asked with the command's own reply (`blocked-why.cannot-accept`, no new
   message key, D-12); `resolve-release-conflict` and `push-rebased` take their dispatch sentence
   from the `devkit` skill's Loop; the test-stage steps add none (D-3). D-8 says the coordinator
   runs neither command.
3. The new ADR also amends ADR 0016 decision 3's CompozyOS sentence (the implementer shell that
   accepted the records leaves; the loop runs `accept-decisions`), with a Note and an `Amended by`
   line on ADR 0016 (D-14).
4. The `compozy-kit-setup` delta removes main's requirement "The kit runs the new stages in its four
   shells", which the removed shells would make false.
5. The `change-stages` MODIFIED delta is rebased on main's block, which names the four round-16
   roles and their skills; only the `change-coordinator` change is added.
6. `PACKS` has 19 keys today, 20 with `change-coordinator`: the generator's test, the files list and
   task 4.3 say 20; the four new roles take the `list-checks` icon (D-8).
7. Versions recomputed from `plugin.json` and `marketplace.json`: devkit-openspec 0.23.0,
   devkit-compozy 0.4.0, marketplace 0.27.0, pin and tag `v0.23.0`; T-7 adds `v0.22.1` to its
   "no pin left" list (D-16, D-19).
8. The new ADR is `0017` (0016 went to stage-roles), and every reference moves with it (D-14,
   tasks 6.1, 6.2).
9. Every new test makes its folders through its pack's `test-tmp.mjs`, closes the fake daemon's
   socket, and reads no git history; the AC-8 test holds the old kit as constants (D-2, D-8, D-10,
   tasks).
10. The seat maps only `failure` to `failure`; `green`, `red`, `proposed <n>`, `none-needed`,
    `drawn` and the other outcome words are `done`, judged by the checker on the next turn (D-8,
    its test, and the compozy-driver delta).
11. `docs/roles.md`'s `project-coordinator` line, which says `change-coordinator` has no agent file,
    is corrected with the `change-coordinator` line (D-8, D-15).

Also refreshed: the Context's line anchors, D-15's anchors, D-19's rows for the round-16 tests that
leave with the shells and the loop, the doc tests the edits must keep green, the estimate (57 h
likely), and two risks. The mock-up approval is proved here by tests; its live run joins the
dogfood line with the retro answers, since AC-3's wording names the grill, the plan approval and
the retro answers only.

## Probe amendments (phase 1)

The probes of D-17 ran on 2026-11-23 against CompozyOS 0.6.2; the record is
`proof/probes.md`. Twelve passed. P-10 failed, and its row's decision is applied here. No row
said "stop".

1. P-10, the row's amendment. A registry terminal tool cannot run as a loop node: the daemon
   refuses it with `action_dependency_missing ... terminal tools require an active session run`.
   D-7's roadmap loop therefore reads the state through gates, one per end state, after `pause`:
   `state_all` (criterion `.compozy/bin/devkit-kit roadmap-loop compozy-state --lang {{ .inputs.lang
   | shellQuote }}; test $? -eq 10`, `on_result: { pass: { route: ended }, fail: { route:
   state_stuck } }`), then `state_stuck` (the same command with `test $? -eq 11`, `on_result: {
   pass: { route: ended }, fail: next_generation }`), then `ended` (criterion `true`). Edges:
   `tick` → `pause` → `state_all` → `state_stuck` and `ended`; `state_stuck` → `ended`.
   `stop_when: nodes.ended.status == "succeeded"`. `compozy-state` keeps its three exits (0, 10,
   11) and what it prints. D-7's loop test asserts these nodes, edges and `stop_when` in place of
   the `state` node's. This shape ran live as probe `probe-rm`.
2. From P-3, P-5 and probe `g5`: a gate that passes follows every one of its forward edges, the
   target of its `on_result.fail.route` included, unless `on_result.pass.route` names one. So
   every gate of D-5, D-6 and D-7 whose failure routes somewhere also names its pass route
   (`phase_gate`: pass to `turn_end`), and the D-5 loop test asserts that rule for every gate.
3. From probe `g5` and probe `probe-rm`: with the default `no_progress` window, a run whose rounds
   start nothing new is `stalled` after three rounds. A change run waiting on GitHub repeats the
   same turn, as the Claude driver's wait does with no limit (the reason D-5 gives for
   `iteration_cap: 0`). D-5 and D-7 therefore set `no_progress: { window: 0 }`. A turn that
   truly makes no progress is still caught by the checker's own K2 guard (the `no-progress` row
   of D-3), which routes to `ask_blocked`.
4. From P-2: a `provider: claude` seat sees the devkit agents only when the devkit packs are
   installed for the workspace's own path. Every devkit project has them, and D-18's scratch
   projects install them. No new check is added.
5. Seen during the clean-up: the owner's `devkit` workspace names `tech-lead`, which the re-run
   removes, as its default agent. Nothing in the kit writes a workspace's settings, and this
   change adds no report for it: after task 4.7 the conducting session tells the owner, who sets
   another default agent with `compozy workspace edit devkit --default-agent <agent>`.
6. The node syntax the probes ran (classes, where `collection` and `ask`'s `prompt` and `expect`
   go, `run-loop`'s `await`, `respond`'s flags) is listed at the end of `proof/probes.md`.
   `compozy loop validate` accepts unknown keys silently, so a form is taken from that list,
   never from a validator's silence. D-5's `run_review` therefore uses `await: true`, not
   `mode: await`.

## Phase 2 amendments

Found while writing the scripts of phase 2; each is a point the design left to the implementer.

1. D-12, `compozy-running`. The list of runs `compozy loop runs` prints has no `web_url` (only
   the reply of `compozy loop run` has), so a live run's url is unknown to `compozy-start` row
   C4. The reply names the run instead: `compozy-running` reads "{id} already runs in CompozyOS
   (run {run}): follow it and answer its questions there.", and the row's JSON has `url: null`.
2. D-2, `readiness`: the first failing row is returned as `{ ok: false, reason, fix }`, with
   `reason` one of `not-installed`, `daemon-stopped`, `workspace-unknown`, `kit-missing`;
   `compozy-start` maps them to the keys `compozy-not-installed`, `compozy-stopped`,
   `compozy-workspace` and `compozy-kit-missing`. `compozy-driver.mjs` exports `LIVE_STATES` and
   `CHANGE_LOOP`.
3. D-3, `confirm`: the handed key is also cleared when the grill's answers are no longer needed:
   once a confirmed view is for a stage other than the requirements (and not the `open` turn),
   which is the design's "the grill answers stay until the requirements stage passes".
4. D-3, the exit code of `next --view compozy` is 0 whenever it prints the view (the kind says
   what the loop does next); 3 only for a usage error.
5. D-19, T-3 (`roadmap-loop start: roadmap and status are routed`) asserts that `roadmap` and
   `status` stop where the change verb stops. D-1 makes `compozy` pass that gate for both, so the
   test fails from task 2.4 until task 3.1 changes it, as the plan orders; the gate of phase 2
   does not run the roadmap suite.

## Phase 3 amendments

Found while writing the roadmap commands and the skill section; each is a point the design left to the implementer.

1. D-7, `compozy-tick`: a started line's `request` is the line's text and notes, or its id when it has neither (the `requestOf` the Claude driver's `start` action uses), so `[ ] a` starts a run with `request=a`.
2. D-7, the lines that count as finished for `compozy-state` exit 10 are the archived ones and the ticked ones (`archived`, `archived-unticked`, `ticked`); exit 0 holds while a ready line exists or a change run of a roadmap line is live; exit 11 prints one `roadmap-stayed` line per open change.
3. D-7, `compozy-start` and `compozy-tick` answer in plain lines (as `run` does), exit 3 with the reply of the first failing row of the D-2 check, and a `compozy-roadmap-started` reply with no url names `run <id>` in its place. `stop` pauses only runs that are not paused already.
4. D-2's test helper `fakeCompozy` reads the key `"<subcommand> <loop>"` (for example `loop runs devkit-roadmap`) before `"<subcommand>"` when the call has `--loop <name>`, so a test can list the runs of each loop apart.
5. D-13, the heredoc of both `compozy-start` calls in the skill is the quoted `DEVKIT_ARGS` of `start`, with its terminator rule.

## Main-merge amendments (after 72b51d3)

`main` was merged into this branch at `72b51d3` (and `028d7ba` dropped the `push-rebased` step the merged
release-merge change removed). It added the change state, the token budget, the Jira write-back, and the
delivery models (two pull requests, the test-branch lock, the support branch). The decisions and
acceptance criteria of this plan stay. The CompozyOS view follows what main added in four places
(task 4.0, each with a test that failed first), and does not follow five features, listed as known limits.

1. `buildView`, root and branch. A step whose detail names both `root` and `branch` (the support-branch
   hand-offs: `resolve-support-conflict`, `fix-resolution`, `merge-into-support`) runs in that worktree,
   as `decide`'s own brief already says for an `agent` action. The view's `root` field, and the root and
   branch of the brief frame of every `coordinator`-built brief, come from the detail when it names both,
   else from the action. A detail with only one of the two (`review-resolution` names `root` alone, the
   task worktree) changes nothing, the same rule as `decide`'s brief.
2. The dispatch sentence. `SHIP_ROW_STEPS` is no longer a hand-kept list: it is `AGENT_STEPS` (the steps
   of `ROWS` that name a role, so of `ROW_STEPS`) without `resolve-release-conflict`, whose sentence is the
   `devkit` skill's Loop bullet. The seven delivery steps main added (`open-prs`, `open-test-pr`,
   `push-support`, `move-test-pr`, `open-test-archive-pr`, `resolve-support-conflict`, `fix-resolution`)
   carry the `ship-change` row sentence. The test lists the hand-offs of `ROW_STEPS` and checks that each
   has a `ship-change` table row.
3. Session steps. `review-resolution` is kind `review` like `review` (the `devkit-review` loop runs the
   round). `rerun-checks`, `checkout-support` and `merge-into-support` are `coordinator` steps, the
   fall-through of every session step the checker did not build a command for; a test pins it.
4. `compozy-start` and the refusals of `open`. The three refusals that depend on the settings and the
   remote's refs alone (`base-not-default`, `test-branch-missing`, `name-test-suffix`) are one function,
   `deliveryBase`, called by `openUnderLock` and by `compozy-start` (after row C7, for a change no
   checkout holds, in a repository with an `origin`, after the same best-effort `git fetch origin
   --prune` `open` makes, so a test branch pushed a minute ago is seen). It answers `code 3` with the
   refusal's key as `mode` and its own reply, and starts no run. The helper could be called without
   opening, so the late `open-failed` row of D-3 stays only as the net for what no earlier check can
   know (a name taken meanwhile, a failed `change-loop open`).

Known limits (each is main's feature that this change does not carry onto the CompozyOS path; each goes
into ADR 0017's Consequences, task 6.1):

5. The token budget. `nextAction` counts the session's spend only when the caller passes `budget: true`
   (`plugins/openspec/hooks/change-loop.mjs:1131`), and only `next` does (`:2347`); `compozyState` calls
   it without (`:2130`), so a run on CompozyOS never holds a hand-off at the cap.
6. The Jira entry and write-back. `open --task` (`change-loop.mjs:2435`) and `write-back`
   (`change-loop.mjs:2530`) are not reachable from `compozy-start` (`:2157`) or from the loops: a
   CompozyOS change is opened from its request, never from a task, and no write-back question is asked.
7. The `state` subcommand (`change-loop.mjs:2527`, `runState` at `:2351`) reports the Claude driver's
   runs; it reads no CompozyOS run.
8. `testBranchViolation` (`plugins/openspec/hooks/guard.mjs:582`, called at `:858`) judges a Bash command
   by the session root the hook finds. This change adds nothing to it for a CompozyOS seat (no use of
   `compozySession`, `guard.mjs:451`, in that rule) and does not prove that it applies there: the rule
   "the task branch never receives the test branch" is held on that path by the briefs and the
   checker's rows.
9. The run markers. The typed-command lock reads `devkit-run:` and `devkit-end:` lines in the transcript
   (`guard.mjs:628`); `compozy-start` prints none, so a Claude Code session that started a CompozyOS run
   holds no run lock (as D-1 says), and the markers' end line is never written for a CompozyOS run.

## Phase 4 amendments

Found while writing the loops, the resolver and the installer; each is a point the design left to the implementer
(the node forms are those of the "Syntax facts" of `proof/probes.md` and of the Loops guide embedded in the binary).

1. Where the contract keys live. `iteration_cap`, `no_progress` and `stop_when` are keys of `contract:` (the guide's
   `contract.stop_when`), next to `goal` and `definition_of_done`; `inputs`, `graph` and `start` are top level.
2. D-5, `turn_end`. A `transform` takes `params.map`, whose values are mappings with `value` or `from`, never a bare
   literal, and `produces` for the output's type, so the node is `class: action`, `kind: transform`, `params: { map:
   { done: { value: true } } }`, `produces: { done: boolean }` (the guide's own example).
3. D-5, the record gates (`record_grill`, `record_mockup`, `record_approval`, `record_notes`, `record_retro`) and
   `retry` end with `on_result.fail: next_generation`: a record step refuses when the view moved (exit 3), and the next
   turn reads the state again and asks the owner again if the answer is still due. `run_review` gets `retry: {
   max_attempts: 1 }` (a `run-loop` needs an explicit retry) and `timeout: 6h`; `run_role` `timeout: 4h`, `read` `15m`.
4. D-5, the unproven corner. The probes ran `on_result.pass.route` for gates, not `on_error.route` for an action: the
   validator requires the error target to be a forward edge of the node (`error_route_backward`), and the guide says
   only an explicit error route absorbs a failure, but not whether the edge to `ask_blocked` is skipped when `run_role`
   or `run_review` succeeds. The loops are written as D-5 says. Task 5.2's run is the first to see it: an `ask_blocked`
   request after a good `run_role` means the edge is followed on success, and the fix is a gate between the node and
   `ask_blocked`, which names its pass route.
5. D-6, `consolidate`. Its `outcome` enum holds `done` only, so a `check-file` mismatch (the coordinator returns `failure`)
   fails the node with `invalid_output` before `review.md` is written, the review loop fails, and `run_review` routes to
   `ask_blocked`: the design's "the child run fails", made by the schema. A lane's `failure` stays a normal output
   (`readStage1` names a reviewer with no saved object as failed). `bench` asks `change-loop next` (read only) for the step,
   so that a `review-resolution` view (follow-up 3 of the main merge) runs the skill's "Resolution calls" with the same loop.
   The writers' fan-out has `max_parallel: 6` like the reviewers'.
6. D-10, the installer. `--set` of an unknown token is a usage error that exits 2 (it exited 1 with a stack, because the
   `UsageError` of `resolveInputs` was thrown outside `main`'s `try`); a recorded input with no placeholder is dropped and
   printed `dropped __NAME__`, named once; a `kept` retired file keeps its recorded digest; the `--json` report adds
   `dropped`. `__SCREEN_MAP__` and `__MOCKUP__` stay in `substitutions.json` for the `design:` block of `openspec/config.yaml`
   (the `compozy-setup` skill's step 3), though no template carries them.
7. Task order. The `compozy-kit` tests of task 4.5 run the installer, which reads the three loop templates of task 4.6; both
   are checked together, the loop tests first.
8. The merge made five generated agents stale (`code-quality-reviewer`, `commit-and-pr`, `pr-verifier`, `tdd-implementer`,
   `test-coverage-reviewer`: their sources changed on main). `gen-agents.mjs` wrote them again, and `--check` is 0.
9. D-8, the description limit (found by the live proof, tasks 5.1 and 5.3, CompozyOS 0.6.2). `compozy agent list` refused 19 of
   the 20 generated agents with `frontmatter.invalid: descriptions can have up to 280 characters`: the Claude sources'
   descriptions hold 274 to 508 characters and `gen-agents.mjs` copied the line verbatim, so an agent was "not available in
   workspace" and the loop's first node (`read`, agent `change-coordinator`) could not bind. The generated `description` is now
   the source's, read as the YAML scalar it is and reduced to at most 280 characters (code points): whole sentences from the
   start while they fit (a sentence ends at `. ` or at the end), else the words that fit with a final `…`; one of 280 or fewer
   stays whole, and the value is written quoted when it holds `:` or `#` or starts with a special character. The body stays the
   exact source text (A-4) and the header comment says the description is shortened. `--check` is red when a source
   description changes in the part that is kept, not when only the dropped tail changes (the generated agent would not
   differ). A test pins the limit on every generated file (task 4.9; task 4.10 is its gate), because the plan knew the
   daemon's frontmatter keys but not this validation.
10. D-3 and D-4, the guard of the record steps (found by the live proof, task 5.3, run `looprun-a4bc9068808707a9` of
    `add-mul`). After the view said `gate` and `confirm` passed, the `phase_gate` node failed in 3 seconds without running the
    tests, the next view was `blocked` ("the tests of phase 1 failed") and `run-gate` by hand said `the run does not ask for
    the gate now (it asks for blocked)`. The cause: `compozyState` always gave `nextAction` the handed key of the run record as
    `--after`, and `confirm` records the key of the step just handed. Every record step reads its state first (`stateFor`),
    so `run-gate` and `run-step` saw `--after <the key of the step about to run>` with nothing changed yet, and the checker's
    K1 guard answered `blocked` (no-progress). The unit tests missed it because no fixture had a record whose handed key was
    that of the step under test. `compozyState` now takes `guard` (default true): the record steps pass `guard: false` and
    compute the action with no `--after`, so their view is the one the checker gives for the step about to run; `next --view
    compozy` and `confirm` keep the handed key of the previous turn as `--after`, so K1 and K2 still catch a turn that changed
    nothing, and `confirm` compares the handed view with the current view computed the same way `next --view` did (task 4.11;
    task 4.12 is its gate). The approval, mock-up, grill and retro steps were not hit: those views are ends that wait for
    the owner, which K1 and K2 never wrap, and `confirm` clears the handed key for them; their tests keep the fixture so that it
    stays so.
11. D-5, `ask_blocked` (found by the live proof, task 5.3, CompozyOS 0.6.2). `ask_blocked` had four predecessors: `by_kind`
    (the `blocked` kind), `run_role` and `run_review` through `on_error.route`, and `phase_gate` through `on_result.fail`.
    CompozyOS opened the human request of an `ask` with several predecessors as soon as `read` succeeded in a gate turn, though
    `by_kind` had routed to `phase_gate` and the gate passed: the node read `not_taken` but a pending request ("A request is
    waiting") existed and the generation waited on it, so the run stayed `running`, `turn_end` never ran and every phase gate
    stalled until the owner answered a spurious "tests failed" question. Probes on cheap nodes (no agents), each a workspace loop
    of the scratch project: an `ask` reached only from a gate's `on_result.fail.route` opens nothing when the gate passes
    (`probe-ask1`, and `ask_red` of `probe-ask7`); an `ask` reached from both a route node's `blocked` branch and a gate's fail
    route, the real shape, opens a pending request eagerly (`probe-ask3`); removing either predecessor makes it go away
    (`probe-ask4`, `probe-ask5`); one `transform` funnel in front of the shared ask does not help (`probe-ask6`); one `ask` per
    source works (`probe-ask7`). The rule: every `ask` node has exactly one predecessor. D-5's single `ask_blocked` is replaced by
    one ask per source: `ask_blocked` (from `by_kind` only), `ask_role_red` (`run_role`'s `on_error`), `ask_review_red`
    (`run_review`'s `on_error`) and `ask_gate_red` (`phase_gate`'s `on_result.fail`), with the same prompt and the same `expect`
    (retry or stop, and a note). Each ask has its own route node (`blocked_route`, `role_red_route`, `review_red_route`,
    `gate_red_route`) and its own `stop` gate (`stop_blocked`, `stop_role`, `stop_review`, `stop_gate`: `exit 1` with `on_result.fail:
    halt`) and `retry` gate (`retry_blocked`, `retry_role`, `retry_review`, `retry_gate`: `compozy-retry`), because no shape that
    shares the downstream gates was run live; `phase_gate` keeps `on_result.pass: { route: turn_end }`. Every other ask already had
    one predecessor. A structural test of `loop-templates.test.mjs` pins the rule for every ask of every shipped loop (task 4.13;
    task 4.14 is its gate). The unproven corner of item 4 is not touched: `run_role` and `run_review` still reach their ask only
    through `on_error.route`, now each its own.
