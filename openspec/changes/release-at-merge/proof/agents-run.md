# Real-run proof: the conducting session's part, the real agents on every variant (tasks 7.1 to 7.7)

Every case below ran for real, on 2026-11-24: this worktree's own agents (`$WT/plugins/core`) and hooks (`$WT/plugins/openspec`,
`$DEV` being its `hooks/` folder), never the installed plugin, in the scratch projects K, K0 and N of design D-16 under a private
`TMPDIR` (`$TMPDIR` is `/var/tmp/devkit-release-at-merge`, `$CASES` is `$TMPDIR/devkit-proof-release-at-merge`, removed after
the run). Each change was opened with this worktree's `change-loop.mjs open`; each agent was run by a `claude -p` conducting session
(`--plugin-dir $WT/plugins/core --plugin-dir $WT/plugins/openspec`, its init event naming both folders) that made exactly one Agent
call, with the agent, the model and the brief of the `next` recorded just before it. Each block is one command as it ran, the folder
it ran in, its whole output and its exit code; the files a case seeded are shown with `cat` right after they were written. The
`claude -p` runs used `--permission-mode bypassPermissions`, in the scratch folder only, as the stage-models proof did. The script
is kept beside this file (`proof/agents.mjs`, on top of `proof/seed.mjs`), so the proof can be run again:

    TMPDIR=/var/tmp/devkit-release-at-merge node openspec/changes/release-at-merge/proof/agents.mjs seed
    TMPDIR=/var/tmp/devkit-release-at-merge node openspec/changes/release-at-merge/proof/agents.mjs S-1 S-2 S-3 S-6
    TMPDIR=/var/tmp/devkit-release-at-merge node openspec/changes/release-at-merge/proof/agents.mjs S-4
    TMPDIR=/var/tmp/devkit-release-at-merge node openspec/changes/release-at-merge/proof/agents.mjs S-5 S-7
    TMPDIR=/var/tmp/devkit-release-at-merge node openspec/changes/release-at-merge/proof/agents.mjs S-8 S-9 S-10 S-11
    TMPDIR=/var/tmp/devkit-release-at-merge node openspec/changes/release-at-merge/proof/agents.mjs assemble

The first run of the cases found one defect in an agent text, fixed test-first (a failing test, then the fix) before every
case below was run again from new projects: in K, whose release file is `package.json`, the real `change-planner` wrote
`packs:` / `- app: minor`. `parseReleaseNote` reads that note, so the stop hook let it through, but `computeRelease` refuses
it at the delivery (`release.md: packs: app is not a pack of this project`, row N1): the planner's text never said what a pack is.
Its release-note bullet now says a pack is a `plugins/<dir>/.claude-plugin/plugin.json` of the project, that a project with no
such pack writes `packs: []`, and that the bump of the file `devkit.release_tag` names goes under `release:` (test "release-note
AC-1 texts: the planner says a pack is a plugin manifest of the project ..." in `release-note.test.mjs`; the CompozyOS copy
regenerated). S-2 and S-6 now also record the state `computeRelease` gives the planner's note, measured on a snapshot commit of the plan (K was
built once more for the planner's cases after that measurement first read the uncommitted plan from `HEAD`). The same first run showed, in S-6,
that a revision which changes only `release.md` does not send the plan back to the readiness review (see S-6); that one needs a
design decision and is reported, not changed here.

The planner's stop (S-2, S-3, S-6, S-7) is judged by `guard.mjs subagent-stop`, the hook Claude Code calls when a subagent stops,
run with the planner's input: `agent_type` `devkit-core:change-planner`, the change's worktree as `cwd`, and a run transcript holding
the typed `/devkit-openspec:devkit change <id>` and the tool result of the loop's `next` (its real output), which is how the hook knows
the session is in that change's run (`runOf`). The `claude -p` runs themselves hand one stage from a plain prompt, so their own
transcripts hold no typed command and the live hook let every stop through as `no-run` (each run's hook log says so).

## How the projects are built

`proof/seed.mjs` (`seedProject`, phase 6) builds each project: a bare `origin.git`, a main checkout `main` with this worktree's schemas copied to `openspec/schemas`, one commit pushed to `origin/main`, and the `gh` stub of `seed.mjs` first on `PATH` (it never calls GitHub; the merge-mode setup reads its ruleset answer). The files are `consumerFiles` of `seed.mjs`: an app whose release file is `package.json` (1.4.0), a root `CHANGELOG.md`, `src/app.ts` and, unless left out, `docs/adr/0001-start.md`. K names `devkit.release_tag: package.json` and has `docs/adr/0001-start.md`; K0 is K without `docs/adr/`; N is K without `devkit.release_tag`. All three deliver in `merge` mode, so the loop hands the implementation once the plan is approved.

### Project K

```text
(in $CASES/K/main)
$ cat openspec/config.yaml
schema: devkit
ship:
  devkit: merge
  devkit-lite: merge
devkit:
  release_tag: package.json
[exit 0]
```

```text
(in $CASES/K/main)
$ git ls-files -- . ':(exclude)openspec/schemas'
.github/workflows/devkit-reviews.yml
.gitignore
CHANGELOG.md
docs/adr/0001-start.md
openspec/config.yaml
package.json
src/app.ts
[exit 0]
```

### Project K0

```text
(in $CASES/K0/main)
$ cat openspec/config.yaml
schema: devkit
ship:
  devkit: merge
  devkit-lite: merge
devkit:
  release_tag: package.json
[exit 0]
```

```text
(in $CASES/K0/main)
$ git ls-files -- . ':(exclude)openspec/schemas'
.github/workflows/devkit-reviews.yml
.gitignore
CHANGELOG.md
openspec/config.yaml
package.json
src/app.ts
[exit 0]
```

### Project N

```text
(in $CASES/N/main)
$ cat openspec/config.yaml
schema: devkit
ship:
  devkit: merge
  devkit-lite: merge
[exit 0]
```

```text
(in $CASES/N/main)
$ git ls-files -- . ':(exclude)openspec/schemas'
.github/workflows/devkit-reviews.yml
.gitignore
CHANGELOG.md
docs/adr/0001-start.md
openspec/config.yaml
package.json
src/app.ts
[exit 0]
```

## S-1 K: the adr-author on the decisions stage drafts an unnumbered record (task 7.1; AC-5, AC-6)

```text
(in $CASES/K/main)
$ node $DEV/change-loop.mjs open prefs --script devkit --why architecture --lang en <<< "Persist each user's preferences. The app has no storage today."
devkit-run: prefs
{
  "version": 1,
  "change": "prefs",
  "script": "devkit",
  "worktree": "$CASES/K/main/.claude/worktrees/prefs",
  "branch": "prefs",
  "base": "origin/main",
  "reply": "I opened the change prefs on the full script, because it changes how parts of the project fit together. Next come a few questions about your request; to use the short script instead, say so before the plan is written."
}
[exit 0]
```

Seeded (the requirements stage as the grill leaves it, passed) in `$CASES/K/main/.claude/worktrees/prefs`:

```text
(in $CASES/K/main/.claude/worktrees/prefs)
$ cat openspec/changes/prefs/requirements.md
<!-- devkit-stage requirements result=passed attempt=1 commit=1345cb60e627f4f33b8fe90303b0bce9b2593f21 -->
# Requirements

## Request

> Persist each user's preferences. The app has no storage today.

## Assumptions

- The app is a Node.js service; its code lives in `src/` and it has no database today.
- The owner chose SQLite: one file `data/app.db` read through the `better-sqlite3` package, not JSON files. Every later
  feature reads preferences through this store, so moving off it later means migrating every user's data.

## Acceptance criteria

- AC-1: `src/prefs.ts` exports `getPref(user, key)` and `setPref(user, key, value)`, backed by a `prefs` table in `data/app.db`.
- AC-2: a preference written by `setPref` is read back by `getPref` after the process restarts.
- AC-3: `getPref` of a key never written returns `null`.

## Out of scope

- Sharing preferences between users.
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/prefs)
$ ls -1 docs/adr
0001-start.md
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/prefs)
$ node $DEV/change-loop.mjs next --change prefs --lang en
devkit-run: prefs
{
  "version": 1,
  "change": "prefs",
  "script": "devkit",
  "root": "$CASES/K/main/.claude/worktrees/prefs",
  "branch": "prefs",
  "filesLanguage": "en",
  "kind": "agent",
  "stage": "decisions",
  "stageTitle": "Decisions and ADRs",
  "role": "adr-author",
  "skills": [
    "adr-authoring"
  ],
  "model": "opus",
  "agent": "devkit-core:adr-author",
  "brief": "Change prefs (devkit script), stage decisions: write decisions.md from `openspec instructions decisions --change prefs`. Work only in $CASES/K/main/.claude/worktrees/prefs on branch prefs; every file path is absolute under it; start every Bash command with cd $CASES/K/main/.claude/worktrees/prefs && ; do not fetch. Write the change's files in English.",
  "progressKey": "decisions/decisions@549c20950af4",
  "icon": "📝",
  "state": {
    "state": "running",
    "reason": null,
    "stage": "decisions",
    "stageTitle": "Decisions and ADRs",
    "phase": null,
    "stageIcon": "📝",
    "stateIcon": null,
    "title": "📝 prefs"
  },
  "sessionTitle": "📝 prefs"
}
[exit 0]
```

The real agent, run in `$CASES/K/main/.claude/worktrees/prefs` (the prompt on standard input; 0.6 min):

```text
(in $CASES/K/main/.claude/worktrees/prefs)
$ TMPDIR=$CASES/tmp DEVKIT_HOOK_LOG=$CASES/runs/S-1.hooks.jsonl claude -p --model sonnet --permission-mode bypassPermissions --plugin-dir $WT/plugins/core --plugin-dir $WT/plugins/openspec --output-format stream-json --verbose < prompt.txt
[exit 0]
```

The prompt (`prompt.txt`), the brief being the `brief` field of the `next` above, verbatim:

```text
This session is the conducting session of the devkit change `prefs` in a scratch project. It hands one stage to its agent, as the `devkit` skill's Loop does for an `agent` action; the loop's `next` gave this action: stage `decisions`, agent `devkit-core:adr-author`, model `opus`.

Make exactly one Agent call: subagent_type `devkit-core:adr-author`, model `opus`, and as its prompt this brief, verbatim:

Change prefs (devkit script), stage decisions: write decisions.md from `openspec instructions decisions --change prefs`. Work only in $CASES/K/main/.claude/worktrees/prefs on branch prefs; every file path is absolute under it; start every Bash command with cd $CASES/K/main/.claude/worktrees/prefs && ; do not fetch. Write the change's files in English.

Do nothing else: run no command, read or write no file yourself, and make no other Agent call. When the agent returns, reply with its final message, verbatim.
```

From the run's stream-json output (kept in the scratch folder while the proof ran):

```text
session: eab160cd-fac4-4ca3-a8cc-9c020c152c53; conducting model: claude-sonnet-5-5; permission mode: bypassPermissions
plugin devkit-core 0.15.0 from $WT/plugins/core
plugin devkit-openspec 0.40.0 from $WT/plugins/openspec
Agent calls of the conducting session: 1
Agent call: subagent_type=devkit-core:adr-author model=opus prompt-is-the-brief=yes
the agent's model: claude-opus-5-5
the agent's task: completed (task notification)
last result: success is_error=false turns=1 cost_usd=0.2860773
```

The tools the agent called, in order:

```text
Bash ls openspec/changes/prefs; cat openspec/changes/prefs/requirements.md; cat openspec/config.yaml; openspec instructions decisions --change prefs; git ls-files | head -100; cat CLAUDE.md AGENTS.md 2>/dev/null
Bash cat docs/adr/0001-start.md; ls docs/adr; cat package.json src/app.ts; git rev-parse HEAD
Write $CASES/K/main/.claude/worktrees/prefs/docs/adr/prefs.md
Write $CASES/K/main/.claude/worktrees/prefs/openspec/changes/prefs/decisions.md
```

The agent's final message (its last text; the conducting session ran it as a background agent):

```text
Outcome: proposed 1. I drafted one decision record for the SQLite storage choice, with status `proposed`. Your plan approval is what accepts it.

**Why this decision needs a record.** The change adds the app's first persistent store: one SQLite file, `data/app.db`, read through the `better-sqlite3` package. That picks a technology, and it is hard to reverse, because every later feature reads preferences through this store. Moving off it would mean migrating every user's data. The only existing record, ADR 0001 (start), says nothing about storage, so this record neither conflicts with it nor changes it.

**Numbering.** `openspec/config.yaml` sets `devkit.release_tag`, so the record has no number. It is titled `# ADR [prefs]: ...`, and its number is assigned when the change is merged.

**What the record contains.**
- **Decision:** preferences go in a `prefs` table in `data/app.db`, and only `src/prefs.ts` touches that table, through `getPref` and `setPref`.
- **Consequences:**
  - a native dependency that must install on every platform the app runs on;
  - on-disk data that has to survive restarts and deployments, stay out of git, and be backed up;
  - synchronous reads and writes that briefly block the service while they run;
  - one file on one machine, so several running copies of the app can't share it.
- **Alternatives:**
  - JSON files, which you rejected;
  - the async `sqlite3` package;
  - a database server such as PostgreSQL or Redis.

  You didn't mention the last two. I added them as options not chosen, so please check that those reasons match yours.

The project has no ADR index, so I didn't update one. I wrote no product code.

Files:
- $CASES/K/main/.claude/worktrees/prefs/docs/adr/prefs.md
- $CASES/K/main/.claude/worktrees/prefs/openspec/changes/prefs/decisions.md (header `result=passed attempt=1 commit=1345cb60e627f4f33b8fe90303b0bce9b2593f21`)
```

The live hook decisions of the run (`DEVKIT_HOOK_LOG` of the worktree's `guard.mjs`; mode, agent, decision, why, count). The run's transcript holds no typed `/devkit change` command, so the stop and hand-off locks read no run (`no-run`); the planner's stop is judged by the `guard.mjs subagent-stop` calls of the case, with the run transcript they name:

```text
agent devkit-core:adr-author allow (no-run) x2
stop session allow (no-run) x4
subagent-stop devkit-core:adr-author allow (no-run) x2
```

```text
(in $CASES/K/main/.claude/worktrees/prefs)
$ ls -1 docs/adr
0001-start.md
prefs.md
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/prefs)
$ cat openspec/changes/prefs/decisions.md
<!-- devkit-stage decisions result=passed attempt=1 commit=1345cb60e627f4f33b8fe90303b0bce9b2593f21 -->
# Decisions and ADRs

- ADR: `docs/adr/prefs.md` — Store user preferences in SQLite through better-sqlite3
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/prefs)
$ head -12 docs/adr/prefs.md
# ADR [prefs]: Store user preferences in SQLite through better-sqlite3

- Status: proposed

## Context

The app is a Node.js service with its code in `src/` and no storage today. The change `prefs` must persist each
user's preferences so that a value written by `setPref(user, key, value)` is read back by `getPref(user, key)` after
the process restarts, and an unwritten key reads as `null`. This is the app's first persistent store: every later
feature that reads preferences will read them through it, so moving to another store later means migrating every
user's data. The only earlier record, ADR 0001 (start), says nothing about storage.

[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/prefs)
$ git status --short
 M openspec/changes/prefs/requirements.md
?? docs/adr/prefs.md
?? openspec/changes/prefs/decisions.md
[exit 0]
```

Done-condition of S-1 (task 7.1):

```text
holds: the claude -p run exited 0 with one Agent call
holds: the new records are docs/adr/<slug>.md with the change id as slug: prefs.md
holds: each is titled # ADR [<slug>]
holds: decisions.md lists each: docs/adr/prefs.md
holds: no new numbered record
holds: decisions.md is passed
```

## S-2 K: the change-planner writes the plan and a release note (task 7.2; AC-1)

The change `prefs` of S-1, with the decisions stage the adr-author passed there.

```text
(in $CASES/K/main/.claude/worktrees/prefs)
$ node $DEV/change-loop.mjs next --change prefs --lang en
devkit-run: prefs
{
  "version": 1,
  "change": "prefs",
  "script": "devkit",
  "root": "$CASES/K/main/.claude/worktrees/prefs",
  "branch": "prefs",
  "filesLanguage": "en",
  "kind": "agent",
  "stage": "proposal",
  "stageTitle": "Proposal",
  "role": "change-planner",
  "skills": [],
  "model": "opus",
  "agent": "devkit-core:change-planner",
  "brief": "Change prefs (devkit script), stage proposal: write the plan files the script still lacks, from proposal on, each from `openspec instructions <artifact> --change prefs`. Work only in $CASES/K/main/.claude/worktrees/prefs on branch prefs; every file path is absolute under it; start every Bash command with cd $CASES/K/main/.claude/worktrees/prefs && ; do not fetch. Write the change's files in English.",
  "progressKey": "proposal/proposal@7a8747fe7782",
  "icon": "📝",
  "state": {
    "state": "running",
    "reason": null,
    "stage": "proposal",
    "stageTitle": "Proposal",
    "phase": null,
    "stageIcon": "📝",
    "stateIcon": null,
    "title": "📝 prefs"
  },
  "sessionTitle": "📝 prefs"
}
[exit 0]
```

The real agent, run in `$CASES/K/main/.claude/worktrees/prefs` (the prompt on standard input; 2.6 min):

```text
(in $CASES/K/main/.claude/worktrees/prefs)
$ TMPDIR=$CASES/tmp DEVKIT_HOOK_LOG=$CASES/runs/S-2.hooks.jsonl claude -p --model sonnet --permission-mode bypassPermissions --plugin-dir $WT/plugins/core --plugin-dir $WT/plugins/openspec --output-format stream-json --verbose < prompt.txt
[exit 0]
```

The prompt (`prompt.txt`), the brief being the `brief` field of the `next` above, verbatim:

```text
This session is the conducting session of the devkit change `prefs` in a scratch project. It hands one stage to its agent, as the `devkit` skill's Loop does for an `agent` action; the loop's `next` gave this action: stage `proposal`, agent `devkit-core:change-planner`, model `opus`.

Make exactly one Agent call: subagent_type `devkit-core:change-planner`, model `opus`, and as its prompt this brief, verbatim:

Change prefs (devkit script), stage proposal: write the plan files the script still lacks, from proposal on, each from `openspec instructions <artifact> --change prefs`. Work only in $CASES/K/main/.claude/worktrees/prefs on branch prefs; every file path is absolute under it; start every Bash command with cd $CASES/K/main/.claude/worktrees/prefs && ; do not fetch. Write the change's files in English.

Do nothing else: run no command, read or write no file yourself, and make no other Agent call. When the agent returns, reply with its final message, verbatim.
```

From the run's stream-json output (kept in the scratch folder while the proof ran):

```text
session: a0dd197e-b764-4f5e-a2f1-66a842277c39; conducting model: claude-sonnet-5-5; permission mode: bypassPermissions
plugin devkit-core 0.15.0 from $WT/plugins/core
plugin devkit-openspec 0.40.0 from $WT/plugins/openspec
Agent calls of the conducting session: 1
Agent call: subagent_type=devkit-core:change-planner model=opus prompt-is-the-brief=yes
the agent's model: claude-opus-5-5
the agent's task: completed (task notification)
last result: success is_error=false turns=1 cost_usd=0.7457773999999999
```

The tools the agent called, in order:

```text
Bash git log --oneline -3 && find . -path ./.git -prune -o -type f -print | grep -v node_modules | head -100 && cat openspec/config.yaml
Bash for f in package.json CHANGELOG.md src/app.ts docs/adr/prefs.md docs/adr/0001-start.md openspec/changes/prefs/.openspec.yaml openspec/changes/prefs/decisions.md openspec/changes/prefs/requirements.md .gitignore; do 
Bash cat openspec/schemas/devkit/schema.yaml openspec/schemas/devkit/flows/2.json openspec/schemas/devkit/flow.json; cat .github/workflows/devkit-reviews.yml; openspec status --change prefs 2>&1
Bash openspec status --change prefs 2>&1; for a in proposal specs design tasks; do echo "######## $a"; openspec instructions $a --change prefs --json 2>&1; done
Bash grep -n -i -E "release|test command|npm|mockup" openspec/schemas/devkit/schema.yaml | head -60; cat .github/workflows/devkit-reviews.yml | head -60; openspec list --specs 2>&1
Bash node --version; npm --version; git show --stat HEAD | head; ls -a; ls plugins 2>&1
Bash git check-ignore -v docs/adr/prefs.md; od -c .gitignore | head; git ls-files
Bash grep -n "id: " openspec/schemas/devkit/schema.yaml; sed -n '/id: unit-tests/,/id: evidence/p' openspec/schemas/devkit/schema.yaml | head -80
Write $CASES/K/main/.claude/worktrees/prefs/openspec/changes/prefs/proposal.md
Write $CASES/K/main/.claude/worktrees/prefs/openspec/changes/prefs/specs/user-preferences/spec.md
Write $CASES/K/main/.claude/worktrees/prefs/openspec/changes/prefs/design.md
Write $CASES/K/main/.claude/worktrees/prefs/openspec/changes/prefs/tasks.md
Write $CASES/K/main/.claude/worktrees/prefs/openspec/changes/prefs/release.md
Bash openspec validate prefs --strict; echo exit=$?; git rev-parse HEAD; git rev-parse --verify main
Bash cd $CASES/K/main/.claude/worktrees/prefs/openspec/changes/prefs && for f in proposal.md design.md tasks.md specs/user-preferences/spec.md; do sed -i '1s/result
```

The agent's final message (its last text; the conducting session ran it as a background agent):

```text
I've written the plan for `prefs` from the proposal on: proposal, spec delta, design, tasks and release note. `openspec validate prefs --strict` passes, and the four stage headers are set to `result=passed` against commit `1345cb6`. The mockup stage before the proposal is still unchecked; it belongs to the screen designer, and this change has no screen.

1. **Change directory:** `$CASES/K/main/.claude/worktrees/prefs/openspec/changes/prefs`

2. **Files written:**
   - `proposal.md`
   - `specs/user-preferences/spec.md`
   - `design.md`
   - `tasks.md`
   - `release.md` (`packs: []`, `release: minor`, plus the changelog entry)

3. **ADRs and specs read:**
   - `docs/adr/prefs.md`: ADR [prefs], SQLite through `better-sqlite3`, status proposed. Listed in `decisions.md`.
   - `docs/adr/0001-start.md`: ADR 0001 (start). It constrains nothing here.
   - `requirements.md` and `decisions.md`. No code has been merged since the grill, so no requirement needed reopening.
   - `openspec list --specs`: the project has no specs yet, so `user-preferences` is a new capability.
   - `openspec/config.yaml`: `devkit.release_tag: package.json`, and no `devkit.tests.*` is declared.

4. **Escalations:** none. Three calls I made that reviewers should look at:
   - **Values are strings.** The requirements don't give a type, and a stored JSON `null` would look the same as "never written" (AC-3).
   - **The repo has no test command, so the plan adds one.** Task 1.1 adds `npm test` (Node's built-in runner) and `"type": "module"` to `package.json`. The gates rely on it.
   - **No test-only path setting.** Tests run the module in child processes inside a temp folder, so `data/app.db` stays exactly as the ADR names it.

   One known risk: if `better-sqlite3` won't load on Node 26 (task 1.9), the implementer stops and asks the owner, because switching driver needs a new ADR.

5. **Next step:** Run the plan-readiness-review skill on `$CASES/K/main/.claude/worktrees/prefs/openspec/changes/prefs` (or the adr-reviewer and spec-reviewer agents in parallel, plus `openspec validate prefs`). Implementation starts only after an approved plan.

Outcome: planned
```

The live hook decisions of the run (`DEVKIT_HOOK_LOG` of the worktree's `guard.mjs`; mode, agent, decision, why, count). The run's transcript holds no typed `/devkit change` command, so the stop and hand-off locks read no run (`no-run`); the planner's stop is judged by the `guard.mjs subagent-stop` calls of the case, with the run transcript they name:

```text
agent devkit-core:change-planner allow (no-run) x2
stop session allow (no-run) x4
subagent-stop devkit-core:change-planner allow (no-run) x2
```

```text
(in $CASES/K/main/.claude/worktrees/prefs)
$ node $DEV/change-loop.mjs next --change prefs --lang en
devkit-run: prefs
{
  "version": 1,
  "change": "prefs",
  "script": "devkit",
  "root": "$CASES/K/main/.claude/worktrees/prefs",
  "branch": "prefs",
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
  "brief": "Change prefs (devkit script), stage readiness: review the plan. Work only in $CASES/K/main/.claude/worktrees/prefs on branch prefs; every file path is absolute under it; start every Bash command with cd $CASES/K/main/.claude/worktrees/prefs && ; do not fetch. Write the change's files in English.",
  "progressKey": "readiness/readiness@34f16f906b45",
  "icon": "📝",
  "state": {
    "state": "running",
    "reason": null,
    "stage": "readiness",
    "stageTitle": "Plan readiness",
    "phase": null,
    "stageIcon": "📝",
    "stateIcon": null,
    "title": "📝 prefs"
  },
  "sessionTitle": "📝 prefs"
}
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/prefs)
$ ls -1R openspec/changes/prefs
openspec/changes/prefs:
decisions.md
design.md
proposal.md
release.md
requirements.md
specs
tasks.md

openspec/changes/prefs/specs:
user-preferences

openspec/changes/prefs/specs/user-preferences:
spec.md
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/prefs)
$ cat openspec/changes/prefs/tasks.md
<!-- devkit-stage tasks result=passed attempt=1 commit=1345cb60e627f4f33b8fe90303b0bce9b2593f21 -->
# Tasks

- Change: `prefs`
- Date: 2026-11-24
- Owner: kaue rodrigues dos santos
- PRD / tech spec: n/a
- Links: [proposal.md](proposal.md), [design.md](design.md), [specs/user-preferences/spec.md](specs/user-preferences/spec.md)

No task bumps the version, edits `CHANGELOG.md` or numbers ADR [prefs]: those are written at the merge from
[release.md](release.md). The repository has no `docs/` page for modules, so the only documentation is the doc comment
on the two exports (task 2.2); ADR [prefs] is already written.

## 1. Setup (phase 1)

- [ ] 1.1 Add the runtime and tooling to `package.json` (design D5, D6): run `npm install better-sqlite3` (writes
  `dependencies.better-sqlite3` and `package-lock.json`), add `"type": "module"` and the script
  `"test": "node --test \"src/**/*.test.ts\""`. Verify: `npm ls better-sqlite3` exits 0 and `package.json` shows the
  three fields.
- [ ] 1.9 Gate: `node --input-type=module -e "import Database from 'better-sqlite3'; new Database(':memory:').close()"`
  exits 0 (the native module loads on this platform). If it cannot be made to load, stop and escalate (design, Risks).

## 2. App: preference store (phase 2)

- [ ] 2.1 Write `src/prefs.test.ts` first (design D6): one `node:test` test per spec scenario, each in a fresh temp
  folder through child processes — exports exist; write-then-read; overwrite; two users with the same key; the `prefs`
  table exists in `data/app.db` (AC-1); write in one child, read in a second child (AC-2); empty store and unwritten key
  read `null` (AC-3). Verify: `npm test` runs these tests and they fail because `src/prefs.ts` does not exist yet.
- [ ] 2.2 Create `src/prefs.ts` (design D2, D3, D4): lazy open of `path.resolve(process.cwd(), 'data', 'app.db')` with
  `data/` created if missing, `CREATE TABLE IF NOT EXISTS prefs`, prepared upsert in `setPref`, prepared select in
  `getPref` returning `null` when no row, and a doc comment on each export stating its contract. Verify: every test from
  2.1 passes with `npm test`.
- [ ] 2.3 Add `data/` to `.gitignore` (design D7). Verify: `git check-ignore data/app.db` exits 0.
- [ ] 2.9 Gate: `npm test` exits 0 — covers AC-1, AC-2, AC-3.

## 3. Validation and cleanup (phase 3)

- [ ] 3.1 Confirm no leftovers: after `npm test`, `git status --porcelain` lists no `data/` path and no temp folder in
  the repository, and `src/app.ts` is unchanged (`git diff --exit-code main -- src/app.ts` exits 0).
- [ ] 3.9 Gate: `npm test` and `openspec validate prefs --strict` both exit 0 — covers AC-1, AC-2, AC-3 end to end.
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/prefs)
$ git status --short
 M openspec/changes/prefs/requirements.md
?? docs/adr/prefs.md
?? openspec/changes/prefs/decisions.md
?? openspec/changes/prefs/design.md
?? openspec/changes/prefs/proposal.md
?? openspec/changes/prefs/release.md
?? openspec/changes/prefs/specs/
?? openspec/changes/prefs/tasks.md
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/prefs)
$ cat openspec/changes/prefs/release.md
packs: []
release: minor

## User preferences persist across restarts

- New `src/prefs.ts` with `getPref(user, key)` and `setPref(user, key, value)`: each user's preferences are stored in
  the SQLite file `data/app.db` (table `prefs`) and are read back after the app restarts; a preference never written
  reads as `null` (ADR [prefs]).
- New runtime dependency `better-sqlite3`. The app now keeps on-disk state in `data/`, which must persist across
  deployments and be backed up; `data/` is ignored by git.
