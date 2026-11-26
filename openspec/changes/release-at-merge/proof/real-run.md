# Real-run proof: release-at-merge (tasks 6.1 to 6.6, 9.14 after review round 1, and 11.10 after review round 3)

Every case below ran for real, on 2026-11-26, against this worktree's own scripts (`$DEV` is
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

After review round 1 the whole script ran again with P-13 (task 9.14), and its first run of P-13 found one defect in
`release-merge.mjs`, fixed test-first before this run:

- The note's body cites `ADR [feat]`, so the step's record lists `CHANGELOG.md` among the citations it rewrote. After the merge by
  hand, which takes the base's changelog as the `assign-release` row says, the give-back of D-20 tried to put `ADR [feat]` back in an
  entry the file no longer held and refused (`cannot give back the numbers the step wrote in CHANGELOG.md`, exit 2), though the flow
  page already says a `CHANGELOG.md` entry the record wrote is not given back. The give-back now skips `CHANGELOG.md`, whose whole
  text the step writes from the note on the base (test "release-note AC-4 assign: a merge by hand that takes the base's CHANGELOG.md,
  where the step had cited the ADR by its number, is numbered again" in `release-merge.test.mjs`).

After review round 3 the whole script ran again with P-14 to P-16 (task 11.10, D-36). Their changes that the loop walks
(`openLoopChange` of `seed.mjs`) are `devkit-lite` changes whose plan files carry the stage headers and a spec delta
`openspec validate` reads, and every step from the release on is the one this worktree's `change-loop.mjs next` hands. Two steps
the loop hands there are not named in D-36's table and are run as handed: `merge-check` (the merge of the base on the branch checked
with `openspec validate` before the delivery goes on), and the plain `push`, which the loop hands to `devkit-core:commit-and-pr`
and the case runs as its command. The first run of P-14 (d), whose sibling's step wrote the base's entry on the one-line list in the
step's form with the number the change's step had written (`ADR 0002 other` beside `ADR 0002 the rule`), found one defect in
`deliver-check.mjs`, fixed test-first before this run:

