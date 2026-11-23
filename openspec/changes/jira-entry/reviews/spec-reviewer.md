Verdict: approved
Commit: 34edbd824ac8b6fd079246409877233acfb4d7c0

## Spec review — jira-entry (round 1, re-review after merging main)

### Findings
- [nit] plugins/openspec/hooks/jira-task.mjs:taskIdPrefix; openspec/changes/jira-entry/specs/jira-tasks/spec.md, requirement 'A change opened from a task records the task' — Previous nit, still open: the code maps '_' to '-' in the id prefix and the spec says nothing about it.
- [nit] openspec/changes/jira-entry/evidence.md — Previous nit: evidence.md was uncommitted. It is now tracked and was refreshed in 34edbd8. · fixed in 484a8a7
- [nit] docs/openspec-flow.md (the `/devkit roadmap` and `status` bullet and 'The forms' paragraph) — The change also rewrites 'project and help are not built' to 'project is built, only help is not'. That is a correction to text on main that no jira-tasks requirement asks for; probably a conflict-resolution fix. Keep it or move it to its own change.

In-scope specs: openspec/changes/jira-entry/specs/jira-tasks/spec.md (the only capability touched).

### Coverage
| Requirement | Status |
|---|---|
| A Jira key or link typed alone is read as a task | covered (`start` answers mode `task`; SKILL.md routes it; the catalog, description and argument-hint name it) |
| Jira is reached only through the session's connector | covered (SKILL.md 'A Jira task' and 'Writing back'; the Never list forbids a token or a setting; ADR 0010 note) |
| A task that cannot be read opens nothing | covered (`task-no-connector` and `task-unreadable` replies, SKILL.md steps 1 and 2) |
| A change opened from a task records the task | covered (`open --task` in SKILL.md step 5) |
| The key resumes its unfinished change | covered (the `choose` and `ask-unfinished` rows route 'start the new request' to the Jira section) |
| The grill asks only what the task leaves open | covered (the `grill` bullet carries `task`; requirements-grill paragraph) |
| The write-back question is asked once when the pull request opens | covered (`write-back ask`; the question is plain text and not a gate) |
| Jira is written only on the developer's yes | covered (`write-back answer`; the Never list forbids writing Jira otherwise) |

The merge resolutions keep the change's side intact beside main's code. The versions are consistent: marketplace 0.28.0, devkit-core 0.12.0, devkit-openspec 0.24.0, with matching CHANGELOG, `v0.24.0` pins in the CI snippet, and an unchanged 0.27.0 entry from main. The jira-entry section of `docs/openspec-flow.md` (the `/devkit change <Jira key or link>` bullet, 'A Jira task') matches the spec.

### Summary
- 3 findings, all nits (1 scope creep-ish, 0 gaps); 0 blocking.
