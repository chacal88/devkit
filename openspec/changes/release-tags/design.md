<!-- devkit-stage design result=passed attempt=1 commit=4f4b7e201aabdebdb65b11f7ce80154463a524e9 -->
# Design

Change: `release-tags` · Date: 2026-11-23 · Owner: Kaue (chacal88) · PRD / tech spec: n/a (sources:
`requirements.md`, `proposal.md`, the spec deltas `specs/release-tags/spec.md` and
`specs/change-coordination/spec.md`, and the proposed
[ADR 0019](../../../docs/adr/0019-the-delivery-loop-tags-the-release-it-merged.md), listed in
`decisions.md`).

## Context

See `proposal.md` (Why). The code, read at `4f4b7e2` (devkit-openspec 0.28.0, marketplace 0.32.0):

| Where | What it does today |
|---|---|
| `plugins/openspec/hooks/guard.mjs` `parseDevkitBlock` (line 103) | Reads `driver`, `language`, `budget` and `delivery.{model, base, test_branch}` from the `devkit:` block with `plainValue`; every other key is ignored. `deliverySettings` turns the delivery keys into `{ model, base, testBranch, problems }` |
| `plugins/openspec/hooks/change-loop.mjs` `readDevkitSettings` (line 82) | `{ driver, language, unknown }`, plus `delivery`/`missing` only when set; `projectGate` refuses the first `unknown` entry with `setting-unknown` (exit 3, nothing run). Six tests `deepEqual` the three-key shape |
| `plugins/openspec/hooks/deliver-check.mjs` `collectState` (line 1577) | In the post-merge phase (`ship !== 'plan'` and delivered) builds `archive: archiveFacts(...)` and every item `met` |
| `deliver-check.mjs` `archiveBaseFacts` (line 1219) | Reads the default branch name (`readRepoSettings`), then `changeOn` (contents API); when the change is archived on the default branch it returns at once, without reading the archive PR; else `archivePrFacts` (`gh pr list --head chore/archive-<id> --state all --limit 10 --json number,url,state,headRefOid,mergeable,autoMergeRequest,mergeStateStatus`) |
| `deliver-check.mjs` `archiveNext` (line 1274) | The post-merge rows, first match wins: `archived` first (P0), then the test-branch rows, `a.stop`, item 5, merge setup, the open archive PR rows, `retro` (P6) ... `open-archive-pr` (P14). `stopArchive(archiveStep, reason, extra)` is `step('stop-archive', ...)` |
| `deliver-check.mjs` `readContents` (line 1146) | `gh api repos/{owner}/{repo}/contents/<path>?ref=<ref>`: `{ json }`, `{ notFound }` on `HTTP 404` (not a missing or timed-out `gh`), else `{ error: ghError(r) }` |
| `deliver-check.mjs` `describeNext`, `summaryOf`, `archiveReport` | The human `next:` line; `blocked: archive (<archiveStep>)` for every `stop-archive`, `merged: archive step <step>` otherwise; the `archive` object's keys are pinned by `deliver-check.test.mjs:4464` |
| `plugins/openspec/hooks/conduct-check.mjs` `actorOf` (line 70) | Maps a step to an actor; a step in no list is `{ actor: 'stop', reason: 'unknown step <name>' }` |
| `change-loop.mjs` `ROWS` (line 806), `decide`/`buildPart` (line 1037) | Each delivery step is a hand-off, a session step or an end; an unknown step ends blocked (`unknown-step`); `stop-archive` ends blocked `archive-failed` with no detail. `decide`'s first row ends a locally archived change `archived` without reading the delivery checker unless the checkout is `chore/archive-<id>` (`archiving`) |
| `plugins/openspec/skills/openspec-setup/scripts/github-setup.mjs` `resolveTag` (line 52) | The one existing tag read: `gh api repos/<repo>/git/ref/tags/<tag>`, `HTTP 404` is "missing", an annotated tag is followed through `git/tags/<sha>` |
| `plugins/openspec/skills/ship-change/SKILL.md`, `plugins/openspec/skills/devkit/SKILL.md` | One table row per `next.step`; the `devkit` skill does a `session` step "as the `ship-change` row of the same name says" |
| `openspec/config.yaml` | `merge_method: squash`; `ship: merge` for every schema; `devkit:` has `language` and `driver` |

Constraints:

- `deliver-check.mjs`, `guard.mjs` and `merge-setup.mjs` are the three files a project's
  `devkit-reviews` job downloads (`docs/openspec-flow.md`, CI): no new module and no new import in
  them. The CI path (`runCi`, `checkOne`) never calls `collectState`, so nothing of this change runs
  in CI.
- `deliver-check` reads and never writes, and never fetches. The fetch, the tag and the push are the
  session's (ADR 0019 decision 3).
- Tests never read the repository's git history (CI checks out at depth 1): every commit, version and
  tag is a `fakeGh` fixture (`deliver-check.test.mjs:830`).
- `scripts/check.py` refuses Portuguese prose in Markdown; the message table carries both languages.

## Goals / Non-Goals

**Goals:**

