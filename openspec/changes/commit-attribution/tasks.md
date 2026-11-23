<!-- devkit-stage tasks result=passed attempt=1 commit=c56155334749cdc46bad077ba8f53c4bbec5d140 -->
# Tasks

Change: `commit-attribution` · Date: 2026-11-22 · Owner: Kaue (chacal88)

Work only in this change's worktree, on its branch. Every text, name, test and command is in `design.md`: D-1 the
helper, D-2 the request and the block, D-3 the agent's text, D-4 the skills, D-5 the flow doc, D-6 the existing test
that changes, D-7 the new tests (T1 to T36), D-8 the real run, D-9 this change's own commits, D-10 the release. The
implementer copies them and makes no design choice.

Every gate is one backticked command, run as written. The flow takes the first backticked text after `Gate:` and runs
each `&&` part on its own, so no part holds a `|`. Every new test's name starts `commit-attribution AC-<n> `. Every
new hook test takes its env from the file's existing fixtures, which blank `DEVKIT_BYPASS`, `DEVKIT_BRANCH`,
`DEVKIT_CHANGE`, `GITHUB_HEAD_REF`, `GITHUB_BASE_REF` and `GITHUB_EVENT_PATH`; every hook gate runs with
`GITHUB_HEAD_REF` and `GITHUB_BASE_REF` set, as a pull-request run on CI does. The tests need the `openspec` CLI 2.x
on `PATH`. The whole suite (`node --test plugins/openspec/hooks/guard.test.mjs`, 13 to 21 minutes) runs once, in 2.5,
as a background command of the tool. The marketplace check is written `command claude plugin validate .`, so that the
shell function named `claude` is skipped.

Test first: write the tests, see them fail, then make them pass. An existing test changes only where `design.md` D-6
names it, with its invariant named in the commit message. Leave no backup or scratch file in the tree, and end every
task with `git status --short`.

| Id | Slug | Tasks |
|---|---|---|
| AC-1 | `brief-carries-lines` | 1.1, 1.2, 1.3, 1.5, 1.6, 2.1 |
| AC-2 | `agent-prefers-brief` | 1.1, 1.4, 1.6 |
| AC-3 | `scratch-run-names-session-model` | 2.3, 2.5 |
| AC-4 | `this-change-commits-name-session` | 2.4 |

## 1. The request, the agent and the skills (AC-1, AC-2)

- [x] 1.1 Write the tests of D-7 (T1 to T20 in `plugins/openspec/hooks/change-loop.test.mjs`, T21 to T25 in
  `plugins/openspec/hooks/project-loop.test.mjs`, T26 to T36 in `plugins/openspec/hooks/deliver-check.test.mjs`) and
  the D-6 change of the test "change-loop brief: names the role, the change and the stage and holds no skill text".
  Check: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^commit-attribution" plugins/openspec/hooks/guard.test.mjs`
  exits non-zero: the suite loads (no import error), each test that asserts a presence (T1 to T5, T12, T15 to T24,
  T26 to T36) fails on its own assertion, and the negatives T6 to T11 and T25 may already pass.
- [x] 1.2 D-1 in `plugins/openspec/hooks/change-loop.mjs`: the four exports, `AGENT['commit-and-pr']` set to
  `COMMIT_AGENT`, and the `agent` builder of `decide()`. Check: T1 to T15 and the D-6 test pass.
- [x] 1.3 D-1 in `plugins/openspec/hooks/project-loop.mjs`: the import, the `AGENT` map and the `agent` builder; no
  second copy of the request text (`grep -c "appends below this brief" plugins/openspec/hooks/project-loop.mjs`
  prints 0). Check: T21 to T25 pass.
- [x] 1.4 D-3 in `plugins/core/agents/commit-and-pr.md`: the Receives bullet, Method 3 and 5, the `## Attribution`
  section and the Never line; the `description` unchanged. Check: T26 to T32 pass, and the existing tests
  "format: commit-and-pr names commit-only, an open PR, and the PR body contents" and "format: commit-and-pr has an
  archive call: …" still pass.
