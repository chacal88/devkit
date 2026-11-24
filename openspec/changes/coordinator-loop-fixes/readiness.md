<!-- devkit-stage readiness result=failed attempt=6 commit=41c69c531de322618b1f176a92f902c13157f379 -->
# Readiness review: coordinator-loop-fixes

Reviewed at HEAD 41c69c5 (clean tree). Two commits came after attempt 5 (92b2d01): 6e683aa drafts the change's
settings ADR (`docs/adr/0033-a-changes-own-settings-live-in-an-x-devkit-block.md`, proposed) and 41c69c5 revises
`proposal.md`, `design.md`, `tasks.md` and `decisions.md`. The spec deltas did not change. I read the diff of
both commits in full, the new ADR, ADR 0023, `approval.md`, `.openspec.yaml`, and `openspec/config.yaml` again
for rules added since attempt 5 (none). I re-derived every claim the revision depends on from the code. Parts
not touched since attempt 5 carry that report's verification (sections 4 to 6 of attempt 5) and were not
re-derived here.

Checks run at HEAD: `openspec validate coordinator-loop-fixes --strict` and `... --type change --strict
--no-interactive` pass; `python3 scripts/check.py` passes; `python3 scripts/gen-catalog.py --check` exits 0;
`gen-agents.mjs --check` exits 0 (21 agents); `claude plugin validate .` passes. I ran the parts of the checks
and gates that the revision changed on the base, with `TMPDIR=/var/tmp/devkit-coordinator-loop-fixes` and
`--concurrency=2`, while other work shared the machine (load 5.7 to 6.1). Each was run as written, minus the file
`change-loop-declared.test.mjs` that task 1.1 creates:
- the whole second part of gate 1.6: 233 tests across 7 files, green;
- the check of 3.7: 7 tests, green;
- the additions of 4.4, 4.5, 4.7, 5.5 and 5.9 (`^project-settings: PACKS equals`, `^upfront AC-8 skill`,
  `^change-loop settings: shipConfig`): one test each, green.

Each new `--test-name-pattern` matches tests in the files it is given (`^roadmap-loop repl` 3,
`^followups AC-4 reply` 1, `^jira-entry-followups AC-8` 5, `^upfront AC-8 skill` 1, `^delivery-train P3
delivered` 6, `^change-loop settings: shipConfig` 1, `^project-settings: PACKS equals` 1). Every D-15 title the
revision adds exists word for word at HEAD. No gate is red on the base.

## 1. Decision
- Status: NEEDS-REVISION
- Confidence: high
- Ready to implement: no

Both mandatory findings of attempt 5 are fixed:
- D-22 now has its own record, the change's settings ADR. Its Amends line names ADR 0023 decision 1, and
  `decisions.md`, D-22, D-12, "Decisions and ADRs", 4.6, 5.6 and 6.1 all carry it.
- The reply tests and the `findChangePr` tests are now D-15 rows. They are named in 1.2, 1.4 and 3.7 and run by
  gates 1.6 and 3.9.

Every optional item of attempt 5 is also taken: the 6.1 re-check, the literal ADR number, "makes no assertion
on the tick", the `PACKS` and `shipConfig` tests, and a shorter proposal.

One narrow mandatory finding remains (section 9). D-22 places ADR 0023's new Note "after its stage-models
Note", which sits inside ADR 0023's `## Decision` section. Yet D-22, the settings ADR's decision 5 and T139 all
say that section is untouched, and T139 compares it with a text held in the test. As written, T139 either fails
or needs a design choice the plan forbids the implementer to make.

Because this file changes, the readiness hash changes too, and the owner's recorded approval (`approval.md`,
`sha256:6dff42735a92`) is stale. D-7 already says so: the revised plan goes back to the owner.

## 2. Scope validation
Classification: correct

The revision adds no behaviour. The settings ADR records the decision D-22 already made: the same five points,
the same four alternatives. The scope stays the kept items and field findings 25 to 28 of `requirements.md`.

