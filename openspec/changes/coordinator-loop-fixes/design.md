<!-- devkit-stage design result=passed attempt=5 commit=6e683aa3e98ecc40a3cdece58e1394082910e54e -->
# Design

Change: `coordinator-loop-fixes` · Date: 2026-11-23 · Owner: Kaue (chacal88) · PRD / tech spec: n/a ·
Decisions: the change's ADR, `docs/adr/<next free number at merge>-the-loop-declares-the-decisions-outside-the-stage-gates.md`
(accepted at the first plan approval), and the change's settings ADR,
`docs/adr/<next free number at merge>-a-changes-own-settings-live-in-an-x-devkit-block.md` (D-22; proposed, accepted at the
owner's next approval, D-7); `decisions.md` points to both.

## How this plan names things

`origin/main` moves while this change is in flight (sibling changes merge about ten times a day), so the
plan holds no fact that a merge can change:

- A function, an export, a constant, a table, a test or a file is cited by its name, never by its line.
  The implementer finds it with `grep -n "<name>"`, and re-reads it before editing it (D-17).
- No plugin or marketplace version is written as a literal, and no sentence says what a version is
  "today": the release is "the next free version at merge", by the rule of D-18.
- The change has two ADRs, the ones `decisions.md` lists. "The change's ADR" is the file
  `docs/adr/<next free number at merge>-the-loop-declares-the-decisions-outside-the-stage-gates.md` (D-1 to D-7);
  "the change's settings ADR" is the file `docs/adr/<next free number at merge>-a-changes-own-settings-live-in-an-x-devkit-block.md`
  (D-22, amending ADR 0023 decision 1); "the change's ADRs" are both. Each number was the next free one when its
  record was drafted; a sibling that merges first takes it, and the loop's `renumber-adr` step then renames the file
  and every reference with it. This plan says these names and their decision numbers, never a number, except in
  `decisions.md`, where the loop's `accept-decisions` needs the real paths.
- Other ADRs are cited by their number: they are merged and do not move.

## Context

See `proposal.md` for the why. The facts the approach rests on, as the files read at the last revision of
this plan (the base is `origin/main` c09860c, merged at fd29ac6: it holds the CompozyOS driver and its kit,
the stage models, the delivery train switched on in this repository, ADR 0025's own-files staleness,
ADR 0026's suite by file, and, since the previous base c663f21, trains 6 to 9: `post-merge-validate` and
`loop-place-and-evidence` (d917ae0), `project-slice-claim`, `state-skips-unlocated` and
`jira-entry-followups` (086a53c), and `stage-ceiling-consecutive` (c09860c); `requirements.md`, "Checked
against main again (2026-11-24, `origin/main` c09860c)", says what each changed for this plan):

- The test suite (ADR 0026, `CONTRIBUTING.md`): `node scripts/test-suite.mjs [--concurrency=<n>]
  [--test-name-pattern=<re>]... [<file>...]` runs each `*.test.mjs` of the four suite folders in a process of
  its own, `<n>` at once, each with its own empty `TMPDIR`; the patterns apply to every file it runs. The whole
  suite runs only on the delivery train (`devkit.delivery.train`, below); a phase gate of this plan runs the
  files its phase touches with `--concurrency=2` (D-17). No test file imports another
  (shared helpers live in `test-fixtures.mjs` and the `<name>-fixtures.mjs` modules), `guard.test.mjs`
  holds only the guard's own tests, and a file is kept under about 300 s. The old files were split:
  `change-loop.test.mjs` now has `change-loop-compozy`, `change-loop-remote` and `change-loop-remote-state`
  parts (the `devkit` skill's text tests are in `change-loop-compozy.test.mjs`), `deliver-check.test.mjs`
  has `deliver-check-archive` and `deliver-check-cli` parts, `roadmap-loop.test.mjs` has
  `roadmap-loop-followups` and `roadmap-loop-upfront` parts. The largest files already run near or above
  300 s (`change-loop.test.mjs`, `change-loop-compozy.test.mjs`, `project-loop.test.mjs`,
  `roadmap-loop*.test.mjs`, `delivery-models.test.mjs`), so this change's loop-level tests go to a new file
  of their own (D-16).
- The stage models (ADR 0023): a stage agent's `Outcome: failure` goes back to `next`, which hands it once
  more on the next model up and then ends the run blocked `role-failed` with its own `devkit-end:` line;
  the `devkit` skill's `agent`, `resolve-release-conflict` and `renumber-adr` items say so, and no Loop item
  declares `why=role-failed` itself (the F1 test pins that).
- The delivery train (ADR 0022; `devkit.delivery.train` in `openspec/config.yaml` is
  `node scripts/test-suite.mjs && python3 scripts/check.py`): a reviewed change boards the train, which
  joins the boarded heads, renumbers their releases above its own, runs that command once and merges one
  pull request. A gate part equal to a part of that command needs no `pass` row in `evidence.md`
  (`pr-verifier` writes a `train:` row for it). In a train project a change or an archive in conflict with
  its base boards anyway (the T5 row and "A ready archive boards like a change"), so the delivery checker
  gives no conflicted item 5 or `archive-pr` row there.

- `plugins/openspec/hooks/change-loop.mjs`: `runReply` prints `devkit-end: <id> <state>` only for the
  two keys of `END_OF_KEY` (`blocked`, `waiting-pr-decision`), and takes `--stdin <name>` for a parameter
  read from standard input (`jira-entry-followups`); `roadmap-loop.mjs` keeps a second copy
  of that table in `replyCmd`, with the gate `decision` written in. `decide()` builds every action;
  its `buildPart` reads `const step = row.next.step;`, then gives the place step `take-place` before a
  first implementation step (`loop-place-and-evidence`), then, after a merge of the base and before each
  step of `CHECK_BEFORE` (the evidence, the review, the pushes and the GitHub waits; not `gate`), the
  session step `merge-check` (which runs `openspec validate <id> --type change --strict` and records the
  result in the git common directory) and, on a red record, the hand-off `merge-defect` to
  `devkit-core:change-planner`, which edits the plan files (`post-merge-validate` D-4). `fix-tests` and
  `merge-defect` are agent steps no row of `ROWS` holds;
  `ROWS` maps each delivery step to a stage and a role; `AGENT` is a literal map of nine roles, while
  `PACKS` (declared further down the file) is the pack table a test ties to `docs/roles.md`. The
  CompozyOS driver reads the same `nextAction` through `buildView` and `compozyView`, and writes
  `approval.md` itself: `approvalText` and `recordApproval` (the `record-approval` step), in "the form of
  the `stop-plan-approval` row of `ship-change`". `SKILL_LOOP_STEPS` names the hand-off steps whose
  dispatch sentence the view takes from a `devkit` skill Loop bullet; every other hand-off step takes it
  from its `ship-change` row (`SHIP_ROW_STEPS`).
- `plugins/openspec/hooks/guard.mjs`: `runMarkers` reads `devkit-end: <id> <state>` but drops the id,
  so `runOf` sets `ended` for any change's end; `writeViolation` lets `pr-verifier` write
  `evidence.md` only ("only writes its own verdict file").
- `plugins/openspec/hooks/deliver-check.mjs`: `nextStep` stops at `stop-review-deadlock` when
  `review.md` is at `FAIL` and `round >= 2`, gives `review` round 2 only after round 1, and asks the
  plan approval only while `!state.started`; `parseTasks` knows the `Gate:` marker only. Before
  `fix-review` it gives `commit` when a file of the change folder other than the review record is
  uncommitted (`collectState`'s `planDirty`, `jira-entry-followups` D-2), and before a review round it
  gives `commit` when any file of the change folder is (`folderDirty`, `loop-place-and-evidence` D-2).
- The settings of a change: `parseDevkitBlock` (`guard.mjs`) reads the `devkit:` block of a text;
  `budgetOf` and `modelsOf` (`change-loop.mjs`) and `capOf` (`flow-check.mjs`) read it from the change's
  own `.openspec.yaml` and from `openspec/config.yaml`, the change's value winning, as
  `docs/openspec-flow.md` documents ("The token budget.", "The model of each stage."). The `openspec`
  CLI 2.0.0 refuses that block in a change's file (D-22).
- `plugins/openspec/hooks/flow-check.mjs`: `artifactState` skips the `stale-plan` check once a task is
  ticked, because the stale check is by file time and a tick changes `tasks.md`. `computeFlow` ends the
  walk `blocked` `ceiling-reached` when a failed stage's failures in a row reach its ceiling
  (`stage-ceiling-consecutive`: `failuresInARow` counts the distinct failed headers since the stage file
  last passed, from git, and at least the header's attempt when no pass is seen; the comparison is
  `raw.failures >= ceilingOf(s)` with a local `ceilingOf`; the `header-failed` reason of `artifactState`
  computes the same ceiling inline, and `header-failed`, `fix-after-failure` and `ceiling-reached` carry
  `failures` beside `attempt` and `ceiling`). The code review stage
  `review` (role `review-bench`) declares `"ceiling": 2` in both scripts (the `review` stage of
  `plugins/openspec/schemas/devkit/flow.json` and of `devkit-lite/flow.json`), and the `review` row of
  `ship-change/SKILL.md` sets its header to `attempt=<the round>`, so a round-2 FAIL ends the walk
  blocked before the delivery checker is read (`inDelivery` is false for a blocked end): the loop's code-review
  deadlock is that blocked end (`why=ceiling`, stage `review`), which the coordinator-field-fixes retro
  met ("`next` answers `blocked` until someone sets the header of `review.md` by hand").
- `plugins/openspec/hooks/conduct-check.mjs`: `releaseConflict` turns a conflict outside the release
  files into a blocked row; `trainRejoin` keeps its own blocked `stop-archive` for an archive that left
  a delivery train and conflicts outside the release files and the roadmap ticks; `deliveryRow` returns
  `disable-auto-merge` and the change's own `rejoin-train` step before any override, then tries
  `adrClash` (the `renumber-adr` override), `releaseConflict` and `trainRejoin`, in that order;
  `SUBAGENT` and `MAIN` give each step its actor.
- `plugins/compozy/skills/compozy-setup/`: the CompozyOS kit.
  `plugins/compozy/skills/compozy-setup/scripts/gen-agents.mjs` writes
  `templates/agents/<role>/AGENT.md` for every role of `PACKS` from the Claude agent file
  `plugins/<pack>/agents/<role>.md` (the body unchanged), and CI runs it with `--check`;
  `plugins/compozy/skills/compozy-setup/scripts/install-kit.mjs <project-root>` copies the templates into
  the project's `.compozy/` and records their digests and the pack's version in `.compozy/kit-manifest.json`;
  this repository's own `.compozy/` is that install, and
  `plugins/compozy/skills/compozy-setup/scripts/adoption.test.mjs` compares it byte for byte with the
  templates. Two files this change edits are sources of the kit: `plugins/core/agents/tdd-implementer.md`
  and `plugins/core/agents/pr-verifier.md` (D-6, D-8, D-19).
- `plugins/core/skills/review-change/scripts/review-round.workflow.js`: `validateArgs` accepts round 1
  or 2 only and the texts say "of 2" and "/2".
- `plugins/openspec/skills/devkit/SKILL.md`: a red `gate` ends the run with
  `reply blocked --param why=tests-red`; the `Waiting on GitHub` section always starts the background
  `wait`.

Constraints: the hooks only veto and never drive (ADR 0010 decision 5); four end states and no fifth
(ADR 0010 decision 3); a change's state is derived in one place, `changeState` (ADR 0017); every
stage role writes its own files (ADR 0016); product code only through `tdd-implementer` (ADR 0011
decision 2); tests never read git history (`openspec/config.yaml`, Test history); a change's
`.openspec.yaml` passes `openspec validate <id> --type change --strict`, which knows its own keys and
any key that starts with `x-` (D-22).

## Goals / Non-Goals

**Goals:** the kept items of `requirements.md` (1, 2, 4 to 6, 8 to 18, 21 to 24, and the field findings 25 to 28; item 3 is dropped there as covered by main), one mechanism for every
decision outside the gates, and every existing behaviour unchanged where no new record or marker is
present (AC-16).

**Non-Goals:**
- Everything under "Dropped" in `requirements.md`, and the `fresh-base-check` half of item 21 (the
  loop does not fetch here; `resolve-base-conflict` judges against `origin/<base>` as it is).
- The two-round rule of a slice's ADR review in `/devkit project` (`openspec/specs/project-definition/spec.md`,
  `project-loop.mjs`): a different round, not the code review.
- The side panel (`plugins/panel/`): it has no row for `renumber-adr` either; the new steps fall into
  its default group.
- A third review round in the roadmap's coordinating session in session-per-change mode: that
  session asks only the grill, the plan approval and the retro answers (`skills/devkit/SKILL.md`,
  `### A session per change`); the deadlock is answered in the change's own session.
- Any change to `devkit-lite`'s stages or gates (AC-15).
- The CompozyOS driver's loops (`devkit-change`, `devkit-review`, `devkit-roadmap` under
  `plugins/compozy/skills/compozy-setup/templates/loops/`) and the `.compozy/loops/` copies: no
  template of a loop changes. The driver therefore keeps its red-gate question to the owner (its
  `phase_gate` node asks when the gate is red; `declare` is the main session's command and a CompozyOS
  session has no main session to run it) and its review loop's two rounds (`devkit-review` builds the
  round script's `args` from `next.round` and passes no `limit`, and the owner's authorization is
  recorded by `declare` only). D-19 states what the driver does take from this change.
- An archive that left a delivery train and conflicts with the base outside the release files and the
  roadmap ticks keeps the blocked `stop-archive` that `trainRejoin` gives it (the delivery-train
  design D-2; ADR 0022, decision 8): the conflict is a person's to resolve on the archive's branch.
  AC-13 is read this way (D-5).

## D-1 The declared steps: one table, one helper (AC-1; the change's ADR decision 1)

One table and one helper in `plugins/openspec/hooks/change-loop.mjs` carry every step or end the
session declares outside the stage gates. They replace `END_OF_KEY` in `change-loop.mjs` and in
`roadmap-loop.mjs`.

```js
// change-loop.mjs, next to loopOutput (replaces END_OF_KEY)
export const DECLARED = {
  blocked:                  { via: 'reply',   end: 'blocked' },
  'waiting-pr-decision':    { via: 'reply',   end: 'waiting-for-owner', gate: 'decision' },
  'waiting-pause':          { via: 'reply',   end: 'waiting-for-owner', gate: 'pause' },
  'waiting-owner-decision': { via: 'reply',   end: 'waiting-for-owner', gate: 'decision' },
  'gate-red':               { via: 'declare', at: 'gate' },
  'review-round':           { via: 'declare', at: 'review-deadlock' }, // deadlockScope(action) !== null, D-4
};
export function declaredStep(cwd, key, { params, lang, env, openspec, gh }) // { code, stdout, stderr }
```

- `declaredStep` is the only function that prints a declared marker. For a `reply` row it renders the
  key and prints `devkit-end: <params.id> <end>` first, as `runReply` does today. For a `declare` row
  it checks the loop's current action (`nextAction`, called as `runNext` calls it for `next`:
  `budget: true`, `strictModels: true`, and `retry: false`, since a declared step retries no agent)
  against `at` (`gate`: the session step `gate` of
  the phase named, D-3; `review-deadlock`: `deadlockScope(action)` is not null, D-4), records the step (D-1 record),
  and prints `loopOutput(id, action)` of the action that follows (D-3, D-4).
- `runReply(args)` keeps its arguments; a key whose row is `declare` is refused (exit 3, `error`
  names `declare`); a key outside `DECLARED` is rendered as today, with no marker.
