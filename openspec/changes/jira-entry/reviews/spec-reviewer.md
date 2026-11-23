Verdict: approved
Commit: 0637603bc47cf3382a7b2d09bd7fc2fb8b5881b3

## Spec review — jira-entry

### Findings
- [nit] plugins/openspec/hooks/jira-task.mjs:taskIdPrefix; spec.md Requirement 'A change opened from a task records the task' — The spec says the id starts with the key in lower case and a dash. The code also maps '_' to '-' (MY_APP-7 gives my-app-7), which the spec does not state. This is probably forced by the change-name rule, but the spec is silent. Add a sentence to the spec delta, or confirm that the key's underscore cannot appear in an id.
- [nit] openspec/changes/jira-entry/evidence.md — evidence.md is untracked, written by pr-verifier, and not yet committed. Commit it before the pull request is opened.

In-scope specs: openspec/changes/jira-entry/specs/jira-tasks/spec.md. This is the only capability the change touches. Its non-functional rules (no network call, no token, no setting) are covered under the second requirement below.

### Coverage
| Requirement | Status |
|---|---|
| A Jira key or link typed alone is read as a task | covered (parseTaskRef; startMode returns mode `task`, with the link kept) |
| Jira is reached only through the session's connector | covered (jira-task.mjs does no I/O; no setting is read; the ADR 0010 note records that no setting is added) |
| A task that cannot be read opens nothing | covered (the task-no-connector and task-unreadable replies are wired in SKILL.md steps 1 and 2) |
| A change opened from a task records the task | covered (`open --task` checks the id prefix and the JSON, and writes the key line and quoted parts; the answer to every error is exit 3) |
| The key resumes its unfinished change | covered (startMode resumes the change that records the key; `open` refuses with task-taken; a key with other unfinished changes asks continue or new) |
| The grill asks only what the task leaves open | covered (requirements-grill paragraph; `next` adds `task` to the action) |
| The write-back question is asked once when the pull request opens | covered (action.writeBack; `write-back ask` stores a record; no ask on the archive branch or when the change has no task; the question is plain text and holds nothing) |
| Jira is written only on the developer's yes | covered (`write-back answer` handles second answer, late answer, unknown choice, no, comment and transition, and the comment's language; the connector-failure reply is in SKILL.md) |

### Summary
- 2 findings, both nits (0 scope creep, 0 gaps).
