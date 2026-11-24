<!-- devkit-stage design result=passed attempt=2 commit=bbb831f9b6dc488a64d519a4d02d3e05ab521e9d -->
# Design

Change: `project-slice-claim` · Date: 2026-11-23 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(sources: `requirements.md`, `proposal.md`, the `project-definition` delta of this change, ADR 0022
in `decisions.md`, ADRs 0015 and 0020, and the design of the archived `remote-worker`, D-1 and its
Non-Goals). Every path and line number below is read at `bbb831f`.

## Context

See `proposal.md` (Why). The code each item touches:

| Item | Where | What it does today |
|---|---|---|
| AC-1, AC-2, AC-4, AC-9 | `plugins/openspec/hooks/project-loop.mjs#openSlice` (line 437) | Checks the name and the project gate, then calls `openCheckout(cwd, id, { script: 'devkit-project', lang, env, openspec })`, with no `claim`, so the commit and the push never run |
| AC-1, AC-2, AC-3, AC-4, AC-5 | `plugins/openspec/hooks/change-loop.mjs#openCheckout` and `#openUnderLock` (lines 2003 to 2059) | Under the open lock: fetch `origin`; refuse a local taken name (`name-taken`); refuse when `refs/remotes/origin/<id>` exists, through `refuseRemote` (`claimed`, `claimed-elsewhere`, `name-taken`), **whether or not a claim is passed**; add the worktree; `openspec new change`; then, only `if (hasOrigin && claim)`, `writeClaimKeys` before `recordPin`, and `claimOnOrigin` (commit `chore(openspec): open <id>`, push `--force-with-lease=refs/heads/<id>:`); a lost race (`ClaimRace`) cleans up and refuses through `refuseRemote` |
| AC-6 | `project-loop.mjs#statusText` (line 584), `#readFacts` (line 291) | The readout: the title line `slice-title`, one line per stage, then one line after the five. `readFacts` knows the slice's folder (`located.dir`) but does not return it for an active slice |
| AC-7 | `change-loop.mjs#unfinished` (line 1582); `roadmap-loop.mjs#collectRoadmap` (line 710), `#statusJson` (line 1444); `change-loop.mjs#placeFacts` (line 1351), `#placeChange` (line 2087) | `unfinished` skips a slice folder unless `slices` is true. `collectRoadmap` reads the claims on `origin` only for the roadmap's ids. `statusJson`, `placeFacts` and `placeChange` read every branch's claim but count only claims whose branch holds `approval.md`; the `devkit-project` schema has no `approval` stage (`plugins/openspec/schemas/devkit-project/flow.json`), so a slice is never counted |
| AC-8 | `guard.mjs#sliceProblems` (line 297), `#sliceReviewStale` (line 284); `project-loop.mjs#decideSlice`, `archivedPart` (lines 216 to 256) | The contract reads the stage records, the verdict, the commits after the verdict that touch the design or ADR folders, and the net diff paths. The `open-pr` and `push` steps push the slice's branch with a plain push |
| skill | `plugins/openspec/skills/devkit/SKILL.md` line 217 | `new`: run `project-loop.mjs open <id>`; "On any exit 3, say `reply` and end the turn" |

So the refusal of AC-3 already runs for a slice today, against a branch someone pushed by hand; what is
missing is the claim that makes a slice's branch exist on `origin` from its open, without which
neither the refusal of a later open nor the race of AC-4 can happen.

Constraints:

- `guard.mjs`, `deliver-check.mjs` and `merge-setup.mjs` are downloaded by a project's
  `devkit-reviews` workflow: this design changes none of them.
- Product code is closed until the plan is approved: the ADR edits are written by tasks.
- Tests never read the repository's git history (CI checks out at depth 1).

## Goals / Non-Goals

**Goals:** one claim rule for changes and slices (ADR 0022 decision 1); `openCheckout` and the
change's open unchanged byte for byte; every existing test of the change path passes unchanged; every
new behaviour pinned by a test in `plugins/openspec/hooks/project-loop.test.mjs`.

**Non-Goals:** a slice on the `/devkit status` board or the roadmap (grill answer A, ADR 0022 decision
5); places, `--machine`, `--places`, `--remote` for a slice (ADR 0022 decision 2); a slice-specific
refusal text; claims for archive branches; continuing a slice on another machine (ADR 0020 decision
3).

## D-1 The claim at a slice's open (AC-1, AC-2, AC-4, AC-5, AC-9)

`openSlice` in `plugins/openspec/hooks/project-loop.mjs` passes the claim to the shared open path:

```js
const { worktree, base } = openCheckout(cwd, id, {
  script: SCRIPT, lang: l, env, openspec, lockSleep, beforePush,
  claim: { machine: thisMachine(), places: null },
});
```

