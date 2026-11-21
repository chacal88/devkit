<!-- devkit-stage retro result=passed attempt=1 commit=decf14850b74e41eb229d092594f3a8669e5603f -->
## Retro: roadmap-coordinator

1. Went wrong:
   - The first readiness review returned the plan with four fixes: an existing test that pinned a sentence the plan rewrites was not on the plan's list, the reply table would have thrown on a blocked change's reason, one end of a run had no scenario, and one acceptance criterion rested on three worktrees of this repository that disappeared during the session.
   - The board the owner approved in the grill contradicted the rules decided in the same grill (every place filled beside the line that says the load holds a start). It was found in phase 1; the session corrected the example in `requirements.md` and one scenario of the spec delta after the plan was approved, and told the owner afterwards.
   - The live test showed four defects the tests did not: both started lines carried the final count, the resumed line was ungrammatical in Brazilian Portuguese, the reviewers of a review round were refused by the hand-off lock because the skill did not say their prompts need the change's brief line, and the session told the owner that the plugin's settings arrived unfilled.
   - The whole suite failed once on a new test of two openings at once. The cause was older than this change: the read of standard input gave an empty request when the pipe was not written yet. The loop's rule for a red gate ended the run, and a fix of a few lines waited for the owner's word.
   - The first `evidence.md` quoted Portuguese lines of the live records, which `scripts/check.py` refuses; it was found only by the structural check of the review, after an evidence commit had been pushed.
   - Review round 1 was rejected on three important findings: two duplications written inside this very change (a second copy of the lock loop, a second scan of the transcript) and two acceptance criteria marked as passed on tests alone. One refactor commit then made all six verdicts stale, so round 2 summoned six reviewers again.
   - The session did not start the loop's wait on GitHub: the desktop app had its own pull-request monitor on for the session, which wakes a session on a failure and not on success, and the app tells a session not to poll checks. The owner had to call the command again when the checks turned green, so "goes on alone" did not hold here.
   - The session was started by the app in a worktree of its own, and `open` created the change's worktree beside it; every write to the change was refused until the session entered that worktree. The session's shell also refuses a compound command that names git, so each gate that mentions a worktree or a git path had to run from a script file.
   - The verifier could not write the full output of its real runs under the change's `proof/` folder (the guard lets it write `evidence.md` only), so the session copied the two files there.
   - `review-round.mjs outcomes` still returns no writer prompt (round 25): the session built each prompt with the round's own rule and handed it to the reviewer as a file to read.
2. Better next time:
   - An example shown to the owner in a grill is checked against the rules being decided in that grill before it is shown.
   - A new helper is searched for in the files the change already touches before a second copy is written; the plan's design names the shared helper when two tasks need the same mechanism.
   - Evidence is written in the language of the project's files from the first version: script calls run with the files' language, and `scripts/check.py` runs before the evidence is committed.
   - A criterion whose command can be run for real in a scratch project is run for real by the verifier, not left to tests alone.
3. Remember: an example the owner approves becomes a requirement, so it has to obey the rules decided beside it.

What this run showed about the points carried on the round 16 line, as the first whole change run with `/devkit change`: the loop took the change from the request to the merge, and the owner was asked only at the unfinished-work question, the grill, the plan approval, the red gate and the wake after the checks. A red gate has no declared step for a small fix (the run ends blocked and the owner is asked). The unlimited wait on GitHub was not used, for the reason above. A task of a phase that the conducting session must do itself (the probe, the live test, the marketplace validation) is handed by the loop to the implementer like any other task; only the task's own text says who does it.