## 3. Proposal review
- "What Changes" is now one line per item, each pointing to its D-section. AC-11 and AC-13 point to D-10 and D-5
  for their reading. The decision records and dependencies name the settings ADR and its acceptance at the
  owner's next approval.
- `proposal.md` is 2,471 words (3,062 at attempt 5). That is still over `rules.proposal`'s "under two pages"
  (Low, section 10).

## 4. Design review
Re-derived at HEAD:
- D-7 "This plan's own approval and its records": `acceptDecisions` (`change-loop.mjs`) rewrites only the
  records whose status is `proposed`, and returns the accepted ones under `already`. `decisionRecords` reads
  every `- ADR:` line of `decisions.md`, so both records are listed. `next` offers `accept-decisions` when
  the approval is current and a listed record is still `proposed`. `approval.md` holds no `- Plan:` line.
  So the change's ADR keeps its `Accepted by:` line, and the settings ADR is accepted after the next approval,
  as written.
- "How this plan names things", 4.6 and 6.1 assume `renumber-adr` handles both records. `adrClash`
  (`conduct-check.mjs`) collects every ADR file the branch added whose number the base holds, and renumbers each
  one in number order. Both records are covered.
- The settings ADR has the project's sections. It is `Status: proposed`, its Amends line quotes ADR 0023
  decision 1, and the decisions it relies on (ADR 0010 decision 1, ADR 0023 decisions 1 and 6) exist with
  that content.
- No literal ADR number is left in `design.md`, `tasks.md`, `proposal.md` or the deltas. Only `decisions.md`
  carries the paths, as the plan's naming rule allows.

Failed re-derivation: in ADR 0023, `## Decision` runs from its heading to `## Consequences`. The numbered
decisions 1 to 7 and the `Note (stage-models, 2026-11-23)` both sit inside that span. A Note placed "after its
stage-models Note" is therefore inside the section that D-22 says "is not touched" (finding 1). ADR 0011 does not
have this problem: its Notes, and the Note D-12 adds, are in `## Context`.

## 5. Specs review
No findings. The deltas did not change since attempt 5, and the strict validation passes.

## 6. Tasks review
- The fixes of attempt 5 are in place: 1.2, 1.4 and 3.7 run their D-15 tests by name with runnable commands,
  and gates 1.6, 3.9, 4.7 and 5.9 carry the new patterns and files (all green on the base, see the header).
- 4.6 adds one ADR-list entry for each record, and 5.6 words the Note with a relative link. 6.1 renumbers either
  record and repeats 3.6a's `grep -c`, stopping on a requirement that reached the main spec since.
- T139 is the task check that finding 1 makes ambiguous.

## 7. Omission detection
No new findings. The settings ADR is accepted by the loop's existing step, and a renumbering is handled by
`renumber-adr`.

## 8. Execution risks (top 5 failures)
1. Cause: T139 compares ADR 0023's `## Decision` section with a held text while 5.6 adds a Note inside that
   section. Impact: phase 5's gate goes red, or two implementers slice the section differently and one of them
   pins the new Note as "untouched". Prevention: finding 1.
2. Cause: `post-merge-validate` archives between phase 3 and this change's last merge. Impact: the main spec
   would keep a scenario the code no longer meets. Prevention: as planned (6.1's re-check, D-7).
3. Cause: `deliver-check.test.mjs` takes most of the new checker tests, and attempt 5 measured 235 s and 363 s
   for it on the loaded base. Impact: it crosses CONTRIBUTING's 300 s mid-change. Prevention: as planned (D-16
   split rule).
4. Cause: a sibling takes 0033 or the change's ADR's number before the last merge. Impact: stale links in the
   Notes of ADR 0011 and ADR 0023 and in the config list. Prevention: as planned (`renumber-adr` covers both;
   T78 and T139 read the number through `decisions.md`).
5. Cause: the stage walk's ceiling and the delivery checker's limit drift apart. Impact: an authorized round is
   refused by one of them. Prevention: as planned (`authorizedRounds`, `ceilingOf`, T105 to T113, T132).

