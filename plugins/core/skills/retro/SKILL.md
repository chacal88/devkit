---
name: retro
description: Short retrospective after a phase or a whole change. Answers three questions (what went wrong, how to do it better, what to remember), classifies each learning and proposes doc or rule updates as diffs for the owner to approve, never writing them blindly. Use at the end of a change or phase, or when the user says "retro", "what did we learn", "consolidate learnings", "lessons learned".
---

# Retro

Turn what went wrong (and got corrected along the way) into a learning the next change can use. Lightweight: if it becomes ceremony, it lost the point.

## When to use

- After a phase (implementation, review) for a quick per-phase retro.
- At the end of a change, after review and before or with the PR, to consolidate.
- At the archive step of `ship-change`, after the change's PR merged: it writes `retro.md` in the change folder and the owner answers each proposal.
- Never as a gate: a retro doesn't block the ship.

## Process

### 1. Gather

Read the change's diff against its base, the review findings, test failures that were fixed, and the corrections made in the conversation. Guiding question: *would someone landing on the next change know what to do from the current docs alone?* If not, it's a learning.

### 2. Answer the three questions

1. **What went wrong?**
2. **How to do it better next time?**
3. **What to remember?** One line.

### 3. Classify each learning

- **kind:** `bug-class` · `doc-gap` · `project-rule` · `process-friction` · `tooling` · `environment`
- **action:** `followup` (becomes a task) · `doc-update` · `rule` (becomes a project rule) · `regression-gate` (becomes a permanent test) · `memory-only`
- **scope:** `project` (this repo) · `user` (you, any project). When in doubt, the narrowest.

A bug class that recurs after it was already mitigated is a signal for a deeper review, not just another fix; propose a `regression-gate`.

### 4. Propose, don't write

For every `doc-update`, `rule` or `regression-gate`, write a **proposed diff**: target file, kind, one-line summary, before/after. Typical targets: the project's CLAUDE.md, CONTRIBUTING, a conventions/gotchas doc, an ADR draft (when the learning is a decision), a test file (regression gate). Present them; the owner approves and applies, or they become a change of their own.

For `memory-only`: `project` scope → propose a line for the project's memory or CLAUDE.md; `user` scope → propose an item for the user's memory. Same rule: propose, the owner accepts.

## Output

```
## Retro: <change | phase>

1. Went wrong: ...
2. Better next time: ...
3. Remember: ...

| # | Learning | kind | action | scope |
|---|---|---|---|---|

## Proposed updates

### `CONTRIBUTING.md` (process-friction)
<summary>
- before: ...
+ after: ...

### `docs/gotchas.md`, `plugins/example/example.test.mjs` (regression-gate)
<summary>
- before: ...
+ after: ...

### user memory (memory-only)
<one line to remember>
```

Rules for `## Proposed updates`, which a checker reads (`deliver-check`):

- Each proposal is a `### ` heading. Every file it changes is an exact backticked repo-relative path on that heading line: no directories, no globs, no prose. A regression gate's test file is one of those paths, next to the doc it protects. A proposal for the user's memory says `user memory` instead of a path (a project-scope memory line names the file it edits, such as `CLAUDE.md`). The kind is in parentheses at the end of the line.
- No proposals: write `## Proposed updates` followed by `None.`. The section is required.
- Diff lines are `- before:` and `+ after:`. Do not start any other line with `- Answer:` or `- Applied:`.
- The retro writes no `- Answer:` line. The caller (`ship-change`) writes it from the owner's own message, once per proposal, as `- Answer: approved` or `- Answer: rejected: <reason>`. Whoever applies an approved proposal writes `- Applied: yes` under it. Once answered and applied, a block looks like this:

```
## Proposed updates

### `CONTRIBUTING.md` (process-friction)
<summary>
- before: ...
+ after: ...
- Answer: approved
- Applied: yes

### `docs/gotchas.md`, `plugins/example/example.test.mjs` (regression-gate)
<summary>
- before: ...
+ after: ...
- Answer: rejected: out of scope

### user memory (memory-only)
<one line to remember>
- Answer: approved
```

## Never

- Edit docs, rules, memory or tests directly. Every update is a proposal.
- Do not write an `Answer:` line yourself: only the owner's own message answers a proposal.
- Put secrets, credentials, sensitive paths or code snippets in a "remember" line: one line, the class only.
- Inflate a local learning into a global rule.
- Block the ship on a retro.

## Related

- Skills: `review-change` (findings feed the retro), `systematic-debugging` (root causes worth remembering).
