<!-- devkit-stage tasks result=passed attempt=2 commit=6e4c0635215b4a1da287461e3713c9efe010db4d -->
# Tasks

Change: `change-coordinator` · Date: 2026-11-20 · Owner: Kaue (chacal88)

Work only in this change's worktree, on its branch. Every rule, table, text and test name is in
`design.md` (D-3 `start`, D-4 `open` and `script`, D-5 `next` and its tables P, B, K, D-7 `wait`,
D-8 the locks, D-9 the settings and the message table, D-10 the skills, D-11 the `/conduct` inventory
and the changed tests, D-12 the live test, D-12a the probe, D-13 the documents, D-14 the release, D-16
ADR 0011); the implementer copies them and makes no design choice.

Every gate is one backticked command, run as written: the flow takes the first backticked text after
`Gate:` and runs each `&&` part on its own, so no part holds a `|`. Every new test lives in
`plugins/openspec/hooks/change-loop.test.mjs` with a name that starts `change-loop`, so phase gates
run them filtered in seconds through `plugins/openspec/hooks/guard.test.mjs`, which imports the file.
Every env a new test builds blanks `DEVKIT_BYPASS`, `DEVKIT_BRANCH`, `DEVKIT_CHANGE`,
`GITHUB_HEAD_REF`, `GITHUB_BASE_REF` and `GITHUB_EVENT_PATH` through one shared constant of the file
(the test `no test env blanks DEVKIT_BRANCH without also blanking GITHUB_HEAD_REF` in
`guard.test.mjs` refuses a file that does not), and every gate runs the new tests with
`GITHUB_HEAD_REF` and `GITHUB_BASE_REF` set, as a pull-request run on CI does. The new tests need the
`openspec` CLI 2.x on `PATH`. The whole suite (`node --test plugins/openspec/hooks/guard.test.mjs`,
about 13 minutes) runs once, in gate 6.8, as a background command.

Test first in every phase: the first task of each phase writes the named tests, and they fail before
the code task that follows. An existing test is changed only where `design.md` D-11 names it, and the
task says its invariant, the layer that owns it and its suite. Leave no backup or scratch file in the
tree; end every task with `git status --short`.

| Id | Slug | Tasks |
|---|---|---|
| AC-1 | `one-command-starts-a-change` | 2.1, 2.2, 4.1, 4.3, 7.1 |
| AC-2 | `loop-over-the-checker` | 1.1, 1.2, 1.3, 4.1, 4.3 |
| AC-3 | `calling-again-resumes` | 2.1, 2.2, 3.1, 7.1 |
| AC-4 | `unfinished-work-asked-first` | 2.1, 2.2 |
| AC-5 | `waits-on-github-alone` | 1.1, 1.3, 2.1, 2.2, 4.3, 7.1 |
| AC-6 | `coordinator-does-not-stop-early` | 3.1, 3.2, 3.3, 7.1 |
| AC-7 | `stage-agent-delivers-before-stopping` | 1.1, 1.3, 3.1, 3.2, 3.3, 7.1 |
| AC-8 | `coordinator-edits-no-code` | 3.1, 3.2, 3.3, 6.2, 6.3 |
| AC-9 | `skills-wired-into-the-agents` | 1.1, 1.3, 4.1, 4.4 |
| AC-10 | `two-language-settings` | 1.1, 1.3, 4.1, 4.4, 7.1 |
| AC-11 | `plain-replies` | 1.1, 1.3, 7.1 |
| AC-12 | `driver-setting-read` | 1.1, 1.3, 2.1, 2.2 |
| AC-13 | `conduct-retired` | 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 6.1, 6.5, 6.6, 6.7 |
| AC-14 | `live-test-recorded` | 7.1 |
| AC-15 | `design-records-the-answers` | 6.1, 6.2, 6.3, 6.4, 6.5, 6.6 |

## 1. The decision core: settings, replies and the loop's decision (AC-2, AC-5, AC-7, AC-9, AC-10, AC-11, AC-12)

Test first: the 1.1 tests fail on the base, where `change-loop.mjs` does not exist.

