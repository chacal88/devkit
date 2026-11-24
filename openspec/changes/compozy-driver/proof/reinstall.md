# Reinstall proof (AC-8, task 5.5)

Change: `compozy-driver` · Date: 2026-11-23 · Run by the conducting session.

What: the kit installed over a scratch copy of the **real** old kit. The copy is this repository's
`.compozy/` as it was at `77b15b1`, built with `git show 77b15b1:.compozy/<path>` for each of the nine
files (the four shells `agents/{tech-lead,dev,qa,design}/AGENT.md`, `loops/openspec-change/loop.yaml`,
`config.toml`, `README.md`, `bin/devkit-kit` and `kit-manifest.json`), in a scratch git repository.
One shell was hand-edited after the copy: a line appended to `agents/qa/AGENT.md`. The installer is
the branch's, installed from the temporary `devkit-proof` marketplace
(`devkit-compozy` 9.0.0, a copy of this worktree's `plugins/`):

```
node <cache>/devkit-compozy/9.0.0/skills/compozy-setup/scripts/install-kit.mjs <scratch>
```

Output (the twenty `create .compozy/agents/<role>/AGENT.md` lines are summarised after the listing):

```
update    .compozy/config.toml
update    .compozy/README.md
create    .compozy/loops/devkit-change/loop.yaml
create    .compozy/loops/devkit-review/loop.yaml
create    .compozy/loops/devkit-roadmap/loop.yaml
update    .compozy/bin/devkit-kit
remove    .compozy/agents/tech-lead/AGENT.md
remove    .compozy/agents/dev/AGENT.md
kept      .compozy/agents/qa/AGENT.md
remove    .compozy/agents/design/AGENT.md
remove    .compozy/loops/openspec-change/loop.yaml
dropped   __PLANNER__
dropped   __IMPLEMENTER__
dropped   __REVIEWER__
dropped   __DESIGNER__
dropped   __VERIFY_COMMAND__
dropped   __DEMO_COMMAND__
dropped   __DEMO_URL__

.compozy/agents/qa/AGENT.md: edited by the project, left in place: delete it or run again with --accept .compozy/agents/qa/AGENT.md
```

The 20 agent files created, one per devkit role:

```
create    .compozy/agents/adr-author/AGENT.md
create    .compozy/agents/adr-reviewer/AGENT.md
create    .compozy/agents/architecture-reviewer/AGENT.md
create    .compozy/agents/change-coordinator/AGENT.md
create    .compozy/agents/change-planner/AGENT.md
create    .compozy/agents/code-quality-reviewer/AGENT.md
create    .compozy/agents/codebase-researcher/AGENT.md
create    .compozy/agents/commit-and-pr/AGENT.md
create    .compozy/agents/e2e-tester/AGENT.md
create    .compozy/agents/finding-verifier/AGENT.md
create    .compozy/agents/openspec-validator/AGENT.md
create    .compozy/agents/plan-readiness-reviewer/AGENT.md
create    .compozy/agents/plan-reality-auditor/AGENT.md
create    .compozy/agents/pr-verifier/AGENT.md
create    .compozy/agents/screen-designer/AGENT.md
create    .compozy/agents/security-reviewer/AGENT.md
create    .compozy/agents/spec-reviewer/AGENT.md
create    .compozy/agents/tdd-implementer/AGENT.md
create    .compozy/agents/test-coverage-reviewer/AGENT.md
create    .compozy/agents/test-runner/AGENT.md
```

After the run, `ls .compozy/agents` holds the twenty new agents and `qa` (the hand-edited shell);
`tech-lead`, `dev` and `design` are gone, and so is `loops/openspec-change/loop.yaml`.

Check of task 5.5: four `remove` lines (`tech-lead`, `dev`, `design` and the old loop), one file
kept and named (`agents/qa/AGENT.md`, with the command that accepts its removal), the new agents
and the three new loops created. Result: pass.
