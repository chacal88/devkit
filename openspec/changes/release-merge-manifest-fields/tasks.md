<!-- devkit-stage tasks result=passed attempt=1 commit=4aa88a1ebea8213e62cdcfafa0b7b8257cf0867b -->
# Tasks

Change: `release-merge-manifest-fields` · Date: 2026-11-28 · Owner: Kaue (chacal88) · Base: `origin/main` at
`6f03a57c` (the branch was opened on it and has merged nothing yet) · PRD / tech spec: n/a (`proposal.md`,
`design.md`, `decisions.md`, `release.md`)

Work only in this change's worktree, on its branch. Every name, text, rule and test is in `design.md`: D-1 the
helper, D-2 the segment paths, D-3 the conflict rule, D-4 the whole edits, D-5 the merged text, D-6 the caller,
D-7 the texts, D-8 the tests, D-9 the pinned rules, D-10 the real run. The implementer copies them and makes no
design choice. The noted path (`numberRelease`, `assignBlocking`) and `manifestEditsBeyondVersion`'s output do
not change. The release follows the note rule (`proposal.md`, "Release rule"): no task bumps a version, edits a
`CHANGELOG.md` line, a CI pin line or `docs/catalog.md` of the repository, or numbers an ADR; the delivery
writes them at the merge from `release.md`. No script or test file is added or moved, so
`scripts/test-map.json` is not edited.

Test first in every task that adds a test: write it, run it red on the code before the task (a check of the
task, never a gate), then make it green. Every new test's name starts `release-merge-manifest-fields ` (D-8).
Before a test is changed, its commit message names its invariant, the layer that owns it and the suite it lives
in, as D-9 gives them (CLAUDE.md). Run tests with `TMPDIR=/var/tmp`. A filtered run is
`node scripts/test-suite.mjs --test-name-pattern="^release-merge-manifest-fields"` (no file argument). End
every task with `git status --short` showing only the task's files.

Every gate is one backticked command, run as written; the flow runs each `&&` part on its own. Both gates name
the same command. Run the selective part as a background command of the tool, never with a shell `&`, with no
other suite on the machine, and record the load (`uptime`) next to it.

| Id | Slug | Tasks |
|---|---|---|
| AC-1 | `head-only-field-kept` | 1.1, 1.3, 1.4, 2.2 |
| AC-2 | `train-only-field-kept` | 1.1, 1.3 |
| AC-3 | `both-sides-field-refused` | 1.1, 1.2, 1.3, 1.4, 2.2 |
| AC-4 | `disjoint-fields-merged` | 1.1, 1.3, 1.4 |
| AC-5 | `base-mode-same-rule` | 1.2, 1.4, 2.2 |
| AC-6 | `catalog-follows` | 1.3, 2.2 |
| AC-7 | `docs-say-the-rule` | 1.5 |

## 1. The field merge, its tests and its docs (phase 1)

- [x] 1.1 The pure helper (D-1 to D-5). In `plugins/openspec/hooks/release-merge.mjs`: `diffPaths` pushes
  segment arrays, a private `formatPath` builds today's strings, `manifestEditsBeyondVersion` maps through it,
  and the new export `mergeManifestFields({ mergeBase, change, base })` returns `{ edits, whole, both, text }`.
  Tests T1 to T6 in `plugins/openspec/hooks/release-merge.test.mjs` (import the new export beside
  `manifestEditsBeyondVersion` on `:10`). Check: T1 to T6 red before the helper exists, green after;
  `release-merge: manifestEditsBeyondVersion is empty for a version edit and names a description edit` (`:77`)
  green unchanged.
