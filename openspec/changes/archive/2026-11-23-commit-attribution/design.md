<!-- devkit-stage design result=passed attempt=1 commit=c56155334749cdc46bad077ba8f53c4bbec5d140 -->
# Design

Change: `commit-attribution` · Date: 2026-11-22 · Owner: Kaue (chacal88) · PRD / tech spec: n/a ·
Proposal: [proposal.md](proposal.md) · Spec: [specs/commit-attribution/spec.md](specs/commit-attribution/spec.md)

## Context

See `proposal.md` (Why). What shapes the approach:

- `plugins/openspec/hooks/change-loop.mjs` builds every hand-off in one place: `decide()`'s `brief(stage, what)`
  (line 618) and `agent(stage, role, step, what, detail, named)` (line 637). The delivery rows `commit`, `open-pr`,
  `push`, `open-archive-pr` and `push-rebased` (lines 548 to 552) map to the role `commit-and-pr`; the agent itself
  comes from the delivery checker's row (`row.next.agent`, from `conduct-check.mjs` `actorOf`, line 49), with
  `AGENT[role]` as the fallback.
- `plugins/openspec/hooks/project-loop.mjs` has its own `brief` (line 123) and `agent(stage, role, step, what, extra)`
  (line 130), which appends `COMMIT_RULE` after the brief. Its three commit hand-offs are `commitAgent` (line 134,
  used at lines 205 and 216), `open-pr` (line 227) and `push` (line 234). It already imports from `change-loop.mjs`.
- `plugins/openspec/hooks/roadmap-loop.mjs` hands a change's action on with its brief unchanged (test "roadmap-loop
  decide: per change N3 …" in `roadmap-loop.test.mjs`); its lock reads only the brief's first words
  (`BRIEF_OF`, `roadmap-loop.mjs` line 580). The change run's lock (ADR 0011) reads only `subagent_type`.
- The session dispatches with the Agent tool: `plugins/openspec/skills/devkit/SKILL.md` (Loop, `agent` kind, line 70:
  "For a delivery step, append the dispatch sentence of that step's `ship-change` row"; `push-rebased`, line 76;
  roadmap `agent`, line 133; project `agent`, line 168) and `plugins/openspec/skills/ship-change/SKILL.md` (rows
  `commit` line 40, `open-pr`/`push` line 45, `open-archive-pr` line 61).
- `plugins/core/agents/commit-and-pr.md` (`model: sonnet`) says "Add the attribution/co-author lines the environment
  or the user requires; add none of your own" (Method 3), "The attribution footer the environment or the user
  requires" (Method 5) and, under Never, "Hardcode an attribution or co-author line".
