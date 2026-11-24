<!-- devkit-stage proposal result=passed attempt=1 commit=98145b018d4b38a066289b69ed972c09b2497e60 -->
# Proposal

Change: `fresh-base-check` · Date: 2026-11-23 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(source: the owner-confirmed `requirements.md`; review-writer-prompt retro, item 3; asked among the
changes that cut the slowness of a busy `main`).

## Why

From the implementation on, `change-loop.mjs#nextAction` asks `deliver-check` and `conduct-check`'s
`deliveryRow` what the delivery does next, and both read `origin/<base>` as the local clone last saw
it. Neither fetches, by contract (`conduct-check.mjs` header; `docs/openspec-flow.md`, the
`conduct-check` section and "The default branch is read from GitHub"). Nothing else in the loop
fetches either. When `main` moved on GitHub, `git merge-tree` against the stale copy says the base
"merges cleanly". The loop then hands `update-branch` where the real answer is
`resolve-release-conflict`, or it judges staleness and the archive file check from a base that no
longer exists. Each wrong step costs a round trip on a busy `main`.

## What Changes

- **The loop fetches the base before it judges a delivery step.** `nextAction` gains the option
  `fetchBase` (off by default, like `budget`). When it is on and the change is in its delivery part,
  the loop fetches `origin/<base>` once, before it reads the delivery state. So `staleness()`, the
  release-conflict override (`update-branch`, `resolve-release-conflict`) and the archive rows all
  read the same fresh base. The fetch writes `refs/remotes/origin/<base>` and nothing else: no tag,
  no other branch, no `FETCH_HEAD`, no file of the working tree.
- **Who fetches.** `change-loop.mjs next` and `wait` (at every poll), and `roadmap-loop.mjs run`,
  `next` and `wait`. `change-loop.mjs state`, the stop lock, `roadmap-loop.mjs status`,
  `status --json`, `draft` and the roadmap stop lock keep reading the local copy and never fetch.
- **One fetch per base per call.** A roadmap `next` over several changes in delivery fetches each
  base once. A `wait` fetches again at each poll.
