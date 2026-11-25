Verdict: rejected
Commit: 73e159c2acfac2959d8f6f84b099c538b0eafc54

## ADR review — coordinator-loop-fixes

### Findings
- [important] docs/adr/0032-the-loop-declares-the-decisions-outside-the-stage-gates.md:55-74 (Decision 3, 4, 5, 7); docs/compozy-kit.md:124-128 — ADR 0032 decisions 3, 4, 5 and 7 apply to every run, but the approved plan narrows them: CompozyOS has no declare step, so it keeps asking the owner at a red gate and stops review at 2 rounds; an archive that left a delivery train keeps its blocked stop-archive on a conflict outside the release files; and approvals without a '- Plan:' line never go stale. None of these limits is recorded in ADR 0032 or ADR 0024, although docs/compozy-kit.md:124 says ADR 0024 lists each limit.
- [nit] docs/adr/0032-the-loop-declares-the-decisions-outside-the-stage-gates.md:12 (Amends line) — ADR 0032 says it amends no accepted record, yet decision 3 raises the review stage's attempt ceiling from a record outside configuration (declared.json). That changes ADR 0010 decision 3's rule that attempt ceilings live in configuration. Name that sentence in the Amends line, or say why it is not an amendment.
- [nit] docs/adr/0023-the-model-is-chosen-by-stage.md:3-8 (header) — ADR 0033 amends ADR 0023 decision 1, but ADR 0023's header has no '- Amended by ADR 0033 (...)' line. Every other amended record (0002, 0003, 0010, 0011, 0014, 0015, 0017, 0018, 0027) has one; only the dated Note was added here.
- [praise] plugins/openspec/hooks/guard.mjs (runOf, classify, declareViolation); plugins/openspec/hooks/change-loop.mjs (DECLARED, changeDevkitBlock readers) — The new pieces stay inside the existing decisions. The stop-lock tightening and the declare and declared.json rules only veto (ADR 0010 decision 5). The pause and decision ends use the existing waiting-for-owner state (ADR 0010 decision 3) and are derived where every other state is (ADR 0017). The x-devkit change keeps reading the old devkit: block, as ADR 0033 decision 3 requires.

ADRs reviewed:
- ADR 0010 (`docs/adr/0010-openspec-as-the-harness.md`)
- ADR 0011 (`docs/adr/0011-the-change-coordinator-is-the-owners-session.md`)
- ADR 0012 (`docs/adr/0012-the-reviews-check-follows-the-change-script.md`)
- ADR 0014 (`docs/adr/0014-each-roadmap-change-runs-in-a-session-of-its-own.md`)
- ADR 0016 (`docs/adr/0016-stage-roles-write-their-own-files.md`)
- ADR 0017 (`docs/adr/0017-a-change-state-is-derived-in-one-place.md`)
- ADR 0021 (`docs/adr/0021-a-roadmap-run-opens-every-change-at-its-start.md`)
- ADR 0022 (`docs/adr/0022-reviewed-changes-leave-on-a-delivery-train.md`)
- ADR 0023 (`docs/adr/0023-the-model-is-chosen-by-stage.md`)
- ADR 0024 (`docs/adr/0024-compozy-runs-the-short-loop.md`)
- ADR 0025 (`docs/adr/0025-a-base-merge-stales-only-on-the-changes-own-files.md`)
- ADR 0026 (`docs/adr/0026-the-devkit-test-suite-runs-by-file-in-parallel.md`)
- ADR 0030 (`docs/adr/0030-the-pin-test-reads-the-manifest-so-only-the-flow-page-pins-pass-unnamed.md`)
- ADR 0032 (`docs/adr/0032-the-loop-declares-the-decisions-outside-the-stage-gates.md`)
- ADR 0033 (`docs/adr/0033-a-changes-own-settings-live-in-an-x-devkit-block.md`)

Scope: I read in full every ADR whose subject the diff touches. I left out the superseded or retired ADRs (0001, 0005, 0006, 0007) and those whose subject the diff does not touch (0002-0004, 0008, 0009, 0013, 0015, 0018-0020, 0027-0029); a grep of all ADRs for round limits found nothing in them that the diff changes. The docs/adr/ folder has no index file and the project keeps no open-decisions log. I ran no tests: other reviewers of this round were already running filtered tests in this worktree, and checking against the ADRs needed only the diff and the plan.

Conforms:
- Stop lock and end marker match ADR 0032 decision 2. The hooks still veto and never drive (ADR 0010 decision 5).
- The pause and decision ends use the waiting-for-owner state. No fifth state is added (ADR 0010 decision 3), and the state is derived in `changeState` (ADR 0017 decision 1).
- `declared.json` is a file in the change folder, so it is an input ADR 0017 already allows. Only the main session writes it, the same way as `approval.md` (ADR 0010 decision 5, one writer per gate file).
- The verifier's `proof/` folder is inside `openspec/`, so it is not product code under ADR 0016 decision 2.
- The conductor task lifts no lock (ADR 0011 decision 2).
- The review-round authorization comes from the owner's own typed message, in the change's own session (ADR 0021 decision 3).
- The CompozyOS `record-approval` writes the `- Plan:` line from a script; no CompozyOS tool writes `approval.md` (ADR 0024 decision 4).
- The reads of `x-devkit:` and the old `devkit:` block match ADR 0033 decisions 1-4. The project's `devkit:` block is untouched.
- No new test pins a release version (ADR 0030), and the rewritten roadmap tests follow the new `Live roadmap:` rule.
- Every plan revision after the start was re-approved by the owner (approval.md history: ec0383c, f399c82, 9492c53, 84da214), as ADR 0032 decision 7 intends.
- Commit subjects are conventional (docs/conventions.md), apart from merge commits.

### Finding details
- F1 [important], ADR 0032 decisions 3, 4, 5, 7 and `docs/compozy-kit.md`:124-128
  - What is wrong: The ADR's decisions read as applying to every run. The approved plan (design D-5, D-7, D-19, Non-Goals; proposal AC-7, AC-10, AC-13, AC-16) carves out:
    - the CompozyOS driver, which has no `declare` step;
    - an archive that left a delivery train, which keeps its blocked `stop-archive`;
    - approvals written without a `- Plan:` line, which never go stale.
    So the ADR's review triggers (for example "a plan edited after the start goes to delivery without a new approval") fire in those cases. ADR 0024's list of accepted CompozyOS limits doesn't include these three either, although `docs/compozy-kit.md` says it lists each one.
  - Fix: Add the scope to ADR 0032 in the same change, as a sentence per decision or a Consequences bullet that lists the CompozyOS limits the way ADR 0024 does, and point `docs/compozy-kit.md` at it.
- F2 [nit], ADR 0032 Amends line
  - What is wrong: Decision 3 adds owner-authorized rounds, from `declared.json`, to the `review` stage's `flow.json` ceiling. That is a sentence of ADR 0010 decision 3 ("attempt ceilings live in configuration"), but the Amends line says "no accepted record".
  - Fix: Name ADR 0010 decision 3's ceiling sentence in the Amends line and add the matching "Amended by" line, or add one sentence to ADR 0032 saying why the base ceiling staying in `flow.json` keeps it from being an amendment.
- F3 [nit], ADR 0023 header
  - What is wrong: ADR 0033 amends ADR 0023 decision 1, but ADR 0023's header has no `- Amended by ADR 0033 (0033-a-changes-own-settings-live-in-an-x-devkit-block.md)` line, which every other amended record has.
  - Fix: Add that header line beside the existing Note.

### Summary
- 4 findings (0 blocking, 1 important, 2 nit, 1 praise)