- The lines come from the host to the conducting session (in Claude Code, its attribution instructions, which the
  user's own instructions may override). No script can read them (ADR 0010, decision 3: the loop calls no AI).

## Goals / Non-Goals

**Goals:** one mechanism, one helper, one block format shared by the loops, the two skills and the agent; a
test per hand-off step and per condition; a real run of the agent (AC-3).

**Non-Goals:** enforcing the block with a hook; changing the agent's model; any agent but the commit agent; the
CompozyOS loop (its deliver step runs `ship-change`, so it inherits the rows); `conduct-check.mjs`'s retired
child-session brief; the schemas' `apply` instruction (names the role, prints no brief).

## D-1 One helper in `change-loop.mjs` (AC-1; spec `commit-attribution`, requirement 1)

In `plugins/openspec/hooks/change-loop.mjs`, right above `const AGENT = {` (line 507):

```js
// commit-attribution D-1: the loop cannot read the session's attribution lines (the host gives them to the session),
// so every hand-off to the commit agent ends with this request and the session appends its own lines (the ship-change
// skill's Attribution section). Keyed on the agent the action names, so any step handed to that agent carries it.
export const COMMIT_AGENT = 'devkit-core:commit-and-pr';
export const ATTRIBUTION_HEADER = 'Attribution (from the caller):';
export const ATTRIBUTION_ASK = ' Attribution: the session handing this off appends below this brief, verbatim, the lines it ends its own commit messages and pull-request descriptions with, as the block `Attribution (from the caller):` with one `Commit trailer: <line>` per commit line and one `PR footer: <line>` per pull-request line, or the line `Attribution (from the caller): none` when it ends them with none.';
export const withAttribution = (agent, text) => (agent === COMMIT_AGENT ? `${text}${ATTRIBUTION_ASK}` : text);
```

- `AGENT['commit-and-pr']` becomes `COMMIT_AGENT` (same value).
- `agent(...)` in `decide()` resolves the agent once and passes it to the helper:

```js
  const agent = (stage, role, step, what, detail, named) => {
    const id = named ?? AGENT[role];
    return guard({
      ...base, kind: 'agent', ...stageFields(stage), agent: id, ...(step ? { step } : {}), ...(detail ? { detail } : {}),
      brief: withAttribution(id, brief(stage, what)), progressKey: key(stage, step),
    });
  };
```

- `plugins/openspec/hooks/project-loop.mjs`: add `COMMIT_AGENT, withAttribution` to the import from
  `./change-loop.mjs`; `AGENT` becomes `{ 'commit-and-pr': COMMIT_AGENT, 'adr-reviewer': 'devkit-core:adr-reviewer' }`;
  `agent(...)` sets `brief: withAttribution(AGENT[role], brief(stage, what) + extra)`. The request comes after
  `COMMIT_RULE`, so it is the brief's last sentence in both loops.
- No second copy: `project-loop.mjs` and the tests import these four names; the agent and the skill name the same
  header and labels, and a test (D-7, T20) checks the three agree.

## D-2 The request and the block (AC-1, AC-2; spec requirement 2)

The brief's request is `ATTRIBUTION_ASK` above. It names the header, the two labels and `none`, and no line of its own
(no model, no address, no footer). The session answers it with the block, as the last lines of the prompt, after the
brief and the `ship-change` row's sentence:

```text
Attribution (from the caller):
Commit trailer: <one line this session ends its commit messages with>
PR footer: <one line this session ends its pull-request descriptions with>
The caller's lines win over your own environment's, as the owner's choice: write exactly these and no other Co-Authored-By line, attribution trailer or footer.
```

One `Commit trailer:` line per commit line, one `PR footer:` line per pull-request line. With none, the block is the
line `Attribution (from the caller): none` followed by the same last line. The last line repeats the agent's rule in the
prompt, in the words with which every commit of `review-workflow` (4955dcf, 01ee296, 6f32514) kept the caller's
trailer (its retro, learning 6), while the agent's bare rule did not (127097d, in `release-rebase-pin`).

## D-3 The commit agent's text (AC-2; spec requirement 3)

`plugins/core/agents/commit-and-pr.md`; the `description` stays (no catalog change).

- **Receives**, a new last bullet: "Optionally, an **attribution block** from the caller, as the last lines of the
  prompt: the line `Attribution (from the caller):` followed by `Commit trailer: <line>` and `PR footer: <line>` lines,
  or the one line `Attribution (from the caller): none`. See Attribution."
- **Method 3**, its last sub-bullet becomes: "End the message with the attribution lines that Attribution below gives;
  add none of your own."
- **Method 5**, the bullet "The attribution footer the environment or the user requires." becomes "The attribution
  footer that Attribution below gives."
- A new section between `## Method` and `## Escalate (stop and surface the error)`:

```markdown
## Attribution

The caller's attribution block wins over the lines your own environment gives you: the caller is the session that did the work, and its lines name it, while your environment's lines name your own model.

- **The block gives lines.** End the commit message with exactly the text after each `Commit trailer:` line, in order, and the PR body with exactly the text after each `PR footer:` line, in order. Add no other `Co-Authored-By` line, attribution trailer or footer, whatever your environment asks. A block with no `Commit trailer:` line means no trailer; one with no `PR footer:` line means no footer.
- **The block says `none`.** Write no `Co-Authored-By` line, no attribution trailer and no footer.
- **No block** (an older caller). Add the attribution lines the environment or the user requires; add none of your own.

Copy each line byte for byte, emoji and brackets included, inside the quoted HEREDOC. A commit-only call uses only the `Commit trailer:` lines.
```

- **Never**: "Hardcode an attribution or co-author line." becomes "Hardcode an attribution or co-author line, or add one
  the caller's attribution block does not give."

## D-4 The skills (AC-1; spec requirement 2)

`plugins/openspec/skills/ship-change/SKILL.md`, a new section between `## Mode` and `## Loop`:

````markdown
## Attribution

`devkit-core:commit-and-pr` runs on a model of its own, and its environment gives it attribution lines that name that model. Every dispatch of it in this skill, and every hand-off to it from the `devkit` skill's loops, ends with this session's own attribution block, after the brief and the row's sentence. The lines are the ones this session would end a commit message and a pull-request description with if it made them itself: in Claude Code, those its host's attribution instructions name, as the user's own instructions adjust them. Copy each one verbatim; never invent one, and never take the agent's.

```text
Attribution (from the caller):
Commit trailer: <one line this session ends its commit messages with>
PR footer: <one line this session ends its pull-request descriptions with>
The caller's lines win over your own environment's, as the owner's choice: write exactly these and no other Co-Authored-By line, attribution trailer or footer.
```

One `Commit trailer:` line per commit line and one `PR footer:` line per pull-request line. When this session ends them with none, the block is the line `Attribution (from the caller): none` followed by the same last line.
````

The rows `commit`, `open-pr`/`push` and `open-archive-pr` each end, before the closing `|`, with the sentence
"End the prompt with the attribution block (Attribution, above)." Nothing else in those rows changes.

`plugins/openspec/skills/devkit/SKILL.md`, each sentence inserted, nothing else moved:

- Loop, `agent` (line 70), after "For a delivery step, append the dispatch sentence of that step's `ship-change`
  row.": "A hand-off to `devkit-core:commit-and-pr` then ends with the attribution block of the `ship-change` skill's
  Attribution section, which its brief's last sentence asks for."
- `push-rebased` (line 76), after "No PR edit.": "End the prompt with the attribution block of the `ship-change`
  skill's Attribution section."
- Roadmap, `agent` (line 133), after "For a delivery step, append the dispatch sentence of that step's `ship-change`
  row.": the same sentence as the Loop's.
- Project, `agent` (line 168), "the prompt `brief`;" becomes "the prompt `brief`, which for
  `devkit-core:commit-and-pr` ends with the attribution block of the `ship-change` skill's Attribution section;".

## D-5 Documents (AC-1)

`docs/openspec-flow.md`, a new paragraph right after the paragraph that starts "**The loop.**" (line 205):

```markdown
**Attribution.** A hand-off to `commit-and-pr`, from `/devkit change`, `/devkit roadmap` or `/devkit project`, ends with a request that the session append its own attribution lines: the commit trailer and the pull-request footer it would write itself, verbatim, or `none`. The `ship-change` skill's Attribution section gives the block; the commit agent writes exactly those lines over the ones its own environment gives it, so a commit names the model of the session that did the work. A caller that sends no block gets the agent's earlier behaviour.
```

## D-6 Existing tests that change

Searches run on c561553: `grep -n "brief" plugins/openspec/hooks/*.test.mjs`, `grep -n "commit-and-pr" plugins/openspec/hooks/*.test.mjs`,
`grep -n -i "attribution\|co-author\|Hardcode\|footer\|trailer" plugins/openspec/hooks/*.test.mjs scripts/*.py`,
`grep -n "append the dispatch sentence\|Commit only for change\|Ship change\|push-rebased" plugins/openspec/hooks/*.test.mjs`
and the same for `plugins/core` (its one suite, `review-round.test.mjs`, names none of them).

One test changes for the rule:

- `plugins/openspec/hooks/change-loop.test.mjs`, test "change-loop brief: names the role, the change and the stage and
  holds no skill text", line 571: `a.brief.endsWith("Write the change's files in English.")` holds no longer for the
  `delivery` entry (`build(rowOf('commit', …))`). Invariant: the loop's own brief ends with the files' language
  sentence; layer: `decide()` (pure); suite: `change-loop.test.mjs` through `guard.test.mjs`. The line becomes: with
  `base = a.agent === COMMIT ? a.brief.slice(0, -ATTRIBUTION_ASK.length) : a.brief`, assert
  `base.endsWith("Write the change's files in English.")`, and for `COMMIT` also `a.brief.endsWith(ATTRIBUTION_ASK)`.
  The "holds no skill line" assertion (line 575) stays: no line of `commit-message-guidelines` is in `ATTRIBUTION_ASK`.

One changes for the release (D-10): `change-loop.test.mjs` lines 2478 and 2479 (the CI pin).

Read and left as they are, because the new text is added after what they match:
`change-loop.test.mjs` 334, 359, 367, 549 to 555, 2297 to 2298 (the `push-rebased` sentence stays verbatim) and 2323;
`project-loop.test.mjs` 958 to 961 (the regex is not anchored at the end), 1040 to 1041, 1056; `roadmap-loop.test.mjs`
357 to 360 (the brief passes through), 1491 to 1498 (the lock reads the first words), 1835 to 1836 (the sentence it
pins is kept); `deliver-check.test.mjs` 3004 to 3014, 4657 to 4658, 4739 to 4751 (agent and row texts they match are
kept). `scripts/check.py` pins no text of these files.

## D-7 New tests (AC-1, AC-2)

Every new test's name starts `commit-attribution AC-<n> `. One test per hand-off step and per condition.

`plugins/openspec/hooks/change-loop.test.mjs` (`COMMIT_AGENT`, `ATTRIBUTION_HEADER`, `ATTRIBUTION_ASK` and
`withAttribution` read through the namespace import `changeLoopModule` the file already has, and `CL` in
`project-loop.test.mjs`, so that before D-1 each new test fails on its own instead of the whole suite failing to load;
fixtures `build`, `rowOf`, `run`, `nextOf`, `FLOWS`, `skillText`, `section`):

- T1 to T5 (AC-1), one per step `commit`, `open-pr`, `push`, `open-archive-pr`, `push-rebased`, through
  `build(rowOf(step, …))` (the `push-rebased` row with `oldHead`, `branch`, `paths`, `command` as in test B2a): the
  agent is `COMMIT`, the brief ends with `ATTRIBUTION_ASK`, holds it once, and what precedes it ends with
  "Write the change's files in English."
- T6 to T10 (AC-1, negatives), one per hand-off that is not the commit agent's: `implement` (TDD),
  `resolve-release-conflict` (TDD), `verify` (pr-verifier), the plan stage `proposal` (`no-file`, change-planner) and
  `readiness` (`no-file`, plan-readiness-reviewer): the brief does not include `ATTRIBUTION_ASK` and ends with the
  language sentence.
- T11 (AC-1): `build(rowOf('commit', { agent: TDD }))` hands the step to `TDD` with no request.
- T12 to T14 (AC-1): `withAttribution(COMMIT_AGENT, 'x')` is `'x' + ATTRIBUTION_ASK`;
  `withAttribution('devkit-core:tdd-implementer', 'x')` and `withAttribution(undefined, 'x')` are `'x'`.
- T15 (AC-1): `ATTRIBUTION_ASK` holds `ATTRIBUTION_HEADER`, `` `Commit trailer: <line>` ``, `` `PR footer: <line>` ``,
  `` `Attribution (from the caller): none` `` and `verbatim`, and matches none of `/Claude|Sonnet|Opus|Haiku|noreply|@|🤖/`.
- T16 to T19 (AC-1), one per item of `plugins/openspec/skills/devkit/SKILL.md`: the Loop line starting
  "- `agent`: one Agent call", the line starting "- `push-rebased`:", the roadmap line starting
  "   - `agent`: hand every one" and the project line starting "   - `agent`: as the Loop of the change sections says"
  each hold `devkit-core:commit-and-pr` and "the attribution block of the `ship-change` skill's Attribution section".
- T20 (AC-1, AC-2): one block format: `ATTRIBUTION_HEADER`, `Commit trailer:`, `PR footer:` and
  `Attribution (from the caller): none` are each in `ATTRIBUTION_ASK`, in the `## Attribution` section of
  `ship-change/SKILL.md` and in `plugins/core/agents/commit-and-pr.md` (its Receives bullet).

`plugins/openspec/hooks/project-loop.test.mjs` (fixtures `loopProject`, `readySlice`, `archivedSlice`, `openPr`,
`act`, `scriptedGh`, `put`, `CL`):

- T21 (AC-1): the S8 commit before the review ends with `CL.ATTRIBUTION_ASK`, after the `COMMIT_RULE` sentence
  ("never on the default branch.").
- T22 (AC-1): the S13 commit in `plan` ship mode ends with it.
- T23 (AC-1): the S16 `open-pr` ends with it.
- T24 (AC-1): the S17 `push` ends with it.
- T25 (AC-1, negative): the S10 ADR-reviewer hand-off does not include it.

`plugins/openspec/hooks/deliver-check.test.mjs` (fixtures `coreAgent`, `shipSkill`, `skillRow`; the agent's section is
the text between `## Attribution` and `## Escalate`):

- T26 (AC-2): Receives names the block: `Attribution (from the caller):`, `Commit trailer:`, `PR footer:` and the
  `none` line.
- T27 (AC-2, lines given): the section says "exactly the text after each `Commit trailer:` line" and "Add no other
  `Co-Authored-By` line, attribution trailer or footer".
- T28 (AC-2, `none`): the section says "Write no `Co-Authored-By` line, no attribution trailer and no footer".
- T29 (AC-2, no block): the section's **No block** bullet keeps "the environment or the user requires".
- T30 (AC-2): the section says the caller's block "wins over the lines your own environment gives you".
- T31 (AC-2): the `## Method` section names "Attribution below" in steps 3 and 5 and no longer holds "the environment
  or the user requires".
- T32 (AC-2): Never holds "add one the caller's attribution block does not give".
- T33 to T35 (AC-1), one per row of `ship-change/SKILL.md`: `skillRow(md, 'commit')`, `skillRow(md, 'open-pr')` (the
  `open-pr`, `push` row) and `skillRow(md, 'open-archive-pr')` each hold "End the prompt with the attribution block
  (Attribution, above)."
- T36 (AC-1): `ship-change`'s `## Attribution` section holds the four block lines of D-4, the `none` line, "verbatim"
  and "never take the agent's", and no `Opus`, `Sonnet`, `Haiku` or `noreply`.

## D-8 The real run (AC-3)

Run in a scratch project outside this repository; the full output goes to
`openspec/changes/commit-attribution/proof/`, and `pr-verifier` runs it again and records it under AC-3.

1. `S=$(mktemp -d)`; `git init -q --bare "$S/origin.git"`; `git init -q -b main "$S/work"`; in `$S/work`:
   `git config user.name Scratch`, `git config user.email scratch@example.invalid`, a file `a.txt` committed by hand
   on `main` (`chore: start`), `git remote add origin "$S/origin.git"`, `git push -q origin main`,
   `git switch -q -c attribution-proof`, a new file `b.txt`.
2. `$S/prompt.txt` holds: "Make exactly one Agent call with `subagent_type` `devkit-core:commit-and-pr` and, as its
   prompt, the text between the lines BEGIN and END, verbatim. Then print its reply verbatim and do nothing else."
   Between BEGIN and END: "Commit only for change attribution-proof: stage by name `b.txt`; commit with the title
   `docs(proof): add b.txt`; push the branch; no PR. This is a pre-review commit: precondition 3 does not apply." and
   the block of D-2 with `Commit trailer: Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and
   `PR footer: 🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
3. In `$S/work`: `command claude -p --model sonnet --plugin-dir <worktree>/plugins/core --allowedTools "Agent Bash(git *) Read" --output-format stream-json --verbose < "$S/prompt.txt" > <worktree>/openspec/changes/commit-attribution/proof/ac3-run.jsonl`.
   The outer session runs on Sonnet and the agent on its own `model: sonnet`, so an Opus line can only come from the
   block. When the run shows a permission denial, run it again with `--permission-mode bypassPermissions` (the scratch
   folder only) and say so in the proof.
4. `git -C "$S/work" log -1 --format='%(trailers)' > …/proof/ac3-trailers.txt` and
   `git -C "$S/work" log -1 --format=%B > …/proof/ac3-message.txt`.
5. Trust the run only when the `system`/`init` event of `ac3-run.jsonl` lists devkit-core with a path under this
   worktree's `plugins/core` (no installed copy loaded) and the stream holds an Agent call to
   `devkit-core:commit-and-pr`.

Pass: `ac3-trailers.txt` has exactly one non-empty line, `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## D-9 This change's own commits (AC-4)

The installed loop is the older one, so the conducting session appends the block of D-2 by hand to every hand-off of
this change to `devkit-core:commit-and-pr`, with its own lines. `pr-verifier` runs, in the worktree,
`git log --no-merges --format='%h %s%n%(trailers:key=Co-Authored-By)' "$(git merge-base origin/main HEAD)..HEAD"` and
records that every commit lists exactly the session's trailer and none names Sonnet. Commits made after the evidence
(an evidence-only commit, the archive) are checked again in the retro.

## D-10 Release

`CONTRIBUTING.md`, step 5, against `origin/main` when the task runs (today's numbers shown; take the next minor after
`main`'s if a sibling released first, and `release-rebase.mjs` settles a later collision):

- devkit-core 0.9.0 to 0.10.0 and devkit-openspec 0.21.1 to 0.22.0, in each `plugin.json` and in
  `.claude-plugin/marketplace.json`; the marketplace 0.25.1 to 0.26.0. Minor bumps: the agent gains an input and the
  loops' briefs gain a sentence.
- `CHANGELOG.md`, a section `## 0.26.0 — commit attribution`: one bullet per pack (devkit-core: the caller's block
  wins, with no block the agent behaves as before; devkit-openspec: the request in both loops, the Attribution section
  and the rows), a docs bullet, and "The CI snippet now pins `v0.22.0`, the release's tag."
