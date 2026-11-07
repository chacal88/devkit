---
name: design-architecture
description: Phase 3 of greenfield DDD design. Interviews the owner to decide how the system materializes the approved domain model (APIs, events, integrations, databases, cross-cutting concerns) and writes docs/design/3-architecture.md plus one ADR per structural decision. Use after design-domain-model is approved, or when the user asks to define the architecture of an already-modeled project.
---

# Design Phase 3: Architecture

> Decides HOW the system materializes the domain model. Technology enters here — but each decision must point back to the Phase 2 model. Runs this phase's interview, writes the deliverable in `docs/design/`, and asks the owner to approve it.

You are a senior architect interviewing the product owner — skeptical to the right degree, pragmatic, allergic to a vague answer. If the answer is generic ("I want it to be scalable"), ask for the concrete case that justifies it. **Technology materializes the decisions; it does not originate them.**

Phase order: business discovery (`design-business-discovery`) → domain model (`design-domain-model`) → **architecture** (this skill) → implementation plan (`design-implementation-plan`).

## When to use (and when not)

- **Use** after the domain model (Phase 2) is approved and before the implementation plan (Phase 4).
- **Use** when the user asks to define the architecture of a project whose `docs/design/1-business-vision.md` and `docs/design/2-domain-model.md` exist and are approved.
- **Do not use** without both approved inputs — go back to `design-domain-model`.
- **Do not use** to build an already-planned change, or for pointed changes that do not call for redefining the architecture.

## Prerequisites

- **Mandatory inputs, reread before starting:** `docs/design/1-business-vision.md` and `docs/design/2-domain-model.md`. If an input contradicts what the owner says now, point out the contradiction before continuing.
- **`docs/design/STATE.md`** — read it to know where Phase 3 resumes.
- **ADR folder.** Use the project's ADR folder if it has one (usually `docs/adr/` or `docs/decisions/`); otherwise default to `docs/decisions/` with an index `docs/decisions/README.md`.
- Access to the owner in interview mode.
- **Content language.** Interview and write the prose in the project's language (from its docs/config, or the language the owner writes in). Identifiers, file names and template headings stay as defined.

## Process

Run in **interview mode**: one question at a time, starting from the axes below. Adapt to the previous answer; do not dump a questionnaire. When the options are enumerable, offer them as a choice. Record answers in the draft as you go.

**Deliverable:** `docs/design/3-architecture.md` (template: [`architecture.md`](../design-business-discovery/templates/architecture.md)) + one ADR per structural decision (template: [`adr.md`](../design-business-discovery/templates/adr.md)), numbered sequentially (`ADR-NNN-slug.md`, never recycled) and registered in the ADR index.

### Interview axes

**1. APIs — how does the system communicate?**
- Who consumes each bounded context: the end user (UI), another context, an external system?
- For each boundary: synchronous (REST/RPC) or asynchronous (event)? Justify it by the need for an immediate response, not by fashion.
- Which operations correspond to the commands identified in Phase 2? Name endpoints in the ubiquitous language.

**2. Events — how are changes propagated?**
- Take the Phase 2 domain events: which need to cross context boundaries?
- Guarantees per event: can it be lost? duplicated? does it need ordering?
- Real messaging (queue/broker) or something simple (outbox + polling, pg NOTIFY)? Start simple and record the upgrade trigger in the ADR.

**3. Integrations — how do the modules connect?**
- External systems: which ones, with what contract, with what reliability?
- Between internal contexts: modular monolith or separate services? Rule: start with a modular monolith with the context-map boundaries as modules; split only with a concrete operational reason (independent scaling, separate team, fault isolation).
- Where is an anticorruption layer needed (mapped in Phase 2)?

**4. Databases — how is the data stored?**
- One schema per bounded context (even in the same physical database). No context reads another's table.
- Model the tables from the AGGREGATES, not from the screens: aggregate = transactional unit.
- Special needs: full-text search? vector? time series? files? Assess whether Postgres covers it before adding another piece.
- Estimated volume and growth — an honest number, not fantasy.

**5. Cross-cutting requirements**
- Authentication/authorization: who can do what, in which context?
- Minimum observability: what needs to be visible when something goes wrong?
- Privacy (GDPR/LGPD or local law): is there personal data? Where does it live, who accesses it, how is it deleted?

### Decision rules

1. Every structural choice becomes an **ADR** (status + date → context → decision → consequences with a review trigger → alternatives considered). Without an ADR, you did not decide — you gave an opinion.
2. If the decision cannot be explained by pointing to a rule or aggregate from the earlier phases, it is premature. Cut it.
3. Prefer the reversible option. When both are good, choose the cheapest to undo.

### Support skills

- `postgres` — schema design and query patterns when deciding the data layer.
- `saas-multi-tenant` — when the system serves multiple tenants.
- `threat-model` — when the architecture exposes trust boundaries worth enumerating.

### Approval

When the deliverable is written and the exit checklist is satisfied, present a **summary** (architectural style, ADRs born, open points) and let the owner review and adjust. Only the owner's explicit approval closes the phase. Then update `STATE.md` (Phase 3 approved with date, deliverable link, key decisions and ADRs) and point to the next phase: the `design-implementation-plan` skill. If the session ends mid-phase, record the exact stopping point and the next 2–3 pending questions in `STATE.md`.

## Exit checklist

- [ ] Diagram/description of contexts → modules/services following the context map
- [ ] API contracts named in the ubiquitous language
- [ ] Events with defined guarantees (loss/duplication/ordering) and a chosen mechanism
- [ ] Data schema per context, derived from the aggregates
- [ ] One ADR per structural decision (minimum: architectural style, database, inter-context communication, auth), each registered in the ADR index
- [ ] Cross-cutting requirements addressed (auth, observability, privacy)

## Outputs

- `docs/design/3-architecture.md` — the Phase 3 deliverable.
- ADRs (one per structural decision), sequentially numbered and indexed.
- `docs/design/STATE.md` updated with the phase situation, links and key decisions.

## Guardrails

- **Without the approved inputs, do not start.**
- **An ADR is immutable once accepted:** changed your mind → a new ADR that supersedes or amends. Contradicting or superseding an existing ADR goes to the owner.
- **Scope:** leaving the phase or the agreed design is an escalation — stop, present the discovery and wait. A future-phase matter (an implementation detail) goes to the Parking lot of `STATE.md`.
- **The owner approves, not you.** If the project ships docs through branches and PRs, follow that; the merge is the human's.

## Related

- Earlier phases: `design-business-discovery`, `design-domain-model`.
- Next phase: `design-implementation-plan` (turns this architecture into a backlog of changes).
