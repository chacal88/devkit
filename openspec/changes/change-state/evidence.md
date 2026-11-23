<!-- devkit-stage evidence result=passed attempt=1 commit=5464ec9ebb1e693d2fb8d1302e2e86b070811433 -->
Commit: 5464ec9ebb1e693d2fb8d1302e2e86b070811433

# Evidence

Change: `change-state` · Verified at HEAD `5464ec9`, which differs from `8f52bc9` (the commit the
whole suite and the marketplace validation ran on) only in `tasks.md` (the phase 3 ticks).

## Verification

### Gates

The whole suite was run once by the coordinator at `8f52bc9` plus the `tasks.md` tick: exit 0, 1666
tests, 1666 pass, 0 fail (log in the session scratchpad, `gate-3.5.txt`). Gates 1.6 and 2.4 name a
name-filtered subset of that same suite, so the whole-suite run covers them; the verifier also ran
`^change-state` alone at HEAD: 144 tests, 144 pass, 0 fail. `python3 scripts/check.py`,
`python3 scripts/gen-catalog.py --check` and the `grep` were re-run by the verifier at HEAD.

| Gate | Command | Result |
| --- | --- | --- |
| 1.6 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^change-state" --test-name-pattern="^change-loop" --test-name-pattern="^followups" --test-name-pattern="^roadmap-loop" --test-name-pattern="^project-loop" plugins/openspec/hooks/guard.test.mjs` | pass: covered by the whole-suite run, 1666 of 1666 pass |
| 1.6 | `python3 scripts/check.py` | pass: all checks passed (exit 0 at HEAD) |
| 2.4 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^change-state" --test-name-pattern="^change-loop" --test-name-pattern="^followups" --test-name-pattern="^roadmap-loop" --test-name-pattern="^project-loop" plugins/openspec/hooks/guard.test.mjs` | pass: covered by the whole-suite run, 1666 of 1666 pass |
| 2.4 | `python3 scripts/check.py` | pass: all checks passed (exit 0 at HEAD) |
| 3.5 | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs` | pass: exit 0, 1666 tests, 1666 pass, 0 fail (coordinator run) |
| 3.5 | `python3 scripts/check.py` | pass: all checks passed (exit 0 at HEAD) |
| 3.5 | `python3 scripts/gen-catalog.py --check` | pass: exit 0 at HEAD |
| 3.5 | `grep -q "Validation passed" "${TMPDIR%/}/devkit-validate-change-state/phase-3.txt"` | pass: exit 0; record says "Validation passed with warnings" at commit 8f52bc9 (one warning: an unrelated plugin's unknown `types` field) |

Also: `openspec validate change-state --strict` exit 0 ("Change 'change-state' is valid").

### Acceptance criteria

Real runs used the worktree's own scripts (`plugins/openspec/hooks/change-loop.mjs`,
`roadmap-loop.mjs`), `--lang pt-BR`, in this repository. `git status --short` was empty before and
after every command.

| Id | Criterion | Proof | Result |
| --- | --- | --- | --- |
| AC-1 | one-change-state | `change-loop.mjs state --change change-state --lang pt-BR` exit 0 printed `{version, changes:[{change, state:"running", reason:null, stage:"evidence", stageTitle (in pt-BR), phase, stageIcon, stateIcon, title, script, root, branch}]}`; `git status --short` empty after. Tests `change-state AC-1 command: …` (5, incl. "nothing is written", "no run marker", unknown change exits 3) pass. | pass |
| AC-2 | all-changes-state | Same command without `--change` printed one entry per open change folder (here 6 entries, e.g. `change-version-pin` waiting-for-owner, `compozy-driver` running), each with the AC-1 fields, in id order. Tests `change-state AC-2 command: …` (3) pass. | pass |
| AC-3 | same-as-next | `change-loop.mjs next --change change-state --lang pt-BR` carried `state` `{state:"running", reason:null, stage:"evidence", …, title:"🔍 change-state"}`, equal to the `state` command's entry for the same files. Tests `change-state AC-3 state: …` (11) and `change-state AC-3 cli: next and state give the same state for the same files and GitHub answers` pass. | pass |
| AC-4 | ready-no-session | Tests `change-state AC-4 command: …` (4: no session of its own, a start waiting for a place, no run file gives plain state, a change off the roadmap), `AC-4 facts` and `AC-4 state: S1 to S8` pass. Not run for real: this repository has no roadmap run file in play. | pass |
| AC-5 | github-silent | Tests `change-state AC-5 decide/githubSilent/where/wait/delivery/plan/build: …` (12) pass, covering waiting-on-github "GitHub did not answer" for a stage that needs GitHub and the normal state for the grill, the plan and the build. Not run for real: no way to make GitHub silent without touching the network. | pass |
| AC-6 | status-reads-state | `roadmap-loop.mjs status --lang pt-BR --load-limit 80` exit 0 printed the pt-BR blocks for waiting on the owner (`change-version-pin`, matches its `waiting-for-owner` state), under way (`change-state`, `compozy-driver`, `delivery-models` running, matching the command), blocked (`release-merge-conflict`), queued, and wrote nothing. Tests `change-state AC-6 board`, `board parity` and `status and state agree` pass, as do the existing `roadmap-loop status: …` tests in the whole-suite run. | pass |
| AC-7 | title-state-icon | Real titles: `🔍 change-state` (running, in `state` and in `next`'s `sessionTitle`) and `🙋 📝 change-version-pin` (waiting for the owner). Tests `change-state AC-7 title: …` (6, incl. 59 code point cut), `AC-7 next` and `AC-7 start` pass. The `⏳`, `⛔` and `📦` forms are proven by tests only. | pass |

### Notes for the record

- The CI pin of `docs/openspec-flow.md` moved to `v0.23.0` in this release (the plan first said the
  retro), as main's release convention and the release-rebase tests require.
- The ADR is 0017 and the versions are 0.23.0 / 0.27.0, because main took 0016 / 0.22.0 / 0.26.0.
- The installed plugin (0.21.1) cannot read this branch's schema, so every run used the worktree's scripts.
- No screenshots: no UI surface. No PR exists, so no PR comment.