- `thisMachine` is added to the existing import list from `./change-loop.mjs` (it is already
  exported there).
- `openSlice`'s options gain `lockSleep` and `beforePush`, passed through as they are; both default
  to `undefined`, as in `openChange`. `beforePush` is a test seam only (called after the commit,
  before the push), used by the deterministic race test of D-7. The command line is unchanged:
  `main`'s `open` branch still parses only `--lang`, so no `--machine`, `--places` or `--remote`
  exists for a slice (ADR 0022 decision 2).
- `places: null` makes `writeClaimKeys` write `x-devkit-machine: <machine>` alone, before
  `recordPin` writes the pin, so the pin stays last (AC-2), as for a change.
- `remote` is not passed (default `false`): the slice's worktree stays (AC-1).
- With no `origin` remote, `openUnderLock` skips both claim steps (`if (hasOrigin && claim)`), so a
  slice opens as before (AC-5).
- `openSlice` has no `prepare`: the open commit holds `openspec/changes/<slice>/.openspec.yaml`
  alone (a slice has no `requirements.md`; the test `project-loop start: open makes the slice's
  worktree, branch and change on the project script` in `project-loop.test.mjs` already pins a folder
  holding only that file).
- The reply on success stays `project-opened`: like the change's, it does not mention the push
  (`remote-worker` R-1).
- `change-loop.mjs` is not edited for the claim: `openCheckout`, `openUnderLock`, `writeClaimKeys`,
  `claimOnOrigin`, `refuseRemote` and `removeLocalOpen` serve the slice as they are (AC-9).

**Alternative rejected:** a claim step of its own in `project-loop.mjs` (ADR 0022, Alternatives:
a second copy that can drift from ADR 0020's). **Alternative rejected:** an optional `machine` option
on `openSlice` for tests: no test needs it (the refusal tests write their claim by hand, D-7), and an
option nothing in production passes is a seam to maintain.

## D-2 The refusal and a failed push (AC-1, AC-3, AC-4)

Nothing new: `openUnderLock` refuses a slice exactly as a change, through `refuseRemote`:

| `origin` holds the branch `<slice>` with | Key | Reply (en) |
|---|---|---|
| `openspec/changes/<slice>/` whose `.openspec.yaml` names a machine | `claimed` | `<slice> is already open on <machine>: I opened nothing here. Continue it there, or choose another name.` |
| that folder, naming no machine (or a value that is not a machine name) | `claimed-elsewhere` | `<slice> is already open on another machine: ...` |
| no such folder | `name-taken` | `A change named <slice> already exists; I will choose another name.` |

The texts say "open" and "name", not "change", except `name-taken`, which is today's reply for a
slice whose name is taken locally too; the owner's assumption keeps it (requirements, Assumptions;
Out of scope: no slice-specific text). `project-loop.mjs#failure` turns the `LoopRefusal` into exit 3
with its `reply`, before any worktree, folder or stage record exists (ADR 0022 decision 3); the spec
scenarios state that much, which the tests of D-7 check. That no phase question follows rests on the
skill's existing line ("On any exit 3, say `reply` and end the turn", `SKILL.md` line 217), which this
change does not edit and no test pins today; the spec delta does not claim it. `startProject` does not read `origin`: a slice open only on another
machine reads `new` at the start, and the following `open` is what refuses it. A lost race cleans up
(worktree, folder, prune, local branch) and refuses with the winner's machine, as for a change.

**A push that fails for another reason** (a remote that refuses the new branch: a read-only token, a
ruleset on branch names; or a remote that stops answering between the fetch and the push). The
shared code does for a slice what it does for a change: `claimOnOrigin` rethrows any push error that
`PUSH_RACE` does not match, `openUnderLock` cleans up through `removeLocalOpen` (worktree, folder,
prune, local branch) and rethrows it, and `project-loop.mjs#failure` turns it into exit 3 with the
existing reply `project-unreadable` (en: `I could not read that request. Type /devkit project and the
name of the slice to plan, or /devkit project alone to continue.`), with git's message in the JSON's
`error` field and on stderr, never in the reply. This is the slice's equivalent of the change's
`request-unreadable` for the same failure (`change-loop.mjs#failure`; `change-coordination` scenario
"A push that fails for another reason"), and it is accepted with its limits:

- The reply blames the request, not the remote. The owner sees the real cause only through the
  session, which has the JSON's `error`. A reply that names the remote would be a new text for slices
  alone (requirements, Out of scope) or a change to the change's reply too (beyond this change); it is
  a follow-up candidate for both commands at once, not part of this plan.
