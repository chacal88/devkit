---
name: ddd-strategic-design
description: Designs DDD strategic artifacts - subdomain classification, bounded contexts, context map and ubiquitous-language glossary - for complex business domains. Use when splitting a domain or monolith by boundaries, aligning team ownership with contexts, or when the user says "bounded contexts", "subdomains", "context map" or "strategic DDD".
---

# DDD Strategic Design

## The slice

Run by `/devkit project`, the action names the slice. Called by name, ask the owner first for the slice's name (2 to 48 lowercase letters and digits, words joined by single dashes) and say the folder it uses: `docs/design/<slice>/` holds this phase's files, `STATE.md` included, and every path below is inside it.

- A flat `docs/design/` and other slices' folders are read as context, never edited.
- When the owner agrees this phase does not apply to this slice, the document says so and why, and the phase ends there.
- Alone, write nothing to `openspec/roadmap.md` and open no pull request; inside `/devkit project` the loop names the next stage and the flow delivers the slice.

## Use this skill when

- Defining core, supporting, and generic subdomains.
- Splitting a monolith or service landscape by domain boundaries.
- Aligning teams and ownership with bounded contexts.
- Building a shared ubiquitous language with domain experts.

## Do not use this skill when

- The domain model is stable and already well bounded.
- You need tactical code patterns only.
- The task is purely infrastructure or UI oriented.

## Instructions

1. Extract domain capabilities and classify subdomains.
2. Define bounded contexts around consistency and ownership.
3. Establish a ubiquitous language glossary and anti-terms.
4. Capture context boundaries in ADRs before implementation.

If detailed templates are needed, open `references/strategic-design-template.md`.

## Where the artifacts go

Called alone, it writes `docs/design/<slice>/strategic-design.md`. In phase 2 of the design its artifacts go into `2-domain-model.md` of the same folder.

## Required artifacts

- Subdomain classification table
- Bounded context catalog
- Glossary with canonical terms
- Boundary decisions with rationale

## Examples

```text
Use the ddd-strategic-design skill to map our commerce domain into bounded contexts,
classify subdomains, and propose team ownership.
```

## Limitations

- This skill does not produce executable code.
- It cannot infer business truth without stakeholder input.
- It should be followed by tactical design before implementation.