- `docs/openspec-flow.md`, the three `v0.21.1` mentions of the CI section (lines 578, 579 and 588) become `v0.22.0`; in `change-loop.test.mjs`
  line 2478 matches `v0.22.0`, line 2479 refuses `v0.21.1`, and a new line after it still refuses `v0.21.0`.
- `docs/catalog.md` is unchanged (`python3 scripts/gen-catalog.py --check` proves it). The tag is a workflow follow-up.

## Decisions and ADRs

No new ADR. The change adds one sentence to a brief, one input to an agent and one block to two skills; it moves no
decision of ADRs 0002, 0010, 0011, 0013, 0014 or 0015. Read against their rejected alternatives: ADR 0010 decision 8
keeps "A Stop hook that re-prompts" rejected and decision 5 says hooks veto and do not drive, which is why a hook that
writes the trailer is not chosen (below); ADR 0011's rejected "subagent without edit tools" is untouched (the session
still hands commits to the agent). The `decisions` stage is its own role's.

## Alternatives considered

| Option | Why not |
|---|---|
| A setting (`devkit.attribution` in `openspec/config.yaml`) the loop reads | The lines are the session's, per host and model; a setting names one model and goes stale with the next |
| A hook that rewrites the commit message or adds the trailer | Hooks veto, they do not drive (ADR 0010, decision 5); it would also need the lines, which no script has |
| The commit agent on the session's model (`model: inherit`) | Out of scope (`requirements.md`); the agent stays on `sonnet` |
| The session commits itself | The delivery is the commit-and-pr role's in every script (`flow.json`), and the agent's checks (secrets, names) would be lost |
| A separate `attribution` field in the action JSON | The session would merge two fields into the prompt; the sentence in the brief reaches the agent as is and the tests read it there |
| One copy of the request per loop | Two texts drift; one exported helper keyed on the agent covers both loops and every step |

