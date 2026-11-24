# Real-run proof: release-at-merge (tasks 6.1 to 6.6)

Every case below ran for real, on 2026-11-24, against this worktree's own scripts (`$DEV` is
`plugins/openspec/hooks` of the worktree `$WT`; never the installed plugin), in scratch repositories under a private `TMPDIR`
(`$TMPDIR` is `/var/tmp/devkit-release-at-merge`, `$CASES` is `$TMPDIR/devkit-proof-release-at-merge`, removed after the run).
Each block is one command as it ran, the folder it ran in, its whole output and its exit code; a block that starts with a list of
`deliver-check ... --json -> next: ...` lines is the drive of a change to its release rows: one line per check (its `met` count and
`next`), then what the session did for that step (the implementer's code and ticks, the gate, the commit, the evidence, the approved
reviews, the push and the pull request). The scripts are kept beside this file, so the proof can be run again:

    TMPDIR=/var/tmp/devkit-release-at-merge node openspec/changes/release-at-merge/proof/cases.mjs

The first runs of P-1 found two defects in `deliver-check.mjs`, each fixed test-first (a failing test, then the fix) before every
case below was run again:

- A changelog body that cites an ADR (`(ADR [feat])`): the step rewrites the citation in `CHANGELOG.md` like in any tracked text,
  but `releaseStateAt` compared the changelog with the unrewritten entry, so right after the step the change read as "release lines
  edited by hand: CHANGELOG.md" and the step refused to run again. The state now compares the changelog with the head's ADR numbers
  masked, and the note's title and body count as cited text, so a citation of another change's record there is rewritten once it
  landed and refused while it has not (tests "release-note AC-2 state: a changelog body that cites ..." and "release-note AC-7
  citation: a changelog body that cites another change's ADR that has not landed ..." in `release-note.test.mjs`).
- The step run again after the base numbered another record renumbers the change's own record (0002 to 0003) and its citations, but
  `releaseOnlyEdit` accepted only an unnumbered record turned numbered, and masked both sides with the later revision's numbers (where
  0002 is the other record), so the evidence and the reviews went stale. Each side is now masked with the records it holds, and a
  record renumbered from its former number is a release edit too (tests "release-note AC-4 staleness: the step run again after the base
  numbered another ADR ..." and its guard "release-note AC-5 staleness: a citation of the change's own record moved to another
  record's number ..." in `deliver-check.test.mjs`).

## How the seed is built

`proof/seed.mjs` builds every project the same way (`seedProject`): a bare `origin.git`, a main checkout `main` with this worktree's
schemas copied to `openspec/schemas`, one commit pushed to `origin/main` (`origin/HEAD` set), and a `gh` stub first on `PATH`. The
release layout is a two-pack marketplace at 1.0.0: `plugins/openspec/.claude-plugin/plugin.json` (devkit-openspec, the file
`devkit.release_tag` names, as in this repository), `plugins/core/.claude-plugin/plugin.json` (devkit-core), `.claude-plugin/marketplace.json`
(`metadata.version` and both packs), `CHANGELOG.md`, `docs/openspec-flow.md` with the three CI pin-marker lines of this repository's
flow page, `docs/catalog.md` with a stand-in `scripts/gen-catalog.py` that lists each pack's version (so a release visibly moves the
catalog), `docs/adr/0001-start.md` and `docs/guide.md`, where changes cite their records. A change is opened with
`openChange`: a worktree `.claude/worktrees/<id>` on branch `<id>` from `origin/main`, its plan committed (proposal, tasks with
one code task and one gate, and for schema `devkit` an APPROVED readiness verdict and `approval.md` written as the `ship-change`
row writes it, with `- Release note: sha256:<12 hex>` when the change has `release.md`), its note, its unnumbered ADRs listed in
`decisions.md` and the files the case names. The consumer projects of P-4 and P-5 and the project of P-11's marketplace variant
replace the layout with their own files, named in their case.

The `gh` stub (`GH_STUB` in `seed.mjs`) never calls GitHub: it answers from the JSON file `gh/state.json` of the project
(`DEVKIT_PROOF_GH`), where the case's `gh pr create` writes each pull request, and reads heads and bases live from the bare origin, so
a push moves a pull request as on GitHub. `mergeable` comes from `git merge-tree`; `mergeStateStatus` is DIRTY on a conflict,
BEHIND when the base tip is not in the head, else CLEAN; the required checks `check` and `devkit-reviews` answer green (the
`defaultChecks` of the JSON file). `gh pr merge --auto` records auto-merge; `gh __merge <n>` stands for GitHub merging a pull request
once its rules pass (a commit in the origin, by the auto-merge method when one is on) and, as GitHub does, marks every other open pull request whose head the new base
holds as merged by that commit. The release reads of ADR 0019 (`pulls/<n>`, `git/commits/<sha>`, `git/ref/tags/<tag>`, contents at
a commit) are answered from the origin. The seed project, as built:

```text
(in $CASES/seed/main)
$ cat openspec/config.yaml
schema: devkit
ship:
  devkit: merge
  devkit-lite: merge
devkit:
  release_tag: plugins/openspec/.claude-plugin/plugin.json
[exit 0]
```

```text
(in $CASES/seed/main)
$ git ls-files -- . ':(exclude)openspec/schemas'
.claude-plugin/marketplace.json
.github/workflows/devkit-reviews.yml
.gitignore
CHANGELOG.md
docs/adr/0001-start.md
docs/catalog.md
docs/guide.md
docs/openspec-flow.md
openspec/config.yaml
plugins/core/.claude-plugin/plugin.json
plugins/core/README.md
plugins/openspec/.claude-plugin/plugin.json
plugins/openspec/hooks/flow.mjs
scripts/gen-catalog.py
src/app.ts
[exit 0]
```

```text
(in $CASES/seed/main)
$ git ls-tree -d --name-only HEAD openspec/schemas/
openspec/schemas/devkit-lite
openspec/schemas/devkit-project
openspec/schemas/devkit
[exit 0]
```

```text
(in $CASES/seed/main)
$ cat plugins/openspec/.claude-plugin/plugin.json .claude-plugin/marketplace.json CHANGELOG.md docs/catalog.md
{
  "name": "devkit-openspec",
  "version": "1.0.0",
  "description": "the devkit-openspec pack"
}
{
  "name": "devkit",
  "metadata": {
    "description": "two packs",
    "version": "1.0.0"
  },
  "plugins": [
    {
      "name": "devkit-openspec",
      "source": "./plugins/openspec",
      "description": "the devkit-openspec pack",
      "version": "1.0.0"
    },
    {
      "name": "devkit-core",
      "source": "./plugins/core",
      "description": "the devkit-core pack",
      "version": "1.0.0"
    }
  ]
}
# Changelog

## 1.0.0 — first release

- **devkit-openspec** 1.0.0: the flow
- **devkit-core** 1.0.0: the agents
# Catalog

| Pack | Version |
|---|---|
| devkit-core | 1.0.0 |
| devkit-openspec | 1.0.0 |
[exit 0]
```

```text
(in $CASES/seed/main)
$ grep -n v1.0.0 docs/openspec-flow.md
15:          # pinned to the commit of v1.0.0 (a tag can move; a commit cannot)
16:          base=https://raw.githubusercontent.com/o/devkit/<commit sha of v1.0.0>/plugins/openspec/hooks
22:Pin the commit sha of the release tag (`v1.0.0` above), not the tag; by hand, run `gh api repos/o/devkit/git/ref/tags/v1.0.0`.
[exit 0]
```

```text
(in $CASES/seed/main)
$ git ls-remote origin
095da02b4735ac90923934e156f054149ceffe06	HEAD
095da02b4735ac90923934e156f054149ceffe06	refs/heads/main
[exit 0]
```

```text
(in $CASES/seed/main)
$ gh --version
gh version 2.81.0 (devkit proof stub)
[exit 0]
```

```text
(in $CASES/seed/main)
$ gh api 'repos/{owner}/{repo}'
{"default_branch":"main","allow_auto_merge":true,"allow_squash_merge":true,"allow_merge_commit":true,"allow_rebase_merge":true}[exit 0]
```

```text
(in $CASES/seed/main)
$ cat $CASES/seed/gh/state.json
{
  "origin": "$CASES/seed/origin.git",
  "defaultBranch": "main",
  "next": 10,
  "prs": [],
  "checks": {},
  "defaultChecks": [
    {
      "name": "check",
      "state": "SUCCESS",
      "bucket": "pass",
      "link": "https://ci.invalid/check"
    },
    {
      "name": "devkit-reviews",
      "state": "SUCCESS",
      "bucket": "pass",
      "link": "https://ci.invalid/devkit-reviews"
    }
  ]
}
[exit 0]
```

## P-1 single merge in merge mode: a noted change with an ADR and citations, and a sibling that merges first

AC-4, AC-5. Project `p1` (the seed, `ship: merge`). Change `feat` notes devkit-openspec `minor` and devkit-core `patch`, names its
record `docs/adr/feat.md` (listed in `decisions.md`) and cites it `ADR [feat]` in `docs/guide.md` (with a link `adr/feat.md`), in the
prose of `docs/openspec-flow.md` (the file of the CI pins) and in its changelog body. Its sibling `sib` notes devkit-openspec `patch`
with its own record `docs/adr/sib.md` cited in `docs/sib.md` (no file of `feat`'s own: a base edit to one of them would stale `feat`'s records by ADR 0025, as it should). Both are approved `devkit` changes whose
`approval.md` records the note's hash.

The plan of `feat` as committed on its branch (the note, the record, the decisions and the approval):

```text
(in $CASES/p1/main/.claude/worktrees/feat)
$ git show --stat '--format=%h %s' HEAD -- . ':(exclude)openspec/changes/feat/proposal.md'
494f7ae docs(feat): the plan of feat

 docs/adr/feat.md                     |  6 ++++++
 docs/guide.md                        |  2 +-
 docs/openspec-flow.md                |  2 +-
 openspec/changes/feat/.openspec.yaml |  1 +
 openspec/changes/feat/approval.md    |  8 ++++++++
 openspec/changes/feat/decisions.md   |  3 +++
 openspec/changes/feat/readiness.md   |  3 +++
 openspec/changes/feat/release.md     | 10 ++++++++++
 openspec/changes/feat/tasks.md       |  6 ++++++
 9 files changed, 39 insertions(+), 2 deletions(-)
[exit 0]
```

```text
(in $CASES/p1/main/.claude/worktrees/feat)
$ cat openspec/changes/feat/release.md openspec/changes/feat/decisions.md openspec/changes/feat/approval.md
# Release note

packs:
- devkit-openspec: minor
- devkit-core: patch

## the feature lands

- **devkit-openspec**: the flow does the feature (ADR [feat])
- **devkit-core**: the agents follow it
# Decisions and ADRs

- ADR: `docs/adr/feat.md` — the record of feat
<!-- devkit-stage approval result=passed attempt=1 commit=3af213729adcee4ecd1eef425bdac14b44994638 -->
# Plan approval: feat

- Status: APPROVED
- Readiness: sha256:e4fcd4435e03
- Release note: sha256:acfd82d74f4a
- Date: 2026-11-24
- Owner's words: "`Aprovo`"
[exit 0]
```

The session drives `feat` through its tasks, evidence, reviews and pull request until the checker asks for the release step:

```text
(in $CASES/p1/main/.claude/worktrees/feat)
$ node $DEV/deliver-check.mjs feat --json   -> 1/8, next: implement (phase 1 has unticked tasks: 1.1)
    did: wrote src/feat-1.ts; ticked 1.1
$ node $DEV/deliver-check.mjs feat --json   -> 1/8, next: gate (phase 1 is implemented; run its gate 1.2)
    did: ran `node -e 0` (exit 0); ticked 1.2
$ node $DEV/deliver-check.mjs feat --json   -> 1/8, next: commit (uncommitted changes outside openspec/: src/feat-1.ts)
    did: git commit: 99998a1
$ node $DEV/deliver-check.mjs feat --json   -> 1/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at 99998a1; git commit: 598e7db
$ node $DEV/deliver-check.mjs feat --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at 598e7db; git commit: 83163e5
$ node $DEV/deliver-check.mjs feat --json   -> 4/8, next: open-pr (no pull request yet)
    did: git push -u origin feat; gh pr create -> https://github.invalid/o/devkit/pull/11
$ node $DEV/deliver-check.mjs feat --json   -> 8/8, next: assign-release (the release of feat is not assigned yet; assign it before the merge)
```

```text
(in $CASES/p1/main/.claude/worktrees/feat)
$ node $DEV/deliver-check.mjs feat
deliver-check: feat (schema devkit, ship merge, host cli, head 18c5cb3)
  1 met      tasks and gates: all tasks ticked; 1 gate command green in evidence.md
  2 met      reviews at head: 2 reviews at head
  3 met      findings disposed: 0 fixed, 0 refuted
  4 met      acceptance criteria proven: 1 criteria proven
  5 met      PR open at local head: PR #11 open at 18c5cb3
  6 met      required checks green: 2 required checks green
  7 met      conversation answered: every thread and request is answered
  8 met      PR body complete: PR body names the change, its criteria and the evidence
8/8 met: ready
next: assign-release: the release of feat is not assigned yet; assign it before the merge
[exit 0]
```

```text
"next" of deliver-check <id> --json at this head:
{
  "step": "assign-release",
  "reason": "the release of feat is not assigned yet; assign it before the merge",
  "number": 11,
  "base": "main",
  "branch": "feat",
  "command": [
    "node",
    "$DEV/release-merge.mjs",
    "--assign",
    "--base",
    "main",
    "--json"
  ]
}
```

The `assign-release` row of `ship-change`, as the session runs it: `git fetch origin <next.base>`, `next.command` in the change's worktree, then a plain `git push origin <next.branch>`.

```text
(in $CASES/p1/main/.claude/worktrees/feat)
$ git fetch origin main
From $CASES/p1/origin
 * branch            main       -> FETCH_HEAD
[exit 0]
```

```text
(in $CASES/p1/main/.claude/worktrees/feat)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": true,
  "oldHead": "18c5cb3b1a7810fadc36bdaab874b8d4eab2dabd",
  "newHead": "9cddfab52632f211162063d6164f8eb79a056f63",
  "versions": {
    "packs": {
      "devkit-openspec": "1.1.0",
      "devkit-core": "1.0.1"
    },
    "metadata": "1.1.0"
  },
  "files": [
    "plugins/core/.claude-plugin/plugin.json",
    "plugins/openspec/.claude-plugin/plugin.json",
    ".claude-plugin/marketplace.json",
    "CHANGELOG.md",
    "docs/openspec-flow.md",
    "docs/catalog.md"
  ],
  "change": "feat",
  "adrs": [
    {
      "from": "docs/adr/feat.md",
      "to": "docs/adr/0002-feat.md"
    }
  ],
  "citations": [
    "CHANGELOG.md",
    "docs/guide.md",
    "docs/openspec-flow.md"
  ],
  "mode": "assign"
}
[exit 0]
```

```text
(in $CASES/p1/main/.claude/worktrees/feat)
$ git push origin feat
To $CASES/p1/origin.git
   18c5cb3..9cddfab  feat -> feat
[exit 0]
```

The step's one commit holds only release lines, the record's number and the rewritten citations; no file under `openspec/changes/` changed:

```text
(in $CASES/p1/main/.claude/worktrees/feat)
$ git show --stat '--format=%h %s' HEAD
9cddfab chore(release): assign the release of feat

 .claude-plugin/marketplace.json             | 6 +++---
 CHANGELOG.md                                | 5 +++++
 docs/adr/{feat.md => 0002-feat.md}          | 2 +-
 docs/catalog.md                             | 4 ++--
 docs/guide.md                               | 2 +-
 docs/openspec-flow.md                       | 8 ++++----
 plugins/core/.claude-plugin/plugin.json     | 2 +-
 plugins/openspec/.claude-plugin/plugin.json | 2 +-
 8 files changed, 18 insertions(+), 13 deletions(-)
[exit 0]
```

```text
(in $CASES/p1/main/.claude/worktrees/feat)
$ git diff --name-only HEAD~1 HEAD -- openspec/changes/   # empty: the plan, the evidence and the reviews are untouched
(no output)
[exit 0]
```

```text
(in $CASES/p1/main/.claude/worktrees/feat)
$ git diff 'HEAD~1' HEAD -- docs/guide.md docs/openspec-flow.md CHANGELOG.md docs/catalog.md
diff --git a/CHANGELOG.md b/CHANGELOG.md
index 4881fd1..b6ad8a5 100644
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -1,5 +1,10 @@
 # Changelog
 
+## 1.1.0 — the feature lands
+
+- **devkit-openspec** 1.1.0: the flow does the feature (ADR 0002)
+- **devkit-core** 1.0.1: the agents follow it
+
 ## 1.0.0 — first release
 
 - **devkit-openspec** 1.0.0: the flow
diff --git a/docs/catalog.md b/docs/catalog.md
index abce1fe..bea14da 100644
--- a/docs/catalog.md
+++ b/docs/catalog.md
@@ -2,5 +2,5 @@
 
 | Pack | Version |
 |---|---|
-| devkit-core | 1.0.0 |
-| devkit-openspec | 1.0.0 |
+| devkit-core | 1.0.1 |
+| devkit-openspec | 1.1.0 |
diff --git a/docs/guide.md b/docs/guide.md
index f3ee8b1..db703a0 100644
--- a/docs/guide.md
+++ b/docs/guide.md
@@ -3,7 +3,7 @@
 ## Section A
 
 A line one.
-A line two. The rule is ADR [feat]; see [the record](adr/feat.md).
+A line two. The rule is ADR 0002; see [the record](adr/0002-feat.md).
 A line three.
 A line four.
 
diff --git a/docs/openspec-flow.md b/docs/openspec-flow.md
index bd994d8..8a19319 100644
--- a/docs/openspec-flow.md
+++ b/docs/openspec-flow.md
@@ -4,7 +4,7 @@ How a change moves from its plan to its merge in this project.
 
 ## Records
 
-The records of this project live in docs/adr/; the newest is ADR [feat].
+The records of this project live in docs/adr/; the newest is ADR 0002.
 
 Line one of the records section.
 Line two of the records section.
@@ -12,14 +12,14 @@ Line three of the records section.
 
 ## CI
 
-          # pinned to the commit of v1.0.0 (a tag can move; a commit cannot)
-          base=https://raw.githubusercontent.com/o/devkit/<commit sha of v1.0.0>/plugins/openspec/hooks
+          # pinned to the commit of v1.1.0 (a tag can move; a commit cannot)
+          base=https://raw.githubusercontent.com/o/devkit/<commit sha of v1.1.0>/plugins/openspec/hooks
 
 ci line one
 ci line two
 ci line three
 
-Pin the commit sha of the release tag (`v1.0.0` above), not the tag; by hand, run `gh api repos/o/devkit/git/ref/tags/v1.0.0`.
+Pin the commit sha of the release tag (`v1.1.0` above), not the tag; by hand, run `gh api repos/o/devkit/git/ref/tags/v1.1.0`.
 
 ## Notes
 
[exit 0]
```

After the step the evidence and the approved reviews recorded before it are still current (items 1 to 4 met), and `enable-auto-merge` is next:

```text
(in $CASES/p1/main/.claude/worktrees/feat)
$ node $DEV/deliver-check.mjs feat
deliver-check: feat (schema devkit, ship merge, host cli, head 9cddfab)
  1 met      tasks and gates: all tasks ticked; 1 gate command green in evidence.md
  2 met      reviews at head: 2 reviews at head
  3 met      findings disposed: 0 fixed, 0 refuted
  4 met      acceptance criteria proven: 1 criteria proven
  5 met      PR open at local head: PR #11 open at 9cddfab
  6 met      required checks green: 2 required checks green
  7 met      conversation answered: every thread and request is answered
  8 met      PR body complete: PR body names the change, its criteria and the evidence
8/8 met: ready
next: enable-auto-merge PR #11 with --squash at 9cddfab
[exit 0]
```

```text
"next" of deliver-check <id> --json at this head:
{
  "step": "enable-auto-merge",
  "reason": "all eight items are met",
  "number": 11,
  "method": "squash",
  "head": "9cddfab52632f211162063d6164f8eb79a056f63"
}
```

### The sibling `sib` merges first

The owner lets `sib` go first: it is driven the same way, takes its release on the same base (devkit-openspec 1.0.1, `docs/adr/0002-sib.md`), enables auto-merge, and GitHub merges it.

```text
(in $CASES/p1/main/.claude/worktrees/sib)
$ node $DEV/deliver-check.mjs sib --json   -> 1/8, next: implement (phase 1 has unticked tasks: 1.1)
    did: wrote src/sib-1.ts; ticked 1.1
$ node $DEV/deliver-check.mjs sib --json   -> 1/8, next: gate (phase 1 is implemented; run its gate 1.2)
    did: ran `node -e 0` (exit 0); ticked 1.2
$ node $DEV/deliver-check.mjs sib --json   -> 1/8, next: commit (uncommitted changes outside openspec/: src/sib-1.ts)
    did: git commit: 3e929ed
$ node $DEV/deliver-check.mjs sib --json   -> 1/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at 3e929ed; git commit: 935357c
$ node $DEV/deliver-check.mjs sib --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at 935357c; git commit: 2305004
$ node $DEV/deliver-check.mjs sib --json   -> 4/8, next: open-pr (no pull request yet)
    did: git push -u origin sib; gh pr create -> https://github.invalid/o/devkit/pull/12
$ node $DEV/deliver-check.mjs sib --json   -> 8/8, next: assign-release (the release of sib is not assigned yet; assign it before the merge)
```

```text
(in $CASES/p1/main/.claude/worktrees/sib)
$ git fetch origin main
From $CASES/p1/origin
 * branch            main       -> FETCH_HEAD
[exit 0]
```