- `npm test` runs the test suite with Node's built-in test runner.
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/prefs)
$ node -e "import('$DEV/deliver-check.mjs').then((m) => console.log(JSON.stringify(m.parseReleaseNote(fs.readFileSync('openspec/changes/prefs/release.md', 'utf8')), null, 2)))"
{
  "packs": [],
  "marketplace": null,
  "marketplaceGiven": false,
  "release": "minor",
  "title": "User preferences persist across restarts",
  "body": "- New `src/prefs.ts` with `getPref(user, key)` and `setPref(user, key, value)`: each user's preferences are stored in\n  the SQLite file `data/app.db` (table `prefs`) and are read back after the app restarts; a preference never written\n  reads as `null` (ADR [prefs]).\n- New runtime dependency `better-sqlite3`. The app now keeps on-disk state in `data/`, which must persist across\n  deployments and be backed up; `data/` is ignored by git.\n- `npm test` runs the test suite with Node's built-in test runner."
}
[exit 0]
```

The plan snapshot (`git read-tree HEAD`, `git add` of the files `git ls-files -m -o --exclude-standard` lists, and `git write-tree` with `GIT_INDEX_FILE=$CASES/tmp/index-prefs`, then `git commit-tree <tree> -p HEAD`): 938c6cd0709c.

```text
(in $CASES/K/main/.claude/worktrees/prefs)
$ node -e "<releaseStateAt of $DEV/deliver-check.mjs: the snapshot 938c6cd0709c against origin/main, the note of openspec/changes/prefs/release.md, file package.json, the records changeAdrs lists>"
{"kind":"unassigned","error":null,"paths":[],"adrs":[{"slug":"prefs","folder":"docs/adr","from":"docs/adr/prefs.md","to":"docs/adr/0002-prefs.md","number":"0002"}]}
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/prefs)
$ node $DEV/change-loop.mjs next --change prefs --lang en
devkit-run: prefs
{
  "version": 1,
  "change": "prefs",
  "script": "devkit",
  "root": "$CASES/K/main/.claude/worktrees/prefs",
  "branch": "prefs",
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
  "brief": "Change prefs (devkit script), stage readiness: review the plan. Work only in $CASES/K/main/.claude/worktrees/prefs on branch prefs; every file path is absolute under it; start every Bash command with cd $CASES/K/main/.claude/worktrees/prefs && ; do not fetch. Write the change's files in English.",
  "progressKey": "readiness/readiness@34f16f906b45",
  "icon": "📝",
  "state": {
    "state": "running",
    "reason": null,
    "stage": "readiness",
    "stageTitle": "Plan readiness",
    "phase": null,
    "stageIcon": "📝",
    "stateIcon": null,
    "title": "📝 prefs"
  },
  "sessionTitle": "📝 prefs"
}
[exit 0]
```

The run transcript the guard calls name (`$CASES/runs/S-2.transcript.jsonl`): the typed `/devkit-openspec:devkit change prefs` and the tool result of the `next` just above.

```text
(in $CASES/K/main/.claude/worktrees/prefs)
$ echo '{"session_id":"S-2","transcript_path":"$CASES/runs/S-2.transcript.jsonl","cwd":"$CASES/K/main/.claude/worktrees/prefs","hook_event_name":"SubagentStop","stop_hook_active":false,"agent_type":"devkit-core:change-planner","agent_id":"S-2-planner","background_tasks":[]}' | DEVKIT_HOOK_LOG=$CASES/runs/S-2.guard.jsonl node $DEV/guard.mjs subagent-stop
(no output)
[exit 0]
```

```text
$CASES/runs/S-2.guard.jsonl, its new line:
{"at":"2026-11-24T18:16:59.457Z","mode":"subagent-stop","session":"S-2","agentType":"devkit-core:change-planner","change":"prefs","decision":"allow","why":"delivered"}
```

Done-condition of S-2 (task 7.2):

```text
holds: release.md exists
holds: parseReleaseNote reads it
holds: the delivery can release it: the state computeRelease gives is unassigned
holds: guard.mjs subagent-stop with the planner's input lets the stop through (allow delivered)
holds: the loop then hands the readiness review (devkit-core:plan-readiness-reviewer)
```

## S-3 K: the planner's failure path, the release note missing (task 7.3; AC-1)

The files S-2's planner left, with `release.md` moved out of the change folder (kept as `$CASES/runs/S-3.release.md`):

```text
(in $CASES/K/main/.claude/worktrees/prefs)
$ mv openspec/changes/prefs/release.md $CASES/runs/S-3.release.md
(no output)
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/prefs)
$ ls -1R openspec/changes/prefs
openspec/changes/prefs:
decisions.md
design.md
proposal.md
requirements.md
specs
tasks.md

openspec/changes/prefs/specs:
user-preferences

openspec/changes/prefs/specs/user-preferences:
spec.md
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/prefs)
$ node $DEV/change-loop.mjs next --change prefs --lang en
devkit-run: prefs
{
  "version": 1,
  "change": "prefs",
  "script": "devkit",
  "root": "$CASES/K/main/.claude/worktrees/prefs",
  "branch": "prefs",
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
  "brief": "Change prefs (devkit script), stage readiness: review the plan. Work only in $CASES/K/main/.claude/worktrees/prefs on branch prefs; every file path is absolute under it; start every Bash command with cd $CASES/K/main/.claude/worktrees/prefs && ; do not fetch. Write the change's files in English.",
  "progressKey": "readiness/readiness@756ea6fe96f3",
  "icon": "📝",
  "state": {
    "state": "running",
    "reason": null,
    "stage": "readiness",
    "stageTitle": "Plan readiness",
    "phase": null,
    "stageIcon": "📝",
    "stateIcon": null,
    "title": "📝 prefs"
  },
  "sessionTitle": "📝 prefs"
}
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/prefs)
$ echo '{"session_id":"S-3","transcript_path":"$CASES/runs/S-3.transcript.jsonl","cwd":"$CASES/K/main/.claude/worktrees/prefs","hook_event_name":"SubagentStop","stop_hook_active":false,"agent_type":"devkit-core:change-planner","agent_id":"S-3-planner","background_tasks":[]}' | DEVKIT_HOOK_LOG=$CASES/runs/S-3.guard.jsonl node $DEV/guard.mjs subagent-stop
devkit guard: openspec/changes/prefs/release.md does not exist: write the release note (packs:, the changelog title and body) before you stop
[exit 2]
```

```text
$CASES/runs/S-3.guard.jsonl, its new line:
{"at":"2026-11-24T18:17:02.807Z","mode":"subagent-stop","session":"S-3","agentType":"devkit-core:change-planner","change":"prefs","decision":"refuse","why":"no-release-note"}
```

```text
(in $CASES/K/main/.claude/worktrees/prefs)
$ echo '{"session_id":"S-3","transcript_path":"$CASES/runs/S-3.transcript.jsonl","cwd":"$CASES/K/main/.claude/worktrees/prefs","hook_event_name":"SubagentStop","stop_hook_active":false,"agent_type":"devkit-core:change-planner","agent_id":"S-3-planner","background_tasks":[]}' | DEVKIT_HOOK_LOG=$CASES/runs/S-3.guard.jsonl node $DEV/guard.mjs subagent-stop
(no output)
[exit 0]
```

```text
$CASES/runs/S-3.guard.jsonl, its new line:
{"at":"2026-11-24T18:17:04.549Z","mode":"subagent-stop","session":"S-3","agentType":"devkit-core:change-planner","change":"prefs","decision":"allow","why":"same-state"}
```

The refusal record the guard wrote (`$CASES/tmp/devkit-stop/S-3-S-3-planner.json`):

```text
(in $CASES/K/main/.claude/worktrees/prefs)
$ cat $CASES/tmp/devkit-stop/S-3-S-3-planner.json
{"key":"release-note/missing@756ea6fe96f3"}
[exit 0]
```

`release.md` restored:

```text
(in $CASES/K/main/.claude/worktrees/prefs)
$ mv $CASES/runs/S-3.release.md openspec/changes/prefs/release.md
(no output)
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/prefs)
$ echo '{"session_id":"S-3","transcript_path":"$CASES/runs/S-3.transcript.jsonl","cwd":"$CASES/K/main/.claude/worktrees/prefs","hook_event_name":"SubagentStop","stop_hook_active":false,"agent_type":"devkit-core:change-planner","agent_id":"S-3-planner","background_tasks":[]}' | DEVKIT_HOOK_LOG=$CASES/runs/S-3.guard.jsonl node $DEV/guard.mjs subagent-stop
(no output)
[exit 0]
```

```text
$CASES/runs/S-3.guard.jsonl, its new line:
{"at":"2026-11-24T18:17:06.268Z","mode":"subagent-stop","session":"S-3","agentType":"devkit-core:change-planner","change":"prefs","decision":"allow","why":"delivered"}
```

Done-condition of S-3 (task 7.3):

```text
holds: the first stop is refused naming the file
holds: the second stop goes through (same-state)
holds: the restored note's stop goes through (delivered)
```

## S-4 K0: the adr-author creates docs/adr/ with the unnumbered record (task 7.4; AC-5, AC-9)

```text
(in $CASES/K0/main)
$ node $DEV/change-loop.mjs open prefs --script devkit --why architecture --lang en <<< "Persist each user's preferences. The app has no storage today."
devkit-run: prefs
{
  "version": 1,
  "change": "prefs",
  "script": "devkit",
  "worktree": "$CASES/K0/main/.claude/worktrees/prefs",
  "branch": "prefs",
  "base": "origin/main",
  "reply": "I opened the change prefs on the full script, because it changes how parts of the project fit together. Next come a few questions about your request; to use the short script instead, say so before the plan is written."
}
[exit 0]
```

Seeded (the requirements stage as the grill leaves it, passed) in `$CASES/K0/main/.claude/worktrees/prefs`:

```text
(in $CASES/K0/main/.claude/worktrees/prefs)
$ cat openspec/changes/prefs/requirements.md
<!-- devkit-stage requirements result=passed attempt=1 commit=08acb927d3fa728052ba9560c201c304f157c5db -->
# Requirements

## Request

> Persist each user's preferences. The app has no storage today.

## Assumptions

- The app is a Node.js service; its code lives in `src/` and it has no database today.
- The owner chose SQLite: one file `data/app.db` read through the `better-sqlite3` package, not JSON files. Every later
  feature reads preferences through this store, so moving off it later means migrating every user's data.

## Acceptance criteria

- AC-1: `src/prefs.ts` exports `getPref(user, key)` and `setPref(user, key, value)`, backed by a `prefs` table in `data/app.db`.
- AC-2: a preference written by `setPref` is read back by `getPref` after the process restarts.
- AC-3: `getPref` of a key never written returns `null`.

## Out of scope

- Sharing preferences between users.
[exit 0]
```

```text
(in $CASES/K0/main/.claude/worktrees/prefs)
$ ls -1 docs/adr
ls: cannot access 'docs/adr': No such file or directory
[exit 2]
```

```text
(in $CASES/K0/main/.claude/worktrees/prefs)
$ node $DEV/change-loop.mjs next --change prefs --lang en
devkit-run: prefs
{
  "version": 1,
  "change": "prefs",
  "script": "devkit",
  "root": "$CASES/K0/main/.claude/worktrees/prefs",
  "branch": "prefs",
  "filesLanguage": "en",
  "kind": "agent",
  "stage": "decisions",
  "stageTitle": "Decisions and ADRs",
  "role": "adr-author",
  "skills": [
    "adr-authoring"
  ],
  "model": "opus",
  "agent": "devkit-core:adr-author",
  "brief": "Change prefs (devkit script), stage decisions: write decisions.md from `openspec instructions decisions --change prefs`. Work only in $CASES/K0/main/.claude/worktrees/prefs on branch prefs; every file path is absolute under it; start every Bash command with cd $CASES/K0/main/.claude/worktrees/prefs && ; do not fetch. Write the change's files in English.",
  "progressKey": "decisions/decisions@108da1c9393f",
  "icon": "📝",
  "state": {
    "state": "running",
    "reason": null,
    "stage": "decisions",
    "stageTitle": "Decisions and ADRs",
    "phase": null,
    "stageIcon": "📝",
    "stateIcon": null,
    "title": "📝 prefs"
  },
  "sessionTitle": "📝 prefs"
}
[exit 0]
```

The real agent, run in `$CASES/K0/main/.claude/worktrees/prefs` (the prompt on standard input; 0.6 min):

```text
(in $CASES/K0/main/.claude/worktrees/prefs)
$ TMPDIR=$CASES/tmp DEVKIT_HOOK_LOG=$CASES/runs/S-4.hooks.jsonl claude -p --model sonnet --permission-mode bypassPermissions --plugin-dir $WT/plugins/core --plugin-dir $WT/plugins/openspec --output-format stream-json --verbose < prompt.txt
[exit 0]
```

The prompt (`prompt.txt`), the brief being the `brief` field of the `next` above, verbatim:

```text
This session is the conducting session of the devkit change `prefs` in a scratch project. It hands one stage to its agent, as the `devkit` skill's Loop does for an `agent` action; the loop's `next` gave this action: stage `decisions`, agent `devkit-core:adr-author`, model `opus`.

Make exactly one Agent call: subagent_type `devkit-core:adr-author`, model `opus`, and as its prompt this brief, verbatim:

Change prefs (devkit script), stage decisions: write decisions.md from `openspec instructions decisions --change prefs`. Work only in $CASES/K0/main/.claude/worktrees/prefs on branch prefs; every file path is absolute under it; start every Bash command with cd $CASES/K0/main/.claude/worktrees/prefs && ; do not fetch. Write the change's files in English.

Do nothing else: run no command, read or write no file yourself, and make no other Agent call. When the agent returns, reply with its final message, verbatim.
```

From the run's stream-json output (kept in the scratch folder while the proof ran):

```text
session: 29913d5e-9ac1-46ee-bc55-fd4b68e07af3; conducting model: claude-sonnet-5-5; permission mode: bypassPermissions
plugin devkit-core 0.15.0 from $WT/plugins/core
plugin devkit-openspec 0.40.0 from $WT/plugins/openspec
Agent calls of the conducting session: 1
Agent call: subagent_type=devkit-core:adr-author model=opus prompt-is-the-brief=yes
the agent's model: claude-opus-5-5
the agent's task: completed (task notification)
last result: success is_error=false turns=2 cost_usd=0.2635561
```

The tools the agent called, in order:

```text
Bash cat openspec/changes/prefs/requirements.md; ls openspec/changes/prefs; cat openspec/config.yaml; find . -path ./node_modules -prune -o -type d \( -iname adr -o -iname adrs -o -iname decisions \) -print; ls; cat CLAU
Bash ls -a docs 2>&1; ls src; cat package.json; git rev-parse HEAD
Write $CASES/K0/main/.claude/worktrees/prefs/docs/adr/prefs.md
Write $CASES/K0/main/.claude/worktrees/prefs/openspec/changes/prefs/decisions.md
```

The agent's final message (its last text; the conducting session ran it as a background agent):

```text
Outcome: proposed 1. I drafted one record, for storing user preferences in SQLite through `better-sqlite3`, with status `proposed`.

**Why it needs a record:** it is the app's first storage, so it picks a technology and sets the contract every later feature will use. It is also hard to reverse, because moving off it means migrating every user's data. The other decisions, the `getPref`/`setPref` shape and returning `null` for a key never written, are easy to change and cross no boundary, so they have no record. The project had no records yet, so nothing is contradicted or amended.

**Naming:** the project had no ADR folder, so I created `docs/adr/`. `openspec/config.yaml` names `devkit.release_tag`, so the record has no number. Its slug is `prefs`, it is titled `ADR [prefs]: …`, and the number gets assigned at merge. There was no ADR index to update.

**`decisions.md`:** the header is `result=passed attempt=1 commit=08acb927d3fa728052ba9560c201c304f157c5db`. It has one line: `- ADR: \`docs/adr/prefs.md\` — Persist user preferences in SQLite through better-sqlite3`.

Files are in $CASES/K0/main/.claude/worktrees/prefs:
- docs/adr/prefs.md
- openspec/changes/prefs/decisions.md
```

The live hook decisions of the run (`DEVKIT_HOOK_LOG` of the worktree's `guard.mjs`; mode, agent, decision, why, count). The run's transcript holds no typed `/devkit change` command, so the stop and hand-off locks read no run (`no-run`); the planner's stop is judged by the `guard.mjs subagent-stop` calls of the case, with the run transcript they name:

```text
agent devkit-core:adr-author allow (no-run) x1
subagent-stop devkit-core:adr-author allow (no-run) x1
stop session allow (no-run) x1
```

```text
(in $CASES/K0/main/.claude/worktrees/prefs)
$ ls -1 docs/adr
prefs.md
[exit 0]
```

```text
(in $CASES/K0/main/.claude/worktrees/prefs)
$ cat openspec/changes/prefs/decisions.md
<!-- devkit-stage decisions result=passed attempt=1 commit=08acb927d3fa728052ba9560c201c304f157c5db -->
# Decisions and ADRs

- ADR: `docs/adr/prefs.md` — Persist user preferences in SQLite through better-sqlite3
[exit 0]
```

```text
(in $CASES/K0/main/.claude/worktrees/prefs)
$ head -12 docs/adr/prefs.md
# ADR [prefs]: Persist user preferences in SQLite through better-sqlite3

- Status: proposed

## Context

The app is a Node.js service with no storage today. The change `prefs` must persist each user's preferences so that a
value written by `setPref(user, key, value)` survives a process restart and is read back by `getPref(user, key)`
(`null` for a key never written). Every later feature will read preferences through this store, so the choice of
storage becomes the app's first persistence contract: moving off it later means migrating every user's data.

## Decision
[exit 0]
```

```text
(in $CASES/K0/main/.claude/worktrees/prefs)
$ git status --short
 M openspec/changes/prefs/requirements.md
?? docs/
?? openspec/changes/prefs/decisions.md
[exit 0]
```

Done-condition of S-4 (task 7.4):

```text
holds: the claude -p run exited 0 with one Agent call
holds: docs/adr/ is new (the base has none)
holds: the records are unnumbered docs/adr/<slug>.md: prefs.md
holds: decisions.md lists each: docs/adr/prefs.md
```

## S-5 N: the adr-author numbers the record as before this change (task 7.4; AC-9, AC-10)

```text
(in $CASES/N/main)
$ node $DEV/change-loop.mjs open feat --script devkit --why architecture --lang en <<< "Persist each user's preferences. The app has no storage today."
devkit-run: feat
{
  "version": 1,
  "change": "feat",
  "script": "devkit",
  "worktree": "$CASES/N/main/.claude/worktrees/feat",
  "branch": "feat",
  "base": "origin/main",
  "reply": "I opened the change feat on the full script, because it changes how parts of the project fit together. Next come a few questions about your request; to use the short script instead, say so before the plan is written."
}
[exit 0]
```

Seeded (the requirements stage as the grill leaves it, passed) in `$CASES/N/main/.claude/worktrees/feat`:

```text
(in $CASES/N/main/.claude/worktrees/feat)
$ cat openspec/changes/feat/requirements.md
<!-- devkit-stage requirements result=passed attempt=1 commit=1974551e56098546808c9d98f463a82e5794959b -->
# Requirements

## Request

> Persist each user's preferences. The app has no storage today.

## Assumptions

- The app is a Node.js service; its code lives in `src/` and it has no database today.
- The owner chose SQLite: one file `data/app.db` read through the `better-sqlite3` package, not JSON files. Every later
  feature reads preferences through this store, so moving off it later means migrating every user's data.

## Acceptance criteria

- AC-1: `src/prefs.ts` exports `getPref(user, key)` and `setPref(user, key, value)`, backed by a `prefs` table in `data/app.db`.
- AC-2: a preference written by `setPref` is read back by `getPref` after the process restarts.
- AC-3: `getPref` of a key never written returns `null`.

## Out of scope

- Sharing preferences between users.
[exit 0]
```

```text
(in $CASES/N/main/.claude/worktrees/feat)
$ ls -1 docs/adr
0001-start.md
[exit 0]
```

```text
(in $CASES/N/main/.claude/worktrees/feat)
$ node $DEV/change-loop.mjs next --change feat --lang en
devkit-run: feat
{
  "version": 1,
  "change": "feat",
  "script": "devkit",
  "root": "$CASES/N/main/.claude/worktrees/feat",
  "branch": "feat",
  "filesLanguage": "en",
  "kind": "agent",
  "stage": "decisions",
  "stageTitle": "Decisions and ADRs",
  "role": "adr-author",
  "skills": [
    "adr-authoring"
  ],
  "model": "opus",
  "agent": "devkit-core:adr-author",
  "brief": "Change feat (devkit script), stage decisions: write decisions.md from `openspec instructions decisions --change feat`. Work only in $CASES/N/main/.claude/worktrees/feat on branch feat; every file path is absolute under it; start every Bash command with cd $CASES/N/main/.claude/worktrees/feat && ; do not fetch. Write the change's files in English.",
  "progressKey": "decisions/decisions@9b9aae488e48",
  "icon": "📝",
  "state": {
    "state": "running",
    "reason": null,
    "stage": "decisions",
    "stageTitle": "Decisions and ADRs",
    "phase": null,
    "stageIcon": "📝",
    "stateIcon": null,
    "title": "📝 feat"
  },
  "sessionTitle": "📝 feat"
}
[exit 0]
```

The real agent, run in `$CASES/N/main/.claude/worktrees/feat` (the prompt on standard input; 0.6 min):

```text
(in $CASES/N/main/.claude/worktrees/feat)
$ TMPDIR=$CASES/tmp DEVKIT_HOOK_LOG=$CASES/runs/S-5.hooks.jsonl claude -p --model sonnet --permission-mode bypassPermissions --plugin-dir $WT/plugins/core --plugin-dir $WT/plugins/openspec --output-format stream-json --verbose < prompt.txt
[exit 0]
```

The prompt (`prompt.txt`), the brief being the `brief` field of the `next` above, verbatim:

```text
This session is the conducting session of the devkit change `feat` in a scratch project. It hands one stage to its agent, as the `devkit` skill's Loop does for an `agent` action; the loop's `next` gave this action: stage `decisions`, agent `devkit-core:adr-author`, model `opus`.

Make exactly one Agent call: subagent_type `devkit-core:adr-author`, model `opus`, and as its prompt this brief, verbatim:

Change feat (devkit script), stage decisions: write decisions.md from `openspec instructions decisions --change feat`. Work only in $CASES/N/main/.claude/worktrees/feat on branch feat; every file path is absolute under it; start every Bash command with cd $CASES/N/main/.claude/worktrees/feat && ; do not fetch. Write the change's files in English.

