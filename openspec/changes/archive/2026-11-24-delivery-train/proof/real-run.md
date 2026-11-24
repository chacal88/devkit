# Real run of delivery-train (task 6.8, AC-12)

Written by the implementer. `pr-verifier` re-runs the four cases for its evidence and cites this file; it never writes it.

## How it was run

`delivery-train AC-12: the real run` in `plugins/openspec/hooks/delivery-train.test.mjs` builds, for each case, a fresh scratch
repository (a bare origin, a main checkout, one worktree per change and per archive) and then spawns the real command lines
the way the coordinating session does, each as its own process: `node change-loop.mjs start --lang en` with `train` on
standard input (the departure request, typed as the coordinating session sends it), then `node train-loop.mjs next --lang en
[--after <progressKey of the previous action>]` and, for each `session` action, the action's own `detail.command`
(`node train-loop.mjs depart`, `git -C <worktree> push origin train/<n>`, `gh pr create`, `gh pr merge ... --auto --merge
--match-head-commit <head>`, `gh pr close ... --comment ...`, `git worktree remove`, `git branch -d`). `gh` is the stub of
`simGitHub` (first on `PATH`, answering from a state file, logging every argument list). What GitHub does between two commands (it runs
the checks, it merges the train's pull request and marks some boarded pull requests merged) is the stub's, and the transcript
says so in a line that starts `The stub gh stands in for GitHub`.

The transcript below was produced by the test itself with `DEVKIT_REAL_RUN_FILE=<file>` set, in a scratch folder
`/var/tmp/devkit-delivery-train-real-run` used as `TMPDIR` for the whole run; the command was

```text
cd <worktree> && mkdir -p /var/tmp/devkit-delivery-train-real-run && TMPDIR=/var/tmp/devkit-delivery-train-real-run env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main DEVKIT_REAL_RUN_FILE=<file> node --test --test-name-pattern="AC-12: the real run" plugins/openspec/hooks/delivery-train.test.mjs
```

It exited 0 (`pass 1`, `fail 0`) and the scratch folder was empty when it ended; it was then removed. In the transcript `<repo>` is
the case's main checkout, `<origin>` its bare origin, `<scratch>` the departure's `TMPDIR`, `<hooks>` the hooks folder and
`<github-stub>` the stub's folder. Long outputs are cut at 3000 characters.

## The four cases

| Case | Model | Ends with |
|---|---|---|
| 1 | `trunk-auto` | the train's pull request merged by auto-merge (`gh pr merge <n> --auto --merge --match-head-commit <head>`), `beta`'s pull request and the archive's closed with the comment, `alpha` and `beta` at their retro, the archive of `gamma` archived |
| 2 | `trunk` | the train's pull request merged by the owner's step (`gh pr merge <n> --merge`), no `--auto` call on any pull request, `alpha` and `beta` at their retro |
| 3 | `trunk-auto` | `alpha` alone on the train after the bisection, merged by auto-merge; `beta` at `wait-train` while the train was open, then at `rejoin-train` with the failure attached |
| 4 | `trunk-auto` | `alpha` and the archive of `gamma` on the train, merged by auto-merge; `beta` at `rejoin-train` naming `src/shared.txt`; the archive of `delta` at `stop-archive` (`train-left`) naming `openspec/specs/change-coordination/spec.md` |

## What the real run found (fixed, each with a test that failed first)

- `train-loop.mjs next` gave the two `clean-train` steps of one merged train (the worktree, then the branch) the same
  `progressKey`, so a session that passes `--after <progressKey>` after every session action, as the skill says, was refused
  at the second step as "clean-train was done and changed nothing". The key now carries what the step removes
  (`clean-train@<n>:worktree`, `clean-train@<n>:branch`).
- `git branch -d train/<n>` was refused (`not fully merged`): the branch was cut from a commit, so it tracked nothing and git
  judged it against the main checkout's HEAD, which stays behind the base after a train merges on GitHub, and no call had
  fetched `origin` since the merge. The step came before the departure, so every later train would have stayed behind it. The
  departure now makes the branch track `origin/<base>`, `next` fetches `origin` before it gives the branch step and gives it
  only when git will accept the deletion (a train merged by a squash keeps its branch, never forced).
- A red leaver's `rejoin-train` carried `paths: ["beta"]`: the backticks of its detail ("Failure of `beta`, below") were read
  as a conflicting path. A red leaver now carries `paths: []`.

Not changed, for the plan's owner: the `detail` a departure attaches to an archive that leaves on a spec conflict lists the
roadmap file too (`openspec/roadmap.md`, `openspec/specs/change-coordination/spec.md`), because `release-merge.mjs --merge` reports every
unmerged path when it stops; the `stop-archive` row of case 4 names only the spec, after override 4 classified the roadmap
tick as resolvable.

## Case 1: two changes and the archive of a third board, the train merges by auto-merge

Model: `trunk-auto`.

Ends with: the train's pull request merged by auto-merge (`gh pr merge <n> --auto --merge --match-head-commit <head>`), `beta`'s pull request and the archive's closed with the comment, `alpha` and `beta` at their retro and the archive of `gamma` archived.

$ cd <repo> && node <hooks>/change-loop.mjs start --lang en   # standard input: "train"

exit code 0

```text
{
  "version": 1,
  "mode": "train",
  "verb": "train",
  "text": "",
  "change": null,
  "unfinished": [],
  "task": null,
  "settings": {
    "driver": "claude",
    "filesLanguage": "en",
    "personLanguage": "en"
  }
}
```

$ cd <repo> && node <hooks>/train-loop.mjs next --lang en

exit code 0

```text
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
        "kind": "archive",
        "id": "gamma",
        "number": 14
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
      "<hooks>/train-loop.mjs",
      "depart",
      "--lang",
      "en"
    ]
  },
  "reply": null,
  "progressKey": "depart@alpha,gamma,beta"
}
```

$ cd <repo> && node <hooks>/train-loop.mjs depart --lang en

exit code 0

```text
{
  "version": 1,
  "base": "main",
  "skipped": [],
  "n": 1,
  "branch": "train/1",
  "worktree": "<repo>/.claude/worktrees/train-1",
  "result": "passed",
  "boarded": [
    {
      "kind": "change",
      "id": "alpha",
      "number": 11,
      "head": "a14ff45ca71ef38ef040baa0b52fc77cc3509e6d",
      "at": "2026-11-23T10:00:00Z"
    },
    {
      "kind": "archive",
      "id": "gamma",
      "number": 14,
      "head": "41d608942fdbc9755e67b929a1a4f51b6058dad6",
      "at": "2026-11-23T10:05:00Z"
    },
    {
      "kind": "change",
      "id": "beta",
      "number": 12,
      "head": "da7470feb26733a1dce3a89416aa8379c30bcb2a",
      "at": "2026-11-23T10:10:00Z"
    }
  ],
  "left": [],
  "runs": 1
}
```

$ cd <repo> && node <hooks>/train-loop.mjs next --lang en --after depart@alpha,gamma,beta

exit code 0

```text
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
      "<repo>/.claude/worktrees/train-1",
      "push",
      "origin",
      "train/1"
    ]
  },
  "reply": null,
  "progressKey": "push-train@1"
}
```

$ cd <repo> && git -C <repo>/.claude/worktrees/train-1 push origin train/1

exit code 0

stderr:

```text
To <origin>
 * [new branch]      train/1 -> train/1
```

$ cd <repo> && node <hooks>/train-loop.mjs next --lang en --after push-train@1

exit code 0

```text
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
      "train 1: alpha, gamma, beta",
      "--body-file",
      "<repo>/.claude/worktrees/train-1/openspec/trains/1.md"
    ]
  },
  "reply": null,
  "progressKey": "open-train-pr@1"
}
```

$ cd <repo> && gh pr create --base main --head train/1 --title train 1: alpha, gamma, beta --body-file <repo>/.claude/worktrees/train-1/openspec/trains/1.md

exit code 0

```text
https://github.com/o/r/pull/15
```

> The stub `gh` stands in for GitHub: the checks of the train's pull request pass (`check`, `devkit-reviews`)

$ cd <repo> && node <hooks>/train-loop.mjs next --lang en --after open-train-pr@1

exit code 0

```text
{
  "version": 1,
  "kind": "session",
  "step": "enable-auto-merge",
  "detail": {
    "n": 1,
    "number": 15,
    "head": "14f5c845dba262eac227f0af54161a4abcccbb51",
    "command": [
      "gh",
      "pr",
      "merge",
      "15",
      "--auto",
      "--merge",
      "--match-head-commit",
      "14f5c845dba262eac227f0af54161a4abcccbb51"
    ]
  },
  "reply": null,
  "progressKey": "enable-auto-merge@15"
}
```

$ cd <repo> && gh pr merge 15 --auto --merge --match-head-commit 14f5c845dba262eac227f0af54161a4abcccbb51

exit code 0

$ cd <repo> && node <hooks>/train-loop.mjs next --lang en --after enable-auto-merge@15

exit code 1

```text
{
  "version": 1,
  "kind": "end",
  "step": "train-auto-merge-on",
  "detail": {
    "n": 1,
    "number": 15
  },
  "reply": "Auto-merge is on for pull request #15 of train 1: GitHub merges it once its checks pass.",
  "end": {
    "state": "waiting-on-github",
    "why": "train-auto-merge-on"
  },
  "progressKey": "train-auto-merge-on@15"
}
```

> The stub `gh` stands in for GitHub: pull requests #11, #15 are merged (the train's with a merge commit, 1 of the boarded ones marked merged); the other boarded pull requests stay open

$ cd <repo> && node <hooks>/train-loop.mjs next --lang en

exit code 0

```text
{
  "version": 1,
  "kind": "session",
  "step": "close-boarded-pr",
  "detail": {
    "number": 14,
    "train": 1,
    "trainNumber": 15,
    "comment": "Delivered by train 1 in #15 (merge commit 2858f20).",
    "command": [
      "gh",
      "pr",
      "close",
      "14",
      "--comment",
      "Delivered by train 1 in #15 (merge commit 2858f20)."
    ]
  },
  "reply": "Train 1 merged in pull request #15: its changes are delivered, and what it left behind is tidied now.",
  "progressKey": "close-boarded-pr@14"
}
```

$ cd <repo> && gh pr close 14 --comment Delivered by train 1 in #15 (merge commit 2858f20).

exit code 0

$ cd <repo> && node <hooks>/train-loop.mjs next --lang en --after close-boarded-pr@14

exit code 0

```text
{
  "version": 1,
  "kind": "session",
  "step": "close-boarded-pr",
  "detail": {
    "number": 12,
    "train": 1,
    "trainNumber": 15,
    "comment": "Delivered by train 1 in #15 (merge commit 2858f20).",
    "command": [
      "gh",
      "pr",
      "close",
      "12",
      "--comment",
      "Delivered by train 1 in #15 (merge commit 2858f20)."
    ]
  },
  "reply": "Train 1 merged in pull request #15: its changes are delivered, and what it left behind is tidied now.",
  "progressKey": "close-boarded-pr@12"
}
```

$ cd <repo> && gh pr close 12 --comment Delivered by train 1 in #15 (merge commit 2858f20).

exit code 0

$ cd <repo> && node <hooks>/train-loop.mjs next --lang en --after close-boarded-pr@12

exit code 0

```text
{
  "version": 1,
  "kind": "session",
  "step": "clean-train",
  "detail": {
    "n": 1,
    "number": 15,
    "what": "worktree",
    "worktree": "<repo>/.claude/worktrees/train-1",
    "command": [
      "git",
      "-C",
      "<repo>",
      "worktree",
      "remove",
      "<repo>/.claude/worktrees/train-1"
    ]
  },
  "reply": "Train 1 merged in pull request #15: its changes are delivered, and what it left behind is tidied now.",
  "progressKey": "clean-train@15:worktree"
}
```

$ cd <repo> && git -C <repo> worktree remove <repo>/.claude/worktrees/train-1

exit code 0

$ cd <repo> && node <hooks>/train-loop.mjs next --lang en --after clean-train@15:worktree

exit code 0

```text
{
  "version": 1,
  "kind": "session",
  "step": "clean-train",
  "detail": {
    "n": 1,
    "number": 15,
    "what": "branch",
    "command": [
      "git",
      "-C",
      "<repo>",
      "branch",
      "-d",
      "train/1"
    ]
  },
  "reply": "Train 1 merged in pull request #15: its changes are delivered, and what it left behind is tidied now.",
  "progressKey": "clean-train@15:branch"
}
```

$ cd <repo> && git -C <repo> branch -d train/1

exit code 0

```text
Deleted branch train/1 (was 14f5c84).
```

stderr:

```text
warning: deleting branch 'train/1' that has been merged to
         'refs/remotes/origin/main', but not yet merged to HEAD
```

$ cd <repo> && node <hooks>/train-loop.mjs next --lang en --after clean-train@15:branch

exit code 1

```text
{
  "version": 1,
  "kind": "end",
  "step": "train-nothing",
  "detail": {
    "skipped": []
  },
  "reply": "Nothing is boarded: no change or archive is waiting for a train. Nothing was created.",
  "end": {
    "state": "waiting-for-owner",
    "why": "train-nothing"
  },
  "progressKey": "train-nothing@"
}
```

$ cd <repo>/.claude/worktrees/alpha && node <hooks>/deliver-check.mjs alpha --json

exit code 0

```text
{
  "version": 1,
  "change": "alpha",
  "schema": "devkit-lite",
  "ship": "merge",
  "host": "app",
  "head": "a14ff45ca71ef38ef040baa0b52fc77cc3509e6d",
  "pr": {
    "number": 11,
    "url": "https://github.com/o/r/pull/11"
  },
  "phases": [],
  "items": [
    {
      "id": 1,
      "name": "tasks",
      "status": "met",
      "reason": "checked before PR #11 merged",
      "details": {
        "unticked": [],
        "missingGates": [],
        "evidence": "current"
      }
    },
    {
      "id": 2,
      "name": "reviews",
      "status": "met",
      "reason": "checked before PR #11 merged",
      "details": {
        "stale": [],
        "rejected": [],
        "missing": []
      }
    },
    {
      "id": 3,
      "name": "findings",
      "status": "met",
      "reason": "checked before PR #11 merged",
      "details": {
        "fixed": 0,
        "refuted": 0,
        "undisposed": []
      }
    },
    {
      "id": 4,
      "name": "acceptance",
      "status": "met",
      "reason": "checked before PR #11 merged",
      "details": {
        "ids": [],
        "proven": [],
        "missing": [],
        "defects": [],
        "noProof": [],
        "evidence": "current"
      }
    },
    {
      "id": 5,
      "name": "pr",
      "status": "met",
      "reason": "PR #11 merged",
      "details": {
        "pr": {
          "number": 11,
          "url": "https://github.com/o/r/pull/11"
        },
        "merged": true
      }
    },
    {
      "id": 6,
      "name": "checks",
      "status": "met",
      "reason": "checked before PR #11 merged",
      "details": {
        "required": false,
        "failing": [],
        "pending": []
      }
    },
    {
      "id": 7,
      "name": "conversation",
      "status": "met",
      "reason": "checked before PR #11 merged",
      "details": {
        "threads": [],
        "comments": [],
        "changesRequested": [],
        "waiting": []
      }
    },
    {
      "id": 8,
      "name": "body",
      "status": "met",
      "reason": "checked before PR #11 merged",
      "details": {
        "missing": []
      }
    }
  ],
  "met": 8,
  "summary": "merged: archive step retro",
  "next": {
    "step": "retro",
    "reason": "the change PR is merged; run the retro",
    "number": 11,
    "base": "main"
  },
  "merge": {
    "method": "squash",
    "setup": {
      "ok": true,
      "missing": []
    },
    "autoMerge": false,
    "state": "MERGED",
    "mergeStateStatus": "CLEAN",
    "waitingFor": null
  },
  "archive": {
    "base": "main",
    "branch": "chore/archive-alpha",
    "changePr": {
      "number": 11,
      "url": "https://github.com/o/r/pull/11"
    },
    "onDefault": "active",
    "folder": null,
    "local": "active",
    "retro": {
      "exists": false,
      "readable": false,
      "proposals": []
    },
    "roadmap": {
      "listed": false,
      "ticked": false
    },
    "pr": null,
    "waitingFor": null
  }
}
```

$ cd <repo>/.claude/worktrees/beta && node <hooks>/deliver-check.mjs beta --json

exit code 0

```text
{
  "version": 1,
  "change": "beta",
  "schema": "devkit-lite",
  "ship": "merge",
  "host": "app",
  "head": "da7470feb26733a1dce3a89416aa8379c30bcb2a",
  "pr": {
    "number": 12,
    "url": "https://github.com/o/r/pull/12"
  },
  "phases": [],
  "items": [
    {
      "id": 1,
      "name": "tasks",
      "status": "met",
      "reason": "checked before PR #12 merged",
      "details": {
        "unticked": [],
        "missingGates": [],
        "evidence": "current"
      }
    },
    {
      "id": 2,
      "name": "reviews",
      "status": "met",
      "reason": "checked before PR #12 merged",
      "details": {
        "stale": [],
        "rejected": [],
        "missing": []
      }
    },
    {
      "id": 3,
      "name": "findings",
      "status": "met",
      "reason": "checked before PR #12 merged",
      "details": {
        "fixed": 0,
        "refuted": 0,
        "undisposed": []
      }
    },
    {
      "id": 4,
      "name": "acceptance",
      "status": "met",
      "reason": "checked before PR #12 merged",
      "details": {
        "ids": [],
        "proven": [],
        "missing": [],
        "defects": [],
        "noProof": [],
        "evidence": "current"
      }
    },
    {
      "id": 5,
      "name": "pr",
      "status": "met",
      "reason": "PR #12 merged",
      "details": {
        "pr": {
          "number": 12,
          "url": "https://github.com/o/r/pull/12"
        },
        "merged": true
      }
    },
    {
      "id": 6,
      "name": "checks",
      "status": "met",
      "reason": "checked before PR #12 merged",
      "details": {
        "required": false,
        "failing": [],
        "pending": []
      }
    },
    {
      "id": 7,
      "name": "conversation",
      "status": "met",
      "reason": "checked before PR #12 merged",
      "details": {
        "threads": [],
        "comments": [],
        "changesRequested": [],
        "waiting": []
      }
    },
    {
      "id": 8,
      "name": "body",
      "status": "met",
      "reason": "checked before PR #12 merged",
      "details": {
        "missing": []
      }
    }
  ],
  "met": 8,
  "summary": "merged: archive step retro",
  "next": {
    "step": "retro",
    "reason": "the change PR is merged; run the retro",
    "number": 12,
    "base": "main"
  },
  "merge": {
    "method": "squash",
    "setup": {
      "ok": true,
      "missing": []
    },
    "autoMerge": false,
    "state": "CLOSED",
    "mergeStateStatus": "CLEAN",
    "waitingFor": null
  },
  "archive": {
    "base": "main",
    "branch": "chore/archive-beta",
    "changePr": {
      "number": 12,
      "url": "https://github.com/o/r/pull/12"
    },
    "onDefault": "active",
    "folder": null,
    "local": "active",
    "retro": {
      "exists": false,
      "readable": false,
      "proposals": []
    },
    "roadmap": {
      "listed": false,
      "ticked": false
    },
    "pr": null,
    "waitingFor": null
  }
}
```

$ cd <repo>/.claude/worktrees/archive-gamma && node <hooks>/deliver-check.mjs gamma --json

exit code 0

```text
{
  "version": 1,
  "change": "gamma",
  "schema": "devkit-lite",
  "ship": "merge",
  "host": "app",
  "head": "41d608942fdbc9755e67b929a1a4f51b6058dad6",
  "pr": {
    "number": 13,
    "url": "https://github.com/o/r/pull/13"
  },
  "phases": [],
  "items": [
    {
      "id": 1,
      "name": "tasks",
      "status": "met",
      "reason": "checked before PR #13 merged",
      "details": {
        "unticked": [],
        "missingGates": [],
        "evidence": "current"
      }
    },
    {
      "id": 2,
      "name": "reviews",
      "status": "met",
      "reason": "checked before PR #13 merged",
      "details": {
        "stale": [],
        "rejected": [],
        "missing": []
      }
    },
    {
      "id": 3,
      "name": "findings",
      "status": "met",
      "reason": "checked before PR #13 merged",
      "details": {
        "fixed": 0,
        "refuted": 0,
        "undisposed": []
      }
    },
    {
      "id": 4,
      "name": "acceptance",
      "status": "met",
      "reason": "checked before PR #13 merged",
      "details": {
        "ids": [],
        "proven": [],
        "missing": [],
        "defects": [],
        "noProof": [],
        "evidence": "current"
      }
    },
    {
      "id": 5,
      "name": "pr",
      "status": "met",
      "reason": "PR #13 merged",
      "details": {
        "pr": {
          "number": 13,
          "url": "https://github.com/o/r/pull/13"
        },
        "merged": true
      }
    },
    {
      "id": 6,
      "name": "checks",
      "status": "met",
      "reason": "checked before PR #13 merged",
      "details": {
        "required": false,
        "failing": [],
        "pending": []
      }
    },
    {
      "id": 7,
      "name": "conversation",
      "status": "met",
      "reason": "checked before PR #13 merged",
      "details": {
        "threads": [],
        "comments": [],
        "changesRequested": [],
        "waiting": []
      }
    },
    {
      "id": 8,
      "name": "body",
      "status": "met",
      "reason": "checked before PR #13 merged",
      "details": {
        "missing": []
      }
    }
  ],
  "met": 8,
  "summary": "archived",
  "next": {
    "step": "archived",
    "reason": "2026-11-23-gamma is on main",
    "folder": "2026-11-23-gamma"
  },
  "merge": {
    "method": "squash",
    "setup": {
      "ok": true,
      "missing": []
    },
    "autoMerge": false,
    "state": "MERGED",
    "mergeStateStatus": "CLEAN",
    "waitingFor": null
  },
  "archive": {
    "base": "main",
    "branch": "chore/archive-gamma",
    "changePr": {
      "number": 13,
      "url": "https://github.com/o/r/pull/13"
    },
    "onDefault": "archived",
    "folder": "2026-11-23-gamma",
    "local": "archived",
    "retro": {
      "exists": true,
      "readable": true,
      "proposals": []
    },
    "roadmap": {
      "listed": true,
      "ticked": true
    },
    "pr": null,
    "waitingFor": null
  }
}
```

## Case 2: two changes board, the owner merges the train

Model: `trunk`.

Ends with: the train's pull request merged by the owner's step (`gh pr merge <n> --merge`), no `--auto` call on any pull request, `alpha` and `beta` at their retro.

$ cd <repo> && node <hooks>/change-loop.mjs start --lang en   # standard input: "train"

exit code 0

```text
{
  "version": 1,
  "mode": "train",
  "verb": "train",
  "text": "",
  "change": null,
  "unfinished": [],
  "task": null,
  "settings": {
    "driver": "claude",
    "filesLanguage": "en",
    "personLanguage": "en"
  }
}
```

$ cd <repo> && node <hooks>/train-loop.mjs next --lang en

exit code 0

```text
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
      "<hooks>/train-loop.mjs",
      "depart",
      "--lang",
      "en"
    ]
  },
  "reply": null,
  "progressKey": "depart@alpha,beta"
}
```

$ cd <repo> && node <hooks>/train-loop.mjs depart --lang en

exit code 0

```text
{
  "version": 1,
  "base": "main",
  "skipped": [],
  "n": 1,
  "branch": "train/1",
  "worktree": "<repo>/.claude/worktrees/train-1",
  "result": "passed",
  "boarded": [
    {
      "kind": "change",
      "id": "alpha",
      "number": 11,
      "head": "37f659df2e39fe2bf36a99906fbff060dbbc3cf7",
      "at": "2026-11-23T10:00:00Z"
    },
    {
      "kind": "change",
      "id": "beta",
      "number": 12,
      "head": "cb7858a92ab373dbe4c45714fb9bcc79fa522456",
      "at": "2026-11-23T10:10:00Z"
    }
  ],
  "left": [],
  "runs": 1
}
```

$ cd <repo> && node <hooks>/train-loop.mjs next --lang en --after depart@alpha,beta

exit code 0

```text
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
      "<repo>/.claude/worktrees/train-1",
      "push",
      "origin",
      "train/1"
    ]
  },
  "reply": null,
  "progressKey": "push-train@1"
}
```

$ cd <repo> && git -C <repo>/.claude/worktrees/train-1 push origin train/1

exit code 0

stderr:

```text
To <origin>
 * [new branch]      train/1 -> train/1
```

$ cd <repo> && node <hooks>/train-loop.mjs next --lang en --after push-train@1

exit code 0

```text
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
      "<repo>/.claude/worktrees/train-1/openspec/trains/1.md"
    ]
  },
  "reply": null,
  "progressKey": "open-train-pr@1"
}
```

$ cd <repo> && gh pr create --base main --head train/1 --title train 1: alpha, beta --body-file <repo>/.claude/worktrees/train-1/openspec/trains/1.md

exit code 0

```text
https://github.com/o/r/pull/13
```

> The stub `gh` stands in for GitHub: the checks of the train's pull request are running (`check` pending)

$ cd <repo> && node <hooks>/train-loop.mjs next --lang en --after open-train-pr@1

exit code 1

```text
{
  "version": 1,
  "kind": "end",
  "step": "train-checks",
  "detail": {
    "n": 1,
    "number": 13
  },
  "reply": "Train 1 (pull request #13) is waiting on GitHub for its checks. I keep waiting and go on by myself when they finish.",
  "end": {
    "state": "waiting-on-github",
    "why": "train-checks"
  },
  "progressKey": "train-checks@13"
}
```

> The stub `gh` stands in for GitHub: the checks of the train's pull request pass (`check`, `devkit-reviews`)

$ cd <repo> && node <hooks>/train-loop.mjs next --lang en

exit code 1

```text
{
  "version": 1,
  "kind": "end",
  "step": "train-ready",
  "detail": {
    "n": 1,
    "number": 13
  },
  "reply": "Pull request #13 of train 1 is ready: in this project, merging it is up to you, with a merge commit.",
  "end": {
    "state": "waiting-for-owner",
    "why": "train-ready"
  },
  "progressKey": "train-ready@13"
}
```

> The stub `gh` stands in for GitHub: pull request #11 is marked merged; #12 stays open

$ cd <repo> && gh pr merge 13 --merge

exit code 0

$ cd <repo> && node <hooks>/train-loop.mjs next --lang en

exit code 0

```text
{
  "version": 1,
  "kind": "session",
  "step": "close-boarded-pr",
  "detail": {
    "number": 12,
    "train": 1,
    "trainNumber": 13,
    "comment": "Delivered by train 1 in #13 (merge commit d59b4e5).",
    "command": [
      "gh",
      "pr",
      "close",
      "12",
      "--comment",
      "Delivered by train 1 in #13 (merge commit d59b4e5)."
    ]
  },
  "reply": "Train 1 merged in pull request #13: its changes are delivered, and what it left behind is tidied now.",
  "progressKey": "close-boarded-pr@12"
}
```

$ cd <repo> && gh pr close 12 --comment Delivered by train 1 in #13 (merge commit d59b4e5).

exit code 0

$ cd <repo> && node <hooks>/train-loop.mjs next --lang en --after close-boarded-pr@12

exit code 0

```text
{
  "version": 1,
  "kind": "session",
  "step": "clean-train",
  "detail": {
    "n": 1,
    "number": 13,
    "what": "worktree",
    "worktree": "<repo>/.claude/worktrees/train-1",
    "command": [
      "git",
      "-C",
      "<repo>",
      "worktree",
      "remove",
      "<repo>/.claude/worktrees/train-1"
    ]
  },
  "reply": "Train 1 merged in pull request #13: its changes are delivered, and what it left behind is tidied now.",
  "progressKey": "clean-train@13:worktree"
}
```

$ cd <repo> && git -C <repo> worktree remove <repo>/.claude/worktrees/train-1

exit code 0

$ cd <repo> && node <hooks>/train-loop.mjs next --lang en --after clean-train@13:worktree

exit code 0

```text
{
  "version": 1,
  "kind": "session",
  "step": "clean-train",
  "detail": {
    "n": 1,
    "number": 13,
    "what": "branch",
    "command": [
      "git",
      "-C",
      "<repo>",
      "branch",
      "-d",
      "train/1"
    ]
  },
  "reply": "Train 1 merged in pull request #13: its changes are delivered, and what it left behind is tidied now.",
  "progressKey": "clean-train@13:branch"
}
```

$ cd <repo> && git -C <repo> branch -d train/1

exit code 0

```text
Deleted branch train/1 (was 4ad5c3f).
```

stderr:

```text
warning: deleting branch 'train/1' that has been merged to
         'refs/remotes/origin/main', but not yet merged to HEAD
```

$ cd <repo> && node <hooks>/train-loop.mjs next --lang en --after clean-train@13:branch

exit code 1

```text
{
  "version": 1,
  "kind": "end",
  "step": "train-nothing",
  "detail": {
    "skipped": []
  },
  "reply": "Nothing is boarded: no change or archive is waiting for a train. Nothing was created.",
  "end": {
    "state": "waiting-for-owner",
    "why": "train-nothing"
  },
  "progressKey": "train-nothing@"
}
```

$ cd <repo>/.claude/worktrees/alpha && node <hooks>/deliver-check.mjs alpha --json

exit code 0

```text
{
  "version": 1,
  "change": "alpha",
  "schema": "devkit-lite",
  "ship": "pr",
  "host": "app",
  "head": "37f659df2e39fe2bf36a99906fbff060dbbc3cf7",
  "pr": {
    "number": 11,
    "url": "https://github.com/o/r/pull/11"
  },
  "phases": [],
  "items": [
    {
      "id": 1,
      "name": "tasks",
      "status": "met",
      "reason": "checked before PR #11 merged",
      "details": {
        "unticked": [],
        "missingGates": [],
        "evidence": "current"
      }
    },
    {
      "id": 2,
      "name": "reviews",
      "status": "met",
      "reason": "checked before PR #11 merged",
      "details": {
        "stale": [],
        "rejected": [],
        "missing": []
      }
    },
    {
      "id": 3,
      "name": "findings",
      "status": "met",
      "reason": "checked before PR #11 merged",
      "details": {
        "fixed": 0,
        "refuted": 0,
        "undisposed": []
      }
    },
    {
      "id": 4,
      "name": "acceptance",
      "status": "met",
      "reason": "checked before PR #11 merged",
      "details": {
        "ids": [],
        "proven": [],
        "missing": [],
        "defects": [],
        "noProof": [],
        "evidence": "current"
      }
    },
    {
      "id": 5,
      "name": "pr",
      "status": "met",
      "reason": "PR #11 merged",
      "details": {
        "pr": {
          "number": 11,
          "url": "https://github.com/o/r/pull/11"
        },
        "merged": true
      }
    },
    {
      "id": 6,
      "name": "checks",
      "status": "met",
      "reason": "checked before PR #11 merged",
      "details": {
        "required": false,
        "failing": [],
        "pending": []
      }
    },
    {
      "id": 7,
      "name": "conversation",
      "status": "met",
      "reason": "checked before PR #11 merged",
      "details": {
        "threads": [],
        "comments": [],
        "changesRequested": [],
        "waiting": []
      }
    },
    {
      "id": 8,
      "name": "body",
      "status": "met",
      "reason": "checked before PR #11 merged",
      "details": {
        "missing": []
      }
    }
  ],
  "met": 8,
  "summary": "merged: archive step retro",
  "next": {
    "step": "retro",
    "reason": "the change PR is merged; run the retro",
    "number": 11,
    "base": "main"
  },
  "archive": {
    "base": "main",
    "branch": "chore/archive-alpha",
    "changePr": {
      "number": 11,
      "url": "https://github.com/o/r/pull/11"
    },
    "onDefault": "active",
    "folder": null,
    "local": "active",
    "retro": {
      "exists": false,
      "readable": false,
      "proposals": []
    },
    "roadmap": {
      "listed": false,
      "ticked": false
    },
    "pr": null,
    "waitingFor": null
  }
}
```

$ cd <repo>/.claude/worktrees/beta && node <hooks>/deliver-check.mjs beta --json

exit code 0

```text
{
  "version": 1,
  "change": "beta",
  "schema": "devkit-lite",
  "ship": "pr",
  "host": "app",
  "head": "cb7858a92ab373dbe4c45714fb9bcc79fa522456",
  "pr": {
    "number": 12,
    "url": "https://github.com/o/r/pull/12"
  },
  "phases": [],
  "items": [
    {
      "id": 1,
      "name": "tasks",
      "status": "met",
      "reason": "checked before PR #12 merged",
      "details": {
        "unticked": [],
        "missingGates": [],
        "evidence": "current"
      }
    },
    {
      "id": 2,
      "name": "reviews",
      "status": "met",
      "reason": "checked before PR #12 merged",
      "details": {
        "stale": [],
        "rejected": [],
        "missing": []
      }
    },
    {
      "id": 3,
      "name": "findings",
      "status": "met",
      "reason": "checked before PR #12 merged",
      "details": {
        "fixed": 0,
        "refuted": 0,
        "undisposed": []
      }
    },
    {
      "id": 4,
      "name": "acceptance",
      "status": "met",
      "reason": "checked before PR #12 merged",
      "details": {
        "ids": [],
        "proven": [],
        "missing": [],
        "defects": [],
        "noProof": [],
        "evidence": "current"
      }
    },
    {
      "id": 5,
      "name": "pr",
      "status": "met",
      "reason": "PR #12 merged",
      "details": {
        "pr": {
          "number": 12,
          "url": "https://github.com/o/r/pull/12"
        },
        "merged": true
      }
    },
    {
      "id": 6,
      "name": "checks",
      "status": "met",
      "reason": "checked before PR #12 merged",
      "details": {
        "required": false,
        "failing": [],
        "pending": []
      }
    },
    {
      "id": 7,
      "name": "conversation",
      "status": "met",
      "reason": "checked before PR #12 merged",
      "details": {
        "threads": [],
        "comments": [],
        "changesRequested": [],
        "waiting": []
      }
    },
    {
      "id": 8,
      "name": "body",
      "status": "met",
      "reason": "checked before PR #12 merged",
      "details": {
        "missing": []
      }
    }
  ],
  "met": 8,
  "summary": "merged: archive step retro",
  "next": {
    "step": "retro",
    "reason": "the change PR is merged; run the retro",
    "number": 12,
    "base": "main"
  },
  "archive": {
    "base": "main",
    "branch": "chore/archive-beta",
    "changePr": {
      "number": 12,
      "url": "https://github.com/o/r/pull/12"
    },
    "onDefault": "active",
    "folder": null,
    "local": "active",
    "retro": {
      "exists": false,
      "readable": false,
      "proposals": []
    },
    "roadmap": {
      "listed": false,
      "ticked": false
    },
    "pr": null,
    "waitingFor": null
  }
}
```

## Case 3: two changes pass alone and fail together, the later one leaves red

Model: `trunk-auto`.

Ends with: the train (`alpha` alone) merged by auto-merge after the bisection; `beta` at `wait-train` while the train was open and at `rejoin-train`, with the failure attached, once it merged.

$ cd <repo> && node <hooks>/change-loop.mjs start --lang en   # standard input: "train"

exit code 0

```text
{
  "version": 1,
  "mode": "train",
  "verb": "train",
  "text": "",
  "change": null,
  "unfinished": [],
  "task": null,
  "settings": {
    "driver": "claude",
    "filesLanguage": "en",
    "personLanguage": "en"
  }
}
```

$ cd <repo> && node <hooks>/train-loop.mjs next --lang en

exit code 0

```text
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
      "<hooks>/train-loop.mjs",
      "depart",
      "--lang",
      "en"
    ]
  },
  "reply": null,
  "progressKey": "depart@alpha,beta"
}
```

$ cd <repo> && node <hooks>/train-loop.mjs depart --lang en

exit code 0

```text
{
  "version": 1,
  "base": "main",
  "skipped": [],
  "n": 1,
  "branch": "train/1",
  "worktree": "<repo>/.claude/worktrees/train-1",
  "result": "passed",
  "boarded": [
    {
      "kind": "change",
      "id": "alpha",
      "number": 11,
      "head": "8f607a7d163ef4199a7f9af6652c4fd80ab62952",
      "at": "2026-11-23T10:00:00Z"
    }
  ],
  "left": [
    {
      "kind": "change",
      "id": "beta",
      "number": 12,
      "why": "red",
      "detail": "Failure of `beta`, below"
    }
  ],
  "runs": 3
}
```

$ cd <repo> && node <hooks>/train-loop.mjs next --lang en --after depart@alpha,beta

exit code 0

```text
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
      "<repo>/.claude/worktrees/train-1",
      "push",
      "origin",
      "train/1"
    ]
  },
  "reply": null,
  "progressKey": "push-train@1"
}
```

$ cd <repo> && git -C <repo>/.claude/worktrees/train-1 push origin train/1

exit code 0

stderr:

```text
To <origin>
 * [new branch]      train/1 -> train/1
```

$ cd <repo> && node <hooks>/train-loop.mjs next --lang en --after push-train@1

exit code 0

```text
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
      "train 1: alpha",
      "--body-file",
      "<repo>/.claude/worktrees/train-1/openspec/trains/1.md"
    ]
  },
  "reply": null,
  "progressKey": "open-train-pr@1"
}
```

$ cd <repo> && gh pr create --base main --head train/1 --title train 1: alpha --body-file <repo>/.claude/worktrees/train-1/openspec/trains/1.md

exit code 0

```text
https://github.com/o/r/pull/13
```

> The stub `gh` stands in for GitHub: the checks of the train's pull request pass (`check`, `devkit-reviews`)

$ cd <repo> && node <hooks>/train-loop.mjs next --lang en --after open-train-pr@1

exit code 0

```text
{
  "version": 1,
  "kind": "session",
  "step": "enable-auto-merge",
  "detail": {
    "n": 1,
    "number": 13,
    "head": "91cccc69af80febcb4757443c7748c34fc17f535",
    "command": [
      "gh",
      "pr",
      "merge",
      "13",
      "--auto",
      "--merge",
      "--match-head-commit",
      "91cccc69af80febcb4757443c7748c34fc17f535"
    ]
  },
  "reply": null,
  "progressKey": "enable-auto-merge@13"
}
```

$ cd <repo> && gh pr merge 13 --auto --merge --match-head-commit 91cccc69af80febcb4757443c7748c34fc17f535

exit code 0

$ cd <repo> && node <hooks>/train-loop.mjs next --lang en --after enable-auto-merge@13

exit code 1

```text
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
```

$ cd <repo>/.claude/worktrees/beta && node <hooks>/deliver-check.mjs beta --json

exit code 1

```text
{
  "version": 1,
  "change": "beta",
  "schema": "devkit-lite",
  "ship": "merge",
  "host": "app",
  "head": "fbeeae79ef021efa1ef925fd87068ba2e76acfb5",
  "pr": {
    "number": 12,
    "url": "https://github.com/o/r/pull/12"
  },
  "phases": [
    {
      "n": 1,
      "title": "Phase",
      "open": [],
      "gate": null
    }
  ],
  "items": [
    {
      "id": 1,
      "name": "tasks",
      "status": "met",
      "reason": "all tasks ticked",
      "details": {
        "unticked": [],
        "missingGates": [],
        "evidence": "current",
        "trainParts": []
      }
    },
    {
      "id": 2,
      "name": "reviews",
      "status": "met",
      "reason": "2 reviews at head",
      "details": {
        "stale": [],
        "rejected": [],
        "missing": []
      }
    },
    {
      "id": 3,
      "name": "findings",
      "status": "met",
      "reason": "0 fixed, 0 refuted",
      "details": {
        "fixed": 0,
        "refuted": 0,
        "undisposed": []
      }
    },
    {
      "id": 4,
      "name": "acceptance",
      "status": "met",
      "reason": "1 criteria proven",
      "details": {
        "ids": [
          "AC-1"
        ],
        "proven": [
          "AC-1"
        ],
        "missing": [],
        "defects": [],
        "noProof": [],
        "evidence": "current"
      }
    },
    {
      "id": 5,
      "name": "pr",
      "status": "met",
      "reason": "PR #12 open at fbeeae7",
      "details": {
        "pr": {
          "number": 12,
          "url": "https://github.com/o/r/pull/12"
        },
        "ahead": false,
        "uncommitted": [],
        "behind": false
      }
    },
    {
      "id": 6,
      "name": "checks",
      "status": "met",
      "reason": "2 required checks green",
      "details": {
        "required": true,
        "failing": [],
        "pending": []
      }
    },
    {
      "id": 7,
      "name": "conversation",
      "status": "met",
      "reason": "every thread and request is answered",
      "details": {
        "threads": [],
        "comments": [],
        "changesRequested": [],
        "waiting": []
      }
    },
    {
      "id": 8,
      "name": "body",
      "status": "met",
      "reason": "PR body names the change, its criteria and the evidence",
      "details": {
        "missing": []
      }
    }
  ],
  "met": 8,
  "summary": "left train 1: waiting for its pull request #13",
  "next": {
    "step": "wait-train",
    "reason": "train 1 left beta at this head and its pull request #13 is open",
    "number": 13,
    "train": 1,
    "waitingFor": "pull request #13 of train 1"
  },
  "merge": {
    "method": "squash",
    "setup": {
      "ok": true,
      "missing": []
    },
    "autoMerge": false,
    "state": "OPEN",
    "mergeStateStatus": "CLEAN",
    "waitingFor": null
  }
}
```

> The stub `gh` stands in for GitHub: pull requests #11, #13 are merged (the train's with a merge commit, 1 of the boarded ones marked merged); the other boarded pull requests stay open

$ cd <repo> && node <hooks>/train-loop.mjs next --lang en

exit code 0

```text
{
  "version": 1,
  "kind": "session",
  "step": "clean-train",
  "detail": {
    "n": 1,
    "number": 13,
    "what": "worktree",
    "worktree": "<repo>/.claude/worktrees/train-1",
    "command": [
      "git",
      "-C",
      "<repo>",
      "worktree",
      "remove",
      "<repo>/.claude/worktrees/train-1"
    ]
  },
  "reply": "Train 1 merged in pull request #13: its changes are delivered, and what it left behind is tidied now.",
  "progressKey": "clean-train@13:worktree"
}
```

$ cd <repo> && git -C <repo> worktree remove <repo>/.claude/worktrees/train-1

exit code 0

$ cd <repo> && node <hooks>/train-loop.mjs next --lang en --after clean-train@13:worktree

exit code 0

```text
{
  "version": 1,
  "kind": "session",
  "step": "clean-train",
  "detail": {
    "n": 1,
    "number": 13,
    "what": "branch",
    "command": [
      "git",
      "-C",
      "<repo>",
      "branch",
      "-d",
      "train/1"
    ]
  },
  "reply": "Train 1 merged in pull request #13: its changes are delivered, and what it left behind is tidied now.",
  "progressKey": "clean-train@13:branch"
}
```

$ cd <repo> && git -C <repo> branch -d train/1

exit code 0

```text
Deleted branch train/1 (was 91cccc6).
```

stderr:

```text
warning: deleting branch 'train/1' that has been merged to
         'refs/remotes/origin/main', but not yet merged to HEAD
```

$ cd <repo> && node <hooks>/train-loop.mjs next --lang en --after clean-train@13:branch

exit code 1

```text
{
  "version": 1,
  "kind": "end",
  "step": "train-nothing",
  "detail": {
    "skipped": []
  },
  "reply": "Nothing is boarded: no change or archive is waiting for a train. Nothing was created.",
  "end": {
    "state": "waiting-for-owner",
    "why": "train-nothing"
  },
  "progressKey": "train-nothing@"
}
```

$ cd <repo>/.claude/worktrees/beta && node <hooks>/deliver-check.mjs beta --json

exit code 0

```text
{
  "version": 1,
  "change": "beta",
  "schema": "devkit-lite",
  "ship": "merge",
  "host": "app",
  "head": "fbeeae79ef021efa1ef925fd87068ba2e76acfb5",
  "pr": {
    "number": 12,
    "url": "https://github.com/o/r/pull/12"
  },
  "phases": [
    {
      "n": 1,
      "title": "Phase",
      "open": [],
      "gate": null
    }
  ],
  "items": [
    {
      "id": 1,
      "name": "tasks",
      "status": "met",
      "reason": "all tasks ticked",
      "details": {
        "unticked": [],
        "missingGates": [],
        "evidence": "current",
        "trainParts": []
      }
    },
    {
      "id": 2,
      "name": "reviews",
      "status": "met",
      "reason": "2 reviews at head",
      "details": {
        "stale": [],
        "rejected": [],
        "missing": []
      }
    },
    {
      "id": 3,
      "name": "findings",
      "status": "met",
      "reason": "0 fixed, 0 refuted",
      "details": {
        "fixed": 0,
        "refuted": 0,
        "undisposed": []
      }
    },
    {
      "id": 4,
      "name": "acceptance",
      "status": "met",
      "reason": "1 criteria proven",
      "details": {
        "ids": [
          "AC-1"
        ],
        "proven": [
          "AC-1"
        ],
        "missing": [],
        "defects": [],
        "noProof": [],
        "evidence": "current"
      }
    },
    {
      "id": 5,
      "name": "pr",
      "status": "met",
      "reason": "PR #12 open at fbeeae7",
      "details": {
        "pr": {
          "number": 12,
          "url": "https://github.com/o/r/pull/12"
        },
        "ahead": false,
        "uncommitted": [],
        "behind": false
      }
    },
    {
      "id": 6,
      "name": "checks",
      "status": "met",
      "reason": "2 required checks green",
      "details": {
        "required": true,
        "failing": [],
        "pending": []
      }
    },
    {
      "id": 7,
      "name": "conversation",
      "status": "met",
      "reason": "every thread and request is answered",
      "details": {
        "threads": [],
        "comments": [],
        "changesRequested": [],
        "waiting": []
      }
    },
    {
      "id": 8,
      "name": "body",
      "status": "met",
      "reason": "PR body names the change, its criteria and the evidence",
      "details": {
        "missing": []
      }
    }
  ],
  "met": 8,
  "summary": "ready",
  "next": {
    "step": "rejoin-train",
    "reason": "train 1 left beta (the suite failed with it); merge the base branch into it and fix it",
    "number": 13,
    "train": 1,
    "why": "red",
    "paths": [],
    "failure": "✔ alpha (1.257499ms)\n✔ beta (1.043737ms)\n✖ alpha and beta never ship together (2.176091ms)\nℹ tests 3\nℹ suites 0\nℹ pass 2\nℹ fail 1\nℹ cancelled 0\nℹ skipped 0\nℹ todo 0\nℹ duration_ms 101.557627\n\n✖ failing tests:\n\ntest at test/shared.test.mjs:4:1\n✖ alpha and beta never ship together (2.176091ms)\n  AssertionError [ERR_ASSERTION]: alpha and beta clash\n      at TestContext.<anonym
... (699 more characters)
```

$ cd <repo>/.claude/worktrees/alpha && node <hooks>/deliver-check.mjs alpha --json

exit code 0

```text
{
  "version": 1,
  "change": "alpha",
  "schema": "devkit-lite",
  "ship": "merge",
  "host": "app",
  "head": "8f607a7d163ef4199a7f9af6652c4fd80ab62952",
  "pr": {
    "number": 11,
    "url": "https://github.com/o/r/pull/11"
  },
  "phases": [],
  "items": [
    {
      "id": 1,
      "name": "tasks",
      "status": "met",
      "reason": "checked before PR #11 merged",
      "details": {
        "unticked": [],
        "missingGates": [],
        "evidence": "current"
      }
    },
    {
      "id": 2,
      "name": "reviews",
      "status": "met",
      "reason": "checked before PR #11 merged",
      "details": {
        "stale": [],
        "rejected": [],
        "missing": []
      }
    },
    {
      "id": 3,
      "name": "findings",
      "status": "met",
      "reason": "checked before PR #11 merged",
      "details": {
        "fixed": 0,
        "refuted": 0,
        "undisposed": []
      }
    },
    {
      "id": 4,
      "name": "acceptance",
      "status": "met",
      "reason": "checked before PR #11 merged",
      "details": {
        "ids": [],
        "proven": [],
        "missing": [],
        "defects": [],
        "noProof": [],
        "evidence": "current"
      }
    },
    {
      "id": 5,
      "name": "pr",
      "status": "met",
      "reason": "PR #11 merged",
      "details": {
        "pr": {
          "number": 11,
          "url": "https://github.com/o/r/pull/11"
        },
        "merged": true
      }
    },
    {
      "id": 6,
      "name": "checks",
      "status": "met",
      "reason": "checked before PR #11 merged",
      "details": {
        "required": false,
        "failing": [],
        "pending": []
      }
    },
    {
      "id": 7,
      "name": "conversation",
      "status": "met",
      "reason": "checked before PR #11 merged",
      "details": {
        "threads": [],
        "comments": [],
        "changesRequested": [],
        "waiting": []
      }
    },
    {
      "id": 8,
      "name": "body",
      "status": "met",
      "reason": "checked before PR #11 merged",
      "details": {
        "missing": []
      }
    }
  ],
  "met": 8,
  "summary": "merged: archive step retro",
  "next": {
    "step": "retro",
    "reason": "the change PR is merged; run the retro",
    "number": 11,
    "base": "main"
  },
  "merge": {
    "method": "squash",
    "setup": {
      "ok": true,
      "missing": []
    },
    "autoMerge": false,
    "state": "MERGED",
    "mergeStateStatus": "CLEAN",
    "waitingFor": null
  },
  "archive": {
    "base": "main",
    "branch": "chore/archive-alpha",
    "changePr": {
      "number": 11,
      "url": "https://github.com/o/r/pull/11"
    },
    "onDefault": "active",
    "folder": null,
    "local": "active",
    "retro": {
      "exists": false,
      "readable": false,
      "proposals": []
    },
    "roadmap": {
      "listed": false,
      "ticked": false
    },
    "pr": null,
    "waitingFor": null
  }
}
```

## Case 4: a product conflict and two archives of one spec: beta and the archive of delta leave with their paths

Model: `trunk-auto`.

Ends with: the train (`alpha` and the archive of `gamma`) merged by auto-merge; `beta` at `rejoin-train` naming `src/shared.txt`; the archive of `delta` at `stop-archive` (`train-left`) naming the spec path.

$ cd <repo> && node <hooks>/change-loop.mjs start --lang en   # standard input: "train"

exit code 0

```text
{
  "version": 1,
  "mode": "train",
  "verb": "train",
  "text": "",
  "change": null,
  "unfinished": [],
  "task": null,
  "settings": {
    "driver": "claude",
    "filesLanguage": "en",
    "personLanguage": "en"
  }
}
```

$ cd <repo> && node <hooks>/train-loop.mjs next --lang en

exit code 0

```text
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
      },
      {
        "kind": "archive",
        "id": "gamma",
        "number": 14
      },
      {
        "kind": "archive",
        "id": "delta",
        "number": 16
      }
    ],
    "skipped": [],
    "command": [
      "node",
      "<hooks>/train-loop.mjs",
      "depart",
      "--lang",
      "en"
    ]
  },
  "reply": null,
  "progressKey": "depart@alpha,beta,gamma,delta"
}
```

$ cd <repo> && node <hooks>/train-loop.mjs depart --lang en

exit code 0

```text
{
  "version": 1,
  "base": "main",
  "skipped": [],
  "n": 1,
  "branch": "train/1",
  "worktree": "<repo>/.claude/worktrees/train-1",
  "result": "passed",
  "boarded": [
    {
      "kind": "change",
      "id": "alpha",
      "number": 11,
      "head": "088514b8bd97ef9fd4946fb76bc3c3465ea57c76",
      "at": "2026-11-23T10:00:00Z"
    },
    {
      "kind": "archive",
      "id": "gamma",
      "number": 14,
      "head": "4581cf8437d336fd6a01c131c59062f2868af5a6",
      "at": "2026-11-23T10:10:00Z"
    }
  ],
  "left": [
    {
      "kind": "change",
      "id": "beta",
      "number": 12,
      "why": "conflict",
      "detail": "`src/shared.txt`"
    },
    {
      "kind": "archive",
      "id": "delta",
      "number": 16,
      "why": "conflict",
      "detail": "`openspec/roadmap.md`, `openspec/specs/change-coordination/spec.md`"
    }
  ],
  "runs": 1
}
```

$ cd <repo> && node <hooks>/train-loop.mjs next --lang en --after depart@alpha,beta,gamma,delta

exit code 0

```text
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
      "<repo>/.claude/worktrees/train-1",
      "push",
      "origin",
      "train/1"
    ]
  },
  "reply": null,
  "progressKey": "push-train@1"
}
```

$ cd <repo> && git -C <repo>/.claude/worktrees/train-1 push origin train/1

exit code 0

stderr:

```text
To <origin>
 * [new branch]      train/1 -> train/1
```

$ cd <repo> && node <hooks>/train-loop.mjs next --lang en --after push-train@1

exit code 0

```text
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
      "train 1: alpha, gamma",
      "--body-file",
      "<repo>/.claude/worktrees/train-1/openspec/trains/1.md"
    ]
  },
  "reply": null,
  "progressKey": "open-train-pr@1"
}
```

$ cd <repo> && gh pr create --base main --head train/1 --title train 1: alpha, gamma --body-file <repo>/.claude/worktrees/train-1/openspec/trains/1.md

exit code 0

```text
https://github.com/o/r/pull/17
```

> The stub `gh` stands in for GitHub: the checks of the train's pull request pass (`check`, `devkit-reviews`)

$ cd <repo> && node <hooks>/train-loop.mjs next --lang en --after open-train-pr@1

exit code 0

```text
{
  "version": 1,
  "kind": "session",
  "step": "enable-auto-merge",
  "detail": {
    "n": 1,
    "number": 17,
    "head": "59b97dc79956dbf77c81460c8d8b413f5170d9d3",
    "command": [
      "gh",
      "pr",
      "merge",
      "17",
      "--auto",
      "--merge",
      "--match-head-commit",
      "59b97dc79956dbf77c81460c8d8b413f5170d9d3"
    ]
  },
  "reply": null,
  "progressKey": "enable-auto-merge@17"
}
```

$ cd <repo> && gh pr merge 17 --auto --merge --match-head-commit 59b97dc79956dbf77c81460c8d8b413f5170d9d3

exit code 0

$ cd <repo> && node <hooks>/train-loop.mjs next --lang en --after enable-auto-merge@17

exit code 1

```text
{
  "version": 1,
  "kind": "end",
  "step": "train-auto-merge-on",
  "detail": {
    "n": 1,
    "number": 17
  },
  "reply": "Auto-merge is on for pull request #17 of train 1: GitHub merges it once its checks pass.",
  "end": {
    "state": "waiting-on-github",
    "why": "train-auto-merge-on"
  },
  "progressKey": "train-auto-merge-on@17"
}
```

> The stub `gh` stands in for GitHub: pull requests #11, #17 are merged (the train's with a merge commit, 1 of the boarded ones marked merged); the other boarded pull requests stay open

$ cd <repo> && node <hooks>/train-loop.mjs next --lang en

exit code 0

```text
{
  "version": 1,
  "kind": "session",
  "step": "close-boarded-pr",
  "detail": {
    "number": 14,
    "train": 1,
    "trainNumber": 17,
    "comment": "Delivered by train 1 in #17 (merge commit b6ca3eb).",
    "command": [
      "gh",
      "pr",
      "close",
      "14",
      "--comment",
      "Delivered by train 1 in #17 (merge commit b6ca3eb)."
    ]
  },
  "reply": "Train 1 merged in pull request #17: its changes are delivered, and what it left behind is tidied now.",
  "progressKey": "close-boarded-pr@14"
}
```

$ cd <repo> && gh pr close 14 --comment Delivered by train 1 in #17 (merge commit b6ca3eb).

exit code 0

$ cd <repo> && node <hooks>/train-loop.mjs next --lang en --after close-boarded-pr@14

exit code 0

```text
{
  "version": 1,
  "kind": "session",
  "step": "clean-train",
  "detail": {
    "n": 1,
    "number": 17,
    "what": "worktree",
    "worktree": "<repo>/.claude/worktrees/train-1",
    "command": [
      "git",
      "-C",
      "<repo>",
      "worktree",
      "remove",
      "<repo>/.claude/worktrees/train-1"
    ]
  },
  "reply": "Train 1 merged in pull request #17: its changes are delivered, and what it left behind is tidied now.",
  "progressKey": "clean-train@17:worktree"
}
```

$ cd <repo> && git -C <repo> worktree remove <repo>/.claude/worktrees/train-1

exit code 0

$ cd <repo> && node <hooks>/train-loop.mjs next --lang en --after clean-train@17:worktree

exit code 0

```text
{
  "version": 1,
  "kind": "session",
  "step": "clean-train",
  "detail": {
    "n": 1,
    "number": 17,
    "what": "branch",
    "command": [
      "git",
      "-C",
      "<repo>",
      "branch",
      "-d",
      "train/1"
    ]
  },
  "reply": "Train 1 merged in pull request #17: its changes are delivered, and what it left behind is tidied now.",
  "progressKey": "clean-train@17:branch"
}
```

$ cd <repo> && git -C <repo> branch -d train/1

exit code 0

```text
Deleted branch train/1 (was 59b97dc).
```

stderr:

```text
warning: deleting branch 'train/1' that has been merged to
         'refs/remotes/origin/main', but not yet merged to HEAD
```

$ cd <repo> && node <hooks>/train-loop.mjs next --lang en --after clean-train@17:branch

exit code 1

```text
{
  "version": 1,
  "kind": "end",
  "step": "train-nothing",
  "detail": {
    "skipped": []
  },
  "reply": "Nothing is boarded: no change or archive is waiting for a train. Nothing was created.",
  "end": {
    "state": "waiting-for-owner",
    "why": "train-nothing"
  },
  "progressKey": "train-nothing@"
}
```

$ cd <repo>/.claude/worktrees/beta && node <hooks>/deliver-check.mjs beta --json

exit code 2

```text
{
  "version": 1,
  "change": "beta",
  "schema": "devkit-lite",
  "ship": "merge",
  "host": "app",
  "head": "2f4ca68a112433a56c7f29fb81d9b2a59d7611ca",
  "pr": {
    "number": 12,
    "url": "https://github.com/o/r/pull/12"
  },
  "phases": [
    {
      "n": 1,
      "title": "Phase",
      "open": [],
      "gate": null
    }
  ],
  "items": [
    {
      "id": 1,
      "name": "tasks",
      "status": "met",
      "reason": "all tasks ticked",
      "details": {
        "unticked": [],
        "missingGates": [],
        "evidence": "current",
        "trainParts": []
      }
    },
    {
      "id": 2,
      "name": "reviews",
      "status": "met",
      "reason": "2 reviews at head",
      "details": {
        "stale": [],
        "rejected": [],
        "missing": []
      }
    },
    {
      "id": 3,
      "name": "findings",
      "status": "met",
      "reason": "0 fixed, 0 refuted",
      "details": {
        "fixed": 0,
        "refuted": 0,
        "undisposed": []
      }
    },
    {
      "id": 4,
      "name": "acceptance",
      "status": "met",
      "reason": "1 criteria proven",
      "details": {
        "ids": [
          "AC-1"
        ],
        "proven": [
          "AC-1"
        ],
        "missing": [],
        "defects": [],
        "noProof": [],
        "evidence": "current"
      }
    },
    {
      "id": 5,
      "name": "pr",
      "status": "blocked",
      "reason": "PR #12 has merge conflicts with main",
      "details": {
        "pr": {
          "number": 12,
          "url": "https://github.com/o/r/pull/12"
        },
        "conflict": true
      }
    },
    {
      "id": 6,
      "name": "checks",
      "status": "met",
      "reason": "2 required checks green",
      "details": {
        "required": true,
        "failing": [],
        "pending": []
      }
    },
    {
      "id": 7,
      "name": "conversation",
      "status": "met",
      "reason": "every thread and request is answered",
      "details": {
        "threads": [],
        "comments": [],
        "changesRequested": [],
        "waiting": []
      }
    },
    {
      "id": 8,
      "name": "body",
      "status": "met",
      "reason": "PR body names the change, its criteria and the evidence",
      "details": {
        "missing": []
      }
    }
  ],
  "met": 7,
  "summary": "blocked: item 5",
  "next": {
    "step": "rejoin-train",
    "reason": "train 1 left beta (it conflicts with the train); merge the base branch into it and fix it",
    "number": 17,
    "train": 1,
    "why": "conflict",
    "paths": [
      "src/shared.txt"
    ],
    "failure": null
  },
  "merge": {
    "method": "squash",
    "setup": {
      "ok": true,
      "missing": []
    },
    "autoMerge": false,
    "state": "OPEN",
    "mergeStateStatus": "CLEAN",
    "waitingFor": null
  }
}
```

$ cd <repo> && node <hooks>/conduct-check.mjs --change delta --json

exit code 0

```text
{
  "version": 2,
  "base": "main",
  "mode": "change",
  "change": "delta",
  "round": null,
  "startedAt": null,
  "skipped": [],
  "roadmapDone": false,
  "changes": [
    {
      "id": "delta",
      "round": null,
      "after": [],
      "text": null,
      "notes": null,
      "schema": "devkit-lite",
      "worktree": "<repo>/.claude/worktrees/archive-delta",
      "branch": "chore/archive-delta",
      "base": "main",
      "next": {
        "step": "stop-archive",
        "reason": "archive of delta left train 1 and conflicts with main in openspec/specs/change-coordination/spec.md; resolve them on chore/archive-delta",
        "archiveStep": "train-left",
        "paths": [
          "openspec/specs/change-coordination/spec.md"
        ],
        "blockedState": "blocked: archive of delta left train 1 and conflicts with main in openspec/specs/change-coordination/spec.md; resolve them on chore/archive-delta",
        "actor": "stop"
      },
      "state": "blocked: archive of delta left train 1 and conflicts with main in openspec/specs/change-coordination/spec.md; resolve them on chore/archive-delta",
      "deliver": {
        "summary": "merged: archive step rejoin-archive",
        "met": 8,
        "next": {
          "step": "rejoin-archive",
          "reason": "the archive of delta left train 1 for a conflict",
          "number": 16,
          "branch": "chore/archive-delta",
          "base": "main",
          "paths": [
            "openspec/roadmap.md",
            "openspec/specs/change-coordination/spec.md"
          ],
          "train": 1
        }
      },
      "unfinished": null,
      "sessionPrefix": "delta-p"
    }
  ],
  "dispatch": [],
  "owner": [],
  "github": [],
  "stopped": [
    "delta"
  ],
  "busy": [],
  "end": true
}
```

$ cd <repo>/.claude/worktrees/archive-gamma && node <hooks>/deliver-check.mjs gamma --json

exit code 0

```text
{
  "version": 1,
  "change": "gamma",
  "schema": "devkit-lite",
  "ship": "merge",
  "host": "app",
  "head": "4581cf8437d336fd6a01c131c59062f2868af5a6",
  "pr": {
    "number": 13,
    "url": "https://github.com/o/r/pull/13"
  },
  "phases": [],
  "items": [
    {
      "id": 1,
      "name": "tasks",
      "status": "met",
      "reason": "checked before PR #13 merged",
      "details": {
        "unticked": [],
        "missingGates": [],
        "evidence": "current"
      }
    },
    {
      "id": 2,
      "name": "reviews",
      "status": "met",
      "reason": "checked before PR #13 merged",
      "details": {
        "stale": [],
        "rejected": [],
        "missing": []
      }
    },
    {
      "id": 3,
      "name": "findings",
      "status": "met",
      "reason": "checked before PR #13 merged",
      "details": {
        "fixed": 0,
        "refuted": 0,
        "undisposed": []
      }
    },
    {
      "id": 4,
      "name": "acceptance",
      "status": "met",
      "reason": "checked before PR #13 merged",
      "details": {
        "ids": [],
        "proven": [],
        "missing": [],
        "defects": [],
        "noProof": [],
        "evidence": "current"
      }
    },
    {
      "id": 5,
      "name": "pr",
      "status": "met",
      "reason": "PR #13 merged",
      "details": {
        "pr": {
          "number": 13,
          "url": "https://github.com/o/r/pull/13"
        },
        "merged": true
      }
    },
    {
      "id": 6,
      "name": "checks",
      "status": "met",
      "reason": "checked before PR #13 merged",
      "details": {
        "required": false,
        "failing": [],
        "pending": []
      }
    },
    {
      "id": 7,
      "name": "conversation",
      "status": "met",
      "reason": "checked before PR #13 merged",
      "details": {
        "threads": [],
        "comments": [],
        "changesRequested": [],
        "waiting": []
      }
    },
    {
      "id": 8,
      "name": "body",
      "status": "met",
      "reason": "checked before PR #13 merged",
      "details": {
        "missing": []
      }
    }
  ],
  "met": 8,
  "summary": "archived",
  "next": {
    "step": "archived",
    "reason": "2026-11-23-gamma is on main",
    "folder": "2026-11-23-gamma"
  },
  "merge": {
    "method": "squash",
    "setup": {
      "ok": true,
      "missing": []
    },
    "autoMerge": false,
    "state": "MERGED",
    "mergeStateStatus": "CLEAN",
    "waitingFor": null
  },
  "archive": {
    "base": "main",
    "branch": "chore/archive-gamma",
    "changePr": {
      "number": 13,
      "url": "https://github.com/o/r/pull/13"
    },
    "onDefault": "archived",
    "folder": "2026-11-23-gamma",
    "local": "archived",
    "retro": {
      "exists": true,
      "readable": true,
      "proposals": []
    },
    "roadmap": {
      "listed": true,
      "ticked": true
    },
    "pr": null,
    "waitingFor": null
  }
}
```

$ cd <repo>/.claude/worktrees/alpha && node <hooks>/deliver-check.mjs alpha --json

exit code 0

```text
{
  "version": 1,
  "change": "alpha",
  "schema": "devkit-lite",
  "ship": "merge",
  "host": "app",
  "head": "088514b8bd97ef9fd4946fb76bc3c3465ea57c76",
  "pr": {
    "number": 11,
    "url": "https://github.com/o/r/pull/11"
  },
  "phases": [],
  "items": [
    {
      "id": 1,
      "name": "tasks",
      "status": "met",
      "reason": "checked before PR #11 merged",
      "details": {
        "unticked": [],
        "missingGates": [],
        "evidence": "current"
      }
    },
    {
      "id": 2,
      "name": "reviews",
      "status": "met",
      "reason": "checked before PR #11 merged",
      "details": {
        "stale": [],
        "rejected": [],
        "missing": []
      }
    },
    {
      "id": 3,
      "name": "findings",
      "status": "met",
      "reason": "checked before PR #11 merged",
      "details": {
        "fixed": 0,
        "refuted": 0,
        "undisposed": []
      }
    },
    {
      "id": 4,
      "name": "acceptance",
      "status": "met",
      "reason": "checked before PR #11 merged",
      "details": {
        "ids": [],
        "proven": [],
        "missing": [],
        "defects": [],
        "noProof": [],
        "evidence": "current"
      }
    },
    {
      "id": 5,
      "name": "pr",
      "status": "met",
      "reason": "PR #11 merged",
      "details": {
        "pr": {
          "number": 11,
          "url": "https://github.com/o/r/pull/11"
        },
        "merged": true
      }
    },
    {
      "id": 6,
      "name": "checks",
      "status": "met",
      "reason": "checked before PR #11 merged",
      "details": {
        "required": false,
        "failing": [],
        "pending": []
      }
    },
    {
      "id": 7,
      "name": "conversation",
      "status": "met",
      "reason": "checked before PR #11 merged",
      "details": {
        "threads": [],
        "comments": [],
        "changesRequested": [],
        "waiting": []
      }
    },
    {
      "id": 8,
      "name": "body",
      "status": "met",
      "reason": "checked before PR #11 merged",
      "details": {
        "missing": []
      }
    }
  ],
  "met": 8,
  "summary": "merged: archive step retro",
  "next": {
    "step": "retro",
    "reason": "the change PR is merged; run the retro",
    "number": 11,
    "base": "main"
  },
  "merge": {
    "method": "squash",
    "setup": {
      "ok": true,
      "missing": []
    },
    "autoMerge": false,
    "state": "MERGED",
    "mergeStateStatus": "CLEAN",
    "waitingFor": null
  },
  "archive": {
    "base": "main",
    "branch": "chore/archive-alpha",
    "changePr": {
      "number": 11,
      "url": "https://github.com/o/r/pull/11"
    },
    "onDefault": "active",
    "folder": null,
    "local": "active",
    "retro": {
      "exists": false,
      "readable": false,
      "proposals": []
    },
    "roadmap": {
      "listed": false,
      "ticked": false
    },
    "pr": null,
    "waitingFor": null
  }
}
```

