# Design

Change: `release-rebase-pin` · Date: 2026-11-11 · Owner: Kaue (chacal88) · PRD / tech spec: n/a

## Context

The motivation is in proposal.md, under Why. This design builds on these pieces of devkit-openspec 0.10.3:

- `plugins/openspec/hooks/conduct-check.mjs`. `conflictedPaths` (line 366) runs
  `git merge-tree --write-tree --name-only --no-messages <ref> HEAD` and returns `{ paths }`,
  `{ clean: true }` or `{ error: true }`. `releaseConflict` (line 377) is override 1. On
  `blocked` item 5 with `conflict: true`, or on `stop-archive` at `archive-pr` with
  `conflict: true`, it keeps the paths that do not match `RELEASE_FILE` (`others`) and returns
  `blocked: item 5 (conflict in <others>)` /
  `blocked: archive (archive-pr): conflict in <others>`, or `resolve-release-conflict` with
  `number`, `paths` (sorted), `base` and
  `command: ['node', RELEASE_REBASE, '--base', <base>, '--json']`. `deliveryRow` (line 403) runs it
  after `rewrittenBranch`. The file header says the checker "never writes files, refs or GitHub
  objects".
- `plugins/openspec/hooks/release-rebase.mjs`. `main` (line 195) runs `git rebase origin/<base>`.
  At every stop (lines 219-230) it lists `git diff --name-only --diff-filter=U`, aborts through
  `unresolved({ conflicts })` when any path fails `RELEASE_FILE` (or on a catalog conflict without
  `scripts/gen-catalog.py`), and otherwise runs `checkout --ours` + `add` on each path and
  `rebase --continue`. After the replay (lines 232-256), `resolveVersions` (line 155, which reads
  only revisions) gives `{ changed, versions: { packs: { <name>: v }, metadata }, beyond }`. The
  manifests and CHANGELOG are then rewritten in the worktree, `gen-catalog.py` runs, and the
  rewritten paths are collected in `files` (an alias of `written`, so `restore` checks them out on
  a later failure). Any throw becomes `unresolved({ conflicts: [], error })`. Exit 0 / 2 / 3.
- `plugins/openspec/hooks/deliver-check.mjs`. `RELEASE_FILE` (line 755) is shared by
  `unnamedFiles` (line 759), which is ADR 0003's exemption for archive PRs, and by both callers
  above. It does not change.
- The pin: `docs/openspec-flow.md` lines 460, 461 and 468 (the snippet comment, the raw URL, and
  the prose line with two pins). The test at `deliver-check.test.mjs:3031` ties the URL pin to
  `plugins/openspec/.claude-plugin/plugin.json`'s version.
- Tests: `release-rebase.test.mjs` has `releaseRepo` (line 129), a bare origin and a clone on
  `feature` with one commit per side, which bumps packs through `bump` (line 118);
  `conduct-check.test.mjs` has `conflictRepo` (line 613) and `archiveRepo` (line 765);
  `guard.test.mjs` imports all three test files.

## Goals / Non-Goals

**Goals:**

- One predicate, exported once and tested once, decides "only the pin". `conduct-check` (before
  any rebase) and `release-rebase.mjs` (at every stop) call the same function and differ only in
  where they read the three versions.
- The replay rule stays as it is: the rebased commits carry the base's side, and the change's
  final values sit uncommitted in the worktree. The pin follows the same rule.
- No new JSON field, and no change to `RELEASE_FILE` or ADR 0003.

**Non-Goals:**

- A general text merge for other files, a configurable file list, or pre-release tags
  (`v1.2.3-rc1`) as pins.
- Any change to `ship-change`, the conduct skill or `deliver-check`'s own steps.

## Decisions

### D1. The rule lives in `release-rebase.mjs`, exported

New exports in `plugins/openspec/hooks/release-rebase.mjs`, next to the existing pure functions
(section `// ---- the CI pin`):

```text
PIN_FILE      = 'docs/openspec-flow.md'
PIN_PACK      = 'plugins/openspec/.claude-plugin/plugin.json'
PIN_PACK_NAME = 'devkit-openspec'
setPins(text, version)                 -> text
mergePins({ base, ours, theirs })      -> masked merged text | null
classifyConflict(paths, stagesOf)      -> { blocking: string[], pinMerged: string | null }
```