```text
(in $CASES/p1/main/.claude/worktrees/sib)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": true,
  "oldHead": "fc2aa4a5fce9864f898702f3e16ebd0c376b6085",
  "newHead": "8263ef1fcc5ac46d5042a31d114c0654f9a52fe9",
  "versions": {
    "packs": {
      "devkit-openspec": "1.0.1"
    },
    "metadata": "1.0.1"
  },
  "files": [
    "plugins/openspec/.claude-plugin/plugin.json",
    ".claude-plugin/marketplace.json",
    "CHANGELOG.md",
    "docs/openspec-flow.md",
    "docs/catalog.md"
  ],
  "change": "sib",
  "adrs": [
    {
      "from": "docs/adr/sib.md",
      "to": "docs/adr/0002-sib.md"
    }
  ],
  "citations": [
    "docs/sib.md"
  ],
  "mode": "assign"
}
[exit 0]
```

```text
(in $CASES/p1/main/.claude/worktrees/sib)
$ git push origin sib
To $CASES/p1/origin.git
   fc2aa4a..8263ef1  sib -> sib
[exit 0]
```

```text
(in $CASES/p1/main/.claude/worktrees/sib)
$ gh pr merge 12 --auto --squash --match-head-commit 8263ef1fcc5ac46d5042a31d114c0654f9a52fe9
(no output)
[exit 0]
```

```text
(in $CASES/p1/main)
$ gh __merge 12   # the stub: GitHub merges the pull request once its rules pass
99d76e55b4542d6cc9e600e7e1bac41ccafb0282
[exit 0]
```

```text
(in $CASES/p1/main)
$ git log --oneline --graph -6 origin/main
* 99d76e5 Merge pull request #12 from sib
* 3af2137 seed: the project at its first release
[exit 0]
```

### `feat` again: the base moved and released the same pack

GitHub now reports `feat` in conflict with `main` (both wrote the same release lines), so the checker asks for `assign-release` again, in place of the conflict stop:

```text
(in $CASES/p1/main/.claude/worktrees/feat)
$ node $DEV/deliver-check.mjs feat
deliver-check: feat (schema devkit, ship merge, host cli, head 9cddfab)
  1 met      tasks and gates: all tasks ticked; 1 gate command green in evidence.md
  2 met      reviews at head: 2 reviews at head
  3 met      findings disposed: 0 fixed, 0 refuted
  4 met      acceptance criteria proven: 1 criteria proven
  5 blocked  PR open at local head: PR #11 has merge conflicts with main
  6 met      required checks green: 2 required checks green
  7 met      conversation answered: every thread and request is answered
  8 met      PR body complete: PR body names the change, its criteria and the evidence
7/8 met: blocked: item 5
next: assign-release: PR #11 has merge conflicts with main
[exit 2]
```

```text
"next" of deliver-check <id> --json at this head:
{
  "step": "assign-release",
  "reason": "PR #11 has merge conflicts with main",
  "number": 11,
  "base": "main",
  "branch": "feat",
  "command": [
    "node",
    "$DEV/release-merge.mjs",
    "--assign",
    "--base",
    "main",
    "--json"
  ]
}
```

```text
(in $CASES/p1/main/.claude/worktrees/feat)
$ git fetch origin main
From $CASES/p1/origin
 * branch            main       -> FETCH_HEAD
[exit 0]
```

```text
(in $CASES/p1/main/.claude/worktrees/feat)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": true,
  "oldHead": "9cddfab52632f211162063d6164f8eb79a056f63",
  "newHead": "a62646369843315d1d35e703770a9dd068f8ebc0",
  "versions": {
    "packs": {
      "devkit-openspec": "1.1.0",
      "devkit-core": "1.0.1"
    },
    "metadata": "1.1.0"
  },
  "files": [
    "plugins/openspec/.claude-plugin/plugin.json",
    ".claude-plugin/marketplace.json",
    "CHANGELOG.md",
    "docs/openspec-flow.md",
    "docs/catalog.md"
  ],
  "change": "feat",
  "adrs": [
    {
      "from": "docs/adr/feat.md",
      "to": "docs/adr/0003-feat.md"
    }
  ],
  "citations": [
    "CHANGELOG.md",
    "docs/guide.md",
    "docs/openspec-flow.md"
  ],
  "mode": "assign"
}
[exit 0]
```

```text
(in $CASES/p1/main/.claude/worktrees/feat)
$ git push origin feat
To $CASES/p1/origin.git
   9cddfab..a626463  feat -> feat
[exit 0]
```

No conflict was left: the merge commit holds the base, `feat`'s numbers above it (devkit-openspec 1.1.0 over 1.0.1, devkit-core 1.0.1, ADR 0003), both changelog entries and both citations:

```text
(in $CASES/p1/main/.claude/worktrees/feat)
$ git log --oneline --graph -5
*   a626463 chore(release): merge origin/main and assign the release of feat
|\  
| * 99d76e5 Merge pull request #12 from sib
* | 9cddfab chore(release): assign the release of feat
* | 18c5cb3 docs(feat): change files
* | 83163e5 docs(feat): reviews
[exit 0]
```

```text
(in $CASES/p1/main/.claude/worktrees/feat)
$ git show --stat '--format=%h %s' HEAD
a626463 chore(release): merge origin/main and assign the release of feat

 CHANGELOG.md                                           |  6 +++++-
 docs/adr/0002-sib.md                                   |  6 ++++++
 docs/adr/{0002-feat.md => 0003-feat.md}                |  2 +-
 docs/guide.md                                          |  2 +-
 docs/openspec-flow.md                                  |  2 +-
 docs/sib.md                                            |  3 +++
 openspec/changes/sib/.openspec.yaml                    |  1 +
 openspec/changes/sib/approval.md                       |  8 ++++++++
 openspec/changes/sib/decisions.md                      |  3 +++
 openspec/changes/sib/evidence.md                       | 13 +++++++++++++
 openspec/changes/sib/proposal.md                       |  9 +++++++++
 openspec/changes/sib/readiness.md                      |  3 +++
 openspec/changes/sib/release.md                        |  6 ++++++
 openspec/changes/sib/reviews/code-quality-reviewer.md  |  6 ++++++
 openspec/changes/sib/reviews/test-coverage-reviewer.md |  6 ++++++
 openspec/changes/sib/tasks.md                          |  6 ++++++
 src/sib-1.ts                                           |  1 +
 17 files changed, 79 insertions(+), 4 deletions(-)
[exit 0]
```

```text
(in $CASES/p1/main/.claude/worktrees/feat)
$ git diff --name-only HEAD^1 HEAD -- openspec/changes/feat/   # empty
(no output)
[exit 0]
```

```text
(in $CASES/p1/main/.claude/worktrees/feat)
$ cat plugins/openspec/.claude-plugin/plugin.json plugins/core/.claude-plugin/plugin.json .claude-plugin/marketplace.json CHANGELOG.md docs/catalog.md
{
  "name": "devkit-openspec",
  "version": "1.1.0",
  "description": "the devkit-openspec pack"
}
{
  "name": "devkit-core",
  "version": "1.0.1",
  "description": "the devkit-core pack"
}
{
  "name": "devkit",
  "metadata": {
    "description": "two packs",
    "version": "1.1.0"
  },
  "plugins": [
    {
      "name": "devkit-openspec",
      "source": "./plugins/openspec",
      "description": "the devkit-openspec pack",
      "version": "1.1.0"
    },
    {
      "name": "devkit-core",
      "source": "./plugins/core",
      "description": "the devkit-core pack",
      "version": "1.0.1"
    }
  ]
}
# Changelog

## 1.1.0 — the feature lands

- **devkit-openspec** 1.1.0: the flow does the feature (ADR 0003)
- **devkit-core** 1.0.1: the agents follow it

## 1.0.1 — sib lands

- **devkit-openspec** 1.0.1: sib does its part

## 1.0.0 — first release

- **devkit-openspec** 1.0.0: the flow
- **devkit-core** 1.0.0: the agents
# Catalog

| Pack | Version |
|---|---|
| devkit-core | 1.0.1 |
| devkit-openspec | 1.1.0 |
[exit 0]
```

```text
(in $CASES/p1/main/.claude/worktrees/feat)
$ grep -n 'ADR\|v1\.' docs/guide.md docs/sib.md docs/openspec-flow.md
docs/guide.md:6:A line two. The rule is ADR 0003; see [the record](adr/0003-feat.md).
docs/sib.md:3:The fix is ADR 0002, see [the record](adr/0002-sib.md).
docs/openspec-flow.md:7:The records of this project live in docs/adr/; the newest is ADR 0003.
docs/openspec-flow.md:15:          # pinned to the commit of v1.1.0 (a tag can move; a commit cannot)
docs/openspec-flow.md:16:          base=https://raw.githubusercontent.com/o/devkit/<commit sha of v1.1.0>/plugins/openspec/hooks
docs/openspec-flow.md:22:Pin the commit sha of the release tag (`v1.1.0` above), not the tag; by hand, run `gh api repos/o/devkit/git/ref/tags/v1.1.0`.
[exit 0]
```

```text
(in $CASES/p1/main/.claude/worktrees/feat)
$ ls docs/adr
0001-start.md
0002-sib.md
0003-feat.md
[exit 0]
```

```text
(in $CASES/p1/main/.claude/worktrees/feat)
$ node $DEV/deliver-check.mjs feat
deliver-check: feat (schema devkit, ship merge, host cli, head a626463)
  1 met      tasks and gates: all tasks ticked; 1 gate command green in evidence.md
  2 met      reviews at head: 2 reviews at head
  3 met      findings disposed: 0 fixed, 0 refuted
  4 met      acceptance criteria proven: 1 criteria proven
  5 met      PR open at local head: PR #11 open at a626463
  6 met      required checks green: 2 required checks green
  7 met      conversation answered: every thread and request is answered
  8 met      PR body complete: PR body names the change, its criteria and the evidence
8/8 met: ready
next: enable-auto-merge PR #11 with --squash at a626463
[exit 0]
```

```text
"next" of deliver-check <id> --json at this head:
{
  "step": "enable-auto-merge",
  "reason": "all eight items are met",
  "number": 11,
  "method": "squash",
  "head": "a62646369843315d1d35e703770a9dd068f8ebc0"
}
```

The session enables auto-merge with the row's exact command; P-12 lets GitHub merge it and follows the tag.

```text
(in $CASES/p1/main/.claude/worktrees/feat)
$ gh pr merge 11 --auto --squash --match-head-commit a62646369843315d1d35e703770a9dd068f8ebc0
(no output)
[exit 0]
```

```text
(in $CASES/p1/main/.claude/worktrees/feat)
$ node $DEV/deliver-check.mjs feat
deliver-check: feat (schema devkit, ship merge, host cli, head a626463)
  1 met      tasks and gates: all tasks ticked; 1 gate command green in evidence.md
  2 met      reviews at head: 2 reviews at head
  3 met      findings disposed: 0 fixed, 0 refuted
  4 met      acceptance criteria proven: 1 criteria proven
  5 met      PR open at local head: PR #11 open at a626463
  6 met      required checks green: 2 required checks green
  7 met      conversation answered: every thread and request is answered
  8 met      PR body complete: PR body names the change, its criteria and the evidence
8/8 met: auto-merge on: waiting for GitHub to merge
next: wait-merge waiting for GitHub to merge
[exit 0]
```

## P-2 a train of two noted changes through `train-loop.mjs depart`

AC-3, AC-5. Project `p2`: the seed with a delivery train (`devkit.delivery`: `model: trunk-auto`, `train: "true"`) and the same
`devkit.release_tag`. Changes `alpha` and `beta` both note devkit-openspec `minor`; each names its record (`docs/adr/alpha.md`,
`docs/adr/beta.md`, listed in its `decisions.md`) and cites it in a file of its own (`docs/alpha.md`, `docs/beta.md`). Neither branch
touches a release line. `alpha` is reviewed first, so it boards first.

```text
(in $CASES/p2/main)
$ cat openspec/config.yaml
schema: devkit
devkit:
  delivery:
    model: trunk-auto
    train: "true"
  release_tag: plugins/openspec/.claude-plugin/plugin.json
[exit 0]
```

```text
(in $CASES/p2/main/.claude/worktrees/alpha)
$ node $DEV/deliver-check.mjs alpha --json   -> 1/8, next: implement (phase 1 has unticked tasks: 1.1)
    did: wrote src/alpha-1.ts; ticked 1.1
$ node $DEV/deliver-check.mjs alpha --json   -> 1/8, next: gate (phase 1 is implemented; run its gate 1.2)
    did: ran `node -e 0` (exit 0); ticked 1.2
$ node $DEV/deliver-check.mjs alpha --json   -> 1/8, next: commit (uncommitted changes outside openspec/: src/alpha-1.ts)
    did: git commit: 5281a2e
$ node $DEV/deliver-check.mjs alpha --json   -> 1/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at 5281a2e; git commit: dda9a21
$ node $DEV/deliver-check.mjs alpha --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at dda9a21; git commit: db36b39
$ node $DEV/deliver-check.mjs alpha --json   -> 4/8, next: open-pr (no pull request yet)
    did: git push -u origin alpha; gh pr create -> https://github.invalid/o/devkit/pull/11
$ node $DEV/deliver-check.mjs alpha --json   -> 8/8, next: boarded (every item of the contract is met; the change leaves with the next train)
```

```text
(in $CASES/p2/main/.claude/worktrees/beta)
$ node $DEV/deliver-check.mjs beta --json   -> 1/8, next: implement (phase 1 has unticked tasks: 1.1)
    did: wrote src/beta-1.ts; ticked 1.1
$ node $DEV/deliver-check.mjs beta --json   -> 1/8, next: gate (phase 1 is implemented; run its gate 1.2)
    did: ran `node -e 0` (exit 0); ticked 1.2
$ node $DEV/deliver-check.mjs beta --json   -> 1/8, next: commit (uncommitted changes outside openspec/: src/beta-1.ts)
    did: git commit: 6cc4715
$ node $DEV/deliver-check.mjs beta --json   -> 1/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at 6cc4715; git commit: 244c2ad
$ node $DEV/deliver-check.mjs beta --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at 244c2ad; git commit: 866fbdd
$ node $DEV/deliver-check.mjs beta --json   -> 4/8, next: open-pr (no pull request yet)
    did: git push -u origin beta; gh pr create -> https://github.invalid/o/devkit/pull/12
$ node $DEV/deliver-check.mjs beta --json   -> 8/8, next: boarded (every item of the contract is met; the change leaves with the next train)
```

```text
(in $CASES/p2/main/.claude/worktrees/alpha)
$ node $DEV/deliver-check.mjs alpha
deliver-check: alpha (schema devkit, ship merge, host cli, head c90b5ed)
  1 met      tasks and gates: all tasks ticked; 1 gate command green in evidence.md
  2 met      reviews at head: 2 reviews at head
  3 met      findings disposed: 0 fixed, 0 refuted
  4 met      acceptance criteria proven: 1 criteria proven
  5 met      PR open at local head: PR #11 open at c90b5ed
  6 met      required checks green: 2 required checks green
  7 met      conversation answered: every thread and request is answered
  8 met      PR body complete: PR body names the change, its criteria and the evidence
8/8 met: boarded: waiting for the next train
next: boarded: every item of the contract is met; the change leaves with the next train
[exit 1]
```

The heads of both branches, locally and on origin, before the departure:

```text
(in $CASES/p2/main)
$ git ls-remote origin refs/heads/alpha refs/heads/beta
c90b5edb64ad6775543475a9c13e60fa06a08bb7	refs/heads/alpha
f0f0a7b9d3e7f3268bca8c113786b232a911261b	refs/heads/beta
[exit 0]
```

The train loop hands the session the departure; the session runs its command:

```text
(in $CASES/p2/main)
$ node $DEV/train-loop.mjs next --lang en
{
  "version": 1,
  "kind": "session",
  "step": "depart",
  "detail": {
    "background": true,
    "boarded": [
      {
        "kind": "change",
        "id": "alpha",
        "number": 11
      },
      {
        "kind": "change",
        "id": "beta",
        "number": 12
      }
    ],
    "skipped": [],
    "command": [
      "node",
      "$DEV/train-loop.mjs",
      "depart",
      "--lang",
      "en"
    ]
  },
  "reply": null,
  "progressKey": "depart@alpha,beta"
}
[exit 0]
```

```text
(in $CASES/p2/main)
$ node $DEV/train-loop.mjs depart --lang en
{
  "version": 1,
  "base": "main",
  "skipped": [],
  "n": 1,
  "branch": "train/1",
  "worktree": "$CASES/p2/main/.claude/worktrees/train-1",
  "result": "passed",
  "boarded": [
    {
      "kind": "change",
      "id": "alpha",
      "number": 11,
      "head": "c90b5edb64ad6775543475a9c13e60fa06a08bb7",
      "at": "2026-11-24T17:38:03Z"
    },
    {
      "kind": "change",
      "id": "beta",
      "number": 12,
      "head": "f0f0a7b9d3e7f3268bca8c113786b232a911261b",
      "at": "2026-11-24T17:38:11Z"
    }
  ],
  "left": [],
  "runs": 1
}
[exit 0]
```

