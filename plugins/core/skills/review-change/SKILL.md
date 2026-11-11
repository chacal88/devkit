---
name: review-change
description: Pre-ship review gate. Picks the reviewer agents a change needs from what its diff touches, runs them in parallel, verifies each blocking or important finding with three refuting agents, and decides by consensus (any open blocking finding rejects). Use after writing a plan, before committing or opening a PR, or when the user says "review this change", "audit before ship", "gate this".
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

### 4. Run the round in three stages

The round has three stages. Each stage runs all its agents in parallel, and the stages run in order:

1. **review**: every reviewer of the bench reviews and returns its findings. It writes no file.
2. **verify**: for each `blocking` or `important` finding with no disposition, three `finding-verifier` agents try to refute it, each in its own context. `nit` and `praise` are never verified.
3. **write**: each reviewer that passed stage 1 writes its own `reviews/<reviewer>.md` from its findings and the verification outcome.

The rules (which findings are verified, the majority, the disposition text, the verdict a file must carry, `review.md`) live once, in `scripts/review-round.workflow.js`; the `agents` path reads them through `scripts/review-round.mjs`.

Build `args` first, after the structural check: `{ change, changeDir, round, path, range, structural: "PASS", preamble, bench: [{ reviewer, previous, range }] }`, where `preamble` is the caller's worktree preamble (or an empty string) and each bench entry holds the reviewer's previous verdict file and its `<Commit>..HEAD` range on a scoped call (else `null`).

**Which path runs.** The `workflow` path runs only when all of these hold: the Workflow tool is among your tools; the current turn began with the owner's own typed message (not a continuation, an Auto-fix wake, a background task notification or a scheduled prompt); and the skill the owner invoked, or one on its chain, names the Workflow tool (this one does). On any other turn, or when the tool is missing or refuses, run the `agents` path. Set `path` in `args` to the one you run.

**The `workflow` path.** Call the Workflow tool with `scriptPath: <skill-dir>/scripts/review-round.workflow.js` and `args`. If the tool refuses the path, read that file and pass its text unchanged as `script` (never retype it). If it refuses that too, or errors, run the whole round on the `agents` path and add the note `Workflow refused: <first line>`.

The call returns at once and runs in the background. Until its completion notice, the change's review is running (busy): the caller does not recompute that change. On the notice, check the result, then finish the round.