Do nothing else: run no command, read or write no file yourself, and make no other Agent call. When the agent returns, reply with its final message, verbatim.
```

From the run's stream-json output (kept in the scratch folder while the proof ran):

```text
session: bf31b7e4-8c54-4302-b950-f64536717a1e; conducting model: claude-sonnet-5-5; permission mode: bypassPermissions
plugin devkit-core 0.15.0 from $WT/plugins/core
plugin devkit-openspec 0.40.0 from $WT/plugins/openspec
Agent calls of the conducting session: 1
Agent call: subagent_type=devkit-core:adr-author model=opus prompt-is-the-brief=yes
the agent's model: claude-opus-5-5
the agent's task: completed (task notification)
last result: success is_error=false turns=1 cost_usd=0.2774294
```

The tools the agent called, in order:

```text
Bash cat openspec/changes/feat/requirements.md; ls openspec/changes/feat; cat openspec/config.yaml; find . -path ./.git -prune -o -type d \( -iname adr -o -iname adrs -o -iname decisions \) -print; ls; git rev-parse HEAD
Bash ls -la docs docs/adr; for f in docs/adr/*; do echo "== $f"; cat "$f"; done; ls src; cat package.json; ls CLAUDE.md AGENTS.md 2>&1
Write $CASES/N/main/.claude/worktrees/feat/docs/adr/0002-store-user-preferences-in-sqlite.md
Write $CASES/N/main/.claude/worktrees/feat/openspec/changes/feat/decisions.md
```

The agent's final message (its last text; the conducting session ran it as a background agent):

```text
Outcome: proposed 1 — I drafted one record, for the choice to store user preferences in SQLite. It's marked `proposed`, so it becomes accepted only when the owner approves the plan.

**Why it needs a record:** it picks a technology (SQLite through the `better-sqlite3` package, in the single file `data/app.db`). It's also hard to reverse: it is the app's first storage, and every later feature reads preferences through it, so switching later means moving every user's data. The record also makes `src/prefs.ts`'s `getPref`/`setPref` the only way other code reaches the `prefs` table. No other decision in the change needed a record.

**Existing records:** the only one is ADR 0001 ("start", accepted), which says nothing about storage. The new record doesn't contradict it, and I didn't change it.

**Numbering:** `openspec/config.yaml` names no `devkit.release_tag`, so the record takes the next free number in `docs/adr/`, which is 0002. The project keeps no ADR index, so there was nothing to update there.

**Rejected alternatives in the record:** JSON files (turned down by the owner), a server database such as PostgreSQL, and the async `sqlite3` package or Node's built-in `node:sqlite`.

`decisions.md` has the header `result=passed attempt=1 commit=1974551e56098546808c9d98f463a82e5794959b` and one line listing the record.

Files:
- $CASES/N/main/.claude/worktrees/feat/docs/adr/0002-store-user-preferences-in-sqlite.md
- $CASES/N/main/.claude/worktrees/feat/openspec/changes/feat/decisions.md
```

The live hook decisions of the run (`DEVKIT_HOOK_LOG` of the worktree's `guard.mjs`; mode, agent, decision, why, count). The run's transcript holds no typed `/devkit change` command, so the stop and hand-off locks read no run (`no-run`); the planner's stop is judged by the `guard.mjs subagent-stop` calls of the case, with the run transcript they name:

```text
agent devkit-core:adr-author allow (no-run) x1
stop session allow (no-run) x2
subagent-stop devkit-core:adr-author allow (no-run) x1
```

```text
(in $CASES/N/main/.claude/worktrees/feat)
$ ls -1 docs/adr
0001-start.md
0002-store-user-preferences-in-sqlite.md
[exit 0]
```

```text
(in $CASES/N/main/.claude/worktrees/feat)
$ cat openspec/changes/feat/decisions.md
<!-- devkit-stage decisions result=passed attempt=1 commit=1974551e56098546808c9d98f463a82e5794959b -->
# Decisions and ADRs

- ADR: `docs/adr/0002-store-user-preferences-in-sqlite.md` — Store user preferences in SQLite
[exit 0]
```

```text
(in $CASES/N/main/.claude/worktrees/feat)
$ head -12 docs/adr/0002-store-user-preferences-in-sqlite.md
# ADR 0002: Store user preferences in SQLite

- Status: proposed

## Context

The app is a Node.js service with its code in `src/` and no storage today. Change `feat` must persist each user's
preferences across process restarts (`openspec/changes/feat/requirements.md`, AC-1 to AC-3). This is the app's first
persistent store. Every later feature will read preferences through it, so changing the storage later means migrating
every user's data. ADR 0001 records only the project's start and does not cover storage.

## Decision
[exit 0]
```

```text
(in $CASES/N/main/.claude/worktrees/feat)
$ git status --short
 M openspec/changes/feat/requirements.md
?? docs/adr/0002-store-user-preferences-in-sqlite.md
?? openspec/changes/feat/decisions.md
[exit 0]
```

Done-condition of S-5 (task 7.4):

```text
holds: the claude -p run exited 0 with one Agent call
holds: the record is docs/adr/0002-<slug>.md: 0002-store-user-preferences-in-sqlite.md
holds: no record is unnumbered
holds: decisions.md lists each: docs/adr/0002-store-user-preferences-in-sqlite.md
```

## S-6 K: a malformed note, refused once, then revised by the real planner (task 7.5; AC-1)

The files S-2's planner left (restored by S-3), with `release.md` seeded so that its bump is `big`: the planner's own note, its `release:` (or, with none, an added `release:`) line set to `big`.

Seeded in `$CASES/K/main/.claude/worktrees/prefs`:

```text
(in $CASES/K/main/.claude/worktrees/prefs)
$ cat openspec/changes/prefs/release.md
packs: []
release: big

## User preferences persist across restarts

- New `src/prefs.ts` with `getPref(user, key)` and `setPref(user, key, value)`: each user's preferences are stored in
  the SQLite file `data/app.db` (table `prefs`) and are read back after the app restarts; a preference never written
  reads as `null` (ADR [prefs]).
- New runtime dependency `better-sqlite3`. The app now keeps on-disk state in `data/`, which must persist across
  deployments and be backed up; `data/` is ignored by git.
- `npm test` runs the test suite with Node's built-in test runner.
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/prefs)
$ node $DEV/change-loop.mjs next --change prefs --lang en
devkit-run: prefs
{
  "version": 1,
  "change": "prefs",
  "script": "devkit",
  "root": "$CASES/K/main/.claude/worktrees/prefs",
  "branch": "prefs",
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
  "brief": "Change prefs (devkit script), stage readiness: review the plan. Work only in $CASES/K/main/.claude/worktrees/prefs on branch prefs; every file path is absolute under it; start every Bash command with cd $CASES/K/main/.claude/worktrees/prefs && ; do not fetch. Write the change's files in English.",
  "progressKey": "readiness/readiness@f13834385473",
  "icon": "📝",
  "state": {
    "state": "running",
    "reason": null,
    "stage": "readiness",
    "stageTitle": "Plan readiness",
    "phase": null,
    "stageIcon": "📝",
    "stateIcon": null,
    "title": "📝 prefs"
  },
  "sessionTitle": "📝 prefs"
}
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/prefs)
$ echo '{"session_id":"S-6","transcript_path":"$CASES/runs/S-6.transcript.jsonl","cwd":"$CASES/K/main/.claude/worktrees/prefs","hook_event_name":"SubagentStop","stop_hook_active":false,"agent_type":"devkit-core:change-planner","agent_id":"S-6-planner","background_tasks":[]}' | DEVKIT_HOOK_LOG=$CASES/runs/S-6.guard.jsonl node $DEV/guard.mjs subagent-stop
devkit guard: openspec/changes/prefs/release.md cannot be read: release.md: release: "big" is not patch, minor or major
[exit 2]
```

```text
$CASES/runs/S-6.guard.jsonl, its new line:
{"at":"2026-11-24T18:17:10.206Z","mode":"subagent-stop","session":"S-6","agentType":"devkit-core:change-planner","change":"prefs","decision":"refuse","why":"no-release-note"}
```

```text
(in $CASES/K/main/.claude/worktrees/prefs)
$ echo '{"session_id":"S-6","transcript_path":"$CASES/runs/S-6.transcript.jsonl","cwd":"$CASES/K/main/.claude/worktrees/prefs","hook_event_name":"SubagentStop","stop_hook_active":false,"agent_type":"devkit-core:change-planner","agent_id":"S-6-planner","background_tasks":[]}' | DEVKIT_HOOK_LOG=$CASES/runs/S-6.guard.jsonl node $DEV/guard.mjs subagent-stop
(no output)
[exit 0]
```

```text
$CASES/runs/S-6.guard.jsonl, its new line:
{"at":"2026-11-24T18:17:12.037Z","mode":"subagent-stop","session":"S-6","agentType":"devkit-core:change-planner","change":"prefs","decision":"allow","why":"same-state"}
```

Seeded (the readiness review that failed on the note, the revision brief's source) in `$CASES/K/main/.claude/worktrees/prefs`:

```text
(in $CASES/K/main/.claude/worktrees/prefs)
$ cat openspec/changes/prefs/readiness.md
<!-- devkit-stage readiness result=failed attempt=1 commit=1345cb60e627f4f33b8fe90303b0bce9b2593f21 -->
# Readiness review: prefs

## 1. Decision
- Status: NEEDS-REVISION
- Confidence: high
- Ready to implement: no

## 9. Mandatory fixes before implementation
- [ ] Mandatory before implementation — openspec/changes/prefs/release.md — the release note cannot be read (`release.md: release: "big" is not patch, minor or major`), so the delivery cannot assign the release — state the bump as patch, minor or major
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/prefs)
$ node $DEV/change-loop.mjs next --change prefs --lang en
devkit-run: prefs
{
  "version": 1,
  "change": "prefs",
  "script": "devkit",
  "root": "$CASES/K/main/.claude/worktrees/prefs",
  "branch": "prefs",
  "filesLanguage": "en",
  "kind": "agent",
  "stage": "proposal",
  "stageTitle": "Proposal",
  "role": "change-planner",
  "skills": [],
  "model": "opus",
  "agent": "devkit-core:change-planner",
  "brief": "Change prefs (devkit script), stage proposal: readiness failed at attempt 1 of 3: revise the plan from its findings. Work only in $CASES/K/main/.claude/worktrees/prefs on branch prefs; every file path is absolute under it; start every Bash command with cd $CASES/K/main/.claude/worktrees/prefs && ; do not fetch. Write the change's files in English.",
  "progressKey": "proposal/proposal@79c86302c88e",
  "icon": "📝",
  "state": {
    "state": "running",
    "reason": null,
    "stage": "proposal",
    "stageTitle": "Proposal",
    "phase": null,
    "stageIcon": "📝",
    "stateIcon": null,
    "title": "📝 prefs"
  },
  "sessionTitle": "📝 prefs"
}
[exit 0]
```

The real agent, run in `$CASES/K/main/.claude/worktrees/prefs` (the prompt on standard input; 0.4 min):

```text
(in $CASES/K/main/.claude/worktrees/prefs)
$ TMPDIR=$CASES/tmp DEVKIT_HOOK_LOG=$CASES/runs/S-6.hooks.jsonl claude -p --model sonnet --permission-mode bypassPermissions --plugin-dir $WT/plugins/core --plugin-dir $WT/plugins/openspec --output-format stream-json --verbose < prompt.txt
[exit 0]
```

The prompt (`prompt.txt`), the brief being the `brief` field of the `next` above, verbatim:

```text
This session is the conducting session of the devkit change `prefs` in a scratch project. It hands one stage to its agent, as the `devkit` skill's Loop does for an `agent` action; the loop's `next` gave this action: stage `proposal`, agent `devkit-core:change-planner`, model `opus`.

Make exactly one Agent call: subagent_type `devkit-core:change-planner`, model `opus`, and as its prompt this brief, verbatim:

Change prefs (devkit script), stage proposal: readiness failed at attempt 1 of 3: revise the plan from its findings. Work only in $CASES/K/main/.claude/worktrees/prefs on branch prefs; every file path is absolute under it; start every Bash command with cd $CASES/K/main/.claude/worktrees/prefs && ; do not fetch. Write the change's files in English.

Do nothing else: run no command, read or write no file yourself, and make no other Agent call. When the agent returns, reply with its final message, verbatim.
```

From the run's stream-json output (kept in the scratch folder while the proof ran):

```text
session: 0e06e75f-5da8-4098-80d9-930e3f6923bd; conducting model: claude-sonnet-5-5; permission mode: bypassPermissions
plugin devkit-core 0.15.0 from $WT/plugins/core
plugin devkit-openspec 0.40.0 from $WT/plugins/openspec
Agent calls of the conducting session: 1
Agent call: subagent_type=devkit-core:change-planner model=opus prompt-is-the-brief=yes
the agent's model: claude-opus-5-5
the agent's task: completed (task notification)
last result: success is_error=false turns=1 cost_usd=0.26376130000000003
```

The tools the agent called, in order:

```text
Bash cat openspec/changes/prefs/readiness.md; ls -R openspec docs; cat openspec/config.yaml; git diff
Bash cat openspec/changes/prefs/release.md; echo ---; cat package.json; ls plugins 2>/dev/null; echo ---; cat openspec/changes/prefs/proposal.md | head -60
Bash grep -rn -i "big\|minor\|major\|patch\|release" openspec/changes/prefs/*.md | grep -v readiness.md
Edit $CASES/K/main/.claude/worktrees/prefs/openspec/changes/prefs/release.md
Bash (openspec validate prefs --strict 2>&1 || true); head -3 openspec/changes/prefs/release.md
```

The agent's final message (its last text; the conducting session ran it as a background agent):

```text
The readiness review's one mandatory fix is done. In `release.md`, the bump line said `release: big`, which isn't a valid value, so it now says `release: minor`. Minor fits because this change adds a new capability that doesn't break anything: per the proposal, nothing reads or writes preferences today. `openspec validate prefs --strict` passes. No other part of the plan mentioned the bump, so nothing else needed changing.

1. Change directory: $CASES/K/main/.claude/worktrees/prefs/openspec/changes/prefs
2. Files written:
   - `openspec/changes/prefs/release.md`
3. ADRs and specs read:
   - `openspec/changes/prefs/readiness.md` (the review findings: one mandatory fix, the bump in `release.md`)
   - `openspec/changes/prefs/proposal.md` (says there is no breaking change, which supports `minor`)
   - `openspec/config.yaml` (`devkit.release_tag: package.json`)
   - `package.json` (version 1.4.0, not a pack manifest)
4. Escalations: none.
5. Next step: Run the plan-readiness-review skill on `openspec/changes/prefs` (or the adr-reviewer and spec-reviewer agents in parallel; in OpenSpec mode also `openspec validate prefs`). Implementation starts only after an approved plan.

Outcome: planned
```

The live hook decisions of the run (`DEVKIT_HOOK_LOG` of the worktree's `guard.mjs`; mode, agent, decision, why, count). The run's transcript holds no typed `/devkit change` command, so the stop and hand-off locks read no run (`no-run`); the planner's stop is judged by the `guard.mjs subagent-stop` calls of the case, with the run transcript they name:

```text
agent devkit-core:change-planner allow (no-run) x1
stop session allow (no-run) x2
subagent-stop devkit-core:change-planner allow (no-run) x1
```

```text
(in $CASES/K/main/.claude/worktrees/prefs)
$ node $DEV/change-loop.mjs next --change prefs --lang en
devkit-run: prefs
{
  "version": 1,
  "change": "prefs",
  "script": "devkit",
  "root": "$CASES/K/main/.claude/worktrees/prefs",
  "branch": "prefs",
  "filesLanguage": "en",
  "kind": "agent",
  "stage": "proposal",
  "stageTitle": "Proposal",
  "role": "change-planner",
  "skills": [],
  "model": "opus",
  "agent": "devkit-core:change-planner",
  "brief": "Change prefs (devkit script), stage proposal: readiness failed at attempt 1 of 3: revise the plan from its findings. Work only in $CASES/K/main/.claude/worktrees/prefs on branch prefs; every file path is absolute under it; start every Bash command with cd $CASES/K/main/.claude/worktrees/prefs && ; do not fetch. Write the change's files in English.",
  "progressKey": "proposal/proposal@cd14368b3f6a",
  "icon": "📝",
  "state": {
    "state": "running",
    "reason": null,
    "stage": "proposal",
    "stageTitle": "Proposal",
    "phase": null,
    "stageIcon": "📝",
    "stateIcon": null,
    "title": "📝 prefs"
  },
  "sessionTitle": "📝 prefs"
}
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/prefs)
$ ls -1R openspec/changes/prefs
openspec/changes/prefs:
decisions.md
design.md
proposal.md
readiness.md
release.md
requirements.md
specs
tasks.md

openspec/changes/prefs/specs:
user-preferences

openspec/changes/prefs/specs/user-preferences:
spec.md
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/prefs)
$ cat openspec/changes/prefs/tasks.md
<!-- devkit-stage tasks result=passed attempt=1 commit=1345cb60e627f4f33b8fe90303b0bce9b2593f21 -->
# Tasks

- Change: `prefs`
- Date: 2026-11-24
- Owner: kaue rodrigues dos santos
- PRD / tech spec: n/a
- Links: [proposal.md](proposal.md), [design.md](design.md), [specs/user-preferences/spec.md](specs/user-preferences/spec.md)

No task bumps the version, edits `CHANGELOG.md` or numbers ADR [prefs]: those are written at the merge from
[release.md](release.md). The repository has no `docs/` page for modules, so the only documentation is the doc comment
on the two exports (task 2.2); ADR [prefs] is already written.

## 1. Setup (phase 1)

- [ ] 1.1 Add the runtime and tooling to `package.json` (design D5, D6): run `npm install better-sqlite3` (writes
  `dependencies.better-sqlite3` and `package-lock.json`), add `"type": "module"` and the script
  `"test": "node --test \"src/**/*.test.ts\""`. Verify: `npm ls better-sqlite3` exits 0 and `package.json` shows the
  three fields.
- [ ] 1.9 Gate: `node --input-type=module -e "import Database from 'better-sqlite3'; new Database(':memory:').close()"`
  exits 0 (the native module loads on this platform). If it cannot be made to load, stop and escalate (design, Risks).

## 2. App: preference store (phase 2)

- [ ] 2.1 Write `src/prefs.test.ts` first (design D6): one `node:test` test per spec scenario, each in a fresh temp
  folder through child processes — exports exist; write-then-read; overwrite; two users with the same key; the `prefs`
  table exists in `data/app.db` (AC-1); write in one child, read in a second child (AC-2); empty store and unwritten key
  read `null` (AC-3). Verify: `npm test` runs these tests and they fail because `src/prefs.ts` does not exist yet.
- [ ] 2.2 Create `src/prefs.ts` (design D2, D3, D4): lazy open of `path.resolve(process.cwd(), 'data', 'app.db')` with
  `data/` created if missing, `CREATE TABLE IF NOT EXISTS prefs`, prepared upsert in `setPref`, prepared select in
  `getPref` returning `null` when no row, and a doc comment on each export stating its contract. Verify: every test from
  2.1 passes with `npm test`.
- [ ] 2.3 Add `data/` to `.gitignore` (design D7). Verify: `git check-ignore data/app.db` exits 0.
- [ ] 2.9 Gate: `npm test` exits 0 — covers AC-1, AC-2, AC-3.

## 3. Validation and cleanup (phase 3)

- [ ] 3.1 Confirm no leftovers: after `npm test`, `git status --porcelain` lists no `data/` path and no temp folder in
  the repository, and `src/app.ts` is unchanged (`git diff --exit-code main -- src/app.ts` exits 0).
- [ ] 3.9 Gate: `npm test` and `openspec validate prefs --strict` both exit 0 — covers AC-1, AC-2, AC-3 end to end.
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/prefs)
$ git status --short
 M openspec/changes/prefs/requirements.md
?? docs/adr/prefs.md
?? openspec/changes/prefs/decisions.md
?? openspec/changes/prefs/design.md
?? openspec/changes/prefs/proposal.md
?? openspec/changes/prefs/readiness.md
?? openspec/changes/prefs/release.md
?? openspec/changes/prefs/specs/
?? openspec/changes/prefs/tasks.md
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/prefs)
$ cat openspec/changes/prefs/release.md
packs: []
release: minor

## User preferences persist across restarts

- New `src/prefs.ts` with `getPref(user, key)` and `setPref(user, key, value)`: each user's preferences are stored in
  the SQLite file `data/app.db` (table `prefs`) and are read back after the app restarts; a preference never written
  reads as `null` (ADR [prefs]).
- New runtime dependency `better-sqlite3`. The app now keeps on-disk state in `data/`, which must persist across
  deployments and be backed up; `data/` is ignored by git.
- `npm test` runs the test suite with Node's built-in test runner.
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/prefs)
$ node -e "import('$DEV/deliver-check.mjs').then((m) => console.log(JSON.stringify(m.parseReleaseNote(fs.readFileSync('openspec/changes/prefs/release.md', 'utf8')), null, 2)))"
{
  "packs": [],
  "marketplace": null,
  "marketplaceGiven": false,
  "release": "minor",
  "title": "User preferences persist across restarts",
  "body": "- New `src/prefs.ts` with `getPref(user, key)` and `setPref(user, key, value)`: each user's preferences are stored in\n  the SQLite file `data/app.db` (table `prefs`) and are read back after the app restarts; a preference never written\n  reads as `null` (ADR [prefs]).\n- New runtime dependency `better-sqlite3`. The app now keeps on-disk state in `data/`, which must persist across\n  deployments and be backed up; `data/` is ignored by git.\n- `npm test` runs the test suite with Node's built-in test runner."
}
[exit 0]
```

The plan snapshot (`git read-tree HEAD`, `git add` of the files `git ls-files -m -o --exclude-standard` lists, and `git write-tree` with `GIT_INDEX_FILE=$CASES/tmp/index-prefs`, then `git commit-tree <tree> -p HEAD`): feb4d938a164.

```text
(in $CASES/K/main/.claude/worktrees/prefs)
$ node -e "<releaseStateAt of $DEV/deliver-check.mjs: the snapshot feb4d938a164 against origin/main, the note of openspec/changes/prefs/release.md, file package.json, the records changeAdrs lists>"
{"kind":"unassigned","error":null,"paths":[],"adrs":[{"slug":"prefs","folder":"docs/adr","from":"docs/adr/prefs.md","to":"docs/adr/0002-prefs.md","number":"0002"}]}
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/prefs)
$ node $DEV/change-loop.mjs next --change prefs --lang en
devkit-run: prefs
{
  "version": 1,
  "change": "prefs",
  "script": "devkit",
  "root": "$CASES/K/main/.claude/worktrees/prefs",
  "branch": "prefs",
  "filesLanguage": "en",
  "kind": "agent",
  "stage": "proposal",
  "stageTitle": "Proposal",
  "role": "change-planner",
  "skills": [],
  "model": "opus",
  "agent": "devkit-core:change-planner",
  "brief": "Change prefs (devkit script), stage proposal: readiness failed at attempt 1 of 3: revise the plan from its findings. Work only in $CASES/K/main/.claude/worktrees/prefs on branch prefs; every file path is absolute under it; start every Bash command with cd $CASES/K/main/.claude/worktrees/prefs && ; do not fetch. Write the change's files in English.",
  "progressKey": "proposal/proposal@cd14368b3f6a",
  "icon": "📝",
  "state": {
    "state": "running",
    "reason": null,
    "stage": "proposal",
    "stageTitle": "Proposal",
    "phase": null,
    "stageIcon": "📝",
    "stateIcon": null,
    "title": "📝 prefs"
  },
  "sessionTitle": "📝 prefs"
}
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/prefs)
$ echo '{"session_id":"S-6-revised","transcript_path":"$CASES/runs/S-6-revised.transcript.jsonl","cwd":"$CASES/K/main/.claude/worktrees/prefs","hook_event_name":"SubagentStop","stop_hook_active":false,"agent_type":"devkit-core:change-planner","agent_id":"S-6-revised-planner","background_tasks":[]}' | DEVKIT_HOOK_LOG=$CASES/runs/S-6-revised.guard.jsonl node $DEV/guard.mjs subagent-stop
(no output)
[exit 0]
```

```text
$CASES/runs/S-6-revised.guard.jsonl, its new line:
{"at":"2026-11-24T18:17:45.847Z","mode":"subagent-stop","session":"S-6-revised","agentType":"devkit-core:change-planner","change":"prefs","decision":"allow","why":"not-pending"}
```

What the loop hands after the revision: devkit-core:change-planner ("Change prefs (devkit script), stage proposal: readiness failed at attempt 1 of 3: revise the plan from its findings"). The revision changed only `release.md`, which is not one of the readiness stage's `staleAfter` files (mockup, decisions, proposal, specs, design, tasks), so flow-check does not read the failed review as answered and hands the planner the same revision brief again; the readiness review does not run until a stage file changes. Reported to the owner as a design gap (D-9 says flow-check needs no other change).

Done-condition of S-6 (task 7.5):

```text
holds: the first stop is refused with release.md: and the field
holds: the second stop goes through (same-state)
holds: the revised release.md reads
holds: the delivery can release it: the state computeRelease gives is unassigned
holds: the revised plan's stop goes through (allow not-pending)
```

## S-7 N: the change-planner with no devkit.release_tag writes no note (task 7.5; AC-1, AC-9)

The change `feat` of S-5, with the decisions stage the adr-author passed there.

```text
(in $CASES/N/main/.claude/worktrees/feat)
$ node $DEV/change-loop.mjs next --change feat --lang en
devkit-run: feat
{
  "version": 1,
  "change": "feat",
  "script": "devkit",
  "root": "$CASES/N/main/.claude/worktrees/feat",
  "branch": "feat",
  "filesLanguage": "en",
  "kind": "agent",
  "stage": "proposal",
  "stageTitle": "Proposal",
  "role": "change-planner",
  "skills": [],
  "model": "opus",
  "agent": "devkit-core:change-planner",
  "brief": "Change feat (devkit script), stage proposal: write the plan files the script still lacks, from proposal on, each from `openspec instructions <artifact> --change feat`. Work only in $CASES/N/main/.claude/worktrees/feat on branch feat; every file path is absolute under it; start every Bash command with cd $CASES/N/main/.claude/worktrees/feat && ; do not fetch. Write the change's files in English.",
  "progressKey": "proposal/proposal@13487084fb6b",
  "icon": "📝",
  "state": {
    "state": "running",
    "reason": null,
    "stage": "proposal",
    "stageTitle": "Proposal",
    "phase": null,
    "stageIcon": "📝",
    "stateIcon": null,
    "title": "📝 feat"
  },
  "sessionTitle": "📝 feat"
}
[exit 0]
```

The real agent, run in `$CASES/N/main/.claude/worktrees/feat` (the prompt on standard input; 2.3 min):

```text
(in $CASES/N/main/.claude/worktrees/feat)
$ TMPDIR=$CASES/tmp DEVKIT_HOOK_LOG=$CASES/runs/S-7.hooks.jsonl claude -p --model sonnet --permission-mode bypassPermissions --plugin-dir $WT/plugins/core --plugin-dir $WT/plugins/openspec --output-format stream-json --verbose < prompt.txt
[exit 0]
```

The prompt (`prompt.txt`), the brief being the `brief` field of the `next` above, verbatim:

```text
This session is the conducting session of the devkit change `feat` in a scratch project. It hands one stage to its agent, as the `devkit` skill's Loop does for an `agent` action; the loop's `next` gave this action: stage `proposal`, agent `devkit-core:change-planner`, model `opus`.

Make exactly one Agent call: subagent_type `devkit-core:change-planner`, model `opus`, and as its prompt this brief, verbatim:

Change feat (devkit script), stage proposal: write the plan files the script still lacks, from proposal on, each from `openspec instructions <artifact> --change feat`. Work only in $CASES/N/main/.claude/worktrees/feat on branch feat; every file path is absolute under it; start every Bash command with cd $CASES/N/main/.claude/worktrees/feat && ; do not fetch. Write the change's files in English.

Do nothing else: run no command, read or write no file yourself, and make no other Agent call. When the agent returns, reply with its final message, verbatim.
```

From the run's stream-json output (kept in the scratch folder while the proof ran):

```text
session: a862ea34-6707-4989-bdea-fd4fe0d0ca9f; conducting model: claude-sonnet-5-5; permission mode: bypassPermissions
plugin devkit-core 0.15.0 from $WT/plugins/core
plugin devkit-openspec 0.40.0 from $WT/plugins/openspec
Agent calls of the conducting session: 1
Agent call: subagent_type=devkit-core:change-planner model=opus prompt-is-the-brief=yes
the agent's model: claude-opus-5-5
the agent's task: completed (task notification)
last result: success is_error=false turns=1 cost_usd=0.6490054999999999
```

The tools the agent called, in order:

```text
Bash git status --short && find . -path ./.git -prune -o -type f -print | grep -v node_modules | head -100 && cat openspec/config.yaml && ls openspec/changes/feat
Bash cat openspec/changes/feat/requirements.md openspec/changes/feat/decisions.md openspec/changes/feat/.openspec.yaml docs/adr/*.md package.json src/app.ts CHANGELOG.md .github/workflows/devkit-reviews.yml; git diff; ls
Bash cat .gitignore; echo ---; cat openspec/schemas/devkit/schema.yaml; echo ---; cat openspec/schemas/devkit/flow.json openspec/schemas/devkit/flows/2.json; which openspec; openspec status --change feat 2>&1 | head -40
Bash openspec status --change feat 2>&1 | head -40; for a in proposal specs design tasks; do echo "=== $a"; openspec instructions $a --change feat --json 2>&1; done
Bash grep -n -A30 "id: mockup" openspec/schemas/devkit/schema.yaml | head -50; cat openspec/schemas/devkit/flows/2.json | head -80; grep -rn "release_tag" openspec/ | head; node --version; openspec list --specs; ls opens
Write $CASES/N/main/.claude/worktrees/feat/openspec/changes/feat/proposal.md
Write $CASES/N/main/.claude/worktrees/feat/openspec/changes/feat/specs/user-preferences/spec.md
Write $CASES/N/main/.claude/worktrees/feat/openspec/changes/feat/design.md
Write $CASES/N/main/.claude/worktrees/feat/openspec/changes/feat/tasks.md
Bash openspec validate feat --strict; echo exit=$?; git rev-parse HEAD
Bash for f in proposal.md design.md tasks.md specs/user-preferences/spec.md; do sed -i '1s/result=pending attempt=1 commit=none/result=passed attempt=1 commit=1974551e56098546808c9d98f463a82e5794959b/' openspec/changes/f
```

The agent's final message (its last text; the conducting session ran it as a background agent):

```text
I've written the plan for the `feat` change: a proposal, a spec delta, a design and a task list. `openspec validate feat --strict` passes, and each file's first line is now marked `result=passed`.

1. Change directory: `$CASES/N/main/.claude/worktrees/feat/openspec/changes/feat`

2. Files written:
   - `$CASES/N/main/.claude/worktrees/feat/openspec/changes/feat/proposal.md`
   - `$CASES/N/main/.claude/worktrees/feat/openspec/changes/feat/specs/user-preferences/spec.md`
   - `$CASES/N/main/.claude/worktrees/feat/openspec/changes/feat/design.md`
   - `$CASES/N/main/.claude/worktrees/feat/openspec/changes/feat/tasks.md`
   - I wrote no `release.md` because `openspec/config.yaml` has no `devkit.release_tag` setting.
   - The mockup stage doesn't apply because the change has no screens.

3. ADRs and specs read:
   - `docs/adr/0001-start.md`: only records that the project started; it doesn't constrain this change.
   - `docs/adr/0002-store-user-preferences-in-sqlite.md` (status `proposed`): fixes SQLite at `data/app.db`, a `prefs` table, the `better-sqlite3` package, and `src/prefs.ts` as the only module that touches the table.
   - `openspec/changes/feat/requirements.md` and `decisions.md`: AC-1 to AC-3. No code has been merged since the requirements were written (HEAD is still `1974551`).
   - Existing specs: there are none, so `user-preferences` is a new capability.

4. Escalations: none. These are choices I made in the design that a reviewer should check:
   - **Values are strings only.** `getPref` returns `string | null`, so `null` can only mean "never written" (AC-3).
   - **The database path doesn't depend on the working directory.** It is resolved from the module's own location to `<repo>/data/app.db`.
   - **The repo had no test command, so the plan adds one.** Tasks 1.2 and 2.x add `"test": "node --test \"src/**/*.test.ts\""` to `package.json`. It relies on Node 26 running `.ts` files directly; the local version is v26.13.1.
   - **The restart test (AC-2) uses two real Node processes.** One writes and exits, then a new one reads.
   - **The biggest risk is installing `better-sqlite3` on Node 26.** It's a native module and may not have a ready-made build. Task 1.1 checks this before any code is written; if it can't be built, the plan says to stop and escalate.

5. Next step: run the plan-readiness-review skill on `$CASES/N/main/.claude/worktrees/feat/openspec/changes/feat` (or the adr-reviewer and spec-reviewer agents in parallel, plus `openspec validate feat`). Implementation starts only after the plan is approved.

Outcome: planned
```

