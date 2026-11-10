# devkit-design

Greenfield design in four phases, before there is code to change. Each phase is an interview with the owner that ends in a document and an explicit approval, then points to the next phase.

```bash
claude plugin install devkit-design@devkit --scope project
```

Run at the project root, or add the pack to the project's `.claude/settings.json` (see [getting-started](../../docs/getting-started.md#1-opt-the-project-in)).

```text
design-business-discovery ─▶ design-domain-model ─▶ design-architecture ─▶ design-implementation-plan
   1-business-vision.md        2-domain-model.md      3-architecture.md       4-implementation-plan.md
                                                        + one ADR per          + change backlog
                                                          structural decision
```

- Output goes to `docs/design/` by default; progress is tracked in `docs/design/STATE.md`, so the work survives across sessions.
- Templates live in [`skills/design-business-discovery/templates/`](skills/design-business-discovery/templates/) and are shared by all four phases.
- `ddd-strategic-design` is the supporting method for subdomains, bounded contexts and ubiquitous language, used in phase 2 or on its own.
- The last phase produces a change backlog. Feed each change to `openspec-propose` or the `change-planner` agent.

## Assets

<!-- catalog:begin -->
**Skills** (invoke with `/<name>` or let Claude pick them by description)

| Skill | What it does / when to use |
|---|---|
| [`ddd-strategic-design`](skills/ddd-strategic-design/SKILL.md) | Designs DDD strategic artifacts - subdomain classification, bounded contexts, context map and ubiquitous-language glossary - for complex business domains. Use when splitting a domain or monolith by boundaries, aligning team ownership with contexts, or when the user says "bounded contexts", "subdomains", "context map" or "strategic DDD". |
| [`design-architecture`](skills/design-architecture/SKILL.md) | Phase 3 of greenfield DDD design. Interviews the owner to decide how the system materializes the approved domain model (APIs, events, integrations, databases, cross-cutting concerns) and writes docs/design/3-architecture.md plus one ADR per structural decision. Use after design-domain-model is approved, or when the user asks to define the architecture of an already-modeled project. |
| [`design-business-discovery`](skills/design-business-discovery/SKILL.md) | Phase 1 of greenfield DDD design. Interviews the product owner, one question at a time, to understand the business before any technical decision (goals, processes, rules, domain experts, ubiquitous language) and writes docs/design/1-business-vision.md. Use when starting the design of a new project, or when the user says "business vision", "understand the domain first", "start the design", or wants to redo Phase 1. |
| [`design-domain-model`](skills/design-domain-model/SKILL.md) | Phase 2 of greenfield DDD design. Turns the approved business vision into a domain model (bounded contexts, entities, value objects, aggregates, domain events) still without technology, interviewing one question at a time, and writes docs/design/2-domain-model.md. Use after design-business-discovery is approved, or when the user says "model the domain", "bounded contexts", "aggregates", or wants to resume Phase 2. |
| [`design-implementation-plan`](skills/design-implementation-plan/SKILL.md) | Phase 4 of greenfield DDD design. Interviews the owner to turn the approved architecture into a build plan (scaffold, stack traced to ADRs, minimum pipeline) and a backlog of vertical changes ordered by risk and value, written to docs/design/4-implementation-plan.md. Use after design-architecture is approved, or when the user asks to plan the implementation or build the change backlog of a project whose Phases 1-3 are approved. |
<!-- catalog:end -->