`conduct-check.mjs` imports `classifyConflict` and `PIN_FILE` from `./release-rebase.mjs`. The
import is safe: that module runs `main` only when it is the process entry (line 263), and it
already imports only `deliver-check.mjs`, which `conduct-check` imports as well. No cycle.

Alternatives: (a) put the rule in `deliver-check.mjs` beside `RELEASE_FILE`. Rejected: the owner
asked for a rule separate from the release list ("Regra separada"); `deliver-check` is the module
CI downloads; and it would make the CI checker spawn `git merge-file` for no CI use. (b) A new
module `release-pin.mjs`. Rejected: it adds one more file to the hooks folder for about 50 lines
that belong with the other release rules, and `release-rebase.mjs` is already the module that
holds the release resolution rules.

### D2. Pin lines and pins

- A pin line is a line (split on `\n`; a trailing `\r` stays with its line) that matches
  `/pinned to the commit of v|<commit sha of v|git\/ref\/tags\/v|\(`v\d+\.\d+\.\d+` above\)/`.
- A pin is every match of `/(?<![A-Za-z0-9])v\d+\.\d+\.\d+(?!\d)/g` on a pin line. So `v0.10.3.`
  at the end of a sentence is a pin, and so is the second pin of line 468.
- A pin line may hold no pin: the docs name the markers literally (D9), and such a line has
  nothing for `setPins` to replace, so it stays byte for byte. The real-file smoke test (task 1.1)
  counts only the pin lines that hold a pin, and requires all of them to be inside `## CI`.
- `setPins(text, version)` replaces every pin on every pin line with `v<version>`, leaves every
  other byte as it is, and is idempotent. Masking is `setPins(text, MASK)` with
  `MASK = '0.0.0'`, so the same function masks, fills and rewrites. A masked merge result that
  holds `v0.0.0` is filled by one more `setPins` call.

Alternative: a placeholder token that is not a semver (`v{pin}`). Rejected: it needs a second
replace function, and a placeholder left behind by a bug would be harder to spot than a wrong
version, which the existing pin test catches.

### D3. The masked merge

`mergePins({ base, ours, theirs })` returns `null` when any side is `null` (the file was added or
deleted on one side). Otherwise it writes `setPins(side, MASK)` for the three sides into a
`mkdtempSync(join(tmpdir(), 'devkit-pin-'))` folder, runs
`spawnSync('git', ['merge-file', '-p', ours, base, theirs])` (no repository needed; checked on
git 2.50) and removes the folder in a `finally`. Exit 0 returns stdout, the merged text with its
pins at `v0.0.0`. Any other status (≥ 1 conflicts, or an error) returns `null`.

`git merge-file` treats edits on adjacent lines as one conflicting hunk. An edit right next to a
pin line on one side and a pin move on the other still merge, because the masked pin lines are
equal. Two edits to the same or adjacent prose lines are "beyond the pin". This is deliberately
conservative, and the tests use paragraph and section edits separated by unchanged lines.

### D4. One classification for both callers

`classifyConflict(paths, stagesOf)`:

