<!-- devkit-stage requirements result=passed attempt=1 commit=none -->
# Requirements

## Request

> the delivery loop fetches origin/<base> before it judges a pull request's conflict or decides update-branch, so a step never says the base merges cleanly from a stale copy (review-writer-prompt retro, item 3)
>
> Asked by the owner on 2026-11-23 among the changes that cut the slowness of a busy main ("nao e possivel demorar tanto"); sibling changes in flight: stale-only-on-own-files and delivery-merge-hold.

## Classification

domain=process type=feature flags=[contract] (confirmed by the owner): the rule that `conduct-check` and `deliver-check` are pure readers that never fetch (`plugins/openspec/hooks/conduct-check.mjs` header, `docs/openspec-flow.md` lines 252 and 486) is a contract the panel and the CompozyOS loop rely on; the change keeps it and moves the fetch to the loop that drives a change.

## Assumptions

<!-- Each confirmed by the owner. Literal paths, fields, names. -->
- Where the fetch lives (decided in the grill, question 1, by the coordinating session under the owner's delegation): in `plugins/openspec/hooks/change-loop.mjs#nextAction`, right before it calls `deliveryRow` in the `inDelivery(...)` branch. `conduct-check.mjs` and `deliver-check.mjs` stay pure readers and the documented "never fetches" rule holds.
- Who fetches: `nextAction` gains an option `fetchBase` (default `false`, like `budget`). The callers that drive a change pass `true`: `runNext` and `runWait` of `change-loop.mjs`, and the `next` and `wait` calls of `plugins/openspec/hooks/roadmap-loop.mjs` (`waitCmd`; `collectRoadmap` when it serves `next`). `stateEntries`, `stopDecision`, `statusJson` and `draftCmd` keep reading the local copy and never fetch. AMBIGUOUS: (a) `collectRoadmap` serves both `next` and `status`, so it takes `fetchBase` from its caller | (b) it always fetches; the planner resolves by reading its callers.
- What is run: `git -C <root> fetch --no-tags --quiet origin <base>`, where `<base>` is `defaultBase(root)`, with a timeout of `LS_REMOTE_TIMEOUT_MS` (15 s). It writes only `refs/remotes/origin/<base>`: no tag, no other branch, no file of the working tree.
- Every delivery step is covered, not only `update-branch`: the fetch comes before the `deliveryRow` call, so `staleness()`, the `resolve-release-conflict` and `update-branch` overrides of `conduct-check.mjs` (`releaseConflict`, line 395 `merges cleanly`) and the archive PR rows read the same fresh `origin/<base>`.
- One fetch per process and base: `nextAction` remembers, in module memory, the (git common dir, base) pairs it already fetched in this process, so a roadmap `next` over several changes in delivery fetches once. A `wait` fetches again at each poll (60 s by default).
- A failed fetch never blocks (decided by the coordinating session): no network, a refused remote, a ref lock held by another session or the 15 s timeout leave `origin/<base>` as it was and the action is produced as today. The action gains `baseFetch: { ok: false, base, error }` (`error` is git's first error line) and its `reply` gains one line saying the base was judged from the local copy; a successful fetch gives `baseFetch: { ok: true, base }` and no extra line.
- Consequence accepted: with a fresh base the loop sees today the moves of `main` it used to see only after a manual fetch, so `deliver-check`'s staleness and the `update-branch` and `resolve-release-conflict` steps appear as soon as `main` moves. How little a move costs is the job of `stale-only-on-own-files`, not of this change.
- Not touched: `plugins/openspec/hooks/release-merge.mjs` (the step that merges `origin/<base>` still reads the local ref; the `next` that handed it the step fetched seconds before), the `archive` and `tag-release` steps (they already run `git fetch origin <next.base>`), `origin/<test branch>` in `two-prs` mode (`merge-into-support` fetches it), the panel and the CompozyOS loop (they read `conduct-check` and keep reading the local copy).
- Docs and release: `docs/openspec-flow.md` (line 252 on `conduct-check`, line 486 on the default branch) and the `devkit-openspec` rows of `plugins/openspec/skills/ship-change/SKILL.md` say that the loop fetches before it asks the checkers and that the checkers do not; `devkit-openspec` is bumped as `CONTRIBUTING.md` says and meets the sibling changes at the release rebase.
- Scope against the siblings: `stale-only-on-own-files` (what a base move invalidates), `delivery-merge-hold` (which merge waits) and `delivery-train` (batching) are not done here; this change only makes sure the base the others judge from is fresh.

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
- AC-1 `next-fetches-before-judging` — in a fixture where the remote's `main` holds a commit that conflicts with the change in a release file and the local `refs/remotes/origin/main` is one commit behind, `change-loop.mjs next` for a change in delivery moves `refs/remotes/origin/main` to the remote's sha and returns `resolve-release-conflict`, not `update-branch` with "merges cleanly"; the same fixture without the fetch (today) returns `update-branch`.
- AC-2 `wait-and-roadmap-fetch` — `change-loop.mjs wait` (each poll), `roadmap-loop.mjs next` and `roadmap-loop.mjs wait` fetch the base before judging; `stateEntries`, `stopDecision` and `status` do not (the ref stays at the stale sha).
- AC-3 `checkers-stay-pure` — running `conduct-check.mjs` and `deliver-check.mjs` on the stale fixture leaves `refs/remotes/origin/main` unchanged and their headers still say they never fetch; a test fails when either runs `git fetch`.
- AC-4 `fetch-failure-does-not-block` — with the remote unreachable (its URL removed) or the fetch past the timeout, `next` returns the same action as today from the local copy, with `baseFetch.ok` false, git's first error line in `baseFetch.error`, and a `reply` line saying the base was judged from the local copy; the exit code is the action's own.
- AC-5 `fetch-writes-only-the-base` — after a successful fetch only `refs/remotes/origin/<base>` differs (no new tag, no other remote branch moved, the working tree and the index untouched).
- AC-6 `one-fetch-per-process` — a roadmap `next` over three changes in delivery runs one `git fetch` for the base, counted through a fake `git`.
- AC-7 `docs-state-the-rule` — `docs/openspec-flow.md` states that the loop fetches the base before it asks the checkers and that `conduct-check` and `deliver-check` never fetch; `python3 scripts/check.py` passes.

## Out of scope

- Making `conduct-check.mjs` or `deliver-check.mjs` fetch.
- Fetching in `release-merge.mjs`, in the panel or in the CompozyOS loop; fetching `origin/<test branch>` of `two-prs`.
- What a base move invalidates (`stale-only-on-own-files`), holding another change's merge (`delivery-merge-hold`) and batching deliveries (`delivery-train`).
- A project setting to turn the fetch off or to change its timeout.

## Questions asked

1. [scope] Where does the base fetch live? → in `change-loop.mjs`, before the checkers are called on each delivery `next`; the checkers stay pure readers (answered by the coordinating session under the owner's delegation).
2. [confirmation] Does the owner confirm the requirements, the classification and the accepted consequence of a fresh base? → "Confirmo" (the owner's own message, 2026-11-23).

## Escalations

- None.