The train: one join per boarded head (each numbered above the train's tip), then the record. The first boarded took devkit-openspec 1.1.0 and ADR 0002, the second 1.2.0 and ADR 0003; the marketplace, the changelog, the catalog and the CI pins follow:

```text
(in $CASES/p2/main/.claude/worktrees/train-1)
$ git log --oneline --graph origin/main..HEAD
* db69aab chore(train): record train 1
*   3be634f chore(train): join f0f0a7b and renumber its release above the train
|\  
| * f0f0a7b docs(beta): change files
| * 866fbdd docs(beta): reviews
| * 244c2ad docs(beta): evidence
| * 6cc4715 feat(beta): phase work
| * 5903053 docs(beta): the plan of beta
* 1e799e6 chore(train): join c90b5ed and renumber its release above the train
* c90b5ed docs(alpha): change files
* db36b39 docs(alpha): reviews
* dda9a21 docs(alpha): evidence
* 5281a2e feat(alpha): phase work
* fe23fb3 docs(alpha): the plan of alpha
[exit 0]
```

```text
(in $CASES/p2/main/.claude/worktrees/train-1)
$ git show --stat '--format=%h %s' 'HEAD~2'
1e799e6 chore(train): join c90b5ed and renumber its release above the train

 .claude-plugin/marketplace.json                          |  4 ++--
 CHANGELOG.md                                             |  4 ++++
 docs/adr/0002-alpha.md                                   |  6 ++++++
 docs/alpha.md                                            |  3 +++
 docs/catalog.md                                          |  2 +-
 docs/openspec-flow.md                                    |  6 +++---
 openspec/changes/alpha/.openspec.yaml                    |  1 +
 openspec/changes/alpha/approval.md                       |  8 ++++++++
 openspec/changes/alpha/decisions.md                      |  3 +++
 openspec/changes/alpha/evidence.md                       | 13 +++++++++++++
 openspec/changes/alpha/proposal.md                       |  9 +++++++++
 openspec/changes/alpha/readiness.md                      |  3 +++
 openspec/changes/alpha/release.md                        |  6 ++++++
 openspec/changes/alpha/reviews/code-quality-reviewer.md  |  6 ++++++
 openspec/changes/alpha/reviews/test-coverage-reviewer.md |  6 ++++++
 openspec/changes/alpha/tasks.md                          |  6 ++++++
 plugins/openspec/.claude-plugin/plugin.json              |  2 +-
 src/alpha-1.ts                                           |  1 +
 18 files changed, 82 insertions(+), 7 deletions(-)
[exit 0]
```

```text
(in $CASES/p2/main/.claude/worktrees/train-1)
$ git show --stat '--format=%h %s' 'HEAD~1'
3be634f chore(train): join f0f0a7b and renumber its release above the train

 .claude-plugin/marketplace.json                         |  4 ++--
 CHANGELOG.md                                            |  4 ++++
 docs/adr/0003-beta.md                                   |  6 ++++++
 docs/beta.md                                            |  3 +++
 docs/catalog.md                                         |  2 +-
 docs/openspec-flow.md                                   |  6 +++---
 openspec/changes/beta/.openspec.yaml                    |  1 +
 openspec/changes/beta/approval.md                       |  8 ++++++++
 openspec/changes/beta/decisions.md                      |  3 +++
 openspec/changes/beta/evidence.md                       | 13 +++++++++++++
 openspec/changes/beta/proposal.md                       |  9 +++++++++
 openspec/changes/beta/readiness.md                      |  3 +++
 openspec/changes/beta/release.md                        |  6 ++++++
 openspec/changes/beta/reviews/code-quality-reviewer.md  |  6 ++++++
 openspec/changes/beta/reviews/test-coverage-reviewer.md |  6 ++++++
 openspec/changes/beta/tasks.md                          |  6 ++++++
 plugins/openspec/.claude-plugin/plugin.json             |  2 +-
 src/beta-1.ts                                           |  1 +
 18 files changed, 82 insertions(+), 7 deletions(-)
[exit 0]
```

```text
(in $CASES/p2/main/.claude/worktrees/train-1)
$ cat openspec/trains/1.md
<!-- devkit-train n=1 base=main result=passed -->
# Train 1

- Base: `main` at `ec65319e975cad6f4725a5463e14743f01745320`
- Suite: `true`
- Ran at: `3be634f401f0d00a238c757d2246986c8e3d4f97`
- Result: passed

## Boarded

| Order | Kind | Change | Pull request | Head | Boarded at |
| --- | --- | --- | --- | --- | --- |
| 1 | change | `alpha` | #11 | `c90b5edb64ad6775543475a9c13e60fa06a08bb7` | 2026-11-24T17:38:03Z |
| 2 | change | `beta` | #12 | `f0f0a7b9d3e7f3268bca8c113786b232a911261b` | 2026-11-24T17:38:11Z |

## Runs

| Run | Changes | Head | Result |
| --- | --- | --- | --- |
| 1 | alpha, beta | `3be634f401f0d00a238c757d2246986c8e3d4f97` | passed |
[exit 0]
```

```text
(in $CASES/p2/main/.claude/worktrees/train-1)
$ cat plugins/openspec/.claude-plugin/plugin.json .claude-plugin/marketplace.json CHANGELOG.md docs/catalog.md docs/alpha.md docs/beta.md
{
  "name": "devkit-openspec",
  "version": "1.2.0",
  "description": "the devkit-openspec pack"
}
{
  "name": "devkit",
  "metadata": {
    "description": "two packs",
    "version": "1.2.0"
  },
  "plugins": [
    {
      "name": "devkit-openspec",
      "source": "./plugins/openspec",
      "description": "the devkit-openspec pack",
      "version": "1.2.0"
    },
    {
      "name": "devkit-core",
      "source": "./plugins/core",
      "description": "the devkit-core pack",
      "version": "1.0.0"
    }
  ]
}
# Changelog

## 1.2.0 — beta lands

- **devkit-openspec** 1.2.0: beta does its part

## 1.1.0 — alpha lands

- **devkit-openspec** 1.1.0: alpha does its part

## 1.0.0 — first release

- **devkit-openspec** 1.0.0: the flow
- **devkit-core** 1.0.0: the agents
# Catalog

| Pack | Version |
|---|---|
| devkit-core | 1.0.0 |
| devkit-openspec | 1.2.0 |
# alpha

The rule of alpha is ADR 0002 ([the record](adr/0002-alpha.md)).
# beta

The rule of beta is ADR 0003 ([the record](adr/0003-beta.md)).
[exit 0]
```

```text
(in $CASES/p2/main/.claude/worktrees/train-1)
$ grep -n 'v1\.' docs/openspec-flow.md
15:          # pinned to the commit of v1.2.0 (a tag can move; a commit cannot)
16:          base=https://raw.githubusercontent.com/o/devkit/<commit sha of v1.2.0>/plugins/openspec/hooks
22:Pin the commit sha of the release tag (`v1.2.0` above), not the tag; by hand, run `gh api repos/o/devkit/git/ref/tags/v1.2.0`.
[exit 0]
```

```text
(in $CASES/p2/main/.claude/worktrees/train-1)
$ ls docs/adr
0001-start.md
0002-alpha.md
0003-beta.md
[exit 0]
```

```text
(in $CASES/p2/main/.claude/worktrees/train-1)
$ git diff --stat origin/main HEAD -- openspec/changes/   # the change folders as each branch has them, plus nothing
 openspec/changes/alpha/.openspec.yaml                    |  1 +
 openspec/changes/alpha/approval.md                       |  8 ++++++++
 openspec/changes/alpha/decisions.md                      |  3 +++
 openspec/changes/alpha/evidence.md                       | 13 +++++++++++++
 openspec/changes/alpha/proposal.md                       |  9 +++++++++
 openspec/changes/alpha/readiness.md                      |  3 +++
 openspec/changes/alpha/release.md                        |  6 ++++++
 openspec/changes/alpha/reviews/code-quality-reviewer.md  |  6 ++++++
 openspec/changes/alpha/reviews/test-coverage-reviewer.md |  6 ++++++
 openspec/changes/alpha/tasks.md                          |  6 ++++++
 openspec/changes/beta/.openspec.yaml                     |  1 +
 openspec/changes/beta/approval.md                        |  8 ++++++++
 openspec/changes/beta/decisions.md                       |  3 +++
 openspec/changes/beta/evidence.md                        | 13 +++++++++++++
 openspec/changes/beta/proposal.md                        |  9 +++++++++
 openspec/changes/beta/readiness.md                       |  3 +++
 openspec/changes/beta/release.md                         |  6 ++++++
 openspec/changes/beta/reviews/code-quality-reviewer.md   |  6 ++++++
 openspec/changes/beta/reviews/test-coverage-reviewer.md  |  6 ++++++
 openspec/changes/beta/tasks.md                           |  6 ++++++
 20 files changed, 122 insertions(+)
[exit 0]
```

```text
(in $CASES/p2/main/.claude/worktrees/train-1)
$ git diff --stat alpha HEAD -- openspec/changes/alpha/   # empty: the train holds alpha's folder exactly as its branch
(no output)
[exit 0]
```

```text
(in $CASES/p2/main/.claude/worktrees/train-1)
$ git diff --stat beta HEAD -- openspec/changes/beta/   # empty: the train holds beta's folder exactly as its branch
(no output)
[exit 0]
```

`deliver-check --ci` on the train, as the pull request of `train/1` runs it in CI (`GITHUB_HEAD_REF=train/1`, `GITHUB_BASE_REF=main`): each boarded change passes at its own head, and the train's own commits are only release lines, ADR numbers and the record:

```text
(in $CASES/p2/main/.claude/worktrees/train-1)
$ node $DEV/deliver-check.mjs --ci
devkit-reviews: train 1 (openspec/trains/1.md, 2 boarded)
  change alpha (#11, head c90b5ed): pass
  change beta (#12, head f0f0a7b): pass
pass
[exit 0]
```

Both boarded heads are unchanged, locally and on origin:

```text
(in $CASES/p2/main)
$ git ls-remote origin refs/heads/alpha refs/heads/beta
c90b5edb64ad6775543475a9c13e60fa06a08bb7	refs/heads/alpha
f0f0a7b9d3e7f3268bca8c113786b232a911261b	refs/heads/beta
[exit 0]
```

```text
(in $CASES/p2/main/.claude/worktrees/alpha)
$ node $DEV/deliver-check.mjs alpha
deliver-check: alpha (schema devkit, ship merge, host cli, head c90b5ed)
  1 met      tasks and gates: all tasks ticked; 1 gate command green in evidence.md
  2 met      reviews at head: 2 reviews at head
  3 met      findings disposed: 0 fixed, 0 refuted
  4 met      acceptance criteria proven: 1 criteria proven
  5 met      PR open at local head: PR #11 open at c90b5ed
  6 met      required checks green: 2 required checks green
  7 met      conversation answered: every thread and request is answered
  8 met      PR body complete: PR body names the change, its criteria and the evidence
8/8 met: boarded: waiting for the next train
next: boarded: every item of the contract is met; the change leaves with the next train
[exit 1]
```

```text
(in $CASES/p2/main/.claude/worktrees/beta)
$ node $DEV/deliver-check.mjs beta
deliver-check: beta (schema devkit, ship merge, host cli, head f0f0a7b)
  1 met      tasks and gates: all tasks ticked; 1 gate command green in evidence.md
  2 met      reviews at head: 2 reviews at head
  3 met      findings disposed: 0 fixed, 0 refuted
  4 met      acceptance criteria proven: 1 criteria proven
  5 met      PR open at local head: PR #12 open at f0f0a7b
  6 met      required checks green: 2 required checks green
  7 met      conversation answered: every thread and request is answered
  8 met      PR body complete: PR body names the change, its criteria and the evidence
8/8 met: boarded: waiting for the next train
next: boarded: every item of the contract is met; the change leaves with the next train
[exit 1]
```

## P-3 an old-rule change: its own bump, a numbered ADR, `--base`, `renumber-adr` and a join beside a noted change

AC-10. A change with no `release.md` in a project that names `devkit.release_tag` is delivered exactly as before this change.

### `renumber-adr` and `--base` with no train

Project `p3` (the seed, merge mode, a roadmap round listing `old`). Change `old` has no note: its branch bumps devkit-core
1.0.0 to 1.1.0 itself (manifest, marketplace, changelog, catalog) and adds `docs/adr/0002-old.md`, listed in `decisions.md` and cited
in `docs/old.md`, with a code file of the pack.

```text
(in $CASES/p3/main/.claude/worktrees/old)
$ git show --stat '--format=%h %s' HEAD
7cf7e95 docs(old): the plan of old

 .claude-plugin/marketplace.json         | 4 ++--
 CHANGELOG.md                            | 4 ++++
 docs/adr/0002-old.md                    | 3 +++
 docs/catalog.md                         | 2 +-
 docs/old.md                             | 3 +++
 openspec/changes/old/.openspec.yaml     | 1 +
 openspec/changes/old/approval.md        | 7 +++++++
 openspec/changes/old/decisions.md       | 3 +++
 openspec/changes/old/proposal.md        | 9 +++++++++
 openspec/changes/old/readiness.md       | 3 +++
 openspec/changes/old/tasks.md           | 6 ++++++
 plugins/core/.claude-plugin/plugin.json | 2 +-
 plugins/core/README.md                  | 2 +-
 13 files changed, 44 insertions(+), 5 deletions(-)
[exit 0]
```

```text
(in $CASES/p3/main/.claude/worktrees/old)
$ node $DEV/deliver-check.mjs old --json   -> 1/8, next: implement (phase 1 has unticked tasks: 1.1)
    did: wrote src/old-1.ts; ticked 1.1
$ node $DEV/deliver-check.mjs old --json   -> 1/8, next: gate (phase 1 is implemented; run its gate 1.2)
    did: ran `node -e 0` (exit 0); ticked 1.2
$ node $DEV/deliver-check.mjs old --json   -> 1/8, next: commit (uncommitted changes outside openspec/: src/old-1.ts)
    did: git commit: e3e9c61
$ node $DEV/deliver-check.mjs old --json   -> 1/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at e3e9c61; git commit: e27bcac
$ node $DEV/deliver-check.mjs old --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at e27bcac; git commit: b4216ec
$ node $DEV/deliver-check.mjs old --json   -> 4/8, next: open-pr (no pull request yet)
    did: git push -u origin old; gh pr create -> https://github.invalid/o/devkit/pull/11
$ node $DEV/deliver-check.mjs old --json   -> 8/8, next: enable-auto-merge (all eight items are met)
```

With no note the checker asks no `assign-release`: the last step is `enable-auto-merge`, as before. Before the owner lets it merge, another change lands on `main` by the old rule too (devkit-core 1.0.1 and its own `docs/adr/0002-landed.md`):

```text
(in $CASES/p3/main)
$ git push origin main
To $CASES/p3/origin.git
   fe4d7d4..085e6f9  main -> main
[exit 0]
```

```text
(in $CASES/p3/main/.claude/worktrees/old)
$ node $DEV/deliver-check.mjs old
deliver-check: old (schema devkit, ship merge, host cli, head 5733b3d)
  1 met      tasks and gates: all tasks ticked; 1 gate command green in evidence.md
  2 met      reviews at head: 2 reviews at head
  3 met      findings disposed: 0 fixed, 0 refuted
  4 met      acceptance criteria proven: 1 criteria proven
  5 blocked  PR open at local head: PR #11 has merge conflicts with main
  6 met      required checks green: 2 required checks green
  7 met      conversation answered: every thread and request is answered
  8 met      PR body complete: PR body names the change, its criteria and the evidence
7/8 met: blocked: item 5
next: blocked item 5: PR #11 has merge conflicts with main
[exit 2]
```

The conductor (`conduct-check`) turns the round into its rows: the ADR number the base took is `renumber-adr`, as before:

```text
(in $CASES/p3/main)
$ node $DEV/conduct-check.mjs --json
{
  "version": 2,
  "base": "main",
  "mode": "round",
  "change": null,
  "round": {
    "n": 1,
    "title": "Round 1: proof",
    "done": 0,
    "total": 1
  },
  "startedAt": 1,
  "skipped": [],
  "roadmapDone": false,
  "changes": [
    {
      "id": "old",
      "round": 1,
      "after": [],
      "text": "",
      "notes": "",
      "schema": "devkit",
      "worktree": "$CASES/p3/main/.claude/worktrees/old",
      "branch": "old",
      "base": "main",
      "next": {
        "step": "renumber-adr",
        "reason": "an ADR number the base took: renumber docs/adr/0002-old.md to docs/adr/0003-old.md and every reference",
        "files": [
          {
            "from": "docs/adr/0002-old.md",
            "to": "docs/adr/0003-old.md",
            "number": "0003"
          }
        ],
        "actor": "subagent",
        "agent": "devkit-core:tdd-implementer"
      },
      "state": "ready to run: renumber-adr",
      "deliver": {
        "summary": "blocked: item 5",
        "met": 7,
        "next": {
          "step": "blocked",
          "reason": "PR #11 has merge conflicts with main",
          "item": 5,
          "conflict": true
        }
      },
      "unfinished": null,
      "sessionPrefix": "old-p"
    }
  ],
  "dispatch": [
    "old"
  ],
  "owner": [],
  "github": [],
  "stopped": [],
  "busy": [],
  "end": false
}
[exit 0]
```

The implementer does what the `renumber-adr` hand-off says: `git mv` each file and change every reference in the branch's files, then commits:

```text
(in $CASES/p3/main/.claude/worktrees/old)
$ git mv docs/adr/0002-old.md docs/adr/0003-old.md
(no output)
[exit 0]
```

```text
(in $CASES/p3/main/.claude/worktrees/old)
$ git commit -q -am 'docs(old): renumber the ADR the base took'
(no output)
[exit 0]
```

```text
(in $CASES/p3/main/.claude/worktrees/old)
$ git show -M '--format=%h %s' HEAD
88f6aa0 docs(old): renumber the ADR the base took

diff --git a/docs/adr/0002-old.md b/docs/adr/0002-old.md
deleted file mode 100644
index f771ca0..0000000
--- a/docs/adr/0002-old.md
+++ /dev/null
@@ -1,3 +0,0 @@
-# ADR 0002: the rule of old
-
-- Status: proposed
diff --git a/docs/adr/0003-old.md b/docs/adr/0003-old.md
new file mode 100644
index 0000000..1a39db9
--- /dev/null
+++ b/docs/adr/0003-old.md
@@ -0,0 +1,3 @@
+# ADR 0003: the rule of old
+
+- Status: proposed
diff --git a/docs/old.md b/docs/old.md
index 755a481..a78910e 100644
--- a/docs/old.md
+++ b/docs/old.md
@@ -1,3 +1,3 @@
 # old
 
-See ADR 0002 ([the record](adr/0002-old.md)).
+See ADR 0003 ([the record](adr/0003-old.md)).
diff --git a/openspec/changes/old/decisions.md b/openspec/changes/old/decisions.md
index a547935..4708322 100644
--- a/openspec/changes/old/decisions.md
+++ b/openspec/changes/old/decisions.md
@@ -1,3 +1,3 @@
 # Decisions and ADRs
 
-- ADR: `docs/adr/0002-old.md` — the record of old
+- ADR: `docs/adr/0003-old.md` — the record of old
[exit 0]
```

The renumbering is a plain commit that touches the change's own files, so it stales the evidence and the reviews, as before this change (the cost of the old rule); the session records them again and pushes, and the pull request is then in conflict with `main`:

```text
(in $CASES/p3/main/.claude/worktrees/old)
$ node $DEV/deliver-check.mjs old --json   -> 4/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at 88f6aa0; git commit: 3ae281f
$ node $DEV/deliver-check.mjs old --json   -> 6/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at 3ae281f; git commit: 3f5c695
$ node $DEV/deliver-check.mjs old --json   -> 7/8, next: blocked (PR #11 has merge conflicts with main)
```

```text
(in $CASES/p3/main/.claude/worktrees/old)
$ node $DEV/deliver-check.mjs old
deliver-check: old (schema devkit, ship merge, host cli, head 3f5c695)
  1 met      tasks and gates: all tasks ticked; 1 gate command green in evidence.md
  2 met      reviews at head: 2 reviews at head
  3 met      findings disposed: 0 fixed, 0 refuted
  4 met      acceptance criteria proven: 1 criteria proven
  5 blocked  PR open at local head: PR #11 has merge conflicts with main
  6 met      required checks green: 2 required checks green
  7 met      conversation answered: every thread and request is answered
  8 met      PR body complete: PR body names the change, its criteria and the evidence
7/8 met: blocked: item 5
next: blocked item 5: PR #11 has merge conflicts with main
[exit 2]
```

The conductor again: the pull request conflicts only in release files, which is `resolve-release-conflict`, as before:

```text
(in $CASES/p3/main)
$ node $DEV/conduct-check.mjs --json
{
  "version": 2,
  "base": "main",
  "mode": "round",
  "change": null,
  "round": {
    "n": 1,
    "title": "Round 1: proof",
    "done": 0,
    "total": 1
  },
  "startedAt": 1,
  "skipped": [],
  "roadmapDone": false,
  "changes": [
    {
      "id": "old",
      "round": 1,
      "after": [],
      "text": "",
      "notes": "",
      "schema": "devkit",
      "worktree": "$CASES/p3/main/.claude/worktrees/old",
      "branch": "old",
      "base": "main",
      "next": {
        "step": "resolve-release-conflict",
        "reason": "the PR conflicts only in release files: .claude-plugin/marketplace.json, CHANGELOG.md, docs/catalog.md, plugins/core/.claude-plugin/plugin.json",
        "number": 11,
        "paths": [
          ".claude-plugin/marketplace.json",
          "CHANGELOG.md",
          "docs/catalog.md",
          "plugins/core/.claude-plugin/plugin.json"
        ],
        "base": "main",
        "command": [
          "node",
          "$DEV/release-merge.mjs",
          "--base",
          "main",
          "--json"
        ],
        "actor": "subagent",
        "agent": "devkit-core:tdd-implementer"
      },
      "state": "ready to run: resolve-release-conflict",
      "deliver": {
        "summary": "blocked: item 5",
        "met": 7,
        "next": {
          "step": "blocked",
          "reason": "PR #11 has merge conflicts with main",
          "item": 5,
          "conflict": true
        }
      },
      "unfinished": null,
      "sessionPrefix": "old-p"
    }
  ],
  "dispatch": [
    "old"
  ],
  "owner": [],
  "github": [],
  "stopped": [],
  "busy": [],
  "end": false
}
[exit 0]
```

Its command, `release-merge.mjs --base main`, merges `origin/main` and numbers the branch's own bump (minor) above the base's 1.0.1:

```text
(in $CASES/p3/main/.claude/worktrees/old)
$ node $DEV/release-merge.mjs --base main --json
{
  "resolved": true,
  "oldHead": "3f5c6957bc053e8fe544a3b4fbb60f20c8049f23",
  "newHead": "13018f9b62b4425a0eba706c83c8f452c24fc15d",
  "versions": {
    "packs": {
      "devkit-core": "1.1.0"
    },
    "metadata": "1.1.0"
  },
  "files": [
    ".claude-plugin/marketplace.json",
    "plugins/core/.claude-plugin/plugin.json",
    "CHANGELOG.md",
    "docs/openspec-flow.md",
    "docs/catalog.md"
  ]
}
[exit 0]
```

```text
(in $CASES/p3/main/.claude/worktrees/old)
$ git push origin old
To $CASES/p3/origin.git
   5733b3d..13018f9  old -> old
[exit 0]
```

```text
(in $CASES/p3/main/.claude/worktrees/old)
$ cat plugins/core/.claude-plugin/plugin.json .claude-plugin/marketplace.json CHANGELOG.md docs/catalog.md
{
  "name": "devkit-core",
  "version": "1.1.0",
  "description": "the devkit-core pack"
}
{
  "name": "devkit",
  "metadata": {
    "description": "two packs",
    "version": "1.1.0"
  },
  "plugins": [
    {
      "name": "devkit-openspec",
      "source": "./plugins/openspec",
      "description": "the devkit-openspec pack",
      "version": "1.0.0"
    },
    {
      "name": "devkit-core",
      "source": "./plugins/core",
      "description": "the devkit-core pack",
      "version": "1.1.0"
    }
  ]
}
# Changelog

## 1.1.0 — old lands

- **devkit-core** 1.1.0: old does its part

## 1.0.1 — landed lands

- **devkit-core** 1.0.1: landed does its part

## 1.0.0 — first release

- **devkit-openspec** 1.0.0: the flow
- **devkit-core** 1.0.0: the agents
# Catalog

| Pack | Version |
|---|---|
| devkit-core | 1.1.0 |
| devkit-openspec | 1.0.0 |
[exit 0]
```

```text
(in $CASES/p3/main/.claude/worktrees/old)
$ ls docs/adr
0001-start.md
0002-landed.md
0003-old.md
[exit 0]
```

The merge of the base touched no own file of `old` beyond its release lines, so the records stay current and auto-merge is next, as before:

```text
(in $CASES/p3/main/.claude/worktrees/old)
$ node $DEV/deliver-check.mjs old
deliver-check: old (schema devkit, ship merge, host cli, head 13018f9)
  1 met      tasks and gates: all tasks ticked; 1 gate command green in evidence.md
  2 met      reviews at head: 2 reviews at head
  3 met      findings disposed: 0 fixed, 0 refuted
  4 met      acceptance criteria proven: 1 criteria proven
  5 met      PR open at local head: PR #11 open at 13018f9
  6 met      required checks green: 2 required checks green
  7 met      conversation answered: every thread and request is answered
  8 met      PR body complete: PR body names the change, its criteria and the evidence
8/8 met: ready
next: enable-auto-merge PR #11 with --squash at 13018f9
[exit 0]
```

### A join beside a noted change

Project `p3t` (a train project, configured as P-2's). `oldt` is on the old rule (devkit-core bumped `minor` on its branch, `docs/adr/0002-oldt.md`)
and boards first; `notedt` notes devkit-openspec `minor` with `docs/adr/notedt.md`. One departure joins both: `oldt` by the
kind of its own bump, `notedt` from its note, above it.

```text
(in $CASES/p3t/main/.claude/worktrees/oldt)
$ node $DEV/deliver-check.mjs oldt --json   -> 1/8, next: implement (phase 1 has unticked tasks: 1.1)
    did: wrote src/oldt-1.ts; ticked 1.1
$ node $DEV/deliver-check.mjs oldt --json   -> 1/8, next: gate (phase 1 is implemented; run its gate 1.2)
    did: ran `node -e 0` (exit 0); ticked 1.2
$ node $DEV/deliver-check.mjs oldt --json   -> 1/8, next: commit (uncommitted changes outside openspec/: src/oldt-1.ts)
    did: git commit: 2b24d32
$ node $DEV/deliver-check.mjs oldt --json   -> 1/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at 2b24d32; git commit: 1d79fe9
$ node $DEV/deliver-check.mjs oldt --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at 1d79fe9; git commit: eede9a7
$ node $DEV/deliver-check.mjs oldt --json   -> 4/8, next: open-pr (no pull request yet)
    did: git push -u origin oldt; gh pr create -> https://github.invalid/o/devkit/pull/11
$ node $DEV/deliver-check.mjs oldt --json   -> 8/8, next: boarded (every item of the contract is met; the change leaves with the next train)
```

```text
(in $CASES/p3t/main/.claude/worktrees/notedt)
$ node $DEV/deliver-check.mjs notedt --json   -> 1/8, next: implement (phase 1 has unticked tasks: 1.1)
    did: wrote src/notedt-1.ts; ticked 1.1
$ node $DEV/deliver-check.mjs notedt --json   -> 1/8, next: gate (phase 1 is implemented; run its gate 1.2)
    did: ran `node -e 0` (exit 0); ticked 1.2
$ node $DEV/deliver-check.mjs notedt --json   -> 1/8, next: commit (uncommitted changes outside openspec/: src/notedt-1.ts)
    did: git commit: f9231ad
$ node $DEV/deliver-check.mjs notedt --json   -> 1/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at f9231ad; git commit: 28023b4
$ node $DEV/deliver-check.mjs notedt --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at 28023b4; git commit: 66e4ed8
$ node $DEV/deliver-check.mjs notedt --json   -> 4/8, next: open-pr (no pull request yet)
    did: git push -u origin notedt; gh pr create -> https://github.invalid/o/devkit/pull/12
$ node $DEV/deliver-check.mjs notedt --json   -> 8/8, next: boarded (every item of the contract is met; the change leaves with the next train)
```

```text
(in $CASES/p3t/main)
$ node $DEV/train-loop.mjs next --lang en
{
  "version": 1,
  "kind": "session",
  "step": "depart",
  "detail": {
    "background": true,
    "boarded": [
      {
        "kind": "change",
        "id": "oldt",
        "number": 11
      },
      {
        "kind": "change",
        "id": "notedt",
        "number": 12
      }
    ],
    "skipped": [],
    "command": [
      "node",
      "$DEV/train-loop.mjs",
      "depart",
      "--lang",
      "en"
    ]
  },
  "reply": null,
  "progressKey": "depart@oldt,notedt"
}
[exit 0]
```

```text
(in $CASES/p3t/main)
$ node $DEV/train-loop.mjs depart --lang en
{
  "version": 1,
  "base": "main",
  "skipped": [],
  "n": 1,
  "branch": "train/1",
  "worktree": "$CASES/p3t/main/.claude/worktrees/train-1",
  "result": "passed",
  "boarded": [
    {
      "kind": "change",
      "id": "oldt",
      "number": 11,
      "head": "0e70bba52696d9fb1ae83669bcbe72bb09cda96d",
      "at": "2026-11-24T17:38:53Z"
    },
    {
      "kind": "change",
      "id": "notedt",
      "number": 12,
      "head": "cf65e199ca4e7abfbcfb339603d082768d4e1df9",
      "at": "2026-11-24T17:38:59Z"
    }
  ],
  "left": [],
  "runs": 1
}
[exit 0]
```

```text
(in $CASES/p3t/main/.claude/worktrees/train-1)
$ git log --oneline --graph origin/main..HEAD
* ce2a4f2 chore(train): record train 1
*   590f084 chore(train): join cf65e19 and renumber its release above the train
|\  
| * cf65e19 docs(notedt): change files
| * 66e4ed8 docs(notedt): reviews
| * 28023b4 docs(notedt): evidence
| * f9231ad feat(notedt): phase work
| * 64f26bc docs(notedt): the plan of notedt
* 16bfc79 chore(train): join 0e70bba and renumber its release above the train
* 0e70bba docs(oldt): change files
* eede9a7 docs(oldt): reviews
* 1d79fe9 docs(oldt): evidence
* 2b24d32 feat(oldt): phase work
* ca1c7cc docs(oldt): the plan of oldt
[exit 0]
```

```text
(in $CASES/p3t/main/.claude/worktrees/train-1)
$ cat plugins/openspec/.claude-plugin/plugin.json plugins/core/.claude-plugin/plugin.json .claude-plugin/marketplace.json CHANGELOG.md docs/catalog.md docs/notedt.md
{
  "name": "devkit-openspec",
  "version": "1.1.0",
  "description": "the devkit-openspec pack"
}
{
  "name": "devkit-core",
  "version": "1.1.0",
  "description": "the devkit-core pack"
}
{
  "name": "devkit",
  "metadata": {
    "description": "two packs",
    "version": "1.2.0"
  },
  "plugins": [
    {
      "name": "devkit-openspec",
      "source": "./plugins/openspec",
      "description": "the devkit-openspec pack",
      "version": "1.1.0"
    },
    {
      "name": "devkit-core",
      "source": "./plugins/core",
      "description": "the devkit-core pack",
      "version": "1.1.0"
    }
  ]
}
# Changelog

## 1.2.0 — notedt lands

- **devkit-openspec** 1.1.0: notedt does its part

## 1.1.0 — oldt lands

- **devkit-core** 1.1.0: oldt does its part

## 1.0.0 — first release

- **devkit-openspec** 1.0.0: the flow
- **devkit-core** 1.0.0: the agents
# Catalog

| Pack | Version |
|---|---|
| devkit-core | 1.1.0 |
| devkit-openspec | 1.1.0 |
# notedt

See ADR 0003.
[exit 0]
```

```text
(in $CASES/p3t/main/.claude/worktrees/train-1)
$ ls docs/adr
0001-start.md
0002-oldt.md
0003-notedt.md
[exit 0]
```

```text
(in $CASES/p3t/main/.claude/worktrees/train-1)
$ node $DEV/deliver-check.mjs --ci
devkit-reviews: train 1 (openspec/trains/1.md, 2 boarded)
  change oldt (#11, head 0e70bba): pass
  change notedt (#12, head cf65e19): pass
pass
[exit 0]
```

## P-4 a consumer project with `devkit.release_tag: package.json`

AC-8, AC-9. No packs, no marketplace, no flow page and no catalog: the project's release file is `package.json` (1.4.0). Every
variant's change notes `packs: []` and `release: minor`; the first also names a record.

### With a root `CHANGELOG.md` and `docs/adr/`

```text
(in $CASES/p4a/main)
$ cat openspec/config.yaml package.json CHANGELOG.md
schema: devkit
ship:
  devkit: merge
devkit:
  release_tag: package.json
{
  "name": "app",
  "version": "1.4.0",
  "private": true
}
# Changelog

## 1.4.0 — the last release

- the app as it was
[exit 0]
```

```text
(in $CASES/p4a/main/.claude/worktrees/feature)
$ node $DEV/deliver-check.mjs feature --json   -> 1/8, next: implement (phase 1 has unticked tasks: 1.1)
    did: wrote src/feature-1.ts; ticked 1.1
$ node $DEV/deliver-check.mjs feature --json   -> 1/8, next: gate (phase 1 is implemented; run its gate 1.2)
    did: ran `node -e 0` (exit 0); ticked 1.2
$ node $DEV/deliver-check.mjs feature --json   -> 1/8, next: commit (uncommitted changes outside openspec/: src/feature-1.ts)
    did: git commit: b3a655e
$ node $DEV/deliver-check.mjs feature --json   -> 1/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at b3a655e; git commit: 8d8d229
$ node $DEV/deliver-check.mjs feature --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at 8d8d229; git commit: 635d3dc
$ node $DEV/deliver-check.mjs feature --json   -> 4/8, next: open-pr (no pull request yet)
    did: git push -u origin feature; gh pr create -> https://github.invalid/o/devkit/pull/11
$ node $DEV/deliver-check.mjs feature --json   -> 8/8, next: assign-release (the release of feature is not assigned yet; assign it before the merge)
```

```text
"next" of deliver-check <id> --json at this head:
{
  "step": "assign-release",
  "reason": "the release of feature is not assigned yet; assign it before the merge",
  "number": 11,
  "base": "main",
  "branch": "feature",
  "command": [
    "node",
    "$DEV/release-merge.mjs",
    "--assign",
    "--base",
    "main",
    "--json"
  ]
}
```

```text
(in $CASES/p4a/main/.claude/worktrees/feature)
$ git fetch origin main
From $CASES/p4a/origin
 * branch            main       -> FETCH_HEAD
[exit 0]
```

```text
(in $CASES/p4a/main/.claude/worktrees/feature)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": true,
  "oldHead": "ca4821370da74fcb39101b02ae1a976d2f08e526",
  "newHead": "2dc88db355db49e0395bc627976c7f4ec7b0fa0c",
  "versions": {
    "packs": {},
    "release": "1.5.0"
  },
  "files": [
    "package.json",
    "CHANGELOG.md"
  ],
  "change": "feature",
  "adrs": [
    {
      "from": "docs/adr/feature.md",
      "to": "docs/adr/0002-feature.md"
    }
  ],
  "citations": [
    "docs/feature.md"
  ],
  "mode": "assign"
}
[exit 0]
```

```text
(in $CASES/p4a/main/.claude/worktrees/feature)
$ git push origin feature
To $CASES/p4a/origin.git
   ca48213..2dc88db  feature -> feature
[exit 0]
```

```text
(in $CASES/p4a/main/.claude/worktrees/feature)
$ git show --stat '--format=%h %s' HEAD
2dc88db chore(release): assign the release of feature

 CHANGELOG.md                             | 4 ++++
 docs/adr/{feature.md => 0002-feature.md} | 2 +-
 docs/feature.md                          | 2 +-
 package.json                             | 2 +-
 4 files changed, 7 insertions(+), 3 deletions(-)
[exit 0]
```

```text
(in $CASES/p4a/main/.claude/worktrees/feature)
$ cat package.json CHANGELOG.md docs/feature.md
{
  "name": "app",
  "version": "1.5.0",
  "private": true
}
# Changelog

## 1.5.0 — the app gets a feature

- a feature of the app

## 1.4.0 — the last release

- the app as it was
# Feature

See ADR 0002.
[exit 0]
```

```text
(in $CASES/p4a/main/.claude/worktrees/feature)
$ git status --short   # nothing left uncommitted
(no output)
[exit 0]
```

```text
(in $CASES/p4a/main/.claude/worktrees/feature)
$ git ls-files -- . ':(exclude)openspec/schemas' ':(exclude)openspec/changes'
.github/workflows/devkit-reviews.yml
.gitignore
CHANGELOG.md
docs/adr/0001-start.md
docs/adr/0002-feature.md
docs/feature.md
openspec/config.yaml
package.json
src/app.ts
src/feature-1.ts
[exit 0]
```

```text
(in $CASES/p4a/main/.claude/worktrees/feature)
$ node $DEV/deliver-check.mjs feature
deliver-check: feature (schema devkit, ship merge, host cli, head 2dc88db)
  1 met      tasks and gates: all tasks ticked; 1 gate command green in evidence.md
  2 met      reviews at head: 2 reviews at head
  3 met      findings disposed: 0 fixed, 0 refuted
  4 met      acceptance criteria proven: 1 criteria proven
  5 met      PR open at local head: PR #11 open at 2dc88db
  6 met      required checks green: 2 required checks green
  7 met      conversation answered: every thread and request is answered
  8 met      PR body complete: PR body names the change, its criteria and the evidence
8/8 met: ready
next: enable-auto-merge PR #11 with --squash at 2dc88db
[exit 0]
```

### With no `CHANGELOG.md` and no `docs/adr/`

Only the release file is written; no changelog and no ADR folder is created.

```text
(in $CASES/p4b/main/.claude/worktrees/feature)
$ node $DEV/deliver-check.mjs feature --json   -> 1/8, next: implement (phase 1 has unticked tasks: 1.1)
    did: wrote src/feature-1.ts; ticked 1.1
$ node $DEV/deliver-check.mjs feature --json   -> 1/8, next: gate (phase 1 is implemented; run its gate 1.2)
    did: ran `node -e 0` (exit 0); ticked 1.2
$ node $DEV/deliver-check.mjs feature --json   -> 1/8, next: commit (uncommitted changes outside openspec/: src/feature-1.ts)
    did: git commit: ffd7363
$ node $DEV/deliver-check.mjs feature --json   -> 1/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at ffd7363; git commit: a990100
$ node $DEV/deliver-check.mjs feature --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at a990100; git commit: 6734128
$ node $DEV/deliver-check.mjs feature --json   -> 4/8, next: open-pr (no pull request yet)
    did: git push -u origin feature; gh pr create -> https://github.invalid/o/devkit/pull/11
$ node $DEV/deliver-check.mjs feature --json   -> 8/8, next: assign-release (the release of feature is not assigned yet; assign it before the merge)
```

```text
(in $CASES/p4b/main/.claude/worktrees/feature)
$ git fetch origin main
From $CASES/p4b/origin
 * branch            main       -> FETCH_HEAD
[exit 0]
```

```text
(in $CASES/p4b/main/.claude/worktrees/feature)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": true,
  "oldHead": "3d65a57c5bb7e24644b8633282659fcabe1ee1b3",
  "newHead": "92eb7e3983cfc408fc162548be8fb620e86f599f",
  "versions": {
    "packs": {},
    "release": "1.5.0"
  },
  "files": [
    "package.json"
  ],
  "change": "feature",
  "adrs": [],
  "citations": [],
  "mode": "assign"
}
[exit 0]
```

```text
(in $CASES/p4b/main/.claude/worktrees/feature)
$ git push origin feature
To $CASES/p4b/origin.git
   3d65a57..92eb7e3  feature -> feature
[exit 0]
```

```text
(in $CASES/p4b/main/.claude/worktrees/feature)
$ git show --stat '--format=%h %s' HEAD
92eb7e3 chore(release): assign the release of feature

 package.json | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
[exit 0]
```

```text
(in $CASES/p4b/main/.claude/worktrees/feature)
$ cat package.json
{
  "name": "app",
  "version": "1.5.0",
  "private": true
}
[exit 0]
```

```text
(in $CASES/p4b/main/.claude/worktrees/feature)
$ ls -a   # no CHANGELOG.md, no docs/
.
..
.git
.github
.gitignore
openspec
package.json
src
[exit 0]
```

```text
(in $CASES/p4b/main/.claude/worktrees/feature)
$ git status --short   # nothing left uncommitted
(no output)
[exit 0]
```

```text
(in $CASES/p4b/main/.claude/worktrees/feature)
$ git ls-files -- . ':(exclude)openspec/schemas' ':(exclude)openspec/changes'
.github/workflows/devkit-reviews.yml
.gitignore
openspec/config.yaml
package.json
src/app.ts
src/feature-1.ts
[exit 0]
```

```text
(in $CASES/p4b/main/.claude/worktrees/feature)
$ node $DEV/deliver-check.mjs feature
deliver-check: feature (schema devkit, ship merge, host cli, head 92eb7e3)
  1 met      tasks and gates: all tasks ticked; 1 gate command green in evidence.md
  2 met      reviews at head: 2 reviews at head
  3 met      findings disposed: 0 fixed, 0 refuted
  4 met      acceptance criteria proven: 1 criteria proven
  5 met      PR open at local head: PR #11 open at 92eb7e3
  6 met      required checks green: 2 required checks green
  7 met      conversation answered: every thread and request is answered
  8 met      PR body complete: PR body names the change, its criteria and the evidence
8/8 met: ready
next: enable-auto-merge PR #11 with --squash at 92eb7e3
[exit 0]
```

### The key names a file the project does not have

`devkit.release_tag: VERSION.json`, which does not exist (and no `CHANGELOG.md`): there is nothing to write, so the note is assigned at once, the checker asks no new step and the step, run by hand, writes nothing.

```text
(in $CASES/p4c/main/.claude/worktrees/feature)
$ node $DEV/deliver-check.mjs feature --json   -> 1/8, next: implement (phase 1 has unticked tasks: 1.1)
    did: wrote src/feature-1.ts; ticked 1.1
$ node $DEV/deliver-check.mjs feature --json   -> 1/8, next: gate (phase 1 is implemented; run its gate 1.2)
    did: ran `node -e 0` (exit 0); ticked 1.2
$ node $DEV/deliver-check.mjs feature --json   -> 1/8, next: commit (uncommitted changes outside openspec/: src/feature-1.ts)
    did: git commit: 60151d9
$ node $DEV/deliver-check.mjs feature --json   -> 1/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at 60151d9; git commit: 7a47f5f
$ node $DEV/deliver-check.mjs feature --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at 7a47f5f; git commit: f58b43c
$ node $DEV/deliver-check.mjs feature --json   -> 4/8, next: open-pr (no pull request yet)
    did: git push -u origin feature; gh pr create -> https://github.invalid/o/devkit/pull/11
$ node $DEV/deliver-check.mjs feature --json   -> 8/8, next: enable-auto-merge (all eight items are met)
```

```text
(in $CASES/p4c/main/.claude/worktrees/feature)
$ node $DEV/deliver-check.mjs feature
deliver-check: feature (schema devkit, ship merge, host cli, head 066a8ef)
  1 met      tasks and gates: all tasks ticked; 1 gate command green in evidence.md
  2 met      reviews at head: 2 reviews at head
  3 met      findings disposed: 0 fixed, 0 refuted
  4 met      acceptance criteria proven: 1 criteria proven
  5 met      PR open at local head: PR #11 open at 066a8ef
  6 met      required checks green: 2 required checks green
  7 met      conversation answered: every thread and request is answered
  8 met      PR body complete: PR body names the change, its criteria and the evidence
8/8 met: ready
next: enable-auto-merge PR #11 with --squash at 066a8ef
[exit 0]
```

```text
(in $CASES/p4c/main/.claude/worktrees/feature)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": true,
  "oldHead": "066a8efb36efd4b5d2d67704a5856f8318ec39c5",
  "newHead": "066a8efb36efd4b5d2d67704a5856f8318ec39c5",
  "versions": {
    "packs": {}
  },
  "files": [],
  "change": "feature",
  "adrs": [],
  "citations": [],
  "mode": "assign"
}
[exit 0]
```

```text
(in $CASES/p4c/main/.claude/worktrees/feature)
$ git status --short   # nothing left uncommitted
(no output)
[exit 0]
```

```text
(in $CASES/p4c/main/.claude/worktrees/feature)
$ git ls-files -- . ':(exclude)openspec/schemas' ':(exclude)openspec/changes'
.github/workflows/devkit-reviews.yml
.gitignore
openspec/config.yaml
package.json
src/app.ts
src/feature-1.ts
[exit 0]
```

## P-5 a consumer project with no `devkit.release_tag`

AC-9. Project `p5`: the consumer layout of P-4 (`package.json`, `CHANGELOG.md`, `docs/adr/`) with no `devkit.release_tag`. The same
commands: nothing new is asked, refused or written, whether the change has no note or carries a `release.md` (here a malformed one,
which nothing reads).

```text
(in $CASES/p5/main)
$ cat openspec/config.yaml
schema: devkit
ship:
  devkit: merge
[exit 0]
```

### A change with no note

```text
(in $CASES/p5/main/.claude/worktrees/plain)
$ node $DEV/deliver-check.mjs plain --json   -> 1/8, next: implement (phase 1 has unticked tasks: 1.1)
    did: wrote src/plain-1.ts; ticked 1.1
$ node $DEV/deliver-check.mjs plain --json   -> 1/8, next: gate (phase 1 is implemented; run its gate 1.2)
    did: ran `node -e 0` (exit 0); ticked 1.2
$ node $DEV/deliver-check.mjs plain --json   -> 1/8, next: commit (uncommitted changes outside openspec/: src/plain-1.ts)
    did: git commit: 455b188
$ node $DEV/deliver-check.mjs plain --json   -> 1/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at 455b188; git commit: 736e0c4
$ node $DEV/deliver-check.mjs plain --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at 736e0c4; git commit: bad8ea4
$ node $DEV/deliver-check.mjs plain --json   -> 4/8, next: open-pr (no pull request yet)
    did: git push -u origin plain; gh pr create -> https://github.invalid/o/devkit/pull/11
$ node $DEV/deliver-check.mjs plain --json   -> 8/8, next: enable-auto-merge (all eight items are met)
```

```text
(in $CASES/p5/main/.claude/worktrees/plain)
$ node $DEV/deliver-check.mjs plain
deliver-check: plain (schema devkit, ship merge, host cli, head 257f680)
  1 met      tasks and gates: all tasks ticked; 1 gate command green in evidence.md
  2 met      reviews at head: 2 reviews at head
  3 met      findings disposed: 0 fixed, 0 refuted
  4 met      acceptance criteria proven: 1 criteria proven
  5 met      PR open at local head: PR #11 open at 257f680
  6 met      required checks green: 2 required checks green
  7 met      conversation answered: every thread and request is answered
  8 met      PR body complete: PR body names the change, its criteria and the evidence
8/8 met: ready
next: enable-auto-merge PR #11 with --squash at 257f680
[exit 0]
```

```text
(in $CASES/p5/main/.claude/worktrees/plain)
$ node $DEV/deliver-check.mjs plain --json   # its "approval" field: the four keys of a change with no note
{
  "approval": {
    "status": "APPROVED",
    "recorded": "sha256:edca2b2917b2",
    "readiness": "sha256:edca2b2917b2",
    "ok": true
  }
}
[exit 0]
```

```text
(in $CASES/p5/main/.claude/worktrees/plain)
$ git status --short   # nothing left uncommitted
(no output)
[exit 0]
```

```text
(in $CASES/p5/main/.claude/worktrees/plain)
$ git ls-files -- . ':(exclude)openspec/schemas' ':(exclude)openspec/changes'
.github/workflows/devkit-reviews.yml
.gitignore
CHANGELOG.md
docs/adr/0001-start.md
openspec/config.yaml
package.json
src/app.ts
src/plain-1.ts
[exit 0]
```

### A change that carries a `release.md` nothing reads

```text
(in $CASES/p5/main/.claude/worktrees/noted)
$ node $DEV/deliver-check.mjs noted --json   -> 1/8, next: implement (phase 1 has unticked tasks: 1.1)
    did: wrote src/noted-1.ts; ticked 1.1
$ node $DEV/deliver-check.mjs noted --json   -> 1/8, next: gate (phase 1 is implemented; run its gate 1.2)
    did: ran `node -e 0` (exit 0); ticked 1.2
$ node $DEV/deliver-check.mjs noted --json   -> 1/8, next: commit (uncommitted changes outside openspec/: src/noted-1.ts)
    did: git commit: 3dbe1d3
$ node $DEV/deliver-check.mjs noted --json   -> 1/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at 3dbe1d3; git commit: e53607a
$ node $DEV/deliver-check.mjs noted --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at e53607a; git commit: e4d4698
$ node $DEV/deliver-check.mjs noted --json   -> 4/8, next: open-pr (no pull request yet)
    did: git push -u origin noted; gh pr create -> https://github.invalid/o/devkit/pull/12
$ node $DEV/deliver-check.mjs noted --json   -> 8/8, next: enable-auto-merge (all eight items are met)
```

```text
(in $CASES/p5/main/.claude/worktrees/noted)
$ node $DEV/deliver-check.mjs noted
deliver-check: noted (schema devkit, ship merge, host cli, head 5bec118)
  1 met      tasks and gates: all tasks ticked; 1 gate command green in evidence.md
  2 met      reviews at head: 2 reviews at head
  3 met      findings disposed: 0 fixed, 0 refuted
  4 met      acceptance criteria proven: 1 criteria proven
  5 met      PR open at local head: PR #12 open at 5bec118
  6 met      required checks green: 2 required checks green
  7 met      conversation answered: every thread and request is answered
  8 met      PR body complete: PR body names the change, its criteria and the evidence
8/8 met: ready
next: enable-auto-merge PR #12 with --squash at 5bec118
[exit 0]
```

The step, run by hand, refuses to run in a project with no release setting and writes nothing (the checker never asks for it there):

```text
(in $CASES/p5/main/.claude/worktrees/noted)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": false,
  "oldHead": "5bec1187ed25cf0460ba8a1d52e8660beb3856d7",
  "conflicts": [],
  "error": "openspec/config.yaml names no devkit.release_tag: this project has no release to assign",
  "mode": "assign"
}
[exit 2]
```

```text
(in $CASES/p5/main/.claude/worktrees/noted)
$ git status --short   # nothing left uncommitted
(no output)
[exit 0]
```

```text
(in $CASES/p5/main/.claude/worktrees/noted)
$ git ls-files -- . ':(exclude)openspec/schemas' ':(exclude)openspec/changes'
.github/workflows/devkit-reviews.yml
.gitignore
CHANGELOG.md
docs/adr/0001-start.md
openspec/config.yaml
package.json
src/app.ts
src/noted-1.ts
[exit 0]
```

```text
(in $CASES/p5/main/.claude/worktrees/noted)
$ cat package.json CHANGELOG.md
{
  "name": "app",
  "version": "1.4.0",
  "private": true
}
# Changelog

## 1.4.0 — the last release

- the app as it was
[exit 0]
```

## P-6 refusal: a version edited by hand

AC-2. Project `p6` (the seed). Change `hand` notes devkit-openspec `patch`, but its code task also sets devkit-core's version to
1.0.5 in `plugins/core/.claude-plugin/plugin.json`, a release line the delivery writes.

```text
(in $CASES/p6/main/.claude/worktrees/hand)
$ node $DEV/deliver-check.mjs hand --json   -> 1/8, next: implement (phase 1 has unticked tasks: 1.1)
    did: wrote src/hand-1.ts and plugins/core/.claude-plugin/plugin.json; ticked 1.1
$ node $DEV/deliver-check.mjs hand --json   -> 1/8, next: gate (phase 1 is implemented; run its gate 1.2)
    did: ran `node -e 0` (exit 0); ticked 1.2
$ node $DEV/deliver-check.mjs hand --json   -> 1/8, next: commit (uncommitted changes outside openspec/: plugins/core/.claude-plugin/plugin.json, src/hand-1.ts)
    did: git commit: e36dcb6
$ node $DEV/deliver-check.mjs hand --json   -> 1/8, next: blocked (release lines edited by hand: plugins/core/.claude-plugin/plugin.json)
```

```text
(in $CASES/p6/main/.claude/worktrees/hand)
$ node $DEV/deliver-check.mjs hand
deliver-check: hand (schema devkit, ship merge, host cli, head e36dcb6)
  1 open     tasks and gates: evidence.md is missing; no passing row in evidence.md for `node -e 0`
  2 open     reviews at head: missing code-quality-reviewer, test-coverage-reviewer
  3 met      findings disposed: 0 fixed, 0 refuted
  4 open     acceptance criteria proven: evidence.md is missing; no proof row for AC-1
  5 open     PR open at local head: no pull request for this branch yet
  6 open     required checks green: no pull request for this branch yet
  7 open     conversation answered: no pull request for this branch yet
  8 open     PR body complete: no pull request for this branch yet
1/8 met: in progress: item 1
next: blocked release lines edited by hand: plugins/core/.claude-plugin/plugin.json
[exit 1]
```

```text
(in $CASES/p6/main/.claude/worktrees/hand)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": false,
  "oldHead": "e36dcb62600010d12f0c3537c35dbf98685b3d08",
  "change": "hand",
  "conflicts": [],
  "error": "release lines edited by hand: plugins/core/.claude-plugin/plugin.json",
  "mode": "assign"
}
[exit 2]
```

The fix: the implementer puts the line back as the base has it; the run goes on to the release step, which writes the release from the note:

```text
(in $CASES/p6/main/.claude/worktrees/hand)
$ git checkout origin/main -- plugins/core/.claude-plugin/plugin.json
(no output)
[exit 0]
```

```text
(in $CASES/p6/main/.claude/worktrees/hand)
$ git commit -q -m 'fix(hand): leave the release lines to the delivery'
(no output)
[exit 0]
```

```text
(in $CASES/p6/main/.claude/worktrees/hand)
$ node $DEV/deliver-check.mjs hand --json   -> 1/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at edeb72f; git commit: e41a225
$ node $DEV/deliver-check.mjs hand --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at e41a225; git commit: 344aed0
$ node $DEV/deliver-check.mjs hand --json   -> 4/8, next: open-pr (no pull request yet)
    did: git push -u origin hand; gh pr create -> https://github.invalid/o/devkit/pull/11
$ node $DEV/deliver-check.mjs hand --json   -> 8/8, next: assign-release (the release of hand is not assigned yet; assign it before the merge)
```

```text
(in $CASES/p6/main/.claude/worktrees/hand)
$ git fetch origin main
From $CASES/p6/origin
 * branch            main       -> FETCH_HEAD
[exit 0]
```

```text
(in $CASES/p6/main/.claude/worktrees/hand)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": true,
  "oldHead": "0afa3a037efc26adde1c659867073ff86c0e1930",
  "newHead": "227b495fc98707385080a6ae1d60cffbc7fcba75",
  "versions": {
    "packs": {
      "devkit-openspec": "1.0.1"
    },
    "metadata": "1.0.1"
  },
  "files": [
    "plugins/openspec/.claude-plugin/plugin.json",
    ".claude-plugin/marketplace.json",
    "CHANGELOG.md",
    "docs/openspec-flow.md",
    "docs/catalog.md"
  ],
  "change": "hand",
  "adrs": [],
  "citations": [],
  "mode": "assign"
}
[exit 0]
```

```text
(in $CASES/p6/main/.claude/worktrees/hand)
$ git push origin hand
To $CASES/p6/origin.git
   0afa3a0..227b495  hand -> hand
[exit 0]
```

```text
(in $CASES/p6/main/.claude/worktrees/hand)
$ node $DEV/deliver-check.mjs hand
deliver-check: hand (schema devkit, ship merge, host cli, head 227b495)
  1 met      tasks and gates: all tasks ticked; 1 gate command green in evidence.md
  2 met      reviews at head: 2 reviews at head
  3 met      findings disposed: 0 fixed, 0 refuted
  4 met      acceptance criteria proven: 1 criteria proven
  5 met      PR open at local head: PR #11 open at 227b495
  6 met      required checks green: 2 required checks green
  7 met      conversation answered: every thread and request is answered
  8 met      PR body complete: PR body names the change, its criteria and the evidence
8/8 met: ready
next: enable-auto-merge PR #11 with --squash at 227b495
[exit 0]
```

```text
(in $CASES/p6/main/.claude/worktrees/hand)
$ cat plugins/core/.claude-plugin/plugin.json plugins/openspec/.claude-plugin/plugin.json
{
  "name": "devkit-core",
  "version": "1.0.0",
  "description": "the devkit-core pack"
}
{
  "name": "devkit-openspec",
  "version": "1.0.1",
  "description": "the devkit-openspec pack"
}
[exit 0]
```

## P-7 refusal: no release; then `packs: []` passes

AC-11. Project `p7` (the seed). Change `nonote` (schema `devkit-lite`) has no note and no bump of its own, and its code task edits
`plugins/core/README.md`, a file of the devkit-core pack.

```text
(in $CASES/p7/main/.claude/worktrees/nonote)
$ node $DEV/deliver-check.mjs nonote --json   -> 1/8, next: implement (phase 1 has unticked tasks: 1.1)
    did: wrote src/nonote-1.ts and plugins/core/README.md; ticked 1.1
$ node $DEV/deliver-check.mjs nonote --json   -> 1/8, next: gate (phase 1 is implemented; run its gate 1.2)
    did: ran `node -e 0` (exit 0); ticked 1.2
$ node $DEV/deliver-check.mjs nonote --json   -> 1/8, next: commit (uncommitted changes outside openspec/: plugins/core/README.md, src/nonote-1.ts)
    did: git commit: 6f6be6f
$ node $DEV/deliver-check.mjs nonote --json   -> 1/8, next: blocked (no release: plugins/core: the change has no release note and no version bump of its own; write openspec/changes/nonote/release.md)
```

```text
(in $CASES/p7/main/.claude/worktrees/nonote)
$ node $DEV/deliver-check.mjs nonote
deliver-check: nonote (schema devkit-lite, ship merge, host cli, head 6f6be6f)
  1 open     tasks and gates: evidence.md is missing; no passing row in evidence.md for `node -e 0`
  2 open     reviews at head: missing code-quality-reviewer, test-coverage-reviewer
  3 met      findings disposed: 0 fixed, 0 refuted
  4 open     acceptance criteria proven: evidence.md is missing; no proof row for AC-1
  5 open     PR open at local head: no pull request for this branch yet
  6 open     required checks green: no pull request for this branch yet
  7 open     conversation answered: no pull request for this branch yet
  8 open     PR body complete: no pull request for this branch yet
1/8 met: in progress: item 1
next: blocked no release: plugins/core: the change has no release note and no version bump of its own; write openspec/changes/nonote/release.md
[exit 1]
```

The fix: the change states that it releases nothing, in a note of `packs: []`; with nothing to write the note is assigned at once, so no `assign-release` is asked and the run goes on to `enable-auto-merge`:

```text
(in $CASES/p7/main/.claude/worktrees/nonote)
$ git add openspec/changes/nonote/release.md
(no output)
[exit 0]
```

```text
(in $CASES/p7/main/.claude/worktrees/nonote)
$ git commit -q -m 'docs(nonote): the release note: no release'
(no output)
[exit 0]
```

```text
(in $CASES/p7/main/.claude/worktrees/nonote)
$ git show '--format=%h %s' HEAD
1a1dc49 docs(nonote): the release note: no release

diff --git a/openspec/changes/nonote/release.md b/openspec/changes/nonote/release.md
new file mode 100644
index 0000000..03309a0
--- /dev/null
+++ b/openspec/changes/nonote/release.md
@@ -0,0 +1 @@
+packs: []
[exit 0]
```

```text
(in $CASES/p7/main/.claude/worktrees/nonote)
$ node $DEV/deliver-check.mjs nonote --json   -> 1/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at 1a1dc49; git commit: b0ca0ba
$ node $DEV/deliver-check.mjs nonote --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at b0ca0ba; git commit: 7141772
$ node $DEV/deliver-check.mjs nonote --json   -> 4/8, next: open-pr (no pull request yet)
    did: git push -u origin nonote; gh pr create -> https://github.invalid/o/devkit/pull/11
$ node $DEV/deliver-check.mjs nonote --json   -> 8/8, next: enable-auto-merge (all eight items are met)
```

```text
(in $CASES/p7/main/.claude/worktrees/nonote)
$ node $DEV/deliver-check.mjs nonote
deliver-check: nonote (schema devkit-lite, ship merge, host cli, head 05e7fa2)
  1 met      tasks and gates: all tasks ticked; 1 gate command green in evidence.md
  2 met      reviews at head: 2 reviews at head
  3 met      findings disposed: 0 fixed, 0 refuted
  4 met      acceptance criteria proven: 1 criteria proven
  5 met      PR open at local head: PR #11 open at 05e7fa2
  6 met      required checks green: 2 required checks green
  7 met      conversation answered: every thread and request is answered
  8 met      PR body complete: PR body names the change, its criteria and the evidence
8/8 met: ready
next: enable-auto-merge PR #11 with --squash at 05e7fa2
[exit 0]
```

### The same refusal for an unnumbered record listed with no note

Change `noadr` (schema `devkit-lite`) lists `docs/adr/noadr.md` in its `decisions.md` and has no note:

```text
(in $CASES/p7/main/.claude/worktrees/noadr)
$ node $DEV/deliver-check.mjs noadr --json   -> 1/8, next: implement (phase 1 has unticked tasks: 1.1)
    did: wrote src/noadr-1.ts; ticked 1.1
$ node $DEV/deliver-check.mjs noadr --json   -> 1/8, next: gate (phase 1 is implemented; run its gate 1.2)
    did: ran `node -e 0` (exit 0); ticked 1.2
$ node $DEV/deliver-check.mjs noadr --json   -> 1/8, next: commit (uncommitted changes outside openspec/: src/noadr-1.ts)
    did: git commit: dd5024a
$ node $DEV/deliver-check.mjs noadr --json   -> 1/8, next: blocked (no release: docs/adr/noadr.md: the change has no release note and no version bump of its own; write openspec/changes/noadr/release.md)
```

```text
(in $CASES/p7/main/.claude/worktrees/noadr)
$ node $DEV/deliver-check.mjs noadr
deliver-check: noadr (schema devkit-lite, ship merge, host cli, head dd5024a)
  1 open     tasks and gates: evidence.md is missing; no passing row in evidence.md for `node -e 0`
  2 open     reviews at head: missing code-quality-reviewer, test-coverage-reviewer
  3 met      findings disposed: 0 fixed, 0 refuted
  4 open     acceptance criteria proven: evidence.md is missing; no proof row for AC-1
  5 open     PR open at local head: no pull request for this branch yet
  6 open     required checks green: no pull request for this branch yet
  7 open     conversation answered: no pull request for this branch yet
  8 open     PR body complete: no pull request for this branch yet
1/8 met: in progress: item 1
next: blocked no release: docs/adr/noadr.md: the change has no release note and no version bump of its own; write openspec/changes/noadr/release.md
[exit 1]
```

The fix: a note of `packs: []`; the record is then numbered by the release step:

```text
(in $CASES/p7/main/.claude/worktrees/noadr)
$ git add openspec/changes/noadr/release.md
(no output)
[exit 0]
```

```text
(in $CASES/p7/main/.claude/worktrees/noadr)
$ git commit -q -m 'docs(noadr): the release note: no release'
(no output)
[exit 0]
```

```text
(in $CASES/p7/main/.claude/worktrees/noadr)
$ git show '--format=%h %s' HEAD
1229735 docs(noadr): the release note: no release

diff --git a/openspec/changes/noadr/release.md b/openspec/changes/noadr/release.md
new file mode 100644
index 0000000..03309a0
--- /dev/null
+++ b/openspec/changes/noadr/release.md
@@ -0,0 +1 @@
+packs: []
[exit 0]
```

```text
(in $CASES/p7/main/.claude/worktrees/noadr)
$ node $DEV/deliver-check.mjs noadr --json   -> 1/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at 1229735; git commit: b670004
$ node $DEV/deliver-check.mjs noadr --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at b670004; git commit: 806e5ca
$ node $DEV/deliver-check.mjs noadr --json   -> 4/8, next: open-pr (no pull request yet)
    did: git push -u origin noadr; gh pr create -> https://github.invalid/o/devkit/pull/12
$ node $DEV/deliver-check.mjs noadr --json   -> 8/8, next: assign-release (the release of noadr is not assigned yet; assign it before the merge)
```

```text
(in $CASES/p7/main/.claude/worktrees/noadr)
$ git fetch origin main
From $CASES/p7/origin
 * branch            main       -> FETCH_HEAD
[exit 0]
```

```text
(in $CASES/p7/main/.claude/worktrees/noadr)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": true,
  "oldHead": "2092bbf7c2e77363dea86f739cd1d76c386981c5",
  "newHead": "b953b9c4d0d5008872facc8f0eec513c30f4116e",
  "versions": {
    "packs": {}
  },
  "files": [],
  "change": "noadr",
  "adrs": [
    {
      "from": "docs/adr/noadr.md",
      "to": "docs/adr/0002-noadr.md"
    }
  ],
  "citations": [],
  "mode": "assign"
}
[exit 0]
```

```text
(in $CASES/p7/main/.claude/worktrees/noadr)
$ git push origin noadr
To $CASES/p7/origin.git
   2092bbf..b953b9c  noadr -> noadr
[exit 0]
```

```text
(in $CASES/p7/main/.claude/worktrees/noadr)
$ node $DEV/deliver-check.mjs noadr
deliver-check: noadr (schema devkit-lite, ship merge, host cli, head b953b9c)
  1 met      tasks and gates: all tasks ticked; 1 gate command green in evidence.md
  2 met      reviews at head: 2 reviews at head
  3 met      findings disposed: 0 fixed, 0 refuted
  4 met      acceptance criteria proven: 1 criteria proven
  5 met      PR open at local head: PR #12 open at b953b9c
  6 met      required checks green: 2 required checks green
  7 met      conversation answered: every thread and request is answered
  8 met      PR body complete: PR body names the change, its criteria and the evidence
8/8 met: ready
next: enable-auto-merge PR #12 with --squash at b953b9c
[exit 0]
```

```text
(in $CASES/p7/main/.claude/worktrees/noadr)
$ ls docs/adr
0001-start.md
0002-noadr.md
[exit 0]
```

## P-8 refusal: the note changed after the approval

AC-12. Project `p8` (the seed). Change `late` (schema `devkit`) was approved with its note (devkit-core `patch`); its
`approval.md` records the note's hash. After the work is done and the pull request is open, the note is changed to `minor`.

```text
(in $CASES/p8/main/.claude/worktrees/late)
$ cat openspec/changes/late/approval.md
<!-- devkit-stage approval result=passed attempt=1 commit=b6a2cef27acaa5f110f02f72908cd50c4f8e00bd -->
# Plan approval: late

- Status: APPROVED
- Readiness: sha256:3d0e48be1566
- Release note: sha256:17784ac3cb27
- Date: 2026-11-24
- Owner's words: "`Aprovo`"
[exit 0]
```

```text
(in $CASES/p8/main/.claude/worktrees/late)
$ node $DEV/deliver-check.mjs late --json   -> 1/8, next: implement (phase 1 has unticked tasks: 1.1)
    did: wrote src/late-1.ts; ticked 1.1
$ node $DEV/deliver-check.mjs late --json   -> 1/8, next: gate (phase 1 is implemented; run its gate 1.2)
    did: ran `node -e 0` (exit 0); ticked 1.2
$ node $DEV/deliver-check.mjs late --json   -> 1/8, next: commit (uncommitted changes outside openspec/: src/late-1.ts)
    did: git commit: d5322a7
$ node $DEV/deliver-check.mjs late --json   -> 1/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at d5322a7; git commit: 2277d59
$ node $DEV/deliver-check.mjs late --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at 2277d59; git commit: 201d1cf
$ node $DEV/deliver-check.mjs late --json   -> 4/8, next: open-pr (no pull request yet)
    did: git push -u origin late; gh pr create -> https://github.invalid/o/devkit/pull/11
$ node $DEV/deliver-check.mjs late --json   -> 8/8, next: assign-release (the release of late is not assigned yet; assign it before the merge)
```

```text
(in $CASES/p8/main/.claude/worktrees/late)
$ git commit -q -am 'docs(late): a bigger release'
(no output)
[exit 0]
```

```text
(in $CASES/p8/main/.claude/worktrees/late)
$ git show '--format=%h %s' HEAD
3d69166 docs(late): a bigger release

diff --git a/openspec/changes/late/release.md b/openspec/changes/late/release.md
index 994700d..541fcad 100644
--- a/openspec/changes/late/release.md
+++ b/openspec/changes/late/release.md
@@ -1,5 +1,5 @@
 packs:
-- devkit-core: patch
+- devkit-core: minor
 
 ## late lands
 
[exit 0]
```

```text
(in $CASES/p8/main/.claude/worktrees/late)
$ sha256sum openspec/changes/late/release.md
af3ed4c72b840a23709ca12aa7f746d8ef3412dfb24d3c9a4a6971a89258c7fb  openspec/changes/late/release.md
[exit 0]
```

```text
(in $CASES/p8/main/.claude/worktrees/late)
$ node $DEV/deliver-check.mjs late
deliver-check: late (schema devkit, ship merge, host cli, head 3d69166)
  1 met      tasks and gates: all tasks ticked; 1 gate command green in evidence.md
  2 met      reviews at head: 2 reviews at head
  3 met      findings disposed: 0 fixed, 0 refuted
  4 met      acceptance criteria proven: 1 criteria proven
  5 open     PR open at local head: local is ahead of PR head 2b4bb7c; push
  6 met      required checks green: 2 required checks green
  7 met      conversation answered: every thread and request is answered
  8 met      PR body complete: PR body names the change, its criteria and the evidence
7/8 met: waiting for the owner's plan approval
next: stop-plan-approval: release note changed after approval
[exit 1]
```

```text
"next" of deliver-check <id> --json at this head:
{
  "step": "stop-plan-approval",
  "reason": "release note changed after approval",
  "readiness": "sha256:3d0e48be1566",
  "release": "sha256:af3ed4c72b84",
  "file": "openspec/changes/late/approval.md"
}
```

The session stops and asks the owner; once the owner's own message approves again, it writes `approval.md` as the `stop-plan-approval` row says, with `next.readiness` and `- Release note: <next.release>`, and runs the loop again:

```text
(in $CASES/p8/main/.claude/worktrees/late)
$ cat openspec/changes/late/approval.md
<!-- devkit-stage approval result=passed attempt=2 commit=3d6916687d82cbc834a6ca779c68a61cef97588f -->
# Plan approval: late

- Status: APPROVED
- Readiness: sha256:3d0e48be1566
- Release note: sha256:af3ed4c72b84
- Date: 2026-11-24
- Owner's words: "`Aprovo`"
[exit 0]
```

```text
(in $CASES/p8/main/.claude/worktrees/late)
$ git commit -q -am 'docs(late): the owner approves the plan again'
(no output)
[exit 0]
```

```text
(in $CASES/p8/main/.claude/worktrees/late)
$ node $DEV/deliver-check.mjs late --json   -> 7/8, next: push (local is ahead of PR head 2b4bb7c; push)
    did: git push origin late
$ node $DEV/deliver-check.mjs late --json   -> 8/8, next: assign-release (the release of late is not assigned yet; assign it before the merge)
```

```text
(in $CASES/p8/main/.claude/worktrees/late)
$ git fetch origin main
From $CASES/p8/origin
 * branch            main       -> FETCH_HEAD
[exit 0]
```

```text
(in $CASES/p8/main/.claude/worktrees/late)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": true,
  "oldHead": "bff25bd3e2d4997c1de7fd0f150e5881cc5deeda",
  "newHead": "65d210d65b30d4992ce9bc42958326886c8d1a9b",
  "versions": {
    "packs": {
      "devkit-core": "1.1.0"
    },
    "metadata": "1.1.0"
  },
  "files": [
    "plugins/core/.claude-plugin/plugin.json",
    ".claude-plugin/marketplace.json",
    "CHANGELOG.md",
    "docs/catalog.md"
  ],
  "change": "late",
  "adrs": [],
  "citations": [],
  "mode": "assign"
}
[exit 0]
```

```text
(in $CASES/p8/main/.claude/worktrees/late)
$ git push origin late
To $CASES/p8/origin.git
   bff25bd..65d210d  late -> late
[exit 0]
```

```text
(in $CASES/p8/main/.claude/worktrees/late)
$ node $DEV/deliver-check.mjs late
deliver-check: late (schema devkit, ship merge, host cli, head 65d210d)
  1 met      tasks and gates: all tasks ticked; 1 gate command green in evidence.md
  2 met      reviews at head: 2 reviews at head
  3 met      findings disposed: 0 fixed, 0 refuted
  4 met      acceptance criteria proven: 1 criteria proven
  5 met      PR open at local head: PR #11 open at 65d210d
  6 met      required checks green: 2 required checks green
  7 met      conversation answered: every thread and request is answered
  8 met      PR body complete: PR body names the change, its criteria and the evidence
8/8 met: ready
next: enable-auto-merge PR #11 with --squash at 65d210d
[exit 0]
```

```text
(in $CASES/p8/main/.claude/worktrees/late)
$ cat plugins/core/.claude-plugin/plugin.json
{
  "name": "devkit-core",
  "version": "1.1.0",
  "description": "the devkit-core pack"
}
[exit 0]
```

## P-9 refusal: an unlanded citation; the cited change lands; the citation is rewritten

AC-7. Project `p9` (the seed). Change `cited` names `docs/adr/cited.md`. Change `citing` names `docs/adr/citing.md` and writes
`Amends ADR [cited]` in `docs/citing.md`. Both note a devkit-openspec `patch`.

```text
(in $CASES/p9/main/.claude/worktrees/citing)
$ node $DEV/deliver-check.mjs citing --json   -> 1/8, next: implement (phase 1 has unticked tasks: 1.1)
    did: wrote src/citing-1.ts; ticked 1.1
$ node $DEV/deliver-check.mjs citing --json   -> 1/8, next: gate (phase 1 is implemented; run its gate 1.2)
    did: ran `node -e 0` (exit 0); ticked 1.2
$ node $DEV/deliver-check.mjs citing --json   -> 1/8, next: commit (uncommitted changes outside openspec/: src/citing-1.ts)
    did: git commit: 87dbcd0
$ node $DEV/deliver-check.mjs citing --json   -> 1/8, next: blocked (ADR [cited] is cited but has not landed on main)
```

```text
(in $CASES/p9/main/.claude/worktrees/citing)
$ node $DEV/deliver-check.mjs citing
deliver-check: citing (schema devkit, ship merge, host cli, head 87dbcd0)
  1 open     tasks and gates: evidence.md is missing; no passing row in evidence.md for `node -e 0`
  2 open     reviews at head: missing code-quality-reviewer, test-coverage-reviewer
  3 met      findings disposed: 0 fixed, 0 refuted
  4 open     acceptance criteria proven: evidence.md is missing; no proof row for AC-1
  5 open     PR open at local head: no pull request for this branch yet
  6 open     required checks green: no pull request for this branch yet
  7 open     conversation answered: no pull request for this branch yet
  8 open     PR body complete: no pull request for this branch yet
1/8 met: in progress: item 1
next: blocked ADR [cited] is cited but has not landed on main
[exit 1]
```

```text
(in $CASES/p9/main/.claude/worktrees/citing)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": false,
  "oldHead": "87dbcd08efa9d3e119fd8e2b8b7618d5b8f450bd",
  "change": "citing",
  "conflicts": [],
  "error": "ADR [cited] is cited but has not landed on main; it lands with its own change",
  "mode": "assign"
}
[exit 2]
```

`cited` is delivered first: its release step numbers it 0002, auto-merge is enabled and GitHub merges it:

```text
(in $CASES/p9/main/.claude/worktrees/cited)
$ node $DEV/deliver-check.mjs cited --json   -> 1/8, next: implement (phase 1 has unticked tasks: 1.1)
    did: wrote src/cited-1.ts; ticked 1.1
$ node $DEV/deliver-check.mjs cited --json   -> 1/8, next: gate (phase 1 is implemented; run its gate 1.2)
    did: ran `node -e 0` (exit 0); ticked 1.2
$ node $DEV/deliver-check.mjs cited --json   -> 1/8, next: commit (uncommitted changes outside openspec/: src/cited-1.ts)
    did: git commit: a3f09da
$ node $DEV/deliver-check.mjs cited --json   -> 1/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at a3f09da; git commit: 5e65051
$ node $DEV/deliver-check.mjs cited --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at 5e65051; git commit: 7b1687e
$ node $DEV/deliver-check.mjs cited --json   -> 4/8, next: open-pr (no pull request yet)
    did: git push -u origin cited; gh pr create -> https://github.invalid/o/devkit/pull/11
$ node $DEV/deliver-check.mjs cited --json   -> 8/8, next: assign-release (the release of cited is not assigned yet; assign it before the merge)
```

```text
(in $CASES/p9/main/.claude/worktrees/cited)
$ git fetch origin main
From $CASES/p9/origin
 * branch            main       -> FETCH_HEAD
[exit 0]
```

```text
(in $CASES/p9/main/.claude/worktrees/cited)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": true,
  "oldHead": "526aa906cca5ec6128ee1278ef2143899c4234f8",
  "newHead": "5cafb5c050854aba6636994c743eca635c586afb",
  "versions": {
    "packs": {
      "devkit-openspec": "1.0.1"
    },
    "metadata": "1.0.1"
  },
  "files": [
    "plugins/openspec/.claude-plugin/plugin.json",
    ".claude-plugin/marketplace.json",
    "CHANGELOG.md",
    "docs/openspec-flow.md",
    "docs/catalog.md"
  ],
  "change": "cited",
  "adrs": [
    {
      "from": "docs/adr/cited.md",
      "to": "docs/adr/0002-cited.md"
    }
  ],
  "citations": [],
  "mode": "assign"
}
[exit 0]
```

```text
(in $CASES/p9/main/.claude/worktrees/cited)
$ git push origin cited
To $CASES/p9/origin.git
   526aa90..5cafb5c  cited -> cited
[exit 0]
```

```text
(in $CASES/p9/main/.claude/worktrees/cited)
$ gh pr merge 11 --auto --squash --match-head-commit 5cafb5c050854aba6636994c743eca635c586afb
(no output)
[exit 0]
```

```text
(in $CASES/p9/main)
$ gh __merge 11   # the stub: GitHub merges the pull request once its rules pass
1776355f53bde07d011e86bfeb58e78ae6b244d0
[exit 0]
```

`citing` again, after a fetch: the citation has landed, so the checker no longer blocks and the run goes on to the release step, which rewrites the citation to the number `cited` took and numbers `citing`'s own record above it:

```text
(in $CASES/p9/main/.claude/worktrees/citing)
$ git fetch origin
From $CASES/p9/origin
   ed00354..1776355  main       -> origin/main
[exit 0]
```

```text
(in $CASES/p9/main/.claude/worktrees/citing)
$ node $DEV/deliver-check.mjs citing --json   -> 1/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at 87dbcd0; git commit: fb71063
$ node $DEV/deliver-check.mjs citing --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at fb71063; git commit: c930e72
$ node $DEV/deliver-check.mjs citing --json   -> 4/8, next: open-pr (no pull request yet)
    did: git push -u origin citing; gh pr create -> https://github.invalid/o/devkit/pull/12
$ node $DEV/deliver-check.mjs citing --json   -> 7/8, next: assign-release (branch is behind main; update it)
```

```text
(in $CASES/p9/main/.claude/worktrees/citing)
$ git fetch origin main
From $CASES/p9/origin
 * branch            main       -> FETCH_HEAD
[exit 0]
```

```text
(in $CASES/p9/main/.claude/worktrees/citing)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": true,
  "oldHead": "f28bddf8552aa625443792452cad9ce70a8720dc",
  "newHead": "b29ee56bf7d76eb743727f45b99ddb207ece6849",
  "versions": {
    "packs": {
      "devkit-openspec": "1.0.2"
    },
    "metadata": "1.0.2"
  },
  "files": [
    "plugins/openspec/.claude-plugin/plugin.json",
    ".claude-plugin/marketplace.json",
    "CHANGELOG.md",
    "docs/openspec-flow.md",
    "docs/catalog.md"
  ],
  "change": "citing",
  "adrs": [
    {
      "from": "docs/adr/citing.md",
      "to": "docs/adr/0003-citing.md"
    }
  ],
  "citations": [
    "docs/citing.md"
  ],
  "mode": "assign"
}
[exit 0]
```

```text
(in $CASES/p9/main/.claude/worktrees/citing)
$ git push origin citing
To $CASES/p9/origin.git
   f28bddf..b29ee56  citing -> citing
[exit 0]
```

```text
(in $CASES/p9/main/.claude/worktrees/citing)
$ node $DEV/deliver-check.mjs citing
deliver-check: citing (schema devkit, ship merge, host cli, head b29ee56)
  1 met      tasks and gates: all tasks ticked; 1 gate command green in evidence.md
  2 met      reviews at head: 2 reviews at head
  3 met      findings disposed: 0 fixed, 0 refuted
  4 met      acceptance criteria proven: 1 criteria proven
  5 met      PR open at local head: PR #12 open at b29ee56
  6 met      required checks green: 2 required checks green
  7 met      conversation answered: every thread and request is answered
  8 met      PR body complete: PR body names the change, its criteria and the evidence
8/8 met: ready
next: enable-auto-merge PR #12 with --squash at b29ee56
[exit 0]
```

```text
(in $CASES/p9/main/.claude/worktrees/citing)
$ cat docs/citing.md
# citing

This rule is ADR 0003. Amends ADR 0002.
[exit 0]
```

```text
(in $CASES/p9/main/.claude/worktrees/citing)
$ ls docs/adr
0001-start.md
0002-cited.md
0003-citing.md
[exit 0]
```

## P-10 refusal: a duplicate slug; `check.py` on the branch and on `main`

AC-6. Project `p10` (the seed). Two changes pick the same slug: `cache` names its record of the store topic `docs/adr/cache-store.md`
(`<change-id>-<topic>`), and `cache-store` names its own `docs/adr/cache-store.md` (`<change-id>`). Both are opened from the same
base; `cache` lands first.

On its own branch, before anything lands, `cache-store`'s unnumbered record is tolerated by `check.py` (it is listed by its change):

```text
(in $CASES/p10/main/.claude/worktrees/cache-store)
$ python3 $WT/scripts/check.py --root $CASES/p10/main/.claude/worktrees/cache-store
all checks passed
[exit 0]
```

```text
(in $CASES/p10/main/.claude/worktrees/cache)
$ node $DEV/deliver-check.mjs cache --json   -> 1/8, next: implement (phase 1 has unticked tasks: 1.1)
    did: wrote src/cache-1.ts; ticked 1.1
$ node $DEV/deliver-check.mjs cache --json   -> 1/8, next: gate (phase 1 is implemented; run its gate 1.2)
    did: ran `node -e 0` (exit 0); ticked 1.2
$ node $DEV/deliver-check.mjs cache --json   -> 1/8, next: commit (uncommitted changes outside openspec/: src/cache-1.ts)
    did: git commit: 0c58b3d
$ node $DEV/deliver-check.mjs cache --json   -> 1/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at 0c58b3d; git commit: 09216c6
$ node $DEV/deliver-check.mjs cache --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at 09216c6; git commit: 9d7c1a6
$ node $DEV/deliver-check.mjs cache --json   -> 4/8, next: open-pr (no pull request yet)
    did: git push -u origin cache; gh pr create -> https://github.invalid/o/devkit/pull/11
$ node $DEV/deliver-check.mjs cache --json   -> 8/8, next: assign-release (the release of cache is not assigned yet; assign it before the merge)
```

```text
(in $CASES/p10/main/.claude/worktrees/cache)
$ git fetch origin main
From $CASES/p10/origin
 * branch            main       -> FETCH_HEAD
[exit 0]
```

```text
(in $CASES/p10/main/.claude/worktrees/cache)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": true,
  "oldHead": "078dbdafac34055f7effd32480e7abc74b133fb5",
  "newHead": "564e7ddde45f8545168d07f7bdbbfa906110bd91",
  "versions": {
    "packs": {
      "devkit-core": "1.0.1"
    },
    "metadata": "1.0.1"
  },
  "files": [
    "plugins/core/.claude-plugin/plugin.json",
    ".claude-plugin/marketplace.json",
    "CHANGELOG.md",
    "docs/catalog.md"
  ],
  "change": "cache",
  "adrs": [
    {
      "from": "docs/adr/cache-store.md",
      "to": "docs/adr/0002-cache-store.md"
    }
  ],
  "citations": [],
  "mode": "assign"
}
[exit 0]
```

```text
(in $CASES/p10/main/.claude/worktrees/cache)
$ git push origin cache
To $CASES/p10/origin.git
   078dbda..564e7dd  cache -> cache
[exit 0]
```

```text
(in $CASES/p10/main/.claude/worktrees/cache)
$ gh pr merge 11 --auto --squash --match-head-commit 564e7ddde45f8545168d07f7bdbbfa906110bd91
(no output)
[exit 0]
```

```text
(in $CASES/p10/main)
$ gh __merge 11   # the stub: GitHub merges the pull request once its rules pass
a64c64c2b7977d2ba04eb90dce00e0002679cd9a
[exit 0]
```

`cache` landed as `docs/adr/0002-cache-store.md`. `cache-store` reaches its release step; the step merges `main` and refuses the second record with that slug, undoing the merge:

```text
(in $CASES/p10/main/.claude/worktrees/cache-store)
$ git fetch origin
From $CASES/p10/origin
   57f52b2..a64c64c  main       -> origin/main
[exit 0]
```

```text
(in $CASES/p10/main/.claude/worktrees/cache-store)
$ node $DEV/deliver-check.mjs cache-store --json   -> 1/8, next: implement (phase 1 has unticked tasks: 1.1)
    did: wrote src/cache-store-1.ts; ticked 1.1
$ node $DEV/deliver-check.mjs cache-store --json   -> 1/8, next: gate (phase 1 is implemented; run its gate 1.2)
    did: ran `node -e 0` (exit 0); ticked 1.2
$ node $DEV/deliver-check.mjs cache-store --json   -> 1/8, next: commit (uncommitted changes outside openspec/: src/cache-store-1.ts)
    did: git commit: 3bba772
$ node $DEV/deliver-check.mjs cache-store --json   -> 1/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at 3bba772; git commit: 74cd9d7
$ node $DEV/deliver-check.mjs cache-store --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at 74cd9d7; git commit: 37817e3
$ node $DEV/deliver-check.mjs cache-store --json   -> 4/8, next: open-pr (no pull request yet)
    did: git push -u origin cache-store; gh pr create -> https://github.invalid/o/devkit/pull/12
$ node $DEV/deliver-check.mjs cache-store --json   -> 7/8, next: assign-release (branch is behind main; update it)
```

```text
(in $CASES/p10/main/.claude/worktrees/cache-store)
$ git fetch origin main
From $CASES/p10/origin
 * branch            main       -> FETCH_HEAD
[exit 0]
```

```text
(in $CASES/p10/main/.claude/worktrees/cache-store)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": false,
  "oldHead": "0bcc7563380dbe0ff87cde98254e17026443847f",
  "change": "cache-store",
  "conflicts": [],
  "error": "a second ADR with the slug cache-store: docs/adr/cache-store.md, docs/adr/0002-cache-store.md",
  "mode": "assign"
}
[exit 2]
```

The session stops as `blocked: item 5 (<the JSON's error>)`. What `check.py` says of the same tree, in the two places it runs: the pull request's merge ref in CI (`GITHUB_HEAD_REF` set: a branch), where two records with one slug are refused, and `main` once such a merge reached it, where the unnumbered record is refused too:

```text
(in $CASES/p10/main)
$ git worktree add -q --detach $CASES/p10/ci-merge-ref origin/main
(no output)
[exit 0]
```

```text
(in $CASES/p10/ci-merge-ref)
$ git merge -q --no-ff --no-edit origin/cache-store
(no output)
[exit 0]
```

```text
(in $CASES/p10/ci-merge-ref)
$ GITHUB_HEAD_REF=cache-store python3 $WT/scripts/check.py --root $CASES/p10/ci-merge-ref
a second ADR with the slug cache-store: docs/adr/0002-cache-store.md, docs/adr/cache-store.md
[exit 1]
```

```text
(in $CASES/p10)
$ git clone -q $CASES/p10/origin.git $CASES/p10/main-after-a-bad-merge
(no output)
[exit 0]
```

```text
(in $CASES/p10/main-after-a-bad-merge)
$ git merge -q --no-ff --no-edit origin/cache-store
(no output)
[exit 0]
```

```text
(in $CASES/p10/main-after-a-bad-merge)
$ python3 $WT/scripts/check.py --root $CASES/p10/main-after-a-bad-merge
a second ADR with the slug cache-store: docs/adr/0002-cache-store.md, docs/adr/cache-store.md
docs/adr/cache-store.md: an unnumbered ADR on the base branch; the delivery numbers it with its change's release
[exit 1]
```

The fix: `cache-store` renames its record to a slug of its own (`cache-store-layer`), in its file, `decisions.md` and its citation; the rename is a plain edit of its own files, so the records are taken again, and the release step then goes through:

```text
(in $CASES/p10/main/.claude/worktrees/cache-store)
$ git mv docs/adr/cache-store.md docs/adr/cache-store-layer.md
(no output)
[exit 0]
```

```text
(in $CASES/p10/main/.claude/worktrees/cache-store)
$ git commit -q -am 'docs(cache-store): a slug of its own for the record'
(no output)
[exit 0]
```

```text
(in $CASES/p10/main/.claude/worktrees/cache-store)
$ git show '--format=%h %s' HEAD
010d14c docs(cache-store): a slug of its own for the record

diff --git a/docs/adr/cache-store.md b/docs/adr/cache-store-layer.md
similarity index 64%
rename from docs/adr/cache-store.md
rename to docs/adr/cache-store-layer.md
index 648f07f..4837cd8 100644
--- a/docs/adr/cache-store.md
+++ b/docs/adr/cache-store-layer.md
@@ -1,4 +1,4 @@
-# ADR [cache-store]: the rule of cache-store
+# ADR [cache-store-layer]: the rule of cache-store
 
 - Status: proposed
 - Change: `cache-store`
diff --git a/docs/cache-store.md b/docs/cache-store.md
index b73c270..24c9998 100644
--- a/docs/cache-store.md
+++ b/docs/cache-store.md
@@ -1,3 +1,3 @@
 # cache-store
 
-See ADR [cache-store].
+See ADR [cache-store-layer].
diff --git a/openspec/changes/cache-store/decisions.md b/openspec/changes/cache-store/decisions.md
index dad6470..af9c996 100644
--- a/openspec/changes/cache-store/decisions.md
+++ b/openspec/changes/cache-store/decisions.md
@@ -1,3 +1,3 @@
 # Decisions and ADRs
 
-- ADR: `docs/adr/cache-store.md` — the record of cache-store
+- ADR: `docs/adr/cache-store-layer.md` — the record of cache-store
[exit 0]
```

```text
(in $CASES/p10/main/.claude/worktrees/cache-store)
$ node $DEV/deliver-check.mjs cache-store --json   -> 4/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at 010d14c; git commit: 86df320
$ node $DEV/deliver-check.mjs cache-store --json   -> 6/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at 86df320; git commit: d8d9d29
$ node $DEV/deliver-check.mjs cache-store --json   -> 7/8, next: push (local is ahead of PR head 0bcc756; push; branch is behind main; update it)
    did: git push origin cache-store
$ node $DEV/deliver-check.mjs cache-store --json   -> 7/8, next: assign-release (branch is behind main; update it)
```

```text
(in $CASES/p10/main/.claude/worktrees/cache-store)
$ git fetch origin main
From $CASES/p10/origin
 * branch            main       -> FETCH_HEAD
[exit 0]
```

```text
(in $CASES/p10/main/.claude/worktrees/cache-store)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": true,
  "oldHead": "d8d9d296a947c6afe07440c0343ac5e202913d86",
  "newHead": "cebcdb2db5dc0ecb4e183b4aebad73ed39a63a28",
  "versions": {
    "packs": {
      "devkit-openspec": "1.0.1"
    },
    "metadata": "1.0.2"
  },
  "files": [
    "plugins/openspec/.claude-plugin/plugin.json",
    ".claude-plugin/marketplace.json",
    "CHANGELOG.md",
    "docs/openspec-flow.md",
    "docs/catalog.md"
  ],
  "change": "cache-store",
  "adrs": [
    {
      "from": "docs/adr/cache-store-layer.md",
      "to": "docs/adr/0003-cache-store-layer.md"
    }
  ],
  "citations": [
    "docs/cache-store.md"
  ],
  "mode": "assign"
}
[exit 0]
```

```text
(in $CASES/p10/main/.claude/worktrees/cache-store)
$ git push origin cache-store
To $CASES/p10/origin.git
   d8d9d29..cebcdb2  cache-store -> cache-store
[exit 0]
```

```text
(in $CASES/p10/main/.claude/worktrees/cache-store)
$ node $DEV/deliver-check.mjs cache-store
deliver-check: cache-store (schema devkit, ship merge, host cli, head cebcdb2)
  1 met      tasks and gates: all tasks ticked; 1 gate command green in evidence.md
  2 met      reviews at head: 2 reviews at head
  3 met      findings disposed: 0 fixed, 0 refuted
  4 met      acceptance criteria proven: 1 criteria proven
  5 met      PR open at local head: PR #12 open at cebcdb2
  6 met      required checks green: 2 required checks green
  7 met      conversation answered: every thread and request is answered
  8 met      PR body complete: PR body names the change, its criteria and the evidence
8/8 met: ready
next: enable-auto-merge PR #12 with --squash at cebcdb2
[exit 0]
```

```text
(in $CASES/p10/main/.claude/worktrees/cache-store)
$ ls docs/adr
0001-start.md
0002-cache-store.md
0003-cache-store-layer.md
[exit 0]
```

```text
(in $CASES/p10/main/.claude/worktrees/cache-store)
$ python3 $WT/scripts/check.py --root $CASES/p10/main/.claude/worktrees/cache-store
all checks passed
[exit 0]
```

## P-11 each malformed field of the note, through the checker and the step

AC-1. Project `p11` (the seed). Change `mal` (schema `devkit-lite`) has its work committed; each variant below replaces its
`release.md` with one defect and commits it. The checker answers row N1 (`blocked` with the reader's message, which starts
`release.md:` and names the field) and the step, run by hand, refuses with the same message and leaves the branch as it was.

```text
(in $CASES/p11/main/.claude/worktrees/mal)
$ node $DEV/deliver-check.mjs mal --json   -> 1/8, next: implement (phase 1 has unticked tasks: 1.1)
    did: wrote src/mal-1.ts; ticked 1.1
$ node $DEV/deliver-check.mjs mal --json   -> 1/8, next: gate (phase 1 is implemented; run its gate 1.2)
    did: ran `node -e 0` (exit 0); ticked 1.2
$ node $DEV/deliver-check.mjs mal --json   -> 1/8, next: commit (uncommitted changes outside openspec/: src/mal-1.ts)
    did: git commit: 8210537
$ node $DEV/deliver-check.mjs mal --json   -> 1/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
```

### an empty file

```text
(in $CASES/p11/main/.claude/worktrees/mal)
$ cat -A openspec/changes/mal/release.md
(no output)
[exit 0]
```

```text
(in $CASES/p11/main/.claude/worktrees/mal)
$ node $DEV/deliver-check.mjs mal
deliver-check: mal (schema devkit-lite, ship merge, host cli, head 169730c)
  1 open     tasks and gates: evidence.md is missing; no passing row in evidence.md for `node -e 0`
  2 open     reviews at head: missing code-quality-reviewer, test-coverage-reviewer
  3 met      findings disposed: 0 fixed, 0 refuted
  4 open     acceptance criteria proven: evidence.md is missing; no proof row for AC-1
  5 open     PR open at local head: no pull request for this branch yet
  6 open     required checks green: no pull request for this branch yet
  7 open     conversation answered: no pull request for this branch yet
  8 open     PR body complete: no pull request for this branch yet
1/8 met: in progress: item 1
next: blocked release.md: packs: missing (the note starts with "packs:" or "packs: []")
[exit 1]
```

```text
(in $CASES/p11/main/.claude/worktrees/mal)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": false,
  "oldHead": "169730c9d83138c5b1c23e15c1e75852d072f620",
  "change": "mal",
  "conflicts": [],
  "error": "release.md: packs: missing (the note starts with \"packs:\" or \"packs: []\")",
  "mode": "assign"
}
[exit 2]
```

### no packs: line

```text
(in $CASES/p11/main/.claude/worktrees/mal)
$ cat -A openspec/changes/mal/release.md
# Release note$
$
## t$
$
- body$
[exit 0]
```

```text
(in $CASES/p11/main/.claude/worktrees/mal)
$ node $DEV/deliver-check.mjs mal
deliver-check: mal (schema devkit-lite, ship merge, host cli, head 13c7852)
  1 open     tasks and gates: evidence.md is missing; no passing row in evidence.md for `node -e 0`
  2 open     reviews at head: missing code-quality-reviewer, test-coverage-reviewer
  3 met      findings disposed: 0 fixed, 0 refuted
  4 open     acceptance criteria proven: evidence.md is missing; no proof row for AC-1
  5 open     PR open at local head: no pull request for this branch yet
  6 open     required checks green: no pull request for this branch yet
  7 open     conversation answered: no pull request for this branch yet
  8 open     PR body complete: no pull request for this branch yet
1/8 met: in progress: item 1
next: blocked release.md: packs: missing (the note starts with "packs:" or "packs: []")
[exit 1]
```

```text
(in $CASES/p11/main/.claude/worktrees/mal)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": false,
  "oldHead": "13c785264d767128ed3bc9beb235ce3043071022",
  "change": "mal",
  "conflicts": [],
  "error": "release.md: packs: missing (the note starts with \"packs:\" or \"packs: []\")",
  "mode": "assign"
}
[exit 2]
```

### a list line that is not "- <pack>: <kind>"

```text
(in $CASES/p11/main/.claude/worktrees/mal)
$ cat -A openspec/changes/mal/release.md
packs:$
- devkit-core patch$
$
## t$
$
- body$
[exit 0]
```

```text
(in $CASES/p11/main/.claude/worktrees/mal)
$ node $DEV/deliver-check.mjs mal
deliver-check: mal (schema devkit-lite, ship merge, host cli, head 11cc39a)
  1 open     tasks and gates: evidence.md is missing; no passing row in evidence.md for `node -e 0`
  2 open     reviews at head: missing code-quality-reviewer, test-coverage-reviewer
  3 met      findings disposed: 0 fixed, 0 refuted
  4 open     acceptance criteria proven: evidence.md is missing; no proof row for AC-1
  5 open     PR open at local head: no pull request for this branch yet
  6 open     required checks green: no pull request for this branch yet
  7 open     conversation answered: no pull request for this branch yet
  8 open     PR body complete: no pull request for this branch yet
1/8 met: in progress: item 1
next: blocked release.md: packs: line 2: "- devkit-core patch" is not "- <pack>: patch|minor|major"
[exit 1]
```

```text
(in $CASES/p11/main/.claude/worktrees/mal)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": false,
  "oldHead": "11cc39ae6481edfc19f07b86efdeaac5b63405fd",
  "change": "mal",
  "conflicts": [],
  "error": "release.md: packs: line 2: \"- devkit-core patch\" is not \"- <pack>: patch|minor|major\"",
  "mode": "assign"
}
[exit 2]
```

### a kind outside the three

```text
(in $CASES/p11/main/.claude/worktrees/mal)
$ cat -A openspec/changes/mal/release.md
packs:$
- devkit-core: big$
$
## t$
$
- body$
[exit 0]
```

```text
(in $CASES/p11/main/.claude/worktrees/mal)
$ node $DEV/deliver-check.mjs mal
deliver-check: mal (schema devkit-lite, ship merge, host cli, head f53e529)
  1 open     tasks and gates: evidence.md is missing; no passing row in evidence.md for `node -e 0`
  2 open     reviews at head: missing code-quality-reviewer, test-coverage-reviewer
  3 met      findings disposed: 0 fixed, 0 refuted
  4 open     acceptance criteria proven: evidence.md is missing; no proof row for AC-1
  5 open     PR open at local head: no pull request for this branch yet
  6 open     required checks green: no pull request for this branch yet
  7 open     conversation answered: no pull request for this branch yet
  8 open     PR body complete: no pull request for this branch yet
1/8 met: in progress: item 1
next: blocked release.md: packs: devkit-core: "big" is not patch, minor or major
[exit 1]
```

```text
(in $CASES/p11/main/.claude/worktrees/mal)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": false,
  "oldHead": "f53e529cf55de4d658275db4d4fcb46d5b927c26",
  "change": "mal",
  "conflicts": [],
  "error": "release.md: packs: devkit-core: \"big\" is not patch, minor or major",
  "mode": "assign"
}
[exit 2]
```

### a pack twice

```text
(in $CASES/p11/main/.claude/worktrees/mal)
$ cat -A openspec/changes/mal/release.md
packs:$
- devkit-core: patch$
- devkit-core: minor$
$
## t$
$
- body$
[exit 0]
```

```text
(in $CASES/p11/main/.claude/worktrees/mal)
$ node $DEV/deliver-check.mjs mal
deliver-check: mal (schema devkit-lite, ship merge, host cli, head 5c09567)
  1 open     tasks and gates: evidence.md is missing; no passing row in evidence.md for `node -e 0`
  2 open     reviews at head: missing code-quality-reviewer, test-coverage-reviewer
  3 met      findings disposed: 0 fixed, 0 refuted
  4 open     acceptance criteria proven: evidence.md is missing; no proof row for AC-1
  5 open     PR open at local head: no pull request for this branch yet
  6 open     required checks green: no pull request for this branch yet
  7 open     conversation answered: no pull request for this branch yet
  8 open     PR body complete: no pull request for this branch yet
1/8 met: in progress: item 1
next: blocked release.md: packs: devkit-core is listed twice
[exit 1]
```

```text
(in $CASES/p11/main/.claude/worktrees/mal)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": false,
  "oldHead": "5c0956744fc7d9f314b4c64e0fdc543ddb6fc90d",
  "change": "mal",
  "conflicts": [],
  "error": "release.md: packs: devkit-core is listed twice",
  "mode": "assign"
}
[exit 2]
```

### marketplace: after release:

```text
(in $CASES/p11/main/.claude/worktrees/mal)
$ cat -A openspec/changes/mal/release.md
packs:$
- devkit-core: patch$
release: minor$
marketplace: minor$
$
## t$
$
- body$
[exit 0]
```

```text
(in $CASES/p11/main/.claude/worktrees/mal)
$ node $DEV/deliver-check.mjs mal
deliver-check: mal (schema devkit-lite, ship merge, host cli, head 0cf4b45)
  1 open     tasks and gates: evidence.md is missing; no passing row in evidence.md for `node -e 0`
  2 open     reviews at head: missing code-quality-reviewer, test-coverage-reviewer
  3 met      findings disposed: 0 fixed, 0 refuted
  4 open     acceptance criteria proven: evidence.md is missing; no proof row for AC-1
  5 open     PR open at local head: no pull request for this branch yet
  6 open     required checks green: no pull request for this branch yet
  7 open     conversation answered: no pull request for this branch yet
  8 open     PR body complete: no pull request for this branch yet
1/8 met: in progress: item 1
next: blocked release.md: marketplace: out of order (the fields come as packs:, marketplace:, release:)
[exit 1]
```

```text
(in $CASES/p11/main/.claude/worktrees/mal)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": false,
  "oldHead": "0cf4b45cbff975486f38f66bc65dc710add29442",
  "change": "mal",
  "conflicts": [],
  "error": "release.md: marketplace: out of order (the fields come as packs:, marketplace:, release:)",
  "mode": "assign"
}
[exit 2]
```

### marketplace: twice

```text
(in $CASES/p11/main/.claude/worktrees/mal)
$ cat -A openspec/changes/mal/release.md
packs:$
- devkit-core: patch$
marketplace: minor$
marketplace: minor$
$
## t$
$
- body$
[exit 0]
```

```text
(in $CASES/p11/main/.claude/worktrees/mal)
$ node $DEV/deliver-check.mjs mal
deliver-check: mal (schema devkit-lite, ship merge, host cli, head 01246a0)
  1 open     tasks and gates: evidence.md is missing; no passing row in evidence.md for `node -e 0`
  2 open     reviews at head: missing code-quality-reviewer, test-coverage-reviewer
  3 met      findings disposed: 0 fixed, 0 refuted
  4 open     acceptance criteria proven: evidence.md is missing; no proof row for AC-1
  5 open     PR open at local head: no pull request for this branch yet
  6 open     required checks green: no pull request for this branch yet
  7 open     conversation answered: no pull request for this branch yet
  8 open     PR body complete: no pull request for this branch yet
1/8 met: in progress: item 1
next: blocked release.md: marketplace: given twice
[exit 1]
```

```text
(in $CASES/p11/main/.claude/worktrees/mal)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": false,
  "oldHead": "01246a038a678607dc484b4858233a3a9c7d8a1d",
  "change": "mal",
  "conflicts": [],
  "error": "release.md: marketplace: given twice",
  "mode": "assign"
}
[exit 2]
```

### a marketplace kind outside the three

```text
(in $CASES/p11/main/.claude/worktrees/mal)
$ cat -A openspec/changes/mal/release.md
packs:$
- devkit-core: patch$
marketplace: huge$
$
## t$
$
- body$
[exit 0]
```

```text
(in $CASES/p11/main/.claude/worktrees/mal)
$ node $DEV/deliver-check.mjs mal
deliver-check: mal (schema devkit-lite, ship merge, host cli, head 3b9b430)
  1 open     tasks and gates: evidence.md is missing; no passing row in evidence.md for `node -e 0`
  2 open     reviews at head: missing code-quality-reviewer, test-coverage-reviewer
  3 met      findings disposed: 0 fixed, 0 refuted
  4 open     acceptance criteria proven: evidence.md is missing; no proof row for AC-1
  5 open     PR open at local head: no pull request for this branch yet
  6 open     required checks green: no pull request for this branch yet
  7 open     conversation answered: no pull request for this branch yet
  8 open     PR body complete: no pull request for this branch yet
1/8 met: in progress: item 1
next: blocked release.md: marketplace: "huge" is not patch, minor or major
[exit 1]
```

```text
(in $CASES/p11/main/.claude/worktrees/mal)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": false,
  "oldHead": "3b9b430efc7ed5fd2e6de25b525b814245a5caf8",
  "change": "mal",
  "conflicts": [],
  "error": "release.md: marketplace: \"huge\" is not patch, minor or major",
  "mode": "assign"
}
[exit 2]
```

### a line that is no field

```text
(in $CASES/p11/main/.claude/worktrees/mal)
$ cat -A openspec/changes/mal/release.md
packs:$
- devkit-core: patch$
notes: none$
$
## t$
$
- body$
[exit 0]
```

```text
(in $CASES/p11/main/.claude/worktrees/mal)
$ node $DEV/deliver-check.mjs mal
deliver-check: mal (schema devkit-lite, ship merge, host cli, head eda0cae)
  1 open     tasks and gates: evidence.md is missing; no passing row in evidence.md for `node -e 0`
  2 open     reviews at head: missing code-quality-reviewer, test-coverage-reviewer
  3 met      findings disposed: 0 fixed, 0 refuted
  4 open     acceptance criteria proven: evidence.md is missing; no proof row for AC-1
  5 open     PR open at local head: no pull request for this branch yet
  6 open     required checks green: no pull request for this branch yet
  7 open     conversation answered: no pull request for this branch yet
  8 open     PR body complete: no pull request for this branch yet
1/8 met: in progress: item 1
next: blocked release.md: line 3: "notes: none" is not a field of the note
[exit 1]
```

```text
(in $CASES/p11/main/.claude/worktrees/mal)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": false,
  "oldHead": "eda0cae28576baa4a878bab3be44e06759f9a68a",
  "change": "mal",
  "conflicts": [],
  "error": "release.md: line 3: \"notes: none\" is not a field of the note",
  "mode": "assign"
}
[exit 2]
```

### no changelog title

```text
(in $CASES/p11/main/.claude/worktrees/mal)
$ cat -A openspec/changes/mal/release.md
packs:$
- devkit-core: patch$
[exit 0]
```

```text
(in $CASES/p11/main/.claude/worktrees/mal)
$ node $DEV/deliver-check.mjs mal
deliver-check: mal (schema devkit-lite, ship merge, host cli, head 51d5612)
  1 open     tasks and gates: evidence.md is missing; no passing row in evidence.md for `node -e 0`
  2 open     reviews at head: missing code-quality-reviewer, test-coverage-reviewer
  3 met      findings disposed: 0 fixed, 0 refuted
  4 open     acceptance criteria proven: evidence.md is missing; no proof row for AC-1
  5 open     PR open at local head: no pull request for this branch yet
  6 open     required checks green: no pull request for this branch yet
  7 open     conversation answered: no pull request for this branch yet
  8 open     PR body complete: no pull request for this branch yet
1/8 met: in progress: item 1
next: blocked release.md: changelog title: missing (a "## <title>" line comes after the fields)
[exit 1]
```

```text
(in $CASES/p11/main/.claude/worktrees/mal)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": false,
  "oldHead": "51d56124f97a27448131750e0a138ad111897349",
  "change": "mal",
  "conflicts": [],
  "error": "release.md: changelog title: missing (a \"## <title>\" line comes after the fields)",
  "mode": "assign"
}
[exit 2]
```

### an empty changelog body

```text
(in $CASES/p11/main/.claude/worktrees/mal)
$ cat -A openspec/changes/mal/release.md
packs:$
- devkit-core: patch$
$
## t$
[exit 0]
```

```text
(in $CASES/p11/main/.claude/worktrees/mal)
$ node $DEV/deliver-check.mjs mal
deliver-check: mal (schema devkit-lite, ship merge, host cli, head dc9d5ae)
  1 open     tasks and gates: evidence.md is missing; no passing row in evidence.md for `node -e 0`
  2 open     reviews at head: missing code-quality-reviewer, test-coverage-reviewer
  3 met      findings disposed: 0 fixed, 0 refuted
  4 open     acceptance criteria proven: evidence.md is missing; no proof row for AC-1
  5 open     PR open at local head: no pull request for this branch yet
  6 open     required checks green: no pull request for this branch yet
  7 open     conversation answered: no pull request for this branch yet
  8 open     PR body complete: no pull request for this branch yet
1/8 met: in progress: item 1
next: blocked release.md: changelog body: empty (write what the release changes under the title)
[exit 1]
```

```text
(in $CASES/p11/main/.claude/worktrees/mal)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": false,
  "oldHead": "dc9d5aefa0b5b184423e1641b2e2c6f5cfa3e65d",
  "change": "mal",
  "conflicts": [],
  "error": "release.md: changelog body: empty (write what the release changes under the title)",
  "mode": "assign"
}
[exit 2]
```

### a code fence never closed

````text
(in $CASES/p11/main/.claude/worktrees/mal)
$ cat -A openspec/changes/mal/release.md
packs:$
- devkit-core: patch$
$
## t$
$
- body$
$
```js$
const x = 1;$
[exit 0]
````

```text
(in $CASES/p11/main/.claude/worktrees/mal)
$ node $DEV/deliver-check.mjs mal
deliver-check: mal (schema devkit-lite, ship merge, host cli, head 30ebdfe)
  1 open     tasks and gates: evidence.md is missing; no passing row in evidence.md for `node -e 0`
  2 open     reviews at head: missing code-quality-reviewer, test-coverage-reviewer
  3 met      findings disposed: 0 fixed, 0 refuted
  4 open     acceptance criteria proven: evidence.md is missing; no proof row for AC-1
  5 open     PR open at local head: no pull request for this branch yet
  6 open     required checks green: no pull request for this branch yet
  7 open     conversation answered: no pull request for this branch yet
  8 open     PR body complete: no pull request for this branch yet
1/8 met: in progress: item 1
next: blocked release.md: changelog body: a code fence opened at line 8 is never closed
[exit 1]
```

```text
(in $CASES/p11/main/.claude/worktrees/mal)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": false,
  "oldHead": "30ebdfe1e3a31318d1b76e2ccde2a2986ed8c811",
  "change": "mal",
  "conflicts": [],
  "error": "release.md: changelog body: a code fence opened at line 8 is never closed",
  "mode": "assign"
}
[exit 2]
```

### a pack the project does not have

```text
(in $CASES/p11/main/.claude/worktrees/mal)
$ cat -A openspec/changes/mal/release.md
packs:$
- devkit-x: patch$
$
## t$
$
- body$
[exit 0]
```

```text
(in $CASES/p11/main/.claude/worktrees/mal)
$ node $DEV/deliver-check.mjs mal
deliver-check: mal (schema devkit-lite, ship merge, host cli, head 02b7169)
  1 open     tasks and gates: evidence.md is missing; no passing row in evidence.md for `node -e 0`
  2 open     reviews at head: missing code-quality-reviewer, test-coverage-reviewer
  3 met      findings disposed: 0 fixed, 0 refuted
  4 open     acceptance criteria proven: evidence.md is missing; no proof row for AC-1
  5 open     PR open at local head: no pull request for this branch yet
  6 open     required checks green: no pull request for this branch yet
  7 open     conversation answered: no pull request for this branch yet
  8 open     PR body complete: no pull request for this branch yet
1/8 met: in progress: item 1
next: blocked release.md: packs: devkit-x is not a pack of this project
[exit 1]
```

```text
(in $CASES/p11/main/.claude/worktrees/mal)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": false,
  "oldHead": "02b7169b2aa91b6bd21f951aa17b1e640fc8eaeb",
  "change": "mal",
  "conflicts": [],
  "error": "release.md: packs: devkit-x is not a pack of this project",
  "mode": "assign"
}
[exit 2]
```

### release: when the release file is a pack manifest

```text
(in $CASES/p11/main/.claude/worktrees/mal)
$ cat -A openspec/changes/mal/release.md
packs:$
- devkit-core: patch$
release: minor$
$
## t$
$
- body$
[exit 0]
```

```text
(in $CASES/p11/main/.claude/worktrees/mal)
$ node $DEV/deliver-check.mjs mal
deliver-check: mal (schema devkit-lite, ship merge, host cli, head 593fef9)
  1 open     tasks and gates: evidence.md is missing; no passing row in evidence.md for `node -e 0`
  2 open     reviews at head: missing code-quality-reviewer, test-coverage-reviewer
  3 met      findings disposed: 0 fixed, 0 refuted
  4 open     acceptance criteria proven: evidence.md is missing; no proof row for AC-1
  5 open     PR open at local head: no pull request for this branch yet
  6 open     required checks green: no pull request for this branch yet
  7 open     conversation answered: no pull request for this branch yet
  8 open     PR body complete: no pull request for this branch yet
