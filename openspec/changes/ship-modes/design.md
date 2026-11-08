# Design

Change: `ship-modes` · Date: 2026-11-08 · Owner: kaue rodrigues dos santos · Inputs: [requirements.md](requirements.md), [proposal.md](proposal.md) · PRD / tech spec: n/a

## Context

See proposal.md (Why) for the motivation. What shapes the approach:

- **The hooks only veto.** `plugins/openspec/hooks/guard.mjs` gives each gate file one writer (`guard.mjs:13-19`, `classify` at `:157-172`): `readiness.md` ← `plan-readiness-reviewer`, `reviews/<name>.md` ← that reviewer, `evidence.md` ← `pr-verifier`, product code in the `devkit` schema ← `tdd-implementer` after `- Status: APPROVED` (`:186-196`). `gh pr create` needs the two required reviews plus every review present approved (or `declined`) and a non-empty `evidence.md` (`prViolation`, `:265-275`). The schema comes from the change's `.openspec.yaml`, else `openspec/config.yaml` (`changeSchema`, `:99-106`), read with a regex; there is no YAML library and no dependency.
- **guard.mjs runs its mode on import.** The dispatch at `guard.mjs:408-412` is top-level: `const mode = process.argv[2]` (`:38`) and `if (process.env.DEVKIT_BYPASS === '1') process.exit(0)` (`:409`). Any script that imports it inherits those side effects (a change named `ci` or `session`, or `DEVKIT_BYPASS=1`, would run a guard mode or exit 0). Today only the test file imports it, under `node --test`.
- **The agents stop on purpose.** `tdd-implementer` stops at each phase gate and leaves the gate unchecked "for the human to confirm" (`plugins/core/agents/tdd-implementer.md:55-60`), and refuses phase N before phase N-1's gate is ticked (`:22`). `commit-and-pr` commits, pushes, opens the PR and stops at its URL; it never merges (`commit-and-pr.md:41`, Never list `:59-69`). `review-change` runs at most two rounds and re-runs only failing reviewers (`plugins/core/skills/review-change/SKILL.md:88-92`). Each reviewer's verdict file starts with its `Verdict:` line (e.g. `code-quality-reviewer.md` "Verdict file" and "Output" sections).
- **Subagents cannot start app sessions** (lesson from chacal88/orchestrator 0.16.0), and a subagent cannot dispatch further subagents. So every step runs as a subagent of the session the owner typed in, and `review-change` (which fans out reviewers in parallel) runs in that main session.
- **The tests are one command.** AC-12 fixes it: `node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py`. CI runs the same file (`.github/workflows/ci.yml`, "Hook tests"), and `scripts/check.py` checks frontmatter, relative links in every `.md` (including `openspec/changes/**`) and English prose. `scripts/gen-catalog.py --check` keeps `docs/catalog.md` and the pack READMEs in sync with the skills.
- **No ADRs and no canonical specs yet** (`openspec/config.yaml:15` `ADRs: none`; `openspec/specs/` holds only `.gitkeep`).

## Goals / Non-Goals

**Goals:**

- A single, tested source of truth for "is this change's PR ready?" (`deliver-check`) that the skill, the owner and round 2's CI job read the same way.
- A skill with no memory of its own: every run re-derives the next step from disk and GitHub, so a killed session resumes where the files say.
- Additive agent format changes: today's gates (`guard.mjs`) ignore the new lines, so `plan` mode is untouched.

