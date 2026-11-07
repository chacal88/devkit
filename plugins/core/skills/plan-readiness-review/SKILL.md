---
name: plan-readiness-review
description: Reviews a planned change package (proposal, design, specs, tasks) for implementation readiness and emits APPROVED, NEEDS-REVISION or BLOCKED, stopping ambiguous work before coding starts. Works on OpenSpec changes or docs/changes/<id>/. Use when the user says "is it ready to implement?", "review the plan", "readiness review", "can we start coding?", or before breaking a change into issues or branches.
---

# Plan readiness review

Run after the planning artifacts exist and before implementation starts. The question it answers: can a developer implement the next phase without asking questions that change behavior or scope?

## When to use (and when not)

**Use to:**

- decide whether a change package is ready to implement;
- check consistency across `proposal.md`, `design.md`, `specs/**/*.md`, `tasks.md` and support docs;
- gate a package before turning it into issues or branches;
- catch weak acceptance criteria and decisions hidden inside vague tasks.

**Don't use to:**

- review the whole repository or propose refactors outside the package;
- expand scope beyond the package;
- demand a PRD or Tech Spec the package doesn't reference;
- rewrite the package (unless explicitly asked). This review reports; the author (usually the change-planner agent) fixes.

## Locate the package

Detect the layout:

- **OpenSpec** (an `openspec/` directory or the `openspec` CLI): `<change-root>` = `openspec/changes/<id>/`; capability specs in `openspec/specs/<capability>/spec.md`.
- **Otherwise**: `<change-root>` = `docs/changes/<id>/` (or wherever the project's existing changes live; look before assuming); canonical specs usually in `docs/specs/`.

If the package can't be resolved with confidence, stop and ask for the id or path.

## Load the artifacts

Required set:

- `<change-root>/proposal.md`, `design.md`, `tasks.md`, `specs/**/*.md`.

Load when present (they can constrain the package):

- `<change-root>/support/*.md`, and a prior `planning-review.md` if re-reviewing;
- change metadata, roadmap or current-state files (`metadata.md`, `roadmap.md`, `current-state.md`, `.openspec.yaml`) when the project uses them;
- the existing spec of every capability the proposal modifies;
- the project's ADRs (usually `docs/adr/` or `docs/decisions/`) the change touches, and any planning rules they set;
- relevant architecture/system docs and runbooks when the change touches that system or its operation;
- a PRD or Tech Spec **only** if the package references it as input.

OpenSpec: validate first with `openspec validate <id> --type change --strict --no-interactive` (or `openspec validate <id> --strict` if the CLI lacks those flags). Otherwise, do the structural checks by hand.

## Core rules

- Don't expand scope; don't suggest project-wide changes unless the package changes a shared standard.
- Don't assume behavior that isn't written. Missing is missing; don't invent details.
- Every conclusion cites an artifact or is labeled a hypothesis. Generic feedback is invalid.
- Prefer repository constraints and specs over personal preference.
- Support docs are evidence, but any behavior needed to implement must be in specs or tasks.

## Process

### 1. Resolve the package

Change id; paths of proposal, design, tasks, specs; support docs; existing specs modified; referenced docs/ADRs/runbooks; stage reached (planning, ready-for-breakdown, ready-for-implementation, in-execution, needs-rework).

### 2. Validate the scope

What problem is solved; is in-scope and out-of-scope explicit; do specs add behavior the proposal doesn't justify; does the design commit to things absent from specs/tasks; do support docs add scope; do open decisions leave scope, sequencing or ownership ambiguous. Classify: `correct` · `incomplete` · `inflated` · `ambiguous`.

### 3. Review the proposal

Problem and goal clarity; affected capabilities listed, new vs modified correct; impact explicit across systems, data, operations, tests, rollout; non-goals tight enough to stop scope creep; risks and constraints visible somewhere in the package.

### 4. Review the design

Matches proposal scope; respects constraints from ADRs, system docs and existing specs; data model and contracts at the right level; input/output behavior; validation and error handling; rollout, migration, monitoring, rollback; privacy, auth, permissions, operational constraints when relevant; alternatives and trade-offs for major choices; open questions don't block the next phase or are assigned to discovery tasks.

If the project uses metadata, roadmap or current-state artifacts (or its ADRs require them), check them here: type and scope consistent with the package, dependencies and blockers documented, roadmap phases with deliverables and acceptance criteria, current-state checks that separate confirmed / inferred / unknown, unknowns turned into discovery tasks or blockers. If the project doesn't use them, note it and move on.

### 5. Verify claims about internals against live code

Mandatory before the verdict. For every claim in the proposal or design about the repo's own internals (a function's shape or return value, a state field, a schema key, a CLI contract, which modules write what), open the code with Read/Grep and re-derive it. Reading the plan is not verification.

- **Anchored claims** (`path:line`): confirm the code at that line says what the plan says.
- **Unanchored claims**: locate the code yourself; a claim you can't ground is a finding.
- **Generalizations** ("every X does Y", "always populated"): enumerate the whole set and check every member. A generalization that fails for one member is `Critical` even when each cited fact checks out.

### 6. Review the specs

