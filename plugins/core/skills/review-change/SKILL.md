---
name: review-change
description: Pre-ship review gate. Picks the reviewer agents a change needs from what its diff touches, dispatches them in parallel, aggregates their verdicts and decides by consensus (any blocking finding rejects). Use after writing a plan, before committing or opening a PR, or when the user says "review this change", "review the diff", "audit before ship", "gate this".
---

# Review a change

Orchestrates a bench of isolated reviewer agents against a change and decides PASS/FAIL by consensus. This skill does not judge: each reviewer emits its own verdict in its own context; the skill picks who to summon, dispatches, collects and aggregates.

## When to use (and when not)

- **Use** after a plan is written (gate it before implementing), before committing implementation code, or whenever the user asks to review, audit or gate a change.
- **Don't use** to fix findings. This skill reports; the author or the user fixes.
- **Don't use** as a substitute for the human merge. Approving here merges nothing, in any ship mode.

## Input

One of:

- a change id, with artifacts in `openspec/changes/<id>/` (OpenSpec repos) or `docs/changes/<id>/` (or wherever the project keeps change packages);
  - optionally a **scoped call** from a coordinating skill: only the named reviewers, each with its previous verdict file and the range `<its Commit>..HEAD`, at a stated round. See "Scoped calls" below;
- `--diff`: the uncommitted work (`git diff` + `git diff --cached`), or the branch diff against its base (`git diff <base>...HEAD`).

If the target can't be resolved, stop and ask.

## Cost

Reviewers are the most expensive step of a change. Summon only the reviewers the matrix selects: a small diff that touches no contract, auth, ADR area or spec gets `code-quality-reviewer` and `test-coverage-reviewer` only. Never re-run a reviewer that already approved the current diff: a review is current when its `Commit:` line (the second line of its verdict file) names the commit being shipped, or an ancestor of it with only `openspec/` changes since.

## Process

### 1. Capture the surface

Run the diff for the target and list what it touches: files, modules/packages, contracts (routes, events, shared schemas, public types), auth/crypto/config/secrets, tests, docs/specs, ADRs. For a change id with no code yet, the surface is the plan artifacts.

### 2. Structural check first

Before any judgment, do the mechanical checks yourself:

- OpenSpec repo with a change id: `openspec validate <id> --strict` (add `--type change --no-interactive` when the CLI supports them).
- Internal markdown links in the changed docs resolve; task paths in `tasks.md` point to directories that exist in the repo (discover the layout, don't assume one).
- OpenSpec spec deltas: every `### Requirement:` has WHEN/THEN scenarios.

If the structural check fails, report it with the blocking findings and **don't dispatch reviewers**. Fix and run again.

### 3. Pick the bench by surface

Summon only reviewers that add value; each subagent is expensive.

| Reviewer agent | Summon when |
|---|---|
| `adr-reviewer` | **Always** when the project has ADRs (usually `docs/adr/` or `docs/decisions/`) |
| `spec-reviewer` | **Always** when the project has canonical specs (`openspec/specs/`, `docs/specs/`) or the change has a spec delta |
| `code-quality-reviewer` | There is a code diff |
| `test-coverage-reviewer` | There is a code diff; double focus when it touches business logic, validation, auth or a cross-process flow |
| `security-reviewer` | The diff touches auth/authz, sensitive data, credentials or secrets, per-tenant queries, crypto, or security-relevant config. Removed lines count as much as added ones (a deleted authz check is a finding) |
| `architecture-reviewer` | The diff creates a new module/package/home, changes a contract (route, event, shared schema, public type) or crosses a layer boundary |

Performance has no dedicated reviewer: when the diff touches a hot path, a UI render path, a migration, or claims an optimization, tell `code-quality-reviewer` to focus on it (N+1, pagination, unbounded queries).

If the project declares its own review matrix (in its CLAUDE.md, CONTRIBUTING or review config), it wins over this table.

### 4. Dispatch in parallel

Fire **all** selected reviewers in a **single message**, one `Agent` call per reviewer. Never sequentially: parallel dispatch keeps each judgment independent and out of the main context.

Each prompt carries:

- the target: the change id and its artifact paths, or "the current diff, via `git diff` / `git diff --cached`" (or the base..HEAD range);
- the change package when it exists (proposal, design, tasks, acceptance criteria) and the project's Definition of Done if declared;
- where the project keeps its ADRs/specs (for `adr-reviewer` and `spec-reviewer`);
- the instruction to emit **one** verdict in the reviewer's own output format, with `file:line` evidence.

### 5. Adversarial posture

Reviewers refute; they don't confirm. A generic approval ("LGTM", "looks good") is an invalid verdict and goes back for re-emission. Push-back on a finding is valid only with technical evidence (code, test or output that disproves it). `code-quality-reviewer` and `architecture-reviewer` name at least one good point, to avoid hunt-only bias.

### 6. Normalize and decide by consensus

Read each reviewer's verdict line and normalize it:

- `Status: APPROVED` / `verdict: approved` / `Coverage verdict: PASS` → PASS.
- `NEEDS-REVISION`, `BLOCKED`, `rejected`, `vetoed`, `Coverage verdict: FAIL` → FAIL.
- Any open `blocking` finding, or an `important` one without an evidence-backed rebuttal → FAIL, whatever the verdict line says. `nit` and `praise` never block.
- A reviewer that declines for lack of surface (e.g. security with nothing security-relevant) → non-blocking.

**Consensus rule:** every non-declined reviewer PASS → PASS. **Any** FAIL → the change is rejected.

Rounds:

- Rounds count reject-and-fix cycles, nothing else. A call made only because reviewers' `Commit:` lines went stale (after a CI fix, an evidence fix, an answered comment) starts at round 1 and consumes no round budget.
- Round 1 FAIL → list the blockers; the author fixes; round 2 re-summons **only** the reviewers that failed, each with its previous verdict, to check **only** those findings and the lines changed since (see each reviewer's Budget section).
- Only `blocking` findings, and `important` ones without a rebuttal, trigger a round. `nit` and follow-up items go into the report and never cause a re-review.
- No convergence after 2 rounds → stop and escalate to the human with the disputed points. No automatic third round.
- A finding that contradicts an ADR is never routed around: it becomes a proposal for a new ADR and goes to the human.

### Finding dispositions

On a re-review, each reviewer re-lists every previous `[blocking]` and `[important]` finding with its outcome at the end of the line, ` · fixed in <sha>` or ` · refuted: <evidence>`:

```
- [blocking] src/a.ts:12 — <finding> · fixed in 3f2a9c1
- [important] src/b.ts:40 — <finding> · refuted: <evidence: code, test or output>
- [blocking] src/c.ts:7 — <finding that is still open>
```

A finding still open keeps its severity tag and has no disposition, and keeps the verdict `rejected`. `nit` and `praise` need none. A caller that fixes findings tells the reviewer the fixing commit; the reviewer verifies it before writing `fixed in`.

### Scoped calls

When the caller names reviewers (and a round), summon exactly those, in parallel, each with its previous verdict file and the range `<its Commit>..HEAD` so it re-checks only its previous findings and what changed since. Skip the matrix; the caller already chose the bench. The structural check still runs. Write the stated round into `review.md`; without a stated round, the first review of a change is round 1 and a re-review after a round-1 FAIL is round 2.

## Output

In the conversation:

```
# Review: <change id | diff>

Structural: PASS | FAIL
| Reviewer | Verdict | Blocking findings |
|---|---|---|
| adr-reviewer | PASS | 0 |
| code-quality-reviewer | FAIL | 2 |
| ... | | |

Consensus: PASS | FAIL (round N/2)

## Blockers
- <reviewer> — <file:line> — <finding>

## Next
Ready to ship. | Fix the blockers and run review-change again. | Consensus deadlock, escalate to the human: <disputed points>.
```

Below the table, each reviewer's findings stay in that reviewer's own format. The skill aggregates; it doesn't rewrite verdicts.

**When the target is a change with a folder** (`openspec/changes/<id>/` or `docs/changes/<id>/`):

- Dispatch each reviewer with the Agent tool (`subagent_type: devkit-core:<reviewer>`) and pass the change id. Each reviewer writes its own verdict to `reviews/<reviewer>.md` in the change folder; first line `Verdict: approved`, `rejected` or (security only) `declined`, second line `Commit: <sha>`.
- Don't write those files yourself, and don't copy a verdict into them. Projects using the devkit hooks accept `reviews/<reviewer>.md` only from that reviewer, and `gh pr create` requires `code-quality-reviewer` and `test-coverage-reviewer` plus every other review present to be approved.
- Write this skill's consolidated report to `review.md` in the same folder, for people to read. The gate doesn't read it.
- Any code edit after a review makes it stale. Stale means the reviewer's `Commit:` line is not the commit being shipped, or a commit after it touched anything outside `openspec/`. Re-run the reviewers that the edit concerns.

For a bare `--diff` with no change folder, create no file.

## Never

- Edit code or docs based on findings.
- Approve, merge or ship. With PASS, the next step is the commit-and-pr agent; the merge is the owner's, or GitHub's in `merge` ship mode (the `ship-change` skill enables auto-merge).
- Dispatch reviewers before the structural check passes, or skip a reviewer the matrix selected.
- Dispatch reviewers one after another.
- Declare PASS with an open blocking finding.

## Related

- Agents: `adr-reviewer`, `spec-reviewer`, `code-quality-reviewer`, `test-coverage-reviewer`, `security-reviewer`, `architecture-reviewer`; `commit-and-pr` after PASS; `pr-verifier` for an already-open PR.
- Skills: `plan-readiness-review` (gate the plan before implementation), `test-and-coverage` (run the suites).
