# Readiness review: compozy-loop-v2 (round 4)

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

## 2. Scope validation
Classification: correct. Re-confirmed fresh from disk: `openspec validate compozy-loop-v2 --strict`
→ "Change 'compozy-loop-v2' is valid" (plus the expected `skip_specs` info line); `python3
scripts/check.py` → "all checks passed". `tasks.md` still holds 43 checkboxes (unchanged from
round 3, as expected — this round touched only cross-references, not task count).

## 3. Proposal review
Unchanged from round 3's findings, all of which held: `proposal.md`'s Open decisions section
(lines 79-95) states none of OD-1 to OD-4 is confined to a single phase, with the real per-decision
blast radius named for each, consistent with `requirements.md`, `design.md` and every phase header
in `tasks.md`. Re-read in full this round; no regression.

## 4. Design review
Unchanged from round 3: `design.md`'s Risks section (lines 164-173) carries the same framing as
the other three files, and the escalate-on-transient-`gh`-failure trade-off (lines 174-179) is
still stated rather than hidden. No new design claims to verify this round.

## 5. Specs review
Unchanged: `skip_specs: true` (`.openspec.yaml:3`), accepted by `openspec validate --strict`
(re-run above).

## 6. Tasks review
Both of round 3's findings are fixed and independently verified against the live file, not taken on
the coordinator's word:

- **Phase 4's header.** `tasks.md:187-189` now reads: "A fixed-path answer changes how 4.2 resolves
  the map and its fixtures in 4.3, and the passages that document it in **1.4**, 3.4 and 4.4 — one
  function and four texts, across phases 1, 3 and 4." This now agrees with task 4.4
  (`tasks.md:207`, "written in 1.4"), closing the stale cross-reference round 3 found.
- **Task 6.4.** `tasks.md:251-255` now reads: "renders each template with this repository's values,
  read from the substitution map of `templates/substitutions.json` (**task 1.3**), the same file
  `compozy-setup` reads to install them, and asserts the rendered text equals the installed file
  byte for byte — a render-then-compare, never a line-by-line heuristic." This matches the
  coordinator's description exactly (round 3 flagged that the file did not yet say this; it now
  does) and gives an explicit pointer to task 1.3, closing the low-severity item.
- **The "exactly three places" claim.** Verified by direct count (`grep -c '\b1\.3\b' tasks.md` → 3):
  the AC-9 table row (`tasks.md:42`), task 1.3 itself (`tasks.md:62`), and task 6.4's citation
  (`tasks.md:253`). No fourth, stray reference exists. This was the specific thing worth checking,
  since a stale task number is what rounds 2 and 3 both turned on, and it now checks out.
- **Every other numeric cross-reference re-scanned.** `grep -n '\b1\.[0-9]\b' tasks.md` over the
  whole file shows: the AC-1 row (`1.1, 1.2`), the AC-8 row (`1.5, 1.6`), "move before 1.1"
  (phase 1 intro), 1.6's "1.5's tie-break", and 7.3's "the description of 1.1" — all correct against
  the current numbering (1.1 plugin.json, 1.2 README.md, 1.3 substitutions.json, 1.4 SKILL.md, 1.5
  resolver, 1.6 resolver test, 1.7 gate). No remaining stale reference anywhere in the file.

The structural checks that have held every round are still true: seven `## N.` phase groups each
ending in a `Gate:` task, every `AC-<n>` mapped to at least one task, tasks small and ordered by
dependency, no task path outside a real repository directory.

## 7. Omission detection
Unchanged from rounds 2-3: validation, error handling, retries, permissions, side effects,
idempotency and compatibility are all covered; the two residual, disclosed risks (fan-in runtime
semantics, `gh`-escalation on a transient failure) are accepted trade-offs stated in `design.md`,
not omissions.

## 8. Execution risks (top 5 failures)
1. **Fan-in runtime semantics for the two branch joins (`touches_screens`→`implement`,
   `has_demo`→`deliver`) are proven only statically.** Cause: `compozy loop validate` checks graph
   structure, not runtime dedup behavior; independently confirmed in round 1 by rebuilding the full
   seventeen-node/eighteen-edge probe and getting `valid: true`, which this round's unchanged D2
   does not need re-running. Impact, if wrong: a change with screens could skip the design gate
   silently, or a change without screens could stall at `implement`. Prevention: the plan's own
   workflow follow-up (`tasks.md:277-279`) correctly defers the first real multi-branch run to
   `chacal88/whatsapp-platform`, which is the only way to observe it; task 2.7's static graph test
   and `compozy loop validate` are the strongest proof available before that.