## 9. Mandatory fixes before implementation
- [ ] Medium — `design.md` D-22 (the ADR 0023 bullet: "a dated Note after its stage-models Note ... Its
  `## Decision` section is not touched") and D-16 T139 ("its `## Decision` section equals the text held in the
  test"); `tasks.md` 5.6 ("its `## Decision` untouched").
  - The problem: in `docs/adr/0023-the-model-is-chosen-by-stage.md`, the stage-models Note sits between
    decision 7 and `## Consequences`, so the new Note lands inside `## Decision`. This repository's tests slice
    an ADR's Decision section from `## Decision` to `## Consequences` (`roadmap-loop-followups.test.mjs`, the
    `adr.slice(adr.indexOf('## Decision'), adr.indexOf('## Consequences'))` line;
    `roadmap-loop-upfront.test.mjs`, `sectionOf(adr, '## Decision', '## Consequences')`).
  - Why it matters: by that convention T139 fails once 5.6 runs. The implementer has to choose where the held
    text ends, which the tasks preamble says they never do. If they choose wrong, the new Note gets pinned as
    "untouched" text.
  - Smallest correction, in D-22, T139 and 5.6:
    - say that the Note is appended to ADR 0023's `## Decision` section, right after the stage-models Note and
      before `## Consequences`;
    - say that T139 holds the section's text as it is on the base (decisions 1 to 7 and the stage-models Note)
      and asserts that this text is unchanged and immediately followed by the new Note.

    This keeps the settings ADR's decision 5 ("its `## Decision` section untouched") true in the sense "its
    text unchanged" and needs no ADR edit. Alternatively, place the Note elsewhere and name the place.

## 10. Optional improvements (within scope)
- [ ] Low — `proposal.md`: 2,471 words against `rules.proposal`'s "Keep it under two pages". The ACs (about 1,400
  words) could drop the readings they already defer to the design.
- [ ] Low — `decisions.md` says 0033 "was the next free number across the remote branches when it was drafted".
  I could not check this here (no fetch), and nothing depends on it, because `renumber-adr` handles a clash.

## 11. Explicitly out of scope
- [ ] A plan revised after the approval in `ship-change` used without the loop, beyond the sentence D-7 adds.
- [ ] `decisions.md` and `mockup.md` edited after the start are not in the digest.
- [ ] The roadmap coordinator's third review round in session-per-change mode (a design Non-Goal).
- [ ] The `fresh-base-check` half of item 21 and every "Dropped" item.
- [ ] Whether the desktop app's monitor wakes the session on green checks (AC-11's deferred half,
  `host-monitor-wake`).
- [ ] The CompozyOS driver's red-gate question and two-round review loop (Non-Goals, D-19).
- [ ] `resolve-base-conflict` in a project with the delivery train (D-5).

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes. Four retros and four field findings, each kept item anchored to code.
2. Is the result measurable? Yes. T1 to T141 and the real runs of D-14.
3. Are error behaviors defined? Yes. Exit codes, the refusals in both languages, the record reader's errors,
   the guard's refusals.
4. Are edge cases covered? Yes. This includes both drivers, both archive orders of the siblings, the `devkit:`
   fallback, both blocks in one file, and either ADR renumbered.
5. Are dependencies clear? Yes. The siblings (D-17), the two records and the approval that accepts each one
   (D-7).
6. Are contracts defined? Yes. Every exported name of attempt 5 is unchanged, and `decisions.md` lists two
   records.
7. Can two developers interpret this differently? Yes, on where T139's held Decision text ends (finding 1).
8. Are any decisions implicit instead of written? Only the boundary of finding 1.
9. Do the tasks fully deliver the intended outcome? Yes, once T139 is defined.
10. What will be discovered too late if implementation starts now? A red T139, or a T139 that pins the new Note,
    at phase 5's gate.

## 13. Final conclusion
- Can we start? No. One mandatory correction remains; it is narrow and does not change scope.
- What must be fixed? Section 9: define where ADR 0023's new Note goes and what T139 holds. Then run readiness
  again, and the owner approves the revised plan, which also accepts the change's settings ADR (D-7).
- Main risk if ignored? Phase 5's gate goes red on T139, or T139 pins the Note it was meant to leave out.