The live hook decisions of the run (`DEVKIT_HOOK_LOG` of the worktree's `guard.mjs`; mode, agent, decision, why, count). The run's transcript holds no typed `/devkit change` command, so the stop and hand-off locks read no run (`no-run`); the planner's stop is judged by the `guard.mjs subagent-stop` calls of the case, with the run transcript they name:

```text
agent devkit-core:change-planner allow (no-run) x1
stop session allow (no-run) x2
subagent-stop devkit-core:change-planner allow (no-run) x1
```

```text
(in $CASES/N/main/.claude/worktrees/feat)
$ node $DEV/change-loop.mjs next --change feat --lang en
devkit-run: feat
{
  "version": 1,
  "change": "feat",
  "script": "devkit",
  "root": "$CASES/N/main/.claude/worktrees/feat",
  "branch": "feat",
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
  "brief": "Change feat (devkit script), stage readiness: review the plan. Work only in $CASES/N/main/.claude/worktrees/feat on branch feat; every file path is absolute under it; start every Bash command with cd $CASES/N/main/.claude/worktrees/feat && ; do not fetch. Write the change's files in English.",
  "progressKey": "readiness/readiness@17c0d6d5c236",
  "icon": "📝",
  "state": {
    "state": "running",
    "reason": null,
    "stage": "readiness",
    "stageTitle": "Plan readiness",
    "phase": null,
    "stageIcon": "📝",
    "stateIcon": null,
    "title": "📝 feat"
  },
  "sessionTitle": "📝 feat"
}
[exit 0]
```

```text
(in $CASES/N/main/.claude/worktrees/feat)
$ ls -1R openspec/changes/feat
openspec/changes/feat:
decisions.md
design.md
proposal.md
requirements.md
specs
tasks.md

openspec/changes/feat/specs:
user-preferences

openspec/changes/feat/specs/user-preferences:
spec.md
[exit 0]
```

```text
(in $CASES/N/main/.claude/worktrees/feat)
$ cat openspec/changes/feat/tasks.md
<!-- devkit-stage tasks result=passed attempt=1 commit=1974551e56098546808c9d98f463a82e5794959b -->
# Tasks

- Change: `feat`
- Date: 2026-11-24
- Owner: kaue rodrigues dos santos
- PRD / tech spec: n/a
- Links: [proposal.md](proposal.md), [design.md](design.md), [spec delta](specs/user-preferences/spec.md)

No documentation task: the repo has no README or docs for code, and ADR 0002 already records the storage.

## 1. Setup

- [ ] 1.1 Add `better-sqlite3` as a dependency with `npm install better-sqlite3` (touches `package.json`, creates `package-lock.json`); verify `node -e "new (require('better-sqlite3'))(':memory:').prepare('select 1 as x').get()"` exits 0 (design.md, Risks: native build)
- [ ] 1.2 Add the script `"test": "node --test \"src/**/*.test.ts\""` to `package.json` (design.md D5); verify `npm pkg get scripts.test` prints it
- [ ] 1.3 Add `data/` to `.gitignore` (ADR 0002, Consequences); verify `git check-ignore data/app.db` prints `data/app.db`
- [ ] 1.9 Gate: `npm ls better-sqlite3` exits 0

## 2. Preferences store (`src/`)

- [ ] 2.1 Write `src/prefs.test.ts` (design.md D5) with tests for: value written is read back (AC-1), second write replaces the first, key never written returns `null` (AC-3), key written only for another user returns `null`, and read after restart across two `execFileSync` child processes (AC-2); verify `npm test` fails because `src/prefs.ts` does not exist yet (red step, not a gate)
- [ ] 2.2 Implement `src/prefs.ts` exporting `getPref(user, key): string | null` and `setPref(user, key, value): void`, opening `<repo>/data/app.db` lazily, creating `data/` and the `prefs` table if missing, with the upsert and select of design.md D2–D4, erasable TypeScript only; verify every test in `src/prefs.test.ts` passes with `npm test`
- [ ] 2.3 Confirm the database lands where AC-1 says: after `npm test`, `node -e "console.log(require('better-sqlite3')('data/app.db').prepare(\"select name from sqlite_master where name='prefs'\").get().name)"` prints `prefs`
- [ ] 2.9 Gate: `npm test` green; covers AC-1, AC-2, AC-3

## 3. Validation

- [ ] 3.1 Gate: `npm test` and `openspec validate feat --strict` both exit 0, and `git status --porcelain data/` prints nothing (the database stays out of version control); covers AC-1, AC-2, AC-3
[exit 0]
```

```text
(in $CASES/N/main/.claude/worktrees/feat)
$ git status --short
 M openspec/changes/feat/requirements.md
?? docs/adr/0002-store-user-preferences-in-sqlite.md
?? openspec/changes/feat/decisions.md
?? openspec/changes/feat/design.md
?? openspec/changes/feat/proposal.md
?? openspec/changes/feat/specs/
?? openspec/changes/feat/tasks.md
[exit 0]
```

```text
(in $CASES/N/main/.claude/worktrees/feat)
$ node $DEV/change-loop.mjs next --change feat --lang en
devkit-run: feat
{
  "version": 1,
  "change": "feat",
  "script": "devkit",
  "root": "$CASES/N/main/.claude/worktrees/feat",
  "branch": "feat",
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
  "brief": "Change feat (devkit script), stage readiness: review the plan. Work only in $CASES/N/main/.claude/worktrees/feat on branch feat; every file path is absolute under it; start every Bash command with cd $CASES/N/main/.claude/worktrees/feat && ; do not fetch. Write the change's files in English.",
  "progressKey": "readiness/readiness@17c0d6d5c236",
  "icon": "📝",
  "state": {
    "state": "running",
    "reason": null,
    "stage": "readiness",
    "stageTitle": "Plan readiness",
    "phase": null,
    "stageIcon": "📝",
    "stateIcon": null,
    "title": "📝 feat"
  },
  "sessionTitle": "📝 feat"
}
[exit 0]
```

```text
(in $CASES/N/main/.claude/worktrees/feat)
$ echo '{"session_id":"S-7","transcript_path":"$CASES/runs/S-7.transcript.jsonl","cwd":"$CASES/N/main/.claude/worktrees/feat","hook_event_name":"SubagentStop","stop_hook_active":false,"agent_type":"devkit-core:change-planner","agent_id":"S-7-planner","background_tasks":[]}' | DEVKIT_HOOK_LOG=$CASES/runs/S-7.guard.jsonl node $DEV/guard.mjs subagent-stop
(no output)
[exit 0]
```

```text
$CASES/runs/S-7.guard.jsonl, its new line:
{"at":"2026-11-24T18:12:29.869Z","mode":"subagent-stop","session":"S-7","agentType":"devkit-core:change-planner","change":"feat","decision":"allow","why":"delivered"}
```

```text
(in $CASES/N/main/.claude/worktrees/feat)
$ node $DEV/deliver-check.mjs feat --json   (its "next" and "approval")
{
  "next": {
    "step": "stop-not-approved",
    "reason": "readiness.md Status is missing, expected APPROVED; the plan needs its approval first"
  },
  "approval": {
    "status": null,
    "recorded": null,
    "readiness": null,
    "ok": false
  }
}
[exit 1]
```

Done-condition of S-7 (task 7.5):

```text
holds: no release.md is written
holds: the stop goes through with no refusal (allow delivered)
holds: no refusal record was written
holds: deliver-check feat --json shows no row N1 to N7 (next: stop-not-approved)
holds: the approval object has no release keys (D-9)
holds: the loop then hands the readiness review (devkit-core:plan-readiness-reviewer)
```

## S-8 K: the plan-readiness-reviewer on a plan with no release.md (task 7.6; AC-1, AC-14)

```text
(in $CASES/K/main)
$ node $DEV/change-loop.mjs open plan-a --script devkit --why capability --lang en <<< "Greet a user by name."
devkit-run: plan-a
{
  "version": 1,
  "change": "plan-a",
  "script": "devkit",
  "worktree": "$CASES/K/main/.claude/worktrees/plan-a",
  "branch": "plan-a",
  "base": "origin/main",
  "reply": "I opened the change plan-a on the full script, because it adds something the project cannot do today. Next come a few questions about your request; to use the short script instead, say so before the plan is written."
}
[exit 0]
```

Seeded (the plan stages, each passed) in `$CASES/K/main/.claude/worktrees/plan-a`:

```text
(in $CASES/K/main/.claude/worktrees/plan-a)
$ cat openspec/changes/plan-a/requirements.md
<!-- devkit-stage requirements result=passed attempt=1 commit=11db0453ae12975c2626875f693727c6442c5d56 -->
# Requirements

## Request

> Greet a user by name.

## Assumptions

- The app is a Node.js service; its code lives in `src/`.

## Acceptance criteria

- AC-1: `greet('Ana')` returns `Hello, Ana!`.
- AC-2: `greet('')` and `greet('  ')` return `Hello, friend!`.

## Out of scope

- Translations.
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/plan-a)
$ cat openspec/changes/plan-a/decisions.md
<!-- devkit-stage decisions result=not-applicable attempt=1 commit=11db0453ae12975c2626875f693727c6442c5d56 -->
# Decisions and ADRs

No record: a pure function with no boundary, contract or technology choice.
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/plan-a)
$ cat openspec/changes/plan-a/proposal.md
<!-- devkit-stage proposal result=passed attempt=1 commit=11db0453ae12975c2626875f693727c6442c5d56 -->
# Proposal

## Why

The app answers no greeting today; the owner wants `greet(name)` for the welcome screen.

## What Changes

- New `src/greet.ts` exporting `greet(name: string): string`, returning `Hello, <name>!`.
- An empty or blank name returns `Hello, friend!`.

## Acceptance criteria

- AC-1: `greet('Ana')` returns `Hello, Ana!`.
- AC-2: `greet('')` and `greet('  ')` return `Hello, friend!`.

## Capabilities

### New Capabilities
- `greeting`: the greeting the app gives a named user.

### Modified Capabilities

## Impact

- `src/greet.ts` (new), `src/greet.test.ts` (new). No dependency is added.
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/plan-a)
$ cat openspec/changes/plan-a/specs/greeting/spec.md
<!-- devkit-stage specs result=passed attempt=1 commit=11db0453ae12975c2626875f693727c6442c5d56 -->
## ADDED Requirements

### Requirement: The app greets a user by name
The app SHALL return `Hello, <name>!` from `greet(name)` for a non-blank name, and `Hello, friend!` for an empty or blank one.

#### Scenario: a named user
- **WHEN** `greet('Ana')` is called
- **THEN** it returns `Hello, Ana!`

#### Scenario: a blank name
- **WHEN** `greet('  ')` is called
- **THEN** it returns `Hello, friend!`
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/plan-a)
$ cat openspec/changes/plan-a/design.md
<!-- devkit-stage design result=passed attempt=1 commit=11db0453ae12975c2626875f693727c6442c5d56 -->
# Design

## Context

`src/app.ts` exports one function per endpoint; there is no greeting.

## Decisions

- `src/greet.ts` exports `greet(name: string): string`: `name.trim()` empty gives `Hello, friend!`, else `Hello, ${name.trim()}!`.
- Tests in `src/greet.test.ts` with `node --test` (no new dependency).

## Risks

- None beyond a wrong trim; the tests cover blank names.
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/plan-a)
$ cat openspec/changes/plan-a/tasks.md
<!-- devkit-stage tasks result=passed attempt=1 commit=11db0453ae12975c2626875f693727c6442c5d56 -->
# Tasks

## 1. Greeting

- [ ] 1.1 Write `src/greet.test.ts` (AC-1, AC-2: a name, an empty name, a blank name), see it fail, then write `src/greet.ts`. Done when `node --test src/` passes.
- [ ] 1.2 Gate: `node -e 0` green
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/plan-a)
$ node $DEV/change-loop.mjs next --change plan-a --lang en
devkit-run: plan-a
{
  "version": 1,
  "change": "plan-a",
  "script": "devkit",
  "root": "$CASES/K/main/.claude/worktrees/plan-a",
  "branch": "plan-a",
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
  "brief": "Change plan-a (devkit script), stage readiness: review the plan. Work only in $CASES/K/main/.claude/worktrees/plan-a on branch plan-a; every file path is absolute under it; start every Bash command with cd $CASES/K/main/.claude/worktrees/plan-a && ; do not fetch. Write the change's files in English.",
  "progressKey": "readiness/readiness@7726817b6d8d",
  "icon": "📝",
  "state": {
    "state": "running",
    "reason": null,
    "stage": "readiness",
    "stageTitle": "Plan readiness",
    "phase": null,
    "stageIcon": "📝",
    "stateIcon": null,
    "title": "📝 plan-a"
  },
  "sessionTitle": "📝 plan-a"
}
[exit 0]
```

The real agent, run in `$CASES/K/main/.claude/worktrees/plan-a` (the prompt on standard input; 0.7 min):

```text
(in $CASES/K/main/.claude/worktrees/plan-a)
$ TMPDIR=$CASES/tmp DEVKIT_HOOK_LOG=$CASES/runs/S-8.hooks.jsonl claude -p --model sonnet --permission-mode bypassPermissions --plugin-dir $WT/plugins/core --plugin-dir $WT/plugins/openspec --output-format stream-json --verbose < prompt.txt
[exit 0]
```

The prompt (`prompt.txt`), the brief being the `brief` field of the `next` above, verbatim:

```text
This session is the conducting session of the devkit change `plan-a` in a scratch project. It hands one stage to its agent, as the `devkit` skill's Loop does for an `agent` action; the loop's `next` gave this action: stage `readiness`, agent `devkit-core:plan-readiness-reviewer`, model `sonnet`.

Make exactly one Agent call: subagent_type `devkit-core:plan-readiness-reviewer`, model `sonnet`, and as its prompt this brief, verbatim:

Change plan-a (devkit script), stage readiness: review the plan. Work only in $CASES/K/main/.claude/worktrees/plan-a on branch plan-a; every file path is absolute under it; start every Bash command with cd $CASES/K/main/.claude/worktrees/plan-a && ; do not fetch. Write the change's files in English.

Do nothing else: run no command, read or write no file yourself, and make no other Agent call. When the agent returns, reply with its final message, verbatim.
```

From the run's stream-json output (kept in the scratch folder while the proof ran):

```text
session: b9a53a1c-b8ae-43a2-8f3d-5cd29cb8e390; conducting model: claude-sonnet-5-5; permission mode: bypassPermissions
plugin devkit-core 0.15.0 from $WT/plugins/core
plugin devkit-openspec 0.40.0 from $WT/plugins/openspec
Agent calls of the conducting session: 1
Agent call: subagent_type=devkit-core:plan-readiness-reviewer model=sonnet prompt-is-the-brief=yes
the agent's model: claude-sonnet-5-5
the agent's task: completed (task notification)
last result: success is_error=false turns=2 cost_usd=0.2766935
```

The tools the agent called, in order:

```text
Bash ls -R openspec | head -50; cat openspec/config.yaml; for f in proposal design tasks decisions requirements; do echo "=== $f"; cat -n openspec/changes/plan-a/$f.md; done; find openspec/changes/plan-a/specs -type f | 
Bash ls; ls src; cat package.json; cat src/app.ts | head -30; ls openspec/specs; openspec validate plan-a --strict 2>&1 | tail -15; node -e 0; echo gate=$?; head -3 openspec/changes/plan-a/readiness.md 2>&1
Bash node --version; ls docs; mkdir -p /tmp/rr && cd /tmp/rr && printf 'import {test} from "node:test";\ntest("x",()=>{});\n' > a.test.ts && node --test /tmp/rr/ 2>&1 | tail -8
Write $CASES/K/main/.claude/worktrees/plan-a/openspec/changes/plan-a/readiness.md
```

The agent's final message (its last text; the conducting session ran it as a background agent):

```text
Status: NEEDS-REVISION
Blockers: 1
Report: $CASES/K/main/.claude/worktrees/plan-a/openspec/changes/plan-a/readiness.md

- **Blocker:** `openspec/config.yaml` sets `devkit.release_tag: package.json`, so the change needs a `release.md`, and `openspec/changes/plan-a/release.md` does not exist. It needs a `packs:` line and a `## <title>` with a body.
- **Non-blocking findings:**
  - `design.md:6` says `src/app.ts` exports one function per endpoint. It actually contains only `export const app = 1;`.
  - The spec has no scenario for trimming a padded name such as `greet('  Ana ')`, which the design implies.
  - Running `.ts` tests with `node --test` depends on the Node version. A scratch `.ts` test passed on the installed v26.13.1, but `package.json` declares no minimum.
- **Checks:** `openspec validate plan-a --strict` passes. The `node -e 0` gate is green on the base.
```

The live hook decisions of the run (`DEVKIT_HOOK_LOG` of the worktree's `guard.mjs`; mode, agent, decision, why, count). The run's transcript holds no typed `/devkit change` command, so the stop and hand-off locks read no run (`no-run`); the planner's stop is judged by the `guard.mjs subagent-stop` calls of the case, with the run transcript they name:

```text
agent devkit-core:plan-readiness-reviewer allow (no-run) x1
subagent-stop devkit-core:plan-readiness-reviewer allow (no-run) x1
stop session allow (no-run) x1
```

```text
(in $CASES/K/main/.claude/worktrees/plan-a)
$ cat openspec/changes/plan-a/readiness.md
<!-- devkit-stage readiness result=failed attempt=1 commit=11db0453ae12975c2626875f693727c6442c5d56 -->
# Readiness review: plan-a

## Decision

- Status: NEEDS-REVISION

Blockers: 1. `openspec validate plan-a --strict` passes.

## Blockers

1. Critical, Mandatory before implementation. `openspec/config.yaml:5` names `devkit.release_tag: package.json`, so the change needs `openspec/changes/plan-a/release.md`. The file does not exist. Without it the delivery has no pack bump (`packs:` line) and no `## <title>` and body, so the merge cannot release the new `greet` function. Smallest correction: add `release.md` with a `packs:` line, one `- <pack>: patch|minor|major` line per pack (or `packs: []` if nothing is released), and a `## <title>` line with a body. Keep every task free of version, CHANGELOG and ADR-number edits. The current tasks already comply.

## Scope

correct. One function, two acceptance criteria, "Translations" out of scope (`requirements.md:17-19`).

## Claims checked against the code

- `design.md:6` says "`src/app.ts` exports one function per endpoint". Wrong. `src/app.ts:1` is `export const app = 1;` and there are no endpoints. Fix class: Fix during implementation (Low). Nothing depends on the claim, but reword the Context line.
- `src/greet.ts` and `src/greet.test.ts` do not exist, matching "new". `src/` is a real directory.
- `node --test src/` runs `.ts` files on the installed Node v26.13.1 (I ran a scratch `.ts` test and it passed). `package.json` has no `test` script and no `tsconfig`. Type stripping needs Node 22.6 or later, and `package.json` has no `engines` field. Fix class: Fix during implementation (Medium). Add the Node version assumption to `design.md`. Keep `greet.ts` to erasable syntax and use import specifiers with the `.ts` extension in the test.
- `node -e 0` (task 1.2 gate) exists and is green on the base. It checks nothing, so the real check is task 1.1's `node --test src/`.

## Specs

- The `greeting` capability is new and has an ADDED delta with SHALL language.
- AC-1 maps to the "a named user" scenario and AC-2 to the "a blank name" scenario. The empty-string case `greet('')` in AC-2 has no scenario of its own. Fix class: Nice to have. Add a scenario for `greet('')`.
- Whitespace around a non-blank name is trimmed (`design.md:10`: `Hello, ${name.trim()}!`). No requirement or scenario states that `greet('  Ana ')` returns `Hello, Ana!`. This is behavior in the design that lacks a spec. Fix class: Mandatory before implementation was not warranted, but add it during revision (Medium).

## Tasks

- Task 1.1 is executable and test-first, with a done condition. Task 1.2 is a trivial gate.
- Every task path is under `src/`.
- `decisions.md` marks no ADR as needed, which is reasonable for a pure function.

## Omissions

No findings for validation, errors, retries, auth, side effects, observability, rollback or migration. None of these apply to a pure function. Non-string input is not defined. TypeScript types cover it, so it is not a doubt.

## Execution-readiness

Major doubts for the next phase: 0 beyond the missing `release.md`. Two developers would implement the same function.

## Mandatory questions

1. Problem defined: yes.
2. Measurable: yes, AC-1 and AC-2.
3. Error behavior: blank handled; no other errors apply.
4. Edge cases: blank, empty and padded names. The padded name is not in the spec.
5. Dependencies: none.
6. Contracts: the signature is defined.
7. Different interpretations: only on trimming the output, see Specs.
8. Implicit decisions: the Node version needed to run `.ts` tests.
9. Tasks deliver the outcome: yes, but the release is not planned (blocker 1).
10. Found too late: the missing release note at merge time.

## Top production failures

1. The merge releases nothing, or fails the delivery contract, because `release.md` is missing.
2. A Node older than 22.6 cannot run `.ts` tests.
3. A padded name produces `Hello,  Ana !` if the trim is dropped, with no spec to catch it.
4. The task 1.2 gate passes while checking nothing.
5. The design Context line misleads the next reader.
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/plan-a)
$ git status --short
 M openspec/changes/plan-a/requirements.md
?? openspec/changes/plan-a/decisions.md
?? openspec/changes/plan-a/design.md
?? openspec/changes/plan-a/proposal.md
?? openspec/changes/plan-a/readiness.md
?? openspec/changes/plan-a/specs/
?? openspec/changes/plan-a/tasks.md
[exit 0]
```

Done-condition of S-8 (task 7.6):

```text
holds: the claude -p run exited 0 with one Agent call
holds: readiness.md has result=failed
holds: a finding names release.md
```

## S-9 K: the plan-readiness-reviewer on a noted plan whose decisions.md lists a numbered ADR (task 7.6; AC-5, AC-14)

```text
(in $CASES/K/main)
$ node $DEV/change-loop.mjs open plan-b --script devkit --why capability --lang en <<< "Greet a user by name."
devkit-run: plan-b
{
  "version": 1,
  "change": "plan-b",
  "script": "devkit",
  "worktree": "$CASES/K/main/.claude/worktrees/plan-b",
  "branch": "plan-b",
  "base": "origin/main",
  "reply": "I opened the change plan-b on the full script, because it adds something the project cannot do today. Next come a few questions about your request; to use the short script instead, say so before the plan is written."
}
[exit 0]
```

Seeded (the plan stages, each passed) in `$CASES/K/main/.claude/worktrees/plan-b`:

```text
(in $CASES/K/main/.claude/worktrees/plan-b)
$ cat openspec/changes/plan-b/requirements.md
<!-- devkit-stage requirements result=passed attempt=1 commit=ad2cc4c33cd7fb18a38cbc338eb689494418295e -->
# Requirements

## Request

> Greet a user by name.

## Assumptions

- The app is a Node.js service; its code lives in `src/`.

## Acceptance criteria

- AC-1: `greet('Ana')` returns `Hello, Ana!`.
- AC-2: `greet('')` and `greet('  ')` return `Hello, friend!`.

## Out of scope

- Translations.
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/plan-b)
$ cat openspec/changes/plan-b/decisions.md
<!-- devkit-stage decisions result=passed attempt=1 commit=ad2cc4c33cd7fb18a38cbc338eb689494418295e -->
# Decisions and ADRs

- ADR: `docs/adr/0002-plan-b.md` — ADR 0002: a blank name is greeted as a friend
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/plan-b)
$ cat docs/adr/0002-plan-b.md
# ADR 0002: a blank name is greeted as a friend

- Status: proposed
- Change: `plan-b`

## Context

The greeting needs a rule for a blank name.

## Decision

A blank name is greeted as `friend`.

## Consequences

No error path for a blank name.

## Alternatives

- Throw on a blank name: rejected, the welcome screen has no error state.
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/plan-b)
$ cat openspec/changes/plan-b/proposal.md
<!-- devkit-stage proposal result=passed attempt=1 commit=ad2cc4c33cd7fb18a38cbc338eb689494418295e -->
# Proposal

## Why

The app answers no greeting today; the owner wants `greet(name)` for the welcome screen.

## What Changes

- New `src/greet.ts` exporting `greet(name: string): string`, returning `Hello, <name>!`.
- An empty or blank name returns `Hello, friend!`.

## Acceptance criteria

- AC-1: `greet('Ana')` returns `Hello, Ana!`.
- AC-2: `greet('')` and `greet('  ')` return `Hello, friend!`.

## Capabilities

### New Capabilities
- `greeting`: the greeting the app gives a named user.

### Modified Capabilities

## Impact

- `src/greet.ts` (new), `src/greet.test.ts` (new). No dependency is added.
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/plan-b)
$ cat openspec/changes/plan-b/specs/greeting/spec.md
<!-- devkit-stage specs result=passed attempt=1 commit=ad2cc4c33cd7fb18a38cbc338eb689494418295e -->
## ADDED Requirements

### Requirement: The app greets a user by name
The app SHALL return `Hello, <name>!` from `greet(name)` for a non-blank name, and `Hello, friend!` for an empty or blank one.

#### Scenario: a named user
- **WHEN** `greet('Ana')` is called
- **THEN** it returns `Hello, Ana!`

#### Scenario: a blank name
- **WHEN** `greet('  ')` is called
- **THEN** it returns `Hello, friend!`
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/plan-b)
$ cat openspec/changes/plan-b/design.md
<!-- devkit-stage design result=passed attempt=1 commit=ad2cc4c33cd7fb18a38cbc338eb689494418295e -->
# Design

## Context

`src/app.ts` exports one function per endpoint; there is no greeting. The greeting rule is recorded in `docs/adr/0002-plan-b.md`.

## Decisions

- `src/greet.ts` exports `greet(name: string): string`: `name.trim()` empty gives `Hello, friend!`, else `Hello, ${name.trim()}!`.
- Tests in `src/greet.test.ts` with `node --test` (no new dependency).

## Risks

- None beyond a wrong trim; the tests cover blank names.
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/plan-b)
$ cat openspec/changes/plan-b/tasks.md
<!-- devkit-stage tasks result=passed attempt=1 commit=ad2cc4c33cd7fb18a38cbc338eb689494418295e -->
# Tasks

## 1. Greeting

- [ ] 1.1 Write `src/greet.test.ts` (AC-1, AC-2: a name, an empty name, a blank name), see it fail, then write `src/greet.ts`. Done when `node --test src/` passes.
- [ ] 1.2 Gate: `node -e 0` green
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/plan-b)
$ cat openspec/changes/plan-b/release.md
packs: []
release: minor

## Greetings

- `greet(name)` returns a greeting for a name.
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/plan-b)
$ node $DEV/change-loop.mjs next --change plan-b --lang en
devkit-run: plan-b
{
  "version": 1,
  "change": "plan-b",
  "script": "devkit",
  "root": "$CASES/K/main/.claude/worktrees/plan-b",
  "branch": "plan-b",
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
  "brief": "Change plan-b (devkit script), stage readiness: review the plan. Work only in $CASES/K/main/.claude/worktrees/plan-b on branch plan-b; every file path is absolute under it; start every Bash command with cd $CASES/K/main/.claude/worktrees/plan-b && ; do not fetch. Write the change's files in English.",
  "progressKey": "readiness/readiness@a2945941edac",
  "icon": "📝",
  "state": {
    "state": "running",
    "reason": null,
    "stage": "readiness",
    "stageTitle": "Plan readiness",
    "phase": null,
    "stageIcon": "📝",
    "stateIcon": null,
    "title": "📝 plan-b"
  },
  "sessionTitle": "📝 plan-b"
}
[exit 0]
```

The real agent, run in `$CASES/K/main/.claude/worktrees/plan-b` (the prompt on standard input; 0.9 min):

```text
(in $CASES/K/main/.claude/worktrees/plan-b)
$ TMPDIR=$CASES/tmp DEVKIT_HOOK_LOG=$CASES/runs/S-9.hooks.jsonl claude -p --model sonnet --permission-mode bypassPermissions --plugin-dir $WT/plugins/core --plugin-dir $WT/plugins/openspec --output-format stream-json --verbose < prompt.txt
[exit 0]
```

The prompt (`prompt.txt`), the brief being the `brief` field of the `next` above, verbatim:

```text
This session is the conducting session of the devkit change `plan-b` in a scratch project. It hands one stage to its agent, as the `devkit` skill's Loop does for an `agent` action; the loop's `next` gave this action: stage `readiness`, agent `devkit-core:plan-readiness-reviewer`, model `sonnet`.

Make exactly one Agent call: subagent_type `devkit-core:plan-readiness-reviewer`, model `sonnet`, and as its prompt this brief, verbatim:

Change plan-b (devkit script), stage readiness: review the plan. Work only in $CASES/K/main/.claude/worktrees/plan-b on branch plan-b; every file path is absolute under it; start every Bash command with cd $CASES/K/main/.claude/worktrees/plan-b && ; do not fetch. Write the change's files in English.

