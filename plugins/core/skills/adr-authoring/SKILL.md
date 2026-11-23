---
name: adr-authoring
description: Decides which of a change's decisions deserve an architecture decision record and drafts each one in the project's ADR folder with status proposed, then lists them in the change's decisions.md, or says in one line that none is needed. Use when a change is planned and its decisions may be hard to reverse, cross a boundary, change a contract or contradict an accepted record — "does this need an ADR?", "draft the decision records".
---

# ADR authoring

Record the decisions a change takes that the next person could not undo or rediscover cheaply, and nothing else. A record is a proposal until the owner approves the plan that depends on it.

## When to use (and when not)

- **Use** after the requirements and before the proposal, on a script that has a decisions stage.
- **Don't use** to record a decision that is easy to reverse and touches no boundary: write `result=not-applicable` and one line saying why.
- **Don't use** to edit or accept an existing record.

## Method

1. **List the decisions the change takes** from the requirements and the code it will touch.
2. **Test each one.** Is it hard to reverse? Does it cross a boundary, change a contract or pick a technology? Does it contradict or amend an accepted record? Read the project's records first, and their rejected alternatives: a decision a record already rejected is a contradiction. Write a record only for a decision that passes.
3. **Find the project's ADR folder, naming pattern and form.** The hooks let you write only a Markdown file in a folder named `adr`, `adrs` or `decisions` (any letter case). When the project's folder has another name, write nothing and return `Outcome: failure` naming that folder. When the project has no ADR folder, create `docs/adr/` and start at 0001.
4. **Write each record** in that pattern, with a status line saying `proposed` (`- Status: proposed`) and the sections Context, Decision, Consequences and Alternatives. Cite the records it relies on.
5. **An amendment or a supersession is a new record** that names the one it changes. The accepted record's text stays as it is.
6. **Update the project's index** when it keeps one.
7. **Write `decisions.md`** from its template: one line per record, `- ADR: ` then the path from the repository root in backticks, then ` — ` and the title, with `result=passed`. When no decision needs a record, `result=not-applicable` and one line saying why.

## Output

The proposed records, the index line for each, and `decisions.md`, with `Outcome: proposed <n>` or `Outcome: none-needed`.
