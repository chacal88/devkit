Verdict: approved
Commit: 5edea6bd2080c7e55bca299fb82202d2d25484cf

## Security audit — roadmap-sessions-upfront (round 3)

### Findings
- [nit] plugins/openspec/skills/devkit-session/SKILL.md:28 (merge-base exit 3) — Round 2 nit, unchanged: the skill tells the agent to paste the JSON `error` (git merge output, which can include file names) inside a double-quoted `--param error="..."` shell argument, although the JSON already carries a rendered `reply`. The same pattern is in devkit/SKILL.md. Consider saying the reply is shown as given, or that the value is single-quoted.

Triaged scope: high: roadmap-loop.mjs (isRequirementsHelper and roadmapAgentDecision, the persist block of `decide`, run-file.mjs readUpfront, session-start actions), guard.mjs (skill gate, leading notes); medium: change-loop.mjs (the grill `helpers` field), conduct-check.mjs (adrClash), flows/2.json in four copies, released-flows.json; low: spec deltas, design D-17, tests, evidence, docs.

Judged: git diff origin/main...HEAD, plus 7eb62be (phase 8) and the merge 5cc1c69. For the merge I looked only at how remote-worker's code and this change's combine: `occupied` against `placed` in OUTLIVES, pruneRecords and the persist block, and the remote session-start. What main brought (remote-worker, machine-probe.mjs, ssh and askMachine) was not judged.

Categories walked: injection, authn/authz/IDOR, exposure, crypto, secret, config.

Previous findings: round 2 (commit f7c5945) was approved, and its only finding is F1, a nit with no disposition. It is unchanged, so it is listed as it stands.

Discarded false positives:
- isRequirementsHelper now reads the change's pinned flow (phase 8, D-17). The change id comes from the hand-off prompt through `BRIEF_OF`, `^Change ([A-Za-z0-9][\w.-]*) \(`. The first character is alphanumeric and `/` is excluded, so the id cannot traverse a path. The pin and schema readers (`changeFlow`, `changeSchemaAt`, `readFlow`) are existing code and only read files. For a missing folder, the project's installed flow answers and the later `open.includes(change)` check still refuses. The check only widens what a grill may delegate to roles listed in the flow's `requirements` helpers, and the caller still needs the change open on the roadmap and not on the previous script.
- The grill `helpers` field and the check's `triage` filter are pure data from the pinned flow. They add no input path, and a flow without the helper simply gets no triage action.
- flows/2.json (four copies) and the released-flows.json digests: static JSON checked against a pinned digest. The only difference from version 1 is `requirements-triage` in the helpers. The triage agent has `tools: Read, Glob, Grep`, so it is read-only.
- Merge `occupied` against `placed`: `readUpfront` validates ids with `isChangeId` and every field type, and drops entries that are not whole. `placed`, main's shape, keeps its own reader and its `machine` string check. A remote-placed change gets no ticket, so its session starts with the typed form. That cannot widen access, because the entry gate only applies to the `devkit-session` skill, and a missing ticket refuses rather than allows. `forgotten()` only keeps records when the claims could not be read, which is fail-safe.
- Process kill of waits, the skill guard split, `withoutLeadingNotes` and `startedTaskOf`, `pruneRecords`, adrClash, and the git calls through `gitIn` and `pushCmd`: judged in round 2 and not changed in a way that matters. They use argument arrays with no shell, validated ids, a ps check before any kill, and fail-closed handling.
- Ticket comparison and `mintTicket`: tickets come from randomBytes in 16 hex digits. The comparison is not constant-time, but the ticket is a local, one-use workflow token that gates no data.
- Secret and config: no secret-looking files or credentials added, and no fail-open default. `DEVKIT_HOOK_LOG` is opt-in logging of decisions, with no secrets in it.

Out of round: nothing found.

Verdict basis: after the false-positive filter there are zero exploitable true positives. The one open item is the F1 nit. I ran no tests; the whole-suite log for 5cc1c69 shows 0 failures and no finding depended on a run.