- After the merge by hand keeping both entries, the step gave the change's number back and numbered it 0003 (exit 0), but the
  evidence and the reviews written at the merge read stale (`touches docs/context.yaml`): `releaseOnlyEdit` masks the merge's
  text with the records the merge holds, two of them numbered 0002, so both `ADR 0002` read as the first of them and the base's entry
  did not match the step's commit, where it reads as its own record. A number two records hold at one revision now cites either of
  them there (tests "release-note AC-4 staleness: the step run on a merge by hand holding two records numbered 0002, ..." and its guard
  "release-note AC-5 staleness: a citation a person changes on a merge by hand holding two records numbered 0002 still stales the
  records" in `deliver-check.test.mjs`).

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
063988bd5ddbe14deb3240fb517bf407a4fbd347	HEAD
063988bd5ddbe14deb3240fb517bf407a4fbd347	refs/heads/main
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
1e448b9 docs(feat): the plan of feat

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
<!-- devkit-stage approval result=passed attempt=1 commit=063988bd5ddbe14deb3240fb517bf407a4fbd347 -->
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
    did: git commit: 1f2f8e7
$ node $DEV/deliver-check.mjs feat --json   -> 1/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at 1f2f8e7; git commit: 7465eab
$ node $DEV/deliver-check.mjs feat --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at 7465eab; git commit: fecc723
$ node $DEV/deliver-check.mjs feat --json   -> 4/8, next: open-pr (no pull request yet)
    did: git push -u origin feat; gh pr create -> https://github.invalid/o/devkit/pull/11
$ node $DEV/deliver-check.mjs feat --json   -> 8/8, next: assign-release (the release of feat is not assigned yet; assign it before the merge)
```

```text
(in $CASES/p1/main/.claude/worktrees/feat)
$ node $DEV/deliver-check.mjs feat
deliver-check: feat (schema devkit, ship merge, host cli, head e0f265a)
  1 met      tasks and gates: all tasks ticked; 1 gate command green in evidence.md
  2 met      reviews at head: 2 reviews at head
  3 met      findings disposed: 0 fixed, 0 refuted
  4 met      acceptance criteria proven: 1 criteria proven
  5 met      PR open at local head: PR #11 open at e0f265a
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
  "oldHead": "e0f265a8fcfa941e7184a9f393df3cac3b6aab2f",
  "newHead": "9a8b79a14d8e7a75e23aa41c764967961cba4c81",
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
   e0f265a..9a8b79a  feat -> feat
[exit 0]
```

The step's one commit holds only release lines, the record's number and the rewritten citations; no file under `openspec/changes/` changed:

```text
(in $CASES/p1/main/.claude/worktrees/feat)
$ git show --stat '--format=%h %s' HEAD
9a8b79a chore(release): assign the release of feat

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

Its message ends with the step's record (D-20): the change, each release line it wrote, the record's rename and each citation it rewrote, as `Release-` trailers:

```text
(in $CASES/p1/main/.claude/worktrees/feat)
$ git log -1 --format=%B
chore(release): assign the release of feat

Release-change: feat
Release-line: plugins/core/.claude-plugin/plugin.json
Release-line: plugins/openspec/.claude-plugin/plugin.json
Release-line: .claude-plugin/marketplace.json
Release-line: CHANGELOG.md
Release-line: docs/openspec-flow.md
Release-adr: docs/adr/feat.md -> docs/adr/0002-feat.md
Release-citation: CHANGELOG.md
Release-citation: docs/guide.md
Release-citation: docs/openspec-flow.md

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
deliver-check: feat (schema devkit, ship merge, host cli, head 9a8b79a)
  1 met      tasks and gates: all tasks ticked; 1 gate command green in evidence.md
  2 met      reviews at head: 2 reviews at head
  3 met      findings disposed: 0 fixed, 0 refuted
  4 met      acceptance criteria proven: 1 criteria proven
  5 met      PR open at local head: PR #11 open at 9a8b79a
  6 met      required checks green: 2 required checks green
  7 met      conversation answered: every thread and request is answered
  8 met      PR body complete: PR body names the change, its criteria and the evidence
8/8 met: ready
next: enable-auto-merge PR #11 with --squash at 9a8b79a
[exit 0]
```

```text
"next" of deliver-check <id> --json at this head:
{
  "step": "enable-auto-merge",
  "reason": "all eight items are met",
  "number": 11,
  "method": "squash",
  "head": "9a8b79a14d8e7a75e23aa41c764967961cba4c81"
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
    did: git commit: 14fb7d5
$ node $DEV/deliver-check.mjs sib --json   -> 1/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at 14fb7d5; git commit: 9d58cce
$ node $DEV/deliver-check.mjs sib --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at 9d58cce; git commit: 983737e
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
  "oldHead": "890889ad366d82878398f71f4580efb48bd96318",
  "newHead": "70820c2e26319805871fc03e1b8443d09a62f7d9",
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
   890889a..70820c2  sib -> sib
[exit 0]
```

```text
(in $CASES/p1/main/.claude/worktrees/sib)
$ gh pr merge 12 --auto --squash --match-head-commit 70820c2e26319805871fc03e1b8443d09a62f7d9
(no output)
[exit 0]
```

```text
(in $CASES/p1/main)
$ gh __merge 12   # the stub: GitHub merges the pull request once its rules pass
192a0d94c05748d7884c1a5d4541825f98ae1a25
[exit 0]
```

```text
(in $CASES/p1/main)
$ git log --oneline --graph -6 origin/main
* 192a0d9 Merge pull request #12 from sib
* 063988b seed: the project at its first release
[exit 0]
```

### `feat` again: the base moved and released the same pack

GitHub now reports `feat` in conflict with `main` (both wrote the same release lines), so the checker asks for `assign-release` again, in place of the conflict stop:

```text
(in $CASES/p1/main/.claude/worktrees/feat)
$ node $DEV/deliver-check.mjs feat
deliver-check: feat (schema devkit, ship merge, host cli, head 9a8b79a)
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
  ],
  "conflict": true
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
  "oldHead": "9a8b79a14d8e7a75e23aa41c764967961cba4c81",
  "newHead": "55218555beb7e0b46ce32a558b392fb2b8dfc56d",
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
   9a8b79a..5521855  feat -> feat
[exit 0]
```

No conflict was left: the merge commit holds the base, `feat`'s numbers above it (devkit-openspec 1.1.0 over 1.0.1, devkit-core 1.0.1, ADR 0003), both changelog entries and both citations:

```text
(in $CASES/p1/main/.claude/worktrees/feat)
$ git log --oneline --graph -5
*   5521855 chore(release): merge origin/main and assign the release of feat
|\  
| * 192a0d9 Merge pull request #12 from sib
* | 9a8b79a chore(release): assign the release of feat
* | e0f265a docs(feat): change files
* | fecc723 docs(feat): reviews
[exit 0]
```

```text
(in $CASES/p1/main/.claude/worktrees/feat)
$ git show --stat '--format=%h %s' HEAD
5521855 chore(release): merge origin/main and assign the release of feat

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
$ git log -1 --format=%B
chore(release): merge origin/main and assign the release of feat

Release-change: feat
Release-line: plugins/openspec/.claude-plugin/plugin.json
Release-line: .claude-plugin/marketplace.json
Release-line: CHANGELOG.md
Release-line: docs/openspec-flow.md
Release-adr: docs/adr/feat.md -> docs/adr/0003-feat.md
Release-citation: CHANGELOG.md
Release-citation: docs/guide.md
Release-citation: docs/openspec-flow.md

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
deliver-check: feat (schema devkit, ship merge, host cli, head 5521855)
  1 met      tasks and gates: all tasks ticked; 1 gate command green in evidence.md
  2 met      reviews at head: 2 reviews at head
  3 met      findings disposed: 0 fixed, 0 refuted
  4 met      acceptance criteria proven: 1 criteria proven
  5 met      PR open at local head: PR #11 open at 5521855
  6 met      required checks green: 2 required checks green
  7 met      conversation answered: every thread and request is answered
  8 met      PR body complete: PR body names the change, its criteria and the evidence
8/8 met: ready
next: enable-auto-merge PR #11 with --squash at 5521855
[exit 0]
```

```text
"next" of deliver-check <id> --json at this head:
{
  "step": "enable-auto-merge",
  "reason": "all eight items are met",
  "number": 11,
  "method": "squash",
  "head": "55218555beb7e0b46ce32a558b392fb2b8dfc56d"
}
```

The session enables auto-merge with the row's exact command; P-12 lets GitHub merge it and follows the tag.

```text
(in $CASES/p1/main/.claude/worktrees/feat)
$ gh pr merge 11 --auto --squash --match-head-commit 55218555beb7e0b46ce32a558b392fb2b8dfc56d
(no output)
[exit 0]
```

```text
(in $CASES/p1/main/.claude/worktrees/feat)
$ node $DEV/deliver-check.mjs feat
deliver-check: feat (schema devkit, ship merge, host cli, head 5521855)
  1 met      tasks and gates: all tasks ticked; 1 gate command green in evidence.md
  2 met      reviews at head: 2 reviews at head
  3 met      findings disposed: 0 fixed, 0 refuted
  4 met      acceptance criteria proven: 1 criteria proven
  5 met      PR open at local head: PR #11 open at 5521855
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
    did: git commit: f19f317
$ node $DEV/deliver-check.mjs alpha --json   -> 1/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at f19f317; git commit: 5c0e81f
$ node $DEV/deliver-check.mjs alpha --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at 5c0e81f; git commit: 534d215
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
    did: git commit: 30dab62
$ node $DEV/deliver-check.mjs beta --json   -> 1/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at 30dab62; git commit: 122d6fb
$ node $DEV/deliver-check.mjs beta --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at 122d6fb; git commit: c0f30b1
$ node $DEV/deliver-check.mjs beta --json   -> 4/8, next: open-pr (no pull request yet)
    did: git push -u origin beta; gh pr create -> https://github.invalid/o/devkit/pull/12
$ node $DEV/deliver-check.mjs beta --json   -> 8/8, next: boarded (every item of the contract is met; the change leaves with the next train)
```

```text
(in $CASES/p2/main/.claude/worktrees/alpha)
$ node $DEV/deliver-check.mjs alpha
deliver-check: alpha (schema devkit, ship merge, host cli, head 1bb14d6)
  1 met      tasks and gates: all tasks ticked; 1 gate command green in evidence.md
  2 met      reviews at head: 2 reviews at head
  3 met      findings disposed: 0 fixed, 0 refuted
  4 met      acceptance criteria proven: 1 criteria proven
  5 met      PR open at local head: PR #11 open at 1bb14d6
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
1bb14d6e97c91e0b73cc12833d33d0000a2d35ce	refs/heads/alpha
509164cc0775f44d89a7fe468ea3f78a8da98fd1	refs/heads/beta
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
      "head": "1bb14d6e97c91e0b73cc12833d33d0000a2d35ce",
      "at": "2026-11-26T20:52:05Z"
    },
    {
      "kind": "change",
      "id": "beta",
      "number": 12,
      "head": "509164cc0775f44d89a7fe468ea3f78a8da98fd1",
      "at": "2026-11-26T20:52:08Z"
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
* fbe0e5e chore(train): record train 1
*   faf5be0 chore(train): join 509164c and renumber its release above the train
|\  
| * 509164c docs(beta): change files
| * c0f30b1 docs(beta): reviews
| * 122d6fb docs(beta): evidence
| * 30dab62 feat(beta): phase work
| * b316ee2 docs(beta): the plan of beta
* 0a4b664 chore(train): join 1bb14d6 and renumber its release above the train
* 1bb14d6 docs(alpha): change files
* 534d215 docs(alpha): reviews
* 5c0e81f docs(alpha): evidence
* f19f317 feat(alpha): phase work
* 3352f82 docs(alpha): the plan of alpha
[exit 0]
```

```text
(in $CASES/p2/main/.claude/worktrees/train-1)
$ git show --stat '--format=%h %s' 'HEAD~2'
0a4b664 chore(train): join 1bb14d6 and renumber its release above the train

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
faf5be0 chore(train): join 509164c and renumber its release above the train

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

- Base: `main` at `d7fd347da56402499980cfa33a0c24a9f2fea2e2`
- Suite: `true`
- Ran at: `faf5be0bc3fd71d4d35de413d595fd1f3c0c0884`
- Result: passed

## Boarded

| Order | Kind | Change | Pull request | Head | Boarded at |
| --- | --- | --- | --- | --- | --- |
| 1 | change | `alpha` | #11 | `1bb14d6e97c91e0b73cc12833d33d0000a2d35ce` | 2026-11-26T20:52:05Z |
| 2 | change | `beta` | #12 | `509164cc0775f44d89a7fe468ea3f78a8da98fd1` | 2026-11-26T20:52:08Z |

## Runs

| Run | Changes | Head | Result |
| --- | --- | --- | --- |
| 1 | alpha, beta | `faf5be0bc3fd71d4d35de413d595fd1f3c0c0884` | passed |
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
  change alpha (#11, head 1bb14d6): pass
  change beta (#12, head 509164c): pass
pass
[exit 0]
```

Both boarded heads are unchanged, locally and on origin:

```text
(in $CASES/p2/main)
$ git ls-remote origin refs/heads/alpha refs/heads/beta
1bb14d6e97c91e0b73cc12833d33d0000a2d35ce	refs/heads/alpha
509164cc0775f44d89a7fe468ea3f78a8da98fd1	refs/heads/beta
[exit 0]
```

```text
(in $CASES/p2/main/.claude/worktrees/alpha)
$ node $DEV/deliver-check.mjs alpha
deliver-check: alpha (schema devkit, ship merge, host cli, head 1bb14d6)
  1 met      tasks and gates: all tasks ticked; 1 gate command green in evidence.md
  2 met      reviews at head: 2 reviews at head
  3 met      findings disposed: 0 fixed, 0 refuted
  4 met      acceptance criteria proven: 1 criteria proven
  5 met      PR open at local head: PR #11 open at 1bb14d6
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
deliver-check: beta (schema devkit, ship merge, host cli, head 509164c)
  1 met      tasks and gates: all tasks ticked; 1 gate command green in evidence.md
  2 met      reviews at head: 2 reviews at head
  3 met      findings disposed: 0 fixed, 0 refuted
  4 met      acceptance criteria proven: 1 criteria proven
  5 met      PR open at local head: PR #12 open at 509164c
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
0879232 docs(old): the plan of old

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
    did: git commit: e6ed786
$ node $DEV/deliver-check.mjs old --json   -> 1/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at e6ed786; git commit: c457582
$ node $DEV/deliver-check.mjs old --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at c457582; git commit: e37942a
$ node $DEV/deliver-check.mjs old --json   -> 4/8, next: open-pr (no pull request yet)
    did: git push -u origin old; gh pr create -> https://github.invalid/o/devkit/pull/11
$ node $DEV/deliver-check.mjs old --json   -> 8/8, next: enable-auto-merge (all eight items are met)
```

With no note the checker asks no `assign-release`: the last step is `enable-auto-merge`, as before. Before the owner lets it merge, another change lands on `main` by the old rule too (devkit-core 1.0.1 and its own `docs/adr/0002-landed.md`):

```text
(in $CASES/p3/main)
$ git push origin main
To $CASES/p3/origin.git
   02ddaf1..8baec32  main -> main
[exit 0]
```

```text
(in $CASES/p3/main/.claude/worktrees/old)
$ node $DEV/deliver-check.mjs old
deliver-check: old (schema devkit, ship merge, host cli, head 87f16ee)
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
3ae827c docs(old): renumber the ADR the base took

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
    did: wrote evidence.md at 3ae827c; git commit: a8167ac
$ node $DEV/deliver-check.mjs old --json   -> 6/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at a8167ac; git commit: aeb0100
$ node $DEV/deliver-check.mjs old --json   -> 7/8, next: blocked (PR #11 has merge conflicts with main)
```

```text
(in $CASES/p3/main/.claude/worktrees/old)
$ node $DEV/deliver-check.mjs old
deliver-check: old (schema devkit, ship merge, host cli, head aeb0100)
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
  "oldHead": "aeb010055e3ddb1a83c285c5b13abd66a5459de9",
  "newHead": "dff9b421b5b0554606cdb72c7fa7d546f3becb37",
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
   87f16ee..dff9b42  old -> old
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
deliver-check: old (schema devkit, ship merge, host cli, head dff9b42)
  1 met      tasks and gates: all tasks ticked; 1 gate command green in evidence.md
  2 met      reviews at head: 2 reviews at head
  3 met      findings disposed: 0 fixed, 0 refuted
  4 met      acceptance criteria proven: 1 criteria proven
  5 met      PR open at local head: PR #11 open at dff9b42
  6 met      required checks green: 2 required checks green
  7 met      conversation answered: every thread and request is answered
  8 met      PR body complete: PR body names the change, its criteria and the evidence
8/8 met: ready
next: enable-auto-merge PR #11 with --squash at dff9b42
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
    did: git commit: 3f12eb6
$ node $DEV/deliver-check.mjs oldt --json   -> 1/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at 3f12eb6; git commit: f4c2543
$ node $DEV/deliver-check.mjs oldt --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at f4c2543; git commit: ae5b99f
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
    did: git commit: fcd70e4
$ node $DEV/deliver-check.mjs notedt --json   -> 1/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at fcd70e4; git commit: b26fd9d
$ node $DEV/deliver-check.mjs notedt --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at b26fd9d; git commit: 7c6e6fc
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
      "head": "1adeca4ed4907530b7d09f2bb7a206a229cdc826",
      "at": "2026-11-26T20:52:26Z"
    },
    {
      "kind": "change",
      "id": "notedt",
      "number": 12,
      "head": "12950a346aa05c49a2a83b19ab35c7c2bd5f79c9",
      "at": "2026-11-26T20:52:29Z"
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
* 956f8b9 chore(train): record train 1
*   048250e chore(train): join 12950a3 and renumber its release above the train
|\  
| * 12950a3 docs(notedt): change files
| * 7c6e6fc docs(notedt): reviews
| * b26fd9d docs(notedt): evidence
| * fcd70e4 feat(notedt): phase work
| * e3439ca docs(notedt): the plan of notedt
* 2fbaeab chore(train): join 1adeca4 and renumber its release above the train
* 1adeca4 docs(oldt): change files
* ae5b99f docs(oldt): reviews
* f4c2543 docs(oldt): evidence
* 3f12eb6 feat(oldt): phase work
* 305312c docs(oldt): the plan of oldt
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
  change oldt (#11, head 1adeca4): pass
  change notedt (#12, head 12950a3): pass
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
    did: git commit: 1005d1b
$ node $DEV/deliver-check.mjs feature --json   -> 1/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at 1005d1b; git commit: ec011ed
$ node $DEV/deliver-check.mjs feature --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at ec011ed; git commit: 615a6f5
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
  "oldHead": "0c75f78045232f3b4903f353f63b670fb5857433",
  "newHead": "f9314b8d2918fcc409bd068c606c6cd270e47752",
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
   0c75f78..f9314b8  feature -> feature
[exit 0]
```

```text
(in $CASES/p4a/main/.claude/worktrees/feature)
$ git show --stat '--format=%h %s' HEAD
f9314b8 chore(release): assign the release of feature

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
deliver-check: feature (schema devkit, ship merge, host cli, head f9314b8)
  1 met      tasks and gates: all tasks ticked; 1 gate command green in evidence.md
  2 met      reviews at head: 2 reviews at head
  3 met      findings disposed: 0 fixed, 0 refuted
  4 met      acceptance criteria proven: 1 criteria proven
  5 met      PR open at local head: PR #11 open at f9314b8
  6 met      required checks green: 2 required checks green
  7 met      conversation answered: every thread and request is answered
  8 met      PR body complete: PR body names the change, its criteria and the evidence
8/8 met: ready
next: enable-auto-merge PR #11 with --squash at f9314b8
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
    did: git commit: bf1a197
$ node $DEV/deliver-check.mjs feature --json   -> 1/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at bf1a197; git commit: f3a9f92
$ node $DEV/deliver-check.mjs feature --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at f3a9f92; git commit: e45dd7e
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
  "oldHead": "654b78131dcf008d35114b97c92e14d39ceae517",
  "newHead": "ede9349ad26a541134412558364504e0fbf9b118",
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
   654b781..ede9349  feature -> feature
[exit 0]
```

```text
(in $CASES/p4b/main/.claude/worktrees/feature)
$ git show --stat '--format=%h %s' HEAD
ede9349 chore(release): assign the release of feature

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
deliver-check: feature (schema devkit, ship merge, host cli, head ede9349)
  1 met      tasks and gates: all tasks ticked; 1 gate command green in evidence.md
  2 met      reviews at head: 2 reviews at head
  3 met      findings disposed: 0 fixed, 0 refuted
  4 met      acceptance criteria proven: 1 criteria proven
  5 met      PR open at local head: PR #11 open at ede9349
  6 met      required checks green: 2 required checks green
  7 met      conversation answered: every thread and request is answered
  8 met      PR body complete: PR body names the change, its criteria and the evidence
8/8 met: ready
next: enable-auto-merge PR #11 with --squash at ede9349
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
    did: git commit: 7a42dba
$ node $DEV/deliver-check.mjs feature --json   -> 1/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at 7a42dba; git commit: 52c884c
$ node $DEV/deliver-check.mjs feature --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at 52c884c; git commit: 7754d5b
$ node $DEV/deliver-check.mjs feature --json   -> 4/8, next: open-pr (no pull request yet)
    did: git push -u origin feature; gh pr create -> https://github.invalid/o/devkit/pull/11
$ node $DEV/deliver-check.mjs feature --json   -> 8/8, next: enable-auto-merge (all eight items are met)
```

```text
(in $CASES/p4c/main/.claude/worktrees/feature)
$ node $DEV/deliver-check.mjs feature
deliver-check: feature (schema devkit, ship merge, host cli, head 4e9e3ee)
  1 met      tasks and gates: all tasks ticked; 1 gate command green in evidence.md
  2 met      reviews at head: 2 reviews at head
  3 met      findings disposed: 0 fixed, 0 refuted
  4 met      acceptance criteria proven: 1 criteria proven
  5 met      PR open at local head: PR #11 open at 4e9e3ee
  6 met      required checks green: 2 required checks green
  7 met      conversation answered: every thread and request is answered
  8 met      PR body complete: PR body names the change, its criteria and the evidence
8/8 met: ready
next: enable-auto-merge PR #11 with --squash at 4e9e3ee
[exit 0]
```

```text
(in $CASES/p4c/main/.claude/worktrees/feature)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": true,
  "oldHead": "4e9e3eea9d4f0aeab297765197817489fc672625",
  "newHead": "4e9e3eea9d4f0aeab297765197817489fc672625",
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
    did: git commit: 22794ca
$ node $DEV/deliver-check.mjs plain --json   -> 1/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at 22794ca; git commit: 306b9e6
$ node $DEV/deliver-check.mjs plain --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at 306b9e6; git commit: 79861a9
$ node $DEV/deliver-check.mjs plain --json   -> 4/8, next: open-pr (no pull request yet)
    did: git push -u origin plain; gh pr create -> https://github.invalid/o/devkit/pull/11
$ node $DEV/deliver-check.mjs plain --json   -> 8/8, next: enable-auto-merge (all eight items are met)
```

```text
(in $CASES/p5/main/.claude/worktrees/plain)
$ node $DEV/deliver-check.mjs plain
deliver-check: plain (schema devkit, ship merge, host cli, head 6c4c06b)
  1 met      tasks and gates: all tasks ticked; 1 gate command green in evidence.md
  2 met      reviews at head: 2 reviews at head
  3 met      findings disposed: 0 fixed, 0 refuted
  4 met      acceptance criteria proven: 1 criteria proven
  5 met      PR open at local head: PR #11 open at 6c4c06b
  6 met      required checks green: 2 required checks green
  7 met      conversation answered: every thread and request is answered
  8 met      PR body complete: PR body names the change, its criteria and the evidence
8/8 met: ready
next: enable-auto-merge PR #11 with --squash at 6c4c06b
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
    did: git commit: f5c4dfb
$ node $DEV/deliver-check.mjs noted --json   -> 1/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at f5c4dfb; git commit: b535ca4
$ node $DEV/deliver-check.mjs noted --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at b535ca4; git commit: b1675c3
$ node $DEV/deliver-check.mjs noted --json   -> 4/8, next: open-pr (no pull request yet)
    did: git push -u origin noted; gh pr create -> https://github.invalid/o/devkit/pull/12
$ node $DEV/deliver-check.mjs noted --json   -> 8/8, next: enable-auto-merge (all eight items are met)
```

```text
(in $CASES/p5/main/.claude/worktrees/noted)
$ node $DEV/deliver-check.mjs noted
deliver-check: noted (schema devkit, ship merge, host cli, head f0c9529)
  1 met      tasks and gates: all tasks ticked; 1 gate command green in evidence.md
  2 met      reviews at head: 2 reviews at head
  3 met      findings disposed: 0 fixed, 0 refuted
  4 met      acceptance criteria proven: 1 criteria proven
  5 met      PR open at local head: PR #12 open at f0c9529
  6 met      required checks green: 2 required checks green
  7 met      conversation answered: every thread and request is answered
  8 met      PR body complete: PR body names the change, its criteria and the evidence
8/8 met: ready
next: enable-auto-merge PR #12 with --squash at f0c9529
[exit 0]
```

The step, run by hand, refuses to run in a project with no release setting with a usage error (exit 3, D-24) and writes nothing (the checker never asks for it there):

```text
(in $CASES/p5/main/.claude/worktrees/noted)
$ node $DEV/release-merge.mjs --assign --base main --json
release-merge: openspec/config.yaml names no devkit.release_tag: this project has no release to assign
[exit 3]
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
    did: git commit: 1e13e34
$ node $DEV/deliver-check.mjs hand --json   -> 1/8, next: blocked (release lines edited by hand: plugins/core/.claude-plugin/plugin.json)
```

```text
(in $CASES/p6/main/.claude/worktrees/hand)
$ node $DEV/deliver-check.mjs hand
deliver-check: hand (schema devkit, ship merge, host cli, head 1e13e34)
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
  "oldHead": "1e13e34dfac08717c2bbd5922f1ff8951053a3da",
  "change": "hand",
  "conflicts": [],
  "error": "release lines edited by hand: plugins/core/.claude-plugin/plugin.json",
  "mode": "assign"
}
release-merge: release lines edited by hand: plugins/core/.claude-plugin/plugin.json
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
    did: wrote evidence.md at 51d60ee; git commit: 1b181cf
$ node $DEV/deliver-check.mjs hand --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at 1b181cf; git commit: 145e434
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
  "oldHead": "e4f4c2b4e5f84c47ad5a0edc576902cbef9a48f8",
  "newHead": "5e561e1775f8ce7b345f10c1a2fa336d7de20439",
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
   e4f4c2b..5e561e1  hand -> hand
[exit 0]
```

```text
(in $CASES/p6/main/.claude/worktrees/hand)
$ node $DEV/deliver-check.mjs hand
deliver-check: hand (schema devkit, ship merge, host cli, head 5e561e1)
  1 met      tasks and gates: all tasks ticked; 1 gate command green in evidence.md
  2 met      reviews at head: 2 reviews at head
  3 met      findings disposed: 0 fixed, 0 refuted
  4 met      acceptance criteria proven: 1 criteria proven
  5 met      PR open at local head: PR #11 open at 5e561e1
  6 met      required checks green: 2 required checks green
  7 met      conversation answered: every thread and request is answered
  8 met      PR body complete: PR body names the change, its criteria and the evidence
8/8 met: ready
next: enable-auto-merge PR #11 with --squash at 5e561e1
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
    did: git commit: 81c79d5
$ node $DEV/deliver-check.mjs nonote --json   -> 1/8, next: blocked (no release: plugins/core: the change has no release note and no version bump of its own; write openspec/changes/nonote/release.md)
```

```text
(in $CASES/p7/main/.claude/worktrees/nonote)
$ node $DEV/deliver-check.mjs nonote
deliver-check: nonote (schema devkit-lite, ship merge, host cli, head 81c79d5)
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
77a2b6e docs(nonote): the release note: no release

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
    did: wrote evidence.md at 77a2b6e; git commit: 67497d2
$ node $DEV/deliver-check.mjs nonote --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at 67497d2; git commit: 8d40c73
$ node $DEV/deliver-check.mjs nonote --json   -> 4/8, next: open-pr (no pull request yet)
    did: git push -u origin nonote; gh pr create -> https://github.invalid/o/devkit/pull/11
$ node $DEV/deliver-check.mjs nonote --json   -> 8/8, next: enable-auto-merge (all eight items are met)
```

```text
(in $CASES/p7/main/.claude/worktrees/nonote)
$ node $DEV/deliver-check.mjs nonote
deliver-check: nonote (schema devkit-lite, ship merge, host cli, head 2c31065)
  1 met      tasks and gates: all tasks ticked; 1 gate command green in evidence.md
  2 met      reviews at head: 2 reviews at head
  3 met      findings disposed: 0 fixed, 0 refuted
  4 met      acceptance criteria proven: 1 criteria proven
  5 met      PR open at local head: PR #11 open at 2c31065
  6 met      required checks green: 2 required checks green
  7 met      conversation answered: every thread and request is answered
  8 met      PR body complete: PR body names the change, its criteria and the evidence
8/8 met: ready
next: enable-auto-merge PR #11 with --squash at 2c31065
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
    did: git commit: 439cf6c
$ node $DEV/deliver-check.mjs noadr --json   -> 1/8, next: blocked (no release: docs/adr/noadr.md: the change has no release note and no version bump of its own; write openspec/changes/noadr/release.md)
```

```text
(in $CASES/p7/main/.claude/worktrees/noadr)
$ node $DEV/deliver-check.mjs noadr
deliver-check: noadr (schema devkit-lite, ship merge, host cli, head 439cf6c)
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
eb62913 docs(noadr): the release note: no release

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
    did: wrote evidence.md at eb62913; git commit: 05d0f32
$ node $DEV/deliver-check.mjs noadr --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at 05d0f32; git commit: 1f860f7
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
  "oldHead": "e11c38c6a38e61d8ffadbb12ad82509a191eacfe",
  "newHead": "9b6ee683ce2ec1aac0102fc5be87cda42df21383",
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
   e11c38c..9b6ee68  noadr -> noadr
[exit 0]
```

```text
(in $CASES/p7/main/.claude/worktrees/noadr)
$ node $DEV/deliver-check.mjs noadr
deliver-check: noadr (schema devkit-lite, ship merge, host cli, head 9b6ee68)
  1 met      tasks and gates: all tasks ticked; 1 gate command green in evidence.md
  2 met      reviews at head: 2 reviews at head
  3 met      findings disposed: 0 fixed, 0 refuted
  4 met      acceptance criteria proven: 1 criteria proven
  5 met      PR open at local head: PR #12 open at 9b6ee68
  6 met      required checks green: 2 required checks green
  7 met      conversation answered: every thread and request is answered
  8 met      PR body complete: PR body names the change, its criteria and the evidence
8/8 met: ready
next: enable-auto-merge PR #12 with --squash at 9b6ee68
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
<!-- devkit-stage approval result=passed attempt=1 commit=4170b51119e17a835896a7d65b32dec881f68f11 -->
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
    did: git commit: 579e459
$ node $DEV/deliver-check.mjs late --json   -> 1/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at 579e459; git commit: 7688ec2
$ node $DEV/deliver-check.mjs late --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at 7688ec2; git commit: e05ef96
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
de82ac4 docs(late): a bigger release

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
deliver-check: late (schema devkit, ship merge, host cli, head de82ac4)
  1 met      tasks and gates: all tasks ticked; 1 gate command green in evidence.md
  2 met      reviews at head: 2 reviews at head
  3 met      findings disposed: 0 fixed, 0 refuted
  4 met      acceptance criteria proven: 1 criteria proven
  5 open     PR open at local head: local is ahead of PR head 6e28395; push
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
  "plan": "sha256:83ed58ce5f8f",
  "file": "openspec/changes/late/approval.md"
}
```

The session stops and asks the owner; once the owner's own message approves again, it writes `approval.md` as the `stop-plan-approval` row says, with `next.readiness` and `- Release note: <next.release>`, and runs the loop again:

```text
(in $CASES/p8/main/.claude/worktrees/late)
$ cat openspec/changes/late/approval.md
<!-- devkit-stage approval result=passed attempt=2 commit=de82ac4bd56a71cd64ba700770a18704df8fefb6 -->
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
$ node $DEV/deliver-check.mjs late --json   -> 7/8, next: push (local is ahead of PR head 6e28395; push)
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
  "oldHead": "1d3b1afd6d5ba35db6cb4a03460c1f7c6acd0647",
  "newHead": "3a3efa93a841edb97fb13bcf7dcc3b07acdfdebb",
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
   1d3b1af..3a3efa9  late -> late
[exit 0]
```

```text
(in $CASES/p8/main/.claude/worktrees/late)
$ node $DEV/deliver-check.mjs late
deliver-check: late (schema devkit, ship merge, host cli, head 3a3efa9)
  1 met      tasks and gates: all tasks ticked; 1 gate command green in evidence.md
  2 met      reviews at head: 2 reviews at head
  3 met      findings disposed: 0 fixed, 0 refuted
  4 met      acceptance criteria proven: 1 criteria proven
  5 met      PR open at local head: PR #11 open at 3a3efa9
  6 met      required checks green: 2 required checks green
  7 met      conversation answered: every thread and request is answered
  8 met      PR body complete: PR body names the change, its criteria and the evidence
8/8 met: ready
next: enable-auto-merge PR #11 with --squash at 3a3efa9
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
    did: git commit: 5166a86
$ node $DEV/deliver-check.mjs citing --json   -> 1/8, next: blocked (ADR [cited] is cited but has not landed on main)
```

```text
(in $CASES/p9/main/.claude/worktrees/citing)
$ node $DEV/deliver-check.mjs citing
deliver-check: citing (schema devkit, ship merge, host cli, head 5166a86)
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
  "oldHead": "5166a86f28572ae28c8a62cd94bf798e4ab1bfea",
  "change": "citing",
  "conflicts": [],
  "error": "ADR [cited] is cited but has not landed on main; it lands with its own change",
  "mode": "assign"
}
release-merge: ADR [cited] is cited but has not landed on main; it lands with its own change
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
    did: git commit: ac19ed2
$ node $DEV/deliver-check.mjs cited --json   -> 1/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at ac19ed2; git commit: 3e1f711
$ node $DEV/deliver-check.mjs cited --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at 3e1f711; git commit: 12032cf
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
  "oldHead": "2a53722ccb7cc8d69dea79b85f973cedce258c55",
  "newHead": "6d1c6760151d42ad607bff649f693b4c35e60983",
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
   2a53722..6d1c676  cited -> cited
[exit 0]
```

```text
(in $CASES/p9/main/.claude/worktrees/cited)
$ gh pr merge 11 --auto --squash --match-head-commit 6d1c6760151d42ad607bff649f693b4c35e60983
(no output)
[exit 0]
```

```text
(in $CASES/p9/main)
$ gh __merge 11   # the stub: GitHub merges the pull request once its rules pass
bd35de0db87ef88431ec6ae37cce7d08da68014f
[exit 0]
```

`citing` again, after a fetch: the citation has landed, so the checker no longer blocks and the run goes on to the release step, which rewrites the citation to the number `cited` took and numbers `citing`'s own record above it:

```text
(in $CASES/p9/main/.claude/worktrees/citing)
$ git fetch origin
From $CASES/p9/origin
   c9b524d..bd35de0  main       -> origin/main
[exit 0]
```

```text
(in $CASES/p9/main/.claude/worktrees/citing)
$ node $DEV/deliver-check.mjs citing --json   -> 1/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at 5166a86; git commit: a77fb9a
$ node $DEV/deliver-check.mjs citing --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at a77fb9a; git commit: 7ec3913
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
  "oldHead": "a258c210792250bb8ea7b46caad26d46be2e0125",
  "newHead": "43643b29d17b518a3d6e169092db09186e35e6ce",
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
   a258c21..43643b2  citing -> citing
[exit 0]
```

```text
(in $CASES/p9/main/.claude/worktrees/citing)
$ node $DEV/deliver-check.mjs citing
deliver-check: citing (schema devkit, ship merge, host cli, head 43643b2)
  1 met      tasks and gates: all tasks ticked; 1 gate command green in evidence.md
  2 met      reviews at head: 2 reviews at head
  3 met      findings disposed: 0 fixed, 0 refuted
  4 met      acceptance criteria proven: 1 criteria proven
  5 met      PR open at local head: PR #12 open at 43643b2
  6 met      required checks green: 2 required checks green
  7 met      conversation answered: every thread and request is answered
  8 met      PR body complete: PR body names the change, its criteria and the evidence
8/8 met: ready
next: enable-auto-merge PR #12 with --squash at 43643b2
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
    did: git commit: 95c6b22
$ node $DEV/deliver-check.mjs cache --json   -> 1/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at 95c6b22; git commit: 70c7fbe
$ node $DEV/deliver-check.mjs cache --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at 70c7fbe; git commit: 0146615
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
  "oldHead": "cb98573ccd4576c98812797b944fa7df5907ae6d",
  "newHead": "544cbcc179e46f8ed8c8ddc15b397ac9cc30f400",
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
   cb98573..544cbcc  cache -> cache
[exit 0]
```

```text
(in $CASES/p10/main/.claude/worktrees/cache)
$ gh pr merge 11 --auto --squash --match-head-commit 544cbcc179e46f8ed8c8ddc15b397ac9cc30f400
(no output)
[exit 0]
```

```text
(in $CASES/p10/main)
$ gh __merge 11   # the stub: GitHub merges the pull request once its rules pass
99d9493b39b34c18df61c99d5abbacbd28874ddd
[exit 0]
```

`cache` landed as `docs/adr/0002-cache-store.md`. `cache-store` reaches its release step; the step merges `main` and refuses the second record with that slug, undoing the merge:

```text
(in $CASES/p10/main/.claude/worktrees/cache-store)
$ git fetch origin
From $CASES/p10/origin
   d9dc292..99d9493  main       -> origin/main
[exit 0]
```

```text
(in $CASES/p10/main/.claude/worktrees/cache-store)
$ node $DEV/deliver-check.mjs cache-store --json   -> 1/8, next: implement (phase 1 has unticked tasks: 1.1)
    did: wrote src/cache-store-1.ts; ticked 1.1
$ node $DEV/deliver-check.mjs cache-store --json   -> 1/8, next: gate (phase 1 is implemented; run its gate 1.2)
    did: ran `node -e 0` (exit 0); ticked 1.2
$ node $DEV/deliver-check.mjs cache-store --json   -> 1/8, next: commit (uncommitted changes outside openspec/: src/cache-store-1.ts)
    did: git commit: eca43f5
$ node $DEV/deliver-check.mjs cache-store --json   -> 1/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at eca43f5; git commit: 7944209
$ node $DEV/deliver-check.mjs cache-store --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at 7944209; git commit: b46631b
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
  "oldHead": "508761c3154eec594f9ca6cf361d8c92c8804d25",
  "change": "cache-store",
  "conflicts": [],
  "error": "a second ADR with the slug cache-store: docs/adr/cache-store.md, docs/adr/0002-cache-store.md",
  "mode": "assign"
}
release-merge: a second ADR with the slug cache-store: docs/adr/cache-store.md, docs/adr/0002-cache-store.md
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
80188a4 docs(cache-store): a slug of its own for the record

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
    did: wrote evidence.md at 80188a4; git commit: 11b14d6
$ node $DEV/deliver-check.mjs cache-store --json   -> 6/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at 11b14d6; git commit: a6cb981
$ node $DEV/deliver-check.mjs cache-store --json   -> 7/8, next: push (local is ahead of PR head 508761c; push; branch is behind main; update it)
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
  "oldHead": "a6cb9817b45360e99e5e40656c79a6d61dde0783",
  "newHead": "0855c675736d41d749f262ced79cab1c8f7c7921",
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
   a6cb981..0855c67  cache-store -> cache-store
[exit 0]
```

```text
(in $CASES/p10/main/.claude/worktrees/cache-store)
$ node $DEV/deliver-check.mjs cache-store
deliver-check: cache-store (schema devkit, ship merge, host cli, head 0855c67)
  1 met      tasks and gates: all tasks ticked; 1 gate command green in evidence.md
  2 met      reviews at head: 2 reviews at head
  3 met      findings disposed: 0 fixed, 0 refuted
  4 met      acceptance criteria proven: 1 criteria proven
  5 met      PR open at local head: PR #12 open at 0855c67
  6 met      required checks green: 2 required checks green
  7 met      conversation answered: every thread and request is answered
  8 met      PR body complete: PR body names the change, its criteria and the evidence
8/8 met: ready
next: enable-auto-merge PR #12 with --squash at 0855c67
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
    did: git commit: 1cd4e7c
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
deliver-check: mal (schema devkit-lite, ship merge, host cli, head af4a174)
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
  "oldHead": "af4a174796d11f40aa3ccbe12c00d0823996ef35",
  "change": "mal",
  "conflicts": [],
  "error": "release.md: packs: missing (the note starts with \"packs:\" or \"packs: []\")",
  "mode": "assign"
}
release-merge: release.md: packs: missing (the note starts with "packs:" or "packs: []")
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
deliver-check: mal (schema devkit-lite, ship merge, host cli, head abdafda)
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
  "oldHead": "abdafda218ad2d1132514626256bb41b3cbccd7a",
  "change": "mal",
  "conflicts": [],
  "error": "release.md: packs: missing (the note starts with \"packs:\" or \"packs: []\")",
  "mode": "assign"
}
release-merge: release.md: packs: missing (the note starts with "packs:" or "packs: []")
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
deliver-check: mal (schema devkit-lite, ship merge, host cli, head ca03df5)
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
  "oldHead": "ca03df5ba3958d52905cfe51cae143118c9f209c",
  "change": "mal",
  "conflicts": [],
  "error": "release.md: packs: line 2: \"- devkit-core patch\" is not \"- <pack>: patch|minor|major\"",
  "mode": "assign"
}
release-merge: release.md: packs: line 2: "- devkit-core patch" is not "- <pack>: patch|minor|major"
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
deliver-check: mal (schema devkit-lite, ship merge, host cli, head 886f2ed)
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
  "oldHead": "886f2edd8ed9314bc3e39dc5d141d25dfb4f8415",
  "change": "mal",
  "conflicts": [],
  "error": "release.md: packs: devkit-core: \"big\" is not patch, minor or major",
  "mode": "assign"
}
release-merge: release.md: packs: devkit-core: "big" is not patch, minor or major
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
deliver-check: mal (schema devkit-lite, ship merge, host cli, head 3f5701b)
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
  "oldHead": "3f5701bbc0fde3e207183ae36aae694a4682a817",
  "change": "mal",
  "conflicts": [],
  "error": "release.md: packs: devkit-core is listed twice",
  "mode": "assign"
}
release-merge: release.md: packs: devkit-core is listed twice
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
deliver-check: mal (schema devkit-lite, ship merge, host cli, head c0bd367)
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
  "oldHead": "c0bd3677f166f0ca70b8fceb7a974d756c464d4a",
  "change": "mal",
  "conflicts": [],
  "error": "release.md: marketplace: out of order (the fields come as packs:, marketplace:, release:)",
  "mode": "assign"
}
release-merge: release.md: marketplace: out of order (the fields come as packs:, marketplace:, release:)
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
deliver-check: mal (schema devkit-lite, ship merge, host cli, head 43c4d94)
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
  "oldHead": "43c4d94a80ca73d9801b20666bec9fefc06cc050",
  "change": "mal",
  "conflicts": [],
  "error": "release.md: marketplace: given twice",
  "mode": "assign"
}
release-merge: release.md: marketplace: given twice
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
deliver-check: mal (schema devkit-lite, ship merge, host cli, head 3374121)
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
  "oldHead": "33741213bca84be08b697a0246f5e1724b817224",
  "change": "mal",
  "conflicts": [],
  "error": "release.md: marketplace: \"huge\" is not patch, minor or major",
  "mode": "assign"
}
release-merge: release.md: marketplace: "huge" is not patch, minor or major
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
deliver-check: mal (schema devkit-lite, ship merge, host cli, head 187a300)
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
  "oldHead": "187a300da2226e53e43b0da1b0871829ad6cf3d4",
  "change": "mal",
  "conflicts": [],
  "error": "release.md: line 3: \"notes: none\" is not a field of the note",
  "mode": "assign"
}
release-merge: release.md: line 3: "notes: none" is not a field of the note
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
deliver-check: mal (schema devkit-lite, ship merge, host cli, head 0e7bb4d)
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
  "oldHead": "0e7bb4de4a2c1de03134ced2c82ac28e19099247",
  "change": "mal",
  "conflicts": [],
  "error": "release.md: changelog title: missing (a \"## <title>\" line comes after the fields)",
  "mode": "assign"
}
release-merge: release.md: changelog title: missing (a "## <title>" line comes after the fields)
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
deliver-check: mal (schema devkit-lite, ship merge, host cli, head 3755fd6)
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
  "oldHead": "3755fd643a98ea0c21390959c5c6f84af18d7b29",
  "change": "mal",
  "conflicts": [],
  "error": "release.md: changelog body: empty (write what the release changes under the title)",
  "mode": "assign"
}
release-merge: release.md: changelog body: empty (write what the release changes under the title)
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
deliver-check: mal (schema devkit-lite, ship merge, host cli, head c42c5ba)
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
  "oldHead": "c42c5bae6670f83055ad31948f06c2a2bb1cb2c6",
  "change": "mal",
  "conflicts": [],
  "error": "release.md: changelog body: a code fence opened at line 8 is never closed",
  "mode": "assign"
}
release-merge: release.md: changelog body: a code fence opened at line 8 is never closed
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
deliver-check: mal (schema devkit-lite, ship merge, host cli, head beaa5dd)
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
  "oldHead": "beaa5dd78757d0f136832292672bb2d791f63975",
  "change": "mal",
  "conflicts": [],
  "error": "release.md: packs: devkit-x is not a pack of this project",
  "mode": "assign"
}
release-merge: release.md: packs: devkit-x is not a pack of this project
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
deliver-check: mal (schema devkit-lite, ship merge, host cli, head 0bc6e39)
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
  "oldHead": "0bc6e392d1dc2a505ade0016ba0eb91c93907340",
  "change": "mal",
  "conflicts": [],
  "error": "release.md: release: plugins/openspec/.claude-plugin/plugin.json is the manifest of devkit-openspec; state its bump under packs:",
  "mode": "assign"
}
release-merge: release.md: release: plugins/openspec/.claude-plugin/plugin.json is the manifest of devkit-openspec; state its bump under packs:
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
    did: git commit: d6fd1d1
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
deliver-check: mal (schema devkit-lite, ship merge, host cli, head cdbf270)
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
  "oldHead": "cdbf270013b9096832d609a5cb55caad18ab6e3a",
  "change": "mal",
  "conflicts": [],
  "error": "release.md: marketplace: the project has no .claude-plugin/marketplace.json",
  "mode": "assign"
}
release-merge: release.md: marketplace: the project has no .claude-plugin/marketplace.json
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
7db8199 docs(mal): a note that reads

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
    did: wrote evidence.md at 7db8199; git commit: 670a659
$ node $DEV/deliver-check.mjs mal --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at 670a659; git commit: 15d69e6
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
  "oldHead": "d2fc432459f36ebb64d84276bcda8d887598b159",
  "newHead": "a9217279ee1210412cd5e9a143d362f91713e769",
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
   d2fc432..a921727  mal -> mal
[exit 0]
```

```text
(in $CASES/p11/main/.claude/worktrees/mal)
$ node $DEV/deliver-check.mjs mal
deliver-check: mal (schema devkit-lite, ship merge, host cli, head a921727)
  1 met      tasks and gates: all tasks ticked; 1 gate command green in evidence.md
  2 met      reviews at head: 2 reviews at head
  3 met      findings disposed: 0 fixed, 0 refuted
  4 met      acceptance criteria proven: 1 criteria proven
  5 met      PR open at local head: PR #11 open at a921727
  6 met      required checks green: 2 required checks green
  7 met      conversation answered: every thread and request is answered
  8 met      PR body complete: PR body names the change, its criteria and the evidence
8/8 met: ready
next: enable-auto-merge PR #11 with --squash at a921727
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
48f0aecb3c6c01ca86c957dfe6df1672c5c095bf
[exit 0]
```

```text
(in $CASES/p1/main/.claude/worktrees/feat)
$ git fetch origin
From $CASES/p1/origin
   192a0d9..48f0aec  main       -> origin/main
[exit 0]
```

```text
(in $CASES/p1/main/.claude/worktrees/feat)
$ git show '--format=%H %P%n%s' --no-patch origin/main
48f0aecb3c6c01ca86c957dfe6df1672c5c095bf 192a0d94c05748d7884c1a5d4541825f98ae1a25
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
deliver-check: feat (schema devkit, ship merge, host cli, head 5521855)
  1 met      tasks and gates: checked before PR #11 merged
  2 met      reviews at head: checked before PR #11 merged
  3 met      findings disposed: checked before PR #11 merged
  4 met      acceptance criteria proven: checked before PR #11 merged
  5 met      PR open at local head: PR #11 merged
  6 met      required checks green: checked before PR #11 merged
  7 met      conversation answered: checked before PR #11 merged
  8 met      PR body complete: checked before PR #11 merged
8/8 met: merged: archive step tag-release
next: tag-release v1.1.0 at 48f0aec (PR #11)
[exit 0]
```

```text
"next" of deliver-check <id> --json at this head:
{
  "step": "tag-release",
  "reason": "PR #11 merged version 1.1.0 of plugins/openspec/.claude-plugin/plugin.json at 48f0aec, and origin has no tag v1.1.0",
  "tag": "v1.1.0",
  "sha": "48f0aecb3c6c01ca86c957dfe6df1672c5c095bf",
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
$ git tag v1.1.0 48f0aecb3c6c01ca86c957dfe6df1672c5c095bf
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
{"ref":"refs/tags/v1.1.0","object":{"sha":"48f0aecb3c6c01ca86c957dfe6df1672c5c095bf","type":"commit"}}[exit 0]
```

```text
(in $CASES/p1/main/.claude/worktrees/feat)
$ node $DEV/deliver-check.mjs feat
deliver-check: feat (schema devkit, ship merge, host cli, head 5521855)
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
    "head": "fbe0e5e601ac70a63c9f01dc962ae90e5ce7962a",
    "command": [
      "gh",
      "pr",
      "merge",
      "13",
      "--auto",
      "--merge",
      "--match-head-commit",
      "fbe0e5e601ac70a63c9f01dc962ae90e5ce7962a"
    ]
  },
  "reply": null,
  "progressKey": "enable-auto-merge@13"
}
[exit 0]
```

```text
(in $CASES/p2/main)
$ gh pr merge 13 --auto --merge --match-head-commit fbe0e5e601ac70a63c9f01dc962ae90e5ce7962a
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
152478a3bee17315908ce4123aef0fca920d4e91 (also marked merged: #11, #12)
[exit 0]
```

```text
(in $CASES/p2/main)
$ git fetch origin
From $CASES/p2/origin
   d7fd347..152478a  main       -> origin/main
[exit 0]
```

```text
(in $CASES/p2/main)
$ git show '--format=%H %P%n%s' --no-patch origin/main
152478a3bee17315908ce4123aef0fca920d4e91 d7fd347da56402499980cfa33a0c24a9f2fea2e2 fbe0e5e601ac70a63c9f01dc962ae90e5ce7962a
Merge pull request #13 from train/1
[exit 0]
```

```text
(in $CASES/p2/main)
$ gh pr list --state all --json number,headRefName,state,mergeCommit
[{"number":13,"url":"https://github.invalid/o/devkit/pull/13","state":"MERGED","headRefOid":"fbe0e5e601ac70a63c9f01dc962ae90e5ce7962a","baseRefName":"main","headRefName":"train/1","mergeable":"UNKNOWN","body":"<!-- devkit-train n=1 base=main result=passed -->\n# Train 1\n\n- Base: `main` at `d7fd347da56402499980cfa33a0c24a9f2fea2e2`\n- Suite: `true`\n- Ran at: `faf5be0bc3fd71d4d35de413d595fd1f3c0c0884`\n- Result: passed\n\n## Boarded\n\n| Order | Kind | Change | Pull request | Head | Boarded at |\n| --- | --- | --- | --- | --- | --- |\n| 1 | change | `alpha` | #11 | `1bb14d6e97c91e0b73cc12833d33d0000a2d35ce` | 2026-11-26T20:52:05Z |\n| 2 | change | `beta` | #12 | `509164cc0775f44d89a7fe468ea3f78a8da98fd1` | 2026-11-26T20:52:08Z |\n\n## Runs\n\n| Run | Changes | Head | Result |\n| --- | --- | --- | --- |\n| 1 | alpha, beta | `faf5be0bc3fd71d4d35de413d595fd1f3c0c0884` | passed |\n","title":"train 1: alpha, beta","mergedAt":"2026-11-26T20:54:08.186Z","mergeCommit":{"oid":"152478a3bee17315908ce4123aef0fca920d4e91"},"autoMergeRequest":null,"mergeStateStatus":"UNKNOWN"},{"number":12,"url":"https://github.invalid/o/devkit/pull/12","state":"MERGED","headRefOid":"509164cc0775f44d89a7fe468ea3f78a8da98fd1","baseRefName":"main","headRefName":"beta","mergeable":"UNKNOWN","body":"beta\n- AC-1\nopenspec/changes/beta/evidence.md\n","title":"beta","mergedAt":"2026-11-26T20:54:08.186Z","mergeCommit":{"oid":"152478a3bee17315908ce4123aef0fca920d4e91"},"autoMergeRequest":null,"mergeStateStatus":"UNKNOWN"},{"number":11,"url":"https://github.invalid/o/devkit/pull/11","state":"MERGED","headRefOid":"1bb14d6e97c91e0b73cc12833d33d0000a2d35ce","baseRefName":"main","headRefName":"alpha","mergeable":"UNKNOWN","body":"alpha\n- AC-1\nopenspec/changes/alpha/evidence.md\n","title":"alpha","mergedAt":"2026-11-26T20:54:08.186Z","mergeCommit":{"oid":"152478a3bee17315908ce4123aef0fca920d4e91"},"autoMergeRequest":null,"mergeStateStatus":"UNKNOWN"}][exit 0]
```

```text
(in $CASES/p2/main/.claude/worktrees/alpha)
$ node $DEV/deliver-check.mjs alpha
deliver-check: alpha (schema devkit, ship merge, host cli, head 1bb14d6)
  1 met      tasks and gates: checked before PR #11 merged
  2 met      reviews at head: checked before PR #11 merged
  3 met      findings disposed: checked before PR #11 merged
  4 met      acceptance criteria proven: checked before PR #11 merged
  5 met      PR open at local head: PR #11 merged
  6 met      required checks green: checked before PR #11 merged
  7 met      conversation answered: checked before PR #11 merged
  8 met      PR body complete: checked before PR #11 merged
8/8 met: merged: archive step tag-release
next: tag-release v1.2.0 at 152478a (PR #11)
[exit 0]
```

```text
"next" of deliver-check <id> --json at this head:
{
  "step": "tag-release",
  "reason": "PR #11 merged version 1.2.0 of plugins/openspec/.claude-plugin/plugin.json at 152478a, and origin has no tag v1.2.0",
  "tag": "v1.2.0",
  "sha": "152478a3bee17315908ce4123aef0fca920d4e91",
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
$ git tag v1.2.0 152478a3bee17315908ce4123aef0fca920d4e91
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
deliver-check: alpha (schema devkit, ship merge, host cli, head 1bb14d6)
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
deliver-check: beta (schema devkit, ship merge, host cli, head 509164c)
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

## P-13 a merge by hand after a code conflict with a base that released the same pack and took the same ADR number

AC-4, AC-5 (code-quality F1 of review round 1, D-20). Project `p13`: the seed with a source file `src/a.ts`. Change `feat` notes
devkit-openspec `minor` and devkit-core `patch`, names its record `docs/adr/feat.md` (listed in `decisions.md`), cites it
`ADR [feat]` and `adr/feat.md` in `docs/guide.md`, and edits `src/a.ts`. Its sibling `sib` notes devkit-openspec `minor`,
names its record `docs/adr/sib.md` and edits `src/a.ts` too, in the same line. `feat` takes its release first (devkit-openspec 1.1.0,
ADR 0002); then `sib` takes the same numbers on the same base and lands.

### `feat` takes its release

```text
(in $CASES/p13/main/.claude/worktrees/feat)
$ node $DEV/deliver-check.mjs feat --json   -> 1/8, next: implement (phase 1 has unticked tasks: 1.1)
    did: wrote src/feat-1.ts; ticked 1.1
$ node $DEV/deliver-check.mjs feat --json   -> 1/8, next: gate (phase 1 is implemented; run its gate 1.2)
    did: ran `node -e 0` (exit 0); ticked 1.2
$ node $DEV/deliver-check.mjs feat --json   -> 1/8, next: commit (uncommitted changes outside openspec/: src/feat-1.ts)
    did: git commit: 1b895f6
$ node $DEV/deliver-check.mjs feat --json   -> 1/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at 1b895f6; git commit: 90d0793
$ node $DEV/deliver-check.mjs feat --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at 90d0793; git commit: 27f1503
$ node $DEV/deliver-check.mjs feat --json   -> 4/8, next: open-pr (no pull request yet)
    did: git push -u origin feat; gh pr create -> https://github.invalid/o/devkit/pull/11
$ node $DEV/deliver-check.mjs feat --json   -> 8/8, next: assign-release (the release of feat is not assigned yet; assign it before the merge)
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

```text
(in $CASES/p13/main/.claude/worktrees/feat)
$ git fetch origin main
From $CASES/p13/origin
 * branch            main       -> FETCH_HEAD
[exit 0]
```

```text
(in $CASES/p13/main/.claude/worktrees/feat)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": true,
  "oldHead": "506b6a1b293e5591005d7a5158b9fb198ca76fc1",
  "newHead": "37f9271f25a63b17e70f91441326830aefa5d95b",
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
    "docs/guide.md"
  ],
  "mode": "assign"
}
[exit 0]
```

```text
(in $CASES/p13/main/.claude/worktrees/feat)
$ git push origin feat
To $CASES/p13/origin.git
   506b6a1..37f9271  feat -> feat
[exit 0]
```

```text
(in $CASES/p13/main/.claude/worktrees/feat)
$ git log -1 --format=%B
chore(release): assign the release of feat

Release-change: feat
Release-line: plugins/core/.claude-plugin/plugin.json
Release-line: plugins/openspec/.claude-plugin/plugin.json
Release-line: .claude-plugin/marketplace.json
Release-line: CHANGELOG.md
Release-line: docs/openspec-flow.md
Release-adr: docs/adr/feat.md -> docs/adr/0002-feat.md
Release-citation: CHANGELOG.md
Release-citation: docs/guide.md

[exit 0]
```

### The sibling lands with the same pack's next version and the same ADR number, and an edit of `src/a.ts`

```text
(in $CASES/p13/main/.claude/worktrees/sib)
$ node $DEV/deliver-check.mjs sib --json   -> 1/8, next: implement (phase 1 has unticked tasks: 1.1)
    did: wrote src/sib-1.ts; ticked 1.1
$ node $DEV/deliver-check.mjs sib --json   -> 1/8, next: gate (phase 1 is implemented; run its gate 1.2)
    did: ran `node -e 0` (exit 0); ticked 1.2
$ node $DEV/deliver-check.mjs sib --json   -> 1/8, next: commit (uncommitted changes outside openspec/: src/sib-1.ts)
    did: git commit: 088fdac
$ node $DEV/deliver-check.mjs sib --json   -> 1/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at 088fdac; git commit: 8175532
$ node $DEV/deliver-check.mjs sib --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at 8175532; git commit: b6c6715
$ node $DEV/deliver-check.mjs sib --json   -> 4/8, next: open-pr (no pull request yet)
    did: git push -u origin sib; gh pr create -> https://github.invalid/o/devkit/pull/12
$ node $DEV/deliver-check.mjs sib --json   -> 8/8, next: assign-release (the release of sib is not assigned yet; assign it before the merge)
```

```text
(in $CASES/p13/main/.claude/worktrees/sib)
$ git fetch origin main
From $CASES/p13/origin
 * branch            main       -> FETCH_HEAD
[exit 0]
```

```text
(in $CASES/p13/main/.claude/worktrees/sib)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": true,
  "oldHead": "0eb5e89ba8f14cd56317063346684c177adc69a6",
  "newHead": "5deae25396cd24a7ba5c49eca442179ff3da0ff1",
  "versions": {
    "packs": {
      "devkit-openspec": "1.1.0"
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
(in $CASES/p13/main/.claude/worktrees/sib)
$ git push origin sib
To $CASES/p13/origin.git
   0eb5e89..5deae25  sib -> sib
[exit 0]
```

```text
(in $CASES/p13/main/.claude/worktrees/sib)
$ gh pr merge 12 --auto --squash --match-head-commit 5deae25396cd24a7ba5c49eca442179ff3da0ff1
(no output)
[exit 0]
```

```text
(in $CASES/p13/main)
$ gh __merge 12   # the stub: GitHub merges the pull request once its rules pass
88fb804a4d5bafd93ba8bf969d02319b927b5a68
[exit 0]
```

```text
(in $CASES/p13/main)
$ git log --oneline --graph -4 origin/main
* 88fb804 Merge pull request #12 from sib
* 8e68ffe seed: the project at its first release
[exit 0]
```

```text
(in $CASES/p13/main)
$ git show origin/main:src/a.ts origin/main:plugins/openspec/.claude-plugin/plugin.json
export const a = 2; // sib
{
  "name": "devkit-openspec",
  "version": "1.1.0",
  "description": "the devkit-openspec pack"
}
[exit 0]
```

```text
(in $CASES/p13/main)
$ git ls-tree --name-only origin/main docs/adr/
docs/adr/0001-start.md
docs/adr/0002-sib.md
[exit 0]
```

### `feat` again: the step stops on the code conflict

The base moved, so the checker asks for `assign-release` again; the step merges `origin/main`, meets a conflict outside the release lines (`src/a.ts`), exits 2 naming it and leaves the branch as it was:

```text
(in $CASES/p13/main/.claude/worktrees/feat)
$ node $DEV/deliver-check.mjs feat
deliver-check: feat (schema devkit, ship merge, host cli, head 37f9271)
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
  ],
  "conflict": true
}
```

```text
(in $CASES/p13/main/.claude/worktrees/feat)
$ git fetch origin main
From $CASES/p13/origin
 * branch            main       -> FETCH_HEAD
[exit 0]
```

```text
(in $CASES/p13/main/.claude/worktrees/feat)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": false,
  "oldHead": "37f9271f25a63b17e70f91441326830aefa5d95b",
  "change": "feat",
  "conflicts": [
    "CHANGELOG.md",
    "docs/catalog.md",
    "src/a.ts"
  ],
  "mode": "assign"
}
[exit 2]
```

```text
(in $CASES/p13/main/.claude/worktrees/feat)
$ git status --short --branch   # the branch as it was: no merge in progress
## feat...origin/feat
[exit 0]
```

### The merge by hand

The session stops as `blocked: item 5 (src/a.ts)` and, as the `assign-release` row of `ship-change` says for a conflict outside the release lines, merges `origin/main` by hand: it resolves `src/a.ts`, takes the base's side of every release line, and commits.

```text
(in $CASES/p13/main/.claude/worktrees/feat)
$ git merge --no-ff --no-commit origin/main
Auto-merging .claude-plugin/marketplace.json
Auto-merging CHANGELOG.md
CONFLICT (content): Merge conflict in CHANGELOG.md
Auto-merging docs/catalog.md
CONFLICT (content): Merge conflict in docs/catalog.md
Auto-merging src/a.ts
CONFLICT (content): Merge conflict in src/a.ts
Automatic merge failed; fix conflicts and then commit the result.
[exit 1]
```

```text
(in $CASES/p13/main/.claude/worktrees/feat)
$ git diff --name-only --diff-filter=U   # the files in conflict
CHANGELOG.md
docs/catalog.md
src/a.ts
[exit 0]
```

```text
(in $CASES/p13/main/.claude/worktrees/feat)
$ git checkout origin/main -- plugins/openspec/.claude-plugin/plugin.json plugins/core/.claude-plugin/plugin.json .claude-plugin/marketplace.json CHANGELOG.md docs/catalog.md docs/openspec-flow.md
(no output)
[exit 0]
```

```text
(in $CASES/p13/main/.claude/worktrees/feat)
$ git add -A
(no output)
[exit 0]
```

```text
(in $CASES/p13/main/.claude/worktrees/feat)
$ git commit -q --no-edit
(no output)
[exit 0]
```

```text
(in $CASES/p13/main/.claude/worktrees/feat)
$ git log --oneline --graph -4
*   f6cb9e3 Merge remote-tracking branch 'origin/main' into feat
|\  
| * 88fb804 Merge pull request #12 from sib
* | 37f9271 chore(release): assign the release of feat
* | 506b6a1 docs(feat): change files
[exit 0]
```

```text
(in $CASES/p13/main/.claude/worktrees/feat)
$ git show --stat '--format=%h %s%n%P' HEAD
f6cb9e3 Merge remote-tracking branch 'origin/main' into feat
37f9271f25a63b17e70f91441326830aefa5d95b 88fb804a4d5bafd93ba8bf969d02319b927b5a68

 .claude-plugin/marketplace.json                        |  2 +-
 CHANGELOG.md                                           |  5 ++---
 docs/adr/0002-sib.md                                   |  6 ++++++
 docs/catalog.md                                        |  2 +-
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
 plugins/core/.claude-plugin/plugin.json                |  2 +-
 src/a.ts                                               |  2 +-
 src/sib-1.ts                                           |  1 +
 18 files changed, 77 insertions(+), 7 deletions(-)
[exit 0]
```

```text
(in $CASES/p13/main/.claude/worktrees/feat)
$ cat src/a.ts plugins/openspec/.claude-plugin/plugin.json
export const a = 3; // feat and sib
{
  "name": "devkit-openspec",
  "version": "1.1.0",
  "description": "the devkit-openspec pack"
}
[exit 0]
```

```text
(in $CASES/p13/main/.claude/worktrees/feat)
$ ls docs/adr   # both records numbered 0002: feat's number came with the branch, sib's with the base
0001-start.md
0002-feat.md
0002-sib.md
[exit 0]
```

### The loop answers `assign-release`, and the step numbers the branch again

The merge by hand changed `src/a.ts`, a file of the change, so the session records the evidence and the reviews again (ADR 0025). The release lines are then the base's and the number the step wrote (ADR 0002 for `feat`) is in its own record, so the checker reads the release as unassigned and hands `assign-release` again (the pull request's head on origin is still the one before the merge by hand), not `blocked`:

