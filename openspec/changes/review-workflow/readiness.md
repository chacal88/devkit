# Readiness review: review-workflow (round 2)

## Decision

- Status: APPROVED

Blockers: 0. The three round-1 blockers are closed in the artifacts. An implementer can build every task
without asking a question, and every acceptance criterion has a task and a way to be verified.

## Verification performed

- `openspec validate review-workflow --strict`: valid (info only: skip_specs).
- Bundled `claude plugin validate .` (2.1.317) and `python3 scripts/check.py`: reported green by the caller.
  The 9-minute suite was not re-run, as instructed.
- Code claims re-checked in this round: `deliver-check.mjs` `findingsItem` 338, `nextStep` 957, `rejectedNow`
  991, the `fix-review` block 995-999, `toReview` 1001; `guard.test.mjs` ADR 0006 test at 1285; ADRs end at
  0007; `review-change/` holds only `SKILL.md`, so the scripts are new, as planned. The round-1 checks of
  `guard.mjs`, row 8 and 9 tests, the pin lines, `setPins`, `af4055a` and the versions still stand (the
  tree outside the change folder is unchanged: only `openspec/roadmap.md` is modified).

## Round-1 blockers

1. Fallbacks for an accepted call with a bad result or no notice: closed. `design.md` D6 table has the
   `Workflow result invalid` row (whole round on `agents`) and the `Workflow lost: no completion notice` row
   (busy mark dropped, `agents` path), plus the paragraph for a session that cannot see the task state (the
   owner's word ends the round). `tasks.md` 2.2 carries both and tests the strings; 2.3 tests the
   `declares the round lost` / `declared lost` text in the caller rows.
2. ACs that nothing could show: closed. AC-1 to AC-3 in `proposal.md` and `requirements.md` are worded as
   harness plus `agents`-path proof plus fallback; the live half moves to the dogfood list, and the proposal
   Exit criteria say what `evidence.md` cites. Judged as written; the owner's confirmation of the rewording
   is pending at plan approval, as the caller said.
3. Result convention left to the implementer: closed. `tasks.md` 1.2 fixes top-level `return` and
   `meta.phases` as a list of names for this change, and says that a different live form is a dogfood
   finding. The D6 result check is the run-time guard.

Round-1 "other findings" also landed: the static test uses `\bprocess\.` and `\bfs\.`, and task ids are now
contiguous (1.1-1.5, 2.1-2.8).

## Scope

correct. Non-goals are tight; the Workflow tool is confined to the reviewer round.

## Blockers (Mandatory before implementation)

None.

## Other findings

- Low, fix during implementation. Task 1.1's static test forbids `import ` as a substring; a prompt that
  happens to contain the word "import" followed by a space would fail it. Use `/\bimport\s/` only on
  statement starts, or keep prompts free of that word.
- Low, nice to have. The verifier keeps `Bash` and has no `Write`/`Edit`; the design names the guard
  follow-up. No change needed.

## Omissions check

Validation, errors, idempotency (D4, D6, D15), rollback and migration (Migration Plan), observability
(`review.md` Path, counts, Notes), compatibility (`readReviewMd` and old files pinned by tests in 1.4), test
strategy (red-first per task, the 9-minute suite only at gates): all defined. Every unverifiable Workflow
fact has a fallback or an assigned dogfood item (D16, the facts table, Workflow follow-up).

## Mandatory questions

1. Problem defined: yes. 2. Measurable: yes, with the live half explicitly assigned to the next change's
dogfood. 3. Error behaviours: yes (D6 table). 4. Edge cases: yes. 5. Dependencies: clear.
6. Contracts: yes (D4, D15). 7. Two developers differ: no remaining point. 8. Implicit decisions: none found.
9. Tasks deliver the outcome: yes. 10. Discovered too late: the live Workflow facts, named and assigned.

## Top production failures

1. Result convention wrong live: caught by the D6 result check, round re-runs on `agents`.
2. Notice lost: lost-round row, owner's way out.
3. Guard does not see `agent_type` for Workflow writers: `written: false` or `check-file` mismatch, then `agents` rerun.
4. A majority of same-model verifiers drops a real finding: evidence required, line stays visible.
5. A writer alters a finding line: `check-file` checks lines 1-2 and every blocking/important line.

## Next

Plan approval by the owner (including the AC rewording), then implementation.
