<!-- devkit-stage design result=passed attempt=2 commit=6e4c0635215b4a1da287461e3713c9efe010db4d -->
# Design

Change: `change-coordinator` · Date: 2026-11-20 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(design sources: `requirements.md`, `docs/coordination-design.md`, `docs/adr/0010-openspec-as-the-harness.md`).
Paths are written relative to the repository root and in backticks, never as links: this file moves
one folder deeper when the change is archived.

## Context

See `proposal.md` (Why). The design sources fix the command and its verbs
(`docs/coordination-design.md:36-47`), the change coordinator's job ("asks OpenSpec which stage comes
next, hands that stage to its subagent, checks the gate and asks again. It writes no code and does
not decide the order", `:76-79`), the loop over files (`:94-102`), the locks (`:284-296`), the two
language settings (`:326-338`) and the Claude driver ("For one task the session is the change
coordinator and each stage is a subagent", `:344-348`). ADR 0010 decides the same in decisions 2 to 5
(`docs/adr/0010-openspec-as-the-harness.md:77-108`) and keeps `ship-change`, `conduct-check` and
`deliver-check` until their rounds (decision 7, `:111-118`).

What exists at `6e4c063`:

- `flow-check` (`plugins/openspec/hooks/flow-check.mjs`): `computeFlow(facts, flow, { after })`
  (`:415-512`) returns a report with exactly one of `next` (`{ n, stage, role, skills, reasonCode,
  params, reason, progressKey }`, `:488`) and `end` (`{ state, stage, reasonCode, params, reason }`,
  `:475`); the four end states exit 0 (archived), 1 (waiting for the owner or GitHub) and 2
  (blocked), a usage error 3 (`:606-627`). `offer` never names the owner or an unshipped role
  (`:476-490`); a failed stage below its ceiling offers its `onFail` stage (`:499-504`); `--after
  <progressKey>` turns an unchanged repeat into `blocked`/`no-progress` (`:487`). The delivery is read
  from GitHub only when the walk reaches it (`readDelivery`, `:187-205`), and coarsely: no pull
  request, not pushed, a failing check, pending checks, auto-merge off or on, merged, closed.
  `--lang` (default `pt-BR`, `:578`) changes only the text readout; the JSON `reason` is English.
- Both `flow.json` files (`plugins/openspec/schemas/devkit/flow.json`, `.../devkit-lite/flow.json`,
  byte-identical copies under `openspec/schemas/`) name each stage's role, skills, helpers, part,
  ceiling and `onFail`. The roles with an agent today: `change-planner`, `plan-readiness-reviewer`,
  `tdd-implementer`, `pr-verifier`, `commit-and-pr` and the helpers; `change-coordinator`, `owner`
  and `review-bench` are played by the session and the `review-change` skill (`docs/roles.md:13-19`,
  `:93-99`); four roles are `"shipped": false` until round 16.
- `deliver-check` (`plugins/openspec/hooks/deliver-check.mjs`) computes the fine step from the
  implementation to the archive: `nextStep(state)` (`:972-1075`) over `collectState(root, id)`
  (`:1098`), with the gate command, the scoped reviewers, the PR body, the conversation, the
  auto-merge and the archive PR. `ship-change` (`plugins/openspec/skills/ship-change/SKILL.md:32-64`)
  says how each step is done.
- `guard.mjs` (`plugins/openspec/hooks/guard.mjs`) vetoes edits (`:336-355`), shell writes and
  `gh pr create` (`:357-393`) and prints the session text (`:466-483`); it learns the acting subagent
  from `agent_type` (`:60-62`); the main session has none. `hooks.json` registers `SessionStart` and
  two `PreToolUse` matchers only.
- `/conduct` (`plugins/openspec/skills/conduct/SKILL.md`, 157 lines) asks `conduct-check` and runs
  phases as app child sessions; it is retired here.

**Questions the design document did not answer, settled here** (kept as round 14 did, to show
whether the design document is enough to plan from; `requirements.md` lists the ones settled in the
grill): who the coordinator is in the Claude driver and how its locks know a run is under way (D-2);
where the command lives and how it reads its arguments (D-3); how a change id and a script are
chosen without a question, and how the script is corrected after the grill (D-4); whether the loop
still needs `deliver-check` (D-5); what the loop does with every end state, every `onFail` and every
step of `deliver-check` (D-5); what "unfinished" means and where it stopped (D-6); how the session
waits on GitHub and what each answer does (D-7); how a stop lock avoids trapping a session or looping
(D-8); where the person's language lives (D-9); which agents get `skills:` (D-10); what the panel's
buttons fill once `/conduct` is gone (D-11); how a live test of a command that talks to a person is
scripted (D-12).

## Goals / Non-Goals

**Goals:** one command and one loop whose every decision is made by scripts with tests (the model
follows a returned action, never prose about order); locks that hold the loop and can never trap a
session that is not in a run; replies in the person's language from one table; `/conduct` gone with
nothing left pointing at it.

**Non-Goals:** rebuilding `deliver-check`'s steps inside `flow-check` (round 24); new roles
(round 16); several changes at once (round 18); any change to what `ship-change`, `review-change`,
`conduct-check` or `deliver-check` do; making a hook drive the flow (ADR 0010 decision 5).

## D-1 Platform facts this design builds on (checked 2026-11-20)

Read in the Claude Code documentation (code.claude.com/docs) on 2026-11-20. The design relies on
these and nothing else of the platform:

| # | Fact | Used by |
|---|---|---|
| P1 | A plugin skill `skills/devkit/SKILL.md` is invoked as `/devkit-openspec:devkit`, and as a bare `/devkit` unless another command uses the name; `$ARGUMENTS` is the whole argument string, verb included; there is no "rest of the string" placeholder. Frontmatter keys include `description`, `argument-hint`, `disable-model-invocation`. | D-3 |
| P2 | `Stop` hook input: `session_id`, `transcript_path`, `cwd`, `stop_hook_active`, `last_assistant_message`, `background_tasks` and the common fields; no `agent_type` or `agent_id` for the main agent. A hook refuses with exit 2 (stderr is the reason) or `decision: "block"`. After 8 consecutive refusals with no tool call between them the turn ends. An interrupt by the user (Esc) does not fire `Stop`. | D-8 |
| P3 | `SubagentStop` input: the common fields (`transcript_path` is the main session's) plus `agent_id`, `agent_type`, `agent_transcript_path`; it refuses like `Stop`; a matcher matches `agent_type`. | D-8 |
| P4 | `PreToolUse` on the agent tool uses the matcher `Agent`; `tool_input` has `subagent_type` and `prompt`. Inside a subagent, tool events carry `agent_id` and `agent_type`. | D-8 |
| P5 | Plugin agent frontmatter accepts `skills` (each listed skill's full content is preloaded at the agent's start); `hooks` in a plugin agent file is ignored, so stop hooks go in `hooks/hooks.json`. A subagent cannot use AskUserQuestion. Subagents nest up to three levels. | D-2, D-8, D-10 |
| P6 | No command or skill frontmatter makes the main thread adopt an agent; `context: fork` runs a skill as a new subagent without the conversation. | D-2 |
| P7 | `userConfig` in `plugin.json` (`type`, `title`, `description`, `default`; `options` needs v2.1.271+; unknown keys fail validation); values are per user (`pluginConfigs` in the user's settings). `CLAUDE_PLUGIN_OPTION_<KEY>` reaches the plugin's hook processes only; `${user_config.KEY}` is substituted in skill and agent content. | D-9 |
| P8 | A background command has no time limit in a local terminal session or the desktop app; unattended runs (`-p`, SDK, CI) default to 30 minutes (10 for a `-p` text prompt), at most 2 hours. Under `-p`, when a background command exits Claude takes one more turn with its outcome. | D-7, D-12 |
| P9 | `claude -p "/devkit change <text>" --plugin-dir <path>` runs a slash command headless with the plugin's hooks, `Stop` and `SubagentStop` included (not under `--bare`). | D-12 |

**Where the documentation is silent**, and the live test (D-12) is the proof:

- S1. The format of the transcript file at `transcript_path`. The design reads it (D-2) in the form
  this repository already relies on for `/conduct` (`plugins/panel/hooks/conducted.ts:17-21`: a
  typed command is stored as `<command-name>/<name></command-name>` with `<command-args>`).
- S2. The shape of `background_tasks` (D-8 treats any non-empty value as "something runs").
- S3. Whether an interactive session (terminal or desktop app) takes a turn when a background command
  exits; this repository's own desktop sessions did each time on 2026-11-19 and 2026-11-20 (D-7).
- S4. Whether a bare skill name in an agent's `skills:` resolves to a skill of the same plugin
  (D-10).
- S5. Whether `${user_config.language}` is substituted with the `default` when the person never set
  it (D-9 reads an unknown value as `pt-BR`).
- S6. Whether a tool result (the `devkit-run: <id>` line a script prints, D-2) is kept in the
  transcript in a form a hook can read; S1 covers only the typed command, which the panel already
  reads.
- S7. Whether `-p --resume <session>` with `--plugin-dir` continues the same transcript with the
  plugin's hooks loaded (D-12 turns L2 to L5).

S1, S2, S6 and S7 are what the locks stand on, so they are probed before the locks are built (task
3.1, an owner-run probe of D-12a): if the probe shows any of them false, phase 3 stops and the
conducting session reports to the owner before building on it. S3, S4 and S5 are left to the live
test.

## D-2 The change coordinator is the main session, held by locks (A-6, AC-6, AC-7, AC-8)

**Decision (A-6 (a)).** In the Claude driver the session the owner typed `/devkit change` in is the
change coordinator, as section 10 of the design states (`docs/coordination-design.md:344-345`). Each
stage whose role has an agent runs as a subagent of that session (ADR 0010 decision 4,
`docs/adr/0010-openspec-as-the-harness.md:97-101`); the coordinator's own stages (the grill and the
retro, role `change-coordinator`) and the owner's gates run in the session, because only the main
session can ask the owner (P5) and only the main session may write `approval.md`
(`plugins/openspec/hooks/guard.mjs:204-205`, `:222-225`).

**How each lock is enforced** (detail in D-8):

| Criterion | Lock | Hook | Who it holds |
|---|---|---|---|
| AC-6 | the coordinator does not end its turn while a stage is ready | `Stop` (`guard.mjs stop`) | the main session, which is the only agent `Stop` fires for (P2) |
| AC-7 | a stage agent does not stop before its stage file is delivered | `SubagentStop` (`guard.mjs subagent-stop`) | the subagent whose role (`agent_type` without its plugin prefix) is the role of the stage `flow-check` names next, read from the stage file's header |
| AC-8 | the coordinator writes no product code | `PreToolUse` edit and shell writes (`guard.mjs edit`, `bash`) | the main session (no `agent_type`) while a run is under way |
| AC-8 | the coordinator hands work only to the roles the script lists | `PreToolUse` `Agent` (`guard.mjs agent`) | the main session while a run is under way |

**How a hook knows a run is under way, with nothing remembered.** Two facts, both in files:

1. The session's transcript (`transcript_path`, P2, P3; format S1). The run is under way when the
   newest slash command the person typed in this session is `/devkit` (or `/<plugin>:devkit`) with
   `change` as its first argument word. A newer typed slash command of any other name ends it.
2. The change of the run: every `change-loop.mjs` command that names a change prints, as line 1 of
   its output, `devkit-run: <change-id>` (D-5). The hook takes the newest such line written after
   that command; with none, no change is under way yet and nothing is refused.

What the run needs next is never remembered: the hook asks the same decision the loop asks
(`change-loop.mjs`, D-5), which reads `flow-check`, `deliver-check`, the stage headers, git and
GitHub. A session in which `/devkit change` was never typed has no run, so no lock of this change
refuses anything in it. Each lock refuses at most once for an unchanged state (the progress key,
D-8), and every error while reading the transcript, the checker or GitHub lets the action through
(fail open), so a lock can never trap a session or loop past the ceiling.

**Alternatives rejected.**

| Option | Why not |
|---|---|
| (b) A `change-coordinator` subagent without edit tools, the main session relaying the owner's gates | A subagent cannot ask the owner (P5): the grill is a conversation of several questions, each would end the subagent and be relayed; the subagent writes `requirements.md` and `retro.md` (its own stages, `docs/roles.md:16`), so it needs a write tool anyway; a background wait on GitHub re-invokes the main session (P8), not a finished subagent; reviewers and a Workflow round would sit two levels down for no gain. |
| The main session adopts a coordinator agent (no edit tools) through frontmatter | No frontmatter does that (P6); `--agent` is a session flag the owner would have to type. |
| `context: fork` in the skill (the command runs as a forked subagent) | The same limits as (b): no owner questions, no `approval.md`, no re-invocation. |
| A run file under `.claude/` written by the command | Not tied to the session: a second session in the same checkout would be held by a run it never started. The transcript is per session by construction. |
| Keep "it has no edit tool" literally (`docs/coordination-design.md:294`, ADR 0010 `:145-150`) | Only possible with (b). The decision's substance (no side door: product code only by the implementer role) holds through a refusal before the edit, the mechanism the design already names for "Product code closed until the plan is approved" (`docs/coordination-design.md:290`). The change of mechanism is proposed as ADR 0011 (D-16), which the owner accepts or refuses at plan approval; ADR 0010 gets a dated Note pointing at it (D-13). |

## D-3 The `/devkit` entry and `change-loop.mjs start` (A-1, AC-3, AC-4, AC-12)

**Where.** A skill, `plugins/openspec/skills/devkit/SKILL.md` (`docs/conventions.md` "Prefer a skill
over a command"; P1). Frontmatter: `name: devkit`; a one-line `description` ending with "Use when the
owner types /devkit, /devkit change <what to do>, or /devkit change to continue." (it must say when,
`scripts/check.py:56`); `argument-hint: "change [<request> | <change-id>]"`;
`disable-model-invocation: true`, so a run starts only from the person's typed command (a model never
starts one by its own choice). The body is the loop's procedure (D-5); every rule that decides
something is in the script, not in the body.

**Reading `$ARGUMENTS` (P1).** The body's first step runs the script with the arguments on standard
input through a quoted heredoc, so no character of the request reaches the shell:

    node <skill-dir>/../../hooks/change-loop.mjs start --lang ${user_config.language} <<'DEVKIT_ARGS'
    $ARGUMENTS
    DEVKIT_ARGS

(`<skill-dir>` is resolved by the model, as in `ship-change`; `${user_config.language}` and
`$ARGUMENTS` are substituted by Claude Code before the model reads the body, P1, P7.) A quoted
heredoc is ended by the first line equal to its terminator, so the skill says: when a line of the
request equals `DEVKIT_ARGS`, use `DEVKIT_ARGS_` followed by digits that no line of the request
holds. With that rule no character of the request is read by the shell; the rule is the model's to
follow, and a request line equal to the chosen terminator would cut the request there (a stated
limit, not tested). The script trims
the input; the verb is its first word, lower-cased; the text is the rest, trimmed. Every
`change-loop.mjs` call the skill makes carries `--lang ${user_config.language}` (a mode flag reaches
every call).

**`start` decides, in this order** (first match wins; read-only: it creates and runs nothing):

| # | Input | `mode` | Reply key (D-9) | Exit |
|---|---|---|---|---|
| S1 | the verb is `roadmap`, `status`, `project` or `help` | `not-built` | `verb-not-built` with round 18, 18, 19, 23 | 0 |
| S2 | no verb, or any other verb | `unknown-verb` | `verb-unknown` | 0 |
| S3 | no `openspec/` folder above the working directory, or the project's schema is not `devkit` or `devkit-lite` (the ADR 0004 opt-in, `guard.mjs:146`) | `not-set-up` | `not-set-up` | 0 |
| S4 | `devkit.driver` or `devkit.language` holds a value outside its accepted set (D-9) | `setting-unknown` | `setting-unknown` | 0 |
| S5 | `devkit.driver` is `compozy` or `script` | `driver-not-built` | `driver-not-built` with round 21 or 22 | 0 |
| S6 | the text is one token naming a change found active or archived in the main checkout or any worktree | `resume` (`change` set) | `resumed` (the id and where it stopped) | 0 |
| S7 | no text, and exactly one unfinished change | `resume` (`change` set) | `resumed` | 0 |
| S8 | no text, and two or more unfinished changes | `choose` | `choose` (each id with where it stopped) | 0 |
| S9 | no text, and no unfinished change | `nothing` | `nothing-to-resume` | 0 |
| S10 | free text, and one or more unfinished changes | `ask-unfinished` | `ask-unfinished` | 0 |
| S11 | free text, and no unfinished change | `new` | none (the model proposes the id and script, D-4) | 0 |

Row S0, before S1: a usage error (an unknown option, an unreadable `openspec/config.yaml`) exits 3
with `{ "version": 1, "error": ... }` and the reply `blocked` with the reason `unreadable`; nothing is
created or run.

**Unfinished.** A change is unfinished when its folder is active (`openspec/changes/<id>/`, not
`archive`) in the main checkout or in any worktree of `git worktree list --porcelain`
(`listWorktrees`, exported by `plugins/openspec/hooks/conduct-check.mjs:122-141`), or when a worktree
is on `chore/archive-<id>` (its archive pull request is not merged yet). Each is listed once, a
worktree on the change's own branch winning over the main checkout. Where it stopped is one phrase
from `flow-check`'s report in that checkout (D-9 `where-*` keys): the next stage's title, or the end
state with its stage's title; a change with no stage header is "begun under the previous script".

**Output** (`--json` is the only form; the skill reads it): `{ "version": 1, "mode", "verb", "text",
"change", "unfinished": [{ "id", "root", "where" }], "settings": { "driver", "filesLanguage",
"personLanguage" }, "reply" }` (`reply` absent in S11 only).

**What the skill does with each mode.** `not-built`, `unknown-verb`, `not-set-up`,
`setting-unknown`, `driver-not-built` and `nothing`: say `reply` and end the turn. `choose` and
`ask-unfinished`: ask `reply` as one question with AskUserQuestion where the host has it (else say it
and end the turn), the options being each listed id and, for `ask-unfinished`, "start the new
request"; the answer picks `resume` of that id or D-4. `resume`: say `reply`, then enter the loop (D-5) with `change`.
`new`: D-4.

**Alternatives rejected.** A command file (`commands/devkit.md`): the same invocation, the older form
(P1, `docs/conventions.md`). `arguments: [verb, text]` in frontmatter: `$text` would hold only one
word (P1, no "rest of the string"). Passing `$ARGUMENTS` as a shell argument: quotes, backticks and
`$(...)` in a request would reach the shell. Letting the model parse the verb: a rule in prose, the
failure ADR 0010's survey names (`docs/adr/0010-openspec-as-the-harness.md:40-41`).

## D-4 Opening a change: the id, the script, the worktree (A-2, A-3, A-4, AC-1)

**The id (A-2).** The session proposes it from the request: kebab-case, the request's subject in at
most five words, at most 48 characters (`add-csv-export`). It states it in its reply and does not ask.
Typing `/devkit change <text>` is the go-ahead ADR 0007 asked for (A-4); no other question is asked
before the change is created.

**The script (A-3).** The session chooses with one rule, written in the skill: `devkit-lite` only for
a small change that is easy to undo and touches no screen, no boundary between parts of the project
and no contract other parts rely on; `devkit` otherwise and whenever in doubt. It passes the choice
and one reason code to `open`; the reply renders the reason (D-9 `opened`, reason codes `small`,
`doubt`, `architecture`, `contract`, `ui`, `capability`, `risk`). The grill's classification then
corrects a wrong guess deterministically (below), and the owner switches it by saying so before the
plan is written (the session runs `script`).

**`change-loop.mjs open <id> --script <devkit|devkit-lite> --why <code> --lang <l>`**, the request on
standard input (the same quoted heredoc as `start`):

| # | Input | Result | Exit |
|---|---|---|---|
| O1 | `<id>` does not match `^[a-z0-9][a-z0-9-]{1,47}$`, holds `--`, or is `archive` | nothing created; reply `name-invalid` | 3 |
| O2 | a folder `openspec/changes/<id>/` (active) or an archived `*-<id>` exists in the main checkout or a worktree, a local branch `<id>` or `chore/archive-<id>` exists, `origin/<id>` exists, or `<main>/.claude/worktrees/<id>` exists | nothing created; reply `name-taken` (the session picks another id and calls `open` again) | 3 |
| O3 | the project is not set up (S3), or a setting is unknown (S4, S5) | nothing created; the `start` reply of that row | 3 |
| O4 | otherwise | `git fetch origin --prune --quiet` when a remote `origin` exists; `git worktree add -b <id> <main>/.claude/worktrees/<id> <start>` where `<start>` is `origin/<default>` (`<default>` from `refs/remotes/origin/HEAD`, else `main`, else `master`) or, with no remote, the main checkout's `HEAD`; `openspec new change <id> --schema <script>` in the worktree; then `requirements.md` written from the schema's template with `result=pending` and the request, verbatim, as a quoted block under `## Request`. Prints `devkit-run: <id>` then the JSON `{ "version": 1, "change", "script", "worktree", "branch", "base", "reply" }` with reply `opened` | 0 |

`<main>` is the parent of `git rev-parse --path-format=absolute --git-common-dir`, as `/conduct` used
(`plugins/openspec/skills/conduct/SKILL.md:36`). Writing the request into `requirements.md` at once
is what makes AC-3 hold before the grill: a session killed before its first question resumes at the
grill with the request on disk (`flow-check` reads that file as written and not judged, so the
requirements stage waits for the owner, `flow-check.mjs:505-510`).

**`change-loop.mjs script <id> <devkit|devkit-lite> --why <code> --lang <l>`** (the correction):

| # | Input | Result | Exit |
|---|---|---|---|
| C1 | `proposal.md` does not exist yet and the script differs | the `schema:` line of the change's `.openspec.yaml` is rewritten; reply `script-switched` | 0 |
| C2 | `proposal.md` exists | nothing changes; reply `script-locked` | 2 |
| C3 | the script is already the one asked | nothing changes; no reply | 0 |

The loop asks for C1 itself (D-5 row P4) when `requirements.md` has passed, the change is on
`devkit-lite`, no `proposal.md` exists and the grill's line `Classification: ... flags=[...]`
(`plugins/core/skills/requirements-grill/SKILL.md:73`) holds `architecture`, `contract` or `ui`.

**Alternatives rejected.** Asking the owner for the id and the script (what `/conduct` did,
`plugins/openspec/skills/conduct/SKILL.md:84`): the owner chose "the session chooses and says why"
(question 3). `proposeSchema` of `conduct-check` (`:164-176`) as the chooser: it reads roadmap words,
not a request, and the owner asked for the session's judgment; it stays `conduct-check`'s. Opening
after the grill: the grill's file lives in the change folder.

## D-5 The loop: `change-loop.mjs next`, and which checker decides what (A-5, AC-2, AC-9)

**Decision (A-5).** `flow-check` decides the order and every end of the walk; it alone decides the
open and plan parts (the stages before the implementation). From the implementation on, `flow-check`
still says which stage the change is in and still ends the run when it is blocked (a ceiling, no
progress, a closed pull request, GitHub unreadable), and `deliver-check`'s `nextStep` names the step
inside that stage: which phase, which gate command, which reviewers, which pull-request step, which
archive step. That is the split `/conduct` already had (`conduct-check` reused `deliver-check` "for
everything from `implement` to `archived`", `docs/openspec-flow.md:188`), and the design keeps
`deliver-check` as the next-step oracle until round 24 (`docs/coordination-design.md:267-269`,
`:467`). The loop calls `deliver-check` in-process (`collectState`, `nextStep` and `buildReport`,
exported), so nothing about `deliver-check` changes.

**The two `conduct-check` overrides (readiness finding 1).** `/conduct` did not take `deliver-check`'s
step as is: `conduct-check.mjs` puts two overrides that need git in front of it, composed by
`deliveryRow` (`plugins/openspec/hooks/conduct-check.mjs:423-430`). Override 2, `rewrittenBranch`
(`:363-372`): the pull request's head is not an ancestor of `HEAD` but the branch held it before our
own rebase, so the step is `push-rebased` (commit the edits, `git push --force-with-lease=<branch>:<oldHead>`).
Override 1, `releaseConflict` (`:396-420`): a pull request in conflict (`deliver-check`'s `blocked`
item 5, or `stop-archive` at `archive-pr`, with `conflict: true`) is classified with `git merge-tree`:
only release files (and the CI pin of `docs/openspec-flow.md`) gives `resolve-release-conflict`, which
runs `release-rebase.mjs`; GitHub's conflict with a clean merge gives `update-branch` in `merge` mode;
any other path stays `blocked` with the paths named (`docs/openspec-flow.md:240-251`). `disable-auto-merge`
goes before both. The loop keeps this behaviour by reusing `conduct-check`'s own composition: this
change adds `export` to `deliveryRow` and to nothing else, so the order, the classification and the
commands stay in one place and no behaviour of `conduct-check` changes (its suite runs unchanged in gate
6.8). That is smaller than exporting `rewrittenBranch` and `releaseConflict` and copying the order of
`deliveryRow` into the loop. The loop calls it as `deliveryRow(ctx, row, { state, report })` with
`ctx = { ref: "origin/<base>", base }` (`<base>` as D-4 resolves it), `row = { id, worktree: root }`,
`state` from `collectState` and `report` from `buildReport(state)`, and reads `next.step` of the result.
Override 3 of `conduct-check` (archives serialized between changes, `:432-446`) belongs to the round
mode, which ran several changes at once; one run conducts one change (D-6), so it does not apply.

| Alternative | Why not |
|---|---|
| `flow-check` alone | It has no gate command, no scoped review round, no pull-request body or conversation, no `update-branch`, no archive pull request: a change could never reach its archive. Its `uncommitted` reason names the implementation, whose role never commits. Rebuilding those steps in it is round 24's work. |
| `deliver-check` alone from the approval on | AC-2 asks `flow-check`; the ceilings and the no-progress rule are `flow-check`'s (ADR 0010 decision 3). |
| Drop the two overrides, as plain `deliver-check` would | A release-file conflict (several changes bump the same `plugin.json`, `CHANGELOG.md`, catalog and CI pin) would end the run blocked where `/conduct` finished it, and a branch the loop itself rebased could never be pushed |
| Export `rewrittenBranch` and `releaseConflict` and compose them in the loop | Two exports and a second copy of `deliveryRow`'s order (auto-merge off first, then a rewritten branch, then a conflict), which could drift |
| Hand the whole delivery to the `ship-change` skill | Its waits are capped watches (`plugins/openspec/skills/ship-change/SKILL.md:83`), against AC-5; its stops and order would be prose again, untestable as the loop's decisions. Its rows stay the how of each step (below). |

**`change-loop.mjs next --change <id> --lang <l> [--after <progressKey>]`.** Read-only, like the
checkers. It finds the change's checkout (a worktree on branch `<id>` or `chore/archive-<id>`, else
the main checkout when it holds `openspec/changes/<id>/`, else the main checkout for an archived
folder), runs `flow-check`'s `collectFlow` and `computeFlow` there with no `--after`, and, in the
build-to-archive part, `deliver-check`'s `collectState` and `buildReport` passed through
`conduct-check`'s `deliveryRow` (above). It prints
`devkit-run: <id>` and then one JSON action:

    { "version": 1, "change", "script", "root", "branch", "filesLanguage",
      "kind": "agent" | "session" | "grill" | "end",
      "stage", "stageTitle", "role", "skills",
      "agent", "brief",              (kind agent)
      "step", "detail",              (kind session; "step" also on an agent hand-off of a delivery step)
      "end": { "state", "why" },     (kind end)
      "reply",                       (kind end; also the switch notice)
      "progressKey" }

Exit codes, as `flow-check`'s (`flow-check.mjs:606`): 0 for an `agent`, `session` or `grill` action
and for `archived`; 1 waiting for the owner or on GitHub; 2 blocked; 3 a usage or preflight error
(`{ "version": 1, "error" }` with the reply `blocked`/`unreadable`).

**The progress key and the two loop guards.** `progressKey` is `<stage>/<step or stage>@<fingerprint>`,
the fingerprint being `flow-check`'s (head, working tree, untracked bytes outside `.claude/`,
`flow-check.mjs:157-171`, exported by this change with no behaviour change). The skill passes the key
of the previous action as `--after` after every `agent` or `session` action.

