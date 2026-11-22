<!-- devkit-stage readiness result=passed attempt=2 commit=6e803ebbf35af6c2cc94cb622bdd1a4a1ecd3662 -->
# Readiness review: roadmap-coordinator-followups

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

The four blockers of round 1 are fixed in the artifacts and re-checked against the code and the
documents below. No new blocker was found. Blockers: 0.

Checks on `6e803eb` (no product code changed since round 1):
- `openspec validate roadmap-coordinator-followups --strict`: valid (run here).
- `python3 scripts/check.py`: passed. `python3 scripts/gen-catalog.py --check`: exit 0 (handed over by the caller).
- Filtered gate of tasks 1.6, 2.5 and 3.7 (`env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^followups" --test-name-pattern="^roadmap-loop" --test-name-pattern="^change-loop" plugins/openspec/hooks/guard.test.mjs`):
  294 tests, 294 pass, about 6.5 minutes (handed over by the caller). Green on the base. Gate 4.6 (whole suite) is long and is the caller's.

## 2. Scope validation
Classification: correct. Unchanged from round 1: nine retro nits, four live defects (F-1 to F-4) and
the owner's reversal of ADR 0013 decision 1. Non-goals stay tight.

## 3. Proposal review
No findings.

## 4. Design review
No findings. The claims verified in round 1 still hold (no code changed). Newly re-derived:
- `docs/coordination-design.md:376` ends a line with `each stage runs as a subagent in the`, and the
  test at `plugins/openspec/hooks/roadmap-loop.test.mjs:1888` matches
  `/each stage runs as a subagent in the\s+background/`; D-15 now keeps that phrase on one line.
- The two assertions that read step 1 (`roadmap-loop.test.mjs:1850` to `1853`) stay reachable under
  the new T-10 constant (opening paragraph and step 1, plus the part with steps 2 to 5).
- The host tools: the owner's session transcripts under `~/.claude/projects/` name
  `mcp__ccd_session__start_session`, `mcp__ccd_session_mgmt__list_sessions` and
  `mcp__ccd_session_mgmt__set_session_title`, and a call with `"session_id":"self"` exists. The
  design now states its source for the tool fields (the schemas read in the desktop app, given in the
  revision brief) and the exact ids.

## 5. Specs review
Both deltas validate. The `--turn` word is covered by two scenarios, "No turn named" and "A turn word
the loop does not know" (`specs/roadmap-coordination/spec.md:303` and `:307`). The optional scenarios
of round 1 were added too: "A session the app already lists" (`:222`) and "A stop in a run with a
session per change" (`:226`).

## 6. Tasks review
Ordered, test-first in phases 1 to 3, gates are single commands, paths are under real directories,
and the AC table maps each AC to tasks. Task 4.3 names T-11, T-12 and T-14 as passing unchanged and
keeps the phrase on one line; task 3.6 names T-9 and T-10 with invariant, layer and suite.

## 7. Omission detection
No findings. D-8 now says the 3 s wait holds for `next`, `reply`, `hold`, `wait` and `run`, and the
Risks section carries it.

## 8. Execution risks (top 5 failures)
1. A decision read on a turn the owner did not type: designed (`event` by default, the refused path
   and its line).
2. A second session started for one change: designed (the list check by title and `cwd`).
3. A host tool whose schema differs from the one in the design: only visible in the live run (phase 5
   covers it).
4. A future edit of the skill's Roadmap headings breaking a test that reads the whole section: T-10
   and T-13 are listed; others read `## Roadmap` to `## Status` as a whole and keep working.
5. The whole suite (gate 4.6) going red on a test no one listed: the caller runs it; the filtered gate
   is green on the base.

## 9. Mandatory fixes before implementation
None.

## 10. Optional improvements (within scope)
None.

## 11. Explicitly out of scope
- A killed `wait` and the round 16 items (the plan's Non-Goals).

## 12. Mandatory review questions
1. Objectively defined? Yes.
2. Measurable? Yes: named tests, red records, a proof map.
3. Error behaviors defined? Yes, the `--turn` refusal included.
4. Edge cases covered? Yes.
5. Dependencies clear? Yes.
6. Contracts defined? Yes, the host tool ids and fields with their source.
7. Two developers read it differently? Not at any point found.
8. Implicit decisions? None found.
9. Do the tasks deliver the outcome? Yes.
10. Discovered too late? Only a host schema drift, which phase 5 shows.

## 13. Final conclusion
- Can we start? Yes.
- What must be fixed? Nothing.
- Main risk if ignored? Not applicable.