```text
(in $CASES/p13/main/.claude/worktrees/feat)
$ node $DEV/deliver-check.mjs feat --json   -> 4/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at f6cb9e3; git commit: 68599a0
$ node $DEV/deliver-check.mjs feat --json   -> 6/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at 68599a0; git commit: e8eb179
$ node $DEV/deliver-check.mjs feat --json   -> 7/8, next: assign-release (PR #11 has merge conflicts with main)
```

```text
(in $CASES/p13/main/.claude/worktrees/feat)
$ node $DEV/deliver-check.mjs feat
deliver-check: feat (schema devkit, ship merge, host cli, head e8eb179)
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
  ],
  "conflict": true
}
```

```text
(in $CASES/p13/main/.claude/worktrees/feat)
$ git fetch origin main
From $CASES/p13/origin
 * branch            main       -> FETCH_HEAD
[exit 0]
```

```text
(in $CASES/p13/main/.claude/worktrees/feat)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": true,
  "oldHead": "e8eb17996a5b5d7e21bac16d160f3745d4e1c7d1",
  "newHead": "c122315cfd31f38c21fe0223b99803a3b9b27f15",
  "versions": {
    "packs": {
      "devkit-openspec": "1.2.0",
      "devkit-core": "1.0.1"
    },
    "metadata": "1.2.0"
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
      "to": "docs/adr/0003-feat.md"
    }
  ],
  "citations": [
    "CHANGELOG.md",
    "docs/guide.md"
  ],
  "mode": "assign"
}
[exit 0]
```

