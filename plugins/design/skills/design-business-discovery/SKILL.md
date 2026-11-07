---
name: design-business-discovery
description: Phase 1 of greenfield DDD design. Interviews the product owner, one question at a time, to understand the business before any technical decision (goals, processes, rules, domain experts, ubiquitous language) and writes docs/design/1-business-vision.md. Use when starting the design of a new project, or when the user says "business vision", "understand the domain first", "start the design", or wants to redo Phase 1.
---

# Design Phase 1: Business Discovery

> Understands the business before any technical decision. Runs the Phase 1 interview (one question at a time), fills `docs/design/1-business-vision.md`, and asks the owner to approve it before Phase 2. **DDD is not about microservices — it is about understanding the business.** No technology in this phase.

The design runs in four phases, in this order: **business discovery** (this skill) → **domain model** (`design-domain-model`) → **architecture** (`design-architecture`) → **implementation plan** (`design-implementation-plan`). Each phase consumes the previous phase's approved deliverable.

## When to use (and when not)

- **Use** when starting a new project (no business deliverable yet) or when resuming an in-progress Phase 1 (`docs/design/STATE.md` points to the Business phase).
- **Do not use** for the later phases — each has its own skill.
- **Do not use** to build an already-planned change, or for pointed changes in an existing system that do not call for redefining the architecture.

## Prerequisites

- **Output folder.** Deliverables go in `docs/design/` (default). If the project already has a design-docs folder, use it and keep the file names.
- **`docs/design/STATE.md`.** The single source of the design's state. If it does not exist, create it from [`templates/STATE.md`](templates/STATE.md) with the project name and one sentence about it.
- **Access to the owner in interview mode.** Phase 1 does not work without the product owner answering — the domain drives the decisions; technology (in later phases) materializes them.
- **Deliverable template:** [`templates/business-vision.md`](templates/business-vision.md).
- **Content language.** Conduct the interview and write the prose in the project's language (from its docs/config, or the language the owner writes in). Identifiers, file names and template headings stay as defined; only the prose changes.

## Process

1. **Locate the state.** Read `docs/design/STATE.md`. If Phase 1 is already approved, do not redo it without an explicit request. If it is in progress, say in one sentence where it stopped ("Exact stopping point", "Next pending questions") and resume from there, without repeating what was answered.

2. **Run the interview — one question at a time.** Walk the five axes below IN THIS order, going deeper as answers come in. Adapt to the previous answer; do not dump a questionnaire. When the options are enumerable, offer them as a choice. Record each answer in the draft deliverable as you go.

   ### Axis 1. Goals — what does the business need to achieve?
   - What problem does this project solve, and for whom?
   - How will we know it worked? (an observable metric or event, not "success")
   - What happens if the project is NOT done?
   - What is the scope of the first version that already delivers value?

   ### Axis 2. Processes — how is the work done?
   - Describe the end-to-end process TODAY (without the system). Who does what, in what order?
   - Where does the process get stuck, repeat itself or depend on heroics?
   - Which steps will the system absorb, and which remain human?

   ### Axis 3. Rules — what are the rules of the game?
   - Which rules can never be violated? (business invariants)
   - Which rules have exceptions, and who authorizes the exception?
   - Are there deadlines, limits, calculations or validations imposed by law/contract?

   ### Axis 4. Domain experts — who really understands the business?
   - Who answers the questions when no one else knows? (name/role)
   - Is that expert accessible during the project?
   - Where do experts disagree with each other? (a classic signal of distinct bounded contexts — note it for Phase 2)

   ### Axis 5. Ubiquitous language — what is the language of the domain?
   - List the terms the business uses (nouns and verbs). Define each one in the expert's own sentence.
   - Are there terms with different meanings in different areas? (note it — it becomes a context boundary in Phase 2)
   - Are there synonyms that should be unified? Choose ONE canonical term per concept.

3. **Interview tone.** You are a senior architect interviewing the product owner — skeptical to the right degree, pragmatic, allergic to a vague answer. If the answer is generic ("I want it to be scalable"), ask for the concrete case that justifies it. If the owner jumps to a future-phase matter (database, framework, Kubernetes), note it under "Parking lot" in `STATE.md` and return to Phase 1.

4. **Write the deliverable** in `docs/design/1-business-vision.md` from the template. Its five sections map one-to-one onto the five axes: 1 Goals (problem, observable success criterion, cost of not doing it, first-version scope, explicit out of scope) · 2 Processes (current without the system / future with it) · 3 Rules of the game (invariants with origin × rules with exception and who authorizes) · 4 Domain experts (name/role × area × accessibility, plus divergences that are candidate context boundaries) · 5 Ubiquitous-language glossary (canonical term × definition in the expert's sentence × absorbed synonyms × cross-area ambiguity).

5. **Check the exit checklist.** While any item is open, go back to the corresponding axis.

6. **Ask for approval.** Show the owner a short summary of the deliverable (not the whole document) and let them review and adjust. Only the owner's explicit approval closes the phase. Then update `STATE.md` (Phase 1 approved with date, deliverable link, key decisions, terms/divergences parked for Phase 2) and point to the next phase: the `design-domain-model` skill.

7. **Session ends mid-phase.** Update `STATE.md` with the exact stopping point and the next 2–3 pending questions so the next run resumes without losing context.

## Exit checklist

- [ ] Goal with an observable success criterion
- [ ] End-to-end process described (current and future)
- [ ] Invariant rules separated from rules with exceptions
- [ ] Experts named and accessibility confirmed
- [ ] Ubiquitous-language glossary with at least the 10 core terms, one canonical per concept
- [ ] Cross-area term ambiguities noted for Phase 2

## Outputs

- `docs/design/1-business-vision.md` — the five axes filled in.
- `docs/design/STATE.md` — Phase 1 situation, deliverable link, key decisions, Parking lot.

## Guardrails

- **No technology in this phase.** Technical matters go to the Parking lot, not into the business deliverable.
- **Order is law.** Do not jump ahead to a future-phase decision.
- **The owner approves, not you.** Do not mark the phase approved without the owner's explicit yes.
- If the project ships docs through branches and PRs, follow that; the merge is the human's.

## Related

- Next phase: `design-domain-model` (consumes this glossary, the R# rules, and the parked ambiguities).
- `ddd-strategic-design` — deeper subdomain and boundary work when the domain is large.
