<!-- devkit-stage readiness result=passed attempt=1 commit=4f4b7e201aabdebdb65b11f7ce80154463a524e9 -->
# Readiness review: release-tags

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

## 2. Scope validation
Classification: correct. One problem (releases merged without their tag), one opt-in key, one new
step. Out of scope is explicit (`requirements.md`); the non-goals of `design.md` stop the CompozyOS
loop, the panel label and the `openspec-setup` template from creeping in.

## 3. Proposal review
Why, what changes and impact are clear; the opt-in (no key, nothing changes) is stated and tested
(D-3, AC-3). Risks R-1 to R-9 are visible in `design.md`. `openspec validate release-tags --strict`: valid.

## 4. Design review
Claims about internals re-derived against the code at `4f4b7e2` (HEAD is that commit):
- `guard.mjs:103` `parseDevkitBlock` reads `driver|language|budget` on one line, as D-1 says.
- `change-loop.mjs:82` `readDevkitSettings` returns `{ driver, language, unknown }` plus `delivery`/`missing` only when set.
- `change-loop.mjs:806` `ROWS`; `decide` first-row/`inDelivery` (`:787-790`, `:946`) give the archive-branch behaviour D-5 and R-3 describe.
- `deliver-check.mjs:1146` `readContents` (404 only is `notFound`), `:1154` `archivePrFacts` with the `gh pr list` arguments D-3 quotes, `:1189` `archiveFacts` (keeps `facts` on a null `onDefault`), `:1219` `archiveBaseFacts`, `:1274` `archiveNext` (P0 `archived` is the first row), `:1577` `collectState`, `:1644` the one `archiveFacts` call inside the `postMerge` branch, `:2245` the generic error path, `:142` `deliveryConfig`.
- `conduct-check.mjs:61` `MAIN` and `:70` `actorOf`.
- Tests: `deliver-check.test.mjs:3210` (the `steps` list), `:3795/:3805` (pin and release-ready), `:4464` (`archive` keys), `change-loop.test.mjs:2538-2545` (pin invariant), `conduct-check.test.mjs:532-540` (`main` list) say what the D-9 table says. The cited `change-loop settings` and `delivery-models config` tests exist and pass on the base (32/32).
- Helpers D-9 says are exported (`pm`, `mergedPr`, `archivePrJson`, `ARCHIVE_PRS`, `ARCHIVE_LISTING`, `retroMd`, `writeRetro`, `archiveFolder`) are in the file but not exported yet; tasks 2.1 adds the exports, as D-9 says. `shipRepo` (`:1766`) and `pm` (`:3852`) have no `extra` yet; also task 2.1. Consistent.
No failed re-derivation. No metadata/roadmap files are used by this project's package.

## 5. Specs review
Normative SHALL language; every requirement has WHEN/THEN scenarios. Every outcome row of the D-4 table
(R1 unreadable, R2 elsewhere, R3 missing) and D-2's states (`none` reasons, `done`, `missing`,
`elsewhere`, `unreadable`) has a scenario; the loop's `tag-elsewhere` vs `archive-failed` split and the
`no-progress` end have scenarios in `change-coordination`. The specs add nothing the proposal does not justify.

## 6. Tasks review
Ordered by dependency, test-first per phase with a saved red run, checkboxes, one backticked gate per
phase. Gates run on the base: `python3 scripts/check.py`, `gen-catalog.py --check` and
`claude plugin validate .` are green there; the `change-loop settings` / `delivery-models config`
slice is green. Gates that load the deliver-check suite are marked as long and background. Every path
falls under an existing directory.

## 7. Omission detection
Validation (path rule, tag rule), error handling (unreadable stop, 404 rules), permissions (push
without force, tag-only refspec), idempotency (done when the tag is at the merge; `no-progress` guard),
rollback (remove the key), compatibility (no key, no new `gh` call), test strategy and evidence: all
written. Parser edge cases are decided (config.yaml rule "Parsers"). Existing tests that assert touched
strings are a table (config.yaml rule "Existing tests"). No findings.

## 8. Execution risks (top 5 failures)
1. Cause: GitHub field shapes differ from the fixtures (`pulls`, `git/commits`, `git/ref`). Impact: false stop. Prevention: R-4; an unexpected shape is a stop, never a pass.
2. Cause: `merge_method: rebase` with a multi-commit change. Impact: a missed tag. Prevention: R-2, by-hand commands stay documented.
3. Cause: a run from a checkout other than `chore/archive-<id>` after the archive merge. Impact: archive tag not asked. Prevention: R-3, documented limit.
4. Cause: the installed plugin, not this worktree, runs the loop. Impact: v0.29.0 itself is untagged. Prevention: tasks Workflow follow-up (by-hand push, recorded in the retro).
5. Cause: sibling changes collide on release numbers and `change-loop.mjs`. Impact: rebase cost. Prevention: R-8, re-read `origin/main` numbers at 4.4.

## 9. Mandatory fixes before implementation
None.

## 10. Optional improvements (within scope)
- [ ] Low, Nice to have: `design.md` Context cites `deliver-check.test.mjs:3209` for the `steps` test; it starts at `:3210`. Harmless.
- [ ] Low, Fix during implementation: R-7 (CompozyOS "never push without approval") is flagged for the owner; the owner should acknowledge it at plan approval.

## 11. Explicitly out of scope
- [ ] Backfilling tags before v0.13.0, annotated or signed tags, GitHub Releases, moving or deleting a tag, the CompozyOS driver, a panel label, `openspec-setup` writing the key.

## 12. Mandatory review questions
1. Yes: untagged releases break `openspec-setup` pins; the loop owns the tag.
2. Yes: AC-1 to AC-7 each map to a named test (D-9 table).
3. Yes: unreadable, elsewhere, bad setting and refused push are all defined with exit codes.
4. Yes: new file, gone file, non-JSON, bad version, other base, two-prs, annotated and array tag answers.
5. Yes: ADRs 0002, 0003, 0004, 0010, 0018 and the merged `delivery-models`.
6. Yes: the key, the step's fields, the six `gh` calls and the reply keys are written.
7. Unlikely: names, texts and calls are copied from the design.
8. No implicit decision found; the one ordering choice (tag rows before P0) is argued in D-4.
9. Yes, apart from the documented v0.29.0 follow-up.
10. Real GitHub shapes (R-4); the first live tag only after the new plugin is installed.

## 13. Final conclusion
- Can we start? Yes.
- What must be fixed? Nothing mandatory.
- Main risk if ignored? The GitHub response shapes are verified only against fixtures (R-4).