1/8 met: in progress: item 1
next: blocked release.md: release: plugins/openspec/.claude-plugin/plugin.json is the manifest of devkit-openspec; state its bump under packs:
[exit 1]
```

```text
(in $CASES/p11/main/.claude/worktrees/mal)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": false,
  "oldHead": "593fef955de93c7d241ae4d23e714f1b5db29e4f",
  "change": "mal",
  "conflicts": [],
  "error": "release.md: release: plugins/openspec/.claude-plugin/plugin.json is the manifest of devkit-openspec; state its bump under packs:",
  "mode": "assign"
}
[exit 2]
```

### `marketplace:` in a project with no marketplace file

Project `p11m`: the seed without `.claude-plugin/marketplace.json`.

```text
(in $CASES/p11m/main/.claude/worktrees/mal)
$ node $DEV/deliver-check.mjs mal --json   -> 1/8, next: implement (phase 1 has unticked tasks: 1.1)
    did: wrote src/mal-1.ts; ticked 1.1
$ node $DEV/deliver-check.mjs mal --json   -> 1/8, next: gate (phase 1 is implemented; run its gate 1.2)
    did: ran `node -e 0` (exit 0); ticked 1.2
$ node $DEV/deliver-check.mjs mal --json   -> 1/8, next: commit (uncommitted changes outside openspec/: src/mal-1.ts)
    did: git commit: 10846ff
