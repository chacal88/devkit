Verdict: approved
Commit: 4955dcf7d55dd2206b54ce7c6f0ebeb940343195

## ADR review — review-workflow (round 1)

ADRs reviewed: 0001 (`docs/adr/0001-coordination-without-a-harness.md`), 0002 (`docs/adr/0002-merge-without-the-owner-opt-in.md`), 0003 (`docs/adr/0003-auto-merge-the-archive-pr.md`), 0004 (`docs/adr/0004-devkit-per-project.md`), 0006 (`docs/adr/0006-phases-as-child-sessions.md`), 0007 (`docs/adr/0007-one-change-on-request.md`), 0008 (`docs/adr/0008-reviews-as-a-workflow.md`, new). 0005 skipped (superseded by 0006).

Checked:
- Scope of 0008 matches requirements.md AC-7: reviewer round only (Decision 1, last sentence), inside the session (Decision 2), no state outside repo and GitHub (Decision 3, script is a pack file passed by path), gates unchanged (Decision 4). Review trigger and alternatives present; test at `plugins/openspec/hooks/guard.test.mjs:1314` pins the ADR's sections, 0001's pointer and the config entry.
- ADR 0001 Note points to 0008 (`docs/adr/0001-coordination-without-a-harness.md:39-41`); `openspec/config.yaml:22` lists it.
- One writer per gate file: `review-round.workflow.js:291,312,324` use `devkit-core:<reviewer>` for stage 1 and write, and `finding-verifier` (read-only tools, no write, `plugins/core/agents/finding-verifier.md`) for votes. `review.md` stays with the session (`plugins/core/skills/review-change/SKILL.md`, Never list). Guard and delivery contract untouched (guard.mjs not in diff; deliver-check only changes the next step for an approved review with an undisposed finding, `deliver-check.mjs:995-1008`, which is stricter, not looser).
- Approved reviews before the PR: unchanged; `fix-review` now also fires for approved-with-open-finding.
- ADR 0003 archive exemption: no archive path touched.
- ADR 0006/0007: `conduct/SKILL.md:104` and `ship-change/SKILL.md:41` keep the Workflow call to the typed turn, with the `agents` path on continuations, matching 0008 Decision 5. No session started, nothing scheduled in the script (no matches for schedule/cron/session/file writes in `review-round.workflow.js`).
- Workflow tool used for no step other than the round (`SKILL.md` Never list).

### Findings
- [nit] `docs/adr/0001-coordination-without-a-harness.md:39-41` — the Note's new sentence is hard-wrapped short ("which amends it. Running the reviewer round as one" then a short line); reflow to the file's usual width. Cosmetic.
- [nit] `docs/adr/0008-reviews-as-a-workflow.md` Review trigger — consider also naming 0001's own trigger (automation starting sessions) as a cross-reference; not required.

### Summary
- 2 findings (0 blocking, 0 important, 2 nit)
