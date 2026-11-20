# Requirements

Change: `flow-script-checker` · Date: 2026-11-19 · Owner: Kaue (chacal88)

Grill: held on 2026-11-19 in the owner's session, four questions, one at a time (Questions asked).
This is round 14 of `openspec/roadmap.md`, the first change that builds the coordination design of
ADR 0010 (`docs/adr/0010-openspec-as-the-harness.md`) and `docs/coordination-design.md`.

Classification: domain=product type=feature flags=[architecture, contract] (confirmed: the schemas
are the contract between devkit and every project that uses it, and the owner chose to replace them
in place).

## Request

(The roadmap line the owner approved, and the owner's go-ahead, translated from Portuguese.)

> flow-script-checker — the `devkit` schema declares every stage of a change, each stage file opens
> with the fixed header (status, attempt, commit), a checker without AI says which stage passed and
> which is next, and the schema names roles instead of Claude tool names (D-4, D-8)

Asked "Shall I start round 14, the script and the checker?", the owner answered "Sim, começar"
("Yes, start").

The design this change builds from is `docs/coordination-design.md`, sections 3 (the script names
roles), 4 (the stages of one change) and 8 (the harness: the fixed header, the checker, the attempt
ceilings, the four end states), with ADR 0010.

## Assumptions

- A-1. The schemas keep their names and places: `plugins/openspec/schemas/devkit/` and
  `plugins/openspec/schemas/devkit-lite/`. The new script replaces the present one in place; a
  project gets it when it updates devkit (owner, question 2). Corrected while planning: a plugin
  update brings the checker and its readout; the schemas reach a project only when `openspec-setup`
  (or `install-schemas.sh`) runs again there, since they are copied into its `openspec/schemas/`
  (`plugins/openspec/skills/openspec-setup/scripts/install-schemas.sh:39-47`).
- A-2. This round builds the script (the two schemas), the fixed header, the checker and its
  readout. It builds no coordinator, no `/devkit` command, no new agent, no new lock and no driver;
  those are rounds 15 to 22. The stages whose role does not exist yet (the mock-up, the decisions
  and ADRs, the unit-test suite, the E2E tests: round 16) are declared by the script in this round,
  and the plan says how a change run before round 16 gets past them without anybody inventing a
  result.
- A-3. Until round 15 the changes of this repository are still driven by the `ship-change` skill and
  `plugins/openspec/hooks/deliver-check.mjs`, and the hooks of
  `plugins/openspec/hooks/guard.mjs` still guard them. Round 15's own change will be created with
  the script this round ships, so that flow must be able to drive a change created with it
  (AC-6). The two old checkers are not removed here: round 24 removes them. Corrected while
  planning: `plugins/openspec/hooks/conduct-check.mjs` (`/conduct`) also drives changes today and
  reads the schema's artifact list (`:175-188`); this change keeps it working (design D-10).
- A-4. Where the checker lives: AMBIGUOUS: (a) with the schema, installed under the project's
  `openspec/` by `plugins/openspec/skills/openspec-setup/scripts/install-schemas.sh`, as
  `docs/coordination-design.md` section 8 says ("travels with the script") | (b) in
  `plugins/openspec/hooks/`, next to the present checkers; the planner resolves, and (a) is the
  design's stated direction. Resolved while planning: (b), the checker lives in
  `plugins/openspec/hooks/flow-check.mjs`. Installing it under a project's `openspec/` is round
  26's (`docs/coordination-design.md:451-454`), and there it would sit outside the product-code gate
  (`plugins/openspec/hooks/guard.mjs:203-206`) and the stale rule
  (`plugins/openspec/hooks/deliver-check.mjs:145`); the stage declaration (`flow.json`) travels with
  the schema.
- A-5. The delivery stages: the checker knows the two delivery models devkit has today (a pull
  request to the main branch, merged by the owner or by GitHub). The model with two pull requests
  from the same branch is round 17.
- A-6. The readout is plain text a person reads, in Brazilian Portuguese and in English; the owner
  reads Portuguese only. The person's language setting belongs to round 15, so the planner picks how
  the language is chosen in this round (for example a flag, with the plugin's existing `language`
  option as the default where it exists) without building that setting. Corrected while planning:
  the only `language` option, devkit-panel's, reaches only the panel module
  (`plugins/panel/hooks/i18n.ts:557-558`); the readout takes `--lang pt-BR|en`, default `pt-BR`.
- A-7. A pack file changes, so `devkit-openspec` gets a version bump, a CHANGELOG entry and, as
  `CONTRIBUTING.md` says for that pack, the CI pin in `docs/openspec-flow.md` and a tag after the
  merge. Corrected while planning: `CONTRIBUTING.md:52` holds the tag rule; the doc-pin rule lives
  in `plugins/openspec/hooks/deliver-check.test.mjs:3340-3360`.
- A-8. The checker needs only Node, Git, the `openspec` CLI and, for the delivery stages, `gh`; it
  calls no AI. Corrected while planning: CI installs `@fission-ai/openspec@latest` after the hook
  tests (`.github/workflows/ci.yml:18-25`); this change pins `@fission-ai/openspec@2.0.0` in
  `.github/workflows/ci.yml`, installed before the hook tests, and the checker refuses a major other
  than 2.

## Acceptance criteria

Each criterion says what is proved in this change and what only the next change can prove. The next
change is `change-coordinator` (round 15): the first one created with the new script and driven end
to end.

- AC-1 `every-stage-declared` — a change created with the `devkit` schema lists, in
  `openspec status --change <id> --json`, every stage of the table in section 4 of
  `docs/coordination-design.md` that leaves a file, in the table's order, from the requirements to
  the retro. *Proved here:* a test creates a change with the shipped schema and reads the list.
- AC-2 `roles-not-tools` — no instruction of the two schemas names a tool of one platform or a
  `devkit-core:` agent type; each stage names its role and its skills, and one document lists every
  role with what it does, what it delivers and what it never does. *Proved here:* a test reads the
  schemas for the forbidden words; the role document exists and covers every role the schemas name.
- AC-3 `fixed-header` — every stage file starts with the same header, carrying the status (passed,
  failed, not applicable), the attempt and the commit, and the templates of both schemas ship it.
  *Proved here:* tests on the templates and on the header reader.
- AC-4 `checker-tells-the-truth` — given a change folder, the checker says for each stage whether it
  passed, failed, does not apply, is stale, is pending or is blocked, which stage is next, which
  role runs it and why, reading only headers and never prose. *Proved here,* one test per case:
  a file whose header says failed does not pass its stage; a stage marked not applicable counts as
  passed; no stage after the implementation is offered while a task is pending; a stage whose
  header commit is older than a later code change is stale and is the only one offered again; a
  stage past its attempt ceiling stops with its reason; the same stage coming back twice with
  nothing changed stops; the run always ends in exactly one of the four states (archived, waiting
  for the owner, waiting on GitHub, blocked) with a reason; and a checkbox line quoted inside a
  fenced example of `tasks.md` is not counted as a task (today's defect, seen on 2026-11-19).
  *Proved by the next change:* the same on a real change, live.
- AC-5 `status-readout` — one command prints, for a change, each stage with its situation, the next
  stage, who runs it and why, as plain text the owner can read in Portuguese, and the same facts as
  JSON for a program (owner, question 1). *Proved here:* the output for a sample change is recorded
  in the evidence and shown to the owner, who reads it.
- AC-6 `todays-flow-still-drives` — nothing that drives a change today breaks: the whole existing
  suite stays green, and a change created with the new script can be taken from its plan to its
  archive by `ship-change`, `deliver-check` and the hooks as they are. *Proved here:* the suite,
  plus a test that runs `deliver-check` over a change folder written with the new header and gets
  the same steps it gives today. *Proved by the next change:* round 15's own change is shipped
  that way.
- AC-7 `older-change-recognised` — for a change started under the previous script (stage files
  without the header), the checker says in plain text that it began under the previous script and
  that today's flow finishes it; it reports no wrong stage and stops nothing (owner, question 3).
  *Proved here:* a test with a folder in the previous form, and the checker run on this change's own
  folder, which is such a change.
- AC-8 `short-script` — the `devkit-lite` schema declares: the requirements by the grill, the short
  plan, the implementation, the unit tests, the E2E tests where the project has them, the
  demonstration recorded as text, the review, the delivery and the retro; the mock-up and the
  decisions stages apply only when the change calls for them; it has no readiness review and no
  separate approval of the plan (owner, question 4: "o de hoje mas o grill é importante", today's
  script with the grill kept). *Proved here:* a test on the shipped schema.
- AC-9 `no-ai-in-the-checker` — the checker and the readout run with Node, Git, the `openspec` CLI
  and `gh` only. *Proved here:* the tests run it with no AI available, and its source imports
  nothing else.

## Out of scope

- The change coordinator, the roadmap coordinator, the `/devkit` command, the stop locks, the
  person's language setting and any driver (rounds 15, 18, 21, 22).
- The new stage roles themselves: the ADR author, the unit-test runner, the E2E tester, the screen
  designer (round 16).
- The delivery model with two pull requests and the `develop` lock (round 17).
- The `devkit-project` schema of the four phases (round 19); project setup (round 26).
- Removing `conduct-check.mjs`, `deliver-check.mjs`, the `/conduct` skill, the child-session rules or
  the panel (round 24), and the review-round tooling fix (round 25).
- Any change to what the reviewers, the verifier or the implementer check or decide. The first line
  their files carry does change: the stage header (decided while planning, OD-1).

## Questions the design document did not answer

Kept because the previous change promised it: whether `docs/coordination-design.md` is enough to
plan the next change from. These had to be asked or assumed; the planner adds its own below this
list and the retro of this change carries the result.

- What the owner sees at the end of round 14 (asked: question 1).
- Whether the new script replaces the present schemas or ships beside them (asked: question 2), and
  what happens to a change half-way through (asked: question 3).
- Which stages the short script has (asked: question 4).
- Whether the delivery stages belong to the checker of round 14 or to round 17 (assumed: A-5).
- Where the checker lives (the document says "travels with the script"; A-4 leaves the place to the
  planner).
- How a change gets past the stages whose roles arrive in round 16 (assumed: A-2).
- The language of anything a person reads before round 15 builds the setting (assumed: A-6).

Added by the planner (2026-11-19), each settled in `design.md` where named:

- The header's file format: the design leaves it open, and OpenSpec 2.0.0's strict validation
  refuses any visible text above a spec delta's first section, so only a comment line works (D-3).
- Which file is a stage's file when the stage leaves several (the plan's four artifacts; the
  review's `reviews/*.md` and `review.md`), and who writes the header in a file that has one
  enforced writer (`readiness.md`, `evidence.md`) when the requirements keep the verifier unchanged
  (D-3, D-10, OD-1).
- How the checker learns each stage's role, skills, ceiling and kind, given that OpenSpec drops
  extra keys (section 8 records the drop, not where the facts go) (D-5).
- Where the attempt ceilings are configured: section 8 assigns the `devkit:` block's fields to
  rounds 15 to 20 and names no round for the ceilings (D-5).
- What "stale" means for the stages before implementation (a plan edited after its readiness
  review): the design defines it only for a later code change (D-6).
- How a checker that keeps no state knows that "the same stage came back twice with nothing
  changed" (D-6: the caller passes back the last progress key).
- How "the stages after implementation unlock only when OpenSpec reports zero pending tasks" holds
  when OpenSpec 2.0.0 itself counts checkbox lines inside fenced blocks (D-1 T7, D-6).
- Which OpenSpec version is pinned, and where: the design says "pin per project" while this
  repository's CI installs `@latest`, 2.1.1 today, untested (D-1).
- Which names the script uses for roles: section 2 names the team roles (`manager`, `tech-lead`,
  `planner`, `dev`, `qa`, `design`), section 4 names the stage agents; and whether `tech-lead` may
  appear before round 15 settles the two roles of that name (D-8).
- Where the role document lives, and whether it travels to projects, since pack assets may not
  point at a document of this repository (D-8).
- Whether OpenSpec's `apply` should require the owner's approval (stage 7) or keep requiring the
  readiness review (D-2).
- How the short script's grill runs in today's drivers: `ship-change` has no grill step, `/conduct`
  grills whenever the schema declares `requirements`, the CompozyOS loop grills only `devkit` (D-10).
- What the delivery stage is under the third ship mode, `plan`, which the design does not mention
  (D-6).
- How a project receives the new schemas: a plugin update does not touch the project's
  `openspec/schemas/`; only re-running `openspec-setup` does (D-9).
- What a stage file says while its gate is not met yet (a retro waiting for the owner's answers):
  the three decided results have no "not judged yet" (D-3: `pending`, the template's value).

## Decisions taken while planning

- OD-1, decided (a) on 2026-11-19 by the conducting session, under the owner's standing instruction
  to decide routine choices: the demonstration file (`evidence.md`) and the plan-review file
  (`readiness.md`) begin with the one hidden status line, written by their own agents; what those
  agents check does not change. Why: otherwise the readout would show two finished stages as pending
  until round 16, which contradicts AC-4. The owner sees it in plain words at plan approval.

## Questions asked

1. [end effect] This round builds the base; the coordinator and `/devkit` arrive in round 15. When
   it ends, what do you want to be able to do? → See the state of a change: one command shows, in
   plain text, each stage, whether it really passed, which is next and who runs it.
2. [scope] Your projects that already use devkit: what happens to them when this round lands? →
   They change when they update: the new script replaces the present one.
3. [edges] And a change that is half-way through in a project when it updates? → The checker warns
   and lets it finish: it recognises the change began under the previous script, says so plainly,
   and today's flow finishes it. Nothing stops.
4. [scope] What should a small change have in the new script? → "o de hoje mas o grill é
   importante": today's short script, with the tests and the demonstration, and the grill kept.

## Escalations

None. ADR 0010 already decides the direction; this change reverses no recorded decision.
