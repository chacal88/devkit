<!-- devkit-stage requirements result=passed attempt=1 commit=none -->
# Requirements

## Request

> the delivery loop's brief to the commit step carries the coordinator session's attribution lines (the commit footer and the pull-request footer), and `plugins/core/agents/commit-and-pr.md` uses the brief's lines over its own environment's, so a commit made by the commit agent names the model of the session that did the work (managed-agents-study retro, item 2)

Classification: domain=process type=bug flags=[contract] (strict-assumed: the brief is a contract between the loops and the commit agent)

## Questions asked

1. [scope] Where do the attribution lines of a commit and of a pull request made by the commit agent come from? → From the session that conducts the change, copied verbatim into the brief; the caller's lines win over the agent's own environment. Answer delegated by the owner to the coordinating roadmap session (`verifique todas as perguntas e as que você tiver a informação para responder, pode ir respondendo`), which answered 1, citing the rule the owner already chose for the commit agent.
2. [end effect] What proves it works, given this change's own commits still run through the installed (older) loop? → The tests, plus one real run of the commit agent in a scratch project; real use is checked by the next change delivered after the release. Answer delegated by the owner to the coordinating roadmap session (same delegation), which answered 1.

## Assumptions

<!-- Each confirmed by the owner. Literal paths, fields, names. -->
- The lines are the ones the conducting session's host gives it: in Claude Code, the commit trailer (`Co-Authored-By: <model> <noreply@anthropic.com>`) and the pull-request footer (`🤖 Generated with [Claude Code](https://claude.com/claude-code)`). The loop scripts cannot read them; the session adds them to the brief when it dispatches the agent.
- Every hand-off to `devkit-core:commit-and-pr` carries them: the steps `commit`, `open-pr`, `push`, `open-archive-pr` and `push-rebased` of `plugins/openspec/hooks/change-loop.mjs`, the commit steps of `plugins/openspec/hooks/project-loop.mjs`, and the matching rows of `plugins/openspec/skills/ship-change/SKILL.md` and `plugins/openspec/skills/devkit/SKILL.md`.
- `plugins/core/agents/commit-and-pr.md`: when the brief carries attribution lines, the agent writes exactly those and no other `Co-Authored-By` line or footer; when the brief says there are none, it writes none; when the brief says nothing about them (an older caller), today's behaviour stays.

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
- AC-1 `brief-carries-lines` — every hand-off to `devkit-core:commit-and-pr` that `change-loop.mjs` and `project-loop.mjs` print, and every dispatch row of `ship-change` and `devkit` that names that agent, tells the conducting session to add its own commit trailer and pull-request footer to the brief, verbatim; a test fails when one hand-off lacks it.
- AC-2 `agent-prefers-brief` — `plugins/core/agents/commit-and-pr.md` says the brief's attribution lines win over its own environment's: given lines, it writes exactly those and no other `Co-Authored-By` line or footer; given "none", it writes none.
- AC-3 `scratch-run-names-session-model` — one real run of the commit agent in a scratch git project, with a brief that carries `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, makes a commit whose `git log -1 --format='%(trailers)'` shows exactly that line and no Sonnet line; the output is recorded in `evidence.md`.
- AC-4 `this-change-commits-name-session` — every commit of this change's branch made by the commit agent ends with the conducting session's trailer (passed by hand while the installed loop is the older one).

## Dogfood (checked after this change, not here)

- The next change delivered with the released version: its commits made by the commit agent name the conducting session's model, and its pull request ends with the session's footer, with no line added by hand.

## Out of scope

- Rewriting the trailers of commits already on `main`.
- Choosing which model the commit agent runs on (`model: sonnet` stays).
- Attribution lines for any agent other than `devkit-core:commit-and-pr`.