```text
(in $CASES/p13/main/.claude/worktrees/feat)
$ git push origin feat
To $CASES/p13/origin.git
   37f9271..c122315  feat -> feat
[exit 0]
```

One plain commit on that head: it gives back the number it wrote before (0002), numbers the record above the sibling's (0003), writes devkit-openspec 1.2.0 above the base's 1.1.0 and devkit-core 1.0.1, and its message ends with its new record:

```text
(in $CASES/p13/main/.claude/worktrees/feat)
$ git log -1 --format=%B
chore(release): assign the release of feat

Release-change: feat
Release-line: plugins/core/.claude-plugin/plugin.json
Release-line: plugins/openspec/.claude-plugin/plugin.json
Release-line: .claude-plugin/marketplace.json
Release-line: CHANGELOG.md
Release-line: docs/openspec-flow.md
Release-adr: docs/adr/feat.md -> docs/adr/0003-feat.md
Release-citation: CHANGELOG.md
Release-citation: docs/guide.md

[exit 0]
```

```text
(in $CASES/p13/main/.claude/worktrees/feat)
$ git show --stat -M '--format=%h %s' HEAD
c122315 chore(release): assign the release of feat

 .claude-plugin/marketplace.json             | 6 +++---
 CHANGELOG.md                                | 5 +++++
 docs/adr/{0002-feat.md => 0003-feat.md}     | 2 +-
 docs/catalog.md                             | 4 ++--
 docs/guide.md                               | 2 +-
 docs/openspec-flow.md                       | 6 +++---
 plugins/core/.claude-plugin/plugin.json     | 2 +-
 plugins/openspec/.claude-plugin/plugin.json | 2 +-
 8 files changed, 17 insertions(+), 12 deletions(-)
[exit 0]
```

```text
(in $CASES/p13/main/.claude/worktrees/feat)
$ git diff --name-only HEAD^ HEAD -- openspec/changes/   # empty
(no output)
[exit 0]
```

```text
(in $CASES/p13/main/.claude/worktrees/feat)
$ cat plugins/openspec/.claude-plugin/plugin.json plugins/core/.claude-plugin/plugin.json .claude-plugin/marketplace.json CHANGELOG.md docs/catalog.md src/a.ts
{
  "name": "devkit-openspec",
  "version": "1.2.0",
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
      "version": "1.0.1"
    }
  ]
}
# Changelog

## 1.2.0 — the feature lands

- **devkit-openspec** 1.2.0: the flow does the feature (ADR 0003)
- **devkit-core** 1.0.1: the agents follow it

## 1.1.0 — sib lands

- **devkit-openspec** 1.1.0: sib does its part

## 1.0.0 — first release

- **devkit-openspec** 1.0.0: the flow
- **devkit-core** 1.0.0: the agents
# Catalog

| Pack | Version |
|---|---|
| devkit-core | 1.0.1 |
| devkit-openspec | 1.2.0 |
export const a = 3; // feat and sib
[exit 0]
```

```text
(in $CASES/p13/main/.claude/worktrees/feat)
$ grep -n 'ADR\|v1\.' docs/guide.md docs/sib.md docs/openspec-flow.md
docs/guide.md:6:A line two. The rule is ADR 0003, recorded in adr/0003-feat.md.
docs/sib.md:3:The fix is ADR 0002.
docs/openspec-flow.md:15:          # pinned to the commit of v1.2.0 (a tag can move; a commit cannot)
docs/openspec-flow.md:16:          base=https://raw.githubusercontent.com/o/devkit/<commit sha of v1.2.0>/plugins/openspec/hooks
docs/openspec-flow.md:22:Pin the commit sha of the release tag (`v1.2.0` above), not the tag; by hand, run `gh api repos/o/devkit/git/ref/tags/v1.2.0`.
[exit 0]
```

```text
(in $CASES/p13/main/.claude/worktrees/feat)
$ ls docs/adr
0001-start.md
0002-sib.md
0003-feat.md
[exit 0]
```

The state reads assigned and current, and `enable-auto-merge` is next:

```text
(in $CASES/p13/main/.claude/worktrees/feat)
$ node -e "import('$DEV/deliver-check.mjs').then((D) => console.log(D.releaseState(process.cwd(), 'feat', D.gitFacts(process.cwd(), { base: 'main' }))))"   # kind, current, paths, reassign, adrs
{
  "kind": "assigned",
  "current": true,
  "paths": [],
  "reassign": [],
  "adrs": [
    {
      "slug": "feat",
      "folder": "docs/adr",
      "from": "docs/adr/feat.md",
      "to": "docs/adr/0003-feat.md",
      "number": "0003"
    }
  ]
}
[exit 0]
```

```text
(in $CASES/p13/main/.claude/worktrees/feat)
$ node $DEV/deliver-check.mjs feat
deliver-check: feat (schema devkit, ship merge, host cli, head c122315)
  1 met      tasks and gates: all tasks ticked; 1 gate command green in evidence.md
  2 met      reviews at head: 2 reviews at head
  3 met      findings disposed: 0 fixed, 0 refuted
  4 met      acceptance criteria proven: 1 criteria proven
  5 met      PR open at local head: PR #11 open at c122315
  6 met      required checks green: 2 required checks green
  7 met      conversation answered: every thread and request is answered
  8 met      PR body complete: PR body names the change, its criteria and the evidence
8/8 met: ready
next: enable-auto-merge PR #11 with --squash at c122315
[exit 0]
```

```text
"next" of deliver-check <id> --json at this head:
{
  "step": "enable-auto-merge",
  "reason": "all eight items are met",
  "number": 11,
  "method": "squash",
  "head": "c122315cfd31f38c21fe0223b99803a3b9b27f15"
}
```

## P-14 the loop routes a noted change's conflict with the base: release files only, outside them, behind, and a one-line list

AC-4, AC-5, AC-15 (review round 3, D-31, D-36). Each variant is a merge-mode project with the key, where `feat` is a noted change
assigned once (devkit-openspec 1.1.0, devkit-core 1.0.1, ADR 0002) and the base then moves. From there each step is the one this
worktree's `change-loop.mjs next` hands, run in `feat`'s worktree: it fetches the base, reads the delivery checker and the
conductor's override, and prints the action; the session runs it as its `ship-change` row says (the implementer's merge is
scripted here, and S-13 of `agents-run.md` runs the real implementer on (b) and (d)).

### (a) The base releases, in conflict with the branch in the release files only

`feat` is driven to its release step and takes its release (devkit-openspec 1.1.0, devkit-core 1.0.1, ADR 0002):

```text
(in $CASES/p14a/main/.claude/worktrees/feat)
$ node $DEV/deliver-check.mjs feat --json   -> 1/8, next: implement (phase 1 has unticked tasks: 1.1)
    did: wrote src/feat-1.ts; ticked 1.1
$ node $DEV/deliver-check.mjs feat --json   -> 1/8, next: gate (phase 1 is implemented; run its gate 1.2)
    did: ran `node -e 0` (exit 0); ticked 1.2
$ node $DEV/deliver-check.mjs feat --json   -> 1/8, next: commit (uncommitted changes outside openspec/: src/feat-1.ts)
    did: git commit: 068b225
$ node $DEV/deliver-check.mjs feat --json   -> 1/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at 068b225; git commit: 4ffb9a8
$ node $DEV/deliver-check.mjs feat --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at 4ffb9a8; git commit: f4a5213
$ node $DEV/deliver-check.mjs feat --json   -> 4/8, next: open-pr (no pull request yet)
    did: git push -u origin feat; gh pr create -> https://github.invalid/o/devkit/pull/11
$ node $DEV/deliver-check.mjs feat --json   -> 8/8, next: assign-release (the release of feat is not assigned yet; assign it before the merge)
```

```text
(in $CASES/p14a/main/.claude/worktrees/feat)
$ git fetch origin main
From $CASES/p14a/origin
 * branch            main       -> FETCH_HEAD
[exit 0]
```

```text
(in $CASES/p14a/main/.claude/worktrees/feat)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": true,
  "oldHead": "946eba5886e3859027136a628dbd23449ab100f5",
  "newHead": "a5bad46cfe3ab58c99afdf90ed7a0ada514ce5d1",
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
    "CHANGELOG.md"
  ],
  "mode": "assign"
}
[exit 0]
```

```text
(in $CASES/p14a/main/.claude/worktrees/feat)
$ git push origin feat
To $CASES/p14a/origin.git
   946eba5..a5bad46  feat -> feat
[exit 0]
```

The sibling `sib` notes devkit-openspec `minor`, names `docs/adr/sib.md` and writes `docs/sib.md`; it takes devkit-openspec 1.1.0 and ADR 0002 on the same base and lands:

```text
(in $CASES/p14a/main/.claude/worktrees/sib)
$ node $DEV/deliver-check.mjs sib --json   -> 1/8, next: implement (phase 1 has unticked tasks: 1.1)
    did: wrote src/sib-1.ts; ticked 1.1
$ node $DEV/deliver-check.mjs sib --json   -> 1/8, next: gate (phase 1 is implemented; run its gate 1.2)
    did: ran `node -e 0` (exit 0); ticked 1.2
$ node $DEV/deliver-check.mjs sib --json   -> 1/8, next: commit (uncommitted changes outside openspec/: src/sib-1.ts)
    did: git commit: 8524237
$ node $DEV/deliver-check.mjs sib --json   -> 1/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at 8524237; git commit: 2163379
$ node $DEV/deliver-check.mjs sib --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at 2163379; git commit: ac16204
$ node $DEV/deliver-check.mjs sib --json   -> 4/8, next: open-pr (no pull request yet)
    did: git push -u origin sib; gh pr create -> https://github.invalid/o/devkit/pull/12
$ node $DEV/deliver-check.mjs sib --json   -> 8/8, next: assign-release (the release of sib is not assigned yet; assign it before the merge)
```

```text
(in $CASES/p14a/main/.claude/worktrees/sib)
$ git fetch origin main
From $CASES/p14a/origin
 * branch            main       -> FETCH_HEAD
[exit 0]
```

```text
(in $CASES/p14a/main/.claude/worktrees/sib)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": true,
  "oldHead": "c6ade44c05392564809d605ca151b8c88ab3fcb8",
  "newHead": "9e1fc05a38a68614ed234ce73a2d435522cd330e",
  "versions": {
    "packs": {
      "devkit-openspec": "1.1.0"
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
(in $CASES/p14a/main/.claude/worktrees/sib)
$ git push origin sib
To $CASES/p14a/origin.git
   c6ade44..9e1fc05  sib -> sib
[exit 0]
```

