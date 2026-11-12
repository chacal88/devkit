# Readiness review: panel-conduct-view

Round 7. Judged independently, after the phase-5 live-check edits (version-agnostic gate form, AC-10 wording, the second-round findings).

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes (what is left is phase 5, owner-run; phases 1 to 4 are ticked)

Blockers: 0. `openspec validate panel-conduct-view --strict` passes (one INFO, `skip_specs`, by design). `node plugins/openspec/hooks/deliver-check.mjs panel-conduct-view --json` reads AC-1..AC-21, lists 5 phases, gates 1.9 to 4.9 done, 5.1, 5.2 and 5.9 open. Items 1, 2 and 4 are open only for what is still to come (evidence.md, two reviewers, proof rows), as expected before the PR.

## 2. Scope validation
Classification: correct. The three edits add no behavior beyond the owner's answers (`sim nos dois`, "tudo ok", "a caixa nao muda o foco", kept as an app limit). Non-goals unchanged.

## 3. Proposal review
AC-10 (proposal.md:93) names "the app's bundled Claude Code (2.1.321 since 2026-11-12)", matching requirements.md:88, :123 and :284-286, same id and slug. Remaining "2.1.317" mentions (proposal.md:71, :146; design.md:15, :62, :65, :1316, :1411; tasks.md:300-303) are historical or name the type contract the code was written against; none is an instruction a gate or implementer would follow.

## 4. Design review
Claim (1) verified against code:
- `plugins/openspec/hooks/deliver-check.mjs:280` takes the first backticked text after `Gate:`; :309 splits on the literal `&&`; :316 matches a part to a cell containing it in backticks; :333-334 cuts rows at every `|`. The new form has no backtick, no `&&` and no `|` (`;` and `$(...)` only), so D16's argument holds.
- Run on this tree: `deliver-check --json` returns every part intact in `missingGates` (the full `"$(for c in ...)"` text for each bundled-binary part, the npm path parts, `node --test ...`, `python3 ...`), which is the parse the matching needs. Evidence rows must carry the same text, as D16 says.
- Smoke run of the form: it resolves to `.../claude-code/2.1.321/ddbdf2b334e1/claude.app/Contents/MacOS/claude` and `--version` prints `2.1.321 (Claude Code)`. The `;` is inside the substitution, so the exit code is the binary's own; no match fails rather than passes (D16).
- All eight gate lines in tasks.md (205, 310, 344, 530, 585) use the form; the npm path `N` stays fixed. tasks.md:10 and design D16 state it.
Live-check fixes verified in code: `project.ts:130-149` drops a candidate whose id has an archived folder in the root or its own checkout (AC-6); `i18n.ts:365` holds the `otherChangesHint` text; `conducted.ts:19,49-55` has `isChangeId` and the trimming `conductArgs`. D4, D8 item 9, D12, D24 carry them.

## 5. Specs review
No delta, by design. No finding.

## 6. Tasks review
- The criteria map (tasks.md:41-62) lists all 21 ids, AC-1..AC-21, each with tasks; each id also appears once in proposal.md's criteria list. Evidence-row rules stated.
- No ticked task is contradicted: the addendum says the archived drop and the hint land in 1.3, 4.1 and 4.6, already ticked, and no task is added. The code above confirms they exist. 1.3's ticked text (tasks.md:111-114) does not itself mention the archived-folder drop; it is carried by the addendum and design D4 only.
- Gates 1.9 to 4.9 keep `[x]`; D16 says `pr-verifier` re-runs them in the new form. 4.9 was re-run green by the conducting session (stated, not re-run here); the guard suite 648/648 at 3.9 was not re-run, as asked.
- 5.1, 5.2, 5.9 are owner-run and consistent with the fail-fast paragraph.

## 7. Omission detection
No omission found.

## 8. Execution risks (top 5 failures)
1. A second app update that leaves two version folders: the glob takes the lexically last, which could be an older one if digit counts differ (D16 names it). Low; `plugin test` fails loudly.
2. Evidence rows written with a part that differs by one character from the gate line: `deliver-check` counts the part missing. Prevention: `pr-verifier` copies the part verbatim (D16).
3. The fill button cannot focus the prompt (app limit, owner accepted); recorded for the retro.
4. `$.ui.copy` answers `isCopied: true` on a terminal that dropped OSC 52; 5.2 records the press.
5. Phase 5 started by a child session instead of the conducting session: ends at once per the fail-fast paragraph.

## 9. Mandatory fixes before implementation
None.

## 10. Optional improvements (within scope)
- [ ] Low: add one clause to tasks 1.3 naming the archived-folder drop, so the ticked task and the code read alike. Not required.

## 11. Explicitly out of scope
- [ ] `conduct-check` owner-run phase support and the `conduct-check.mjs:262` skip: a devkit-openspec change.
- [ ] Re-running the guard suite or gate 4.9.
- [ ] `approval.md` holds `sha256:55861e4b2ed1`, the hash of an older readiness; the checker will compare it to this report. The owner's "Aprovo o plano" on the current plan is the owner's gate, not a plan defect.

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes.
2. Is the result measurable? Yes: 21 criteria with checker-readable ids; AC-12 and AC-13 end in the owner's reading, by design.
3. Are error behaviors defined? Yes.
4. Are edge cases covered? Yes.
5. Are dependencies clear? Yes.
6. Are contracts defined? Yes, including the gate-part contract with `deliver-check` (D16).
7. Can two developers interpret this differently? Not on anything that changes behavior.
8. Are any decisions implicit instead of written? No.
9. Do the tasks fully deliver the intended outcome? Yes; every criterion has a task and a test or the owner-run live check.
10. What will be discovered too late? Only what 5.2 exists for.

## 13. Final conclusion
- Can we start? Yes; phase 5 is the only open phase.
- What must be fixed? Nothing.
- Main risk if ignored? Evidence rows that do not repeat the gate parts verbatim.
