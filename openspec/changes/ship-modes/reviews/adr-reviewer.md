Verdict: approved
Commit: c15ff9b5443255278571f6b9b90b385219998c2e

## ADR review — ship-modes (round 1)

ADRs reviewed: [ADR 0001](../../../../docs/adr/0001-coordination-without-a-harness.md); README "Why no harness" (README.md:38-48); openspec/config.yaml context.

### Findings
- [nit] openspec/config.yaml:15 — alignment with [ADR 0001](../../../../docs/adr/0001-coordination-without-a-harness.md) (context line)
  - What is wrong: the `Test command` in `context` still lists only `guard.test.mjs`; `deliver-check.test.mjs` (the checker the ADR's "one checker anyone can run" relies on) is not named, and no script or workflow under scripts/ or .github/ runs it.
  - Fix: add `node --test plugins/openspec/hooks/deliver-check.test.mjs` to the test command (and to CI if it is not already covered).

### Conformance checked
- No long-running process: `plugins/openspec/hooks/deliver-check.mjs:829-831` runs one `gh pr checks --watch`, capped by `--watch` minutes (default 9, max 30, SIGTERM on timeout). This is the "one capped watch" the ADR's Consequences name. `plugins/openspec/skills/ship-change/SKILL.md:67,72` repeats the cap and says nothing is scheduled or backgrounded.
- No state outside the repo and GitHub: `deliver-check.mjs` has no file writes (no writeFile/appendFile/mkdir); it reads git and `gh` only. `SKILL.md:8,63` states the skill keeps no state and resumes from disk.
- No starting or driving sessions or the app: `SKILL.md:89` forbids it; the skill only dispatches subagents of the typed-in session. `SKILL.md:70` relies on the app's Auto-fix without driving it.
- Gates unchanged: `SKILL.md:86-91` keeps one writer per gate file and sends fixes through `tdd-implementer`. `SKILL.md:20-22` keeps plan approval human. Merge is never done (`SKILL.md:88`). `guard.mjs` changes only export helpers and add the `isMain` guard, so the hook still vetoes and does not drive.
- ADR form: Status, Date, Change, Context, Decision, Consequences with a review trigger, and an Alternatives table are all present. The text matches design D10. The README paragraph (README.md:48) and the config `ADRs:` line agree with it. The old `ADRs: none` is gone.
- Open decisions: none touched.

### Summary
- 1 finding (0 blocking, 0 important, 1 nit)