```text
(in $CASES/p14a/main/.claude/worktrees/sib)
$ gh pr merge 12 --auto --squash --match-head-commit 9e1fc05a38a68614ed234ce73a2d435522cd330e
(no output)
[exit 0]
```

```text
(in $CASES/p14a/main)
$ gh __merge 12   # the stub: GitHub merges the pull request once its rules pass
d42dc709b7789dcf8f79df6e98c7dd9d7b47b51e
[exit 0]
```

```text
(in $CASES/p14a/main)
$ git log --oneline --graph -4 origin/main
* d42dc70 Merge pull request #12 from sib
* 06f51b1 seed: the project at its first release
[exit 0]
```

The pull request of `feat` now conflicts with `main` in release files only; the step's masked merge resolves them, so the loop hands `assign-release` (with `conflict: true`) to the session:

```text
(in $CASES/p14a/main/.claude/worktrees/feat)
$ node $DEV/change-loop.mjs next --change feat --lang en
devkit-run: feat
{
  "version": 1,
  "change": "feat",
  "script": "devkit-lite",
  "root": "$CASES/p14a/main/.claude/worktrees/feat",
  "branch": "feat",
  "filesLanguage": "en",
  "kind": "session",
  "stage": "delivery",
  "stageTitle": "Delivery",
  "role": "commit-and-pr",
  "skills": [
    "commit-message-guidelines"
  ],
  "model": "haiku",
  "step": "assign-release",
  "detail": {
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
    ],
    "conflict": true
  },
  "progressKey": "delivery/assign-release@a112eebd434e",
  "baseFetch": {
    "ok": true,
    "base": "main"
  },
  "icon": "🚀",
  "state": {
    "state": "running",
    "reason": null,
    "stage": "delivery",
    "stageTitle": "Delivery",
    "phase": null,
    "stageIcon": "🚀",
    "stateIcon": null,
    "title": "🚀 feat"
  },
  "sessionTitle": "🚀 feat"
}
[exit 0]
```

```text
(in $CASES/p14a/main/.claude/worktrees/feat)
$ git fetch origin main
From $CASES/p14a/origin
 * branch            main       -> FETCH_HEAD
[exit 0]
```

```text
(in $CASES/p14a/main/.claude/worktrees/feat)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": true,
  "oldHead": "a5bad46cfe3ab58c99afdf90ed7a0ada514ce5d1",
  "newHead": "8825c0e0e05487048581906acd00d5ca809d6bcb",
  "versions": {
    "packs": {
      "devkit-openspec": "1.2.0",
      "devkit-core": "1.0.1"
    },
    "metadata": "1.2.0"
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
    "CHANGELOG.md"
  ],
  "mode": "assign"
}
[exit 0]
```

```text
(in $CASES/p14a/main/.claude/worktrees/feat)
$ git push origin feat
To $CASES/p14a/origin.git
   a5bad46..8825c0e  feat -> feat
[exit 0]
```

The step exited 0 and the session pushed; the loop then hands `enable-auto-merge`:

```text
(in $CASES/p14a/main/.claude/worktrees/feat)
$ node $DEV/change-loop.mjs next --change feat --lang en
devkit-run: feat
{
  "version": 1,
  "change": "feat",
  "script": "devkit-lite",
  "root": "$CASES/p14a/main/.claude/worktrees/feat",
  "branch": "feat",
  "filesLanguage": "en",
  "kind": "session",
  "stage": "evidence",
  "stageTitle": "Demonstration",
  "role": "pr-verifier",
  "skills": [],
  "model": "sonnet",
  "step": "merge-check",
  "detail": {
    "command": [
      "node",
      "$DEV/change-loop.mjs",
      "merge-check",
      "feat",
      "--lang",
      "en"
    ],
    "merge": "8825c0e0e05487048581906acd00d5ca809d6bcb",
    "base": "main"
  },
  "progressKey": "evidence/merge-check@0530f7e0bdde",
  "baseFetch": {
    "ok": true,
    "base": "main"
  },
  "icon": "🔍",
  "state": {
    "state": "running",
    "reason": null,
    "stage": "evidence",
    "stageTitle": "Demonstration",
    "phase": null,
    "stageIcon": "🔍",
    "stateIcon": null,
    "title": "🔍 feat"
  },
  "sessionTitle": "🔍 feat"
}
[exit 0]
```

```text
(in $CASES/p14a/main/.claude/worktrees/feat)
$ node $DEV/change-loop.mjs merge-check feat --lang en
{
  "version": 1,
  "change": "feat",
  "base": "main",
  "merge": "8825c0e0e05487048581906acd00d5ca809d6bcb",
  "result": "green",
  "reds": 0,
  "errors": null,
  "error": null
}
[exit 0]
```

```text
(in $CASES/p14a/main/.claude/worktrees/feat)
$ node $DEV/change-loop.mjs next --change feat --lang en
devkit-run: feat
{
  "version": 1,
  "change": "feat",
  "script": "devkit-lite",
  "root": "$CASES/p14a/main/.claude/worktrees/feat",
  "branch": "feat",
  "filesLanguage": "en",
  "kind": "session",
  "stage": "delivery",
  "stageTitle": "Delivery",
  "role": "commit-and-pr",
  "skills": [
    "commit-message-guidelines"
  ],
  "model": "haiku",
  "step": "enable-auto-merge",
  "detail": {
    "step": "enable-auto-merge",
    "reason": "all eight items are met",
    "number": 11,
    "method": "squash",
    "head": "8825c0e0e05487048581906acd00d5ca809d6bcb"
  },
  "progressKey": "delivery/enable-auto-merge@0530f7e0bdde",
  "baseFetch": {
    "ok": true,
    "base": "main"
  },
  "icon": "🚀",
  "state": {
    "state": "running",
    "reason": null,
    "stage": "delivery",
    "stageTitle": "Delivery",
    "phase": null,
    "stageIcon": "🚀",
    "stateIcon": null,
    "title": "🚀 feat"
  },
  "sessionTitle": "🚀 feat"
}
[exit 0]
```

### (b) The base releases and edits `src/a.ts`, which the branch edits too

`feat` is driven to its release step and takes its release (devkit-openspec 1.1.0, devkit-core 1.0.1, ADR 0002):

```text
(in $CASES/p14b/main/.claude/worktrees/feat)
$ node $DEV/deliver-check.mjs feat --json   -> 1/8, next: implement (phase 1 has unticked tasks: 1.1)
    did: wrote src/feat-1.ts; ticked 1.1
$ node $DEV/deliver-check.mjs feat --json   -> 1/8, next: gate (phase 1 is implemented; run its gate 1.2)
    did: ran `node -e 0` (exit 0); ticked 1.2
$ node $DEV/deliver-check.mjs feat --json   -> 1/8, next: commit (uncommitted changes outside openspec/: src/feat-1.ts)
    did: git commit: 59e0e68
$ node $DEV/deliver-check.mjs feat --json   -> 1/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at 59e0e68; git commit: 03898af
$ node $DEV/deliver-check.mjs feat --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at 03898af; git commit: fe796a1
$ node $DEV/deliver-check.mjs feat --json   -> 4/8, next: open-pr (no pull request yet)
    did: git push -u origin feat; gh pr create -> https://github.invalid/o/devkit/pull/11
$ node $DEV/deliver-check.mjs feat --json   -> 8/8, next: assign-release (the release of feat is not assigned yet; assign it before the merge)
```

```text
(in $CASES/p14b/main/.claude/worktrees/feat)
$ git fetch origin main
From $CASES/p14b/origin
 * branch            main       -> FETCH_HEAD
[exit 0]
```

```text
(in $CASES/p14b/main/.claude/worktrees/feat)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": true,
  "oldHead": "9e3516bc38dce793df3681fbf3bcd1c1c888c7c6",
  "newHead": "397d32dcdda910f9896f91ddc27f17cd71382bee",
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
    "CHANGELOG.md"
  ],
  "mode": "assign"
}
[exit 0]
```

```text
(in $CASES/p14b/main/.claude/worktrees/feat)
$ git push origin feat
To $CASES/p14b/origin.git
   9e3516b..397d32d  feat -> feat
[exit 0]
```

The sibling `sib` notes devkit-openspec `minor`, names `docs/adr/sib.md` and writes `docs/sib.md`, `src/a.ts`; it takes devkit-openspec 1.1.0 and ADR 0002 on the same base and lands:

```text
(in $CASES/p14b/main/.claude/worktrees/sib)
$ node $DEV/deliver-check.mjs sib --json   -> 1/8, next: implement (phase 1 has unticked tasks: 1.1)
    did: wrote src/sib-1.ts; ticked 1.1
$ node $DEV/deliver-check.mjs sib --json   -> 1/8, next: gate (phase 1 is implemented; run its gate 1.2)
    did: ran `node -e 0` (exit 0); ticked 1.2
$ node $DEV/deliver-check.mjs sib --json   -> 1/8, next: commit (uncommitted changes outside openspec/: src/sib-1.ts)
    did: git commit: 5ce5b42
$ node $DEV/deliver-check.mjs sib --json   -> 1/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at 5ce5b42; git commit: 69fdba7
$ node $DEV/deliver-check.mjs sib --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at 69fdba7; git commit: 6d29152
$ node $DEV/deliver-check.mjs sib --json   -> 4/8, next: open-pr (no pull request yet)
    did: git push -u origin sib; gh pr create -> https://github.invalid/o/devkit/pull/12
$ node $DEV/deliver-check.mjs sib --json   -> 8/8, next: assign-release (the release of sib is not assigned yet; assign it before the merge)
```

```text
(in $CASES/p14b/main/.claude/worktrees/sib)
$ git fetch origin main
From $CASES/p14b/origin
 * branch            main       -> FETCH_HEAD
[exit 0]
```

```text
(in $CASES/p14b/main/.claude/worktrees/sib)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": true,
  "oldHead": "ed5c280b15d41b75ab425cceb82f16df275f2b95",
  "newHead": "e7eae854a37259da8d7bbcfe3a82b3030e42b4ea",
  "versions": {
    "packs": {
      "devkit-openspec": "1.1.0"
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
(in $CASES/p14b/main/.claude/worktrees/sib)
$ git push origin sib
To $CASES/p14b/origin.git
   ed5c280..e7eae85  sib -> sib
[exit 0]
```

```text
(in $CASES/p14b/main/.claude/worktrees/sib)
$ gh pr merge 12 --auto --squash --match-head-commit e7eae854a37259da8d7bbcfe3a82b3030e42b4ea
(no output)
[exit 0]
```

```text
(in $CASES/p14b/main)
$ gh __merge 12   # the stub: GitHub merges the pull request once its rules pass
1c9dcd8cce200f23cccfca9a4360419a97a94078
[exit 0]
```

```text
(in $CASES/p14b/main)
$ git log --oneline --graph -4 origin/main
* 1c9dcd8 Merge pull request #12 from sib
* 534a679 seed: the project at its first release
[exit 0]
```

The conflict lies outside the release lines (`src/a.ts`), which the step's masked merge does not resolve, so the loop hands `resolve-base-conflict` to the implementer, with `noted: true`:

```text
(in $CASES/p14b/main/.claude/worktrees/feat)
$ node $DEV/change-loop.mjs next --change feat --lang en
devkit-run: feat
{
  "version": 1,
  "change": "feat",
  "script": "devkit-lite",
  "root": "$CASES/p14b/main/.claude/worktrees/feat",
  "branch": "feat",
  "filesLanguage": "en",
  "kind": "agent",
  "stage": "implementation",
  "stageTitle": "Implementation",
  "role": "tdd-implementer",
  "skills": [
    "test-driven-development",
    "systematic-debugging"
  ],
  "model": "sonnet",
  "agent": "devkit-core:tdd-implementer",
  "step": "resolve-base-conflict",
  "detail": {
    "step": "resolve-base-conflict",
    "reason": "the PR conflicts with main outside the release lines the release step writes: src/a.ts",
    "number": 11,
    "paths": [
      "CHANGELOG.md",
      "docs/catalog.md",
      "src/a.ts"
    ],
    "others": [
      "src/a.ts"
    ],
    "base": "main",
    "archive": false,
    "noted": true
  },
  "brief": "Change feat (devkit-lite script), stage implementation: step resolve-base-conflict {\"step\":\"resolve-base-conflict\",\"reason\":\"the PR conflicts with main outside the release lines the release step writes: src/a.ts\",\"number\":11,\"paths\":[\"CHANGELOG.md\",\"docs/catalog.md\",\"src/a.ts\"],\"others\":[\"src/a.ts\"],\"base\":\"main\",\"archive\":false,\"noted\":true}. Work only in $CASES/p14b/main/.claude/worktrees/feat on branch feat; every file path is absolute under it; start every Bash command with cd $CASES/p14b/main/.claude/worktrees/feat && ; do not fetch. Write the change's files in English.",
  "progressKey": "implementation/resolve-base-conflict@0919c9d3cf7a",
  "baseFetch": {
    "ok": true,
    "base": "main"
  },
  "icon": "🛠️",
  "state": {
    "state": "running",
    "reason": null,
    "stage": "implementation",
    "stageTitle": "Implementation",
    "phase": null,
    "stageIcon": "🛠️",
    "stateIcon": null,
    "title": "🛠️ feat"
  },
  "sessionTitle": "🛠️ feat"
}
[exit 0]
```

The merge the row says (scripted): `src/a.ts` resolved, the base's side of every release line taken, committed, not pushed:

```text
(in $CASES/p14b/main/.claude/worktrees/feat)
$ git merge --no-ff --no-commit origin/main
Auto-merging .claude-plugin/marketplace.json
Auto-merging CHANGELOG.md
CONFLICT (content): Merge conflict in CHANGELOG.md
Auto-merging docs/catalog.md
CONFLICT (content): Merge conflict in docs/catalog.md
Auto-merging src/a.ts
CONFLICT (content): Merge conflict in src/a.ts
Automatic merge failed; fix conflicts and then commit the result.
[exit 1]
```

```text
(in $CASES/p14b/main/.claude/worktrees/feat)
$ git diff --name-only --diff-filter=U   # the files in conflict
CHANGELOG.md
docs/catalog.md
src/a.ts
[exit 0]
```

```text
(in $CASES/p14b/main/.claude/worktrees/feat)
$ git checkout origin/main -- plugins/openspec/.claude-plugin/plugin.json plugins/core/.claude-plugin/plugin.json .claude-plugin/marketplace.json CHANGELOG.md docs/catalog.md docs/openspec-flow.md
(no output)
[exit 0]
```

```text
(in $CASES/p14b/main/.claude/worktrees/feat)
$ git add -A
(no output)
[exit 0]
```

```text
(in $CASES/p14b/main/.claude/worktrees/feat)
$ git commit -q --no-edit
(no output)
[exit 0]
```

```text
(in $CASES/p14b/main/.claude/worktrees/feat)
$ git show --stat '--format=%h %s%n%P' HEAD
5f2cbcb Merge remote-tracking branch 'origin/main' into feat
397d32dcdda910f9896f91ddc27f17cd71382bee 1c9dcd8cce200f23cccfca9a4360419a97a94078

 .claude-plugin/marketplace.json                        |  2 +-
 CHANGELOG.md                                           |  5 ++---
 docs/adr/0002-sib.md                                   |  6 ++++++
 docs/catalog.md                                        |  2 +-
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
 plugins/core/.claude-plugin/plugin.json                |  2 +-
 src/a.ts                                               |  2 +-
 src/sib-1.ts                                           |  1 +
 18 files changed, 77 insertions(+), 7 deletions(-)
[exit 0]
```

The merge changed files of the change, so the session records the evidence and the reviews again (ADR 0025), with no push:

```text
(in $CASES/p14b/main/.claude/worktrees/feat)
$ node $DEV/deliver-check.mjs feat --json   -> 4/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at 5f2cbcb; git commit: 943d31d
$ node $DEV/deliver-check.mjs feat --json   -> 6/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at 943d31d; git commit: d341cda
$ node $DEV/deliver-check.mjs feat --json   -> 7/8, next: assign-release (PR #11 has merge conflicts with main)
```

The loop checks the merge of the base (`merge-check`, run as handed); GitHub still reports the pull request in conflict at the old head (397d32d), so the loop then hands the plain push to `devkit-core:commit-and-pr` (run here as its command):

```text
(in $CASES/p14b/main/.claude/worktrees/feat)
$ node $DEV/change-loop.mjs next --change feat --lang en
devkit-run: feat
{
  "version": 1,
  "change": "feat",
  "script": "devkit-lite",
  "root": "$CASES/p14b/main/.claude/worktrees/feat",
  "branch": "feat",
  "filesLanguage": "en",
  "kind": "session",
  "stage": "evidence",
  "stageTitle": "Demonstration",
  "role": "pr-verifier",
  "skills": [],
  "model": "sonnet",
  "step": "merge-check",
  "detail": {
    "command": [
      "node",
      "$DEV/change-loop.mjs",
      "merge-check",
      "feat",
      "--lang",
      "en"
    ],
    "merge": "5f2cbcb19eaf248ed1d98c8dae8675072e556c47",
    "base": "main"
  },
  "progressKey": "evidence/merge-check@2e5faa17a947",
  "baseFetch": {
    "ok": true,
    "base": "main"
  },
  "icon": "🔍",
  "state": {
    "state": "running",
    "reason": null,
    "stage": "evidence",
    "stageTitle": "Demonstration",
    "phase": null,
    "stageIcon": "🔍",
    "stateIcon": null,
    "title": "🔍 feat"
  },
  "sessionTitle": "🔍 feat"
}
[exit 0]
```

```text
(in $CASES/p14b/main/.claude/worktrees/feat)
$ node $DEV/change-loop.mjs merge-check feat --lang en
{
  "version": 1,
  "change": "feat",
  "base": "main",
  "merge": "5f2cbcb19eaf248ed1d98c8dae8675072e556c47",
  "result": "green",
  "reds": 0,
  "errors": null,
  "error": null
}
[exit 0]
```

```text
(in $CASES/p14b/main/.claude/worktrees/feat)
$ node $DEV/change-loop.mjs next --change feat --lang en
devkit-run: feat
{
  "version": 1,
  "change": "feat",
  "script": "devkit-lite",
  "root": "$CASES/p14b/main/.claude/worktrees/feat",
  "branch": "feat",
  "filesLanguage": "en",
  "kind": "agent",
  "stage": "delivery",
  "stageTitle": "Delivery",
  "role": "commit-and-pr",
  "skills": [
    "commit-message-guidelines"
  ],
  "model": "haiku",
  "agent": "devkit-core:commit-and-pr",
  "step": "push",
  "detail": {
    "step": "push",
    "reason": "the merge of origin/main is not pushed yet; PR #11 still has 397d32d",
    "number": 11,
    "branch": "feat",
    "command": [
      "git",
      "push",
      "origin",
      "feat"
    ]
  },
  "brief": "Change feat (devkit-lite script), stage delivery: step push {\"step\":\"push\",\"reason\":\"the merge of origin/main is not pushed yet; PR #11 still has 397d32d\",\"number\":11,\"branch\":\"feat\",\"command\":[\"git\",\"push\",\"origin\",\"feat\"]}. Work only in $CASES/p14b/main/.claude/worktrees/feat on branch feat; every file path is absolute under it; start every Bash command with cd $CASES/p14b/main/.claude/worktrees/feat && ; do not fetch. Write the change's files in English. Attribution: the session handing this off appends below this brief, verbatim, the lines it ends its own commit messages and pull-request descriptions with, as the block `Attribution (from the caller):` with one `Commit trailer: <line>` per commit line and one `PR footer: <line>` per pull-request line, or the line `Attribution (from the caller): none` when it ends them with none.",
  "progressKey": "delivery/push@2e5faa17a947",
  "baseFetch": {
    "ok": true,
    "base": "main"
  },
  "icon": "🚀",
  "state": {
    "state": "running",
    "reason": null,
    "stage": "delivery",
    "stageTitle": "Delivery",
    "phase": null,
    "stageIcon": "🚀",
    "stateIcon": null,
    "title": "🚀 feat"
  },
  "sessionTitle": "🚀 feat"
}
[exit 0]
```

```text
(in $CASES/p14b/main/.claude/worktrees/feat)
$ git push origin feat
To $CASES/p14b/origin.git
   397d32d..d341cda  feat -> feat
[exit 0]
```

After the push the release state is not current (the merge base moved), so the loop hands `assign-release`; the session runs its row:

