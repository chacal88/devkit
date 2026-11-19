# Tasks

Change: `orchestrator-replan` · Date: 2026-11-19 · Owner: Kaue (chacal88)

Work only in this change's worktree, on its branch. Every exact text to write is in `design.md`
(D-1 ADR texts, D-2 outline, D-3 roadmap, D-4 rewordings R-1 to R-6 and links L-1, L-2, D-8 config
line); the implementer copies them and makes no design choice. `requirements.md` is the source of
the design document's content.

Every gate is one backticked command, run as written: the flow takes the first backticked text after
`Gate:` and runs each `&&` part on its own, and `pr-verifier` copies each part verbatim into its
Gates table, so no part holds a `|` (alternatives are separate `-e` or `--test-name-pattern`
arguments, and outputs to read go through a file in `$TMPDIR`). The desktop app's bundled Claude
Code is named without its version, as `CONTRIBUTING.md` says.

The 22 tests that read the edited files (`design.md` D-5) run filtered in phases 1 and 2, as
`DOCTESTS` below, in about 0.2 s (`guard.test.mjs` imports every other test file, so one command
reaches all of them). The whole guard suite (669 tests, about 8.5 minutes on the base) runs once, at 3.1, as
a background Bash, never as a foreground tool call.

DOCTESTS = `node --test --test-name-pattern="^ADR 00" --test-name-pattern="^README" --test-name-pattern="^docs sweep" --test-name-pattern="^AC-6 instructions-follow" --test-name-pattern="^AC-8 release-ready" --test-name-pattern="^the pin in docs" --test-name-pattern="^the hook docs" --test-name-pattern="^review round: text" --test-name-pattern="^release-rebase pin: the real" plugins/openspec/hooks/guard.test.mjs`
(written out in full in each gate).

OD-1 (`proposal.md`, `design.md` D-6) is decided as (a): task 1.2 rewrites the one ADR 0007 status
assertion of `guard.test.mjs`. The `devkit-openspec` release of `design.md` D-7 (task 2.6) comes
from the pack README sentence, and the assertion rides in it.

A test that proves a criterion is named by the criterion's id and slug in `evidence.md`; `pr-verifier`
writes one row per id, AC-1 to AC-7.

| Id | Slug | Tasks |
|---|---|---|
| AC-1 | `adr-0010-recorded` | 1.1, 1.2, 1.3, 1.4, 1.9 |
| AC-2 | `design-document-complete` | 1.5, 1.6, 1.7, 1.9 |
| AC-3 | `roadmap-rewritten` | 2.3, 2.7 |
| AC-4 | `claims-true-at-the-commit` | 1.3, 1.4, 2.2, 2.4, 2.5, 2.6, 2.7 |
| AC-5 | `mock-and-page-kept` | 1.5, 1.8, 1.9 |
| AC-6 | `gates-green` | 1.2, 2.6, 2.7, 3.1, 3.2 |
| AC-7 | `design-rules-load` | 2.1, 2.7 |

## 1. The decision and the design (AC-1, AC-2, AC-5)

Test first: 1.2 changes the ADR 0007 assertion before 1.3 changes ADR 0007, so the filtered run is
red between them; every `grep` and `test` part of gate 1.9 fails on the base (no ADR 0010, no
design document).

- [x] 1.1 Create `docs/adr/0010-openspec-as-the-harness.md` with the text of `design.md` D-1, as is
  (the fence removed). Verify: `grep -qx -- "- Status: accepted"` on it, and its Alternatives table
  has the rows for app child sessions per stage, a session that remembers and a single-platform
  design. (AC-1)
