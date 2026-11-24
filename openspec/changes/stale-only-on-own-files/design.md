<!-- devkit-stage design result=passed attempt=1 commit=5d255b1e77f67a5628a3f1f7dabbcfe8f0147634 -->
# Design

Change: `stale-only-on-own-files` · Date: 2026-11-23 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(sources: `proposal.md`, `requirements.md`, `decisions.md`, ADR 0021). Plan base: `5d255b1`.

## Context

See `proposal.md` (Why). The current state the approach builds on:

- `staleness(root, recorded, facts, { allowed })` in `plugins/openspec/hooks/deliver-check.mjs`
  (lines 283-305) is the one staleness rule. It walks `git rev-list --parents <recorded>..<head>`
  and, for each commit, takes `touchedPaths` (a merge against its first parent, any other commit
  with `diff-tree -m --root`) and returns `<short> is behind <c short>, which touches <path>` for the
  first path that `allowed` refuses. `allowed` defaults to `isOpenspec`; `verdictAllowed(id, name,
  verdict)` gives the test-spared and the rejected-verdict variants.
- Its callers: `tasksItem` and `acceptanceItem` (the evidence), `readReviews` (each reviewer, which
  `reviewsItem`, `collectState` and `flow-check`'s `staleReviewers` read), and `flow-check`'s
  `facts.staleness` for the header commit of a code-bound stage (`unit-tests`, `e2e-tests`,
  `evidence`, `review` in `plugins/openspec/schemas/devkit/flow.json` and `devkit-lite/flow.json`).
  `change-loop.mjs` and `conduct-check.mjs` reach it only through `collectState` and `collectFlow`.
- `gitFacts(root)` gives `{ head, dirty }`; it is computed once per run and passed down. It is called
  without arguments as a default parameter in every item function and by many tests.
- `deliver-check --ci` (`runCi`, `checkOne`, `runSeveral`) uses the same items with
  `gitFacts(root)`; `ciPreflight` already refuses a shallow clone, and `touchedChanges` already
  reads `origin/${GITHUB_BASE_REF}`. The repository's `.github/workflows/devkit-reviews.yml` checks
  out with `fetch-depth: 0`, which brings `refs/remotes/origin/<base>`.
- `RELEASE_FILE` (line 1124) is the exported release-file pattern: plugin manifests,
  `.claude-plugin/marketplace.json`, `CHANGELOG.md`, `docs/catalog.md` (Q2).
- No existing test of `staleness` has an `origin/<base>` ref except the `--ci` tests and the archive
  tests that set `refs/remotes/origin/main` to `HEAD`, and the `conduct-check` fixtures
  (`roundRepo`), whose `origin` is a real bare repository.

## Goals / Non-Goals

**Goals:**
- One rule, in `staleness`, that exempts a merge of the base and the base commits it brings in
  unless they touch the change's own files (ADR 0021 decisions 1, 2, 5).
- Fail safe by construction: every case the rule cannot classify is judged as today (ADR 0021
  decision 4, AC-7).
- No call site that does not know the change and its base gets the exemption: `gitFacts(root)` with
  no base keeps today's verdict, so every existing direct test of `staleness` is unchanged.

**Non-Goals:**
- Fetching `origin/<base>` (`fresh-base-check`): the checkers stay read-only and never fetch.
- Exempting a rejected verdict (D-5).
- Changing `release-merge.mjs`, `guard.mjs`'s own ADR-review staleness (`guard.mjs` line 277, the
  slice contract) or the post-merge walk.

## Decisions

### D-1 The base and its tip

New export `stalenessBase(root, env, configuredBase)` in `deliver-check.mjs` returns a branch name or
`null`, first match wins:

1. `env.GITHUB_BASE_REF` when set (the pull request's base in CI);
2. `configuredBase` (`deliveryConfig(...).base`, set only in `two-prs`, ADR 0018);
3. the branch `refs/remotes/origin/HEAD` points at (`git symbolic-ref --short -q`, `origin/` cut);
4. the first of `main`, `master` whose `refs/remotes/origin/<name>` resolves;
5. `null`.

The tip is `git rev-parse --verify --quiet refs/remotes/origin/<base>^{commit}`. Using only the
local remote-tracking ref keeps the checkers read-only and offline; a stale ref makes fewer merges
exempt, never more (D-3). Alternative rejected: reading the default branch from GitHub (`gh api`),
as the archive steps do: a `gh` call in every staleness check, and CI already has the name.

### D-2 The change's own files

New export `ownFiles(root, id, facts)` returns `null` or `{ base, tip, isOwn(path) }`:

- `null` when `facts.base` is `null`, the tip does not resolve, `facts.head` is `null`, or
  `git merge-base --is-ancestor <head> <tip>` succeeds (the head is already in the base: the change
  merged, or a fixture with `origin/main` at `HEAD`; spec "The head is already in the base").
- Otherwise the own set is `git diff --name-only -z --no-renames <tip>...<head>` (the paths that
  differ between the merge base and the head; `--no-renames` lists both sides of a move), minus every
  path `RELEASE_FILE` matches. `isOwn(p)` is true for a path in that set or a path starting with
  `openspec/changes/<id>/`. A failing `git diff` (no merge base: unrelated histories) gives `null`.
- Memoized per `id` in a `Map` on `facts` (`facts.ownCache`), so the six reviewers and the evidence
  of one run cost one `git diff`.

This is Q1 as written: the net diff, so a file the branch changed and restored is not own (spec
scenario "A file the branch changed then restored"). Alternatives rejected: the union of every path
the branch's commits touched (no requirement asks for it; Q1 fixed the net diff); a dependency
closure (rejected in Q1, ADR 0021 alternatives).

### D-3 The staleness walk with the exemption

`staleness(root, recorded, facts, { allowed = isOpenspec, own = null })` keeps every check it has
today, in the same order (no `Commit:`, uncommitted marker, dirty tree, no head, unresolved sha, not
an ancestor). When `own` is `null` the walk is exactly today's. When it is set, two sets are read
once per recorded sha (memoized on `facts` by `<full sha>`):

- `line`: `git rev-list --first-parent <full>..<head>`, the commits on the branch's own line;
- `offBase`: `git rev-list <full>..<head> ^<tip>`, the commits in the range that `origin/<base>`
  does not contain.

For each commit `c` of the existing `rev-list --parents` walk:

- **a commit of the base brought in**: `c` is not in `line` and not in `offBase`;
- **a merge of the base**: `c` is in `line`, has two or more parents, its first parent is not an
  ancestor of the tip and every other parent is (`git merge-base --is-ancestor`, only for merges on
  the line, which are few);
- for those two kinds the offending path is the first path of `touchedPaths` that `allowed` refuses
  **and** `own.isOwn` accepts; for every other commit it is the first path `allowed` refuses, as
  today.

The reason keeps today's form, `<recorded short> is behind <c short>, which touches <path>`, so it
names the merge (or the base commit) and the own path (AC-2, AC-3), and every message a test or a
spec pins is unchanged. A base merged in that the local tip does not contain yet has its merge's
second parent outside the tip, so the merge is judged as today, and its commits are in `offBase`, so
they are too (spec "A base the checkout has not fetched"); a merge of any other branch fails the
parent test (spec "A merge of another branch"). The scenarios of the existing requirement (the
resolving edit, the move, the root commit of an unrelated history, a merge made on the base) all
fall in "judged as today" or name an own path.

Alternative rejected: exempting only the merge commit and still judging every base commit it brings
in by `allowed` (today's rule for brought-in commits): a busy `main` brings product commits in every
merge, so nothing would be saved (`change-delivery` scenario "A product commit the merge brings in").

### D-4 Where the rule applies

- `gitFacts(root, { base = null } = {})` returns `{ head, dirty, base }`. Every existing call without
  a base keeps `base: null`, so `ownFiles` is `null` and the verdict is today's (AC-7 by
  construction; the existing direct tests stay as they are).
- `tasksItem` and `acceptanceItem` pass `own: ownFiles(root, id, facts)` for the evidence.
- `readReviews` passes `own: approved(verdict) ? ownFiles(root, id, facts) : null` (D-5).
- `collectState` computes `deliveryConfig` first, then `facts = gitFacts(root, { base:
  stalenessBase(root, env, configuredBase) })` (today `gitFacts` is its first line; the order of the
  two has no other effect: `deliveryConfig` reads only the config file).
- `runCi` computes `facts = gitFacts(root, { base: stalenessBase(root, env, null) })`;
  `checkOne`, `runSeveral` and `testBranchPr` already take `facts`. The `guard.mjs ci` entry calls
  `ciMain`, so both entries agree (AC-8).
- `flow-check.mjs` `collectFlow`: `gf = gitFacts(root, { base: stalenessBase(root, env,
  config.base) })`; `facts.staleness` passes `{ own: ownFiles(root, id, gf) }`; `staleReviewers`
  already calls `readReviews(root, id, gf)`. The post-merge walk is unchanged.
- `conduct-check.mjs` calls `gitFacts(worktree).dirty` only: unchanged.

### D-5 A rejected verdict gets no exemption

A verdict that is neither approved nor declined keeps `reviewRecord(id)` as its allowance and gets
`own: null`: any merge of the base stales it, as today (AC-6; `verdict-files` delta). ADR 0021
decision 3 keeps the per-reviewer allowances "unchanged"; the rejected rule exists so a fix gets the
next round, and a rejected review runs again anyway, so the exemption would save nothing it was
asked to save. Known limitation kept from today: a base merge during `fix-review` re-runs the
rejecting reviewer before the fix (R-4).

### D-6 The documents

Every sentence that says any base merge outside `openspec/` stales the records is corrected in the
same commit as the rule's documentation (rule of `openspec/config.yaml`: a task that corrects a claim
names every file that repeats it):

