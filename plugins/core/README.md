# devkit-core

Stack-agnostic development workflow: research the code, grill the requirements, plan, check the plan, implement with TDD, review with a bench of specialist reviewers, verify, and ship a PR. Works with or without OpenSpec.

```text
/plugin install devkit-core@devkit
```

## The path through a change

```text
requirements-grill ─▶ change-planner ─▶ plan-readiness-reviewer
                                                                        │ Status: APPROVED
                                                                        ▼
retro ◀── commit-and-pr ◀── pr-verifier ◀── review-change ◀── tdd-implementer (one phase at a time)
```

| Step | Asset | Output |
|---|---|---|
| Understand the ask | `requirements-grill` skill | Owner-confirmed assumptions and acceptance criteria (`AC-1`, `AC-2`, ...) |
| Plan | `change-planner` agent | `proposal.md`, `design.md`, `tasks.md` (in `openspec/changes/<id>/` or `docs/changes/<id>/`) |
| Check the plan against the code | `plan-reality-auditor` agent | `Verdict: ACCURATE \| OUTDATED \| UNVERIFIABLE` |
| Gate the plan | `plan-readiness-reviewer` agent (runs the `plan-readiness-review` method; independent of the author) | `readiness.md` with `Status: APPROVED \| NEEDS-REVISION \| BLOCKED` |
| Build | `tdd-implementer` agent | Code and tests per phase, `Outcome: success \| failure` |
| Review | `review-change` skill | Picks reviewers from what the diff touches and runs them in parallel; each writes `reviews/<reviewer>.md` with its `Verdict:` |
| Prove it works | `pr-verifier` agent | `evidence.md`: one row of proof per acceptance criterion |
| Ship | `commit-and-pr` agent | Commit by file name, push, PR. Never merges |
| Learn | `retro` skill | Proposed doc and rule updates, for the owner to approve |

Each step is usable on its own: ask for "review this diff" and `review-change` runs; ask "where is X handled?" and `codebase-researcher` answers with `file:line`.

To have this path enforced instead of suggested, use it through [devkit-openspec](../openspec/README.md).

## Reviewers

`review-change` summons only the reviewers the diff needs:

| Diff touches | Reviewer |
|---|---|
| Any code | `code-quality-reviewer`, `test-coverage-reviewer` |
| New module or package, a contract (route, event, shared schema), a layer boundary | `architecture-reviewer` |
| Auth, sensitive data, credentials, per-tenant queries, crypto, config | `security-reviewer` |
| An area governed by an ADR | `adr-reviewer` |
| A capability with a spec | `spec-reviewer` |

Every reviewer returns one verdict with severity-tagged findings (`blocking`, `important`, `nit`) at `file:line`, writes only its own verdict file, and never fixes, merges or approves with an open blocker.

## Assets

<!-- catalog:begin -->
**Agents**

