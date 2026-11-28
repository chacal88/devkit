<!-- devkit-stage design result=passed attempt=1 commit=4aa88a1ebea8213e62cdcfafa0b7b8257cf0867b -->
# Design

Change: `release-merge-manifest-fields` · Date: 2026-11-28 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(`proposal.md`, `requirements.md`, `decisions.md`, `release.md`, the deltas under `specs/`). Base: `origin/main`
at `6f03a57c`; line numbers below are at that commit.

## Context

See `proposal.md` "Why". The step every no-note release runs is the tail of `main` in
`plugins/openspec/hooks/release-merge.mjs`:

- `side` (`:684`) is `{ change: oldHead, base: ref }` for `--base` and `{ change: ref, base: oldHead }` for
  `--merge`: one code path, the sides swapped.
- `resolveVersions` (`:233-263`) lists the manifests the change side touched since the merge base
  (`changed`: paths matching both `RELEASE_FILE` and `MANIFEST`), computes the renumbered `versions`, and
  collects `beyond`, the manifests whose change side differs from the merge base outside the version fields
  (`manifestEditsBeyondVersion`, `:49-53`, over `diffPaths`, `:36-46`, after `withoutVersions` of
  `deliver-check.mjs:1689`).
- `:713` refuses the whole join when `beyond` is not empty; otherwise `:715-720` writes each changed manifest
  as `resolveManifest(<base side's text>, versions)` (`deliver-check.mjs:1680`), so a field only the base side
  edited is already kept (AC-2 holds today) and a field the change side edited would be lost, which is why
  `:713` refuses it.
- `:734-740` runs `scripts/gen-catalog.py` whenever a manifest is written; the catalog reads each pack's
  `plugin.json` `description` (`scripts/gen-catalog.py:89-90`), so AC-6 needs no new step.
- The noted path (`numberRelease`, `assignBlocking:359`) also calls `manifestEditsBeyondVersion`; it is out
  of scope (requirements question 2) and keeps calling it unchanged.
- A refused `--merge` exits 2; `plugins/openspec/hooks/train-loop.mjs` `build` (`:318-331`) then takes the
  change off with `why: conflict`, and `pathsDetail` (`:308-313`) names `out.conflicts` (all release files
  here), so the refusal's `conflicts` is what the train record shows.

Decisions in force: ADR 0022 decision 8 (a join conflict only in release files is resolved by the
`release-merge.mjs` rule), ADR 0034 decision 8 (a change with no note joins and merges its base by the old
rule), ADR 0003 (the release list, unchanged), ADR 0036 (the gate's selective part). `decisions.md` records
that no new ADR is needed.

## Goals / Non-Goals

**Goals:**
- One field-level three-way merge of a manifest, shared by `--base` and `--merge`, that keeps every field only
  one side edited and refuses every field both sides edited.
- The refusals keep the step's abort contract: exit 2, `resolved: false`, the branch at its old head, no merge
  in progress, the tree as it was.
- Byte-identical output to today for every manifest whose change side edited only version fields.

**Non-Goals:**
- The noted path and `assignBlocking` (requirements question 2); `manifestEditsBeyondVersion` keeps its
  export and its output.
- Any change to `train-loop.mjs`, `scripts/gen-catalog.py`, the CHANGELOG step, the pin step or `RELEASE_FILE`.
- Keeping a whole pack entry or a whole manifest the change side added or removed (requirements question 4).

## Decisions

### D-1 One exported helper in `release-merge.mjs`

`export function mergeManifestFields({ mergeBase, change, base })` in `plugins/openspec/hooks/release-merge.mjs`,
in the "manifests" section after `manifestEditsBeyondVersion`. Its arguments are the three texts of one manifest
(`mergeBase` and `base` may be `null`, a file missing on that side; `change` is a string). It returns
`{ edits, whole, both, text }`:

- `edits`: the change side's paths beyond the version fields, formatted as `manifestEditsBeyondVersion` formats
  them (D-2), in `diffPaths` order;
- `whole`: `true` when the change side added or removed a whole entry or the manifest is new (D-4);
- `both`: the formatted change-side paths that overlap a base-side path (D-3), de-duplicated, in `edits` order;
- `text`: the merged manifest text before the version step (D-5), or `null` when `whole` is true, `both` is not
  empty, or `base` is `null`.

Why here and not in `deliver-check.mjs`: no consumer CI reads it (deliver-check.mjs holds only what the consumer
CI downloads alone, release-at-merge D-3a, the comment at `release-merge.mjs:23-24`).

Alternative rejected: a `git merge-file` of the three texts with the versions masked, as the pin and the noted
path do (`mergeTexts`). It merges lines, not fields: two neighbouring keys edited apart conflict, a reformatted
file conflicts everywhere, and two identical edits merge cleanly, which requirements question 3 refuses.

### D-2 A field is a segment path of `diffPaths`

`diffPaths` changes from string paths to segment arrays: each segment is `{ key: <string> }` (an object key) or
`{ name: <string> }` (a `plugins[]`-style entry matched by `name`); the walk is unchanged (named arrays by name,
plain objects key by key, any other value compared as `JSON.stringify` and pushed as a leaf). A private
`formatPath(segments)` gives today's strings: `[name]` appended as `[<name>]`, a key as `.<key>` (no dot at the
start), the empty path as `(root)`. `manifestEditsBeyondVersion` returns `diffPaths(...).map(formatPath)`, so
its output stays as `release-merge.test.mjs:77-81` pins it. Segment arrays keep a key holding `.` or `[` from
being read as two segments when paths are compared.

