# Proposal

Change: `flow-script-checker` · Date: 2026-11-19 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(`requirements.md` holds the grill; the design is [ADR 0010](../../../docs/adr/0010-openspec-as-the-harness.md)
and [docs/coordination-design.md](../../../docs/coordination-design.md), sections 3, 4 and 8)

Summary: round 14 of `openspec/roadmap.md`. The `devkit` and `devkit-lite` schemas declare every
stage of a change and name roles instead of Claude tools; every stage file opens with a one-line
header (stage, result, attempt, commit); a new checker, `flow-check`, reads those headers, OpenSpec,
git and GitHub, says which stage passed and which is next, and prints it in Portuguese or English.
Today's flow (`ship-change`, `deliver-check`, `/conduct`, the hooks) keeps driving every change.

## Why

The next step of a change is guessed today: `conduct-check.mjs` and `deliver-check.mjs` derive it by
parsing prose, and six retros record a wrong step, the last one on 2026-11-19 (a checkbox quoted in
a fenced example of `tasks.md` read as a task). ADR 0010 decides that the flow is declared in
OpenSpec and read from file headers by a small checker without AI. Round 15's change coordinator
asks that checker for the next stage, so it has to exist first.

## What Changes

- **The scripts.** `plugins/openspec/schemas/devkit/` and `devkit-lite/` are replaced in place (and
  their copies under `openspec/schemas/`): every stage of design section 4 that leaves a file is an
  artifact, in the table's order; `devkit`'s `apply` requires the owner's `approval`; `devkit-lite`
  gains the grill (`requirements`) and the stages after implementation, with no readiness and no
  separate approval. Each schema folder gains `flow.json`, the stage declaration: every stage in
  order with its role, skills, attempt ceiling and titles, the stages with no file of their own
  included. Instructions name roles and skills, never `devkit-core:` types or a platform's tools.
- **The stage header.** Every template starts with
  `<!-- devkit-stage <stage> result=pending attempt=1 commit=none -->`. It is an HTML comment because
  OpenSpec's strict validation refuses any other text above a spec delta's first section; every
  reader of today's flow skips it.
- **The checker.** `plugins/openspec/hooks/flow-check.mjs <id> [--json] [--lang pt-BR|en]
  [--after <key>]`: per stage passed, failed, not applicable, stale, pending or blocked; one next
  stage with its role and why, or one of four end states; ceilings and a no-progress stop; a
  fence-aware task count; the delivery read through `deliver-check`'s exported GitHub functions;
  a plain message for a change begun under the previous script.
- **The roles.** `docs/roles.md` lists every role the schemas name: what it does, delivers and
  never does, and which agent or skill plays it in Claude Code today.
- **The writers.** `ship-change` (approval, review summary, retro), `/conduct`'s grill row, and three
  devkit-core agents (`plan-readiness-reviewer`, `pr-verifier`, `change-planner`) write the header as
  the first line of their file. Nothing they check or decide changes (OD-1, decided (a), below).
- **Today's readers.** `conduct-check` takes the plan files from `flow.json`; the session hook says
  that `flow-check` gives the next stage and that a role is the devkit-core agent of the same name.
- **What "update" means for a project** (the owner's answer 2, "they change when they update"): a
  plugin update (`claude plugin update devkit-openspec@devkit`) brings the checker and its readout
  at once; the new stages reach a project's changes only when `openspec-setup` (or
  `install-schemas.sh`) is run again in that project, because the schemas are copied into its
  `openspec/schemas/`. Until then the readout says the project's schema predates the stage
  declaration, and today's flow runs as before.
- **Docs and release.** `docs/openspec-flow.md`, the pack README, `docs/coordination-design.md`,
  `CONTRIBUTING.md`, `README.md`, the config header comments and the CompozyOS loop's schema line
  stop stating what this change makes false; CI installs OpenSpec 2.0.0 before the hook tests;
  devkit-openspec 0.15.0, devkit-core 0.7.0, devkit-compozy 0.1.1, marketplace 0.19.0, tag
  `v0.15.0` after the merge.

