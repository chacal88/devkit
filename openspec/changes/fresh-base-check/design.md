<!-- devkit-stage design result=passed attempt=1 commit=98145b018d4b38a066289b69ed972c09b2497e60 -->
# Design

Change: `fresh-base-check` · Date: 2026-11-23 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(sources: `requirements.md`, `decisions.md`, `proposal.md`, `specs/change-coordination/spec.md`,
`specs/roadmap-coordination/spec.md`, `specs/change-delivery/spec.md`).

## Context

See `proposal.md` (Why). This plan read the code at `98145b0`; the commits after it on this branch
touch plan files only, so every code claim below holds at the branch head. `origin/main` is at
`4631376` (devkit-openspec 0.32.0, marketplace 0.36.1), the fork point of this branch.

| Where | What it does today |
|---|---|
| `plugins/openspec/hooks/change-loop.mjs#nextAction` (line 1143) | Options `{ env, lang, after, openspec, gh, claims, budget = false }`. After `collectFlow` and `computeFlow`, when `inDelivery(report, flow, archiving)`, it runs `collectState(found.root, id, …)` and `buildReport`, then `defaultBase(found.root)`, then `deliveryRow({ ref: 'origin/<base>', base }, …)`. A throw becomes `row = { error }`. Then `decide(...)`, the icon, the state, the title, the Jira task |
| `change-loop.mjs#defaultBase` (line 1123) | `origin/HEAD`'s target, else `main`, else `master`, read from local refs only |
| `change-loop.mjs` helpers | `git()` and `tryGit()` (line 1111) run git with `process.env`. `LS_REMOTE_TIMEOUT_MS = 15_000` and `gitPasses()` are module-level `const`s declared at lines 1668 and 1683, after `nextAction` |
| `change-loop.mjs` callers of `nextAction` | `runNext` (line 2271, `budget: true`), `runWait`'s poll (line 2388), `stateEntries` (line 1521), `stopDecision` (line 2139) |
| `change-loop.mjs#waitLoop`, `decisionKey` (lines 2071, 2078) | The key is `[kind, end.state, end.why, agent, step, reply]`. A poll whose key differs from the first ends the wait |
| `plugins/openspec/hooks/roadmap-loop.mjs` callers of `nextAction` | `collectRoadmap` (line 661), which `runCmd` (928), `nextCmd` (957), `statusCmd` (1008) and `roadmapStopDecision` (731) call. Also `statusJson` (973), `draftCmd` (1025) and `waitCmd`'s poll (1068) |
| `plugins/openspec/hooks/conduct-check.mjs` header | "never writes files in the repository, refs or GitHub objects …, never fetches." `releaseConflict` (line 372) classifies the conflict with `git merge-tree … origin/<base> HEAD`. A clean merge in `merge` mode gives `update-branch` with the reason "GitHub reports a conflict but origin/<base> merges cleanly; update the branch" |
| `plugins/openspec/hooks/deliver-check.mjs` header | "Reads files and git; never writes, pushes or posts." It does not say "never fetches". `collectState` reads `origin/<base>` in the archive file check (line 1108) and the two-pull-request facts (line 749) |
| `docs/openspec-flow.md` | Line 230 "The loop.", line 236 "Waiting on GitHub.", the `conduct-check` section ("never fetches (run `git fetch origin --prune --quiet` first)"), line 486 ("`deliver-check` does not fetch"), the roadmap section's "What it decides and says.", and the CI pins of the CI example (lines 653, 654, 667 at this plan's base, naming the devkit-openspec version of the manifest; `release-merge.mjs#pinsIn` reads them). Edit by the quoted text, not by line number |

Constraints:

- `deliver-check.mjs`, `guard.mjs` and `merge-setup.mjs` are the three files a project's
  `devkit-reviews` workflow downloads. Only a comment line of `deliver-check.mjs` changes.
- The agents' briefs end with "do not fetch." (`change-loop.mjs#decide`, `brief`). That stays: the
  loop fetches, the agents do not.
- Product code is closed until the plan is approved. The implementer's hand-offs write the code and
  the release files (ADR 0011 decision 2, ADR 0016).

## Goals / Non-Goals

**Goals:**

- One helper fetches the base and records the result (`refreshBase`, D-1). `nextAction` calls it,
  and nothing else in the repository does.
- One opt-in option, `fetchBase`, which takes a per-call record of fetched bases (D-2). Every caller
  that drives a change passes one, and every reader leaves it out (D-3).
- A failed fetch changes nothing but one field and one reply line, and that line never ends a wait
  by itself (D-4).
- Each new guard and labelled branch has its own test, negatives included (D-8). Every existing test
  that pins a text this change edits is named (D-9).

**Non-Goals:**

- `conduct-check.mjs` and `deliver-check.mjs` code, `release-merge.mjs`, `project-loop.mjs` (the
  slice loop asks no `deliveryRow`), `guard.mjs`, `merge-setup.mjs`, the panel, the CompozyOS loop.