An unnamed array (`keywords`) is one leaf: an edit of any element is an edit of the whole array. An added or a
removed key is a leaf whose value is `undefined` on one side.

### D-3 A conflict is a pair of overlapping paths, whatever the values

`C` = `diffPaths(withoutVersions(mergeBase), withoutVersions(change))`, `B` = the same against `base`. A path
`c` of `C` conflicts when some `b` of `B` equals `c`, is a prefix of `c` (segment by segment), or has `c` as a
prefix. So: both sides edited `description` (even to the same value, requirements question 3) is a conflict;
the base side removed entry `plugins[a]` while the change side edited `plugins[a].description` is a conflict;
the base side edited `homepage` while the change side edited `description` is not. When `base` is `null` (the
base side deleted the manifest), `B` is `[[]]` (the root), so any change-side field edit conflicts and a
version-only change side writes nothing, as today (`:717`).

### D-4 A whole edit keeps the old refusal (requirements question 4)

`whole` is true when `mergeBase` is `null` (a manifest the merge base lacks: a new pack), or when a path of `C`
is empty or ends in a `{ name }` segment (the change side added or removed a `plugins[]` entry). The caller
refuses it with today's text, `a manifest was edited beyond its version: <file> (<edits>)`, before any other
check (D-6).

Reading of question 4, stated for the readiness review: "a whole entry added or removed on either side still
aborts as today" is read as "behaves as today". Today only the change side's whole edits abort; an entry or a
manifest the base side added or removed stays the base side's (the base side's text is the starting point). That
stays: a base-side entry add or remove is not a conflict unless the change side edited inside it (D-3). The
literal "either side" would newly refuse a train whose tip carries a new pack, a regression the request did not
ask for.

### D-5 The merged text

`text` starts from `JSON.parse(base)` (version fields included). For each path of `C` (none conflicting, none
whole) it walks the segments to the parent in the base object (`{ key }` by property, `{ name }` by
`array.find((e) => e.name === name)`) and sets the last key to the change side's value at the same path
(`structuredClone` of the parsed `change`, version fields included) or deletes it when that value is
`undefined`. A changed key keeps its place in the base's key order; an added key is appended to its object. A
parent missing on the base side cannot occur without a base-side edit of an ancestor (D-3); the helper throws
`ReleaseError('cannot keep <path>: the base side has no <parent path>')` if it does. The text is
`JSON.stringify(obj, null, 2)` plus a final newline when `base` ends with one; when `C` is empty `text` is `base`
unchanged, so the caller's `resolveManifest(text, versions)` writes exactly what it writes today.