Do nothing else: run no command, read or write no file yourself, and make no other Agent call. When the agent returns, reply with its final message, verbatim.
```

From the run's stream-json output (kept in the scratch folder while the proof ran):

```text
session: d1ed396e-1527-49c6-b1a4-8fd64cd2144f; conducting model: claude-sonnet-5-5; permission mode: bypassPermissions
plugin devkit-core 0.15.0 from $WT/plugins/core
plugin devkit-openspec 0.40.0 from $WT/plugins/openspec
Agent calls of the conducting session: 1
Agent call: subagent_type=devkit-core:plan-readiness-reviewer model=sonnet prompt-is-the-brief=yes
the agent's model: claude-sonnet-5-5
the agent's task: completed (task notification)
last result: success is_error=false turns=2 cost_usd=0.2983415
```

The tools the agent called, in order:

```text
Bash ls -R openspec docs | head -80; cat openspec/config.yaml; for f in openspec/changes/plan-b/*.md; do echo "=== $f"; cat -n $f; done; find openspec/changes/plan-b/specs -type f -exec sh -c 'echo "=== $1"; cat -n $1' _
Bash ls -a; ls src 2>&1; cat package.json; ls openspec/specs; cat docs/adr/0001-start.md; openspec validate plan-b --strict 2>&1 | tail -15; node -e 0; echo gate=$?; node --version; git status --short
Bash cat -n src/app.ts; cat .gitignore; ls .github/*; git diff openspec/changes/plan-b/requirements.md | head -20; ls openspec/changes/plan-b/readiness.md 2>&1
Bash node --test src/ 2>&1 | tail -15; echo rc=$?
Bash cat $WT/plugins/core/skills/plan-readiness-review/templates/report.md; cat openspec/schemas/devkit/templates/readiness.md
Write $CASES/K/main/.claude/worktrees/plan-b/openspec/changes/plan-b/readiness.md
```

The agent's final message (its last text; the conducting session ran it as a background agent):

```text
Status: NEEDS-REVISION
Blockers: 1
Report: $CASES/K/main/.claude/worktrees/plan-b/openspec/changes/plan-b/readiness.md

The one blocker is the numbered ADR. `openspec/config.yaml` sets `devkit.release_tag` and the change has a `release.md`, so the delivery numbers ADRs at the merge. The change's record, `docs/adr/0002-plan-b.md`, is numbered, and `decisions.md:4` lists it by that number.
- **Fix:** rename it to `docs/adr/plan-b.md` and drop the number from its title. List it unnumbered in `decisions.md:4` and cite it as `ADR [plan-b]`.

`openspec validate plan-b --strict` passes, and `release.md` is well formed.

Smaller findings, none of them blocking:
- **Wrong claim:** `design.md:6` says `src/app.ts` "exports one function per endpoint". The file is `export const app = 1;`, with no function.
- **Empty gate:** task 1.2's gate `node -e 0` is green on the base but checks nothing. I ran the task 1.1 command `node --test src/` on the base. It exits 0 with 0 tests.
- **Missing scenario:** the spec has no scenario for `greet('')`. The requirement text and task 1.1 do cover it.
```

The live hook decisions of the run (`DEVKIT_HOOK_LOG` of the worktree's `guard.mjs`; mode, agent, decision, why, count). The run's transcript holds no typed `/devkit change` command, so the stop and hand-off locks read no run (`no-run`); the planner's stop is judged by the `guard.mjs subagent-stop` calls of the case, with the run transcript they name:

```text
agent devkit-core:plan-readiness-reviewer allow (no-run) x1
subagent-stop devkit-core:plan-readiness-reviewer allow (no-run) x1
stop session allow (no-run) x1
```

```text
(in $CASES/K/main/.claude/worktrees/plan-b)
$ cat openspec/changes/plan-b/readiness.md
<!-- devkit-stage readiness result=failed attempt=1 commit=ad2cc4c33cd7fb18a38cbc338eb689494418295e -->
# Readiness review: plan-b

## 1. Decision
- Status: NEEDS-REVISION
- Confidence: high
- Ready to implement: no

## 2. Scope validation
Classification: correct. One function, `greet(name)`, in a new capability `greeting`. Proposal, specs and tasks agree. Translations are out of scope (requirements.md:17-19).

## 3. Proposal review
`proposal.md` states the problem, lists `greeting` as a new capability, and gives AC-1 and AC-2 (identical to requirements.md). Impact lists the two new files and no dependency. No findings.

## 4. Design review
`openspec validate plan-b --strict` passes ("Change 'plan-b' is valid").

Claims checked against the code:
- design.md:6 says "`src/app.ts` exports one function per endpoint". It does not. `src/app.ts:1` is `export const app = 1;`, with no function and no endpoint. The sentence has no effect on the implementation, because the new file is independent. Low, fix during implementation: reword it to "`src/app.ts` has no greeting".
- "no greeting" is true. `src/` contains only `app.ts`.
- `package.json` has no `test` script and no dependency. That matches "no new dependency".

The design gives the exact behavior (trim, then `Hello, friend!` or `Hello, ${name.trim()}!`). The blank-name rule is in the ADR.

## 5. Specs review
`specs/greeting/spec.md` is `## ADDED Requirements`, with SHALL language and two scenarios. The scenarios cover a named user (AC-1) and a blank name (AC-2, the `'  '` case). The empty-string case `''` has no scenario of its own. The requirement text covers it, and task 1.1 tests it. Low, nice to have: add a scenario for `''`. There is no decision table in the design.

## 6. Tasks review
- Task 1.1 is executable and test-first. Its done condition is `node --test src/`. I ran that command on the base. It exits 0 with 0 tests, so it is not red.
- Task 1.2 is a gate `node -e 0`. It runs green on the base, but it checks nothing. Low, fix during implementation: use the test command from 1.1 as the gate.
- Task paths are under the real `src/` directory.

Release note (`devkit.release_tag: package.json` is set in `openspec/config.yaml`):
- `release.md` exists and is readable: `packs: []`, then `release: minor`, then a `## Greetings` title and a body. No code fences. It is well formed.
- No task bumps a version, edits `CHANGELOG.md` or a CI pin, or numbers an ADR. Good.
- The change's ADR is numbered. See the blocker below.

## 7. Omission detection
Validation, error handling, side effects, idempotency, permissions and rollback do not apply to a pure function with no I/O. Non-string input (`undefined`, `null`) is outside the TypeScript signature and not specified. That is acceptable. Compatibility is not affected, because the function is new.

## 8. Execution risks (top 5 failures)
1. Cause: the numbered ADR file `docs/adr/0002-plan-b.md` collides at merge with another change that took 0002. Impact: a duplicate or renumbered record and a broken `ADR [<slug>]` citation. Prevention: use `docs/adr/plan-b.md` and let the delivery number it.
2. Cause: the `.ts` test imports `./greet.ts` or `./greet.js` inconsistently. Impact: `node --test` fails to load the module. Prevention: the implementer picks the extension Node accepts (Node v26 strips types natively) and runs the test.
3. Cause: `node --test src/` finds 0 tests because of a wrong file name or pattern. Impact: a false green. Prevention: task 1.1 requires seeing the test fail first, which catches this.
4. Cause: `trim()` is used for the check but the untrimmed name is interpolated. Impact: `Hello,  Ana !` for padded names. Prevention: the design already says `${name.trim()}`. Add a scenario for a padded name if wanted.
5. Cause: the gate `node -e 0` is always green. Impact: the phase gate proves nothing. Prevention: gate on the test command.

## 9. Mandatory fixes before implementation
- [ ] High — `docs/adr/0002-plan-b.md` and `openspec/changes/plan-b/decisions.md:4` — With `release.md` present, the delivery numbers ADRs at the merge. A numbered record of the change is a finding, and decisions.md must list the record unnumbered as `docs/adr/<slug>.md`, cited `ADR [<slug>]`. — Rename the file to `docs/adr/plan-b.md`. Change decisions.md:4 to `docs/adr/plan-b.md`. Remove the number from the ADR title (`# ADR: a blank name is greeted as a friend`). Update any citation to `ADR [plan-b]`.

## 10. Optional improvements (within scope)
- [ ] design.md:6: correct the claim about `src/app.ts` (see section 4).
- [ ] tasks.md:7: make the gate run the real test command.
- [ ] specs/greeting/spec.md: add a scenario for `greet('')`.

## 11. Explicitly out of scope
- [ ] Translations (requirements.md:19).
- [ ] Handling of non-string input.

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes.
2. Is the result measurable? Yes. AC-1 and AC-2 are exact string outputs.
3. Are error behaviors defined? There is no error path, by ADR 0002. A blank name returns the friend greeting.
4. Are edge cases covered? Blank and whitespace-only names are covered. The scenario for `''` is only implicit.
5. Are dependencies clear? Yes. There are none.
6. Are contracts defined? Yes. `greet(name: string): string`.
7. Can two developers interpret this differently? Not materially.
8. Are any decisions implicit instead of written? No. The blank-name rule is in the ADR.
9. Do the tasks fully deliver the intended outcome? Yes. Task 1.1 delivers AC-1 and AC-2.
10. What will be discovered too late if implementation starts now? The ADR numbering conflict at the merge.

## 13. Final conclusion
- Can we start? Not yet. One mandatory fix remains.
- What must be fixed? The ADR must be unnumbered (`docs/adr/plan-b.md`), and decisions.md must list it that way.
- Main risk if ignored? An ADR number collision, or a record that does not follow the release-at-merge rule.
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/plan-b)
$ git status --short
 M openspec/changes/plan-b/requirements.md
?? docs/adr/0002-plan-b.md
?? openspec/changes/plan-b/decisions.md
?? openspec/changes/plan-b/design.md
?? openspec/changes/plan-b/proposal.md
?? openspec/changes/plan-b/readiness.md
?? openspec/changes/plan-b/release.md
?? openspec/changes/plan-b/specs/
?? openspec/changes/plan-b/tasks.md
[exit 0]
```

Done-condition of S-9 (task 7.6):

```text
holds: the claude -p run exited 0 with one Agent call
holds: readiness.md has result=failed
holds: a finding names the numbered ADR path
```

## S-10 K: the plan-readiness-reviewer on a noted plan with a task that sets package.json's version (task 7.6; AC-2, AC-14)

```text
(in $CASES/K/main)
$ node $DEV/change-loop.mjs open plan-c --script devkit --why capability --lang en <<< "Greet a user by name."
devkit-run: plan-c
{
  "version": 1,
  "change": "plan-c",
  "script": "devkit",
  "worktree": "$CASES/K/main/.claude/worktrees/plan-c",
  "branch": "plan-c",
  "base": "origin/main",
  "reply": "I opened the change plan-c on the full script, because it adds something the project cannot do today. Next come a few questions about your request; to use the short script instead, say so before the plan is written."
}
[exit 0]
```

Seeded (the plan stages, each passed) in `$CASES/K/main/.claude/worktrees/plan-c`:

```text
(in $CASES/K/main/.claude/worktrees/plan-c)
$ cat openspec/changes/plan-c/requirements.md
<!-- devkit-stage requirements result=passed attempt=1 commit=5edf25dd8b928e225e9c28451327a05de1f93e05 -->
# Requirements

## Request

> Greet a user by name.

## Assumptions

- The app is a Node.js service; its code lives in `src/`.

## Acceptance criteria

- AC-1: `greet('Ana')` returns `Hello, Ana!`.
- AC-2: `greet('')` and `greet('  ')` return `Hello, friend!`.

## Out of scope

- Translations.
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/plan-c)
$ cat openspec/changes/plan-c/decisions.md
<!-- devkit-stage decisions result=not-applicable attempt=1 commit=5edf25dd8b928e225e9c28451327a05de1f93e05 -->
# Decisions and ADRs

No record: a pure function with no boundary, contract or technology choice.
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/plan-c)
$ cat openspec/changes/plan-c/proposal.md
<!-- devkit-stage proposal result=passed attempt=1 commit=5edf25dd8b928e225e9c28451327a05de1f93e05 -->
# Proposal

## Why

The app answers no greeting today; the owner wants `greet(name)` for the welcome screen.

## What Changes

- New `src/greet.ts` exporting `greet(name: string): string`, returning `Hello, <name>!`.
- An empty or blank name returns `Hello, friend!`.

## Acceptance criteria

- AC-1: `greet('Ana')` returns `Hello, Ana!`.
- AC-2: `greet('')` and `greet('  ')` return `Hello, friend!`.

## Capabilities

### New Capabilities
- `greeting`: the greeting the app gives a named user.

### Modified Capabilities

## Impact

- `src/greet.ts` (new), `src/greet.test.ts` (new). No dependency is added.
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/plan-c)
$ cat openspec/changes/plan-c/specs/greeting/spec.md
<!-- devkit-stage specs result=passed attempt=1 commit=5edf25dd8b928e225e9c28451327a05de1f93e05 -->
## ADDED Requirements

### Requirement: The app greets a user by name
The app SHALL return `Hello, <name>!` from `greet(name)` for a non-blank name, and `Hello, friend!` for an empty or blank one.

#### Scenario: a named user
- **WHEN** `greet('Ana')` is called
- **THEN** it returns `Hello, Ana!`

#### Scenario: a blank name
- **WHEN** `greet('  ')` is called
- **THEN** it returns `Hello, friend!`
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/plan-c)
$ cat openspec/changes/plan-c/design.md
<!-- devkit-stage design result=passed attempt=1 commit=5edf25dd8b928e225e9c28451327a05de1f93e05 -->
# Design

## Context

`src/app.ts` exports one function per endpoint; there is no greeting.

## Decisions

- `src/greet.ts` exports `greet(name: string): string`: `name.trim()` empty gives `Hello, friend!`, else `Hello, ${name.trim()}!`.
- Tests in `src/greet.test.ts` with `node --test` (no new dependency).

## Risks

- None beyond a wrong trim; the tests cover blank names.
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/plan-c)
$ cat openspec/changes/plan-c/tasks.md
<!-- devkit-stage tasks result=passed attempt=1 commit=5edf25dd8b928e225e9c28451327a05de1f93e05 -->
# Tasks

## 1. Greeting

- [ ] 1.1 Write `src/greet.test.ts` (AC-1, AC-2: a name, an empty name, a blank name), see it fail, then write `src/greet.ts`. Done when `node --test src/` passes.
- [ ] 1.2 Set the `version` of `package.json` to 1.5.0, the release of this change. Done when `node -p "require('./package.json').version"` prints 1.5.0.
- [ ] 1.3 Gate: `node -e 0` green
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/plan-c)
$ cat openspec/changes/plan-c/release.md
packs: []
release: minor

## Greetings

- `greet(name)` returns a greeting for a name.
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/plan-c)
$ node $DEV/change-loop.mjs next --change plan-c --lang en
devkit-run: plan-c
{
  "version": 1,
  "change": "plan-c",
  "script": "devkit",
  "root": "$CASES/K/main/.claude/worktrees/plan-c",
  "branch": "plan-c",
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
  "brief": "Change plan-c (devkit script), stage readiness: review the plan. Work only in $CASES/K/main/.claude/worktrees/plan-c on branch plan-c; every file path is absolute under it; start every Bash command with cd $CASES/K/main/.claude/worktrees/plan-c && ; do not fetch. Write the change's files in English.",
  "progressKey": "readiness/readiness@50b06a6e2a18",
  "icon": "📝",
  "state": {
    "state": "running",
    "reason": null,
    "stage": "readiness",
    "stageTitle": "Plan readiness",
    "phase": null,
    "stageIcon": "📝",
    "stateIcon": null,
    "title": "📝 plan-c"
  },
  "sessionTitle": "📝 plan-c"
}
[exit 0]
```

The real agent, run in `$CASES/K/main/.claude/worktrees/plan-c` (the prompt on standard input; 0.6 min):

```text
(in $CASES/K/main/.claude/worktrees/plan-c)
$ TMPDIR=$CASES/tmp DEVKIT_HOOK_LOG=$CASES/runs/S-10.hooks.jsonl claude -p --model sonnet --permission-mode bypassPermissions --plugin-dir $WT/plugins/core --plugin-dir $WT/plugins/openspec --output-format stream-json --verbose < prompt.txt
[exit 0]
```

The prompt (`prompt.txt`), the brief being the `brief` field of the `next` above, verbatim:

```text
This session is the conducting session of the devkit change `plan-c` in a scratch project. It hands one stage to its agent, as the `devkit` skill's Loop does for an `agent` action; the loop's `next` gave this action: stage `readiness`, agent `devkit-core:plan-readiness-reviewer`, model `sonnet`.

Make exactly one Agent call: subagent_type `devkit-core:plan-readiness-reviewer`, model `sonnet`, and as its prompt this brief, verbatim:

Change plan-c (devkit script), stage readiness: review the plan. Work only in $CASES/K/main/.claude/worktrees/plan-c on branch plan-c; every file path is absolute under it; start every Bash command with cd $CASES/K/main/.claude/worktrees/plan-c && ; do not fetch. Write the change's files in English.

Do nothing else: run no command, read or write no file yourself, and make no other Agent call. When the agent returns, reply with its final message, verbatim.
```

From the run's stream-json output (kept in the scratch folder while the proof ran):

```text
session: 0ce2bee8-9ef2-4bdf-a6d8-b50748e1bc00; conducting model: claude-sonnet-5-5; permission mode: bypassPermissions
plugin devkit-core 0.15.0 from $WT/plugins/core
plugin devkit-openspec 0.40.0 from $WT/plugins/openspec
Agent calls of the conducting session: 1
Agent call: subagent_type=devkit-core:plan-readiness-reviewer model=sonnet prompt-is-the-brief=yes
the agent's model: claude-sonnet-5-5
the agent's task: completed (task notification)
last result: success is_error=false turns=2 cost_usd=0.2699282
```

The tools the agent called, in order:

```text
Bash ls -R openspec | head -60; cat openspec/config.yaml; for f in proposal design tasks decisions release requirements; do echo "=== $f"; cat -n openspec/changes/plan-c/$f.md; done; find openspec/changes/plan-c/specs -t
Bash ls; ls src; cat package.json; node -e 0; echo gate=$?; openspec validate plan-c --strict 2>&1 | tail -5; cat openspec/schemas/devkit/templates/readiness.md | head -40
Bash sed -n 40,80p openspec/schemas/devkit/templates/readiness.md; cat src/app.ts | head -20; ls docs docs/* | head
Write $CASES/K/main/.claude/worktrees/plan-c/openspec/changes/plan-c/readiness.md
```

The agent's final message (its last text; the conducting session ran it as a background agent):

```text
Status: NEEDS-REVISION
Blockers: 1
Report: $CASES/K/main/.claude/worktrees/plan-c/openspec/changes/plan-c/readiness.md

The one blocker is `tasks.md:7` (task 1.2). It sets `package.json` to 1.5.0 by hand. `openspec/config.yaml` names `devkit.release_tag`, and `release.md` is present and reads correctly (`release: minor`). So the delivery writes the version at the merge, and no task may set it. Delete task 1.2.

I also found four low-severity gaps, listed in the report:
- `design.md:6` says `src/app.ts` exports one function per endpoint, but `src/app.ts:1` is `export const app = 1;`.
- The spec has no scenario for `greet('')`.
- The gate `node -e 0` passes but checks nothing.
- No artifact says how `.ts` tests run under `node --test`.

`openspec validate plan-c --strict` passes.
```

The live hook decisions of the run (`DEVKIT_HOOK_LOG` of the worktree's `guard.mjs`; mode, agent, decision, why, count). The run's transcript holds no typed `/devkit change` command, so the stop and hand-off locks read no run (`no-run`); the planner's stop is judged by the `guard.mjs subagent-stop` calls of the case, with the run transcript they name:

```text
agent devkit-core:plan-readiness-reviewer allow (no-run) x1
subagent-stop devkit-core:plan-readiness-reviewer allow (no-run) x1
stop session allow (no-run) x1
```

```text
(in $CASES/K/main/.claude/worktrees/plan-c)
$ cat openspec/changes/plan-c/readiness.md
<!-- devkit-stage readiness result=failed attempt=1 commit=5edf25dd8b928e225e9c28451327a05de1f93e05 -->
# Readiness review: plan-c

## 1. Decision
- Status: NEEDS-REVISION
- Confidence: high
- Ready to implement: no

## 2. Scope validation
Classification: correct. One small function, `greet`, with two acceptance criteria. Proposal, specs and tasks agree. Translations are out of scope (`requirements.md:19`).

## 3. Proposal review
No findings. The problem, the two ACs and the impact are explicit. `openspec validate plan-c --strict` passes.

## 4. Design review
Claims checked against the code:
- `design.md:6` says `src/app.ts` exports one function per endpoint. Reality: `src/app.ts:1` is `export const app = 1;`, with no endpoint functions. This is Low. The claim is context only and nothing in the plan depends on it.
- `src/greet.ts` does not exist, as the plan says (`ls src` shows only `app.ts`).
- `package.json` is at version 1.4.0, with no `scripts.test`. `node --test` is invoked directly, so this is fine.
- The design says nothing about non-string input. TypeScript types cover it, and the spec does not require it.

## 5. Specs review
`specs/greeting/spec.md` has a SHALL requirement with two scenarios (named, blank). AC-2 also names the empty string `''`, and no scenario covers it. That is a Low gap, because the blank scenario exercises the same trim path and task 1.1 tests the empty name.

## 6. Tasks review
- Task 1.1 is executable and test-first, with a clear done condition.
- Task 1.2 sets `package.json` `version` to 1.5.0. `openspec/config.yaml` names `devkit.release_tag: package.json`, and `release.md` exists and reads correctly (`packs: []`, `release: minor`, a `## Greetings` title and a body). With the release note in place, the delivery bumps the version at the merge, so no task may set it. See the Mandatory fix below.
- Task 1.3 gate: `node -e 0` exits 0 on the base. It is green but checks nothing (it neither type-checks nor runs the tests). Task 1.1 carries the real check.
- `decisions.md` lists no record, which is consistent with `not-applicable`. No numbered ADR is claimed.

## 7. Omission detection
No findings that matter for a pure function. Error handling, permissions, rollout and migration do not apply. `.ts` files run under `node --test` need a type-stripping Node version or a build step. No artifact states which. This is Low and falls under "Fix during implementation".

## 8. Execution risks (top 5 failures)
1. Cause: task 1.2 sets 1.5.0 by hand. Impact: the delivery's own bump at the merge conflicts with it, or the release number ends up wrong or doubled. Prevention: delete task 1.2.
2. Cause: `node --test src/` on `.ts` files depends on the Node version. Impact: the test task cannot run. Prevention: state the Node version or runner in design.md.
3. Cause: the gate `node -e 0` proves nothing. Impact: a broken change passes the gate. Prevention: use the test command as the gate.
4. Cause: the claim about `src/app.ts` is wrong. Impact: a reader looks for endpoint functions that are not there. Prevention: correct the sentence.
5. Cause: the spec has no `''` scenario. Impact: a missed edge case. Prevention: add the scenario.

## 9. Mandatory fixes before implementation
- [ ] High, Mandatory before implementation — `openspec/changes/plan-c/tasks.md:7` (task 1.2) — `release.md` exists and `config.yaml` sets `devkit.release_tag`, so the delivery writes the version at the merge and no task may set it. Smallest correction: delete task 1.2. `release.md` already carries `release: minor`.

## 10. Optional improvements (within scope)
- [ ] `openspec/changes/plan-c/design.md:6`: correct or drop the claim about `src/app.ts` (`src/app.ts:1` is `export const app = 1;`).
- [ ] `openspec/changes/plan-c/specs/greeting/spec.md`: add a scenario for `greet('')`.
- [ ] `openspec/changes/plan-c/tasks.md:8`: make the gate the test command.
- [ ] State how `.ts` tests run under `node --test`.

## 11. Explicitly out of scope
- [ ] Translations (`requirements.md:19`).

## 12. Mandatory review questions
1. Objectively defined? Yes.
2. Measurable? Yes, AC-1 and AC-2.
3. Error behaviors defined? Not applicable (a pure function); the blank case is defined.
4. Edge cases covered? Blank is covered. The `''` scenario is missing from the spec (Low).
5. Dependencies clear? Yes, there are none.
6. Contracts defined? Yes, the signature and the output strings.
7. Can two developers interpret this differently? Not on behavior. The `.ts` run method could differ.
8. Implicit decisions? The TypeScript runner for tests.
9. Do the tasks deliver the outcome? Yes, once 1.2 is removed.
10. Discovered too late? A version conflict with the delivery's bump, and whether `node --test` runs `.ts` files.

## 13. Final conclusion
- Can we start? Not yet.
- What must be fixed? Remove task 1.2 (`tasks.md:7`).
- Main risk if ignored? The hand-set version collides with the version the delivery writes at the merge.
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/plan-c)
$ git status --short
 M openspec/changes/plan-c/requirements.md
?? openspec/changes/plan-c/decisions.md
?? openspec/changes/plan-c/design.md
?? openspec/changes/plan-c/proposal.md
?? openspec/changes/plan-c/readiness.md
?? openspec/changes/plan-c/release.md
?? openspec/changes/plan-c/specs/
?? openspec/changes/plan-c/tasks.md
[exit 0]
```

Done-condition of S-10 (task 7.6):

```text
holds: the claude -p run exited 0 with one Agent call
holds: readiness.md has result=failed
holds: a finding names the task (1.2, the version)
```

## S-11 K: the tdd-implementer asked for a release line in a noted change (task 7.7; AC-2)

```text
(in $CASES/K/main)
$ node $DEV/change-loop.mjs open feat --script devkit --why capability --lang en <<< "Greet a user by name."
devkit-run: feat
{
  "version": 1,
  "change": "feat",
  "script": "devkit",
  "worktree": "$CASES/K/main/.claude/worktrees/feat",
  "branch": "feat",
  "base": "origin/main",
  "reply": "I opened the change feat on the full script, because it adds something the project cannot do today. Next come a few questions about your request; to use the short script instead, say so before the plan is written."
}
[exit 0]
```

Seeded (the plan stages passed, the readiness review APPROVED) in `$CASES/K/main/.claude/worktrees/feat`:

```text
(in $CASES/K/main/.claude/worktrees/feat)
$ cat openspec/changes/feat/requirements.md
<!-- devkit-stage requirements result=passed attempt=1 commit=153c0547ed2419ad8bd9de5b88f6bca001f9e73d -->
# Requirements

## Request

> Greet a user by name.

## Assumptions

- The app is a Node.js service; its code lives in `src/`.

## Acceptance criteria

- AC-1: `greet('Ana')` returns `Hello, Ana!`.
- AC-2: `greet('')` and `greet('  ')` return `Hello, friend!`.

## Out of scope

- Translations.
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/feat)
$ cat openspec/changes/feat/decisions.md
<!-- devkit-stage decisions result=not-applicable attempt=1 commit=153c0547ed2419ad8bd9de5b88f6bca001f9e73d -->
# Decisions and ADRs

No record: a pure function with no boundary, contract or technology choice.
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/feat)
$ cat openspec/changes/feat/proposal.md
<!-- devkit-stage proposal result=passed attempt=1 commit=153c0547ed2419ad8bd9de5b88f6bca001f9e73d -->
# Proposal

## Why

The app answers no greeting today; the owner wants `greet(name)` for the welcome screen.

## What Changes

- New `src/greet.ts` exporting `greet(name: string): string`, returning `Hello, <name>!`.
- An empty or blank name returns `Hello, friend!`.

## Acceptance criteria

- AC-1: `greet('Ana')` returns `Hello, Ana!`.
- AC-2: `greet('')` and `greet('  ')` return `Hello, friend!`.

## Capabilities

### New Capabilities
- `greeting`: the greeting the app gives a named user.

### Modified Capabilities

## Impact

- `src/greet.ts` (new), `src/greet.test.ts` (new). No dependency is added.
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/feat)
$ cat openspec/changes/feat/specs/greeting/spec.md
<!-- devkit-stage specs result=passed attempt=1 commit=153c0547ed2419ad8bd9de5b88f6bca001f9e73d -->
## ADDED Requirements

### Requirement: The app greets a user by name
The app SHALL return `Hello, <name>!` from `greet(name)` for a non-blank name, and `Hello, friend!` for an empty or blank one.

#### Scenario: a named user
- **WHEN** `greet('Ana')` is called
- **THEN** it returns `Hello, Ana!`

#### Scenario: a blank name
- **WHEN** `greet('  ')` is called
- **THEN** it returns `Hello, friend!`
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/feat)
$ cat openspec/changes/feat/design.md
<!-- devkit-stage design result=passed attempt=1 commit=153c0547ed2419ad8bd9de5b88f6bca001f9e73d -->
# Design

## Context

`src/app.ts` exports one function per endpoint; there is no greeting.

## Decisions

- `src/greet.ts` exports `greet(name: string): string`: `name.trim()` empty gives `Hello, friend!`, else `Hello, ${name.trim()}!`.
- Tests in `src/greet.test.ts` with `node --test` (no new dependency).

## Risks

- None beyond a wrong trim; the tests cover blank names.
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/feat)
$ cat openspec/changes/feat/tasks.md
<!-- devkit-stage tasks result=passed attempt=1 commit=153c0547ed2419ad8bd9de5b88f6bca001f9e73d -->
# Tasks

## 1. Release

- [ ] 1.1 Set the `version` of `package.json` to 1.5.0, the release of this change. Done when `node -p "require('./package.json').version"` prints 1.5.0.
- [ ] 1.2 Gate: `node -e 0` green

## 2. Greeting

- [ ] 2.1 Write `src/greet.test.ts`, see it fail, then write `src/greet.ts` (AC-1, AC-2). Done when `node --test src/` passes.
- [ ] 2.2 Gate: `node -e 0` green
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/feat)
$ cat openspec/changes/feat/release.md
packs: []
release: minor

## Greetings

- `greet(name)` returns a greeting for a name.
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/feat)
$ cat openspec/changes/feat/readiness.md
<!-- devkit-stage readiness result=passed attempt=1 commit=153c0547ed2419ad8bd9de5b88f6bca001f9e73d -->
# Readiness review: feat

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes
[exit 0]
```

Seeded (the owner's approval, as the `ship-change` `stop-plan-approval` row writes it, with the note's hash) in `$CASES/K/main/.claude/worktrees/feat`:

```text
(in $CASES/K/main/.claude/worktrees/feat)
$ cat openspec/changes/feat/approval.md
<!-- devkit-stage approval result=passed attempt=1 commit=153c0547ed2419ad8bd9de5b88f6bca001f9e73d -->
# Plan approval: feat

- Status: APPROVED
- Readiness: sha256:8bc7892031ff
- Release note: sha256:7751d0ba4aa7
- Date: 2026-11-24
- Owner's words: "`Aprovo`"
[exit 0]
```

The plan committed, as the coordinating session leaves it before the implementation:

```text
(in $CASES/K/main/.claude/worktrees/feat)
$ git log --oneline -3
41f2765 docs(feat): the plan of feat
153c054 chore(openspec): open feat
5201cd6 seed: the project at its first release
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/feat)
$ node $DEV/change-loop.mjs next --change feat --lang en
devkit-run: feat
{
  "version": 1,
  "change": "feat",
  "script": "devkit",
  "root": "$CASES/K/main/.claude/worktrees/feat",
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
  "step": "implement",
  "detail": {
    "step": "implement",
    "reason": "phase 1 has unticked tasks: 1.1",
    "phase": 1
  },
  "brief": "Change feat (devkit script), stage implementation: step implement {\"step\":\"implement\",\"reason\":\"phase 1 has unticked tasks: 1.1\",\"phase\":1}. Work only in $CASES/K/main/.claude/worktrees/feat on branch feat; every file path is absolute under it; start every Bash command with cd $CASES/K/main/.claude/worktrees/feat && ; do not fetch. Write the change's files in English.",
  "progressKey": "implementation/implement@a2588deb380b",
  "icon": "🛠️",
  "state": {
    "state": "running",
    "reason": null,
    "stage": "implementation",
    "stageTitle": "Implementation",
    "phase": 1,
    "stageIcon": "🛠️",
    "stateIcon": null,
    "title": "🛠️ feat"
  },
  "sessionTitle": "🛠️ feat"
}
[exit 0]
```

The real agent, run in `$CASES/K/main/.claude/worktrees/feat` (the prompt on standard input; 0.4 min):

```text
(in $CASES/K/main/.claude/worktrees/feat)
$ TMPDIR=$CASES/tmp DEVKIT_HOOK_LOG=$CASES/runs/S-11.hooks.jsonl claude -p --model sonnet --permission-mode bypassPermissions --plugin-dir $WT/plugins/core --plugin-dir $WT/plugins/openspec --output-format stream-json --verbose < prompt.txt
[exit 0]
```

The prompt (`prompt.txt`), the brief being the `brief` field of the `next` above, verbatim:

```text
This session is the conducting session of the devkit change `feat` in a scratch project. It hands one stage to its agent, as the `devkit` skill's Loop does for an `agent` action; the loop's `next` gave this action: stage `implementation`, agent `devkit-core:tdd-implementer`, model `sonnet`.

Make exactly one Agent call: subagent_type `devkit-core:tdd-implementer`, model `sonnet`, and as its prompt this brief, verbatim:

Change feat (devkit script), stage implementation: step implement {"step":"implement","reason":"phase 1 has unticked tasks: 1.1","phase":1}. Work only in $CASES/K/main/.claude/worktrees/feat on branch feat; every file path is absolute under it; start every Bash command with cd $CASES/K/main/.claude/worktrees/feat && ; do not fetch. Write the change's files in English.

Do nothing else: run no command, read or write no file yourself, and make no other Agent call. When the agent returns, reply with its final message, verbatim.
```

From the run's stream-json output (kept in the scratch folder while the proof ran):

```text
session: 66068c52-524d-4cae-be51-1d95c3ccd44f; conducting model: claude-sonnet-5-5; permission mode: bypassPermissions
plugin devkit-core 0.15.0 from $WT/plugins/core
plugin devkit-openspec 0.40.0 from $WT/plugins/openspec
Agent calls of the conducting session: 1
Agent call: subagent_type=devkit-core:tdd-implementer model=sonnet prompt-is-the-brief=yes
the agent's model: claude-sonnet-5-5
the agent's task: completed (task notification)
last result: success is_error=false turns=2 cost_usd=0.23594470000000003
```

The tools the agent called, in order:

```text
Bash git status --short && git log --oneline | head && ls && find openspec docs -maxdepth 3 2>/dev/null | head -50
Bash cd openspec/changes/feat && for f in tasks.md readiness.md proposal.md design.md release.md; do echo "=== $f"; cat $f; done; cd ../../..; cat package.json; find src; cat CHANGELOG.md
```

The agent's final message (its last text; the conducting session ran it as a background agent):

```text
## Implementation — feat, phase 1

Surfaces touched: none
Tasks: 0 / 2 in phase 1

### Diff
No files changed. `git status` is clean.

### Bugs fixed along the way
none

### Validation
Command: not run
Result: not applicable. No code was written.

### Phase gate
Phase 1 is blocked.
- [ ] 1.1 Set `version` in `package.json` to 1.5.0.
- [ ] 1.2 Gate: `node -e 0` green

I did not tick either box. Task 1.2 is a `Gate:` task, so only whoever re-runs it can tick it.

### Why I stopped
Task 1.1 asks me to edit a release line, and this change has a release note. The `version` field in `$CASES/K/main/.claude/worktrees/feat/package.json` is currently 1.4.0.

`$CASES/K/main/.claude/worktrees/feat/openspec/changes/feat/release.md` declares `release: minor` and `packs: []`. My rules say the delivery writes the version and the CHANGELOG line once, at the merge. I left `package.json` and `CHANGELOG.md` as they were.

To unblock, the plan owner needs to do one of these:
- Remove task 1.1 and the phase 1 gate from `tasks.md`. The delivery then bumps the version to 1.5.0 at merge.
- If the version really must be set during implementation, drop `release.md` for this change. That is the owner's decision, not mine.

Phase 2 (`src/greet.test.ts` and `src/greet.ts`, covering AC-1 and AC-2) is not blocked by this. I did not start it, because precondition 2 says phase 1's exit gate must be checked first. If you tell me to skip phase 1, I'll do phase 2 test-first.

Outcome: failure. Task 1.1 edits a release line in a change that has `release.md`.
```

The live hook decisions of the run (`DEVKIT_HOOK_LOG` of the worktree's `guard.mjs`; mode, agent, decision, why, count). The run's transcript holds no typed `/devkit change` command, so the stop and hand-off locks read no run (`no-run`); the planner's stop is judged by the `guard.mjs subagent-stop` calls of the case, with the run transcript they name:

```text
agent devkit-core:tdd-implementer allow (no-run) x1
subagent-stop devkit-core:tdd-implementer allow (no-run) x1
stop session allow (no-run) x1
```

```text
(in $CASES/K/main/.claude/worktrees/feat)
$ git diff -- package.json
(no output)
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/feat)
$ git status --short
(no output)
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/feat)
$ cat package.json
{
  "name": "app",
  "version": "1.4.0",
  "private": true
}
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/feat)
$ cat openspec/changes/feat/tasks.md
<!-- devkit-stage tasks result=passed attempt=1 commit=153c0547ed2419ad8bd9de5b88f6bca001f9e73d -->
# Tasks

## 1. Release

- [ ] 1.1 Set the `version` of `package.json` to 1.5.0, the release of this change. Done when `node -p "require('./package.json').version"` prints 1.5.0.
- [ ] 1.2 Gate: `node -e 0` green

## 2. Greeting

- [ ] 2.1 Write `src/greet.test.ts`, see it fail, then write `src/greet.ts` (AC-1, AC-2). Done when `node --test src/` passes.
- [ ] 2.2 Gate: `node -e 0` green
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/feat)
$ node $DEV/deliver-check.mjs feat --json   (its "next" and "approval")
{
  "next": {
    "step": "implement",
    "reason": "phase 1 has unticked tasks: 1.1",
    "phase": 1
  },
  "approval": {
    "status": "APPROVED",
    "recorded": "sha256:8bc7892031ff",
    "readiness": "sha256:8bc7892031ff",
    "release": "sha256:7751d0ba4aa7",
    "recordedRelease": "sha256:7751d0ba4aa7",
    "ok": true
  }
}
[exit 1]
```

Done-condition of S-11 (task 7.7):

```text
holds: the claude -p run exited 0 with one Agent call
holds: it returns Outcome: failure (Outcome: failure. Task 1.1 edits a release line in a change that has `release.md`.)
holds: it names the release line
holds: git diff shows package.json unchanged
holds: deliver-check feat --json shows no row N3 (next: implement phase 1 has unticked tasks: 1.1)
```

## S-12 K: a revision that writes only release.md sends the plan back to the readiness review; N keeps it passed (task 9.15; AC-16, AC-1)

Run after review round 1 (D-21; adr-reviewer F2, spec-reviewer F3, code-quality F3, test-coverage F5, architecture F1), on projects K and N built anew by `seed`. The failure path first, then the success path.

### K: the real readiness review fails a plan with no release.md

S-8's seed: the plan stages of `plan-d`, each passed, with no `release.md`.

```text
(in $CASES/K/main)
$ node $DEV/change-loop.mjs open plan-d --script devkit --why capability --lang en <<< "Greet a user by name."
devkit-run: plan-d
{
  "version": 1,
  "change": "plan-d",
  "script": "devkit",
  "worktree": "$CASES/K/main/.claude/worktrees/plan-d",
  "branch": "plan-d",
  "base": "origin/main",
  "reply": "I opened the change plan-d on the full script, because it adds something the project cannot do today. Next come a few questions about your request; to use the short script instead, say so before the plan is written."
}
[exit 0]
```

Seeded (the plan stages, each passed) in `$CASES/K/main/.claude/worktrees/plan-d`:

```text
(in $CASES/K/main/.claude/worktrees/plan-d)
$ cat openspec/changes/plan-d/requirements.md
<!-- devkit-stage requirements result=passed attempt=1 commit=7cee9c06a842c6e176c3dd5239597c7f81c0a401 -->
# Requirements

## Request

> Greet a user by name.

## Assumptions

- The app is a Node.js service; its code lives in `src/`.

## Acceptance criteria

- AC-1: `greet('Ana')` returns `Hello, Ana!`.
- AC-2: `greet('')` and `greet('  ')` return `Hello, friend!`.

## Out of scope

- Translations.
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/plan-d)
$ cat openspec/changes/plan-d/decisions.md
<!-- devkit-stage decisions result=not-applicable attempt=1 commit=7cee9c06a842c6e176c3dd5239597c7f81c0a401 -->
# Decisions and ADRs

No record: a pure function with no boundary, contract or technology choice.
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/plan-d)
$ cat openspec/changes/plan-d/proposal.md
<!-- devkit-stage proposal result=passed attempt=1 commit=7cee9c06a842c6e176c3dd5239597c7f81c0a401 -->
# Proposal

## Why

The app answers no greeting today; the owner wants `greet(name)` for the welcome screen.

## What Changes

- New `src/greet.ts` exporting `greet(name: string): string`, returning `Hello, <name>!`.
- An empty or blank name returns `Hello, friend!`.

## Acceptance criteria

- AC-1: `greet('Ana')` returns `Hello, Ana!`.
- AC-2: `greet('')` and `greet('  ')` return `Hello, friend!`.

## Capabilities

### New Capabilities
- `greeting`: the greeting the app gives a named user.

### Modified Capabilities

## Impact

- `src/greet.ts` (new), `src/greet.test.ts` (new). No dependency is added.
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/plan-d)
$ cat openspec/changes/plan-d/specs/greeting/spec.md
<!-- devkit-stage specs result=passed attempt=1 commit=7cee9c06a842c6e176c3dd5239597c7f81c0a401 -->
## ADDED Requirements

### Requirement: The app greets a user by name
The app SHALL return `Hello, <name>!` from `greet(name)` for a non-blank name, and `Hello, friend!` for an empty or blank one.

#### Scenario: a named user
- **WHEN** `greet('Ana')` is called
- **THEN** it returns `Hello, Ana!`

#### Scenario: a blank name
- **WHEN** `greet('  ')` is called
- **THEN** it returns `Hello, friend!`
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/plan-d)
$ cat openspec/changes/plan-d/design.md
<!-- devkit-stage design result=passed attempt=1 commit=7cee9c06a842c6e176c3dd5239597c7f81c0a401 -->
# Design

## Context

`src/app.ts` exports one function per endpoint; there is no greeting.

## Decisions

- `src/greet.ts` exports `greet(name: string): string`: `name.trim()` empty gives `Hello, friend!`, else `Hello, ${name.trim()}!`.
- Tests in `src/greet.test.ts` with `node --test` (no new dependency).

## Risks

- None beyond a wrong trim; the tests cover blank names.
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/plan-d)
$ cat openspec/changes/plan-d/tasks.md
<!-- devkit-stage tasks result=passed attempt=1 commit=7cee9c06a842c6e176c3dd5239597c7f81c0a401 -->
# Tasks

## 1. Greeting

- [ ] 1.1 Write `src/greet.test.ts` (AC-1, AC-2: a name, an empty name, a blank name), see it fail, then write `src/greet.ts`. Done when `node --test src/` passes.
- [ ] 1.2 Gate: `node -e 0` green
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/plan-d)
$ node $DEV/change-loop.mjs next --change plan-d --lang en
devkit-run: plan-d
{
  "version": 1,
  "change": "plan-d",
  "script": "devkit",
  "root": "$CASES/K/main/.claude/worktrees/plan-d",
  "branch": "plan-d",
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
  "brief": "Change plan-d (devkit script), stage readiness: review the plan. Work only in $CASES/K/main/.claude/worktrees/plan-d on branch plan-d; every file path is absolute under it; start every Bash command with cd $CASES/K/main/.claude/worktrees/plan-d && ; do not fetch. Write the change's files in English.",
  "progressKey": "readiness/readiness@f1122103ba11",
  "icon": "📝",
  "state": {
    "state": "running",
    "reason": null,
    "stage": "readiness",
    "stageTitle": "Plan readiness",
    "phase": null,
    "stageIcon": "📝",
    "stateIcon": null,
    "title": "📝 plan-d"
  },
  "sessionTitle": "📝 plan-d"
}
[exit 0]
```

The real agent, run in `$CASES/K/main/.claude/worktrees/plan-d` (the prompt on standard input; 0.5 min):

```text
(in $CASES/K/main/.claude/worktrees/plan-d)
$ TMPDIR=$CASES/tmp DEVKIT_HOOK_LOG=$CASES/runs/S-12-review-1.hooks.jsonl claude -p --model sonnet --permission-mode bypassPermissions --plugin-dir $WT/plugins/core --plugin-dir $WT/plugins/openspec --output-format stream-json --verbose < prompt.txt
[exit 0]
```

The prompt (`prompt.txt`), the brief being the `brief` field of the `next` above, verbatim:

```text
This session is the conducting session of the devkit change `plan-d` in a scratch project. It hands one stage to its agent, as the `devkit` skill's Loop does for an `agent` action; the loop's `next` gave this action: stage `readiness`, agent `devkit-core:plan-readiness-reviewer`, model `sonnet`.

Make exactly one Agent call: subagent_type `devkit-core:plan-readiness-reviewer`, model `sonnet`, and as its prompt this brief, verbatim:

Change plan-d (devkit script), stage readiness: review the plan. Work only in $CASES/K/main/.claude/worktrees/plan-d on branch plan-d; every file path is absolute under it; start every Bash command with cd $CASES/K/main/.claude/worktrees/plan-d && ; do not fetch. Write the change's files in English.

Do nothing else: run no command, read or write no file yourself, and make no other Agent call. When the agent returns, reply with its final message, verbatim.
```

From the run's stream-json output (kept in the scratch folder while the proof ran):

```text
session: a293313c-3642-4e1b-836d-12484952849d; conducting model: claude-sonnet-5-5; permission mode: bypassPermissions
plugin devkit-core 0.16.3 from $WT/plugins/core
plugin devkit-openspec 0.47.2 from $WT/plugins/openspec
Agent calls of the conducting session: 1
Agent call: subagent_type=devkit-core:plan-readiness-reviewer model=sonnet prompt-is-the-brief=yes
the agent's model: claude-sonnet-5-5
the agent's task: completed (task notification)
last result: success is_error=false turns=2 cost_usd=0.2569224
```

The tools the agent called, in order:

```text
Bash ls -R openspec/changes/plan-d && cat openspec/config.yaml && cat openspec/changes/plan-d/{proposal,design,tasks,decisions,requirements}.md && find openspec/changes/plan-d/specs -type f | xargs cat; git rev-parse HEA
Bash ls; ls src; cat package.json; grep -n "export" src/*.ts | head; node -e 0; echo rc=$?; ls openspec/changes/plan-d/readiness.md 2>&1
Bash node --version; ls -a | head -20
Write $CASES/K/main/.claude/worktrees/plan-d/openspec/changes/plan-d/readiness.md
```

The agent's final message (its last text; the conducting session ran it as a background agent):

```text
Status: NEEDS-REVISION
Blockers: 1
Report: $CASES/K/main/.claude/worktrees/plan-d/openspec/changes/plan-d/readiness.md

- **Blocker:** `openspec/config.yaml` sets `devkit.release_tag: package.json`, but the change has no `release.md`. Without it the delivery can't tell which pack or version to bump.
- **Medium:** `design.md` says `src/app.ts` "exports one function per endpoint". The file contains only `export const app = 1;`. This doesn't change behavior and can be fixed during implementation.
- **Low:** Task 1.2's gate `node -e 0` passes on the base but checks nothing.
- **Validation:** `openspec validate plan-d --strict` passes.
```

The live hook decisions of the run (`DEVKIT_HOOK_LOG` of the worktree's `guard.mjs`; mode, agent, decision, why, count). The run's transcript holds no typed `/devkit change` command, so the stop and hand-off locks read no run (`no-run`); the planner's stop is judged by the `guard.mjs subagent-stop` calls of the case, with the run transcript they name:

```text
agent devkit-core:plan-readiness-reviewer allow (no-run) x1
subagent-stop devkit-core:plan-readiness-reviewer allow (no-run) x1
stop session allow (no-run) x1
```

```text
(in $CASES/K/main/.claude/worktrees/plan-d)
$ cat openspec/changes/plan-d/readiness.md
<!-- devkit-stage readiness result=failed attempt=1 commit=7cee9c06a842c6e176c3dd5239597c7f81c0a401 -->
# Readiness review: plan-d

## Decision

- Status: NEEDS-REVISION

Blockers: 1 (Mandatory before implementation). `openspec validate plan-d --strict` passes.

## Scope

Classification: correct. One pure function, `greet(name)`, with explicit out of scope (translations) in `requirements.md`. Proposal, design, spec and tasks agree.

## Blockers

1. High, Mandatory before implementation. `/openspec/changes/plan-d/release.md` does not exist. `openspec/config.yaml:5` names `devkit.release_tag: package.json`, so the change needs a release note. Without it the delivery does not know which pack or version to bump (package.json is at 1.4.0). Smallest correction: add `release.md` with the `packs:` line (one `- <pack>: patch|minor|major` line, or `packs: []` if nothing is released), and a `## <title>` line plus a body if it releases anything. Close every code fence.

## Findings

- Medium, Fix during implementation. `design.md` Context says "`src/app.ts` exports one function per endpoint". The code says otherwise: `src/app.ts:1` is `export const app = 1;`, with no function and no endpoint. The claim is wrong but does not change behavior, since `greet.ts` is a new standalone file. Smallest correction: reword the Context to "`src/app.ts` exports only a placeholder constant".
- Low, Nice to have. Task 1.2 gate `node -e 0` is green on the base (exit 0), but it checks nothing. It is not a real gate for the work. Consider `node --test src/`, which 1.1 already runs.
- Low, Nice to have. The plan puts `.ts` files under `node --test` with no TypeScript config or build step in the repo (no tsconfig, no devDependencies). Node v26.13.1 here strips types natively, so it runs. Importing `./greet.ts` with the extension is needed in the test. State the minimum Node version in the design if other environments differ.
- Release rules: no task bumps a version, edits CHANGELOG or numbers an ADR. `decisions.md` lists no record and says why. OK.

## Code claims checked

- `src/app.ts` exports one function per endpoint: false (see above).
- `src/greet.ts` and `src/greet.test.ts` are new: confirmed, `src/` holds only `app.ts`.
- No dependency is added: confirmed, `package.json` has none.

## Spec check

The one requirement has two scenarios: a named user (AC-1) and a blank name `'  '` (AC-2). The empty string `''` is in AC-2 and in the requirement text but has no scenario of its own. Low, fix during implementation: the test in 1.1 covers it, so adding a scenario is optional.

## Mandatory questions

1. Problem defined: yes.
2. Measurable: yes, AC-1 and AC-2 are exact strings.
3. Error behavior: no error cases; a blank name is the only edge, and it is defined. Non-string input is out of the type contract.
4. Edge cases: blank, empty and whitespace-padded names are covered. A name with surrounding spaces, such as `' Ana '`, trims to `Ana` per design but has no scenario.
5. Dependencies: none.
6. Contracts: defined (`greet(name: string): string`).
7. Two readings: no.
8. Implicit decisions: no.
9. Tasks deliver the outcome: yes.
10. Found too late: the missing release note, which would stop the delivery at the merge.

## Top production risks

1. The delivery has no release note, so no version is bumped or the merge stops.
2. A runner other than Node 22.6 or later fails on `.ts` tests. Low likelihood here.

## Next step

The author adds `release.md`, and optionally fixes the design Context line. Re-run the review after that.
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/plan-d)
$ git status --short
 M openspec/changes/plan-d/requirements.md
?? openspec/changes/plan-d/decisions.md
?? openspec/changes/plan-d/design.md
?? openspec/changes/plan-d/proposal.md
?? openspec/changes/plan-d/readiness.md
?? openspec/changes/plan-d/specs/
?? openspec/changes/plan-d/tasks.md
[exit 0]
```

The loop hands the planner the revision:

```text
(in $CASES/K/main/.claude/worktrees/plan-d)
$ node $DEV/change-loop.mjs next --change plan-d --lang en
devkit-run: plan-d
{
  "version": 1,
  "change": "plan-d",
  "script": "devkit",
  "root": "$CASES/K/main/.claude/worktrees/plan-d",
  "branch": "plan-d",
  "filesLanguage": "en",
  "kind": "agent",
  "stage": "proposal",
  "stageTitle": "Proposal",
  "role": "change-planner",
  "skills": [],
  "model": "opus",
  "agent": "devkit-core:change-planner",
  "brief": "Change plan-d (devkit script), stage proposal: readiness failed at attempt 1 (failures in a row: 1 of 3): revise the plan from its findings. Work only in $CASES/K/main/.claude/worktrees/plan-d on branch plan-d; every file path is absolute under it; start every Bash command with cd $CASES/K/main/.claude/worktrees/plan-d && ; do not fetch. Write the change's files in English.",
  "progressKey": "proposal/proposal@d861222fb790",
  "icon": "📝",
  "state": {
    "state": "running",
    "reason": null,
    "stage": "proposal",
    "stageTitle": "Proposal",
    "phase": null,
    "stageIcon": "📝",
    "stateIcon": null,
    "title": "📝 plan-d"
  },
  "sessionTitle": "📝 plan-d"
}
[exit 0]
```

### A copy of that state: only release.md written

Project `K` copied to `K-copy` (`cp -a`, every modification time kept), where the case writes only `release.md`, newer than `readiness.md`; no other file changes.

```text
(in $CASES)
$ cp -a $CASES/K $CASES/K-copy
(no output)
[exit 0]
```

```text
(in $CASES/K-copy/main)
$ git remote set-url origin $CASES/K-copy/origin.git
(no output)
[exit 0]
```

```text
(in $CASES/K-copy/main)
$ git worktree repair $CASES/K-copy/main/.claude/worktrees/plan-d
repair: gitdir incorrect: $CASES/K-copy/main/.git/worktrees/plan-d/gitdir
[exit 0]
```

```text
(in $CASES/K-copy/main)
$ git worktree list
$CASES/K-copy/main                          71e16be [main]
$CASES/K-copy/main/.claude/worktrees/plan-d 7cee9c0 [plan-d]
[exit 0]
```

```text
(in $CASES/K-copy/main/.claude/worktrees/plan-d)
$ cat openspec/changes/plan-d/release.md
packs: []
release: minor

## Greetings

- `greet(name)` returns a greeting for a name.
[exit 0]
```

```text
(in $CASES/K-copy/main/.claude/worktrees/plan-d)
$ stat -c '%y %n' openspec/changes/plan-d/readiness.md openspec/changes/plan-d/release.md   # the note is newer than the review
2026-11-24 22:08:19.681248022 -0300 openspec/changes/plan-d/readiness.md
2026-11-24 22:08:27.447000026 -0300 openspec/changes/plan-d/release.md
[exit 0]
```

```text
(in $CASES/K-copy/main/.claude/worktrees/plan-d)
$ git status --short   # the plan of the seed (uncommitted, as the plan stages leave it) and the review; release.md the only file the copy adds
 M openspec/changes/plan-d/requirements.md
?? openspec/changes/plan-d/decisions.md
?? openspec/changes/plan-d/design.md
?? openspec/changes/plan-d/proposal.md
?? openspec/changes/plan-d/readiness.md
?? openspec/changes/plan-d/release.md
?? openspec/changes/plan-d/specs/
?? openspec/changes/plan-d/tasks.md
[exit 0]
```

```text
(in $CASES/K-copy/main/.claude/worktrees/plan-d)
$ node $DEV/flow-check.mjs plan-d --json   (its "next", "end" and readiness stage)
{
  "next": {
    "n": 9,
    "stage": "readiness",
    "role": "plan-readiness-reviewer",
    "skills": [
      "plan-readiness-review"
    ],
    "reasonCode": "rerun-after-fix",
    "params": {
      "stage": "readiness"
    },
    "reason": "the plan readiness failed and the work changed since; it runs again",
    "progressKey": "readiness@b079a0a6a687"
  },
  "end": null,
  "readiness": {
    "id": "readiness",
    "state": "failed",
    "reasonCode": "header-failed",
    "params": {
      "attempt": 1,
      "failures": 1,
      "ceiling": 3
    },
    "result": "failed",
    "attempt": 1
  }
}
[exit 0]
```

```text
(in $CASES/K-copy/main/.claude/worktrees/plan-d)
$ node $DEV/change-loop.mjs next --change plan-d --lang en
devkit-run: plan-d
{
  "version": 1,
  "change": "plan-d",
  "script": "devkit",
  "root": "$CASES/K-copy/main/.claude/worktrees/plan-d",
  "branch": "plan-d",
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
  "brief": "Change plan-d (devkit script), stage readiness: readiness is out of date: bring it up to date. Work only in $CASES/K-copy/main/.claude/worktrees/plan-d on branch plan-d; every file path is absolute under it; start every Bash command with cd $CASES/K-copy/main/.claude/worktrees/plan-d && ; do not fetch. Write the change's files in English.",
  "progressKey": "readiness/readiness@b079a0a6a687",
  "icon": "📝",
  "state": {
    "state": "running",
    "reason": null,
    "stage": "readiness",
    "stageTitle": "Plan readiness",
    "phase": null,
    "stageIcon": "📝",
    "stateIcon": null,
    "title": "📝 plan-d"
  },
  "sessionTitle": "📝 plan-d"
}
[exit 0]
```

### K: the real planner revises the plan, the real reviewer passes it

The change folder before the planner (modification time, sha256 prefix, path):

```text
2026-11-25T01:07:54.807Z  sha256:626c979f12f9  openspec/changes/plan-d/.openspec.yaml
2026-11-25T01:07:54.862Z  sha256:42cc5ea6b528  openspec/changes/plan-d/decisions.md
2026-11-25T01:07:54.863Z  sha256:03710021c0e5  openspec/changes/plan-d/design.md
2026-11-25T01:07:54.863Z  sha256:32cecd87fc1a  openspec/changes/plan-d/proposal.md
2026-11-25T01:08:19.681Z  sha256:09f072058211  openspec/changes/plan-d/readiness.md
2026-11-25T01:07:54.862Z  sha256:5ec5e5f0e739  openspec/changes/plan-d/requirements.md
2026-11-25T01:07:54.863Z  sha256:f58a1f8ee7ac  openspec/changes/plan-d/specs/greeting/spec.md
2026-11-25T01:07:54.863Z  sha256:cbc91f104a26  openspec/changes/plan-d/tasks.md
```

The real agent, run in `$CASES/K/main/.claude/worktrees/plan-d` (the prompt on standard input; 0.8 min):

```text
(in $CASES/K/main/.claude/worktrees/plan-d)
$ TMPDIR=$CASES/tmp DEVKIT_HOOK_LOG=$CASES/runs/S-12-planner.hooks.jsonl claude -p --model sonnet --permission-mode bypassPermissions --plugin-dir $WT/plugins/core --plugin-dir $WT/plugins/openspec --output-format stream-json --verbose < prompt.txt
[exit 0]
```

The prompt (`prompt.txt`), the brief being the `brief` field of the `next` above, verbatim:

```text
This session is the conducting session of the devkit change `plan-d` in a scratch project. It hands one stage to its agent, as the `devkit` skill's Loop does for an `agent` action; the loop's `next` gave this action: stage `proposal`, agent `devkit-core:change-planner`, model `opus`.

Make exactly one Agent call: subagent_type `devkit-core:change-planner`, model `opus`, and as its prompt this brief, verbatim:

Change plan-d (devkit script), stage proposal: readiness failed at attempt 1 (failures in a row: 1 of 3): revise the plan from its findings. Work only in $CASES/K/main/.claude/worktrees/plan-d on branch plan-d; every file path is absolute under it; start every Bash command with cd $CASES/K/main/.claude/worktrees/plan-d && ; do not fetch. Write the change's files in English.

Do nothing else: run no command, read or write no file yourself, and make no other Agent call. When the agent returns, reply with its final message, verbatim.
```

From the run's stream-json output (kept in the scratch folder while the proof ran):

```text
session: bc14889f-c232-49e4-954e-83e9c0140029; conducting model: claude-sonnet-5-5; permission mode: bypassPermissions
plugin devkit-core 0.16.3 from $WT/plugins/core
plugin devkit-openspec 0.47.2 from $WT/plugins/openspec
Agent calls of the conducting session: 1
Agent call: subagent_type=devkit-core:change-planner model=opus prompt-is-the-brief=yes
the agent's model: claude-opus-5-5
the agent's task: completed (task notification)
last result: success is_error=false turns=1 cost_usd=0.35642650000000003
```

The tools the agent called, in order:

```text
Bash ls -R openspec | head -50 && cat openspec/changes/plan-d/readiness.md && cat openspec/config.yaml && git diff
Bash for f in proposal design tasks decisions; do echo "=== $f"; cat openspec/changes/plan-d/$f.md; done; cat openspec/changes/plan-d/specs/greeting/spec.md; cat package.json; ls; ls plugins 2>/dev/null; ls openspec/sche
Bash cat CHANGELOG.md; ls -R docs; cat src/app.ts; grep -rn "release" openspec/schemas/devkit/schema.yaml | head -30
Write $CASES/K/main/.claude/worktrees/plan-d/openspec/changes/plan-d/release.md
Bash python3 - <<'EOF' import re d='openspec/changes/plan-d/' p=d+'design.md'; s=open(p).read() s=s.replace("`src/app.ts` exports one function per endpoint; there is no greeting.","`src/app.ts` exports only a placeholder
Bash cat openspec/changes/plan-d/design.md openspec/changes/plan-d/tasks.md; tail -8 openspec/changes/plan-d/specs/greeting/spec.md
```

The agent's final message (its last text; the conducting session ran it as a background agent):

```text
I added the missing release note, which was the one blocker in the readiness review, and fixed the four smaller findings too. `openspec validate plan-d --strict` passes.

1. Change directory: `$CASES/K/main/.claude/worktrees/plan-d/openspec/changes/plan-d`

2. Files written:
   - `openspec/changes/plan-d/release.md` (new): `packs: []` because the repo has no `plugins/*/.claude-plugin/plugin.json`. It also has a `release: minor` bump of `package.json`, which is the file `devkit.release_tag` names, plus a `## Greeting by name` changelog title and body.
   - `openspec/changes/plan-d/design.md`: the Context now says `src/app.ts` only exports a placeholder constant. It states that the test imports `./greet.ts` with its extension, that Node 22.6 or later is needed because the repo has no TypeScript config or build step, and it adds that Node-version risk with a mitigation.
   - `openspec/changes/plan-d/tasks.md`: the task 1.2 gate is now `node --test src/` exits 0, replacing `node -e 0`, which checked nothing. Task 1.1 now also tests a space-padded name.
   - `openspec/changes/plan-d/specs/greeting/spec.md`: added two scenarios, for an empty name `''` and a space-padded name `' Ana '`. The second adds no new behavior; the design already trims the name.