- New command `declare <id> <gate-red|review-round> --lang <l> [--param name=value]...` (`runDeclare`,
  added to `USAGE` and to `main`'s verbs); a key whose row is `reply` or that the table lacks is a
  usage error. Refusals use `LoopRefusal` so `failure()` prints `{ version: 1, error, reply }` with a
  plain reply and exit 3.
- `roadmap-loop.mjs` `replyCmd` imports `DECLARED` and records `run.declared[id]` from the row:
  `{ state: row.end, why, params }` for `blocked`, `{ state: row.end, why: key, params: { ...rest,
  gate: row.gate } }` for the others (the `gate: 'decision'` written in today becomes the row's gate).
  Keys of `via: 'declare'` are refused there (exit 3): a roadmap run declares them through
  `change-loop.mjs declare` (D-3).
- `GATE_OF_WHY` gains `'waiting-pause': 'pause'` and `'waiting-owner-decision': 'decision'`;
  `changeState`'s `declaredEnd` needs nothing else (it reads `params.gate ?? GATE_OF_WHY[why]`).

**The record.** `openspec/changes/<id>/declared.json`, written only by `declare` (it is not the
roadmap run file's `declared[id]`, which `roadmap-loop.mjs reply` writes for the ends a roadmap run's
session declares: two records of different things that share a word):
`{ "version": 1, "steps": [ { "key": "gate-red", "phase": 2, "at": "<ISO time>" }, { "key":
"review-round", "scope": "review", "round": 3, "words": "<the owner's words, up to 200 characters>", "at":
"<ISO time>" } ] }` (`scope` is `review` or `resolution`, D-4; an entry with no `scope` reads as `review`).
The reader lives in `plugins/openspec/hooks/deliver-check.mjs` (both the loop and the delivery
checker read it; `change-loop.mjs` already imports from there): `readDeclared(dir)` returns
`{ steps, error }`. Parser decisions: a missing file is `{ steps: [], error: null }`; an empty file,
unparsable JSON, a value that is not an object, a `version` other than 1 or a `steps` that is not an
array is `{ steps: [], error: '<what>' }`; an entry that is not an object, or whose `key` is not in
`RECORDED_KEYS`, is skipped (a later version may add keys). `RECORDED_KEYS` is exported by
`deliver-check.mjs` as `['gate-red', 'review-round']`, because `deliver-check.mjs` cannot import
`DECLARED` (`change-loop.mjs` imports `deliver-check.mjs`, so that import would be a cycle); T114 ties it to the
`declare` rows of `DECLARED`. `deliver-check.mjs` also exports `REVIEW_ROUNDS = 2`, the round limit
before any authorization (D-4). The writer `recordDeclared(dir, entry)` in
`change-loop.mjs` refuses on a reader error (`declare-unreadable`, nothing written), appends the
entry, and writes through a temporary file in the same folder and a rename.

**The record and the commit rows.** `declare` writes `declared.json` and commits nothing (the loop never
commits), so the record is an uncommitted file of the change folder until the next commit. Two rows of
`nextStep` read such files (Context): `folderDirty` gives `commit` before a review round, which is where the
record is committed (with `evidence.md`, which the verifier leaves uncommitted there anyway, so no hand-off is
added); `planDirty` gives `commit` before `fix-review` for "a fix written in the change folder and not
committed", which the record is not. `collectState`'s `planDirty` therefore leaves out
`openspec/changes/<id>/declared.json` as it leaves out the review record; without that, the action after
`declare review-round` would be a `commit` of the record, not `fix-review`. `folderDirty` is unchanged (T141).

**Who writes it.** Two rules in `guard.mjs`, mirroring how `approval.md` is kept the main session's:

- The file. `classify` gives `declared.json` the kind `{ kind: 'gate', owner: '' }` in any change's
  folder (`parts[1] === 'changes' && parts.length === 4 && parts[3] === 'declared.json'`, next to the
  `approval.md` line), whatever the active change is, as `approval.md` is judged. So an edit tool or a
  shell redirect of a subagent into any change's `declared.json` is refused, and the `ch.ambiguous`
  branches of `guardEdit` and `guardBash` judge it too. `writeViolation`'s message for an owner-`''`
  gate starts with the relative path it judges: for `approval.md`, `<relative path> is written only by
  the main session, from the owner's own message; not by <who>` (the three tests that match
  `approval\.md is written only by the main session, from the owner's own message; not by` still
  match, D-15); for `declared.json`, `<relative path> is written only by the main session, through
  change-loop.mjs declare; not by <who>`.
- The command. `guard.mjs` cannot see what a script writes, but it sees the command a subagent runs:
  this is the same layer as the `gh pr create` rule of `guardBash`. `export function
  declareViolation(cmd, actor)` returns null when `actor` is `''` (the main session); otherwise, when
  `withoutHeredocs(cmd)` matches `/\bnode\s+(?:"[^"\n]*change-loop\.mjs"|'[^'\n]*change-loop\.mjs'|[^\s;&|]*change-loop\.mjs)\s+declare\b/`,
  it returns "change-loop.mjs declare is run only by the main session (a review round from the owner's
  own typed message, a red gate from its own gate run); not by <actor>". `guardBash` calls it right
  after the git rules, under the same `sessionRoot && optedIn(sessionRoot)` condition, and blocks with
  it. `withoutHeredocs(cmd)` is the heredoc half of today's `sanitize`, split out and exported;
  `sanitize(cmd)` becomes `withoutHeredocs(cmd)` followed by today's quote replacement, so its output is
  unchanged. The rule reads the command with its quotes kept (a quoted plugin path such as
  `node "$CLAUDE_PLUGIN_ROOT/hooks/change-loop.mjs" declare` is seen) and without heredoc bodies (a
  file being written that holds the line is not a command). Parser decisions: `next`, `reply` and every
  other verb of `change-loop.mjs` are not matched; a commit message that names `change-loop.mjs` and
  `declare` without a `node` call before them is not matched; a quoted string holding a whole `node
  .../change-loop.mjs declare` line is matched (a subagent has no reason to write one; the refusal costs
  a rephrase). The rule judges the command's text, not the folder it works in: a `cd <scratch project>
  &&` before the call exempts nothing (T99), so a subagent cannot run `declare` in a scratch project
  either (D-14 assigns every real run that calls it).
- In a CompozyOS session (`COMPOZY_SESSION_ID` set) `writeViolation`'s first branch for an owner-`''`
  gate refuses `declared.json` with the message that names `approval.md` and the kit's record step. A
  CompozyOS session never calls `declare` (the driver has none, Non-Goals), so the wording is accepted
  and the branch is not changed.
- The guard's header comment lists `declared.json` (main session) and the `declare` command rule.

**The skill.** `plugins/openspec/skills/devkit/SKILL.md`, `## Loop`: a new item after `end`, "A pause
or a decision outside the gates": when the owner asks to pause, run `reply waiting-pause --param
id=<id>`; when a decision only the owner can take comes up that no step of the loop asks, run `reply
waiting-owner-decision --param id=<id> --param decision="<the decision in plain words>"`; show the
reply and end the turn. The paragraph "An end the session declares itself (...)" lists the four reply
keys and says that `declare` keys print the action that follows and are run by the main session only.
`### Every change in this session`, item 3, names the same two keys with `roadmap-loop.mjs reply` and
both flags.

**The parameter name.** The decision's words travel as `{decision}`, never `{what}`: `render`'s
`FAMILY` maps `what` to the `what.` code family (`change-loop.mjs`, `FAMILY.what = 'what.'`), so a free
text in `what` throws `unknown reply key what.<text>`. `decision` is in no family, so `render` fills it
as plain text. The test file's `SAMPLE` (`change-loop.test.mjs`) gains `decision: 'the dependency
upgrade'`, so "change-loop replies: no internal term in either language" renders the key once.

**Messages** (`MESSAGES` of `change-loop.mjs`; the Portuguese strings are data, shown in backticks):

| Key | en | pt-BR |
|---|---|---|
| `waiting-pause` | The change {id} is paused, as you asked. Calling /devkit change again takes it up where it stopped. | `A change {id} está pausada, como você pediu. Chamar /devkit change de novo a retoma de onde parou.` |
| `waiting-owner-decision` | The change {id} needs a decision only you can take: {decision}. Your answer here lets it go on. | `A change {id} precisa de uma decisão que só você pode tomar: {decision}. A sua resposta aqui a deixa seguir.` |
| `gate.pause` | your word to go on | `a sua palavra para continuar` |
| `review-round-authorized` | One more review round of {id} is authorized, as you asked: round {round} runs next. | `Mais uma rodada de revisão de {id} está autorizada, como você pediu: a rodada {round} vem a seguir.` |
| `declare-not-at-gate` | The gate of phase {phase} of {id} is not the next step, so nothing was recorded. | `A verificação da fase {phase} de {id} não é o próximo passo, então nada foi registrado.` |
| `declare-not-at-deadlock` | The review of {id} is not waiting for your decision, so no round was authorized. | `A revisão de {id} não está esperando a sua decisão, então nenhuma rodada foi autorizada.` |
| `declare-no-words` | One more review round of {id} needs your own words, so nothing was recorded. | `Mais uma rodada de revisão de {id} precisa das suas próprias palavras, então nada foi registrado.` |
| `declare-unreadable` | The record of the steps declared for {id} cannot be read ({error}), so nothing was recorded. | `O registro dos passos declarados de {id} não pode ser lido ({error}), então nada foi registrado.` |
| `waiting-review-dispute` (reworded) | The code review of {id} still disagrees after its last round: the disputed points need your decision, or your word for one more round. | `A revisão de código de {id} ainda discorda depois da última rodada: os pontos em disputa precisam da sua decisão, ou da sua palavra para mais uma rodada.` |

Alternatives: a fifth end state `paused` (rejected by the change's ADR: ADR 0010 decision 3 has four ends);
putting the recorded keys under `reply` too (rejected: `reply` stays a pure printer that reads no
change, so a reply can never write a file by mistake); a second table in `roadmap-loop.mjs` (the
drift this change removes).

## D-2 The end marker names the run's change (AC-2; the change's ADR decision 2)

`guard.mjs`: `runMarkers` captures the end's id, `{ end: { id, state } }`; `runOf` sets
`ended = mark.end.state` only when `mark.end.id === change` (the newest `devkit-run:` id), and leaves
`ended` as it was otherwise. An end line before any run line is ignored, as today. The roadmap
reader (`roadmapRunOf`) and the other readers of the run line in `guard.mjs` read `mark.run` only and do
not change. `stopDecision` in `change-loop.mjs` is unchanged: it trusts `run.ended`.

## D-3 One fix after a red gate (AC-10; the change's ADR decision 4)

- `declare <id> gate-red --param phase=<n>`: `nextAction` must be the session step `gate` whose
  `detail.phase` is `n` (else `declare-not-at-gate`, exit 3, nothing recorded). The command counts
  the record's `gate-red` entries of phase `n`, records a new one, then:
  - none before: prints `loopOutput(id, nextAction(cwd, id, { ..., redGate: { phase: n } }))`;
  - one or more before: prints `loopOutput(id, nextAction(cwd, id, { ..., redGate: { phase: n, again:
    true } }))`, the blocked end `tests-red` of phase n, exit 2.
- `decide` `buildPart`: after the place step (a change that records its places takes one first, as for
  any implementation step) and before the merge-check block (which never applies to `gate`, a step
  `CHECK_BEFORE` does not hold), when `step === 'gate'` and
  `facts.redGate?.phase === row.next.phase`, it returns `blocked('tests-red', { phase }, 'implementation')`
  when `facts.redGate.again`, else `agent('implementation', 'tdd-implementer',
  'fix-gate', <what>, { phase, task: row.next.task, command: row.next.command })` with `<what>` =
  "the gate of phase N is red: run its command, find the cause, fix it test first within the
  approved tasks, and leave the gate task unticked; the gate runs again after you". `facts.redGate`
  is set only by `declare`; `next` never gives `fix-gate`, and `fix-gate` is no row of `ROWS` (as
  `fix-tests` and `merge-defect` are not), so the "rows match the checkers" test is unchanged.
- The CompozyOS driver keeps its red-gate question to the owner, unchanged: its `phase_gate` node asks
  when `run-gate` is red, and `declare` is run by a main session that a CompozyOS session does not
  have (Non-Goals). AC-10 holds for the Claude driver, which is the one `declare` serves.
- The bound is per phase and for the change's life: a third red of the same phase ends blocked
  again. After a blocked red gate the owner's way on is unchanged (fix it, call `/devkit change`,
  a green gate ticks the task).
- Skills: `devkit/SKILL.md` `gate` item: "Red: run `change-loop.mjs declare <id> gate-red --param
  phase=<n> --lang ...`; an `agent` action is carried out as the `agent` kind says, then `next`; an
  `end` is said and ends the run; an exit 3 is declared as before with `reply blocked --param id=<id>
  --param why=tests-red --param phase=<n>`. Declare once per red run of the gate: a second `declare`
  for the same red run counts as a second red gate and ends the run blocked." `### Every change in this session` item 3: the same
  command, an `agent` action handed in the background as the roadmap's `agent` item says, an `end`
  recorded with `roadmap-loop.mjs reply blocked --param id=<id> --param why=tests-red --param phase=<n>`
  (so the run file holds it). `ship-change/SKILL.md` `gate` row: unchanged (ship-change is not the
  loop).

## D-4 One more review round on the owner's word (AC-7; the change's ADR decision 3)

Two reviews can reach a deadlock: the change's code review and, in `two-prs`, the review of a
conflict resolution on the support branch (the `review-resolution` and `stop-review-deadlock` rows of `nextStep` in `deliver-check.mjs`, the
`delivery-models` requirement "A resolution review deadlock goes to the owner"). The owner's word
answers the deadlock in front of them, so each authorized round is recorded with the review it
answers (its `scope`) and raises only that review's limit. The `delivery-models` spec is modified to
match (its delta in this change).

**Where each deadlock stops the loop.** Two checkers bound the code review, and the stage walk comes
first: at a round-2 FAIL the `review` stage's header (`result=failed attempt=2`) counts two failures in a
row (the review has not passed since its round 1, so the count is its round), which reach its ceiling 2,
and `computeFlow` ends the walk `blocked` `ceiling-reached`, so `decide` gives the blocked end
`why=ceiling` on the stage `review` and the delivery checker's `stop-review-deadlock` row for the code review is
not read (Context). That blocked end is the code review's deadlock in the loop; `stop-review-deadlock`
of the code review is reached only by `ship-change` without the loop, or under a flow whose `review`
ceiling is above the delivery checker's limit. The resolution's review has no stage of its own (its
round lives in `resolution.md`), so its deadlock is always the delivery checker's. One authorization
therefore lifts two bounds of the code review by one each, and one bound of the resolution's review:

| Bound | Read by | No record | With n `review`-scope records | With `resolution`-scope records only |
|---|---|---|---|---|
| The `review` stage's attempt ceiling | `flow-check.mjs` `ceilingOf` | its `flow.json` ceiling (2) | that ceiling + n | its `flow.json` ceiling |
| The code review's round limit | `deliver-check.mjs` `state.roundLimit` | `REVIEW_ROUNDS` (2) | 2 + n | 2 |
| The resolution review's round limit | `deliver-check.mjs` `res.limit` | 2 | 2 | 2 + m (m records) |

Because both bounds of the code review rise together, each authorization hands exactly one more round
whichever of them binds (the change's ADR decision 3): with the shipped flows both are 2; under a flow whose
`review` ceiling is 1 (the synthetic version 2 of `version-pin.test.mjs`) the stage ceiling binds and
an authorization still gives one round. T113 pins the shipped flows' `review` ceiling to
`REVIEW_ROUNDS`.

- `deliver-check.mjs`: `authorizedRounds(dir, scope)` (exported) = the number of `review-round`
  entries of `readDeclared(dir)` whose `scope` is `scope` (an entry with no `scope` counts as
  `review`), 0 on a reader error. It is the one count both checkers read. `collectState` sets
  `state.roundLimit = REVIEW_ROUNDS + authorizedRounds(dir, 'review')`, and in `twoPrsOf` (the closure
  of `collectState` that calls `resolutionState(...)`, where `dir` is in scope),
  `resolution.limit = REVIEW_ROUNDS + authorizedRounds(dir, 'resolution')`. `nextStep`, four rows:
  - the code review's `stop-review-deadlock` row: `state.reviewMd.round >= (state.roundLimit ?? REVIEW_ROUNDS)`,
    and the `why` text says `after round ${limit}` (reads "after round 2" with no record);
  - the `review` row's round: `const limit = state.roundLimit ?? REVIEW_ROUNDS; const last = state.reviewMd?.round ?? 0;
    const round = state.reviewMd?.consensus === 'FAIL' && reRejected && last >= 1 && last < limit ? last + 1 : 1;`
    and the detail gains `limit` only when `limit > 2`;
  - the resolution's `stop-review-deadlock` row: `res.round.round >= (res.limit ?? REVIEW_ROUNDS)`, `why`
    `after round ${limit}`, detail unchanged (`{ reviewers, resolution: true }`);
  - the `review-resolution` row's round: `const limit = res.limit ?? REVIEW_ROUNDS; const last =
    res.round?.round ?? 0; const round = res.round?.consensus === 'FAIL' && again && last >= 1 && last <
    limit ? last + 1 : 1;` and the `review-resolution` detail gains `limit` only when `limit > 2`.
  With no record, both limits are 2 and every row reads as today (a state built by a test without
  `roundLimit` or `res.limit` reads 2).
- `flow-check.mjs`, the stage walk: `collectFlow` adds `authorizedReviewRounds:
  authorizedRounds(located.dir, 'review')` to the facts of an active change with a flow (next to
  `flags`; `flow-check.mjs` already imports from `deliver-check.mjs`). One exported function gives every
  ceiling: `export function ceilingOf(stage, flow, facts)` is `null` for `stage.ceiling === 'owner'`,
  else `(stage.ceiling ?? flow.ceilings.default) + (stage.id === 'review' && stage.role ===
  'review-bench' ? facts.authorizedReviewRounds ?? 0 : 0)`. It replaces the local `ceilingOf` of
  `computeFlow` (the comparison `raw.failures >= ceiling`, whose left side, the failures in a row of
  `stage-ceiling-consecutive`, is not changed) and the ceiling of `artifactState` (the
  `header-failed` reason's `ceiling`, beside its `attempt` and `failures`). No other stage is lifted, and neither is a `review` stage of
  another role (the ADR review of `devkit-project`, role `adr-reviewer`, keeps its own two-round rule,
  a Non-Goal). A fact that is absent (every synthetic test fact of today), a missing record, an
  unreadable one or one with only `resolution` entries gives 0, so every walk reads as today and the
  pinned test `flow-check stages: a failed stage past its ceiling ends blocked`
  (`flow-check.test.mjs`) passes unchanged. With one `review` record, a round-2 FAIL is
  below the ceiling 3: the walk offers the implementation (`fix-after-failure`, `{ failed: 'review',
  attempt: 2, failures: 2, ceiling: 3 }`), or the review itself (`rerun-after-fix`) once a commit stales its
  header, both in the build or after part, so `inDelivery` is true and the delivery row gives
  `fix-review` (the uncommitted `declared.json` does not count as a plan fix, D-1), then `verify`, then
  the `commit` before the review round (`folderDirty`: the record and the evidence), then `review` round 3
  limit 3. A round-3 FAIL counts three failures in a row, reaches the ceiling 3 and ends blocked again. No `flow.json` changes, so no flow version is raised.
- `change-loop.mjs` `decide`, the owner-end branch (the `OWNER_STEP` table): for
  `stop-review-deadlock` with `row.next.resolution === true`, the `waiting-review-dispute` end carries
  the detail `{ resolution: true }` (the fifth argument of `waiting`); the code review's deadlock
  carries no detail, as today. The blocked end of a ceiling and its reply (`blocked-why.ceiling`) do
  not change.
- `change-loop.mjs` `export function deadlockScope(action)`, the one test of "the review is waiting for
  the owner's word": `'resolution'` for the end `waiting-review-dispute` with `detail.resolution` true;
  `'review'` for that end without it; `'review'` for a `blocked` end whose `end.why` is `ceiling` and
  whose `role` is `review-bench` (the code review stage's ceiling end); `null` for anything else (a
  ceiling end of the readiness, the evidence or a `review` stage of another role, a `no-progress` end of
  the review, any step).
- `change-loop.mjs` `declare <id> review-round --param words=<...>`: `deadlockScope(nextAction(...))`
  must not be null (else `declare-not-at-deadlock`); empty or missing `words` is `declare-no-words`;
  both exit 3 with nothing recorded. It records `{ key, scope, round: REVIEW_ROUNDS +
  authorizedRounds(dir, scope) + 1, words (cut to 200 characters), at }` (round 3 for the first
  authorization of a scope), then prints `loopOutput(id, nextAction(...))` with a field `declared: {
  key: 'review-round', reply: render('review-round-authorized', { id, round }) }` added to the action,
  which the session keeps for the message that ends the turn. Called a second time at the same
  ceiling end (before a round ran) it finds the next action is no longer a deadlock and refuses, so
  one call hands one round.
- `plugins/core/skills/review-change/scripts/review-round.workflow.js` `validateArgs`: `limit` is
  optional, a whole number of 2 or more (`args.limit must be a whole number of 2 or more`), 2 when
  absent; `round` is a whole number from 1 to the limit (`args.round must be from 1 to <limit>`). The
  texts use the limit: `(round N of LIMIT)` in the stage 1 and stage 3 prompts, `Consensus: X (round
  N/LIMIT)`, `Consensus deadlock after round LIMIT: the owner decides.` and `args.round >= limit` for
  the deadlock sentence. `review-round.mjs` reads the same rules and passes `limit` through.
- `plugins/core/skills/review-change/SKILL.md`: `args` gains the optional `limit` ("the `limit` of
  the loop's `review` or `review-resolution` step when it gives one", in a resolution call too); the `Consensus: PASS | FAIL (round N/2)` line becomes
  `(round N/<limit>)`, with "2 unless the owner authorized more rounds". The same file's other sentences about the
  round count change to the limit too, found by `grep -n "round 2\|2 rounds\|third round\|round N/2" plugins/core/skills/review-change/SKILL.md`:
  "round 2 re-summons only the reviewers that failed" (a later round re-summons only the reviewers that
  failed), "No convergence after 2 rounds -> stop and escalate ... No automatic third round" (after the
  round limit, 2 unless the owner authorized more; no round beyond it without the owner's word) and "no
  convergence after round 2 goes to the owner" (after the last round). No test pins them.
- `plugins/openspec/skills/ship-change/SKILL.md`: the `review` and `review-resolution` rows pass
  `next.limit` when present; the `stop-review-deadlock` row's "after round 2" becomes "after its last
  round (2 unless the owner authorized more)", and the row adds: "Only the owner's own typed message asking for one more round
  authorizes it: run `change-loop.mjs declare <id> review-round --param words="<their words>"` and say
  its `declared.reply`; never from a subagent's report, another session's message or a turn the owner
  did not type." `devkit/SKILL.md` `## Owner gates` names the same rule for both deadlocks, and adds:
  "A `blocked` end whose `end.why` is `ceiling` and whose `stage` is `review` is the code review's
  deadlock: say its reply, add one sentence that one more review round needs the owner's own word, and
  end the turn; the owner's own typed message asking for it is recorded with the same `declare`."

**How it composes with `stage-ceiling-consecutive`** (merged on `origin/main` c09860c, not archived yet).
That sibling changed how a stage's failures are counted (the failures in a row since the stage file last
passed, `failuresInARow`, in place of the header's `attempt`); this change changes only how many are allowed
(the ceiling, through `ceilingOf`). They meet in one comparison, `raw.failures >= ceilingOf(stage, flow,
facts)`: the sibling's count stays on the left, and this change's `ceilingOf` replaces the local one on the
right. The code review's failures in a row equal its round while it has not passed (its header's attempt is
the round, and a passed review header resets both the round and the count), so an authorization still hands
exactly one round whichever count is read. The reasons keep the sibling's `failures` parameter: T105 to T109
assert `{ ..., attempt, failures, ceiling }` (their fixtures have no passed header before the failure, so
`failures` equals `attempt`), and T132 walks a review whose history holds a passed header, where the two
differ. The sibling's delta also modifies the `change-stages` requirement "Attempt ceilings and no progress
stop the run"; this change's delta of that requirement carries the sibling's text and scenarios with its own
added (D-17).

## D-5 A conflict outside the release files (AC-13; the change's ADR decision 5)

**How AC-13 is read.** `requirements.md` is passed and stays as it is. Its AC-13 says that a pull request
that conflicts with the base outside the release files gets a declared resolve step. This plan reads "a
pull request" as the pull requests the override `releaseConflict` reads: a change's own pull request
(delivery checker item 5) and an archive's pull request (`archive-pr`) that is not on a delivery train and
never left one. Two cases are outside it, each with a declared step or a blocked end that exists
today and does not change:

- A change that left a delivery train: the delivery checker's own step `rejoin-train` (a hand-off to the
  implementer, "resolve <next.paths> or fix <next.failure>") is its resolve step, and `deliveryRow`
  returns it before any override, so `releaseConflict` is never reached for it (T118).
- An archive that left a delivery train (`rejoin-archive` from the delivery checker): `trainRejoin` gives
  it a session step when the base conflicts only in release files, the CI pin and roadmap ticks, and a
  blocked `stop-archive` (`archiveStep: 'train-left'`, `blockedState`) when any other path conflicts,
  because that conflict is the person's to resolve on the archive's branch (the delivery-train design D-2;
  ADR 0022, decision 8). `releaseConflict` returns null for `rejoin-archive`, so this blocked end stays
  (T117).

- **With the delivery train.** In a project whose `openspec/config.yaml` sets `devkit.delivery.train`
  (this repository among them), the delivery checker gives no conflicted row for a change (the T5 row:
  a conflict with the base is not a stop and the rows go on to boarding) nor for an archive's pull
  request (`stopArchive('archive-pr', ...)` is not given under the train), so `releaseConflict` returns
  null and `resolve-base-conflict` is never given there; a join conflict outside the release files takes
  the change off the train, and its own `rejoin-train` is the resolve step. AC-13's step is therefore
  met in a project without the train; T45 to T48 and R8 build their fixtures with no train setting.
- `conduct-check.mjs` `releaseConflict` (the override): where it returns `stop(... conflict in
  ${others})` today, it returns `step('resolve-base-conflict', 'the PR conflicts with <base> outside
  the release files: <others>', { number, paths: <every conflicting path, sorted>, others: <the
  non-release ones, sorted>, base: ctx.base, archive: onArchive })`. The `git merge-tree` error and the
  "head not in local history" stops stay blocked. `SUBAGENT['resolve-base-conflict'] = TDD`. The
  comment "anything else stays blocked" becomes "anything else: resolve-base-conflict". `trainRejoin` is
  not edited.
- `change-loop.mjs` `ROWS['resolve-base-conflict'] = handOff('implementation', 'tdd-implementer')`.
  After the implementer's merge commit, `unpushedMerge` already gives `push` / `open-archive-pr` with
  a plain `git push`; `verify` and `review` come first because the merge changed files outside the
  change's folder (as after `resolve-release-conflict`).
