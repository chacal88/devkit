<!-- devkit-stage design result=passed attempt=3 commit=bec9bf03e8ba0b5dc02c6ad2e719f9b7757f6e7c -->
# Design

Change: `coordinator-loop-fixes` · Date: 2026-11-23 · Owner: Kaue (chacal88) · PRD / tech spec: n/a ·
Decision: ADR 0022 (`docs/adr/0022-the-loop-declares-the-decisions-outside-the-stage-gates.md`,
proposed; see `decisions.md`).

## Context

See `proposal.md` for the why. The facts the approach rests on, at `origin/main` c1ac8c4:

- `plugins/openspec/hooks/change-loop.mjs`: `runReply` prints `devkit-end: <id> <state>` only for the
  two keys of `END_OF_KEY` (`blocked`, `waiting-pr-decision`); `roadmap-loop.mjs` keeps a second copy
  of that table in `replyCmd`, with the gate `decision` written in. `decide()` builds every action;
  `ROWS` maps each delivery step to a stage and a role; `AGENT` is a literal map of nine roles, while
  `PACKS` (declared 1,500 lines later) is the pack table a test ties to `docs/roles.md`.
- `plugins/openspec/hooks/guard.mjs`: `runMarkers` reads `devkit-end: <id> <state>` but drops the id,
  so `runOf` sets `ended` for any change's end; `writeViolation` lets `pr-verifier` write
  `evidence.md` only ("only writes its own verdict file").
- `plugins/openspec/hooks/deliver-check.mjs`: `nextStep` stops at `stop-review-deadlock` when
  `review.md` is at `FAIL` and `round >= 2`, gives `review` round 2 only after round 1, and asks the
  plan approval only while `!state.started`; `parseTasks` knows the `Gate:` marker only.
- `plugins/openspec/hooks/flow-check.mjs`: `artifactState` skips the `stale-plan` check once a task is
  ticked, because the stale check is by file time and a tick changes `tasks.md`. `computeFlow` ends the
  walk `blocked` `ceiling-reached` when a failed stage's header attempt reaches its ceiling
  (`raw.attempt >= ceilingOf(s)`, lines 575-579). The code review stage `review` (role `review-bench`)
  declares `"ceiling": 2` in both scripts (`plugins/openspec/schemas/devkit/flow.json` line 49,
  `devkit-lite/flow.json` line 34), and the `review` row of `ship-change/SKILL.md` sets its header to
  `attempt=<the round>`, so a round-2 FAIL ends the walk blocked before the delivery checker is read
  (`inDelivery` is false for a blocked end, `change-loop.mjs` line 869): the loop's code-review
  deadlock is that blocked end (`why=ceiling`, stage `review`), which the coordinator-field-fixes retro
  met ("`next` answers `blocked` until someone sets the header of `review.md` by hand").
- `plugins/openspec/hooks/conduct-check.mjs`: `releaseConflict` turns a conflict outside the release
  files into a blocked row; `SUBAGENT` and `MAIN` give each step its actor.
- `plugins/core/skills/review-change/scripts/review-round.workflow.js`: `validateArgs` accepts round 1
  or 2 only and the texts say "of 2" and "/2".
- `plugins/openspec/skills/devkit/SKILL.md`: a red `gate` ends the run with
  `reply blocked --param why=tests-red`; the `Waiting on GitHub` section always starts the background
  `wait`.

Constraints: the hooks only veto and never drive (ADR 0010 decision 5); four end states and no fifth
(ADR 0010 decision 3); a change's state is derived in one place, `changeState` (ADR 0017); every
stage role writes its own files (ADR 0016); product code only through `tdd-implementer` (ADR 0011
decision 2); tests never read git history (`openspec/config.yaml`, Test history).

## Goals / Non-Goals

**Goals:** the kept items of `requirements.md` (1 to 6, 8 to 18, 21 to 24), one mechanism for every
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

## D-1 The declared steps: one table, one helper (AC-1; ADR 0022 decision 1)

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
  it checks the loop's current action (`nextAction`) against `at` (`gate`: the session step `gate` of
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

**The record.** `openspec/changes/<id>/declared.json`, written only by `declare`:
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

Alternatives: a fifth end state `paused` (rejected by ADR 0022: ADR 0010 decision 3 has four ends);
putting the recorded keys under `reply` too (rejected: `reply` stays a pure printer that reads no
change, so a reply can never write a file by mistake); a second table in `roadmap-loop.mjs` (the
drift this change removes).

## D-2 The end marker names the run's change (AC-2; ADR 0022 decision 2)

`guard.mjs`: `runMarkers` captures the end's id, `{ end: { id, state } }`; `runOf` sets
`ended = mark.end.state` only when `mark.end.id === change` (the newest `devkit-run:` id), and leaves
`ended` as it was otherwise. An end line before any run line is ignored, as today. The roadmap
reader (`roadmapRunOf`) and the run-line reader at `guard.mjs` line 861 read `mark.run` only and do
not change. `stopDecision` in `change-loop.mjs` is unchanged: it trusts `run.ended`.

## D-3 One fix after a red gate (AC-10; ADR 0022 decision 4)

- `declare <id> gate-red --param phase=<n>`: `nextAction` must be the session step `gate` whose
  `detail.phase` is `n` (else `declare-not-at-gate`, exit 3, nothing recorded). The command counts
  the record's `gate-red` entries of phase `n`, records a new one, then:
  - none before: prints `loopOutput(id, nextAction(cwd, id, { ..., redGate: { phase: n } }))`;
  - one or more before: prints `loopOutput(id, nextAction(cwd, id, { ..., redGate: { phase: n, again:
    true } }))`, the blocked end `tests-red` of phase n, exit 2.
- `decide` `buildPart`: right after `const step = row.next.step;`, when `step === 'gate'` and
  `facts.redGate?.phase === row.next.phase`, it returns `blocked('tests-red', { phase }, 'implementation')`
  when `facts.redGate.again`, else `agent('implementation', 'tdd-implementer',
  'fix-gate', <what>, { phase, task: row.next.task, command: row.next.command })` with `<what>` =
  "the gate of phase N is red: run its command, find the cause, fix it test first within the
  approved tasks, and leave the gate task unticked; the gate runs again after you". `facts.redGate`
  is set only by `declare`; `next` never gives `fix-gate`, and `fix-gate` is no row of `ROWS` (as
  `fix-tests` is not), so the "rows match the checkers" test is unchanged.
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

## D-4 One more review round on the owner's word (AC-7; ADR 0022 decision 3)

Two reviews can reach a deadlock: the change's code review and, in `two-prs`, the review of a
conflict resolution on the support branch (`deliver-check.mjs` lines 1621 and 1635, the
`delivery-models` requirement "A resolution review deadlock goes to the owner"). The owner's word
answers the deadlock in front of them, so each authorized round is recorded with the review it
answers (its `scope`) and raises only that review's limit. The `delivery-models` spec is modified to
match (its delta in this change).

**Where each deadlock stops the loop.** Two checkers bound the code review, and the stage walk comes
first: at a round-2 FAIL the `review` stage's header (`result=failed attempt=2`) reaches its ceiling 2
and `computeFlow` ends the walk `blocked` `ceiling-reached`, so `decide` gives the blocked end
`why=ceiling` on the stage `review` and the delivery checker's `stop-review-deadlock` (line 1554) is
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
whichever of them binds (ADR 0022 decision 3): with the shipped flows both are 2; under a flow whose
`review` ceiling is 1 (the synthetic version 2 of `version-pin.test.mjs`) the stage ceiling binds and
an authorization still gives one round. T113 pins the shipped flows' `review` ceiling to
`REVIEW_ROUNDS`.

