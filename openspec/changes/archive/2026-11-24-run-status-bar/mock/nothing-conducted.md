# Screen: the status line of a session that conducts nothing

A session that conducts no change and holds no roadmap run shows an empty bar: the command prints nothing (not even a blank line or a
placeholder word) and exits 0, so Claude Code draws no text under the message box.

The block below is the whole bar. The ruler shows the width the bar could use; the line under it is empty.

```
|----+----1----+----2----+----3----+----4----+----5----+----6----+----7----+----8----+----9----+----0

```

It is the same in English and in Brazilian Portuguese.

## Where the data comes from

| Element | Source |
| --- | --- |
| No text | AC-4 of `openspec/changes/run-status-bar/requirements.md`: no change conducted (the JSON Claude Code passes on standard input names a `cwd` that is no change's worktree or branch) and no roadmap run |
| Example of such a session | the root checkout on branch `main`, which is no change's worktree in `git worktree list` |
