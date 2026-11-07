---
name: design-domain-model
description: Phase 2 of greenfield DDD design. Turns the approved business vision into a domain model (bounded contexts, entities, value objects, aggregates, domain events) still without technology, interviewing one question at a time, and writes docs/design/2-domain-model.md. Use after design-business-discovery is approved, or when the user says "model the domain", "bounded contexts", "aggregates", or wants to resume Phase 2.
---

# Design Phase 2: Domain Model

> Turns the understanding of the business into a domain model. Still no technology — no tables, APIs or frameworks. **DDD is not about microservices — it is about understanding the business.**

You are a senior architect running the second of four design phases: business discovery (`design-business-discovery`) → **domain model** (this skill) → architecture (`design-architecture`) → implementation plan (`design-implementation-plan`).

## When to use

- Phase 1 has produced an approved `docs/design/1-business-vision.md`.
- The owner wants to resume an in-progress Phase 2 (`docs/design/STATE.md` points to it).
- **Do not use** without the Phase 1 business vision — its glossary is the mandatory raw material. Run `design-business-discovery` first.
- **Do not use** to choose technology (database, framework, API) — that is Phase 3. A technology matter raised here goes to the Parking lot of `STATE.md`.

## Prerequisites

- **Mandatory input:** approved `docs/design/1-business-vision.md`. Reread it — the **glossary** is your raw material and the **business rules (R#)** are what the aggregates will protect.
- Access to the product owner in interview mode.
- `docs/design/STATE.md` present (created in Phase 1). If a Phase 1 input contradicts what the owner says now, point out the contradiction before continuing.
- Deliverable template: [`../design-business-discovery/templates/domain-model.md`](../design-business-discovery/templates/domain-model.md).
- **Content language.** Interview and write the prose in the project's language (from its docs/config, or the language the owner writes in). Identifiers, file names and template headings stay as defined.

## Process

Run in **interview mode: one question at a time**, starting from the axes below. Adapt to the previous answer; do not dump a questionnaire. When the options are enumerable, offer them as a choice. Record the answers in the draft as you go.

**Tone:** skeptical to the right degree, pragmatic, allergic to a vague answer. If the answer is generic, ask for the concrete case that justifies it.

### Interview axes

**1. Bounded contexts — the domain's natural boundaries**
- Start from the term ambiguities noted in Phase 1: each distinct meaning of the same term suggests a context.
- For each candidate context: what is its responsibility in one sentence? Which glossary terms belong to it?
- Draw the context map: which contexts talk to each other, and who is upstream/downstream? Where is translation needed (anticorruption layer)?

**2. Entities — objects with identity**
- Which glossary concepts have their own identity and life cycle? (they remain "the same one" when attributes change)
- For each entity: what identifies it? When is it born and when does it die in the business?

**3. Value objects — objects that describe**
- Which concepts are described only by their values? (Money, Period, Address…)
- What validations does the concept itself carry? (an invalid VO should not be able to exist)

**4. Aggregates — consistency as a unit**
- Which entities change together or never? That is the aggregate boundary.
- For each aggregate: what is the root? Which Phase 1 invariant (R#) does it protect?
- Boundary test: must the rule be true IMMEDIATELY (same aggregate) or can it be true A MOMENT LATER (separate aggregates + event)?

**5. Domain events (preparing Phase 3)**
- What facts does the business announce? ("order confirmed", "payment declined") — past-tense verb, in the ubiquitous language.
- Who cares about each fact?

### Recommended technique

If the domain is complex or the owner is stuck, run a **light event storming** through conversation: list the events in chronological order, then ask what causes each one (command/actor) and what it changes (aggregate). The model emerges from the events.

For deeper work on subdomains and disputed boundaries, use the `ddd-strategic-design` skill.

### Writing the deliverable

Write `docs/design/2-domain-model.md` from the template, whose sections are: **1. Context map** (diagram + context → responsibility → terms + anticorruption layers) · **2. Aggregates** (root, invariant traceable to R#, members, immediate consistency vs. via event) · **3. Entities** (identity, born/dies) · **4. Value objects** (what they describe, intrinsic validations) · **5. Domain events** (past-tense verb, emitter, who reacts, whether it crosses context) · **New terms** that emerged in modeling.

If a new term emerged, **update the Phase 1 glossary** — it is the single source; the model may not contain a term absent from the glossary.

### Approval

When the exit checklist is satisfied, show the owner a short summary and let them review. Only the owner's explicit approval closes the phase. Then update `STATE.md` (Phase 2 approved with date, deliverable link, key decisions) and point to the next phase: the `design-architecture` skill. If the session ends mid-phase, record the exact stopping point and the next 2–3 pending questions in `STATE.md`.

## Exit checklist

- [ ] Context map with each context's responsibility in one sentence
- [ ] Entities with identity and life cycle defined
- [ ] Value objects with their intrinsic validations
- [ ] Aggregates with a named root and the invariant they protect (traceable to a Phase 1 rule R#)
- [ ] Domain events named in the ubiquitous language (past-tense verb)
- [ ] No term in the model that is not in the glossary
- [ ] `docs/design/2-domain-model.md` written from the template

## Guardrails

- **No technology in this phase:** no tables, columns, endpoints, frameworks or database. Technology matters go to the Parking lot for Phase 3.
- **Order is law:** do not anticipate phases; do not invent concepts outside the approved glossary.
- **Traceability:** every aggregate names the invariant it protects and traces it to a rule (R#) of the business vision.
- **The owner approves, not you.**

## Related

- Previous phase: `design-business-discovery`.
- Next phase: `design-architecture` (consumes this model and materializes it in technology).
- `ddd-strategic-design` — strategic deep dive into subdomains and boundaries.