What is left for the first real `/devkit roadmap` on this repository's roadmap (the "next" part of the acceptance criteria): the selection on the real roadmap (AC-1), changes that keep running while the owner answers another one over a whole change (AC-7), many stage ends in a row over whole changes (AC-14), a change that reaches the delivery part inside a roadmap run, and a run in a project that holds many old changes (AC-11). A start held and released under a real load (AC-4) was already seen in the second live run.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | The board approved in the grill contradicted the rules decided in the same grill | process-friction | memory-only | user |
| 2 | Two mechanisms were written twice inside one change and the review sent both back | process-friction | memory-only | user |
| 3 | The first evidence quoted text in the person's language and the language check refused it after the commit | process-friction | memory-only | user |
| 4 | A session started in the app's own worktree cannot write to the change's worktree until it enters it | environment | memory-only | user |
| 5 | The loop's wait on GitHub and the app's own pull-request monitor do not fit together: with the monitor on, nothing wakes the session when the checks pass | tooling | followup | project |
| 6 | A red gate ends the run even for a small fix, and a task the conducting session must do itself is handed to the implementer | tooling | followup | project |
| 7 | Texts kept as the approved design has them, though the live test showed them misleading: "ready, waits for a place" with no run under way, and "The others go on." when no other change is running | doc-gap | followup | project |
| 8 | Open nits of the review: ADR 0013 decision 4 does not name every field of the run file; ids from `--param id=` and `--after` are not checked before they become keys; a failed write leaves the temporary run file; the run file's lock can wait as long as the agent hook's timeout; a killed hold leaves the run holding; no test for `run` without `--session`, for a lock that times out through its callers, for the draft's language fallback, or for the single read of `mainInRun` | doc-gap | followup | project |
| 9 | The verifier cannot write its real runs' output under the change's `proof/` folder | tooling | followup | project |
| 10 | The release tag `v0.18.0` on the merge commit of pull request 42 (`aafd1ce`) is owed, as the change's workflow follow-up says | process-friction | followup | project |

## Proposed updates

### `openspec/roadmap.md` (tooling)
Carries what this change found into the rounds that will build it: the loop's findings to the round 16 line, and the roadmap coordinator's own follow-ups to a new line after round 18.
- before: `a test for an unreadable `.openspec.yaml`).` (the end of the stage-roles line of round 16)
+ after: `a test for an unreadable `.openspec.yaml`). Carried from the roadmap-coordinator retro, the first whole change run with /devkit change: a declared step for a small fix after a red gate, in place of a run that ends blocked; a way for a task to say that the conducting session does it, so the loop does not hand it to the implementer; how the wait on GitHub lives with a host that has its own pull-request monitor and forbids polling, so that the session still goes on alone when the checks pass; and the verifier allowed to write its runs' output under the change's `proof/` folder.`
- before: `## Round 19: defining a project`
+ after: `## Round 18b: follow-ups of the roadmap coordinator` followed by the line `- [ ] roadmap-coordinator-followups (after: roadmap-coordinator) — what the review and the live test of roadmap-coordinator left open: a ready line says it waits for a place only when no place is free, and a gate or blocked line says the others go on only when another change is running; ADR 0013 decision 4 names every field of the run file; ids from --param and --after are checked before they become keys; a failed write removes the temporary run file; the run file's lock waits less than the agent hook's timeout; a killed hold does not leave the run holding; tests for run without --session, a lock that times out through its callers, the draft's language fallback and the single read of mainInRun; and what the first real /devkit roadmap on this roadmap shows (the selection, changes running while the owner answers, many ends in a row, a change that reaches the delivery part, a project with many old changes)`, a blank line, then `## Round 19: defining a project`
- Answer: approved
- Applied: yes

### user memory (memory-only)
Before showing the owner an example in a grill (a board, a line, a screen), check it against every rule being decided in the same grill: an approved example becomes a requirement.
- Answer: approved
- Applied: yes

### user memory (memory-only)
When a plan gives two tasks the same mechanism (a lock, a scan, a parser), name one shared helper in the design, and before writing a helper search the files the change already touches for one that does the same.
- Answer: approved
- Applied: yes

### user memory (memory-only)
Tell the verifier to run script calls in the language of the project's files and to run the project's language check before the evidence is committed; a criterion whose command can run in a scratch project is run for real, not left to tests alone.
- Answer: approved
- Applied: yes

### user memory (memory-only)
When the app starts a session in a worktree of its own and the change opens in another, enter the change's worktree right after it is opened; in such a session a command that names git or a worktree together with other commands goes in a script file.
- Answer: approved
- Applied: yes
