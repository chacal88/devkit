Verdict: approved
Commit: c15ff9b5443255278571f6b9b90b385219998c2e

## Architecture review — ship-modes (28a83b9..c15ff9b)

Analyzed: owners (ship parsing, staleness, review/evidence reading, PR state: deliver-check.mjs; shared helpers: guard.mjs; formats: core agents); boundaries (openspec hooks -> core agent output formats, guard.mjs import side effects, ADR 0001 "no harness"); contract consumers enumerated (`deliver-check --json` v1: plugins/openspec/skills/ship-change/SKILL.md only; guard.mjs newly exported symbols findRoot/changeSchema/changeDir: deliver-check.mjs and guard.test.mjs; `Commit:` line and evidence.md format: deliver-check.mjs parseCommitLine/acceptanceItem, produced by plugins/core/agents/*-reviewer.md and pr-verifier.md; commit-and-pr `PR: none (commit only)`: ship-change skill); deletion tests (deliver-check.mjs: passes; parseShip/shipMode inside it: passes, since the owner is single and no second consumer exists; isMain guard in guard.mjs: passes)

Good points
- plugins/openspec/hooks/guard.mjs:409-422 — the dispatch runs only when executed directly, so the new module imports helpers with no side effects and without copying them (cut, not copy). It reuses REQUIRED_REVIEWERS (guard.mjs:41) instead of redefining it.
- plugins/openspec/hooks/deliver-check.mjs:1-5,137-186 — the checker reads files, git and gh and writes nothing. State is derived each run, which matches ADR 0001 (no state outside the repo and GitHub, no harness). Staleness has one definition (`staleness`), reused by reviews and by evidence.
- docs/adr/0001-coordination-without-a-harness.md records the structural decision (a coordinating skill) with a review trigger.

Deletion test, deliver-check.mjs: inlining it into ship-change/SKILL.md would push about 850 lines of git, gh and Markdown-table parsing into prose. Complexity concentrates behind a small interface (`--json` v1, exit codes), and the logic is testable. It passes.

### Findings
- [important] plugins/openspec/hooks/deliver-check.mjs:145-160,328-352 — friction: the checker parses formats owned by another pack (`Commit:` header line, `| AC-N | ... | pass |` rows, `### Gates`), and nothing links the two. The formats are written as prose in plugins/core/agents/*.md, and deliver-check.test.mjs references no core agent file. · why: a seam with a silent contract; editing pr-verifier.md or a reviewer would make every change read as stale or unproven, and only at runtime. · direction: add a parity test that extracts the example lines from the core agent definitions and feeds them to parseCommitLine/acceptanceItem, or name the formats as a versioned contract in a shared doc both packs cite.
- [important] plugins/openspec/hooks/guard.mjs:269 vs plugins/openspec/hooks/deliver-check.mjs:202-217 — friction: "reviews approved" is now defined twice. `ci` uses reviewConsensus, which has no staleness check. `reviewsItem` adds staleness, a DECLINED allowance and the Commit line. · why: two checkers can disagree on "ready"; a PR can pass `deliver-check` yet pass CI differently, or the reverse. · direction: make the divergence explicit (CI deliberately weaker) in design/README, or have `ci` consume the shared reading from `readReviews`.
- [nit] plugins/openspec/hooks/deliver-check.mjs (853 lines) — friction: config parsing (16-105), git staleness (106-186), item readers, gh access and CLI rendering live in one file. · why: low locality for a reader changing only one concern; not a boundary violation now. · direction: split by seam only if a second consumer of `parseShip` or `staleness` appears.
- [nit] plugins/openspec/hooks/deliver-check.mjs:7-11 — duplicate imports from `node:fs` (and `realpathSync`, `statSync` split off); tidy, not architectural.
- [nit] plugins/core/agents/commit-and-pr.md — "commit-only" and "reviews are current" are caller-asserted preconditions that waive the review check. The design justifies them (commit before review), but this is a new trust path between the skill and the agent; keep it limited to the ship-change skill.

No blocking findings: no layer boundary is crossed (the openspec pack imports only from its own guard.mjs), the `--json` v1 contract has a single in-diff consumer, and the structural decision has an ADR.