| File | Where | Change |
|---|---|---|
| `docs/openspec-flow.md` | "The `Commit:` staleness rule" paragraph | Add the own-files rule: the own files (Q1), release files never own, the merge of the base and the base commits it brings in exempt unless they touch one, rejected verdicts excluded, fails safe (no `origin/<base>`, an unfetched base, the head in the base), the base named by D-1, and the pull request's required `check` CI as the backstop for a base change the change depends on (ADR 0021 decision 6, AC-9) |
| `docs/openspec-flow.md` | "The merge is committed, never pushed." | The renumbered release files are never own files: the release merge stales the records only when it brings an own file; ADR 0021 narrows ADR 0002's cost |
| `docs/openspec-flow.md` | paragraph after "Release-file conflict" ("While a change is in delivery, every merge of the base that touches a file outside `openspec/`...") | "...every merge of the base that brings one of its own files..." |
| `docs/openspec-flow.md` | "Order of the delivery steps." | "only a later commit outside `openspec/` stales both" gains "(a merge of the base only when it brings one of the change's own files)" |
| `docs/openspec-flow.md` | `update-branch` row of the `ship-change` table | The update stales the older records only when it brings an own file |
| `docs/openspec-flow.md` | "## CI", the `devkit-reviews` paragraph | The check applies the own-files rule with `GITHUB_BASE_REF`; `fetch-depth: 0` brings `origin/<base>` |
| `CONTRIBUTING.md` | line 17 ("every sibling merged meanwhile costs one more merge, evidence run and review") and step 5 ("costs one suite and one re-review") | The cost holds only when the sibling brought one of the change's own files |
| `plugins/openspec/skills/devkit/SKILL.md` | `resolve-release-conflict` bullet | "then the loop hands `verify` and `review` for what the merge made stale, and a plain `push`..." (test T-3) |
| `plugins/core/skills/review-change/SKILL.md` | "Stale means..." bullet | Add: a merge of the base that brings none of the change's own files leaves an approved or declined review current |
| `docs/adr/0002-merge-without-the-owner-opt-in.md` | header and Context | `- Amended by ADR 0021 (0021-a-base-merge-stales-only-on-the-changes-own-files.md)` and a dated Note: the accepted cost narrows to a base update that brings the change's own files |
| `docs/adr/0021-...md` | header | `Status: accepted` and the `Accepted by:` line after the owner approves the plan, as ADR 0020 does |
| `openspec/config.yaml` | `ADRs:` line | Append `0021 a merge of the base stales the evidence and reviews only when it brings the change's own files, amends 0002` |

### D-7 Existing tests this change touches

Grep done at `5d255b1` for the reason text (`is behind`, `which touches`), the doc and skill
sentences above, and the fixtures with an `origin` ref.