```text
(in $CASES/p14b/main/.claude/worktrees/feat)
$ node $DEV/change-loop.mjs next --change feat --lang en
devkit-run: feat
{
  "version": 1,
  "change": "feat",
  "script": "devkit-lite",
  "root": "$CASES/p14b/main/.claude/worktrees/feat",
  "branch": "feat",
  "filesLanguage": "en",
  "kind": "session",
  "stage": "delivery",
  "stageTitle": "Delivery",
  "role": "commit-and-pr",
  "skills": [
    "commit-message-guidelines"
  ],
  "model": "haiku",
  "step": "assign-release",
  "detail": {
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
  },
  "progressKey": "delivery/assign-release@2e5faa17a947",
  "baseFetch": {
    "ok": true,
    "base": "main"
  },
  "icon": "🚀",
  "state": {
    "state": "running",
    "reason": null,
    "stage": "delivery",
    "stageTitle": "Delivery",
    "phase": null,
    "stageIcon": "🚀",
    "stateIcon": null,
    "title": "🚀 feat"
  },
  "sessionTitle": "🚀 feat"
}
[exit 0]
```

```text
(in $CASES/p14b/main/.claude/worktrees/feat)
$ git fetch origin main
From $CASES/p14b/origin
 * branch            main       -> FETCH_HEAD
[exit 0]
```

```text
(in $CASES/p14b/main/.claude/worktrees/feat)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": true,
  "oldHead": "d341cdaf7ecbd1dc812348663a59ce4ce8c2c088",
  "newHead": "a399af2f178fc452a94875d7801a3c4fc126d4c8",
  "versions": {
    "packs": {
      "devkit-openspec": "1.2.0",
      "devkit-core": "1.0.1"
    },
    "metadata": "1.2.0"
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
      "to": "docs/adr/0003-feat.md"
    }
  ],
  "citations": [
    "CHANGELOG.md"
  ],
  "mode": "assign"
}
[exit 0]
```

```text
(in $CASES/p14b/main/.claude/worktrees/feat)
$ git push origin feat
To $CASES/p14b/origin.git
   d341cda..a399af2  feat -> feat
[exit 0]
```

```text
(in $CASES/p14b/main/.claude/worktrees/feat)
$ git log -1 --format=%B
chore(release): assign the release of feat

Release-change: feat
Release-line: plugins/core/.claude-plugin/plugin.json
Release-line: plugins/openspec/.claude-plugin/plugin.json
Release-line: .claude-plugin/marketplace.json
Release-line: CHANGELOG.md
Release-line: docs/openspec-flow.md
Release-adr: docs/adr/feat.md -> docs/adr/0003-feat.md
Release-citation: CHANGELOG.md

[exit 0]
```

```text
(in $CASES/p14b/main/.claude/worktrees/feat)
$ ls docs/adr
0001-start.md
0002-sib.md
0003-feat.md
[exit 0]
```

```text
(in $CASES/p14b/main/.claude/worktrees/feat)
$ cat plugins/openspec/.claude-plugin/plugin.json src/a.ts
{
  "name": "devkit-openspec",
  "version": "1.2.0",
  "description": "the devkit-openspec pack"
}
export const a = 3; // feat and sib
[exit 0]
```

The step exited 0, numbering the branch above the base from its record, and the session pushed; the loop then hands `enable-auto-merge`:

```text
(in $CASES/p14b/main/.claude/worktrees/feat)
$ node $DEV/change-loop.mjs next --change feat --lang en
devkit-run: feat
{
  "version": 1,
  "change": "feat",
  "script": "devkit-lite",
  "root": "$CASES/p14b/main/.claude/worktrees/feat",
  "branch": "feat",
  "filesLanguage": "en",
  "kind": "session",
  "stage": "delivery",
  "stageTitle": "Delivery",
  "role": "commit-and-pr",
  "skills": [
    "commit-message-guidelines"
  ],
  "model": "haiku",
  "step": "enable-auto-merge",
  "detail": {
    "step": "enable-auto-merge",
    "reason": "all eight items are met",
    "number": 11,
    "method": "squash",
    "head": "a399af2f178fc452a94875d7801a3c4fc126d4c8"
  },
  "progressKey": "delivery/enable-auto-merge@c28dd29b4740",
  "baseFetch": {
    "ok": true,
    "base": "main"
  },
  "icon": "🚀",
  "state": {
    "state": "running",
    "reason": null,
    "stage": "delivery",
    "stageTitle": "Delivery",
    "phase": null,
    "stageIcon": "🚀",
    "stateIcon": null,
    "title": "🚀 feat"
  },
  "sessionTitle": "🚀 feat"
}
[exit 0]
```

### (c) The loop hands `assign-release` for a branch behind; the base then gains a conflict in `src/a.ts` before the step runs

`feat` is driven to its release step and takes its release (devkit-openspec 1.1.0, devkit-core 1.0.1, ADR 0002):

```text
(in $CASES/p14c/main/.claude/worktrees/feat)
$ node $DEV/deliver-check.mjs feat --json   -> 1/8, next: implement (phase 1 has unticked tasks: 1.1)
    did: wrote src/feat-1.ts; ticked 1.1
$ node $DEV/deliver-check.mjs feat --json   -> 1/8, next: gate (phase 1 is implemented; run its gate 1.2)
    did: ran `node -e 0` (exit 0); ticked 1.2
$ node $DEV/deliver-check.mjs feat --json   -> 1/8, next: commit (uncommitted changes outside openspec/: src/feat-1.ts)
    did: git commit: 77f461f
$ node $DEV/deliver-check.mjs feat --json   -> 1/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at 77f461f; git commit: 6fe76e9
$ node $DEV/deliver-check.mjs feat --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at 6fe76e9; git commit: 8a3c55a
$ node $DEV/deliver-check.mjs feat --json   -> 4/8, next: open-pr (no pull request yet)
    did: git push -u origin feat; gh pr create -> https://github.invalid/o/devkit/pull/11
$ node $DEV/deliver-check.mjs feat --json   -> 8/8, next: assign-release (the release of feat is not assigned yet; assign it before the merge)
```

```text
(in $CASES/p14c/main/.claude/worktrees/feat)
$ git fetch origin main
From $CASES/p14c/origin
 * branch            main       -> FETCH_HEAD
[exit 0]
```

```text
(in $CASES/p14c/main/.claude/worktrees/feat)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": true,
  "oldHead": "837ac1974da71196cc259bc408b7bbe216aa452e",
  "newHead": "1758beef3c8086b7a41af9a06bc478cc5d88c934",
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
    "CHANGELOG.md"
  ],
  "mode": "assign"
}
[exit 0]
```

```text
(in $CASES/p14c/main/.claude/worktrees/feat)
$ git push origin feat
To $CASES/p14c/origin.git
   837ac19..1758bee  feat -> feat
[exit 0]
```

The base moves by a commit that touches no file of `feat`, so the branch is only behind:

```text
(in $CASES/p14c/main)
$ git push origin main
To $CASES/p14c/origin.git
   2c8e894..79875fb  main -> main
[exit 0]
```

```text
(in $CASES/p14c/main/.claude/worktrees/feat)
$ node $DEV/change-loop.mjs next --change feat --lang en
devkit-run: feat
{
  "version": 1,
  "change": "feat",
  "script": "devkit-lite",
  "root": "$CASES/p14c/main/.claude/worktrees/feat",
  "branch": "feat",
  "filesLanguage": "en",
  "kind": "session",
  "stage": "delivery",
  "stageTitle": "Delivery",
  "role": "commit-and-pr",
  "skills": [
    "commit-message-guidelines"
  ],
  "model": "haiku",
  "step": "assign-release",
  "detail": {
    "step": "assign-release",
    "reason": "branch is behind main; update it",
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
  },
  "progressKey": "delivery/assign-release@2c46edbb1bfc",
  "baseFetch": {
    "ok": true,
    "base": "main"
  },
  "icon": "🚀",
  "state": {
    "state": "running",
    "reason": null,
    "stage": "delivery",
    "stageTitle": "Delivery",
    "phase": null,
    "stageIcon": "🚀",
    "stateIcon": null,
    "title": "🚀 feat"
  },
  "sessionTitle": "🚀 feat"
}
[exit 0]
```

Before the session runs the row, another clone pushes a commit to `main` on the remote that edits `src/a.ts`:

```text
(in $CASES/p14c)
$ git clone -q $CASES/p14c/origin.git $CASES/p14c/other
(no output)
[exit 0]
```

```text
(in $CASES/p14c/other)
$ git commit -q -am 'fix: the base edits src/a.ts'
(no output)
[exit 0]
```

```text
(in $CASES/p14c/other)
$ git push -q origin main
(no output)
[exit 0]
```

The session's row: the fetch, then the step, which meets the conflict outside its lines and exits 2 listing it, with no `error`:

```text
(in $CASES/p14c/main/.claude/worktrees/feat)
$ git fetch origin main
From $CASES/p14c/origin
 * branch            main       -> FETCH_HEAD
   79875fb..2eba6fb  main       -> origin/main
[exit 0]
```

```text
(in $CASES/p14c/main/.claude/worktrees/feat)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": false,
  "oldHead": "1758beef3c8086b7a41af9a06bc478cc5d88c934",
  "change": "feat",
  "conflicts": [
    "src/a.ts"
  ],
  "mode": "assign"
}
[exit 2]
```

So the session runs `next` again, which fetches the base and hands `resolve-base-conflict`:

```text
(in $CASES/p14c/main/.claude/worktrees/feat)
$ node $DEV/change-loop.mjs next --change feat --lang en
devkit-run: feat
{
  "version": 1,
  "change": "feat",
  "script": "devkit-lite",
  "root": "$CASES/p14c/main/.claude/worktrees/feat",
  "branch": "feat",
  "filesLanguage": "en",
  "kind": "agent",
  "stage": "implementation",
  "stageTitle": "Implementation",
  "role": "tdd-implementer",
  "skills": [
    "test-driven-development",
    "systematic-debugging"
  ],
  "model": "sonnet",
  "agent": "devkit-core:tdd-implementer",
  "step": "resolve-base-conflict",
  "detail": {
    "step": "resolve-base-conflict",
    "reason": "the PR conflicts with main outside the release lines the release step writes: src/a.ts",
    "number": 11,
    "paths": [
      "src/a.ts"
    ],
    "others": [
      "src/a.ts"
    ],
    "base": "main",
    "archive": false,
    "noted": true
  },
  "brief": "Change feat (devkit-lite script), stage implementation: step resolve-base-conflict {\"step\":\"resolve-base-conflict\",\"reason\":\"the PR conflicts with main outside the release lines the release step writes: src/a.ts\",\"number\":11,\"paths\":[\"src/a.ts\"],\"others\":[\"src/a.ts\"],\"base\":\"main\",\"archive\":false,\"noted\":true}. Work only in $CASES/p14c/main/.claude/worktrees/feat on branch feat; every file path is absolute under it; start every Bash command with cd $CASES/p14c/main/.claude/worktrees/feat && ; do not fetch. Write the change's files in English.",
  "progressKey": "implementation/resolve-base-conflict@2c46edbb1bfc",
  "baseFetch": {
    "ok": true,
    "base": "main"
  },
  "icon": "🛠️",
  "state": {
    "state": "running",
    "reason": null,
    "stage": "implementation",
    "stageTitle": "Implementation",
    "phase": null,
    "stageIcon": "🛠️",
    "stateIcon": null,
    "title": "🛠️ feat"
  },
  "sessionTitle": "🛠️ feat"
}
[exit 0]
```

### (d) The base lands a record and extends the one-line list holding the change's own citation

`feat` is driven to its release step and takes its release (devkit-openspec 1.1.0, devkit-core 1.0.1, ADR 0002):

```text
(in $CASES/p14d/main/.claude/worktrees/feat)
$ node $DEV/deliver-check.mjs feat --json   -> 1/8, next: implement (phase 1 has unticked tasks: 1.1)
    did: wrote src/feat-1.ts; ticked 1.1
$ node $DEV/deliver-check.mjs feat --json   -> 1/8, next: gate (phase 1 is implemented; run its gate 1.2)
    did: ran `node -e 0` (exit 0); ticked 1.2
$ node $DEV/deliver-check.mjs feat --json   -> 1/8, next: commit (uncommitted changes outside openspec/: src/feat-1.ts)
    did: git commit: 743a248
$ node $DEV/deliver-check.mjs feat --json   -> 1/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at 743a248; git commit: 19c93bd
$ node $DEV/deliver-check.mjs feat --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at 19c93bd; git commit: d29f4dc
$ node $DEV/deliver-check.mjs feat --json   -> 4/8, next: open-pr (no pull request yet)
    did: git push -u origin feat; gh pr create -> https://github.invalid/o/devkit/pull/11
$ node $DEV/deliver-check.mjs feat --json   -> 8/8, next: assign-release (the release of feat is not assigned yet; assign it before the merge)
```

```text
(in $CASES/p14d/main/.claude/worktrees/feat)
$ git fetch origin main
From $CASES/p14d/origin
 * branch            main       -> FETCH_HEAD
[exit 0]
```

```text
(in $CASES/p14d/main/.claude/worktrees/feat)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": true,
  "oldHead": "a3c4f0d45d543f05d89e9ec296dc0b8221b934d3",
  "newHead": "1ae1955e30bec7b0ef6e0bf79f5c1de5bae63018",
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
    "docs/context.yaml"
  ],
  "mode": "assign"
}
[exit 0]
```

```text
(in $CASES/p14d/main/.claude/worktrees/feat)
$ git push origin feat
To $CASES/p14d/origin.git
   a3c4f0d..1ae1955  feat -> feat
[exit 0]
```

The sibling `sib` notes devkit-openspec `minor`, names `docs/adr/sib.md` and writes `docs/context.yaml`; it takes devkit-openspec 1.1.0 and ADR 0002 on the same base and lands:

```text
(in $CASES/p14d/main/.claude/worktrees/sib)
$ node $DEV/deliver-check.mjs sib --json   -> 1/8, next: implement (phase 1 has unticked tasks: 1.1)
    did: wrote src/sib-1.ts; ticked 1.1
$ node $DEV/deliver-check.mjs sib --json   -> 1/8, next: gate (phase 1 is implemented; run its gate 1.2)
    did: ran `node -e 0` (exit 0); ticked 1.2
$ node $DEV/deliver-check.mjs sib --json   -> 1/8, next: commit (uncommitted changes outside openspec/: src/sib-1.ts)
    did: git commit: 51eb3dc
$ node $DEV/deliver-check.mjs sib --json   -> 1/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at 51eb3dc; git commit: 43e93f0
$ node $DEV/deliver-check.mjs sib --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at 43e93f0; git commit: c4ca482
$ node $DEV/deliver-check.mjs sib --json   -> 4/8, next: open-pr (no pull request yet)
    did: git push -u origin sib; gh pr create -> https://github.invalid/o/devkit/pull/12
$ node $DEV/deliver-check.mjs sib --json   -> 8/8, next: assign-release (the release of sib is not assigned yet; assign it before the merge)
```

```text
(in $CASES/p14d/main/.claude/worktrees/sib)
$ git fetch origin main
From $CASES/p14d/origin
 * branch            main       -> FETCH_HEAD
[exit 0]
```

```text
(in $CASES/p14d/main/.claude/worktrees/sib)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": true,
  "oldHead": "718dd76b598f678b43355fd99030e96534783bfa",
  "newHead": "1dea6562889c5ba62c017f1d9cd9d235faceda4a",
  "versions": {
    "packs": {
      "devkit-openspec": "1.1.0"
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
  "change": "sib",
  "adrs": [
    {
      "from": "docs/adr/sib.md",
      "to": "docs/adr/0002-sib.md"
    }
  ],
  "citations": [
    "docs/context.yaml"
  ],
  "mode": "assign"
}
[exit 0]
```

```text
(in $CASES/p14d/main/.claude/worktrees/sib)
$ git push origin sib
To $CASES/p14d/origin.git
   718dd76..1dea656  sib -> sib
[exit 0]
```

```text
(in $CASES/p14d/main/.claude/worktrees/sib)
$ gh pr merge 12 --auto --squash --match-head-commit 1dea6562889c5ba62c017f1d9cd9d235faceda4a
(no output)
[exit 0]
```

```text
(in $CASES/p14d/main)
$ gh __merge 12   # the stub: GitHub merges the pull request once its rules pass
fe05dd6586c472e5c58ccb25f39e20e622f33047
[exit 0]
```

```text
(in $CASES/p14d/main)
$ git log --oneline --graph -4 origin/main
* fe05dd6 Merge pull request #12 from sib
* 6ce8b6c seed: the project at its first release
[exit 0]
```

```text
(in $CASES/p14d/main/.claude/worktrees/feat)
$ cat docs/context.yaml   # the branch: the citation the step wrote
  ADRs: docs/adr/ (0001 start; ADR 0002 the rule)
[exit 0]
```

```text
(in $CASES/p14d/main/.claude/worktrees/feat)
$ git show origin/main:docs/context.yaml   # the base: its own entry
  ADRs: docs/adr/ (0001 start; ADR 0002 other)
[exit 0]
```

Both sides extended the one line, which no mask resolves, so the loop hands `resolve-base-conflict` naming that file:

```text
(in $CASES/p14d/main/.claude/worktrees/feat)
$ node $DEV/change-loop.mjs next --change feat --lang en
devkit-run: feat
{
  "version": 1,
  "change": "feat",
  "script": "devkit-lite",
  "root": "$CASES/p14d/main/.claude/worktrees/feat",
  "branch": "feat",
  "filesLanguage": "en",
  "kind": "agent",
  "stage": "implementation",
  "stageTitle": "Implementation",
  "role": "tdd-implementer",
  "skills": [
    "test-driven-development",
    "systematic-debugging"
  ],
  "model": "sonnet",
  "agent": "devkit-core:tdd-implementer",
  "step": "resolve-base-conflict",
  "detail": {
    "step": "resolve-base-conflict",
    "reason": "the PR conflicts with main outside the release lines the release step writes: docs/context.yaml",
    "number": 11,
    "paths": [
      "CHANGELOG.md",
      "docs/catalog.md",
      "docs/context.yaml"
    ],
    "others": [
      "docs/context.yaml"
    ],
    "base": "main",
    "archive": false,
    "noted": true
  },
  "brief": "Change feat (devkit-lite script), stage implementation: step resolve-base-conflict {\"step\":\"resolve-base-conflict\",\"reason\":\"the PR conflicts with main outside the release lines the release step writes: docs/context.yaml\",\"number\":11,\"paths\":[\"CHANGELOG.md\",\"docs/catalog.md\",\"docs/context.yaml\"],\"others\":[\"docs/context.yaml\"],\"base\":\"main\",\"archive\":false,\"noted\":true}. Work only in $CASES/p14d/main/.claude/worktrees/feat on branch feat; every file path is absolute under it; start every Bash command with cd $CASES/p14d/main/.claude/worktrees/feat && ; do not fetch. Write the change's files in English.",
  "progressKey": "implementation/resolve-base-conflict@3827f791786a",
  "baseFetch": {
    "ok": true,
    "base": "main"
  },
  "icon": "🛠️",
  "state": {
    "state": "running",
    "reason": null,
    "stage": "implementation",
    "stageTitle": "Implementation",
    "phase": null,
    "stageIcon": "🛠️",
    "stateIcon": null,
    "title": "🛠️ feat"
  },
  "sessionTitle": "🛠️ feat"
}
[exit 0]
```

The merge the row says (scripted): both entries kept on the line, the branch's as the branch holds it, the base's side of every release line taken:

```text
(in $CASES/p14d/main/.claude/worktrees/feat)
$ git merge --no-ff --no-commit origin/main
Auto-merging .claude-plugin/marketplace.json
Auto-merging CHANGELOG.md
CONFLICT (content): Merge conflict in CHANGELOG.md
Auto-merging docs/catalog.md
CONFLICT (content): Merge conflict in docs/catalog.md
Auto-merging docs/context.yaml
CONFLICT (content): Merge conflict in docs/context.yaml
Automatic merge failed; fix conflicts and then commit the result.
[exit 1]
```

```text
(in $CASES/p14d/main/.claude/worktrees/feat)
$ git diff --name-only --diff-filter=U   # the files in conflict
CHANGELOG.md
docs/catalog.md
docs/context.yaml
[exit 0]
```

