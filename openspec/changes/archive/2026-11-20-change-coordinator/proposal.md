<!-- devkit-stage proposal result=passed attempt=2 commit=6e4c0635215b4a1da287461e3713c9efe010db4d -->
# Proposal

Change: `change-coordinator` · Date: 2026-11-20 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(design sources: `requirements.md`, `docs/coordination-design.md` sections 1, 2, 3, 8, 9, 10,
`docs/adr/0010-openspec-as-the-harness.md`). Round 15 of `openspec/roadmap.md`, step 3 of the build
order.

## Why

The owner cannot run a change by typing what they want: `/conduct` takes only a change id, depends
on child sessions the app often refuses to start, and decides the next step by parsing prose. Round
14 delivered the checker `flow-check`, which says from stage headers which stage is next; this round
builds the loop over it, the one command every project types, and the locks that keep the loop from
stopping early or writing code.

## What Changes

- A `/devkit` command (a skill of `devkit-openspec`). `/devkit change <free text>` opens a change in
  its own worktree and branch, chooses the script and says why; `/devkit change` (or with an id)
  resumes; the other verbs answer in one sentence that they are not built yet.
- A deterministic loop script, `plugins/openspec/hooks/change-loop.mjs`, behind the command: it reads
  the verb, the settings and the unfinished changes, opens a change, and for each turn of the loop
  turns `flow-check` (and, from the implementation on, the step inside the stage: `deliver-check`'s
  step, or one of the two overrides `conduct-check` adds for a release-file conflict and a branch the
  loop rebased, reused through one new export) into one action: hand a stage to its role, run a session step, or end in one of the four end states with
  a plain reply. A background wait on GitHub has no time limit and ends when GitHub answers.
- Two stop locks and a coordinator lock in `guard.mjs` and `hooks.json`: the session running a
  `/devkit change` run cannot end its turn while a stage is ready; a stage agent cannot stop before
  its stage file is delivered; in a run the session writes no product code and hands work only to
  the roles the script lists. Each lock refuses at most once for an unchanged state and fails open.
- The stage agents declare the skills `flow.json` lists for their stage (`skills:` frontmatter).
- Two language settings: `devkit.language` and `devkit.driver` in `openspec/config.yaml` (defaults
  `en`, `claude`); the person's `language` (`pt-BR` default, `en`) as `devkit-openspec`'s own plugin
  setting. Every reply comes from one message table in both languages.
- **BREAKING**: the `conduct` skill (`/conduct <id>` and `/conduct round <n>`) is removed. The
  session text, the panel's buttons and every document name `/devkit change` instead.
  `conduct-check.mjs`, `deliver-check.mjs`, `ship-change` and `review-change` keep their behaviour.
- A new ADR 0011, `proposed`: in the Claude driver the change coordinator is the owner's session and
  a hook refuses its product edits and its hand-offs outside the script's roles, amending the sentence
  of ADR 0010 decision 8 that says it "has no edit tool". It becomes `accepted` only if the owner
  accepts it with the plan.
- Documents: the coordination design records the points settled here, ADR 0010 gains a dated Note
  pointing at ADR 0011, ADRs 0005, 0006, 0007 and 0009 say what replaced `/conduct`, the flow page describes the command, the
  roadmap's round 25 line gains the two findings carried by A-12.

Non-goals: the other verbs and the Jira entry (rounds 18 to 20 and 23), the new stage roles (round
16), delivery models (round 17), the CompozyOS and script drivers (rounds 21, 22), new panels (23),
removing `conduct-check`, `deliver-check` or the child-session code (24), project setup (26), the two
findings of A-12, and publishing the tag (a Workflow follow-up).

## Acceptance criteria