| Id | Test (file) | Invariant, layer, suite | What happens |
|---|---|---|---|
| T-1 | `staleness: *`, `merge-staleness 1` to `8`, `item 1/2/4: *`, `review-openspec-fix 1` to `18`, `review-writer-prompt AC-8 *` (`deliver-check.test.mjs`) | the rule without a base; `deliver-check` unit layer; `guard.test.mjs` | Unchanged: they call `gitFacts(root)` with no base, and the fixture `gitRepo` has no `origin` |
| T-2 | `merge-staleness 9`, `10`, `flow-check stages: *`, `review-openspec-fix 19`, `20` (`flow-check.test.mjs`) | the stage readout; `flow-check` layer | Unchanged: their repositories have no `origin`, so `stalenessBase` is `null` |
| T-3 | `release-merge-conflict 16` (`change-loop.test.mjs`) | the `devkit` skill describes the release step as a merge and a plain push; docs layer | The pinned sentence changes to the D-6 wording; the test's string changes with it, its other assertions stay |
| T-4 | `release-merge-conflict 8` (`conduct-check.test.mjs`) | after a release merge that is not pushed, the loop runs what the merge made stale, then hands a plain `git push`; loop layer (`conduct-check` over `collectState`); `guard.test.mjs` | Today it expects `verify` first. The fixture's merge brings only `CHANGELOG.md` (a release file), so under AC-4 the records stay current and the step is `push` at once. Split: (a) the release-only merge hands `push` with `['git', 'push', 'origin', 'b']` and no `verify`; (b) a variant whose origin also changes a file the branch changed hands `verify`, then after `reviewedAt` the `push` |
| T-5 | `release-merge-conflict 9`, `11`, `12`, `13` (`conduct-check.test.mjs`) | the update-branch, foreign head, archive and auto-merge steps | Expected unchanged (records written at the merge head, or the archive walk); run by name at gate 2.6 |
| T-6 | `--ci *` tests and the archive tests that set `refs/remotes/origin/main` to `HEAD` (`deliver-check.test.mjs`) | the check's selection and archive rules | Unchanged: the head is in the tip, so `ownFiles` is `null` |
| T-7 | `delivery-models P5`, `P7 T1`, `AC-5` (`delivery-models.test.mjs`) | the foreign-commit rule | Unchanged: `prove()` records at the merge head |

Any other existing test that fails at a gate stops the work for a plan revision.

### D-8 New tests and proof

Every new test is named `own-files <AC-n> <area>: ...`. The fixture `ownRepo()` in
`deliver-check.test.mjs` builds, with real `git`: `main` with `src/a.ts`, `src/a.test.ts`,
`src/other.ts`, `CHANGELOG.md` and `openspec/changes/feat/`; branch `feat` with a product commit
changing `src/a.ts` and `src/a.test.ts` and a commit bumping `CHANGELOG.md`; evidence and the six
reviews recorded at `R` (approved unless the test says otherwise); then commits on `main`, and
`refs/remotes/origin/main` set with `git update-ref` to `main`'s tip (or older, for the unfetched
case), then `git merge --no-ff main` on `feat`. `facts = gitFacts(root, { base: 'main' })`. No
test reads this repository's history.

| Test | Proves |
|---|---|
| `own-files AC-1 rule: a merge of origin/main that brings only unrelated files leaves the evidence and every approved review current` | AC-1 (`staleness`, `reviewsItem`, `tasksItem`, `acceptanceItem`) |
| `own-files AC-1 rule: the base commits a merge brings in are exempt unless they touch an own file` | D-3 brought-in commits |
| `own-files AC-1 next: collectState hands neither verify nor review after an unrelated merge` | AC-1 at `nextStep` |
| `own-files AC-2 rule: a merge that brings a product file the branch changed is stale and names the merge and the file` | AC-2 |
| `own-files AC-2 rule: a merge that brings a test file the branch changed stales the evidence` | AC-2 (test file) |
| `own-files AC-3 rule: one own file among unrelated ones is enough and is the one named` | AC-3 |
| `own-files AC-4 rule: a merge that brings only release files, the bumped CHANGELOG.md resolved in the merge included, leaves the records current` | AC-4 |
| `own-files AC-5 rule: a plain product commit after an exempt merge is stale` | AC-5 |
| `own-files AC-6 rule: a rejected verdict is stale after an exempt merge; the approved ones are current` | AC-6 |
| `own-files AC-6 rule: a test-only commit after an exempt merge keeps the four test-spared reviewers current` | AC-6 |
| `own-files AC-7 rule: no origin/<base>, an unfetched base, a merge of another branch and a head inside the base each give today's verdict` | AC-7, D-3 fail-safe cases |
| `own-files AC-7 rule: a file the branch changed then restored is not own` | D-2 net diff |
| `own-files AC-7 base: stalenessBase reads GITHUB_BASE_REF, then the configured base, then origin/HEAD, then main or master, else null` | D-1 |
| `own-files AC-7 own: ownFiles leaves out release files, keeps the change folder and both sides of a move` | D-2 |
| `own-files AC-8 ci: the check passes after an unrelated merge and fails naming the merge after an own-file merge, from both entries` | AC-8 (`deliver-check.mjs --ci` and `guard.mjs ci`, `GITHUB_BASE_REF=main`, event head set) |
| `own-files AC-9 docs: the flow doc states the rule, the fail-safe cases and the check backstop` | AC-9 (`deliver-check.test.mjs`, reads `docs/openspec-flow.md`) |

