---
name: requirements-grill
description: Adversarial requirements interview before any spec or code. Classifies the change, then grills the owner one question at a time on scope, end effect, edges and conflict with project rules, and returns assumptions plus observable acceptance criteria. Default-on; skipped when the owner says so. Use at the start of a new change or feature, when exploring an idea, or when the user says "grill me", "brainstorm this", "let's think this through".
---

# Requirements grill

Extract the doubt the owner didn't know they had, before planning spends tokens on the wrong thing. The questions are not generic: they come from the project's own rules (ADRs, Definition of Done, inviolable rules) confronted with the request.

## When to use (and when not)

- **Use** as the first step of any new change, before writing a proposal or spec. Default-on: run it without asking "want a grill?".
- **Skip** when the owner opts out in natural language ("no brainstorm", "skip this", "just do it"). Honor it for this change, don't ask again, go straight to planning.
- **Calibrate** to complexity: a trivial, reversible change gets a few questions; a broad, irreversible, architectural or contract change gets grilled deeper. Never an endless interrogation.

## Process

### 1. Classify the change

Classify `{ domain, type, flags[] }` so you know what to grill against and which reviewers will later be summoned (see the review-change skill).

- **Already classified?** If the change package declares it and the owner confirmed it, reuse it.
- **Domain:** by where the work touches. If the project declares domains (by path, in its CLAUDE.md or config), take the first match; mechanism-only paths (docs, scripts, config) are `process`; no declared domains → `product`. Mixed → the strictest touched.
- **Type:** "doesn't work / Y instead of Z" → `bug`; data or schema migration → `migration`; otherwise `feature` (or the project's own types).
- **Flags** (all that apply): UI changes → `ui`; structure, responsibility or boundary changes → `architecture`; contract between modules changes → `contract`; validation needs a real external resource (third-party service, hardware) → name it.
- **Ambiguous → the strictest track**, marked `strict-assumed`, and confirm it with the owner during the grill. Never default to the weakest.

### 2. Gather the ammunition

Read, to the depth the request needs:

- the project's ADRs the change touches (usually `docs/adr/` or `docs/decisions/`);
- the project's Definition of Done and inviolable rules (CLAUDE.md, CONTRIBUTING, docs), if declared;
- the existing specs of the affected capability;
- for a change that touches an external resource, its protocol and known limits.

If the project declares none of this, use the ADRs that exist and the code itself. When useful, the codebase-researcher agent can gather facts first.

### 3. Grill on the four axes

Ask with **AskUserQuestion**, **one line of reasoning at a time**: follow the thread the previous answer opens, not a fixed questionnaire. Every question derives from the ammunition; a question in a vacuum is not actionable, don't ask it.

- **Scope:** what is in and what is out? What is the owner *not* asking for that someone might assume?
- **End effect:** what is the observable state of "done"? Not "returns 200": the real effect in the world ("the cancelled appointment frees the slot for a new booking").
- **Edges:** empty, error, concurrency, large volume. Performance is often a gate; ask.
- **Conflict with project rules:** "rule X (ADR NNN) says Y. Does the request respect it, or do you want an explicit, recorded exception?"

### 4. Classify each doubt as it resolves

- **Critical** (changes what is delivered) → keep asking until resolved; the resolution becomes an **acceptance criterion**.
- **Small or reversible** → don't block; record it as an **assumption** the owner can correct.
- **Collides with an ADR or inviolable rule, or reveals scope beyond what was asked** → don't decide it; record it as an escalation for the human.

### 5. Make assumptions literal

Before closing, re-read every assumption that names a file path, a config/JSON/YAML field, a function, a CLI flag or a state key. Rewrite it in the exact form an implementer would type: path from the repo root, full nesting with the parent named, `file#function`, the verbatim flag. A dotted shorthand like `outputs.summary` is never literal (nested key, a key literally named that, or a sibling?). If the owner's answers genuinely don't settle it, mark it: `AMBIGUOUS: (a) <reading> | (b) <reading>; the planner resolves`. Flag only what another question wouldn't answer.

### 6. Converge and return

When critical doubts are resolved and small ones are assumptions, stop and return the output. Don't write the spec and don't implement: the change-planner agent takes it from here.

## Output

The grill's language follows the project's (questions, assumptions and criteria are prose); headings below stay as is.

```
## Requirements grill: <change slug>

Classification: domain=<..> type=<..> flags=[..] (<confirmed | strict-assumed>)

**Assumptions (correct me if wrong):**
- <assumption, in literal form>

**Acceptance criteria (observable effect of done):**
- `<kebab-id>` — <criterion>

**Questions asked:**
1. [scope | end effect | edges | project rules] <question> → <answer, summarized>

**Escalations:**
- REQUIRES HUMAN DECISION — <collision with ADR NNN / scope beyond the request>
```

Each acceptance criterion gets a stable kebab-case id (from its first words) so later plan revisions and evidence can refer to it even if the prose is reworded.

On opt-out, return one line: `Requirements grill skipped (owner opt-out): <reason>.`

If there is an escalation, don't proceed to planning on your own: present it and wait for the owner.

## Never

- Implement, write the spec, or edit any file. This skill only extracts requirements.
- Fire generic questions, or a batch of questions at once.
- Grant an exception to an ADR or inviolable rule yourself.
- Ask again after the owner opted out.
- Write an acceptance criterion with no observable effect (`success: true`).

## Related

- Agents: `codebase-researcher` (facts before grilling), `change-planner` (consumes assumptions and criteria).
- Skills: `plan-readiness-review` (gates the plan that follows), `review-change` (uses the flags to pick reviewers).
