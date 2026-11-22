<!-- devkit-stage requirements result=passed attempt=1 commit=2300f84524e5c1ec5ed8a0da41e5a5dccff9cc34 -->
# Requirements

## Request

> the four design phases as the `devkit-project` flow, with a fifth stage that writes or appends to `openspec/roadmap.md`, started by `/devkit project` (D-7)

Classification: domain=process type=feature flags=[architecture, contract] (strict-assumed: a new schema and a new `/devkit` verb, and `openspec/roadmap.md` is a contract read by `/devkit roadmap`).

## Assumptions

<!-- Each confirmed by the owner. Literal paths, fields, names. -->
- Each slice's phase documents end up in `docs/design/<slice>/`, one folder per slice, so an ongoing project can run the flow many times without one slice overwriting another; ADRs stay in `docs/adr/` (owner, grill question 1).
- Any of the four phases may be marked not applicable during the conversation, with the reason; its file stays and says so and why, as the mockup stage does in a change with no screen (owner, grill question 2).
- The fifth stage shows the owner the proposed rounds and changes (each with its id, description and `after:`), the owner approves or adjusts them, and only then does it write them to `openspec/roadmap.md`, appending when the file exists; the flow then stops and names `/devkit roadmap` as the next step, without starting it (owner, grill question 3).
- The slice's documents, its new ADRs and the appended rounds reach `main` in one pull request at the end of the flow, after a light review: the ADR reviewer checks the new ADRs against the existing ones; with its approval the pull request merges by itself (auto-merge) once the checks pass. The owner's approval of each phase stays the gate on the content (owner, grill question 4).
- The phases' conversation happens in the session where the owner typed `/devkit project <slice>`, working in a worktree named after the slice; typing `/devkit project <slice>` again after the session stops resumes from where it stopped (owner, grill question 5).
- A project that already has the flat `docs/design/` layout of today (`docs/design/1-business-vision.md` to `docs/design/4-implementation-plan.md` and `docs/design/STATE.md`) keeps it untouched; the new slice goes to `docs/design/<slice>/`, and its phases may read the old design as context (owner, grill question 6).
- The five `devkit-design` skills (`design-business-discovery`, `design-domain-model`, `design-architecture`, `design-implementation-plan`, `ddd-strategic-design`) can still be called by name outside `/devkit project`; called that way they ask for the slice and write to `docs/design/<slice>/` as the flow does, but write no roadmap and open no pull request (owner, grill question 7).
- A slice may end with no new change for the roadmap (a research slice that concludes not to build now): the fifth stage is then not applicable, with its reason, `openspec/roadmap.md` does not change, and the pull request carries only the slice's documents (owner, grill question 8).
- This change proves the flow with a scripted run of the five stages in a scratch project, written answers standing in for the owner's; the first real slice in one of the owner's projects is the dogfood, recorded as the follow-up of a next change (owner, grill question 9).
- The names and the file layout inside `docs/design/<slice>/` (whether the four documents keep today's names `1-business-vision.md`, `2-domain-model.md`, `3-architecture.md`, `4-implementation-plan.md`), where the per-slice progress lives, and how the `devkit-reviews` check learns the `devkit-project` script's light review are the planner's, within the assumptions above.

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
Each criterion says whether it is proven in this change (scripted run in a scratch project, or a test) or left to the dogfood of the first real slice.

- AC-1 `project-verb-starts-and-resumes` — `/devkit project <slice>` no longer answers "not built yet": in the session where it is typed it opens the slice in a worktree named after the slice and starts the first phase's conversation; typed again after the session stops, it resumes at the stage where it stopped. Proven here.
- AC-2 `five-stages-readout` — the `devkit-project` schema is installed into a project by `openspec-setup` beside `devkit` and `devkit-lite`, and the stage readout of a slice lists five stages (business, domain model, architecture, implementation plan, roadmap), each as passed, not applicable, ready or blocked. Proven here.
- AC-3 `phase-document-per-slice` — each phase writes its document under `docs/design/<slice>/` and the architecture phase writes its ADRs to `docs/adr/`; a phase passes only with the owner's explicit approval, and the next stage stays blocked until it does. Proven here for the files and the order; the quality of each phase's conversation is the dogfood.
- AC-4 `phase-not-applicable` — a phase marked not applicable leaves its file with its reason, and the next stage becomes ready. Proven here.
- AC-5 `roadmap-written-after-approval` — the fifth stage shows the proposed rounds and changes and writes nothing to `openspec/roadmap.md` before the owner approves; after approval it appends them after the existing content, leaving every existing line unchanged, or creates the file when it is absent; `/devkit roadmap` reads the new rounds and their `after:` dependencies; the flow stops naming `/devkit roadmap` and does not start it. Proven here.
- AC-6 `roadmap-not-applicable` — when the fifth stage is not applicable, its file holds the reason and `openspec/roadmap.md` is byte for byte what it was before the slice. Proven here.
- AC-7 `one-pr-with-adr-review` — the slice ends in one pull request holding its documents, its new ADRs and the roadmap rounds; the ADR reviewer's verdict on the new ADRs is the only review it needs; the project's required checks pass on it, and auto-merge is enabled on it. Proven here on a scratch repository.
- AC-8 `flat-design-untouched` — in a project with the flat `docs/design/` layout, running a slice leaves every existing file under `docs/design/` (outside `docs/design/<slice>/`) byte for byte unchanged. Proven here.
- AC-9 `skills-work-alone` — each of the five `devkit-design` skills, called by name outside `/devkit project`, asks for the slice and writes under `docs/design/<slice>/`, writes nothing to `openspec/roadmap.md` and opens no pull request. Proven here.

## Out of scope

- Starting `/devkit roadmap` from the flow: it only names it.
- A short variant of the project flow, and a developer writing `openspec/roadmap.md` directly (already allowed, decided on 2026-11-19).
- Moving or rewriting an existing flat `docs/design/`.
- Rewriting the interviews of the four phases beyond what the flow needs (the slice folder, the stage header, not applicable).
- The first real slice in one of the owner's projects: the dogfood of a next change.
- The CompozyOS and script drivers (rounds 21 and 22).

## Questions asked

1. [scope] Where are a slice's documents found once its phases end? → `docs/design/<slice>/`, one folder per slice.
2. [scope] In a slice of an ongoing project, do all four phases always run? → A phase may be marked not applicable, with its reason, during the conversation.
3. [end effect] What does the fifth stage do with the roadmap? → Shows the proposed rounds, the owner approves or adjusts, it writes them, and the flow stops naming `/devkit roadmap`.
4. [project rules] How do the documents and the roadmap reach `main`? → One pull request at the end, after a light review by the ADR reviewer, then auto-merge.
5. [scope] Where does the phases' conversation happen? → In the session where the owner typed the command, in a worktree named after the slice; typing it again resumes.
6. [edges] What happens to an existing flat `docs/design/`? → It stays untouched; the new slice goes to its own folder and may read the old design as context.
7. [scope] Do the design skills still work on their own? → Yes; alone they ask for the slice and write to its folder, with no roadmap and no pull request.
8. [edges] Can a slice end with no new change on the roadmap? → Yes: the fifth stage is not applicable with its reason, the roadmap does not change, the pull request carries only the documents.
9. [end effect] How does this change prove the flow works? → A scripted run of the five stages in a scratch project here; the first real slice is the dogfood of a next change.

## Escalations

- None. The project flow's pull request carries only the ADR reviewer's review, by the owner's decision (question 4); this change itself still passes the full review bench.