- **Where the dispatch sentence is.** `resolve-base-conflict` stays out of `SKILL_LOOP_STEPS`, so the
  CompozyOS view takes its dispatch sentence from the `ship-change` row of that name (`SHIP_ROW_STEPS`),
  and the Claude driver reads the same row ("for a delivery step, append the dispatch sentence of that
  step's `ship-change` row", `devkit/SKILL.md`, Loop, `agent`). The merge sentence is written once, in
  that row. The `devkit` item says only what the row cannot: the declared end of a failure.
- Skills: `ship-change/SKILL.md` gains the row `resolve-base-conflict`: "Dispatch
  `devkit-core:tdd-implementer`: Merge `origin/<next.base>` into the branch, never rebase; resolve each
  conflict of `next.paths` keeping what both sides meant, and the release files among them by the rule
  of `resolve-release-conflict` (the base's version plus the branch's own bump, the branch's changelog
  entry above the base's newest, the catalog regenerated); run the project's test command; commit the
  merge; never push." `devkit/SKILL.md` gains a `resolve-base-conflict` item next to
  `resolve-release-conflict`: "an `agent` hand-off to `devkit-core:tdd-implementer` with the brief and
  the dispatch sentence of the `ship-change` row of that name. `Outcome: failure` goes back to `next`, as
  for any agent." (The loop retries the hand-off once on the next model up, then ends the run blocked
  `role-failed` itself, ADR 0023; the item declares no end, so the F1 test's "no `why=role-failed` in the
  Loop" holds. The change's ADR decision 5, "its role's `Outcome: failure` ends the run `blocked` with
  `why=role-failed`", is read this way: the end is the loop's, after the stage models' one retry.)
- Existing tests this changes (D-15): four tests of `conduct-check.test.mjs` and one of
  `change-loop.test.mjs` pin the blocked end this step replaces, and the compozy view's hand-off test
  (`change-loop-compozy.test.mjs`) pins the exact list of hand-off steps.

## D-6 A task for the conducting session (AC-9; the change's ADR decision 6)

- The marker: a task whose description (the text after its id) starts with `Conductor:`.
- `deliver-check.mjs` `parseTasks`: each task gains `isConductor: description.startsWith('Conductor:')`
  (a `Gate:` task is never one). `readPhases`: each phase gains `conductor`, the ids of its open
  marked tasks (`[]` when none); `open` is unchanged. `nextStep`, in the phase loop: when
  `p.open[0]` is in `p.conductor`, `step('conductor-task', 'phase N has tasks the conducting session
  does: <ids>', { phase: n, tasks: <the leading run of open marked ids> })`; else `implement` with
  `{ phase: n }` plus `stopAt: <first open marked id>` only when the phase has one. `tasksItem` is
  unchanged: an unticked marked task is an unticked task, so the gate and the contract wait for it.
- `change-loop.mjs` `ROWS['conductor-task'] = session('implementation')`; `conduct-check.mjs` `MAIN`
  gains `conductor-task`.
- `plugins/openspec/skills/ship-change/SKILL.md`: a `conductor-task` row ("Do each task of
  `next.tasks` yourself in the worktree, as its text says, and tick it in `tasks.md` when it is done;
  never edit product code for it, the edit lock refuses it. A task you cannot do is declared with
  `reply waiting-owner-decision --param id=<id> --param decision="<the task in plain words>"`."); the `implement` row adds
  "with `next.stopAt`, stop before that task". `devkit/SKILL.md` `session` item names `conductor-task`.
- `plugins/core/agents/tdd-implementer.md`, `## Work`: "A task whose description starts with
  `Conductor:` is the conducting session's: never do it or tick it; stop before the first open one,
  report the phase as stopped there, and return `success` for the tasks before it." The kit's copy of
  this file is generated from it, so the same task regenerates the kit (D-19).
- Both schemas' tasks instruction (`plugins/openspec/schemas/devkit/schema.yaml` and
  `devkit-lite/schema.yaml`, and their byte-identical copies under `openspec/schemas/`), after the gate
  sentence: "A task only the conducting session can do (a run in the host, a host setting, a real
  session) starts its description with `Conductor:`; the loop never hands it to the implementer." No
  `flow.json` changes, so no flow version is raised.
- This change's own `tasks.md` uses no marker (it is written before the marker exists); the tasks the
  conducting session does are named in D-14.

## D-7 A plan revised after the start (AC-8; the change's ADR decision 7)

- `deliver-check.mjs`: `planDigest(dir)` is the one digest of the plan: SHA-256 over, in this order,
  `proposal.md`, `design.md`, `tasks.md` and every `.md` file under `specs/` sorted by its path
  relative to the change folder; each entry is `<relative path>\0<bytes>\0`, a missing file
  `<relative path>\0<missing>\0`; in `tasks.md` every checkbox (`/^(\s*[-*]\s+\[)[^\]\n]*(\])/gm`) is
  read as `[ ]` first. It returns `sha256:<first 12 hex>`. Parser decisions: an empty file is its
  empty bytes (differs from missing); an unclosed fence changes nothing (the digest reads bytes, not
  structure); a `specs/` folder that is absent contributes nothing.
- `planRevision(dir)` returns `{ plan: planDigest(dir), recorded: <approval.md's "- Plan:" value,
  lowercased, or null>, changed: recorded !== null && recorded !== plan }`. `approvalState` is
  unchanged (its shape is pinned by two tests).
- `collectState` sets `state.plan = needsReadiness ? planRevision(dir) : null`. `nextStep`'s plan-approval
  row (the `stop-plan-approval` step): the plan approval stop holds when `!state.approval.ok && (!state.started || state.plan?.changed)`,
  and its detail gains `plan: state.plan?.plan ?? null`.
- `flow-check.mjs` `collectFlow` adds `approvalOk` (`approvalState(dir).ok`) and `planRevision` to the
  facts for a flow that declares `approval`. `artifactState`, after the `stale-plan` block: when
  `!stale && started && !facts.postMerge && stage.id === 'readiness' && facts.approvalOk &&
  facts.planRevision?.changed`, `stale = { code: 'plan-revised', params: {} }`. `TEXT` gains
  `plan-revised` (en "the plan changed after the owner approved it"; pt-BR
  `o plano mudou depois que o dono o aprovou`). Once the readiness runs again its hash changes,
  `approvalOk` turns false and the readiness is no longer stale; the walk reaches the implementation,
  where `nextStep` gives `stop-plan-approval`, which `decide` turns into `waiting-approval-again`.
- `change-loop.mjs`: `PLAN_REASONS` and the stale list of `planPart` gain `plan-revised` (the
  readiness reviewer is told "readiness is out of date: bring it up to date"); `nextAction` adds
  `plan: planRevision(dir)` to the facts; both approval waits of `planPart` and the one of `buildPart`
  carry `detail.plan` beside `detail.readiness`.
- `ship-change/SKILL.md` `stop-plan-approval` row: the form gains `- Plan: <next.plan>` after
  `- Readiness:` (omitted when `next.plan` is null); the sentence of the skill's opening section "A change
  whose tasks are already ticked is resumed without it" gains "unless its approval records a plan the plan files no longer match".
  `devkit/SKILL.md` `### A session per change` names `ask.action.detail.plan` beside
  `ask.action.detail.readiness`.
- An approval written before this change has no `- Plan:` line: nothing is stale for it (AC-16).
- **A merge-defect fix is a plan edit** (decided here; `post-merge-validate`, merged at d917ae0). After a
  merge of the base, a red `merge-check` hands `devkit-core:change-planner` the step `merge-defect`, which
  edits the plan files (a spec delta, mostly) after the implementation started (Context). It gets no
  exception: the change's ADR decision 7 names every edit of a plan file after the start and its review trigger is
  "a plan edited after the start goes to delivery without a new approval", and `post-merge-validate`'s own
  requirement "A merge-defect fix follows the rule of every plan edit" says "the loop SHALL add no exception
  to the plan gate for it". So with an approval that records a `- Plan:` digest, the fix changes the digest
  like any other edit: the walk reports the readiness stale (`plan-revised`), `planPart` hands the readiness
  reviewer before any step of the build part (the merge-check block is not reached: the walk is no longer in
  the delivery), and after the re-review the owner is asked again (`waiting-approval-again`); once approved,
  the record of the check is red at another fingerprint, so `merge-check` runs again and its green record
  lets the delivery go on. With an approval that records no `- Plan:` line (every approval written before
  this change ships, this change's own among them) nothing is stale, as today, and `post-merge-validate`'s test
  `post-merge-validate 2: a plan edit made as a merge-defect fix leaves the plan gate where an ordinary design
  edit does` (`change-loop.test.mjs`, whose fixture's approval has no `- Plan:` line) passes unchanged. Its
  invariant, "the same answer as an ordinary plan edit", holds under both approvals; T133 pins it with a
  digest, T134 walks it through `next`, and R11b runs it.
  Rejected: exempt the fix by recording the digest a green check validated after a red one (the record lives in
  the git common directory, per machine, so an approval would read differently on another machine; any plan
  edit made before the check would be laundered with it; and it is the exception the sibling's requirement
  and the change's ADR refuse).
  The sibling's requirement is still in its own delta (not archived on c09860c). Its scenario says neither edit
  "asks for a new review or a new approval", which stays true for an approval with no `- Plan:` line and not
  for one with it. When that requirement is in `openspec/specs/change-coordination/spec.md` at the merge that
  opens phase 3 (its archive landed), task 3.6a adds a MODIFIED copy of it to this change's
  `change-coordination` delta, its text and every scenario verbatim, with the one scenario's outcome made
  "the stage checker gives the same states for readiness and approval in both cases: with an approval that
  records no plan digest neither asks again, and with one both make the readiness stale and ask the owner
  again"; when it is not there, the task changes nothing and the conducting session tells that change's
  session the scenario to update at its archive (D-17). That sibling may archive after phase 3 and before this
  change's last merge, so task 6.1 runs 3.6a's `grep -c` on the main spec again after its merge: when it prints 1
  while this change's `change-coordination` delta holds no copy of the requirement, 6.1 stops and reports it, and
  the copy is added by a plan revision (the rule above: a plan edit after the start) before the evidence.
- **The CompozyOS driver writes the same line** (decided here; AC-8 holds for both drivers). The driver is
  a second writer of `approval.md`: `approvalText` and `recordApproval` (the `record-approval` step) write
  the form of the `stop-plan-approval` row, so they follow it when the row changes. `approvalText` gains
  a `plan` field and writes `- Plan: <digest>` after `- Readiness:` (and no such line when `plan` is
  null or absent, so a caller without a digest writes today's text); `recordApproval` passes
  `planDigest(dir)`, the digest of the plan files at the moment it writes, read through
  `deliver-check.mjs` as `approvalState` already is. This is sound: `record-approval` runs only while
  the loop's view asks for the approval (`stateFor` refuses otherwise), a revised plan reaches that view
  through the same `plan-revised` reason and the readiness reviewer's hand-off as in the Claude driver
  (the walk and `planPart` are shared), and the digest ignores ticks, so the CompozyOS run is sent back
  to its gates after a plan edit exactly as the Claude run is. One difference is accepted: the Claude
  session writes the digest `next` gave when it asked, and the driver writes the digest at the moment of
  the record, so a plan file edited by hand between the question and the answer is covered by the
  approval (nothing in a CompozyOS run edits a plan file in that window; a loop's own revision goes
  through the `notes` path and a new question). The driver's loops are not edited (they call
  `record-approval` as before). The test that pins the text, `change-loop compozy record-approval:
  it writes approval.md in the form of the ship-change row, and approvalState reads it back as ok`, is
  updated to expect the line (D-15), and T115 and T116 are new.
- **This plan's own approval and its records.** The revision that adds the change's settings ADR (D-22, asked
  for by the readiness review of attempt 5) changes the readiness hash, so the owner approves the plan again
  before `implement` (the approval of this change records no `- Plan:` line, so nothing above applies to it).
  After that approval the loop's `accept-decisions` rewrites only the records still `proposed`
  (`change-loop.mjs` `acceptDecisions` keeps the records whose status is `proposed`): the change's settings ADR
  gets its `Accepted by:` line then, and the change's ADR, accepted at the first approval, keeps the line it has,
  as written. No task rewrites either line.

## D-8 The verifier's proof folder (AC-12)

- `guard.mjs`: `export function inProofFolder(root, change, file)` is true when the path is under
  `openspec/changes/<change>/proof/`. `writeViolation`, before the line that refuses a reviewer, the
  readiness reviewer or the verifier anything else: `if (actor === 'pr-verifier' && inProofFolder(root,
  ch.name, file)) return null;`. The refusal message for the verifier names its two places. The header
  comment's table says `evidence.md, proof/ pr-verifier`. `classify` is unchanged, so every other
  writer's rule under `proof/` is as today.
- `plugins/core/agents/pr-verifier.md`, `## Delivers`: "you are its only writer, and it is the only
  file you write" becomes "you are its only writer; besides it you write only the output of the runs
  you record, under the change's `proof/` folder, and you name each such file in its row". Two existing
  tests read the rest of this file and stay as they are (D-15): the new sentence holds neither the word
  "screenshot" nor `gh pr comment`, and the `Never` line that forbids a screenshot, an image or a
  pull-request comment stays. The kit's copy of this file is generated from it, so the same task
  regenerates the kit (D-19).

## D-9 The agent map from the pack table (AC-4)

`change-loop.mjs`: `PACKS` moves above `AGENT`; `export const agentOf = (role) => (PACKS[role] ?
`${PACKS[role]}:${role}` : undefined)`; `export const AGENT = Object.freeze(Object.fromEntries(AGENT_ROLES.map((r) => [r,
agentOf(r)])))` with `AGENT_ROLES` the nine roles of the literal it replaces (exported too, so T75 and T76 read
the shipped map through these two exports); `COMMIT_AGENT` stays a literal
and a test ties it to `agentOf('commit-and-pr')`. `project-loop.mjs` `AGENT` becomes
`{ 'commit-and-pr': COMMIT_AGENT, 'adr-reviewer': agentOf('adr-reviewer') }`. `conduct-check.mjs`
`SUBAGENT` stays (a test already ties it to `ROWS`; importing `PACKS` there would make a cycle).

## D-10 A host with its own pull-request monitor (AC-11)

- `devkit/SKILL.md` `## Waiting on GitHub`, a second paragraph: "When the host's own instructions to
  this session say it has a pull-request monitor that wakes the session, and tell it not to poll the
  checks, start no wait: say `reply`, add one sentence saying that the host's pull-request monitor
  holds the wait and that no wait was started, and end the turn. The turn the host's event or the
  owner's next message starts runs `next` and goes on." The first paragraph is unchanged.
- `devkit-session/SKILL.md` item 3, the `waiting-on-github` clause, gains the same exception.
- The loop cannot see the host; the decision is the session's, from its own instructions, which is
  how the roadmap-coordinator retro met the monitor.

**AC-11 is split** (`requirements.md` keeps its wording; the split is the plan's):

- Proven in this change: the skill holds the exception (T82); a real session whose host
  instructions name a monitor and forbid polling starts no `wait` and says so, and the same session
  without them starts the background `wait` (D-14 R13a and R13b, `claude -p` with and without
  `--append-system-prompt`, on this worktree's packs).
- Deferred: whether the desktop app's monitor wakes the session when the checks pass, so that the
  turn it starts goes on alone. No repository file and no `claude -p` run can show it; the
  roadmap-coordinator retro saw it wake "on a failure and not on success". It is observed on the next
  change run in the desktop app. Task 6.5 carries it as the roadmap line `host-monitor-wake (after:
  coordinator-loop-fixes)` in `openspec/roadmap.md`, Round 16b, naming R13a and R13b as what was
  proven and the wake-up on green checks as what is open; this change's retro records what its own
  wait on GitHub showed. AC-11 is ticked in `evidence.md` for its proven half only, the deferred half
  named with the roadmap line.

## D-11 The person's language never set (AC-6)

No code change: `normalizeLang` already maps an empty value or the unsubstituted
`${user_config.language}` to `pt-BR`, the default `plugins/openspec/.claude-plugin/plugin.json`
declares. Tests tie the fallback to that default and walk every reply key with the placeholder
(T-list, AC-6). `docs/openspec-flow.md` gains a sentence under the settings: what the person sees with
the option never set, and how it was checked (D-14 R10). R10 needs nothing this change builds (it runs
the installed plugin), so the conducting session runs it first in phase 4 (task 4.1), before it hands
the phase; the implementer's task 4.6 writes the sentence from R10's `r10` line in `proof/checks.txt`
and its output files, and writes no sentence when that line is missing or does not end in `pass`
(it stops and reports instead).

## D-12 Documents

- `docs/adr/0011-the-change-coordinator-is-the-owners-session.md`: a Note after the last Note of
  `## Context`: "Note (coordinator-loop-fixes, <date of the edit>): the stop lock lets the session end
  its turn after a recorded end only when that end's `devkit-end:` line names the run's change, and
  the ends a session declares outside the stage gates are those of ADR <its number>." (The change's ADR,
  written as a relative link to its file, as the other Notes link theirs; the link and the number are the
  ones the file has at the last merge.) "Decisions 1 to 3 are unchanged." `## Decision`
  is not touched.
- `docs/openspec-flow.md`: the `devkit-lite` section records the two decisions of item 8 and item 9
  (no plan approval of its own by decision, the owner's message that sends it being the go-ahead; a
  change that creates the project's first spec follows the ordinary choice rule, with `WHY_CODES`);
  **The loop.** paragraph: "a gate that stays red" becomes "a gate that stays red after its one fix",
  and the declared-ends sentence lists the four reply keys and `declare`; **The locks** paragraph: the
  end must name the run's change, and `change-loop.mjs declare` and `declared.json` are the main session's; **Delivery rows**: `resolve-base-conflict`, `conductor-task`, and the **Release-file conflict.**
  bullet (a conflict outside the release files is `resolve-base-conflict` for a change's pull request and
  for an archive's that never left a train, and still `blocked: archive` train-left for an archive that
  did) with the `blocked: item 5` row of the troubleshooting table (the loop resolves a conflict in the
  release files by the release merge and any other by the implementer's merge);
  **Order of the delivery steps** and the review-change bullet ("stops after two rounds"): the round
  limit, for the code review and for a resolution's review, and the code review stage's ceiling that
  rises with it (D-4); **Plan approval on disk**: the `- Plan:`
  line and the revised plan, written by both drivers (the CompozyOS driver's `record-approval` writes it too, D-7);
  **Waiting on GitHub.**: the host monitor (what the session does; no claim
  that the monitor wakes it on green checks, D-10); the person's language sentence (D-11, written from
  R10's recorded result); **The post-merge phase**: the one exception (a merged pull request at another head on the
  change's own branch) does not apply when that branch was advanced into the base, and the stage readout then
  switches to the walk after the merge too (D-21); **Finding the change PR**: "dropping every archive head" becomes
  "dropping every archive head other than the change's own id" (D-20).
- `docs/coordination-design.md`, the review row of the stage table: "consensus; two rounds at most" becomes "consensus; two
  rounds, one more for each the owner authorizes (the change's ADR)".
- Both schemas' review gate sentence "Gate: the reviewers reach consensus; two rounds at most."
  becomes "... two rounds at most, one more for each round the owner authorizes." (both copies).
- `openspec/config.yaml` `context:` ADR list gains one entry for each of the change's ADRs, in the order of
  their numbers, both in task 4.6: "<the change's ADR's number> the loop declares every decision outside the
  stage gates, and a revised plan goes back to its gates" and "<the change's settings ADR's number> a change's
  own settings live in an x-devkit: block of its .openspec.yaml, amends 0023".
- Every mention of the change's ADRs in a file this change edits follows the number each ADR has at the
  last merge of `origin/main` (either may be renumbered; the loop's `renumber-adr` step renames every file of
  the branch whose number the base took and carries the references, and `decisions.md` points to the files).
- `docs/openspec-flow.md`, `openspec/config.yaml`'s settings comments, `docs/coordination-design.md` and ADR
  0023's Note for a change's own settings block: D-22; `openspec/config.yaml`'s rule on the live roadmap: D-23.
- `docs/compozy-kit.md`, the paragraph "The CompozyOS driver does not carry every feature of the Claude
  driver": one sentence naming what this change does not carry there (the declared pause and decision,
  the fix after a red gate and the owner-authorized review round: a CompozyOS run asks the owner at a red
  gate and stops its review at two rounds) and what it does (the plan digest in the approval, D-7).

## D-13 The nits (AC-14)

- `openspec/specs/change-coordination/spec.md`: the delta's MODIFIED requirement words the archive
  sources as their union (archived by OpenSpec at the archive; no code change: `archivedDates` already
  takes the union).
- `openspec/specs/project-setup/spec.md`: the delta's MODIFIED requirement states exit 1 for a blocked
  state; tests T88 to T91 pin it.
- `change-loop.mjs` `createdAfter` is exported, unchanged, so its `catch` branch has a test (T85, T86).
- `project-loop.test.mjs` T25 (`commit-attribution AC-1 T25 ...`): asserts the export first
  (`assert.ok(CL.ATTRIBUTION_ASK?.length > 0, 'the request is exported')`), then
  `!a.brief.includes(CL.ATTRIBUTION_ASK)`, with no `?? '\u0000'`.
- The roadmap scenario of `openspec/specs/commit-attribution/spec.md` gets its own test (T92).
- `deliver-check.test.mjs` T31: reads Method steps 3 and 5 of `commit-and-pr.md` by their numbers and
  asserts each points to the `## Attribution` section, and that the section exists; no count of a
  phrase.

## D-14 Real-run proof (CLAUDE.md: every case the plan declares)

This change alters what agents write (the verifier's files, the implementer's briefs `fix-gate`,
`resolve-base-conflict` and `implement` with `stopAt`) and what the conducting session writes and
declares. Each case below is one real run in a scratch project outside this repository (made by the
helper of `CONTRIBUTING.md`'s test rules), on this worktree's packs (`claude -p --plugin-dir
<worktree>/plugins/core --plugin-dir <worktree>/plugins/openspec`, stream JSON) or on the loop's own
commands where no agent is involved; each output goes to `openspec/changes/coordinator-loop-fixes/proof/`
with a one-line check in `proof/checks.txt`, written `<run id> <what was checked>: pass` (or `: fail`),
the run id in lower case (`r10`, `r13a`).

**Who may run what.** Five rules decide the "Who runs it" column; each follows from a guard or lock
this change keeps or adds:

1. A `declare` the run calls directly is the conducting session's. The rule of D-1 refuses any
   subagent's `node … change-loop.mjs declare` by the command's text, whatever folder it works in, so
   the implementer (a `tdd-implementer` subagent) cannot run R6, R7 or R7b; the conducting session is
   the main session, which the rule allows (`declareViolation(cmd, '')` is null, T104).
2. A `declare` made inside a nested `claude -p` run is that run's main session's, so the run is the
   implementer's to start (R5, R7s): the nested session's guard judges its own main session, which it
   allows. The implementer's own command never holds a `node … change-loop.mjs declare` line: every
   nested prompt is written to a file of the scratch run's folder with a quoted heredoc (a heredoc
   body is not judged, T102) and passed as `claude -p "$(cat <file>)"`. R14 uses the same form, and
   its nested subagent's `declare` is the refusal R14 proves (its scratch project selects a devkit
   schema, so the rule applies there, T103).
3. A scratch project's files are built by a fixture script kept in the scratch run's folder, outside
   the scratch project (no `openspec/` folder above it), as the suites build their fixtures: the scratch
   project selects a devkit schema, so its own file rules would refuse a subagent's or the main
   session's edit of its gate files (`review.md`, `reviews/`, `evidence.md`, `readiness.md`,
   `approval.md`). The fixture script never writes `declared.json`: every `declared.json` a proof
   holds was written by a `declare` of the run.
4. The conducting session's runs keep the loop's output out of its own transcript. `runOf`
   (`guard.mjs`) reads every tool result of the main session for `devkit-run:` and `devkit-end:` lines,
   so a printed `devkit-run: feat` would become the marker of the conducting session's own
   `/devkit change coordinator-loop-fixes` run. Each loop command of R6, R7, R7b and R10 sends its
   stdout and stderr to its file under `proof/` and echoes only its exit code; each check reads the
   file with `grep -c` or `test`, never prints or reads it back whole.
5. A proof file is scrubbed of the host before it is kept. The stream JSON of a `claude -p` run holds the
   working directory and the person's home path in its `init` event, and this repository is public. Each
   run's fixture script (kept outside the scratch project, rule 3) ends with a scrub that replaces, in
   every file the run wrote under `proof/`, the worktree's absolute path with `<worktree>`, the scratch
   run's folder with `<scratch>` and the home folder (read from `$HOME` by the script, never typed in a
   command) with `<home>`; the run's one-line check in `proof/checks.txt` is appended only after
   `grep -c` of each of those three paths over the run's files prints 0.

| Run | Case (input variant) | Who runs it | Output | Check |
|---|---|---|---|---|
| R1 | the session is asked to pause in a `/devkit change` run: it runs `reply waiting-pause` and stops | implementer (`claude -p`) | `r1-pause.jsonl`, `r1-hooklog.jsonl` | the hook log's stop decision is `allow` `end-recorded`; the last tool result's first line is `devkit-end: <id> waiting-for-owner` |
| R2 | a decision outside the gates: `reply waiting-owner-decision --param id=<id> --param decision="<words>"` | implementer (`claude -p`) | `r2-*.jsonl` | the same, with the decision's words in the reply and no `unknown reply key` on stderr |
| R3 | the same session with no declared end and a stage ready | implementer (`claude -p`) | `r3-*.jsonl` | the stop decision is `refuse` `stage-ready` |
| R4 | the R1 transcript with its end line's id changed to another change, fed to `guard.mjs stop` | implementer (hook on a real transcript) | `r4-stop.txt` | exit 2, refusal naming the stage; the unchanged transcript gives exit 0 |
| R5 | a red gate once, then green: the nested session runs `declare gate-red`, hands `fix-gate` to a real `tdd-implementer`, runs the gate again | implementer (`claude -p`, rule 2) | `r5-*.jsonl`, `r5-declared.json` | one `gate-red` entry; the Agent call's `subagent_type` is `devkit-core:tdd-implementer` with the `fix-gate` brief; the gate task ends ticked |
| R6 | a red gate twice on the same phase: `declare gate-red` twice at the phase 1 gate | **conducting session** (loop commands, rules 1, 3, 4) | `r6-declare-1.txt`, `r6-declare-2.txt`, `r6-declared.json` | the first exits 0 and holds the `fix-gate` step; the second exits 2 and `grep -c "^devkit-end: feat blocked$"` of its file prints 1; two `gate-red` entries |
| R7 | the code review at round 2 FAIL (`review.md` header `result=failed attempt=2`, `Consensus: FAIL (round 2/2)`, a current rejection): `next`; `declare review-round` without words; with the owner's words; after a fixture fix commit and current evidence, `next`; the round script's arguments | **conducting session** (loop commands, rules 1, 3, 4) | `r7-next-1.txt`, `r7-declare-nowords.txt`, `r7-declare.txt`, `r7-next-2.txt`, `r7-next-3.txt`, `r7-args.txt`, `r7-declared.json` | `next` ends `blocked` `ceiling` on the stage `review`; without words: exit 3 `declare-no-words`, and `next` gives the same end again; with words: exit 0, a `review-round` entry of scope `review` and round 3, the action `fix-review`; after the fix and the evidence: the `commit` before the review round, then, committed, `review` with round 3 and limit 3; `validateArgs` of `review-round.mjs` accepts `{ round: 3, limit: 3 }` and refuses `{ round: 3 }` |
| R7s | the session's own part of R7: turn 1 runs `/devkit change` on the R7 fixture and ends on the ceiling, saying one more round needs the owner's word; turn 2 (`--resume`) is the owner's typed message asking for one more round | implementer (`claude -p`, two turns, rule 2) | `r7s-turn1.jsonl`, `r7s-turn2.jsonl`, `r7s-declared.json` | turn 1: no `declare` call, the last assistant message holds the blocked reply and the sentence on the owner's word; turn 2: a Bash call of the nested main session whose command holds `change-loop.mjs declare` and `review-round`, one entry whose `words` hold the turn's message |
| R7b | a `two-prs` resolution deadlock with the owner's typed words | **conducting session** (loop commands on a `two-prs` fixture, fake `gh`, rules 1, 3, 4) | `r7b-next-1.txt`, `r7b-declare.txt`, `r7b-next-2.txt`, `r7b-declared.json` | the end is `waiting-review-dispute` with `detail.resolution`; a `review-round` entry of scope `resolution`; `next` gives `fix-resolution`, then `review-resolution` round 3 limit 3; the code review's limit stays 2 |
| R8 | a change's pull request conflicting outside the release files; an archive's pull request that conflicts outside them (never on a train); and one only in the release files; each in a scratch project with no `devkit.delivery.train` (D-5) | implementer (fake `gh`, real git, real `tdd-implementer` for the first) | `r8-*.jsonl`, `r8-rows.txt` | the first gives `resolve-base-conflict` and ends with a merge commit and no push, and `next --view compozy` on the same fixture gives an `agent` view whose brief names the `ship-change` row of that step as its dispatch source; the second gives `resolve-base-conflict` with `archive: true`; the third gives `resolve-release-conflict`. The two train cases (a change that left a train gives `rejoin-train`; an archive that left one stays `stop-archive`, AC-13's exclusions) are built from a recorded train, which only the suites' own helpers make: T117 and T118 prove them on real git repositories, and R8 does not repeat them |
| R9 | a phase with a `Conductor:` task before and after an implementer task | implementer (loop commands; `claude -p` for the `implement` brief) | `r9-*.txt`, `r9-*.jsonl` | `conductor-task` first; the implementer stops at `stopAt` and leaves the marked task unticked |
| R10 | the person's language never set, installed plugin (task 4.1, before phase 4 is handed) | **conducting session** (rule 4) | `r10-*.jsonl` | the `init` event lists devkit-openspec from the install, no `language` option is set in the config dir used, and the reply is in Portuguese with no `${user_config` |
| R11 | a plan file edited after the first tick, and a tick alone | implementer (loop commands, rule 3: the edit, the re-review's `readiness.md` and `approval.md` by the fixture script) | `r11-*.txt` | edit: `next` hands the readiness review, then after the re-review `waiting-approval-again` with `detail.plan`; tick: the implementation goes on |
| R11b | a merge-defect fix after the start (D-7): a scratch project whose change is approved with a `- Plan:` line and has a ticked task, its branch merged with a base whose main spec gained a scenario in a requirement the change's delta modifies, so the real `openspec validate --strict` of `merge-check` is red ("MODIFIED ... omits scenario(s) the current spec still has"); the fixture script then writes the planner's fix (the base's scenario copied into the delta); then the same with an approval holding no `- Plan:` line | implementer (loop commands and the real `openspec` CLI, rule 3: the fix and the re-review by the fixture script) | `r11b-*.txt` | with `- Plan:`: `merge-check` exits 0 recording `red`, `next` gives the `merge-defect` hand-off, after the fix `next` hands the readiness reviewer "out of date" (not `merge-check`), and after the re-review `waiting-approval-again` with `detail.plan`; without `- Plan:`: after the fix `next` gives `merge-check` again and, green, the delivery goes on |
| R15 | the same plan edit on the CompozyOS driver's own commands (AC-8 on the second driver) | implementer (loop commands, rule 3: no CompozyOS binary, the view and the record step are scripts) | `r15-*.txt` | after the edit `next --view compozy` hands the readiness reviewer ("out of date"); after the re-review by the fixture script it is the `approval` view; `record-approval --words go` writes an `approval.md` whose `- Plan:` line equals `planDigest` of the folder and whose other lines are the form of the `ship-change` row; after a tick alone the view is the implementation again |
| R12 | the verifier's own run writes under `proof/` and is refused elsewhere | **pr-verifier** in this change's evidence stage | `proof/ver-*` and the hook log | its files under `proof/` exist; its write to any plan file is refused |
| R13a | a run ending waiting on GitHub, the session's host instructions naming a pull-request monitor and forbidding polling | implementer (`claude -p --append-system-prompt "<the host text, in r13a-host.txt>"`, fake `gh`) | `r13a-*.jsonl`, `r13a-host.txt` | no Bash call whose command holds `change-loop.mjs wait`; the last assistant message holds the reply and names the monitor; the result event ends the turn |
| R13b | the same project and run without the host text | implementer (`claude -p`, fake `gh`) | `r13b-*.jsonl` | a Bash call with `run_in_background: true` whose command holds `change-loop.mjs wait --change <id>` |
| R14 | a real `tdd-implementer` subagent told to run `change-loop.mjs declare <id> review-round --param words=x` | implementer (`claude -p`, the Agent tool, rule 2) | `r14-*.jsonl`, `r14-hooklog.jsonl` | the subagent's Bash call is refused naming the main session; no `declared.json` is written |
| R16 | AC-17 on the real repository: `change-loop.mjs next --change archive-release-pin --lang en` run from this worktree's root, first with `origin/main`'s hooks (extracted by `git archive origin/main plugins/openspec` into the scratch run's folder), then with this worktree's. `archive-release-pin` waits on this change for its own archive (the conducting session's input of 2026-11-24), so it is merged and not archived when 6.4 runs; if it was archived anyway, the run stops and is reported, and the plan is revised | implementer (loop commands, read-only on GitHub; rule 4: output to files, checked with `grep -c`) | `r16-before.txt`, `r16-after.txt` | before: no retro step and the answer that the change has no pull request; after: the action is the retro (or the post-merge row the delivery gives) naming pull request 107 |
| R17 | AC-18: a scratch project (fake `gh`, real git, no train setting) whose change's pull request merged with a merge commit and every task ticked, its evidence and reviews recorded at the reviewed head, `origin/main` holding a later base commit touching `src/a.ts`; the change's own branch advanced with `git merge --ff-only origin/main`, its change folder clean (every file of it committed, so neither `commit` row of `nextStep` answers first); `next` with `origin/main`'s hooks, then with this worktree's; then one commit outside `openspec/` on the advanced branch and `next` again | implementer (loop commands, rule 3) | `r17-before.txt`, `r17-after.txt`, `r17-own-commit.txt` | before: a `verify` or `review` step (the defect); after: the retro, no reviewer hand-off; with the own commit: the walk judges staleness again (a `verify` or `review` step) |

Which tasks are the conducting session's: 4.1 (R10), 6.3 (R6, R7, R7b) and the fetch of `origin/main`
before each phase that opens with a merge (D-17) and before 6.1. This `tasks.md` is written before the `Conductor:` marker exists (D-6), so 4.1 and 6.3 are
ordinary tasks that the intro of `tasks.md` names: the conducting session does 4.1 and ticks it before it
hands phase 4 (it needs nothing this change builds, so it may run earlier), and says in that hand-off
that it is done. In phase 6, the implementer does 6.1 and 6.2 and stops before 6.3, reporting it
without doing it; the conducting session then does 6.3 on the merged head, ticks it, and hands phase 6
again for 6.4 and 6.5. An implementer that meets 4.1 or 6.3 open stops before it and reports it,
returning success for the tasks before it. The language sentence of `docs/openspec-flow.md` is written
by the implementer in 4.6 from R10's recorded line, so nothing is written before its evidence exists.
R13a and R13b are the implementer's (a `claude -p` run can carry host instructions); the half of
AC-11 no run here can show is carried by task 6.5 (D-10). The verifier records R6, R7 and R7b from
their files under `proof/` and never runs a `declare` itself (its own would be refused as any
subagent's); a declaring case it wants to see again goes through a nested `claude -p` (rule 2). The
conducting session's own part of this change's delivery (its declared ends, if any are met) is
recorded by the verifier from the session's commits and `declared.json`, if one exists.

## D-15 Existing tests that pin the rules this change replaces

Searched in every `*.test.mjs` of the suite's four folders on c09860c (ADR 0026): under
`plugins/openspec/hooks/` the files `guard`, `change-loop`, `change-loop-compozy`, `change-loop-remote`,
`change-loop-remote-state`, `deliver-check`, `deliver-check-archive`, `deliver-check-cli`, `flow-check`,
`conduct-check`, `project-loop`, `roadmap-loop`, `roadmap-loop-followups`, `roadmap-loop-upfront`,
`delivery-models`, `delivery-train`, `delivery-train-after`, `version-pin`, `stage-models`,
`compozy-driver`, `release-tags`, `release-merge`, `merge-setup`, `jira-task`, `test-suite` and `test-tmp`
(each `<name>.test.mjs`), and
`review-round.test.mjs`, `github-setup.test.mjs`, `changes-under-way.test.mjs`, `gen-agents.test.mjs`,
`adoption.test.mjs`, `loop-templates.test.mjs`, `devkit-kit.test.mjs` and `install-kit.test.mjs`, for
`failures` and `failuresInARow`, `merge-defect` and `merge-check`, `planDirty` and `folderDirty`, a `devkit:`
block written in a change's `.openspec.yaml`, `budget`, `models:`, `parseDevkitBlock`, the live
`openspec/roadmap.md` read with `- [ ]` or `done`, and for "round 2", "/2", "of 2",
"1 or 2", `stop-review-deadlock`, `ceiling`, `ceiling-reached`, `tests-red`, the started exemption,
`stale-plan`, `END_OF_KEY`, `GATE_OF_WHY`, "only writes its own", "only file you write", `ATTRIBUTION_ASK ?? `,
`Attribution below`, `approvalState`, `approvalText`, `record-approval`, `resolve-release-conflict`,
"conflict in", `blocked: item 5`, `stop-archive`, the names of the two agent files this change edits,
`SKILL_LOOP_STEPS`, and the callers of the functions this change rewrites (`'reply'` given to either loop's
`main`, `--stdin`, `findChangePr`, `PACKS`, `shipConfig`). `scripts/check.py` has no tests of its own; `gen-agents.mjs --check` is a CI step.
Tests are named here by their title and the file that holds them on c09860c, never by their line, so the
list holds when the base moves; a later split moves a test to `<name>-<part>.test.mjs` with its title
unchanged, and the implementer finds it with `grep -ln "<title>" plugins/*/hooks/*.test.mjs
plugins/*/skills/*/scripts/*.test.mjs`. Before each gate the implementer also runs by name the tests that
`origin/main` added since the plan's base (D-17, `CONTRIBUTING.md`).

| Test (file) | Rule it pins | Fate | Task |
|---|---|---|---|
| `roadmap-loop replies: every owner wait has a gate` (roadmap-loop.test.mjs) | the exact set of `waiting-` keys and gates | updated: gains `waiting-pause: pause`, `waiting-owner-decision: decision` | 1.1, 1.4 |
| `change-loop skill: an end the session declares goes through reply, and the marker lines are never shown (F1)` (change-loop-compozy.test.mjs) | the sentence "An end the session declares itself (a red gate, a pull-request decision left to the owner) goes through `reply`", the two keys `reply blocked --param id=<id> --param why=tests-red` and `reply waiting-pr-decision --param id=<id>`, and no `why=role-failed` in the Loop | updated: the regex follows the new sentence (four reply keys, `declare`); the two keys and the `role-failed` negative stay as they are (the `tests-red` key is the exit-3 fallback, and no Loop item this change adds declares `role-failed`, D-5) | 1.1, 1.5 |
| `change-loop replies: no internal term in either language` (change-loop.test.mjs, where `SAMPLE` lives) | every key renders from `SAMPLE` with no placeholder left | updated: `SAMPLE` gains `decision: 'the dependency upgrade'` (D-1, the parameter name); the test body is unchanged | 1.1, 1.2 |
| `change-loop reply: renders a key in both languages and an unknown key exits 3` and `change-loop reply: the keys that end the run print the end line first, every other key the reply alone` (change-loop.test.mjs) | rule: the reply's end line (`runReply` prints `devkit-end: <id> <state>` first for a key that ends the run, the reply alone for any other key, exit 3 for an unknown key) | kept: `declaredStep` prints the same line for every `reply` row of `DECLARED`, and a key outside the table renders as today (D-1) | 1.2 |
| the five `jira-entry-followups AC-8` tests of `reply --stdin` and of `reply` without it (change-loop-remote-state.test.mjs), among them `jira-entry-followups AC-8 reply --stdin refuses an empty input, a duplicate name, a bad name and no name` and `jira-entry-followups AC-8 reply without --stdin reads no standard input` | rule: `--stdin <name>` (`runReply` reads one parameter from standard input, byte for byte but one final line break, refuses a bad or a missing name, and reads nothing without the option) | kept: `runReply` keeps its arguments and `declaredStep` keeps every option it has, `--stdin <name>` among them (D-1) | 1.2 |
| `upfront AC-8 skill: after a merge-base exit 3 the change session declares the end blocked with base-conflict and ends the run` (roadmap-loop-upfront.test.mjs) | rule: the reply's end line for `reply blocked ... why=base-conflict` (`devkit-end: <id> blocked` first), and the sentence of item 3 of the `devkit-session` skill's `## Loop` that names it | kept: the `blocked` row prints the same line (D-1); D-10 adds a clause to that item and keeps the sentence the test matches | 1.2, 4.5 |
| `roadmap-loop reply: an end key records declared and prints the end line first; the draft-declined key prints the reply alone` (roadmap-loop.test.mjs) and `followups AC-4 reply: an end declared for an id that is not a change id exits 3 and records nothing` (roadmap-loop-followups.test.mjs) | rule: the reply's end line and record (`roadmap-loop.mjs reply` prints the end line first and records `run.declared[id]` for a key that ends the run, records nothing for a bad id, exit 3) | kept: `replyCmd` reads its end and gate from `DECLARED` with the same record for `blocked` and `waiting-pr-decision` (the `gate: 'decision'` it writes today is that row's gate, D-1) | 1.4 |
| `sanitize drops heredoc bodies and quoted text` and every `bash(...)` heredoc test (guard.test.mjs) | heredoc bodies and quoted text are not commands | kept: `sanitize`'s output is unchanged after `withoutHeredocs` is split out | 1.3 |
| `approval.md: only the main session writes it, by Write and by shell redirect (D7)`, `approval.md: main-session only even with several active changes or in another change folder (D7)` and `upfront AC-6 guard: approval.md refuses a write by devkit-core:requirements-triage` (guard.test.mjs), which match `approval\.md is written only by the main session, from the owner's own message; not by` | the approval file's writer and message | kept: the message gains the path before `approval.md` and keeps the rest | 1.3 |
| `change-loop skill: the release-conflict sentence` (change-loop-compozy.test.mjs) | "`Outcome: failure` goes back to `next`, as for any agent" | kept: AC-3 is dropped, so the `resolve-release-conflict` and `renumber-adr` items are not edited, and the new `resolve-base-conflict` item uses the same sentence | 1.5, 2.4 |
| `change-loop lock stop: T3a ...` (change-loop.test.mjs) | an end the session declared lets the stop through | kept: every case names the run's change | 1.3 |
| `change-state AC-3 state: each end waiting for the owner ...` (change-loop-remote-state.test.mjs) | a subset of `GATE_OF_WHY` | kept | 1.2 |
| `nextStep row 7: FAIL (round 2/2) ...`, `nextStep row 9 ...`, `D2: a round-2 deadlock stays first, with the evidence missing`, `resume: a round-2 deadlock on disk ...`, `AC-3 fix-restales-both (a) ...` and the other tests that read the round limit (found by `grep -n "round 2\|/2" plugins/openspec/hooks/deliver-check.test.mjs`) (deliver-check.test.mjs); `rejectedLoop` and `review-openspec-fix 14` to `17` (deliver-check-archive.test.mjs) | deadlock after round 2, round 2 after round 1 | kept: limit 2 with no record | 2.3 |
| `delivery-models P7 T8 ...` and the resolution tests of delivery-models.test.mjs (`grep -n "round 2\|resolution"`) | the resolution's deadlock after round 2 | kept: with no `resolution`-scope record the limit is 2, the `why` text still says "after round 2" and the deadlock's detail is unchanged | 2.3 |
| `conduct: deliveryStep maps every deliver-check step ...` (conduct-check.test.mjs) | `stop-review-deadlock` state text; every step has an actor | kept; `conductor-task` and `resolve-base-conflict` get actors | 2.4, 3.2 |
| the validation test listing `{ ...ok, round: 3 }` as invalid and the texts `(round 2/2)`, `deadlock after round 2`, `(round 1/2)` (review-round.test.mjs) | two rounds | kept: no `limit` means 2 | 2.3 |
| `change-loop decide: B10 a review deadlock waits for the owner` (change-loop.test.mjs) | the dispute reply equals the rendered key | kept: re-rendered from the reworded key | 2.3 |
| `change-loop decide: the B rows are exactly the steps the checkers can return` and `change-loop decide: the loop's step agents match conduct-check's actorOf` (change-loop.test.mjs) | every returnable step has a row, and agents agree | kept; pass once `ROWS`, `SUBAGENT`, `MAIN` gain the two steps | 2.4, 3.2 |
| `format: ship-change names every next.step the checker can return` (deliver-check-cli.test.mjs) | a ship-change row per emitted step | kept; passes with the `conductor-task` row | 3.3 |
| `stop-plan-approval: a change with a ticked task keeps running without approval.md (the started exemption)` (deliver-check.test.mjs) | no approval asked once started | kept: no approval.md means no recorded plan | 3.4 |
| `stop-plan-approval: APPROVED readiness with no approval.md ...` and `approvalState: no file, a current file and a stale file` (deliver-check.test.mjs) | `approvalState`'s shape | kept: the shape does not change (`planRevision` is apart) | 3.4 |
| `flow-check stages: ticking tasks after the plan review does not make the plan stale` (flow-check.test.mjs) | a tick is no plan edit | kept | 3.5 |
| `post-merge-validate 2: a plan edit made as a merge-defect fix leaves the plan gate where an ordinary design edit does` (change-loop.test.mjs) | a merge-defect fix and a design edit give the same readiness and approval states, both passed, with `approvalState` ok | kept: its fixture's `approval.md` holds no `- Plan:` line, so D-7 asks nothing in either case; the invariant "the same answer as an ordinary plan edit" is also pinned with a digest by T133 (D-7) | 3.5 |
| `review-openspec-fix 12: a plan fix written and not committed ...`, `jira-entry-followups AC-3 a plan fix edited after a rejecting round is handed to commit, not fix-review`, `jira-entry-followups AC-4 ...` and `loop-evidence 1: a dirty change folder before review answers commit with no paths` with the other `folderDirty` tests (deliver-check-archive.test.mjs) | an uncommitted plan fix goes to `commit` before `fix-review`; a dirty change folder goes to `commit` before a review round | kept: `planDirty` leaves out only `declared.json`, which none of them writes, and `folderDirty` is unchanged (D-1) | 2.3 |
| `parseTasks: only a description that starts with Gate: is a gate ...` (deliver-check.test.mjs) and `review-writer-prompt AC-9 parseTasks ...` (deliver-check-archive.test.mjs) | the fields they map | kept: the new field is not mapped | 3.2 |
| `evidence.md is written only by pr-verifier` (guard.test.mjs) | evidence's writer | kept | 4.3 |
| `change-loop skill: the wait is started in the background on a GitHub wait` (change-loop-compozy.test.mjs) | the background wait | kept: the first paragraph is unchanged | 4.5 |
| `project-settings: PACKS equals the plugin names in marketplace.json` (plugins/openspec/skills/openspec-setup/scripts/project-settings.test.mjs) | rule: `PACKS` names the marketplace's plugins | kept: D-9 moves `PACKS` above `AGENT` and changes no entry | 4.4 |
| `commit-attribution AC-1 T25 ...` (project-loop.test.mjs) | the negative with `?? '\u0000'` | updated (D-13) | 5.2 |
| `commit-attribution AC-2 T31 ...` (deliver-check-archive.test.mjs) | the count of `Attribution below` | updated (D-13) | 5.3 |
| roadmap tests with `tests-red` (roadmap-loop.test.mjs, roadmap-loop-followups.test.mjs, roadmap-loop-upfront.test.mjs, change-loop-remote-state.test.mjs; `grep -ln "tests-red" plugins/openspec/hooks/*.test.mjs`) | a declared blocked end of a red gate | kept: `roadmap-loop.mjs reply blocked` still records it; the reply tests of the rows above run in phase 1, which edits `replyCmd`; no phase edits a `tests-red` text or other roadmap code, so the others run on the delivery train's whole suite | the train |
| `flow-check stages: a failed stage past its ceiling ends blocked` (flow-check.test.mjs) | `review` failed at attempt 2 ends blocked `ceiling-reached` `{ stage: 'review', attempt: 2, failures: 2, ceiling: 2 }`; at attempt 1 no end | kept: its synthetic facts carry no `authorizedReviewRounds`, so `ceilingOf` gives 2, and `failures` is the sibling's count, unchanged (D-4) | 2.3 |
| `flow-check stages: a failed header does not pass its stage` (`{ attempt: 1, failures: 1, ceiling: 2 }`) and `flow-check stages: a failed stage offers its fix, then itself after the fix` (`{ failed: 'review', attempt: 1, failures: 1, ceiling: 2 }`) (flow-check.test.mjs) | the review's ceiling in the reason's parameters | kept: no record, ceiling 2 | 2.3 |
| every `stage-ceiling-consecutive` test (flow-check.test.mjs: `AC-1` to `AC-7`, `failuresInARow ...`, `the history is read only ...`, `the readout says ...`; change-loop.test.mjs, change-loop-compozy.test.mjs and project-loop.test.mjs: the `AC-6` loop and reply tests) | the failures in a row, read from git, are the left side of the ceiling comparison, and the replies and briefs say them | kept: D-4 changes only the right side, and only for the `review` stage of role `review-bench` with a record; none of these fixtures writes `declared.json` | 2.3 |
| the `liveChange` test (`review: 'failed', reviewAttempt: 2` exits 2) (flow-check.test.mjs) | the CLI exit of a review at its ceiling | kept: its fixture writes no `declared.json` | 2.3 |
| `flow-check readout: both languages cover every reason code` (flow-check.test.mjs, the `ceiling-reached` and `header-failed` parameters) | every reason code is said in both languages | kept: no reason code is added or renamed for the ceiling | 2.3 |
| `stage-roles flow owner: a mock-up sent back at attempt 3 and at attempt 40 is never blocked by a ceiling` (flow-check.test.mjs: "a numeric ceiling still blocks") | a numeric ceiling still blocks the review | kept: no record | 2.3 |
| `version-pin AC-2 readout: the version-1 ceiling holds after the upgrade` and `version-pin AC-3 readout: the version-2 ceiling blocks` (version-pin.test.mjs) | the pinned flow's `review` ceiling (2, or 1 in the synthetic version 2) | kept: no record, so `ceilingOf` is the pinned flow's own ceiling | 2.3 |
| `change-loop decide: P9 a ceiling and the other blocked ends of the plan` (change-loop.test.mjs) and the `ceilingFixture` tests of roadmap-loop.test.mjs | a readiness at its ceiling ends blocked `ceiling` | kept: the readiness is never lifted (`ceilingOf` lifts only the `review` stage of role `review-bench`) | 2.3 |
| `change-loop compozy view: every hand-off step of the delivery rows carries its dispatch sentence, from the table the loop itself reads` (change-loop-compozy.test.mjs) | the exact set of hand-off steps (`deepEqual` of `handOffs` against `expected`), a `ship-change` row for each step that is not in `SKILL_LOOP_STEPS`, and one dispatch source per step | updated: `expected` gains `resolve-base-conflict` (the other two lists of the test are unchanged, because `resolve-base-conflict` stays out of `SKILL_LOOP_STEPS`, D-5, and its `ship-change` row is the source the test then requires); the invariant is "the table's hand-offs are the delivery rows' agent steps, each with one dispatch source" | 2.1, 2.4 |
| `conduct: a conflict that also has README.md is blocked, and an independent change in the round is still dispatched` (conduct-check.test.mjs) | a conflict outside the release files is a blocked row | updated: the row is `resolve-base-conflict` (actor `subagent`, `others` `['README.md']`, `paths` both files), and the independent change is still dispatched; the list `res.dispatch` is recomputed for the new row | 2.1, 2.4 |
| `conduct: an archive PR in conflict only in release files is resolve-release-conflict; a README conflict is blocked (P3b)` (conduct-check.test.mjs) | the same, for an archive's pull request | updated: the README half gives `resolve-base-conflict` with `archive: true` (the release-files half is kept) | 2.1, 2.4 |
| `conduct pin: both sides editing one paragraph of docs/openspec-flow.md is blocked (AC-2)` and `conduct pin: an archive PR conflicting in the CI pin only is resolve-release-conflict, beyond the pin it is blocked (AC-3)` (conduct-check.test.mjs) | a conflict in the CI-pin file beyond its pins is blocked | updated: each gives `resolve-base-conflict` with the pin file in `others` (the pin-only half of AC-3 is kept) | 2.1, 2.4 |
| `change-loop next: a pull request conflicting in another file ends blocked as a pull request problem` (change-loop.test.mjs) | `next` through `deliveryRow` ends blocked `pr-problem` for a conflict in `README.md` | updated: `next` gives the `agent` action `resolve-base-conflict` for `devkit-core:tdd-implementer`, exit 0; the invariant is "a conflict outside the release files is a declared hand-off, not a blocked end" | 2.1, 2.4 |
| `change-loop decide: B1a a conflict elsewhere ends blocked, a clean merge in merge mode is the session step update-branch` (change-loop.test.mjs) | `decide` ends blocked on a `blocked` row of item 5 | kept: it builds the `blocked` row itself, which the delivery checker and the override still give when git cannot classify the conflict | 2.4 |
| tests of an archive that left a train (`rejoin-archive`, `train-left`) and of the rows `rejoin-train` and `stop-archive` (delivery-train.test.mjs, delivery-train-after.test.mjs; `grep -ln "rejoin-archive\|train-left\|rejoin-train" plugins/openspec/hooks/*.test.mjs`) | `trainRejoin`'s steps and its blocked end, and the change's own `rejoin-train` | kept: `releaseConflict` returns null for both, `trainRejoin` is not edited | 2.4 |
| `change-loop compozy record-approval: it writes approval.md in the form of the ship-change row, and approvalState reads it back as ok` (change-loop-compozy.test.mjs) | the exact text of the CompozyOS driver's `approval.md` | updated: the expected text gains the line `- Plan: <planDigest of the folder>` after `- Readiness:`; the invariant is "the driver writes the form of the `stop-plan-approval` row" | 3.1, 3.5 |
| `change-loop compozy record-approval: words over 200 characters are cut, and a replaced approval raises the attempt` and `change-loop compozy record-approval: refused while the readiness review is due, with approval.md absent or unchanged` (change-loop-compozy.test.mjs) | the cut of the words, the attempt, and the refusal that leaves the file byte for byte | kept: neither reads the new line | 3.5 |
| `stage-roles roles verifier: pr-verifier records text, takes no screenshot and posts no pull-request comment` (change-loop-compozy.test.mjs) and `delivery-train docs: pr-verifier leaves the parts the train proves to the train, and a change that edits the key runs every part` (delivery-train-after.test.mjs) | sentences of `pr-verifier.md` | kept: the `proof/` sentence of D-8 holds no "screenshot" and no `gh pr comment`, and the sentences they match are not edited | 4.3 |
| `compozy-agents check: the repository is up to date`, `compozy-agents seat: ...` (gen-agents.test.mjs) | the kit's agents are the generator's output, and each seat names its Claude agent | kept: they go red until the kit is regenerated and pass after it (D-19) | 3.3, 4.3 |
| `AC-9 repo-adopts: the ${role} agent is the shipped template, byte for byte` for `tdd-implementer` and `pr-verifier` (one test per role), and `AC-9 repo-adopts: the manifest records this repository's three inputs and a digest for every kit file, and none for a retired one` (adoption.test.mjs) | this repository's `.compozy/` equals the rendered templates, and the manifest names every kit file | kept: they go red until `.compozy/` is installed again from the regenerated templates (D-19) | 3.3, 4.3, 6.2 |
| `field-fixes 4 delivered: isArchiveHead is true for every change's archive head and for nothing else`, `field-fixes 4 delivered: isOwnPr needs a file of the change folder, no file of its own archive folder and no archive head`, `field-fixes 4 own archive 4: an archive head is refused whatever its files` and the other `field-fixes 4` tests of `findChangePr` (deliver-check-archive.test.mjs) | every `chore/archive-` and `archive-` head is an archive head; such a head is never a change's own pull request | kept: `isArchiveHead` is unchanged and every head these tests give differs from the id they test (D-20) | 3.7 |
| `delivery-train P3 isOwnPr: a train/<n> head is never a change's own pull request, whatever files it changes` (delivery-train-after.test.mjs) | a train head is never own | kept: the `TRAIN_BRANCH` line of `isOwnPr` is not edited | 3.7 |
| the `delivery-train P3 delivered` tests (delivery-train-after.test.mjs), among them `delivery-train P3 delivered: looked up from the default branch, the train's merged pull request is not the change's own` | rule: `findChangePr`'s merged-list search finds the change's own merged pull request and never a train's | kept: the merged-list filter changes only for a head equal to the change's own id (`foreignArchiveHead`, D-20), and no head these tests give equals it | 3.7 |
| `flow-check delivery: after a squash merge the walk resumes at the retro`, `flow-check stages: after a merged pull request a newer plan file does not make a stage stale`, `field-fixes 4 delivered: a merged pull request with tasks left is not delivered; ...` and `field-fixes 4 delivered: a pull request that only links the evidence does not switch to the walk after the merge` (flow-check.test.mjs) | the walk after the merge off the own branch, and no switch for a change not delivered | kept: `offOwnBranch` still switches; the new arm needs the head in the base and a delivered change (D-21) | 3.8 |
| the `own-files` tests (deliver-check.test.mjs, flow-check.test.mjs, delivery-train-after.test.mjs; `grep -ln "own-files" plugins/openspec/hooks/*.test.mjs`) | ADR 0025's rule, `ownFiles` null when the head is in the base | kept: `ownFiles` reads `headInBase` with the same result (T126) | 3.8 |
| the `change-budget` tests (change-loop-remote-state.test.mjs), `jira-entry AC-6 next carries the task but no writeBack on a budget end held at the pull request` (change-loop-remote.test.mjs), `upfront budget session-next: ...` (roadmap-loop-followups.test.mjs), the `stage-models` tests that write a change's table (stage-models.test.mjs) and `version-pin AC-1 writePin: the change budget block and the pin live in one .openspec.yaml` (version-pin.test.mjs) | a change's `budget` and `models:` in a `devkit:` block of its `.openspec.yaml` | kept: a file with no `x-devkit:` block is still read from its `devkit:` block (D-22) | 5.5 |
| `change-budget AC-10 docs/openspec-flow.md describes the budget` (change-loop-remote-state.test.mjs), `stage-models AC-1 the flow document says what the model of each stage is: ...`, `stage-models AC-2 the settings comment names the optional models table and the ADRs line names 0023` and `stage-models AC-2 the coordination design names devkit.models as final, decided by stage-models` (stage-models.test.mjs) | the words of the two paragraphs, the config comment and the coordination design | kept: D-22 keeps every word they match (`budget:`, `.openspec.yaml`, `models:`, the project's `devkit:` block, "final") | 5.6 |
| `change-loop settings: shipConfig of deliver-check gives the same with and without the block` (change-loop.test.mjs) | rule: `parseDevkitBlock` of `openspec/config.yaml` read with and without a `devkit:` block | kept: its second argument defaults to `devkit` (D-22) | 5.5 |
| `delivery-train config: deliverySettings keeps its shape with a train set` (delivery-train.test.mjs), `release-tags 1: a release_tag followed by indented lines is unset ...` (release-tags.test.mjs), `delivery-models config: ...` (delivery-models.test.mjs) and the `parseDevkitBlock` tests of guard.test.mjs | `parseDevkitBlock` of `openspec/config.yaml` | kept: its second argument defaults to `devkit`, so every caller reads as today (D-22) | 5.5 |
| `post-merge-validate 3: the roadmap line names the merge check and the sibling that counts evidence attempts, and stays unticked` (change-loop.test.mjs), if still present on the base when phase 5 runs (that change's own archive, due in the next train, may fix it first) | invariant: the roadmap line of `post-merge-validate` names the merge check and its sibling; layer: the roadmap document, read as text; suite: change-loop.test.mjs | updated (D-23): its title ends "whatever its tick" in place of "and stays unticked", it finds the line by `/^- \[[ xX]\] post-merge-validate/`, makes no assertion on the tick, and runs its text assertions on the live roadmap and on a copy with that line ticked | 5.8 |
| `jira-entry AC-10 the roadmap has the live-proof follow-up after jira-entry` (change-loop-remote-state.test.mjs) | invariant: Round 20b, after Round 20, holds the `jira-entry-live` line after `jira-entry`; layer: the roadmap document, read by `parseRoadmap` (`guard.mjs`); suite: change-loop-remote-state.test.mjs | updated (D-23): it finds the line by `/^- \[[ xX]\] jira-entry-live \(after: jira-entry\)/` and asserts `{ id, after }` of `parseRoadmap`, never `done`, on the live roadmap and on a copy with that line ticked | 5.8 |
| `stage-roles docs: the roadmap line of stage-roles keeps its text, and every carried item moved to coordinator-loop-fixes` (change-loop-compozy.test.mjs) | invariant: the stage-roles line keeps its text without the carried items, which the coordinator-loop-fixes line holds; layer: the roadmap document, read by `parseRoadmap`; suite: change-loop-compozy.test.mjs | updated (D-23): it already holds the old line as a constant and makes no assertion on the tick; it runs its assertions on the live roadmap and on a copy with the `stage-roles` and `coordinator-loop-fixes` lines ticked, so this change's own archive leaves it green | 5.8 |
| `compozy-driver`, `loop-templates`, `devkit-kit`, `install-kit`, `release-tags`, `release-merge`, `merge-setup`, `jira-task`, `change-loop-remote` and `test-suite` suites (but the tests named above) | the driver's calls, the three loops, the resolver, the installer, the tag step, the release merge, the merge setup, the Jira task, the remote runs and the suite script | kept: searched for the texts this change replaces, none found; they run on the delivery train's whole suite | the train |

## D-16 New tests

Every new test's name starts `coordinator-loop-fixes AC-<n> T<k> `. "Loop CLI" tests call `main` of
`change-loop.mjs` (or `roadmap-loop.mjs`) on a fixture project built by the existing helpers;
"hook" tests run `guard.mjs` on a transcript fixture; "checker" tests call the exported function.

**The new file.** The loop-level tests (loop CLI, stop hook on a transcript, `decide`, skill and document
text, the CompozyOS view and record step, and the few roadmap, project-loop and `two-prs` tests that call
the loops) go to `plugins/openspec/hooks/change-loop-declared.test.mjs`, a new file: the files that held
such tests run near or above CONTRIBUTING's 300 s (Context), and ADR 0026 splits a file above it. The new
file imports what it needs from `change-loop-fixtures.mjs`, `roadmap-loop-fixtures.mjs`,
`deliver-check-fixtures.mjs` and `test-fixtures.mjs` (`deliveredChange`, `next`, `parsed`, `runTranscript`,
`hook`, `skillText`, `section`, `cleanEnv`, `TWO_PRS`, ...), never from a test file (the suite script refuses
that), makes its module-level fixtures at module level and its folders through `test-tmp.mjs`, and reads
the modules under test through namespace imports (`import * as CL from './change-loop.mjs'`, likewise `DC`,
`FC`, `GUARD`, `RL`, `PL`), so it loads before an export it tests exists. A helper this file needs that no
fixtures module exports yet is moved (not copied) from the test file that has it into that file's
fixtures module, with no test renamed. The other new tests go to the file of their area, each under
300 s (`guard.test.mjs`, `deliver-check.test.mjs`, `flow-check.test.mjs`, `conduct-check.test.mjs`,
`delivery-models.test.mjs`, `review-round.test.mjs`, `github-setup.test.mjs`). Before each phase gate the
implementer runs every file the phase added tests to alone, `node scripts/test-suite.mjs --concurrency=2 <file>`,
and a file whose summary time passes about 300 s is split by CONTRIBUTING's rule before the gate.

| T | AC | Invariant | Layer | Suite |
|---|---|---|---|---|
| T1 | 1 | `reply waiting-pause --param id=feat` prints `devkit-end: feat waiting-for-owner` first, then the reply, in en and pt-BR, exit 0 | loop CLI | change-loop-declared.test.mjs |
| T2 | 1 | `reply waiting-owner-decision --param id=feat --param decision="the dependency upgrade"` the same, the reply holds `the dependency upgrade` in both languages; without `decision` it exits 3 naming the parameter | loop CLI | change-loop-declared.test.mjs |
| T3 | 1 | stop allowed after the T1 output in a run with a stage ready (pause) | hook | change-loop-declared.test.mjs |
| T4 | 1 | stop allowed after the T2 output (decision outside the gates) | hook | change-loop-declared.test.mjs |
| T5 | 1 | the same transcript without either output: stop refused, `stage-ready` | hook | change-loop-declared.test.mjs |
| T6 | 1 | `changeState` of a declared `waiting-pause` reads waiting for the owner with `gate.pause`; of `waiting-owner-decision` with `gate.decision` | state | change-loop-declared.test.mjs |
| T7 | 1 | `roadmap-loop.mjs reply waiting-pause` records `declared[id] = { state: 'waiting-for-owner', why: 'waiting-pause', params.gate: 'pause' }` | loop CLI | change-loop-declared.test.mjs |
| T8 | 1 | the same for `waiting-owner-decision` with gate `decision`, and `waiting-pr-decision` still gate `decision` | loop CLI | change-loop-declared.test.mjs |
| T9 | 1 | `reply gate-red` and `reply review-round` exit 3 naming `declare`; `roadmap-loop.mjs reply gate-red` exits 3 | loop CLI | change-loop-declared.test.mjs |
| T10 | 1 | `declare feat waiting-pause` and `declare feat no-such-key` are usage errors (exit 3) | loop CLI | change-loop-declared.test.mjs |
| T11 | 1 | a key outside `DECLARED` (`waiting-merge`) prints no marker | loop CLI | change-loop-declared.test.mjs |
| T12 | 1 | the devkit skill's Loop names `reply waiting-pause --param id=<id>` and `reply waiting-owner-decision --param id=<id> --param decision=`, the roadmap item 3 names both with `roadmap-loop.mjs`, and neither skill passes `--param what=` to `waiting-owner-decision` | skill text | change-loop-declared.test.mjs |
| T13 | 1 | `readDeclared`: missing file gives no steps and no error | checker | deliver-check.test.mjs |
| T14 | 1 | `readDeclared`: empty file gives an error | checker | deliver-check.test.mjs |
| T15 | 1 | `readDeclared`: unparsable JSON, a non-object, version 2, a non-array `steps` each give an error | checker | deliver-check.test.mjs |
| T16 | 1 | `readDeclared`: an entry with an unknown key is skipped, the others kept | checker | deliver-check.test.mjs |
| T17 | 1 | `declare` on an unreadable record exits 3 with `declare-unreadable` and leaves the file byte for byte | loop CLI | change-loop-declared.test.mjs |
| T18 | 1 | a subagent (`tdd-implementer`) write of the active change's `declared.json` is refused, by edit and by shell redirect, the message naming the main session and `change-loop.mjs declare` | hook | guard.test.mjs |
| T19 | 1 | the main session's write of `declared.json` is allowed | hook | guard.test.mjs |
| T20 | 2 | `runOf`: an end line naming the run's change sets `ended` | guard reader | guard.test.mjs |
| T21 | 2 | `runOf`: an end line naming another change leaves `ended` null | guard reader | guard.test.mjs |
| T22 | 2 | stop hook: run `feat`, end `other` and a stage ready: refused | hook | change-loop-declared.test.mjs |
| T23 | 2 | stop hook: run `feat`, end `feat`: allowed | hook | change-loop-declared.test.mjs |
| T24 | 3 | dropped with AC-3 (covered by main, `requirements.md`); no test is written under this number | — | — |
| T25 | 10 | first red: `declare feat gate-red --param phase=1` at the phase 1 gate prints `devkit-run: feat`, an `agent` action to `devkit-core:tdd-implementer`, step `fix-gate`, detail `{ phase, task, command }`, no `devkit-end:`, exit 0, and the record holds one entry | loop CLI | change-loop-declared.test.mjs |
| T26 | 10 | second red of phase 1: `devkit-end: feat blocked`, `end.why` `tests-red`, `params.phase` 1, exit 2, two entries | loop CLI | change-loop-declared.test.mjs |
| T27 | 10 | with one red recorded, `next` at the gate still gives `gate`, never `fix-gate` | loop CLI | change-loop-declared.test.mjs |
| T28 | 10 | a red of phase 1 recorded, the first red of phase 2 gives `fix-gate` for phase 2 | loop CLI | change-loop-declared.test.mjs |
| T29 | 10 | `declare gate-red --param phase=2` while the next action is the phase 1 gate (or an agent step) exits 3, `declare-not-at-gate`, nothing recorded | loop CLI | change-loop-declared.test.mjs |
| T30 | 10 | stop hook after the first-red output with the fix not handed: refused; after the second-red output: allowed | hook | change-loop-declared.test.mjs |
| T31 | 10 | the skill's `gate` item names `declare <id> gate-red --param phase=<n>` and the exit-3 fallback; roadmap item 3 the same | skill text | change-loop-declared.test.mjs |
| T32 | 7 | `nextStep`: `FAIL (round 2/2)`, current rejected, `roundLimit` 3: `fix-review`, not the deadlock | checker | deliver-check.test.mjs |
| T33 | 7 | `nextStep`: limit 3, the rejected review stale after the fix, `review.md` at `FAIL (round 2/2)`: `review` round 3, `limit` 3 | checker | deliver-check.test.mjs |
| T34 | 7 | `nextStep`: limit 3, `FAIL (round 3/3)`, current rejected: `stop-review-deadlock` | checker | deliver-check.test.mjs |
| T35 | 7 | `nextStep`: no `roundLimit`, a `review` after round 1 carries no `limit` key | checker | deliver-check.test.mjs |
| T36 | 7 | the resolution path: `res.limit` 3 and a rejected round 2 give `fix-resolution`, then `review-resolution` round 3 with `limit` 3; `res.limit` 3 and a rejected round 3 the deadlock; no `res.limit` the deadlock after round 2 | checker | delivery-models.test.mjs |
| T37 | 7 | `collectState`: `roundLimit` is 2 with no record, 3 with one `review-round` entry of scope `review` or with no scope, 2 with only a `resolution` entry, 2 with an unreadable record | checker | deliver-check.test.mjs |
| T38 | 7 | `declare review-round --param words=...` at the code review's deadlock (the blocked `ceiling` end of the `review` stage, D-4): exit 0, `devkit-run:` line, the action is `fix-review`, `declared.reply` says round 3, one entry of scope `review` and round 3 with the words | loop CLI | change-loop-declared.test.mjs |
| T39 | 7 | without `words` (or empty): exit 3 `declare-no-words`, nothing recorded, `next` still the blocked `ceiling` end of `review` | loop CLI | change-loop-declared.test.mjs |
| T40 | 7 | away from the deadlock (an `implement` step), and a second `declare` right after T38's (the next action is `fix-review`): exit 3 `declare-not-at-deadlock`, nothing recorded | loop CLI | change-loop-declared.test.mjs |
| T41 | 7 | `validateArgs`: round 3 with limit 3 accepted | round script | review-round.test.mjs |
| T42 | 7 | `validateArgs`: round 4 with limit 3, limit 1, limit 2.5 and limit `'3'` refused | round script | review-round.test.mjs |
| T43 | 7 | the consolidated text with limit 3: `(round 3/3)`, `Consensus deadlock after round 3`, and the stage prompts `round 3 of 3` | round script | review-round.test.mjs |
| T44 | 7 | ship-change's `stop-review-deadlock` row and the devkit skill's Owner gates name `declare <id> review-round` and the owner's own typed message; the Owner gates name the `blocked` `ceiling` end of the `review` stage as the code review's deadlock; the `review` row passes `next.limit`; review-change's `args` names `limit` | skill text | change-loop-declared.test.mjs |
| T45 | 13 | a PR conflicting outside the release files: the row is `resolve-base-conflict`, actor `subagent` `devkit-core:tdd-implementer`, detail `paths`, `others`, `base`, `number` | checker (real git) | conduct-check.test.mjs |
| T46 | 13 | a conflict in release files and in another file: `resolve-base-conflict` with both in `paths` and only the other in `others` (`others` is `classifyConflict`'s `blocking`, so a CI-pin file git cannot merge would be in it too; this test uses an ordinary file) | checker (real git) | conduct-check.test.mjs |
| T47 | 13 | a conflict only in release files: still `resolve-release-conflict` | checker (real git) | conduct-check.test.mjs |
| T48 | 13 | an archive PR that never left a train, conflicting outside the release files: `resolve-base-conflict` with `archive: true` | checker (real git) | conduct-check.test.mjs |
| T49 | 13 | `decide` on a `resolve-base-conflict` row: an `agent` action to the implementer, stage implementation | loop | change-loop-declared.test.mjs |
| T50 | 13 | the `ship-change` row of `resolve-base-conflict` holds the merge sentence and "never push"; the `devkit` skill item names that row as the dispatch source and says "`Outcome: failure` goes back to `next`, as for any agent", with no `why=role-failed` | skill text | change-loop-declared.test.mjs |
| T51 | 8 | `planDigest`: ticking a task (`[x]`, `[X]`, `[ x]`) leaves it equal | checker | deliver-check.test.mjs |
| T52 | 8 | `planDigest`: an edit of `design.md`, of `proposal.md`, of a spec delta, and a new task line in `tasks.md` each change it | checker | deliver-check.test.mjs |
| T53 | 8 | `planDigest`: `evidence.md`, `review.md`, `reviews/x.md` and `declared.json` leave it equal | checker | deliver-check.test.mjs |
| T54 | 8 | `planDigest`: a missing `design.md` and an empty one differ; no `specs/` folder adds nothing | checker | deliver-check.test.mjs |
| T55 | 8 | `planRevision`: no `- Plan:` line gives `changed: false`; an equal one `false`; a different one `true` | checker | deliver-check.test.mjs |
| T56 | 8 | `nextStep`: started, approval not ok, `plan.changed`: `stop-plan-approval` with `detail.plan`; started, approval not ok, not changed: no stop | checker | deliver-check.test.mjs |
| T57 | 8 | flow-check: started, approval ok, plan changed: readiness `stale`, reason `plan-revised`, next stage readiness | stage checker | flow-check.test.mjs |
| T58 | 8 | flow-check: started, approval ok, only a tick since: readiness passed | stage checker | flow-check.test.mjs |
| T59 | 8 | flow-check: started, evidence written since: readiness passed | stage checker | flow-check.test.mjs |
| T60 | 8 | loop: the revised plan hands the readiness reviewer "out of date"; after its rewrite, `waiting-approval-again` with `detail.readiness` and `detail.plan` | loop | change-loop-declared.test.mjs |
| T61 | 8 | ship-change's `stop-plan-approval` row holds `- Plan: <next.plan>`; the devkit skill names `ask.action.detail.plan` | skill text | change-loop-declared.test.mjs |
| T62 | 9 | `parseTasks`: `Conductor:` at the start is marked; mid-sentence is not; a `Gate:` task is not | checker | deliver-check.test.mjs |
| T63 | 9 | `readPhases`: `conductor` lists the open marked ids; `[]` when none | checker | deliver-check.test.mjs |
| T64 | 9 | `nextStep`: a phase whose first open task is marked gives `conductor-task` with the leading marked ids | checker | deliver-check.test.mjs |
| T65 | 9 | `nextStep`: an unmarked task before a marked one gives `implement` with `stopAt` | checker | deliver-check.test.mjs |
| T66 | 9 | `nextStep`: no marked task gives `implement` with exactly `{ phase }` | checker | deliver-check.test.mjs |
| T67 | 9 | an unticked marked task holds the gate and is listed unticked by `tasksItem`; ticked, the gate follows | checker | deliver-check.test.mjs |
| T68 | 9 | `decide` on a `conductor-task` row is a `session` step of the implementation | loop | change-loop-declared.test.mjs |
| T69 | 9 | tdd-implementer's text, the ship-change rows `conductor-task` and `implement`, and both schemas' tasks instruction (both copies) name the marker | skill text | change-loop-declared.test.mjs |
| T70 | 12 | `pr-verifier` writes `proof/run.txt` and `proof/runs/a.jsonl` of the active change: allowed | hook | guard.test.mjs |
| T71 | 12 | `pr-verifier` redirects into `proof/out.txt`: allowed; into `design.md`: refused | hook | guard.test.mjs |
| T72 | 12 | `pr-verifier` writes `proposal.md`, `other/proof/a.txt` and `src/a.ts`: each refused | hook | guard.test.mjs |
| T73 | 12 | `tdd-implementer` and the main session write under `proof/` as before; `change-planner` writing `evidence.md` is still refused | hook | guard.test.mjs |
| T74 | 12 | `pr-verifier.md` names the `proof/` folder and no longer says "the only file you write" | agent text | deliver-check.test.mjs |
| T75 | 4 | for every role of the exported `AGENT_ROLES`, the exported `AGENT[role]` is `${PACKS[role]}:${role}`, and `COMMIT_AGENT` is `agentOf('commit-and-pr')` | loop | change-loop-declared.test.mjs |
| T76 | 4 | a map built from a `PACKS` with one pack changed differs from the shipped one (the test fails on a drift); `agentOf('owner')` is undefined | loop | change-loop-declared.test.mjs |
| T77 | 4 | project-loop's ADR reviewer agent is `agentOf('adr-reviewer')` | loop | change-loop-declared.test.mjs |
| T78 | 5 | ADR 0011 has a `Note (coordinator-loop-fixes, <date>)` naming the stop lock, the run's change and the change's ADR (by the number the file has then), and its `## Decision` section equals the text held in the test | doc | change-loop-declared.test.mjs |
| T79 | 6 | `normalizeLang`'s fallback equals `userConfig.language.default` of devkit-openspec's `plugin.json` | loop | change-loop-declared.test.mjs |
| T80 | 6 | each `DECLARED` reply key rendered with `--lang '${user_config.language}'` and with `--lang ''`, with the parameters it needs (`id`, and `decision` for `waiting-owner-decision`), equals the pt-BR text and holds no `${` | loop CLI | change-loop-declared.test.mjs |
| T81 | 6 | `next` on a fixture change with `--lang '${user_config.language}'` gives the pt-BR reply of the same action | loop CLI | change-loop-declared.test.mjs |
| T82 | 11 | the skill's `## Waiting on GitHub` holds the host-monitor paragraph (no wait, a sentence that the host's monitor holds the wait, end the turn, the next turn runs `next`) after the unchanged first paragraph; devkit-session's item 3 holds the same exception | skill text | change-loop-declared.test.mjs |
| T83 | 15 | `docs/openspec-flow.md`'s `devkit-lite` section records both decisions | doc | change-loop-declared.test.mjs |
| T84 | 16 | the `devkit-lite` flow declares the same stages as before (a constant held in the test) | schema | change-loop-declared.test.mjs |
| T85 | 14 | `createdAfter` with `.openspec.yaml` unreadable (a folder at that path) is false and does not throw | loop | change-loop-declared.test.mjs |
| T86 | 14 | `unfinished` does not list a change whose `.openspec.yaml` cannot be read and whose id is archived | loop | change-loop-declared.test.mjs |
| T87 | 14 | the change-coordination delta words the archive sources as their union (reads this change's delta until the archive, then the main spec) | doc | change-loop-declared.test.mjs |
| T88 | 14 | `github-setup.mjs` with Actions disabled exits 1 | setup script | github-setup.test.mjs |
| T89 | 14 | with the newest runs failed without starting exits 1 | setup script | github-setup.test.mjs |
| T90 | 14 | with the rulesets refused exits 1 | setup script | github-setup.test.mjs |
| T91 | 14 | with nothing blocked and the Actions state unknown exits 0 | setup script | github-setup.test.mjs |
| T92 | 14 | a roadmap run handing a change's `commit` step: the action's brief equals `change-loop.mjs next`'s brief and ends with `ATTRIBUTION_ASK` | loop | change-loop-declared.test.mjs |
| T93 | 8 | flow-check on a `devkit-lite` change: a task ticked, `approval.md` holding a `- Plan:` that differs, `design.md` edited after the tick: no stage stale, no `plan-revised` reason | stage checker | flow-check.test.mjs |
| T94 | 8 | `nextStep` on the same `devkit-lite` fixture: `state.plan` is null and no `stop-plan-approval` is given | checker | deliver-check.test.mjs |
| T95 | 7 | `decide` on `stop-review-deadlock` with `resolution: true`: `waiting-review-dispute` with `detail.resolution` true; without it, no `detail` | loop | change-loop-declared.test.mjs |
| T96 | 7 | `declare review-round --param words=...` at the resolution's deadlock records `scope: 'resolution'`, `round` 3, and `next` gives `fix-resolution`; at the code review's deadlock it records `scope: 'review'` | loop CLI | change-loop-declared.test.mjs |
| T97 | 7 | `collectState` on a `two-prs` fixture: the resolution's `limit` is 3 with one `resolution` entry and 2 with only a `review` entry | checker | change-loop-declared.test.mjs |
| T98 | 1 | `guardBash`: a subagent (`tdd-implementer`) running `node plugins/openspec/hooks/change-loop.mjs declare feat review-round --param words=x` is refused, the message naming the main session | hook | guard.test.mjs |
| T99 | 1 | `guardBash`: the same with a quoted path (`node "$CLAUDE_PLUGIN_ROOT/hooks/change-loop.mjs" declare feat gate-red --param phase=1`) and after `cd <dir> &&` is refused | hook | guard.test.mjs |
| T100 | 1 | `guardBash`: the main session's same two commands are allowed | hook | guard.test.mjs |
| T101 | 1 | `guardBash`: a subagent running `change-loop.mjs next feat --lang en` or `change-loop.mjs reply waiting-pause --param id=feat` is allowed | hook | guard.test.mjs |
| T102 | 1 | `guardBash`: a subagent's `git commit -m "add the declare verb to change-loop.mjs"` and a heredoc whose body holds a `node .../change-loop.mjs declare` line are allowed | hook | guard.test.mjs |
| T103 | 1 | `guardBash`: in a project whose config selects no devkit schema, a subagent's `declare` command is allowed | hook | guard.test.mjs |
| T104 | 1 | a subagent's edit of `openspec/changes/other/declared.json` while `feat` is the active change is refused; `declareViolation('...declare...', '')` is null | hook | guard.test.mjs |
| T105 | 7 | `computeFlow`, no record (no `authorizedReviewRounds` fact, and the fact 0): `review` failed at attempt 2 ends blocked `ceiling-reached` `{ stage: 'review', attempt: 2, failures: 2, ceiling: 2 }` | stage checker | flow-check.test.mjs |
| T106 | 7 | `computeFlow`, one record (`authorizedReviewRounds: 1`): `review` failed at attempt 2 gives no end, `next` the implementation with `fix-after-failure` `{ failed: 'review', attempt: 2, failures: 2, ceiling: 3 }` and the review's `header-failed` params `{ attempt: 2, failures: 2, ceiling: 3 }`; with its header stale, `next` the review with `rerun-after-fix` | stage checker | flow-check.test.mjs |
| T107 | 7 | `computeFlow`, one record, the authorized round failed: `review` failed at attempt 3 ends blocked `ceiling-reached` `{ stage: 'review', attempt: 3, failures: 3, ceiling: 3 }` | stage checker | flow-check.test.mjs |
| T108 | 7 | `computeFlow`, two records of the code review (`authorizedReviewRounds: 2`): attempt 3 offers the fix, attempt 4 ends blocked with `failures: 4, ceiling: 4`; and on the `devkit` flow with its `review` ceiling set to 1 (as the synthetic version 2 of `version-pin.test.mjs` sets it), one record: attempt 1 offers the fix, attempt 2 ends blocked with `failures: 2, ceiling: 2` | stage checker | flow-check.test.mjs |
| T109 | 7 | `computeFlow`, one record: a failed `evidence` and a failed `readiness` at attempt 3 still end blocked at ceiling 3; on the `devkit-project` flow (its `review` stage of role `adr-reviewer`, ceiling 2) a review failed at attempt 2 still ends blocked at 2 | stage checker | flow-check.test.mjs |
| T110 | 7 | `collectFlow` on a change folder (the `fakeOpenspec` fixture of the existing `collectFlow` tests): `authorizedReviewRounds` is 0 with no `declared.json`; 1 with one `review` entry; 1 with one entry with no `scope`; 1 with one `review` and one `resolution` entry (records for different reviews); 0 with only a `resolution` entry (a record for the other review); 2 with two `review` entries; 0 with an unreadable record | stage checker | flow-check.test.mjs |
| T111 | 7 | through `nextAction`, on `deliveredChange()` with `review.md` at `Consensus: FAIL (round 2/2)`, its header `result=failed attempt=2` and `code-quality-reviewer` `Verdict: rejected` at the code commit: `next` exits 2 with the blocked end `ceiling` on `review`; `declare feat review-round --param words="one more round"` gives `fix-review` (the uncommitted `declared.json` is no plan fix); after a fixture fix commit and `evidence.md` re-headed at it, `next` gives the `commit` step before the review round (the record and the evidence uncommitted), and once they are committed the `review` step with `detail.round` 3 and `detail.limit` 3; with `review.md` then at `FAIL (round 3/3)`, its header `result=failed attempt=3` and a current rejection, `next` is the blocked `ceiling` end again with attempt 3 | loop CLI | change-loop-declared.test.mjs |
| T112 | 7 | `deadlockScope`: `waiting-review-dispute` with `detail.resolution` gives `resolution`, without it `review`; a blocked `ceiling` end of role `review-bench` gives `review`; a blocked `ceiling` end of the readiness, of the evidence and of role `adr-reviewer`, a blocked `no-progress` end of the review, and an `agent` step each give null | loop | change-loop-declared.test.mjs |
| T113 | 7 | `REVIEW_ROUNDS` of `deliver-check.mjs` equals the `ceiling` of the `review` stage in `plugins/openspec/schemas/devkit/flow.json` and `plugins/openspec/schemas/devkit-lite/flow.json` | schema | deliver-check.test.mjs |
| T114 | 1 | `RECORDED_KEYS` of `deliver-check.mjs` equals the keys of `DECLARED` whose `via` is `declare` | loop | change-loop-declared.test.mjs |
| T115 | 8 | `approvalText` with a `plan` writes `- Plan: <plan>` right after `- Readiness:` and keeps every other line of the form; with no `plan` it writes today's text byte for byte; `recordApproval` on a plan with a ticked task and a revised `design.md` writes a `- Plan:` line equal to `planDigest(dir)`, and `planRevision(dir).changed` is false right after | checker | change-loop-declared.test.mjs |
| T116 | 8 | the CompozyOS view of a plan revised after the first tick (the same fixture as T60): `next --view compozy` gives the readiness reviewer's `agent` view ("out of date"), then after the re-review the `approval` view, and a tick alone gives the implementation again | loop CLI | change-loop-declared.test.mjs |
| T117 | 13 | an archive that left a delivery train and conflicts outside the release files and the roadmap ticks keeps the blocked `stop-archive` (`archiveStep: 'train-left'`, `blockedState` naming the paths) and is never `resolve-base-conflict`; `releaseConflict` returns null for its `rejoin-archive` step | checker (real git) | conduct-check.test.mjs |
| T118 | 13 | a change that left a delivery train (`rejoin-train` from the delivery checker) keeps `rejoin-train` with the base added, whatever it conflicts in: never `resolve-base-conflict` | checker (real git) | conduct-check.test.mjs |
| T119 | 17 | `foreignArchiveHead`: every row of the D-20 table (`archive-x`/`archive-x` false; `archive-x`/`chore/archive-archive-x`, `archive-x`/`archive-archive-x`, `x`/`chore/archive-x`, `x`/`archive-x`, `archive-x`/`archive-y`, `x`/`archive-y` true; `x`/`ship/x` false), and an absent head false | checker | deliver-check-archive.test.mjs |
| T120 | 17 | `isOwnPr('archive-x', { headRefName: 'archive-x' }, ['openspec/changes/archive-x/tasks.md'])` is true; with head `chore/archive-archive-x` or `archive-archive-x` and the same files it is false | checker | deliver-check-archive.test.mjs |
| T121 | 17 | `isOwnPr('x', { headRefName: 'chore/archive-x' }, ['openspec/changes/x/tasks.md'])` and with head `archive-x` are false (as today); with head `ship/x` true | checker | deliver-check-archive.test.mjs |
| T122 | 17 | a foreign head: `isOwnPr('archive-x', { headRefName: 'archive-y' }, ['openspec/changes/archive-x/tasks.md'])` and `isOwnPr('x', { headRefName: 'archive-y' }, ['openspec/changes/x/tasks.md'])` are false; `isOwnPr('archive-x', { headRefName: 'archive-x' }, ['openspec/changes/other/tasks.md'])` is false (the file rule) | checker | deliver-check-archive.test.mjs |
| T123 | 17 | `findChangePr` in `merge` mode with a fake `gh` whose merged list holds head `archive-x` changing `openspec/changes/archive-x/tasks.md`: from the default branch it returns that pull request with `via: 'list'`; on branch `archive-x` (the merged pull request found by branch) it returns the pull request, not `{ none: true }`; a merged list holding only `chore/archive-archive-x` returns `{ none: true }` | checker | deliver-check-archive.test.mjs |
| T124 | 17 | `next` on a fixture change `archive-x` whose pull request (head `archive-x`) merged with every task ticked, from the default branch: the action is the retro, not the no-pull-request answer | loop CLI | change-loop-declared.test.mjs |
| T125 | 18 | `headInBase`: the head equal to `origin/main`'s tip, and a head behind it, are true; a head with a commit of its own is false; no head, no `facts.base` and no `origin/<base>` each false | checker | deliver-check.test.mjs |
| T126 | 18 | `ownFiles` with the head in the base is null, as before (through `headInBase`); with the head ahead it is the own-files object, as before | checker | deliver-check.test.mjs |
| T127 | 18 | `collectFlow` and `computeFlow` on a change delivered by a merged pull request (fake `gh`, every task ticked on the base), checked out on its own branch fast-forwarded to `origin/main`, which holds a base commit touching `src/a.ts` after the reviewed head: `postMerge` true, no stage stale, the next stage the retro | stage checker | flow-check.test.mjs |
| T128 | 18 | the same change on its own branch not advanced, with a commit touching `src/a.ts` after the reviewed head on the branch: `postMerge` false and the review stage stale, as today | stage checker | flow-check.test.mjs |
| T129 | 18 | the branch advanced into the base but a task left unticked on the base (not delivered): `postMerge` false, as today; and in `plan` mode with the branch advanced: `postMerge` false | stage checker | flow-check.test.mjs |
| T130 | 18 | `next` on T127's fixture: the retro step, and no `verify`, `review` or reviewer hand-off | loop CLI | change-loop-declared.test.mjs |
| T131 | 18 | `prItem` in merge mode, a merged pull request: at the local head met; local head advanced into `origin/main` with the pull request's head its ancestor met; local head with a commit of its own (not in the base) `blocked` naming both heads, as today; local head in the base but the pull request's head not its ancestor `blocked` | checker | deliver-check.test.mjs |
| T132 | 7 | `computeFlow` with a `history` fact (`stage-ceiling-consecutive`'s) in which the review's file carried `result=passed attempt=1`, then `result=failed attempt=1`, and its header now says `result=failed attempt=2`: with one `review` record, two failures in a row are below the ceiling 3 and the fix is offered `{ failed: 'review', attempt: 2, failures: 2, ceiling: 3 }`; with the next failed header (`attempt=3`), three failures in a row end blocked `{ stage: 'review', attempt: 3, failures: 3, ceiling: 3 }`; with no record, the two failures end blocked at the ceiling 2 | stage checker | flow-check.test.mjs |
| T133 | 8 | flow-check on a `devkit` change with a ticked task, an APPROVED readiness and an `approval.md` that records the readiness hash and the approved plan's `- Plan:` digest: (a) its spec delta edited (the file a merge-defect fix edits), (b) its `design.md` edited instead; the `readiness` and `approval` entries of (a) and (b) are equal, and the readiness is `stale` with the reason `plan-revised` in both | stage checker | flow-check.test.mjs |
| T134 | 8 | through `nextAction`, a change on a branch that merged its base (a merge commit the base does not hold), a red `merge-check` record for that merge at the current fingerprint, then a fixture edit of its spec delta: with an approval that records the plan's digest before the edit, `next` hands `devkit-core:plan-readiness-reviewer` with "readiness is out of date", not `merge-check` and not `merge-defect`; with an approval that records no `- Plan:` line, `next` gives the session step `merge-check` | loop | change-loop-declared.test.mjs |
| T135 | 19 | `changeDevkitBlock`: a text with an `x-devkit:` block (`budget: 2000000`, `models:` with `review: opus`) gives that budget and that table; a text with only a `devkit:` block gives that block's, as today; a text with both gives the `x-devkit:` one alone; the flat keys `x-devkit-version: 0.1.0`, `x-devkit-flow: 2` and `x-devkit-budget: 5` open no block; `parseDevkitBlock` of a text with only an `x-devkit:` block gives no budget and an empty table | checker | guard.test.mjs |
| T136 | 19 | the fenced example that follows `**A change's own settings.**` in `docs/openspec-flow.md`, written byte for byte as the `.openspec.yaml` of change `feat` in a fixture project (an `openspec/config.yaml` naming `devkit-lite`, a `proposal.md` and one ADDED delta): the real `openspec validate feat --type change --strict` exits 0; `modelsOf(root, dir, { strict: true })` gives `review: 'opus'` and the default of every other stage; `budgetOf(root, dir, 'en')` gives `{ cap: 2000000, from: 'change' }`; the same lines under `devkit:` in place of `x-devkit:` make the CLI exit 1 (the reason of the rule) and are still read by `budgetOf` | loop and CLI | change-loop-declared.test.mjs |
| T137 | 19 | `budget: 0` in the `x-devkit:` block of a change's `.openspec.yaml` makes `next` exit 3 with the `setting-unknown` reply naming `budget` and `0`; `design: gpt` in its `models:` the same naming `design: gpt`; the `waiting-budget` reply names the `x-devkit` block and the file in both languages; `writePin` on a file holding an `x-devkit:` block keeps the block's lines byte for byte and `readPin` reads the pin | loop | change-loop-declared.test.mjs |
| T138 | 19 | the spend block of `flow-check` (the stage-models AC-12 fixture, with the project's `budget: 2000000`): with the change's `x-devkit:` `budget: 500000` its total line names the cap 500000; with only a `devkit:` block of `budget: 500000` in the change, the same | stage checker | stage-models.test.mjs |
| T139 | 19 | the "token budget" and "model of each stage" paragraphs of `docs/openspec-flow.md` name the `x-devkit:` block of a change's own `.openspec.yaml` and no longer the words "a `devkit:` block of a change's own"; the paragraph `**A change's own settings.**` follows "The model of each stage", names `openspec validate <id> --type change --strict` and the fallback; the comment lines of `openspec/config.yaml` and the two settings sentences of `docs/coordination-design.md` name `x-devkit:`; ADR 0023 has the `Note (coordinator-loop-fixes, <date>)` naming `x-devkit:` and the change's settings ADR (by the number the file has then, as `decisions.md` names it) after the stage-models Note, and its `## Decision` section equals the text held in the test | doc | change-loop-declared.test.mjs |
| T140 | 20 | the `context:` of `openspec/config.yaml` holds the `Live roadmap:` rule on the line right after `Test history:`, naming the tick, the done state and the fixture or constant | doc | change-loop-declared.test.mjs |
| T141 | 7 | `collectState` on a git fixture whose change folder holds an uncommitted `declared.json` and nothing else uncommitted: `planDirty` is empty and `folderDirty` lists the record; with an uncommitted `design.md` as well, `planDirty` lists `design.md` only | checker | deliver-check.test.mjs |

T87 reads the spec text: until the archive moves the delta into the main spec, it reads
`openspec/changes/coordinator-loop-fixes/specs/change-coordination/spec.md` when that file exists,
else `openspec/specs/change-coordination/spec.md`, and asserts "the union of every source".

## D-17 Siblings and the merge of `origin/main`

Sibling changes land while this one is in flight (several merges of `main` a day, and a delivery train
that merges a batch at once). The five hook files this change edits most are the ones they edit:
`change-loop.mjs`, `flow-check.mjs`, `deliver-check.mjs`, `guard.mjs` and `conduct-check.mjs`.

**The rule for every phase.** A phase that edits one of those five files starts with its own task `N.0`,
which merges `origin/main` into the branch and re-reads each function the phase edits before it edits it:

- The conducting session fetches `origin/main` and says so when it hands the phase; the implementer never
  fetches (the plan's base is whatever that fetch brought). The task merges the local ref `origin/main`
  with `node plugins/openspec/hooks/release-merge.mjs --base main --roadmap-ticks`, which merges it,
  resolves the release files, the CI pin and the roadmap ticks by rule and commits (exit 0); on its exit 2
  (another file conflicts; it undid the merge) the task runs `git merge origin/main` and resolves each
  conflict by hand, by this section, never a rebase.
- The implementer then runs `grep -n "<name>"` for each function, export, constant or table the phase
  names (the plan cites them by name, so the search finds them wherever the merge moved them) and reads
  the function as it is now: a sibling may have changed it, and the plan's text then applies to the new
  shape of the same function, or, when the new shape contradicts the plan, the phase stops and reports it.
- Tests that `origin/main` added since the plan's base are run by name before the phase's own tests
  (`git diff <the base of the previous merge>..origin/main --stat -- '*.test.mjs'`, `CONTRIBUTING.md`), with
  `node scripts/test-suite.mjs --concurrency=2 <file>...`: a failing one is a row for D-15 and one plan revision, not a
  failure of the phase. A test D-15 names that a split moved keeps its title (ADR 0026), so the
  implementer finds its new file by its title.
- A phase gate runs `node scripts/test-suite.mjs --concurrency=2` (ADR 0026) over the test files its phase
  touches, never the whole suite and never a near-whole list of files: the whole suite runs only on the
  delivery train (`devkit.delivery.train` in `openspec/config.yaml`, ADR 0022), which runs it once at its
  head for every boarded change. The files a phase touches are the ones it adds tests to or edits tests in,
  and the ones that hold the tests D-15 names for the rules and texts the phase changes. A gate has two
  parts: the files of the phase's own area whole, with no pattern; and the large mixed files filtered by
  anchored `--test-name-pattern` values naming this change's tests and the kept tests of the phase (the
  script applies its patterns to every file it runs, so the two kinds cannot share one call). No pattern
  holds a `|` (the flow splits a gate at `&&` and refuses a `|`), so alternatives are separate values. Each
  part runs with `GITHUB_HEAD_REF` and `GITHUB_BASE_REF` set, as a pull-request run on CI does. The gate adds
  `python3 scripts/check.py` when the phase edits Markdown, a schema copy or the config, and
  `gen-agents.mjs --check`, `gen-catalog.py --check` or `claude plugin validate .` when it edits what they
  check. A sibling's new test outside the gates is caught by the train.
- The plan's validation after a merge of the base is the loop's own `merge-check` step (`post-merge-validate`),
  which runs before `verify` and the delivery steps, never the implementer's: a merge task merges and edits
  no plan file, and a red check goes to the planner's `merge-defect` step, which D-7 treats as any plan edit.

**What siblings touch** (read on `openspec/roadmap.md` and, where a sibling has a worktree, in its plan;
none of them owns an item of this change, `requirements.md`):

| Sibling (roadmap line) | State on c09860c | What it touches that this change also touches |
|---|---|---|
| `loop-place-and-evidence` | merged (d917ae0) and archived (52d191b) | `decide`'s `buildPart` (the place step `take-place`, after which D-3's fix goes); `nextStep`'s `commit` before a review round (`folderDirty`, D-1); no key of `END_OF_KEY` |
| `post-merge-validate` | merged (d917ae0), its archive due in the next train | `decide`'s `buildPart` (`CHECK_BEFORE`, the `merge-check` session step, the `merge-defect` hand-off to the planner), `COMMAND_STEPS`, the merge-check record in the git common directory; the requirement "A merge-defect fix follows the rule of every plan edit" (D-7); the roadmap test of D-23 |
| `jira-entry-followups` | merged (086a53c) | `runReply`'s `--stdin <name>` (kept by `declaredStep`); `review-round.workflow.js` `validateArgs` (`args.dirty` required), `review-round.mjs` `tree` and `review-change/SKILL.md` `args` (the `limit` of D-4 joins them); `nextStep`'s `commit` for an uncommitted plan fix (`planDirty`, D-1); `guard.mjs` `FLOW_VERSIONS` |
| `project-slice-claim` | merged (086a53c) | `project-loop.mjs` (the slice's open), next to the `AGENT` table D-9 derives |
| `state-skips-unlocated` | merged (086a53c) | `change-loop.mjs` `locate`, `state` and the roadmap facts; no function this change edits |
| `stage-ceiling-consecutive` | merged (c09860c), not archived | `flow-check.mjs` `failuresInARow`, `computeFlow`'s `raw.failures >= ceilingOf(s)` and `artifactState`'s `header-failed` (D-4 replaces only the right side); the `change-stages` requirements "A failed stage offers its fix, then itself" and "Attempt ceilings and no progress stop the run", the second of which this change's delta also modifies |
| `fresh-base-check` | open | `conduct-check.mjs` `releaseConflict` and `deliveryRow` (a fetch before the judgment); `deliver-check.mjs` `update-branch` |
| `forced-merge-path` | open | `deliver-check.mjs` `nextStep`'s post-merge rows and the merged-pull-request lookup (`findChangePr`, `deliveryOf`, next to the `isOwnPr` and list filter of D-20; `flow-check.mjs`'s walk after the merge, next to D-21); `change-loop.mjs` `MESSAGES` and the retro step; `guard.mjs`; the `session` item of `devkit/SKILL.md` and the `retro` row of `ship-change/SKILL.md`; an ADR of its own |
| `archive-release-pin` | merged, not archived; waits on this change for its archive | nothing this change edits; its pull request 107 is AC-17's real run (R16) |

Whichever lands first, the other merges it. The task `6.1` is the last merge; the gates of phase 6 and the
loop's `merge-check` then run on the merged head, and the delivery train runs the whole suite at its head.
Three meetings are known now:

- `stage-ceiling-consecutive`'s delta and this change's both modify "Attempt ceilings and no progress stop
  the run". This change's delta holds the sibling's text and every scenario of it, with its own scenarios
  added, so it validates against main before and after that sibling's archive. `openspec validate --strict`
  refuses a MODIFIED requirement that omits a scenario the main spec has (checked with the CLI 2.0.0 at this
  revision), so whichever archive comes second is caught by its own `merge-check`, never lost in silence: if
  this change archives first, the sibling's delta omits this change's scenarios and its check goes red.
- `post-merge-validate`'s requirement on a merge-defect fix: D-7, task 3.6a.
- A requirement of a capability that a sibling's archive changed before this change archives: the loop's
  `merge-check` after the merge that brought it goes red and hands the planner `merge-defect`, which copies the
  base's text and scenarios into this change's delta (D-7 then treats the fix as any plan edit).

**After the last merge.** With the delivery train on (ADR 0022) and ADR 0025, a sibling's merge into
`main` after 6.1 stales nothing of this change: its evidence and its reviews are judged at its own head,
by its own files, and being behind or in conflict with the base does not keep it off the train. So no
merge of `origin/main` follows 6.1 unless a step of the loop asks for one (`rejoin-train` after a train
took the change off), and no merge pause of the siblings is asked before the evidence run.

## D-18 Release

`CONTRIBUTING.md`, step 5, against `origin/main` at the last merge (6.1; the conducting session fetches it;
the plan holds no version). Every pack this change changes takes the next free minor after `main`'s, in its
`plugin.json` and in `.claude-plugin/marketplace.json`: devkit-openspec and devkit-core, and devkit-compozy,
because two of its agent templates are generated from agent files this change edits and its installed kit
and manifest change with them (D-19). The marketplace's own version takes its next minor; `CHANGELOG.md`
gets a section for it with one bullet per pack and a docs bullet; every devkit-openspec version tag of the
CI pin lines of `docs/openspec-flow.md` (found with `grep -n "v[0-9]*\.[0-9]*\.[0-9]*" docs/openspec-flow.md`,
never by a number of a line) names the new devkit-openspec version. No test is edited for the release: the
pin test `change-loop docs: the design records the answers` (`change-loop-compozy.test.mjs`) reads the
expected pin from `plugins/openspec/.claude-plugin/plugin.json`, and the archive check lets only the flow
page's pin lines pass unnamed (ADR 0027, ADR 0030).

**On the train.** This repository delivers on a delivery train (ADR 0022, `devkit.delivery` in
`openspec/config.yaml`). The branch keeps the numbers it took at 6.1; a sibling that boards or merges first
takes them, and the train's join renumbers this change's release files above the train's tip at the
departure, keeping the kind of each bump (the `delivery-train` spec, "Release numbers follow the boarding
order on the train only"). So no merge of `main` is made after 6.1 to move a version, and a release-file
conflict of a later merge, if the loop asks for one (`rejoin-train`), is resolved by `release-merge.mjs`
as in D-17. `docs/catalog.md` does not change (no description changes; `gen-catalog.py --check` proves it).
The kit's `.compozy/kit-manifest.json` records the devkit-compozy version at install, so the install runs
once more after the bump (D-19). The train's join renumbers the release files, not the manifest, so when a
sibling took this change's devkit-compozy number the manifest's `pack` on `main` trails the joined
`plugin.json` by that renumbering; no test reads one against the other (`adoption.test.mjs` reads the
inputs and the digests), so this is accepted and named in the risks. The tag is the loop's
`tag-release` step after the train's merge.

## D-19 The CompozyOS driver and its kit (the readiness review of attempt 4)

The base brought a second driver that reads the same checkers and a kit generated from this change's
agent files. What this change does for each, decided here:

- **Takes from this change.** The `- Plan:` line of the approval (D-7: `approvalText`, `recordApproval`,
  T115, T116, R15); the new delivery step `resolve-base-conflict` as a hand-off whose dispatch sentence is
  its `ship-change` row (D-5, one entry of `ROWS`); `conductor-task` as a coordinator step by the view's
  generic session branch, which names the `ship-change` row; the reworded `waiting-review-dispute`
  and the new reply texts through `render`.
- **Does not take** (Non-Goals): the declared pause and decision (a CompozyOS run has no session to
  declare them and no stop lock), the fix after a red gate and the owner-authorized review round (both
  need `declare`, the main session's command).
- **The kit.** The two agent files this change edits, `plugins/core/agents/tdd-implementer.md` (D-6) and
  `plugins/core/agents/pr-verifier.md` (D-8), are sources of `templates/agents/<role>/AGENT.md`. The
  task that edits each of them also regenerates the kit, in two commands and never by hand:
  1. `node plugins/compozy/skills/compozy-setup/scripts/gen-agents.mjs` rewrites the two templates
     (`gen-agents.mjs --check` exits 0 afterwards);
  2. `node plugins/compozy/skills/compozy-setup/scripts/install-kit.mjs .`, run in the worktree root,
     refreshes `.compozy/agents/<role>/AGENT.md` (each file equals its recorded digest, so the state is
     `update`) and the digests of `.compozy/kit-manifest.json`; it writes nothing outside `.compozy/`.
  The two checks that prove it are `gen-agents.mjs --check` (the CI step "CompozyOS agents are up to
  date" and `gen-agents.test.mjs`) and `adoption.test.mjs` (byte for byte against the rendered
  template, and the manifest). The release (D-18) changes devkit-compozy's version, which the manifest's
  `pack` field records, so task 6.2 runs the second command once more.
- **No loop template changes**, so `loop-templates.test.mjs` and the `.compozy/loops/` copies are as they
  are.

## D-20 An id that starts with `archive-` keeps its own pull request (AC-17; field finding 25)

**What is wrong.** `isArchiveHead(name)` (`deliver-check.mjs`) is true for every head that matches
`/^(chore\/)?archive-/`, and two readers drop such a head before they look at its files: `isOwnPr` (its first
line) and the merged-list search of `findChangePr` (the `rest` filter). For a change named `archive-release-pin`
whose branch is its id, the pull request from head `archive-release-pin` is therefore never its own: on its
own branch `mergedOnBranch` calls `isOwnPr` and returns `{ none: true }`, and off it the list drops the pull
request before its files are read. `next` then says the change has no pull request and never reaches the retro.

**What the archive heads are.** The loop creates only `chore/archive-<id>` (the archive steps of
`deliver-check.mjs`, `conduct-check.mjs`, `guard.mjs` `archiveBranchChange`, `train-loop.mjs`); `archiveHeads(id)`
also accepts `archive-<id>`, a form kept from the first archive steps (devkit-openspec 0.6.0). Both stay.

**The rule.** A head equal to the change's own id is that change's branch, whatever its prefix; any other
head that `isArchiveHead` accepts is an archive head (of some change). One exported helper in
`deliver-check.mjs`:

```js
// An archive head other than change `id`'s own branch (coordinator-loop-fixes D-20).
export const foreignArchiveHead = (id, name) => String(name ?? '') !== id && isArchiveHead(name);
```

- `isOwnPr(id, pr, files)`: its first line becomes `if (foreignArchiveHead(id, pr?.headRefName)) return false;`.
  `mergedOnBranch` reaches it unchanged.
- `findChangePr`, the merged-list search: `list.filter((p) => !foreignArchiveHead(id, p.headRefName) && ...)`.
- `isArchiveHead` is not changed (the test `field-fixes 4 delivered: isArchiveHead is true for every change's
  archive head and for nothing else`, `deliver-check-archive.test.mjs`, still holds `archive-bar`), nor
  `archiveHeads`, `offOwnBranch` (`flow-check.mjs`, which reads `archiveHeads(id)`, already exact), nor the
  exact `chore/archive-` readers of `guard.mjs`, `train-loop.mjs`, `change-loop.mjs` and `conduct-check.mjs`.

| id | head | `foreignArchiveHead` | own pull request when its files are the change's |
|---|---|---|---|
| `archive-x` | `archive-x` | false | yes (the fix) |
| `archive-x` | `chore/archive-archive-x` | true | no: the archive of `archive-x` |
| `archive-x` | `archive-archive-x` | true | no: the older archive form |
| `x` | `chore/archive-x` | true | no: the archive of `x`, as today |
| `x` | `archive-x` | true | no: the older archive form of `x`, as today |
| `archive-x` | `archive-y` | true | no |
| `x` | `archive-y` | true | no |
| `x` | `ship/x` | false | yes, as today |

A pull request whose head is the id but whose files do not touch `openspec/changes/<id>/` is still not the
change's own (`isOwnPr`'s file rule is unchanged); a head that only names the change is never proof.

Alternatives: change `isArchiveHead` to the exact forms of one id (`archiveHeads(id).includes(name)`) and call it
with the id (rejected: the merged-list filter drops every change's archive pull request before its files are read,
to keep the list short; an exact form would read the files of every other archive pull request); match only
`chore/archive-` (rejected: drops the `archive-<id>` form `archiveHeads` still accepts, a change of behaviour for
an older project, AC-16).

## D-21 A delivered change on a branch advanced into the base (AC-18; field finding 26)

**What is wrong.** `collectFlow` (`flow-check.mjs`) switches the walk to the walk after the merge (`postMerge`:
no staleness, no task count, the headers alone, the retro next) only when the checkout is off the change's own
branch (`offOwnBranch`) and the change is delivered. A session that advanced the change's own branch to the base
after a train or a pull request merged it (a fast-forward to `origin/<base>`) is on its own branch, so the walk
calls `staleness` for every header. `ownFiles` (ADR 0025) returns null when the head is already in the base (it
cannot tell what the change brought), so every merge commit of the base since the reviewed head counts against its
first parent, and the train's merge commits touch product files: the evidence and the five reviews read stale.
`deliver-check.mjs` already treats any delivered change as after the merge (`collectState`'s `postMerge` needs
only `delivery.delivered`); the stage walk is the one that differs.

**Decision: a fix in the stage walk, not a rule for the session.**
`collectFlow`'s `postMerge` becomes `config.ship !== 'plan' && (offOwnBranch(root, id, branch) ||
headInBase(root, gf)) && delivery().delivered`, with one exported helper in `deliver-check.mjs`:

```js
// Whether the checkout's head is contained in origin/<facts.base> (coordinator-loop-fixes D-21); false with no
// head, no base or no origin/<base>.
export function headInBase(root, facts)
```

`ownFiles` uses the same helper for its own "the head is already in the base" test (one helper per mechanism),
its result unchanged.

The delivery checker needs the same reading once more. In its post-merge state, on the change's own branch
(`fetched.via === 'branch'`), item 5 is `prItem(..., { merge: true })`, whose merged arm is met only when the pull
request's head is the local head and is otherwise `blocked: item 5` ("local head differs", the guard against local
commits a merge would lose). On a branch advanced into the base the local head differs but loses nothing. The merged
arm of `prItem` becomes: met when `pr.headRefOid === facts.head`, or when `headInBase(root, facts)` and the pull
request's head is an ancestor of the local head (`git merge-base --is-ancestor <headRefOid> HEAD`); blocked as today
otherwise. A head that holds a commit of its own is not in the base, so the guard still holds for it. On a branch advanced into the base, every commit the change made is in the base, so the
change's files on the branch are those the base delivered: the headers recorded before the merge are the ones
the walk after the merge reads, as on the default branch.

What stays as today (AC-16): a merged pull request at another head on a branch with commits of its own stays
`blocked: item 5`; the own branch still ahead of the base (the usual case, the train's own boarded head,
a branch that merged the base) judges staleness as before, with ADR 0025's own-files rule; a change that is not
delivered (a task left on the default branch, no merged pull request, a partial pull request) never switches;
`plan` mode never switches. The change's own files did change since the reviewed head when the session made a
new commit outside `openspec/` on the advanced branch: then the head is no longer in the base and the walk judges
it as today.

| Alternative | Why not |
|---|---|
| A rule for the session: never advance the change's branch after its merge | The state is reachable by ordinary git (a pull, a fast-forward, a later `git merge origin/main`) and by a session of another project; a loop that needs the session to avoid it repeats the defect the next time; the walk after the merge already exists for the default branch |
| Drop `offOwnBranch` from `postMerge` (every delivered change switches, wherever it is) | It also changes the walk of an own branch ahead of the base after the merge, which `forced-merge-path` is changing in the same function (D-17); wider than the finding |
| Teach `staleness` to exempt the base's commits when the head is in the base | The train's merge commits brought the change's own files into the base, so the own-files rule would still count them; the headers would read stale the same way |

**How it meets ADR 0025 and the roadmap.** ADR 0025's rule (`ownFiles`, `staleness`'s `own`) covers a base merged
into a branch that is still ahead of it; it gives up when the head is in the base, which is this case. The roadmap
lines `post-merge-validate` (validate after a base merge, evidence attempts), `evidence-attempts-by-failure`
(attempts counted by failures), `fresh-base-check` (a fetch before a conflict is judged) and `own-files-by-content`
(merged text equal to the branch's) do not touch it; `forced-merge-path` edits `deliveryOf` and the post-merge
rows, which this change reads and does not edit (D-17).

## D-22 A change's own settings in an `x-devkit:` block (AC-19; field finding 27)

**What is wrong.** "The token budget." and "The model of each stage." of `docs/openspec-flow.md` offer a
`devkit:` block in a change's own `.openspec.yaml` for `budget` and `models:`, and `budgetOf`, `modelsOf`
(`change-loop.mjs`) and `capOf` (`flow-check.mjs`) read it there through `parseDevkitBlock` (`guard.mjs`). The
`openspec` CLI 2.0.0 refuses that key: `openspec validate <id> --type change --strict` warns "Unrecognized key
name(s) in .openspec.yaml ... devkit" and exits 1; it knows `schema`, `created`, `goal`, `affected_areas`,
`initiative`, `skip_specs` and `retire_capabilities`, and accepts any key that starts with `x-` ("prefix a key
with x- ... to keep tool-specific metadata"). A change that follows the document turns its own validation, the
loop's `merge-check`, its gates and the `check` red. The `budget:` key documented beside `models:` has the same
defect, so both move.

**Decision: the change's settings live in an `x-devkit:` block of its `.openspec.yaml`** (the change's settings
ADR, decisions 1 to 5; it amends ADR 0023 decision 1, the place of a change's own override, as the readiness review
of attempt 5 asked by the rule of `rules.design`). Checked at this revision on a scratch copy of this change with
the CLI 2.0.0: the same lines under `x-devkit:` validate (exit 0) where under `devkit:` they exit 1. The block
keeps the shape and the keys of the project's `devkit:` block, so the owner writes the same lines under another
name and the loop reads them with the same parser. The bullets below build the record's decisions: one block
per file (decision 2), the `devkit:` fallback (decision 3), the project's block unchanged (decision 4), the flat
`x-devkit-*` keys and ADR 0023's Note (decision 5).

- `guard.mjs`: `parseDevkitBlock(text, key = 'devkit')`: the block opens on a line `<key>:` (today's opening
  regex with the key in place of `devkit`); every caller of today passes no key and reads as before. A new
  exported `changeDevkitBlock(text)` returns `parseDevkitBlock(text, 'x-devkit')` when the text has a top-level
  `x-devkit:` line (`/^x-devkit:\s*(#.*)?\r?$/m`), else `parseDevkitBlock(text)`: a file is read from one
  block, and a change written by today's document keeps its budget and its models (it fails the strict
  validation until the block is renamed). The flat pin and claim keys (`x-devkit-version`, `x-devkit-flow`,
  `x-devkit-machine`, `x-devkit-places`) open no block: the opening line is `x-devkit:` alone, and their own
  readers match their exact keys.
- Readers: `budgetOf` and `modelsOf` (`change-loop.mjs`) and `capOf` (`flow-check.mjs`) read the change's
  `.openspec.yaml` through `changeDevkitBlock`; `openspec/config.yaml` is still read through
  `parseDevkitBlock` (`devkit:`), which today's strict validation of every change accepts.
- `MESSAGES` of `change-loop.mjs`: `waiting-budget` says "raise budget in the x-devkit block of {file}"
  (pt-BR `aumente budget no bloco x-devkit de {file}`).
- `docs/openspec-flow.md`: in "The token budget." and "The model of each stage.", "a `devkit:` block of a
  change's own `.openspec.yaml`" becomes "the `x-devkit:` block of a change's own `.openspec.yaml`"; a new
  paragraph `**A change's own settings.**`, right after "The model of each stage.", says that a change sets
  `budget` and `models:` in an `x-devkit:` block because `openspec validate <id> --type change --strict`
  refuses any top-level key OpenSpec does not know and accepts one that starts with `x-`, shows this example
  (the one T136 reads, byte for byte):

  ```yaml
  schema: devkit
  created: 2026-11-24
  x-devkit:
    budget: 2000000
    models:
      review: opus
  ```

  and says that a file with an `x-devkit:` block is read from that block alone, and that a `devkit:` block
  written there before is still read when the file has no `x-devkit:` block but fails the strict validation,
  so it is renamed.
- `openspec/config.yaml`: the two comment lines of the settings say "a change's own .openspec.yaml can
  override it in its x-devkit: block" (budget) and "... can override a stage in its x-devkit: block" (models).
- `docs/coordination-design.md`: the two sentences "its override in a change's own `.openspec.yaml`" gain
  "(its `x-devkit:` block)".
- ADR 0023: a dated Note after its stage-models Note: "Note (coordinator-loop-fixes, <date of the edit>):
  decision 1's override in a change's `.openspec.yaml` is written in an `x-devkit:` block, not a `devkit:`
  block, as ADR <its number> decides, because `openspec validate <id> --type change --strict` refuses any
  top-level key it does not know and accepts one that starts with `x-`; the `budget` key of the same file moves
  with it, and a `devkit:` block written there before is still read when the file has no `x-devkit:` block.
  Decision 1 is otherwise unchanged." (The change's settings ADR, written as a relative link to its file, as the
  other Notes link theirs; the link and the number are the ones the file has at the last merge, as for ADR
  0011's Note, D-12.) Its `## Decision` section is not touched (the settings ADR's decision 5). The record is
  the decision; the Note points to it, as ADR 0011's Note points to the change's ADR. The owner's AC-19 chose
  between moving the place and dropping the offer; this plan moves it.
- Spec deltas: `stage-models` modifies "A project and a change can set a stage's model"; `change-coordination`
  modifies "A run can carry a token budget" and "The budget stop says how to go on".
- Unchanged (AC-16): a change with no block, or with a `devkit:` block and no `x-devkit:` one, reads as
  today; `openspec/config.yaml` reads as today; nothing writes either block.

The change's settings ADR weighs the same four alternatives in its own table:

| Alternative | Why not |
|---|---|
| Stop offering a change's own override (the document's other choice in AC-19) | ADR 0023 decision 1 and the `change-coordination` budget requirements give a change its own override; dropping it is a change of behaviour nobody asked for, and a change that uses it would lose it |
| Flat keys `x-devkit-budget:` and `x-devkit-models:` | A second shape for the same settings and a second parser; the block reads with the parser of the project's block |
| Keep `devkit:` and validate without `--strict`, or ask OpenSpec to know the key | The loop's `merge-check` and CI run `--strict`; OpenSpec's key list is outside this repository |
| Read only `x-devkit:` | A change written by today's document would lose its budget and its models in silence (AC-16) |

## D-23 No test pins the state of a live roadmap line (AC-20; field finding 28)

**What is wrong.** A test that asserts the tick or the done state of a line of the live `openspec/roadmap.md`
forbids the archive that ticks that line: the archive of `post-merge-validate` (pull request 125) turned its
own `check` red on `post-merge-validate 3: ... and stays unticked` and left delivery train 7. The rule "Test
history" of `openspec/config.yaml` keeps tests off git history and says nothing of the live roadmap.

**Decision.**

- `openspec/config.yaml`, `context:`, a line right after "Test history": "Live roadmap: A test never asserts
  the tick or the done state of a line of openspec/roadmap.md, which the line's own archive changes; it finds a
  line whatever its tick, and a line's old content is held as a fixture or a constant." T140 pins it. It is a
  rule of this repository's tests, so no capability's spec changes.
- The three tests of finding 28 follow it, each named in D-15 with its invariant, its layer and its suite, and
  each runs its assertions on the live roadmap and on a copy of it with the line it reads ticked (the copy is
  made in the test from the live text, so no file is written):
  - `post-merge-validate 3: ... and stays unticked` (`change-loop.test.mjs`), only if it is still present on
    the base when phase 5 runs: that change's own archive, due in the next train, may fix or remove it first;
    task 5.8 then records "already fixed on the base" and changes nothing.
  - `jira-entry AC-10 the roadmap has the live-proof follow-up after jira-entry` (`change-loop-remote-state.test.mjs`).
  - `stage-roles docs: the roadmap line of stage-roles keeps its text, ...` (`change-loop-compozy.test.mjs`): it
    makes no assertion on the tick today; it gains the ticked copy, so this change's own archive, which ticks its line, leaves
    it green.
- Before the edit, task 5.8 searches the suite for any other test that reads the live roadmap
  (`readRepo('openspec', 'roadmap.md')`, `readRoadmap(REPO_ROOT)`) and asserts `- [ ]` or `done`; the search at
  this revision found these three only. A new one found then is fixed the same way and named in the commit.

Alternative: a `check.py` rule that refuses such a test (rejected: a test's assertion is code, which `check.py`
does not parse; the config rule reaches every planner and reviewer through `context:`, as "Test history" does).

## Decisions and ADRs

- The change's ADR (accepted at the plan approval; `decisions.md` points to it) is the decision behind D-1
  to D-7; the plan follows its eight points. Read for this plan: ADR 0010 (decisions 3, 5, 6, 8), ADR 0011,
  ADR 0016, ADR 0017, ADR 0021 (only the owner's own typed message is a go-ahead), ADR 0002 and ADR 0003
  (merge mode, unchanged), and, for the CompozyOS driver and the train, ADR 0022 (decision 8) and
  ADR 0024; since the base moved to c663f21, ADR 0023 (a stage agent's failure is retried once, then the
  loop ends blocked: the reading of the change's ADR decision 5 in D-5), ADR 0025 (a base merge stales only
  on the change's own files: D-17), ADR 0026 (the suite runs by file: D-15 to D-17 and the gates), and
  ADR 0027 and ADR 0030 (only the flow page's pin lines pass the archive check unnamed, and the pin test
  reads the manifest: D-18), and, since the base moved to c09860c, ADR 0023 again (decision 1, the place of a
  change's own override, which the change's settings ADR amends: D-22). No decision of theirs is reversed.
- The change's settings ADR (proposed; `decisions.md` lists it beside the change's ADR) is the decision behind
  D-22: the readiness review of attempt 5 found that moving the place of ADR 0023 decision 1's override changes
  that decision's text, which `rules.design` of `openspec/config.yaml` records as a new ADR, and the owner chose
  a record of its own; the ADR author drafted it. Its Amends line names ADR 0023 decision 1, and ADR 0023 gets a
  dated Note pointing to it (D-22), its `## Decision` section untouched. It is accepted by `accept-decisions`
  after the owner's next approval of this plan (D-7, "This plan's own approval and its records").
- Not recorded as an ADR, per `decisions.md`: the verifier's `proof/` folder, the host-monitor wait,
  the shared agent map, the language check, the nits and the two `devkit-lite` decisions. D-23 is not in
  `decisions.md` either: it is a rule of this repository's tests in `openspec/config.yaml`, as "Test history"
  is, and changes no ADR.
- Rejected alternatives that an ADR already rejected are not used: no fifth end state (the change's ADR), no
  unbounded fix loop (the change's ADR, ADR 0010 decision 3's ceilings), no authorization from any message
  (ADR 0011, ADR 0021), no lifting of the edit lock for a conductor task (ADR 0010 decision 8, ADR 0011
  decision 2).
- The change's ADR decision 3 ("recorded from the owner's session ... a message from another session or
  agent is no authorization", "each authorization hands exactly one round") covers the
  main-session-only `declare` command and a round of the resolution's review. Its wording was made
  precise in this revision (attempt 3 of the readiness review): the code review's deadlock the loop
  meets first is the `review` stage's attempt ceiling, and an authorization raises that ceiling with
  the round limit (D-4); the Amends line says the `flow.json` ceiling itself is unchanged. No decision
  was added or reversed.

## Alternatives considered

| Option | Why not |
|---|---|
| Count red gates from the transcript instead of a record | The loop is a script that reads files; a transcript read by the loop would make the gate's bound depend on which session ran it |
| Record the authorized round in `review.md` | `review.md` is the round's output; editing it is the hand-edited header the change's ADR forbids |
| Turn the stage walk's `ceiling-reached` on `review` into `waiting-review-dispute` in `decide` | It changes what the owner sees at every round-2 FAIL with no authorization (a blocked end becomes a wait), which AC-16 keeps as today, and the walk would still block a third round, so the ceiling would need lifting anyway |
| Drop the `review` stage's numeric ceiling and let the delivery checker own the round limit | A `flow.json` change needs a new flow version, and a change under way keeps every rule of the version it opened with (`openspec/specs/change-stages/spec.md`, the version-pin requirement), so changes opened before it would keep the numeric ceiling anyway; one count read by both checkers keeps both bounds and lifts them together |
| A `fix-gate` row in `ROWS` returned by the delivery checker | The checker cannot know the gate was red (the session ran it); a row no checker returns breaks the rows-match invariant |
| Stale the plan by file times after the start, ignoring `tasks.md` | A tick and a task edit are both `tasks.md` writes; only content tells them apart |
| One counter of authorized rounds for both reviews | An owner's word at the code review's deadlock would hand an unasked round to a later resolution review |
| Keep the resolution's review at two rounds | An authorization recorded at the resolution's deadlock would then change nothing, and the owner's word would be lost (readiness finding 2) |
| Word the declared-steps record as a direct-write rule only | `guardBash` sees the command a subagent runs (it already judges `gh pr create` by its text), so the command can be refused at the same layer |
| Record the plan digest in `readiness.md` | That changes what the readiness reviewer writes and every readiness ever written; the approval is the record the owner already writes from `next` |
| Keep a blocked end for a conflict outside the release files and let the owner merge | The retro's finding; the change's ADR decision 5 |

## Risks / Trade-offs

| Risk | Probability × impact | Mitigation |
|---|---|---|
| A sibling lands a change to `runReply`, `nextStep`, `validateArgs`, `buildPart` or `artifactState` first and the merge conflicts | HIGH × MEDIUM | D-17; a merge opens each phase and 6.1 is the last; each gate runs the files its phase touches on the merged head and the train runs the whole suite at its head; no merge after 6.1 is needed, because a sibling's merge stales nothing of this change (ADR 0025, the train) |
| `resolve-base-conflict` judges against a stale `origin/<base>` until `fresh-base-check` lands | MEDIUM × LOW | The implementer's merge shows the real conflict; a clean merge gives `update-branch` as today |
| The implementer resolves a conflict wrongly | MEDIUM × MEDIUM | `verify` and `review` run before the push (D-5); `Outcome: failure` ends blocked |
| A session declares `review-round` without the owner's typed message | LOW × HIGH | The skill rule (D-4) and the words recorded in `declared.json`; a subagent can neither write the file (edit tool or redirect, any change's folder) nor run `change-loop.mjs declare` (the `guardBash` rule of D-1, T98 to T104); the main session's own misuse rests on the skill rule and the recorded words, as the plan approval does; the review trigger of the change's ADR |
| A subagent's command names `node .../change-loop.mjs declare` inside a quoted string (a commit message) and is refused | LOW × LOW | The rule needs a `node` call before the script; the refusal names the main session, and the subagent rephrases (T102 pins the ordinary commit message) |
| An authorization at one deadlock lifts the other review's limit | LOW × MEDIUM | Each entry records its `scope` from the deadlock it answers (D-4); T96, T97 |
| The plan digest changes for an edit that is not a plan change (a header rewrite of `tasks.md`) | LOW × MEDIUM | Only `tasks.md`'s checkboxes are ignored; any other edit after the approval is a plan edit by the ADR, and asks the owner once |
| A host's monitor wakes on a failure only, so a green pull request waits for the owner's message | HIGH × MEDIUM | AC-11's deferred half (D-10): the roadmap line `host-monitor-wake` and this change's retro carry it; the reply says calling `/devkit change` again is safe |
| The conducting session hands phase 4 before R10 is recorded | LOW × MEDIUM | D-14 and task 4.1 say R10 comes first; the implementer stops on an open 4.1, and 4.6 writes no language sentence without R10's `pass` line |
| The two new reply keys widen the replies a session must choose from | LOW × LOW | T12 and the skill name when each applies |
| The kit drifts from the two agent files this change edits, so CI's "CompozyOS agents are up to date" step and two kit suites go red on the pull request | MEDIUM × HIGH | D-19: the task that edits each file regenerates the kit and installs it, the gates 3.9 and 4.7 run `gen-agents.mjs --check` and the two kit suites by pattern, and 6.2 installs again after the release bump |
| A plan file is edited between the CompozyOS question and the owner's answer, and the digest written at the record covers the edit | LOW × LOW | Accepted (D-7): nothing in a CompozyOS run edits a plan file while it waits, and a not-yet-started change is refused by `stateFor` when its readiness is stale |
| A change that declared a third round on the Claude driver is then run on the CompozyOS driver, whose review loop passes no `limit` | LOW × LOW | Accepted (Non-Goals, D-19): `review-round.mjs` refuses the round naming `args.round`, and the owner decides at the deadlock as before |
| A sibling merges into `main` while a phase runs, and a test it added fails on the merged head | HIGH × MEDIUM | D-17: each phase opens with a merge and runs the tests the base added by name; a failing one is a row for D-15 and one plan revision |
| The suite takes longer (about 140 new tests), and a file passes CONTRIBUTING's 300 s | HIGH × LOW | The loop-level tests go to the new `change-loop-declared.test.mjs` (D-16); each file a phase added tests to runs alone before the gate and is split above 300 s; phase gates run only the files their phase touches, with `--concurrency=2`; the whole suite runs on the train |
| The train renumbers devkit-compozy above this change's number and the kit manifest's `pack` trails it | MEDIUM × LOW | Accepted (D-18): no test reads the manifest's `pack` against `plugin.json`; the next install of the kit records the current version |
| `headInBase` reads a stale `origin/<base>` (the checkers never fetch), so a branch advanced past the local ref reads as ahead | LOW × LOW | Then the walk judges staleness as today (the defect stays for that run, no wrong pass); the next fetch fixes it |
| A change in conflict with its base boards the train in this repository, so `resolve-base-conflict` is never met here | HIGH × LOW | By design (D-5): the step serves projects without the train; T45 to T48 and R8 prove it on fixtures without the train setting |
| The stage walk's ceiling and the delivery checker's limit drift apart, so an authorization lifts one and not the other | LOW × HIGH | One count (`authorizedRounds`) read by both checkers; `ceilingOf` the one function of every ceiling (D-4); T105 to T111 and T132 walk both through `nextAction` and the failures in a row; T113 pins the shipped flows' `review` ceiling to `REVIEW_ROUNDS` |
| An authorized round stops on a `commit` of `declared.json` before its fix | LOW × LOW | `planDirty` leaves the record out (D-1, T141); `folderDirty` commits it with the evidence before the round |
| `stage-ceiling-consecutive` (merged at c09860c) and this change modify the same `change-stages` requirement, and the second archive drops the first one's scenarios | MEDIUM × MEDIUM | D-17: this change's delta holds the sibling's text and scenarios with its own; `openspec validate --strict` refuses a MODIFIED requirement that omits a scenario of the main spec, so the second archive's `merge-check` goes red and its planner copies the text (`merge-defect`) |
| A merge-defect fix after a sibling's archive asks the owner again, a stop the run did not have before | MEDIUM × LOW | Accepted (D-7, the change's ADR decision 7, `post-merge-validate`'s own requirement): only for an approval that records a `- Plan:` digest; this change's own approval records none |
| `post-merge-validate`'s requirement "A merge-defect fix follows the rule of every plan edit" archives after this change with a scenario that no longer holds for an approval with a digest | MEDIUM × LOW | Task 3.6a modifies it when it is on main at phase 3; task 6.1 looks again after the last merge and reports a requirement that reached the main spec since, for a plan revision; otherwise the conducting session tells that change's session the scenario to update at its archive (D-7) |
| A project's change keeps its settings in a `devkit:` block and does not see that strict validation refuses it | MEDIUM × LOW | The block is still read (D-22), the flow document says to rename it, and the CLI's own warning names the key and the `x-` prefix |
| `post-merge-validate`'s archive lands with its roadmap test before phase 5, already changed | MEDIUM × LOW | Task 5.8 fixes that test only if it is still present on the base, and records it otherwise (D-23) |
| A real run that calls `declare` is given to a subagent and refused, or a run's loop output lands in the conducting session's transcript and moves its stop lock to the scratch change | MEDIUM × MEDIUM | D-14's four rules: a direct `declare` is the conducting session's (6.3), a nested one is the nested main session's with the prompt in a file, fixtures by a script that never writes `declared.json`, and the conducting session's loop output only in files checked with `grep -c` |

## Migration Plan

No data migration. A change under way keeps running: no `declared.json` means no red gate and no
authorized round recorded, so every stage ceiling and round limit is today's; an approval with no `- Plan:` line asks nothing again; a `tasks.md` with
no `Conductor:` task reads as today; a change whose `.openspec.yaml` holds a `devkit:` block and no
`x-devkit:` one keeps its budget and its models (D-22). Rollback is reverting the release: `declared.json`
files left in change folders are then ignored, and an `x-devkit:` block is then ignored too (the change's
override falls back to the project's value until it is written under `devkit:` again).

## Implementation plan

Order (dependency): D-1 and D-2 (the mechanism and the marker), then D-3, D-4, D-5 (the steps that
use it), then D-6, D-7, D-20 and D-21 (the delivery checker's and the stage walk's facts, phase 3), then D-8 to D-12 (independent), then
D-13 (the nits), D-22 (a change's settings block) and D-23 (the roadmap tests), phase 5, then the merge, the release and D-14. D-19's regeneration goes with the task that edits each
agent file; every phase that edits one of the five hook files opens with D-17's merge.

**Per surface.** Hooks (`plugins/openspec/hooks/`): `change-loop.mjs` (D-1, D-3, D-4, D-5, D-6,
D-7, D-9, D-13, D-22 `budgetOf`, `modelsOf` and `waiting-budget`), `guard.mjs` (D-1 file and command rules, D-2, D-8,
D-22 `parseDevkitBlock`'s key and `changeDevkitBlock`), `deliver-check.mjs` (D-1 reader and `planDirty`, D-4, D-6, D-7),
`flow-check.mjs` (D-4 `ceilingOf` and `authorizedReviewRounds`, D-7, D-21 `postMerge`, D-22 `capOf`), `deliver-check.mjs` also D-20 and D-21's helpers, `conduct-check.mjs` (D-5, D-6), `roadmap-loop.mjs` (D-1), `project-loop.mjs`
(D-9). Skills: `devkit`, `devkit-session`, `ship-change` (openspec pack); `review-change` and its
workflow (core pack). Agents: `pr-verifier.md`, `tdd-implementer.md`. Kit (`plugins/compozy`,
`.compozy/`): generated copies of the two agents and the manifest, `approvalText` and `recordApproval` in
`change-loop.mjs` (D-7, D-19); no loop template. Schemas: four `schema.yaml` files. Docs: D-12, D-22.
Config: `openspec/config.yaml` (the ADR list, D-12; the settings comments, D-22; the `Live roadmap:` rule, D-23).

**File structure.** Create: `plugins/openspec/hooks/change-loop-declared.test.mjs` (D-16) and this
change's `proof/`. Modify: the files above, their test files (`change-loop.test.mjs`,
`change-loop-compozy.test.mjs`, `guard.test.mjs`, `deliver-check.test.mjs`, `deliver-check-archive.test.mjs`,
`flow-check.test.mjs`, `conduct-check.test.mjs`, `roadmap-loop.test.mjs`, `delivery-models.test.mjs`,
`project-loop.test.mjs`, `review-round.test.mjs`, `github-setup.test.mjs`, `change-loop-remote-state.test.mjs`,
`stage-models.test.mjs`), a fixtures module only where
D-16 moves a helper into it, `docs/openspec-flow.md`,
`docs/coordination-design.md`, `docs/compozy-kit.md`, `docs/adr/0011-...md`, `docs/adr/0023-...md`, `openspec/config.yaml`,
`openspec/roadmap.md` (the `host-monitor-wake` line, D-10), `CHANGELOG.md`, the manifests of the three
packs and the marketplace. Generated by the commands of D-19, never by hand: the two `AGENT.md` templates
of `tdd-implementer` and `pr-verifier` under `plugins/compozy/skills/compozy-setup/templates/agents/`,
their two copies under `.compozy/agents/` and `.compozy/kit-manifest.json`. Delete: none.

**Estimate.** Optimistic 38 h, likely 50 h, pessimistic 66 h.

| Component | Hours | Type | Risk |
|---|---|---|---|
| D-1 table, helper, `declare`, record, guard file and command rules | 5 | Core | MEDIUM |
| D-2 marker id | 1 | Core | LOW |
| D-3 red gate | 2.5 | Core | MEDIUM |
| D-4 round limits (review and resolution), the review stage's ceiling, `deadlockScope`, round script, skills | 6 | Core | MEDIUM |
| D-5 conflict outside release files, the five existing tests it changes, the train exclusions (T117, T118) | 3 | Integration | MEDIUM |
| D-6 conductor tasks | 2.5 | Core | LOW |
| D-7 plan digest and revised plan, on both drivers (T115, T116) | 4.5 | Core | MEDIUM |
| D-8 to D-11 | 2.5 | Core | LOW |
| D-12 documents and schemas | 1.5 | Documentation | LOW |
| D-13 nits | 1.5 | Testing | LOW |
| D-14 real runs (R1 to R17, R7b, R7s, R11b, R13a, R13b; R6, R7, R7b and R10 by the conducting session) and the scrub of the proof files | 6.5 | Testing | MEDIUM |
| D-17 the merge that opens each phase, the last merge, D-18 release of three packs | 2 | Migration | MEDIUM |
| D-16 the new test file `change-loop-declared.test.mjs` and the fixture helpers it moves | 1 | Testing | LOW |
| D-20 `foreignArchiveHead` and its two callers, T119 to T124, R16 | 1.5 | Core | LOW |
| D-21 `headInBase`, `collectFlow`'s `postMerge`, `prItem`'s merged arm, T125 to T131, R17 | 2.5 | Core | MEDIUM |
| D-19 the kit: regenerate and install twice, the gates that run its suites | 1 | Integration | MEDIUM |
| D-7's merge-defect case: T133, T134, R11b, and task 3.6a's conditional delta | 1.5 | Testing | MEDIUM |
| D-4 on the failures in a row (T132) and `planDirty` without the record (T141) | 1 | Core | LOW |
| D-22 `changeDevkitBlock`, its three readers, the reply, the docs, ADR 0023's Note, two spec deltas, T135 to T139 | 3 | Core | MEDIUM |
| D-23 the config rule, the three roadmap tests, T140 | 1 | Testing | LOW |

**Assumptions** (where the plan breaks if reality differs): `nextAction` can be called from `declare`
in the same process as `next` (it is exported and pure but for its reads; `change-loop.mjs`);
`git merge-tree --write-tree` lists every conflicting path on its first lines after the tree id
(`conduct-check.mjs` `conflictedPaths`); `review.md`'s consensus regex already reads any `/N`
(`deliver-check.mjs` `readReviewMd`); the `review` header's attempt is the round (the `review` row of
`ship-change/SKILL.md`), so the stage ceiling counts review rounds and one authorization lifts it by
exactly one round (D-4); `devkit-session` carries out every kind as the devkit skill's
Loop says (`devkit-session/SKILL.md` item 3); a fixture can make `.openspec.yaml` unreadable with a
folder at its path; `install-kit.mjs .` on this repository's root reports every kit file `same` before the
edit and `update` for the two regenerated agents after it (the files equal their recorded digests; checked on
a scratch copy of `.compozy/` at the last revision of this plan); `deliveryRow` returns `rejoin-train`
before `releaseConflict` (`conduct-check.mjs`), and `releaseConflict` returns null for `rejoin-archive`;
`node scripts/test-suite.mjs` takes `--concurrency=<n>`, several `--test-name-pattern` values and file
arguments and passes the environment through (`scripts/test-suite.mjs` `parseArgs` and `runFile`);
`openspec validate <id> --type change --strict` (CLI 2.0.0) accepts an `x-devkit:` block with nested keys in a
change's `.openspec.yaml`, refuses a `devkit:` one, and refuses a MODIFIED requirement that omits a scenario of
the main spec (all three checked on scratch copies at this revision; a later CLI that changes them breaks
D-17's and D-22's reasoning, and T136 then fails); the loop that drives this change has the `merge-check` step
(the worktree's own `change-loop.mjs` has it since the merge of c09860c); a `--test-name-pattern` that
matches no test of a file leaves that file passing with no test run (Node's runner).

**Dependencies:** the change's ADR, accepted at the first plan approval (`accept-decisions`); the change's
settings ADR, accepted by `accept-decisions` after the owner's next approval (D-7); no sibling change is
required first.

## Open Questions

- AC-11's deferred half (D-10): whether the desktop app's pull-request monitor wakes the session when
  the checks pass. The roadmap-coordinator retro says it wakes "on a failure and not on success". It
  is not settled here; the roadmap line `host-monitor-wake` (task 6.5) carries it to the next change
  run in the app, and this change's retro records what its own wait on GitHub showed.