## Risks / Trade-offs

| Risk | Probability × impact | Mitigation |
|---|---|---|
| The agent still writes its environment's line | MEDIUM × HIGH | The rule in the agent (D-3) and its repetition in the block's last line (D-2); AC-3's real run proves it; on a miss the plan is revised before review |
| The session forgets the block | MEDIUM × MEDIUM | The brief's last sentence asks for it at every hand-off and every dispatch row names it; without it the agent falls back to today's behaviour, never worse |
| The `--plugin-dir` run loads an installed devkit-core | LOW × HIGH | D-8 step 5 checks the `init` event's path; the scratch folder has no project install |
| A nested `claude -p` is refused inside the implementer | LOW × MEDIUM | The session runs D-8 itself in Bash (it writes only the scratch folder and `proof/`) |
| Siblings bump the same versions and hooks | HIGH × LOW | D-10 resolves at release time; `release-rebase.mjs` for release files |
| A changed test hides a regression | LOW × MEDIUM | D-6 keeps the invariant: the base brief still ends with the language sentence, now asserted for every brief |

## Implementation plan

Dependency order: the helper and the loops, then the agent and the skills with their tests (phase 1); then the docs,
the release and the real run (phase 2).

**Per surface.** devkit-openspec hooks: D-1 and the tests of D-6 and D-7. devkit-openspec skills: D-4. devkit-core
agent: D-3. Docs and release: D-5, D-10. No worker, schema or panel changes.