Parsers (config rule): a side that is not JSON (an empty file, a truncated object) makes `JSON.parse` throw a
`SyntaxError`; the caller is inside `main`'s `try` (`:706`, `:748-751`), which restores the tree and exits 2,
as `release-merge.test.mjs:262` pins today.

### D-6 The caller: the version step of `main`

`resolveVersions` loses `beyond` and its `manifestEditsBeyondVersion` call; it returns `{ changed, versions }`.
`:713-720` becomes, in this order, before any write:

1. `const merged = changed.map((path) => ({ path, ...mergeManifestFields({ mergeBase: show(root, mergeBase, path),
   change: show(root, side.change, path), base: show(root, side.base, path) }) }))`.
2. When some `merged` entry has `whole`: `unresolved({ conflicts: changed, error: 'a manifest was edited beyond
   its version: ' + <each whole entry as `<path> (<edits joined ', '>)`, joined '; '> })` (today's text and
   `conflicts`, now listing only the whole entries).
3. When some entry has a non-empty `both`: `unresolved({ conflicts: <their paths>, error: 'a manifest field was
   edited on both sides: ' + <each as `<path> (<both joined ', '>)`, joined '; '> })`.
4. For each entry with a non-null `text`: `writeStaged(root, touched, path, resolveManifest(text, versions))` and
   `files.push(path)`; an entry with `text === null` (base side `null`) is skipped, as `:717` skips it.

A change side that deleted a manifest makes `resolveVersions` throw on `JSON.parse(null).name` (`:247`), as it
throws today in `manifestEditsBeyondVersion`: exit 2, tree restored, unchanged. The catalog step, the CHANGELOG
step, the pin step and the commit are unchanged.

### D-7 Texts

| Where | Text |
| --- | --- |
| Refusal, both sides | `a manifest field was edited on both sides: <file> (<path>, ...); <file> (...)` |
| Refusal, whole edit (unchanged) | `a manifest was edited beyond its version: <file> (<path>, ...); ...` |
| `docs/openspec-flow.md`, "Classification" | "a manifest edited beyond its version fields (a `description`, a new pack)" becomes "a manifest field both sides edited beyond the version fields, a pack entry the change added to or removed from `marketplace.json` or a manifest the merge base lacks (see "The version rule")" |
| `docs/openspec-flow.md`, "The version rule" | after "whichever file happened to conflict." add: "Each manifest takes the change's value of every field only the change edited since the merge base: a field is a JSON leaf path other than the version fields (`description`, `keywords`, `plugins[<name>].description`, an added or removed key). A field only the base edited keeps the base's value. A field both sides edited, even to the same value, or one inside a pack entry the other side removed, aborts with an `error` starting `a manifest field was edited on both sides:` that names each file and field. A pack entry the change added or removed, or a manifest the merge base lacks, aborts with an `error` starting `a manifest was edited beyond its version:`; an entry or a manifest the base added stays the base's." |
| `docs/openspec-flow.md`, "A join that conflicts" | after its first sentence add: "A manifest field the head and the train both edited (see "The version rule") takes the change off the same way, with the manifest attached." |
| `CONTRIBUTING.md` step 5 | "The join refuses a head that edits a manifest field beyond `version` (a pack's description in `plugin.json` or `marketplace.json`), so such a change is delivered alone, merged on its own green checks, and its plan says so." becomes "A head with no release note keeps on the train every manifest field beyond `version` that only one side edited (a pack's description in `plugin.json` or `marketplace.json` rides the train); the join refuses a field the head and the train both edited, a pack entry the head added or removed and a manifest the head added, and a change refused for one of those is delivered alone, merged on its own green checks, and its plan says so. A head with a note is still refused when a manifest it edited beyond `version` conflicts with the train's." |

The other sentences of those paragraphs, the "Classification" bullet's other clauses included, stay byte for byte.

### D-8 Tests

Test first: each new test is written, run red on the code before the task, then made green. Every new test's
name starts `release-merge-manifest-fields `; an AC test names its id next (`release-merge-manifest-fields AC-1 `).

