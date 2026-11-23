<!-- devkit-stage readiness result=passed attempt=1 commit=c56155334749cdc46bad077ba8f53c4bbec5d140 -->
# Readiness review: commit-attribution

## Decision

- Status: APPROVED

Blockers: 0. One Medium finding (fix during implementation), listed below.

## Package

- Layout: OpenSpec, `openspec/changes/commit-attribution/` (proposal, design, tasks, requirements, `specs/commit-attribution/spec.md`).
- `openspec validate commit-attribution --strict`: valid.
- Stage: ready-for-implementation. Base HEAD c561553.

## Scope

Correct. The problem (the commit agent's environment trailer names Sonnet, not the session) is named, the
mechanism (one helper, one request, one block, the agent's rule) is the smallest that fits ADR 0010 decision 3,
and the non-goals (no hook, no model change, no other agent) stop creep. Every design decision (D-1 to D-10) has a
spec requirement or a task; the spec adds nothing the proposal does not justify.

## Claims checked against the code

- `change-loop.mjs`: `const AGENT` line 507, rows at 548 to 552, `brief` line 618, `agent` line 637 (a `guard({...})`
  arrow taking `named ?? AGENT[role]`): as the plan says; D-1's rewritten builder fits it.
- `conduct-check.mjs` `SUBAGENT` (lines 47 to 57): exactly five steps map to the commit agent (`commit`, `open-pr`,
  `push`, `open-archive-pr`, `push-rebased`). The generalization "every hand-off to the commit agent" is closed; no
  other step (`archive`, `tick-roadmap`, `enable-auto-merge`) resolves to it.
- `project-loop.mjs`: `AGENT` line 40, `brief` 123, `COMMIT_RULE` 126, `agent` 130, `commitAgent` 134, uses at 205,
  216, 227, 234: as the plan says. It builds no other commit-agent hand-off.
- `roadmap-loop.mjs`: no `commit-and-pr` text; `BRIEF_OF` (line 580) reads the brief's first words only.
- `commit-and-pr.md`: lines 37, 44, 75 hold the three texts D-3 replaces; no other "environment or the user requires".
- `devkit/SKILL.md` lines 70, 76, 133, 168 and `ship-change/SKILL.md` rows 40, 45, 61, `## Mode` / `## Loop`
  headings, `docs/openspec-flow.md` lines 205, 578, 579, 588, versions 0.9.0 / 0.21.1 / 0.25.1: all as stated.
- Test fixtures named in D-7 exist: `build`, `rowOf` (`extra` accepts `agent`), `COMMIT`, `TDD`, `changeLoopModule`,
  `skillText`, `section`, `coreAgent`, `shipSkill`, `skillRow` (matches a row starting "| `open-pr`").
- Existing test at `change-loop.test.mjs` 571 and the CI pin at 2478 to 2479: as D-6 and D-10 say.
- T15's banned-pattern regex and T36's banned words match nothing in the planned texts.

## Gates run on the base

- `python3 scripts/check.py`: passed. `python3 scripts/gen-catalog.py --check`: no output of failure (exit 0).
  `command claude plugin validate .`: passed (warnings only).
- Task 1.6's test command on the base (the `^commit-attribution`, `^change-loop`, `^project-loop`,
  `^roadmap-loop skill`, `^format:` patterns): 336 tests, 336 pass, 0 fail, about 8 minutes. Green; the patterns select
  real tests. The whole suite of 2.5 was not run (marked long).

## Findings

### Medium, Fix during implementation: AC-3 has no negative control

`design.md` D-8, "Pass" line, and `tasks.md` 2.3: the run passes when the trailer is exactly the Opus line. If the
`-p` environment gives the agent no Sonnet trailer of its own, the run passes without the block doing anything, and
the rule is untested. Smallest correction: during 2.3, run the same scratch call once with no block and record
whether the agent's own line appears (or note in the proof that it does not), so the pass is attributable to the
block. No scope change; no new task.

### Low, Nice to have: the target version numbers in 2.2

They are stated as "today's numbers" and the next minor after `origin/main`'s; the task already tells the
implementer to read `origin/main`. No change needed.

## Mandatory questions

1. Problem objectively defined: yes (the commit trailer names the agent's model; cited commit 127097d).
2. Measurable: yes (AC-1 to AC-4, tests T1 to T36, the scratch trailer line, the `git log` command).
3. Error behaviors defined: yes (no block keeps the old rule; `none`; no footer line; a miss in AC-3 stops and revises).
4. Edge cases covered: yes (non-commit agents, a row naming another agent, `push-rebased`, roadmap pass-through, no block).
5. Dependencies clear: yes (base is the archived `review-writer-prompt`; nothing open).
6. Contracts defined: yes (block header, labels, closing line, byte-for-byte rule).
7. Two developers interpret differently: unlikely; texts, test names and line anchors are given.
8. Implicit decisions: none found; the alternatives table records the rejected ones.
9. Tasks deliver the outcome: yes, AC to task mapping is complete (AC-1: 1.1 to 1.3, 1.5, 1.6, 2.1; AC-2: 1.1, 1.4, 1.6;
   AC-3: 2.3, 2.5; AC-4: 2.4).
10. Found too late: that the agent ignores the block despite the rule. Covered by the Risks row and the stop in 2.3.

## Top production risks

1. The agent still writes its environment's trailer: mitigated by the closing line and AC-3 (see the Medium finding).
2. The session forgets the block: the brief's last sentence and each dispatch row ask for it; fallback is today's behaviour.
3. A sibling change bumps the same versions: resolved at release time by D-10 and `release-rebase.mjs`.
4. The `--plugin-dir` run loads an installed copy: D-8 step 5 checks the `init` event.
5. A nested `claude -p` refused in the implementer: the session runs D-8 itself.