- What is new is narrow: a remote that cannot be reached at all already fails a slice's open today, at
  `openUnderLock`'s `fetch`, with the same `project-unreadable` reply. What this change adds is the
  remote that answers the fetch and refuses the push; such a project could open a slice before the
  release and cannot after it. The proposal states it with the BREAKING line, and R-6 below.
- Nothing is left: no worktree, folder or local branch here, and no branch on `origin` (the push did
  not land). A new test pins it (D-7).

## D-3 The machine on the slice's readout (AC-6)

- `readFacts` (`project-loop.mjs`) adds `folder: located.dir` to its `common` object, so every kind
  (`default`, `active`, `archived`) carries the slice's folder. `decideSlice` does not read it.
- `statusText`, right after `lines = [say('slice-title', { id: slice })]`, reads the folder's
  `.openspec.yaml` and appends one line when it names a machine:

  ```js
  const machine = claimMachineOf(facts.folder);
  if (machine) lines.push(say('slice-machine', { machine }));
  ```

  `claimMachineOf(dir)` is a three-line helper in `project-loop.mjs`: `parseClaim` (imported from
  `./change-loop.mjs`, already exported) over the file's text, `null` when the file is absent or
  cannot be read. It writes nothing.
- **Unterminated or odd input** (the `openspec/config.yaml` Parsers rule): the parser is
  `change-loop.mjs#parseClaim`, reused unchanged. An absent `.openspec.yaml`, an empty file, a file
  with no `x-devkit-machine` line, a value that is not a machine name (`MACHINE_NAME`), and a last
  line with no newline at its end are all read by its multiline regular expression; every case but
  a well-formed value gives no machine and so no line. A file that cannot be read (a folder of that
  name, a permission error) gives no line.
- Messages (`change-loop.mjs#MESSAGES`, beside `slice-title`):
  - en: `'slice-machine': 'Machine: {machine}'`
  - pt-BR: `'slice-machine': 'Máquina: {machine}'`

  Both render with the `SAMPLE` of `change-loop.test.mjs` (which has `machine: 'avel'`) and differ,
  so `change-loop replies: no internal term in either language` (`change-loop.test.mjs`) covers the
  key with no edit.
- The kinds: an active slice reads `openspec/changes/<slice>/`; one archived on its branch reads the
  archived folder (the archive move keeps `.openspec.yaml`); one archived on the default branch reads
  the folder `knownChange` found. The line is the same in every kind.

**Alternative rejected:** the machine at the end of the readout: the tests `project-loop status: the
line after the five ...` (`project-loop.test.mjs`) read the last line as the next step, and the machine is a fact about the
slice, not a step. **Alternative rejected:** the machine inside the title (`Slice billing (avel)`):
it changes the title line of every readout, claimed or not, which AC-6's "nothing else changes"
forbids.

## D-4 The board and the roadmap stay as they are (AC-7)

No code changes. Why a claimed slice's branch on `origin` reaches no row (Context): `unfinished`
skips slice folders; `collectRoadmap` asks `remoteClaims` only for the roadmap's ids, and a slice's
own id is not a roadmap line (its rounds add change ids); every reader that counts places counts only
claims whose branch holds `approval.md`, which a slice never has. A new test pins it (D-7), and the
`project-definition` delta adds the scenario "The board with a slice claimed on the remote" to the
unchanged rule.

A slice named like a roadmap line is a name collision the open already refuses locally once the line
is opened; it is not a case this change adds.

## D-5 The delivery is unchanged (AC-8)

- The open commit touches `openspec/changes/<slice>/.openspec.yaml` only. After `archive` the net
  diff against `origin/<default>` holds it under the archived folder, which `sliceProblems` allows
  (`${folder}/`). `sliceReviewStale` reads commits after the verdict, and the open commit is before
  it. The contract reads only the `schema:` line of `.openspec.yaml` (through `isSliceDir` and
  `changeSchemaAt`), which the claim key does not touch.
- The `open-pr` and `push` steps push the branch with a plain push. The local branch descends from
  the open commit, which is `origin`'s branch, so the push is a fast-forward. No force is needed.
- The flow checker's `open` stage of `devkit-project` (`"source": "folder"`) passes on the folder's
  presence, as before.

## D-6 Existing tests this change touches