Normative language (`SHALL`/`MUST`) where appropriate; every requirement has testable WHEN/THEN scenarios (OpenSpec uses `#### Scenario:`; follow the project's format); modified capabilities carry full requirement deltas, not vague references; edge cases, failure, idempotency, rollout, compatibility covered when relevant; specs align with proposal and design; no requirement lives only in support docs.

### 7. Review the tasks

Executable and ordered by dependency; `- [ ]` checkboxes; small enough to map to issues; dependencies explicit or obvious; acceptance criteria specific and testable; no decision hidden behind "define", "handle", "support" without an expected output; every task path falls under a real directory of the repo.

If the workflow fills issue references into `tasks.md` (e.g. an `**Issue:**` line with a placeholder until sync), a placeholder is not a failure by itself; it is one only when the package claims sync already happened or execution depends on it.

### 8. Detect omissions

Check explicitly for missing definitions of: validation · error handling · retries · permissions/authorization · side effects · observability · rollback · data consistency · idempotency · acceptance criteria · migration/backfill · feature flags/rollout gating · compatibility with legacy records/contracts · test strategy and evidence expectations.

### 9. Execution-readiness test

List the missing decisions, undefined behaviors, vague terms, unclear dependencies, implementation choices that would vary between developers, and open questions (blocking the next phase vs safely assigned to discovery). **More than 3 major doubts for the next phase → not ready.**

### 10. Simulate the implementation

Walk the real workflow: what a developer does first, which artifact they consult next, where interpretation diverges, where it fails in production. Then list the **top 5 likely production failures**, each with cause, impact, prevention, grounded in this package, not generic risks.

### 11. False-completeness check

Look for artifacts that look complete but are weak: sections that name decisions without defining them; actionable-looking tasks hiding missing contracts; acceptance criteria that sound complete but aren't testable; rollout/rollback placeholders; detailed support docs disconnected from specs/tasks; constraints listed but not applied.

### 12. Mandatory questions

Answer every one explicitly:

1. Is the problem objectively defined?
2. Is the result measurable?
3. Are error behaviors defined?
4. Are edge cases covered?
5. Are dependencies clear?
6. Are contracts defined?
7. Can two developers interpret this differently?
8. Are any decisions implicit instead of written?
9. Do the tasks fully deliver the intended outcome?
10. What will be discovered too late if implementation starts now?

### 13. Classify and decide

Every finding carries a **severity** and a **fix class**:

- Severity: `Critical` (blocks implementation or likely production failure) · `High` (high chance of wrong implementation) · `Medium` (weakens definition, rework risk) · `Low` (minor clarity).
- Fix class: `Mandatory before implementation` · `Fix during implementation` · `Nice to have` · `Out of scope`.

Then apply the decision gate below and write the report.

## Evidence standard

Every finding states: severity, fix class, exact artifact reference, why it matters operationally, and the smallest correction that fixes it without expanding scope.

- Bad: "could be improved", "consider clarifying", "in general".
- Good: "Critical, Mandatory before implementation, `<change-root>/tasks.md` task 3.2 says `define idempotency keys` but no artifact says whether webhook replay is keyed by provider event ID, message ID or a generated correlation ID. Two developers can implement incompatible dedup. Smallest correction: add the dedup-key hierarchy to `design.md` and a spec scenario."

## Decision gate

**Missing artifacts → `BLOCKED`:** no change package; no `proposal.md`; no `tasks.md`; no `design.md` on a cross-cutting, architectural, data-model, migration or multi-service change; no spec for a listed capability, or a modified capability without its delta; an artifact the package references as input is missing; a metadata/roadmap/current-state artifact that the project's own rules require is missing or too vague. Don't block just because there is no PRD or Tech Spec the package never referenced.

**`BLOCKED`** also when: the package fails validation; behavior is ambiguous in a way that changes implementation; a high-risk execution gap is unaddressed; tasks are incomplete, vague or not executable for the next phase.

**`NEEDS-REVISION`** when: the package is mostly coherent; remaining issues are narrow and explicitly fixable; the path stays clear after the fixes; fixes fit without changing scope.

**`APPROVED`** only when: no material ambiguity; no critical execution risk; a clear path for the next phase; the package is valid and executable.

Never `APPROVED` with any open `Mandatory before implementation` finding, or with an empty or trivially broad scope; the ceiling then is `NEEDS-REVISION`.

## Output

Return the report in chat using [templates/report.md](templates/report.md) verbatim (sections and order). The verdict line is parseable and stays exactly:

```
Status: APPROVED | NEEDS-REVISION | BLOCKED
```

Persist only when the user asks: write `<change-root>/planning-review.md` and nothing else. Never write review results into an evidence file reserved for execution proof.

## Never

- Edit the package or fix artifacts yourself.
- Approve with an open mandatory fix, or approve a package whose internal claims you didn't verify against code.
- Silently route around an ADR the package contradicts: name the conflict and escalate to the human.
- Redesign a package that steps outside its approved scope: record it and escalate.
- Guess the package when it can't be resolved: ask.

## Related

- Agents: `change-planner` (authors the package), `plan-reality-auditor` (deeper check of plan claims against the codebase), `adr-reviewer`, `spec-reviewer`, `codebase-researcher` (facts before deciding).
- Skills: `requirements-grill` (before planning), `review-change` (after implementation).