- Fetching the test branch in `two-prs` (the `merge-into-support` step already fetches it).
- What a base move invalidates (`stale-only-on-own-files`), holding a sibling's merge
  (`delivery-merge-hold`), batching deliveries (`delivery-train`).
- A setting to turn the fetch off or change its timeout.
- Showing the "judged from this machine's copy" line in the roadmap session. Each change's action
  carries it, and the change session of a roadmap run with a session per change says it. The roadmap
  decision does not repeat it.

## D-1 The fetch helper (AC-1, AC-4, AC-5)

Two new exports in `plugins/openspec/hooks/change-loop.mjs`, placed above `nextAction` in the
section "reading the change (D-5)":

```js
// The record of the bases one call fetched (fresh-base-check D-1): one per command call, one per poll of a wait.
export function baseFetches() { return new Map(); }

// Fetches origin/<base> into refs/remotes/origin/<base> and nothing else, at most once per (git common dir, base) in `memo`.
// Returns { ok: true, base } | { ok: false, base, error } | null (no origin remote: nothing fetched).
export function refreshBase(root, base, { env = process.env, memo, timeoutMs = LS_REMOTE_TIMEOUT_MS } = {}) { … }
```

Its steps:

1. `common` is `realpathSync` of `tryGit(root, ['rev-parse', '--path-format=absolute', '--git-common-dir'])`,
   or `root` when that is empty. `key` is `${common}\u0000${base}`. When `memo.has(key)`, return
   `memo.get(key)`. Both worktrees of one clone share the key.
2. When `gitPasses(root, ['remote', 'get-url', 'origin'])` is false, store and return `null`.
3. Run `execFileSync('git', ['-C', root, 'fetch', '--no-tags', '--quiet', '--no-write-fetch-head', 'origin', `+refs/heads/${base}:refs/remotes/origin/${base}`], { env: { ...env, GIT_TERMINAL_PROMPT: '0' }, timeout: timeoutMs, stdio: ['ignore', 'ignore', 'pipe'], encoding: 'utf8' })`.
   The `env` is the caller's environment, so the `git` on its `PATH` runs. The tests count the
   fetches through it (D-8).
4. On success the result is `{ ok: true, base }`. On a throw it is `{ ok: false, base, error }`. The
   `error` is `timed out after <timeoutMs / 1000, rounded> s` when the throw is the timeout
   (`e.code === 'ETIMEDOUT'`, or `e.signal` set). Otherwise it is the first non-empty line of
   `e.stderr`, trimmed, else the first line of `e.message`. The `error` never holds a newline.
5. Store the result in `memo` under `key` and return it. A failure is stored too: a roadmap call
   over three changes does not wait three times 15 seconds.

`LS_REMOTE_TIMEOUT_MS` and `gitPasses` stay where they are. The default parameter and the call are
evaluated when `refreshBase` runs, after the module has loaded, so their later declaration is not
a temporal dead zone. Do not copy either into a new top-level `const` above line 1668: that would
throw at import. The refspec is forced (`+`): a base that was force-pushed on the remote is still
mirrored, as a plain `git fetch` does for the default refspec.

## D-2 `nextAction` fetches before the delivery read (AC-1, AC-4, AC-5)

`nextAction` gains the option `fetchBase = false`. When given, it is a `baseFetches()` record. At the
top of the function body, `let baseFetch = null;` (it is read after `decide`, outside the delivery
block). Inside `if (inDelivery(report, flow, archiving))`, before the `try`:

```js
const baseBranch = defaultBase(found.root);
if (fetchBase) baseFetch = refreshBase(found.root, baseBranch, { env: clean, memo: fetchBase });
```

`baseBranch` moves out of the `try` and is used by `deliveryRow` as today. `collectState` runs after
the fetch, so the archive file check and the staleness facts read the fetched ref too (proposal,
choice 4). A change outside its delivery part fetches nothing, and `baseFetch` stays `null`.

Right after `const action = decide({...})`:

```js
if (baseFetch) {
  action.baseFetch = baseFetch;
  if (!baseFetch.ok) {
    const line = render(normalizeLang(lang), 'base-unfetched', { base: baseFetch.base });
    action.reply = typeof action.reply === 'string' && action.reply !== '' ? `${action.reply}\n${line}` : line;
  }
}
```

The action, its exit code (`exitCodeOf` reads `kind` and `end` only), its `state`, its icon and its
title are those of the local copy. With `baseFetch.ok` true no line is added. With no `origin`
remote `refreshBase` returns `null` and the action has no `baseFetch` key, exactly as today.

## D-3 Who passes `fetchBase` (AC-2, AC-6)