3. ADRs and specs read:
   - `readiness.md` (attempt 1 findings).
   - `decisions.md`: no record needed, and that still holds.
   - `requirements.md`: AC-1 and AC-2, with translations out of scope.
   - The change's `specs/greeting/spec.md`. There is no canonical `openspec/specs/greeting` yet.
   - `openspec/config.yaml`, `package.json`, `CHANGELOG.md` and `src/app.ts`.
   - `docs/adr/0001-start.md` exists but this change doesn't touch it.

4. Escalations: none.

5. Next step: Run the plan-readiness-review skill on `openspec/changes/plan-d` (or the adr-reviewer and spec-reviewer agents in parallel; in OpenSpec mode also `openspec validate plan-d`). Implementation starts only after an approved plan.

Outcome: planned
```

The live hook decisions of the run (`DEVKIT_HOOK_LOG` of the worktree's `guard.mjs`; mode, agent, decision, why, count). The run's transcript holds no typed `/devkit change` command, so the stop and hand-off locks read no run (`no-run`); the planner's stop is judged by the `guard.mjs subagent-stop` calls of the case, with the run transcript they name:

```text
agent devkit-core:change-planner allow (no-run) x1
stop session allow (no-run) x2
subagent-stop devkit-core:change-planner allow (no-run) x1
```

The change folder after the planner:

```text
2026-11-25T01:07:54.807Z  sha256:626c979f12f9  openspec/changes/plan-d/.openspec.yaml
2026-11-25T01:07:54.862Z  sha256:42cc5ea6b528  openspec/changes/plan-d/decisions.md
2026-11-25T01:08:57.816Z  sha256:cd514f8e1f13  openspec/changes/plan-d/design.md
2026-11-25T01:07:54.863Z  sha256:32cecd87fc1a  openspec/changes/plan-d/proposal.md
2026-11-25T01:08:19.681Z  sha256:09f072058211  openspec/changes/plan-d/readiness.md
2026-11-25T01:08:51.720Z  sha256:173d52afec5e  openspec/changes/plan-d/release.md
2026-11-25T01:07:54.862Z  sha256:5ec5e5f0e739  openspec/changes/plan-d/requirements.md
2026-11-25T01:08:57.816Z  sha256:01f184c45586  openspec/changes/plan-d/specs/greeting/spec.md
2026-11-25T01:08:57.816Z  sha256:59548b1fe344  openspec/changes/plan-d/tasks.md
```

The plan files the planner changed or added: `openspec/changes/plan-d/design.md`, `openspec/changes/plan-d/release.md`, `openspec/changes/plan-d/specs/greeting/spec.md`, `openspec/changes/plan-d/tasks.md`.

```text
(in $CASES/K/main/.claude/worktrees/plan-d)
$ cat openspec/changes/plan-d/release.md
packs: []
release: minor

## Greeting by name

- New `greet(name)` in `src/greet.ts`: returns `Hello, <name>!` for a named user, trimming surrounding spaces, and `Hello, friend!` for an empty or blank name.
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/plan-d)
$ node -e "import('$DEV/deliver-check.mjs').then((m) => console.log(JSON.stringify(m.parseReleaseNote(fs.readFileSync('openspec/changes/plan-d/release.md', 'utf8')), null, 2)))"
{
  "packs": [],
  "marketplace": null,
  "marketplaceGiven": false,
  "release": "minor",
  "title": "Greeting by name",
  "body": "- New `greet(name)` in `src/greet.ts`: returns `Hello, <name>!` for a named user, trimming surrounding spaces, and `Hello, friend!` for an empty or blank name."
}
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/plan-d)
$ node $DEV/flow-check.mjs plan-d --json   (its "next", "end" and readiness stage)
{
  "next": {
    "n": 9,
    "stage": "readiness",
    "role": "plan-readiness-reviewer",
    "skills": [
      "plan-readiness-review"
    ],
    "reasonCode": "rerun-after-fix",
    "params": {
      "stage": "readiness"
    },
    "reason": "the plan readiness failed and the work changed since; it runs again",
    "progressKey": "readiness@89326a89b5de"
  },
  "end": null,
  "readiness": {
    "id": "readiness",
    "state": "failed",
    "reasonCode": "header-failed",
    "params": {
      "attempt": 1,
      "failures": 1,
      "ceiling": 3
    },
    "result": "failed",
    "attempt": 1
  }
}
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/plan-d)
$ node $DEV/change-loop.mjs next --change plan-d --lang en
devkit-run: plan-d
{
  "version": 1,
  "change": "plan-d",
  "script": "devkit",
  "root": "$CASES/K/main/.claude/worktrees/plan-d",
  "branch": "plan-d",
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
  "brief": "Change plan-d (devkit script), stage readiness: readiness is out of date: bring it up to date. Work only in $CASES/K/main/.claude/worktrees/plan-d on branch plan-d; every file path is absolute under it; start every Bash command with cd $CASES/K/main/.claude/worktrees/plan-d && ; do not fetch. Write the change's files in English.",
  "progressKey": "readiness/readiness@89326a89b5de",
  "icon": "📝",
  "state": {
    "state": "running",
    "reason": null,
    "stage": "readiness",
    "stageTitle": "Plan readiness",
    "phase": null,
    "stageIcon": "📝",
    "stateIcon": null,
    "title": "📝 plan-d"
  },
  "sessionTitle": "📝 plan-d"
}
[exit 0]
```

The real agent, run in `$CASES/K/main/.claude/worktrees/plan-d` (the prompt on standard input; 0.5 min):

```text
(in $CASES/K/main/.claude/worktrees/plan-d)
$ TMPDIR=$CASES/tmp DEVKIT_HOOK_LOG=$CASES/runs/S-12-review-2.hooks.jsonl claude -p --model sonnet --permission-mode bypassPermissions --plugin-dir $WT/plugins/core --plugin-dir $WT/plugins/openspec --output-format stream-json --verbose < prompt.txt
[exit 0]
```

The prompt (`prompt.txt`), the brief being the `brief` field of the `next` above, verbatim:

```text
This session is the conducting session of the devkit change `plan-d` in a scratch project. It hands one stage to its agent, as the `devkit` skill's Loop does for an `agent` action; the loop's `next` gave this action: stage `readiness`, agent `devkit-core:plan-readiness-reviewer`, model `sonnet`.

Make exactly one Agent call: subagent_type `devkit-core:plan-readiness-reviewer`, model `sonnet`, and as its prompt this brief, verbatim:

Change plan-d (devkit script), stage readiness: readiness is out of date: bring it up to date. Work only in $CASES/K/main/.claude/worktrees/plan-d on branch plan-d; every file path is absolute under it; start every Bash command with cd $CASES/K/main/.claude/worktrees/plan-d && ; do not fetch. Write the change's files in English.

