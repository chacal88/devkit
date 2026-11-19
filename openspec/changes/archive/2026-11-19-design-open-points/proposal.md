# Proposal

Change: `design-open-points` · Date: 2026-11-19 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(follow-up to the archived change `orchestrator-replan`; the source is the owner's answers of
2026-11-19, listed below)

Summary: write into the repository the owner's answers to the open points of
`docs/coordination-design.md`, so the documents stop listing as open what is decided. Documents
only; nothing that runs changes.

## Why

`orchestrator-replan` recorded the coordination design (`docs/coordination-design.md`, ADR 0010)
with a list of open points. On 2026-11-19, after it merged, the owner answered most of them. Until
the answers are in the repository, the next rounds (14 to 26) would be planned from a document that
calls decided things open, and a planner would grill the owner again on questions already answered.

## What Changes

The owner's answers (translated; numbered as the conversation numbered them):

1. **Role names** (delegated to the assistant, who decided): `manager` is the roadmap coordinator,
   `tech-lead` the change coordinator, and the CompozyOS kit's present `tech-lead` role, which
   plans, is renamed `planner` in round 21 (`compozy-driver`), so every driver uses the same names.
2. **Load hold** (owner): the manager holds a new start while the machine is loaded; what is under
   way finishes first. How load is measured stays open.
3. **Conflict of a task branch with `develop`**: still open; settled in the grill of round 17.
4. **Small work** (owner): the four phases are one optional way to produce a roadmap, never a
   prerequisite; a one-off feature goes straight onto `openspec/roadmap.md`.
5. **Lean pull-request template** (owner): a debt item on the roadmap; the owner researches models.
6. **Jira** (owner): read by default; written back only when the developer asks.
7. **Command names** (owner): the five `/devkit` verbs stay as proposed.
8. **Proving live** (owner): the points still to prove are proved together, in one test session.

Where each answer lands (exact texts T-1 to T-21 in `tasks.md`):

- `docs/coordination-design.md`: sections 1, 2, 4, 5, 7, 10, 11 and 13 mark each answer with who
  decided it and when; the "Open points" list drops points 1, 2, 4, 5, 6 and 7, keeps point 3 and
  every point nobody answered, and gains "how the roadmap coordinator measures load".
- ADR 0010: a dated Note at the top of its Context (below).
- `openspec/roadmap.md`: the lines of rounds 18, 20 and 21 gain the load hold, the write-back on
  request and the `planner` rename; a new `## Round 27: debts` holds `lean-pr-template`; the
  paragraph before round 14 names round 27.

**Amending ADR 0010.** It stays `- Status: accepted` and its Decision text is not rewritten. It gets
a `Note (design-open-points, 2026-11-19): ...` paragraph as the first paragraph under `## Context`,
the form ADRs 0006, 0008 and 0009 carry for ADR 0010 and ADR 0001 and 0007 carry for their
supersession. The Note names the two sentences it answers (the last sentence of decision 2 and the
last sentence of the Negative consequences). No new ADR: the answers fill in points ADR 0010 itself
left open and reverse none of its decisions 1 to 8; a superseding ADR would restate the whole
decision for two names.

**Sentences the answers make false, and their fix:**

| Where | Today | Fix |
|---|---|---|
| `docs/coordination-design.md:32` | commands "proposed; the names are examples and are not confirmed" | T-3 |
| `docs/coordination-design.md:54-55` | Jira write-back "open", "assumes it is read-only" | T-4 |
| `docs/coordination-design.md:59`, `:71` | the names `manager`, `tech lead` "proposed" | T-5, T-7 |
| `docs/coordination-design.md:67-69` | the load hold "proposed and open" | T-6 |
| `docs/coordination-design.md:79-80` | "Names (open)", which one is renamed is open | T-8 |
| `docs/coordination-design.md:154-156` | lean template "(open)" | T-9 |
| `docs/coordination-design.md:214-215` | one-off feature "not decided" | T-11 |
| `docs/coordination-design.md:393` | section 13 "All proposed" | T-14 |
| `docs/coordination-design.md:416-422` | six answered open points | T-15 |
| `docs/adr/0010-openspec-as-the-harness.md:71-72`, `:167-168` | names "proposed, not decided"; "(open)" | T-16 (Note) |
| `openspec/roadmap.md:51`, `:57`, `:60` | no load hold; Jira "read-only"; no rename | T-18, T-19, T-20 |