| Caller | Passes | Record |
|---|---|---|
| `change-loop.mjs#runNext` | yes | `baseFetches()` once per call |
| `change-loop.mjs#runWait`, its `poll` | yes | a new `baseFetches()` in each `poll` call |
| `change-loop.mjs#stateEntries`, `#stopDecision` | no | — |
| `roadmap-loop.mjs#collectRoadmap` | its new option `fetchBase = false`, handed to every `nextAction` of the call | the caller's |
| `roadmap-loop.mjs#runCmd`, `#nextCmd` | yes | `baseFetches()` once per call |
| `roadmap-loop.mjs#waitCmd`, its `poll` | yes | a new `baseFetches()` in each `poll` call |
| `roadmap-loop.mjs#statusCmd`, `#statusJson`, `#draftCmd`, `#roadmapStopDecision` | no | — |

`roadmap-loop.mjs` imports `baseFetches` from `./change-loop.mjs` next to `nextAction`. `run` is the
proposal's choice 1. A record per call rather than one per module is choice 2: the CLI runs one
command per process, so the record per call is the record per process. In-process tests that run
`next` twice see two fetches, and a `wait` fetches at every poll without forgetting anything.

## D-4 The wait does not end on the line alone (spec: the wait fetches at each poll)

`decisionKey` in `change-loop.mjs` keys the reply without the line D-2 appended:

```js
const ownReply = (a) => {
  if (a.baseFetch?.ok !== false || typeof a.reply !== 'string') return a.reply ?? null;
  const cut = a.reply.lastIndexOf('\n');
  return cut < 0 ? null : a.reply.slice(0, cut);
};
const decisionKey = (a) => JSON.stringify([a.kind, a.end?.state ?? null, a.end?.why ?? null, a.agent ?? null, a.step ?? null, ownReply(a)]);
```

The line holds no newline, so the cut is exact. A wait whose fetch fails at one poll and succeeds
at the next keeps polling. `isWait` and `isUnreadable` are unchanged. The roadmap's `waitCmd` uses
the same `waitLoop`.

## D-5 The reply line (AC-4)

One new key, `base-unfetched`, in both tables of `MESSAGES` (`change-loop.mjs`), placed after
`waiting-github`:

- `en`: `The branch {base} could not be fetched from the remote, so this step was decided from this machine's copy of it.`
- `pt-BR`: `Não foi possível buscar o branch {base} no remoto, então este passo foi decidido pela cópia desta máquina.`

The name avoids the `waiting-` prefix that `roadmap-loop.test.mjs` line 585 lists. `{base}` is in
the test's `SAMPLE`, so "change-loop replies: no internal term in either language" renders and checks
it: no backtick, no file name, no option, no `name=value`, and translated.

## D-6 The checkers stay pure (AC-3)

`plugins/openspec/hooks/deliver-check.mjs`, line 3, becomes:
`// Reads files and git; never writes, pushes, posts or fetches.` Nothing else changes in that file.
The header of `conduct-check.mjs` already says "never fetches", and stays as it is.

## D-7 Docs and skills (AC-7)

`docs/openspec-flow.md`:

Each edit is anchored by its quoted text; the line numbers are those of this plan's base.

1. "The loop." paragraph (line 230): after the sentence ending "the loop copies their decision and
   adds none.", insert: "Before it asks the delivery checker, `next` fetches the default branch
   from `origin` into `origin/<base>` (`git fetch --no-tags --quiet --no-write-fetch-head origin
   +refs/heads/<base>:refs/remotes/origin/<base>`, at most 15 seconds, once per call), so the
   release-conflict, staleness and archive steps are judged from the base as the remote has it; the
   fetch writes that one ref. A fetch that fails stops nothing: the action is decided from the local
   copy, records `baseFetch: { ok: false, base, error }`, and its reply ends with one line saying so.
   A successful one records `baseFetch: { ok: true, base }`. `state` and the locks never fetch."
2. "Waiting on GitHub." paragraph (line 236): after "holds no state and exits as soon as GitHub's answer
   changes the decision;", insert "each poll fetches the base first, as `next` does, and a failed
   fetch alone is no new decision;".
3. The `conduct-check` section: replace "and never fetches (run `git fetch origin
   --prune --quiet` first)" with "and never fetches: the loops of `/devkit change` and `/devkit
   roadmap` fetch the base before they ask it, and a run by hand needs `git fetch origin --prune
   --quiet` first".
4. Line 486: replace "and `deliver-check` does not fetch" with "and `deliver-check` never fetches
   (the loop of `/devkit change` fetches `origin/<base>` before it asks, but the archive state is
   still read from GitHub)".
5. The roadmap section, "What it decides and says." paragraph: at its end, add "`run`, `next` and
   `wait` fetch the base once per call (and at each poll of a wait) before they decide a change in
   delivery, as the change loop's `next` does; `status`, `status --json`, `draft` and the locks
   never fetch."

`plugins/openspec/skills/ship-change/SKILL.md`, the `update-branch` row (line 69): append
"`deliver-check` never fetches; under `/devkit change` the loop fetched `origin/<base>` just before
it handed this step." The row keeps `gh pr update-branch <next.number>` (pinned, D-9).

`plugins/openspec/skills/devkit/SKILL.md`, `## Loop`: a new paragraph between "An end the session
declares itself …" and "Then run `next` again.": "An action whose `baseFetch.ok` is false ends its
`reply` with one line saying the step was decided from this machine's copy of the base: keep that
line for the message that ends the turn, whatever the action's kind." No heading changes (the
section list is pinned, D-9).

