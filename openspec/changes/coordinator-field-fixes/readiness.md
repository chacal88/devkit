<!-- devkit-stage readiness result=passed attempt=3 commit=4f6d958d353b78c317244ddf0763268d7829e5bd -->
# Readiness review: coordinator-field-fixes

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: the tasks are all ticked; the plan as revised is consistent with the code at HEAD

Attempt 3 re-reviews the one revision made after review round 2: the specification now states the
reuse exception (A-18) that fix commit `fb91e5f` built. `openspec validate coordinator-field-fixes
--strict` is valid. No open blocker. The rest of the plan was judged at attempt 2 and is not reopened.

## 2. Scope validation
Classification: correct. The revision adds no behaviour: it records what the code already does and
what the owner decided (`requirements.md:167-174` A-18, `:250` question 9). Proposal (`proposal.md:20-23`,
`:60-66`), requirements AC-1 (`requirements.md:180-187`), design D-3 and the proof map
(`design.md:610`) say the same thing.

## 3. Proposal review
Defect-1 bullet and AC-1 carry the exception with the same day rule as A-18. No finding.

## 4. Design review (claims re-derived at HEAD 4f6d958)
- `archivedDates` returns the latest `YYYY-MM-DD` per id, union of GitHub, `origin/<default>`, local
  default and the main working tree; `archivedOnDefault` is the `Set` of its keys, exported
  (`change-loop.mjs:597-613`): as D-3 says.
- `createdAfter` reads `created:` from `openspec/changes/<id>/.openspec.yaml`, true only for a day
  strictly later than the archive day; no line or an unreadable file returns false
  (`change-loop.mjs:617-622`): matches D-3, including the "no day / unreadable is the old copy" rule.
- `unfinished` skips an archived id at every rank unless `reused`; the `chore/archive-<id>` rank
  passes no `reused`, so that checkout is never under the exception (`:632-636`): matches D-3.
- `nameTaken` counts active and archived folders in every checkout through `locateChange`, plus the
  branch names, and `openChange` refuses with `name-taken` (`:760-766`, `:786`): the D-3 claim that
  only a hand-made folder can reopen an id the same day holds.
- Test `field-fixes 1 archived: a new change that reuses an archived id, created after the archive,
  stays listed` (`change-loop.test.mjs` about `:2442`) covers later day, earlier day and same day;
  the 8 `field-fixes 1` tests pass here (8/8). The no-day case is covered by the other tests, whose
  active folders have no `created:` line, as D-3 states.

No failed re-derivation.

## 5. Specs review
`specs/change-coordination/spec.md` agrees with A-18, the design and the code:
- The archived requirement (`:17-22`) names the exception and points to the next requirement; its
  scenarios say "old copy", which is what the code treats a no-day or same-day folder as.
- The MODIFIED scenario (`:12`) lists a change that is "not archived ... or a new change reusing an
  archived id on a later day": consistent.
- New requirement (`:53-74`) has four scenarios: later day (listed), archive day, earlier day and no
  `created:` line (all not listed). Every outcome of the D-3 rule has a scenario except the
  unreadable `.openspec.yaml`, which D-3 says is deliberately not stated because no test covers it
  (`design.md` D-3). That is a recorded decision, not a gap.
No contradiction with another spec delta; `grep` finds no other file that says an archived id is
never listed without the exception beyond the lines below.

## 6. Tasks review
Unchanged and all ticked. Task 2.3 names only `archivedOnDefault` (`tasks.md:96`); the Map and the
rule were added as a review fix, and the plan records that in `design.md` D-3 ("Plan revision").

## 7. Omission detection
Day-granularity limit (same-day reopen) is stated with its guard (`nameTaken`). No finding.

## 8. Execution risks
1. A change reopened under an archived id on the archive's own day is hidden: stated, reaches only a hand-made folder.
2. An unreadable `.openspec.yaml` hides a genuinely new change: stated in D-3, untested.

## 9. Mandatory fixes before implementation
None.

## 10. Optional improvements (within scope)
- [ ] Low, Nice to have: `requirements.md:73-79` (A-2) and `proposal.md:132` say the list "leaves out" an archived change with no exception; A-18 follows 90 lines later and the spec carries it, so nothing misleads an implementer. A one-clause pointer to A-18 would remove the doubt.
- [ ] Low, Nice to have: `tasks.md:96` (task 2.3) could name `archivedDates` and `createdAfter`; the code is built and the design records it, so this is documentation only.

## 11. Explicitly out of scope
- Comparing by commit time rather than day; the unreadable-file scenario; any other defect.

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes.
2. Is the result measurable? Yes, AC-1 has later-day, earlier-day and same-day outcomes with a named test.
3. Are error behaviors defined? Yes; GitHub unreadable falls back, unreadable `.openspec.yaml` is the old copy (design only).
4. Are edge cases covered? Yes (same day, earlier, no line, archive branch).
5. Are dependencies clear? Yes.
6. Are contracts defined? Yes: the `created:` line, the day comparison, the folder name pattern.
7. Can two developers interpret this differently? No.
8. Are any decisions implicit? No; A-18 is written and owner-decided.
9. Do the tasks fully deliver the intended outcome? Yes; the behaviour is built and tested.
10. What will be discovered too late? Nothing new.

## 13. Final conclusion
- Can we start? Yes; the revised plan agrees with itself, with A-18 and with the code and test at HEAD.
- What must be fixed? Nothing.
- Main risk if ignored? Not applicable.