- `deliver-check.mjs`: `authorizedRounds(dir, scope)` (exported) = the number of `review-round`
  entries of `readDeclared(dir)` whose `scope` is `scope` (an entry with no `scope` counts as
  `review`), 0 on a reader error. It is the one count both checkers read. `collectState` sets
  `state.roundLimit = REVIEW_ROUNDS + authorizedRounds(dir, 'review')`, and at line 1737, after
  `resolutionState(...)`, `resolution.limit = REVIEW_ROUNDS + authorizedRounds(dir, 'resolution')`.
  `nextStep`:
  - line 1554: `state.reviewMd.round >= (state.roundLimit ?? REVIEW_ROUNDS)`, and the `why` text says
    `after round ${limit}` (reads "after round 2" with no record);
  - line 1587: `const limit = state.roundLimit ?? REVIEW_ROUNDS; const last = state.reviewMd?.round ?? 0;
    const round = state.reviewMd?.consensus === 'FAIL' && reRejected && last >= 1 && last < limit ? last + 1 : 1;`
    and the detail gains `limit` only when `limit > 2`;
  - line 1621 (the resolution's deadlock): `res.round.round >= (res.limit ?? REVIEW_ROUNDS)`, `why`
    `after round ${limit}`, detail unchanged (`{ reviewers, resolution: true }`);
  - line 1635 (the resolution's round): `const limit = res.limit ?? REVIEW_ROUNDS; const last =
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
  `computeFlow` (line 510, used at line 578) and the ceiling of `artifactState` (line 459, the
  `header-failed` reason's `ceiling`). No other stage is lifted, and neither is a `review` stage of
  another role (the ADR review of `devkit-project`, role `adr-reviewer`, keeps its own two-round rule,
  a Non-Goal). A fact that is absent (every synthetic test fact of today), a missing record, an
  unreadable one or one with only `resolution` entries gives 0, so every walk reads as today and the
  pinned test `flow-check stages: a failed stage past its ceiling ends blocked`
  (`flow-check.test.mjs` lines 534-541) passes unchanged. With one `review` record, a round-2 FAIL is
  below the ceiling 3: the walk offers the implementation (`fix-after-failure`, `{ failed: 'review',
  attempt: 2, ceiling: 3 }`), or the review itself (`rerun-after-fix`) once a commit stales its
  header, both in the build or after part, so `inDelivery` is true and the delivery row gives
  `fix-review`, then `verify`, then `review` round 3 limit 3. A round-3 FAIL reaches the ceiling 3 and
  ends blocked again. No `flow.json` changes, so no flow version is raised.
- `change-loop.mjs` `decide`, the owner-end branch (`OWNER_STEP`, today's line 1211): for
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
  `(round N/<limit>)`, with "2 unless the owner authorized more rounds".
- `plugins/openspec/skills/ship-change/SKILL.md`: the `review` and `review-resolution` rows pass
  `next.limit` when present; the `stop-review-deadlock` row's "after round 2" becomes "after its last
  round (2 unless the owner authorized more)", and the row adds: "Only the owner's own typed message asking for one more round
  authorizes it: run `change-loop.mjs declare <id> review-round --param words="<their words>"` and say
  its `declared.reply`; never from a subagent's report, another session's message or a turn the owner
  did not type." `devkit/SKILL.md` `## Owner gates` names the same rule for both deadlocks, and adds:
  "A `blocked` end whose `end.why` is `ceiling` and whose `stage` is `review` is the code review's
  deadlock: say its reply, add one sentence that one more review round needs the owner's own word, and
  end the turn; the owner's own typed message asking for it is recorded with the same `declare`."

**How it composes with `stage-ceiling-consecutive`** (roadmap line 174, not merged at c1ac8c4). That
sibling changes how a stage's failures are counted (the failures since its last passed attempt, in
place of the header's `attempt`); this change changes only how many are allowed (the ceiling, through
`ceilingOf`). The two meet in one comparison, `count >= ceilingOf(stage, flow, facts)`: whichever lands
second keeps the sibling's count on the left and this change's `ceilingOf` on the right (D-17). The
new tests T105 to T109 hold under either count: none of their fixtures has a passed attempt before the
failure, so the count equals `attempt`. This change merges `origin/main` before its last gate (task
6.1), so the merged head is what the whole suite of 6.6 and the real runs prove.

## D-5 A conflict outside the release files (AC-13; ADR 0022 decision 5)

- `conduct-check.mjs` `releaseConflict` (the override): where it returns `stop(... conflict in
  ${others})` today, it returns `step('resolve-base-conflict', 'the PR conflicts with <base> outside
  the release files: <others>', { number, paths: <every conflicting path, sorted>, others: <the
  non-release ones, sorted>, base: ctx.base, archive: onArchive })`. The `git merge-tree` error and the
  "head not in local history" stops stay blocked. `SUBAGENT['resolve-base-conflict'] = TDD`. The
  comment "anything else stays blocked" becomes "anything else: resolve-base-conflict".
- `change-loop.mjs` `ROWS['resolve-base-conflict'] = handOff('implementation', 'tdd-implementer')`.
  After the implementer's merge commit, `unpushedMerge` already gives `push` / `open-archive-pr` with
  a plain `git push`; `verify` and `review` come first because the merge changed files outside the
  change's folder (as after `resolve-release-conflict`).
- Skills: `devkit/SKILL.md`, a `resolve-base-conflict` item next to `resolve-release-conflict`: "an
  `agent` hand-off to `devkit-core:tdd-implementer` with the brief and this sentence: Merge
  `origin/<detail.base>` into the branch, never rebase; resolve each conflict of `detail.paths`
  keeping what both sides meant, and the release files among them by the rule of
  `resolve-release-conflict` (the base's version plus the branch's own bump, the branch's changelog
  entry above the base's newest, the catalog regenerated); run the project's test command; commit the
  merge; never push. `Outcome: failure` ends the run blocked: run `reply blocked --param id=<id>
  --param why=role-failed --param stage="<stageTitle>"`." `ship-change/SKILL.md` gains the row
  `resolve-base-conflict` with the same dispatch sentence.

## D-6 A task for the conducting session (AC-9; ADR 0022 decision 6)

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
  report the phase as stopped there, and return `success` for the tasks before it."
- Both schemas' tasks instruction (`plugins/openspec/schemas/devkit/schema.yaml` and
  `devkit-lite/schema.yaml`, and their byte-identical copies under `openspec/schemas/`), after the gate
  sentence: "A task only the conducting session can do (a run in the host, a host setting, a real
  session) starts its description with `Conductor:`; the loop never hands it to the implementer." No
  `flow.json` changes, so no flow version is raised.
- This change's own `tasks.md` uses no marker (it is written before the marker exists); the tasks the
  conducting session does are named in D-14.

## D-7 A plan revised after the start (AC-8; ADR 0022 decision 7)

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
- `collectState` sets `state.plan = needsReadiness ? planRevision(dir) : null`. `nextStep` line 1535:
  the plan approval stop holds when `!state.approval.ok && (!state.started || state.plan?.changed)`,
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
  `- Readiness:` (omitted when `next.plan` is null); line 20's "A change whose tasks are already ticked
  is resumed without it" gains "unless its approval records a plan the plan files no longer match".
  `devkit/SKILL.md` `### A session per change` names `ask.action.detail.plan` beside
  `ask.action.detail.readiness`.
- An approval written before this change has no `- Plan:` line: nothing is stale for it (AC-16).

## D-8 The verifier's proof folder (AC-12)

- `guard.mjs`: `export function inProofFolder(root, change, file)` is true when the path is under
  `openspec/changes/<change>/proof/`. `writeViolation`, before the line that refuses a reviewer, the
  readiness reviewer or the verifier anything else: `if (actor === 'pr-verifier' && inProofFolder(root,
  ch.name, file)) return null;`. The refusal message for the verifier names its two places. The header
  comment's table says `evidence.md, proof/ pr-verifier`. `classify` is unchanged, so every other
  writer's rule under `proof/` is as today.
- `plugins/core/agents/pr-verifier.md`, `## Delivers`: "you are its only writer, and it is the only
  file you write" becomes "you are its only writer; besides it you write only the output of the runs
  you record, under the change's `proof/` folder, and you name each such file in its row".

## D-9 The agent map from the pack table (AC-4)

`change-loop.mjs`: `PACKS` moves above `AGENT`; `export const agentOf = (role) => (PACKS[role] ?
`${PACKS[role]}:${role}` : undefined)`; `export const AGENT = Object.freeze(Object.fromEntries(AGENT_ROLES.map((r) => [r,
agentOf(r)])))` with `AGENT_ROLES` the nine roles of today's literal (exported too, so T75 and T76 read
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
  the ends a session declares outside the stage gates are those of ADR 0022." (ADR 0022 written as a
  relative link to its file, as the other Notes link theirs.) "Decisions 1 to 3 are unchanged." `## Decision`
  is not touched.
- `docs/openspec-flow.md`: the `devkit-lite` section records the two decisions of item 8 and item 9
  (no plan approval of its own by decision, the owner's message that sends it being the go-ahead; a
  change that creates the project's first spec follows the ordinary choice rule, with `WHY_CODES`);
  **The loop.** paragraph: "a gate that stays red" becomes "a gate that stays red after its one fix",
  and the declared-ends sentence lists the four reply keys and `declare`; **The locks** paragraph: the
  end must name the run's change, and `change-loop.mjs declare` and `declared.json` are the main session's; **Delivery rows**: `resolve-base-conflict`, `conductor-task`;
  **Order of the delivery steps** and the review-change bullet ("stops after two rounds"): the round
  limit, for the code review and for a resolution's review, and the code review stage's ceiling that
  rises with it (D-4); **Plan approval on disk**: the `- Plan:`
  line and the revised plan; **Waiting on GitHub.**: the host monitor (what the session does; no claim
  that the monitor wakes it on green checks, D-10); the person's language sentence (D-11, written from
  R10's recorded result).
- `docs/coordination-design.md` line 185: "consensus; two rounds at most" becomes "consensus; two
  rounds, one more for each the owner authorizes (ADR 0022)".
- Both schemas' review gate sentence "Gate: the reviewers reach consensus; two rounds at most."
  becomes "... two rounds at most, one more for each round the owner authorizes." (both copies).
- `openspec/config.yaml` `context:` ADR list gains "0022 the loop declares every decision outside the
  stage gates, and a revised plan goes back to its gates".
- Every mention of "ADR 0022" follows the number the ADR has at the last merge of `origin/main` (the
  ADR may be renumbered, `decisions.md`).

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

**Who may run what.** Four rules decide the "Who runs it" column; each follows from a guard or lock
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

| Run | Case (input variant) | Who runs it | Output | Check |
|---|---|---|---|---|
| R1 | the session is asked to pause in a `/devkit change` run: it runs `reply waiting-pause` and stops | implementer (`claude -p`) | `r1-pause.jsonl`, `r1-hooklog.jsonl` | the hook log's stop decision is `allow` `end-recorded`; the last tool result's first line is `devkit-end: <id> waiting-for-owner` |
| R2 | a decision outside the gates: `reply waiting-owner-decision --param id=<id> --param decision="<words>"` | implementer (`claude -p`) | `r2-*.jsonl` | the same, with the decision's words in the reply and no `unknown reply key` on stderr |
| R3 | the same session with no declared end and a stage ready | implementer (`claude -p`) | `r3-*.jsonl` | the stop decision is `refuse` `stage-ready` |
| R4 | the R1 transcript with its end line's id changed to another change, fed to `guard.mjs stop` | implementer (hook on a real transcript) | `r4-stop.txt` | exit 2, refusal naming the stage; the unchanged transcript gives exit 0 |
| R5 | a red gate once, then green: the nested session runs `declare gate-red`, hands `fix-gate` to a real `tdd-implementer`, runs the gate again | implementer (`claude -p`, rule 2) | `r5-*.jsonl`, `r5-declared.json` | one `gate-red` entry; the Agent call's `subagent_type` is `devkit-core:tdd-implementer` with the `fix-gate` brief; the gate task ends ticked |
| R6 | a red gate twice on the same phase: `declare gate-red` twice at the phase 1 gate | **conducting session** (loop commands, rules 1, 3, 4) | `r6-declare-1.txt`, `r6-declare-2.txt`, `r6-declared.json` | the first exits 0 and holds the `fix-gate` step; the second exits 2 and `grep -c "^devkit-end: feat blocked$"` of its file prints 1; two `gate-red` entries |
| R7 | the code review at round 2 FAIL (`review.md` header `result=failed attempt=2`, `Consensus: FAIL (round 2/2)`, a current rejection): `next`; `declare review-round` without words; with the owner's words; after a fixture fix commit and current evidence, `next`; the round script's arguments | **conducting session** (loop commands, rules 1, 3, 4) | `r7-next-1.txt`, `r7-declare-nowords.txt`, `r7-declare.txt`, `r7-next-2.txt`, `r7-next-3.txt`, `r7-args.txt`, `r7-declared.json` | `next` ends `blocked` `ceiling` on the stage `review`; without words: exit 3 `declare-no-words`, and `next` gives the same end again; with words: exit 0, a `review-round` entry of scope `review` and round 3, the action `fix-review`; after the fix and the evidence: `review` with round 3 and limit 3; `validateArgs` of `review-round.mjs` accepts `{ round: 3, limit: 3 }` and refuses `{ round: 3 }` |
| R7s | the session's own part of R7: turn 1 runs `/devkit change` on the R7 fixture and ends on the ceiling, saying one more round needs the owner's word; turn 2 (`--resume`) is the owner's typed message asking for one more round | implementer (`claude -p`, two turns, rule 2) | `r7s-turn1.jsonl`, `r7s-turn2.jsonl`, `r7s-declared.json` | turn 1: no `declare` call, the last assistant message holds the blocked reply and the sentence on the owner's word; turn 2: a Bash call of the nested main session whose command holds `change-loop.mjs declare` and `review-round`, one entry whose `words` hold the turn's message |
| R7b | a `two-prs` resolution deadlock with the owner's typed words | **conducting session** (loop commands on a `two-prs` fixture, fake `gh`, rules 1, 3, 4) | `r7b-next-1.txt`, `r7b-declare.txt`, `r7b-next-2.txt`, `r7b-declared.json` | the end is `waiting-review-dispute` with `detail.resolution`; a `review-round` entry of scope `resolution`; `next` gives `fix-resolution`, then `review-resolution` round 3 limit 3; the code review's limit stays 2 |
| R8 | a pull request conflicting outside the release files, and one only in them | implementer (fake `gh`, real git, real `tdd-implementer` for the first) | `r8-*.jsonl`, `r8-rows.txt` | the first gives `resolve-base-conflict` and ends with a merge commit and no push; the second gives `resolve-release-conflict` |
| R9 | a phase with a `Conductor:` task before and after an implementer task | implementer (loop commands; `claude -p` for the `implement` brief) | `r9-*.txt`, `r9-*.jsonl` | `conductor-task` first; the implementer stops at `stopAt` and leaves the marked task unticked |
| R10 | the person's language never set, installed plugin (task 4.1, before phase 4 is handed) | **conducting session** (rule 4) | `r10-*.jsonl` | the `init` event lists devkit-openspec from the install, no `language` option is set in the config dir used, and the reply is in Portuguese with no `${user_config` |
| R11 | a plan file edited after the first tick, and a tick alone | implementer (loop commands, rule 3: the edit, the re-review's `readiness.md` and `approval.md` by the fixture script) | `r11-*.txt` | edit: `next` hands the readiness review, then after the re-review `waiting-approval-again` with `detail.plan`; tick: the implementation goes on |
| R12 | the verifier's own run writes under `proof/` and is refused elsewhere | **pr-verifier** in this change's evidence stage | `proof/ver-*` and the hook log | its files under `proof/` exist; its write to any plan file is refused |
| R13a | a run ending waiting on GitHub, the session's host instructions naming a pull-request monitor and forbidding polling | implementer (`claude -p --append-system-prompt "<the host text, in r13a-host.txt>"`, fake `gh`) | `r13a-*.jsonl`, `r13a-host.txt` | no Bash call whose command holds `change-loop.mjs wait`; the last assistant message holds the reply and names the monitor; the result event ends the turn |
| R13b | the same project and run without the host text | implementer (`claude -p`, fake `gh`) | `r13b-*.jsonl` | a Bash call with `run_in_background: true` whose command holds `change-loop.mjs wait --change <id>` |
| R14 | a real `tdd-implementer` subagent told to run `change-loop.mjs declare <id> review-round --param words=x` | implementer (`claude -p`, the Agent tool, rule 2) | `r14-*.jsonl`, `r14-hooklog.jsonl` | the subagent's Bash call is refused naming the main session; no `declared.json` is written |

Which tasks are the conducting session's: 4.1 (R10), 6.3 (R6, R7, R7b) and the fetch of `origin/main`
before 6.1. This `tasks.md` is written before the `Conductor:` marker exists (D-6), so 4.1 and 6.3 are
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

Searched in `guard.test.mjs`, `change-loop.test.mjs`, `deliver-check.test.mjs`, `flow-check.test.mjs`,
`conduct-check.test.mjs`, `project-loop.test.mjs`, `roadmap-loop.test.mjs`, `delivery-models.test.mjs`,
`version-pin.test.mjs`, `review-round.test.mjs` and `github-setup.test.mjs` for "round 2", "/2", "of 2", "1 or 2",
`stop-review-deadlock`, `ceiling`, `ceiling-reached`, `tests-red`, the started exemption, `stale-plan`, `END_OF_KEY`, `GATE_OF_WHY`,
"only writes its own", `ATTRIBUTION_ASK ?? `, `Attribution below`, `approvalState`. `scripts/check.py`
has no tests of its own.

| Test (file) | Rule it pins | Fate | Task |
|---|---|---|---|
| `roadmap-loop replies: every owner wait has a gate` (roadmap-loop.test.mjs) | the exact set of `waiting-` keys and gates | updated: gains `waiting-pause: pause`, `waiting-owner-decision: decision` | 1.1, 1.4 |
| `change-loop skill: an end the session declares goes through reply, and the marker lines are never shown (F1)` (change-loop.test.mjs) | the sentence "An end the session declares itself (an agent's failure, a red gate, a pull-request decision left to the owner) goes through `reply`" | updated: the new sentence (four reply keys, `declare`); the `tests-red` key stays (exit-3 fallback) | 1.1, 1.5 |
| `change-loop replies: no internal term in either language` (change-loop.test.mjs) | every key renders from `SAMPLE` with no placeholder left | updated: `SAMPLE` gains `decision: 'the dependency upgrade'` (D-1, the parameter name); the test body is unchanged | 1.1, 1.2 |
| `sanitize drops heredoc bodies and quoted text` and every `bash(...)` heredoc test (guard.test.mjs) | heredoc bodies and quoted text are not commands | kept: `sanitize`'s output is unchanged after `withoutHeredocs` is split out | 1.3 |
| `approval.md: only the main session writes it, by Write and by shell redirect (D7)`, `approval.md: main-session only even with several active changes or in another change folder (D7)` and `upfront AC-6 guard: approval.md refuses a write by devkit-core:requirements-triage` (guard.test.mjs), which match `approval\.md is written only by the main session, from the owner's own message; not by` | the approval file's writer and message | kept: the message gains the path before `approval.md` and keeps the rest | 1.3 |
| `change-loop skill: the release-conflict sentence` (change-loop.test.mjs) | "`Outcome: failure` ends the run blocked" | kept: the phrase stays, followed by the reply call | 1.5 |
| `change-loop lock stop: T3a ...` (change-loop.test.mjs) | an end the session declared lets the stop through | kept: every case names the run's change | 1.3 |
| `change-state AC-3 state: each end waiting for the owner ...` (change-loop.test.mjs) | a subset of `GATE_OF_WHY` | kept | 1.2 |
| `nextStep row 7: FAIL (round 2/2) ...`, `nextStep row 9 ...`, the tests at lines 1667, 2065, 2088, 5379, `rejectedLoop`, `review-openspec-fix 16 ...` (deliver-check.test.mjs) | deadlock after round 2, round 2 after round 1 | kept: limit 2 with no record | 2.3 |
| `delivery-models P7 T8 ...` and the resolution tests at lines 1063 to 1814 (delivery-models.test.mjs) | the resolution's deadlock after round 2 | kept: with no `resolution`-scope record the limit is 2, the `why` text still says "after round 2" and the deadlock's detail is unchanged | 2.3 |
| `conduct: deliveryStep maps every deliver-check step ...` (conduct-check.test.mjs) | `stop-review-deadlock` state text; every step has an actor | kept; `conductor-task` and `resolve-base-conflict` get actors | 2.4, 3.2 |
| the validation test listing `{ ...ok, round: 3 }` as invalid and the texts `(round 2/2)`, `deadlock after round 2`, `(round 1/2)` (review-round.test.mjs) | two rounds | kept: no `limit` means 2 | 2.3 |
| `change-loop decide: ... waiting-review-dispute` (change-loop.test.mjs, line 483) | the dispute reply equals the rendered key | kept: re-rendered from the reworded key | 2.3 |
| the rows-match test and `change-loop decide: the loop's step agents match conduct-check's actorOf` (change-loop.test.mjs) | every returnable step has a row, and agents agree | kept; pass once `ROWS`, `SUBAGENT`, `MAIN` gain the two steps | 2.4, 3.2 |
| `format: ship-change names every next.step the checker can return` (deliver-check.test.mjs) | a ship-change row per emitted step | kept; passes with the `conductor-task` row | 3.3 |
| `stop-plan-approval: a change with a ticked task keeps running without approval.md (the started exemption)` (deliver-check.test.mjs) | no approval asked once started | kept: no approval.md means no recorded plan | 3.4 |
| `stop-plan-approval: APPROVED readiness with no approval.md ...` and `approvalState: no file, a current file and a stale file` (deliver-check.test.mjs) | `approvalState`'s shape | kept: the shape does not change (`planRevision` is apart) | 3.4 |
| `flow-check stages: ticking tasks after the plan review does not make the plan stale` (flow-check.test.mjs) | a tick is no plan edit | kept | 3.5 |
| `parseTasks: only a description that starts with Gate: is a gate ...` and `review-writer-prompt AC-9 parseTasks ...` (deliver-check.test.mjs) | the fields they map | kept: the new field is not mapped | 3.2 |
| `evidence.md is written only by pr-verifier` (guard.test.mjs) | evidence's writer | kept | 4.3 |
| `change-loop skill: the wait is started in the background on a GitHub wait` (change-loop.test.mjs) | the background wait | kept: the first paragraph is unchanged | 4.5 |
| `commit-attribution AC-1 T25 ...` (project-loop.test.mjs) | the negative with `?? '\u0000'` | updated (D-13) | 5.2 |
| `commit-attribution AC-2 T31 ...` (deliver-check.test.mjs) | the count of `Attribution below` | updated (D-13) | 5.3 |
| roadmap tests with `tests-red` (roadmap-loop.test.mjs lines 657, 3280, 4637, 4661, 4667, 4687) | a declared blocked end of a red gate | kept: `roadmap-loop.mjs reply blocked` still records it | 2.2 |
| `flow-check stages: a failed stage past its ceiling ends blocked` (flow-check.test.mjs lines 534-541) | `review` failed at attempt 2 ends blocked `ceiling-reached` `{ stage: 'review', attempt: 2, ceiling: 2 }`; at attempt 1 no end | kept: its synthetic facts carry no `authorizedReviewRounds`, so `ceilingOf` gives 2 (D-4) | 2.3 |
| `flow-check stages: a failed header does not pass its stage` (line 445, `{ attempt: 1, ceiling: 2 }`) and `flow-check stages: a failed stage offers its fix, then itself after the fix` (line 543, `{ failed: 'review', attempt: 1, ceiling: 2 }`) (flow-check.test.mjs) | the review's ceiling in the reason's parameters | kept: no record, ceiling 2 | 2.3 |
| the `liveChange` test at line 1093 (`review: 'failed', reviewAttempt: 2` exits 2) (flow-check.test.mjs) | the CLI exit of a review at its ceiling | kept: its fixture writes no `declared.json` | 2.3 |
| `flow-check readout: both languages cover every reason code` (flow-check.test.mjs, the `ceiling-reached` and `header-failed` parameters at lines 1239-1241) | every reason code is said in both languages | kept: no reason code is added or renamed for the ceiling | 2.3 |
| `stage-roles flow owner: a mock-up sent back at attempt 3 and at attempt 40 is never blocked by a ceiling` (flow-check.test.mjs, line 1723: "a numeric ceiling still blocks") | a numeric ceiling still blocks the review | kept: no record | 2.3 |
| `version-pin AC-2 readout: the version-1 ceiling holds after the upgrade` and `version-pin AC-3 readout: the version-2 ceiling blocks` (version-pin.test.mjs lines 194-200 and 303-309) | the pinned flow's `review` ceiling (2, or 1 in the synthetic version 2) | kept: no record, so `ceilingOf` is the pinned flow's own ceiling | 2.3 |
| `change-loop decide: P9 a ceiling and the other blocked ends of the plan` (change-loop.test.mjs lines 304-307) and the `ceilingFixture` tests of roadmap-loop.test.mjs (lines 604-635) | a readiness at its ceiling ends blocked `ceiling` | kept: the readiness is never lifted (`ceilingOf` lifts only the `review` stage of role `review-bench`) | 2.3 |

## D-16 New tests

Every new test's name starts `coordinator-loop-fixes AC-<n> T<k> `. "Loop CLI" tests call `main` of
`change-loop.mjs` (or `roadmap-loop.mjs`) on a fixture project built by the file's existing helpers;
"hook" tests run `guard.mjs` on a transcript fixture; "checker" tests call the exported function.

| T | AC | Invariant | Layer | Suite |
|---|---|---|---|---|
| T1 | 1 | `reply waiting-pause --param id=feat` prints `devkit-end: feat waiting-for-owner` first, then the reply, in en and pt-BR, exit 0 | loop CLI | change-loop.test.mjs |
| T2 | 1 | `reply waiting-owner-decision --param id=feat --param decision="the dependency upgrade"` the same, the reply holds `the dependency upgrade` in both languages; without `decision` it exits 3 naming the parameter | loop CLI | change-loop.test.mjs |
| T3 | 1 | stop allowed after the T1 output in a run with a stage ready (pause) | hook | change-loop.test.mjs |
| T4 | 1 | stop allowed after the T2 output (decision outside the gates) | hook | change-loop.test.mjs |
| T5 | 1 | the same transcript without either output: stop refused, `stage-ready` | hook | change-loop.test.mjs |
| T6 | 1 | `changeState` of a declared `waiting-pause` reads waiting for the owner with `gate.pause`; of `waiting-owner-decision` with `gate.decision` | state | change-loop.test.mjs |
| T7 | 1 | `roadmap-loop.mjs reply waiting-pause` records `declared[id] = { state: 'waiting-for-owner', why: 'waiting-pause', params.gate: 'pause' }` | loop CLI | roadmap-loop.test.mjs |
| T8 | 1 | the same for `waiting-owner-decision` with gate `decision`, and `waiting-pr-decision` still gate `decision` | loop CLI | roadmap-loop.test.mjs |
| T9 | 1 | `reply gate-red` and `reply review-round` exit 3 naming `declare`; `roadmap-loop.mjs reply gate-red` exits 3 | loop CLI | change-loop.test.mjs |
| T10 | 1 | `declare feat waiting-pause` and `declare feat no-such-key` are usage errors (exit 3) | loop CLI | change-loop.test.mjs |
| T11 | 1 | a key outside `DECLARED` (`waiting-merge`) prints no marker | loop CLI | change-loop.test.mjs |
| T12 | 1 | the devkit skill's Loop names `reply waiting-pause --param id=<id>` and `reply waiting-owner-decision --param id=<id> --param decision=`, the roadmap item 3 names both with `roadmap-loop.mjs`, and neither skill passes `--param what=` to `waiting-owner-decision` | skill text | change-loop.test.mjs |
| T13 | 1 | `readDeclared`: missing file gives no steps and no error | checker | deliver-check.test.mjs |
| T14 | 1 | `readDeclared`: empty file gives an error | checker | deliver-check.test.mjs |
| T15 | 1 | `readDeclared`: unparsable JSON, a non-object, version 2, a non-array `steps` each give an error | checker | deliver-check.test.mjs |
| T16 | 1 | `readDeclared`: an entry with an unknown key is skipped, the others kept | checker | deliver-check.test.mjs |
| T17 | 1 | `declare` on an unreadable record exits 3 with `declare-unreadable` and leaves the file byte for byte | loop CLI | change-loop.test.mjs |
| T18 | 1 | a subagent (`tdd-implementer`) write of the active change's `declared.json` is refused, by edit and by shell redirect, the message naming the main session and `change-loop.mjs declare` | hook | guard.test.mjs |
| T19 | 1 | the main session's write of `declared.json` is allowed | hook | guard.test.mjs |
| T20 | 2 | `runOf`: an end line naming the run's change sets `ended` | guard reader | guard.test.mjs |
| T21 | 2 | `runOf`: an end line naming another change leaves `ended` null | guard reader | guard.test.mjs |
| T22 | 2 | stop hook: run `feat`, end `other` and a stage ready: refused | hook | change-loop.test.mjs |
| T23 | 2 | stop hook: run `feat`, end `feat`: allowed | hook | change-loop.test.mjs |
| T24 | 3 | the skill's `resolve-release-conflict` and `renumber-adr` items each hold `reply blocked --param id=<id> --param why=role-failed --param stage=` after `Outcome: failure` | skill text | change-loop.test.mjs |
| T25 | 10 | first red: `declare feat gate-red --param phase=1` at the phase 1 gate prints `devkit-run: feat`, an `agent` action to `devkit-core:tdd-implementer`, step `fix-gate`, detail `{ phase, task, command }`, no `devkit-end:`, exit 0, and the record holds one entry | loop CLI | change-loop.test.mjs |
| T26 | 10 | second red of phase 1: `devkit-end: feat blocked`, `end.why` `tests-red`, `params.phase` 1, exit 2, two entries | loop CLI | change-loop.test.mjs |
| T27 | 10 | with one red recorded, `next` at the gate still gives `gate`, never `fix-gate` | loop CLI | change-loop.test.mjs |
| T28 | 10 | a red of phase 1 recorded, the first red of phase 2 gives `fix-gate` for phase 2 | loop CLI | change-loop.test.mjs |
| T29 | 10 | `declare gate-red --param phase=2` while the next action is the phase 1 gate (or an agent step) exits 3, `declare-not-at-gate`, nothing recorded | loop CLI | change-loop.test.mjs |
| T30 | 10 | stop hook after the first-red output with the fix not handed: refused; after the second-red output: allowed | hook | change-loop.test.mjs |
| T31 | 10 | the skill's `gate` item names `declare <id> gate-red --param phase=<n>` and the exit-3 fallback; roadmap item 3 the same | skill text | change-loop.test.mjs |
| T32 | 7 | `nextStep`: `FAIL (round 2/2)`, current rejected, `roundLimit` 3: `fix-review`, not the deadlock | checker | deliver-check.test.mjs |
| T33 | 7 | `nextStep`: limit 3, the rejected review stale after the fix, `review.md` at `FAIL (round 2/2)`: `review` round 3, `limit` 3 | checker | deliver-check.test.mjs |
| T34 | 7 | `nextStep`: limit 3, `FAIL (round 3/3)`, current rejected: `stop-review-deadlock` | checker | deliver-check.test.mjs |
| T35 | 7 | `nextStep`: no `roundLimit`, a `review` after round 1 carries no `limit` key | checker | deliver-check.test.mjs |
| T36 | 7 | the resolution path: `res.limit` 3 and a rejected round 2 give `fix-resolution`, then `review-resolution` round 3 with `limit` 3; `res.limit` 3 and a rejected round 3 the deadlock; no `res.limit` the deadlock after round 2 | checker | delivery-models.test.mjs |
| T37 | 7 | `collectState`: `roundLimit` is 2 with no record, 3 with one `review-round` entry of scope `review` or with no scope, 2 with only a `resolution` entry, 2 with an unreadable record | checker | deliver-check.test.mjs |
| T38 | 7 | `declare review-round --param words=...` at the code review's deadlock (the blocked `ceiling` end of the `review` stage, D-4): exit 0, `devkit-run:` line, the action is `fix-review`, `declared.reply` says round 3, one entry of scope `review` and round 3 with the words | loop CLI | change-loop.test.mjs |
| T39 | 7 | without `words` (or empty): exit 3 `declare-no-words`, nothing recorded, `next` still the blocked `ceiling` end of `review` | loop CLI | change-loop.test.mjs |
| T40 | 7 | away from the deadlock (an `implement` step), and a second `declare` right after T38's (the next action is `fix-review`): exit 3 `declare-not-at-deadlock`, nothing recorded | loop CLI | change-loop.test.mjs |
| T41 | 7 | `validateArgs`: round 3 with limit 3 accepted | round script | review-round.test.mjs |
| T42 | 7 | `validateArgs`: round 4 with limit 3, limit 1, limit 2.5 and limit `'3'` refused | round script | review-round.test.mjs |
| T43 | 7 | the consolidated text with limit 3: `(round 3/3)`, `Consensus deadlock after round 3`, and the stage prompts `round 3 of 3` | round script | review-round.test.mjs |
| T44 | 7 | ship-change's `stop-review-deadlock` row and the devkit skill's Owner gates name `declare <id> review-round` and the owner's own typed message; the Owner gates name the `blocked` `ceiling` end of the `review` stage as the code review's deadlock; the `review` row passes `next.limit`; review-change's `args` names `limit` | skill text | change-loop.test.mjs |
| T45 | 13 | a PR conflicting outside the release files: the row is `resolve-base-conflict`, actor `subagent` `devkit-core:tdd-implementer`, detail `paths`, `others`, `base`, `number` | checker (real git) | conduct-check.test.mjs |
| T46 | 13 | a conflict in release files and in another file: `resolve-base-conflict` with both in `paths` and only the other in `others` (`others` is `classifyConflict`'s `blocking`, so a CI-pin file git cannot merge would be in it too; this test uses an ordinary file) | checker (real git) | conduct-check.test.mjs |
| T47 | 13 | a conflict only in release files: still `resolve-release-conflict` | checker (real git) | conduct-check.test.mjs |
| T48 | 13 | the archive PR conflicting outside the release files: `resolve-base-conflict` with `archive: true` | checker (real git) | conduct-check.test.mjs |
| T49 | 13 | `decide` on a `resolve-base-conflict` row: an `agent` action to the implementer, stage implementation | loop | change-loop.test.mjs |
| T50 | 13 | the skill item and the ship-change row of `resolve-base-conflict` hold the merge sentence, "never push" and the role-failed declared end | skill text | change-loop.test.mjs |
| T51 | 8 | `planDigest`: ticking a task (`[x]`, `[X]`, `[ x]`) leaves it equal | checker | deliver-check.test.mjs |
| T52 | 8 | `planDigest`: an edit of `design.md`, of `proposal.md`, of a spec delta, and a new task line in `tasks.md` each change it | checker | deliver-check.test.mjs |
| T53 | 8 | `planDigest`: `evidence.md`, `review.md`, `reviews/x.md` and `declared.json` leave it equal | checker | deliver-check.test.mjs |
| T54 | 8 | `planDigest`: a missing `design.md` and an empty one differ; no `specs/` folder adds nothing | checker | deliver-check.test.mjs |
| T55 | 8 | `planRevision`: no `- Plan:` line gives `changed: false`; an equal one `false`; a different one `true` | checker | deliver-check.test.mjs |
| T56 | 8 | `nextStep`: started, approval not ok, `plan.changed`: `stop-plan-approval` with `detail.plan`; started, approval not ok, not changed: no stop | checker | deliver-check.test.mjs |
| T57 | 8 | flow-check: started, approval ok, plan changed: readiness `stale`, reason `plan-revised`, next stage readiness | stage checker | flow-check.test.mjs |
| T58 | 8 | flow-check: started, approval ok, only a tick since: readiness passed | stage checker | flow-check.test.mjs |
| T59 | 8 | flow-check: started, evidence written since: readiness passed | stage checker | flow-check.test.mjs |
| T60 | 8 | loop: the revised plan hands the readiness reviewer "out of date"; after its rewrite, `waiting-approval-again` with `detail.readiness` and `detail.plan` | loop | change-loop.test.mjs |
| T61 | 8 | ship-change's `stop-plan-approval` row holds `- Plan: <next.plan>`; the devkit skill names `ask.action.detail.plan` | skill text | change-loop.test.mjs |
| T62 | 9 | `parseTasks`: `Conductor:` at the start is marked; mid-sentence is not; a `Gate:` task is not | checker | deliver-check.test.mjs |
| T63 | 9 | `readPhases`: `conductor` lists the open marked ids; `[]` when none | checker | deliver-check.test.mjs |
| T64 | 9 | `nextStep`: a phase whose first open task is marked gives `conductor-task` with the leading marked ids | checker | deliver-check.test.mjs |
| T65 | 9 | `nextStep`: an unmarked task before a marked one gives `implement` with `stopAt` | checker | deliver-check.test.mjs |
| T66 | 9 | `nextStep`: no marked task gives `implement` with exactly `{ phase }` | checker | deliver-check.test.mjs |
| T67 | 9 | an unticked marked task holds the gate and is listed unticked by `tasksItem`; ticked, the gate follows | checker | deliver-check.test.mjs |
| T68 | 9 | `decide` on a `conductor-task` row is a `session` step of the implementation | loop | change-loop.test.mjs |
| T69 | 9 | tdd-implementer's text, the ship-change rows `conductor-task` and `implement`, and both schemas' tasks instruction (both copies) name the marker | skill text | change-loop.test.mjs |
| T70 | 12 | `pr-verifier` writes `proof/run.txt` and `proof/runs/a.jsonl` of the active change: allowed | hook | guard.test.mjs |
| T71 | 12 | `pr-verifier` redirects into `proof/out.txt`: allowed; into `design.md`: refused | hook | guard.test.mjs |
| T72 | 12 | `pr-verifier` writes `proposal.md`, `other/proof/a.txt` and `src/a.ts`: each refused | hook | guard.test.mjs |
| T73 | 12 | `tdd-implementer` and the main session write under `proof/` as before; `change-planner` writing `evidence.md` is still refused | hook | guard.test.mjs |
| T74 | 12 | `pr-verifier.md` names the `proof/` folder and no longer says "the only file you write" | agent text | deliver-check.test.mjs |
| T75 | 4 | for every role of the exported `AGENT_ROLES`, the exported `AGENT[role]` is `${PACKS[role]}:${role}`, and `COMMIT_AGENT` is `agentOf('commit-and-pr')` | loop | change-loop.test.mjs |
| T76 | 4 | a map built from a `PACKS` with one pack changed differs from the shipped one (the test fails on a drift); `agentOf('owner')` is undefined | loop | change-loop.test.mjs |
| T77 | 4 | project-loop's ADR reviewer agent is `agentOf('adr-reviewer')` | loop | project-loop.test.mjs |
| T78 | 5 | ADR 0011 has a `Note (coordinator-loop-fixes, <date>)` naming the stop lock, the run's change and ADR 0022, and its `## Decision` section equals the text held in the test | doc | change-loop.test.mjs |
| T79 | 6 | `normalizeLang`'s fallback equals `userConfig.language.default` of devkit-openspec's `plugin.json` | loop | change-loop.test.mjs |
| T80 | 6 | each `DECLARED` reply key rendered with `--lang '${user_config.language}'` and with `--lang ''`, with the parameters it needs (`id`, and `decision` for `waiting-owner-decision`), equals the pt-BR text and holds no `${` | loop CLI | change-loop.test.mjs |
| T81 | 6 | `next` on a fixture change with `--lang '${user_config.language}'` gives the pt-BR reply of the same action | loop CLI | change-loop.test.mjs |
| T82 | 11 | the skill's `## Waiting on GitHub` holds the host-monitor paragraph (no wait, a sentence that the host's monitor holds the wait, end the turn, the next turn runs `next`) after the unchanged first paragraph; devkit-session's item 3 holds the same exception | skill text | change-loop.test.mjs |
| T83 | 15 | `docs/openspec-flow.md`'s `devkit-lite` section records both decisions | doc | change-loop.test.mjs |
| T84 | 16 | the `devkit-lite` flow declares the same stages as before (a constant held in the test) | schema | change-loop.test.mjs |
| T85 | 14 | `createdAfter` with `.openspec.yaml` unreadable (a folder at that path) is false and does not throw | loop | change-loop.test.mjs |
| T86 | 14 | `unfinished` does not list a change whose `.openspec.yaml` cannot be read and whose id is archived | loop | change-loop.test.mjs |
| T87 | 14 | the change-coordination delta words the archive sources as their union (reads this change's delta until the archive, then the main spec) | doc | change-loop.test.mjs |
| T88 | 14 | `github-setup.mjs` with Actions disabled exits 1 | setup script | github-setup.test.mjs |
| T89 | 14 | with the newest runs failed without starting exits 1 | setup script | github-setup.test.mjs |
| T90 | 14 | with the rulesets refused exits 1 | setup script | github-setup.test.mjs |
| T91 | 14 | with nothing blocked and the Actions state unknown exits 0 | setup script | github-setup.test.mjs |
| T92 | 14 | a roadmap run handing a change's `commit` step: the action's brief equals `change-loop.mjs next`'s brief and ends with `ATTRIBUTION_ASK` | loop | roadmap-loop.test.mjs |
| T93 | 8 | flow-check on a `devkit-lite` change: a task ticked, `approval.md` holding a `- Plan:` that differs, `design.md` edited after the tick: no stage stale, no `plan-revised` reason | stage checker | flow-check.test.mjs |
| T94 | 8 | `nextStep` on the same `devkit-lite` fixture: `state.plan` is null and no `stop-plan-approval` is given | checker | deliver-check.test.mjs |
| T95 | 7 | `decide` on `stop-review-deadlock` with `resolution: true`: `waiting-review-dispute` with `detail.resolution` true; without it, no `detail` | loop | change-loop.test.mjs |
| T96 | 7 | `declare review-round --param words=...` at the resolution's deadlock records `scope: 'resolution'`, `round` 3, and `next` gives `fix-resolution`; at the code review's deadlock it records `scope: 'review'` | loop CLI | change-loop.test.mjs |
| T97 | 7 | `collectState` on a `two-prs` fixture: the resolution's `limit` is 3 with one `resolution` entry and 2 with only a `review` entry | checker | delivery-models.test.mjs |
| T98 | 1 | `guardBash`: a subagent (`tdd-implementer`) running `node plugins/openspec/hooks/change-loop.mjs declare feat review-round --param words=x` is refused, the message naming the main session | hook | guard.test.mjs |
| T99 | 1 | `guardBash`: the same with a quoted path (`node "$CLAUDE_PLUGIN_ROOT/hooks/change-loop.mjs" declare feat gate-red --param phase=1`) and after `cd <dir> &&` is refused | hook | guard.test.mjs |
| T100 | 1 | `guardBash`: the main session's same two commands are allowed | hook | guard.test.mjs |
| T101 | 1 | `guardBash`: a subagent running `change-loop.mjs next feat --lang en` or `change-loop.mjs reply waiting-pause --param id=feat` is allowed | hook | guard.test.mjs |
| T102 | 1 | `guardBash`: a subagent's `git commit -m "add the declare verb to change-loop.mjs"` and a heredoc whose body holds a `node .../change-loop.mjs declare` line are allowed | hook | guard.test.mjs |
| T103 | 1 | `guardBash`: in a project whose config selects no devkit schema, a subagent's `declare` command is allowed | hook | guard.test.mjs |
| T104 | 1 | a subagent's edit of `openspec/changes/other/declared.json` while `feat` is the active change is refused; `declareViolation('...declare...', '')` is null | hook | guard.test.mjs |
| T105 | 7 | `computeFlow`, no record (no `authorizedReviewRounds` fact, and the fact 0): `review` failed at attempt 2 ends blocked `ceiling-reached` `{ stage: 'review', attempt: 2, ceiling: 2 }` | stage checker | flow-check.test.mjs |
| T106 | 7 | `computeFlow`, one record (`authorizedReviewRounds: 1`): `review` failed at attempt 2 gives no end, `next` the implementation with `fix-after-failure` `{ failed: 'review', attempt: 2, ceiling: 3 }` and the review's `header-failed` params `{ attempt: 2, ceiling: 3 }`; with its header stale, `next` the review with `rerun-after-fix` | stage checker | flow-check.test.mjs |
| T107 | 7 | `computeFlow`, one record, the authorized round failed: `review` failed at attempt 3 ends blocked `ceiling-reached` `{ stage: 'review', attempt: 3, ceiling: 3 }` | stage checker | flow-check.test.mjs |
| T108 | 7 | `computeFlow`, two records of the code review (`authorizedReviewRounds: 2`): attempt 3 offers the fix, attempt 4 ends blocked with ceiling 4; and on the `devkit` flow with its `review` ceiling set to 1 (as the synthetic version 2 of `version-pin.test.mjs` sets it), one record: attempt 1 offers the fix, attempt 2 ends blocked with ceiling 2 | stage checker | flow-check.test.mjs |
| T109 | 7 | `computeFlow`, one record: a failed `evidence` and a failed `readiness` at attempt 3 still end blocked at ceiling 3; on the `devkit-project` flow (its `review` stage of role `adr-reviewer`, ceiling 2) a review failed at attempt 2 still ends blocked at 2 | stage checker | flow-check.test.mjs |
| T110 | 7 | `collectFlow` on a change folder (the `fakeOpenspec` fixture of the existing `collectFlow` tests): `authorizedReviewRounds` is 0 with no `declared.json`; 1 with one `review` entry; 1 with one entry with no `scope`; 1 with one `review` and one `resolution` entry (records for different reviews); 0 with only a `resolution` entry (a record for the other review); 2 with two `review` entries; 0 with an unreadable record | stage checker | flow-check.test.mjs |
| T111 | 7 | through `nextAction`, on `deliveredChange()` with `review.md` at `Consensus: FAIL (round 2/2)`, its header `result=failed attempt=2` and `code-quality-reviewer` `Verdict: rejected` at the code commit: `next` exits 2 with the blocked end `ceiling` on `review`; `declare feat review-round --param words="one more round"` gives `fix-review`; after a fixture fix commit and `evidence.md` re-headed at it, `next` gives the `review` step with `detail.round` 3 and `detail.limit` 3; with `review.md` then at `FAIL (round 3/3)`, its header `result=failed attempt=3` and a current rejection, `next` is the blocked `ceiling` end again with attempt 3 | loop CLI | change-loop.test.mjs |
| T112 | 7 | `deadlockScope`: `waiting-review-dispute` with `detail.resolution` gives `resolution`, without it `review`; a blocked `ceiling` end of role `review-bench` gives `review`; a blocked `ceiling` end of the readiness, of the evidence and of role `adr-reviewer`, a blocked `no-progress` end of the review, and an `agent` step each give null | loop | change-loop.test.mjs |
| T113 | 7 | `REVIEW_ROUNDS` of `deliver-check.mjs` equals the `ceiling` of the `review` stage in `plugins/openspec/schemas/devkit/flow.json` and `plugins/openspec/schemas/devkit-lite/flow.json` | schema | deliver-check.test.mjs |
| T114 | 1 | `RECORDED_KEYS` of `deliver-check.mjs` equals the keys of `DECLARED` whose `via` is `declare` | loop | change-loop.test.mjs |

T87 reads the spec text: until the archive moves the delta into the main spec, it reads
`openspec/changes/coordinator-loop-fixes/specs/change-coordination/spec.md` when that file exists,
else `openspec/specs/change-coordination/spec.md`, and asserts "the union of every source".

## D-17 Siblings and the merge of `origin/main`

| Sibling (roadmap line) | What it touches that this change also touches |
|---|---|
| `loop-place-and-evidence` | `change-loop.mjs` `stopDecision`, `END_OF_KEY` (a place end), the `waiting-` keys of `MESSAGES` and `GATE_OF_WHY`; `deliver-check.mjs` `nextStep` around `verify` and `review`; `devkit/SKILL.md` `## Loop` |
| `fresh-base-check` | `conduct-check.mjs` `releaseConflict` and `deliveryRow` (a fetch before the judgment); `deliver-check.mjs` `update-branch` |
| `post-merge-validate` | `deliver-check.mjs` `nextStep` after a base merge; `flow-check.mjs` `artifactState` attempts of the evidence |
| `stale-only-on-own-files` | `deliver-check.mjs` `staleness`, `gitFacts`, `touchedPaths` (no overlap with `planDigest`) |
| `stage-ceiling-consecutive` | `flow-check.mjs` `artifactState` and `computeFlow` ceilings: it changes how failures are counted (since the last passed attempt), this change how many are allowed (`ceilingOf`, the code review's ceiling plus its authorized rounds, D-4); `flow-check.test.mjs` around lines 534-549 |

Whichever lands first, the other merges it. This change merges `origin/main` before its last gate
(task 6.1), then runs the whole suite once on the merged head; if `loop-place-and-evidence` landed a
place key in `END_OF_KEY`, that key becomes a `reply` row of `DECLARED` with its gate, and the
roadmap test of every owner wait gains it. If `stage-ceiling-consecutive` landed first, the
comparison of `computeFlow` keeps its count of failures on the left and `ceilingOf(stage, flow, facts)`
on the right, `artifactState`'s `header-failed` parameters take `ceilingOf` too, and its tests and
T105 to T109 must all pass on the merged head (D-4 says why T105 to T109 hold under either count).
Before the first long evidence run, the conducting session asks the coordinator to pause sibling
merges (owner's lesson).

## D-18 Release

`CONTRIBUTING.md`, step 5, against `origin/main` at the last merge before review: devkit-openspec and
devkit-core take the next minor after `main`'s (today 0.33.0 to 0.34.0 and 0.14.0 to 0.15.0), in
each `plugin.json` and in `.claude-plugin/marketplace.json`, whose own version takes its next minor
(today 0.37.0 to 0.38.0); `CHANGELOG.md` a section for the marketplace version with one bullet per
pack and a docs bullet; every `v0.33.0` mention of `docs/openspec-flow.md` (the CI snippet's lines 661
and 662, and the two on line 675) names the new devkit-openspec version. `docs/catalog.md` does not change (no
description changes; `gen-catalog.py --check` proves it). The tag is the loop's `tag-release` step.

## Decisions and ADRs

- ADR 0022 (proposed, `decisions.md`) is the decision behind D-1 to D-7; the plan follows its eight
  points. Read for this plan: ADR 0010 (decisions 3, 5, 6, 8), ADR 0011, ADR 0016, ADR 0017, ADR 0021
  (only the owner's own typed message is a go-ahead), ADR 0002 and ADR 0003 (merge mode, unchanged).
- Not recorded as an ADR, per `decisions.md`: the verifier's `proof/` folder, the host-monitor wait,
  the shared agent map, the language check, the nits and the two `devkit-lite` decisions.
- Rejected alternatives that an ADR already rejected are not used: no fifth end state (ADR 0022), no
  unbounded fix loop (ADR 0022, ADR 0010 decision 3's ceilings), no authorization from any message
  (ADR 0011, ADR 0021), no lifting of the edit lock for a conductor task (ADR 0010 decision 8, ADR 0011
  decision 2).
- ADR 0022 decision 3 ("recorded from the owner's session ... a message from another session or
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
| Record the authorized round in `review.md` | `review.md` is the round's output; editing it is the hand-edited header ADR 0022 forbids |
| Turn the stage walk's `ceiling-reached` on `review` into `waiting-review-dispute` in `decide` | It changes what the owner sees at every round-2 FAIL with no authorization (a blocked end becomes a wait), which AC-16 keeps as today, and the walk would still block a third round, so the ceiling would need lifting anyway |
| Drop the `review` stage's numeric ceiling and let the delivery checker own the round limit | A `flow.json` change needs a new flow version, and a change under way keeps every rule of the version it opened with (`openspec/specs/change-stages/spec.md`, the version-pin requirement), so changes opened before it would keep the numeric ceiling anyway; one count read by both checkers keeps both bounds and lifts them together |
| A `fix-gate` row in `ROWS` returned by the delivery checker | The checker cannot know the gate was red (the session ran it); a row no checker returns breaks the rows-match invariant |
| Stale the plan by file times after the start, ignoring `tasks.md` | A tick and a task edit are both `tasks.md` writes; only content tells them apart |
| One counter of authorized rounds for both reviews | An owner's word at the code review's deadlock would hand an unasked round to a later resolution review |
| Keep the resolution's review at two rounds | An authorization recorded at the resolution's deadlock would then change nothing, and the owner's word would be lost (readiness finding 2) |
| Word the declared-steps record as a direct-write rule only | `guardBash` sees the command a subagent runs (it already judges `gh pr create` by its text), so the command can be refused at the same layer |
| Record the plan digest in `readiness.md` | That changes what the readiness reviewer writes and every readiness ever written; the approval is the record the owner already writes from `next` |
| Keep a blocked end for a conflict outside the release files and let the owner merge | The retro's finding; ADR 0022 decision 5 |

## Risks / Trade-offs

| Risk | Probability × impact | Mitigation |
|---|---|---|
| A sibling lands a change to `END_OF_KEY`, `nextStep` or `artifactState` first and the merge conflicts | HIGH × MEDIUM | D-17; merge before the last gate; one full suite per merge that matters; ask a merge pause before the long evidence run |
| `resolve-base-conflict` judges against a stale `origin/<base>` until `fresh-base-check` lands | MEDIUM × LOW | The implementer's merge shows the real conflict; a clean merge gives `update-branch` as today |
| The implementer resolves a conflict wrongly | MEDIUM × MEDIUM | `verify` and `review` run before the push (D-5); `Outcome: failure` ends blocked |
| A session declares `review-round` without the owner's typed message | LOW × HIGH | The skill rule (D-4) and the words recorded in `declared.json`; a subagent can neither write the file (edit tool or redirect, any change's folder) nor run `change-loop.mjs declare` (the `guardBash` rule of D-1, T98 to T104); the main session's own misuse rests on the skill rule and the recorded words, as the plan approval does; the review trigger of ADR 0022 |
| A subagent's command names `node .../change-loop.mjs declare` inside a quoted string (a commit message) and is refused | LOW × LOW | The rule needs a `node` call before the script; the refusal names the main session, and the subagent rephrases (T102 pins the ordinary commit message) |
| An authorization at one deadlock lifts the other review's limit | LOW × MEDIUM | Each entry records its `scope` from the deadlock it answers (D-4); T96, T97 |
| The plan digest changes for an edit that is not a plan change (a header rewrite of `tasks.md`) | LOW × MEDIUM | Only `tasks.md`'s checkboxes are ignored; any other edit after the approval is a plan edit by the ADR, and asks the owner once |
| A host's monitor wakes on a failure only, so a green pull request waits for the owner's message | HIGH × MEDIUM | AC-11's deferred half (D-10): the roadmap line `host-monitor-wake` and this change's retro carry it; the reply says calling `/devkit change` again is safe |
| The conducting session hands phase 4 before R10 is recorded | LOW × MEDIUM | D-14 and task 4.1 say R10 comes first; the implementer stops on an open 4.1, and 4.6 writes no language sentence without R10's `pass` line |
| The two new reply keys widen the replies a session must choose from | LOW × LOW | T12 and the skill name when each applies |
| The suite takes longer (about 114 new tests) | HIGH × LOW | Phase gates run this change's tests, the kept tests of their area and `check.py`; the whole suite runs once, in 6.6 |
| The stage walk's ceiling and the delivery checker's limit drift apart, so an authorization lifts one and not the other | LOW × HIGH | One count (`authorizedRounds`) read by both checkers; `ceilingOf` the one function of every ceiling (D-4); T105 to T111 walk both through `nextAction`; T113 pins the shipped flows' `review` ceiling to `REVIEW_ROUNDS` |
| `stage-ceiling-consecutive` lands first and its count meets this change's ceiling in a merge conflict | MEDIUM × MEDIUM | D-4 and D-17: the sibling's count on the left, `ceilingOf` on the right; T105 to T109 hold under either count; the merge comes before the last gate (6.1) and the whole suite runs on the merged head (6.6) |
| A real run that calls `declare` is given to a subagent and refused, or a run's loop output lands in the conducting session's transcript and moves its stop lock to the scratch change | MEDIUM × MEDIUM | D-14's four rules: a direct `declare` is the conducting session's (6.3), a nested one is the nested main session's with the prompt in a file, fixtures by a script that never writes `declared.json`, and the conducting session's loop output only in files checked with `grep -c` |

## Migration Plan

No data migration. A change under way keeps running: no `declared.json` means no red gate and no
authorized round recorded, so every stage ceiling and round limit is today's; an approval with no `- Plan:` line asks nothing again; a `tasks.md` with
no `Conductor:` task reads as today. Rollback is reverting the release: `declared.json` files left in
change folders are then ignored.

## Implementation plan

Order (dependency): D-1 and D-2 (the mechanism and the marker), then D-3, D-4, D-5 (the steps that
use it), then D-6 and D-7 (the delivery checker's new facts), then D-8 to D-12 (independent), then
D-13 (the nits), then the merge, the release and D-14.

**Per surface.** Hooks (`plugins/openspec/hooks/`): `change-loop.mjs` (D-1, D-3, D-4, D-5, D-6,
D-7, D-9, D-13), `guard.mjs` (D-1 file and command rules, D-2, D-8), `deliver-check.mjs` (D-1 reader, D-4, D-6, D-7),
`flow-check.mjs` (D-4 `ceilingOf` and `authorizedReviewRounds`, D-7), `conduct-check.mjs` (D-5, D-6), `roadmap-loop.mjs` (D-1), `project-loop.mjs`
(D-9). Skills: `devkit`, `devkit-session`, `ship-change` (openspec pack); `review-change` and its
workflow (core pack). Agents: `pr-verifier.md`, `tdd-implementer.md`. Schemas: four `schema.yaml`
files. Docs: D-12.

**File structure.** Create: none outside tests' fixtures and this change's `proof/`. Modify: the files
above, their test files (`change-loop.test.mjs`, `guard.test.mjs`, `deliver-check.test.mjs`,
`flow-check.test.mjs`, `conduct-check.test.mjs`, `roadmap-loop.test.mjs`, `delivery-models.test.mjs`,
`project-loop.test.mjs`, `review-round.test.mjs`, `github-setup.test.mjs`), `docs/openspec-flow.md`,
`docs/coordination-design.md`, `docs/adr/0011-...md`, `openspec/config.yaml`, `openspec/roadmap.md`
(the `host-monitor-wake` line, D-10), `CHANGELOG.md`, the three manifests. Delete: none.

**Estimate.** Optimistic 26 h, likely 35 h, pessimistic 49 h.

| Component | Hours | Type | Risk |
|---|---|---|---|
| D-1 table, helper, `declare`, record, guard file and command rules | 5 | Core | MEDIUM |
| D-2 marker id | 1 | Core | LOW |
| D-3 red gate | 2.5 | Core | MEDIUM |
| D-4 round limits (review and resolution), the review stage's ceiling, `deadlockScope`, round script, skills | 6 | Core | MEDIUM |
| D-5 conflict outside release files | 2 | Integration | MEDIUM |
| D-6 conductor tasks | 2.5 | Core | LOW |
| D-7 plan digest and revised plan | 3.5 | Core | MEDIUM |
| D-8 to D-11 | 2.5 | Core | LOW |
| D-12 documents and schemas | 1.5 | Documentation | LOW |
| D-13 nits | 1.5 | Testing | LOW |
| D-14 real runs (R1 to R14, R7b, R7s, R13a, R13b; R6, R7, R7b by the conducting session) | 5.5 | Testing | MEDIUM |
| D-17 merge, D-18 release, whole suite | 1.5 | Migration | MEDIUM |

**Assumptions** (where the plan breaks if reality differs): `nextAction` can be called from `declare`
in the same process as `next` (it is exported and pure but for its reads; `change-loop.mjs`);
`git merge-tree --write-tree` lists every conflicting path on its first lines after the tree id
(`conduct-check.mjs` `conflictedPaths`); `review.md`'s consensus regex already reads any `/N`
(`deliver-check.mjs` `readReviewMd`); the `review` header's attempt is the round (the `review` row of
`ship-change/SKILL.md`), so the stage ceiling counts review rounds and one authorization lifts it by
exactly one round (D-4); `devkit-session` carries out every kind as the devkit skill's
Loop says (`devkit-session/SKILL.md` item 3); a fixture can make `.openspec.yaml` unreadable with a
folder at its path.

**Dependencies:** ADR 0022 accepted at the plan approval (`accept-decisions`); no sibling change is
required first.

## Open Questions

- AC-11's deferred half (D-10): whether the desktop app's pull-request monitor wakes the session when
  the checks pass. The roadmap-coordinator retro says it wakes "on a failure and not on success". It
  is not settled here; the roadmap line `host-monitor-wake` (task 6.5) carries it to the next change
  run in the app, and this change's retro records what its own wait on GitHub showed.