- each path that matches `RELEASE_FILE` is resolvable (today's rule);
- `PIN_FILE` is resolvable when `mergePins(stagesOf(PIN_FILE))` is not `null`, and that text is
  `pinMerged`;
- every other path, and `PIN_FILE` when the masked merge fails, goes into `blocking`, in the
  order of `paths`.

`stagesOf` is called at most once, and only for `PIN_FILE`. A conflict in `PIN_FILE` alone, with
no release file, is resolvable too: the rule is about the file, not about which release files
came with it.

The callers differ only in `stagesOf`:

| caller | `base` | `ours` | `theirs` |
|---|---|---|---|
| `conduct-check` (before any rebase) | `git show <mb>:docs/openspec-flow.md`, `<mb>` = `git merge-base <ref> HEAD` | `git show <ref>:...` | `git show HEAD:...` |
| `release-rebase.mjs` (at a stop) | `git show :1:docs/openspec-flow.md` | `:2:` (the upstream being rebased onto) | `:3:` (the change's commit) |

A missing blob is `null`, so the merge returns `null` and the file is blocking.

### D5. `conduct-check`: `releaseConflict` through the shared function

In `releaseConflict`, replace `found.paths.filter((p) => !RELEASE_FILE.test(p))` with
`classifyConflict(found.paths, (p) => threeVersions(row.worktree, ctx.ref, p)).blocking`.
`threeVersions` is a local helper that reads the first row of the table above with the existing
`git` / `gitOk` helpers; a failing `git show` gives `null`. Everything else stays as it is:

- the blocked texts keep their exact shape, so AC-2 reads `blocked: item 5 (conflict in docs/openspec-flow.md)` and AC-3 reads `blocked: archive (archive-pr): conflict in docs/openspec-flow.md`;
- `resolve-release-conflict` keeps `number`, `paths` (sorted, `docs/openspec-flow.md` included),
  `base` and `command`. When `paths` holds `PIN_FILE`, its `reason` reads
  `the PR conflicts only in release files and the CI pin: <paths>`; otherwise it stays
  `the PR conflicts only in release files: <paths>`.
- The header comment becomes "never writes files in the repository, refs or GitHub objects (the
  CI-pin check merges in a temporary folder it removes)".

Line 392 is `conduct-check`'s only use of `RELEASE_FILE`, so the `./deliver-check.mjs` import
drops it, and the release list is read only through `classifyConflict`.

### D6. `release-rebase.mjs` at every stop

Inside the stop loop, after `conflicts` is listed:

1. `const { blocking, pinMerged } = classifyConflict(conflicts, stageReader(root))`.
2. When `blocking.length`, or on the catalog conflict without `gen-catalog.py`:
   `unresolved({ conflicts })`, today's call and shape, with `conflicts` listing every conflicted
   path (AC-5).
3. For each conflicted release path: `checkout --ours` + `add`, as today.
4. When `PIN_FILE` is conflicted: if `baseVersion` is `null`, call
   `unresolved({ conflicts, error: 'cannot set the pin: origin/<base> has no devkit-openspec version in plugins/openspec/.claude-plugin/plugin.json' })`.
   Otherwise write `setPins(pinMerged, baseVersion)` to the worktree file and `git add` it; a
   failing write or add gives `unresolved({ conflicts, error: 'cannot keep the merged pin file docs/openspec-flow.md' })`.
5. `rebase --continue`, as today.

`baseVersion` is read once before the loop: the `version` of `show(root, ref, PIN_PACK)` when its
`name` is `PIN_PACK_NAME`, else `null`. A malformed `PIN_PACK` at the base is `null`; it is never
thrown before the replay. The rebased commit therefore holds the merged text with the base's
version, as the replay keeps the base side of every release file. The change's own value arrives
in step D7, uncommitted (AC-4: "the edit is uncommitted").

Alternative: fill the stop's merge with the final resolved version, computed before the replay
(`resolveVersions` reads only revisions). Rejected: the rebased commit would already hold the
final pin, so D7's rewrite would leave nothing uncommitted, contradicting AC-4 and the documented
rule "The edits stay uncommitted". It would also move `resolveVersions` and its errors before the
replay.

### D7. After the replay: the pin follows the resolved version

After the manifests and CHANGELOG, and before `gen-catalog.py`:

```text
pinVersion = versions.packs[PIN_PACK_NAME] ?? baseVersion
if pinVersion && existsSync(join(root, PIN_FILE)):
  write setPins(read(PIN_FILE), pinVersion); files.push(PIN_FILE)
```

- It runs whether or not the file conflicted (AC-6), and the file is listed even when the rewrite
  changes no byte (the owner's "Sim, sempre segue a versão"; it keeps `files` predictable).
- `files` is `written`, so a later failure (`gen-catalog.py`) checks the file out before
  `reset --keep`, as for the manifests.
- A project with no `PIN_PACK` named `devkit-openspec` on either side gets no rewrite, and the
  file is not in `files`. The masked merge at a stop still applies there, and a stop that needs a
  version aborts with `cannot set the pin:` (D6.4).
- The early return "already on origin/<base>: nothing to do" is unchanged: no replay, no rewrite.

### D8. Contract and error prefixes

No field is added to either JSON. The contract changes in which inputs reach each outcome:

| input | `conduct-check` | `release-rebase.mjs` |
|---|---|---|
| release files + pin-only `docs/openspec-flow.md` | `resolve-release-conflict`, the file in `paths` | exit 0, the file in `files` |
| `docs/openspec-flow.md` beyond the pin | `blocked: item 5 (conflict in docs/openspec-flow.md)` / `blocked: archive (archive-pr): conflict in docs/openspec-flow.md` | exit 2, `conflicts` names it, no `error` |
| a pin conflict where the base has no devkit-openspec version | `resolve-release-conflict` (the checker does not read versions) | exit 2, `error` starts `cannot set the pin:` |
| no conflict in the file, devkit-openspec resolved | unchanged | the file in `files`, every pin at the resolved version |

"Beyond the pin" deliberately has no prefix of its own. The caller does the same thing as for any
other conflicting path (the owner resolves by hand), so it keeps the shape `conflicts` already
has. `cannot set the pin:` is new and distinct from `cannot keep the base's side of`,
`cannot place the CHANGELOG entry:` and `a manifest was edited beyond its version:`, because its
fix is different (the base lacks the pack manifest).

### D9. Release and docs

- `docs/openspec-flow.md`:
  - The "Release-file conflict" override bullet (line 198) gains one sentence: a conflict in
    `docs/openspec-flow.md` counts as a release conflict when its only conflict is the CI pin (the
    three versions, pins masked, merge cleanly with `git merge-file -p`), and any other conflict in
    it is blocked like any other path.
  - The "Classification" bullet (line 204) defines pin lines, pins, the masked merge, the per-stop
    repeat, and the abort beyond the pin.
  - "The replay keeps the base" gains a clause: the merged pin file takes the base's
    devkit-openspec version at the stop.
  - "The edits stay uncommitted" names the pin rewrite: every pin is set to the resolved
    devkit-openspec version after every replay, whether or not the file conflicted.
  - The new prose may write the markers literally (the "Classification" bullet defines them),
    but must not put a `v<digits>.<digits>.<digits>` token, the mask `v0.0.0` included, on a line
    that holds a marker (write `v<version>`). Each bullet is one line. The smoke test of task 1.1
    enforces this: the lines `setPins` changes must be exactly the pin lines that hold a pin, all
    inside `## CI`; a marker line with no pin is not counted. Task 1.5's verify reruns it.
- `plugins/openspec/README.md`, the `hooks/release-rebase.mjs` row: "... and the CI pin in
  `docs/openspec-flow.md` ...".
- Release: devkit-openspec 0.11.0 in `plugins/openspec/.claude-plugin/plugin.json` and its
  `marketplace.json` entry; marketplace `metadata.version` 0.12.0 (`scripts/check.py`
  `check_changelog` requires a `## 0.12.0` heading); CHANGELOG `## 0.12.0 — release-rebase pin`.
  The pin moves to `v0.11.0` by running the new `setPins` on the real file, so the new code
  runs once on real input before the gate.

### D10. No ADR

ADR 0003's exemption list (the version manifests, CHANGELOG, the generated catalog) is
`RELEASE_FILE`, and it does not change: an archive PR that changes `docs/openspec-flow.md` still
needs an approved retro proposal naming it (AC-7). The pin rule only widens what the rebase
resolves, not what merges without a proposal. ADR 0002 already accepts that every review is stale
after a rebase. ADR 0001 holds: `conduct-check` still drives nothing. No decision is superseded or
added.

## Risks / Trade-offs

| Risk | P × I | Mitigation |
|---|---|---|
| New prose in `docs/openspec-flow.md` (this change's or a later one's) puts a semver on a marker line, so `setPins` rewrites prose | MEDIUM × MEDIUM | The smoke test runs `setPins` on the real file and asserts that the changed lines are exactly the pin lines that hold a pin, all inside the `## CI` section (a marker line with no pin, as in the docs that define the markers, is not counted); D9 tells authors to write `v<version>` |
| The whole-branch classification (one merge base) says pin-only, but a single replayed commit conflicts beyond the pin | LOW × LOW | The script repeats the check at every stop and exits 2 with the old head restored; the owner resolves by hand, as today |
| Criss-cross history: `git merge-base` picks one base while `merge-tree` used a virtual one | LOW × LOW | Same as above: the per-stop check decides; worst case is exit 2, never a wrong merge |
| `git merge-file` calls adjacent-line edits a conflict | MEDIUM × LOW | Conservative by design (blocked, as today); tests document it |
| An archive PR whose approved proposal bumps devkit-openspec gets a pin rewrite that `unnamedFiles` flags when no proposal names the doc | MEDIUM × LOW | Intended (ADR 0003 unchanged, AC-7); the retro practice of naming `docs/openspec-flow.md` with a pack bump stays; the docs say it |
| `conduct-check` now writes temporary files | LOW × LOW | Under `os.tmpdir()`, removed in `finally`; a test asserts the worktree's `git status --porcelain` and HEAD are unchanged after classification |
| Another project has its own `docs/openspec-flow.md` with marker text | LOW × LOW | The rewrite needs `plugins/openspec/.claude-plugin/plugin.json` named `devkit-openspec` (D7); a test pins "no pack, no rewrite" |
| The npm `claude` on PATH (2.1.227) fails `claude plugin validate .` already on base 94e795d: it rejects the devkit-panel manifest (`userConfig.language: Unrecognized key: "options"`), so a bare `claude` in 2.3 or gate 2.9 goes red for a reason outside this change | HIGH × MEDIUM | 2.3 and 2.9 name the desktop app's bundled Claude Code by absolute path inside the command (CONTRIBUTING.md "Testing a mod pack"), which passes; the npm CLI's rejection of the panel manifest is out of scope here |

## Migration Plan

Nothing to migrate: no stored state, no new field. Installed projects get the rule with
`claude plugin update devkit-openspec@devkit`. Rollback: revert the squash commit. Changes already
rebased under the rule keep their history, and the next pack bump moves the pin by hand, as
before.

## Implementation plan

Dependency order: the pure rule → `release-rebase.mjs` → `conduct-check.mjs` → docs → release.

**Per surface** (one surface, the `devkit-openspec` pack, plus repository docs and release files):

- Hooks: D1-D7 in `release-rebase.mjs` and `conduct-check.mjs`; no change to `deliver-check.mjs`
  or `guard.mjs`.
- Docs: D9.
- Release: D9.

**File structure:**

| action | path |
|---|---|
| modify | `plugins/openspec/hooks/release-rebase.mjs` (exports of D1-D4, stop loop D6, post-replay D7) |
| modify | `plugins/openspec/hooks/conduct-check.mjs` (`releaseConflict`, a `threeVersions` helper, the header comment, the import) |
| modify | `plugins/openspec/hooks/release-rebase.test.mjs` (unit tests, the real-file smoke test, CLI tests; `releaseRepo` gains an `initial` option for files in the first commit) |
| modify | `plugins/openspec/hooks/conduct-check.test.mjs` (change-PR and archive-PR pin cases) |
| modify | `plugins/openspec/hooks/deliver-check.test.mjs` (the AC-7 pin of `RELEASE_FILE` and `unnamedFiles`) |
| modify | `docs/openspec-flow.md`, `plugins/openspec/README.md`, `plugins/openspec/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `CHANGELOG.md` |
| create / delete | none |

**Estimate:** optimistic 4 h, likely 6 h, pessimistic 10 h. The pessimistic case comes from
fixture friction: getting both rebase fixtures to stop on the doc as AC-4 and AC-5 describe, and a
full suite run of about 9 minutes per gate (8.7 observed on `94e795d`).

| Component | Hours | Type | Risk |
|---|---|---|---|
| `setPins`, `mergePins`, `classifyConflict` + unit tests + real-file smoke | 1.5 | Core | LOW |
| `release-rebase.mjs` stop loop and post-replay rewrite + CLI tests (AC-4, AC-5, AC-6, `cannot set the pin:`, no pack) | 2 | Core | MEDIUM |
| `conduct-check.mjs` `releaseConflict` + tests (AC-1, AC-2, AC-3) | 1 | Integration | LOW |
| AC-7 test in `deliver-check.test.mjs` | 0.25 | Testing | LOW |
| Docs (`openspec-flow.md` bullets, README row) | 0.5 | Documentation | LOW |
| Release (bump, CHANGELOG, pin via `setPins`, gates) | 0.75 | Documentation | LOW |

**Assumptions** (each one is where the plan breaks if reality differs):

- `git merge-file -p` works outside a repository and exits 0 on a clean merge, 1 on one conflict
  (checked on git 2.50.1 during planning).
- `git show :1:/:2:/:3:<path>` gives the index stages at a rebase stop, with `:2:` the upstream
  (git's documented rebase semantics; `release-rebase.mjs` line 225 already relies on `--ours`
  being the base).
- A pack's `plugin.json` that changes between the merge base and the old head shows up in
  `versions.packs` under its `name` (`resolveVersions`, line 164).
- `node --test --test-name-pattern` filters the tests that imported test modules register
  (Node's test runner; `conduct-check.test.mjs` imports `deliver-check.test.mjs`).

**Dependencies:** none outstanding. The behaviour this builds on shipped in conduct-rounds
(`release-rebase.mjs`, design D11) and conduct-one-change (`conduct-check` 0.10.x); the roadmap
line is in `openspec/roadmap.md` round 8.

## Open Questions

None.
