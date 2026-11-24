Verdict: approved
Commit: 796ac2cb75448c7596cc45f0cbe6851d2ccce58f

## Quality review — run-status-bar (round 2 of 2, third pass, 9ad0f6f..796ac2c)

### Findings
- [important] plugins/openspec/hooks/status-line.mjs:158-172 — On abort or at the 20 s bound only the state child was killed (SIGTERM). Its synchronous openspec/gh grandchildren kept running, against the design's claim that nothing piles up. · fixed in 792fde600c878e03a168dd5b5146aa034cbc86ab
- [nit] CHANGELOG.md (release entry of this change) — The entry said the bar starts no process but node and git, although the state command it runs starts openspec and gh. It now says the bar itself starts only node and git. · fixed in 792fde600c878e03a168dd5b5146aa034cbc86ab
- [nit] docs/openspec-flow.md and plugins/openspec/README.md (statusLine snippet) — The snippet hardcoded --lang pt-BR and said nothing about English. Both now say how to get English and what happens with no installed copy. · fixed in 792fde600c878e03a168dd5b5146aa034cbc86ab
- [praise] plugins/openspec/hooks/flow-check.mjs (notApplicableOf, appliedStages) — artifactState and the new stages field share one helper for the stage-applies rule. Behaviour is kept, and each code has its own test.
- [praise] plugins/openspec/hooks/merge-setup.mjs, roadmap-loop.mjs — OFFLINE_GH is defined in one place, and a test asserts that roadmap-loop keeps no copy of its own.
- [praise] plugins/openspec/hooks/status-line.test.mjs — Every declared variant has its own test: each state, strip position and cut step, the 100-column boundary, the archive branch, a mismatched entry, abort and open stdin.
- [nit] plugins/openspec/README.md:46 and docs/openspec-flow.md (statusLine snippet) — On macOS /bin/sh forks node instead of exec'ing it, so a signal sent only to the command's pid misses the bar's handlers. Follow-up: end the snippet with `|| exec node "$f" --lang pt-BR`. Still open: the snippet did not change in this range.
- [praise] plugins/openspec/hooks/status-line.test.mjs:142-146, 174-235 — stillAlive polls under a deadline, and the signal test drives the real bar and the real state command and SIGKILLs any leftover process in a finally block. The process tests hold under load and leak nothing.
- [praise] plugins/openspec/hooks/status-line.test.mjs:242-291 — The snippet test runs the README's own JSON command with sh -c against a fake plugin cache and checks that the docs hold the same text, so the pasted command has one source.
- [blocking] plugins/openspec/hooks/change-loop.mjs:3098 via deliver-check.mjs:1696 and merge-setup.mjs:130-132 — With --offline in a merge-mode project, a change at the code review read blocked/merge-setup, so the coordinator bar counted it as blocked, against AC-3 and D-4. · fixed in accaace7369109ceeb060c58e09db7c11df2e18d
- [nit] openspec/changes/run-status-bar/tasks.md (task 3.4 and the preamble) — The suite part of 3.4 is the delivery train's text, and the train does not set GITHUB_HEAD_REF/GITHUB_BASE_REF. The last whole-suite run with those variables was at 0528b85. tasks.md and evidence.md state this, but the gap stays and the pull request's CI check covers it. Unchanged in this range.
- [praise] merge aa8a685 — Every conflict hunk matched a git merge-tree recomputation and kept both sides correctly.
- [praise] openspec/changes/run-status-bar/design.md (D-11 E-3, D-13) and tasks.md (3.1) — The superseded E-3 keeps its approved text as history, and task 3.1 now checks with git diff --quiet, so the plan says what the branch does.
- [nit] plugins/openspec/hooks/change-loop.mjs:1168-1176 (decide's facts doc comment) — decide reads facts.offline, but the comment that lists every fact did not name `offline`. · fixed in 62bd60742bcee57260359b26c3cc01611c645f00
- [praise] plugins/openspec/hooks/change-loop.mjs:1356, 1411; change-state-stages.test.mjs (S-9b) — One shared silent() helper serves both GitHub-silent paths. The offline relabel applies only when gh === OFFLINE_GH, so online the guard stays fail-closed.
- [nit] docs/openspec-flow.md:240 and openspec/changes/run-status-bar/specs/change-state/spec.md:9 — Both say `stages` is null for an archived change, a start with no folder and a previous-script change. Since the merge of c09860c, the unplaced blocked stand-in (unplacedAction, wrong-branch) is null too (E-6; design.md:185-188 names it). Add that fourth case to both lists.
- [praise] plugins/openspec/hooks/change-loop.test.mjs:487-501 (B14b) — One test per guard branch, negatives included: offline, every other delivery-checker stop still ends blocked with its own reason and reply, and only stop-merge-setup reads as silent, with detail.error. A guard widened to every offline block, or one that ignored the flag, would fail it.
- [praise] merges 4c25ecc and e14e1fa (change-loop.mjs stateEntries and nextAction, change-loop-remote-state.test.mjs, versions, CHANGELOG.md, docs pins) — Both resolutions keep main's side (the unplaced and archived stand-ins, archivedDates, fetchBase and baseFetch) together with this change's side (stages: true, the stages parameter, [--offline] in USAGE). E-6 is the smallest edit (`stages: null` on one expected entry), recorded with its invariant, layer and suite. The release sits one above main (0.46.0 / 0.51.0), and change-loop-compozy.test.mjs equals 74f2444.

### Summary
- 18 findings (1 blocking, 1 important, 7 nits, 9 praise). The blocking (F10) and the important (F1) were fixed in earlier rounds. Nits F2, F3 and F14 are fixed; F7, F11 and the new F16 are open.
- Justification: re-review of 9ad0f6f..796ac2c. I read only what this change brings: 62bd607 (the B14b test and the F14 comment), the plan and evidence commits (0983bd2, b892d4f, 41caadc, 796ac2c), and the merge resolutions 4c25ecc and e14e1fa, each compared with both parents through `git show --cc` and `git diff <merge>^2 <merge>`. Main's own commits were not reviewed.
- F14: the decide doc comment at change-loop.mjs:1182 now lists `offline (true when gh is OFFLINE_GH: an unreadable merge setup reads as GitHub silent)`.
- Merge check:
  - stateEntries keeps main's unplaced and archived-date branches ahead of `knownChange` and passes `stages: true` only on the nextAction call.
  - nextAction keeps main's `fetchBase` and `baseFetch`, and adds `stages = false` with `if (stages) action.stages = appliedStages(facts, flow)` after the baseFetch block. `state` passes no `fetchBase`, so the bar's call still fetches nothing.
  - roadmap-loop.mjs keeps both the `OFFLINE_GH` import and main's `baseFetches`.
  - The CHANGELOG puts `## 0.51.0` (devkit-openspec 0.46.0) above main's `## 0.50.0`. The plugin.json and marketplace.json versions agree, and the doc pins read `v0.46.0` at lines 741, 742 and 755.
  - `git diff --quiet 74f2444 HEAD -- plugins/openspec/hooks/change-loop-compozy.test.mjs` exits 0.
- Tests run in the foreground with `TMPDIR=/private/tmp/devkit-run-status-bar GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main`:
  - `--test-name-pattern=B14` on change-loop.test.mjs: 2/2 pass (B14 and B14b).
  - `--test-name-pattern='unlocated 1: state|change-state AC-1 command|AC-3'` on change-loop-remote-state.test.mjs: 70/70 pass, including E-6 (`unlocated 1: state lists an unplaced change blocked ...`).
  - For the rest I relied on the caller's results: gate 1.7 762/762, gate 2.5 360/360 and 4/4, and 838/838 on six files after the last merge.
- Acceptance: evidence.md has real output for AC-1 to AC-7 (R1-R8, S1-S2, F1-F7, C1-C4). On this repository's own run, the AC-3 coordinator bar prints nothing, because the 11-change offline listing takes 37 to 45 s against the 20 s bound. That is the spec's behaviour for a slow state call, and the owner accepted it (`Entregar e seguir`, recorded in design.md D-12 and the risk table at 41caadc, follow-up `state-listing-speed`). It is the owner's product decision, so I raise no finding on it. The serial per-change reads (about 5 s each) are the follow-up's to fix.
- Nothing blocking or important is open. F7, F11 and F16 are documentation and process nits.