**Files.** Modify: `plugins/openspec/hooks/change-loop.mjs`, `plugins/openspec/hooks/project-loop.mjs`,
`plugins/openspec/hooks/change-loop.test.mjs`, `plugins/openspec/hooks/project-loop.test.mjs`,
`plugins/openspec/hooks/deliver-check.test.mjs`, `plugins/openspec/skills/ship-change/SKILL.md`,
`plugins/openspec/skills/devkit/SKILL.md`, `plugins/core/agents/commit-and-pr.md`, `docs/openspec-flow.md`,
`CHANGELOG.md`, `plugins/core/.claude-plugin/plugin.json`, `plugins/openspec/.claude-plugin/plugin.json`,
`.claude-plugin/marketplace.json`. Create: `openspec/changes/commit-attribution/proof/ac3-run.jsonl`,
`ac3-trailers.txt`, `ac3-message.txt`. Delete: none.

**Estimate.** Optimistic 5 h, likely 7 h, pessimistic 11 h (the agent ignores the block and its wording is revised).

| Component | Hours | Type | Risk |
|---|---|---|---|
| D-1 helper and the two `agent` builders | 0.5 | Core | LOW |
| D-3 the agent's text | 0.5 | Core | MEDIUM |
| D-4 the two skills | 0.75 | Core | LOW |
| D-6 and D-7 tests (change loop, project loop, texts) | 2.5 | Testing | LOW |
| D-5 the flow doc | 0.25 | Documentation | LOW |
| D-10 release and CI pin | 0.5 | Integration | LOW |
| D-8 the real run | 1 | Testing | MEDIUM |
| The whole suite and the gates | 1 | Testing | LOW |

**Assumptions.**

- The conducting session has its attribution lines in context (in Claude Code, the host's attribution instructions);
  source: `requirements.md`, Assumptions 1.
- The Agent tool passes the prompt to the agent unchanged, so the block reaches it as written; source: every
  hand-off of the loops today (the roadmap lock reads the brief's first words from the prompt).
- `command claude` (2.1.327 on this machine) has `-p`, `--plugin-dir`, `--model`, `--allowedTools` and
  `--output-format stream-json`, and a `-p` session can dispatch a plugin agent; source: `command claude --help`,
  `CONTRIBUTING.md` ("Testing a pack locally").
- The agent keeps `model: sonnet`; source: `requirements.md`, Out of scope.

**Dependencies.** `review-writer-prompt` (archived, c561553) is the base; nothing open is needed. The next change
delivered with the release dogfoods it (`requirements.md`, Dogfood).

## Migration Plan

Additive: an older caller sends no block and the agent keeps its earlier rule; an older agent given a block reads it as
an instruction, as the by-hand wording does today. Rollback is reverting the change's commits; no data or state moves.