## D-8 New tests

Every new test's name starts `fresh-base-check <n>: `. The fixtures are real repositories (a bare
origin and a clone, `roundRepo`) with the fake `gh`. Nothing reads this repository's history.

Import form. In `change-loop.test.mjs` the new tests reach the two new exports through the namespace
the file already imports (line 19): `changeLoopModule.refreshBase(...)` and
`changeLoopModule.baseFetches()`. They are not added to a named import: an ES module whose named
import is missing fails to load as a whole, so before task 1.2 no test of the file would run and the
red run of task 1.1 could not split as stated below. A call through the namespace before 1.2 throws
`TypeError` inside its own test only. In `roadmap-loop.test.mjs`, task 2.1 runs after 1.2 has
landed, so it adds `baseFetches` to the existing named import from `./change-loop.mjs` (line 13),
and imports `gitShim`, `deliveredChange` and `implementingChange` (written in 1.1) from
`./change-loop.test.mjs` next to `readCounter`.

Helpers, in `plugins/openspec/hooks/change-loop.test.mjs` unless named otherwise:

- `gitShim()` (exported): a folder holding an executable `git` (`/bin/sh`) that appends `$*` to
  `$GIT_SHIM_LOG` when one argument is `fetch`, runs `exec sleep "$GIT_SHIM_SLEEP"` when that
  variable is set and the call is a fetch, and otherwise runs `exec <real git> "$@"`. The real git
  is resolved once with `command -v git` when the helper is built. Returns
  `{ env(base, { sleep } = {}), fetches() }`: `env` puts the folder first on `base.PATH` and sets
  the log path. `fetches()` returns the logged lines.
- `deliveredChange` gains the options `config = PR_CONFIG`, `files = RELEASE`, `id = 'feat'`,
  `t = null` (reuse a `roundRepo`) and `roadmap`, and is exported. Existing callers keep their
  defaults and their results.
- `staleBase(t)`: after the fixture's `commitOrigin`, the remote's sha is `git -C <originDir>
  rev-parse main`. The helper runs `git -C <main> update-ref refs/remotes/origin/main <that sha>^` and
  returns `{ remote, stale }`. `commitOrigin` pushes from the clone, which moves the clone's
  `origin/main` with it, so a base is stale only after `staleBase`. Every row below that says
  "stale" therefore names the remote commit it rewinds: the merge fixture's `conflicts` commit, or
  `t.commitOrigin({ 'other.txt': 'o\n' }, 'origin moves')` on a fixture that has none.
- `implementingChange(t, id)` (exported): a worktree `t.addWt(id)` holding a `devkit-lite` change
  whose requirements, proposal, specs and tasks are passed at its commit and whose task is not
  ticked, committed. The stage checker places it at `implementation`, the build part, without
  reading GitHub.
- `plugins/openspec/hooks/conduct-check.test.mjs` exports `MERGE_CONFIG`, `MERGE_FILES` and
  `presetMerge`, unchanged.