`flow-check.test.mjs`: `own-files AC-1 stages: an unrelated merge of origin/main keeps unit-tests, evidence and review passed` and `own-files AC-2 stages: an own-file merge reports the first code-bound stage stale-code naming the merge` (`change-stages` delta). `conduct-check.test.mjs`: T-4 (a) and (b) above.

**Real-run proof (AC-10).** Done in task 3.6 with the CLIs, not the test helpers: a scratch folder
under `${TMPDIR%/}/devkit-proof-stale-only-on-own-files/` holding a bare `origin.git`, a clone with
a `devkit-lite` change `feat` whose tasks are ticked, evidence and the two required reviews
recorded and committed, and the PR head pushed. Each case runs `git fetch origin`, merges
`origin/main`, and records the output of `node <worktree>/plugins/openspec/hooks/deliver-check.mjs
feat --json` (`next.step`, items 1, 2 and 4), of `node .../flow-check.mjs feat --json` and of
`GITHUB_BASE_REF=main GITHUB_HEAD_REF=feat node .../deliver-check.mjs --ci` with an event file
naming the head, into `openspec/changes/stale-only-on-own-files/proof/real-run.md`, one section per
case: P-1 unrelated merge (AC-1, AC-8 pass), P-2 own product file (AC-2, AC-8 fail), P-3 own test
file (AC-2), P-4 mixed (AC-3), P-5 release files only (AC-4), P-6 plain commit after P-1 (AC-5),
P-7 `origin` removed (`git remote remove origin`) before the merge of the local `main` (AC-7). The
commands are written in each section so a reader can run them again. The scratch folder is removed
at the end.

## Risks / Trade-offs

- [R-1 The base changes code the change depends on without touching its files] (ADR 0021 Negative)
  → the pull request's required `check` CI runs the suite on the merged ref; `docs/openspec-flow.md`
  says so (AC-9). Probability MEDIUM × impact MEDIUM.