| Agent | Model | Tools | What it does / when to use |
|---|---|---|---|
| [`adr-reviewer`](agents/adr-reviewer.md) | opus | Read, Glob, Grep, Bash, Write | Reviews a plan, design doc, spec change or diff against the project's locked ADRs (Architecture Decision Records) and returns one verdict with each violation tied to an ADR section and a file:line. Use when a change touches architecture, stack, conventions, infrastructure or process, or someone asks "adr review", "check the ADRs", "does this break any decision?". |
| [`architecture-reviewer`](agents/architecture-reviewer.md) | opus | Read, Glob, Grep, Bash, Write | Reviews the design of a diff, not its style: right owner, layer boundaries, contracts and their consumers, and a deletion test on every new module. Returns one verdict with severity-tagged findings at file:line. Use when a diff creates a module/package, touches a contract (route, event, shared schema) or crosses a layer boundary, or someone asks "is this in the right layer?", "does this module justify itself?". |
| [`change-planner`](agents/change-planner.md) | opus | Read, Bash, Edit, Write, Glob, Grep | Authors the plan for a change — proposal.md, design.md, tasks.md and spec deltas when a capability changes — without writing product code. Uses openspec/changes/<id>/ when OpenSpec is present, else docs/changes/<id>/. Use when the user asks to "plan a change", "write a proposal", "draft the design and tasks", "plan this feature", or before implementation starts. |
| [`code-quality-reviewer`](agents/code-quality-reviewer.md) | opus | Read, Glob, Grep, Bash, Write | Reviews the code quality of a diff in four phases (context, architecture, line-by-line, summary) and returns one verdict with severity-tagged findings at file:line. Use when delivered code needs a quality verdict before approval or merge, or when someone asks for "code review", "review this diff/PR", "quality review". |
| [`codebase-researcher`](agents/codebase-researcher.md) | sonnet | Read, Glob, Grep, Bash | Read-only investigator that answers specific questions about a codebase, or maps a module/service, with every claim cited by file:line or commit. Use when you or another agent need facts before deciding — "where is X defined", "which convention is used for Y", "find prior examples of Z", "how does this service work", "map this module before we change it". |
| [`commit-and-pr`](agents/commit-and-pr.md) | sonnet | Bash, Read | Ships reviewed work mechanically — stages files by name, writes a conventional commit, pushes the branch and opens the PR with gh — then stops; never merges. Refuses secrets, never skips hooks or amends. Use after review passed, when the user says "commit and open the PR", "ship it", "push this and open a pull request". |
| [`plan-readiness-reviewer`](agents/plan-readiness-reviewer.md) | opus | Read, Glob, Grep, Bash, Write, Skill | Independent reviewer that decides whether a change plan is ready to implement, using the plan-readiness-review method, and writes the change's readiness.md with "- Status: APPROVED \| NEEDS-REVISION \| BLOCKED". It is not the plan's author and ignores any verdict the caller suggests. Use when a change's tasks are written and the plan needs its readiness gate, or when the user asks "is this plan ready?" for a change folder. |
| [`plan-reality-auditor`](agents/plan-reality-auditor.md) | sonnet | Read, Glob, Grep, Bash | Checks that a change plan's claims about the current code — the "current behavior", "context" or "what exists" statements in proposal.md/design.md — are still true today, citing file:line, and returns an ACCURATE/OUTDATED verdict. Read-only. Use before a plan review or before implementing an older plan — "is this plan still accurate?", "audit the current state", "has the code drifted since we planned?". |
| [`pr-verifier`](agents/pr-verifier.md) | sonnet | Read, Glob, Grep, Bash, Edit, Write | Runs what a pull request delivers and gathers proof for each acceptance criterion — check output, API responses, screenshots, logs — then records it in the change's evidence.md and can comment on the PR. Reports defects, fixes nothing. Use when a PR is ready and someone needs evidence before approving — "verify this PR", "gather proof for the acceptance criteria", "does the change actually work?". |
| [`security-reviewer`](agents/security-reviewer.md) | opus | Read, Glob, Grep, Bash, Write | Audits a diff for exploitable vulnerabilities across six categories (injection, authn/authz/IDOR, data exposure, weak crypto, hardcoded secrets, insecure config), runs a mandatory false-positive filter, and returns one verdict. Use when a change touches auth, sensitive data, credentials, per-tenant queries, crypto or config, or someone asks for "security review" or "audit the diff". Not a general bug hunt or whole-repo audit. |
| [`spec-reviewer`](agents/spec-reviewer.md) | opus | Read, Glob, Grep, Bash, Write | Reviews a plan or implementation against the project's canonical requirement specs (openspec/specs/ or docs/specs/) and returns one verdict with a per-requirement coverage table, flagging scope creep (work no requirement asks for) and gaps (required scenarios not delivered). Use when a change implements or extends an existing capability, someone asks "spec review" or "check against the requirements", or before approving a plan/diff that cites a spec. |
| [`tdd-implementer`](agents/tdd-implementer.md) | sonnet | Read, Write, Edit, Bash, Glob, Grep | Implements an approved change plan with strict TDD (red → green → refactor), one phase at a time, stopping at each phase gate; re-inspects the repo before coding and returns a parseable outcome. Never commits or opens PRs. Use when a change has an approved tasks.md and it's time to write the code — "implement this change", "execute phase 2", "apply the plan". |
| [`test-coverage-reviewer`](agents/test-coverage-reviewer.md) | sonnet | Read, Glob, Grep, Bash, Write | Analyzes a diff's test coverage behaviorally, not by line %: maps each new or changed behavior to a test that would go red, mutates the seams, scores gaps 1-10 and flags tests that only test the mock. Returns one verdict. Use when someone asks "are tests missing?", "is coverage enough?", "what regression would slip through?", or before approving a diff touching business logic, validation, auth or a cross-process flow. |