- One reader of the new key (`guard.mjs`), used by the loop and the checker (D-1).
- With the key absent, the checker makes no new `gh` call and every existing test passes unchanged
  (D-3, D-9): the new reads are reached only through the key.
- Every fact the tag step needs is read from GitHub with a named `gh` call that a fixture can fake
  (D-2).
- Each predicate has one test per condition, negatives included, and every existing test that pins a
  string, a key or a list this change touches is named with what happens to it (D-9).

**Non-Goals:**

- Asking for the archive PR's tag from a checkout that is not `chore/archive-<id>` once the change is
  archived there: `decide`'s first row ends such a run `archived` without reading the delivery
  checker, and this change keeps it (R-3).
- A panel label for `tag-release` (`plugins/panel/hooks/i18n.ts`): the panel shows an unknown step by
  its id (`report.test.tsx`, "an unknown step falls back to its id").
- `openspec-setup` writing or asking for `release_tag`; a template line for it.
- The CompozyOS loop (`.compozy/loops/openspec-change/loop.yaml`): its `archive` node drives
  `ship-change`'s rows, which gain the step (requirements, Out of scope).

## D-1 The setting (AC-3, AC-7; specs `release-tags`, `change-coordination`)

`guard.mjs`:

- `parseDevkitBlock` reads one more top-level key, `release_tag`, the way it reads `budget`: the line
  `if (m[2] === 'driver' || ...)` gains `release_tag`, the block's initial object gains
  `release_tag: undefined`, and its comment names it. A `release_tag` nested under `delivery:` is
  ignored (it is not in `DELIVERY_KEYS`).
- New `export function releaseTagSetting(block)`: `{ file: null }` when `block?.release_tag` is
  undefined; `{ file }` when the value is a path from the repository root to a JSON file; else
  `{ file: null, problem: { kind: 'unknown', setting: 'release-tag', value } }`. A path is valid when,
  split on `/`, every segment matches `^[A-Za-z0-9._-]+$` and is neither `.` nor `..` (so no leading
  `/`, no empty segment, no backslash, no space, no `?` or `#` that would break the contents URL), and
  the last segment ends with `.json`. `plugins/openspec/.claude-plugin/plugin.json` and
  `package.json` are valid.
- Parser edge cases, decided (config.yaml rule "Parsers"): an empty `release_tag:` is unset; a
  `release_tag:` followed by indented lines is unset (its nested lines are skipped as today); an
  unterminated quote keeps `plainValue`'s existing rule (the text after the quote, so
  `"package.json` reads `package.json`); a flow list `[a.json]` is a problem; a comment after the
  value is dropped.

`change-loop.mjs` `readDevkitSettings`: after the test settings' entries, a problem pushes
`{ setting: 'release-tag', value, accepted: RELEASE_TAG_ACCEPTED }` onto `unknown`, so `projectGate`
refuses with the existing `setting-unknown` reply and exit 3; a valid value sets
`settings.releaseTag = file`, and only then (the three-key shape the existing tests pin is kept).
`RELEASE_TAG_ACCEPTED = 'a path from the repository root to a JSON file, such as package.json'`.
The message table gains `setting.release-tag` (`release file` / `arquivo da versão`).

`deliver-check.mjs`: new `function releaseTagOf(root)` reads `openspec/config.yaml` as
`deliveryConfig` does and returns the file or null; a problem throws
`ShipConfigError('devkit.release_tag: "<value>" is not a path from the repository root to a .json file')`
(exit 3 through `main`). It is called only in `collectState`'s post-merge branch, so a bad value never
changes a run before the merge, and `/devkit change` already refused it at its start. `deliveryConfig`
and `flow-check.mjs` are not changed.

This repository: `openspec/config.yaml`'s `devkit:` block gains
`release_tag: plugins/openspec/.claude-plugin/plugin.json`, with its comment line naming the key
(AC-7).

Alternatives: validating in `deliveryConfig` (every pre-merge run and `flow-check` would refuse a
value used only after the merge; rejected); accepting any string and failing on the contents read
(a typo would read as "file absent" and silently skip every tag; rejected, the failure the change
exists to stop); hard-coding devkit-openspec's `plugin.json` (rejected by ADR 0019, alternatives).

## D-2 The facts and the `gh` calls (AC-1 to AC-5; spec `release-tags`)

New `function releaseTagFacts(gh, { file, number, base, merged })` in `deliver-check.mjs`, after
`archivePrFacts`. It answers one of:

- `{ state: 'none', why }` with `why` `not-merged`, `other-base`, `no-file` or `unchanged`;
- `{ state: 'done', tag, sha, number, merged }`;
- `{ state: 'missing', tag, sha, number, merged, version, file, base }`;
- `{ state: 'elsewhere', tag, sha, at, number, merged }`;
- `{ state: 'unreadable', number, reason }`.

The calls, in order, each stopping as soon as the answer is known:

| # | Call | Read | Answer |
|---|---|---|---|
| 1 | `gh api repos/{owner}/{repo}/pulls/<number>` | `merged`, `merge_commit_sha`, `base.ref` | not merged → `none/not-merged`; `base.ref !== base` → `none/other-base`; a sha that is not 40 hex → unreadable |
| 2 | `readContents(gh, file, <merge sha>)` (`.../contents/<file>?ref=<merge sha>`) | base64 `content` → JSON → top-level `version` | `notFound` → `none/no-file`; not a file, not JSON, no string `version`, or a version that fails the tag rule below → unreadable (reason `<file> at <short> has no top-level "version" a tag can carry`) |
| 3 | `gh api repos/{owner}/{repo}/git/commits/<merge sha>` | `parents[0].sha` | no parent list → unreadable; an empty list → the parent has no version |
| 4 | `readContents(gh, file, <parent sha>)` | the same `version` | `notFound`, not JSON or no string `version` → no version; equal to step 2's → `none/unchanged` |
| 5 | `gh api repos/{owner}/{repo}/git/ref/tags/v<version>` | `ref`, `object.type`, `object.sha` | `HTTP 404` → `missing`; an object whose `ref` is `refs/tags/v<version>` → go on; an array (GitHub's prefix answer) → its entry with that exact `ref`, none → `missing`; anything else → unreadable |
| 6 | only for `object.type` `tag`: `gh api repos/{owner}/{repo}/git/tags/<object sha>` | `object.type`, `object.sha` | a `commit` target → its sha; anything else → unreadable |

Then the tag's commit equal to the merge sha → `done`, else `elsewhere` with `at` that commit. Every
`gh` failure other than the two `404`s named above (a missing or timed-out `gh` included, as
`readContents` already rules) is `unreadable` with
`reason: cannot read the release of PR #<number> on GitHub: <ghError>`. Unparseable JSON from calls 1,
3, 5 and 6 is unreadable too. The tag rule: the version matches `^[0-9A-Za-z][0-9A-Za-z._+-]*$`,
holds no `..` and does not end with `.` or `.lock`, so `v<version>` is a valid tag name and a safe URL
path segment.

Why these calls: the pulls endpoint is the one `gh` read that gives the merge commit by number
(`PR_FIELDS` has no merge commit, and adding one would change every existing fixture's projection);
`git/commits` (Git database) gives the parents without the file list `commits/<sha>` carries;
`readContents` is the checker's existing contents reader, so its `404` rule is shared; `git/ref/tags`
is the exact lookup `github-setup.mjs`'s `resolveTag` already uses. Rejected:
`git/matching-refs/tags/v<x>` (a prefix match, `v0.2` lists `v0.20.0`, and paginated), reading tags
from the local clone (ADR 0019 alternatives: the clone may lack them, and the checker does not
fetch), `gh pr view <n> --json mergeCommit` (one call more per PR for the base, and `pr-view`
fixtures are shared by the change PR's other reads in the existing suites).

The merge's first parent is the version before the merge for `squash` and `merge` (this repository
merges with `squash`); for `rebase` it is the previous rebased commit (R-2).

## D-3 Where the facts are read (AC-1, AC-2)

`collectState`'s post-merge branch computes `releaseFile = releaseTagOf(root)` and passes it to
`archiveFacts` in its context; `archiveBaseFacts` reads it:

- With `releaseFile` null, nothing below runs and `archiveBaseFacts` returns exactly what it returns
  today (no `release` key): this is what keeps every existing post-merge test, and their `fakeGh`
  fixtures, unchanged.
- Once `base` is known (after the existing `read-default-branch` stop): `release.change =
  releaseTagFacts(gh, { file, number: changePr.number, base, merged: 'change' })` when `changePr` is
  known, else null.
- When `changeOn` answers `archived`: the archive PR's number comes from the same list
  `archivePrFacts` reads. Its list read moves into `archivePrList(gh, branch)` (`{ list }` |
  `{ error }`, the same `gh pr list` arguments), which `archivePrFacts` keeps using; the archived
  branch takes the first entry whose `state` is `MERGED` and sets `release.archive =
  releaseTagFacts(gh, { ..., number, merged: 'archive' })`; a list error is
  `release.archive = { state: 'unreadable', number: null, reason: 'cannot read the archive PR on GitHub: <error>' }`;
  no merged entry is null. The test branch's archive PR (`chore/archive-<id>-<test>`) is never read
  for a tag: its base is not the default branch.
- `release` rides on every return of `archiveBaseFacts` after `base` is known (the `unreadable` return
  of `changeOn` included), and `archiveFacts` keeps it when it merges the test-branch facts.
- `archiveReport` is not changed: the `archive` object keeps its keys
  (`deliver-check.test.mjs:4464`); the facts reach the report only through `next`.

## D-4 The rows (AC-1, AC-2, AC-4, AC-5)

`archiveNext` gains its first rows, ahead of P0 (`archived`), for `a.release?.change` then
`a.release?.archive`, skipping `null`, `none` and `done`:

| Row | Condition | `next.step` | Fields |
|---|---|---|---|
| R1 | `unreadable` | `stop-archive` | `archiveStep: 'tag-release'`, `reason` (the facts' reason), `number` |
| R2 | `elsewhere` | `stop-archive` | `archiveStep: 'tag-release'`, `tag`, `at`, `sha`, `number`; reason `tag <tag> on origin is at <at short>, not at <sha short>, the merge commit of PR #<n>; the loop never moves a tag` |
| R3 | `missing` | `tag-release` | `tag`, `sha`, `number`, `merged` (`change` or `archive`), `version`, `file`, `base`; reason `PR #<n> merged version <version> of <file> at <sha short>, and origin has no tag <tag>` |

R3 is written `step('tag-release', ...)`, so the two scans that read `step('<name>'` from
`deliver-check.mjs` (the `ship-change` row test and the loop's `ROWS` test) see it.

Why first: the change's merge is the earliest fact of the post-merge phase, so its tag comes before
the retro and every archive step (spec: "Asked again until the tag is there"), and the archive's tag
must come before `archived`; the change's row comes before the archive's so a run tags in merge order.
Rows that sit higher today (the test-branch stops, `a.stop`, item 5, merge setup, `disable-auto-merge`)
touch other refs; a tag push changes none of them. The cost: with auto-merge on an open archive PR
that stopped qualifying, `disable-auto-merge` waits one session step behind a missing change tag,
which only happens if the key was added between the change's merge and its archive (R-5).

`describeNext` gains `'tag-release': \`${n.tag} at ${String(n.sha).slice(0, 7)} (PR #${n.number})\``.
`summaryOf` needs nothing: `stop-archive` gives `blocked: archive (tag-release)` (exit 2) and
`tag-release` gives `merged: archive step tag-release` (exit 0), as for every archive step.

## D-5 The loop (AC-1, AC-2, AC-4; spec `change-coordination`)

- `conduct-check.mjs`: `MAIN` gains `'tag-release'` (actor `main`, state `ready to run: tag-release`).
- `change-loop.mjs` `ROWS` gains `'tag-release': session('delivery')`. `decide` then gives a session
  action of stage `delivery` with `detail` the checker's `next` minus `actor` (`tag`, `sha`, `number`,
  `merged`, `version`, `file`, `base`, `reason`), and progress key `delivery/tag-release@<fingerprint>`.
  The fingerprint does not move when a tag is pushed, so the same step back with nothing changed ends
  the run blocked `no-progress` (K1), the existing guard against a push that did not land.
- On the archive branch the stage checker's end is `archived`; `inDelivery` already reads the delivery
  row there (`archiving`), so R3 for the archive merge becomes the session step before the archived end.
- `buildPart`, before the `spec.end` switch: a `stop-archive` row whose `archiveStep` is `tag-release`
  and that carries `at` ends `blocked('tag-elsewhere', { tag, at: <7 chars>, sha: <7 chars> })`; every
  other `stop-archive`, the unreadable R1 included, stays `archive-failed` (the existing unreadable stop
  of the archive steps).
- Messages, both languages (`MESSAGES.en` / `MESSAGES['pt-BR']`):
  `blocked-why.tag-elsewhere`:
  `the tag {tag} is already on the remote at {at}, not at the merge commit {sha}; the run never moves a tag, so you settle it`
  /
  `a tag {tag} já está no remoto em {at}, não no commit do merge {sha}; a execução nunca move uma tag, então quem resolve é você`;
  and `setting.release-tag` (D-1). Neither holds a backtick, a file name, an option or an internal term
  (the `change-loop replies` test).

Alternative: passing the checker's reason as the blocked end's detail for every `stop-archive`
(rejected: it changes the JSON of every archive stop that existing tests pin, for one case).

## D-6 The session's step (AC-6)

`plugins/openspec/skills/ship-change/SKILL.md`:

- A row after `tick-roadmap`:
  `| \`tag-release\` | \`git fetch origin <next.base>\`. When \`git rev-parse -q --verify refs/tags/<next.tag>\` names a commit other than \`<next.sha>\`, stop \`blocked: archive (tag-release): local tag <next.tag> is at <that commit>, not <next.sha>\` and leave it. Otherwise \`git tag <next.tag> <next.sha>\` (lightweight: no \`-a\`, \`-s\` or \`-f\`) unless it already names \`<next.sha>\`, then \`git push origin refs/tags/<next.tag>\`, alone (no \`--force\`, \`-f\` or \`--tags\`). A refused push stops as \`blocked: archive (tag-release): <git's first error line>\`; never retry it with force. Then run the loop again. |`
- Report: a sentence after the list: a run that pushed a tag adds `tagged <tag> at <short sha>` for
  each one.
- Never: "Create a tag except at `tag-release`, or move, delete or force-push one."

`plugins/openspec/skills/devkit/SKILL.md`, the `session` bullet of the Loop, one sentence: a
`tag-release` step that stops (a refused push, a local tag at another commit) is declared with
`node <skill-dir>/../../hooks/change-loop.mjs reply blocked --param id=<id> --param why=archive-failed --lang ${user_config.language}`,
shown with git's first error line, and ends the run.

The `git push` of a tag is outside every `guard.mjs` `GIT_RULES` entry (only force pushes and
`--no-verify` are refused) and outside ADR 0002's ruleset, which covers the default branch.

## D-7 Documents and configuration (AC-6, AC-7)

- `CONTRIBUTING.md` step 5, second paragraph: keeps "tagged `v<that version>` on its merge commit",
  "lightweight" and the by-hand commands (the AC-8 test, `deliver-check.test.mjs:3805`), and adds that
  this repository's `devkit.release_tag` names devkit-openspec's `plugin.json`, so after the merge
  `deliver-check` answers `tag-release` and the session pushes the tag (a link to ADR 0019,
  `docs/adr/0019-the-delivery-loop-tags-the-release-it-merged.md`);
  the by-hand commands are for a release made outside the loop.
- `docs/openspec-flow.md`:
  - "After the merge: the archive steps": a paragraph **The release tag.** (the key, the bump rule,
    the six calls of D-2, the stops, `two-prs`, the archive-branch limit of R-3, ADR 0019), and rows
    R1 to R3 at the top of the rows table;
  - the merge-mode table of "Shipping a change": a `tag-release` row;
  - "Delivery rows" of `conduct-check` (line 294): `tag-release` joins the steps of the main session;
  - Troubleshooting: a row for `blocked: archive (tag-release)` (a tag at another commit: the owner
    moves or deletes it by hand, then runs again; GitHub unreadable: run again);
  - the CI pin lines (`## CI`): `v0.28.0` → `v0.29.0`. No new text outside `## CI` names a literal
    version next to a pin marker (`release-rebase.test.mjs:421` counts those lines).
- `openspec/config.yaml`: the `release_tag` line (D-1) and, in `context:`'s `ADRs:` line, "0019 the
  delivery loop tags the release it merged, when the project names its release file".
- Release (CONTRIBUTING.md step 5): devkit-openspec `0.28.0` → `0.29.0` in
  `plugins/openspec/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`, the marketplace
  release `0.32.0` → `0.33.0`, a CHANGELOG entry `## 0.33.0 — release tags`; both numbers re-read on
  `origin/main` right before the release task and moved past any sibling's. No agent or skill
  description changes, so `docs/catalog.md` does not.
- ADR 0019 stays `proposed` in this plan: the loop's `accept-decisions` step marks it accepted after
  the owner's plan approval (ADR 0016).

## D-8 Shared helpers

- One reader of the key: `releaseTagSetting` in `guard.mjs`, used by `readDevkitSettings` and
  `releaseTagOf`.
- One contents reader (`readContents`), one archive PR list read (`archivePrList`), one tag-ref rule
  (D-2 call 5, the same exact lookup as `resolveTag`; `github-setup.mjs` is not changed).

## D-9 Tests

New suite `plugins/openspec/hooks/release-tags.test.mjs`, imported by `guard.test.mjs` (one line,
after `delivery-models.test.mjs`); every new test's name starts `release-tags <phase>: `, also in the
existing suites. Every fixture is `fakeGh` plus a temporary repository (`gitRepo`); no test reads this
repository's git history. A test of a function this change adds reaches it through a namespace import
(`import * as deliver from './deliver-check.mjs'`) so the red run fails test by test.

Fixture helpers: `deliver-check.test.mjs` exports `pm`, `archiveFolder`, `writeRetro`, `retroMd`,
`mergedPr`, `archivePrJson`, `ARCHIVE_PRS` and `ARCHIVE_LISTING`, and `shipRepo` and `pm` take an
optional `extra` config text appended to `openspec/config.yaml` before the first commit (default `''`:
every existing caller builds the same repository). In the new suite, `releaseFixtures(gh, { number,
base, merge, parent, atMerge, atParent, tag })` sets the keys of D-2: `api-GET-repos__owner___repo__pulls_<n>`,
`api-GET-repos__owner___repo__contents_release.json_ref=<sha>`,
`api-GET-repos__owner___repo__git_commits_<sha>`, `api-GET-repos__owner___repo__git_ref_tags_v<x>`,
`api-GET-repos__owner___repo__git_tags_<sha>` (a value `null` is a `NOT_FOUND`, a number is that
`HTTP` error).

**The test that proves each criterion.**

| AC | Test |
|---|---|
| AC-1 | `release-tags 2: the change's merge that bumped the release asks tag-release before the retro` and `release-tags 3: tag-release after the change's merge is a session step of the delivery stage` |
| AC-2 | `release-tags 2: the archive merge that bumped the release asks tag-release instead of archived` and `release-tags 3: on the archive branch tag-release comes before the archived end` |
| AC-3 | `release-tags 2: an unchanged version asks no tag`, `release-tags 2: a tag at the merge commit is the step done (lightweight and annotated)`, `release-tags 2: without release_tag the answer and the gh calls are today's` |
| AC-4 | `release-tags 2: a tag at another commit stops naming the tag and both commits` and `release-tags 3: a tag at another commit ends the run blocked tag-elsewhere` |
| AC-5 | `release-tags 2: each fact GitHub does not answer stops tag-release, never a pass` |
| AC-6 | `release-tags 3: ship-change has the tag-release row, its report line and its never line`, `release-tags 4: CONTRIBUTING and the flow page describe the key and the step` |
| AC-7 | `release-tags 4: this repository names devkit-openspec's plugin.json as its release file` |

**One test per condition** (each bullet one test; "neg" a negative):

- P1 `parseDevkitBlock`/`releaseTagSetting`: plain, quoted and commented values; empty value unset;
  nested under `delivery:` ignored (neg); `release_tag:` with indented lines unset; unterminated quote
  (`"package.json` valid); each invalid form (`/abs.json`, `../x.json`, `a/./x.json`, `a//x.json`,
  `x.yaml`, `[a.json]`, `a b.json`, `a\b.json`) a problem; `plugins/openspec/.claude-plugin/plugin.json`
  valid.
- P2 `readDevkitSettings`: valid sets `releaseTag`; absent keeps `{ driver, language, unknown }`
  exactly; invalid adds the `release-tag` unknown entry with the accepted text; `/devkit change` start
  refuses an invalid value with `setting-unknown` in both languages, exit 3, nothing created (in
  `change-loop.test.mjs`).
- P3 `releaseTagFacts` through `collectState`/`nextStep`: bump (R3, every field, the human line);
  unchanged (neg); file new at the parent (bump); parent not JSON (bump); file gone at the merge (neg);
  merge file not JSON, no `version`, `"version": 3`, `"version": "1..2"` (each R1); pull request base
  `develop` (neg); `merged: false` (neg); retro written but tag missing (still R3); both merges bumped
  (change first, then archive); archive bumped with change tag done (R3 archive); archive unchanged
  (`archived`, neg); annotated tag at the merge (done) and at another commit (R2); array answer with and
  without the exact ref; invalid `release_tag` value → `deliver-check` CLI exit 3 naming
  `devkit.release_tag`.
- P4 unreadable (R1, one test with a case per call): calls 1 to 6 each failing with `HTTP 502`; a
  timed-out `gh` (a `gh` function passed to `collectState` that answers
  `{ status: null, timedOut: true }` for call 5, since a fixture `sleep` past `GH_TIMEOUT_MS` would
  take 60 seconds); pulls answer without `merge_commit_sha`; the archive
  PR list failing; and `HTTP 404` on call 5 is R3, not R1 (neg).
- P5 loop: `decide` on `deliveryStep` of the real P3 report gives the session action (kind, stage,
  step, detail fields, exit 0); the same with `archiving` and an `archived` stage-checker end;
  `after` equal to its progress key ends `no-progress`; R2 row ends `tag-elsewhere` with both shorts in
  the reply; R1 row ends `archive-failed` (neg); `actorOf('tag-release')` is `main` (in
  `conduct-check.test.mjs`).
- P6 skills and docs: the ship-change row holds `git fetch origin <next.base>`,
  `git tag <next.tag> <next.sha>`, `git push origin refs/tags/<next.tag>` and no `--force` (neg); the
  Report sentence; the Never line; the `devkit` skill sentence names `tag-release` and
  `why=archive-failed`; CONTRIBUTING step 5 names `release_tag`, `tag-release` and the by-hand
  commands; `docs/openspec-flow.md` names `release_tag`, has a `tag-release` row in the merge-mode
  table and links ADR 0019; `openspec/config.yaml`'s `ADRs:` line names 0019; the repository's own
  settings read `releaseTag` `plugins/openspec/.claude-plugin/plugin.json` and that file has a string
  `version`.

**Existing tests that assert what this change touches** (from `grep` of the test files for
`tag-release`, `release_tag`, `ROW_STEPS`, `actorOf(`, `readDevkitSettings(`, `parseDevkitBlock`,
`Object.keys(j.archive)`, `ship-change names every`, `blocked-why`, `SAMPLE`, `BLOCKED_PARAMS`,
`v0.28.0`, `git/ref/tags`, `lightweight`). Each row names the invariant, the layer that owns it and the
suite (CLAUDE.md):

| Test (file:line at `4f4b7e2`) | Invariant · layer · suite | What happens |
|---|---|---|
| `format: ship-change names every next.step the checker can return` (`deliver-check.test.mjs:3209`) | every step the checker emits has a skill row · skill contract · deliver-check | `steps` gains `tag-release`; passes once the row exists |
| `AC-8 release-ready ...` (`deliver-check.test.mjs:3805`) | versions match the marketplace, the doc pin names the version, CONTRIBUTING holds the tag rule · release · deliver-check | unchanged; passes with 0.29.0 and the kept words |
| `the pin in docs/openspec-flow.md is the commit sha of v + ...` (`deliver-check.test.mjs:3795`) | the CI pin is the current version's sha placeholder · docs · deliver-check | unchanged; passes after the pin move |
| `Object.keys(j.archive)` (`deliver-check.test.mjs:4464`) | the `archive` object's keys · report JSON · deliver-check | unchanged and kept passing (D-3) |
| the archive walk ending `'nothing is pushed'` (`deliver-check.test.mjs:4700-4735`) | the full post-merge walk · archive rows · deliver-check | unchanged: no `release_tag` in its fixture |
| `change-loop settings: ...` (`change-loop.test.mjs:49-72`, `:3201-3215`, `:4117`) | the settings' three-key shape · settings · change-loop | unchanged; `releaseTag` appears only when set |
| `change-loop replies: ...` table and rendering (`change-loop.test.mjs:83-160`) | both languages, same keys, every rendering filled and free of internal terms · messages · change-loop | `SAMPLE` gains `tag: 'v1.3.0', at: 'd4e5f60', sha: 'a1b2c3d'` |
| `change-loop decide: the B rows are exactly the steps the checkers can return` (`change-loop.test.mjs:533`) | `ROWS` = the steps the checkers return · loop · change-loop | unchanged; passes with the `ROWS` entry |
| `change-loop decide: the loop's step agents match conduct-check's actorOf` (`change-loop.test.mjs:557`) | the loop's agents equal the checker's · loop · change-loop | unchanged; `tag-release` is a session step with no agent |
| `change-loop decide: B14 ...` (`change-loop.test.mjs:506`) | a stop without `archiveStep: tag-release` is `archive-failed` · loop · change-loop | unchanged |
| `change-state AC-3 state: each blocked reason ...` (`change-loop.test.mjs:4468`) | every blocked end decide gives has its state phrase · state · change-loop | `cases` gains `tag-elsewhere` |
| CI pin invariant (`change-loop.test.mjs:2538-2545`) | the snippet pins the current release · docs · change-loop | `v0.28.0` → `v0.29.0`, plus `doesNotMatch(/v0\.28\.0/)`; comment updated |
| `roadmap-loop replies: a blocked line renders every blocked reason` (`roadmap-loop.test.mjs:558`) | every blocked reason renders in a roadmap line · messages · roadmap-loop | `BLOCKED_PARAMS` gains `tag`, `at`, `sha` |
| `conduct: a deliver-check step with no actor mapping ...` (`conduct-check.test.mjs:565`) | an unknown step stops · actors · conduct-check | unchanged (`bogus`) |
| `conduct: deliveryStep maps every deliver-check step ...`, its `main` list (`conduct-check.test.mjs:532`, line 540) | the session's small steps are `main` · actors · conduct-check | gains `tag-release` |
| `release-rebase pin: the real docs/openspec-flow.md ...` (`release-rebase.test.mjs:421`) | pin lines are exactly the CI ones · docs · release-rebase | unchanged; new text names no literal version |
| `delivery-models config: ...` `parseDevkitBlock` (`delivery-models.test.mjs:93-101`) | nested keys never set top-level ones · settings · delivery-models | unchanged |
| `2.1: every step of actorOf has a short label` (`plugins/panel/hooks/report.test.tsx:708`) | a static list of steps · panel | unchanged: the list is literal and the panel is not touched |

## Implementation plan

**Order** (dependency): the setting (phase 1) → the checker's facts and rows (phase 2) → the loop,
the actors and the skills (phase 3) → documents, configuration, release and the whole suite
(phase 4). No data, endpoint, frontend or worker surface.

**Per surface.**

- Hooks (`plugins/openspec/hooks/`): `guard.mjs` (D-1), `deliver-check.mjs` (D-1, D-2, D-3, D-4),
  `conduct-check.mjs` and `change-loop.mjs` (D-5).
- Skills: `plugins/openspec/skills/ship-change/SKILL.md`, `plugins/openspec/skills/devkit/SKILL.md`
  (D-6).
- Docs and config: `CONTRIBUTING.md`, `docs/openspec-flow.md`, `openspec/config.yaml`,
  `CHANGELOG.md`, `plugins/openspec/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`
  (D-7).

**File structure.**

- Create: `plugins/openspec/hooks/release-tags.test.mjs`; the red proofs
  `openspec/changes/release-tags/proof/red-<phase>.txt`.
- Modify: the hooks, skills, docs and config above; `plugins/openspec/hooks/guard.test.mjs` (one
  import), `deliver-check.test.mjs` (exports, `extra`, the `steps` list), `change-loop.test.mjs`
  (`SAMPLE`, the blocked `cases`, the pin invariant, P2's start test, P5), `roadmap-loop.test.mjs`
  (`BLOCKED_PARAMS`), `conduct-check.test.mjs` (the `main` list).
- Delete: none.

**Estimate.** Optimistic 13 h · likely 19 h · pessimistic 29 h (the likely figure is the table's sum).

| Component | Hours | Type | Risk |
|---|---|---|---|
| D-1 key reader, settings, refusal, `releaseTagOf`; P1, P2 | 3 | Core | LOW |
| Fixture exports and `releaseFixtures` | 2 | Testing | LOW |
| D-2 `releaseTagFacts` (six calls, tag rule) | 4 | Core | MEDIUM |
| D-3 wiring in `collectState`/`archiveBaseFacts`, `archivePrList` | 2 | Integration | MEDIUM |
| D-4 rows, human line; P3, P4 | 3 | Core | MEDIUM |
| D-5 actor, `ROWS`, `tag-elsewhere`, messages, fixture updates; P5 | 2 | Integration | LOW |
| D-6 ship-change and devkit skill text; P6 (skills) | 1 | Documentation | LOW |
| D-7 docs, config, release, pin move; P6 (docs) | 1 | Documentation | LOW |
| Whole suite, evidence | 1 | Testing | LOW |

## Risks / Trade-offs

| ID | Risk | Probability × impact | Mitigation |
|---|---|---|---|
| R-1 | The session pushes a tag on the wrong commit | LOW × HIGH | The sha comes from GitHub's own pull request answer, the version from the release file at that very sha, and the row only asks when no tag exists; the session never moves a tag, and a wrong one is the owner's to delete by hand (ADR 0019 Consequences) |
| R-2 | `merge_method: rebase` with several commits: the first parent of the last rebased commit is the PR's own previous commit, so a bump in an earlier commit is missed | LOW × MEDIUM | This repository merges with `squash`; the release task is the last commit of a change by convention (CONTRIBUTING step 5); documented in the flow page; ADR 0019's review trigger covers a tag found missing; CONTRIBUTING keeps the by-hand commands |
| R-3 | Once the archive merged, a `/devkit change` run from a checkout other than `chore/archive-<id>` ends `archived` without asking the archive's tag (`decide`'s first row) | LOW × MEDIUM | The run that drives the archive is on the archive branch in both modes (the wait on the archive PR, or the owner's next call that `locate` sends to the archive worktree); `ship-change` asks the checker from any branch, and R1 to R3 sit before `archived` there; documented; the usual bump is in the change's own PR, asked before the retro |
| R-4 | GitHub's answers drift from the fixtures (field names of `pulls`, `git/commits`, `git/ref`) | LOW × MEDIUM | The fields read are the documented REST fields; `git/ref/tags` is already read the same way by `github-setup.mjs`; an unexpected shape is R1 (a stop), never a pass |
| R-5 | The tag row ahead of `disable-auto-merge` delays disabling auto-merge on a stale archive PR | LOW × LOW | Only when the key is added between the change's merge and its archive; the tag step is one command; the next run disables it |
| R-6 | A release file left broken on the default branch stops every post-merge run of the project | LOW × MEDIUM | The reason names the file and the commit; fixing the file or removing the key lets the run go on; a silent skip is what ADR 0019 rejects |
| R-7 | The CompozyOS loop's constraint "never push without the operator's explicit approval recorded in this run" may make its `archive` node refuse the tag push | MEDIUM × LOW | The `archive` node already pushes `chore/archive-<id>` through `ship-change`; a refusal leaves the tag missing and the next run asks again; out of scope by the owner (requirements) and flagged in the plan's return |
| R-8 | Sibling changes collide on `change-loop.mjs` messages, `deliver-check.mjs` and the release numbers | HIGH × LOW | Narrow, additive edits; merge `origin/main` before phase 1 and before the release task; re-read both version numbers there (CONTRIBUTING step 5) |
| R-9 | Six extra `gh` reads per merged PR per post-merge run, each run, until archived | MEDIUM × LOW | Only with the key; read-only; calls stop at the first decisive answer (an unchanged version costs three) |

## Assumptions

- GitHub's REST `GET /repos/{owner}/{repo}/pulls/{n}` answers `merged`, `merge_commit_sha` and
  `base.ref`; `GET /git/commits/{sha}` answers `parents[].sha`; `GET /git/ref/tags/{tag}` answers
  `404` when the exact ref is absent and `{ ref, object: { type, sha } }` when present (GitHub REST
  documentation; `github-setup.mjs` `resolveTag` relies on the last one). If the ref endpoint answers
  an array, D-2 call 5 handles it.
- `merge_commit_sha` of a squash or merge-commit merge is the commit on the default branch whose first
  parent is the base before the merge (GitHub documentation of merge methods).
- The session's clone can reach the merge commit after `git fetch origin <base>`: the merge is on the
  default branch (ADR 0002, ADR 0003).
- The installed devkit-openspec, not this worktree, runs the loop: the first tag the loop pushes for
  this repository is for the first release after 0.29.0 is installed; v0.29.0 itself may need the
  by-hand commands (tasks, Workflow follow-up).

## Dependencies

- ADR 0019 (proposed by `decisions.md`; accepted at plan approval).
- ADR 0002 and ADR 0003 (the merge and the archive merge the tag follows), ADR 0004 (opt-in per
  project), ADR 0010 (the checker as the one source of the next step), ADR 0018 (`two-prs`: only the
  base branch's merges).
- `delivery-models` (merged, not yet archived): `deliverySettings`, `parseDevkitBlock`'s nested reading
  and the `two-prs` base filter this change builds on.
- No entry of an open-decisions log (the repository keeps none).

## Migration Plan

Nothing changes in a project until it writes `devkit.release_tag`. This repository writes it in this
change. Rollback: remove the key (the loop answers as before) or revert the release; no state is
stored and no tag is ever moved, so nothing needs undoing beyond deleting a tag by hand if one was
wrong.

## Open Questions

None that change the specs, the approach or the tasks. R-3 and R-7 are limits recorded for the owner
at plan approval; the owner scoped the CompozyOS driver out (`requirements.md`, Out of scope).
