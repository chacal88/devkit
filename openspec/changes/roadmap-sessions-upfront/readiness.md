<!-- devkit-stage readiness result=passed attempt=1 commit=c56155334749cdc46bad077ba8f53c4bbec5d140 -->
# Readiness review: roadmap-sessions-upfront

## Decision

- Status: APPROVED

Blockers: 0. Stage reached: ready-for-implementation.

## Package

Change `roadmap-sessions-upfront`, layout OpenSpec. Read: `proposal.md`, `design.md` (D-1 to D-15, Assumptions, Dependencies), `tasks.md`, `requirements.md`, the four spec deltas (`change-coordination`, `change-delivery`, `coordination-locks`, `roadmap-coordination`; 140 scenarios). `openspec validate roadmap-sessions-upfront --strict`: valid, no errors.

## Scope

correct. Problem (typed command per change session, grills one at a time, stale wait loops), the 16 ACs, out-of-scope and the two owner escalations (ADR 0011/0014 and ADR 0006/0014 amendments) are explicit in `proposal.md`. Specs and design add nothing the proposal does not justify.

## Claims checked against the code (base c561553)

- `STARTED_BY_SESSION` and `typedOf` exist: `plugins/openspec/hooks/guard.mjs:554`, `:565`, used at `:534`. Confirmed.
- `entriesOf` counts `startedSessions` / `after === 'session-start'` as own: `roadmap-loop.mjs:151`. Confirmed.
- `wanted = startable && !loaded ? ready.slice(0, free)`, `withhold`, `queue = sessionMode ? [] : ...`: `roadmap-loop.mjs:222-258`. Confirmed.
- `sessionStartOf` `:197`; `readRun`/`updateRun` `:451`/`:479`; `collectRoadmap` `readFlying` `:516-548`; `roadmapStopDecision` `:605`; RH6 in `roadmapAgentDecision` `:654`. Confirmed.
- `stopDecision` allows on `input.background_tasks`: `change-loop.mjs:1231`; `waitLoop` `:1173`; `session_crons` built in `roadmap-loop.test.mjs:1233`. Confirmed.
- `devkit/SKILL.md` has `disable-model-invocation: true` (line 5) and "Create a cron or any scheduled wake-up" (line 183). Confirmed.
- "Do not answer the questions yourself" is in all four schema copies (`plugins/openspec/schemas/*/schema.yaml:20`, `openspec/schemas/*/schema.yaml:20`); the `config.yaml` rule at line 35. Confirmed.
- `hooks.json` has three PreToolUse matchers today (Edit..., Bash, Agent); the fourth (`Skill`) is new, as D-1 says. ADR 0016 is the next free number (last is 0015). `requirements-triage` and `devkit-session` do not exist yet, as the plan says.
- All nine existing tests named in D-13 (T-1 to T-9) and the "read, expected unchanged" tests exist under the quoted names.

## Findings

Mandatory before implementation: none.

- Low, Fix during implementation: Assumption A-2 (the Skill tool's `tool_input` field name is undocumented) makes the `skill` guard match any string field and fail closed. The plan states this and D-15 leaves the real host to the next run. Smallest correction: none; keep the first real run as the check, as written.
- Low, Nice to have: the package is 2000 lines and D-1 to D-15 are cross-referenced from every task. An implementer needs the design open throughout; nothing is missing, so no change is requested.

## Gate commands on the base

- `python3 scripts/check.py`: all checks passed. `python3 scripts/gen-catalog.py --check`: no output, exit 0.
- Gate of tasks 1.6, 2.6, 3.7: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern=... plugins/openspec/hooks/guard.test.mjs` run on the base: 345 tests, 345 pass, 0 fail (7 min 12 s). Green on the base.
- Gates 4.6 (adds `^conduct`, `^flow-check`) and 5.4 (full suite, 13 to 21 minutes, marked long) were not run here; 4.6 is a superset of patterns of the same files and 5.4 is run by the caller.

## Omissions

Validation, error behaviour (`unreadable` fail-closed, `push-failed`, lock never traps), idempotency (ticket replace/claim rules, `--after` re-asks), rollback (run file kept across sessions, `--fresh`), permissions (ticket claim), observability (`logDecision`) and test strategy (one test per guard, red records under `proof/`) are each defined in `design.md` and the specs. No findings.

## Execution-readiness

No major doubts. Every task names its tests, invariants and gate. Each AC maps to tasks in the table of `tasks.md`; each AC has a test name and D-15 splits what is proven here from what the next real run proves.

## Top 5 production risks (grounded)

1. The host's Skill-tool field name differs from the any-string-field assumption (A-2): the fail-closed guard would block `devkit-session` for real runs. Prevention: the plan's `unreadable`/refusal text names the owner's typed fallback; the first real run proves it.
2. The desktop app delivers the started task with a changed form (A-1): ticket not found. Same fallback, same proof.
3. Cron firings only while idle and up to 50% late (A-3): periodic check can lag; the plan lets every action also run on the owner's typed turn.
4. A recurring cron expires after 7 days (A-3): a long run loses its check; the typed `/devkit roadmap` recreates it (`schedule-check`).
5. `archive-session` prompts the owner per call outside auto mode (A-4): cleanup may stall; the check keeps the entry and re-asks later (`session-archive-later`).

## False-completeness check

None found: each decision table row in `design.md` (D-1 `entryDecision` labels, place and release branches) has a spec scenario, and no requirement lives only in support docs.

## Mandatory questions

1. Problem objectively defined: yes. 2. Result measurable: yes (AC-1 to AC-16 with named tests). 3. Error behaviours defined: yes. 4. Edge cases covered: yes (claimed ticket, replayed ticket, load, archived dependency). 5. Dependencies clear: yes (archived `roadmap-coordinator-followups`, `merge-staleness-first-parent`; relies on `release-merge-conflict`, `fresh-base-check`). 6. Contracts defined: yes (ticket form, run-file fields, action inputs). 7. Two developers interpreting differently: not on a behaviour; names and texts are given. 8. Implicit decisions: none found. 9. Tasks deliver the outcome: yes. 10. Discovered too late: host field names and the live app behaviour (A-1 to A-4), which D-15 assigns to the next real run.
