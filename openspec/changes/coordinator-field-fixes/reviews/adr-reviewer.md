Verdict: approved
Commit: 403b38c5370d0279c75d0c2ad20824c72570e014

## ADR review — coordinator-field-fixes

### Findings
- [nit] docs/adr/0002-merge-without-the-owner-opt-in.md:1-5, docs/adr/0003-auto-merge-the-archive-pr.md:1-5, docs/adr/0004-devkit-per-project.md:1-5 — The three amended ADRs record ADR 0012 only as a Context Note. ADR 0010 carries an 'Amended by ADR 0011' header line for the same case, so cite ADR 0012 in the headers too.
- [nit] docs/adr/0003-auto-merge-the-archive-pr.md:9 (Note), docs/adr/0012-the-reviews-check-follows-the-change-script.md — The 'delivered means own PR merged and every task ticked' rule (defect 4) narrows when the archive starts. It lives only in a Note on ADR 0003 and in design D-4, and ADR 0012 does not decide it. It narrows ADR 0003's intent without contradicting it, so no superseder is needed. Say in ADR 0012 or in the Note that it is a refinement of the trigger.
- [nit] plugins/openspec/skills/openspec-setup/scripts/changes-under-way.mjs:84-110, plugins/openspec/skills/openspec-setup/SKILL.md step 4 — --apply writes approval.md as 'not applicable' for a started devkit change, grandfathering it past the owner's plan-approval stage. ADR 0002 and ADR 0010 decision 6 keep that approval a human gate. The owner's own words are recorded, the file is never an approval and nothing is overwritten, so this is not a violation. Cite ADR 0002 and ADR 0010 decision 6 in design D-7 so it reads as an acknowledged waiver.

Verdict: approved
Commit: 403b38c5370d0279c75d0c2ad20824c72570e014

ADRs reviewed: ADR 0002 (`docs/adr/0002-merge-without-the-owner-opt-in.md`), ADR 0003 (`docs/adr/0003-auto-merge-the-archive-pr.md`), ADR 0004 (`docs/adr/0004-devkit-per-project.md`), ADR 0007 (`docs/adr/0007-one-change-on-request.md`, superseded; the superseder ADR 0010 was followed), ADR 0008 (`docs/adr/0008-reviews-as-a-workflow.md`), ADR 0010 (`docs/adr/0010-openspec-as-the-harness.md`), ADR 0011 (`docs/adr/0011-the-change-coordinator-is-the-owners-session.md`), and ADR 0012 (`docs/adr/0012-the-reviews-check-follows-the-change-script.md`, added by this change).

There is no ADR index file. I used `openspec/config.yaml` and the ADR headers instead.

### Conformance
- **ADR 0012 decisions 1 to 3 (CI check by script):** `deliver-check.mjs` implements them. `isDevkitScript` uses the same two names as the hook opt-in (`DEVKIT_SCHEMAS`). A change on another schema passes with a note. A multi-change PR gets one result per delivered devkit change. An archive PR is judged per folder by its own `.openspec.yaml`, and a missing `retro.md` fails with an explaining message.
- **ADR 0012 decision 4:** The diff does not add a read of `ship` or `merge_method` to the CI path. It adds no `DEVKIT_BYPASS` handling to the CI path. The check still does not depend on the opt-in.
- **Process rules in `openspec/config.yaml`:** The decision that amends ADRs 0002 to 0004 is a new accepted ADR, not a silent deviation. The owner approved it by name in `openspec/changes/coordinator-field-fixes/approval.md`. The config ADR list was updated. ADR 0012's Alternatives table answers ADR 0004's rejection of the per-change schema as a marker.
- **ADR 0004 (opt-in):** The new session CLI refusal in `guard.mjs` sits behind `optedIn(root)`, so nothing speaks in a project that has not opted in.
- **ADR 0011 and ADR 0010 (fail-open, state in repo and GitHub):** `archivedOnDefault` fails soft when GitHub or git cannot be read. The install-kit manifest and the changes-under-way output live in the repo. The approval.md write goes through the main session's Bash call, the only writer `guard.mjs#writeViolation` allows, as design D-7 states.
- **Open decisions:** none touched.

### Summary
- 3 findings (0 blocking, 0 important, 3 nit)
