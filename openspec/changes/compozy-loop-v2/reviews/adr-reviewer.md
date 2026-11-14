Verdict: rejected
Commit: e10b21d46af3cc79a5977063f55fa74776073875

## ADR review — compozy-loop-v2

ADRs reviewed: ADR 0001 (`docs/adr/0001-coordination-without-a-harness.md`), ADR 0002
(`docs/adr/0002-merge-without-the-owner-opt-in.md`), ADR 0003
(`docs/adr/0003-auto-merge-the-archive-pr.md`), ADR 0004 (`docs/adr/0004-devkit-per-project.md`),
ADR 0005 (`docs/adr/0005-parallel-steps-and-a-session-wake-up.md`, superseded), ADR 0006
(`docs/adr/0006-phases-as-child-sessions.md`), ADR 0007 (`docs/adr/0007-one-change-on-request.md`),
ADR 0008 (`docs/adr/0008-reviews-as-a-workflow.md`).

### Findings

- [blocking] REQUIRES SUPERSEDER — `openspec/changes/compozy-loop-v2/design.md` (Context, and D1,
  D7, D9) and `plugins/compozy/README.md:43-44` adopt CompozyOS as the thing that sequences the
  whole delivery loop, and CompozyOS is, by this design's own words, a running daemon: it needs
  "a running CompozyOS" to validate the template (`design.md` Risks, "A gate that needs the
  daemon"), the kit "never publishes the loop to the CompozyOS daemon" and "never starts a run"
  (`plugins/compozy/README.md:43-44`), and the shipped `loop.yaml`'s `contract` carries daemon-held
  run state that is not derivable from the repository or GitHub at each invocation —
  `iteration_cap`, `no_progress.window`, `budget.wall_clock_sec`/`on_exceeded`, top-level
  `concurrency: allow`
  (`plugins/compozy/skills/compozy-setup/templates/loops/openspec-change/loop.yaml:69-86`). Its
  `run-agent` nodes start Claude Code sessions under `provider: claude` from outside any session
  the owner typed in (`plugins/compozy/skills/compozy-setup/templates/agents/dev/AGENT.md:7`,
  `.compozy/config.toml:9`), and `ci_fix`/`await_merge` keep a CompozyOS "pull-request monitor"
  armed across waits up to 12h
  (`plugins/compozy/skills/compozy-setup/templates/loops/openspec-change/loop.yaml:507-527,543-560`).
  This is exactly what ADR 0001 rules out ("no long-running process, no state outside the
  repository and GitHub, no starting or driving sessions... from outside") and exactly the
  alternative ADR 0001 itself lists and rejects ("Long-running orchestrator session or daemon...
  fights the runtime; state outside the repo"). It is also, by name, the alternative this
  project already considered and rejected once: `docs/adr/0006-phases-as-child-sessions.md`'s own
  alternatives table lists "A daemon that starts sessions (Compozy-style)" as rejected for being
  "a harness outside the app; state outside the repository (ADR 0001)" — the same wording appears
  in the design doc of the archived change that produced ADR 0006
  (`openspec/changes/archive/2026-11-10-conduct-sessions/design.md:267`), whose `requirements.md`
  records the owner naming Compozy explicitly as the rejected model
  (`openspec/changes/archive/2026-11-10-conduct-sessions/requirements.md:5-6`). D12
  (`design.md`, "No new ADR, and no ADR changes") narrows ADR 0001 to "the gates still live in the
  checkers" and never engages this tension; the proposal's own "Decisions cited" list
  (`proposal.md:127`) cites ADR 0001, 0002, 0004, 0008 but not ADR 0005, 0006 or 0007 — the ADRs
  that actually settled how agent turns are dispatched, and the ones this design's own mechanism
  conflicts with.
  - What is wrong: adopting an external, daemon-run Loop graph as the thing that sequences
    `propose` through `cleanup` is coordination through a harness, which ADR 0001 forbids outright,
    and is the specific "Compozy-style daemon" alternative ADR 0006 already rejected in this
    repository. Framing it in D12 as merely "the other way to drive the same flow" does not
    remove the contradiction: ADR 0001's "Review trigger" is itself "a coordinator needs state
    that cannot be derived from the repository or GitHub", which is precisely CompozyOS's
    `contract` fields and armed monitor.
  - Fix: not proposed here — per the adr-reviewer's own rules, this is the human's call. Either
    scope the change down to templates/documentation without this repository (or any repository)
    running the loop against a live CompozyOS daemon until an ADR explicitly supersedes or amends
    ADR 0001 (and, if phases/sessions are affected, ADR 0006) to admit this exception, or raise
    that superseding ADR before merging.

- [important] D12's "no new ADR is needed" is not sound against the project's own rule in
  `openspec/config.yaml:32` ("Record any decision that changes an ADR as a proposal for a new ADR,
  not as a silent deviation"). Independent of the harness question above, D12
  (`openspec/changes/compozy-loop-v2/design.md`, "D12 — No new ADR, and no ADR changes") only
  checks four ADRs against the new pack's effects and does not check the dispatch ADRs (0005-0007)
  at all, despite the loop's `run-agent` nodes being exactly what those ADRs govern.
  - What is wrong: a decision this consequential (a third dispatch mechanism for agent turns,
    alongside `/conduct`'s subagents/child-sessions) was settled inside a design doc rather than
    raised as a proposal for a new or amending ADR, which is what the project's own rule asks for
    whenever a change touches ADR territory.
  - Fix: raise the superseding/amending ADR (see the blocking finding) rather than settle the
    question in `design.md` D12.

- [important] `.claude/settings.json` is not part of this diff, yet the change claims this
  repository adopts the kit (`proposal.md`, "This repository adopts version 2"; AC-9
  `repo-adopts`). ADR 0004 (`docs/adr/0004-devkit-per-project.md`) makes the committed
  `.claude/settings.json` the sole record of which packs a project uses; the precedent for a new
  pack in this repository is a dedicated enablement commit (`git log -- .claude/settings.json`,
  "chore: enable devkit-panel in the project settings"). `devkit-compozy@devkit` is absent from
  `.claude/settings.json`'s `enabledPlugins` after this change, so this repository's own
  `compozy-setup`, `screen-design` and `screen-demo` skills are not registered the way ADR 0004
  registers every other adopted pack.
  - What is wrong: "the repository adopts the kit" is asserted (AC-9) without the one artifact
    ADR 0004 names as how a project adopts a pack.
  - Fix: add `"devkit-compozy@devkit": true` to `.claude/settings.json`'s `enabledPlugins`, or
    narrow AC-9's and the proposal's claim to "templates are installed as files" rather than
    "adopts the kit", if the skills are deliberately not meant to load in this repository's own
    sessions.

- [important] `python3 scripts/check.py` — the exit criterion this proposal itself lists
  (`proposal.md`, "Impact" → "Exit criteria") — fails on the current diff: `broken link
  docs/compozy-kit.md` from `openspec/changes/compozy-loop-v2/evidence.md:47`. The line quotes
  `CLAUDE.md`'s new catalog row verbatim, including its real Markdown link syntax
  `[docs/compozy-kit.md](docs/compozy-kit.md)`; resolved relative to `evidence.md`'s own
  directory, that target does not exist, so the checker (rightly) reports it broken. This is not
  an ADR violation, but it contradicts the change's own stated exit criterion and is squarely
  within what this review was asked to verify.
  - What is wrong: `evidence.md:47` embeds a literal Markdown link whose relative path only
    resolves from the repository root, not from the change folder.
  - Fix: `pr-verifier` (the file's sole writer) should quote that cell without reproducing the
    link syntax, e.g. drop the brackets or escape them, so `scripts/check.py`'s link check does
    not try to resolve it as a real link from `evidence.md`'s location.

### Summary
- 4 findings (1 blocking — REQUIRES SUPERSEDER, 3 important, 0 nit)