$ node $DEV/deliver-check.mjs mal --json   -> 1/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
```

### marketplace: with no marketplace file

```text
(in $CASES/p11m/main/.claude/worktrees/mal)
$ cat -A openspec/changes/mal/release.md
packs:$
- devkit-core: patch$
marketplace: minor$
$
## t$
$
- body$
[exit 0]
```

```text
(in $CASES/p11m/main/.claude/worktrees/mal)
$ node $DEV/deliver-check.mjs mal
deliver-check: mal (schema devkit-lite, ship merge, host cli, head cc5eb88)
  1 open     tasks and gates: evidence.md is missing; no passing row in evidence.md for `node -e 0`
  2 open     reviews at head: missing code-quality-reviewer, test-coverage-reviewer
  3 met      findings disposed: 0 fixed, 0 refuted
  4 open     acceptance criteria proven: evidence.md is missing; no proof row for AC-1
  5 open     PR open at local head: no pull request for this branch yet
  6 open     required checks green: no pull request for this branch yet
  7 open     conversation answered: no pull request for this branch yet
  8 open     PR body complete: no pull request for this branch yet
1/8 met: in progress: item 1
next: blocked release.md: marketplace: the project has no .claude-plugin/marketplace.json
[exit 1]
```

```text
(in $CASES/p11m/main/.claude/worktrees/mal)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": false,
  "oldHead": "cc5eb88ff840ca7c26c57c48d97cae58a871bd6b",
  "change": "mal",
  "conflicts": [],
  "error": "release.md: marketplace: the project has no .claude-plugin/marketplace.json",
  "mode": "assign"
}
[exit 2]
```

### The fix

A note that reads: the run goes on through the evidence, the reviews and the pull request to the release step, and then to `enable-auto-merge`.

```text
(in $CASES/p11/main/.claude/worktrees/mal)
$ git commit -q -am 'docs(mal): a note that reads'
(no output)
[exit 0]
```

```text
(in $CASES/p11/main/.claude/worktrees/mal)
$ git show '--format=%h %s' HEAD
6402d3b docs(mal): a note that reads

