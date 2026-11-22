<!-- devkit-stage proposal result=passed attempt=1 commit=2300f84524e5c1ec5ed8a0da41e5a5dccff9cc34 -->
# Proposal

Change: `managed-agents-study` · Date: 2026-11-21 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(the source is the round 25b line of `openspec/roadmap.md` and the owner-confirmed `requirements.md`)

## Why

devkit's loop (ADR 0010, ADR 0011, ADR 0013) was designed without a side-by-side reading of Claude
Managed Agents, Anthropic's hosted runtime for agents (beta). `remote-worker` (round 28) already
names it as the candidate to weigh in its grill, and the owner's first read on 2026-11-21 found
three ideas devkit lacks: a change pinned to the devkit version it opened with, one event log per
change with a small set of states, and a budget per change. Before `remote-worker` and the panels of
round 23 are grilled, the comparison should be on paper: what devkit takes as it is, what it should
improve or fix, what does not fit. Each item cites its source page and the devkit file it touches,
and the roadmap lines that follow go to the owner one by one.

## What Changes

- **New `openspec/changes/managed-agents-study/study.md`**: the study, written in the fixed form
  given in `tasks.md` ("The study's form"): the pages read with their full URLs, the reading date
  and the beta header; a short `devkit today` baseline; the seven questions (the three starting
  candidates S-1 to S-3, the four comparisons C-1 to C-4); one section per category (`Take as is`,
  `Improve or fix`, `Does not fit`) holding items with fixed fields (page, devkit paths, questions
  answered, reasoning, what changes in devkit, ADR collision, roadmap line); the proposed roadmap
  lines with the owner's answer to each; and the open points for the grill of `remote-worker`.
- **`openspec/roadmap.md`**: only the lines the owner approves. A line is either a new change line,
  under its own round heading, or an addition at the end of a named pending line that starts with
  "Carried from the managed-agents-study:". No ticked line changes. The tick of this change's own
  line waits for its archive.
- **`openspec/changes/managed-agents-study/.openspec.yaml`**: `skip_specs: true` (set in this
  stage).

Choices this plan makes on top of `requirements.md`, for the owner to see:

1. Every new change line's `after:` list starts with `managed-agents-study`. `/devkit roadmap`
   starts every line whose `after:` dependencies are archived (ADR 0010 decision 2), so without
   this an approved line could start before this study is archived.
2. Both phases are done by the session that conducts this change, never by `tdd-implementer`. That
   agent has no web tool (`plugins/core/agents/tdd-implementer.md` lists Read, Write, Edit, Bash,
   Glob, Grep) and cannot ask the owner. This follows the form of the archived
   `roadmap-coordinator` tasks ("Owner-run task, done by the session that conducts this change").
   The loop still hands such a phase to the implementer: the round 16 line (`stage-roles`) carries
   that gap, and `tasks.md` says how the session handles it.
3. The study's ids and field labels are fixed, so one gate command checks AC-1 to AC-7 and AC-9
   mechanically. The reviewers judge the depth and the reasoning.

Non-goals (from `requirements.md`): no hook, script, schema, agent, skill or plugin manifest
changes; no call to the Claude API, no spend; no ADR is written or amended; no design of
`remote-worker`; no file under `docs/`.

## Acceptance criteria

- AC-1 `study-file-exists`: `openspec/changes/managed-agents-study/study.md` exists, lists the pages it read with their full URLs and the date of the reading, and names the beta header the pages carry.
- AC-2 `three-categories`: `study.md` has three sections, one per category (`take as is`, `improve or fix`, `does not fit`), and every item sits in exactly one of them.
- AC-3 `items-cite-page-and-file`: every item of `study.md` cites at least one URL under `https://platform.claude.com/docs/en/managed-agents/` and at least one devkit path; every cited devkit path exists in the repository at the study's commit.
- AC-4 `starting-candidates-answered`: `study.md` has one item for each of the three starting candidates (a change pinned to the devkit version it opened with; one event log per change with a small set of states; a budget per change), each placed in a category with its reasoning.
- AC-5 `comparisons-answered`: `study.md` answers each of the four comparisons of the request (outcomes and their grader against the readiness review and the review bench; permission policies and tool confirmations against the hooks and the owner gates; threads and workflow runs against the stage hand-offs and the review round; what `remote-worker` would need), each with at least one item.
- AC-6 `unstated-facts-marked`: every point the read pages do not settle is written as "not stated in the docs" and listed in an open-points section of `study.md` addressed to the grill of `remote-worker`.
- AC-7 `adr-collisions-named`: every item that contradicts a locked ADR names the ADR file and section, and its proposed roadmap line includes the ADR that would replace it.
- AC-8 `lines-approved-one-by-one`: each proposed roadmap line is put to the owner on its own, and `study.md` records each answer (approved, or declined with the owner's reason).
- AC-9 `approved-lines-in-roadmap`: every approved line, and only those, is in `openspec/roadmap.md` in this change's pull request, as a new change line or as an addition to the named pending line; no `[x]` line changed.
- AC-10 `checks-pass`: `python3 scripts/check.py` and `python3 scripts/gen-catalog.py --check` pass on the branch.

All ten are copied: the owner confirmed ten in the grill, more than the one to three this script
usually carries.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. `openspec/specs/` holds ten capabilities (`openspec list --specs`). None of their requirements
changes: the change adds a study file and, at most, roadmap lines, which `roadmap-coordination`
already reads under its current requirements. Hence `skip_specs: true`.

## Impact

- Written: `openspec/changes/managed-agents-study/study.md`, `openspec/roadmap.md` (approved lines
  only), this change's own plan files. Nothing under `plugins/`, `docs/`, `scripts/`,
  `.claude-plugin/` or `.compozy/`, and no `CHANGELOG.md` entry or version bump (no pack changes).
- Tests that read the real `openspec/roadmap.md` and must stay green without an edit:
  `field-fixes 12 roadmap: the round 17b line is read before round 18`
  (`plugins/openspec/hooks/guard.test.mjs`) and `change-loop docs: the design records the answers`
  (`plugins/openspec/hooks/change-loop.test.mjs`, which reads the `review-writer-prompt` line).
  Both are in gate 2.4.
- External: the pages under `https://platform.claude.com/docs/en/managed-agents/`, read on the day
  of the study; the feature is in beta and its pages change, so the study records the date.
- Dependencies: none on the roadmap (the round 25b line has no `after:`).
- Decisions cited: ADR 0010 decision 2 (the roadmap coordinator starts the lines whose `after:`
  dependencies are archived);
  every ADR under `docs/adr/` is read by the study for collisions (AC-7), its "Alternatives
  considered" included.
- Open decisions inherited: the open points of the `remote-worker` line (the Console against the
  app's sidebar, the owner's answers as API messages, a GitHub credential in a vault, runtime
  billed on top of tokens), which the study confirms or settles from the pages; and the round 16
  gap for tasks only the conducting session can do.
- Exit criteria: gates 1.5 and 2.4 of `tasks.md`.