| # | File | Test (name after the prefix) | Fixture | Proves |
| --- | --- | --- | --- | --- |
| T1 | `plugins/openspec/hooks/release-merge.test.mjs` | `AC-1 mergeManifestFields keeps a field only the change side edited, in the base's key order` | the `MARKET` constant (`:48-67`) | AC-1 (pure) |
| T2 | same | `AC-2 mergeManifestFields keeps a field only the base side edited and returns the base text when the change edited none` | `MARKET` | AC-2 (pure), the byte-identical goal |
| T3 | same | `AC-3 mergeManifestFields refuses a field both sides edited, to the same value and to different values, and a field inside an entry the base removed` | `MARKET` | AC-3, D-3 |
| T4 | same | `AC-4 mergeManifestFields merges two different fields of one manifest, an added key appended and a removed key deleted` | `MARKET` | AC-4, D-5 |
| T5 | same | `whole entry: an entry the change side added or removed and a manifest new at the merge base are whole; an entry the base side added is not` | `MARKET` | D-4 |
| T6 | same | `parsers: mergeManifestFields throws a SyntaxError on an empty or truncated side` | strings | D-5 parsers |
| T7 | same | `AC-5 --base keeps the branch's description with the version renumbered above the base's` | `releaseRepo` (`:133-160`), `gen: true` | AC-5 keep |
| T8 | same (rewrites `:246`, see "Pinned rules") | `AC-5 --base refuses a description both sides edited and aborts to oldHead` | `releaseRepo` | AC-5 refuse, AC-3 text |
| T9 | same | `whole entry: --base refuses a pack entry the branch added with the old error text` | `releaseRepo` | D-4, D-6 step 2 |
| T10 | same | `AC-7 the flow page and CONTRIBUTING state the field rule` | reads `docs/openspec-flow.md` and `CONTRIBUTING.md` of the working tree | AC-7 docs |
| T11 | `plugins/openspec/hooks/delivery-train.test.mjs` | `AC-1 AC-6 the join keeps the head's description in both manifests and regenerates the catalog from it` | `joinRepo` (`:191-214`), `initial` with a `scripts/gen-catalog.py` stub that writes each `plugins/*/.claude-plugin/plugin.json` `description` to `docs/catalog.md` | AC-1, AC-6 (fixture) |
| T12 | same | `AC-2 the join keeps the train's description with the renumbered version` | `joinRepo` | AC-2 (passes before the change too; kept as a regression test) |
| T13 | same | `AC-3 the join refuses a description both sides edited to the same value and leaves the train as it was` | `joinRepo` | AC-3 |
| T14 | same | `AC-4 the join keeps the head's description and the train's homepage in one plugin.json` | `joinRepo` | AC-4 |
| T15 | same | `whole entry: the join refuses a pack the head added and keeps a pack the train added` | `joinRepo` | D-4 both readings |

T10 asserts, on the working tree's files: the "Classification" bullet holds `a manifest field both sides edited`
and not `(a \`description\`, a new pack)`; "The version rule" holds `a manifest field was edited on both sides:`
and `keeps the base's value`; CONTRIBUTING step 5 holds `rides the train` and not `The join refuses a head that
edits a manifest field beyond`. It reads no git history (config rule "Test history").

T13 asserts `r.code === 2`, `r.out.resolved === false`, `r.out.conflicts` deep-equal to
`['plugins/a/.claude-plugin/plugin.json']`, `r.out.error` starting `a manifest field was edited on both sides:`
and including `plugins/a/.claude-plugin/plugin.json (description)`, `HEAD` equal to `tip`, `noMerge`, and an empty
`git status --porcelain`.

### D-9 Pinned rules (CLAUDE.md: invariant, layer, suite)

Grep run for `beyond its version`, `manifestEditsBeyondVersion`, `edited beyond`, `delivered alone`, `description
edit`, `The version rule`, `rewritten from the base`, `Classification`, and the step 5 phrases, over
`plugins/` and `scripts/` test files:

| Test | Asserts | Invariant · layer · suite | This change |
| --- | --- | --- | --- |
| `release-merge.test.mjs:77` `manifestEditsBeyondVersion is empty for a version edit and names a description edit` | `['plugins[a].description']` | the formatted path strings · `release-merge.mjs` manifests helpers · `release-merge.test.mjs` | unchanged, must stay green after D-2 |
| `release-merge.test.mjs:246` `a manifest edited beyond its version aborts to oldHead` | exit 2, `/plugin\.json/`, old head, clean | a manifest the rule cannot resolve aborts to the old head · the `--base` CLI · `release-merge.test.mjs` | rewritten as T8: the same invariant on a field both sides edited (the old fixture is now resolved, AC-5) |
| `release-merge.test.mjs:262` `an invalid JSON manifest on the branch restores to oldHead with exit 2` | exit 2, old head, clean | a malformed manifest restores the tree · the `--base` CLI · `release-merge.test.mjs` | unchanged, must stay green (D-5 parsers) |
| `release-note.test.mjs:979-985` | step 5 parts `release.md`, `edits no release line`, ..., `old rule`, `0030-the-pin-test-reads-the-manifest` | CONTRIBUTING step 5 states the note rule · repository docs · `release-note.test.mjs` | unchanged: none of the parts is in the replaced sentence |
| `delivery-train-after.test.mjs:786-792` | `takes its release numbers on the train` and three others | CONTRIBUTING states the train's numbering · repository docs · `delivery-train-after.test.mjs` | unchanged: the parts sit outside the replaced sentence |
| `deliver-check-archive.test.mjs:1250` | the "Classification" bullet does not hold `and the ADR 0003 exemption, do not change` | the bullet no longer claims the exemption is fixed · the flow page · `deliver-check-archive.test.mjs` | unchanged: D-7's new clause does not hold the phrase |
| `release-note.test.mjs:697` | `withoutVersions` is a function (message names `manifestEditsBeyondVersion`) | the manifest mask stays exported · `deliver-check.mjs` · `release-note.test.mjs` | unchanged: both functions stay |
| `release-merge.test.mjs:1276` `release-note AC-4 assign: a manifest field the branch added is kept ...` | the noted path keeps a field | the noted step keeps a branch's field · `numberRelease` · `release-merge.test.mjs` | unchanged, out of scope |

No output field or message-table key is added: the refusal reuses `resolved`, `conflicts`, `error`.

### D-10 The real run (AC-6, contract flag)