- [x] 1.1 Create `plugins/openspec/hooks/change-loop.test.mjs` with the shared env constant, and add
  `import './change-loop.test.mjs'; // change-coordinator: the loop, its commands and its locks` to
  the imports of `plugins/openspec/hooks/guard.test.mjs`. Write the tests `change-loop settings: ...`
  (D-9: no block gives `en` and `claude`; a block with both keys, quoted and with a `#` comment; an
  unknown driver and a non-tag language flagged; other keys ignored; `shipConfig` of
  `deliver-check.mjs` gives the same with and without the block), `change-loop replies: no internal
  term in either language` (D-9, the refused set read from both `flow.json` files, the step names in
  `deliver-check.mjs`'s source and `flow-check`'s `TEXT` keys), `change-loop replies: the owner's
  settings` (files `en`, person `pt-BR`: the action's `filesLanguage` and brief say English, the reply
  is the Portuguese text), `change-loop decide: <row>` one test per row P1 to P10, A0, B0 to B17, K1 and
  K2 of D-5 over synthetic `flow-check` reports and `deliver-check` steps (kind, agent, step, end
  state, why, exit code, reply key), `change-loop decide: the B rows are exactly the steps the checkers can return` (the step names
  read from `deliver-check.mjs`'s source plus the two override names of `conduct-check.mjs`; it fails
  on a returnable step with no row and on a row naming a step no checker returns), `change-loop decide:
  B1a`, `B2a` and the two other outcomes of override 1 (a conflict elsewhere ends blocked, `pr-problem`;
  a clean merge in `merge` mode is the session step `update-branch`) over synthetic `deliveryRow` results, `change-loop brief: names
  the role, the change and the stage and holds no skill text` (D-5), `change-loop reply: renders a key
  in both languages and an unknown key exits 3`, and `change-loop next: <end>` CLI tests on real
  fixture repositories (built with `gitRepo`, `put`, `commitAll` and `fakeGh` of
  `deliver-check.test.mjs`): the approval awaited (exit 1, `detail.readiness` set), a readiness failed
  at its ceiling (exit 2), an archived change (exit 0), checks pending on the pull request (exit 1,
  reply `waiting-github`), a change with no stage header (exit 2, `previous-script`), a pull request conflicting only in
  `CHANGELOG.md` and `.claude-plugin/marketplace.json` (the action hands `resolve-release-conflict` to
  `devkit-core:tdd-implementer` with the paths; fixture built in the form of `conflictRepo`,
  `plugins/openspec/hooks/conduct-check.test.mjs:636-646`); each prints
  `devkit-run: <id>` as line 1. Verify:
  `node --test --test-name-pattern="^change-loop" plugins/openspec/hooks/change-loop.test.mjs`
  fails with `ERR_MODULE_NOT_FOUND`. (AC-2, AC-5, AC-7, AC-9, AC-10, AC-11, AC-12)
- [x] 1.2 In `plugins/openspec/hooks/flow-check.mjs`, export `fingerprint` and `inSentence`, and in
  `plugins/openspec/hooks/conduct-check.mjs` add `export` to `function deliveryRow(` (D-5; nothing else
  changes in either file: no behaviour of `conduct-check` changes, AC-13). Verify:
  `node --test --test-name-pattern="^flow-check" --test-name-pattern="^conduct" plugins/openspec/hooks/guard.test.mjs`
  green, and `git diff -U0 -- plugins/openspec/hooks/conduct-check.mjs` shows that one line. (AC-2)