| Result | Action |
|---|---|
| `failed` has `review stage failed: <r> review` | run that reviewer's three stages with the Agent tool (the `agents` path below), then consolidate |
| `failed` has `review stage failed: <r> write` | run stage 3 for that reviewer with the Agent tool, from its `outcomes` entry |
| `check-file` gives `review file mismatch:` | stage 3 again for that reviewer with the Agent tool, once; a second mismatch stops the round and goes to the owner with the error |
| the result is missing, not an object, or lacks a field (`version: 1`, `path: "workflow"`, the call's `change` and `round`, the `outcomes` and `failed` lists, `reviewMd` a string or `null`) | the result check fails: run the whole round on the `agents` path, with the note `Workflow result invalid: <the first missing or wrong field>` |
| no completion notice: on a later turn the Workflow task is no longer listed as running, or the owner says the round is dead | the round is lost: drop the busy mark and run the whole round on the `agents` path, with the note `Workflow lost: no completion notice` |
| `review input invalid:` | stop and report: the call is wrong, not the review |

The lost round: while the task is still listed as running, the change stays busy and you print one line saying the review round of `<change>` is still running as a Workflow. When you cannot see the task's state, treat it as running, and add that the owner can say the round is dead to re-run it with the Agent tool. The lost attempt appends nothing to `review.md`, and the re-run is the same round N. A notice that arrives after the re-run started is not consolidated; if it lands after the re-run's `check-file`, run `check-file` again against the re-run's outcomes.

**The `agents` path.** The same three stages with the Agent tool, one message per stage, all calls of a stage in that one message. Inputs are JSON files in the scratch or temp folder, never in the repository.

1. `node <skill-dir>/scripts/review-round.mjs stage1 --input <json>` with `{ args }` gives `{ jobs: [{ reviewer, agentType, prompt }] }`. Send one `Agent` call per job (`subagent_type: devkit-core:<reviewer>`, the job's prompt). Each prompt asks for the stage-1 object as the last fenced `json` block.
2. `node <skill-dir>/scripts/review-round.mjs verify --input <json>` with `{ args, stage1: { <reviewer>: <object or text> } }` gives `{ jobs: [{ reviewer, id, k, agentType, prompt }], failed }`. Send one `Agent` call per job (`subagent_type: devkit-core:finding-verifier`).
3. `node <skill-dir>/scripts/review-round.mjs outcomes --input <json>` with `{ args, stage1, votes: { "<reviewer>#<id>": [vote, vote, vote] } }` gives `{ outcomes, failed, verifiersFailed }`. Send one `Agent` call per outcome with the reviewer's agent type and the writer prompt the command gives; each writes its own file.

Then check every file and consolidate (Output below). A `failed` entry `review stage failed: <r> review` means re-run that reviewer's stages once with the Agent tool.

Every prompt starts with the worktree preamble when there is one, the verifiers' too. The target is the change id and its artifact paths, or the range for a bare diff, plus where the project keeps its ADRs and specs.

### 5. Adversarial posture

Reviewers refute; they don't confirm. A generic approval ("LGTM", "looks good") is an invalid verdict and goes back for re-emission. Push-back on a finding is valid only with technical evidence (code, test or output that disproves it). `code-quality-reviewer` and `architecture-reviewer` name at least one good point, to avoid hunt-only bias.

### 6. Normalize and decide by consensus

Read each reviewer's verdict line and normalize it:

- `Status: APPROVED` / `verdict: approved` / `Coverage verdict: PASS` → PASS.
- `NEEDS-REVISION`, `BLOCKED`, `rejected`, `vetoed`, `Coverage verdict: FAIL` → FAIL.
- Any open `blocking` finding, or an `important` one without an evidence-backed rebuttal → FAIL, whatever the verdict line says. `nit` and `praise` never block.
- A reviewer that declines for lack of surface (e.g. security with nothing security-relevant) → non-blocking.

**Verification and the verdict file.** A finding is verified when it is `blocking` or `important` and has no disposition (a previous finding already marked `fixed in` or `refuted:` is not verified again; one still open in round 2 is). It is refuted when at least 2 of its 3 verifiers refute it with non-empty evidence; a failed verifier or a refutation with no evidence counts as not refuted. A refuted finding stays in the file with ` · refuted: <evidence>` (one line, `·` replaced by `-`). The verdict a file carries is `approved` when no `blocking` or `important` finding is left open, `rejected` otherwise, and `declined` for a reviewer that declined. The writer states it by its own rules from the lines it is given; the script's value is used only to check the file.

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

- Each reviewer writes its own verdict to `reviews/<reviewer>.md` in the change folder (stage 3, by its own agent type); first line `Verdict: approved`, `rejected` or (security only) `declined`, second line `Commit: <sha>`.
- Don't write those files yourself, and don't copy a verdict into them. Projects using the devkit hooks accept `reviews/<reviewer>.md` only from that reviewer, and `gh pr create` requires `code-quality-reviewer` and `test-coverage-reviewer` plus every other review present to be approved.
- After the round, check every written file: `node <skill-dir>/scripts/review-round.mjs check-file --input <json>` with `{ file, outcome }`. Exit 2 with `review file mismatch:` means stage 3 runs again for that reviewer, once (the table in step 4).
- Append this skill's consolidated report to `review.md` in the same folder, for people to read, one section per call (create the file on the first review). `node <skill-dir>/scripts/review-round.mjs consolidate --input <json>` with `{ args, outcomes, failed, notes }` gives `{ consensus, text }`; append `text`. The section holds a `Path: <workflow|agents>` line, a table of each reviewer's verdict, open blocking and important counts, verified and refuted counts and commit, the `Consensus: PASS | FAIL (round N/2)` line, the open findings, the findings refuted by verification, the notes and the next step. The gate doesn't read it, except the `Consensus:` line for the deadlock stop.
- Any code edit after a review makes it stale. Stale means the reviewer's `Commit:` line is not the commit being shipped, or a commit after it touched anything outside `openspec/`. Re-run the reviewers that the edit concerns.

For a bare `--diff` with no change folder, create no file.

## Never

- Edit code or docs based on findings.
- Approve, merge or ship. With PASS, the next step is the commit-and-pr agent; the merge is the owner's, or GitHub's in `merge` ship mode (the `ship-change` skill enables auto-merge).
- Dispatch reviewers before the structural check passes, or skip a reviewer the matrix selected.
- Dispatch reviewers one after another.
- Run the `workflow` path on a turn the owner did not type.
- Use the Workflow tool for anything but this round.
- Write or fix a `reviews/` file from the session or from a verifier.
- Send a `nit` or a `praise` finding to the verifiers.
- Declare PASS with an open blocking finding.

## Related

- Agents: `finding-verifier` (read-only, one finding), `adr-reviewer`, `spec-reviewer`, `code-quality-reviewer`, `test-coverage-reviewer`, `security-reviewer`, `architecture-reviewer`; `commit-and-pr` after PASS; `pr-verifier` for an already-open PR.
- Skills: `plan-readiness-review` (gate the plan before implementation), `test-and-coverage` (run the suites).