Greps run at `bbb831f` in `plugins/openspec/hooks/*.test.mjs`: `statusText`/`['status', '` (the
readout), `['open', ` and `PL.main(['open'` (a slice's open), `slice-title`, `MESSAGES.en` (every key),
`x-devkit-machine`, `claimed`. Every test that asserts what this change moves:

| Id | Test (file) | Invariant · layer · suite | Effect | Edit |
|---|---|---|---|---|
| T-1 | `project-loop status: one line per stage with passed, not applicable, ready and blocked, and nothing after the five` (`project-loop.test.mjs`) | The readout lists its title, then one line per stage, and nothing after the five while a stage is open · the readout · project-loop | Its `loopProject` has a bare `origin`, so the slice is claimed and the readout gains the machine line at index 1 | The expected en list gains `` `Machine: ${CL.thisMachine()}` `` after `'Slice billing'`; the pt-BR check reads `pt[0]`, then asserts `pt[1]` is `` `Máquina: ${CL.thisMachine()}` ``, and the stage indices move by one (`pt[2]`, `pt[3]`, `pt[5]`, `pt[6]`, `pt[4]` matched `/^Arquitetura: pronta \(/`). The invariant comment gains "then the machine of its claim when it has one" |
| T-2 | `project-loop status: the line after the five names the ADR review, the pull request or delivered` (`project-loop.test.mjs`) | The last line is the next step · readout · project-loop | Reads `.at(-1)` only | None: passes unchanged |
| T-3 | `project-loop start: open makes the slice's worktree, branch and change on the project script` (`project-loop.test.mjs`) | The open's reply, worktree, branch, schema, the folder holding `.openspec.yaml` alone, a clean main checkout | The folder still holds one file; the main checkout stays clean | None: passes unchanged |
| T-4 | `project-loop start: open refuses a taken or invalid name and a failed open leaves nothing` (`project-loop.test.mjs`) | A taken or invalid name and a failed open leave the `state` of the main checkout unchanged | `state` includes `branch --list --all`, captured after the first open, so `remotes/origin/billing` is in both snapshots; the failing `openspec` stops before the claim | None: passes unchanged |
| T-5 | `project-loop scripted: a slice from its name to the merge` and `... a slice whose roadmap does not apply` (`project-loop.test.mjs`) | The scripted run from the name to the merge, the hook and both CI entries passing the contract | The open now pushes; step 8's `git push -q origin billing` fast-forwards from the claim (AC-8). Its proof text (written only with `DEVKIT_PROOF_OUT`) shows the machine line as the first item of step 2's `status:` | None: passes unchanged |
| T-6 | `version-pin AC-1 open: a project slice records the devkit-project flow` and `upfront AC-5 open: a devkit and a devkit-lite change opened on the tree's schemas record x-devkit-flow 2, and a project slice 1` (`version-pin.test.mjs`) | The pin lines end a slice's `.openspec.yaml` · the open · version-pin | Their projects have an `origin`, so the claim key is written; it goes before the pin | None: pass unchanged, and they are AC-2's regression guard |
| T-7 | `change-loop replies: no internal term in either language` (`change-loop.test.mjs`); `project-loop start: every new message key renders in both languages with no internal term` (`project-loop.test.mjs`) | Every key in both languages, rendered, holds no internal term and is translated; the two tables have the same keys | `slice-machine` is one more key; the second test's `NEW_KEYS` list is not edited | None: pass unchanged |
| T-8 | `remote AC-1 open: ...`, `remote AC-2 open: ...`, `remote AC-3 open: ...`, `remote AC-4 open: ...` (`change-loop.test.mjs`) | The change's claim | `change-loop.mjs`'s open path is not edited | None: pass unchanged (AC-9's guard that the shared code still serves changes) |

The claim commits inside the hook's own `git` calls, so a project-loop test needs a git identity. CI
sets a global one (`.github/workflows/ci.yml`), and `change-loop.test.mjs` sets one with `??=` on
`process.env` when it loads, before `project-loop.test.mjs` in `guard.test.mjs`; a filtered run of
`project-loop.test.mjs` alone on a machine with no identity would not. `project-loop.test.mjs` gains
the same two lines as `change-loop.test.mjs` (lines 3908 and 3909: `IDENT` and the `??=` loop) before
its `ENV` constant, so its `ENV` carries an identity in every run. This changes no assertion.

Any other existing test that fails at a gate is not in this table: the work stops for a plan revision.

## D-7 Proof

Every new test is named `slice-claim <AC-n> <area>: ...` and lives in
`plugins/openspec/hooks/project-loop.test.mjs` (run through `plugins/openspec/hooks/guard.test.mjs`).
The remote is the bare `origin` of `loopProject`; the "other machine" is a second clone of it
(`otherClone(t)`, a helper added beside `loopProject` as in `change-loop.test.mjs` line 3912: clone
`t.origin`, create `openspec/changes/archive/`). Every env blanks the `BLANKS` keys, as the file's
`ENV` does.

| AC | Test | Red on `bbb831f` |
|---|---|---|
| AC-1 | `slice-claim AC-1 open: the claim on origin holds the slice's metadata with this machine, in the open commit, and the worktree stays` — `ls-remote` gives a sha equal to the worktree's `HEAD`; its subject is `chore(openspec): open billing`; `git show <sha>:openspec/changes/billing/.openspec.yaml` matches `^x-devkit-machine: <thisMachine()>$` and not `x-devkit-places`; the worktree exists; `git status --porcelain` in it is empty | yes |
| AC-2 | `slice-claim AC-2 open: the machine line comes before the pin, which ends the file` — the line index of `x-devkit-machine` is below that of `x-devkit-version`; the file ends with `` `x-devkit-version: ${PACK_VERSION}\nx-devkit-flow: 1\n` `` (the version read from `plugins/openspec/.claude-plugin/plugin.json`) | yes |
| AC-3 | `slice-claim AC-3 open: a slice claimed on origin is refused naming its machine, and creates nothing` — the other clone pushes `billing` holding `openspec/changes/billing/.openspec.yaml` = `schema: devkit-project\nx-devkit-machine: avel\n`; `open billing` exits 3 with `render('en', 'claimed', { id: 'billing', machine: 'avel' })` (and the pt-BR reply in pt-BR); `git fetch -q origin` in the main checkout, then `state(t.main)` taken, is unchanged after the refused open; no `refs/heads/billing`, no worktree folder | no: the refusal runs today (Context) — a regression guard |
| AC-3 | `slice-claim AC-3 open: a slice branch with no machine says another machine, and one with no folder is a taken name` — the same with `schema: devkit-project\n` alone gives `claimed-elsewhere`; a branch `invoices` with no `openspec/changes/invoices/` gives `name-taken` | no: regression guard |
| AC-4 | `slice-claim AC-4 open: the clone that pushes second is refused and leaves nothing` — `PL.openSlice(t.main, 'billing', { lang: 'en', env: ENV, beforePush: () => { winner = PL.openSlice(clone, 'billing', { lang: 'en', env: ENV }); } })` throws a `LoopRefusal` whose reply is `claimed` naming `thisMachine()`; `origin`'s `billing` is the winner's `HEAD`; here no worktree, folder or local branch | yes (`beforePush` is never called today) |
| AC-4 | `slice-claim AC-4 open: two clones opening one slice at once, exactly one wins` — two child processes of `node project-loop.mjs open billing --lang en`, one per clone, started together; exit codes sort to `[0, 3]`; the loser's reply is `claimed`; `origin`'s `billing` is the winner's `HEAD`; the loser has no worktree, folder or local branch | yes (both exit 0 today) |
| AC-1 | `slice-claim AC-1 open: a push the remote refuses fails the open with the unreadable reply and leaves nothing` — `loopProject()`, then `git remote set-url --push origin <join(t.origin, 'no-such-remote.git')>` in the main checkout (a path that does not exist: the fetch URL still works, the push fails with git's "does not appear to be a git repository", which `PUSH_RACE` does not match), `git fetch -q origin`, then `state(t.main)` taken; `lp(t.main, ['open', 'billing'])` exits 3; its JSON's `reply` is `render('en', 'project-unreadable')` and its `error` is not empty; `state(t.main)` is unchanged; no `refs/heads/billing` in the main checkout; no `.claude/worktrees/billing`; `git ls-remote origin refs/heads/billing` (read from the fetch URL) is empty | yes (today no push happens and the open exits 0) |
| AC-5 | `slice-claim AC-5 open: with no origin nothing is committed or pushed and no claim key is written` — `loopProject()` then `git remote remove origin`; the worktree's `HEAD` is the main checkout's; the folder is untracked; `.openspec.yaml` has no `x-devkit-machine` | no: regression guard |
| AC-6 | `slice-claim AC-6 status: the readout names the machine of the claim after its title, in both languages` — lines 0 and 1 are `Slice billing`, `` `Machine: ${thisMachine()}` ``; pt-BR `Fatia billing`, `` `Máquina: ${thisMachine()}` ``; after `archive` and its commit the line is still there | yes |
| AC-6 | `slice-claim AC-6 status: a slice with no machine key, or one that is not a name, has no machine line` — with no `origin` the lines equal T-1's original list; with `x-devkit-machine: -bad` written by hand into the claimed slice's `.openspec.yaml` the machine line is gone and the stage lines are the same | no: regression guard (today no readout has a machine line) |
| AC-7 | `slice-claim AC-7 board: a slice claimed on origin, here or on another clone, is on no row of the status board or its JSON` — `alpha` opened here, `beta` opened on the other clone (both claimed); `RL.main(['status', '--lang', 'en', '--load-limit', '80'], { cwd: t.main, ..., gh: OFFLINE, load: () => 10 })` exits 0 and its stdout names neither; `status --json`'s `changes` names neither; `openspec/specs/project-definition/spec.md` of the repository still holds `### Requirement: A slice is not a change of the other commands` | no: regression guard |
| AC-8 | `slice-claim AC-8 delivery: the claimed slice reaches its pull request by a fast-forward push and passes the slice contract` — `wt = archivedSlice(t, 'billing', { commit: true })` (which opens through `openIn`), then `claim = ls-remote origin refs/heads/billing` (still the open commit: nothing pushed since); `git merge-base --is-ancestor <claim> HEAD` passes; `git push -q origin billing` (no force) exits 0; `prCreate(wt)` gives `[0, '']`; `GUARD.sliceProblems(wt, <archived folder>, { base: 'origin/main' })` is `[]` | yes (no claim on `origin` today) |
| AC-9 | `slice-claim AC-9 code: project-loop.mjs takes the claim from openCheckout and holds no claim step of its own` — the source of `project-loop.mjs` contains `claim: { machine: thisMachine(), places: null }` and none of `force-with-lease`, `x-devkit-machine`, `chore(openspec): open`, `writeClaimKeys`, `claimOnOrigin`. The test reads the whole source, comments included, so no comment in `project-loop.mjs` may name any of those five strings (tasks 1.3 and 1.5 say so) | yes |

Test first: the phase's test task comes first, and its run on `bbb831f` is saved as
`openspec/changes/project-slice-claim/proof/red-1.txt`; the tests marked "yes" fail there for a
missing behaviour (not a syntax error), and the regression guards pass, as the file shows.

**Real-run proof** (the evidence stage): a transcript of `node plugins/openspec/hooks/project-loop.mjs
open` and `status` run by hand in a scratch project under `TMPDIR` with a local bare `origin` and a
second clone, covering every case the plan declares: the claim with its `.openspec.yaml` and
`ls-remote`; the refusal of the second clone (`claimed`) and of a hand-pushed branch with no machine
(`claimed-elsewhere`); the two opens at once; a push refused by the remote (a push URL that does not
exist: exit 3, `project-unreadable`, nothing left); no `origin`; the readout with and without the machine
line in `en` and `pt-BR`; `roadmap-loop.mjs status` naming no slice; the push of the archived slice
as a fast-forward. Saved as `openspec/changes/project-slice-claim/proof/real-run.txt`. A real push
race against GitHub is not run (ADR 0020's live check L-1 covers the same `openCheckout` code).

## D-8 The ADRs

ADR 0022 is the decisions stage's (`decisions.md`); the `accept-decisions` step accepts it after the
owner approves the plan. Its number is the next free one on `origin/main` at the last merge before
review: when `main` took 0022 first, the release merge renumbers it and every reference below.

In the texts quoted in D-8 and D-9, `ADR 0022 (link: <path>)` stands for the Markdown link whose text
is `ADR 0022` and whose target is `<path>`, written as a link in the document (this plan spells it out
so that the plan itself holds no link relative to another folder).

- `docs/adr/0015-a-project-slice-is-a-change-delivered-in-one-pull-request.md`: a line `- Amended by
  ADR 0022 (0022-a-project-slice-is-claimed-on-github-when-it-opens.md)` right after `- Status:
  accepted`, and, as the last paragraph of `## Decision` (before `## Consequences`), `Note
  (project-slice-claim, 2026-11-23): ADR 0022 (link: 0022-a-project-slice-is-claimed-on-github-when-it-opens.md)
  makes a slice's branch public at its open: with an origin remote, the open commits the slice's
  folder with the machine's name and pushes the branch by a push that only creates it, and refuses a
  slice already open on another machine. The change and roadmap commands still never see a slice.
  The status and the decisions above stay.`
- `docs/adr/0020-a-change-can-run-on-another-machine.md`: a line `- Amended by ADR 0022
  (0022-a-project-slice-is-claimed-on-github-when-it-opens.md)` right after the existing `- Amended by
  ADR 0021 (...)` line (still within the first eight lines, which `upfront D-18 docs: ...` in
  `roadmap-loop.test.mjs` reads for the 0021 line), and a Note after the existing roadmap-sessions-upfront Note, before `##
  Consequences`: `Note (project-slice-claim, 2026-11-23): ADR 0022 (link: 0022-a-project-slice-is-claimed-on-github-when-it-opens.md)
  applies decision 1 to a slice opened by /devkit project, with the machine's name only and no
  places. The status and the decisions above stay.`
- `openspec/config.yaml`, the `ADRs:` line of `context`: `; 0022 a project slice is claimed on
  GitHub when it opens, as a change is, amends 0015 and 0020` before the closing `)`.

Neither Note changes a decision's text; `project-loop docs: the documents follow`
(`project-loop.test.mjs`) and `upfront D-18 docs: ...` (`roadmap-loop.test.mjs`) read the headers, the
headings and the 0021 Note, which stay.

## D-9 Documents and the release

- `docs/openspec-flow.md`, section `## Defining a project: /devkit project`:
  - first paragraph, after "in its own worktree and branch.": `With an origin remote, the open
    commits the slice's folder with the machine's name and pushes its branch at once, as a change's
    open does (ADR 0022 (link: adr/0022-a-project-slice-is-claimed-on-github-when-it-opens.md)): a slice
    already open on another machine is refused, naming that machine, before any phase starts.`
  - `**The slice contract.**` paragraph, last sentence: today it says "`/devkit status` shows each
    slice's readout: ...", which is false (`/devkit status` lists no slice, ADR 0015). It becomes:
    `When you ask where the slice stands, the session shows its readout: its five stages, then the
    review and the pull request, with the machine of its claim under its title; /devkit status lists
    no slice.` No other file repeats the false sentence (grep of `slice's readout` in every `*.md`
    outside `openspec/changes/archive/`).
  - The troubleshooting row for `claimed` stays: "a change folder" is also what a slice's folder is.
- `docs/coordination-design.md`, section 7, paragraph `**What exists ...**`: one sentence after the
  ADR 0015 link: `Since project-slice-claim, a slice's open claims it on origin as a change's open
  does (ADR 0022 (link: adr/0022-a-project-slice-is-claimed-on-github-when-it-opens.md)).` The test
  `project-loop docs: the documents follow` (`project-loop.test.mjs`) reads section 7 for `built in round 19`, the nine grill
  answers and the absence of `**Today.**`; the sentence touches none of them.
- `plugins/openspec/README.md`, the `hooks/project-loop.mjs` row: `open` becomes `open (which claims
  the slice on origin when there is one)`.
- `plugins/openspec/skills/devkit/SKILL.md`: unchanged (line 217 already handles every exit 3 of
  `open`).
- Release: devkit-openspec and the marketplace each take the next free minor version on
  `origin/main` at the last merge before review (at `bbb831f`: devkit-openspec `0.33.0` → `0.34.0`,
  marketplace `metadata.version` `0.37.0` → `0.38.0`), in
  `plugins/openspec/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`; `CHANGELOG.md`
  gains `## <marketplace version> — a project slice is claimed when it opens` with one
  **devkit-openspec** bullet (the claim, the refusal, the readout line, the board unchanged, the
  branch public from the open, a remote that refuses the new branch now fails the open, ADR 0022); `docs/catalog.md` is regenerated with `python3
  scripts/gen-catalog.py`. The release numbers are re-checked against `origin/main` before the push
  and before auto-merge.

## Risks / Trade-offs

- [R-1 A slice's branch is public from its open] → accepted by ADR 0022 (Negative), as for a change
  under ADR 0020; `docs/openspec-flow.md` says it (D-9).
- [R-2 A slice open only on another machine is invisible until an open of its name] → the owner's
  answer A (ADR 0022 Negative); the refusal names the machine.
- [R-3 Every `open` in `project-loop.test.mjs` now commits and pushes to a local bare remote] → one
  commit and one local push per open (tens of milliseconds); T-1 to T-6 of D-6 name every assertion
  that sees it; a test outside D-6 that fails stops for a plan revision.
- [R-4 A test runner with no git identity] → the identity lines of D-6 in `project-loop.test.mjs`;
  CI sets a global one.
- [R-5 A hostname that differs from the SSH connection name] → as ADR 0020 R-4: the readout and the
  refusal show the hostname; accepted.
- [R-6 A remote that answers the fetch but refuses the new branch now fails a slice's open, with a
  reply that blames the request] → the change's behaviour for the same failure (D-2); nothing is left
  behind, git's message is in the JSON's `error`, the proposal names it under BREAKING, and the
  CHANGELOG bullet says it (D-9); a reply naming the remote is a follow-up for both commands.

## Migration Plan

- Slices open before the release carry no `x-devkit-machine`, and their branch reaches `origin` at
  their pull request. Such a branch, once pushed, refuses an open of its name on another clone with
  `claimed-elsewhere`, as it already does today; their readout shows no machine line.
- Rollback: revert the release commit. A slice branch pushed at open stays on `origin`; it is the
  slice's own branch, used by its pull request anyway. `x-*` keys are ignored by OpenSpec and by the
  earlier pack.

## Implementation plan

Order: tests first, then `project-loop.mjs` and the message key (phase 1); then the ADR edits, the
documents, the release and the whole suite (phase 2).

**Per surface.**

- Hooks: `plugins/openspec/hooks/project-loop.mjs` (D-1, D-3), `plugins/openspec/hooks/change-loop.mjs`
  (the `slice-machine` key only, D-3).
- Tests: `plugins/openspec/hooks/project-loop.test.mjs` (D-6, D-7).
- Documents and release: D-8, D-9.
- No frontend, no CI file, no worker, no skill text.

**Files.**

- Modify: `plugins/openspec/hooks/project-loop.mjs`, `plugins/openspec/hooks/change-loop.mjs`,
  `plugins/openspec/hooks/project-loop.test.mjs`,
  `docs/adr/0015-a-project-slice-is-a-change-delivered-in-one-pull-request.md`,
  `docs/adr/0020-a-change-can-run-on-another-machine.md`, `openspec/config.yaml`,
  `docs/openspec-flow.md`, `docs/coordination-design.md`, `plugins/openspec/README.md`,
  `plugins/openspec/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `CHANGELOG.md`,
  `docs/catalog.md`.
- Create: `openspec/changes/project-slice-claim/proof/red-1.txt`,
  `openspec/changes/project-slice-claim/proof/real-run.txt` (evidence stage).
- Delete: none.

**Estimate:** optimistic 4 h · likely 6 h · pessimistic 10 h (the pessimistic case is a whole-suite
failure outside D-6 and the plan revision it needs, plus a release merge if `main` moves).

| Component | Hours | Type | Risk |
|---|---|---|---|
| D-7 the new tests and the red run (phase 1 test task) | 1.5 | Testing | MEDIUM |
| D-1 `openSlice` passes the claim and the seams | 0.5 | Core | LOW |
| D-3 `folder` in the facts, `claimMachineOf`, the readout line, the two messages | 0.5 | Core | LOW |
| D-6 T-1 and the identity lines | 0.5 | Testing | LOW |
| Phase 1 gate | 0.5 | Testing | LOW |
| D-8 the ADR lines and Notes, the config line | 0.5 | Documentation | LOW |
| D-9 the documents and the release | 0.5 | Documentation | LOW |
| Whole suite (13 to 21 minutes, background), `claude plugin validate .`, catalog | 1 | Testing | MEDIUM |

**Risks** (probability × impact):

- An existing test beyond D-6 sees the push at open (MEDIUM × MEDIUM) → phase 1's gate runs every
  `project-loop` test group that opens a slice and the two `version-pin` slice tests; the whole suite
  runs at gate 2.6; a failure outside D-6 stops for a plan revision.
- `main` takes the release numbers or ADR 0022 first (MEDIUM × LOW) → the release merge renumbers
  (D-8, D-9); the numbers are re-checked before the push and before auto-merge.
- A phase gate read as red while still running (MEDIUM × MEDIUM) → every `node --test` gate runs as a
  background command of the tool and is judged by its exit code.
- The two-child-process race test flakes on a loaded machine (LOW × MEDIUM) → the open lock is per
  clone and the push decides; the test asserts only the sorted exit codes and `origin`'s sha, as
  `remote AC-3 open: two clones opening one id at once, exactly one wins` does in
  `change-loop.test.mjs`, which has run green since `remote-worker`.

**Assumptions** (where the plan breaks if reality differs):

- `openUnderLock` refuses on `refs/remotes/origin/<id>` whatever the claim (source:
  `plugins/openspec/hooks/change-loop.mjs` line 2018 at `bbb831f`).
- The `devkit-project` schema has no `approval` artifact, so no slice is counted as placed (source:
  `plugins/openspec/schemas/devkit-project/flow.json`, stages `open` to `delivery`).
- `parseClaim` and `thisMachine` stay exported from `change-loop.mjs` (source: lines 1811 and 1817).
- The skill handles any exit 3 of `open` before the loop (source:
  `plugins/openspec/skills/devkit/SKILL.md` line 217).

**Dependencies.** `remote-worker` (archived 2026-11-23: the claim in `openCheckout`, ADR 0020);
`change-version-pin` (archived: `recordPin` after the claim keys); `project-phases` (archived:
`project-loop.mjs`, ADR 0015). The OpenSpec CLI 2.x on `PATH` for the suite. The owner's acceptance
of ADR 0022 with the plan.

## Decisions cited

- ADR 0015: decision 1 (a slice is a change on `devkit-project` in its own worktree and branch),
  amended by ADR 0022 for the branch's publicity; Consequences ("the change and roadmap commands never
  see a slice"), kept (D-4).
- ADR 0020: decision 1 (the claim at open, the create-only push, the refusal), applied to slices by
  ADR 0022; decision 3 (a change stays on its machine), the reason a slice is not continued
  elsewhere; its rejected alternatives (a draft pull request, a `refs/devkit/claims/` ref) are not
  taken up.
- ADR 0022 (proposed, `decisions.md`): decisions 1 to 6, each mapped above (1: D-1; 2: D-1; 3: D-2;
  4: D-1; 5: D-3, D-4, D-5; 6: no other change).

## Open Questions

None that changes the specs, the approach or the tasks. The owner confirms ADR 0022 with the plan.