Checked and still true, so unchanged: `docs/compozy-kit.md:15`, `.compozy/README.md:16` and the
kit's `tech-lead` files (the rename lands in round 21); `docs/adr/0007-one-change-on-request.md:14`
and `docs/adr/0008-reviews-as-a-workflow.md:11` (their open points were not answered).

Non-goals: building anything of rounds 14 to 27; renaming the CompozyOS role now; any file of a
pack (`plugins/`), `.compozy/`, `.claude-plugin/`, `CHANGELOG.md` or `docs/catalog.md`; any
version; any test change; deciding the points still open.

## Acceptance criteria

- AC-1 `design-answers-recorded` — in `docs/coordination-design.md` the "Open points" list no
  longer lists the command names, the role names, the load hold, writing back to Jira, the one-off
  feature or the lean pull-request template, and still lists the conflict with `develop` (naming the
  grill of round 17), how load is measured, and every point nobody answered; each answered item
  reads decided in its own section and names who decided it and when; section 2 names `manager`,
  `tech-lead` and the `planner` rename, which sections 10 and 11 place in round 21; section 13 says
  the unproved points are proved together in one live test session.
- AC-2 `adr-and-roadmap-agree` — ADR 0010 is still accepted with its Decision text, and a Note at
  the top of its Context records the answers that touch it and names the sentences it answers;
  `openspec/roadmap.md` holds `## Round 27: debts` with an unticked `lean-pr-template` line in the
  grammar `guard.mjs session` reads, the session report still shows round 14 as current, and rounds
  14 to 26 are unchanged except the lines of rounds 18, 20 and 21; outside the archived changes and
  the two ADR 0010 sentences its Note answers, no sentence says the command or role names are
  proposed or open, or that devkit only reads Jira.
- AC-3 `no-behaviour-change` — no behaviour changes: no agent, skill, hook, checker, schema, pack
  or version behaves or reads differently, and the whole guard suite, `scripts/check.py`,
  `scripts/gen-catalog.py --check` and `openspec validate design-open-points --strict` pass.

## Capabilities

### New Capabilities

None. This repository has no canonical specs (`openspec/specs/` does not exist), every archived
change set `skip_specs: true`, and so does this one (`.openspec.yaml`): it ships documents only.

### Modified Capabilities

None.

## Impact

- Changed: `docs/coordination-design.md`, `docs/adr/0010-openspec-as-the-harness.md`,
  `openspec/roadmap.md`. Nothing else outside this change folder.
- Tests that read these files, kept green with no test edit: "ADR 0010 is accepted, supersedes ADR
  0001 and ADR 0007, and the config names it" (`plugins/openspec/hooks/guard.test.mjs:1291`, needs
  `- Status: accepted` and the four headings, both kept); the docs sweep of
  `plugins/openspec/hooks/deliver-check.test.mjs:3318` (reads every `docs/*.md`; no new line says
  "never merges" or "the merge is the owner's"); `scripts/check.py` (English prose, links).
- Release: none. No pack file changes, so no version moves and no `CHANGELOG.md` entry.
- Dependencies: `orchestrator-replan`, archived (`openspec/changes/archive/2026-11-19-orchestrator-replan/`).
- Exit criteria: gates 1.5 and 2.1 of `tasks.md`.
- Decisions cited: ADR 0010 (noted here); ADR 0007 and ADR 0008 (their open points stay open).
- Open decisions inherited: the conflict with `develop` (round 17), how load is measured (round
  18), and the rest of the "Open points" list.
