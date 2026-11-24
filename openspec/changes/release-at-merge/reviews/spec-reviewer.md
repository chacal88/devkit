Verdict: rejected
Commit: 4a6e858761c181c549b412025dae02aff354a646

## Spec review — release-at-merge

### Findings
- [important] plugins/openspec/hooks/deliver-check.mjs:13-18 (CITATION_PATHSPEC, holdsCitations); plugins/openspec/hooks/release-merge.mjs numberRelease (git grep over CITATION_PATHSPEC) — Partial: change-delivery 'An unnumbered ADR is numbered at the delivery' (and ADR 0031 decision 3, design D-4) says citations are rewritten in every tracked text file outside openspec/changes/; the code only rewrites, and only checks for leftovers in, .md/.yaml/.yml files, so an ADR [<slug>] in any other tracked text file is left unrewritten and nothing reports it. This narrowing (evidence defect 4, 620c047) is not listed among the plan deviations and is not in the spec. Extend the spec text or widen the code.
- [important] openspec/specs/change-coordination/spec.md:203-244 vs openspec/changes/release-at-merge/specs/change-delivery/spec.md (With no train the release is assigned by one step before the merge) — Two specs disagree: canonical change-coordination 'From the implementation on, the step inside the stage goes to its role', scenarios 'A conflict in any other file' (run ends blocked) and 'GitHub reports a conflict the base merges cleanly' (update-branch), still hold for every change, while the delta's 'The pull request in conflict with the base' scenario and the ADDED conductor requirement answer assign-release for a noted change. No MODIFIED block scopes those scenarios to changes with no note; the owner decides which is authoritative.
- [important] evidence.md 'Open item for the owner'; plugins/core/skills/plan-readiness-review/SKILL.md (The release note paragraph); proof/agents-run.md S-6 — Known open gap: the readiness finding this change adds for a missing or unreadable release.md can only be cleared by editing release.md, which is not in the readiness stage's staleAfter, so readiness is never run again and the loop re-hands the planner the same revision brief until the run ends with no progress. No requirement covers this path (change-coordination 'The planner does not stop without the release note' names readiness as a later check). A fix needs flow.json, which the proposal rules out (no new flow version), so the owner decides.
- [important] scripts/check.py check_adrs/on_base (design D-12) — AC-6's check.py rules (an unnumbered ADR refused on the base, two records with one slug) have no requirement in any spec delta, and the rule that refuses an unnumbered record no active change's decisions.md lists comes only from design D-12, not from requirements.md or the proposal's AC-6. Write the rules into a spec delta, or drop the extra rule.
- [nit] plugins/openspec/hooks/deliver-check.mjs releaseOnlyEdit (its 'former number' branch); specs/change-delivery 'A plain commit on the branch keeps its rule' — The MODIFIED requirement lists 'an unnumbered ADR renamed to its number' as a release edit, but the implementation (evidence defect 2, 49a8884) also spares an own ADR re-numbered by a re-run of the step (0031 to 0032 after the base took the number). The behaviour fits AC-4, but the spec text does not name it.
- [nit] openspec/specs/delivery-train/spec.md:144 'Release numbers follow the boarding order on the train only' — The canonical requirement ('renumber the release files the joined head bumped') is not modified to cover only heads with no note; the ADDED 'A join numbers the release a boarded change's note states' covers noted heads, so the two read side by side with no scope line between them.
- [nit] plugins/openspec/hooks/release-merge.mjs main (--assign with no devkit.release_tag) — --assign in a project with no devkit.release_tag exits 2 (the deviation evidence.md lists); no requirement specifies it and the script's header reserves exit 3 for setup errors. AC-9 holds because the checker never hands assign-release there.

In-scope specs: openspec/changes/release-at-merge/specs/change-delivery/spec.md, openspec/changes/release-at-merge/specs/change-coordination/spec.md, openspec/changes/release-at-merge/specs/delivery-train/spec.md, openspec/changes/release-at-merge/specs/reviews-check/spec.md; canonical openspec/specs/change-delivery/spec.md, openspec/specs/change-coordination/spec.md, openspec/specs/delivery-train/spec.md, openspec/specs/reviews-check/spec.md, openspec/specs/release-tags/spec.md (AC-13, tag rule unchanged); decisions: docs/adr/0031-release-at-merge.md (amends 0022 and 0025; builds on 0003, 0019, 0027, 0030), docs/adr/0022-*.md, docs/adr/0025-*.md.