In a scratch clone `/var/tmp/devkit-rmmf/clone` of this worktree's branch (`git clone --no-hardlinks
<worktree> /var/tmp/devkit-rmmf/clone`; first check the folder can be deleted, then delete it at the end):

1. `--merge`, AC-1 and AC-6: branch `train/t` from the clone's `HEAD` bumps devkit-core's minor in
   `plugins/core/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`; branch `head` from the same
   commit bumps devkit-core's patch and edits devkit-core's `description` in both files and regenerates
   `docs/catalog.md`. On `train/t`: `node plugins/openspec/hooks/release-merge.mjs --merge <head sha> --json`, then
   `python3 scripts/gen-catalog.py --check` and `git show --stat HEAD`.
2. `--merge`, AC-3: the same with `train/t` also editing devkit-core's `description`: exit 2, then `git status
   --porcelain` and `git rev-parse HEAD`.
3. `--base`, AC-5: a branch with the description edit and an `origin/main` moved by `git update-ref
   refs/remotes/origin/main <a commit that bumps devkit-core>`; `node plugins/openspec/hooks/release-merge.mjs
   --base main --json`.

The commands and their outputs go to `openspec/changes/release-merge-manifest-fields/proof/real-run.txt`. The
clone names `devkit.release_tag`, but no `head` branch adds or changes a `release.md` since its merge base, so
`notedChangeOf` finds none and `--merge` takes the no-note path (`release-merge.mjs:674-681`). No fetch, no push.

## Risks / Trade-offs

- [ADR 0022 rejected "Resolve any join conflict automatically" (text merges no reviewer read would reach the
  base)] → the rule stays inside the release files ADR 0022 decision 8 already hands to `release-merge.mjs`; each
  kept value comes from one side, reviewed at its own head; a field both sides touched is refused, even with equal
  values. `decisions.md` records that no ADR is needed; the readiness review is asked to confirm.
- [ADR 0034 decision 8 says a no-note change joins "exactly as before"] → the decision keeps the old rule for
  no-note changes rather than removing it; this change narrows one refusal of that rule and keeps its abort
  contract. `decisions.md` states decision 8 is kept.
- [An added key lands at the end of its object, not where the change side put it] → accepted: key order is the
  base's, as `resolveManifest` already keeps; the catalog and the checkers read values, not order.
- [The whole-edit refusal now lists only the manifests with a whole edit, not every beyond-version manifest] →
  the error still starts with the old text and names the refused file; no test pins the list (D-9 grep).

## Migration Plan

None: no data or setting changes. Rollback is a revert of the change's commits; the docs and the code move
together.

## Implementation plan

Dependency order: the helper (D-1 to D-5), the caller (D-6), the tests (D-8), the docs (D-7), the real run
(D-10). One surface with code: `plugins/openspec` (devkit-openspec); plus repository docs. No frontend, no worker.

**File structure**

- Modify: `plugins/openspec/hooks/release-merge.mjs`, `plugins/openspec/hooks/release-merge.test.mjs`,
  `plugins/openspec/hooks/delivery-train.test.mjs`, `docs/openspec-flow.md`, `CONTRIBUTING.md`.
- Create: `openspec/changes/release-merge-manifest-fields/proof/real-run.txt`.
- Delete: none. `scripts/test-map.json` is unchanged: no script or test file is added or moved.

**Estimate**: optimistic 6 h, likely 9 h, pessimistic 14 h (the gate's selective part selects the test files
`scripts/test-map.json` maps `release-merge.mjs` to, most of them slow).

| Component | Hours | Type | Risk |
| --- | --- | --- | --- |
| D-1 to D-5 `mergeManifestFields`, `diffPaths` segments, `formatPath` | 2 | Core | LOW |
| D-6 the caller in `main`, `resolveVersions` without `beyond` | 1 | Core | MEDIUM |
| T1 to T6 pure tests | 1.5 | Testing | LOW |
| T7 to T9 `--base` tests, T8 rewrite | 1 | Testing | LOW |
| T11 to T15 `--merge` tests | 1.5 | Testing | MEDIUM |
| D-7 docs and T10 | 0.5 | Documentation | LOW |
| D-10 real run and proof file | 1 | Integration | MEDIUM |
| Gates (selective suite, check.py, gen-catalog, plugin validate) | 0.5 | Testing | MEDIUM |

**Risks (probability × impact)**

| Risk | P × I | Mitigation |
| --- | --- | --- |
| The `diffPaths` refactor changes a formatted path and breaks the noted path's `assignBlocking` | LOW × HIGH | `release-merge.test.mjs:77` and the noted-path tests stay green in the gate; `formatPath` is the only string builder |
| The whole-suite timing of the selective gate on a loaded machine times a test out | MEDIUM × MEDIUM | run the gate with `--concurrency=4`, alone on the machine, `TMPDIR=/var/tmp` (memory: Avell `/tmp` inodes) |
| A git-level conflict in a manifest leaves the change side's value unread | LOW × HIGH | the helper reads all three sides from revisions (`show`), never the working tree, and the step rewrites every changed manifest whether it conflicted or not (`:715`) |
| T11's gen stub diverges from the real generator | MEDIUM × LOW | the real run (D-10) runs the real `scripts/gen-catalog.py --check` |

**Assumptions** (each breaks the plan if wrong)

- The step is shared by `--base` and `--merge` with the sides swapped (`release-merge.mjs:684`, requirements
  assumption 1).
- `git merge --no-commit` has finished (with or without conflicts) before the version step reads revisions:
  the step reads `side.change`, `side.base` and `mergeBase` by `git show`, never the index (`:691-720`).
- `scripts/gen-catalog.py` reads `plugin.json` descriptions (`scripts/gen-catalog.py:89-90`).
- Nothing merged into `origin/main` since `6f03a57c` touches `release-merge.mjs` (checked at plan time; the
  sibling `test-map-hub-links` is not merged).

**Dependencies**: `delivery-train` (archived, `openspec/changes/archive/2026-11-24-delivery-train/`) delivers
`--merge`; `release-at-merge` (archived) delivers the noted path this change leaves alone; ADR 0036 delivers
`--own-files`.
