# devkit-core

Stack-agnostic development workflow: research the code, grill the requirements, plan, check the plan, implement with TDD, verify, review with a bench of specialist reviewers, and ship a PR. Works with or without OpenSpec.

```bash
claude plugin install devkit-core@devkit --scope project
```

Run at the project root, or add the pack to the project's `.claude/settings.json` (see [getting-started](../../docs/getting-started.md#1-opt-the-project-in)).

## The path through a change

```text
requirements-grill ─▶ change-planner ─▶ plan-readiness-reviewer
                                                                        │ Status: APPROVED
                                                                        ▼
retro ◀── commit-and-pr ◀── review-change ◀── pr-verifier ◀── tdd-implementer (one phase at a time)
```

| Step | Asset | Output |
|---|---|---|
| Understand the ask | `requirements-grill` skill | Owner-confirmed assumptions and acceptance criteria (`AC-1`, `AC-2`, ...) |
| Draw the screens (only when the classification lists `ui`) | `screen-designer` agent (`screen-mockup` skill) | `mockup.md` and the files under `mock/`; the owner approves it before the plan |
| Decide | `adr-author` agent (`adr-authoring` skill) | `decisions.md` and the proposed records in the project's ADR folder, or one line saying none is needed |
| Plan | `change-planner` agent | `proposal.md`, `design.md`, `tasks.md` (in `openspec/changes/<id>/` or `docs/changes/<id>/`) |
| Check the plan against the code | `plan-reality-auditor` agent | `Verdict: ACCURATE \| OUTDATED \| UNVERIFIABLE` |
| Gate the plan | `plan-readiness-reviewer` agent (runs the `plan-readiness-review` method; independent of the author) | `readiness.md` with `Status: APPROVED \| NEEDS-REVISION \| BLOCKED` |
| Build | `tdd-implementer` agent | Code and tests per phase, `Outcome: success \| failure` |
| Run the unit suite (when the project declares `devkit.tests.unit`) | `test-runner` agent | `unit-tests.md`: the command, its result and the coverage against the target |
| Test it end to end (when the project declares `devkit.tests.e2e`) | `e2e-tester` agent (`e2e-testing` skill) | E2E test files written from the acceptance criteria, and `e2e-tests.md` |
| Prove it works | `pr-verifier` agent | `evidence.md`: one row of proof per acceptance criterion, as text |
| Review | `review-change` skill | Picks reviewers from what the diff touches and runs them in three stages: the reviewers in parallel, three `finding-verifier` agents per blocking or important finding, then each reviewer writes `reviews/<reviewer>.md` with its `Verdict:` |
| Ship | `commit-and-pr` agent | Commit by file name, push, PR. This agent never merges; the merge is the owner's, or GitHub's in `merge` ship mode (`ship-change` enables auto-merge) |
| Learn | `retro` skill | Proposed doc and rule updates, for the owner to approve: the owner answers each proposal, and `ship-change` applies the approved ones in the archive step |

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
| [`adr-author`](agents/adr-author.md) | opus | Read, Glob, Grep, Bash, Write, Edit | Analyses the decisions a change takes, drafts a record with status proposed in the project's ADR folder for each one that needs it, and writes the change's decisions.md listing them, or one line saying none is needed. Never edits an accepted record and never sets one accepted. Use when a change's decisions stage is next, before the proposal is written — "does this change need an ADR?", "draft the ADRs for this change". |
| [`adr-reviewer`](agents/adr-reviewer.md) | sonnet | Read, Glob, Grep, Bash, Write | Reviews a plan, design doc, spec change or diff against the project's locked ADRs (Architecture Decision Records) and returns one verdict with each violation tied to an ADR section and a file:line. Use when a change touches architecture, stack, conventions, infrastructure or process, or someone asks "adr review", "check the ADRs", "does this break any decision?". |
| [`architecture-reviewer`](agents/architecture-reviewer.md) | sonnet | Read, Glob, Grep, Bash, Write | Reviews the design of a diff, not its style: right owner, layer boundaries, contracts and their consumers, and a deletion test on every new module. Returns one verdict with severity-tagged findings at file:line. Use when a diff creates a module/package, touches a contract (route, event, shared schema) or crosses a layer boundary, or someone asks "is this in the right layer?", "does this module justify itself?". |
| [`change-planner`](agents/change-planner.md) | opus | Read, Bash, Edit, Write, Glob, Grep | Authors the plan for a change — proposal.md, design.md, tasks.md and spec deltas when a capability changes — without writing product code. Uses openspec/changes/<id>/ when OpenSpec is present, else docs/changes/<id>/. Use when the user asks to "plan a change", "write a proposal", "draft the design and tasks", "plan this feature", or before implementation starts. |
| [`code-quality-reviewer`](agents/code-quality-reviewer.md) | sonnet | Read, Glob, Grep, Bash, Write | Reviews the code quality of a diff in four phases (context, architecture, line-by-line, summary) and returns one verdict with severity-tagged findings at file:line. Use when delivered code needs a quality verdict before approval or merge, or when someone asks for "code review", "review this diff/PR", "quality review". |
| [`codebase-researcher`](agents/codebase-researcher.md) | sonnet | Read, Glob, Grep, Bash | Read-only investigator that answers specific questions about a codebase, or maps a module/service, with every claim cited by file:line or commit. Use when you or another agent need facts before deciding — "where is X defined", "which convention is used for Y", "find prior examples of Z", "how does this service work", "map this module before we change it". |
| [`commit-and-pr`](agents/commit-and-pr.md) | sonnet | Bash, Read | Ships reviewed work mechanically — stages files by name, writes a conventional commit, pushes the branch and opens the PR with gh — then stops; never merges. Refuses secrets, never skips hooks or amends. Use after review passed, when the user says "commit and open the PR", "ship it", "push this and open a pull request". |
| [`e2e-tester`](agents/e2e-tester.md) | sonnet | Read, Glob, Grep, Bash, Write, Edit | Writes end-to-end tests from the change's acceptance criteria without reading the test files the change added, writes only test files, runs the project's declared E2E command and records each scenario, its criterion and its result in the change's e2e-tests.md. Edits no product file. Use when a change's e2e-tests stage is next, after the implementation — "write the E2E tests for this change", "run the E2E scenarios of the criteria". |
| [`finding-verifier`](agents/finding-verifier.md) | sonnet | Read, Glob, Grep, Bash | Tries to refute one review finding from the code, the tests and the plan, and returns whether it holds, with evidence. Read-only; writes no file. Use when a review round needs an independent check of a single blocking or important finding before any verdict file is written. |
| [`plan-readiness-reviewer`](agents/plan-readiness-reviewer.md) | sonnet | Read, Glob, Grep, Bash, Write, Skill | Independent reviewer that decides whether a change plan is ready to implement, using the plan-readiness-review method, and writes the change's readiness.md with "- Status: APPROVED \| NEEDS-REVISION \| BLOCKED". It is not the plan's author and ignores any verdict the caller suggests. Use when a change's tasks are written and the plan needs its readiness gate, or when the user asks "is this plan ready?" for a change folder. |
| [`plan-reality-auditor`](agents/plan-reality-auditor.md) | sonnet | Read, Glob, Grep, Bash | Checks that a change plan's claims about the current code — the "current behavior", "context" or "what exists" statements in proposal.md/design.md — are still true today, citing file:line, and returns an ACCURATE/OUTDATED verdict. Read-only. Use before a plan review or before implementing an older plan — "is this plan still accurate?", "audit the current state", "has the code drifted since we planned?". |
| [`pr-verifier`](agents/pr-verifier.md) | sonnet | Read, Glob, Grep, Bash, Edit, Write | Runs what a pull request delivers and gathers proof for each acceptance criterion — check output, API responses, logs, the text and state a screen showed — then records it as text in the change's evidence.md. Reports defects, fixes nothing. Use when a PR is ready and someone needs evidence before approving — "verify this PR", "gather proof for the acceptance criteria", "does the change actually work?". |
| [`screen-designer`](agents/screen-designer.md) | sonnet | Read, Glob, Grep, Bash, Write, Edit | Draws the screens a change adds or changes, with real example data, as files the owner can open under the change's mock/ folder, and writes mockup.md listing them with result=pending; on a redraw it answers the owner's notes. Never writes product code, keeps no image and never records the owner's approval. Use when a change's classification lists ui and its mock-up stage is next, or when the owner asked for changes to the mock-up — "draw the screens of this change", "redraw the mock-up from my notes". |
| [`security-reviewer`](agents/security-reviewer.md) | sonnet | Read, Glob, Grep, Bash, Write | Audits a diff for exploitable vulnerabilities across six categories (injection, authn/authz/IDOR, data exposure, weak crypto, hardcoded secrets, insecure config), runs a mandatory false-positive filter, and returns one verdict. Use when a change touches auth, sensitive data, credentials, per-tenant queries, crypto or config, or someone asks for "security review" or "audit the diff". Not a general bug hunt or whole-repo audit. |
| [`spec-reviewer`](agents/spec-reviewer.md) | sonnet | Read, Glob, Grep, Bash, Write | Reviews a plan or implementation against the project's canonical requirement specs (openspec/specs/ or docs/specs/) and returns one verdict with a per-requirement coverage table, flagging scope creep (work no requirement asks for) and gaps (required scenarios not delivered). Use when a change implements or extends an existing capability, someone asks "spec review" or "check against the requirements", or before approving a plan/diff that cites a spec. |
| [`tdd-implementer`](agents/tdd-implementer.md) | sonnet | Read, Write, Edit, Bash, Glob, Grep | Implements an approved change plan with strict TDD (red → green → refactor), one phase at a time, stopping at each phase gate; re-inspects the repo before coding and returns a parseable outcome. Never commits or opens PRs. Use when a change has an approved tasks.md and it's time to write the code — "implement this change", "execute phase 2", "apply the plan". |
| [`test-coverage-reviewer`](agents/test-coverage-reviewer.md) | sonnet | Read, Glob, Grep, Bash, Write | Analyzes a diff's test coverage behaviorally, not by line %: maps each new or changed behavior to a test that would go red, scores gaps 1-10 and flags tests that only test the mock. Returns one verdict. Use when someone asks "are tests missing?", "is coverage enough?", "what regression would slip through?", or before approving a diff touching business logic, validation, auth or a cross-process flow. |
| [`test-runner`](agents/test-runner.md) | sonnet | Read, Glob, Grep, Bash, Write | Runs the project's whole unit suite and its coverage command, apart from the implementer, and records each command, its exit code, its summary and the coverage against the target in the change's unit-tests.md. Edits no file but that one. Use when a change's unit-tests stage is next, after the implementation — "run the unit tests of this change", "check the coverage against the target". |

