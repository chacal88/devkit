<!-- devkit-stage readiness result=passed attempt=11 commit=e7607fcee58a93835a1ff88199ffca10686ef383 -->
# Readiness review: helper-conductor

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes. Attempt 10's F1 to F5 are closed; two Low notes remain, both for implementation.

Round 11, on e7607fc, after round 10 (e523e62, NEEDS-REVISION). Changed since: `design.md`, `proposal.md`, `tasks.md`. `openspec validate helper-conductor --strict` passes. No fetch was run. `release.md` is unchanged.

## 2. Scope validation
Classification: correct. The scope is unchanged. The plan now says one thing about where the scheduled firing is measured: 3.6 headless (done), 6.1 scheduled.

## 3. Proposal review
F4 is closed. `proposal.md:33-34`, `:133` and `:140` say task 3.6 is headless (done) and name 6.1 for the scheduled firing. No stale claim found.

## 4. Design review
- F1 closed. D-1 (`design.md:130-160`) splits the second decision point into 3.6 (headless, done, no stop case) and 6.1 (three stop-and-revise cases: the firing does not pass through `UserPromptSubmit`, the app counts a blocked firing as a model call, the note does not reach the task's session). A paragraph, "The residual risk, accepted and priced" (`:151-160`), says what a failure at 6.1 revises and what stays, and ties it to the pessimistic estimate. The risk lines (`:1268-1275`), the Risks bullet (`:1401-1406`) and the Open Questions (`:1480-1481`) agree.
- F2 closed. The payload form (`:302-305`, `:1477`), the cron (`:374`, `:1479`), the push tool (`:558-562`, `:105`), the model (`:741`) and the two runs at once now name 6.1. For each, the text says what phases 2 to 5 build meanwhile: the regex keeps both forms, `*/5` is built, the push step looks the tool up and sends nothing if none is found, and D-14 reads the model from 6.1.
- F3 closed. The assumptions, the cost table (`:1383`, `:1397`) and `:1438-1448` carry the headless and scheduled split.

## 5. Specs review
No findings. `specs/**` never cites 3.6 or 6.1.

## 6. Tasks review
- F5 closed. `tasks.md:31-36` states the split. Line 92 reads "task 3.6 (P-5, headless) and task 6.1 (...)". Gate 3.7 (`:404-405`) lists AC-1, AC-3, AC-6, AC-8, AC-14 and drops AC-11 and AC-15. The AC map rows hold AC-11 on `2.1, 2.5, 3.1, 6.1` and AC-15 on `2.4, 2.5, 6.1, 6.2`. Each criterion has a task that proves it.
- 6.1 (`tasks.md:511-545`) holds the scheduled observations, the stop-and-revise cases (the plan goes back to the planner, the readiness review and the owner's approval before 6.2), the refused-cron and missing-tool cases as revisions brought to the owner, and the dropping of the unseen payload form with its test in one commit. Its check line is `node scripts/test-suite.mjs --test-name-pattern="^tick-gate "`. I confirmed the flag exists (`scripts/test-suite.mjs:293`), `tick-gate.test.mjs` exists, and task 2.17 names its cases `tick-gate AC-3 `.
- AC-1 stays met by the headless run as written; no change needed.

## 7. Omission detection
No findings. The failure path of the scheduled half is defined in D-1 and 6.1, with a fallback (the prompt's second line ends a session that got no note).

## 8. Claims against code
`proof/probe-3-setup.mjs` writes the raw logger and the real `tick-gate.mjs` as the scratch project's `UserPromptSubmit` hooks, and writes only under `/var/tmp/devkit-hc-tick`; that matches 3.6 and `proof/p5-empty-tick.md`. `plugins/openspec/hooks/tick-gate.mjs` and its test exist. The tests the plan names exist. No new code claim in the diff.

## 9. Findings

No Critical, High or Medium findings open.

**F6. Low, Fix during implementation. `tasks.md:511-513`, `:532-534`.**
Question put to this round: does 6.1's raw payload logger in "the scratch project's own `.claude/settings.json`" fit the rule that this repository's settings are never edited? Yes. The rule (`tasks.md:389-392`, `design.md:130-134`) rules out installing the hook in this repository's settings. 6.1 writes into the scratch project's settings, and the packs it uses are the installed packs built from this branch, not this repository's settings. The plan does not edit this repository's settings. Two gaps in the wording remain:
1. 6.1 never says the coordinator's session is opened in the scratch project's folder. The reason 3.6 moved is that a scheduled task runs in the project of the session that created it (`create_scheduled_task` takes no working folder). If the coordinator types `/devkit roadmap 1` from a session in this repository, the task lands here, and the logger placed in the scratch project sees nothing.
2. 3.6's script writes `.claude/settings.local.json`; 6.1 says `.claude/settings.json`. A tracked file in a scratch project is harmless, but the two should agree. "Placed before the plugin's hook" also has no effect: hooks of one event run side by side, so the logger only needs to be present.
Smallest correction (an implementer can do it at 6.1): add "the coordinator's session is opened in the scratch project's folder, never in this repository" to 6.1, and name the file (`settings.local.json`, as `probe-3-setup.mjs` writes it, or `settings.json`). The task's evidence line (`p5-empty-tick.md`, "Scheduled firing") can record the folder the task listed as its project.

**F7. Low, Nice to have. `proof/probe-3-setup.mjs:2`.**
The header comment still says "task 3.6 ... on the owner's Mac"; 3.6 ran on `avel` headless. A proof file's comment, not a claim the plan relies on.

## 10. Execution-readiness test
The next phase (phase 4) can start. The open choices a developer would have met are written down: which half of the second decision point guards phases 4 and 5, what phases 2 to 5 build while 6.1 is unmeasured, and what 6.1's stop cases revise. Major doubts: 0.

## 11. Mandatory questions
1. Problem objectively defined: yes.
2. Result measurable: yes; each AC maps to a task that proves it (`tasks.md` AC map).
3. Error behaviors defined: yes, including the scheduled-firing failure path (D-1, 6.1).
4. Edge cases: covered; a refused cron and a missing notification tool are revisions, not stop cases, by name.
5. Dependencies clear: yes; phases 2 to 5 build on stated defaults while 6.1 measures.
6. Contracts defined: yes.
7. Two developers interpret differently: only on where the 6.1 session is opened (F6).
8. Implicit decisions: the residual risk is now written (`design.md:151`).
9. Tasks deliver the outcome: yes.
10. Discovered too late: a scheduled firing that costs a model call or drops the note, found at 6.1 after phases 4 and 5. It is accepted, priced in the pessimistic estimate, and has a named revision path.

## 12. Top 5 likely production failures
1. A scheduled firing does not pass through `UserPromptSubmit`. Impact: every empty tick costs a model call. Prevention: the prompt's second line ends the session at once; 6.1 stop case.
2. The note does not reach a task's session. Impact: S-B cannot name the session and the paths. Prevention: 6.1 stop case; the carrier is revised.
3. The 6.1 task is created from a session in this repository (F6). Impact: the logger sees nothing and the run measures the wrong project. Prevention: the one sentence in F6.
4. The host refuses `*/5 * * * *`. Impact: AC-15 changes. Prevention: 6.1 records the shortest interval; the owner decides.
5. Both payload forms stay in the regex because the logger saw neither. Impact: a dead branch in the hook. Prevention: 6.1 says `decision.md` states both stay, or one is dropped with its test.

## 13. False-completeness check
No section names a decision without defining it. The residual-risk paragraph names its trigger, its revision and its fallback. The 6.1 check line runs a real command.