```text
(in $CASES/p14d/main/.claude/worktrees/feat)
$ git checkout origin/main -- plugins/openspec/.claude-plugin/plugin.json plugins/core/.claude-plugin/plugin.json .claude-plugin/marketplace.json CHANGELOG.md docs/catalog.md docs/openspec-flow.md
(no output)
[exit 0]
```

```text
(in $CASES/p14d/main/.claude/worktrees/feat)
$ git add -A
(no output)
[exit 0]
```

```text
(in $CASES/p14d/main/.claude/worktrees/feat)
$ git commit -q --no-edit
(no output)
[exit 0]
```

```text
(in $CASES/p14d/main/.claude/worktrees/feat)
$ git show --stat '--format=%h %s%n%P' HEAD
ecef097 Merge remote-tracking branch 'origin/main' into feat
1ae1955e30bec7b0ef6e0bf79f5c1de5bae63018 fe05dd6586c472e5c58ccb25f39e20e622f33047

 .claude-plugin/marketplace.json                        |  2 +-
 CHANGELOG.md                                           |  5 ++---
 docs/adr/0002-sib.md                                   |  6 ++++++
 docs/catalog.md                                        |  2 +-
 docs/context.yaml                                      |  2 +-
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
 plugins/core/.claude-plugin/plugin.json                |  2 +-
 src/sib-1.ts                                           |  1 +
 17 files changed, 74 insertions(+), 7 deletions(-)
[exit 0]
```

The merge changed files of the change, so the session records the evidence and the reviews again (ADR 0025), with no push:

```text
(in $CASES/p14d/main/.claude/worktrees/feat)
$ node $DEV/deliver-check.mjs feat --json   -> 4/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at ecef097; git commit: 9d9225d
$ node $DEV/deliver-check.mjs feat --json   -> 6/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at 9d9225d; git commit: 0d4e6b1
$ node $DEV/deliver-check.mjs feat --json   -> 7/8, next: assign-release (PR #11 has merge conflicts with main)
```

The loop checks the merge of the base (`merge-check`, run as handed); GitHub still reports the pull request in conflict at the old head (1ae1955), so the loop then hands the plain push to `devkit-core:commit-and-pr` (run here as its command):

```text
(in $CASES/p14d/main/.claude/worktrees/feat)
$ node $DEV/change-loop.mjs next --change feat --lang en
devkit-run: feat
{
  "version": 1,
  "change": "feat",
  "script": "devkit-lite",
  "root": "$CASES/p14d/main/.claude/worktrees/feat",
  "branch": "feat",
  "filesLanguage": "en",
  "kind": "session",
  "stage": "evidence",
  "stageTitle": "Demonstration",
  "role": "pr-verifier",
  "skills": [],
  "model": "sonnet",
  "step": "merge-check",
  "detail": {
    "command": [
      "node",
      "$DEV/change-loop.mjs",
      "merge-check",
      "feat",
      "--lang",
      "en"
    ],
    "merge": "ecef097000bb235d0d8dc68e28d0c33ab8f36245",
    "base": "main"
  },
  "progressKey": "evidence/merge-check@baaf2aa47c42",
  "baseFetch": {
    "ok": true,
    "base": "main"
  },
  "icon": "🔍",
  "state": {
    "state": "running",
    "reason": null,
    "stage": "evidence",
    "stageTitle": "Demonstration",
    "phase": null,
    "stageIcon": "🔍",
    "stateIcon": null,
    "title": "🔍 feat"
  },
  "sessionTitle": "🔍 feat"
}
[exit 0]
```

```text
(in $CASES/p14d/main/.claude/worktrees/feat)
$ node $DEV/change-loop.mjs merge-check feat --lang en
{
  "version": 1,
  "change": "feat",
  "base": "main",
  "merge": "ecef097000bb235d0d8dc68e28d0c33ab8f36245",
  "result": "green",
  "reds": 0,
  "errors": null,
  "error": null
}
[exit 0]
```

```text
(in $CASES/p14d/main/.claude/worktrees/feat)
$ node $DEV/change-loop.mjs next --change feat --lang en
devkit-run: feat
{
  "version": 1,
  "change": "feat",
  "script": "devkit-lite",
  "root": "$CASES/p14d/main/.claude/worktrees/feat",
  "branch": "feat",
  "filesLanguage": "en",
  "kind": "agent",
  "stage": "delivery",
  "stageTitle": "Delivery",
  "role": "commit-and-pr",
  "skills": [
    "commit-message-guidelines"
  ],
  "model": "haiku",
  "agent": "devkit-core:commit-and-pr",
  "step": "push",
  "detail": {
    "step": "push",
    "reason": "the merge of origin/main is not pushed yet; PR #11 still has 1ae1955",
    "number": 11,
    "branch": "feat",
    "command": [
      "git",
      "push",
      "origin",
      "feat"
    ]
  },
  "brief": "Change feat (devkit-lite script), stage delivery: step push {\"step\":\"push\",\"reason\":\"the merge of origin/main is not pushed yet; PR #11 still has 1ae1955\",\"number\":11,\"branch\":\"feat\",\"command\":[\"git\",\"push\",\"origin\",\"feat\"]}. Work only in $CASES/p14d/main/.claude/worktrees/feat on branch feat; every file path is absolute under it; start every Bash command with cd $CASES/p14d/main/.claude/worktrees/feat && ; do not fetch. Write the change's files in English. Attribution: the session handing this off appends below this brief, verbatim, the lines it ends its own commit messages and pull-request descriptions with, as the block `Attribution (from the caller):` with one `Commit trailer: <line>` per commit line and one `PR footer: <line>` per pull-request line, or the line `Attribution (from the caller): none` when it ends them with none.",
  "progressKey": "delivery/push@baaf2aa47c42",
  "baseFetch": {
    "ok": true,
    "base": "main"
  },
  "icon": "🚀",
  "state": {
    "state": "running",
    "reason": null,
    "stage": "delivery",
    "stageTitle": "Delivery",
    "phase": null,
    "stageIcon": "🚀",
    "stateIcon": null,
    "title": "🚀 feat"
  },
  "sessionTitle": "🚀 feat"
}
[exit 0]
```

```text
(in $CASES/p14d/main/.claude/worktrees/feat)
$ git push origin feat
To $CASES/p14d/origin.git
   1ae1955..0d4e6b1  feat -> feat
[exit 0]
```

After the push the release state is not current (the merge base moved), so the loop hands `assign-release`; the session runs its row:

```text
(in $CASES/p14d/main/.claude/worktrees/feat)
$ node $DEV/change-loop.mjs next --change feat --lang en
devkit-run: feat
{
  "version": 1,
  "change": "feat",
  "script": "devkit-lite",
  "root": "$CASES/p14d/main/.claude/worktrees/feat",
  "branch": "feat",
  "filesLanguage": "en",
  "kind": "session",
  "stage": "delivery",
  "stageTitle": "Delivery",
  "role": "commit-and-pr",
  "skills": [
    "commit-message-guidelines"
  ],
  "model": "haiku",
  "step": "assign-release",
  "detail": {
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
  },
  "progressKey": "delivery/assign-release@baaf2aa47c42",
  "baseFetch": {
    "ok": true,
    "base": "main"
  },
  "icon": "🚀",
  "state": {
    "state": "running",
    "reason": null,
    "stage": "delivery",
    "stageTitle": "Delivery",
    "phase": null,
    "stageIcon": "🚀",
    "stateIcon": null,
    "title": "🚀 feat"
  },
  "sessionTitle": "🚀 feat"
}
[exit 0]
```

```text
(in $CASES/p14d/main/.claude/worktrees/feat)
$ git fetch origin main
From $CASES/p14d/origin
 * branch            main       -> FETCH_HEAD
[exit 0]
```

```text
(in $CASES/p14d/main/.claude/worktrees/feat)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": true,
  "oldHead": "0d4e6b1cbe03eac4e0f695a3eeecb96b3998b8c5",
  "newHead": "eac7c3b60ccd30855f545919e46c20c1e7f6bcde",
  "versions": {
    "packs": {
      "devkit-openspec": "1.2.0",
      "devkit-core": "1.0.1"
    },
    "metadata": "1.2.0"
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
      "to": "docs/adr/0003-feat.md"
    }
  ],
  "citations": [
    "CHANGELOG.md",
    "docs/context.yaml"
  ],
  "mode": "assign"
}
[exit 0]
```

```text
(in $CASES/p14d/main/.claude/worktrees/feat)
$ git push origin feat
To $CASES/p14d/origin.git
   0d4e6b1..eac7c3b  feat -> feat
[exit 0]
```

```text
(in $CASES/p14d/main/.claude/worktrees/feat)
$ git log -1 --format=%B
chore(release): assign the release of feat

Release-change: feat
Release-line: plugins/core/.claude-plugin/plugin.json
Release-line: plugins/openspec/.claude-plugin/plugin.json
Release-line: .claude-plugin/marketplace.json
Release-line: CHANGELOG.md
Release-line: docs/openspec-flow.md
Release-adr: docs/adr/feat.md -> docs/adr/0003-feat.md
Release-citation: CHANGELOG.md
Release-citation: docs/context.yaml

[exit 0]
```

```text
(in $CASES/p14d/main/.claude/worktrees/feat)
$ cat docs/context.yaml
  ADRs: docs/adr/ (0001 start; ADR 0003 the rule; ADR 0002 other)
[exit 0]
```

```text
(in $CASES/p14d/main/.claude/worktrees/feat)
$ ls docs/adr
0001-start.md
0002-sib.md
0003-feat.md
[exit 0]
```

The step exited 0: the line holds both entries, the change's with its new number; the loop then hands `enable-auto-merge`:

```text
(in $CASES/p14d/main/.claude/worktrees/feat)
$ node $DEV/change-loop.mjs next --change feat --lang en
devkit-run: feat
{
  "version": 1,
  "change": "feat",
  "script": "devkit-lite",
  "root": "$CASES/p14d/main/.claude/worktrees/feat",
  "branch": "feat",
  "filesLanguage": "en",
  "kind": "session",
  "stage": "delivery",
  "stageTitle": "Delivery",
  "role": "commit-and-pr",
  "skills": [
    "commit-message-guidelines"
  ],
  "model": "haiku",
  "step": "enable-auto-merge",
  "detail": {
    "step": "enable-auto-merge",
    "reason": "all eight items are met",
    "number": 11,
    "method": "squash",
    "head": "eac7c3b60ccd30855f545919e46c20c1e7f6bcde"
  },
  "progressKey": "delivery/enable-auto-merge@7896e8d7beea",
  "baseFetch": {
    "ok": true,
    "base": "main"
  },
  "icon": "🚀",
  "state": {
    "state": "running",
    "reason": null,
    "stage": "delivery",
    "stageTitle": "Delivery",
    "phase": null,
    "stageIcon": "🚀",
    "stateIcon": null,
    "title": "🚀 feat"
  },
  "sessionTitle": "🚀 feat"
}
[exit 0]
```

## P-15 the give-back at the token level after a merge by hand of a one-line list

AC-4, AC-5, AC-15 (review round 3, D-34, D-36). Each variant: `feat` (merge mode, a noted change) cites its record on the one-line
list `  ADRs: docs/adr/ (0001 start; ADR [feat] the rule)` of `docs/context.yaml` and is assigned once (ADR 0002); the base lands its
own record 0002 and extends the same line; the step refuses the merge, a person merges by hand, and `release-merge.mjs --assign` runs
again on that merge. No number is given back by hand.

### (a) The base's entry in the list's own form

```text
(in $CASES/p15a/main/.claude/worktrees/feat)
$ node $DEV/deliver-check.mjs feat --json   -> 1/8, next: implement (phase 1 has unticked tasks: 1.1)
    did: wrote src/feat-1.ts; ticked 1.1
$ node $DEV/deliver-check.mjs feat --json   -> 1/8, next: gate (phase 1 is implemented; run its gate 1.2)
    did: ran `node -e 0` (exit 0); ticked 1.2
$ node $DEV/deliver-check.mjs feat --json   -> 1/8, next: commit (uncommitted changes outside openspec/: src/feat-1.ts)
    did: git commit: 5c65e0e
$ node $DEV/deliver-check.mjs feat --json   -> 1/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at 5c65e0e; git commit: 0677b4c
$ node $DEV/deliver-check.mjs feat --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at 0677b4c; git commit: f750562
$ node $DEV/deliver-check.mjs feat --json   -> 4/8, next: open-pr (no pull request yet)
    did: git push -u origin feat; gh pr create -> https://github.invalid/o/devkit/pull/11
$ node $DEV/deliver-check.mjs feat --json   -> 8/8, next: assign-release (the release of feat is not assigned yet; assign it before the merge)
```

```text
(in $CASES/p15a/main/.claude/worktrees/feat)
$ git fetch origin main
From $CASES/p15a/origin
 * branch            main       -> FETCH_HEAD
[exit 0]
```

```text
(in $CASES/p15a/main/.claude/worktrees/feat)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": true,
  "oldHead": "e4410e3207ad9b58e076e59f0e70eb82ffceba94",
  "newHead": "8fea6ec7587fa69bab311d081c14305f0e1b0ee7",
  "versions": {
    "packs": {
      "devkit-openspec": "1.1.0"
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
      "to": "docs/adr/0002-feat.md"
    }
  ],
  "citations": [
    "docs/context.yaml"
  ],
  "mode": "assign"
}
[exit 0]
```

```text
(in $CASES/p15a/main/.claude/worktrees/feat)
$ git push origin feat
To $CASES/p15a/origin.git
   e4410e3..8fea6ec  feat -> feat
[exit 0]
```

`feat` took devkit-openspec 1.1.0 and ADR 0002. The base then lands another change by the old rule: devkit-openspec 1.1.0, `docs/adr/0002-other.md`, and its entry `0002 other` on the list:

```text
(in $CASES/p15a/main)
$ git push origin main
To $CASES/p15a/origin.git
   86092ea..81be3e6  main -> main
[exit 0]
```

```text
(in $CASES/p15a/main/.claude/worktrees/feat)
$ cat docs/context.yaml   # the branch
  ADRs: docs/adr/ (0001 start; ADR 0002 the rule)
[exit 0]
```

```text
(in $CASES/p15a/main/.claude/worktrees/feat)
$ git fetch origin main
From $CASES/p15a/origin
 * branch            main       -> FETCH_HEAD
[exit 0]
```

```text
(in $CASES/p15a/main/.claude/worktrees/feat)
$ git show origin/main:docs/context.yaml   # the base
  ADRs: docs/adr/ (0001 start; 0002 other)
[exit 0]
```

The step meets the line both sides extended and exits 2 listing it, with no `error`:

```text
(in $CASES/p15a/main/.claude/worktrees/feat)
$ git fetch origin main
From $CASES/p15a/origin
 * branch            main       -> FETCH_HEAD
[exit 0]
```

```text
(in $CASES/p15a/main/.claude/worktrees/feat)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": false,
  "oldHead": "8fea6ec7587fa69bab311d081c14305f0e1b0ee7",
  "change": "feat",
  "conflicts": [
    "CHANGELOG.md",
    "docs/context.yaml"
  ],
  "mode": "assign"
}
[exit 2]
```

The merge by hand: the base's side of every release line, and the line written `; ADR 0002 the rule; 0002 other`:

```text
(in $CASES/p15a/main/.claude/worktrees/feat)
$ git merge --no-ff --no-commit origin/main
Auto-merging CHANGELOG.md
CONFLICT (content): Merge conflict in CHANGELOG.md
Auto-merging docs/context.yaml
CONFLICT (content): Merge conflict in docs/context.yaml
Automatic merge failed; fix conflicts and then commit the result.
[exit 1]
```

```text
(in $CASES/p15a/main/.claude/worktrees/feat)
$ git diff --name-only --diff-filter=U   # the files in conflict
CHANGELOG.md
docs/context.yaml
[exit 0]
```

```text
(in $CASES/p15a/main/.claude/worktrees/feat)
$ git checkout origin/main -- plugins/openspec/.claude-plugin/plugin.json plugins/core/.claude-plugin/plugin.json .claude-plugin/marketplace.json CHANGELOG.md docs/catalog.md docs/openspec-flow.md
(no output)
[exit 0]
```

```text
(in $CASES/p15a/main/.claude/worktrees/feat)
$ git add -A
(no output)
[exit 0]
```

```text
(in $CASES/p15a/main/.claude/worktrees/feat)
$ git commit -q --no-edit
(no output)
[exit 0]
```

```text
(in $CASES/p15a/main/.claude/worktrees/feat)
$ git show --stat '--format=%h %s%n%P' HEAD
1a511e5 Merge remote-tracking branch 'origin/main' into feat
8fea6ec7587fa69bab311d081c14305f0e1b0ee7 81be3e67228ade354db92981731da670690e4a87

 CHANGELOG.md           | 4 ++--
 docs/adr/0002-other.md | 3 +++
 docs/context.yaml      | 2 +-
 3 files changed, 6 insertions(+), 3 deletions(-)
[exit 0]
```

```text
(in $CASES/p15a/main/.claude/worktrees/feat)
$ git fetch origin main
From $CASES/p15a/origin
 * branch            main       -> FETCH_HEAD
[exit 0]
```

```text
(in $CASES/p15a/main/.claude/worktrees/feat)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": true,
  "oldHead": "1a511e5a14e90a69e936804288492e0f332a2ec1",
  "newHead": "3876f9883ba4d504bd03630f7ed33bef273e12c6",
  "versions": {
    "packs": {
      "devkit-openspec": "1.2.0"
    },
    "metadata": "1.2.0"
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
    "docs/context.yaml"
  ],
  "mode": "assign"
}
[exit 0]
```

```text
(in $CASES/p15a/main/.claude/worktrees/feat)
$ git push origin feat
To $CASES/p15a/origin.git
   8fea6ec..3876f98  feat -> feat
[exit 0]
```

```text
(in $CASES/p15a/main/.claude/worktrees/feat)
$ git log -1 --format=%B
chore(release): assign the release of feat

Release-change: feat
Release-line: plugins/openspec/.claude-plugin/plugin.json
Release-line: .claude-plugin/marketplace.json
Release-line: CHANGELOG.md
Release-line: docs/openspec-flow.md
Release-adr: docs/adr/feat.md -> docs/adr/0003-feat.md
Release-citation: docs/context.yaml

[exit 0]
```

```text
(in $CASES/p15a/main/.claude/worktrees/feat)
$ cat docs/context.yaml
  ADRs: docs/adr/ (0001 start; ADR 0003 the rule; 0002 other)
[exit 0]
```

```text
(in $CASES/p15a/main/.claude/worktrees/feat)
$ ls docs/adr
0001-start.md
0002-other.md
0003-feat.md
[exit 0]
```

The state reads assigned and current:

```text
(in $CASES/p15a/main/.claude/worktrees/feat)
$ node -e "import('$DEV/deliver-check.mjs').then((D) => console.log(D.releaseState(process.cwd(), 'feat', D.gitFacts(process.cwd(), { base: 'main' }))))"   # kind, current, paths, reassign, adrs
{
  "kind": "assigned",
  "current": true,
  "paths": [],
  "reassign": [],
  "adrs": [
    {
      "slug": "feat",
      "folder": "docs/adr",
      "from": "docs/adr/feat.md",
      "to": "docs/adr/0003-feat.md",
      "number": "0003"
    }
  ]
}
[exit 0]
```

### (b) The base's entry in the step's form, with the step's old number

```text
(in $CASES/p15b/main/.claude/worktrees/feat)
$ node $DEV/deliver-check.mjs feat --json   -> 1/8, next: implement (phase 1 has unticked tasks: 1.1)
    did: wrote src/feat-1.ts; ticked 1.1
$ node $DEV/deliver-check.mjs feat --json   -> 1/8, next: gate (phase 1 is implemented; run its gate 1.2)
    did: ran `node -e 0` (exit 0); ticked 1.2
$ node $DEV/deliver-check.mjs feat --json   -> 1/8, next: commit (uncommitted changes outside openspec/: src/feat-1.ts)
    did: git commit: cd24d1b
$ node $DEV/deliver-check.mjs feat --json   -> 1/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at cd24d1b; git commit: 5d3da48
$ node $DEV/deliver-check.mjs feat --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at 5d3da48; git commit: 5049e31
$ node $DEV/deliver-check.mjs feat --json   -> 4/8, next: open-pr (no pull request yet)
    did: git push -u origin feat; gh pr create -> https://github.invalid/o/devkit/pull/11
$ node $DEV/deliver-check.mjs feat --json   -> 8/8, next: assign-release (the release of feat is not assigned yet; assign it before the merge)
```