- [x] 1.3 Create `plugins/openspec/hooks/change-loop.mjs` (D-5 "layout"): `readDevkitSettings`,
  `MESSAGES` and `render` with every key and parameter of D-9, `decide` (every row of D-5, pure),
  `nextAction` (`collectFlow` and `computeFlow` in the change's checkout; `collectState`,
  `buildReport` and `conduct-check`'s `deliveryRow` in the build-to-archive part; `approvalState` for P6, P7, B12; the progress key), and the
  subcommands `next` and `reply` with the `devkit-run:` line, the JSON and the exit codes of D-5; it runs
  nothing when imported (the `isMain` form of `flow-check.mjs:629-638`). Verify: the 1.1 tests pass.
  (AC-2, AC-5, AC-7, AC-9, AC-10, AC-11, AC-12)
- [x] 1.4 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^change-loop" --test-name-pattern="^flow-check" --test-name-pattern="^conduct" plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py` green; covers AC-2 (decisions), AC-9 (brief), AC-10, AC-11, AC-12 (settings).

## 2. The commands: start, open, script and wait (AC-1, AC-3, AC-4, AC-5, AC-12)

Test first: the 2.1 tests fail until 2.2.

- [x] 2.1 In `change-loop.test.mjs`, write `change-loop start: <row>` one test per row S0 to S11 of D-3
  (S0 `change-loop start: S0 a usage error exits 3 and creates nothing`; S6 and S7 assert the
  `resumed` reply with where the change stopped; standard input through the same quoted form the
  skill uses; S8 and S10 list each unfinished change
  with its `where`; S10 creates nothing: the branches, the worktrees and the folders under
  `openspec/changes/` are the same before and after), `change-loop open: <row>` for O1 to O4 of D-4, including
  `change-loop open: O3 refuses in a project not set up or with an unknown or unbuilt driver`,
  `change-loop open: O4 starts from origin/<default> after a fetch` and `change-loop open: O4 with no
  remote starts from HEAD` (a temporary repository with a bare `origin`: the worktree at `<main>/.claude/worktrees/<id>` on branch
  `<id>` from `origin/main`, `.openspec.yaml` naming the script, `requirements.md` with a pending
  header and the request under `## Request`, the `opened` reply in both languages naming the id, the
  script and the reason; with no remote, the start is `HEAD`), `change-loop script: <row>` for C1 to
  C3 and the P3 trigger, `change-loop resume: the same files give the same action before and after a
  kill` (the action of `next`, then `start` with no text and `next` again on the untouched files), `change-loop next: a blocked change called again ends
  blocked again` (a readiness failed at its ceiling, `next` twice with no `--after`: the same blocked
  end), and
  `change-loop wait: <row>` for W1 to W9 of D-7 through `waitLoop` with an injected decision sequence
  and sleep (W1: 50 unchanged polls and no exit; W8: two failures then a success keeps waiting, three
  in a row exits) plus the CLI `wait` exiting at once with the `next` action when the change is not
  waiting. Verify: the filtered run fails on the missing subcommands. (AC-1, AC-3, AC-4, AC-5, AC-12)
- [x] 2.2 In `change-loop.mjs`, add `parseStart`, `unfinished` (with `listWorktrees` of
  `conduct-check.mjs`, unchanged), `locate`, `startMode`, `openChange`, `switchScript` and `waitLoop`,
  and the subcommands `start`, `open`, `script` and `wait` of D-3, D-4 and D-7, reading standard input
  for `start` and `open`. Verify: the 2.1 tests pass. (AC-1, AC-3, AC-4, AC-5, AC-12)
- [x] 2.3 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^change-loop" plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py` green; covers AC-1, AC-3, AC-4, AC-5 (what the loop does at each answer of GitHub), AC-12.

## 3. The probe and the locks (AC-3, AC-6, AC-7, AC-8)

The probe comes first: the locks stand on S1, S2, S6 and S7 of `design.md` D-1. Then test first: the
3.2 tests fail until 3.3. No existing test changes: the existing `guard.test.mjs` inputs carry no
`transcript_path`, so they are in no run (D-8), and gate 3.4 runs them.

- [x] 3.1 Owner-run, by the conducting session (no implementer, no child session): run the probe of
  `design.md` D-12a and write `${TMPDIR%/}/devkit-probe-change-coordinator/probe-record.txt` (the
  stored form of the typed `/devkit change probe`, of the `devkit-run: probe-change` tool result and
  its JSON path, whether the resumed call keeps the typed command, and `background_tasks` while the
  `sleep` ran). If S1 or S6 is false or S7 loses the typed command, stop here and report to the owner
  before phase 3 goes on; if S2 is false, report it and apply the T2 fallback of D-12a. Verify: the
  record names all four results. (AC-3, AC-6, AC-7, AC-8)
- [x] 3.2 In `change-loop.test.mjs`, write `change-loop lock run: <case>` (`runOf` over transcript
  fixtures in the stored forms the 3.1 probe recorded, with the session ids replaced, plus the
  plugin-scoped command `<command-name>/devkit-openspec:devkit</command-name>` with
  `<command-args>change ...</command-args>` and a first line `/devkit change ...`; a newer
  other command; no `devkit-run:` line; two lines, the later wins), `change-loop lock stop: <row>` for
  T1 to T7 of D-8 (T5's reason names the change, the stage and the command line
  `node <hooks-dir>/change-loop.mjs next --change <id> --lang <l>` with the language from
  `CLAUDE_PLUGIN_OPTION_LANGUAGE`) (a subprocess `node guard.mjs stop` with `TMPDIR` set to a fixture folder, a
  transcript file and a fixture repository whose next action is an agent hand-off, an end, the grill;
  `background_tasks` non-empty; the second attempt with the recorded key; an unreadable transcript),
  `change-loop lock subagent-stop: <row>` for U1 to U7, `change-loop lock edit: <case>` (in a run the
  main session's edit of `src/a.ts` is refused by Write and by a shell redirect on a `devkit-lite`
  change and on a `devkit` change with readiness approved; `tasks.md` and `approval.md` follow the
  existing rules; with no run the `devkit-lite` edit passes as today; `devkit-core:tdd-implementer`
  on the approved `devkit` change passes), `change-loop lock agent: <row>` for H1 to H5,
  `change-loop lock log: one JSON line per decision with DEVKIT_HOOK_LOG, none without`,
  `change-loop lock hooks.json: Stop, SubagentStop without a matcher and PreToolUse Agent call
  guard.mjs`, and `change-loop lock: bypass and a project not opted in refuse nothing`. Verify: the
  filtered run fails. (AC-6, AC-7, AC-8)
- [x] 3.3 In `plugins/openspec/hooks/guard.mjs`: export `runOf` (pure, no import); add the modes
  `stop`, `subagent-stop` and `agent` (async, importing `change-loop.mjs` dynamically as `ci` imports
  `deliver-check.mjs`, failing open, writing `DEVKIT_HOOK_LOG` lines), the run lock in `guardEdit`
  and `guardBash` before the existing rules, and the three modes in the header comment; in
  `change-loop.mjs`: `stopDecision`, `subagentStopDecision` and `agentDecision` with the refusal record
  under `<os.tmpdir()>/devkit-stop/`; in `plugins/openspec/hooks/hooks.json`: the three entries of D-8
  and a description naming the stop locks. Verify: the 3.2 tests pass. (AC-6, AC-7, AC-8)
- [x] 3.4 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^change-loop" --test-name-pattern="^worktree" --test-name-pattern="^approval.md" --test-name-pattern="^shell writes" --test-name-pattern="^readiness.md" --test-name-pattern="^not opted in" --test-name-pattern="^several changes" plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py` green; covers AC-6, AC-7, AC-8.

## 4. The command, the wiring and `/conduct` removed (AC-1, AC-2, AC-5, AC-9, AC-10, AC-13)

Test first: the 4.1 tests fail until 4.3 and 4.4.

- [x] 4.1 In `change-loop.test.mjs`, write `change-loop skills: every shipped stage agent declares its
  stage's skills` (D-10), `change-loop settings: devkit-openspec has the language user setting`
  (`plugins/openspec/.claude-plugin/plugin.json`: `userConfig.language`, string, default `pt-BR`, no
  `options`), and `change-loop skill: <rule>` over `plugins/openspec/skills/devkit/SKILL.md`: the
  frontmatter (`name: devkit`, `disable-model-invocation: true`, `argument-hint`, a description with
  "Use when"); every `change-loop.mjs` command in the body, and the `flow-check` readout it shows when the owner
  asks where the change stands, carries `--lang ${user_config.language}`;
  `start` and `open` read the arguments through a quoted heredoc, with the terminator rule of D-3
  (`DEVKIT_ARGS`, or `DEVKIT_ARGS_` and digits no request line holds); the two override sentences of
  B1a and B2a; the script rule of D-4; the
  approval and the retro answers are written only from the owner's own message; one stage per
  hand-off, in the foreground, never a subagent for a whole change, never choosing the order; the
  wait is started in the background on a GitHub wait (D-7); the grill paragraph names
  `<!-- devkit-stage` and `requirements`. Verify: the filtered run fails. (AC-1, AC-2, AC-5, AC-9, AC-10)
- [x] 4.2 Change the tests D-11 names, each only as stated there: in
  `plugins/openspec/hooks/guard.test.mjs`, remove the 14 `conduct SKILL.md: ...` tests, their helper `conductMd` (`:1081`) and their three
  section comments (`:1079-1268`; invariant: the text contract of the `/conduct` skill; layer: skill
  text; suite: `guard.test.mjs`; they retire with the skill, and their surviving invariants are the
  4.1 `change-loop skill:` tests). The 14, by name: `conduct SKILL.md: at most three steps at once,
  the worktree preamble, never a subagent for a whole change`; `... the cron migration rule, and no
  cron is ever created (D7, AC-8)`; `... approval.md and retro answers only from the owner's own
  message`; `... the schema is asked for every new change before git worktree add, devkit-lite
  included; then /conduct is the go-ahead`; `... the report names the five states`; `... the GitHub
  wait is one capped watch, then Auto-fix; the PR is bound after open-pr (AC-9)`; `... the app starts
  one child session per session row, with the start fields (AC-3)`; `... --busy comes from
  list_sessions by isRunning, isArchived and sessionPrefix (AC-7)`; `... a refused start waits for the
  owner and never becomes a subagent (AC-6)`; `... a continuation turn reads Outcome, recomputes and
  starts the next session of a change under way (AC-5)`; `... the sidebar group, the archive and the
  one rule for a refused call (AC-8)`; `... /conduct <id> comes first, every call carries --change, a
  bare /conduct never sweeps (AC-4)`; `... a missing change is created only on the owner's answer
  (AC-7)`; `... unfinished work is asked on the owner's turn only (AC-6)`. After the removal,
  `grep -c conductMd plugins/openspec/hooks/guard.test.mjs` prints 0;
  and rewrite `README and the pack README describe the session flow with no cron (2.5) and one change
  on request (AC-4)` as D-11 says (invariant: the READMEs describe how one change runs, with no cron;
  layer: documentation; suite: `guard.test.mjs`); in `plugins/openspec/hooks/flow-check.test.mjs`,
  `flow-check AC-2: the session hook names the checker and the roles` (invariant: the session text
  names the driver, the checker and the roles; layer: `guard.mjs` session mode; suite:
  `flow-check.test.mjs`) and `flow-check AC-3: every writer of a stage file names the stage header`
  (invariant: every writer writes the header; layer: skill and agent text; suite:
  `flow-check.test.mjs`); in `plugins/openspec/hooks/deliver-check.test.mjs`, `AC-6
  instructions-follow: configs, ship-change, conduct, flow doc and READMEs name evidence before review`
  (invariant: every driver runs `verify` before `review`; layer: skill and doc text; suite:
  `deliver-check.test.mjs`; its name drops `conduct`); in
  `plugins/core/skills/review-change/scripts/review-round.test.mjs`, `review round: text the
  ship-change review row and conduct Delivery item 5 name the Workflow tool, the agents path and the
  lost round` (invariant: every driver's review step names the Workflow tool, the `agents` path and
  the lost round; layer: skill text; suite: `review-round.test.mjs`; `conduct Delivery item 5` becomes
  the `devkit` skill's review sentence). Verify: the changed tests fail until 4.3 and 4.4. (AC-13)
- [x] 4.3 Create `plugins/openspec/skills/devkit/SKILL.md` (D-3 to D-9: Settings, Start, A new change,
  Loop, Owner gates, Waiting on GitHub, Never), and delete `plugins/openspec/skills/conduct/SKILL.md`
  with its folder (a plain file deletion approved with this plan; no Git command deletes it, and the
  commit stages the deletion by name). Verify: the 4.1 `change-loop skill:` tests and the 4.2 changed
  tests that read the skill pass. (AC-1, AC-2, AC-5, AC-13)
- [x] 4.4 Wire the rest: `skills:` in `plugins/core/agents/plan-readiness-reviewer.md`,
  `plugins/core/agents/tdd-implementer.md` and `plugins/core/agents/commit-and-pr.md` (D-10, bodies
  unchanged); `userConfig.language` in `plugins/openspec/.claude-plugin/plugin.json` (D-9); the session
  text of `plugins/openspec/hooks/guard.mjs:479` (D-11); the `devkit:` block in
  `openspec/config.yaml` (`language: en`, `driver: claude`, D-9); `README.md:68` and
  `plugins/openspec/README.md` (the `devkit` skill row, the hooks rows, the `conduct-check` row, D-11);
  then `python3 scripts/gen-catalog.py`. Verify: every 4.1 and 4.2 test passes and
  `openspec validate change-coordinator --strict` still passes with the new block. (AC-9, AC-10, AC-13)
- [x] 4.5 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^change-loop" --test-name-pattern="^flow-check AC-2" --test-name-pattern="^flow-check AC-3" --test-name-pattern="^AC-6 instructions-follow" --test-name-pattern="^review round: text" --test-name-pattern="^README and the pack README" --test-name-pattern="^ADR" plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && "$(for c in "$HOME/Library/Application Support/Claude/claude-code/"*/*/claude.app/Contents/MacOS/claude; do :; done; echo "$c")" plugin validate .` green; covers AC-9, AC-10, AC-13 (pack and session text).

## 5. The panel fills `/devkit change` (AC-13)

Test first: 5.1 fails until 5.2. Before a run, `<binary> plugin test --help` must print
`Run a mod's tests` (`CONTRIBUTING.md`, "Testing a mod pack").

- [x] 5.1 Change the panel's tests D-11 names (`plugins/panel/hooks/report.test.tsx:414-458`,
  `:532-545`, `:584-609`; `plugins/panel/hooks/panel.test.tsx:377-397`, `:502-516`, `:1318-1412`,
  `:1724`, `:2059`; invariants: an owner button fills the command that runs the change, and the newest
  run invocation names the conducted change; layer: the panel mod, `commands.ts`, `i18n.ts`,
  `conducted.ts`; suite: `claude plugin test plugins/panel`): the expected fills become
  `/devkit change <id>`, the old `/conduct <id>` forms stay accepted, and new cases cover
  `/devkit change <id>` as command tags and as a first line, `/devkit-openspec:devkit change <id>`,
  and free text (no change named). Verify: the panel run fails on the new expectations. (AC-13)
- [x] 5.2 In `plugins/panel/hooks/i18n.ts` (`fill.conduct`, `hint`, `conductMeaning` in both
  languages), `plugins/panel/hooks/conducted.ts` (the `/devkit change <id>` forms), the comments of
  `plugins/panel/hooks/commands.ts:12`, `:16` and `plugins/panel/hooks/project.ts:123`, the doc comment of `SKILL_NO_ARGUMENT` at
  `plugins/panel/hooks/report.test.tsx:214` (comment only; the constant and its test stay), and
  `plugins/panel/README.md` (`:20-21`, `:49`, `:58-59`, `:63`), apply D-11. Verify: the 5.1 tests pass.
  (AC-13)
- [x] 5.3 In `plugins/panel/hooks/panel.test.tsx` (the test world's stand-in for the engine's band,
  about lines 253-254), name the panel in the stand-in's matcher (`{ plugin: PLUGIN }`) and say why in
  its comment, as `design.md` D-11 "Decisions taken while implementing" states. The existing test
  `AC-9 band-shows-conducted-change: the band reads glyph, id, step with its fact, what is left and
  who acts, with Abrir painel; then Fechar painel` is the red test (it fails on the bundled Claude
  Code 2.1.326 before the edit); no pack code changes. Verify: `plugin test plugins/panel` passes
  with no failing test. (AC-13)
- [x] 5.4 Gate: `"$(for c in "$HOME/Library/Application Support/Claude/claude-code/"*/*/claude.app/Contents/MacOS/claude; do :; done; echo "$c")" plugin test plugins/panel && python3 scripts/check.py` green; covers AC-13 (panel).

## 6. ADR 0011, documents and release (AC-8, AC-13, AC-15)

Test first: the 6.1 tests fail until 6.2 to 6.7. Task 6.3 depends on the owner's recorded approval.

- [x] 6.1 In `change-loop.test.mjs`, write `change-loop retire: /conduct is not shipped and nothing
  points at it` (D-11) and `change-loop docs: the design records the answers` (D-13, D-16: the four
  points are gone from "Open points" of `docs/coordination-design.md` and present, marked decided with
  who and when, in sections 2, 8 and 10; `docs/adr/0011-the-change-coordinator-is-the-owners-session.md`
  exists with a `- Status:` line of `proposed` or `accepted`, an `- Amends:` line naming ADR 0010, and
  the headings `## Context`, `## Decision`, `## Consequences`, `### Review trigger` and
  `## Alternatives considered`; ADR 0010's Context has a Note naming `change-coordinator` and ADR 0011;
  ADRs 0005, 0006, 0007 and 0009 name `/devkit change`; the `ADRs:` line of `openspec/config.yaml`
  names 0011; `docs/openspec-flow.md` has the section "The change coordinator: `/devkit change`" and
  pins `v0.16.0`; `openspec/roadmap.md`'s `review-writer-prompt` line names both A-12 findings).
  Verify: both fail. (AC-13, AC-15)
- [x] 6.2 Write `docs/adr/0011-the-change-coordinator-is-the-owners-session.md` with the text of
  `design.md` D-16 and status `proposed`; add the dated Note of D-13 that points at it to
  `docs/adr/0010-openspec-as-the-harness.md`; add "0011 the change coordinator is the owner's
  session, held by hooks (proposed)" to the `ADRs:` line of `openspec/config.yaml` (`:22`). Verify:
  `node --test --test-name-pattern="^ADR" plugins/openspec/hooks/guard.test.mjs` green (no duplicate
  ADR number; ADR 0010 still accepted). (AC-8, AC-15)
- [x] 6.3 Only when `openspec/changes/change-coordinator/approval.md` exists with `- Status: APPROVED`
  and its `- Owner's words:` line accepts ADR 0011 (otherwise stop: the plan goes back to planning,
  D-16): set ADR 0011's status to `accepted`; add `- Amended by ADR 0011
  (0011-the-change-coordinator-is-the-owners-session.md)` under ADR 0010's Status line, its status
  staying `accepted`; change the `ADRs:` line to "0011 the change coordinator is the owner's session,
  held by hooks, amends 0010"; and rewrite the last locks-table row of `docs/coordination-design.md`
  (`:294`) as D-13 says. Verify: `grep -c "^- Status: accepted$" docs/adr/0011-the-change-coordinator-is-the-owners-session.md`
  prints 1. (AC-8, AC-15)
- [x] 6.4 Edit `docs/coordination-design.md` as D-13 says (the four points into sections 2, 8 and 10;
  the tense paragraph, `:79`, section 9, `:465`, section 13). Verify:
  `python3 scripts/check.py` green. (AC-15)
- [x] 6.5 Add the dated Notes of D-13 to `docs/adr/0005-parallel-steps-and-a-session-wake-up.md`,
  `docs/adr/0006-phases-as-child-sessions.md`, `docs/adr/0007-one-change-on-request.md` and
  `docs/adr/0009-compozy-loop-as-a-second-driver.md`, statuses unchanged. Verify:
  `node --test --test-name-pattern="^ADR" plugins/openspec/hooks/guard.test.mjs` green. (AC-13, AC-15)
- [x] 6.6 Edit `docs/openspec-flow.md` (every point of D-13, the pin to `v0.16.0` at `:523`, `:524`,
  `:531`), `docs/roles.md` (`:19` and the `tech-lead` sentence), `docs/compozy-kit.md:86-96` and the
  round 25 line of `openspec/roadmap.md` (A-12), as D-11 and D-13 say. Verify:
  `python3 scripts/check.py` green. (AC-13, AC-15)
- [x] 6.7 Release (D-14): devkit-openspec 0.16.0, devkit-core 0.8.0, devkit-panel 0.3.0 in each
  `plugin.json` and `.claude-plugin/marketplace.json`, marketplace 0.20.0; the devkit-openspec
  description in both files; `CHANGELOG.md` entry `## 0.20.0 — the change coordinator and /devkit
  change` with the "Replaces" bullet and a line for ADR 0011; then `python3 scripts/gen-catalog.py`.
  Verify: the 6.1 tests pass and `python3 scripts/gen-catalog.py --check` is green. (AC-13)
- [x] 6.8 Gate: `"$(for c in "$HOME/Library/Application Support/Claude/claude-code/"*/*/claude.app/Contents/MacOS/claude; do :; done; echo "$c")" plugin test plugins/panel && env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && "$(for c in "$HOME/Library/Application Support/Claude/claude-code/"*/*/claude.app/Contents/MacOS/claude; do :; done; echo "$c")" plugin validate . && openspec validate change-coordinator --strict` green, run as a background command (about 14 minutes); covers every criterion's tests together, AC-8 (ADR 0011), AC-13 and AC-15.

## 7. The live test (AC-14, and the live parts of AC-1, AC-3, AC-5, AC-6, AC-7, AC-10, AC-11)

- [ ] 7.1 Owner-run, by the conducting session (no implementer, no child session): with every change
  committed (`git status --porcelain` prints nothing outside `openspec/`), run the procedure of
  `design.md` D-12, L0 to L5, as background commands, keeping every output in
  `${TMPDIR%/}/devkit-live-change-coordinator/` (`commit.txt`, `version.txt`, `turn1.json` to `turn5.json`, `record-1.txt` to
  `record-5.txt`, `hooks.jsonl`), and hand the folder to `pr-verifier` for the AC-14 rows of
  `evidence.md` and the live parts of AC-1, AC-3, AC-5, AC-6, AC-7 and AC-10. The hand-off tells
  `pr-verifier` to write, in the evidence row of each of these criteria, its stated limit from the
  `design.md` Proof map, as it stands there: AC-5 (shown live only under `-p`, capped, without a pull
  request; the interactive wait is proved next), AC-6 ("not refused when the owner interrupts" rests on
  the documented fact that an interrupt fires no stop event, not on a test or the live run), AC-11 (the
  message table is tested; the model's own wording and the grill's questions are not) and AC-14 (the
  path each turn took). Verify: `hooks.jsonl` holds at least one `stop` and one `subagent-stop` line
  with `refuse`, and `turn4.json`'s `result` is the approval reply in Portuguese. (AC-5, AC-6, AC-11,
  AC-14)
- [ ] 7.2 Gate: `grep -q '"mode":"stop",.*"decision":"refuse"' "${TMPDIR%/}/devkit-live-change-coordinator/hooks.jsonl" && grep -q '"mode":"subagent-stop",.*"decision":"refuse"' "${TMPDIR%/}/devkit-live-change-coordinator/hooks.jsonl" && test -s "${TMPDIR%/}/devkit-live-change-coordinator/turn4.json" && test -s "${TMPDIR%/}/devkit-live-change-coordinator/record-5.txt"` green; covers AC-14. Owner-run, by the conducting session (no implementer, no child session): ticked only once 7.1's records exist.

## Workflow follow-up

- After the merge: tag `v0.16.0` on the merge commit and push the tag (`CONTRIBUTING.md`, step 5).
- Round 16 (`stage-roles`) is the first change run with `/devkit change`: it proves AC-1's real use,
  AC-2's whole change from opening to archive, and AC-5's unattended interactive wait, and its retro
  records them.
- The retro of this change records whether `docs/coordination-design.md` was enough to plan from (the
  questions in `requirements.md` and in `design.md` Context) and what the live test found for S1 to S5
  of `design.md` D-1.