- [x] 1.2 The `--base` tests (T7, T8, T9) in `plugins/openspec/hooks/release-merge.test.mjs`. T8 replaces the
  test at `:246` (`release-merge: a manifest edited beyond its version aborts to oldHead`); its commit message
  names the D-9 row (invariant "a manifest the rule cannot resolve aborts to the old head", layer the `--base`
  CLI of `release-merge.mjs`, suite `release-merge.test.mjs`). T7 asserts exit 0, `resolved: true`, plugin `a`
  at the base's version plus the branch's bump in `plugin.json` and the marketplace entry, the branch's
  description in both, a merge commit whose parents are the old head and `origin/main`, and a clean tree. T8
  asserts the AC-3 outputs of D-8 (T13's list, with `HEAD` equal to the old head). T9 asserts exit 2 and an
  `error` starting `a manifest was edited beyond its version: .claude-plugin/marketplace.json (plugins[c])`.
  Check: T7 and T8 red on the code of 1.1 (T7 exits 2 there; T8's error text is absent), T9 green there
  too; all three green after 1.4; `release-merge: an invalid JSON manifest on the branch restores to
  oldHead with exit 2` (`:262`) green unchanged.
- [x] 1.3 The `--merge` tests (T11 to T15) in `plugins/openspec/hooks/delivery-train.test.mjs`, with
  `joinRepo` (`:191-214`) and the file's `MINOR` and `PATCH` constants, each as D-8 states. T11's `initial`
  adds a `scripts/gen-catalog.py` stub that writes one line per `plugins/*/.claude-plugin/plugin.json`
  (`<name>: <description>`) to `docs/catalog.md`, and asserts that line holds the head's description in the
  committed tree. T15 makes two repositories: the head adds pack `c` (refused, old text) and the train adds
  pack `c` while the head edits `a`'s description (exit 0, `c` kept, the head's description kept). Check: T11,
  T13, T14 and T15's second case red on the code of 1.1, T12 and T15's first case green there (named so in
  the commit message); all green after 1.4.
- [x] 1.4 The caller (D-6), which turns 1.2 and 1.3 green. In `plugins/openspec/hooks/release-merge.mjs`:
  `resolveVersions` returns `{ changed, versions }` (no `beyond`, no `manifestEditsBeyondVersion` call); the version step of `main`
  (`:712-720`) runs D-6 steps 1 to 4 in order, with the two error texts of D-7. `assignBlocking` (`:359`) is not
  touched. Check: `git diff origin/main -- plugins/openspec/hooks/release-merge.mjs` changes nothing between
  `export function assignBlocking` and the end of `numberRelease`; the filtered run is green, T7, T8, T11, T13,
  T14 and T15 included.
- [x] 1.5 The docs (D-7) and T10. Edit `docs/openspec-flow.md` ("Classification", "The version rule", "A join
  that conflicts") and `CONTRIBUTING.md` step 5 with the D-7 texts, every other sentence byte for byte; add T10
  to `plugins/openspec/hooks/release-merge.test.mjs`. Grep before the edit for each replaced phrase in
  `plugins/**/*.test.mjs` and `scripts/` (D-9 lists the hits at plan time) and keep the pinned parts:
  `release-note.test.mjs:979-985`, `delivery-train-after.test.mjs:786-792`,
  `deliver-check-archive.test.mjs:1250`. Do not touch a pin line of `docs/openspec-flow.md`. Check: T10 red
  before the edit, green after; `python3 scripts/check.py` passes; the three pinning files run green in 1.6
  (`scripts/test-map.json` maps `plugins/openspec/hooks/release-merge.mjs` to each of them).
- [x] 1.6 Gate: `node scripts/test-suite.mjs --own-files --concurrency=4 && python3 scripts/check.py` green
  (AC-1 to AC-5 in fixtures, AC-6 in fixture, AC-7).

## 2. The real run and the delivery checks (phase 2)

- [x] 2.1 Conductor: merge `origin/main` into the branch, the last merge before review (fetch first, then
  `git merge origin/main`). Re-read every `file:line` anchor and helper name `design.md` cites
  (`release-merge.mjs` `resolveVersions`, `diffPaths`, `main`'s version step, `assignBlocking`;
  `train-loop.mjs` `pathsDetail`, `build`; the D-9 test lines). If the merge moved or renamed one, the same
  commit edits `proposal.md`, `design.md` and `tasks.md` (CLAUDE.md); if it joined a rule of the base with this
  change's rule, a test for each side lands before review. Check: `git log -1 --format=%P` shows two parents
  (or the branch already held `origin/main`), and `git status --short` is empty.
- [x] 2.2 Conductor: the real run (D-10), its three cases. First check the session can delete
  `/var/tmp/devkit-rmmf` (create and remove an empty folder there), then clone, run cases 1 to 3, and write
  `openspec/changes/release-merge-manifest-fields/proof/real-run.txt` with each command, its exit code and its
  output (`--json` output whole). Remove `/var/tmp/devkit-rmmf` afterwards. Check: case 1 exits 0 with
  `"resolved": true`, devkit-core's description kept in both manifests and `gen-catalog.py --check` exit 0
  (AC-1, AC-6); case 2 exits 2 with an `error` starting `a manifest field was edited on both sides:` naming
  `plugins/core/.claude-plugin/plugin.json` and a clean tree (AC-3); case 3 exits 0 with the description kept
  (AC-5).
- [x] 2.3 The repository checks after 2.1. Check: `python3 scripts/gen-catalog.py --check`,
  `node plugins/compozy/kit/scripts/gen-agents.mjs --check`, `claude plugin validate .` and
  `openspec validate release-merge-manifest-fields --strict` exit 0;
  `git diff --name-only origin/main...HEAD -- CHANGELOG.md .claude-plugin/marketplace.json 'plugins/*/.claude-plugin/plugin.json' docs/catalog.md`
  prints nothing; `release.md` is unchanged since the plan's approval.
- [x] 2.4 Gate: `node scripts/test-suite.mjs --own-files --concurrency=4 && python3 scripts/check.py` green
  after 2.1's merge (AC-1 to AC-7). The pr-verifier writes the selective part as its own `pass` row with the
  run's `selected` lines and its `suite:` line (CLAUDE.md).

## Workflow follow-up

- The delivery's `assign-release` step (or the train's join) writes this change's release from `release.md`;
  no task does it.
- Pull request 148's change (project-setup, archived) is not re-delivered by this change; a later
  description edit rides the train under the new rule.
