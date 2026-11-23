Verdict: approved
Commit: 0bf76b45f9360e60d58bae1d927a5475b914dc2b

## Quality review — release-tags (round 1)

### Findings
- [nit] docs/adr/0019-the-delivery-loop-tags-the-release-it-merged.md:3-4 — The ADR header has two Status lines ('Status: accepted' and 'Status: Accepted by: ...'); ADR 0018 uses 'Status: accepted' plus a separate 'Accepted by:' line. Align to avoid a parser reading the wrong one.
- [nit] plugins/openspec/skills/ship-change/SKILL.md:76 — The local-tag guard compares `git rev-parse -q --verify refs/tags/<tag>` to the sha; an annotated local tag resolves to the tag object, not the commit, so it would stop as 'another commit' even when it points at the merge. Conservative and safe, but `refs/tags/<tag>^{commit}` would be exact.
- [nit] plugins/openspec/hooks/deliver-check.mjs:1318-1325 — On an archived change, every later run repeats up to 6 gh reads for the change's PR plus a PR list and up to 6 reads for the archive PR. This only happens with release_tag set, and once per run. If it gets hot, cache `done` per run.
- [nit] openspec/changes/release-tags/tasks.md:124 — The Workflow follow-up still names v0.29.0, while the release settled on 0.30.0 and the pin tests use v0.30.0. It hedges with 'or the version 4.4 settled', but a stale number in a delivered task file invites a wrong by-hand tag.
- [praise] plugins/openspec/hooks/deliver-check.mjs:1203-1272 — releaseTagFacts fails closed. The stop is distinct for a 404 on the tag (step to run) versus a timeout or unreadable answer (stop), and it handles lightweight, annotated and array answers. The tag version is validated before it reaches a URL, and every call stops at the first decisive answer.
- [praise] plugins/openspec/hooks/guard.mjs:128-142 — isJsonPath is a segment whitelist that rejects '.', '..', an absolute path, a query string and anything not ending in .json, and a single releaseTagSetting is shared by the loop's start refusal and the checker.
- [praise] plugins/openspec/hooks/release-tags.test.mjs — Red-before-green proofs are saved per phase. Tests assert the exact gh calls (including 'no key means today's calls'), reach new functions through namespace imports, and cover the CLI exit codes and both languages.

### Summary
- 7 findings (0 blocking, 0 important, 4 nit) + 3 praise.
- Justification: the diff matches the proposal, tasks and accepted ADR 0019. Ownership follows existing code; without the key the code adds no gh calls. The path whitelist and the tag-version validation close the URL-injection risk, and the fact reader fails closed. The release-tags suite alone passes (43 of 43); the reviewer checked the real GitHub response shapes for an existing and a missing tag. The full guard suite was not re-run: evidence.md shows it green (2110) on the same code. tag-release has not run end to end against real GitHub because the step exists only once this version is installed.
