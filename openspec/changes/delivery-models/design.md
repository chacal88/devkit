<!-- devkit-stage design result=passed attempt=2 commit=2300f84524e5c1ec5ed8a0da41e5a5dccff9cc34 -->
# Design

Change: `delivery-models` · Date: 2026-11-21 · Owner: Kaue (chacal88) · PRD / tech spec:
`docs/coordination-design.md` D-5 and D-8 (sources: `requirements.md`, `proposal.md`, the five spec
deltas under `specs/`).

## Context

See `proposal.md` (Why). The code, read at `2300f84` (devkit-openspec 0.18.1, devkit-core 0.8.1):

| Where | What it does today |
|---|---|
| `plugins/openspec/hooks/deliver-check.mjs` `parseShip`, `shipConfig` | The top-level `ship:` map, per schema, `plan` / `pr` / `merge`, plus `merge_method`; `ShipConfigError` on anything else. Callers: `collectState`, `flow-check.mjs#collectFlow` |
| `plugins/openspec/hooks/change-loop.mjs` `readDevkitSettings` | Reads the `devkit:` block line by line: any indented `key: value` line under it is a key, nested or not. Only `driver` and `language` are used; `projectGate` refuses an unknown value with `setting-unknown` |
| `deliver-check.mjs` `fetchPr`, `findChangePr`, `deliveryOf` | One pull request per branch: `gh pr view` of the current branch; from another branch, the newest merged pull request whose files are under the change's folder. "Delivered" = that pull request merged and every task ticked in `tasks.md` on GitHub's default branch |
| `deliver-check.mjs` `nextStep`, `archiveNext` | The step order; in `pr` mode the run ends at `ready` (owner merges) and, after the merge, at `archive-pr-ready`. Auto-merge only where `ship === 'merge'` |
| `deliver-check.mjs` `runCi` | `devkit-reviews`: selects the change by branch or diff, judges readiness and items 1-4 with no GitHub call; an archive pull request is judged on its retro and files (ADR 0003, ADR 0012). It does not read `ship` |
| `plugins/openspec/hooks/guard.mjs` `GIT_RULES`, `guardBash` | Static regular expressions on the sanitized command (force push, `reset --hard`, ...); no project setting is read. `classify` gives `reviews/<name>.md` to the reviewer `<name>`, and any other path under `reviews/` to nobody |
| `change-loop.mjs` `openUnderLock`, `defaultBase` | Fetches, then cuts `<id>` from `origin/<origin/HEAD, else main, else master>` |
| `change-loop.mjs` `ROWS`, `OWNER_STEP`, `MESSAGES`; `conduct-check.mjs` `actorOf`, `stateOf`; `flow-check.mjs` `readDelivery`, `TEXT` | Each step of `deliver-check` is mapped to a hand-off, a session step or an end; an unknown step stops the change |
| `plugins/openspec/hooks/roadmap-loop.mjs` `GATE_OF_WHY` | One gate code per `waiting-` key of the message table; a key with no entry throws |
| `change-loop.mjs` `archivedDates`, `unfinished` | A change archived on the default branch is never unfinished; a worktree on `chore/archive-<x>` notes `<x>` as unfinished |
| `plugins/core/skills/review-change/scripts/review-round.workflow.js` line 258 | The Workflow path tells each reviewer to write `<changeDir>/reviews/<reviewer>.md` |
| `plugins/openspec/skills/openspec-setup/templates/devkit-reviews.yml` | `permissions: contents: read`; downloads `guard.mjs`, `deliver-check.mjs`, `merge-setup.mjs` |

Constraints:

- `deliver-check.mjs`, `guard.mjs` and `merge-setup.mjs` are the three files a project's
  `devkit-reviews` job downloads (`docs/openspec-flow.md`, CI). Everything the CI path runs stays in
  those files: no new module and no new import in them. A new module would break every project that
  moves its pin and keeps the three-line download.
- Product code is closed until readiness is approved (the `guard.mjs` edit lock); `docs/` is product
  code for the hook, which is why ADR 0015's text lives in D-12 and a task writes it after approval.
- `scripts/check.py` refuses Portuguese prose in Markdown; the message table carries both languages.
- `deliver-check` reads and never writes (no fetch). Steps that write (fetch, merge, push) are the
  session's or an agent's.

## Goals / Non-Goals

**Goals:**

- One reader of the `devkit:` block, shared by every caller (D-1, D-11).
- `trunk` and `trunk-auto` run today's code paths unchanged: the two-pull-request code is reached only
  when the model is `two-prs`, and the JSON of every other mode keeps its keys (D-1).
- Each new predicate has one test per condition and per label, negatives included (D-14).
- Every existing test that pins a rule this plan touches is named with what happens to it (D-14).

**Non-Goals:**

