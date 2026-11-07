---
name: design-implementation-plan
description: Phase 4 of greenfield DDD design. Interviews the owner to turn the approved architecture into a build plan (scaffold, stack traced to ADRs, minimum pipeline) and a backlog of vertical changes ordered by risk and value, written to docs/design/4-implementation-plan.md. Use after design-architecture is approved, or when the user asks to plan the implementation or build the change backlog of a project whose Phases 1-3 are approved.
---

# Design Phase 4: Implementation Plan

> Materializes the decisions: technology executes what the domain drove. This phase is the bridge from design to execution — it ends with a **backlog of vertical changes**, the first one ready to plan. Runs the interview (one question at a time), writes the deliverable in `docs/design/`, and asks the owner to approve it.

Phase order: business discovery (`design-business-discovery`) → domain model (`design-domain-model`) → architecture (`design-architecture`) → **implementation plan** (this skill, the last phase).

## When to use (and when not)

- **Use** when the user asks to plan the implementation of a project whose Phases 1–3 are approved in `docs/design/`.
- **Do not use** before the earlier phases are approved: the plan materializes decisions that only exist once business, domain model and architecture have closed.
- **Do not use** to build an already-planned change — that is execution (see "Handing off to execution").

## Prerequisites

- **Mandatory inputs:** `docs/design/1-business-vision.md`, `docs/design/2-domain-model.md` and, with extra attention, `docs/design/3-architecture.md` (the context map and the ADRs). Reread them; if an input contradicts what the owner says now, point out the contradiction before continuing.
- `docs/design/STATE.md` with Phases 1–3 approved.
- Access to the owner in interview mode.
- **Content language.** Interview and write the prose in the project's language (from its docs/config, or the language the owner writes in). Identifiers, file names and template headings stay as defined.

## Process

Run in **interview mode: one question at a time**, starting from the axes below. Adapt to the previous answer; do not dump a questionnaire. When the options are enumerable, offer them as a choice. Record the answers in the draft as you go.

Tone: a senior architect interviewing the product owner — skeptical to the right degree, pragmatic, allergic to a vague answer. A generic answer → ask for the concrete case that justifies it.

### Interview axes

**1. Structure — how will the system be structured?**
- Repository scaffold mirroring the context-map modules (one directory per bounded context; domain isolated from infrastructure).
- Monorepo or separate repos? (default: monorepo until there is a reason)
- Conventions: lint, formatting, test structure, ubiquitous-language names in the code.

**2. Frameworks — which technologies will be used?**
- Confirm the stack that materializes the Phase 3 ADRs (start from the owner's preferred stack).
- For each new piece in the stack: is there an ADR? If not, the decision is premature — go back to `design-architecture` and record it first.

**3. Execution infra — where and how does it run?**
- Where does the first version run? (default: the simplest thing that works — a managed service; Kubernetes only with an ADR that justifies it)
- Minimum pipeline: build, test, deploy — automated from the first change.
- Messaging: materialize the Phase 3 decision (a simple outbox before a dedicated broker, if that was decided).

**4. Build sequence — vertical changes**
- Order by risk + value: first the change that cuts through every layer (UI → API → domain → database) and proves the architecture.
- Each change delivers one command/event of the model working end-to-end, with a test.
- For each change: an observable acceptance criterion.

### Deliverable

Write `docs/design/4-implementation-plan.md` covering the four axes: the scaffold mirroring the context map, the confirmed stack (each piece traceable to an ADR), the minimum pipeline (build/test/deploy), and the **change backlog** — vertical changes ordered by risk + value. For each change give a short kebab-case id, one-paragraph scope, the model command/event it delivers, its acceptance criterion, and its dependencies on earlier changes. The first change must be specified well enough to plan right away.

ADRs born in this phase (a stack piece with no recorded decision yet) go in the project's ADR folder, sequentially numbered and indexed. **An accepted ADR is immutable:** changed your mind → a new ADR that supersedes or amends.

### Handing off to execution

The change backlog is the output of the design. Each change is then planned and built one at a time through the project's normal change workflow. When the project uses OpenSpec, suggest the `openspec-propose` skill for the first change of the backlog; for a broader planning pass, suggest the `change-planner` agent. Record in `STATE.md` (the "Execution" table) each change as it completes and which one is next.

### Approval

When the exit checklist is satisfied, show the owner a **short summary** (scaffold, stack and its ADRs, pipeline, ordered backlog, the first ready change) and let them review and adjust. Only the owner's explicit approval closes the phase — and with it, the design. Then mark Phase 4 approved in `STATE.md`. If the session ends mid-phase, record the exact stopping point and the next 2–3 pending questions.

## Exit checklist

- [ ] Scaffold defined, mirroring the context map
- [ ] Stack confirmed, each piece traceable to an ADR
- [ ] Minimum pipeline described (build/test/deploy)
- [ ] Change backlog of vertical changes ordered by risk + value, each with an id, scope, acceptance criterion and dependencies
- [ ] First change specified and ready to plan

## Outputs

- `docs/design/4-implementation-plan.md` — scaffold, stack traced to ADRs, minimum pipeline, change backlog.
- New ADRs from this phase, indexed.
- `docs/design/STATE.md` updated, with the "Execution" table ready to receive the changes.

## Guardrails

- **Order is law:** this is the last phase and depends on the three earlier ones being approved. An execution detail of a specific change goes to the Parking lot of `STATE.md` or to that change's own planning — not into the architecture plan.
- **A new stack piece without an ADR is a premature decision:** do not put it in the plan; go back to Phase 3 and record it.
- **Contradicting or superseding an existing ADR goes to the owner.**
- **The owner approves, not you.** From here on, execution follows the project's branch/PR rules; the merge is the human's.

## Related

- Previous phase: `design-architecture` (its ADRs and context map are this phase's direct input).
- After the design: `openspec-propose` (plan the first change), `change-planner` (planning agent).
