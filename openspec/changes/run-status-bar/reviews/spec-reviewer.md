Verdict: approved
Commit: a46bf795f7bb603ae110183d20a8cd1f5630596a

## Spec review — run-status-bar

### Findings
- [nit] openspec/changes/run-status-bar/specs/status-line/spec.md:89-91 (requirement "The line is at most 100 columns", scenario "The reason is dropped"); plugins/openspec/hooks/status-line.mjs:93-99 — The spec says the reason is cut "to its first word" and ends in an ellipsis, but the code never tries `<word>…` for a one-word reason and drops it at once; the spec does not say which is meant (open since round 1, unchanged since 3a53ac9; flagged, not interpreted).
- [nit] openspec/changes/run-status-bar/tasks.md:13-14 against tasks.md:153-158 (gate 3.4) — The preamble still says "Every gate runs with `GITHUB_HEAD_REF` and `GITHUB_BASE_REF` set", but the amended gate 3.4 is now `node scripts/test-suite.mjs && ...` with no CI branch variables (the train's text), so the plan's verification metadata contradicts itself; the preamble needs the same exception the 3.4 amendment records.

In-scope specs: `openspec/changes/run-status-bar/specs/status-line/spec.md`, `openspec/changes/run-status-bar/specs/change-state/spec.md`; baseline `openspec/specs/change-state/spec.md`.

### Coverage
| Requirement | Status |
|---|---|
| status-line: The session's line is chosen from its input | covered |
| status-line: The change's line | covered |
| status-line: The line is at most 100 columns | covered |
| status-line: The coordinator's counts | covered |
| status-line: The line is in the person's language | covered |
| status-line: The command only reads | covered |
| change-state: Each entry lists the stages that apply to the change | covered |
| change-state: The state is read without GitHub on request | covered |

### Notes
- Scope of this re-check: only what the branch brings since my approved verdict at `3a53ac9`. That is the resolution of merge `aa8a685` (origin/main `d917ae0`) in its six conflicted files, compared with both parents `009b455` and `d917ae0`, plus the change folder edits in `83650a5` and `a46bf79` (`design.md`, `tasks.md`, `evidence.md`). It does not cover main's own commits.
- Spec deltas: `git diff --stat 3a53ac9 HEAD` shows no change to `specs/`, `proposal.md`, `requirements.md` or `openspec/specs/change-state/spec.md`. The merge changed only main's `openspec/specs/commit-attribution/spec.md`, which is out of this change's scope. The coverage above stands as in round 2.
- Merge resolution, file by file:
  - `plugin.json`: the resolution takes the next number above main, devkit-openspec 0.43.0 (main 0.42.0, branch 0.40.0).
  - `marketplace.json`: the devkit-openspec entry is 0.43.0 and the marketplace metadata is 0.48.0 (main 0.47.0).
  - `CHANGELOG.md`: this change's entry is renumbered `## 0.48.0` / `devkit-openspec 0.43.0` with the pin sentence at `v0.43.0`, it sits above main's 0.47.0, 0.46.0 and 0.45.0 entries, and its text is otherwise unchanged.
  - `docs/openspec-flow.md`: all four CI pin occurrences (comment, URL, `(v... above)`, `git/ref/tags/v...`) read `v0.43.0`.
  - `change-loop.mjs`: the `USAGE` line keeps main's `merge-check <id>` and this change's `state [--change <id>] [--offline]`; nothing else conflicted.
  - `change-loop-compozy.test.mjs`: equals main's file byte for byte (`git diff d917ae0 aa8a685` is empty), so E-3 is dropped. The test now derives the pin from `plugin.json` through `pinMismatches` (ADR 0030), and the doc follows the manifest.
  - None of these edits adds or removes behaviour, so there is no scope creep and no gap.
- Change folder edits:
  - `design.md`: adds a context paragraph, marks E-3 superseded by ADR 0030, and moves the D-13 release target to 0.43.0/0.48.0. The design says scope and behaviour do not change, and the diff confirms it.
  - `tasks.md`: notes E-3 as superseded and updates the 3.1 numbers and check. The 3.1 check now includes `git diff --quiet d917ae0 HEAD -- change-loop-compozy.test.mjs`. Gate 3.4's suite part is amended to the train's text (docs/openspec-flow.md "Gate parts proven by the train", which is on main).
  - `evidence.md`: re-records the AC proofs at `83650a5`, and every AC still maps to the spec scenarios. None of these edits adds or removes a requirement.
- The gate 3.4 amendment changes a verification step of the approved plan after approval. That is a process matter for the other reviewers and the owner, not a spec gap, and the evidence names it in "Notes for the owner". Its only spec-side trace is the preamble inconsistency in F2.
- No ADR contradiction: ADR 0030 (accepted on main) is what makes E-3 obsolete, and the change follows it rather than bypassing it. No two specs disagree, and no open decision is at play.
- Tests: I ran none this round. The caller reports that the seven touched files passed at the merge head (935/935), and so did gates 1.7 and 2.5 (693/693, 341/341, 4/4). The merge resolution touches no code path the spec scenarios govern (version strings and one usage line only).

### Summary
- 2 findings (0 scope creep, 0 gaps): 2 nits, one carried open from round 1 (F1) and one new in the change folder edits (F2). Nothing blocking or important.