- [R-2 A reviewer's view of shared code is outdated] → same backstop; accepted in ADR 0021. LOW ×
  MEDIUM.
- [R-3 A wrong base name (an `origin/HEAD` that points elsewhere)] → a tip that does not contain the
  merged commits gives no exemption (D-3), so the error is on the strict side. LOW × LOW.
- [R-4 A rejected review still goes stale on a base merge during `fix-review`] → kept on purpose
  (D-5, AC-6); a follow-up line can be proposed in the retro if it costs rounds. LOW × LOW.
- [R-5 Cost of the extra `git` calls] → one `diff` per change and two `rev-list` per recorded sha,
  memoized on `facts`; `merge-base --is-ancestor` only for merges on the branch's line. LOW × LOW.
- [R-6 A project's CI on an older pin judges differently from the local loop] → a project's
  `devkit-reviews` check is stricter until it moves its pin to the new tag; never looser. The flow
  doc's pin moves with the release. LOW × LOW.
- [R-7 An existing test outside D-7 depends on today's verdict after a real `origin` merge] → the
  phase gates run every group that builds an `origin` (conduct-check, delivery-models, `--ci`); any
  unlisted failure stops the work for a plan revision. MEDIUM × LOW.

## Migration Plan

Nothing to migrate: the rule reads only git. Records written before the release are judged by the
new rule from the first run of the new version. Rollback: revert the release commit; the strict
rule returns and the next run re-runs what it finds stale.

## Implementation plan

Order: the rule and its tests in `deliver-check.mjs` (phase 1), the stage checker and the loop's
expectations (phase 2), the documents, the ADRs, the release and the real-run proof (phase 3).

**Per surface.**
- devkit-openspec hooks: `deliver-check.mjs` (D-1 to D-5), `flow-check.mjs` (D-4).
- devkit-openspec skill: `skills/devkit/SKILL.md` (D-6).
- devkit-core skill: `skills/review-change/SKILL.md` (D-6).
- Repository docs and decisions: D-6.

**File structure.**
- Modify: `plugins/openspec/hooks/deliver-check.mjs`, `plugins/openspec/hooks/flow-check.mjs`,
  `plugins/openspec/hooks/deliver-check.test.mjs`, `plugins/openspec/hooks/flow-check.test.mjs`,
  `plugins/openspec/hooks/conduct-check.test.mjs`, `plugins/openspec/hooks/change-loop.test.mjs`,
  `plugins/openspec/skills/devkit/SKILL.md`, `plugins/core/skills/review-change/SKILL.md`,
  `docs/openspec-flow.md`, `CONTRIBUTING.md`, `docs/adr/0002-merge-without-the-owner-opt-in.md`,
  `docs/adr/0021-a-base-merge-stales-only-on-the-changes-own-files.md`, `openspec/config.yaml`,
  `plugins/openspec/.claude-plugin/plugin.json`, `plugins/core/.claude-plugin/plugin.json`,
  `.claude-plugin/marketplace.json`, `CHANGELOG.md`, `docs/catalog.md` (only if the generator
  changes it).
- Create: `openspec/changes/stale-only-on-own-files/proof/red-1.txt`, `red-2.txt`, `real-run.md`.
- Delete: none.

**Estimate:** optimistic 9 h, likely 13 h, pessimistic 20 h (the pessimistic case is a release
merge of `main` with one re-run of the whole suite, per the owner's note on the Avell's re-merge cost).

| Deliverable | Hours | Type | Risk |
|---|---|---|---|
| `stalenessBase`, `ownFiles`, the walk, `gitFacts` and the callers (D-1 to D-5) | 3 | Core | MEDIUM |
| `own-files` tests in `deliver-check.test.mjs` with `ownRepo()` | 3 | Testing | MEDIUM |
| `flow-check` wiring and its two tests | 1 | Integration | LOW |
| T-3, T-4 rewrites | 1 | Testing | LOW |
| Documents, skills, ADR 0002 and 0021, `config.yaml` (D-6) and the AC-9 test | 2 | Documentation | LOW |
| Release (versions, changelog, CI pin, catalog) | 1 | Migration | MEDIUM |
| Real-run proof P-1 to P-7 | 1.5 | Testing | LOW |
| Whole-suite gate and validation | 0.5 | Testing | LOW |

**Assumptions.**
- A-1: `actions/checkout` with `fetch-depth: 0` fetches every branch, so `origin/<GITHUB_BASE_REF>`
  resolves in CI (`.github/workflows/devkit-reviews.yml`; `touchedChanges` already relies on it).
  If not, the check is today's strict one, never looser.
- A-2: `git rev-list --first-parent A..B` lists the first-parent chain of `B` minus what `A` reaches
  (git documentation); D-3's `line` depends on it.
- A-3: no existing test outside D-7 asserts a stale verdict after a merge of a real `origin/<base>`
  that brings only files the branch did not change (grep of the `*.test.mjs` files at `5d255b1`).

**Dependencies.** ADR 0021 (`decisions.md`), proposed with this change; no other change. The CI pin
moves to the tag this release creates (CONTRIBUTING step 5, the tag rule).

## Decisions cited

- ADR 0021 (`docs/adr/0021-a-base-merge-stales-only-on-the-changes-own-files.md`, via
  `decisions.md`): the rule, its fail-safe and the backstop.
- ADR 0002: its accepted cost "Strict up-to-date re-runs stale reviews" narrows; its Decision is
  unchanged.
- ADR 0012: the check judges devkit-script changes only; unchanged.
- ADR 0018: `two-prs`'s configured base is the base of D-1 step 2.

## Open Questions

None.