- **A failed fetch never blocks.** No network, a refused remote, a ref lock held by another session
  or the 15-second timeout leave `origin/<base>` as it was, and the action is decided as today. The
  action carries `baseFetch: { ok: false, base, error }` (git's first error line), and its `reply`
  gains one line, in the person's language, saying the step was judged from this machine's copy. A
  successful fetch gives `baseFetch: { ok: true, base }` and no extra line. A repository with no
  `origin` remote fetches nothing and carries no `baseFetch`, as today.
- **The checkers stay pure readers.** `conduct-check.mjs` and `deliver-check.mjs` never fetch. A new
  test fails if either runs `git fetch`. `deliver-check.mjs`'s header comment now says so in words,
  as `conduct-check.mjs`'s already does.
- **Docs and release.** `docs/openspec-flow.md` (the loop, "Waiting on GitHub", the roadmap
  coordinator, the `conduct-check` section and "The default branch is read from GitHub") states that
  the loop fetches the base before it asks the checkers and that the checkers never fetch. The
  `update-branch` row of `plugins/openspec/skills/ship-change/SKILL.md` says the same. The
  `devkit` skill keeps the "judged from this machine's copy" line for the message that ends the turn.
  devkit-openspec gets a minor release.

Choices this plan makes on top of `requirements.md`, for the owner to see at approval:

1. Ambiguity (a) of the requirements is resolved as (a): `collectRoadmap` takes `fetchBase` from its
  caller. `run` passes it too, as well as `next`. `run` hands the same delivery steps `next` does,
  and a stale first decision would bring the bug back. `status` and the stop lock do not pass it.
2. "One fetch per process" is kept as one fetch per command call: each call (and each poll of a
  `wait`) builds its own record of the bases it fetched. Production runs one command per process, so
  the effect is the same. A `wait` still fetches at every poll, and tests that call the command
  twice in one process stay independent.
3. The fetch names its refspec and writes no `FETCH_HEAD`:
  `git -C <root> fetch --no-tags --quiet --no-write-fetch-head origin +refs/heads/<base>:refs/remotes/origin/<base>`,
  run with no prompt for credentials. The short form `fetch origin <base>` updates the ref only when
  `remote.origin.fetch` maps it, and it writes `FETCH_HEAD`. A git older than 2.29 refuses
  `--no-write-fetch-head`. That is a failed fetch, so it does not block.
4. The fetch runs before the delivery state is read, not only before `deliveryRow`, because
  `collectState` also reads `origin/<base>` (the archive file check, the two-pull-request facts).

Non-goals (from `requirements.md`): making `conduct-check.mjs` or `deliver-check.mjs` fetch; fetching
in `release-merge.mjs`, the panel, the CompozyOS loop or `project-loop.mjs`; fetching
`origin/<test branch>` in `two-prs`; what a base move invalidates (`stale-only-on-own-files`),
holding another change's merge (`delivery-merge-hold`), batching deliveries (`delivery-train`); a
setting to turn the fetch off or change its timeout.

## Acceptance criteria

Copied from `requirements.md`, with their ids.

- AC-1 `next-fetches-before-judging` — in a fixture where the remote's `main` holds a commit that conflicts with the change in a release file and the local `refs/remotes/origin/main` is one commit behind, `change-loop.mjs next` for a change in delivery moves `refs/remotes/origin/main` to the remote's sha and returns `resolve-release-conflict`, not `update-branch` with "merges cleanly"; the same fixture without the fetch (today) returns `update-branch`.
- AC-2 `wait-and-roadmap-fetch` — `change-loop.mjs wait` (each poll), `roadmap-loop.mjs next` and `roadmap-loop.mjs wait` fetch the base before judging; `stateEntries`, `stopDecision` and `status` do not (the ref stays at the stale sha).
- AC-3 `checkers-stay-pure` — running `conduct-check.mjs` and `deliver-check.mjs` on the stale fixture leaves `refs/remotes/origin/main` unchanged and their headers still say they never fetch; a test fails when either runs `git fetch`.
- AC-4 `fetch-failure-does-not-block` — with the remote unreachable (its URL removed) or the fetch past the timeout, `next` returns the same action as today from the local copy, with `baseFetch.ok` false, git's first error line in `baseFetch.error`, and a `reply` line saying the base was judged from the local copy; the exit code is the action's own.
- AC-5 `fetch-writes-only-the-base` — after a successful fetch only `refs/remotes/origin/<base>` differs (no new tag, no other remote branch moved, the working tree and the index untouched).
- AC-6 `one-fetch-per-process` — a roadmap `next` over three changes in delivery runs one `git fetch` for the base, counted through a fake `git`.
- AC-7 `docs-state-the-rule` — `docs/openspec-flow.md` states that the loop fetches the base before it asks the checkers and that `conduct-check` and `deliver-check` never fetch; `python3 scripts/check.py` passes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `change-coordination`: ADDED. The loop fetches the base before it judges a delivery step. A
  failed fetch does not stop it and is said in one line. The wait fetches at each poll. One fetch per
  base per call. The state command and the stop lock never fetch.
- `roadmap-coordination`: ADDED. The roadmap's `run`, `next` and `wait` fetch the base before they
  judge, once per base per call. `status` and the stop lock never do.
- `change-delivery`: ADDED. The delivery checkers never fetch.

## Impact

- devkit-openspec (minor; the number is the next free one on `origin/main` at the last merge before
  review): `hooks/change-loop.mjs` (the fetch helper, `nextAction`, `runNext`, `runWait`, the wait's
  decision key, one message in each language), `hooks/roadmap-loop.mjs` (`collectRoadmap`,
  `runCmd`, `nextCmd`, `waitCmd`) and the header comment of `hooks/deliver-check.mjs`. Tests in
  `change-loop.test.mjs` and `roadmap-loop.test.mjs`. Two test helpers are exported:
  `deliveredChange` from `change-loop.test.mjs`, and `MERGE_CONFIG`, `MERGE_FILES` and `presetMerge`
  from `conduct-check.test.mjs`. No change to `conduct-check.mjs` code, `release-merge.mjs`,
  `project-loop.mjs`, `guard.mjs`, `merge-setup.mjs`, the schemas or the panel.
- JSON contract: an action of a change in delivery gains the optional field `baseFetch`; its `reply`
  may gain one last line. Only `plugins/openspec/` reads them (the `devkit` skill says the reply).
- The `devkit-reviews` check runs `deliver-check.mjs --ci`, which this change does not touch beyond
  a comment line; projects' CI is unaffected.
- Docs: `docs/openspec-flow.md` (the paragraphs above and the CI pins), `plugins/openspec/skills/devkit/SKILL.md`,
  `plugins/openspec/skills/ship-change/SKILL.md`, `CHANGELOG.md`, `.claude-plugin/marketplace.json`,
  `plugins/openspec/.claude-plugin/plugin.json`, `docs/catalog.md` (regenerated).

**Exit criteria.** The gates of `tasks.md`, the last being the whole hook suite
(`node --test plugins/openspec/hooks/guard.test.mjs`), `python3 scripts/check.py`,
`python3 scripts/gen-catalog.py --check` and `claude plugin validate .`; and
`openspec validate fresh-base-check --strict`.

**Dependencies.** `release-merge-conflict` (archived: the `resolve-release-conflict` and
`update-branch` override this change feeds). `remote-worker` (archived; devkit-openspec 0.32.0, the
version on `origin/main` this plan read, and `LS_REMOTE_TIMEOUT_MS`). Siblings in flight that also
bump devkit-openspec, `stale-only-on-own-files` and `delivery-merge-hold`, meet this bump at the
release merge (`CONTRIBUTING.md`, step 5).

**Decisions cited.** `decisions.md` (no record needed). ADR 0010 decision 3: a loop over files that
ends in one of four states. A failed fetch adds no state; the action stays the one the files give.
ADR 0017 decision 1: the state is derived by the code that decides the next action and stored
nowhere. `state` reads the local copy, and `next` refreshes it for later reads. ADR 0002: merge mode
still needs the checks green; a fresh base only changes which step comes first.

**Open decisions inherited.** None. No point of `docs/coordination-design.md` ("Open points") is
touched.
