Verdict: approved
Commit: 8f6f2bd747e0fb6eeadc6a67765d2b499b9f1793

## ADR review — conduct-rounds

ADRs reviewed: ADR 0001 (`docs/adr/0001-coordination-without-a-harness.md`), ADR 0002 (`docs/adr/0002-merge-without-the-owner-opt-in.md`), ADR 0003 (`docs/adr/0003-auto-merge-the-archive-pr.md`), ADR 0004 (`docs/adr/0004-devkit-per-project.md`), ADR 0005 (`docs/adr/0005-parallel-steps-and-a-session-wake-up.md`, new in this change)

The ADR 0001 exception is recorded, not silent. ADR 0005 states both exceptions (parallel step subagents, capped at three, each in its own worktree; one session cron every 20 minutes). It has Context, Decision, Consequences, a Review trigger and Alternatives. ADR 0001 gets only a pointer under Consequences (`docs/adr/0001-coordination-without-a-harness.md`, Note bullet), and its Decision is unchanged. `openspec/config.yaml` lists ADR 0005. ADR 0002 and ADR 0003 are untouched.

Conformance checks that passed:
- ADR 0001 § Decision, no state outside the repository: `plugins/openspec/hooks/conduct-check.mjs:3` declares read-only and never fetches. Only the skill's Start step fetches (`plugins/openspec/skills/conduct/SKILL.md`, Start 2). `release-rebase.mjs` never pushes or commits; the force-with-lease push goes through `commit-and-pr`.
- ADR 0001 § Decision, plan approval stays a human gate: `guard.mjs:208` makes `approval.md` writable only by the main session. `deliver-check.mjs` adds `stop-plan-approval`, bound to the readiness hash. The conduct and ship-change skills both say to write it only from the owner's own message.
- ADR 0001, no starting or driving of sessions: the conduct skill's Never list says so. Its one background mechanism is the cron, which ADR 0005 allows.
- ADR 0005 § Decision 1: `dispatch` is capped at three (`conduct-check.mjs:480-481`). The skill forbids a subagent per whole change. Each dispatch prompt carries the worktree preamble.
- ADR 0005 § Decision 2: the skill's Waits and the wake-up section lists cron jobs first, keeps at most one, and deletes it when `wake.cron` is false (`conduct-check.mjs:496-500`).
- ADR 0004: the hook changes in `guard.mjs:335-380` judge each target by its own root's `optedIn`. The destructive-git rule follows the session root's opt-in. Nothing new acts in a project that has not opted in. The new scripts are not registered in `hooks/hooks.json`.
- ADR 0003: archive steps are serialized by the checker (the conduct skill's Delivery rows, item 6), and archive PRs still go through `ship-change`.

### Findings
- [important] `plugins/openspec/skills/conduct/SKILL.md`, Start 4 ("invoking `/conduct` is the go-ahead for every `devkit-lite` change") — drifts from ADR 0005 § Decision 3 and § Review trigger ("a cron-started run takes a step the owner did not expect"), and from ADR 0001 § Decision (owner's gates stay human)
  - What is wrong: the `devkit-lite` go-ahead is read from the invocation of `/conduct`, and a cron firing is also an invocation of `/conduct`. A cron-started run could take a first `implement` for a `devkit-lite` change without a message from the owner. The ship-change skill's Go-ahead requires the owner's own message. The Owner gates section guards plan approval and retro answers against cron-started runs, but not this go-ahead.
  - Fix: state that the `devkit-lite` go-ahead comes only from an owner-typed `/conduct`. A cron-started run takes a first `implement` only for changes that an owner-typed run in this session already conducted, or it waits for the owner.
- [nit] `docs/adr/0005-parallel-steps-and-a-session-wake-up.md` § Context — says only that ADR 0002 and ADR 0003 are unchanged. It does not mention ADR 0004, which sits between them and this change on main. Cite it, since the hook changes in `guard.mjs` depend on its opt-in rule.
- [nit] `openspec/changes/conduct-rounds/design.md` (D13 numbering note) — says another in-flight change claims 0004. 0004 is now on main (`docs/adr/0004-devkit-per-project.md`) and ADR 0005 has no duplicate number, so the note and task 4.3's renumbering check are stale. Update them.

### Summary
- 3 findings (0 blocking, 1 important, 2 nit)