`refs(root)` below means `git for-each-ref --format=%(refname) %(objectname)`. "The stale merge
fixture" is `deliveredChange({ config: MERGE_CONFIG, files: { ...RELEASE, ...MERGE_FILES }, conflicts:
['CHANGELOG.md', '.claude-plugin/marketplace.json'], mergeable: 'CONFLICTING', checks: [check('build',
'pass')] })`, then `presetMerge(gh)` and `staleBase(t)`.

| # | Suite | AC | What it asserts | Kind |
|---|---|---|---|---|
| 1 | change-loop | AC-1 | Stale merge fixture: `nextAction(t.main, 'feat', { env })` with no `fetchBase` gives a `session` action, step `update-branch`, `detail.reason` matching `/merges cleanly/`, and `origin/main` still at `stale`. Then `next` gives exit 0, an `agent` action with step `resolve-release-conflict`, `baseFetch` deep-equal `{ ok: true, base: 'main' }`, no `reply` key, and `origin/main` at `remote` | positive |
| 2 | change-loop | AC-4 | Stale merge fixture, `git remote set-url origin <a missing folder>`. `next` gives the same `kind` and `step` as the no-fetch `nextAction` (`update-branch`) and the same exit code. `baseFetch.ok` is false, `base` is `main`, and `error` is one non-empty line. `reply` equals `render('en', 'base-unfetched', { base: 'main' })`. `origin/main` is still at `stale`. With `--lang pt-BR` the reply is the Portuguese line | negative |
| 3 | change-loop | AC-4 | `changeLoopModule.refreshBase(t.main, 'main', { env: shim.env(cleanEnv, { sleep: 30 }), memo: changeLoopModule.baseFetches(), timeoutMs: 1000 })` returns `ok` false and `error` `timed out after 1 s`, within 10 seconds, with `origin/main` unchanged | negative |
| 4 | change-loop | AC-4 | Stale merge fixture with a file `<git common dir>/refs/remotes/origin/main.lock`. `next` gives `baseFetch.ok` false, an `error` matching `/lock/i`, the no-fetch action and `origin/main` at `stale`. The test removes the lock at its end | negative |
| 5 | change-loop | AC-5 | Delivered fixture (PR mode), then `t.commitOrigin({ 'other.txt': 'o\n' }, 'origin moves')` and `staleBase(t)`. From a second clone of `originDir`, push a branch `other` and a tag `v9`. Before and after `next`: `refs(t.main)` differs only in the `refs/remotes/origin/main` line. No `refs/tags/v9` and no `refs/remotes/origin/other`. `git status --porcelain` and `git ls-files -s` are unchanged in `t.main` and in the worktree. `FETCH_HEAD`: `roundRepo` itself runs `git fetch -q origin` on the clone, which writes one, so before `next` the test resolves `git rev-parse --path-format=absolute --git-path FETCH_HEAD` in `t.main` and in the worktree and deletes that file in both (`rmSync(..., { force: true })`); after `next`, neither path exists. Self-check: a plain `git -C <worktree> fetch -q origin` run afterwards makes the worktree's path exist, so the assertion can fail | positive |
| 6 | change-loop | AC-2 | Delivered fixture with checks pending, `env` through `gitShim`. `runCommand(['wait', …])` with a `sleep` that sets the checks to `pass` at its second call ends with a non-wait action. `fetches()` has exactly three lines, one per poll | positive |
| 7 | change-loop | AC-2 | Stale merge fixture through `gitShim`: `main(['state', '--change', 'feat', '--lang', 'en'])`, `stateEntries(t.main, { id: 'feat', … })` and `stopDecision(stopInput(t.main, runTranscript()), { env })` log no fetch. `origin/main` stays at `stale`. `stopDecision`'s `why` is not `no-run`, so it read the change | negative |
| 8 | change-loop | spec: one fetch per base in one call | Delivered fixture through `gitShim`: first, two `nextAction` calls sharing one `changeLoopModule.baseFetches()` log one fetch; then, with the shim's log emptied, two `next` calls log two | positive and negative |
| 9 | change-loop | AC-3 | Stale merge fixture: `node conduct-check.mjs --json --change feat` (cwd `t.main`) and `node deliver-check.mjs feat --json` (cwd the worktree), spawned with `env` through `gitShim`, log no fetch, and `origin/main` stays at `stale`. The first six lines of each file match `/never fetches|or fetches/`. Self-check: `git fetch` run through the same shim is logged, so the assertion can fail | negative |
| 10 | change-loop | spec: the wait | `waitLoop` with synthetic polls: a wait, then the same wait with `baseFetch: { ok: false, … }` and the line appended, then a different action. It returns the third, after three polls | negative |
| 11 | change-loop | AC-7 | `docs/openspec-flow.md` holds the five texts of D-7, and no longer holds "never fetches (run"; the `ship-change` `update-branch` row and the `devkit` skill's `## Loop` section hold their D-7 sentences | positive |
| 12 | roadmap-loop | AC-6 | A `roundRepo` with a roadmap of `a`, `b`, `c` and `implementingChange` for each, then `t.commitOrigin({ 'other.txt': 'o\n' }, 'origin moves')` and `staleBase(t)`. `doNext(t.main, [], { env: shim.env(cleanEnv) })` logs exactly one fetch, and `origin/main` reaches the remote's sha | positive |
| 13 | roadmap-loop | AC-2 | The delivered fixture with checks pending, its roadmap listing `feat`. `loopModule.main(['wait', '--change', 'feat', …FLAGS], { cwd: t.main, env: shim.env(env), gh: t.ghFor(wt), sleep })` with the flipping `sleep` of test 6 logs three fetches | positive |
| 14 | roadmap-loop | AC-2 | The fixture of test 12: `doStatus`, `status --json` and `roadmapStopDecision(...)` log no fetch, and `origin/main` stays stale | negative |
| 15 | roadmap-loop | proposal choice 1 | The fixture of test 12: `doRun(t.main, '', { env: shim.env(cleanEnv) })` logs exactly one fetch | positive |
| 16 | change-loop | spec: a repository without a remote (D-1 step 2, D-2) | Delivered fixture, then `git -C t.main remote remove origin` (the config is shared, so the worktree has no `origin` either), env through `gitShim`. `next` logs no fetch; its action has no `baseFetch` key; its `kind`, `step`, `reply` and exit code equal those of `nextAction(<worktree>, 'feat', { env })` with no `fetchBase` on the same fixture. Then `changeLoopModule.refreshBase(t.main, 'main', { env, memo })` returns `null` and logs no fetch, and a second call with the same `memo` returns `null` again (the `null` is memoized) | negative |
| 17 | change-loop | spec: a change before its delivery (D-2) | A `roundRepo` with a worktree `t.addWt('plan')` holding a `devkit-lite` change whose `requirements.md` alone is passed (the stage checker places it at `proposal`), then `t.commitOrigin({ 'other.txt': 'o\n' }, 'origin moves')` and `staleBase(t)`, env through `gitShim`. `next --change plan` logs no fetch, its action has no `baseFetch` key, and `origin/main` stays stale. Self-check, same repository: `implementingChange(t, 'impl')` and `next --change impl` log exactly one fetch, so the assertion can fail | negative |
| 18 | roadmap-loop | spec: the remote cannot be reached during a run | The fixture of test 12, then `git -C t.main remote set-url origin <a missing folder>`. `loopModule.collectRoadmap(t.main, { env: shim.env(cleanEnv), lang: 'en', gh: OFFLINE, fetchBase: baseFetches() })` returns `actions` for `a`, `b` and `c`, each with `baseFetch.ok` false, `base` `main` and the same one-line `error`, and each with the `kind` and `step` that `nextAction(t.main, <id>, { env: cleanEnv, lang: 'en', gh: OFFLINE })` gives with no `fetchBase` (the local copy's decision); the shim logs exactly one fetch for the call (the failure is memoized). Then, with the shim's log emptied, `doNext(t.main, [], { env: shim.env(cleanEnv) })` logs exactly one fetch, does not exit 3, and `origin/main` stays stale | negative |

Test first: tasks 1.1 and 2.1 write these tests and run them before the code they test exists. The
output, as printed, goes to `openspec/changes/fresh-base-check/proof/red-1.txt` and `red-2.txt`.
Expected red: 1, 2, 3, 4, 5, 6, 8, 10, 11, 12, 13, 15, 16, 17 and 18, which need `refreshBase`,
`baseFetches`, the option or the texts. Test 16 is red on its `refreshBase` call (a `TypeError`
through the namespace); its `next` assertions already hold. Test 17 is red on its self-check only;
its plan-stage assertions already hold. Test 18 is red because no action carries `baseFetch`. Test 9
is red too, on its header assertion only, until D-6; its "no fetch" assertions already hold.
Expected green before the code: 7 and 14, which pin today's behaviour. A different result is settled
in its task before the code task starts.

Which task turns each red test green, by the entry point the test drives:

| Task | Lands | Tests that pass after it | Why not earlier |
|---|---|---|---|
| 1.2 | `refreshBase`, `baseFetches`, `nextAction`'s option, `decisionKey`, the message | 3, 10, 16 (and 7, still green) | they call `refreshBase`, `waitLoop` or `nextAction` directly, or (16) assert no fetch through `next` |
| 1.2 | same | 8 still fails, on its two-`next` assertion only (its shared-record `nextAction` half passes) | `runNext` passes no record until 1.3 |
| 1.3 | `runNext` and `runWait` pass `fetchBase` | 1, 2, 4, 5, 6, 8, 17 (and 7, still green) | each drives the `next` or `wait` command |
| 1.4 | the `deliver-check.mjs` header | 9 | its header assertion |
| 2.2 | the roadmap callers | 12, 13, 15, 18 (and 14, still green) | each drives `collectRoadmap` or a roadmap command |
| 2.3 | the docs and skills | 11 | its text assertions |

Test 8 asserts its `nextAction` half before its `next` half, so the failure message after 1.2 names
the `next` assertion.

Test 3 proves the timeout on `refreshBase` itself; the action's record of it is the same `ok: false`
branch of D-2 that test 2 proves through `next`, so no 15-second `next` run is added.

## D-9 Existing tests that pin the edited texts

Searches run while planning (re-run them in tasks 1.1 and 2.1):
`grep -n "never fetch\|does not fetch\|not fetch\|do not fetch" plugins/openspec/hooks/*.test.mjs`,
`grep -rn "prune --quiet\|update-branch <next\|Waiting on GitHub\|reply ?? null" plugins/*/hooks/*.test.*`
and `grep -n "SAMPLE\|waiting-" plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/roadmap-loop.test.mjs`.

| Suite | Layer | Test | Invariant | Action |
|---|---|---|---|---|
| `change-loop.test.mjs` line 633 | the brief | the brief holds `do not fetch.` | agents never fetch | kept; the brief is unchanged |
| `project-loop.test.mjs` line 1022 | the slice brief | `do not fetch\.` | same | kept |
| `deliver-check.test.mjs` line 3231 | the skill text | `format: ship-change enables auto-merge …`: the `update-branch` row matches `gh pr update-branch <next\.number>` | the row's command | kept; D-7 appends to the row |
| `change-loop.test.mjs` lines 2424, 2444 | the skill text | `change-loop skill: the wait is started …` and `… the sections of D-3 to D-9 …` | the wait section and the section list | kept; no heading is added |
| `guard.test.mjs` line 1582 | the skill text | `stage-roles gates: …` slices `## Owner gates` to `## Waiting on GitHub` | the gates section | kept |
| `change-loop.test.mjs` line 5557 | the docs | the state paragraph follows "**Waiting on GitHub.**" | paragraph order | kept; D-7 edits inside the paragraph |
| `change-loop.test.mjs` line 124 | the message table | `change-loop replies: no internal term in either language` | every reply is plain and translated | kept; it now also checks `base-unfetched` |
| `roadmap-loop.test.mjs` line 585 | the message table | the `waiting-` keys | the roadmap's waits | kept; the new key has no `waiting-` prefix |
| `change-loop.test.mjs` lines 849 to 905 | the loop, end to end | `next` on `deliveredChange` (exact `reply`, two checkouts give the same stdout) | the delivery answers | kept; the fixture's origin is local and current, so the fetch succeeds and adds no line. Default options keep the fixture as it is |
| `change-loop.test.mjs`, the `waitLoop` tests | the wait | the key ends the wait on a changed reply | a changed decision ends the wait | kept; with no `baseFetch` the key is today's |
| `change-loop.test.mjs`, "change-loop docs: the design records the answers" | the docs | the CI pins equal the manifest version | release pins | kept; task 3.1 moves the pins with the bump |

## D-10 Release

devkit-openspec takes a minor bump, and the marketplace's `metadata.version` takes one too: the next
free numbers on `origin/main` at the last merge before review (0.33.0 and 0.37.0 when this plan was
written). Each goes into `plugins/openspec/.claude-plugin/plugin.json` and
`.claude-plugin/marketplace.json`. Add a `CHANGELOG.md` section
`## <marketplace version> — the loop fetches the base before it judges` with one bullet for
devkit-openspec. Move every CI pin of `docs/openspec-flow.md` to the new devkit-openspec tag: the
pins are the lines of the CI example that name the devkit-openspec version the manifest held before
the bump (`release-merge.mjs#pinsIn` reads them; `git grep -n 'v[0-9]*\.[0-9]*\.[0-9]*' --
docs/openspec-flow.md` lists them with the floors around them). That old version is whatever
`origin/main` carries at the last merge before review, not a number fixed by this plan: a sibling
that released first will have moved it. Then run `python3 scripts/gen-catalog.py`. The proof is by
the new tag: the existing test "change-loop docs: the design records the answers" asserts that every
CI pin names the manifest's version (`pinMismatches`). Siblings that bump the same pack are renumbered at the release
merge (`CONTRIBUTING.md`, step 5).

## Alternatives considered

- **Fetch inside `conduct-check` or `deliver-check`.** Rejected by the owner in the grill
  (requirements question 1). The panel and the CompozyOS loop read the checkers and rely on them
  never fetching, and `deliver-check --ci` runs in projects' CI.
- **Fetch in the `devkit` skill before every `next`.** Rejected. The rule would live in prose, the
  roadmap's `next` and both waits would need it too, and a test could not count it.
- **Fetch at the top of `nextAction`, for every change.** Rejected. Plan stages do not read the
  base, and the state command and the locks must stay offline readers.
- **One record per module (literal "per process").** Rejected for D-3's reasons. In-process tests
  and a long `wait` would share one record.
- **`git fetch origin <base>` (the short form).** Rejected for the proposal's choice 3. It writes
  `FETCH_HEAD`, and it does not update the ref where `remote.origin.fetch` does not map the base.
- **Retry a failed fetch.** Rejected. The next call or poll fetches again anyway, and a retry
  doubles the worst-case wait on a dead network.

## Risks / Trade-offs

| Risk | Probability × impact | Mitigation |
|---|---|---|
| A slow remote adds up to 15 s to each `next` in delivery | MEDIUM × MEDIUM | The fetch runs only in the delivery part, once per call. The timeout is the one `remoteClaims` already uses. A timeout falls back to the local copy and says so |
| Two sessions fetch the same ref at once (a roadmap with a session per change) and one fails on the ref lock | MEDIUM × LOW | The lock failure is a failed fetch, so the action is decided from the local copy, which the other session has just refreshed. Test 4 pins it |
| With a fresh base, `update-branch` and the staleness steps appear as soon as `main` moves, so there are more delivery round trips on a busy `main` | HIGH × MEDIUM | Accepted by the owner in `requirements.md`. Cutting what a move invalidates is `stale-only-on-own-files` |
| A credential prompt or an SSH host-key prompt hangs the fetch | LOW × MEDIUM | `GIT_TERMINAL_PROMPT=0`, standard input closed, and the 15 s timeout. A hung SSH child is killed with git at the timeout |
| A git older than 2.29 refuses `--no-write-fetch-head` | LOW × LOW | That is a failed fetch: nothing blocks, and the reply line says so. The release-conflict override already needs git 2.38 |
| `state` (and the panel) can show a step decided from a staler base than `next` | MEDIUM × LOW | ADR 0017: the state is derived on every read. The next `next` refreshes the shared ref, and later reads agree |
| The reply line makes a wait end on a flapping network | LOW × MEDIUM | D-4 keys the decision without the line. Test 10 pins it |
| Existing delivery tests slow down by one local fetch each | HIGH × LOW | The fetch is from a local bare folder, which takes milliseconds. The whole-suite gate (3.2) measures it |

## Migration Plan

No migration. The new field is optional and readers ignore unknown keys. A project picks the change
up with the plugin update. Rollback: revert the release. Removing the `fetchBase` arguments alone
restores today's behaviour, and the fetch leaves nothing behind but a fresher remote-tracking ref.

## Implementation plan

Dependency order: the helper and `nextAction` (D-1, D-2, D-4, D-5), then the callers (D-3), then
docs, skills and the release (D-6, D-7, D-10).

**Per surface.**

- Hooks (`plugins/openspec/hooks/`): `change-loop.mjs` (D-1 to D-5), `roadmap-loop.mjs` (D-3) and
  a comment in `deliver-check.mjs` (D-6).
- Skills: `plugins/openspec/skills/devkit/SKILL.md`, `plugins/openspec/skills/ship-change/SKILL.md`.
- Docs and release: `docs/openspec-flow.md`, `CHANGELOG.md`, `plugins/openspec/.claude-plugin/plugin.json`,
  `.claude-plugin/marketplace.json`, `docs/catalog.md`.
- No frontend, worker or schema surface.

**File structure.** Create: `openspec/changes/fresh-base-check/proof/red-1.txt` and `red-2.txt`.
Modify: the files above, `change-loop.test.mjs`, `roadmap-loop.test.mjs` and `conduct-check.test.mjs`
(three exports). Delete: none.

**Estimate.** Optimistic 9 h, likely 13 h, pessimistic 19 h. The pessimistic case is the fixtures:
merge mode in a delivered change, and a roadmap of three changes at implementation.

| Component | Hours | Type | Risk |
|---|---|---|---|
| Test helpers (`gitShim`, `deliveredChange` options, `staleBase`, `implementingChange`, the exports) | 2 | Testing | MEDIUM |
| Tests 1 to 10, 16, 17 and the red run | 3 | Testing | MEDIUM |
| `refreshBase`, `baseFetches`, `nextAction`, `runNext`, `runWait`, `decisionKey`, the message (D-1 to D-5) | 2 | Core | LOW |
| `deliver-check.mjs` header (D-6) | 0.25 | Core | LOW |
| Tests 11 to 15, 18 and the red run | 2 | Testing | MEDIUM |
| `roadmap-loop.mjs` callers (D-3) | 1 | Integration | LOW |
| Docs and skills (D-7) | 1 | Documentation | LOW |
| Release (D-10) | 0.75 | Documentation | LOW |
| Whole suite, `check.py`, catalog, validate | 1 | Testing | LOW |

**Assumptions.**

- `git fetch` with an explicit `+src:dst` refspec writes only `dst` and, with
  `--no-write-fetch-head`, no `FETCH_HEAD` (git-fetch(1); test 5 checks it).
- `execFileSync` throws with `code === 'ETIMEDOUT'` and a `signal` when `timeout` expires (Node
  `child_process` docs; test 3 checks it).
- The stage checker places a `devkit-lite` change with passed plan headers and an unticked task at
  `implementation` without calling `gh` (`flow-check.mjs#readDelivery` is lazy, line 266). Test 12's
  red run confirms it. If it does not hold, the fixture uses the delivered fixture with a `gh` per
  change, settled in task 2.1.
- `presetMerge` and `MERGE_CONFIG` bring a delivered change in `merge` mode to item 5
  (`conduct-check.test.mjs` line 684 does it for `conductState`). Test 1's red run confirms it for
  `nextAction`.

**Dependencies.** `release-merge-conflict` (archived): `releaseConflict` and its `update-branch` and
`resolve-release-conflict` outcomes. `remote-worker` (archived): `LS_REMOTE_TIMEOUT_MS`,
`gitPasses`. `gh-version-check` (archived): the fake `gh` keys the delivered fixture sets. No open
decision.