diff --git a/openspec/changes/mal/release.md b/openspec/changes/mal/release.md
index 23a895c..aac3f7d 100644
--- a/openspec/changes/mal/release.md
+++ b/openspec/changes/mal/release.md
@@ -1,7 +1,6 @@
 packs:
 - devkit-core: patch
-release: minor
 
-## t
+## mal lands
 
-- body
+- **devkit-core**: mal does its part
[exit 0]
```

```text
(in $CASES/p11/main/.claude/worktrees/mal)
$ node $DEV/deliver-check.mjs mal --json   -> 1/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at 6402d3b; git commit: e93d76a
$ node $DEV/deliver-check.mjs mal --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at e93d76a; git commit: bc44f8b
$ node $DEV/deliver-check.mjs mal --json   -> 4/8, next: open-pr (no pull request yet)
    did: git push -u origin mal; gh pr create -> https://github.invalid/o/devkit/pull/11
$ node $DEV/deliver-check.mjs mal --json   -> 8/8, next: assign-release (the release of mal is not assigned yet; assign it before the merge)
```

```text
(in $CASES/p11/main/.claude/worktrees/mal)
$ git fetch origin main
From $CASES/p11/origin
 * branch            main       -> FETCH_HEAD
[exit 0]
```

```text
(in $CASES/p11/main/.claude/worktrees/mal)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": true,
  "oldHead": "e25fb9e696045164c11ed7326e71fe9b9fb4fcc2",
  "newHead": "ce123e092965a0b1eb0205e0a5040c415588db36",
  "versions": {
    "packs": {
      "devkit-core": "1.0.1"
    },
    "metadata": "1.0.1"
  },
  "files": [
    "plugins/core/.claude-plugin/plugin.json",
    ".claude-plugin/marketplace.json",
    "CHANGELOG.md",
    "docs/catalog.md"
  ],
  "change": "mal",
  "adrs": [],
  "citations": [],
  "mode": "assign"
}
[exit 0]
```

```text
(in $CASES/p11/main/.claude/worktrees/mal)
$ git push origin mal
To $CASES/p11/origin.git
   e25fb9e..ce123e0  mal -> mal