**Non-Goals (design level, beyond proposal's non-goals):**

- No change to any `guard.mjs` gate or to the schemas' `apply` instructions: `ship` is read only by `deliver-check` and the skill.
- No automatic merge-conflict resolution; a conflict is reported as blocked.
- No new state file: no `.ship-state`, no log of runs. Round counting reuses `review.md`.
- No change to `openspec-setup` or its config template (round 2 touches it for the GitHub setup).

## Decisions

### D1. No spec delta: follow the `roadmap-rounds` precedent (`skip_specs: true`)

This repository keeps no `openspec/specs/`; the previous change with a behavior change (`archive/2026-11-08-roadmap-rounds`) pinned it with `guard.test.mjs` and set `skip_specs: true`. Same here: the behavior is pinned by `deliver-check.test.mjs` (run through `guard.test.mjs`) and documented in `docs/openspec-flow.md`. `.openspec.yaml` sets `skip_specs: true`; `openspec status --change ship-modes` shows `[~] specs (skipped: change declares skip_specs)`.

- Why not a first capability spec (`delivery-contract`): the first canonical spec makes `spec-reviewer` mandatory on every later change (`review-change/SKILL.md:52`, "Always when the project has canonical specs"), a standing cost the owner has not chosen. That is a project policy decision, not this change's. Flagged in the planner's report.
- Tension, stated: the schema's proposal instruction reserves `skip_specs` for "no spec-level behavior change". The precedent already read it as "this repo pins behavior in tests"; this change follows the precedent rather than deviating silently.

### D2. `ship` parsing lives in `deliver-check.mjs`; missing means `plan`, invalid is an error

`plugins/openspec/hooks/deliver-check.mjs` exports `parseShip(text)` and `shipMode(root, schema)`. `guard.mjs` does not read `ship` (AC-1: the gates are identical with or without the key).

Rules (regex/line parser, no dependency, same style as `changeSchema`):

| Input in `openspec/config.yaml` | Result |
|---|---|
| No config file, or no top-level `ship:` line | every schema → `plan` |
| `ship:` with nothing under it | every schema → `plan` |
| Block map: `ship:` then indented `  <schema>: <mode>` lines, until the next non-indented, non-comment line | map |
| Flow map: `ship: { devkit-lite: pr, devkit: plan }` | map |
| Schema not in the map | `plan` |
| Mode `plan` or `pr` (quotes and trailing `# comments` stripped, case-sensitive) | that mode |
| Mode `merge` | error: `openspec/config.yaml: ship.<schema>: merge arrives in a later round (round 2, auto-merge); use plan or pr` |
| Any other mode, a scalar (`ship: pr`), a nested map, or a duplicate schema key | error naming the key and the allowed values |

Any invalid entry fails the whole config, whatever the change's schema: a typo is surfaced the first time, not when someone later ships a change of the other schema. Unknown schema names are accepted (projects can add schemas). `deliver-check` exits 3 on a config error; the skill stops on it (AC-10). Nothing in this change can merge: no code path calls `gh pr merge`.

Alternatives: parse `ship` in `guard.mjs` (rejected: guard would need a reason to read it, and AC-1 is easiest to prove if guard's code paths don't see it); per-change `ship:` in `.openspec.yaml` (rejected: not in requirements); a YAML package (rejected: the hooks are dependency-free by design, `guard.mjs:2`).

Checked: OpenSpec 1.16.1 accepts the extra top-level key in both forms (`openspec status` and `openspec instructions` run normally in a scratch repo with `ship:` block and flow maps).

### D3. `guard.mjs` runs its mode only when executed directly

`deliver-check.mjs` imports `findRoot`, `resolveChange`, `changeSchema`, `schemaHasArtifact`, `readValue`, `REQUIRED_REVIEWERS` from `guard.mjs` instead of duplicating them. To make that safe, `guard.mjs`:

- exports `findRoot`, `changeSchema` and `changeDir` (today private);
- wraps the dispatch (`:408-412`) in `if (isMain())`, where `isMain()` compares `realpathSync(process.argv[1])` with `fileURLToPath(import.meta.url)` (ESM main modules resolve symlinks, so the plugin cache's paths compare equal).

Gate behavior is unchanged; the existing spawn tests (`run('edit', ...)` etc.) already fail if the hook stops running as a process. A new test runs the guard through a symlink and expects the code gate's exit 2, and another imports `guard.mjs` with `DEVKIT_BYPASS=1` set and checks the importer is not terminated.

Alternative: move shared helpers into a new `lib.mjs` (rejected: more churn in a gate file for the same result).

### D4. `deliver-check`: interface, items, data sources, exit codes

```text
node plugins/openspec/hooks/deliver-check.mjs <change-id> [--json] [--watch[=<minutes>]]
```

Run from anywhere inside the repo (`findRoot`). It never writes a file, never pushes, never posts. `DEVKIT_BYPASS` is ignored (like `ci` mode).

**Preflight (exit 3 when any fails):** an `openspec/` root; `openspec/changes/<id>/` exists (not only in `archive/`); `ship` config valid (D2).

**HEAD and staleness rule (shared by items 1, 2, 4).** `head` = `git rev-parse HEAD`. A recorded `Commit: <sha>` is **current** when: the sha resolves (`git rev-parse --verify <sha>^{commit}`), is an ancestor of `head` (`git merge-base --is-ancestor`), every commit in `git rev-list <sha>..HEAD` touches only paths under `openspec/` (`git diff-tree -m -r --name-only --no-commit-id <c>`; `-m` so a merge from the base branch counts its files), the line has no `(uncommitted changes)` marker, and the working tree has no change outside `openspec/` and `.claude/` (`git status --porcelain`: tracked modifications anywhere outside `openspec/`, untracked files outside `openspec/` and `.claude/`).

**The eight items:**

| # | Item | Data source | met | open (the flow can fix it) | blocked (outside the flow) |
|---|---|---|---|---|---|
| 1 | Tasks and gates | `tasks.md`: every `- [ ]`/`- [x]` line; gate tasks = lines with `Gate:` and a backticked command. `evidence.md`: its `Commit:` line and the gates table | every task ticked; each gate command, split on `&&`, has an `evidence.md` table row containing that sub-command in backticks whose last cell starts with `pass`; evidence `Commit:` current | unticked tasks (ids listed); a gate command without a passing row; evidence missing or stale | no `tasks.md`; a gate task with no backticked command |
| 2 | Reviews approved at head | `reviews/*.md` (`readValue(..., 'Verdict')`), each file's `Commit:` line in its header (before the first `#` heading) | `code-quality-reviewer` and `test-coverage-reviewer` present; every review `APPROVED` or `DECLINED`; every `Commit:` current | missing required reviewer; `rejected`; no `Commit:` line; stale `Commit:` (reviewer names and shas listed) | none |
| 3 | Findings disposed | `reviews/*.md`: list items starting `[blocking]` or `[important]` | each such line carries `· fixed in <sha>` (sha resolves and is in `head`'s history) or `· refuted: <evidence>` | a finding line with neither (reviewer and excerpt listed) | none |
| 4 | Acceptance criteria proven | AC ids: `\bAC-\d+` in `proposal.md`'s `## Acceptance criteria` section, else `requirements.md`'s. Proof: `evidence.md` table rows containing the id (`AC-1(?!\d)`, so `AC-1` never matches `AC-12`) | every id has a row whose last cell starts with `pass` or `verified`, none starting `fail`/`defect`; evidence `Commit:` current | evidence missing or stale; an id without a row; a `fail`/`defect` row | an id whose only rows say `no proof` (the owner weighs it, per `pr-verifier.md:66`); no AC ids at all |
| 5 | PR open at local head | `gh pr view --json number,url,state,headRefOid,baseRefName,mergeable,body` (current branch); `git rev-parse HEAD`; `git status --porcelain -- openspec/changes/<id>` | state `OPEN`, `headRefOid == head`, change folder has no uncommitted file, `mergeable != CONFLICTING` | no PR yet; local ahead of the PR head (PR head is an ancestor of `head`); uncommitted files in the change folder | `gh` missing or not authenticated; PR `CLOSED`/`MERGED`; PR head not in local history (someone else pushed); merge conflict |
| 6 | Required checks green | `gh pr checks <n> --required --json name,state,bucket,link`; when gh reports no required checks, the same without `--required`; exit 8 = pending | every check `pass` or `skipping`; or no checks reported at all (reason says so) | a check `pending` (names); a check `fail`/`cancel` (names and links) | no PR (reported open, not blocked); gh error |
| 7 | Conversation answered | `gh api graphql`: `viewer.login`; the PR's `reviewThreads(first:100){isResolved, comments(last:1){author{__typename login} createdAt url}}`, `comments(last:100){author{__typename login} createdAt url}`, `reviews(last:100){author{__typename login} state body submittedAt}` | every review thread (people and bots) resolved or its last comment by the viewer; no top-level comment or non-empty review body by a person (`author.__typename == User`) newer than the viewer's latest comment or review; no outstanding `CHANGES_REQUESTED` (people or bots). Top-level comments and review bodies by bots (`__typename == Bot`: deploy previews, coverage and CI summaries) are informational and ignored | an unresolved thread whose last word is not the viewer's; a newer comment by someone else; `CHANGES_REQUESTED` not yet replied to | `CHANGES_REQUESTED` already replied to (waiting on that reviewer); more than 100 threads (`hasNextPage`) |
| 8 | PR body complete | `body` from item 5's call | contains the change id, every AC id from item 4, and `openspec/changes/<id>/evidence.md` | anything missing (listed) | none |

"Answered" for item 7 follows requirements.md item 7 and owner decisions 6 and 13 ("Planning resolutions accepted by the owner"; see Risks R6). Bots are covered where they make review requests: their inline review threads and their `CHANGES_REQUESTED` reviews count exactly like a person's; their top-level comments and review bodies never hold item 7 open, so the skill never posts acknowledgements to bots.

Fail closed: any command error that is not "no PR yet" makes its item `blocked` with the error text, never `met`.

**Next step.** `nextStep(state)` is a pure function over the facts above, so the skill never decides the order itself. First match wins:

| # | Condition | `next.step` | Skill action (D6) |
|---|---|---|---|
| 1 | schema's ship mode is `plan` | `stop-plan-mode` | stop: "ship mode for <schema> is plan; follow the usual apply flow" |
| 2 | branch does not select this change for the hooks (`resolveChange` ≠ id), or branch is the default branch | `stop-branch` | stop with the branch to create |
| 3 | schema has a `readiness` artifact and `readiness.md` is not `APPROVED` | `stop-not-approved` | stop (AC-3) |
| 4 | first `## N.` group with an unticked non-gate task | `implement` (phase N) | dispatch `tdd-implementer` |
| 5 | first group whose tasks are ticked but whose gate is not | `gate` (phase N, command) | run the command; tick the gate |
| 6 | uncommitted changes outside `openspec/` and `.claude/` | `commit` | `commit-and-pr`, commit only |
| 7 | `review.md` says `Consensus: FAIL (round 2/2)` and a `rejected` review's `Commit:` is current (staleness rule above) | `stop-review-deadlock` | stop (AC-4). Once a later product commit makes that rejected review stale (for example the owner fixed it by hand), this row no longer matches and row 9 re-reviews it as a new round 1 (rounds below), so the run resumes (AC-5) |
| 8 | a review is `rejected` at a current commit | `fix-review` (reviewers, findings) | `tdd-implementer` fixes |
| 9 | item 2 or 3 open for named reviewers (missing, stale, no `Commit:`, undisposed finding), including a stale `rejected` review | `review` (only those reviewers, with `round`) | `review-change`, scoped (AC-7) |
| 10 | item 4 has a `fail`/`defect` row at a current evidence commit | `fix-defect` | `tdd-implementer` fixes |
| 11 | item 1 or 4 open on evidence (missing, stale, gate or AC row missing) | `verify` | `pr-verifier` |
| 12 | item 1, 2, 3 or 4 blocked | `blocked` (item) | stop |
| 13 | no PR | `open-pr` | `commit-and-pr`, full |
| 14 | item 5 blocked | `blocked` (5) | stop |
| 15 | item 5 open (local ahead or uncommitted change files) | `push` | `commit-and-pr` (pushes; PR exists) |
| 16 | item 8 open | `edit-pr-body` | `gh pr edit <n> --body-file` |
| 17 | item 6 has `fail`/`cancel` | `fix-checks` (names, links) | `tdd-implementer` fixes |
| 18 | item 7 open | `answer` (threads, comments) | reply, or fix through `tdd-implementer` |
| 19 | item 6 or 7 blocked | `blocked` (item) | stop |
| 20 | item 6 pending | `wait-checks` | capped watch (D7) |
| 21 | all eight met | `ready` | report ready (AC-8) |

**Review rounds across calls.** `review-change` caps reject-and-fix cycles at two rounds; `review.md` (its consolidated report, `review-change/SKILL.md:109`) is the only place a round number lives. `nextStep` computes `next.round` for a `review` step:

- `2` when `review.md`'s last consensus is `FAIL (round 1/2)` and at least one reviewer being re-run has a `rejected` verdict (now stale after the `fix-review` commit): the second round of the same reject-and-fix cycle.
- `1` in every other case: the first review; reviewers re-run only because their `Commit:` went stale after an approval (a CI fix, an evidence defect fix, an answered comment); and a rejected review made stale after a `round 2/2` failure (the owner's fix opens a new cycle).

So stale-only re-reviews never consume the round budget, a round-2 failure stops the run only while it is current (row 7), and the count never reaches a third round. The skill passes `round` to `review-change`, which writes it into `review.md`.

**Summary and exit codes.** `summary` is `ready` (8/8), else `blocked: item N` (lowest blocked item), else `in progress: item N` (lowest open item).

| Exit | Meaning |
|---|---|
| 0 | 8/8 met (AC-6: the only zero) |
| 1 | at least one item open, none blocked |
| 2 | at least one item blocked |
| 3 | usage or preflight error (unknown change, no `openspec/`, invalid `ship`) |

**Human output** (one line per item, then the summary and the next step):

```text
deliver-check: add-csv-export (schema devkit-lite, ship pr, host cli, head 3f2a9c1)
  1 met      tasks and gates: 7/7 tasks; 1 gate command green in evidence.md
  2 open     reviews at head: stale test-coverage-reviewer (reviewed 1b7e0d2; 9c4f1a0 touches src/export.ts)
  3 met      findings disposed: 2 fixed, 0 refuted
  ...
6/8 met: in progress: item 2
next: review test-coverage-reviewer
```

**JSON** (`--json`, versioned because round 2's CI job consumes it):

```json
{
  "version": 1,
  "change": "add-csv-export",
  "schema": "devkit-lite",
  "ship": "pr",
  "host": "cli",
  "head": "3f2a9c1...",
  "pr": { "number": 12, "url": "https://github.com/o/r/pull/12" },
  "phases": [{ "n": 1, "title": "Export", "open": ["1.2"], "gate": { "id": "1.9", "done": false, "command": "npm test" } }],
  "items": [{ "id": 2, "name": "reviews", "status": "open", "reason": "stale test-coverage-reviewer ...", "details": { "stale": ["test-coverage-reviewer"], "rejected": [], "missing": [] } }],
  "met": 6,
  "summary": "in progress: item 2",
  "next": { "step": "review", "reviewers": ["test-coverage-reviewer"], "reason": "..." }
}
```

On exit 3, `--json` prints `{ "version": 1, "error": "<message>" }`.

### D5. The verdict and evidence formats

**`Commit:` line (item 2, AC-7).** Every reviewer that writes `reviews/<name>.md` (`code-quality-reviewer`, `test-coverage-reviewer`, `security-reviewer`, `architecture-reviewer`, `adr-reviewer`, `spec-reviewer`) puts a second line under its verdict line:

```text
Verdict: approved
Commit: 3f2a9c1e5b...                     (full `git rev-parse HEAD` when the review ran)
Commit: 3f2a9c1e5b... (uncommitted changes)   (when the reviewed diff included uncommitted work outside openspec/)
```

The first line stays the verdict line (guard and `review-change` read it there). A `declined` security review also carries the line. The line is format, not workflow: it is written in every mode, and today's gates ignore it.

**Dispositions (item 3).** On a re-review, each reviewer re-lists every previous `[blocking]` / `[important]` finding with ` · fixed in <sha>` or ` · refuted: <evidence>`; a finding still open keeps its severity tag and no disposition. `review-change` documents the format once ("Finding dispositions"), each reviewer's Output section shows it. This replaces the free-form `[resolved]` used in the precedent's round-2 files.

**`evidence.md` (items 1 and 4).** `pr-verifier` writes, near the top, `Commit: <sha>` (same rule and marker), then a `### Gates` table with one row per command (`| <gate> | \`<command>\` | pass: <summary> |` or `fail: ...`) covering every command named by a gate task in `tasks.md` (split on `&&`), and the acceptance table with one row per AC id whose last cell starts with `pass`, `fail` or `no proof: <reason>`. This matches the precedent's evidence shape (archive `roadmap-rounds/evidence.md`), made mandatory.

**Who records a phase gate (requirements.md vs code).** requirements.md says the go-ahead between phases comes "when the phase gate's test command is green and recorded in `evidence.md`". `tdd-implementer.md:59` tells the implementer to record gate output in `evidence.md`, but `tdd-implementer.md:12` and the guard (`guard.mjs:18`, `:167`) reserve `evidence.md` for `pr-verifier`: the implementer's write is blocked today. Resolution: the go-ahead comes from the skill re-running the gate command itself (exit 0) and ticking the gate task in `tasks.md` (a planning file the main session may edit); the durable record "in `evidence.md`" is `pr-verifier`'s gates table, which item 1 checks against the final commit. `tdd-implementer.md:59` is corrected to report the command and output in its Validation section. This keeps one writer per gate file and is flagged for the owner.

### D6. The `ship-change` skill

`plugins/openspec/skills/ship-change/SKILL.md`. Model-invocable (no `disable-model-invocation`), so a session woken by Auto-fix can run it again. Description (check.py needs "Use when"): drives one approved change to a ready PR in `ship: pr` mode; use when the owner asks to ship or apply a change whose schema is `pr` in `openspec/config.yaml`, or when Auto-fix wakes the session about that change's PR.

**Start.** Resolve the change id (argument, else the branch's change). Run `node <skill-dir>/../../hooks/deliver-check.mjs <id> --json` (path relative to the skill's directory, as `openspec-setup` does for its script). Exit 3 → print the error and stop (AC-10).

**Go-ahead.** `devkit`: `nextStep` stops at `stop-not-approved` unless `readiness.md` is `APPROVED` (AC-3). `devkit-lite`: the go-ahead is the owner's own message asking to ship or apply this change (or `/ship-change`). If no task is ticked and no commit is on the branch yet and the skill cannot point to such a message in this conversation, it asks once, before any step. Once work has started on disk, resuming needs no new go-ahead (AC-5).

**Loop.** Repeat: run `deliver-check --json`; do exactly the step `next` names (table in D4); run `deliver-check` again. Dispatch prompts:

| Step | Dispatch |
|---|---|
| `implement` | `subagent_type: devkit-core:tdd-implementer`, "Implement phase N of change <id>; stop at its gate. Phase N-1's gate was re-run green by ship-change." `Outcome: failure` → stop: "stopped at phase N: <reason>" (stale plan, AC-4) |
| `gate` | Bash: the gate command, alone, exit code decides (no `| tail`, no `|| true`). Green → tick `- [x] N.x Gate` in `tasks.md`. Red → stop: "stopped at gate N.x: `<command>` red: <last lines>" (AC-4) |
| `commit` | `devkit-core:commit-and-pr`, "Commit only for change <id>: stage the changed files by name (not `.claude/`), commit, push; no PR. This is a pre-review commit: precondition 3 does not apply, review runs next" |
| `review` | the `review-change` skill on change <id>, summoning only the named reviewers, each with its previous verdict file and the range `<its Commit>..HEAD` (AC-7), at round `next.round` (D4, "Review rounds across calls": a re-review caused only by stale `Commit:` lines starts at round 1; only the re-review after a round-1 rejection and its fix is round 2). First review of the change: the skill's normal matrix, round 1 |
| `fix-review`, `fix-defect`, `fix-checks` | `devkit-core:tdd-implementer`, "Fix these findings / this defect / this failing check in change <id>; test first; within the approved tasks" with the findings, the `evidence.md` defect row, or `gh run view <run-id> --log-failed` (last 200 lines). Then `commit` (or `push` once a PR exists) |
| `verify` | `devkit-core:pr-verifier`, "Verify change <id> on branch <b>; write evidence.md (with its Commit line); no PR comment" (with a PR: comment allowed) |
| `open-pr`, `push` | `devkit-core:commit-and-pr`, "Ship change <id>: reviews are current at HEAD (deliver-check item 2 met, so precondition 3 is satisfied) and evidence.md is current; commit the remaining change files by name, push, open the PR or reuse the open one". Rows 13 and 15 come after rows 7-12, so the statement is true whenever these steps run |
| `edit-pr-body` | `gh pr edit <n> --body-file <scratch file>`, adding the missing change id / AC ids / evidence link |
| `answer` | only the threads and comments item 7 lists (bot top-level comments and bot review bodies are never listed, D4). Per thread or comment: a question the code answers → reply (`gh api` reply / `gh pr comment`) citing file:line; a code request → `fix-review`-style dispatch to `tdd-implementer`, then reply with the fix sha and resolve the thread; a decision only the owner can make (scope, product, merge) → stop "blocked: item 7 (owner decision: <url>)" |
| `wait-checks` | D7 |

**Stops (AC-4, AC-8).** The run ends with exactly one of `ready` (only when `deliver-check` exited 0), `in progress: item N` or `blocked: item N`, plus the reason and the step that stopped it. Additional stops: `stop-*` steps; the same `next` returned twice in a row after its step ran ("no progress after <step>"); a third fix dispatch for the same item in one run.

**Never** (skill's own list): edit product code in the main session (fixes always go through `tdd-implementer`, even in `devkit-lite` where the hook would allow it); write `readiness.md`, `reviews/`, `evidence.md`; merge or enable auto-merge; run two phases at once; start or drive another session; answer an owner decision on a PR.

**Resumability (AC-5).** The skill holds no state. Each fact the next step depends on is on disk or GitHub: ticked tasks and gates (`tasks.md`), commits (`git`), review verdicts and their `Commit:` (`reviews/`), the round (`review.md`), evidence and its `Commit:` (`evidence.md`), the PR (GitHub). A killed run restarts at the first unfinished step: a half-done phase is re-dispatched and `tdd-implementer` continues from its unticked tasks; finished phases have ticked gates and are skipped; reviews whose `Commit:` is current are not re-run.

### D7. App vs CLI, Auto-fix and the watch cap

- **Host detection:** `host = app` when `CLAUDE_CODE_ENTRYPOINT=claude-desktop` (observed in this planning session's environment), else `cli`; `DEVKIT_HOST=app|cli` overrides it (tests, and a fallback if the app changes the value). Reported in the JSON. Whether Auto-fix is on for the PR cannot be read; the skill's final message says what wakes it.
- **The watch:** `deliver-check <id> --watch[=<minutes>]` (default 9, maximum 30) runs one `gh pr checks <n> --watch --interval 30` (`--required` when the PR has required checks) under `spawnSync`'s `timeout`, then computes the contract as usual. Nine minutes keeps it under the Bash tool's 10-minute foreground limit. No PR → no watch.
- **CLI (AC-9, outside the app):** at `wait-checks`, one watch; then report `ready` (8/8) or `in progress: item N` / `blocked: item N` and stop. A red check is fixed on the next invocation.
- **App (AC-9, inside the app):** same single watch per run, but a red check after it is fixed in the same run (`fix-checks`, then `push`, re-review of stale reviewers, `verify`, one more watch), within the per-item cap. When the run stops `in progress`, its message says the app's Auto-fix wakes this session on a CI failure, merge conflict or review comment, and that the session then runs `ship-change` again; a conflict is reported `blocked: item 5`. Auto-fix does not wake a session when checks go green, which is why the app also does one capped watch.
- No step starts an app session, schedules a wake-up or runs in the background: the only waiting is that one capped command.

### D8. `commit-and-pr`, `tdd-implementer` and `review-change` adjustments

- `commit-and-pr.md`: a **commit-only** call (commit and push, no PR; precondition 3 "review ran since the last edit" does not apply and the caller says so); if the branch already has an open PR, push and stop at its URL instead of creating another; when it closes a change, the PR body names the change id, lists each acceptance criterion id with its text, and links the change's `evidence.md`. `Returns` allows `PR: none (commit only)`. Precondition 3 is satisfied when the caller states the reviews are current at HEAD; a coordinating skill always says so explicitly (commit-only: "pre-review commit"; full call: "reviews are current at HEAD"), so the agent never has to ask. The Never list is unchanged (it never merges, never enables auto-merge).
- `tdd-implementer.md`: line 59's `evidence.md` write becomes "report the command and output in your Validation section"; line 60's go-ahead may come from the owner or from a coordinating skill that re-ran the gate green. Nothing else. Both lines change in every mode, `plan` included: line 59 is a bug fix (the hook already blocks that write), and line 60 only widens who may give the go-ahead; with no `ship` key the owner still gives it, so AC-1's "exactly as today" holds for the flow. `docs/openspec-flow.md` says so (task 3.8).
- `review-change/SKILL.md`: "current diff" (line 27) and "stale" (line 125) are defined by the `Commit:` line; the "Finding dispositions" format; a scoped call ("only these reviewers", with a round number) is honored; a call whose reviewers were summoned only because their `Commit:` went stale starts at round 1, and rounds count only reject-and-fix cycles within one cycle (same rule as D4).

All three edits stay project-agnostic (`docs/conventions.md`, Content): they name the line formats, not `deliver-check`.

### D9. Tests ride on the fixed command

`plugins/openspec/hooks/deliver-check.test.mjs` holds the new tests; `guard.test.mjs` adds `import './deliver-check.test.mjs';` so `node --test plugins/openspec/hooks/guard.test.mjs` runs both (node:test registers tests from imported modules). CI and AC-12's command stay as they are.

- Repos: the existing `repo()` pattern (temp dir, `git init`, schemas copied) plus commits, with `GIT_AUTHOR_*`/`GIT_COMMITTER_*` set in the child env so tests do not depend on a global git identity.
- GitHub: a fake `gh` (a small Node script written into a temp `bin/` and put first on `PATH`) that answers `pr view`, `pr checks`, `api graphql` from JSON fixtures in a directory named by `FAKE_GH_DIR`, with per-call exit codes and an optional sleep (for the watch cap test).
- Decoys, per the precedent's retro: `AC-1` vs `AC-12`; a sha prefix; an `openspec/`-only commit vs one touching `openspecx/`; a merge commit.
- A walkthrough test drives a `devkit-lite` change from no ticked task to `ready` by applying each step's effect (tick tasks, tick gate, commit, write reviews with `Commit:`, write evidence, fake PR, green checks) and asserts the step sequence never contains a `stop-*` or owner step (AC-2 at the logic level).
- Format contract tests read the agent and skill markdown (each reviewer's Output block has `Commit:` as its second line; `pr-verifier` names `Commit:` and the gates table; `commit-and-pr` names commit-only and the evidence link; `ship-change`'s script path resolves), so the cross-pack contract `deliver-check` parses cannot drift silently.

### D10. ADR 0001, draft text

File: `docs/adr/0001-coordination-without-a-harness.md` (new folder `docs/adr/`; numbering `NNNN-slug`). Written in phase 4 by `tdd-implementer`; `adr-reviewer` joins the review bench from then on (`review-change/SKILL.md:51`).

```markdown
# ADR 0001: Coordination without a harness

- Status: accepted
- Date: 2026-11-08
- Change: ship-modes

## Context

devkit replaced an orchestrator that drove changes through a coordinator session and a state
machine; it was slow, rigid and lost its place. README "Why no harness" and the 0.3.0 change
(roadmap rounds) therefore ruled coordination out: the state is the change's files, the schema
orders the artifacts, hooks veto. Owners still had to type every go-ahead, open the PR and push
each step. Two runtime facts bound any answer: app sessions cannot be started from automated
turns (chacal88/orchestrator 0.16.0), and the desktop app's PR Auto-fix can wake a session on a
CI failure, a merge conflict or a review comment.

## Decision

devkit may coordinate, never through a harness. A coordinating skill recomputes the next step
from the repository and GitHub every time it runs, runs only that step as a subagent of the
session the owner typed in, and stops with a reason. No long-running process, no state outside
the repository and GitHub, no starting or driving sessions or the app from outside. The gates
(one writer per gate file, approved plan before code, approved reviews and evidence before the
PR) stay as they are, and the owner's plan approval remains a human gate.

## Consequences

- Positive: changes reach a verifiable ready PR without the owner between gates; any run can be
  killed and resumed from disk; what "ready" means is one checker anyone can run.
- Negative: every step re-reads files and GitHub (Accepted: seconds against agent runs that take
  minutes). Waiting is bounded by the session: outside the app, one capped watch, then the owner
  re-runs the skill (Accepted). Auto-fix cannot be detected from the session (Mitigated: the
  skill says what will wake it).

### Review trigger

A coordinator needs state that cannot be derived from the repository or GitHub, or Claude Code
lets automation start sessions.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| Keep no coordination | Nothing new | The owner remains the loop | low |
| Long-running orchestrator session or daemon | Full control | The failure this repo left; fights the runtime; state outside the repo | high |
| A Stop hook that re-prompts until done | No new skill | A hidden harness; hooks should veto, not drive | medium |
| CI job running Claude on each push | Runs unattended | Secrets and cost in CI; state outside the session; not needed for round 1 | medium |
```

`README.md` "Why no harness" keeps its text and gains a closing paragraph: coordination is allowed, a harness is not; the `ship-change` skill drives one approved change to a ready PR from your session, re-reading files and GitHub each time, with a link to `docs/adr/0001-coordination-without-a-harness.md`. `openspec/config.yaml` `context`: `ADRs: docs/adr/ (0001 coordination without a harness)`.

## Implementation plan

Dependency order: shared guard exports → contract library (disk items) → GitHub items, next step, CLI → agent formats and the skill → decision record and release.

### Per surface

- **devkit-openspec hooks** (`plugins/openspec/hooks/`): `guard.mjs` isMain + exports (D3); new `deliver-check.mjs` (D2, D4, D7); new `deliver-check.test.mjs`; `guard.test.mjs` imports it (D9).
- **devkit-openspec skill**: new `skills/ship-change/SKILL.md` (D6, D7); pack `README.md` (What's inside rows; generated catalog block).
- **devkit-core agents/skills**: six reviewers, `pr-verifier`, `commit-and-pr`, `tdd-implementer`, `review-change` (D5, D8).
- **Repo docs/config/release**: `docs/openspec-flow.md`, `docs/adr/0001-...`, `README.md`, `openspec/config.yaml` (context line), `docs/catalog.md`, `plugin.json` ×2, `marketplace.json`, `CHANGELOG.md`.
- No backend, frontend, worker or schema (`openspec/schemas`, `plugins/openspec/schemas`) change.

### File structure

| Action | Path |
|---|---|
| create | `plugins/openspec/hooks/deliver-check.mjs` |
| create | `plugins/openspec/hooks/deliver-check.test.mjs` |
| create | `plugins/openspec/skills/ship-change/SKILL.md` |
| create | `docs/adr/0001-coordination-without-a-harness.md` |
| modify | `plugins/openspec/hooks/guard.mjs`, `plugins/openspec/hooks/guard.test.mjs` |
| modify | `plugins/core/agents/{code-quality-reviewer,test-coverage-reviewer,security-reviewer,architecture-reviewer,adr-reviewer,spec-reviewer,pr-verifier,commit-and-pr,tdd-implementer}.md` |
| modify | `plugins/core/skills/review-change/SKILL.md` |
| modify | `plugins/openspec/README.md`, `docs/openspec-flow.md`, `README.md`, `docs/catalog.md` (generated) |
| modify | `openspec/config.yaml` (context ADR line) |
| modify | `plugins/openspec/.claude-plugin/plugin.json`, `plugins/core/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `CHANGELOG.md` |
| delete | none |

### Estimate

Optimistic 14 h · likely 20 h · pessimistic 30 h (the GitHub items and the walkthrough test carry most of the spread).

### Effort

| Component | Hours | Type | Risk |
|---|---|---|---|
| `guard.mjs` isMain + exports, symlink and bypass-import tests | 1.5 | Core | MEDIUM (gate file) |
| `ship` parsing + tests (block, flow, merge, invalid, duplicates); guard unchanged with `ship` | 1.5 | Core | LOW |
| Items 1-4 (tasks/gates, reviews + staleness, dispositions, AC proof) + tests with git fixtures | 4 | Core | MEDIUM |
| Fake `gh` harness | 1 | Testing | LOW |
| Items 5-8 + tests | 3.5 | Integration | MEDIUM |
| `nextStep`, summary, resume and walkthrough tests | 2.5 | Core | MEDIUM |
| CLI (human, `--json`, exit codes), `--watch`, host | 1.5 | Core | LOW |
| `docs/openspec-flow.md` "The delivery contract" | 0.5 | Documentation | LOW |
| Agent and `review-change` format edits + format contract tests | 2 | Core | LOW |
| `ship-change` SKILL.md | 1.5 | Core | MEDIUM |
| Docs: "Ship modes", troubleshooting, limits; pack README; catalog | 1 | Documentation | LOW |
| ADR 0001, README, config context | 0.5 | Documentation | LOW |
| Versions, CHANGELOG, CI pin | 0.5 | Documentation | LOW |
| Total | 22 | | |

### Risks / Trade-offs

| # | Risk | P × I | Mitigation |
|---|---|---|---|
| R1 | The isMain guard misdetects and the hook silently stops gating | LOW × HIGH | Existing spawn tests expect exit 2 from real hook processes; new test through a symlinked path; `realpathSync` on `argv[1]` |
| R2 | `gh` output or GraphQL fields change; a call fails | MEDIUM × MEDIUM | Only documented fields (`gh pr checks --json bucket`, exit 8 pending, checked on gh 2.88.1); any unexpected error makes the item `blocked`, never `met` |
| R3 | Fix loops burn agent runs (each product commit makes every review and the evidence stale, AC-7) | HIGH × MEDIUM | Re-reviews scoped to `<Commit>..HEAD` (reviewers' Budget sections); at most two fix dispatches per item per run; "no progress" stop; review rounds still capped at two per reject-and-fix cycle, and stale-only re-reviews start at round 1 so CI fixes never trip the cap (D4, "Review rounds across calls") |
| R4 | In `devkit-lite`, the main session (or Auto-fix's own prompt) edits product code directly | MEDIUM × MEDIUM | Skill's Never list; any such commit makes item 2 open, so reviewers re-run before "ready"; documented in Limits |
| R5 | A reviewer omits the `Commit:` line | MEDIUM × LOW | Item 2 reports "no Commit line" and the next step re-runs only that reviewer; format tests pin each agent's Output block |
| R6 | Item 7's "answered" (last word is the viewer's) misreads a thread; a bot's informational comment holds the item open | MEDIUM × MEDIUM | Bot top-level comments and review bodies are ignored, bot review threads and `CHANGES_REQUESTED` count (D4); reasons list each URL; owner decisions stop as `blocked: item 7`; the rule is documented in `docs/openspec-flow.md` |
| R7 | The watch outlives the Bash tool's 10-minute limit | LOW × LOW | Default cap 9 minutes; the cap is enforced by `spawnSync` itself, not by the caller |
| R8 | `CLAUDE_CODE_ENTRYPOINT` changes value | LOW × LOW | `DEVKIT_HOST` override; only the post-watch behavior differs between hosts |
| R9 | `ship` parser misreads an exotic YAML form (anchors, multi-line flow map) | LOW × MEDIUM | Anything not recognized is an error (exit 3) naming the line, never a silent `pr` |
| R10 | The pre-review commit differs from today's order (code committed before review in `pr` mode) | LOW × LOW | Only in `pr` mode; `plan` mode is unchanged; reviewers still see the full branch diff |

### Assumptions

| Assumption | Source | Breaks if |
|---|---|---|
| OpenSpec tolerates an unknown top-level `ship` key | Scratch check on OpenSpec 1.16.1 (block and flow forms) | A later CLI validates `config.yaml` strictly: move the key, or ask upstream |
| App sessions set `CLAUDE_CODE_ENTRYPOINT=claude-desktop` | This session's environment | The value changes: `DEVKIT_HOST` covers it |
| Auto-fix wakes on CI failure, conflict or comment, not on green | requirements.md (assumptions; the "not on green" part is this design's reading) | It also wakes on green: the app watch becomes redundant, still harmless |
| A subagent cannot dispatch subagents, so `review-change` runs in the main session | Claude Code subagent model; requirements.md (steps as subagents of the owner's session) | n/a: the skill already runs in the main session |
| `gh` ≥ 2.4x with `pr checks --json bucket` and `--required` | `gh pr checks --help` on 2.88.1 | Older gh: items 6 blocked with the gh error |
| Node 22 and `node:test` in CI | `.github/workflows/ci.yml` | n/a |
| Hooks receive `agent_type` for subagents | `guard.mjs:13-15`, existing role tests | Role gates already depend on it |

### Dependencies

- None on other changes; this is round 1 (`openspec/roadmap.md`). Round 2 (`auto-merge`) consumes `deliver-check --json` (`version: 1`) and the `merge` mode reserved here; round 4 (`conduct-rounds`) builds on the skill.
- Owner decision recorded in requirements.md, Questions asked #2: the ADR.

## Migration Plan

- Rollout: release devkit-openspec 0.4.0 and devkit-core 0.3.0. Projects opt in by adding `ship:` to `openspec/config.yaml`; nothing changes without it. This repository does not add the key in this change.
- Old verdict files (no `Commit:` line) keep passing every guard gate; they only make `deliver-check` item 2 open, which matters only in `pr` mode.
- Rollback: revert the PR. Agents' extra lines are additive; `guard.mjs` gates are unchanged; removing `ship` from a config returns to `plan`.

## Open Questions

None that change the approach. The points this design resolved for requirements.md were accepted by the owner (requirements.md, "Planning resolutions accepted by the owner"). The readiness revision added review rounds across calls (D4) as a default within those resolutions; the bot rule for item 7 (D4) was put to the owner after readiness round 2 and accepted as decision 13.
