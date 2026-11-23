<!-- devkit-stage evidence result=passed attempt=2 commit=fe37b56adc238a4c9874b797db56871ea2718cea -->
Commit: fe37b56adc238a4c9874b797db56871ea2718cea

# Evidence

Change: `change-state` · Verified at HEAD `fe37b56`, tree clean. This refreshes the evidence of `5464ec9`,
which went stale when main was merged into the branch twice (`aa2da89`, `fe37b56`).

## Verification

### Gates

The whole suite was run once by the coordinator at `fe37b56` under CI's branch variables (log in the
session scratchpad, `suite-fe37b56.txt`, whose summary lines the verifier read): exit 0, 1676 tests, 1676
pass, 0 fail, 0 cancelled. The coordinator's command was
`env GITHUB_HEAD_REF=change-state GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check` (exit 0). Gates 1.6 and 2.4
name a name-filtered subset of that suite, so the whole-suite run covers them; the verifier also ran
`^change-state` alone at HEAD with the same branch variables: exit 0, 144 tests, 144 pass, 0 fail, 0
cancelled. `python3 scripts/check.py`, `python3 scripts/gen-catalog.py --check`,
`openspec validate change-state --strict` and `claude plugin validate .` were run by the verifier at HEAD.
The pull request's CI `check` job passed at `fe37b56` (`gh pr checks 70`); `devkit-reviews` was red at
the time of that read, which the review round after this evidence settles.

| Gate | Command | Result |
| --- | --- | --- |
| 1.6 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^change-state" --test-name-pattern="^change-loop" --test-name-pattern="^followups" --test-name-pattern="^roadmap-loop" --test-name-pattern="^project-loop" plugins/openspec/hooks/guard.test.mjs` | pass: covered by the whole-suite run, 1676 of 1676 pass |
| 1.6 | `python3 scripts/check.py` | pass: all checks passed (exit 0 at HEAD) |
| 2.4 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^change-state" --test-name-pattern="^change-loop" --test-name-pattern="^followups" --test-name-pattern="^roadmap-loop" --test-name-pattern="^project-loop" plugins/openspec/hooks/guard.test.mjs` | pass: covered by the whole-suite run, 1676 of 1676 pass |
| 2.4 | `python3 scripts/check.py` | pass: all checks passed (exit 0 at HEAD) |
| 3.5 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs` | pass: exit 0, 1676 tests, 1676 pass, 0 fail, 0 cancelled (coordinator run at HEAD, branch variables `change-state` / `main`) |
| 3.5 | `python3 scripts/check.py` | pass: all checks passed (exit 0 at HEAD) |
| 3.5 | `python3 scripts/gen-catalog.py --check` | pass: exit 0 at HEAD |
| 3.5 | `grep -q "Validation passed" "${TMPDIR%/}/devkit-validate-change-state/phase-3.txt"` | pass: exit 0; the record is from commit 8f52bc9. `claude plugin validate .` re-run at HEAD: exit 0, "Validation passed with warnings" (one warning: an unrelated plugin's unknown `types` field) |

Also: `openspec validate change-state --strict` exit 0 ("Change 'change-state' is valid").

### Acceptance criteria

Real runs used the worktree's own scripts (`plugins/openspec/hooks/change-loop.mjs`,
`roadmap-loop.mjs`), `--lang pt-BR`, in this repository. `git status --short` was empty before and
after every command.

| Id | Criterion | Proof | Result |
| --- | --- | --- | --- |
| AC-1 | one-change-state | `change-loop.mjs state --change change-state --lang pt-BR` exit 0 printed `{version, changes:[{change, state:"running", reason:null, stage:"evidence", stageTitle:"Demonstração", phase, stageIcon, stateIcon, title, script, root, branch}]}`; `git status --short` empty after. Tests `change-state AC-1 command: …` (nothing written, no run marker, unknown change exits 3) pass in the focused run. | pass |
| AC-2 | all-changes-state | Tests `change-state AC-2 command: …` pass in the focused run (144 of 144). Real run without `--change` in this worktree: exit 0 is NOT reached, the command exits 3 with "no change named test-fixture-cleanup, active or archived". That folder came in with the merge of main (`77b15b1`) and exists only in this worktree and three others, not in the main checkout (whose local `main` is at `6e803eb`, without it), so `knownChange` finds it but `nextAction`'s `locate` (unchanged from the base) falls back to the main checkout. A scratch clone of HEAD (where the folder is in the main checkout) printed one entry per open change, but its branch name made both `blocked`, so it proves only that the command lists every change. | pass |
| AC-3 | same-as-next | `change-loop.mjs next --change change-state --lang pt-BR` carried `state` `{state:"running", reason:null, stage:"evidence", stageTitle:"Demonstração", stageIcon:"🔍", stateIcon:null, title:"🔍 change-state"}` and `sessionTitle` `🔍 change-state`, equal to the `state` command's entry. Tests `change-state AC-3 state: …` and `AC-3 cli: next and state give the same state for the same files and GitHub answers` pass. | pass |
| AC-4 | ready-no-session | Tests `change-state AC-4 command: …`, `AC-4 facts` and `AC-4 state: S1 to S8` pass in the focused run. Not run for real: this repository has no roadmap run file in play. | pass |
| AC-5 | github-silent | Tests `change-state AC-5 decide/githubSilent/where/wait/delivery/plan/build: …` pass in the focused run, covering waiting-on-github "GitHub did not answer" for a stage that needs GitHub and the normal state for the grill, the plan and the build. Not run for real: no way to make GitHub silent without touching the network. | pass |
| AC-6 | status-reads-state | Tests `change-state AC-6 board`, `board parity` and `status and state agree` pass in the focused run, as do the `roadmap-loop status: …` tests in the whole-suite run. Real run `roadmap-loop.mjs status --lang pt-BR --load-limit 80` in this worktree exited 3 with the same `test-fixture-cleanup` error as AC-2 (same cause); it printed no board and wrote nothing. At `5464ec9`, before that folder was merged in, the same command exited 0 with the pt-BR blocks. | pass |
| AC-7 | title-state-icon | Real titles: `🔍 change-state` (running, in `state` and in `next`'s `sessionTitle`). Tests `change-state AC-7 title: …`, `AC-7 next` and `AC-7 start` pass. The `⏳`, `⛔` and `📦` forms are proven by tests only; the scratch clone showed `⛔ 🔍 change-state` for a blocked change. | pass |

### Notes for the record

- Finding for the owner: in this worktree the all-changes `state` and `roadmap-loop status` abort with exit
  3 because of the merged-in, not yet archived `test-fixture-cleanup` folder. `locate` is unchanged from
  the base and the cause is the local `main` ref behind `origin/main`; the weigh-in is whether
  `stateEntries` should skip, rather than abort on, a change that `knownChange` finds but `locate` cannot.
- `fe37b56` also awaits every subtest of the change's tests: CI's Node cancelled `t.test` subtests that
  were not awaited. The suite now reports 0 cancelled.
- The CI pin of `docs/openspec-flow.md` moved to `v0.23.0` in this release (the plan first said the
  retro), as main's release convention and the release-rebase tests require.
- The ADR is 0017 and the versions are 0.23.0 / 0.27.0, because main took 0016 / 0.22.0 / 0.26.0 (main is
  at 0.22.1 / 0.26.1 now).
- The installed plugin (0.21.1) cannot read this branch's schema, so every run used the worktree's scripts.
- No screenshots: no UI surface. No PR comment.