[exit 0]
```

```text
(in $CASES/p11/main/.claude/worktrees/mal)
$ node $DEV/deliver-check.mjs mal
deliver-check: mal (schema devkit-lite, ship merge, host cli, head ce123e0)
  1 met      tasks and gates: all tasks ticked; 1 gate command green in evidence.md
  2 met      reviews at head: 2 reviews at head
  3 met      findings disposed: 0 fixed, 0 refuted
  4 met      acceptance criteria proven: 1 criteria proven
  5 met      PR open at local head: PR #11 open at ce123e0
  6 met      required checks green: 2 required checks green
  7 met      conversation answered: every thread and request is answered
  8 met      PR body complete: PR body names the change, its criteria and the evidence
8/8 met: ready
next: enable-auto-merge PR #11 with --squash at ce123e0
[exit 0]
```

## P-12 the release tag after the single merge of P-1 and after the train of P-2

AC-13. The tag rule of ADR 0019 is unchanged: `deliver-check` reads the release file's `version` at the merge commit and at its first
parent through the stub (which serves the merge commits the cases made) and asks `tag-release` when they differ and origin has no tag.

### After the single merge of P-1

GitHub merges `feat` (auto-merge was enabled at its head):

```text
(in $CASES/p1/main)
$ gh __merge 11   # the stub: GitHub merges the pull request once its rules pass
57b2c58b475c02ce2dc441ed28ff319baf0a8b56
[exit 0]
```

```text
(in $CASES/p1/main/.claude/worktrees/feat)
$ git fetch origin
From $CASES/p1/origin
   99d76e5..57b2c58  main       -> origin/main
