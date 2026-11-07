---
name: commit-message-guidelines
description: Format for git commit messages and PR titles, taken from the project itself - its ticket key convention when it uses tickets (from branch names, CONTRIBUTING, git log), conventional commits otherwise - with an imperative subject and a "why" body. Load before writing or staging any commit message or PR title. Use when the user says "commit this", "write the commit message", "open a PR".
---

# Commit message guidelines

## Find the project's convention first

Before writing, determine the convention, in this order:

1. **Documented rules:** CONTRIBUTING, CLAUDE.md, a `docs/` git or hooks guide, commitlint config (`commitlint.config.*`, `.commitlintrc*`), a `commit-msg` hook.
2. **Existing history:** `git log --oneline -30` on the base branch. Look for a ticket key pattern (`[ABC-123] ...`, `ABC-123: ...`) and where it sits, or a conventional-commit prefix (`feat(scope): ...`).
3. **Branch name:** a key in it (`ABC-123-short-desc`, `feature/ABC-123`) means the project uses tickets.

Then use one of the two formats below. If the project documents its own, it wins over both.

## Format A: the project uses tickets

```
<ticket> <Subject, imperative mood, ~50 characters>

<Body: why the change was made, wrapped at ~72 characters. Say what the
diff cannot: motivation, constraints, trade-offs, follow-ups.>
```

- Write the ticket exactly as the project does: brackets or not, position, separator, case. Typical shape: `[ABC-123] Add retry to webhook delivery`. Multiple tickets follow the project's pattern (`[ABC-1, ABC-2]` or `[ABC-1][ABC-2]`).
- Git's own prefixes go before the ticket: `fixup! [ABC-123] ...`, `Revert "[ABC-123] ..."`.
- Only the keys the project accepts. If the project names an umbrella ticket for maintenance work, use it; otherwise there is no ticketless option.
- A conventional-commit type after the ticket is fine if the project allows it: `[ABC-123] docs(api): document pagination`.

## Format B: the project uses no tickets

Conventional commits:

```
<type>(<optional scope>): <subject, imperative, lowercase start, no full stop>

<Body: why, wrapped at ~72 characters.>
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `build`, `ci`. Breaking change: `feat!:` or a `BREAKING CHANGE:` footer.

## Rules for both

- **Subject:** imperative ("Add", "Fix", "Remove", not "Added"); about 50 characters after the prefix, whole line under 72; no trailing full stop.
- **Line 2 blank.**
- **Body explains why**, not what; the diff shows what.
- **Attribution trailers** a tool adds after the body (`Co-Authored-By: ...`) stay as they are.
- **Old commits** that don't follow the format are not rewritten.
- **PR title** has the same shape as a subject. With merge or squash merges the title becomes the permanent subject on the base branch.

## Instructions for AI assistants

1. **Find the ticket, never invent one.** Take it from the branch name, the conversation, the linked PR or earlier commits on the branch, and say where it came from. If the project uses tickets and none is clear, stop and ask. Never write a placeholder (`[ABC-TBD]`) and never make up a key.
2. **Write the subject** as above and commit normally so the project's hooks check it. **Never `--no-verify`.** If a hook rejects the message, fix the message, don't bypass the hook.
3. **Write a "why" body.**
4. **Use the same subject shape for the PR title** (`gh pr create --title`), and on every PR when the project opens more than one for a change.

## Related

- Agents: `commit-and-pr` (stages, commits and opens the PR using these rules).