- [x] 1.2 In `plugins/openspec/hooks/guard.test.mjs` (test "ADR 0006 supersedes ADR 0005, and ADR
  0001 and the config point to it", line 1312) replace the ADR 0007 status assertion with the one
  in `design.md` D-6 (a); no other line of the file changes. Invariant: ADR 0007 is complete and its
  status is stated; layer: the decision records; suite: `guard.test.mjs`. Verify: DOCTESTS fails on
  that test only, until 1.3. (AC-1, AC-6)
- [x] 1.3 In `docs/adr/0001-coordination-without-a-harness.md` and
  `docs/adr/0007-one-change-on-request.md` replace `- Status: accepted` with the status line of
  `design.md` D-1 and add its note as the first paragraph under `## Context`; nothing else in either
  file changes (ADR 0001 keeps its Note naming ADR 0006 and ADR 0008). Verify: DOCTESTS green.
  (AC-1, AC-4)
- [x] 1.4 Add the D-1 notes as the first paragraph under `## Context` of
  `docs/adr/0006-phases-as-child-sessions.md`, `docs/adr/0008-reviews-as-a-workflow.md` and
  `docs/adr/0009-compozy-loop-as-a-second-driver.md`; their status lines and ADR 0006's `- Amended
  by` line stay. Verify: `grep -c "ADR 0010"` is at least 1 in each, DOCTESTS green. (AC-1, AC-4)
- [x] 1.5 Write `docs/coordination-design.md` from `requirements.md` D-1 to D-13, following the
  outline of `design.md` D-2: the 13 `## <n>. <title> (D-<n>)` headings, then "Open points", "What
  stays shipped until its round" and "Withdrawn roadmap items"; every item marked decided, proposed
  or open; the D-4 stage table with role, skills, product and gate per stage; the three delivery
  models; the D-8 harness rules, lock table and configuration example; the D-11 build order with its
  round, change id and `after:` per step (`design.md` D-3); section 6 names the mock folder as D-2
  says. Follow the five writing constraints of D-2, the tense rule included: every piece the
  design adds reads as to be built, with its round. Verify: `scripts/check.py` and DOCTESTS green,
  13 `(D-n)` headings. (AC-2, AC-5)
- [x] 1.6 Add row L-1 (`design.md` D-4) to `CLAUDE.md`'s "Where the rules are" table, after the
  CompozyOS row. Verify: `grep -qF "docs/coordination-design.md" CLAUDE.md`. (AC-2)
- [x] 1.7 Add bullet L-2 to `README.md`'s Documentation list, after "The OpenSpec flow". Verify:
  `grep -qF "docs/coordination-design.md" README.md`, DOCTESTS green. (AC-2)
- [x] 1.8 Verify the mock, which is already in the change folder: `mock/` holds `Band.dc.html`,
  `Help.dc.html`, `Main.dc.html`, `Manager.dc.html`, `Stage.dc.html`, `canvas.json` and
  `planning-page.pt-BR.html`, none ignored by Git (`git check-ignore` prints nothing), so the
  change's commit carries them. No file in it is edited. (AC-5)
- [x] 1.9 Gate: `node --test --test-name-pattern="^ADR 00" --test-name-pattern="^README" --test-name-pattern="^docs sweep" --test-name-pattern="^AC-6 instructions-follow" --test-name-pattern="^AC-8 release-ready" --test-name-pattern="^the pin in docs" --test-name-pattern="^the hook docs" --test-name-pattern="^review round: text" --test-name-pattern="^release-rebase pin: the real" plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py && grep -qx -- "- Status: accepted" docs/adr/0010-openspec-as-the-harness.md && grep -qx -- "- Status: superseded by ADR 0010 (0010-openspec-as-the-harness.md)" docs/adr/0001-coordination-without-a-harness.md && grep -qx -- "- Status: superseded by ADR 0010 (0010-openspec-as-the-harness.md)" docs/adr/0007-one-change-on-request.md && grep -qF "ADR 0010" docs/adr/0006-phases-as-child-sessions.md && grep -qF "ADR 0010" docs/adr/0008-reviews-as-a-workflow.md && grep -qF "ADR 0010" docs/adr/0009-compozy-loop-as-a-second-driver.md && test "$(grep -c '^## .*(D-[0-9]*)$' docs/coordination-design.md)" = 13 && grep -qF "openspec/changes/orchestrator-replan/mock/" docs/coordination-design.md && grep -qF "docs/coordination-design.md" CLAUDE.md && grep -qF "docs/coordination-design.md" README.md && test -f openspec/changes/orchestrator-replan/mock/canvas.json && test -f openspec/changes/orchestrator-replan/mock/planning-page.pt-BR.html && test -f openspec/changes/orchestrator-replan/mock/Band.dc.html && test -f openspec/changes/orchestrator-replan/mock/Help.dc.html && test -f openspec/changes/orchestrator-replan/mock/Main.dc.html && test -f openspec/changes/orchestrator-replan/mock/Manager.dc.html && test -f openspec/changes/orchestrator-replan/mock/Stage.dc.html` green; covers AC-1, AC-2, AC-5.

## 2. The files that state the rule (AC-3, AC-4, AC-7)

Test first: on the base each negative `grep` of gate 2.7 finds its line, the session report shows
`Round 5`, and `openspec instructions design` prints the "ignoring this artifact's rules" warning;
each part turns green with its task.

- [x] 2.1 Quote the third `rules.design` entry of `openspec/config.yaml` as `design.md` D-8 gives it.
  Verify: `openspec instructions design --change orchestrator-replan --json` prints no warning and
  returns the three design rules. (AC-7)
- [x] 2.2 Replace the `ADRs:` line of `openspec/config.yaml`'s `context:` with the line of
  `design.md` D-4. Verify: DOCTESTS green (the pinned substrings hold). (AC-4)
- [x] 2.3 Rewrite `openspec/roadmap.md` to the text of `design.md` D-3: delete the six unticked lines
  and the headings of rounds 5, 11 and 13, add the paragraph and rounds 14 to 24; no ticked line and
  not the round 2 carry-over note changes. Verify: `git diff origin/main -- openspec/roadmap.md`
  shows no removed `- [x]` line, 11 ticked lines remain, and
  `node plugins/openspec/hooks/guard.mjs session <<< "{}"` reports `Round 14: the script and the
  checker (0/1 done)` with `flow-script-checker: not started`. (AC-3)
- [x] 2.4 In `README.md` apply R-1, the heading change of `README.md:54` (`## How the flow holds`),
  R-2 and R-3 (`design.md` D-4). Verify: DOCTESTS green; no line still says "Coordination is
  allowed; a harness is not", "Why no harness" or "enforce without a harness". (AC-4)
- [x] 2.5 In `docs/openspec-flow.md` add R-5 and R-6 (neither holds a `vN.N.N` token), and in
  `docs/compozy-kit.md` apply R-8 and R-4; this task does not touch the CI pin (2.6 does). Verify: DOCTESTS green (the pin tests included),
  `grep -c "ADR 0010"` at least 1 in each file, `docs/compozy-kit.md` no longer says "never a
  harness that replaces it". (AC-4)
- [x] 2.6 In `plugins/openspec/README.md` replace the first sentence of line 3 with R-7, and in the
  same task make the release of `design.md` D-7: `devkit-openspec` `0.14.1` → `0.14.2` in
  `plugins/openspec/.claude-plugin/plugin.json` and its `.claude-plugin/marketplace.json` entry,
  marketplace `metadata.version` `0.18.0` → `0.18.1`, the `## 0.18.1` entry at the top of
  `CHANGELOG.md` as D-7 words it, and the three pin lines of `docs/openspec-flow.md` (486, 487,
  494) from `v0.14.1` to `v0.14.2`. Test first: after the version moves and before the pin does,
  DOCTESTS is red on "the pin in docs/openspec-flow.md ..." and "AC-8 release-ready"; it turns green
  with the pin. Verify: DOCTESTS and `scripts/check.py` green, `gen-catalog.py --check` exits 0,
  and each release part of gate 2.7 passes, every one of which fails on the base: `plugin.json`
  `version` is `0.14.2`; the `devkit-openspec` entry of `marketplace.json` is `0.14.2`; the
  marketplace `metadata.version` is `0.18.1`; `CHANGELOG.md` has a `## 0.18.1 ` heading; the three
  pin lines read `pinned to the commit of v0.14.2`, `<commit sha of v0.14.2>` and
  `git/ref/tags/v0.14.2`, and no `v0.14.1` is left. (AC-4, AC-6)
- [x] 2.7 Gate: `node --test --test-name-pattern="^ADR 00" --test-name-pattern="^README" --test-name-pattern="^docs sweep" --test-name-pattern="^AC-6 instructions-follow" --test-name-pattern="^AC-8 release-ready" --test-name-pattern="^the pin in docs" --test-name-pattern="^the hook docs" --test-name-pattern="^review round: text" --test-name-pattern="^release-rebase pin: the real" plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py && openspec validate orchestrator-replan --strict && openspec instructions design --change orchestrator-replan --json > "${TMPDIR:-/tmp}/orchestrator-replan-design.json" 2>&1 && ! grep -qF "ignoring this artifact" "${TMPDIR:-/tmp}/orchestrator-replan-design.json" && grep -qF "Record any decision that changes an ADR" "${TMPDIR:-/tmp}/orchestrator-replan-design.json" && grep -qF "A sentence saying a test pins a behaviour" "${TMPDIR:-/tmp}/orchestrator-replan-design.json" && grep -qF "Read the ADRs' rejected alternatives" "${TMPDIR:-/tmp}/orchestrator-replan-design.json" && grep -qF "0001 coordination without a harness, superseded by 0010" openspec/config.yaml && grep -qF "0007 one change on request, superseded by 0010" openspec/config.yaml && node plugins/openspec/hooks/guard.mjs session <<< "{}" > "${TMPDIR:-/tmp}/orchestrator-replan-session.txt" && grep -qF "Roadmap: Round 14: the script and the checker (0/1 done)" "${TMPDIR:-/tmp}/orchestrator-replan-session.txt" && ! grep -nF -e "- [ ] commit-and-pr-trailer" -e "- [ ] conventions-trailer" -e "- [ ] review-writer-prompt" -e "- [ ] ac-clause-coverage" -e "- [ ] compozy-loop-v2-dogfood" -e "- [ ] release-pin-in-release-files" openspec/roadmap.md && test "$(grep -c '^- \[x\] ' openspec/roadmap.md)" = 11 && ! grep -nF -e "Coordination is allowed; a harness is not" -e "## Why no harness" -e "enforce without a harness" README.md && ! grep -nF "never a harness that replaces it" docs/compozy-kit.md && grep -qF "ADR 0010" docs/openspec-flow.md && ! grep -qF "OpenSpec) without a harness" plugins/openspec/README.md && grep -qF "0010-openspec-as-the-harness.md" plugins/openspec/README.md && python3 -c "import json,sys; sys.exit(0 if json.load(open('plugins/openspec/.claude-plugin/plugin.json'))['version']=='0.14.2' else 1)" && python3 -c "import json,sys; m=json.load(open('.claude-plugin/marketplace.json')); sys.exit(0 if [p['version'] for p in m['plugins'] if p['name']=='devkit-openspec']==['0.14.2'] else 1)" && python3 -c "import json,sys; sys.exit(0 if json.load(open('.claude-plugin/marketplace.json'))['metadata']['version']=='0.18.1' else 1)" && grep -q "^## 0.18.1 " CHANGELOG.md && grep -qF "pinned to the commit of v0.14.2" docs/openspec-flow.md && grep -qF "<commit sha of v0.14.2>" docs/openspec-flow.md && grep -qF "git/ref/tags/v0.14.2" docs/openspec-flow.md && ! grep -qF "v0.14.1" docs/openspec-flow.md && python3 scripts/gen-catalog.py --check` green; covers AC-3, AC-4, AC-6 (the release), AC-7.

## 3. Regression gate (AC-6)

Nothing is edited in this phase. A red part sends its fix back to the phase that owns the file, and
that phase's gate runs again before 3.2.

- [x] 3.1 Run the whole guard suite once, as a background Bash, and record its counts (669 or more
  tests, 0 fail) for `pr-verifier` and the reviewers, so nobody re-runs it. (AC-6) Recorded: 669 tests, 669 pass, 0 fail, at working tree on 99474cf.
- [x] 3.2 Gate: `node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && "$(for c in "$HOME/Library/Application Support/Claude/claude-code/"*/*/claude.app/Contents/MacOS/claude; do :; done; echo "$c")" plugin validate . && git diff --quiet origin/main -- 'plugins/*/agents/*' 'plugins/*/skills/*' 'plugins/*/schemas/*' && git diff --quiet origin/main -- 'plugins/*/hooks/*' ':!plugins/openspec/hooks/guard.test.mjs' && git diff --quiet origin/main -- plugins/core/.claude-plugin plugins/design/.claude-plugin plugins/stack/.claude-plugin plugins/ai-engineering/.claude-plugin plugins/panel/.claude-plugin plugins/compozy/.claude-plugin docs/catalog.md && test -z "$(git ls-files --others --exclude-standard -- plugins)"` green; covers AC-6 (as AC-6 now reads: under `plugins/*/hooks` only `guard.test.mjs` differs, and `pr-verifier` records `git diff origin/main -- plugins/openspec/hooks/guard.test.mjs` showing the one assertion).

## Workflow follow-up

- After the merge, push the lightweight tag `v0.14.2` on the merge commit (`git tag v0.14.2 <merge
  sha>`, then `git push origin v0.14.2`), as `CONTRIBUTING.md` says for a `devkit-openspec` release.
- After the merge, `ship-change` archives the change; `openspec/roadmap.md` lists no line for it, so
  there is no tick. A retro proposal that edits `openspec/config.yaml` must name that path.
- Change 2 of the build order (`flow-script-checker`) is planned from `docs/coordination-design.md`
  alone; whether that held is recorded in this change's `retro.md` (AC-2's real proof).