- [x] 1.5 D-4 in `plugins/openspec/skills/ship-change/SKILL.md` (the `## Attribution` section and the three rows) and
  `plugins/openspec/skills/devkit/SKILL.md` (the four sentences). Check: T16 to T20 and T33 to T36 pass, and the
  existing skill tests of `change-loop.test.mjs` (the `push-rebased` sentence, the Loop's `subagent_type` sentence),
  `roadmap-loop.test.mjs` (the roadmap's `brief` exactly as given) and `deliver-check.test.mjs` (the archive rows)
  still pass.
- [x] 1.6 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^commit-attribution" --test-name-pattern="^change-loop" --test-name-pattern="^project-loop" --test-name-pattern="^roadmap-loop skill" --test-name-pattern="^format:" plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py` green; covers AC-1 (T1 to T25, T33 to T36) and AC-2 (T20, T26 to T32).

## 2. Documents, release and the real run (AC-1, AC-3, AC-4)

- [x] 2.1 D-5: the **Attribution.** paragraph in `docs/openspec-flow.md`, right after the paragraph that starts
  "**The loop.**". Check: `grep -c "^\*\*Attribution\.\*\*" docs/openspec-flow.md` prints 1 and
  `python3 scripts/check.py` passes.
- [x] 2.2 D-10: the versions in `plugins/core/.claude-plugin/plugin.json`,
  `plugins/openspec/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` (the next minor after
  `origin/main`'s for each, today 0.10.0, 0.22.0 and 0.26.0), the `CHANGELOG.md` section, the three CI pin mentions of
  `docs/openspec-flow.md`, and the pin assertions of the test "change-loop docs: the design records the answers" in
  `change-loop.test.mjs`. Check: that test passes, and `python3 scripts/gen-catalog.py --check` and
  `command claude plugin validate .` pass.
- [x] 2.3 D-8: the real run in a scratch project outside this repository, with the outputs
  `openspec/changes/commit-attribution/proof/ac3-run.jsonl`, `ac3-trailers.txt` and `ac3-message.txt`; the `init`
  event loads devkit-core from this worktree's `plugins/core` and the stream holds the Agent call to
  `devkit-core:commit-and-pr` (D-8, step 5). Check: `ac3-trailers.txt` has exactly one non-empty line,
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. When the agent writes another line, stop and report: the
  plan's wording (D-2, D-3) is revised before anything else.
- [x] 2.4 D-9: every hand-off of this change to `devkit-core:commit-and-pr` carries the block of D-2 with the
  conducting session's own lines, appended by hand while the installed loop is the older one. Check: D-9's `git log`
  command, run in the worktree, lists for each commit exactly the session's trailer and no Sonnet line (no commit is
  listed while the branch has none); `pr-verifier` runs it again at its HEAD and records it under AC-4.
- [x] 2.5 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && command claude plugin validate . && openspec validate commit-attribution --strict && grep -qx "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" openspec/changes/commit-attribution/proof/ac3-trailers.txt && test "$(grep -c . openspec/changes/commit-attribution/proof/ac3-trailers.txt)" = 1 && grep -q "devkit-core:commit-and-pr" openspec/changes/commit-attribution/proof/ac3-run.jsonl` green, the whole suite run once as a background command; covers AC-1 to AC-3, and AC-4 through 2.4.

## Workflow follow-up

- After the merge, tag `v<devkit-openspec version>` on the merge commit and push the tag (`CONTRIBUTING.md`, step 5).
- The retro checks AC-4 again on every commit of the branch made after the evidence (D-9).
- Dogfood: the next change delivered with the released version shows the session's trailer on its commit-agent
  commits and the session's footer on its pull request, with no line added by hand (`requirements.md`, Dogfood).
