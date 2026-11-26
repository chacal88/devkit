<!-- devkit-stage retro result=pending attempt=1 commit=a46e7268d6e594af5c7ec8e4729ba797801d601e -->
## Retro: release-at-merge

1. Went wrong:
   - The change took five review rounds. Rounds 1 and 2 were the script's own. Round 3 came from the merge of train 20
     (`5565091`): coordinator-loop-fixes had merged on main and changed the same `change-coordination` requirement block, the
     noted-change conflict path (`assign-release` against `resolve-base-conflict`) and `approvalOk`. Each of those seams had no
     test and no plan, and the review found them one at a time. Round 4 was owner-authorized and Round 5 too (the script knows
     two rounds only, so `review.md` prints "round 2/2" for rounds 3 to 5 and the loop stopped at the failure ceiling after
     round 4; the pull request was then opened by hand from the same checks `deliver-check` reads; the roadmap line
     `review-owner-rounds` already carries that fix).
   - Round 4 left two important findings open. Fixing the first, a regular expression for `ADR <number>` copied in three
     places (it had been copied a third time by a phase 11 fix, across the `deliver-check.mjs` and `release-merge.mjs` seam),
     changed product files, so all five approved verdicts went stale and a whole bench ran again for a refactor with no
     behaviour change.
   - Real runs found three defects that the prose tests of phase 11 missed (two merged records holding one number, the
     implementer's phase-less return block, the `file` field not reaching the conductor). The plan rule that asks for a real run
     of every declared case paid for itself.
   - The nits of the five reviewers (about twenty) were kept as follow-ups only inside `reviews/*.md` and `design.md` D-30; the
     roadmap had one line for the change.
2. Better next time:
   - When the base merge brings a change that modifies the same requirement or the same conductor rule, treat it as a plan
     revision first (spec delta, design, tests for both sides of the joined condition) and only then run the bench, so the
     bench judges one stable head.
   - A finding that is a duplicated literal across a module seam deserves a test that fails on the second copy, not only a
     refactor: the reviewer's grep found it once, a test finds it every time.
   - Record the surviving nits on the roadmap when the round closes, in one line, so the archive does not lose them.
   - Say in a question to the owner exactly what the answer authorizes. The button "Sim, corrigir F9" answered a question that
     named both a fix and a fifth check, and I had to read it as both.
3. Remember: five reviewers re-run after any product edit, however small, so batch every open fix into one commit before the
   next round.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | Duplicated `ADR <number>` pattern across the deliver-check/release-merge seam came back after a phase 11 fix | bug-class | regression-gate | project |
| 2 | The reviewers' open nits lived only in the review files and D-30 | process-friction | followup | project |
| 3 | A question's answer button must name every authorization it gives | process-friction | memory-only | user |

## Proposed updates

### `plugins/openspec/hooks/release-note.test.mjs` (regression-gate)
Pin the one builder of the `ADR <number>` pattern: a test reads the non-test `.mjs` files of `plugins/openspec/hooks/` and
fails when the pattern's lookbehind literal appears outside `adrNumberRe`.
- before: `adrNumberRe` is tested for its flags and token edges only; a fourth inline copy would pass every test.
+ after: a test `release-note AC-5 mask: no hook builds the ADR number pattern except adrNumberRe` greps the hook files for the
  `(?<![A-Za-z0-9])ADR ` literal and expects exactly one match, in `deliver-check.mjs`.
- Answer: approved
- Applied: yes

### `openspec/roadmap.md` (followup)
Keep the nits that the five reviewers left open as one follow-up line under `## Round 28r: follow-ups of release-at-merge`.
- before: round 28r holds the one line `forced-merge-release-edit`.
+ after: round 28r also holds `release-at-merge-nits (after: release-at-merge)` — from review rounds 1 to 5: ADR 0034's decision 4
  reading (adr F3); the `assignBlockingAt` re-derivation of the ADR folder and slug (architecture F10); the lookups that match a
  numbered record to its slug in about five places and `numberRelease` reading the step record twice (architecture F3, F8); the
  give-back window that never grows both ends (code-quality F13); `assignConflict` not wrapped against a `ReleaseError` in the
  conductor (code-quality F14); `sharedNumberMatch` reading a shared number as either record (code-quality F15); tests for the
  join's commit carrying no record, the give-back skipping a deleted citation path, `assignConflict`'s two stops and the span
  overlap refusal (test-coverage F18, F19, F28, F29).
- Answer: approved
- Applied: yes

### user memory (memory-only)
When a question to the owner joins two authorizations (a fix and a further review round), the reply button or the typed words
must name both, so a short "yes" cannot be read two ways.
- Answer: approved
- Applied: yes