Non-goals: the coordinators, `/devkit`, the stop locks, the language setting, any driver, the new
roles of round 16, the two-PR model, `devkit-project`; removing `conduct-check`, `deliver-check`
or `/conduct`; installing the checker into projects (round 26); any change to what the six
reviewers or the implementer do.

## Acceptance criteria

- AC-1 `every-stage-declared`: a change created with the `devkit` schema lists, in
  `openspec status --change <id> --json`, every stage of section 4 of the design that leaves a file,
  in the table's order, from the requirements to the retro.
- AC-2 `roles-not-tools`: no instruction of the two schemas names a tool of one platform or a
  `devkit-core:` agent type; each stage names its role and its skills; one document lists every role
  with what it does, delivers and never does.
- AC-3 `fixed-header`: every stage file starts with the same header carrying the status (passed,
  failed, not applicable), the attempt and the commit, and the templates of both schemas ship it.
- AC-4 `checker-tells-the-truth`: given a change folder, the checker says for each stage whether it
  passed, failed, does not apply, is stale, is pending or is blocked, which stage is next, which role
  runs it and why, reading only headers and never prose (the eight cases of `requirements.md`).
- AC-5 `status-readout`: one command prints each stage with its situation, the next stage, who runs
  it and why, as plain text in Portuguese, and the same facts as JSON.
- AC-6 `todays-flow-still-drives`: nothing that drives a change today breaks; a change created with
  the new script can be taken from its plan to its archive by `ship-change`, `deliver-check` and the
  hooks.
- AC-7 `older-change-recognised`: for a change started under the previous script, the checker says
  so in plain text and that today's flow finishes it; it reports no wrong stage and stops nothing.
- AC-8 `short-script`: `devkit-lite` declares the grill, the short plan, the implementation, unit
  and E2E tests, the demonstration, the review, the delivery and the retro; mock-up and decisions
  only when called for; no readiness review and no separate plan approval.
- AC-9 `no-ai-in-the-checker`: the checker and the readout run with Node, Git, `openspec` and `gh`
  only.

## Capabilities

### New Capabilities
- `change-stages`: the declared stages of a change, the stage header and the checker that reads them.

### Modified Capabilities
- none (the repository has no spec baseline: `openspec/specs/` holds only `.gitkeep`).

## Impact

- `devkit-openspec`: both schemas (and `openspec/schemas/`), `hooks/flow-check.mjs` and its test,
  `hooks/conduct-check.mjs`, `hooks/guard.mjs` (session text only), `ship-change`, `conduct`.
- `devkit-core`: three agents and the `plan-readiness-review` report template (first line only).
- `devkit-compozy`: the loop template's description line and its planning-step line, and the tech-lead agent's grill wording (the same lines in this repo's `.compozy/`).
- Projects: the new checker arrives with the plugin update; the new schemas only when
  `openspec-setup` (or `install-schemas.sh`) runs again. Open changes keep running on today's flow.
- CI: `.github/workflows/ci.yml` installs `@fission-ai/openspec@2.0.0` before the hook tests.

Exit criteria: every phase gate green; the whole suite
(`node --test plugins/openspec/hooks/guard.test.mjs`), `python3 scripts/check.py`,
`python3 scripts/gen-catalog.py --check`, `claude plugin validate .`,
`openspec validate flow-script-checker --strict` and both `openspec schema validate` green.

Decisions cited: ADR 0010 (decisions 1, 3, 5, 7, 8), ADR 0004 (opt-in by schema), ADR 0002 and ADR
0003 (merge mode, unchanged), ADR 0008 (review paths, unchanged). No new ADR (design D-13).

Open decisions inherited: the header's field names (design section 8, open) are decided here.
OD-1, decided (a) while planning (the conducting session, under the owner's standing instruction to
decide routine choices): the verifier and the plan-readiness reviewer write the header line as the
first line of their file; what they check does not change (`requirements.md`, Decisions taken while
planning; design D-10).