2. **`checks_green`/`merged` escalate to the owner on any `gh` failure, transient or real**
   (`design.md:174-179`). Disclosed and accepted explicitly as a later refinement, not a defect in
   this plan.
3. **Binary evidence (screenshots, video) lands in the repository with no size budget yet**
   (`design.md:185-187`). Disclosed, deferred by design, not a defect.
4. **`screens-check`'s exit codes (0/1/3) and the `design:` block's format are load-bearing contracts
   for a second project** (`chacal88/whatsapp-platform`) that this review cannot exercise from this
   repository alone, since this repository declares no screens. Mitigated by 4.3's fixture "shaped
   like the screen map of a real project" and by D5's note that the format matches what that project
   already writes.
5. **The resolver's version-comparison (1.5) is now fully specified and fully tested** (1.6's three
   named scenarios) — listed here only to note this was the last open implementation-detail risk
   from round 2, and it closed in round 3; no residual risk here now.

## 9. Mandatory fixes before implementation
None open. Every finding from rounds 1 through 3 is resolved and independently re-verified against
the files on disk this round:
- Round 1: the false "costs that phase, not the plan" claim, fixed and verified in round 2.
- Round 2: OD-4's self-contradicting "confined to a single phase" claim, fixed and verified in
  round 3.
- Round 3: the stale `1.3`→should-be-`1.4` reference in phase 4's header, and task 6.4's missing
  citation of task 1.3 — both fixed and verified in this round.

## 10. Optional improvements (within scope)
None outstanding. All optional items raised in rounds 1-3 (task 1.4's tie-break mechanism, task
6.4's comparison mechanism and its citation, task 7.2's README pack-count clause, `design.md`'s
escalate-trade-off disclosure, task 1.6's named tie-break scenarios) were applied and verified.

## 11. Explicitly out of scope
- A live, multi-agent run of the full seventeen-node graph (branch taken and skipped, demo run and
  skipped, real CI wait) — correctly deferred to the workflow follow-up (`tasks.md:277-279`) rather
  than claimed as proven here.
- `chacal88/whatsapp-platform`'s own adoption and its eleven-place drift from this repository's
  `.compozy/` — cited as motivation, not independently checkable from this checkout, and not a
  readiness blocker since no task in this plan depends on it.

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes.
2. Is the result measurable? Yes — ten acceptance criteria, each with a stated proof method.
3. Are error behaviors defined? Yes — `screens-check`'s exit codes, the resolver's exit 3 with the
   three tried paths, the gates' `next_generation`/`escalate` dispositions, all concrete.
4. Are edge cases covered? Yes, including the tie-break edge cases task 1.6 now names explicitly.
5. Are dependencies clear? Yes — phase ordering, and the real (not understated) cost of each open
   decision, consistent across all four files.
6. Are contracts defined? Yes — node ids, output schemas, exit codes, evidence file names, and now
   the substitution-map file (task 1.3) as the single source both the installer and the test use.
7. Can two developers interpret this differently? No material point found this round.
8. Are any decisions implicit instead of written? No — OD-1 to OD-4 are explicit, their true cost is
   stated accurately, and the one remaining implementation-mechanism gap from round 2 (the
   substitution map's location) is now a named task.
9. Do the tasks fully deliver the intended outcome? Yes.
10. What will be discovered too late if implementation starts now? Nothing structural; the one
    residual unknown (branch fan-in at runtime) is already disclosed and explicitly deferred to the
    next project's first real run, not hidden as if it were proven here.

## 13. Final conclusion
- Can we start? Yes. Four rounds narrowed from a structural honesty problem (round 1: three of four
  open decisions falsely claimed to cost only one phase) down to a single stale digit (round 3), and
  that is now fixed and independently re-verified against the file, not against the coordinator's
  description of it.
- What must be fixed? Nothing outstanding.
- Main risk if ignored? None from the plan's own documents; the one real residual risk (branch
  fan-in semantics, unverifiable without a live multi-agent run) is already disclosed in
  `design.md` and correctly left to the workflow follow-up rather than claimed as settled.