- K1 (no progress): `--after` equals the new key: end blocked, why `no-progress` (the stage came back
  with nothing changed).
- K2 (not delivered): the `--after` key's stage equals the new action's stage, that stage is an
  artifact stage whose role has an agent, and `flow-check` reports it pending with `no-file`,
  `not-judged`, `no-header`, `bad-header` or `header-other-stage`: end blocked, why `not-delivered`.
  This is how "the coordinator reports the stage as failed" after a stage agent stopped without its
  file (AC-7).

**The open and plan parts** (`flow-check`'s current stage, `next.stage` or `end.stage`, has `part`
`open` or `plan`; first match wins):

| # | `flow-check` says | Action |
|---|---|---|
| P1 | next `open` (no `.openspec.yaml`) | end blocked, why `not-opened` |
| P2 | next `requirements` (any reason), or end waiting for the owner at `requirements` | `grill`: the session runs the `requirements-grill` skill with the owner (questions in the person's language, `requirements.md` in the files' language, the request already in it) and sets its header to `result=passed` when the owner has answered |
| P3 | next `proposal`, the change is on `devkit-lite`, `requirements.md` passed, no `proposal.md`, and the classification flags hold `architecture`, `contract` or `ui` | `session`, step `switch-script`, `detail.command` the D-4 `script` command; reply `script-switched` |
| P4 | next is a stage whose role has an agent, with reason `no-file`, `no-header`, `bad-header`, `header-other-stage`, `not-judged`, `stale-plan` or `rerun-after-fix` | `agent`: the role's agent (D-10 map), brief per the table below |
| P5 | next is a stage offered because another failed (reason `fix-after-failure`, the failed stage's `onFail`: the readiness review sends the plan back to `proposal`) | `agent`: the offered stage's role (`change-planner`), the brief naming the failed stage and its attempt |
| P6 | end waiting for the owner at `approval`, reason `owner-pending` | end waiting for the owner, reply `waiting-approval`; `detail.readiness` is `deliver-check`'s `approvalState(dir).readiness` (`deliver-check.mjs:958-967`), the hash the `approval.md` form needs (`ship-change` row `stop-plan-approval`, `SKILL.md:37`) |
| P7 | end waiting for the owner at `approval`, reason `approval-stale` | the same, reply `waiting-approval-again` |
| P8 | end waiting for the owner, reason `unshipped-role-pending` | end waiting for the owner, reply `waiting-unrun-stage` |
| P9 | end blocked (`ceiling-reached`, or any other blocked end) | end blocked, why `ceiling` (stage and attempt) or the D-9 why of that reason |
| P10 | the change began under the previous script (`script: "previous"`) | end blocked, why `previous-script` (it names `/ship-change <id>`, which finishes it, A-11) |

**From the implementation to the archive** (the current stage's `part` is `build`, `after`,
`delivery` or `close`, or `flow-check` ends archived while the change's checkout is a worktree on
`chore/archive-<id>`, whose archive pull request may still be open; the step of `deliveryRow` (the
`deliver-check` step, or one of the two overrides above) decides, after rows A0 and B0). Row A0: `flow-check` ends archived and no worktree is on
`chore/archive-<id>` (the archive landed): end archived, reply `archived`, with no GitHub call, so an
old change reads archived offline too.

| # | Input | Action |
|---|---|---|
| B0 | `flow-check` ends blocked (`ceiling-reached`, `no-progress`, `gh-error`, `checks-unreadable`, `pr-closed`) | end blocked with that why |
| B1 | `implement`, `fix-review`, `fix-defect`, `fix-checks`, `apply-proposals` (all `deliver-check`) | `agent` `devkit-core:tdd-implementer` (the role of `implementation`, and of every `onFail` from `evidence`, `review` and `delivery`), `step` and `detail` = the step's object |
| B1a | `resolve-release-conflict` (override 1: the conflict is in release files only) | `agent` `devkit-core:tdd-implementer`, `detail.command` = the `release-rebase.mjs` command and `detail.paths`; the brief's sentence is the one `/conduct` used: run the command in the worktree, then the project's test command, report the JSON and the result, change nothing else (`plugins/openspec/skills/conduct/SKILL.md:102`, carried into the `devkit` skill); `Outcome: failure` ends the run blocked, why `pr-problem` |
| B2 | `commit`, `open-pr`, `push`, `open-archive-pr` (all `deliver-check`) | `agent` `devkit-core:commit-and-pr` (the role of `delivery`) |
| B2a | `push-rebased` (override 2: our own rebase rewrote the branch) | `agent` `devkit-core:commit-and-pr`, `detail` = `oldHead`, `paths`, `command`; the brief's sentence: commit these files by name if any, then push with `git push --force-with-lease=<branch>:<oldHead> origin <branch>`, no pull-request edit (`conduct/SKILL.md:103`, carried into the `devkit` skill) |
| B3 | `verify` | `agent` `devkit-core:pr-verifier` (the role of `evidence`) |
| B4 | `review` | `session`, step `review`: the `review-change` skill as the `ship-change` `review` row says (`SKILL.md:41`), then `review.md`'s header (the role `review-bench` is that skill, `docs/roles.md:93-99`) |
| B5 | `gate` | `session`, step `gate`, `detail.command` and `detail.task`: run the command alone; green ticks the task; red ends the run blocked, why `tests-red` |
| B6 | `edit-pr-body`, `enable-auto-merge`, `disable-auto-merge`, `update-branch` (from `deliver-check`, or from override 1 when GitHub's conflict merges cleanly), `answer`, `retro`, `archive`, `tick-roadmap` | `session`, that step, done as its `ship-change` row says; an `answer` the row leaves to the owner ends the run waiting for the owner, reply `waiting-pr-decision` |
| B7 | `wait-checks` | end waiting on GitHub, reply `waiting-github` (the checks) |
| B8 | `wait-merge` | end waiting on GitHub, reply `waiting-github` (the merge, or the archive pull request's merge) |
| B9 | `ready`, `archive-pr-ready` | end waiting for the owner, reply `waiting-merge` or `waiting-archive-merge` (`pr` mode) |
| B10 | `stop-review-deadlock` | end waiting for the owner, reply `waiting-review-dispute` |
| B11 | `stop-retro-answers` | end waiting for the owner, reply `waiting-retro` |
| B12 | `stop-plan-approval` | end waiting for the owner, reply `waiting-approval` or `waiting-approval-again`, `detail.readiness` |
| B13 | `stop-plan-mode` | end waiting for the owner, reply `waiting-by-hand` (the project delivers by hand; the session writes no code) |
| B14 | `stop-branch`, `stop-merge-setup`, `stop-archive`, `stop-not-approved`, `blocked` (from `deliver-check`, or from override 1 for a conflict outside the release files) | end blocked, why `wrong-branch`, `merge-setup`, `archive-failed`, `plan-not-approved`, `pr-problem` |
| B15 | `archived` | end archived, reply `archived` |
| B16 | any other step | end blocked, why `unknown-step`. The test `change-loop decide: the B rows are exactly the steps the checkers can return` reads every step name `deliver-check.mjs` can return and the two override names `conduct-check.mjs` adds, and fails both on a returnable step this table lacks and on a row naming a step no checker returns |
| B17 | `deliver-check` throws (`UsageError`, `ShipConfigError`), or `deliveryRow` throws | exit 3, end blocked, why `unreadable` |

The retro (`retro` and `stop-retro-answers`) is the coordinator's own stage: it runs in the session
(B6, B11), never as a `general-purpose` subagent, which is not a role the script lists (D-8).

**Every end state, and what the coordinator does next.**

| End | The coordinator | The next run |
|---|---|---|
| archived | says `reply`; the run is over | `/devkit change <id>` says archived again |
| waiting for the owner | says `reply` (the approval also gets the plan's summary, as the `stop-plan-approval` row says); the turn ends | the owner's next message in the session is the answer (the run is still under way, D-2): the session records it as the matching `ship-change` row says and runs `next` |
| waiting on GitHub | starts the wait in the background (D-7), says `reply` | the wait's end starts the next turn by itself; `/devkit change` is safe at any time |
| blocked | says `reply`; the run is over | `/devkit change` re-reads the files: a run blocked by a cause the files or GitHub still show (a ceiling, a closed pull request, a stop of the delivery checker, the previous script) ends blocked again; a run blocked by K1 or K2 hands that stage once more, since a new run has no previous key, and K1 or K2 ends it again if it still makes no progress |

**Every `onFail`, and the role that takes it.** `readiness` → `proposal`: P5, `change-planner`.
`evidence`, `review`, `delivery` → `implementation`: `deliver-check` names `fix-defect`, `fix-review`
or `fix-checks`, B1, `tdd-implementer`. `unit-tests`, `e2e-tests` → `implementation`: their roles do
not ship (round 16), so `flow-check` never offers them. A failed stage whose fix changed the work is
offered again (`rerun-after-fix`, P4); at its ceiling the run ends blocked (P9, B0).

**The brief (AC-9).** The prompt of an `agent` action is `brief`: the role, the change and the stage,
never the method (the agent's own skills carry it, D-10):

    Change <id> (<script> script), stage <stage>: <what>. Work only in <root> on branch <branch>;
    every file path is absolute under it; start every Bash command with cd <root> && ; do not fetch.
    Write the change's files in <files language>.

`<what>`: P4 plan stages, "write the plan files the script still lacks, from <stage> on, each from
`openspec instructions <artifact> --change <id>`"; P4 readiness, "review the plan"; a stale or rerun
stage, "<stage> is out of date: bring it up to date"; P5, "<failed stage> failed at attempt <a> of
<c>: revise the plan from its findings"; B1 to B3, "step <step>" followed by `detail` as JSON, and
the skill appends the dispatch sentence of that step's `ship-change` row (one source of those
sentences). `<files language>` is the display name of `devkit.language` (`English`, `Brazilian
Portuguese`, else the tag).

**The skill's loop** (`plugins/openspec/skills/devkit/SKILL.md`, "Loop"): run `next` (with
`--after` the previous key after an `agent` or `session` action); `agent`: one Agent call,
`subagent_type` = `agent`, prompt = `brief` (plus the row sentence), in the foreground; `session`:
the step as the named `ship-change` row says, in `root`; `grill`: the grill; `end`: D-5 table above.
Then run `next` again. It never chooses the order, never runs two stages at once, and never dispatches
a subagent for a whole change.

## D-6 ADR 0007's rules, unfinished work and resuming (AC-3, AC-4, AC-15)

ADR 0007 (`docs/adr/0007-one-change-on-request.md:27-35`) had three rules for `/conduct`; ADR 0010
left open which the change coordinator keeps (`docs/coordination-design.md:440-441`).

| ADR 0007 rule | In the change coordinator | Decided by |
|---|---|---|
| Unfinished work is reported before anything runs, and goes on only on the owner's own message | Kept, reshaped: a new request while another change is unfinished names it and where it stopped and asks continue-or-new before anything is created or run (S10). Resuming a named or the only unfinished change does not ask: the owner's typed `/devkit change` is the request to continue (S6, S7). A dirty worktree mid-run is expected and not asked about. | the owner, 2026-11-20 (grill question 2) |
| A missing change is created only on the owner's answer naming the id and the schema | Replaced: typing `/devkit change <text>` is that answer (A-4); the session names the id and the script and says why, without a question (D-4) | the owner, 2026-11-20 (grill question 3 and A-4) |
| One change on request, never a sweep; a bare call lists and asks | Kept: one run conducts one change; a bare `/devkit change` resumes the only unfinished change or asks which (S7, S8); nothing sweeps (the roadmap coordinator is round 18) | ADR 0010 decision 7 (`:117`, one at a time until round 18) |

**Resuming (AC-3).** Nothing is remembered between runs: `next` re-reads the folder, the headers,
git and GitHub on every call, and `requirements.md` holds the request from the moment the change is
opened (D-4). A session killed at any stage therefore reaches, on `/devkit change` (S7) or
`/devkit change <id>` (S6), the same `next` action it would have reached. A stage subagent killed
mid-work left its file missing or pending: the same stage is handed again. A background wait killed
with its session costs nothing: the next run starts a new one if GitHub still waits.

**Alternatives rejected.** Asking before every resume (ADR 0007's rule as written): the owner's typed
command already names the work; the question was for a sweep that no longer exists. Refusing a new
request while another change is unfinished: the owner chose to be asked (question 2).

## D-7 Waiting on GitHub with no time limit (AC-5)

**Decision.** When `next` ends waiting on GitHub (B7, B8), the session starts one background command
and then says the reply (`waiting-github`: it is waiting, with no time limit, and calling
`/devkit change` again is safe):

    node <skill-dir>/../../hooks/change-loop.mjs wait --change <id> --lang ${user_config.language}

run with the Bash tool's background option. `wait` takes the decision `next` gives now, then every
`--interval` seconds (default 60, at least 5) computes it again, holding no state but that first
decision. It exits 0, printing `devkit-run: <id>` and the new action exactly as `next` prints it,
as soon as the decision is anything else; GitHub's answer then reaches the session through the
command's end, which starts its next turn (P8; S3 for an interactive session). The turn runs `next`
and goes on.

| # | While waiting, GitHub answers | `wait` | The next turn (D-5) |
|---|---|---|---|
| W1 | nothing new (checks still running, merge still pending) | keeps polling, with no limit of its own | none yet |
| W2 | the checks pass, `merge` mode | exits with `enable-auto-merge` | B6: auto-merge on, then `next` ends waiting for the merge and starts a new wait |
| W3 | the checks pass, `pr` mode | exits with `ready` | B9: waiting for the owner, who merges |
| W4 | a check fails | exits with `fix-checks` | B1: `tdd-implementer` fixes it, then commit, verify, review and push as the steps come |
| W5 | the pull request merges | exits with `retro` | B6: the retro |
| W6 | the archive pull request merges | exits with `archived` | B15 |
| W7 | the pull request is closed without merging | exits with blocked, `pr-closed` | B0 |
| W8 | GitHub cannot be read | retries; after three consecutive failures exits with blocked, `github-unreadable` | B0 |
| W9 | a new comment or review asks something | exits with `answer` | B6 |

**What a dead session costs.** The wait is a child of the session: it ends with it, and nothing
resumes it. Calling `/devkit change` again re-reads everything and starts a new wait if GitHub still
waits. Under `-p` (unattended), each background command is capped at 30 minutes by default and 2
hours at most (P8): when it is stopped, the turn it starts runs `next`, which waits again; the cap only
splits the wait. A second wait started by a second `/devkit change` while one runs is harmless: both
end on the same answer and the second turn finds the step already done (K1 ends a repeat as blocked
only when nothing changed).

**Alternatives rejected.** A session cron or scheduled wake-up (ADR 0005, rejected by ADR 0006
decision 3, `docs/adr/0006-phases-as-child-sessions.md:35-36`): it fires only while the session is
idle and spends tokens on every firing. One capped watch then the owner's re-run (`ship-change`,
`/conduct`): the failure the owner reported on 2026-11-19 (`docs/coordination-design.md:444-446`).
A Stop hook that keeps the session busy until GitHub answers: a hook that drives (ADR 0010 decision
5) and capped at eight continuations (P2). A daemon outside the session: state outside the session
for a job a child process does. `gh pr checks --watch`: it watches checks only, not the merge, the
conversation or the archive pull request; `wait` asks the whole decision.

## D-8 The locks (AC-6, AC-7, AC-8)

All four live in `plugins/openspec/hooks/guard.mjs` as modes, registered in
`plugins/openspec/hooks/hooks.json` (P5: a plugin agent's own `hooks` are ignored):

    "Stop":         [{ "hooks": [{ "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/guard.mjs\" stop", "timeout": 60 }] }],
    "SubagentStop": [{ "hooks": [{ "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/guard.mjs\" subagent-stop", "timeout": 60 }] }],
    "PreToolUse":   the two existing entries, plus
                    { "matcher": "Agent", "hooks": [{ "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/guard.mjs\" agent", "timeout": 10 }] }

`SubagentStop` has no matcher: which roles have a stage file is data in `flow.json`, so round 16's
roles are held without a hook change. As every guard mode, the new ones act only in an opted-in
project (`optedIn`, `guard.mjs:146`; ADR 0004) and exit 0 under `DEVKIT_BYPASS=1` (`:516`). The
three new modes import `change-loop.mjs` dynamically, as `ci` imports `deliver-check.mjs`
(`:489-503`), so `guard.mjs ci` in a project's CI still needs only its three downloaded files. The
transcript reader (`runOf(input)`: the newest typed command and the newest `devkit-run:` line after
it, D-2) is a pure function exported by `guard.mjs`, with no imports, so the edit lock stays
synchronous.

Refusal texts are addressed to the model, in English like every guard refusal; they name the stage
id and the file because the model acts on them. With `DEVKIT_HOOK_LOG=<file>` in the environment
Claude Code was started with, each decision of the `stop`, `subagent-stop` and `agent` modes is
appended to that file as one JSON line (`{ "at", "mode", "session", "agentType", "change",
"decision": "refuse" | "allow", "why" }`, written by `JSON.stringify` in that key order, with no
spaces, so `"mode":"stop",` comes before `"decision":"refuse"` on a line); without it nothing is
written. The live test reads it
(D-12).

**Refuse at most once per unchanged state.** A refusal records its progress key in
`<os.tmpdir()>/devkit-stop/<session_id>.json` (`<session_id>-<agent_id>.json` for a subagent). A
stop attempted again with the same key is let through: the lock refuses once, and the loop guard of
D-5 (K1, K2) or the ceiling ends the run as blocked. Losing that file costs one more refusal, never a
trap; Claude Code's own cap (8 refusals without a tool call, P2) is never reached, because a second
refusal needs a changed state, and changing it takes a tool call.

**`guard.mjs stop` (AC-6).**

| # | Input | Decision |
|---|---|---|
| T1 | no run in this session (no typed `/devkit change`, or a newer typed slash command, or no `devkit-run:` line after it) | allow |
| T2 | `background_tasks` is not empty (a background wait, a gate run in the background, a review round as a Workflow) | allow: the session will be called back (S2) |
| T3 | the run's decision (D-5 `next`) is `end` (any of the four states) | allow |
| T4 | the decision is `grill` (the grill waits for the owner's answers) | allow |
| T5 | the decision is `agent` or `session`, and its key is not the recorded one | refuse: "the change <id> has the stage <stage> ready (<agent or step>); run it, or end the run as blocked and say why. The next action comes from: node <hooks-dir>/change-loop.mjs next --change <id> --lang <l>" (the absolute path of the hook's own folder, and the person's language from `CLAUDE_PLUGIN_OPTION_LANGUAGE`, so a session that lost the skill's text after a compaction can still act); record the key |
| T6 | the same, and its key is the recorded one | allow |
| T7 | any error (transcript, checker, git, GitHub) | allow (fail open) |

An interrupt by the person fires no `Stop` (P2): nothing is refused, and nothing needs to be.

**`guard.mjs subagent-stop` (AC-7).**

| # | Input | Decision |
|---|---|---|
| U1 | no run (T1, read from the main session's `transcript_path`, P3) | allow |
| U2 | the subagent's role (`agent_type` after its last `:`) is not the role of any artifact stage of the change's script | allow (a reviewer, a helper, `tdd-implementer`, `commit-and-pr`) |
| U3 | `flow-check`'s next stage is not one of that role's stages | allow (the stage is delivered; or the change moved on) |
| U4 | `flow-check`'s next stage is that role's and its reason is `no-file` | refuse: "<file> of stage <stage> does not exist: write it, with its stage header, before you stop"; record the key |
| U5 | the same with `not-judged`, `no-header`, `bad-header` or `header-other-stage` | refuse: "<file> of stage <stage> still says result=pending (or has no valid header): set its header before you stop"; record the key |
| U6 | U4 or U5 with the recorded key | allow; the coordinator's next `next` ends the run blocked, why `not-delivered` (K2) |
| U7 | any error | allow |

`flow-check` alone decides U3 to U5: a stage file's state is read from its header, and the walk
reaches no GitHub call before the delivery stage.

**The edit lock (AC-8).** In `guardEdit` and `guardBash` (`guard.mjs:336-393`), before the existing
rules: when the actor is the main session (no `agent_type`), `runOf(input)` finds a run, and the
target classifies as `code` (`classify`, `:197-215`), refuse: "in a /devkit change run this session
writes no product code; the implementation is handed to tdd-implementer by the loop". Planning files,
`approval.md` and the archive steps are under `openspec/` and stay as today. Outside a run, and for
every subagent, the existing rules apply unchanged (the existing tests' inputs carry no
`transcript_path`, so they are not in a run).

**`guard.mjs agent`: the hand-off lock (AC-8).**

| # | Input | Decision |
|---|---|---|
| H1 | the caller is a subagent (`agent_type` set) | allow (a readiness reviewer calling its auditor) |
| H2 | no run | allow |
| H3 | `subagent_type`'s role (after its last `:`) is a role or a helper of a stage of the change's script (`flow.json`), other than `owner`, `change-coordinator` and `review-bench` | allow |
| H4 | any other agent (`general-purpose`, `Explore`, another plugin's agent) | refuse: "in a /devkit change run this session hands work only to the roles of the <script> script: <list>; <type> is not one of them" |
| H5 | any error | allow |

**Alternatives rejected.** `stop_hook_active` as the "second attempt" signal: whether it stays set
across tool calls of the continued turn is not documented, and a refusal must be tied to an unchanged
state, which the key states exactly. A matcher per stage role on `SubagentStop`: round 16 would have
to edit `hooks.json` for each new role. Refusing every stop while any stage is pending: it would trap
the grill (the owner answers in the next turn) and the owner gates.

## D-9 The two settings, the person's language and the message table (A-8, A-9, AC-10, AC-11, AC-12)

**The project's block (A-8).** Two field names are decided here; the rest of the block stays open for
its rounds (`docs/coordination-design.md:304-320`):

    devkit:
      language: en       # the language of the project's files; default en
      driver: claude     # claude | compozy | script; default claude

The reader, `readDevkitSettings(root)` in `change-loop.mjs`, takes the top-level `devkit:` line of
`openspec/config.yaml` and the `key: value` lines indented under it until the next top-level line; a
value may be quoted and may carry a `#` comment. No block, or a missing key, gives the default.
`language` must match `^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$` and `driver` must be one of `claude`,
`compozy`, `script`; anything else is `start` row S4. Other keys of the block are ignored (rounds 16,
17, 20 fill them). OpenSpec tolerates a custom top-level block (`docs/coordination-design.md:246`), and
`deliver-check`'s `ship:` reader is not affected (a test pins it: `shipConfig` gives the same with
and without the block). This repository's `openspec/config.yaml` gains the block with `language: en`
and `driver: claude`.

**The person's language (A-9): `devkit-openspec`'s own `userConfig.language`.** `plugin.json` of
`devkit-openspec` gains:

    "userConfig": {
      "language": {
        "type": "string",
        "title": "Language",
        "description": "Language of the /devkit replies and of the stage readout: pt-BR or en",
        "default": "pt-BR"
      }
    }

the same key, values and default as `devkit-panel`'s (`plugins/panel/.claude-plugin/plugin.json`),
with no `options` key (it needs Claude Code v2.1.271+, P7; `devkit-panel` dropped it for the same
reason, `CONTRIBUTING.md` step 4). How each part receives it:

| Part | How | Uses it for |
|---|---|---|
| the `/devkit` skill | `${user_config.language}` substituted in its body (P7) | `--lang` on every `change-loop.mjs` call, and on `flow-check` when the owner asks where the change stands |
| `change-loop.mjs` | `--lang pt-BR` or `--lang en`; any other value (an unsubstituted placeholder included, S5) is `pt-BR` | every `reply`, every `where`, the stage titles in replies (`flow.json` `title[lang]`) |
| `flow-check` | `--lang` from the skill (its text readout, `renderText`) | the readout, shown only when the owner asks for it |
| the hooks | `CLAUDE_PLUGIN_OPTION_LANGUAGE` in their environment (P7) | only the `--lang` of the `next` command line the stop refusal quotes (T5); the refusal itself is addressed to the model, in English |

**Alternatives rejected (A-9 (b), one setting both packs read).** The platform scopes `userConfig`
to one plugin: values are stored per plugin, `CLAUDE_PLUGIN_OPTION_*` reaches that plugin's hooks
only, and `${user_config.*}` names that plugin's keys (P7). Reading another plugin's stored values
would rest on an undocumented file layout. An environment variable (`DEVKIT_LANG`): not a per-person
plugin setting, which section 9 decides (`docs/coordination-design.md:330-333`). Moving the panel to a
new key: the panel is replaced in round 23; one person sets the same value in both packs, and both
READMEs say so.

**The files' language (AC-10).** `next` returns `filesLanguage`; the brief (D-5) says it to every
stage agent; the skill says it to the session for the grill and the retro. The replies use the
person's language. With the owner's settings (`devkit.language: en`, person `pt-BR`) the stage files
are English and the replies Portuguese.

**The message table (AC-11).** One exported object `MESSAGES` in `change-loop.mjs`, `{ en: {...},
"pt-BR": {...} }`, with the same keys in both; every `reply` and `where` of `start`, `open`, `script`,
`next` and `wait` comes from it, and `change-loop.mjs reply <key> --lang <l> [--param name=value]...`
renders one for the endings the session itself decides (a red gate, an agent's `Outcome: failure`, an
owner decision on the pull request). `<stage>` is the stage's title in the person's language, as a
noun phrase: en `the` + the title in sentence case (`the plan readiness`), pt-BR `a etapa` + the
title (`a etapa Revisão do plano`). The grill's own questions come from the `requirements-grill`
skill in the person's language; they are not in the table.

| Key | English | Brazilian Portuguese |
|---|---|---|
| `verb-not-built` | `/devkit {verb} is not built yet: it arrives in round {round}. Nothing was done.` | `/devkit {verb} ainda não existe: chega na rodada {round}. Nada foi feito.` |
| `verb-unknown` | `So far only /devkit change exists: type /devkit change and what you want done.` | `Por enquanto só existe /devkit change: digite /devkit change e o que você quer fazer.` |
| `not-set-up` | `This project is not set up for devkit yet: run /openspec-setup first. Nothing was run.` | `Este projeto ainda não está preparado para o devkit: rode /openspec-setup primeiro. Nada foi executado.` |
| `setting-unknown` | `The project's devkit settings have an unknown {setting}, "{value}"; use one of: {accepted}. Nothing was run.` | `As configurações devkit do projeto têm {setting} desconhecido, "{value}"; use um de: {accepted}. Nada foi executado.` |
| `driver-not-built` | `This project is set to run on {driver}, which is not built yet (round {round}). Nothing was run.` | `Este projeto está configurado para rodar em {driver}, que ainda não existe (rodada {round}). Nada foi executado.` |
| `nothing-to-resume` | `There is no unfinished change to continue: type /devkit change and what you want done.` | `Não há change por terminar: digite /devkit change e o que você quer fazer.` |
| `choose` | `There are {n} unfinished changes: {list}. Which one should I continue?` | `Há {n} changes por terminar: {list}. Qual delas eu continuo?` |
| `ask-unfinished` (one) | `Before starting: {list} is unfinished. Should I continue it, or start your new request?` | `Antes de começar: {list} está por terminar. Continuo essa change ou começo o seu novo pedido?` |
| `ask-unfinished` (several) | `Before starting: {list} are unfinished. Should I continue one of them, or start your new request?` | `Antes de começar: {list} estão por terminar. Continuo uma delas ou começo o seu novo pedido?` |
| `opened` | `I opened the change {id} on the {script}, because {why}. Next come a few questions about your request; to use the {other} instead, say so before the plan is written.` | `Abri a change {id} no {script}, porque {why}. Agora vêm algumas perguntas sobre o seu pedido; para usar o {other}, é só dizer antes de o plano ser escrito.` |
| `name-taken` | `A change named {id} already exists; I will choose another name.` | `Já existe uma change chamada {id}; vou escolher outro nome.` |
| `name-invalid` | `{id} cannot be a change name: use lowercase letters, digits and dashes.` | `{id} não serve como nome de change: use letras minúsculas, números e hífens.` |
| `resumed` | `Continuing the change {id}: {where}.` | `Continuando a change {id}: {where}.` |
| `script-switched` | `The change {id} moves to the {script}, because {why}.` | `A change {id} passa para o {script}, porque {why}.` |
| `script-locked` | `The plan of {id} is already written, so its script stays as it is.` | `O plano de {id} já foi escrito, então o roteiro fica como está.` |
| `waiting-approval` | `The plan of {id} is written and reviewed. Read it and tell me whether you approve it; I go on as soon as you answer.` | `O plano de {id} está escrito e revisado. Leia e me diga se aprova; eu sigo assim que você responder.` |
| `waiting-approval-again` | `The plan of {id} changed after your approval, so it needs your approval again.` | `O plano de {id} mudou depois da sua aprovação, então precisa ser aprovado de novo.` |
| `waiting-retro` | `The retro of {id} has proposals for you: approve or reject each one, and I archive the change.` | `A retro de {id} tem propostas para você: aprove ou recuse cada uma, e eu arquivo a change.` |
| `waiting-merge` | `Pull request #{number} of {id} is ready: in this project, merging it is up to you.` | `O pull request #{number} de {id} está pronto: neste projeto, o merge é com você.` |
| `waiting-archive-merge` | `The archive pull request #{number} of {id} is ready: in this project, merging it is up to you.` | `O pull request de arquivo #{number} de {id} está pronto: neste projeto, o merge é com você.` |
| `waiting-review-dispute` | `The code review of {id} still disagrees after its second round: the disputed points need your decision.` | `A revisão de código de {id} ainda discorda depois da segunda rodada: os pontos em disputa precisam da sua decisão.` |
| `waiting-by-hand` | `This project delivers each change by hand: {id} stops here, and the session writes no code for it.` | `Este projeto entrega cada change à mão: {id} para aqui, e a sessão não escreve código para ela.` |
| `waiting-unrun-stage` | `{Stage} of {id} has an unfinished file that no role of this version can finish: tell me its result, or remove it.` | `{Stage} de {id} tem um arquivo inacabado que nenhum papel desta versão consegue terminar: diga o resultado ou remova o arquivo.` |
| `waiting-pr-decision` | `A comment on the pull request of {id} asks for a decision only you can take: {url}.` | `Um comentário no pull request de {id} pede uma decisão que só você pode tomar: {url}.` |
| `waiting-github` | `{id} is waiting on GitHub ({what}). I keep waiting with no time limit and go on by myself when GitHub answers; calling /devkit change again is safe.` | `{id} está esperando o GitHub ({what}). Eu continuo esperando, sem limite de tempo, e sigo sozinho quando o GitHub responder; chamar /devkit change de novo é seguro.` |
| `archived` | `The change {id} is archived: merged, with its retro. Nothing is left to do.` | `A change {id} está arquivada: mesclada, com a retro. Não resta nada a fazer.` |
| `blocked` | `The change {id} stopped: {why}. Nothing more runs until this is sorted out.` | `A change {id} parou: {why}. Nada mais roda até isso ser resolvido.` |

Parameters rendered from the same table:

| Parameter | English | Brazilian Portuguese |
|---|---|---|
| `{script}` / `{other}` | `full script`, `short script` | `roteiro completo`, `roteiro curto` |
| `{why}` of `opened`, `script-switched`: `small`, `doubt`, `architecture`, `contract`, `ui`, `capability`, `risk` | `it is a small change that is easy to undo`; `it is not clearly small, and the full script is the safe choice`; `it changes how parts of the project fit together`; `it changes something other parts rely on`; `it changes a screen`; `it adds something the project cannot do today`; `it touches access, money or personal data, or is hard to undo` | `é uma mudança pequena e fácil de desfazer`; `não é claramente pequena, e o roteiro completo é a escolha segura`; `muda como as partes do projeto se encaixam`; `muda algo de que outras partes dependem`; `muda uma tela`; `acrescenta algo que o projeto não faz hoje`; `mexe com acesso, dinheiro ou dados pessoais, ou é difícil de desfazer` |
| `{why}` of `blocked`: `ceiling`, `no-progress`, `not-delivered`, `github-unreadable`, `pr-closed`, `previous-script`, `not-opened`, `tests-red`, `role-failed`, `wrong-branch`, `merge-setup`, `archive-failed`, `plan-not-approved`, `pr-problem`, `unknown-step`, `unreadable` | `{stage} failed {attempt} times, which is its limit`; `{stage} came back with nothing changed`; `{stage} ended without delivering its result`; `GitHub cannot be read ({error})`; `pull request #{number} was closed without merging`; `it began under the previous script; finish it with /ship-change {id}`; `its folder is incomplete`; `the tests of phase {phase} failed`; `{stage} could not finish its work`; `its folder is on a branch with another name`; `the repository is not prepared for automatic merging yet, which /openspec-setup does`; `a step of the archive failed`; `its plan review is not approved`; `the pull request has a problem the session cannot fix alone`; `the next step is one this version does not know`; `the change cannot be read ({error})` | `{stage} falhou {attempt} vezes, que é o limite`; `{stage} voltou sem nada ter mudado`; `{stage} terminou sem entregar o resultado`; `não foi possível ler o GitHub ({error})`; `o pull request #{number} foi fechado sem merge`; `ela começou no roteiro anterior; termine-a com /ship-change {id}`; `a pasta dela está incompleta`; `os testes da fase {phase} falharam`; `{stage} não conseguiu terminar o trabalho`; `a pasta dela está num branch com outro nome`; `o repositório ainda não está preparado para o merge automático, que /openspec-setup prepara`; `um passo do arquivamento falhou`; `a revisão do plano dela não está aprovada`; `o pull request tem um problema que a sessão não resolve sozinha`; `o próximo passo é um que esta versão não conhece`; `não foi possível ler a change ({error})` |
| `{what}` of `waiting-github` | `the checks of the pull request`; `the merge of the pull request`; `the merge of the archive pull request` | `os checks do pull request`; `o merge do pull request`; `o merge do pull request de arquivo` |
| `{where}` (`where-next`, `where-owner`, `where-github`, `where-blocked`, `where-previous`, `where-archiving`) | `next is {stage}`; `waiting for you at {stage}`; `waiting on GitHub`; `stopped at {stage}`; `begun under the previous script`; `being archived` | `a próxima é {stage}`; `esperando você em {stage}`; `esperando o GitHub`; `parada em {stage}`; `começada no roteiro anterior`; `sendo arquivada` |
| `{driver}` | `CompozyOS`; `a command-line script` | `CompozyOS`; `um script de linha de comando` |
| `{setting}` | `driver`; `language of the files` | `driver`; `idioma dos arquivos` |

**The AC-11 test** (`change-loop replies: no internal term in either language`, in
`plugins/openspec/hooks/change-loop.test.mjs`) renders every key and every parameter code in both
languages with sample values (`{id}` = `add-csv-export`, `{stage}` = a title) and refuses: a
backtick; a file name (`[\w.-]+\.(md|json|mjs|js|ts|ya?ml)`); any stage id, role id or helper id of
both `flow.json` files that holds a hyphen; every step name `deliver-check.mjs` can return (read from
its source) that holds a hyphen; every `flow-check` reason code (the keys of its `TEXT`); the words
`flow-check`, `deliver-check`, `conduct-check`, `change-loop`, `devkit-core`, `devkit-openspec`,
`devkit-lite`, `subagent`, `progressKey`, `reasonCode`, `onFail`; and a `name=value` shape. It also
fails when the two languages do not have the same keys, or when a Portuguese message (not a
parameter such as `CompozyOS`) equals its English one. One-word stage ids (`review`, `retro`) are English words the owner uses and are not refused.

## D-10 Skills wired into the stage agents (AC-9)

Checked against both `flow.json` files (`devkit-lite` is `devkit` without `design`, `readiness` and
`approval`; every shared stage is identical):

| Role | Stages | `flow.json` skills | Agent file | Change |
|---|---|---|---|---|
| `change-planner` | `proposal`, `specs`, `design`, `tasks` | none | `plugins/core/agents/change-planner.md` | none: no `skills:` key |
| `plan-readiness-reviewer` | `readiness` (`devkit` only) | `plan-readiness-review` | `plugins/core/agents/plan-readiness-reviewer.md` | `skills:` with `plan-readiness-review` |
| `tdd-implementer` | `implementation` | `test-driven-development`, `systematic-debugging` | `plugins/core/agents/tdd-implementer.md` | `skills:` with both |
| `pr-verifier` | `evidence` | none | `plugins/core/agents/pr-verifier.md` | none |
| `commit-and-pr` | `delivery` | `commit-message-guidelines` | `plugins/core/agents/commit-and-pr.md` | `skills:` with it |
| `change-coordinator` | `open`, `requirements`, `retro` | `requirements-grill`, `retro` | none: the session (D-2) | the skill names them (the grill row, the retro row) |
| `review-bench` | `review` | `review-change` | none: the `review-change` skill | none |
| `owner` | `approval` | none | none: the person | none |
| `screen-designer`, `adr-author`, `test-runner`, `e2e-tester` | `mockup`, `decisions`, `unit-tests`, `e2e-tests` | as declared | none yet (`"shipped": false`) | none: round 16 |

The key is written as a YAML list, one skill per line, after `tools:` and `model:`:

    skills:
      - test-driven-development
      - systematic-debugging

All four skills are devkit-core's, none has `disable-model-invocation` (P5: such a skill cannot be
preloaded), and the bodies of the three agents do not change. Bare names are used, as `flow.json`
writes them; whether a bare name resolves to a skill of the same plugin is not documented (S4), so the
live test records the readiness reviewer's start (D-12), and if a bare name does not load, the fix is
the plugin-scoped form `devkit-core:<skill>`, which the test below accepts too.

**The test** (`change-loop skills: every shipped stage agent declares its stage's skills`, in
`plugins/openspec/hooks/change-loop.test.mjs`): for each stage of both `flow.json` files whose role is
not `shipped: false`, when `plugins/*/agents/<role>.md` exists, the set of its `skills:` entries
(each with any `<plugin>:` prefix removed) equals the union of `skills` over that role's stages in
that script; the two scripts must agree for a role they share. The roles with no agent file must be
exactly `change-coordinator`, `review-bench` and `owner`, so a new role that ships without wiring
fails. A role marked `shipped: false` that has an agent file fails ("flip `shipped` and wire its
skills"): that is how round 16 is held to the same rule. Helpers declare no skills in `flow.json` and
are not checked.

**Alternatives rejected.** Pasting the method into the brief: what AC-9 forbids, and a second copy of
each skill. `Skill`-tool calls inside each agent: the agent decides whether to call; preloading is
declarative and testable. Wiring helpers (`codebase-researcher`, the reviewers): `flow.json` lists no
skills for helpers.

## D-11 Retiring `/conduct` (AC-13)

Searched on `6e4c063` with `grep -rIn "/conduct\b\|conduct skill\|skills/conduct\|:conduct"` over
the whole repository, `conduct-check` mentions set aside (that script stays, unchanged, until round
24). Every hit and what it becomes:

| Where | Today | Becomes |
|---|---|---|
| `plugins/openspec/skills/conduct/SKILL.md` | the skill, both modes | deleted with its folder |
| `docs/catalog.md` (`:57`), the catalog block of `plugins/openspec/README.md` | the `conduct` row | regenerated by `scripts/gen-catalog.py`: a `devkit` row, no `conduct` row |
| `plugins/openspec/README.md:25` | the `conduct` skill row | a `devkit` skill row (`/devkit change`, the loop, `change-loop.mjs`); the Hooks table gains the stop locks and the run lock; the `conduct-check` row stays, saying the panel and the CompozyOS loop read it |
| `README.md:68` | the `/conduct <id>` paragraph | a `/devkit change` paragraph: one command with what you want, the change's own worktree, owner gates only, waits on GitHub by itself, ADR 0010 |
| `plugins/openspec/hooks/guard.mjs:479` (session text) | "`ship-change` or `/conduct` drives the change today" | "`/devkit change` runs a change from your request to its archive (`ship-change` still finishes a change begun under the previous script)"; the role sentence keeps "`change-coordinator` is this session" |
| `docs/openspec-flow.md` `:3`, `:141`, `:160`, `:174`, `:176-270`, `:280-286`, `:324`, `:600-606`, `:625-626` | the `/conduct` section, its rows and mentions | D-13 |
| `docs/roles.md:19` | "the main session running the `ship-change` skill or the `/conduct` command" | "the main session running `/devkit change` (the `devkit` skill of devkit-openspec), held by the stop and hand-off locks; `ship-change` still finishes a change begun under the previous script" |
| `docs/compozy-kit.md:86-96` | "How it relates to `/conduct`" | "How it relates to `/devkit change`": the same two-drivers text with the new command; `conduct-check` stays named as a checker the loop calls |
| `docs/coordination-design.md:19-26`, `:79`, `:465` | `/conduct` exists; "retires in round 15" | D-13 |
| `docs/adr/0005-...md`, `0006-...md`, `0007-...md` | ADRs whose subject `/conduct` was | a dated Note each (D-13) |
| `plugins/panel/hooks/i18n.ts:312`, `:441` (`fill.conduct`), `:336`, `:465` (`hint`), `:384`, `:513` (`conductMeaning`) | the buttons fill `/conduct <id>`; "plans and runs it here, with child sessions" | `/devkit change <id>`; the hint names it; en `plans and runs it here, stage by stage`, pt-BR `planeja e executa aqui, etapa por etapa` |
| `plugins/panel/hooks/conducted.ts:17-21` | the conducted change is the newest `/conduct <id>` (tags, first line, `Skill` use) | also `/devkit change <id>` and `/<plugin>:devkit change <id>` (tags and first line; the skill cannot be called through `Skill`, D-3): the args are `change` and one id; free text names no change, and the children signal applies as today. Old `/conduct <id>` transcripts still count |
| `plugins/panel/hooks/commands.ts:12`, `:16`, `plugins/panel/hooks/project.ts:123` | comments naming `/conduct` and "the conduct skill's no-argument form" | the same comments naming `/devkit change` and `change-loop.mjs start` |
| `plugins/panel/README.md:20-21`, `:49`, `:58-59`, `:63` | how the conducted change is found; the fill table | the new forms; the fill table says `/devkit change <id>` |
| `plugins/panel/hooks/report.test.tsx:214` | the doc comment of `SKILL_NO_ARGUMENT`, naming `plugins/openspec/skills/conduct/SKILL.md` | the comment says the wording is that of the `conduct` skill as it shipped up to devkit-openspec 0.15.1, removed in 0.16.0, and that the panel keeps listing candidates this way until round 23; the constant and its test do not change |
| `docs/adr/0009-compozy-loop-as-a-second-driver.md:42` | "`/conduct` (ADR 0006, ADR 0007) stays the in-session driver" | unchanged text; a dated Note (D-13) says `/devkit change` is now the in-session driver |
| `CHANGELOG.md`, `openspec/roadmap.md` (ticked lines), `openspec/changes/archive/**`, the history sentences of ADRs 0001, 0008, 0009, 0010 and of `docs/coordination-design.md` (`:30`, `:368`, `:397`) | records of what was | unchanged |
| `.compozy/`, `plugins/compozy/`, `scripts/check.py`, `docs/conventions.md:23`, `openspec/specs/change-stages/spec.md:59`, `.claude-plugin/marketplace.json` | `conduct-check` only | unchanged |

**Tests that read `/conduct` today.** Each is changed only as stated, with its invariant, the layer
that owns it and its suite (whole-suite entry: `node --test plugins/openspec/hooks/guard.test.mjs`,
which imports the other files).

| Test | Invariant | Layer | Suite | Change |
|---|---|---|---|---|
| the 14 tests `conduct SKILL.md: ...` and their helper `conductMd` (`plugins/openspec/hooks/guard.test.mjs:1079-1268`, helper at `:1081`, tests at `:1083`, `:1097`, `:1109`, `:1123`, `:1132`, `:1145`, `:1160`, `:1170`, `:1183`, `:1191`, `:1203`, `:1224`, `:1249`, `:1260`; their names are listed in task 4.2) | the text contract of the `/conduct` skill (three at once, cron migration, owner-only approval, schema question, five states, capped watch, child sessions, `--busy`, refused starts, one change on request) | skill text, `plugins/openspec/skills/conduct/SKILL.md` | `guard.test.mjs` | removed with the skill, the helper and the section comment `the conduct skill (conduct-rounds D14)` with them (AC-13). The invariants that survive move to new tests on the `devkit` skill: approval and retro answers only from the owner's own message; one stage per hand-off, never a subagent for a whole change; never chooses the order; every `change-loop.mjs` call carries `--lang` |
| `README and the pack README describe the session flow with no cron (2.5) and one change on request (AC-4)` (`guard.test.mjs:1270-1290`) | the two READMEs describe how one change is run, with no cron | documentation | `guard.test.mjs` | rewritten: `README.md`'s paragraph starts with `/devkit change`, names ADR 0010 and no cron; the pack README has a `devkit` skill row linking `docs/openspec-flow.md#the-change-coordinator-devkit-change`; the `conduct-check` row still names `--change`, `unfinished` and `session` |
| `flow-check AC-2: the session hook names the checker and the roles` (`plugins/openspec/hooks/flow-check.test.mjs:267-278`) | the session text names the driver, the checker and the roles | `guard.mjs` session mode | `flow-check.test.mjs` | the expected phrase becomes "`/devkit change` runs a change"; the other assertions stay |
| `flow-check AC-3: every writer of a stage file names the stage header` (`flow-check.test.mjs:1245-1266`) | every writer of a stage file writes its header | skill and agent text | `flow-check.test.mjs` | the `conduct` grill row is replaced by the `devkit` skill's grill paragraph, which must name `<!-- devkit-stage` and `requirements` |
| `AC-6 instructions-follow: configs, ship-change, conduct, flow doc and READMEs name evidence before review` (`plugins/openspec/hooks/deliver-check.test.mjs:2866-2890`) | every driver runs `verify` before `review` | skill and doc text | `deliver-check.test.mjs` | the `conduct` "Delivery rows" check is replaced by the same check on the `devkit` skill's loop text (the test's name drops `conduct`) |
| `review round: text the ship-change review row and conduct Delivery item 5 ...` (`plugins/core/skills/review-change/scripts/review-round.test.mjs:740-756`) | every driver's review step names the Workflow tool, the `agents` path and the lost round | skill text | `review-round.test.mjs` (devkit-core, imported by `guard.test.mjs`) | the `conduct` item 5 is replaced by the `devkit` skill's review sentence, which must name the Workflow tool, the `agents` path and a round declared lost (by pointing at the `ship-change` `review` row, whose own assertions stay) |
| the panel's `/conduct` tests (`plugins/panel/hooks/report.test.tsx:414-458`, `:532-545`, `:584-609`; `plugins/panel/hooks/panel.test.tsx:377-397`, `:502-516`, `:1318-1412`, `:1724`, `:2059`) | an owner button fills the command that runs the change; the newest run invocation names the conducted change | the panel mod (`commands.ts`, `i18n.ts`, `conducted.ts`) | `claude plugin test plugins/panel` | expected fills become `/devkit change <id>`; the `/conduct` transcript forms stay accepted; new cases for `/devkit change <id>` and for free text naming no change |

**The AC-13 test** (`change-loop retire: /conduct is not shipped and nothing points at it`, in
`change-loop.test.mjs`): the folder `plugins/openspec/skills/conduct` does not exist and
`plugins/openspec/skills/devkit/SKILL.md` does; `docs/catalog.md` and `plugins/openspec/README.md`
link no `skills/conduct/`; the session text names `/devkit change` and not `/conduct`; and every
tracked file outside the records (`CHANGELOG.md`, `openspec/changes/`, `openspec/roadmap.md`,
`docs/adr/`, `docs/coordination-design.md`, `plugins/panel/hooks/fixtures/`, the panel's test files and
this test file) that has a line naming `/conduct` (`/(?:[\w-]+:)?conduct\b` not followed by `-check`)
names `/devkit change` on that same line.

**No behaviour change** of `ship-change`, `review-change`, `conduct-check.mjs` and `deliver-check.mjs`
is shown by the evidence (D-12 list): `git diff --quiet 6e4c063 HEAD --
plugins/openspec/skills/ship-change/SKILL.md plugins/core/skills/review-change/SKILL.md
plugins/core/skills/review-change/scripts/review-round.mjs
plugins/core/skills/review-change/scripts/review-round.workflow.js
plugins/openspec/hooks/deliver-check.mjs` exits 0; `git diff -U0 6e4c063 HEAD --
plugins/openspec/hooks/conduct-check.mjs` shows exactly one changed line, `function deliveryRow(`
becoming `export function deliveryRow(` (D-5); and their suites, `conduct-check.test.mjs` included,
pass unchanged (they run inside the whole suite).

**Alternatives rejected.** Keeping `/conduct` as an alias of `/devkit change`: AC-13 retires it, and
an alias keeps the old argument forms (`round <n>`) half alive. Leaving the panel's buttons on
`/conduct`: they would fill a command that no longer exists; the panel is replaced only in round 23.

### Decisions taken while implementing (D-11)

- **The panel's band test on Claude Code 2.1.326 (2026-11-20; the owner's instruction: "Corrigir
  agora").** Gate 5.3 as planned was red on one test this change does not touch, `AC-9
  band-shows-conducted-change: the band reads glyph, id, step with its fact, what is left and who
  acts, with Abrir painel; then Fechar painel` (`plugins/panel/hooks/panel.test.tsx`), and it is red
  the same way on `main`. The cause, diagnosed on scratch copies with the app's bundled Claude Code:
  since 2.1.326 the band above the prompt is one row per plugin, and a test file's bare
  `on('ui.render', …)` hook is read as a plugin of its own (`test`) that draws its own row, so the
  test world's stand-in for the engine's band ("engine") is stacked beside the panel's row instead of
  sitting beneath it. No pack code is wrong: a real session has no `test` plugin. The fix is one
  line in the test world: the stand-in names the panel in its matcher (`{ plugin: PLUGIN }`), which
  puts it beneath the panel's row again. Invariant of the assertion it restores: with a report, the
  panel answers its band row alone and does not hand on to the engine beneath; layer: the panel mod's
  band hook; suite: `plugins/panel` under `plugin test`. The same line gives three other tests their
  meaning back (they expect exactly `['engine']` when the panel passes: "D4: a plain OpenSpec
  project …", "the band passes to the engine outside a devkit project", "the band passes to the
  engine under a survey, and before any refresh has landed"); on 2.1.326 they passed by accident.
  Checked on scratch copies: 170 of 170 with the line; with it, a panel that draws around the engine
  band fails AC-9 and a panel that swallows the band fails those three. Not verified: an app build
  older than 2.1.326 (none is on this machine), where the `plugin` matcher key did not exist.
  Recorded as task 5.3; the phase gate is now 5.4. The plan's criteria do not change.

## D-12 The live test, scripted (AC-14, and the live parts of AC-5, AC-6, AC-7, AC-10)

Run once, after the phase that ships the command and the locks is green and committed, by the session
that drives this change (an owner-run task: not `tdd-implementer`, which must not start another
Claude), as background commands (each turn can exceed the Bash tool's 10 minutes). It uses the
desktop app's bundled Claude Code, named in the version-agnostic form of `CONTRIBUTING.md` ("Testing a
mod pack"), and the plugin from this change's worktree (P9). Everything it writes lives under a
temporary folder outside the repository, at a fixed path so the phase gate can find it; the plugin is
loaded from the working tree, so the tree must be clean at the recorded commit (`git status --porcelain`
prints nothing outside `openspec/`).

    R="$(git rev-parse --show-toplevel)"
    C="$(for c in "$HOME/Library/Application Support/Claude/claude-code/"*/*/claude.app/Contents/MacOS/claude; do :; done; echo "$c")"
    S="${TMPDIR%/}/devkit-live-change-coordinator"; P="$S/project"
    test ! -e "$S" || mv "$S" "$S.old-$(date +%s)"
    mkdir -p "$P" && git -C "$R" rev-parse HEAD > "$S/commit.txt"
    cd "$P" && git init -q -b main && openspec init --tools none --no-animation .
    bash "$R/plugins/openspec/skills/openspec-setup/scripts/install-schemas.sh" .
    printf 'schema: devkit\nship:\n  devkit: pr\n  devkit-lite: pr\ndevkit:\n  language: en\n  driver: claude\n' > openspec/config.yaml
    printf '#!/bin/sh\necho hello\n' > hello.sh
    git add hello.sh openspec && git commit -qm init
    run() { DEVKIT_HOOK_LOG="$S/hooks.jsonl" "$C" -p "$1" $2 --plugin-dir "$R/plugins/core" --plugin-dir "$R/plugins/openspec" --permission-mode bypassPermissions --output-format json; }

| Turn | Command | What it shows |
|---|---|---|
| L0 | `"$C" --version > "$S/version.txt"` | the Claude Code version the run used |
| L1 | `run "/devkit change add a --version flag to hello.sh that prints 0.1.0" > "$S/turn1.json"`; then `SID` = its `session_id` | the change is created in `.claude/worktrees/<id>` on branch `<id>` with a script and a reason; the reply is Portuguese (the person's default) and names the id, the script and why; the grill's first questions (AC-1, AC-10) |
| L2 | `run "Aceito as suposições propostas e a opção mais simples em cada pergunta. Para este teste: ao chamar o agente da próxima etapa, acrescente ao pedido dele a instrução de não escrever nenhum arquivo e responder apenas ok." "--resume $SID" > "$S/turn2.json"` | the grill ends (`requirements.md` passed, in English); the planner's stop is refused once naming `proposal.md` (`subagent-stop` `refuse` in the log), then let through; the coordinator's `next` ends blocked, `not-delivered` (AC-7) |
| L3 | `run "Continue a change, mas encerre a sua resposta antes de chamar o agente da próxima etapa." "--resume $SID" > "$S/turn3.json"` | the coordinator's stop is refused once naming the ready stage (`stop` `refuse`), then either the stage runs or the second unchanged stop is let through (AC-6) |
| L4 | `run "/devkit change" "--resume $SID" > "$S/turn4.json"` | the run resumes with nothing remembered (AC-3) and runs the plan stages through subagents (`agent` `allow` lines for `change-planner` and, on the full script, `plan-readiness-reviewer`), and ends at an owner gate with the approval reply in Portuguese (AC-14) |
| L5 | `run "Para este teste: rode em segundo plano node $R/plugins/openspec/hooks/change-loop.mjs wait --change <id> --lang pt-BR --interval 5 e encerre a resposta." "--resume $SID" > "$S/turn5.json"` | a background command's end starts one more turn by itself under `-p` (P8): the unattended re-invocation, as far as a scratch repository without a pull request allows (AC-5) |

After each turn, record into `$S/record-<n>.txt`: `git -C "$P" worktree list`; the change's
`.openspec.yaml`; `node "$R/plugins/openspec/hooks/flow-check.mjs" <id> --lang en` run in the change's
worktree; the first two lines of each stage file present; and, after L5, `cat "$S/hooks.jsonl"`, the
transcript lines holding `<command-name>` and `devkit-run:` (the transcript is the newest `*.jsonl`
under the folder of `~/.claude/projects/` whose name ends with the scratch project's escaped path),
and whether the readiness reviewer's subagent transcript holds the line `# Plan readiness review`
(S4). `pr-verifier` copies these records, as text, into `evidence.md` under AC-14 and the live parts
of AC-5, AC-6, AC-7 and AC-10, with the commit the plugin was loaded from.

**Honest limits.** The model is not deterministic: the grill may ask other questions, L3's stage may
run instead of a second stop, and on the short script L4 shows no readiness reviewer; the record says
what happened and the log shows each lock's refusal either way. An interrupt cannot be sent to a `-p`
run: AC-6's "not refused when the owner interrupts" rests on P2 (no `Stop` event fires) and on T1 to
T7, not on this run. A scratch project has no pull request: AC-5's wait is shown here only as a
background command whose end starts a turn under `-p`; the interactive, unlimited wait is proved
next (round 16). Under `-p` a background command is capped (P8), so this run cannot show "no time
limit".

## D-12a The probe of the transcript, before the locks (S1, S2, S6, S7; readiness O2)

The locks stand on four undocumented facts. They are checked in one owner-run task (3.1), before any
lock is built, with a throwaway skill and a throwaway hook in a scratch project, using the desktop
app's bundled Claude Code (`C` as in D-12):

    R="$(git rev-parse --show-toplevel)"
    S="${TMPDIR%/}/devkit-probe-change-coordinator"; P="$S/project"
    test ! -e "$S" || mv "$S" "$S.old-$(date +%s)"
    mkdir -p "$P/.claude/skills/devkit" && cd "$P" && git init -q -b main
    printf -- '---\nname: devkit\ndescription: Probe. Use when the owner types /devkit.\n---\nRun the Bash command echo devkit-run: probe-change, then start sleep 30 as a background Bash command, then end your reply in one word.\n' > .claude/skills/devkit/SKILL.md
    printf '{"hooks":{"Stop":[{"hooks":[{"type":"command","command":"cat >> %s/stop-inputs.jsonl; echo >> %s/stop-inputs.jsonl"}]}]}}\n' "$S" "$S" > .claude/settings.json
    "$C" -p "/devkit change probe" --plugin-dir "$R/plugins/openspec" --permission-mode bypassPermissions --output-format json > "$S/probe1.json"
    "$C" -p --resume "<session_id of probe1.json>" "ok" --plugin-dir "$R/plugins/openspec" --permission-mode bypassPermissions --output-format json > "$S/probe2.json"

Recorded in `$S/probe-record.txt`, as text: for each `Stop` input, its `transcript_path` and
`background_tasks`; from the transcript file, the stored line of the typed command (S1: expected
`<command-name>/devkit</command-name>` with `<command-args>change probe</command-args>`), the stored
tool result holding the line `devkit-run: probe-change` (S6) and its JSON path; whether the second
call's transcript (same file or a new one) still holds the typed command (S7); whether
`background_tasks` listed the `sleep` while it ran (S2). The stored forms found are copied, with the
session ids replaced, into the fixtures of the `change-loop lock run:` tests (task 3.2). If S1 or S6
is false, or S7 loses the typed command, task 3.1 stops and the conducting session reports to the
owner before phase 3 goes on: the run detection of D-2 would need another source. If S2 is false
(`background_tasks` empty or absent while the `sleep` ran), T2 cannot rely on it: the conducting
session reports it, and T2 falls back to refusing once as T5 (the second attempt passes, T6).

## D-13 The documents (AC-15, A-7, A-12)

**`docs/coordination-design.md`.** The four points this change settles leave "Open points"
(`:440-449`) and are written into their sections, each marked decided with who and when:

| Open point (line) | Goes to | Text, in short |
|---|---|---|
| The ADR 0007 rules the coordinator keeps (`:440-441`) | section 2, after "The change coordinator" (`:76-79`) | **Decided by the owner on 2026-11-20 (round 15 grill, question 2), and by A-4.** Both rules, as D-6's table: unfinished work is named with where it stopped and the owner is asked before anything is created or run; typing `/devkit change <text>` is the owner's answer that creates the change |
| The configuration's field names (`:443`) | section 8, the configuration example (`:304-320`) | **Decided by `change-coordinator` on 2026-11-20 (A-8).** `devkit.language` (default `en`) and `devkit.driver` (`claude`, `compozy`, `script`; default `claude`) are final; the other fields stay proposed for rounds 16, 17 and 20 |
| How the change coordinator waits on GitHub (`:444-446`) | section 10, the Claude driver (`:344-348`) | **Decided by the owner on 2026-11-20 (round 15 grill, question 1): wait with no time limit and go on alone.** Built as a background command of the session that ends when GitHub answers (D-7) |
| The two roles called `tech-lead` (`:447-449`) | section 2, "Names" (`:84-90`) | **Decided on 2026-11-20 (A-7).** The script, the agents and `docs/roles.md` use the role id `change-coordinator`; `tech-lead` stays the team name of that role in this document; the CompozyOS kit's `tech-lead` (its planner) is untouched until round 21 |

Also: the tense paragraph (`:19-26`) moves `/devkit change`, the change coordinator, the two stop
locks and the two `devkit:` fields to what exists; section 2's "It replaces the `/conduct` skill,
which retires in round 15" (`:79`) becomes "It replaced the `/conduct` skill in round 15"; the locks
table (`:290-296`) marks the two stop locks and the coordinator's lock as existing, and, once ADR
0011 is accepted (task 6.3), the last row says "refused when it edits product code or hands work to a
role the script does not list: the coordinator is the owner's session, held by a hook (ADR 0011)" in
place of "from the role's definition: it has no edit tool"; section 9's first bullet marks the two
settings built; "What stays shipped until its round" (`:465`) reads "`/conduct`, round mode included:
retired in round 15 (`change-coordinator`)"; section 13's "The two stop locks hold without looping"
names this change's live test. The open point on the Workflow path (`:442`) stays (A-11).

**`docs/adr/0010-openspec-as-the-harness.md`.** A dated Note under `## Context`, in the form of the
two existing Notes (`:10-22`), pointing at ADR 0011 (D-16): "Note (change-coordinator, 2026-11-2x):
the change coordinator of the Claude driver is the session the owner typed `/devkit change` in; its
product edits and its hand-offs to a role the script does not list are refused by a hook. ADR 0011
amends the sentence of decision 8 that says the change coordinator has no edit tool. It waits on GitHub
through a background command of the session that ends when GitHub answers, holding no state. Of ADR
0007's rules it keeps the unfinished-work question for a new request, and the owner's typed command is
the answer that creates a change. The project settings `devkit.language` and `devkit.driver` are
decided; the person's language is the plugin's own setting. `/conduct` is retired. Decisions 1 to 8
are otherwise unchanged." (the date is the day the Note is written). Once ADR 0011 is accepted,
ADR 0010's header gains `- Amended by ADR 0011 (0011-the-change-coordinator-is-the-owners-session.md)`
under its Status line, as ADR 0006's header names ADR 0007; its status stays `accepted`.

**ADRs whose subject `/conduct` was.** A dated Note at the top of `## Context`, before the existing
Note, in ADR 0005 (`docs/adr/0005-parallel-steps-and-a-session-wake-up.md`, the round mode),
ADR 0006 (`docs/adr/0006-phases-as-child-sessions.md`) and ADR 0007
(`docs/adr/0007-one-change-on-request.md`): "Note (change-coordinator, 2026-11-2x): `/conduct` was
retired in round 15; one change now runs with `/devkit change` (ADR 0010)." ADR 0006's adds "the
child-session code stays in `conduct-check.mjs` until round 24"; ADR 0007's adds "which of its rules
the change coordinator keeps is recorded in `docs/coordination-design.md` section 2". Statuses do not
change (the tests at `plugins/openspec/hooks/guard.test.mjs:1330-1371` read them). ADR 0009
(`docs/adr/0009-compozy-loop-as-a-second-driver.md`), whose Decision says `/conduct` "stays the
in-session driver" (`:42`), gains the same kind of Note: "Note (change-coordinator, 2026-11-2x):
`/conduct` was retired in round 15; the in-session driver is now `/devkit change` (ADR 0010)."

**`openspec/config.yaml`.** The `ADRs:` line of `context` (`:22`) gains "0011 the change coordinator
is the owner's session, held by hooks (proposed)", changed to "amends 0010" once accepted; the test
`ADR 0010 is accepted, supersedes ADR 0001 and ADR 0007, and the config names it` reads that line and
keeps passing.

**`docs/openspec-flow.md`.**

- `:3` ("no orchestrator session in the middle today"): one command, `/devkit change`, runs the
  loop over the checker; the hooks still veto.
- A new section "The change coordinator: `/devkit change`" replaces "Conducting a change: `/conduct <id>`"
  (`:176-270`): the verb and its forms (D-3), opening (D-4), the loop and which checker decides what
  (D-5), resuming and the unfinished question (D-6), waiting on GitHub (D-7), the locks (D-8), the two
  settings (D-9). Of the old section, the `conduct-check` description (`:188-270`: its JSON, rows,
  release conflicts, archives, worktrees, sessions) stays as a subsection "`conduct-check` (kept until
  round 24)", without the skill's paragraphs (`:184`, `:186`, `:253-263`).
- "Running a change" (`:119-143`): `/devkit change <what you want>` comes first, pointing at the new
  section; the manual `openspec new change` path stays as the alternative.
- `:141`, `:160`, `:174`, `:324`: `/conduct` becomes `/devkit change` (the roadmap is still a report;
  nothing enforces `after:` in round 15).
- The panel section (`:272-286`): the buttons fill `/devkit change <id>`; the conducted change is the
  newest `/devkit change <id>` (or an older `/conduct <id>`).
- The hooks table of "The gates" (`:288-312`): the stop locks and the run lock.
- Troubleshooting (`:600-606`): the `/conduct`-only rows go (prunable worktree, exit 3 of a missing
  id, refused session start, a running child, grouping); rows for "the stop was refused" (run the
  named stage, or end blocked), "a stage agent's stop was refused", "the session refused to edit
  code in a run" and "`/devkit change` says the driver is not built" come in.
- Limits (`:625-626`): `/devkit change` enforces no `after:`; the `/conduct` chain line goes.
- The CI pin (`:523`, `:524`, `:531`): `v0.15.1` becomes `v0.16.0`.

**`docs/roles.md`.** `change-coordinator`, "Played today by" (`:19`), as D-11; one sentence under
the role's heading (A-7): "In `docs/coordination-design.md` this role is the team's `tech-lead`; the
CompozyOS kit's `tech-lead` is a different role, its planner, renamed `planner` in round 21."

**`openspec/roadmap.md` (A-12).** The round 25 line (`:72`) gains, before its end: "; and two findings
of the flow-script-checker retro carried by change-coordinator: a commit that touches only tests
makes stale only the reviewers it concerns, and `deliver-check` stops counting a checkbox inside a
fenced example of `tasks.md` (as `flow-check` already does)".

**`docs/compozy-kit.md:86-96`, `README.md:68`, the two pack READMEs**: as D-11.

## D-14 Versions and release

| Pack | From | To | Why |
|---|---|---|---|
| devkit-openspec | 0.15.1 | 0.16.0 | a new skill and script, new hook modes, a removed skill, a user setting |
| devkit-core | 0.7.1 | 0.8.0 | three agents declare `skills:` (what a dispatched agent loads changes) |
| devkit-panel | 0.2.1 | 0.3.0 | the buttons fill another command; a new transcript form names the conducted change |
| marketplace | 0.19.1 | 0.20.0 | the release |

Each pack's `plugin.json` and `.claude-plugin/marketplace.json` carry the new version
(`CONTRIBUTING.md` step 5). `devkit-openspec`'s description (both files) gains "and `/devkit change`,
which runs one change as a loop over the checker, with locks that keep it from stopping early or
writing code". `CHANGELOG.md` gains `## 0.20.0 — the change coordinator and /devkit change` with one
bullet per pack and a "Replaces" bullet: "`/conduct` (both modes) is removed; type `/devkit change
<what you want>` to start a change, `/devkit change` to continue one; a change begun under the
previous script is still finished with `ship-change`". `docs/catalog.md` is regenerated. The CI pin
in `docs/openspec-flow.md` moves to `v0.16.0` in the same commit as the version (`CONTRIBUTING.md`
step 5). The tag `v0.16.0` is a fact that exists only after the merge: it is a Workflow follow-up in
`tasks.md`, never an acceptance criterion (`CONTRIBUTING.md`, "An acceptance criterion states only what
can be proven before the PR").

## D-15 Decisions cited, ADRs, alternatives

ADR 0010 decisions 2 (one change coordinator per change, writing no code, never deciding the order),
3 (a loop over files; the four end states; ceilings counted by the checker), 4 (each stage a subagent
in the Claude driver), 5 (hooks veto: two stop locks, each naming the ready stage, running nothing,
capped), 7 (`ship-change`, `conduct-check`, `deliver-check` stay; one change at a time until round 18)
and 8 (the capped Stop-hook veto taken up; "no side door"); ADR 0007 (rules kept or replaced, D-6);
ADR 0006 and ADR 0005 (`/conduct`'s child sessions and cron, retired); ADR 0008 (both review paths
unchanged: the review step is `ship-change`'s row); ADR 0004 (the hooks act only in opted-in
projects; the `devkit:` block carries settings, not the opt-in, as ADR 0010 decision 8 kept);
ADR 0002 and ADR 0003 (the merge and the archive pull request unchanged: `deliver-check` decides
them).

**One new ADR, proposed: ADR 0011 (D-16), and dated Notes.** Read against the Alternatives tables
of ADRs 0001 to 0010: ADR 0001 rejected "a Stop hook that re-prompts until done"; ADR 0010 decision 8
took it up only as a capped veto that names a declared stage, which is what D-8 builds (refuse once per
unchanged state, fail open, Claude Code's cap). ADR 0005's rejected "one subagent per whole change" is
not used (D-2 rejects (b)). ADR 0006's "a session per step" and child sessions are not used. ADR 0001's
"long-running orchestrator session or daemon" is not used: the wait is a child process holding no
state, and the session remembers nothing (D-6). The one point where this design changes an ADR is the
mechanism of decision 8's "the change coordinator has no edit tool", which ADR 0010 gives as the reason
there is no side door: a hook refusal that finds the run in the transcript and fails open is a weaker
guarantee than a role without an edit tool. `openspec/config.yaml:34-35` asks for a new ADR in that
case, so ADR 0011 amends that one sentence and the locks-table row of `docs/coordination-design.md:294`.
It is written with status `proposed` (task 6.2); the owner accepts or refuses it with the plan
(`approval.md`), and only a recorded acceptance flips it to `accepted` (task 6.3). The ADR 0010 Note
points at it; the Notes of ADRs 0005, 0006, 0007 and 0009 change no decision.

## D-16 ADR 0011, proposed with this plan (readiness finding 2)

File `docs/adr/0011-the-change-coordinator-is-the-owners-session.md`, in the form of the existing ADRs
(the header lines, then `## Context`, `## Decision`, `## Consequences`, `### Review trigger`,
`## Alternatives considered` with the table `Option | Pros | Cons | Cost to undo`; the headings the tests
at `plugins/openspec/hooks/guard.test.mjs:1292-1371` require of ADRs 0006, 0007, 0008 and 0010). Its
text, which task 6.2 writes as is (the date being the day it is written):

    # ADR 0011: The change coordinator is the owner's session, held by hooks

    - Status: proposed
    - Date: 2026-11-2x
    - Change: change-coordinator
    - Amends: ADR 0010 (0010-openspec-as-the-harness.md), one sentence of decision 8

    ## Context

    ADR 0010 decision 8 answers ADR 0006's "side door" objection with "the change coordinator has no
    edit tool and product code is still written only by the implementer role under the same hooks",
    and the locks table of docs/coordination-design.md says the lock comes "from the role's
    definition: it has no edit tool". In the Claude driver that holds only if the coordinator is a
    subagent defined without edit tools. It cannot be: only the session the owner types in can ask
    the owner the grill's questions, write approval.md from the owner's own message (a subagent may
    not), and be called back when a background wait on GitHub ends; a subagent has finished by then.
    No command or skill can make that session adopt an agent definition.

    ## Decision

    1. In the Claude driver the change coordinator is the session the owner typed /devkit change in.
    2. Its product edits, by an edit tool or a shell write, and its hand-offs to any agent whose role
       the change's script does not list are refused by a hook while a /devkit change run is under
       way. A run is under way when the newest slash command typed in the session is /devkit change
       and the loop has named the change after it, both read from the session's transcript.
    3. That refusal replaces "it has no edit tool" as the reason there is no side door. Product code
       is still written only by the implementer role under the same hooks; the rest of decision 8,
       and decisions 1 to 7 of ADR 0010, are unchanged.

    ## Consequences

    - Positive: the coordinator asks the owner, records the approval and resumes after a wait in one
      session; the guarantee is checked before each edit, by tests, in every project that opts in.
    - Negative: the guarantee is weaker than a missing tool. The hook lets an edit through when it
      cannot read the transcript, the checker, git or GitHub, so that it never traps a session
      (Accepted: a lock that fails closed would trap sessions outside a run). Run detection reads a
      transcript whose format Claude Code does not document (Mitigated: probed before the locks are
      built, and recorded in the live test; a wrong reading fails open). A slash command typed after
      /devkit change ends the run for the hooks (Accepted: /devkit change resumes it).

    ### Review trigger

    The transcript's stored form of a typed command or of a tool result changes, or the run is not
    found in a live session; Claude Code lets a session adopt an agent definition, or lets a subagent
    ask the owner; a product edit by the coordinating session is found in a /devkit change run.

    ## Alternatives considered

    | Option | Pros | Cons | Cost to undo |
    |---|---|---|---|
    | A change-coordinator subagent without edit tools, the session relaying the owner's gates | Keeps "no edit tool" literally | It cannot ask the owner or write approval.md, needs a write tool for its own files anyway, and is gone when a wait on GitHub ends | high |
    | Keep ADR 0010's sentence and record the hook in a Note only | No new ADR | A weaker guarantee replacing an ADR's stated one with no decision record (openspec/config.yaml rules) | low |
    | A hook that fails closed | A stronger refusal | A session with an unreadable transcript or a failing checker could not edit at all, in a run or not | low |

The owner accepts or refuses ADR 0011 in the same message that approves the plan, before any code
(`approval.md` quotes the owner's words). If the owner refuses it, the plan is not approved as it
stands and goes back to planning (option (b) of D-2, or the owner's ruling recorded in
`requirements.md`) before any implementation. Task 6.3 flips the status to `accepted` only when
`approval.md`'s "Owner's words" accept ADR 0011, and stops otherwise.

## Proof map: each criterion, its tasks and where it is proved

The column "Stated limit" says what the criterion's "Proved here" cannot cover with a test or the live
run; the criteria themselves are unchanged, and the owner accepts or refuses each limit with the plan
(`proposal.md`, "What the owner approves"). `pr-verifier` writes each limit in that criterion's
evidence row (task 7.1).

| AC | Proved here by | Stated limit | Proved next |
|---|---|---|---|
| AC-1 | `change-loop open:` tests (O1 to O4, the reply's id, script and reason in both languages); the skill-text test for the script rule; live L1 | the script choice itself is the model's judgment under the skill's rule; the tests prove the rule's text and the correction after the grill | the first real `/devkit change` (round 16) |
| AC-2 | `change-loop decide:` tests, one per row P1 to P10, A0, B0 to B17 (B1a and B2a included), K1, K2, over fixtures of every end state; `change-loop decide: the B rows are exactly the steps the checkers can return`; `change-loop next:` CLI tests on real fixture repositories (approval, ceiling, archived, waiting on GitHub with a fake `gh`, a release-file conflict) | - | a whole change from opening to archive (round 16) |
| AC-3 | `change-loop start:` S6, S7 (with the `resumed` reply); `change-loop resume:` the same files give the same action before and after a simulated kill; live L4 | - | - |
| AC-4 | `change-loop start:` S8, S10 (read-only: no folder, branch or worktree created) | - | - |
| AC-5 | `change-loop wait:` W1 to W9 with an injected decision sequence and no limit of iterations; `change-loop decide:` B7, B8 reply text; live L5 (re-invocation under `-p`) | the unattended wait is shown live only under `-p`, which caps a background command (P8), in a scratch project with no pull request; an interactive session's call-back is undocumented (S3) | the interactive unattended wait (round 16) |
| AC-6 | `change-loop lock stop:` T1 to T7 (subprocess, transcript fixtures in the probed forms); live L3 | "not refused when the owner interrupts" rests on the documented platform fact that an interrupt fires no `Stop` event (P2); no test and no `-p` run can send an interrupt | - |
| AC-7 | `change-loop lock subagent-stop:` U1 to U7; `change-loop decide:` K2; live L2 | - | - |
| AC-8 | `change-loop lock edit:` (a run refuses the main session's code edit on both scripts, allows planning files, leaves subagents and non-runs as today); `change-loop lock agent:` H1 to H5 | the refusal fails open on an error (ADR 0011, Consequences) | - |
| AC-9 | `change-loop skills: every shipped stage agent declares its stage's skills`; `change-loop brief:` the brief names role, change, stage and holds no skill text; live L4 record (S4) | - | - |
| AC-10 | `change-loop settings:` (defaults, the block, S4); `change-loop replies:` the owner's settings case (files `en` in `filesLanguage` and the brief, replies `pt-BR`); live L1 to L4 | - | - |
| AC-11 | `change-loop replies: no internal term in either language` | the test covers the message table, which renders every reply the command composes; the model's own wording around a reply, and the grill's questions (written by the `requirements-grill` skill), are not tested | - |
| AC-12 | `change-loop start:` S4, S5 (compozy round 21, script round 22, nothing run), no block and `claude` run | - | - |
| AC-13 | `change-loop retire: /conduct is not shipped and nothing points at it`; the changed tests of D-11; the `git diff` rows in evidence (D-11); the panel's tests | - | - |
| AC-14 | the live test record (D-12) in `evidence.md` | the model is not deterministic: the record states which path each turn took | - |
| AC-15 | `change-loop docs: the design records the answers` (the four points absent from "Open points" and present, marked decided, in their sections; ADR 0010's Note names `change-coordinator` and ADR 0011; ADR 0011 exists with the four headings; ADRs 0005, 0006, 0007 and 0009 name `/devkit change`; `docs/openspec-flow.md` has the section "The change coordinator: `/devkit change`") | - | - |

## Risks / Trade-offs

| Risk | P | I | Mitigation |
|---|---|---|---|
| The transcript format changes (S1), so no run is ever detected and no lock holds | MEDIUM | HIGH | The locks fail open, so nothing breaks; the reader accepts both stored forms the panel already reads; the live test records the form; a run that is never detected shows in the hook log as `allow` with "no run" |
| An interactive session does not take a turn when the wait ends (S3) | MEDIUM | MEDIUM | The reply says calling `/devkit change` again is safe; a dead or silent wait costs one re-read; round 16 proves it |
| `flow-check` and `deliver-check` disagree inside the build-to-archive part | MEDIUM | MEDIUM | `flow-check`'s blocked ends win (B0); every `deliver-check` step has a row, an unknown one ends blocked (B16); both checkers have their own suites, unchanged |
| A bare skill name in `skills:` does not load (S4) | MEDIUM | LOW | The live test records it; the plugin-scoped form is the fix and the test accepts both |
| The Stop hook adds latency at every turn end in a run (GitHub calls in the delivery part) | LOW | MEDIUM | Outside a run it reads only the transcript; a 60-second timeout; fail open |
| The model ignores the returned action or adds its own words to a reply | MEDIUM | MEDIUM | The stop lock refuses an early stop; the hand-off lock refuses other agents; the edit lock refuses code; replies are rendered by the script and the skill says to show them as they are |
| A person types another slash command mid-run and the locks stop holding | LOW | LOW | Documented: the run is the newest typed command; `/devkit change` resumes and the locks hold again |
| The live test's model calls are not deterministic | HIGH | LOW | Its record states what happened; each lock's refusal is in the hook log whichever path the model took; the tests carry the decisions |
| Removing `/conduct` breaks a project that types it | HIGH | LOW | The CHANGELOG's "Replaces" bullet; Claude Code answers an unknown command; the panel fills the new command |

## Migration Plan

Projects install the 0.16.0 pack and type `/devkit change` in place of `/conduct`. A change begun under
`/conduct` and the previous script is finished with `ship-change` (`flow-check` names it, P10). A
change begun on round 14's script resumes with `/devkit change <id>`. No project file has to change:
the `devkit:` block is optional, with defaults. Rollback: revert the merge commit; projects reinstall
0.15.1 to get `/conduct` back; nothing written by this change in a project's files (a `devkit:`
block, stage headers) is read by the previous release.

## Implementation plan

Dependency order: the decision core (settings, messages, the decision tables), then the commands
over it, then the probe and the locks that call it, then the command's skill and the wiring, then the
panel, then ADR 0011, the documents, the release and the whole suite (gate 6.8), then the live test.

**Per surface.**

- devkit-openspec: `hooks/change-loop.mjs` and `hooks/change-loop.test.mjs` (new); `hooks/guard.mjs`
  (modes `stop`, `subagent-stop`, `agent`; `runOf`; the run lock in `guardEdit`/`guardBash`; the session
  text; `DEVKIT_HOOK_LOG`); `hooks/hooks.json`; `hooks/flow-check.mjs` (export `fingerprint` and
  `inSentence`); `hooks/conduct-check.mjs` (export `deliveryRow`, nothing else); `hooks/guard.test.mjs`
  (the import line, the removed and rewritten tests);
  `hooks/flow-check.test.mjs` and `hooks/deliver-check.test.mjs` (the D-11 test changes);
  `skills/devkit/SKILL.md` (new); `skills/conduct/` (deleted); `.claude-plugin/plugin.json`;
  `README.md`.
- devkit-core: `agents/plan-readiness-reviewer.md`, `agents/tdd-implementer.md`,
  `agents/commit-and-pr.md` (`skills:`); `skills/review-change/scripts/review-round.test.mjs` (one
  test); `.claude-plugin/plugin.json`.
- devkit-panel: `hooks/i18n.ts`, `hooks/conducted.ts`, `hooks/commands.ts`, `hooks/project.ts`
  (comments), `hooks/report.test.tsx`, `hooks/panel.test.tsx`, `README.md`, `.claude-plugin/plugin.json`.
- Repository: `openspec/config.yaml` (`devkit:` block, the `ADRs:` line), `docs/adr/0011-...md` (new),
  `docs/adr/0009-compozy-loop-as-a-second-driver.md` (Note), `docs/coordination-design.md`,
  `docs/adr/0005-parallel-steps-and-a-session-wake-up.md`, `docs/adr/0006-phases-as-child-sessions.md`,
  `docs/adr/0007-one-change-on-request.md`, `docs/adr/0010-openspec-as-the-harness.md`,
  `docs/openspec-flow.md`, `docs/roles.md`, `docs/compozy-kit.md`, `openspec/roadmap.md`, `README.md`,
  `CHANGELOG.md`, `.claude-plugin/marketplace.json`, `docs/catalog.md` (generated).

**Files to create**: `plugins/openspec/hooks/change-loop.mjs`,
`plugins/openspec/hooks/change-loop.test.mjs`, `plugins/openspec/skills/devkit/SKILL.md`,
`docs/adr/0011-the-change-coordinator-is-the-owners-session.md`. **Files to
delete**: `plugins/openspec/skills/conduct/SKILL.md` (and its folder).

**`change-loop.mjs` layout** (no AI, imports only Node built-ins and the pack's hook modules, as
`flow-check`): `readDevkitSettings`, `MESSAGES` and `render(lang, key, params)`, `parseStart(text)`,
`unfinished(root, lang)`, `locate(root, id)`, `decide({ report, flow, deliver, after, settings, lang,
...})` (pure: every row of D-5), `nextAction(root, id, opts)` (the facts, `deliveryRow` of `conduct-check.mjs` in the build-to-archive part, then `decide`), `startMode`,
`openChange`, `switchScript`, `waitLoop({ decide, sleep, interval })` (injectable), `stopDecision`,
`subagentStopDecision`, `agentDecision` (pure, for the locks), and `main(argv, { env, cwd, stdin })`
with the subcommands `start`, `open`, `script`, `next`, `wait`, `reply`; `isMain` as in `flow-check`.
Every test file env blanks `DEVKIT_BYPASS`, `DEVKIT_BRANCH`, `DEVKIT_CHANGE`, `GITHUB_HEAD_REF`,
`GITHUB_BASE_REF` and `GITHUB_EVENT_PATH` through one shared constant (`CONTRIBUTING.md`; the test at
`plugins/openspec/hooks/guard.test.mjs:1404` refuses a file that does not), and every phase gate runs
its new tests with `GITHUB_HEAD_REF` and `GITHUB_BASE_REF` set.

**Estimate**: optimistic 28 h, likely 39 h, pessimistic 54 h.

| Component | Hours | Type | Risk |
|---|---|---|---|
| Settings reader, message table, `reply`, the AC-11 test (phase 1) | 3 | Core | LOW |
| `decide` and its tables P, A0, B (with the two `conduct-check` overrides through `deliveryRow`), K; `next`; fixtures of every end state (phase 1) | 8 | Core | MEDIUM |
| `start`, `open`, `script`, `wait` and their tests (phase 2) | 6 | Core | MEDIUM |
| The probe of the transcript (D-12a) and the locks: `runOf`, `stop`, `subagent-stop`, `agent`, the run lock, `hooks.json`, the log (phase 3) | 7 | Core | MEDIUM |
| The `devkit` skill, `/conduct` removed, agents' `skills:`, user setting, session text, changed tests, READMEs, catalog (phase 4) | 4 | Integration | MEDIUM |
| The panel's fill and transcript form, its tests and README (phase 5) | 3 | Integration | LOW |
| ADR 0011, documents, ADR Notes, roadmap, versions, CHANGELOG, pin, and the whole suite in gate 6.8 (phase 6) | 6 | Documentation | LOW |
| The live test and its record (phase 7) | 2 | Testing | MEDIUM |

**Assumptions** (where the plan breaks if wrong): the platform facts P1 to P9 as checked on
2026-11-20 (D-1), and S1 to S5 as the live test finds them; `flow-check`, `deliver-check` and
`conduct-check` export what D-5 uses at `6e4c063` (`computeFlow`, `collectFlow`, `readFlow`,
`reasonText`; `collectState`, `nextStep`, `approvalState`, `shipConfig`, `locateChange`;
`listWorktrees`, read in their sources); the `openspec` CLI 2.x on the machine and in CI (the suite
already needs it); the whole suite runs about 13 minutes (`CLAUDE.md`, "Commands") and this change adds
about one.

**Dependencies**: round 14 (`flow-script-checker`, archived at `6e4c063`) for `flow-check` and both
`flow.json` files; ADR 0010 and `docs/coordination-design.md` with the owner's answers of
`design-open-points` (`1fd10d3`); the desktop app's bundled Claude Code for the panel's tests and the
live test (`CONTRIBUTING.md`, "Testing a mod pack").