```text
(in $CASES/p15b/main/.claude/worktrees/feat)
$ git fetch origin main
From $CASES/p15b/origin
 * branch            main       -> FETCH_HEAD
[exit 0]
```

```text
(in $CASES/p15b/main/.claude/worktrees/feat)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": true,
  "oldHead": "9209de774739087806ef57a9fb2985a3fe795e6c",
  "newHead": "659c186ce9ea2b2877f5917212b328691a87ccdd",
  "versions": {
    "packs": {
      "devkit-openspec": "1.1.0"
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
      "to": "docs/adr/0002-feat.md"
    }
  ],
  "citations": [
    "docs/context.yaml"
  ],
  "mode": "assign"
}
[exit 0]
```

```text
(in $CASES/p15b/main/.claude/worktrees/feat)
$ git push origin feat
To $CASES/p15b/origin.git
   9209de7..659c186  feat -> feat
[exit 0]
```

`feat` took devkit-openspec 1.1.0 and ADR 0002. The base then lands another change by the old rule: devkit-openspec 1.1.0, `docs/adr/0002-other.md`, and its entry `ADR 0002 other` on the list:

```text
(in $CASES/p15b/main)
$ git push origin main
To $CASES/p15b/origin.git
   02591db..c46d659  main -> main
[exit 0]
```

```text
(in $CASES/p15b/main/.claude/worktrees/feat)
$ cat docs/context.yaml   # the branch
  ADRs: docs/adr/ (0001 start; ADR 0002 the rule)
[exit 0]
```

```text
(in $CASES/p15b/main/.claude/worktrees/feat)
$ git fetch origin main
From $CASES/p15b/origin
 * branch            main       -> FETCH_HEAD
[exit 0]
```

```text
(in $CASES/p15b/main/.claude/worktrees/feat)
$ git show origin/main:docs/context.yaml   # the base
  ADRs: docs/adr/ (0001 start; ADR 0002 other)
[exit 0]
```

The step meets the line both sides extended and exits 2 listing it, with no `error`:

```text
(in $CASES/p15b/main/.claude/worktrees/feat)
$ git fetch origin main
From $CASES/p15b/origin
 * branch            main       -> FETCH_HEAD
[exit 0]
```

```text
(in $CASES/p15b/main/.claude/worktrees/feat)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": false,
  "oldHead": "659c186ce9ea2b2877f5917212b328691a87ccdd",
  "change": "feat",
  "conflicts": [
    "CHANGELOG.md",
    "docs/context.yaml"
  ],
  "mode": "assign"
}
[exit 2]
```

The merge by hand: the base's side of every release line, and the line written `; ADR 0002 the rule; ADR 0002 other`:

```text
(in $CASES/p15b/main/.claude/worktrees/feat)
$ git merge --no-ff --no-commit origin/main
Auto-merging CHANGELOG.md
CONFLICT (content): Merge conflict in CHANGELOG.md
Auto-merging docs/context.yaml
CONFLICT (content): Merge conflict in docs/context.yaml
Automatic merge failed; fix conflicts and then commit the result.
[exit 1]
```

```text
(in $CASES/p15b/main/.claude/worktrees/feat)
$ git diff --name-only --diff-filter=U   # the files in conflict
CHANGELOG.md
docs/context.yaml
[exit 0]
```

```text
(in $CASES/p15b/main/.claude/worktrees/feat)
$ git checkout origin/main -- plugins/openspec/.claude-plugin/plugin.json plugins/core/.claude-plugin/plugin.json .claude-plugin/marketplace.json CHANGELOG.md docs/catalog.md docs/openspec-flow.md
(no output)
[exit 0]
```

```text
(in $CASES/p15b/main/.claude/worktrees/feat)
$ git add -A
(no output)
[exit 0]
```

```text
(in $CASES/p15b/main/.claude/worktrees/feat)
$ git commit -q --no-edit
(no output)
[exit 0]
```

```text
(in $CASES/p15b/main/.claude/worktrees/feat)
$ git show --stat '--format=%h %s%n%P' HEAD
e24a74a Merge remote-tracking branch 'origin/main' into feat
659c186ce9ea2b2877f5917212b328691a87ccdd c46d6592c9f1f50b3d5692165cfb1fe6c4a4ed09

 CHANGELOG.md           | 4 ++--
 docs/adr/0002-other.md | 3 +++
 docs/context.yaml      | 2 +-
 3 files changed, 6 insertions(+), 3 deletions(-)
[exit 0]
```

```text
(in $CASES/p15b/main/.claude/worktrees/feat)
$ git fetch origin main
From $CASES/p15b/origin
 * branch            main       -> FETCH_HEAD
[exit 0]
```

```text
(in $CASES/p15b/main/.claude/worktrees/feat)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": true,
  "oldHead": "e24a74afa4a085c5c9f2095c23f3a535ea041222",
  "newHead": "2a9e3611166c50228f55d386457d70cd9e6504a4",
  "versions": {
    "packs": {
      "devkit-openspec": "1.2.0"
    },
    "metadata": "1.2.0"
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
    "docs/context.yaml"
  ],
  "mode": "assign"
}
[exit 0]
```

```text
(in $CASES/p15b/main/.claude/worktrees/feat)
$ git push origin feat
To $CASES/p15b/origin.git
   659c186..2a9e361  feat -> feat
[exit 0]
```

```text
(in $CASES/p15b/main/.claude/worktrees/feat)
$ cat docs/context.yaml
  ADRs: docs/adr/ (0001 start; ADR 0003 the rule; ADR 0002 other)
[exit 0]
```

### (c) The merge by hand dropped the change's entry, where the base cites its own record with that number

```text
(in $CASES/p15c/main/.claude/worktrees/feat)
$ node $DEV/deliver-check.mjs feat --json   -> 1/8, next: implement (phase 1 has unticked tasks: 1.1)
    did: wrote src/feat-1.ts; ticked 1.1
$ node $DEV/deliver-check.mjs feat --json   -> 1/8, next: gate (phase 1 is implemented; run its gate 1.2)
    did: ran `node -e 0` (exit 0); ticked 1.2
$ node $DEV/deliver-check.mjs feat --json   -> 1/8, next: commit (uncommitted changes outside openspec/: src/feat-1.ts)
    did: git commit: 11ede70
$ node $DEV/deliver-check.mjs feat --json   -> 1/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at 11ede70; git commit: 69f018f
$ node $DEV/deliver-check.mjs feat --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at 69f018f; git commit: f9f9683
$ node $DEV/deliver-check.mjs feat --json   -> 4/8, next: open-pr (no pull request yet)
    did: git push -u origin feat; gh pr create -> https://github.invalid/o/devkit/pull/11
$ node $DEV/deliver-check.mjs feat --json   -> 8/8, next: assign-release (the release of feat is not assigned yet; assign it before the merge)
```

```text
(in $CASES/p15c/main/.claude/worktrees/feat)
$ git fetch origin main
From $CASES/p15c/origin
 * branch            main       -> FETCH_HEAD
[exit 0]
```

```text
(in $CASES/p15c/main/.claude/worktrees/feat)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": true,
  "oldHead": "bb1d3d4e22dfb77757113b0ff5946e062c84cf62",
  "newHead": "5ce27ba5011c2242fc423e8a21666dd933c616e7",
  "versions": {
    "packs": {
      "devkit-openspec": "1.1.0"
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
      "to": "docs/adr/0002-feat.md"
    }
  ],
  "citations": [
    "docs/context.yaml"
  ],
  "mode": "assign"
}
[exit 0]
```

```text
(in $CASES/p15c/main/.claude/worktrees/feat)
$ git push origin feat
To $CASES/p15c/origin.git
   bb1d3d4..5ce27ba  feat -> feat
[exit 0]
```

`feat` took devkit-openspec 1.1.0 and ADR 0002. The base then lands another change by the old rule: devkit-openspec 1.1.0, `docs/adr/0002-other.md`, and its entry `ADR 0002 other` on the list:

```text
(in $CASES/p15c/main)
$ git push origin main
To $CASES/p15c/origin.git
   4bb3ce4..691da6c  main -> main
[exit 0]
```

```text
(in $CASES/p15c/main/.claude/worktrees/feat)
$ cat docs/context.yaml   # the branch
  ADRs: docs/adr/ (0001 start; ADR 0002 the rule)
[exit 0]
```

```text
(in $CASES/p15c/main/.claude/worktrees/feat)
$ git fetch origin main
From $CASES/p15c/origin
 * branch            main       -> FETCH_HEAD
[exit 0]
```

```text
(in $CASES/p15c/main/.claude/worktrees/feat)
$ git show origin/main:docs/context.yaml   # the base
  ADRs: docs/adr/ (0001 start; ADR 0002 other)
[exit 0]
```

The step meets the line both sides extended and exits 2 listing it, with no `error`:

```text
(in $CASES/p15c/main/.claude/worktrees/feat)
$ git fetch origin main
From $CASES/p15c/origin
 * branch            main       -> FETCH_HEAD
[exit 0]
```

```text
(in $CASES/p15c/main/.claude/worktrees/feat)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": false,
  "oldHead": "5ce27ba5011c2242fc423e8a21666dd933c616e7",
  "change": "feat",
  "conflicts": [
    "CHANGELOG.md",
    "docs/context.yaml"
  ],
  "mode": "assign"
}
[exit 2]
```

The merge by hand: the base's side of every release line, and the line written `; ADR 0002 other`:

```text
(in $CASES/p15c/main/.claude/worktrees/feat)
$ git merge --no-ff --no-commit origin/main
Auto-merging CHANGELOG.md
CONFLICT (content): Merge conflict in CHANGELOG.md
Auto-merging docs/context.yaml
CONFLICT (content): Merge conflict in docs/context.yaml
Automatic merge failed; fix conflicts and then commit the result.
[exit 1]
```

```text
(in $CASES/p15c/main/.claude/worktrees/feat)
$ git diff --name-only --diff-filter=U   # the files in conflict
CHANGELOG.md
docs/context.yaml
[exit 0]
```

```text
(in $CASES/p15c/main/.claude/worktrees/feat)
$ git checkout origin/main -- plugins/openspec/.claude-plugin/plugin.json plugins/core/.claude-plugin/plugin.json .claude-plugin/marketplace.json CHANGELOG.md docs/catalog.md docs/openspec-flow.md
(no output)
[exit 0]
```

```text
(in $CASES/p15c/main/.claude/worktrees/feat)
$ git add -A
(no output)
[exit 0]
```

```text
(in $CASES/p15c/main/.claude/worktrees/feat)
$ git commit -q --no-edit
(no output)
[exit 0]
```

```text
(in $CASES/p15c/main/.claude/worktrees/feat)
$ git show --stat '--format=%h %s%n%P' HEAD
4df9b85 Merge remote-tracking branch 'origin/main' into feat
5ce27ba5011c2242fc423e8a21666dd933c616e7 691da6c0b5a8eb3121e6dafc5483dda950815fdf

 CHANGELOG.md           | 4 ++--
 docs/adr/0002-other.md | 3 +++
 docs/context.yaml      | 2 +-
 3 files changed, 6 insertions(+), 3 deletions(-)
[exit 0]
```

```text
(in $CASES/p15c/main/.claude/worktrees/feat)
$ git fetch origin main
From $CASES/p15c/origin
 * branch            main       -> FETCH_HEAD
[exit 0]
```

```text
(in $CASES/p15c/main/.claude/worktrees/feat)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": false,
  "oldHead": "4df9b852e98414ed9caacf569652dc62462ff0af",
  "change": "feat",
  "conflicts": [],
  "error": "cannot give back the numbers the step wrote in docs/context.yaml",
  "mode": "assign"
}
release-merge: cannot give back the numbers the step wrote in docs/context.yaml
[exit 2]
```

```text
(in $CASES/p15c/main/.claude/worktrees/feat)
$ git status --short --branch   # the head and the tree as they were
## feat...origin/feat [ahead 2]
[exit 0]
```

```text
(in $CASES/p15c/main/.claude/worktrees/feat)
$ ls docs/adr
0001-start.md
0002-feat.md
0002-other.md
[exit 0]
```

## P-16 a started noted plan revised with its note goes back to the readiness review; the note alone asks the approval

AC-12, AC-16, AC-15 (review round 3, D-32, D-36). Project `p16` (the seed, merge mode). Changes `plan` and `twin` are `devkit` changes
with every plan stage passed, each approved by the owner with the readiness's hash, the plan's digest and the note's hash, and each
started (task 1.1 ticked, its code committed).

### `plan`: `design.md` and `release.md` revised

```text
(in $CASES/p16/main/.claude/worktrees/plan)
$ cat openspec/changes/plan/approval.md
<!-- devkit-stage approval result=passed attempt=1 commit=62a490d44a38c3edee3c95123623f41253aa8315 -->
# Plan approval: plan

- Status: APPROVED
- Readiness: sha256:30b5f6456c3e
- Plan: sha256:7a419f401178
- Release note: sha256:6d5a26cc71bf
- Date: 2026-11-26
- Owner's words: "`Aprovo`"
[exit 0]
```

```text
(in $CASES/p16/main/.claude/worktrees/plan)
$ git log --oneline -3
0045580 feat(plan): task 1.1
75b4528 docs(plan): the owner approves the plan
62a490d docs(plan): the plan of plan
[exit 0]
```

```text
(in $CASES/p16/main/.claude/worktrees/plan)
$ git commit -q -am 'docs(plan): revise the design and the note'
(no output)
[exit 0]
```

```text
(in $CASES/p16/main/.claude/worktrees/plan)
$ git show --stat '--format=%h %s' HEAD
3d8e578 docs(plan): revise the design and the note

 openspec/changes/plan/design.md  | 2 +-
 openspec/changes/plan/release.md | 2 +-
 2 files changed, 2 insertions(+), 2 deletions(-)
[exit 0]
```

```text
(in $CASES/p16/main/.claude/worktrees/plan)
$ node $DEV/flow-check.mjs plan --json   (its readiness stage and "next")
{
  "readiness": {
    "state": "stale",
    "reasonCode": "plan-revised"
  },
  "next": {
    "stage": "readiness",
    "reasonCode": "plan-revised"
  }
}
[exit 0]
```

The loop hands the readiness review (`plan-revised`):

```text
(in $CASES/p16/main/.claude/worktrees/plan)
$ node $DEV/change-loop.mjs next --change plan --lang en
devkit-run: plan
{
  "version": 1,
  "change": "plan",
  "script": "devkit",
  "root": "$CASES/p16/main/.claude/worktrees/plan",
  "branch": "plan",
  "filesLanguage": "en",
  "kind": "agent",
  "stage": "readiness",
  "stageTitle": "Plan readiness",
  "role": "plan-readiness-reviewer",
  "skills": [
    "plan-readiness-review"
  ],
  "model": "sonnet",
  "agent": "devkit-core:plan-readiness-reviewer",
  "brief": "Change plan (devkit script), stage readiness: readiness is out of date: bring it up to date. Work only in $CASES/p16/main/.claude/worktrees/plan on branch plan; every file path is absolute under it; start every Bash command with cd $CASES/p16/main/.claude/worktrees/plan && ; do not fetch. Write the change's files in English.",
  "progressKey": "readiness/readiness@7aa51b919eaf",
  "icon": "📝",
  "state": {
    "state": "running",
    "reason": null,
    "stage": "readiness",
    "stageTitle": "Plan readiness",
    "phase": null,
    "stageIcon": "📝",
    "stateIcon": null,
    "title": "📝 plan"
  },
  "sessionTitle": "📝 plan"
}
[exit 0]
```

The readiness review runs again and passes (written as the reviewer writes it):

```text
(in $CASES/p16/main/.claude/worktrees/plan)
$ git commit -q -am 'docs(plan): the readiness review, again'
(no output)
[exit 0]
```

The loop now waits for the owner's approval of both, with `readiness`, `plan` and `release`:

```text
(in $CASES/p16/main/.claude/worktrees/plan)
$ node $DEV/change-loop.mjs next --change plan --lang en
devkit-run: plan
devkit-end: plan waiting-for-owner
{
  "version": 1,
  "change": "plan",
  "script": "devkit",
  "root": "$CASES/p16/main/.claude/worktrees/plan",
  "branch": "plan",
  "filesLanguage": "en",
  "kind": "end",
  "stage": "implementation",
  "stageTitle": "Implementation",
  "role": "tdd-implementer",
  "skills": [
    "test-driven-development",
    "systematic-debugging"
  ],
  "model": "sonnet",
  "end": {
    "state": "waiting-for-owner",
    "why": "waiting-approval-again"
  },
  "params": {
    "id": "plan"
  },
  "detail": {
    "readiness": "sha256:c242bbaa6b05",
    "plan": "sha256:340de999d5d7",
    "release": "sha256:c803bb3f98da"
  },
  "reply": "The plan of plan changed after your approval, so it needs your approval again.",
  "baseFetch": {
    "ok": true,
    "base": "main"
  },
  "icon": "🛠️",
  "state": {
    "state": "waiting-for-owner",
    "reason": {
      "code": "waiting-approval-again",
      "text": "your approval of the plan"
    },
    "stage": "implementation",
    "stageTitle": "Implementation",
    "phase": null,
    "stageIcon": "🛠️",
    "stateIcon": "🙋",
    "title": "🙋 🛠️ plan"
  },
  "sessionTitle": "🙋 🛠️ plan"
}
[exit 1]
```

### `twin`: only `release.md` revised

```text
(in $CASES/p16/main/.claude/worktrees/twin)
$ cat openspec/changes/twin/approval.md
<!-- devkit-stage approval result=passed attempt=1 commit=0c24666e8cb212ba7a02cf026c8e0c5dd770bdee -->
# Plan approval: twin

- Status: APPROVED
- Readiness: sha256:20d9079f6a45
- Plan: sha256:5308ff94c882
- Release note: sha256:0ef41a0674e3
- Date: 2026-11-26
- Owner's words: "`Aprovo`"
[exit 0]
```

```text
(in $CASES/p16/main/.claude/worktrees/twin)
$ git log --oneline -3
81b4b33 feat(twin): task 1.1
09f8485 docs(twin): the owner approves the plan
0c24666 docs(twin): the plan of twin
[exit 0]
```

```text
(in $CASES/p16/main/.claude/worktrees/twin)
$ git commit -q -am 'docs(twin): revise the note'
(no output)
[exit 0]
```

```text
(in $CASES/p16/main/.claude/worktrees/twin)
$ node $DEV/flow-check.mjs twin --json   (its readiness stage and "next")
{
  "readiness": {
    "state": "passed",
    "reasonCode": "passed"
  },
  "next": {
    "stage": "implementation",
    "reasonCode": "tasks-pending"
  }
}
[exit 0]
```

The loop waits for the owner's approval directly (row A1), with no readiness review:

```text
(in $CASES/p16/main/.claude/worktrees/twin)
$ node $DEV/change-loop.mjs next --change twin --lang en
devkit-run: twin
devkit-end: twin waiting-for-owner
{
  "version": 1,
  "change": "twin",
  "script": "devkit",
  "root": "$CASES/p16/main/.claude/worktrees/twin",
  "branch": "twin",
  "filesLanguage": "en",
  "kind": "end",
  "stage": "implementation",
  "stageTitle": "Implementation",
  "role": "tdd-implementer",
  "skills": [
    "test-driven-development",
    "systematic-debugging"
  ],
  "model": "sonnet",
  "end": {
    "state": "waiting-for-owner",
    "why": "waiting-approval-again"
  },
  "params": {
    "id": "twin"
  },
  "detail": {
    "readiness": "sha256:20d9079f6a45",
    "plan": "sha256:5308ff94c882",
    "release": "sha256:aa8387c717d2"
  },
  "reply": "The plan of twin changed after your approval, so it needs your approval again.",
  "baseFetch": {
    "ok": true,
    "base": "main"
  },
  "icon": "🛠️",
  "state": {
    "state": "waiting-for-owner",
    "reason": {
      "code": "waiting-approval-again",
      "text": "your approval of the plan"
    },
    "stage": "implementation",
    "stageTitle": "Implementation",
    "phase": null,
    "stageIcon": "🛠️",
    "stateIcon": "🙋",
    "title": "🙋 🛠️ twin"
  },
  "sessionTitle": "🙋 🛠️ twin"
}
[exit 1]
```