**Skills** (invoke with `/<name>` or let Claude pick them by description)

| Skill | What it does / when to use |
|---|---|
| [`adr-authoring`](skills/adr-authoring/SKILL.md) | Decides which of a change's decisions deserve an architecture decision record and drafts each one in the project's ADR folder with status proposed, then lists them in the change's decisions.md, or says in one line that none is needed. Use when a change is planned and its decisions may be hard to reverse, cross a boundary, change a contract or contradict an accepted record — "does this need an ADR?", "draft the decision records". |
| [`commit-message-guidelines`](skills/commit-message-guidelines/SKILL.md) | Format for git commit messages and PR titles, taken from the project itself - its ticket key convention when it uses tickets (from branch names, CONTRIBUTING, git log), conventional commits otherwise - with an imperative subject and a "why" body. Load before writing or staging any commit message or PR title. Use when the user says "commit this", "write the commit message", "open a PR". |
| [`e2e-testing`](skills/e2e-testing/SKILL.md) | Writes end-to-end tests from a change's acceptance criteria and specs, without reading the tests its diff adds, runs the project's declared E2E command and records each scenario against its criterion. Use when a change's code is done and its E2E command is declared, or when someone asks for end-to-end coverage of the acceptance criteria — "write E2E tests for this change", "exercise the criteria end to end". |
| [`plan-readiness-review`](skills/plan-readiness-review/SKILL.md) | Reviews a planned change package (proposal, design, specs, tasks) for implementation readiness and emits APPROVED, NEEDS-REVISION or BLOCKED, stopping ambiguous work before coding starts. Works on OpenSpec changes or docs/changes/<id>/. Use when the user says "is it ready to implement?", "review the plan", "readiness review", "can we start coding?", or before breaking a change into issues or branches. |
| [`requirements-grill`](skills/requirements-grill/SKILL.md) | Adversarial requirements interview before any spec or code. Classifies the change, then grills the owner one question at a time on scope, end effect, edges and conflict with project rules, and returns assumptions plus observable acceptance criteria. Default-on; skipped when the owner says so. Use at the start of a new change or feature, when exploring an idea, or when the user says "grill me", "brainstorm this", "let's think this through". |
| [`retro`](skills/retro/SKILL.md) | Short retrospective after a phase or a whole change. Answers three questions (what went wrong, how to do it better, what to remember), classifies each learning and proposes doc or rule updates as diffs for the owner to approve, never writing them blindly. Use at the end of a change or phase, or when the user says "retro", "what did we learn", "consolidate learnings", "lessons learned". |
| [`review-change`](skills/review-change/SKILL.md) | Pre-ship review gate. Picks the reviewer agents a change needs from what its diff touches, runs them in parallel, verifies each blocking or important finding with three refuting agents, and decides by consensus (any open blocking finding rejects). Use after writing a plan, before committing or opening a PR, or when the user says "review this change", "audit before ship", "gate this". |
| [`screen-mockup`](skills/screen-mockup/SKILL.md) | Draws the screens a change adds or changes as files the owner can open, with data from a real example, one file per screen under the change's mock/ folder, and lists them in mockup.md. Use when a change alters a screen and the owner must approve how it looks before the plan is written, or when the owner asked for changes to a mock-up — "draw the screen", "mock this page up", "redraw it with my notes". |
| [`systematic-debugging`](skills/systematic-debugging/SKILL.md) | Four-phase root-cause debugging (investigate, analyze patterns, test one hypothesis, fix with a failing test first). Use when encountering any bug, test failure, flaky test or unexpected behavior, before proposing a fix, or when the user says "debug this", "why is this failing", "it broke". |
| [`test-and-coverage`](skills/test-and-coverage/SKILL.md) | Discovers the repo's test surfaces and their commands, runs them per surface with coverage, reports PASS/WARN/FAIL against the coverage target, and analyzes gaps with prioritized test suggestions. Use when validating an implementation, before a commit or PR, or when the user says "run the tests", "test this surface", "check coverage", "coverage report", "what's untested", "which files need tests". |
| [`test-driven-development`](skills/test-driven-development/SKILL.md) | Red-green-refactor discipline - write the failing test first, watch it fail, write the minimal code to pass, then refactor. Use when implementing any feature or bugfix, before writing implementation code, or when the user says "TDD", "test first", "write the test before the code". |
<!-- catalog:end -->