- A base branch other than the repository's default branch (D-2).
- Reading comments on the pull request to the test branch (item 7 stays the base pull request's).
- A command refusal outside the Claude driver; drivers other than Claude rely on the GitHub check.
- `/devkit roadmap` behaviour beyond its gate table (D-5) and what `unfinished`/`archivedOnDefault`
  answer (D-10).
- `ship-change` driving a `two-prs` change begun under the previous script: its table gains the rows
  the loop's session steps follow, nothing more (D-13).

## D-1 The configuration (AC-1; spec `delivery-models`)

**The AMBIGUOUS item of `requirements.md`, resolved: option (a).** `devkit.delivery.model` is the
switch; the top-level `ship:` map stays readable as the fallback. Reasons:

1. AC-1 names `two-prs`, `trunk` and `trunk-auto` as what the project chooses; under (b) a project
   would write `pr` and `merge`, and `trunk`/`trunk-auto` would exist only in documents.
2. D-5 says "chosen per project"; `ship:` is per schema, so (b) would allow `devkit-lite: two-prs`
   next to `devkit: merge` with one test branch, which nobody asked for.
3. `base` and `test_branch` belong to the model; under (b) they would live in another block than
   the value that needs them.
4. The configuration example of `docs/coordination-design.md` section 8 (proposed) has this shape.

Cost of (a): ADR 0002's Decision names `ship: <schema>: merge` as the opt-in. `trunk-auto` is a second
spelling of the same opt-in, with the same conditions; ADR 0015 records it (D-12).

**The shape.**

```yaml
devkit:
  language: en
  driver: claude
  delivery:
    model: two-prs        # two-prs | trunk | trunk-auto
    base: master          # two-prs only
    test_branch: develop  # two-prs only
```

**Reading rules.** `parseDevkitBlock(text)` in `guard.mjs` (D-11) reads the `devkit:` block with one
level of nesting: `language` and `driver` as today, and the `delivery:` sub-map. A value is unquoted
and its trailing `# comment` dropped as `plainValue` does today (moved into `guard.mjs`; D-11). An
empty value is unset. `deliverySettings(block)` turns the raw map into
`{ model, base, testBranch, problems }`:

| Condition | Result |
|---|---|
| no `delivery.model` | `model: null`, `base`/`testBranch` not read, no problem |
| `model` is `trunk` or `trunk-auto` | that model; `base`/`test_branch` ignored |
| `model` is `two-prs` with both names, different | that model with both names |
| `model` is any other value | problem `{ kind: 'unknown', setting: 'delivery-model', value }` |
| `two-prs` without `base` | problem `{ kind: 'missing', setting: 'delivery-base' }` |
| `two-prs` without `test_branch` | problem `{ kind: 'missing', setting: 'delivery-test-branch' }` |
| `two-prs` with `base` equal to `test_branch` | problem `{ kind: 'unknown', setting: 'delivery-test-branch', value }` (accepted: a branch other than the base) |

**Next to `ship:`.** `deliveryConfig(root, schema)` in `deliver-check.mjs` is the one function every
delivery reader calls in place of `shipConfig` (`collectState`, `flow-check.mjs#collectFlow`,
`change-loop.mjs` through them). It returns `{ model, ship, mergeMethod, base, testBranch }`:

| Model | `ship:` entry for any schema | `ship` returned | Error |
|---|---|---|---|
| none | as today | the schema's entry, else `plan` | as today |
| `trunk` | none, or `pr` | `pr` | entry `merge` or `plan`: `ShipConfigError` naming `ship.<schema>`, the mode and `trunk` |
| `trunk-auto` | none, or `merge` | `merge` | entry `pr` or `plan`: the same |
| `two-prs` | none | `pr` | any entry: the same, naming `two-prs` |

The first problem of `deliverySettings` is also a `ShipConfigError`. `shipConfig` stays exported and
unchanged (a test pins it; D-14). `two-prs` returns `ship: 'pr'`: every existing `ship === 'merge'`
branch stays off, so auto-merge is never enabled (AC-3); every two-pull-request branch reads
`model === 'two-prs'`.

**Where errors surface.** `readDevkitSettings` (change-loop) gains `delivery: { model, base,
testBranch }` and maps the problems: `unknown` into its existing `unknown` list (reply
`setting-unknown`), `missing` into a new `missing` list (reply `setting-missing`); `projectGate`
refuses on either, so `/devkit change` and `open` create nothing. A `ship:` disagreement surfaces where
an invalid `ship:` does today: `deliver-check` exits 3, `flow-check` throws `FlowUsageError`, the
loop's `next` exits 3.

**JSON.** In `two-prs` the report of `deliver-check` gains `model` and `twoPrs` (D-4); in every other
mode its keys stay exactly as today, and `--ci --json` gains `twoPrs` only in `two-prs` (D-7). A
`version` bump is not needed: no field is removed or changes meaning.

## D-2 The base branch is the repository's default branch (confirmed by the owner)

Today "the default branch" is read in six places: `defaultTasks` and `archiveFacts` (GitHub's
`default_branch`), `change-loop.mjs#defaultBase` (`origin/HEAD`), `archivedDates`, `conduct-check`'s
roadmap read, and `defaultBranches`. Routing all of them through the configured base is a larger
change than the request, and a repository whose default branch is the test branch would also read its
roadmap and its archive from the test branch. So in `two-prs` the configured `base` must be the
repository's default branch: `open` refuses otherwise (D-3), and the two-pull-request facts stop the
delivery as `blocked` when GitHub's `default_branch` differs from `base` (D-4), and the CI check fails
naming both (D-7). The owner confirmed this reading after the plan was written: the base branch of a
`two-prs` project is its GitHub default branch (`master` or `main`), and the test branch is the QA
branch (`dev` or `develop`), so its name always comes from `devkit.delivery.test_branch`
(`requirements.md`, "Confirmed by the owner after the plan was written", 2026-11-22).

## D-3 Opening a change in `two-prs` (spec `change-coordination`)

`change-loop.mjs#openUnderLock`, after the fetch and the name check, reads
`readDevkitSettings(main).delivery`. Only when the model is `two-prs`:

1. `defaultBase(main)` must equal `base`; else `LoopRefusal('base-not-default', { base, default })`.
2. `refs/remotes/origin/<test_branch>` must exist; else `LoopRefusal('test-branch-missing', { branch })`.
3. The id must not end with `-<test_branch>`; else `LoopRefusal('name-test-suffix', { id, branch })`
   (a support branch is `<id>-<test_branch>`, and the lock lets any such branch receive the test
   branch; D-6).
4. The branch is cut from `origin/<base>` (equal to today's base by rule 1, written explicitly).

Without a remote the model is not checked (today's `HEAD` start stays). Every other model runs the
existing code with no extra read.

## D-4 The two pull requests, in `deliver-check.mjs` (AC-2, AC-3, AC-8, AC-9; specs `delivery-models`, `change-delivery`)

**The change's own pull request is the one to the base branch.** In `two-prs`:

- `fetchPr` gains `base`: when set, it asks `gh pr list --head <branch> --base <base> --state all
  --limit 10 --json <fields>` and takes the open one, else the newest; `gh pr view` is not asked
  (two pull requests share the head, and `gh pr view` picks one).
- `findChangePr` passes `base` on its own-branch path and drops, on its merged-list path, every pull
  request whose `baseRefName` is not `base` (the light fields already carry `baseRefName`).
- `deliveryOf`, `mergedOnBranch` and `collectState` pass the model through. "Delivered" keeps its rule,
  so a merged pull request to the test branch never delivers the change (AC-9).

**The facts.** `collectState` adds, in `two-prs` only, `state.twoPrs`:

```js
{
  base, testBranch,
  defaultBranch,      // GitHub's default_branch, read with readRepoSettings, once
  defaultOk,          // defaultBranch === base (D-2)
  foreign,            // testBranchCommit(root, { base, testBranch, head }) — D-7's rule, run on local refs
  test: { pr, checks, body } | { none: true } | { error },   // findTestPr (below)
  support: supportState(root, id, testBranch),                // below
  resolution: resolutionState(root, id, support),             // D-8
}
```

- `findTestPr(gh, { id, testBranch })` asks `gh pr list --base <test> --head <h> --state all --limit 10
  --json number,url,state,headRefName,headRefOid,mergeable,mergedAt,body` for `h` = the support branch
  `<id>-<test>` and the task branch `<id>`, and takes: an open one from the support branch, else an
  open one from the task branch, else the newest merged one, else the newest closed one, else none.
  For an open one it adds `checksItem({ pr }, gh)` and `bodyItem(id, { pr }, acIds)` (the same
  rules as the base pull request: the body names the change, every criterion and the evidence).
- `supportState(root, id, test)`: `{ branch: '<id>-<test>', exists (refs/heads), worktree (from
  listWorktrees, D-11) | null, path (<main checkout>/.claude/worktrees/<id>-<test>), merging (the
  conflicted paths when the worktree has MERGE_HEAD) | null, head, hasTask (the task head is an
  ancestor of the support head), pushed (origin/<support> equals the local head) }`.

**The steps.** `nextStep` gains one block, reached only when `state.twoPrs` is set, and two changes of
existing rows. First match wins; rows marked "existing" keep their text.

| # | When (two-prs) | Step | Detail |
|---|---|---|---|
| T0 | `!defaultOk` | `blocked` | `the base branch <base> is not the repository's default branch <defaultBranch>` |
| T1 | after the items-1-4 rows, before any PR row: `foreign` set | `blocked` | `<sha7> (<subject>) is on <test> and not on <base>; the task branch never receives <test>` |
| T2 | no base PR and no test PR | `open-prs` | `{ branch, base, testBranch }` |
| T3 | no base PR, a test PR | `open-pr` (existing step) | `{ base }` |
| — | base PR rows (existing): item 5 blocked, `push`, `edit-pr-body` | existing | |
| T4 | no test PR | `open-test-pr` | `{ head: support pushed ? support : id, base: testBranch }` |
| T5 | test PR closed, none open or merged | `blocked` | `pull request #n to <test> was closed without merging` |
| T6 | test PR not merged, support worktree merging | `resolve-support-conflict` | `{ root: support.path, branch, paths }` |
| T7 | test PR not merged, support branch without worktree | `checkout-support` | `{ path, branch }` |
| T8 | resolution not approved (D-8) | `review-resolution`, `fix-resolution` or `stop-review-deadlock` (`resolution: true`) | D-8 |
| T9 | support exists and `!hasTask` | `merge-into-support` | `{ root: path, branch, from: id }` (AC-8) |
| T10 | test PR `mergeable === 'CONFLICTING'` | `merge-into-support` | `{ root: path, branch, from: 'origin/<test>', create: !support.exists }` (AC-6) |
| T11 | support exists, `!pushed` | `push-support` | `{ root: path, branch }` |
| T12 | support exists, test PR head is the task branch | `move-test-pr` | `{ head: support, base: testBranch, replaces: n }` |
| T13 | test PR body open | `edit-pr-body` (existing step) | `{ number: test PR, missing }` |
| T14 | test PR checks failing | `fix-checks` (existing step) | `{ number: test PR, failing }` |
| T15 | test PR checks pending | `wait-checks` (existing step) | `{ number: test PR }` |
| T16 | test PR open, green | `ready-test-branch` | `{ number, branch: testBranch, base, baseNumber }` |
| T17 | test PR merged, base `devkit-reviews` failing, its run started before the test merge | `rerun-checks` | `{ number: base PR, runs: [run ids] }` |
| — | base PR rows (existing): checks, answer, wait-checks | existing | |
| T18 | all eight met | `ready-base` (in place of `ready`) | `{ number, base }` |

Every `blocked` row (T0, T1, T5) ends the run with the reason above and no write: no pull request is
opened, moved or closed, nothing is pushed (spec `delivery-models`, "The two-pull-request delivery
stops where it cannot go on by itself"). T1 reads `origin/<test>` as the session last fetched it:
`deliver-check` never fetches, and none of its readers fetches before it. A stale ref is enough here,
because a test-branch commit can enter the task branch only through a local ref the session merged,
rebased or pulled, which the local `origin/<test>` (or the remote-tracking ref the pull updated)
already holds; a commit pushed to the task branch from elsewhere is caught by D-7, which reads a full
fetch.

T6 to T16 run only while the test pull request is not merged; T17 and T18 only after. The existing
`update-branch`, `enable-auto-merge` and `disable-auto-merge` rows need `ship === 'merge'` and so never
fire in `two-prs`. The run id of T17 comes from the failing check's `link`
(`/actions/runs/<id>/`) and its start from one `gh run view <id> --json startedAt` call, made only in
that situation; `startedAt` is the latest attempt's start, so a re-run that fails again is genuine
and falls to the existing `blocked` row (`devkit-reviews fails in CI while items 1-4 are met
locally`).

**The report.** In `two-prs`, `buildReport` adds `model: 'two-prs'` and `twoPrs: { base, testBranch,
testPr: { number, url, state, head } | null, support: { branch, exists, pushed } }`: the state names
both pull requests (AC-2), found on GitHub from the branch names. No file records the numbers
(alternative rejected in D-12): GitHub and the deterministic branch names are the record, and each
body names the change.

## D-5 The loop and its readers (AC-2, AC-3, AC-9)

- `change-loop.mjs` `ROWS`: `open-prs`, `open-test-pr`, `push-support`, `move-test-pr`,
  `open-test-archive-pr` → `handOff('delivery', 'commit-and-pr')`; `resolve-support-conflict`,
  `fix-resolution` → `handOff('implementation', 'tdd-implementer')`; `checkout-support`,
  `merge-into-support`, `rerun-checks` → `session('delivery')`; `review-resolution` →
  `session('review')`; `ready-test-branch`, `ready-base`, `archive-prs-ready` → `{ end: 'owner' }`.
  `OWNER_STEP`: `ready-test-branch` → `waiting-merge-test-branch`, `ready-base` →
  `waiting-merge-base`, `archive-prs-ready` → `waiting-archive-merges`. The owner end passes the
  step's `branch`, `base` and `list` params beside `number`.
- `decide`'s `brief`: when the hand-off's detail carries `root` and `branch`, the brief names them in
  place of `ctx.root` and `ctx.branch` (spec `change-coordination`, the support worktree). The
  brief's first words stay `Change <id>` (the roadmap lock reads them).
- `MESSAGES` (both languages): `waiting-merge-test-branch`, `waiting-merge-base`,
  `waiting-archive-merges`, `setting-missing`, `test-branch-missing`, `base-not-default`,
  `name-test-suffix`, and the setting names `setting.delivery-model`, `setting.delivery-base`,
  `setting.delivery-test-branch`. English text:

  | Key | Text |
  |---|---|
  | `waiting-merge-test-branch` | `Pull request #{number} of {id} to {branch} is ready: in this project, merging it is up to you. The pull request to {base} waits for it.` |
  | `waiting-merge-base` | `Pull request #{number} of {id} to {base} is ready: in this project, merging it is up to you.` |
  | `waiting-archive-merges` | `The archive pull requests of {id} are ready: {list}. In this project, merging them is up to you.` |
  | `setting-missing` | `The project's devkit settings choose two pull requests but do not name the {setting}. Nothing was run.` |
  | `test-branch-missing` | `This project delivers with two pull requests, but its test branch {branch} does not exist on the remote: create it there, then call /devkit change again. Nothing was created.` |
  | `base-not-default` | `This project delivers to {base}, but the repository's default branch is {default}: they must be the same branch. Nothing was created.` |
  | `name-test-suffix` | `{id} cannot be a change name here: a name ending in -{branch} is kept for the support branches.` |

  `{list}` is `#<n> to <branch>` per open archive pull request, joined with `, `.
- `conduct-check.mjs` `actorOf`: the commit-and-pr steps join `SUBAGENT` with `devkit-core:commit-and-pr`,
  the two implementer steps with `devkit-core:tdd-implementer`; `checkout-support`,
  `merge-into-support`, `rerun-checks` join `MAIN`; `review-resolution` → `{ actor: 'review' }`;
  `ready-test-branch`, `ready-base`, `archive-prs-ready` join `OWNER`. `stateOf`: `waiting for the
  owner: merge PR #<n> to <branch>` for the first two, `waiting for the owner: merge archive PRs
  <list>` for the third.
- `flow-check.mjs#readDelivery` receives `model` and the two-pull-request facts through `delivery()`;
  in `two-prs`: no test PR → `next('delivery', 'no-test-pr')`; test PR open and green →
  `end('waiting-for-owner', 'owner-merges-test-branch', { number, branch, base })`; test PR merged and
  base green → `end('waiting-for-owner', 'owner-merges-base', { number, base })`; the rest as today.
  `TEXT` gains the three codes in both languages.
- `roadmap-loop.mjs` `GATE_OF_WHY` gains `'waiting-merge-test-branch': 'merge'`,
  `'waiting-merge-base': 'merge'`, `'waiting-archive-merges': 'merge'`: three entries, the only edit of
  that file.

## D-6 The test-branch lock in the hook (AC-5, Claude driver; spec `coordination-locks`)

`guard.mjs` gains `testBranchViolation(cmd, cwd)` and `guardBash` calls it right after
`gitViolation`, under the same condition (the session's project opted in) and the same refusal form
(`blocked: <why>. If you really need it, ask the user to run it.`). `DEVKIT_BYPASS=1` skips it as it
skips every bash rule.

For each segment of `commandSegments(cmd, cwd)`:

1. The segment is a `git` command whose subcommand is `merge`, `rebase` or `pull`, optionally after
   `-C <dir>`; anything else is skipped (`git log develop`, `git fetch origin develop`).
2. The directory is `-C <dir>` resolved against the segment's directory (which already follows any
   `cd`). Its root is `findRoot(dir)`; its delivery settings are read with `readDeliverySettings(root)`
   (D-11). Not opted in, model not `two-prs`, a problem in the settings, or any read error: allowed.
3. Its branch is `git -C <dir> symbolic-ref --short -q HEAD`. Allowed when the branch is the test
   branch or ends with `-<test_branch>` (a support branch, or `chore/archive-<id>-<test_branch>`).
4. A word of the segment names the test branch when, after cutting a `src:dst` refspec to `src` and a
   trailing `~n`, `^n` or `@{...}`, it equals `<test>`, `refs/heads/<test>`,
   `refs/remotes/<remote>/<test>` or `<remote>/<test>`, with `<remote>` one of `git -C <dir> remote`.
   `develop-tools` and `feature/develop` (no remote `feature`) do not name it.
5. A bare `git pull` (no word after the options) names it when the branch's upstream
   (`git -C <dir> rev-parse --abbrev-ref --symbolic-full-name @{u}`) is `<remote>/<test>`.
6. Refused with `the task branch never receives <test>: merge <test> into the support branch
   <branch>-<test> instead (the flow creates it when the pull request to <test> has a conflict)`.

Limits, accepted and written in `docs/openspec-flow.md`: a ref inside quotes is not read (the
sanitizer blanks quoted text, as for every git rule); `git cherry-pick`, `git reset <ref>` and
`git merge FETCH_HEAD` are not read. The GitHub check of D-7 is the backstop for all three.

## D-7 The `devkit-reviews` rules in `two-prs` (AC-4, AC-5, AC-7; spec `reviews-check`)

**Which settings: the default branch's copy.** The settings are read from the repository's default
branch, which in `two-prs` is the base branch (D-2), never from the pull request's head and never from
the test branch. Reading `origin/<GITHUB_BASE_REF>` would be wrong on a pull request to the test
branch: the test branch's own `openspec/config.yaml` lags the base branch's. It receives the base
branch's copy only when a task branch cut after that copy was written merges into it, so the first
changes after a project adopts `two-prs`, and any later edit of the settings, are judged there against
an older copy or none. With no model in that copy the rules below would not run, and the delivery
contract would be judged on a pull request D-7 says must not judge it.

`ciSettingsRef(root, env)` in `deliver-check.mjs` names the ref to read, first match wins:

| # | Source | Ref read |
|---|---|---|
| S1 | `repository.default_branch` of the event payload at `GITHUB_EVENT_PATH`, else its `pull_request.base.repo.default_branch` (every `pull_request` event GitHub sends carries both) | `origin/<that name>`, when the ref exists |
| S2 | the target of `refs/remotes/origin/HEAD` (a clone; `actions/checkout` does not set it) | `origin/<that name>`, when the ref exists |
| S3 | neither names an existing ref | `origin/<GITHUB_BASE_REF>`, as before this change |

The payload is read by `eventPayload(env)` (D-11), which `ciPreflight` already needs for the head sha.
`runCi` reads `openspec/config.yaml` from that ref with `git show` (every branch is there with
`fetch-depth: 0`) and parses it with `parseDevkitBlock` and `deliverySettings`. Then:

- No base ref, no file there, no model or a model other than `two-prs`: nothing below runs, nothing is
  read from GitHub, and the output is today's. The only new work for such a project is one `git show`.
- A settings problem in that copy: a usage error (exit 3) naming it.
- `two-prs` read through S1 or S2, with `base` different from the default branch's name: the job fails
  with `two-prs  open  the base branch <base> is not the repository's default branch <default>` (D-2,
  the CI form of T0), and neither rule below runs.
- S3 is the fallback outside GitHub Actions when the clone has no `origin/HEAD` (a local `--ci` run
  after `git init` and `git fetch`); there, a pull request to the test branch whose own copy names no
  model is judged as before this change. Accepted, and written in `docs/openspec-flow.md`: on GitHub
  the payload always names the default branch, and the pull request to the base branch, which is the
  one that delivers, reads its own branch's copy under every source.

This answers ADR 0012's rejected "Make the check read `ship:`" in ADR 0015: the check reads the
delivery model, never `ship:`, and only to apply the rules of D-5's lock, which no other model has.

**A pull request to the base branch** (`GITHUB_BASE_REF === base`), for the judged change (the single
selected one, or each judged one of `runSeveral`), after today's items:

- AC-5, `testBranchCommit(root, { base, testBranch, head: 'HEAD' })`: the first commit of
  `git rev-list HEAD ^origin/<base>` that is in `git rev-list --first-parent origin/<test> ^origin/<base>`.
  The first-parent history of the test branch holds every tip it ever had (each merge keeps the
  previous tip as first parent), so a merge, a pull or a rebase of the test branch into the task
  branch puts one of those tips in the task branch; the task branch's own commits reach the test
  branch only through a merge's second parent (a GitHub merge commit) or as new commits (squash,
  rebase-merge), never on its first-parent line. A line `two-prs  open  <sha7> (<subject>) is on
  <test> and not on <base>; the task branch never receives <test>` fails the job.
- AC-4: `findTestPr` (D-4) through `makeGh`, with the head branch `GITHUB_HEAD_REF`. A merged one
  passes; an open one fails with `waits for pull request #<n> to <test> to merge`; none fails with
  `no pull request to <test> from <branch> or <branch>-<test>`; a GitHub error fails with `cannot read
  the pull requests to <test>: <error> (the job needs pull-requests: read and GH_TOKEN)`. The check
  turns green when the job runs again after the merge: the loop's `rerun-checks` (D-4 T17) in the
  Claude driver, the owner's re-run elsewhere (documented).

**A pull request to the test branch** (`GITHUB_BASE_REF === test_branch`, with the settings read as
above, so the test branch's own copy of the file plays no part), for the selected change:
items 1-4 and readiness are not judged; the output says `the delivery contract of <id> is judged on
the pull request to <base>`. When the head branch is `<id>-<test>`, `resolutionState` (D-8) runs with
the task ref `origin/<id>` and the head; a missing, rejected, stale or finding-holding verdict fails
the job naming it. From the task branch itself, the job passes with the note.

**JSON.** In `two-prs` the CI report gains `twoPrs: { settingsRef, base, testBranch, foreign, testPr,
resolution, pass }` (`settingsRef` the ref the settings were read from, for example `origin/master`);
the key exists only there.

**The workflow template.** `templates/devkit-reviews.yml` gains `pull-requests: read` under
`permissions` and `env: { GH_TOKEN: ${{ github.token }} }` on the step that runs the checker; the CI
snippet of `docs/openspec-flow.md` follows. A project in another model judges exactly as before with
or without the two lines (no GitHub call outside `two-prs`); a `two-prs` project with an older
workflow gets the "cannot read" failure, which names both.

## D-8 The support branch and the resolution round (AC-6, AC-7)

**The branch.** `<id>-<test_branch>`, cut from the task branch, in the worktree
`<main checkout>/.claude/worktrees/<id>-<test_branch>`. Only it receives the test branch (D-6). The
task worktree stays where the change coordinator runs; `deliver-check` reads the support worktree
through `supportState`.

**The session steps** (rows of `ship-change`, D-13):

- `checkout-support`: `git worktree add <path> <branch>`.
- `merge-into-support`: with `create`, `git worktree add -b <branch> <path> <id>` first; then, for
  `from: 'origin/<test>'`, `git fetch origin <test>` and `git -C <path> merge --no-ff --no-edit
  origin/<test>`; for `from: <id>`, `git -C <path> merge --no-ff --no-edit <id>`. A conflict is left
  in the worktree for `resolve-support-conflict`; a clean merge is committed by the merge itself.
- `resolve-support-conflict` (implementer, in the support worktree): resolve `paths`, stage each by
  name, `git commit --no-edit`.

**What the round reviews (confirmed by the owner).** AC-7's parenthesis says "the difference
between the task branch and the support branch". `git diff <task> <support>` holds every commit the
test branch gained, which no resolution round can read and which is not the resolution. The plan
reads "the resolution only" as the support branch's own work: for each first-parent merge in
`<task>..<support>`, the difference between Git's automatic merge and the commit
(`git merge-tree --write-tree <p1> <p2>` gives the automatic tree, conflict markers included;
`git diff <tree> <merge>` is the resolution), and each non-merge commit there (a fix of a finding).
`resolutionState` lists those "own commits"; a merge whose resolution diff is empty is not one. The
owner confirmed this reading after the plan was written: the round reads only the support branch's
own work, never what the test branch brought (`requirements.md`, "Confirmed by the owner after the plan was written", 2026-11-22).

**The record.** Each required reviewer (`code-quality-reviewer`, `test-coverage-reviewer`) writes
`openspec/changes/<id>/reviews/resolution/<reviewer>.md`, first line its verdict, second line
`Commit: <the newest own commit>`; `review-change` appends its consolidated section to
`openspec/changes/<id>/resolution.md` (its own `Consensus: PASS | FAIL (round N/2)` line, so
`review.md`'s last line still belongs to the code review). The files are written in the task
worktree, committed there by the existing `push` row (uncommitted files in the change folder), and
reach the support branch by the next `merge-into-support` from the task branch (a clean merge, not an
own commit). `guard.mjs#classify` gives `reviews/resolution/<name>.md` to `<name>`; every other path
under `reviews/` keeps its current rule.

**The state.** `resolutionState(root, id, { taskRef, supportRef })`:
`{ commits: [own commits, newest first], newest, verdicts: [{ name, verdict, commit }], missing,
stale (commit ≠ newest), rejected, undisposed (findingsIn the folder, against the support head),
round (the last Consensus line of resolution.md) }`, and `approved` when there is no own commit, or
every required verdict is approved at `newest` with nothing undisposed.

**The steps (T8).** Not approved: a required verdict missing or stale → `review-resolution` `{ root:
task worktree, support, commits, diffs: [the git commands that print each own commit's diff], commit:
newest, round }`; current but rejected, or approved with an undisposed finding → `fix-resolution`
`{ root: support path, branch, findings }`; still rejected after round 2 → `stop-review-deadlock`
`{ reviewers, resolution: true }` (the owner's `waiting-review-dispute`: the run ends waiting for the
owner's decision, as a code-review deadlock does today, and the support branch is neither pushed nor
the pull request moved; spec `delivery-models`, "A resolution review deadlock goes to the owner").
Round rules are `review-change`'s.

**The hold.** T11 (`push-support`) and T12 (`move-test-pr`) come after T8, so an unreviewed or
blocked resolution is never pushed and the pull request never moves; on GitHub, D-7 fails a pull
request from the support branch whose newest resolution lacks approved verdicts.

**Moving the pull request (AC-6).** `move-test-pr` (commit-and-pr): `gh pr create --base <test>
--head <support>` with the base pull request's body plus `Replaces #<n>.`, then `gh pr close <n>
--comment "Moved to #<new>: the conflict with <test> is resolved on <support>."`. GitHub cannot change
an open pull request's head, so close and reopen is the only way; the task branch head and the base
pull request are not touched by any step of D-8 (the test proves it).

**The review bench.** `plugins/core/skills/review-change/SKILL.md` gains "Resolution calls": the
caller names the change, the support branch, the newest own commit and the diff commands; the bench is
the two required reviewers and the finding verifiers; each reviewer writes
`reviews/resolution/<reviewer>.md` with `Commit:` the named commit; the section goes to
`resolution.md`. `review-round.workflow.js` takes `args.verdictDir` (default `reviews`) for the path
of line 258. `code-quality-reviewer.md` and `test-coverage-reviewer.md` gain one sentence: on a
resolution call, write `reviews/resolution/<name>.md` and put the named commit on the `Commit:` line.

## D-9 A later commit reaches both pull requests (AC-8)

Without a support branch both pull requests share the head: the existing `push` row moves both. With
one, T9 merges the task branch into the support branch (a clean merge needs no round; a conflict goes
through T6 and T8), then T11 pushes it. The test asserts the fix commit is an ancestor of both pull
requests' heads on the simulated GitHub, read from the bare origin.

## D-10 The archive to both branches (AC-9)

**`archiveFacts`** in `two-prs` also reads the test branch: `onTest` (`archived` / `active` /
`absent`, the same two `readContents` calls with `ref=<test>`), `testPr` = `archivePrFacts` for the
head `chore/archive-<id>-<test>` (the function gains the head as a parameter; today's call passes
`chore/archive-<id>`), and `testLocal` = `{ exists (refs/heads/chore/archive-<id>-<test>), worktree
(the path `listWorktrees` gives for that branch, D-11) | null, picking (the conflicted paths, from
`git -C <worktree> diff --name-only --diff-filter=U`, when the worktree has `CHERRY_PICK_HEAD`) | null
}`.

**`archiveNext`** in `two-prs`, replacing its first row and its `archive-pr-ready` row (first match
wins; the rows of today's table not named here keep their place and text):

| When | Step |
|---|---|
| base and test both `archived` | `archived` |
| `testLocal.picking` set | `stop-archive` (`archiveStep: 'test-archive-cherry-pick'`) `the archive commits of <id> conflict on <test> in <worktree>: <paths>; finish with git cherry-pick --continue there, or abort it and delete chore/archive-<id>-<test>` |
| test archive PR closed unmerged, none open or merged | `stop-archive` (`test-archive-pr`) `archive pull request #<n> to <test> was closed without merging` |
| test archive PR open with failing checks | `stop-archive` (`test-archive-pr`) `archive pull request #<n> to <test> has failing checks: <names>` |
| base archive PR open (rows above it as today) and no test archive PR | `open-test-archive-pr` `{ branch: chore/archive-<id>-<test>, base: <test>, from: chore/archive-<id>, path, exists: testLocal.exists }` |
| base `archived`, test archive PR missing | `open-test-archive-pr` (the same params) |
| any archive PR open and green, the rest merged or open | `archive-prs-ready` `{ list }` |

Every `stop-archive` row ends the run blocked (`archive-failed`, as today) and opens, pushes or closes
nothing; a closed archive pull request is never reopened or replaced by the flow (spec
`delivery-models`, "The archive to the test branch stops where it cannot go on by itself").

`open-test-archive-pr` (commit-and-pr): when `exists` is false, `git worktree add -b <branch> <path>
origin/<test>`, then `git cherry-pick` of `git rev-list --reverse origin/<base>..chore/archive-<id>`;
when `exists` is true (the owner finished a conflicted cherry-pick), neither, the branch is taken as
it is. Then push and `gh pr create --base <test>` titled as the base archive pull request with
` (<test>)`. A cherry-pick conflict is left in the worktree, as D-8 leaves a merge conflict, and the
agent reports it without pushing; the next run reads `CHERRY_PICK_HEAD` and stops on the first row
above, naming the paths (the owner decides). No auto-merge: ADR 0003 allows it only in `merge` mode.

**Archived for the loop and the roadmap.** `change-loop.mjs#archivedDates` in `two-prs` builds the same
map for the test branch (GitHub contents with `ref=<test>`, then `refs/remotes/origin/<test>`) and
keeps an id only when both maps hold it. `unfinished` maps a worktree on `chore/archive-<x>-<test>` to
the id `<x>` (rank 3, as the archive worktree). `archivedOnDefault` follows `archivedDates`, so
`/devkit roadmap` waits for both archives before an `after:` dependency counts.

## D-11 Shared helpers: one per mechanism

Searched before naming: `grep -n "devkit:" plugins/openspec/hooks/*.mjs` (only `readDevkitSettings`
reads the block), `grep -n "GITHUB_EVENT_PATH" plugins/openspec/hooks/deliver-check.mjs` (only
`ciPreflight` parses the payload), `grep -n "worktree list" plugins/openspec/hooks/*.mjs` (only
`conduct-check.mjs#listWorktrees`), `grep -n "rev-parse.*git-common-dir" plugins/openspec/hooks/*.mjs`
(`guard.mjs#mainCheckout`, private, and a copy in `change-loop.mjs#mainRoot` that this plan leaves as
it is), `grep -n "\[blocking\]" plugins/openspec/hooks/deliver-check.mjs` (only `findingsItem`).

| Mechanism | One helper | Where | Callers |
|---|---|---|---|
| Read the `devkit:` block | `parseDevkitBlock(text)`, `plainValue` moved from `change-loop.mjs` | `guard.mjs` | `readDevkitSettings`, `readDeliverySettings`, `runCi` (base text) |
| Validate the delivery settings | `deliverySettings(block)`; `readDeliverySettings(root)` reads the file | `guard.mjs` | `readDevkitSettings`, `deliveryConfig`, `testBranchViolation`, `runCi` |
| Model next to `ship:` | `deliveryConfig(root, schema)` | `deliver-check.mjs` | `collectState`, `collectFlow` |
| The `pull_request` event payload | `eventPayload(env)` (the parsed JSON, or null when unset or unreadable), extracted from `ciPreflight` | `deliver-check.mjs` | `ciPreflight` (head sha), `ciSettingsRef` (D-7) |
| The ref CI reads the settings from | `ciSettingsRef(root, env)` (D-7's table S1-S3) | `deliver-check.mjs` | `runCi` |
| A commit of the test branch in a branch | `testBranchCommit(root, { base, testBranch, head })` | `deliver-check.mjs` | `collectState` (T1), `runCi` (AC-5) |
| The pull request to the test branch | `findTestPr(gh, { id, testBranch, head })` | `deliver-check.mjs` | `collectState`, `runCi` (AC-4) |
| The resolution record | `resolutionState(root, id, refs)` | `deliver-check.mjs` | `collectState` (T8), `runCi` (test-branch PRs) |
| Undisposed findings of a folder | `findingsIn(root, dir, head)`, extracted from `findingsItem` | `deliver-check.mjs` | `findingsItem`, `resolutionState` |
| Verdict files of a folder | `verdictFiles(dir)` (`{ name, verdict, commit }`), extracted from `readReviews` | `deliver-check.mjs` | `readReviews`, `resolutionState` |
| The worktrees | `listWorktrees` (with `rebaseBranch`) moved from `conduct-check.mjs`, re-exported there | `deliver-check.mjs` | `supportState`, `archiveFacts` (`testLocal`, D-10), `conduct-check`, `change-loop` (through the re-export) |
| The main checkout | `mainCheckout` exported | `guard.mjs` | `supportState`, `openspecCli` |
| The simulated GitHub (tests) | `simGitHub({ origin })` | `delivery-models.test.mjs` | every scenario test of phases 2 to 5 |

`simGitHub` is a second fake `gh`, next to `deliver-check.test.mjs#fakeGh`, because the scenarios need
state across calls (a pull request created, closed, merged) and heads read live from the bare origin
(`git --git-dir <origin> rev-parse refs/heads/<head>`); the fixture fake answers a fixed file per call.
It answers `pr list` (filters `--head`, `--base`, `--state`), `pr create`, `pr close`, `pr checks`,
`run view`, `run rerun`, `api repos/{owner}/{repo}` (the `default_branch`), `api .../contents/...?ref=`
(read from the origin with `git ls-tree`/`git show`) and a `merge <n>` test hook that merges in the
origin with a merge commit or a squash. `mergeable` is computed with `git merge-tree` in the origin.

## D-12 ADR 0015, proposed with this plan

File `docs/adr/0015-the-delivery-model-is-chosen-per-project.md`, in the form of the existing ADRs.
Task 6.1 writes it as is (the date being the day it is written):

    # ADR 0015: The delivery model is chosen per project, and the two-PR model keeps the test branch out of the task branch

    - Status: proposed
    - Date: 2026-11-2x
    - Change: delivery-models
    - Amends: ADR 0002 (0002-merge-without-the-owner-opt-in.md), the sentence of its Decision that names `ship: <schema>: merge` as the opt-in; ADR 0003 (0003-auto-merge-the-archive-pr.md), the sentence on who merges the archive PR in `pr` mode; ADR 0010 (0010-openspec-as-the-harness.md), decision 6, which keeps the merge rules of ADR 0002 and ADR 0003 unchanged; ADR 0012 (0012-the-reviews-check-follows-the-change-script.md), decision 1, on what the check judges for a change on a devkit script

    ## Context

    ADR 0010 decision 1 puts the delivery model in the project's configuration in round 17, and
    decision 5 says that where a driver cannot refuse an action, a GitHub check on the pull request is
    the lock. docs/coordination-design.md section 5 decided three models chosen per project: two pull
    requests from the same branch, trunk-based, and trunk-based with automatic merge. In the first,
    every task branch is cut from the base branch (master or main); one pull request goes to the test
    branch (develop) and one to the base branch; the test branch never goes to the base branch, so the
    task branch never receives it, not even to solve a conflict. What to do on a conflict was open.

    devkit knew only the last two models, as the ship modes pr and merge of ADR 0002, set per schema
    in the top-level ship: map. The grill of the change delivery-models (2026-11-21) answered: both
    pull requests open together; the owner merges both; on a conflict a support branch
    <task-branch>-<test_branch> takes the test branch, and the test-branch pull request comes from
    it; the pull request to the base branch stays red until the one to the test branch is merged; the
    conflict resolution goes through the review bench again, on the resolution only; the archive
    goes to both branches.

    ## Decision

    1. The project chooses its model in openspec/config.yaml as devkit.delivery.model: two-prs,
       trunk or trunk-auto; two-prs also names devkit.delivery.base and devkit.delivery.test_branch.
       Without the key, the ship: map decides as before. With it, every ship: entry must agree
       (pr with trunk, merge with trunk-auto; plan and two-prs agree with none), or the
       configuration is refused. trunk-auto is ADR 0002's merge mode under a second spelling, with
       all of ADR 0002's conditions.
    2. In two-prs the base branch is the repository's default branch, every task branch is cut from
       it, both pull requests open together from the task branch, and the owner merges both: devkit
       enables auto-merge on neither, nor on either archive pull request.
    3. The test branch never enters a task branch. In the Claude driver a git merge, rebase or pull
       that would bring it into any branch other than the test branch or a branch named
       <name>-<test_branch> is refused, naming the support branch. devkit-reviews, on a pull request
       to the base branch, fails while the head holds a commit of the test branch's first-parent
       history that the base branch lacks, and while no pull request to the test branch from the same
       branch or its support branch is merged. It reads devkit.delivery from the repository's default
       branch (named by the pull request event, else by origin/HEAD), never from the pull request's
       head or from the test branch, and needs pull-requests: read.
    4. A conflict with the test branch is resolved on the support branch <task-branch>-<test_branch>,
       cut from the task branch, which alone receives the test branch. The resolution, read as the
       support branch's own work (each merge's difference from Git's automatic merge, and its own
       commits), is reviewed by the two required reviewers before the support branch is pushed; their
       verdicts live in reviews/resolution/. The pull request to the test branch is closed and opened
       again from the support branch. Later commits of the task branch reach it by a merge into the
       support branch.
    5. On a pull request to the test branch, devkit-reviews does not judge the delivery contract,
       which the pull request to the base branch carries; from a support branch it judges the
       resolution's verdicts.
    6. The change is archived through two archive pull requests, to the base branch from
       chore/archive-<id> and to the test branch from chore/archive-<id>-<test_branch> (cut from the
       test branch, with the same commits); it counts as archived when both branches hold it.

    ## Consequences

    - Positive: a project that tests on a shared branch before the base branch runs the devkit flow
      without carrying the test branch into the base branch; the lock holds in every driver through
      the required check, and the Claude driver refuses the command before it runs.
    - Negative: the owner merges four pull requests per change (Accepted: the owner's answer to
      question 2; two-prs is chosen per project). The check now reads GitHub in two-prs and needs a
      wider token (Accepted: read-only, and only two-prs projects need it). A fast-forward push of a
      task branch into the test branch would put the task's commits on its first-parent history and
      fail the check falsely (Accepted: GitHub's merge button never fast-forwards). A cherry-pick of a
      test-branch commit is a new commit and escapes the check (Accepted: the hook does not refuse it
      either; reviewers read the diff). A base branch other than the default branch is not supported
      (Mitigated: the change does not open, and says why).

    ### Review trigger

    A test-branch commit reaches a base branch through a merged pull request that devkit-reviews
    passed, a project needs a base branch other than its default branch, or the owner asks for the
    test-branch pull request to merge without the owner.

    ## Alternatives considered

    | Option | Pros | Cons | Cost to undo |
    |---|---|---|---|
    | ship: gains a two-prs value; devkit.delivery holds only the branch names | No second switch | Per schema where D-5 says per project; trunk and trunk-auto would never be written | low |
    | The model silently wins over a disagreeing ship: entry | No error | A project would run a model its ship: map denies, with nothing said | low |
    | Solve the conflict on the task branch by merging the test branch | One branch | D-5 forbids it: the test branch would reach the base branch | high |
    | Rebase the support branch on the test branch | Linear history | Rewrites a pushed branch; the hook refuses force pushes | medium |
    | Review the whole difference between the task and support branches | Literal | Holds every commit the test branch gained; no round can read it | low |
    | Record the pull request numbers in a file of the change | Readable offline | A second record that drifts from GitHub; the branch names already find both | low |
    | Read devkit.delivery from the pull request's head | Simpler | A pull request could switch off the rules it is judged by | low |
    | Read devkit.delivery from the pull request's base branch | No default-branch lookup | On a pull request to the test branch it reads the test branch's copy, which lags the base branch's and may name no model, so the test-branch rules would not run | low |
    | A fourth downloaded checker file for two-prs | Smaller deliver-check.mjs | Every project moving its pin would break until it edits its workflow | medium |
    | Route every default-branch read through the configured base | Any base | Six readers change, and the roadmap and archive would be read from the test branch when it is the default | medium |
    | Make the check read ship: (ADR 0012's rejected option) | Fewer runs | Still rejected: the check reads only devkit.delivery, and only for two-prs rules no other model has | low |

Task 6.2, only when `approval.md`'s owner's words accept ADR 0015: status `accepted` with an
`Accepted by:` line in ADR 0012's form, and `- Amended by ADR 0015 (0015-the-delivery-model-is-chosen-per-project.md)`
in the headers of ADRs 0002, 0003, 0010 and 0012; otherwise stop and report. Task 6.3 adds a dated
Note `Note (delivery-models, <date>)` to the Context of each of those four ADRs, naming what ADR 0015
amends there and that the Decision is otherwise unchanged, and the ADR 0015 entry (`0015 the delivery
model chosen per project and the test-branch lock, amends 0002, 0003, 0010 and 0012`) at the end of the
`ADRs:` line of `openspec/config.yaml`. The number 0015 follows ADR 0014, which
`roadmap-coordinator-followups` adds; if that change has not merged when 6.1 runs, the number stays
0015 and the gap is noted in the commit message.

## D-13 Documents, skills and release

- `docs/openspec-flow.md`: in "Shipping a change: ship modes", a subsection "Delivery models" (the
  block of D-1, the agreement table, `two-prs` from opening to the two archives, the steps the owner
  sees, the limits of D-6); the CI section (the two template lines, the two-pull-request rules, the
  settings read from the default branch (D-7's S1 to S3), re-running the check after the test-branch
  merge outside the Claude driver);
  Troubleshooting rows for `setting-missing`, `test-branch-missing`, `base-not-default`, the lock's
  refusal, the three CI failures (test-branch pull request not merged, test-branch commit, base not
  the default branch); the sentence "It ignores `DEVKIT_BYPASS` and does not read `ship` or
  `merge_method`" gains "; it reads `devkit.delivery` from the default branch, and applies rules only in
  `two-prs`", with the S3 limit of D-7 (outside GitHub Actions, without `origin/HEAD`). No new line
  says "the merge is the owner's" or "never merges" without naming a ship mode: the test `docs sweep`
  of `deliver-check.test.mjs` refuses it; write "the owner merges both pull requests".
- `docs/coordination-design.md`: the tense paragraph (the two-PR model and its lock exist since round
  17); section 4 stages 1, 13 and 14 (both pull requests open together; the owner merges the one to
  the test branch first); section 5 (the conflict answered by the support branch, "decided by the
  owner on 2026-11-21, round 17 grill, questions 3 to 5"); section 8 (the lock row's Claude cell
  "(exists)", the configuration's delivery field names decided by `delivery-models`); "Open points"
  loses the conflict item and names it among the answered ones.
- `plugins/openspec/skills/ship-change/SKILL.md`: one row per new step (D-4, D-8, D-10), each as the
  session or the dispatch sentence; one paragraph on `two-prs`.
- `plugins/core/agents/commit-and-pr.md`: a "two-PR call" (`open-prs`, `open-test-pr`, `move-test-pr`,
  `push-support`) and a "test-branch archive call" (`open-test-archive-pr`, its `exists` param, and a
  cherry-pick conflict left in the worktree and reported without pushing), as D-4, D-8 and D-10 say.
- `plugins/openspec/README.md`: one line on the delivery models.
- Release: devkit-openspec and devkit-core each to the next minor above the version on `origin/main`
  when the task runs (devkit-openspec 0.20.0 and devkit-core 0.9.0 if `roadmap-coordinator-followups`
  merged first with 0.19.0); the marketplace to its next minor; one `CHANGELOG.md` section
  `## <marketplace version> — delivery models: two pull requests from one branch, trunk and trunk-auto`;
  `python3 scripts/gen-catalog.py`; every CI pin of `docs/openspec-flow.md` to the new devkit-openspec
  tag; the version assertion of `change-loop docs: the design records the answers` follows (D-14).

## D-14 Tests

All new tests live in the new suite `plugins/openspec/hooks/delivery-models.test.mjs` (imported by
`guard.test.mjs`, one line), except where a row says otherwise; each name starts `delivery-models `.
Every scenario runs on real Git in a temporary folder (a bare origin, a main checkout, worktrees) with
`simGitHub`, with `GITHUB_HEAD_REF`, `GITHUB_BASE_REF` and `DEVKIT_*` blanked in the env.

**AC-10: the test that proves each criterion.**

| AC | Test |
|---|---|
| AC-1 | `delivery-models config: …` (the rows of P1 and P2 below) and `delivery-models open: …` (P10); today's modes by the existing suites unchanged |
| AC-2 | `delivery-models AC-2: both pull requests open together from the task branch and the state names both` |
| AC-3 | `delivery-models AC-3: the owner merges the test-branch pull request first, then the base one; auto-merge is never enabled` |
| AC-4 | `delivery-models AC-4: the base pull request's check fails naming the test-branch pull request until it merges, then passes` |
| AC-5 | `delivery-models AC-5: the hook refuses bringing the test branch into the task branch` and `delivery-models AC-5: the check fails a base pull request that holds a test-branch commit, naming it` |
| AC-6 | `delivery-models AC-6: a conflict goes to the support branch, the pull request moves, the task branch and the base pull request stay` |
| AC-7 | `delivery-models AC-7: the resolution is reviewed on its own before the support branch is pushed; a blocking finding holds it` |
| AC-8 | `delivery-models AC-8: a fix on the task branch reaches both pull requests, without and with a support branch` |
| AC-9 | `delivery-models AC-9: not delivered before the base merge; two archive pull requests; archived when both branches hold it` |

**One test per condition and label of each new predicate** (each bullet is one test; "neg" marks a
negative):

- P1 `deliverySettings`: no block; `trunk`; `trunk-auto`; `two-prs` with both names; unknown model;
  `two-prs` without `base`; `two-prs` without `test_branch`; same name twice; names under `trunk`
  ignored (neg); quoted values and comments; nested keys never set `driver` or `language` (neg); an
  empty value is unset.
- P2 `deliveryConfig`: no model with `plan`, `pr`, `merge` (three, unchanged); `trunk` alone → `pr`;
  `trunk-auto` alone → `merge`; `two-prs` alone → `pr` and the model; `trunk` + `pr` agrees (neg);
  `trunk-auto` + `merge` agrees (neg); `trunk` + `merge`; `trunk-auto` + `pr`; `two-prs` + any entry;
  any model + `plan`; a settings problem; `merge_method` still validated.
- P3 `testBranchViolation`: `merge develop`; `merge origin/develop`; `rebase develop`;
  `rebase --onto develop main`; `pull origin develop`; `pull origin develop:develop`; bare `pull` with
  upstream `origin/develop`; bare `pull` with upstream `origin/feat` (neg); `develop~2`,
  `refs/heads/develop`, `refs/remotes/origin/develop` (one each); on `feat-develop` (neg); on
  `develop` (neg); on `chore/archive-feat-develop` (neg); on `main` (refused: any other branch);
  `git -C <support> merge origin/develop` from the task worktree (neg); `cd <task> && git merge
  develop` from elsewhere; `merge develop-tools` (neg); `merge feature/develop` with no remote
  `feature` (neg); `git log develop` (neg); `git fetch origin develop` (neg); model `trunk-auto` (neg);
  no model (neg); not opted in (neg); a settings problem (neg); `DEVKIT_BYPASS=1` through the CLI
  (neg); the reason names `feat-develop`.
- P4 `testBranchCommit`: clean branch (neg); the branch merged `develop`; the branch rebased onto
  `develop`; the test pull request merged into `develop` with a merge commit (neg); squash-merged
  (neg); `develop` equal to `main` (neg).
- P5 CI on a base pull request: test PR merged; open (names #n); none; merged from the support
  branch after the first was closed; a test-branch commit (names it); a GitHub error (names the
  permission and the token); the head's config switched to `trunk` (still judged two-prs); model
  `trunk-auto` on the base (neg: today's output, no `gh` call, JSON keys unchanged); a pull request to
  another base (neg); `runSeveral` with two judged changes (the rules run once per change). The
  settings source of D-7, one test per row and label: S1 from `repository.default_branch` (JSON
  `settingsRef` names it); S1 from `pull_request.base.repo.default_branch` when `repository` lacks it;
  S1 naming a branch with no `origin/` ref falls to S2 (neg); S2 from `origin/HEAD` with no payload;
  S3 with neither, a pull request to `develop` whose own copy names no model judged as before this
  change (neg: today's output and JSON); `base` differing from the default branch read through S1
  (fails naming both, neither rule runs); the same configuration read through S3 (neg: no such
  line).
- P6 CI on a test-branch pull request: from the task branch (note, exit 0); from the support branch
  approved; verdict missing; verdict stale; undisposed `[blocking]`; only clean merges (neg); the
  test branch's own `openspec/config.yaml` names no model while the default branch's says `two-prs`
  (S1: still the note, items 1-4 not judged, and from the support branch the resolution rule
  fails on a missing verdict).
- P7 `nextStep` in `two-prs`: one test per row T0 to T18 (the tests of the `blocked` rows T0, T1 and
  T5 also assert the reason text of D-4 and that `simGitHub` recorded no create, close or merge),
  and `ready` never returned (neg), and the `merge` rows never returned (neg).
- P8 delivered: test merged only (neg); base merged with tasks ticked; the merged-list path drops a
  pull request to `develop` (neg).
- P9 `archiveNext` in `two-prs`: each row of D-10's table, one test each: the cherry-pick conflict
  left in the worktree stops naming its paths and the worktree; the closed-unmerged and the failing
  test archive pull requests stop naming the number (and the failing checks), with no create, close
  or reopen recorded by `simGitHub`; `exists: true` once the owner finished the cherry-pick (the
  branch is pushed as it is); both archived; `archive-prs-ready` naming both.
- P10 change-loop: `open` from `origin/<base>`; test branch missing; base not default; id ending
  `-develop`; a remote-less repository (neg); a `trunk` project opening as today (neg);
  `setting-missing` and `setting-unknown` for the delivery settings; `decide` maps each new step to its
  row; the owner ends render their keys with `branch`, `base`, `list`; the brief names the support
  root for `resolve-support-conflict` and `fix-resolution`, and `ctx.root` for every other hand-off
  (neg); `archivedDates` keeps an id only when both branches hold it; `unfinished` maps
  `chore/archive-feat-develop` to `feat`; a `trunk` project's `unfinished` unchanged (neg).
- P11 `classify`: `reviews/resolution/code-quality-reviewer.md` → owner `code-quality-reviewer`;
  `reviews/other/x.md` keeps its rule (neg) — in `guard.test.mjs`.
- P12 `readDelivery` in `two-prs`: `no-test-pr`, `owner-merges-test-branch`, `owner-merges-base`; both
  languages carry the codes (`flow-check.test.mjs`'s existing coverage test passes unchanged).
- P13 `actorOf`/`stateOf` for each new step (one table test, as the existing D9 table test).
- P14 `gateOf` for the three new keys (through the edited existing test, below).
- P15 `review-round.workflow.js`: the prompt names `reviews/resolution/<reviewer>.md` with
  `verdictDir`, and `reviews/<reviewer>.md` without it (neg) — in `review-round.test.mjs`.
- P16 docs: `delivery-models docs: the documents follow` (ADR 0015's headings and status, the four
  Notes, the config line naming 0015, the design's answered open point and the lock row, the flow
  doc's subsection and template lines).

**Existing tests that pin a rule this plan touches** (searched with `grep -n` over every
`*.test.mjs` of the repository for `readDevkitSettings`, `shipConfig`, `waiting-`, `ROW_STEPS`,
`actorOf`, `Object.keys(`, `permissions`, `reviews/`, `origin/<default>`, `archived on the default`,
`coordination-design`, `v0.18`):

| Test (file) | Invariant · layer | What happens |
|---|---|---|
| `change-loop settings: no block gives en and claude`, `… a block with both keys, quoted and with a comment`, `… an unknown driver and a value that is not a language tag are flagged`, `… other keys of the block and keys of other blocks are ignored`, `… shipConfig of deliver-check gives the same with and without the block` (`change-loop.test.mjs`) | the two settings read as before · settings reader | unchanged; green proves the shared reader keeps them |
| `roadmap-loop replies: every owner wait has a gate` (`roadmap-loop.test.mjs`) | every `waiting-` key has a gate code · roadmap gate table | changed: `expected` gains the three keys → `merge`, in task 2.5 |
| `change-loop replies: no internal term in either language` (`change-loop.test.mjs`) | every token of the table renders with no internal term · message table | `SAMPLE` gains `branch`, `base`, `default` (data only), task 1.4; assertions unchanged |
| `change-loop decide: the loop's step agents match conduct-check's actorOf` (`change-loop.test.mjs`) | a hand-off's agent is the checker's · loop rows | unchanged; it now also iterates the new steps |
| `conduct: deliveryStep maps every deliver-check step to its actor, agent and final state (design D9 table)` (`conduct-check.test.mjs`) | the existing steps' mapping · conduct rows | unchanged; the new steps get P13 |
| `plan and pr modes: the PR is asked with the 0.4.0 fields, no settings are read and the JSON has no merge facts (design D6)` (`deliver-check.test.mjs`) | `pr` mode asks `pr view` and its report keys are fixed · delivery checker | unchanged |
| `--ci --json: version 1, mode ci, change, schema, head, readiness, items 1 to 4 and pass (design D5)` (`deliver-check.test.mjs`) | the CI JSON keys · CI | unchanged |
| `--ci preflight: a shallow clone is exit 3 naming fetch-depth: 0`, `--ci preflight: a PR head sha that is not HEAD is exit 3 naming the ref: fix; the matching sha passes` (`deliver-check.test.mjs`) | the job checks out the full PR head · CI preflight | unchanged; green proves `eventPayload`'s extraction keeps the head-sha read |
| `workflow (<label>): pull_request only, never pull_request_target, read-only token` (`merge-setup.test.mjs`) | the job's token is read-only · workflow files | unchanged; `pull-requests: read` keeps it read-only and its regular expression still matches |
| `change-loop open: O4 starts from origin/<default> after a fetch`, `change-loop open: O4 with no remote starts from HEAD` (`change-loop.test.mjs`) | the opening start point · open | unchanged |
| `P0: archived on the default branch is "archived" from main, from the change branch and from chore/archive-<id>, exit 0 (AC-6)` (`deliver-check.test.mjs`) and the change-loop `unfinished` tests | archived on the default branch · archive facts | unchanged (no model) |
| `docs sweep: "never merges" and "the merge is the owner's" lines name a ship mode or are about commit-and-pr` (`deliver-check.test.mjs`) | owner-merge claims name a mode · documents | unchanged; constrains D-13's wording |
| `change-loop docs: the design records the answers` (`change-loop.test.mjs`) | the CI snippet pins the current release · documents | its `v0.18.x` assertion moves to the new tag in task 6.7, with a `doesNotMatch` for the previous one |
| `the pin in docs/openspec-flow.md is the commit sha of v + the devkit-openspec version …` (`deliver-check.test.mjs`) | the pin follows `plugin.json` · documents | unchanged |
| `flow-check readout: both languages cover every reason code` (`flow-check.test.mjs`) | every reason code in both languages · readout | unchanged |
| the `classify` and verdict-writer tests of `guard.test.mjs` (`reviews/security-reviewer.md` by its reviewer, refused for others) | one writer per verdict file · hook | unchanged |

## Where the siblings meet

| Sibling | Its edit | This plan's edit nearby | How they meet |
|---|---|---|---|
| `merge-staleness-first-parent` | `deliver-check.mjs#staleness` (+ `touchedPaths`); `deliver-check.test.mjs`; the CI pin and release files | new functions elsewhere in `deliver-check.mjs`; no edit of `staleness`, `readReviews`' staleness call or `deliver-check.test.mjs` | textual merge only; `resolutionState` uses exact commit equality, not `staleness` |
| `roadmap-coordinator-followups` | `roadmap-loop.mjs` (825 lines at `2300f84`), `roadmap-loop.test.mjs`, `change-loop.mjs`, `guard.mjs#typedOf`, `deliver-check.mjs#main` (`checksToWatch`), ADR 0014 | three entries of `GATE_OF_WHY` and the `expected` table of one test; `change-loop.mjs` rows, messages, `openUnderLock`, `archivedDates`, `unfinished`, `brief`; new functions in `guard.mjs`; no edit of `deliver-check.mjs#main` | rebase before phase 1 when it has merged; ADR number 0015; versions from `origin/main` (D-13) |

Both siblings bump devkit-openspec; the release rebase settles release-file conflicts
(`CONTRIBUTING.md`). Before phase 1 the implementer merges `origin/main` into the branch.

## Implementation plan

**Order** (dependency): settings and opening (phase 1) → the two pull requests in the checker, the
loop's readers and the simulated GitHub (phase 2) → the lock in the hook and in CI (phase 3) → the
support branch and the resolution round (phase 4) → the archive to both (phase 5) → ADR, documents,
skills, release and the whole suite (phase 6).

**Per surface.**

- Hooks (`plugins/openspec/hooks/`): `guard.mjs` (D-1, D-6, D-8 classify, D-11), `deliver-check.mjs`
  (D-1, D-4, D-7, D-8, D-10, D-11), `change-loop.mjs` (D-1, D-3, D-5, D-10), `conduct-check.mjs`
  (D-5, D-11 re-export), `flow-check.mjs` (D-1, D-5), `roadmap-loop.mjs` (D-5, three entries).
- Skills and agents: `plugins/openspec/skills/ship-change/SKILL.md`,
  `plugins/openspec/skills/openspec-setup/templates/devkit-reviews.yml`,
  `plugins/core/agents/commit-and-pr.md`, `plugins/core/agents/code-quality-reviewer.md`,
  `plugins/core/agents/test-coverage-reviewer.md`, `plugins/core/skills/review-change/SKILL.md`,
  `plugins/core/skills/review-change/scripts/review-round.workflow.js`.
- No worker or frontend surface.

**File structure.**

- Create: `plugins/openspec/hooks/delivery-models.test.mjs`,
  `docs/adr/0015-the-delivery-model-is-chosen-per-project.md`.
- Modify: the hooks, skills and agents above; `plugins/openspec/hooks/guard.test.mjs` (one import, P11),
  `plugins/openspec/hooks/change-loop.test.mjs` (`SAMPLE`), `plugins/openspec/hooks/roadmap-loop.test.mjs`
  (`expected`), `plugins/core/skills/review-change/scripts/review-round.test.mjs` (P15);
  `docs/openspec-flow.md`, `docs/coordination-design.md`, `docs/adr/0002-…`, `0003-…`, `0010-…`,
  `0012-…`, `openspec/config.yaml` (the `ADRs:` line), `plugins/openspec/README.md`,
  `plugins/openspec/.claude-plugin/plugin.json`, `plugins/core/.claude-plugin/plugin.json`,
  `.claude-plugin/marketplace.json`, `CHANGELOG.md`, `docs/catalog.md`.
- Delete: none.

**Estimate.** Optimistic 41 h · likely 59 h · pessimistic 85 h (the likely figure is the table's sum).

| Component | Hours | Type | Risk |
|---|---|---|---|
| D-1 shared block reader, `deliveryConfig`, settings errors; P1, P2 | 5 | Core | LOW |
| D-3 opening; P10 open rows | 3 | Core | LOW |
| `simGitHub` and the scenario fixture | 5 | Testing | MEDIUM |
| D-4 lookup by base, test PR, rows T0-T5, T13-T18, report; P7 (part), P8 | 9 | Core | MEDIUM |
| D-5 loop rows, messages, conduct, flow-check, gate table; P10, P12-P14 | 5 | Integration | LOW |
| D-6 hook lock; P3 | 4 | Core | MEDIUM |
| D-7 CI rules, settings source and template; P4-P6 (P6 after phase 4) | 7 | Core | MEDIUM |
| D-8 support branch, resolution state, rows T6-T12, classify, review-change, agents, workflow arg; P7 (rest), P11, P15 | 9 | Core | HIGH |
| D-10 archive to both, its stop rows, `archivedDates`, `unfinished`; P9, P10 (rest) | 6 | Core | MEDIUM |
| D-12 ADR 0015 and the Notes | 1 | Documentation | LOW |
| D-13 documents, skills, release; P16 | 3 | Documentation | LOW |
| Whole suite, evidence of the scenarios | 2 | Testing | LOW |

## Risks / Trade-offs

| Risk | Probability × impact | Mitigation |
|---|---|---|
| A `two-prs` project's default branch on GitHub is not its configured base (D-2) | LOW × HIGH | The owner confirmed the base is the default branch (`requirements.md`); for a misconfigured project `open` refuses with `base-not-default`, the delivery stops `blocked` (T0) and the CI check fails naming both (D-7), so nothing is delivered wrong |
| A pull request to the test branch is judged with the test branch's own, older settings (D-7) | LOW × HIGH | The settings come from the default branch named by the event payload (S1) or `origin/HEAD` (S2); only a local run with neither falls back to the base ref (S3), documented; P5 and P6 test each source |
| `simGitHub` drifts from GitHub's real answers (field names, `mergeable`) | MEDIUM × MEDIUM | It answers only the fields `deliver-check` already asks (`PR_FIELDS`, `mergedAt`, `startedAt`); the first real use is listed in `requirements.md` |
| `deliver-check.mjs` grows past 2,000 lines | HIGH × LOW | The two-pull-request code sits in one section with its own header; the CI constraint forbids a new module (D-12 alternatives) |
| Sibling merges conflict in `change-loop.mjs`, `roadmap-loop.mjs`, `guard.mjs` | HIGH × LOW | Narrow edits listed in "Where the siblings meet"; merge `origin/main` before phase 1 and before the release |
| A false refusal of the hook blocks the owner's own git work | LOW × MEDIUM | It acts only in `two-prs` projects, only on merge/rebase/pull naming the test branch, never on the test or support branches; `DEVKIT_BYPASS=1` lifts it |
| A fast-forward into the test branch makes AC-5's check fail falsely | LOW × MEDIUM | Recorded in ADR 0015; GitHub's merge never fast-forwards; the failure names the commit |
| The cherry-pick of the archive commits conflicts on the test branch | MEDIUM × LOW | Aborted and reported as `stop-archive`; the owner resolves |
| `git merge-tree --write-tree` needs git 2.38 | LOW × MEDIUM | The suite already needs it (`release-rebase`); CI runners carry newer git |

## Assumptions

- The project's base branch is its default branch on GitHub (D-2; confirmed by the owner,
  `requirements.md`, "Confirmed by the owner after the plan was written").
- Every `pull_request` event payload GitHub sends carries `repository.default_branch` and
  `pull_request.base.repo.default_branch`, and `GITHUB_EVENT_PATH` points to it in the job (D-7 S1;
  GitHub's webhook payload documentation for `pull_request`; `ciPreflight` already reads the same file).
  `actions/checkout` does not set `refs/remotes/origin/HEAD`, which is why S2 is only the local
  fallback.
- GitHub's merge button creates a merge commit, a squash or a rebase, never a fast-forward (D-7; GitHub
  documentation of merge methods).
- `actions/checkout` with `fetch-depth: 0` fetches every branch, so `origin/<base>`, `origin/<test>`
  and `origin/<task>` exist in the job (`docs/openspec-flow.md`, CI; the job already relies on
  `origin/<base>`).
- `gh pr list` accepts `--head` and `--base` together, and `gh run view --json startedAt` gives the
  latest attempt's start (gh manual).
- ADR 0014 is added by `roadmap-coordinator-followups` (its worktree at `da18ca0`); this ADR is 0015.

## Dependencies

- `change-coordinator` (archived): the loop, its rows, its locks (ADR 0011).
- `coordinator-field-fixes` (archived): `devkit-reviews` judges only devkit-script changes (ADR 0012),
  which D-7 builds on.
- `merge-setup-field-fixes` (archived at `2300f84`): the base of this plan.
- `project-setup` (round 26) depends on this change for the `devkit.delivery` fields.

## Migration Plan

Nothing changes in a project until it writes `devkit.delivery.model`. A `two-prs` project needs the
updated `devkit-reviews` workflow (the openspec-setup GitHub step rewrites it; by hand, the two lines
of D-7) and a ruleset on the base branch requiring `devkit-reviews` if the owner wants the red check
to block the merge button. Rollback: remove `devkit.delivery` (the `ship:` map decides again) or
revert the release; no data migrates.

## Open Questions

None that change the specs, the approach or the tasks. The two interpretations of D-2 and D-8 were
confirmed by the owner after the plan was written (`requirements.md`, "Confirmed by the owner after
the plan was written", 2026-11-22). ADR 0015's acceptance stays the owner's, at plan approval
(task 6.2 reads it from `approval.md`).