[exit 0]
```

```text
(in $CASES/p1/main/.claude/worktrees/feat)
$ git show '--format=%H %P%n%s' --no-patch origin/main
57b2c58b475c02ce2dc441ed28ff319baf0a8b56 99d76e55b4542d6cc9e600e7e1bac41ccafb0282
Merge pull request #11 from feat
[exit 0]
```

```text
(in $CASES/p1/main/.claude/worktrees/feat)
$ git show origin/main:plugins/openspec/.claude-plugin/plugin.json
{
  "name": "devkit-openspec",
  "version": "1.1.0",
  "description": "the devkit-openspec pack"
}
[exit 0]
```

```text
(in $CASES/p1/main/.claude/worktrees/feat)
$ git show 'origin/main^1:plugins/openspec/.claude-plugin/plugin.json'
{
  "name": "devkit-openspec",
  "version": "1.0.1",
  "description": "the devkit-openspec pack"
}
[exit 0]
```

```text
(in $CASES/p1/main/.claude/worktrees/feat)
$ node $DEV/deliver-check.mjs feat
deliver-check: feat (schema devkit, ship merge, host cli, head a626463)
  1 met      tasks and gates: checked before PR #11 merged
  2 met      reviews at head: checked before PR #11 merged
  3 met      findings disposed: checked before PR #11 merged
  4 met      acceptance criteria proven: checked before PR #11 merged
  5 met      PR open at local head: PR #11 merged
  6 met      required checks green: checked before PR #11 merged
  7 met      conversation answered: checked before PR #11 merged
  8 met      PR body complete: checked before PR #11 merged
8/8 met: merged: archive step tag-release
next: tag-release v1.1.0 at 57b2c58 (PR #11)
[exit 0]
```

```text
"next" of deliver-check <id> --json at this head:
{
  "step": "tag-release",
  "reason": "PR #11 merged version 1.1.0 of plugins/openspec/.claude-plugin/plugin.json at 57b2c58, and origin has no tag v1.1.0",
  "tag": "v1.1.0",
  "sha": "57b2c58b475c02ce2dc441ed28ff319baf0a8b56",
  "number": 11,
  "merged": "change",
  "version": "1.1.0",
  "file": "plugins/openspec/.claude-plugin/plugin.json",
  "base": "main"
}
```

The `tag-release` row, as the session runs it:

```text
(in $CASES/p1/main/.claude/worktrees/feat)
$ git fetch origin main
From $CASES/p1/origin
 * branch            main       -> FETCH_HEAD
[exit 0]
```

```text
(in $CASES/p1/main/.claude/worktrees/feat)
$ git rev-parse -q --verify refs/tags/v1.1.0   # no local tag yet
(no output)
[exit 1]
```

```text
(in $CASES/p1/main/.claude/worktrees/feat)
$ git tag v1.1.0 57b2c58b475c02ce2dc441ed28ff319baf0a8b56
(no output)
[exit 0]
```

```text
(in $CASES/p1/main/.claude/worktrees/feat)
$ git push origin refs/tags/v1.1.0
To $CASES/p1/origin.git
 * [new tag]         v1.1.0 -> v1.1.0
[exit 0]
```

```text
(in $CASES/p1/main/.claude/worktrees/feat)
$ gh api 'repos/{owner}/{repo}/git/ref/tags/v1.1.0'
{"ref":"refs/tags/v1.1.0","object":{"sha":"57b2c58b475c02ce2dc441ed28ff319baf0a8b56","type":"commit"}}[exit 0]
```

```text
(in $CASES/p1/main/.claude/worktrees/feat)
$ node $DEV/deliver-check.mjs feat
deliver-check: feat (schema devkit, ship merge, host cli, head a626463)
  1 met      tasks and gates: checked before PR #11 merged
  2 met      reviews at head: checked before PR #11 merged
  3 met      findings disposed: checked before PR #11 merged
  4 met      acceptance criteria proven: checked before PR #11 merged
  5 met      PR open at local head: PR #11 merged
  6 met      required checks green: checked before PR #11 merged
  7 met      conversation answered: checked before PR #11 merged
  8 met      PR body complete: checked before PR #11 merged
8/8 met: merged: archive step retro
next: retro PR #11
[exit 0]
```

```text
"next" of deliver-check <id> --json at this head:
{
  "step": "retro",
  "reason": "the change PR is merged; run the retro",
  "number": 11,
  "base": "main"
}
```

### After the train of P-2

The train loop hands the session the push, the pull request and auto-merge of `train/1`; then GitHub merges it, and marks both boarded pull requests merged by the train's merge commit:

```text
(in $CASES/p2/main)
$ node $DEV/train-loop.mjs next --lang en
{
  "version": 1,
  "kind": "session",
  "step": "push-train",
  "detail": {
    "n": 1,
    "number": null,
    "command": [
      "git",
      "-C",
      "$CASES/p2/main/.claude/worktrees/train-1",
      "push",
      "origin",
      "train/1"
    ]
  },
  "reply": null,
  "progressKey": "push-train@1"
}
[exit 0]
```

```text
(in $CASES/p2/main)
$ git -C $CASES/p2/main/.claude/worktrees/train-1 push origin train/1
To $CASES/p2/origin.git
 * [new branch]      train/1 -> train/1
[exit 0]
```

```text
(in $CASES/p2/main)
$ node $DEV/train-loop.mjs next --lang en
{
  "version": 1,
  "kind": "session",
  "step": "open-train-pr",
  "detail": {
    "n": 1,
    "command": [
      "gh",
      "pr",
      "create",
      "--base",
      "main",
      "--head",
      "train/1",
      "--title",
      "train 1: alpha, beta",
      "--body-file",
      "$CASES/p2/main/.claude/worktrees/train-1/openspec/trains/1.md"
    ]
  },
  "reply": null,
  "progressKey": "open-train-pr@1"
}
[exit 0]
```

```text
(in $CASES/p2/main)
$ gh pr create --base main --head train/1 --title 'train 1: alpha, beta' --body-file $CASES/p2/main/.claude/worktrees/train-1/openspec/trains/1.md
https://github.invalid/o/devkit/pull/13
[exit 0]
```

```text
(in $CASES/p2/main)
$ node $DEV/train-loop.mjs next --lang en
{
  "version": 1,
  "kind": "session",
  "step": "enable-auto-merge",
  "detail": {
    "n": 1,
    "number": 13,
    "head": "db69aabfaf98f39896e555334bbe46cd709c9897",
    "command": [
      "gh",
      "pr",
      "merge",
      "13",
      "--auto",
      "--merge",
      "--match-head-commit",
      "db69aabfaf98f39896e555334bbe46cd709c9897"
    ]
  },
  "reply": null,
  "progressKey": "enable-auto-merge@13"
}
[exit 0]
```

```text
(in $CASES/p2/main)
$ gh pr merge 13 --auto --merge --match-head-commit db69aabfaf98f39896e555334bbe46cd709c9897
(no output)
[exit 0]
```

```text
(in $CASES/p2/main)
$ node $DEV/train-loop.mjs next --lang en
{
  "version": 1,
  "kind": "end",
  "step": "train-auto-merge-on",
  "detail": {
    "n": 1,
    "number": 13
  },
  "reply": "Auto-merge is on for pull request #13 of train 1: GitHub merges it once its checks pass.",
  "end": {
    "state": "waiting-on-github",
    "why": "train-auto-merge-on"
  },
  "progressKey": "train-auto-merge-on@13"
}
[exit 1]
```

```text
(in $CASES/p2/main)
$ gh __merge 13   # the stub: GitHub merges the train once its rules pass
14f76407489dd1ccf1b945f3ea3c43004d25ca68 (also marked merged: #11, #12)
[exit 0]
```

```text
(in $CASES/p2/main)
$ git fetch origin
From $CASES/p2/origin
   ec65319..14f7640  main       -> origin/main
[exit 0]
```

```text
(in $CASES/p2/main)
$ git show '--format=%H %P%n%s' --no-patch origin/main
14f76407489dd1ccf1b945f3ea3c43004d25ca68 ec65319e975cad6f4725a5463e14743f01745320 db69aabfaf98f39896e555334bbe46cd709c9897
Merge pull request #13 from train/1
[exit 0]
```

```text
(in $CASES/p2/main)
$ gh pr list --state all --json number,headRefName,state,mergeCommit
[{"number":13,"url":"https://github.invalid/o/devkit/pull/13","state":"MERGED","headRefOid":"db69aabfaf98f39896e555334bbe46cd709c9897","baseRefName":"main","headRefName":"train/1","mergeable":"UNKNOWN","body":"<!-- devkit-train n=1 base=main result=passed -->\n# Train 1\n\n- Base: `main` at `ec65319e975cad6f4725a5463e14743f01745320`\n- Suite: `true`\n- Ran at: `3be634f401f0d00a238c757d2246986c8e3d4f97`\n- Result: passed\n\n## Boarded\n\n| Order | Kind | Change | Pull request | Head | Boarded at |\n| --- | --- | --- | --- | --- | --- |\n| 1 | change | `alpha` | #11 | `c90b5edb64ad6775543475a9c13e60fa06a08bb7` | 2026-11-24T17:38:03Z |\n| 2 | change | `beta` | #12 | `f0f0a7b9d3e7f3268bca8c113786b232a911261b` | 2026-11-24T17:38:11Z |\n\n## Runs\n\n| Run | Changes | Head | Result |\n| --- | --- | --- | --- |\n| 1 | alpha, beta | `3be634f401f0d00a238c757d2246986c8e3d4f97` | passed |\n","title":"train 1: alpha, beta","mergedAt":"2026-11-24T17:41:23.668Z","mergeCommit":{"oid":"14f76407489dd1ccf1b945f3ea3c43004d25ca68"},"autoMergeRequest":null,"mergeStateStatus":"UNKNOWN"},{"number":12,"url":"https://github.invalid/o/devkit/pull/12","state":"MERGED","headRefOid":"f0f0a7b9d3e7f3268bca8c113786b232a911261b","baseRefName":"main","headRefName":"beta","mergeable":"UNKNOWN","body":"beta\n- AC-1\nopenspec/changes/beta/evidence.md\n","title":"beta","mergedAt":"2026-11-24T17:41:23.668Z","mergeCommit":{"oid":"14f76407489dd1ccf1b945f3ea3c43004d25ca68"},"autoMergeRequest":null,"mergeStateStatus":"UNKNOWN"},{"number":11,"url":"https://github.invalid/o/devkit/pull/11","state":"MERGED","headRefOid":"c90b5edb64ad6775543475a9c13e60fa06a08bb7","baseRefName":"main","headRefName":"alpha","mergeable":"UNKNOWN","body":"alpha\n- AC-1\nopenspec/changes/alpha/evidence.md\n","title":"alpha","mergedAt":"2026-11-24T17:41:23.668Z","mergeCommit":{"oid":"14f76407489dd1ccf1b945f3ea3c43004d25ca68"},"autoMergeRequest":null,"mergeStateStatus":"UNKNOWN"}][exit 0]
```

```text
(in $CASES/p2/main/.claude/worktrees/alpha)
$ node $DEV/deliver-check.mjs alpha
deliver-check: alpha (schema devkit, ship merge, host cli, head c90b5ed)
  1 met      tasks and gates: checked before PR #11 merged
  2 met      reviews at head: checked before PR #11 merged
  3 met      findings disposed: checked before PR #11 merged
  4 met      acceptance criteria proven: checked before PR #11 merged
  5 met      PR open at local head: PR #11 merged
  6 met      required checks green: checked before PR #11 merged
  7 met      conversation answered: checked before PR #11 merged
  8 met      PR body complete: checked before PR #11 merged
8/8 met: merged: archive step tag-release
next: tag-release v1.2.0 at 14f7640 (PR #11)
[exit 0]
```

```text
"next" of deliver-check <id> --json at this head:
{
  "step": "tag-release",
  "reason": "PR #11 merged version 1.2.0 of plugins/openspec/.claude-plugin/plugin.json at 14f7640, and origin has no tag v1.2.0",
  "tag": "v1.2.0",
  "sha": "14f76407489dd1ccf1b945f3ea3c43004d25ca68",
  "number": 11,
  "merged": "change",
  "version": "1.2.0",
  "file": "plugins/openspec/.claude-plugin/plugin.json",
  "base": "main"
}
```

The `tag-release` row, as the session runs it in `alpha`'s worktree:

```text
(in $CASES/p2/main/.claude/worktrees/alpha)
$ git fetch origin main
From $CASES/p2/origin
 * branch            main       -> FETCH_HEAD
[exit 0]
```

```text
(in $CASES/p2/main/.claude/worktrees/alpha)
$ git rev-parse -q --verify refs/tags/v1.2.0   # no local tag yet
(no output)
[exit 1]
```

```text
(in $CASES/p2/main/.claude/worktrees/alpha)
$ git tag v1.2.0 14f76407489dd1ccf1b945f3ea3c43004d25ca68
(no output)
[exit 0]
```

```text
(in $CASES/p2/main/.claude/worktrees/alpha)
$ git push origin refs/tags/v1.2.0
To $CASES/p2/origin.git
 * [new tag]         v1.2.0 -> v1.2.0
[exit 0]
```

The same tag is the release of `beta`, carried by the same merge commit, so `beta` asks for no other tag:

```text
(in $CASES/p2/main/.claude/worktrees/alpha)
$ node $DEV/deliver-check.mjs alpha
deliver-check: alpha (schema devkit, ship merge, host cli, head c90b5ed)
  1 met      tasks and gates: checked before PR #11 merged
  2 met      reviews at head: checked before PR #11 merged
  3 met      findings disposed: checked before PR #11 merged
  4 met      acceptance criteria proven: checked before PR #11 merged
  5 met      PR open at local head: PR #11 merged
  6 met      required checks green: checked before PR #11 merged
  7 met      conversation answered: checked before PR #11 merged
  8 met      PR body complete: checked before PR #11 merged
8/8 met: merged: archive step retro
next: retro PR #11
[exit 0]
```

```text
"next" of deliver-check <id> --json at this head:
{
  "step": "retro",
  "reason": "the change PR is merged; run the retro",
  "number": 11,
  "base": "main"
}
```

```text
(in $CASES/p2/main/.claude/worktrees/beta)
$ node $DEV/deliver-check.mjs beta
deliver-check: beta (schema devkit, ship merge, host cli, head f0f0a7b)
  1 met      tasks and gates: checked before PR #12 merged
  2 met      reviews at head: checked before PR #12 merged
  3 met      findings disposed: checked before PR #12 merged
  4 met      acceptance criteria proven: checked before PR #12 merged
  5 met      PR open at local head: PR #12 merged
  6 met      required checks green: checked before PR #12 merged
  7 met      conversation answered: checked before PR #12 merged
  8 met      PR body complete: checked before PR #12 merged
8/8 met: merged: archive step retro
next: retro PR #12
[exit 0]
```

```text
"next" of deliver-check <id> --json at this head:
{
  "step": "retro",
  "reason": "the change PR is merged; run the retro",
  "number": 12,
  "base": "main"
}
```