**Skills** (invoke with `/<name>` or let Claude pick them by description)

| Skill | What it does / when to use |
|---|---|
| [`commit-message-guidelines`](skills/commit-message-guidelines/SKILL.md) | Format for git commit messages and PR titles, taken from the project itself - its ticket key convention when it uses tickets (from branch names, CONTRIBUTING, git log), conventional commits otherwise - with an imperative subject and a "why" body. Load before writing or staging any commit message or PR title. Use when the user says "commit this", "write the commit message", "open a PR". |
| [`plan-readiness-review`](skills/plan-readiness-review/SKILL.md) | Reviews a planned change package (proposal, design, specs, tasks) for implementation readiness and emits APPROVED, NEEDS-REVISION or BLOCKED, stopping ambiguous work before coding starts. Works on OpenSpec changes or docs/changes/<id>/. Use when the user says "is it ready to implement?", "review the plan", "readiness review", "can we start coding?", or before breaking a change into issues or branches. |
| [`requirements-grill`](skills/requirements-grill/SKILL.md) | Adversarial requirements interview before any spec or code. Classifies the change, then grills the owner one question at a time on scope, end effect, edges and conflict with project rules, and returns assumptions plus observable acceptance criteria. Default-on; skipped when the owner says so. Use at the start of a new change or feature, when exploring an idea, or when the user says "grill me", "brainstorm this", "let's think this through". |
| [`retro`](skills/retro/SKILL.md) | Short retrospective after a phase or a whole change. Answers three questions (what went wrong, how to do it better, what to remember), classifies each learning and proposes doc or rule updates as diffs for the owner to approve, never writing them blindly. Use at the end of a change or phase, or when the user says "retro", "what did we learn", "consolidate learnings", "lessons learned". |
| [`review-change`](skills/review-change/SKILL.md) | Pre-ship review gate. Picks the reviewer agents a change needs from what its diff touches, dispatches them in parallel, aggregates their verdicts and decides by consensus (any blocking finding rejects). Use after writing a plan, before committing or opening a PR, or when the user says "review this change", "review the diff", "audit before ship", "gate this". |
| [`systematic-debugging`](skills/systematic-debugging/SKILL.md) | Four-phase root-cause debugging (investigate, analyze patterns, test one hypothesis, fix with a failing test first). Use when encountering any bug, test failure, flaky test or unexpected behavior, before proposing a fix, or when the user says "debug this", "why is this failing", "it broke". |
| [`test-and-coverage`](skills/test-and-coverage/SKILL.md) | Discovers the repo's test surfaces and their commands, runs them per surface with coverage, reports PASS/WARN/FAIL against the coverage target, and analyzes gaps with prioritized test suggestions. Use when validating an implementation, before a commit or PR, or when the user says "run the tests", "test this surface", "check coverage", "coverage report", "what's untested", "which files need tests". |
| [`test-driven-development`](skills/test-driven-development/SKILL.md) | Red-green-refactor discipline - write the failing test first, watch it fail, write the minimal code to pass, then refactor. Use when implementing any feature or bugfix, before writing implementation code, or when the user says "TDD", "test first", "write the test before the code". |
<!-- catalog:end -->