Do nothing else: run no command, read or write no file yourself, and make no other Agent call. When the agent returns, reply with its final message, verbatim.
```

From the run's stream-json output (kept in the scratch folder while the proof ran):

```text
session: be1dd5c0-f552-4788-a94a-e08ad0f21a03; conducting model: claude-sonnet-5-5; permission mode: bypassPermissions
plugin devkit-core 0.16.3 from $WT/plugins/core
plugin devkit-openspec 0.47.2 from $WT/plugins/openspec
Agent calls of the conducting session: 1
Agent call: subagent_type=devkit-core:plan-readiness-reviewer model=sonnet prompt-is-the-brief=yes
the agent's model: claude-sonnet-5-5
the agent's task: completed (task notification)
last result: success is_error=false turns=2 cost_usd=0.2932725
```

The tools the agent called, in order:

```text
Bash ls -la openspec/changes/plan-d openspec/changes/plan-d/specs; cat openspec/config.yaml; head -5 openspec/changes/plan-d/readiness.md; git rev-parse HEAD
Skill 
Bash cd openspec/changes/plan-d && for f in .openspec.yaml requirements.md proposal.md design.md decisions.md release.md tasks.md specs/greeting/*; do echo "=== $f"; cat -n $f; done; echo ====; cat readiness.md; ls $CASE
Bash cat -n src/app.ts; ls src docs docs/adr 2>&1; cat package.json; node --version; node --test src/ 2>&1 | tail -8; echo "exit=$?"; openspec validate plan-d --strict 2>&1 | tail -5; git rev-parse HEAD; cat $WT/plugins/
Bash node --test src/ >/dev/null 2>&1; echo exit=$?; git status --short | head
Write $CASES/K/main/.claude/worktrees/plan-d/openspec/changes/plan-d/readiness.md
```

The agent's final message (its last text; the conducting session ran it as a background agent):

```text
Status: APPROVED
Blockers: 0
Report: $CASES/K/main/.claude/worktrees/plan-d/openspec/changes/plan-d/readiness.md

This is attempt 2, written at commit 7cee9c0. The one blocker from round 1, the missing `release.md`, is fixed. The note is readable and no task bumps a version.

I checked these myself:
- **Validation:** `openspec validate plan-d --strict` passes.
- **Design claim:** `src/app.ts:1` is `export const app = 1;`, which matches the corrected Context line.
- **Gate:** `node --test src/` exits 0 on the base, so it isn't red there.
- **Spec:** the empty-name and space-padded scenarios now exist.
```

The live hook decisions of the run (`DEVKIT_HOOK_LOG` of the worktree's `guard.mjs`; mode, agent, decision, why, count). The run's transcript holds no typed `/devkit change` command, so the stop and hand-off locks read no run (`no-run`); the planner's stop is judged by the `guard.mjs subagent-stop` calls of the case, with the run transcript they name:

```text
agent devkit-core:plan-readiness-reviewer allow (no-run) x1
skill devkit-core:plan-readiness-reviewer allow (not-entry) x1
subagent-stop devkit-core:plan-readiness-reviewer allow (no-run) x1
stop session allow (no-run) x1
```

```text
(in $CASES/K/main/.claude/worktrees/plan-d)
$ cat openspec/changes/plan-d/readiness.md
<!-- devkit-stage readiness result=passed attempt=2 commit=7cee9c06a842c6e176c3dd5239597c7f81c0a401 -->
# Readiness review: plan-d

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

`openspec validate plan-d --strict` passes (run at commit 7cee9c0). The one blocker of round 1 (missing `release.md`) is fixed.

## 2. Scope validation
Classification: correct. One pure function, `greet(name)`. Out of scope (translations) is in `requirements.md:17-19`. Proposal, design, spec and tasks agree.

## 3. Proposal review
Problem, goal and impact are clear (`proposal.md:6-27`). `greeting` is a new capability, and Modified Capabilities is empty, which is right: `openspec/specs/` has no `greeting`. AC-1 and AC-2 match `requirements.md:14-15`.

## 4. Design review
Claims checked against live code:
- "`src/app.ts` exports only a placeholder constant": confirmed, `src/app.ts:1` is `export const app = 1;`. The wrong claim of round 1 is gone.
- No TypeScript config or build step: confirmed, the repo holds `package.json`, `src/app.ts`, `docs/adr/0001-start.md` and nothing else of the kind.
- Node 22.6 or later is stated; the environment runs v26.13.1.
- No dependency is added: confirmed, `package.json` has none.

No metadata, roadmap or current-state artifact is used by the project. Nothing to check.

## 5. Specs review
`specs/greeting/spec.md` has one ADDED requirement with SHALL and four scenarios: named, blank, empty and space-padded. Every AC and every design branch has a scenario. The empty-name gap of round 1 is closed.

## 6. Tasks review
- Task 1.1 is test first, with an exact done condition. Task 1.2 is the gate `node --test src/`.
- The gate was run on the base: it exits 0 (no tests exist yet), so it is not red there.
- Paths `src/greet.ts` and `src/greet.test.ts` fall under the real `src/` directory.
- Release note: `release.md` exists and reads (`packs: []`, then `release: minor`, a `## Greeting by name` title and a body, no code fence). `devkit.release_tag` is set in `openspec/config.yaml`. No task bumps a version, edits a CHANGELOG line or numbers an ADR. `decisions.md` lists no record and gives the reason.

## 7. Omission detection
No finding. Validation: a blank name is the only edge and it is defined. Non-string input is outside the `string` contract. No data, auth, rollout, retry or migration concern applies to a pure function. Test strategy: `node --test`, in the design.

## 8. Execution risks (top 5 failures)
1. Cause: a runner older than Node 22.6 / Impact: `.ts` tests do not load / Prevention: the minimum version is stated in `design.md:12`.
2. Cause: a wrong trim / Impact: a padded name is greeted with spaces / Prevention: the `' Ana '` scenario and test.

No further likely failure for a change of this size.

## 9. Mandatory fixes before implementation
- [ ] none

## 10. Optional improvements (within scope)
- [ ] none

## 11. Explicitly out of scope
- [ ] Translations (`requirements.md:19`).

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes.
2. Is the result measurable? Yes, exact strings in AC-1 and AC-2.
3. Are error behaviors defined? No error path exists; the blank name is defined.
4. Are edge cases covered? Yes: empty, blank and space-padded.
5. Are dependencies clear? None, apart from Node 22.6 or later.
6. Are contracts defined? Yes, `greet(name: string): string`.
7. Can two developers interpret this differently? No.
8. Are any decisions implicit instead of written? No.
9. Do the tasks fully deliver the intended outcome? Yes.
10. What will be discovered too late? Nothing found.

## 13. Final conclusion
- Can we start? Yes.
- What must be fixed? Nothing.
- Main risk if ignored? A Node older than 22.6 on a runner, already stated in the design.
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/plan-d)
$ git status --short
 M openspec/changes/plan-d/requirements.md
?? openspec/changes/plan-d/decisions.md
?? openspec/changes/plan-d/design.md
?? openspec/changes/plan-d/proposal.md
?? openspec/changes/plan-d/readiness.md
?? openspec/changes/plan-d/release.md
?? openspec/changes/plan-d/specs/
?? openspec/changes/plan-d/tasks.md
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/plan-d)
$ node $DEV/change-loop.mjs next --change plan-d --lang en
devkit-run: plan-d
devkit-end: plan-d waiting-for-owner
{
  "version": 1,
  "change": "plan-d",
  "script": "devkit",
  "root": "$CASES/K/main/.claude/worktrees/plan-d",
  "branch": "plan-d",
  "filesLanguage": "en",
  "kind": "end",
  "stage": "approval",
  "stageTitle": "Owner's approval",
  "role": "owner",
  "skills": [],
  "model": "sonnet",
  "end": {
    "state": "waiting-for-owner",
    "why": "waiting-approval"
  },
  "params": {
    "id": "plan-d"
  },
  "detail": {
    "readiness": "sha256:e4d227490d36",
    "release": "sha256:173d52afec5e"
  },
  "reply": "The plan of plan-d is written and reviewed. Read it and tell me whether you approve it; I go on as soon as you answer.",
  "icon": "📝",
  "state": {
    "state": "waiting-for-owner",
    "reason": {
      "code": "waiting-approval",
      "text": "your approval of the plan"
    },
    "stage": "approval",
    "stageTitle": "Owner's approval",
    "phase": null,
    "stageIcon": "📝",
    "stateIcon": "🙋",
    "title": "🙋 📝 plan-d"
  },
  "sessionTitle": "🙋 📝 plan-d"
}
[exit 1]
```

### N: release.md touched after readiness.md keeps the readiness passed

The same seed in N (no `devkit.release_tag`), with its readiness review seeded passed, then `release.md` written after it.

```text
(in $CASES/N/main)
$ node $DEV/change-loop.mjs open plan-d --script devkit --why capability --lang en <<< "Greet a user by name."
devkit-run: plan-d
{
  "version": 1,
  "change": "plan-d",
  "script": "devkit",
  "worktree": "$CASES/N/main/.claude/worktrees/plan-d",
  "branch": "plan-d",
  "base": "origin/main",
  "reply": "I opened the change plan-d on the full script, because it adds something the project cannot do today. Next come a few questions about your request; to use the short script instead, say so before the plan is written."
}
[exit 0]
```

Seeded (the plan stages, each passed) in `$CASES/N/main/.claude/worktrees/plan-d`:

```text
(in $CASES/N/main/.claude/worktrees/plan-d)
$ cat openspec/changes/plan-d/requirements.md
<!-- devkit-stage requirements result=passed attempt=1 commit=f84794fdb858f0b011c772f321b71d239bd09785 -->
# Requirements

## Request

> Greet a user by name.

## Assumptions

- The app is a Node.js service; its code lives in `src/`.

## Acceptance criteria

- AC-1: `greet('Ana')` returns `Hello, Ana!`.
- AC-2: `greet('')` and `greet('  ')` return `Hello, friend!`.

## Out of scope

- Translations.
[exit 0]
```

```text
(in $CASES/N/main/.claude/worktrees/plan-d)
$ cat openspec/changes/plan-d/decisions.md
<!-- devkit-stage decisions result=not-applicable attempt=1 commit=f84794fdb858f0b011c772f321b71d239bd09785 -->
# Decisions and ADRs

No record: a pure function with no boundary, contract or technology choice.
[exit 0]
```

```text
(in $CASES/N/main/.claude/worktrees/plan-d)
$ cat openspec/changes/plan-d/proposal.md
<!-- devkit-stage proposal result=passed attempt=1 commit=f84794fdb858f0b011c772f321b71d239bd09785 -->
# Proposal

## Why

The app answers no greeting today; the owner wants `greet(name)` for the welcome screen.

## What Changes

- New `src/greet.ts` exporting `greet(name: string): string`, returning `Hello, <name>!`.
- An empty or blank name returns `Hello, friend!`.

## Acceptance criteria

- AC-1: `greet('Ana')` returns `Hello, Ana!`.
- AC-2: `greet('')` and `greet('  ')` return `Hello, friend!`.

## Capabilities

### New Capabilities
- `greeting`: the greeting the app gives a named user.

### Modified Capabilities

## Impact

- `src/greet.ts` (new), `src/greet.test.ts` (new). No dependency is added.
[exit 0]
```

```text
(in $CASES/N/main/.claude/worktrees/plan-d)
$ cat openspec/changes/plan-d/specs/greeting/spec.md
<!-- devkit-stage specs result=passed attempt=1 commit=f84794fdb858f0b011c772f321b71d239bd09785 -->
## ADDED Requirements

### Requirement: The app greets a user by name
The app SHALL return `Hello, <name>!` from `greet(name)` for a non-blank name, and `Hello, friend!` for an empty or blank one.

#### Scenario: a named user
- **WHEN** `greet('Ana')` is called
- **THEN** it returns `Hello, Ana!`

#### Scenario: a blank name
- **WHEN** `greet('  ')` is called
- **THEN** it returns `Hello, friend!`
[exit 0]
```

```text
(in $CASES/N/main/.claude/worktrees/plan-d)
$ cat openspec/changes/plan-d/design.md
<!-- devkit-stage design result=passed attempt=1 commit=f84794fdb858f0b011c772f321b71d239bd09785 -->
# Design

## Context

`src/app.ts` exports one function per endpoint; there is no greeting.

## Decisions

- `src/greet.ts` exports `greet(name: string): string`: `name.trim()` empty gives `Hello, friend!`, else `Hello, ${name.trim()}!`.
- Tests in `src/greet.test.ts` with `node --test` (no new dependency).

## Risks

- None beyond a wrong trim; the tests cover blank names.
[exit 0]
```

```text
(in $CASES/N/main/.claude/worktrees/plan-d)
$ cat openspec/changes/plan-d/tasks.md
<!-- devkit-stage tasks result=passed attempt=1 commit=f84794fdb858f0b011c772f321b71d239bd09785 -->
# Tasks

## 1. Greeting

- [ ] 1.1 Write `src/greet.test.ts` (AC-1, AC-2: a name, an empty name, a blank name), see it fail, then write `src/greet.ts`. Done when `node --test src/` passes.
- [ ] 1.2 Gate: `node -e 0` green
[exit 0]
```

Seeded (the readiness review, passed) in `$CASES/N/main/.claude/worktrees/plan-d`:

```text
(in $CASES/N/main/.claude/worktrees/plan-d)
$ cat openspec/changes/plan-d/readiness.md
<!-- devkit-stage readiness result=passed attempt=1 commit=f84794fdb858f0b011c772f321b71d239bd09785 -->
# Readiness review: plan-d

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes
[exit 0]
```

```text
(in $CASES/N/main/.claude/worktrees/plan-d)
$ cat openspec/changes/plan-d/release.md
packs: []
release: minor

## Greetings

- `greet(name)` returns a greeting for a name.
[exit 0]
```

```text
(in $CASES/N/main/.claude/worktrees/plan-d)
$ stat -c '%y %n' openspec/changes/plan-d/readiness.md openspec/changes/plan-d/release.md   # the note is newer than the review
2026-11-24 22:09:58.772142999 -0300 openspec/changes/plan-d/readiness.md
2026-11-24 22:10:03.772143125 -0300 openspec/changes/plan-d/release.md
[exit 0]
```

```text
(in $CASES/N/main/.claude/worktrees/plan-d)
$ node $DEV/flow-check.mjs plan-d --json   (its "next", "end" and readiness stage)
{
  "next": null,
  "end": {
    "state": "waiting-for-owner",
    "stage": "approval",
    "reasonCode": "owner-pending",
    "params": {
      "stage": "approval",
      "role": "owner"
    },
    "reason": "the owner's approval waits for the owner"
  },
  "readiness": {
    "id": "readiness",
    "state": "passed",
    "reasonCode": "passed",
    "params": {
      "attempt": 1
    },
    "result": "passed",
    "attempt": 1
  }
}
[exit 1]
```

```text
(in $CASES/N/main/.claude/worktrees/plan-d)
$ node $DEV/change-loop.mjs next --change plan-d --lang en
devkit-run: plan-d
devkit-end: plan-d waiting-for-owner
{
  "version": 1,
  "change": "plan-d",
  "script": "devkit",
  "root": "$CASES/N/main/.claude/worktrees/plan-d",
  "branch": "plan-d",
  "filesLanguage": "en",
  "kind": "end",
  "stage": "approval",
  "stageTitle": "Owner's approval",
  "role": "owner",
  "skills": [],
  "model": "sonnet",
  "end": {
    "state": "waiting-for-owner",
    "why": "waiting-approval"
  },
  "params": {
    "id": "plan-d"
  },
  "detail": {
    "readiness": "sha256:f1b3efa05236"
  },
  "reply": "The plan of plan-d is written and reviewed. Read it and tell me whether you approve it; I go on as soon as you answer.",
  "icon": "📝",
  "state": {
    "state": "waiting-for-owner",
    "reason": {
      "code": "waiting-approval",
      "text": "your approval of the plan"
    },
    "stage": "approval",
    "stageTitle": "Owner's approval",
    "phase": null,
    "stageIcon": "📝",
    "stateIcon": "🙋",
    "title": "🙋 📝 plan-d"
  },
  "sessionTitle": "🙋 📝 plan-d"
}
[exit 1]
```

Done-condition of S-12 (task 9.15):

```text
holds: the first review: the claude -p run exited 0 with one Agent call
holds: the first review: readiness.md has result=failed
holds: the first review: a finding names release.md
holds: the loop hands the planner the revision (devkit-core:change-planner: Change plan-d (devkit script), stage proposal: readiness failed at attempt 1 (failures in a row: 1 of 3): revise the plan from its findings)
holds: on the copy flow-check hands the readiness review again (next: readiness rerun-after-fix)
holds: on the copy change-loop next hands the readiness review, not the same revision (devkit-core:plan-readiness-reviewer)
holds: the planner: the claude -p run exited 0 with one Agent call
holds: the planner wrote release.md
holds: parseReleaseNote reads it
holds: after the planner flow-check hands the readiness review (next: readiness rerun-after-fix)
holds: the second review: the claude -p run exited 0 with one Agent call
holds: the second review: readiness.md has result=passed
holds: the loop then leaves the plan stages (end The plan of plan-d is written and reviewed. Read it and tell me whether you approve it; I go on as soon as you answer.)
holds: in N the readiness stage stays passed (passed passed)
holds: in N change-loop next hands no plan stage (end The plan of plan-d is written and reviewed. Read it and tell me whether you approve it; I go on as soon as you answer.)
```

## S-13 K: the real tdd-implementer on resolve-base-conflict for a noted change, a code conflict and a one-line list (task 11.11; AC-4, AC-15)

Run after review round 3 (D-31, D-36), on project K built anew by `seed`. The base first gains `src/a.ts` and the one-line list of records `docs/context.yaml` (the shape of `openspec/config.yaml`'s `ADRs:` line). In each variant this worktree's `change-loop.mjs next` hands `resolve-base-conflict` with `noted: true`; the real `devkit-core:tdd-implementer` runs on the brief `next` gives and the row's dispatch sentence; then the session runs the rows the loop hands after it.

The first run of this case found one defect in an agent text, fixed test-first before both variants below were run again from a new K: in (a) the real implementer merged and committed as the row says (every other part of the done-condition held) but returned prose with no `Outcome:` line, since its Returns section spoke only of a phase and `resolve-base-conflict` has none. The section now says a hand-off of the delivery with no phase returns the same block, its `Outcome:` line last (test "release-note AC-14 texts: a delivery hand-off with no phase returns the implementer's block with its Outcome line last" in `release-note.test.mjs`; the CompozyOS copy regenerated). The same first run passed (b) whole. The merges of the base here are the loop's `merge-check` first, then the plain `push`, which the loop hands to `devkit-core:commit-and-pr` and the session runs as its command.

```text
(in $CASES/K/main)
$ git push -q origin main
(no output)
[exit 0]
```

```text
(in $CASES/K/main)
$ git show --stat '--format=%h %s' HEAD
1c27aac chore: src/a.ts and the list of records

 docs/context.yaml | 1 +
 src/a.ts          | 1 +
 2 files changed, 2 insertions(+)
[exit 0]
```

### (a) A conflict in `src/a.ts` and in the release files

`code-a` (`devkit-lite`, its plan carrying the stage headers) notes `release: minor` and names `docs/adr/code-a.md`; it is driven to its release step and takes its release:

```text
(in $CASES/K/main/.claude/worktrees/code-a)
$ node $DEV/deliver-check.mjs code-a --json   -> 1/8, next: implement (phase 1 has unticked tasks: 1.1)
    did: wrote src/code-a-1.ts; ticked 1.1
$ node $DEV/deliver-check.mjs code-a --json   -> 1/8, next: gate (phase 1 is implemented; run its gate 1.2)
    did: ran `node -e 0` (exit 0); ticked 1.2
$ node $DEV/deliver-check.mjs code-a --json   -> 1/8, next: commit (uncommitted changes outside openspec/: src/code-a-1.ts)
    did: git commit: cf9d836
$ node $DEV/deliver-check.mjs code-a --json   -> 1/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at cf9d836; git commit: b583ce8
$ node $DEV/deliver-check.mjs code-a --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at b583ce8; git commit: 0153c10
$ node $DEV/deliver-check.mjs code-a --json   -> 4/8, next: open-pr (no pull request yet)
    did: git push -u origin code-a; gh pr create -> https://github.invalid/o/devkit/pull/11
$ node $DEV/deliver-check.mjs code-a --json   -> 8/8, next: assign-release (the release of code-a is not assigned yet; assign it before the merge)
```

```text
(in $CASES/K/main/.claude/worktrees/code-a)
$ git fetch origin main
From $CASES/K/origin
 * branch            main       -> FETCH_HEAD
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/code-a)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": true,
  "oldHead": "fcab51755852bc6de37baf925efa66896b329d9f",
  "newHead": "ea434a24b293682b054e48b6090b409d690bc50f",
  "versions": {
    "packs": {},
    "release": "1.5.0"
  },
  "files": [
    "package.json",
    "CHANGELOG.md"
  ],
  "change": "code-a",
  "adrs": [
    {
      "from": "docs/adr/code-a.md",
      "to": "docs/adr/0002-code-a.md"
    }
  ],
  "citations": [
    "docs/code-a.md"
  ],
  "mode": "assign"
}
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/code-a)
$ git push origin code-a
To $CASES/K/origin.git
   fcab517..ea434a2  code-a -> code-a
[exit 0]
```

The sibling `sib-a` notes `release: patch`, names `docs/adr/sib-a.md` and lands on the same base:

```text
(in $CASES/K/main/.claude/worktrees/sib-a)
$ node $DEV/deliver-check.mjs sib-a --json   -> 1/8, next: implement (phase 1 has unticked tasks: 1.1)
    did: wrote src/sib-a-1.ts; ticked 1.1
$ node $DEV/deliver-check.mjs sib-a --json   -> 1/8, next: gate (phase 1 is implemented; run its gate 1.2)
    did: ran `node -e 0` (exit 0); ticked 1.2
$ node $DEV/deliver-check.mjs sib-a --json   -> 1/8, next: commit (uncommitted changes outside openspec/: src/sib-a-1.ts)
    did: git commit: 2dfff59
$ node $DEV/deliver-check.mjs sib-a --json   -> 1/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at 2dfff59; git commit: 3f2c638
$ node $DEV/deliver-check.mjs sib-a --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at 3f2c638; git commit: cd0bb10
$ node $DEV/deliver-check.mjs sib-a --json   -> 4/8, next: open-pr (no pull request yet)
    did: git push -u origin sib-a; gh pr create -> https://github.invalid/o/devkit/pull/12
$ node $DEV/deliver-check.mjs sib-a --json   -> 8/8, next: assign-release (the release of sib-a is not assigned yet; assign it before the merge)
```

```text
(in $CASES/K/main/.claude/worktrees/sib-a)
$ git fetch origin main
From $CASES/K/origin
 * branch            main       -> FETCH_HEAD
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/sib-a)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": true,
  "oldHead": "5b2168d9ff32fa9ba1104931c2a0006b25f7bc1e",
  "newHead": "8950e20bce2414a54535d94718b8e3b4e9ddb102",
  "versions": {
    "packs": {},
    "release": "1.4.1"
  },
  "files": [
    "package.json",
    "CHANGELOG.md"
  ],
  "change": "sib-a",
  "adrs": [
    {
      "from": "docs/adr/sib-a.md",
      "to": "docs/adr/0002-sib-a.md"
    }
  ],
  "citations": [],
  "mode": "assign"
}
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/sib-a)
$ git push origin sib-a
To $CASES/K/origin.git
   5b2168d..8950e20  sib-a -> sib-a
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/sib-a)
$ gh pr merge 12 --auto --squash --match-head-commit 8950e20bce2414a54535d94718b8e3b4e9ddb102
(no output)
[exit 0]
```

```text
(in $CASES/K/main)
$ gh __merge 12   # the stub: GitHub merges the pull request once its rules pass
ccc36221ef87309c5abfacb6f41ae59f5fb6568d
[exit 0]
```

```text
(in $CASES/K/main)
$ git log --oneline --graph -4 origin/main
* ccc3622 Merge pull request #12 from sib-a
* 1c27aac chore: src/a.ts and the list of records
* 35a9833 seed: the project at its first release
[exit 0]
```

`code-a`'s loop:

```text
(in $CASES/K/main/.claude/worktrees/code-a)
$ node $DEV/change-loop.mjs next --change code-a --lang en
devkit-run: code-a
{
  "version": 1,
  "change": "code-a",
  "script": "devkit-lite",
  "root": "$CASES/K/main/.claude/worktrees/code-a",
  "branch": "code-a",
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
      "package.json",
      "src/a.ts"
    ],
    "others": [
      "src/a.ts"
    ],
    "base": "main",
    "archive": false,
    "noted": true
  },
  "brief": "Change code-a (devkit-lite script), stage implementation: step resolve-base-conflict {\"step\":\"resolve-base-conflict\",\"reason\":\"the PR conflicts with main outside the release lines the release step writes: src/a.ts\",\"number\":11,\"paths\":[\"CHANGELOG.md\",\"package.json\",\"src/a.ts\"],\"others\":[\"src/a.ts\"],\"base\":\"main\",\"archive\":false,\"noted\":true}. Work only in $CASES/K/main/.claude/worktrees/code-a on branch code-a; every file path is absolute under it; start every Bash command with cd $CASES/K/main/.claude/worktrees/code-a && ; do not fetch. Write the change's files in English.",
  "progressKey": "implementation/resolve-base-conflict@00b5eaa20b7e",
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
    "title": "🛠️ code-a"
  },
  "sessionTitle": "🛠️ code-a"
}
[exit 0]
```

Conductor: the conducting session's part. As the `devkit` skill's Loop says for a delivery step, it appends to the brief the dispatch sentence of the `resolve-base-conflict` row of this worktree's `ship-change` skill, read from the file:

```text
Merge `origin/<next.base>` into the branch, never rebase; resolve each conflict of `next.paths` keeping what both sides meant, and the release files among them by the rule of `resolve-release-conflict` (the base's version plus the branch's own bump, the branch's changelog entry above the base's newest, the catalog regenerated), or, with `next.noted` (a change with a release note), by taking the base's side of every release line in conflict (the versions, the `CHANGELOG.md` entries, the CI pins, `docs/catalog.md`), by keeping, on a line where the base's entries meet the change's own citations (such as a one-line list of records both sides extended), the entries of both sides with the branch's text as the branch holds it, numbers included, and by writing no version and no ADR number, since `assign-release` gives back and numbers the branch after the merge; run the project's test command; commit the merge; never push.
```

The real agent, run in `$CASES/K/main/.claude/worktrees/code-a` (the prompt on standard input; 0.5 min):

```text
(in $CASES/K/main/.claude/worktrees/code-a)
$ TMPDIR=$CASES/tmp DEVKIT_HOOK_LOG=$CASES/runs/S-13-a.hooks.jsonl claude -p --model sonnet --permission-mode bypassPermissions --plugin-dir $WT/plugins/core --plugin-dir $WT/plugins/openspec --output-format stream-json --verbose < prompt.txt
[exit 0]
```

The prompt (`prompt.txt`), the brief being the `brief` field of the `next` above, verbatim:

```text
This session is the conducting session of the devkit change `code-a` in a scratch project. It hands one stage to its agent, as the `devkit` skill's Loop does for an `agent` action; the loop's `next` gave this action: stage `implementation`, agent `devkit-core:tdd-implementer`, model `sonnet`.

Make exactly one Agent call: subagent_type `devkit-core:tdd-implementer`, model `sonnet`, and as its prompt this brief, verbatim:

Change code-a (devkit-lite script), stage implementation: step resolve-base-conflict {"step":"resolve-base-conflict","reason":"the PR conflicts with main outside the release lines the release step writes: src/a.ts","number":11,"paths":["CHANGELOG.md","package.json","src/a.ts"],"others":["src/a.ts"],"base":"main","archive":false,"noted":true}. Work only in $CASES/K/main/.claude/worktrees/code-a on branch code-a; every file path is absolute under it; start every Bash command with cd $CASES/K/main/.claude/worktrees/code-a && ; do not fetch. Write the change's files in English.

Merge `origin/<next.base>` into the branch, never rebase; resolve each conflict of `next.paths` keeping what both sides meant, and the release files among them by the rule of `resolve-release-conflict` (the base's version plus the branch's own bump, the branch's changelog entry above the base's newest, the catalog regenerated), or, with `next.noted` (a change with a release note), by taking the base's side of every release line in conflict (the versions, the `CHANGELOG.md` entries, the CI pins, `docs/catalog.md`), by keeping, on a line where the base's entries meet the change's own citations (such as a one-line list of records both sides extended), the entries of both sides with the branch's text as the branch holds it, numbers included, and by writing no version and no ADR number, since `assign-release` gives back and numbers the branch after the merge; run the project's test command; commit the merge; never push.

Do nothing else: run no command, read or write no file yourself, and make no other Agent call. When the agent returns, reply with its final message, verbatim.
```

From the run's stream-json output (kept in the scratch folder while the proof ran):

```text
session: 7b3d94bf-bf4e-4b10-9ee4-dc064a465004; conducting model: claude-sonnet-5-5; permission mode: bypassPermissions
plugin devkit-core 0.18.0 from $WT/plugins/core
plugin devkit-openspec 0.50.0 from $WT/plugins/openspec
Agent calls of the conducting session: 1
Agent call: subagent_type=devkit-core:tdd-implementer model=sonnet prompt-is-the-brief=yes
the agent's model: claude-sonnet-5-5
the agent's task: completed (task notification)
last result: success is_error=false turns=1 cost_usd=0.26502180000000003
```

The tools the agent called, in order:

```text
Bash git status --short && git branch --show-current && git merge origin/main --no-edit; git status --short; git diff --name-only --diff-filter=U
Bash git diff CHANGELOG.md package.json src/a.ts; ls; cat package.json | head -30
Bash cat openspec/changes/code-a/tasks.md openspec/changes/sib-a/tasks.md; ls src; cat src/sib-a-1.ts; ls src/*test* 2>/dev/null; git log --oneline -3 origin/main -- src/a.ts
Bash cat src/app.ts src/code-a-1.ts; git show origin/main:src/a.ts; git show 1c27aac --stat | head
Bash printf 'export const a = 2; // sib-a\nexport const code_a = 1; // code-a\n' > src/a.ts git show origin/main:CHANGELOG.md > CHANGELOG.md git show origin/main:package.json > package.json git add CHANGELOG.md package.j
Bash ls -a; node -e 0 && echo ok; git commit -q -m "merge: origin/main into code-a Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" && git log --oneline -2; git status --short
```

The agent's final message (its last text; the conducting session ran it as a background agent):

```text
## Implementation: code-a, step resolve-base-conflict

Surfaces touched: `CHANGELOG.md`, `package.json`, `src/a.ts`
Tasks: none

### Diff
Merged `origin/main` into `code-a` as commit 6184f2c. I did not rebase or push. All three conflicts are resolved, and `git status` is clean.
- `$CASES/K/main/.claude/worktrees/code-a/CHANGELOG.md`: took the base's side, so the entry is `1.4.1 — sib-a lands`. The branch's `1.5.0` entry is dropped, since `assign-release` numbers the branch after the merge.
- `$CASES/K/main/.claude/worktrees/code-a/package.json`: took the base's side, version `1.4.1`.
- `$CASES/K/main/.claude/worktrees/code-a/src/a.ts`: both sides defined the same constant `a` with different values, so I kept both.
  - The base keeps `export const a = 2; // sib-a`.
  - The branch's constant is renamed to `export const code_a = 1; // code-a`.
  - Nothing imports `a`, so the rename breaks no caller.
  - **Please confirm:** this renames the branch's constant. If code-a needs `a = 1`, the two changes conflict in meaning and someone has to decide which one wins.
- `docs/context.yaml` merged without a conflict.

### Bugs fixed along the way
none

### Validation
Command: `node -e 0`. This is the Gate command from `tasks.md`, because the project has no test script in `package.json`.
Result: green. No conflict markers are left in the tree.

### Phase gate
Not applicable to this step.

Outcome: success
```

The live hook decisions of the run (`DEVKIT_HOOK_LOG` of the worktree's `guard.mjs`; mode, agent, decision, why, count). The run's transcript holds no typed `/devkit change` command, so the stop and hand-off locks read no run (`no-run`); the planner's stop is judged by the `guard.mjs subagent-stop` calls of the case, with the run transcript they name:

```text
agent devkit-core:tdd-implementer allow (no-run) x1
stop session allow (no-run) x2
subagent-stop devkit-core:tdd-implementer allow (no-run) x1
```

What the agent left:

```text
(in $CASES/K/main/.claude/worktrees/code-a)
$ git log --oneline --graph -5
*   6184f2c merge: origin/main into code-a
|\  
| * ccc3622 Merge pull request #12 from sib-a
* | ea434a2 chore(release): assign the release of code-a
* | fcab517 docs(code-a): change files
* | 0153c10 docs(code-a): reviews
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/code-a)
$ git show --stat '--format=%h %s%nparents: %P' HEAD
6184f2c merge: origin/main into code-a
parents: ea434a24b293682b054e48b6090b409d690bc50f ccc36221ef87309c5abfacb6f41ae59f5fb6568d

 CHANGELOG.md                                             |  4 ++--
 docs/adr/0002-sib-a.md                                   |  6 ++++++
 openspec/changes/sib-a/.openspec.yaml                    |  1 +
 openspec/changes/sib-a/approval.md                       |  8 ++++++++
 openspec/changes/sib-a/decisions.md                      |  3 +++
 openspec/changes/sib-a/evidence.md                       | 13 +++++++++++++
 openspec/changes/sib-a/proposal.md                       |  9 +++++++++
 openspec/changes/sib-a/readiness.md                      |  3 +++
 openspec/changes/sib-a/release.md                        |  6 ++++++
 openspec/changes/sib-a/reviews/code-quality-reviewer.md  |  6 ++++++
 openspec/changes/sib-a/reviews/test-coverage-reviewer.md |  6 ++++++
 openspec/changes/sib-a/tasks.md                          |  6 ++++++
 package.json                                             |  2 +-
 src/a.ts                                                 |  3 ++-
 src/sib-a-1.ts                                           |  1 +
 15 files changed, 73 insertions(+), 4 deletions(-)
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/code-a)
$ git status --short
(no output)
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/code-a)
$ git diff origin/main HEAD -- CHANGELOG.md   # against the base
(no output)
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/code-a)
$ git diff origin/main HEAD -- package.json   # against the base
(no output)
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/code-a)
$ git diff origin/main HEAD -- src/a.ts   # against the base
diff --git a/src/a.ts b/src/a.ts
index 9454837..dfd3073 100644
--- a/src/a.ts
+++ b/src/a.ts
@@ -1 +1,2 @@
 export const a = 2; // sib-a
+export const code_a = 1; // code-a
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/code-a)
$ cat CHANGELOG.md package.json src/a.ts
# Changelog

## 1.4.1 — sib-a lands

- sib-a does its part

## 1.4.0 — the last release

- the app as it was
{
  "name": "app",
  "version": "1.4.1",
  "private": true
}
export const a = 2; // sib-a
export const code_a = 1; // code-a
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/code-a)
$ ls docs/adr
0001-start.md
0002-code-a.md
0002-sib-a.md
[exit 0]
```

The session's rows after the agent: the records the merge staled written again (the scripted session part), then the loop:

```text
(in $CASES/K/main/.claude/worktrees/code-a)
$ node $DEV/deliver-check.mjs code-a --json   -> 4/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at 6184f2c; git commit: 19a376f
$ node $DEV/deliver-check.mjs code-a --json   -> 6/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at 19a376f; git commit: c3d6b2d
$ node $DEV/deliver-check.mjs code-a --json   -> 7/8, next: assign-release (PR #11 has merge conflicts with main)
```

```text
(in $CASES/K/main/.claude/worktrees/code-a)
$ node $DEV/change-loop.mjs next --change code-a --lang en
devkit-run: code-a
{
  "version": 1,
  "change": "code-a",
  "script": "devkit-lite",
  "root": "$CASES/K/main/.claude/worktrees/code-a",
  "branch": "code-a",
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
      "code-a",
      "--lang",
      "en"
    ],
    "merge": "6184f2cf323fa9a64a344080e028ce353cf5e3e7",
    "base": "main"
  },
  "progressKey": "evidence/merge-check@3688a30b3d80",
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
    "title": "🔍 code-a"
  },
  "sessionTitle": "🔍 code-a"
}
[exit 0]
```

The loop checks the merge of the base first (`merge-check`, post-merge-validate), run as handed:

```text
(in $CASES/K/main/.claude/worktrees/code-a)
$ node $DEV/change-loop.mjs merge-check code-a --lang en
{
  "version": 1,
  "change": "code-a",
  "base": "main",
  "merge": "6184f2cf323fa9a64a344080e028ce353cf5e3e7",
  "result": "green",
  "reds": 0,
  "errors": null,
  "error": null
}
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/code-a)
$ node $DEV/change-loop.mjs next --change code-a --lang en
devkit-run: code-a
{
  "version": 1,
  "change": "code-a",
  "script": "devkit-lite",
  "root": "$CASES/K/main/.claude/worktrees/code-a",
  "branch": "code-a",
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
    "reason": "the merge of origin/main is not pushed yet; PR #11 still has ea434a2",
    "number": 11,
    "branch": "code-a",
    "command": [
      "git",
      "push",
      "origin",
      "code-a"
    ]
  },
  "brief": "Change code-a (devkit-lite script), stage delivery: step push {\"step\":\"push\",\"reason\":\"the merge of origin/main is not pushed yet; PR #11 still has ea434a2\",\"number\":11,\"branch\":\"code-a\",\"command\":[\"git\",\"push\",\"origin\",\"code-a\"]}. Work only in $CASES/K/main/.claude/worktrees/code-a on branch code-a; every file path is absolute under it; start every Bash command with cd $CASES/K/main/.claude/worktrees/code-a && ; do not fetch. Write the change's files in English. Attribution: the session handing this off appends below this brief, verbatim, the lines it ends its own commit messages and pull-request descriptions with, as the block `Attribution (from the caller):` with one `Commit trailer: <line>` per commit line and one `PR footer: <line>` per pull-request line, or the line `Attribution (from the caller): none` when it ends them with none.",
  "progressKey": "delivery/push@3688a30b3d80",
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
    "title": "🚀 code-a"
  },
  "sessionTitle": "🚀 code-a"
}
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/code-a)
$ git push origin code-a
To $CASES/K/origin.git
   ea434a2..c3d6b2d  code-a -> code-a
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/code-a)
$ node $DEV/change-loop.mjs next --change code-a --lang en
devkit-run: code-a
{
  "version": 1,
  "change": "code-a",
  "script": "devkit-lite",
  "root": "$CASES/K/main/.claude/worktrees/code-a",
  "branch": "code-a",
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
    "reason": "the release of code-a is not assigned yet; assign it before the merge",
    "number": 11,
    "base": "main",
    "branch": "code-a",
    "command": [
      "node",
      "$DEV/release-merge.mjs",
      "--assign",
      "--base",
      "main",
      "--json"
    ]
  },
  "progressKey": "delivery/assign-release@3688a30b3d80",
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
    "title": "🚀 code-a"
  },
  "sessionTitle": "🚀 code-a"
}
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/code-a)
$ git fetch origin main
From $CASES/K/origin
 * branch            main       -> FETCH_HEAD
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/code-a)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": true,
  "oldHead": "c3d6b2da97c50c2672feeaa436a46a563fe692b1",
  "newHead": "493c257fe3ca949cb1f67d27bf8423490f5951f2",
  "versions": {
    "packs": {},
    "release": "1.5.0"
  },
  "files": [
    "package.json",
    "CHANGELOG.md"
  ],
  "change": "code-a",
  "adrs": [
    {
      "from": "docs/adr/code-a.md",
      "to": "docs/adr/0003-code-a.md"
    }
  ],
  "citations": [
    "docs/code-a.md"
  ],
  "mode": "assign"
}
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/code-a)
$ git push origin code-a
To $CASES/K/origin.git
   c3d6b2d..493c257  code-a -> code-a
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/code-a)
$ git log -1 --format=%B
chore(release): assign the release of code-a

Release-change: code-a
Release-line: package.json
Release-line: CHANGELOG.md
Release-adr: docs/adr/code-a.md -> docs/adr/0003-code-a.md
Release-citation: docs/code-a.md

[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/code-a)
$ ls docs/adr
0001-start.md
0002-sib-a.md
0003-code-a.md
[exit 0]
```

Done-condition of S-13 (a) (task 11.11):

```text
holds: (a) the claude -p run exited 0 with one Agent call
holds: (a) it returns Outcome: success (Outcome: success)
holds: (a) a merge commit whose parents are the old head ea434a2 and origin/main ccc3622 (6184f2c)
holds: (a) no conflict marker at HEAD
holds: (a) the base's side of every release line in conflict: CHANGELOG.md, package.json as origin/main has them
holds: (a) no version the agent wrote (package.json 1.4.1)
holds: (a) no ADR number the agent wrote (files with a number in neither parent: none; new records: none)
holds: (a) nothing pushed by the agent (origin's code-a is still ea434a2)
holds: (a) then next hands push (agent devkit-core:commit-and-pr push)
holds: (a) then assign-release, whose step exits 0 (session assign-release)
```

### (b) A conflict on the one-line list holding the change's own citation, and in the release files

`list-b` (`devkit-lite`, its plan carrying the stage headers) notes `release: minor` and names `docs/adr/list-b.md`; it is driven to its release step and takes its release:

```text
(in $CASES/K/main/.claude/worktrees/list-b)
$ node $DEV/deliver-check.mjs list-b --json   -> 1/8, next: implement (phase 1 has unticked tasks: 1.1)
    did: wrote src/list-b-1.ts; ticked 1.1
$ node $DEV/deliver-check.mjs list-b --json   -> 1/8, next: gate (phase 1 is implemented; run its gate 1.2)
    did: ran `node -e 0` (exit 0); ticked 1.2
$ node $DEV/deliver-check.mjs list-b --json   -> 1/8, next: commit (uncommitted changes outside openspec/: src/list-b-1.ts)
    did: git commit: f8653d3
$ node $DEV/deliver-check.mjs list-b --json   -> 1/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at f8653d3; git commit: b65ea46
$ node $DEV/deliver-check.mjs list-b --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at b65ea46; git commit: 072a002
$ node $DEV/deliver-check.mjs list-b --json   -> 4/8, next: open-pr (no pull request yet)
    did: git push -u origin list-b; gh pr create -> https://github.invalid/o/devkit/pull/13
$ node $DEV/deliver-check.mjs list-b --json   -> 8/8, next: assign-release (the release of list-b is not assigned yet; assign it before the merge)
```

```text
(in $CASES/K/main/.claude/worktrees/list-b)
$ git fetch origin main
From $CASES/K/origin
 * branch            main       -> FETCH_HEAD
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/list-b)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": true,
  "oldHead": "c7ac17fbab6fbe1745d8f8ecbb7c6b0ffa46af2c",
  "newHead": "20cc7b198280bae6a5540acde086c7920b0dea62",
  "versions": {
    "packs": {},
    "release": "1.5.0"
  },
  "files": [
    "package.json",
    "CHANGELOG.md"
  ],
  "change": "list-b",
  "adrs": [
    {
      "from": "docs/adr/list-b.md",
      "to": "docs/adr/0003-list-b.md"
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
(in $CASES/K/main/.claude/worktrees/list-b)
$ git push origin list-b
To $CASES/K/origin.git
   c7ac17f..20cc7b1  list-b -> list-b
[exit 0]
```

The sibling `sib-b` notes `release: patch`, names `docs/adr/sib-b.md` and lands on the same base:

```text
(in $CASES/K/main/.claude/worktrees/sib-b)
$ node $DEV/deliver-check.mjs sib-b --json   -> 1/8, next: implement (phase 1 has unticked tasks: 1.1)
    did: wrote src/sib-b-1.ts; ticked 1.1
$ node $DEV/deliver-check.mjs sib-b --json   -> 1/8, next: gate (phase 1 is implemented; run its gate 1.2)
    did: ran `node -e 0` (exit 0); ticked 1.2
$ node $DEV/deliver-check.mjs sib-b --json   -> 1/8, next: commit (uncommitted changes outside openspec/: src/sib-b-1.ts)
    did: git commit: df42203
$ node $DEV/deliver-check.mjs sib-b --json   -> 1/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at df42203; git commit: cffcc36
$ node $DEV/deliver-check.mjs sib-b --json   -> 3/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at cffcc36; git commit: 1874f61
$ node $DEV/deliver-check.mjs sib-b --json   -> 4/8, next: open-pr (no pull request yet)
    did: git push -u origin sib-b; gh pr create -> https://github.invalid/o/devkit/pull/14
$ node $DEV/deliver-check.mjs sib-b --json   -> 8/8, next: assign-release (the release of sib-b is not assigned yet; assign it before the merge)
```

```text
(in $CASES/K/main/.claude/worktrees/sib-b)
$ git fetch origin main
From $CASES/K/origin
 * branch            main       -> FETCH_HEAD
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/sib-b)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": true,
  "oldHead": "621fb767b8cc0e2c429e9fef598a94798bdf60cd",
  "newHead": "1228fea1268467a05a54721ed41f36b942d8d559",
  "versions": {
    "packs": {},
    "release": "1.4.2"
  },
  "files": [
    "package.json",
    "CHANGELOG.md"
  ],
  "change": "sib-b",
  "adrs": [
    {
      "from": "docs/adr/sib-b.md",
      "to": "docs/adr/0003-sib-b.md"
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
(in $CASES/K/main/.claude/worktrees/sib-b)
$ git push origin sib-b
To $CASES/K/origin.git
   621fb76..1228fea  sib-b -> sib-b
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/sib-b)
$ gh pr merge 14 --auto --squash --match-head-commit 1228fea1268467a05a54721ed41f36b942d8d559
(no output)
[exit 0]
```

```text
(in $CASES/K/main)
$ gh __merge 14   # the stub: GitHub merges the pull request once its rules pass
d48307afa057f7239218dd47cb3e86c5edb9669b
[exit 0]
```

```text
(in $CASES/K/main)
$ git log --oneline --graph -4 origin/main
* d48307a Merge pull request #14 from sib-b
* ccc3622 Merge pull request #12 from sib-a
* 1c27aac chore: src/a.ts and the list of records
* 35a9833 seed: the project at its first release
[exit 0]
```

`list-b`'s loop:

```text
(in $CASES/K/main/.claude/worktrees/list-b)
$ node $DEV/change-loop.mjs next --change list-b --lang en
devkit-run: list-b
{
  "version": 1,
  "change": "list-b",
  "script": "devkit-lite",
  "root": "$CASES/K/main/.claude/worktrees/list-b",
  "branch": "list-b",
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
    "number": 13,
    "paths": [
      "CHANGELOG.md",
      "docs/context.yaml",
      "package.json"
    ],
    "others": [
      "docs/context.yaml"
    ],
    "base": "main",
    "archive": false,
    "noted": true
  },
  "brief": "Change list-b (devkit-lite script), stage implementation: step resolve-base-conflict {\"step\":\"resolve-base-conflict\",\"reason\":\"the PR conflicts with main outside the release lines the release step writes: docs/context.yaml\",\"number\":13,\"paths\":[\"CHANGELOG.md\",\"docs/context.yaml\",\"package.json\"],\"others\":[\"docs/context.yaml\"],\"base\":\"main\",\"archive\":false,\"noted\":true}. Work only in $CASES/K/main/.claude/worktrees/list-b on branch list-b; every file path is absolute under it; start every Bash command with cd $CASES/K/main/.claude/worktrees/list-b && ; do not fetch. Write the change's files in English.",
  "progressKey": "implementation/resolve-base-conflict@6c9d366dfa48",
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
    "title": "🛠️ list-b"
  },
  "sessionTitle": "🛠️ list-b"
}
[exit 0]
```

Conductor: the conducting session's part. As the `devkit` skill's Loop says for a delivery step, it appends to the brief the dispatch sentence of the `resolve-base-conflict` row of this worktree's `ship-change` skill, read from the file:

```text
Merge `origin/<next.base>` into the branch, never rebase; resolve each conflict of `next.paths` keeping what both sides meant, and the release files among them by the rule of `resolve-release-conflict` (the base's version plus the branch's own bump, the branch's changelog entry above the base's newest, the catalog regenerated), or, with `next.noted` (a change with a release note), by taking the base's side of every release line in conflict (the versions, the `CHANGELOG.md` entries, the CI pins, `docs/catalog.md`), by keeping, on a line where the base's entries meet the change's own citations (such as a one-line list of records both sides extended), the entries of both sides with the branch's text as the branch holds it, numbers included, and by writing no version and no ADR number, since `assign-release` gives back and numbers the branch after the merge; run the project's test command; commit the merge; never push.
```

The real agent, run in `$CASES/K/main/.claude/worktrees/list-b` (the prompt on standard input; 0.4 min):

```text
(in $CASES/K/main/.claude/worktrees/list-b)
$ TMPDIR=$CASES/tmp DEVKIT_HOOK_LOG=$CASES/runs/S-13-b.hooks.jsonl claude -p --model sonnet --permission-mode bypassPermissions --plugin-dir $WT/plugins/core --plugin-dir $WT/plugins/openspec --output-format stream-json --verbose < prompt.txt
[exit 0]
```

The prompt (`prompt.txt`), the brief being the `brief` field of the `next` above, verbatim:

```text
This session is the conducting session of the devkit change `list-b` in a scratch project. It hands one stage to its agent, as the `devkit` skill's Loop does for an `agent` action; the loop's `next` gave this action: stage `implementation`, agent `devkit-core:tdd-implementer`, model `sonnet`.

Make exactly one Agent call: subagent_type `devkit-core:tdd-implementer`, model `sonnet`, and as its prompt this brief, verbatim:

Change list-b (devkit-lite script), stage implementation: step resolve-base-conflict {"step":"resolve-base-conflict","reason":"the PR conflicts with main outside the release lines the release step writes: docs/context.yaml","number":13,"paths":["CHANGELOG.md","docs/context.yaml","package.json"],"others":["docs/context.yaml"],"base":"main","archive":false,"noted":true}. Work only in $CASES/K/main/.claude/worktrees/list-b on branch list-b; every file path is absolute under it; start every Bash command with cd $CASES/K/main/.claude/worktrees/list-b && ; do not fetch. Write the change's files in English.

Merge `origin/<next.base>` into the branch, never rebase; resolve each conflict of `next.paths` keeping what both sides meant, and the release files among them by the rule of `resolve-release-conflict` (the base's version plus the branch's own bump, the branch's changelog entry above the base's newest, the catalog regenerated), or, with `next.noted` (a change with a release note), by taking the base's side of every release line in conflict (the versions, the `CHANGELOG.md` entries, the CI pins, `docs/catalog.md`), by keeping, on a line where the base's entries meet the change's own citations (such as a one-line list of records both sides extended), the entries of both sides with the branch's text as the branch holds it, numbers included, and by writing no version and no ADR number, since `assign-release` gives back and numbers the branch after the merge; run the project's test command; commit the merge; never push.

Do nothing else: run no command, read or write no file yourself, and make no other Agent call. When the agent returns, reply with its final message, verbatim.
```

From the run's stream-json output (kept in the scratch folder while the proof ran):

```text
session: 51cecb97-1597-4c89-a064-5f6b1bea8a04; conducting model: claude-sonnet-5-5; permission mode: bypassPermissions
plugin devkit-core 0.18.0 from $WT/plugins/core
plugin devkit-openspec 0.50.0 from $WT/plugins/openspec
Agent calls of the conducting session: 1
Agent call: subagent_type=devkit-core:tdd-implementer model=sonnet prompt-is-the-brief=yes
the agent's model: claude-sonnet-5-5
the agent's task: completed (task notification)
last result: success is_error=false turns=1 cost_usd=0.25636030000000004
```

The tools the agent called, in order:

```text
Bash git status --short && git merge origin/main --no-edit 2>&1 | tail -20; git status --short
Bash git diff; cat package.json | head -5; ls; cat openspec/changes/list-b/release.md
Bash git checkout --theirs CHANGELOG.md package.json && printf ' ADRs: docs/adr/ (0001 start; ADR 0003 the rule; ADR 0003 other)\n' > docs/context.yaml && git add CHANGELOG.md package.json docs/context.yaml && grep -rn '
Bash git commit -q -m "Merge origin/main into list-b Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" && git status --short && git log --oneline -3
```

The agent's final message (its last text; the conducting session ran it as a background agent):

```text
## Implementation — list-b, step resolve-base-conflict

Surfaces touched: release files (`CHANGELOG.md`, `package.json`) and `docs/context.yaml`
Tasks: none

### Diff
Merge commit `d58fcb0` merges `origin/main` into `list-b`. Nothing was rebased or pushed.
- `$CASES/K/main/.claude/worktrees/list-b/CHANGELOG.md`: took the base's side, so the top entry is `1.4.2 — sib-b lands`. The branch's `1.5.0` entry is dropped.
- `$CASES/K/main/.claude/worktrees/list-b/package.json`: took the base's side, version `1.4.2`. I wrote no version.
- `$CASES/K/main/.claude/worktrees/list-b/docs/context.yaml`: kept both sides' entries on the one line. It now reads `ADRs: docs/adr/ (0001 start; ADR 0003 the rule; ADR 0003 other)`. The branch's text is unchanged, number included.

### Bugs fixed along the way
none

### Validation
Command: none run. The repo has no test script (`package.json` has no `"test"` key) and no Makefile, so there was no test command to run.
Result: no conflict markers remain, and `git status` is clean after the commit.

### Notes for assign-release
- `docs/adr/` now holds both `0003-list-b.md` and `0003-sib-b.md`. I did not renumber either. `assign-release` has to renumber the branch's ADR and update the citation in `docs/context.yaml`.
- `package.json` is at `1.4.2`, and `openspec/changes/list-b/release.md` says `release: minor`. `assign-release` has to give the branch its version back and re-add the `list-b` changelog entry.

Outcome: success — base merged, conflicts resolved per the noted-change rule, merge committed, nothing pushed.
```

The live hook decisions of the run (`DEVKIT_HOOK_LOG` of the worktree's `guard.mjs`; mode, agent, decision, why, count). The run's transcript holds no typed `/devkit change` command, so the stop and hand-off locks read no run (`no-run`); the planner's stop is judged by the `guard.mjs subagent-stop` calls of the case, with the run transcript they name:

```text
agent devkit-core:tdd-implementer allow (no-run) x1
stop session allow (no-run) x2
subagent-stop devkit-core:tdd-implementer allow (no-run) x1
```

What the agent left:

```text
(in $CASES/K/main/.claude/worktrees/list-b)
$ git log --oneline --graph -5
*   d58fcb0 Merge origin/main into list-b
|\  
| * d48307a Merge pull request #14 from sib-b
* | 20cc7b1 chore(release): assign the release of list-b
* | c7ac17f docs(list-b): change files
* | 072a002 docs(list-b): reviews
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/list-b)
$ git show --stat '--format=%h %s%nparents: %P' HEAD
d58fcb0 Merge origin/main into list-b
parents: 20cc7b198280bae6a5540acde086c7920b0dea62 d48307afa057f7239218dd47cb3e86c5edb9669b

 CHANGELOG.md                                             |  4 ++--
 docs/adr/0003-sib-b.md                                   |  6 ++++++
 docs/context.yaml                                        |  2 +-
 openspec/changes/sib-b/.openspec.yaml                    |  1 +
 openspec/changes/sib-b/approval.md                       |  8 ++++++++
 openspec/changes/sib-b/decisions.md                      |  3 +++
 openspec/changes/sib-b/evidence.md                       | 13 +++++++++++++
 openspec/changes/sib-b/proposal.md                       |  9 +++++++++
 openspec/changes/sib-b/readiness.md                      |  3 +++
 openspec/changes/sib-b/release.md                        |  6 ++++++
 openspec/changes/sib-b/reviews/code-quality-reviewer.md  |  6 ++++++
 openspec/changes/sib-b/reviews/test-coverage-reviewer.md |  6 ++++++
 openspec/changes/sib-b/tasks.md                          |  6 ++++++
 package.json                                             |  2 +-
 src/sib-b-1.ts                                           |  1 +
 15 files changed, 72 insertions(+), 4 deletions(-)
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/list-b)
$ git status --short
(no output)
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/list-b)
$ git diff origin/main HEAD -- CHANGELOG.md   # against the base
(no output)
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/list-b)
$ git diff origin/main HEAD -- docs/context.yaml   # against the base
diff --git a/docs/context.yaml b/docs/context.yaml
index b624407..bc02d19 100644
--- a/docs/context.yaml
+++ b/docs/context.yaml
@@ -1 +1 @@
-  ADRs: docs/adr/ (0001 start; ADR 0003 other)
+  ADRs: docs/adr/ (0001 start; ADR 0003 the rule; ADR 0003 other)
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/list-b)
$ git diff origin/main HEAD -- package.json   # against the base
(no output)
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/list-b)
$ cat CHANGELOG.md docs/context.yaml package.json
# Changelog

## 1.4.2 — sib-b lands

- sib-b does its part

## 1.4.1 — sib-a lands

- sib-a does its part

## 1.4.0 — the last release

- the app as it was
  ADRs: docs/adr/ (0001 start; ADR 0003 the rule; ADR 0003 other)
{
  "name": "app",
  "version": "1.4.2",
  "private": true
}
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/list-b)
$ ls docs/adr
0001-start.md
0002-sib-a.md
0003-list-b.md
0003-sib-b.md
[exit 0]
```

The session's rows after the agent: the records the merge staled written again (the scripted session part), then the loop:

```text
(in $CASES/K/main/.claude/worktrees/list-b)
$ node $DEV/deliver-check.mjs list-b --json   -> 4/8, next: verify (evidence.md is missing, stale or lacks a gate or criterion row)
    did: wrote evidence.md at d58fcb0; git commit: 1896650
$ node $DEV/deliver-check.mjs list-b --json   -> 6/8, next: review (review needed from code-quality-reviewer, test-coverage-reviewer)
    did: wrote approved reviews of code-quality-reviewer, test-coverage-reviewer at 1896650; git commit: 0a7d08f
$ node $DEV/deliver-check.mjs list-b --json   -> 7/8, next: assign-release (PR #13 has merge conflicts with main)
```

```text
(in $CASES/K/main/.claude/worktrees/list-b)
$ node $DEV/change-loop.mjs next --change list-b --lang en
devkit-run: list-b
{
  "version": 1,
  "change": "list-b",
  "script": "devkit-lite",
  "root": "$CASES/K/main/.claude/worktrees/list-b",
  "branch": "list-b",
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
      "list-b",
      "--lang",
      "en"
    ],
    "merge": "d58fcb0f4395df22d022d0c43a110c1a90a6ea3e",
    "base": "main"
  },
  "progressKey": "evidence/merge-check@e400e8b19a0d",
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
    "title": "🔍 list-b"
  },
  "sessionTitle": "🔍 list-b"
}
[exit 0]
```

The loop checks the merge of the base first (`merge-check`, post-merge-validate), run as handed:

```text
(in $CASES/K/main/.claude/worktrees/list-b)
$ node $DEV/change-loop.mjs merge-check list-b --lang en
{
  "version": 1,
  "change": "list-b",
  "base": "main",
  "merge": "d58fcb0f4395df22d022d0c43a110c1a90a6ea3e",
  "result": "green",
  "reds": 0,
  "errors": null,
  "error": null
}
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/list-b)
$ node $DEV/change-loop.mjs next --change list-b --lang en
devkit-run: list-b
{
  "version": 1,
  "change": "list-b",
  "script": "devkit-lite",
  "root": "$CASES/K/main/.claude/worktrees/list-b",
  "branch": "list-b",
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
    "reason": "the merge of origin/main is not pushed yet; PR #13 still has 20cc7b1",
    "number": 13,
    "branch": "list-b",
    "command": [
      "git",
      "push",
      "origin",
      "list-b"
    ]
  },
  "brief": "Change list-b (devkit-lite script), stage delivery: step push {\"step\":\"push\",\"reason\":\"the merge of origin/main is not pushed yet; PR #13 still has 20cc7b1\",\"number\":13,\"branch\":\"list-b\",\"command\":[\"git\",\"push\",\"origin\",\"list-b\"]}. Work only in $CASES/K/main/.claude/worktrees/list-b on branch list-b; every file path is absolute under it; start every Bash command with cd $CASES/K/main/.claude/worktrees/list-b && ; do not fetch. Write the change's files in English. Attribution: the session handing this off appends below this brief, verbatim, the lines it ends its own commit messages and pull-request descriptions with, as the block `Attribution (from the caller):` with one `Commit trailer: <line>` per commit line and one `PR footer: <line>` per pull-request line, or the line `Attribution (from the caller): none` when it ends them with none.",
  "progressKey": "delivery/push@e400e8b19a0d",
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
    "title": "🚀 list-b"
  },
  "sessionTitle": "🚀 list-b"
}
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/list-b)
$ git push origin list-b
To $CASES/K/origin.git
   20cc7b1..0a7d08f  list-b -> list-b
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/list-b)
$ node $DEV/change-loop.mjs next --change list-b --lang en
devkit-run: list-b
{
  "version": 1,
  "change": "list-b",
  "script": "devkit-lite",
  "root": "$CASES/K/main/.claude/worktrees/list-b",
  "branch": "list-b",
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
    "reason": "the release of list-b is not assigned yet; assign it before the merge",
    "number": 13,
    "base": "main",
    "branch": "list-b",
    "command": [
      "node",
      "$DEV/release-merge.mjs",
      "--assign",
      "--base",
      "main",
      "--json"
    ]
  },
  "progressKey": "delivery/assign-release@e400e8b19a0d",
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
    "title": "🚀 list-b"
  },
  "sessionTitle": "🚀 list-b"
}
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/list-b)
$ git fetch origin main
From $CASES/K/origin
 * branch            main       -> FETCH_HEAD
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/list-b)
$ node $DEV/release-merge.mjs --assign --base main --json
{
  "resolved": true,
  "oldHead": "0a7d08f57e6ac754beaf8aa59da0c1d79cf7d1d9",
  "newHead": "82563957f79312bab6ff3d9bb793c5c31c29f39b",
  "versions": {
    "packs": {},
    "release": "1.5.0"
  },
  "files": [
    "package.json",
    "CHANGELOG.md"
  ],
  "change": "list-b",
  "adrs": [
    {
      "from": "docs/adr/list-b.md",
      "to": "docs/adr/0004-list-b.md"
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
(in $CASES/K/main/.claude/worktrees/list-b)
$ git push origin list-b
To $CASES/K/origin.git
   0a7d08f..8256395  list-b -> list-b
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/list-b)
$ git log -1 --format=%B
chore(release): assign the release of list-b

Release-change: list-b
Release-line: package.json
Release-line: CHANGELOG.md
Release-adr: docs/adr/list-b.md -> docs/adr/0004-list-b.md
Release-citation: docs/context.yaml

[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/list-b)
$ ls docs/adr
0001-start.md
0002-sib-a.md
0003-sib-b.md
0004-list-b.md
[exit 0]
```

```text
(in $CASES/K/main/.claude/worktrees/list-b)
$ cat docs/context.yaml
  ADRs: docs/adr/ (0001 start; ADR 0004 the rule; ADR 0003 other)
[exit 0]
```

Done-condition of S-13 (b) (task 11.11):

```text
holds: (b) the claude -p run exited 0 with one Agent call
holds: (b) it returns Outcome: success (Outcome: success — base merged, conflicts resolved per the noted-change rule, merge committed, nothing pushed.)
holds: (b) a merge commit whose parents are the old head 20cc7b1 and origin/main d48307a (d58fcb0)
holds: (b) no conflict marker at HEAD
holds: (b) the base's side of every release line in conflict: CHANGELOG.md, package.json as origin/main has them
holds: (b) no version the agent wrote (package.json 1.4.2)
holds: (b) no ADR number the agent wrote (files with a number in neither parent: none; new records: none)
holds: (b) the list's line holds the base's entry (ADR 0003 other) and the change's entry as the branch held it (ADR 0003 the rule): ADRs: docs/adr/ (0001 start; ADR 0003 the rule; ADR 0003 other)
holds: (b) nothing pushed by the agent (origin's list-b is still 20cc7b1)
holds: (b) then next hands push (agent devkit-core:commit-and-pr push)
holds: (b) then assign-release, whose step exits 0, the record numbered above the base's and the line holding both entries (session assign-release)
```