Each criterion says where it is proved: `here` (tests and the live test of this change) or `next`
(observed when round 16 is conducted with the new command; recorded in that change's retro).

- AC-1 `one-command-starts-a-change`: In a project set up for devkit, `/devkit change <free text>`
  creates the change (A-2), chooses the script (A-3) and replies with the change's name, the script
  chosen and why, and what comes next. Proved here.
- AC-2 `loop-over-the-checker`: The change coordinator takes the change from its opening towards
  its archive by asking `flow-check` what is next, handing that stage to the role `flow.json`
  names, and asking again. It never picks the order itself, and it ends a run only in one of the
  four end states (archived, waiting for the owner, waiting on GitHub, blocked), each with its
  reason in plain words. Proved here for the loop's decisions against fixtures of every end state;
  a whole change from opening to archive is proved next.
- AC-3 `calling-again-resumes`: `/devkit change` with no text, or with the change's id, continues
  the unfinished change from what the files say. Nothing is remembered between runs: killing the
  session at any stage and calling the command again reaches the same next stage. Proved here.
- AC-4 `unfinished-work-asked-first`: When `/devkit change <new request>` is typed while another
  change is unfinished, the session names that change and where it stopped and asks whether to
  continue it or start the new one, before anything is created or run (the owner's answer,
  question 2). Proved here.
- AC-5 `waits-on-github-alone`: While the pull request waits on GitHub (checks running, or the
  merge), the session keeps waiting with no time limit and without any message from the owner, and
  goes on by itself when GitHub answers: to the next stage when the checks pass or the pull request
  merges, to the fix when a check fails (the owner's answer, question 1). The reply that starts the
  wait says that the session is waiting and that calling `/devkit change` again is safe. Proved here
  for what the loop does at each answer of GitHub; the unattended wait itself is proved in the live
  test as far as a scratch repository allows, and next.
- AC-6 `coordinator-does-not-stop-early`: When the change coordinator tries to end its turn while
  `flow-check` reports a stage ready to run, the stop is refused and the refusal names that stage.
  It is not refused in any of the four end states, in a session with no `/devkit change` run, or
  when the owner interrupts. It cannot loop: when the same stage comes back with nothing changed up
  to the ceiling, the run ends as blocked with that reason. Proved here, by tests and in the live
  test.
- AC-7 `stage-agent-delivers-before-stopping`: A stage subagent that tries to stop while the file
  of its stage is missing, or still says `result=pending`, is refused with the file named; a second
  refusal with nothing changed lets it stop and the coordinator reports the stage as failed.
  Proved here, by tests and in the live test.
- AC-8 `coordinator-edits-no-code`: The change coordinator cannot edit product code and can hand
  work only to the roles the script lists: an edit or a hand-off to any other agent is refused,
  with the reason. Proved here.
- AC-9 `skills-wired-into-the-agents`: Every stage agent that ships declares the skills
  `flow.json` lists for its stage, so the coordinator's hand-off is the role, the change and the
  stage, never the method pasted into a prompt. A test compares the agents' declarations with both
  `flow.json` files and fails on a difference. Proved here.
- AC-10 `two-language-settings`: The files a stage writes follow `devkit.language` of the
  project; every reply of `/devkit change` and the `flow-check` readout it shows follow the
  person's language, in `pt-BR` and in `en`. With the owner's settings (files `en`, person `pt-BR`)
  the stage files are English and the replies Portuguese. Proved here.
- AC-11 `plain-replies`: Every reply of the command says what happened and what comes next in the
  person's language and uses no internal term: no stage id, no step name of a checker, no file
  name the owner did not ask about. A test reads the command's message table in both languages and
  refuses a listed set of internal words. Proved here.
- AC-12 `driver-setting-read`: With `devkit.driver: claude`, or no `devkit:` block, the command
  runs as above. With `compozy` or `script` it says in one plain sentence that this driver is not
  built yet, names the round, and runs nothing. Proved here.
- AC-13 `conduct-retired`: `/conduct` is no longer shipped, single-change and round mode alike:
  the skill is gone from the pack and the catalog, the session text and every document name
  `/devkit change` instead, and the CHANGELOG says what replaces it. No behaviour of `ship-change`,
  `review-change`, `conduct-check.mjs` or `deliver-check.mjs` changes. Proved here.
- AC-14 `live-test-recorded`: One live run of `/devkit change`, with the plugin loaded from this
  change's branch, on a throwaway change in a scratch project, is recorded as text in
  `evidence.md`: the command creating the change and choosing the script, the loop running at
  least the plan stages through subagents, each stop lock refusing once and then letting the run
  end, and the reply at an owner gate. Proved here.
- AC-15 `design-records-the-answers`: `docs/coordination-design.md` moves the points this change
  settles out of "Open points" into their sections, marked decided with who and when: the wait on
  GitHub, the two `tech-lead` roles, the ADR 0007 rules the coordinator keeps (both), and the field
  names `devkit.language` and `devkit.driver`. ADR 0010 gains a dated Note for them, the ADRs whose
  subject `/conduct` was say what replaced it, and `docs/openspec-flow.md` describes the new
  command. Proved here.

## Capabilities

### New Capabilities

- `change-coordination`: the `/devkit` command and its `change` verb, the project and person
  settings it reads, the loop over the checker, its four end states and plain replies, resuming and
  the unfinished-work question, the wait on GitHub, and the retirement of `/conduct`.
- `coordination-locks`: the locks that hold a `/devkit change` run: the coordinator's stop lock,
  the stage agent's stop lock, and the coordinator's edit and hand-off lock.

### Modified Capabilities

- `change-stages`: adds the requirement that every shipped stage agent declares the skills its
  stage lists in `flow.json`.

## Impact

- devkit-openspec (0.15.1 to 0.16.0): new `skills/devkit/SKILL.md`, `hooks/change-loop.mjs` and its
  tests; `hooks/guard.mjs` (three hook modes, the run lock on edits, the session text),
  `hooks/hooks.json`, `hooks/flow-check.mjs` (two exports, no behaviour change),
  `hooks/conduct-check.mjs` (one export, `deliveryRow`, no behaviour change), the `language` user
  setting in `plugin.json`, `README.md`; `skills/conduct/` removed.
- devkit-core (0.7.1 to 0.8.0): `skills:` in `plan-readiness-reviewer`, `tdd-implementer` and
  `commit-and-pr`; two text tests move from `/conduct` to `/devkit`.
- devkit-panel (0.2.1 to 0.3.0): the buttons fill `/devkit change <id>`, and a typed
  `/devkit change <id>` names the conducted change.
- Repository: `openspec/config.yaml` (`devkit:` block, the ADR line), `docs/coordination-design.md`,
  the new `docs/adr/0011-the-change-coordinator-is-the-owners-session.md`, ADRs 0005, 0006, 0007,
  0009 and 0010 (Notes), `docs/openspec-flow.md` (with the CI pin `v0.16.0`), `docs/roles.md`,
  `docs/compozy-kit.md`, `openspec/roadmap.md` (round 25 line), `README.md`, `CHANGELOG.md`,
  `.claude-plugin/marketplace.json` (0.20.0), `docs/catalog.md` (generated).
- Projects: they type `/devkit change` in place of `/conduct`; a change begun under the previous
  script is still finished with `ship-change`.

**Dependencies.** `flow-check` and both `flow.json` files (round 14, `flow-script-checker`, archived
at `6e4c063`); `deliver-check.mjs` and `conduct-check.mjs` exports as of `6e4c063`; the `openspec`
CLI 2.x; the Claude Code platform facts checked on 2026-11-20 (`design.md` D-1).

**Exit criteria.** `openspec validate change-coordinator --strict`; the whole hook suite
`node --test plugins/openspec/hooks/guard.test.mjs` green with `GITHUB_HEAD_REF` and
`GITHUB_BASE_REF` set; the panel's `plugin test`; `python3 scripts/check.py`;
`python3 scripts/gen-catalog.py --check`; `claude plugin validate .`; the live test recorded.

**What the owner approves**, in the message that approves the plan (quoted in `approval.md`):

- The plan, and ADR 0011 (`design.md` D-16): accept it, and it becomes `accepted`; refuse it, and the
  plan goes back to planning before any code.
- The stated limits of four criteria, which stay worded as `requirements.md` has them (`design.md`,
  Proof map): AC-6's "not refused when the owner interrupts" rests on the documented fact that an
  interrupt fires no stop event, not on a test or the live run; AC-11 is tested over the message table
  the command renders, not over the model's own wording or the grill's questions; AC-5's unattended
  wait is shown live only under `-p`, capped, without a pull request, and the interactive wait is
  proved next; AC-14's live run is not deterministic and its record states the path each turn took.

**Decisions cited.** ADR 0010 (decisions 2 to 8; decision 8 amended by the proposed ADR 0011), ADR 0007 (rules kept or replaced, D-6 of the
design), ADR 0006 and ADR 0005 (what `/conduct` was), ADR 0008 (review paths unchanged), ADR 0004
(opt-in unchanged), ADR 0002 and ADR 0003 (merge rules unchanged).

**Open decisions inherited.** Whether the review stage keeps the Workflow path (A-11) stays open;
the rest of the `devkit:` block stays open for rounds 16, 17, 20 and 26.
