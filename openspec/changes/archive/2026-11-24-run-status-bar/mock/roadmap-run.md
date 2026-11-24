# Screen: the status line of the session that coordinates a roadmap run

One line under the message box of the roadmap coordinator's session. It counts the changes of the run by state. It has no strip
of marks and no percentage. 100 columns at most; an emoji takes two columns.

Reading the line:

```
<n> in play · <n> working · 🙋 <n> waiting on the owner · ⛔ <n> blocked
```

- In play: every change the `state` listing holds.
- Working: the changes whose `state` is `running`. Waiting on the owner: `waiting-for-owner` (`🙋`). Blocked: `blocked` (`⛔`).
- All four counts are always printed, a zero included, so the line keeps one shape.
- A change in another state (`waiting-on-github`, `archived`) is in play but has no count of its own.

## Moment 1: the real listing of this worktree today (2026-11-23), English

`node plugins/openspec/hooks/change-loop.mjs state --lang en` printed 10 changes, all with state `running`: compozy-driver
(Implementation), coordinator-loop-fixes (Decisions and ADRs), forced-merge-path, jira-entry-followups, release-merge-leftovers,
roadmap-coordinator-followups, roadmap-panel-study and state-skips-unlocated (Proposal), project-setup (Decisions and ADRs) and
run-status-bar (Screen mock-up). None waits on the owner and none is blocked.

```
|----+----1----+----2----+----3----+----4----+----5----+----6----+----7----+----8----+----9----+----0
10 in play · 10 working · 🙋 0 waiting on the owner · ⛔ 0 blocked
```

## Moment 1 in Brazilian Portuguese

`--lang pt-BR` printed the same 10 changes in the same states (the titles are in Portuguese, for example "Implementação", "Proposta",
"Mock-up de tela"), so the counts are the same.

```
|----+----1----+----2----+----3----+----4----+----5----+----6----+----7----+----8----+----9----+----0
10 em jogo · 10 em andamento · 🙋 0 aguardando o dono · ⛔ 0 bloqueadas
```

## Moment 2: the example of AC-3, six changes (three running, two waiting on the owner, one blocked)

No real listing holds this mix today, so this is the criterion's example, not a recorded output.

```
|----+----1----+----2----+----3----+----4----+----5----+----6----+----7----+----8----+----9----+----0
6 in play · 3 working · 🙋 2 waiting on the owner · ⛔ 1 blocked
6 em jogo · 3 em andamento · 🙋 2 aguardando o dono · ⛔ 1 bloqueada
```

## Where the data comes from

| Element | Source |
| --- | --- |
| The counts of moment 1 | `node plugins/openspec/hooks/change-loop.mjs state --lang en` and `--lang pt-BR`, run in the worktree of this change on 2026-11-23: `version: 1`, 10 `changes`, every one `state: running`, every one with a `root` (its worktree) and a `branch` |
| The git facts | `git worktree list` shows 23 worktrees: the root checkout on `main`, 10 whose folder is the `root` of a listed change (this one included, branch `run-status-bar`; `roadmap-coordinator-followups` is on its archive branch), and 12 others (archive branches, 3 detached heads) that the listing does not hold and the bar does not count |
| The icons `🙋` and `⛔` | `STATE_ICON` in `plugins/openspec/hooks/change-loop.mjs`; `running` has no state icon, so "working" has none |
| The counts of moment 2 | AC-3 of `openspec/changes/run-status-bar/requirements.md` |
| The Portuguese words | drawn for this mock-up; the planner settles the wording of both languages |