### Coverage
| Requirement | Status |
|-------------|--------|
| change-delivery: A change states its release in a note when its project names a release file | covered |
| change-delivery: A malformed release note is refused naming the field | covered |
| change-delivery: A change with a release note leaves the release lines as the base has them | covered |
| change-delivery: The release is never judged without the base | covered |
| change-delivery: A change with neither a note nor a bump of its own is refused | covered |
| change-delivery: The plan approval covers the release note | covered |
| change-delivery: With no train the release is assigned by one step before the merge | covered (conflicts with canonical change-coordination scenarios, F2) |
| change-delivery: The release step merges the base and commits only release lines | covered |
| change-delivery: An unnumbered ADR is numbered at the delivery | partial (F1) |
| change-delivery: The numbering refuses a slug taken and a citation not landed | covered |
| change-delivery: A consumer project's release file follows the note | covered |
| change-delivery: A release bump on a pack's own manifest is stated under packs | covered |
| change-delivery (MODIFIED): An ADR number taken on the default branch is renumbered without the owner | covered |
| change-delivery (MODIFIED): A plain commit on the branch keeps its rule | covered (F5) |
| change-coordination: The release assignment is a session step of the delivery | covered |
| change-coordination: The conductor numbers a noted change only through the release step | covered |
| change-coordination: The planner does not stop without the release note | covered (the readiness path after it, F3) |
| change-coordination: A decision record listed without a number is found after its numbering | covered |
| change-coordination (MODIFIED): A requirement a merged change contradicts reopens the grill | covered (planner text) |
| delivery-train: A join numbers the release a boarded change's note states | covered (F6) |
| reviews-check (MODIFIED): The train's own commits change only releases, the roadmap and its record | covered |
| release-tags (AC-13, unchanged) | covered |
| requirements AC-6 (check.py) | implemented, no spec requirement (F4) |

### What I checked in evidence.md
- Defects found and fixed: 1 (changelog body citing an ADR), 3 (what a pack is), 5 (the merge with jira-entry-followups) and 6 (stale .compozy copies, reinstalled in 3356036) stay within the spec. Defect 2's fix extends what the MODIFIED requirement's text names (F5). Defect 4's fix narrows what the ADDED numbering requirement says (F1).
- Deviation 'manifests versioned on the merged text': matches the requirement 'The release step merges the base and commits only release lines'. numberRelease writes resolveManifest over the merged working-tree text, so the branch's edits beyond the version stay and only version fields change. The difference is with design D-6's wording only, so there is no finding.
- Deviation '--assign with no devkit.release_tag exits 2': F7.
- Deviation '.compozy/kit-manifest.json pack field': no requirement lists it as a release line, and the step does not read or write it. It holds informational data the kit installer writes. Accepted, no finding.
- Open gap (readiness not re-run when only release.md changes): F3. It is a real flow defect that the change's own readiness rule introduces. Fixing it needs a flow.json change, which the proposal rules out, so it goes to the owner.

### Spot checks against the code
- N1 to N4 and N7 sit right after the commit row, once every task is ticked; N5 replaces update-branch and the conflict stop; N6 comes before ready-base, ready, wait-merge and enable-auto-merge; none applies in a train project (deliver-check.mjs nextStep).
- A1 asks for the approval again whether or not a task is ticked; the approval object keeps its four keys with no note (approvalState).
- The planner stop hook sits inside subagentStopFor's delivered branch, with the key release-note/<missing|malformed>@<fingerprint> (change-loop.mjs).
- conduct-check: assign-release is a main-session step; a noted change gets no releaseConflict, and adrClash leaves out the ADRs its decisions.md lists unnumbered.
- The canonical MODIFIED blocks are carried over word for word, with their scenarios, plus the additions.
- Test run: TMPDIR=/var/tmp/devkit-release-at-merge node scripts/test-suite.mjs plugins/openspec/hooks/release-note.test.mjs printed 'suite: 1 files, 81 tests, 81 pass, 0 fail'; gen-agents.mjs --check printed '21 CompozyOS agents are up to date'.

### Summary
- 7 findings (0 blocking, 4 important, 3 nit; 0 scope creep, 1 partial gap F1, 1 spec conflict to escalate F2, 1 flow gap for the owner F3, 1 missing spec for implemented behaviour F4).
